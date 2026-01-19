# VBS Volunteer Hour Tracker

Web-based volunteer hour tracking system using QR code lanyards.

## Quick Start
See [docs/SETUP.md](docs/SETUP.md)

## Features
- QR code lanyard check-in/out
- Real-time admin dashboard
- Multi-form type support (OCPS, NJHS, NHS)
- Offline-capable PWA

## Stack
- Frontend: React + Vite
- Backend: Firebase (Firestore, Functions, Storage)
- PDF: pdf-lib
```

### 2. docs/PRD.md
- Copy the full PRD document I just created

### 3. .gitignore
```
# Dependencies
node_modules/
.npm/

# Environment
.env
.env.local
.env.production

# Firebase
.firebase/
firebase-debug.log

# Build
dist/
build/

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Secrets
secrets/
*.pem
service-account-key.json
