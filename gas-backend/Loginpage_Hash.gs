// =================== CONFIGURATION ===================
// ID loaded from Script Properties for security (Project Settings > Script Properties)
const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('LOGIN_SPREADSHEET_ID') || '';
const SHEET_NAME = 'User Profiles'; 
const LOGIN_HASH_BRANDING_CACHE_KEY = 'login_hash_org_branding_v1';
const LOGIN_HASH_BRANDING_CACHE_TTL_SECONDS = 1800;
const LOGIN_HASH_BRANDING_SHEET_NAME = 'Organization Branding';
const LOGIN_HASH_BRANDING_DEFAULTS = {
  orgName: 'Youth Service Philippines',
  chapterName: 'Tagum Chapter',
  shortName: 'YSP Tagum',
  motto: 'Shaping the Future to a Greater Society',
  chapterCode: 'TC',
  location: 'Tagum City, Davao del Norte, Philippines',
  contactEmail: 'ysptagumchapter@gmail.com',
  logoUrl: 'https://i.imgur.com/J4wddTW.png',
  themeColor: '#f6421f'
};

function normalizeLoginHashBranding_(raw) {
  var merged = Object.assign({}, LOGIN_HASH_BRANDING_DEFAULTS, raw || {});
  merged.orgName = String(merged.orgName || '').trim() || LOGIN_HASH_BRANDING_DEFAULTS.orgName;
  merged.chapterName = String(merged.chapterName || '').trim() || LOGIN_HASH_BRANDING_DEFAULTS.chapterName;
  merged.shortName = String(merged.shortName || '').trim() || LOGIN_HASH_BRANDING_DEFAULTS.shortName;
  merged.motto = String(merged.motto || '').trim() || LOGIN_HASH_BRANDING_DEFAULTS.motto;
  merged.chapterCode = String(merged.chapterCode || '').trim() || LOGIN_HASH_BRANDING_DEFAULTS.chapterCode;
  merged.location = String(merged.location || '').trim() || LOGIN_HASH_BRANDING_DEFAULTS.location;
  merged.contactEmail = String(merged.contactEmail || '').trim() || LOGIN_HASH_BRANDING_DEFAULTS.contactEmail;
  merged.logoUrl = String(merged.logoUrl || '').trim() || LOGIN_HASH_BRANDING_DEFAULTS.logoUrl;
  merged.themeColor = String(merged.themeColor || '').trim() || LOGIN_HASH_BRANDING_DEFAULTS.themeColor;
  merged.fullName = merged.orgName + ' - ' + merged.chapterName;
  return merged;
}

function getLoginHashBrandingFromSheet_() {
  try {
    var props = PropertiesService.getScriptProperties();
    var settingsId = String(props.getProperty('SYSTEM_SETTINGS_SPREADSHEET_ID') || '').trim();
    if (!settingsId) return null;

    var ss = SpreadsheetApp.openById(settingsId);
    var sheet = ss.getSheetByName(LOGIN_HASH_BRANDING_SHEET_NAME);
    if (!sheet || sheet.getLastRow() < 2) return null;

    var values = sheet.getDataRange().getValues();
    var headers = values[0] || [];
    var keyIdx = headers.indexOf('ConfigKey');
    var valueIdx = headers.indexOf('Value');
    if (keyIdx === -1 || valueIdx === -1) return null;

    var rowMap = {};
    for (var i = 1; i < values.length; i++) {
      var key = String(values[i][keyIdx] || '').trim();
      if (!key) continue;
      rowMap[key] = String(values[i][valueIdx] || '').trim();
    }

    return {
      orgName: rowMap.orgName || '',
      chapterName: rowMap.chapterName || '',
      shortName: rowMap.shortName || '',
      motto: rowMap.motto || '',
      chapterCode: rowMap.chapterCode || '',
      location: rowMap.location || '',
      contactEmail: rowMap.contactEmail || '',
      logoUrl: rowMap.logoUrl || '',
      themeColor: rowMap.themeColor || ''
    };
  } catch (sheetReadError) {
    Logger.log('Login hash branding sheet fallback read error: ' + sheetReadError);
    return null;
  }
}

function getLoginHashOrgBranding_() {
  var cache = CacheService.getScriptCache();
  try {
    var cachedRaw = cache.get(LOGIN_HASH_BRANDING_CACHE_KEY);
    if (cachedRaw) {
      return normalizeLoginHashBranding_(JSON.parse(cachedRaw));
    }
  } catch (cacheReadError) {
    Logger.log('Login hash branding cache read error: ' + cacheReadError);
  }

  var branding = normalizeLoginHashBranding_({});
  var resolvedFromEndpoint = false;
  try {
    var props = PropertiesService.getScriptProperties();
    var endpoint = String(props.getProperty('SYSTEM_TOOLS_BRANDING_URL') || props.getProperty('SYSTEM_TOOLS_WEB_APP_URL') || '').trim();
    if (endpoint) {
      var response = UrlFetchApp.fetch(endpoint, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({ action: 'getOrgBranding' }),
        muteHttpExceptions: true
      });
      var code = response.getResponseCode();
      if (code >= 200 && code < 300) {
        var parsed = JSON.parse(response.getContentText() || '{}');
        if (parsed && parsed.success === true && parsed.data) {
          branding = normalizeLoginHashBranding_(parsed.data);
          resolvedFromEndpoint = true;
        }
      }
    }
  } catch (fetchError) {
    Logger.log('Login hash branding fetch error: ' + fetchError);
  }

  if (!resolvedFromEndpoint) {
    var sheetBranding = getLoginHashBrandingFromSheet_();
    if (sheetBranding) {
      branding = normalizeLoginHashBranding_(sheetBranding);
    }
  }

  try {
    cache.put(LOGIN_HASH_BRANDING_CACHE_KEY, JSON.stringify(branding), LOGIN_HASH_BRANDING_CACHE_TTL_SECONDS);
  } catch (cacheWriteError) {
    Logger.log('Login hash branding cache write error: ' + cacheWriteError);
  }

  return branding;
}

// =================== TRIGGERS ===================

function onFormSubmit(e) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  const row = sheet.getLastRow();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  const answers = {};
  if (e && e.response) {
    e.response.getItemResponses().forEach(ir => {
      answers[ir.getItem().getTitle()] = ir.getResponse();
    });
    answers['Email Address'] = answers['Email Address'] || e.response.getRespondentEmail();
  }

  processUser(sheet, row, headers, answers, 'CREATE', null, null);
}

function onEdit(e) {
  const range = e.range;
  const sheet = range.getSheet();
  if (sheet.getName() !== SHEET_NAME || range.getRow() === 1) return;

  const row = range.getRow();
  const col = range.getColumn();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const data = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  const answers = {};
  headers.forEach((h, i) => answers[h] = data[i]);

  const editInfo = {
    oldValue: e.oldValue !== undefined ? e.oldValue : '(previously empty)',
    newValue: e.value !== undefined ? e.value : data[col - 1],
    columnName: headers[col - 1]
  };

  processUser(sheet, row, headers, answers, col, e, editInfo);
}

// =================== CORE LOGIC ===================

function processUser(sheet, row, headers, answers, triggerSource, e, editInfo) {
  
  // === 1. NOTIFICATION ALLOWLIST ===
  // Added 'EmailVerified' back so manual edits trigger an email
  const CRITICAL_FIELDS = [
    'Personal Email Address',
    'Username',
    'Password',
    'ID Code',
    'Position',       
    'Role',           
    'Chapter',        
    'Committee',      
    'Membership Type',
    'EmailVerified',  // <--- ADDED BACK
    'Status'          
  ];

  // === 2. Column Mapping ===
  const idx = {
    id: headers.indexOf('ID Code'),
    position: headers.indexOf('Position'),
    numeric: headers.indexOf('Numeric ID'),
    pwd: headers.indexOf('Password'),
    salt: headers.indexOf('Salt'),
    email: headers.indexOf('Email Address'),
    user: headers.indexOf('Username'),
    name: headers.indexOf('Full name')
  };

  const position = (answers['Position'] || '').toString().trim();
  const currentID = idx.id > -1 ? String(sheet.getRange(row, idx.id + 1).getValue() || '').trim() : '';
  const isPasswordEdit = (triggerSource === (idx.pwd + 1));
  
  // --- 3. ID Generation ---
  // ID codes are permanent once assigned. Only generate when ID is still blank.
  if (position && !currentID) {
    const result = generateUniqueID(sheet, position, idx.id + 1);
    if (result.fullID && result.fullID !== "Range Full") {
      sheet.getRange(row, idx.id + 1).setValue(result.fullID);
      if (idx.numeric > -1) sheet.getRange(row, idx.numeric + 1).setValue(result.numericID);
    }
  }

  // --- 4. Password Hashing ---
  const rawPassword = answers['Password'] ? answers['Password'].toString() : '';
  let score = 0;
  let rules = [];
  let passwordWasHashed = false;
  
  if (idx.pwd > -1 && rawPassword && rawPassword.length < 60) {
    rules = [
      {desc: '8+ Characters', test: rawPassword.length >= 8, pts: 25},
      {desc: 'Uppercase Letter', test: /[A-Z]/.test(rawPassword), pts: 25},
      {desc: 'Number', test: /\d/.test(rawPassword), pts: 25},
      {desc: 'Special Char', test: /[!@#$%^&*(),.?":{}|<>]/.test(rawPassword), pts: 25}
    ];
    score = rules.filter(r => r.test).reduce((sum, r) => sum + r.pts, 0);

    const color = score === 100 ? '#33cc33' : score >= 75 ? '#b3ff66' : score >= 50 ? '#ffb84d' : '#ff4d4d';
    sheet.getRange(row, idx.pwd + 1).setBackground(color);

    // Generate salt and create salted hash: SHA-256(salt + SHA-256(password))
    const newSalt = generateSalt();
    const plainHash = hashString(rawPassword);
    const hashedPassword = hashWithSalt(plainHash, newSalt);
    sheet.getRange(row, idx.pwd + 1).setValue(hashedPassword);
    if (idx.salt > -1) {
      sheet.getRange(row, idx.salt + 1).setValue(newSalt);
    }
    passwordWasHashed = true;
  }

  // --- 5. Email Notification ---
  const email = answers['Email Address'];
  if (!email) return;

  // Scenario A: Welcome (new account creation only)
  if (triggerSource === 'CREATE') {
    const finalID = sheet.getRange(row, idx.id + 1).getValue();
    sendYSPEmail(email, answers['Full name'], "WELCOME", {
      id: finalID,
      username: answers['Username'],
      score: score,
      rules: rules
    });
  }
  // Scenario B: Password Change
  else if (isPasswordEdit && passwordWasHashed) {
    sendYSPEmail(email, answers['Full name'], "UPDATE", {
      field: 'Password',
      oldVal: '(hidden)',
      newVal: '(hidden)',
      username: answers['Username'],
      score: score 
    });
  }
  // Scenario C: Manual Edit
  else if (typeof triggerSource === 'number' && editInfo) {
    const headerName = editInfo.columnName || headers[triggerSource - 1];
    
    // Filter non-critical fields
    if (!CRITICAL_FIELDS.includes(headerName)) {
      return; 
    }

    if (headerName === 'Password') return;

    // Send email
    sendYSPEmail(email, answers['Full name'], "UPDATE", {
      field: headerName,
      oldVal: editInfo.oldValue,
      newVal: editInfo.newValue,
      username: answers['Username'],
      score: score 
    });
  }

  // --- 6. Weak password logging REMOVED for security (never store plain text passwords) ---
}

// =================== HASHING UTILITY ===================

function hashString(input) {
  const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input, Utilities.Charset.UTF_8);
  let txtHash = '';
  for (let i = 0; i < rawHash.length; i++) {
    let hashVal = rawHash[i];
    if (hashVal < 0) {
      hashVal += 256;
    }
    if (hashVal.toString(16).length == 1) {
      txtHash += '0';
    }
    txtHash += hashVal.toString(16);
  }
  return txtHash;
}

/**
 * Hash a password with a salt: SHA-256(salt + SHA-256(password))
 * @param {string} passwordHash - Already-hashed password (SHA-256 hex)
 * @param {string} salt - Per-user salt string
 * @returns {string} Salted hash (hexadecimal)
 */
function hashWithSalt(passwordHash, salt) {
  return hashString(salt + passwordHash);
}

/**
 * Generate a cryptographically random salt (32-char hex)
 * @returns {string} Salt string
 */
function generateSalt() {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    Utilities.getUuid() + new Date().getTime().toString(),
    Utilities.Charset.UTF_8
  );
  let hex = '';
  for (let i = 0; i < 16; i++) {
    let b = bytes[i];
    if (b < 0) b += 256;
    if (b.toString(16).length === 1) hex += '0';
    hex += b.toString(16);
  }
  return hex;
}

// =================== ONE-TIME MIGRATION TOOLS ===================

/**
 * Legacy migration: hash plain-text passwords (kept for reference).
 */
function convertAllPasswordsToHash() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const pwdCol = headers.indexOf('Password') + 1;
  
  if (pwdCol === 0) {
    Logger.log("Error: Password column not found.");
    return;
  }

  const lastRow = sheet.getLastRow();
  const range = sheet.getRange(2, pwdCol, lastRow - 1, 1);
  const values = range.getValues();
  
  const hashedValues = values.map(row => {
    const val = row[0].toString();
    if (val !== "" && val.length < 60) {
      return [hashString(val)];
    }
    return [val];
  });
  
  range.setValues(hashedValues);
  Logger.log("Migration Complete: All plain text passwords have been hashed.");
}

/**
 * ONE-TIME SALT MIGRATION
 * Run this function manually in Apps Script editor to migrate all existing
 * hashed passwords to salted hashes.
 *
 * What it does:
 * 1. Finds or creates a "Salt" column in the User Profiles sheet
 * 2. For each user that has a hashed password but NO salt:
 *    - Generates a unique random salt
 *    - Re-hashes as: SHA-256(salt + existingHash)
 *    - Writes the new salted hash and salt to the sheet
 * 3. Users who already have a salt are SKIPPED (safe to re-run)
 *
 * This is a non-breaking migration because:
 * - handleLogin/handleVerifyPassword check if salt exists
 * - If no salt, they fall back to plain SHA-256 comparison
 * - After migration, all users will have salts
 *
 * IMPORTANT: Back up your User Profiles sheet before running!
 */
function migratePasswordsToSalted() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    Logger.log('Error: Sheet "' + SHEET_NAME + '" not found.');
    return;
  }
  
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  
  // Find or create the Salt column
  let saltCol = headers.indexOf('Salt');
  if (saltCol === -1) {
    // Add Salt column as the next available column
    saltCol = lastCol; // 0-based index for new column
    sheet.getRange(1, saltCol + 1).setValue('Salt');
    Logger.log('Created "Salt" column at position ' + (saltCol + 1));
  }
  
  const pwdCol = headers.indexOf('Password');
  if (pwdCol === -1) {
    Logger.log('Error: Password column not found.');
    return;
  }
  
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log('No data rows found.');
    return;
  }
  
  // Read all password and salt values at once (batch read for performance)
  const pwdRange = sheet.getRange(2, pwdCol + 1, lastRow - 1, 1).getValues();
  const saltRange = sheet.getRange(2, saltCol + 1, lastRow - 1, 1).getValues();
  
  let migrated = 0;
  let skipped = 0;
  let empty = 0;
  
  // Prepare batch arrays for writing
  const newPwdValues = [];
  const newSaltValues = [];
  
  for (let i = 0; i < pwdRange.length; i++) {
    const existingHash = (pwdRange[i][0] || '').toString().trim();
    const existingSalt = (saltRange[i][0] || '').toString().trim();
    
    // Skip empty passwords
    if (!existingHash) {
      newPwdValues.push([existingHash]);
      newSaltValues.push([existingSalt]);
      empty++;
      continue;
    }
    
    // Skip already-salted users
    if (existingSalt) {
      newPwdValues.push([existingHash]);
      newSaltValues.push([existingSalt]);
      skipped++;
      continue;
    }
    
    // Generate salt and create double-hash: SHA-256(salt + existingHash)
    const salt = generateSalt();
    const saltedHash = hashWithSalt(existingHash, salt);
    
    newPwdValues.push([saltedHash]);
    newSaltValues.push([salt]);
    migrated++;
  }
  
  // Batch write for performance
  if (migrated > 0) {
    sheet.getRange(2, pwdCol + 1, lastRow - 1, 1).setValues(newPwdValues);
    sheet.getRange(2, saltCol + 1, lastRow - 1, 1).setValues(newSaltValues);
  }
  
  Logger.log('=== Salt Migration Complete ===');
  Logger.log('Migrated: ' + migrated + ' users');
  Logger.log('Skipped (already salted): ' + skipped + ' users');
  Logger.log('Skipped (empty password): ' + empty + ' rows');
  Logger.log('Total rows processed: ' + pwdRange.length);
}

// =================== HELPER FUNCTIONS ===================

function generateUniqueID(sheet, position, colIndex) {
  // Keep legacy trigger behavior (ID is assigned when Position is set),
  // but remove legacy position-based ID format.
  if (!position) return { fullID: null, numericID: null };

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const yearSuffix = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yy');
    const lastRow = sheet.getLastRow();
    const usedSeq = {};

    if (lastRow > 1) {
      const existingIDs = sheet.getRange(2, colIndex, lastRow - 1, 1).getValues().flat();
      for (let i = 0; i < existingIDs.length; i++) {
        const value = String(existingIDs[i] || '').trim();
        const match = value.match(/^YSPTC-(\d{2})(\d{3,})$/);
        if (!match) continue;
        if (match[1] !== yearSuffix) continue;
        const seq = Number(match[2]);
        if (!isNaN(seq) && seq > 0) {
          usedSeq[seq] = true;
        }
      }
    }

    let nextSeq = 1;
    while (usedSeq[nextSeq]) {
      nextSeq++;
    }

    const numericPart = yearSuffix + Utilities.formatString('%03d', nextSeq);
    return {
      fullID: 'YSPTC-' + numericPart,
      numericID: numericPart
    };
  } finally {
    lock.releaseLock();
  }
}

// =================== PROFESSIONAL EMAIL ENGINE ===================

function sendYSPEmail(email, name, type, data) {
  const orgBranding = getLoginHashOrgBranding_();
  const LOGO_URL = orgBranding.logoUrl || "https://i.imgur.com/J4wddTW.png"; 
  const WEB_APP_URL = "https://www.youthservicephilippinestagum.me/";
  const FB_PAGE_URL = "https://www.facebook.com/YSPTagumChapter";
  
  let subjectLine = "";
  let mainContent = "";

  const dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMMM dd, yyyy");
  const timeStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "hh:mm a");

  if (type === "WELCOME") {
    subjectLine = "Welcome to " + orgBranding.shortName + " - Official ID Assigned";
    mainContent = `
      <p style="margin-bottom: 24px;">Your official profile has been successfully created. Below are your assigned credentials for the organization.</p>
      
      <div style="background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
        <div style="background-color: #f8f9fa; padding: 12px 20px; border-bottom: 1px solid #eeeeee;">
          <span style="font-family: 'Lexend', sans-serif; font-size: 12px; font-weight: 600; color: #666; letter-spacing: 0.5px; text-transform: uppercase;">Credentials</span>
        </div>
        <div style="padding: 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding-bottom: 15px; width: 40%; color: #555; font-size: 13px;">ID Code</td>
              <td style="padding-bottom: 15px; color: #222; font-weight: 600; font-size: 15px;">${data.id}</td>
            </tr>
            <tr>
              <td style="width: 40%; color: #555; font-size: 13px;">Username</td>
              <td style="color: #222; font-weight: 600; font-size: 15px;">${data.username}</td>
            </tr>
          </table>
        </div>
      </div>`;
  } 
  else if (type === "UPDATE") {
    subjectLine = "Profile Update Notification";
    
    let changeDetailsHTML = "";

    // === CASE 1: Password (Security Alert) ===
    if (data.field === 'Password') {
      changeDetailsHTML = `
        <div style="background-color: #fff5f5; border: 1px solid #fed7d7; border-radius: 8px; padding: 20px; text-align: center;">
           <div style="font-size: 24px; margin-bottom: 10px;">🔐</div>
           <div style="font-family: 'Lexend', sans-serif; color: #c53030; font-weight: 700; font-size: 16px; margin-bottom: 8px;">
             SECURITY ALERT
           </div>
           <div style="color: #742a2a; font-size: 14px;">
             Your account password has been changed successfully.
           </div>
           <div style="margin-top: 12px; font-size: 12px; color: #742a2a;">
             (For security reasons, we do not display the password in this email.)
           </div>
        </div>
      `;
    } 
    // === CASE 2: EmailVerified (Success Message) ===
    // This catches manual Admin verification
    else if (data.field === 'EmailVerified' && String(data.newVal).toUpperCase() === 'TRUE') {
      subjectLine = "Email Verified Successfully"; // Override subject line
      changeDetailsHTML = `
        <div style="background-color: #f0fff4; border: 1px solid #c6f6d5; border-radius: 8px; padding: 20px; text-align: center;">
           <div style="font-size: 24px; margin-bottom: 10px;">✅</div>
           <div style="font-family: 'Lexend', sans-serif; color: #2f855a; font-weight: 700; font-size: 16px; margin-bottom: 8px;">
             EMAIL VERIFIED
           </div>
           <div style="color: #22543d; font-size: 14px;">
             Your email address has been manually verified by an administrator.
           </div>
        </div>
      `;
    }
    // === CASE 3: Standard Field (Comparison Table) ===
    else {
      changeDetailsHTML = `
        <div style="margin-bottom: 8px; font-size: 12px; color: #888; text-transform: uppercase; font-weight: 600;">${data.field}</div>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td valign="top" width="45%" style="padding: 10px; background-color: #fff5f5; border: 1px solid #fed7d7; border-radius: 6px;">
              <div style="font-size: 11px; color: #c53030; margin-bottom: 4px; font-weight: bold;">PREVIOUS</div>
              <div style="font-size: 14px; color: #742a2a; word-break: break-word;">${data.oldVal || '(Empty)'}</div>
            </td>
            <td valign="middle" align="center" width="10%" style="color: #999;">
              <span style="font-size: 20px;">➝</span>
            </td>
            <td valign="top" width="45%" style="padding: 10px; background-color: #f0fff4; border: 1px solid #c6f6d5; border-radius: 6px;">
                <div style="font-size: 11px; color: #2f855a; margin-bottom: 4px; font-weight: bold;">NEW</div>
                <div style="font-size: 14px; color: #22543d; word-break: break-word; font-weight: 600;">${data.newVal}</div>
            </td>
          </tr>
        </table>
      `;
    }

    mainContent = `
      <p style="margin-bottom: 24px;">Your profile was updated on <strong>${dateStr}</strong> at ${timeStr}.</p>
      
      <div style="background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
        <div style="background-color: #f8f9fa; padding: 12px 20px; border-bottom: 1px solid #eeeeee;">
          <span style="font-family: 'Lexend', sans-serif; font-size: 12px; font-weight: 600; color: #666; letter-spacing: 0.5px; text-transform: uppercase;">Modifications</span>
        </div>
        <div style="padding: 20px;">
          ${changeDetailsHTML} 
        </div>
      </div>`;
  }
  // NEW: BULK_UPDATE - Multiple fields changed at once
  else if (type === "BULK_UPDATE") {
    // (Existing Bulk Update Logic remains the same)
    const changesCount = data.changes ? data.changes.length : 0;
    subjectLine = `Profile Update Notification - ${changesCount} Field${changesCount !== 1 ? 's' : ''} Modified`;
    
    let allChangesHTML = "";
    
    if (data.changes && data.changes.length > 0) {
      for (let i = 0; i < data.changes.length; i++) {
        const change = data.changes[i];
        
        if (change.field === 'Password') {
          allChangesHTML += `
            <div style="margin-bottom: 20px;">
              <div style="background-color: #fff5f5; border: 1px solid #fed7d7; border-radius: 8px; padding: 16px; text-align: center;">
                <div style="font-size: 20px; margin-bottom: 8px;">🔐</div>
                <div style="font-family: 'Lexend', sans-serif; color: #c53030; font-weight: 700; font-size: 14px; margin-bottom: 6px;">
                  PASSWORD CHANGED
                </div>
                <div style="color: #742a2a; font-size: 12px;">
                  Your account password has been updated successfully.
                </div>
              </div>
            </div>
          `;
        } else {
          allChangesHTML += `
            <div style="margin-bottom: 20px;">
              <div style="margin-bottom: 8px; font-size: 12px; color: #888; text-transform: uppercase; font-weight: 600;">${change.field}</div>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="top" width="45%" style="padding: 10px; background-color: #fff5f5; border: 1px solid #fed7d7; border-radius: 6px;">
                    <div style="font-size: 11px; color: #c53030; margin-bottom: 4px; font-weight: bold;">PREVIOUS</div>
                    <div style="font-size: 14px; color: #742a2a; word-break: break-word;">${change.oldVal || '(Empty)'}</div>
                  </td>
                  <td valign="middle" align="center" width="10%" style="color: #999;">
                    <span style="font-size: 20px;">➝</span>
                  </td>
                  <td valign="top" width="45%" style="padding: 10px; background-color: #f0fff4; border: 1px solid #c6f6d5; border-radius: 6px;">
                    <div style="font-size: 11px; color: #2f855a; margin-bottom: 4px; font-weight: bold;">NEW</div>
                    <div style="font-size: 14px; color: #22543d; word-break: break-word; font-weight: 600;">${change.newVal || '(Empty)'}</div>
                  </td>
                </tr>
              </table>
            </div>
          `;
        }
      }
    }

    mainContent = `
      <p style="margin-bottom: 24px;">Your profile was updated on <strong>${dateStr}</strong> at ${timeStr}. The following ${changesCount} field${changesCount !== 1 ? 's were' : ' was'} modified:</p>
      
      <div style="background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
        <div style="background-color: #f8f9fa; padding: 12px 20px; border-bottom: 1px solid #eeeeee;">
          <span style="font-family: 'Lexend', sans-serif; font-size: 12px; font-weight: 600; color: #666; letter-spacing: 0.5px; text-transform: uppercase;">All Modifications</span>
        </div>
        <div style="padding: 20px;">
          ${allChangesHTML} 
        </div>
      </div>`;
  }

  // 2. SECURITY SECTION LOGIC
  let securitySection = "";
  
  if (type === "WELCOME") {
    const isSecure = data.score >= 100;
    const secBg = isSecure ? '#f0fff4' : '#fffaf0'; 
    const secBorder = isSecure ? '#c6f6d5' : '#feebc8';
    const secTextColor = isSecure ? '#22543d' : '#7b341e';
    const secTitle = isSecure ? 'Security Status: Strong' : 'Security Attention Needed';

    securitySection = `
      <div style="margin-top: 24px; background-color: ${secBg}; border: 1px solid ${secBorder}; border-radius: 8px; padding: 16px; display: flex; align-items: start;">
         <table width="100%" cellpadding="0" cellspacing="0" border="0">
           <tr>
             <td width="24" valign="top" style="padding-right: 12px; font-size: 20px;">${isSecure ? '🛡️' : '⚠️'}</td>
             <td>
               <div style="font-family: 'Lexend', sans-serif; font-size: 14px; font-weight: 600; color: ${secTextColor}; margin-bottom: 4px;">${secTitle}</div>
               <div style="font-size: 13px; color: ${secTextColor}; opacity: 0.9;">Password Score: <strong>${data.score || 0}%</strong></div>
             </td>
           </tr>
         </table>
      </div>
    `;
  }

  // 3. FULL HTML TEMPLATE
  const htmlBody = `
  <!DOCTYPE html>
  <html>
  <head>
    <link href="https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
      body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
      table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
      img { -ms-interpolation-mode: bicubic; }
      .font-header { font-family: 'Lexend', 'Verdana', sans-serif !important; }
      .font-body { font-family: 'Roboto', 'Arial', sans-serif !important; }
    </style>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: 'Roboto', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f4f6f8">
      <tr>
        <td align="center" style="padding: 40px 10px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
            <tr>
              <td bgcolor="#FF8800" align="center" style="padding: 35px 20px;">
                <img src="${LOGO_URL}" alt="YSP Logo" width="70" style="display: block; width: 70px; height: auto; border-radius: 50%; background: #fff; padding: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); margin-bottom: 16px;">
                <div class="font-header" style="color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; margin: 0;">${orgBranding.orgName}</div>
                <div class="font-body" style="color: rgba(255,255,255,0.9); font-size: 14px; margin-top: 6px; font-weight: 500;">${orgBranding.chapterName}</div>
              </td>
            </tr>
            <tr>
              <td style="padding: 40px 30px;">
                <div class="font-header" style="color: #1a1a1a; font-size: 20px; font-weight: 600; margin-bottom: 16px;">Hello, ${name || 'Member'}</div>
                <div class="font-body" style="color: #4a5568; font-size: 15px; line-height: 1.6;">
                  ${mainContent}
                  ${securitySection}
                </div>
                <div style="margin-top: 30px; border-top: 1px solid #eeeeee; padding-top: 20px;">
                   <table width="100%">
                     <tr>
                       <td width="20" valign="top" style="color: #aaa; font-size: 16px;">ℹ️</td>
                       <td style="font-size: 12px; color: #888; line-height: 1.5;">
                         <strong>Notice:</strong> If you did not initiate this change, please contact your administrator immediately.
                       </td>
                     </tr>
                   </table>
                </div>
                <table width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top: 30px;">
                  <tr>
                    <td align="center">
                      <a href="${WEB_APP_URL}" style="display: inline-block; background-color: #FF8800; color: #ffffff; font-family: 'Lexend', sans-serif; font-weight: 600; font-size: 14px; padding: 12px 28px; text-decoration: none; border-radius: 6px; box-shadow: 0 2px 4px rgba(255, 136, 0, 0.3); margin: 0 8px;">Access Web App</a>
                      <a href="${FB_PAGE_URL}" style="display: inline-block; background-color: #ffffff; color: #4a5568; border: 1px solid #e2e8f0; font-family: 'Lexend', sans-serif; font-weight: 600; font-size: 14px; padding: 11px 28px; text-decoration: none; border-radius: 6px; margin: 0 8px;">Facebook</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td bgcolor="#f8f9fa" align="center" style="padding: 24px; border-top: 1px solid #eeeeee;">
                <div class="font-body" style="color: #a0aec0; font-size: 11px; line-height: 1.5;">
                  &copy; 2026 ${orgBranding.fullName}.<br>
                  Automated System Notification. Please do not reply.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;

  MailApp.sendEmail({
    to: email,
    subject: subjectLine,
    htmlBody: htmlBody
  });
}

function createEditTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'onEditInstallable') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  ScriptApp.newTrigger('onEditInstallable')
    .forSpreadsheet(ss)
    .onEdit()
    .create();
  
  Logger.log('✅ Installable onEdit trigger created successfully!');
}

function onEditInstallable(e) {
  onEdit(e);  
}
