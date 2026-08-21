/**
 * idCardUtils.ts
 *
 * Pure utility module for ID card generation.
 * No React, no Firebase, no side effects — all functions are independently testable.
 *
 * Coordinate constants are calibrated to the actual template PNG dimensions:
 * frontend/public/id-card-template.png — 1929 × 1463 px
 * The template shows both front (left half, x: 0–964) and back (right half) side by side.
 */

// ---------------------------------------------------------------------------
// Coordinate constants
// ---------------------------------------------------------------------------

/**
 * Coordinate constants calibrated to the template PNG: 1929 × 1463 px.
 * Front half occupies x: 0–964, full height 1463.
 *
 * Corrected from actual output screenshot:
 * - Photo was appearing too high (covering address text) and too far left
 * - Applied +120px X offset and +204px Y offset to photo
 * - Name/Post adjusted to sit below the photo circle
 */

/** Bounding box for the circular passport photo area on the card front. */
export const PHOTO_BOUNDS: { x: number; y: number; width: number; height: number } = {
  x: 440,
  y: 550,   // midpoint between 520 (too high) and 580 (too low)
  width: 370,
  height: 370,
};

/** Top-left anchor for the NAME label+value row. */
export const NAME_POSITION: { x: number; y: number } = {
  x: 200,   // shifted right +50
  y: 1100,
};

/** Top-left anchor for the POST label+value row. */
export const POST_POSITION: { x: number; y: number } = {
  x: 200,   // shifted right +50
  y: 1185,
};

/** Bounding box for the signature image — centered in the front half (width 964). */
export const SIGNATURE_BOUNDS: { x: number; y: number; width: number; height: number } = {
  x: 182,
  y: 1265,  // shifted up 5px
  width: 300,
  height: 90,
};

// ---------------------------------------------------------------------------
// Role → post title mapping
// ---------------------------------------------------------------------------

/**
 * Map a user role string to the post title printed on the ID card.
 *
 * - "AGENT"       → "Enrollment Officer"
 * - "AGGREGATOR"  → "Aggregator"
 * - anything else → "Member"
 */
export function getIdCardPost(role: string): string {
  if (role === 'AGENT') return 'Enrollment Officer';
  if (role === 'AGGREGATOR') return 'Aggregator';
  return 'Member';
}

// ---------------------------------------------------------------------------
// Filename builder
// ---------------------------------------------------------------------------

/**
 * Build the download filename for the generated ID card PNG.
 *
 * Steps:
 * 1. Replace all whitespace sequences with hyphens.
 * 2. Strip characters that are not alphanumeric or hyphens.
 * 3. Wrap with "ID-Card-" prefix and ".png" suffix.
 * 4. Fall back to "ID-Card-Member.png" if the sanitised name is empty.
 */
export function buildIdCardFilename(name: string): string {
  const sanitised = name
    .replace(/\s+/g, '-')          // whitespace sequences → hyphens
    .replace(/[^a-zA-Z0-9-]/g, ''); // strip non-alphanumeric, non-hyphen

  if (!sanitised) return 'ID-Card-Member.png';
  return `ID-Card-${sanitised}.png`;
}

// ---------------------------------------------------------------------------
// Image loader
// ---------------------------------------------------------------------------

/**
 * Load an image from a URL string or a File object and return a resolved
 * HTMLImageElement.
 *
 * - For File inputs, creates an object URL via URL.createObjectURL and revokes
 *   it after the image has loaded to avoid memory leaks.
 * - Rejects with a descriptive error message if loading fails.
 */
export function loadImage(src: string | File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let objectUrl: string | null = null;

    img.onload = () => {
      if (objectUrl !== null) {
        URL.revokeObjectURL(objectUrl);
      }
      resolve(img);
    };

    img.onerror = () => {
      if (objectUrl !== null) {
        URL.revokeObjectURL(objectUrl);
      }
      const label = src instanceof File ? src.name : String(src);
      reject(new Error(`Failed to load image: "${label}"`));
    };

    if (src instanceof File) {
      objectUrl = URL.createObjectURL(src);
      img.src = objectUrl;
    } else {
      img.src = src;
    }
  });
}

// ---------------------------------------------------------------------------
// File validation
// ---------------------------------------------------------------------------

/**
 * Validate a file before it is used in compositing.
 *
 * Accepts the file if and only if:
 *   - MIME type starts with "image/"
 *   - size in bytes is ≤ 5 × 1024 × 1024 (5 MB)
 *
 * Exported so it can be tested independently and reused by the modal component.
 */
export function validateFile(file: { type: string; size: number }): {
  valid: boolean;
  error: string;
} {
  const MAX_SIZE = 5 * 1024 * 1024;

  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'Only image files are accepted.' };
  }
  if (file.size > MAX_SIZE) {
    return { valid: false, error: 'File size must not exceed 5 MB.' };
  }
  return { valid: true, error: '' };
}

// ---------------------------------------------------------------------------
// ID card compositing
// ---------------------------------------------------------------------------

/**
 * Composite the ID card and return the PNG data URL plus the download filename.
 *
 * Drawing order:
 *   1. Template image at (0, 0) — full canvas size
 *   2. Passport photo clipped to a circle defined by PHOTO_BOUNDS
 *   3. User's full name at NAME_POSITION
 *   4. Post title (derived from role) at POST_POSITION
 *   5. Signature image scaled to fit SIGNATURE_BOUNDS
 *
 * Rejects with a descriptive error if any asset fails to load or if the
 * canvas is tainted.
 */
export async function generateIdCard(
  userName: string,
  role: string,
  photoFile: File,
  signatureFile: File,
): Promise<{ dataUrl: string; filename: string }> {
  // Load all three images in parallel for speed
  const [template, photo, signature] = await Promise.all([
    loadImage('/id-card-template.png'),
    loadImage(photoFile),
    loadImage(signatureFile),
  ]);

  // Create an off-screen canvas sized to the template
  const canvas = document.createElement('canvas');
  canvas.width = template.naturalWidth;
  canvas.height = template.naturalHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to obtain 2D canvas context.');
  }

  // 1. Draw the template
  ctx.drawImage(template, 0, 0);

  // 2. Draw the passport photo clipped to a circle
  const { x: px, y: py, width: pw, height: ph } = PHOTO_BOUNDS;
  const centerX = px + pw / 2;
  const centerY = py + ph / 2;
  const radius = Math.min(pw, ph) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(photo, px, py, pw, ph);
  ctx.restore();

  // 3. Draw "NAME:" label in bold red + name value in black — left aligned
  ctx.save();
  ctx.font = 'bold 52px Arial, sans-serif';
  ctx.fillStyle = '#cc0000';
  ctx.fillText('NAME:', NAME_POSITION.x, NAME_POSITION.y);
  const nameLabelWidth = ctx.measureText('NAME:').width;
  ctx.fillStyle = '#1a1a1a';
  ctx.fillText(userName, NAME_POSITION.x + nameLabelWidth + 12, NAME_POSITION.y);
  ctx.restore();

  // 4. Draw "POST:" label in bold red + post value in bold black — left aligned
  ctx.save();
  ctx.font = 'bold 52px Arial, sans-serif';
  ctx.fillStyle = '#cc0000';
  ctx.fillText('POST:', POST_POSITION.x, POST_POSITION.y);
  const postLabelWidth = ctx.measureText('POST:').width;
  ctx.fillStyle = '#1a1a1a';
  ctx.fillText(getIdCardPost(role), POST_POSITION.x + postLabelWidth + 12, POST_POSITION.y);
  ctx.restore();

  // 5. Draw the signature image — centered horizontally in the front half
  const { y: sy, width: sw, height: sh } = SIGNATURE_BOUNDS;
  const frontHalfWidth = Math.floor(canvas.width / 2);
  const sx = Math.floor((frontHalfWidth - sw) / 2); // true center of front half
  ctx.drawImage(signature, sx, sy, sw, sh);

  // Export as PNG
  const dataUrl = canvas.toDataURL('image/png');
  const filename = buildIdCardFilename(userName);

  return { dataUrl, filename };
}
