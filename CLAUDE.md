# CLAUDE.md - VBS Volunteer Tracker Development Guide

## Project Overview
This is a web-based volunteer hour tracking system for VBS (Vacation Bible School) events. Adult Volunteers (AV) scan student QR code lanyards for check-in/out, and admins review hours and generate school-required forms.

**Key Documents:**
- Full requirements: `docs/PRD.md`

---

## Guidelines & Rules

> [!IMPORTANT]
> **Testing Requirement**: New implementations must **ALWAYS** run unit tests, write new unit tests, and write E2E tests.

### Common Pitfalls
1. **Don't use client-side timestamps** - Use server `Timestamp.now()`
2. **Don't store rounded hours only** - Store both rounded and rawMinutes (PRD 3.4.1)
3. **Don't skip offline mode** - Church WiFi is unreliable; use `useOfflineSync`
4. **Don't hardcode event IDs** - Use `EventContext` for current event
5. **Don't forget cleanup** - Use `useEffect` return functions for listeners
6. **Always validate QR checksums** - Use `validateChecksum()` before processing

---

## Tech Stack

### Frontend (User & Admin)
- **Framework:** React 18 with Vite
- **Styling:** TailwindCSS (blue primary color theme)
- **State:** React Context API (AuthContext, EventContext)
- **Testing:**
  - **Unit:** Vitest (`npm test`)
  - **E2E:** Playwright (`npm run test:e2e`)
- **Key Libs:** `html5-qrcode` (scanning), `qrcode.react` (generation), `date-fns`, `idb` (offline storage)

### Backend (Firebase)
- **Functions:** Node 22 (Cloud Functions)
- **Database:** Firestore
- **Storage:** Firebase Storage
- **Auth:** Firebase Auth
- **Testing:** Jest (`npm test` in `functions/`)

---

## Development Commands

### Frontend (`cd frontend`)
| Command | Description |
| self | |
| `npm run dev` | Start dev server (localhost:3000) |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run test:coverage` | Run unit tests with coverage |
| `npm run test:e2e` | Run E2E tests (Playwright) |
| `npm run lint` | Run ESLint |

### Backend (`cd functions`)
| Command | Description |
| self | |
| `npm run serve` | Start function emulators |
| `npm run deploy` | Deploy functions to Firebase |
| `npm test` | Run backend unit tests (Jest) |
| `npm run logs` | View function logs |

### Root / Firebase
| Command | Description |
| self | |
| `firebase emulators:start` | Start all Firebase emulators |
| `firebase deploy` | Deploy all (hosting, functions, rules) |
| `npm run install-all` | Install dependencies for both frontend and functions |

---

## Project Structure & Architecture

### Key Directories
- `frontend/src/components/Scanner`: QR scanner logic
- `frontend/src/pages`: Main route components
- `frontend/src/contexts`: Global state (Auth, Event)
- `frontend/src/utils`: Helpers (hour calculations, QR generation)
- `functions/src`: Backend logic (checkIn, checkOut, userManagement)

### Core Data Models
- **Student**: `id`, `firstName`, `lastName`, `gradeLevel`, `overrideHours`
- **TimeEntry**: `id`, `studentId`, `eventId`, `checkInTime`, `checkOutTime`, `hoursWorked`, `status` (pending/approved/flagged)
- **Event**: `id`, `name`, `typicalStartTime`, `typicalEndTime`
- **Users**: `admins` (full access) vs `users` (scanner only)

### Authentication
- **Admin**: Full access to dashboard, students, events, and reports.
- **Adult Volunteer**: Access to scanner only (`/scan`).
- **Flow**: Firebase Auth -> Check `admins` collection -> Check `users` collection -> Set Role in Context.

### Hour Calculation Logic
- **0-14 min**: Round down
- **15-44 min**: Round to 0.5
- **45-59 min**: Round up
- **Flags**: Early arrival (>15m before start), Late stay (>15m after end)

### Offline Support
- Uses `idb` to store check-ins/outs when offline.
- Queues requests and syncs when connection is restored via `useOfflineSync`.
