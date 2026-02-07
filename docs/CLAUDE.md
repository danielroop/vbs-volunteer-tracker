# CLAUDE.md - VBS Volunteer Tracker Development Guide

## Project Overview

This is a web-based volunteer hour tracking system for VBS (Vacation Bible School) events. Adult Volunteers (AV) scan student QR code lanyards for check-in/out, and admins review hours and generate school-required forms.

**Key Documents:**
- Full requirements: `docs/PRD.md`
- This file provides context for development work

---

## Tech Stack

### Frontend
- **Framework:** React 18 with Vite
- **Styling:** TailwindCSS (blue primary color theme)
- **Routing:** React Router v6
- **State Management:** React Context API (AuthContext, EventContext)
- **QR Scanning:** html5-qrcode
- **QR Generation:** qrcode + qrcode.react
- **Date Utilities:** date-fns
- **Offline Storage:** idb (IndexedDB wrapper)
- **PWA:** vite-plugin-pwa

### Backend
- **Database:** Firebase Firestore
- **Functions:** Firebase Cloud Functions (Node 22)
- **Storage:** Firebase Storage
- **Hosting:** Firebase Hosting
- **Auth:** Firebase Authentication

### Key Libraries
```json
{
  "react": "^18.2.0",
  "react-router-dom": "^6.21.0",
  "firebase": "^10.7.0",
  "html5-qrcode": "^2.3.8",
  "pdf-lib": "^1.17.1",
  "qrcode": "^1.5.3",
  "qrcode.react": "^4.2.0",
  "date-fns": "^3.0.0",
  "idb": "^7.1.1"
}
```

---

## Project Structure

```
vbs-volunteer-tracker/
├── frontend/                    # React frontend application (Node 18)
│   ├── public/
│   │   └── icons/               # App icons for PWA
│   ├── src/
│   │   ├── components/
│   │   │   ├── Scanner/
│   │   │   │   └── index.jsx    # Unified QR scanner for check-in/out
│   │   │   ├── AdminDashboard/
│   │   │   │   └── index.jsx    # Main dashboard component
│   │   │   ├── DailyReview/
│   │   │   │   └── index.jsx    # Daily hours review
│   │   │   ├── FormGeneration/
│   │   │   │   └── index.jsx    # Form generation interface
│   │   │   └── common/
│   │   │       ├── Button.jsx
│   │   │       ├── Modal.jsx
│   │   │       ├── Input.jsx
│   │   │       ├── Spinner.jsx
│   │   │       └── PrintableBadge.jsx  # QR badge for printing
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx           # Email/password auth
│   │   │   ├── ScannerPage.jsx         # QR scanner page
│   │   │   ├── AdminDashboardPage.jsx  # Admin dashboard
│   │   │   ├── StudentsPage.jsx        # Student roster management
│   │   │   ├── StudentDetailPage.jsx   # Individual student view
│   │   │   ├── EventsPage.jsx          # Event management
│   │   │   ├── CreateEventPage.jsx     # Create new events
│   │   │   ├── UsersPage.jsx           # User (AV/admin) management
│   │   │   ├── DailyReviewPage.jsx     # Review daily hours
│   │   │   └── FormGenerationPage.jsx  # Generate volunteer forms
│   │   ├── hooks/
│   │   │   ├── useQRScanner.js         # QR scanning logic
│   │   │   ├── useOfflineSync.js       # Offline sync handling
│   │   │   └── useTimeEntries.js       # Firestore time entries
│   │   ├── utils/
│   │   │   ├── firebase.js             # Firebase configuration
│   │   │   ├── hourCalculations.js     # Hour rounding/flagging
│   │   │   ├── offlineStorage.js       # IndexedDB wrapper
│   │   │   └── qrCodeGenerator.js      # Generate/validate QR codes
│   │   ├── contexts/
│   │   │   ├── AuthContext.jsx         # Auth state & role management
│   │   │   └── EventContext.jsx        # Current event selection
│   │   ├── App.jsx                     # Main app with routing
│   │   └── main.jsx                    # Entry point
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── functions/                   # Firebase Cloud Functions (Node 22)
│   ├── src/
│   │   ├── checkIn.js           # Check-in cloud function
│   │   ├── checkOut.js          # Check-out cloud function
│   │   ├── userManagement.js    # User CRUD operations
│   │   ├── voidEntry.js         # Void/restore time entries
│   │   └── generateForms.js     # Form generation (partial)
│   ├── index.js                 # Function exports
│   └── package.json
│
├── scripts/                     # Utility scripts
├── firebase.json                # Firebase configuration
├── firestore.rules              # Firestore security rules
├── firestore.indexes.json       # Firestore indexes
├── storage.rules                # Firebase Storage rules
└── docs/
    ├── PRD.md                   # Product Requirements Document
    └── CLAUDE.md                # This file
```

---

## Authentication & Authorization

### User Roles

The system uses two roles with separate Firestore collections:

| Role | Collection | Access |
|------|------------|--------|
| `admin` | `admins` | Full access to all features |
| `adult_volunteer` | `users` | Scanner access only |

### AuthContext Methods

```javascript
const {
  user,              // Current Firebase user
  profile,           // Firestore profile data
  isAuthenticated,   // Boolean
  loading,           // Auth loading state
  hasRole,           // Check specific role
  isAdmin,           // Shortcut for admin check
  isAdultVolunteer,  // Shortcut for AV check
  canAccessScanner,  // Admin OR adult_volunteer
  canAccessAdmin,    // Admin only
  login,             // signInWithEmailAndPassword
  logout             // signOut
} = useAuth();
```

### Protected Routes

```jsx
// Requires authentication
<ProtectedRoute><Component /></ProtectedRoute>

// Requires admin role (redirects non-admins to /scan)
<AdminRoute><Component /></AdminRoute>

// Requires admin OR adult_volunteer (for scanner)
<ScannerRoute><Component /></ScannerRoute>
```

### Authentication Flow

1. User navigates to `/login`
2. Enters email/password → `signInWithEmailAndPassword()`
3. `AuthContext` checks `admins` collection first, then `users`
4. User must exist in Firestore to be authorized
5. Redirects based on role: Admin → `/admin`, AV → `/scan`

---

## Core Data Models

### Student
```javascript
{
  id: string,                    // Firestore doc ID
  firstName: string,
  lastName: string,
  schoolName: string,            // For form generation
  gradeLevel: string,            // "5th", "6th", etc.
  gradYear: string,              // Expected graduation year
  overrideHours: number | null,  // Manual hour override
  createdAt: timestamp
}
```

### TimeEntry
```javascript
{
  id: string,                    // Firestore doc ID
  studentId: string,
  eventId: string,
  activityId: string,            // Activity within event
  date: string,                  // "YYYY-MM-DD"
  checkInTime: timestamp,
  checkInBy: string,             // User ID or 'av_scan'
  checkInMethod: string,         // "av_scan"
  checkOutTime: timestamp | null,
  checkOutBy: string | null,
  checkOutMethod: string | null,
  hoursWorked: number | null,    // Rounded to 0.5
  rawMinutes: number | null,     // Exact minutes
  reviewStatus: string,          // "pending" | "flagged" | "approved"
  flags: string[],               // ["early_arrival", "late_stay"]
  modifiedBy: string | null,
  modificationReason: string | null,
  // Void/Restore
  isVoided: boolean,               // false by default, true when voided
  voidReason: string | null,       // Reason for voiding (min 5 chars)
  voidedAt: timestamp | null,      // When voided
  voidedBy: string | null,         // User ID who voided
  changeLog: Array<{              // Audit trail for edits, voids, restores
    timestamp: string,             // ISO date string
    modifiedBy: string,            // User ID
    type: string,                  // 'edit' | 'void' | 'restore'
    reason: string,
    description: string
  }>,
  createdAt: timestamp
}
```

### Event
```javascript
{
  id: string,                    // Firestore doc ID
  name: string,                  // "VBS 2026"
  organizationName: string,      // "Community Church"
  contactName: string,           // Supervisor name
  contactPhone: string,
  contactEmail: string,
  typicalStartTime: string,      // "09:00" (for flagging)
  typicalEndTime: string,        // "15:00"
  activities: [                  // Multiple activities per event
    { id: string, name: string }
  ],
  createdAt: timestamp
}
```

### Admin User
```javascript
// Collection: admins
{
  id: string,                    // Same as Firebase Auth UID
  email: string,
  name: string,
  role: "admin",
  isActive: boolean,
  createdAt: timestamp,
  createdBy: string,             // UID of admin who created
  updatedAt: timestamp,
  updatedBy: string
}
```

### Adult Volunteer User
```javascript
// Collection: users
{
  id: string,                    // Same as Firebase Auth UID
  email: string,
  name: string,
  role: "adult_volunteer",
  isActive: boolean,
  createdAt: timestamp,
  createdBy: string,
  updatedAt: timestamp,
  updatedBy: string
}
```

---

## Route Structure

| Route | Access | Description |
|-------|--------|-------------|
| `/login` | Public | Login page |
| `/scan/:eventId?/:activityId?/:action?` | Scanner | QR scanner for check-in/out |
| `/admin` | Admin | Dashboard with real-time stats |
| `/admin/students` | Admin | Student roster management |
| `/admin/students/:studentId` | Admin | Individual student detail (print requires all checkouts) |
| `/admin/events` | Admin | Event management |
| `/admin/events/new` | Admin | Create new event |
| `/admin/users` | Admin | User management (admins + AVs) |
| `/admin/daily-review` | Admin | Review daily hours |
| `/admin/forms` | Admin | Form generation |
| `/` | Protected | Redirects based on role |

---

## Cloud Functions

### checkIn
```javascript
// Endpoint: checkIn
// Input: { studentId, eventId, activityId, scannedBy }
// Returns: { success, studentName, checkInTime, entryId, flags } or { success: false, error, duplicate }
```

### checkOut
```javascript
// Endpoint: checkOut
// Input: { studentId, eventId, activityId }
// Returns: { success, studentName, hoursToday, weekTotal, checkOutTime, flags }
```

### voidTimeEntry
```javascript
// Endpoint: voidTimeEntry
// Input: { entryId, voidReason }
// Validates: auth, entryId exists, not already voided, reason >= 5 chars
// Returns: { success, studentName, message }
```

### restoreTimeEntry
```javascript
// Endpoint: restoreTimeEntry
// Input: { entryId }
// Validates: auth, entryId exists, is currently voided
// Returns: { success, studentName, message }
```

### User Management Functions
```javascript
// createUser: { email, password, name, role } → Creates auth user + Firestore doc
// updateUser: { userId, role?, isActive?, name? } → Updates user, moves collections if role changes
// deleteUser: { userId } → Deletes from Auth + both Firestore collections
// listUsers: {} → Returns all admins + users sorted by name
// resetUserPassword: { userId, newPassword? } → Resets password (generates random if not provided)
```

---

## QR Code Format

**Format:** `studentId|eventId|checksum`

**Checksum:** 6-character hash generated from studentId + eventId

```javascript
// Generate QR data
const qrData = generateQRData(studentId, eventId);
// Result: "abc123|evt456|x7y8z9"

// Parse and validate
const { studentId, eventId, isValid } = parseQRData(qrData);
```

---

## Hour Calculation Logic

### Rounding Rules (PRD Section 3.4.1)
- **0-14 minutes:** Round down
- **15-44 minutes:** Round to 0.5
- **45-59 minutes:** Round up

```javascript
// Examples:
// 9:02 AM - 3:15 PM = 6h 13m → 6.0 hours
// 9:02 AM - 3:18 PM = 6h 16m → 6.5 hours
// 8:45 AM - 4:15 PM = 7h 30m → 7.5 hours
```

### Flagging Rules (PRD Section 3.4.2)
- **Early arrival:** Check-in >15 min before `typicalStartTime`
- **Late stay:** Check-out >15 min after `typicalEndTime`

---

## Firestore Security Rules Summary

```javascript
students:    { read: scanner, write: admin }
timeEntries: { read: admin, create: scanner, update/delete: admin }
events:      { read: scanner, write: admin }
admins:      { read: self, update: self, create/delete: backend only }
users:       { read: self, update: self, create/delete: backend only }
generatedForms: { read/write: admin }
```

---

## Offline Support

### IndexedDB Storage
```javascript
// Queue operations when offline
await queueCheckIn({ studentId, eventId, activityId, timestamp });
await queueCheckOut({ studentId, eventId, activityId, timestamp });

// Get pending items
const checkIns = await getPendingCheckIns();
const checkOuts = await getPendingCheckOuts();
const { checkIns, checkOuts } = await getPendingCounts();

// Clear after sync
await clearAllPending();
```

### useOfflineSync Hook
- Manages pending queue
- Syncs when connection restored
- Visual indicator for offline state

---

## Development Commands

### Frontend
```bash
cd frontend
npm run dev        # Start dev server (localhost:3000)
npm run build      # Build for production
npm run preview    # Preview production build
npm run lint       # ESLint check
```

### Cloud Functions
```bash
cd functions
npm run serve      # Start emulators
npm run deploy     # Deploy to Firebase
npm run logs       # View function logs
```

### Firebase
```bash
firebase emulators:start           # Start all emulators
firebase deploy                    # Deploy everything
firebase deploy --only hosting     # Frontend only
firebase deploy --only functions   # Functions only
firebase deploy --only firestore:rules  # Rules only
```

---

## Environment Variables

### Frontend (.env)
```env
VITE_FIREBASE_API_KEY=xxx
VITE_FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=xxx
VITE_FIREBASE_STORAGE_BUCKET=xxx.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=xxx
VITE_FIREBASE_APP_ID=xxx
VITE_USE_EMULATOR=true  # Optional: connect to emulators
```

---

## Key Implementation Files

| Purpose | File Path |
|---------|-----------|
| Main routing | `frontend/src/App.jsx` |
| Auth context | `frontend/src/contexts/AuthContext.jsx` |
| Event context | `frontend/src/contexts/EventContext.jsx` |
| QR Scanner component | `frontend/src/components/Scanner/index.jsx` |
| Student management | `frontend/src/pages/StudentsPage.jsx` |
| User management | `frontend/src/pages/UsersPage.jsx` |
| Hour calculations | `frontend/src/utils/hourCalculations.js` |
| QR code utils | `frontend/src/utils/qrCodeGenerator.js` |
| Check-in function | `functions/src/checkIn.js` |
| Check-out function | `functions/src/checkOut.js` |
| Void/restore functions | `functions/src/voidEntry.js` |
| User management | `functions/src/userManagement.js` |
| Security rules | `firestore.rules` |
| Student detail page | `frontend/src/pages/StudentDetailPage.jsx` |

---

## Student Detail Page Behavior

The Student Detail page (`/admin/students/:studentId`) displays individual student hours and allows printing of service logs and badges.

### Key Features
- **Hours Summary:** Shows hours by activity (only counts entries with actual checkout times)
- **Entries Table:** Lists all time entries with check-in/checkout times and calculated hours
- **Edit Functionality:** Allows editing check-in/checkout times with required reason tracking
- **Print Badge:** Always available for printing student QR code badges
- **Print Service Log:** Generates OCPS-format service log for school submission

### Void/Restore Time Entries
- **Void:** Soft-deletes a time entry by setting `isVoided: true` with reason, timestamp, and user tracking
- **Restore:** Reverses a void by resetting void fields to null/false
- Voided entries are excluded from hour calculations and activity summaries
- Both Daily Review and Student Detail pages support void/restore via confirmation modal
- ServiceLogEntry accepts optional `onVoid`/`onRestore` props (buttons only render when callbacks provided)
- Visual indicators for voided entries: `opacity-50`, `bg-gray-100`, `line-through`, "VOIDED" label

### Print Service Log Validation
The system **blocks** printing of the Service Log if any time entries do not have checkout times:
- An error alert is shown: "Cannot print Service Log: This student has time entries that are not checked out."
- Entries without checkout times are highlighted in red in the table
- A warning message appears in the Summary section: "Some entries are not checked out"

This ensures that printed Service Logs only contain verified, actual hours worked.

### Visual Indicators
- **Red highlighting:** Rows without checkout times
- **Blue highlighting:** Rows with modifications or forced checkouts
- **Gray with opacity + line-through:** Voided entries
- **"VOIDED" label:** Displayed for voided entries with void reason on hover
- **"Not checked out" label:** Displayed in Check Out column for incomplete entries
- **"--" in Hours column:** Shown when hours cannot be calculated

---

## Testing

### Unit Tests (Vitest)
```bash
cd frontend
npm test           # Run tests
npm run test:watch # Watch mode
npm run test:coverage # Coverage report
```

### Cloud Functions Tests
```bash
cd functions
npm test           # Run Jest tests
```

---

## Common Pitfalls

1. **Don't use client-side timestamps** - Use server `Timestamp.now()`
2. **Don't store rounded hours only** - Store both rounded and rawMinutes
3. **Don't skip offline mode** - Church WiFi is unreliable
4. **Don't hardcode event IDs** - Use EventContext for current event
5. **Don't forget to cleanup listeners** - Use `useEffect` return function
6. **Don't use React class components** - Use functional components + hooks
7. **Always validate QR checksums** - Use `validateChecksum()` before processing

---

## When to Ask for Clarification

Ask the human if:
- Feature requirements are ambiguous (check PRD first)
- Design decisions need input
- Form templates differ from assumptions
- Security rules need adjustment for new features
- Hour calculation edge cases not covered

---

**Last Updated:** 2026-02-07
**Version:** 2.2
