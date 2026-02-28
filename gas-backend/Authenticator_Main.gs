// =================== TOTP AUTHENTICATOR SERVICE ===================
// Dedicated 2FA storage in the same workbook, separate sheet.
//
// RUNBOOK (Functions to run in Apps Script editor)
// -------------------------------------------------
// 1) First-time setup (safe, idempotent)
//    - bootstrapTotpAll()
//      Creates/validates:
//      * Script Properties:
//        - TOTP_ENCRYPTION_KEY_B64
//        - TOTP_ENCRYPTION_KEY_VERSION
//      * Sheet:
//        - Authenticator_2FA (with required headers)
//      * Health check:
//        - returns success/healthy status
//
// 2) Verify setup/health anytime
//    - verifyTotpInfrastructureHealth()
//
// 3) Rotate key + preserve existing users (recommended rotation path)
//    - rotateTotpEncryptionKeyAndReencrypt('v2')
//      or provide your own key:
//    - rotateTotpEncryptionKeyAndReencrypt('v2', 'WEBSAFE_BASE64_KEY')
//      This decrypts existing secrets with old key and re-encrypts with new key.
//
// 4) Update key/version WITHOUT re-encrypting existing users (advanced/dangerous)
//    - updateTotpEncryptionProperties('v2')
//      Existing encrypted records may break unless users re-enroll.
//
// 5) Optional targeted setup steps
//    - setupTotpScriptProperties()
//    - setupTotpInfrastructure()
//
// Recommended testing order:
//   a) bootstrapTotpAll()
//   b) (optional) rotateTotpEncryptionKeyAndReencrypt('v2')
//   c) verifyTotpInfrastructureHealth()
//   d) Redeploy GAS Web App

const AUTH_2FA_SHEET_NAME = 'Authenticator_2FA';
const AUTH_2FA_HEADERS = [
  'Username',
  'Email',
  'Is_2FA_Enabled',
  'TOTP_Secret_Enc',
  'TOTP_Key_Version',
  'Created_At',
  'Updated_At',
  'Last_Rotated_At'
];

const TOTP_PROP_KEY_B64 = 'TOTP_ENCRYPTION_KEY_B64';
const TOTP_PROP_KEY_VER = 'TOTP_ENCRYPTION_KEY_VERSION';

const TOTP_TIME_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;
const TOTP_ALLOWED_DRIFT_STEPS = 1;

const TOTP_ENROLL_CACHE_PREFIX = 'totp_enroll_';
const TOTP_RESET_CACHE_PREFIX = 'totp_reset_';
const TOTP_SETUP_CACHE_TTL_SECONDS = 10 * 60;

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function normalize2FAUsername_(username) {
  return String(username || '').toLowerCase().trim();
}

function normalizeBoolean_(value) {
  if (typeof value === 'boolean') return value;
  const text = String(value || '').toLowerCase().trim();
  return text === 'true' || text === '1' || text === 'yes';
}

function safeJsonParse_(raw) {
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function bytesToWebSafeBase64_(bytes) {
  return Utilities.base64EncodeWebSafe(bytes);
}

function webSafeBase64ToBytes_(text) {
  return Utilities.base64DecodeWebSafe(String(text || ''));
}

function utf8ToBytes_(text) {
  return Utilities.newBlob(String(text || ''), 'text/plain').getBytes();
}

function bytesToUtf8_(bytes) {
  return Utilities.newBlob(bytes).getDataAsString();
}

function constantTimeEquals_(a, b) {
  const left = String(a || '');
  const right = String(b || '');
  const maxLen = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (var i = 0; i < maxLen; i++) {
    const lc = i < left.length ? left.charCodeAt(i) : 0;
    const rc = i < right.length ? right.charCodeAt(i) : 0;
    diff |= lc ^ rc;
  }
  return diff === 0;
}

function xorBytes_(a, b) {
  const out = [];
  const len = Math.min(a.length, b.length);
  for (var i = 0; i < len; i++) {
    out.push((a[i] ^ b[i]) & 0xFF);
  }
  return out;
}

function concatBytes_(a, b) {
  return a.concat(b);
}

function computeHmacSha256Bytes_(keyBytes, messageBytes) {
  return Utilities.computeHmacSignature(
    Utilities.MacAlgorithm.HMAC_SHA_256,
    messageBytes,
    keyBytes
  );
}

function deriveKeystream_(encKeyBytes, nonceBytes, length) {
  const output = [];
  let counter = 0;
  while (output.length < length) {
    const msg = concatBytes_(nonceBytes, utf8ToBytes_(String(counter)));
    const block = computeHmacSha256Bytes_(encKeyBytes, msg);
    for (var i = 0; i < block.length && output.length < length; i++) {
      output.push(block[i] & 0xFF);
    }
    counter++;
  }
  return output;
}

function getTotpKeyMaterial_() {
  const props = PropertiesService.getScriptProperties();
  const keyB64 = props.getProperty(TOTP_PROP_KEY_B64);
  const keyVersion = props.getProperty(TOTP_PROP_KEY_VER) || 'v1';

  if (!keyB64) {
    throw new Error('Missing script property: ' + TOTP_PROP_KEY_B64);
  }

  const keyBytes = webSafeBase64ToBytes_(keyB64);
  if (!keyBytes || keyBytes.length < 32) {
    throw new Error('Invalid encryption key length. Expected >= 32 bytes.');
  }

  return {
    keyBytes: keyBytes,
    keyVersion: keyVersion
  };
}

function encryptTotpSecret_(plainSecret) {
  const material = getTotpKeyMaterial_();
  const nonceBytes = Utilities.getUuid().replace(/-/g, '').slice(0, 16).split('').map(function(ch) {
    return ch.charCodeAt(0) & 0xFF;
  });

  const plainBytes = utf8ToBytes_(String(plainSecret || ''));
  const keystream = deriveKeystream_(material.keyBytes, nonceBytes, plainBytes.length);
  const cipherBytes = xorBytes_(plainBytes, keystream);

  const macInput = concatBytes_(nonceBytes, cipherBytes);
  const macBytes = computeHmacSha256Bytes_(material.keyBytes, macInput);

  return {
    payload: 'v1.' + bytesToWebSafeBase64_(nonceBytes) + '.' + bytesToWebSafeBase64_(cipherBytes) + '.' + bytesToWebSafeBase64_(macBytes),
    keyVersion: material.keyVersion
  };
}

function encryptTotpSecretWithKey_(plainSecret, keyBytes, keyVersion) {
  const nonceBytes = Utilities.getUuid().replace(/-/g, '').slice(0, 16).split('').map(function(ch) {
    return ch.charCodeAt(0) & 0xFF;
  });

  const plainBytes = utf8ToBytes_(String(plainSecret || ''));
  const keystream = deriveKeystream_(keyBytes, nonceBytes, plainBytes.length);
  const cipherBytes = xorBytes_(plainBytes, keystream);
  const macInput = concatBytes_(nonceBytes, cipherBytes);
  const macBytes = computeHmacSha256Bytes_(keyBytes, macInput);

  return {
    payload: 'v1.' + bytesToWebSafeBase64_(nonceBytes) + '.' + bytesToWebSafeBase64_(cipherBytes) + '.' + bytesToWebSafeBase64_(macBytes),
    keyVersion: String(keyVersion || 'v1')
  };
}

function decryptTotpSecret_(payload) {
  const raw = String(payload || '').trim();
  if (!raw) {
    throw new Error('Encrypted payload is empty');
  }

  const parts = raw.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Unsupported encrypted payload format');
  }

  const nonceBytes = webSafeBase64ToBytes_(parts[1]);
  const cipherBytes = webSafeBase64ToBytes_(parts[2]);
  const macBytes = webSafeBase64ToBytes_(parts[3]);

  const material = getTotpKeyMaterial_();
  const expectedMac = computeHmacSha256Bytes_(material.keyBytes, concatBytes_(nonceBytes, cipherBytes));

  if (!constantTimeEquals_(bytesToWebSafeBase64_(macBytes), bytesToWebSafeBase64_(expectedMac))) {
    throw new Error('Encrypted payload integrity check failed');
  }

  const keystream = deriveKeystream_(material.keyBytes, nonceBytes, cipherBytes.length);
  const plainBytes = xorBytes_(cipherBytes, keystream);
  return bytesToUtf8_(plainBytes);
}

function decryptTotpSecretWithKey_(payload, keyBytes) {
  const raw = String(payload || '').trim();
  if (!raw) {
    throw new Error('Encrypted payload is empty');
  }

  const parts = raw.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Unsupported encrypted payload format');
  }

  const nonceBytes = webSafeBase64ToBytes_(parts[1]);
  const cipherBytes = webSafeBase64ToBytes_(parts[2]);
  const macBytes = webSafeBase64ToBytes_(parts[3]);
  const expectedMac = computeHmacSha256Bytes_(keyBytes, concatBytes_(nonceBytes, cipherBytes));

  if (!constantTimeEquals_(bytesToWebSafeBase64_(macBytes), bytesToWebSafeBase64_(expectedMac))) {
    throw new Error('Encrypted payload integrity check failed');
  }

  const keystream = deriveKeystream_(keyBytes, nonceBytes, cipherBytes.length);
  const plainBytes = xorBytes_(cipherBytes, keystream);
  return bytesToUtf8_(plainBytes);
}

function normalizeBase32Secret_(secret) {
  return String(secret || '').toUpperCase().replace(/\s+/g, '').replace(/=+$/g, '');
}

function decodeBase32_(secret) {
  const normalized = normalizeBase32Secret_(secret);
  if (!normalized) return [];

  let bits = 0;
  let value = 0;
  const output = [];

  for (var i = 0; i < normalized.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(normalized.charAt(i));
    if (idx < 0) {
      throw new Error('Invalid Base32 secret');
    }

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xFF);
      bits -= 8;
    }
  }

  return output;
}

function encodeBase32_(bytes) {
  let bits = 0;
  let value = 0;
  let output = '';

  for (var i = 0; i < bytes.length; i++) {
    value = (value << 8) | (bytes[i] & 0xFF);
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET.charAt((value >>> (bits - 5)) & 31);
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET.charAt((value << (5 - bits)) & 31);
  }

  return output;
}

function generateTotpSecret_(lengthChars) {
  const targetLen = Math.max(16, parseInt(lengthChars || '16', 10) || 16);
  const sourceBytes = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  const byteArray = [];
  for (var i = 0; i < sourceBytes.length; i++) {
    byteArray.push(sourceBytes.charCodeAt(i) & 0xFF);
  }
  const base32 = encodeBase32_(byteArray);
  return base32.substring(0, targetLen);
}

function buildOtpAuthUri_(email, secret) {
  const issuer = 'YSP Portal';
  const label = issuer + ':' + String(email || 'member');
  return 'otpauth://totp/' + encodeURIComponent(label)
    + '?secret=' + encodeURIComponent(secret)
    + '&issuer=' + encodeURIComponent(issuer)
    + '&algorithm=SHA1&digits=6&period=30';
}

function computeTotpAtStep_(secret, step) {
  const keyBytes = decodeBase32_(secret);
  if (!keyBytes.length) return null;

  const msgBytes = [];
  let value = Number(step);
  for (var i = 7; i >= 0; i--) {
    msgBytes[i] = value & 0xFF;
    value = Math.floor(value / 256);
  }

  const hmac = Utilities.computeHmacSignature(
    Utilities.MacAlgorithm.HMAC_SHA_1,
    msgBytes,
    keyBytes
  );

  const offset = hmac[hmac.length - 1] & 0x0F;
  const binary = ((hmac[offset] & 0x7F) << 24)
    | ((hmac[offset + 1] & 0xFF) << 16)
    | ((hmac[offset + 2] & 0xFF) << 8)
    | (hmac[offset + 3] & 0xFF);

  const code = binary % Math.pow(10, TOTP_DIGITS);
  return String(code).padStart(TOTP_DIGITS, '0');
}

function verifyTotpCode(secret, code) {
  const cleanCode = String(code || '').replace(/\D/g, '');
  if (cleanCode.length !== TOTP_DIGITS) return false;

  const now = Math.floor(Date.now() / 1000);
  const currentStep = Math.floor(now / TOTP_TIME_STEP_SECONDS);

  for (var drift = -TOTP_ALLOWED_DRIFT_STEPS; drift <= TOTP_ALLOWED_DRIFT_STEPS; drift++) {
    const expected = computeTotpAtStep_(secret, currentStep + drift);
    if (expected && constantTimeEquals_(expected, cleanCode)) {
      return true;
    }
  }

  return false;
}

function getAuth2FASheet_(ss) {
  const wb = ss || SpreadsheetApp.openById(LOGIN_SPREADSHEET_ID);
  return wb.getSheetByName(AUTH_2FA_SHEET_NAME);
}

function ensureAuth2FASheet_(ss) {
  const wb = ss || SpreadsheetApp.openById(LOGIN_SPREADSHEET_ID);
  let sheet = wb.getSheetByName(AUTH_2FA_SHEET_NAME);

  if (!sheet) {
    sheet = wb.insertSheet(AUTH_2FA_SHEET_NAME);
  }

  const range = sheet.getRange(1, 1, 1, AUTH_2FA_HEADERS.length);
  const currentHeaders = range.getValues()[0];

  let needsRewrite = false;
  for (var i = 0; i < AUTH_2FA_HEADERS.length; i++) {
    if (String(currentHeaders[i] || '').trim() !== AUTH_2FA_HEADERS[i]) {
      needsRewrite = true;
      break;
    }
  }

  if (needsRewrite) {
    range.setValues([AUTH_2FA_HEADERS]);
  }

  return sheet;
}

function getAuth2FAHeaderIndex_(headers) {
  const idx = {};
  for (var i = 0; i < headers.length; i++) {
    idx[String(headers[i] || '').trim()] = i;
  }
  return idx;
}

function get2FARowByUsername_(username, ss) {
  const normalized = normalize2FAUsername_(username);
  if (!normalized) return null;

  const sheet = getAuth2FASheet_(ss);
  if (!sheet) return null;

  const data = sheet.getDataRange().getValues();
  if (!data.length) return null;

  const idx = getAuth2FAHeaderIndex_(data[0]);
  const usernameIdx = idx.Username;
  if (usernameIdx === undefined) return null;

  for (var i = 1; i < data.length; i++) {
    const rowUsername = normalize2FAUsername_(data[i][usernameIdx]);
    if (rowUsername === normalized) {
      return {
        rowIndex: i + 1,
        row: data[i],
        idx: idx,
        sheet: sheet
      };
    }
  }

  return null;
}

function upsert2FARecord_(username, email, updates, ss) {
  const wb = ss || SpreadsheetApp.openById(LOGIN_SPREADSHEET_ID);
  const sheet = ensureAuth2FASheet_(wb);
  const data = sheet.getDataRange().getValues();
  const idx = getAuth2FAHeaderIndex_(data[0]);

  const normalizedUsername = normalize2FAUsername_(username);
  if (!normalizedUsername) {
    throw new Error('Username is required for 2FA record');
  }

  const now = new Date();
  let existing = null;

  for (var i = 1; i < data.length; i++) {
    if (normalize2FAUsername_(data[i][idx.Username]) === normalizedUsername) {
      existing = { rowIndex: i + 1, row: data[i] };
      break;
    }
  }

  const baseRow = existing ? existing.row.slice() : new Array(AUTH_2FA_HEADERS.length).fill('');
  baseRow[idx.Username] = normalizedUsername;
  baseRow[idx.Email] = String(email || baseRow[idx.Email] || '').trim();

  if (!existing) {
    baseRow[idx.Created_At] = now;
  }

  baseRow[idx.Updated_At] = now;

  if (updates && Object.prototype.hasOwnProperty.call(updates, 'is2FAEnabled')) {
    baseRow[idx.Is_2FA_Enabled] = !!updates.is2FAEnabled;
  }
  if (updates && Object.prototype.hasOwnProperty.call(updates, 'encryptedSecret')) {
    baseRow[idx.TOTP_Secret_Enc] = updates.encryptedSecret || '';
  }
  if (updates && Object.prototype.hasOwnProperty.call(updates, 'keyVersion')) {
    baseRow[idx.TOTP_Key_Version] = updates.keyVersion || '';
  }
  if (updates && Object.prototype.hasOwnProperty.call(updates, 'lastRotatedAt')) {
    baseRow[idx.Last_Rotated_At] = updates.lastRotatedAt || '';
  }

  if (existing) {
    sheet.getRange(existing.rowIndex, 1, 1, AUTH_2FA_HEADERS.length).setValues([baseRow]);
    return existing.rowIndex;
  }

  sheet.appendRow(baseRow);
  return sheet.getLastRow();
}

function set2FAEnabled_(username, email, enabled, ss) {
  return upsert2FARecord_(username, email, {
    is2FAEnabled: !!enabled,
    updatedAt: new Date()
  }, ss);
}

function rotate2FASecret_(username, email, plainSecret, ss) {
  const enc = encryptTotpSecret_(plainSecret);
  upsert2FARecord_(username, email, {
    is2FAEnabled: true,
    encryptedSecret: enc.payload,
    keyVersion: enc.keyVersion,
    lastRotatedAt: new Date()
  }, ss);
}

function clear2FASecret_(username, email, ss) {
  upsert2FARecord_(username, email, {
    is2FAEnabled: false,
    encryptedSecret: '',
    keyVersion: '',
    lastRotatedAt: ''
  }, ss);
}

function getUserProfileAuthRecord_(usernameOrEmail, ss) {
  const clean = String(usernameOrEmail || '').toLowerCase().trim();
  if (!clean) return null;

  const wb = ss || SpreadsheetApp.openById(LOGIN_SPREADSHEET_ID);
  const sheet = wb.getSheetByName(LOGIN_SHEET_NAME);
  if (!sheet) return null;

  const data = sheet.getDataRange().getValues();
  if (!data.length) return null;

  const headers = data[0];
  const idx = {
    username: headers.indexOf('Username'),
    email: headers.indexOf('Email Address'),
    password: headers.indexOf('Password'),
    salt: headers.indexOf('Salt'),
    name: headers.indexOf('Full name')
  };

  if (idx.username === -1 || idx.email === -1) return null;

  for (var i = 1; i < data.length; i++) {
    const rowUsername = String(data[i][idx.username] || '').toLowerCase().trim();
    const rowEmail = String(data[i][idx.email] || '').toLowerCase().trim();
    if (rowUsername === clean || rowEmail === clean) {
      return {
        username: String(data[i][idx.username] || '').trim(),
        email: String(data[i][idx.email] || '').trim(),
        fullName: idx.name > -1 ? String(data[i][idx.name] || 'Member') : 'Member',
        passwordHash: idx.password > -1 ? String(data[i][idx.password] || '').trim() : '',
        salt: idx.salt > -1 ? String(data[i][idx.salt] || '').trim() : ''
      };
    }
  }

  return null;
}

function verifyCurrentPasswordForUser_(username, currentPassword, ss) {
  const user = getUserProfileAuthRecord_(username, ss);
  if (!user) return { ok: false, reason: 'User not found' };
  if (!user.passwordHash) return { ok: false, reason: 'Password record not found' };

  if (!verifyPassword(currentPassword, user.passwordHash, user.salt)) {
    return { ok: false, reason: 'Current password is incorrect' };
  }

  return { ok: true, user: user };
}

function get2FAStateForUsername_(username, ss) {
  const user = getUserProfileAuthRecord_(username, ss);
  if (!user) {
    return {
      success: false,
      enabled: false,
      user: null,
      record: null,
      error: 'User not found'
    };
  }

  const rowInfo = get2FARowByUsername_(user.username, ss);
  if (!rowInfo) {
    return {
      success: true,
      enabled: false,
      user: user,
      record: null
    };
  }

  const idx = rowInfo.idx;
  const row = rowInfo.row;
  const loginEnabled = normalizeBoolean_(row[idx.Is_2FA_Enabled]);
  const encryptedSecret = String(row[idx.TOTP_Secret_Enc] || '').trim();
  const authenticatorLinked = !!encryptedSecret;

  return {
    success: true,
    enabled: loginEnabled && authenticatorLinked, // Backward-compatible alias for login enforcement.
    loginEnabled: loginEnabled && authenticatorLinked,
    authenticatorLinked: authenticatorLinked,
    user: user,
    record: {
      rowIndex: rowInfo.rowIndex,
      encryptedSecret: encryptedSecret,
      keyVersion: String(row[idx.TOTP_Key_Version] || '').trim(),
      email: String(row[idx.Email] || user.email || '').trim()
    }
  };
}

function cacheTotpSetupSession_(prefix, username, payload) {
  const cache = CacheService.getScriptCache();
  cache.put(prefix + normalize2FAUsername_(username), JSON.stringify(payload), TOTP_SETUP_CACHE_TTL_SECONDS);
}

function readTotpSetupSession_(prefix, username) {
  const cache = CacheService.getScriptCache();
  const raw = cache.get(prefix + normalize2FAUsername_(username));
  if (!raw) return null;
  return safeJsonParse_(raw);
}

function clearTotpSetupSession_(prefix, username) {
  const cache = CacheService.getScriptCache();
  cache.remove(prefix + normalize2FAUsername_(username));
}

function handleGet2FAStatus(username) {
  try {
    if (!username) {
      return createErrorResponse('Username is required', 400);
    }

    const state = get2FAStateForUsername_(username);
    if (!state.success || !state.user) {
      return createErrorResponse(state.error || 'User not found', 404);
    }

    return createSuccessResponse({
      success: true,
      enabled: !!state.enabled,
      loginEnabled: !!state.loginEnabled,
      authenticatorLinked: !!state.authenticatorLinked,
      username: state.user.username,
      email: maskEmailValue_(state.user.email)
    });
  } catch (error) {
    Logger.log('handleGet2FAStatus Error: ' + error);
    return createErrorResponse('Failed to get 2FA status: ' + error.message, 500);
  }
}

function handleGenerateTotpEnrollment(username) {
  try {
    if (!username) {
      return createErrorResponse('Username is required', 400);
    }

    const user = getUserProfileAuthRecord_(username);
    if (!user) {
      return createErrorResponse('User not found', 404);
    }

    const secret = generateTotpSecret_(16);
    const otpAuthUri = buildOtpAuthUri_(user.email || user.username, secret);

    cacheTotpSetupSession_(TOTP_ENROLL_CACHE_PREFIX, user.username, {
      username: user.username,
      email: user.email,
      secret: secret,
      createdAt: new Date().toISOString()
    });

    return createSuccessResponse({
      success: true,
      secret: secret,
      otpAuthUri: otpAuthUri,
      expiresInSeconds: TOTP_SETUP_CACHE_TTL_SECONDS
    });
  } catch (error) {
    Logger.log('handleGenerateTotpEnrollment Error: ' + error);
    return createErrorResponse('Failed to generate authenticator setup: ' + error.message, 500);
  }
}

function handleEnrollUser2FA(username, code) {
  try {
    if (!username || !code) {
      return createErrorResponse('Username and authenticator code are required', 400);
    }

    const user = getUserProfileAuthRecord_(username);
    if (!user) {
      return createErrorResponse('User not found', 404);
    }

    const sessionData = readTotpSetupSession_(TOTP_ENROLL_CACHE_PREFIX, user.username);
    if (!sessionData || !sessionData.secret) {
      return createErrorResponse('Setup session expired. Generate a new QR code.', 410);
    }

    if (!verifyTotpCode(sessionData.secret, code)) {
      return createErrorResponse('Invalid authenticator code', 401);
    }

    rotate2FASecret_(user.username, user.email, sessionData.secret);
    clearTotpSetupSession_(TOTP_ENROLL_CACHE_PREFIX, user.username);

    return createSuccessResponse({
      success: true,
      enabled: true,
      message: 'Two-factor authentication enabled'
    });
  } catch (error) {
    Logger.log('handleEnrollUser2FA Error: ' + error);
    return createErrorResponse('Failed to enable 2FA: ' + error.message, 500);
  }
}

function handleDisableUser2FA(username, currentPassword, totpCode) {
  try {
    if (!username || !currentPassword || !totpCode) {
      return createErrorResponse('Username, current password, and authenticator code are required', 400);
    }

    const pwdCheck = verifyCurrentPasswordForUser_(username, currentPassword);
    if (!pwdCheck.ok) {
      return createErrorResponse(pwdCheck.reason, 401);
    }

    const state = get2FAStateForUsername_(username);
    if (!state.success || !state.user) {
      return createErrorResponse(state.error || 'User not found', 404);
    }

    if (!state.record || !state.record.encryptedSecret) {
      return createSuccessResponse({
        success: true,
        enabled: false,
        loginEnabled: false,
        authenticatorLinked: false,
        message: 'Authenticator is not configured for this account'
      });
    }

    if (!state.enabled) {
      return createSuccessResponse({
        success: true,
        enabled: false,
        loginEnabled: false,
        authenticatorLinked: true,
        message: 'Login authenticator challenge is already disabled'
      });
    }

    const secret = decryptTotpSecret_(state.record.encryptedSecret);
    if (!verifyTotpCode(secret, totpCode)) {
      return createErrorResponse('Invalid authenticator code', 401);
    }

    set2FAEnabled_(state.user.username, state.user.email, false);

    return createSuccessResponse({
      success: true,
      enabled: false,
      loginEnabled: false,
      authenticatorLinked: true,
      message: 'Two-factor login verification disabled. Authenticator remains linked for recovery and security actions.'
    });
  } catch (error) {
    Logger.log('handleDisableUser2FA Error: ' + error);
    return createErrorResponse('Failed to disable 2FA: ' + error.message, 500);
  }
}

function handleEnableUser2FA(username, currentPassword, totpCode) {
  try {
    if (!username || !currentPassword || !totpCode) {
      return createErrorResponse('Username, current password, and authenticator code are required', 400);
    }

    const pwdCheck = verifyCurrentPasswordForUser_(username, currentPassword);
    if (!pwdCheck.ok) {
      return createErrorResponse(pwdCheck.reason, 401);
    }

    const state = get2FAStateForUsername_(username);
    if (!state.success || !state.user) {
      return createErrorResponse(state.error || 'User not found', 404);
    }

    if (!state.record || !state.record.encryptedSecret) {
      return createErrorResponse('No authenticator is linked yet. Please enroll first.', 400);
    }

    const secret = decryptTotpSecret_(state.record.encryptedSecret);
    if (!verifyTotpCode(secret, totpCode)) {
      return createErrorResponse('Invalid authenticator code', 401);
    }

    set2FAEnabled_(state.user.username, state.user.email, true);

    return createSuccessResponse({
      success: true,
      enabled: true,
      loginEnabled: true,
      authenticatorLinked: true,
      message: 'Two-factor login verification enabled'
    });
  } catch (error) {
    Logger.log('handleEnableUser2FA Error: ' + error);
    return createErrorResponse('Failed to enable 2FA login challenge: ' + error.message, 500);
  }
}

function handleBeginTotpSecretReset(username, currentPassword, totpCode) {
  try {
    if (!username || !currentPassword || !totpCode) {
      return createErrorResponse('Username, current password, and authenticator code are required', 400);
    }

    const pwdCheck = verifyCurrentPasswordForUser_(username, currentPassword);
    if (!pwdCheck.ok || !pwdCheck.user) {
      return createErrorResponse(pwdCheck.reason || 'Current password is incorrect', 401);
    }

    const state = get2FAStateForUsername_(username);
    if (!state.success || !state.user || !state.authenticatorLinked || !state.record || !state.record.encryptedSecret) {
      return createErrorResponse('Authenticator must be linked before resetting secret', 400);
    }

    const currentSecret = decryptTotpSecret_(state.record.encryptedSecret);
    if (!verifyTotpCode(currentSecret, totpCode)) {
      return createErrorResponse('Invalid current authenticator code', 401);
    }

    const newSecret = generateTotpSecret_(16);
    const otpAuthUri = buildOtpAuthUri_(state.user.email || state.user.username, newSecret);

    cacheTotpSetupSession_(TOTP_RESET_CACHE_PREFIX, state.user.username, {
      username: state.user.username,
      email: state.user.email,
      secret: newSecret,
      createdAt: new Date().toISOString()
    });

    return createSuccessResponse({
      success: true,
      secret: newSecret,
      otpAuthUri: otpAuthUri,
      expiresInSeconds: TOTP_SETUP_CACHE_TTL_SECONDS
    });
  } catch (error) {
    Logger.log('handleBeginTotpSecretReset Error: ' + error);
    return createErrorResponse('Failed to start secret reset: ' + error.message, 500);
  }
}

function handleConfirmTotpSecretReset(username, code) {
  try {
    if (!username || !code) {
      return createErrorResponse('Username and authenticator code are required', 400);
    }

    const user = getUserProfileAuthRecord_(username);
    if (!user) {
      return createErrorResponse('User not found', 404);
    }

    const sessionData = readTotpSetupSession_(TOTP_RESET_CACHE_PREFIX, user.username);
    if (!sessionData || !sessionData.secret) {
      return createErrorResponse('Secret reset session expired. Start again.', 410);
    }

    if (!verifyTotpCode(sessionData.secret, code)) {
      return createErrorResponse('Invalid authenticator code', 401);
    }

    rotate2FASecret_(user.username, user.email, sessionData.secret);
    clearTotpSetupSession_(TOTP_RESET_CACHE_PREFIX, user.username);

    return createSuccessResponse({
      success: true,
      enabled: true,
      message: 'Authenticator secret reset successfully'
    });
  } catch (error) {
    Logger.log('handleConfirmTotpSecretReset Error: ' + error);
    return createErrorResponse('Failed to confirm secret reset: ' + error.message, 500);
  }
}

function handleVerifyPasswordResetTOTP(username, email, totpCode, lookupToken) {
  let cleanUsername = (username || '').toString().trim();
  let cleanEmail = (email || '').toString().trim();
  const cleanCode = (totpCode || '').toString().trim();
  const cleanLookupToken = (lookupToken || '').toString().trim();

  if (cleanLookupToken) {
    const tokenData = resolvePasswordResetLookupToken_(cleanLookupToken, cleanUsername);
    if (!tokenData) {
      return createErrorResponse('Reset lookup session expired. Please search your account again.', 401);
    }
    cleanUsername = tokenData.username;
    cleanEmail = tokenData.email;
  }

  if (!cleanUsername || !cleanEmail || !cleanCode) {
    return createErrorResponse('Username, email, and authenticator code are required', 400);
  }

  try {
    const failedInfo = getFailedAttempts(cleanUsername, cleanEmail);
    if (failedInfo.isLocked) {
      const lockTimeStr = failedInfo.lockedUntil ? failedInfo.lockedUntil.toLocaleTimeString() : 'later';
      return createErrorResponse(
        'Account temporarily locked due to too many failed verification attempts. Please try again after ' + lockTimeStr + '.',
        423
      );
    }

    const state = get2FAStateForUsername_(cleanUsername);
    if (!state.success || !state.user) {
      return createErrorResponse('User not found', 404);
    }

    if (state.user.email.toLowerCase() !== cleanEmail.toLowerCase()) {
      return createErrorResponse('Email does not match the account on file.', 403);
    }

    if (!state.authenticatorLinked || !state.record || !state.record.encryptedSecret) {
      return createErrorResponse('Authenticator is not enabled for this account.', 400);
    }

    const secret = decryptTotpSecret_(state.record.encryptedSecret);
    if (!verifyTotpCode(secret, cleanCode)) {
      const attemptResult = recordFailedAttempt(cleanUsername, cleanEmail);
      const remainingAttempts = MAX_FAILED_ATTEMPTS - attemptResult.attempts;

      if (attemptResult.isLocked) {
        return createErrorResponse(
          'Too many failed attempts. Account locked for ' + LOCKOUT_MINUTES + ' minutes.',
          423
        );
      }

      return createErrorResponse(
        'Invalid authenticator code. ' + remainingAttempts + ' attempts remaining.',
        401
      );
    }

    resetFailedAttempts(cleanUsername, cleanEmail);
    resetOTPRequestHistory(cleanUsername);

    const resetToken = createPasswordResetSession_(cleanUsername, cleanEmail);

    return createSuccessResponse({
      success: true,
      verified: true,
      message: 'Authenticator code verified',
      resetToken: resetToken
    });
  } catch (error) {
    Logger.log('handleVerifyPasswordResetTOTP Error: ' + error);
    return createErrorResponse('Failed to verify authenticator code: ' + error.message, 500);
  }
}

function setupTotpScriptProperties() {
  try {
    const props = PropertiesService.getScriptProperties();
    const result = {
      success: true,
      created: [],
      existing: []
    };

    let keyB64 = props.getProperty(TOTP_PROP_KEY_B64);
    if (!keyB64) {
      const rawBytes = Utilities.computeDigest(
        Utilities.DigestAlgorithm.SHA_256,
        Utilities.getUuid() + '|' + new Date().toISOString() + '|' + Math.random()
      );
      keyB64 = bytesToWebSafeBase64_(rawBytes);
      props.setProperty(TOTP_PROP_KEY_B64, keyB64);
      result.created.push(TOTP_PROP_KEY_B64);
    } else {
      result.existing.push(TOTP_PROP_KEY_B64);
    }

    let keyVer = props.getProperty(TOTP_PROP_KEY_VER);
    if (!keyVer) {
      keyVer = 'v1';
      props.setProperty(TOTP_PROP_KEY_VER, keyVer);
      result.created.push(TOTP_PROP_KEY_VER);
    } else {
      result.existing.push(TOTP_PROP_KEY_VER);
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

function generateTotpEncryptionKeyB64_() {
  const rawBytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    Utilities.getUuid() + '|' + new Date().toISOString() + '|' + Math.random()
  );
  return bytesToWebSafeBase64_(rawBytes);
}

/**
 * Update TOTP encryption Script Properties.
 * WARNING: Changing key material invalidates existing encrypted 2FA secrets unless they are re-encrypted.
 *
 * @param {string} newVersion - e.g. "v2"
 * @param {string=} newKeyB64 - Optional web-safe base64 key. Auto-generated when omitted.
 * @returns {Object} update result and safety warnings
 */
function updateTotpEncryptionProperties(newVersion, newKeyB64) {
  try {
    const version = String(newVersion || '').trim();
    if (!version) {
      return { success: false, error: 'newVersion is required (example: v2)' };
    }

    const ss = SpreadsheetApp.openById(LOGIN_SPREADSHEET_ID);
    const sheet = ensureAuth2FASheet_(ss);
    const data = sheet.getDataRange().getValues();
    const idx = getAuth2FAHeaderIndex_(data[0] || AUTH_2FA_HEADERS);

    let encryptedRecordsCount = 0;
    for (var i = 1; i < data.length; i++) {
      const enc = String(data[i][idx.TOTP_Secret_Enc] || '').trim();
      const enabled = normalizeBoolean_(data[i][idx.Is_2FA_Enabled]);
      if (enabled && enc) encryptedRecordsCount++;
    }

    const props = PropertiesService.getScriptProperties();
    const previousVersion = props.getProperty(TOTP_PROP_KEY_VER) || '';
    const previousKeyExists = !!props.getProperty(TOTP_PROP_KEY_B64);

    const keyB64 = String(newKeyB64 || '').trim() || generateTotpEncryptionKeyB64_();
    const keyBytes = webSafeBase64ToBytes_(keyB64);
    if (!keyBytes || keyBytes.length < 32) {
      return { success: false, error: 'Invalid new key. Provide web-safe base64 with >= 32 bytes decoded length.' };
    }

    props.setProperty(TOTP_PROP_KEY_B64, keyB64);
    props.setProperty(TOTP_PROP_KEY_VER, version);

    const warning = encryptedRecordsCount > 0
      ? 'Encryption key changed while existing encrypted 2FA records exist. Those users must re-enroll 2FA unless you re-encrypt records.'
      : '';

    return {
      success: true,
      previousVersion: previousVersion || '(none)',
      newVersion: version,
      previousKeyExisted: previousKeyExists,
      generatedKey: !newKeyB64,
      encryptedRecordsDetected: encryptedRecordsCount,
      warning: warning
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Rotate encryption key/version and re-encrypt all existing authenticator secrets.
 * This preserves existing enrolled users.
 *
 * @param {string} newVersion - e.g. "v2"
 * @param {string=} newKeyB64 - Optional web-safe base64 key. Auto-generated when omitted.
 * @returns {Object} rotation result
 */
function rotateTotpEncryptionKeyAndReencrypt(newVersion, newKeyB64) {
  try {
    const version = String(newVersion || '').trim();
    if (!version) {
      return { success: false, error: 'newVersion is required (example: v2)' };
    }

    const props = PropertiesService.getScriptProperties();
    const oldKeyB64 = props.getProperty(TOTP_PROP_KEY_B64);
    const oldVersion = props.getProperty(TOTP_PROP_KEY_VER) || 'v1';
    if (!oldKeyB64) {
      return { success: false, error: 'Current key is missing. Run setupTotpScriptProperties first.' };
    }

    const oldKeyBytes = webSafeBase64ToBytes_(oldKeyB64);
    if (!oldKeyBytes || oldKeyBytes.length < 32) {
      return { success: false, error: 'Current key is invalid.' };
    }

    const nextKeyB64 = String(newKeyB64 || '').trim() || generateTotpEncryptionKeyB64_();
    const nextKeyBytes = webSafeBase64ToBytes_(nextKeyB64);
    if (!nextKeyBytes || nextKeyBytes.length < 32) {
      return { success: false, error: 'New key is invalid. Provide web-safe base64 with >= 32 bytes decoded length.' };
    }

    const ss = SpreadsheetApp.openById(LOGIN_SPREADSHEET_ID);
    const sheet = ensureAuth2FASheet_(ss);
    const data = sheet.getDataRange().getValues();
    if (!data.length) {
      props.setProperty(TOTP_PROP_KEY_B64, nextKeyB64);
      props.setProperty(TOTP_PROP_KEY_VER, version);
      return {
        success: true,
        previousVersion: oldVersion,
        newVersion: version,
        rotatedRecords: 0,
        generatedKey: !newKeyB64
      };
    }

    const idx = getAuth2FAHeaderIndex_(data[0]);
    const toRewrite = [];
    const failures = [];

    // Phase 1: decrypt all with OLD key first (fail fast, no writes yet).
    for (var i = 1; i < data.length; i++) {
      const encPayload = String(data[i][idx.TOTP_Secret_Enc] || '').trim();
      if (!encPayload) continue;

      const username = String(data[i][idx.Username] || '').trim();
      try {
        const plain = decryptTotpSecretWithKey_(encPayload, oldKeyBytes);
        toRewrite.push({
          rowIndex: i + 1,
          username: username,
          plainSecret: plain
        });
      } catch (e) {
        failures.push({
          rowIndex: i + 1,
          username: username,
          error: String(e && e.message ? e.message : e)
        });
      }
    }

    if (failures.length > 0) {
      return {
        success: false,
        error: 'Failed to decrypt one or more existing secrets with current key. Rotation aborted.',
        failedRecords: failures,
        rotatedRecords: 0
      };
    }

    // Phase 2: write re-encrypted payloads using NEW key.
    for (var j = 0; j < toRewrite.length; j++) {
      const row = toRewrite[j];
      const enc = encryptTotpSecretWithKey_(row.plainSecret, nextKeyBytes, version);
      sheet.getRange(row.rowIndex, idx.TOTP_Secret_Enc + 1).setValue(enc.payload);
      sheet.getRange(row.rowIndex, idx.TOTP_Key_Version + 1).setValue(version);
      sheet.getRange(row.rowIndex, idx.Updated_At + 1).setValue(new Date());
    }

    // Phase 3: switch properties only after successful rewrite.
    props.setProperty(TOTP_PROP_KEY_B64, nextKeyB64);
    props.setProperty(TOTP_PROP_KEY_VER, version);

    return {
      success: true,
      previousVersion: oldVersion,
      newVersion: version,
      rotatedRecords: toRewrite.length,
      generatedKey: !newKeyB64,
      failedRecords: []
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

function migrateLegacy2FAFromUserProfiles_(ss) {
  const wb = ss || SpreadsheetApp.openById(LOGIN_SPREADSHEET_ID);
  const userSheet = wb.getSheetByName(LOGIN_SHEET_NAME);
  if (!userSheet) {
    return { migrated: 0, skipped: 0, foundLegacyColumns: false };
  }

  const data = userSheet.getDataRange().getValues();
  if (!data.length) {
    return { migrated: 0, skipped: 0, foundLegacyColumns: false };
  }

  const headers = data[0];
  const idx = {
    username: headers.indexOf('Username'),
    email: headers.indexOf('Email Address'),
    legacySecret: headers.indexOf('TOTP_Secret'),
    legacyEnabled: headers.indexOf('Is_2FA_Enabled')
  };

  if (idx.username === -1 || idx.email === -1 || idx.legacySecret === -1 || idx.legacyEnabled === -1) {
    return { migrated: 0, skipped: 0, foundLegacyColumns: false };
  }

  let migrated = 0;
  let skipped = 0;
  for (var i = 1; i < data.length; i++) {
    const username = String(data[i][idx.username] || '').trim();
    const email = String(data[i][idx.email] || '').trim();
    const legacySecret = String(data[i][idx.legacySecret] || '').trim();
    const legacyEnabled = normalizeBoolean_(data[i][idx.legacyEnabled]);

    if (!username || !legacyEnabled || !legacySecret) {
      skipped++;
      continue;
    }

    try {
      rotate2FASecret_(username, email, legacySecret, wb);
      migrated++;
    } catch (e) {
      skipped++;
    }
  }

  return {
    migrated: migrated,
    skipped: skipped,
    foundLegacyColumns: true
  };
}

function setupTotpInfrastructure() {
  try {
    const ss = SpreadsheetApp.openById(LOGIN_SPREADSHEET_ID);
    const sheet = ensureAuth2FASheet_(ss);

    const migration = migrateLegacy2FAFromUserProfiles_(ss);

    return {
      success: true,
      sheetName: sheet.getName(),
      headers: AUTH_2FA_HEADERS,
      migration: migration
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

function verifyTotpInfrastructureHealth() {
  const checks = {
    scriptProperties: { ok: false, detail: '' },
    authSheet: { ok: false, detail: '' },
    headers: { ok: false, detail: '' },
    crypto: { ok: false, detail: '' }
  };

  try {
    const material = getTotpKeyMaterial_();
    checks.scriptProperties.ok = true;
    checks.scriptProperties.detail = 'Key version: ' + material.keyVersion;
  } catch (e) {
    checks.scriptProperties.detail = e.message;
  }

  let sheet = null;
  try {
    const ss = SpreadsheetApp.openById(LOGIN_SPREADSHEET_ID);
    sheet = ss.getSheetByName(AUTH_2FA_SHEET_NAME);
    if (sheet) {
      checks.authSheet.ok = true;
      checks.authSheet.detail = 'Sheet exists';

      const headers = sheet.getRange(1, 1, 1, AUTH_2FA_HEADERS.length).getValues()[0];
      const exact = AUTH_2FA_HEADERS.every(function(expected, idx) {
        return String(headers[idx] || '').trim() === expected;
      });
      checks.headers.ok = exact;
      checks.headers.detail = exact ? 'Headers are valid' : 'Headers mismatch';
    } else {
      checks.authSheet.detail = 'Sheet not found';
      checks.headers.detail = 'Cannot validate headers';
    }
  } catch (e2) {
    checks.authSheet.detail = e2.message;
    checks.headers.detail = e2.message;
  }

  try {
    const sample = 'TESTSECRET12345';
    const encrypted = encryptTotpSecret_(sample);
    const decrypted = decryptTotpSecret_(encrypted.payload);
    checks.crypto.ok = constantTimeEquals_(sample, decrypted);
    checks.crypto.detail = checks.crypto.ok ? 'Encrypt/decrypt self-test passed' : 'Self-test mismatch';
  } catch (e3) {
    checks.crypto.detail = e3.message;
  }

  const healthy = checks.scriptProperties.ok && checks.authSheet.ok && checks.headers.ok && checks.crypto.ok;
  return {
    success: healthy,
    healthy: healthy,
    checks: checks,
    timestamp: new Date().toISOString()
  };
}

function bootstrapTotpAll() {
  const propSetup = setupTotpScriptProperties();
  const infraSetup = setupTotpInfrastructure();
  const health = verifyTotpInfrastructureHealth();

  return {
    success: !!(propSetup.success && infraSetup.success && health.healthy),
    scriptProperties: propSetup,
    infrastructure: infraSetup,
    health: health
  };
}

/**
 * Guided first-run helper.
 * Run this once after deploying/updating backend code.
 */
function runTotpInitialSetupGuide() {
  const result = bootstrapTotpAll();
  Logger.log('=== TOTP INITIAL SETUP GUIDE ===');
  Logger.log(JSON.stringify(result, null, 2));
  Logger.log('If success=true and health.healthy=true, redeploy your Web App and start frontend tests.');
  return result;
}

/**
 * Guided health check helper.
 */
function runTotpQuickHealthCheck() {
  const result = verifyTotpInfrastructureHealth();
  Logger.log('=== TOTP QUICK HEALTH CHECK ===');
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * Guided key rotation helper that preserves enrolled users.
 * @param {string} newVersion Example: "v2"
 * @param {string=} newKeyB64 Optional web-safe base64 key
 */
function runTotpRotationGuide(newVersion, newKeyB64) {
  const version = String(newVersion || '').trim() || 'v2';
  const rotateResult = rotateTotpEncryptionKeyAndReencrypt(version, newKeyB64);
  const healthResult = verifyTotpInfrastructureHealth();

  const combined = {
    rotation: rotateResult,
    health: healthResult
  };

  Logger.log('=== TOTP ROTATION GUIDE ===');
  Logger.log(JSON.stringify(combined, null, 2));
  Logger.log('If rotation.success=true and health.healthy=true, redeploy your Web App.');
  return combined;
}
