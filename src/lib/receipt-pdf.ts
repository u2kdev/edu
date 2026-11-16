import fs from "fs";
import path from "path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";

let cachedFontBytes: Uint8Array | null = null;

function getReceiptFontBytes(): Uint8Array {
  if (cachedFontBytes) {
    return cachedFontBytes;
  }
  const fontPath = path.join(process.cwd(), "src", "assets", "fonts", "DejaVuSans.ttf");
  const bytes = fs.readFileSync(fontPath);
  cachedFontBytes = new Uint8Array(bytes);
  return cachedFontBytes;
}

export interface PdfReceiptData {
  receiptNumber: string;
  verifyUrl: string;
  verifyCode: string;
  lang?: "ru" | "uz-Latn";
  centerName: string;
  centerLegalName?: string | null;
  centerInn?: string | null;
  centerAddress?: string | null;
  centerPhone?: string | null;
  studentName: string;
  groupName?: string | null;
  courseTitle?: string | null;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  originalAmount: number;
  discountAmount: number;
  discountReason?: string | null;
  paidAmount: number;
  refundedAmount: number;
  currency: string;
  paymentMethod: string;
  status: string;
  paidAt: Date | null;
  createdAt: Date;
}

function formatAmount(amount: number, currency: string): string {
  return `${Math.round(amount).toLocaleString("ru-RU")} ${currency}`;
}

function formatTashkentDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatTashkentDay(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function translateMethod(method: string, lang: "ru" | "uz-Latn"): string {
  if (lang === "uz-Latn") {
    if (method === "CASH") return "Naqd pul";
    if (method === "ONLINE") return "Onlayn (Click)";
    if (method === "BANK_TRANSFER") return "Bank o'tkazmasi";
    return method;
  }
  if (method === "CASH") return "Наличные";
  if (method === "ONLINE") return "Онлайн (Click)";
  if (method === "BANK_TRANSFER") return "Банковский перевод";
  return method;
}

function translateStatus(status: string, lang: "ru" | "uz-Latn"): string {
  if (lang === "uz-Latn") {
    if (status === "PAID") return "TO'LANGAN";
    if (status === "PARTIALLY_PAID") return "QISMAN TO'LANGAN";
    if (status === "PENDING") return "KUTILMOQDA";
    if (status === "REFUNDED") return "QAYTARILGAN";
    return status;
  }
  if (status === "PAID") return "ОПЛАЧЕНО";
  if (status === "PARTIALLY_PAID") return "ЧАСТИЧНО ОПЛАЧЕНО";
  if (status === "PENDING") return "ОЖИДАЕТ ОПЛАТЫ";
  if (status === "REFUNDED") return "ВОЗВРАТ";
  return status;
}

/**
 * Renders an official printable A4 PDF receipt using bundled DejaVuSans TTF
 * (full Cyrillic + Uzbek Latin glyph support including oʻ, gʻ, ʼ) and embeds a QR verification code.
 */
export async function generateReceiptPdf(data: PdfReceiptData): Promise<Uint8Array> {
  const lang = data.lang === "uz-Latn" ? "uz-Latn" : "ru";
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit as unknown as Parameters<typeof pdfDoc.registerFontkit>[0]);

  const fontBytes = getReceiptFontBytes();
  const font = await pdfDoc.embedFont(fontBytes);

  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  const textDark = rgb(0.08, 0.11, 0.18);
  const textMuted = rgb(0.4, 0.45, 0.55);
  const accent = rgb(0.06, 0.46, 0.88);
  const borderGray = rgb(0.85, 0.88, 0.92);

  // Header band
  page.drawRectangle({
    x: 40,
    y: height - 110,
    width: width - 80,
    height: 70,
    color: rgb(0.95, 0.97, 1.0),
    borderColor: borderGray,
    borderWidth: 1,
  });

  const titleLabel =
    lang === "uz-Latn" ? `TO'LOV CHEKI ${data.receiptNumber}` : `КВИТАНЦИЯ № ${data.receiptNumber}`;
  page.drawText(data.centerName, {
    x: 56,
    y: height - 66,
    size: 16,
    font,
    color: accent,
  });
  page.drawText(titleLabel, {
    x: 56,
    y: height - 90,
    size: 13,
    font,
    color: textDark,
  });

  const statusText = translateStatus(data.status, lang);
  page.drawText(statusText, {
    x: width - 190,
    y: height - 78,
    size: 11,
    font,
    color: accent,
  });

  // Legal center details
  let cursorY = height - 134;
  const centerMetaLines: string[] = [];
  if (data.centerLegalName) centerMetaLines.push(data.centerLegalName);
  if (data.centerInn) centerMetaLines.push(`ИНН / STIR: ${data.centerInn}`);
  if (data.centerAddress) centerMetaLines.push(data.centerAddress);
  if (data.centerPhone) centerMetaLines.push(`Тел / Tel: ${data.centerPhone}`);

  for (const line of centerMetaLines) {
    page.drawText(line, { x: 40, y: cursorY, size: 9.5, font, color: textMuted });
    cursorY -= 14;
  }

  cursorY -= 10;
  page.drawLine({
    start: { x: 40, y: cursorY },
    end: { x: width - 40, y: cursorY },
    thickness: 1,
    color: borderGray,
  });
  cursorY -= 26;

  const rows: Array<[string, string]> = [
    [lang === "uz-Latn" ? "O'quvchi" : "Ученик", data.studentName],
    [
      lang === "uz-Latn" ? "Guruh / Kurs" : "Группа / Курс",
      [data.groupName, data.courseTitle].filter(Boolean).join(" — ") || "—",
    ],
    [
      lang === "uz-Latn" ? "To'lov davri" : "Оплаченный период",
      data.periodStart && data.periodEnd
        ? `${formatTashkentDay(data.periodStart)} — ${formatTashkentDay(data.periodEnd)}`
        : "—",
    ],
    [
      lang === "uz-Latn" ? "Hisoblangan summa" : "Начисленная сумма",
      formatAmount(data.originalAmount, data.currency),
    ],
  ];

  if (data.discountAmount > 0) {
    rows.push([
      lang === "uz-Latn" ? "Chegirma" : "Скидка",
      `-${formatAmount(data.discountAmount, data.currency)}${
        data.discountReason ? ` (${data.discountReason})` : ""
      }`,
    ]);
  }

  rows.push(
    [
      lang === "uz-Latn" ? "To'langan summa" : "Оплачено",
      formatAmount(data.paidAmount, data.currency),
    ],
    ...(data.refundedAmount > 0
      ? [
          [
            lang === "uz-Latn" ? "Qaytarilgan summa" : "Возвращено",
            formatAmount(data.refundedAmount, data.currency),
          ] as [string, string],
        ]
      : []),
    [
      lang === "uz-Latn" ? "To'lov usuli" : "Способ оплаты",
      translateMethod(data.paymentMethod, lang),
    ],
    [
      lang === "uz-Latn" ? "To'lov sanasi (Toshkent)" : "Дата оплаты (Ташкент)",
      formatTashkentDate(data.paidAt ?? data.createdAt),
    ]
  );

  for (const [label, value] of rows) {
    page.drawText(label, { x: 40, y: cursorY, size: 10.5, font, color: textMuted });
    page.drawText(value.slice(0, 72), { x: 225, y: cursorY, size: 10.5, font, color: textDark });
    cursorY -= 22;
    page.drawLine({
      start: { x: 40, y: cursorY + 8 },
      end: { x: width - 40, y: cursorY + 8 },
      thickness: 0.5,
      color: borderGray,
    });
  }

  // Verification QR block
  const qrBuffer = await QRCode.toBuffer(data.verifyUrl, {
    type: "png",
    width: 140,
    margin: 1,
  });
  const qrImage = await pdfDoc.embedPng(qrBuffer);
  const qrY = Math.max(80, cursorY - 140);

  page.drawImage(qrImage, {
    x: 40,
    y: qrY,
    width: 110,
    height: 110,
  });

  const qrTitle =
    lang === "uz-Latn"
      ? "Chekning haqiqiyligini tekshirish"
      : "Проверка подлинности квитанции";
  const qrSub =
    lang === "uz-Latn"
      ? "QR-kodni skanerlang yoki havola orqali tekshiring:"
      : "Отсканируйте QR-код или перейдите по ссылке:";

  page.drawText(qrTitle, { x: 165, y: qrY + 86, size: 11, font, color: textDark });
  page.drawText(qrSub, { x: 165, y: qrY + 68, size: 9.5, font, color: textMuted });
  page.drawText(data.verifyUrl.slice(0, 82), { x: 165, y: qrY + 50, size: 8.5, font, color: accent });
  page.drawText(`Verify code: ${data.verifyCode}`, {
    x: 165,
    y: qrY + 32,
    size: 8.5,
    font,
    color: textMuted,
  });

  return pdfDoc.save();
}
