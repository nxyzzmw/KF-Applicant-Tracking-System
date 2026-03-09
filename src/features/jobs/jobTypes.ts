export type JobStatus = 'Open' | 'On Hold' | 'Closed' | 'Filled' | 'Cancelled'

export type JobApiRecord = {
  id?: string
  _id?: string
  title?: string
  jobTitle?: string
  reqId?: string
  requisitionId?: string
  department?: string
  status?: string
  jobStatus?: string
  filled?: number
  filledCount?: number
  openings?: number
  numberOfOpenings?: number
  openPositions?: number
  totalOpenings?: number
  salaryRange?: string
  emplyementType?: string
  employmentType?: string
  location?: string
  experienceLevel?: string
  hiringManager?: string
  targetClosureDate?: string
  description?: string
  skillsRequired?: string[]
  createdAt?: string
  updatedAt?: string
  updatedOn?: string
  modifiedAt?: string
  lastUpdatedAt?: string
  agingDays?: number
  applicantsCount?: number
  candidateCount?: number
  totalApplicants?: number
  appliedCandidates?: number
}

export type JobRecord = {
  id: string
  reqId: string
  title: string
  department: string
  location?: string
  employmentType?: string
  experienceLevel?: string
  salaryMin?: number
  salaryMax?: number
  hiringManager?: string
  status: JobStatus
  filled: number
  openings: number
  targetClosureDate?: string
  description?: string
  skillsRequired?: string[]
  agingDays: number
  candidatesApplied: number
  createdAt?: string
  updatedAt?: string
}

export type JobFormValues = {
  title: string
  department: string
  location: string
  employmentType: string
  experienceLevel: string
  salaryMin: string
  salaryMax: string
  hiringManager: string
  openings: string
  targetClosureDate: string
  skills: string
  description: string
}
