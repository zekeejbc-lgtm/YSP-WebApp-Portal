/**
 * Environment variable validation
 * Called at app startup to detect missing configuration early.
 *
 * Required vars (GAS API URLs) will show a console error.
 * Optional vars (Firebase) will show a console warn.
 */

/** GAS API URLs — the app cannot function without these */
const REQUIRED_ENV_VARS = [
  'VITE_GAS_HOMEPAGE_API_URL',
  'VITE_GAS_LOGIN_API_URL',
  'VITE_GAS_EVENTS_API_URL',
  'VITE_GAS_SYSTEM_TOOLS_API_URL',
  'VITE_GAS_NOTIFICATIONS_API_URL',
  'VITE_GAS_ISSUANCE_API_URL',
  'VITE_GAS_FEEDBACK_API_URL',
  'VITE_GAS_CHATBOT_API_URL',
  'VITE_GAS_API_KEY',
] as const;

/** Firebase vars — push notifications won't work but app still loads */
const OPTIONAL_ENV_VARS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_FIREBASE_VAPID_KEY',
  'VITE_FIREBASE_SDK_VERSION',
] as const;

export function validateEnv(): void {
  const missingRequired: string[] = [];
  const missingOptional: string[] = [];

  for (const key of REQUIRED_ENV_VARS) {
    const value = import.meta.env[key];
    if (!value || value === '' || value.includes('YOUR_')) {
      missingRequired.push(key);
    }
  }

  for (const key of OPTIONAL_ENV_VARS) {
    const value = import.meta.env[key];
    if (!value || value === '' || value.includes('YOUR_')) {
      missingOptional.push(key);
    }
  }

  if (missingRequired.length > 0) {
    console.error(
      `[ENV] Missing required environment variables:\n  - ${missingRequired.join('\n  - ')}\n` +
      'Copy .env.example to .env and fill in the values. See MANUAL_SETUP_GUIDE.md.',
    );
  }

  if (missingOptional.length > 0) {
    console.warn(
      `[ENV] Missing optional environment variables (push notifications disabled):\n  - ${missingOptional.join('\n  - ')}`,
    );
  }
}
