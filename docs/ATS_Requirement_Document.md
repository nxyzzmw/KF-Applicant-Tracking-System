# Applicant Tracking System (ATS) Requirement Document

## 1. Project Overview

### 1.1 Purpose
Design and develop a user-friendly Applicant Tracking System (ATS) that streamlines recruitment, centralizes candidate data, tracks open positions, and generates automated weekly recruitment reports.

### 1.2 Objectives
- Simplify the end-to-end hiring workflow.
- Improve visibility of open positions.
- Track candidate status in real time.
- Generate weekly reports for open positions.
- Improve collaboration between HR and hiring managers.

## 2. User Roles and Access Control

| Role | Access Rights |
|---|---|
| Super Admin | Full system access, user management, report access/configuration |
| HR Recruiter | Create and manage jobs, manage candidates, schedule interviews, generate reports |
| Hiring Manager | View assigned jobs, review candidates, submit feedback |
| Interview Panel | View interview schedule, submit interview feedback |
| Management | Dashboard and reports view-only |

## 3. Functional Requirements

### 3.1 Job Management
- Create new job requisitions.
- Capture job details from JD:
  - Job Title
  - Department
  - Location
  - Employment Type
  - Experience Level
  - Salary Range
  - Hiring Manager
  - Number of Openings
  - Target Closure Date
- Job status tracking:
  - Open
  - On Hold
  - Closed/Filled
  - Cancelled
- Edit and archive job postings.

### 3.2 Candidate Management
- Candidate profile creation:
  - Manual entry
  - Resume upload
- Resume parsing (auto extraction):
  - Name
  - Contact Details
  - Location
  - Experience
  - Skills
  - Education
  - Notice Period
- Candidate tagging (examples):
  - Immediate Joiner
  - Referral
  - Internal Candidate
- Candidate status tracking:
  - Applied
  - Screened
  - Shortlisted
  - Technical Interview 1
  - Technical Interview 2
  - HR Round
  - Selected
  - Offered
  - Offer Accepted
  - Offer Declined
  - Offer Revoked
  - BGV
  - Cancelled
  - No Answer
  - Candidate Not Interested
  - Joined
  - Rejected Interview 1
  - Rejected Interview 2
- Notes and comments section per candidate.

### 3.3 Recruitment Workflow
- Configurable hiring stages per job.
- Interview scheduling with calendar integration (Microsoft Teams calendar support).
- Interview feedback form (rating + comments).
- Offer management module.
- Joining confirmation tracking.

### 3.4 Dashboard and Analytics
Dashboard should provide:
- Total Open Positions
- Positions Closed This Month
- Offer Acceptance Ratio
- Time to Fill (per position)
- Source of Hire

Visual charts should include:
- Hiring Funnel
- Weekly Hiring Status
- Department-wise Open Roles

## 4. Weekly Reporting (Key Requirement)
System must support automatic weekly report generation for open positions.

- Schedule: Every Friday at 10:00 AM (system time zone configurable)

### 4.1 Weekly Open Position Report Fields
For each open position, include:
- Job Title
- Department
- Hiring Manager
- Number of Openings
- Positions Filled
- Positions Pending
- Candidates in Each Stage
- Interviews Conducted (Current Week)
- Offers Released
- Offer Acceptance Status
- Ageing of Position (days open)

### 4.2 Report Features
- Export formats:
  - Excel
  - PDF
- Automated email delivery (weekly schedule, default Friday 10:00 AM).
- Filters:
  - Department
  - Job Title
  - Recruiter
  - Location
  - Date Range
- Historical report download.

## 5. Non-Functional Requirements

### 5.1 Usability
- Clean and intuitive UI.
- Fully responsive on desktop/tablet/mobile.
- Simple navigation.
- Minimal training requirement.
- Quick search capability.

### 5.2 Performance
- Initial page load under 3 seconds in normal network conditions.
- Support concurrent users without major UI degradation.
- Real-time updates for status changes.

### 5.3 Security
- Role-based access control.
- Secure login (OTP/2FA optional).
- Data encryption in transit and at rest.
- Backup and recovery mechanism.
- GDPR/data privacy compliance support.

### 5.4 Scalability
- Support increasing job and candidate volumes.
- Cloud deployment preferred.
- Integration-ready architecture (HRMS, job portals, email systems).

## 6. Integrations
- Email: Gmail / Outlook
- Calendar: Microsoft Teams / Outlook Calendar
- Job Portals: Naukri, LinkedIn (phase-wise)
- HRMS: future integration support

## 7. Search and Filtering
- Skill-based keyword search
- Job title filter
- Experience filter
- Location filter
- Salary filter
- Candidate/job status filter
- Recruiter-wise filter

## 8. Notifications and Alerts
- Interview reminders
- Job closure alerts (for recruiters)
- Weekly report notification
- Candidate follow-up reminders

## 9. Admin Control Panel
- User creation and role assignment
- Workflow customization
- Report configuration
- Email template customization
- Audit log tracking

## 10. Optional Advanced Features
- Careers page integration
- Diversity hiring analytics
- Employee referral tracking

## 11. UX Requirements for Landing and Loading Pages

### 11.1 Landing Page (Must Be Interesting)
The landing page should feel modern, branded, and action-driven.

Required elements:
- Strong hero section with clear value proposition.
- Distinct call-to-action buttons (e.g., "Get Started", "Book Demo").
- Feature highlights (jobs, candidate pipeline, weekly reports, analytics).
- Trust indicators (client logos/testimonials or usage stats).
- Responsive behavior across mobile and desktop.

Experience goals:
- Visual identity should be unique and memorable.
- Motion should be purposeful (not excessive).
- Key value should be understandable in under 5 seconds.

### 11.2 Loading Page (Must Be Interesting)
The loading experience should reduce perceived wait time and reinforce brand quality.

Required elements:
- Branded loader animation.
- Friendly loading messages (optional rotating hints).
- Smooth transition into the main screen.
- Accessible contrast and readable text.

Performance goals:
- Loader appears instantly when data is pending.
- No frozen UI state during loading.
- Skeletons/shimmer placeholders for key modules where possible.

## 12. Acceptance Criteria (High-Level)
- Role-based permissions are enforced for all major modules.
- Recruiter can create and manage jobs and candidates end to end.
- Candidate stage updates reflect immediately in workflow and dashboard.
- Weekly report is auto-generated every Friday at 10:00 AM and can be downloaded in Excel/PDF.
- Dashboard displays core recruitment KPIs and charts.
- Landing and loading pages are visually polished, responsive, and aligned with brand tone.
