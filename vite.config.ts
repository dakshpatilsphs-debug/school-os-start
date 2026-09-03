import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Dynamic SMS proxy for dev — avoids CORS when gateway is on a different host/port.
// Client (SmsSection) in dev always fetches to relative /smsgw and sends the desired
// target host in header `x-sms-target` (derived from schoolSettings smsEndpoint/smsIp).
// This middleware reads that header and forwards the request server-side (no CORS).
const smsProxyPlugin = () => ({
  name: 'sms-dynamic-proxy',
  configureServer(server: any) {
    const handler = async (req: any, res: any, next: any) => {
      const url: string = req.url || '';
      if (!url.startsWith('/smsgw')) return next();

      // Handle CORS preflight
      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-SMS-Target, X-SMS-Ip, *');
        res.setHeader('Access-Control-Max-Age', '86400');
        res.end();
        return;
      }

      // Determine target — can be full URL (http://host:port/path) or host:port
      let target: any = req.headers['x-sms-target'] || req.headers['x-sms-ip'];
      if (Array.isArray(target)) target = target[0];
      if (!target) {
        try {
          const u = new URL(url, 'http://localhost');
          target = u.searchParams.get('target') || u.searchParams.get('ip') || u.searchParams.get('gateway');
        } catch {}
      }
      if (!target) {
        // Fallback: env or default legacy IP
        target = (process.env as any).VITE_SMS_GATEWAY || '10.205.244.156:8082';
      }

      let targetUrl: string;
      const raw = String(target).trim();
      if (raw.startsWith('http://') || raw.startsWith('https://')) {
        // Full URL provided (e.g. http://192.168.31.43:8082/ or http://192.168.31.43:8082/api)
        // Use it directly; preserve any suffix from original request if present beyond /smsgw
        const base = raw.replace(/\/+$/, '');
        const suffix = url.replace(/^\/smsgw/, '') || '';
        if (suffix && suffix !== '/' && suffix !== '') {
          // Avoid double-append if base already ends with suffix
          if (!base.endsWith(suffix)) {
            targetUrl = base + (suffix.startsWith('/') ? suffix : '/' + suffix);
          } else {
            targetUrl = base;
          }
        } else {
          targetUrl = base;
        }
        // Ensure we have at least a trailing slash for root fetches if needed (fetch handles it)
        if (!targetUrl.includes('?') && !targetUrl.endsWith('/') && suffix === '/') {
          // Keep base as is; gateway root may need slash, but http://host is fine
        }
      } else {
        let host = raw.replace(/^https?:\/\//, '').replace(/\/+$/, '');
        if (!host) host = '10.205.244.156:8082';
        // Preserve path after /smsgw (e.g. /smsgw/ -> /, /smsgw?x=1 -> /?x=1)
        const suffix = url.replace(/^\/smsgw/, '') || '/';
        targetUrl = `http://${host}${suffix}`;
      }

      // Collect body (for POST)
      const chunks: Buffer[] = [];
      try {
        for await (const chunk of req) chunks.push(chunk as Buffer);
      } catch {}
      const body = Buffer.concat(chunks);

      // Prepare forward headers (strip hop-by-hop and our custom header)
      const forwardHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers as Record<string, any>)) {
        const lk = k.toLowerCase();
        if (lk === 'host' || lk === 'connection' || lk === 'content-length' || lk === 'x-sms-target' || lk === 'x-sms-ip') continue;
        if (typeof v === 'string' && v) forwardHeaders[k] = v;
        else if (Array.isArray(v) && v.length) forwardHeaders[k] = v.join(', ');
      }

      // Ensure at least content-type
      if (!forwardHeaders['content-type'] && !forwardHeaders['Content-Type']) {
        // will be set by fetch if body present
      }

      try {
        const resp = await fetch(targetUrl, {
          method: req.method,
          headers: forwardHeaders as any,
          body: body.length ? body : undefined,
        });

        res.statusCode = resp.status;
        // Copy response headers (except encoding/length)
        resp.headers.forEach((value, key) => {
          const lk = key.toLowerCase();
          if (lk === 'content-encoding' || lk === 'content-length' || lk === 'transfer-encoding') return;
          try { res.setHeader(key, value); } catch {}
        });
        // Always allow CORS in dev
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Access-Control-Expose-Headers', '*');

        const buf = Buffer.from(await resp.arrayBuffer());
        res.end(buf);
      } catch (e: any) {
        res.statusCode = 502;
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: e?.message || 'Proxy failed', target: targetUrl }));
      }
    };

    // Insert at the very beginning so it runs before Vite's built-in proxy
    // server.middlewares.stack is a Connect stack
    try {
      // @ts-ignore
      server.middlewares.stack.unshift({ route: '', handle: handler });
    } catch {
      server.middlewares.use(handler);
    }
  },
});

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), viteSingleFile(), smsProxyPlugin()],
  server: {
    // No static proxy needed — smsProxyPlugin handles /smsgw dynamically.
    // Keeping empty proxy object avoids Vite warning; plugin does the work.
    proxy: {},
  },
  // Admin mode is env-driven (VITE_ADMIN_MODE). No extra vite config needed,
  // but defining mode makes `vite build --mode admin` load .env.admin.
  define: {},
}));
