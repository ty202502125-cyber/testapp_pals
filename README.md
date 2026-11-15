# Check — student workspace

A responsive React/Vite student dashboard prototype with schedules, timed task reminders, notes, PDF preview, flashcard review, a focus timer, grade calculator, and an installable/offline PWA shell. Data entered in the dashboard is saved locally in the current browser using `localStorage`.

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

## Google sync and free ChatGPT handoff

The app supports Google sign-in and private cross-device sync using the Google Drive `appDataFolder` scope. A fresh install can restore tasks, notes, flashcards, and appearance settings after the same Google account signs in. Sign-in requires OAuth setup by the app owner; a visitor's Google account alone cannot configure a deployed app.

1. Create a Google Cloud project. Enable **Google Drive API**.
2. Configure the OAuth consent screen and create an **OAuth client ID → Web application**. Add `http://localhost:5173` and your deployed HTTPS origin to Authorized JavaScript origins.
3. Copy `.env.example` to `.env.local` for local use and set `VITE_GOOGLE_CLIENT_ID`.
4. Set `VITE_GOOGLE_CLIENT_ID` in your deployment environment and redeploy. Google sign-in is only used for the app's private Google Drive sync.

The study tutor does not call an AI API. It prepares a tutoring prompt that you can copy into ChatGPT, then opens ChatGPT in a new tab. Sign in there with your ChatGPT account; ChatGPT Free can be used subject to OpenAI's current usage limits. The app does not connect to or read your ChatGPT account, and signing into this app with Google does not sign you into ChatGPT. ChatGPT's consumer plans and API billing are separate ([OpenAI billing details](https://help.openai.com/en/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform)).

### Data and privacy

Local tasks, flashcards, and notes stay in browser storage until Google is connected. When connected, the app stores one JSON file in the signed-in user's private Google Drive app data; it does not read regular Drive files. The tutor copies a prompt only when you select its copy button. PDF file contents are not extracted or sent to ChatGPT by this app. The OAuth access token stays in memory and must be re-authorized after it expires. Google OAuth consent-screen verification may be required before public distribution.

The development server runs at the URL Vite prints (usually `http://localhost:5173`). PWA service-worker registration is enabled for production builds; install prompts and service workers require HTTPS outside localhost.

## Deploy

Deploy the repository to Vercel or Netlify with the following settings:

- Build command: `npm run build`
- Output directory: `dist`
- Node.js: 20.19+ or 22.12+ (required by Vite 8)
- SPA fallback: rewrite unknown routes to `/index.html` if client-side routes are added later.

The manifest is at `public/manifest.json`; the production service worker is `public/sw.js`. Update `public/icons/check.svg` and manifest metadata when creating a branded release. On Android, open the HTTPS site in Chrome and choose **Install app** or **Add to Home screen**. On Windows, use the browser’s **Install app** action. These install the PWA; they do not create an APK or Windows installer.

## Scope and integrations

This is a front-end prototype, not a complete production ecosystem. Task date/time reminders use the Web Notifications API and are checked while the app is running; active pages also play an alarm tone. Browser timers and audio cannot wake a suspended or closed app, and exact alarm delivery is not guaranteed. Android exact alarms that work when the app is closed require a native Android app and the appropriate Android alarm/notification permissions. An APK was not built in this workspace because Android SDK/Gradle tooling is not installed. A Windows native installer likewise needs a desktop build pipeline. The PDF viewer uses the browser’s built-in PDF renderer; it does not extract text or persist uploaded PDF files. The tutor hands prompts off to ChatGPT in a separate tab and does not require an API key. The PWA service worker provides an offline app shell after assets have been visited online; it is not a background alarm scheduler.

## Current dependencies

React 19 and Vite 8. Styling is plain CSS to keep the starter lightweight. Zustand, Dexie, Tailwind, PDF.js, Supabase, and AI SDKs are not installed in this prototype.
