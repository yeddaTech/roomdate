// Package listings gestisce gli annunci delle stanze.
package listings

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Store esegue le query sulla tabella roomdate_app.listings.
type Store struct {
	db *pgxpool.Pool
}

func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

// NewListing contiene i dati di un nuovo annuncio, già validati e ripuliti.
type NewListing struct {
	Title, City, Zone, RoomType string
	Price                       int
	Description                 string
}

func (s *Store) Create(ctx context.Context, ownerID string, l NewListing) error {
	_, err := s.db.Exec(ctx, `
        INSERT INTO roomdate_app.listings (user_id, title, city, zone, room_type, price, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		ownerID, l.Title, l.City, l.Zone, l.RoomType, l.Price, l.Description)
	return err
}

// Row è un annuncio con i campi comuni agli elenchi e al dettaglio.
type Row struct {
	ID                          int
	Title, City, Zone, RoomType string
	Price                       int
	Description, OwnerFirstName string
}

// Get restituisce l'annuncio con il nome del proprietario.
func (s *Store) Get(ctx context.Context, id int) (Row, error) {
	var r Row
	err := s.db.QueryRow(ctx, `
        SELECT l.id, COALESCE(l.title, ''), COALESCE(l.city, ''), COALESCE(l.zone, ''), COALESCE(l.room_type, ''),
               COALESCE(l.price, 0), COALESCE(l.description, ''), COALESCE(u.first_name, '')
        FROM roomdate_app.listings l
        LEFT JOIN roomdate_app.users u ON l.user_id = u.id
        WHERE l.id = $1`, id,
	).Scan(&r.ID, &r.Title, &r.City, &r.Zone, &r.RoomType, &r.Price, &r.Description, &r.OwnerFirstName)
	return r, err
}

// Latest restituisce gli annunci più recenti.
func (s *Store) Latest(ctx context.Context, limit int) ([]Row, error) {
	return s.list(ctx, `
        SELECT id, COALESCE(title, ''), COALESCE(city, ''), COALESCE(zone, ''), COALESCE(room_type, ''), COALESCE(price, 0)
        FROM roomdate_app.listings
        ORDER BY created_at DESC
        LIMIT $1`, limit)
}

// ByOwner restituisce gli annunci di un utente, dal più recente.
func (s *Store) ByOwner(ctx context.Context, ownerID string) ([]Row, error) {
	return s.list(ctx, `
        SELECT id, COALESCE(title, ''), COALESCE(city, ''), COALESCE(zone, ''), COALESCE(room_type, ''), COALESCE(price, 0)
        FROM roomdate_app.listings
        WHERE user_id = $1
        ORDER BY created_at DESC`, ownerID)
}

func (s *Store) list(ctx context.Context, query string, args ...any) ([]Row, error) {
	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []Row
	for rows.Next() {
		var r Row
		if err := rows.Scan(&r.ID, &r.Title, &r.City, &r.Zone, &r.RoomType, &r.Price); err != nil {
			return nil, err
		}
		result = append(result, r)
	}
	return result, rows.Err()
}

// DeleteOwned elimina l'annuncio solo se appartiene all'utente; restituisce false se non l'ha trovato.
func (s *Store) DeleteOwned(ctx context.Context, id int, ownerID string) (bool, error) {
	tag, err := s.db.Exec(ctx, `DELETE FROM roomdate_app.listings WHERE id = $1 AND user_id = $2`, id, ownerID)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}
