import { AuditEntry } from './types';

const COLLECTION = 'ai-audit-logs';

/**
 * Non-blocking best-effort audit log to Firestore.
 * Uses the user's own idToken as a Bearer token (granted the Firestore
 * security rules allow the authenticated user to create documents in
 * the ai-audit-logs collection).
 */
export async function writeAuditLog(
  firebaseProjectId: string,
  entry: AuditEntry,
  userToken: string,
): Promise<void> {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/${COLLECTION}`;

    const body = {
      fields: {
        timestamp: { stringValue: entry.timestamp },
        requesterUid: { stringValue: entry.requesterUid },
        actionType: { stringValue: entry.actionType },
        resultStatus: { stringValue: entry.resultStatus },
        ...(entry.approvedPatchId != null
          ? { approvedPatchId: { stringValue: entry.approvedPatchId } }
          : {}),
        ...(entry.errorMessage != null
          ? { errorMessage: { stringValue: entry.errorMessage } }
          : {}),
        ...(entry.requestSize != null
          ? { requestSize: { integerValue: String(entry.requestSize) } }
          : {}),
        ...(entry.attachmentCount != null
          ? { attachmentCount: { integerValue: String(entry.attachmentCount) } }
          : {}),
      },
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      console.warn(`Audit write failed: ${resp.status}`);
    }
  } catch {
    // best-effort
  }
}
