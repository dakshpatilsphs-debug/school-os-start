# SMS Module — Setup & Reference

This documents the **SMS** tab added to the School Management Tracking System: how it connects to the SMS gateway, the authentication token, the request format, the single vs class-wise bulk behavior, the AI message writer, and troubleshooting.

---

## 1. Gateway endpoint

| Setting | Value |
|---------|-------|
| Gateway host:port | `http://10.205.244.156:8082` |
| Protocol | Traccar-style HTTP SMS (`sms.http.url` / `sms.http.authorization` pattern) |
| Dev proxy (Vite) | `/smsgw` → `http://10.205.244.156:8082` (see `vite.config.ts`) |
| App fetch URL | `/smsgw` (relative — avoids CORS in `npm run dev`; also works if `dist/index.html` is served *from* the gateway) |

The gateway must be reachable from the machine running the app. If hosted elsewhere, either run the app behind the Vite dev proxy or enable CORS on the gateway.

---

## 2. Token / authentication

| Setting | Value |
|---------|-------|
| Token ID | `681f0d5d-024e-452d-bbbc-6595b974c478` |
| Header | `Authorization: 681f0d5d-024e-452d-bbbc-6595b974c478` |
| Format | **Raw token (no `Bearer` prefix)** |

> **Why raw, not `Bearer`:** the first attempt used `Authorization: Bearer <token>` and the gateway returned **401 Unauthorized**. Traccar sends its `sms.http.authorization` value as the raw `Authorization` header, so the prefix was removed and the raw token is sent.

Where it lives: `SMS_TOKEN` constant in `src/SmsSection.tsx`.

---

## 3. Request format

```
POST /smsgw        (dev)  →  http://10.205.244.156:8082   (gateway)
Headers:
  Content-Type: application/json
  Authorization: 681f0d5d-024e-452d-bbbc-6595b974c478
Body (JSON):
  {
    "to": "<phone number>",
    "message": "<text>"
  }
```

Note the field names are **`to`** and **`message`** (Traccar template), *not* `phone`/`message`.

---

## 4. Encoding — Hindi & Marathi

- Requests are sent as **UTF-8 JSON**, so Devanagari text (Hindi `हिंदी`, Marathi `मराठी`) transmits correctly from the app.
- Actual Unicode *delivery* to handsets depends on the SMS **provider/gateway** supporting Unicode (UCS-2) messages. If recipients see garbled text, the provider side needs Unicode enabled.

---

## 5. Single-number mode

- Fields: phone (`type="tel"`) + message textarea (live character count).
- Validation: blocks send if phone or message is empty (error toast).
- On send: `POST` above. Success → green "SMS sent successfully."; Failure → red `Failed: <HTTP status> <response body>` so the real cause is visible.
- Send button shows "Sending…" and disables while in flight.

---

## 6. Class-wise bulk mode (automated)

1. **Pick a class** (deactivated `D-` students are excluded).
2. **Recipient filter:**
   - *Students with fees not paid* — any fee where `status !== 'paid'` OR `balanceAmount > 0`.
   - *All students in class*.
3. **Phone source:** each recipient's **Parent Phone** (`parentPhone`) entered in *Student Add*.
4. **Template:** editable message with placeholders `{name}`, `{parentName}`, `{class}` replaced per student.
5. **Preview:** live list of recipients (name / parent / phone) + count.
6. **Send:** one `POST` per recipient with a **10-second gap** between messages; progress bar "Sent X of N"; disabled while sending; `confirm()` with count + gap warning before firing.
7. **Result:** `Sent: n · Failed: m` summary + first 10 failures with error text.

---

## 7. AI message writer (multi-language)

- A **"Write with AI"** button appears under both the single message box and the bulk template box.
- Panel: free-text "what should the SMS say?" + **Language** select → **English / Hindi (हिंदी) / Marathi (मराठी)**.
- Calls OpenRouter (reuses `VITE_OPENROUTER_KEY`; default model `z-ai/glm-5.2:free` — confirmed on the live free tier; override via `VITE_OPENROUTER_MODEL`) with a system prompt returning a **≤160-char** polite message in the chosen language, preserving `{name}`/`{parentName}`/`{class}`.
- "Use this text" inserts the result into the active field.
- Errors surface inline (missing key, HTTP/API errors).

> Requires `VITE_OPENROUTER_KEY` in `.env` (same key the AI Assistant uses).

---

## 8. How to change the gateway / token

| What | Where |
|------|-------|
| Token | `SMS_TOKEN` in `src/SmsSection.tsx` |
| App fetch path | `SMS_ENDPOINT` in `src/SmsSection.tsx` (default `/smsgw`) |
| Gateway host:port | `server.proxy['/smsgw'].target` in `vite.config.ts` |
| Auth header scheme | `Authorization` value in `sendOneSms()` (`src/SmsSection.tsx`) — currently raw token; switch to `` `Bearer ${SMS_TOKEN}` `` only if the gateway requires it |

After editing `vite.config.ts` you **must restart** `npm run dev`.

---

## 9. Troubleshooting

| Symptom | Cause / Fix |
|---------|-------------|
| `Failed to load resource: 401 (Unauthorized)` | Token rejected. Ensure raw (no `Bearer`) token. Confirm token value in `SMS_TOKEN`. |
| Network error / no response | Gateway not reachable at `192.168.31.22:8082`; check the device is online and on the same network. In production the `/smsgw` dev proxy does not exist — serve the built file from the gateway or enable CORS. |
| Garbled Hindi/Marathi on phones | Gateway/provider not sending Unicode; enable Unicode (UCS-2) on the provider side. |
| `AI key not set` | Add `VITE_OPENROUTER_KEY` to `.env`. |
| Bulk send stops / partial | Each message is sent sequentially with a 10s gap; failures are listed in the result panel — check the per-recipient error text. |

---

## 10. Files involved

```
src/SmsSection.tsx     # SMS tab: single + bulk, auth, body, AI writer
src/App.tsx            # 'sms' tab in union, nav entry, render block, page title
vite.config.ts         # /smsgw dev proxy → gateway
src/index.css          # focus rings / polish used by the SMS UI
```
