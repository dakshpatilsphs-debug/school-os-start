// ── AI Assistant frontend types ──

export interface AttachmentContent {
  type: 'image_url' | 'file';
  mime: string;
  data: string; // base64
  originalName: string;
}

export interface AIRequest {
  message: string;
  attachments?: AttachmentContent[];
  conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
  pageContext?: string;
}

export interface AIResponse {
  text: string;
  pdfChangePlan?: PdfChangePlan | null;
  error?: string;
}

export interface PdfIssue {
  severity: 'critical' | 'warning' | 'suggestion';
  category: string;
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
  | { type: 'setPdfSetting'; key: string; value: string | number }
  | { type: 'replaceReportText'; target: string; value: string }
  | { type: 'suggestDataCorrection'; recordType: string; recordId: string; field: string; currentValue: string; proposedValue: string; reason: string; confidence: number };

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  attachments?: { name: string; type: string }[];
  timestamp: Date;
}
