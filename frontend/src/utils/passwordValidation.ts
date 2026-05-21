// Password validation utility — pure, side-effect-free, and testable.
// No Firebase or DOM imports; operates on plain string values.

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/** Result returned by validatePasswordChange. */
export interface PasswordValidationResult {
  valid: boolean;
  error?: 'too-short' | 'too-long' | 'mismatch';
  message?: string;
}

// ---------------------------------------------------------------------------
// Pure validation function
// ---------------------------------------------------------------------------

/**
 * Validate a new password and its confirmation value.
 *
 * Rules are checked in order:
 * 1. `newPassword.length < 6`  → `too-short`
 * 2. `newPassword.length > 128` → `too-long`
 * 3. `newPassword !== confirmPassword` → `mismatch`
 * 4. Otherwise → `{ valid: true }`
 *
 * @param newPassword     - The candidate new password entered by the user.
 * @param confirmPassword - The confirmation value that must match `newPassword`.
 * @returns A {@link PasswordValidationResult} describing whether the input is valid.
 *
 * @example
 * validatePasswordChange('abc', 'abc')
 * // { valid: false, error: 'too-short', message: 'Password must be at least 6 characters.' }
 *
 * validatePasswordChange('secret', 'different')
 * // { valid: false, error: 'mismatch', message: 'Passwords do not match.' }
 *
 * validatePasswordChange('correct', 'correct')
 * // { valid: true }
 */
export function validatePasswordChange(
  newPassword: string,
  confirmPassword: string,
): PasswordValidationResult {
  if (newPassword.length < 6) {
    return {
      valid: false,
      error: 'too-short',
      message: 'Password must be at least 6 characters.',
    };
  }

  if (newPassword.length > 128) {
    return {
      valid: false,
      error: 'too-long',
      message: 'Password must be no more than 128 characters.',
    };
  }

  if (newPassword !== confirmPassword) {
    return {
      valid: false,
      error: 'mismatch',
      message: 'Passwords do not match.',
    };
  }

  return { valid: true };
}
