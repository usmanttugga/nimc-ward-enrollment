import * as admin from 'firebase-admin';

/**
 * Initialize the Firebase Admin SDK singleton.
 *
 * Credential resolution order:
 *  1. GOOGLE_APPLICATION_CREDENTIALS — standard env var pointing to a service
 *     account JSON file on disk; firebase-admin picks this up automatically
 *     when no explicit credential is passed to initializeApp().
 *  2. FIREBASE_SERVICE_ACCOUNT_JSON — a JSON string containing the service
 *     account object, useful in environments where mounting a file is not
 *     practical (e.g. CI/CD secrets, container environments).
 *
 * Guards against double-initialization by checking admin.apps.length.
 *
 * Requirements: 4.8, 5.8
 */
function createApp(): admin.app.App {
  // Already initialized — return the existing default app.
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (jsonEnv) {
    // Parse the JSON string and use it as an explicit credential.
    let serviceAccount: admin.ServiceAccount;
    try {
      serviceAccount = JSON.parse(jsonEnv) as admin.ServiceAccount;
    } catch (err) {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT_JSON is set but contains invalid JSON: ' +
          (err instanceof Error ? err.message : String(err))
      );
    }
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  // Fall back to GOOGLE_APPLICATION_CREDENTIALS (file path).
  // firebase-admin resolves this env var automatically when no credential
  // option is provided, so we can call initializeApp() with no arguments.
  return admin.initializeApp();
}

export const firebaseAdmin: admin.app.App = createApp();

/** Pre-built Auth client for use by route handlers. */
export const adminAuth: admin.auth.Auth = firebaseAdmin.auth();
