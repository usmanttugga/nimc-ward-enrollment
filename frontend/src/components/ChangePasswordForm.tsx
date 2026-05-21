import { useState } from 'react';
import {
  User,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import { validatePasswordChange } from '../utils/passwordValidation';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChangePasswordFormProps {
  /** Firebase Auth User object — provides email for reauthentication. */
  user: User;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ChangePasswordForm({ user }: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // -------------------------------------------------------------------------
  // Submit handler
  // -------------------------------------------------------------------------

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Clear previous messages
    setError('');
    setSuccess('');

    // Client-side validation — no Firebase call if invalid
    const validation = validatePasswordChange(newPassword, confirmPassword);
    if (!validation.valid) {
      setError(validation.message ?? 'Invalid password.');
      return;
    }

    setSubmitting(true);

    try {
      // Step 1: Reauthenticate with current password
      const credential = EmailAuthProvider.credential(user.email!, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Step 2: Update to new password
      await updatePassword(user, newPassword);

      // Success — clear all fields
      setSuccess('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const code: string = err?.code ?? '';

      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Current password is incorrect.');
      } else if (code.includes('network')) {
        setError('A network error occurred. Please try again.');
      } else {
        setError(err?.message ?? 'An unexpected error occurred.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="mt-6 border-t border-gray-200 pt-6">
      <h3 className="text-base font-semibold text-gray-800 mb-4">Change Password</h3>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        {/* Current Password */}
        <div>
          <label
            htmlFor="currentPassword"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Current Password
          </label>
          <input
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>

        {/* New Password */}
        <div>
          <label
            htmlFor="newPassword"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            New Password
          </label>
          <input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>

        {/* Confirm Password */}
        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {/* Success message */}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-3 py-2 flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            {success}
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={submitting}
          className="bg-teal-700 hover:bg-teal-800 text-white font-medium py-2.5 px-5 rounded-lg transition-colors disabled:opacity-60 text-sm flex items-center gap-2"
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
              Changing Password...
            </>
          ) : (
            'Change Password'
          )}
        </button>
      </form>
    </div>
  );
}
