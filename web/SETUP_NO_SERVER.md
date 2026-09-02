# Platio No-Server — Go Live Checklist (needs YOUR Google account)

The app is fully built and runs in **demo mode** right now with zero credentials
(`npm run dev` → http://localhost:5173). To make it the REAL no-server backend
(reads/writes a live Google Sheet, no Render/Postgres), you must do the steps
below once. Hermes cannot click through your Google login, so these are yours.

## 1. Firebase project (Spark = free, no billing)
- https://console.firebase.google.com → Add project → e.g. `platio-noserver`
- Authentication → Sign-in method → Add provider → **Google**.
- OAuth consent screen: External, add your email as a test user.

## 2. Enable the Google Sheets API (separate from Firebase)
- https://console.cloud.google.com/apis/library/sheets.googleapis.com → Enable
  (same GCP project as the Firebase project above).
- (Drive API is also used for receipt files — enable
  `drive.googleapis.com` the same way.)

## 3. Create the spreadsheet (the "database")
- New Google Sheet. Copy the ID from its URL:
  `https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit`
- Share it with the CLIENT as **Viewer** — they see live data, can't edit.
  The app creates the tabs (Projects, Transactions, Categories, Audit)
  automatically on first use.

## 4. Web app config → .env.local
Copy `web/.env.local.example` to `web/.env.local` and fill:
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_APP_ID=...
VITE_SPREADSHEET_ID=<the sheet id from step 3>
```
Presence of `VITE_SPREADSHEET_ID` + `VITE_FIREBASE_API_KEY` flips the app into
live Sheets mode automatically (see `src/lib/index.ts`).

## 5. Install Firebase CLI + deploy static frontend
```bash
npm install -g firebase-tools
firebase login
cd ~/Projects/platio
firebase use --add        # pick the project from step 1
firebase deploy --only hosting
```
This pushes `web/dist` to the existing platio-app.web.app. (It already resolves
HTTP 200 — we are replacing the old frontend, same host.)

## 6. Smoke test (after deploy)
1. Open platio-app.web.app → "Sign in with Google".
2. Create a project → add one income + one expense transaction.
3. Open the Google Sheet directly (Viewer account or your own) → rows appear live.
4. Reports → Download Excel → file contains Summary + Transactions.
5. Confirm the client (Viewer) sees the new rows without logging into the app.

## Decommission Render + Postgres (do AFTER step 6 passes)
- Render dashboard → delete service `platio-backend` + disk `platio-data`.
- Render dashboard → delete Postgres `postgresql_platio` (it is unreachable anyway).
- The old Python backend at `platio/backend/` and `platio/functions/` become dead
  code — delete or archive once live mode is verified. Do NOT delete until step 6
  is confirmed working, so you keep a fallback.

## What is intentionally NOT used
- No Cloud Functions / Cloud Run / Secret Manager (billing blocked).
- No server process at all. The browser + Google Sheets IS the backend.
- Receipts → Google Drive (webViewLink stored in the sheet's `receipt_key` column).
