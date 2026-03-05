export const CANDIDATE_STATUS_OPTIONS = [
  'Applied',
  'Screened',
  'Shortlisted',
  'Technical Interview 1',
  'Technical Interview 2',
  'HR Interview',
  'Selected',
  'Offered',
  'Offer Accepted',
  'Offer Declined',
  'Offer Revoked',
  'BGV',
  'Cancelled',
  'No Answer',
  'Candidate Not Interested',
  'Joined',
  'Rejected Technical Interview 1',
  'Rejected Technical Interview 2',
  'Rejected',
  'On Hold',
  'Withdrawn',
] as const

export type CandidateStatus = (typeof CANDIDATE_STATUS_OPTIONS)[number]

export const CANDIDATE_STATUS_LABELS: Record<CandidateStatus, string> = {
  Applied: 'Applied',
  Screened: 'Screened',
  Shortlisted: 'Shortlisted',
  'Technical Interview 1': 'Technical Interview 1',
  'Technical Interview 2': 'Technical Interview 2',
  'HR Interview': 'HR Interview',
  Selected: 'Selected',
  Offered: 'Offered',
  'Offer Accepted': 'Offer Accepted',
  'Offer Declined': 'Offer Declined',
  'Offer Revoked': 'Offer Revoked',
  BGV: 'BGV',
  Cancelled: 'Cancelled',
  'No Answer': 'No Answer',
  'Candidate Not Interested': 'Candidate Not Interested',
  Joined: 'Joined',
  'Rejected Technical Interview 1': 'Rejected Technical Interview 1',
  'Rejected Technical Interview 2': 'Rejected Technical Interview 2',
  Rejected: 'Rejected',
  'On Hold': 'On Hold',
  Withdrawn: 'Withdrawn',
}

export type CandidateStatusHistoryItem = {
  status: CandidateStatus
  comment?: string
  updatedAt?: string
  updatedByName?: string
  updatedByEmail?: string
  updatedByRole?: string
}

export type CandidateNote = {
  text: string
  createdAt?: string
}

export type CandidateResume = {
  fileName?: string
  filePath?: string
  mimeType?: string
  uploadedAt?: string
}

export type CandidateApiRecord = {
  id?: string
  _id?: string
  name?: string
  jobID?: string | { _id?: string; id?: string; jobTitle?: string; title?: string; department?: string; location?: string }
  role?: string
  email?: string
  contactDetails?: string
  location?: string
  skills?: string[]
  experience?: number
  education?: string
  noticePeriod?: number
  referal?: string
  recruiter?: string
  status?: string
  statusHistory?: CandidateStatusHistoryItem[]
  interviews?: CandidateInterview[]
  notes?: CandidateNote[]
  resume?: CandidateResume
  feedback?: string
  applicationMetrics?: CandidateApplicationMetrics
  createdAt?: string
  updatedAt?: string
}

export const INTERVIEW_STAGE_OPTIONS = [
  'Screening',
  'Technical Interview 1',
  'Technical Interview 2',
  'Technical Interview 3',
  'HR Interview',
  'Managerial Round',
  'Final Interview',
] as const

export type InterviewStage = (typeof INTERVIEW_STAGE_OPTIONS)[number]

export const INTERVIEW_RESULT_OPTIONS = ['Pending', 'Passed', 'Failed', 'On Hold', 'No Show', 'Rescheduled'] as const
export type InterviewResult = (typeof INTERVIEW_RESULT_OPTIONS)[number]

export type CandidateInterview = {
  _id?: string
  stage: InterviewStage
  interviewer?: {
    id?: string
    name?: string
    email?: string
    role?: string
  }
  coInterviewers?: Array<{
    id?: string
    name?: string
    email?: string
    role?: string
  }>
  scheduledAt?: string
  duration?: number
  meetingLink?: string
  location?: string
  completedAt?: string
  actualDuration?: number
  result?: InterviewResult
  rating?: number
  feedback?: string
  strengths?: string
  weaknesses?: string
  additionalNotes?: string
  createdByName?: string
  updatedByName?: string
  createdAt?: string
  updatedAt?: string
}

export type CandidateApplicationMetrics = {
  averageRating?: number
  totalInterviewsScheduled?: number
  totalInterviewsCompleted?: number
  totalInterviewsPassed?: number
  currentRound?: string
  daysInPipeline?: number
}

export type CandidateRecord = {
  id: string
  name: string
  jobID: string
  role?: string
  jobTitle?: string
  email: string
  contactDetails: string
  location: string
  skills: string[]
  experience: number
  education: string
  noticePeriod: number
  referal?: string
  recruiter?: string
  status: CandidateStatus
  statusHistory: CandidateStatusHistoryItem[]
  interviews: CandidateInterview[]
  notes: CandidateNote[]
  resume?: CandidateResume
  feedback?: string
  applicationMetrics?: CandidateApplicationMetrics
  createdAt?: string
  updatedAt?: string
}

export type CandidateFormValues = {
  name: string
  jobID: string
  email: string
  contactDetails: string
  location: string
  skills: string
  experience: string
  education: string
  noticePeriod: string
  referal: string
  recruiter: string
  status: CandidateStatus
  feedback: string
}

export type AddInterviewInput = {
  stage: InterviewStage
  interviewerId: string
  scheduledAt: string
  duration?: number
  meetingLink?: string
  location?: string
  coInterviewerIds?: string[]
}

export type UpdateInterviewInput = {
  stage?: InterviewStage
  interviewerId?: string
  scheduledAt?: string
  duration?: number
  meetingLink?: string
  location?: string
  result?: InterviewResult
  rating?: number
  feedback?: string
  strengths?: string
  weaknesses?: string
  additionalNotes?: string
  completedAt?: string
  actualDuration?: number
}

export type CandidateTimelineEvent = {
  type: 'status_change' | 'interview_scheduled' | 'interview_completed'
  date?: string
  data?: Record<string, unknown>
}

export type CandidateTimelineResponse = {
  candidate: {
    id: string
    name: string
    email: string
    currentStatus: CandidateStatus
    applicationMetrics?: CandidateApplicationMetrics
  }
  timeline: CandidateTimelineEvent[]
}
