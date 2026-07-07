export interface SchoolInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  logo?: string;
}

export interface EmployeeInfo {
  name: string;
  employeeId: string;
  designation: string;
  department: string;
  dateOfJoining: string;
  bankAccount: string;
  panTaxId?: string;
  bankName?: string;
}

export interface AttendanceInfo {
  workingDays: number;
  presentDays: number;
  absentDays: number;
  casualLeavesUsed: number;
  casualLeavesRemaining: number;
}

export interface SalaryInfo {
  monthlyGross: number;
  perDaySalary: number;
  earnedSalary: number;
  allowances: number;
  deductions: number;
}

export interface SalarySlipData {
  school: SchoolInfo;
  employee: EmployeeInfo;
  attendance: AttendanceInfo;
  salary: SalaryInfo;
  payPeriod: string;
}

export interface InfoRowProps {
  label: string;
  value: string | number;
}

export interface SalarySlipComponentProps {
  data: SalarySlipData;
}
