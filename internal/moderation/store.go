// Package moderation gestisce blocchi tra utenti, segnalazioni e le azioni degli amministratori
// (modulo M3.3): i Termini prevedono sospensioni e rimozioni, che da qui si possono applicare.
package moderation

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"roomdate-backend/internal/db"
)

type Store struct {
	db *pgxpool.Pool
}

func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

// NotBlockedSQL è una condizione SQL vera se tra viewer (espressione di testo: l'ID di chi guarda,
// o la stringa vuota senza sessione) e other (espressione uuid) non c'è un blocco, in nessuna delle due direzioni.
// Un blocco nasconde i due utenti l'uno all'altro, qualunque dei due l'abbia deciso.
func NotBlockedSQL(viewer, other string) string {
	return `NOT EXISTS (SELECT 1 FROM roomdate_app.user_blocks b
        WHERE (b.blocker_id = NULLIF(` + viewer + `, '')::uuid AND b.blocked_id = ` + other + `)
           OR (b.blocked_id = NULLIF(` + viewer + `, '')::uuid AND b.blocker_id = ` + other + `))`
}

// Relation descrive i blocchi tra chi guarda e un altro utente.
type Relation struct {
	BlockedByMe, BlockedByThem bool
}

// Blocked indica un blocco in almeno una direzione.
func (r Relation) Blocked() bool {
	return r.BlockedByMe || r.BlockedByThem
}

// Relation restituisce i blocchi tra i due utenti. Senza sessione (viewerID vuoto) non ce ne sono.
func (s *Store) Relation(ctx context.Context, viewerID, otherID string) (Relation, error) {
	if viewerID == "" || otherID == "" || viewerID == otherID {
		return Relation{}, nil
	}
	var r Relation
	err := s.db.QueryRow(ctx, `
        SELECT EXISTS (SELECT 1 FROM roomdate_app.user_blocks WHERE blocker_id = $1 AND blocked_id = $2),
               EXISTS (SELECT 1 FROM roomdate_app.user_blocks WHERE blocker_id = $2 AND blocked_id = $1)`,
		viewerID, otherID).Scan(&r.BlockedByMe, &r.BlockedByThem)
	if db.IsInvalidInput(err) {
		return Relation{}, nil
	}
	return r, err
}

// UserID restituisce l'ID nella forma salvata nel database; pgx.ErrNoRows se l'utente non esiste.
func (s *Store) UserID(ctx context.Context, id string) (string, error) {
	var canonical string
	err := s.db.QueryRow(ctx, `SELECT id::text FROM roomdate_app.users WHERE id = $1`, id).Scan(&canonical)
	if db.IsInvalidInput(err) {
		return "", pgx.ErrNoRows
	}
	return canonical, err
}

func (s *Store) Block(ctx context.Context, blockerID, blockedID string) error {
	_, err := s.db.Exec(ctx, `
        INSERT INTO roomdate_app.user_blocks (blocker_id, blocked_id) VALUES ($1, $2)
        ON CONFLICT DO NOTHING`, blockerID, blockedID)
	return err
}

func (s *Store) Unblock(ctx context.Context, blockerID, blockedID string) error {
	_, err := s.db.Exec(ctx, `DELETE FROM roomdate_app.user_blocks WHERE blocker_id = $1 AND blocked_id = $2`, blockerID, blockedID)
	if db.IsInvalidInput(err) {
		return nil
	}
	return err
}

// BlockedUser è un utente bloccato, come lo vede chi l'ha bloccato.
type BlockedUser struct {
	UserID    string    `json:"userId"`
	FirstName string    `json:"firstName"`
	CreatedAt time.Time `json:"createdAt"`
}

func (s *Store) Blocks(ctx context.Context, blockerID string) ([]BlockedUser, error) {
	rows, err := s.db.Query(ctx, `
        SELECT b.blocked_id::text, COALESCE(u.first_name, ''), b.created_at
        FROM roomdate_app.user_blocks b JOIN roomdate_app.users u ON u.id = b.blocked_id
        WHERE b.blocker_id = $1
        ORDER BY b.created_at DESC`, blockerID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (BlockedUser, error) {
		var b BlockedUser
		err := row.Scan(&b.UserID, &b.FirstName, &b.CreatedAt)
		b.CreatedAt = b.CreatedAt.UTC()
		return b, err
	})
}

// IsAdmin indica se l'utente è un amministratore. Un amministratore sospeso non arriva fin qui:
// le sessioni degli account sospesi non valgono più.
func (s *Store) IsAdmin(ctx context.Context, userID string) (bool, error) {
	if userID == "" {
		return false, nil
	}
	var admin bool
	err := s.db.QueryRow(ctx, `SELECT is_admin FROM roomdate_app.users WHERE id = $1`, userID).Scan(&admin)
	if db.IsNoRows(err) || db.IsInvalidInput(err) {
		return false, nil
	}
	return admin, err
}

// ListingOwner restituisce il proprietario dell'annuncio (vuoto se non ne ha); pgx.ErrNoRows se non esiste.
func (s *Store) ListingOwner(ctx context.Context, listingID int) (string, error) {
	var owner string
	err := s.db.QueryRow(ctx, `SELECT COALESCE(user_id::text, '') FROM roomdate_app.listings WHERE id = $1`, listingID).Scan(&owner)
	return owner, err
}

// SharesConversation indica se i due utenti partecipano entrambi alla conversazione.
func (s *Store) SharesConversation(ctx context.Context, conversationID int, userID, otherID string) (bool, error) {
	var ok bool
	err := s.db.QueryRow(ctx, `
        SELECT count(*) = 2 FROM roomdate_app.conversation_participants
        WHERE conversation_id = $1 AND user_id IN ($2, $3)`, conversationID, userID, otherID).Scan(&ok)
	if db.IsInvalidInput(err) {
		return false, nil
	}
	return ok, err
}

// Evidence è un messaggio della chat allegato a una segnalazione, già decifrato da chi segnala.
type Evidence struct {
	Text   string    `json:"text"`
	SentAt time.Time `json:"sentAt"`
}

type NewReport struct {
	ReporterID, TargetUserID string
	ListingID                *int
	Reason, Details          string
	Evidence                 []Evidence
}

// CreateReport salva la segnalazione. Se chi segnala ne ha già una aperta sullo stesso utente o
// annuncio restituisce quella, con created false.
func (s *Store) CreateReport(ctx context.Context, r NewReport) (id int64, created bool, err error) {
	var evidence []byte
	if len(r.Evidence) > 0 {
		if evidence, err = json.Marshal(r.Evidence); err != nil {
			return 0, false, err
		}
	}
	err = s.db.QueryRow(ctx, `
        INSERT INTO roomdate_app.reports (reporter_id, target_user_id, listing_id, reason, details, evidence)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (reporter_id, target_user_id, COALESCE(listing_id, 0)) WHERE status = 'open' DO NOTHING
        RETURNING id`, r.ReporterID, r.TargetUserID, r.ListingID, r.Reason, r.Details, evidence).Scan(&id)
	if err == nil {
		return id, true, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return 0, false, err
	}
	err = s.db.QueryRow(ctx, `
        SELECT id FROM roomdate_app.reports
        WHERE reporter_id = $1 AND target_user_id = $2 AND COALESCE(listing_id, 0) = COALESCE($3, 0) AND status = 'open'`,
		r.ReporterID, r.TargetUserID, r.ListingID).Scan(&id)
	return id, false, err
}

// ReportsSince conta le segnalazioni inviate dall'utente dopo il momento indicato.
func (s *Store) ReportsSince(ctx context.Context, reporterID string, since time.Time) (int, error) {
	var n int
	err := s.db.QueryRow(ctx, `SELECT count(*) FROM roomdate_app.reports WHERE reporter_id = $1 AND created_at > $2`,
		reporterID, since).Scan(&n)
	return n, err
}

// ReportRow è una segnalazione come la vede l'amministratore.
type ReportRow struct {
	ID                              int64
	Reason, Details, Status         string
	Evidence                        []Evidence
	CreatedAt                       time.Time
	ResolvedAt                      *time.Time
	Resolution                      string
	ReporterID, ReporterName        string
	TargetID                        string
	TargetFirstName, TargetLastName string
	TargetSuspended                 bool
	TargetIsAdmin                   bool
	TargetOpenReports               int
	ListingID                       *int
	ListingTitle                    string
	ListingRemoved                  bool
}

// Reports restituisce una pagina di segnalazioni: quelle aperte dalla più vecchia (una coda da
// smaltire), quelle chiuse dalla più recente. after è l'ID dell'ultima della pagina precedente.
func (s *Store) Reports(ctx context.Context, open bool, after int64, limit int) ([]ReportRow, error) {
	order := `r.id ASC`
	keyset := `($2 = 0 OR r.id > $2)`
	if !open {
		order = `r.id DESC`
		keyset = `($2 = 0 OR r.id < $2)`
	}
	rows, err := s.db.Query(ctx, `
        SELECT r.id, r.reason, r.details, r.status, r.evidence, r.created_at, r.resolved_at, COALESCE(r.resolution, ''),
               COALESCE(r.reporter_id::text, ''), COALESCE(rep.first_name, ''),
               r.target_user_id::text, COALESCE(t.first_name, ''), COALESCE(t.last_name, ''),
               t.suspended_at IS NOT NULL, t.is_admin,
               (SELECT count(*) FROM roomdate_app.reports o WHERE o.target_user_id = r.target_user_id AND o.status = 'open'),
               r.listing_id, COALESCE(l.title, ''), COALESCE(l.removed_at IS NOT NULL, false)
        FROM roomdate_app.reports r
        JOIN roomdate_app.users t ON t.id = r.target_user_id
        LEFT JOIN roomdate_app.users rep ON rep.id = r.reporter_id
        LEFT JOIN roomdate_app.listings l ON l.id = r.listing_id
        WHERE (r.status = 'open') = $1 AND `+keyset+`
        ORDER BY `+order+`
        LIMIT $3`, open, after, limit)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (ReportRow, error) {
		var r ReportRow
		var evidence []byte
		err := row.Scan(&r.ID, &r.Reason, &r.Details, &r.Status, &evidence, &r.CreatedAt, &r.ResolvedAt, &r.Resolution,
			&r.ReporterID, &r.ReporterName, &r.TargetID, &r.TargetFirstName, &r.TargetLastName,
			&r.TargetSuspended, &r.TargetIsAdmin, &r.TargetOpenReports, &r.ListingID, &r.ListingTitle, &r.ListingRemoved)
		if err == nil && evidence != nil {
			err = json.Unmarshal(evidence, &r.Evidence)
		}
		return r, err
	})
}

// OpenReport è ciò che serve per decidere su una segnalazione ancora aperta.
type OpenReport struct {
	TargetID      string
	TargetIsAdmin bool
	ListingID     *int
}

// OpenReport restituisce la segnalazione se è ancora aperta; pgx.ErrNoRows altrimenti.
func (s *Store) OpenReport(ctx context.Context, id int64) (OpenReport, error) {
	var r OpenReport
	err := s.db.QueryRow(ctx, `
        SELECT r.target_user_id::text, t.is_admin, r.listing_id
        FROM roomdate_app.reports r JOIN roomdate_app.users t ON t.id = r.target_user_id
        WHERE r.id = $1 AND r.status = 'open'`, id).Scan(&r.TargetID, &r.TargetIsAdmin, &r.ListingID)
	return r, err
}

// Resolution è la decisione dell'amministratore su una segnalazione.
type Resolution struct {
	ReportID int64
	AdminID  string
	Note     string
	// Una sola delle tre azioni
	Dismiss       bool
	RemoveListing *int
	SuspendUser   string
}

// Resolve applica la decisione e chiude la segnalazione, in un'unica transazione. Rimuovere un
// annuncio chiude anche le altre segnalazioni aperte su quell'annuncio; sospendere un utente
// chiude tutte quelle aperte su di lui e ne chiude le sessioni.
func (s *Store) Resolve(ctx context.Context, r Resolution) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	const closeReports = `
        UPDATE roomdate_app.reports SET status = $2, resolved_at = now(), resolved_by = $3, resolution = NULLIF($4, '')
        WHERE status = 'open' AND `
	switch {
	case r.RemoveListing != nil:
		if _, err := tx.Exec(ctx, `UPDATE roomdate_app.listings SET removed_at = now(), is_active = false WHERE id = $1`, *r.RemoveListing); err != nil {
			return err
		}
		_, err = tx.Exec(ctx, closeReports+`(id = $1 OR listing_id = $5)`, r.ReportID, "resolved", r.AdminID, r.Note, *r.RemoveListing)
	case r.SuspendUser != "":
		if _, err := tx.Exec(ctx, `UPDATE roomdate_app.users SET suspended_at = now() WHERE id = $1`, r.SuspendUser); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `DELETE FROM roomdate_app.sessions WHERE user_id = $1`, r.SuspendUser); err != nil {
			return err
		}
		_, err = tx.Exec(ctx, closeReports+`(id = $1 OR target_user_id = $5)`, r.ReportID, "resolved", r.AdminID, r.Note, r.SuspendUser)
	default:
		_, err = tx.Exec(ctx, closeReports+`id = $1`, r.ReportID, "dismissed", r.AdminID, r.Note)
	}
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// Unsuspend riattiva un account sospeso. Restituisce false se l'utente non esiste.
func (s *Store) Unsuspend(ctx context.Context, userID string) (bool, error) {
	tag, err := s.db.Exec(ctx, `UPDATE roomdate_app.users SET suspended_at = NULL WHERE id = $1`, userID)
	if db.IsInvalidInput(err) {
		return false, nil
	}
	return tag.RowsAffected() == 1, err
}

// RestoreListing annulla la rimozione di un annuncio, che resta disattivato finché il proprietario
// non lo riattiva. Restituisce false se l'annuncio non esiste.
func (s *Store) RestoreListing(ctx context.Context, listingID int) (bool, error) {
	tag, err := s.db.Exec(ctx, `UPDATE roomdate_app.listings SET removed_at = NULL WHERE id = $1`, listingID)
	return tag.RowsAffected() == 1, err
}

// DeleteClosedReports elimina le segnalazioni chiuse da più di keepFor, con i messaggi allegati.
func (s *Store) DeleteClosedReports(ctx context.Context, keepFor time.Duration) error {
	_, err := s.db.Exec(ctx, `DELETE FROM roomdate_app.reports WHERE resolved_at < $1`, time.Now().Add(-keepFor))
	return err
}
