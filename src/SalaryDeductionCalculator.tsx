import React, { useState, useCallback } from 'react';
import {
  FiRefreshCw, FiDownload, FiFileText,
  FiClock, FiTrash2, FiEdit2, FiUser, FiBriefcase,
  FiDollarSign, FiCalendar, FiPlus, FiX, FiAlertCircle, FiCheck,
} from 'react-icons/fi';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addDoc, getDocs, collection, query, orderBy, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { getNextSequentialId } from './firebase';
import { exportProperExcel } from './utils/excelHelper';
import { calcSalary, DivisorMode } from './salaryCalc';

interface SalaryDeductionRecord {
  id?: string;
  autoId: string;
  employeeName: string;
  employeeId: string;
  designation: string;
  monthlySalary: number;
  salaryMonth: string; // YYYY-MM
  calcMethod: 'fixed30' | 'actualDays' | 'workingDays';
  scheduledWorkingDays?: number;
  unpaidLeaveDays: number;
  halfDayCount: number;
  otherDeduction: number;
  dailySalary: number;
  totalDeductionDays: number;
  leaveDeduction: number;
  totalDeduction: number;
  finalPayable: number;
  calcDate: string;
}

const METHOD_LABELS: Record<string, string> = {
  fixed30: 'Fixed 30 Days',
  actualDays: 'Actual Calendar Days',
  workingDays: 'Working Days',
};

const getDaysInMonth = (year: number, month: number): number => {
  // month is 1-12. Date(year, month, 0) gives last day of previous month,
  // so use month+1 to get last day of target month. Feb leap handled automatically.
  return new Date(year, month + 1, 0).getDate();
};

const formatMoney2 = (n: number): string => Number(n || 0).toFixed(2);

export const SalaryDeductionCalculator: React.FC<{ schoolSettings: any }> = ({
  schoolSettings,
}) => {
  // ---- Form state ----
  const [employeeName, setEmployeeName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [designation, setDesignation] = useState('');
  const [monthlySalary, setMonthlySalary] = useState('');
  const [salaryMonth, setSalaryMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [calcMethod, setCalcMethod] = useState<'fixed30' | 'actualDays' | 'workingDays'>('fixed30');
  const [unpaidLeaveDays, setUnpaidLeaveDays] = useState('');
  const [halfDayCount, setHalfDayCount] = useState('');
  const [otherDeduction, setOtherDeduction] = useState('');
  const [scheduledWorkingDays, setScheduledWorkingDays] = useState('');

  // ---- Results ----
  const [dailySalary, setDailySalary] = useState(0);
  const [totalDeductionDays, setTotalDeductionDays] = useState(0);
  const [leaveDeduction, setLeaveDeduction] = useState(0);
  const [totalDeductionAmt, setTotalDeductionAmt] = useState(0);
  const [finalPayable, setFinalPayable] = useState(0);

  // ---- History ----
  const [history, setHistory] = useState<SalaryDeductionRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'salaryDeductions'), orderBy('calcDate', 'desc'));
      const snap = await getDocs(q);
      const records: SalaryDeductionRecord[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as SalaryDeductionRecord));
      setHistory(records);
    } catch {
      // Firebase may not be configured; fall back to localStorage
      try {
        const ls = localStorage.getItem('salaryDeductionsHistory');
        if (ls) setHistory(JSON.parse(ls));
      } catch { /* ignore */ }
    } finally {
      setLoading(false);
    }
  }, []);

  const saveHistoryToStorage = useCallback((records: SalaryDeductionRecord[]) => {
    try { localStorage.setItem('salaryDeductionsHistory', JSON.stringify(records)); } catch { /* ignore */ }
  }, []);

  // ---- Calculation ----
  const calculate = useCallback(() => {
    const salary = Number(monthlySalary) || 0;
    const leave = Number(unpaidLeaveDays) || 0;
    const half = Number(halfDayCount) || 0;
    const other = Number(otherDeduction) || 0;

    const result = calcSalary({
      monthlySalary: salary,
      monthKey: salaryMonth,
      absentDays: leave,
      halfDays: half,
      otherDeduction: other,
      mode: calcMethod,
      scheduledWorkingDays: calcMethod === 'workingDays' ? Number(scheduledWorkingDays) || undefined : undefined,
    });

    setDailySalary(result.perDay);
    setTotalDeductionDays(result.deductionDays);
    setLeaveDeduction(result.leaveDeduction);
    setTotalDeductionAmt(result.totalDeduction);
    setFinalPayable(result.netSalary);
  }, [monthlySalary, salaryMonth, calcMethod, unpaidLeaveDays, halfDayCount, otherDeduction, scheduledWorkingDays]);

  const handleCalculate = () => {
    if (!employeeName.trim() || !employeeId.trim()) {
      alert('Employee Name and Employee ID are required.');
      return;
    }
    if (Number(monthlySalary) <= 0) {
      alert('Enter a valid Monthly Salary.');
      return;
    }
    calculate();
  };

  const handleReset = () => {
    setEmployeeName('');
    setEmployeeId('');
    setDesignation('');
    setMonthlySalary('');
    setUnpaidLeaveDays('');
    setHalfDayCount('');
    setOtherDeduction('');
    setScheduledWorkingDays('');
    setDailySalary(0);
    setTotalDeductionDays(0);
    setLeaveDeduction(0);
    setTotalDeductionAmt(0);
    setFinalPayable(0);
    setEditingId(null);
  };

  // ---- Save ----
  const handleSave = async () => {
    if (!employeeName.trim() || !employeeId.trim()) {
      alert('Employee Name and Employee ID are required.');
      return;
    }
    if (Number(monthlySalary) <= 0) {
      alert('Enter a valid Monthly Salary.');
      return;
    }
    calculate();

    const salary = Number(monthlySalary);
    const leave = Number(unpaidLeaveDays) || 0;
    const half = Number(halfDayCount) || 0;
    const other = Number(otherDeduction) || 0;

    const result = calcSalary({
      monthlySalary: salary,
      monthKey: salaryMonth,
      absentDays: leave,
      halfDays: half,
      otherDeduction: other,
      mode: calcMethod as DivisorMode,
      scheduledWorkingDays: calcMethod === 'workingDays' ? Number(scheduledWorkingDays) || undefined : undefined,
    });

    const record: SalaryDeductionRecord = {
      autoId: '',
      employeeName: employeeName.trim(),
      employeeId: employeeId.trim(),
      designation: designation.trim(),
      monthlySalary: salary,
      salaryMonth,
      calcMethod,
      ...(calcMethod === 'workingDays' ? { scheduledWorkingDays: Number(scheduledWorkingDays) || 0 } : {}),
      unpaidLeaveDays: leave,
      halfDayCount: half,
      otherDeduction: other,
      dailySalary: result.perDay,
      totalDeductionDays: result.deductionDays,
      leaveDeduction: result.leaveDeduction,
      totalDeduction: result.totalDeduction,
      finalPayable: result.netSalary,
      calcDate: new Date().toISOString(),
    };

    // Prevent duplicate for same employee + month unless updating existing
    const existing = history.find(h => h.employeeId === record.employeeId && h.salaryMonth === record.salaryMonth && h.id !== editingId);
    if (existing && !editingId) {
      if (!confirm(`A calculation already exists for ${employeeName} (${employeeId}) for ${salaryMonth}. Update it instead?`)) {
        return;
      }
    }

    try {
      setLoading(true);
      if (editingId) {
        // Update existing
        const payload: any = { ...record };
        delete payload.id;
        delete payload.autoId;
        await updateDoc(doc(db, 'salaryDeductions', editingId), payload);
        // Sync localStorage copy
        setHistory(prev => prev.map(h => (h.id === editingId ? { ...h, ...record, id: editingId } : h)));
        saveHistoryToStorage(history.map(h => (h.id === editingId ? { ...h, ...record, id: editingId } : h)));
        alert('Calculation updated successfully.');
      } else {
        const seq = await getNextSequentialId('salaryDeductions');
        record.autoId = 'SAL-DEDUCT-' + String(seq).padStart(3, '0');
        const payload = { ...record, createdAt: Timestamp.now() };
        delete payload.id;
        await addDoc(collection(db, 'salaryDeductions'), payload);
        const newRecord: SalaryDeductionRecord = { ...record, id: 'temp' };
        setHistory([newRecord, ...history]);
        saveHistoryToStorage([newRecord, ...history]);
        alert('Calculation saved successfully.');
      }
      setEditingId(null);
    } catch (err: any) {
      // Fallback: localStorage only
      try {
        if (editingId) {
          setHistory(prev => prev.map(h => (h.id === editingId ? { ...h, ...record, id: editingId } : h)));
        } else {
          record.autoId = 'SAL-DEDUCT-' + String(Date.now() % 100000).padStart(3, '0');
          const newRecord: SalaryDeductionRecord = { ...record, id: 'ls-' + Date.now() };
          setHistory([newRecord, ...history]);
        }
        saveHistoryToStorage(history);
        alert('Saved to local storage (Firebase unavailable).');
        setEditingId(null);
      } catch {
        alert('Failed to save calculation.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (rec: SalaryDeductionRecord) => {
    setEmployeeName(rec.employeeName);
    setEmployeeId(rec.employeeId);
    setDesignation(rec.designation);
    setMonthlySalary(String(rec.monthlySalary));
    setSalaryMonth(rec.salaryMonth);
    setCalcMethod(rec.calcMethod);
    setUnpaidLeaveDays(String(rec.unpaidLeaveDays));
    setHalfDayCount(String(rec.halfDayCount));
    setOtherDeduction(String(rec.otherDeduction));
    if (rec.scheduledWorkingDays) setScheduledWorkingDays(String(rec.scheduledWorkingDays));
    setEditingId(rec.id || null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this calculation record?')) return;
    try {
      await deleteDoc(doc(db, 'salaryDeductions', id));
      setHistory(prev => prev.filter(h => h.id !== id));
      saveHistoryToStorage(history.filter(h => h.id !== id));
      alert('Deleted.');
    } catch {
      setHistory(prev => prev.filter(h => h.id !== id));
      saveHistoryToStorage(history.filter(h => h.id !== id));
      alert('Deleted from local storage.');
    }
  };

  // ---- Export Excel ----
  const exportExcel = () => {
    if (history.length === 0) { alert('No history to export.'); return; }
    const data = history.map(r => ({
      'Auto ID': r.autoId,
      'Employee Name': r.employeeName,
      'Employee ID': r.employeeId,
      'Designation': r.designation,
      'Monthly Salary (₹)': r.monthlySalary,
      'Salary Month': r.salaryMonth,
      'Calc Method': METHOD_LABELS[r.calcMethod],
      'Unpaid Leave Days': r.unpaidLeaveDays,
      'Half-Day Count': r.halfDayCount,
      'Total Deduction Days': r.totalDeductionDays,
      'Daily Salary (₹)': r.dailySalary,
      'Leave Deduction (₹)': r.leaveDeduction,
      'Other Deduction (₹)': r.otherDeduction,
      'Total Deduction (₹)': r.totalDeduction,
      'Final Payable (₹)': r.finalPayable,
      'Calc Date': r.calcDate,
    }));
    const cols = [
      { header: 'Auto ID', key: 'Auto ID', width: 16 },
      { header: 'Employee Name', key: 'Employee Name', width: 22 },
      { header: 'Employee ID', key: 'Employee ID', width: 14 },
      { header: 'Designation', key: 'Designation', width: 18 },
      { header: 'Monthly Salary (₹)', key: 'Monthly Salary (₹)', width: 16, type: 'currency' as const },
      { header: 'Salary Month', key: 'Salary Month', width: 12 },
      { header: 'Calc Method', key: 'Calc Method', width: 16 },
      { header: 'Unpaid Leave Days', key: 'Unpaid Leave Days', width: 14 },
      { header: 'Half-Day Count', key: 'Half-Day Count', width: 12 },
      { header: 'Total Deduction Days', key: 'Total Deduction Days', width: 16 },
      { header: 'Daily Salary (₹)', key: 'Daily Salary (₹)', width: 16, type: 'currency' as const },
      { header: 'Leave Deduction (₹)', key: 'Leave Deduction (₹)', width: 16, type: 'currency' as const },
      { header: 'Other Deduction (₹)', key: 'Other Deduction (₹)', width: 16, type: 'currency' as const },
      { header: 'Total Deduction (₹)', key: 'Total Deduction (₹)', width: 16, type: 'currency' as const },
      { header: 'Final Payable (₹)', key: 'Final Payable (₹)', width: 16, type: 'currency' as const },
      { header: 'Calc Date', key: 'Calc Date', width: 20 },
    ];
    exportProperExcel({
      schoolSettings,
      title: 'Salary Deduction Calculation History',
      subtitle: `${history.length} calculation(s) exported`,
      filename: 'Salary_Deduction_History',
      sheetName: 'Deductions',
      columns: cols,
      data,
      showTotals: false,
      extraInfo: `Generated: ${new Date().toLocaleString()}`,
    }, (msg: string) => alert(msg));
  };

  // ---- Export PDF ----
  const exportPDF = () => {
    if (history.length === 0) { alert('No history to export.'); return; }
    const doc = new jsPDF();
    const pw = 210;
    doc.setFillColor(0, 102, 204); doc.rect(0, 0, pw, 22, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text('SALARY DEDUCTION CALCULATION — HISTORY', 14, 14);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Total Records: ${history.length}`, pw - 14, 14, { align: 'right' });

    const rows = history.map(r => [
      r.autoId,
      r.employeeName,
      r.employeeId,
      r.designation,
      `₹${formatMoney2(r.monthlySalary)}`,
      r.salaryMonth,
      METHOD_LABELS[r.calcMethod],
      String(r.unpaidLeaveDays),
      String(r.halfDayCount),
      String(r.totalDeductionDays),
      `₹${formatMoney2(r.dailySalary)}`,
      `₹${formatMoney2(r.leaveDeduction)}`,
      `₹${formatMoney2(r.otherDeduction)}`,
      `₹${formatMoney2(r.totalDeduction)}`,
      `₹${formatMoney2(r.finalPayable)}`,
      r.calcDate.substring(0, 10),
    ]);

    autoTable(doc, {
      head: [['Auto ID', 'Employee Name', 'Employee ID', 'Designation', 'Monthly Salary', 'Month', 'Method', 'Leave Days', 'Half Days', 'Deduct Days', 'Daily Salary', 'Leave Ded', 'Other Ded', 'Total Ded', 'Final Payable', 'Date']],
      body: rows,
      startY: 30,
      theme: 'striped',
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [0, 102, 204], textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold' },
    });
    doc.save('Salary_Deduction_History.pdf');
  };

  // ---- Print current calculation ----
  const printCurrent = () => {
    if (!employeeName.trim() || !employeeId.trim()) { alert('Fill employee details first.'); return; }
    calculate();
    const win = window.open('', '', 'width=800,height=700');
    if (!win) return;
    win.document.write(`
      <html><head><title>Salary Deduction Statement</title>
      <style>body{font-family:Arial,sans-serif;color:#111;padding:20px;}
      .header{text-align:center;border-bottom:2px solid #0066cc;padding-bottom:10px;margin-bottom:20px;}
      .label{font-weight:bold;color:#0066cc;} .val{text-align:right;}
      table{width:100%;border-collapse:collapse;margin-top:10px;}
      td{border:1px solid #ddd;padding:6px;} td.label{background:#f4f4f4;}
      .total{font-weight:bold;font-size:1.1em;color:#0066cc;}
      .print-btn{margin-top:20px;padding:10px 20px;background:#0066cc;color:#fff;border:none;border-radius:4px;cursor:pointer;}
      </style></head><body>
      <div class="header"><h2>Salary Deduction Calculation Statement</h2><p>Generated: ${new Date().toLocaleString()}</p></div>
      <table>
        <tr><td class="label">Employee Name</td><td class="val">${employeeName}</td></tr>
        <tr><td class="label">Employee ID</td><td class="val">${employeeId}</td></tr>
        <tr><td class="label">Designation</td><td class="val">${designation || '—'}</td></tr>
        <tr><td class="label">Monthly Salary</td><td class="val">₹${formatMoney2(Number(monthlySalary) || 0)}</td></tr>
        <tr><td class="label">Salary Month</td><td class="val">${salaryMonth}</td></tr>
        <tr><td class="label">Calculation Method</td><td class="val">${METHOD_LABELS[calcMethod]}</td></tr>
        <tr><td class="label">Daily Salary</td><td class="val">₹${formatMoney2(dailySalary)}</td></tr>
        <tr><td class="label">Unpaid Leave Days</td><td class="val">${unpaidLeaveDays || 0}</td></tr>
        <tr><td class="label">Half-Day Count</td><td class="val">${halfDayCount || 0}</td></tr>
        <tr><td class="label">Total Deduction Days</td><td class="val">${totalDeductionDays}</td></tr>
        <tr><td class="label">Leave Deduction</td><td class="val">₹${formatMoney2(leaveDeduction)}</td></tr>
        <tr><td class="label">Other Deduction</td><td class="val">₹${formatMoney2(Number(otherDeduction) || 0)}</td></tr>
        <tr><td class="label">Total Deduction</td><td class="val">₹${formatMoney2(totalDeductionAmt)}</td></tr>
        <tr class="total"><td class="label">Final Payable Salary</td><td class="val">₹${formatMoney2(finalPayable)}</td></tr>
      </table>
      <button class="print-btn" onclick="window.print()">Print Statement</button>
      </body></html>`);
    win.document.close();
    win.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#1E1E1E] rounded-2xl border border-gray-800 p-6">
        <div className="flex items-center gap-3 mb-3">
          <FiDollarSign size={24} className="text-cyan-400" />
          <h1 className="text-2xl font-bold text-white">Salary Deduction Calculator</h1>
        </div>
        <p className="text-gray-400 text-sm mb-4">
          Calculate monthly salary deductions for unpaid leave (LWP) and half-days. Supports three calculation methods.
        </p>
        <div className="flex flex-wrap gap-3">
          <button onClick={handleCalculate} disabled={loading} className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white rounded-lg font-bold shadow-lg shadow-cyan-500/20 disabled:opacity-60">
            {loading ? 'Calculating…' : 'Calculate'}
          </button>
          <button onClick={handleReset} className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold">
            Reset
          </button>
          <button onClick={handleSave} disabled={loading} className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-lg font-bold shadow-lg shadow-emerald-500/20 disabled:opacity-60">
            Save Calculation
          </button>
          <button onClick={() => setShowHistory(!showHistory)} className="px-5 py-2.5 bg-purple-500/10 border border-purple-500/30 text-purple-400 rounded-lg font-bold hover:bg-purple-500/20">
            {showHistory ? 'Hide' : 'Show'} History
          </button>
          <button onClick={printCurrent} className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold">
            Print Statement
          </button>
          <button onClick={exportPDF} className="px-5 py-2.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg font-bold hover:bg-red-500/20">
            Download PDF
          </button>
          <button onClick={exportExcel} className="px-5 py-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg font-bold hover:bg-emerald-500/20">
            Download Excel
          </button>
        </div>
      </div>

      {/* Input Form */}
      <div className="bg-[#1E1E1E] rounded-2xl border border-gray-800 p-6">
        <h3 className="text-lg font-bold text-cyan-400 mb-4 flex items-center gap-2"><FiUser size={18} /> Employee Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-xs text-cyan-400">Employee Name *</label>
            <input value={employeeName} onChange={e => setEmployeeName(e.target.value)} placeholder="Full name" className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white" />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-cyan-400">Employee ID *</label>
            <input value={employeeId} onChange={e => setEmployeeId(e.target.value.toUpperCase())} placeholder="EMP-001" className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white uppercase" />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-cyan-400">Designation</label>
            <input value={designation} onChange={e => setDesignation(e.target.value)} placeholder="Teacher / Staff" className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white uppercase" />
          </div>
        </div>

        <h3 className="text-lg font-bold text-cyan-400 mb-4 mt-6 flex items-center gap-2"><FiDollarSign size={18} /> Salary & Deduction</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-xs text-cyan-400">Monthly Salary (₹) *</label>
            <input type="number" min={0} value={monthlySalary} onChange={e => setMonthlySalary(e.target.value)} placeholder="9000" className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white" />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-cyan-400">Salary Month *</label>
            <input type="month" value={salaryMonth} onChange={e => setSalaryMonth(e.target.value)} className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white" />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-cyan-400">Calculation Method</label>
            <select value={calcMethod} onChange={e => setCalcMethod(e.target.value as 'fixed30' | 'actualDays' | 'workingDays')} className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white">
              <option value="fixed30">Method A — Fixed 30 Days</option>
              <option value="actualDays">Method B — Actual Calendar Days</option>
              <option value="workingDays">Method C — Working Days</option>
            </select>
            {calcMethod === 'workingDays' && (
              <div className="space-y-1 mt-2">
                <label className="text-xs text-gray-500">Scheduled Working Days</label>
                <input type="number" min={1} value={scheduledWorkingDays} onChange={e => setScheduledWorkingDays(e.target.value)} placeholder="26" className="w-full p-2.5 bg-gray-800 rounded border border-gray-700 text-white" />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-xs text-cyan-400">Unpaid Leave Days</label>
            <input type="number" min={0} step={0.5} value={unpaidLeaveDays} onChange={e => setUnpaidLeaveDays(e.target.value)} placeholder="0" className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white" />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-cyan-400">Half-Day Count</label>
            <input type="number" min={0} step={0.5} value={halfDayCount} onChange={e => setHalfDayCount(e.target.value)} placeholder="0" className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white" />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-cyan-400">Other Deduction (₹)</label>
            <input type="number" min={0} value={otherDeduction} onChange={e => setOtherDeduction(e.target.value)} placeholder="0" className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white" />
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="bg-[#1E1E1E] rounded-2xl border border-emerald-500/30 p-6">
        <h3 className="text-lg font-bold text-emerald-400 mb-4 flex items-center gap-2"><FiBriefcase size={18} /> Calculation Result</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
            <p className="text-xs text-gray-400">Daily Salary</p>
            <p className="text-2xl font-bold text-white">₹${formatMoney2(dailySalary)}</p>
          </div>
          <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
            <p className="text-xs text-gray-400">Total Deduction Days</p>
            <p className="text-2xl font-bold text-yellow-400">${totalDeductionDays}</p>
          </div>
          <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
            <p className="text-xs text-gray-400">Leave Deduction</p>
            <p className="text-xl font-bold text-red-400">₹${formatMoney2(leaveDeduction)}</p>
          </div>
          <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
            <p className="text-xs text-gray-400">Other Deduction</p>
            <p className="text-xl font-bold text-gray-400">₹${formatMoney2(Number(otherDeduction) || 0)}</p>
          </div>
          <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
            <p className="text-xs text-gray-400">Total Deduction</p>
            <p className="text-xl font-bold text-red-400">₹${formatMoney2(totalDeductionAmt)}</p>
          </div>
          <div className="bg-emerald-500/20 p-4 rounded-xl border border-emerald-500/30">
            <p className="text-xs text-emerald-400">Final Payable Salary</p>
            <p className="text-3xl font-bold text-emerald-400">₹${formatMoney2(finalPayable)}</p>
          </div>
        </div>
        <div className="mt-4 p-3 bg-gray-800/30 rounded-lg border border-gray-700 text-xs text-gray-400">
          <p className="mb-1"><span className="label">Formula:</span> Daily Salary = Monthly Salary ÷ {calcMethod === 'fixed30' ? '30' : calcMethod === 'actualDays' ? `Days in ${salaryMonth}` : 'Scheduled Working Days'}</p>
          <p><span className="label">Deduction Days:</span> {unpaidLeaveDays || 0} + ({halfDayCount || 0} × 0.5) = {totalDeductionDays}</p>
          <p><span className="label">Final:</span> ₹${formatMoney2(Number(monthlySalary) || 0)} − ₹${formatMoney2(totalDeductionAmt)} = ₹${formatMoney2(finalPayable)}</p>
        </div>
      </div>

      {/* History */}
      {showHistory && (
        <div className="bg-[#1E1E1E] rounded-2xl border border-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-purple-400 flex items-center gap-2"><FiClock size={18} /> Calculation History</h3>
            <button onClick={handleReset} className="text-xs text-red-400 hover:text-red-300">Clear Form</button>
          </div>
          {loading ? (
            <p className="text-gray-400 text-sm">Loading history…</p>
          ) : history.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No saved calculations yet.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Auto ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Employee</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Month</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400">Monthly Salary</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400">Deduction Days</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400">Total Deduction</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400">Final Payable</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(r => (
                    <tr key={r.id || r.autoId} className="border-t border-gray-800 hover:bg-gray-800/30 transition">
                      <td className="px-4 py-3 font-mono text-cyan-400">{r.autoId}</td>
                      <td className="px-4 py-3 text-gray-300">{r.employeeName}</td>
                      <td className="px-4 py-3 text-gray-400 font-mono">{r.employeeId}</td>
                      <td className="px-4 py-3 text-gray-400">{r.salaryMonth}</td>
                      <td className="px-4 py-3 text-right text-gray-300">₹${formatMoney2(r.monthlySalary)}</td>
                      <td className="px-4 py-3 text-right text-yellow-400">{r.totalDeductionDays}</td>
                      <td className="px-4 py-3 text-right text-red-400">₹${formatMoney2(r.totalDeduction)}</td>
                      <td className="px-4 py-3 text-right text-emerald-400 font-bold">₹${formatMoney2(r.finalPayable)}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => handleEdit(r)} className="text-cyan-400 hover:text-cyan-300 p-1 hover:bg-cyan-500/20 rounded" title="Edit"><FiEdit2 size={14} /></button>
                        <button onClick={() => handleDelete(r.id || '')} className="ml-1 text-red-400 hover:text-red-300 p-1 hover:bg-red-500/20 rounded" title="Delete"><FiTrash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={exportPDF} className="px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded hover:bg-red-500/20"><FiFileText size={14} /> PDF</button>
              <button onClick={exportExcel} className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded hover:bg-emerald-500/20"><FiDownload size={14} /> Excel</button>
              {!loading && (
                <button onClick={loadHistory} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded hover:bg-gray-600"><FiRefreshCw size={14} /> Refresh</button>
              )}
            </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SalaryDeductionCalculator;
