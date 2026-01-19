# Product Requirements Document (PRD)
## VBS Student Volunteer Hour Tracking System

**Version:** 1.0  
**Date:** January 19, 2026  
**Author:** Product Team  
**Status:** Draft for Review

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
