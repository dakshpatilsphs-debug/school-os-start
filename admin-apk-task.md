# Task: Build an "Admin Reports" Android APK from the School Tracking Web App

## Context

This repository (`school-tracking-os`) is a Vite + React 19 + TypeScript single-page
web app for school management, backed by Firebase (Firestore, Storage, Realtime DB,
Auth). All screens currently live inside one component tree, switched via a `Tab`
type in `src/App.tsx`:

```ts
type Tab = 'dashboard' | 'studentadd' | 'studentlist' | 'deactivatestudent' | 'fees'
  | 'feesbystudent' | 'expenses' | 'employees' | 'equipments' | 'attendance'
  | 'reports' | 'schedule' | 'correction' | 'studentedit' | 'ai';
```

Key files:
- `src/App.tsx` — main app shell, tab state, sidebar/nav, data fetching from Firebase
- `src/firebase.ts` — Firebase config + CRUD helpers (no role-based access control yet)
- `src/Modals.tsx`, `src/Attendance.tsx`, `src/Schedule.tsx` — feature sections
- `vite.config.ts` — already uses `vite-plugin-singlefile` (bundles to one HTML file)
- `package.json` — scripts: `dev`, `build`, `preview`

There is **no separate admin app** and **no role-based restriction** today — every
user who loads the app sees every tab.

## Goal

Produce a second, restricted build of this same web app — an **"Admin Reports"
mode** — that only exposes the Reports screen and read-only list views (e.g.
`studentlist`, and any other list-style tabs you judge relevant — ask if unsure
which ones), with everything else (add/edit/delete forms, attendance entry, fee
collection, AI assistant, etc.) hidden or blocked. Package that restricted build
as a native Android APK, buildable entirely from the command line — **no Android
Studio GUI**, using tools already available in this environment.

## Environment constraints

- JDK installed: **JDK 26**. This is too new for the current Android Gradle
  Plugin, which supports up to JDK 21. **Install and use JDK 17 (Temurin/Adoptium)
  specifically for the Android/Gradle build step** — set `JAVA_HOME` to it only
  in the shell session running `./gradlew`, don't change the system default.
- Android SDK: not installed yet. Install **command-line tools only** (no Android
  Studio), via `sdkmanager`. Required packages: `platform-tools`,
  `platforms;android-34`, `build-tools;34.0.0` (adjust API level if a newer stable
  one is preferred).
- Build tool for the Android wrapper: **Capacitor** (`@capacitor/core`,
  `@capacitor/android`) — wraps the built web assets in a native WebView shell,
  fully scriptable from the CLI (`npx cap ...`).

## Step-by-step requirements

### 1. Add an admin-restricted mode to the React app

- Introduce an env-driven flag, e.g. `VITE_ADMIN_MODE` (read via
  `import.meta.env.VITE_ADMIN_MODE === 'true'`), OR a build-time constant — pick
  whichever fits the existing code style in `App.tsx`.
- When the flag is on:
  - Filter the sidebar/nav so only the Reports tab and designated list tab(s) are
    rendered/clickable.
  - Guard the tab-switch handler itself (not just the UI) so a stray state change
    or deep link can't reveal a hidden tab.
  - Hide/disable any add, edit, delete, or "collect fee" actions reachable from
    the visible list/report screens — this build should be read-only.
  - Do not remove the underlying code paths for other tabs — just gate them,
    since the normal (non-admin) build must keep working unchanged.
- Add a `.env.admin` (or equivalent) with `VITE_ADMIN_MODE=true`, and a new
  `package.json` script, e.g. `"build:admin": "vite build --mode admin"`, wired
  to a `vite.config.ts` mode-aware setup (or a simple env file) so the two builds
  don't require manually editing code each time.

### 2. Firestore security rules (do this before shipping — flag if rules aren't in the repo)

- The Firebase config in `src/firebase.ts` is client-side and will be embedded
  in the APK as plain text/JS — anyone can unpack the APK and read it. UI-level
  tab hiding is **not** access control.
- Check whether Firestore/Storage security rules already restrict reads/writes.
  If not present in this repo, flag this explicitly rather than silently
  proceeding — the admin APK should not be distributed until reads are scoped
  appropriately (e.g. read-only rules for whichever collections back the
  Reports/list views, and rules should not simply trust a client-side flag).

### 3. Install and configure Capacitor

- `npm install @capacitor/core @capacitor/android`
- `npx cap init` — app name and package id should follow whatever the user
  specifies (ask if not given); a sensible default package id pattern is
  `com.<school>.admin`.
- Ensure `capacitor.config.ts` points `webDir` at the Vite `dist/` output.

### 4. Build web assets and generate the Android project

- `npm run build:admin` (from step 1) to produce the restricted `dist/`.
- `npx cap add android` to scaffold the `android/` Gradle project.
- `npx cap sync android` to copy the built web assets in.

### 5. App identity and permissions

- Set the app name/label in
  `android/app/src/main/res/values/strings.xml`.
- Replace mipmap icons (or generate via `npx @capacitor/assets generate` from a
  single source PNG if one is supplied).
- Confirm `android/app/src/main/AndroidManifest.xml` includes the INTERNET
  permission (required — the app talks to Firebase over the network; there is
  no offline mode to build here).

### 6. Build the APK from the command line

- `cd android`
- With `JAVA_HOME` set to the JDK 17 install for this shell only:
  `./gradlew assembleDebug` for a debug/test APK
  (output: `android/app/build/outputs/apk/debug/app-debug.apk`)
- For a distributable build: generate a keystore with `keytool`, wire it into
  `android/app/build.gradle`'s signing config, then `./gradlew assembleRelease`.

### 7. Verification

- Install the debug APK on a test device/emulator and confirm:
  - Only Reports + designated list tab(s) are visible and reachable.
  - No create/edit/delete actions are exposed anywhere in the admin build.
  - Firebase reads succeed and match what the full app shows for the same data.
  - The normal (non-admin) `npm run build` / existing web app is unaffected by
    these changes.

## Non-goals / do not do

- Do not add a new backend or duplicate Firebase project — reuse the existing
  one.
- Do not rewrite the app in a different framework or migrate off Capacitor to
  a fully native Android codebase.
- Do not silently loosen or skip Firestore security rules to make the admin
  build "just work" — surface the gap instead.
- Do not remove or break any existing tab/feature in the standard (non-admin)
  build.

## Deliverables

1. Code changes implementing the admin-restricted mode (step 1), with a working
   `build:admin` script.
2. The `android/` Capacitor project checked in (or `.gitignore`'d per normal
   Capacitor convention — match whatever this repo already does for build
   artifacts).
3. A short `ADMIN-BUILD.md` explaining: how to run `build:admin`, how to set
   `JAVA_HOME` to JDK 17 for the Gradle step, the exact `sdkmanager` install
   command used, and how to produce both debug and signed release APKs.
4. A note (in the same doc or a PR description) flagging the Firestore rules
   status per step 2.
