# UI/UX Changes — School Management Tracking System

**Date:** 2026-08-28 (updated through SMS + Theme pass)
**Scope:** Behavioral / accessibility / feedback fixes **plus** a new SMS communication module, Hindi/Marathi (Unicode) support, an in-page AI message writer, and a global theme/color/alignment modernization pass.

---

## 1. Modals (`src/Modals.tsx`) — Global modal shell + 4 forms

| Issue | Fix | Impact |
|-------|-----|--------|
| Escape key did nothing | `useEffect` keydown listener on `p.onClose` | Keyboard dismiss works everywhere |
| Backdrop click did nothing | Overlay `onClick={p.onClose}`, inner `stopPropagation` | Click outside to close |
| Double-click Save created duplicate records | Local `saving` state; `guardSave(fn)` wraps handlers; buttons show "Saving…" & disable while in flight | No accidental duplicates |
| Class / Package removal → no confirm | `confirm()` with descriptive message before calling prop handlers | Prevents accidental deletes |
| Deprecated `onKeyPress` on Add inputs | Replaced with `onKeyDown` | React 18+ compatibility |
| Number inputs (amount, salary, oldSalary, package amount) missing `min` | Added `min={0}` | Native spinner/type protection |
| Phone/Email inputs were plain text | `type="tel" inputMode="tel"` / `type="email"` | Mobile keyboard hints, validation |
| Icon-only buttons (×, trash, save, edit, eye, settings) lacked accessible names | `aria-label` + `title` on every icon button | Screen reader announcements |
| Fee form forced full-screen on desktop | Unchanged (structure preserved) — only backdrop/Escape/label fixes applied | — |

---

## 2. App.tsx — Main monolith (tabs, tables, forms, CorrectionSection)

### 2.1 Student Add/Edit Form
| Issue | Fix |
|-------|-----|
| Required fields (Name, Class, Parent, Phone, Fee) never validated — empty student saved | Early-return validation with targeted error toasts |
| `handleSaveStudent` called `showNotification('Student saved')` even on PocketBase error | `try/catch` with `showPocketBaseError` — real error surfaced |

### 2.2 Fee Form
| Issue | Fix |
|-------|-----|
| Selecting a student popped a success toast ("Selected: …") | Removed toast — selection is not an action |

### 2.3 Expense Form
| Issue | Fix |
|-------|-----|
| No client validation — 0 amount, blank date, blank paid-to allowed | Required checks for Category, Amount > 0, Date, Paid-To with error toasts |
| Selecting employee in expense form showed success toast | Removed toast |

### 2.4 Table Empty States (was: blank `<tbody>` indistinguishable from PB down)
| Table | Empty row text |
|-------|----------------|
| Student List | "No students found. If you expect data, make sure PocketBase is running, then click Refresh." / "No students match your search or filter." |
| Fees | Same pattern (distinguishes 0 fees in DB vs filter mismatch) |
| Expenses | Same pattern |
| Equipments | Same pattern |

### 2.5 Equipment "Check Assigned To" dropdown
| Issue | Fix |
|-------|-----|
| Listed deactivated students (`D-` prefix) | Filter `students.filter(s => !isDeactivatedStudent(s))` |

### 2.6 Icon buttons in tables
| Button | Added |
|--------|-------|
| Pay Fee, ID Card, Edit, Delete (students) | `title` |
| Edit, Delete (fees, expenses, equipments) | `title` |

### 2.7 CorrectionSection — Move/Edit bug (functional UX)
| Bug | Root cause | Fix |
|-----|------------|-----|
| Arrow buttons swapped wrong rows when filter active | Used visible index `i` on full `items` array | Compute `ri = items.indexOf(item)` per row; use `ri` for move, updateField, drag, numbering |
| Duplicate autoId check used wrong index | `xi !== i` | `xi !== ri` |
| `items.indexOf(item)` called 4× per row (O(n²)) | — | Single `ri` lookup |

---

## 3. Schedule.tsx (`src/Schedule.tsx`)

| Area | Issue | Fix |
|------|-------|-----|
| Timetable cells | Mouse-only; no keyboard, no ARIA | `tabIndex={0}`, `role="button"`, `onKeyDown` (Enter/Space), `focus-visible:ring`, `aria-label` |
| Auto Generate | Wiped existing timetable silently | `confirm()` with entry count before `deleteTimetableForClass` |
| AI Fix All | Applied AI changes without preview/confirm | After parsing fixes, `confirm(\`Apply ${fixes.length} changes?\`)`; catch shows real error message |
| Change periods/day | Reset custom period times silently | Detect customization; `confirm('…will reset your customized period times.')` |
| Cell Clear | `catch {}` swallowed errors → looked like success | `catch { showNotification('Failed to clear cell','error') }` |
| DB load failures | Silent `catch {}` → fake empty states | `loadError` state + banner with "Could not reach database — Is PocketBase running?" + Retry button |
| Sub-tab bar | Overflowed on narrow screens | `flex-wrap` |
| Rules modal | No Escape close | `useEffect` keydown listener |
| Trash / Save / Clear icons | No labels | `title` / `aria-label` |
| `window.print()` | Bare call, no feedback | Unchanged (structure) — only accessible button label added |

---

## 4. Attendance.tsx (`src/Attendance.tsx`)

| Area | Issue | Fix |
|------|-------|-----|
| Monthly grid import progress | `total: 1`, `current` per cell → >100% bar | Accumulate `totalCells`; `setAttImport({ total: Math.max(totalCells, 1) })` |
| Import errors | Only in console; toast said "X failed" with no details | Toast includes first 3 errors + `+N more` count |
| "Old" salary toggle | `setSalaryType('old'); setSelectedMonthlyEmployeeId('')` — kicked user back to selector | Only `setSalaryType('old'); setEditMonthSalary(false)` — keeps employee visible |
| CL quota Save | Invalid input (NaN, negative) silently did nothing | Validation with error toast: "CL quota must be a number between 0 and 365" |
| Holiday delete / Direct-pay close | Icon-only, no label | `title` + `aria-label` |

---

## 5. ImportSection.tsx (`src/ImportSection.tsx`)

| Area | Issue | Fix |
|------|-------|-----|
| Dropzone | Looked draggable but was `<label>` only — drop navigated browser | `onDragOver`/`onDragLeave`/`onDrop` handlers; visual `dragging` state |
| Import confirmation | None — attendance/holidays/timetable upsert overwrite silently | `confirm(\`Import N rows? Rows with same key will OVERWRITE.\`)` for upsert types |
| Reference data load | `getStudents/Employees/Subjects` caught → `[]`; lookups produced blank IDs | After `loadRef()`, warn if all empty and type isn't students/employees |
| Import errors | Only in console | Toast shows first 3 errors + count |
| Clear file during import | Reset state while loop still running → confusing UI | `disabled={importing}` + early return |
| Download sample | Enabled but no-op before type chosen | `disabled={!type}` + `title` hint |
| Truncated preview cells | No way to see full value | `title={fullValue}` on both mapping sample & import preview |

---

## 6. AIAssistant.tsx (`src/components/AIAssistant.tsx`)

| Issue | Fix |
|-------|-----|
| No streaming, no stop — slow request locked composer | `AbortController`; send button becomes **Stop** (FiSquare) while `loading`; `signal` passed to fetch; abort surfaces "Generation stopped." |
| Enter key sent duplicate request while loading | `handleKeyDown` guards `if (!loading) sendMessage()` |
| PDF/Video attachments accepted but **silently dropped** (only images sent) | On attach: `setError('Note: only images are analyzed — PDF/video kept locally but not sent.')` |
| `dangerouslySetInnerHTML` with raw model markdown → XSS vector | Escape `& < >` before markdown regex replacements |
| Floating panel | Fixed `w-96` (384px) — overflowed on phones | `w-[min(24rem,calc(100vw-3rem))]` responsive width |
| Icon buttons (close, attach, remove, send, FAB) | No accessible names | `aria-label` on all; `title` on paperclip |

---

## 7. SMS Module (`src/SmsSection.tsx` — NEW) + `src/App.tsx` wiring

A new **SMS** tab was added to the app shell (nav entry with `FiSend`, `Tab` union extended with `'sms'`, page-title case added, rendered via `<SmsSection students={students} fees={fees} showNotification={showNotification} />`).

### 7.1 Gateway contract (Traccar-style HTTP SMS)
- **Endpoint:** `http://192.168.31.22:8082` (exposed in dev through the Vite proxy `/smsgw` → target, `changeOrigin: true`, `rewrite` strips the `/smsgw` prefix). Relative path keeps CORS away in `npm run dev` and also works if the built file is later served *from* the gateway (same-origin).
- **Auth:** `Authorization` header carrying the gateway token (`681f0d5d-024e-452d-bbbc-6595b974c478`). Initially sent as `Bearer <token>` → returned **401**, switched to the **raw token** (`Authorization: <token>`, no `Bearer` prefix) which matches Traccar's `sms.http.authorization` behavior.
- **Body:** `POST` JSON `{ "to": "<phone>", "message": "<text>" }` (Traccar template shape — `to`/`message`, not `phone`/`message`).
- **Encoding:** sent as UTF-8 JSON, so Devanagari (Hindi/Marathi) transmits correctly. Delivery of Unicode depends on the SMS provider supporting Unicode.

### 7.2 Single-number mode
| Detail | Behavior |
|--------|----------|
| Inputs | `type="tel" inputMode="tel"` phone field + message `<textarea>` with live character count |
| Validation | Blocks send if phone or message empty → error toast |
| Send | `POST` to gateway; on success shows green "SMS sent successfully.", on failure shows red `Failed: <status> <response body>` so the real cause is visible |
| States | Send button shows "Sending…" and disables while in flight |

### 7.3 Class-wise bulk mode (automated, with criteria)
| Detail | Behavior |
|--------|----------|
| Class picker | Select from distinct student classes (deactivated `D-` students excluded) |
| Recipient filter | **"Students with fees not paid"** (any fee where `status !== 'paid'` OR `balanceAmount > 0`) or **"All students in class"** |
| Phone source | Each recipient's **Parent Phone** (`parentPhone`) as entered in *Student Add* |
| Template | Editable message with placeholders `{name}`, `{parentName}`, `{class}` replaced per student |
| Recipient preview | Live list (name / parent / phone) of who will receive, with count |
| Send loop | One `POST` per recipient with a **10-second gap** between messages (`await setTimeout(10_000)`); progress bar + "Sent X of N"; disabled while sending |
| Confirm | `confirm()` with recipient count + gap warning before firing |
| Result | Per-run summary `Sent: n · Failed: m` plus a scrollable list of the first 10 failures with their error text |

### 7.4 AI message writer (multi-language)
- A **"Write with AI"** button sits under both the single message box and the bulk template box.
- Opens an inline panel: a free-text "what should the SMS say?" field + a **Language** select (**English / Hindi (हिंदी) / Marathi (मराठी)**).
- Calls OpenRouter (reuses `VITE_OPENROUTER_KEY`, default model `google/gemma-4-26b-a4b-it:free`) with a system prompt that returns a **≤160-char** polite message in the chosen language, preserving the `{name}`/`{parentName}`/`{class}` placeholders.
- "Use this text" inserts the generated copy into the active field (single message or bulk template).
- If the key is missing it shows `AI key not set (VITE_OPENROUTER_KEY)`; API/HTTP errors are surfaced inline.
- UI note reminds the user that Unicode (Devanagari) delivery depends on the gateway/provider.

### 7.5 Accessibility
- Mode toggle uses `aria-pressed`; all inputs have `aria-label`; the AI panel toggle uses `aria-expanded`; focus rings provided by the global polish (Section 9).

---

## 8. Theme / Color / Alignment Modernization (`src/index.css` — NEW global polish)

Low-risk, theme-agnostic additions layered on top of the existing `data-theme` token maps (`wrb`, `neu`, `blackblue`). Preserves existing `className` strings, gradients and component structure; only raises consistency.

| Area | Change | Impact |
|------|--------|--------|
| Smooth motion | Unified `transition` on `button, a, input, select, textarea, .btnCorrection, [role="button"]` | Consistent, calmer interactions everywhere |
| Keyboard focus | `focus-visible` ring (2px, `outline-offset`, rounded) for **all** themes — was missing on the default `wrb` theme; `neu`/`blackblue` use their `--accent` | Visible keyboard navigation in every theme |
| Rendering | `body` antialiasing + `text-rendering: optimizeLegibility`; `html { scroll-behavior: smooth }` | Crisper text, smoother scrolling |
| Cards (wrb) | `.bg-[#1E1E1E]` → `border-radius: 1rem`; `.rounded-xl/.rounded-2xl` get a soft layered shadow | Softer, more uniform elevation |
| Cards (neu/blackblue) | `.bg-[#1E1E1E]` → `border-radius: 1rem` | Consistent corner rhythm |
| Tables | `border-collapse: separate`, left-aligned `th` with `font-weight: 600`, `vertical-align: middle` | Aligned, readable grids |
| Form controls | `input/select/textarea` → `border-radius: 0.5rem` | Inputs/buttons line up |
| Placeholders | `::placeholder { opacity: 0.7 }` | Better default contrast |

---

## 9. Build / Dev config (`vite.config.ts`)
- Added `server.proxy['/smsgw']` → `http://192.168.31.22:8082` (`changeOrigin`, `rewrite` strips `/smsgw`) so the browser SPA can reach the SMS gateway without CORS in `npm run dev`.
- The single-file production build has no proxy; for production either serve `dist/index.html` from the gateway (same-origin) or enable CORS on the gateway.

---

## 10. Global / Cross-cutting

| Area | Change |
|------|--------|
| TypeScript | `npx tsc --noEmit` — **passes clean** (no new type errors introduced) |
| Theme / Layout | **Modernized** via `src/index.css` global polish (Section 8). Component `className`/gradient strings preserved; consistency/contrast/alignment improved |
| SMS auth | Traccar-style `Authorization: <token>` (raw), body `{to,message}`, UTF-8 Unicode for Hindi/Marathi |
| PocketBase error swallowing | Not fixed (architectural in `src/pocketbase.ts:getFullList`) — UI-level banners added where feasible (Schedule, Import, empty tables) |

---

## Files Modified

```
src/Modals.tsx
src/App.tsx
src/Schedule.tsx
src/Attendance.tsx
src/ImportSection.tsx
src/components/AIAssistant.tsx
src/SmsSection.tsx          (NEW — SMS tab: single + class-wise bulk, AI writer)
src/index.css               (NEW global theme/color/alignment polish)
vite.config.ts              (NEW /smsgw dev proxy to SMS gateway)
```

---

## How to Verify

```bash
# Typecheck (no emit)
npx tsc --noEmit

# Dev server (needs PocketBase running at 127.0.0.1:8090)
npm run dev
# SMS uses the /smsgw proxy → http://192.168.31.22:8082 (restart dev after config change)

# Build (emits single-file dist/index.html ~2.4 MB)
npm run build
```

All changes are backward-compatible; no data migrations required. The SMS token and gateway URL are hardcoded in `src/SmsSection.tsx` (`SMS_TOKEN`, `SMS_ENDPOINT`) and `vite.config.ts`; adjust there if the gateway changes.
