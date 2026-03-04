import { useEffect, useMemo, useState } from 'react'
import { addNoteToCandidate, createCandidate, uploadCandidateResume } from '../../features/candidates/candidateAPI'
import { CANDIDATE_STATUS_LABELS, CANDIDATE_STATUS_OPTIONS, type CandidateFormValues } from '../../features/candidates/candidateTypes'
import type { JobRecord } from '../../features/jobs/jobTypes'
import { useToast } from '../../components/common/ToastProvider'
import { getErrorMessage } from '../../utils/errorUtils'

type AddCandidatePageProps = {
  jobs: JobRecord[]
  initialJobId?: string | null
  onBack: () => void
  onCreated: (candidateId: string) => void
}

const defaultValues: CandidateFormValues = {
  name: '',
  jobID: '',
  email: '',
  contactDetails: '',
  location: '',
  skills: '',
  experience: '',
  education: '',
  noticePeriod: '',
  referal: '',
  recruiter: '',
  status: 'Applied',
  feedback: '',
}

function AddCandidatePage({ jobs, initialJobId, onBack, onCreated }: AddCandidatePageProps) {
  const { showToast } = useToast()
  const [form, setForm] = useState<CandidateFormValues>({ ...defaultValues, jobID: initialJobId ?? '' })
  const [entryMode, setEntryMode] = useState<'manual' | 'resume'>('manual')
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [parsedPreview, setParsedPreview] = useState<{ name: string; email: string; contact: string; skills: string } | null>(null)
  const [parserMessage, setParserMessage] = useState<string | null>(null)
  const [initialNote, setInitialNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const jobOptions = useMemo(
    () => jobs.map((job) => ({ id: job.id, label: `${job.title} (${job.reqId})` })),
    [jobs],
  )

  useEffect(() => {
    if (!initialJobId) return
    setForm((prev) => ({ ...prev, jobID: prev.jobID || initialJobId }))
  }, [initialJobId])

  function updateField<K extends keyof CandidateFormValues>(key: K, value: CandidateFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function parseResume(file: File) {
    if (!file.type.startsWith('text/')) {
      setParserMessage('Auto parser currently supports text resumes. Please complete fields manually.')
      return
    }
    setParserMessage('Resume parsed. Review and complete missing fields manually.')
    const text = await file.text()
    const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? ''
    const phone = text.match(/(\+?\d[\d\s-]{8,}\d)/)?.[0] ?? ''
    const firstLine = text.split('\n').map((line) => line.trim()).find((line) => line.length > 3) ?? ''
    const detectedSkills = ['React', 'Node', 'TypeScript', 'JavaScript', 'MongoDB', 'Python']
      .filter((skill) => new RegExp(`\\b${skill}\\b`, 'i').test(text))
      .join(', ')

    const parsed = {
      name: firstLine,
      email,
      contact: phone,
      skills: detectedSkills,
    }
    setParsedPreview(parsed)
    setForm((prev) => ({
      ...prev,
      name: prev.name || firstLine,
      email: prev.email || email,
      contactDetails: prev.contactDetails || phone,
      skills: prev.skills || detectedSkills,
    }))
  }

  function validate(values: CandidateFormValues): string | null {
    if (!values.name.trim()) return 'Candidate name is required'
    if (!values.jobID.trim()) return 'Role selection is required'
    if (!values.email.trim()) return 'Email is required'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) return 'Enter a valid email address'
    if (!values.contactDetails.trim()) return 'Contact details are required'
    if (!values.location.trim()) return 'Location is required'
    if (!values.skills.trim()) return 'Skills are required'
    if (!values.experience.trim()) return 'Experience is required'
    if (!values.education.trim()) return 'Education is required'
    if (!values.noticePeriod.trim()) return 'Notice period is required'
    if (Number(values.experience) < 0) return 'Experience cannot be negative'
    if (Number(values.noticePeriod) < 0) return 'Notice period cannot be negative'
    return null
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validationError = validate(form)
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError(null)
    try {
      const created = await createCandidate(form)
      const postCreateWarnings: string[] = []
      if (initialNote.trim()) {
        try {
          await addNoteToCandidate(created.id, initialNote.trim())
        } catch {
          postCreateWarnings.push('Note could not be added right now.')
        }
      }
      if (resumeFile) {
        try {
          await uploadCandidateResume(created.id, resumeFile)
        } catch {
          postCreateWarnings.push('Resume upload failed.')
        }
      }
      if (postCreateWarnings.length > 0) {
        setParserMessage(`Candidate created. ${postCreateWarnings.join(' ')}`)
      }
      showToast('Candidate created successfully.', 'success')
      onCreated(created.id)
    } catch (submitError) {
      const message = getErrorMessage(submitError, 'Unable to create candidate')
      setError(message)
      showToast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="job-editor" onSubmit={(event) => void handleSubmit(event)}>
      <section className="page-head">
        <div>
          <p className="breadcrumb">Candidates / Add Candidate</p>
          <h1>Add Candidate</h1>
          <p className="subtitle">Enter candidate details manually or upload resume and complete missing fields.</p>
        </div>
      </section>

      {error && <p className="panel-message panel-message--error">{error}</p>}

      <section className="editor-card">
        <h3>
          <span className="material-symbols-rounded">swap_horiz</span> Candidate Entry Mode
        </h3>
        <div className="entry-mode-grid">
          <button
            type="button"
            className={`entry-mode-card ${entryMode === 'manual' ? 'is-active' : ''}`}
            onClick={() => setEntryMode('manual')}
          >
            <strong>Manual Entry</strong>
            <span>Directly complete the full candidate form.</span>
          </button>
          <button
            type="button"
            className={`entry-mode-card ${entryMode === 'resume' ? 'is-active' : ''}`}
            onClick={() => setEntryMode('resume')}
          >
            <strong>Resume Assisted</strong>
            <span>Upload resume first, then verify and complete the fields.</span>
          </button>
        </div>
      </section>

      <section className="candidate-add-layout">
        <div className="candidate-add-main">
          <article className="editor-card">
          <h3>
            <span className="material-symbols-rounded">person</span> Candidate Basics
          </h3>
          <div className="field-row">
            <div className="field">
              <label>Name</label>
              <input value={form.name} onChange={(event) => updateField('name', event.target.value)} />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Contact</label>
              <input value={form.contactDetails} onChange={(event) => updateField('contactDetails', event.target.value)} />
            </div>
            <div className="field">
              <label>Location</label>
              <input value={form.location} onChange={(event) => updateField('location', event.target.value)} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Experience (Years)</label>
              <input type="number" min={0} value={form.experience} onChange={(event) => updateField('experience', event.target.value)} />
            </div>
            <div className="field">
              <label>Notice Period (Days)</label>
              <input type="number" min={0} value={form.noticePeriod} onChange={(event) => updateField('noticePeriod', event.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Education</label>
            <input value={form.education} onChange={(event) => updateField('education', event.target.value)} />
          </div>
          <div className="field">
            <label>Skills (comma separated)</label>
            <input value={form.skills} onChange={(event) => updateField('skills', event.target.value)} />
          </div>
          </article>

          <article className="editor-card">
            <h3>
              <span className="material-symbols-rounded">work</span> Role & Stage
            </h3>
            <div className="field">
              <label>Role Applied For</label>
              <select value={form.jobID} onChange={(event) => updateField('jobID', event.target.value)}>
                <option value="">Select role</option>
                {jobOptions.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Status</label>
                <select value={form.status} onChange={(event) => updateField('status', event.target.value as CandidateFormValues['status'])}>
                  {CANDIDATE_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {CANDIDATE_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Recruiter</label>
                <input value={form.recruiter} onChange={(event) => updateField('recruiter', event.target.value)} />
              </div>
            </div>
            <div className="field">
              <label>Referral</label>
              <input value={form.referal} onChange={(event) => updateField('referal', event.target.value)} />
            </div>
            <div className="field">
              <label>Feedback</label>
              <textarea rows={4} value={form.feedback} onChange={(event) => updateField('feedback', event.target.value)} />
            </div>
          </article>
        </div>

        <aside className="candidate-add-side">
          <article className={`editor-card ${entryMode === 'resume' ? 'editor-card--spotlight' : ''}`}>
            <h3>
              <span className="material-symbols-rounded">upload_file</span> Resume Assistant
            </h3>
            <div className="field">
              <label>Upload Resume</label>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null
                  setResumeFile(file)
                  if (file) void parseResume(file)
                }}
              />
              <small className="editor-muted">Upload optional. Parsed fields auto-populate the form.</small>
            </div>
            {resumeFile && (
              <p className="overview-note">
                Selected: <strong>{resumeFile.name}</strong>
              </p>
            )}
            {parsedPreview && (
              <ul className="job-description-list">
                <li>
                  <span>Name</span>
                  <strong>{parsedPreview.name || 'Not detected'}</strong>
                </li>
                <li>
                  <span>Email</span>
                  <strong>{parsedPreview.email || 'Not detected'}</strong>
                </li>
                <li>
                  <span>Contact</span>
                  <strong>{parsedPreview.contact || 'Not detected'}</strong>
                </li>
                <li>
                  <span>Skills</span>
                  <strong>{parsedPreview.skills || 'Not detected'}</strong>
                </li>
              </ul>
            )}
            {parserMessage && <small className="editor-muted">{parserMessage}</small>}
          </article>

          <article className="editor-card">
            <h3>
              <span className="material-symbols-rounded">comment</span> Notes
            </h3>
            <div className="field">
              <label>Notes & Comments</label>
              <textarea rows={4} value={initialNote} onChange={(event) => setInitialNote(event.target.value)} />
            </div>
          </article>
        </aside>
      </section>

      <div className="editor-actions">
        <button type="button" className="ghost-btn" onClick={onBack}>
          Cancel
        </button>
        <button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save Candidate'}
        </button>
      </div>
    </form>
  )
}

export default AddCandidatePage
