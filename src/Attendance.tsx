import React, { useState, useEffect } from 'react';
import {
  FiUsers, FiBriefcase, FiCalendar, FiCheck, FiX, FiPlus, FiTrash2, FiDollarSign, FiTrendingUp, FiUpload, FiDownload, FiFileText, FiEye, FiEyeOff, FiSliders, FiClock
} from 'react-icons/fi';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Employee, Attendance as Att, Holiday, Expense } from './types';
import type { SalarySlipData } from './salarySlipTypes';
import { getClAnnualQuota as getEmpClQuota, getClUsedTotal, getMonthAttSummary, isClCovered, isClPending, isLateClCovered, isLatePending, getMonthDeductionInfo } from './clUtils';
import { exportProperExcel } from './utils/excelHelper';
import { calcSalary } from './salaryCalc';

export interface AttendanceProps {
  employees: Employee[];
  attendance: Att[];
  holidays: Holiday[];
  expenses: Expense[];
  schoolSettings: any;
  isReadOnly?: boolean;
  saveAttendance: (record: any) => Promise<any>;
  addHoliday: (holiday: any) => Promise<any>;
  deleteHoliday: (id: string) => Promise<void>;
  showNotification: (msg: string, type: 'success' | 'error') => void;
  loadData: () => Promise<void>;
  logSalarySlipAudit?: (employeeId: string) => Promise<void>;
  updateEmployee: (id: string, data: any) => Promise<void>;
  handleDirectSalaryPay?: (expense: any) => Promise<void>;
  deleteSalaryExpenses?: (expenses: Expense[]) => Promise<void>;
}

export const AttendanceSection: React.FC<AttendanceProps> = ({
  employees, attendance, holidays, expenses, schoolSettings, isReadOnly,
  saveAttendance, addHoliday, deleteHoliday, showNotification, loadData,
  logSalarySlipAudit, updateEmployee, handleDirectSalaryPay, deleteSalaryExpenses
}) => {
  const [subTab, setSubTab] = useState<'employee' | 'holidays' | 'causalLeaves'>('employee');
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedMonthlyEmployeeId, setSelectedMonthlyEmployeeId] = useState('');
  const [salaryType, setSalaryType] = useState<'new' | 'old'>('new');
  const [editMonthSalary, setEditMonthSalary] = useState(false);
  const [monthSalaryInput, setMonthSalaryInput] = useState('');
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');
  const [directPay, setDirectPay] = useState<{ emp: Employee; amount: number } | null>(null);
  const [directPayAmount, setDirectPayAmount] = useState(0);
  const [directPaying, setDirectPaying] = useState(false);
  const [showSalaryCalc, setShowSalaryCalc] = useState(true);
  const [clQuota, setClQuota] = useState(12);
  const [clQuotaEdit, setClQuotaEdit] = useState(false);
  const [clQuotaInput, setClQuotaInput] = useState('12');
  const [clViewEmpId, setClViewEmpId] = useState('');

  const getLocalDateStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const getLocalMonthStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const isSunday = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.getDay() === 0;
  };

  const isManualHoliday = (dateStr: string, holidays: Holiday[]) => {
    return holidays.find(h => h.date === dateStr && h.type === 'manual');
  };

  const dateStatus = (dateStr: string): 'sunday' | 'manual-holiday' | 'working' => {
    if (isSunday(dateStr)) return 'sunday';
    if (isManualHoliday(dateStr, holidays)) return 'manual-holiday';
    return 'working';
  };

  const isHoliday = (dateStr: string) => dateStatus(dateStr) !== 'working';

  const handleAddHoliday = async () => {
    if (isReadOnly) { showNotification('Read-only mode: cannot add holiday', 'error'); return; }
    if (!newHolidayDate || !newHolidayName.trim()) {
      showNotification('Date and name required', 'error');
      return;
    }
    try {
      await addHoliday({ date: newHolidayDate, name: newHolidayName.toUpperCase(), type: 'manual' });
      await loadData();
      setNewHolidayDate('');
      setNewHolidayName('');
      showNotification('Holiday added', 'success');
    } catch (error) {
      showNotification('Failed to add holiday', 'error');
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    if (isReadOnly) { showNotification('Read-only mode: cannot delete', 'error'); return; }
    if (!confirm('Remove this holiday?')) return;
    try {
      await deleteHoliday(id);
      await loadData();
      showNotification('Holiday removed', 'success');
    } catch (error) {
      showNotification('Failed to remove holiday', 'error');
    }
  };

  const getMonthInfo = () => {
    const currentMonth = selectedMonth;
    const [year, month] = currentMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const monthName = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    return { currentMonth, year, month, daysInMonth, monthName };
  };

  const getMonthlyStatus = (personId: string, day: number, month?: string): string => {
    const currentMonth = month || getMonthInfo().currentMonth;
    const dateStr = `${currentMonth}-${day.toString().padStart(2, '0')}`;
    if (isHoliday(dateStr)) return 'H';
    const rec = attendance.find(a => a.personId === personId && a.date === dateStr);
    if (rec?.status === 'present') return 'P';
    if (rec?.status === 'late') return 'L';
    if (rec?.status === 'absent') return isClCovered(rec, currentMonth) ? 'C' : 'A';
    return '-';
  };

  const getSelectedMonthDays = () => {
    const currentMonth = selectedMonth;
    const [year, month] = currentMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
      return {
        day,
        dateStr,
        label: String(day).padStart(2, '0'),
        weekday: new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' }),
        isHoliday: isHoliday(dateStr),
      };
    });
  };

  const getMonthlyEmployeeStatus = (employeeId: string, dateStr: string) => {
    const record = attendance.find(
      a => a.personId === employeeId && a.date === dateStr && a.personType === 'employee'
    );
    if (isHoliday(dateStr)) return 'holiday';
    return record?.status || '';
  };

  const setMonthlyEmployeeAttendance = async (employee: Employee, dateStr: string, status: 'present' | 'late' | 'absent') => {
    if (isReadOnly) { showNotification('Read-only mode: cannot save attendance', 'error'); return; }
    if (isHoliday(dateStr)) { showNotification('Cannot mark attendance on a holiday', 'error'); return; }

    try {
      const existing = attendance.find(a => a.personId === employee.autoId && a.date === dateStr && a.personType === 'employee');
      await saveAttendance({
        personId: employee.autoId,
        personName: employee.name,
        personType: 'employee',
        date: dateStr,
        status,
        role: employee.role,
        ...(existing?.clStatus ? { clStatus: existing.clStatus } : {}),
      });
      await loadData();
      showNotification(`${employee.name} marked ${status} on ${dateStr}`, 'success');
    } catch (error) {
      showNotification('Failed to save attendance', 'error');
    }
  };

  const setClApproval = async (rec: Att, clStatus: 'approved' | 'disapproved') => {
    if (isReadOnly) { showNotification('Read-only mode: cannot update leave status', 'error'); return; }
    try {
      await saveAttendance({ ...rec, clStatus });
      await loadData();
      showNotification(
        clStatus === 'approved'
          ? 'Leave approved — CL will be used, no salary deduction'
          : 'Leave disapproved — salary will be deducted for this day',
        'success'
      );
    } catch (error) {
      showNotification('Failed to update leave status', 'error');
    }
  };

  const getEmployeeSalaryInfo = (employee: Employee) => {
    const currentMonth = selectedMonth;
    const summ = getMonthAttSummary(employee.autoId, currentMonth, attendance, holidays);

    const monthlySalary = salaryType === 'old'
      ? (employee.monthSalary?.[currentMonth] ?? employee.oldSalary ?? employee.salary)
      : employee.salary;

    const result = calcSalary({
      monthlySalary,
      monthKey: currentMonth,
      absentDays: summ.absent,
      halfDays: summ.lateDisapproved,
      otherDeduction: getMonthDeductionInfo(employee, currentMonth).amount,
      mode: 'fixed30',
    });

    return {
      presentDays: summ.present,
      lateDays: summ.late,
      absentDays: summ.absent,
      clCovered: summ.clApproved,
      paidDays: result.divisor - result.deductionDays,
      workingDays: summ.workingDays,
      monthlySalary,
      perDaySalary: result.perDay,
      earnedSalary: result.netSalary,
      deductions: result.totalDeduction,
      netSalary: result.netSalary,
      lateApproved: summ.lateApproved,
      latePending: summ.latePending,
      lateDisapproved: summ.lateDisapproved,
    };
  };

  const getSalarySlipDataForAttend = (emp: Employee, _clCount: number = 0): SalarySlipData => {
    const currentMonth = selectedMonth;
    const monthName = new Date(selectedMonth + '-01T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const info = getEmployeeSalaryInfo(emp);
    const annualQuota = getEmpClQuota(emp);
    const usedTotal = getClUsedTotal(emp.autoId, currentMonth, attendance);
    const remainingAnnual = Math.max(0, annualQuota - usedTotal);
    const perDaySalary = info.perDaySalary;
    const earnedSalary = info.earnedSalary;

    return {
      school: {
        name: (schoolSettings.schoolName || 'School OS').toUpperCase(),
        address: schoolSettings.address || '',
        phone: schoolSettings.phone || '',
        email: schoolSettings.email || '',
        logo: schoolSettings.schoolLogo || undefined,
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
        workingDays: info.workingDays,
        presentDays: info.presentDays,
        absentDays: info.absentDays,
        casualLeavesUsed: usedTotal,
        casualLeavesRemaining: remainingAnnual,
        lateApproved: (info as any).lateApproved ?? 0,
        latePending: (info as any).latePending ?? 0,
        lateDisapproved: (info as any).lateDisapproved ?? 0,
      },
      salary: {
        monthlyGross: info.monthlySalary,
        perDaySalary: perDaySalary,
        earnedSalary: earnedSalary,
        allowances: 0,
        deductions: info.deductions,
      },
      payPeriod: monthName,
    };
  };

  const exportSalarySlips = async (singleEmp?: Employee, salaryData?: SalarySlipData) => {
    const { currentMonth } = getMonthInfo();
    const activeEmps = singleEmp ? [singleEmp] : employees.filter(e => e.status === 'ACTIVE');
    if (activeEmps.length === 0) { showNotification('No employees found', 'error'); return; }

    try {
      const doc = new jsPDF();
      for (let idx = 0; idx < activeEmps.length; idx++) {
        const emp = activeEmps[idx];
        if (idx > 0) doc.addPage();
        let effectiveData = salaryData;
        if (!effectiveData) {
          effectiveData = getSalarySlipDataForAttend(emp, 0);
        }
        drawSalarySlip(doc, emp, currentMonth, getMonthInfo().monthName, 0, effectiveData);
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
      showNotification('Failed to generate salary slip PDF', 'error');
    }
  };

  const drawSalarySlip = (doc: any, emp: Employee, currentMonth: string, monthName: string, _clCount: number = 0, salaryData?: SalarySlipData) => {
    const summ = getMonthAttSummary(emp.autoId, currentMonth, attendance, holidays);
    const monthlySalary = salaryType === 'old'
      ? (emp.monthSalary?.[currentMonth] ?? emp.oldSalary ?? emp.salary)
      : emp.salary;

    const result = calcSalary({
      monthlySalary,
      monthKey: currentMonth,
      absentDays: summ.absent,
      halfDays: summ.lateDisapproved,
      otherDeduction: getMonthDeductionInfo(emp, currentMonth).amount,
      mode: 'fixed30',
    });

    const perDaySalary = result.perDay;
    const earnedSalary = result.netSalary;
    const annualQuota = getEmpClQuota(emp);
    const usedTotal = getClUsedTotal(emp.autoId, currentMonth, attendance);
    const remainingAnnual = Math.max(0, annualQuota - usedTotal);

    const schoolName = (schoolSettings.schoolName || 'School OS').toUpperCase();
    const schoolAddress = schoolSettings.address || '';
    const schoolPhone = schoolSettings.phone || '';
    const schoolEmail = schoolSettings.email || '';

    const pw = 210;
    const ML = 16;
    const MR = pw - 16;
    const CW = MR - ML;

    const sBorder = [226, 232, 240] as [number, number, number];
    const sText = [30, 41, 59] as [number, number, number];
    const sTextSec = [100, 116, 139] as [number, number, number];
    const sTextMuted = [148, 163, 184] as [number, number, number];
    const sPrimary = [14, 165, 233] as [number, number, number];
    const sPrimaryDark = [2, 132, 199] as [number, number, number];
    const sPrimaryLight = [224, 242, 254] as [number, number, number];
    const sPrimaryBg = [240, 249, 255] as [number, number, number];
    const sBgAlt = [248, 250, 252] as [number, number, number];
    const line = [229, 231, 235] as [number, number, number];
    const accent = [14, 165, 233] as [number, number, number];

    const padSm = 2;
    const padMd = 4;
    const padLg = 6.5;

    const money = (val: number) => 'Rs ' + Math.round(val || 0).toLocaleString('en-IN');

    let y = 20;
    let logoW = 0;
    if (schoolSettings.schoolLogo) {
      try { doc.addImage(schoolSettings.schoolLogo, 'PNG', ML, 13, 18, 18); logoW = 22; } catch (e) {}
    }
    const nameX = logoW > 0 ? ML + logoW : ML;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...sPrimaryDark);
    doc.text(trunc((schoolSettings.schoolName || 'School OS').toUpperCase(), 40), nameX, 19);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...sTextSec);
    doc.text(trunc([schoolAddress, schoolPhone, schoolEmail].filter(Boolean).join(' | '), 70), nameX, 25);
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...sTextSec);
    doc.text('PAY PERIOD:', MR, 15, { align: 'right' });
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...sText);
    doc.text(monthName, MR, 21.5, { align: 'right' });
    doc.setDrawColor(...sPrimary); doc.setLineWidth(0.5); doc.line(ML, 32, MR, 32);

    y = 39;
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

    const clAnnualQuota = getEmpClQuota(emp);
    const clUsedTotal = getClUsedTotal(emp.autoId, currentMonth, attendance);
    const clRemaining = Math.max(0, clAnnualQuota - clUsedTotal);

    drawCard(ML, 'EMPLOYEE DETAILS', [
      ['Employee ID', emp.autoId],
      ['Designation', emp.role || '-'],
      ['Working Days', summ.workingDays],
      ['Present Days', summ.present],
      ['Absent Days', summ.absent],
      ['CL Balance', `${clRemaining} / ${clAnnualQuota}`],
    ]);
    drawCard(ML + cardW + padLg, 'BANK & PAY DETAILS', [
      ['Department', emp.department || '-'],
      ['Date of Joining', emp.joinDate || '-'],
      ['Bank / Account No.', emp.bankAccount || emp.panTaxId || '-'],
      ['PAN / Tax ID', emp.panTaxId || '-'],
    ]);
    y = y + cardH + padMd + 2;

    const earnItems: [string, string][] = [
      ['Basic Salary', money(monthlySalary)],
      ['House Rent Allowance', 'Rs 0'],
      ['Travelling Allowance', 'Rs 0'],
      ['Medical Allowance', 'Rs 0'],
      ['Conveyance Allowance', 'Rs 0'],
    ];
    const deductInfoPdf = getMonthDeductionInfo(emp, currentMonth);
    const otherDed = getMonthDeductionInfo(emp, currentMonth).amount;
    const deductItems: [string, string][] = [
      ['EPF(%)', 'Rs 0'],
      ['PF(%)', 'Rs 0'],
      ['TDS', 'Rs 0'],
      ['Others(-)', money(otherDed)],
      ['PTAX', 'Rs 0'],
    ];
    const itemCount = Math.max(earnItems.length, deductItems.length);
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

    let sy2 = y + tBarH + 7;
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...sTextSec);
    doc.text('EARNINGS', earnX, sy2);
    doc.text('DEDUCTIONS', deductX, sy2);
    sy2 += 8.5;

    for (let i = 0; i < itemCount; i++) {
      if (i < earnItems.length) {
        doc.setFontSize(9.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...sTextSec);
        doc.text(earnItems[i][0], earnX, sy2);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...sText);
        doc.text(earnItems[i][1], earnX + colW - padLg * 2, sy2, { align: 'right' });
      }
      if (i < deductItems.length) {
        doc.setFontSize(9.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...sTextSec);
        doc.text(deductItems[i][0], deductX, sy2);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...sText);
        doc.text(deductItems[i][1], deductX + colW - padLg * 2, sy2, { align: 'right' });
      }
      sy2 += 8.5;
    }

    sy2 += padSm;

    doc.setDrawColor(...sBorder); doc.setLineWidth(0.12);
    doc.roundedRect(sumTableX, sy2, sumTableW, sumContH, 3, 3, 'S');
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(sumTableX, sy2, sumTableW, sumContH, 3, 3, 'F');
    doc.setDrawColor(...sBorder); doc.setLineWidth(0.1);
    doc.line(sumTableX + padLg, sy2 + tBarH, sumTableX + sumTableW - padLg, sy2 + tBarH);
    doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...sPrimary);
    doc.text('SALARY DETAILS', sumTableX + padLg, sy2 + 7.5);

    const colW2 = (CW - padLg * 3) / 2;
    const earnX2 = ML + padLg;
    const deductX2 = earnX2 + colW2 + padLg;

    let sy3 = sy2 + padSm + sumContH;
    const valX2 = sumTableX + sumTableW - padLg;

    doc.setFontSize(9.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...sTextSec);
    doc.text('Gross Earnings (A)', sumTableX + padLg, sy3);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...sText);
    doc.text(money(monthlySalary), valX2, sy3, { align: 'right' });
    sy3 += 8.5;

    doc.setFontSize(9.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...sTextSec);
    doc.text('Gross Deductions (B)', sumTableX + padLg, sy3);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...sText);
    doc.text(money(otherDed), valX2, sy3, { align: 'right' });
    sy3 += padSm;

    doc.setDrawColor(...sBorder); doc.setLineWidth(0.12);
    doc.line(sumTableX + padLg, sy3, sumTableX + sumTableW - padLg, sy3);
    sy3 += padSm;

    doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(...sText);
    doc.text('Net Pay (A-B)', sumTableX + padLg, sy3 + 7);
    doc.setFontSize(13); doc.setTextColor(...sPrimaryDark);
    doc.text(money(result.netSalary), valX2, sy3 + 7, { align: 'right' });

    doc.setDrawColor(...sBorder); doc.setLineWidth(0.12);
    doc.line(ML, 273, MR, 273);
    doc.setFontSize(8.5); doc.setTextColor(...sTextMuted); doc.setFont('helvetica', 'normal');
    doc.text('This is a computer-generated salary slip.', pw / 2, 278, { align: 'center' });
  };

  const trunc = (t: string, n: number) => !t ? '-' : (t.length > n ? t.substring(0, n) + '..' : t);

  const filteredEmployees = employees.filter(e => e.status === 'ACTIVE');
  const todayStr = getLocalDateStr();
  const todayPresent = attendance.filter(a => a.date === todayStr && a.personType === 'employee' && a.status === 'present').length;
  const todayAbsent = attendance.filter(a => a.date === todayStr && a.personType === 'employee' && a.status === 'absent').length;

  const dayLabel = new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const statusInfo = dateStatus(selectedDate);

  const getPaidSalaryExpenses = (emp: Employee, month: string) => {
    return expenses.filter(e =>
      e.employeeId === emp.autoId &&
      e.category === 'Salaries' &&
      e.status === 'paid' &&
      ((e.salaryMonth || '') === month || (e.date || '').startsWith(month))
    );
  };

  const isEmployeePaidForMonth = (emp: Employee, month: string) => {
    return getPaidSalaryExpenses(emp, month).length > 0;
  };

  const openDirectPay = (emp: Employee, amount: number) => {
    if (isReadOnly) { showNotification('Read-only mode: cannot add expense', 'error'); return; }
    const currentMonth = selectedMonth;
    const otherDed = getMonthDeductionInfo(emp, currentMonth).amount;
    const netPay = Math.max(0, amount - otherDed);
    setDirectPay({ emp, amount: netPay });
    setDirectPayAmount(netPay);
  };

  const confirmDirectPay = async () => {
    if (!directPay || !handleDirectSalaryPay) return;
    const currentMonth = selectedMonth;
    const monthName = new Date(selectedMonth + '-01T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const expense = {
      category: 'Salaries',
      amount: Number(directPayAmount) || 0,
      description: `Salary payment for ${directPay.emp.name} — ${monthName}`,
      date: `${currentMonth}-01`,
      salaryMonth: currentMonth,
      paidTo: directPay.emp.name,
      employeeId: directPay.emp.autoId,
      status: 'paid',
      billUrl: '',
    };
    setDirectPaying(true);
    try {
      await handleDirectSalaryPay(expense);
      setDirectPay(null);
    } finally {
      setDirectPaying(false);
    }
  };

  const exportMonthlyGridExcel = () => {
    const { currentMonth, daysInMonth, monthName } = getMonthInfo();
    const persons = employees.filter(e => e.status === 'ACTIVE');

    if (persons.length === 0) { showNotification('No records to export', 'error'); return; }

    const header: string[] = ['Name', 'Auto ID'];
    for (let d = 1; d <= daysInMonth; d++) header.push(String(d));
    header.push('Present', 'Absent', '% ');

    const rows: any[][] = persons.map(p => {
      const row: any[] = [p.name, p.autoId];
      let present = 0, absent = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const st = getMonthlyStatus(p.autoId, d);
        row.push(st);
        if (st === 'P' || st === 'L') present++;
        if (st === 'A' || st === 'C') absent++;
      }
      const pct = (present + absent) > 0 ? Math.round((present / (present + absent)) * 100) : 0;
      row.push(present, absent, `${pct}%`);
      return row;
    });

    const schoolName = (schoolSettings.schoolName || 'School OS').toUpperCase();
    const genDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const aoa: any[][] = [
      [schoolName],
      [`EMPLOYEE ATTENDANCE — ${monthName}`],
      [`Generated: ${genDate} • ${persons.length} employees • P=Present L=Late A=Absent C=CL Approved H=Holiday -=Not Marked`],
      [],
      header,
      ...rows,
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 22 }, { wch: 12 }, ...Array(daysInMonth).fill({ wch: 4 }), { wch: 8 }, { wch: 8 }, { wch: 6 }];
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: header.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: header.length - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: header.length - 1 } },
    ];
    ws['!rows'] = [{ hpt: 20 }, { hpt: 16 }, { hpt: 12 }, { hpt: 6 }, { hpt: 16 }];
    ws['!freeze'] = { xSplit: 2, ySplit: 5, topLeftCell: 'C6', activePane: 'bottomRight', state: 'frozen' } as any;
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 4, c: 0 }, e: { r: 4, c: header.length - 1 } }) } as any;

    for (let c = 0; c < header.length; c++) {
      const addr = XLSX.utils.encode_cell({ r: 4, c });
      const cell = ws[addr];
      if (cell) (cell as any).s = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '0EA5E9' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: { top: { style: 'thin', color: { rgb: 'E2E8F0' } }, bottom: { style: 'thin', color: { rgb: 'E2E8F0' } } } };
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Monthly Attendance');
    const fname = `Employee_Monthly_Attendance_${currentMonth}_${genDate.replace(/ /g, '_')}.xlsx`;
    try { XLSX.writeFile(wb, fname, { cellStyles: true } as any); } catch { XLSX.writeFile(wb, fname); }
    showNotification(`Monthly attendance grid exported`, 'success');
  };

  const exportMonthlyGridPDF = () => {
    const { currentMonth, daysInMonth, monthName } = getMonthInfo();
    const persons = employees.filter(e => e.status === 'ACTIVE');

    if (persons.length === 0) { showNotification('No records to export', 'error'); return; }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pw = 297;

    doc.setFillColor(0, 102, 204); doc.rect(0, 0, pw, 22, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text(`${(schoolSettings.schoolName || 'School OS').toUpperCase()} — Employee Attendance`, 14, 14);
    doc.setFontSize(11); doc.setFont('helvetica', 'normal');
    doc.text(monthName, pw - 14, 14, { align: 'right' });

    doc.setTextColor(80, 80, 80); doc.setFontSize(8);
    doc.text('P = Present   |   L = Late (0.5 CL)   |   A = Absent   |   C = CL Approved   |   H = Holiday   |   - = Not Marked', 14, 30);

    const headerRow: string[] = ['Name'];
    for (let d = 1; d <= daysInMonth; d++) headerRow.push(String(d));
    headerRow.push('P', 'A');

    const body = persons.map(p => {
      const row: any[] = [p.name];
      let present = 0, absent = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const st = getMonthlyStatus(p.autoId, d);
        row.push(st);
        if (st === 'P' || st === 'L') present++;
        if (st === 'A' || st === 'C') absent++;
      }
      row.push(String(present), String(absent));
      return row;
    });

    const dateColStart = 1;
    autoTable(doc, {
      head: [headerRow], body, startY: 34, theme: 'grid',
      headStyles: { fillColor: [0, 102, 204], textColor: [255, 255, 255], fontSize: 6, fontStyle: 'bold', halign: 'center', cellPadding: 1 },
      bodyStyles: { fontSize: 6.5, textColor: [50, 50, 50], halign: 'center', cellPadding: 0.8, lineColor: [220, 220, 220] },
      columnStyles: { 0: { halign: 'left', cellWidth: 40, fontStyle: 'bold' } },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index >= dateColStart) {
          const val = String(data.cell.raw || '');
          if (val === 'P') { data.cell.styles.textColor = [16, 185, 129]; data.cell.styles.fontStyle = 'bold'; }
          else if (val === 'L') { data.cell.styles.textColor = [234, 179, 8]; data.cell.styles.fontStyle = 'bold'; }
          else if (val === 'A') { data.cell.styles.textColor = [239, 68, 68]; data.cell.styles.fontStyle = 'bold'; }
          else if (val === 'C') { data.cell.styles.textColor = [6, 182, 212]; }
          else if (val === 'H') { data.cell.styles.textColor = [147, 51, 234]; }
        }
      }
    });

    doc.save(`employee_monthly_attendance_${currentMonth}.pdf`);
    showNotification(`Monthly attendance PDF exported`, 'success');
  };

  const exportAllAttendanceExcel = () => {
    if (attendance.length === 0) { showNotification('No attendance records to export', 'error'); return; }
    const data = attendance.map(a => ({
      autoId: a.personId,
      name: a.personName,
      type: a.personType,
      date: a.date,
      status: a.status,
      role: (a as any).role || '',
      clStatus: (a as any).clStatus || '',
    }));
    const cols = [
      { header: 'Auto ID', key: 'autoId', width: 14 },
      { header: 'Name', key: 'name', width: 22 },
      { header: 'Type', key: 'type', width: 10 },
      { header: 'Date', key: 'date', width: 12, type: 'date' as const },
      { header: 'Status', key: 'status', width: 10 },
      { header: 'Role', key: 'role', width: 16 },
      { header: 'CL Status', key: 'clStatus', width: 14 },
    ];
    exportProperExcel({
      schoolSettings,
      title: 'Attendance Register — All Records',
      subtitle: `${attendance.filter(a => a.status === 'present').length} present • ${attendance.filter(a => a.status === 'absent').length} absent • ${attendance.length} total`,
      filename: 'Attendance_All',
      sheetName: 'Attendance',
      columns: cols,
      data,
      extraInfo: `Selected: ${selectedDate}`,
    }, showNotification);
  };

  const exportAllExpensesExcel = () => {
    if (expenses.length === 0) { showNotification('No expense records to export', 'error'); return; }
    const data = expenses.map(e => ({
      autoId: e.autoId,
      category: e.category,
      amount: e.amount,
      description: e.description,
      date: e.date,
      paidTo: e.paidTo,
      status: e.status,
      salaryMonth: e.salaryMonth || '',
    }));
    const cols = [
      { header: 'Expense ID', key: 'autoId', width: 12 },
      { header: 'Category', key: 'category', width: 14 },
      { header: 'Amount', key: 'amount', width: 12, type: 'currency' as const, total: true },
      { header: 'Description', key: 'description', width: 30 },
      { header: 'Date', key: 'date', width: 12, type: 'date' as const },
      { header: 'Paid To', key: 'paidTo', width: 20 },
      { header: 'Status', key: 'status', width: 10 },
      { header: 'Salary Month', key: 'salaryMonth', width: 12 },
    ];
    const totalAmt = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    exportProperExcel({
      schoolSettings,
      title: 'Expenses Log — All Records',
      subtitle: `₹${totalAmt.toLocaleString('en-IN')} total • ${expenses.filter(e => e.status === 'paid').length} paid • ${expenses.length} records`,
      filename: 'Expenses_All',
      sheetName: 'Expenses',
      columns: cols,
      data,
      showTotals: true,
      extraInfo: `Selected: ${selectedDate}`,
    }, showNotification);
  };

  const exportAllMonthsAttendanceExcel = () => {
    const persons = employees.filter(e => e.status === 'ACTIVE');
    if (persons.length === 0) { showNotification('No employees to export', 'error'); return; }

    const months = [...new Set(attendance.filter(a => a.personType === 'employee' && a.date).map(a => a.date.substring(0, 7)))].filter(Boolean).sort();
    const effectiveMonths = months.length > 0 ? months : [getMonthInfo().currentMonth];

    const wb = XLSX.utils.book_new();
    const schoolName = (schoolSettings.schoolName || 'School OS').toUpperCase();
    const genDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    effectiveMonths.forEach(month => {
      const [year, m] = month.split('-').map(Number);
      const daysInMonth = new Date(year, m, 0).getDate();
      const monthName = new Date(year, m - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      const header: string[] = ['Name', 'Auto ID'];
      for (let d = 1; d <= daysInMonth; d++) header.push(String(d));
      header.push('Present', 'Absent', '% ');

      const rows: any[][] = persons.map(p => {
        const row: any[] = [p.name, p.autoId];
        let present = 0, absent = 0;
        for (let d = 1; d <= daysInMonth; d++) {
          const st = getMonthlyStatus(p.autoId, d, month);
          row.push(st);
          if (st === 'P' || st === 'L') present++;
          if (st === 'A' || st === 'C') absent++;
        }
        const pct = (present + absent) > 0 ? Math.round((present / (present + absent)) * 100) : 0;
        row.push(present, absent, `${pct}%`);
        return row;
      });

      const aoa: any[][] = [
        [schoolName],
        [`EMPLOYEE ATTENDANCE — ${monthName}`],
        [`Generated: ${genDate} • ${persons.length} employees • P=Present L=Late A=Absent C=CL H=Holiday -=Not Marked`],
        [],
        header,
        ...rows,
      ];

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [{ wch: 22 }, { wch: 12 }, ...Array(daysInMonth).fill({ wch: 4 }), { wch: 8 }, { wch: 8 }, { wch: 6 }];
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: header.length - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: header.length - 1 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: header.length - 1 } },
      ];
      ws['!rows'] = [{ hpt: 20 }, { hpt: 16 }, { hpt: 12 }, { hpt: 6 }, { hpt: 16 }];
      ws['!freeze'] = { xSplit: 2, ySplit: 5, topLeftCell: 'C6', activePane: 'bottomRight', state: 'frozen' } as any;
      ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 4, c: 0 }, e: { r: 4, c: header.length - 1 } }) } as any;

      for (let c = 0; c < header.length; c++) {
        const addr = XLSX.utils.encode_cell({ r: 4, c });
        const cell = ws[addr];
        if (cell) (cell as any).s = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '0EA5E9' } }, alignment: { horizontal: 'center', vertical: 'center' } };
      }

      XLSX.utils.book_append_sheet(wb, ws, monthName.slice(0, 31));
    });

    const fname = `Employee_Attendance_All_Months_${genDate.replace(/ /g, '_')}.xlsx`;
    try { XLSX.writeFile(wb, fname, { cellStyles: true } as any); } catch { XLSX.writeFile(wb, fname); }
    showNotification(`Exported full attendance for ${effectiveMonths.length} month(s)`, 'success');
  };

  const exportMonthlySalaryReport = () => {
    const currentMonth = selectedMonth;
    const monthName = new Date(selectedMonth + '-01T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const activeEmps = employees.filter(e => e.status === 'ACTIVE');
    if (activeEmps.length === 0) { showNotification('No active employees', 'error'); return; }
    const data = activeEmps.map(e => {
      const si = getEmployeeSalaryInfo(e);
      return {
        autoId: e.autoId,
        name: e.name,
        role: e.role,
        month: currentMonth,
        monthlySalary: si.monthlySalary,
        workingDays: si.workingDays,
        presentDays: si.presentDays,
        lateDays: si.lateDays,
        clCovered: si.clCovered,
        effectivePresent: si.presentDays + si.lateDays + si.clCovered,
        absentDays: si.absentDays,
        perDay: Math.round(si.perDaySalary),
        earnedSalary: si.earnedSalary,
      };
    });
    const cols = [
      { header: 'Employee ID', key: 'autoId', width: 12 },
      { header: 'Name', key: 'name', width: 20 },
      { header: 'Role', key: 'role', width: 14 },
      { header: 'Month', key: 'month', width: 10 },
      { header: 'Monthly Salary', key: 'monthlySalary', width: 14, type: 'currency' as const, total: true },
      { header: 'Working Days', key: 'workingDays', width: 12, type: 'number' as const },
      { header: 'Present', key: 'presentDays', width: 10, type: 'number' as const },
      { header: 'Late', key: 'lateDays', width: 8, type: 'number' as const },
      { header: 'CL Covered', key: 'clCovered', width: 10, type: 'number' as const },
      { header: 'Effective Present', key: 'effectivePresent', width: 14, type: 'number' as const },
      { header: 'Absent', key: 'absentDays', width: 10, type: 'number' as const },
      { header: 'Per Day', key: 'perDay', width: 10, type: 'currency' as const },
      { header: 'Earned Salary', key: 'earnedSalary', width: 14, type: 'currency' as const, total: true },
    ];
    exportProperExcel({
      schoolSettings,
      title: `Monthly Salary Report — ${monthName}`,
      subtitle: `${activeEmps.length} active employees • Working days vary by month`,
      filename: `Salary_Report_${currentMonth}`,
      sheetName: 'Salary Report',
      columns: cols,
      data,
      showTotals: true,
      extraInfo: monthName,
    }, showNotification);
  };

  const exportAttendanceExpensePDF = () => {
    const { currentMonth, monthName } = getMonthInfo();
    const activeEmps = employees.filter(e => e.status === 'ACTIVE');
    if (activeEmps.length === 0) { showNotification('No employees to export', 'error'); return; }

    const doc = new jsPDF();
    const pw = 210;

    doc.setFillColor(0, 102, 204); doc.rect(0, 0, pw, 22, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text(`${(schoolSettings.schoolName || 'School OS').toUpperCase()} — Attendance Expense`, 14, 14);
    doc.setFontSize(11); doc.setFont('helvetica', 'normal');
    doc.text(monthName, pw - 14, 14, { align: 'right' });

    const rows = activeEmps.map(e => {
      const info = getEmployeeSalaryInfo(e);
      const otherDed = getMonthDeductionInfo(e, currentMonth).amount;
      const payable = Math.max(0, info.earnedSalary - otherDed);
      const paid = isEmployeePaidForMonth(e, currentMonth);
      return [
        e.name,
        e.role || '-',
        String(info.presentDays),
        String(info.absentDays),
        String(info.workingDays),
        String(Math.round(info.perDaySalary)),
        String(info.earnedSalary),
        String(payable),
        paid ? 'Paid' : 'Pending',
      ];
    });

    const totals = rows.reduce((acc, r) => {
      acc.earned += parseInt(r[6]) || 0;
      acc.payable += parseInt(r[7]) || 0;
      return acc;
    }, { earned: 0, payable: 0 });

    autoTable(doc, {
      head: [['Employee', 'Role', 'Present', 'Absent', 'Work Days', 'Per Day (Rs)', 'Earned (Rs)', 'Payable (Rs)', 'Status']],
      body: rows,
      foot: [['TOTAL', '', '', '', '', '', String(totals.earned), String(totals.payable), '']],
      startY: 28,
      theme: 'striped',
      styles: { fontSize: 8.5, cellPadding: 3 },
      headStyles: { fillColor: [0, 102, 204], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' },
      footStyles: { fillColor: [240, 240, 240], textColor: [30, 41, 59], fontStyle: 'bold' },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 7) data.cell.styles.fontStyle = 'bold';
        if (data.section === 'body' && data.column.index === 8) {
          data.cell.styles.textColor = String(data.cell.raw) === 'Paid' ? [16, 185, 129] : [234, 179, 8];
        }
      }
    });

    doc.save(`attendance_expense_${currentMonth}.pdf`);
    showNotification('Attendance expense PDF exported', 'success');
  };

  const clManagementSection = clViewEmpId ? (() => {
    const emp = employees.find(e => e.autoId === clViewEmpId);
    const currentMonthKey = selectedMonth;
    const annualQuota = getEmpClQuota(emp);
    const summ = getMonthAttSummary(emp!.autoId, currentMonthKey, attendance, holidays);
    const usedTotal = getClUsedTotal(emp!.autoId, currentMonthKey, attendance);
    const remainingYear = Math.max(0, annualQuota - usedTotal);
    const lateDays = summ.late;

    return (
      <div className="space-y-4">
        {/* Summary badges */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-cyan-400">{annualQuota}</p>
            <p className="text-xs text-gray-400 mt-1">Annual Quota</p>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">{summ.clUsedThisMonth}</p>
            <p className="text-xs text-gray-400 mt-1">Used This Month</p>
          </div>
          {((summ as any).totalPending ?? summ.pending) > 0 ? (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-yellow-400">{((summ as any).totalPending ?? summ.pending)}</p>
              <p className="text-xs text-gray-400 mt-1">Pending (Full + Half)</p>
            </div>
          ) : (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-emerald-400">0</p>
              <p className="text-xs text-gray-400 mt-1">Pending Decision</p>
            </div>
          )}
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{remainingYear}</p>
            <p className="text-xs text-gray-400 mt-1">Remaining (Year)</p>
          </div>
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-purple-400">{usedTotal}/{annualQuota}</p>
            <p className="text-xs text-gray-400 mt-1">Year Usage</p>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Annual CL Usage</span>
            <span>{usedTotal}/{annualQuota} days</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${remainingYear === 0 ? 'bg-red-500' : remainingYear <= 3 ? 'bg-yellow-500' : 'bg-cyan-500'}`}
              style={{ width: `${Math.min(100, annualQuota > 0 ? (usedTotal / annualQuota) * 100 : 0)}%` }}
            />
          </div>
        </div>

        {lateDays > 0 && (
          <div className="flex flex-col gap-1 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-sm">
            <div className="flex items-center gap-2">
              <FiClock className="text-yellow-400 shrink-0" />
              <span className="text-gray-300">{lateDays} half-day (late) mark{lateDays > 1 ? 's' : ''} — {(summ as any).lateApproved ?? 0} approved (0.5 CL each), {(summ as any).latePending ?? 0} pending, {(summ as any).lateDisapproved ?? 0} disapproved (0.5 salary deducted).</span>
            </div>
            <span className="text-xs text-gray-400 ml-6">Approved half-days use 0.5 CL and count as present. Disapproved half-days deduct 0.5 salary. Pending awaits decision.</span>
          </div>
        )}

        {summ.records.filter(r => r.status === 'absent' || r.status === 'late').length === 0 ? (
          <div className="text-center py-10">
            <div className="text-5xl mb-3">📋</div>
            <p className="text-gray-500">No absences or half-days recorded for {emp?.name} in {currentMonthKey}. Late (half-day) and absent marks will appear here for approval.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Day</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {summ.records.filter(r => r.status === 'absent' || r.status === 'late').sort((a, b) => a.date.localeCompare(b.date)).map(rec => {
                  const isHalfDay = rec.status === 'late';
                  const isApproved = isHalfDay ? isLateClCovered(rec, currentMonthKey) : isClCovered(rec, currentMonthKey);
                  const isPending = isHalfDay ? isLatePending(rec, currentMonthKey) : isClPending(rec, currentMonthKey);
                  const isDisapproved = rec.clStatus === 'disapproved';
                  const wasAutoCovered = isApproved && !rec.clStatus;
                  return (
                    <tr key={rec.date + rec.personId} className="border-t border-gray-800 hover:bg-gray-800/30 transition">
                      <td className="px-4 py-3 font-mono text-cyan-400 text-sm">{rec.date}</td>
                      <td className="px-4 py-3 text-sm text-gray-400">{new Date(rec.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' })}</td>
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {isHalfDay ? <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-semibold"><FiClock size={12} /> Half Day (0.5 CL)</span> : <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold"><FiX size={12} /> Full Day (1 CL)</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {isApproved ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold"><FiCheck size={12} /> {wasAutoCovered ? (isHalfDay ? 'Covered — 0.5 CL (past month, Half)' : 'Covered — CL used (past month)') : (isHalfDay ? 'Approved — 0.5 CL used' : 'Approved — CL used')}</span>
                        ) : isDisapproved ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold"><FiX size={12} /> {isHalfDay ? 'Disapproved — 0.5 deducted' : 'Disapproved — deducted'}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-semibold"><FiClock size={12} /> {isHalfDay ? 'Pending — 0.5 CL' : 'Pending'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {!isReadOnly && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => setClApproval(rec, 'approved')}
                              disabled={isApproved}
                              title={isHalfDay ? "Approve — use 0.5 CL, no salary deduction (Half Day)" : "Approve — use 1 CL, no salary deduction"}
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${isApproved ? 'bg-emerald-500/20 text-emerald-400 cursor-default' : 'bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400'}`}
                            >
                              <FiCheck size={12} /> Approve
                            </button>
                            <button
                              onClick={() => setClApproval(rec, 'disapproved')}
                              disabled={isDisapproved}
                              title={isHalfDay ? "Disapprove — deduct 0.5 salary (Half Day)" : "Disapprove — deduct salary for this day"}
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${isDisapproved ? 'bg-red-500/20 text-red-400 cursor-default' : 'bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-400'}`}
                            >
                              <FiX size={12} /> Disapprove
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  })() : null;

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        {[
          { id: 'employee', icon: FiBriefcase, label: 'Employee Attendance' },
          { id: 'causalLeaves', icon: FiSliders, label: 'CL & Deduction' },
          { id: 'holidays', icon: FiCalendar, label: 'Holidays' }
        ].map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id as any)} className={`flex items-center gap-2 px-5 py-3 rounded-xl border transition-all ${subTab === t.id ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white border-transparent shadow-lg shadow-cyan-500/20' : 'bg-[#1E1E1E] border-gray-800 text-gray-400 hover:border-cyan-500/50'}`}>
            <t.icon size={18} /> {t.label}
          </button>
        ))}
      </div>

      <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-2xl p-5">
        <p className="text-xs uppercase tracking-wide text-cyan-400 font-semibold">Attendance Register</p>
        <h2 className="text-2xl font-bold text-white mt-1">{schoolSettings.schoolName || 'School OS'}</h2>
        {schoolSettings.address && <p className="text-sm text-gray-400 mt-1">{schoolSettings.address}</p>}
      </div>

      {subTab === 'employee' && (
        <div className="space-y-4">
          <div className="bg-[#1E1E1E] rounded-2xl border border-gray-800 p-5 space-y-4">
            <div className="flex flex-col md:flex-row gap-4 md:items-end">
              <div className="flex-1">
                <label className="text-xs text-cyan-400">Monthly Employee Attendance</label>
                <select value={selectedMonthlyEmployeeId} onChange={e => setSelectedMonthlyEmployeeId(e.target.value)} className="w-full mt-1 p-3 bg-gray-800 rounded-lg border border-gray-700 text-white">
                  <option value="">-- Select Employee for Monthly View --</option>
                  {filteredEmployees.sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name)).map(e => <option key={e.id} value={e.autoId}>{e.role} | {e.autoId} - {e.name}</option>)}
                </select>
              </div>
              <div className="space-y-1 min-w-[180px]">
                <label className="text-xs text-cyan-400">Month</label>
                <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-full p-2.5 bg-gray-800 rounded-lg border border-gray-700 text-white text-sm focus:border-cyan-500 focus:outline-none" />
                <p className="text-xs text-gray-400">Month: <span className="text-cyan-400 font-semibold">{getMonthInfo().monthName}</span></p>
              </div>
            </div>

            {selectedMonthlyEmployeeId && (() => {
              const selectedEmployee = employees.find(e => e.autoId === selectedMonthlyEmployeeId);
              if (!selectedEmployee) return <div className="text-sm text-red-400">Selected employee not found.</div>;

              return (
                <div className="overflow-x-auto">
                  <div className="min-w-max">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="px-4 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30"><p className="font-bold text-white">{selectedEmployee.name}</p><p className="text-xs text-cyan-400">{selectedEmployee.role} | {selectedEmployee.autoId}</p></div>
                      <div className="flex items-center gap-3 text-xs text-gray-400"><span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500"></span> Present</span><span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500"></span> Absent</span><span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-500"></span> Holiday</span></div>
                    </div>
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <span className="text-xs text-gray-400">Salary:</span>
                      <button type="button" onClick={() => { setSalaryType('new'); setEditMonthSalary(false); }} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${salaryType === 'new' ? 'bg-cyan-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>New (₹{selectedEmployee.salary?.toLocaleString()})</button>
                      <button type="button" onClick={() => { setSalaryType('old'); setSelectedMonthlyEmployeeId(''); }} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${salaryType === 'old' ? 'bg-yellow-500 text-black' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>Old</button>
                      {salaryType === 'old' && !editMonthSalary && (
                        <button type="button" onClick={() => { const cur = selectedEmployee.monthSalary?.[selectedMonth]; setMonthSalaryInput(String(cur ?? selectedEmployee.oldSalary ?? selectedEmployee.salary ?? '')); setEditMonthSalary(true); }} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 hover:bg-yellow-500/30 transition">Update Salary for Month</button>
                      )}
                      {salaryType === 'old' && editMonthSalary && (
                        <div className="flex items-center gap-2">
                          <input type="number" value={monthSalaryInput} onChange={e => setMonthSalaryInput(e.target.value)} className="w-28 px-2 py-1.5 bg-gray-800 border border-yellow-500/50 rounded-lg text-white text-xs" placeholder="Amount" />
                          <button type="button" onClick={async () => {
                            const amt = parseFloat(monthSalaryInput);
                            if (isNaN(amt) || amt < 0) { showNotification('Enter a valid amount', 'error'); return; }
                            const currentMonth = selectedMonth;
                            const updated = { ...selectedEmployee.monthSalary, [currentMonth]: amt };
                            try {
                              await updateEmployee(selectedEmployee.id!, { ...selectedEmployee, monthSalary: updated });
                              showNotification(`Salary for ${currentMonth} set to ₹${amt.toLocaleString()}`, 'success');
                              setEditMonthSalary(false);
                              loadData();
                            } catch (e) { showNotification('Failed to update salary', 'error'); }
                          }} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-yellow-500 text-black hover:bg-yellow-400 transition">Save</button>
                          <button type="button" onClick={() => setEditMonthSalary(false)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-700 text-gray-300 hover:bg-gray-600 transition">Cancel</button>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 pb-2">
                      {getSelectedMonthDays().map(day => {
                        const status = getMonthlyEmployeeStatus(selectedEmployee.autoId, day.dateStr);
                        const isPresent = status === 'present';
                        const isLate = status === 'late';
                        const isAbsent = status === 'absent';
                        const isHolidayDay = status === 'holiday';
                        const isToday = day.dateStr === getLocalDateStr();
                        return <div key={day.dateStr} className={`w-20 shrink-0 rounded-xl border p-2 text-center ${isToday ? 'sticky left-0 z-20 ring-2 ring-cyan-400 border-cyan-400 bg-cyan-500/10 shadow-lg' : isHolidayDay ? 'bg-purple-500/10 border-purple-500/30' : 'bg-gray-800 border-gray-700'}`}><p className="text-xs text-gray-400">{day.weekday}</p><p className={`text-lg font-bold ${isToday ? 'text-cyan-400' : 'text-white'}`}>{day.label}{isToday && <span className="ml-1 text-[9px] bg-cyan-500 text-white px-1 py-0.5 rounded">Today</span>}</p>{isHolidayDay ? <div className="mt-2 text-xs text-purple-400 font-bold">Holiday</div> : <div className="mt-2 flex flex-col gap-1"><button type="button" onClick={() => setMonthlyEmployeeAttendance(selectedEmployee, day.dateStr, 'present')} className={`px-2 py-1 rounded text-xs font-bold transition ${isPresent ? 'bg-emerald-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-emerald-600/50'}`}>P</button><button type="button" onClick={() => setMonthlyEmployeeAttendance(selectedEmployee, day.dateStr, 'late')} className={`px-2 py-1 rounded text-xs font-bold transition ${isLate ? 'bg-yellow-500 text-black' : 'bg-gray-700 text-gray-300 hover:bg-yellow-600/50'}`}>L</button><button type="button" onClick={() => setMonthlyEmployeeAttendance(selectedEmployee, day.dateStr, 'absent')} className={`px-2 py-1 rounded text-xs font-bold transition ${isAbsent ? 'bg-red-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-red-600/50'}`}>A</button></div>}</div>;
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
          <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 p-4 rounded-xl flex flex-col md:flex-row gap-3 md:items-center justify-between">
            <div>
              <h4 className="font-semibold text-purple-400 flex items-center gap-2"><FiCalendar size={16} /> Monthly Reports & Salary Slips</h4>
              <p className="text-xs text-gray-400 mt-1">{getMonthInfo().monthName} — Monthly grid + salary slips for all employees</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => exportMonthlyGridExcel()} className="flex items-center gap-2 bg-[#1E1E1E] border border-gray-800 hover:border-emerald-500/50 px-4 py-2 rounded-lg text-sm"><FiDownload size={16} />Monthly Excel</button>
              <button onClick={() => exportMonthlyGridPDF()} className="flex items-center gap-2 bg-[#1E1E1E] border border-gray-800 hover:border-red-500/50 px-4 py-2 rounded-lg text-sm"><FiFileText size={16} />Monthly PDF</button>
              <button onClick={() => exportAllAttendanceExcel()} className="flex items-center gap-2 bg-[#1E1E1E] border border-gray-800 hover:border-cyan-500/50 px-4 py-2 rounded-lg text-sm"><FiDownload size={16} />All Attendance (Excel)</button>
              <button onClick={() => exportAllExpensesExcel()} className="flex items-center gap-2 bg-[#1E1E1E] border border-gray-800 hover:border-yellow-500/50 px-4 py-2 rounded-lg text-sm"><FiDownload size={16} />All Expenses (Excel)</button>
              <button onClick={() => exportAllMonthsAttendanceExcel()} className="flex items-center gap-2 bg-[#1E1E1E] border border-gray-800 hover:border-purple-500/50 px-4 py-2 rounded-lg text-sm"><FiDownload size={16} />Full Attendance (All Months)</button>
              <button onClick={() => exportSalarySlips()} className="flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-lg shadow-yellow-500/20"><FiDollarSign size={16} />Salary Slips (PDF)</button>
            </div>
          </div>

          {filteredEmployees.length === 0 ? (
            <div className="bg-[#1E1E1E] rounded-2xl border border-gray-800 p-12 text-center">
              <div className="text-6xl mb-4">💼</div>
              <h3 className="text-xl font-bold mb-2">No Employees Found</h3>
              <p className="text-gray-400">Add employees first</p>
            </div>
          ) : (
            <>
              <div className="bg-[#1E1E1E] rounded-2xl border border-gray-800 overflow-hidden">
                <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 p-6 pb-4">
                  <div>
                    <h3 className="text-lg font-bold flex items-center gap-2"><FiDollarSign className="text-yellow-400" /> Salary Calculation</h3>
                    <p className="text-xs text-gray-400 mt-1">Salary based on present days + approved half-days (0.5 CL). Sundays & holidays auto-excluded. Month: <span className="text-cyan-400 font-semibold">{new Date(selectedMonth + '-01T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} ({selectedMonth})</span></p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="p-2.5 bg-gray-800 rounded-lg border border-gray-700 text-white text-sm focus:border-cyan-500 focus:outline-none" />
                    <button onClick={() => setShowSalaryCalc(v => !v)} className="flex items-center justify-center gap-2 bg-[#1E1E1E] border border-gray-800 hover:border-cyan-500/50 px-5 py-2 rounded-xl">
                      {showSalaryCalc ? <FiEyeOff size={16} /> : <FiEye size={16} />}{showSalaryCalc ? 'Hide' : 'Show'}
                    </button>
                    <button onClick={() => exportMonthlySalaryReport()} className="flex items-center justify-center gap-2 bg-[#1E1E1E] border border-gray-800 hover:border-emerald-500/50 px-5 py-2 rounded-xl"><FiDownload size={16} />Salary Excel</button>
                    <button onClick={() => exportAttendanceExpensePDF()} className="flex items-center justify-center gap-2 bg-[#1E1E1E] border border-gray-800 hover:border-red-500/50 px-5 py-2 rounded-xl"><FiFileText size={16} />Expense PDF</button>
                  </div>
                </div>
                {showSalaryCalc && (
                  <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-800">
                    <table className="w-full min-w-[1250px]">
                      <thead className="bg-gray-800/50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 whitespace-nowrap sticky left-0 bg-gray-800/90 backdrop-blur z-20 w-[180px] min-w-[180px] max-w-[180px]">Employee</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 whitespace-nowrap sticky left-[180px] bg-gray-800/90 backdrop-blur z-20 border-l border-gray-700 w-[110px] min-w-[110px]">Present</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 whitespace-nowrap">Absent</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 whitespace-nowrap">Work Days</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 whitespace-nowrap">Per Day</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 whitespace-nowrap">CL Left</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-orange-400 whitespace-nowrap">Deduction</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 whitespace-nowrap">Earned Salary</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-emerald-400 whitespace-nowrap">Paid</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 whitespace-nowrap">Direct Pay</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 whitespace-nowrap">PDF</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredEmployees.map(e => {
                          const info = getEmployeeSalaryInfo(e);
                          const annualQuota = getEmpClQuota(e);
                          const usedTotal = getClUsedTotal(e.autoId, selectedMonth, attendance);
                          const remainingAnnual = Math.max(0, annualQuota - usedTotal);
                          const effAbsent = info.absentDays;
                          const effSalary = info.earnedSalary;
                          const clLeft = remainingAnnual;
                          const lateApproved = (info as any).lateApproved ?? 0;
                          const latePending = (info as any).latePending ?? 0;
                          const lateDisapproved = (info as any).lateDisapproved ?? 0;
                          const deductInfo = getMonthDeductionInfo(e, selectedMonth);
                          const paidExpenses = getPaidSalaryExpenses(e, selectedMonth);
                          const paid = paidExpenses.length > 0;
                          return (
                            <tr key={e.id} className={`border-t border-gray-800 transition ${paid ? 'bg-red-500/20 hover:bg-red-500/30' : 'hover:bg-gray-800/30'}`}>
                              <td className="px-4 py-3 sticky left-0 bg-[#1E1E1E] z-10 w-[180px] min-w-[180px] max-w-[180px]"><p className="font-semibold text-sm truncate">{e.name}</p><p className="text-xs text-gray-500 truncate">{e.role}</p></td>
                              <td className="px-4 py-3 text-center sticky left-[180px] bg-[#1E1E1E] z-10 border-l border-gray-700 w-[110px] min-w-[110px]"><div className="flex flex-col items-center"><span className="text-emerald-400 font-bold">{(() => { const eff = info.presentDays + (lateApproved + latePending) * 0.5; return eff % 1 === 0 ? eff : eff.toFixed(1); })()}</span><div className="flex gap-1 text-[10px] leading-none mt-0.5 flex-wrap justify-center">{lateApproved > 0 && <span className="text-yellow-400">+{lateApproved}L ✓(0.5)</span>}{latePending > 0 && <span className="text-yellow-300">+{latePending}L …(0.5)</span>}{lateDisapproved > 0 && <span className="text-orange-400">+{lateDisapproved}L✗</span>}{info.clCovered > 0 && <span className="text-cyan-400">+{info.clCovered}CL</span>}</div></div></td>
                              <td className="px-4 py-3 text-center"><span className="text-red-400 font-semibold">{effAbsent % 1 === 0 ? effAbsent : effAbsent.toFixed(1)}</span></td>
                              <td className="px-4 py-3 text-center text-gray-400">{info.workingDays}</td>
                              <td className="px-4 py-3 text-right text-gray-400">₹{info.perDaySalary.toFixed(0)}</td>
                              <td className="px-4 py-3"><span className="text-cyan-400 font-semibold">{clLeft}</span></td>
                              <td className="px-4 py-3 text-right"><div className="flex flex-col items-end"><span className={`font-semibold ${info.deductions > 0 ? 'text-orange-400' : 'text-gray-500'}`}>₹{info.deductions.toLocaleString()}</span>{deductInfo.description && <span className="text-[10px] text-gray-500 truncate max-w-[110px]">{deductInfo.description}</span>}</div></td>
                              <td className="px-4 py-3 text-right"><span className="font-bold text-yellow-400">₹{effSalary.toLocaleString()}</span></td>
                              <td className="px-4 py-3 text-right"><span className={`font-bold ${paid ? 'text-emerald-400' : 'text-gray-500'}`}>₹{paidExpenses.reduce((s, ex) => s + (ex.amount || 0), 0).toLocaleString()}</span>{paid ? <span className="text-[10px] text-emerald-400 ml-1">✓</span> : <span className="text-[10px] text-gray-500 ml-1">—</span>}</td>
                              <td className="px-4 py-3">
                                {paid ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 text-red-400 text-xs font-semibold rounded-lg border border-red-500/30">
                                      <FiCheck size={13} /> Paid
                                    </span>
                                    {!isReadOnly && deleteSalaryExpenses && (
                                      <button
                                        onClick={() => deleteSalaryExpenses(paidExpenses)}
                                        title={`Delete salary expense for ${e.name} — reverts to unpaid`}
                                        className="flex items-center gap-1 px-2 py-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/20 text-xs font-semibold rounded-lg border border-red-500/30 transition"
                                      >
                                        <FiTrash2 size={13} /> Unpay
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => openDirectPay(e, effSalary)}
                                    title={`Add salary expense for ${e.name}`}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-xs font-semibold rounded-lg shadow transition"
                                  >
                                    <FiDollarSign size={13} /> Pay ₹{Math.max(0, effSalary).toLocaleString()}
                                  </button>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => exportSalarySlips(e)}
                                  title={`Download salary slip for ${e.name}`}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white text-xs font-semibold rounded-lg shadow transition"
                                >
                                  <FiDownload size={13} /> PDF
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
        
        {subTab === 'causalLeaves' && (
          <div className="space-y-6">
            {/* CL Settings */}
            <div className="bg-[#1E1E1E] rounded-2xl border border-cyan-500/20 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-2"><FiSliders className="text-cyan-400" /> CL Settings</h3>
                  <p className="text-xs text-gray-400 mt-1">CL is granted manually and never refreshed monthly — unused CL balance carries forward to the next month. Quota is per academic year (June–May).</p>
                </div>
                <button
                  onClick={() => { setClQuotaEdit(v => !v); setClQuotaInput(String(clQuota)); }}
                  className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-400 rounded-lg text-sm transition"
                >
                  <FiSliders size={14} /> {clQuotaEdit ? 'Cancel' : 'Customize'}
                </button>
              </div>
              {clQuotaEdit ? (
                <div className="flex items-center gap-3 mt-2">
                  <div>
                    <label className="text-xs text-cyan-400">CL Quota / Year</label>
                    <input
                      type="number" min={0} max={365}
                      value={clQuotaInput}
                      onChange={e => setClQuotaInput(e.target.value)}
                      className="block mt-1 p-3 bg-gray-800 rounded-lg border border-gray-700 text-white w-36"
                    />
                  </div>
                  <button
                    onClick={() => {
                      const n = parseInt(clQuotaInput);
                      if (isNaN(n) || n < 0) return;
                      setClQuota(n);
                      localStorage.setItem('clQuota', String(n));
                      setClQuotaEdit(false);
                      showNotification(`CL quota set to ${n} days/year`, 'success');
                    }}
                    className="mt-5 px-5 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-semibold transition"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-4xl font-bold text-cyan-400">{clQuota}</span>
                  <span className="text-gray-400 text-sm">casual leave days per year. Unused CL carries forward month to month (no monthly refresh).</span>
                </div>
              )}
            </div>

            {/* CL & Deduction Management */}
            <div className="bg-[#1E1E1E] rounded-2xl border border-gray-800 p-6">
              <h3 className="text-lg font-bold mb-1 flex items-center gap-2"><FiEye className="text-cyan-400" /> CL &amp; Deduction Management</h3>
              <p className="text-xs text-gray-400 mb-2">
                Approve an absence to cover it with CL (no salary deduction, 1 CL used). Disapprove it to deduct salary for that day. Late marks use 0.5 CL each — now also requires approval (half-day). Select month and employee to review.
              </p>
              <div className="flex flex-col md:flex-row gap-3 mb-4">
                <select
                  value={clViewEmpId}
                  onChange={e => setClViewEmpId(e.target.value)}
                  className="flex-1 p-3 bg-gray-800 rounded-lg border border-gray-700 text-white"
                >
                  <option value="">-- Select Employee --</option>
                  {employees.filter(e => e.status === 'ACTIVE').sort((a, b) => a.name.localeCompare(b.name)).map(e => (
                    <option key={e.id} value={e.autoId}>{e.name} — {e.role} ({e.autoId})</option>
                  ))}
                </select>
                <div className="space-y-1 min-w-[180px]">
                  <label className="text-xs text-cyan-400">Month</label>
                  <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-full p-2.5 bg-gray-800 rounded-lg border border-gray-700 text-white text-sm focus:border-cyan-500 focus:outline-none" />
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-2">
                Showing: <span className="text-cyan-400 font-semibold">{selectedMonth} • {new Date(selectedMonth + '-01T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
              </p>

            </div>
        {clManagementSection}
          </div>
        )}
        {subTab === 'holidays' && (
          <div className="space-y-6">
            {!isReadOnly && (
              <div className="bg-[#1E1E1E] rounded-2xl border border-gray-800 p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><FiPlus className="text-cyan-400" /> Add Holiday</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input type="date" value={newHolidayDate} onChange={e => setNewHolidayDate(e.target.value)} className="p-3 bg-gray-800 rounded-lg border border-gray-700 text-white" />
                  <input placeholder="Holiday Name (e.g., DIWALI)" value={newHolidayName} onChange={e => setNewHolidayName(e.target.value.toUpperCase())} className="p-3 bg-gray-800 rounded-lg border border-gray-700 text-white uppercase" />
                  <button onClick={handleAddHoliday} className="flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 px-6 py-3 rounded-lg font-semibold"><FiPlus size={18} /> Add Holiday</button>
                </div>
              </div>
            )}

              <div className="bg-purple-500/10 border border-purple-500/30 p-4 rounded-xl">
                <p className="text-sm text-purple-400 flex items-center gap-2"><span className="text-lg">🌙</span> Note: Every <strong>Sunday is automatically a holiday</strong> — no need to add manually.</p>
              </div>

              <div className="bg-[#1E1E1E] rounded-2xl border border-gray-800 overflow-hidden">
                <h3 className="text-lg font-bold p-6 pb-4 flex items-center gap-2"><FiCalendar className="text-cyan-400" /> Holiday List</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-800/50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">Day</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {holidays.length === 0 ? (
                        <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No holidays added yet</td></tr>
                      ) : holidays.map(h => (
                        <tr key={h.id} className="border-t border-gray-800 hover:bg-gray-800/30 transition">
                          <td className="px-6 py-3 font-mono text-cyan-400">{h.date}</td>
                          <td className="px-6 py-3 text-gray-400">{new Date(h.date).toLocaleDateString('en-US', { weekday: 'long' })}</td>
                          <td className="px-6 py-3 font-semibold">{h.name}</td>
                          <td className="px-6 py-3"><span className={`px-2 py-1 rounded text-xs font-semibold ${h.type === 'sunday' ? 'bg-purple-500/20 text-purple-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{h.type === 'sunday' ? 'Auto (Sunday)' : 'Manual'}</span></td>
                          <td className="px-6 py-3">{!isReadOnly && h.type === 'manual' && <button onClick={() => handleDeleteHoliday(h.id!)} className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/20 rounded"><FiTrash2 size={16} /></button>}{isReadOnly && <FiEye className="text-gray-600" size={14} />}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
          </div>
          )}
          {/* Direct Pay Confirmation Dialog */}
          {directPay && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="bg-[#1E1E1E] border border-gray-700 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <FiDollarSign className="text-emerald-400" /> Direct Salary Payment
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                  Pay <span className="font-semibold text-emerald-400">₹{directPayAmount.toLocaleString()}</span> to <span className="font-semibold text-white">{directPay.emp.name}</span>
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Amount (₹)</label>
                    <input
                      type="number"
                      value={directPayAmount}
                      onChange={e => setDirectPayAmount(Number(e.target.value) || 0)}
                      className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setDirectPay(null)}
                      className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmDirectPay}
                      disabled={directPaying}
                      className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-lg font-semibold shadow transition disabled:opacity-50"
                    >
                      {directPaying ? 'Paying...' : 'Confirm Pay'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
  );
};
