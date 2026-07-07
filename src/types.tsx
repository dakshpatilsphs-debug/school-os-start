export interface Student {
  id?: string; autoId: string; name: string; rollNumber: string; class: string;
  parentName: string; parentPhone: string; email: string; address: string;
  dateOfBirth: string; gender: string; admissionDate: string; status: string;
  package: string; feeAmount: number;
  submittedDocuments?: string[];

  packageAmount?: number;
  discountType?: 'amount' | 'percent';
  discountValue?: number;
  discountAmount?: number;
}
export interface Fee {
  id?: string; autoId: string; studentId: string; studentName: string; amount: number;
  type: string; dueDate: string; paidDate: string; status: 'paid' | 'pending' | 'overdue';
  description: string; billUrl?: string;
}
export interface Expense {
  id?: string; autoId: string; category: string; amount: number; description: string;
  date: string; paidTo: string; employeeId?: string; status: 'paid' | 'pending'; billUrl?: string;
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

  salaryAutoRefresh?: boolean;
  salaryRefreshDay?: number;
  inactiveDate?: string;

  offerTitle?: string;
  offerIntro?: string;
  offerPoints?: string;
  offerTerms?: string;
  offerSignatory?: string;
}
export interface CausalLeave { id?: string; employeeId: string; date: string; reason: string; }

export interface Attendance {
  id?: string;
  personId: string;
  personName: string;
  personType: 'student' | 'employee';
  date: string;
  status: 'present' | 'absent' | 'holiday';
  class?: string;
  role?: string;
  causalLeaves?: CausalLeave[];
}



export interface Holiday {
  id?: string; date: string; name: string; type: 'manual' | 'sunday';
}
export interface Reminder {
  id?: string; title: string; description: string; date: string; time: string;
  type: string; priority: string; status: string;
}

export const SchoolLogo = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3z" fill="white" />
    <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z" fill="white" opacity="0.7" />
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