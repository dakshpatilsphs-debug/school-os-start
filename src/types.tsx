export interface Student {
  id?: string; autoId: string; name: string; rollNumber: string; class: string;
  parentName: string; parentPhone: string; email: string; address: string;
  dateOfBirth: string; gender: string; admissionDate: string; status: string;
  package: string; feeAmount: number; emiMonths?: number;
  submittedDocuments?: string[];

  packageAmount?: number;
  discountType?: 'amount' | 'percent';
  discountValue?: number;
  discountAmount?: number;
  sortOrder?: number;
  secondaryAutoId?: string;

  inactiveDate?: string;
  deactivationReason?: string;
  refundAmount?: number;
  refundDescription?: string;
  refundDate?: string;
}

export interface Fee {
  id?: string; autoId: string; studentId: string; studentName: string; amount: number;
  type: string; dueDate: string; paidDate: string; status: 'paid' | 'pending' | 'overdue';
  description: string; billUrl?: string;

  originalAmount?: number;
  applyDiscount?: boolean;
  discountType?: 'amount' | 'percent';
  discountValue?: number;
  discountAmount?: number;
  payableAmount?: number;
  paymentAmount?: number;
  balanceAmount?: number;
  secondaryAutoId?: string;
  installmentMonths?: number;
  installmentIndex?: number;
}
export interface Expense {
  id?: string; autoId: string; category: string; amount: number; description: string;
  date: string; paidTo: string; employeeId?: string; status: 'paid' | 'pending'; billUrl?: string;
  salaryMonth?: string;
}
export interface Employee {
  id?: string;
  autoId: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  address: string;
  salary: number;
  joinDate: string;
  status: string;
  department?: string;
  bankAccount?: string;
  panTaxId?: string;

  oldSalary?: number;
  monthSalary?: Record<string, number>;
  salaryAutoRefresh?: boolean;
  salaryRefreshDay?: number;
  inactiveDate?: string;
  clQuota?: number;
  clAllowance?: number;
  otherDeduction?: number;
  monthDeduction?: Record<string, number>;
  hidden?: boolean;

}
export interface CausalLeave { id?: string; employeeId: string; date: string; reason: string; }

export interface Attendance {
  id?: string;
  personId: string;
  personName: string;
  personType: 'student' | 'employee';
  date: string;
  status: 'present' | 'late' | 'absent' | 'holiday';
  class?: string;
  role?: string;
  clStatus?: 'approved' | 'disapproved';
  causalLeaves?: CausalLeave[];
}



export interface Holiday {
  id?: string; date: string; name: string; type: 'manual' | 'sunday';
}

export const SchoolLogo = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="white" stopOpacity="0.95" />
        <stop offset="100%" stopColor="white" stopOpacity="0.75" />
      </linearGradient>
    </defs>
    {/* Shield background */}
    <path d="M12 2.2L3.2 6.8V12.5C3.2 16.1 6.1 19.4 12 21.5C17.9 19.4 20.8 16.1 20.8 12.5V6.8L12 2.2Z" fill="url(#logoGrad)" fillOpacity="0.18" stroke="white" strokeOpacity="0.85" strokeWidth="1.1" />
    {/* Book */}
    <path d="M7.2 9.2C7.2 9.2 9.0 8.1 12 8.1C15 8.1 16.8 9.2 16.8 9.2V15.2C16.8 15.2 15 14.1 12 14.1C9 14.1 7.2 15.2 7.2 15.2V9.2Z" fill="white" fillOpacity="0.96" />
    <path d="M12 8.1V14.1" stroke="white" strokeOpacity="0.35" strokeWidth="0.7" />
    {/* Graduation cap */}
    <path d="M12 4.8L6.2 7.6L12 10.4L17.8 7.6L12 4.8Z" fill="white" />
    <path d="M6.2 7.6V9.1L12 11.9L17.8 9.1V7.6" stroke="white" strokeOpacity="0.9" strokeWidth="0.7" fill="none" strokeLinejoin="round" />
  </svg>
);
// ===== Schedule/Timetable Types =====
export interface Subject {
  id?: string;
  name: string;
  code: string;
  description: string;
}

export interface TeacherSubject {
  id?: string;
  teacherId: string;
  teacherName: string;
  class: string;
  subjectIds: string[];
  subjectNames: string[];
}

export interface TimetableEntry {
  id?: string;
  class: string;
  day: string;
  period: number;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  startTime: string;
  endTime: string;
}

export interface SubjectConfig {
  id?: string;
  class: string;
  subjectId: string;
  subjectName: string;
  doubled: boolean;
  allowSameDay?: boolean;
  noTeacher?: boolean;
  periodsPerWeek?: number;
}

export interface PeriodSlot {
  period: number;
  startTime: string;
  endTime: string;
}

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export const DEFAULT_PERIODS: PeriodSlot[] = [
  { period: 1, startTime: '09:00', endTime: '09:40' },
  { period: 2, startTime: '09:40', endTime: '10:20' },
  { period: 3, startTime: '10:20', endTime: '11:00' },
  { period: 4, startTime: '11:15', endTime: '11:55' },
  { period: 5, startTime: '11:55', endTime: '12:35' },
  { period: 6, startTime: '12:35', endTime: '13:15' },
  { period: 7, startTime: '14:00', endTime: '14:40' },
  { period: 8, startTime: '14:40', endTime: '15:20' },
];

export interface Equipment {
  id?: string;
  autoId: string;
  name: string;
  category: string;
  assignedToType: 'student' | 'teacher' | 'event' | 'school' | 'other';
  assignedToId?: string;
  assignedToName: string;
  quantity: number;
  condition: 'New' | 'Good' | 'Repair Needed' | 'Damaged' | 'Lost';
  purchaseDate: string;
  value: number;
  status: 'Pending' | 'Available' | 'Assigned' | 'In Repair' | 'Retired';
  notes: string;
}