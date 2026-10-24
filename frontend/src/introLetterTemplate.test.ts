/**
 * Regression test for the embedded introduction letter template.
 *
 * Guards against the production bug where `fetch('/intro-letter-template.pdf')`
 * returned `index.html` (Firebase Hosting catch-all rewrite) and pdf-lib failed
 * with: "Failed to parse PDF document ... No PDF header found".
 *
 * The template is now embedded in the bundle, so this test verifies it is always
 * present, starts with the PDF magic bytes, and can be personalized with
 * pdf-lib exactly the way AgentPage.generateIntroLetter() does.
 */

import { describe, it, expect } from 'vitest';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import {
  INTRO_LETTER_TEMPLATE_BASE64,
  getIntroLetterTemplateBytes,
} from './assets/introLetterTemplate';

describe('Embedded introduction letter template', () => {
  it('is present and non-empty', () => {
    expect(INTRO_LETTER_TEMPLATE_BASE64.length).toBeGreaterThan(1000);
  });

  it('decodes to bytes starting with the %PDF- magic bytes', () => {
    const bytes = getIntroLetterTemplateBytes();
    expect(bytes.length).toBeGreaterThan(4);
    expect(bytes[0]).toBe(0x25); // %
    expect(bytes[1]).toBe(0x50); // P
    expect(bytes[2]).toBe(0x44); // D
    expect(bytes[3]).toBe(0x46); // F
    expect(bytes[4]).toBe(0x2d); // -

    // HTML must never appear here — that is the original bug signature.
    const decoded = new TextDecoder().decode(bytes.slice(0, 15));
    expect(decoded.toLowerCase()).not.toMatch(/^<!doctype\s+html>/);
  });

  it('pdf-lib can parse the template', async () => {
    const pdfDoc = await PDFDocument.load(getIntroLetterTemplateBytes(), {
      ignoreEncryption: true,
      throwOnInvalidObject: false,
    });
    expect(pdfDoc.getPageCount()).toBeGreaterThan(0);
  });

  it('can be personalized and re-saved (mirrors AgentPage.generateIntroLetter)', async () => {
    const pdfDoc = await PDFDocument.load(getIntroLetterTemplateBytes(), {
      ignoreEncryption: true,
      throwOnInvalidObject: false,
    });
    const firstPage = pdfDoc.getPages()[0];
    const { height } = firstPage.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const size = 13;

    firstPage.drawText('Dear TEST CHAIRMAN', { x: 57, y: height - 247, size, font, color: rgb(0, 0, 0) });
    firstPage.drawText('Date: 24-Oct-2026', { x: 430, y: height - 232, size, font, color: rgb(0, 0, 0) });
    firstPage.drawText('TEST AGENT', { x: 80, y: height - 695, size, font, color: rgb(0, 0, 0) });

    const pdfBytes = await pdfDoc.save();
    expect(pdfBytes.length).toBeGreaterThan(1000);
    expect(new TextDecoder().decode(pdfBytes.slice(0, 5))).toBe('%PDF-');
  });
});
