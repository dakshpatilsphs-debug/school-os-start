import * as XLSX from 'xlsx';

/**
 * Proper Excel Export Helper
 * - Adds school header, title, subtitle, date, record count
 * - Merged title rows, auto-fitted columns, filters, freeze panes
 * - Totals row for numeric/currency columns
 * - Handles empty data gracefully
 * - Consistent styling (where supported) and professional structure
 */

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number; // wch
  type?: 'string' | 'number' | 'currency' | 'date';
  total?: boolean;
}

export interface ProperExcelOptions {
  schoolSettings?: any;
  title: string;
  subtitle?: string;
  filename: string;
  sheetName?: string;
  columns: ExcelColumn[];
  data: Record<string, any>[];
  showTotals?: boolean;
  extraInfo?: string; // e.g. "Class: 10A | Month: 2026-09"
}

const DEFAULT_SCHOOL_NAME = 'School OS';
const toHeader = (key: string) => key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $&').trim();

// Auto width based on header + data max length
const calcColWidths = (aoa: any[][], columns: ExcelColumn[]) => {
  const colCount = columns.length;
  const widths: { wch: number }[] = [];
  for (let c = 0; c < colCount; c++) {
    const headerLen = String(columns[c].header || '').length;
    let maxLen = headerLen;
    for (let r = 5; r < aoa.length; r++) { // data starts at row 5 (0-indexed 5 = 6th row)
      const val = aoa[r]?.[c];
      if (val !== undefined && val !== null) {
        const s = String(val);
        if (s.length > maxLen) maxLen = s.length;
      }
    }
    // Include explicit width if provided
    const explicit = columns[c].width;
    const wch = explicit ? Math.max(explicit, Math.min(maxLen + 4, 40)) : Math.min(Math.max(maxLen + 4, 12), 40);
    widths.push({ wch });
  }
  return widths;
};

const applyHeaderStyle = (ws: any, headerRowIdx: number, colCount: number) => {
  // Try to style header row (works with xlsx-js-style, ignored with plain xlsx)
  for (let c = 0; c < colCount; c++) {
    const addr = XLSX.utils.encode_cell({ r: headerRowIdx, c });
    const cell = ws[addr];
    if (!cell) continue;
    // @ts-ignore - style property for xlsx-js-style
    cell.s = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
      fill: { fgColor: { rgb: '0EA5E9' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        top: { style: 'thin', color: { rgb: 'E2E8F0' } },
        bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
        left: { style: 'thin', color: { rgb: 'E2E8F0' } },
        right: { style: 'thin', color: { rgb: 'E2E8F0' } },
      },
    };
  }
};

const applyTitleStyles = (ws: any, colCount: number) => {
  // Title rows 0-2 (merged) - style if supported
  const titleAddrs = [
    XLSX.utils.encode_cell({ r: 0, c: 0 }),
    XLSX.utils.encode_cell({ r: 1, c: 0 }),
    XLSX.utils.encode_cell({ r: 2, c: 0 }),
  ];
  const styles = [
    { font: { bold: true, sz: 16, color: { rgb: '0F172A' } }, alignment: { horizontal: 'center', vertical: 'center' } },
    { font: { bold: true, sz: 12, color: { rgb: '0EA5E9' } }, alignment: { horizontal: 'center', vertical: 'center' } },
    { font: { sz: 9, color: { rgb: '64748B' } }, alignment: { horizontal: 'center', vertical: 'center' } },
  ];
  titleAddrs.forEach((addr, i) => {
    const cell = ws[addr];
    if (cell) {
      // @ts-ignore
      cell.s = { ...styles[i], fill: i === 0 ? { fgColor: { rgb: 'F8FAFC' } } : undefined };
    }
  });
};

export const exportProperExcel = (
  opts: ProperExcelOptions,
  showNotification?: (msg: string, type: 'success' | 'error') => void
) => {
  const schoolName = opts.schoolSettings?.schoolName || DEFAULT_SCHOOL_NAME;
  const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const colCount = opts.columns.length;

  if (!opts.data || opts.data.length === 0) {
    // Still export with headers and no data, but notify
    showNotification?.(`No data to export for ${opts.title}`, 'error');
    // Continue to export empty with headers so user gets file structure
  }

  const subtitle = opts.subtitle || `${opts.data.length} records`;
  const extra = opts.extraInfo ? ` | ${opts.extraInfo}` : '';

  // Build AOA with title block
  const aoa: any[][] = [];
  // Row 0: School Name
  aoa.push([schoolName.toUpperCase()]);
  // Row 1: Title
  aoa.push([opts.title]);
  // Row 2: Subtitle + date + count
  aoa.push([`${subtitle}${extra}  •  Generated: ${dateStr} ${timeStr}`]);
  // Row 3: blank separator
  aoa.push([]);
  // Row 4: spacer? We'll have header at row 4 (0-indexed 4)
  // Actually header at index 4
  // Row 4 is header
  aoa.push(opts.columns.map(c => c.header));

  // Data rows starting at index 5
  const dataStartRow = 5;
  opts.data.forEach(row => {
    const arr = opts.columns.map(col => {
      let val = row[col.key];
      if (val === undefined || val === null) return '';
      if (col.type === 'currency') {
        // Keep as number for Excel numeric, else format
        const num = Number(val);
        return isNaN(num) ? String(val) : num;
      }
      if (col.type === 'number') {
        const num = Number(val);
        return isNaN(num) ? String(val) : num;
      }
      return String(val);
    });
    aoa.push(arr);
  });

  // Totals row if needed
  let totalsRowIdx = -1;
  if (opts.showTotals && opts.data.length > 0) {
    const totals: any[] = [];
    opts.columns.forEach((col, idx) => {
      if (idx === 0) {
        totals.push('TOTAL');
      } else if (col.total) {
        const sum = opts.data.reduce((s, r) => {
          const v = Number(r[col.key] ?? 0);
          return s + (isNaN(v) ? 0 : v);
        }, 0);
        // For currency, keep as number
        totals.push(sum);
      } else {
        // For non-total columns, leave blank or count for first string col
        if (idx === 1 && !opts.columns.some(c => c.total)) {
          totals.push(`${opts.data.length} records`);
        } else totals.push('');
      }
    });
    aoa.push(totals);
    totalsRowIdx = aoa.length - 1;
  }

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // Merges for title rows
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: colCount - 1 } },
  ];
  // Column widths
  ws['!cols'] = calcColWidths(aoa, opts.columns);
  // Row heights for titles
  ws['!rows'] = [
    { hpt: 22 }, // school
    { hpt: 18 }, // title
    { hpt: 14 }, // subtitle
    { hpt: 6 },  // spacer
    { hpt: 18 }, // header
  ];
  // Freeze header + title block, autofilter on header
  const headerRowIdx = 4;
  ws['!freeze'] = { xSplit: 0, ySplit: 5, topLeftCell: 'A6', activePane: 'bottomLeft', state: 'frozen' } as any;
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: headerRowIdx, c: 0 }, e: { r: headerRowIdx, c: colCount - 1 } }) } as any;

  // Apply styles (best effort)
  try {
    applyTitleStyles(ws, colCount);
    applyHeaderStyle(ws, headerRowIdx, colCount);
    // Totals row style
    if (totalsRowIdx >= 0) {
      for (let c = 0; c < colCount; c++) {
        const addr = XLSX.utils.encode_cell({ r: totalsRowIdx, c });
        const cell = ws[addr];
        if (cell) {
          // @ts-ignore
          cell.s = {
            font: { bold: true, color: { rgb: c === 0 ? 'FFFFFF' : '0F172A' } },
            fill: { fgColor: { rgb: c === 0 ? '0EA5E9' : 'F1F5F9' } },
            alignment: { horizontal: opts.columns[c].type === 'currency' || opts.columns[c].type === 'number' ? 'right' : 'center', vertical: 'center' },
            border: { top: { style: 'medium', color: { rgb: '0EA5E9' } } },
          };
          // For currency totals, set number format
          if (opts.columns[c].total) {
            // @ts-ignore
            cell.z = '#,##0';
            // If currency, add rupee? Keep number, Excel will show as number
          }
        }
      }
    }
    // Data rows number formats for currency
    for (let r = dataStartRow; r < dataStartRow + opts.data.length; r++) {
      opts.columns.forEach((col, c) => {
        if (col.type === 'currency' || col.type === 'number') {
          const addr = XLSX.utils.encode_cell({ r, c });
          const cell = ws[addr];
          if (cell && typeof cell.v === 'number') {
            // @ts-ignore
            cell.z = col.type === 'currency' ? '"₹"#,##0' : '#,##0';
            // @ts-ignore
            if (!cell.s) cell.s = {};
            // @ts-ignore
            cell.s.alignment = { horizontal: 'right', vertical: 'center' };
          }
        }
      });
    }
  } catch {}

  // Print settings and page setup for better printing
  ws['!printHeader'] = ws['!printHeader'] || [] as any;
  (ws as any)['!margins'] = { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };

  const wb = XLSX.utils.book_new();
  const safeSheetName = (opts.sheetName || opts.title).slice(0, 31).replace(/[\\\/\*\[\]:?]/g, '');
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName || 'Sheet1');

  // Filename with date
  const safeFilename = opts.filename.replace(/[^a-zA-Z0-9_\-]/g, '_');
  const finalFilename = `${safeFilename}_${new Date().toISOString().split('T')[0]}.xlsx`;

  // Write with cellStyles if supported
  try {
    XLSX.writeFile(wb, finalFilename, { cellStyles: true } as any);
  } catch {
    XLSX.writeFile(wb, finalFilename);
  }
  showNotification?.(`Exported ${opts.data.length} records to ${finalFilename}`, 'success');
};

// Specific column presets for each entity

export const studentColumns: ExcelColumn[] = [
  { header: 'Auto ID', key: 'autoId', width: 12 },
  { header: 'Name', key: 'name', width: 22 },
  { header: 'Roll', key: 'rollNumber', width: 8 },
  { header: 'Class', key: 'class', width: 10 },
  { header: 'Parent', key: 'parentName', width: 20 },
  { header: 'Phone', key: 'parentPhone', width: 14 },
  { header: 'Email', key: 'email', width: 22 },
  { header: 'Package', key: 'package', width: 12 },
  { header: 'Fee Amount', key: 'feeAmount', width: 13, type: 'currency', total: true },
  { header: 'Status', key: 'status', width: 10 },
  { header: 'Admission Date', key: 'admissionDate', width: 14, type: 'date' },
  { header: 'Gender', key: 'gender', width: 10 },
];

export const feeColumns: ExcelColumn[] = [
  { header: 'Fee ID', key: 'autoId', width: 12 },
  { header: 'Student ID', key: 'studentId', width: 12 },
  { header: 'Student Name', key: 'studentName', width: 20 },
  { header: 'Amount', key: 'amount', width: 12, type: 'currency', total: true },
  { header: 'Original Amount', key: 'originalAmount', width: 14, type: 'currency' },
  { header: 'Discount', key: 'discountAmount', width: 12, type: 'currency' },
  { header: 'Type', key: 'type', width: 14 },
  { header: 'Due Date', key: 'dueDate', width: 12, type: 'date' },
  { header: 'Paid Date', key: 'paidDate', width: 12, type: 'date' },
  { header: 'Status', key: 'status', width: 10 },
  { header: 'Description', key: 'description', width: 24 },
];

export const expenseColumns: ExcelColumn[] = [
  { header: 'Expense ID', key: 'autoId', width: 12 },
  { header: 'Category', key: 'category', width: 14 },
  { header: 'Amount', key: 'amount', width: 12, type: 'currency', total: true },
  { header: 'Description', key: 'description', width: 30 },
  { header: 'Date', key: 'date', width: 12, type: 'date' },
  { header: 'Paid To', key: 'paidTo', width: 18 },
  { header: 'Employee ID', key: 'employeeId', width: 12 },
  { header: 'Status', key: 'status', width: 10 },
  { header: 'Salary Month', key: 'salaryMonth', width: 12 },
];

export const employeeColumns: ExcelColumn[] = [
  { header: 'Employee ID', key: 'autoId', width: 12 },
  { header: 'Name', key: 'name', width: 20 },
  { header: 'Role', key: 'role', width: 16 },
  { header: 'Phone', key: 'phone', width: 14 },
  { header: 'Email', key: 'email', width: 22 },
  { header: 'Department', key: 'department', width: 16 },
  { header: 'Salary', key: 'salary', width: 12, type: 'currency', total: true },
  { header: 'Join Date', key: 'joinDate', width: 12, type: 'date' },
  { header: 'Status', key: 'status', width: 10 },
  { header: 'Bank Account', key: 'bankAccount', width: 18 },
];

export const equipmentColumns: ExcelColumn[] = [
  { header: 'Equipment ID', key: 'autoId', width: 12 },
  { header: 'Name', key: 'name', width: 22 },
  { header: 'Category', key: 'category', width: 14 },
  { header: 'Assigned To', key: 'assignedToName', width: 18 },
  { header: 'Type', key: 'assignedToType', width: 10 },
  { header: 'Qty', key: 'quantity', width: 8, type: 'number', total: true },
  { header: 'Condition', key: 'condition', width: 14 },
  { header: 'Value', key: 'value', width: 12, type: 'currency', total: true },
  { header: 'Total Value', key: '_totalValue', width: 14, type: 'currency', total: true },
  { header: 'Status', key: 'status', width: 12 },
  { header: 'Purchase Date', key: 'purchaseDate', width: 14, type: 'date' },
];

export const feesByStudentColumns: ExcelColumn[] = [
  { header: 'Auto ID', key: 'autoId', width: 12 },
  { header: 'Name', key: 'name', width: 20 },
  { header: 'Class', key: 'class', width: 10 },
  { header: 'Package', key: 'totalPackage', width: 12, type: 'currency', total: true },
  { header: 'Paid', key: 'totalPaid', width: 12, type: 'currency', total: true },
  { header: 'Balance', key: 'balance', width: 12, type: 'currency', total: true },
  { header: 'Overdue', key: 'totalOverdue', width: 12, type: 'currency', total: true },
  { header: 'Status', key: 'paymentStatus', width: 12 },
  { header: 'Fee Count', key: 'feeCount', width: 10, type: 'number' },
];

// Sample import helpers — keep header at row 1 for import compatibility, but add styling, widths, filters, notes
export const exportSampleExcel = (
  isFees: boolean,
  showNotification?: (msg: string, type: 'success' | 'error') => void
) => {
  const aoa: any[][] = isFees
    ? [
        ['Auto ID', 'Student Auto ID', 'Student Name', 'Amount', 'Fee Type', 'Due Date', 'Paid Date', 'Status', 'Description'],
        ['FEE-001', 'STU-001', 'John Doe', 16000, 'Tuition Fee', '2026-01-10', '2026-01-05', 'paid', 'Term 1 fees'],
        ['FEE-002', 'STU-002', 'Jane Smith', 20000, 'Admission Fee', '2026-01-10', '', 'pending', ''],
        ['FEE-003', 'STU-003', 'Ali Khan', 12000, 'Tuition Fee', '2026-01-10', '', 'overdue', 'Term 1 fees'],
      ]
    : [
        ['Auto ID', 'Name', 'Class', 'Roll Number', 'Package', 'Fee Amount', 'Parent Name', 'Parent Phone', 'Email', 'Address', 'Date of Birth', 'Gender', 'Admission Date', 'Status'],
        ['STU-001', 'John Doe', 'CLASS 1', '001', 'Basic', 16000, 'John Doe Sr', '9876543210', 'john@example.com', 'Main Road, City', '2018-01-01', 'MALE', '2026-04-01', 'ACTIVE'],
        ['STU-002', 'Jane Smith', 'CLASS 1', '002', 'Standard', 20000, 'Jane Smith Sr', '9876543211', '', '', '2017-06-15', 'FEMALE', '2026-04-01', 'ACTIVE'],
        ['', 'Ali Khan', 'CLASS 2', '', 'Basic', 12000, 'Ali Khan Sr', '9876543212', '', '', '2019-03-20', 'MALE', '2026-04-01', 'ACTIVE'],
      ];

  // Add instructions as second sheet
  const instructionAoa = [
    ['INSTRUCTIONS'],
    ['1. Do not change header row (row 1). Import reads headers exactly.'],
    ['2. Auto ID can be left blank for new records — it will be auto-generated.'],
    ['3. Date format must be YYYY-MM-DD.'],
    ['4. For Fees: Status must be paid/pending/overdue.'],
    ['5. For Students: Status ACTIVE/INACTIVE, Gender MALE/FEMALE/OTHER.'],
    ['6. Keep Package names matching Manage Packages.'],
    ['7. Delete these example rows before importing your data.'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = (aoa[0] || []).map((_, i) => ({ wch: Math.max(...aoa.map(r => String(r[i] ?? '').length), 12) + 2 }));
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: aoa[0].length - 1 } }) } as any;
  ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' } as any;
  // Header style
  for (let c = 0; c < aoa[0].length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    const cell = ws[addr];
    if (cell) {
      // @ts-ignore
      cell.s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '0EA5E9' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      };
    }
  }
  // Example rows subtle fill
  for (let r = 1; r < aoa.length; r++) {
    for (let c = 0; c < aoa[0].length; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (cell) {
        // @ts-ignore
        cell.s = { fill: { fgColor: { rgb: r % 2 === 0 ? 'F8FAFC' : 'FFFFFF' } } };
      }
    }
  }

  const ws2 = XLSX.utils.aoa_to_sheet(instructionAoa);
  ws2['!cols'] = [{ wch: 90 }];
  // Style instructions title
  const tcell = ws2[XLSX.utils.encode_cell({ r: 0, c: 0 })];
  if (tcell) {
    // @ts-ignore
    tcell.s = { font: { bold: true, sz: 12, color: { rgb: '0EA5E9' } } };
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, isFees ? 'Fees' : 'Students');
  XLSX.utils.book_append_sheet(wb, ws2, 'Instructions');
  const fname = `Sample_${isFees ? 'Fees' : 'Students'}_Import_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fname, { cellStyles: true } as any);
  showNotification?.('Sample file downloaded', 'success');
};
