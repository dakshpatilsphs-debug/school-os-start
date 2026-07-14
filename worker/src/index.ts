/**
 * School OS AI Assistant — Cloudflare Worker
 *
 * Endpoint: POST /
 * Body: { message, attachments?, conversationHistory?, pageContext? }
 *
 * Environment secrets required:
 *   OPENROUTER_API_KEY    — OpenRouter API key
 *
 * Environment variables (set in wrangler.toml or dashboard):
 *   OPENROUTER_MODEL      — model name (default: google/gemma-4-26b-a4b-it:free)
 *   OPENROUTER_BASE_URL   — API base URL (default: https://openrouter.ai/api/v1)
 *   FIREBASE_PROJECT_ID   — Firebase project ID (default: school-tack)
 *   RATE_LIMIT_PER_USER_PER_MIN — max requests/user/min (default: 20)
 *   SYSTEM_PROMPT          — optional custom system prompt
 */

import { AIRequest, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX } from './types';
import { configureOpenRouter, chatWithAI } from './openRouterClient';
import { verifyFirebaseToken } from './security';
import type { FirebaseTokenPayload } from './security';
import {
  validateMessageLength,
  validateAttachmentContent,
  validateAttachmentCount,
  checkRateLimit,
} from './security';
import { writeAuditLog } from './audit';

interface Env {
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string;
  OPENROUTER_BASE_URL?: string;
  FIREBASE_PROJECT_ID?: string;
  RATE_LIMIT_PER_USER_PER_MIN?: string;
  SYSTEM_PROMPT?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const firebaseProjectId = env.FIREBASE_PROJECT_ID || 'school-tack';
    const rateLimitMax = parseInt(env.RATE_LIMIT_PER_USER_PER_MIN || String(RATE_LIMIT_MAX), 10) || RATE_LIMIT_MAX;

    // ── 1. Authenticate ──
    const authHeader = request.headers.get('Authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    if (!idToken) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let user: FirebaseTokenPayload;
    try {
      user = await verifyFirebaseToken(idToken, firebaseProjectId);
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Invalid or expired authentication token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 2. Rate limit ──
    const { allowed, retryAfterMs } = checkRateLimit(user.uid, rateLimitMax, RATE_LIMIT_WINDOW_MS);
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: `Rate limit exceeded. Try again in ${Math.ceil(retryAfterMs / 1000)}s.` }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil(retryAfterMs / 1000)),
          },
        },
      );
    }

    // ── 3. Parse and validate request body ──
    let body: AIRequest;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate message
    const msgErr = validateMessageLength(body.message);
    if (msgErr) {
      return new Response(JSON.stringify({ error: msgErr }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate attachment count
    const attachments = body.attachments || [];
    const countErr = validateAttachmentCount(attachments.length);
    if (countErr) {
      return new Response(JSON.stringify({ error: countErr }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate each attachment
    for (let i = 0; i < attachments.length; i++) {
      const attErr = validateAttachmentContent(attachments[i]);
      if (attErr) {
        return new Response(JSON.stringify({ error: `Attachment ${i + 1} error: ${attErr}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── 4. Configure and call OpenRouter ──
    if (!env.OPENROUTER_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    configureOpenRouter({
      apiKey: env.OPENROUTER_API_KEY,
      baseUrl: env.OPENROUTER_BASE_URL,
      model: env.OPENROUTER_MODEL,
    });

    try {
      const result = await chatWithAI(body);

      // ── 5. Audit log (non-blocking) ──
      const auditEntry = {
        timestamp: new Date().toISOString(),
        requesterUid: user.uid,
        actionType: 'chat' as const,
        resultStatus: result.error ? 'error' as const : 'success' as const,
        errorMessage: result.error,
        requestSize: JSON.stringify(body).length,
        attachmentCount: attachments.length,
      };
      writeAuditLog(firebaseProjectId, auditEntry, idToken);

      const responseBody = JSON.stringify({
        text: result.text,
        pdfChangePlan: result.pdfChangePlan || null,
      });

      return new Response(responseBody, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (err: any) {
      const errMsg = err?.message || 'Internal error processing request';

      writeAuditLog(firebaseProjectId, {
        timestamp: new Date().toISOString(),
        requesterUid: user.uid,
        actionType: 'chat',
        resultStatus: 'error',
        errorMessage: errMsg,
        requestSize: JSON.stringify(body).length,
        attachmentCount: attachments.length,
      }, idToken);

      return new Response(JSON.stringify({ error: errMsg }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
