import { useState } from 'react'
import type { JobFormValues } from '../../features/jobs/jobTypes'

type CreateJobPageProps = {
  saving: boolean
  error: string | null
  onCancel: () => void
  onSubmit: (values: JobFormValues) => Promise<void>
}

const defaultValues: JobFormValues = {
  title: '',
  department: 'Engineering',
  location: '',
  employmentType: 'Full-time',
  experienceLevel: 'Mid Level',
  salaryMin: '',
  salaryMax: '',
  hiringManager: '',
  openings: '1',
  targetClosureDate: '',
  skills: '',
  description: '',
}

function CreateJobPage({ saving, error, onCancel, onSubmit }: CreateJobPageProps) {
  const [form, setForm] = useState<JobFormValues>(defaultValues)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof JobFormValues, string>>>({})
  const [referralEnabled, setReferralEnabled] = useState(true)

  function validate(values: JobFormValues): Partial<Record<keyof JobFormValues, string>> {
    const errors: Partial<Record<keyof JobFormValues, string>> = {}
    if (!values.title.trim()) errors.title = 'Job Title is required'
    if (!values.department.trim()) errors.department = 'Department is required'
    if (!values.location.trim()) errors.location = 'Location is required'
    if (!values.employmentType.trim()) errors.employmentType = 'Employment Type is required'
    if (!values.experienceLevel.trim()) errors.experienceLevel = 'Experience is required'
    if (!values.salaryMin.trim()) errors.salaryMin = 'Salary Min is required'
    if (!values.salaryMax.trim()) errors.salaryMax = 'Salary Max is required'
    if (!values.hiringManager.trim()) errors.hiringManager = 'Hiring Manager is required'
    if (!values.openings.trim() || Number(values.openings) < 1) errors.openings = 'Openings should be at least 1'
    if (!values.targetClosureDate.trim()) errors.targetClosureDate = 'Target Closure Date is required'

    const salaryMin = Number(values.salaryMin)
    const salaryMax = Number(values.salaryMax)
    if (values.salaryMin.trim() && Number.isNaN(salaryMin)) errors.salaryMin = 'Salary Min must be a number'
    if (values.salaryMax.trim() && Number.isNaN(salaryMax)) errors.salaryMax = 'Salary Max must be a number'
    if (!Number.isNaN(salaryMin) && !Number.isNaN(salaryMax) && salaryMax < salaryMin) {
      errors.salaryMax = 'Salary Max should be greater than Salary Min'
    }
    return errors
  }

  function updateField<K extends keyof JobFormValues>(key: K, value: JobFormValues[K]) {
    setFormErrors((prev) => {
      if (!prev[key]) return prev
      return { ...prev, [key]: undefined }
    })
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validate(form)
    setFormErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    await onSubmit(form)
  }

  return (
    <form className="job-editor" onSubmit={(event) => void handleSubmit(event)}>
      <section className="page-head">
        <div>
          <p className="breadcrumb">Jobs / Create New Requisition</p>
          <h1>Create New Job Requisition</h1>
          <p className="subtitle">Specify the requirements and details for the new position to attract the best talent.</p>
        </div>
      </section>

      {error && <p className="panel-message panel-message--error">{error}</p>}

      <section className="editor-grid editor-grid--create">
        <article className="editor-card">
          <h3>
            <span className="material-symbols-rounded">info</span> Basic Information
          </h3>
          <div className="field">
            <label>Job Title</label>
            <input
              className={formErrors.title ? 'input-error' : ''}
              value={form.title}
              onChange={(event) => updateField('title', event.target.value)}
              placeholder="e.g. Senior Full Stack Engineer"
            />
            {formErrors.title && <small className="field-error">{formErrors.title}</small>}
          </div>
          <div className="field-row">
            <div className="field">
              <label>Department</label>
              <select className={formErrors.department ? 'input-error' : ''} value={form.department} onChange={(event) => updateField('department', event.target.value)}>
                <option>Engineering</option>
                <option>Product</option>
                <option>Design</option>
                <option>People</option>
              </select>
              {formErrors.department && <small className="field-error">{formErrors.department}</small>}
            </div>
            <div className="field">
              <label>Employment Type</label>
              <select className={formErrors.employmentType ? 'input-error' : ''} value={form.employmentType} onChange={(event) => updateField('employmentType', event.target.value)}>
                <option>Full-time</option>
                <option>Contract</option>
                <option>Part-time</option>
              </select>
              {formErrors.employmentType && <small className="field-error">{formErrors.employmentType}</small>}
            </div>
          </div>
          <div className="field">
            <label>Location</label>
            <input
              className={formErrors.location ? 'input-error' : ''}
              value={form.location}
              onChange={(event) => updateField('location', event.target.value)}
              placeholder="e.g. San Francisco, CA (or Remote)"
            />
            {formErrors.location && <small className="field-error">{formErrors.location}</small>}
          </div>
          <div className="field">
            <label>Description</label>
            <textarea
              rows={4}
              value={form.description}
              onChange={(event) => updateField('description', event.target.value)}
              placeholder="Add key responsibilities and role summary..."
            />
          </div>
        </article>

        <article className="editor-card">
          <h3>
            <span className="material-symbols-rounded">event_available</span> Hiring Logistics
          </h3>
          <div className="field">
            <label>Hiring Manager</label>
            <input
              className={formErrors.hiringManager ? 'input-error' : ''}
              value={form.hiringManager}
              onChange={(event) => updateField('hiringManager', event.target.value)}
              placeholder="Search by name..."
            />
            {formErrors.hiringManager && <small className="field-error">{formErrors.hiringManager}</small>}
          </div>
          <div className="field">
            <label>No. of Openings</label>
            <input className={formErrors.openings ? 'input-error' : ''} type="number" min={1} value={form.openings} onChange={(event) => updateField('openings', event.target.value)} />
            {formErrors.openings && <small className="field-error">{formErrors.openings}</small>}
          </div>
          <div className="field">
            <label>Target Closure Date</label>
            <input
              className={formErrors.targetClosureDate ? 'input-error' : ''}
              type="date"
              value={form.targetClosureDate}
              onChange={(event) => updateField('targetClosureDate', event.target.value)}
            />
            {formErrors.targetClosureDate && <small className="field-error">{formErrors.targetClosureDate}</small>}
          </div>
        </article>

        <article className="editor-card">
          <h3>
            <span className="material-symbols-rounded">checklist</span> Candidate Requirements
          </h3>
          <div className="field-row">
            <div className="field">
              <label>Experience</label>
              <select className={formErrors.experienceLevel ? 'input-error' : ''} value={form.experienceLevel} onChange={(event) => updateField('experienceLevel', event.target.value)}>
                <option>Entry Level</option>
                <option>Mid Level</option>
                <option>Senior Level</option>
              </select>
              {formErrors.experienceLevel && <small className="field-error">{formErrors.experienceLevel}</small>}
            </div>
            <div className="field">
              <label>Salary Range (Annual)</label>
              <div className="field-row">
                <input
                  className={formErrors.salaryMin ? 'input-error' : ''}
                  type="number"
                  value={form.salaryMin}
                  onChange={(event) => updateField('salaryMin', event.target.value)}
                  placeholder="Min (e.g. 120000)"
                />
                <input
                  className={formErrors.salaryMax ? 'input-error' : ''}
                  type="number"
                  value={form.salaryMax}
                  onChange={(event) => updateField('salaryMax', event.target.value)}
                  placeholder="Max (e.g. 180000)"
                />
              </div>
              {(formErrors.salaryMin || formErrors.salaryMax) && <small className="field-error">{formErrors.salaryMin ?? formErrors.salaryMax}</small>}
            </div>
          </div>
          <div className="field">
            <label>Skills & Keywords</label>
            <input
              value={form.skills}
              onChange={(event) => updateField('skills', event.target.value)}
              placeholder="React, Node.js, TypeScript"
            />
          </div>
        </article>

        <article className="editor-card editor-card--spotlight">
          <div className="editor-card__head">
            <h3>Posting Visibility</h3>
            <span className="status-chip">ACTIVE</span>
          </div>
          <p className="editor-muted">
            This requisition will be published to the internal job board and careers page immediately after approval.
          </p>
          <button type="button" className={`toggle ${referralEnabled ? 'is-on' : ''}`} onClick={() => setReferralEnabled((prev) => !prev)}>
            <span />
          </button>
          <p className="editor-muted">Internal Referral Program</p>
        </article>
      </section>

      <div className="editor-actions">
        <button type="button" className="ghost-btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save & Post Job'}
        </button>
      </div>
    </form>
  )
}

export default CreateJobPage
