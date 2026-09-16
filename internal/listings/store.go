// Package listings gestisce gli annunci delle stanze e le loro foto.
package listings

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// errTooManyImages indica che l'annuncio ha già il numero massimo di foto.
var errTooManyImages = errors.New("troppe foto")

// Store esegue le query su annunci e foto.
type Store struct {
	db *pgxpool.Pool
}

func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

// UserType restituisce il tipo di utente ("cerca" o "affitta") letto dal database.
func (s *Store) UserType(ctx context.Context, userID string) (string, error) {
	var userType string
	err := s.db.QueryRow(ctx, `SELECT COALESCE(user_type, '') FROM roomdate_app.users WHERE id = $1`, userID).Scan(&userType)
	return userType, err
}

// Data sono i campi modificabili di un annuncio, già validati e normalizzati.
type Data struct {
	Title, City, Zone, RoomType string
	Price                       int
	Description                 string
	Amenities                   []string
	BillsIncluded               bool
	AvailableFrom               *time.Time
}

func (s *Store) Create(ctx context.Context, ownerID string, d Data) (int, error) {
	var id int
	err := s.db.QueryRow(ctx, `
        INSERT INTO roomdate_app.listings
            (user_id, title, city, zone, room_type, price, description, amenities, bills_included, available_from)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id`,
		ownerID, d.Title, d.City, d.Zone, d.RoomType, d.Price, d.Description, d.Amenities, d.BillsIncluded, d.AvailableFrom,
	).Scan(&id)
	return id, err
}

func (s *Store) Update(ctx context.Context, id int, d Data) error {
	_, err := s.db.Exec(ctx, `
        UPDATE roomdate_app.listings
        SET title = $2, city = $3, zone = $4, room_type = $5, price = $6, description = $7,
            amenities = $8, bills_included = $9, available_from = $10, updated_at = NOW()
        WHERE id = $1`,
		id, d.Title, d.City, d.Zone, d.RoomType, d.Price, d.Description, d.Amenities, d.BillsIncluded, d.AvailableFrom)
	return err
}

func (s *Store) SetActive(ctx context.Context, id int, active bool) error {
	_, err := s.db.Exec(ctx, `UPDATE roomdate_app.listings SET is_active = $2, updated_at = NOW() WHERE id = $1`, id, active)
	return err
}

// Owner restituisce l'ID del proprietario dell'annuncio.
func (s *Store) Owner(ctx context.Context, id int) (string, error) {
	var ownerID string
	err := s.db.QueryRow(ctx, `SELECT user_id::text FROM roomdate_app.listings WHERE id = $1`, id).Scan(&ownerID)
	return ownerID, err
}

// Row è un annuncio con tutti i campi.
type Row struct {
	ID                          int
	OwnerID, OwnerFirstName     string
	Title, City, Zone, RoomType string
	Price                       int
	Description                 string
	Amenities                   []string
	BillsIncluded               *bool
	AvailableFrom               *time.Time
	IsActive                    bool
	// CoverKey è la chiave della prima foto, se c'è (negli elenchi).
	CoverKey *string
}

const rowColumns = `l.id, l.user_id::text, COALESCE(u.first_name, ''),
    l.title, l.city, COALESCE(l.zone, ''), l.room_type, l.price, COALESCE(l.description, ''),
    l.amenities, l.bills_included, l.available_from, l.is_active,
    (SELECT i.storage_key FROM roomdate_app.listing_images i WHERE i.listing_id = l.id ORDER BY i.position, i.id LIMIT 1)`

func scanRow(row pgx.Row) (Row, error) {
	var r Row
	err := row.Scan(&r.ID, &r.OwnerID, &r.OwnerFirstName, &r.Title, &r.City, &r.Zone, &r.RoomType, &r.Price, &r.Description,
		&r.Amenities, &r.BillsIncluded, &r.AvailableFrom, &r.IsActive, &r.CoverKey)
	return r, err
}

func (s *Store) Get(ctx context.Context, id int) (Row, error) {
	return scanRow(s.db.QueryRow(ctx, `
        SELECT `+rowColumns+`
        FROM roomdate_app.listings l
        LEFT JOIN roomdate_app.users u ON l.user_id = u.id
        WHERE l.id = $1`, id))
}

// LatestActive restituisce gli annunci attivi più recenti.
func (s *Store) LatestActive(ctx context.Context, limit int) ([]Row, error) {
	return s.list(ctx, `
        SELECT `+rowColumns+`
        FROM roomdate_app.listings l
        LEFT JOIN roomdate_app.users u ON l.user_id = u.id
        WHERE l.is_active
        ORDER BY l.created_at DESC
        LIMIT $1`, limit)
}

// ByOwner restituisce tutti gli annunci di un utente, anche quelli disattivati, dal più recente.
func (s *Store) ByOwner(ctx context.Context, ownerID string) ([]Row, error) {
	return s.list(ctx, `
        SELECT `+rowColumns+`
        FROM roomdate_app.listings l
        LEFT JOIN roomdate_app.users u ON l.user_id = u.id
        WHERE l.user_id = $1
        ORDER BY l.created_at DESC`, ownerID)
}

func (s *Store) list(ctx context.Context, query string, args ...any) ([]Row, error) {
	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []Row
	for rows.Next() {
		r, err := scanRow(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, r)
	}
	return result, rows.Err()
}

// Delete elimina l'annuncio (le foto nel database vanno via a cascata) e restituisce le chiavi
// delle foto, da cancellare anche dallo storage.
func (s *Store) Delete(ctx context.Context, id int) ([]string, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	keys, err := imageKeys(ctx, tx, `SELECT storage_key FROM roomdate_app.listing_images WHERE listing_id = $1`, id)
	if err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM roomdate_app.listings WHERE id = $1`, id); err != nil {
		return nil, err
	}
	return keys, tx.Commit(ctx)
}

// ImageRow è una foto di un annuncio.
type ImageRow struct {
	ID  int
	Key string
}

func (s *Store) Images(ctx context.Context, listingID int) ([]ImageRow, error) {
	rows, err := s.db.Query(ctx, `
        SELECT id, storage_key FROM roomdate_app.listing_images
        WHERE listing_id = $1
        ORDER BY position, id`, listingID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	images := []ImageRow{}
	for rows.Next() {
		var img ImageRow
		if err := rows.Scan(&img.ID, &img.Key); err != nil {
			return nil, err
		}
		images = append(images, img)
	}
	return images, rows.Err()
}

func (s *Store) CountImages(ctx context.Context, listingID int) (int, error) {
	var n int
	err := s.db.QueryRow(ctx, `SELECT count(*) FROM roomdate_app.listing_images WHERE listing_id = $1`, listingID).Scan(&n)
	return n, err
}

// AddImage aggiunge una foto in coda. Blocca la riga dell'annuncio, così due caricamenti
// contemporanei non superano il limite; restituisce errTooManyImages se l'annuncio è pieno.
func (s *Store) AddImage(ctx context.Context, listingID int, key string, max int) (ImageRow, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return ImageRow{}, err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `SELECT 1 FROM roomdate_app.listings WHERE id = $1 FOR UPDATE`, listingID); err != nil {
		return ImageRow{}, err
	}
	var count, lastPosition int
	err = tx.QueryRow(ctx, `
        SELECT count(*), COALESCE(MAX(position), 0)
        FROM roomdate_app.listing_images WHERE listing_id = $1`, listingID).Scan(&count, &lastPosition)
	if err != nil {
		return ImageRow{}, err
	}
	if count >= max {
		return ImageRow{}, errTooManyImages
	}

	img := ImageRow{Key: key}
	err = tx.QueryRow(ctx, `
        INSERT INTO roomdate_app.listing_images (listing_id, storage_key, position)
        VALUES ($1, $2, $3) RETURNING id`, listingID, key, lastPosition+1).Scan(&img.ID)
	if err != nil {
		return ImageRow{}, err
	}
	return img, tx.Commit(ctx)
}

// DeleteImage elimina la foto dell'annuncio e ne restituisce la chiave; pgx.ErrNoRows se non esiste.
func (s *Store) DeleteImage(ctx context.Context, listingID, imageID int) (string, error) {
	var key string
	err := s.db.QueryRow(ctx, `
        DELETE FROM roomdate_app.listing_images
        WHERE id = $1 AND listing_id = $2
        RETURNING storage_key`, imageID, listingID).Scan(&key)
	return key, err
}

// imageKeys legge un elenco di chiavi di foto.
func imageKeys(ctx context.Context, q interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
}, query string, args ...any) ([]string, error) {
	rows, err := q.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowTo[string])
}
