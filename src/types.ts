export type PageId = 'dashboard' | 'upload' | 'queue' | 'history' | 'admin' | 'printers'
export type JobStatus = 'waiting' | 'printing' | 'completed' | 'cancelled'
export type PrinterStatus = 'available' | 'out-of-paper' | 'maintenance' | 'offline'
export type PrintMode = 'black-white' | 'colour'
export type PrintSides = 'single-sided' | 'double-sided'

export interface PrintOptions {
  copies: number
  mode: PrintMode
  sides: PrintSides
  pageRange: string
  priority: boolean
}

export interface PrintJob extends PrintOptions {
  id: string
  token: string
  student: string
  course: string
  fileName: string
  pages: number
  price: number
  status: JobStatus
  printerId: string | null
  createdAt: string
  eta: number
}

export interface Printer {
  id: string
  name: string
  model: string
  status: PrinterStatus
  currentJobId: string | null
  assignedQueue: string[]
}