package listings

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"time"

	"roomdate-backend/internal/apperr"
	"roomdate-backend/internal/db"
	"roomdate-backend/internal/logx"
	"roomdate-backend/internal/storage"
	"roomdate-backend/internal/validate"
	"roomdate-backend/shared"
)

const (
	latestLimit = 50

	// Solo chi affitta può pubblicare annunci. Il ruolo si legge dal database a ogni richiesta.
	landlordUserType = "affitta"

	// Foto: il browser le ridimensiona prima di caricarle, quindi 5 MB è un limite largo.
	MaxImages        = 8
	MaxImageBytes    = 5 << 20
	uploadURLExpires = 10 * time.Minute
)

// Tipi di immagine accettati, con l'estensione usata nelle chiavi e i primi byte del formato.
var imageTypes = map[string]struct {
	ext   string
	magic func([]byte) bool
}{
	"image/jpeg": {"jpg", func(b []byte) bool { return bytes.HasPrefix(b, []byte{0xFF, 0xD8, 0xFF}) }},
	"image/png":  {"png", func(b []byte) bool { return bytes.HasPrefix(b, []byte("\x89PNG\r\n\x1a\n")) }},
	"image/webp": {"webp", func(b []byte) bool {
		return len(b) >= 12 && bytes.Equal(b[0:4], []byte("RIFF")) && bytes.Equal(b[8:12], []byte("WEBP"))
	}},
}

var (
	errSessionInvalid    = apperr.Unauthorized("session_invalid", "Sessione scaduta: accedi di nuovo")
	errNotLandlordCreate = apperr.Forbidden("landlord_only", "Solo chi affitta una stanza può pubblicare annunci")
	errNotFound          = apperr.NotFound("listing_not_found", "Annuncio non trovato")
	errNotOwner          = apperr.Forbidden("listing_not_owned", "Puoi modificare solo i tuoi annunci")
	errImageNotFound     = apperr.NotFound("image_not_found", "Foto non trovata")
	errStorageDisabled   = apperr.New(http.StatusServiceUnavailable, "uploads_unavailable", "Il caricamento delle foto non è disponibile al momento")
	errMissingActive     = apperr.BadRequest("invalid_active", "Indica se l'annuncio deve essere attivo")
)

type Service struct {
	store   *Store
	storage storage.Storage
	now     func() time.Time
}

func NewService(store *Store, st storage.Storage) *Service {
	return &Service{store: store, storage: st, now: time.Now}
}

// Input sono i dati del modulo di creazione e modifica di un annuncio.
type Input struct {
	Title         string   `json:"title"`
	City          string   `json:"city"`
	Zone          string   `json:"zone"`
	RoomType      string   `json:"roomType"`
	Price         int      `json:"price"`
	Description   string   `json:"description"`
	Amenities     []string `json:"amenities"`
	BillsIncluded *bool    `json:"billsIncluded"`
	// AvailableFrom è una data AAAA-MM-GG, oppure vuota se non indicata.
	AvailableFrom string `json:"availableFrom"`
}

// parseInput valida l'input e lo converte nei dati da salvare.
func (s *Service) parseInput(in Input) (Data, error) {
	d := Data{
		Title:       validate.Text(in.Title),
		City:        validate.Text(in.City),
		Zone:        validate.Text(in.Zone),
		RoomType:    in.RoomType,
		Price:       in.Price,
		Description: validate.Text(in.Description),
	}

	var v validate.Validator
	// Limite uguale a quello della colonna nel database (title VARCHAR(100))
	v.Check(validate.NotBlank(d.Title) && validate.MaxLen(d.Title, 100), "title", "Il titolo è obbligatorio (massimo 100 caratteri)")
	v.Check(shared.IsCity(d.City), "city", "Scegli la città dall'elenco")
	v.Check(validate.MaxLen(d.Zone, 80), "zone", "La zona può avere al massimo 80 caratteri")
	v.Check(validate.OneOf(d.RoomType, "singola", "doppia"), "roomType", "Tipo di stanza non valido")
	v.Check(validate.Between(d.Price, 1, 20000), "price", "Il prezzo deve essere compreso tra 1 e 20.000 €")
	v.Check(validate.NotBlank(d.Description) && validate.MaxLen(d.Description, 5000), "description", "La descrizione è obbligatoria (massimo 5000 caratteri)")

	amenities, ok := shared.NormalizeKeys(shared.Amenities, in.Amenities)
	v.Check(ok, "amenities", "Servizio non valido")
	d.Amenities = amenities

	v.Check(in.BillsIncluded != nil, "billsIncluded", "Indica se le spese sono incluse nel prezzo")
	if in.BillsIncluded != nil {
		d.BillsIncluded = *in.BillsIncluded
	}

	if in.AvailableFrom != "" {
		today := s.now().UTC().Truncate(24 * time.Hour)
		ok := validate.DateBetween(in.AvailableFrom, today.AddDate(-1, 0, 0), today.AddDate(2, 0, 0))
		v.Check(ok, "availableFrom", "La data di disponibilità deve essere entro i prossimi due anni")
		if ok {
			date, _ := time.Parse(time.DateOnly, in.AvailableFrom)
			d.AvailableFrom = &date
		}
	}

	return d, v.Err()
}

// Image è una foto di un annuncio.
type Image struct {
	ID  int    `json:"id"`
	URL string `json:"url"`
}

// Summary è un annuncio negli elenchi.
type Summary struct {
	ID            int     `json:"id"`
	Title         string  `json:"title"`
	City          string  `json:"city"`
	Zone          string  `json:"zone"`
	RoomType      string  `json:"roomType"`
	Price         int     `json:"price"`
	BillsIncluded *bool   `json:"billsIncluded"`
	AvailableFrom *string `json:"availableFrom"`
	IsActive      bool    `json:"isActive"`
	CoverURL      *string `json:"coverUrl"`
}

// Owner è il proprietario dell'annuncio, come lo vedono gli altri utenti.
type Owner struct {
	FirstName string `json:"firstName"`
}

// Detail è il dettaglio di un annuncio.
type Detail struct {
	Summary
	Description string   `json:"description"`
	Amenities   []string `json:"amenities"`
	Images      []Image  `json:"images"`
	Owner       Owner    `json:"owner"`
	// IsOwner indica se chi guarda è il proprietario (per mostrare "Modifica" invece di "Contatta").
	IsOwner bool `json:"isOwner"`
}

func (s *Service) summary(r Row) Summary {
	sum := Summary{
		ID:            r.ID,
		Title:         r.Title,
		City:          r.City,
		Zone:          r.Zone,
		RoomType:      r.RoomType,
		Price:         r.Price,
		BillsIncluded: r.BillsIncluded,
		IsActive:      r.IsActive,
	}
	if r.AvailableFrom != nil {
		date := r.AvailableFrom.Format(time.DateOnly)
		sum.AvailableFrom = &date
	}
	if r.CoverKey != nil {
		if url := s.storage.PublicURL(*r.CoverKey); url != "" {
			sum.CoverURL = &url
		}
	}
	return sum
}

// Latest restituisce gli annunci attivi più recenti (filtri e pagine arrivano con il modulo M1.6).
func (s *Service) Latest(ctx context.Context) ([]Summary, error) {
	rows, err := s.store.LatestActive(ctx, latestLimit)
	if err != nil {
		return nil, fmt.Errorf("elenco annunci: %w", err)
	}
	return s.summaries(rows), nil
}

// Mine restituisce tutti gli annunci dell'utente, anche quelli disattivati.
func (s *Service) Mine(ctx context.Context, userID string) ([]Summary, error) {
	rows, err := s.store.ByOwner(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("elenco annunci dell'utente: %w", err)
	}
	return s.summaries(rows), nil
}

func (s *Service) summaries(rows []Row) []Summary {
	result := make([]Summary, 0, len(rows))
	for _, r := range rows {
		result = append(result, s.summary(r))
	}
	return result
}

// Get restituisce il dettaglio di un annuncio. Un annuncio disattivato è visibile solo al proprietario.
func (s *Service) Get(ctx context.Context, viewerID, rawID string) (Detail, error) {
	id, ok := validate.PositiveID(rawID)
	if !ok {
		return Detail{}, errNotFound
	}
	r, err := s.store.Get(ctx, id)
	if db.IsNoRows(err) {
		return Detail{}, errNotFound
	}
	if err != nil {
		return Detail{}, fmt.Errorf("lettura annuncio: %w", err)
	}
	isOwner := viewerID != "" && viewerID == r.OwnerID
	if !r.IsActive && !isOwner {
		return Detail{}, errNotFound
	}

	images, err := s.store.Images(ctx, id)
	if err != nil {
		return Detail{}, fmt.Errorf("lettura foto: %w", err)
	}
	detail := Detail{
		Summary:     s.summary(r),
		Description: r.Description,
		Amenities:   r.Amenities,
		Images:      []Image{},
		Owner:       Owner{FirstName: r.OwnerFirstName},
		IsOwner:     isOwner,
	}
	if detail.Amenities == nil {
		detail.Amenities = []string{}
	}
	for _, img := range images {
		if url := s.storage.PublicURL(img.Key); url != "" {
			detail.Images = append(detail.Images, Image{ID: img.ID, URL: url})
		}
	}
	return detail, nil
}

// Create pubblica un annuncio e ne restituisce il dettaglio.
func (s *Service) Create(ctx context.Context, userID string, in Input) (Detail, error) {
	userType, err := s.store.UserType(ctx, userID)
	if db.IsNoRows(err) || db.IsInvalidInput(err) {
		return Detail{}, errSessionInvalid
	}
	if err != nil {
		return Detail{}, fmt.Errorf("lettura tipo di utente: %w", err)
	}
	if userType != landlordUserType {
		return Detail{}, errNotLandlordCreate
	}

	data, err := s.parseInput(in)
	if err != nil {
		return Detail{}, err
	}
	id, err := s.store.Create(ctx, userID, data)
	if err != nil {
		return Detail{}, apperr.Wrap(err, "listing_create_failed", "Impossibile pubblicare l'annuncio. Controlla i dati e riprova.")
	}
	return s.Get(ctx, userID, strconv.Itoa(id))
}

// requireOwner verifica che l'annuncio esista e sia dell'utente. Gestire i propri annunci
// (modificarli, disattivarli, eliminarli) non richiede il ruolo "affitta": chi cambia ruolo
// deve poter comunque ritirare gli annunci pubblicati.
func (s *Service) requireOwner(ctx context.Context, userID, rawID string) (int, error) {
	id, ok := validate.PositiveID(rawID)
	if !ok {
		return 0, errNotFound
	}
	ownerID, err := s.store.Owner(ctx, id)
	if db.IsNoRows(err) {
		return 0, errNotFound
	}
	if err != nil {
		return 0, fmt.Errorf("lettura proprietario: %w", err)
	}
	if ownerID != userID {
		return 0, errNotOwner
	}
	return id, nil
}

// Update modifica un annuncio e ne restituisce il dettaglio aggiornato.
func (s *Service) Update(ctx context.Context, userID, rawID string, in Input) (Detail, error) {
	id, err := s.requireOwner(ctx, userID, rawID)
	if err != nil {
		return Detail{}, err
	}
	data, err := s.parseInput(in)
	if err != nil {
		return Detail{}, err
	}
	if err := s.store.Update(ctx, id, data); err != nil {
		return Detail{}, apperr.Wrap(err, "listing_update_failed", "Impossibile salvare l'annuncio. Controlla i dati e riprova.")
	}
	return s.Get(ctx, userID, rawID)
}

// SetActive pubblica o ritira un annuncio senza eliminarlo.
func (s *Service) SetActive(ctx context.Context, userID, rawID string, active bool) error {
	id, err := s.requireOwner(ctx, userID, rawID)
	if err != nil {
		return err
	}
	if err := s.store.SetActive(ctx, id, active); err != nil {
		return apperr.Wrap(err, "listing_update_failed", "Impossibile aggiornare l'annuncio")
	}
	return nil
}

// Delete elimina un annuncio e le sue foto. Le conversazioni collegate restano ai partecipanti.
func (s *Service) Delete(ctx context.Context, userID, rawID string) error {
	id, err := s.requireOwner(ctx, userID, rawID)
	if err != nil {
		return err
	}
	keys, err := s.store.Delete(ctx, id)
	if err != nil {
		return apperr.Wrap(err, "listing_delete_failed", "Impossibile eliminare l'annuncio in questo momento")
	}
	DeleteObjects(ctx, s.storage, keys)
	return nil
}

// DeleteObjects cancella dallo storage le foto di annunci già eliminati dal database.
// Un errore lascia un file orfano ma non annulla l'eliminazione: finisce solo nei log.
func DeleteObjects(ctx context.Context, st storage.Storage, keys []string) {
	for _, key := range keys {
		if err := st.Delete(ctx, key); err != nil {
			logx.From(ctx).Warn("foto non eliminata dallo storage", "key", key, "err", err)
		}
	}
}

// UploadInput chiede di caricare una foto del tipo indicato.
type UploadInput struct {
	ContentType string `json:"contentType"`
}

// PendingUpload autorizza il browser a caricare una foto direttamente sullo storage.
type PendingUpload struct {
	Key      string            `json:"key"`
	URL      string            `json:"url"`
	Headers  map[string]string `json:"headers"`
	MaxBytes int               `json:"maxBytes"`
}

// PrepareUpload firma il caricamento di una foto. Il file finisce in "pending/": diventa una foto
// dell'annuncio solo dopo ConfirmUpload (una regola di scadenza sul bucket elimina quelli abbandonati).
func (s *Service) PrepareUpload(ctx context.Context, userID, rawID string, in UploadInput) (PendingUpload, error) {
	id, err := s.requireOwner(ctx, userID, rawID)
	if err != nil {
		return PendingUpload{}, err
	}
	imageType, ok := imageTypes[in.ContentType]
	if !ok {
		return PendingUpload{}, apperr.BadRequest("invalid_image_type", "Formato non supportato: usa foto JPEG, PNG o WebP")
	}
	count, err := s.store.CountImages(ctx, id)
	if err != nil {
		return PendingUpload{}, fmt.Errorf("conteggio foto: %w", err)
	}
	if count >= MaxImages {
		return PendingUpload{}, errTooManyImagesResponse
	}

	key := fmt.Sprintf("pending/%d/%s.%s", id, randomName(), imageType.ext)
	upload, err := s.storage.PresignUpload(ctx, key, in.ContentType, uploadURLExpires)
	if errors.Is(err, storage.ErrDisabled) {
		return PendingUpload{}, errStorageDisabled
	}
	if err != nil {
		return PendingUpload{}, fmt.Errorf("firma del caricamento: %w", err)
	}
	return PendingUpload{Key: key, URL: upload.URL, Headers: upload.Headers, MaxBytes: MaxImageBytes}, nil
}

var errTooManyImagesResponse = apperr.Conflict("too_many_images", fmt.Sprintf("Puoi caricare al massimo %d foto per annuncio", MaxImages))

// pendingKey riconosce le chiavi generate da PrepareUpload: pending/<annuncio>/<32 cifre esadecimali>.<estensione>
var pendingKey = regexp.MustCompile(`^pending/(\d+)/([0-9a-f]{32})\.(jpg|png|webp)$`)

// ConfirmInput indica il file caricato da aggiungere alle foto.
type ConfirmInput struct {
	Key string `json:"key"`
}

// ConfirmUpload verifica il file caricato (esistenza, dimensione, formato reale) e lo aggiunge
// alle foto dell'annuncio. Un file non valido viene eliminato.
func (s *Service) ConfirmUpload(ctx context.Context, userID, rawID string, in ConfirmInput) (Image, error) {
	id, err := s.requireOwner(ctx, userID, rawID)
	if err != nil {
		return Image{}, err
	}
	match := pendingKey.FindStringSubmatch(in.Key)
	if match == nil || match[1] != strconv.Itoa(id) {
		return Image{}, apperr.BadRequest("invalid_upload", "Caricamento non valido")
	}

	info, err := s.storage.Stat(ctx, in.Key)
	switch {
	case errors.Is(err, storage.ErrDisabled):
		return Image{}, errStorageDisabled
	case errors.Is(err, storage.ErrNotFound):
		return Image{}, apperr.BadRequest("upload_not_found", "Foto non ricevuta: riprova il caricamento")
	case err != nil:
		return Image{}, fmt.Errorf("verifica del file caricato: %w", err)
	}

	reject := func(message string) (Image, error) {
		DeleteObjects(ctx, s.storage, []string{in.Key})
		return Image{}, apperr.BadRequest("invalid_image", message)
	}
	if info.Size > MaxImageBytes {
		return reject(fmt.Sprintf("La foto supera il limite di %d MB", MaxImageBytes>>20))
	}
	imageType, ok := imageTypes[info.ContentType]
	if !ok || imageType.ext != match[3] {
		return reject("Formato non supportato: usa foto JPEG, PNG o WebP")
	}
	head, err := s.storage.ReadPrefix(ctx, in.Key, 12)
	if err != nil {
		return Image{}, fmt.Errorf("lettura del file caricato: %w", err)
	}
	if !imageType.magic(head) {
		return reject("Il file non è un'immagine valida")
	}

	finalKey := fmt.Sprintf("listings/%d/%s.%s", id, match[2], match[3])
	if err := s.storage.Move(ctx, in.Key, finalKey); err != nil {
		return Image{}, fmt.Errorf("spostamento della foto: %w", err)
	}
	img, err := s.store.AddImage(ctx, id, finalKey, MaxImages)
	if err != nil {
		DeleteObjects(ctx, s.storage, []string{finalKey})
		if errors.Is(err, errTooManyImages) {
			return Image{}, errTooManyImagesResponse
		}
		return Image{}, fmt.Errorf("salvataggio della foto: %w", err)
	}
	return Image{ID: img.ID, URL: s.storage.PublicURL(finalKey)}, nil
}

// DeleteImage elimina una foto dell'annuncio.
func (s *Service) DeleteImage(ctx context.Context, userID, rawID, rawImageID string) error {
	id, err := s.requireOwner(ctx, userID, rawID)
	if err != nil {
		return err
	}
	imageID, ok := validate.PositiveID(rawImageID)
	if !ok {
		return errImageNotFound
	}
	key, err := s.store.DeleteImage(ctx, id, imageID)
	if db.IsNoRows(err) {
		return errImageNotFound
	}
	if err != nil {
		return apperr.Wrap(err, "image_delete_failed", "Impossibile eliminare la foto")
	}
	DeleteObjects(ctx, s.storage, []string{key})
	return nil
}

func randomName() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}
