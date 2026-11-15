# Check — student workspace

A responsive React/Vite student dashboard prototype with five sections — Today, Tasks, Study, Materials, and Grades — plus timed task reminders, notes, PDF preview, flashcard review, and a focus timer. Data entered in the dashboard is saved locally in the current browser using `localStorage`.

## Run locally

```bash
npm install
npm run dev
```

Production build and local preview:

```bash
npm run build
npm run preview
```

## Backup (Export / Import)

All of your data stays on this device. Use the **Export** button in the top bar to download everything — tasks, notes, flashcards, and appearance settings — as a single JSON file. To restore it later, on this device or another, use the **Import** button in the top bar and choose the JSON file you exported. Import replaces the current local data with the contents of the file, so export a fresh backup first if you want to keep what is on the device now.

### Data and privacy

Local tasks, flashcards, and notes stay in browser storage. Nothing is uploaded to a server or a cloud account. PDF file contents are not extracted or sent anywhere by this app.

The development server runs at the URL Vite prints (usually `http://localhost:5173`).

## Deploy

Deploy the repository to Vercel or Netlify with the following settings:

- Build command: `npm run build`
- Output directory: `dist`
- Node.js: 20.19+ or 22.12+ (required by Vite 8)
- SPA fallback: rewrite unknown routes to `/index.html` if client-side routes are added later.

## Scope and integrations

This is a front-end prototype, not a complete production ecosystem. Task date/time reminders use the Web Notifications API and are checked while the app is running; active pages also play an alarm tone. Browser timers and audio cannot wake a suspended or closed app, and exact alarm delivery is not guaranteed. Android exact alarms that work when the app is closed require a native Android app and the appropriate Android alarm/notification permissions. An APK was not built in this workspace because Android SDK/Gradle tooling is not installed. A Windows native installer likewise needs a desktop build pipeline. The PDF viewer uses the browser’s built-in PDF renderer; it does not extract text or persist uploaded PDF files.

## Current dependencies

React 19 and Vite 8. Styling is plain CSS to keep the starter lightweight. Zustand, Dexie, Tailwind, PDF.js, Supabase, and AI SDKs are not installed in this prototype.
