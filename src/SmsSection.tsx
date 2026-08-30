import React, { useState, useCallback } from 'react';
import { FiSend, FiMessageSquare, FiUsers, FiCheck, FiX, FiPhone, FiMail, FiZap } from 'react-icons/fi';

const DEFAULT_SMS_TOKEN = 'fe0c119c-44aa-4634-a2cb-3f1e0e987f8f';
const DEFAULT_SMS_ENDPOINT = '/smsgw';

export interface SmsSectionProps {
  students: any[];
  fees: any[];
  showNotification: (msg: string, type: 'success' | 'error') => void;
  smsToken?: string;
  smsEndpoint?: string;
}

export const SmsSection: React.FC<SmsSectionProps> = ({ students, fees, showNotification, smsToken, smsEndpoint }) => {
  const SMS_TOKEN = smsToken || (typeof window !== 'undefined' ? localStorage.getItem('smsToken') || DEFAULT_SMS_TOKEN : DEFAULT_SMS_TOKEN);
  const SMS_ENDPOINT = smsEndpoint || DEFAULT_SMS_ENDPOINT;
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [bulkClass, setBulkClass] = useState('');
  const [bulkFilter, setBulkFilter] = useState<'all' | 'unpaid'>('all');
  const [bulkProgress, setBulkProgress] = useState({ sent: 0, total: 0, failed: 0 });
  const [bulkResults, setBulkResults] = useState<string[]>([]);
  const [showAiSingle, setShowAiSingle] = useState(false);
  const [showAiBulk, setShowAiBulk] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLang, setAiLang] = useState<'English' | 'Hindi' | 'Marathi'>('English');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiResult, setAiResult] = useState('');

  const sendOne = useCallback(async () => {
    if (!phone.trim() || !message.trim()) { showNotification('Phone and message required', 'error'); return; }
    setSending(true);
    try {
      const res = await fetch(SMS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Authorization': SMS_TOKEN },
        body: JSON.stringify({ to: phone.trim(), message: message.trim() })
      });
      const text = await res.text();
      if (res.ok) {
        showNotification('SMS sent successfully', 'success');
        setMessage('');
      } else {
        showNotification(`Failed: ${res.status} ${text}`, 'error');
      }
    } catch (e: any) {
      showNotification('Failed: ' + (e?.message || 'Network error'), 'error');
    } finally {
      setSending(false);
    }
  }, [phone, message, showNotification]);

  const getUnpaidAmount = (s: any): number => {
    const sf = fees.filter((f: any) => f.studentId === s.autoId || (s.secondaryAutoId && f.secondaryAutoId === s.secondaryAutoId));
    const totalPackage = Number(s.feeAmount || 0);
    const paid = sf.filter((f: any) => f.status === 'paid').reduce((sum: number, f: any) => sum + Number(f.amount || 0), 0);
    const discount = sf.filter((f: any) => f.status === 'paid').reduce((sum: number, f: any) => sum + Number(f.discountAmount || 0), 0);
    const balance = Math.max(totalPackage - (paid + discount), 0);
    if (sf.length === 0) return totalPackage;
    if (balance > 0) return balance;
    // fallback: sum of pending balances
    const pending = sf.filter((f: any) => f.status !== 'paid').reduce((sum: number, f: any) => sum + Number(f.balanceAmount ?? f.amount ?? 0), 0);
    return pending;
  };
  const isUnpaid = (s: any) => getUnpaidAmount(s) > 0;

  const defaultTemplates: Record<string, string> = {
    English: 'Dear {parentName}, fee of ₹{amount} for {name} ({class}) is pending. Please pay at earliest. - School',
    Hindi: 'प्रिय {parentName}, {name} ({class}) की फीस ₹{amount} बकाया है। कृपया जल्द भुगतान करें। - स्कूल',
    Marathi: 'प्रिय {parentName}, {name} ({class}) ची फी ₹{amount} थकीत आहे. कृपया लवकर भरा. - शाळा',
  };
  const applyTemplate = (lang: 'English' | 'Hindi' | 'Marathi') => {
    setMessage(defaultTemplates[lang] || defaultTemplates.English);
    setAiLang(lang);
  };

  const generateAi = async () => {
    const key = (import.meta as any).env?.VITE_OPENROUTER_KEY;
    if (!key) { setAiError('AI key not set (VITE_OPENROUTER_KEY)'); return; }
    if (!aiPrompt.trim()) { setAiError('Describe what the SMS should say'); return; }
    setAiLoading(true); setAiError(''); setAiResult('');
    const langLabel: Record<string,string> = { English: 'English', Hindi: 'Hindi (हिंदी) — Devanagari', Marathi: 'Marathi (मराठी) — Devanagari' };
    const system = `You are an SMS writer for a school. Write a polite, concise SMS ≤160 characters in ${langLabel[aiLang]}. Must include student name and unpaid amount when relevant. Preserve placeholders {name}, {parentName}, {class}, {amount} exactly if present. Do not add extra placeholders. Output only the message.`;
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}`, 'HTTP-Referer': window.location.origin, 'X-Title': 'School OS SMS' },
        body: JSON.stringify({ model: (import.meta as any).env?.VITE_OPENROUTER_MODEL || 'google/gemma-4-26b-a4b-it:free', messages: [{ role: 'system', content: system }, { role: 'user', content: aiPrompt }], max_tokens: 200 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
      const text = (data?.choices?.[0]?.message?.content || '').trim();
      if (!text) throw new Error('No content returned');
      setAiResult(text);
    } catch (e: any) { setAiError(e?.message || 'Generation failed'); }
    finally { setAiLoading(false); }
  };

  const classes = [...new Set(students.filter(s => s.status === 'ACTIVE' && !String(s.autoId || '').startsWith('D-')).map(s => s.class).filter(Boolean))].sort();
  const recipients = students.filter(s => s.status === 'ACTIVE' && !String(s.autoId || '').startsWith('D-') && (!bulkClass || s.class === bulkClass) && (bulkFilter === 'all' || isUnpaid(s)));

  const formatAmt = (n: number) => n.toLocaleString('en-IN');
  const replacePlaceholders = (tpl: string, s: any) => {
    const amt = formatAmt(getUnpaidAmount(s));
    return tpl.replaceAll('{name}', s.name || '').replaceAll('{parentName}', s.parentName || '').replaceAll('{class}', s.class || '').replaceAll('{amount}', amt).replaceAll('{dueAmount}', amt).replaceAll('{balance}', amt);
  };

  const runBulk = useCallback(async () => {
    if (recipients.length === 0) { showNotification('No recipients found', 'error'); return; }
    if (!message.trim()) { showNotification('Message template required — use {name} {amount}', 'error'); return; }
    if (!confirm(`Send to ${recipients.length} recipients? There is a 10-second gap between messages.`)) return;
    setSending(true);
    setBulkProgress({ sent: 0, total: recipients.length, failed: 0 });
    setBulkResults([]);
    const results: string[] = [];
    for (let i = 0; i < recipients.length; i++) {
      const s = recipients[i];
      const msg = replacePlaceholders(message, s);
      try {
        const res = await fetch(SMS_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8', 'Authorization': SMS_TOKEN },
          body: JSON.stringify({ to: s.parentPhone || '', message: msg })
        });
        const text = await res.text();
        if (!res.ok) results.push(`${s.name}: ${res.status} ${text}`);
        setBulkProgress(prev => ({ ...prev, sent: prev.sent + 1, failed: prev.failed + (!res.ok ? 1 : 0) }));
        await new Promise(r => setTimeout(r, 10000));
      } catch (e: any) {
        results.push(`${s.name}: ${e?.message || 'Error'}`);
        setBulkProgress(prev => ({ ...prev, sent: prev.sent + 1, failed: prev.failed + 1 }));
      }
    }
    setBulkResults(results);
    setBulkProgress(prev => ({ ...prev, failed: results.length }));
    showNotification(`Sent: ${recipients.length - results.length} · Failed: ${results.length}`, results.length > 0 ? 'error' : 'success');
    setSending(false);
  }, [recipients, message, showNotification]);

  return (
    <div className="space-y-6">
      <div className="flex gap-2 mb-4">
        <button onClick={() => setMode('single')} className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${mode === 'single' ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/20' : 'bg-[#1E1E1E] border border-gray-800 text-gray-300'}`}>Single</button>
        <button onClick={() => setMode('bulk')} className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${mode === 'bulk' ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/20' : 'bg-[#1E1E1E] border border-gray-800 text-gray-300'}`}>Bulk</button>
      </div>
      {mode === 'single' && (
        <div className="bg-[#1E1E1E] rounded-2xl border border-gray-800 p-6 space-y-4">
          <div className="flex items-center gap-2 text-lg font-bold"><FiMessageSquare className="text-cyan-400" /> Send SMS</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-xs text-cyan-400 mb-1">Phone</label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white" placeholder="Phone number" /></div>
          </div>
          <div><label className="block text-xs text-cyan-400 mb-1">Message — हिंदी / मराठी supported (Unicode UTF-8)</label><textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} lang={/[\u0900-\u097F]/.test(message) ? 'hi' : undefined} className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white placeholder:text-gray-500" style={{ fontFamily: "'Noto Sans Devanagari','DM Sans',system-ui,sans-serif" }} placeholder="Type message... e.g. नमस्ते {parentName}, {name} की फीस बाकी है। / नमस्कार {parentName}, {name} ची फी बाकी आहे." /><p className="text-[11px] text-gray-400 mt-1">/{/[\u0900-\u097F]/.test(message) ? ' Unicode (Devanagari ~70 chars/segment)' : ' GSM (160 chars/segment)'} • {message.length} chars • {message.trim() ? 'UTF-8 JSON will be sent' : 'Type in English, हिंदी or मराठी'}</p></div>
          <button onClick={() => setShowAiSingle(v => !v)} aria-expanded={showAiSingle} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E0E5EC] text-[#6C63FF] text-sm font-semibold" style={{ boxShadow: showAiSingle ? 'inset 4px 4px 8px rgb(163,177,198,0.6), inset -4px -4px 8px rgba(255,255,255,0.6)' : '5px 5px 10px rgb(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5)' }}><FiZap size={14} /> Write with AI</button>
          {showAiSingle && (
            <div className="bg-[#E0E5EC] rounded-2xl p-4 space-y-3" style={{ boxShadow: 'inset 6px 6px 10px rgb(163,177,198,0.6), inset -6px -6px 10px rgba(255,255,255,0.5)' }}>
              <input value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="What should the SMS say?" aria-label="AI prompt" className="w-full p-3 rounded-xl bg-[#E0E5EC] text-[#3D4852] text-sm" style={{ boxShadow: 'inset 4px 4px 8px rgb(163,177,198,0.55), inset -4px -4px 8px rgba(255,255,255,0.5)' }} />
              <div className="flex gap-2">
                <select value={aiLang} onChange={e => setAiLang(e.target.value as any)} aria-label="Language" className="flex-1 p-2.5 rounded-xl bg-[#E0E5EC] text-[#3D4852] text-sm" style={{ boxShadow: '5px 5px 10px rgb(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5)' }}><option value="English">English</option><option value="Hindi">Hindi (हिंदी)</option><option value="Marathi">Marathi (मराठी)</option></select>
                <button onClick={generateAi} disabled={aiLoading} className="px-4 py-2 rounded-xl bg-[#6C63FF] text-white text-sm font-semibold disabled:opacity-60">{aiLoading ? 'Generating…' : 'Generate'}</button>
              </div>
              {aiError && <p className="text-xs text-red-500">{aiError}</p>}
              {aiResult && (<div className="space-y-2"><p className="text-sm bg-white/70 p-3 rounded-xl text-[#3D4852]">{aiResult}</p><button onClick={() => { setMessage(aiResult); setShowAiSingle(false); setAiResult(''); }} className="px-4 py-2 rounded-xl bg-[#6C63FF] text-white text-xs font-semibold">Use this text</button></div>)}
              <p className="text-[11px] text-[#6B7280]">Unicode (Devanagari) delivery depends on gateway/provider.</p>
            </div>
          )}
          <button onClick={sendOne} disabled={sending} className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold hover:from-cyan-600 hover:to-blue-600 shadow-lg shadow-cyan-500/20 disabled:opacity-60">{sending ? 'Sending…' : 'Send SMS'}</button>
        </div>
      )}
      {mode === 'bulk' && (
        <div className="bg-[#1E1E1E] rounded-2xl border border-gray-800 p-6 space-y-4">
          <div className="flex items-center gap-2 text-lg font-bold"><FiUsers className="text-cyan-400" /> Bulk SMS</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="block text-xs text-cyan-400 mb-1">Class</label><select value={bulkClass} onChange={e => setBulkClass(e.target.value)} className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white"><option value="">All Classes</option>{classes.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label className="block text-xs text-cyan-400 mb-1">Filter</label><select value={bulkFilter} onChange={e => setBulkFilter(e.target.value as any)} className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white"><option value="all">All Students</option><option value="unpaid">Fees Unpaid (balance &gt; 0)</option></select></div>
            <div><label className="block text-xs text-cyan-400 mb-1">Recipients</label><div className="p-3 bg-gray-800 rounded-lg border border-gray-700 text-sm font-mono">{recipients.length} students {bulkFilter==='unpaid' ? `· unpaid only` : ''}</div></div>
          </div>
          {recipients.length > 0 && (
            <div className="border border-gray-700 rounded-xl overflow-hidden">
              <div className="px-3 py-2 bg-gray-800/60 text-[11px] text-gray-400 flex justify-between"><span>Preview — name / parent / phone / due</span><span>{recipients.length} total {bulkFilter==='unpaid' ? '· showing unpaid preview' : ''}</span></div>
              <div className="max-h-44 overflow-y-auto divide-y divide-gray-700/50">
                {recipients.slice(0, 20).map((s: any)=> (
                  <div key={s.autoId} className="px-3 py-2 flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-white truncate">{s.name} <span className="text-gray-500">({s.class})</span></span>
                    <span className="text-gray-400 truncate hidden sm:inline">{s.parentName}</span>
                    <span className="font-mono text-cyan-400 hidden md:inline">{s.parentPhone || '—'}</span>
                    <span className="font-bold text-yellow-400">₹{formatAmt(getUnpaidAmount(s))}{isUnpaid(s) ? '' : ' ✓'}</span>
                  </div>
                ))}
                {recipients.length > 20 && <div className="px-3 py-2 text-center text-xs text-gray-500">+{recipients.length - 20} more</div>}
                {recipients.length===0 && <div className="px-3 py-6 text-center text-xs text-gray-500">No recipients match filter — check unpaid filter or class</div>}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-gray-400 py-2">Auto template:</span>
            <button type="button" onClick={() => applyTemplate('English')} className="px-3 py-1.5 rounded-full text-xs bg-gray-700 hover:bg-gray-600 text-white border border-gray-600">English — ₹{'{amount}'}</button>
            <button type="button" onClick={() => applyTemplate('Hindi')} className="px-3 py-1.5 rounded-full text-xs bg-gray-700 hover:bg-gray-600 text-white border border-gray-600" style={{ fontFamily: "'Noto Sans Devanagari',system-ui" }}>हिंदी — ₹{'{amount}'}</button>
            <button type="button" onClick={() => applyTemplate('Marathi')} className="px-3 py-1.5 rounded-full text-xs bg-gray-700 hover:bg-gray-600 text-white border border-gray-600" style={{ fontFamily: "'Noto Sans Devanagari',system-ui" }}>मराठी — ₹{'{amount}'}</button>
            <span className="text-[11px] text-gray-500 py-1.5 ml-1">includes {'{name}'} + {'{amount}'} unpaid</span>
          </div>
          <div><label className="block text-xs text-cyan-400 mb-1">Template — हिंदी / मराठी supported (uses {'{name} {parentName} {class} {amount}'})</label><textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} lang={/[\u0900-\u097F]/.test(message) ? 'hi' : undefined} className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white placeholder:text-gray-500" style={{ fontFamily: "'Noto Sans Devanagari','DM Sans',system-ui,sans-serif" }} placeholder="Use {name}, {parentName}, {class}, {amount} — e.g. प्रिय {parentName}, {name} ({class}) की फीस ₹{amount} बाकी है।" /><p className="text-[11px] text-gray-500 mt-1">Bulk auto-replaces {'{amount}'} with per-student unpaid balance (₹). Bulk in Marathi/Hindi/English button loads ready message.</p></div>
          <button onClick={() => setShowAiBulk(v => !v)} aria-expanded={showAiBulk} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E0E5EC] text-[#6C63FF] text-sm font-semibold" style={{ boxShadow: showAiBulk ? 'inset 4px 4px 8px rgb(163,177,198,0.6), inset -4px -4px 8px rgba(255,255,255,0.6)' : '5px 5px 10px rgb(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5)' }}><FiZap size={14} /> Write with AI</button>
          {showAiBulk && (
            <div className="bg-[#E0E5EC] rounded-2xl p-4 space-y-3" style={{ boxShadow: 'inset 6px 6px 10px rgb(163,177,198,0.6), inset -6px -6px 10px rgba(255,255,255,0.5)' }}>
              <input value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="What should the SMS say?" aria-label="AI prompt bulk" className="w-full p-3 rounded-xl bg-[#E0E5EC] text-[#3D4852] text-sm" style={{ boxShadow: 'inset 4px 4px 8px rgb(163,177,198,0.55), inset -4px -4px 8px rgba(255,255,255,0.5)' }} />
              <div className="flex gap-2">
                <select value={aiLang} onChange={e => setAiLang(e.target.value as any)} aria-label="Language bulk" className="flex-1 p-2.5 rounded-xl bg-[#E0E5EC] text-[#3D4852] text-sm" style={{ boxShadow: '5px 5px 10px rgb(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5)' }}><option value="English">English</option><option value="Hindi">Hindi (हिंदी)</option><option value="Marathi">Marathi (मराठी)</option></select>
                <button onClick={generateAi} disabled={aiLoading} className="px-4 py-2 rounded-xl bg-[#6C63FF] text-white text-sm font-semibold disabled:opacity-60">{aiLoading ? 'Generating…' : 'Generate'}</button>
              </div>
              {aiError && <p className="text-xs text-red-500">{aiError}</p>}
              {aiResult && (<div className="space-y-2"><p className="text-sm bg-white/70 p-3 rounded-xl text-[#3D4852]">{aiResult}</p><button onClick={() => { setMessage(aiResult); setShowAiBulk(false); setAiResult(''); }} className="px-4 py-2 rounded-xl bg-[#6C63FF] text-white text-xs font-semibold">Use this text</button></div>)}
              <p className="text-[11px] text-[#6B7280]">Unicode (Devanagari) delivery depends on gateway/provider. Preserves {"{name}, {parentName}, {class}"}.</p>
            </div>
          )}
          <button onClick={runBulk} disabled={sending || recipients.length === 0} className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold hover:from-cyan-600 hover:to-blue-600 shadow-lg shadow-cyan-500/20 disabled:opacity-60">Send Bulk ({recipients.length})</button>
          {bulkResults.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <p className="text-sm font-bold text-red-400">Failed ({bulkResults.length})</p>
              <div className="max-h-32 overflow-y-auto mt-2 space-y-1 text-xs text-red-300">{bulkResults.map((r, i) => <div key={i}>{r}</div>)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
