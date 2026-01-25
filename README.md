# VBS Volunteer Hour Tracker

Web-based volunteer hour tracking system using QR code lanyards for VBS (Vacation Bible School) events.

## Overview

This system eliminates manual time entry and Excel calculations by using QR code lanyards for automatic check-in/check-out, reducing admin time from 5-6 hours/week to 1-2 hours/week.

### Key Features

- 📱 QR code lanyard check-in/out
- 📊 Real-time admin dashboard
- 📄 Multi-form type support (OCPS, NJHS, NHS, Private schools)
- 🔄 Offline-capable Progressive Web App (PWA)
- ⏱️ Automatic hour calculation and rounding
- 🚩 Smart flagging of early arrivals and late stays
- 📥 Batch PDF form generation
- 📲 **Mobile-responsive design** with hamburger menu navigation and touch-optimized layouts

## Tech Stack

- **Frontend**: React 18 + Vite + TailwindCSS
- **Backend**: Firebase (Firestore, Cloud Functions, Storage, Hosting)
- **PDF Generation**: pdf-lib
- **QR Scanning**: html5-qrcode
- **Offline Storage**: IndexedDB (via idb)

## Project Structure

```
vbs-volunteer-tracker/
├── frontend/               # React frontend application
│   ├── public/            # Static assets
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── utils/         # Utility functions
│   │   ├── contexts/      # React contexts
│   │   ├── App.jsx        # Main app component
│   │   └── main.jsx       # Entry point
│   ├── package.json
│   └── vite.config.js
├── functions/             # Firebase Cloud Functions
│   ├── src/
│   │   ├── checkIn.js     # Check-in function
│   │   ├── checkOut.js    # Check-out function
│   │   └── generateForms.js # Form generation
│   ├── index.js
│   └── package.json
├── docs/
│   ├── PRD.md             # Product Requirements Document
│   └── CLAUDE.md          # Development guide
├── firebase.json          # Firebase configuration
├── firestore.rules        # Firestore security rules
├── firestore.indexes.json # Firestore indexes
└── storage.rules          # Storage security rules
```

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Firebase CLI: `npm install -g firebase-tools`
- A Firebase project (create one at [console.firebase.google.com](https://console.firebase.google.com))

### 1. Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd vbs-volunteer-tracker

# Install frontend dependencies
cd frontend
npm install

# Install functions dependencies
cd ../functions
npm install

cd ..
```

### 2. Firebase Setup

```bash
# Login to Firebase
firebase login

# Initialize Firebase (if not already done)
firebase init

# Select your Firebase project
firebase use --add
```

### 3. Configure Environment Variables

```bash
# Copy the example environment file
cd frontend
cp .env.example .env

# Edit .env and add your Firebase configuration
# Get these values from Firebase Console > Project Settings > Your apps > Web app
```

Your `.env` file should look like:

```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 4. Run Development Server

```bash
# Start frontend dev server
cd frontend
npm run dev

# In a separate terminal, start Firebase emulators (optional)
cd ..
firebase emulators:start
```

Visit `http://localhost:3000` to see the app.

## Deployment

### Deploy to Firebase

```bash
# Build frontend
cd frontend
npm run build

# Deploy everything
cd ..
firebase deploy

# Or deploy specific services
firebase deploy --only hosting        # Frontend only
firebase deploy --only functions      # Functions only
firebase deploy --only firestore:rules # Firestore rules only
```

## Development Workflow

### Frontend Development

```bash
cd frontend

# Run dev server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

### Cloud Functions Development

```bash
cd functions

# Test functions locally with emulator
npm run serve

# Deploy functions
npm run deploy

# View function logs
npm run logs
```

## Key Components

### AV Scanner (`/scan/:eventId`)

- Used by Adult Volunteers for morning lanyard distribution
- Scans QR codes to check in students
- Shows last 5 scans for verification
- Works offline with automatic sync

### Self-Checkout Kiosk (`/checkout/:eventId`)

- Full-screen kiosk mode for student self-checkout
- Shows hours worked today and week total
- Auto-resets after 5 seconds
- Offline-capable

### Admin Dashboard (`/admin`)

- Real-time monitoring of check-ins/check-outs
- Activity feed
- Quick access to review and form generation

### Daily Review (`/admin/daily-review`)

- Review and approve daily hours
- Flag early arrivals and late stays
- Bulk approval and individual adjustments
- Export daily reports

### Form Generation (`/admin/forms`)

- Generate school-specific volunteer forms
- Batch generation for all students
- Support for multiple form types (OCPS, NJHS, NHS, etc.)
- PDF download and printing

## Database Schema

### Collections

- **students**: Student registration data
- **timeEntries**: Check-in/check-out records
- **events**: VBS event information
- **generatedForms**: PDF form metadata

See `docs/CLAUDE.md` for detailed schema definitions.

## Security

### Authentication

- Admin pages require authentication (Firebase Auth)
- Scanner pages are public (validated server-side)
- No student authentication needed

### Firestore Rules

- Students: Read-only from client
- Time Entries: Write-only during scan, read for admin
- Events: Public read, admin write

See `firestore.rules` for complete security rules.

## Offline Support

The app uses a Service Worker and IndexedDB to work offline:

- Check-ins/check-outs are queued locally when offline
- Automatic sync when connection restored
- Visual indicator shows pending items
- Critical for church environments with unreliable WiFi

## Documentation

- **[PRD.md](docs/PRD.md)**: Complete product requirements
- **[CLAUDE.md](docs/CLAUDE.md)**: Development guide and patterns

## Support

For questions or issues:

1. Check the documentation in `docs/`
2. Review the PRD for requirements clarification
3. Check Firebase Console for errors
4. Review Cloud Function logs: `firebase functions:log`

## License

[Specify your license here]

## Acknowledgments

Built for Community Church VBS 2026 to streamline volunteer hour tracking for 130+ student volunteers.
