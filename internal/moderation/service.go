package moderation

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"roomdate-backend/internal/apperr"
	"roomdate-backend/internal/db"
	"roomdate-backend/internal/logx"
	"roomdate-backend/internal/page"
	"roomdate-backend/internal/validate"
	"roomdate-backend/shared"
)

const (
	maxDetailsLength = 1000
	maxEvidence      = 20
	// Ogni messaggio allegato è tagliato dal browser a 1000 caratteri: 20 messaggi restano sotto il
	// limite di 64 KB per richiesta anche con accenti ed emoji
	maxEvidenceLength = 1000
	// Segnalazioni che un utente può inviare in un giorno: bastano per un uso onesto e frenano gli abusi.
	maxReportsPerDay = 10
	reportsPageSize  = 30
	// Le segnalazioni chiuse, con gli eventuali messaggi allegati, si conservano per 180 giorni.
	ClosedReportRetention = 180 * 24 * time.Hour
)

var (
	errUserNotFound    = apperr.NotFound("user_not_found", "Utente non trovato")
	errListingNotFound = apperr.NotFound("listing_not_found", "Annuncio non trovato")
	errReportNotFound  = apperr.NotFound("report_not_found", "Segnalazione non trovata o già chiusa")
	errSelfBlock       = apperr.BadRequest("self_block", "Non puoi bloccare te stesso")
	errSelfReport      = apperr.BadRequest("self_report", "Non puoi segnalare te stesso o un tuo annuncio")
	errAdminOnly       = apperr.Forbidden("admin_only", "Riservato agli amministratori")
	errTooManyReports  = apperr.TooManyRequests("too_many_reports", "Hai inviato molte segnalazioni oggi: riprova domani")
)

type Service struct {
	store *Store
	now   func() time.Time
}

func NewService(store *Store) *Service {
	return &Service{store: store, now: time.Now}
}

// Block impedisce ai due utenti di scriversi e di trovarsi nelle ricerche.
func (s *Service) Block(ctx context.Context, userID, rawTargetID string) error {
	targetID, err := s.existingUser(ctx, rawTargetID)
	if err != nil {
		return err
	}
	if targetID == userID {
		return errSelfBlock
	}
	if err := s.store.Block(ctx, userID, targetID); err != nil {
		return apperr.Wrap(err, "block_failed", "Impossibile bloccare l'utente in questo momento")
	}
	return nil
}

// Unblock toglie il blocco; se non c'era, non fa nulla.
func (s *Service) Unblock(ctx context.Context, userID, rawTargetID string) error {
	if !validate.MaxLen(rawTargetID, 64) {
		return nil
	}
	if err := s.store.Unblock(ctx, userID, rawTargetID); err != nil {
		return apperr.Wrap(err, "unblock_failed", "Impossibile sbloccare l'utente in questo momento")
	}
	return nil
}

func (s *Service) Blocks(ctx context.Context, userID string) ([]BlockedUser, error) {
	blocks, err := s.store.Blocks(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("lettura blocchi: %w", err)
	}
	if blocks == nil {
		blocks = []BlockedUser{}
	}
	return blocks, nil
}

func (s *Service) existingUser(ctx context.Context, rawID string) (string, error) {
	if !validate.MaxLen(rawID, 64) {
		return "", errUserNotFound
	}
	id, err := s.store.UserID(ctx, rawID)
	if db.IsNoRows(err) {
		return "", errUserNotFound
	}
	if err != nil {
		return "", fmt.Errorf("verifica utente: %w", err)
	}
	return id, nil
}

// ReportInput segnala un utente (UserID) oppure un annuncio (ListingID). Dalla chat, chi segnala
// può allegare i messaggi ricevuti, decifrati nel suo browser: servono ConversationID e UserID,
// e devono partecipare entrambi alla conversazione.
type ReportInput struct {
	UserID         string     `json:"userId"`
	ListingID      int        `json:"listingId"`
	ConversationID int        `json:"conversationId"`
	Reason         string     `json:"reason"`
	Details        string     `json:"details"`
	Evidence       []Evidence `json:"evidence"`
}

// Report salva la segnalazione e ne restituisce l'ID; created è false se era già aperta.
func (s *Service) Report(ctx context.Context, reporterID string, in ReportInput) (id int64, created bool, err error) {
	details := validate.Text(in.Details)
	var v validate.Validator
	v.Check(shared.HasKey(shared.ReportReasons, in.Reason), "reason", "Scegli un motivo dall'elenco")
	v.Check(validate.MaxLen(details, maxDetailsLength), "details", "La descrizione può avere al massimo 1000 caratteri")
	v.Check(len(in.Evidence) <= maxEvidence, "evidence", "Puoi allegare al massimo 20 messaggi")
	for _, e := range in.Evidence {
		v.Check(validate.NotBlank(e.Text) && validate.MaxLen(e.Text, maxEvidenceLength) && !e.SentAt.IsZero(),
			"evidence", "Messaggi allegati non validi")
	}
	v.Check((in.UserID == "") != (in.ListingID == 0), "target", "Indica l'utente o l'annuncio da segnalare")
	v.Check(len(in.Evidence) == 0 || (in.ConversationID > 0 && in.UserID != ""), "evidence",
		"I messaggi si possono allegare solo dalla conversazione")
	if err := v.Err(); err != nil {
		return 0, false, err
	}

	report := NewReport{ReporterID: reporterID, Reason: in.Reason, Details: details, Evidence: in.Evidence}
	if in.ListingID != 0 {
		owner, err := s.store.ListingOwner(ctx, in.ListingID)
		if db.IsNoRows(err) || (err == nil && owner == "") {
			return 0, false, errListingNotFound
		}
		if err != nil {
			return 0, false, fmt.Errorf("lettura annuncio: %w", err)
		}
		listingID := in.ListingID
		report.TargetUserID, report.ListingID = owner, &listingID
	} else {
		if report.TargetUserID, err = s.existingUser(ctx, in.UserID); err != nil {
			return 0, false, err
		}
	}
	if report.TargetUserID == reporterID {
		return 0, false, errSelfReport
	}
	for i := range report.Evidence {
		report.Evidence[i].Text = validate.Text(report.Evidence[i].Text)
		report.Evidence[i].SentAt = report.Evidence[i].SentAt.UTC()
	}
	if in.ConversationID != 0 {
		together, err := s.store.SharesConversation(ctx, in.ConversationID, reporterID, report.TargetUserID)
		if err != nil {
			return 0, false, fmt.Errorf("verifica conversazione: %w", err)
		}
		if !together {
			return 0, false, apperr.Forbidden("not_participant", "Accesso negato a questa conversazione")
		}
	}

	sent, err := s.store.ReportsSince(ctx, reporterID, s.now().Add(-24*time.Hour))
	if err != nil {
		return 0, false, fmt.Errorf("conteggio segnalazioni: %w", err)
	}
	if sent >= maxReportsPerDay {
		return 0, false, errTooManyReports
	}
	id, created, err = s.store.CreateReport(ctx, report)
	if err != nil {
		return 0, false, apperr.Wrap(err, "report_failed", "Impossibile inviare la segnalazione in questo momento")
	}
	return id, created, nil
}

func (s *Service) requireAdmin(ctx context.Context, userID string) error {
	admin, err := s.store.IsAdmin(ctx, userID)
	if err != nil {
		return fmt.Errorf("verifica amministratore: %w", err)
	}
	if !admin {
		return errAdminOnly
	}
	return nil
}

// AdminReport è una segnalazione nell'area di moderazione.
type AdminReport struct {
	ID        int64      `json:"id"`
	Reason    string     `json:"reason"`
	Details   string     `json:"details"`
	Evidence  []Evidence `json:"evidence"`
	Status    string     `json:"status"`
	CreatedAt time.Time  `json:"createdAt"`
	// ResolvedAt e Resolution solo per le segnalazioni chiuse.
	ResolvedAt *time.Time    `json:"resolvedAt"`
	Resolution string        `json:"resolution"`
	Reporter   *ReportPerson `json:"reporter"`
	Target     ReportTarget  `json:"target"`
	Listing    *ReportedItem `json:"listing"`
}

// ReportPerson è chi ha segnalato; null se ha eliminato l'account.
type ReportPerson struct {
	ID        string `json:"id"`
	FirstName string `json:"firstName"`
}

// ReportTarget è l'utente segnalato, o il proprietario dell'annuncio segnalato.
type ReportTarget struct {
	ID          string `json:"id"`
	FirstName   string `json:"firstName"`
	LastName    string `json:"lastName"`
	Suspended   bool   `json:"suspended"`
	IsAdmin     bool   `json:"isAdmin"`
	OpenReports int    `json:"openReports"`
}

type ReportedItem struct {
	ID      int    `json:"id"`
	Title   string `json:"title"`
	Removed bool   `json:"removed"`
}

type ReportsPage struct {
	Items      []AdminReport `json:"items"`
	NextCursor *string       `json:"nextCursor"`
}

// AdminReports restituisce le segnalazioni aperte ("open") o chiuse ("closed"). Già che c'è,
// elimina quelle chiuse da più di 180 giorni: non serve un processo pianificato a parte.
func (s *Service) AdminReports(ctx context.Context, adminID, status, cursor string) (ReportsPage, error) {
	if err := s.requireAdmin(ctx, adminID); err != nil {
		return ReportsPage{}, err
	}
	if status == "" {
		status = "open"
	}
	if status != "open" && status != "closed" {
		return ReportsPage{}, apperr.BadRequest("invalid_status", "Stato non valido")
	}
	var after int64
	if cursor != "" {
		if fields, ok := page.Decode(cursor, 1); ok {
			after, _ = strconv.ParseInt(fields[0], 10, 64)
		}
		if after <= 0 {
			return ReportsPage{}, apperr.BadRequest("invalid_cursor", "Cursore non valido")
		}
	} else if err := s.store.DeleteClosedReports(ctx, ClosedReportRetention); err != nil {
		logx.From(ctx).Warn("pulizia segnalazioni chiuse non riuscita", "err", err)
	}
	return s.reportsPage(ctx, status, after)
}

func (s *Service) reportsPage(ctx context.Context, status string, after int64) (ReportsPage, error) {
	rows, err := s.store.Reports(ctx, status == "open", after, reportsPageSize+1)
	if err != nil {
		return ReportsPage{}, fmt.Errorf("lettura segnalazioni: %w", err)
	}
	result := ReportsPage{Items: []AdminReport{}}
	if len(rows) > reportsPageSize {
		rows = rows[:reportsPageSize]
		next := page.Encode(strconv.FormatInt(rows[len(rows)-1].ID, 10))
		result.NextCursor = &next
	}
	for _, r := range rows {
		item := AdminReport{
			ID: r.ID, Reason: r.Reason, Details: r.Details, Evidence: r.Evidence, Status: r.Status,
			CreatedAt: r.CreatedAt.UTC(), ResolvedAt: r.ResolvedAt, Resolution: r.Resolution,
			Target: ReportTarget{
				ID: r.TargetID, FirstName: r.TargetFirstName, LastName: r.TargetLastName,
				Suspended: r.TargetSuspended, IsAdmin: r.TargetIsAdmin, OpenReports: r.TargetOpenReports,
			},
		}
		if item.Evidence == nil {
			item.Evidence = []Evidence{}
		}
		if item.ResolvedAt != nil {
			resolved := item.ResolvedAt.UTC()
			item.ResolvedAt = &resolved
		}
		if r.ReporterID != "" {
			item.Reporter = &ReportPerson{ID: r.ReporterID, FirstName: r.ReporterName}
		}
		if r.ListingID != nil {
			item.Listing = &ReportedItem{ID: *r.ListingID, Title: r.ListingTitle, Removed: r.ListingRemoved}
		}
		result.Items = append(result.Items, item)
	}
	return result, nil
}

// Azioni possibili su una segnalazione.
const (
	ActionDismiss       = "dismiss"
	ActionRemoveListing = "remove_listing"
	ActionSuspendUser   = "suspend_user"
)

type ResolveInput struct {
	Action string `json:"action"`
	Note   string `json:"note"`
}

// Resolve chiude la segnalazione con l'azione scelta dall'amministratore.
func (s *Service) Resolve(ctx context.Context, adminID, rawReportID string, in ResolveInput) error {
	if err := s.requireAdmin(ctx, adminID); err != nil {
		return err
	}
	reportID, ok := validate.PositiveID(rawReportID)
	if !ok {
		return errReportNotFound
	}
	note := validate.Text(in.Note)
	var v validate.Validator
	v.Check(validate.OneOf(in.Action, ActionDismiss, ActionRemoveListing, ActionSuspendUser), "action", "Azione non valida")
	v.Check(validate.MaxLen(note, 500), "note", "La nota può avere al massimo 500 caratteri")
	if err := v.Err(); err != nil {
		return err
	}

	report, err := s.store.OpenReport(ctx, int64(reportID))
	if db.IsNoRows(err) {
		return errReportNotFound
	}
	if err != nil {
		return fmt.Errorf("lettura segnalazione: %w", err)
	}
	resolution := Resolution{ReportID: int64(reportID), AdminID: adminID, Note: note}
	switch in.Action {
	case ActionRemoveListing:
		if report.ListingID == nil {
			return apperr.BadRequest("no_listing", "La segnalazione non riguarda un annuncio")
		}
		resolution.RemoveListing = report.ListingID
	case ActionSuspendUser:
		if report.TargetID == adminID || report.TargetIsAdmin {
			return apperr.BadRequest("cannot_suspend_admin", "Non puoi sospendere un amministratore")
		}
		resolution.SuspendUser = report.TargetID
	default:
		resolution.Dismiss = true
	}
	if err := s.store.Resolve(ctx, resolution); err != nil {
		return apperr.Wrap(err, "resolve_failed", "Impossibile chiudere la segnalazione in questo momento")
	}
	logx.From(ctx).Info("segnalazione chiusa", "report", reportID, "action", in.Action)
	return nil
}

// Unsuspend riattiva un account sospeso per errore o dopo un chiarimento.
func (s *Service) Unsuspend(ctx context.Context, adminID, rawUserID string) error {
	if err := s.requireAdmin(ctx, adminID); err != nil {
		return err
	}
	if !validate.MaxLen(rawUserID, 64) {
		return errUserNotFound
	}
	found, err := s.store.Unsuspend(ctx, rawUserID)
	if err != nil {
		return apperr.Wrap(err, "unsuspend_failed", "Impossibile riattivare l'account in questo momento")
	}
	if !found {
		return errUserNotFound
	}
	return nil
}

// RestoreListing annulla la rimozione di un annuncio.
func (s *Service) RestoreListing(ctx context.Context, adminID, rawListingID string) error {
	if err := s.requireAdmin(ctx, adminID); err != nil {
		return err
	}
	listingID, ok := validate.PositiveID(rawListingID)
	if !ok {
		return errListingNotFound
	}
	found, err := s.store.RestoreListing(ctx, listingID)
	if err != nil {
		return apperr.Wrap(err, "restore_failed", "Impossibile ripristinare l'annuncio in questo momento")
	}
	if !found {
		return errListingNotFound
	}
	return nil
}
