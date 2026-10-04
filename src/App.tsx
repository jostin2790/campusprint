import { useEffect, useMemo, useState, type DragEvent, type ReactNode } from 'react'
import {
  Activity, AlertCircle, ArrowDownToLine, ArrowLeft, ArrowRight, BadgeCheck,
  Bell, BookOpen, Check, CheckCircle2, ChevronDown, Clock3, FileText, History,
  Inbox, LayoutDashboard, LoaderCircle, MoreHorizontal,
  Printer, RefreshCw, Search, Settings2, ShieldCheck, Sparkles, Upload,
  Users, X, Zap,
  type LucideIcon,
} from 'lucide-react'
import { initialJobs, initialPrinters } from './data'
import type { JobStatus, PageId, Printer as PrinterRecord, PrinterStatus, PrintJob, PrintOptions } from './types'
import './App.css'

const STORAGE_KEYS = { jobs: 'campusprint.jobs.v1', printers: 'campusprint.printers.v1' }
const STUDENT_NAME = 'Aarav Mehta'
const STUDENT_COURSE = 'B.Tech · CSE · 2nd year'
const TODAY_DATE = new Intl.DateTimeFormat('en-IN', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())
const PAGE_TITLES: Record<PageId, string> = {
  dashboard: 'Overview', upload: 'Upload & print', queue: 'Queue tracking',
  history: 'Print history', admin: 'Admin dashboard', printers: 'Printer management',
}
const navItems: { id: PageId; label: string; icon: LucideIcon; group: 'student' | 'admin' }[] = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, group: 'student' },
  { id: 'upload', label: 'Upload & print', icon: Upload, group: 'student' },
  { id: 'queue', label: 'Queue tracking', icon: Activity, group: 'student' },
  { id: 'history', label: 'Print history', icon: History, group: 'student' },
  { id: 'admin', label: 'Admin dashboard', icon: ShieldCheck, group: 'admin' },
  { id: 'printers', label: 'Printer management', icon: Settings2, group: 'admin' },
]

function readStored<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key)
    return saved ? JSON.parse(saved) as T : fallback
  } catch {
    return fallback
  }
}

function tokenNumber(token: string) {
  return Number(token.replace(/\D/g, ''))
}

function timeLabel() {
  return new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

function statusLabel(status: JobStatus | PrinterStatus) {
  return status.replaceAll('-', ' ')
}

function waitAtPosition(position: number) {
  return 1 + Math.max(0, position - 1) * 2
}

function StatusBadge({ status }: { status: JobStatus | PrinterStatus }) {
  return <span className={`status-badge status-${status}`}>{statusLabel(status)}</span>
}

function App() {
  const [jobs, setJobs] = useState<PrintJob[]>(() => readStored(STORAGE_KEYS.jobs, initialJobs))
  const [printers, setPrinters] = useState<PrinterRecord[]>(() => readStored(STORAGE_KEYS.printers, initialPrinters))
  const [activePage, setActivePage] = useState<PageId>('dashboard')
  const [role, setRole] = useState<'student' | 'admin'>('student')
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(null)
  const [viewJob, setViewJob] = useState<PrintJob | null>(null)

  useEffect(() => localStorage.setItem(STORAGE_KEYS.jobs, JSON.stringify(jobs)), [jobs])
  useEffect(() => localStorage.setItem(STORAGE_KEYS.printers, JSON.stringify(printers)), [printers])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const waitingJobs = useMemo(() => jobs.filter((job) => job.status === 'waiting').sort((a, b) => tokenNumber(a.token) - tokenNumber(b.token)), [jobs])
  const myActiveJob = jobs.find((job) => job.student === STUDENT_NAME && ['waiting', 'printing'].includes(job.status)) ?? null
  const myPosition = myActiveJob?.status === 'waiting'
    ? waitingJobs.findIndex((job) => job.id === myActiveJob.id) + 1
    : myActiveJob?.status === 'printing' ? 0 : 0
  const estimatedWait = myActiveJob?.status === 'printing' ? 1 : myPosition > 0 ? waitAtPosition(myPosition) : 0
  const activeJobsCount = jobs.filter((job) => job.status === 'waiting' || job.status === 'printing').length
  function notify(message: string, kind: 'success' | 'error' = 'success') {
    setToast({ message, kind })
  }

  function navigate(page: PageId) {
    setActivePage(page)
    setRole(page === 'admin' || page === 'printers' ? 'admin' : 'student')
  }

  function joinQueue(fileName: string, options: PrintOptions, pages: number) {
    const nextNumber = Math.max(...jobs.map((job) => tokenNumber(job.token)), 23) + 1
    const token = `#P${String(nextNumber).padStart(3, '0')}`
    const pricePerPage = options.mode === 'colour' ? 5 : 2
    const newJob: PrintJob = {
      id: `job-${nextNumber}`, token, student: STUDENT_NAME, course: STUDENT_COURSE,
      fileName, pages, ...options, price: pages * options.copies * pricePerPage + (options.priority ? 15 : 0),
      status: 'waiting', printerId: null, createdAt: timeLabel(), eta: waitAtPosition(waitingJobs.length + 1),
    }
    setJobs((current) => [...current, newJob])
    navigate('queue')
    notify(`${token} is in the queue. We’ll keep your place updated.`)
    return token
  }

  function updateJob(jobId: string, status: JobStatus) {
    const selected = jobs.find((job) => job.id === jobId)
    if (!selected) return
    setJobs((current) => current.map((job) => job.id === jobId ? { ...job, status, eta: status === 'completed' || status === 'cancelled' ? 0 : job.eta } : job))
    if (selected.printerId && (status === 'completed' || status === 'cancelled')) {
      setPrinters((current) => current.map((printer) => printer.id === selected.printerId
        ? { ...printer, currentJobId: null, assignedQueue: printer.assignedQueue.filter((token) => token !== selected.token) }
        : printer))
    }
    notify(`${selected.token} marked ${statusLabel(status)}.`)
  }

  function callNext() {
    const nextJob = waitingJobs[0]
    const printer = printers.find((item) => item.status === 'available' && !item.currentJobId)
    if (!nextJob) return notify('There are no waiting jobs.', 'error')
    if (!printer) return notify('No available printer. Update printer status to continue.', 'error')
    setJobs((current) => current.map((job) => job.id === nextJob.id ? { ...job, status: 'printing', printerId: printer.id, eta: 2 } : job))
    setPrinters((current) => current.map((item) => item.id === printer.id
      ? { ...item, currentJobId: nextJob.id, assignedQueue: item.assignedQueue.filter((token) => token !== nextJob.token) }
      : item))
    notify(`${nextJob.token} called to ${printer.name}.`)
  }

  function togglePrinter(printerId: string) {
    const printer = printers.find((item) => item.id === printerId)
    if (!printer) return
    const nextStatus: PrinterStatus = printer.status === 'available' ? 'maintenance' : 'available'
    const interruptedJob = nextStatus === 'maintenance'
      ? jobs.find((job) => job.id === printer.currentJobId && job.status === 'printing')
      : undefined
    if (interruptedJob) {
      setJobs((current) => current.map((job) => job.id === interruptedJob.id ? { ...job, status: 'waiting', printerId: null } : job))
    }
    setPrinters((current) => current.map((item) => item.id === printerId
      ? { ...item, status: nextStatus, currentJobId: interruptedJob ? null : item.currentJobId, assignedQueue: interruptedJob ? item.assignedQueue.filter((token) => token !== interruptedJob.token) : item.assignedQueue }
      : item))
    if (interruptedJob) return notify(`${printer.name} marked unavailable. ${interruptedJob.token} returned to the queue.`, 'error')
    notify(`${printer.name} marked ${statusLabel(nextStatus)}.`)
  }

  function reprint(job: PrintJob) {
    const options: PrintOptions = {
      copies: job.copies, mode: job.mode, sides: job.sides, pageRange: job.pageRange, priority: false,
    }
    joinQueue(job.fileName, options, job.pages)
  }

  const pageContent: Record<PageId, ReactNode> = {
    dashboard: <StudentDashboard jobs={jobs} waitingJobs={waitingJobs} printers={printers} myJob={myActiveJob} position={myPosition} wait={estimatedWait} onNavigate={navigate} />,
    upload: <UploadView jobs={jobs} onJoin={joinQueue} onNavigate={navigate} />,
    queue: <QueueView jobs={jobs} printers={printers} myJob={myActiveJob} position={myPosition} wait={estimatedWait} onNavigate={navigate} onCancel={(job) => updateJob(job.id, 'cancelled')} />,
    history: <HistoryView jobs={jobs} onView={setViewJob} onReprint={reprint} />,
    admin: <AdminView jobs={jobs} printers={printers} waitingJobs={waitingJobs} onCallNext={callNext} onUpdateJob={updateJob} onTogglePrinter={togglePrinter} onView={setViewJob} onNavigate={navigate} />,
    printers: <PrinterManagement printers={printers} jobs={jobs} onTogglePrinter={togglePrinter} onNavigate={navigate} />,
  }

  function selectNav(page: PageId) {
    navigate(page)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#dashboard" onClick={(event) => { event.preventDefault(); selectNav('dashboard') }}>
          <span className="brand-mark"><Printer size={20} strokeWidth={2.2} /></span>
          <span>campus<span className="brand-light">print</span><small>STUDENT SERVICES</small></span>
        </a>

        <div className="campus-switcher">
          <span className="campus-avatar">N</span>
          <span><strong>North Campus</strong><small>Printing centre</small></span>
        </div>

        <nav className="side-nav" aria-label="Main navigation">
          <p className="nav-caption">WORKSPACE</p>
          {navItems.filter((item) => item.group === 'student').map((item) => <NavButton key={item.id} item={item} active={activePage === item.id} count={item.id === 'queue' ? activeJobsCount : undefined} onClick={() => selectNav(item.id)} />)}
          <p className="nav-caption nav-caption-gap">CENTRE ADMIN</p>
          {navItems.filter((item) => item.group === 'admin').map((item) => <NavButton key={item.id} item={item} active={activePage === item.id} onClick={() => selectNav(item.id)} />)}
        </nav>

        <div className="sidebar-spacer" />
        <div className="sidebar-help">
          <span className="help-icon"><BookOpen size={17} /></span>
          <div><strong>Need a hand?</strong><small>Printing centre · Ext. 204</small></div>
          <ArrowRight size={15} />
        </div>
        <button className="profile-row" type="button" onClick={() => { setRole(role === 'student' ? 'admin' : 'student'); selectNav(role === 'student' ? 'admin' : 'dashboard') }}>
          <span className="profile-avatar">AM</span>
          <span><strong>{role === 'student' ? STUDENT_NAME : 'Centre Admin'}</strong><small>{role === 'student' ? 'Student account' : 'Admin workspace'}</small></span>
          <MoreHorizontal size={18} />
        </button>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="breadcrumb"><span>North Campus</span><span className="crumb-divider">/</span><strong>{PAGE_TITLES[activePage]}</strong></div>
          <div className="topbar-actions">
            <span className="today-date">{TODAY_DATE}</span>
            <button className="icon-button" type="button" title="Print history" aria-label="Print history" onClick={() => navigate('history')}><History size={18} /></button>
            <button className="icon-button notification-button" type="button" title="Notifications" aria-label="Notifications" onClick={() => notify(myActiveJob ? `${myActiveJob.token} is ${statusLabel(myActiveJob.status)}${myActiveJob.status === 'waiting' ? `, position ${myPosition}, estimated wait ${estimatedWait} minutes` : ''}.` : 'No active print job notifications.')}><Bell size={18} /><i /></button>
            <button className="role-switch" type="button" onClick={() => { const nextRole = role === 'student' ? 'admin' : 'student'; setRole(nextRole); selectNav(nextRole === 'admin' ? 'admin' : 'dashboard') }}><span className={role === 'student' ? 'role-dot student-dot' : 'role-dot admin-dot'} />{role === 'student' ? 'Student' : 'Admin'}<ChevronDown size={14} /></button>
          </div>
        </header>
        <div className="page-wrap">
          {pageContent[activePage]}
          <footer className="page-footer"><span>CampusPrint · North Campus</span><span>Making deadline day a little calmer.</span></footer>
        </div>
      </main>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {(['dashboard', 'upload', 'queue', 'history', 'admin'] as PageId[]).map((id) => {
          const item = navItems.find((entry) => entry.id === id)!
          const Icon = item.icon
          return <button type="button" key={id} className={activePage === id ? 'mobile-nav-item active' : 'mobile-nav-item'} aria-label={item.label} onClick={() => selectNav(id)}><Icon size={19} /><span>{id === 'dashboard' ? 'Home' : id === 'upload' ? 'Print' : id === 'history' ? 'History' : id === 'admin' ? 'Admin' : 'Queue'}</span></button>
        })}
      </nav>

      {toast && <div className={`toast toast-${toast.kind}`} role="status"><span>{toast.kind === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}</span>{toast.message}<button type="button" aria-label="Dismiss notification" onClick={() => setToast(null)}><X size={15} /></button></div>}
      {viewJob && <DocumentModal job={viewJob} onClose={() => setViewJob(null)} />}
    </div>
  )
}

function NavButton({ item, active, count, onClick }: { item: { id: PageId; label: string; icon: LucideIcon }; active: boolean; count?: number; onClick: () => void }) {
  const Icon = item.icon
  return <button type="button" className={active ? 'nav-link active' : 'nav-link'} onClick={onClick}><Icon size={18} strokeWidth={1.8} /><span>{item.label}</span>{item.id === 'queue' && count !== undefined && <span className="nav-count">{count}</span>}</button>
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{description && <p className="page-description">{description}</p>}</div>{action}</div>
}

function StudentDashboard({ jobs, waitingJobs, printers, myJob, position, wait, onNavigate }: {
  jobs: PrintJob[]; waitingJobs: PrintJob[]; printers: PrinterRecord[]; myJob: PrintJob | null; position: number; wait: number; onNavigate: (page: PageId) => void
}) {
  const activeCount = printers.filter((printer) => printer.status === 'available' && !printer.currentJobId).length
  const attentionCount = printers.filter((printer) => printer.status !== 'available').length
  const currentJob = jobs.find((job) => job.status === 'printing')
  return <>
    <PageHeading eyebrow="STUDENT WORKSPACE · NORTH CAMPUS" title="Good morning, Aarav" description="A clear queue, a little more breathing room.
    " action={<button className="button button-primary" onClick={() => onNavigate('upload')} type="button"><Upload size={17} />Start a new print</button>} />
    <section className="open-strip"><span className="open-indicator"><i /></span><strong>Printing centre is open</strong><span className="strip-separator" />North Campus · Open until 8:00 PM<span className="strip-link"><Clock3 size={14} /> Updated just now</span></section>

    <div className="metrics-grid">
      <article className="metric-card wait-card"><div className="metric-top"><span className="metric-label">ESTIMATED WAIT TIME</span><span className="metric-icon"><Clock3 size={17} /></span></div><div className="metric-value">{wait}<span> min</span></div><p>{myJob ? `For ${myJob.token} · we'll notify you when it's close` : 'Join the queue to get your estimate'}</p><div className="metric-foot"><span className="wait-spark"><Activity size={13} /> Queue moving steadily</span><span>Live estimate</span></div></article>
      <article className="metric-card position-card"><div className="metric-top"><span className="metric-label">YOUR QUEUE POSITION</span><span className="metric-icon"><Users size={17} /></span></div><div className="metric-value">{myJob ? myJob.status === 'printing' ? 'Now' : `#${position}` : '—'}<span>{myJob?.status === 'printing' ? ' printing' : myJob ? ` of ${waitingJobs.length}` : ''}</span></div><p>{myJob ? myJob.status === 'printing' ? 'Your document is on the printer' : `${Math.max(0, position - 1)} ${position - 1 === 1 ? 'job' : 'jobs'} ahead of you` : 'No active print jobs'}</p><div className="metric-foot"><span className="queue-dot"><span /> Queue position</span><button className="text-link" onClick={() => onNavigate('queue')} type="button">Track queue <ArrowRight size={13} /></button></div></article>
      <article className="metric-card printers-card"><div className="metric-top"><span className="metric-label">PRINTERS AVAILABLE</span><span className="metric-icon"><Printer size={17} /></span></div><div className="metric-value">{activeCount}<span> / {printers.length}</span></div><p>{attentionCount === 0 ? 'All printers are ready' : `${attentionCount} printer${attentionCount === 1 ? ' needs' : 's need'} attention`}</p><div className="printer-mini-list">{printers.map((printer) => <span key={printer.id} className={`mini-printer ${printer.status === 'available' ? printer.currentJobId ? 'mini-busy' : 'mini-online' : 'mini-offline'}`} title={`${printer.name}: ${printer.currentJobId ? 'printing' : statusLabel(printer.status)}`} />)}</div></article>
    </div>

    <div className="dashboard-grid">
      <section className="panel active-job-panel"><div className="panel-heading"><div><p className="eyebrow">YOUR PRINT</p><h2>{myJob ? 'A little progress at a time' : 'Nothing in the queue yet'}</h2></div>{myJob && <StatusBadge status={myJob.status} />}</div>
        {myJob ? <><div className="ticket-card"><div className="ticket-label"><span className="ticket-dot" />DIGITAL TOKEN</div><div className="ticket-row"><strong>{myJob.token}</strong><span className="ticket-separator" /><div><small>FILE</small><b>{myJob.fileName}</b></div><div><small>PRINTED</small><b>{myJob.pages} pages · {myJob.copies} copy</b></div></div><div className="ticket-bottom"><span><Clock3 size={14} /> Added at {myJob.createdAt}</span><span>{myJob.mode === 'colour' ? 'Colour' : 'Black & white'} · {myJob.sides === 'double-sided' ? 'Double-sided' : 'Single-sided'}</span></div></div><button type="button" className="panel-link" onClick={() => onNavigate('queue')}>View queue details <ArrowRight size={15} /></button></> : <div className="empty-inline"><Inbox size={20} /><p>Upload your assignment to get a token and live wait estimate.</p><button className="text-link" onClick={() => onNavigate('upload')} type="button">Upload a document <ArrowRight size={14} /></button></div>}
      </section>

      <section className="panel queue-glance"><div className="panel-heading"><div><p className="eyebrow">RIGHT NOW</p><h2>Queue at a glance</h2></div><span className="live-label"><i /> LIVE</span></div><div className="queue-current"><span className="current-icon"><Printer size={17} /></span><div><small>NOW PRINTING</small><strong>{currentJob?.token ?? 'No active job'}</strong><span>{currentJob?.fileName ?? 'The next job will appear here'}</span></div><span className="current-progress"><span /></span></div><div className="queue-stats"><div><strong>{waitingJobs.length}</strong><span>waiting</span></div><div><strong>{activeCount}</strong><span>printers ready</span></div><div><strong>~{waitingJobs.length ? waitAtPosition(waitingJobs.length) : 0}<small>m</small></strong><span>longest wait</span></div></div><div className="queue-order">{waitingJobs.slice(0, 3).map((job, index) => <div className="queue-order-row" key={job.id}><span className="order-number">{String(index + 1).padStart(2, '0')}</span><span className="order-token">{job.token}</span><span className="order-name">{job.student.split(' ')[0]}</span><span className="order-time">~{waitAtPosition(index + 1)} min</span></div>)}</div><button type="button" className="panel-link" onClick={() => onNavigate('queue')}>See full queue <ArrowRight size={15} /></button></section>
    </div>

    <section className="deadline-banner"><div className="deadline-icon"><Zap size={19} fill="currentColor" /></div><div><strong>Beat the rush, not your deadline.</strong><span>Upload ahead and we’ll let you know when your print is ready to collect.</span></div><button type="button" className="button button-light" onClick={() => onNavigate('upload')}>Print something <ArrowRight size={15} /></button><div className="banner-mark">CP<span>.</span></div></section>
  </>
}

function UploadView({ jobs, onJoin, onNavigate }: { jobs: PrintJob[]; onJoin: (fileName: string, options: PrintOptions, pages: number) => string; onNavigate: (page: PageId) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [fileUrl, setFileUrl] = useState('')
  const [fileError, setFileError] = useState('')
  const [copies, setCopies] = useState(1)
  const [mode, setMode] = useState<PrintOptions['mode']>('black-white')
  const [sides, setSides] = useState<PrintOptions['sides']>('double-sided')
  const [pageRange, setPageRange] = useState('1-8')
  const [priority, setPriority] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const pages = countPages(pageRange)
  const price = pages * copies * (mode === 'colour' ? 5 : 2) + (priority ? 15 : 0)
  const waitingCount = jobs.filter((job) => job.status === 'waiting').length
  const estimate = waitAtPosition(waitingCount + 1)

  function acceptFile(selected: File | undefined) {
    if (!selected) return
    const validType = /\.(pdf|doc|docx)$/i.test(selected.name)
    if (!validType) return setFileError('Choose a PDF, DOC, or DOCX file to continue.')
    if (selected.size > 20 * 1024 * 1024) return setFileError('This file is over 20 MB. Choose a smaller document.')
    if (fileUrl) URL.revokeObjectURL(fileUrl)
    setFile(selected)
    setFileUrl(selected.type === 'application/pdf' ? URL.createObjectURL(selected) : '')
    setFileError('')
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    acceptFile(event.dataTransfer.files[0])
  }

  function handleJoin() {
    if (!file) return setFileError('Add your document before joining the queue.')
    setIsSubmitting(true)
    window.setTimeout(() => {
      setIsSubmitting(false)
      onJoin(file.name, { copies, mode, sides, pageRange, priority }, pages)
    }, 350)
  }

  return <>
    <PageHeading eyebrow="STUDENT WORKSPACE" title="Upload & print" description="Set your options, check the estimate, and take your place in line." action={<button className="button button-outline" type="button" onClick={() => onNavigate('queue')}><Activity size={16} />View queue</button>} />
    <div className="upload-layout">
      <div className="upload-main">
        <section className="panel upload-panel"><div className="section-title"><span className="step-number">01</span><div><h2>Your document</h2><p>PDF, DOC, or DOCX · Up to 20 MB</p></div></div>
          <div className={`dropzone ${file ? 'has-file' : ''}`} onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
            <input id="document-file" type="file" accept=".pdf,.doc,.docx,application/pdf" onChange={(event) => acceptFile(event.target.files?.[0])} />
            {file ? <div className="file-selected"><div className="file-icon"><FileText size={22} /></div><div className="selected-file-info"><strong>{file.name}</strong><span>{(file.size / 1024 / 1024).toFixed(2)} MB · Preview ready</span></div><button type="button" className="icon-button" aria-label="Remove file" title="Remove file" onClick={() => { setFile(null); setFileUrl('') }}><X size={17} /></button></div> : <label htmlFor="document-file" className="dropzone-label"><span className="upload-icon"><Upload size={21} /></span><strong>Drop your file here, or <u>browse</u></strong><span>Keep it under 20 MB. PDF works best.</span></label>}
          </div>
          {fileError && <p className="form-error"><AlertCircle size={15} />{fileError}</p>}
          {file && <div className="document-preview"><div className="preview-toolbar"><span><FileText size={14} /> DOCUMENT PREVIEW</span><span>{file.name}</span></div>{fileUrl ? <iframe title={`Preview of ${file.name}`} src={fileUrl} /> : <div className="doc-preview-fallback"><div className="doc-page"><span className="doc-page-top" /><b>{file.name}</b><span /><span /><span /><span /><span className="short-line" /></div><span>Document preview · {file.name.split('.').pop()?.toUpperCase()}</span></div>}</div>}
        </section>

        <section className="panel options-panel"><div className="section-title"><span className="step-number">02</span><div><h2>Print settings</h2><p>Fine-tune how your document comes out.</p></div></div>
          <div className="form-grid">
            <label className="field-label">Number of copies<span className="stepper"><button type="button" aria-label="Remove one copy" onClick={() => setCopies((value) => Math.max(1, value - 1))}>−</button><input aria-label="Number of copies" type="number" min="1" max="20" value={copies} onChange={(event) => setCopies(Math.max(1, Number(event.target.value)))} /><button type="button" aria-label="Add one copy" onClick={() => setCopies((value) => Math.min(20, value + 1))}>+</button></span></label>
            <label className="field-label">Page range<span className="input-wrap"><input value={pageRange} onChange={(event) => setPageRange(event.target.value)} placeholder="e.g. 1-8, 12" /><span>pages</span></span><small>Use ranges or page numbers, separated by commas.</small></label>
            <fieldset className="field-group"><legend>Ink</legend><div className="segmented-control"><button className={mode === 'black-white' ? 'selected' : ''} type="button" onClick={() => setMode('black-white')}><span className="ink-dot bw" />Black & white</button><button className={mode === 'colour' ? 'selected' : ''} type="button" onClick={() => setMode('colour')}><span className="ink-dot color" />Colour</button></div></fieldset>
            <fieldset className="field-group"><legend>Layout</legend><div className="segmented-control"><button className={sides === 'single-sided' ? 'selected' : ''} type="button" onClick={() => setSides('single-sided')}>Single-sided</button><button className={sides === 'double-sided' ? 'selected' : ''} type="button" onClick={() => setSides('double-sided')}>Double-sided</button></div></fieldset>
          </div>
          <label className="priority-option"><input type="checkbox" checked={priority} onChange={(event) => setPriority(event.target.checked)} /><span className="custom-check"><Check size={12} /></span><span><strong>Rush priority</strong><small>Move ahead when a printer is free · +₹15</small></span><span className="priority-mark"><Zap size={16} /></span></label>
        </section>
      </div>

      <aside className="upload-summary"><div className="summary-heading"><span className="summary-icon"><Sparkles size={17} /></span><span>YOUR ESTIMATE</span></div><div className="summary-wait"><span>Estimated wait time</span><strong>~{estimate}<small> min</small></strong><span className="summary-live"><i /> Based on {waitingCount} jobs ahead</span></div><div className="summary-breakdown"><div><span>Pages selected</span><strong>{pages} pages</strong></div><div><span>Copies</span><strong>{copies}</strong></div><div><span>Print style</span><strong>{mode === 'colour' ? 'Colour' : 'B&W'} · {sides === 'double-sided' ? '2-sided' : '1-sided'}</strong></div>{priority && <div><span>Rush priority</span><strong>₹15.00</strong></div>}</div><div className="summary-price"><span>Estimated total</span><strong>₹{price.toFixed(2)}</strong></div><button className="button button-primary button-wide" type="button" onClick={handleJoin} disabled={isSubmitting}>{isSubmitting ? <><LoaderCircle size={17} className="spin" />Joining queue…</> : <><Printer size={17} />Join the queue<ArrowRight size={16} /></>}</button><p className="summary-note"><ShieldCheck size={14} />Pay at collection · No payment needed now</p><div className="summary-queue"><div className="summary-queue-icon"><Users size={16} /></div><span><strong>{waitingCount} jobs</strong><small>in front of the printers</small></span><button type="button" aria-label="View queue" onClick={() => onNavigate('queue')}><ArrowRight size={16} /></button></div></aside>
    </div>
  </>
}

function countPages(range: string) {
  if (!range.trim()) return 8
  return range.split(',').reduce((total, part) => {
    const values = part.trim().split('-').map(Number)
    if (values.some((value) => !Number.isFinite(value) || value < 1)) return total
    return total + (values.length > 1 ? Math.max(0, values[1] - values[0] + 1) : 1)
  }, 0) || 1
}

function QueueView({ jobs, printers, myJob, position, wait, onNavigate, onCancel }: {
  jobs: PrintJob[]; printers: PrinterRecord[]; myJob: PrintJob | null; position: number; wait: number; onNavigate: (page: PageId) => void; onCancel: (job: PrintJob) => void
}) {
  const orderedJobs = [...jobs].filter((job) => ['waiting', 'printing'].includes(job.status)).sort((a, b) => a.status === 'printing' ? -1 : b.status === 'printing' ? 1 : tokenNumber(a.token) - tokenNumber(b.token))
  const current = orderedJobs.find((job) => job.status === 'printing')
  const currentPrinter = printers.find((printer) => printer.currentJobId === current?.id)
  return <>
    <PageHeading eyebrow="LIVE QUEUE · NORTH CAMPUS" title="Know where you stand." description="Your place updates as the print centre works through each job." action={<button className="button button-outline" type="button" onClick={() => onNavigate('upload')}><Upload size={16} />Add a print</button>} />
    {myJob ? <section className="queue-hero"><div className="queue-hero-main"><span className="ticket-label"><span className="ticket-dot" />YOUR DIGITAL TOKEN</span><strong className="queue-token">{myJob.token}</strong><span className="queue-file"><FileText size={15} />{myJob.fileName}</span><div className="queue-hero-status"><StatusBadge status={myJob.status} /><span>{myJob.status === 'printing' ? `Printing on ${printers.find((printer) => printer.id === myJob.printerId)?.name ?? 'a campus printer'}` : 'You’re in line. We’ll update your place as jobs move.'}</span></div></div><div className="queue-hero-stat"><span>YOUR QUEUE POSITION</span><strong>{myJob.status === 'printing' ? 'Now' : `#${position}`}<small>{myJob.status === 'printing' ? 'printing' : ` of ${orderedJobs.filter((job) => job.status === 'waiting').length}`}</small></strong><span>{myJob.status === 'printing' ? 'Your document is on its way' : `${Math.max(0, position - 1)} ${position - 1 === 1 ? 'job' : 'jobs'} ahead`}</span></div><div className="queue-hero-stat wait-stat"><span>ESTIMATED WAIT TIME</span><strong>{myJob.status === 'printing' ? '1' : wait}<small> min</small></strong><span>{myJob.status === 'printing' ? 'Almost ready for collection' : 'We’ll let you know when it’s close'}</span></div></section> : <section className="panel queue-empty"><span className="empty-icon"><Inbox size={23} /></span><h2>No active token yet</h2><p>Upload a document to see your place and estimate here.</p><button className="button button-primary" type="button" onClick={() => onNavigate('upload')}><Upload size={16} />Upload & print</button></section>}

    {myJob && <section className="panel progress-panel"><div className="panel-heading"><div><p className="eyebrow">YOUR PRINT JOURNEY</p><h2>From upload to pickup</h2></div><span className="progress-note">{myJob.status === 'printing' ? 'Almost there' : `About ${wait} minutes to go`}</span></div><div className={`journey-steps ${myJob.status === 'printing' ? 'journey-printing' : ''}`}><div className="journey-line"><span style={{ width: myJob.status === 'printing' ? '69%' : `${Math.min(48, Math.max(12, (position / Math.max(orderedJobs.length, 1)) * 48))}%` }} /></div><JourneyStep icon={CheckCircle2} title="Uploaded" caption="Document received" done /><JourneyStep icon={Users} title="In the queue" caption={myJob.status === 'printing' ? 'Your turn has arrived' : `Position ${position}`} done={myJob.status === 'printing'} active={myJob.status === 'waiting'} /><JourneyStep icon={Printer} title="Printing" caption={myJob.status === 'printing' ? 'Printer is working' : 'Coming up next'} active={myJob.status === 'printing'} /><JourneyStep icon={BadgeCheck} title="Ready to collect" caption="We’ll notify you" /></div><div className="collection-note"><span className="collection-icon"><Bell size={16} /></span><p><strong>We’ll let you know when it’s ready.</strong><span>Head to the printing centre after your token is marked complete.</span></p><span className="collection-place">Ground floor · Library wing</span></div></section>}

    <div className="queue-lower-grid"><section className="panel live-queue-panel"><div className="panel-heading"><div><p className="eyebrow">LIVE QUEUE</p><h2>Jobs being served</h2></div><span className="live-label"><i /> AUTO-REFRESH</span></div><div className="queue-list">{orderedJobs.length ? orderedJobs.map((job, index) => <div className={`queue-list-row ${job.id === myJob?.id ? 'is-yours' : ''}`} key={job.id}><span className={`queue-list-position ${job.status === 'printing' ? 'position-serving' : ''}`}>{job.status === 'printing' ? <Printer size={15} /> : String(index).padStart(2, '0')}</span><div className="queue-list-detail"><strong>{job.token}{job.id === myJob?.id && <span className="you-tag">YOU</span>}</strong><span>{job.fileName}</span></div><span className="queue-list-student">{job.student}</span><span className="queue-list-time">{job.status === 'printing' ? 'Now' : `~${waitAtPosition(orderedJobs.slice(0, index).filter((queuedJob) => queuedJob.status === 'waiting').length + 1)} min`}</span><StatusBadge status={job.status} /></div>) : <div className="empty-state"><CheckCircle2 size={22} /><strong>All clear</strong><span>There are no active jobs in the queue.</span></div>}</div></section>
      <aside className="panel printer-status-panel"><div className="panel-heading"><div><p className="eyebrow">CENTRE STATUS</p><h2>Printer health</h2></div><button className="icon-button small-icon-button" type="button" title="Printer management" onClick={() => onNavigate('printers')}><ArrowRight size={16} /></button></div><div className="printer-status-list">{printers.map((printer) => { const job = jobs.find((item) => item.id === printer.currentJobId); return <div className="printer-status-row" key={printer.id}><span className={`printer-status-icon ${printer.status === 'available' ? 'printer-ready' : 'printer-alert'}`}><Printer size={16} /></span><div><strong>{printer.name}</strong><span>{job ? `Printing ${job.token}` : printer.model}</span></div><StatusBadge status={printer.status} /></div> })}</div><div className="current-printing"><span className="mini-print-icon"><Printer size={15} /></span><div><small>CURRENT PRINTING JOB</small><strong>{current ? `${current.token} · ${current.student}` : 'No job on a printer'}</strong><span>{current ? `${current.fileName} · ${currentPrinter?.name ?? 'Printer'}` : 'A new job will appear here'}</span></div></div></aside></div>
    {myJob?.status === 'waiting' && <button className="text-link cancel-link" type="button" onClick={() => onCancel(myJob)}><X size={14} />Cancel this print job</button>}
  </>
}

function JourneyStep({ icon: Icon, title, caption, done = false, active = false }: { icon: LucideIcon; title: string; caption: string; done?: boolean; active?: boolean }) {
  return <div className={`journey-step ${done ? 'step-done' : ''} ${active ? 'step-active' : ''}`}><span className="journey-icon"><Icon size={17} /></span><strong>{title}</strong><small>{caption}</small></div>
}

function HistoryView({ jobs, onView, onReprint }: { jobs: PrintJob[]; onView: (job: PrintJob) => void; onReprint: (job: PrintJob) => void }) {
  const [filter, setFilter] = useState<'all' | 'completed' | 'cancelled'>('all')
  const history = jobs.filter((job) => job.status === 'completed' || job.status === 'cancelled').filter((job) => filter === 'all' || job.status === filter).sort((a, b) => tokenNumber(b.token) - tokenNumber(a.token))
  return <>
    <PageHeading eyebrow="STUDENT WORKSPACE" title="Print history" description="Every document you’ve sent through the campus centre." action={<button className="button button-primary" type="button" onClick={() => onReprint(jobs.find((job) => job.student === STUDENT_NAME && job.status === 'completed') ?? jobs[0])}><RefreshCw size={16} />Print again</button>} />
    <section className="history-overview"><div><span className="history-icon"><FileText size={18} /></span><span><strong>{jobs.filter((job) => job.student === STUDENT_NAME && job.status === 'completed').length + 1}</strong><small>prints this week</small></span></div><div><span className="history-icon history-green"><Clock3 size={18} /></span><span><strong>4 min</strong><small>average wait</small></span></div><div><span className="history-icon history-orange"><Zap size={18} /></span><span><strong>₹38</strong><small>saved with B&W</small></span></div><span className="history-illustration"><Printer size={34} /></span></section>
    <section className="panel history-panel"><div className="history-toolbar"><div><p className="eyebrow">RECENT ACTIVITY</p><h2>Your print jobs</h2></div><div className="filter-tabs" role="group" aria-label="Filter print history">{(['all', 'completed', 'cancelled'] as const).map((option) => <button key={option} className={filter === option ? 'selected' : ''} type="button" onClick={() => setFilter(option)}>{option === 'all' ? 'All jobs' : option[0].toUpperCase() + option.slice(1)}</button>)}</div></div>
      {history.length ? <div className="history-table-wrap"><table className="data-table history-table"><thead><tr><th>DOCUMENT</th><th>TOKEN</th><th>DATE & TIME</th><th>DETAILS</th><th>STATUS</th><th aria-label="Actions" /></tr></thead><tbody>{history.map((job) => <tr key={job.id}><td><span className="table-document"><span className="table-file-icon"><FileText size={16} /></span><span><strong>{job.fileName}</strong><small>{job.student === STUDENT_NAME ? 'Your document' : job.course}</small></span></span></td><td><strong className="table-token">{job.token}</strong></td><td>{job.createdAt}<small className="table-date">Today</small></td><td>{job.pages} pages · {job.copies} copy<small className="table-date">{job.mode === 'colour' ? 'Colour' : 'Black & white'}</small></td><td><StatusBadge status={job.status} /></td><td><div className="table-actions"><button className="icon-button small-icon-button" type="button" title="View document" aria-label={`View ${job.fileName}`} onClick={() => onView(job)}><Search size={15} /></button><button className="icon-button small-icon-button" type="button" title="Print again" aria-label={`Print ${job.fileName} again`} onClick={() => onReprint(job)}><RefreshCw size={15} /></button></div></td></tr>)}</tbody></table></div> : <div className="empty-state history-empty"><History size={23} /><strong>No {filter === 'all' ? '' : filter} jobs yet</strong><span>Completed prints will show up here.</span></div>}</section>
  </>
}

function AdminView({ jobs, printers, waitingJobs, onCallNext, onUpdateJob, onTogglePrinter, onView, onNavigate }: {
  jobs: PrintJob[]; printers: PrinterRecord[]; waitingJobs: PrintJob[]; onCallNext: () => void; onUpdateJob: (jobId: string, status: JobStatus) => void; onTogglePrinter: (printerId: string) => void; onView: (job: PrintJob) => void; onNavigate: (page: PageId) => void
}) {
  const printingJobs = jobs.filter((job) => job.status === 'printing')
  const completedJobs = jobs.filter((job) => job.status === 'completed')
  const cancelledJobs = jobs.filter((job) => job.status === 'cancelled')
  const openPrinterCount = printers.filter((printer) => printer.status === 'available' && !printer.currentJobId).length
  const queue = [...printingJobs, ...waitingJobs]
  return <>
    <PageHeading eyebrow="PRINT CENTRE · ADMINISTRATOR" title="Centre overview" description="Keep jobs moving and give students a reliable estimate." action={<button className="button button-primary" type="button" onClick={onCallNext} disabled={!waitingJobs.length || !printers.some((printer) => printer.status === 'available' && !printer.currentJobId)}><ArrowRight size={17} />Call next token</button>} />
    <section className="admin-status-strip"><span className="open-indicator"><i /></span><strong>Centre operational</strong><span className="strip-separator" />{openPrinterCount} of {printers.length} printers available<span className="admin-updated"><Clock3 size={14} /> Last updated just now</span></section>
    <div className="admin-metrics-grid"><AdminMetric icon={FileText} label="PRINTS TODAY" value={`${completedJobs.length + printingJobs.length + 39}`} note="↑ 12% from yesterday" tone="green" /><AdminMetric icon={Users} label="WAITING JOBS" value={waitingJobs.length} note="Across all printers" tone="orange" /><AdminMetric icon={Printer} label="PRINTING NOW" value={printingJobs.length} note={`${openPrinterCount} ${openPrinterCount === 1 ? 'printer' : 'printers'} ready`} tone="blue" /><AdminMetric icon={BadgeCheck} label="COMPLETED" value={completedJobs.length + 37} note={`${cancelledJobs.length} cancelled today`} tone="green" /><AdminMetric icon={Clock3} label="AVG. WAIT TIME" value="4 min" note="↓ 2 min this week" tone="ink" /></div>
    <div className="admin-grid"><section className="panel admin-queue-panel"><div className="panel-heading"><div><p className="eyebrow">JOB CONTROL</p><h2>Current queue <span className="heading-count">{queue.length}</span></h2></div><button className="text-link" type="button" onClick={() => onNavigate('queue')}>Student view <ArrowRight size={14} /></button></div>
      {queue.length ? <div className="admin-table-wrap"><table className="data-table admin-table"><thead><tr><th>TOKEN / STUDENT</th><th>DOCUMENT</th><th>STATUS</th><th>EST. WAIT</th><th>PRINTER</th><th aria-label="Actions" /></tr></thead><tbody>{queue.map((job, index) => <tr key={job.id}><td><span className="admin-token">{job.token}</span><small>{job.student}</small></td><td><button className="document-link" type="button" onClick={() => onView(job)}><FileText size={14} />{job.fileName}</button><small>{job.pages} pages · {job.copies} {job.copies > 1 ? 'copies' : 'copy'}</small></td><td><StatusBadge status={job.status} /></td><td>{job.status === 'printing' ? 'Now' : `~${waitAtPosition(queue.slice(0, index).filter((queuedJob) => queuedJob.status === 'waiting').length + 1)} min`}</td><td>{printers.find((printer) => printer.id === job.printerId)?.name ?? '—'}</td><td><div className="table-actions">{job.status === 'waiting' && <button className="icon-button small-icon-button" title="Call this token" aria-label={`Call ${job.token}`} type="button" onClick={onCallNext}><ArrowRight size={15} /></button>}{job.status === 'printing' && <button className="complete-button" type="button" onClick={() => onUpdateJob(job.id, 'completed')}><Check size={14} />Complete</button>}<button className="icon-button small-icon-button" title="Cancel print" aria-label={`Cancel ${job.token}`} type="button" onClick={() => onUpdateJob(job.id, 'cancelled')}><X size={15} /></button></div></td></tr>)}</tbody></table></div> : <div className="empty-state"><CheckCircle2 size={23} /><strong>Queue is clear</strong><span>New student jobs will appear here.</span></div>}
      </section>
      <aside className="panel admin-printer-panel"><div className="panel-heading"><div><p className="eyebrow">EQUIPMENT</p><h2>Printer status</h2></div><button className="icon-button small-icon-button" title="Manage printers" onClick={() => onNavigate('printers')} type="button"><ArrowRight size={16} /></button></div><div className="admin-printer-list">{printers.map((printer) => { const job = jobs.find((item) => item.id === printer.currentJobId); return <div className="admin-printer-row" key={printer.id}><span className={`printer-status-icon ${printer.status === 'available' ? 'printer-ready' : 'printer-alert'}`}><Printer size={16} /></span><div className="admin-printer-info"><strong>{printer.name}</strong><span>{job ? `Printing ${job.token}` : printer.model}</span></div><StatusBadge status={printer.status} /><button className="printer-toggle" type="button" onClick={() => onTogglePrinter(printer.id)}>{printer.status === 'available' ? 'Set unavailable' : 'Set available'}</button></div> })}</div><button className="panel-link" type="button" onClick={() => onNavigate('printers')}>Manage all printers <ArrowRight size={15} /></button></aside></div>
  </>
}

function AdminMetric({ icon: Icon, label, value, note, tone }: { icon: LucideIcon; label: string; value: string | number; note: string; tone: string }) {
  return <article className="admin-metric"><span className={`admin-metric-icon tone-${tone}`}><Icon size={17} /></span><span className="admin-metric-label">{label}</span><strong>{value}</strong><small>{note}</small></article>
}

function PrinterManagement({ printers, jobs, onTogglePrinter, onNavigate }: { printers: PrinterRecord[]; jobs: PrintJob[]; onTogglePrinter: (printerId: string) => void; onNavigate: (page: PageId) => void }) {
  const available = printers.filter((printer) => printer.status === 'available').length
  return <>
    <PageHeading eyebrow="PRINT CENTRE · EQUIPMENT" title="Printer management" description="Know what’s ready, what needs attention, and where each job is headed." action={<button className="button button-outline" type="button" onClick={() => onNavigate('admin')}><ArrowLeft size={15} />Back to admin</button>} />
    <div className="printer-summary-strip"><div className="summary-strip-icon"><Printer size={20} /></div><div><strong>{available} of {printers.length} printers online</strong><span>Students see availability and queue updates as they happen.</span></div><div className="printer-strip-count"><strong>{printers.length - available}</strong><span>need attention</span></div></div>
    <div className="managed-printer-list">{printers.map((printer, index) => {
      const currentJob = jobs.find((job) => job.id === printer.currentJobId)
      const assigned = jobs.filter((job) => printer.assignedQueue.includes(job.token))
      const isAvailable = printer.status === 'available'
      return <article className="panel managed-printer" key={printer.id}><div className="managed-printer-head"><span className={`managed-printer-illustration printer-tone-${index + 1}`}><Printer size={25} /></span><div className="managed-printer-name"><span className="eyebrow">{printer.model}</span><h2>{printer.name}</h2><span className="printer-id">ID · {printer.id.toUpperCase()}</span></div><StatusBadge status={printer.status} /><button className={isAvailable ? 'button button-outline button-sm' : 'button button-primary button-sm'} type="button" onClick={() => onTogglePrinter(printer.id)}>{isAvailable ? <><X size={14} />Mark unavailable</> : <><Check size={14} />Mark available</>}</button></div><div className="managed-printer-details"><div><span className="detail-label">CURRENT JOB</span>{currentJob ? <strong className="detail-job"><span className="job-live-dot" />{currentJob.token} · {currentJob.fileName}</strong> : <strong className="detail-muted">No active print job</strong>}</div><div><span className="detail-label">QUEUE ASSIGNED</span>{assigned.length ? <strong>{assigned.map((job) => job.token).join(' · ')}</strong> : <strong className="detail-muted">No jobs assigned</strong>}</div><div><span className="detail-label">TODAY</span><strong>{18 - index * 3} completed jobs</strong></div></div><div className="managed-printer-foot"><span className={isAvailable ? 'printer-health healthy' : 'printer-health attention'}><i />{printer.status === 'available' ? 'Ready for jobs' : printer.status === 'out-of-paper' ? 'Needs paper refill' : printer.status === 'maintenance' ? 'Under maintenance' : 'Offline'}</span><span>{printer.status === 'out-of-paper' ? 'Load A4 paper to resume printing.' : printer.status === 'maintenance' ? 'Mark available when servicing is complete.' : printer.status === 'offline' ? 'Check the printer connection.' : currentJob ? `Print job ${currentJob.token} in progress.` : 'Waiting for the next assigned job.'}</span></div></article>
    })}</div>
    <div className="equipment-note"><AlertCircle size={16} /><p><strong>Printer status affects student estimates.</strong><span>Set an unavailable printer back to available once it’s ready to prevent students from waiting on a stopped machine.</span></p></div>
  </>
}

function DocumentModal({ job, onClose }: { job: PrintJob; onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="document-modal" role="dialog" aria-modal="true" aria-labelledby="document-modal-title"><div className="modal-heading"><div><p className="eyebrow">DOCUMENT DETAILS · {job.token}</p><h2 id="document-modal-title">{job.fileName}</h2></div><button className="icon-button" type="button" aria-label="Close document details" onClick={onClose}><X size={18} /></button></div><div className="modal-document-preview"><div className="modal-file-page"><span className="doc-page-top" /><FileText size={28} /><strong>{job.fileName}</strong><span>{job.pages} pages · {job.mode === 'colour' ? 'Colour' : 'Black & white'}</span><span className="modal-lines" /><span className="modal-lines short-line" /></div></div><div className="modal-details-grid"><div><span>STUDENT</span><strong>{job.student}</strong></div><div><span>PRINT SETTINGS</span><strong>{job.copies} {job.copies === 1 ? 'copy' : 'copies'} · {job.sides === 'double-sided' ? 'Double-sided' : 'Single-sided'}</strong></div><div><span>STATUS</span><StatusBadge status={job.status} /></div><div><span>ESTIMATED COST</span><strong>₹{job.price.toFixed(2)}</strong></div></div><div className="modal-actions"><button type="button" className="button button-outline" onClick={onClose}>Close</button><button type="button" className="button button-primary" onClick={() => window.print()}><ArrowDownToLine size={16} />Print details</button></div></section></div>
}

export default App
