# Unimplemented Features - Future Work

> **Last Updated:** January 31, 2026 (Edit entries on Student Detail page implemented)
> This document lists features from the original PRD that are not yet implemented.

---

## Recently Completed

### Edit Entries on Student Detail Page (GitHub Issue #15)
**Completed:** January 31, 2026

**What was implemented:**
- ✅ Edit modal with same functionality as Daily Review page
- ✅ Edit button on each time entry row in the Student Detail page
- ✅ Displays original check-in and check-out times (read-only)
- ✅ Allows editing of both check-in and check-out times via datetime-local inputs
- ✅ Real-time calculated hours display
- ✅ Reason for change field (required)
- ✅ Previous change history display
- ✅ Full change log tracking with timestamps and descriptions
- ✅ Firestore updateDoc to persist changes
- ✅ Comprehensive unit tests for the new feature (23 tests in StudentDetailPage.test.jsx)

**Files Changed:**
- `frontend/src/pages/StudentDetailPage.jsx` (edit modal state, openEditModal, handleEditSave, Edit button, modal UI)
- `frontend/src/pages/StudentDetailPage.test.jsx` (new test file)

### Safari Print Compatibility Fix
**Completed:** January 31, 2026

**What was implemented:**
- ✅ `printUtils.js` - New utility module for Safari-compatible printing
- ✅ Browser detection functions (`isSafari`, `isIOSSafari`)
- ✅ `safePrint` function with proper timing for Safari rendering
- ✅ `printInNewWindow` function for PDF export with Safari load event handling
- ✅ `createPrintDocument` helper for generating print-ready HTML
- ✅ Updated StudentsPage, StudentDetailPage, and DailyReview to use new print utilities
- ✅ Increased print delay for Safari (500ms vs 150ms for Chrome/Firefox)
- ✅ Proper afterprint event handling with fallback timeout
- ✅ Comprehensive unit tests for all print utility functions (29 tests)

**Files Changed:**
- `frontend/src/utils/printUtils.js` (new)
- `frontend/src/utils/printUtils.test.js` (new)
- `frontend/src/pages/StudentDetailPage.jsx`
- `frontend/src/pages/StudentsPage.jsx`
- `frontend/src/components/DailyReview/index.jsx`

### New Component Tests Added
**Completed:** January 31, 2026

**What was implemented:**
- ✅ `PrintableBadge.test.jsx` - 18 tests covering badge rendering, QR codes, sizes, event names
- ✅ `DailyReview.test.jsx` - 24 tests covering rendering, stats, filters, table structure, exports

### Responsive Header with Hamburger Menu
**Completed:** January 25, 2026

**What was implemented:**
- ✅ Hamburger menu button for mobile views (below `md` breakpoint)
- ✅ Mobile menu slide-down panel with all navigation options
- ✅ Scan button added to both desktop navigation tabs and mobile menu
- ✅ User email displayed in mobile menu
- ✅ Logout option accessible from mobile menu
- ✅ Proper accessibility attributes (aria-expanded, aria-controls, aria-label)
- ✅ Active state highlighting for current route in both desktop and mobile views
- ✅ Automatic menu close when navigation link is clicked
- ✅ Comprehensive unit tests for all new hamburger menu and Scan link features

### Consistent Header Components
**Completed:** January 24, 2026

**What was implemented:**
- ✅ `Header.jsx` - Reusable admin header component with app title, active event indicator, user info/logout, and navigation tabs
- ✅ `ScannerHeader.jsx` - Minimal mobile-friendly header for scanner pages with user info, role badge, and dashboard link
- ✅ All admin pages updated to use consistent Header (Dashboard, DailyReview, Students, StudentDetail, Events, Users, Forms, CreateEvent)
- ✅ Scanner component updated to use ScannerHeader
- ✅ Navigation tabs (Dashboard, Daily Review, Students, Events, Users) visible on all admin pages
- ✅ Active event indicator displayed in header
- ✅ Responsive design for mobile devices
- ✅ Unit tests for both Header components

---

## Priority 0 (P0) - Critical for Full Functionality

### 1. Self-Service Checkout Kiosk Mode
**PRD Section:** 3.3.1

**Current State:** The unified Scanner component handles both check-in and check-out via URL parameters, but there's no dedicated kiosk mode interface.

**What's Missing:**
- Full-screen kiosk mode with locked navigation
- Large "SCAN TO CHECK OUT" prompt
- Auto-reset after 5 seconds
- Week total and daily hours display on success
- iPad Guided Access mode instructions
- Simplified UI for student self-service

**Suggested Tasks:**
```
1. Create KioskCheckoutPage component
2. Add full-screen mode with browser-chrome hiding
3. Implement auto-reset timer after successful checkout
4. Add large, accessible UI elements
5. Test on iPad with Guided Access mode
6. Add route /checkout/:eventId for kiosk mode
```

---

### 2. CSV Import from Realm (Church Management System)
**PRD Section:** 3.7.1

**Current State:** Students can only be added manually one at a time through the UI.

**What's Missing:**
- CSV file upload interface
- Column mapping for Realm export format
- Bulk student creation from CSV
- Duplicate detection and handling
- Preview before import
- Import validation and error reporting

**Suggested Tasks:**
```
1. Create CSVImportPage component in admin section
2. Add file upload with drag-and-drop
3. Implement CSV parsing with column detection
4. Create preview table with validation errors
5. Add bulk student creation Cloud Function
6. Handle duplicates (skip, update, or error)
7. Show import summary and any failures
```

**Expected CSV Fields from Realm:**
- Name (first, last)
- Email (parent's)
- Phone (parent's)
- Address
- Birthday
- Grade

---

### 3. Multi-Form Type Support
**PRD Section:** 3.6.1

**Current State:** Only OCPS form layout exists. Form type field is not stored on students.

**What's Missing:**
- Form type selection during registration/edit
- Multiple PDF templates (NJHS, NHS, Private, Other)
- Form type stored on student record
- Filter/batch generation by form type

**Suggested Tasks:**
```
1. Add formType field to student data model
2. Update student registration/edit forms with formType dropdown
3. Obtain actual form templates from schools
4. Create PDF templates for each form type
5. Update form generation to use correct template per student
6. Add batch generation by form type in FormGenerationPage
```

**Form Types to Support:**
- OCPS (Orange County Public Schools) - current
- NJHS (National Junior Honor Society)
- NHS (National Honor Society)
- Private School (generic or per-school)
- Homeschool/Other

---

### 4. PDF Form Generation (Complete)
**PRD Section:** 3.6.2

**Current State:** `generateForms` Cloud Function returns hours data but doesn't fill PDFs.

**What's Missing:**
- PDF template loading
- Field mapping and filling with pdf-lib
- Generated PDF storage in Firebase Storage
- Download URLs returned to client
- Batch PDF merging for bulk download
- ZIP file generation for individual downloads

**Suggested Tasks:**
```
1. Create PDF templates with fillable fields
2. Implement pdfFiller utility in Cloud Functions
3. Map student data and hours to form fields
4. Store generated PDFs in Firebase Storage
5. Return download URLs from generateForms function
6. Add PDF merge functionality for batch download
7. Implement ZIP generation for individual files
```

**Fields to Auto-Fill:**
- Student name, school, grade, graduation year
- Organization name, supervisor name
- Training hours (Monday only)
- VBS week hours (Tuesday-Friday)
- Total hours
- Date ranges

---

## Priority 1 (P1) - Important Enhancements

### ~~5. Force Check-Out Feature~~ ✅ IMPLEMENTED
**PRD Section:** 3.5.2

**Status:** Fully implemented on January 24, 2026

**Implemented Features:**
- ✅ `forceCheckOut` Cloud Function
- ✅ "Force Out" button in DailyReviewPage
- ✅ Modal with time picker and reason field (required)
- ✅ Forced checkouts flagged with `forced_checkout` flag
- ✅ Forced checkout indicator in review (shows in flags)
- ✅ Audit trail: forcedCheckoutReason, forcedCheckoutBy, forcedCheckoutAt

---

### 5. Friday Hour Estimation
**PRD Section:** 3.6.3

**Current State:** Form generation doesn't handle students not yet checked out.

**What's Missing:**
- Estimate Friday hours for unchecked-out students
- Use average of Mon-Thu or typical 6 hours
- Flag forms with estimated hours
- Allow reprint after actual checkout

**Suggested Tasks:**
```
1. Calculate average hours from Mon-Thu entries
2. Use estimate for Friday if not checked out
3. Add "estimated" flag to generated forms
4. Store estimated vs. actual in form metadata
5. Allow regeneration after student checks out
6. UI indicator showing which forms have estimates
```

---

### ~~6. Daily Review Enhancements~~ ✅ IMPLEMENTED
**PRD Section:** 3.5.2

**Status:** Fully implemented on January 24, 2026

**Implemented Features:**
- ✅ `forceCheckOut` Cloud Function - force checkout individual students with reason
- ✅ `forceAllCheckOut` Cloud Function - bulk checkout all remaining students using activity end times
- ✅ "Force All Checkout" button for end-of-day bulk checkout
- ✅ Force checkout defaults to activity end time
- ✅ PDF export with formatted daily summary (opens print dialog)
- ✅ CSV export functionality (downloads file)
- ✅ Status filter dropdown (All, Flagged, No Checkout, Modified)
- ✅ Student search/filter input
- ✅ Date picker to review any date
- ✅ Date column prominently displayed on each entry
- ✅ Activity column showing which bucket each entry belongs to
- ✅ Edit hours modal with reason field (required)
- ✅ Override reasons displayed on StudentDetailPage
- ✅ Real-time stats display (total, flagged, no checkout, modified)
- ✅ Original scan data preserved separate from override data (audit trail)

---

### 8. Hour Adjustment Audit Trail
**PRD Section:** 3.5.3

**Current State:** Basic modification fields exist but full audit trail is not displayed.

**What's Missing:**
- Change history display in UI
- Original vs modified values side by side
- Who made each change and when
- Modification reason visibility

**Suggested Tasks:**
```
1. Store complete modification history array
2. Create ChangeHistoryModal component
3. Display modification log in student detail page
4. Show original values alongside current values
5. Add "View History" button to time entries
```

---

## Priority 2 (P2) - Nice to Have

### 9. Duplicate Check-In Override
**PRD Section:** 3.2.1

**Current State:** Duplicate check-ins show error but no override option.

**What's Missing:**
- Override button when duplicate detected
- Reason field for override
- Log override with admin/AV info

**Suggested Tasks:**
```
1. Add override option in Scanner component
2. Create overrideCheckIn Cloud Function
3. Log override reason and who authorized
4. Show override confirmation
```

---

### 10. Manual Entry Fallback
**PRD Section:** 3.2.1

**Current State:** No way to manually enter check-in if QR is damaged.

**What's Missing:**
- Manual entry option for AV
- Student search/selection
- Manual check-in without QR

**Suggested Tasks:**
```
1. Add "Manual Entry" button to Scanner
2. Create student search/autocomplete
3. Allow check-in by selecting student
4. Flag manual entries for review
```

---

### 11. Student Codes (Human-Readable)
**PRD Section:** 3.7.2

**Current State:** Using Firestore document IDs instead of formatted codes like "SJ-0042".

**What's Missing:**
- Generate student codes on registration
- Display codes on badges
- Search by student code

**Suggested Tasks:**
```
1. Add studentCode field generation logic
2. Update badge printing to show code
3. Add code to student list display
4. Enable search by code
```

---

## Phase 4 (Deferred - Post-MVP)

### 12. Student Portal
**PRD Section:** Phase 4

Allow students to view their own hours via web page (without accounts).

**Potential Approach:**
- Unique URL per student (e.g., /hours/{studentToken})
- Token embedded in QR code or separate
- Read-only hours view
- Week-by-week breakdown

---

### 13. Parent Notifications
**PRD Section:** Phase 4

Email notifications to parents on check-in/out.

**Potential Approach:**
- SendGrid or Firebase Email Extension
- Opt-in during registration
- Configurable notification preferences
- Daily summary option

---

### 14. Multi-Event Support
**PRD Section:** Phase 4

Track volunteers across VBS, mission trips, and other events.

**Potential Approach:**
- Event selector in dashboard
- Cross-event hour totals
- Event archive/history
- Annual summary reports

---

### 15. Geolocation Validation
**PRD Section:** 5.3

Verify check-ins happen at church location.

**Potential Approach:**
- Store check-in coordinates
- Define geofence around church
- Flag out-of-bounds check-ins
- Optional enforcement vs. flagging only

---

## Development Priority Order

For the next development phase, recommended order:

1. **CSV Import** - Enables bulk student loading before VBS starts
2. **PDF Form Generation** - Critical for Friday form distribution
3. ~~**Force Check-Out**~~ ✅ Implemented
4. **Multi-Form Type** - Required for different schools
5. ~~**Daily Review Bulk Approve**~~ ✅ Implemented
6. **Friday Hour Estimation** - Enables pre-dismissal form printing
7. **Kiosk Mode** - Improves student self-checkout experience

---

## Estimation Notes

Each feature above represents approximately:

| Feature | Estimated Effort | Status |
|---------|-----------------|--------|
| CSV Import | 4-6 hours | Pending |
| PDF Form Generation | 6-8 hours | Pending |
| Multi-Form Type Support | 4-6 hours | Pending |
| ~~Force Check-Out~~ | ~~2-3 hours~~ | ✅ Done |
| Friday Estimation | 3-4 hours | Pending |
| ~~Daily Review Enhancements~~ | ~~4-6 hours~~ | ✅ Done |
| Kiosk Mode | 4-6 hours | Pending |
| Audit Trail Display | 3-4 hours | Pending |
| Duplicate Override | 2-3 hours | Pending |
| Manual Entry | 3-4 hours | Pending |

**Total for P0 features:** ~20-26 hours
**Total for P1 features:** ~6-8 hours (was ~12-17, reduced by ~6-9 hours)
**Total for P2 features:** ~8-11 hours

---

## Testing Requirements

For each feature, remember to:

1. Write unit tests before/during implementation
2. Test offline scenarios (church WiFi unreliability)
3. Test on mobile devices (iPad, phone)
4. Verify Firestore security rules cover new data
5. Test with realistic data volumes (130+ students)
