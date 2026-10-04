import type { PrintJob, Printer } from './types'

export const initialJobs: PrintJob[] = [
  {
    id: 'job-024', token: '#P024', student: 'Ishita Rao', course: 'CSE · 3rd year',
    fileName: 'DBMS_Lab_Record.pdf', pages: 18, copies: 1, mode: 'black-white',
    sides: 'double-sided', pageRange: '1-18', priority: false, price: 36,
    status: 'printing', printerId: 'printer-1', createdAt: '10:38 AM', eta: 2,
  },
  {
    id: 'job-025', token: '#P025', student: 'Rohan Kulkarni', course: 'ECE · 2nd year',
    fileName: 'Signals_Assignment_2.pdf', pages: 6, copies: 1, mode: 'black-white',
    sides: 'single-sided', pageRange: '1-6', priority: false, price: 12,
    status: 'waiting', printerId: null, createdAt: '10:40 AM', eta: 4,
  },
  {
    id: 'job-026', token: '#P026', student: 'Meera Das', course: 'CSE · 4th year',
    fileName: 'ML_Project_Report.pdf', pages: 24, copies: 1, mode: 'colour',
    sides: 'double-sided', pageRange: '1-24', priority: false, price: 120,
    status: 'waiting', printerId: null, createdAt: '10:41 AM', eta: 6,
  },
  {
    id: 'job-027', token: '#P027', student: 'Aarav Mehta', course: 'B.Tech · CSE · 2nd year',
    fileName: 'DSA_Midsem_Notes.pdf', pages: 12, copies: 1, mode: 'black-white',
    sides: 'double-sided', pageRange: '1-12', priority: false, price: 24,
    status: 'waiting', printerId: null, createdAt: '10:42 AM', eta: 5,
  },
  {
    id: 'job-021', token: '#P021', student: 'Aarav Mehta', course: 'B.Tech · CSE · 2nd year',
    fileName: 'Discrete_Math_Quiz.pdf', pages: 4, copies: 1, mode: 'black-white',
    sides: 'single-sided', pageRange: '1-4', priority: false, price: 8,
    status: 'completed', printerId: 'printer-2', createdAt: '9:18 AM', eta: 0,
  },
  {
    id: 'job-020', token: '#P020', student: 'Neha Shah', course: 'ME · 3rd year',
    fileName: 'Thermodynamics_Sheet.pdf', pages: 3, copies: 1, mode: 'black-white',
    sides: 'single-sided', pageRange: '1-3', priority: false, price: 6,
    status: 'completed', printerId: 'printer-3', createdAt: '9:06 AM', eta: 0,
  },
  {
    id: 'job-019', token: '#P019', student: 'Kabir Nair', course: 'CSE · 1st year',
    fileName: 'Physics_Lab_Manual.pdf', pages: 8, copies: 2, mode: 'black-white',
    sides: 'double-sided', pageRange: '1-8', priority: false, price: 32,
    status: 'cancelled', printerId: null, createdAt: '8:52 AM', eta: 0,
  },
]

export const initialPrinters: Printer[] = [
  { id: 'printer-1', name: 'LaserJet 01', model: 'HP LaserJet Pro M404', status: 'available', currentJobId: 'job-024', assignedQueue: ['#P025'] },
  { id: 'printer-2', name: 'ColorJet 02', model: 'Epson EcoTank L3250', status: 'available', currentJobId: null, assignedQueue: ['#P026'] },
  { id: 'printer-3', name: 'LaserJet 03', model: 'Canon imageCLASS LBP', status: 'out-of-paper', currentJobId: null, assignedQueue: [] },
]