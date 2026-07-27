package handler

import (
	"database/sql"
	"net/http"
	"os"

	_ "github.com/lib/pq"
)

func DeleteListingHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Metodo non consentito", http.StatusMethodNotAllowed)
		return
	}

	// 🚨 1. CONTROLLO RBAC: Solo i proprietari possono eliminare annunci
	if !checkRole(r, "affitta") {
		http.Error(w, "Accesso negato: Solo i proprietari possono eliminare annunci", http.StatusForbidden)
		return
	}

	// 🛡️ 2. ZERO-TRUST: Otteniamo l'ID sicuro dell'utente dal token
	secureUserID := getSecureUserID(r)
	if secureUserID == "" {
		http.Error(w, "Accesso negato: Sessione non valida", http.StatusUnauthorized)
		return
	}

	id := r.URL.Query().Get("id")
	if id == "" {
		http.Error(w, "ID annuncio mancante", http.StatusBadRequest)
		return
	}

	db, err := sql.Open("postgres", os.Getenv("DATABASE_URL"))
	if err != nil {
		http.Error(w, "Errore DB", http.StatusInternalServerError)
		return
	}
	defer db.Close()

	// 🛡️ 3. FIX IDOR: La query ora esige che l'annuncio appartenga a chi fa la richiesta (user_id = $2)
	query := "DELETE FROM roomdate_app.listings WHERE id = $1 AND user_id = $2"
	res, err := db.Exec(query, id, secureUserID)
	if err != nil {
		http.Error(w, "Errore cancellazione: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Verifica se l'annuncio è stato effettivamente trovato e cancellato
	rowsAffected, err := res.RowsAffected()
	if err == nil && rowsAffected == 0 {
		// Se rowsAffected è 0, significa che l'annuncio non esiste o non appartiene a questo utente
		http.Error(w, "Annuncio non trovato o non autorizzato all'eliminazione", http.StatusForbidden)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("Annuncio eliminato con successo"))
}
