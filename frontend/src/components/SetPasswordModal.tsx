import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { validatePasswordChange } from '../utils/passwordValidation';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SetPasswordModalProps {
  /** The target user whose password will be reset. */
  target: { uid: string; name: string; role: 'AGENT' | 'AGGREGATOR' };
  /** The currently logged-in admin user — used to obtain a fresh ID token. */
  adminUser: User;
  /** Called when the modal should close (cancel, backdrop click, Escape, or after success). */
  onClose: () => void;
  /** Called with the target's name after a successful password reset. */
  onSuccess: (name: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SetPasswordModal({ target, adminUser, onClose, onSuccess }: SetPasswordModalProps) {
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
  // Submit handler
  // -------------------------------------------------------------------------

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Client-side validation (Requirements 4.3, 4.4, 5.3, 5.4, 6.1, 6.2)
    const validation = validatePasswordChange(newPassword, confirmPassword);
    if (!validation.valid) {
      setError(validation.message ?? 'Invalid password.');
      return;
    }

    setSubmitting(true);

    try {
      // Get a fresh ID token (Requirement 7.3)
      const idToken = await adminUser.getIdToken();

      const backendUrl = import.meta.env.VITE_BACKEND_URL ?? '';
      const response = await fetch(`${backendUrl}/admin/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ uid: target.uid, newPassword }),
      });

      if (response.ok) {
        // Requirements 4.9, 5.9
        onSuccess(target.name);
        onClose();
        return;
      }

      // Map HTTP error codes to user-facing messages
      switch (response.status) {
        case 401:
          // Requirement 7.1
          setError('Your session has expired. Please log in again.');
          break;
        case 403:
          // Requirements 4.7, 5.7
          setError('You are not authorized to perform this action.');
          break;
        case 404:
          // Requirements 4.10, 5.10
          setError('Account not found in Firebase.');
          break;
        case 422: {
          // Requirement 6.3 — use the backend's error message
          let message = 'Invalid password.';
          try {
            const body = await response.json();
            if (body?.error) message = body.error;
          } catch {
            // ignore JSON parse errors
          }
          setError(message);
          break;
        }
        default:
          // Requirements 4.11, 5.11
          setError('An unexpected error occurred. Please try again.');
      }
    } catch {
      // Network or other unexpected error
      setError('An unexpected error occurred. Please try again.');
    } finally {
      // Requirement 7.5 — re-enable submit button after response
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
                  {/* Spinner */}
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
