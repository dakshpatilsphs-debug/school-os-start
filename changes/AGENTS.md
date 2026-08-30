# AGENTS.md

School OS — a single-page React school-management app (students, fees, expenses, employees, equipment, attendance, schedules, PDF reports, AI assistant). All data logic is browser-side; there is no backend besides Firebase.

## Commands

- `npm run dev` — Vite dev server
- `npm run build` — production build via `vite-plugin-singlefile` (inlines everything into one `dist/index.html`)
- `npm run preview` — preview the built file
- There is **no** test, lint, or typecheck script. TypeScript config is `strict: true`, but `noUnusedLocals`/`noUnusedParameters` are off.

## Architecture

- `src/App.tsx` (~5,700 lines) is a single monolithic component: all screens, forms, state, charts (recharts), PDF generation, and the sidebar are here. Tabs are a string-union `Tab` type (see `App.tsx:36`) — add a new screen by adding a Tab value, a sidebar entry, and a render branch.
- `src/firebase.ts` is the entire data layer: Firestore (students, fees, expenses, employees, equipments, subjects, subjectConfigs, teacherSubjects, timetable, causalLeaves, salarySlipAudits) plus Realtime Database (attendance, holidays).
- `src/Modals.tsx` ↔ `AppModals` (add/edit dialogs), `src/Attendance.tsx` ↔ `AttendanceSection`, `src/Schedule.tsx` ↔ `ScheduleSection` (timetable), `src/components/AIAssistant.tsx` (OpenRouter chat), `src/clUtils.ts` (casual-leave math), `src/PDFHelper.ts` (shared PDF header/footer/cover helpers).
- Repo-local feature-request docs you may be asked to implement: `STUDENT-ADD-UPDATE.md`, `Student_Register_2026-08-05 (1).md`. `repomix-output.xml` is a stale code dump; `README.md` is a UTF-16 placeholder containing only `# school-os-start`. `dist/` and `node_modules/` are gitignored build output.

## Firebase / data gotchas

- The Firestore project (`school-tack`) is hard-coded in `src/firebase.ts` — no env vars involved. `.env` only carries the optional `VITE_OPENROUTER_KEY` / `VITE_OPENROUTER_MODEL` for the AI assistant; builds work without it.
- Attendance + holidays save to RTDB first, then **auto-fallback to Firestore** on failure (`saveAttendance`, `saveBatchAttendance`). Reads merge both sources and de-dupe by `personId_date`. RTDB keys are sanitized (`makeAttKey`, replaces `. # $ [ ] /`), so record key = `{personId}_{date}`.
- There is no Firestore emulator / offline setup and no write-through SDK: you're hitting the real project from the browser. Anything needing custom Firestore composite indexes will fail at deploy — `getFeesByDateRange` deliberately runs two separate queries and merges, because Firestore can't OR across fields.
- Firestore cannot store `undefined`. Writes must go through `cleanData()` (strips undefined/null) — remember this when adding new save paths. `updateStudentAutoIdReferences` must be used when an autoId changes (updates fees, equipment, and attendance).

## Conventions to follow

- **Sequential global autoIds**, set on save, never in form state: `getNextSequentialId(collection)` → format `STU-001`, `FEE-001`, `EXP-001`, `EMP-001` with `padStart(3,'0')`. `generateAutoId()` is only a temporary placeholder for form defaults until save (see `handleSaveStudent`/`handleSaveFee` in `App.tsx`).
- **Deactivated students** are identified by `autoId` starting with `D-` (e.g. `D-STU-001`); `isDeactivatedStudent()` (`App.tsx:699`) excludes them from all registers, lists, and PDFs. Keep prefixing the id `D-` on deactivation and re-adding plain `STU-` on reactivation.
- UI theme is set in `main.tsx` from `localStorage('uiTheme')`. Under `data-theme="wrb"` a whole set of Tailwind classes (`bg-[#1E1E1E]`, `text-white`, `from-cyan-500`, etc.) is **re-mapped to a light theme in `src/index.css`**. When restyling, keep the dark palette consistent with these overrides or the light theme breaks.
- PDFs are generated client-side with jspdf + jspdf-autotable; reuse the `PDFHelper.ts` helpers instead of hand-rolling headers/footers.
- Mixing conventions: `App.tsx`/`firebase.ts` use pre-React-19 no-callback style with deeply nested JSX; match existing style rather than introducing new abstractions. Some form shapes use `as any` on `useState` — acceptable in this codebase.