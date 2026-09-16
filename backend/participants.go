package backend

// isConversationParticipant verifica che l'utente faccia parte della conversazione:
// chi ha avviato la chat, il destinatario di una chat diretta o il proprietario dell'annuncio collegato.
func isConversationParticipant(conversationID int, userID string) (bool, error) {
	var ok bool
	err := DB.QueryRow(`
        SELECT EXISTS (
            SELECT 1
            FROM roomdate_app.conversations c
            LEFT JOIN roomdate_app.listings l ON c.listing_id = l.id
            WHERE c.id = $1
              AND (c.tenant_id::text = $2 OR c.user2_id::text = $2 OR l.user_id::text = $2)
        )
    `, conversationID, userID).Scan(&ok)
	return ok, err
}
