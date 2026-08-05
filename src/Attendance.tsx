import React, { useState, useEffect } from 'react';
import { FiUsers, FiBriefcase, FiCalendar, FiCheck, FiX, FiPlus, FiTrash2, FiDollarSign, FiTrendingUp, FiUpload, FiDownload, FiFileText, FiEye, FiEyeOff, FiSliders, FiClock } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Employee, Attendance as Att, Holiday, Expense } from './types';
import type { SalarySlipData } from './salarySlipTypes';
import { getClAnnualQuota as getEmpClQuota, getClUsedTotal, getMonthAttSummary, isClCovered } from './clUtils';

interface AttendanceProps {
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
}

// Check if a date is a Sunday (auto holiday)
const isSunday = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.getDay() === 0; // 0 = Sunday
};

// Check if a date is a manual holiday
const isManualHoliday = (dateStr: string, holidays: Holiday[]) => {
  return holidays.find(h => h.date === dateStr && h.type === 'manual');
};

export const AttendanceSection: React.FC<AttendanceProps> = ({
  employees, attendance, holidays, expenses, schoolSettings, isReadOnly,
  saveAttendance, addHoliday, deleteHoliday, showNotification, loadData,
  logSalarySlipAudit, updateEmployee, handleDirectSalaryPay
}) => {
  const [subTab, setSubTab] = useState<'employee' | 'holidays' | 'causalLeaves'>('employee');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
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

  // === CL State ===
  const [clViewEmpId, setClViewEmpId] = useState('');
  // Casual leave quota - per employee per year (customisable via schoolSettings)
  const [clQuota, setClQuota] = useState<number>(() => {
    const saved = localStorage.getItem('clQuota');
    return saved ? parseInt(saved) : 12;
  });
  const [clQuotaEdit, setClQuotaEdit] = useState(false);
  const [clQuotaInput, setClQuotaInput] = useState('');


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

  // ===== Import Attendance from Excel =====
  const importAttendanceFromExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const json: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
        const rows = json.filter(r => Object.values(r).some(v => String(v).trim() !== ''));
        if (rows.length === 0) { showNotification('No data found', 'error'); return; }

        let success = 0, failed = 0;
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const personId = String(row['Auto ID'] || row['Employee ID'] || row['Student ID'] || row['ID'] || '').trim();
          const personName = String(row['Name'] || row['Student Name'] || row['Employee Name'] || '').trim();
          const status = String(row['Status'] || row['Attendance'] || '').trim().toLowerCase();
          const date = String(row['Date'] || selectedDate || '').trim();
          const personType = 'employee';

          if (!personId && !personName) { failed++; continue; }
          if (!['present', 'absent', 'late'].includes(status)) { failed++; continue; }

          // Find matching person
          const person = employees.find(p => p.autoId === personId || p.name.toLowerCase() === personName.toLowerCase());
          if (!person) { failed++; continue; }

          try {
            await saveAttendance({
              personId: person.autoId,
              personName: person.name,
              personType: 'employee' as any,
              date,
              status: status as any,
              role: (person as any).role,
            });
            success++;
          } catch (err) { failed++; }
          await new Promise(r => setTimeout(r, 30));
        }
        await loadData();
        showNotification(`Imported ${success} attendance records${failed > 0 ? `, ${failed} failed` : ''}`, failed > 0 ? 'error' : 'success');
      } catch (error) { showNotification('Failed to read file', 'error'); }
    };
    reader.readAsArrayBuffer(file);
  };

  // ===== Download Attendance Template =====
  const downloadAttendanceTemplate = () => {
    const templateData = [
      { 'Auto ID': 'STU-001', 'Name': 'JOHN DOE', 'Date': selectedDate, 'Status': 'present' },
      { 'Auto ID': 'STU-002', 'Name': 'JANE DOE', 'Date': selectedDate, 'Status': 'absent' },
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance Template');
    XLSX.writeFile(wb, 'Attendance_Template.xlsx');
    showNotification('Template downloaded', 'success');
  };

  const exportMonthlySalaryReport = () => {
    const currentMonth = selectedDate.substring(0, 7);
    const activeEmps = employees.filter(e => e.status === 'ACTIVE');
    const data = activeEmps.map(e => {
      const si = getEmployeeSalaryInfo(e);
      const effAbsent = si.absentDays;
      const effSalary = si.earnedSalary;
      return {
        'Auto ID': e.autoId, 'Name': e.name, 'Role': e.role, 'Month': currentMonth,
        'Monthly Salary (₹)': si.monthlySalary, 'Working Days': si.workingDays,
        'Present Days': si.presentDays, 'Late Days': si.lateDays, 'CL Covered': si.clCovered, 'Effective Present': si.presentDays + si.lateDays + si.clCovered,
        'Absent Days': effAbsent,
        'Per Day (₹)': Math.round(si.perDaySalary), 'Earned Salary (₹)': effSalary
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Salary Report');
    XLSX.writeFile(wb, `salary_report_${currentMonth}.xlsx`);
    showNotification('Monthly salary report exported', 'success');
  };

  // ===== Monthly Attendance Grid Helpers =====
  const getMonthInfo = () => {
    const currentMonth = selectedDate.substring(0, 7); // YYYY-MM
    const [year, month] = currentMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const monthName = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    return { currentMonth, year, month, daysInMonth, monthName };
  };

  const getMonthlyStatus = (personId: string, day: number): string => {
    const { currentMonth } = getMonthInfo();
    const dateStr = `${currentMonth}-${day.toString().padStart(2, '0')}`;
    if (isHoliday(dateStr)) return 'H';
    const rec = attendance.find(a => a.personId === personId && a.date === dateStr);
    if (rec?.status === 'present') return 'P';
    if (rec?.status === 'late') return 'L';
    if (rec?.status === 'absent') return isClCovered(rec, currentMonth) ? 'C' : 'A';
    return '-';
  };

  const getSelectedMonthDays = () => {
    const currentMonth = selectedDate.substring(0, 7);
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

  // Approve (uses CL, no salary deduction) or disapprove (salary deducted) an absence.
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

  // ===== Monthly Attendance Excel (Grid Format) =====
  const exportMonthlyGridExcel = () => {
    const { currentMonth, daysInMonth, monthName } = getMonthInfo();
    const persons = employees.filter(e => e.status === 'ACTIVE');

    if (persons.length === 0) { showNotification('No records to export', 'error'); return; }

    // Build header row: Name + [1..31] + Total Present + Total Absent
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

    // Convert to worksheet with merged title
    const aoa: any[][] = [[`EMPLOYEE ATTENDANCE — ${monthName}`]];
    aoa.push(header);
    rows.forEach(r => aoa.push(r));

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 22 }, { wch: 12 }, ...Array(daysInMonth).fill({ wch: 4 }), { wch: 8 }, { wch: 8 }, { wch: 6 }];
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: header.length - 1 } }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Monthly Attendance');
    XLSX.writeFile(wb, `employee_monthly_attendance_${currentMonth}.xlsx`);
    showNotification(`Monthly attendance grid exported`, 'success');
  };

  // ===== Monthly Attendance PDF (Grid Format - Landscape) =====
  const exportMonthlyGridPDF = () => {
    const { currentMonth, daysInMonth, monthName } = getMonthInfo();
    const persons = employees.filter(e => e.status === 'ACTIVE');

    if (persons.length === 0) { showNotification('No records to export', 'error'); return; }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pw = 297;

    // Header
    doc.setFillColor(0, 102, 204); doc.rect(0, 0, pw, 22, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text(`${(schoolSettings.schoolName || 'School OS').toUpperCase()} — Employee Attendance`, 14, 14);
    doc.setFontSize(11); doc.setFont('helvetica', 'normal');
    doc.text(monthName, pw - 14, 14, { align: 'right' });

    // Legend
    doc.setTextColor(80, 80, 80); doc.setFontSize(8);
    doc.text('P = Present   |   L = Late (0.5 CL)   |   A = Absent   |   C = CL Approved   |   H = Holiday   |   - = Not Marked', 14, 30);

    // Build table
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
        // Highlight P/A total columns
        if (data.section === 'body' && (data.column.index === headerRow.length - 2 || data.column.index === headerRow.length - 1)) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 7;
        }
      }
    });

    doc.save(`${personType}_monthly_attendance_${currentMonth}.pdf`);
    showNotification(`Monthly attendance PDF exported`, 'success');
  };

  // ===== Clean Modern Salary Slip (fully audited, no special chars) =====
  const drawSalarySlip = (doc: any, emp: Employee, single: boolean, casualLeavesUsed: number = 0, salaryData?: SalarySlipData) => {
    const { monthName } = getMonthInfo();
    const si = salaryData ? {
      presentDays: salaryData.attendance.presentDays,
      absentDays: salaryData.attendance.absentDays,
      workingDays: salaryData.attendance.workingDays,
      monthlySalary: salaryData.salary.monthlyGross,
      perDaySalary: salaryData.salary.perDaySalary,
      earnedSalary: salaryData.salary.earnedSalary,
      deductions: salaryData.salary.deductions,
      netSalary: salaryData.salary.earnedSalary,
    } : getEmployeeSalaryInfo(emp);
    const bd = salaryData ? { grossSalary: salaryData.salary.monthlyGross, earnedSalary: salaryData.salary.earnedSalary, totalDeductions: salaryData.salary.deductions } : getSalaryBreakdown(emp, si);
    const pw = 210;
    const clUsed = salaryData ? salaryData.attendance.casualLeavesUsed : casualLeavesUsed;
    const annualQuota = salaryData ? salaryData.attendance.casualLeavesRemaining + clUsed : clQuota;
    const clRemaining = salaryData ? salaryData.attendance.casualLeavesRemaining : Math.max(0, annualQuota - casualLeavesUsed);

    // Color palette (RGB tuples) — derived from schoolSettings primary color
    const hexToRgb = (hex: string): [number, number, number] => {
      const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return r ? [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)] : [14, 165, 233];
    };
    const primary: [number, number, number] = hexToRgb(schoolSettings.primaryColor || '#0066cc');
    const [pr, pg, pb] = primary;
    // Lighter version of primary (blend with white 80%)
    const primaryLight: [number, number, number] = [
      Math.round(pr * 0.15 + 235 * 0.85),
      Math.round(pg * 0.15 + 242 * 0.85),
      Math.round(pb * 0.15 + 255 * 0.85)
    ];
    // Bank details box — lighter tint (blend with white 93%)
    const bankBoxBg: [number, number, number] = schoolSettings.salarySlipBankBoxColor
      ? hexToRgb(schoolSettings.salarySlipBankBoxColor)
      : [
          Math.round(pr * 0.07 + 248 * 0.93),
          Math.round(pg * 0.07 + 250 * 0.93),
          Math.round(pb * 0.07 + 255 * 0.93)
        ];
    const dark: [number, number, number] = [31, 41, 55];
    const muted: [number, number, number] = [107, 114, 128];
    const lightBg: [number, number, number] = [248, 250, 252];
    const line: [number, number, number] = [229, 231, 235];
    const accent: [number, number, number] = hexToRgb(schoolSettings.secondaryColor || '#4361ee');

    // Format money as plain ASCII (no unicode rupee symbol that may not render)
    const money = (val: number) => 'Rs ' + (val || 0).toLocaleString('en-IN');
    const trunc = (text: string, maxLen: number) => !text ? '-' : (text.length > maxLen ? text.substring(0, maxLen) + '...' : text);

    // Layout constants
    const ML = 16; // left margin
    const MR = pw - 16; // right margin
    const CW = MR - ML; // content width

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
    let y = 20;
    let logoW = 0;
    if (schoolSettings.schoolLogo) {
      try { doc.addImage(schoolSettings.schoolLogo, 'PNG', ML, 13, 18, 18); logoW = 22; } catch (e) {}
    }
    const nameX = logoW > 0 ? ML + logoW : ML;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...sPrimaryDark);
    doc.text(trunc((schoolSettings.schoolName || 'School OS').toUpperCase(), 40), nameX, 19);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...sTextSec);
    doc.text(trunc([schoolSettings.address || '', schoolSettings.phone || '', schoolSettings.email || ''].filter(Boolean).join(' | '), 70), nameX, 25);
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
    doc.text('Employee: ' + (salaryData ? salaryData.employee.name : emp.name), ML + 1 + padLg, 51);
    const pillTxt = 'SALARY SLIP';
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
    const pillW = doc.getTextWidth(pillTxt) + padMd * 2;
    const pillX = MR - padLg - pillW;
    doc.setFillColor(...sPrimaryLight); doc.setDrawColor(...sPrimaryLight);
    doc.roundedRect(pillX, 44, pillW, 10, 6, 6, 'FD');
    doc.setTextColor(...sPrimary); doc.text(pillTxt, pillX + pillW / 2, 51.5, { align: 'center' });

    // ============ 3. INFO CARDS ============
    y = 64;
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
      ['Employee ID', salaryData ? salaryData.employee.employeeId : emp.autoId],
      ['Designation', salaryData ? salaryData.employee.designation : (emp.role || '-')],
      ['Working Days', String(si.workingDays)],
      ['Present Days', String(si.presentDays)],
      ['Absent Days', String(si.absentDays)],
    ]);
    drawCard(ML + cardW + padLg, 'BANK & PAY DETAILS', [
      ['Department', salaryData ? salaryData.employee.department : (emp.department || '-')],
      ['Date of Joining', salaryData ? salaryData.employee.dateOfJoining : (emp.joinDate || '-')],
      ['Bank / Account No.', salaryData ? salaryData.employee.bankAccount : (emp.bankAccount || emp.panTaxId || '-')],
      ['PAN / Tax ID', salaryData ? (salaryData.employee.panTaxId || '-') : (emp.panTaxId || '-')],
      ['CL Used / Remaining', String(clUsed) + ' / ' + String(clRemaining)],
    ]);
    y = y + cardH + padMd + 2;

    // ============ 4. SALARY DETAILS CARD (two columns) ============
    const earnItems: [string, string][] = [
      ['Basic Salary', money(bd.grossSalary)],
      ['House Rent Allowance', 'Rs 0'],
      ['Travelling Allowance', 'Rs 0'],
      ['Medical Allowance', 'Rs 0'],
      ['Conveyance Allowance', 'Rs 0'],
    ];
    const otherDed = salaryData ? (salaryData.salary.deductions || 0) : ((emp.monthDeduction?.[selectedDate.substring(0, 7)] ?? emp.otherDeduction) || 0);
    const deductItems: [string, string][] = [
      ['EPF(%)', 'Rs 0'],
      ['PF(%)', 'Rs 0'],
      ['TDS', 'Rs 0'],
      ['Others(-)', money(otherDed)],
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
    doc.text(money(bd.grossSalary), valX, ss, { align: 'right' });
    ss += 8.5;

    doc.setFontSize(9.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...sTextSec);
    doc.text('Gross Deductions (B)', sumTableX + padLg, ss);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...sText);
    doc.text(money(otherDed), valX, ss, { align: 'right' });
    ss += padSm;

    doc.setDrawColor(...sBorder); doc.setLineWidth(0.12);
    doc.line(sumTableX + padLg, ss, sumTableX + sumTableW - padLg, ss);
    ss += padSm;

    doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(...sText);
    doc.text('Net Pay (A-B)', sumTableX + padLg, ss + 7);
    doc.setFontSize(13); doc.setTextColor(...sPrimaryDark);
    doc.text(money(bd.earnedSalary - otherDed), valX, ss + 7, { align: 'right' });

    // ============ 5. FOOTER ============
    doc.setDrawColor(...sBorder); doc.setLineWidth(0.12);
    doc.line(ML, 273, MR, 273);
    doc.setFontSize(8.5); doc.setTextColor(...sTextMuted); doc.setFont('helvetica', 'normal');
    doc.text('This is a computer-generated salary slip.', pw / 2, 278, { align: 'center' });
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
        drawSalarySlip(doc, emp, !!singleEmp, effectiveData.attendance.casualLeavesUsed, effectiveData);
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

  // ===== Salary Calculation for Employees =====
  const getEmployeeSalaryInfo = (employee: Employee) => {
    const currentMonth = selectedDate.substring(0, 7); // YYYY-MM
    const summ = getMonthAttSummary(employee.autoId, currentMonth, attendance, holidays);

    // Salary based on present+late+CL-covered days out of working days; approved CL is fully paid
    const monthlySalary = salaryType === 'old'
      ? (employee.monthSalary?.[currentMonth] ?? employee.oldSalary ?? employee.salary)
      : employee.salary;
    const perDaySalary = summ.workingDays > 0 ? monthlySalary / summ.workingDays : 0;
    const paidDays = summ.present + summ.late + summ.clApproved;
    const earnedSalary = Math.round(paidDays * perDaySalary);
    const deductions = Math.round(summ.absent * perDaySalary);
    const netSalary = earnedSalary;

    return { presentDays: summ.present, lateDays: summ.late, absentDays: summ.absent, clCovered: summ.clApproved, paidDays, workingDays: summ.workingDays, monthlySalary, perDaySalary, earnedSalary, deductions, netSalary };
  };

  const getSalarySlipDataForAttend = (emp: Employee, _clCount: number = 0): SalarySlipData => {
    const currentMonth = selectedDate.substring(0, 7);
    const monthName = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const info = getEmployeeSalaryInfo(emp);
    const annualQuota = getEmpClQuota(emp);
    const usedTotal = getClUsedTotal(emp.autoId, currentMonth, attendance);
    const remainingAnnual = Math.max(0, annualQuota - usedTotal);
    const perDaySalary = info.perDaySalary;
    const earnedSalary = Math.round((info.presentDays + info.lateDays + info.clCovered) * perDaySalary);
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
        workingDays: info.workingDays,
        presentDays: info.presentDays,
        absentDays: info.absentDays,
        casualLeavesUsed: usedTotal,
        casualLeavesRemaining: remainingAnnual,
      },
      salary: {
        monthlyGross: info.monthlySalary,
        perDaySalary: perDaySalary,
        earnedSalary: earnedSalary,
        allowances: 0,
        deductions: (emp.monthDeduction?.[currentMonth] ?? emp.otherDeduction) || 0,
      },
      payPeriod: monthName,
    };
  };

  // ===== Number to Words (Indian Rupee format) =====
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

  // ===== Salary Breakdown (Earnings + Deductions components) =====
  // ===== Simplified Salary Calculation (earned salary based on attendance) =====
  const getSalaryBreakdown = (emp: Employee, si: any) => {
    const currentMonth = selectedDate.substring(0, 7);
    const gross = salaryType === 'old'
      ? (emp.monthSalary?.[currentMonth] ?? emp.oldSalary ?? emp.salary)
      : emp.salary;
    // Earned salary = present days × per day salary (NO deductions, NO allowances)
    const earnedSalary = si.netSalary || Math.round(si.presentDays * si.perDaySalary);
    return { earnedSalary, grossSalary: gross };
  };

  // ===== Direct Pay (add salary as expense) =====
  const openDirectPay = (emp: Employee, amount: number) => {
    if (isReadOnly) { showNotification('Read-only mode: cannot add expense', 'error'); return; }
    const currentMonth = selectedDate.substring(0, 7);
    const otherDed = (emp.monthDeduction?.[currentMonth] ?? emp.otherDeduction) || 0;
    const netPay = Math.max(0, amount - otherDed);
    setDirectPay({ emp, amount: netPay });
    setDirectPayAmount(netPay);
  };

  const confirmDirectPay = async () => {
    if (!directPay || !handleDirectSalaryPay) return;
    const currentMonth = selectedDate.substring(0, 7);
    const monthName = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const expense = {
      category: 'Salaries',
      amount: Number(directPayAmount) || 0,
      description: `Salary payment for ${directPay.emp.name} — ${monthName}`,
      date: selectedDate,
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

  // ===== Stats =====
  const filteredEmployees = employees.filter(e => e.status === 'ACTIVE');
  const todayPresent = attendance.filter(a => a.date === selectedDate && a.personType === 'employee' && a.status === 'present').length;
  const todayAbsent = attendance.filter(a => a.date === selectedDate && a.personType === 'employee' && a.status === 'absent').length;

  const dayLabel = new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const statusInfo = dateStatus(selectedDate);

  const isEmployeePaidForMonth = (emp: Employee, month: string) => {
    return expenses.some(e =>
      e.employeeId === emp.autoId &&
      e.category === 'Salaries' &&
      e.status === 'paid' &&
      ((e.salaryMonth || '') === month || (e.date || '').startsWith(month))
    );
  };

  return (
    <div className="space-y-6">
      {/* Sub Tabs */}
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

      {/* School Name */}
      <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-2xl p-5">
        <p className="text-xs uppercase tracking-wide text-cyan-400 font-semibold">Attendance Register</p>
        <h2 className="text-2xl font-bold text-white mt-1">{schoolSettings.schoolName || 'School OS'}</h2>
        {schoolSettings.address && <p className="text-sm text-gray-400 mt-1">{schoolSettings.address}</p>}
      </div>

      {/* Date & Status */}
      <div className="bg-[#1E1E1E] p-6 rounded-2xl border border-gray-800">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <label className="text-xs text-cyan-400">Select Date</label>
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="block mt-1 p-3 bg-gray-800 rounded-lg border border-gray-700 text-white" />
            <p className="text-sm text-gray-400 mt-2">{dayLabel}</p>
            {statusInfo === 'sunday' && <span className="inline-block mt-2 px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-xs font-semibold">🌙 Auto Holiday (Sunday)</span>}
            {statusInfo === 'manual-holiday' && <span className="inline-block mt-2 px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-xs font-semibold">🎉 Holiday - {isManualHoliday(selectedDate, holidays)?.name}</span>}
            {statusInfo === 'working' && <span className="inline-block mt-2 px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-semibold">✅ Working Day</span>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800/50 px-6 py-4 rounded-xl text-center">
              <p className="text-3xl font-bold text-emerald-400">{todayPresent}</p>
              <p className="text-xs text-gray-400 mt-1">Present Today</p>
            </div>
            <div className="bg-gray-800/50 px-6 py-4 rounded-xl text-center">
              <p className="text-3xl font-bold text-red-400">{todayAbsent}</p>
              <p className="text-xs text-gray-400 mt-1">Absent Today</p>
            </div>
          </div>
        </div>
      </div>

      {/* Holiday Notice */}
      {isHoliday(selectedDate) && (
        <div className="bg-purple-500/10 border border-purple-500/30 p-6 rounded-2xl text-center">
          <div className="text-4xl mb-3">🎉</div>
          <h3 className="text-xl font-bold text-purple-400 mb-2">{statusInfo === 'sunday' ? 'Sunday Holiday' : isManualHoliday(selectedDate, holidays)?.name}</h3>
          <p className="text-gray-400">Attendance is disabled on holidays</p>
        </div>
      )}

      {/* ===== Employee Attendance ===== */}
      {subTab === 'employee' && !isHoliday(selectedDate) && (
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
              <div className="text-xs text-gray-400">Month: <span className="text-cyan-400 font-semibold">{getMonthInfo().monthName}</span></div>
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
                        <button type="button" onClick={() => { const cur = selectedEmployee.monthSalary?.[selectedDate.substring(0, 7)]; setMonthSalaryInput(String(cur ?? selectedEmployee.oldSalary ?? selectedEmployee.salary ?? '')); setEditMonthSalary(true); }} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 hover:bg-yellow-500/30 transition">Update Salary for Month</button>
                      )}
                      {salaryType === 'old' && editMonthSalary && (
                        <div className="flex items-center gap-2">
                          <input type="number" value={monthSalaryInput} onChange={e => setMonthSalaryInput(e.target.value)} className="w-28 px-2 py-1.5 bg-gray-800 border border-yellow-500/50 rounded-lg text-white text-xs" placeholder="Amount" />
                          <button type="button" onClick={async () => {
                            const amt = parseFloat(monthSalaryInput);
                            if (isNaN(amt) || amt < 0) { showNotification('Enter a valid amount', 'error'); return; }
                            const currentMonth = selectedDate.substring(0, 7);
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
                        return <div key={day.dateStr} className={`w-20 shrink-0 rounded-xl border p-2 text-center ${isHolidayDay ? 'bg-purple-500/10 border-purple-500/30' : 'bg-gray-800 border-gray-700'}`}><p className="text-xs text-gray-400">{day.weekday}</p><p className="text-lg font-bold text-white">{day.label}</p>{isHolidayDay ? <div className="mt-2 text-xs text-purple-400 font-bold">Holiday</div> : <div className="mt-2 flex flex-col gap-1"><button type="button" onClick={() => setMonthlyEmployeeAttendance(selectedEmployee, day.dateStr, 'present')} className={`px-2 py-1 rounded text-xs font-bold transition ${isPresent ? 'bg-emerald-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-emerald-600/50'}`}>P</button><button type="button" onClick={() => setMonthlyEmployeeAttendance(selectedEmployee, day.dateStr, 'late')} className={`px-2 py-1 rounded text-xs font-bold transition ${isLate ? 'bg-yellow-500 text-black' : 'bg-gray-700 text-gray-300 hover:bg-yellow-600/50'}`}>L</button><button type="button" onClick={() => setMonthlyEmployeeAttendance(selectedEmployee, day.dateStr, 'absent')} className={`px-2 py-1 rounded text-xs font-bold transition ${isAbsent ? 'bg-red-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-red-600/50'}`}>A</button></div>}</div>;
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
          {/* Monthly Report + Salary Slips Buttons */}
          <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 p-4 rounded-xl flex flex-col md:flex-row gap-3 md:items-center justify-between">
            <div>
              <h4 className="font-semibold text-purple-400 flex items-center gap-2"><FiCalendar size={16} /> Monthly Reports & Salary Slips</h4>
              <p className="text-xs text-gray-400 mt-1">{getMonthInfo().monthName} — Monthly grid + salary slips for all employees</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => exportMonthlyGridExcel()} className="flex items-center gap-2 bg-[#1E1E1E] border border-gray-800 hover:border-emerald-500/50 px-4 py-2 rounded-lg text-sm"><FiDownload size={16} />Monthly Excel</button>
              <button onClick={() => exportMonthlyGridPDF()} className="flex items-center gap-2 bg-[#1E1E1E] border border-gray-800 hover:border-red-500/50 px-4 py-2 rounded-lg text-sm"><FiFileText size={16} />Monthly PDF</button>
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
              {/* Salary Calculation Table */}
              <div className="bg-[#1E1E1E] rounded-2xl border border-gray-800 overflow-hidden">
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-3 p-6 pb-4">
                  <div>
                    <h3 className="text-lg font-bold flex items-center gap-2"><FiDollarSign className="text-yellow-400" /> Salary Calculation ({selectedDate.substring(0, 7)})</h3>
                    <p className="text-xs text-gray-400 mt-1">Salary based on present days. Sundays & holidays auto-excluded.</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowSalaryCalc(v => !v)} className="flex items-center justify-center gap-2 bg-[#1E1E1E] border border-gray-800 hover:border-cyan-500/50 px-5 py-2 rounded-xl self-start">
                      {showSalaryCalc ? <FiEyeOff size={16} /> : <FiEye size={16} />}{showSalaryCalc ? 'Hide' : 'Show'}
                    </button>
                    <button onClick={exportMonthlySalaryReport} className="flex items-center justify-center gap-2 bg-[#1E1E1E] border border-gray-800 hover:border-emerald-500/50 px-5 py-2 rounded-xl self-start"><FiDownload size={16} />Monthly Salary Report (Excel)</button>
                  </div>
                </div>
                {showSalaryCalc && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-800/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">Employee</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">Present</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">Absent</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 whitespace-nowrap hidden md:table-cell">Work Days</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 whitespace-nowrap hidden lg:table-cell">Per Day</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">CL Left</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">Earned Salary</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">Direct Pay</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">PDF</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEmployees.map(e => {
                        const info = getEmployeeSalaryInfo(e);
                        const annualQuota = getEmpClQuota(e);
                        const usedTotal = getClUsedTotal(e.autoId, selectedDate.substring(0, 7), attendance);
                        const remainingAnnual = Math.max(0, annualQuota - usedTotal);
                        const effAbsent = info.absentDays;
                        const effSalary = info.earnedSalary;
                        const clLeft = remainingAnnual;
                        const paid = isEmployeePaidForMonth(e, selectedDate.substring(0, 7));
                        return (
                          <tr key={e.id} className={`border-t border-gray-800 transition ${paid ? 'bg-red-500/20 hover:bg-red-500/30' : 'hover:bg-gray-800/30'}`}>
                            <td className="px-4 py-3"><p className="font-semibold text-sm">{e.name}</p><p className="text-xs text-gray-500">{e.role}</p></td>
                            <td className="px-4 py-3"><span className="text-emerald-400 font-semibold">{info.presentDays}</span>{info.lateDays > 0 && <span className="text-yellow-400 text-xs ml-1">+{info.lateDays}L</span>}{info.clCovered > 0 && <span className="text-cyan-400 text-xs ml-1">+{info.clCovered}CL</span>}</td>
                            <td className="px-4 py-3"><span className="text-red-400 font-semibold">{effAbsent}</span></td>
                            <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{info.workingDays}</td>
                            <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">₹{info.perDaySalary.toFixed(0)}</td>
                            <td className="px-4 py-3"><span className="text-cyan-400 font-semibold">{clLeft}</span></td>
                            <td className="px-4 py-3"><span className="font-bold text-yellow-400">₹{effSalary.toLocaleString()}</span></td>
                            <td className="px-4 py-3">
                              {paid ? (
                                <span className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 text-red-400 text-xs font-semibold rounded-lg border border-red-500/30">
                                  <FiCheck size={13} /> Paid
                                </span>
                              ) : (
                                <button
                                  onClick={() => openDirectPay(e, effSalary)}
                                  title={`Add salary expense for ${e.name}`}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-xs font-semibold rounded-lg shadow transition"
                                >
                                  <FiDollarSign size={13} /> Pay ₹{Math.max(0, effSalary - ((e.monthDeduction?.[selectedDate.substring(0, 7)] ?? e.otherDeduction) || 0)).toLocaleString()}
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

      {/* ===== Causal Leaves Management ===== */}
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
            <p className="text-xs text-gray-400 mb-4">
              Approve an absence to cover it with CL (no salary deduction, 1 CL used). Disapprove it to deduct salary for that day. Late marks use 0.5 CL each and count as present. Month shown: <span className="text-cyan-400 font-semibold">{selectedDate.substring(0, 7)}</span>
            </p>
            <select
              value={clViewEmpId}
              onChange={e => setClViewEmpId(e.target.value)}
              className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white mb-4"
            >
              <option value="">-- Select Employee --</option>
              {employees.filter(e => e.status === 'ACTIVE').sort((a, b) => a.name.localeCompare(b.name)).map(e => (
                <option key={e.id} value={e.autoId}>{e.name} — {e.role} ({e.autoId})</option>
              ))}
            </select>

            {clViewEmpId && (() => {
              const emp = employees.find(e => e.autoId === clViewEmpId);
              const currentMonthKey = selectedDate.substring(0, 7);
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
                    {summ.pending > 0 ? (
                      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-yellow-400">{summ.pending}</p>
                        <p className="text-xs text-gray-400 mt-1">Pending Decision</p>
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
                    <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-sm">
                      <FiClock className="text-yellow-400 shrink-0" />
                      <span className="text-gray-300">{lateDays} late mark{lateDays > 1 ? 's' : ''} this month — uses {lateDays * 0.5} CL ({lateDays * 0.5} day{lateDays * 0.5 === 1 ? '' : 's'}). Late marks already count as present for salary.</span>
                    </div>
                  )}

                  {summ.records.filter(r => r.status === 'absent').length === 0 ? (
                    <div className="text-center py-10">
                      <div className="text-5xl mb-3">📋</div>
                      <p className="text-gray-500">No absences recorded for {emp?.name} in {currentMonthKey}. Absences marked in the attendance grid will appear here for approval.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-800/50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Date</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Day</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summ.records.filter(r => r.status === 'absent').sort((a, b) => a.date.localeCompare(b.date)).map(rec => {
                            const isApproved = isClCovered(rec, currentMonthKey);
                            const isDisapproved = rec.clStatus === 'disapproved';
                            const wasAutoCovered = isApproved && !rec.clStatus;
                            return (
                              <tr key={rec.date + rec.personId} className="border-t border-gray-800 hover:bg-gray-800/30 transition">
                                <td className="px-4 py-3 font-mono text-cyan-400 text-sm">{rec.date}</td>
                                <td className="px-4 py-3 text-sm text-gray-400">{new Date(rec.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' })}</td>
                                <td className="px-4 py-3 text-sm">
                                  {isApproved ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold"><FiCheck size={12} /> {wasAutoCovered ? 'Covered — CL used (past month)' : 'Approved — CL used'}</span>
                                  ) : isDisapproved ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold"><FiX size={12} /> Disapproved — deducted</span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-semibold"><FiClock size={12} /> Pending</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  {!isReadOnly && (
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => setClApproval(rec, 'approved')}
                                        disabled={isApproved}
                                        title="Approve — use 1 CL, no salary deduction"
                                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${isApproved ? 'bg-emerald-500/20 text-emerald-400 cursor-default' : 'bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400'}`}
                                      >
                                        <FiCheck size={12} /> Approve
                                      </button>
                                      <button
                                        onClick={() => setClApproval(rec, 'disapproved')}
                                        disabled={isDisapproved}
                                        title="Disapprove — deduct salary for this day"
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
            })()}

            {!clViewEmpId && (
              <div className="text-center py-10">
                <div className="text-5xl mb-3">📋</div>
                <p className="text-gray-500">Select an employee to approve/disapprove absences and view their CL balance.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== Holidays Management ===== */}
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

      {/* ===== Direct Pay (Salary as Expense) Modal ===== */}
      {directPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !directPaying && setDirectPay(null)} />
          <div className="relative bg-[#1E1E1E] rounded-2xl border border-gray-800 w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold flex items-center gap-2"><FiDollarSign className="text-emerald-400" /> Direct Pay</h3>
              <button onClick={() => !directPaying && setDirectPay(null)} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400"><FiX size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400">Employee</label>
                <p className="font-semibold mt-1">{directPay.emp.name}</p>
              </div>
              <div>
                <label className="text-xs text-gray-400">Amount (₹)</label>
                <input
                  type="number" min={0}
                  value={directPayAmount}
                  onChange={e => setDirectPayAmount(Number(e.target.value))}
                  disabled={directPaying}
                  className="mt-1 w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white focus:border-cyan-500 transition"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Description (auto)</label>
                <input
                  type="text"
                  value={`Salary payment for ${directPay.emp.name} — ${new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`}
                  readOnly
                  className="mt-1 w-full p-3 bg-gray-800/50 rounded-lg border border-gray-700/50 text-gray-300"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Month (auto)</label>
                <input type="text" value={selectedDate.substring(0, 7)} readOnly className="mt-1 w-full p-3 bg-gray-800/50 rounded-lg border border-gray-700/50 text-gray-300" />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={confirmDirectPay}
                  disabled={directPaying || !handleDirectSalaryPay || directPayAmount <= 0}
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white px-4 py-3 rounded-xl font-semibold transition disabled:opacity-50"
                >
                  <FiCheck size={18} /> {directPaying ? 'Saving...' : `Pay & Add Expense (₹${directPayAmount.toLocaleString()})`}
                </button>
              </div>
              {directPaying && <div className="progressBar" />}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};