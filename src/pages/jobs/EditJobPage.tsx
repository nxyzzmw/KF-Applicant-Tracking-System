import { useEffect, useState } from 'react'
import { SkeletonRows } from '../../components/common/Loader'
import type { JobFormValues, JobRecord } from '../../features/jobs/jobTypes'
import { toDateInputValue } from '../../utils/dateUtils'

type EditJobPageProps = {
  job: JobRecord | null
  loading: boolean
  saving: boolean
  error: string | null
  onBack: () => void
  onSubmit: (values: JobFormValues) => Promise<void>
}

type SalaryOption = {
  value: string
  label: string
  min: string
  max: string
}

const SALARY_OPTIONS: SalaryOption[] = [
  { value: '2-3', label: '2-3 (Annual)', min: '2', max: '3' },
  { value: '3-4', label: '3-4 (Annual)', min: '3', max: '4' },
  { value: '4-5', label: '4-5 (Annual)', min: '4', max: '5' },
  { value: '5-7', label: '5-7 (Annual)', min: '5', max: '7' },
  { value: '7+', label: '7+ (Annual)', min: '7', max: '7' },
]

function toFormValues(job: JobRecord): JobFormValues {
  return {
    title: job.title,
    department: job.department,
    location: job.location ?? '',
    employmentType: job.employmentType ?? 'Full-time',
    experienceLevel: job.experienceLevel ?? 'Mid Level',
    salaryMin: job.salaryMin ? String(job.salaryMin) : '',
    salaryMax: job.salaryMax ? String(job.salaryMax) : '',
    hiringManager: job.hiringManager ?? '',
    openings: String(job.openings),
    targetClosureDate: toDateInputValue(job.targetClosureDate),
    skills: job.skillsRequired?.join(', ') ?? '',
    description: job.description ?? '',
  }
}

function EditJobPage({ job, loading, saving, error, onBack, onSubmit }: EditJobPageProps) {
  const [form, setForm] = useState<JobFormValues | null>(null)

  useEffect(() => {
    if (job) setForm(toFormValues(job))
  }, [job])

  function updateField<K extends keyof JobFormValues>(key: K, value: JobFormValues[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  if (loading || !form) {
    return (
      <section className="table-panel">
        <div style={{ padding: '0.9rem' }}>
          <SkeletonRows rows={10} />
        </div>
      </section>
    )
  }
  if (!job) return <p className="panel-message panel-message--error">Job not found.</p>

  const selectedSalaryRange = SALARY_OPTIONS.find((option) => option.min === form.salaryMin && option.max === form.salaryMax)?.value ?? ''

  return (
    <form className="job-editor" onSubmit={(event) => { event.preventDefault(); void onSubmit(form) }}>
      <section className="page-head">
        <div>
          <p className="breadcrumb">Jobs / Edit Requisition</p>
          <h1>Edit {job.title}</h1>
          <p className="subtitle">Update requisition details and keep your pipeline current.</p>
        </div>
      </section>

      {error && <p className="panel-message panel-message--error">{error}</p>}

      <section className="editor-grid">
        <article className="editor-card">
          <h3>Basic Information</h3>
          <div className="field">
            <label>Job Title</label>
            <input value={form.title} onChange={(event) => updateField('title', event.target.value)} />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Department</label>
              <select value={form.department} onChange={(event) => updateField('department', event.target.value)}>
                <option>Engineering</option>
                <option>Product</option>
                <option>Design</option>
                <option>People</option>
              </select>
            </div>
            <div className="field">
              <label>Employment Type</label>
              <select value={form.employmentType} onChange={(event) => updateField('employmentType', event.target.value)}>
                <option>Full-time</option>
                <option>Contract</option>
                <option>Part-time</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label>Location</label>
            <input value={form.location} onChange={(event) => updateField('location', event.target.value)} />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea rows={6} value={form.description} onChange={(event) => updateField('description', event.target.value)} />
          </div>
        </article>

        <article className="editor-card">
          <h3>Hiring Logistics</h3>
          <div className="field">
            <label>Hiring Manager</label>
            <input value={form.hiringManager} onChange={(event) => updateField('hiringManager', event.target.value)} />
          </div>
          <div className="field">
            <label>No. of Openings</label>
            <input type="number" min={1} value={form.openings} onChange={(event) => updateField('openings', event.target.value)} />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Experience</label>
              <select value={form.experienceLevel} onChange={(event) => updateField('experienceLevel', event.target.value)}>
                <option>Entry Level</option>
                <option>Mid Level</option>
                <option>Senior Level</option>
              </select>
            </div>
            <div className="field">
              <label>Salary Range (Annual)</label>
              <select
                value={selectedSalaryRange}
                onChange={(event) => {
                  const selected = SALARY_OPTIONS.find((option) => option.value === event.target.value)
                  updateField('salaryMin', selected?.min ?? '')
                  updateField('salaryMax', selected?.max ?? '')
                }}
              >
                <option value="">Select salary range</option>
                {SALARY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Target Closure Date</label>
            <input type="date" value={form.targetClosureDate} onChange={(event) => updateField('targetClosureDate', event.target.value)} />
          </div>
          <div className="field">
            <label>Skills & Keywords</label>
            <input value={form.skills} onChange={(event) => updateField('skills', event.target.value)} placeholder="React, Node.js, TypeScript" />
          </div>
        </article>
      </section>

      <div className="editor-actions">
        <button type="button" className="ghost-btn" onClick={onBack}>
          Cancel
        </button>
        <button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Update Job'}
        </button>
      </div>
    </form>
  )
}

export default EditJobPage
