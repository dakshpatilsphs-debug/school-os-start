// ===== TextBees SMS Service ================================================
// Replaces the custom /smsgw gateway with the TextBees SMS API.
//
// TextBees API docs:
//   POST https://api.textbees.in/v1/sms/send
//   Headers: Authorization: Bearer <API_KEY>, Content-Type: application/json
//   Body: { to: "phone", message: "text", sender_id?: "SENDER" }
//   Response: { status: "success"|"error", message: "...", data: {...} }
//
// Configuration (stored in schoolSettings / localStorage):
//   smsToken   -> TextBees API Key (Bearer token)
//   smsEndpoint -> TextBees base URL (default: https://api.textbees.in)
//   smsIp      -> sender_id (optional, e.g. "SCHOOL")

const TEXTBEES_DEFAULT_BASE = 'https://api.textbees.in';
const TEXTBEES_SEND_PATH = '/v1/sms/send';

export interface TextBeesSmsConfig {
  apiKey: string;
  baseUrl: string;
  senderId?: string;
}

export interface TextBeesSmsResult {
  success: boolean;
  statusCode?: number;
  message: string;
  raw?: any;
}

// Resolve TextBees config from props + localStorage fallback
export const resolveTextBeesConfig = ({
  smsToken,
  smsEndpoint,
  smsIp,
}: {
  smsToken?: string;
  smsEndpoint?: string;
  smsIp?: string;
}): TextBeesSmsConfig => {
  // Resolve API key: prop > localStorage > schoolSettings > empty
  let apiKey = smsToken?.trim() || '';
  if (!apiKey && typeof window !== 'undefined') {
    try {
      const ls = localStorage.getItem('smsToken');
      if (ls && ls.trim()) apiKey = ls.trim();
      else {
        const ss = localStorage.getItem('schoolSettings');
        if (ss) {
          const parsed = JSON.parse(ss);
          if (parsed.smsToken) apiKey = String(parsed.smsToken).trim();
        }
      }
    } catch {}
  }

  // Resolve base URL: prop > localStorage > default
  let baseUrl = smsEndpoint?.trim() || '';
  if (!baseUrl && typeof window !== 'undefined') {
    try {
      const ls = localStorage.getItem('smsEndpoint');
      if (ls && ls.trim()) baseUrl = ls.trim();
      else {
        const ss = localStorage.getItem('schoolSettings');
        if (ss) {
          const parsed = JSON.parse(ss);
          if (parsed.smsEndpoint) baseUrl = String(parsed.smsEndpoint).trim();
        }
      }
    } catch {}
  }
  if (!baseUrl) baseUrl = TEXTBEES_DEFAULT_BASE;
  // Strip trailing slash
  baseUrl = baseUrl.replace(/\/+$/, '');

  // Resolve sender_id: prop (smsIp) > localStorage > undefined
  let senderId = smsIp?.trim() || '';
  if (!senderId && typeof window !== 'undefined') {
    try {
      const ls = localStorage.getItem('smsIp');
      if (ls && ls.trim()) senderId = ls.trim();
    } catch {}
  }

  return { apiKey, baseUrl, senderId: senderId || undefined };
};

// Send a single SMS via TextBees API
export const sendSms = async (
  config: TextBeesSmsConfig,
  to: string,
  message: string,
): Promise<TextBeesSmsResult> => {
  const url = `${config.baseUrl}${TEXTBEES_SEND_PATH}`;
  const body: any = {
    to: to.trim(),
    message: message.trim(),
  };
  if (config.senderId) body.sender_id = config.senderId;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

    if (res.ok) {
      return { success: true, statusCode: res.status, message: data?.message || 'SMS sent successfully', raw: data };
    }
    return {
      success: false,
      statusCode: res.status,
      message: data?.message || `Failed: ${res.status} ${text}`,
      raw: data,
    };
  } catch (e: any) {
    return {
      success: false,
      message: e?.message || 'Network error',
      raw: null,
    };
  }
};
