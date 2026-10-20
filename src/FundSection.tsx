import React, { useState, useCallback, useEffect } from 'react';
import { FiPlus, FiDollarSign, FiDownload, FiFileText, FiUpload, FiEdit2, FiTrash2, FiSearch, FiClock, FiArrowRight, FiCheck, FiX, FiArrowLeft, FiRefreshCw, FiEye } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addFund, getFunds, updateFund, deleteFund, getNextSequentialId } from './firebase';
import { exportProperExcel } from './utils/excelHelper';

interface FundSectionProps {
  schoolSettings: any;
  fees: any[];
  expenses: any[];
  showNotification: (msg: string, type: 'success' | 'error') => void;
  isReadOnly?: boolean;
}

export const FundSection: React.FC<FundSectionProps> = ({
  schoolSettings, fees, expenses, showNotification, isReadOnly
}) => {
  const [funds, setFunds] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'return'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [showAll, setShowAll] = useState(false);

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'add' | 'edit'>('add');
  const [editingFund, setEditingFund] = useState<any>(null);
  const [fundForm, setFundForm] = useState({
    type: 'income' as 'income' | 'return',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    status: 'pending' as 'pending' | 'completed',
    willBeReturned: false,
    returnAmount: '',
    paidTo: '',
  });

  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returningFund, setReturningFund] = useState<any>(null);
  const [returnAmount, setReturnAmount] = useState('');
  const [returnPaidTo, setReturnPaidTo] = useState('');

  const loadFunds = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getFunds();
      setFunds(data as any[]);
    } catch (error) {
      showNotification('Failed to load funds', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  // Load funds when the page opens
  useEffect(() => {
    loadFunds();
  }, [loadFunds]);

  const formatAmt = (n: number) => n.toLocaleString('en-IN');

  const filteredFunds = funds.filter(f => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = f.autoId.toLowerCase().includes(q) ||
      f.description.toLowerCase().includes(q) ||
      (f.paidTo || '').toLowerCase().includes(q);
    const matchesType = typeFilter === 'all' || f.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || f.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  // Summary — Unified Net Revenue
  const totalFees = fees.filter(f => f.status === 'paid').reduce((s, f) => s + (Number(f.amount) || 0), 0);
  const totalFundIncome = funds.filter(f => f.type === 'income').reduce((s, f) => s + f.amount, 0);
  const totalExpenses = expenses.filter(e => e.status === 'paid').reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const totalFundReturns = funds.filter(f => f.type === 'return').reduce((s, f) => s + f.amount, 0);
  const pendingReturn = funds.filter(f => f.type === 'income' && f.willBeReturned && f.status === 'pending')
    .reduce((s, f) => s + Math.max(0, (f.returnAmount || 0) - (f.returnedAmount || 0)), 0);

  const totalMoneyIn = totalFees + totalFundIncome;
  const totalMoneyOut = totalExpenses + totalFundReturns;
  const netRevenue = totalMoneyIn - totalMoneyOut;

  const resetFundForm = () => {
    setFundForm({
      type: 'income',
      amount: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      status: 'pending',
      willBeReturned: false,
      returnAmount: '',
      paidTo: '',
    });
  };

  const handleSaveFund = async () => {
    if (isReadOnly) { showNotification('Read-only mode: cannot save fund', 'error'); return; }
    const amt = parseFloat(fundForm.amount) || 0;
    if (amt <= 0) { showNotification('Enter a valid amount', 'error'); return; }
    if (!fundForm.description.trim()) { showNotification('Description is required', 'error'); return; }
    if (!fundForm.date) { showNotification('Date is required', 'error'); return; }

    const willReturn = fundForm.willBeReturned;
    const retAmt = willReturn ? (parseFloat(fundForm.returnAmount) || 0) : 0;
    if (willReturn && retAmt <= 0) { showNotification('Enter return amount when "Will Be Returned" is ON', 'error'); return; }

    try {
      const seq = await getNextSequentialId('funds');
      const final: any = {
        autoId: 'FND-' + String(seq).padStart(3, '0'),
        type: fundForm.type,
        amount: amt,
        description: fundForm.description.trim(),
        date: fundForm.date,
        status: fundForm.status,
        willBeReturned: willReturn,
        returnAmount: retAmt,
        returnedAmount: 0,
        createdAt: Date.now(),
      };
      // Only include paidTo when willBeReturned is true and a recipient is set (Firestore rejects undefined)
      if (willReturn && fundForm.paidTo.trim()) {
        final.paidTo = fundForm.paidTo.trim();
      }
      // returnedDate is only set when a return actually happens — do not store undefined
      if (modalType === 'edit' && editingFund) {
        await updateFund(editingFund.id, final);
        showNotification('Fund updated successfully', 'success');
      } else {
        await addFund(final);
        showNotification(`Fund ${fundForm.type === 'income' ? 'added' : 'returned'} successfully`, 'success');
      }
      setAddModalOpen(false);
      resetFundForm();
      setEditingFund(null);
      setModalType('add');
      await loadFunds();
    } catch (error: any) {
      showNotification('Failed to save fund: ' + (error?.message || 'Unknown error'), 'error');
    }
  };

  const handleEditFund = (f: any) => {
    setEditingFund(f);
    setModalType('edit');
    setFundForm({
      type: f.type,
      amount: String(f.amount),
      description: f.description || '',
      date: f.date || new Date().toISOString().split('T')[0],
      status: f.status || 'pending',
      willBeReturned: f.willBeReturned || false,
      returnAmount: f.returnAmount ? String(f.returnAmount) : '',
      paidTo: f.paidTo || '',
    });
    setAddModalOpen(true);
  };

  const handleDeleteFund = async (id: string) => {
    if (isReadOnly) { showNotification('Read-only mode: cannot delete fund', 'error'); return; }
    if (!confirm('Delete this fund record?')) return;
    try {
      await deleteFund(id);
      await loadFunds();
      showNotification('Fund deleted', 'success');
    } catch (error: any) {
      showNotification('Failed to delete fund: ' + (error?.message || 'Unknown error'), 'error');
    }
  };

  const handleConfirmReturn = async () => {
    if (!returningFund) return;
    const amt = parseFloat(returnAmount) || 0;
    if (amt <= 0) { showNotification('Enter a valid return amount', 'error'); return; }
    const remaining = (returningFund.returnAmount || 0) - (returningFund.returnedAmount || 0);
    if (amt > remaining) { showNotification(`Return amount cannot exceed remaining ₹${formatAmt(remaining)}`, 'error'); return; }

    try {
      const newReturned = (returningFund.returnedAmount || 0) + amt;
      const status = newReturned >= (returningFund.returnAmount || 0) ? 'completed' : 'pending';
      await updateFund(returningFund.id, {
        returnedAmount: newReturned,
        returnedDate: new Date().toISOString().split('T')[0],
        paidTo: returnPaidTo.trim() || returningFund.paidTo,
        status,
      });
      // Create matching "return" type record
      const seq2 = await getNextSequentialId('funds');
      const retPaidTo = returnPaidTo.trim() || returningFund.paidTo || undefined;
      await addFund({
        autoId: 'RET-' + String(seq2).padStart(3, '0'),
        type: 'return',
        amount: amt,
        description: `Return of ${returningFund.autoId} — ${returningFund.description}`,
        date: new Date().toISOString().split('T')[0],
        status: 'completed',
        willBeReturned: false,
        returnAmount: 0,
        returnedAmount: amt,
        ...(retPaidTo ? { paidTo: retPaidTo } : {}),
        createdAt: Date.now(),
      });
      setReturnModalOpen(false);
      setReturningFund(null);
      setReturnAmount('');
      setReturnPaidTo('');
      await loadFunds();
      showNotification(`Return of ₹${formatAmt(amt)} recorded`, 'success');
    } catch (error: any) {
      showNotification('Failed to record return: ' + (error?.message || 'Unknown error'), 'error');
    }
  };

  const exportFundsExcel = () => {
    if (funds.length === 0) { showNotification('No funds to export', 'error'); return; }
    const data = funds.map(f => ({
      autoId: f.autoId,
      type: f.type,
      amount: f.amount,
      description: f.description,
      date: f.date,
      status: f.status,
      willBeReturned: f.willBeReturned ? 'Yes' : 'No',
      returnAmount: f.returnAmount || 0,
      returnedAmount: f.returnedAmount || 0,
      returnedDate: f.returnedDate || '-',
      paidTo: f.paidTo || '-',
    }));
    const cols = [
      { header: 'Auto ID', key: 'autoId', width: 14 },
      { header: 'Type', key: 'type', width: 12 },
      { header: 'Amount', key: 'amount', width: 14, type: 'currency' as const },
      { header: 'Description', key: 'description', width: 30 },
      { header: 'Date', key: 'date', width: 12, type: 'date' as const },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Will Be Returned', key: 'willBeReturned', width: 16 },
      { header: 'Return Amount', key: 'returnAmount', width: 14, type: 'currency' as const },
      { header: 'Returned Amount', key: 'returnedAmount', width: 16, type: 'currency' as const },
      { header: 'Returned Date', key: 'returnedDate', width: 14 },
      { header: 'Paid To', key: 'paidTo', width: 20 },
    ];
    exportProperExcel({
      schoolSettings,
      title: 'Fund Register — Income & Returns',
      subtitle: `Money In: ₹${formatAmt(totalMoneyIn)} • Money Out: ₹${formatAmt(totalMoneyOut)} • Net Revenue: ₹${formatAmt(netRevenue)}`,
      filename: 'Fund_Register',
      sheetName: 'Funds',
      columns: cols,
      data,
      showTotals: true,
      extraInfo: `Generated: ${new Date().toLocaleString('en-IN')}`,
    }, showNotification);
  };

  const exportFundsPDF = () => {
    if (funds.length === 0) { showNotification('No funds to export', 'error'); return; }
    const doc = new jsPDF();
    const pw = 210;
    doc.setFillColor(0, 102, 204); doc.rect(0, 0, pw, 22, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text(`${(schoolSettings.schoolName || 'School OS').toUpperCase()} — Fund Register`, 14, 14);
    doc.setFontSize(11); doc.setFont('helvetica', 'normal');
    doc.text(`Money In: ₹${formatAmt(totalMoneyIn)}  |  Money Out: ₹${formatAmt(totalMoneyOut)}  |  Net Revenue: ₹${formatAmt(netRevenue)}`, pw - 14, 14, { align: 'right' });

    const rows = funds.map(f => [
      f.autoId,
      f.type,
      f.amount,
      f.description,
      f.date,
      f.status,
      f.willBeReturned ? 'Yes' : 'No',
      f.returnAmount || 0,
      f.returnedAmount || 0,
      f.returnedDate || '-',
      f.paidTo || '-',
    ]);

    autoTable(doc, {
      head: [['Auto ID', 'Type', 'Amount', 'Description', 'Date', 'Status', 'Will Return', 'Return Amt', 'Returned Amt', 'Return Date', 'Paid To']],
      body: rows,
      startY: 30,
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [0, 102, 204], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 1) {
          const val = String(data.cell.raw || '');
          data.cell.styles.textColor = val === 'income' ? [16, 185, 129] : [239, 68, 68];
          data.cell.styles.fontStyle = 'bold';
        }
        if (data.section === 'body' && data.column.index === 5) {
          const val = String(data.cell.raw || '');
          data.cell.styles.textColor = val === 'completed' ? [16, 185, 129] : [234, 179, 8];
        }
      },
    });

    doc.save(`fund_register_${new Date().toISOString().split('T')[0]}.pdf`);
    showNotification('Fund register exported to PDF', 'success');
  };

  const toggleSwitch = (checked: boolean, onChange: (v: boolean) => void) => (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={e => onChange(e.target.checked)} />
      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
    </label>
  );

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#1E1E1E] p-6 rounded-2xl border border-emerald-500/30">
          <p className="text-gray-400 text-xs uppercase font-semibold">Total Money In</p>
          <p className="text-3xl font-bold text-emerald-400 mt-1">₹{formatAmt(totalMoneyIn)}</p>
          <p className="text-[10px] text-gray-500 mt-1">Fees: ₹{formatAmt(totalFees)} + Fund: ₹{formatAmt(totalFundIncome)}</p>
        </div>
        <div className="bg-[#1E1E1E] p-6 rounded-2xl border border-rose-500/30">
          <p className="text-gray-400 text-xs uppercase font-semibold">Total Money Out</p>
          <p className="text-3xl font-bold text-rose-400 mt-1">₹{formatAmt(totalMoneyOut)}</p>
          <p className="text-[10px] text-gray-500 mt-1">Expenses: ₹{formatAmt(totalExpenses)} + Returns: ₹{formatAmt(totalFundReturns)}</p>
        </div>
        <div className="bg-[#1E1E1E] p-6 rounded-2xl border border-yellow-500/30">
          <p className="text-gray-400 text-xs uppercase font-semibold">Pending Return</p>
          <p className="text-3xl font-bold text-yellow-400 mt-1">₹{formatAmt(pendingReturn)}</p>
          <p className="text-[10px] text-gray-500 mt-1">Fund income yet to be returned</p>
        </div>
        <div className="bg-[#1E1E1E] p-6 rounded-2xl border border-purple-500/30">
          <p className="text-gray-400 text-xs uppercase font-semibold">Net Revenue</p>
          <p className={`text-3xl font-bold mt-1 ${netRevenue >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            ₹{formatAmt(netRevenue)}
          </p>
          <p className="text-[10px] text-gray-500 mt-1">Money In − Money Out</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row gap-4 items-end">
        <div className="flex-1 relative">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            placeholder="Search by ID, description, or recipient..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-[#1E1E1E] border border-gray-800 rounded-xl focus:outline-none focus:border-cyan-500 transition"
          />
        </div>
        <div className="flex gap-2">
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)} className="p-3 bg-[#1E1E1E] border border-gray-800 rounded-xl text-white">
            <option value="all">All Types</option>
            <option value="income">Income Only</option>
            <option value="return">Returns Only</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="p-3 bg-[#1E1E1E] border border-gray-800 rounded-xl text-white">
            <option value="all">All Status</option>
            <option value="pending">Pending Only</option>
            <option value="completed">Completed Only</option>
          </select>
          {!isReadOnly && (
            <div className="flex gap-2">
              <button onClick={() => { resetFundForm(); setModalType('add'); setEditingFund(null); setAddModalOpen(true); }}
                className="px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl font-semibold flex items-center gap-2 transition">
                <FiPlus size={16} /> Add Income
              </button>
              <button onClick={() => { resetFundForm(); setFundForm({ ...fundForm, type: 'return' }); setModalType('add'); setEditingFund(null); setAddModalOpen(true); }}
                className="px-4 py-3 bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600 text-white rounded-xl font-semibold flex items-center gap-2 transition">
                <FiDollarSign size={16} /> Add Return
              </button>
            </div>
          )}
          <button onClick={exportFundsExcel} className="px-4 py-3 bg-[#1E1E1E] border border-gray-800 hover:border-emerald-500/50 rounded-xl text-white font-semibold"><FiDownload size={16} />Excel</button>
          <button onClick={exportFundsPDF} className="px-4 py-3 bg-[#1E1E1E] border border-gray-800 hover:border-red-500/50 rounded-xl text-white font-semibold"><FiFileText size={16} />PDF</button>
          {!isReadOnly && <label className="px-4 py-3 bg-[#1E1E1E] border border-gray-800 hover:border-yellow-500/50 rounded-xl text-white font-semibold cursor-pointer"><FiUpload size={16} />Import<input type="file" accept=".xlsx,.xls" className="hidden" /></label>}
        </div>
      </div>

      {/* Funds Table */}
      <div className="bg-[#1E1E1E] rounded-2xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">Auto ID</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">Type</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">Amount</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">Description</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">Date</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">Status</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">Will Return</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 whitespace-nowrap">Return Amt</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 whitespace-nowrap">Returned</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">Paid To</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredFunds.slice(0, showAll ? undefined : 8).map(f => (
                <tr key={f.id} className="border-t border-gray-800 hover:bg-gray-800/30 transition">
                  <td className="px-6 py-3 font-mono text-cyan-400 text-sm">{f.autoId}</td>
                  <td className="px-6 py-3 text-sm">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${f.type === 'income' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                      {f.type === 'income' ? 'Income' : 'Return'}
                    </span>
                  </td>
                  <td className="px-6 py-3 font-semibold text-sm">₹{formatAmt(f.amount)}</td>
                  <td className="px-6 py-3 text-sm text-gray-300">{f.description}</td>
                  <td className="px-6 py-3 text-sm text-gray-400 font-mono">{f.date}</td>
                  <td className="px-6 py-3 text-sm">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${f.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                      {f.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm">
                    {f.willBeReturned ? (
                      <span className="text-yellow-400 text-xs font-semibold">Yes</span>
                    ) : (
                      <span className="text-gray-500 text-xs">No</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right text-sm text-gray-300">₹{formatAmt(f.returnAmount || 0)}</td>
                  <td className="px-6 py-3 text-right text-sm">
                    <span className={f.returnedAmount > 0 ? 'text-emerald-400 font-semibold' : 'text-gray-500'}>
                      ₹{formatAmt(f.returnedAmount || 0)}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-400">{f.paidTo || '-'}</td>
                  <td className="px-6 py-3">
                    {!isReadOnly && (
                      <div className="flex gap-1">
                        {f.type === 'income' && f.willBeReturned && (
                          <button
                            onClick={() => { setReturningFund(f); setReturnModalOpen(true); setReturnAmount(String(f.returnAmount || 0)); setReturnPaidTo(f.paidTo || ''); }}
                            className="px-2 py-1.5 bg-yellow-500/20 text-yellow-400 text-xs font-semibold rounded border border-yellow-500/30 hover:bg-yellow-500/30 transition"
                            title="Record Return"
                          >
                            <FiArrowRight size={14} /> Return
                          </button>
                        )}
                        <button onClick={() => handleEditFund(f)} className="text-cyan-400 hover:text-cyan-300 p-1 hover:bg-cyan-500/20 rounded" title="Edit"><FiEdit2 size={16} /></button>
                        <button onClick={() => handleDeleteFund(f.id)} className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/20 rounded" title="Delete"><FiTrash2 size={16} /></button>
                      </div>
                    )}
                    {isReadOnly && <FiEye className="text-gray-600" size={14} />}
                  </td>
                </tr>
              ))}
              {filteredFunds.length === 0 && (
                <tr><td colSpan={11} className="px-6 py-12 text-center text-gray-500">No funds found. Add your first income or return record.</td></tr>
              )}
              {filteredFunds.length > 8 && !showAll && (
                <tr><td colSpan={11} className="px-6 py-4 text-center"><button onClick={() => setShowAll(true)} className="text-cyan-400 text-xs hover:text-cyan-300">View all {filteredFunds.length} records</button></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAll && filteredFunds.length > 8 && (
        <div className="text-center"><button onClick={() => setShowAll(false)} className="text-cyan-400 text-xs hover:text-cyan-300 mt-3">Show Less</button></div>
      )}

      {/* Add/Edit Fund Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setAddModalOpen(false)} />
          <div className="relative bg-[#1E1E1E] rounded-2xl border border-gray-800 w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold flex items-center gap-2"><FiPlus className="text-cyan-400" /> {modalType === 'add' ? 'Add Fund' : 'Edit Fund'}</h3>
              <button onClick={() => setAddModalOpen(false)} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400"><FiX size={20} /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-cyan-400">Type</label>
                  <select value={fundForm.type} onChange={e => setFundForm({ ...fundForm, type: e.target.value as 'income' | 'return', willBeReturned: e.target.value === 'income' ? fundForm.willBeReturned : false })}
                    className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white">
                    <option value="income">Income / Fund Added</option>
                    <option value="return">Fund Return</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-cyan-400">Status</label>
                  <select value={fundForm.status} onChange={e => setFundForm({ ...fundForm, status: e.target.value as 'pending' | 'completed' })}
                    className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white">
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-cyan-400">Amount (₹)</label>
                <input type="number" min={0} value={fundForm.amount} onChange={e => setFundForm({ ...fundForm, amount: e.target.value })}
                  className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-cyan-400">Description</label>
                <input value={fundForm.description} onChange={e => setFundForm({ ...fundForm, description: e.target.value })}
                  className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white" placeholder="e.g. Donation, Grant, Fee collection" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-cyan-400">Date</label>
                <input type="date" value={fundForm.date} onChange={e => setFundForm({ ...fundForm, date: e.target.value })}
                  className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white" />
              </div>

              {/* Will Be Returned Toggle (only for income) */}
              {fundForm.type === 'income' && (
                <div className="bg-gray-800/50 border border-cyan-500/30 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs text-cyan-400 font-semibold flex items-center gap-2">
                        <FiClock size={14} /> Will this income be returned later?
                      </label>
                      <p className="text-xs text-gray-500 mt-1">Toggle ON if this fund is a loan/deposit that will be paid back.</p>
                    </div>
                    {toggleSwitch(fundForm.willBeReturned, v => setFundForm({ ...fundForm, willBeReturned: v }))}
                  </div>
                  {fundForm.willBeReturned && (
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <label className="text-xs text-cyan-400">Return Amount (₹)</label>
                        <input type="number" min={0} value={fundForm.returnAmount} onChange={e => setFundForm({ ...fundForm, returnAmount: e.target.value })}
                          className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white" placeholder="How much will be returned" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-cyan-400">Paid To / Recipient</label>
                        <input value={fundForm.paidTo} onChange={e => setFundForm({ ...fundForm, paidTo: e.target.value })}
                          className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white" placeholder="Person receiving the return" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-4">
              <button onClick={() => setAddModalOpen(false)} className="flex-1 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-semibold">Cancel</button>
              <button onClick={handleSaveFund} className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold shadow-lg shadow-cyan-500/20">
                {modalType === 'add' ? 'Add Fund' : 'Update Fund'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Return Modal */}
      {returnModalOpen && returningFund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setReturnModalOpen(false)} />
          <div className="relative bg-[#1E1E1E] rounded-2xl border border-gray-800 w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold flex items-center gap-2"><FiClock className="text-yellow-400" /> Record Fund Return</h3>
              <button onClick={() => setReturnModalOpen(false)} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400"><FiX size={20} /></button>
            </div>
            <div className="space-y-4">
              <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700">
                <p className="text-xs text-gray-400 mb-1">Fund ID</p>
                <p className="font-mono text-cyan-400 text-sm">{returningFund.autoId}</p>
                <p className="text-xs text-gray-400 mb-1 mt-2">Description</p>
                <p className="text-sm text-gray-300">{returningFund.description}</p>
                <p className="text-xs text-gray-400 mb-1 mt-2">Original Amount</p>
                <p className="text-sm text-emerald-400 font-semibold">₹{formatAmt(returningFund.amount)}</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-cyan-400">Return Amount (₹)</label>
                <input
                  type="number" min={0}
                  value={returnAmount}
                  onChange={e => setReturnAmount(e.target.value)}
                  className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white"
                  placeholder={`Max ₹${formatAmt((returningFund.returnAmount || 0) - (returningFund.returnedAmount || 0))}`}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-cyan-400">Paid To / Recipient</label>
                <input
                  value={returnPaidTo}
                  onChange={e => setReturnPaidTo(e.target.value)}
                  className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white"
                  placeholder="Recipient name"
                />
              </div>
              <p className="text-xs text-gray-500">Remaining to return: ₹{formatAmt((returningFund.returnAmount || 0) - (returningFund.returnedAmount || 0))}</p>
            </div>
            <div className="flex gap-3 pt-4">
              <button onClick={() => setReturnModalOpen(false)} className="flex-1 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-semibold">Cancel</button>
              <button onClick={handleConfirmReturn} disabled={!returnAmount || parseFloat(returnAmount) <= 0}
                className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold shadow-lg shadow-yellow-500/20">
                Confirm Return
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FundSection;
