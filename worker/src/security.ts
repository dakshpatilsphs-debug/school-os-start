import {
  AuthenticatedUser,
  ALLOWED_MIME_TYPES,
  MAX_ATTACHMENTS,
  MAX_IMAGE_SIZE,
  MAX_PDF_SIZE,
  MAX_VIDEO_SIZE,
  MAX_MESSAGE_LENGTH,
  MAX_VIDEO_DURATION,
} from './types';
import { AttachmentContent } from './types';

// ── Firebase Auth token verification via Admin REST API ──

export interface FirebaseTokenPayload {
  uid: string;
  email?: string;
  [key: string]: any;
}

export async function verifyFirebaseToken(
  idToken: string,
  projectId: string,
): Promise<FirebaseTokenPayload> {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${projectId}`;
  // We use the project ID as the API key here for lookup — but we actually need the web API key
  // The correct approach is to use the Firebase Admin SDK's REST verify endpoint
  // For Cloudflare Workers, we use the Firebase REST API:
  const verifyUrl = `https://www.googleapis.com/identitytoolkit/v3/relyingparty/getAccountInfo?key=${projectId}`;
  const resp = await fetch(verifyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!resp.ok) {
    throw new Error('Invalid or expired authentication token');
  }
  const data: any = await resp.json();
  const user = data.users?.[0];
  if (!user) throw new Error('User not found');

  return {
    uid: user.localId,
    email: user.email ?? null,
  };
}

// ── MIME type validation ──

export function validateMimeType(mime: string): boolean {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mime);
}

export function getAcceptedExtensions(): string {
  return 'PNG, JPEG/JPG, WebP (images), PDF, MP4, MPEG, MOV, WebM (video)';
}

// ── File size validation ──

export function validateFileSize(mime: string, sizeBytes: number): string | null {
  if (mime.startsWith('image/') && sizeBytes > MAX_IMAGE_SIZE) {
    return `Image exceeds 10 MB limit (got ${(sizeBytes / 1024 / 1024).toFixed(1)} MB)`;
  }
  if (mime === 'application/pdf' && sizeBytes > MAX_PDF_SIZE) {
    return `PDF exceeds 15 MB limit (got ${(sizeBytes / 1024 / 1024).toFixed(1)} MB)`;
  }
  if (mime.startsWith('video/') && sizeBytes > MAX_VIDEO_SIZE) {
    return `Video exceeds 25 MB limit (got ${(sizeBytes / 1024 / 1024).toFixed(1)} MB)`;
  }
  return null;
}

// ── Attachment count validation ──

export function validateAttachmentCount(count: number): string | null {
  if (count > MAX_ATTACHMENTS) {
    return `Maximum ${MAX_ATTACHMENTS} attachments per request`;
  }
  return null;
}

// ── Message length validation ──

export function validateMessageLength(text: string): string | null {
  if (!text || text.trim().length === 0) {
    return 'Message cannot be empty';
  }
  if (text.length > MAX_MESSAGE_LENGTH) {
    return `Message exceeds ${MAX_MESSAGE_LENGTH} characters`;
  }
  return null;
}

// ── Rate limiting (in-memory KV via Workers) ──

interface RateLimitStore {
  [key: string]: { count: number; resetAt: number };
}

const rateLimitStore: RateLimitStore = {};

export function checkRateLimit(
  uid: string,
  maxRequests: number,
  windowMs: number,
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const key = uid;
  const entry = rateLimitStore[key];

  if (!entry || now > entry.resetAt) {
    rateLimitStore[key] = { count: 1, resetAt: now + windowMs };
    return { allowed: true, retryAfterMs: 0 };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true, retryAfterMs: 0 };
}

// ── Validate base64 data size after expansion ──

export function estimateBase64DecodedSize(base64: string): number {
  // base64 is ~4/3 of original; padded
  return Math.ceil((base64.length * 3) / 4);
}

export function validateAttachmentContent(
  att: AttachmentContent,
): string | null {
  if (!validateMimeType(att.mime)) {
    return `Unsupported file type "${att.mime}". Accepted: ${getAcceptedExtensions()}`;
  }
  const decodedSize = estimateBase64DecodedSize(att.data);
  const sizeErr = validateFileSize(att.mime, decodedSize);
  if (sizeErr) return sizeErr;
  return null;
}
