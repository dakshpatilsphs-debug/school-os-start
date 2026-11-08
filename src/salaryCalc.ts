export type DivisorMode = 'fixed30' | 'actualDays' | 'workingDays';

// Change this ONE line to change the rule everywhere
export const SALARY_DIVISOR_MODE: DivisorMode = 'fixed30';

const r2 = (n: number) => Math.round(n * 100) / 100;

export const getSalaryDivisor = (
  monthKey: string, // 'YYYY-MM'
  mode: DivisorMode = SALARY_DIVISOR_MODE,
  scheduledWorkingDays?: number
): number => {
  const [y, m] = monthKey.split('-').map(Number);
  if (mode === 'actualDays') return new Date(y, m, 0).getDate();
  if (mode === 'workingDays') return scheduledWorkingDays && scheduledWorkingDays > 0 ? scheduledWorkingDays : 26;
  return 30;
};

export interface CalcSalaryInput {
  monthlySalary: number;
  monthKey: string; // 'YYYY-MM'
  absentDays?: number; // unpaid full days (CL-approved already excluded)
  halfDays?: number; // count of half-day deductions (each = 0.5 day)
  otherDeduction?: number;
  mode?: DivisorMode;
  scheduledWorkingDays?: number;
}

export interface CalcSalaryOutput {
  divisor: number;
  perDay: number;
  deductionDays: number;
  leaveDeduction: number;
  otherDeduction: number;
  totalDeduction: number;
  netSalary: number;
}

export const calcSalary = (p: CalcSalaryInput): CalcSalaryOutput => {
  const divisor = getSalaryDivisor(p.monthKey, p.mode, p.scheduledWorkingDays);
  const perDay = p.monthlySalary / divisor; // never rounded before multiplying
  const deductionDays = Math.min((p.absentDays ?? 0) + (p.halfDays ?? 0) * 0.5, divisor);
  const leaveDeduction = r2(perDay * deductionDays);
  const otherDeduction = r2(p.otherDeduction ?? 0);
  const totalDeduction = r2(leaveDeduction + otherDeduction);
  const netSalary = Math.max(0, r2(p.monthlySalary - totalDeduction));
  return { divisor, perDay: r2(perDay), deductionDays, leaveDeduction, otherDeduction, totalDeduction, netSalary };
};
