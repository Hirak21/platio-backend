// Runtime config. Secrets are NEVER hardcoded — pulled from build-time env (Vite: import.meta.env).
// For Firebase Hosting static builds, set these in a .env.local (VITE_*) or via firebase functions config on deploy.

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
}

export function getFirebaseConfig(): FirebaseConfig {
  const v = import.meta.env;
  const cfg: FirebaseConfig = {
    apiKey: (v.VITE_FIREBASE_API_KEY as string) ?? "",
    authDomain: (v.VITE_FIREBASE_AUTH_DOMAIN as string) ?? "",
    projectId: (v.VITE_FIREBASE_PROJECT_ID as string) ?? "",
    appId: (v.VITE_FIREBASE_APP_ID as string) ?? "",
  };
  if (!cfg.apiKey || !cfg.projectId) {
    throw new Error(
      "Firebase config missing. Set VITE_FIREBASE_API_KEY / VITE_FIREBASE_PROJECT_ID (see .env.local.example)."
    );
  }
  return cfg;
}

export function getSpreadsheetId(): string {
  const id = import.meta.env.VITE_SPREADSHEET_ID as string | undefined;
  if (!id) throw new Error("VITE_SPREADSHEET_ID not set. Put your Google Sheet ID in .env.local.");
  return id;
}
