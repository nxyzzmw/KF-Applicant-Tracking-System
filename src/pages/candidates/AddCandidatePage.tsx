import { useEffect, useMemo, useState } from 'react'
import { createCandidate, uploadCandidateResume } from '../../features/candidates/candidateAPI'
import { CANDIDATE_STATUS_LABELS, CANDIDATE_STATUS_OPTIONS, type CandidateFormValues } from '../../features/candidates/candidateTypes'
import type { JobRecord } from '../../features/jobs/jobTypes'
import { useToast } from '../../components/common/ToastProvider'
import { getErrorMessage } from '../../utils/errorUtils'
import * as pdfjsLib from 'pdfjs-dist'
import mammoth from 'mammoth'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href

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

async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const pageTexts: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const textItems = content.items.filter(
      (item): item is typeof item & { str: string; transform: number[] } => 'str' in item && 'transform' in item,
    )
    let lastY: number | null = null
    const parts: string[] = []
    for (const item of textItems) {
      const y = item.transform[5]
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        parts.push('\n')
      }
      parts.push(item.str)
      lastY = y
    }
    pageTexts.push(parts.join(''))
  }
  return pageTexts.join('\n')
}

function extractLocation(text: string): string {
  const cityPatterns = [
    /(?:location|address|city|based\s+(?:in|at)|residing\s+(?:in|at))\s*[:\-]?\s*([A-Za-z][A-Za-z\s,]{2,40})/i,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*(?:India|USA|UK|Canada|Australia|TN|KA|MH|DL|AP|TG|KL|GJ|RJ|WB|UP|HR|PB|MP|OR|JK|GA)/,
  ]
  for (const pattern of cityPatterns) {
    const match = text.match(pattern)
    if (match?.[1]) return normalizeWhitespace(match[1])
  }
  return ''
}

function extractExperience(text: string): string {
  const patterns = [
    /(\d{1,2}(?:\.\d)?)\+?\s*(?:years?|yrs?)\s*(?:of\s+)?(?:experience|exp)/i,
    /(?:experience|exp)\s*[:\-]?\s*(\d{1,2}(?:\.\d)?)\+?\s*(?:years?|yrs?)/i,
    /(?:total\s+(?:it\s+)?experience|work\s+experience)\s*[:\-]?\s*(\d{1,2}(?:\.\d)?)\+?\s*(?:years?|yrs?)/i,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) return match[1]
  }
  return ''
}

function extractEducation(text: string): string {
  const degrees = [
    /\b(Ph\.?D\.?(?:\s+in\s+[A-Za-z\s&]+)?)/i,
    /\b(M\.?\s*(?:Tech|S|Sc|E|B\.?A|C\.?A|B\.?A)\.?(?:\s+in\s+[A-Za-z\s&]+)?)/i,
    /\b(B\.?\s*(?:Tech|E|S|Sc|B\.?A|C\.?A|Com)\.?(?:\s+in\s+[A-Za-z\s&]+)?)/i,
    /\b(Master(?:'s)?\s+(?:of\s+)?[A-Za-z\s&]+)/i,
    /\b(Bachelor(?:'s)?\s+(?:of\s+)?[A-Za-z\s&]+)/i,
    /\b(MBA|MCA|BCA|BE|ME|MS)\b/,
  ]
  const found: string[] = []
  for (const pattern of degrees) {
    const match = text.match(pattern)
    if (match?.[1] && !found.some((d) => d.toLowerCase() === match[1].toLowerCase())) {
      found.push(normalizeWhitespace(match[1]))
    }
    if (found.length >= 2) break
  }
  return found.join(', ')
}

function extractNoticePeriod(text: string): string {
  const patterns = [
    /notice\s*(?:period)?\s*[:\-]?\s*(\d{1,3})\s*days?/i,
    /(\d{1,3})\s*days?\s*notice/i,
    /notice\s*(?:period)?\s*[:\-]?\s*(\d{1,2})\s*months?/i,
    /immediately?\s*(?:available|joinable|joiner)/i,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      if (!match[1]) return '0'
      if (/month/i.test(match[0])) return String(Number(match[1]) * 30)
      return match[1]
    }
  }
  return ''
}

function AddCandidatePage({ jobs, initialJobId, onBack, onCreated }: AddCandidatePageProps) {
  const { showToast } = useToast()
  const [form, setForm] = useState<CandidateFormValues>({ ...defaultValues, jobID: initialJobId ?? '' })
  const [entryMode, setEntryMode] = useState<'manual' | 'resume'>('manual')
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [parsedPreview, setParsedPreview] = useState<{ name: string; email: string; contact: string; skills: string } | null>(null)
  const [parserMessage, setParserMessage] = useState<string | null>(null)
  const [parserMissingFields, setParserMissingFields] = useState<string[]>([])
  const [isDropActive, setIsDropActive] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [resumePreviewUrl, setResumePreviewUrl] = useState<string | null>(null)

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

  useEffect(() => {
    if (!resumeFile) {
      setResumePreviewUrl(null)
      return
    }
    const nextUrl = URL.createObjectURL(resumeFile)
    setResumePreviewUrl(nextUrl)
    return () => URL.revokeObjectURL(nextUrl)
  }, [resumeFile])

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
      setParserMissingFields([])
      return
    }
    setFieldErrors((prev) => ({ ...prev, resume: undefined }))
    setParserMissingFields([])

    const ext = fileName.slice(fileName.lastIndexOf('.'))
    let extractedText = ''

    if (ext === '.pdf') {
      const buffer = await file.arrayBuffer()
      extractedText = await extractPdfText(buffer)
    } else if (ext === '.docx') {
      const buffer = await file.arrayBuffer()
      const result = await mammoth.extractRawText({ arrayBuffer: buffer })
      extractedText = result.value
    } else if (ext === '.doc') {
      setParsedPreview(null)
      setParserMessage('Resume uploaded. Auto-fill for .doc format is not supported; please use .docx or PDF instead.')
      return
    } else {
      extractedText = normalizeWhitespace(await file.text())
    }

    if (!extractedText) {
      setParsedPreview(null)
      setParserMissingFields(['Name', 'Email', 'Contact', 'Skills'])
      setParserMessage('Could not extract resume text reliably. Please fill fields manually.')
      return
    }

    const email = extractedText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)?.[0] ?? ''
    const phone = extractedText.match(/(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?(?:\d[\s-]?){6,12}\d/)?.[0] ?? ''
    const likelyName = pickLikelyName(extractedText)
    const knownSkills = [
      'React', 'React Native', 'Next.js', 'Angular', 'Vue.js', 'Svelte',
      'Node.js', 'Express', 'NestJS', 'Django', 'Flask', 'Spring Boot',
      'TypeScript', 'JavaScript', 'Python', 'Java', 'C#', 'C++', 'Go', 'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin',
      'MongoDB', 'PostgreSQL', 'MySQL', 'Redis', 'Elasticsearch', 'DynamoDB', 'Firebase',
      'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Terraform', 'Jenkins', 'CI/CD',
      'GraphQL', 'REST', 'Git', 'Linux', 'Figma', 'Tailwind CSS', 'SASS', 'HTML', 'CSS',
      'Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch',
    ]
    const detectedSkills = knownSkills
      .filter((skill) => new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(extractedText))
      .join(', ')

    const location = extractLocation(extractedText)
    const experience = extractExperience(extractedText)
    const education = extractEducation(extractedText)
    const noticePeriod = extractNoticePeriod(extractedText)

    const hasUsefulData = Boolean(email || phone || likelyName || detectedSkills)
    if (!hasUsefulData) {
      setParsedPreview(null)
      setParserMissingFields(['Name', 'Email', 'Contact', 'Skills'])
      setParserMessage('Resume uploaded, but auto-detection confidence is low. Please enter details manually.')
      return
    }

    const missingFields: string[] = []
    if (!likelyName.trim()) missingFields.push('Name')
    if (!email.trim()) missingFields.push('Email')
    if (!phone.trim()) missingFields.push('Contact')
    if (!detectedSkills.trim()) missingFields.push('Skills')
    setParserMissingFields(missingFields)
    setParserMessage(
      missingFields.length > 0
        ? `Resume parsed partially. Fill missing fields manually: ${missingFields.join(', ')}.`
        : 'Resume parsed successfully. Review detected fields before saving.',
    )

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
        location: prev.location || location,
        experience: prev.experience || experience,
        education: prev.education || education,
        noticePeriod: prev.noticePeriod || noticePeriod,
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
      setParserMissingFields([])
      return
    }
    setEntryMode('manual')
    setParsedPreview(null)
    setParserMissingFields([])
    setParserMessage('Resume attached. It will be uploaded when you save candidate.')
  }

  function handleResumeFileSelect(file: File | null) {
    setResumeFile(file)
    if (!file) {
      setFieldErrors((prev) => ({ ...prev, resume: 'Resume file is required in parser mode' }))
      setParsedPreview(null)
      setParserMissingFields([])
      setParserMessage(null)
      return
    }
    setEntryMode('resume')
    void parseResume(file)
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
    if (!resumeFile) {
      next.resume = entryMode === 'resume' ? 'Resume file is required in parser mode' : 'Resume file is required in manual mode'
    }
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
          showToast('Resume uploaded successfully.', 'success')
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
        <input id="candidate-resume-upload" type="file" accept=".pdf,.doc,.docx" className="candidate-quick-apply__input" onChange={(event) => handleResumeFileSelect(event.target.files?.[0] ?? null)} />
        <label htmlFor="candidate-resume-upload" className="candidate-quick-apply__icon" aria-label="Upload resume">
          <span className="material-symbols-rounded">cloud_upload</span>
        </label>
        <h3>Quick Apply with Resume</h3>
        <p>Drag and drop your PDF or Word file here to auto-populate candidate profile information.</p>
        <div
          className={`candidate-quick-apply__dropzone${isDropActive ? ' is-active' : ''}`}
          onDragOver={(event) => {
            event.preventDefault()
            setIsDropActive(true)
          }}
          onDragLeave={() => setIsDropActive(false)}
          onDrop={(event) => {
            event.preventDefault()
            setIsDropActive(false)
            const file = event.dataTransfer.files?.[0] ?? null
            handleResumeFileSelect(file)
          }}
        >
          <label htmlFor="candidate-resume-upload" className="candidate-quick-apply__browse">
            <span className="material-symbols-rounded">attach_file</span>
            <span>Browse Files</span>
          </label>
          <small>PDF</small>
          <small>DOCX</small>
          <small>DOC</small>
        </div>
        {fieldErrors.resume && <small className="field-error">{fieldErrors.resume}</small>}
        {resumeFile && (
          <p className="overview-note">
            Selected: <strong>{resumeFile.name}</strong>
          </p>
        )}
        {resumeFile && resumePreviewUrl && (
          <p className="overview-note">
            <a href={resumePreviewUrl} target="_blank" rel="noreferrer" className="table-action">
              Preview Selected Resume
            </a>
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
        {parserMissingFields.length > 0 && (
          <small className="field-error">Please fill manually: {parserMissingFields.join(', ')}</small>
        )}
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
            <p className="editor-muted">Use this in manual mode to attach resume only. In parser mode this section is disabled.</p>
            <div className={`candidate-resume-upload-card__drop${entryMode === 'resume' ? ' is-disabled' : ''}`}>
              <label htmlFor="candidate-manual-resume-upload" className={`candidate-resume-upload-card__trigger${entryMode === 'resume' ? ' is-disabled' : ''}`}>
                <span className="material-symbols-rounded" aria-hidden="true">cloud_upload</span>
                <span>Upload Resume</span>
              </label>
              <input
                id="candidate-manual-resume-upload"
                type="file"
                accept=".pdf,.doc,.docx"
                className="candidate-resume-upload-card__input"
                disabled={entryMode === 'resume'}
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
