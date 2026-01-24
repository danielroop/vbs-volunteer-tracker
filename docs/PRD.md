# Product Requirements Document (PRD)
## VBS Student Volunteer Hour Tracking System

**Version:** 2.0
**Date:** January 24, 2026
**Author:** Product Team
**Status:** Implementation In Progress

---

## Implementation Status Summary

> **Last Updated:** January 24, 2026

### Completed Features

| Feature | Section | Notes |
|---------|---------|-------|
| QR Code Lanyard Generation | 3.1.1 | Generates `studentId\|eventId\|checksum` format, printable badges (8 per page) |
| AV Scanner Check-In | 3.2.1 | Unified scanner component handles check-in with visual/audio feedback |
| AV Scanner Check-Out | 3.3.2 | Same scanner interface, detects check-in state |
| Hour Calculation & Rounding | 3.4.1 | Rounds to nearest 0.5 hour, stores raw minutes |
| Early/Late Flagging | 3.4.2 | Auto-flags arrivals >15min early or departures >15min late |
| Admin Dashboard | 3.5.1 | Real-time stats, activity feed, current attendance |
| User Role Management | N/A | Admin and Adult Volunteer roles with separate collections |
| Event Management | N/A | Create/edit events with multiple activities |
| Student Management | N/A | Add students, view roster, print badges |
| Authentication | 5.5 | Firebase Auth with Firestore role verification |
| Protected Routes | 5.5 | AdminRoute, ScannerRoute, ProtectedRoute |
| Offline Queue | 5.4 | IndexedDB queue for check-ins/outs when offline |
| PWA Support | 5.1 | Service worker, installable, offline-capable |
| Cloud Functions | 5.2 | checkIn, checkOut, userManagement (create/update/delete/list/resetPassword), forceCheckOut, forceAllCheckOut, getDailyReviewSummary |
| Firestore Security Rules | 5.5 | Role-based access control |
| Daily Review | 3.5.2 | Full daily review with force checkout, force all checkout, CSV/PDF export, search/filter, override reasons display |

### Partially Implemented

| Feature | Section | Status | Missing |
|---------|---------|--------|---------|
| Hour Adjustment | 3.5.3 | Partial | Full audit trail display, change history |
| Form Generation | 3.6.2 | Partial | PDF filling not implemented (returns data only) |
| OCPS Form Printing | 3.6.2 | Partial | Print layout exists but PDF generation incomplete |

### Not Yet Implemented

| Feature | Section | Priority | Description |
|---------|---------|----------|-------------|
| Self-Service Checkout Kiosk | 3.3.1 | P0 | Dedicated kiosk mode interface (currently uses unified scanner) |
| CSV Import from Realm | 3.7.1 | P0 | Bulk student import from church management system |
| Multi-Form Type Support | 3.6.1 | P0 | NJHS, NHS, Private school, Other form templates |
| Batch PDF Generation | 3.6.2 | P0 | Generate filled PDFs for all students |
| Friday Hour Estimation | 3.6.3 | P1 | Estimate hours for students not yet checked out |
| Duplicate Override | 3.2.1 | P2 | Allow override with reason for duplicate check-in |
| Manual Entry Fallback | 3.2.1 | P2 | Manual entry when QR damaged/unreadable |
| Student Portal | Phase 4 | Deferred | Students view own hours (no accounts) |
| Parent Notifications | Phase 4 | Deferred | Email on check-in/out |
| Multi-Event Support | Phase 4 | Deferred | Track across VBS, mission trips, etc. |

### Deviations from Original PRD

| PRD Specification | Actual Implementation |
|-------------------|----------------------|
| QR format: `studentId\|eventId\|studentName\|checksum` | `studentId\|eventId\|checksum` (name not included) |
| Separate AV Scanner and Self-Checkout pages | Unified Scanner component with action parameter |
| Student codes like "SJ-0042" | Uses Firestore document IDs |
| Form types stored per student | Not implemented yet (formType field missing) |
| Check-in/out methods: av_scan, self_scan, manual | Only av_scan implemented |
| Geolocation validation | Not implemented |

---

## 1. Executive Summary

### 1.1 Product Vision
A web-based volunteer hour tracking system for VBS (Vacation Bible School) events that uses lanyard QR codes and simple scanning to automatically track student volunteer hours, eliminating manual Excel calculations and enabling quick generation of school-required volunteer forms.

### 1.2 Problem Statement
Community Church currently tracks 130 student volunteer hours using QR codes and Google Forms, requiring students to manually enter times. This creates 5-6 hours of manual work weekly:
- 45-60 minutes nightly reviewing and calculating hours
- 2-3 hours Friday preparing and handwriting 130+ forms
- Error-prone manual calculations
- Chaotic end-of-event form distribution

### 1.3 Solution Overview
Replace manual time entry with physical lanyard QR code scanning:
- Adult Volunteers (AV) scan lanyards during morning distribution (automatic check-in)
- Students scan lanyards at self-service checkout station or return to AV at end of day
- Volunteer Admin (VA) reviews hours nightly via web dashboard
- System generates school-specific forms automatically on Friday

### 1.4 Success Metrics
- Reduce admin time from 5-6 hours/week to 1-2 hours/week
- Zero manual hour calculations
- 100% accurate timestamps (vs manual entry errors)
- Forms ready to print in under 5 minutes (vs 2-3 hours)
- Support 130+ students with multiple school form types

---

## 2. User Personas

### 2.1 Student Volunteer (SV)
**Profile:** Ages 12-18 (grades 5-12) volunteering at VBS to earn community service hours for school requirements (Bright Futures scholarship, NHS/NJHS, private school requirements)

**Technical Profile:**
- 70% have smartphones, 30% do not
- Mix of tech-savvy (high schoolers) and less experienced (middle schoolers)
- No desire to create accounts or remember passwords

**Goals:**
- Get credit for all hours worked (including early arrival/late stay)
- Quick check-in/out process
- Accurate documentation for school submission

**Pain Points:**
- Forgetting to manually log times
- Disputes over hours worked
- Lost paper documentation

### 2.2 Adult Volunteer (AV)
**Profile:** Church volunteer responsible for operational scanning duties

**Goals:**
- Quick lanyard distribution in morning
- Simple scanning process (no training needed)
- Minimal time commitment

**Technical Comfort:** Basic (must be extremely simple)

### 2.3 Volunteer Admin (VA)
**Profile:** Church staff member or lead volunteer coordinator managing the VBS volunteer program

**Goals:**
- Verify all students physically present
- Quickly review and approve daily hours
- Generate accurate forms for multiple school types
- Minimal administrative burden

**Technical Comfort:** Intermediate (comfortable with web dashboards)

**Pain Points:**
- Manual Excel calculations (2-3 hours Thursday night)
- Friday chaos generating 130+ forms
- Handling multiple school form types
- Verifying early arrivals and late stays

---

## 3. Core Requirements

### 3.1 Lanyard & QR Code System

#### 3.1.1 Lanyard Generation
**Priority:** P0 (Must Have)

**Requirements:**
- Generate unique QR code for each registered student
- QR code encodes: `studentId|eventId|studentName|checksum`
- Printable format compatible with standard badge holders
- Include student name (human-readable) on badge
- Support batch generation (all 130 at once)

**Acceptance Criteria:**
- Admin can generate 130 unique lanyard QR codes in under 2 minutes
- QR codes work with standard phone cameras
- Each QR code is unique and non-duplicatable
- Printable on standard 8.5x11 paper (6-8 badges per sheet)

#### 3.1.2 Physical Lanyard Management
**Scope:** Out of system (church responsibility)
- Church prints badges
- Church provides physical lanyards
- Church stores/manages lanyards between days

---

### 3.2 Student Check-In Flow

#### 3.2.1 Morning Check-In (AV Scanning)
**Priority:** P0 (Must Have)

**User Flow:**
1. Student arrives at VBS
2. Approaches AV at lanyard distribution station
3. AV scans student's lanyard QR code using tablet/phone
4. System records check-in timestamp
5. System displays confirmation: "✓ [Student Name] checked in at 9:02 AM"
6. AV hands lanyard to student
7. Student proceeds to VBS activities

**Technical Requirements:**
- **AV Scanner Interface** (web page):
  - Large "SCAN NEXT LANYARD" button/prompt
  - Camera access for QR scanning
  - Instant feedback (< 1 second)
  - Audio confirmation (optional beep)
  - Shows last 5 scanned students (confirmation list)
  - Works offline (sync when connection returns)
- **Duplicate Prevention:**
  - If lanyard already checked in today: show warning "Already checked in at 9:00 AM"
  - Allow override with reason (in case student returned lanyard and came back)

**Time Target:** 5 seconds per student (130 students in ~10-15 minutes)

**Edge Cases:**
- Student not pre-registered → show "Not Found" → AV alerts VA
- Lanyard damaged/unreadable → manual entry option for AV
- Wrong date on lanyard (from previous year) → warning message

---

### 3.3 Student Check-Out Flow

#### 3.3.1 Self-Service Check-Out Station
**Priority:** P0 (Must Have)

**User Flow:**
1. Student ready to leave (anytime during day)
2. Approaches self-checkout station (iPad/tablet at exit)
3. Scans own lanyard QR code
4. System records check-out timestamp
5. System displays:
   ```
   ✓ Checked Out!
   
   [Student Name]
   Today: 6.5 hours
   Week Total: 26.5 hours
   
   Return lanyard to collection bin →
   ```
6. Student returns lanyard to bin
7. Student leaves

**Technical Requirements:**
- **Self-Checkout Interface** (web page, kiosk mode):
  - Full-screen "SCAN TO CHECK OUT" prompt
  - Large, clear instructions
  - Camera access for QR scanning
  - Auto-reset after 5 seconds (ready for next student)
  - Works offline (critical for end-of-day rush)
  - No navigation away from checkout screen (locked kiosk mode)

**Time Target:** 5 seconds per student

**Edge Cases:**
- Not checked in yet → "You haven't checked in today"
- Already checked out → "Already checked out at 3:00 PM. Total: 6.5 hours"
- Scanning wrong QR code → "Invalid code, try again"

#### 3.3.2 AV Collection (End of Day Backup)
**Priority:** P0 (Must Have)

**User Flow:**
1. 3:00 PM dismissal time
2. Students return lanyards to AV at collection station
3. AV scans each lanyard as received
4. System records check-out timestamp (if not already checked out)
5. AV places lanyard in storage

**Technical Requirements:**
- Same AV Scanner Interface used for check-in
- Detects if student already self-checked-out → shows confirmation only
- If not checked out yet → records timestamp and confirms

**Purpose:** Backup for students who forgot to self-checkout

---

### 3.4 Hour Calculation Logic

#### 3.4.1 Time Tracking Rules
**Priority:** P0 (Must Have)

**Calculation Rules:**
1. **Check-in time** = exact timestamp when lanyard scanned by AV
2. **Check-out time** = exact timestamp when lanyard scanned (self or AV)
3. **Duration** = check-out time minus check-in time
4. **Rounding** = Round to nearest 0.5 hour (30 minutes)
   - 0-14 minutes = round down
   - 15-44 minutes = round to 0.5
   - 45-59 minutes = round up to next hour

**Examples:**
```
9:02 AM - 3:15 PM = 6h 13m → 6.0 hours
9:02 AM - 3:18 PM = 6h 16m → 6.5 hours
8:45 AM - 4:15 PM = 7h 30m → 7.5 hours
```

#### 3.4.2 Early/Late Flagging
**Priority:** P0 (Must Have)

**Auto-Flagging Rules:**
- **Early arrival:** > 15 minutes before typical start (e.g., before 8:45 AM if typical is 9:00 AM)
- **Late stay:** > 15 minutes after typical end (e.g., after 3:15 PM if typical is 3:00 PM)
- Flagged times appear in nightly review for VA spot-check

**VA Actions on Flagged Times:**
- Approve as-is (add note: "Helped with setup")
- Adjust time (e.g., change 8:30 AM to 9:00 AM if not actually working)
- Hours only counted if VA approves

---

### 3.5 Volunteer Admin (VA) Dashboard

#### 3.5.1 Real-Time Monitoring
**Priority:** P0 (Must Have)

**Dashboard Features:**
- **Live Stats:**
  - Currently checked in: 94 students
  - Checked out today: 36 students
  - Not yet arrived: 0 students
  - Real-time updates (no refresh needed)

- **Recent Activity Feed:**
  - Last 10 check-ins/check-outs with timestamps
  - Color coded: Green = check-out, Blue = check-in
  
- **Current Attendance List:**
  - Searchable/sortable list of who's checked in
  - Filter: "Currently here" / "Checked out" / "Not arrived"

**Access:** Web dashboard, accessible from any device

**Use Case:** VA can monitor throughout day, identify students who forgot to check out

#### 3.5.2 Daily Review (Nightly)
**Priority:** P0 (Must Have)

**Review Interface:**
```
Daily Review - Monday, June 15, 2026

Status: ⚠️ 3 students still checked in | ✓ 127 completed

Filter: [All] [Flagged] [Approved] [Need Review]
Search: [____________]

Name              Code      In       Out      Hours   Status    Actions
────────────────────────────────────────────────────────────────────
Adams, John      JA-0001   9:00a    3:15p    6.5     ✓ Good    [Edit]
Brown, Sarah     SB-0003   9:15a    3:30p    6.5     ✓ Good    [Edit]
Chen, Maria      MC-0012   8:45a    4:15p    7.5     ⚠️ Flag   [Edit]
  → Early arrival + late stay - verify if working
Davis, James     JD-0034   9:00a    [Still]  --      🔴 No Out [Force Out]
...

[✓ Approve All Good Hours (125)]  [Review Flagged (3)]
```

**VA Workflow:**
1. Open daily review page
2. System auto-flags anomalies (early/late/missing checkout)
3. VA reviews flagged items:
   - Add note ("Helped with setup")
   - Adjust time if incorrect
   - Approve
4. Bulk approve remaining normal hours
5. Export daily report (PDF/CSV)

**Time Target:** 15-20 minutes for 130 students

#### 3.5.3 Hour Adjustment
**Priority:** P0 (Must Have)

**Edit Interface:**
```
Edit Hours - Maria Chen
Date: Monday, June 15, 2026

Check-In:  08:45 AM  [Change]
Check-Out: 04:15 PM  [Change]

Calculated Hours: 7.5 hours

Override Hours: [____] hours (optional)

Reason for Change (required):
┌─────────────────────────────────────┐
│ Arrived early to help with setup,  │
│ stayed late for cleanup             │
└─────────────────────────────────────┘

[Cancel]  [Save Changes]
```

**Audit Trail:**
- All changes logged with: VA name, timestamp, reason
- Original vs modified times displayed
- Change history viewable

---

### 3.6 Form Generation

#### 3.6.1 Multi-Form Support
**Priority:** P0 (Must Have - Critical Discovery)

**Form Types Required:**
1. **OCPS Standard Form** (Orange County Public Schools)
2. **NJHS Form** (National Junior Honor Society - middle school)
3. **NHS Form** (National Honor Society - high school)
4. **Private School Forms** (various - TBD based on school)
5. **Homeschool/Other** (generic state standard or custom)

**Form Selection Logic:**
- During registration: Student selects school → system tags with form type
- Or: Admin selects form type during generation
- System uses appropriate PDF template

**Research Needed (Pre-Development):**
- Obtain sample forms from each category
- Map common fields vs unique fields
- Determine if generic data export is needed as fallback

#### 3.6.2 PDF Form Generation
**Priority:** P0 (Must Have)

**Form Fields Auto-Filled:**
- Student name, school, grade, graduation year (from registration)
- Organization name: "Community Church VBS"
- Supervisor name: "Pastor John Smith" (from event setup)
- **Training Hours** (Line 1): Monday's hours only
- **VBS Week Hours** (Line 2): Tuesday-Friday cumulative
- **Total Hours:** Sum of both lines
- Dates: Individual dates and date ranges

**Fields Left Blank (Manual Completion):**
- Supervisor signature (VA signs physical form)
- Student signature (student signs at home)
- Parent signature (parent signs at home)
- Reflection section (student writes at home)

**Generation Options:**
- **Individual:** Generate one student's form
- **Batch:** Generate all 130 forms at once (merged PDF or ZIP)
- **By School:** Generate all students for specific school/form type

**Workflow:**
1. VA opens Form Generation page
2. Selects: "Generate All Forms" or filters by school
3. System generates PDFs (server-side)
4. VA downloads:
   - Single merged PDF (for batch printing)
   - OR individual PDFs
   - OR sends directly to printer
5. VA prints forms (10-15 minutes for 130 pages)
6. VA signs forms as students check out Friday

**Time Target:** Form generation < 5 minutes, printing 15 minutes

#### 3.6.3 Friday Workflow with Form Assumption
**Priority:** P1 (Should Have)

**Use Case:** VA wants to print forms at 2 PM for 3 PM dismissal (before all students checked out)

**Logic:**
- Students not yet checked out on Friday → system assumes typical hours (6 hours or based on their Mon-Thu average)
- Forms generated with estimated Friday hours
- If student checks out significantly different time (e.g., 1:30 PM vs 3:00 PM) → VA can:
  - **Option A:** Reprint corrected form (10 seconds)
  - **Option B:** Hand-correct printed form (cross out, write new total, initial)

**Benefits:** Reduces Friday chaos, forms ready before dismissal

---

### 3.7 Registration & Data Management

#### 3.7.1 Pre-Registration from Realm
**Priority:** P0 (Must Have)

**Integration Approach:**
- Church exports volunteer list from ACS Realm (CSV)
- VA uploads CSV to system
- System creates student records

**Data Imported:**
- Name (first, last)
- Email (likely parent's)
- Phone (likely parent's)
- Address
- Birthday
- Grade

**Additional Fields Collected (in system):**
- School name (for form type selection)
- Form type needed (OCPS / NJHS / NHS / Private / Other)

**Registration Deadline:**
- Hard deadline: June 1st
- Grace period: June 8th (unadvertised)
- Walk-ups rare → manual entry by VA (acceptable for MVP)

**Why Pre-Registration:**
- Enables lanyard printing before event starts
- Reduces Day 1 chaos
- All students known in advance

#### 3.7.2 Student Records
**Database Schema:**
```javascript
{
  studentId: "uuid",
  eventId: "evt-vbs2026",
  
  // From Realm import
  firstName: "Sarah",
  lastName: "Jones",
  email: "parent@email.com", // Parent's email
  phone: "407-555-1234", // Parent's phone
  address: "123 Main St, Orlando, FL",
  birthday: "2010-05-15",
  gradeLevel: "10th",
  
  // Additional fields
  schoolName: "Dr. Phillips High School",
  formType: "ocps" | "njhs" | "nhs" | "private" | "other",
  
  // System-generated
  studentCode: "SJ-0042", // For human reference
  lanyardQRCode: "https://vbstrack.app/q/abc123...",
  
  // Tracking
  registeredAt: "2026-05-28T10:00:00Z",
  lanyardPrinted: true,
  lanyardDistributed: false
}
```

---

### 3.8 Time Entry Records

#### 3.8.1 Database Schema
```javascript
{
  entryId: "uuid",
  studentId: "uuid",
  eventId: "uuid",
  date: "2026-06-15",
  
  // Timestamps
  checkInTime: "2026-06-15T09:02:00Z",
  checkInBy: "av_user_id", // Adult Volunteer who scanned
  checkInMethod: "av_scan", // av_scan | self_scan | manual
  
  checkOutTime: "2026-06-15T15:15:00Z",
  checkOutBy: "student_self" | "av_user_id",
  checkOutMethod: "self_scan" | "av_scan" | "manual",
  
  // Calculated
  hoursWorked: 6.5, // Rounded
  rawMinutes: 373, // Exact calculation for audit
  
  // Review status
  reviewStatus: "pending" | "flagged" | "approved" | "locked",
  flags: ["early_arrival", "late_stay"], // Empty array if none
  
  // Admin modifications
  originalCheckInTime: null, // Only if modified
  originalCheckOutTime: null,
  originalHours: null,
  modifiedBy: "va_user_id",
  modifiedAt: "2026-06-15T20:30:00Z",
  modificationReason: "Helped with setup, verified by staff",
  
  // Audit
  createdAt: "2026-06-15T09:02:00Z",
  updatedAt: "2026-06-15T20:30:00Z"
}
```

---

## 4. User Interfaces

### 4.1 AV Scanner Interface (Web Page)

**URL:** `https://vbstrack.app/scan/vbs2026`

**Layout:**
```
┌────────────────────────────────────────────┐
│  VBS 2026 - Volunteer Scanner             │
│  Community Church                          │
├────────────────────────────────────────────┤
│                                            │
│  [Camera View - QR Scanner Active]        │
│                                            │
│  👆 Point camera at lanyard QR code       │
│                                            │
├────────────────────────────────────────────┤
│  Recent Scans:                             │
│  ✓ Sarah Jones - IN - 9:02 AM             │
│  ✓ John Smith - IN - 9:01 AM              │
│  ✓ Maria Garcia - IN - 9:00 AM            │
│                                            │
│  Total scanned: 23                         │
│                                            │
│  [Switch to Check-Out Mode]               │
│  [Admin Dashboard]                         │
│                                            │
└────────────────────────────────────────────┘
```

**Features:**
- Auto-start camera on page load
- Continuous scanning (no button press needed)
- Audio beep on successful scan
- Visual flash confirmation
- Shows last 5 scans for verification
- Works offline, syncs when online

**Error States:**
- Camera permission denied → show instructions
- Unrecognized QR code → "Invalid code, try again"
- Already checked in → "Already checked in at 9:00 AM. Scanning again? [Override]"

---

### 4.2 Self-Checkout Station (Kiosk Mode)

**URL:** `https://vbstrack.app/checkout/vbs2026`

**Layout:**
```
┌────────────────────────────────────────────┐
│                                            │
│         👋 CHECK OUT                       │
│                                            │
│  [Camera View - QR Scanner Active]        │
│                                            │
│                                            │
│  Scan your lanyard to check out           │
│                                            │
│  Then return lanyard to bin →             │
│                                            │
│                                            │
│  🟢 Currently: 94 students                │
│                                            │
└────────────────────────────────────────────┘
```

**After Successful Scan:**
```
┌────────────────────────────────────────────┐
│                                            │
│  ✓ See You Tomorrow!                       │
│                                            │
│  Sarah Jones                               │
│                                            │
│  Check-Out: 3:15 PM                        │
│  Today: 6.5 hours                          │
│  Week Total: 26.5 hours                    │
│                                            │
│  Return lanyard to bin →                  │
│                                            │
│  (Auto-reset in 5 seconds)                 │
│                                            │
└────────────────────────────────────────────┘
```

**Features:**
- Full-screen kiosk mode (no browser chrome)
- Auto-reset after 5 seconds
- Large text (readable from 3 feet away)
- Guided Access mode enabled (iPad locked to this page)
- Works offline
- No navigation away from page

---

### 4.3 VA Dashboard (Full Admin Interface)

**URL:** `https://vbstrack.app/admin` (password protected)

**Main Dashboard:**
```
┌──────────────────────────────────────────────────────────┐
│  VBS Volunteer Tracker              👤 Admin  🔓 Logout │
├──────────────────────────────────────────────────────────┤
│  VBS 2026 - Community Church                             │
│  Monday, June 15, 2026  |  2:47 PM                       │
├──────────────────────────────────────────────────────────┤
│  [Dashboard] [Daily Review] [Forms] [Students] [Reports] │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  📊 TODAY'S OVERVIEW                                     │
│  🟢 Checked In: 94  |  ✓ Checked Out: 36  |  Total: 130 │
│                                                           │
│  🔔 RECENT ACTIVITY                                      │
│  2:47 PM  Sarah Jones    ✓ Out  6.5 hrs                 │
│  2:45 PM  John Smith     ✓ Out  6.0 hrs                 │
│  2:43 PM  Maria Garcia   ✓ Out  6.5 hrs                 │
│                                                           │
│  ⚠️ NEEDS ATTENTION                                      │
│  • 3 students checked in >6 hours (may have forgotten)  │
│  • 5 early/late times flagged for review                │
│                                                           │
│  🎯 QUICK ACTIONS                                        │
│  [Review Today] [Generate Forms] [Export Report]         │
│  [Search Student] [Print Lanyards] [Settings]            │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

**Navigation Tabs:**
1. **Dashboard** - Real-time overview (shown above)
2. **Daily Review** - Review/approve day's hours
3. **Forms** - Generate student forms
4. **Students** - View/search all registered students
5. **Reports** - Export data, weekly summaries

---

### 4.4 Daily Review Interface

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│  Daily Review - Monday, June 15, 2026                    │
├──────────────────────────────────────────────────────────┤
│  Status: ⚠️ 3 pending  |  ✓ 127 approved                │
│                                                           │
│  🔍 [All ▼] [Flagged] [Approved]   Search: [_________]  │
├──────────────────────────────────────────────────────────┤
│  Name          In      Out     Hours  Status    Actions  │
│  ──────────────────────────────────────────────────────  │
│  Adams, John   9:00a   3:15p   6.5    ✓ Good    [Edit]  │
│  Brown, Sarah  9:15a   3:30p   6.5    ✓ Good    [Edit]  │
│  Chen, Maria   8:45a   4:15p   7.5    ⚠️ Flag   [Edit]  │
│    💬 Early arrival (8:45) + late stay (4:15)            │
│        [Approve As-Is] [Adjust Hours]                    │
│  Davis, James  9:00a   [None]  --     🔴 NoOut  [Edit]  │
│    ⚠️ No checkout recorded                               │
│        [Force Check-Out]                                 │
│  ...                                                      │
│                                                           │
│  [✓ Approve All Good (125)] [Export Daily Report]       │
└──────────────────────────────────────────────────────────┘
```

**Bulk Actions:**
- Approve all non-flagged hours (one click)
- Export daily report (PDF/CSV)
- Filter by status, search by name

**Individual Actions:**
- Edit hours (opens modal with time adjustment)
- Add note (explain early/late)
- Force check-out (for forgotten checkouts)

---

### 4.5 Form Generation Interface

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│  Form Generation - Friday, June 19, 2026                 │
├──────────────────────────────────────────────────────────┤
│  ✓ Mon-Thu hours reviewed and approved                   │
│  ⏳ Friday: 78 students still checked in                 │
│                                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Generate Forms for All Students (130)             │ │
│  │                                                     │ │
│  │  Students still checked in will have estimated    │ │
│  │  Friday hours (~6 hrs based on averages)          │ │
│  │                                                     │ │
│  │  [Generate All Forms]                              │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
│  OR generate by school/form type:                        │
│  [OCPS (85 students)] [NJHS (25)] [NHS (15)] [Other (5)]│
│                                                           │
│  OR search individual: [____________] 🔍                 │
│                                                           │
├──────────────────────────────────────────────────────────┤
│  📥 GENERATED FORMS                                      │
│  Name             Form Type  Hours  Generated  Download  │
│  ───────────────────────────────────────────────────────│
│  (Forms appear here after generation)                    │
│                                                           │
│  [Download All as PDF] [Download as ZIP] [Print All]    │
└──────────────────────────────────────────────────────────┘
```

**After Generation:**
- Download single merged PDF (130 pages)
- Download ZIP of individual PDFs
- Send directly to printer
- Reprint individual forms if needed

---

## 5. Technical Architecture

### 5.1 Technology Stack

**Frontend: Progressive Web App (PWA)**
```
• React or Svelte - Modern web framework
• TailwindCSS - Responsive styling
• PWA Manifest - Installable, offline capable
• Service Worker - Offline functionality, caching
• QR Scanner Library - jsQR or html5-qrcode
```

**Backend: Firebase or Supabase**
```
Firebase Option:
• Firestore - Real-time database
• Cloud Functions - PDF generation, business logic
• Firebase Storage - PDF file storage
• Firebase Hosting - Web app hosting
• Firebase Auth - Admin authentication only

Supabase Alternative:
• PostgreSQL - Database
• Supabase Functions - Serverless logic
• Supabase Storage - File storage
• Vercel/Netlify - Frontend hosting
```

**PDF Generation:**
```
• pdf-lib (JavaScript) - Fill PDF form fields
• OR PDFKit - Generate PDFs from scratch
• Runs server-side (Cloud Functions)
```

**QR Code Generation:**
```
• qrcode (npm package) - Generate QR codes
• Format: PNG or SVG for printing
```

### 5.2 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    USER DEVICES                         │
│  AV Phone/Tablet | Student Self-Scan iPad | VA Laptop   │
│  (Web Browser with Camera)                              │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS
                         ▼
┌─────────────────────────────────────────────────────────┐
│              PROGRESSIVE WEB APP (PWA)                  │
│  https://vbstrack.app                                   │
│  ┌───────────────────────────────────────────────────┐ │
│  │  /scan       - AV scanner interface               │ │
│  │  /checkout   - Self-checkout kiosk                │ │
│  │  /admin      - VA dashboard (password protected)  │ │
│  │  /q/:code    - Lanyard QR redirect                │ │
│  └───────────────────────────────────────────────────┘ │
└────────────────────────┬────────────────────────────────┘
                         │ API Calls
                         ▼
┌─────────────────────────────────────────────────────────┐
│              FIREBASE BACKEND                           │
│  ┌───────────────────────────────────────────────────┐ │
│  │  Firestore Database:                              │ │
│  │    - Students (130 records)                       │ │
│  │    - TimeEntries (130/day × 5 days = 650)        │ │
│  │    - Events, DailyReviews, GeneratedForms        │ │
│  │                                                    │ │
│  │  Cloud Functions:                                 │ │
│  │    - checkIn(studentId, scannedBy)                │ │
│  │    - checkOut(studentId, method)                  │ │
│  │    - generateForms(eventId, students[])           │ │
│  │    - calculateHours(checkIn, checkOut)            │ │
│  │                                                    │ │
│  │  Storage:                                         │ │
│  │    - Generated PDF forms                          │ │
│  │    - Exported reports                             │ │
│  │                                                    │ │
│  │  Hosting:                                         │ │
│  │    - Serve PWA (static files)                     │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 5.3 Data Flow Examples

**Check-In Flow:**
```
1. AV scans lanyard QR code
2. QR code contains: studentId + eventId
3. Browser sends POST /api/checkin {studentId, eventId, scannedBy: avUserId}
4. Server validates:
   - Student registered for this event?
   - Not already checked in today?
   - Geolocation within bounds? (optional)
5. Server creates TimeEntry record with checkInTime
6. Server returns success + student name
7. Browser displays confirmation
8. Real-time update pushed to VA dashboard (Firestore listener)
```

**Form Generation Flow:**
```
1. VA clicks "Generate All Forms" on Friday
2. Browser sends POST /api/generateForms {eventId, students: [130 IDs]}
3. Server Cloud Function:
   - For each student:
     - Query all TimeEntries for this event
     - Calculate Training Hours (Monday)
     - Calculate VBS Week Hours (Tue-Fri, estimated if not checked out)
     - Load appropriate PDF template based on student.formType
     - Fill PDF fields (name, hours, dates, supervisor)
     - Save filled PDF to Storage
   - Merge all PDFs into single file (optional)
4. Server returns: {forms: [{studentId, pdfUrl},...]}
5. Browser displays download links
6. VA downloads and prints
```

### 5.4 Offline Functionality

**Critical for Church WiFi Reliability:**

**What Works Offline:**
- AV scanning (check-ins/outs stored locally, sync when online)
- Self-checkout station (same local storage approach)
- View cached dashboard data (read-only)

**Implementation:**
- Service Worker caches app shell and critical assets
- IndexedDB stores pending check-ins/outs
- Background sync API syncs when connection restored
- Visual indicator when offline: "⚠️ Offline - 3 pending syncs"

**What Requires Internet:**
- Initial registration data load
- PDF form generation (server-side processing)
- Real-time dashboard updates
- Admin modifications to hours

### 5.5 Security & Privacy

**Authentication:**
- **No student authentication** (no accounts, no passwords)
- **Admin authentication only:** Simple password for VA dashboard
- **AV authentication:** Optional simple PIN or use same admin login

**Data Security:**
- HTTPS/TLS encryption for all connections
- Firestore security rules:
  - Students collection: Read-only from client
  - TimeEntries: Write-only during scan, read-only for VA
  - Admin endpoints: Authenticated only
- No sensitive data collected (no SSN, no payment info)

**Privacy Compliance:**
- **COPPA (under 13):** No accounts = reduced regulation burden
- Minimal data: Name, grade, check-in times only
- Parent email stored (but not student's)
- Data retention: 90 days post-event, then auto-delete (or admin option)

**QR Code Security:**
- QR codes include checksum to prevent tampering
- Server validates: studentId + eventId + checksum match
- QR codes are event-specific (can't use VBS 2025 lanyard for VBS 2026)

---

## 6. User Stories & Acceptance Criteria

### 6.1 Epic 1: Lanyard Check-In System

**User Story 1.1: AV Morning Distribution**
```
As an Adult Volunteer,
I want to quickly scan lanyards as I hand them out,
So that students are checked in without manual data entry.

Acceptance Criteria:
✓ Scan completes in under 5 seconds per student
✓ Visual and audio confirmation for each scan
✓ Displays last 5 scans for verification
✓ Shows "Already checked in" warning if duplicate
✓ Works offline (syncs when online)
✓ Handles 130 students in under 15 minutes
```

**User Story 1.2: Student Self-Checkout**
```
As a Student Volunteer,
I want to scan my lanyard to check out when I leave,
So that my hours are accurately recorded without staff assistance.

Acceptance Criteria:
✓ Scan completes in under 5 seconds
✓ Displays today's hours and week total
✓ Clear instruction to return lanyard
✓ Auto-resets for next student after 5 seconds
✓ Works offline
✓ Prevents duplicate checkout (shows "Already checked out")
```

**User Story 1.3: AV End-of-Day Collection**
```
As an Adult Volunteer,
I want to scan lanyards as students return them at dismissal,
So that students who forgot to self-checkout still get recorded.

Acceptance Criteria:
✓ Same scanner interface as morning check-in
✓ Detects if already checked out → shows confirmation only
✓ Records checkout time if not already done
✓ Handles 100+ lanyards in under 10 minutes
```

### 6.2 Epic 2: Admin Review & Approval

**User Story 2.1: Real-Time Monitoring**
```
As a Volunteer Admin,
I want to see who's currently checked in during the day,
So that I can monitor attendance and identify missing checkouts.

Acceptance Criteria:
✓ Dashboard updates in real-time (no refresh needed)
✓ Shows: checked in count, checked out count, not arrived
✓ Recent activity feed (last 10 check-ins/outs)
✓ Searchable list of current attendees
✓ Accessible from any device (laptop, tablet, phone)
```

**User Story 2.2: Nightly Hour Review**
```
As a Volunteer Admin,
I want to review and approve each day's hours,
So that I can catch errors before final forms are generated.

Acceptance Criteria:
✓ Auto-flags early arrivals, late stays, missing checkouts
✓ Shows full list of 130 students with hours
✓ Filter by status: All, Flagged, Approved, Need Review
✓ Bulk approve non-flagged hours (one click)
✓ Individual edit capability with reason tracking
✓ Export daily report (PDF and CSV)
✓ Complete review in 15-20 minutes
```

**User Story 2.3: Hour Adjustment**
```
As a Volunteer Admin,
I want to manually adjust hours with a documented reason,
So that I can correct errors while maintaining audit trail.

Acceptance Criteria:
✓ Edit interface shows original times clearly
✓ Reason field is required (can't save without it)
✓ Change history is visible (who, when, why)
✓ Original values preserved for audit
✓ Modified hours used in final calculations
```

### 6.3 Epic 3: Form Generation

**User Story 3.1: Multi-Form Type Support**
```
As a Volunteer Admin,
I want the system to generate different form types for different schools,
So that each student gets the correct form their school requires.

Acceptance Criteria:
✓ System supports 5+ form templates (OCPS, NJHS, NHS, Private, Other)
✓ Student's form type tagged during registration
✓ Correct template used automatically for each student
✓ Filter generation by form type: "Generate all NJHS forms"
✓ Form type visible in student list
```

**User Story 3.2: Batch Form Generation**
```
As a Volunteer Admin,
I want to generate all 130 forms at once on Friday,
So that I can print them before dismissal.

Acceptance Criteria:
✓ Generate all 130 forms in under 5 minutes
✓ Students not yet checked out: use estimated hours
✓ Download as single PDF or ZIP of individuals
✓ Send directly to printer option
✓ Shows progress bar during generation
✓ Lists which students have estimated vs actual Friday hours
```

**User Story 3.3: Individual Form Reprint**
```
As a Volunteer Admin,
I want to reprint a single student's form if their Friday hours differ from estimate,
So that I don't have to hand-correct or delay their form.

Acceptance Criteria:
✓ Search for student by name
✓ Generate/download individual PDF in under 10 seconds
✓ New PDF uses actual checked-out time
✓ Old PDF remains available (audit trail)
```

### 6.4 Epic 4: Registration & Setup

**User Story 4.1: Realm Data Import**
```
As a Volunteer Admin,
I want to import the volunteer list from Realm,
So that I don't have to manually enter 130 students.

Acceptance Criteria:
✓ Accept CSV export from Realm
✓ Map columns: Name, Email, Phone, Address, Birthday, Grade
✓ Import 130 records in under 2 minutes
✓ Show preview before confirming import
✓ Detect duplicates and prompt for action
✓ Allow adding school/form type after import
```

**User Story 4.2: Lanyard Batch Generation**
```
As a Volunteer Admin,
I want to generate and print all lanyards before VBS starts,
So that everything is ready for Day 1.

Acceptance Criteria:
✓ Generate 130 unique QR codes in under 2 minutes
✓ Download as printable PDF (8.5x11, 6 badges per sheet)
✓ Each badge shows: Student name + QR code
✓ QR codes encode: studentId + eventId + checksum
✓ Print template fits standard badge holders
```

---

## 7. Non-Functional Requirements

### 7.1 Performance

**Response Time:**
- QR scan to confirmation: < 1 second
- Dashboard page load: < 2 seconds
- Form generation (130 students): < 5 minutes
- Lanyard QR generation (130): < 2 minutes

**Scalability:**
- Support 150 concurrent users (130 students + 20 AV/VA)
- Handle 1,000+ check-ins/outs per day
- Store 5 years of historical data

**Reliability:**
- 99% uptime during event hours (8 AM - 5 PM)
- Offline mode for critical flows (check-in/out)
- Automatic retry for failed syncs

### 7.2 Usability

**Learnability:**
- AV can learn scanner interface in < 2 minutes
- VA can complete first daily review in < 30 minutes (with onboarding)
- Students require zero training (scan lanyard = intuitive)

**Accessibility:**
- WCAG 2.1 AA compliance for admin dashboard
- Large touch targets (44px minimum) for kiosk mode
- High contrast for outdoor iPad visibility
- Screen reader compatible (VA dashboard)

**Browser Compatibility:**
- Safari (iOS 12+) - iPhone, iPad
- Chrome (Android 9+)
- Chrome/Edge/Firefox (desktop)
- 98%+ device coverage

### 7.3 Data Integrity

**Accuracy:**
- Timestamps accurate to the second (server time, not client)
- Hour calculations mathematically correct (no rounding errors in storage)
- Audit trail for all modifications (who, when, what, why)

**Backup & Recovery:**
- Daily automated backups (Firestore export)
- Point-in-time recovery (7 days)
- Manual export capability (CSV) anytime

**Data Retention:**
- Active data: Duration of event + 90 days
- Archived data: 5 years (optional, admin choice)
- Deletion: Permanent after retention period (or on request)

### 7.4 Security

**Authentication:**
- Admin dashboard: Password protected (bcrypt hashing)
- Optional: Two-factor authentication for VA
- No student authentication required

**Authorization:**
- Role-based access: VA (full access), AV (scan only), Student (none)
- API endpoints validate roles server-side
- Firestore security rules enforce permissions

**Data Protection:**
- HTTPS/TLS 1.3 encryption in transit
- At-rest encryption (Firebase default)
- No PII beyond operational needs (name, grade only)
- COPPA compliant (no accounts for minors)

---

## 8. Technical Constraints & Assumptions

### 8.1 Constraints

**Infrastructure:**
- Must work with church WiFi (potentially unreliable) → Offline mode essential
- Must work on devices church already owns (iPads, AV phones) → No specialized hardware
- Budget: < $10/month ongoing costs → Free tier cloud services

**Integration:**
- Realm has no API → CSV export/import only (manual process)
- Multiple school form types → PDF templates required for each

**Deployment:**
- No IT staff at church → Must be simple web URL, no installations
- Updates must be instant → Web-based (not native apps)

### 8.2 Assumptions

**User Behavior:**
- 95%+ of students pre-registered by June 1st (remaining handled manually)
- AV available for 10-15 min morning distribution
- VA available for 15-20 min nightly review
- Students mostly remember to self-checkout (AV backup at 3 PM handles rest)

**Technical:**
- Church iPads are iOS 14+ or Android 9+ (modern browsers)
- Church has at least one computer with printer access
- Students' phones have working cameras (for QR scanning, if using phone)
- Internet available for initial data load and form generation (offline okay for scanning)

**Operational:**
- Church provides physical lanyards and badge holders
- Church prints lanyard badges before event
- Church has access to color printer (for badges) and B&W printer (for forms)

---

## 9. Development Phases

### 9.1 Phase 1: MVP (Weeks 1-4)

**Goal:** Core check-in/out functionality working for pilot test

**Week 1:**
- [ ] Project setup (React + Firebase)
- [ ] Database schema design
- [ ] Student and TimeEntry models
- [ ] Basic admin authentication

**Week 2:**
- [ ] AV Scanner interface (QR scan, check-in logic)
- [ ] Self-checkout kiosk interface
- [ ] Offline support (Service Worker, IndexedDB)
- [ ] Real-time sync to Firestore

**Week 3:**
- [ ] VA Dashboard (real-time monitoring)
- [ ] Daily review interface
- [ ] Hour calculation and rounding logic
- [ ] Flagging system (early/late)

**Week 4:**
- [ ] Hour adjustment interface
- [ ] CSV import (Realm data)
- [ ] Lanyard QR code generation
- [ ] Testing with pilot group (10-20 students)

**Deliverables:**
- Working check-in/out system
- Admin review dashboard
- Lanyard generation
- Ready for limited pilot test

### 9.2 Phase 2: Form Generation (Weeks 5-6)

**Goal:** Automated form generation working

**Week 5:**
- [ ] Research and obtain school form PDFs (OCPS, NJHS, NHS)
- [ ] PDF template mapping (identify fillable fields)
- [ ] PDF generation function (Cloud Function)
- [ ] Single student form generation

**Week 6:**
- [ ] Batch form generation (all 130)
- [ ] Multi-form type support
- [ ] Form download/print interface
- [ ] Friday estimation logic (students not checked out yet)

**Deliverables:**
- Working form generation
- Support for 3+ form types
- Batch printing capability

### 9.3 Phase 3: Polish & Production (Weeks 7-8)

**Goal:** Production-ready for full VBS 2026 deployment

**Week 7:**
- [ ] UI/UX improvements based on pilot feedback
- [ ] Performance optimization
- [ ] Error handling and edge cases
- [ ] Admin documentation and training materials

**Week 8:**
- [ ] Full-scale testing with 130 students (simulation or real)
- [ ] Security audit
- [ ] Backup/recovery procedures
- [ ] Launch preparation

**Deliverables:**
- Production-ready system
- Documentation and training
- Support plan

### 9.4 Phase 4: Future Enhancements (Post-MVP)

**Not Required for VBS 2026, but valuable for future:**

- [ ] Student portal (view own hours via web page)
- [ ] Parent notifications (email when student checks in/out)
- [ ] Multi-event support (track across VBS, mission trips, etc.)
- [ ] Mobile app versions (native iOS/Android) if demand exists
- [ ] API for direct Realm integration (if ACS provides API in future)
- [ ] Digital signatures (eliminate paper signing)
- [ ] Photo verification at check-in
- [ ] Geolocation tracking (map view of where students checked in)
- [ ] Advanced analytics (trends, patterns, reports)

---

## 10. Success Criteria & KPIs

### 10.1 Launch Criteria (Go/No-Go Decision)

**Before VBS 2026:**
- [ ] Pilot test completed with 10+ students
- [ ] AV can scan 10 lanyards in under 60 seconds
- [ ] VA can complete daily review in under 30 minutes
- [ ] Forms generate correctly for at least 2 form types
- [ ] Offline mode tested and working
- [ ] Zero critical bugs

### 10.2 Success Metrics (Post-Event)

**Primary KPIs:**
- **Time Savings:** Reduce admin time from 5-6 hours/week to < 2 hours/week ✅
- **Accuracy:** 95%+ of hours match actual attendance (verified by VA) ✅
- **Adoption:** 95%+ of students successfully use system ✅
- **Form Generation:** All 130 forms ready to print in < 5 minutes ✅

**Secondary KPIs:**
- Average check-in time: < 5 seconds per student
- Average checkout time: < 5 seconds per student
- Daily review time: 15-20 minutes (vs 45-60 currently)
- Friday form prep time: 30 minutes (vs 2-3 hours currently)
- Student satisfaction: 4+ stars (informal survey)
- VA satisfaction: "Would use again" = Yes

**Technical KPIs:**
- System uptime: 99%+ during event hours
- Offline sync success: 95%+ (pending syncs complete within 5 min of reconnection)
- Zero data loss incidents
- Bug severity: No P0/P1 bugs, < 5 P2 bugs

---

## 11. Risks & Mitigation

### 11.1 Technical Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Church WiFi fails during event | High | Medium | **Offline mode:** Check-ins/outs work offline, sync later. Paper backup as last resort. |
| iPad camera breaks | Medium | Low | **Backup device:** Keep spare iPad/phone. Manual entry option for VA. |
| QR codes won't scan (damaged/printed poorly) | Medium | Low | **High-quality printing:** Use church laser printer, test samples. Manual entry fallback. |
| Form templates don't match school requirements | High | Medium | **Pre-validation:** Obtain actual forms from schools before development. Pilot test with school counselors. |
| PDF generation fails for 130 students | High | Low | **Stress testing:** Test with 200 student simulation. Implement retry logic and error handling. |

### 11.2 Operational Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| AV unavailable for morning distribution | Medium | Low | **Train backup AV:** 2-3 people know scanner. VA can distribute if needed. |
| Students lose lanyards mid-day | Low | Medium | **Extra lanyards:** Print 10-20 extras. Quick reprint capability. |
| Students forget to self-checkout | Medium | Medium | **AV backup:** End-of-day collection by AV captures missed checkouts. VA can force-checkout in review. |
| VA doesn't complete nightly review | Medium | Low | **Flexible deadline:** Can review next morning. Friday forms can still generate. |
| Schools reject printed forms | High | Low | **Pre-approval:** Get written confirmation from 2-3 schools that printed forms acceptable. Pilot test with school counselor. |

### 11.3 User Adoption Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Students resist new system | Medium | Low | **Familiarity:** Still uses QR codes (like Google Forms). Simpler than old way (no typing). |
| AV finds scanner too complicated | Medium | Low | **Simplicity:** One-screen interface, continuous scanning. 2-minute training video. |
| VA overwhelmed by dashboard | Medium | Medium | **Training:** 30-min onboarding session. Step-by-step guide. Phone support during first week. |
| Parents concerned about data privacy | Low | Low | **Transparency:** Privacy policy, minimal data collection. No student accounts = less concern. |

### 11.4 Business Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Church decides not to pay after pilot | High | Low | **Pilot terms:** $75 pilot with clear success criteria. If criteria met, transition to $150 standard pricing. |
| Competitor enters market | Medium | Low | **Speed to market:** Launch before competitors. Customer relationship and customization as moat. |
| Form requirements change mid-event | Medium | Low | **Flexibility:** CSV export as fallback. Can add new form template in 1-2 hours. |
| Scope creep (church wants more features) | Medium | Medium | **Clear scope:** PRD defines MVP. Additional features quoted separately post-launch. |

---

## 12. Dependencies & Prerequisites

### 12.1 External Dependencies

**Before Development:**
- [ ] Obtain sample forms from schools (OCPS, NJHS, NHS, 2-3 private schools)
- [ ] Confirm printed forms acceptable to schools (written confirmation or pilot test with counselor)
- [ ] Church provides Realm CSV export (sample with 10-20 students for testing)
- [ ] Church confirms physical lanyard/badge specifications

**Before Launch:**
- [ ] Church completes student registration in Realm by June 1st
- [ ] Church prints 130+ lanyard badges (system generates PDFs)
- [ ] Church provides 2 iPads for kiosk mode (or confirms existing iPad availability)
- [ ] Church provides WiFi credentials and tests connectivity at check-in locations

### 12.2 Internal Prerequisites

**Development Environment:**
- [ ] Firebase project setup (or Supabase alternative)
- [ ] Domain registration (optional: vbstrack.app) or use Firebase subdomain
- [ ] Development, staging, and production environments
- [ ] Version control (Git repository)

**Team & Resources:**
- [ ] Developer(s) available (estimated 60-80 hours over 8 weeks)
- [ ] Church liaison identified (for Q&A, pilot coordination)
- [ ] Testing volunteers (10-20 students for pilot)

---

## 13. Open Questions & Decisions

### 13.1 Critical Questions (Must Resolve Before Development)

**Form Requirements:**
1. **Which specific schools' forms are needed?**
   - Action: Get list of schools represented (estimate 5-10 different schools)
   - Action: Obtain actual blank forms from top 5 schools
   - Decision: Determine if forms similar enough for generic template vs custom per school

2. **Do schools accept computer-printed forms with handwritten signatures?**
   - Action: Contact OCPS volunteer coordinator for official confirmation
   - Action: Contact NHS/NJHS chapter advisors at 2-3 schools
   - Decision: If NO, system becomes data export tool only (lower value, lower price)

3. **Is NJHS form significantly different from NHS/OCPS form?**
   - Action: Obtain both forms, compare fields
   - Decision: Separate templates needed or can use same with minor tweaks?

**Operational:**
4. **How many AV stations for lanyard distribution?**
   - 1 station = 10-15 min for 130 students (acceptable?)
   - 2 stations = 5-7 min (faster but requires 2 AVs)
   - Decision: Affects UI design (shared state across devices?)

5. **Where will kiosk iPads be positioned?**
   - Action: Church walk-through to identify best locations
   - Decision: Affects geofence setup and mounting requirements

6. **Who will be the pilot group?**
   - Action: Identify 10-20 volunteers willing to test 2 weeks before VBS
   - Timeline: Pilot test week of June 1-7, actual VBS June 15-19?

### 13.2 Design Decisions (Can Defer to Phase 2+)

**Nice-to-Have Features:**
7. Should students be able to view their hours via web page (without accounts)?
   - Pro: Empowers students, reduces "how many hours?" questions to VA
   - Con: Adds complexity, may not be necessary if forms generated at end
   - Decision: Defer to Phase 4, not needed for MVP

8. Should system send parent notifications on check-in/out?
   - Pro: Peace of mind for parents
   - Con: Requires email infrastructure, opt-in management
   - Decision: Defer to Phase 4

9. Should system support multiple events per year (not just VBS)?
   - Pro: More value for church, higher price justification
   - Con: Adds complexity (event selection, multi-event reports)
   - Decision: Single-event MVP, multi-event in Phase 4

---

## 14. Pricing & Business Model

### 14.1 Pricing Strategy

**Pilot Pricing (VBS 2026):**
- **$75 one-time** for Community Church
- Includes: Full system, all features, white-glove setup, daily support during event
- In exchange for: Feedback, testimonial, case study, refinement based on real use

**Standard Pricing (Future Churches):**

**Option A: Per-Event SaaS**
```
$150 per event
• Unlimited students (up to 200)
• All form types supported
• Email support
• Setup assistance
```

**Option B: Annual Subscription**
```
$400/year
• Unlimited events
• Unlimited students
• Priority support
• Custom form template requests (up to 3/year)
```

**Option C: Enterprise (Large Churches/Districts)**
```
$1,000/year
• Multi-location support
• Unlimited events and students
• Custom branding
• Phone support
• API access (if developed)
```

### 14.2 Value Proposition

**Time Savings for Church:**
- Eliminate 5-6 hours of manual work per week
- At $25-50/hr, that's $125-300 saved per event
- ROI: Positive at $150 pricing

**Additional Value:**
- Zero calculation errors
- Professional forms (vs handwritten)
- Audit trail for disputes
- Peace of mind (accurate documentation)

**Market Positioning:**
- Cheaper than full volunteer management systems ($500-1000+/year)
- More specialized than generic time tracking ($200-500/year)
- Addresses specific pain point (Bright Futures forms) that others don't

---

## 15. Post-Launch Plan

### 15.1 Immediate Post-Event (Week After VBS)

**Debrief Meeting with Church:**
- What worked well?
- What was frustrating or confusing?
- Which features were most valuable?
- What would you change?
- Would you pay $150 to use this next year?

**Data Analysis:**
- Total check-ins/outs processed
- Average check-in time (from logs)
- Number of admin adjustments needed
- Forms generated (by type)
- Time saved (self-reported by VA)

**Iteration Plan:**
- Document bugs encountered
- Prioritize top 3 improvements
- Determine if any changes needed before marketing to other churches

### 15.2 Expansion Strategy (Q3 2026)

**Target Market:**
- 50-100 churches in Central Florida (Orlando area)
- Focus on large churches (100+ volunteers per event)
- Reach via: Church networks, conferences, word-of-mouth

**Marketing Approach:**
- Case study: "How Community Church Saved 6 Hours/Week"
- Demo video (2 minutes showing check-in and form generation)
- Free pilot offer for 5 additional churches
- Referral program (existing customer refers new = $50 credit)

**Sales Process:**
1. Inbound inquiry (website, referral)
2. 15-min demo call
3. Send pilot proposal ($75 first event)
4. Setup call (30 min, walk through lanyard printing, scanner setup)
5. Pre-event check-in (1 week before)
6. Daily check-ins during event (text/email)
7. Post-event debrief
8. Convert to annual subscription ($400)

### 15.3 Product Roadmap (2026-2027)

**Q3 2026:**
- Launch to 5-10 pilot churches
- Refine based on feedback
- Add 2-3 additional form templates

**Q4 2026:**
- Public launch (website, marketing)
- Onboard 20-30 churches
- Build customer support process

**Q1 2027:**
- Multi-event support (VBS + mission trips + other)
- Student portal (view own hours)
- Parent notifications

**Q2 2027:**
- Native mobile apps (if demand exists)
- Advanced analytics
- API for third-party integrations

---

## 16. Appendices

### 16.1 Glossary

**ACS Realm:** Church management software used by Community Church for member database  
**AV:** Adult Volunteer - church volunteer who operates scanners  
**Bright Futures:** Florida scholarship program requiring documented community service hours  
**COPPA:** Children's Online Privacy Protection Act (applies to under-13)  
**Kiosk Mode:** Full-screen locked interface (typically on iPad)  
**MVP:** Minimum Viable Product - simplest version that solves core problem  
**NJHS:** National Junior Honor Society (middle school)  
**NHS:** National Honor Society (high school)  
**OCPS:** Orange County Public Schools (Florida)  
**PWA:** Progressive Web App - web application that works like native app  
**QR Code:** Quick Response code - 2D barcode scanned by phone cameras  
**SV:** Student Volunteer - students (ages 12-18) volunteering at VBS  
**VA:** Volunteer Admin - church staff managing volunteer program  
**VBS:** Vacation Bible School - summer youth program at churches  

### 16.2 References

**Similar Systems (Competitive Analysis):**
- Track It Forward (generic volunteer management)
- Better Impact (enterprise volunteer platform)
- VolunteerLocal (event-based volunteer tracking)
- SignUpGenius (scheduling, not time tracking)

**Technical Documentation:**
- Firebase Documentation: https://firebase.google.com/docs
- pdf-lib Library: https://pdf-lib.js.org/
- html5-qrcode Library: https://github.com/mebjas/html5-qrcode
- Progressive Web Apps: https://web.dev/progressive-web-apps/

**Compliance:**
- COPPA Guidelines: https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
- Florida Bright Futures Program: https://www.floridastudentfinancialaidsg.org/

### 16.3 Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-19 | Product Team | Initial PRD based on customer discovery |

---

## 17. Sign-Off & Approvals

This PRD should be reviewed and approved by:

- [ ] **Product Owner** - Confirms vision and scope
- [ ] **Development Lead** - Confirms technical feasibility
- [ ] **Church Liaison (VA)** - Confirms operational workflow
- [ ] **Legal/Privacy** - Confirms COPPA compliance approach
- [ ] **Stakeholder (AV Representative)** - Confirms scanner interface simplicity

**Target Approval Date:** January 31, 2026  
**Target Development Start:** February 3, 2026  
**Target Launch (Pilot):** June 15, 2026 (VBS 2026 Week 1)

---

**END OF PRD**
```

