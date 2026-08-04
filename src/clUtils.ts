import { Attendance, Employee, Holiday } from './types';

// CL rules (manual approval system):
// - CL quota is per academic year (June–May). Unused CL carries forward month to month.
// - An absent day marked "approved" consumes 1 CL day and is NOT salary-deducted.
// - An absent day marked "disapproved" IS salary-deducted, no CL used.
// - A "late" mark consumes 0.5 CL and counts as a present day for salary.
// - There is no per-month CL limit.
// - Migration: absences in PAST months that have no explicit decision are treated as
//   CL-covered (matches the old automatic-cover behaviour) so historical data still works.
//   Only current/future-month absences without a decision stay "pending".

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

// Total CL used by an employee from academic-year start through `monthKey` (inclusive).
// Late = 0.5, covered absence = 1.
export const getClUsedTotal = (empId: string, monthKey: string, attendance: Attendance[]): number => {
  const [y0, m0] = getClAcademicYearStart(monthKey).split('-').map(Number);
  const [y1, m1] = monthKey.split('-').map(Number);
  let used = 0;
  let y = y0, m = m0;
  while (y < y1 || (y === y1 && m <= m1)) {
    const mk = `${y}-${String(m).padStart(2, '0')}`;
    for (const a of attendance) {
      if (a.personId === empId && a.date.startsWith(mk)) {
        if (a.status === 'late') used += 0.5;
        else if (isClCovered(a, mk)) used += 1;
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
        if (a.status === 'late') used += 0.5;
        else if (isClCovered(a, mk)) used += 1;
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
  const late = records.filter(a => a.status === 'late').length;
  const clApproved = records.filter(a => isClCovered(a, monthKey)).length;
  const clDisapproved = records.filter(a => a.status === 'absent' && a.clStatus === 'disapproved').length;
  const pending = records.filter(a => isClPending(a, monthKey)).length;
  const absent = records.filter(a => a.status === 'absent' && !isClCovered(a, monthKey)).length;

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

  const clUsedThisMonth = clApproved + late * 0.5;
  return { records, present, late, absent, clApproved, clDisapproved, pending, workingDays, daysInMonth, clUsedThisMonth };
};
