// Vite-style env typing for this library. Vite injects import.meta.env at build time.
// If consumed without Vite, these will be undefined and the config functions throw clear errors.
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_SPREADSHEET_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
