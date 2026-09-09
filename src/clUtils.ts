import { Attendance, Employee, Holiday } from './types';

// CL rules (manual approval system) — updated for half-day (late) approval:
// - CL quota is per academic year (June–May). Unused CL carries forward month to month.
// - An absent day marked "approved" consumes 1 CL day and is NOT salary-deducted.
// - An absent day marked "disapproved" IS salary-deducted, no CL used.
// - A "late" (half-day) mark consumes 0.5 CL and requires approval:
//   - "approved" → 0.5 CL used, counts as present (no deduction)
//   - "disapproved" → 0 CL, half-day salary deducted (0.5 absent)
//   - No decision in PAST months → auto-covered (0.5 CL) for migration
//   - No decision in current/future months → pending (0.5 CL pending, shown for approval)
// - There is no per-month CL limit.

export const getCurrentMonthKey = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export const getClAcademicYearStart = (monthKey: string): string => {
  const [, month] = monthKey.split('-').map(Number);
  const year = parseInt(monthKey.substring(0, 4));
  const startYear = month >= 6 ? year : year - 1;
  return `${startYear}-06`;
};

export const getClAnnualQuota = (emp?: Employee | null): number => {
  const global = Math.max(0, parseInt(localStorage.getItem('clQuota') || '12'));
  return emp?.clQuota && emp.clQuota > 0 ? emp.clQuota : global;
};

// Is this absence day covered by CL (not salary-deducted)?
export const isClCovered = (a: Attendance, monthKey: string): boolean => {
  if (a.status !== 'absent') return false;
  if (a.clStatus === 'approved') return true;
  if (a.clStatus === 'disapproved') return false;
  return monthKey < getCurrentMonthKey();
};

// Is this absence day awaiting an approval decision (current/future month only)?
export const isClPending = (a: Attendance, monthKey: string): boolean =>
  a.status === 'absent' && !a.clStatus && monthKey >= getCurrentMonthKey();

// --- Half-day (late) helpers ---
export const isLateClCovered = (a: Attendance, monthKey: string): boolean => {
  if (a.status !== 'late') return false;
  if (a.clStatus === 'approved') return true;
  if (a.clStatus === 'disapproved') return false;
  // Past months without decision → auto-covered for migration (matches old 0.5 behavior)
  return monthKey < getCurrentMonthKey();
};

export const isLatePending = (a: Attendance, monthKey: string): boolean =>
  a.status === 'late' && !a.clStatus && monthKey >= getCurrentMonthKey();

export const isHalfDayCovered = isLateClCovered;
export const isHalfDayPending = isLatePending;

// Total CL used by an employee from academic-year start through `monthKey` (inclusive).
// Late approved/auto-covered = 0.5, covered absence = 1, pending not counted until approved.
export const getClUsedTotal = (empId: string, monthKey: string, attendance: Attendance[]): number => {
  const [y0, m0] = getClAcademicYearStart(monthKey).split('-').map(Number);
  const [y1, m1] = monthKey.split('-').map(Number);
  let used = 0;
  let y = y0, m = m0;
  while (y < y1 || (y === y1 && m <= m1)) {
    const mk = `${y}-${String(m).padStart(2, '0')}`;
    for (const a of attendance) {
      if (a.personId === empId && a.date.startsWith(mk)) {
        if (a.status === 'late') {
          if (isLateClCovered(a, mk)) used += 0.5;
        } else if (isClCovered(a, mk)) used += 1;
      }
    }
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return used;
};

// CL used in all months strictly BEFORE `monthKey` in the same academic year.
export const getClUsedBeforeMonth = (empId: string, monthKey: string, attendance: Attendance[]): number => {
  const [y0, m0] = getClAcademicYearStart(monthKey).split('-').map(Number);
  const [y1, m1] = monthKey.split('-').map(Number);
  let used = 0;
  let y = y0, m = m0;
  while (y < y1 || (y === y1 && m < m1)) {
    const mk = `${y}-${String(m).padStart(2, '0')}`;
    for (const a of attendance) {
      if (a.personId === empId && a.date.startsWith(mk)) {
        if (a.status === 'late') {
          if (isLateClCovered(a, mk)) used += 0.5;
        } else if (isClCovered(a, mk)) used += 1;
      }
    }
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return used;
};

// Attendance summary for one employee in one month (YYYY-MM).
export const getMonthAttSummary = (empId: string, monthKey: string, attendance: Attendance[], holidays?: Holiday[]) => {
  const records = attendance.filter(a => a.personId === empId && a.date.startsWith(monthKey));
  const present = records.filter(a => a.status === 'present').length;
  const lateTotal = records.filter(a => a.status === 'late').length;
  const lateApproved = records.filter(a => isLateClCovered(a, monthKey)).length;
  const lateDisapproved = records.filter(a => a.status === 'late' && a.clStatus === 'disapproved').length;
  const latePending = records.filter(a => isLatePending(a, monthKey)).length;
  // For backward compat, keep `late` as total late count
  const late = lateTotal;
  const clApproved = records.filter(a => isClCovered(a, monthKey)).length;
  const clDisapproved = records.filter(a => a.status === 'absent' && a.clStatus === 'disapproved').length;
  const pending = records.filter(a => isClPending(a, monthKey)).length;
  // Pending for half-days
  const pendingHalf = latePending;
  const totalPending = pending + pendingHalf;
  const absent = records.filter(a => a.status === 'absent' && !isClCovered(a, monthKey)).length;
  // Disapproved late counts as 0.5 absent for salary
  const halfDayDeduction = lateDisapproved * 0.5;

  const [year, month] = monthKey.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  let workingDays = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const ds = `${monthKey}-${String(day).padStart(2, '0')}`;
    const d = new Date(ds + 'T12:00:00');
    if (d.getDay() === 0) continue;
    if (holidays?.some(h => h && h.date === ds && h.type === 'manual')) continue;
    workingDays++;
  }

  const clUsedThisMonth = clApproved + lateApproved * 0.5;
  return {
    records,
    present,
    late, // total
    lateApproved,
    lateDisapproved,
    latePending,
    pendingHalf,
    absent,
    clApproved,
    clDisapproved,
    pending,
    totalPending,
    halfDayDeduction,
    workingDays,
    daysInMonth,
    clUsedThisMonth,
  };
};

export const getMonthDeductionInfo = (emp: Employee, monthKey: string): { amount: number; description: string } => {
  const raw = (emp as any).monthDeduction?.[monthKey];
  if (raw != null) {
    if (typeof raw === 'object' && raw !== null && 'amount' in raw) {
      return { amount: Number((raw as any).amount) || 0, description: String((raw as any).description || (emp as any).monthDeductionDesc?.[monthKey] || '') };
    }
    return { amount: Number(raw) || 0, description: String((emp as any).monthDeductionDesc?.[monthKey] || '') };
  }
  // Fallback to otherDeduction for current month display
  const otherAmt = Number((emp as any).otherDeduction) || 0;
  const otherDesc = String((emp as any).otherDeductionDesc || '');
  return { amount: otherAmt, description: otherDesc };
};

export const getEarnedSalaryForMonth = (emp: Employee, monthKey: string, attendance: Attendance[], holidays?: Holiday[], salaryOverride?: number): { earned: number; perDay: number; paidDays: number; deductions: number; workingDays: number } => {
  const summ = getMonthAttSummary(emp.autoId, monthKey, attendance, holidays);
  const monthlySalary = salaryOverride ?? emp.salary ?? 0;
  const perDay = summ.workingDays > 0 ? monthlySalary / summ.workingDays : 0;
  if (summ.records.length === 0) {
    return { earned: monthlySalary, perDay, paidDays: summ.workingDays, deductions: 0, workingDays: summ.workingDays };
  }
  const lateApproved = (summ as any).lateApproved ?? 0;
  const latePending = (summ as any).latePending ?? 0;
  const lateDisapproved = (summ as any).lateDisapproved ?? 0;
  const paidDays = summ.present + lateApproved + latePending + summ.clApproved;
  const earned = Math.round(paidDays * perDay);
  const halfDed = lateDisapproved * 0.5 * perDay;
  const fullDed = summ.absent * perDay;
  const deductions = Math.round(fullDed + halfDed);
  return { earned, perDay, paidDays, deductions, workingDays: summ.workingDays };
};
