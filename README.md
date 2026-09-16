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
* `internal/auth` (session cookie and passwords), `internal/validate` (input rules and text cleaning), `internal/apperr` (errors shown to users; everything else is logged and answered with a generic message), `internal/config`, `internal/db`, `internal/realtime`.

Accounts, sessions and profiles use the `/api/v1/` endpoints (`auth/session`, `auth/login`, `auth/logout`, `auth/register`, `auth/password`, `me`, `users/{id}`): camelCase JSON, errors as `{"error": {"code", "message", "fields"}}`. Listings, roommates and chat still use the legacy endpoints (`/api/get_listings`, `/api/get_chats`, …) with plain-text errors, until their own modules move them to `/api/v1/`.

### Frontend data layer

* `src/api/` (TypeScript) — `client.ts` is the only place that calls `fetch`; one file per area converts API responses into the types in `types.ts`; `hooks.ts` exposes TanStack Query hooks, which pages use instead of calling the API directly.
* `src/auth/` — `AuthProvider` holds the session verified by the server (no user copy in `localStorage`), `ProtectedRoute` guards private pages, `keyStorage.ts` manages the E2EE keys kept in the browser. A request that finds the session expired sends the user back to the login page.
* `npm run typecheck` checks the TypeScript files; `npm run build` runs it before building.

### Tests

`npm run test:api` runs the Go tests. Unit tests need nothing else; the integration tests in `server/` (every endpoint through the real router, middleware and database) run when `TEST_DATABASE_URL` is set, and are skipped otherwise. They create a temporary `roomdate_test_…` database, migrate it from scratch and drop it at the end.

### Database migrations

Migrations are SQL files in `internal/db/migrations` (goose format), embedded in the `cmd/migrate` binary.

* `npm run db:status` shows which migrations are applied; `npm run db:migrate` applies the pending ones.
* To change the schema, add a new file such as `00003_short_description.sql` with `-- +goose Up` and `-- +goose Down` sections. Never edit a migration that has already run in production.
* `00001_baseline.sql` was reconstructed from the backend queries. Before running migrations on production for the first time, compare it with `pg_dump --schema-only --schema=roomdate_app` and fix any differences. The tool asks for confirmation before changing a non-local database.

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
