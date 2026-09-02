// Receipt storage for the no-server model.
//
// Google Sheets has no file storage, so physical receipt files go to Google
// Drive using the SAME Google OAuth token the app already holds for Sheets
// (scope `drive.file` — user-visible files only, no billing needed). We store
// the returned web-view link in the sheet's `receipt_key` column.
//
// Why Drive and not base64-in-a-cell? Cell size is capped (~50k chars) and the
// free Sheets quota is tiny; Drive is the intended place for blobs.

import { getAccessToken } from "./auth.js";

const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";
const DRIVE_META_URL = "https://www.googleapis.com/drive/v3/files";

export interface UploadedFile {
  id: string;
  name: string;
  /** Web-view link the client can open in a browser. */
  webViewLink: string;
  mimeType: string;
}

/** Upload a file to the user's Google Drive (scoped to this app via drive.file). */
export async function uploadToDrive(file: File, folderName = "Platio Receipts"): Promise<UploadedFile> {
  const token = getAccessToken();

  // 1) Ensure an app folder exists (idempotent by name lookup).
  const folderId = await getOrCreateFolder(folderName, token);

  // 2) Multipart upload: metadata + binary body.
  const boundary = "platio_boundary_" + Math.random().toString(36).slice(2);
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;
  const metadata = { name: file.name, parents: [folderId], mimeType: file.type || "application/octet-stream" };
  const multipart = delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${file.type || "application/octet-stream"}\r\n\r\n`;

  const body = new Blob([multipart, file, closeDelim], { type: `multipart/related; boundary=${boundary}` });

  const res = await fetch(`${DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,name,mimeType,webViewLink`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Drive upload failed (${res.status}): ${txt.slice(0, 300)}`);
  }
  const data = (await res.json()) as { id: string; name: string; mimeType: string; webViewLink?: string };
  return {
    id: data.id,
    name: data.name,
    mimeType: data.mimeType,
    webViewLink: data.webViewLink ?? `https://drive.google.com/file/d/${data.id}/view`,
  };
}

/** Permanently delete a receipt file from Drive (used when a transaction is removed). */
export async function deleteFromDrive(fileId: string): Promise<void> {
  const token = getAccessToken();
  const res = await fetch(`${DRIVE_META_URL}/${fileId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok && res.status !== 404) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Drive delete failed (${res.status}): ${txt.slice(0, 300)}`);
  }
}

// --- folder helper (private) ---

async function getOrCreateFolder(name: string, token: string): Promise<string> {
  const q = encodeURIComponent(`name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const find = await fetch(`${DRIVE_META_URL}?q=${q}&fields=files(id)&pageSize=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (find.ok) {
    const j = (await find.json()) as { files?: { id: string }[] };
    if (j.files && j.files.length) return j.files[0].id;
  }
  const create = await fetch(DRIVE_META_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder" }),
  });
  if (!create.ok) {
    const txt = await create.text().catch(() => "");
    throw new Error(`Drive folder create failed (${create.status}): ${txt.slice(0, 300)}`);
  }
  const j = (await create.json()) as { id: string };
  return j.id;
}
