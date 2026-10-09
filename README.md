# RoomDate

https://roomdate.vercel.app/
RoomDate is a web platform for finding rooms to rent and roommates. Users contact each other through a chat whose messages are end-to-end encrypted in the browser.

## System Architecture & Tech Stack

The platform operates on a decoupled full-stack architecture:

*   **Frontend:** React 19, Tailwind CSS v4, Vite, Radix primitives
*   **Backend:** Go (Golang) REST API
*   **Database:** PostgreSQL (hosted on Neon)
*   **Real-time Communication:** Pusher (WebSockets)
*   **Deployment & CI/CD:** Vercel (Live environment: [roomdate.vercel.app](https://roomdate.vercel.app/))

## Accounts and sessions

Signing in creates a session row in the database; the cookie only carries a 256-bit random token, and the database stores its SHA-256 hash. A session therefore can be revoked for real, and reading the database does not allow creating one.

* The cookie is `__Host-roomdate_session` over HTTPS (`roomdate_session` in local development, where the `__Host-` prefix is not allowed), HttpOnly, Secure and SameSite=Lax.
* Sessions expire 30 days after they start, or after 7 days without use. `GET /api/v1/me/sessions` lists the devices signed in, `DELETE /api/v1/me/sessions/{id}` closes one and `DELETE /api/v1/me/sessions` closes every other one. Changing the password closes them too.
* Passwords are hashed with Argon2id (19 MiB, 2 passes); accounts created earlier still carry a bcrypt hash and are upgraded silently at their next sign-in. A password needs at least 10 characters and is refused when it is a common one, a repeated character or sequence, or contains the name, the email or the site name — length matters, not mandatory symbols (NIST 800-63B).
* Wrong credentials always answer `Credenziali non valide`, whether the email exists or not. After five failed attempts for an email (twenty for a network) the wait grows, without ever locking an account: knowing somebody's address would otherwise be enough to lock them out.
* Deleting the account asks for the password again, and `security_events` records sign-ins, failures, password changes and deletions, with email and IP stored only as salted hashes.

Password reset by email does not exist yet: it needs an email provider (decision D2 in `piano_refactoring.md`). A forgotten password can be replaced only with the recovery key described below.

## Privacy and moderation (module M3.3)

* **Minimum age:** registration and profile changes require a birth date of at least 18 years ago, checked by the server (`validate.AgeAtLeast`; people born on 29 February turn a year older on 1 March in non-leap years). Migration `00011` only warns about existing accounts under 18, which have to be checked by hand.
  * Days follow the Italian calendar (`validate.Italy`, Europe/Rome), not the server clock. On Vercel the server clock is UTC, still on the previous day until 1 or 2 a.m. in Italy.
  * Everything that counts days uses the Italian day: the age shown on profiles (SQL `now() AT TIME ZONE 'Europe/Rome'`, never `CURRENT_DATE`, which depends on the session time zone and is UTC on Neon) and the registration form (`latestAdultBirthdate`, whatever the device's time zone).
  * The binary embeds the time zone database (`time/tzdata`). A test runs the app with the database session in two time zones on opposite sides of the world.
* **Private profiles:** a private or suspended profile is invisible to others everywhere: profile page, roommates list and new direct chats. A conversation that already exists goes on.
* **Blocks** (`GET /api/v1/me/blocks`, `PUT`/`DELETE /api/v1/me/blocks/{userId}`) work both ways, whoever blocked whom. Neither user can write to the other, open the real-time channel of their conversation, start a new chat, or see the other's profile and listings. Old messages stay readable. Conversations say `blocked: "by_me" | "by_other" | null`.
* **Reports** (`POST /api/v1/reports`) target a user or a listing, with a reason from `shared/options.json` (`reportReasons`, the same list as the `reports_reason_check` constraint) and optional details. From the chat, the reporter may attach up to 20 received messages, decrypted in their browser, because the server cannot read them otherwise. One open report per reporter and target, and at most 10 a day per user.
* **Moderation:** an administrator (`users.is_admin`) sees the reports at `/moderazione` (`GET /api/v1/admin/reports`) and can dismiss one, remove the listing, or suspend the account (`POST /api/v1/admin/reports/{id}/resolve`). Removing a listing hides it from everyone but its owner, who can then only delete it. Suspending an account closes its sessions and stops it from signing in or recovering the account; it also hides its profile and listings, and the other participants can no longer write in its conversations. Each action also closes the other open reports on the same listing or user. Both can be undone (`admin/users/{id}/unsuspend`, `admin/listings/{id}/restore`). Administrators are appointed from the command line, with the owner's connection string: `go run ./cmd/migrate -host ep-floral-violet-aldznrms grant-admin name@example.com` (and `revoke-admin`).
* **Data export** (`GET /api/v1/me/export`, "Scarica i miei dati" in the settings) returns everything stored about the account except message text, with no secrets: account, listings with photo URLs, conversations, sessions, security events, blocks, reports sent (with their attachments), and reports received (reason and outcome only, to protect the reporter). The browser then downloads each conversation's messages and decrypts them before saving the file.
* **Account deletion** removes the profile, listings and photos, sessions, blocks, and reports about the account. Reports it sent stay, without an author. The messages it sent stay, encrypted and without a name, with the other participants; a conversation left with no participants is deleted together with its messages.
* **Retention:** expired sessions are deleted at every sign-in (none outlives its 30 days). Security events are kept 90 days. Closed reports are kept 180 days, and are deleted whenever an administrator opens the list. Unconfirmed photo uploads expire after one day (R2 lifecycle rule).
* **Authorization tests:** `server/authorization_test.go` reads every route from `server/server.go` and states, for each one, the answer without a session and when another user tries someone else's resources. A new endpoint without a line in that table makes the test fail.

## Security & Cryptography Infrastructure

Chat messages are encrypted and decrypted in the browser; the server stores and relays only ciphertext, and it never receives the password.

*   **Two keys from the password:** before signing in, the browser asks `POST /api/v1/auth/prelogin` for the account's salt and iteration count, then derives a master key with PBKDF2-SHA256 (600,000 iterations) and splits it with HKDF into two independent keys. The *access key* goes to the server, which stores only its Argon2id hash; the *wrap key* never leaves the browser and encrypts the private key. A server operator therefore cannot open the private key. For an unknown email, `prelogin` answers with a fake but stable salt, so the response does not reveal who is registered.
*   **Accounts created before this change** (`kdf_version = 1`) sign in once as before, with the password: right after that, the browser derives the new keys, re-encrypts the private key and calls `POST /api/v1/auth/kdf`, in one operation. From the next sign-in the password stays in the browser. Until every old account has signed in again, `prelogin` answers differently for them.
*   **Password rules in the browser:** since the server only sees the access key, length, common passwords and personal data are checked by the browser (`src/auth/passwordPolicy.ts`, same rules and list as `internal/auth`, from `shared/common_passwords.txt`).
*   **Asymmetric Encryption (RSA-OAEP):** each user generates an RSA key pair upon registration. Public keys are exchanged to facilitate secure message transfer.
*   **Hybrid encryption:** each message is encrypted once with AES-256-GCM, and the message key is then encrypted with RSA-OAEP for every participant (table `message_keys`). Message length no longer depends on RSA, which stops at 190 bytes. Messages written before this change carry `format = 1`, one RSA copy per participant, and stay readable.
*   **Private key in the browser:** once opened, the private key is imported as a non-extractable `CryptoKey` and kept in IndexedDB: the browser can decrypt with it, but no script can read its content, and it survives a page reload. `localStorage` keeps only the encrypted vault and the public key. Signing out deletes all of them.
*   **Changing the password** re-encrypts the private key in the browser with the key derived from the new password (and a new salt); the server replaces hash, parameters and vault in a single statement.
*   **Recovery key (decision D3):** at registration the browser generates a 120-bit code (24 characters, Crockford alphabet) and shows it once. With HKDF it derives a *verification key*, whose Argon2id hash the server keeps, and a key that encrypts a second copy of the private key. Whoever forgets the password opens `/recupero`, enters email and code, and sets a new password: the copy is opened in the browser and re-encrypted with the new password, so no message is lost, and every open session is closed. The endpoints are `auth/recovery/start`, `auth/recovery/verify` and `auth/recovery/complete`; unknown emails get a fake but stable salt, and wrong codes slow down like wrong passwords. Accounts created earlier can create or replace the key from the settings page (`PUT /api/v1/me/recovery`), which invalidates the previous one.
*   **Not yet available:** password reset by email, which needs an email provider (decision D2). Without a recovery key, a forgotten password cannot be recovered: nobody, the server included, can open the private key.

## Local Development

Requirements: Go 1.25+, Node.js 20+ and a **development** PostgreSQL database (a dedicated Neon branch or a local Postgres). Never point local tools at the production database.

1. Copy `.env.example` to `.env.local` and fill in the values.
2. Install dependencies: `npm ci`
3. Create the schema: `npm run db:migrate`
4. Optional sample data: `npm run db:seed` — users such as `giulia@seed.roomdate.test`, password `roomdate-dev`
5. Start the API (`npm run dev:api`, on `http://127.0.0.1:8080`) and, in a second terminal, the frontend (`npm run dev`), then open `http://127.0.0.1:5173`.

Vite proxies `/api` to the local Go server, so the frontend and the API share the same origin, as they do on Vercel. In development, `/design-system` shows the interface components in both themes.

After pulling changes that touch `package.json`, run `npm ci` again: modules M2.1 moved the project to Tailwind v4 (no `tailwind.config.js` or `postcss.config.js` any more, the theme lives in `src/index.css`) and to React 19, and added the interface dependencies.

### Backend structure

`api/index.go` is the Vercel function; `cmd/dev` serves the same application locally. Both use `server/`, which wires together the packages in `internal/`. (`server/` itself is not under `internal/`: Vercel builds `api/` as a package outside the module, and such a package cannot import `internal/` packages directly.)

* `internal/users`, `internal/listings`, `internal/chat`, `internal/moderation` — one package per area, each with a `handlers.go` (HTTP), `service.go` (rules, validation, authorization) and `store.go` (SQL through pgx). `moderation` also owns the block rules that the other areas apply in their queries (`moderation.NotBlockedSQL`).
* `internal/httpx` — middleware applied to every request: request ID and structured logs, panic recovery, security headers, 64 KB body limit, cross-origin (CSRF) protection and JSON-only request bodies.
* `internal/auth` (session cookie and passwords), `internal/validate` (input rules and text normalization), `internal/apperr` (errors shown to users; everything else is logged and answered with a generic message), `internal/config`, `internal/db`, `internal/realtime`, `internal/storage` (listing photos on Cloudflare R2 or any S3-compatible storage).
* `shared/options.json` — the closed lists shared by backend and frontend: cities, occupations, lifestyle tags, listing amenities and report reasons. The Go package `shared` embeds it and validates input against it; the frontend imports it in `src/api/options.ts`. To add a value, edit only this file (a new city, occupation or tag needs no migration; renaming or removing a key does, for the rows that use it).

User text is stored as typed (only surrounding spaces and invisible control characters are removed). It is never rendered as HTML: React escapes it on display.

Accounts, profiles and listings use the `/api/v1/` endpoints: camelCase JSON, errors as `{"error": {"code", "message", "fields"}}`.

* Accounts and profiles: `auth/session`, `auth/login`, `auth/logout`, `auth/register`, `auth/password`, `me`, `me/sessions`, `users/{id}`. Emails are stored in lowercase and matched ignoring case.
* Roommates: `roommates?city=&minBudget=&cursor=&limit=` lists the public profiles of people looking for a room, newest first, without the viewer's own profile.
* Listings: `listings` (list, create), `listings/{id}` (read, update, delete), `listings/{id}/active`, `me/listings`, and the photo endpoints `listings/{id}/images/uploads`, `listings/{id}/images`, `listings/{id}/images/{imageId}`. The public list takes `city`, `maxPrice`, `roomType`, `billsIncluded` and `sort` (`recenti`, `prezzo`, `prezzo-desc`).

Both lists answer `{"items": [...], "nextCursor": "…"}` and are paginated by cursor: pages hold 24 rows by default (at most 50, with `limit`), and `nextCursor` is null on the last one. A cursor belongs to one sort order, so changing `sort` starts again from the first page. Filtering, sorting and paging happen in the database (`internal/page` builds the cursors, migration `00005` adds the matching indexes); an unknown value in any parameter is answered with 400 and the field name, never ignored silently.

Public profiles show the age, never the birth date. For a signed-in viewer, profiles also carry `compatibility`: what the two profiles have in common (same city, budgets within 100 €, shared lifestyle tags) and whether one smokes and the other does not. There is deliberately no percentage score, so every item shown to users has a stated reason.

* Chat: `conversations` (list, start), `conversations/{id}` (one conversation, as in the list), `conversations/{id}/messages` (read, send), `conversations/{id}/read`, and `realtime/auth` (signature for private real-time channels).
  * The conversation list carries the last message, the unread count, the caller's last read time (`lastReadAt`) and the other participant.
  * The other participant comes with `profileVisible`: the same rule as the profile page (public, not suspended, no block).
  * The listing a chat started from comes with its city, first photo, `mine` and `available`: whether the other participant can still see it (active, not removed, no block). `listingDeleted` says the chat started on a listing that was deleted since.
  * Messages are paginated newest-first, so opening a chat no longer loads its whole history. Every message the caller receives already contains the ciphertext and the key that caller can open.
  * **Sending again is safe.** A message sent again identical (same ciphertext and IV, both random per message) by the same sender in the same conversation within a day is the same message: the API answers 200 with the saved one instead of 201 and a duplicate, and does not notify the other participant again. "Riprova" after a lost response relies on this. An advisory lock per conversation (`pg_advisory_xact_lock`) serialises sends, so two simultaneous attempts cannot both pass the check. No migration is needed.

Real-time events use Pusher **private** channels, which carry only IDs, never message content. Pusher accepts a subscription only with a signature from `POST /api/v1/realtime/auth`. The API signs only the caller's own channel and the channels of conversations they take part in.
* `private-user-<id>`: the server's "new message" notice (conversation and message ID), so a message wakes only its participants instead of every connected client.
* `private-conversation-<id>`: "typing" travels as a client event (`client-typing`, carrying only the sender's ID) straight between the participants' browsers, with no API call. In the Pusher dashboard, **App Settings → Enable client events** must be on, otherwise the typing indicator stays silent (everything else works).

Without the `PUSHER_*` variables the app still works: the chat page refreshes every few seconds instead. To try real time locally without a Pusher app, run a Pusher-compatible server such as [soketi](https://docs.soketi.app/) and set `PUSHER_HOST` / `VITE_PUSHER_HOST` (see `.env.example`).

### Frontend data layer

* `src/api/` (TypeScript) — `client.ts` makes every API call (the only other `fetch` is the photo upload to the storage in `listings.ts`); one file per area converts API responses into the types in `types.ts`; `hooks.ts` exposes TanStack Query hooks, which pages use instead of calling the API directly.
* Search filters live in the URL (`/ricerca?intent=&citta=&budget=&tipo=&spese=&ordina=`), the only source the queries read: a search is shareable and the back button steps through searches. Typing in the budget field replaces the current history entry instead of adding one, and the request waits until typing stops. A failed request is shown as an error with a "Riprova" button, never as "no results".
* `src/auth/` — `AuthProvider` holds the session verified by the server (no user copy in `localStorage`), `ProtectedRoute` guards private pages, `keyStorage.ts` manages the E2EE keys kept in the browser. A request that finds the session expired sends the user back to the login page; after a logout or account deletion, the page the user left sends them to the home page.
* `npm run typecheck` checks the TypeScript files; `npm run build` runs it before building.

### Design system (module M2.1)

The interface is built on tokens and a small set of accessible components. Every page uses the tokens; modules M2.4–M2.7 redesign the pages on top of them.

* **Tokens** live in `src/index.css`, inside `@theme`: colours have names that say what they are for (`bg-surface`, `text-foreground-muted`, `bg-primary`, `border-control`), so a page never names a colour. Warm neutrals with a deep orange for actions; the orange-to-pink gradient (`bg-brand`) is kept for brand moments. Every pair was checked against WCAG 2.2 AA: 4.5:1 for text, 3:1 for field borders and the focus ring. Three radii (`rounded-control`, `rounded-card`, `rounded-full`), two shadows (`shadow-card`, `shadow-overlay`), Tailwind's 4px spacing grid, animations of 150–250 ms that stop under `prefers-reduced-motion`.
* **Dark theme ("notte prugna"):** the same tokens have dark values under `.dark`. It is a warm graphite tinted with violet, dark but not black, with the orange-to-pink brand on top.
  * Every text/background pair passes WCAG AA (4.5:1, and 3:1 for field borders and focus). An axe-core check of all 16 pages finds no contrast failure in either theme.
  * In the dark theme, actions are light orange with dark text, because white on orange does not reach 3:1.
  * **Applying it:** `public/theme.js` runs in `<head>` before the first paint, so there is no white flash. It is a file and not an inline script because of the CSP. It picks the choice saved in `localStorage` (`roomdate-theme`), otherwise the device's `prefers-color-scheme`, and also sets `<meta name="theme-color">`.
  * `ThemeProvider` (`src/theme/`) then follows changes from the device, from other tabs and from the user. Transitions are paused while switching.
  * **Controls:** a sun/moon toggle in every header (`ThemeToggle`, `aria-pressed`). Chiaro/Scuro/Automatico (`ThemeSelect`, native radio buttons) sits in the account menu, the phone menu and the footer.
  * `.light` forces the light theme on part of a page (the `/design-system` showcase).
* **Colours in pages:** every page uses the tokens. The hand-written neutrals, oranges and reds were replaced with a mechanical mapping: `bg-white` → `bg-surface`, `text-neutral-900` → `text-foreground`, `text-orange-500` → `text-primary`, `bg-neutral-900 text-white` → `bg-foreground text-background`, and so on. New code must not use raw `neutral`/`white`/`orange` classes for surfaces and text.
  * The exceptions are colours that must not change with the theme: white glass and dark scrims on photos and gradients (`bg-white/20`, `bg-neutral-900/70`), the brand gradients, and the footer (`bg-footer`, dark in both themes).
* **Components** in `src/components/ui/`: `Button`, `Field` with `Input`/`Textarea`/`Select` (label, hint and error tied to the control), `PasswordInput`, `Checkbox`, `Chip`, `Card`, `Badge`, `Alert`, `Avatar`, `Dialog`, `Sheet`, `Tabs`, `Toaster`, `Skeleton`, `EmptyState`. Dialogs, sheets and tabs are Radix primitives: focus trap, Esc, focus returned to the opener, arrow keys between tabs. `cn()` merges classes so a `className` passed in wins over the default one.
* **Feedback instead of `alert`/`confirm`:** `toast.success(...)` / `toast.error(...)` (sonner) for the outcome of an action, and `useConfirm()` for a question — an AlertDialog that does not close on an outside click, starts focused on "Annulla" and returns a promise. The 23 native `alert`, `confirm` and `prompt` calls are gone; an E2E test fails if any of them comes back. The confirm dialog's code is loaded after the page, so Radix does not weigh on the first load.
* **Fonts** (DM Sans and Playfair Display) are served by the site itself through Fontsource, imported in `main.jsx`. They used to come from Google Fonts and the CSP blocked them, so the site never showed them (anomaly F20); now no visitor IP reaches Google and `font-src` is `'self'`.
* **Page title and meta:** `<PageMeta title=… noindex />`. React 19 hoists these into `<head>` by itself, so react-helmet-async is gone.
* `/design-system` shows every component in both themes, side by side. It exists only in development: the production build has no such route.

### Layouts and navigation (module M2.2)

* **Routing** is a data router (`createBrowserRouter` in `App.jsx`). Every page sits in one of three layouts in `src/components/layout/`:
  * `PublicLayout`: header, content, footer. It is used by home, search, detail pages, guide, legal pages and the 404.
  * `AppLayout`: header only, with the pages behind `ProtectedRoute`. It is used by dashboard, chat, settings and moderation.
  * `AuthLayout`: a minimal header with "Torna al sito" and a link to the other form. It is used by login, registration and recovery.

  The legal pages use the public layout, because they need the same navigation. A route's `handle` tweaks its layout: `{ fullHeight: true }` makes the chat fill the screen without page scroll, and `{ authSwitch }` sets the header link on the auth pages.
* **One header** (`SiteHeader`) replaces the nine copies each page used to carry, each with different links.
  * **Desktop:** Cerca, Preferiti (signed-in users), Chat with an unread badge, Come funziona, and an account menu. The account menu is a disclosure, not `role="menu"`: a button with `aria-expanded` and a list of links. It closes with Esc (focus back on the button), an outside click, tabbing out, or a page change.
  * **Phone:** a side panel holds the rest. Its code (Radix Dialog) is fetched when the browser is idle, not with the page.
* **Bottom tab bar on phones** (`MobileTabBar`): Home, Cerca, Preferiti, Chat, Profilo/Accedi.
  * Content above it gets bottom padding (`tabBarPadding`), so the bar never covers a button.
  * A page can hide the bar with `useHideTabBar(true)`. The chat does this while a conversation is open (`/chat/7`), to leave room for messages and the keyboard.
  * The bar is absent on auth pages.
* **Unread badge:** `GET /api/v1/me/unread` returns `{ "conversations": n }`, the number of conversations with messages the user has not read. Its query key sits under `conversations`, so reading or receiving a message refreshes it; it also refreshes every minute.
* **Errors:** `RouteError` is the `errorElement` of each layout, so a crash in a page shows a message inside the layout, with the navigation still there.
  * If the page's code fails to load (the site was updated since the tab was opened), it reloads once by itself, then offers "Ricarica la pagina".
  * Unknown URLs render the 404 (`noindex`) inside the public layout. `/register` redirects to `/registrati`.
* **Scroll and focus:**
  * `ScrollRestoration`: back and forward return to where the user was, and a new page starts at the top. Search filters use `preventScrollReset`, so changing one does not jump to the top.
  * After every navigation, focus moves to the main content (`#contenuto`) so screen readers announce the new page. "Salta al contenuto" is the first Tab stop.
* **iOS safe areas:** `viewport-fit=cover` plus `env(safe-area-inset-*)` padding on the header, tab bar, side panel and chat composer.

### Forms, sign-in and registration (module M2.3)

* **Forms** use react-hook-form with zod schemas, through `zodResolver`.
  * The field rules live in `src/forms/rules.ts` and mirror the server's: names up to 50 characters, a valid email, at least 18 years old, a city from the list, a budget from 0 to 20,000 €, a bio up to 1,000 characters. The password rules stay in `src/auth/passwordPolicy.ts`, because the password never reaches the server.
  * Import zod only from `src/forms/zod.ts`. It is the "mini" build, 19 KB instead of 80, with `jitless` switched on. The full build compiles schemas with `new Function`, which the CSP blocks; this was checked on the production build.
  * Errors show when you leave a field. After that, and after a failed submit, they update while you type.
  * An error sent back by the server clears as soon as the field is edited. Otherwise it would disappear only when you click the button, which would jump away from the pointer.
* **Registration** (`/registrati`) has four steps: account → role → profile → lifestyle.
  * Each step is its own form. Data builds up in memory and goes to the server in a single request at the end.
  * The step is in the URL (`?passo=2`), so the browser's and the phone's back button return to the previous step with the data still there. A reload starts again from step 1: the password is never saved in `sessionStorage`.
  * If the server rejects a field, the page jumps back to that field's step, shows the message and focuses the field.
  * Terms and Privacy open in a new tab, so nothing typed is lost. An email typo in a common domain gets a hint ("Forse intendevi …@gmail.com?"): there is no email verification yet, so a mistyped address would be hard to recover.
  * Once the account exists, the recovery key is shown while the browser signs in. At the end, users looking for a room land on the search, users letting one on their profile, or on the protected page they came from.
* **Sign-in** (`/accedi`) shows errors inside the page, not as toasts. It returns to the page that asked for a login. Users who already have a session are sent on from `/accedi` and `/registrati`. The email typed there carries over to `/recupero` and back.
* **New components** in `src/components/ui/`:
  * `PasswordInput`: a "Mostra" button instead of a second field to retype the password, and hidden again on submit;
  * `Alert`: a message inside the page, announced to screen readers when it is an error;
  * `Checkbox`: a native checkbox with its error text linked.

  `bg-brand-deep` is the brand gradient for panels with white text: `bg-brand` with white text is below 3:1.

### Search, home and favorites (module M2.4)

* **Favorites:** migration `00012` adds `saved_listings`, keyed by (user, listing). Deleting either the account or the listing cascades to it.
  * `PUT` / `DELETE /api/v1/me/saved-listings/{id}` save and remove a listing. Both can be repeated safely.
  * Only listings the user can see can be saved.
  * `GET /api/v1/me/saved-listings?cursor=` lists them, most recently saved first, with the same visibility rules as search: inactive, removed or blocked listings, and those of suspended owners, are hidden. They stay saved, though, and come back if they become visible again.
  * Every listing in lists and in the detail carries `saved`, which is `false` without a session. The data export includes the favorites.
* **Cities:** `GET /api/v1/listings/cities` returns the cities that have visible listings, with their counts, busiest first. The home page uses it, so it never shows a city with no rooms.
* **Search** (`/ricerca`): the URL is still the only source of the filters.
  * Desktop has a filter column; phones have a "Filtri" button, showing how many filters are active, that opens a bottom sheet. Both use the same form (`SearchFilters`), and changes apply at once.
  * On phones, active filters also show as chips that remove themselves when tapped. Sorting is in the results bar.
  * The next page loads when you get near the end of the list (`LoadMore`, IntersectionObserver), and a button stays for keyboard users.
  * If a later page fails, the results already shown stay on screen, with a "Riprova" button.
* **Cards:** `ListingCard` has the photo, price, place and features, plus a heart (`SaveButton`, `aria-pressed`, with the listing title in its name). The whole card links to the detail through the title link, stretched over the card.
  * The first cards load their photo at once, the rest lazily.
  * Tapping the heart updates every cached list and the detail straight away, and rolls back if the server refuses.
  * Without a session the heart leads to the login page and then back.
  * `RoommateCard` is the card for the "Coinquilini" tab.
* **Favorites page** (`/preferiti`, in the bottom bar and in the header for signed-in users). Removing a listing there offers "Annulla".

### Listing and profile pages (module M2.5)

* **Gallery** (`Gallery`): on phones, a strip you swipe edge to edge (native scroll-snap, no library), with a "2 / 5" counter. On desktop, a mosaic with the first photo large.
  * Tapping a photo opens every photo full screen (Radix Dialog): swipe, the arrow buttons (always visible, not only on hover) or the keyboard arrows move between them. The counter is announced, and Esc closes.
  * On close, focus returns to the photo you opened. At either end the arrows use `aria-disabled` rather than `disabled`, so they keep focus.
  * Each photo's alt text is "Foto 2 di 5: title".
* **Amenities** have an icon each (`AmenityList`). A new amenity in `shared/options.json` without an icon shows a check mark.
* **Contact on phones:** `ContactBar` puts the main action at the bottom of the screen in place of the tab bar (`useHideTabBar`, which now also works in the public layout): price, heart and "Contatta" on a listing, "Scrivi a …" on a profile. On desktop the same actions sit in a sticky side column.
* **"Per te"** (`ListingFit`): for a signed-in viewer, the listing compared with their profile, e.g. "94 € sopra il tuo budget di 650 €" or "Nella città che cerchi".
* **Compatibility, explained** (`CompatibilityDetails`), item by item with both people's real figures: same or different city, similar or different budget ("il tuo è 650 €, il suo 450 €"), shared habits, and the smoking warning.
  * It says how the comparison works: no score, only city, budget (similar within 100 €) and habits both people entered.
  * It suggests filling in the viewer's profile when data is missing.
  * Without a session there is an invitation to sign in. On your own profile, a note says this is how others see it.
* **"Indietro"** (`BackLink`) goes back to the previous page of the site, such as the search with its filters. On a page opened from an outside link it goes to the search instead of leaving the site.
* **Errors:** a missing listing or profile ("non trovato") and a server error (with "Riprova") are shown differently.

### Chat (module M2.6)

* **Every conversation has an address:** `/chat` is the list, `/chat/7` the open conversation. Phones show one of the two; the arrow and the phone's own back button return to the list, and a conversation opened from a link goes to the list instead of leaving the site. On phones the list keeps its scroll position.
* **Messages** (`MessageThread`, `src/chat/thread.ts`):
  * They are grouped by day, with the day pinned at the top while scrolling.
  * Within a day, consecutive messages from the same person less than 5 minutes apart form one group, with one avatar and one time.
  * Times use the viewer's local time.
* **"Nuovi messaggi":** on opening a conversation, a divider sits before the first message from the other person that arrived after the last read.
  * Its position comes from `lastReadAt` as the server returns it at that moment, not from the copy in the list or in the cache, which may predate the new messages.
  * The conversation is shown once that is known, already scrolled to the divider. The divider does not move afterwards.
* **Read state:** a conversation is marked read only while the page is in view, the messages can be decrypted and the conversation has come back from the server.
  * It is marked again at every new last message.
  * The counter drops to zero at once in the loaded data, because a request already in flight would bring back the old number.
  * A hidden tab or a locked chat keeps the unread badge.
* **Scrolling:**
  * The conversation opens on the first new message, or at the bottom.
  * A new message keeps the reader at the bottom if they were there. Otherwise a "1 nuovo messaggio ↓" button appears, instead of yanking them down.
  * Older messages load by themselves at the top, and the message being read stays in place.
* **Sending** (`useOutbox`):
  * A message appears at once with "Invio…", then "Inviato" under the latest one.
  * If it fails, it stays in place with the reason, "Riprova" and "Elimina".
  * The retry sends the same ciphertext, so the API recognises it and does not duplicate it.
  * Offline, the message fails at once ("Sei offline") and goes out by itself when the connection returns.
  * When the server refuses a message (block, suspended account), its reason is shown and the conversation is reloaded, so it shows as closed.
* **Real time** (`useChatRealtime`):
  * New messages are added to the ones already loaded (`pullLatestMessages`) instead of reloading every page.
  * "Sta scrivendo" shows under the name, as dots in the conversation and in the list. It disappears as soon as the message arrives.
  * Without Pusher, or while its connection is down, the chat refreshes every 5 seconds.
  * After a reconnection, or when the tab comes back into view, the chat reloads.
* **Listing card** at the top of the conversation: photo, title, price and city, linking to the listing.
  * For the other person, "Non più disponibile" without a link once the listing is no longer visible to them.
  * For the owner, "Il tuo annuncio", plus "non visibile agli altri" when it is hidden from others.
  * "L'annuncio di questa conversazione è stato eliminato" when it was deleted.
  * The other person's name links to their profile only when `profileVisible` is true.
* **Composer:**
  * With a mouse and keyboard, Enter sends and Shift+Enter starts a new line. With a finger, Enter starts a new line and the button sends, as in messaging apps.
  * Enter during composition (some Asian and Android keyboards) never sends.
  * The field grows up to about six lines. Messages are capped at 4,000 characters, with a counter near the limit.
  * Drafts are kept per conversation, in memory only.
  * Suggested questions appear when someone writes about a listing that is not theirs and has not written yet.
* **Phone keyboard:** on iPhone and on Android Chrome 108+, the keyboard covers the page without shrinking it.
  * The full-height layout follows the visual viewport (`useVisualViewport`): its height, and its offset when iOS pans the view. So the header and the composer stay visible.
  * While the keyboard is open, the listing card steps aside.
  * Pinch zoom is left alone.
  * The send button does not take focus, so the keyboard stays open between messages.
* **Unlocking** (`UnlockPanel`) replaces the old blurred overlay. There are two cases:
  * **The encrypted key is on the device:** a password form that password managers recognise, with a hidden username field. It shows a clear error on a wrong password and links to the recovery key.
  * **The key is missing**, for example after the site data was cleared: "Esci e accedi di nuovo" signs out (`logout({ signInAgain: true })`) and returns to the chat after sign-in.
* **Accessibility:**
  * Each message carries its author and time for screen readers.
  * Incoming messages and "sta scrivendo" are announced politely.
  * The message area can be focused and scrolled with the keyboard.
  * The unread count on the Chat links is read after the label ("Chat, 2 conversazioni con messaggi non letti").

### Tests

`npm run test:api` runs the Go tests. Unit tests need nothing else; the integration tests in `server/` (every endpoint through the real router, middleware and database, with an in-memory photo storage) run when `TEST_DATABASE_URL` is set, and are skipped otherwise. They create a temporary `roomdate_test_…` database, migrate it from scratch and drop it at the end.

The S3 storage tests in `internal/storage` (signed uploads, copy, delete) run against a real S3-compatible server when `TEST_S3_ENDPOINT`, `TEST_S3_BUCKET`, `TEST_S3_ACCESS_KEY_ID` and `TEST_S3_SECRET_ACCESS_KEY` are set: a test bucket on R2, or a local [Garage](https://garagehq.deuxfleurs.fr/) node.

### Database migrations

Migrations are SQL files in `internal/db/migrations` (goose format), embedded in the `cmd/migrate` binary.

* `npm run db:status` shows which migrations are applied; `npm run db:migrate` applies the pending ones.
* To change the schema, add a new file such as `00003_short_description.sql` with `-- +goose Up` and `-- +goose Down` sections. Never edit a migration that has already run in production.
* `00001_baseline.sql` is a copy of the production schema (checked against `pg_dump --schema-only --schema=roomdate_app` in September 2026): user IDs are UUIDs, and some columns are nullable or have `VARCHAR` limits that the API validation follows. The tool asks for confirmation before changing a non-local database.
* Migrations run as the schema owner, never with the app's role (see below). Take the owner's connection string from Neon → **Connect** (branch `production`, role `neondb_owner`). The dialog may show another branch or project, so check that its host is the one in Vercel's `DATABASE_URL` (Production). Create a Neon backup branch first, then run `go run ./cmd/migrate -host <expected host> up`: with `-host` (for example `ep-floral-violet-aldznrms`) the tool refuses to touch any other database. It always removes `-pooler` from Neon hosts, because migrations need a direct connection.

### Database access, TLS and restore (module M3.6)

* **Constraints:** besides foreign keys and unique emails, the database enforces with CHECK constraints the same limits as the code (roles, budget 0–20,000 €, text lengths, key-derivation parameters, message format). Migration `00010` adds each one only when every existing row satisfies it, and warns otherwise: a violated constraint would block any update to those rows.
* **TLS:** every connection to a non-local host uses TLS with certificate and host-name verification (`verify-full`), whatever the connection string says. Neon's strings use `sslmode=require`, which encrypts but does not check the certificate.
* **Two roles.** The app connects as `roomdate_app`, which can only read and write rows: no DDL, no `TRUNCATE`, no access to `public.goose_db_version`. Migrations run as the schema owner (`neondb_owner`). The integration tests run every endpoint as such a restricted role, so a missing privilege shows up as a failing test. One-time setup:
  1. Take the **owner** connection string from Neon → Connect (branch `production`, role `neondb_owner`) and run `go run ./cmd/migrate -host ep-floral-violet-aldznrms grant-app roomdate_app`. The command creates the role with a random password and grants only row privileges. Tables created later by the owner get the same privileges automatically. It checks that every table actually received them, and changes nothing if it finds a problem. **Do not create the role from Neon → Roles**: roles made there belong to `neon_superuser`, which can read and write every table and create roles and databases. `grant-app` refuses such roles.
  2. The command prints the app's connection string once (pooled host, `roomdate_app` role and its password). Paste it into Vercel → Settings → Environment Variables → `DATABASE_URL` (Production), keep it nowhere else, then redeploy and check that `/api/v1/health`, login and the chat work. To roll back, put the owner's pooled string back and redeploy.
  3. From then on, Vercel's `DATABASE_URL` cannot run migrations: use the owner string from Neon, always with `-host`. Running `grant-app` again only refreshes the privileges and does not change the password. If the password is lost, run `grant-app` with a new name (for example `roomdate_app2`) and switch Vercel to it. Then drop the old role from the Neon SQL Editor with `DROP OWNED BY roomdate_app; DROP ROLE roomdate_app;`.
* **Region:** the database is in Frankfurt (`eu-central-1`) and `vercel.json` runs the functions in `fra1`: the API and its data stay in the EU, and queries no longer cross the Atlantic.
* **Restore drill** (point-in-time restore, to repeat every few months): Neon → **Branches** → **Create branch** → from `production`, *point in time* one hour ago. In the SQL Editor on the new branch, run
  `SELECT (SELECT count(*) FROM roomdate_app.users) users, (SELECT count(*) FROM roomdate_app.listings) listings, (SELECT count(*) FROM roomdate_app.messages) messages, (SELECT max(created_at) FROM roomdate_app.messages) last_message;`
  and compare with the same query on `production`: the numbers must match, except for what was written in the last hour. Then delete the branch. The restore window depends on the Neon plan (history retention setting).

### Listing photos (Cloudflare R2)

The browser resizes each photo (longest side 1600 px, JPEG, metadata such as GPS location removed) and uploads it straight to R2 with a URL signed by the API, so photos never pass through the Vercel functions. The file lands in `pending/`; the API then checks its size and real format, moves it to `listings/<id>/` and adds it to the listing. Without the `R2_*` variables the app works, but photo upload answers "not available".

One-time setup:

1. In Cloudflare → R2, create a bucket (choose the **EU jurisdiction** if data must stay in the EU; the S3 endpoint then contains `.eu.`). Bucket names allow only lowercase letters, digits and hyphens: `R2_BUCKET` must match exactly (`roomdate-foto`, not `roomdate_foto`), otherwise uploads fail with a CORS error.
2. Bucket → Settings → **Public Development URL** → Enable (or **Custom Domains** → Add, if you have a domain on Cloudflare). That address, without a trailing `/`, is `R2_PUBLIC_URL`. Cloudflare rate-limits `r2.dev` addresses and recommends them only for development: fine to start, but switch to a custom domain when traffic grows.
3. Bucket → Settings → **CORS Policy** → Add CORS policy → JSON tab, so browsers can upload from the site:
   ```json
   [{ "AllowedOrigins": ["https://roomdate.vercel.app"], "AllowedMethods": ["PUT"], "AllowedHeaders": ["content-type"], "MaxAgeSeconds": 3600 }]
   ```
   Add your preview or local origins (e.g. `http://127.0.0.1:5173`) to a separate development bucket, not to the production one. Test uploads from `https://roomdate.vercel.app` itself: the per-deployment addresses opened by Vercel's **Visit** button are different origins and are rejected.
4. Bucket → Settings → **Object Lifecycle Rules** → Add rule: prefix `pending/`, delete objects after 1 day (uploads that were never confirmed).
5. R2 overview → **API Tokens** → Manage → Create Account API token, with **Object Read and Write** on this bucket only. Its Access Key ID and Secret Access Key (shown only once) are `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`; the S3 endpoint, **without** the bucket name at the end, is `R2_ENDPOINT` (it contains `.eu.` for an EU bucket).
6. Add the five `R2_*` variables in Vercel → Settings → Environment Variables, then redeploy: variables only apply to new deployments. `vercel.json` already allows images from `*.r2.dev` and uploads to `*.r2.cloudflarestorage.com` in the Content Security Policy; with a custom domain, add it to `img-src`.

### Neon branches and Vercel previews

Create a Neon branch for development and use its connection string locally. In Vercel → Settings → Environment Variables, make sure the **Preview** `DATABASE_URL` points to a non-production branch (the Neon integration for Vercel can create one per preview deployment). A branch copied from `production` contains real personal data: prefer an empty branch, migrated and filled with `npm run db:seed`.

## Development Workflow

To maintain code quality and stability, direct pushes to the `main` branch are strictly prohibited. All contributions must go through a Pull Request (PR) review process.

### For Contributors

If you wish to contribute to the project, please follow the standard Fork & Pull Request workflow:

1. **Fork the repository:** Click the "Fork" button at the top right of this page to create a copy of the project in your own GitHub account.
2. **Clone your fork locally:**
   ```bash
   git clone [https://github.com/YOUR_USERNAME/roomdate.git](https://github.com/YOUR_USERNAME/roomdate.git)
   cd roomdate
   ```
3. **Create a feature branch:** Never work directly on `main`.
   ```bash
   git checkout -b feature/your-feature-name
   ```
4. **Commit your changes:** Ensure your code is well-tested and adheres to the project's architectural standards.
   ```bash
   git add .
   git commit -m "feat: description of the feature implemented"
   ```
5. **Push to your fork:**
   ```bash
   git push origin feature/your-feature-name
   ```
6. **Open a Pull Request:** Navigate back to the original `yeddaTech/roomdate` repository on GitHub and open a Pull Request. The lead maintainer will review your code. Once approved, it will be merged into the production branch and automatically deployed via Vercel.

### For Approved Maintainers
Even approved core contributors must operate on separate branches (e.g., `feature/...` or `fix/...`) and submit a Pull Request. Merges to `main` require at least one approving review to pass the branch protection rules.

## Author

Developed by Younesse Eddassouli. The project serves as an advanced implementation of secure full-stack system architecture (Go/React) and applied cryptography.
