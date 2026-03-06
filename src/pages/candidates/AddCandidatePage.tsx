import { useEffect, useMemo, useState } from 'react'
import { createCandidate, uploadCandidateResume } from '../../features/candidates/candidateAPI'
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

type FieldErrors = Partial<Record<keyof CandidateFormValues | 'resume', string>>

const RECRUITER_SOURCE_OPTIONS = ['LinkedIn', 'Naukri', 'Indeed', 'Referral', 'Company Career Page', 'Campus Drive', 'Consultancy', 'Other']

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function pickLikelyName(rawText: string): string {
  const lines = rawText
    .split(/[\r\n]/g)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)

  for (const line of lines.slice(0, 20)) {
    if (line.length < 4 || line.length > 60) continue
    if (/\d/.test(line)) continue
    if (/[@:/|\\<>[\]{}]/.test(line)) continue
    if (!/^[A-Za-z][A-Za-z\s.'-]+$/.test(line)) continue
    const words = line.split(' ').filter(Boolean)
    if (words.length >= 2 && words.length <= 5) return line
  }

  return ''
}

function extractBestEffortPdfText(buffer: ArrayBuffer): string {
  // Best-effort extraction without heavy dependencies.
  const bytes = new Uint8Array(buffer)
  let ascii = ''
  for (let index = 0; index < bytes.length; index += 1) {
    const code = bytes[index]
    if (code === 10 || code === 13 || code === 9 || (code >= 32 && code <= 126)) {
      ascii += String.fromCharCode(code)
    } else {
      ascii += ' '
    }
  }

  const textChunks: string[] = []
  const parenMatches = ascii.match(/\(([^()]|\\\(|\\\)|\\n|\\r|\\t){2,}\)/g) ?? []
  for (const chunk of parenMatches) {
    textChunks.push(chunk.slice(1, -1).replace(/\\[nrt]/g, ' ').replace(/\\[()\\]/g, ' '))
  }

  const plainChunks = ascii.match(/[A-Za-z][A-Za-z0-9@._+\- ]{6,}/g) ?? []
  textChunks.push(...plainChunks)
  return normalizeWhitespace(textChunks.join(' '))
}

function AddCandidatePage({ jobs, initialJobId, onBack, onCreated }: AddCandidatePageProps) {
  const { showToast } = useToast()
  const [form, setForm] = useState<CandidateFormValues>({ ...defaultValues, jobID: initialJobId ?? '' })
  const [entryMode, setEntryMode] = useState<'manual' | 'resume'>('manual')
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [parsedPreview, setParsedPreview] = useState<{ name: string; email: string; contact: string; skills: string } | null>(null)
  const [parserMessage, setParserMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const jobOptions = useMemo(
    () =>
      jobs
        .filter((job) => job.status === 'Open' && job.filled < job.openings)
        .map((job) => ({ id: job.id, label: `${job.title} (${job.reqId})` })),
    [jobs],
  )

  useEffect(() => {
    if (!initialJobId) return
    setForm((prev) => ({ ...prev, jobID: prev.jobID || initialJobId }))
  }, [initialJobId])

  function updateField<K extends keyof CandidateFormValues>(key: K, value: CandidateFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  async function parseResume(file: File) {
    const allowedExt = ['.pdf', '.doc', '.docx']
    const fileName = file.name.toLowerCase()
    const isSupported = allowedExt.some((ext) => fileName.endsWith(ext))
    if (!isSupported) {
      setFieldErrors((prev) => ({ ...prev, resume: 'Only Word and PDF resumes are supported.' }))
      setParserMessage('Resume parser supports only PDF or Word files.')
      return
    }
    setFieldErrors((prev) => ({ ...prev, resume: undefined }))

    const ext = fileName.slice(fileName.lastIndexOf('.'))
    let extractedText = ''

    if (ext === '.pdf') {
      const buffer = await file.arrayBuffer()
      extractedText = extractBestEffortPdfText(buffer)
    } else if (ext === '.docx' || ext === '.doc') {
      // DOC/DOCX binary parsing in browser is unreliable without parser libs.
      setParsedPreview(null)
      setParserMessage('Resume uploaded. Auto-fill for DOC/DOCX is limited in browser; please verify fields manually.')
      return
    } else {
      extractedText = normalizeWhitespace(await file.text())
    }

    if (!extractedText) {
      setParsedPreview(null)
      setParserMessage('Could not extract resume text reliably. Please fill fields manually.')
      return
    }

    const email = extractedText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)?.[0] ?? ''
    const phone = extractedText.match(/(?:\+\d{1,3}\s?)?(?:\d[\s-]?){9,14}\d/)?.[0] ?? ''
    const likelyName = pickLikelyName(extractedText)
    const detectedSkills = ['React', 'Node.js', 'Node', 'TypeScript', 'JavaScript', 'MongoDB', 'Python', 'Java', 'AWS', 'Docker']
      .filter((skill) => new RegExp(`\\b${skill.replace('.', '\\.')}\\b`, 'i').test(extractedText))
      .join(', ')

    const hasUsefulData = Boolean(email || phone || likelyName || detectedSkills)
    if (!hasUsefulData) {
      setParsedPreview(null)
      setParserMessage('Resume uploaded, but auto-detection confidence is low. Please enter details manually.')
      return
    }

    setParserMessage('Resume parsed. Review detected fields before saving.')

    const parsed = {
      name: likelyName,
      email,
      contact: phone,
      skills: detectedSkills,
    }
    setParsedPreview(parsed)
    setForm((prev) => {
      const next = {
        ...prev,
        name: prev.name || likelyName,
        email: prev.email || email,
        contactDetails: prev.contactDetails || phone,
        skills: prev.skills || detectedSkills,
      }
      setFieldErrors((current) => ({
        ...current,
        name: next.name.trim() ? undefined : 'Candidate name is required',
        email: next.email.trim() ? undefined : 'Email is required',
        contactDetails: next.contactDetails.trim() ? undefined : 'Contact details are required',
        skills: next.skills.trim() ? undefined : 'Skills are required',
      }))
      return next
    })
  }

  function handleManualResumeSelect(file: File | null) {
    setResumeFile(file)
    setFieldErrors((prev) => ({ ...prev, resume: undefined }))
    if (!file) {
      setParserMessage(null)
      return
    }
    setEntryMode('manual')
    setParsedPreview(null)
    setParserMessage('Resume attached. It will be uploaded when you save candidate.')
  }

  function validate(values: CandidateFormValues): FieldErrors {
    const next: FieldErrors = {}
    if (!values.name.trim()) next.name = 'Candidate name is required'
    if (!values.jobID.trim()) next.jobID = 'Role selection is required'
    else {
      const selectedJob = jobs.find((job) => job.id === values.jobID)
      if (!selectedJob) next.jobID = 'Selected role is invalid'
      else if (selectedJob.status !== 'Open' || selectedJob.filled >= selectedJob.openings) {
        next.jobID = 'Candidate can apply only for open roles with available openings'
      }
    }
    if (!values.email.trim()) next.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) next.email = 'Enter a valid email address'
    if (!values.contactDetails.trim()) next.contactDetails = 'Contact details are required'
    if (!values.location.trim()) next.location = 'Location is required'
    if (!values.skills.trim()) next.skills = 'Skills are required'
    if (!values.experience.trim()) next.experience = 'Experience is required'
    if (!values.education.trim()) next.education = 'Education is required'
    if (!values.noticePeriod.trim()) next.noticePeriod = 'Notice period is required'
    if (values.experience.trim() && Number(values.experience) < 0) next.experience = 'Experience cannot be negative'
    if (values.noticePeriod.trim() && Number(values.noticePeriod) < 0) next.noticePeriod = 'Notice period cannot be negative'
    if (entryMode === 'resume' && !resumeFile) next.resume = 'Resume file is required in resume mode'
    return next
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validationErrors = validate(form)
    setFieldErrors(validationErrors)
    if (Object.values(validationErrors).some(Boolean)) {
      setError('Please correct the highlighted fields.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const created = await createCandidate(form)
      const postCreateWarnings: string[] = []
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
      <section className="page-head candidate-add-head">
        <div>
          <p className="breadcrumb">Candidates / Add Candidate</p>
          <h1>Add Candidate</h1>
          <p className="subtitle">Choose your preferred entry method. Start by dropping a resume or enter details manually below.</p>
        </div>
      </section>

      {error && <p className="panel-message panel-message--error">{error}</p>}

      <section className={`candidate-quick-apply ${entryMode === 'resume' ? 'is-active' : ''}`}>
        <input
          id="candidate-resume-upload"
          type="file"
          accept=".pdf,.doc,.docx"
          className="candidate-quick-apply__input"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null
            setResumeFile(file)
            if (!file) {
              setFieldErrors((prev) => ({ ...prev, resume: entryMode === 'resume' ? 'Resume file is required in resume mode' : undefined }))
              return
            }
            setEntryMode('resume')
            void parseResume(file)
          }}
        />
        <label htmlFor="candidate-resume-upload" className="candidate-quick-apply__icon" aria-label="Upload resume">
          <span className="material-symbols-rounded">cloud_upload</span>
        </label>
        <h3>Quick Apply with Resume</h3>
        <p>Drag and drop a PDF or Word file here. We auto-fill available candidate details.</p>
        <small>Supports PDF, DOC, DOCX up to 10MB</small>
        {fieldErrors.resume && <small className="field-error">{fieldErrors.resume}</small>}
        {resumeFile && (
          <p className="overview-note">
            Selected: <strong>{resumeFile.name}</strong>
          </p>
        )}
        {parsedPreview && (
          <ul className="job-description-list candidate-quick-apply__preview">
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
      </section>

      <div className="candidate-quick-divider" aria-hidden="true">
        <span>OR</span>
      </div>

      <section className="candidate-add-layout">
        <div className="candidate-add-main">
          <article className="editor-card">
          <h3>
            <span className="material-symbols-rounded">person</span> Candidate Basics
            <small>Step 1 of 2</small>
          </h3>
          <div className="field-row">
            <div className="field">
              <label>Name</label>
              <input className={fieldErrors.name ? 'input-error' : ''} value={form.name} onChange={(event) => updateField('name', event.target.value)} />
              {fieldErrors.name && <small className="field-error">{fieldErrors.name}</small>}
            </div>
            <div className="field">
              <label>Email</label>
              <input
                className={fieldErrors.email ? 'input-error' : ''}
                type="email"
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
              />
              {fieldErrors.email && <small className="field-error">{fieldErrors.email}</small>}
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Contact</label>
              <input
                className={fieldErrors.contactDetails ? 'input-error' : ''}
                value={form.contactDetails}
                onChange={(event) => updateField('contactDetails', event.target.value)}
              />
              {fieldErrors.contactDetails && <small className="field-error">{fieldErrors.contactDetails}</small>}
            </div>
            <div className="field">
              <label>Location</label>
              <input className={fieldErrors.location ? 'input-error' : ''} value={form.location} onChange={(event) => updateField('location', event.target.value)} />
              {fieldErrors.location && <small className="field-error">{fieldErrors.location}</small>}
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Experience (Years)</label>
              <input
                className={fieldErrors.experience ? 'input-error' : ''}
                type="number"
                min={0}
                value={form.experience}
                onChange={(event) => updateField('experience', event.target.value)}
              />
              {fieldErrors.experience && <small className="field-error">{fieldErrors.experience}</small>}
            </div>
            <div className="field">
              <label>Notice Period (Days)</label>
              <input
                className={fieldErrors.noticePeriod ? 'input-error' : ''}
                type="number"
                min={0}
                value={form.noticePeriod}
                onChange={(event) => updateField('noticePeriod', event.target.value)}
              />
              {fieldErrors.noticePeriod && <small className="field-error">{fieldErrors.noticePeriod}</small>}
            </div>
          </div>
          <div className="field">
            <label>Education</label>
            <input className={fieldErrors.education ? 'input-error' : ''} value={form.education} onChange={(event) => updateField('education', event.target.value)} />
            {fieldErrors.education && <small className="field-error">{fieldErrors.education}</small>}
          </div>
          <div className="field">
            <label>Skills (comma separated)</label>
            <input className={fieldErrors.skills ? 'input-error' : ''} value={form.skills} onChange={(event) => updateField('skills', event.target.value)} />
            {fieldErrors.skills && <small className="field-error">{fieldErrors.skills}</small>}
          </div>
          </article>

          <article className="editor-card">
            <h3>
              <span className="material-symbols-rounded">work</span> Role & Stage
              <small>Step 2 of 2</small>
            </h3>
            <div className="field">
              <label>Role Applied For</label>
              <select className={fieldErrors.jobID ? 'input-error' : ''} value={form.jobID} onChange={(event) => updateField('jobID', event.target.value)}>
                <option value="">Select role</option>
                {jobOptions.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.label}
                  </option>
                ))}
              </select>
              {fieldErrors.jobID && <small className="field-error">{fieldErrors.jobID}</small>}
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
                <label>Recruiter Source</label>
                <select value={form.recruiter} onChange={(event) => updateField('recruiter', event.target.value)}>
                  <option value="">Select source</option>
                  {RECRUITER_SOURCE_OPTIONS.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </select>
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

          <article className="editor-card candidate-resume-upload-card">
            <h3>
              <span className="material-symbols-rounded">upload_file</span> Resume Upload
              <small>Optional</small>
            </h3>
            <p className="editor-muted">Use this in manual entry mode to attach resume only, without auto parsing.</p>
            <div className="candidate-resume-upload-card__drop">
              <label htmlFor="candidate-manual-resume-upload" className="candidate-resume-upload-card__trigger">
                <span className="material-symbols-rounded" aria-hidden="true">cloud_upload</span>
                <span>Upload Resume</span>
              </label>
              <input
                id="candidate-manual-resume-upload"
                type="file"
                accept=".pdf,.doc,.docx"
                className="candidate-resume-upload-card__input"
                onChange={(event) => handleManualResumeSelect(event.target.files?.[0] ?? null)}
              />
              <small>Accepted: PDF, DOC, DOCX</small>
            </div>
          </article>
        </div>
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
