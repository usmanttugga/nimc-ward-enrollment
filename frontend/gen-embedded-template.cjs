// One-off script: embeds public/intro-letter-template.pdf as a base64 TS module.
const { readFileSync, writeFileSync, mkdirSync } = require('fs');
const { join } = require('path');

const b64 = readFileSync(join(__dirname, 'public', 'intro-letter-template.pdf')).toString('base64');

const content = `/**
 * Embedded base64 copy of \`public/intro-letter-template.pdf\`.
 *
 * WHY THIS EXISTS:
 * The template used to be loaded at runtime via \`fetch('/intro-letter-template.pdf')\`.
 * On Firebase Hosting, if the file is missing from the deployed \`dist\` folder, the
 * catch-all rewrite rule serves \`index.html\` instead (HTTP 200). pdf-lib then fails
 * with: "Failed to parse PDF document ... No PDF header found".
 * Embedding the template in the JS bundle guarantees it is always available,
 * regardless of hosting configuration or deployment contents.
 *
 * To update the template: replace \`public/intro-letter-template.pdf\`, then regenerate
 * this file (see frontend/gen-embedded-template.cjs).
 */
export const INTRO_LETTER_TEMPLATE_BASE64 =
  '${b64}';

/** Decode the embedded template into bytes ready for \`PDFDocument.load()\`. */
export function getIntroLetterTemplateBytes(): Uint8Array {
  const binary = atob(INTRO_LETTER_TEMPLATE_BASE64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
`;

mkdirSync(join(__dirname, 'src', 'assets'), { recursive: true });
writeFileSync(join(__dirname, 'src', 'assets', 'introLetterTemplate.ts'), content, 'utf8');
console.log('Wrote src/assets/introLetterTemplate.ts (' + content.length + ' chars)');
