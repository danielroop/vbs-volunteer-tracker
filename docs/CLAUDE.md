# CLAUDE.md - VBS Volunteer Tracker Development Guide

## Project Overview

This is a web-based volunteer hour tracking system for VBS (Vacation Bible School) events. Students use QR code lanyards to check in/out, and admins review hours and generate school-required forms.

**Key Documents:**
- Full requirements: `docs/PRD.md`
- This file provides context for development work

---

## Tech Stack

### Frontend
- **Framework:** React 18+ with Vite
- **Styling:** TailwindCSS
- **Routing:** React Router v6
- **State Management:** React Context API + hooks (keep it simple)
- **QR Scanning:** html5-qrcode
- **PWA:** Vite PWA plugin

### Backend
- **Database:** Firebase Firestore
- **Functions:** Firebase Cloud Functions
- **Storage:** Firebase Storage (for PDF forms)
- **Hosting:** Firebase Hosting
- **Auth:** Firebase Auth (admin only)

### Key Libraries
```json
{
  "react": "^18.2.0",
  "react-router-dom": "^6.21.0",
  "firebase": "^10.7.0",
  "html5-qrcode": "^2.3.8",
  "pdf-lib": "^1.17.1",
  "qrcode": "^1.5.3",
  "date-fns": "^3.0.0"
}
```

---

## Project Structure

```
frontend/
├── public/
│   ├── manifest.json              # PWA manifest
│   └── icons/                     # App icons
├── src/
│   ├── components/
│   │   ├── AVScanner/
│   │   │   ├── index.jsx          # Main scanner component
│   │   │   ├── ScannerView.jsx    # Camera/QR interface
│   │   │   └── RecentScans.jsx    # Last 5 scans list
│   │   ├── SelfCheckout/
│   │   │   ├── index.jsx          # Kiosk checkout component
│   │   │   └── SuccessScreen.jsx  # Checkout confirmation
│   │   ├── AdminDashboard/
│   │   │   ├── index.jsx          # Main dashboard
│   │   │   ├── RealTimeStats.jsx  # Live stats widget
│   │   │   ├── ActivityFeed.jsx   # Recent check-ins/outs
│   │   │   └── QuickActions.jsx   # Action buttons
│   │   ├── DailyReview/
│   │   │   ├── index.jsx          # Daily review page
│   │   │   ├── StudentRow.jsx     # Individual student row
│   │   │   └── EditHoursModal.jsx # Hour adjustment modal
│   │   ├── FormGeneration/
│   │   │   ├── index.jsx          # Form generation page
│   │   │   └── FormList.jsx       # Generated forms list
│   │   └── common/
│   │       ├── Button.jsx
│   │       ├── Modal.jsx
│   │       ├── Input.jsx
│   │       └── Spinner.jsx
│   ├── pages/
│   │   ├── AVScannerPage.jsx
│   │   ├── CheckoutPage.jsx
│   │   ├── AdminDashboardPage.jsx
│   │   ├── DailyReviewPage.jsx
│   │   ├── FormGenerationPage.jsx
│   │   └── LoginPage.jsx
│   ├── hooks/
│   │   ├── useQRScanner.js        # QR scanning logic
│   │   ├── useOfflineSync.js      # Offline sync handling
│   │   ├── useTimeEntries.js      # Firestore time entries
│   │   └── useRealtime.js         # Real-time updates
│   ├── utils/
│   │   ├── firebase.js            # Firebase config
│   │   ├── hourCalculations.js    # Hour rounding/flagging
│   │   ├── offlineStorage.js      # IndexedDB wrapper
│   │   └── qrCodeGenerator.js     # Generate QR codes
│   ├── contexts/
│   │   ├── AuthContext.jsx        # Admin auth
│   │   └── EventContext.jsx       # Current event data
│   ├── App.jsx
│   └── main.jsx
├── package.json
└── vite.config.js

functions/
├── src/
│   ├── checkIn.js                 # Check-in logic
│   ├── checkOut.js                # Check-out logic
│   ├── generateForms.js           # PDF generation
│   ├── calculateHours.js          # Hour calculation
│   └── utils/
│       ├── pdfFiller.js           # Fill PDF templates
│       └── validators.js          # Input validation
├── package.json
└── index.js
```

---

## Core Data Models

### Student
```javascript
{
  id: string,                      // Firestore doc ID
  eventId: string,
  firstName: string,
  lastName: string,
  email: string,                   // Parent's email
  phone: string,                   // Parent's phone
  gradeLevel: string,              // "5th", "6th", ... "12th"
  schoolName: string,
  formType: string,                // "ocps" | "njhs" | "nhs" | "private" | "other"
  studentCode: string,             // "SJ-0042"
  qrCode: string,                  // QR code data: "studentId|eventId|checksum"
  createdAt: timestamp,
  lanyardPrinted: boolean
}
```

### TimeEntry
```javascript
{
  id: string,
  studentId: string,
  eventId: string,
  date: string,                    // "2026-06-15"
  checkInTime: timestamp,
  checkInBy: string,               // AV user ID
  checkInMethod: string,           // "av_scan" | "self_scan"
  checkOutTime: timestamp | null,
  checkOutBy: string | null,
  checkOutMethod: string | null,
  hoursWorked: number,             // 6.5 (rounded)
  rawMinutes: number,              // 373 (exact)
  reviewStatus: string,            // "pending" | "flagged" | "approved"
  flags: string[],                 // ["early_arrival", "late_stay"]
  modifiedBy: string | null,
  modificationReason: string | null,
  createdAt: timestamp
}
```

### Event
```javascript
{
  id: string,
  name: string,                    // "VBS 2026"
  organizationName: string,        // "Community Church"
  startDate: string,               // "2026-06-15"
  endDate: string,                 // "2026-06-19"
  supervisorName: string,          // "Pastor John Smith"
  checkInQRUrl: string,
  checkOutQRUrl: string,
  typicalStartTime: string,        // "09:00" (for flagging)
  typicalEndTime: string,          // "15:00"
  createdAt: timestamp
}
```

---

## Development Guidelines

### 1. Component Pattern (Functional Components)

```jsx
import React from 'react';

export default function ComponentName({ prop1, prop2 }) {
  // Hooks at top
  const [state, setState] = React.useState(initialValue);
  const { data } = useCustomHook();
  
  // Effects
  React.useEffect(() => {
    // side effects
  }, [dependencies]);
  
  // Event handlers
  const handleAction = () => {
    // logic
  };
  
  // Early returns
  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  
  // Main render
  return (
    <div className="container">
      {/* JSX */}
    </div>
  );
}
```

### 2. Firebase Best Practices

**Firestore Queries:**
```javascript
// Good: Use Firestore listeners for real-time
const unsubscribe = onSnapshot(
  collection(db, 'timeEntries'),
  (snapshot) => {
    const entries = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    setTimeEntries(entries);
  }
);

// Cleanup
return () => unsubscribe();
```

**Security Rules (firestore.rules):**
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Students: Read-only from client
    match /students/{studentId} {
      allow read: if true;
      allow write: if false; // Only functions can write
    }
    
    // TimeEntries: Write-only during scan, read for admin
    match /timeEntries/{entryId} {
      allow read: if request.auth != null; // Admin only
      allow create: if true; // Allow scanner to create
      allow update, delete: if request.auth != null;
    }
  }
}
```

### 3. Offline Support Strategy

**Use IndexedDB for offline queue:**
```javascript
// utils/offlineStorage.js
import { openDB } from 'idb';

export async function queueCheckIn(data) {
  const db = await openDB('vbs-offline', 1);
  await db.add('pendingCheckIns', {
    ...data,
    timestamp: Date.now()
  });
}

export async function syncPendingCheckIns() {
  const db = await openDB('vbs-offline', 1);
  const pending = await db.getAll('pendingCheckIns');
  
  for (const item of pending) {
    try {
      await checkInToFirestore(item);
      await db.delete('pendingCheckIns', item.id);
    } catch (error) {
      console.error('Sync failed:', error);
    }
  }
}
```

**Service Worker (vite-plugin-pwa):**
```javascript
// vite.config.js
import { VitePWA } from 'vite-plugin-pwa';

export default {
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firestore-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 // 1 hour
              }
            }
          }
        ]
      }
    })
  ]
};
```

### 4. Hour Calculation Logic

**Per PRD Section 3.4.1:**
```javascript
// utils/hourCalculations.js

/**
 * Calculate hours worked and round to nearest 0.5 hour
 * @param {Date} checkIn - Check-in timestamp
 * @param {Date} checkOut - Check-out timestamp
 * @returns {Object} { rounded, raw, minutes }
 */
export function calculateHours(checkIn, checkOut) {
  const minutes = Math.floor((checkOut - checkIn) / 1000 / 60);
  const hours = minutes / 60;
  
  // Round to nearest 0.5
  // 0-14 min = round down, 15-44 = +0.5, 45-59 = round up
  const rounded = Math.round(hours * 2) / 2;
  
  return {
    rounded,          // 6.5
    raw: hours,       // 6.216666...
    minutes           // 373
  };
}

/**
 * Check if time should be flagged
 * @param {Date} time - Check-in or check-out time
 * @param {string} type - "checkIn" or "checkOut"
 * @param {string} typicalStart - "09:00"
 * @param {string} typicalEnd - "15:00"
 * @returns {string[]} Array of flags
 */
export function getFlagsForTime(time, type, typicalStart, typicalEnd) {
  const flags = [];
  const timeStr = format(time, 'HH:mm');
  
  if (type === 'checkIn') {
    const [hour, min] = typicalStart.split(':');
    const typical = new Date(time);
    typical.setHours(parseInt(hour), parseInt(min), 0, 0);
    
    // Flag if >15 min early
    if (time < typical - (15 * 60 * 1000)) {
      flags.push('early_arrival');
    }
  }
  
  if (type === 'checkOut') {
    const [hour, min] = typicalEnd.split(':');
    const typical = new Date(time);
    typical.setHours(parseInt(hour), parseInt(min), 0, 0);
    
    // Flag if >15 min late
    if (time > typical + (15 * 60 * 1000)) {
      flags.push('late_stay');
    }
  }
  
  return flags;
}
```

### 5. QR Scanner Component Pattern

```jsx
// components/AVScanner/index.jsx
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useEffect, useRef } from 'react';

export default function AVScanner() {
  const scannerRef = useRef(null);
  const [recentScans, setRecentScans] = useState([]);
  
  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { 
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      }
    );
    
    scanner.render(onScanSuccess, onScanFailure);
    scannerRef.current = scanner;
    
    return () => {
      scanner.clear();
    };
  }, []);
  
  const onScanSuccess = async (decodedText) => {
    // Parse QR code: "studentId|eventId|checksum"
    const [studentId, eventId, checksum] = decodedText.split('|');
    
    // Validate checksum
    if (!validateChecksum(studentId, eventId, checksum)) {
      showError('Invalid QR code');
      return;
    }
    
    try {
      // Call check-in function
      const result = await checkInStudent(studentId, eventId);
      
      // Update recent scans
      setRecentScans(prev => [result, ...prev].slice(0, 5));
      
      // Audio feedback
      playBeep();
      
      // Visual feedback
      showSuccess(result.studentName);
    } catch (error) {
      showError(error.message);
    }
  };
  
  const onScanFailure = (error) => {
    // Don't spam console with scan errors
    if (!error.includes('NotFoundException')) {
      console.warn('QR Scan error:', error);
    }
  };
  
  return (
    <div className="scanner-container">
      <div id="qr-reader" className="w-full max-w-md" />
      <RecentScans scans={recentScans} />
    </div>
  );
}
```

### 6. Error Handling Pattern

```javascript
// Use consistent error handling
try {
  const result = await somethingThatMightFail();
  return { success: true, data: result };
} catch (error) {
  console.error('Operation failed:', error);
  
  // User-friendly error messages
  const message = error.code === 'permission-denied' 
    ? 'You do not have permission to perform this action'
    : error.message;
  
  return { success: false, error: message };
}
```

---

## Key Implementation Notes

### From PRD - Critical Requirements

**1. Check-In Must Be Fast (Section 3.2.1)**
- Target: < 5 seconds per student
- Continuous scanning (no button press)
- Audio + visual feedback
- Show last 5 scans for verification

**2. Offline Mode is Critical (Section 5.4)**
- Church WiFi is unreliable
- Check-ins/outs MUST work offline
- Queue in IndexedDB, sync when online
- Visual indicator: "⚠️ Offline - 3 pending"

**3. Hour Rounding (Section 3.4.1)**
- Round to nearest 0.5 hour (30 min)
- Store both rounded and raw minutes
- 0-14 min = round down
- 15-44 min = +0.5
- 45-59 min = round up

**4. Flagging Logic (Section 3.4.2)**
- Flag early arrival: >15 min before typical start
- Flag late stay: >15 min after typical end
- Flags trigger manual review by VA

**5. Multi-Form Support (Section 3.6.1)**
- OCPS, NJHS, NHS, Private, Other
- Each student tagged with form type
- Use appropriate PDF template per type

**6. Friday Form Generation (Section 3.6.3)**
- Can generate before all students checked out
- Use estimated hours (6 hrs or average)
- Flag forms with estimates
- Allow reprint if actual differs

---

## Firebase Cloud Functions

### Check-In Function
```javascript
// functions/src/checkIn.js
const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

exports.checkIn = onCall(async (request) => {
  const { studentId, eventId, scannedBy } = request.data;
  
  // Validate
  if (!studentId || !eventId) {
    throw new Error('Missing required fields');
  }
  
  const db = admin.firestore();
  const today = new Date().toISOString().split('T')[0]; // "2026-06-15"
  
  // Check if already checked in today
  const existing = await db.collection('timeEntries')
    .where('studentId', '==', studentId)
    .where('date', '==', today)
    .where('checkOutTime', '==', null)
    .get();
  
  if (!existing.empty) {
    const existingEntry = existing.docs[0].data();
    return {
      success: false,
      error: `Already checked in at ${existingEntry.checkInTime.toDate().toLocaleTimeString()}`,
      duplicate: true
    };
  }
  
  // Get student info
  const studentDoc = await db.collection('students').doc(studentId).get();
  if (!studentDoc.exists) {
    throw new Error('Student not found');
  }
  const student = studentDoc.data();
  
  // Get event info for flagging
  const eventDoc = await db.collection('events').doc(eventId).get();
  const event = eventDoc.data();
  
  // Create time entry
  const checkInTime = admin.firestore.Timestamp.now();
  const flags = getFlagsForCheckIn(checkInTime, event.typicalStartTime);
  
  const entry = {
    studentId,
    eventId,
    date: today,
    checkInTime,
    checkInBy: scannedBy,
    checkInMethod: 'av_scan',
    checkOutTime: null,
    checkOutBy: null,
    checkOutMethod: null,
    hoursWorked: null,
    rawMinutes: null,
    reviewStatus: flags.length > 0 ? 'flagged' : 'pending',
    flags,
    createdAt: admin.firestore.Timestamp.now()
  };
  
  const docRef = await db.collection('timeEntries').add(entry);
  
  return {
    success: true,
    studentName: `${student.firstName} ${student.lastName}`,
    checkInTime: checkInTime.toDate(),
    entryId: docRef.id
  };
});

function getFlagsForCheckIn(checkInTime, typicalStart) {
  const flags = [];
  const time = checkInTime.toDate();
  const [hour, min] = typicalStart.split(':');
  const typical = new Date(time);
  typical.setHours(parseInt(hour), parseInt(min), 0, 0);
  
  // Flag if >15 min early
  if (time < typical - (15 * 60 * 1000)) {
    flags.push('early_arrival');
  }
  
  return flags;
}
```

### Check-Out Function
```javascript
// functions/src/checkOut.js
const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

exports.checkOut = onCall(async (request) => {
  const { studentId, eventId, method } = request.data;
  
  const db = admin.firestore();
  const today = new Date().toISOString().split('T')[0];
  
  // Find today's entry
  const entries = await db.collection('timeEntries')
    .where('studentId', '==', studentId)
    .where('date', '==', today)
    .where('checkOutTime', '==', null)
    .get();
  
  if (entries.empty) {
    throw new Error('No check-in found for today');
  }
  
  const entryDoc = entries.docs[0];
  const entry = entryDoc.data();
  
  // Calculate hours
  const checkOutTime = admin.firestore.Timestamp.now();
  const checkInMs = entry.checkInTime.toMillis();
  const checkOutMs = checkOutTime.toMillis();
  const minutes = Math.floor((checkOutMs - checkInMs) / 1000 / 60);
  const hours = minutes / 60;
  const rounded = Math.round(hours * 2) / 2;
  
  // Get event for flagging
  const eventDoc = await db.collection('events').doc(eventId).get();
  const event = eventDoc.data();
  const flags = [...entry.flags, ...getFlagsForCheckOut(checkOutTime, event.typicalEndTime)];
  
  // Update entry
  await entryDoc.ref.update({
    checkOutTime,
    checkOutBy: method === 'self_scan' ? 'student_self' : request.auth?.uid || 'av',
    checkOutMethod: method || 'self_scan',
    hoursWorked: rounded,
    rawMinutes: minutes,
    flags,
    reviewStatus: flags.length > 0 ? 'flagged' : 'pending'
  });
  
  // Get student for response
  const studentDoc = await db.collection('students').doc(studentId).get();
  const student = studentDoc.data();
  
  // Get week total
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
  const weekEntries = await db.collection('timeEntries')
    .where('studentId', '==', studentId)
    .where('date', '>=', weekStart.toISOString().split('T')[0])
    .where('checkOutTime', '!=', null)
    .get();
  
  const weekTotal = weekEntries.docs.reduce((sum, doc) => sum + doc.data().hoursWorked, 0);
  
  return {
    success: true,
    studentName: `${student.firstName} ${student.lastName}`,
    hoursToday: rounded,
    weekTotal: weekTotal + rounded
  };
});

function getFlagsForCheckOut(checkOutTime, typicalEnd) {
  const flags = [];
  const time = checkOutTime.toDate();
  const [hour, min] = typicalEnd.split(':');
  const typical = new Date(time);
  typical.setHours(parseInt(hour), parseInt(min), 0, 0);
  
  if (time > typical + (15 * 60 * 1000)) {
    flags.push('late_stay');
  }
  
  return flags;
}
```

---

## Common Pitfalls to Avoid

1. **Don't use client-side timestamps** - Use server timestamps (Firestore `Timestamp.now()`)
2. **Don't store rounded hours only** - Store both rounded and raw minutes for audit
3. **Don't skip offline mode** - Church WiFi is unreliable, offline is critical
4. **Don't hardcode event IDs** - Use context/params for current event
5. **Don't forget to cleanup listeners** - Use `useEffect` return function
6. **Don't use React Class Components** - Use functional components + hooks
7. **Don't over-engineer state** - Context for global, local state for component-specific
8. **Don't skip error boundaries** - Wrap major sections in error boundaries
9. **Don't forget loading states** - Always show spinner/skeleton while loading
10. **Don't ignore mobile viewport** - Design mobile-first, everything should work on phone/iPad

---

## Testing Strategy

### Manual Testing Checklist

**AV Scanner:**
- [ ] Can scan QR code successfully
- [ ] Shows last 5 scans
- [ ] Plays audio on scan
- [ ] Shows error for invalid QR
- [ ] Warns if already checked in
- [ ] Works offline (IndexedDB queue)
- [ ] Syncs when back online

**Self-Checkout:**
- [ ] Can scan lanyard
- [ ] Shows hours today + week total
- [ ] Auto-resets after 5 seconds
- [ ] Works in full-screen kiosk mode
- [ ] Works offline

**Admin Dashboard:**
- [ ] Shows real-time check-ins
- [ ] Activity feed updates live
- [ ] Can search students
- [ ] Can navigate to daily review
- [ ] Can navigate to forms

**Daily Review:**
- [ ] Lists all students for today
- [ ] Flags early/late times
- [ ] Can edit hours with reason
- [ ] Can force check-out
- [ ] Can bulk approve
- [ ] Can export CSV

**Form Generation:**
- [ ] Can generate single form
- [ ] Can batch generate all forms
- [ ] PDFs have correct data
- [ ] Can download merged PDF
- [ ] Can download ZIP

---

## Development Workflow

### Initial Setup
```bash
# 1. Clone and setup
git clone <repo>
cd vbs-volunteer-tracker
npm install

# 2. Setup Firebase
cd frontend
npm install
cd ../functions
npm install

# 3. Configure Firebase
# Copy .env.example to .env
# Fill in Firebase config values

# 4. Run dev server
cd frontend
npm run dev
```

### Working on a Feature
```bash
# 1. Create feature branch
git checkout -b feature/av-scanner

# 2. Work on feature
# Edit files in src/components/AVScanner/

# 3. Test locally
npm run dev

# 4. Commit and push
git add .
git commit -m "feat: Add AV scanner component"
git push origin feature/av-scanner
```

### Deploying
```bash
# 1. Build frontend
cd frontend
npm run build

# 2. Deploy to Firebase
firebase deploy --only hosting

# 3. Deploy functions
firebase deploy --only functions
```

---

## When to Ask for Clarification

Ask the human if:
- Feature requirements are ambiguous (check PRD first)
- Design decisions need input (e.g., color scheme, exact layout)
- Form templates differ significantly from assumptions
- Security rules need adjustment for new features
- Offline sync strategy needs modification
- Hour calculation edge cases not covered in PRD

---

## Quick Reference

**PRD Sections:**
- Check-in flow: Section 3.2
- Check-out flow: Section 3.3
- Hour calculation: Section 3.4
- Admin dashboard: Section 3.5
- Form generation: Section 3.6
- Database schema: Section 3.7-3.8

**Key Files:**
- Firebase config: `frontend/src/utils/firebase.js`
- Hour calculations: `frontend/src/utils/hourCalculations.js`
- Check-in function: `functions/src/checkIn.js`
- Check-out function: `functions/src/checkOut.js`

**Common Commands:**
```bash
npm run dev              # Start dev server
npm run build            # Build for production
npm run preview          # Preview production build
firebase deploy          # Deploy everything
firebase emulators:start # Run local emulators
```

---

## Notes for Future Enhancements

**Phase 4 Features (Post-MVP):**
- Student portal (view own hours)
- Parent email notifications
- Multi-event support
- Mobile apps (React Native)
- Advanced analytics

These are NOT in scope for initial launch. Focus on core MVP features first.

---

**Last Updated:** 2026-01-19  
**Version:** 1.0
```
