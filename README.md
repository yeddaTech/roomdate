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

## Security & Cryptography Infrastructure

Chat messages are encrypted and decrypted in the browser; the server stores and relays only ciphertext.

*   **Not zero-knowledge (yet):** keys are generated and used client-side, but the private key is wrapped with a key derived from the account password, which the server also receives at login. A server operator could therefore derive the wrapping key. Separating the two is planned in module M3.4.
*   **Asymmetric Encryption (RSA-OAEP):** Each user generates an RSA key pair upon registration. Public keys are exchanged to facilitate secure message transfer.
*   **Key Wrapping (AES-GCM & PBKDF2):** Private keys are never stored in plaintext on the server. They are wrapped using AES-GCM, with a key derived from the user's master password via PBKDF2, and stored as an encrypted vault in the database.
*   **Double Encryption Routing:** Messages are encrypted twice on the client—once utilizing the recipient's public key (for secure delivery) and once utilizing the sender's public key (to securely preserve local chat history).
*   **Local Secure Session:** Private keys are temporarily held in `sessionStorage` during active use. `localStorage` persists the encrypted vault, enabling a local cryptographic lock mechanism upon session expiration without exposing plaintext keys to the disk.

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

User text is stored as typed (only surrounding spaces and invisible control characters are removed). It is never rendered as HTML: React escapes it on display.

Accounts, profiles and listings use the `/api/v1/` endpoints: camelCase JSON, errors as `{"error": {"code", "message", "fields"}}`.

* Accounts and profiles: `auth/session`, `auth/login`, `auth/logout`, `auth/register`, `auth/password`, `me`, `users/{id}`.
* Listings: `listings` (list, create), `listings/{id}` (read, update, delete), `listings/{id}/active`, `me/listings`, and the photo endpoints `listings/{id}/images/uploads`, `listings/{id}/images`, `listings/{id}/images/{imageId}`.

Roommates and chat still use the legacy endpoints (`/api/get_roommates`, `/api/get_chats`, …) with plain-text errors, until their own modules move them to `/api/v1/`.

### Frontend data layer

* `src/api/` (TypeScript) — `client.ts` makes every API call (the only other `fetch` is the photo upload to the storage in `listings.ts`); one file per area converts API responses into the types in `types.ts`; `hooks.ts` exposes TanStack Query hooks, which pages use instead of calling the API directly.
* `src/auth/` — `AuthProvider` holds the session verified by the server (no user copy in `localStorage`), `ProtectedRoute` guards private pages, `keyStorage.ts` manages the E2EE keys kept in the browser. A request that finds the session expired sends the user back to the login page; after a logout or account deletion, the page the user left sends them to the home page.
* `npm run typecheck` checks the TypeScript files; `npm run build` runs it before building.

### Tests

`npm run test:api` runs the Go tests. Unit tests need nothing else; the integration tests in `server/` (every endpoint through the real router, middleware and database, with an in-memory photo storage) run when `TEST_DATABASE_URL` is set, and are skipped otherwise. They create a temporary `roomdate_test_…` database, migrate it from scratch and drop it at the end.

The S3 storage tests in `internal/storage` (signed uploads, copy, delete) run against a real S3-compatible server when `TEST_S3_ENDPOINT`, `TEST_S3_BUCKET`, `TEST_S3_ACCESS_KEY_ID` and `TEST_S3_SECRET_ACCESS_KEY` are set: a test bucket on R2, or a local [Garage](https://garagehq.deuxfleurs.fr/) node.

### Database migrations

Migrations are SQL files in `internal/db/migrations` (goose format), embedded in the `cmd/migrate` binary.

* `npm run db:status` shows which migrations are applied; `npm run db:migrate` applies the pending ones.
* To change the schema, add a new file such as `00003_short_description.sql` with `-- +goose Up` and `-- +goose Down` sections. Never edit a migration that has already run in production.
* `00001_baseline.sql` was reconstructed from the backend queries. Before running migrations on production for the first time, compare it with `pg_dump --schema-only --schema=roomdate_app` and fix any differences. The tool asks for confirmation before changing a non-local database.

### Listing photos (Cloudflare R2)

The browser resizes each photo (longest side 1600 px, JPEG, metadata such as GPS location removed) and uploads it straight to R2 with a URL signed by the API, so photos never pass through the Vercel functions. The file lands in `pending/`; the API then checks its size and real format, moves it to `listings/<id>/` and adds it to the listing. Without the `R2_*` variables the app works, but photo upload answers "not available".

One-time setup:

1. In Cloudflare → R2, create a bucket (choose the **EU jurisdiction** if data must stay in the EU; the S3 endpoint then contains `.eu.`).
2. Bucket → Settings → **Public Development URL** → Enable (or **Custom Domains** → Add, if you have a domain on Cloudflare). That address, without a trailing `/`, is `R2_PUBLIC_URL`. Cloudflare rate-limits `r2.dev` addresses and recommends them only for development: fine to start, but switch to a custom domain when traffic grows.
3. Bucket → Settings → **CORS Policy** → Add CORS policy → JSON tab, so browsers can upload from the site:
   ```json
   [{ "AllowedOrigins": ["https://roomdate.vercel.app"], "AllowedMethods": ["PUT"], "AllowedHeaders": ["content-type"], "MaxAgeSeconds": 3600 }]
   ```
   Add your preview or local origins (e.g. `http://127.0.0.1:5173`) to a separate development bucket, not to the production one.
4. Bucket → Settings → **Object Lifecycle Rules** → Add rule: prefix `pending/`, delete objects after 1 day (uploads that were never confirmed).
5. R2 overview → **API Tokens** → Manage → Create Account API token, with **Object Read and Write** on this bucket only. Its Access Key ID and Secret Access Key (shown only once) are `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`; the S3 endpoint, **without** the bucket name at the end, is `R2_ENDPOINT` (it contains `.eu.` for an EU bucket).
6. Add the five `R2_*` variables in Vercel → Settings → Environment Variables, then redeploy: variables only apply to new deployments. `vercel.json` already allows images from `*.r2.dev` and uploads to `*.r2.cloudflarestorage.com` in the Content Security Policy; with a custom domain, add it to `img-src`.

### Neon branches and Vercel previews

Create a Neon branch for development and use its connection string locally. In Vercel → Settings → Environment Variables, make sure the **Preview** `DATABASE_URL` points to a non-production branch (the Neon integration for Vercel can create one per preview deployment).

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
