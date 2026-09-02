// Client-side .xlsx export. SheetJS runs in the browser (no server).
// Build a workbook from labelled sheets (arrays of arrays) and trigger a download.
import * as XLSX from "xlsx";

export interface ExportSheet {
  name: string;
  rows: (string | number)[][]; // first row = headers
}

export function buildWorkbook(sheets: ExportSheet[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  return wb;
}

/** Trigger a browser download of the workbook. */
export function downloadXlsx(sheets: ExportSheet[], filename: string): void {
  const wb = buildWorkbook(sheets);
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

/** Return the workbook as a Blob (for upload / email attachments if needed later). */
export function workbookToBlob(sheets: ExportSheet[]): Blob {
  const wb = buildWorkbook(sheets);
  return XLSX.write(wb, { bookType: "xlsx", type: "array" }) as unknown as Blob;
}
