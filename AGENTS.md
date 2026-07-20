# School Management Tracking System

## Commands
```sh
npm run dev       # Vite dev server
npm run build     # Production build (single-file SPA via vite-plugin-singlefile)
npm run preview   # Preview production build
```

## Architecture

- **Single-page React (19) app** bundled into `dist/index.html` — no code-splitting or routing lib (simple tab-based navigation via `activeTab` state in `App.tsx:38`)
- **Build output**: one `index.html` containing inlined JS + CSS (vite-plugin-singlefile). No chunked assets deployed.
- **State**: all data loaded eagerly into React state arrays from Firestore on mount (`loadData` in `App.tsx`). No context/Redux — props drilled to child components.
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite` plugin). Config-free (v4 uses CSS-first config).
- **No test framework** configured.

## Firebase

- **Config**: hardcoded in `src/firebase.ts:7-16` (school-tack project)
- **Firestore** for all CRUD data (students, fees, expenses, employees, equipment, attendance, holidays, reminders, subjects, schedules, subjectConfigs)
- **Storage** for bill images, accessed via `uploadImage` / `getDownloadURL`
- **Auth** unused (`getAuth` imported but never called)
- **`cleanData()`** (`firebase.ts:26-34`) strips `undefined`/`null` before writes to avoid "Unsupported field value" errors — always call before `addDoc`/`updateDoc`
- **`generateAutoId(prefix?)`** (`firebase.ts:38-44`) creates IDs like `MtsA0001` prefix + timestamp + seq + random; used for all entities

## Key Files & Ownership

| File | Scope |
|------|-------|
| `src/App.tsx` | Main app shell, all CRUD handlers, all PDF exports, tab routing, settings modal trigger |
| `src/Attendance.tsx` | Student & employee attendance UI, casual leaves, salary slip drawing |
| `src/Schedule.tsx` | Subjects, teacher-subject assignments, timetable grid & auto-generate, subject configs, timetable PDF |
| `src/Modals.tsx` | All add/edit forms (renderStudent, renderFee, renderEmployee, renderSettings, offer letter editor, etc.) |
| `src/firebase.ts` | All Firestore/Storage operations, one function per collection |
| `src/types.tsx` | All TypeScript interfaces (Employee, Student, SubjectConfig, TimetableEntry, etc.) |
| `src/PDFHelper.ts` | Shared PDF design system: `getPDFColorsFromSettings`, `drawHeader`, `drawFooter`, `drawCoverPage` |

## PDF Export Conventions

- All PDF exports use `jsPDF` + `jspdf-autotable`. Pass `schoolSettings` for theming.
- Use `getPDFColorsFromSettings(schoolSettings)` to get `PDFColors` object with `primary`, `secondary`, `dark`, `muted`, `light`, `lighter`, `white`, `border` tuples.
- Reuse `drawHeader`/`drawFooter` from `PDFHelper.ts` for consistent school branding (logo, name, header band, page numbers).
- `showNotification(msg, type)` only accepts `'success' | 'error'` — never `'info'`.

## Employee `inactiveDate` Behavior

- Employees with `status: 'INACTIVE'` have an `inactiveDate` field.
- The Employee Report (`exportEmployeeReportPDF` in `App.tsx:1530`) includes inactive employees for months on or before their `inactiveDate`, but excludes them for months after.
- Salary auto-refresh only counts 30 days after `inactiveDate` for salary purposes.
- `Modals.tsx:488` shows inactive date picker when status is set to INACTIVE.

## Schedule Auto-Generate Rules (`Schedule.tsx`)

1. **Doubled subjects**: exactly 1 pair (2 consecutive periods) per day, cycled across days. No `allowSameDay` influence on doubled placement.
2. **All other subjects** (regular, no-teacher, unassigned): merged into a single fill pool, max 2 appearances per day per subject.
3. **No `periodsPerWeek`** — removed from `SubjectConfig` type and UI. Per-subject frequency is implicit (max 2/day, fill remaining).
4. **No Teacher** is a separate checkbox section below the table (not a table column).
5. `updateSubjectConfig` signature: `(subjectId, subjectName, field, value)` where `field` is `'doubled' | 'allowSameDay' | 'noTeacher'` and `value` is `boolean`.

## Timetable PDF

- Uses `autoTable` for reliable rendering.
- Header band with school logo, name, date (same as full report).
- Grid columns: Period (with time), Mon–Fri. Shows subject name + teacher name per cell.
- Footer with school name + page number.

## Salary Slip

- Salary slip drawing lives in `Attendance.tsx` (`drawSalarySlip` at line ~619), not `App.tsx`.
- Uses `schoolSettings` for branding colors, bank box color via `salarySlipBankBoxColor` setting.
- Employee `monthSalary` (Record<string, number>) stores custom salary per month; falls back to `salary` field.

## Settings Persistence

- `schoolSettings` is stored in `localStorage` under key `'schoolSettings'`, synced via `useEffect` in `App.tsx:608`.
- All PDF visual settings (colors, logo size, fonts, subtitles) are part of `schoolSettings`.

## Misc Gotchas

- `tsconfig.json` has `strict: true` but `noUnusedLocals: false, noUnusedParameters: false` — relaxed.
- `.env` file: optional, for OpenRouter key + model. Not required for building.
- Holiday type `'sunday'` is auto-generated (every Sunday); `'manual'` is user-created.
- `clsx` and `tailwind-merge` both available for conditional class merging.
- All entities use `autoId` (string) as the display id, not the Firestore `id`.
