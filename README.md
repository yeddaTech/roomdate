# RoomDate

https://roomdate.vercel.app/
RoomDate is a robust web platform designed to facilitate roommate and room-rental matching. Built with a primary focus on data privacy, the application features a custom Zero-Knowledge End-to-End Encrypted (E2EE) messaging architecture.

## System Architecture & Tech Stack

The platform operates on a decoupled full-stack architecture:

*   **Frontend:** React, Tailwind CSS, Vite
*   **Backend:** Go (Golang) REST API
*   **Database:** PostgreSQL (hosted on Neon)
*   **Real-time Communication:** Pusher (WebSockets)
*   **Deployment & CI/CD:** Vercel (Live environment: [roomdate.vercel.app](https://roomdate.vercel.app/))

## Security & Cryptography Infrastructure

A major technical focal point of this project is its enterprise-grade security model, designed to ensure that user communications remain strictly confidential and inaccessible to unauthorized parties.

*   **Zero-Knowledge Architecture:** The server acts strictly as a relay and storage facility for ciphertext. Keys are derived and managed exclusively client-side.
*   **Asymmetric Encryption (RSA-OAEP):** Each user generates an RSA key pair upon registration. Public keys are exchanged to facilitate secure message transfer.
*   **Key Wrapping (AES-GCM & PBKDF2):** Private keys are never stored in plaintext. They are wrapped using AES-GCM, with a key derived from the user's master password via PBKDF2, and stored as an encrypted vault in the database.
*   **Double Encryption Routing:** Messages are encrypted twice on the client—once utilizing the recipient's public key (for secure delivery) and once utilizing the sender's public key (to securely preserve local chat history).
*   **Local Secure Session:** Private keys are temporarily held in `sessionStorage` during active use. `localStorage` persists the encrypted vault, enabling a local cryptographic lock mechanism upon session expiration without exposing plaintext keys to the disk.

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
