/**
 * CSV Helper with CSV Formula Injection (DDE) Sanitization
 * Automatically escapes characters that can trigger formula execution in spreadsheet software:
 * '=', '+', '-', '@', '\t', '\r'
 */

export function sanitizeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let str = String(value);

  // If starts with dangerous character, prefix with single quote
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // If cell contains double quote, comma, or newline, escape quotes and wrap in quotes
  if (/[",\r\n]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

export function generateCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][]
): string {
  const headerLine = headers.map(sanitizeCsvCell).join(",");
  const rowLines = rows.map((row) => row.map(sanitizeCsvCell).join(","));
  // Include UTF-8 BOM (\uFEFF) for compatibility with Excel
  return "\uFEFF" + [headerLine, ...rowLines].join("\r\n");
}
