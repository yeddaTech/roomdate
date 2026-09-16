# Roomdate: piano di refactoring

> Generato il 2026-09-16 · Documento di pianificazione: nessun modulo è ancora stato implementato.

Ho letto tutto il codice Go e React, i file di configurazione (Vercel, Vite, Tailwind) e la cronologia git. Ho lanciato anche i controlli automatici: `go vet` e `govulncheck` non trovano problemi raggiungibili dal codice, `npm audit` sì. Un comportamento di una libreria l'ho verificato con un piccolo test in una cartella temporanea fuori dal progetto. Non ho accesso al database, quindi lo schema l'ho ricostruito dalle query e va confermato (è il primo passo di M1.1).

---

## 🚨 Da fare subito, fuori dal codice

1. **La password del database è pubblica.** Il repo `yeddaTech/Roomdate` è pubblico. Il commit `c4e8a15` (1 aprile 2026) contiene un `.env` con la `DATABASE_URL` completa (utente e password) del database Neon `ep-falling-field-…us-east-1`. Averlo cancellato nel commit successivo non basta: resta nella cronologia.
   - Cambia la password del ruolo Neon.
   - Aggiorna la `DATABASE_URL` su Vercel.
   - Controlla le connessioni e le attività recenti nel pannello Neon.
2. **Dati personali vecchi nella cronologia pubblica.** `root.sql` (commit `c541ba2`) contiene utenti con email gmail e password in SHA-256 senza sale, facili da ricavare. Ci sono anche foto in `images/uploads/`. Serve la tua decisione (D7) per ripulire la cronologia e, se erano persone reali, per valutare l'obbligo di segnalazione previsto dal GDPR.

---

## Ordine di esecuzione consigliato

Le tre fasi sono aree di lavoro. Eseguirle in quest'ordine evita di rifare le stesse cose due volte:

| Ondata | Moduli | Perché in questo punto |
|---|---|---|
| 0. Emergenza | **M0** | Ci sono falle sfruttabili oggi in produzione |
| 1. Fondamenta | M1.1, M3.1 | Migrazioni del DB, server locale e nuova struttura del backend: il resto si appoggia qui |
| 2. Dati reali | M1.2 → M1.7 (con M3.3 e M3.5 dove toccano gli stessi endpoint) | Si toglie tutto ciò che è finto |
| 3. Account e cifratura | M3.2, M3.4, M3.6 | Login e registrazione cambiano: vanno stabilizzati prima di ridisegnarli |
| 4. Restyling | M2.1 → M2.8 | La grafica si ricostruisce su dati e API ormai stabili |
| 5. Verifica | M3.7, M3.8 | CSP rigida (possibile solo dopo il restyling), test end-to-end, CI |

**Regola:** la Fase 1 cambia dati e logica lasciando l'aspetto com'è. La Fase 2 rifà la grafica sopra gli stessi hook, così nessuna pagina viene ridisegnata due volte. Le dimensioni S/M/L dei moduli sono relative tra loro.

---

## Modulo 0: correzioni urgenti di sicurezza (S)

Patch mirate sul codice attuale, senza refactoring:
- **Chat altrui** (`send_message.go:40`): prima di salvare, verificare che il mittente faccia parte della conversazione. Oggi qualsiasi utente loggato può scrivere in qualsiasi chat.
- **Profili altrui** (`profile.go:46-81`): restituire solo dati pubblici (niente email né data di nascita) e rispettare `is_public`. Il profilo completo solo per sé stessi.
- **Elenco coinquilini** (`get_roommates.go:30-41`): mostrare solo i profili pubblici.
- **Indicatore "sta scrivendo"** (`typing.go`):
  - rendere la sessione obbligatoria;
  - prendere il mittente dalla sessione e non dal client;
  - verificare che l'utente partecipi alla chat;
  - togliere l'intestazione CORS che accetta qualunque `Origin` con credenziali (righe 19-22).
- **Logout vero**: un'azione `logout` che cancella il cookie, chiamata da tutti i pulsanti "Esci".
- **Cambio password**:
  - chiedere la password attuale;
  - ricevere dal browser la chiave privata cifrata di nuovo con la nuova password, così i messaggi restano leggibili (F5).
- **Errori interni**: non restituire più i messaggi del database al client, oggi presenti in 10 punti:
  - `login.go:108,132,150,180`
  - `register.go:90`, `profile.go:127`, `create_listing.go:67`
  - `delete_my_listings.go:38`, `send_message.go:44`, `get_roommates.go:61`

**Fatto quando:** l'utente B non vede l'email o la data di nascita di A e non può scrivere nelle sue chat; dopo "Esci" e ricarica della pagina la sessione non si ripristina.

---

# FASE 1: pulizia dei dati e debugging

## 1.A Funzionalità attuali

| Funzionalità | Frontend | Endpoint | Stato |
|---|---|---|---|
| Registrazione e chiavi per la chat cifrata | Register | `POST /api/register` | Funziona, ma senza validazione, con testo corrotto (F1) ed errori del DB mostrati all'utente |
| Login e verifica sessione | Login, App | `POST /api/login` | Funziona, ma permette di scoprire quali email sono registrate e il blocco dopo 5 tentativi è abusabile |
| Logout | 7 copie di `handleLogout` | nessuno | **Rotto** (F4) |
| Cambio password | Impostazioni | `login` › `update_password` | **Rotto** (F5), non chiede la password attuale |
| Eliminazione account | Impostazioni | `login` › `delete_account` | Parziale: il cookie resta valido; FK da verificare |
| Password dimenticata, login social, "Ricordami", notifiche | Login, Impostazioni | nessuno | **Finti** |
| Profilo proprio e altrui | Dashboard, RoommateDetails | `GET/POST /api/profile` | Espone dati personali di chiunque; bug su tag e occupazione (F14, F15) |
| Elenco e dettaglio annunci | Home, Search, ListingDetails | `get_listings`, `get_listing` | Massimo 50 annunci; decorazioni e foto finte (F19) |
| Crea annuncio, i miei annunci, elimina | Dashboard | `create_listing`, `get_my_listings`, `delete_listing` | Funziona per chi affitta; non si può modificare, niente foto, niente validazione |
| Ricerca coinquilini | Search | `get_roommates` | Età e % di compatibilità inventate; solo 8 utenti; include profili privati |
| Avvio chat | ListingDetails, RoommateDetails, Search | `start_chat` | Chat duplicate e chat con sé stessi (F13) |
| Chat e tempo reale | Chatpage | `get_chats`, `send_message`, `typing`, Pusher | Chiunque può scrivere in chat altrui, query N+1, messaggi limitati a 190 byte, canale pubblico |

## 1.B Comportamenti anomali (verificati nel codice)

**Dati e testo**
- **F1 – Apostrofi corrotti.** `bluemonday.StrictPolicy()` viene applicato ai dati in ingresso e salva nel DB entità HTML. "un'amica vicino all'università" diventa `un&#39;amica vicino all&#39;università` e React lo mostra così (verificato eseguendo la libreria). Colpisce quasi ogni bio, titolo e descrizione in italiano. File: `register.go:50-56`, `profile.go:98-102`, `create_listing.go:50-55`.
- **F2 – Registrazione fragile.**
  - L'email non viene normalizzata: le maiuscole creano account duplicati e login che falliscono.
  - Una data di nascita vuota produce un errore 500 con il testo del DB.
- **F3 – Liste vuote e errori di lettura.** `get_my_listings`, `get_chats` e `get_roommates` restituiscono `null` invece di `[]` quando non ci sono risultati. Gli errori di lettura (`Scan`) vengono ignorati (`get_chats.go:94,137`, `get_my_listings.go:31`).

**Sessione e account**
- **F4 – Logout che non esce.** "Esci" svuota solo `localStorage`. Il cookie di sessione (HttpOnly) resta valido e al ricaricamento `App.jsx:27-50` ripristina l'utente.
- **F5 – Cambio password che cancella i messaggi.** La chiave privata della chat è cifrata con la vecchia password e non viene cifrata di nuovo: dopo il cambio tutti i messaggi diventano illeggibili.
- **F6 – Ruolo che non si aggiorna.** Il ruolo sta nel token JWT. Chi passa da "cerco" ad "affitto" riceve 403 quando pubblica, finché non rifà il login. La tab "Pubblica annuncio" è visibile anche a chi cerca.
- **F7 – Login a metà.** Se la chiave non si sblocca al login, il cookie è impostato ma l'utente locale no, e lo stato resta incoerente (`Login.jsx:73-77`).

**Chat**
- **F8 – Messaggi lunghi non partono.** RSA-OAEP a 2048 bit cifra al massimo 190 byte. Due righe con accenti o emoji falliscono con "Errore durante l'invio sicuro" (`crypto.js:104-128`).
- **F9 – La chat torna indietro da sola.** Una chat aperta da un annuncio riprende il focus a ogni evento in tempo reale (`Chatpage.jsx:201-206`).
- **F10 – Invii falliti in silenzio.** Il risultato dell'invio non viene controllato (`Chatpage.jsx:268`): con un errore 500 il messaggio resta su "Inviando..." e poi sparisce senza avviso.
- **F11 – Orari sbagliati.** Il server formatta gli orari in UTC e senza data (`get_chats.go:144`), mentre i messaggi appena inviati usano l'ora locale: dopo un refresh gli orari cambiano di 1-2 ore.
- **F12 – Tempesta di richieste.** Ogni messaggio inviato da chiunque fa ricaricare e decifrare di nuovo tutte le chat a tutti i client connessi: canale globale, ricarica completa e una query in più per ogni conversazione.
- **F13 – Chat duplicate.** Il proprietario può aprire una chat con sé stesso dal proprio annuncio, e un doppio click crea conversazioni duplicate perché manca un vincolo di unicità (`start_chat.go:38-54`).

**Profilo, annunci, ricerca**
- **F14 – Tag dello stile di vita.**
  - Chi non fuma risulta anche fumatore: `'Non Fumatore'.includes('Fumatore')` è vero.
  - `split(' ')[1]` aggiunge tag spazzatura come "Ho" e "Non" (`Dashboard.jsx:80-93, 378-380`).
- **F15 – Occupazione.** La registrazione salva `Studente`, la Dashboard usa `studente` e `misto`: il campo appare vuoto e nel DB finiscono valori misti.
- **F16 – Eliminazioni.** Eliminare un annuncio o un account con conversazioni collegate probabilmente fallisce per un vincolo di FK (da verificare sullo schema). Se fallisce, l'utente non vede alcun messaggio (`Dashboard.jsx:70`).
- **F17 – Filtri di ricerca.**
  - Lavorano solo nel browser, su 50 annunci e 8 utenti.
  - La città è testo libero confrontato per uguaglianza esatta.
  - Ogni tasto premuto nel budget aggiunge una voce alla cronologia del browser.
- **F18 – Coinquilini sbagliati.** La sezione "Coinquilini" mostra anche chi affitta e i profili privati.
- **F19 – Galleria rotta.** Le foto finte da Unsplash sono bloccate dalla CSP (`img-src 'self' data:`), quindi la galleria non funziona in produzione.

**Infrastruttura frontend**
- **F20 – Font mai caricati.** La CSP blocca l'`onload` inline di `index.html:29`, quindi DM Sans e Playfair non vengono mai applicati. `font-serif` usa Georgia e le classi `font-display`, `py-4.5` e `animate-in` non esistono.
- **F21 – Pagine inesistenti.** Gli URL sconosciuti mostrano la Home invece di un 404 (`App.jsx:72`). In `index.html:82` c'è un link a `/listings`, che non esiste.
- **F22 – Sviluppo locale impossibile.** `api.js` punta a `localhost:8080`, ma non esiste un server Go avviabile in locale. `node_modules` è incompleto: manca React.

## 1.C Dati finti e cosa li sostituisce

| Dove | Dato finto | Sostituzione |
|---|---|---|
| `get_listing.go:72-78,84` | Servizi, 3 foto Unsplash, emoji e ruolo dell'host | `amenities text[]`, tabella `listing_images`, dati reali dell'host |
| `get_listings.go:49-65` | Colori ed emoji casuali, `avail: true`, tag "Verificato" | `is_active`, `available_from`; nessun badge di verifica finché la verifica non esiste |
| `get_roommates.go:33-39,67-71` | Età 22–27, compatibilità 85–99%, bio/tag/occupazione segnaposto | Età calcolata da `birthdate`, compatibilità calcolata, "non indicato" quando manca |
| `get_chats.go:85-110` | Emoji e colori, "Utente Sconosciuto" | Iniziali reali, stato "utente eliminato" esplicito |
| `Login.jsx:132-155,176-192,91-97,245` | Testimonianza "Martina F.", "12.000+ annunci", "Profili verificati", login social, reset password finto, "Ricordami" | Rimossi (il reset vero arriva in M3.2) |
| `Register.jsx:145` | "Migliaia di stanze…" | Testo veritiero |
| `Dashboard.jsx:229,239-246` | `@nome1234`, "Salvati 0", "Chat 0" | Conteggi reali di preferiti e conversazioni |
| `Impostazioni.jsx:18-19,81-84` | Interruttori notifiche non salvati, conferma finta | Tabella `user_settings`, oppure sezione nascosta |
| `Search.jsx:323,325,340`, `RoommateDetails.jsx:159`, `ListingDetails.jsx:235`, `Chatpage.jsx:540` | "Studente", "Cerco una stanza accogliente!", 85%, "Milano", "spese incluse", "Inquilino/Proprietario" | Dati reali (`bills_included`, ruolo effettivo nella chat) |
| `Hero`, `Listings`, `HowItWorks`, `Testimonials.jsx` | Componenti non usati: 6 annunci finti, recensioni, "4.9/5 su 2.400+", "98% soddisfatti" | Eliminati |
| `Footer.jsx:28-39,57`, `CookieBanner.jsx:41` | Link social generici, `support@roomdate.com`, script di analytics segnaposto | Rimossi o sostituiti con valori reali |
| `Guide.jsx:17,25,41`, `llms.txt`, `README.md:19`, `Privacy.jsx:47,52` | "Algoritmo di compatibilità", "profili verificati", "zero-knowledge", server "in UE", "foto" | Allineati ai fatti, oppure implementati davvero |

## 1.D Moduli

**M1.1 Fondamenta dei dati e ambiente di sviluppo (M)**
- Estrarre lo schema reale di `roomdate_app` con `pg_dump --schema-only` e farne la prima migrazione versionata (goose, SQL incluso nel binario).
- Creare branch Neon separati per sviluppo e anteprime Vercel, e verificare che le anteprime non usino il DB di produzione.
- Aggiungere `cmd/dev`, un server locale su `:8080` che usa lo stesso handler di `api/index.go` (F22).
- Dati di prova solo nei branch di sviluppo, mai nel frontend né in produzione.
- Pulizia del repo:
  - togliere da git i 1.121 file di `node_modules`;
  - eseguire `go mod tidy`;
  - aggiornare `vite` e `react-router-dom` (8 avvisi di gravità alta);
  - aggiornare Go all'ultima patch della 1.25.
- Migrazione che ripulisce i testi già corrotti da bluemonday (F1).
- *Fatto quando:* sviluppo locale completo funzionante su un branch Neon e schema ricostruibile da zero.

**M1.2 Client API e sessione unificati (M)**
- Un unico `AuthProvider` basato sulla sessione verificata dal server, più una `ProtectedRoute`. Eliminare i 7 `handleLogout` duplicati e le letture sparse di `localStorage`.
- Un solo client API con errori in JSON strutturato; TanStack Query per cache, nuovi tentativi e deduplicazione delle richieste.
- Un contratto API coerente. Oggi il frontend compensa nomi diversi per lo stesso dato (`nome/first_name`, `citta/city`, `price/prezzo`, `lifestyle_tags/tags`, `user_type/userType`). Consiglio TypeScript almeno per il client API.
- Ruolo letto dal DB e tab "Pubblica annuncio" solo per chi affitta (F6); pagina 404 vera (F21).

**M1.3 Rimozione di contenuti finti e affermazioni non vere (S)**
- Applicare la tabella 1.C lato frontend e testi.
- Eliminare i 4 componenti non usati.
- Se restano solo cookie tecnici, il cookie banner si può togliere.

**M1.4 Annunci su dati reali (M)**
- Schema:
  - nuovi campi `amenities`, `bills_included`, `available_from`, `is_active`, `updated_at`;
  - vincoli CHECK su prezzo e tipo di stanza;
  - FK con `ON DELETE` esplicito (F16).
- Nuovo endpoint per modificare un annuncio e per attivarlo o disattivarlo.
- Foto: tabella `listing_images` e caricamento diretto e firmato verso lo storage (decisione D1). Fino ad allora, un segnaposto neutro e dichiarato come tale.
- Validazione lato server. Il testo si salva così com'è, perché React fa già l'escape quando lo mostra; bluemonday in ingresso sparisce.

**M1.5 Profili e coinquilini su dati reali (M)**
- `lifestyle_tags` diventa un elenco (`text[]`) con chiavi fisse, migrando i dati esistenti (F14). Occupazione e città diventano liste condivise tra frontend e backend (F15, F17).
- Normalizzazione dell'email e indice unico che ignora le maiuscole (F2).
- `get_roommates`:
  - età calcolata, senza mai esporre la data;
  - solo profili pubblici;
  - esclusione di sé stessi;
  - filtro per ruolo;
  - paginazione (F18).
- Compatibilità calcolata sul server e spiegabile (città, budget, tag in comune), oppure rimossa (D6).

**M1.6 Ricerca lato server (S/M)**
- `GET /api/v1/listings` e `GET /api/v1/roommates` con filtri, ordinamento e paginazione a cursore, più gli indici necessari.
- L'URL diventa l'unica fonte dei filtri, con un ritardo sul campo budget (debounce). Un errore di rete va mostrato come errore, non come "nessun risultato" (F17).

**M1.7 Chat stabile e scalabile (L)**
- Separare l'elenco delle conversazioni (ultimo messaggio, non letti) dai messaggi, caricati a pagine: elimina N+1 e ricariche complete (F12).
- Tabella `conversation_participants` con `last_read_at` e chiave unica: niente duplicati né chat con sé stessi (F13), contatore "Chat" reale.
- Orari salvati in UTC, formattati nel browser con separatori di data (F11).
- Gestione degli errori di invio con "Riprova" (F10); `openChatId` usato una sola volta (F9).
- **Cifratura ibrida:**
  - il testo si cifra con AES-256-GCM;
  - la chiave del messaggio si cifra con RSA-OAEP per ogni partecipante;
  - il formato è versionato, e i vecchi messaggi restano leggibili.

  Così sparisce il limite di 190 byte (F8).
- Eventi in tempo reale per singolo utente (insieme a M3.5): arriva solo il messaggio nuovo.

---

# FASE 2: restyling e coerenza UI/UX

## 2.A Diagnosi
- **Due stili sovrapposti:** il vecchio "terra/cream" (variabili CSS mai definite, colori fissi nel cookie banner) e l'attuale neutro con gradiente arancio-rosa.
- **9 barre di navigazione diverse.**
  - Una a pillola solo nella Home, altre copiate in 6 pagine con link diversi.
  - "Impostazioni" manca in 4 menu mobile e 2 desktop.
  - "Cerca Stanza" e "Trova Stanza" convivono.
  - Privacy, Termini e Guida non hanno navigazione.
- **Tipografia rotta** (F20).
- **Stile disordinato:**
  - emoji usate come icone;
  - 30 `alert`, `confirm` e `prompt` come unico feedback;
  - 31 dimensioni di testo arbitrarie (`text-[11px]`…);
  - bordi arrotondati e ombre non uniformi.
- **Accessibilità:**
  - nessuna etichetta collegata al suo campo (`htmlFor` compare 0 volte);
  - elenco chat e tag della registrazione non usabili da tastiera;
  - menu senza `aria-expanded` e senza gestione del focus;
  - contrasto di `text-neutral-400` insufficiente;
  - frecce della galleria visibili solo al passaggio del mouse, quindi invisibili su touch.
- **Mobile:** spazio vuoto in fondo per una barra di navigazione che non esiste; il cookie banner copre il campo di scrittura della chat.
- **Stati di caricamento ed errore incoerenti.** La Dashboard mescola profilo, gestione e creazione degli annunci, e gli annunci non hanno foto, che sono il contenuto principale.

## 2.B Direzione e design system
- **Stack:**
  - Tailwind v4 con i token in `@theme`;
  - React 19, con metadati nativi al posto di react-helmet-async;
  - componenti accessibili in stile shadcn/ui su Radix;
  - `lucide-react` per le icone e `sonner` per le notifiche a comparsa;
  - `react-hook-form` + `zod` per i form, con gli stessi vincoli del backend.
- **Token:**
  - neutri caldi (stone) e un arancio profondo come colore principale per le azioni;
  - gradiente riservato ai momenti di brand;
  - griglia di spaziatura a 4px, 3 raggi di arrotondamento, 2 livelli d'ombra;
  - modalità scura.
- **Font ospitati sul sito (Fontsource):** un serif solo per i titoli, un sans per l'interfaccia. Risolve il problema con la CSP, migliora le prestazioni ed evita di inviare gli IP a Google (GDPR).
- **Animazioni** di 150–250ms, rispettando `prefers-reduced-motion`.
- **Mobile come un'app:** barra in basso (Home, Cerca, Preferiti, Chat con badge, Profilo); navigazione in alto su desktop.
- **Coinvolgimento basato su valore reale, senza trucchi:**
  - preferiti e ricerche salvate con avvisi;
  - badge dei messaggi non letti;
  - indicatore di completezza del profilo e onboarding guidato;
  - risposta immediata dell'interfaccia alle azioni.

## 2.C Moduli
- **M2.1 Fondamenta del design system (M).**
  - Token e font.
  - Componenti di base: Button, Input, Select, Chip, Card, Badge, Avatar, Dialog, Sheet, Tabs, Toast, Skeleton, EmptyState.
  - Sostituire tutti i 30 `alert`, `confirm` e `prompt`.
- **M2.2 Struttura e navigazione (S/M).** Layout Public, App, Auth e Legal; una sola barra di navigazione più la barra mobile; ErrorBoundary; 404; ripristino dello scroll; margini sicuri per iOS.
- **M2.3 Accesso e onboarding (M).** Registrazione a passi (account → ruolo → profilo → stile di vita), login pulito, validazione mentre si scrive, password dimenticata e chiave di recupero (dipende da M3.2 e M3.4).
- **M2.4 Home e ricerca (M).** Home con annunci e città reali; filtri in un pannello a scorrimento su mobile e in una colonna laterale su desktop; ordinamento; caricamento continuo; schede con foto; preferiti (tabella `saved_listings` ed endpoint).
- **M2.5 Dettaglio annuncio e profilo (M).** Galleria a schermo intero con swipe, servizi con icone, pulsante di contatto fisso su mobile, spiegazione della compatibilità.
- **M2.6 Chat (L).**
  - Messaggi raggruppati per mittente, con separatori di data.
  - Stati inviato, errore e "Riprova".
  - Non letti, "sta scrivendo" e scheda dell'annuncio collegato.
  - Sblocco della cifratura ridisegnato e gestione della tastiera su mobile.
- **M2.7 Area personale (M).**
  - Dashboard divisa in Profilo, I miei annunci (creazione e modifica guidate, con foto) e Preferiti.
  - Impostazioni: password, sessioni attive, notifiche reali, privacy, esportazione dati ed eliminazione account.
- **M2.8 Qualità (M).** Accessibilità WCAG 2.2 AA, LCP sotto i 2,5s su mobile, immagini responsive, SEO delle pagine pubbliche, app installabile (PWA).

---

# FASE 3: sicurezza e backend

## 3.A Vulnerabilità trovate

| ID | Gravità | Problema | Dove | Risolta in |
|---|---|---|---|---|
| S1 | **Critica** | Password del DB Neon nella cronologia di un repo pubblico | commit `c4e8a15` | Azione manuale + M3.7 |
| S2 | **Critica** | Qualsiasi utente loggato scrive in qualsiasi conversazione (ID interi e sequenziali) | `send_message.go:40` | M0, M3.3 |
| S3 | **Critica** | Senza login: `get_roommates` elenca gli ID anche dei profili privati e `profile?userId=` restituisce email e data di nascita di chiunque | `get_roommates.go`, `profile.go:47-81` | M0, M3.3 |
| S4 | Alta | `/api/typing` senza autenticazione, mittente falsificabile, CORS che accetta qualunque Origin con credenziali | `typing.go:19-22,45` | M0, M3.5 |
| S5 | Alta | Canale Pusher pubblico e unico: chiunque abbia la chiave (presente nel JS) vede quali chat sono attive e chi sta scrivendo | `send_message.go:57`, `Chatpage.jsx:163` | M3.5 |
| S6 | Alta | Sessioni non revocabili: il JWT resta valido 24h anche dopo logout, cambio password o eliminazione dell'account | `login.go:217-237` | M0, M3.2 |
| S7 | Alta | Cambio password ed eliminazione dell'account senza reinserire la password | `login.go:117-155` | M0, M3.2 |
| S8 | Alta | "Zero-knowledge" non reale: la password arriva in chiaro al server ed è l'unico segreto che protegge la chiave privata salvata nel DB; il server può anche sostituire le chiavi pubbliche | `crypto.js:28-62`, `login.go:240-247` | M3.4 |
| S9 | Alta | Dump SQL vecchio con email reali, hash SHA-256 senza sale e foto nella cronologia pubblica | `c541ba2`, `86c5419` | M3.7 (D7) |
| S10 | Alta | `react-router-dom` 7.13.2 e `vite` 5.4.21 con avvisi di gravità alta | `package-lock.json` | M1.1 |
| S11 | Media | Si può scoprire se un'email è registrata ("Email non trovata" contro "Password errata", errori di unicità in registrazione) | `login.go:177,202` | M3.2 |
| S12 | Media | Il blocco dopo 5 tentativi permette di bloccare l'account di chiunque; nessun limite per IP; il contatore non è atomico | `login.go:189-204` | M3.2 |
| S13 | Media | Errori del DB restituiti al client | 10 punti | M0 |
| S14 | Media | Nessuna validazione dei dati in ingresso né limite alla dimensione delle richieste | Tutti gli handler | M3.1 |
| S15 | Media | Chiave privata in chiaro in `sessionStorage`: rubabile con qualsiasi XSS | `Login.jsx:58` | M3.4 |
| S16 | Media | CSRF protetta solo da SameSite=Lax; nessun controllo di `Content-Type` né di `Origin` | handler | M3.1 |
| S17 | Media | Ruolo nel JWT non aggiornato; `user_type` accetta qualsiasi valore | `profile.go:124`, `register.go:77` | M1.2, M3.2 |
| S18 | Media | Lettura del JWT senza `WithValidMethods` e senza blocco se `JWT_SECRET` è vuoto | `login.go:251-297` | M3.2 |
| S19 | Media | GDPR: il DB è in `us-east-1` ma l'informativa dice "in UE"; font caricati da Google | `Privacy.jsx:52`, `index.html:26-32` | M2.1, M3.6 |
| S20 | Bassa | CSP con `'unsafe-inline'`; mancano `object-src`, `base-uri`, `form-action` e `Permissions-Policy`; cookie senza prefisso `__Host-` | `vercel.json:16` | M3.7 |
| S21 | Bassa | PBKDF2 a 100k iterazioni (ne servono 600k); `lib/pq` solo in manutenzione; nessun test né CI di sicurezza | vari | M3.1, M3.4, M3.7 |

## 3.B Architettura del backend

```
api/index.go         adattatore Vercel → server.Handler()
cmd/dev/main.go      stesso handler su :8080
internal/
  config/            variabili d'ambiente tipizzate; avvio bloccato se manca un segreto
  db/                pool pgx/v5, transazioni, migrazioni SQL (goose)
  httpx/             router net/http (metodo + percorso), middleware, errori JSON
  auth/              sessioni, hashing, limitazione dei tentativi
  users/ listings/ chat/ realtime/   handler → service → store per area
  validate/          regole condivise
```

- **Catena dei middleware**, in ordine:
  1. recover
  2. ID richiesta
  3. log strutturato (slog), senza dati personali né testo cifrato
  4. intestazioni di sicurezza
  5. limite dimensione richiesta
  6. solo JSON in scrittura
  7. controllo `Origin`/`Sec-Fetch-Site`
  8. limite di frequenza
  9. autenticazione
  10. autorizzazione sulla singola risorsa
- **Formato errori:** `{"error":{"code":"…","message":"…"}}`; i dettagli tecnici solo nei log.
- **API v1:** Vercel pubblica frontend e backend insieme, quindi non serve mantenere i vecchi endpoint.
  - **Account:** `auth/{register,prelogin,login,logout,session,password}`, `me`
  - **Persone:** `users/{id}` (solo dati pubblici), `roommates`
  - **Annunci:** `listings`, `listings/{id}`, `listings/{id}/images`, `me/saved-listings/{id}`
  - **Chat:** `conversations`, `conversations/{id}/messages?before=`, `conversations/{id}/read`
  - **Tempo reale:** `realtime/auth`

## 3.C Moduli

**M3.1 Fondamenta del backend (M).** La struttura descritta sopra, `pgx` al posto di `lib/pq`, validazione e limiti. Prima si portano gli endpoint esistenti così come sono, poi se ne cambia il comportamento. *Fatto quando:* gli stessi flussi funzionano e gli handler hanno test con `httptest`.

**M3.2 Autenticazione robusta (L)**
- **Sessioni al posto del JWT:**
  - token casuale da 256 bit nel cookie `__Host-roomdate_session` (Secure, HttpOnly, SameSite=Lax);
  - nel DB solo il suo hash;
  - scadenza assoluta e per inattività;
  - revoca della singola sessione e "esci da tutti i dispositivi".
- **Password:**
  - hash Argon2id, con aggiornamento automatico dei vecchi bcrypt al login;
  - minimo 10 caratteri e blocco delle password più comuni (linee guida NIST 800-63B).
- **Tentativi di login:** limiti per IP e per account con attese crescenti e Cloudflare Turnstile, senza blocchi totali, con un messaggio unico "Credenziali non valide".
- **Operazioni sensibili:** password richiesta di nuovo per cambio password, cambio email ed eliminazione dell'account.
- **Email:** verifica dell'indirizzo e reset password con token monouso salvati come hash (serve D2).
- **Registro:** tabella `security_events` per login, errori, cambi password ed eliminazioni.

**M3.3 Autorizzazione e privacy (M)**
- Controlli centralizzati (`requireParticipant`, `requireListingOwner`) e test automatici "l'utente A prova ad accedere alle risorse di B" per ogni endpoint.
- Dati pubblici e privati separati, `is_public` rispettato ovunque; valutare ID non sequenziali per gli utenti.
- Blocco e segnalazione di utenti e annunci, con un ruolo admin minimo: i Termini promettono sospensioni che oggi non si possono applicare.
- GDPR: esportazione dei dati, cancellazione a cascata verificata, tempi di conservazione, controllo dei 18 anni.

**M3.4 Crittografia end-to-end reale (L)**
- **Due chiavi dalla password:** il browser ne ricava due diverse, con PBKDF2-SHA256 a 600k iterazioni nativo del browser. I parametri arrivano da `prelogin`, che per le email inesistenti restituisce un sale fittizio, così non si scopre chi è registrato.
  - `authKey` va al server, che la ri-hasha.
  - `wrapKey` non lascia mai il browser.

  Il server non può più aprire la chiave privata (S8).
- **Chiave privata protetta:** importata come `CryptoKey` non estraibile, tenuta in IndexedDB o in memoria e cancellata al logout (S15).
- **Cambio password:** la chiave privata si cifra di nuovo nel browser e il server la sostituisce in un'unica operazione.
- **Recupero:** chiave di recupero opzionale mostrata alla registrazione. Un reset senza quella chiave genera nuove chiavi e i messaggi precedenti diventano illeggibili, con avviso chiaro (D3).
- **Utenti esistenti:** migrazione al primo login grazie a `kdf_version`, oppure azzeramento se sono solo account di test (D5).
- *Opzionale:* impronta della chiave confrontabile tra i due utenti, contro la sostituzione delle chiavi pubbliche.

**M3.5 Tempo reale privato (S/M)**
- Canali `private-user-{id}` autorizzati da `realtime/auth`, con dentro solo ID e mai contenuti.
- "Sta scrivendo" su `private-conversation-{id}` tramite eventi client, autorizzati solo ai partecipanti. `/api/typing` viene eliminato, e con lui una chiamata serverless ogni 1,5 secondi.

**M3.6 Protezione del database (M)**
- Vincoli: email unica senza distinzione di maiuscole, CHECK su valori e lunghezze, NOT NULL, FK con `ON DELETE` esplicito.
- Indici su messaggi, annunci e partecipanti. Eliminare `id::text = $1`, che impedisce di usare gli indici (`get_chats.go:58-73`).
- Accessi e connessione:
  - ruolo applicativo con i soli permessi necessari;
  - ruolo separato per le migrazioni;
  - `sslmode=verify-full`.
- Dati e ripristino:
  - regione UE (D4);
  - ripristino a un punto nel tempo verificato con una prova reale;
  - branch per le anteprime.

**M3.7 Piattaforma e dipendenze (M)**
- **CSP senza `unsafe-inline`:** prima vanno tolti gli `<style>` inline in `Chatpage.jsx:320` e `index.html:56`. Poi `object-src 'none'`, `base-uri`, `form-action`, `frame-ancestors`, `Permissions-Policy`, e `img-src` aperto al dominio dello storage delle foto.
- **GitHub:** secret scanning con push protection, Dependabot, CodeQL, protezione del branch `main` (il README la dichiara ma va attivata).
- **CI:** `go vet`, `govulncheck`, `gosec`, `eslint`, `npm audit`, build.
- **Pulizia della cronologia git** (D7).

**M3.8 Test e verifica (M)**
- Test di integrazione Go su branch Neon usa e getta, con test di autorizzazione per ogni endpoint.
- Vitest per hook e form del frontend.
- Test end-to-end Playwright: registrazione → annuncio → contatto → chat cifrata → cambio password → messaggi ancora leggibili.
- Checklist OWASP ASVS livello 2 prima del rilascio.

---

## Decisioni aperte

- **D1 – Storage delle foto.** Consiglio **Vercel Blob**: stesso fornitore e caricamento diretto dal browser con token firmato. Se servono trasformazioni avanzate delle immagini, Cloudinary.
- **D2 – Email automatiche (verifica, reset, notifiche).** Consiglio **Resend**. Senza un fornitore non si può avere il reset della password.
- **D3 – Password dimenticata con la chat cifrata.** Consiglio chiave di recupero opzionale più reset che rigenera le chiavi (i messaggi vecchi si perdono, con avviso chiaro).
- **D4 – Regione del database.** Consiglio di **spostare Neon in UE** (Francoforte). L'alternativa è correggere l'informativa privacy.
- **D5 – Chi c'è oggi in produzione?** Sono utenti reali o account di test? Se sono di test, azzerarli semplifica molto M1.5 e M3.4.
- **D6 – Compatibilità.** Consiglio un punteggio reale e spiegabile. L'alternativa è toglierla.
- **D7 – Riscrivere la cronologia git pubblica.** Serve un force push per eliminare `.env` e `root.sql`. Da fare solo con via libera esplicito.

---

## Prossimo passo

Modulo consigliato per iniziare: **Modulo 0 (correzioni urgenti di sicurezza)**, perché le falle S2, S3 e S4 sono sfruttabili adesso in produzione. In alternativa, seguendo l'ordine delle fasi, si parte da M1.1. In entrambi i casi il cambio della password Neon conviene farlo subito dal pannello.
