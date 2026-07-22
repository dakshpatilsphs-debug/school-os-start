import React, { useState, useEffect, useCallback } from 'react';
import {
  FiUsers, FiUser, FiDollarSign, FiTrendingDown, FiBarChart2, FiPlus, FiEdit2,
  FiTrash2, FiDownload, FiUpload, FiFileText, FiX, FiCheck, FiAlertCircle,
  FiSearch, FiRefreshCw, FiImage, FiCalendar, FiTrendingUp, FiTrendingDown as FiTrendDown, FiSettings, FiBriefcase, FiPieChart, FiGrid, FiShare2, FiLock, FiEye, FiBell, FiClock, FiAlertTriangle, FiChevronUp, FiChevronDown, FiArrowUp, FiCpu
} from 'react-icons/fi';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts';
import {
  addStudent, getStudents, updateStudent, deleteStudent,
  addFee, getFees, updateFee, deleteFee,
  addExpense, getExpenses, updateExpense, deleteExpense,
  addEmployee, getEmployees, updateEmployee, deleteEmployee,
  addEquipment, getEquipments, updateEquipment, deleteEquipment,
  saveBatchAttendance, saveAttendance, getAttendance, deleteAttendance,
  addHoliday, getHolidays, deleteHoliday,
  addReminder, getReminders, updateReminder, deleteReminder, getNextSequentialId,
  uploadImage, generateAutoId,
  addCausalLeave, getCausalLeaves, deleteCausalLeave, logSalarySlipAudit,
  addSubject, getSubjects, updateSubject, deleteSubject,
  saveTeacherSubjects, getTeacherSubjects, deleteTeacherSubject,
  saveTimetableEntries, getTimetableEntries, deleteTimetableForClass, deleteTimetableEntry,
  saveSubjectConfig, getSubjectConfigs, deleteSubjectConfig
} from './firebase';
import { Student, Fee, Expense, Employee, Equipment, Attendance as Att, Holiday, Reminder, SchoolLogo } from './types';
import { getColors as getPDFColors, getPDFColorsFromSettings, drawHeader as pdfHeader, drawFooter as pdfFooter, drawCoverPage as pdfCover, fmtDate as pdfDate, money as pdfMoney, getStatusColor as pdfStatusColor } from './PDFHelper';
import { AppModals } from './Modals';
import { AttendanceSection } from './Attendance';
import { ScheduleSection } from './Schedule';
import type { SalarySlipData } from './salarySlipTypes';
import AIAssistant from './components/AIAssistant';

type Tab = 'dashboard' | 'students' | 'fees' | 'feesbystudent' | 'expenses' | 'employees' | 'equipments' | 'attendance' | 'reports' | 'reminders' | 'schedule' | 'correction' | 'ai';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [students, setStudents] = useState<Student[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [attendance, setAttendance] = useState<Att[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [reminderForm, setReminderForm] = useState<Reminder>({ title: '', description: '', date: '', time: '09:00', type: 'Fee Collection', priority: 'Medium', status: 'Pending' });
  const [importProgress, setImportProgress] = useState<{ active: boolean; current: number; total: number; status: string; success: number; failed: number }>({ active: false, current: 0, total: 0, status: '', success: 0, failed: 0 });
  const isReadOnly = false; // Read-only mode removed - always full access
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'add' | 'edit'>('add');
  const [currentRecord, setCurrentRecord] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [selectedMonths, setSelectedMonths] = useState<string[]>(() => {
    const now = new Date();
    return [`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`];
  });
  const [showFinMonthPicker, setShowFinMonthPicker] = useState(false);
  const [finSelectedMonths, setFinSelectedMonths] = useState<string[]>(() => {
    const now = new Date();
    return [`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`];
  });
  const [studentClassFilter, setStudentClassFilter] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [firebaseErrorLog, setFirebaseErrorLog] = useState<{ time: string; code: string; message: string; context: string }[]>([]);
  const [timeRange, setTimeRange] = useState('month');
  const [showImageModal, setShowImageModal] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [billFile, setBillFile] = useState<File | null>(null);

  const [schoolSettings, setSchoolSettings] = useState(() => {
    const saved = localStorage.getItem('schoolSettings');
    const defaults = {
      schoolName: 'GPS English Medium High School', schoolLogo: '', primaryColor: '#0ea5e9', secondaryColor: '#4361ee',
      address: 'Pimpri KH', phone: '+91 8806338438', email: 'gpspimpricampus@gmail.com',
      // PDF Editor settings
      pdfHeading: 'School Management Report',
      pdfSubtitle: 'Comprehensive data overview',
      pdfStudentSubtitle: 'All registered students with details',
      pdfFeesSubtitle: 'Complete fee records and collection status',
      pdfEmployeeSubtitle: 'All staff members with salary details',
      pdfExpenseSubtitle: 'All recorded expenses with payment status',
      pdfEquipmentSubtitle: 'All equipment records and assignment details',
      pdfClassSummarySubtitle: 'Overview of all classes',
      pdfFinancialSubtitle: 'Complete financial overview',
      pdfFooterText: 'Confidential - For internal use only',
      pdfLogoWidth: 40,
      pdfLogoHeight: 40,
      pdfHeaderColor: '#0ea5e9',
      pdfBodyColor: '#1e293b',
      pdfTableHeaderColor: '#0ea5e9',
      pdfAccentColor: '#4361ee',
      pdfTitleSize: 22,
      pdfBodySize: 10,
      // Offer Letter defaults (global — same for all employees)
      offerTitle: 'Offer Letter',
      offerPointsHeading: 'Terms & Conditions',
      offerIntro: 'Subject: Appointment for the position of',
      offerPoints: 'Appointment | Appointment is subject to verification of documents.\nPolicies | You are expected to follow all school policies and code of conduct.\nSalary & Duties | Salary and duties will be as discussed and recorded by the administration.',
      offerTerms: 'This offer is valid subject to acceptance and completion of joining formalities.',
      offerSignatory: 'Principal / Administrator',
      offerAck: 'I acknowledge and accept the terms and conditions mentioned above.',
    };
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...defaults, ...parsed };
    }
    return defaults;
  });

  const [studentForm, setStudentForm] = useState<Student>({ autoId: 'STU-AUTO', name: '', rollNumber: '', class: '', parentName: '', parentPhone: '', email: '', address: '', dateOfBirth: '', gender: 'MALE', admissionDate: '', status: 'ACTIVE', package: 'Basic', feeAmount: 16000, submittedDocuments: [] });
  const [classes, setClasses] = useState<string[]>(() => { const s = localStorage.getItem('schoolClasses'); return s ? JSON.parse(s) : ['NUR.', 'JR.KG', 'SR.KG', '1 ST',"2 ND","3 RD","4 TH",]; });
  const [documentOptions, setDocumentOptions] = useState<string[]>(() => { const s = localStorage.getItem('schoolDocumentOptions'); return s ? JSON.parse(s) : ['Birth Certificate', 'Aadhaar Card', 'XEROX BIRTH CERTIFICATE', 'PHOTO', 'PARENT Photo', 'Parent ID Proof','LEAVING CERTIFICATE','ADDMISSION FORM']; });
  const [showDocumentMgmt, setShowDocumentMgmt] = useState(false);
  const [showOfferLetterSettings, setShowOfferLetterSettings] = useState(false);
  const [newDocumentName, setNewDocumentName] = useState('');
  const [packages, setPackages] = useState<{ name: string; amount: number }[]>(() => { const s = localStorage.getItem('schoolPackages'); return s ? JSON.parse(s) : [{ name: 'NUR', amount: 12000 }, { name: 'JR.KG', amount: 13000 }, { name: 'SR.KG', amount:13000 }, { name: '1 ST', amount:  14000},{ name: '2 ND', amount:  15000},{ name: '3 RD', amount:  16000},{ name: '4 TH', amount:  16000},]; });
  const [showClassMgmt, setShowClassMgmt] = useState(false);
  const [showPackageMgmt, setShowPackageMgmt] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newPackageName, setNewPackageName] = useState('');
  const [newPackageAmount, setNewPackageAmount] = useState('');
  const [isCustomPackage, setIsCustomPackage] = useState(false);
  const [customPackageAmount, setCustomPackageAmount] = useState('');
  const [showAllStudents, setShowAllStudents] = useState(false);
  const [showAllFees, setShowAllFees] = useState(false);
  const [showAllFeesByStudent, setShowAllFeesByStudent] = useState(false);
  const [showAllExpenses, setShowAllExpenses] = useState(false);
  const [showAllEmployees, setShowAllEmployees] = useState(false);

  const [feeForm, setFeeForm] = useState<Fee>({ autoId: generateAutoId('F'), studentId: '', studentName: '', originalAmount: 0, applyDiscount: false, discountType: 'amount', discountValue: 0, discountAmount: 0, payableAmount: 0, paymentAmount: 0, balanceAmount: 0, amount: 0, type: 'Tuition Fee', dueDate: '', paidDate: '', status: 'pending', description: '', billUrl: '' } as any);
  const [selectedStudentForFee, setSelectedStudentForFee] = useState('');
  const [feeClassFilter, setFeeClassFilter] = useState('');

  const [expenseForm, setExpenseForm] = useState<Expense>({ autoId: generateAutoId('E'), category: 'Salaries', amount: 0, description: '', date: '', paidTo: '', employeeId: '', status: 'pending', billUrl: '' });
  const [employeeForm, setEmployeeForm] = useState<Employee>({ autoId: generateAutoId('M'), name: '', role: 'TEACHER', phone: '', email: '', address: '', salary: 0, joinDate: '', status: 'ACTIVE', department: '', bankAccount: '', panTaxId: '', salaryAutoRefresh: false, salaryRefreshDay: 1, inactiveDate: '' } as any);
  const [equipmentForm, setEquipmentForm] = useState<Equipment>({ autoId: generateAutoId('Q'), name: '', category: 'Furniture', assignedToType: 'school', assignedToId: '', assignedToName: 'School', quantity: 1, condition: 'Good', purchaseDate: '', value: 0, status: 'Pending', notes: '' });
  const [equipmentPersonTypeFilter, setEquipmentPersonTypeFilter] = useState<'all' | 'student' | 'teacher'>('all');
  const [equipmentPersonIdFilter, setEquipmentPersonIdFilter] = useState('');
  const [equipmentStudentClassFilter, setEquipmentStudentClassFilter] = useState('');
  const [equipmentEmployeeRoleFilter, setEquipmentEmployeeRoleFilter] = useState('');

  const showNotification = useCallback((message: string, type: 'success' | 'error') => { setNotification({ message, type }); setTimeout(() => setNotification(null), 3000); }, []);

  const getFirebaseErrorMessage = (error: any, fallback = 'Firebase operation failed') => {
    const code = error?.code || '';
    const message = error?.message || '';
    console.error('Firebase Error:', { code, message, fullError: error });

    if (code === 'permission-denied') return 'Firebase permission denied. Check Firestore/Storage rules.';
    if (code === 'unavailable') return 'Firebase is unavailable. Check internet connection or Firebase status.';
    if (code === 'not-found') return 'Firebase document not found.';
    if (code === 'already-exists') return 'Firebase record already exists.';
    if (code === 'resource-exhausted') return 'Firebase quota exceeded.';
    if (code === 'unauthenticated') return 'Firebase unauthenticated. Please check login/auth configuration.';
    if (code === 'invalid-argument') return `Firebase invalid data: ${message}`;
    if (code === 'failed-precondition') return `Firebase failed precondition: ${message}`;
    if (message) return `${fallback}: ${message}`;
    return fallback;
  };

  const showFirebaseError = useCallback((error: any, fallback: string) => {
    const code = error?.code || 'unknown';
    const message = error?.message || String(error || fallback);
    setFirebaseErrorLog(prev => [{ time: new Date().toLocaleString(), code, message, context: fallback }, ...prev.slice(0, 9)]);
    const msg = getFirebaseErrorMessage(error, fallback);
    showNotification(msg, 'error');
  }, [showNotification]);
  const loadData = useCallback(async () => { try { const [s, f, e, emp, eq, att, hol, rem] = await Promise.all([getStudents(), getFees(), getExpenses(), getEmployees(), getEquipments(), getAttendance(), getHolidays(), getReminders()]); setStudents((s as Student[]).sort((a, b) => { const ao = a.sortOrder ?? Number.MAX_SAFE_INTEGER; const bo = b.sortOrder ?? Number.MAX_SAFE_INTEGER; if (ao !== bo) return ao - bo; return (a.name || '').localeCompare(b.name || ''); })); setFees(f as Fee[]); setExpenses(e as Expense[]); setEmployees(emp as Employee[]); setEquipments(eq as Equipment[]); setAttendance(att as Att[]); setHolidays(hol as Holiday[]); setReminders(rem as Reminder[]); } catch (error) { showFirebaseError(error, 'Failed to load data'); } }, [showFirebaseError]);
  const handleRefresh = async () => { setRefreshing(true); await loadData(); setTimeout(() => { setRefreshing(false); showNotification('Data refreshed successfully', 'success'); }, 500); };

  // Generate read-only share link and copy to clipboard
  const handleShareReadOnly = async () => {
    const url = window.location.origin + window.location.pathname + '?readonly=true';
    try {
      if (navigator.share) {
        await navigator.share({ title: 'School OS - Read Only View', url });
        showNotification('Share link opened', 'success');
      } else {
        await navigator.clipboard.writeText(url);
        showNotification('Read-only link copied to clipboard!', 'success');
      }
    } catch (e) {
      // Fallback: show the URL in a prompt so user can copy manually
      window.prompt('Copy this read-only link:', url);
    }
  };

  // ===== FULL REPORT PDF: All data from every page in one document =====
  const exportFullReportPDF = () => {
    const doc = new jsPDF();
    const pw = 210, ph = 297;
    const c = getPDFColorsFromSettings(schoolSettings);
    const bodySize = schoolSettings.pdfBodySize || 10;
    const collectedFees = fees.filter(f => f.status === 'paid').reduce((s, f) => s + f.amount, 0);
    const pendingFees = fees.filter(f => f.status === 'pending').reduce((s, f) => s + f.amount, 0);
    const overdueFees = fees.filter(f => f.status === 'overdue').reduce((s, f) => s + f.amount, 0);
    const totalExp = cyExpenses.reduce((s, e) => s + e.amount, 0);

    // ===== 1. COVER PAGE (date-based title, no "Annual") =====
    const dateStr = pdfDate();
    pdfCover(doc, schoolSettings.pdfHeading || 'School Management Report', schoolSettings.schoolName, schoolSettings.address, schoolSettings.phone, schoolSettings.email, schoolSettings.schoolLogo, c, pw, [
      ['Total Students', String(students.length)],
      ['Active Students', String(students.filter(s => s.status === 'ACTIVE').length)],
      ['Total Employees', String(employees.length)],
      ['Total Equipments', String(equipments.length)],
      ['Equipment Value', pdfMoney(equipments.reduce((sum, e) => sum + (e.value || 0) * (e.quantity || 1), 0))],
      ['Fees Collected', pdfMoney(collectedFees)],
      ['Total Expenses', pdfMoney(totalExp)],
      ['Net Revenue', pdfMoney(stats.netRevenue)],
    ], schoolSettings);

    // ===== 2. STUDENTS =====
    doc.addPage();
    pdfHeader(doc, 'Student Register', schoolSettings.pdfStudentSubtitle || 'All registered students with details', c, pw, schoolSettings.schoolLogo, schoolSettings.schoolName, schoolSettings);
    if (students.length > 0) {
      autoTable(doc, {
        head: [['ID', 'Name', 'Roll', 'Class', 'Parent', 'Phone', 'Fee', 'Status']],
        body: students.map(s => [s.autoId, s.name, s.rollNumber, s.class, s.parentName, s.parentPhone, pdfMoney(s.feeAmount || 0), s.status]),
        startY: 36, theme: 'striped',
        headStyles: { fillColor: c.primary, textColor: c.white, fontSize: bodySize, fontStyle: 'bold', cellPadding: 3 },
        bodyStyles: { fontSize: bodySize - 1, textColor: c.dark, cellPadding: 2.5 },
        alternateRowStyles: { fillColor: c.light },
        columnStyles: {
          0: { cellWidth: 20, textColor: c.primary, fontStyle: 'bold' },
          2: { cellWidth: 12, halign: 'center' },
          3: { cellWidth: 14, halign: 'center' },
          5: { cellWidth: 24 },
          6: { cellWidth: 20, halign: 'right' },
          7: { cellWidth: 16, halign: 'center' }
        },
        margin: { left: 10, right: 10, bottom: 20 },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 7) {
            data.cell.styles.textColor = pdfStatusColor(String(data.cell.raw));
            data.cell.styles.fontStyle = 'bold';
          }
        }
      });
    } else {
      doc.setTextColor(...c.muted); doc.setFontSize(11); doc.setFont('helvetica', 'italic');
      doc.text('No students found', pw / 2, 60, { align: 'center' });
    }


    // ===== 2b. STUDENT DOCUMENT CHECKLIST DETAILS =====
    if (students.length > 0 && documentOptions.length > 0) {
      doc.addPage();
      pdfHeader(doc, 'Student Document Checklist', schoolSettings.pdfStudentSubtitle || 'Submitted and missing documents by student', c, pw, schoolSettings.schoolLogo, schoolSettings.schoolName, schoolSettings);
      
      const checklistHead = [['Student ID', 'Student Name', 'Class', ...documentOptions]];
      const checklistBody = students.map(s => {
        const row = [s.autoId, s.name, s.class || '—'];
        documentOptions.forEach(docOpt => {
          const isSubmitted = (s.submittedDocuments || []).includes(docOpt);
          row.push(isSubmitted ? 'Submitted' : 'Missing');
        });
        return row;
      });

      const docCount = documentOptions.length;
      const hFontSize = docCount > 8 ? bodySize - 2.5 : (docCount > 6 ? bodySize - 2 : bodySize - 1);
      const hPadding = docCount > 8 ? 2 : 2.5;
      const docColWidth = Math.max(10, (190 - 72) / docCount);
      const colStyles: any = {
        0: { cellWidth: 20, textColor: c.primary, fontStyle: 'bold' },
        1: { cellWidth: 38, fontStyle: 'bold' },
        2: { cellWidth: 14, halign: 'center' },
      };
      documentOptions.forEach((_, idx) => {
        colStyles[3 + idx] = { cellWidth: docColWidth, halign: 'center' };
      });

      autoTable(doc, {
        head: checklistHead,
        body: checklistBody,
        startY: 36,
        theme: 'striped',
        headStyles: { fillColor: c.primary, textColor: c.white, fontSize: hFontSize, fontStyle: 'bold', cellPadding: hPadding, halign: 'center', valign: 'middle' },
        bodyStyles: { fontSize: bodySize - 1.5, textColor: c.dark, cellPadding: 2, overflow: 'linebreak', valign: 'middle' },
        alternateRowStyles: { fillColor: c.light },
        columnStyles: colStyles,
        margin: { left: 10, right: 10, bottom: 20 },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index >= 3) {
            data.cell.text = [''];
          }
        },
        didDrawCell: (data) => {
          if (data.section === 'body' && data.column.index >= 3) {
            const isSubmitted = data.cell.raw === 'Submitted';
            const xc = data.cell.x + data.cell.width / 2;
            const yc = data.cell.y + data.cell.height / 2;
            doc.setLineWidth(0.4);
            if (isSubmitted) {
              doc.setDrawColor(16, 185, 129);
              doc.line(xc - 1.8, yc + 0.4, xc - 0.4, yc + 1.8);
              doc.line(xc - 0.4, yc + 1.8, xc + 1.8, yc - 1.2);
            } else {
              doc.setDrawColor(239, 68, 68);
              doc.line(xc - 1.4, yc - 1.4, xc + 1.4, yc + 1.4);
              doc.line(xc + 1.4, yc - 1.4, xc - 1.4, yc + 1.4);
            }
          }
        }
      });
    }

    // ===== 3. FEES & BILLING =====
    doc.addPage();
    pdfHeader(doc, 'Fees and Billing', schoolSettings.pdfFeesSubtitle || 'Complete fee records and collection status', c, pw, schoolSettings.schoolLogo, schoolSettings.schoolName, schoolSettings);
    // Summary bar
    const fy = 36;
    doc.setFillColor(...c.light); doc.roundedRect(10, fy, pw - 20, 20, 2, 2, 'F');
    doc.setFillColor(...c.primary); doc.roundedRect(10, fy, 3, 20, 1.5, 1.5, 'F');
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...c.muted);
    doc.text('COLLECTED', 18, fy + 7); doc.text('PENDING', 65, fy + 7); doc.text('OVERDUE', 115, fy + 7); doc.text('TOTAL', 165, fy + 7);
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...c.dark);
    doc.text(pdfMoney(collectedFees), 18, fy + 15);
    doc.text(pdfMoney(pendingFees), 65, fy + 15);
    doc.text(pdfMoney(overdueFees), 115, fy + 15);
    doc.text(pdfMoney(fees.reduce((s, f) => s + f.amount, 0)), 165, fy + 15);
    if (fees.length > 0) {
      autoTable(doc, {
        head: [['ID', 'Student', 'Amount', 'Type', 'Description', 'Paid Date', 'Status']],
        body: fees.map(f => [f.autoId, f.studentName, pdfMoney(f.amount), f.type, f.description || '-', f.paidDate, f.status]),
        startY: fy + 26, theme: 'striped',
        headStyles: { fillColor: c.primary, textColor: c.white, fontSize: bodySize, fontStyle: 'bold', cellPadding: 3 },
        bodyStyles: { fontSize: bodySize - 1, textColor: c.dark, cellPadding: 2.5 },
        alternateRowStyles: { fillColor: c.light },
        columnStyles: { 2: { halign: 'right' }, 6: { halign: 'center' } },
        margin: { left: 10, right: 10, bottom: 20 },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 6) {
            data.cell.styles.textColor = pdfStatusColor(String(data.cell.raw));
            data.cell.styles.fontStyle = 'bold';
          }
        }
      });
    }

    // ===== 4. EMPLOYEES =====
    doc.addPage();
    pdfHeader(doc, 'Employee Directory', schoolSettings.pdfEmployeeSubtitle || 'All staff members with salary details', c, pw, schoolSettings.schoolLogo, schoolSettings.schoolName, schoolSettings);
    if (employees.length > 0) {
      autoTable(doc, {
        head: [['ID', 'Name', 'Role', 'Department', 'Salary', 'Phone', 'Status']],
        body: employees.map(e => [e.autoId, e.name, e.role, e.department || '-', pdfMoney(e.salary || 0), e.phone, e.status]),
        startY: 36, theme: 'striped',
        headStyles: { fillColor: c.primary, textColor: c.white, fontSize: bodySize, fontStyle: 'bold', cellPadding: 3 },
        bodyStyles: { fontSize: bodySize - 1, textColor: c.dark, cellPadding: 2.5 },
        alternateRowStyles: { fillColor: c.light },
        columnStyles: { 4: { halign: 'right' }, 6: { halign: 'center' } },
        margin: { left: 10, right: 10, bottom: 20 },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 6) {
            data.cell.styles.textColor = pdfStatusColor(String(data.cell.raw));
            data.cell.styles.fontStyle = 'bold';
          }
        }
      });
    }

    // ===== 5. EXPENSES =====
    doc.addPage();
    pdfHeader(doc, 'Expenses Log', schoolSettings.pdfExpenseSubtitle || 'All recorded expenses with payment status', c, pw, schoolSettings.schoolLogo, schoolSettings.schoolName, schoolSettings);
    if (expenses.length > 0) {
      autoTable(doc, {
        head: [['ID', 'Category', 'Amount', 'Paid To', 'Date', 'Status']],
        body: expenses.map(e => [e.autoId, e.category, pdfMoney(e.amount), e.paidTo, e.date, e.status]),
        startY: 36, theme: 'striped',
        headStyles: { fillColor: c.primary, textColor: c.white, fontSize: bodySize, fontStyle: 'bold', cellPadding: 3 },
        bodyStyles: { fontSize: bodySize - 1, textColor: c.dark, cellPadding: 2.5 },
        alternateRowStyles: { fillColor: c.light },
        columnStyles: { 2: { halign: 'right' }, 5: { halign: 'center' } },
        margin: { left: 10, right: 10, bottom: 20 },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 5) {
            data.cell.styles.textColor = pdfStatusColor(String(data.cell.raw));
            data.cell.styles.fontStyle = 'bold';
          }
        }
      });
    }


    // ===== 6. EQUIPMENTS =====
    doc.addPage();
    pdfHeader(doc, 'Equipment Register', schoolSettings.pdfEquipmentSubtitle || 'All equipment records and assignment details', c, pw, schoolSettings.schoolLogo, schoolSettings.schoolName, schoolSettings);
    if (equipments.length > 0) {
      autoTable(doc, {
        head: [['ID', 'Name', 'Category', 'Type', 'Assigned To', 'Qty', 'Condition', 'Value', 'Status']],
        body: equipments.map(eq => [eq.autoId, eq.name, eq.category, eq.assignedToType, eq.assignedToName || '—', String(eq.quantity || 1), eq.condition, pdfMoney((eq.value || 0) * (eq.quantity || 1)), eq.status]),
        startY: 36, theme: 'striped',
        headStyles: { fillColor: c.primary, textColor: c.white, fontSize: bodySize - 0.5, fontStyle: 'bold', cellPadding: 2.8 },
        bodyStyles: { fontSize: bodySize - 1.5, textColor: c.dark, cellPadding: 2.2 },
        alternateRowStyles: { fillColor: c.light },
        columnStyles: { 0: { cellWidth: 20, textColor: c.primary, fontStyle: 'bold' }, 1: { cellWidth: 32, fontStyle: 'bold' }, 5: { halign: 'center' }, 7: { halign: 'right' }, 8: { halign: 'center' } },
        margin: { left: 10, right: 10, bottom: 20 },
        didParseCell: (data) => { if (data.section === 'body' && data.column.index === 8) { data.cell.styles.textColor = pdfStatusColor(String(data.cell.raw)); data.cell.styles.fontStyle = 'bold'; } },
      });
    } else {
      doc.setTextColor(...c.muted); doc.setFontSize(11); doc.setFont('helvetica', 'italic');
      doc.text('No equipment records found', pw / 2, 60, { align: 'center' });
    }

    // ===== 7. CLASS-WISE DETAILED BREAKDOWN (one page per class) =====
    {
      const allClasses = [...new Set(students.filter(s => s.class).map(s => s.class))].sort();

      // 6a. Summary page (all classes overview)
      doc.addPage();
      pdfHeader(doc, 'Class-wise Summary', schoolSettings.pdfClassSummarySubtitle || 'Overview of all classes', c, pw, schoolSettings.schoolLogo, schoolSettings.schoolName, schoolSettings);
      if (allClasses.length > 0) {
        const classData = allClasses.map(cls => {
          const cs = students.filter(s => s.class === cls);
          const cActive = cs.filter(s => s.status === 'ACTIVE');
          const target = cActive.reduce((sum, s) => sum + (s.feeAmount || 0), 0);
          const classFeeIds = cActive.map(s => s.autoId);
          const classFees = cyFees.filter(f => classFeeIds.includes(f.studentId));
          const collected = classFees.filter(f => f.status === 'paid').reduce((sum, f) => sum + f.amount, 0);
          const pending = classFees.filter(f => f.status === 'pending').reduce((sum, f) => sum + f.amount, 0);
          const overdue = classFees.filter(f => f.status === 'overdue').reduce((sum, f) => sum + f.amount, 0);
          const balance = target - collected;
          const rate = target > 0 ? Math.min((collected / target) * 100, 100) : 0;
          return { cls, count: cs.length, active: cActive.length, target, collected, pending, overdue, balance, rate, cActive, classFees };
        });

        // Summary table
        autoTable(doc, {
          head: [['Class', 'Students', 'Active', 'Fee Target', 'Collected', 'Pending', 'Overdue', 'Balance', 'Rate']],
          body: classData.map(cd => [
            cd.cls, String(cd.count), String(cd.active),
            pdfMoney(cd.target), pdfMoney(cd.collected),
            pdfMoney(cd.pending), pdfMoney(cd.overdue),
            pdfMoney(cd.balance), `${cd.rate.toFixed(0)}%`
          ]),
          startY: 36, theme: 'striped',
          headStyles: { fillColor: c.primary, textColor: c.white, fontSize: bodySize, fontStyle: 'bold', cellPadding: 3 },
          bodyStyles: { fontSize: bodySize - 1, textColor: c.dark, cellPadding: 2.5 },
          alternateRowStyles: { fillColor: c.light },
          columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 20 },
            3: { halign: 'right' }, 4: { halign: 'right' },
            5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' }, 8: { halign: 'center' }
          },
          foot: [['TOTAL', String(students.length), String(students.filter(s => s.status === 'ACTIVE').length),
            pdfMoney(students.filter(s => s.status === 'ACTIVE').reduce((sum, s) => sum + (s.feeAmount || 0), 0)),
            pdfMoney(collectedFees), pdfMoney(pendingFees), pdfMoney(overdueFees),
            pdfMoney(students.filter(s => s.status === 'ACTIVE').reduce((sum, s) => sum + (s.feeAmount || 0), 0) - collectedFees), '']],
          footStyles: { fillColor: c.primary, textColor: c.white, fontSize: bodySize, fontStyle: 'bold', cellPadding: 2.8 },
          margin: { left: 10, right: 10, bottom: 20 }
        });

        // 6b. Detailed page for EACH class (segregated)
        classData.forEach(cd => {
          doc.addPage();
          pdfHeader(doc, `Class ${cd.cls} — Detailed Report`, `${cd.active} active students`, c, pw, schoolSettings.schoolLogo, schoolSettings.schoolName, schoolSettings);

          // Class info box + fee summary boxes
          const boxY = 36;

          // Full-width class info box: prevents overlap/clipping with summary cards
          doc.setFillColor(...c.lighter);
          doc.roundedRect(10, boxY, pw - 20, 24, 3, 3, 'F');
          doc.setFillColor(...c.primary);
          doc.rect(10, boxY, 3, 24, 'F');

          doc.setTextColor(...c.primary);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(14);
          doc.text(`Class ${cd.cls}`, 18, boxY + 8);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(...c.muted);
          doc.text(`${cd.count} students (${cd.active} active)`, 18, boxY + 15);
          doc.text(`Collection rate: ${cd.rate.toFixed(1)}%`, 18, boxY + 21);

          // Fee summary moved to a separate row so class details never get clipped
          const sumY = boxY + 32;
          const sumGap = 4;
          const sumW = (pw - 20 - 2 * sumGap) / 3;
          const sumH = 24;
          const sumStartX = 10;

          const summaries: [string, number, [number, number, number]][] = [
            ['COLLECTED', cd.collected, [16, 185, 129]],
            ['PENDING', cd.pending, [245, 158, 11]],
            ['OVERDUE', cd.overdue, [239, 68, 68]],
          ];

          summaries.forEach(([label, amount, color], i) => {
            const sx = sumStartX + i * (sumW + sumGap);

            doc.setFillColor(...c.lighter);
            doc.roundedRect(sx, sumY, sumW, sumH, 2, 2, 'F');
            doc.setFillColor(color[0], color[1], color[2]);
            doc.roundedRect(sx, sumY, sumW, 2, 1, 1, 'F');

            doc.setTextColor(color[0], color[1], color[2]);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.text(label, sx + sumW / 2, sumY + 7, { align: 'center' });

            doc.setTextColor(...c.dark);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10.5);
            doc.text(pdfMoney(amount), sx + sumW / 2, sumY + 15, { align: 'center' });

            doc.setTextColor(...c.muted);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.text(`Target: ${pdfMoney(cd.target)}`, sx + sumW / 2, sumY + 21, { align: 'center' });
          });

          // Student list with their individual fee status
          autoTable(doc, {
            head: [['ID', 'Student Name', 'Roll', 'Package', 'Fee', 'Paid', 'Pending', 'Balance', 'Status']],
            body: cd.cActive.map(s => {
              const sf = cd.classFees.filter(f => f.studentId === s.autoId);
              const paid = sf.filter(f => f.status === 'paid').reduce((sum, f) => sum + f.amount, 0);
              const pend = sf.filter(f => f.status === 'pending').reduce((sum, f) => sum + f.amount, 0);
              const bal = (s.feeAmount || 0) - paid;
              const stat = bal <= 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'UNPAID';
              return [s.autoId, s.name, s.rollNumber, s.package, pdfMoney(s.feeAmount || 0), pdfMoney(paid), pdfMoney(pend), pdfMoney(bal), stat];
            }),
            startY: 98, theme: 'striped',
            headStyles: { fillColor: c.primary, textColor: c.white, fontSize: bodySize - 0.5, fontStyle: 'bold', cellPadding: 2.8 },
            bodyStyles: { fontSize: bodySize - 1.5, textColor: c.dark, cellPadding: 2.2 },
            alternateRowStyles: { fillColor: c.light },
            columnStyles: {
              0: { cellWidth: 24, textColor: c.primary, fontStyle: 'bold' },
              1: { cellWidth: 38, fontStyle: 'bold' },
              2: { cellWidth: 14, halign: 'center' },
              4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' },
              8: { halign: 'center' }
            },
            margin: { left: 10, right: 10, bottom: 20 },
            didParseCell: (data) => {
              if (data.section === 'body' && data.column.index === 8) {
                data.cell.styles.textColor = pdfStatusColor(String(data.cell.raw));
                data.cell.styles.fontStyle = 'bold';
              }
            }
          });

          // Class totals footer
          const afterY = (doc as any).lastAutoTable?.finalY || 120;
          const tBalance = cd.target - cd.collected;
          doc.setFillColor(...c.primary); doc.roundedRect(10, afterY + 6, pw - 20, 14, 2, 2, 'F');
          doc.setTextColor(...c.white); doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5);
          doc.text(`CLASS ${cd.cls} TOTALS`, 18, afterY + 15);
          doc.setFontSize(9.5);
          doc.text(`Collected: ${pdfMoney(cd.collected)}`, pw / 2 - 10, afterY + 15);
          doc.text(`Balance: ${pdfMoney(tBalance)}`, pw - 18, afterY + 15, { align: 'right' });
        });
      }
    }

    // ===== 7. FINANCIAL SUMMARY =====
    doc.addPage();
    pdfHeader(doc, 'Financial Summary', schoolSettings.pdfFinancialSubtitle || 'Complete financial overview', c, pw, schoolSettings.schoolLogo, schoolSettings.schoolName, schoolSettings);
    let sy = 42;
    const finItems: [string, string, boolean][] = [
      ['Total Students', String(students.length), false],
      ['Active Students', String(students.filter(s => s.status === 'ACTIVE').length), false],
      ['Total Employees', String(employees.length), false],
      ['Total Fee Target', pdfMoney(students.filter(s => s.status === 'ACTIVE').reduce((s2, st) => s2 + (st.feeAmount || 0), 0)), false],
      ['Fees Collected', pdfMoney(collectedFees), false],
      ['Fees Pending', pdfMoney(pendingFees), false],
      ['Fees Overdue', pdfMoney(overdueFees), false],
      ['Total Expenses', pdfMoney(totalExp), false],
      ['Monthly Salary Payout', pdfMoney(getEligibleSalaryEmployees().reduce((s, e) => s + (e.salary || 0), 0)), false],
      ['NET REVENUE', pdfMoney(stats.netRevenue), true],
    ];
    finItems.forEach(([label, val, highlight]) => {
      if (highlight) {
        doc.setFillColor(...c.primary); doc.roundedRect(10, sy - 6, pw - 20, 14, 2, 2, 'F');
        doc.setTextColor(...c.white); doc.setFontSize(13); doc.setFont('helvetica', 'bold');
        doc.text(label, 18, sy + 3);
        doc.text(val, pw - 18, sy + 3, { align: 'right' });
        sy += 18;
      } else {
        doc.setTextColor(...c.muted); doc.setFontSize(10.5); doc.setFont('helvetica', 'normal');
        doc.text(label, 18, sy);
        doc.setTextColor(...c.dark); doc.setFont('helvetica', 'bold');
        doc.text(val, pw - 18, sy, { align: 'right' });
        doc.setDrawColor(...c.border); doc.setLineWidth(0.2); doc.line(10, sy + 3, pw - 10, sy + 3);
        sy += 12;
      }
    });

    // Professional footer on ALL pages
    pdfFooter(doc, schoolSettings.schoolName, pw, schoolSettings);
    doc.save(`School_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    showNotification('Full report PDF generated successfully', 'success');
  };

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { localStorage.setItem('schoolClasses', JSON.stringify(classes)); }, [classes]);
  useEffect(() => { localStorage.setItem('schoolPackages', JSON.stringify(packages)); }, [packages]);
  useEffect(() => { localStorage.setItem('schoolDocumentOptions', JSON.stringify(documentOptions)); }, [documentOptions]);
  useEffect(() => { localStorage.setItem('schoolSettings', JSON.stringify(schoolSettings)); }, [schoolSettings]);
  useEffect(() => { setShowAllStudents(false); setShowAllFees(false); setShowAllFeesByStudent(false); setShowAllExpenses(false); setShowAllEmployees(false); }, [searchTerm]);

  const getCurrentYearData = (data: any[]) => { const cy = new Date().getFullYear(); return data.filter(item => { const d = item.date || item.dueDate || item.paidDate; return !d || new Date(d).getFullYear() === cy; }); };
  const getEffectiveFeeStatus = (fee: Fee): 'paid' | 'pending' | 'overdue' => {
    if (fee.status === 'paid') return 'paid';
    if (fee.status === 'overdue') return 'overdue';
    if (fee.dueDate) {
      const due = new Date(fee.dueDate);
      const today = new Date();
      const diffDays = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > 30) return 'overdue';
    }
    return 'pending';
  };

  const getStudentPaymentInfo = (student: Student) => {
    // Package/target must ALWAYS come from the fee assigned in Student Add/Edit.
    // Fee records only represent collected payment entries. Discount is treated as waived amount
    // only when the fee record is marked paid, so discounted full-payment can still be 100% complete.
    const sf = fees.filter(f => f.studentId === student.autoId);
    const totalPackage = student.feeAmount || 0;
    const paidFees = sf.filter(f => getEffectiveFeeStatus(f) === 'paid');
    const overdueFees = sf.filter(f => getEffectiveFeeStatus(f) === 'overdue');
    const totalPaid = paidFees.reduce((sum, f) => sum + (f.amount || 0), 0);
    const totalDiscount = paidFees.reduce((sum, f) => sum + Number((f as any).discountAmount || 0), 0);
    const creditedAmount = totalPaid + totalDiscount;
    const balance = Math.max(totalPackage - creditedAmount, 0);
    const totalPending = balance;
    const totalOverdue = overdueFees.length > 0 ? balance : 0;
    const percentage = totalPackage > 0 ? Math.min((creditedAmount / totalPackage) * 100, 100) : 0;
    return {
      totalPackage,
      totalPaid,
      totalDiscount,
      totalPending,
      totalOverdue,
      balance,
      percentage,
      paymentStatus: balance <= 0 ? 'PAID' : totalOverdue > 0 ? 'OVERDUE' : totalPaid > 0 ? 'PARTIAL' : 'UNPAID',
      feeCount: sf.length,
    };
  };
  const getEmployeeExpenseInfo = (employee: Employee) => {
    const ee = expenses.filter(e => e.employeeId === employee.autoId);
    return { totalPaid: ee.filter(e => e.status === 'paid').reduce((s, e) => s + e.amount, 0), totalPending: ee.filter(e => e.status === 'pending').reduce((s, e) => s + e.amount, 0), expenseCount: ee.length };
  };
  // Roll number RESETS per class (10A → 001, 002; 10B → 001, 002)
  const generateRollNumber = (studentClass: string) => {
    if (!studentClass) return '001';
    const cs = students.filter(s => s.class === studentClass);
    if (!cs.length) return '001';
    const rolls = cs.map(s => parseInt(s.rollNumber)).filter(n => !isNaN(n));
    return (Math.max(0, ...rolls) + 1).toString().padStart(3, '0');
  };

  // Auto ID is GLOBAL and sequential: STU-001, STU-002...
  const formatStudentAutoId = (num: number) => `STU-${String(num).padStart(3, '0')}`;

  const getNextAvailableStudentAutoId = (sourceStudents: Student[] = students) => {
    const maxNum = sourceStudents
      .reduce((max, s) => {
        const match = String(s.autoId || '').trim().match(/(\d+)$/);
        const num = match ? parseInt(match[1], 10) : 0;
        return num > max ? num : max;
      }, 0);
    return formatStudentAutoId(maxNum + 1);
  };


  const resetStudentForm = () => {
    setStudentForm({
      autoId: 'STU-AUTO',
      name: '',
      rollNumber: '',
      class: '',
      parentName: '',
      parentPhone: '',
      email: '',
      address: '',
      dateOfBirth: '',
      gender: 'MALE',
      admissionDate: '',
      status: 'ACTIVE',
      package: 'Basic',
      feeAmount: 16000,
      submittedDocuments: [],
    });
  };

  const handleAutoCaps = (e: any, field: string, setter: any) => { let v = e.target.value; if (['name', 'class', 'parentName', 'gender', 'status', 'role'].includes(field)) v = v.toUpperCase(); setter((prev: any) => ({ ...prev, [field]: v })); };
  const hexToRgb = (hex: string): [number, number, number] => { const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex); return r ? [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)] : [0, 0, 0]; };
  const previewBill = (url: string) => { setPreviewImage(url); setShowImageModal(true); };
  const handleBillUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { if (isReadOnly) { showNotification('Read-only mode: cannot upload', 'error'); return; } const file = e.target.files?.[0]; if (!file) return; setUploading(true); setBillFile(file); try { const url = await uploadImage(file); if (activeTab === 'expenses') setExpenseForm(prev => ({ ...prev, billUrl: url })); else if (activeTab === 'fees') setFeeForm(prev => ({ ...prev, billUrl: url })); showNotification('Bill uploaded successfully', 'success'); } catch (error) { showFirebaseError(error, 'Failed to upload bill'); } setUploading(false); };


  const resetModalSubViews = useCallback(() => {
    setShowSettings(false);
    setShowClassMgmt(false);
    setShowPackageMgmt(false);
    setShowDocumentMgmt(false);
    setShowOfferLetterSettings(false);
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
    resetModalSubViews();
    setCurrentRecord(null);
    setBillFile(null);
  }, [resetModalSubViews]);

  const handleSaveStudent = async () => {
    try {
      const final: Student = { ...studentForm };

      if (modalType === 'edit' && currentRecord?.id) {
        // Auto ID is locked during edit to prevent mismatched references.
        final.autoId = currentRecord.autoId;
        await updateStudent(currentRecord.id, final);
      } else {
        const seq = await getNextSequentialId('students');
        const autoId = formatStudentAutoId(seq);
        const rollNumber = generateRollNumber(final.class || '');

        final.autoId = autoId;
        final.rollNumber = rollNumber;
        await addStudent(final);
      }

      closeModal();
      resetStudentForm();
      setIsCustomPackage(false);
      setCustomPackageAmount('');
      await loadData();
      showNotification('Student saved successfully', 'success');
    } catch (error) {
      showFirebaseError(error, 'Failed to save student');
    }
  };
  const handlePackageChange = (v: string) => {
    if (v === 'Custom' || v === '') {
      // Keep current amount when switching to custom/none
      setIsCustomPackage(true);
      setStudentForm(prev => ({ ...prev, package: v || 'Custom' }));
    } else {
      // Predefined package selected — auto-fill the amount
      setIsCustomPackage(false);
      const pkg = packages.find(p => p.name === v);
      setStudentForm(prev => ({ ...prev, package: v, feeAmount: pkg?.amount || 0 }));
      setCustomPackageAmount('');
    }
  };
  const handleAddClass = () => { if (!newClassName.trim()) return showNotification('Class name required', 'error'); if (classes.includes(newClassName)) return showNotification('Class already exists', 'error'); setClasses([...classes, newClassName]); setNewClassName(''); showNotification('Class added', 'success'); };
  const handleRemoveClass = (c: string) => { if (confirm(`Remove class "${c}"?`)) { setClasses(classes.filter(x => x !== c)); showNotification('Class removed', 'success'); } };
  const handleAddPackage = () => { if (!newPackageName.trim() || !newPackageAmount.trim()) return showNotification('Name and amount required', 'error'); const amt = parseFloat(newPackageAmount); if (isNaN(amt) || amt <= 0) return showNotification('Valid amount required', 'error'); setPackages([...packages, { name: newPackageName, amount: amt }]); setNewPackageName(''); setNewPackageAmount(''); showNotification('Package added', 'success'); };
  const handleRemovePackage = (n: string) => { if (confirm(`Remove package "${n}"?`)) { setPackages(packages.filter(p => p.name !== n)); showNotification('Package removed', 'success'); } };
  const handleAddDocumentOption = () => { const name = newDocumentName.trim(); if (!name) return showNotification('Document name required', 'error'); if (documentOptions.some(doc => doc.toLowerCase() === name.toLowerCase())) return showNotification('Document already exists', 'error'); setDocumentOptions(prev => [...prev, name]); setNewDocumentName(''); showNotification('Document added', 'success'); };
  const handleRemoveDocumentOption = (documentName: string) => { if (!confirm(`Remove document "${documentName}" from checklist?`)) return; setDocumentOptions(prev => prev.filter(doc => doc !== documentName)); setStudentForm(prev => ({ ...prev, submittedDocuments: ((prev as any).submittedDocuments || []).filter((doc: string) => doc !== documentName) })); showNotification('Document removed', 'success'); };
  const calculateFeeDiscountForForm = (originalAmount: number, discountType: 'amount' | 'percent', discountValue: number, applyDiscount: boolean) => {
    const safeOriginalAmount = Number(originalAmount || 0);
    const safeDiscountValue = Number(discountValue || 0);
    const discountAmount = applyDiscount
      ? (discountType === 'percent'
        ? Math.min((safeOriginalAmount * safeDiscountValue) / 100, safeOriginalAmount)
        : Math.min(safeDiscountValue, safeOriginalAmount))
      : 0;
    return { originalAmount: safeOriginalAmount, discountAmount, amount: Math.max(safeOriginalAmount - discountAmount, 0) };
  };

  const handleStudentSelection = (id: string) => {
    const s = students.find(x => x.id === id);
    if (s) {
      setFeeForm(prev => {
        const originalAmount = s.feeAmount || 0;
        const discountType = ((prev as any).discountType || 'amount') as 'amount' | 'percent';
        const discountValue = (prev as any).discountValue || 0;
        const applyDiscount = Boolean((prev as any).applyDiscount);
        const calculated = calculateFeeDiscountForForm(originalAmount, discountType, discountValue, applyDiscount);
        return { ...prev, studentId: s.autoId, studentName: s.name, applyDiscount, ...calculated, payableAmount: calculated.amount, paymentAmount: calculated.amount, balanceAmount: 0 } as any;
      });
      setSelectedStudentForFee(id);
      setFeeClassFilter(s.class || '');
      showNotification(`Selected: ${s.name} (${s.class})`, 'success');
    }
  };
  const handleSaveFee = async () => {
    if (!feeForm.studentId) { showNotification('Please select a student', 'error'); return; }
    try {
      let final: any = { ...feeForm };
      const selectedStudent = students.find(s => s.autoId === final.studentId);
      const originalAmount = Number(selectedStudent?.feeAmount || final.originalAmount || final.amount || 0);
      const discountType = (final.discountType || 'amount') as 'amount' | 'percent';
      const discountValue = Number(final.discountValue || 0);
      const applyDiscount = Boolean(final.applyDiscount);
      const calculated = calculateFeeDiscountForForm(originalAmount, discountType, discountValue, applyDiscount);
      const payableAmount = calculated.amount;
      const paymentAmount = Math.min(Math.max(Number(final.paymentAmount ?? final.amount ?? payableAmount), 0), payableAmount);
      const balanceAmount = Math.max(payableAmount - paymentAmount, 0);
      final = { ...final, discountType, discountValue, applyDiscount, ...calculated, originalAmount, payableAmount, paymentAmount, amount: paymentAmount, balanceAmount, status: paymentAmount > 0 ? 'paid' : final.status };

      if (modalType === 'edit' && currentRecord?.id) await updateFee(currentRecord.id, final);
      else { const seq = await getNextSequentialId('fees'); final.autoId = 'FEE-' + String(seq).padStart(3, '0'); await addFee(final); }
      closeModal();
      setFeeForm({ autoId: generateAutoId('F'), studentId: '', studentName: '', originalAmount: 0, applyDiscount: false, discountType: 'amount', discountValue: 0, discountAmount: 0, payableAmount: 0, paymentAmount: 0, balanceAmount: 0, amount: 0, type: 'Tuition Fee', dueDate: '', paidDate: '', status: 'pending', description: '', billUrl: '' } as any);
      setBillFile(null); setSelectedStudentForFee(''); setFeeClassFilter(''); await loadData(); showNotification('Fee saved successfully', 'success');
    } catch (error) { showFirebaseError(error, 'Failed to save fee'); }
  };
  const handleEmployeeSelectionForExpense = (id: string) => { const e = employees.find(x => x.id === id); if (e) { setExpenseForm(prev => ({ ...prev, employeeId: e.autoId, paidTo: e.name, category: 'Salaries' })); showNotification(`Selected: ${e.name}`, 'success'); } else { setExpenseForm(prev => ({ ...prev, employeeId: '', paidTo: '' })); } };
  const handleSaveExpense = async () => { try { let final = { ...expenseForm }; if (modalType === 'edit' && currentRecord?.id) await updateExpense(currentRecord.id, final); else { const seq = await getNextSequentialId('expenses'); final.autoId = 'EXP-' + String(seq).padStart(3, '0'); await addExpense(final); } closeModal(); setExpenseForm({ autoId: generateAutoId('E'), category: 'Salaries', amount: 0, description: '', date: '', paidTo: '', employeeId: '', status: 'pending', billUrl: '' }); setBillFile(null); loadData(); showNotification('Expense saved successfully', 'success'); } catch (error) { showFirebaseError(error, 'Failed to save expense'); } };

  const getTodayISO = () => new Date().toISOString().split('T')[0];

  const getMonthKey = (date = new Date()) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  };

  const isEmployeeSalaryEligible = (employee: Employee) => {
    if (employee.status === 'ACTIVE') return true;
    const emp: any = employee;
    if (employee.status === 'INACTIVE' && emp.inactiveDate) {
      const inactiveDate = new Date(emp.inactiveDate);
      const today = new Date();
      const diffDays = Math.floor((today.getTime() - inactiveDate.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays <= 30;
    }
    return false;
  };

  const getEligibleSalaryEmployees = () => employees.filter(e => isEmployeeSalaryEligible(e));

  const salaryExpenseExistsForMonth = (employee: Employee, monthKey: string) => {
    return expenses.some(exp => exp.employeeId === employee.autoId && exp.category === 'Salaries' && (exp.description || '').includes(`AUTO-SALARY-${monthKey}`));
  };

  const runSalaryAutoRefresh = async (manual = false) => {
    const today = new Date();
    const todayDay = today.getDate();
    const monthKey = getMonthKey(today);
    try {
      let created = 0;
      let skipped = 0;
      const autoSalaryEmployees = employees.filter(emp => {
        const e: any = emp;
        const autoEnabled = Boolean(e.salaryAutoRefresh);
        const refreshDay = Number(e.salaryRefreshDay || 1);
        return autoEnabled && refreshDay <= todayDay && isEmployeeSalaryEligible(emp) && !salaryExpenseExistsForMonth(emp, monthKey);
      });
      for (let i = 0; i < autoSalaryEmployees.length; i++) {
        const emp = autoSalaryEmployees[i];
        if (!emp.salary || emp.salary <= 0) { skipped++; continue; }
        const seq = await getNextSequentialId('expenses');
        const salAmt = (emp.monthSalary?.[monthKey] ?? emp.salary) || 0;
        await addExpense({ autoId: 'EXP-' + String(seq).padStart(3, '0'), category: 'Salaries', amount: salAmt, description: `AUTO-SALARY-${monthKey} | Monthly salary for ${emp.name}`, date: getTodayISO(), paidTo: emp.name, employeeId: emp.autoId, status: 'pending', billUrl: '' });
        created++;
      }
      if (manual) showNotification(created > 0 ? `Salary refresh created ${created} salary expense(s)` : 'No salary refresh needed today', 'success');
      if (created > 0) await loadData();
    } catch (error) {
      if (manual) showFirebaseError(error, 'Failed to run salary refresh');
    }
  };

  useEffect(() => {
    if (employees.length === 0) return;
    const todayKey = getTodayISO();
    const storageKey = `salaryAutoRefreshRun_${todayKey}`;
    if (localStorage.getItem(storageKey)) return;
    localStorage.setItem(storageKey, 'true');
    runSalaryAutoRefresh(false);
  }, [employees]);

  const handleSaveEmployee = async () => {
    if (!employeeForm.name.trim()) return showNotification('Employee name required', 'error');
    try {
      let final: any = { ...employeeForm };
      if (final.status === 'INACTIVE' && !final.inactiveDate) final.inactiveDate = getTodayISO();
      if (final.status === 'ACTIVE') final.inactiveDate = '';
      final.salaryRefreshDay = Math.min(Math.max(Number(final.salaryRefreshDay || 1), 1), 28);
      final.salaryAutoRefresh = Boolean(final.salaryAutoRefresh);
      if (modalType === 'edit' && currentRecord?.id) await updateEmployee(currentRecord.id, final);
      else { const seq = await getNextSequentialId('employees'); final.autoId = 'EMP-' + String(seq).padStart(3, '0'); await addEmployee(final); }
      closeModal();
      setEmployeeForm({ autoId: generateAutoId('M'), name: '', role: 'TEACHER', phone: '', email: '', address: '', salary: 0, oldSalary: 0, joinDate: '', status: 'ACTIVE', department: '', bankAccount: '', panTaxId: '', salaryAutoRefresh: false, salaryRefreshDay: 1, inactiveDate: '' } as any);
      await loadData();
      showNotification('Employee saved successfully', 'success');
    } catch (error) { showFirebaseError(error, 'Failed to save employee'); }
  };


  const exportEmployeeOfferPDF = (employee: Employee) => {
    const doc = new jsPDF();
    const pw = 210, ph = 297, ml = 16, mr = pw - ml, cw = mr - ml;
    const padLg = 6.5;

    // ── Color helpers (same as salary slip) ──
    const hexToRgb = (hex: string): [number, number, number] => {
      const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return r ? [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)] : [14, 165, 233];
    };
    const primary: [number, number, number] = hexToRgb(schoolSettings.primaryColor || '#0ea5e9');
    const [pr, pg, pb] = primary;
    const accent: [number, number, number] = hexToRgb(schoolSettings.secondaryColor || '#4361ee');

    // ── Design tokens (matching SalarySlip.css) ──
    const sBorder: [number, number, number] = [226, 232, 240];
    const sText: [number, number, number] = [30, 41, 59];
    const sTextSec: [number, number, number] = [100, 116, 139];
    const sTextMuted: [number, number, number] = [148, 163, 184];
    const sPrimary: [number, number, number] = primary;
    const sPrimaryDark: [number, number, number] = [Math.max(0, pr - 12), Math.max(0, pg - 33), Math.max(0, pb - 34)];
    const sPrimaryLight: [number, number, number] = [Math.round(pr * 0.15 + 224 * 0.85), Math.round(pg * 0.15 + 242 * 0.85), Math.round(pb * 0.15 + 254 * 0.85)];
    const sPrimaryBg: [number, number, number] = [Math.round(pr * 0.07 + 240 * 0.93), Math.round(pg * 0.07 + 249 * 0.93), Math.round(pb * 0.07 + 255 * 0.93)];
    const sBgAlt: [number, number, number] = [248, 250, 252];
    const white: [number, number, number] = [255, 255, 255];

    const trunc = (text: string, maxLen: number) => !text ? '-' : (text.length > maxLen ? text.substring(0, maxLen) + '...' : text);
    const money = (val: number) => 'Rs ' + Math.round(val || 0).toLocaleString('en-IN');

    // ── Data ──
    const subject = schoolSettings.offerIntro || '';
    const pointsHeading = schoolSettings.offerPointsHeading || 'Terms & Conditions';
    const pointsRaw = String(schoolSettings.offerPoints || '').split('\n').map((p: string) => p.trim()).filter(Boolean);
    const terms = schoolSettings.offerTerms || 'This offer is valid subject to acceptance and completion of joining formalities.';
    const ack = schoolSettings.offerAck || '';
    const signatory = schoolSettings.offerSignatory || 'Principal / Administrator';

    // Parse points: "Title | Desc1 :: Desc2"
    const points = pointsRaw.map(p => {
      const idx = p.indexOf('|');
      if (idx > -1) {
        const descPart = p.substring(idx + 1).trim();
        return { t: p.substring(0, idx).trim(), d: descPart ? descPart.split('::').map((s: string) => s.trim()).filter(Boolean) : [] };
      }
      return { t: p, d: [] };
    });

    // ═══ 1. HEADER (salary slip style) ═══
    let y = 20;
    let logoW = 0;
    if (schoolSettings.schoolLogo) {
      try { doc.addImage(schoolSettings.schoolLogo, 'PNG', ml, 13, 18, 18); logoW = 22; } catch (e) {}
    }
    const nameX = logoW > 0 ? ml + logoW : ml;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...sPrimaryDark);
    doc.text(trunc((schoolSettings.schoolName || 'School OS').toUpperCase(), 40), nameX, 19);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...sTextSec);
    doc.text(trunc([schoolSettings.address || '', schoolSettings.phone || '', schoolSettings.email || ''].filter(Boolean).join(' | '), 70), nameX, 25);
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...sTextSec);
    doc.text('DATE:', mr, 15, { align: 'right' });
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...sText);
    doc.text(new Date().toLocaleDateString('en-IN'), mr, 21.5, { align: 'right' });
    doc.setDrawColor(...sPrimary); doc.setLineWidth(0.5); doc.line(ml, 32, mr, 32);

    // ═══ 2. OFFER LETTER BAR (salary slip employee bar style) ═══
    doc.setFillColor(...sPrimaryBg); doc.setDrawColor(...sPrimary); doc.setLineWidth(0.1);
    doc.rect(ml, 39, cw, 20, 'FD');
    doc.setFillColor(...sPrimary); doc.rect(ml, 39, 1, 20, 'F');
    doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(...sText);
    doc.text('Employee: ' + employee.name, ml + 1 + padLg, 51);

    const pillTxt = 'OFFER LETTER';
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
    const pillW = doc.getTextWidth(pillTxt) + 4 * 2;
    const pillX = mr - padLg - pillW;
    doc.setFillColor(...sPrimaryLight); doc.setDrawColor(...sPrimaryLight);
    doc.roundedRect(pillX, 44, pillW, 10, 6, 6, 'FD');
    doc.setTextColor(...sPrimary); doc.text(pillTxt, pillX + pillW / 2, 51.5, { align: 'center' });

    // ═══ 3. EMPLOYEE DETAILS CARD ═══
    y = 64;
    const rowX = ml + padLg;
    const rowW = cw - padLg * 2;
    const halfW = rowW / 2;
    const addrLines = employee.address ? doc.splitTextToSize(employee.address, halfW) : [''];
    const addrExtra = Math.max(0, (addrLines.length - 1) * 4);
    const cardH = 55 + addrExtra;
    doc.setDrawColor(...sBorder); doc.setLineWidth(0.12);
    doc.roundedRect(ml, y, cw, cardH, 3, 3, 'S');
    doc.setFillColor(...sBgAlt);
    doc.roundedRect(ml, y, cw, 11, 3, 3, 'F');
    doc.setDrawColor(...sBorder); doc.setLineWidth(0.1);
    doc.line(ml, y + 11, mr, y + 11);
    doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...sPrimary);
    doc.text('EMPLOYEE DETAILS', ml + padLg, y + 7.5);

    const drawRow = (label: string, val: string, cx: number, cy: number) => {
      doc.setFontSize(9.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...sTextSec);
      doc.text(label, cx, cy);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...sText);
      doc.text(trunc(val || '-', 22), cx + halfW - padLg * 2, cy, { align: 'right' });
    };
    drawRow('Employee ID', employee.autoId || '-', rowX, y + 22);
    drawRow('Designation', employee.role || '-', rowX + halfW, y + 22);
    drawRow('Department', employee.department || '-', rowX, y + 31);
    drawRow('Joining Date', employee.joinDate || '-', rowX + halfW, y + 31);
    drawRow('Salary', money(employee.salary || 0), rowX, y + 40);
    // Address row (full width, wrap long address)
    doc.setFontSize(9.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...sTextSec);
    doc.text('Address', rowX, y + 49);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...sText);
    if (employee.address) {
      doc.text(addrLines[0], rowX + 30, y + 49);
      for (let ai = 1; ai < addrLines.length; ai++) {
        doc.text(addrLines[ai], rowX + 30, y + 49 + ai * 4);
      }
    } else {
      doc.text('-', rowX + 30, y + 49);
    }
    y += cardH + 10;

    // ═══ 4. SUBJECT ═══
    if (subject) {
      const subLines = doc.splitTextToSize(subject, cw);
      if (y + subLines.length * 5 > ph - 35) { doc.addPage(); y = 28; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...sText);
      doc.text(subLines, ml, y);
      y += subLines.length * 5 + 10;
    }

    // ═══ 5. OFFER POINTS ═══
    if (points.length) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...sPrimaryDark);
      doc.text(pointsHeading, ml, y);
      y += 10;
      const indent = 6;
      const descIndent = indent + 4;
      const titleW = cw - indent - 4;
      const descW = cw - descIndent - 4;
      for (let i = 0; i < points.length; i++) {
        const pt = points[i];
        const number = `${i + 1}.`;
        const numW = doc.getTextWidth(number + ' ');
        const titleLines = doc.splitTextToSize(pt.t, titleW - numW);
        const linesCount = 1 + (titleLines.length > 1 ? titleLines.length - 1 : 0) + (pt.d ? pt.d.length : 0);
        const estH = linesCount * 6 + 4;
        if (y + estH > ph - 35) { doc.addPage(); y = 28; }

        // Number + title on first line
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...sPrimaryDark);
        doc.text(number, ml + indent, y);
        doc.text(pt.t, ml + indent + numW, y);
        y += 6;

        // Multi-line title remainder
        if (titleLines.length > 1) {
          doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...sPrimaryDark);
          for (let ti = 1; ti < titleLines.length; ti++) {
            doc.text(titleLines[ti], ml + indent + numW, y);
            y += 6;
          }
        }

        // Description items
        if (pt.d && pt.d.length > 0) {
          for (const desc of pt.d) {
            const dl = doc.splitTextToSize(desc, descW);
            if (y + dl.length * 5 + 2 > ph - 35) { doc.addPage(); y = 28; }
            doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...sTextSec);
            // bullet + first line
            doc.text('•', ml + descIndent, y);
            doc.text(dl[0], ml + descIndent + 4, y);
            y += 5;
            for (let di = 1; di < dl.length; di++) {
              if (y + 5 > ph - 35) { doc.addPage(); y = 28; }
              doc.text(dl[di], ml + descIndent + 4, y);
              y += 5;
            }
          }
        }
        y += 3;
      }
      y += 4;
    }

    // ═══ 6. ADDITIONAL TERMS ═══
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...sPrimaryDark);
    doc.text('Additional Terms', ml, y);
    y += 10;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...sText);
    const termLines = doc.splitTextToSize(terms, cw);
    if (y + termLines.length * 5 > ph - 35) { doc.addPage(); y = 28; }
    doc.text(termLines, ml, y);
    y += termLines.length * 5 + 14;

    // ═══ 7. ACKNOWLEDGEMENT (new page) ═══
    if (ack) {
      doc.addPage(); y = 28;
      const ackLines = doc.splitTextToSize(ack, cw - 16);
      const ackH = 18 + ackLines.length * 5.5;
      doc.setDrawColor(...sBorder); doc.setLineWidth(0.12);
      doc.roundedRect(ml, y, cw, ackH, 3, 3, 'S');
      doc.setFillColor(...sBgAlt);
      doc.roundedRect(ml, y, cw, ackH, 3, 3, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...sPrimary);
      doc.text('ACKNOWLEDGEMENT', ml + padLg, y + 8);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...sText);
      doc.text(ackLines, ml + 8, y + 18);
      y += ackH + 12;
    }

    // ═══ 8. SIGNATURE ═══
    const SIG_LINE_WIDTH = 55;
    const SIG_GAP_ABOVE = 55;
    const SIG_LABEL_OFFSET = 6;
    const SIG_BLOCK_HEIGHT = SIG_GAP_ABOVE + SIG_LABEL_OFFSET + 10;
    const totalSigH = SIG_BLOCK_HEIGHT + 12;

    if (y + totalSigH > ph - 35) { doc.addPage(); y = 28; }

    const leftColX = ml;
    const rightColX = mr - SIG_LINE_WIDTH;

    doc.setDrawColor(...sBorder); doc.setLineWidth(0.12);
    doc.line(leftColX, y + SIG_GAP_ABOVE, leftColX + SIG_LINE_WIDTH, y + SIG_GAP_ABOVE);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...sTextSec);
    doc.text('Employee Signature', leftColX, y + SIG_GAP_ABOVE + SIG_LABEL_OFFSET);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...sPrimary);
    doc.text(employee.name, leftColX, y + SIG_GAP_ABOVE + SIG_LABEL_OFFSET + 10);
    if (employee.address) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...sTextSec);
      doc.text(doc.splitTextToSize(employee.address, SIG_LINE_WIDTH), leftColX, y + SIG_GAP_ABOVE + SIG_LABEL_OFFSET + 17);
    }

    doc.setDrawColor(...sBorder); doc.setLineWidth(0.12);
    doc.line(rightColX, y + SIG_GAP_ABOVE, rightColX + SIG_LINE_WIDTH, y + SIG_GAP_ABOVE);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...sTextSec);
    doc.text('Authorised Signatory', rightColX, y + SIG_GAP_ABOVE + SIG_LABEL_OFFSET);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...sPrimary);
    doc.text(signatory, rightColX, y + SIG_GAP_ABOVE + SIG_LABEL_OFFSET + 10);

    // ═══ 9. FOOTER ═══
    doc.setDrawColor(...sBorder); doc.setLineWidth(0.12);
    doc.line(ml, 273, mr, 273);
    doc.setFontSize(8.5); doc.setTextColor(...sTextMuted); doc.setFont('helvetica', 'normal');
    doc.text('This is a computer-generated offer letter.', pw / 2, 278, { align: 'center' });

    doc.save(`Offer_Letter_${employee.autoId || employee.name}_${new Date().toISOString().split('T')[0]}.pdf`);
    showNotification('Offer letter PDF generated', 'success');
  };

  const drawSalarySlipPDF = (doc: any, emp: Employee, currentMonth: string, monthName: string, _casualLeavesUsed: number = 0, salaryData?: SalarySlipData) => {
    try {
      const sd = salaryData;
      const pw = 210, ML = 14, MR = pw - 14, CW = MR - ML;

      const primary = [14, 165, 233] as [number, number, number];
      const dark = [31, 41, 55] as [number, number, number];
      const light = [241, 245, 249] as [number, number, number];
      const border = [203, 213, 225] as [number, number, number];

      const money = (val: number) => 'Rs ' + Math.round(val || 0).toLocaleString('en-IN');
      const trunc = (t: string, n: number) => !t ? '-' : (t.length > n ? t.substring(0, n) + '..' : t);

      const empAttendance = sd ? [] : attendance.filter(a => a.personId === emp.autoId && a.date.startsWith(currentMonth));
      const presentDays = sd ? sd.attendance.presentDays : empAttendance.filter(a => a.status === 'present').length;
      const absentDays = sd ? sd.attendance.absentDays : empAttendance.filter(a => a.status === 'absent').length;

      const [year, month] = currentMonth.split('-').map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      let workingDays = sd ? sd.attendance.workingDays : 0;
      if (!sd) {
        const holidaysList = holidays || [];
        for (let day = 1; day <= daysInMonth; day++) {
          const ds = `${currentMonth}-${String(day).padStart(2, '0')}`;
          const isSun = new Date(ds).getDay() === 0;
          const isHol = holidaysList.some(h => h && h.date === ds && h.type === 'manual');
          if (!isSun && !isHol) workingDays++;
        }
      }

      const monthlySalary = sd ? sd.salary.monthlyGross : ((emp.monthSalary?.[currentMonth] ?? emp.salary) || 0);
      const perDaySalary = sd ? sd.salary.perDaySalary : (workingDays > 0 ? monthlySalary / workingDays : 0);
      const earnedSalary = sd ? sd.salary.earnedSalary : Math.round(presentDays * perDaySalary);

      // CL yearly quota (academic year June–May)
      const clQuotaVal = Math.max(1, parseInt(localStorage.getItem('clQuota') || '12'));
      let clUsedNum = 0, clRemainingNum = 0;
      if (sd) {
        clUsedNum = sd.attendance.casualLeavesUsed;
        clRemainingNum = sd.attendance.casualLeavesRemaining;
      } else {
        const [yr, mo] = currentMonth.split('-').map(Number);
        const startYear = mo >= 6 ? yr : yr - 1;
        const academicYearStart = `${startYear}-06`;
        const clUsedBefore = attendance.filter(a =>
          a.personId === emp.autoId && a.status === 'absent' &&
          a.date.substring(0, 7) >= academicYearStart &&
          a.date.substring(0, 7) < currentMonth
        ).length;
        const remainingQuota = Math.max(0, clQuotaVal - clUsedBefore);
        clUsedNum = Math.min(absentDays, remainingQuota);
        clRemainingNum = Math.max(0, remainingQuota - clUsedNum);
      }

      // ── CSS-derived design tokens (from SalarySlip.css) ──
      const sBorder = [226, 232, 240] as const;
      const sText = [30, 41, 59] as const;
      const sTextSec = [100, 116, 139] as const;
      const sTextMuted = [148, 163, 184] as const;
      const sPrimary = [14, 165, 233] as const;
      const sPrimaryDark = [2, 132, 199] as const;
      const sPrimaryLight = [224, 242, 254] as const;
      const sPrimaryBg = [240, 249, 255] as const;
      const sBgAlt = [248, 250, 252] as const;

      const padSm = 2;
      const padMd = 4;
      const padLg = 6.5;

      // ============ 1. HEADER ============
      const schoolName = sd ? sd.school.name.toUpperCase() : (schoolSettings?.schoolName || 'School OS').toUpperCase();
      let logoX = 0;
      const logoUrl = sd ? sd.school.logo : schoolSettings?.schoolLogo;
      if (logoUrl) { try { doc.addImage(logoUrl, 'PNG', ML, 13, 18, 18); logoX = 22; } catch (e) {} }
      const nameX = logoUrl ? ML + logoX : ML;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...sPrimaryDark);
      doc.text(schoolName, nameX, 19);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...sTextSec);
      const hdrContact = sd ? [sd.school.address, sd.school.phone, sd.school.email].filter(Boolean).join(' | ') : [schoolSettings?.address || '', schoolSettings?.phone || '', schoolSettings?.email || ''].filter(Boolean).join(' | ');
      if (hdrContact) doc.text(hdrContact, nameX, 25);
      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...sTextSec);
      doc.text('PAY PERIOD:', MR, 15, { align: 'right' });
      doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...sText);
      doc.text(monthName, MR, 21.5, { align: 'right' });
      doc.setDrawColor(...sPrimary); doc.setLineWidth(0.5); doc.line(ML, 32, MR, 32);

      // ============ 2. EMPLOYEE BAR ============
      doc.setFillColor(...sPrimaryBg); doc.setDrawColor(...sPrimary); doc.setLineWidth(0.1);
      doc.rect(ML, 39, CW, 20, 'FD');
      doc.setFillColor(...sPrimary); doc.rect(ML, 39, 1, 20, 'F');
      doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(...sText);
      doc.text('Employee: ' + (sd ? sd.employee.name : emp.name), ML + 1 + padLg, 51);
      const pillTxt = 'SALARY SLIP';
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
      const pillW = doc.getTextWidth(pillTxt) + padMd * 2;
      const pillX = MR - padLg - pillW;
      doc.setFillColor(...sPrimaryLight); doc.setDrawColor(...sPrimaryLight);
      doc.roundedRect(pillX, 44, pillW, 10, 6, 6, 'FD');
      doc.setTextColor(...sPrimary); doc.text(pillTxt, pillX + pillW / 2, 51.5, { align: 'center' });

      // ============ 3. INFO CARDS ============
      let y = 64;
      const cardW = (CW - padLg) / 2;
      const cardH = 65;
      const tBarH = 11;

      const drawIRow = (label: string, value: any, cx: number, cy: number, cw: number) => {
        doc.setFontSize(9.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...sTextSec);
        doc.text(label, cx, cy);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...sText);
        doc.text(trunc(String(value ?? ''), 24) || '-', cx + cw - padLg * 2, cy, { align: 'right' });
      };

      const drawCard = (x: number, title: string, rows: [string, any][]) => {
        doc.setDrawColor(...sBorder); doc.setLineWidth(0.12);
        doc.roundedRect(x, y, cardW, cardH, 3, 3, 'S');
        doc.setFillColor(...sBgAlt);
        doc.roundedRect(x, y, cardW, tBarH, 3, 3, 'F');
        doc.setDrawColor(...sBorder); doc.setLineWidth(0.1);
        doc.line(x, y + tBarH, x + cardW, y + tBarH);
        doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...sPrimary);
        doc.text(title, x + padLg, y + 7.5);
        rows.forEach(([lbl, val], i) => {
          drawIRow(lbl, val, x + padLg, y + tBarH + 7 + i * 8.5, cardW);
        });
      };

      drawCard(ML, 'EMPLOYEE DETAILS', [
        ['Employee ID', sd ? sd.employee.employeeId : emp.autoId],
        ['Designation', sd ? sd.employee.designation : (emp.role || '-')],
        ['Working Days', workingDays],
        ['Present Days', presentDays],
        ['Absent Days', absentDays],
      ]);
      drawCard(ML + cardW + padLg, 'BANK & PAY DETAILS', [
        ['Department', sd ? sd.employee.department : (emp.department || '-')],
        ['Date of Joining', sd ? sd.employee.dateOfJoining : (emp.joinDate || '-')],
        ['Bank / Account No.', sd ? sd.employee.bankAccount : (emp.bankAccount || emp.panTaxId || '-')],
        ['PAN / Tax ID', sd ? (sd.employee.panTaxId || '-') : (emp.panTaxId || '-')],
        ['CL Used / Remaining', String(clUsedNum) + ' / ' + String(clRemainingNum)],
      ]);
      y = y + cardH + padMd + 2;

      // ============ 4. SALARY DETAILS CARD (two columns) ============
      const earnItems: [string, string][] = [
        ['Basic Salary', money(monthlySalary)],
        ['House Rent Allowance', 'Rs 0'],
        ['Travelling Allowance', 'Rs 0'],
        ['Medical Allowance', 'Rs 0'],
        ['Conveyance Allowance', 'Rs 0'],
      ];
      const deductItems: [string, string][] = [
        ['EPF(%)', 'Rs 0'],
        ['PF(%)', 'Rs 0'],
        ['TDS', 'Rs 0'],
        ['Others(-)', 'Rs 0'],
        ['PTAX', 'Rs 0'],
      ];
      const itemCount = Math.max(earnItems.length, deductItems.length);
      // Summary table height (centered box below items)
      const sumTableW = CW * 0.72;
      const sumTableX = ML + (CW - sumTableW) / 2;
      const sumContH = padSm + 8.5 + 8.5 + padSm + 1 + padSm + 10 + padSm;
      const sumH = tBarH + 7 + (1 + itemCount) * 8.5 + padSm + sumContH;

      doc.setDrawColor(...sBorder); doc.setLineWidth(0.12);
      doc.roundedRect(ML, y, CW, sumH, 3, 3, 'S');
      doc.setFillColor(...sBgAlt);
      doc.roundedRect(ML, y, CW, tBarH, 3, 3, 'F');
      doc.setDrawColor(...sBorder); doc.setLineWidth(0.1);
      doc.line(ML, y + tBarH, MR, y + tBarH);
      doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...sPrimary);
      doc.text('SALARY DETAILS', ML + padLg, y + 7.5);

      const colW = (CW - padLg * 3) / 2;
      const earnX = ML + padLg;
      const deductX = earnX + colW + padLg;

      let sy = y + tBarH + 7;
      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...sTextSec);
      doc.text('EARNINGS', earnX, sy);
      doc.text('DEDUCTIONS', deductX, sy);
      sy += 8.5;

      for (let i = 0; i < itemCount; i++) {
        if (i < earnItems.length) {
          doc.setFontSize(9.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...sTextSec);
          doc.text(earnItems[i][0], earnX, sy);
          doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...sText);
          doc.text(earnItems[i][1], earnX + colW - padLg * 2, sy, { align: 'right' });
        }
        if (i < deductItems.length) {
          doc.setFontSize(9.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...sTextSec);
          doc.text(deductItems[i][0], deductX, sy);
          doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...sText);
          doc.text(deductItems[i][1], deductX + colW - padLg * 2, sy, { align: 'right' });
        }
        sy += 8.5;
      }

      sy += padSm;

      // ═══════ Summary table (centered) ═══════
      doc.setDrawColor(...sBorder); doc.setLineWidth(0.12);
      doc.roundedRect(sumTableX, sy, sumTableW, sumContH, 3, 3, 'S');
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(sumTableX, sy, sumTableW, sumContH, 3, 3, 'F');

      let ss = sy + padSm + 7;
      const valX = sumTableX + sumTableW - padLg;
      doc.setFontSize(9.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...sTextSec);
      doc.text('Gross Earnings (A)', sumTableX + padLg, ss);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...sText);
      doc.text(money(monthlySalary), valX, ss, { align: 'right' });
      ss += 8.5;

      doc.setFontSize(9.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...sTextSec);
      doc.text('Gross Deductions (B)', sumTableX + padLg, ss);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...sText);
      doc.text('Rs 0', valX, ss, { align: 'right' });
      ss += padSm;

      doc.setDrawColor(...sBorder); doc.setLineWidth(0.12);
      doc.line(sumTableX + padLg, ss, sumTableX + sumTableW - padLg, ss);
      ss += padSm;

      doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(...sText);
      doc.text('Net Pay (A-B)', sumTableX + padLg, ss + 7);
      doc.setFontSize(13); doc.setTextColor(...sPrimaryDark);
      doc.text(money(earnedSalary), valX, ss + 7, { align: 'right' });

      // ============ 5. FOOTER ============
      doc.setDrawColor(...sBorder); doc.setLineWidth(0.12);
      doc.line(ML, 273, MR, 273);
      doc.setFontSize(8.5); doc.setTextColor(...sTextMuted); doc.setFont('helvetica', 'normal');
      doc.text('This is a computer-generated salary slip.', pw / 2, 278, { align: 'center' });
    } catch (e) {
      const fbSal = 'Rs ' + Math.round(emp?.salary || 0).toLocaleString('en-IN');
      doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
      doc.text(emp?.name || 'Employee', 20, 40);
      doc.setFontSize(11); doc.setFont('helvetica', 'normal');
      doc.text('Salary Slip — ' + monthName, 20, 56);
      doc.setFontSize(9);
      doc.text('Salary: ' + fbSal, 20, 72);
    }
  };

  const numberToWords = (num: number): string => {
    if (num === 0) return 'Zero Rupees Only';
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const twoDigit = (n: number) => n < 20 ? ones[n] : tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    const threeDigit = (n: number) => {
      let s = '';
      if (n >= 100) s += ones[Math.floor(n / 100)] + ' Hundred';
      if (n % 100) s += (s ? ' ' : '') + twoDigit(n % 100);
      return s;
    };
    let n = Math.floor(Math.abs(num));
    let result = '';
    const crore = Math.floor(n / 10000000); n %= 10000000;
    const lakh = Math.floor(n / 100000); n %= 100000;
    const thousand = Math.floor(n / 1000); n %= 1000;
    if (crore) result += twoDigit(crore) + ' Crore ';
    if (lakh) result += twoDigit(lakh) + ' Lakh ';
    if (thousand) result += twoDigit(thousand) + ' Thousand ';
    if (n) result += threeDigit(n);
    return result.trim() + ' Rupees Only';
  };

  const getSalarySlipData = useCallback((emp: Employee): SalarySlipData => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const empAttendance = attendance.filter(a => a.personId === emp.autoId && a.date.startsWith(currentMonth));
    const presentDays = empAttendance.filter(a => a.status === 'present').length;
    const absentDays = empAttendance.filter(a => a.status === 'absent').length;
    const [year, month] = currentMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    let workingDays = 0;
    const hList = holidays || [];
    for (let day = 1; day <= daysInMonth; day++) {
      const ds = `${currentMonth}-${String(day).padStart(2, '0')}`;
      const isSun = new Date(ds).getDay() === 0;
      const isHol = hList.some(h => h && h.date === ds && h.type === 'manual');
      if (!isSun && !isHol) workingDays++;
    }
    const monthlySalary = (emp.monthSalary?.[currentMonth] ?? emp.salary) || 0;
    const perDaySalary = workingDays > 0 ? monthlySalary / workingDays : 0;
    const earnedSalary = Math.round(presentDays * perDaySalary);
    const quota = Math.max(1, parseInt(localStorage.getItem('clQuota') || '12'));
    const startYear = month >= 6 ? year : year - 1;
    const academicYearStart = `${startYear}-06`;
    const clUsedBefore = attendance.filter(a =>
      a.personId === emp.autoId && a.status === 'absent' &&
      a.date.substring(0, 7) >= academicYearStart &&
      a.date.substring(0, 7) < currentMonth
    ).length;
    const remainingQuota = Math.max(0, quota - clUsedBefore);
    const autoCover = Math.min(absentDays, remainingQuota);
    const effectiveAbsent = Math.max(0, absentDays - autoCover);
    const effectivePresent = presentDays + autoCover;
    const effectiveEarnedSalary = Math.round(effectivePresent * perDaySalary);
    return {
      school: {
        name: (schoolSettings?.schoolName || 'School OS').toUpperCase(),
        address: schoolSettings?.address || '',
        phone: schoolSettings?.phone || '',
        email: schoolSettings?.email || '',
        logo: schoolSettings?.schoolLogo || undefined,
      },
      employee: {
        name: emp.name,
        employeeId: emp.autoId,
        designation: emp.role || '-',
        department: emp.department || '-',
        dateOfJoining: emp.joinDate || '-',
        bankAccount: emp.bankAccount || emp.panTaxId || '-',
        panTaxId: emp.panTaxId,
      },
      attendance: {
        workingDays,
        presentDays,
        absentDays: effectiveAbsent,
        casualLeavesUsed: autoCover,
        casualLeavesRemaining: Math.max(0, remainingQuota - autoCover),
      },
      salary: {
        monthlyGross: monthlySalary,
        perDaySalary: Math.round(perDaySalary),
        earnedSalary: effectiveEarnedSalary,
        allowances: 0,
        deductions: 0,
      },
      payPeriod: monthName,
    };
  }, [attendance, holidays, schoolSettings]);

  const exportEmployeeSalarySlip = async (singleEmp?: Employee, salaryData?: SalarySlipData) => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const activeEmps = singleEmp ? [singleEmp] : employees.filter(e => e.status === 'ACTIVE');
    if (activeEmps.length === 0) { showNotification('No employees found', 'error'); return; }

    try {
      const doc = new jsPDF();
      for (let idx = 0; idx < activeEmps.length; idx++) {
        const emp = activeEmps[idx];
        if (idx > 0) doc.addPage();
        let clCount = 0;
        if (!salaryData) {
          try {
            const cl = await getCausalLeaves(emp.autoId);
            clCount = Array.isArray(cl) ? cl.length : 0;
          } catch {}
        }
        drawSalarySlipPDF(doc, emp, currentMonth, monthName, clCount, salaryData);
        if (singleEmp && logSalarySlipAudit) {
          try { await logSalarySlipAudit(emp.autoId); } catch {}
        }
      }

      const filename = singleEmp ? `salary_slip_${singleEmp.autoId}_${currentMonth}.pdf` : `salary_slips_${currentMonth}.pdf`;
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showNotification(`Salary slip${singleEmp ? '' : 's'} exported successfully`, 'success');
    } catch (error: any) {
      showFirebaseError(error, 'Failed to generate salary slip');
    }
  };

  const exportEmployeeReportPDF = () => {
    const months = selectedMonths;
    if (months.length === 0) { showNotification('Please select at least one month', 'error'); return; }
    const reportEmps = employees.filter(e => e.status === 'ACTIVE' || (e.status === 'INACTIVE' && e.inactiveDate));
    if (reportEmps.length === 0) { showNotification('No employees to report', 'error'); return; }

    const isActiveInMonth = (emp: Employee, month: string) => {
      if (emp.status === 'ACTIVE') return true;
      return emp.inactiveDate ? emp.inactiveDate >= month + '-01' : false;
    };

    const hList = holidays || [];
    const doc = new jsPDF();
    const pw = 210, ML = 6, MR = pw - 6, CW = MR - ML;
    const sBorder = [226, 232, 240] as const;
    const sText = [30, 41, 59] as const;
    const sTextSec = [100, 116, 139] as const;
    const sTextMuted = [148, 163, 184] as const;
    const sPrimary = [14, 165, 233] as const;
    const sPrimaryDark = [2, 132, 199] as const;
    const money = (val: number) => 'Rs ' + Math.round(val || 0).toLocaleString('en-IN');

    let grandTotal = 0;
    const empMonthRows: { name: string; role: string; month: string; workingDays: number; presentDays: number; autoCover: number; clLeft: number; earnedSalary: number }[] = [];
    let y = 12;
    const cX = (pct: number) => ML + 2 + CW * pct / 100;

    const buildAttendance = (emp: Employee, month: string) => {
      const [yr, mo] = month.split('-').map(Number);
      const daysInMonth = new Date(yr, mo, 0).getDate();
      const empAttendance = attendance.filter(a => a.personId === emp.autoId && a.date.startsWith(month));
      const presentDays = empAttendance.filter(a => a.status === 'present').length;
      const absentDays = empAttendance.filter(a => a.status === 'absent').length;
      const monthlySalary = (emp.monthSalary?.[month] ?? emp.salary) || 0;
      let workingDays = 0;
      for (let day = 1; day <= daysInMonth; day++) {
        const ds = `${month}-${String(day).padStart(2, '0')}`;
        const d = new Date(ds + 'T12:00:00');
        if (d.getDay() === 0) continue;
        if (hList.some(h => h && h.date === ds && h.type === 'manual')) continue;
        workingDays++;
      }
      const perDaySalary = monthlySalary / (workingDays || 1);
      const quota = Math.max(1, parseInt(localStorage.getItem('clQuota') || '12'));
      const startYear = mo >= 6 ? yr : yr - 1;
      const academicYearStart = `${startYear}-06`;
      const clUsedBefore = attendance.filter(a =>
        a.personId === emp.autoId && a.status === 'absent' &&
        a.date.substring(0, 7) >= academicYearStart &&
        a.date.substring(0, 7) < month
      ).length;
      const remainingQuota = Math.max(0, quota - clUsedBefore);
      const autoCover = Math.min(absentDays, remainingQuota);
      const effPresent = presentDays + autoCover;
      const effAbsent = Math.max(0, absentDays - autoCover);
      const earnedSalary = Math.round(effPresent * perDaySalary);
      const clLeft = Math.max(0, remainingQuota - autoCover);

      // Build daily grid only for visual (mark only days with actual attendance records)
      const daily: { day: number; status: string }[] = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const ds = `${month}-${String(day).padStart(2, '0')}`;
        const d = new Date(ds + 'T12:00:00');
        const isSun = d.getDay() === 0;
        const isHol = hList.some(h => h && h.date === ds && h.type === 'manual');
        const att = attendance.find(a => a.personId === emp.autoId && a.date === ds);
        const status = att ? att.status : (isSun ? 'weekend' : isHol ? 'holiday' : 'absent');
        daily.push({ day, status });
      }

      return { daily, workingDays, presentDays, absentDays, monthlySalary, perDaySalary, earnedSalary, autoCover, clLeft, effAbsent, daysInMonth };
    };

    const drawPageHeader = () => {
      let logoOffset = 0;
      const logoUrl = schoolSettings?.schoolLogo;
      if (logoUrl) { try { doc.addImage(logoUrl, 'PNG', ML, y, 10, 10); logoOffset = 12; } catch (e) {} }
      const schoolName = (schoolSettings?.schoolName || 'School OS').toUpperCase();
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...sPrimaryDark);
      doc.text(schoolName, ML + logoOffset, y + 4);
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...sTextSec);
      const addr = [schoolSettings?.address || '', schoolSettings?.phone || '', schoolSettings?.email || ''].filter(Boolean).join(' | ');
      if (addr) doc.text(addr, ML + logoOffset, y + 8);
      doc.setDrawColor(...sPrimary); doc.setLineWidth(0.3); doc.line(ML, y + 12, MR, y + 12);
      y += 14;
    };

    const needPage = (needed: number) => {
      if (y + needed > 275) { doc.addPage(); y = 12; drawPageHeader(); }
    };

    // ── First page header ──
    drawPageHeader();

    // ── Per-month tables ──
    const colName = ML + 2;
    const colPD = cX(28);
    const colAD = cX(36);
    const colCLU = cX(44);
    const clCLL = cX(52);
    const colWD = cX(60);

    months.forEach((month) => {
      const monthName = new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const monthEmps = reportEmps.filter(emp => isActiveInMonth(emp, month)).map(emp => {
        const att = buildAttendance(emp, month);
        grandTotal += att.earnedSalary;
        empMonthRows.push({ name: emp.name, role: emp.role || '-', month, workingDays: att.workingDays, presentDays: att.presentDays, autoCover: att.autoCover, clLeft: att.clLeft, earnedSalary: att.earnedSalary });
        return { name: emp.name, ...att };
      });
      const monthTotal = monthEmps.reduce((s, e) => s + e.earnedSalary, 0);
      const rowH = 6.5;
      const monthBlockH = 10 + 9 + monthEmps.length * rowH + 7 + 7;

      needPage(monthBlockH);

      // Month header
      doc.setFillColor(248, 250, 252); doc.setDrawColor(...sPrimary); doc.setLineWidth(0.12);
      doc.rect(ML, y, CW, 9, 'FD');
      doc.setFillColor(...sPrimary); doc.rect(ML, y, 2, 9, 'F');
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...sPrimaryDark);
      doc.text(monthName, ML + 5, y + 6.5);
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...sTextSec);
      doc.text('Employees: ' + monthEmps.length, MR - 1, y + 6.5, { align: 'right' });
      y += 11;

      // Column headers
      doc.setFillColor(240, 249, 255); doc.rect(ML, y, CW, 7, 'F');
      doc.setDrawColor(...sBorder); doc.setLineWidth(0.05);
      doc.rect(ML, y, CW, 7, 'S');
      doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...sPrimary);
      doc.text('Name', colName, y + 5);
      doc.text('Present', colPD, y + 5);
      doc.text('Absent', colAD, y + 5);
      doc.text('CL.Used', colCLU, y + 5);
      doc.text('CL.Left', clCLL, y + 5);
      doc.text('Work.Dys', colWD, y + 5);
      doc.text('Earned', MR - 2, y + 5, { align: 'right' });
      y += 8;

      // Employee rows
      doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
      monthEmps.forEach((e, ei) => {
        needPage(rowH + 2);
        if (ei % 2 === 0) { doc.setFillColor(252, 252, 252); doc.rect(ML, y, CW, rowH, 'F'); }
        doc.setTextColor(...sText);
        doc.text(e.name, colName, y + 4.5);
        doc.setTextColor(...sTextSec);
        doc.text(String(e.presentDays), colPD, y + 4.5);
        if (e.absentDays > e.autoCover) doc.setTextColor(220, 38, 38); else doc.setTextColor(...sTextSec);
        doc.text(String(e.absentDays), colAD, y + 4.5);
        doc.setTextColor(6, 182, 212);
        doc.text(String(e.autoCover), colCLU, y + 4.5);
        doc.setTextColor(...sTextSec);
        doc.text(String(e.clLeft), clCLL, y + 4.5);
        doc.text(String(e.workingDays), colWD, y + 4.5);
        doc.setFont('helvetica', 'bold'); doc.setTextColor(...sPrimaryDark);
        doc.text(money(e.earnedSalary), MR - 2, y + 4.5, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setDrawColor(...sBorder); doc.setLineWidth(0.03);
        doc.line(ML, y + rowH, MR, y + rowH);
        y += rowH;
      });

      // Month subtotal
      needPage(7);
      doc.setDrawColor(...sPrimary); doc.setLineWidth(0.08);
      doc.line(ML, y, MR, y);
      y += 1;
      doc.setFillColor(248, 250, 252); doc.rect(ML, y, CW, 6, 'F');
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...sText);
      doc.text('Total for ' + monthName, colName, y + 4);
      doc.setFontSize(10); doc.setTextColor(...sPrimaryDark);
      doc.text(money(monthTotal), MR - 2, y + 4, { align: 'right' });
      y += 8;
    });

    // ── Employee Summary Table ──
    if (empMonthRows.length > 0) {
      const rowH = 7;
      const tableH = 12 + empMonthRows.length * rowH + 3;
      needPage(tableH);
      doc.setDrawColor(...sBorder); doc.setLineWidth(0.1);
      doc.roundedRect(ML, y, CW, tableH, 1, 1, 'S');
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(ML, y, CW, 10, 1, 1, 'F');
      doc.line(ML, y + 10, MR, y + 10);
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...sPrimary);
      doc.text('EMPLOYEE SUMMARY', ML + 2, y + 7);
      y += 13;
      doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...sTextSec);
      doc.text('Name', colName, y);
      doc.text('Month', cX(24), y);
      doc.text('WD', cX(38), y);
      doc.text('PD', cX(46), y);
      doc.text('CL.U', cX(54), y);
      doc.text('CL.L', cX(62), y);
      doc.text('Earned', MR - 2, y, { align: 'right' });
      y += 1;
      doc.setDrawColor(...sBorder); doc.setLineWidth(0.05);
      doc.line(ML, y, MR, y);
      y += 3;
      doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
      empMonthRows.forEach((r) => {
        const mn = new Date(r.month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        needPage(rowH + 2);
        doc.setTextColor(...sText);
        doc.text(r.name, colName, y + 4.5);
        doc.setTextColor(...sTextSec);
        doc.text(mn, cX(24), y + 4.5);
        doc.text(String(r.workingDays), cX(38), y + 4.5);
        doc.text(String(r.presentDays), cX(46), y + 4.5);
        doc.text(String(r.autoCover), cX(54), y + 4.5);
        doc.text(String(r.clLeft), cX(62), y + 4.5);
        doc.setFont('helvetica', 'bold'); doc.setTextColor(...sPrimaryDark);
        doc.text(money(r.earnedSalary), MR - 2, y + 4.5, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        y += rowH;
      });
      y += 2;
    }

    // ── Month-wise Distribution ──
    if (months.length > 0) {
      const monthDist = months.map(m => {
        const rows = empMonthRows.filter(r => r.month === m);
        const total = rows.reduce((s, r) => s + r.earnedSalary, 0);
        const mn = new Date(m + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        return { label: mn, employees: rows.length, total };
      });
      const distH = 14 + monthDist.length * 8 + 4;
      needPage(distH);
      doc.setDrawColor(...sBorder); doc.setLineWidth(0.1);
      doc.roundedRect(ML, y, CW, distH, 1, 1, 'S');
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(ML, y, CW, 11, 1, 1, 'F');
      doc.line(ML, y + 11, MR, y + 11);
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...sPrimary);
      doc.text('MONTH-WISE DISTRIBUTION', ML + 2, y + 7.5);
      y += 14;
      doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...sTextSec);
      doc.text('Month', ML + 2, y);
      doc.text('Employees', cX(30), y);
      doc.text('Total Paid', MR - 2, y, { align: 'right' });
      y += 1;
      doc.setDrawColor(...sBorder); doc.setLineWidth(0.05);
      doc.line(ML, y, MR, y);
      y += 3.5;
      doc.setFontSize(8); doc.setFont('helvetica', 'normal');
      monthDist.forEach((d) => {
        needPage(10);
        doc.setTextColor(...sText);
        doc.text(d.label, ML + 2, y + 4.5);
        doc.setTextColor(...sTextSec);
        doc.text(String(d.employees), cX(30), y + 4.5);
        doc.setFont('helvetica', 'bold'); doc.setTextColor(...sPrimaryDark);
        doc.text(money(d.total), MR - 2, y + 4.5, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        y += 8;
      });
      y += 3;
    }

    // ── Grand Total ──
    if (reportEmps.length > 0 && months.length > 0) {
      needPage(28);
      doc.setDrawColor(...sBorder); doc.setLineWidth(0.3);
      doc.line(ML, y, MR, y);
      y += 6;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...sPrimary);
      doc.text('GRAND TOTAL', pw / 2, y + 3, { align: 'center' });
      y += 9;
      doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...sTextSec);
      doc.text('Employees: ' + reportEmps.length + ' | Months: ' + months.length, ML, y + 3);
      doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(...sPrimaryDark);
      doc.text('Rs ' + grandTotal.toLocaleString('en-IN'), MR, y + 3, { align: 'right' });
      y += 9;
      doc.setFontSize(7); doc.setFont('helvetica', 'italic'); doc.setTextColor(...sTextMuted);
      doc.text('Rupees ' + numberToWords(grandTotal) + ' Only', pw / 2, y + 2, { align: 'center' });
    }

    // ── Footer ──
    if (y < 275) {
      doc.setDrawColor(...sBorder); doc.setLineWidth(0.08);
      doc.line(ML, 277, MR, 277);
      doc.setFontSize(6); doc.setTextColor(...sTextMuted); doc.setFont('helvetica', 'normal');
      doc.text('Computer-generated report.', pw / 2, 281, { align: 'center' });
    }

    doc.save('Employees_Report_' + months.join('_') + '.pdf');
    showNotification('Employee report PDF exported successfully', 'success');
  };

  const exportEmployeeListPDF = () => {
    const active = employees.filter(e => e.status === 'ACTIVE');
    if (active.length === 0) { showNotification('No active employees', 'error'); return; }
    const doc = new jsPDF();
    const pw = 210, ML = 6, MR = pw - 6, CW = MR - ML;
    const c = getPDFColorsFromSettings(schoolSettings);
    const bodySize = schoolSettings.pdfBodySize || 10;
    const sText = [30, 41, 59] as const;

    // Header
    pdfHeader(doc, 'Employee List', `Active: ${active.length}`, c, pw, schoolSettings.schoolLogo, schoolSettings.schoolName, schoolSettings);

    // Table
    const rows = active.map(e => [
      e.name,
      e.role || '-',
      'Rs ' + Math.round((e.monthSalary?.[Object.keys(e.monthSalary || {})[0]] ?? e.salary) || 0).toLocaleString('en-IN'),
      'Rs ' + Math.round((e.salary || 0)).toLocaleString('en-IN'),
    ]);
    rows.push(['', '', '', '']);
    const totalSalary = active.reduce((s, e) => s + (e.salary || 0), 0);
    rows.push(['TOTAL', '', '', 'Rs ' + Math.round(totalSalary).toLocaleString('en-IN')]);

    autoTable(doc, {
      startY: 30,
      head: [['Name', 'Designation', 'Salary', 'Net Salary']],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [...c.primary], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { textColor: sText, fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 45 },
        2: { cellWidth: 35, halign: 'right' },
        3: { cellWidth: 35, halign: 'right' },
      },
      footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 9 },
    });

    pdfFooter(doc, schoolSettings.schoolName, pw, schoolSettings);
    doc.save('Employee_List.pdf');
    showNotification('Employee list PDF exported', 'success');
  };

  const exportExpenseReportPDF = () => {
    if (!expenses.length) { showNotification('No expenses', 'error'); return; }

    const doc = new jsPDF();
    const pw = 210, ML = 6, MR = pw - 6, CW = MR - ML;
    const c = getPDFColorsFromSettings(schoolSettings);
    const sText = [30, 41, 59] as const;
    const sorted = [...expenses].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    const rows = sorted.map((e, i) => [
      'EXP-' + String(i + 1).padStart(3, '0'),
      e.category,
      'Rs ' + e.amount.toLocaleString('en-IN'),
      e.paidTo || '-',
      e.date,
      e.status,
    ]);

    const totalExpense = sorted.reduce((s, e) => s + e.amount, 0);

    pdfHeader(doc, 'Expense Report', '', c, pw, schoolSettings.schoolLogo, schoolSettings.schoolName, schoolSettings);

    autoTable(doc, {
      startY: 30,
      margin: { left: ML, right: ML },
      head: [['ID', 'Category', 'Amount (Rs)', 'Paid To', 'Date', 'Status']],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [...c.primary], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { textColor: sText, fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 20, halign: 'center' },
        1: { cellWidth: 35, halign: 'left' },
        2: { cellWidth: 30, halign: 'right' },
        3: { cellWidth: 30, halign: 'left' },
        4: { cellWidth: 25, halign: 'center' },
        5: { cellWidth: 20, halign: 'center' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 5) {
          data.cell.styles.textColor = pdfStatusColor(String(data.cell.raw));
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });

    const footerY = (doc as any).lastAutoTable.finalY + 6;
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(239, 68, 68);
    doc.text('Total Expense: Rs ' + totalExpense.toLocaleString('en-IN'), pw / 2, footerY, { align: 'center' });
    doc.setFont(undefined, 'normal');

    pdfFooter(doc, schoolSettings.schoolName, pw, schoolSettings);
    doc.save('Expense_Report.pdf');
    showNotification('Expense report PDF exported', 'success');
  };

  const exportFeesCollectionReportPDF = () => {
    const activeStudents = students.filter(s => s.status === 'ACTIVE');
    if (!activeStudents.length) { showNotification('No active students', 'error'); return; }

    const doc = new jsPDF();
    const pw = 210, CW = 160, ML = (pw - CW) / 2;
    const c = getPDFColorsFromSettings(schoolSettings);
    const sText = [30, 41, 59] as const;

    // Group by class
    const classes = [...new Set(activeStudents.map(s => s.class))].sort();
    const classData = classes.map(cls => {
      const cs = activeStudents.filter(s => s.class === cls);
      let collected = 0;
      cs.forEach(s => {
        collected += getStudentPaymentInfo(s).totalPaid;
      });
      const target = cs.reduce((sum, s) => sum + (s.feeAmount || 0), 0);
      const pending = target - collected;
      return { cls, count: cs.length, target, collected, pending };
    });

    const grandTarget = classData.reduce((s, d) => s + d.target, 0);
    const grandCollected = classData.reduce((s, d) => s + d.collected, 0);
    const grandPending = classData.reduce((s, d) => s + d.pending, 0);

    pdfHeader(doc, 'Fees Collection Report', '', c, pw, schoolSettings.schoolLogo, schoolSettings.schoolName, schoolSettings);

    autoTable(doc, {
      startY: 30,
      margin: { left: ML, right: ML },
      head: [['Class', 'Students', 'Target (Rs)', 'Collected (Rs)', 'Pending (Rs)', 'Collection %']],
      body: classData.map(d => [
        d.cls,
        String(d.count),
        d.target.toLocaleString('en-IN'),
        d.collected.toLocaleString('en-IN'),
        d.pending.toLocaleString('en-IN'),
        d.target > 0 ? ((d.collected / d.target) * 100).toFixed(1) + '%' : '0%',
      ]),
      foot: [[
        'TOTAL',
        String(activeStudents.length),
        grandTarget.toLocaleString('en-IN'),
        grandCollected.toLocaleString('en-IN'),
        grandPending.toLocaleString('en-IN'),
        grandTarget > 0 ? ((grandCollected / grandTarget) * 100).toFixed(1) + '%' : '0%',
      ]],
      theme: 'grid',
      headStyles: { fillColor: [...c.primary], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { textColor: sText, fontSize: 8, halign: 'center' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 9, halign: 'center' },
      columnStyles: {
        0: { cellWidth: 20, halign: 'center' },
        1: { cellWidth: 16, halign: 'center' },
        2: { cellWidth: 33, halign: 'center' },
        3: { cellWidth: 33, halign: 'center' },
        4: { cellWidth: 33, halign: 'center' },
        5: { cellWidth: 25, halign: 'center' },
      },
    });

    const totalRevenue = fees.filter(f => f.status === 'paid').reduce((s, f) => s + f.amount, 0);
    const totalExpenses = expenses.filter(e => e.status === 'paid').reduce((s, e) => s + e.amount, 0);
    const balanceAmt = totalRevenue - totalExpenses;

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      margin: { left: ML, right: ML },
      head: [['Particulars', 'Amount (Rs)']],
      body: [
        ['Revenue', 'Rs ' + totalRevenue.toLocaleString('en-IN')],
        ['Expenses', 'Rs ' + totalExpenses.toLocaleString('en-IN')],
      ],
      foot: [[
        'Balance (Revenue - Expenses)',
        'Rs ' + balanceAmt.toLocaleString('en-IN'),
      ]],
      theme: 'grid',
      headStyles: { fillColor: [...c.primary], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { textColor: sText, fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 100, halign: 'left' },
        1: { cellWidth: 50, halign: 'right' },
      },
    });

    pdfFooter(doc, schoolSettings.schoolName, pw, schoolSettings);
    doc.save('Fees_Collection_Report.pdf');
    showNotification('Fees collection report PDF exported', 'success');
  };

  const exportFinancialReportPDF = () => {
    const activeStudents = students.filter(s => s.status === 'ACTIVE');
    if (activeStudents.length === 0) { showNotification('No active students', 'error'); return; }

    const doc = new jsPDF();
    const pw = 210, ML = 6, MR = pw - 6, CW = MR - ML;
    const sBorder = [226, 232, 240] as const;
    const sText = [30, 41, 59] as const;
    const sTextSec = [100, 116, 139] as const;
    const sTextMuted = [148, 163, 184] as const;
    const sPrimary = [14, 165, 233] as const;
    const sPrimaryDark = [2, 132, 199] as const;
    const money = (val: number) => 'Rs ' + Math.round(val || 0).toLocaleString('en-IN');
    const cX = (pct: number) => ML + 2 + CW * pct / 100;
    const getMonthFromDate = (d: string) => { if (!d) return ''; const dt = new Date(d); return isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); };
    const isSalary = (cat: string) => cat?.toLowerCase().includes('salary');
    let y = 12;

    const drawPageHeader = (title: string) => {
      let logoOffset = 0;
      const logoUrl = schoolSettings?.schoolLogo;
      if (logoUrl) { try { doc.addImage(logoUrl, 'PNG', ML, y, 10, 10); logoOffset = 12; } catch (e) {} }
      const schoolName = (schoolSettings?.schoolName || 'School OS').toUpperCase();
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...sPrimaryDark);
      doc.text(schoolName, ML + logoOffset, y + 4);
      doc.setFontSize(6); doc.setFont('helvetica', 'normal'); doc.setTextColor(...sTextSec);
      doc.text(title, ML + logoOffset, y + 8);
      const addr = [schoolSettings?.address || '', schoolSettings?.phone || '', schoolSettings?.email || ''].filter(Boolean).join(' | ');
      if (addr) doc.text(addr, ML + logoOffset, y + 12);
      doc.setDrawColor(...sPrimary); doc.setLineWidth(0.3); doc.line(ML, y + 14, MR, y + 14);
      y += 17;
    };

    const needPage = (needed: number) => {
      if (y + needed > 275) { doc.addPage(); y = 12; drawPageHeader('Financial Report'); }
    };

    drawPageHeader('Financial Report');

    // ── All paid fees (up to date) ──
    const paidFees = fees.filter(f => f.status === 'paid');
    const allExpenses = expenses.filter(e => e.date);
    const totalIncome = paidFees.reduce((s, f) => s + (f.amount || 0), 0);
    const totalExp = allExpenses.reduce((s, e) => s + (e.amount || 0), 0);

    // ── Section 1: Fees Collected by Student ──
    needPage(12);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...sPrimary);
    doc.text('FEES COLLECTED BY STUDENT', ML + 2, y + 3);
    y += 9;

    const paidStudents = activeStudents.filter(s => paidFees.some(f => f.studentId === s.autoId));
    const allClasses = [...new Set(paidStudents.filter(s => s.class).map(s => s.class))].sort();
    const rowH = 6.5;

    allClasses.forEach((cls) => {
      const clsStudents = paidStudents.filter(s => s.class === cls);
      const clsPaidFees = paidFees.filter(f => clsStudents.some(s => s.autoId === f.studentId));
      const clsTotal = clsPaidFees.reduce((s, f) => s + (f.amount || 0), 0);
      const blockH = 10 + 9 + clsStudents.length * rowH + 7 + 7;

      needPage(blockH);

      // Class header
      doc.setFillColor(248, 250, 252); doc.setDrawColor(...sPrimary); doc.setLineWidth(0.12);
      doc.rect(ML, y, CW, 9, 'FD');
      doc.setFillColor(...sPrimary); doc.rect(ML, y, 2, 9, 'F');
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...sPrimaryDark);
      doc.text('Class ' + cls, ML + 5, y + 6.5);
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...sTextSec);
      doc.text('Paid: ' + clsStudents.length + '/' + activeStudents.filter(s => s.class === cls).length, MR - 1, y + 6.5, { align: 'right' });
      y += 11;

      // Column headers
      doc.setFillColor(240, 249, 255); doc.rect(ML, y, CW, 7, 'F');
      doc.setDrawColor(...sBorder); doc.setLineWidth(0.05);
      doc.rect(ML, y, CW, 7, 'S');
      doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...sPrimary);
      doc.text('Name', ML + 2, y + 5);
      doc.text('ID', cX(28), y + 5);
      doc.text('Package', cX(48), y + 5);
      doc.text('Amount Paid', MR - 2, y + 5, { align: 'right' });
      y += 8;

      // Student rows
      doc.setFontSize(7); doc.setFont('helvetica', 'normal');
      clsStudents.forEach((st, si) => {
        needPage(rowH + 2);
        const stPaid = clsPaidFees.filter(f => f.studentId === st.autoId).reduce((s, f) => s + (f.amount || 0), 0);
        if (si % 2 === 0) { doc.setFillColor(252, 252, 252); doc.rect(ML, y, CW, rowH, 'F'); }
        doc.setTextColor(...sText);
        doc.text(st.name, ML + 2, y + 4.5);
        doc.setTextColor(...sTextSec);
        doc.text(st.autoId, cX(28), y + 4.5);
        doc.text(money(st.feeAmount || 0), cX(48), y + 4.5);
        doc.setFont('helvetica', 'bold'); doc.setTextColor(22, 163, 74);
        doc.text(money(stPaid), MR - 2, y + 4.5, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setDrawColor(...sBorder); doc.setLineWidth(0.03);
        doc.line(ML, y + rowH, MR, y + rowH);
        y += rowH;
      });

      // Class subtotal
      needPage(7);
      doc.setDrawColor(...sPrimary); doc.setLineWidth(0.08);
      doc.line(ML, y, MR, y);
      y += 1;
      doc.setFillColor(248, 250, 252); doc.rect(ML, y, CW, 6, 'F');
      doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...sText);
      doc.text('Collected for Class ' + cls, ML + 2, y + 4);
      doc.setFontSize(9); doc.setTextColor(...sPrimaryDark);
      doc.text(money(clsTotal), MR - 2, y + 4, { align: 'right' });
      y += 8;
    });

    // ── Section 2: All Expenses (new page) ──
    if (allExpenses.length > 0) {
      doc.addPage(); y = 12; drawPageHeader('Financial Report');

      // ── Red theme for expense section ──
      const expRed = [220, 38, 38] as const;
      const expRedLight = [254, 242, 242] as const;
      const expRedBg = [248, 250, 252] as const;

      const expRowH = 6;
      const expBlockH = 10 + 9 + allExpenses.length * expRowH + 7 + 7;
      needPage(expBlockH);

      doc.setFillColor(expRedLight[0], expRedLight[1], expRedLight[2]); doc.setDrawColor(...expRed); doc.setLineWidth(0.12);
      doc.rect(ML, y, CW, 9, 'FD');
      doc.setFillColor(...expRed); doc.rect(ML, y, 2, 9, 'F');
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...expRed);
      doc.text('EXPENSES', ML + 5, y + 6.5);
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...sTextSec);
      doc.text('Total: ' + allExpenses.length, MR - 1, y + 6.5, { align: 'right' });
      y += 11;

      doc.setFillColor(255, 247, 237); doc.rect(ML, y, CW, 7, 'F');
      doc.setDrawColor(...sBorder); doc.setLineWidth(0.05);
      doc.rect(ML, y, CW, 7, 'S');
      doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...expRed);
      doc.text('Date', ML + 2, y + 5);
      doc.text('Category', cX(15), y + 5);
      doc.text('Description', cX(32), y + 5);
      doc.text('Paid To', cX(55), y + 5);
      doc.text('Amount', MR - 2, y + 5, { align: 'right' });
      y += 8;

      doc.setFontSize(7); doc.setFont('helvetica', 'normal');
      allExpenses.forEach((e, ei) => {
        needPage(expRowH + 2);
        if (ei % 2 === 0) { doc.setFillColor(255, 247, 237); doc.rect(ML, y, CW, expRowH, 'F'); }
        doc.setTextColor(...sText);
        doc.text(e.date || '-', ML + 2, y + 4);
        doc.setTextColor(...sTextSec);
        const catLabel = isSalary(e.category) ? (e.category + ' - ' + getMonthFromDate(e.date)) : (e.category || '-');
        doc.text(catLabel, cX(15), y + 4);
        doc.text(e.description || '-', cX(32), y + 4);
        doc.text(e.paidTo || '-', cX(55), y + 4);
        doc.setFont('helvetica', 'bold'); doc.setTextColor(...expRed);
        doc.text(money(e.amount || 0), MR - 2, y + 4, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setDrawColor(...sBorder); doc.setLineWidth(0.03);
        doc.line(ML, y + expRowH, MR, y + expRowH);
        y += expRowH;
      });

      needPage(7);
      doc.setDrawColor(...expRed); doc.setLineWidth(0.08);
      doc.line(ML, y, MR, y);
      y += 1;
      doc.setFillColor(255, 247, 237); doc.rect(ML, y, CW, 6, 'F');
      doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...sText);
      doc.text('Total Expenses', ML + 2, y + 4);
      doc.setFontSize(9); doc.setTextColor(...expRed);
      doc.text(money(totalExp), MR - 2, y + 4, { align: 'right' });
      y += 8;
    }

    // ── Section 3: Income vs Expenses ──
    needPage(45);
    doc.setDrawColor(...sBorder); doc.setLineWidth(0.3);
    doc.line(ML, y, MR, y);
    y += 6;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...sPrimary);
    doc.text('INCOME vs EXPENSES', pw / 2, y + 3, { align: 'center' });
    y += 11;

    const vsData = [
      { label: 'Total Income (Paid Fees)', value: totalIncome, clr: [22, 163, 74] as [number, number, number] },
      { label: 'Total Expenses', value: totalExp, clr: [220, 38, 38] as [number, number, number] },
      { label: 'Net Balance', value: totalIncome - totalExp, clr: (totalIncome - totalExp) >= 0 ? [22, 163, 74] as [number, number, number] : [220, 38, 38] as [number, number, number] },
    ];
    vsData.forEach((d) => {
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...sTextSec);
      doc.text(d.label, ML + 10, y + 4);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...d.clr);
      doc.text(money(d.value), MR - 10, y + 4, { align: 'right' });
      y += 10;
    });

    // ── Section 4: Overall Overview ──
    y += 2;
    needPage(50);
    doc.setDrawColor(...sBorder); doc.setLineWidth(0.3);
    doc.line(ML, y, MR, y);
    y += 6;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...sPrimary);
    doc.text('OVERALL OVERVIEW', pw / 2, y + 3, { align: 'center' });
    y += 11;

    const overview = [
      ['Total Students (Active)', String(activeStudents.length)],
      ['Students Paid', String(paidStudents.length)],
      ['Payment Rate', activeStudents.length > 0 ? (paidStudents.length / activeStudents.length * 100).toFixed(1) + '%' : '0%'],
      ['Total Classes', String(allClasses.length)],
      ['Total Income (Fees)', money(totalIncome)],
      ['Total Expenses', money(totalExp)],
      ['Net Financial Position', money(totalIncome - totalExp)],
    ];
    overview.forEach(([lbl, val], i) => {
      doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...sTextSec);
      doc.text(lbl, ML + 10, y + 4);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...sPrimaryDark);
      doc.text(val, MR - 10, y + 4, { align: 'right' });
      doc.setDrawColor(...sBorder); doc.setLineWidth(0.04);
      doc.line(ML + 5, y + 6, MR - 5, y + 6);
      y += 8;
    });

    // ── Footer ──
    if (y < 275) {
      doc.setDrawColor(...sBorder); doc.setLineWidth(0.08);
      doc.line(ML, 277, MR, 277);
      doc.setFontSize(6); doc.setTextColor(...sTextMuted); doc.setFont('helvetica', 'normal');
      doc.text('Computer-generated report.', pw / 2, 281, { align: 'center' });
    }

    doc.save('Financial_Report.pdf');
    showNotification('Financial report PDF exported successfully', 'success');
  };

  const exportStudentInvoicePDF = (classFilter?: string) => {
    const activeStudents = students.filter(s => s.status === 'ACTIVE' && (!classFilter || s.class === classFilter));
    if (activeStudents.length === 0) { showNotification('No students found', 'error'); return; }

    const doc = new jsPDF('p', 'mm', [148, 210]);
    const pw = 148, ML = 8, MR = pw - ML, CW = MR - ML;
    const accent: [number, number, number] = [14, 165, 233];
    const dark = [30, 41, 59] as const;
    const muted = [100, 116, 139] as const;
    const border = [226, 232, 240] as const;
    const money = (val: number) => 'Rs ' + Math.round(val || 0).toLocaleString('en-IN');

    activeStudents.forEach((student, idx) => {
      if (idx > 0) doc.addPage();
      const studentFees = fees.filter(f => f.studentId === student.autoId);
      const info = getStudentPaymentInfo(student);

      // ── School Header ──
      doc.setFillColor(accent[0], accent[1], accent[2]); doc.rect(0, 0, pw, 28, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text((schoolSettings.schoolName || 'School OS').toUpperCase(), pw / 2, 11, { align: 'center' });
      doc.setFontSize(7); doc.setFont('helvetica', 'normal');
      if (schoolSettings.address) doc.text(schoolSettings.address, pw / 2, 18, { align: 'center' });
      if (schoolSettings.phone) doc.text('Phone: ' + schoolSettings.phone + '  |  Email: ' + (schoolSettings.email || ''), pw / 2, 24, { align: 'center' });

      // ── Invoice Title ──
      let y = 34;
      doc.setTextColor(dark[0], dark[1], dark[2]); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text('INVOICE', ML, y);
      doc.setFontSize(6); doc.setFont('helvetica', 'normal'); doc.setTextColor(...muted);
      doc.text('Invoice #: ' + student.autoId + ' | Date: ' + new Date().toLocaleDateString(), MR, y, { align: 'right' });
      y += 8;

      // ── Student Details ──
      doc.setFillColor(248, 250, 252); doc.rect(ML, y, CW, 16, 'F');
      doc.setDrawColor(...border); doc.setLineWidth(0.3); doc.rect(ML, y, CW, 16, 'S');
      doc.setFontSize(6.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(dark[0], dark[1], dark[2]);
      const half = ML + CW / 2;
      doc.text('Student Name:', ML + 3, y + 4);
      doc.text('Class:', half + 3, y + 4);
      doc.text('Package:', ML + 3, y + 9);
      doc.text('Parent:', half + 3, y + 9);
      doc.text('Auto ID:', ML + 3, y + 14);
      doc.text('Status:', half + 3, y + 14);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...muted);
      doc.text(student.name, ML + 30, y + 4);
      doc.text(student.class || '-', half + 30, y + 4);
      doc.text('Rs ' + (student.feeAmount || 0).toLocaleString(), ML + 30, y + 9);
      doc.text(student.parentName || '-', half + 30, y + 9);
      doc.text(student.autoId, ML + 30, y + 14);
      doc.text(info.paymentStatus, half + 30, y + 14);
      y += 22;

      // ── Fee Table ──
      doc.setFillColor(accent[0], accent[1], accent[2]); doc.rect(ML, y, CW, 6, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(6.5); doc.setFont('helvetica', 'bold');
      doc.text('Type', ML + 2, y + 4.5);
      doc.text('Amount', ML + 50, y + 4.5);
      doc.text('Paid Date', ML + 75, y + 4.5);
      doc.text('Description', ML + 100, y + 4.5);
      doc.text('Status', MR - 2, y + 4.5, { align: 'right' });
      y += 7;

      doc.setFontSize(6); doc.setFont('helvetica', 'normal');
      studentFees.forEach((f, fi) => {
        if (fi % 2 === 0) { doc.setFillColor(252, 252, 252); doc.rect(ML, y, CW, 5.5, 'F'); }
        doc.setTextColor(dark[0], dark[1], dark[2]);
        doc.text(f.type, ML + 2, y + 4);
        doc.text(money(f.amount), ML + 50, y + 4);
        doc.text(f.paidDate || '-', ML + 75, y + 4);
        doc.text(f.description || '-', ML + 100, y + 4);
        const stClr = f.status === 'paid' ? [16, 185, 129] as const : f.status === 'overdue' ? [239, 68, 68] as const : [245, 158, 11] as const;
        doc.setTextColor(stClr[0], stClr[1], stClr[2]); doc.setFont('helvetica', 'bold');
        doc.text(f.status.toUpperCase(), MR - 2, y + 4, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setDrawColor(...border); doc.setLineWidth(0.03); doc.line(ML, y + 5.5, MR, y + 5.5);
        y += 5.5;
      });

      // ── Totals ──
      y += 1;
      doc.setDrawColor(...accent); doc.setLineWidth(0.3); doc.line(ML, y, MR, y);
      y += 2;
      doc.setFontSize(6.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(dark[0], dark[1], dark[2]);
      doc.text('Total Fees Paid:', ML + 2, y + 4);
      doc.text(money(info.totalPaid), MR - 2, y + 4, { align: 'right' });
      y += 5;
      doc.setTextColor(245, 158, 11); doc.text('Balance Due:', ML + 2, y + 4);
      doc.text(money(info.balance), MR - 2, y + 4, { align: 'right' });
      y += 5;
      if (info.totalOverdue > 0) {
        doc.setTextColor(239, 68, 68); doc.text('Overdue:', ML + 2, y + 4);
        doc.text(money(info.totalOverdue), MR - 2, y + 4, { align: 'right' });
        y += 5;
      }

      // ── Footer ──
      doc.setDrawColor(...border); doc.setLineWidth(0.08); doc.line(ML, 196, MR, 196);
      doc.setFontSize(5.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...muted);
      doc.text('Generated by School Management System | ' + new Date().toLocaleString(), pw / 2, 201, { align: 'center' });
    });

    doc.save('Student_Invoices.pdf');
    showNotification('Student invoices exported successfully', 'success');
  };

  const exportFeeTransactionsPDF = () => {
    if (fees.length === 0) { showNotification('No fee records found', 'error'); return; }
    const doc = new jsPDF();
    const pw = 210;
    const c = getPDFColorsFromSettings(schoolSettings);
    const bodySize = schoolSettings.pdfBodySize || 10;
    pdfHeader(doc, 'Fee Transactions', 'All recorded fee transactions', c, pw, schoolSettings.schoolLogo, schoolSettings.schoolName, schoolSettings);
    autoTable(doc, {
      head: [['ID', 'Student', 'Amount', 'Type', 'Description', 'Paid Date', 'Status']],
      body: fees.map(f => [f.autoId, f.studentName, pdfMoney(f.amount), f.type, f.description || '-', f.paidDate || '-', f.status]),
      startY: 36, theme: 'striped',
      headStyles: { fillColor: c.primary, textColor: c.white, fontSize: bodySize, fontStyle: 'bold', cellPadding: 3 },
      bodyStyles: { fontSize: bodySize - 1, textColor: c.dark, cellPadding: 2.5 },
      alternateRowStyles: { fillColor: c.light },
      columnStyles: { 2: { halign: 'right' }, 6: { halign: 'center' } },
      margin: { left: 10, right: 10, bottom: 20 },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 6) {
          data.cell.styles.textColor = pdfStatusColor(String(data.cell.raw));
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });
    pdfFooter(doc, schoolSettings.schoolName, pw, schoolSettings);
    doc.save('Fee_Transactions.pdf');
    showNotification('Fee transactions PDF exported successfully', 'success');
  };

  const exportFeeInvoice = (fee: Fee) => {
    const student = students.find(s => s.autoId === fee.studentId);
    if (!student) { showNotification('Student not found', 'error'); return; }

    const doc = new jsPDF('p', 'mm', [148, 210]);
    const pw = 148, ML = 8, MR = pw - ML, CW = MR - ML;

    // ── Corporate palette ──
    const navy: [number, number, number] = [27, 42, 74];
    const gold: [number, number, number] = [184, 150, 15];
    const dark = [30, 41, 59] as const;
    const muted = [100, 116, 139] as const;
    const lightBg = [248, 249, 250] as const;
    const border = [226, 232, 240] as const;
    const money = (val: number) => 'Rs ' + Math.round(val || 0).toLocaleString('en-IN');

    // ── Top accent bar ──
    doc.setFillColor(navy[0], navy[1], navy[2]); doc.rect(0, 0, pw, 3, 'F');
    doc.setFillColor(gold[0], gold[1], gold[2]); doc.rect(0, 3, pw, 0.5, 'F');

    // ── School / Invoice header ──
    doc.setTextColor(navy[0], navy[1], navy[2]); doc.setFontSize(13); doc.setFont('times', 'bold');
    doc.text((schoolSettings.schoolName || 'School OS').toUpperCase(), ML, 14);
    doc.setFontSize(10); doc.setFont('times', 'normal'); doc.setTextColor(...muted);
    if (schoolSettings.address) doc.text(schoolSettings.address, ML, 20);
    if (schoolSettings.phone) doc.text('Phone: ' + schoolSettings.phone + '  |  ' + (schoolSettings.email || ''), ML, 25);

    doc.setFontSize(11); doc.setFont('times', 'bold'); doc.setTextColor(gold[0], gold[1], gold[2]);
    doc.text('INVOICE', MR, 14, { align: 'right' });
    doc.setDrawColor(gold[0], gold[1], gold[2]); doc.setLineWidth(0.12);
    doc.line(ML, 28, MR, 28);

    // ── Billing details ──
    let y = 34;
    doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.text('BILL TO', ML, y); y += 4;
    doc.setFont('helvetica', 'normal'); doc.setTextColor(dark[0], dark[1], dark[2]);
    doc.setFontSize(8); doc.text(student.name, ML, y); y += 4;
    doc.setFontSize(7); doc.setTextColor(...muted);
    doc.text(student.class || '', ML, y); y += 3.5;
    doc.text('ID: ' + student.autoId, ML, y); y += 3.5;
    doc.text('Parent: ' + (student.parentName || '-'), ML, y);

    doc.setFont('helvetica', 'bold'); doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.setFontSize(7);
    doc.text('INVOICE #', MR - 25, 34); doc.text('DATE', MR - 25, 39); doc.text('STATUS', MR - 25, 44);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...muted);
    doc.text(fee.autoId, MR - 2, 34, { align: 'right' });
    doc.text(fee.paidDate || fee.dueDate || '-', MR - 2, 39, { align: 'right' });
    const stClr = fee.status === 'paid' ? [16, 185, 129] as const : fee.status === 'overdue' ? [239, 68, 68] as const : [245, 158, 11] as const;
    doc.setTextColor(stClr[0], stClr[1], stClr[2]);
    doc.text(fee.status.toUpperCase(), MR - 2, 44, { align: 'right' });

    y = 52;

    // ── Fee details table ──
    doc.setFillColor(navy[0], navy[1], navy[2]); doc.rect(ML, y, CW, 7, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(6.5); doc.setFont('helvetica', 'bold');
    doc.text('TYPE', ML + 2.5, y + 5);
    doc.text('AMOUNT', ML + 55, y + 5);
    doc.text('PAID DATE', ML + 80, y + 5);
    doc.text('DESCRIPTION', MR - 2, y + 5, { align: 'right' });
    y += 8;

    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]); doc.rect(ML, y, CW, 6.5, 'F');
    doc.setTextColor(dark[0], dark[1], dark[2]); doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.text(fee.type, ML + 2.5, y + 4.5);
    doc.setFont('helvetica', 'bold');
    doc.text(money(fee.amount), ML + 55, y + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.text(fee.paidDate || '-', ML + 80, y + 4.5);
    doc.text(fee.description || '-', MR - 2, y + 4.5, { align: 'right' });
    y += 7.5;

    doc.setDrawColor(...border); doc.setLineWidth(0.08); doc.line(ML, y, MR, y);
    y += 3;

    // ── Totals ──
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.text('TOTAL AMOUNT', ML + 2.5, y + 4);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(gold[0], gold[1], gold[2]);
    doc.text(money(fee.amount), MR - 2, y + 4, { align: 'right' });
    y += 10;

    // ── Divider ──
    doc.setDrawColor(gold[0], gold[1], gold[2]); doc.setLineWidth(0.15);
    doc.line(ML, y, MR, y);
    y += 5;

    // ── Payment Terms ──
    doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.text('PAYMENT TERMS', ML, y); y += 4;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...muted);
    doc.text('This invoice is valid for the fee transaction referenced above.', ML, y); y += 3.5;
    doc.text('Any discrepancies must be reported within 7 days of receipt.', ML, y); y += 3.5;
    doc.text('Thank you for your business.', ML, y);
    y += 7;

    // ── Signature Block ──
    doc.setDrawColor(...border); doc.setLineWidth(0.08);
    doc.line(ML, y, ML + 40, y);
    doc.line(MR - 40, y, MR, y);
    y += 2;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...muted);
    doc.text('Authorised Signature', ML, y + 3);
    doc.text('School Seal', MR - 2, y + 3, { align: 'right' });

    // ── Footer accent bar ──
    doc.setFillColor(gold[0], gold[1], gold[2]); doc.rect(0, 206, pw, 0.5, 'F');
    doc.setFillColor(navy[0], navy[1], navy[2]); doc.rect(0, 206.5, pw, 2.5, 'F');
    doc.setFontSize(5.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(255, 255, 255);
    doc.text('Generated by School Management System | ' + new Date().toLocaleString(), pw / 2, 208.5, { align: 'center' });

    doc.save('Invoice_' + fee.autoId + '.pdf');
    showNotification('Invoice exported successfully', 'success');
  };

  const resetEquipmentForm = () => {
    setEquipmentStudentClassFilter('');
    setEquipmentEmployeeRoleFilter('');
    setEquipmentForm({ autoId: generateAutoId('Q'), name: '', category: 'Furniture', assignedToType: 'school', assignedToId: '', assignedToName: 'School', quantity: 1, condition: 'Good', purchaseDate: '', value: 0, status: 'Pending', notes: '' });
  };
  const handleEquipmentAssignedTypeChange = (type: Equipment['assignedToType']) => {
    setEquipmentStudentClassFilter('');
    setEquipmentEmployeeRoleFilter('');
    setEquipmentForm(prev => ({ ...prev, assignedToType: type, assignedToId: '', assignedToName: type === 'school' ? 'School' : '', status: type === 'school' ? 'Available' : 'Pending' }));
  };
  const handleEquipmentAssigneeChange = (id: string) => {
    if (equipmentForm.assignedToType === 'student') {
      const student = students.find(s => s.id === id);
      setEquipmentForm(prev => ({ ...prev, assignedToId: student?.autoId || '', assignedToName: student?.name || '', status: student ? 'Assigned' : 'Pending' }));
      return;
    }
    if (equipmentForm.assignedToType === 'teacher') {
      const employee = employees.find(e => e.id === id);
      setEquipmentForm(prev => ({ ...prev, assignedToId: employee?.autoId || '', assignedToName: employee?.name || '', status: employee ? 'Assigned' : 'Pending' }));
      return;
    }
  };
  const handleSaveEquipment = async () => {
    if (!equipmentForm.name.trim()) { showNotification('Equipment name required', 'error'); return; }
    try {
      const final: Equipment = {
        ...equipmentForm,
        quantity: Number(equipmentForm.quantity || 1),
        value: Number(equipmentForm.value || 0),
        status: ['student', 'teacher'].includes(equipmentForm.assignedToType) && !equipmentForm.assignedToId ? 'Pending' : equipmentForm.status,
      };
      if (modalType === 'edit' && currentRecord?.id) await updateEquipment(currentRecord.id, final);
      else { const seq = await getNextSequentialId('equipments'); final.autoId = 'EQP-' + String(seq).padStart(3, '0'); await addEquipment(final); }
      closeModal(); resetEquipmentForm(); await loadData(); showNotification('Equipment saved successfully', 'success');
    } catch (error) { showFirebaseError(error, 'Failed to save equipment'); }
  };
  const getEquipmentIcon = (type: Equipment['assignedToType']) => { if (type === 'student') return FiUsers; if (type === 'teacher') return FiBriefcase; if (type === 'event') return FiCalendar; if (type === 'school') return FiGrid; return FiSettings; };

  const cleanupDeletedStudentReferences = async (studentAutoId: string) => {
    if (!studentAutoId) return;

    const linkedFees = fees.filter(f => f.studentId === studentAutoId && f.id);
    for (const fee of linkedFees) await deleteFee(fee.id!);

    const linkedEquipments = equipments.filter(eq => eq.assignedToType === 'student' && eq.assignedToId === studentAutoId && eq.id);
    for (const eq of linkedEquipments) {
      await updateEquipment(eq.id!, { ...eq, assignedToId: '', assignedToName: '', status: 'Pending' });
    }

    const linkedAttendance = attendance.filter(a => a.personType === 'student' && a.personId === studentAutoId);
    for (const att of linkedAttendance) {
      if (att.date) await deleteAttendance(studentAutoId, att.date);
    }
  };

  const updateStudentAutoIdReferences = async (oldAutoId: string, newAutoId: string, newName?: string) => {
    if (!oldAutoId || !newAutoId || oldAutoId === newAutoId) return;

    const linkedFees = fees.filter(f => f.studentId === oldAutoId && f.id);
    for (const fee of linkedFees) {
      await updateFee(fee.id!, { ...fee, studentId: newAutoId, studentName: newName || fee.studentName });
    }

    const linkedEquipments = equipments.filter(eq => eq.assignedToType === 'student' && eq.assignedToId === oldAutoId && eq.id);
    for (const eq of linkedEquipments) {
      await updateEquipment(eq.id!, { ...eq, assignedToId: newAutoId, assignedToName: newName || eq.assignedToName });
    }

    const linkedAttendance = attendance.filter(a => a.personType === 'student' && a.personId === oldAutoId);
    for (const att of linkedAttendance) {
      await saveAttendance({ ...att, personId: newAutoId, personName: newName || att.personName });
      if (att.date) await deleteAttendance(oldAutoId, att.date);
    }
  };

  const stabilizeStudentAutoIds = async () => {
    const latestStudents = (await getStudents()) as Student[];
    const sortedStudents = [...latestStudents].sort((a, b) => {
      const aNum = parseInt(String(a.autoId || '').replace(/\D/g, '')) || 0;
      const bNum = parseInt(String(b.autoId || '').replace(/\D/g, '')) || 0;
      if (aNum !== bNum) return aNum - bNum;
      return (a.name || '').localeCompare(b.name || '');
    });

    for (let i = 0; i < sortedStudents.length; i++) {
      const student = sortedStudents[i];
      if (!student.id) continue;
      const oldAutoId = student.autoId;
      const newAutoId = formatStudentAutoId(i + 1);
      if (oldAutoId === newAutoId) continue;

      await updateStudent(student.id, { ...student, autoId: newAutoId });
      await updateStudentAutoIdReferences(oldAutoId, newAutoId, student.name);
    }
  };


  const handleDelete = async (id: string, type: string) => {
    if (!confirm('Delete this record?')) return;
    try {
      if (type === 'student') {
        const deletingStudent = students.find(s => s.id === id);
        if (deletingStudent?.autoId) await cleanupDeletedStudentReferences(deletingStudent.autoId);
        await deleteStudent(id);
        await stabilizeStudentAutoIds();
      }
      if (type === 'fee') await deleteFee(id);
      if (type === 'expense') await deleteExpense(id);
      if (type === 'employee') await deleteEmployee(id);
      if (type === 'equipment') await deleteEquipment(id);
      if (type === 'reminder') await deleteReminder(id);
      await loadData();
      showNotification(type === 'student' ? 'Student deleted and IDs stabilized successfully' : 'Record deleted successfully', 'success');
    } catch (error) {
      showFirebaseError(error, 'Failed to delete record');
    }
  };
  const handleSaveReminder = async () => { if (!reminderForm.title.trim()) return showNotification('Reminder title required', 'error'); try { if (modalType === 'edit' && currentRecord?.id) await updateReminder(currentRecord.id, reminderForm); else await addReminder(reminderForm); closeModal(); setReminderForm({ title: '', description: '', date: '', time: '09:00', type: 'Fee Collection', priority: 'Medium', status: 'Pending' }); loadData(); showNotification('Reminder saved successfully', 'success'); } catch (error) { showFirebaseError(error, 'Failed to save reminder'); } };
  const openAddModal = async () => {
    resetModalSubViews();
    setModalType('add');
    setCurrentRecord(null);
    setBillFile(null);

    if (activeTab === 'students') {
      try {
        const latestStudents = (await getStudents()) as Student[];
        setStudentForm(prev => ({
          ...prev,
          autoId: getNextAvailableStudentAutoId(latestStudents),
          rollNumber: prev.class ? generateRollNumber(prev.class) : 'Auto-generated on save',
        }));
      } catch (error) {
        setStudentForm(prev => ({
          ...prev,
          autoId: getNextAvailableStudentAutoId(),
          rollNumber: prev.class ? generateRollNumber(prev.class) : 'Auto-generated on save',
        }));
      }
    }

    setShowModal(true);
  };

  const openEditModal = (record: any, type: string) => {
    resetModalSubViews();
    setModalType('edit');
    setCurrentRecord(record);
    setBillFile(null);

    if (type === 'student') {
      setStudentForm(record);
      setIsCustomPackage(record.package === 'Custom');
    }

    if (type === 'fee') {
      setFeeForm(record);

      // Fee records store studentId as the student's autoId.
      // The dropdown value uses the student's Firestore document id.
      const linkedStudent = students.find(s => s.autoId === record.studentId);

      setSelectedStudentForFee(linkedStudent?.id || '');
      setFeeClassFilter(linkedStudent?.class || '');
    }

    if (type === 'expense') {
      setExpenseForm(record);
    }

    if (type === 'employee') {
      setEmployeeForm(record);
    }

    if (type === 'reminder') {
      setReminderForm(record);
    }

    setShowModal(true);
  };

  const exportToExcel = (data: any[], filename: string) => { const ws = XLSX.utils.json_to_sheet(data.map(({ id, createdAt, billUrl, ...rest }) => rest)); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Sheet1'); XLSX.writeFile(wb, `${filename}.xlsx`); showNotification('Exported to Excel successfully', 'success'); };
  const exportToPDF = (data: any[], title: string) => {
    const doc = new jsPDF();
    const pw = 210;
    const c = getPDFColorsFromSettings(schoolSettings);
    const bodySize = schoolSettings.pdfBodySize || 10;
    // Professional header
    pdfHeader(doc, title, pdfDate(), c, pw, schoolSettings.schoolLogo, schoolSettings.schoolName, schoolSettings);
    // Detect which status column to color-code
    const keys = Object.keys(data[0] || {}).filter(k => !['id', 'createdAt', 'billUrl', 'billUrl', 'employeeId'].includes(k));
    const columns = keys.map(k => k.charAt(0).toUpperCase() + k.slice(1).replace(/([A-Z])/g, ' $1').trim());
    const rows = data.map(item => keys.map(k => {
      const val = item[k];
      if (typeof val === 'number') return pdfMoney(val);
      return val ?? '';
    }));
    const statusColIndex = keys.findIndex(k => k.toLowerCase() === 'status');
    autoTable(doc, {
      head: [columns], body: rows, startY: 36, theme: 'striped',
      headStyles: { fillColor: c.primary, textColor: c.white, fontSize: bodySize, fontStyle: 'bold', cellPadding: 3.5 },
      bodyStyles: { fontSize: bodySize - 1, textColor: c.dark, cellPadding: 3 },
      alternateRowStyles: { fillColor: c.light },
      styles: { lineColor: c.border, lineWidth: 0.1 },
      margin: { left: 10, right: 10, bottom: 20 },
      didParseCell: (data) => {
        if (data.section === 'body' && statusColIndex >= 0 && data.column.index === statusColIndex) {
          data.cell.styles.textColor = pdfStatusColor(String(data.cell.raw));
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });
    pdfFooter(doc, schoolSettings.schoolName, pw, schoolSettings);
    doc.save(`${title}.pdf`);
    showNotification('Exported to PDF successfully', 'success');
  };

  const getStudentDocumentStatus = (student: Student) => {
    const submitted = student.submittedDocuments || [];
    const total = documentOptions.length;
    const details = documentOptions.map((doc: string) => ({
      name: doc,
      submitted: submitted.includes(doc),
      status: submitted.includes(doc) ? 'Submitted' : 'Missing',
    }));
    const submittedCount = details.filter(doc => doc.submitted).length;
    const missing = details.filter(doc => !doc.submitted).map(doc => doc.name);
    const lineBreak = String.fromCharCode(10);

    return {
      submittedCount,
      missingCount: missing.length,
      total,
      submitted,
      missing,
      details,
      summary: total > 0 ? `${submittedCount}/${total} submitted` : 'No checklist',
      detailText: total > 0 ? details.map(doc => `${doc.name}: ${doc.status}`).join(lineBreak) : 'No checklist',
      detailInline: total > 0 ? details.map(doc => `${doc.name}: ${doc.status}`).join(' | ') : 'No checklist',
      missingSummary: missing.length > 0 ? missing.join(', ') : 'None',
    };
  };



  const drawBarcode = (doc: any, value: string, x: number, y: number, width: number, height: number) => {
    const patterns = [
      '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213','221312','231212','112232','122132','122231','113222','123122','123221','223211','221132','221231','213212','223112','312131','311222','321122','321221','312212','322112','322211','212123','212321','232121','111323','131123','131321','112313','132113','132311','211313','231113','231311','112133','112331','132131','113123','113321','133121','313121','211331','231131','213113','213311','213131','311123','311321','331121','312113','312311','332111','314111','221411','431111','111224','111422','121124','121421','141122','141221','112214','112412','122114','122411','142112','142211','241211','221114','413111','241112','134111','111242','121142','121241','114212','124112','124211','411212','421112','421211','212141','214121','412121','111143','111341','131141','114113','114311','411113','411311','113141','114131','311141','411131','211412','211214','211232','2331112'
    ];
    const clean = (value || 'STUDENT-ID').replace(/[^\x20-\x7E]/g, '').slice(0, 32) || 'STUDENT-ID';
    const codes: number[] = [104];
    for (const ch of clean) codes.push(ch.charCodeAt(0) - 32);
    let checksum = 104;
    for (let i = 1; i < codes.length; i++) checksum += codes[i] * i;
    codes.push(checksum % 103, 106);
    const moduleCount = codes.reduce((sum, code) => sum + patterns[code].split('').reduce((a, b) => a + Number(b), 0), 0);
    const moduleW = width / moduleCount;
    let cursor = x;
    doc.setFillColor(0, 0, 0);
    codes.forEach(code => {
      const pattern = patterns[code];
      for (let i = 0; i < pattern.length; i++) {
        const w = Number(pattern[i]) * moduleW;
        if (i % 2 === 0) doc.rect(cursor, y, w, height, 'F');
        cursor += w;
      }
    });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(80, 0, 0);
    doc.text(`ID No. : ${clean}`, x + width / 2, y + height + 4.2, { align: 'center' });
  };

  const exportStudentIDCard = (student: Student) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [70, 110] });
    const cardW = 70;
    const cardH = 110;
    const navy: [number, number, number] = [2, 35, 85];
    const yellow: [number, number, number] = [247, 181, 0];
    const maroon: [number, number, number] = [112, 0, 8];
    const schoolName = (schoolSettings.schoolName || 'SCHOOL NAME').toUpperCase();
    const tagline = schoolSettings.pdfSubtitle || 'The Way Of Bright Future ....';
    const schoolAddress = schoolSettings.address || 'School Address';
    const schoolPhone = schoolSettings.phone || '+91 1234567890';
    const schoolEmail = schoolSettings.email || 'info@school.com';
    const division = student.class?.replace(/[0-9\s.]/g, '') || '-';

    const drawCardShell = () => {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(0, 0, cardW, cardH, 5, 5, 'F');
      doc.setFillColor(...navy);
      doc.rect(0, 0, cardW, 14, 'F');
      doc.setFillColor(...yellow);
      doc.triangle(0, 0, 25, 0, 0, 25, 'F');
      doc.setFillColor(...navy);
      doc.triangle(0, 4, 18, 0, 0, 20, 'F');
      doc.setFillColor(...navy);
      doc.rect(0, cardH - 12, cardW, 12, 'F');
      doc.setFillColor(...yellow);
      doc.triangle(cardW, cardH - 23, cardW, cardH, 42, cardH, 'F');
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.3);
      doc.roundedRect(1, 1, cardW - 2, cardH - 2, 5, 5);
    };
    const drawLogo = (x: number, y: number, r: number) => {
      doc.setFillColor(255, 255, 255);
      doc.circle(x, y, r, 'F');
      if (schoolSettings.schoolLogo) {
        try { doc.addImage(schoolSettings.schoolLogo, 'PNG', x - r + 2, y - r + 2, r * 2 - 4, r * 2 - 4); } catch (e) {}
      } else {
        doc.setDrawColor(...navy); doc.setLineWidth(0.4); doc.circle(x, y, r - 2);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(5); doc.setTextColor(...navy); doc.text('LOGO', x, y + 1, { align: 'center' });
      }
    };
    const drawSchoolHeader = (compact = false) => {
      drawLogo(compact ? 35 : 12, compact ? 11 : 13, compact ? 9 : 8);
      doc.setTextColor(...navy); doc.setFont('helvetica', 'bold'); doc.setFontSize(compact ? 8.2 : 6.6);
      doc.text(schoolName, compact ? 35 : 22, compact ? 30 : 8, { align: compact ? 'center' : 'left', maxWidth: compact ? 60 : 43 });
      doc.setTextColor(...maroon); doc.setFont('helvetica', 'bolditalic'); doc.setFontSize(compact ? 5.2 : 4.6);
      doc.text(tagline, compact ? 35 : 22, compact ? 38 : 19, { align: compact ? 'center' : 'left', maxWidth: compact ? 54 : 40 });
    };

    drawCardShell();
    drawSchoolHeader(false);
    doc.setFillColor(255, 255, 255); doc.roundedRect(7, 32, 28, 42, 3, 3, 'F');
    doc.setDrawColor(230, 230, 230); doc.setLineWidth(1); doc.roundedRect(7, 32, 28, 42, 3, 3);
    doc.setFillColor(24, 105, 165); doc.rect(9, 34, 24, 38, 'F');
    doc.setFillColor(245, 190, 155); doc.circle(21, 47, 6, 'F');
    doc.setFillColor(35, 35, 35); doc.ellipse(21, 42, 8, 5, 'F');
    doc.setFillColor(46, 86, 140); doc.roundedRect(14, 54, 14, 15, 4, 4, 'F');

    const labelX = 37.5, colonX = 51.5, valueX = 55;
    let y = 38.5;
    const detail = (label: string, value: string, maxWidth = 13.5) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.1);
      doc.setTextColor(...navy);
      doc.text(label, labelX, y);
      doc.text(':', colonX, y);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text(doc.splitTextToSize(value || '-', maxWidth), valueX, y);
      y += 5.55;
    };

    // Front-side student + parent information, aligned in one clean column.
    detail('Name', student.name || '-', 14);
    detail('Class', student.class || '-');
    detail('Division', division);
    detail('Roll No.', student.rollNumber || '-');
    detail('DOB', student.dateOfBirth || '-');
    detail('Blood Grp', (student as any).bloodGroup || '-');
    detail('Parent', student.parentName || '-', 14);
    detail('Mobile', student.parentPhone || '-');

    // Barcode area kept above the feature strip so nothing overlaps.
    drawBarcode(doc, student.autoId || student.rollNumber || student.name, 7, 75.5, 28, 6.2);

    // Clean feature strip: equal columns, aligned vector icons and labels.
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(4, 88.8, 62, 10.8, 2, 2, 'F');
    doc.setDrawColor(190, 190, 190);
    doc.setLineWidth(0.25);
    doc.line(5, 88.8, 65, 88.8);

    const drawFeatureIcon = (kind: string, cx: number, cy: number) => {
      doc.setDrawColor(255, 255, 255);
      doc.setFillColor(255, 255, 255);
      doc.setLineWidth(0.35);
      if (kind === 'quality') {
        // two people + book
        doc.circle(cx - 0.8, cy - 0.6, 0.55, 'F');
        doc.circle(cx + 0.8, cy - 0.6, 0.55, 'F');
        doc.roundedRect(cx - 1.8, cy + 0.2, 1.3, 1.0, 0.3, 0.3, 'F');
        doc.roundedRect(cx + 0.5, cy + 0.2, 1.3, 1.0, 0.3, 0.3, 'F');
        doc.line(cx - 1.2, cy + 1.7, cx, cy + 1.1);
        doc.line(cx + 1.2, cy + 1.7, cx, cy + 1.1);
      } else if (kind === 'teacher') {
        // graduation cap
        doc.triangle(cx - 2, cy - 0.4, cx, cy - 1.5, cx + 2, cy - 0.4, 'F');
        doc.rect(cx - 1.2, cy - 0.2, 2.4, 0.9, 'F');
        doc.line(cx + 1.8, cy - 0.35, cx + 1.8, cy + 1.4);
        doc.circle(cx + 1.8, cy + 1.6, 0.25, 'F');
      } else if (kind === 'safe') {
        // open book
        doc.line(cx, cy - 1.6, cx, cy + 1.6);
        doc.line(cx, cy - 1.3, cx - 1.8, cy - 0.8);
        doc.line(cx - 1.8, cy - 0.8, cx - 1.8, cy + 1.2);
        doc.line(cx - 1.8, cy + 1.2, cx, cy + 1.6);
        doc.line(cx, cy - 1.3, cx + 1.8, cy - 0.8);
        doc.line(cx + 1.8, cy - 0.8, cx + 1.8, cy + 1.2);
        doc.line(cx + 1.8, cy + 1.2, cx, cy + 1.6);
      } else {
        // growth chart arrow
        doc.rect(cx - 1.8, cy + 0.8, 0.6, 0.8, 'F');
        doc.rect(cx - 0.5, cy + 0.2, 0.6, 1.4, 'F');
        doc.rect(cx + 0.8, cy - 0.5, 0.6, 2.1, 'F');
        doc.line(cx - 1.8, cy - 0.6, cx + 1.6, cy - 1.6);
        doc.triangle(cx + 1.6, cy - 1.6, cx + 1.15, cy - 1.1, cx + 0.95, cy - 1.85, 'F');
      }
    };

    const features = [
      ['quality', 'Quality\nEducation', [220, 0, 80]],
      ['teacher', 'Qualified\nTeachers', [0, 135, 60]],
      ['safe', 'Safe\nEnvironment', [245, 120, 0]],
      ['growth', 'Overall\nDevelopment', [110, 45, 170]],
    ] as any[];

    features.forEach(([kind, text, color], i) => {
      const colX = 5 + i * 15.2;
      if (i > 0) {
        doc.setDrawColor(210, 210, 210);
        doc.line(colX - 1.2, 90.2, colX - 1.2, 98.2);
      }
      doc.setFillColor(color[0], color[1], color[2]);
      doc.circle(colX + 2.6, 94.2, 3.0, 'F');
      drawFeatureIcon(kind, colX + 2.6, 94.2);
      doc.setTextColor(...navy);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(3.0);
      doc.text(String(text).split('\n'), colX + 6.4, 92.45, { maxWidth: 8.8 });
    });

    doc.addPage([70, 110], 'portrait');
    drawCardShell();
    drawSchoolHeader(true);
    doc.setFillColor(...navy); doc.roundedRect(7, 43, 56, 7, 2, 2, 'F'); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.text('SCHOOL INFORMATION',35,48,{align:'center'});
    doc.setDrawColor(...navy); doc.roundedRect(7,43,56,47,2,2);
    const infoRow = (icon: string, label: string, value: string, yy: number, maxW = 31) => { doc.setFillColor(...navy); doc.circle(13, yy - 1.5, 3.2, 'F'); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(4); doc.text(icon,13,yy,{align:'center'}); doc.setTextColor(...navy); doc.setFontSize(5.4); doc.text(label,19,yy); doc.text(':',34,yy); doc.setTextColor(0,0,0); doc.text(doc.splitTextToSize(value || '-', maxW),38,yy); };
    infoRow('P','ADDRESS',schoolAddress,58); infoRow('T','MOBILE',schoolPhone,70); infoRow('E','EMAIL ID',schoolEmail,80);
    doc.setFillColor(...navy); doc.roundedRect(23,86,24,6,2,2,'F'); doc.setTextColor(255,255,255); doc.setFontSize(6); doc.text('PARENTS INFORMATION',35,90,{align:'center'});
    doc.setTextColor(...navy); doc.setFont('helvetica','bold'); doc.setFontSize(5); doc.text('FATHER NAME',10,97); doc.text(':',33,97); doc.setTextColor(0,0,0); doc.text(student.parentName || '-',37,97,{maxWidth:28});
    doc.setTextColor(...navy); doc.text('MOBILE',10,103); doc.text(':',33,103); doc.setTextColor(0,0,0); doc.text(student.parentPhone || '-',37,103,{maxWidth:28});
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(5.8); doc.text('KEEP THIS CARD SAFE',35,107,{align:'center'});

    doc.save(`Student_ID_${student.autoId || student.name}.pdf`);
    showNotification('Student ID card PDF generated', 'success');
  };

  // ===== Professional Student PDF Report (A4 Portrait) =====
  const exportStudentPDF = (studentList: Student[]) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw = 210;
    const c = getPDFColorsFromSettings(schoolSettings);
    const bodySize = schoolSettings.pdfBodySize || 10;

    pdfHeader(
      doc,
      'Student Register',
      schoolSettings.pdfStudentSubtitle || 'All registered students with details',
      c,
      pw,
      schoolSettings.schoolLogo,
      schoolSettings.schoolName,
      schoolSettings
    );

    const activeCount = studentList.filter(s => s.status === 'ACTIVE').length;
    const totalFees = studentList.reduce((sum, s) => sum + (s.feeAmount || 0), 0);
    const cardY = 34;
    const cardH = 16;
    const gap = 4;
    const startX = 10;
    const cardW = (pw - 20 - 3 * gap) / 4; // Dynamically calculated width: (210 - 20 - 12)/4 = 44.5mm

    const cards: { label: string; value: string; color: [number, number, number] }[] = [
      { label: 'TOTAL', value: String(studentList.length), color: c.primary },
      { label: 'ACTIVE', value: String(activeCount), color: [16, 185, 129] },
      { label: 'INACTIVE', value: String(studentList.length - activeCount), color: [239, 68, 68] },
      { label: 'FEE TARGET', value: pdfMoney(totalFees), color: [245, 158, 11] },
    ];

    cards.forEach((card, i) => {
      const x = startX + i * (cardW + gap);
      doc.setFillColor(...c.light);
      doc.roundedRect(x, cardY, cardW, cardH, 2, 2, 'F');
      doc.setFillColor(...card.color);
      doc.roundedRect(x, cardY, cardW, 1.4, 0.8, 0.8, 'F');
      doc.setTextColor(...c.muted);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text(card.label, x + 3.5, cardY + 5.5);
      doc.setTextColor(...c.dark);
      doc.setFontSize(10.5);
      doc.text(card.value, x + 3.5, cardY + 12);
    });

    const tableData = studentList.map((s, i) => {
      const docStatus = getStudentDocumentStatus(s);
      return [
        String(i + 1),
        s.autoId,
        s.name,
        s.rollNumber,
        s.class,
        s.parentName,
        s.parentPhone,
        pdfMoney(s.feeAmount || 0),
        docStatus.summary,
        s.status,
      ];
    });

    autoTable(doc, {
      head: [['#', 'ID', 'Student Name', 'Roll', 'Class', 'Parent', 'Contact', 'Fee', 'Docs', 'Status']],
      body: tableData,
      startY: 56,
      theme: 'striped',
      headStyles: { fillColor: c.primary, textColor: c.white, fontSize: bodySize - 0.5, fontStyle: 'bold', cellPadding: 2.8, halign: 'center' },
      bodyStyles: { fontSize: bodySize - 1.5, textColor: c.dark, cellPadding: 2.2, overflow: 'linebreak' },
      alternateRowStyles: { fillColor: c.light },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center', textColor: c.muted, fontStyle: 'bold' },
        1: { cellWidth: 20, textColor: c.primary, fontStyle: 'bold' },
        3: { cellWidth: 12, halign: 'center' },
        4: { cellWidth: 14, halign: 'center' },
        6: { cellWidth: 24 },
        7: { cellWidth: 20, halign: 'right' },
        9: { cellWidth: 16, halign: 'center' },
      },
      margin: { left: 10, right: 10, bottom: 16 },
      didParseCell: data => {
        if (data.section === 'body' && data.column.index === 9) {
          data.cell.styles.textColor = pdfStatusColor(String(data.cell.raw));
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });

    if (studentList.length > 0 && documentOptions.length > 0) {
      doc.addPage();
      pdfHeader(doc, 'Student Document Checklist', schoolSettings.pdfStudentSubtitle || 'Submitted and missing documents by student', c, pw, schoolSettings.schoolLogo, schoolSettings.schoolName, schoolSettings);
      
      const checklistHead = [['Student ID', 'Student Name', 'Class', ...documentOptions]];
      const checklistBody = studentList.map(s => {
        const row = [s.autoId, s.name, s.class || '—'];
        documentOptions.forEach(docOpt => {
          const isSubmitted = (s.submittedDocuments || []).includes(docOpt);
          row.push(isSubmitted ? 'Submitted' : 'Missing');
        });
        return row;
      });

      const docCount = documentOptions.length;
      const hFontSize = docCount > 8 ? bodySize - 2.5 : (docCount > 6 ? bodySize - 2 : bodySize - 1.5);
      const hPadding = docCount > 8 ? 2 : 2.5;
      const docColWidth = Math.max(10, (190 - 72) / docCount);
      const colStyles: any = {
        0: { cellWidth: 20, textColor: c.primary, fontStyle: 'bold' },
        1: { cellWidth: 38, fontStyle: 'bold' },
        2: { cellWidth: 14, halign: 'center' },
      };
      documentOptions.forEach((_, idx) => {
        colStyles[3 + idx] = { cellWidth: docColWidth, halign: 'center' };
      });

      autoTable(doc, {
        head: checklistHead,
        body: checklistBody,
        startY: 36,
        theme: 'striped',
        headStyles: { fillColor: c.primary, textColor: c.white, fontSize: hFontSize, fontStyle: 'bold', cellPadding: hPadding, halign: 'center', valign: 'middle' },
        bodyStyles: { fontSize: bodySize - 1.5, textColor: c.dark, cellPadding: 2, overflow: 'linebreak', valign: 'middle' },
        alternateRowStyles: { fillColor: c.light },
        columnStyles: colStyles,
        margin: { left: 10, right: 10, bottom: 16 },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index >= 3) {
            data.cell.text = [''];
          }
        },
        didDrawCell: (data) => {
          if (data.section === 'body' && data.column.index >= 3) {
            const isSubmitted = data.cell.raw === 'Submitted';
            const xc = data.cell.x + data.cell.width / 2;
            const yc = data.cell.y + data.cell.height / 2;
            doc.setLineWidth(0.4);
            if (isSubmitted) {
              doc.setDrawColor(16, 185, 129);
              doc.line(xc - 1.8, yc + 0.4, xc - 0.4, yc + 1.8);
              doc.line(xc - 0.4, yc + 1.8, xc + 1.8, yc - 1.2);
            } else {
              doc.setDrawColor(239, 68, 68);
              doc.line(xc - 1.4, yc - 1.4, xc + 1.4, yc + 1.4);
              doc.line(xc + 1.4, yc - 1.4, xc - 1.4, yc + 1.4);
            }
          }
        },
      });
    }

    pdfFooter(doc, schoolSettings.schoolName, pw, schoolSettings);
    doc.save(`Student_Register_${new Date().toISOString().split('T')[0]}.pdf`);
    showNotification('Student PDF exported successfully', 'success');
  };

  // ===== Safe helpers for import (prevent NaN/undefined Firestore errors) =====
  const safeStr = (row: any, ...keys: string[]): string => {
    for (const k of keys) {
      let val = row[k];
      if (val === undefined) {
        const foundKey = Object.keys(row).find(rk => rk.toLowerCase().trim() === k.toLowerCase().trim());
        if (foundKey) val = row[foundKey];
      }
      if (val !== undefined && val !== null && String(val).trim() !== '') return String(val).trim();
    }
    return '';
  };

  // ===== Safe helpers for import (prevent NaN/undefined Firestore errors) =====
  const safeNum = (row: any, ...keys: string[]): number => {
    for (const k of keys) {
      let val = row[k];
      if (val === undefined) {
        const foundKey = Object.keys(row).find(rk => rk.toLowerCase().trim() === k.toLowerCase().trim());
        if (foundKey) val = row[foundKey];
      }
      if (val !== undefined && val !== null && val !== '') {
        const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.\-]/g, ''));
        if (!isNaN(n) && isFinite(n)) return n;
      }
    }
    return 0;
  };
  // Remove undefined / null / NaN so Firestore never rejects the document
  const cleanRecord = (obj: any): any => {
    const out: any = {};
    for (const k in obj) {
      const v = obj[k];
      if (v === undefined || v === null) continue;
      if (typeof v === 'number' && (isNaN(v) || !isFinite(v))) continue;
      if (typeof v === 'string' && v.trim() === '' && ['name', 'studentName', 'title'].includes(k)) continue;
      out[k] = v;
    }
    return out;
  };

  const importFromExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // allow re-selecting same file

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        // Remove fully-empty rows
        const rows = json.filter(r => Object.values(r).some(v => String(v).trim() !== ''));
        if (rows.length === 0) { showNotification('No data found in file', 'error'); return; }

        const collectionName = activeTab === 'fees' ? 'fees' : activeTab === 'expenses' ? 'expenses' : activeTab === 'employees' ? 'employees' : activeTab === 'equipments' ? 'equipments' : 'students';

        setImportProgress({ active: true, current: 0, total: rows.length, status: 'Reading file...', success: 0, failed: 0 });

        let success = 0, failed = 0;
        const errors: string[] = [];
        const baseSeq = await getNextSequentialId(collectionName);

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const displayName = safeStr(row, 'Name', 'Student Name', 'Employee Name', 'Paid To', 'Title') || `Row ${i + 1}`;
          setImportProgress(prev => ({ ...prev, current: i + 1, status: `Adding: ${displayName}` }));

          try {
            let record: any = {};
            const seq = baseSeq + i;

            if (collectionName === 'students') {
              // ===== Smart Package + Amount Resolution =====
              const pkgRaw = safeStr(row, 'Package', 'Package Name');
              const feeAmountRaw = safeNum(row, 'Fee Amount', 'Fee', 'Amount', 'Fee Amount (Rs)');
              let resolvedPackage = '';
              let resolvedAmount = 0;

              // Step 1: Try to match Package column to a predefined package by NAME
              if (pkgRaw) {
                const matchedPkg = packages.find(p => p.name.toLowerCase() === pkgRaw.toLowerCase());
                if (matchedPkg) {
                  // Package name matched (e.g., "Basic") → use its amount
                  resolvedPackage = matchedPkg.name;
                  resolvedAmount = matchedPkg.amount;
                } else {
                  // Package is NOT a name → check if it's a NUMBER (e.g., "16000")
                  const pkgAsNum = parseFloat(pkgRaw.replace(/[^0-9.]/g, ''));
                  if (!isNaN(pkgAsNum) && pkgAsNum > 0) {
                    // It's a number in the Package column → use as amount, find matching package or Custom
                    const matchByAmount = packages.find(p => p.amount === pkgAsNum);
                    resolvedPackage = matchByAmount ? matchByAmount.name : 'Custom';
                    resolvedAmount = pkgAsNum;
                  } else {
                    // It's a custom name we don't recognize → keep it as package name
                    resolvedPackage = pkgRaw;
                    resolvedAmount = 0;
                  }
                }
              }

              // Step 2: If Fee Amount column has a value, it OVERRIDES (unless same as package)
              if (feeAmountRaw > 0) {
                resolvedAmount = feeAmountRaw;
                // If no package detected or package amount doesn't match, mark as Custom
                if (!resolvedPackage || (packages.find(p => p.name === resolvedPackage)?.amount !== feeAmountRaw)) {
                  if (!packages.find(p => p.amount === feeAmountRaw)) {
                    resolvedPackage = 'Custom';
                  }
                }
              }

              // Step 3: Fallbacks if still empty
              if (!resolvedPackage) resolvedPackage = 'Basic';
              if (resolvedAmount === 0) {
                // Try to get amount from matched package
                const fallbackPkg = packages.find(p => p.name === resolvedPackage);
                resolvedAmount = fallbackPkg?.amount || 0;
              }

              const importedAutoId = safeStr(row, 'Auto ID') || ('STU-' + String(seq).padStart(3, '0'));
              const importedRoll = safeStr(row, 'Roll Number', 'Roll No', 'Roll');
              // Roll number resets per class; auto-generated if not provided in Excel
              const studentClass = safeStr(row, 'Class').toUpperCase();
              let syncedRoll = importedRoll;
              if (!syncedRoll && studentClass) {
                // Count existing students in this class (including ones already imported this batch)
                const classCount = students.filter(s => s.class === studentClass).length + (collectionName === 'students' ? success : 0);
                syncedRoll = String(classCount + 1).padStart(3, '0');
              } else if (!syncedRoll) {
                syncedRoll = String(seq).padStart(3, '0');
              }

              record = cleanRecord({
                autoId: importedAutoId,
                name: safeStr(row, 'Name', 'Student Name').toUpperCase(),
                rollNumber: syncedRoll,
                class: safeStr(row, 'Class').toUpperCase(),
                parentName: safeStr(row, 'Parent Name', 'Parent/Guardian').toUpperCase(),
                parentPhone: safeStr(row, 'Parent Phone', 'Phone', 'Contact'),
                email: safeStr(row, 'Email'),
                address: safeStr(row, 'Address'),
                dateOfBirth: safeStr(row, 'Date of Birth', 'DOB'),
                gender: safeStr(row, 'Gender').toUpperCase() || 'MALE',
                admissionDate: safeStr(row, 'Admission Date'),
                status: safeStr(row, 'Status').toUpperCase() || 'ACTIVE',
                package: resolvedPackage,
                feeAmount: resolvedAmount,
              });
              if (!record.name) { failed++; errors.push(`Row ${i + 1}: Missing name`); setImportProgress(p => ({ ...p, failed })); continue; }
              await addStudent(record);
            } else if (collectionName === 'fees') {
              record = cleanRecord({
                autoId: safeStr(row, 'Auto ID') || ('FEE-' + String(seq).padStart(3, '0')),
                studentId: safeStr(row, 'Student Auto ID', 'Student ID', 'Auto ID'),
                studentName: safeStr(row, 'Student Name', 'Name'),
                amount: safeNum(row, 'Amount', 'Amount (Rs)', 'Fee Amount'),
                type: safeStr(row, 'Fee Type', 'Type') || 'Tuition Fee',
                dueDate: safeStr(row, 'Due Date'),
                paidDate: safeStr(row, 'Paid Date'),
                status: safeStr(row, 'Status').toLowerCase() || 'pending',
                description: safeStr(row, 'Description'),
              });
              if (!record.studentId && !record.studentName) { failed++; errors.push(`Row ${i + 1}: Missing student`); setImportProgress(p => ({ ...p, failed })); continue; }
              await addFee(record);
            } else if (collectionName === 'expenses') {
              record = cleanRecord({
                autoId: safeStr(row, 'Auto ID') || ('EXP-' + String(seq).padStart(3, '0')),
                category: safeStr(row, 'Category') || 'Other',
                amount: safeNum(row, 'Amount', 'Amount (Rs)'),
                description: safeStr(row, 'Description'),
                date: safeStr(row, 'Date'),
                paidTo: safeStr(row, 'Paid To'),
                status: safeStr(row, 'Status').toLowerCase() || 'pending',
              });
              await addExpense(record);
            } else if (collectionName === 'employees') {
              record = cleanRecord({
                autoId: safeStr(row, 'Auto ID') || ('EMP-' + String(seq).padStart(3, '0')),
                name: safeStr(row, 'Name', 'Employee Name').toUpperCase(),
                role: safeStr(row, 'Role', 'Designation', 'Position').toUpperCase() || 'TEACHER',
                phone: safeStr(row, 'Phone', 'Contact'),
                email: safeStr(row, 'Email'),
                address: safeStr(row, 'Address'),
                salary: safeNum(row, 'Salary', 'Monthly Salary'),
                joinDate: safeStr(row, 'Join Date', 'Date of Joining'),
                status: safeStr(row, 'Status').toUpperCase() || 'ACTIVE',
                department: safeStr(row, 'Department', 'Dept').toUpperCase(),
                bankAccount: safeStr(row, 'Bank Account', 'Bank A/C'),
                panTaxId: safeStr(row, 'PAN', 'PAN/Tax ID', 'Tax ID').toUpperCase(),
              });
              if (!record.name) { failed++; errors.push(`Row ${i + 1}: Missing name`); setImportProgress(p => ({ ...p, failed })); continue; }
              await addEmployee(record);
            } else if (collectionName === 'equipments') {
              record = cleanRecord({
                autoId: safeStr(row, 'Auto ID') || ('EQP-' + String(seq).padStart(3, '0')),
                name: safeStr(row, 'Name', 'Equipment Name', 'Item Name'),
                category: safeStr(row, 'Category') || 'Other',
                assignedToType: (safeStr(row, 'Assigned Type', 'Assigned To Type', 'Type').toLowerCase() || 'other') as Equipment['assignedToType'],
                assignedToId: safeStr(row, 'Assigned ID', 'Assigned To ID'),
                assignedToName: safeStr(row, 'Assigned To', 'Assigned Name', 'Location') || '—',
                quantity: safeNum(row, 'Quantity', 'Qty') || 1,
                condition: safeStr(row, 'Condition') || 'Good',
                purchaseDate: safeStr(row, 'Purchase Date', 'Date'),
                value: safeNum(row, 'Value', 'Amount', 'Price'),
                status: safeStr(row, 'Status') || 'Pending',
                notes: safeStr(row, 'Notes', 'Description'),
              });
              if (!record.name) { failed++; errors.push(`Row ${i + 1}: Missing equipment name`); setImportProgress(p => ({ ...p, failed })); continue; }
              await addEquipment(record);
            }
            success++;
            setImportProgress(prev => ({ ...prev, success }));
          } catch (rowError: any) {
            failed++;
            errors.push(`Row ${i + 1}: ${getFirebaseErrorMessage(rowError, 'Import row failed')}`);
            setImportProgress(prev => ({ ...prev, failed }));
          }
          await new Promise(resolve => setTimeout(resolve, 30));
        }

        setImportProgress(prev => ({ ...prev, status: 'Complete!', active: false }));
        await loadData();
        if (failed === 0) {
          showNotification(`Successfully imported ${success} records`, 'success');
        } else {
          showNotification(`Imported ${success}/${rows.length}. ${failed} failed.`, 'error');
          console.log('Import errors:', errors);
        }
        setTimeout(() => setImportProgress({ active: false, current: 0, total: 0, status: '', success: 0, failed: 0 }), 2500);
      } catch (error: any) {
        showFirebaseError(error, 'Failed to read file');
        setImportProgress({ active: false, current: 0, total: 0, status: '', success: 0, failed: 0 });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  type ExpenseCategory = { name: string; value: number };

  const formatCurrencyTooltip = (value: any): [string, string] => [`₹${Number(value || 0).toLocaleString()}`, 'Amount'];
  const formatCurrencyTooltipPair = (value: any): [string, string] => [`₹${Number(value || 0).toLocaleString()}`, 'Amount'];
  const formatCurrencyTick = (value: any): string => `₹${(Number(value || 0) / 1000).toFixed(0)}k`;

  const cyFees = getCurrentYearData(fees) as Fee[];
  const cyExpenses = getCurrentYearData(expenses) as Expense[];
  const stats = {
    totalStudents: students.length, activeStudents: students.filter(s => s.status === 'ACTIVE').length,
    // Match Fees & Billing collected amount exactly.
    collectedFees: fees.filter((f: Fee) => getEffectiveFeeStatus(f) === 'paid').reduce((s: number, f: Fee) => s + f.amount, 0),
    totalExpenses: cyExpenses.reduce((s: number, e: Expense) => s + e.amount, 0),
    totalEmployees: employees.length, activeEmployees: employees.filter(e => e.status === 'ACTIVE').length,
    netRevenue: fees.filter((f: Fee) => getEffectiveFeeStatus(f) === 'paid').reduce((s: number, f: Fee) => s + f.amount, 0) - expenses.filter((e: Expense) => e.status === 'paid').reduce((s: number, e: Expense) => s + e.amount, 0)
  };
  const monthsArr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; const cy = new Date().getFullYear();
  const chartData = monthsArr.map((m: string, i: number) => ({ month: m, fees: cyFees.filter((f: Fee) => { const d = new Date(f.paidDate || f.dueDate); return d.getFullYear() === cy && d.getMonth() === i; }).reduce((s: number, f: Fee) => s + f.amount, 0), expenses: cyExpenses.filter((e: Expense) => { const d = new Date(e.date); return d.getFullYear() === cy && d.getMonth() === i; }).reduce((s: number, e: Expense) => s + e.amount, 0) }));
  const expenseCategories: ExpenseCategory[] = cyExpenses.reduce<ExpenseCategory[]>((acc: ExpenseCategory[], e: Expense) => { const ex = acc.find((i: ExpenseCategory) => i.name === e.category); if (ex) ex.value += e.amount; else acc.push({ name: e.category, value: e.amount }); return acc; }, []).sort((a: ExpenseCategory, b: ExpenseCategory) => b.value - a.value).slice(0, 5);
  const COLORS = ['#00f5d4', '#7b2cbf', '#f72585', '#4361ee', '#fca311'];

  const selectedEquipmentPerson =
    equipmentPersonTypeFilter === 'student'
      ? students.find(s => s.autoId === equipmentPersonIdFilter)
      : equipmentPersonTypeFilter === 'teacher'
        ? employees.find(e => e.autoId === equipmentPersonIdFilter)
        : null;

  const selectedPersonEquipments =
    equipmentPersonIdFilter && equipmentPersonTypeFilter !== 'all'
      ? equipments.filter(eq => eq.assignedToId === equipmentPersonIdFilter)
      : [];

  const equipmentTypeChartData = [
    { name: 'Student', value: equipments.filter(eq => eq.assignedToType === 'student').length },
    { name: 'Teacher', value: equipments.filter(eq => eq.assignedToType === 'teacher').length },
    { name: 'Event', value: equipments.filter(eq => eq.assignedToType === 'event').length },
    { name: 'School', value: equipments.filter(eq => eq.assignedToType === 'school').length },
    { name: 'Other', value: equipments.filter(eq => eq.assignedToType === 'other').length },
  ].filter(item => item.value > 0);

  const equipmentConditionChartData = [
    { name: 'New', value: equipments.filter(eq => eq.condition === 'New').length },
    { name: 'Good', value: equipments.filter(eq => eq.condition === 'Good').length },
    { name: 'Repair Needed', value: equipments.filter(eq => eq.condition === 'Repair Needed').length },
    { name: 'Damaged', value: equipments.filter(eq => eq.condition === 'Damaged').length },
    { name: 'Lost', value: equipments.filter(eq => eq.condition === 'Lost').length },
  ].filter(item => item.value > 0);

  const navItems = [{ id: 'dashboard', icon: FiBarChart2, label: 'Dashboard' }, { id: 'students', icon: FiUsers, label: 'Students' }, { id: 'fees', icon: FiDollarSign, label: 'Fees & Billing' }, { id: 'feesbystudent', icon: FiUsers, label: 'Fees by Student' }, { id: 'attendance', icon: FiCheck, label: 'Attendance' }, { id: 'employees', icon: FiBriefcase, label: 'Employees' }, { id: 'equipments', icon: FiGrid, label: 'Equipments' }, { id: 'expenses', icon: FiTrendingDown, label: 'Expenses' }, { id: 'schedule', icon: FiCalendar, label: 'Schedule' }, { id: 'reminders', icon: FiBell, label: 'Reminders' }, { id: 'reports', icon: FiPieChart, label: 'Reports' }, { id: 'correction', icon: FiEdit2, label: 'Correction' }, { id: 'ai', icon: FiCpu, label: 'AI Assistant' }];
  const modalTitle = showClassMgmt ? 'Manage Classes' : showPackageMgmt ? 'Manage Packages' : showDocumentMgmt ? 'Manage Submitted Documents' : showSettings ? 'School Settings' : activeTab === 'students' ? 'Student Management' : activeTab === 'fees' ? 'Fee Management' : activeTab === 'expenses' ? 'Expense Management' : activeTab === 'equipments' ? 'Equipment Management' : activeTab === 'reminders' ? 'Reminder Management' : 'Employee Management';

  const searchBtn = "flex items-center gap-2 bg-[#1E1E1E] border border-gray-800 px-5 py-3 rounded-xl transition-all";

  const filteredStudentsForStudentTab = students.filter(s => {
    const q = searchTerm.toLowerCase();
    const matchesClass = !studentClassFilter || s.class === studentClassFilter;
    const matchesSearch =
      s.name.toLowerCase().includes(q) ||
      s.autoId.toLowerCase().includes(q) ||
      s.class.toLowerCase().includes(q);

    return matchesClass && matchesSearch;
  });


  return (
    <div className="min-h-screen bg-[#121212] text-white font-sans">
      {notification && <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 ${notification.type === 'success' ? 'bg-gradient-to-r from-emerald-600 to-emerald-500' : 'bg-gradient-to-r from-red-600 to-red-500'}`}>{notification.type === 'success' ? <FiCheck size={20} /> : <FiAlertCircle size={20} />}<span className="font-semibold">{notification.message}</span></div>}

      {firebaseErrorLog.length > 0 && (
        <div className="fixed bottom-4 left-80 z-50 w-[420px] bg-red-950/95 border border-red-500/40 rounded-2xl shadow-2xl p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold text-red-300">Firebase Errors</h3>
            <button onClick={() => setFirebaseErrorLog([])} className="text-red-300 hover:text-white text-xs">Clear</button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {firebaseErrorLog.map((err, i) => (
              <div key={i} className="bg-black/30 rounded-lg p-3 text-xs">
                <p className="text-red-300 font-bold">{err.context}</p>
                <p className="text-gray-300">Code: {err.code}</p>
                <p className="text-gray-400 break-words">{err.message}</p>
                <p className="text-gray-500 mt-1">{err.time}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Import Progress Bar */}
      {(importProgress.active || importProgress.current > 0) && (
        <div className="fixed bottom-4 right-4 z-50 w-96 bg-[#1E1E1E] border border-gray-700 rounded-2xl shadow-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse"></div>
              <span className="font-bold text-white text-sm">Importing Data</span>
            </div>
            <span className="text-sm font-bold text-cyan-400">{importProgress.current} / {importProgress.total}</span>
          </div>
          {/* Progress Bar */}
          <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden mb-3">
            <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-3 rounded-full transition-all duration-300 flex items-center justify-end pr-2"
              style={{ width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%` }}>
              {importProgress.total > 0 && (
                <span className="text-[10px] font-bold text-white">{Math.round((importProgress.current / importProgress.total) * 100)}%</span>
              )}
            </div>
          </div>
          {/* Current Status */}
          <div className="flex items-center gap-2 mb-2">
            <FiRefreshCw size={12} className={importProgress.active ? 'animate-spin text-cyan-400' : 'text-emerald-400'} />
            <span className={`text-xs truncate ${importProgress.active ? 'text-gray-400' : 'text-emerald-400 font-bold'}`}>{importProgress.status}</span>
          </div>
          {/* Success / Failed counts */}
          <div className="flex gap-4 text-xs">
            <span className="flex items-center gap-1 text-emerald-400"><FiCheck size={12} /> Added: {importProgress.success}</span>
            {importProgress.failed > 0 && <span className="flex items-center gap-1 text-red-400"><FiAlertCircle size={12} /> Failed: {importProgress.failed}</span>}
          </div>
        </div>
      )}
      {showImageModal && <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"><div className="bg-[#1E1E1E] rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] flex flex-col"><div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold text-cyan-400">Bill Preview</h3><button onClick={() => setShowImageModal(false)} className="text-gray-400 hover:text-white"><FiX size={24} /></button></div><div className="flex-1 overflow-auto"><img src={previewImage} alt="Bill" className="w-full rounded-lg" /></div></div></div>}

      {/* Reminder Form Modal */}
      {showModal && activeTab === 'reminders' && (
        <div className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1E1E1E] rounded-2xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-800 shadow-2xl">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-800">
              <h3 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">{modalType === 'add' ? 'Add Reminder' : 'Edit Reminder'}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-white transition hover:rotate-90 duration-300"><FiX size={28} /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1 md:col-span-2"><label className="text-xs text-cyan-400">Title</label><input placeholder="Reminder Title" value={reminderForm.title} onChange={e => setReminderForm({ ...reminderForm, title: e.target.value })} className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white" /></div>
                <div className="space-y-1"><label className="text-xs text-cyan-400">Date</label><input type="date" value={reminderForm.date} onChange={e => setReminderForm({ ...reminderForm, date: e.target.value })} className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white" /></div>
                <div className="space-y-1"><label className="text-xs text-cyan-400">Time</label><input type="time" value={reminderForm.time} onChange={e => setReminderForm({ ...reminderForm, time: e.target.value })} className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white" /></div>
                <div className="space-y-1"><label className="text-xs text-cyan-400">Type</label><select value={reminderForm.type} onChange={e => setReminderForm({ ...reminderForm, type: e.target.value })} className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white"><option>Fee Collection</option><option>Salary Payment</option><option>Meeting</option><option>Event</option><option>Payment Due</option><option>Exam</option><option>Other</option></select></div>
                <div className="space-y-1"><label className="text-xs text-cyan-400">Priority</label><select value={reminderForm.priority} onChange={e => setReminderForm({ ...reminderForm, priority: e.target.value })} className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white"><option>High</option><option>Medium</option><option>Low</option></select></div>
                <div className="space-y-1"><label className="text-xs text-cyan-400">Status</label><select value={reminderForm.status} onChange={e => setReminderForm({ ...reminderForm, status: e.target.value })} className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white"><option>Pending</option><option>Completed</option><option>Cancelled</option></select></div>
                <div className="space-y-1 md:col-span-2"><label className="text-xs text-cyan-400">Description</label><textarea placeholder="Description (optional)" value={reminderForm.description} onChange={e => setReminderForm({ ...reminderForm, description: e.target.value })} className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white h-24" /></div>
              </div>
              <button onClick={handleSaveReminder} className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white p-4 rounded-lg font-bold text-lg transition-all shadow-lg shadow-cyan-500/20">{modalType === 'add' ? 'Add Reminder' : 'Update Reminder'}</button>
            </div>
          </div>
        </div>
      )}


      {showModal && activeTab === 'equipments' && (
        <div className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1E1E1E] rounded-2xl p-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-gray-800 shadow-2xl">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-800">
              <h3 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">{modalType === 'add' ? 'Add Equipment' : 'Edit Equipment'}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-white transition hover:rotate-90 duration-300"><FiX size={28} /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1"><label className="text-xs text-cyan-400">Auto ID</label><input value={equipmentForm.autoId} readOnly className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 text-white font-mono" /></div>
              <div className="space-y-1"><label className="text-xs text-cyan-400">Equipment Name</label><input value={equipmentForm.name} onChange={e => setEquipmentForm({ ...equipmentForm, name: e.target.value })} placeholder="e.g., Projector, Bench, Laptop" className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white" /></div>
              <div className="space-y-1"><label className="text-xs text-cyan-400">Category</label><select value={equipmentForm.category} onChange={e => setEquipmentForm({ ...equipmentForm, category: e.target.value })} className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white"><option>Furniture</option><option>Electronics</option><option>Sports</option><option>Books</option><option>Lab Equipment</option><option>Event Material</option><option>Stationery</option><option>Other</option></select></div>
              <div className="space-y-1"><label className="text-xs text-cyan-400">Assigned To Type</label><select value={equipmentForm.assignedToType} onChange={e => handleEquipmentAssignedTypeChange(e.target.value as Equipment['assignedToType'])} className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white"><option value="student">Student</option><option value="teacher">Teacher</option><option value="event">Event</option><option value="school">School</option><option value="other">Other</option></select></div>
              {equipmentForm.assignedToType === 'student' && <>
                <div className="space-y-1"><label className="text-xs text-cyan-400">Select Class</label><select value={equipmentStudentClassFilter} onChange={e => { setEquipmentStudentClassFilter(e.target.value); setEquipmentForm(prev => ({ ...prev, assignedToId: '', assignedToName: '', status: 'Pending' })); }} className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white"><option value="">-- Select Class --</option>{[...new Set(students.filter(s => s.status === 'ACTIVE').map(s => s.class))].filter(Boolean).sort().map(cls => <option key={cls} value={cls}>{cls}</option>)}</select></div>
                <div className="space-y-1"><label className="text-xs text-cyan-400">Select Student</label><select value={students.find(s => s.autoId === equipmentForm.assignedToId)?.id || ''} onChange={e => handleEquipmentAssigneeChange(e.target.value)} disabled={!equipmentStudentClassFilter} className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white disabled:opacity-50"><option value="">{equipmentStudentClassFilter ? '-- Select Student --' : 'Select class first (Pending)'}</option>{students.filter(s => s.status === 'ACTIVE' && s.class === equipmentStudentClassFilter).sort((a, b) => a.name.localeCompare(b.name)).map(s => <option key={s.id} value={s.id}>{s.autoId} - {s.name}</option>)}</select></div>
              </>}
              {equipmentForm.assignedToType === 'teacher' && <>
                <div className="space-y-1"><label className="text-xs text-cyan-400">Select Role</label><select value={equipmentEmployeeRoleFilter} onChange={e => { setEquipmentEmployeeRoleFilter(e.target.value); setEquipmentForm(prev => ({ ...prev, assignedToId: '', assignedToName: '', status: 'Pending' })); }} className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white"><option value="">-- Select Role --</option>{[...new Set(employees.filter(e => e.status === 'ACTIVE').map(e => e.role))].filter(Boolean).sort().map(role => <option key={role} value={role}>{role}</option>)}</select></div>
                <div className="space-y-1"><label className="text-xs text-cyan-400">Select Teacher / Employee</label><select value={employees.find(e => e.autoId === equipmentForm.assignedToId)?.id || ''} onChange={e => handleEquipmentAssigneeChange(e.target.value)} disabled={!equipmentEmployeeRoleFilter} className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white disabled:opacity-50"><option value="">{equipmentEmployeeRoleFilter ? '-- Select Teacher / Employee --' : 'Select role first (Pending)'}</option>{employees.filter(e => e.status === 'ACTIVE' && e.role === equipmentEmployeeRoleFilter).sort((a, b) => a.name.localeCompare(b.name)).map(emp => <option key={emp.id} value={emp.id}>{emp.autoId} - {emp.name}</option>)}</select></div>
              </>}
              {(equipmentForm.assignedToType === 'event' || equipmentForm.assignedToType === 'other') && <div className="space-y-1 md:col-span-2"><label className="text-xs text-cyan-400">{equipmentForm.assignedToType === 'event' ? 'Event Name' : 'Assigned To / Location'}</label><input value={equipmentForm.assignedToName} onChange={e => setEquipmentForm({ ...equipmentForm, assignedToName: e.target.value, assignedToId: '' })} className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white" placeholder={equipmentForm.assignedToType === 'event' ? 'e.g., Annual Day' : 'e.g., Store Room'} /></div>}
              {equipmentForm.assignedToType === 'school' && <div className="space-y-1 md:col-span-2"><label className="text-xs text-cyan-400">School Location</label><input value={equipmentForm.assignedToName} onChange={e => setEquipmentForm({ ...equipmentForm, assignedToName: e.target.value || 'School' })} className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white" placeholder="School / Office / Classroom / Lab" /></div>}
              <div className="space-y-1"><label className="text-xs text-cyan-400">Quantity</label><input type="number" value={equipmentForm.quantity || ''} onChange={e => setEquipmentForm({ ...equipmentForm, quantity: parseInt(e.target.value) || 1 })} className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white" /></div>
              <div className="space-y-1"><label className="text-xs text-cyan-400">Value ₹</label><input type="number" value={equipmentForm.value || ''} onChange={e => setEquipmentForm({ ...equipmentForm, value: parseFloat(e.target.value) || 0 })} className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white" /></div>
              <div className="space-y-1"><label className="text-xs text-cyan-400">Condition</label><select value={equipmentForm.condition} onChange={e => setEquipmentForm({ ...equipmentForm, condition: e.target.value as Equipment['condition'] })} className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white"><option>New</option><option>Good</option><option>Repair Needed</option><option>Damaged</option><option>Lost</option></select></div>
              <div className="space-y-1"><label className="text-xs text-cyan-400">Status</label><select value={equipmentForm.status} onChange={e => setEquipmentForm({ ...equipmentForm, status: e.target.value as Equipment['status'] })} className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white"><option>Pending</option><option>Available</option><option>Assigned</option><option>In Repair</option><option>Retired</option></select></div>
              <div className="space-y-1"><label className="text-xs text-cyan-400">Purchase Date</label><input type="date" value={equipmentForm.purchaseDate} onChange={e => setEquipmentForm({ ...equipmentForm, purchaseDate: e.target.value })} className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white" /></div>
              <div className="space-y-1 md:col-span-2"><label className="text-xs text-cyan-400">Notes</label><textarea value={equipmentForm.notes} onChange={e => setEquipmentForm({ ...equipmentForm, notes: e.target.value })} className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white h-24" placeholder="Additional notes..." /></div>
            </div>
            <button onClick={handleSaveEquipment} className="w-full mt-6 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white p-4 rounded-lg font-bold text-lg shadow-lg shadow-cyan-500/20">{modalType === 'add' ? 'Add Equipment' : 'Update Equipment'}</button>
          </div>
        </div>
      )}

      {showModal && activeTab !== 'reminders' && activeTab !== 'equipments' && <AppModals modalTitle={modalTitle} onClose={closeModal} showClassMgmt={showClassMgmt} showPackageMgmt={showPackageMgmt} showSettings={showSettings} showOfferLetterSettings={showOfferLetterSettings} setShowClassMgmt={setShowClassMgmt} setShowPackageMgmt={setShowPackageMgmt} setShowSettings={setShowSettings} setShowOfferLetterSettings={setShowOfferLetterSettings} setShowModal={(v) => { if (v) setShowModal(true); else closeModal(); }} activeTab={activeTab} modalType={modalType} billFile={billFile} uploading={uploading} handleBillUpload={handleBillUpload} previewBill={previewBill} studentForm={studentForm} setStudentForm={setStudentForm} classes={classes} packages={packages} isCustomPackage={isCustomPackage} customPackageAmount={customPackageAmount} setCustomPackageAmount={setCustomPackageAmount} handleAutoCaps={handleAutoCaps} handlePackageChange={handlePackageChange} handleSaveStudent={handleSaveStudent} newClassName={newClassName} setNewClassName={setNewClassName} handleAddClass={handleAddClass} handleRemoveClass={handleRemoveClass} newPackageName={newPackageName} setNewPackageName={setNewPackageName} newPackageAmount={newPackageAmount} setNewPackageAmount={setNewPackageAmount} handleAddPackage={handleAddPackage} handleRemovePackage={handleRemovePackage} feeForm={feeForm} setFeeForm={setFeeForm} students={students} selectedStudentForFee={selectedStudentForFee} feeClassFilter={feeClassFilter} setFeeClassFilter={setFeeClassFilter} setSelectedStudentForFee={setSelectedStudentForFee} handleStudentSelection={handleStudentSelection} handleSaveFee={handleSaveFee} expenseForm={expenseForm} setExpenseForm={setExpenseForm} employees={employees} handleEmployeeSelectionForExpense={handleEmployeeSelectionForExpense} handleSaveExpense={handleSaveExpense} employeeForm={employeeForm} setEmployeeForm={setEmployeeForm} handleSaveEmployee={handleSaveEmployee} showDocumentMgmt={showDocumentMgmt} setShowDocumentMgmt={setShowDocumentMgmt} documentOptions={documentOptions} newDocumentName={newDocumentName} setNewDocumentName={setNewDocumentName} handleAddDocumentOption={handleAddDocumentOption} handleRemoveDocumentOption={handleRemoveDocumentOption} schoolSettings={schoolSettings} setSchoolSettings={setSchoolSettings} />}

      <div className="fixed left-0 top-0 h-full w-72 bg-[#1E1E1E] border-r border-gray-800 p-6 flex flex-col z-40">
        <div className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent mb-8 flex items-center gap-3 shrink-0">
          <div className="p-2 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl shadow-lg shadow-cyan-500/30"><SchoolLogo /></div><span>School OS</span>
        </div>
        <nav className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-1">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id as Tab)} className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl transition-all duration-300 group ${activeTab === item.id ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/50' : 'hover:bg-gray-800 border border-transparent'}`}>
              <item.icon className={`${activeTab === item.id ? 'text-cyan-400' : 'text-gray-400 group-hover:text-cyan-400'} transition-colors`} size={20} />
              <span className={`${activeTab === item.id ? 'text-white font-semibold' : 'text-gray-400 group-hover:text-white'} transition-colors`}>{item.label}</span>
              {activeTab === item.id && <div className="ml-auto w-1.5 h-1.5 bg-cyan-400 rounded-full shadow-lg shadow-cyan-400/50" />}
            </button>
          ))}
        </nav>
        <div className="pt-6 border-t border-gray-800 mt-4 shrink-0"><div className="flex items-center gap-3 px-4 py-3 bg-gray-800/50 rounded-xl"><div className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full flex items-center justify-center font-bold">A</div><div><p className="text-sm font-semibold">Admin</p><p className="text-xs text-gray-400">Super User</p></div></div></div>
      </div>

      <div className="ml-72 p-8">
        <div className="flex flex-col md:flex-row justify-between md:items-center mb-10 gap-4">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent capitalize">{activeTab === 'feesbystudent' ? 'Fees by Student' : activeTab === 'schedule' ? 'Schedule / Timetable' : activeTab === 'correction' ? 'Correction / Re-sequence' : activeTab === 'ai' ? 'AI Assistant' : activeTab}</h1>
            <p className="text-gray-400 mt-2 flex items-center gap-2"><FiCalendar size={14} />{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={handleRefresh} disabled={refreshing} className="p-3 bg-[#1E1E1E] border border-gray-800 rounded-xl hover:border-cyan-500/50 transition-all disabled:opacity-50" title="Refresh"><FiRefreshCw size={20} className={refreshing ? 'animate-spin' : ''} /></button>
            <button onClick={exportFullReportPDF} className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 px-4 py-2 rounded-xl transition-all text-white font-semibold shadow-lg shadow-cyan-500/20" title="Export complete report"><FiFileText size={18} />Full Report</button>
            {!isReadOnly && (
              <button onClick={() => { resetModalSubViews(); setModalType('add'); setCurrentRecord(null); setBillFile(null); setShowSettings(true); setShowModal(true); }} className="flex items-center gap-2 bg-[#1E1E1E] border border-gray-800 hover:border-purple-500/50 px-4 py-2 rounded-xl transition-all"><FiSettings size={18} />Settings</button>
            )}
            <div className="px-4 py-2 bg-[#1E1E1E] border border-gray-800 rounded-xl text-sm text-gray-400">Year: {cy}</div>
          </div>
        </div>

        {!['students', 'feesbystudent', 'employees', 'equipments', 'attendance', 'reports', 'reminders', 'schedule', 'ai'].includes(activeTab) && <div className="flex gap-2 mb-8 flex-wrap">{['week', 'month', 'quarter', 'year', 'all'].map(r => <button key={r} onClick={() => setTimeRange(r)} className={`px-5 py-2 rounded-xl border transition-all capitalize ${timeRange === r ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400' : 'bg-[#1E1E1E] border-gray-800 text-gray-400 hover:border-cyan-500/50'}`}>{r}</button>)}</div>}

        {/* ===== Attendance ===== */}
        {activeTab === 'attendance' && (
          <AttendanceSection
            students={students}
            employees={employees}
            attendance={attendance}
            holidays={holidays}
            schoolSettings={schoolSettings}
            isReadOnly={isReadOnly}
            saveBatchAttendance={saveBatchAttendance}
            saveAttendance={saveAttendance}
            addHoliday={addHoliday}
            deleteHoliday={deleteHoliday}
            showNotification={showNotification}
            loadData={loadData}
            addCausalLeave={addCausalLeave}
            getCausalLeaves={getCausalLeaves}
            deleteCausalLeave={deleteCausalLeave}
            logSalarySlipAudit={logSalarySlipAudit}
            updateEmployee={updateEmployee}
          />
        )}

        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[{ label: 'Total Students', value: stats.totalStudents, icon: FiUsers, color: 'cyan' }, { label: 'Active Students', value: stats.activeStudents, icon: FiUsers, color: 'emerald' }, { label: 'Collected Fees', value: `₹${stats.collectedFees.toLocaleString()}`, icon: FiDollarSign, color: 'yellow' }, { label: 'Total Expenses', value: `₹${stats.totalExpenses.toLocaleString()}`, icon: FiTrendDown, color: 'red' }].map((c, i) => (
                <div key={i} className="bg-[#1E1E1E] p-6 rounded-2xl border border-gray-800 hover:border-cyan-500/30 transition-all">
                  <div className="flex items-center justify-between mb-4"><div className={`p-3 bg-${c.color}-500/20 rounded-xl`}><c.icon size={24} className={`text-${c.color}-400`} /></div><span className="flex items-center gap-1 text-sm text-emerald-400"><FiTrendingUp size={14} />+12%</span></div>
                  <p className="text-gray-400 text-sm">{c.label}</p><p className="text-3xl font-bold mt-1">{c.value}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 p-6 rounded-2xl border border-cyan-500/30"><div className="flex items-center justify-between"><div><p className="text-gray-400 text-sm">Total Employees</p><p className="text-3xl font-bold mt-2 text-cyan-400">{stats.totalEmployees}</p></div><div className="p-3 bg-cyan-500/20 rounded-xl"><FiBriefcase size={28} className="text-cyan-400" /></div></div></div>
              <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 p-6 rounded-2xl border border-cyan-500/30"><div className="flex items-center justify-between"><div><p className="text-gray-400 text-sm">Active Employees</p><p className="text-3xl font-bold mt-2 text-emerald-400">{stats.activeEmployees}</p></div><div className="p-3 bg-emerald-500/20 rounded-xl"><FiUser size={28} className="text-emerald-400" /></div></div></div>
              <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 p-6 rounded-2xl border border-cyan-500/30"><div className="flex items-center justify-between"><div><p className="text-gray-400 text-sm">Net Revenue</p><p className={`text-3xl font-bold mt-2 ${stats.netRevenue >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>₹{stats.netRevenue.toLocaleString()}</p></div><div className="p-3 bg-yellow-500/20 rounded-xl"><FiBarChart2 size={28} className="text-yellow-400" /></div></div></div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[#1E1E1E] p-6 rounded-2xl border border-gray-800">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><FiBarChart2 className="text-cyan-400" />Revenue vs Expenses ({cy})</h3>
                <ResponsiveContainer width="100%" height={300}><AreaChart data={chartData}><defs><linearGradient id="cf" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00f5d4" stopOpacity={0.3} /><stop offset="95%" stopColor="#00f5d4" stopOpacity={0} /></linearGradient><linearGradient id="ce" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f72585" stopOpacity={0.3} /><stop offset="95%" stopColor="#f72585" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#333" /><XAxis dataKey="month" stroke="#666" /><YAxis stroke="#666" tickFormatter={formatCurrencyTick} /><Tooltip contentStyle={{ backgroundColor: '#1E1E1E', border: '1px solid #333' }} formatter={formatCurrencyTooltip} /><Legend /><Area type="monotone" dataKey="fees" stroke="#00f5d4" strokeWidth={3} fill="url(#cf)" /><Area type="monotone" dataKey="expenses" stroke="#f72585" strokeWidth={3} fill="url(#ce)" /></AreaChart></ResponsiveContainer>
              </div>
              <div className="bg-[#1E1E1E] p-6 rounded-2xl border border-gray-800">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><FiDollarSign className="text-cyan-400" />Expense Breakdown</h3>
                <ResponsiveContainer width="100%" height={300}><PieChart><Pie data={expenseCategories.length > 0 ? expenseCategories : [{ name: 'No Data', value: 1 }]} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value, x, y }: any) => (<text x={x} y={y} fill="#ffffff" fontSize={12} textAnchor="middle" dominantBaseline="central">{`${name}: ₹${Number(value || 0).toLocaleString()}`}</text>) }>{expenseCategories.map((_: ExpenseCategory, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />)}</Pie><Tooltip contentStyle={{ backgroundColor: '#1E1E1E', border: '1px solid #333' }} formatter={formatCurrencyTooltip} /></PieChart></ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'students' && (
          <div className="space-y-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative"><FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" /><input placeholder="Search by name, ID, barcode..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-[#1E1E1E] border border-gray-800 rounded-xl focus:outline-none focus:border-cyan-500 transition" /></div>
              <select value={studentClassFilter} onChange={e => setStudentClassFilter(e.target.value)} className="p-3 bg-[#1E1E1E] border border-gray-800 rounded-xl text-white focus:outline-none focus:border-cyan-500 transition min-w-[140px]">
                <option value="">All Classes</option>
                {[...new Set(students.map(s => s.class).filter(Boolean))].sort().map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="flex flex-wrap gap-2">
                {!isReadOnly && <button onClick={openAddModal} className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 px-5 py-3 rounded-xl font-semibold shadow-lg shadow-cyan-500/20"><FiPlus size={18} />Add Student</button>}
                <button onClick={() => exportToExcel(filteredStudentsForStudentTab, 'Students')} className={searchBtn + ' hover:border-emerald-500/50'}><FiDownload size={18} />Excel</button>
                <button onClick={() => exportStudentPDF(filteredStudentsForStudentTab)} className={searchBtn + ' hover:border-red-500/50'}><FiFileText size={18} />PDF</button>
                {!isReadOnly && <label className={searchBtn + ' hover:border-yellow-500/50 cursor-pointer'}><FiUpload size={18} />Import<input type="file" accept=".xlsx,.xls" onChange={importFromExcel} className="hidden" /></label>}
              </div>
            </div>
            <div className="bg-[#1E1E1E] rounded-2xl border border-gray-800 overflow-hidden">
              <div className="overflow-x-auto"><table className="w-full">
                <thead className="bg-gray-800/50"><tr><th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Auto ID</th><th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Name</th><th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Roll</th><th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Class</th><th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap hidden md:table-cell">Package</th><th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Fee</th><th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap hidden lg:table-cell">Parent</th><th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Status</th><th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Actions</th></tr></thead>
                <tbody>
                  {students.filter(s => (!studentClassFilter || s.class === studentClassFilter) && (s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.autoId.toLowerCase().includes(searchTerm.toLowerCase()) || s.class.toLowerCase().includes(searchTerm.toLowerCase()))).slice(0, showAllStudents ? undefined : 5).map(s => (
                    <tr key={s.id} className="border-t border-gray-800 hover:bg-gray-800/30 transition">
                      <td className="px-6 py-4 font-mono text-cyan-400">{s.autoId}</td><td className="px-6 py-4 font-semibold">{s.name}</td><td className="px-6 py-4">{s.rollNumber}</td><td className="px-6 py-4">{s.class}</td>
                      <td className="px-6 py-4 hidden md:table-cell"><span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs font-semibold">{s.package}</span></td><td className="px-6 py-4 font-semibold text-yellow-400">₹{(s.feeAmount || 0).toLocaleString()}</td><td className="px-6 py-4 text-gray-400 hidden lg:table-cell">{s.parentName}</td>
                      <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-xs font-semibold ${s.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{s.status}</span></td>
                      <td className="px-6 py-4">{!isReadOnly && <div className="flex gap-2"><button onClick={() => exportStudentIDCard(s)} className="text-emerald-400 hover:text-emerald-300 p-1 hover:bg-emerald-500/20 rounded" title="Download ID Card"><FiFileText size={18} /></button><button onClick={() => openEditModal(s, 'student')} className="text-cyan-400 hover:text-cyan-300 p-1 hover:bg-cyan-500/20 rounded" title="Edit Student"><FiEdit2 size={18} /></button><button onClick={() => handleDelete(s.id!, 'student')} className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/20 rounded" title="Delete Student"><FiTrash2 size={18} /></button></div>}{isReadOnly && <FiEye className="text-gray-600" size={16} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
            {students.filter(s => (!studentClassFilter || s.class === studentClassFilter) && (s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.autoId.toLowerCase().includes(searchTerm.toLowerCase()))).length > 5 && <div className="text-center"><p className="text-gray-400 text-sm mb-3">{showAllStudents ? 'Showing all' : `Showing 5 of ${students.filter(s => (!studentClassFilter || s.class === studentClassFilter) && (s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.autoId.toLowerCase().includes(searchTerm.toLowerCase()))).length}`}</p><button onClick={() => setShowAllStudents(!showAllStudents)} className="px-6 py-2 bg-[#1E1E1E] border border-gray-800 hover:border-cyan-500/50 rounded-xl text-cyan-400">{showAllStudents ? 'Show Less' : `View All ${students.filter(s => (!studentClassFilter || s.class === studentClassFilter) && (s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.autoId.toLowerCase().includes(searchTerm.toLowerCase()))).length}`}</button></div>}
          </div>
        )}

        {activeTab === 'fees' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#1E1E1E] p-4 rounded-xl border border-gray-800"><p className="text-gray-400 text-xs">Total Fees</p><p className="text-2xl font-bold text-cyan-400">₹{fees.reduce((s, f) => s + f.amount, 0).toLocaleString()}</p></div>
              <div className="bg-[#1E1E1E] p-4 rounded-xl border border-gray-800"><p className="text-gray-400 text-xs">Collected</p><p className="text-2xl font-bold text-emerald-400">₹{fees.filter(f => getEffectiveFeeStatus(f) === 'paid').reduce((s, f) => s + f.amount, 0).toLocaleString()}</p></div>
              <div className="bg-[#1E1E1E] p-4 rounded-xl border border-gray-800"><p className="text-gray-400 text-xs">Balance</p><p className="text-2xl font-bold text-yellow-400">₹{students.filter(st => st.status === 'ACTIVE').reduce((sum, st) => sum + getStudentPaymentInfo(st).balance, 0).toLocaleString()}</p></div>
              <div className="bg-[#1E1E1E] p-4 rounded-xl border border-gray-800"><p className="text-gray-400 text-xs">Overdue</p><p className="text-2xl font-bold text-red-400">₹{fees.filter(f => getEffectiveFeeStatus(f) === 'overdue').reduce((s, f) => s + f.amount, 0).toLocaleString()}</p></div>
            </div>
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative"><FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" /><input placeholder="Search student or ID..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-[#1E1E1E] border border-gray-800 rounded-xl focus:outline-none focus:border-cyan-500 transition" /></div>
              <select value={studentClassFilter} onChange={e => setStudentClassFilter(e.target.value)} className="p-3 bg-[#1E1E1E] border border-gray-800 rounded-xl text-white focus:outline-none focus:border-cyan-500 transition min-w-[140px]">
                <option value="">All Classes</option>
                {[...new Set(students.map(s => s.class).filter(Boolean))].sort().map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="flex flex-wrap gap-2">{!isReadOnly && <button onClick={openAddModal} className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 px-5 py-3 rounded-xl font-semibold shadow-lg shadow-cyan-500/20"><FiPlus size={18} />Add Fee</button>}<button onClick={() => exportToExcel(fees, 'Fees')} className={searchBtn + ' hover:border-emerald-500/50'}><FiDownload size={18} />Excel</button><button onClick={exportFeeTransactionsPDF} className={searchBtn + ' hover:border-red-500/50'}><FiFileText size={18} />PDF</button><button onClick={() => exportStudentInvoicePDF(studentClassFilter || undefined)} className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl text-sm font-semibold shadow-lg shadow-emerald-500/20"><FiFileText size={18} />Invoice (A5)</button></div>
            </div>
            <div className="bg-[#1E1E1E] rounded-2xl border border-gray-800 overflow-hidden"><div className="overflow-x-auto"><table className="w-full">
              <thead className="bg-gray-800/50"><tr><th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Auto ID</th><th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Student</th><th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Amount</th><th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Type</th><th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap hidden md:table-cell">Description</th><th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Status</th><th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Bill</th><th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Actions</th></tr></thead>
              <tbody>{fees.filter(f => { const matchSearch = f.studentName.toLowerCase().includes(searchTerm.toLowerCase()) || f.autoId.toLowerCase().includes(searchTerm.toLowerCase()); if (!matchSearch) return false; if (!studentClassFilter) return true; const student = students.find(s => s.autoId === f.studentId); return student?.class === studentClassFilter; }).slice(0, showAllFees ? undefined : 5).map(f => (
                  <tr key={f.id} className="border-t border-gray-800 hover:bg-gray-800/30 transition">
                    <td className="px-6 py-4 font-mono text-cyan-400">{f.autoId}</td><td className="px-6 py-4 font-semibold">{f.studentName}</td><td className="px-6 py-4 font-semibold">₹{f.amount.toLocaleString()}</td><td className="px-6 py-4">{f.type}</td><td className="px-6 py-4 text-gray-400 hidden md:table-cell">{f.description || '-'}</td>
                  <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-xs font-semibold ${getEffectiveFeeStatus(f) === 'paid' ? 'bg-emerald-500/20 text-emerald-400' : getEffectiveFeeStatus(f) === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>{getEffectiveFeeStatus(f)}</span></td>
                  <td className="px-6 py-4">{f.billUrl && <button onClick={() => previewBill(f.billUrl!)} className="text-cyan-400 hover:text-cyan-300"><FiImage size={18} /></button>}</td>
                  <td className="px-6 py-4">{!isReadOnly && <div className="flex gap-2"><button onClick={() => exportFeeInvoice(f)} className="text-emerald-400 hover:text-emerald-300 p-1 hover:bg-emerald-500/20 rounded" title="Download Invoice"><FiFileText size={18} /></button><button onClick={() => openEditModal(f, 'fee')} className="text-cyan-400 hover:text-cyan-300 p-1 hover:bg-cyan-500/20 rounded"><FiEdit2 size={18} /></button><button onClick={() => handleDelete(f.id!, 'fee')} className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/20 rounded"><FiTrash2 size={18} /></button></div>}{isReadOnly && <FiEye className="text-gray-600" size={16} />}</td>
                </tr>
              ))}</tbody>
            </table></div></div>
            {fees.filter(f => { const matchSearch = f.studentName.toLowerCase().includes(searchTerm.toLowerCase()) || f.autoId.toLowerCase().includes(searchTerm.toLowerCase()); if (!matchSearch) return false; if (!studentClassFilter) return true; const student = students.find(s => s.autoId === f.studentId); return student?.class === studentClassFilter; }).length > 5 && <div className="text-center"><p className="text-gray-400 text-sm mb-3">{showAllFees ? 'Showing all' : `Showing 5 of ${fees.filter(f => { const matchSearch = f.studentName.toLowerCase().includes(searchTerm.toLowerCase()) || f.autoId.toLowerCase().includes(searchTerm.toLowerCase()); if (!matchSearch) return false; if (!studentClassFilter) return true; const student = students.find(s => s.autoId === f.studentId); return student?.class === studentClassFilter; }).length}`}</p><button onClick={() => setShowAllFees(!showAllFees)} className="px-6 py-2 bg-[#1E1E1E] border border-gray-800 hover:border-cyan-500/50 rounded-xl text-cyan-400">{showAllFees ? 'Show Less' : `View All ${fees.filter(f => { const matchSearch = f.studentName.toLowerCase().includes(searchTerm.toLowerCase()) || f.autoId.toLowerCase().includes(searchTerm.toLowerCase()); if (!matchSearch) return false; if (!studentClassFilter) return true; const student = students.find(s => s.autoId === f.studentId); return student?.class === studentClassFilter; }).length}`}</button></div>}
          </div>
        )}

        {activeTab === 'feesbystudent' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#1E1E1E] p-4 rounded-xl border border-gray-800"><p className="text-gray-400 text-xs">Target</p><p className="text-xl font-bold text-cyan-400">₹{students.filter(s => s.status === 'ACTIVE' && (!studentClassFilter || s.class === studentClassFilter)).reduce((sum, s) => sum + (s.feeAmount || 0), 0).toLocaleString()}</p></div>
              <div className="bg-[#1E1E1E] p-4 rounded-xl border border-gray-800"><p className="text-gray-400 text-xs">Collected</p><p className="text-xl font-bold text-emerald-400">₹{fees.filter(f => getEffectiveFeeStatus(f) === 'paid').filter(f => { if (!studentClassFilter) return true; const st = students.find(s => s.autoId === f.studentId); return st?.class === studentClassFilter; }).reduce((sum, f) => sum + f.amount, 0).toLocaleString()}</p></div>
              <div className="bg-[#1E1E1E] p-4 rounded-xl border border-gray-800"><p className="text-gray-400 text-xs">Balance</p><p className="text-xl font-bold text-yellow-400">₹{students.filter(s => s.status === 'ACTIVE' && (!studentClassFilter || s.class === studentClassFilter)).reduce((sum, s) => sum + getStudentPaymentInfo(s).balance, 0).toLocaleString()}</p></div>
              <div className="bg-[#1E1E1E] p-4 rounded-xl border border-gray-800"><p className="text-gray-400 text-xs">Overdue</p><p className="text-xl font-bold text-red-400">₹{students.filter(s => s.status === 'ACTIVE' && (!studentClassFilter || s.class === studentClassFilter)).reduce((sum, s) => sum + getStudentPaymentInfo(s).totalOverdue, 0).toLocaleString()}</p></div>
            </div>
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative"><FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" /><input placeholder="Search student..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-[#1E1E1E] border border-gray-800 rounded-xl focus:outline-none focus:border-cyan-500 transition" /></div>
              <select value={studentClassFilter} onChange={e => setStudentClassFilter(e.target.value)} className="p-3 bg-[#1E1E1E] border border-gray-800 rounded-xl text-white focus:outline-none focus:border-cyan-500 transition min-w-[140px]">
                <option value="">All Classes</option>
                {[...new Set(students.map(s => s.class).filter(Boolean))].sort().map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button onClick={() => exportToExcel(students.filter(s => s.status === 'ACTIVE' && (!studentClassFilter || s.class === studentClassFilter)).map(s => { const i = getStudentPaymentInfo(s); return { 'Auto ID': s.autoId, 'Name': s.name, 'Class': s.class, 'Package': i.totalPackage, 'Paid': i.totalPaid, 'Balance': i.balance, 'Overdue': i.totalOverdue, 'Status': i.paymentStatus }; }), 'Fees By Student')} className={searchBtn + ' hover:border-emerald-500/50'}><FiDownload size={18} />Excel</button>
              <button onClick={() => exportToPDF(students.filter(s => s.status === 'ACTIVE' && (!studentClassFilter || s.class === studentClassFilter)).map(s => { const i = getStudentPaymentInfo(s); return { 'Auto ID': s.autoId, 'Name': s.name, 'Class': s.class, 'Package': i.totalPackage, 'Paid': i.totalPaid, 'Balance': i.balance, 'Overdue': i.totalOverdue, 'Status': i.paymentStatus }; }), 'Fees By Student Report')} className={searchBtn + ' hover:border-red-500/50'}><FiFileText size={18} />PDF</button>
            </div>
            <div className="bg-[#1E1E1E] rounded-2xl border border-gray-800 overflow-hidden"><div className="overflow-x-auto"><table className="w-full">
              <thead className="bg-gray-800/50"><tr><th className="px-4 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Student</th><th className="px-4 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap hidden md:table-cell">Class</th><th className="px-4 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Package</th><th className="px-4 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Paid</th><th className="px-4 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Balance</th><th className="px-4 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Overdue</th><th className="px-4 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Progress</th><th className="px-4 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Status</th></tr></thead>
              <tbody>{students.filter(s => s.status === 'ACTIVE' && (!studentClassFilter || s.class === studentClassFilter)).filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.autoId.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, showAllFeesByStudent ? undefined : 5).map(s => {
                const info = getStudentPaymentInfo(s);
                const sc = info.paymentStatus === 'PAID' ? 'bg-emerald-500/20 text-emerald-400' : info.paymentStatus === 'PARTIAL' ? 'bg-yellow-500/20 text-yellow-400' : info.paymentStatus === 'OVERDUE' ? 'bg-red-500/20 text-red-400' : 'bg-red-500/20 text-red-400';
                const pc = info.percentage >= 100 ? 'from-emerald-500 to-emerald-400' : info.percentage >= 50 ? 'from-cyan-500 to-blue-500' : info.percentage > 0 ? 'from-yellow-500 to-orange-500' : 'from-red-500 to-red-400';
                return (<tr key={s.id} className="border-t border-gray-800 hover:bg-gray-800/30 transition">
                  <td className="px-4 py-4"><p className="font-semibold">{s.name}</p><p className="text-xs text-cyan-400 font-mono">{s.autoId}</p></td>
                  <td className="px-4 py-4 hidden md:table-cell"><span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs font-semibold">{s.class}</span></td>
                  <td className="px-4 py-4 font-semibold text-cyan-400">₹{info.totalPackage.toLocaleString()}</td>
                  <td className="px-4 py-4 font-semibold text-emerald-400">₹{info.totalPaid.toLocaleString()}</td>
                  <td className="px-4 py-4 font-semibold text-yellow-400">₹{info.balance.toLocaleString()}</td>
                  <td className={`px-4 py-4 font-semibold ${info.totalOverdue > 0 ? 'text-red-400' : 'text-gray-400'}`}>₹{info.totalOverdue.toLocaleString()}</td>
                  <td className="px-4 py-4 min-w-[120px]"><div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden"><div className={`bg-gradient-to-r ${pc} h-2 rounded-full transition-all duration-500`} style={{ width: `${info.percentage}%` }}></div></div><p className="text-xs text-gray-400 mt-1">{info.percentage.toFixed(0)}% • {info.feeCount} fees</p></td>
                  <td className="px-4 py-4"><span className={`px-3 py-1 rounded-full text-xs font-semibold ${sc}`}>{info.paymentStatus}</span></td>
                </tr>);
              })}</tbody>
            </table></div></div>
            {students.filter(s => s.status === 'ACTIVE' && (!studentClassFilter || s.class === studentClassFilter)).filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.autoId.toLowerCase().includes(searchTerm.toLowerCase())).length > 5 && <div className="text-center"><p className="text-gray-400 text-sm mb-3">{showAllFeesByStudent ? 'Showing all' : `Showing 5 of ${students.filter(s => s.status === 'ACTIVE' && (!studentClassFilter || s.class === studentClassFilter)).filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.autoId.toLowerCase().includes(searchTerm.toLowerCase())).length}`}</p><button onClick={() => setShowAllFeesByStudent(!showAllFeesByStudent)} className="px-6 py-2 bg-[#1E1E1E] border border-gray-800 hover:border-cyan-500/50 rounded-xl text-cyan-400">{showAllFeesByStudent ? 'Show Less' : `View All ${students.filter(s => s.status === 'ACTIVE' && (!studentClassFilter || s.class === studentClassFilter)).filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.autoId.toLowerCase().includes(searchTerm.toLowerCase())).length}`}</button></div>}
          </div>
        )}

        {activeTab === 'employees' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#1E1E1E] p-4 rounded-xl border border-gray-800"><p className="text-gray-400 text-xs">Total Employees</p><p className="text-2xl font-bold text-cyan-400">{employees.length}</p></div>
              <div className="bg-[#1E1E1E] p-4 rounded-xl border border-gray-800"><p className="text-gray-400 text-xs">Active</p><p className="text-2xl font-bold text-emerald-400">{employees.filter(e => e.status === 'ACTIVE').length}</p></div>
              <div className="bg-[#1E1E1E] p-4 rounded-xl border border-gray-800"><p className="text-gray-400 text-xs">Monthly Salary</p><p className="text-2xl font-bold text-yellow-400">₹{getEligibleSalaryEmployees().reduce((s, e) => s + (e.salary || 0), 0).toLocaleString()}</p></div>
              <div className="bg-[#1E1E1E] p-4 rounded-xl border border-gray-800"><p className="text-gray-400 text-xs">Total Paid</p><p className="text-2xl font-bold text-red-400">₹{employees.reduce((s, e) => s + getEmployeeExpenseInfo(e).totalPaid, 0).toLocaleString()}</p></div>
            </div>
            <div className="flex flex-col gap-3">
              <div className="relative w-full"><FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" /><input placeholder="Search by name, ID, or role..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-[#1E1E1E] border border-gray-800 rounded-xl focus:outline-none focus:border-cyan-500 transition" /></div>
              <div className="flex flex-wrap gap-2 items-center">{!isReadOnly && <button onClick={openAddModal} className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 px-5 py-3 rounded-xl font-semibold shadow-lg shadow-cyan-500/20"><FiPlus size={18} />Add Employee</button>}{!isReadOnly && <button onClick={() => runSalaryAutoRefresh(true)} className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white px-4 py-3 rounded-xl text-sm font-semibold shadow-lg shadow-emerald-500/20"><FiRefreshCw size={16} />Salary Refresh</button>}<button onClick={() => exportEmployeeSalarySlip()} className="flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white px-4 py-3 rounded-xl text-sm font-semibold shadow-lg shadow-yellow-500/20"><FiDollarSign size={16} />Salary Slips (PDF)</button>{!isReadOnly && <button onClick={() => { resetModalSubViews(); setShowOfferLetterSettings(true); setShowModal(true); }} className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white px-4 py-3 rounded-xl text-sm font-semibold shadow-lg shadow-purple-500/20"><FiFileText size={16} />Offer Letter Settings</button>}<div className="relative"><button onClick={() => setShowMonthPicker(!showMonthPicker)} className="flex items-center gap-2 bg-[#1E1E1E] border border-gray-800 hover:border-cyan-500 text-white px-4 py-3 rounded-xl text-sm font-semibold shadow-lg transition"><FiCalendar size={16} />{selectedMonths.length === 1 ? selectedMonths[0] : selectedMonths.length + ' months'}</button>{showMonthPicker && <div className="absolute top-full left-0 mt-1 bg-[#1E1E1E] border border-gray-800 rounded-xl p-3 z-50 shadow-lg min-w-[200px]">{Array.from({length: 6}, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() - i); const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; const mName = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }); return (<label key={v} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-800 rounded-lg cursor-pointer text-sm"><input type="checkbox" checked={selectedMonths.includes(v)} onChange={() => { setSelectedMonths(prev => prev.includes(v) ? prev.filter(m => m !== v) : [...prev, v].sort()); }} className="accent-cyan-500" />{mName}</label>); })}<hr className="border-gray-800 my-1" /><label className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-800 rounded-lg cursor-pointer text-sm"><input type="checkbox" checked={selectedMonths.length === 0} onChange={() => setSelectedMonths([])} className="accent-cyan-500" />Clear all</label></div>}</div><button onClick={() => exportToExcel(employees, 'Employees')} className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white px-4 py-3 rounded-xl text-sm font-semibold shadow-lg shadow-emerald-500/20"><FiDownload size={16} />Excel</button><button onClick={() => exportEmployeeReportPDF()} className="flex items-center gap-2 bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600 text-white px-4 py-3 rounded-xl text-sm font-semibold shadow-lg shadow-rose-500/20"><FiFileText size={16} />PDF</button></div>
            </div>
            <div className="bg-[#1E1E1E] rounded-2xl border border-gray-800 overflow-hidden"><div className="overflow-x-auto"><table className="w-full">
              <thead className="bg-gray-800/50"><tr><th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Auto ID</th><th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Name</th><th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Role</th><th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap hidden xl:table-cell">Dept</th><th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Salary</th><th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap hidden md:table-cell">Phone</th><th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap hidden lg:table-cell">Paid (Expenses)</th><th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Status</th><th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Actions</th></tr></thead>
              <tbody>{employees.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()) || e.autoId.toLowerCase().includes(searchTerm.toLowerCase()) || e.role.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, showAllEmployees ? undefined : 5).map(e => {
                const ei = getEmployeeExpenseInfo(e);
                return (<tr key={e.id} className="border-t border-gray-800 hover:bg-gray-800/30 transition">
                  <td className="px-6 py-4 font-mono text-cyan-400">{e.autoId}</td><td className="px-6 py-4 font-semibold">{e.name}</td><td className="px-6 py-4"><span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-semibold">{e.role}</span></td><td className="px-6 py-4 hidden xl:table-cell text-gray-400">{e.department || '—'}</td>
                  <td className="px-6 py-4 font-semibold text-yellow-400">₹{(e.salary || 0).toLocaleString()}</td><td className="px-6 py-4 text-gray-400 hidden md:table-cell">{e.phone}</td>
                  <td className="px-6 py-4 hidden lg:table-cell"><span className="text-emerald-400 font-semibold">₹{ei.totalPaid.toLocaleString()}</span><p className="text-xs text-gray-400">{ei.expenseCount} expenses</p></td>
                  <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-xs font-semibold ${e.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{e.status}</span></td>
                  <td className="px-6 py-4">{!isReadOnly && <div className="flex gap-2"><button onClick={() => openEditModal(e, 'employee')} className="text-cyan-400 hover:text-cyan-300 p-1 hover:bg-cyan-500/20 rounded" title="Edit employee"><FiEdit2 size={18} /></button><button onClick={() => exportEmployeeSalarySlip(e)} className="text-yellow-400 hover:text-yellow-300 p-1 hover:bg-yellow-500/20 rounded" title="Download Salary Slip"><FiDollarSign size={18} /></button><button onClick={() => exportEmployeeOfferPDF(e)} className="text-emerald-400 hover:text-emerald-300 p-1 hover:bg-emerald-500/20 rounded" title="Offer PDF"><FiFileText size={18} /></button><button onClick={() => handleDelete(e.id!, 'employee')} className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/20 rounded" title="Delete employee"><FiTrash2 size={18} /></button></div>}{isReadOnly && <FiEye className="text-gray-600" size={16} />}</td>
                </tr>);
              })}</tbody>
            </table></div></div>
            {employees.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()) || e.autoId.toLowerCase().includes(searchTerm.toLowerCase()) || e.role.toLowerCase().includes(searchTerm.toLowerCase())).length > 5 && <div className="text-center"><p className="text-gray-400 text-sm mb-3">{showAllEmployees ? 'Showing all' : `Showing 5 of ${employees.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()) || e.autoId.toLowerCase().includes(searchTerm.toLowerCase()) || e.role.toLowerCase().includes(searchTerm.toLowerCase())).length}`}</p><button onClick={() => setShowAllEmployees(!showAllEmployees)} className="px-6 py-2 bg-[#1E1E1E] border border-gray-800 hover:border-cyan-500/50 rounded-xl text-cyan-400">{showAllEmployees ? 'Show Less' : `View All ${employees.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()) || e.autoId.toLowerCase().includes(searchTerm.toLowerCase()) || e.role.toLowerCase().includes(searchTerm.toLowerCase())).length}`}</button></div>}
            {employees.length === 0 && <div className="bg-[#1E1E1E] rounded-2xl border border-gray-800 p-12 text-center"><div className="text-6xl mb-4">💼</div><h3 className="text-xl font-bold mb-2">No Employees Found</h3><p className="text-gray-400 mb-6">Add your first employee</p>{!isReadOnly && <button onClick={openAddModal} className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 rounded-xl font-semibold"><FiPlus size={18} />Add Employee</button>}</div>}
          </div>
        )}


        {activeTab === 'equipments' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#1E1E1E] p-4 rounded-xl border border-gray-800"><p className="text-gray-400 text-xs">Total Equipments</p><p className="text-2xl font-bold text-cyan-400">{equipments.length}</p></div>
              <div className="bg-[#1E1E1E] p-4 rounded-xl border border-gray-800"><p className="text-gray-400 text-xs">Assigned</p><p className="text-2xl font-bold text-emerald-400">{equipments.filter(e => e.status === 'Assigned').length}</p></div>
              <div className="bg-[#1E1E1E] p-4 rounded-xl border border-gray-800"><p className="text-gray-400 text-xs">Pending Assignment</p><p className="text-2xl font-bold text-yellow-400">{equipments.filter(e => e.status === 'Pending' || ((e.assignedToType === 'student' || e.assignedToType === 'teacher') && !e.assignedToId)).length}</p></div>
              <div className="bg-[#1E1E1E] p-4 rounded-xl border border-gray-800"><p className="text-gray-400 text-xs">Total Value</p><p className="text-2xl font-bold text-purple-400">₹{equipments.reduce((sum, e) => sum + (e.value || 0) * (e.quantity || 1), 0).toLocaleString()}</p></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[#1E1E1E] p-6 rounded-2xl border border-gray-800">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><FiPieChart className="text-cyan-400" />Equipment by Assignment Type</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={equipmentTypeChartData.length > 0 ? equipmentTypeChartData : [{ name: 'No Data', value: 1 }]}
                      cx="50%" cy="50%" outerRadius={90} dataKey="value"
                      label={({ name, value, x, y }: any) => (<text x={x} y={y} fill="#ffffff" fontSize={12} textAnchor="middle" dominantBaseline="central">{`${name}: ${Number(value || 0)}`}</text>)}
                    >
                      {(equipmentTypeChartData.length > 0 ? equipmentTypeChartData : [{ name: 'No Data', value: 1 }]).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1E1E1E', border: '1px solid #333' }} formatter={(value: any) => [String(Number(value || 0)), 'Items']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-[#1E1E1E] p-6 rounded-2xl border border-gray-800">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><FiBarChart2 className="text-cyan-400" />Equipment Condition</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={equipmentConditionChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="name" stroke="#666" />
                    <YAxis stroke="#666" allowDecimals={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#1E1E1E', border: '1px solid #333' }} formatter={(value: any) => [String(Number(value || 0)), 'Items']} cursor={{ fill: '#ffffff10' }} />
                    <Bar dataKey="value" name="Items" fill="#00f5d4" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1 relative"><FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" /><input placeholder="Search equipment, assignee, category..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-[#1E1E1E] border border-gray-800 rounded-xl focus:outline-none focus:border-cyan-500 transition" /></div>
                <div className="flex flex-wrap gap-2">{!isReadOnly && <button onClick={openAddModal} className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 px-5 py-3 rounded-xl font-semibold shadow-lg shadow-cyan-500/20"><FiPlus size={18} />Add Equipment</button>}<button onClick={() => exportToExcel(equipments, 'Equipments')} className={searchBtn + ' hover:border-emerald-500/50'}><FiDownload size={18} />Excel</button><button onClick={() => exportToPDF(equipments, 'Equipments Report')} className={searchBtn + ' hover:border-red-500/50'}><FiFileText size={18} />PDF</button>{!isReadOnly && <label className={searchBtn + ' hover:border-yellow-500/50 cursor-pointer'}><FiUpload size={18} />Import<input type="file" accept=".xlsx,.xls" onChange={importFromExcel} className="hidden" /></label>}</div>
              </div>

              <div className="bg-[#1E1E1E] border border-gray-800 rounded-2xl p-5">
                <div className="flex flex-col lg:flex-row gap-4 lg:items-end">
                  <div className="flex-1">
                    <label className="text-xs text-cyan-400">Check Equipment Assigned To</label>
                    <select value={equipmentPersonTypeFilter} onChange={e => { setEquipmentPersonTypeFilter(e.target.value as 'all' | 'student' | 'teacher'); setEquipmentPersonIdFilter(''); }} className="w-full mt-1 p-3 bg-gray-800 rounded-lg border border-gray-700 text-white">
                      <option value="all">-- Select Type --</option>
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                    </select>
                  </div>
                  {equipmentPersonTypeFilter === 'student' && <div className="flex-[2]"><label className="text-xs text-cyan-400">Select Student</label><select value={equipmentPersonIdFilter} onChange={e => setEquipmentPersonIdFilter(e.target.value)} className="w-full mt-1 p-3 bg-gray-800 rounded-lg border border-gray-700 text-white"><option value="">-- Select Student --</option>{students.map(s => <option key={s.id} value={s.autoId}>{s.class} | {s.autoId} - {s.name}</option>)}</select></div>}
                  {equipmentPersonTypeFilter === 'teacher' && <div className="flex-[2]"><label className="text-xs text-cyan-400">Select Teacher</label><select value={equipmentPersonIdFilter} onChange={e => setEquipmentPersonIdFilter(e.target.value)} className="w-full mt-1 p-3 bg-gray-800 rounded-lg border border-gray-700 text-white"><option value="">-- Select Teacher --</option>{employees.map(emp => <option key={emp.id} value={emp.autoId}>{emp.autoId} - {emp.name} ({emp.role})</option>)}</select></div>}
                </div>
                {equipmentPersonIdFilter && <div className="mt-5">{selectedPersonEquipments.length > 0 ? <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4"><p className="text-emerald-400 font-bold">{selectedEquipmentPerson?.name || 'Selected person'} has {selectedPersonEquipments.length} equipment item(s).</p><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">{selectedPersonEquipments.map(eq => { const Icon = getEquipmentIcon(eq.assignedToType); return <div key={eq.id} className="bg-gray-800/70 border border-gray-700 rounded-xl p-4"><div className="flex items-center gap-3"><div className="p-2 bg-cyan-500/20 rounded-lg"><Icon className="text-cyan-400" size={18} /></div><div><p className="font-semibold text-white">{eq.name}</p><p className="text-xs text-cyan-400 font-mono">{eq.autoId}</p><p className="text-xs text-gray-400">Qty: {eq.quantity} • {eq.condition}</p></div></div></div>; })}</div></div> : <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4"><p className="text-red-400 font-bold">{selectedEquipmentPerson?.name || 'Selected person'} has no equipment assigned.</p></div>}</div>}
              </div>
            </div>

            <div className="bg-[#1E1E1E] rounded-2xl border border-gray-800 overflow-hidden"><div className="overflow-x-auto"><table className="w-full">
              <thead className="bg-gray-800/50"><tr><th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Equipment</th><th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Type</th><th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Assigned To</th><th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Qty</th><th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Condition</th><th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Value</th><th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Status</th><th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Actions</th></tr></thead>
              <tbody>{equipments.filter(eq => eq.name.toLowerCase().includes(searchTerm.toLowerCase()) || eq.autoId.toLowerCase().includes(searchTerm.toLowerCase()) || eq.category.toLowerCase().includes(searchTerm.toLowerCase()) || (eq.assignedToName || '').toLowerCase().includes(searchTerm.toLowerCase()) || eq.assignedToType.toLowerCase().includes(searchTerm.toLowerCase())).map(eq => { const Icon = getEquipmentIcon(eq.assignedToType); return (
                <tr key={eq.id} className="border-t border-gray-800 hover:bg-gray-800/30 transition">
                  <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="p-2 bg-cyan-500/20 rounded-lg"><Icon className="text-cyan-400" size={18} /></div><div><p className="font-semibold">{eq.name}</p><p className="text-xs text-cyan-400 font-mono">{eq.autoId}</p><p className="text-xs text-gray-500">{eq.category}</p></div></div></td>
                  <td className="px-6 py-4 capitalize"><span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs font-semibold">{eq.assignedToType}</span></td>
                  <td className="px-6 py-4"><p className="font-medium">{eq.assignedToName || '—'}</p>{eq.assignedToId && <p className="text-xs text-gray-500">{eq.assignedToId}</p>}</td>
                  <td className="px-6 py-4 font-semibold">{eq.quantity}</td>
                  <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs font-semibold ${eq.condition === 'New' || eq.condition === 'Good' ? 'bg-emerald-500/20 text-emerald-400' : eq.condition === 'Repair Needed' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>{eq.condition}</span></td>
                  <td className="px-6 py-4 font-semibold text-yellow-400">₹{((eq.value || 0) * (eq.quantity || 1)).toLocaleString()}</td>
                  <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-xs font-semibold ${eq.status === 'Available' ? 'bg-cyan-500/20 text-cyan-400' : eq.status === 'Assigned' ? 'bg-emerald-500/20 text-emerald-400' : eq.status === 'Pending' || ((eq.assignedToType === 'student' || eq.assignedToType === 'teacher') && !eq.assignedToId) ? 'bg-yellow-500/20 text-yellow-400' : eq.status === 'In Repair' ? 'bg-orange-500/20 text-orange-400' : 'bg-gray-500/20 text-gray-400'}`}>{(eq.status === 'Pending' || ((eq.assignedToType === 'student' || eq.assignedToType === 'teacher') && !eq.assignedToId)) ? 'Pending' : eq.status}</span></td>
                  <td className="px-6 py-4">{!isReadOnly && <div className="flex gap-2"><button onClick={() => openEditModal(eq, 'equipment')} className="text-cyan-400 hover:text-cyan-300 p-1 hover:bg-cyan-500/20 rounded"><FiEdit2 size={18} /></button><button onClick={() => handleDelete(eq.id!, 'equipment')} className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/20 rounded"><FiTrash2 size={18} /></button></div>}{isReadOnly && <FiEye className="text-gray-600" size={16} />}</td>
                </tr>
              ); })}</tbody>
            </table></div></div>
          </div>
        )}

        {activeTab === 'expenses' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#1E1E1E] p-4 rounded-xl border border-gray-800"><p className="text-gray-400 text-xs">Total Expenses</p><p className="text-2xl font-bold text-red-400">₹{expenses.reduce((s, e) => s + e.amount, 0).toLocaleString()}</p></div>
              <div className="bg-[#1E1E1E] p-4 rounded-xl border border-gray-800"><p className="text-gray-400 text-xs">Paid</p><p className="text-2xl font-bold text-emerald-400">₹{expenses.filter(e => e.status === 'paid').reduce((s, e) => s + e.amount, 0).toLocaleString()}</p></div>
              <div className="bg-[#1E1E1E] p-4 rounded-xl border border-gray-800"><p className="text-gray-400 text-xs">Pending</p><p className="text-2xl font-bold text-yellow-400">₹{expenses.filter(e => e.status === 'pending').reduce((s, e) => s + e.amount, 0).toLocaleString()}</p></div>
              <div className="bg-[#1E1E1E] p-4 rounded-xl border border-gray-800"><p className="text-gray-400 text-xs">Employee-Linked</p><p className="text-2xl font-bold text-cyan-400">{expenses.filter(e => e.employeeId).length}</p></div>
            </div>
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative"><FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" /><input placeholder="Search description or ID..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-[#1E1E1E] border border-gray-800 rounded-xl focus:outline-none focus:border-cyan-500 transition" /></div>
              <div className="flex flex-wrap gap-2">{!isReadOnly && <button onClick={openAddModal} className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 px-5 py-3 rounded-xl font-semibold shadow-lg shadow-cyan-500/20"><FiPlus size={18} />Add Expense</button>}<button onClick={() => exportToExcel(expenses, 'Expenses')} className={searchBtn + ' hover:border-emerald-500/50'}><FiDownload size={18} />Excel</button><button onClick={() => exportExpenseReportPDF()} className={searchBtn + ' hover:border-red-500/50'}><FiFileText size={18} />PDF</button></div>
            </div>
            <div className="bg-[#1E1E1E] rounded-2xl border border-gray-800 overflow-hidden"><div className="overflow-x-auto"><table className="w-full">
              <thead className="bg-gray-800/50"><tr><th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Auto ID</th><th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Category</th><th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Amount</th><th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Paid To</th><th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap hidden md:table-cell">Date</th><th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Status</th><th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Bill</th><th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Actions</th></tr></thead>
              <tbody>{expenses.filter(e => e.description.toLowerCase().includes(searchTerm.toLowerCase()) || e.autoId.toLowerCase().includes(searchTerm.toLowerCase()) || e.category.toLowerCase().includes(searchTerm.toLowerCase()) || e.paidTo.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, showAllExpenses ? undefined : 5).map(e => (
                <tr key={e.id} className="border-t border-gray-800 hover:bg-gray-800/30 transition">
                  <td className="px-6 py-4 font-mono text-cyan-400">{e.autoId}</td><td className="px-6 py-4"><span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs font-semibold">{e.category}</span></td><td className="px-6 py-4 font-semibold">₹{e.amount.toLocaleString()}</td>
                  <td className="px-6 py-4">{e.paidTo}{e.employeeId && <span className="ml-2 text-xs text-cyan-400">🔗 Linked</span>}</td><td className="px-6 py-4 text-gray-400 hidden md:table-cell">{e.date}</td>
                  <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-xs font-semibold ${e.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{e.status}</span></td>
                  <td className="px-6 py-4">{e.billUrl && <button onClick={() => previewBill(e.billUrl!)} className="text-cyan-400 hover:text-cyan-300"><FiImage size={18} /></button>}</td>
                  <td className="px-6 py-4">{!isReadOnly && <div className="flex gap-2"><button onClick={() => openEditModal(e, 'expense')} className="text-cyan-400 hover:text-cyan-300 p-1 hover:bg-cyan-500/20 rounded"><FiEdit2 size={18} /></button><button onClick={() => handleDelete(e.id!, 'expense')} className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/20 rounded"><FiTrash2 size={18} /></button></div>}{isReadOnly && <FiEye className="text-gray-600" size={16} />}</td>
                </tr>
              ))}</tbody>
            </table></div></div>
            {expenses.filter(e => e.description.toLowerCase().includes(searchTerm.toLowerCase()) || e.autoId.toLowerCase().includes(searchTerm.toLowerCase()) || e.category.toLowerCase().includes(searchTerm.toLowerCase()) || e.paidTo.toLowerCase().includes(searchTerm.toLowerCase())).length > 5 && <div className="text-center"><p className="text-gray-400 text-sm mb-3">{showAllExpenses ? 'Showing all' : `Showing 5 of ${expenses.filter(e => e.description.toLowerCase().includes(searchTerm.toLowerCase()) || e.autoId.toLowerCase().includes(searchTerm.toLowerCase()) || e.category.toLowerCase().includes(searchTerm.toLowerCase()) || e.paidTo.toLowerCase().includes(searchTerm.toLowerCase())).length}`}</p><button onClick={() => setShowAllExpenses(!showAllExpenses)} className="px-6 py-2 bg-[#1E1E1E] border border-gray-800 hover:border-cyan-500/50 rounded-xl text-cyan-400">{showAllExpenses ? 'Show Less' : `View All ${expenses.filter(e => e.description.toLowerCase().includes(searchTerm.toLowerCase()) || e.autoId.toLowerCase().includes(searchTerm.toLowerCase()) || e.category.toLowerCase().includes(searchTerm.toLowerCase()) || e.paidTo.toLowerCase().includes(searchTerm.toLowerCase())).length}`}</button></div>}
          </div>
        )}

        {/* ===== SCHEDULE ===== */}
        {activeTab === 'schedule' && (
          <ScheduleSection
            employees={employees}
            students={students}
            schoolSettings={schoolSettings}
            showNotification={showNotification}
            addSubject={addSubject}
            getSubjects={getSubjects}
            updateSubject={updateSubject}
            deleteSubject={deleteSubject}
            saveTeacherSubjects={saveTeacherSubjects}
            getTeacherSubjects={getTeacherSubjects}
            deleteTeacherSubject={deleteTeacherSubject}
            saveTimetableEntries={saveTimetableEntries}
            getTimetableEntries={getTimetableEntries}
            deleteTimetableForClass={deleteTimetableForClass}
            deleteTimetableEntry={deleteTimetableEntry}
            saveSubjectConfig={saveSubjectConfig}
            getSubjectConfigs={getSubjectConfigs}
            deleteSubjectConfig={deleteSubjectConfig}
          />
        )}

        {/* ===== REMINDERS ===== */}
        {activeTab === 'reminders' && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#1E1E1E] p-4 rounded-xl border border-gray-800"><p className="text-gray-400 text-xs">Total Reminders</p><p className="text-2xl font-bold text-cyan-400">{reminders.length}</p></div>
              <div className="bg-[#1E1E1E] p-4 rounded-xl border border-gray-800"><p className="text-gray-400 text-xs">High Priority</p><p className="text-2xl font-bold text-red-400">{reminders.filter(r => r.priority === 'High').length}</p></div>
              <div className="bg-[#1E1E1E] p-4 rounded-xl border border-gray-800"><p className="text-gray-400 text-xs">Pending</p><p className="text-2xl font-bold text-yellow-400">{reminders.filter(r => r.status === 'Pending').length}</p></div>
              <div className="bg-[#1E1E1E] p-4 rounded-xl border border-gray-800"><p className="text-gray-400 text-xs">Completed</p><p className="text-2xl font-bold text-emerald-400">{reminders.filter(r => r.status === 'Completed').length}</p></div>
            </div>
            {/* Toolbar */}
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative"><FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" /><input placeholder="Search reminders..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-[#1E1E1E] border border-gray-800 rounded-xl focus:outline-none focus:border-cyan-500 transition" /></div>
              <button onClick={openAddModal} className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 px-5 py-3 rounded-xl font-semibold shadow-lg shadow-cyan-500/20"><FiPlus size={18} />Add Reminder</button>
            </div>
            {/* Reminders List */}
            <div className="bg-[#1E1E1E] rounded-2xl border border-gray-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-800/50">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Title</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap hidden md:table-cell">Type</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Date & Time</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Priority</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Status</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reminders.filter(r => r.title.toLowerCase().includes(searchTerm.toLowerCase()) || r.type.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                      <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500"><FiBell size={32} className="mx-auto mb-3 opacity-50" /><p>No reminders found. Click "Add Reminder" to create one.</p></td></tr>
                    ) : reminders.filter(r => r.title.toLowerCase().includes(searchTerm.toLowerCase()) || r.type.toLowerCase().includes(searchTerm.toLowerCase())).map(r => (
                      <tr key={r.id} className="border-t border-gray-800 hover:bg-gray-800/30 transition">
                        <td className="px-6 py-4">
                          <p className="font-semibold">{r.title}</p>
                          {r.description && <p className="text-xs text-gray-400 mt-1 truncate max-w-xs">{r.description}</p>}
                        </td>
                        <td className="px-6 py-4 hidden md:table-cell"><span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-semibold">{r.type}</span></td>
                        <td className="px-6 py-4">
                          <p className="text-sm flex items-center gap-1"><FiCalendar size={12} className="text-gray-500" />{r.date || '—'}</p>
                          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><FiClock size={10} />{r.time || '—'}</p>
                        </td>
                        <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-xs font-semibold ${r.priority === 'High' ? 'bg-red-500/20 text-red-400' : r.priority === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{r.priority}</span></td>
                        <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-xs font-semibold ${r.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-400' : r.status === 'Pending' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-500/20 text-gray-400'}`}>{r.status}</span></td>
                        <td className="px-6 py-4"><div className="flex gap-2"><button onClick={() => openEditModal(r, 'reminder')} className="text-cyan-400 hover:text-cyan-300 p-1 hover:bg-cyan-500/20 rounded"><FiEdit2 size={16} /></button><button onClick={() => handleDelete(r.id!, 'reminder')} className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/20 rounded"><FiTrash2 size={16} /></button></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}


        {/* ===== CORRECTION / RE-SEQUENCE ===== */}
        {activeTab === 'correction' && (
          <CorrectionSection
            students={students}
            employees={employees}
            fees={fees}
            expenses={expenses}
            equipments={equipments}
            classes={classes}
            isReadOnly={isReadOnly}
            showNotification={showNotification}
            updateStudent={updateStudent}
            updateEmployee={updateEmployee}
            updateFee={updateFee}
            updateExpense={updateExpense}
            updateEquipment={updateEquipment}
            loadData={loadData}
            updateStudentAutoIdReferences={updateStudentAutoIdReferences}
          />
        )}


        {/* ===== REPORTS ===== */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            {/* Section Title */}
            <div className="flex items-center gap-2">
              <FiPieChart className="text-cyan-400" size={24} />
              <h2 className="text-xl font-bold">Comprehensive Analytics</h2>
            </div>

            {/* Row 1: 8 Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#1E1E1E] p-5 rounded-xl border border-gray-800">
                <div className="flex items-center justify-between mb-2"><FiUsers className="text-cyan-400" size={20} /><span className="text-xs text-emerald-400">{students.length} total</span></div>
                <p className="text-gray-400 text-xs">Active Students</p>
                <p className="text-2xl font-bold text-white">{stats.activeStudents}</p>
              </div>
              <div className="bg-[#1E1E1E] p-5 rounded-xl border border-gray-800">
                <div className="flex items-center justify-between mb-2"><FiBriefcase className="text-blue-400" size={20} /><span className="text-xs text-emerald-400">{employees.length} total</span></div>
                <p className="text-gray-400 text-xs">Active Employees</p>
                <p className="text-2xl font-bold text-white">{stats.activeEmployees}</p>
              </div>
              <div className="bg-[#1E1E1E] p-5 rounded-xl border border-gray-800">
                <div className="flex items-center justify-between mb-2"><FiDollarSign className="text-yellow-400" size={20} /><span className="text-xs text-emerald-400">Collected</span></div>
                <p className="text-gray-400 text-xs">Total Fees ({cy})</p>
                <p className="text-2xl font-bold text-white">₹{stats.collectedFees.toLocaleString()}</p>
              </div>
              <div className="bg-[#1E1E1E] p-5 rounded-xl border border-gray-800">
                <div className="flex items-center justify-between mb-2"><FiTrendDown className="text-red-400" size={20} /><span className="text-xs text-red-400">Spent</span></div>
                <p className="text-gray-400 text-xs">Total Expenses ({cy})</p>
                <p className="text-2xl font-bold text-white">₹{stats.totalExpenses.toLocaleString()}</p>
              </div>
              <div className="bg-[#1E1E1E] p-5 rounded-xl border border-gray-800">
                <div className="flex items-center justify-between mb-2"><FiTrendingUp className="text-emerald-400" size={20} /><span className="text-xs text-emerald-400">Net</span></div>
                <p className="text-gray-400 text-xs">Net Revenue</p>
                <p className={`text-2xl font-bold ${stats.netRevenue >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>₹{stats.netRevenue.toLocaleString()}</p>
              </div>
              <div className="bg-[#1E1E1E] p-5 rounded-xl border border-gray-800">
                <div className="flex items-center justify-between mb-2"><FiCheck className="text-emerald-400" size={20} /><span className="text-xs text-gray-500">{fees.filter(f => f.status === 'paid').length} fees</span></div>
                <p className="text-gray-400 text-xs">Pending Fees</p>
                <p className="text-2xl font-bold text-yellow-400">₹{cyFees.filter(f => f.status !== 'paid').reduce((s, f) => s + f.amount, 0).toLocaleString()}</p>
              </div>
              <div className="bg-[#1E1E1E] p-5 rounded-xl border border-gray-800">
                <div className="flex items-center justify-between mb-2"><FiUsers className="text-purple-400" size={20} /><span className="text-xs text-gray-500">Target</span></div>
                <p className="text-gray-400 text-xs">Collection Target</p>
                <p className="text-2xl font-bold text-cyan-400">₹{students.filter(s => s.status === 'ACTIVE').reduce((sum, s) => sum + (s.feeAmount || 0), 0).toLocaleString()}</p>
              </div>
              <div className="bg-[#1E1E1E] p-5 rounded-xl border border-gray-800">
                <div className="flex items-center justify-between mb-2"><FiBriefcase className="text-orange-400" size={20} /><span className="text-xs text-gray-500">Monthly</span></div>
                <p className="text-gray-400 text-xs">Salary Payout</p>
                <p className="text-2xl font-bold text-orange-400">₹{getEligibleSalaryEmployees().reduce((s, e) => s + (e.monthSalary?.[getMonthKey()] ?? (e.salary || 0)), 0).toLocaleString()}</p>
              </div>
            </div>

            {/* Row 2: Revenue vs Expenses (Area Chart) */}
            <div className="bg-[#1E1E1E] p-6 rounded-2xl border border-gray-800">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><FiBarChart2 className="text-cyan-400" />Revenue vs Expenses - {cy}</h3>
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="repFees" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00f5d4" stopOpacity={0.4} /><stop offset="95%" stopColor="#00f5d4" stopOpacity={0} /></linearGradient>
                    <linearGradient id="repExp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f72585" stopOpacity={0.4} /><stop offset="95%" stopColor="#f72585" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="month" stroke="#666" />
                  <YAxis stroke="#666" tickFormatter={formatCurrencyTick} />
                  <Tooltip contentStyle={{ backgroundColor: '#1E1E1E', border: '1px solid #333' }} formatter={formatCurrencyTooltipPair} />
                  <Legend />
                  <Area type="monotone" dataKey="fees" name="Fees Collected" stroke="#00f5d4" strokeWidth={3} fill="url(#repFees)" />
                  <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#f72585" strokeWidth={3} fill="url(#repExp)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Row 3: Two Charts Side by Side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bar Chart: Monthly Comparison */}
              <div className="bg-[#1E1E1E] p-6 rounded-2xl border border-gray-800">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><FiBarChart2 className="text-cyan-400" />Monthly Comparison</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="month" stroke="#666" />
                    <YAxis stroke="#666" tickFormatter={formatCurrencyTick} />
                    <Tooltip contentStyle={{ backgroundColor: '#1E1E1E', border: '1px solid #333' }} formatter={formatCurrencyTooltipPair} cursor={{ fill: '#ffffff10' }} />
                    <Legend />
                    <Bar dataKey="fees" name="Fees" fill="#00f5d4" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name="Expenses" fill="#f72585" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Pie Chart: Expense Categories */}
              <div className="bg-[#1E1E1E] p-6 rounded-2xl border border-gray-800">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><FiPieChart className="text-cyan-400" />Expense Breakdown</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={expenseCategories.length > 0 ? expenseCategories : [{ name: 'No Data', value: 1 }]} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value, x, y }: any) => (<text x={x} y={y} fill="#ffffff" fontSize={12} textAnchor="middle" dominantBaseline="central">{`${name}: ₹${Number(value || 0).toLocaleString()}`}</text>) }>
                      {expenseCategories.map((_: ExpenseCategory, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1E1E1E', border: '1px solid #333' }} formatter={formatCurrencyTooltip} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Row 4: Students by Class (Bar Chart) */}
            <div className="bg-[#1E1E1E] p-6 rounded-2xl border border-gray-800">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><FiUsers className="text-cyan-400" />Students by Class</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={[...new Set(students.filter(s => s.status === 'ACTIVE').map(s => s.class))].filter(Boolean).map(cls => ({ class: cls, count: students.filter(s => s.class === cls && s.status === 'ACTIVE').length }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="class" stroke="#666" />
                  <YAxis stroke="#666" allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#1E1E1E', border: '1px solid #333' }} cursor={{ fill: '#ffffff10' }} />
                  <Bar dataKey="count" name="Students" fill="#4361ee" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Row 5: Fee Collection Status (Pie) + Employee Roles (Bar) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[#1E1E1E] p-6 rounded-2xl border border-gray-800">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><FiDollarSign className="text-cyan-400" />Fee Collection Status</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={[
                      { name: 'Collected', value: stats.collectedFees },
                      { name: 'Pending', value: cyFees.filter(f => f.status !== 'paid').reduce((s, f) => s + f.amount, 0) }
                    ].filter(d => d.value > 0)} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value, x, y }: any) => (<text x={x} y={y} fill="#ffffff" fontSize={12} textAnchor="middle" dominantBaseline="central">{`${name}: ₹${Number(value || 0).toLocaleString()}`}</text>) }>
                      <Cell fill="#10b981" stroke="none" />
                      <Cell fill="#f59e0b" stroke="none" />
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1E1E1E', border: '1px solid #333' }} formatter={formatCurrencyTooltip} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-[#1E1E1E] p-6 rounded-2xl border border-gray-800">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><FiBriefcase className="text-cyan-400" />Employees by Role</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart layout="vertical" data={[...new Set(employees.map(e => e.role))].filter(Boolean).map(role => ({ role, count: employees.filter(e => e.role === role).length }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis type="number" stroke="#666" allowDecimals={false} />
                    <YAxis type="category" dataKey="role" stroke="#666" width={80} />
                    <Tooltip contentStyle={{ backgroundColor: '#1E1E1E', border: '1px solid #333' }} cursor={{ fill: '#ffffff10' }} />
                    <Bar dataKey="count" name="Employees" fill="#7b2cbf" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Export Buttons */}
            <div className="flex flex-wrap gap-3 pt-2 items-center">
              <button onClick={() => exportToExcel(students, 'Students')} className={searchBtn + ' hover:border-emerald-500/50'}><FiDownload size={18} />Students Excel</button>
              <button onClick={() => exportStudentPDF(students)} className={searchBtn + ' hover:border-red-500/50'}><FiFileText size={18} />Students PDF</button>
              <button onClick={() => exportToExcel(fees, 'Fees')} className={searchBtn + ' hover:border-emerald-500/50'}><FiDownload size={18} />Fees Excel</button>
              <button onClick={() => exportToExcel(expenses, 'Expenses')} className={searchBtn + ' hover:border-emerald-500/50'}><FiDownload size={18} />Expenses Excel</button>
              <button onClick={() => exportToExcel(employees, 'Employees')} className={searchBtn + ' hover:border-emerald-500/50'}><FiDownload size={18} />Employees Excel</button>
              <button onClick={() => exportFinancialReportPDF()} className="flex items-center gap-2 bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600 text-white px-4 py-3 rounded-xl text-sm font-semibold shadow-lg"><FiFileText size={16} />Financial Report (PDF)</button>
              <button onClick={() => exportEmployeeListPDF()} className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white px-4 py-3 rounded-xl text-sm font-semibold shadow-lg"><FiFileText size={16} />Employee List (PDF)</button>
              <button onClick={() => exportFeesCollectionReportPDF()} className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-4 py-3 rounded-xl text-sm font-semibold shadow-lg"><FiFileText size={16} />Fees Collection (PDF)</button>
            </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="h-[calc(100vh-180px)] -mx-8">
            <AIAssistant variant="page" />
          </div>
        )}
      </div>

      <AIAssistant />
    </div>
  );
};

export default App;


// ═══════════════════════════════════════════
// Correction Section — re-sequence AUTO IDs
// ═══════════════════════════════════════════

type CorrectionEntity = 'students' | 'employees' | 'fees' | 'expenses' | 'equipments';

interface CorrectionSectionProps {
  students: Student[];
  employees: Employee[];
  fees: Fee[];
  expenses: Expense[];
  equipments: Equipment[];
  classes: string[];
  isReadOnly: boolean;
  showNotification: (msg: string, type: 'success' | 'error') => void;
  updateStudent: (id: string, data: any) => Promise<void>;
  updateEmployee: (id: string, data: any) => Promise<void>;
  updateFee: (id: string, data: any) => Promise<void>;
  updateExpense: (id: string, data: any) => Promise<void>;
  updateEquipment: (id: string, data: any) => Promise<void>;
  loadData: () => Promise<void>;
  updateStudentAutoIdReferences: (oldAutoId: string, newAutoId: string, newName?: string) => Promise<void>;
}

const CorrectionSection: React.FC<CorrectionSectionProps> = ({
  students, employees, fees, expenses, equipments, classes, isReadOnly,
  showNotification, updateStudent, updateEmployee, updateFee,
  updateExpense, updateEquipment, loadData, updateStudentAutoIdReferences,
}) => {
  const [entityType, setEntityType] = useState<CorrectionEntity>('students');
  const [items, setItems] = useState<any[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const getSource = () => {
    switch (entityType) {
      case 'students':
        return students.map(s => ({
          firestoreId: s.id || '', autoId: s.autoId, name: s.name,
          class: s.class || '', rollNumber: s.rollNumber || '',
          _oldAutoId: s.autoId, _oldClass: s.class || '', _oldRoll: s.rollNumber || '',
        }));
      case 'employees':
        return employees.map(e => ({ firestoreId: e.id || '', autoId: e.autoId, name: e.name }));
      case 'fees':
        return fees.map(f => ({ firestoreId: f.id || '', autoId: f.autoId, name: f.studentName || f.autoId }));
      case 'expenses':
        return expenses.map(e => ({ firestoreId: e.id || '', autoId: e.autoId, name: e.paidTo || e.description || e.autoId }));
      case 'equipments':
        return equipments.map(eq => ({ firestoreId: eq.id || '', autoId: eq.autoId, name: eq.name }));
    }
  };

  useEffect(() => {
    setItems(getSource());
    setDirty(false);
    setFilterText('');
    setFilterClass('');
    setSelectedIds(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, students, employees, fees, expenses, equipments]);

  const filterable = entityType === 'students';
  const displayItems = filterable
    ? items.filter(item => {
        const matchText = !filterText ||
          item.name?.toLowerCase().includes(filterText.toLowerCase()) ||
          item.autoId?.toLowerCase().includes(filterText.toLowerCase()) ||
          item.class?.toLowerCase().includes(filterText.toLowerCase()) ||
          item.rollNumber?.toLowerCase().includes(filterText.toLowerCase());
        const matchClass = !filterClass || item.class === filterClass;
        return matchText && matchClass;
      })
    : items;

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    const all = displayItems.map(i => i.firestoreId);
    if (all.every(id => selectedIds.has(id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(all));
    }
  };

  const assignToSelected = () => {
    const prefix = entityType === 'students' ? 'STU-' :
      entityType === 'employees' ? 'EMP-' :
      entityType === 'fees' ? 'FEE-' :
      entityType === 'expenses' ? 'EXP-' : 'EQP-';
    const next = [...items];
    for (let i = 0; i < next.length; i++) {
      if (selectedIds.has(next[i].firestoreId)) {
        next[i] = { ...next[i], autoId: `${prefix}${i + 1}` };
      }
    }
    setItems(next);
    setDirty(true);
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    setDirty(true);
  };

  const handleDragStart = (index: number) => { setDragIndex(index); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop = (dropIndex: number) => {
    if (dragIndex === null || dragIndex === dropIndex) return;
    const next = [...items];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(dropIndex, 0, moved);
    setItems(next);
    setDirty(true);
    setDragIndex(null);
  };

  const updateField = (index: number, field: string, value: string) => {
    setItems(items.map((item, i) => i === index ? { ...item, [field]: value } : item));
    setDirty(true);
  };

  const autoResequence = () => {
    const prefix =
      entityType === 'students' ? 'STU-' :
      entityType === 'employees' ? 'EMP-' :
      entityType === 'fees' ? 'FEE-' :
      entityType === 'expenses' ? 'EXP-' : 'EQP-';
    const total = items.length;
    const next = items.map((item, i) => ({ ...item, autoId: `${prefix}${total - i}` }));
    setItems(next);
    setDirty(true);
  };

  const sortByAutoId = () => {
    const next = [...items].sort((a, b) => a.autoId?.localeCompare(b.autoId, undefined, { numeric: true }) ?? 0);
    setItems(next);
    setDirty(true);
  };

  const autoRollByClass = () => {
    const grouped: Record<string, number> = {};
    const next = items.map(item => {
      const cls = item.class || '';
      if (!cls) return { ...item, rollNumber: '' };
      const seq = (grouped[cls] || 0) + 1;
      grouped[cls] = seq;
      return { ...item, rollNumber: String(seq) };
    });
    setItems(next);
    setDirty(true);
  };

  const saveAll = async () => {
    if (isReadOnly) return showNotification('Read-only mode: cannot save', 'error');

    const ids = items.map(i => i.autoId);
    const dupes = ids.filter((id, idx) => ids.indexOf(id) !== idx);
    if (dupes.length > 0) {
      showNotification(`Duplicate AUTO IDs: ${[...new Set(dupes)].join(', ')}. Fix before saving.`, 'error');
      return;
    }

    setSaving(true);
    let success = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.firestoreId) continue;
      try {
        if (entityType === 'students') {
          const updates: any = { autoId: item.autoId, sortOrder: i };
          if (item.class !== item._oldClass) updates.class = item.class;
          if (item.rollNumber !== item._oldRoll) updates.rollNumber = item.rollNumber;
          await updateStudent(item.firestoreId, updates);
          if (item.autoId !== item._oldAutoId) {
            await updateStudentAutoIdReferences(item._oldAutoId, item.autoId, item.name);
          }
        } else {
          await (entityType === 'employees' ? updateEmployee :
                 entityType === 'fees' ? updateFee :
                 entityType === 'expenses' ? updateExpense : updateEquipment)
            (item.firestoreId, { autoId: item.autoId });
        }
        success++;
      } catch (e) {
        showNotification(`Failed to update ${item.name}: ${e}`, 'error');
      }
    }
    setSaving(false);

    if (success > 0) {
      setDirty(false);
      showNotification(`${success} record(s) updated`, 'success');
      await loadData();
    }
  };

  const allClasses = [...new Set(classes.concat(students.map(s => s.class)).filter(Boolean))].sort();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex-1">
          <label className="text-xs text-cyan-400 font-semibold mb-1 block">Select Entity Type</label>
          <select value={entityType} onChange={e => setEntityType(e.target.value as CorrectionEntity)}
            className="w-full sm:w-64 p-3 bg-[#1E1E1E] border border-gray-800 rounded-xl text-white focus:outline-none focus:border-cyan-500">
            <option value="students">Students</option>
            <option value="employees">Employees</option>
            <option value="fees">Fees</option>
            <option value="expenses">Expenses</option>
            <option value="equipments">Equipments</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={autoResequence}
            className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white px-5 py-3 rounded-xl font-semibold shadow-lg shadow-cyan-500/20">
            <FiRefreshCw size={16} />Auto Re-sequence
          </button>
          <button onClick={sortByAutoId}
            className="flex items-center gap-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white px-5 py-3 rounded-xl font-semibold shadow-lg shadow-pink-500/20">
            <FiArrowUp size={16} />Sort by AUTO ID
          </button>
          {selectedIds.size > 0 && (
            <button onClick={assignToSelected}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white px-5 py-3 rounded-xl font-semibold shadow-lg shadow-purple-500/20">
              <FiCheck size={16} />Assign ({selectedIds.size})
            </button>
          )}
          {entityType === 'students' && (
            <button onClick={autoRollByClass}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-5 py-3 rounded-xl font-semibold shadow-lg shadow-amber-500/20">
              <FiRefreshCw size={16} />Auto Roll No by Class
            </button>
          )}
          <button onClick={saveAll} disabled={!dirty || saving || isReadOnly}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold shadow-lg transition-all ${
              dirty && !saving && !isReadOnly
                ? 'bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white shadow-emerald-500/20'
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
            }`}>
            <FiCheck size={16} />{saving ? 'Saving...' : 'Save All Changes'}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 text-sm flex-wrap">
        <span className="text-gray-400">{items.length} record(s)</span>
        {dirty && <span className="flex items-center gap-1 text-yellow-400"><FiAlertTriangle size={14} />Unsaved changes</span>}
        {filterable && (
          <>
            <select value={filterClass} onChange={e => { setFilterClass(e.target.value); setSelectedIds(new Set()); }}
              className="p-2 bg-[#1E1E1E] border border-gray-800 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500">
              <option value="">All Classes</option>
              {allClasses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="relative flex-1 max-w-xs">
              <input value={filterText} onChange={e => { setFilterText(e.target.value); setSelectedIds(new Set()); }}
                placeholder="Search students..."
                className="w-full p-2 pl-8 bg-[#1E1E1E] border border-gray-800 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500 placeholder-gray-500" />
              <FiSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            </div>
          </>
        )}
      </div>

      <div className="bg-[#1E1E1E] border border-gray-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-800/50">
                {filterable && (
                  <th className="px-2 py-3 w-10">
                    <input type="checkbox" checked={displayItems.length > 0 && displayItems.every(i => selectedIds.has(i.firestoreId))}
                      onChange={toggleSelectAll} className="accent-cyan-500 w-4 h-4 cursor-pointer" />
                  </th>
                )}
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 w-16">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 w-20">Move</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 w-36">AUTO ID</th>
                {entityType === 'students' && (
                  <><th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 w-40">Class</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 w-28">Roll No</th></>
                )}
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Name / Title</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={entityType === 'students' ? 7 : 4} className="px-4 py-12 text-center text-gray-500">No records found.</td></tr>
              ) : displayItems.map((item, i) => (
                <tr key={item.firestoreId || i}
                  draggable
                  onDragStart={() => handleDragStart(items.indexOf(item))}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(items.indexOf(item))}
                  className={`border-t border-gray-800 transition cursor-grab active:cursor-grabbing ${
                    selectedIds.has(item.firestoreId) ? 'bg-cyan-500/5' : 'hover:bg-gray-800/30'
                  } ${dragIndex === items.indexOf(item) ? 'opacity-50' : ''}`}>
                  {filterable && (
                    <td className="px-2 py-3">
                      <input type="checkbox" checked={selectedIds.has(item.firestoreId)}
                        onChange={() => toggleSelect(item.firestoreId)} className="accent-cyan-500 w-4 h-4 cursor-pointer" />
                    </td>
                  )}
                  <td className="px-4 py-3 text-gray-400 font-mono text-sm">{items.indexOf(item) + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => moveItem(i, -1)} disabled={i === 0}
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded disabled:opacity-20 disabled:cursor-not-allowed">
                        <FiChevronUp size={16} />
                      </button>
                      <button onClick={() => moveItem(i, 1)} disabled={i === items.length - 1}
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded disabled:opacity-20 disabled:cursor-not-allowed">
                        <FiChevronDown size={16} />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <input value={item.autoId} onChange={e => updateField(i, 'autoId', e.target.value)}
                      className={`w-full p-2 bg-gray-800 rounded-lg border text-white font-mono text-sm focus:outline-none ${
                        items.some((x: any, xi: number) => xi !== i && x.autoId === item.autoId && item.autoId !== '')
                          ? 'border-red-500 text-red-400'
                          : 'border-gray-700 focus:border-cyan-500'
                      }`} />
                  </td>
                  {entityType === 'students' && (
                    <>
                      <td className="px-4 py-3">
                        <select value={item.class || ''} onChange={e => updateField(i, 'class', e.target.value)}
                          className="w-full p-2 bg-gray-800 rounded-lg border border-gray-700 text-white text-sm focus:outline-none focus:border-cyan-500">
                          <option value="">— Select Class —</option>
                          {allClasses.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input value={item.rollNumber} onChange={e => updateField(i, 'rollNumber', e.target.value)}
                          className="w-full p-2 bg-gray-800 rounded-lg border border-gray-700 text-white text-sm focus:outline-none focus:border-cyan-500" />
                      </td>
                    </>
                  )}
                  <td className="px-4 py-3 text-white text-sm">{item.name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Reorder items using the arrow buttons, then click <strong>Auto Re-sequence</strong> to assign sequential AUTO IDs,
        or edit any field directly. For students, changing the class or roll number will be reflected across Fees by Student
        and Fees &amp; Billing after saving. Click <strong>Save All Changes</strong> to persist to the database.
      </p>
    </div>
  );
};