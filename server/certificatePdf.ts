import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import QRCode from 'qrcode';
import { ASSESSMENT_NAME } from './config.js';

/**
 * Landscape A4 certificate, generated on request from the issued record.
 * Assets are read from server/assets (shipped with the function through
 * `includeFiles` in vercel.json). Fonts are SIL OFL; licences sit beside them.
 */

const ASSETS = join(process.cwd(), 'server', 'assets');
const asset = (name: string) => readFileSync(join(ASSETS, name));

let fonts: { heading: Buffer; headingBold: Buffer; body: Buffer; bodySemi: Buffer; logo: Buffer } | null = null;
function loadAssets() {
  fonts ??= {
    heading: asset('fonts/Manrope-ExtraBold.ttf'),
    headingBold: asset('fonts/Manrope-Bold.ttf'),
    body: asset('fonts/Inter-Regular.ttf'),
    bodySemi: asset('fonts/Inter-SemiBold.ttf'),
    logo: asset('logo.png'),
  };
  return fonts;
}

let nameCharset: Set<number> | null = null;

/**
 * Characters in a name that the certificate font cannot draw. Registration
 * rejects these so a certificate never shows blank boxes.
 */
export function unsupportedNameCharacters(name: string): string[] {
  if (!nameCharset) {
    const font = fontkit.create(new Uint8Array(loadAssets().bodySemi)) as unknown as { characterSet: number[] };
    nameCharset = new Set(font.characterSet);
  }
  const bad = new Set<string>();
  for (const ch of name.normalize('NFC')) {
    const cp = ch.codePointAt(0)!;
    if (cp !== 0x20 && !nameCharset.has(cp)) bad.add(ch);
  }
  return [...bad];
}

export interface CertificateData {
  certificateNumber: string;
  recipientName: string;
  certificateTitle: string;
  scorePercentage: number;
  issuedAt: string;
  verifyUrl: string;
}

const C = {
  ink: rgb(0x10 / 255, 0x17 / 255, 0x19 / 255),
  muted: rgb(0x58 / 255, 0x64 / 255, 0x69 / 255),
  teal: rgb(0x39 / 255, 0xb2 / 255, 0xac / 255),
  tealInk: rgb(0x1a / 255, 0x75 / 255, 0x71 / 255),
  yellow: rgb(0xff / 255, 0xd0 / 255, 0x44 / 255),
  cyan: rgb(0x1f / 255, 0xa8 / 255, 0xd4 / 255),
  rule: rgb(0xdf / 255, 0xe4 / 255, 0xe1 / 255),
  paper: rgb(0xfa / 255, 0xf9 / 255, 0xf5 / 255),
};

export function formatScore(score: number): string {
  return `${Number(score.toFixed(2))}%`;
}

export function formatIssueDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' }).format(
    new Date(iso),
  );
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(next, size) > width) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Breaks a URL after "/" (or mid-segment if one segment is too long). */
function wrapUrl(url: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const part of url.split(/(?<=\/)/)) {
    if (line && font.widthOfTextAtSize(line + part, size) > width) {
      lines.push(line);
      line = '';
    }
    for (const ch of part) {
      if (line && font.widthOfTextAtSize(line + ch, size) > width) {
        lines.push(line);
        line = '';
      }
      line += ch;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function centred(page: PDFPage, text: string, font: PDFFont, size: number, y: number, color = C.ink) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (page.getWidth() - width) / 2, y, size, font, color });
}

export async function renderCertificatePdf(data: CertificateData): Promise<Uint8Array> {
  const a = loadAssets();
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`${data.certificateTitle} – ${data.recipientName}`);
  pdf.setAuthor('10X Marketing Solutions');
  pdf.setSubject(`${ASSESSMENT_NAME} – ${data.certificateNumber}`);
  pdf.setCreator('10X Marketing Solutions');
  pdf.setProducer('10X Marketing Solutions');
  pdf.setCreationDate(new Date(data.issuedAt));

  const [heading, headingBold, body, bodySemi] = await Promise.all([
    pdf.embedFont(a.heading, { subset: false }),
    pdf.embedFont(a.headingBold, { subset: false }),
    pdf.embedFont(a.body, { subset: false }),
    pdf.embedFont(a.bodySemi, { subset: false }),
  ]);
  const logo = await pdf.embedPng(a.logo);
  const qr = await pdf.embedPng(
    await QRCode.toBuffer(data.verifyUrl, { type: 'png', margin: 0, width: 360, errorCorrectionLevel: 'M', color: { dark: '#101719', light: '#ffffff' } }),
  );

  const page = pdf.addPage([841.89, 595.28]);
  const W = page.getWidth();
  const H = page.getHeight();

  // Frame
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: 22, y: 22, width: W - 44, height: H - 44, borderColor: C.rule, borderWidth: 1 });
  page.drawRectangle({ x: 22, y: 22, width: 10, height: H - 44, color: C.teal });
  page.drawRectangle({ x: 32, y: 22, width: 4, height: H - 44, color: C.yellow });

  // Header
  const logoH = 56;
  const logoW = (logo.width / logo.height) * logoH;
  page.drawImage(logo, { x: 64, y: H - 64 - logoH, width: logoW, height: logoH });
  const numLabel = 'CERTIFICATE NO.';
  page.drawText(numLabel, { x: W - 64 - body.widthOfTextAtSize(numLabel, 8), y: H - 82, size: 8, font: body, color: C.muted });
  page.drawText(data.certificateNumber, {
    x: W - 64 - bodySemi.widthOfTextAtSize(data.certificateNumber, 11),
    y: H - 98,
    size: 11,
    font: bodySemi,
    color: C.ink,
  });

  // Title
  centred(page, 'Certificate of Competency', heading, 30, H - 180, C.ink);
  centred(page, 'in Customer Support', headingBold, 15, H - 204, C.tealInk);

  centred(page, 'This certifies that', body, 13, H - 252, C.muted);

  // Recipient name, shrunk to fit
  const name = data.recipientName.normalize('NFC');
  let size = 36;
  while (size > 18 && bodySemi.widthOfTextAtSize(name, size) > W - 220) size -= 1;
  centred(page, name, bodySemi, size, H - 300, C.ink);
  page.drawLine({ start: { x: W / 2 - 200, y: H - 316 }, end: { x: W / 2 + 200, y: H - 316 }, thickness: 1, color: C.rule });

  const statement =
    `has passed the ${ASSESSMENT_NAME}, a timed assessment of customer support knowledge ` +
    `and professional judgment, with a score of ${formatScore(data.scorePercentage)}.`;
  wrap(statement, body, 12.5, 560).forEach((line, i) => centred(page, line, body, 12.5, H - 348 - i * 19, C.ink));

  // Footer row
  const baseY = 112;
  page.drawText('DATE OF ISSUE', { x: 64, y: baseY + 30, size: 8, font: body, color: C.muted });
  page.drawText(formatIssueDate(data.issuedAt), { x: 64, y: baseY + 12, size: 12, font: bodySemi, color: C.ink });
  page.drawText('ISSUED BY', { x: 250, y: baseY + 30, size: 8, font: body, color: C.muted });
  page.drawText('10X Marketing Solutions', { x: 250, y: baseY + 12, size: 12, font: bodySemi, color: C.ink });

  const qrSize = 84;
  const qrX = W - 64 - qrSize;
  page.drawImage(qr, { x: qrX, y: baseY - 16, width: qrSize, height: qrSize });
  // Right-aligned beside the QR code, kept clear of the "Issued by" column.
  const right = qrX - 14;
  const maxWidth = right - (250 + bodySemi.widthOfTextAtSize('10X Marketing Solutions', 12) + 28);
  const verifyLabel = 'VERIFY THIS CERTIFICATE';
  page.drawText(verifyLabel, { x: right - body.widthOfTextAtSize(verifyLabel, 8), y: baseY + 44, size: 8, font: body, color: C.muted });
  const urlSize = 8;
  wrapUrl(data.verifyUrl.replace(/^https?:\/\//, ''), body, urlSize, maxWidth).forEach((line, i) =>
    page.drawText(line, {
      x: right - body.widthOfTextAtSize(line, urlSize),
      y: baseY + 30 - i * 11,
      size: urlSize,
      font: body,
      color: C.tealInk,
    }),
  );

  const note =
    `Awarded by 10X Marketing Solutions to ${name} for successfully completing the ${ASSESSMENT_NAME}. ` +
    'The authenticity and current status of this certificate can be confirmed by scanning the QR code or visiting the verification link.';
  wrap(note, body, 7.5, W - 128).forEach((line, i) =>
    page.drawText(line, { x: 64, y: 58 - i * 11, size: 7.5, font: body, color: C.muted }),
  );

  return pdf.save();
}
