# Admin Credentials - VBS Volunteer Tracker

## 🔐 Default Admin Credentials (Local Development)

### For Firebase Emulator

```
Email:    admin@vbstrack.local
Password: Admin123!VBS
```

## 📍 Where to Use These Credentials

1. **Login Page**: http://localhost:3000/login
2. **Firebase Auth Emulator UI**: http://localhost:4000/auth

## ⚙️ How to Start the System

### Step 1: Start Firebase Emulators

**Option A: Using npm script**
```bash
npm run emulators
```

**Option B: Using the start script**
```bash
./EMULATOR_START.sh
```

**Option C: Manual start**
```bash
npx firebase emulators:start --project demo-vbs-tracker
```

Wait until you see:
```
✔  All emulators ready!
┌─────────────────────────────────────────────────────────────┐
│ ✔  All emulators ready! It is now safe to connect your app. │
│ i  View Emulator UI at http://localhost:4000                │
└─────────────────────────────────────────────────────────────┘
```

### Step 2: Setup Admin User (First Time Only)

Open a **new terminal** (keep emulators running) and run:

```bash
node scripts/setup-admin.js
```

This will create the admin user in the emulator's Auth system.

### Step 3: Start Frontend

Open another **new terminal** and run:

```bash
cd frontend
npm run dev
```

The app will open at: http://localhost:3000

### Step 4: Login

1. Navigate to http://localhost:3000/login
2. Enter credentials:
   - **Email**: admin@vbstrack.local
   - **Password**: Admin123!VBS
3. Click "Sign In"

You should be redirected to the Admin Dashboard!

## 🔍 Verifying the Setup

### Check Auth Emulator UI
Visit http://localhost:4000/auth to see all registered users.

### Check Firestore Emulator UI
Visit http://localhost:4000/firestore to see the admin document in the `admins` collection.

### Check Frontend
The login page should pre-fill with the admin credentials in development mode.

## ⚠️ Important Security Notes

1. **NEVER use these credentials in production**
2. **NEVER commit real production credentials to git**
3. These credentials are for local development only
4. The `.env.local` file is gitignored for security

## 🐛 Troubleshooting

### Emulator won't start
- Check if ports are in use: `lsof -i:4000,5001,8080,9099`
- Kill processes: `lsof -ti:4000,5001,8080,9099 | xargs kill -9`
- Try restarting

### Admin user doesn't exist
- Make sure emulators are running first
- Run the setup script: `node scripts/setup-admin.js`
- Check the output for errors

### Login fails
- Verify emulators are running (check http://localhost:4000)
- Check browser console for errors
- Verify the frontend is connecting to emulators (check console for "Connected to Firebase Emulators")
- Try clearing browser cache/cookies

### Can't access admin dashboard
- Make sure you're logged in with the admin account
- Check that the user exists in the `admins` collection (visit http://localhost:4000/firestore)

## 📝 Configuration Files

The credentials are configured in:
- `frontend/.env.local` - Frontend environment variables
- `scripts/setup-admin.js` - Admin setup script

## 🔄 Resetting Everything

To start fresh:

```bash
# Stop all emulators
lsof -ti:4000,5001,8080,9099 | xargs kill -9

# Remove emulator data (if any)
rm -rf ./emulator-data

# Restart emulators
npm run emulators

# Re-setup admin (in new terminal)
node scripts/setup-admin.js
```

## 📞 Need Help?

- Check `docs/SETUP.md` for detailed setup instructions
- Check `docs/CLAUDE.md` for development guidelines
- Check `docs/PRD.md` for product requirements

---

**Last Updated**: 2026-01-19
**Version**: 1.0.0
