// ===== Plain & Clean PDF Design System =====
// Minimalist design: no gradients, no textures, no decorative shapes.
// Free-size logo, vertically centered summary, lots of white space.

export interface PDFColors {
  primary: [number, number, number];
  secondary: [number, number, number];
  dark: [number, number, number];
  muted: [number, number, number];
  light: [number, number, number];
  lighter: [number, number, number];
  white: [number, number, number];
  border: [number, number, number];
}

export const getColors = (primaryHex: string, secondaryHex: string): PDFColors => {
  const h2r = (hex: string): [number, number, number] => {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return r ? [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)] : [0, 102, 204];
  };
  return {
    primary: h2r(primaryHex),
    secondary: h2r(secondaryHex),
    dark: [17, 24, 39],
    muted: [100, 116, 139],
    light: [241, 245, 249],
    lighter: [248, 250, 252],
    white: [255, 255, 255],
    border: [226, 232, 240],
  };
};

// Extended settings interface for PDF Editor
export interface PDFSettings {
  pdfHeading?: string;
  pdfSubtitle?: string;
  pdfFooterText?: string;
  pdfLogoWidth?: number;
  pdfLogoHeight?: number;
  pdfHeaderColor?: string;
  pdfBodyColor?: string;
  pdfTableHeaderColor?: string;
  pdfAccentColor?: string;
  pdfTitleSize?: number;
  pdfBodySize?: number;
}

// Get colors from PDF settings (uses custom colors if set)
export const getPDFColorsFromSettings = (s: PDFSettings): PDFColors => {
  const h2r = (hex: string): [number, number, number] => {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return r ? [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)] : [0, 102, 204];
  };
  return {
    primary: h2r(s.pdfHeaderColor || '#0ea5e9'),
    secondary: h2r(s.pdfAccentColor || '#4361ee'),
    dark: h2r(s.pdfBodyColor || '#1e293b'),
    muted: [100, 116, 139],
    light: [241, 245, 249],
    lighter: [248, 250, 252],
    white: [255, 255, 255],
    border: [226, 232, 240],
  };
};

export const fmtDate = (date?: Date): string =>
  (date || new Date()).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

export const money = (v: number): string => 'Rs ' + (v || 0).toLocaleString('en-IN');

export const getStatusColor = (status: string): [number, number, number] => {
  const s = (status || '').toLowerCase();
  if (['paid', 'active', 'completed'].includes(s)) return [16, 185, 129];
  if (['pending', 'partial'].includes(s)) return [245, 158, 11];
  if (['overdue', 'inactive', 'unpaid', 'cancelled'].includes(s)) return [239, 68, 68];
  return [100, 116, 139];
};

// Get image dimensions using jsPDF's native API for free-size placement
export const getImageSize = (doc: any, logoBase64: string): { w: number; h: number } => {
  try {
    const props = doc.getImageProperties(logoBase64);
    return { w: props.width, h: props.height };
  } catch {
    // Fallback: try DOM Image (works for data URLs)
    try {
      const img = new Image();
      img.src = logoBase64;
      return { w: img.naturalWidth || 200, h: img.naturalHeight || 200 };
    } catch {
      return { w: 200, h: 200 };
    }
  }
};

// ===== Plain Cover Page =====
export const drawCoverPage = (doc: any, title: string, schoolName: string, address: string, phone: string, email: string, logo: string, c: PDFColors, pw: number, stats: [string, string][], settings?: any) => {
  const ph = 297;
  const s = settings || {};
  const titleSize = s.pdfTitleSize || 20;
  const bodySize = s.pdfBodySize || 9;
  const subtitle = s.pdfSubtitle || '';
  const footerText = s.pdfFooterText || '';
  const logoWSetting = s.pdfLogoWidth || 40;
  const logoHSetting = s.pdfLogoHeight || 40;

  // --- Top section: Logo + School Name (plain, centered) ---
  let logoY = 35;
  let logoH = 0;
  let logoW = 0;

  // Custom size logo: use editor settings OR auto-fit
  if (logo) {
    try {
      // Use custom size from editor (constrained to max 80mm)
      logoW = Math.min(logoWSetting, 80);
      logoH = Math.min(logoHSetting, 80);
      doc.addImage(logo, 'PNG', pw / 2 - logoW / 2, logoY, logoW, logoH);
      logoY = logoY + logoH + 10;
    } catch (e) {
      logoY = 45;
    }
  } else {
    logoY = 50;
  }

  // School name (below logo)
  doc.setTextColor(...c.dark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text((schoolName || 'School OS').toUpperCase(), pw / 2, logoY, { align: 'center' });

  // Address + contact
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(bodySize);
  doc.setTextColor(...c.muted);
  let contactY = logoY + 8;
  if (address) { doc.text(address, pw / 2, contactY, { align: 'center' }); contactY += 5; }
  doc.text(`${phone || ''}   |   ${email || ''}`, pw / 2, contactY, { align: 'center' });

  // --- Title section ---
  const titleY = contactY + 18;
  doc.setDrawColor(...c.secondary);
  doc.setLineWidth(0.5);
  doc.line(pw / 2 - 35, titleY - 6, pw / 2 + 35, titleY - 6);

  doc.setTextColor(...c.dark);
  doc.setFontSize(titleSize);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pw / 2, titleY, { align: 'center' });

  // Subtitle (if set)
  let subtitleY = titleY + 7;
  if (subtitle) {
    doc.setFontSize(bodySize);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...c.muted);
    doc.text(subtitle, pw / 2, subtitleY, { align: 'center' });
    subtitleY += 5;
  }

  doc.setFontSize(bodySize);
  doc.text(fmtDate(), pw / 2, subtitleY, { align: 'center' });

  // --- Summary table (vertically centered on the page) ---
  if (stats.length > 0) {
    const rowH = 10;
    const headerH = 12;
    const tableH = headerH + stats.length * rowH;
    const tableTop = (ph - tableH) / 2 + 15;
    const tableW = pw - 40; // Spans symmetrically with 20mm margins for cover page styling
    const tableX = (pw - tableW) / 2;

    // Table border
    doc.setDrawColor(...c.border);
    doc.setLineWidth(0.4);
    doc.rect(tableX, tableTop, tableW, tableH);

    // Header row background (uses table header color from settings)
    doc.setFillColor(...c.primary);
    doc.rect(tableX, tableTop, tableW, headerH, 'F');
    doc.setTextColor(...c.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('SUMMARY', tableX + tableW / 2, tableTop + 8, { align: 'center' });
    doc.setDrawColor(...c.border);
    doc.line(tableX, tableTop + headerH, tableX + tableW, tableTop + headerH);

    // Stats rows
    let sy = tableTop + headerH + 7;
    stats.forEach(([label, val]) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(bodySize);
      doc.setTextColor(...c.muted);
      doc.text(label, tableX + 8, sy);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(bodySize + 1);
      doc.setTextColor(...c.dark);
      doc.text(val, tableX + tableW - 8, sy, { align: 'right' });
      if (sy < tableTop + tableH - rowH) {
        doc.setDrawColor(...c.light);
        doc.setLineWidth(0.2);
        doc.line(tableX + 5, sy + 3, tableX + tableW - 5, sy + 3);
      }
      sy += rowH;
    });
  }

  // --- Bottom: footer text (custom or default) ---
  doc.setFontSize(8);
  doc.setTextColor(...c.muted);
  doc.setFont('helvetica', 'normal');
  if (footerText) {
    doc.text(footerText, pw / 2, ph - 14, { align: 'center' });
  }
  doc.text('Generated by School OS', pw / 2, ph - 9, { align: 'center' });
};

// ===== Plain Page Header =====
export const drawHeader = (doc: any, title: string, subtitle: string, c: PDFColors, pw: number, logo?: string, schoolName?: string, settings?: any) => {
  const s = settings || {};
  const bodySize = s.pdfBodySize || 8;
  // Solid color header band
  doc.setFillColor(...c.primary);
  doc.rect(0, 0, pw, 24, 'F');

  // Logo (use custom size if set, constrained to header height)
  let textX = 10;
  if (logo) {
    try {
      const lw = Math.min(s.pdfLogoWidth ? s.pdfLogoWidth * 0.4 : 16, 18);
      const lh = Math.min(s.pdfLogoHeight ? s.pdfLogoHeight * 0.4 : 16, 18);
      const ly = (24 - lh) / 2;
      doc.addImage(logo, 'PNG', 10, ly, lw, lh);
      textX = 10 + lw + 4;
    } catch (e) {}
  }

  // School name
  doc.setTextColor(...c.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text((schoolName || 'School OS').toUpperCase(), textX, 10);

  // Title
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(bodySize);
  doc.setTextColor(...c.white);
  doc.text(title, textX, 17);

  // Date on right
  doc.setFontSize(7.5);
  doc.setTextColor(...c.white);
  doc.text(fmtDate(), pw - 10, 10, { align: 'right' });
  if (subtitle) doc.text(subtitle, pw - 10, 17, { align: 'right' });
};

// ===== Plain Footer =====
export const drawFooter = (doc: any, schoolName: string, pw: number, settings?: any) => {
  const ph = doc.internal.pageSize.height || 297;
  const pages = doc.getNumberOfPages();
  const footerText = settings?.pdfFooterText || '';
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...c_border());
    doc.setLineWidth(0.3);
    doc.line(10, ph - 14, pw - 10, ph - 14);
    doc.setFontSize(7.5);
    doc.setTextColor(...c_muted());
    doc.setFont('helvetica', 'normal');
    const leftText = footerText ? `${schoolName}  |  ${footerText}` : `${schoolName}  |  ${fmtDate()}`;
    doc.text(leftText, 10, ph - 9);
    doc.text(`Page ${i} of ${pages}`, pw - 10, ph - 9, { align: 'right' });
  }
};

// Local color helpers for footer (avoid passing colors object)
const c_border = (): [number, number, number] => [203, 213, 225];
const c_muted = (): [number, number, number] => [148, 163, 184];