# RoomDate

https://roomdate.vercel.app/
RoomDate is a web platform for finding rooms to rent and roommates. Users contact each other through a chat whose messages are end-to-end encrypted in the browser.

## System Architecture & Tech Stack

The platform operates on a decoupled full-stack architecture:

*   **Frontend:** React, Tailwind CSS, Vite
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

Vite proxies `/api` to the local Go server, so the frontend and the API share the same origin, as they do on Vercel.

### Backend structure

`api/index.go` is the Vercel function; `cmd/dev` serves the same application locally. Both use `server/`, which wires together the packages in `internal/`. (`server/` itself is not under `internal/`: Vercel builds `api/` as a package outside the module, and such a package cannot import `internal/` packages directly.)

* `internal/users`, `internal/listings`, `internal/chat` — one package per area, each with a `handlers.go` (HTTP), `service.go` (rules, validation, authorization) and `store.go` (SQL through pgx).
* `internal/httpx` — middleware applied to every request: request ID and structured logs, panic recovery, security headers, 64 KB body limit, cross-origin (CSRF) protection and JSON-only request bodies.
* `internal/auth` (session cookie and passwords), `internal/validate` (input rules and text normalization), `internal/apperr` (errors shown to users; everything else is logged and answered with a generic message), `internal/config`, `internal/db`, `internal/realtime`, `internal/storage` (listing photos on Cloudflare R2 or any S3-compatible storage).
* `shared/options.json` — the closed lists shared by backend and frontend: cities, occupations, lifestyle tags and listing amenities. The Go package `shared` embeds it and validates input against it; the frontend imports it in `src/api/options.ts`. To add a value, edit only this file (a new city, occupation or tag needs no migration; renaming or removing a key does, for the rows that use it).

User text is stored as typed (only surrounding spaces and invisible control characters are removed). It is never rendered as HTML: React escapes it on display.

Accounts, profiles and listings use the `/api/v1/` endpoints: camelCase JSON, errors as `{"error": {"code", "message", "fields"}}`.

* Accounts and profiles: `auth/session`, `auth/login`, `auth/logout`, `auth/register`, `auth/password`, `me`, `me/sessions`, `users/{id}`. Emails are stored in lowercase and matched ignoring case.
* Roommates: `roommates?city=&minBudget=&cursor=&limit=` lists the public profiles of people looking for a room, newest first, without the viewer's own profile.
* Listings: `listings` (list, create), `listings/{id}` (read, update, delete), `listings/{id}/active`, `me/listings`, and the photo endpoints `listings/{id}/images/uploads`, `listings/{id}/images`, `listings/{id}/images/{imageId}`. The public list takes `city`, `maxPrice`, `roomType`, `billsIncluded` and `sort` (`recenti`, `prezzo`, `prezzo-desc`).

Both lists answer `{"items": [...], "nextCursor": "…"}` and are paginated by cursor: pages hold 24 rows by default (at most 50, with `limit`), and `nextCursor` is null on the last one. A cursor belongs to one sort order, so changing `sort` starts again from the first page. Filtering, sorting and paging happen in the database (`internal/page` builds the cursors, migration `00005` adds the matching indexes); an unknown value in any parameter is answered with 400 and the field name, never ignored silently.

Public profiles show the age, never the birth date. For a signed-in viewer, profiles also carry `compatibility`: what the two profiles have in common (same city, budgets within 100 €, shared lifestyle tags) and whether one smokes and the other does not. There is deliberately no percentage score, so every item shown to users has a stated reason.

* Chat: `conversations` (list, start), `conversations/{id}/messages` (read, send), `conversations/{id}/read`, and `realtime/auth` (signature for private real-time channels). The conversation list carries the last message, the unread count and the other participant; messages are paginated newest-first, so opening a chat no longer loads its whole history. Every message the caller receives already contains the ciphertext and the key that caller can open.

Real-time events use Pusher **private** channels, which carry only IDs, never message content. Pusher accepts a subscription only with a signature from `POST /api/v1/realtime/auth`. The API signs only the caller's own channel and the channels of conversations they take part in.
* `private-user-<id>`: the server's "new message" notice (conversation and message ID), so a message wakes only its participants instead of every connected client.
* `private-conversation-<id>`: "typing" travels as a client event (`client-typing`, carrying only the sender's ID) straight between the participants' browsers, with no API call. In the Pusher dashboard, **App Settings → Enable client events** must be on, otherwise the typing indicator stays silent (everything else works).

Without the `PUSHER_*` variables the app still works: the chat page refreshes every few seconds instead. To try real time locally without a Pusher app, run a Pusher-compatible server such as [soketi](https://docs.soketi.app/) and set `PUSHER_HOST` / `VITE_PUSHER_HOST` (see `.env.example`).

### Frontend data layer

* `src/api/` (TypeScript) — `client.ts` makes every API call (the only other `fetch` is the photo upload to the storage in `listings.ts`); one file per area converts API responses into the types in `types.ts`; `hooks.ts` exposes TanStack Query hooks, which pages use instead of calling the API directly.
* Search filters live in the URL (`/ricerca?intent=&citta=&budget=&tipo=&spese=&ordina=`), the only source the queries read: a search is shareable and the back button steps through searches. Typing in the budget field replaces the current history entry instead of adding one, and the request waits until typing stops. A failed request is shown as an error with a "Riprova" button, never as "no results".
* `src/auth/` — `AuthProvider` holds the session verified by the server (no user copy in `localStorage`), `ProtectedRoute` guards private pages, `keyStorage.ts` manages the E2EE keys kept in the browser. A request that finds the session expired sends the user back to the login page; after a logout or account deletion, the page the user left sends them to the home page.
* `npm run typecheck` checks the TypeScript files; `npm run build` runs it before building.

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
