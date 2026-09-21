package users

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"

	"roomdate-backend/internal/httpx"
)

// Esportazione dei dati personali (GDPR, diritto di accesso e portabilità; modulo M3.3).
// Il server restituisce tutto ciò che conserva sull'utente tranne i messaggi: quelli li scarica
// il browser dalle API della chat e li decifra con la chiave privata, che il server non ha.

// Export è il contenuto del file che l'utente scarica.
type Export struct {
	ExportedAt    time.Time             `json:"exportedAt"`
	Account       ExportAccount         `json:"account"`
	Listings      []ExportListing       `json:"listings"`
	Conversations []ExportConversation  `json:"conversations"`
	Sessions      []ExportSession       `json:"sessions"`
	Security      []ExportEvent         `json:"securityEvents"`
	Blocks        []ExportBlock         `json:"blocks"`
	Reports       []ExportReport        `json:"reports"`
	ReportsAbout  []ExportReportAboutMe `json:"reportsAboutMe"`
}

type ExportAccount struct {
	Profile
	CreatedAt *time.Time `json:"createdAt"`
	PublicKey string     `json:"publicKey"`
}

type ExportListing struct {
	ID            int        `json:"id"`
	Title         string     `json:"title"`
	City          string     `json:"city"`
	Zone          string     `json:"zone"`
	RoomType      string     `json:"roomType"`
	Price         int        `json:"price"`
	Description   string     `json:"description"`
	Amenities     []string   `json:"amenities"`
	BillsIncluded *bool      `json:"billsIncluded"`
	AvailableFrom *string    `json:"availableFrom"`
	IsActive      bool       `json:"isActive"`
	Removed       bool       `json:"removedByModeration"`
	CreatedAt     *time.Time `json:"createdAt"`
	Photos        []string   `json:"photos"`
}

// ExportConversation descrive una conversazione; i messaggi li aggiunge il browser.
type ExportConversation struct {
	ID           int        `json:"id"`
	CreatedAt    *time.Time `json:"createdAt"`
	ListingTitle string     `json:"listingTitle"`
	// Other è il nome dell'altro partecipante, vuoto se ha eliminato l'account.
	Other string `json:"other"`
}

type ExportSession struct {
	Device     string    `json:"device"`
	CreatedAt  time.Time `json:"createdAt"`
	LastUsedAt time.Time `json:"lastUsedAt"`
	ExpiresAt  time.Time `json:"expiresAt"`
}

type ExportEvent struct {
	Kind      string    `json:"kind"`
	CreatedAt time.Time `json:"createdAt"`
}

type ExportBlock struct {
	UserID    string    `json:"userId"`
	FirstName string    `json:"firstName"`
	CreatedAt time.Time `json:"createdAt"`
}

// ExportReport è una segnalazione inviata dall'utente, con i messaggi che vi ha allegato.
type ExportReport struct {
	ID        int64      `json:"id"`
	UserID    string     `json:"reportedUserId"`
	ListingID *int       `json:"listingId"`
	Reason    string     `json:"reason"`
	Details   string     `json:"details"`
	Evidence  []byte     `json:"-"`
	Status    string     `json:"status"`
	CreatedAt time.Time  `json:"createdAt"`
	Resolved  *time.Time `json:"resolvedAt"`
}

// ExportReportAboutMe è una segnalazione ricevuta: senza chi l'ha fatta né il suo testo, per
// tutelare chi segnala (GDPR, art. 15 par. 4).
type ExportReportAboutMe struct {
	Reason    string     `json:"reason"`
	Status    string     `json:"status"`
	CreatedAt time.Time  `json:"createdAt"`
	Resolved  *time.Time `json:"resolvedAt"`
}

// Export raccoglie i dati dell'utente in un'unica transazione di sola lettura, così il file
// descrive un unico momento.
func (s *Store) Export(ctx context.Context, userID string, photoURL func(string) string) (Export, error) {
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{AccessMode: pgx.ReadOnly, IsoLevel: pgx.RepeatableRead})
	if err != nil {
		return Export{}, err
	}
	defer tx.Rollback(ctx)

	var e Export
	a := &e.Account
	err = tx.QueryRow(ctx, `
        SELECT id::text, COALESCE(first_name, ''), COALESCE(last_name, ''), email,
               COALESCE(user_type, ''), COALESCE(citta, ''), COALESCE(birthdate::text, ''),
               COALESCE(budget_max, 0), COALESCE(occupation, ''), COALESCE(bio, ''), lifestyle_tags,
               COALESCE(is_public, true), recovery_hash IS NOT NULL, created_at, COALESCE(public_key, '')
        FROM roomdate_app.users WHERE id = $1`, userID,
	).Scan(&a.ID, &a.FirstName, &a.LastName, &a.Email, &a.UserType, &a.City, &a.Birthdate,
		&a.BudgetMax, &a.Occupation, &a.Bio, &a.LifestyleTags, &a.IsPublic, &a.HasRecoveryKey, &a.CreatedAt, &a.PublicKey)
	if err != nil {
		return Export{}, err
	}

	rows, err := tx.Query(ctx, `
        SELECT l.id, l.title, l.city, COALESCE(l.zone, ''), COALESCE(l.room_type, ''), l.price, COALESCE(l.description, ''),
               l.amenities, l.bills_included, l.available_from::text, l.is_active, l.removed_at IS NOT NULL,
               l.created_at AT TIME ZONE 'UTC',
               COALESCE((SELECT array_agg(i.storage_key ORDER BY i.position, i.id)
                         FROM roomdate_app.listing_images i WHERE i.listing_id = l.id), '{}')
        FROM roomdate_app.listings l WHERE l.user_id = $1 ORDER BY l.id`, userID)
	if err != nil {
		return Export{}, err
	}
	e.Listings, err = pgx.CollectRows(rows, func(row pgx.CollectableRow) (ExportListing, error) {
		var l ExportListing
		var keys []string
		err := row.Scan(&l.ID, &l.Title, &l.City, &l.Zone, &l.RoomType, &l.Price, &l.Description,
			&l.Amenities, &l.BillsIncluded, &l.AvailableFrom, &l.IsActive, &l.Removed, &l.CreatedAt, &keys)
		l.Photos = []string{}
		for _, k := range keys {
			if url := photoURL(k); url != "" {
				l.Photos = append(l.Photos, url)
			}
		}
		if l.Amenities == nil {
			l.Amenities = []string{}
		}
		return l, err
	})
	if err != nil {
		return Export{}, fmt.Errorf("annunci: %w", err)
	}

	rows, err = tx.Query(ctx, `
        SELECT c.id, c.created_at, COALESCE(l.title, ''),
               COALESCE((SELECT u.first_name FROM roomdate_app.conversation_participants p
                         JOIN roomdate_app.users u ON u.id = p.user_id
                         WHERE p.conversation_id = c.id AND p.user_id <> $1 LIMIT 1), '')
        FROM roomdate_app.conversation_participants me
        JOIN roomdate_app.conversations c ON c.id = me.conversation_id
        LEFT JOIN roomdate_app.listings l ON l.id = c.listing_id
        WHERE me.user_id = $1 ORDER BY c.id`, userID)
	if err != nil {
		return Export{}, err
	}
	if e.Conversations, err = pgx.CollectRows(rows, pgx.RowToStructByPos[ExportConversation]); err != nil {
		return Export{}, fmt.Errorf("conversazioni: %w", err)
	}

	rows, err = tx.Query(ctx, `
        SELECT COALESCE(user_agent, ''), created_at, last_used_at, expires_at
        FROM roomdate_app.sessions WHERE user_id = $1 ORDER BY created_at`, userID)
	if err != nil {
		return Export{}, err
	}
	if e.Sessions, err = pgx.CollectRows(rows, pgx.RowToStructByPos[ExportSession]); err != nil {
		return Export{}, fmt.Errorf("sessioni: %w", err)
	}

	rows, err = tx.Query(ctx, `
        SELECT kind, created_at FROM roomdate_app.security_events WHERE user_id = $1 ORDER BY created_at`, userID)
	if err != nil {
		return Export{}, err
	}
	if e.Security, err = pgx.CollectRows(rows, pgx.RowToStructByPos[ExportEvent]); err != nil {
		return Export{}, fmt.Errorf("registro di sicurezza: %w", err)
	}

	rows, err = tx.Query(ctx, `
        SELECT b.blocked_id::text, COALESCE(u.first_name, ''), b.created_at
        FROM roomdate_app.user_blocks b JOIN roomdate_app.users u ON u.id = b.blocked_id
        WHERE b.blocker_id = $1 ORDER BY b.created_at`, userID)
	if err != nil {
		return Export{}, err
	}
	if e.Blocks, err = pgx.CollectRows(rows, pgx.RowToStructByPos[ExportBlock]); err != nil {
		return Export{}, fmt.Errorf("blocchi: %w", err)
	}

	rows, err = tx.Query(ctx, `
        SELECT id, target_user_id::text, listing_id, reason, details, evidence, status, created_at, resolved_at
        FROM roomdate_app.reports WHERE reporter_id = $1 ORDER BY id`, userID)
	if err != nil {
		return Export{}, err
	}
	if e.Reports, err = pgx.CollectRows(rows, pgx.RowToStructByPos[ExportReport]); err != nil {
		return Export{}, fmt.Errorf("segnalazioni inviate: %w", err)
	}

	rows, err = tx.Query(ctx, `
        SELECT reason, status, created_at, resolved_at FROM roomdate_app.reports
        WHERE target_user_id = $1 ORDER BY id`, userID)
	if err != nil {
		return Export{}, err
	}
	if e.ReportsAbout, err = pgx.CollectRows(rows, pgx.RowToStructByPos[ExportReportAboutMe]); err != nil {
		return Export{}, fmt.Errorf("segnalazioni ricevute: %w", err)
	}
	return e, nil
}

// Export restituisce i dati dell'utente da scaricare.
func (s *Service) Export(ctx context.Context, userID string) (ExportResponse, error) {
	e, err := s.store.Export(ctx, userID, s.photoURL)
	if err != nil {
		return ExportResponse{}, fmt.Errorf("esportazione dati: %w", err)
	}
	e.ExportedAt = s.now().UTC()
	return newExportResponse(e), nil
}

// ExportResponse aggiunge ai dati le spiegazioni per chi apre il file, e i messaggi allegati alle
// segnalazioni in forma leggibile.
type ExportResponse struct {
	Export
	About   string               `json:"about"`
	Reports []exportReportOutput `json:"reports"`
}

type exportReportOutput struct {
	ExportReport
	Evidence rawJSON `json:"evidence"`
}

// rawJSON inserisce così com'è un valore JSON già salvato nel database (null se manca).
type rawJSON []byte

func (r rawJSON) MarshalJSON() ([]byte, error) {
	if len(r) == 0 {
		return []byte("null"), nil
	}
	return r, nil
}

func newExportResponse(e Export) ExportResponse {
	out := ExportResponse{
		Export: e,
		About: "Dati che RoomDate conserva sul tuo account. I messaggi della chat li ha aggiunti il tuo browser, " +
			"decifrandoli con la tua chiave: sul server sono salvati solo in forma cifrata.",
		Reports: []exportReportOutput{},
	}
	for _, r := range e.Reports {
		out.Reports = append(out.Reports, exportReportOutput{ExportReport: r, Evidence: rawJSON(r.Evidence)})
	}
	if out.Listings == nil {
		out.Listings = []ExportListing{}
	}
	if out.Conversations == nil {
		out.Conversations = []ExportConversation{}
	}
	if out.Sessions == nil {
		out.Sessions = []ExportSession{}
	}
	if out.Security == nil {
		out.Security = []ExportEvent{}
	}
	if out.Blocks == nil {
		out.Blocks = []ExportBlock{}
	}
	if out.ReportsAbout == nil {
		out.ReportsAbout = []ExportReportAboutMe{}
	}
	return out
}

// ExportMe gestisce GET /api/v1/me/export.
func (h *Handler) ExportMe(w http.ResponseWriter, r *http.Request) {
	session, ok := h.requireSession(w, r)
	if !ok {
		return
	}
	export, err := h.svc.Export(r.Context(), session.UserID)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, export)
}
