import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { validatePasswordChange } from '../utils/passwordValidation';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SetPasswordModalProps {
  /** The target user whose password will be reset. */
  target: { uid: string; name: string; role: 'AGENT' | 'AGGREGATOR' };
  /** The currently logged-in admin user (kept for API compatibility). */
  adminUser: User;
  /** Called when the modal should close (cancel, backdrop click, Escape, or after success). */
  onClose: () => void;
  /** Called with the target's name after a successful password reset. */
  onSuccess: (name: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SetPasswordModal({ target, onClose, onSuccess }: SetPasswordModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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
  // Submit handler — calls the Firebase Cloud Function `updateUserPassword`
  // -------------------------------------------------------------------------

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Client-side validation
    const validation = validatePasswordChange(newPassword, confirmPassword);
    if (!validation.valid) {
      setError(validation.message ?? 'Invalid password.');
      return;
    }

    setSubmitting(true);

    try {
      const functions = getFunctions();
      const updateUserPassword = httpsCallable(functions, 'updateUserPassword');
      await updateUserPassword({ uid: target.uid, newPassword });

      onSuccess(target.name);
      onClose();
    } catch (err: any) {
      // Firebase Functions errors have a `code` property
      const code: string = err?.code ?? '';
      const message: string = err?.message ?? '';
      if (code === 'functions/unauthenticated') {
        setError('Your session has expired. Please log in again.');
      } else if (code === 'functions/permission-denied') {
        setError('You are not authorized to perform this action.');
      } else if (code === 'functions/not-found') {
        setError('Account not found in Firebase.');
      } else if (code === 'functions/invalid-argument') {
        setError(message || 'Invalid password.');
      } else if (code === 'functions/unavailable' || code === 'functions/internal') {
        setError('The password reset service is temporarily unavailable. Please try again later.');
      } else if (message.includes('not-found') || message.includes('404')) {
        setError('Password reset service not deployed yet. Please contact the administrator.');
      } else {
        setError(`Error: ${code || 'unknown'} — ${message || 'Please try again.'}`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const roleLabel = target.role === 'AGENT' ? 'Agent' : 'Aggregator';

  return (
    /* Full-screen backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
    >
      {/* Modal panel — stop propagation so clicks inside don't close the modal */}
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800">🔑 Set Password</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Set a new password for {roleLabel}{' '}
            <span className="font-medium text-gray-700">{target.name}</span>.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* New Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
              autoComplete="new-password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              required
              autoComplete="new-password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>

          {/* Inline error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-teal-700 hover:bg-teal-800 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60 text-sm flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Setting Password...
                </>
              ) : (
                'Set Password'
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
