export const MAX_FINANCE_EXPORT_ROWS = 2000;

export interface FinanceExportRow {
  id: string;
  date: string;
  type: string;
  amount: number;
  currency: string;
  accountName: string;
  targetAccountName: string;
  categoryName: string;
  counterparty: string;
  description: string;
  branchName: string;
  groupName: string;
  isReversal: boolean;
}

/**
 * Neutralizes CSV / XLSX formula injection (DDE / macro execution in Excel / LibreOffice / Google Sheets).
 * Any cell string starting with =, +, -, @ (or preceded by whitespace/tab/CR/LF before one of those characters)
 * is prefixed with a single quote `'`.
 */
export function sanitizeSpreadsheetCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/^[\s\t\r\n]*[=+\-@]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

function escapeCsvField(raw: string | number | boolean | null | undefined): string {
  const safe = sanitizeSpreadsheetCell(raw);
  if (/[",\r\n;]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

const EXPORT_HEADERS = [
  "ID",
  "Дата (Asia/Tashkent)",
  "Тип",
  "Сумма (UZS)",
  "Валюта",
  "Счёт",
  "Целевой счёт",
  "Категория",
  "Контрагент",
  "Описание",
  "Филиал",
  "Группа",
  "Сторно",
];

/**
 * Generates UTF-8 CSV with formula injection protection and row limit enforcement.
 */
export function generateFinanceCsv(rows: FinanceExportRow[]): string {
  if (rows.length > MAX_FINANCE_EXPORT_ROWS) {
    throw new Error(`Export exceeds maximum row limit of ${MAX_FINANCE_EXPORT_ROWS}`);
  }

  const lines: string[] = [EXPORT_HEADERS.map(escapeCsvField).join(",")];

  for (const r of rows) {
    const signedAmount = r.isReversal ? -Math.abs(r.amount) : r.amount;
    const cols = [
      escapeCsvField(r.id),
      escapeCsvField(r.date),
      escapeCsvField(r.type),
      String(signedAmount),
      escapeCsvField(r.currency),
      escapeCsvField(r.accountName),
      escapeCsvField(r.targetAccountName),
      escapeCsvField(r.categoryName),
      escapeCsvField(r.counterparty),
      escapeCsvField(r.description),
      escapeCsvField(r.branchName),
      escapeCsvField(r.groupName),
      r.isReversal ? "ДА (СТОРНО)" : "НЕТ",
    ];
    lines.push(cols.join(","));
  }

  return lines.join("\r\n");
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function colIndexToLetter(index: number): string {
  let letter = "";
  let n = index;
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

// CRC-32 table for ZIP packaging
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC32_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createStoredZip(files: { name: string; content: Buffer }[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, "utf8");
    const dataBuf = file.content;
    const crc = crc32(dataBuf);
    const size = dataBuf.length;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // Local file header signature
    localHeader.writeUInt16LE(20, 4); // Version needed
    localHeader.writeUInt16LE(0, 6); // Flags
    localHeader.writeUInt16LE(0, 8); // Compression method: 0 (STORE)
    localHeader.writeUInt16LE(0, 10); // Mod time
    localHeader.writeUInt16LE(0, 12); // Mod date
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(size, 18); // Compressed size
    localHeader.writeUInt32LE(size, 22); // Uncompressed size
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28); // Extra field length

    localParts.push(localHeader, nameBuf, dataBuf);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // Central directory signature
    centralHeader.writeUInt16LE(20, 4); // Version made by
    centralHeader.writeUInt16LE(20, 6); // Version needed
    centralHeader.writeUInt16LE(0, 8); // Flags
    centralHeader.writeUInt16LE(0, 10); // Method: 0 (STORE)
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(size, 20);
    centralHeader.writeUInt32LE(size, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42); // Relative offset of local header

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + dataBuf.length;
  }

  const centralDirSize = centralParts.reduce((acc, b) => acc + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // End of central directory signature
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralDirSize, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, eocd]);
}

/**
 * Generates an OpenXML SpreadsheetML (.xlsx) Buffer with formula injection protection
 * and row limit enforcement.
 */
export function generateFinanceXlsx(rows: FinanceExportRow[]): Buffer {
  if (rows.length > MAX_FINANCE_EXPORT_ROWS) {
    throw new Error(`Export exceeds maximum row limit of ${MAX_FINANCE_EXPORT_ROWS}`);
  }

  const sheetRowsXml: string[] = [];

  // Row 1: Headers
  const headerCells = EXPORT_HEADERS.map((h, colIdx) => {
    const ref = `${colIndexToLetter(colIdx)}1`;
    const safe = escapeXml(sanitizeSpreadsheetCell(h));
    return `<c r="${ref}" t="inlineStr"><is><t>${safe}</t></is></c>`;
  }).join("");
  sheetRowsXml.push(`<row r="1">${headerCells}</row>`);

  // Data rows
  rows.forEach((r, idx) => {
    const rowNum = idx + 2;
    const signedAmount = r.isReversal ? -Math.abs(r.amount) : r.amount;
    const values: { val: string | number; isNum?: boolean }[] = [
      { val: r.id },
      { val: r.date },
      { val: r.type },
      { val: signedAmount, isNum: true },
      { val: r.currency },
      { val: r.accountName },
      { val: r.targetAccountName },
      { val: r.categoryName },
      { val: r.counterparty },
      { val: r.description },
      { val: r.branchName },
      { val: r.groupName },
      { val: r.isReversal ? "ДА (СТОРНО)" : "НЕТ" },
    ];

    const cellsXml = values
      .map((cell, colIdx) => {
        const ref = `${colIndexToLetter(colIdx)}${rowNum}`;
        if (cell.isNum && typeof cell.val === "number") {
          return `<c r="${ref}" t="n"><v>${cell.val}</v></c>`;
        }
        const safe = escapeXml(sanitizeSpreadsheetCell(cell.val));
        return `<c r="${ref}" t="inlineStr"><is><t>${safe}</t></is></c>`;
      })
      .join("");

    sheetRowsXml.push(`<row r="${rowNum}">${cellsXml}</row>`);
  });

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="FinanceTransactions" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

  const sheet1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${sheetRowsXml.join("")}</sheetData>
</worksheet>`;

  return createStoredZip([
    { name: "[Content_Types].xml", content: Buffer.from(contentTypesXml, "utf8") },
    { name: "_rels/.rels", content: Buffer.from(relsXml, "utf8") },
    { name: "xl/workbook.xml", content: Buffer.from(workbookXml, "utf8") },
    { name: "xl/_rels/workbook.xml.rels", content: Buffer.from(workbookRelsXml, "utf8") },
    { name: "xl/worksheets/sheet1.xml", content: Buffer.from(sheet1Xml, "utf8") },
  ]);
}
