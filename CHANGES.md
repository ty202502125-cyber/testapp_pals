# Check — full layout redesign (v2)

A complete layout + feature redesign of the Check student dashboard, not a
theme change. The Midnight Focus theme (dark navy `#070a1a`, lime `#b8f53d`),
the lime CustomCursor, and the interactive animations are kept.

## New layout — 5 sections (was 7)

| Section | What it holds |
| --- | --- |
| **Today** | Merges Overview + Schedule. Greeting, 3 summary stats (tasks due, focus minutes, cards due), a compact 7-day week strip (task counts per day, tap to open Tasks), Today’s tasks (top 4), Coming up (next 7 days), the Day/Week schedule calendar, the focus timer, and the single Daily note. |
| **Tasks** | Full task list with new filters: All / Today / Overdue / Done. Recurring tasks, due dates, and reminders unchanged. |
| **Study** | Merges Study room + Flashcards. Focus timer with the same 25/50/15-min presets, a focus-today panel (minutes + sessions, 50-minute goal bar), the flashcard deck with creator form, and the review modal with Again/Hard/Good/Easy spaced repetition. |
| **Materials** | PDF upload + in-browser preview only. |
| **Grades** | Weighted average + target-grade calculator (“what do I need on the rest”). |

## Features removed — and why

1. **Ambient sounds** (Rain / White noise / Lo-fi, `toggleAmbient`, `soundName`) — a gimmick, not core to studying. The timer and its chime stay.
2. **AI Tutor prompt builder** (`components/AITutor.jsx`) — it was not a tutor; it only copied a prompt into ChatGPT.
3. **Duplicate scratchpad note in Materials** — it was the same note as the Daily note. One note only, on Today.
4. **Google Drive sync** (`services/googleDrive.js`, `AccountDialog.jsx`, sign-in/out, cloud status) — it needs owner OAuth setup and does nothing for visitors on the deployed site. Replaced by **Export / Import JSON backup** in the top bar: Export downloads all local data as one `check-backup-YYYY-MM-DD.json` file; Import restores it. Data keys are identical, so existing data survives.
5. **PWA install hint modal + `beforeinstallprompt` handling** (`installPrompt` / `installHint`) — the install nudge is gone. The manifest and service worker files are unchanged, so installing from the browser menu still works.
6. **Sidebar streak card** — it duplicated focus stats. Focus-today minutes and the 50-minute goal now live on the Study page instead. The day-streak counter went with the card; focus minutes and completed sessions are still tracked.
7. **Month calendar view** — a third view of the same tasks. Day and Week remain.
8. **5-minute snooze button on the reminder toast** — the reminder toast itself and the alarm tone stay; snooze is gone.
9. **Top-bar breadcrumbs, today pill, and quick-add pill** — slim top bar now: current page title, Export / Import, theme toggle.
10. **Letter grade in Grade tracker** — no grading scale is configured, so the letter was a guess. Weighted average and target calculator stay.

## Improvements

- Tasks page gains All / Today / Overdue / Done filters with counts.
- Today’s task list is now occurrence-aware: it shows today’s actual occurrences (including recurring ones) and toggling one marks that occurrence complete.
- Today gains a 7-day week strip so the week is visible without opening a calendar.
- Focus-today stats moved from the sidebar into a proper panel on Study.
- Backup is now self-serve: Export / Import JSON in the top bar, no account or OAuth needed.
- Top bar slimmed to page title + Export / Import + theme toggle; theme toggle moved out of the sidebar.
- `index.html` theme-color updated to the Midnight Focus canvas (`#070a1a`).

## Kept unchanged in behaviour

Recurring tasks + occurrence expansion, Notification-API reminders + alarm
tone, spaced-repetition ratings (1d / 2d / 3d / 6d), timer presets and focus
stats, weighted grades, PDF preview, localStorage keys (exact same keys:
`check-tasks`, `check-cards`, `check-grades`, `check-note`,
`check-focus-stats`, `check-dark`, `check-reminders-enabled`,
`check-reminder-sound`, `check-reminder-deliveries`), dark mode, Midnight
Focus tokens, CustomCursor rendering, reduced-motion handling, keyboard
shortcuts (N to quick-add, Space / 1–4 / Esc in review).

## How to use this file set

This folder is a complete replacement for the repository contents (except
`.git` and `node_modules`). Copy it over the repo, or replace the changed
files: `src/App.jsx`, `src/App.css`, `src/pwa.css`, `src/responsive.css`,
`src/components/ScheduleCalendar.jsx`, `src/components/TaskList.jsx`,
`src/index.css`, `index.html`, `README.md`, and delete
`src/components/AITutor.jsx`, `src/components/AccountDialog.jsx`,
`src/services/googleDrive.js`, and `.env.example`. Then:

```bash
npm install
npm run build
npm run dev
```

## How to restore anything removed

Everything removed is still in git history: the previous state is the `main`
branch before this redesign (last commit before it: `7eeba42` “Render
CustomCursor in App so the Midnight Focus lime cursor shows (UI-only)”).
Restore a single file with, e.g.:

```bash
git checkout 7eeba42 -- src/components/AITutor.jsx
```

or restore the whole previous version with `git checkout 7eeba42` on a
branch. The Export/Import backup also means a user’s own data is never
touched by this redesign — same localStorage keys, same data.
