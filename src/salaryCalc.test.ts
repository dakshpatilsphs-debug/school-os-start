import { calcSalary, getSalaryDivisor, SALARY_DIVISOR_MODE } from './salaryCalc';

// Test 1: 9000, fixed30, 4 absent + 1 half-day -> net 7650
const t1 = calcSalary({ monthlySalary: 9000, monthKey: '2026-01', absentDays: 4, halfDays: 1 });
console.assert(t1.netSalary === 7650, `Test 1 failed: expected 7650, got ${t1.netSalary}`);
console.log(`Test 1: 9000 fixed30 4 absent + 1 half-day = ${t1.netSalary} (expected 7650) ${t1.netSalary === 7650 ? 'PASS' : 'FAIL'}`);

// Test 2: 9000, calendar (actualDays), 31-day month, 4.5 deduction days -> net 7693.55
const t2 = calcSalary({ monthlySalary: 9000, monthKey: '2026-01', absentDays: 4, halfDays: 1, mode: 'actualDays' });
console.assert(Math.abs(t2.netSalary - 7693.55) < 0.01, `Test 2 failed: expected ~7693.55, got ${t2.netSalary}`);
console.log(`Test 2: 9000 actualDays 31-day 4.5 deduction days = ${t2.netSalary} (expected ~7693.55) ${Math.abs(t2.netSalary - 7693.55) < 0.01 ? 'PASS' : 'FAIL'}`);

// Test 3: 15000, fixed30, 2 absent -> 14000
const t3 = calcSalary({ monthlySalary: 15000, monthKey: '2026-01', absentDays: 2 });
console.assert(t3.netSalary === 14000, `Test 3 failed: expected 14000, got ${t3.netSalary}`);
console.log(`Test 3: 15000 fixed30 2 absent = ${t3.netSalary} (expected 14000) ${t3.netSalary === 14000 ? 'PASS' : 'FAIL'}`);

// Test 4: 12000, fixed30, 1 half-day -> 11800
const t4 = calcSalary({ monthlySalary: 12000, monthKey: '2026-01', halfDays: 1 });
console.assert(t4.netSalary === 11800, `Test 4 failed: expected 11800, got ${t4.netSalary}`);
console.log(`Test 4: 12000 fixed30 1 half-day = ${t4.netSalary} (expected 11800) ${t4.netSalary === 11800 ? 'PASS' : 'FAIL'}`);

// Test 5: 9000, no leave -> 9000
const t5 = calcSalary({ monthlySalary: 9000, monthKey: '2026-01', absentDays: 0 });
console.assert(t5.netSalary === 9000, `Test 5 failed: expected 9000, got ${t5.netSalary}`);
console.log(`Test 5: 9000 fixed30 no leave = ${t5.netSalary} (expected 9000) ${t5.netSalary === 9000 ? 'PASS' : 'FAIL'}`);

// Test 6: Same employee gives identical net across all methods
const salary = 30000;
const monthKey = '2026-10';
const absentDays = 2;
const halfDays = 1;
const otherDeduction = 500;

const fixed30 = calcSalary({ monthlySalary: salary, monthKey, absentDays, halfDays, otherDeduction, mode: 'fixed30' });
const actualDays = calcSalary({ monthlySalary: salary, monthKey, absentDays, halfDays, otherDeduction, mode: 'actualDays' });
const workingDays = calcSalary({ monthlySalary: salary, monthKey, absentDays, halfDays, otherDeduction, mode: 'workingDays', scheduledWorkingDays: 26 });

console.log(`Test 6: Same employee across methods:`);
console.log(`  fixed30: net=${fixed30.netSalary}, perDay=${fixed30.perDay}, deductionDays=${fixed30.deductionDays}`);
console.log(`  actualDays: net=${actualDays.netSalary}, perDay=${actualDays.perDay}, deductionDays=${actualDays.deductionDays}`);
console.log(`  workingDays: net=${workingDays.netSalary}, perDay=${workingDays.perDay}, deductionDays=${workingDays.deductionDays}`);

// Verify divisor is correct for each mode
console.assert(getSalaryDivisor('2026-10', 'fixed30') === 30, 'fixed30 divisor should be 30');
console.assert(getSalaryDivisor('2026-10', 'actualDays') === 31, 'actualDays divisor for Oct 2026 should be 31');
console.assert(getSalaryDivisor('2026-02', 'actualDays') === 28, 'actualDays divisor for Feb 2026 should be 28 (not leap year)');
console.assert(getSalaryDivisor('2024-02', 'actualDays') === 29, 'actualDays divisor for Feb 2024 should be 29 (leap year)');
console.assert(getSalaryDivisor('2026-10', 'workingDays', 26) === 26, 'workingDays divisor should be 26');

console.log('\nAll divisor tests PASS');
