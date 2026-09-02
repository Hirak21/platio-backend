# sheets-core — Manual Setup (needs your Google account)

Code is built and type-checks clean. The steps below REQUIRE your Google login, so
Hermes did not run them. Do them once; then Platio/Invento reuse the same project.

## 1. Create the Firebase project
- Go to https://console.firebase.google.com → "Add project" → name it (e.g. `platio-no-server`).
- No billing needed (Spark free plan covers Hosting + Auth).

## 2. Enable Google sign-in
- Build > Authentication > Sign-in method > Add provider > Google.
- You'll need an OAuth consent screen (set it to "External", add your email as test user).

## 3. Enable the Google Sheets API (separate from Firebase)
- Go to https://console.cloud.google.com/apis/library/sheets.googleapis.com (same project) → Enable.
- This is the API the browser calls to read/write the spreadsheet.

## 4. Get web app config
- Project settings (gear) > General > "Your apps" > Web app → copy:
  - apiKey, authDomain, projectId, appId.
- Put them in `.env.local` (copy from `.env.local.example`).

## 5. Create the spreadsheet
- Make a new Google Sheet. Copy the ID from the URL:
  `https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit`
- Paste into `.env.local` as `VITE_SPREADSHEET_ID`.
- Share it with the CLIENT's Google account as **Viewer** (they see live data, can't edit).
- The app creates the tabs/headers automatically on first use (ensureTab).

## 6. Install Firebase CLI (one-time, needs your login)
```bash
npm install -g firebase-tools
firebase login
cd ~/Projects/sheets-core
firebase use --add        # pick the project from step 1
firebase deploy           # deploys the static public/ dir (Hosting)
```
> Firebase Hosting only serves static files. The "backend" is the browser + Sheets API.
> Cloud Functions are intentionally NOT used (billing blocked).

## 7. Verify before building features
A smoke test lives inside the Platio app (Phase 1): sign in with Google →
append one Transaction row → read it back → click "Export xlsx". Also confirm the
client (Viewer on the sheet) sees the row appear live in Google Sheets.
