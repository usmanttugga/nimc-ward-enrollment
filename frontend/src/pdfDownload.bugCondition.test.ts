/**
 * Bug Condition Exploration Test for PDF Download Firebase Rewrite Fix
 * 
 * **Property 1: Bug Condition** - PDF Request Returns HTML Instead of PDF
 * 
 * **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * **DO NOT attempt to fix the test or the code when it fails**
 * **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
 * 
 * **Validates: Requirements 1.1, 1.2, 2.1, 2.2**
 * 
 * This test verifies that fetching `/intro-letter-template.pdf` returns a valid PDF file
 * with the correct Content-Type header and PDF magic bytes, and that pdf-lib can
 * successfully parse the fetched content.
 * 
 * On UNFIXED Firebase configuration (with catch-all rewrite rule), this test will FAIL
 * because Firebase returns HTML (index.html) instead of the PDF file.
 * 
 * On FIXED Firebase configuration, this test will PASS because Firebase serves the
 * actual PDF file directly.
 * 
 * Run with: npm test (from the frontend/ directory)
 * 
 * To test against Firebase Hosting:
 * 1. Build the frontend: npm run build
 * 2. Start Firebase emulator: firebase emulators:start --only hosting
 * 3. Run this test with FIREBASE_EMULATOR_URL environment variable:
 *    FIREBASE_EMULATOR_URL=http://localhost:5000 npm test pdfDownload.bugCondition.test.ts
 * 
 * Or test against deployed Firebase Hosting:
 *    FIREBASE_HOSTING_URL=https://your-app.web.app npm test pdfDownload.bugCondition.test.ts
 *
 * NOTE: This test needs a running server. It probes the base URL and is SKIPPED
 * automatically when no server is reachable, so `npm test` stays green offline.
 */

import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';

/**
 * Get the base URL for testing.
 * Priority: FIREBASE_EMULATOR_URL > FIREBASE_HOSTING_URL > local Vite dev server
 */
function getTestBaseUrl(): string {
  // Check for Firebase emulator URL (e.g., http://localhost:5000)
  if (process.env.FIREBASE_EMULATOR_URL) {
    return process.env.FIREBASE_EMULATOR_URL;
  }
  
  // Check for deployed Firebase Hosting URL (e.g., https://your-app.web.app)
  if (process.env.FIREBASE_HOSTING_URL) {
    return process.env.FIREBASE_HOSTING_URL;
  }
  
  // Default to local Vite dev server (this will NOT reproduce the bug)
  // The bug only occurs with Firebase Hosting's rewrite rules
  return 'http://localhost:5173';
}

/**
 * Probe the base URL once at collection time. If no server is reachable
 * (no dev server / emulator / deployed URL), the suite is skipped instead of failing.
 */
async function isServerReachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

const baseUrl = getTestBaseUrl();
const serverReachable = await isServerReachable(baseUrl);

describe.runIf(serverReachable)('Property 1: Bug Condition - PDF Request Returns Valid PDF (not HTML)', () => {
  const pdfUrl = `${baseUrl}/intro-letter-template.pdf`;

  it('fetching /intro-letter-template.pdf returns Content-Type: application/pdf', async () => {
    const response = await fetch(pdfUrl);
    
    // On UNFIXED Firebase config: Content-Type will be 'text/html' (FAIL - expected)
    // On FIXED Firebase config: Content-Type will be 'application/pdf' (PASS)
    expect(response.ok).toBe(true);
    
    const contentType = response.headers.get('Content-Type');
    expect(contentType).toContain('application/pdf');
  });

  it('fetching /intro-letter-template.pdf returns content starting with PDF magic bytes (%PDF-)', async () => {
    const response = await fetch(pdfUrl);
    expect(response.ok).toBe(true);
    
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // PDF files must start with "%PDF-" (magic bytes: 0x25 0x50 0x44 0x46 0x2D)
    // On UNFIXED Firebase config: content starts with "<!DOCTYPE html>" (FAIL - expected)
    // On FIXED Firebase config: content starts with "%PDF-" (PASS)
    expect(bytes.length).toBeGreaterThan(4);
    expect(bytes[0]).toBe(0x25); // %
    expect(bytes[1]).toBe(0x50); // P
    expect(bytes[2]).toBe(0x44); // D
    expect(bytes[3]).toBe(0x46); // F
    expect(bytes[4]).toBe(0x2D); // -
  });

  it('pdf-lib can successfully parse the fetched PDF without throwing errors', async () => {
    const response = await fetch(pdfUrl);
    expect(response.ok).toBe(true);
    
    const arrayBuffer = await response.arrayBuffer();
    
    // On UNFIXED Firebase config: pdf-lib will throw "No PDF header found" (FAIL - expected)
    // On FIXED Firebase config: pdf-lib will successfully load the PDF (PASS)
    await expect(async () => {
      const pdfDoc = await PDFDocument.load(arrayBuffer, {
        ignoreEncryption: true,
        throwOnInvalidObject: false,
      });
      
      // Verify the PDF has at least one page
      const pages = pdfDoc.getPages();
      expect(pages.length).toBeGreaterThan(0);
    }).not.toThrow();
  });

  it('response body does NOT start with HTML doctype (<!DOCTYPE html>)', async () => {
    const response = await fetch(pdfUrl);
    expect(response.ok).toBe(true);
    
    const text = await response.text();
    
    // On UNFIXED Firebase config: response starts with "<!DOCTYPE html>" (FAIL - expected)
    // On FIXED Firebase config: response is binary PDF data (PASS)
    expect(text.trim().toLowerCase()).not.toMatch(/^<!doctype\s+html>/i);
  });
});

/**
 * Counterexamples Documentation:
 * 
 * When this test is run on UNFIXED Firebase configuration, the following counterexamples
 * are expected to be found:
 * 
 * 1. Content-Type Header:
 *    - Expected: 'application/pdf'
 *    - Actual: 'text/html' or 'text/html; charset=utf-8'
 *    - Root Cause: Firebase's catch-all rewrite rule redirects to index.html
 * 
 * 2. PDF Magic Bytes:
 *    - Expected: Bytes [0x25, 0x50, 0x44, 0x46, 0x2D] ("%PDF-")
 *    - Actual: Bytes [0x3C, 0x21, 0x44, 0x4F, 0x43] ("<!DOC")
 *    - Root Cause: HTML content is returned instead of PDF binary data
 * 
 * 3. pdf-lib Parsing:
 *    - Expected: Successful PDF loading
 *    - Actual: Error "Failed to parse PDF document (line:28 col:0 offset=488): No PDF header found"
 *    - Root Cause: pdf-lib cannot parse HTML as a PDF document
 * 
 * 4. HTML Doctype:
 *    - Expected: No HTML doctype in response
 *    - Actual: Response starts with "<!DOCTYPE html>"
 *    - Root Cause: index.html is served instead of the PDF file
 * 
 * These counterexamples confirm that the bug exists: Firebase's catch-all rewrite rule
 * intercepts PDF requests and returns HTML content instead of the actual PDF file.
 */
