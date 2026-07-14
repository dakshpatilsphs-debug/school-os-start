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
 *   RATE_LIMIT_PER_USER_PER_MIN — max requests/IP/min (default: 20)
 */

import { AIRequest, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX } from './types';
import { configureOpenRouter, chatWithAI } from './openRouterClient';
import {
  validateMessageLength,
  validateAttachmentContent,
  validateAttachmentCount,
  checkRateLimit,
} from './security';

interface Env {
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string;
  OPENROUTER_BASE_URL?: string;
  RATE_LIMIT_PER_USER_PER_MIN?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 1. Identify client (IP-based for rate limiting) ──
    const clientIp = request.headers.get('CF-Connecting-IP') || 'anonymous';
    const rateLimitMax = parseInt(env.RATE_LIMIT_PER_USER_PER_MIN || String(RATE_LIMIT_MAX), 10) || RATE_LIMIT_MAX;

    const { allowed, retryAfterMs } = checkRateLimit(clientIp, rateLimitMax, RATE_LIMIT_WINDOW_MS);
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

    // ── 2. Parse and validate request body ──
    let body: AIRequest;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const msgErr = validateMessageLength(body.message);
    if (msgErr) {
      return new Response(JSON.stringify({ error: msgErr }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const attachments = body.attachments || [];
    const countErr = validateAttachmentCount(attachments.length);
    if (countErr) {
      return new Response(JSON.stringify({ error: countErr }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    for (let i = 0; i < attachments.length; i++) {
      const attErr = validateAttachmentContent(attachments[i]);
      if (attErr) {
        return new Response(JSON.stringify({ error: `Attachment ${i + 1} error: ${attErr}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── 3. Configure and call OpenRouter ──
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

      return new Response(JSON.stringify({ error: errMsg }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
