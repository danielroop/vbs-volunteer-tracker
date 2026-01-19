# VBS Volunteer Tracker - Setup Guide

## Prerequisites

- Node.js 18+ installed
- npm 9+ installed

## Quick Start with Firebase Emulator

### 1. Install Dependencies

```bash
# Install root dependencies (Firebase tools)
npm install

# Install frontend dependencies
cd frontend
npm install

# Install functions dependencies
cd ../functions
npm install

# Install scripts dependencies
cd ../scripts
npm install

cd ..
```

### 2. Start Firebase Emulators

Open a terminal and run:

```bash
npm run emulators
```

This will start:
- Auth Emulator: http://localhost:9099
- Firestore Emulator: http://localhost:8080
- Functions Emulator: http://localhost:5001
- Storage Emulator: http://localhost:9199
- Emulator UI: http://localhost:4000

### 3. Setup Admin User

Open a new terminal (keep emulators running) and run:

```bash
node scripts/setup-admin.js
```

This creates the default admin user:
- **Email:** `admin@vbstrack.local`
- **Password:** `Admin123!VBS`

### 4. Start Frontend Development Server

```bash
cd frontend
npm run dev
```

The app will open at http://localhost:3000

### 5. Login

Navigate to http://localhost:3000/login and use the credentials:
- Email: `admin@vbstrack.local`
- Password: `Admin123!VBS`

## Default Admin Credentials

### For Emulator (Development)
- **Email:** admin@vbstrack.local
- **Password:** Admin123!VBS

⚠️ **IMPORTANT:** These credentials are for local development only. Never use these in production!

## Project Structure

```
vbs-volunteer-tracker/
├── frontend/              # React frontend
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── pages/        # Page components
│   │   ├── contexts/     # React contexts
│   │   └── utils/        # Utilities
│   └── package.json
├── functions/            # Firebase Cloud Functions
│   └── package.json
├── scripts/              # Setup scripts
│   └── setup-admin.js   # Admin user setup
├── firebase.json         # Firebase configuration
├── firestore.rules      # Firestore security rules
└── docs/
    ├── PRD.md           # Product requirements
    └── CLAUDE.md        # Developer guide
```

## Troubleshooting

### Emulator won't start
- Make sure ports 4000, 5001, 8080, 9099, 9199 are not in use
- Try `lsof -ti:4000 | xargs kill` to free up ports

### Can't create admin user
- Make sure emulators are running first
- Check that `setup-admin.js` is connecting to localhost ports

### Login not working
- Verify emulators are running
- Check browser console for connection errors
- Ensure frontend `.env.local` has correct emulator URLs

### Frontend won't build
- Clear node_modules: `rm -rf node_modules && npm install`
- Clear cache: `rm -rf .vite`

## Next Steps

After successful setup:
1. Explore the admin dashboard at http://localhost:3000/admin
2. Check the Emulator UI at http://localhost:4000 to see Firebase data
3. Review `docs/PRD.md` for full feature specifications
4. Review `docs/CLAUDE.md` for development guidelines

## Production Setup

For production deployment:
1. Create a real Firebase project at https://console.firebase.google.com
2. Update `.firebaserc` with your project ID
3. Create production environment variables (never commit these!)
4. Use Firebase Console to create admin users (don't use the script)
5. Deploy: `firebase deploy`

See docs/DEPLOYMENT.md for detailed production setup instructions.
