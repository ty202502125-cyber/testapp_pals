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

## Google sign-in, sync, and Gemini tutor

The app supports Google sign-in and private cross-device sync using the Google Drive `appDataFolder` scope. A fresh install can restore tasks, notes, flashcards, and appearance settings after the same Google account signs in. Sign-in requires OAuth setup by the app owner; a visitor's Google account alone cannot configure a deployed app.

1. Create a Google Cloud project. Enable **Google Drive API** and **Generative Language API**.
2. Configure the OAuth consent screen and create an **OAuth client ID → Web application**. Add `http://localhost:5173` and your deployed HTTPS origin to Authorized JavaScript origins.
3. Copy `.env.example` to `.env.local` for local use and set `VITE_GOOGLE_CLIENT_ID`.
4. Create a Gemini API key in Google AI Studio. Set `GEMINI_API_KEY` in `.env.local` for local use and as a server-side environment variable in Vercel. Do not name this `VITE_GEMINI_API_KEY`: `GEMINI_API_KEY` must remain server-only.
5. Deploy to Vercel. The `/api/chat` serverless function calls Gemini with the server-side key and requires a valid Google sign-in token. Set `VITE_GOOGLE_CLIENT_ID`, `GEMINI_API_KEY`, and optionally `GEMINI_MODEL` in Vercel’s project environment settings, then redeploy.

`GEMINI_MODEL` defaults to `gemini-3.5-flash-lite`. Gemini API free-tier eligibility and quotas depend on the Google project, model, region, and current provider limits. API use is billed/limited separately from consumer Gemini or ChatGPT subscriptions. The app cannot use a consumer ChatGPT login as OpenAI API access.

For Netlify deployment, the Vercel `/api/chat` function needs a Netlify Functions adapter before the tutor endpoint will work. The static PWA and Google Drive sync can still deploy there.

### Data and privacy

Local tasks, flashcards, and notes stay in browser storage until Google is connected. When connected, the app stores one JSON file in the signed-in user's private Google Drive app data; it does not read regular Drive files. Gemini requests include only the chat messages typed into the tutor. PDF file contents are not extracted or sent to Gemini. The OAuth access token stays in memory and must be re-authorized after it expires. Google OAuth consent-screen verification may be required before public distribution.

The development server runs at the URL Vite prints (usually `http://localhost:5173`). PWA service-worker registration is enabled for production builds; install prompts and service workers require HTTPS outside localhost.

## Deploy

Deploy the repository to Vercel or Netlify with the following settings:

- Build command: `npm run build`
- Output directory: `dist`
- Node.js: 20.19+ or 22.12+ (required by Vite 8)
- SPA fallback: rewrite unknown routes to `/index.html` if client-side routes are added later.

The manifest is at `public/manifest.json`; the production service worker is `public/sw.js`. Update `public/icons/check.svg` and manifest metadata when creating a branded release. On Android, open the HTTPS site in Chrome and choose **Install app** or **Add to Home screen**. On Windows, use the browser’s **Install app** action. These install the PWA; they do not create an APK or Windows installer.

## Scope and integrations

This is a front-end prototype, not a complete production ecosystem. Task date/time reminders use the Web Notifications API and are checked while the app is running; active pages also play an alarm tone. Browser timers and audio cannot wake a suspended or closed app, and exact alarm delivery is not guaranteed. Android exact alarms that work when the app is closed require a native Android app and the appropriate Android alarm/notification permissions. An APK was not built in this workspace because Android SDK/Gradle tooling is not installed. A Windows native installer likewise needs a desktop build pipeline. The PDF viewer uses the browser’s built-in PDF renderer; it does not extract text or persist uploaded PDF files. AI chat requires the Gemini backend environment key. Never place Gemini or OpenAI API keys in browser code; proxy requests through an authenticated server. The PWA service worker provides an offline app shell after assets have been visited online; it is not a background alarm scheduler. The in-memory chat endpoint should be paired with durable rate limiting and abuse monitoring before public launch.

## Current dependencies

React 19 and Vite 8. Styling is plain CSS to keep the starter lightweight. Zustand, Dexie, Tailwind, PDF.js, Supabase, and AI SDKs are not installed in this prototype.
