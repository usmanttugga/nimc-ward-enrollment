import { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { validateFile, generateIdCard } from '../idCardUtils';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface IdCardModalProps {
  /** Firebase Auth user — provides displayName for the card. */
  user: User;
  /** Firestore name field, used as fallback when displayName is absent. */
  firestoreName?: string;
  /** User role: "AGENT" | "AGGREGATOR" — determines the post title. */
  role: string;
  /** Called when the modal should close (cancel, backdrop click, Escape, or after download). */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function IdCardModal({ user, firestoreName, role, onClose }: IdCardModalProps) {
  // File state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);

  // Preview object URLs
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);

  // Per-field validation errors
  const [photoError, setPhotoError] = useState('');
  const [signatureError, setSignatureError] = useState('');

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [downloadCount, setDownloadCount] = useState(0); // tracks successful downloads
  // Refs to revoke object URLs on unmount
  const photoPreviewRef = useRef<string | null>(null);
  const signaturePreviewRef = useRef<string | null>(null);

  // Resolved display name
  const displayName = user.displayName ?? firestoreName ?? 'Unknown';

  // -------------------------------------------------------------------------
  // Escape key listener
  // -------------------------------------------------------------------------

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // -------------------------------------------------------------------------
  // Cleanup object URLs on unmount
  // -------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      if (photoPreviewRef.current) URL.revokeObjectURL(photoPreviewRef.current);
      if (signaturePreviewRef.current) URL.revokeObjectURL(signaturePreviewRef.current);
    };
  }, []);

  // -------------------------------------------------------------------------
  // File selection handlers
  // -------------------------------------------------------------------------

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = validateFile(file);
    if (!result.valid) {
      setPhotoError(result.error);
      // Do NOT update file state
      e.target.value = '';
      return;
    }

    // Revoke previous preview URL
    if (photoPreviewRef.current) {
      URL.revokeObjectURL(photoPreviewRef.current);
    }

    const url = URL.createObjectURL(file);
    photoPreviewRef.current = url;
    setPhotoFile(file);
    setPhotoPreview(url);
    setPhotoError('');
  }

  function handleSignatureChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = validateFile(file);
    if (!result.valid) {
      setSignatureError(result.error);
      // Do NOT update file state
      e.target.value = '';
      return;
    }

    // Revoke previous preview URL
    if (signaturePreviewRef.current) {
      URL.revokeObjectURL(signaturePreviewRef.current);
    }

    const url = URL.createObjectURL(file);
    signaturePreviewRef.current = url;
    setSignatureFile(file);
    setSignaturePreview(url);
    setSignatureError('');
  }

  // -------------------------------------------------------------------------
  // Generate & download
  // -------------------------------------------------------------------------

  async function handleGenerate() {
    // Validate both fields are present
    let hasError = false;
    if (!photoFile) {
      setPhotoError('Please upload a passport photo.');
      hasError = true;
    }
    if (!signatureFile) {
      setSignatureError('Please upload a signature image.');
      hasError = true;
    }
    if (hasError) return;

    setError('');
    setGenerating(true);

    try {
      const { dataUrl, filename } = await generateIdCard(
        displayName,
        role,
        photoFile!,
        signatureFile!,
      );

      // Trigger download via a temporary <a> element
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Increment download count — modal stays open so user can download again
      setDownloadCount(c => c + 1);

      // NOTE: Do NOT call onClose() here — user may want to download again.
      // Preview object URLs are kept alive so the same files can be re-used.
    } catch (err: any) {
      setError(`Failed to generate ID card: ${err?.message ?? String(err)}`);
    } finally {
      setGenerating(false);
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    /* Full-screen backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
    >
      {/* Modal panel — stop propagation so clicks inside don't close the modal */}
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800">🪪 Download ID Card</h2>
          <p className="text-sm text-gray-500 mt-0.5">Upload your photo and signature to generate your ID card.</p>
        </div>

        {/* Name on Card (read-only) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name on Card</label>
          <input
            type="text"
            value={displayName}
            disabled
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500"
          />
        </div>

        {/* Passport Photo upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Passport Photo <span className="text-gray-400 font-normal">(image, max 5 MB)</span>
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer"
          />
          {photoError && (
            <p className="mt-1 text-xs text-red-600">{photoError}</p>
          )}
          {photoPreview && (
            <img
              src={photoPreview}
              alt="Passport photo preview"
              className="mt-2 h-20 w-20 object-cover rounded-lg border border-gray-200"
            />
          )}
        </div>

        {/* Holder's Signature upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Holder's Signature <span className="text-gray-400 font-normal">(image, max 5 MB)</span>
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleSignatureChange}
            className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer"
          />
          {signatureError && (
            <p className="mt-1 text-xs text-red-600">{signatureError}</p>
          )}
          {signaturePreview && (
            <img
              src={signaturePreview}
              alt="Signature preview"
              className="mt-2 h-14 max-w-[200px] object-contain rounded-lg border border-gray-200 bg-gray-50 p-1"
            />
          )}
        </div>

        {/* Compositing error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {/* Success banner — shown after each successful download */}
        {downloadCount > 0 && !error && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-3 py-2 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            ID card downloaded successfully! You can download it again below.
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="flex-1 bg-teal-700 hover:bg-teal-800 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60 text-sm flex items-center justify-center gap-2"
          >
            {generating ? (
              <>
                {/* Spinner */}
                <svg
                  className="animate-spin h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating...
              </>
            ) : (
              downloadCount > 0 ? '⬇ Download Again' : 'Generate ID Card'
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={generating}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60 text-sm"
          >
            {downloadCount > 0 ? 'Close' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}
