// Firebase Google sign-in that ALSO requests Google Sheets API scope.
// The OAuth access token returned at sign-in is what we hand to the Sheets API client.
// NOTE: Firebase only exposes the OAuth credential at sign-in time, so we cache it in memory.
// Google access tokens expire (~1h); on expiry the app must re-run signInWithGoogle().
import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type Auth,
  type User,
  type UserCredential,
} from "firebase/auth";
import { getFirebaseConfig } from "./config.js";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const SCOPES = ["profile", "email", SHEETS_SCOPE, DRIVE_SCOPE];

let app: FirebaseApp | null = null
let auth: Auth | null = null
let cachedToken: string | null = null
let cachedTokenExpiry: number | null = null

const TOKEN_KEY = "platio:sheetsToken"
const TOKEN_EXPIRY_KEY = "platio:sheetsTokenExpiry"

// Token expiry buffer: refresh 5 minutes before actual expiry
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000

// Restore a previously cached token (survives reload/close). Firebase's own
// session already persists in localStorage; we mirror that for the Sheets token
// so the user stays signed in without re-authenticating every page load.
function loadToken(): { token: string | null; expiry: number | null } {
  try {
    const token = localStorage.getItem(TOKEN_KEY)
    const expiryStr = localStorage.getItem(TOKEN_EXPIRY_KEY)
    const expiry = expiryStr ? parseInt(expiryStr, 10) : null
    return { token, expiry }
  } catch {
    return { token: null, expiry: null }
  }
}

function saveToken(t: string | null, expiry: number | null = null): void {
  try {
    if (t) {
      localStorage.setItem(TOKEN_KEY, t)
      if (expiry) localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiry))
    } else {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(TOKEN_EXPIRY_KEY)
    }
  } catch {
    /* storage unavailable — token stays in-memory only */
  }
}

const { token, expiry } = loadToken()
cachedToken = token
cachedTokenExpiry = expiry

export function initAuth(): Auth {
  if (auth) return auth;
  app = initializeApp(getFirebaseConfig());
  auth = getAuth(app);
  return auth;
}

export function getAuthInstance(): Auth {
  if (!auth) return initAuth();
  return auth;
}

/** Sign in with Google, ensuring the spreadsheets scope is granted. Caches the access token. */
export async function signInWithGoogle(): Promise<{ user: User; accessToken: string }> {
  const a = getAuthInstance();
  const provider = new GoogleAuthProvider();
  SCOPES.forEach((s) => provider.addScope(s));
  // Force account chooser + consent so the scope is always (re)granted.
  provider.setCustomParameters({ prompt: "consent" });
  const result: UserCredential = await signInWithPopup(a, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken;
  if (!accessToken) throw new Error("Google sign-in did not return a Sheets access token.");
  
  // Google OAuth tokens typically expire in ~1 hour (3600s).
  // We don't get expires_in from Firebase, so estimate 55 minutes from now.
  const expiry = Date.now() + 55 * 60 * 1000;
  
  cachedToken = accessToken;
  cachedTokenExpiry = expiry;
  saveToken(accessToken, expiry);
  return { user: result.user, accessToken };
}

export async function signOutGoogle(): Promise<void> {
  clearToken();
  if (auth) await signOut(auth);
}

export function observeAuth(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(getAuthInstance(), cb);
}

/** Get the cached OAuth access token for the Sheets API. Re-sign-in if missing/expired. */
export function getAccessToken(): string {
  if (!cachedToken || isTokenExpired()) {
    clearToken();
    throw new Error("No Sheets token cached or token expired. Call signInWithGoogle().");
  }
  return cachedToken;
}

/** True when a usable token is held (not expired). */
export function hasToken(): boolean {
  return cachedToken !== null && !isTokenExpired();
}

function isTokenExpired(): boolean {
  if (!cachedTokenExpiry) return true;
  return Date.now() >= cachedTokenExpiry - TOKEN_EXPIRY_BUFFER_MS;
}

function clearToken(): void {
  cachedToken = null;
  cachedTokenExpiry = null;
  saveToken(null);
}

export { clearToken }
