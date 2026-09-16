package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/url"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/smithy-go"
)

// S3Config contiene i parametri di uno storage compatibile S3.
type S3Config struct {
	// Endpoint dell'API S3, ad esempio https://<account-id>.r2.cloudflarestorage.com
	// (oppure https://<account-id>.eu.r2.cloudflarestorage.com per un bucket con giurisdizione UE).
	Endpoint        string
	Bucket          string
	AccessKeyID     string
	SecretAccessKey string
	// PublicURL è l'indirizzo pubblico del bucket (dominio r2.dev o personalizzato), senza "/" finale.
	PublicURL string
	// Region: "auto" per R2.
	Region string
}

// Enabled indica se la configurazione è completa.
func (c S3Config) Enabled() bool {
	return c.Endpoint != "" && c.Bucket != "" && c.AccessKeyID != "" && c.SecretAccessKey != "" && c.PublicURL != ""
}

type s3Storage struct {
	client    *s3.Client
	presign   *s3.PresignClient
	bucket    string
	publicURL string
}

// New restituisce lo storage S3, o Disabled se la configurazione è incompleta.
func New(cfg S3Config) Storage {
	if !cfg.Enabled() {
		return Disabled{}
	}
	region := cfg.Region
	if region == "" {
		region = "auto"
	}
	client := s3.New(s3.Options{
		Region:       region,
		BaseEndpoint: aws.String(cfg.Endpoint),
		Credentials:  credentials.NewStaticCredentialsProvider(cfg.AccessKeyID, cfg.SecretAccessKey, ""),
		// Indirizzi nella forma endpoint/bucket/chiave: funzionano con R2 e con gli storage locali di prova
		UsePathStyle: true,
		// R2 non supporta i checksum aggiunti di default dalle versioni recenti dell'SDK
		RequestChecksumCalculation: aws.RequestChecksumCalculationWhenRequired,
		ResponseChecksumValidation: aws.ResponseChecksumValidationWhenRequired,
	})
	return &s3Storage{
		client:    client,
		presign:   s3.NewPresignClient(client),
		bucket:    cfg.Bucket,
		publicURL: strings.TrimRight(cfg.PublicURL, "/"),
	}
}

func (s *s3Storage) PresignUpload(ctx context.Context, key, contentType string, expires time.Duration) (Upload, error) {
	req, err := s.presign.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(key),
		ContentType: aws.String(contentType),
	}, s3.WithPresignExpires(expires))
	if err != nil {
		return Upload{}, fmt.Errorf("firma del caricamento: %w", err)
	}
	// Content-Type fa parte della firma: il browser deve inviarlo identico
	return Upload{URL: req.URL, Headers: map[string]string{"Content-Type": contentType}}, nil
}

func (s *s3Storage) Stat(ctx context.Context, key string) (ObjectInfo, error) {
	out, err := s.client.HeadObject(ctx, &s3.HeadObjectInput{Bucket: aws.String(s.bucket), Key: aws.String(key)})
	if err != nil {
		return ObjectInfo{}, notFound(err)
	}
	return ObjectInfo{Size: aws.ToInt64(out.ContentLength), ContentType: aws.ToString(out.ContentType)}, nil
}

func (s *s3Storage) ReadPrefix(ctx context.Context, key string, n int) ([]byte, error) {
	out, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
		Range:  aws.String(fmt.Sprintf("bytes=0-%d", n-1)),
	})
	if err != nil {
		return nil, notFound(err)
	}
	defer out.Body.Close()
	return io.ReadAll(io.LimitReader(out.Body, int64(n)))
}

func (s *s3Storage) Move(ctx context.Context, from, to string) error {
	_, err := s.client.CopyObject(ctx, &s3.CopyObjectInput{
		Bucket:     aws.String(s.bucket),
		Key:        aws.String(to),
		CopySource: aws.String(s.bucket + "/" + escapeKey(from)),
	})
	if err != nil {
		return notFound(err)
	}
	return s.Delete(ctx, from)
}

func (s *s3Storage) Delete(ctx context.Context, key string) error {
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: aws.String(s.bucket), Key: aws.String(key)})
	if err != nil && !errors.Is(notFound(err), ErrNotFound) {
		return err
	}
	return nil
}

func (s *s3Storage) PublicURL(key string) string {
	return s.publicURL + "/" + key
}

// escapeKey codifica ogni segmento della chiave per CopySource, lasciando le "/".
func escapeKey(key string) string {
	parts := strings.Split(key, "/")
	for i, p := range parts {
		parts[i] = url.PathEscape(p)
	}
	return strings.Join(parts, "/")
}

// notFound converte gli errori "oggetto inesistente" di S3 in ErrNotFound.
func notFound(err error) error {
	var apiErr smithy.APIError
	if errors.As(err, &apiErr) {
		switch apiErr.ErrorCode() {
		case "NotFound", "NoSuchKey":
			return fmt.Errorf("%w: %v", ErrNotFound, err)
		}
	}
	return err
}
