import React from 'react';
import { FiX, FiUpload, FiEye, FiSettings, FiPlus } from 'react-icons/fi';
import { Student, Fee, Expense, Employee } from './types';

interface ModalProps {
  modalTitle: string;
  onClose: () => void;
  showClassMgmt: boolean;
  showPackageMgmt: boolean;
  showDocumentMgmt: boolean;
  showSettings: boolean;
  showOfferLetterSettings: boolean;
  setShowClassMgmt: (v: boolean) => void;
  setShowPackageMgmt: (v: boolean) => void;
  setShowDocumentMgmt: (v: boolean) => void;
  setShowSettings: (v: boolean) => void;
  setShowOfferLetterSettings: (v: boolean) => void;
  setShowModal: (v: boolean) => void;
  activeTab: string;
  modalType: 'add' | 'edit';
  billFile: File | null;
  uploading: boolean;
  handleBillUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  previewBill: (url: string) => void;

  // Student
  studentForm: Student;
  setStudentForm: React.Dispatch<React.SetStateAction<Student>>;
  classes: string[];
  packages: { name: string; amount: number }[];
  isCustomPackage: boolean;
  customPackageAmount: string;
  setCustomPackageAmount: (v: string) => void;
  handleAutoCaps: (e: any, field: string, setter: any) => void;
  handlePackageChange: (v: string) => void;
  handleSaveStudent: () => void;

  // Class/Package mgmt
  newClassName: string;
  setNewClassName: (v: string) => void;
  handleAddClass: () => void;
  handleRemoveClass: (c: string) => void;
  newPackageName: string;
  setNewPackageName: (v: string) => void;
  newPackageAmount: string;
  setNewPackageAmount: (v: string) => void;
  handleAddPackage: () => void;
  handleRemovePackage: (n: string) => void;

  // Fee
  feeForm: Fee;
  setFeeForm: React.Dispatch<React.SetStateAction<Fee>>;
  students: Student[];
  selectedStudentForFee: string;
  feeClassFilter: string;
  setFeeClassFilter: (v: string) => void;
  setSelectedStudentForFee: (v: string) => void;
  handleStudentSelection: (id: string) => void;
  handleSaveFee: () => void;

  // Expense
  expenseForm: Expense;
  setExpenseForm: React.Dispatch<React.SetStateAction<Expense>>;
  employees: Employee[];
  handleEmployeeSelectionForExpense: (id: string) => void;
  handleSaveExpense: () => void;

  // Employee
  employeeForm: Employee;
  setEmployeeForm: React.Dispatch<React.SetStateAction<Employee>>;
  handleSaveEmployee: () => void;

  // Submitted Documents
  documentOptions: string[];
  newDocumentName: string;
  setNewDocumentName: (v: string) => void;
  handleAddDocumentOption: () => void;
  handleRemoveDocumentOption: (documentName: string) => void;

  // Settings
  schoolSettings: any;
  setSchoolSettings: React.Dispatch<React.SetStateAction<any>>;
}

const inputCls = "w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white";
const inputReadonly = "w-full p-3 bg-gray-700 rounded-lg border border-gray-600 text-white font-mono";

export const AppModals: React.FC<ModalProps> = (p) => {
  const [feeStudentSearch, setFeeStudentSearch] = React.useState('');

  const toggleSubmittedDocument = (documentName: string) => {
    p.setStudentForm(prev => {
      const currentDocs = prev.submittedDocuments || [];
      const updatedDocs = currentDocs.includes(documentName)
        ? currentDocs.filter(doc => doc !== documentName)
        : [...currentDocs, documentName];
      return { ...prev, submittedDocuments: updatedDocs };
    });
  };

  const renderClassMgmt = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center"><h3 className="text-xl font-bold text-cyan-400">Manage Classes</h3><button onClick={() => p.setShowClassMgmt(false)} className="text-gray-400 hover:text-white"><FiX size={24} /></button></div>
      <div className="flex gap-2">
        <input placeholder="Enter class (e.g., 10A)" value={p.newClassName} onChange={e => p.setNewClassName(e.target.value.toUpperCase())} className="flex-1 p-3 bg-gray-800 rounded-lg border border-gray-700 text-white uppercase" onKeyPress={e => e.key === 'Enter' && p.handleAddClass()} />
        <button onClick={p.handleAddClass} className="px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg"><FiPlus size={18} /></button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto">
        {p.classes.map(c => (
          <div key={c} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg border border-gray-700">
            <span className="font-mono text-cyan-400">{c}</span>
            <button onClick={() => p.handleRemoveClass(c)} className="text-red-400 hover:text-red-300"><FiX size={18} /></button>
          </div>
        ))}
      </div>
      <button onClick={() => p.setShowClassMgmt(false)} className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white p-3 rounded-lg font-bold">Done</button>
    </div>
  );

  const renderPackageMgmt = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center"><h3 className="text-xl font-bold text-cyan-400">Manage Fee Packages</h3><button onClick={() => p.setShowPackageMgmt(false)} className="text-gray-400 hover:text-white"><FiX size={24} /></button></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input placeholder="Package Name" value={p.newPackageName} onChange={e => p.setNewPackageName(e.target.value)} className="p-3 bg-gray-800 rounded-lg border border-gray-700 text-white" />
        <input type="number" placeholder="Amount (₹)" value={p.newPackageAmount} onChange={e => p.setNewPackageAmount(e.target.value)} className="p-3 bg-gray-800 rounded-lg border border-gray-700 text-white" onKeyPress={e => e.key === 'Enter' && p.handleAddPackage()} />
        <button onClick={p.handleAddPackage} className="px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg font-semibold flex items-center justify-center gap-2"><FiPlus size={18} /> Add</button>
      </div>
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {p.packages.map(pkg => (
          <div key={pkg.name} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg border border-gray-700">
            <div><span className="font-semibold text-white">{pkg.name}</span><span className="ml-2 text-yellow-400">₹{pkg.amount.toLocaleString()}</span></div>
            <button onClick={() => p.handleRemovePackage(pkg.name)} className="text-red-400 hover:text-red-300"><FiX size={18} /></button>
          </div>
        ))}
      </div>
      <button onClick={() => p.setShowPackageMgmt(false)} className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white p-3 rounded-lg font-bold">Done</button>
    </div>
  );


  const renderDocumentMgmt = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center"><h3 className="text-xl font-bold text-cyan-400">Manage Submitted Documents</h3><button onClick={() => p.setShowDocumentMgmt(false)} className="text-gray-400 hover:text-white"><FiX size={24} /></button></div>
      <div className="flex gap-2">
        <input placeholder="Enter document name" value={p.newDocumentName} onChange={e => p.setNewDocumentName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); p.handleAddDocumentOption(); } }} className="flex-1 p-3 bg-gray-800 rounded-lg border border-gray-700 text-white" />
        <button type="button" onClick={p.handleAddDocumentOption} className="px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg font-semibold flex items-center justify-center gap-2"><FiPlus size={18} /> Add</button>
      </div>
      <div className="space-y-2 max-h-72 overflow-y-auto">
        {p.documentOptions.length === 0 ? <div className="p-6 text-center bg-gray-800 rounded-lg border border-gray-700 text-gray-400">No document options added yet.</div> : p.documentOptions.map(documentName => (
          <div key={documentName} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg border border-gray-700"><span className="text-white font-medium">{documentName}</span><button type="button" onClick={() => p.handleRemoveDocumentOption(documentName)} className="text-red-400 hover:text-red-300" title="Remove document"><FiX size={18} /></button></div>
        ))}
      </div>
      <button onClick={() => p.setShowDocumentMgmt(false)} className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white p-3 rounded-lg font-bold">Done</button>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">School Settings</h2>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1 col-span-2"><label className="text-xs text-cyan-400">School Name</label><input value={p.schoolSettings.schoolName} onChange={e => p.setSchoolSettings({ ...p.schoolSettings, schoolName: e.target.value })} className={inputCls} /></div>
        <div className="space-y-1 col-span-2"><label className="text-xs text-cyan-400">Address</label><input value={p.schoolSettings.address} onChange={e => p.setSchoolSettings({ ...p.schoolSettings, address: e.target.value })} className={inputCls} /></div>
        <div className="space-y-1"><label className="text-xs text-cyan-400">Phone</label><input value={p.schoolSettings.phone} onChange={e => p.setSchoolSettings({ ...p.schoolSettings, phone: e.target.value })} className={inputCls} /></div>
        <div className="space-y-1"><label className="text-xs text-cyan-400">Email</label><input value={p.schoolSettings.email} onChange={e => p.setSchoolSettings({ ...p.schoolSettings, email: e.target.value })} className={inputCls} /></div>
        <div className="space-y-1"><label className="text-xs text-cyan-400">Primary Color</label><div className="flex gap-2"><input type="color" value={p.schoolSettings.primaryColor} onChange={e => p.setSchoolSettings({ ...p.schoolSettings, primaryColor: e.target.value })} className="w-12 h-10 bg-gray-800 rounded-lg border border-gray-700 cursor-pointer" /><input value={p.schoolSettings.primaryColor} onChange={e => p.setSchoolSettings({ ...p.schoolSettings, primaryColor: e.target.value })} className="flex-1 p-3 bg-gray-800 rounded-lg border border-gray-700 text-white font-mono" /></div></div>
        <div className="space-y-1"><label className="text-xs text-cyan-400">Secondary Color</label><div className="flex gap-2"><input type="color" value={p.schoolSettings.secondaryColor} onChange={e => p.setSchoolSettings({ ...p.schoolSettings, secondaryColor: e.target.value })} className="w-12 h-10 bg-gray-800 rounded-lg border border-gray-700 cursor-pointer" /><input value={p.schoolSettings.secondaryColor} onChange={e => p.setSchoolSettings({ ...p.schoolSettings, secondaryColor: e.target.value })} className="flex-1 p-3 bg-gray-800 rounded-lg border border-gray-700 text-white font-mono" /></div></div>
        <div className="space-y-1 col-span-2"><label className="text-xs text-cyan-400">School Logo</label><div className="flex items-center gap-4">{p.schoolSettings.schoolLogo && <img src={p.schoolSettings.schoolLogo} alt="Logo" className="w-20 h-20 rounded-lg border-2 border-cyan-500" />}<label className="flex-1 flex items-center gap-2 p-3 bg-gray-800 rounded-lg border border-gray-700 cursor-pointer hover:border-cyan-500 transition"><FiUpload /><span>{p.schoolSettings.schoolLogo ? 'Change Logo' : 'Upload Logo'}</span><input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = ev => p.setSchoolSettings({ ...p.schoolSettings, schoolLogo: ev.target?.result as string }); r.readAsDataURL(f); }} className="hidden" /></label></div></div>
      </div>

      {/* ===== PDF Editor Section ===== */}
      <div className="border-t border-gray-700 pt-4 mt-2 space-y-4">
        <h3 className="text-base font-bold text-purple-400">PDF Report Editor</h3>
        
        {/* Text Editing */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase">Text Content</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2"><label className="text-xs text-cyan-400">Report Heading</label><input value={p.schoolSettings.pdfHeading || ''} onChange={e => p.setSchoolSettings({ ...p.schoolSettings, pdfHeading: e.target.value })} className={inputCls} /></div>
            <div className="space-y-1 col-span-2"><label className="text-xs text-cyan-400">Subtitle</label><input value={p.schoolSettings.pdfSubtitle || ''} onChange={e => p.setSchoolSettings({ ...p.schoolSettings, pdfSubtitle: e.target.value })} className={inputCls} /></div>
            <div className="space-y-1 col-span-2"><label className="text-xs text-cyan-400">Footer Text</label><input value={p.schoolSettings.pdfFooterText || ''} onChange={e => p.setSchoolSettings({ ...p.schoolSettings, pdfFooterText: e.target.value })} className={inputCls} /></div>
            <div className="space-y-1 col-span-2"><label className="text-xs text-cyan-400">Student Report Subtitle</label><input value={p.schoolSettings.pdfStudentSubtitle || ''} onChange={e => p.setSchoolSettings({ ...p.schoolSettings, pdfStudentSubtitle: e.target.value })} className={inputCls} /></div>
            <div className="space-y-1 col-span-2"><label className="text-xs text-cyan-400">Fees Report Subtitle</label><input value={p.schoolSettings.pdfFeesSubtitle || ''} onChange={e => p.setSchoolSettings({ ...p.schoolSettings, pdfFeesSubtitle: e.target.value })} className={inputCls} /></div>
            <div className="space-y-1 col-span-2"><label className="text-xs text-cyan-400">Employee Report Subtitle</label><input value={p.schoolSettings.pdfEmployeeSubtitle || ''} onChange={e => p.setSchoolSettings({ ...p.schoolSettings, pdfEmployeeSubtitle: e.target.value })} className={inputCls} /></div>
            <div className="space-y-1 col-span-2"><label className="text-xs text-cyan-400">Expense Report Subtitle</label><input value={p.schoolSettings.pdfExpenseSubtitle || ''} onChange={e => p.setSchoolSettings({ ...p.schoolSettings, pdfExpenseSubtitle: e.target.value })} className={inputCls} /></div>
            <div className="space-y-1 col-span-2"><label className="text-xs text-cyan-400">Equipment Report Subtitle</label><input value={p.schoolSettings.pdfEquipmentSubtitle || ''} onChange={e => p.setSchoolSettings({ ...p.schoolSettings, pdfEquipmentSubtitle: e.target.value })} className={inputCls} /></div>
            <div className="space-y-1 col-span-2"><label className="text-xs text-cyan-400">Class Summary Subtitle</label><input value={p.schoolSettings.pdfClassSummarySubtitle || ''} onChange={e => p.setSchoolSettings({ ...p.schoolSettings, pdfClassSummarySubtitle: e.target.value })} className={inputCls} /></div>
            <div className="space-y-1 col-span-2"><label className="text-xs text-cyan-400">Financial Summary Subtitle</label><input value={p.schoolSettings.pdfFinancialSubtitle || ''} onChange={e => p.setSchoolSettings({ ...p.schoolSettings, pdfFinancialSubtitle: e.target.value })} className={inputCls} /></div>
          </div>
        </div>

        {/* Logo Size */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase">Logo Size (mm)</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className="text-xs text-cyan-400">Width: {p.schoolSettings.pdfLogoWidth || 40}mm</label><input type="range" min="10" max="80" value={p.schoolSettings.pdfLogoWidth || 40} onChange={e => p.setSchoolSettings({ ...p.schoolSettings, pdfLogoWidth: parseInt(e.target.value) })} className="w-full accent-cyan-500" /></div>
            <div className="space-y-1"><label className="text-xs text-cyan-400">Height: {p.schoolSettings.pdfLogoHeight || 40}mm</label><input type="range" min="10" max="80" value={p.schoolSettings.pdfLogoHeight || 40} onChange={e => p.setSchoolSettings({ ...p.schoolSettings, pdfLogoHeight: parseInt(e.target.value) })} className="w-full accent-cyan-500" /></div>
          </div>
          <button onClick={() => p.setSchoolSettings({ ...p.schoolSettings, pdfLogoWidth: 40, pdfLogoHeight: 40 })} className="text-xs text-gray-400 hover:text-cyan-400">Reset to default</button>
        </div>

        {/* Colors */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase">Colors</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className="text-xs text-cyan-400">Header BG</label><div className="flex gap-2"><input type="color" value={p.schoolSettings.pdfHeaderColor || '#0ea5e9'} onChange={e => p.setSchoolSettings({ ...p.schoolSettings, pdfHeaderColor: e.target.value })} className="w-10 h-9 bg-gray-800 rounded-lg border border-gray-700 cursor-pointer" /><input value={p.schoolSettings.pdfHeaderColor || '#0ea5e9'} onChange={e => p.setSchoolSettings({ ...p.schoolSettings, pdfHeaderColor: e.target.value })} className="flex-1 p-2 bg-gray-800 rounded-lg border border-gray-700 text-white text-sm font-mono" /></div></div>
            <div className="space-y-1"><label className="text-xs text-cyan-400">Body Text</label><div className="flex gap-2"><input type="color" value={p.schoolSettings.pdfBodyColor || '#1e293b'} onChange={e => p.setSchoolSettings({ ...p.schoolSettings, pdfBodyColor: e.target.value })} className="w-10 h-9 bg-gray-800 rounded-lg border border-gray-700 cursor-pointer" /><input value={p.schoolSettings.pdfBodyColor || '#1e293b'} onChange={e => p.setSchoolSettings({ ...p.schoolSettings, pdfBodyColor: e.target.value })} className="flex-1 p-2 bg-gray-800 rounded-lg border border-gray-700 text-white text-sm font-mono" /></div></div>
            <div className="space-y-1"><label className="text-xs text-cyan-400">Table Header</label><div className="flex gap-2"><input type="color" value={p.schoolSettings.pdfTableHeaderColor || '#0ea5e9'} onChange={e => p.setSchoolSettings({ ...p.schoolSettings, pdfTableHeaderColor: e.target.value })} className="w-10 h-9 bg-gray-800 rounded-lg border border-gray-700 cursor-pointer" /><input value={p.schoolSettings.pdfTableHeaderColor || '#0ea5e9'} onChange={e => p.setSchoolSettings({ ...p.schoolSettings, pdfTableHeaderColor: e.target.value })} className="flex-1 p-2 bg-gray-800 rounded-lg border border-gray-700 text-white text-sm font-mono" /></div></div>
            <div className="space-y-1"><label className="text-xs text-cyan-400">Accent / Lines</label><div className="flex gap-2"><input type="color" value={p.schoolSettings.pdfAccentColor || '#4361ee'} onChange={e => p.setSchoolSettings({ ...p.schoolSettings, pdfAccentColor: e.target.value })} className="w-10 h-9 bg-gray-800 rounded-lg border border-gray-700 cursor-pointer" /><input value={p.schoolSettings.pdfAccentColor || '#4361ee'} onChange={e => p.setSchoolSettings({ ...p.schoolSettings, pdfAccentColor: e.target.value })} className="flex-1 p-2 bg-gray-800 rounded-lg border border-gray-700 text-white text-sm font-mono" /></div></div>
          </div>
        </div>

        {/* Font Sizes */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase">Font Sizes (pt)</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className="text-xs text-cyan-400">Title Size: {p.schoolSettings.pdfTitleSize || 20}pt</label><input type="range" min="12" max="32" value={p.schoolSettings.pdfTitleSize || 20} onChange={e => p.setSchoolSettings({ ...p.schoolSettings, pdfTitleSize: parseInt(e.target.value) })} className="w-full accent-cyan-500" /></div>
            <div className="space-y-1"><label className="text-xs text-cyan-400">Body Size: {p.schoolSettings.pdfBodySize || 9}pt</label><input type="range" min="6" max="14" value={p.schoolSettings.pdfBodySize || 9} onChange={e => p.setSchoolSettings({ ...p.schoolSettings, pdfBodySize: parseInt(e.target.value) })} className="w-full accent-cyan-500" /></div>
          </div>
        </div>

        {/* Reset Button */}
        <button onClick={() => p.setSchoolSettings({ ...p.schoolSettings, pdfHeading: 'School Management Report', pdfSubtitle: 'Comprehensive data overview', pdfFooterText: 'Confidential - For internal use only', pdfStudentSubtitle: 'All registered students with details', pdfFeesSubtitle: 'Complete fee records and collection status', pdfEmployeeSubtitle: 'All staff members with salary details', pdfExpenseSubtitle: 'All recorded expenses with payment status', pdfEquipmentSubtitle: 'All equipment records and assignment details', pdfClassSummarySubtitle: 'Overview of all classes', pdfFinancialSubtitle: 'Complete financial overview', pdfLogoWidth: 40, pdfLogoHeight: 40, pdfHeaderColor: '#0ea5e9', pdfBodyColor: '#1e293b', pdfTableHeaderColor: '#0ea5e9', pdfAccentColor: '#4361ee', pdfTitleSize: 22, pdfBodySize: 10, offerTitle: 'Offer Letter', offerPointsHeading: 'Terms & Conditions', offerIntro: 'Subject: Appointment for the position of', offerPoints: 'Appointment | Appointment is subject to verification of documents.\nPolicies | You are expected to follow all school policies and code of conduct.\nSalary & Duties | Salary and duties will be as discussed and recorded by the administration.', offerTerms: 'This offer is valid subject to acceptance and completion of joining formalities.', offerSignatory: 'Principal / Administrator', offerAck: 'I acknowledge and accept the terms and conditions mentioned above.' })} className="text-xs text-gray-400 hover:text-cyan-400 underline">Reset all PDF settings to default</button>
      </div>

      <button onClick={() => p.setShowModal(false)} className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white p-3 rounded-lg font-bold">Save Settings</button>
    </div>
  );

  const renderBillUpload = (billUrl: string | undefined) => (
    <div className="space-y-1 col-span-2">
      <label className="text-xs text-cyan-400">Upload Bill (Image)</label>
      <div className="flex gap-2">
        <label className="flex-1 flex items-center gap-2 p-3 bg-gray-800 rounded-lg border border-gray-700 cursor-pointer hover:border-cyan-500 transition"><FiUpload /><span>{p.billFile?.name || 'Choose File'}</span><input type="file" accept="image/*" onChange={p.handleBillUpload} className="hidden" disabled={p.uploading} /></label>
        {billUrl && <button onClick={() => p.previewBill(billUrl)} className="px-4 py-3 bg-cyan-600 rounded-lg hover:bg-cyan-700"><FiEye /></button>}
      </div>
      {p.uploading && <p className="text-sm text-cyan-400">Uploading...</p>}
    </div>
  );

  const renderStudentForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs text-cyan-400">Auto ID <span className="text-gray-500">(Auto sequence)</span></label>
          <input value={p.studentForm.autoId || 'STU-AUTO'} readOnly className={inputReadonly} />
          <p className="text-xs text-gray-500">ID is generated automatically on save to prevent duplicate or mismatched records.</p>
        </div>
        <div className="space-y-1"><label className="text-xs text-cyan-400">Name <span className="text-yellow-400">(Auto Caps)</span></label><input placeholder="STUDENT NAME" value={p.studentForm.name} onChange={e => p.handleAutoCaps(e, 'name', p.setStudentForm)} className={inputCls + ' uppercase'} /></div>
        <div className="space-y-1"><label className="text-xs text-cyan-400">Roll Number <span className="text-gray-500">(synced with ID)</span></label><input value={p.studentForm.rollNumber || 'Auto-generated on save'} readOnly className={inputReadonly} /></div>
        <div className="space-y-1"><label className="text-xs text-cyan-400">Class <span className="text-yellow-400">(Auto Caps)</span></label><div className="flex gap-2"><select value={p.studentForm.class} onChange={e => p.handleAutoCaps(e, 'class', p.setStudentForm)} className="flex-1 p-3 bg-gray-800 rounded-lg border border-gray-700 text-white uppercase"><option value="">-- Select Class --</option>{p.classes.map(c => <option key={c} value={c}>{c}</option>)}</select><button onClick={() => p.setShowClassMgmt(true)} className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg border border-gray-700 text-white"><FiSettings size={18} /></button></div></div>
        <div className="space-y-1"><label className="text-xs text-cyan-400">Gender</label><select value={p.studentForm.gender} onChange={e => p.handleAutoCaps(e, 'gender', p.setStudentForm)} className={inputCls + ' uppercase'}><option value="MALE">MALE</option><option value="FEMALE">FEMALE</option><option value="OTHER">OTHER</option></select></div>
        <div className="space-y-1"><label className="text-xs text-cyan-400">Date of Birth</label><input type="date" value={p.studentForm.dateOfBirth} onChange={e => p.setStudentForm({ ...p.studentForm, dateOfBirth: e.target.value })} className={inputCls} /></div>
        <div className="space-y-1"><label className="text-xs text-cyan-400">Admission Date</label><input type="date" value={p.studentForm.admissionDate} onChange={e => p.setStudentForm({ ...p.studentForm, admissionDate: e.target.value })} className={inputCls} /></div>
        <div className="space-y-1"><label className="text-xs text-cyan-400">Parent Name <span className="text-yellow-400">(Auto Caps)</span></label><input placeholder="PARENT NAME" value={p.studentForm.parentName} onChange={e => p.handleAutoCaps(e, 'parentName', p.setStudentForm)} className={inputCls + ' uppercase'} /></div>
        <div className="space-y-1"><label className="text-xs text-cyan-400">Parent Phone</label><input placeholder="Parent Phone" value={p.studentForm.parentPhone} onChange={e => p.setStudentForm({ ...p.studentForm, parentPhone: e.target.value })} className={inputCls} /></div>
        <div className="space-y-1"><label className="text-xs text-cyan-400">Email</label><input placeholder="Email" value={p.studentForm.email} onChange={e => p.setStudentForm({ ...p.studentForm, email: e.target.value })} className={inputCls} /></div>
        <div className="space-y-1"><label className="text-xs text-cyan-400">Status</label><select value={p.studentForm.status} onChange={e => p.handleAutoCaps(e, 'status', p.setStudentForm)} className={inputCls + ' uppercase'}><option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option></select></div>
        <div className="space-y-1 col-span-2"><label className="text-xs text-cyan-400">Address</label><input placeholder="Address" value={p.studentForm.address} onChange={e => p.setStudentForm({ ...p.studentForm, address: e.target.value })} className={inputCls} /></div>
        <div className="space-y-1 col-span-2">
          <div className="flex justify-between items-center">
            <label className="text-xs text-cyan-400">Fee Package</label>
            <button type="button" onClick={() => p.setShowPackageMgmt(true)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-cyan-400 transition"><FiSettings size={12} />Manage Packages</button>
          </div>
          <div className="flex gap-2">
            <select value={p.studentForm.package} onChange={e => p.handlePackageChange(e.target.value)} className="flex-1 p-3 bg-gray-800 rounded-lg border border-gray-700 text-white focus:border-cyan-500 focus:outline-none">
              <option value="">— Select Package —</option>
              {p.packages.map(pkg => <option key={pkg.name} value={pkg.name}>{pkg.name} - ₹{pkg.amount.toLocaleString()}</option>)}
              <option value="Custom">Custom Amount</option>
            </select>
            <input type="number" placeholder="Amount" value={p.studentForm.feeAmount || ''} onChange={e => {
              const val = parseFloat(e.target.value) || 0;
              p.setStudentForm(prev => ({ ...prev, feeAmount: val, package: val > 0 ? 'Custom' : prev.package }));
            }} className="w-40 p-3 bg-gray-800 rounded-lg border border-gray-700 text-white font-semibold focus:border-cyan-500 focus:outline-none" />
          </div>
          <p className="text-xs text-gray-500">Select a package to auto-fill the amount, or type a custom amount directly</p>
        </div>

        <div className="space-y-3 col-span-2">
          <div className="flex justify-between items-center">
            <label className="text-xs text-cyan-400">Submitted Documents</label>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">{(p.studentForm.submittedDocuments || []).length} / {p.documentOptions.length} selected</span>
              <button type="button" onClick={() => p.setShowDocumentMgmt(true)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-cyan-400 transition"><FiSettings size={12} />Manage Documents</button>
            </div>
          </div>
          {p.documentOptions.length === 0 ? (
            <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 text-sm text-gray-400">No document options added. Click Manage Documents to add checklist items.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {p.documentOptions.map((documentName: string) => {
                const checked = (p.studentForm.submittedDocuments || []).includes(documentName);
                return (
                  <label key={documentName} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${checked ? 'bg-cyan-500/10 border-cyan-500/60 text-white' : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-cyan-500/40'}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleSubmittedDocument(documentName)} className="w-4 h-4 accent-cyan-500" />
                    <span className="text-sm font-medium">{documentName}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <button onClick={p.handleSaveStudent} className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white p-4 rounded-lg font-bold text-lg shadow-lg shadow-cyan-500/20">{p.modalType === 'add' ? 'Add Student' : 'Update Student'}</button>
    </div>
  );


  const calculateFeeDiscount = (
    originalAmount: number,
    discountType: 'amount' | 'percent',
    discountValue: number,
    applyDiscount: boolean
  ) => {
    const safeOriginalAmount = Number(originalAmount || 0);
    const safeDiscountValue = Number(discountValue || 0);
    const discountAmount = applyDiscount
      ? (discountType === 'percent'
        ? Math.min((safeOriginalAmount * safeDiscountValue) / 100, safeOriginalAmount)
        : Math.min(safeDiscountValue, safeOriginalAmount))
      : 0;

    return {
      originalAmount: safeOriginalAmount,
      discountAmount,
      amount: Math.max(safeOriginalAmount - discountAmount, 0),
    };
  };

  const renderFeeForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1 col-span-2"><label className="text-xs text-cyan-400">Filter by Class</label><select value={p.feeClassFilter} onChange={e => { p.setFeeClassFilter(e.target.value); p.setSelectedStudentForFee(''); p.setFeeForm(prev => ({ ...prev, studentId: '', studentName: '', originalAmount: 0, discountValue: 0, discountAmount: 0, amount: 0 } as any)); }} className={inputCls}><option value="">All Classes</option>{[...new Set(p.students.filter(s => s.status === 'ACTIVE').map(s => s.class))].filter(Boolean).sort().map(c => <option key={c} value={c}>{c}</option>)}</select></div>
        <div className="space-y-2 col-span-2">
          <label className="text-xs text-cyan-400">Select Student</label>
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-3">
            <input value={feeStudentSearch} onChange={e => setFeeStudentSearch(e.target.value)} placeholder="Search student by name, ID, roll, class..." className="w-full p-3 mb-3 bg-gray-900 rounded-lg border border-gray-700 text-white focus:border-cyan-500 focus:outline-none" />
            <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
              {p.students.filter(s => s.status === 'ACTIVE').filter(s => !p.feeClassFilter || s.class === p.feeClassFilter).filter(s => { const q = feeStudentSearch.toLowerCase().trim(); if (!q) return true; return s.name.toLowerCase().includes(q) || s.autoId.toLowerCase().includes(q) || s.rollNumber.toLowerCase().includes(q) || s.class.toLowerCase().includes(q); }).sort((a, b) => a.class.localeCompare(b.class) || a.name.localeCompare(b.name)).map(s => {
                const selected = p.selectedStudentForFee === s.id;
                return <button type="button" key={s.id} onClick={() => p.handleStudentSelection(s.id!)} className={`w-full text-left p-3 rounded-lg border transition-all ${selected ? 'bg-cyan-500/20 border-cyan-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-300 hover:border-cyan-500/50'}`}><div className="flex items-center justify-between gap-3"><div><p className="font-semibold">{s.name}</p><p className="text-xs text-cyan-400 font-mono">{s.class} | {s.autoId} | Roll: {s.rollNumber || '—'}</p></div><div className="text-right shrink-0"><p className="text-sm font-bold text-yellow-400">₹{(s.feeAmount || 0).toLocaleString()}</p>{selected && <p className="text-xs text-emerald-400">Selected</p>}</div></div></button>;
              })}
              {p.students.filter(s => s.status === 'ACTIVE').filter(s => !p.feeClassFilter || s.class === p.feeClassFilter).filter(s => { const q = feeStudentSearch.toLowerCase().trim(); if (!q) return true; return s.name.toLowerCase().includes(q) || s.autoId.toLowerCase().includes(q) || s.rollNumber.toLowerCase().includes(q) || s.class.toLowerCase().includes(q); }).length === 0 && <div className="p-4 text-center text-sm text-gray-500">No matching active students found.</div>}
            </div>
          </div>
        </div>
        <div className="space-y-1"><label className="text-xs text-cyan-400">Auto ID</label><input value={p.feeForm.autoId} readOnly className={inputReadonly} /></div>
        <div className="space-y-1"><label className="text-xs text-cyan-400">Selected Student</label><input value={p.feeForm.studentName} readOnly className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 text-white" /></div>
        <div className="space-y-1"><label className="text-xs text-cyan-400">Student Auto ID</label><input value={p.feeForm.studentId} readOnly className={inputReadonly} /></div>
        <div className="space-y-1">
          <label className="text-xs text-cyan-400">Package Amount (₹)</label>
          <input
            type="number"
            value={(p.feeForm as any).originalAmount || p.feeForm.amount || 0}
            readOnly
            className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 text-white font-bold"
          />
          <p className="text-xs text-gray-500">Fixed from selected student's package.</p>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-cyan-400">Discount</label>
          <label className="flex items-center gap-2 p-3 bg-gray-800 rounded-lg border border-gray-700 text-white cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean((p.feeForm as any).applyDiscount)}
              onChange={e => {
                const applyDiscount = e.target.checked;
                const originalAmount = (p.feeForm as any).originalAmount || 0;
                const discountType = ((p.feeForm as any).discountType || 'amount') as 'amount' | 'percent';
                const discountValue = (p.feeForm as any).discountValue || 0;
                const calculated = calculateFeeDiscount(originalAmount, discountType, discountValue, applyDiscount);
                const previousPayment = Number((p.feeForm as any).paymentAmount ?? calculated.amount);
                const paymentAmount = Math.min(previousPayment, calculated.amount);
                p.setFeeForm(prev => ({ ...prev, applyDiscount, ...calculated, payableAmount: calculated.amount, paymentAmount, amount: paymentAmount, balanceAmount: Math.max(calculated.amount - paymentAmount, 0) } as any));
              }}
              className="w-4 h-4 accent-cyan-500"
            />
            <span className="text-sm font-semibold">Apply Discount</span>
          </label>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-cyan-400">Discount Type</label>
          <select
            value={(p.feeForm as any).discountType || 'amount'}
            disabled={!Boolean((p.feeForm as any).applyDiscount)}
            onChange={e => {
              const discountType = e.target.value as 'amount' | 'percent';
              const originalAmount = (p.feeForm as any).originalAmount || 0;
              const discountValue = (p.feeForm as any).discountValue || 0;
              const calculated = calculateFeeDiscount(originalAmount, discountType, discountValue, Boolean((p.feeForm as any).applyDiscount));
              const previousPayment = Number((p.feeForm as any).paymentAmount ?? calculated.amount);
              const paymentAmount = Math.min(previousPayment, calculated.amount);
              p.setFeeForm(prev => ({ ...prev, discountType, ...calculated, payableAmount: calculated.amount, paymentAmount, amount: paymentAmount, balanceAmount: Math.max(calculated.amount - paymentAmount, 0) } as any));
            }}
            className={inputCls + (!Boolean((p.feeForm as any).applyDiscount) ? ' opacity-50' : '')}
          >
            <option value="amount">₹ Amount</option>
            <option value="percent">% Percent</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-cyan-400">Discount {(p.feeForm as any).discountType === 'percent' ? '(%)' : '(₹)'}</label>
          <input
            type="number"
            value={(p.feeForm as any).discountValue || ''}
            disabled={!Boolean((p.feeForm as any).applyDiscount)}
            onChange={e => {
              const discountValue = parseFloat(e.target.value) || 0;
              const discountType = ((p.feeForm as any).discountType || 'amount') as 'amount' | 'percent';
              const originalAmount = (p.feeForm as any).originalAmount || 0;
              const calculated = calculateFeeDiscount(originalAmount, discountType, discountValue, Boolean((p.feeForm as any).applyDiscount));
              const previousPayment = Number((p.feeForm as any).paymentAmount ?? calculated.amount);
              const paymentAmount = Math.min(previousPayment, calculated.amount);
              p.setFeeForm(prev => ({ ...prev, discountValue, ...calculated, payableAmount: calculated.amount, paymentAmount, amount: paymentAmount, balanceAmount: Math.max(calculated.amount - paymentAmount, 0) } as any));
            }}
            className={inputCls + (!Boolean((p.feeForm as any).applyDiscount) ? ' opacity-50' : '')}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-cyan-400">Final Payable (₹)</label>
          <input type="number" value={(p.feeForm as any).payableAmount ?? p.feeForm.amount ?? 0} readOnly className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 text-yellow-400 font-bold" />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-cyan-400">Payment Amount (₹)</label>
          <input
            type="number"
            value={(p.feeForm as any).paymentAmount ?? p.feeForm.amount ?? ''}
            onChange={e => {
              const payableAmount = Number((p.feeForm as any).payableAmount ?? p.feeForm.amount ?? 0);
              const paymentAmount = Math.min(Math.max(parseFloat(e.target.value) || 0, 0), payableAmount);
              p.setFeeForm(prev => ({ ...prev, paymentAmount, amount: paymentAmount, balanceAmount: Math.max(payableAmount - paymentAmount, 0), status: paymentAmount > 0 ? 'paid' : prev.status } as any));
            }}
            className={inputCls}
          />
          <p className="text-xs text-gray-500">For partial payment, enter received amount. Example: ₹3,000 of ₹10,000.</p>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-cyan-400">Balance After Payment (₹)</label>
          <input type="number" value={(p.feeForm as any).balanceAmount ?? Math.max(Number((p.feeForm as any).payableAmount || 0) - Number((p.feeForm as any).paymentAmount || 0), 0)} readOnly className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 text-orange-400 font-bold" />
        </div>
        <div className="space-y-1"><label className="text-xs text-cyan-400">Fee Type</label><input value={p.feeForm.type} onChange={e => p.setFeeForm({ ...p.feeForm, type: e.target.value })} className={inputCls} /></div>
        <div className="space-y-1"><label className="text-xs text-cyan-400">Due Date</label><input type="date" value={p.feeForm.dueDate} onChange={e => p.setFeeForm({ ...p.feeForm, dueDate: e.target.value })} className={inputCls} /></div>
        <div className="space-y-1"><label className="text-xs text-cyan-400">Paid Date</label><input type="date" value={p.feeForm.paidDate} onChange={e => p.setFeeForm({ ...p.feeForm, paidDate: e.target.value })} className={inputCls} /></div>
        <div className="space-y-1"><label className="text-xs text-cyan-400">Status</label><select value={p.feeForm.status} onChange={e => { const status = e.target.value as any; const originalAmount = (p.feeForm as any).originalAmount || 0; const discountType = ((p.feeForm as any).discountType || 'amount') as 'amount' | 'percent'; const discountValue = (p.feeForm as any).discountValue || 0; const calculated = calculateFeeDiscount(originalAmount, discountType, discountValue, Boolean((p.feeForm as any).applyDiscount)); const previousPayment = Number((p.feeForm as any).paymentAmount ?? calculated.amount); const paymentAmount = status === 'paid' && previousPayment <= 0 ? calculated.amount : Math.min(previousPayment, calculated.amount); p.setFeeForm({ ...p.feeForm, status, ...calculated, payableAmount: calculated.amount, paymentAmount, amount: paymentAmount, balanceAmount: Math.max(calculated.amount - paymentAmount, 0) } as any); }} className={inputCls}><option value="pending">Pending</option><option value="paid">Paid / Partial Payment</option><option value="overdue">Overdue</option></select></div>
        <div className="space-y-1 col-span-2"><label className="text-xs text-cyan-400">Description</label><input value={p.feeForm.description} onChange={e => p.setFeeForm({ ...p.feeForm, description: e.target.value })} className={inputCls} /></div>
        {renderBillUpload(p.feeForm.billUrl)}
      </div>
      <button onClick={p.handleSaveFee} disabled={!p.feeForm.studentId} className={`w-full p-4 rounded-lg font-bold text-lg ${p.feeForm.studentId ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white shadow-lg shadow-cyan-500/20' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}>{p.modalType === 'add' ? 'Add Fee' : 'Update Fee'}</button>
    </div>
  );

  const renderExpenseForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1"><label className="text-xs text-cyan-400">Auto ID</label><input value={p.expenseForm.autoId} readOnly className={inputReadonly} /></div>
        <div className="space-y-1"><label className="text-xs text-cyan-400">Category</label><select value={p.expenseForm.category} onChange={e => p.setExpenseForm({ ...p.expenseForm, category: e.target.value })} className={inputCls}><option>Salaries</option><option>Utilities</option><option>Maintenance</option><option>Supplies</option><option>Transport</option><option>Other</option></select></div>
        <div className="space-y-1 col-span-2"><label className="text-xs text-cyan-400">Link to Employee (Paid To)</label><select value={p.expenseForm.employeeId || ''} onChange={e => p.handleEmployeeSelectionForExpense(e.target.value)} className={inputCls}><option value="">-- Select Employee (Optional) --</option>{p.employees.map(emp => <option key={emp.id} value={emp.id}>{emp.autoId} - {emp.name} ({emp.role})</option>)}</select></div>
        <div className="space-y-1"><label className="text-xs text-cyan-400">Paid To (Manual)</label><input placeholder="Recipient name" value={p.expenseForm.paidTo} onChange={e => p.setExpenseForm({ ...p.expenseForm, paidTo: e.target.value, employeeId: '' })} className={inputCls} /></div>
        <div className="space-y-1"><label className="text-xs text-cyan-400">Amount (₹)</label><input type="number" value={p.expenseForm.amount || ''} onChange={e => p.setExpenseForm({ ...p.expenseForm, amount: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
        <div className="space-y-1"><label className="text-xs text-cyan-400">Date</label><input type="date" value={p.expenseForm.date} onChange={e => p.setExpenseForm({ ...p.expenseForm, date: e.target.value })} className={inputCls} /></div>
        <div className="space-y-1"><label className="text-xs text-cyan-400">Status</label><select value={p.expenseForm.status} onChange={e => p.setExpenseForm({ ...p.expenseForm, status: e.target.value as any })} className={inputCls}><option value="pending">Pending</option><option value="paid">Paid</option></select></div>
        <div className="space-y-1 col-span-2"><label className="text-xs text-cyan-400">Description</label><input value={p.expenseForm.description} onChange={e => p.setExpenseForm({ ...p.expenseForm, description: e.target.value })} className={inputCls} /></div>
        {renderBillUpload(p.expenseForm.billUrl)}
      </div>
      <button onClick={p.handleSaveExpense} className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white p-4 rounded-lg font-bold text-lg shadow-lg shadow-cyan-500/20">{p.modalType === 'add' ? 'Add Expense' : 'Update Expense'}</button>
    </div>
  );

  const renderEmployeeForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1"><label className="text-xs text-cyan-400">Auto ID</label><input value={p.employeeForm.autoId} readOnly className={inputReadonly} /></div>
        <div className="space-y-1"><label className="text-xs text-cyan-400">Name <span className="text-yellow-400">(Auto Caps)</span></label><input placeholder="EMPLOYEE NAME" value={p.employeeForm.name} onChange={e => p.handleAutoCaps(e, 'name', p.setEmployeeForm)} className={inputCls + ' uppercase'} /></div>
        <div className="space-y-1"><label className="text-xs text-cyan-400">Role / Position</label><select value={p.employeeForm.role} onChange={e => p.handleAutoCaps(e, 'role', p.setEmployeeForm)} className={inputCls + ' uppercase'}><option>TEACHER</option><option>PRINCIPAL</option><option>ADMIN STAFF</option><option>ACCOUNTANT</option><option>LIBRARIAN</option><option>PEON</option><option>SECURITY</option><option>DRIVER</option><option>OTHER</option></select></div>
        <div className="space-y-1"><label className="text-xs text-cyan-400">Phone</label><input placeholder="Phone" value={p.employeeForm.phone} onChange={e => p.setEmployeeForm({ ...p.employeeForm, phone: e.target.value })} className={inputCls} /></div>
        <div className="space-y-1"><label className="text-xs text-cyan-400">Email</label><input placeholder="Email" value={p.employeeForm.email} onChange={e => p.setEmployeeForm({ ...p.employeeForm, email: e.target.value })} className={inputCls} /></div>
        <div className="space-y-1"><label className="text-xs text-cyan-400">Salary (₹)</label><input type="number" value={p.employeeForm.salary || ''} onChange={e => p.setEmployeeForm({ ...p.employeeForm, salary: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
        <div className="space-y-1"><label className="text-xs text-cyan-400">Auto Salary Refresh</label><label className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg border border-gray-700 text-white cursor-pointer"><input type="checkbox" checked={Boolean((p.employeeForm as any).salaryAutoRefresh)} onChange={e => p.setEmployeeForm(prev => ({ ...(prev as any), salaryAutoRefresh: e.target.checked }))} className="w-4 h-4 accent-cyan-500" /><span className="text-sm font-semibold">Enable monthly refresh</span></label></div>
        <div className="space-y-1"><label className="text-xs text-cyan-400">Salary Refresh Day</label><input type="number" min={1} max={28} value={(p.employeeForm as any).salaryRefreshDay || 1} onChange={e => p.setEmployeeForm(prev => ({ ...(prev as any), salaryRefreshDay: Math.min(Math.max(parseInt(e.target.value) || 1, 1), 28) }))} className={inputCls} /><p className="text-xs text-gray-500">Creates salary expense every month on/after this day.</p></div>
        <div className="space-y-1"><label className="text-xs text-cyan-400">Join Date</label><input type="date" value={p.employeeForm.joinDate} onChange={e => p.setEmployeeForm({ ...p.employeeForm, joinDate: e.target.value })} className={inputCls} /></div>
        <div className="space-y-1"><label className="text-xs text-cyan-400">Status</label><select value={p.employeeForm.status} onChange={e => { const status = e.target.value.toUpperCase(); p.setEmployeeForm(prev => ({ ...(prev as any), status, inactiveDate: status === 'INACTIVE' ? ((prev as any).inactiveDate || new Date().toISOString().split('T')[0]) : '' })); }} className={inputCls + ' uppercase'}><option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option></select></div>
        {p.employeeForm.status === 'INACTIVE' && <div className="space-y-1"><label className="text-xs text-cyan-400">Inactive Date</label><input type="date" value={(p.employeeForm as any).inactiveDate || ''} onChange={e => p.setEmployeeForm(prev => ({ ...(prev as any), inactiveDate: e.target.value }))} className={inputCls} /><p className="text-xs text-yellow-400">Salary counted only for 30 days after this date.</p></div>}
        <div className="space-y-1"><label className="text-xs text-cyan-400">Department <span className="text-yellow-400">(Auto Caps)</span></label><input placeholder="DEPARTMENT" value={p.employeeForm.department || ''} onChange={e => p.setEmployeeForm({ ...p.employeeForm, department: e.target.value.toUpperCase() })} className={inputCls + ' uppercase'} /></div>
        <div className="space-y-1"><label className="text-xs text-cyan-400">Bank Account No.</label><input placeholder="Bank Account Number" value={p.employeeForm.bankAccount || ''} onChange={e => p.setEmployeeForm({ ...p.employeeForm, bankAccount: e.target.value })} className={inputCls} /></div>
        <div className="space-y-1"><label className="text-xs text-cyan-400">PAN / Tax ID</label><input placeholder="PAN / Tax ID" value={p.employeeForm.panTaxId || ''} onChange={e => p.setEmployeeForm({ ...p.employeeForm, panTaxId: e.target.value.toUpperCase() })} className={inputCls + ' uppercase'} /></div>
        <div className="space-y-1 col-span-2"><label className="text-xs text-cyan-400">Address</label><input placeholder="Address" value={p.employeeForm.address} onChange={e => p.setEmployeeForm({ ...p.employeeForm, address: e.target.value })} className={inputCls} /></div>

      </div>
      <button onClick={p.handleSaveEmployee} className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white p-4 rounded-lg font-bold text-lg shadow-lg shadow-cyan-500/20">{p.modalType === 'add' ? 'Add Employee' : 'Update Employee'}</button>
    </div>
  );

  const parseOfferPoints = (raw: string): { t: string; d: string[] }[] =>
    raw.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      if (l === '_blank_') return { t: '', d: [] };
      const idx = l.indexOf('|');
      if (idx > -1) {
        const descRaw = l.substring(idx + 1).trim();
        return { t: l.substring(0, idx).trim(), d: descRaw ? descRaw.split('::').map(s => s.trim()) : [''] };
      }
      return { t: l, d: [] };
    });

  const serializePoints = (pts: { t: string; d: string[] }[]): string =>
    pts.map(x => {
      if (!x.t && x.d.length === 0) return '_blank_';
      const desc = x.d.join(' :: ');
      return x.t + (desc || x.d.length > 0 ? ' | ' + desc : '');
    }).join('\n');

  const renderOfferLetterSettings = () => {
    const pts = parseOfferPoints(p.schoolSettings.offerPoints || '');
    const addPoint = () => {
      const cur = parseOfferPoints(p.schoolSettings.offerPoints || '');
      p.setSchoolSettings({ ...p.schoolSettings, offerPoints: serializePoints([...cur, { t: '', d: [] }]) });
    };
    const updateTitle = (i: number, val: string) => {
      const cur = parseOfferPoints(p.schoolSettings.offerPoints || '');
      const next = cur.map((x, idx) => idx === i ? { ...x, t: val } : x);
      p.setSchoolSettings({ ...p.schoolSettings, offerPoints: serializePoints(next) });
    };
    const addDesc = (i: number) => {
      const cur = parseOfferPoints(p.schoolSettings.offerPoints || '');
      const next = cur.map((x, idx) => idx === i ? { ...x, d: [...x.d, ''] } : x);
      p.setSchoolSettings({ ...p.schoolSettings, offerPoints: serializePoints(next) });
    };
    const updateDesc = (i: number, di: number, val: string) => {
      const cur = parseOfferPoints(p.schoolSettings.offerPoints || '');
      const next = cur.map((x, idx) => idx === i ? { ...x, d: x.d.map((dd, ddi) => ddi === di ? val : dd) } : x);
      p.setSchoolSettings({ ...p.schoolSettings, offerPoints: serializePoints(next) });
    };
    const removeDesc = (i: number, di: number) => {
      const cur = parseOfferPoints(p.schoolSettings.offerPoints || '');
      const next = cur.map((x, idx) => idx === i ? { ...x, d: x.d.filter((_, ddi) => ddi !== di) } : x);
      p.setSchoolSettings({ ...p.schoolSettings, offerPoints: serializePoints(next) });
    };
    const removePoint = (i: number) => {
      const cur = parseOfferPoints(p.schoolSettings.offerPoints || '');
      p.setSchoolSettings({ ...p.schoolSettings, offerPoints: serializePoints(cur.filter((_, idx) => idx !== i)) });
    };

    const heading = p.schoolSettings.offerPointsHeading || 'Terms & Conditions';

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">Offer Letter Settings</h2>
          <button onClick={() => p.setShowOfferLetterSettings(false)} className="text-gray-400 hover:text-white transition hover:rotate-90 duration-300"><FiX size={24} /></button>
        </div>
        <div className="space-y-4">
          <div className="space-y-1"><label className="text-xs text-cyan-400">Offer Title</label><input value={p.schoolSettings.offerTitle || 'Offer Letter'} onChange={e => p.setSchoolSettings({ ...p.schoolSettings, offerTitle: e.target.value })} className={inputCls} /></div>
          <div className="space-y-1"><label className="text-xs text-cyan-400">Subject</label><textarea value={p.schoolSettings.offerIntro || ''} onChange={e => p.setSchoolSettings({ ...p.schoolSettings, offerIntro: e.target.value })} className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white text-sm h-20" placeholder="Subject: Appointment for the position of..." /></div>

          <div className="space-y-1"><label className="text-xs text-cyan-400">Points Heading</label><input value={p.schoolSettings.offerPointsHeading || 'Terms & Conditions'} onChange={e => p.setSchoolSettings({ ...p.schoolSettings, offerPointsHeading: e.target.value })} className={inputCls} placeholder="Terms & Conditions" /></div>

          {/* Dynamic Points Builder */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs text-cyan-400 font-semibold">Points / Conditions</label>
              <button onClick={addPoint} className="flex items-center gap-1 text-xs bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-3 py-1.5 rounded-lg font-semibold"><FiPlus size={14} /> Add Point</button>
            </div>
            {pts.length === 0 && <p className="text-xs text-gray-500 italic">No points added. Click "Add Point" to create one.</p>}
            {pts.map((pt, i) => (
              <div key={i} className="flex gap-2 items-start bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                <div className="flex-1 space-y-2">
                  <input value={pt.t} onChange={e => updateTitle(i, e.target.value)} className="w-full p-2 bg-gray-800 rounded-lg border border-gray-700 text-white text-sm" placeholder="Point title" />
                  {pt.d.map((desc, di) => (
                    <div key={di} className="flex gap-1 items-center">
                      <span className="text-gray-500 text-xs shrink-0">•</span>
                      <input value={desc} onChange={e => updateDesc(i, di, e.target.value)} className="flex-1 p-1.5 bg-gray-900 rounded-lg border border-gray-700 text-white text-xs" placeholder={`Description ${di + 1}`} />
                      <button onClick={() => removeDesc(i, di)} className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded"><FiX size={12} /></button>
                    </div>
                  ))}
                  <button onClick={() => addDesc(i)} className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"><FiPlus size={12} /> Add description</button>
                </div>
                <button onClick={() => removePoint(i)} className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded mt-1"><FiX size={16} /></button>
              </div>
            ))}
          </div>

          <div className="space-y-1"><label className="text-xs text-cyan-400">Additional Terms</label><textarea value={p.schoolSettings.offerTerms || ''} onChange={e => p.setSchoolSettings({ ...p.schoolSettings, offerTerms: e.target.value })} className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white h-20" placeholder="Final terms, validity, joining formalities..." /></div>
          <div className="space-y-1"><label className="text-xs text-cyan-400">Acknowledgement <span className="text-gray-500">(shown before signature)</span></label><textarea value={p.schoolSettings.offerAck || ''} onChange={e => p.setSchoolSettings({ ...p.schoolSettings, offerAck: e.target.value })} className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white h-16" placeholder="I acknowledge and accept the terms..." /></div>
          <div className="space-y-1"><label className="text-xs text-cyan-400">Signatory</label><input value={p.schoolSettings.offerSignatory || ''} onChange={e => p.setSchoolSettings({ ...p.schoolSettings, offerSignatory: e.target.value })} className={inputCls} placeholder="Principal / Administrator" /></div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => p.setShowOfferLetterSettings(false)} className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-500 text-white p-3 rounded-lg font-bold">Done</button>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (p.showClassMgmt) return renderClassMgmt();
    if (p.showPackageMgmt) return renderPackageMgmt();
    if (p.showDocumentMgmt) return renderDocumentMgmt();
    if (p.showOfferLetterSettings) return renderOfferLetterSettings();
    if (p.showSettings) return renderSettings();
    switch (p.activeTab) {
      case 'students': return renderStudentForm();
      case 'fees': return renderFeeForm();
      case 'expenses': return renderExpenseForm();
      case 'employees': return renderEmployeeForm();
      default: return renderStudentForm();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1E1E1E] rounded-2xl p-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-gray-800 shadow-2xl">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-800">
          <h3 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">{p.modalTitle}</h3>
          <button onClick={p.onClose} className="text-gray-400 hover:text-white transition hover:rotate-90 duration-300"><FiX size={28} /></button>
        </div>
        {renderContent()}
      </div>
    </div>
  );
};