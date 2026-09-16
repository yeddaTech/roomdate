package listings

import (
	"context"
	"fmt"

	"roomdate-backend/internal/apperr"
	"roomdate-backend/internal/auth"
	"roomdate-backend/internal/db"
	"roomdate-backend/internal/validate"
)

const latestLimit = 50

// Solo chi affitta può pubblicare ed eliminare annunci.
// Il ruolo viene letto dal cookie di sessione: diventa un dato letto dal database nel modulo M1.2.
const landlordUserType = "affitta"

var (
	errNotLandlordCreate = apperr.Forbidden("landlord_only", "Accesso negato: Solo i proprietari possono creare annunci")
	errNotLandlordDelete = apperr.Forbidden("landlord_only", "Accesso negato: Solo i proprietari possono eliminare annunci")
	errInvalidID         = apperr.BadRequest("invalid_listing_id", "ID annuncio non valido")
)

type Service struct {
	store *Store
}

func NewService(store *Store) *Service {
	return &Service{store: store}
}

// CreateInput sono i dati inviati dal modulo "Pubblica annuncio".
type CreateInput struct {
	Title       string `json:"title"`
	City        string `json:"city"`
	Zone        string `json:"zone"`
	RoomType    string `json:"roomType"`
	Price       int    `json:"price"`
	Description string `json:"description"`
}

func (s *Service) Create(ctx context.Context, session auth.Session, in CreateInput) error {
	if session.UserType != landlordUserType {
		return errNotLandlordCreate
	}

	l := NewListing{
		Title:       validate.CleanText(in.Title),
		City:        validate.CleanText(in.City),
		Zone:        validate.CleanText(in.Zone),
		RoomType:    in.RoomType,
		Price:       in.Price,
		Description: validate.CleanText(in.Description),
	}

	var v validate.Validator
	v.Check(validate.NotBlank(l.Title) && validate.MaxLen(l.Title, 120), "title", "Il titolo è obbligatorio (massimo 120 caratteri)")
	v.Check(validate.NotBlank(l.City) && validate.MaxLen(l.City, 80), "city", "La città è obbligatoria (massimo 80 caratteri)")
	v.Check(validate.MaxLen(l.Zone, 80), "zone", "La zona può avere al massimo 80 caratteri")
	v.Check(validate.OneOf(l.RoomType, "singola", "doppia"), "roomType", "Tipo di stanza non valido")
	v.Check(validate.Between(l.Price, 1, 20000), "price", "Il prezzo deve essere compreso tra 1 e 20.000 €")
	v.Check(validate.NotBlank(l.Description) && validate.MaxLen(l.Description, 5000), "description", "La descrizione è obbligatoria (massimo 5000 caratteri)")
	if err := v.Err(); err != nil {
		return err
	}

	if err := s.store.Create(ctx, session.UserID, l); err != nil {
		return apperr.Wrap(err, "listing_create_failed", "Impossibile pubblicare l'annuncio. Controlla i dati e riprova.")
	}
	return nil
}

// Listing è un annuncio negli elenchi (formato JSON delle API legacy).
type Listing struct {
	ID    int      `json:"id"`
	Title string   `json:"title"`
	City  string   `json:"city"`
	Zone  string   `json:"zone"`
	Price int      `json:"price"`
	Color string   `json:"color"`
	Emoji string   `json:"emoji"`
	Avail bool     `json:"avail"`
	Tags  []string `json:"tags"`
}

// Latest restituisce gli annunci più recenti.
// Colori, emoji, disponibilità e il tag "Verificato" sono ancora decorativi: spariscono nel modulo M1.4.
func (s *Service) Latest(ctx context.Context) ([]Listing, error) {
	rows, err := s.store.Latest(ctx, latestLimit)
	if err != nil {
		return nil, fmt.Errorf("elenco annunci: %w", err)
	}

	colors := []string{"#F5E3CC", "#D4835E", "#C4603A", "#EAF3DE", "#FBF3E8"}
	emojis := []string{"🛏️", "🛋️", "🪴", "☀️", "🖼️"}

	listings := make([]Listing, 0, len(rows))
	for i, r := range rows {
		listings = append(listings, Listing{
			ID:    r.ID,
			Title: r.Title,
			City:  r.City,
			Zone:  r.Zone,
			Price: r.Price,
			Color: colors[i%len(colors)],
			Emoji: emojis[i%len(emojis)],
			Avail: true,
			Tags:  []string{r.RoomType, "Verificato"},
		})
	}
	return listings, nil
}

type Landlord struct {
	Name  string `json:"name"`
	Role  string `json:"role"`
	Emoji string `json:"emoji"`
}

// Detail è il dettaglio di un annuncio (formato JSON delle API legacy).
type Detail struct {
	ID          int      `json:"id"`
	Title       string   `json:"title"`
	City        string   `json:"city"`
	Zone        string   `json:"zone"`
	Price       int      `json:"price"`
	Type        string   `json:"type"`
	Description string   `json:"description"`
	Features    []string `json:"features"`
	Images      []string `json:"images"`
	Landlord    Landlord `json:"landlord"`
}

// Get restituisce il dettaglio di un annuncio.
// Servizi e foto sono ancora dimostrativi: diventano dati reali nel modulo M1.4.
func (s *Service) Get(ctx context.Context, rawID string) (Detail, error) {
	if rawID == "" {
		return Detail{}, apperr.BadRequest("missing_listing_id", "ID mancante")
	}
	id, ok := validate.PositiveID(rawID)
	if !ok {
		return Detail{}, errInvalidID
	}

	r, err := s.store.Get(ctx, id)
	if db.IsNoRows(err) {
		return Detail{}, apperr.NotFound("listing_not_found", "Annuncio non trovato nel Database")
	}
	if err != nil {
		return Detail{}, fmt.Errorf("lettura annuncio: %w", err)
	}

	name := r.OwnerFirstName
	if name == "" {
		name = "Proprietario"
	}
	return Detail{
		ID:          r.ID,
		Title:       r.Title,
		City:        r.City,
		Zone:        r.Zone,
		Price:       r.Price,
		Type:        r.RoomType,
		Description: r.Description,
		Features:    []string{"Wi-Fi", "Lavatrice", "Arredata", "Luminosa"},
		Images: []string{
			"https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80",
			"https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80",
			"https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80",
		},
		Landlord: Landlord{Name: name, Role: "Proprietario/a", Emoji: "👋"},
	}, nil
}

// MyListing è un annuncio nell'elenco "I miei annunci" (formato JSON delle API legacy).
type MyListing struct {
	ID       int    `json:"id"`
	Title    string `json:"title"`
	City     string `json:"city"`
	Price    int    `json:"price"`
	RoomType string `json:"roomType"`
}

func (s *Service) Mine(ctx context.Context, userID string) ([]MyListing, error) {
	rows, err := s.store.ByOwner(ctx, userID)
	if err != nil {
		return nil, apperr.Wrap(err, "listings_read_failed", "Errore recupero annunci")
	}
	listings := make([]MyListing, 0, len(rows))
	for _, r := range rows {
		listings = append(listings, MyListing{ID: r.ID, Title: r.Title, City: r.City, Price: r.Price, RoomType: r.RoomType})
	}
	return listings, nil
}

func (s *Service) Delete(ctx context.Context, session auth.Session, rawID string) error {
	if session.UserType != landlordUserType {
		return errNotLandlordDelete
	}
	if rawID == "" {
		return apperr.BadRequest("missing_listing_id", "ID annuncio mancante")
	}
	id, ok := validate.PositiveID(rawID)
	if !ok {
		return errInvalidID
	}

	deleted, err := s.store.DeleteOwned(ctx, id, session.UserID)
	if err != nil {
		return apperr.Wrap(err, "listing_delete_failed", "Impossibile eliminare l'annuncio in questo momento")
	}
	if !deleted {
		return apperr.Forbidden("listing_not_owned", "Annuncio non trovato o non autorizzato all'eliminazione")
	}
	return nil
}
