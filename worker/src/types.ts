// ── AI Assistant shared types (worker-side) ──

export interface AttachmentContent {
  type: 'image_url';
  mime: string;
  data: string; // base64
  originalName: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | ChatContentPart[];
}

export type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'file'; file: { filename: string; file_data: string } };

export interface AIRequest {
  message: string;
  attachments?: AttachmentContent[];
  conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
  pdfChangePlan?: PdfChangePlan;
  pageContext?: string;
}

export interface AIResponse {
  text: string;
  pdfChangePlan?: PdfChangePlan | null;
  error?: string;
}

export interface PdfIssue {
  severity: 'critical' | 'warning' | 'suggestion';
  category: 'spelling' | 'missing-data' | 'formatting' | 'layout' | 'branding' | 'readability' | 'data-consistency';
  location: string;
  description: string;
  recommendation: string;
  confidence: number;
}

export interface PdfChangePlan {
  summary: string;
  issues: PdfIssue[];
  operations: PdfOperation[];
  limitations: string[];
}

export type PdfOperation =
  | { type: 'setPdfSetting'; key: AllowedPdfSettingKey; value: string | number }
  | { type: 'replaceReportText'; target: AllowedReportTextTarget; value: string }
  | { type: 'suggestDataCorrection'; recordType: string; recordId: string; field: string; currentValue: string; proposedValue: string; reason: string; confidence: number };

export type AllowedPdfSettingKey =
  | 'pdfHeading' | 'pdfSubtitle' | 'pdfFooterText'
  | 'pdfStudentSubtitle' | 'pdfFeesSubtitle' | 'pdfEmployeeSubtitle'
  | 'pdfExpenseSubtitle' | 'pdfEquipmentSubtitle' | 'pdfClassSummarySubtitle' | 'pdfFinancialSubtitle'
  | 'pdfLogoWidth' | 'pdfLogoHeight'
  | 'pdfHeaderColor' | 'pdfBodyColor' | 'pdfTableHeaderColor' | 'pdfAccentColor'
  | 'pdfTitleSize' | 'pdfBodySize';

export type AllowedReportTextTarget =
  | 'report-heading' | 'report-subtitle' | 'report-footer'
  | 'student-section-subtitle' | 'fees-section-subtitle'
  | 'employee-section-subtitle' | 'expense-section-subtitle'
  | 'equipment-section-subtitle' | 'class-summary-subtitle' | 'financial-subtitle';

// ── Auth / Security ──

export interface AuthenticatedUser {
  uid: string;
  email: string | null;
  role: 'admin' | 'staff' | 'teacher' | 'student' | 'parent';
}

export interface AuditEntry {
  timestamp: string;
  requesterUid: string;
  actionType: 'chat' | 'pdf-review' | 'pdf-apply-changes' | 'attachment-upload' | 'error';
  resultStatus: 'success' | 'rejected' | 'error';
  approvedPatchId?: string;
  errorMessage?: string;
  requestSize?: number;
  attachmentCount?: number;
}

// ── Allowed MIME types ──

export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const ALLOWED_PDF_TYPES = ['application/pdf'] as const;
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm'] as const;
export const ALLOWED_MIME_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_PDF_TYPES, ...ALLOWED_VIDEO_TYPES] as const;

export type AllowedMimeType = typeof ALLOWED_MIME_TYPES[number];

export const MAX_ATTACHMENTS = 3;
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;      // 10 MB
export const MAX_PDF_SIZE = 15 * 1024 * 1024;        // 15 MB
export const MAX_VIDEO_SIZE = 25 * 1024 * 1024;       // 25 MB
export const MAX_VIDEO_DURATION = 60;                 // seconds
export const MAX_MESSAGE_LENGTH = 4000;
export const MAX_CONVERSATION_TURNS = 20;
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX = 20;
