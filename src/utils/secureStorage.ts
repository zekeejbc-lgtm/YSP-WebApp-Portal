/**
 * Secure Storage Utility
 * 
 * Provides encrypted sessionStorage with automatic encryption/decryption.
 * Data is obfuscated to prevent casual inspection via DevTools.
 * 
 * Features:
 * - AES-like XOR encryption with dynamic key derivation
 * - Base64 encoding for safe storage
 * - Session-scoped (clears on tab close)
 * - Optional localStorage support for persistent data that needs encryption
 * 
 * Security Notes:
 * - This provides obfuscation, not military-grade encryption
 * - Protects against: casual DevTools inspection, browser extensions reading plain text
 * - Does NOT protect against: determined attackers with source code access
 */

// =================== ENCRYPTION UTILITIES ===================

/**
 * Generate a pseudo-random key based on a seed string.
 * Uses a simple hash function to create consistent keys.
 */
function deriveKey(seed: string): number[] {
  const key: number[] = [];
  let hash = 0x811c9dc5; // FNV-1a offset basis
  
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  
  // Generate 32 bytes of key material
  for (let i = 0; i < 32; i++) {
    hash = Math.imul(hash, 0x45d9f3b);
    hash ^= hash >>> 16;
    key.push(Math.abs(hash) % 256);
  }
  
  return key;
}

/**
 * XOR-based encryption with key rotation
 */
function xorEncrypt(data: string, key: number[]): number[] {
  const encrypted: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const charCode = data.charCodeAt(i);
    const keyByte = key[i % key.length];
    // Add position-based scrambling for additional obfuscation
    const scramble = (i * 7 + 13) % 256;
    encrypted.push(charCode ^ keyByte ^ scramble);
  }
  return encrypted;
}

/**
 * XOR-based decryption (reverse of encrypt)
 */
function xorDecrypt(encrypted: number[], key: number[]): string {
  let decrypted = '';
  for (let i = 0; i < encrypted.length; i++) {
    const keyByte = key[i % key.length];
    const scramble = (i * 7 + 13) % 256;
    const charCode = encrypted[i] ^ keyByte ^ scramble;
    decrypted += String.fromCharCode(charCode);
  }
  return decrypted;
}

/**
 * Convert byte array to Base64 string
 */
function bytesToBase64(bytes: number[]): string {
  const binary = bytes.map(b => String.fromCharCode(b)).join('');
  return btoa(binary);
}

/**
 * Convert Base64 string to byte array
 */
function base64ToBytes(base64: string): number[] {
  const binary = atob(base64);
  return Array.from(binary, char => char.charCodeAt(0));
}

// =================== STORAGE KEY ===================

// Obfuscated key components - split to avoid easy searching
const KEY_PARTS = ['Y', 'S', 'P', '_', 'T', 'a', 'g', 'u', 'm', '_', '2', '0', '2', '6'];
const SEED = KEY_PARTS.join('') + '_' + (window.location.hostname || 'localhost');
const DERIVED_KEY = deriveKey(SEED);

// Prefix for encrypted values (to identify them)
const ENCRYPTED_PREFIX = '🔐'; // Unicode marker that's unlikely to appear naturally

// =================== SECURE STORAGE API ===================

export interface SecureStorageOptions {
  /** Use localStorage instead of sessionStorage (persists across sessions) */
  persistent?: boolean;
}

/**
 * Get the appropriate storage backend
 */
function getStorage(persistent: boolean): Storage {
  return persistent ? localStorage : sessionStorage;
}

/**
 * Encrypt and store a value
 */
export function secureSetItem(
  key: string, 
  value: string, 
  options: SecureStorageOptions = {}
): void {
  try {
    const storage = getStorage(options.persistent ?? false);
    
    // Encrypt the value
    const encrypted = xorEncrypt(value, DERIVED_KEY);
    const encoded = ENCRYPTED_PREFIX + bytesToBase64(encrypted);
    
    storage.setItem(key, encoded);
  } catch (error) {
    console.error(`[SecureStorage] Failed to set ${key}:`, error);
  }
}

/**
 * Retrieve and decrypt a value
 */
export function secureGetItem(
  key: string, 
  options: SecureStorageOptions = {}
): string | null {
  try {
    const storage = getStorage(options.persistent ?? false);
    const stored = storage.getItem(key);
    
    if (!stored) return null;
    
    // Check if it's encrypted (has our prefix)
    if (stored.startsWith(ENCRYPTED_PREFIX)) {
      const encoded = stored.slice(ENCRYPTED_PREFIX.length);
      const encrypted = base64ToBytes(encoded);
      return xorDecrypt(encrypted, DERIVED_KEY);
    }
    
    // Legacy: unencrypted data - return as-is but migrate on next write
    return stored;
  } catch (error) {
    console.error(`[SecureStorage] Failed to get ${key}:`, error);
    return null;
  }
}

/**
 * Remove a value from storage
 */
export function secureRemoveItem(
  key: string, 
  options: SecureStorageOptions = {}
): void {
  try {
    const storage = getStorage(options.persistent ?? false);
    storage.removeItem(key);
  } catch (error) {
    console.error(`[SecureStorage] Failed to remove ${key}:`, error);
  }
}

/**
 * Store a JSON object (automatically stringified and encrypted)
 */
export function secureSetJSON<T>(
  key: string, 
  value: T, 
  options: SecureStorageOptions = {}
): void {
  secureSetItem(key, JSON.stringify(value), options);
}

/**
 * Retrieve and parse a JSON object
 */
export function secureGetJSON<T>(
  key: string, 
  options: SecureStorageOptions = {}
): T | null {
  const stored = secureGetItem(key, options);
  if (!stored) return null;
  
  try {
    return JSON.parse(stored) as T;
  } catch (error) {
    console.error(`[SecureStorage] Failed to parse JSON from ${key}:`, error);
    return null;
  }
}

/**
 * Check if a key exists in storage
 */
export function secureHasItem(
  key: string, 
  options: SecureStorageOptions = {}
): boolean {
  const storage = getStorage(options.persistent ?? false);
  return storage.getItem(key) !== null;
}

// =================== BATCH OPERATIONS ===================

/**
 * Clear all session storage (on logout)
 */
export function clearSecureSessionStorage(): void {
  try {
    sessionStorage.clear();
  } catch (error) {
    console.error('[SecureStorage] Failed to clear session storage:', error);
  }
}

/**
 * Clear all YSP-related keys from both storages
 */
export function clearAllSecureStorage(): void {
  const yspPrefixes = ['ysp_', 'YSP_'];
  
  [sessionStorage, localStorage].forEach(storage => {
    const keysToRemove: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && yspPrefixes.some(prefix => key.startsWith(prefix))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => storage.removeItem(key));
  });
}

/**
 * Migrate existing unencrypted data to encrypted format
 * Call this on app init to upgrade existing stored data
 */
export function migrateToEncrypted(keys: string[], options: SecureStorageOptions = {}): void {
  const storage = getStorage(options.persistent ?? false);
  
  keys.forEach(key => {
    const value = storage.getItem(key);
    if (value && !value.startsWith(ENCRYPTED_PREFIX)) {
      // Re-save with encryption
      secureSetItem(key, value, options);
    }
  });
}

// =================== TYPE-SAFE CACHE HELPERS ===================

/**
 * Create a typed cache accessor for a specific data type
 */
export function createSecureCache<T>(
  key: string, 
  options: SecureStorageOptions = {}
) {
  return {
    get: (): T | null => secureGetJSON<T>(key, options),
    set: (value: T): void => secureSetJSON(key, value, options),
    remove: (): void => secureRemoveItem(key, options),
    exists: (): boolean => secureHasItem(key, options),
  };
}

// =================== CONSTANTS FOR STORAGE KEYS ===================

export const SECURE_STORAGE_KEYS = {
  // Session-scoped (cleared on logout/tab close)
  MEMBERS_CACHE: 'ysp_attendance_members',
  MEMBERS_CACHE_TS: 'ysp_attendance_members_ts',
  EVENTS_CACHE: 'ysp_events_cache',
  DIRECTORY_CACHE: 'ysp_directory_cache',
  DIRECTORY_ALL_CACHE: 'ysp_directory_all_cache',
  USER_PROFILE_CACHE: 'ysp_user_profile_cache',
  HOMEPAGE_CONTENT_CACHE: 'ysp_homepage_content_cache',
  HOMEPAGE_OTHER_CACHE: 'ysp_homepage_other_cache',
  PROJECTS_CACHE: 'ysp_projects_cache',
  ANNOUNCEMENTS_CACHE: 'ysp_announcements_cache',
  ANNOUNCEMENTS_READ_IDS: 'ysp_ann_read_ids',
  MEET_MEMBERS_CACHE: 'ysp_meet_members_cache',
  ID_CARD_CACHE: 'ysp_id_card_cache',
  PENDING_ATTENDANCE: 'ysp_pending_attendance',
  MAINTENANCE_STATE: 'ysp_maintenance_state',
  
  // Persistent (localStorage) - user preferences that should survive sessions
  REMEMBER_USERNAME: 'ysp_remember_username',
  REMEMBERED_USERNAME: 'ysp_remembered_username',
  RECENT_USERNAMES: 'ysp_recent_usernames',
  LAST_USERNAME: 'ysp_last_username',
  APP_BADGE_COUNT: 'ysp-app-badge-count',
  PWA_DISMISS: 'ysp_pwa_dismiss',
  PWA_SEEN: 'ysp_pwa_seen',
  PUSH_DISMISS: 'ysp_push_dismiss',
  PUSH_ENABLED: 'ysp_push_enabled',
  LAST_VIEW: 'ysp_last_view',
  LAST_SCROLL: 'ysp_last_scroll',
} as const;

export default {
  setItem: secureSetItem,
  getItem: secureGetItem,
  removeItem: secureRemoveItem,
  setJSON: secureSetJSON,
  getJSON: secureGetJSON,
  hasItem: secureHasItem,
  clearSession: clearSecureSessionStorage,
  clearAll: clearAllSecureStorage,
  migrate: migrateToEncrypted,
  createCache: createSecureCache,
  KEYS: SECURE_STORAGE_KEYS,
};
