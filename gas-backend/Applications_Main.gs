/**
 * Google Apps Script - Membership Applications Management API
 * 
 * Handles backend logic for Membership Applications / Opportunities page.
 */

// Configuration - Membership Opportunities
const APPLICATIONS_CONFIG = {
  SHEET_NAME: 'Membership_Opportunities',
  HEADER_ROW: 1,
  COLUMNS: {
    ID: 1,            // Column A
    TITLE: 2,         // Column B
    DESCRIPTION: 3,   // Column C
    START_DATE: 4,    // Column D
    END_DATE: 5,      // Column E
    STATUS: 6,        // Column F (open, closed, completed, archived)
    VISIBILITY: 7,    // Column G (public, hidden)
    LINK: 8           // Column H
  }
};
const OPPORTUNITY_ID_PREFIX = 'YSPTBM-';
const OPPORTUNITY_ID_DIGITS = 4;

const APPLICANT_SYNC_CONFIG = {
  SETTINGS_SHEET_NAME: 'Membership_Applicant_Sync_Settings',
  SETTINGS_HEADERS: ['Key', 'Value', 'UpdatedAt'],
  SETTINGS_KEYS: {
    SHEET_URL: 'ApplicantSheetUrl',
    LAST_SYNCED_AT: 'ApplicantSheetLastSyncedAt'
  }
};

const APPLICANT_AI_CONFIG = {
  ENABLED_KEY: 'APPLICANT_GEMINI_ENABLED',
  DEBUG_KEY: 'APPLICANT_GEMINI_DEBUG',
  MODEL_KEY: 'APPLICANT_GEMINI_MODEL',
  DEFAULT_MODEL: 'gemini-2.5-flash',
  MAX_CALLS_PER_EXECUTION: 40,
  CACHE_PREFIX: 'gemini_header_map_'
};

/**
 * Handle GET requests - Fetch opportunities
 */
function doGet(e) {
  try {
    const action = e && e.parameter ? e.parameter.action : 'getOpportunities';
    const params = (e && e.parameter) ? e.parameter : {};
    
    if (action === 'health') {
      return createJsonResponse({ success: true, status: 'healthy' });
    }

    // Public read endpoint for Opportunities page
    if (action === 'getOpportunities') {
      const opportunities = getOpportunities();
      return createJsonResponse({
        success: true,
        data: opportunities,
        timestamp: new Date().toISOString()
      });
    }

    // Any non-public GET action remains authenticated
    const sessionSecret = PropertiesService.getScriptProperties().getProperty('SESSION_SECRET_KEY');
    if (!sessionSecret) {
      return createJsonResponse({
        success: false,
        error: 'Server auth misconfigured: SESSION_SECRET_KEY is missing',
        code: 503
      });
    }
    const tokenUser = verifyHmacToken_(params.sessionToken);
    if (!tokenUser || !tokenUser.username) {
      return createJsonResponse({
        success: false,
        error: 'Invalid or expired session token',
        code: 401
      });
    }

    return createJsonResponse({
      success: false,
      error: 'Unknown action'
    });

  } catch (error) {
    console.error('Error in doGet:', error);
    return createJsonResponse({
      success: false,
      error: error.message || 'Unknown error occurred'
    });
  }
}

/**
 * Handle POST requests - Manage opportunities
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);

    // Shared-secret endpoint for cross-project Gemini key audit (count + key names only).
    if (payload.action === 'getGeminiKeyAudit') {
      return createJsonResponse(handleGetGeminiKeyAuditForApplications_(payload));
    }

    // ---- API key validation ----
    if (!validateApiKey_(payload.key)) {
      return createJsonResponse({ success: false, error: 'Invalid or missing API key', code: 401 });
    }

    // ---- Session token verification (HMAC) ----
    var tokenUser = verifyHmacToken_(payload.sessionToken);
    var sessionSecret = PropertiesService.getScriptProperties().getProperty('SESSION_SECRET_KEY');
    if (!sessionSecret) {
      return createJsonResponse({ success: false, error: 'Server auth misconfigured: SESSION_SECRET_KEY is missing', code: 503 });
    }
    if (!tokenUser) {
      return createJsonResponse({ success: false, error: 'Invalid or expired session token', code: 401 });
    }
    payload.username = tokenUser.username;

    // ---- Role check: all write operations require admin or auditor ----
    const authError = requireAdminOrAuditor_(payload.username, payload.action || 'manage opportunities');
    if (authError) return createJsonResponse(authError);

    if (payload.action === 'addOpportunity') {
      const result = addOpportunity(payload.data);
      return createJsonResponse(result);
    }

    if (payload.action === 'updateOpportunity') {
      const result = updateOpportunity(payload.id, payload.data);
      return createJsonResponse(result);
    }

    if (payload.action === 'deleteOpportunity') {
      const result = deleteOpportunity(payload.id);
      return createJsonResponse(result);
    }

    if (payload.action === 'getSyncedApplicantSheet') {
      const result = getSyncedApplicantSheetData_();
      return createJsonResponse(result);
    }

    if (payload.action === 'syncApplicantSheet') {
      const result = syncApplicantSheet_(payload.sheetUrl);
      return createJsonResponse(result);
    }

    if (payload.action === 'getApplicantImageDataUrl') {
      const result = getApplicantImageDataUrl_(payload.imageUrl);
      return createJsonResponse(result);
    }

    return createJsonResponse({
      success: false,
      error: 'Invalid action'
    });

  } catch (error) {
    console.error('Error in doPost:', error);
    return createJsonResponse({
      success: false,
      error: error.message || 'Unknown error occurred'
    });
  }
}

function handleGetGeminiKeyAuditForApplications_(payload) {
  if (!verifyCrossAuditSecretForApplications_(payload && payload.auditSecret)) {
    return { success: false, error: 'Unauthorized audit request', code: 401 };
  }

  var props = PropertiesService.getScriptProperties().getProperties() || {};
  var prefix = resolveGeminiPrefixForApplications_(payload && payload.source, payload && payload.prefixBase);
  var keys = collectConfiguredPrefixedKeysForApplications_(props, prefix);
  return {
    success: true,
    data: {
      source: String(payload && payload.source || ''),
      prefixBase: prefix,
      count: keys.length,
      keys: keys,
      checkedAt: new Date().toISOString()
    }
  };
}

function verifyCrossAuditSecretForApplications_(providedSecret) {
  var expected = String(PropertiesService.getScriptProperties().getProperty('CROSS_GAS_AUDIT_SECRET') || '').trim();
  if (!expected) return false;
  return String(providedSecret || '').trim() === expected;
}

function resolveGeminiPrefixForApplications_(sourceValue, explicitPrefix) {
  var requestedPrefix = String(explicitPrefix || '').trim();
  if (requestedPrefix) return requestedPrefix;
  var source = String(sourceValue || '').toLowerCase().trim();
  if (source === 'chatbot') return 'AI_CHATBOT_API_KEY';
  return 'GEMINI_API_KEY';
}

function collectConfiguredPrefixedKeysForApplications_(props, baseKey) {
  var out = [];
  var normalizedBase = String(baseKey || '').trim();
  if (!normalizedBase) return out;

  var source = props || {};
  var keys = Object.keys(source);
  if (String(source[normalizedBase] || '').trim()) out.push(normalizedBase);

  var numberedPrefix = normalizedBase + '_';
  var numberedMatches = [];
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (key.indexOf(numberedPrefix) !== 0) continue;
    var suffix = key.substring(numberedPrefix.length);
    if (!/^\d+$/.test(suffix)) continue;
    if (!String(source[key] || '').trim()) continue;
    numberedMatches.push(key);
  }

  numberedMatches.sort(function(a, b) {
    var aNum = parseInt(a.substring(numberedPrefix.length), 10);
    var bNum = parseInt(b.substring(numberedPrefix.length), 10);
    return aNum - bNum;
  });

  return out.concat(numberedMatches);
}

function getApplicantImageDataUrl_(imageUrl) {
  var raw = String(imageUrl || '').trim();
  if (!raw) {
    return { success: false, error: 'Image URL is required' };
  }

  // Prefer direct Drive API access when file ID is available.
  // This avoids many public-link/CORS/redirect issues from UrlFetchApp.
  var directFileId = extractDriveFileId_(raw);
  if (directFileId) {
    try {
      var file = DriveApp.getFileById(directFileId);
      var blob = file.getBlob();
      var driveDataUrl = buildImageDataUrlFromBlob_(blob, raw);
      if (driveDataUrl) {
        return {
          success: true,
          data: {
            sourceUrl: 'drive:file:' + directFileId,
            dataUrl: driveDataUrl
          }
        };
      }
    } catch (driveErr) {
      // Continue with URL candidate fetch fallbacks below.
    }
  }

  var candidates = buildApplicantImageCandidates_(raw);
  for (var i = 0; i < candidates.length; i++) {
    var candidate = candidates[i];
    try {
      var response = UrlFetchApp.fetch(candidate, {
        method: 'get',
        muteHttpExceptions: true,
        followRedirects: true
      });
      var status = response.getResponseCode();
      if (status < 200 || status >= 300) continue;

      var blobFromFetch = response.getBlob();
      var base64DataUrl = buildImageDataUrlFromBlob_(blobFromFetch, candidate);
      if (!base64DataUrl) continue;
      return {
        success: true,
        data: {
          sourceUrl: candidate,
          dataUrl: base64DataUrl
        }
      };
    } catch (error) {
      // Try next candidate
    }
  }

  return { success: false, error: 'Unable to fetch applicant image from source URL' };
}

// ==================== OPPORTUNITIES MANAGEMENT ====================

/**
 * Get all opportunities from spreadsheet
 */
function getOpportunities() {
  const sheet = getOpportunitiesSheet();
  const lastRow = sheet.getLastRow();
  
  if (lastRow < 2) {
    return [];
  }

  const range = sheet.getRange(2, 1, lastRow - 1, 8);
  const values = range.getValues();
  const opportunities = [];
  const now = new Date();
  const statusUpdates = [];

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if (row[0]) { // If ID exists
      let status = String(row[5] || 'closed').toLowerCase();
      const endDate = parseOpportunityDateValue_(row[4]);

      // Auto-transition open opportunities to completed once endDate has passed.
      if (status === 'open' && endDate && endDate.getTime() <= now.getTime()) {
        status = 'completed';
        statusUpdates.push(i + 2);
      }

      opportunities.push({
        id: row[0],
        title: row[1] || '',
        description: row[2] || '',
        startDate: formatDateForApi_(row[3]),
        endDate: formatDateForApi_(row[4]),
        status: status,
        visibility: row[6] || 'hidden',
        link: row[7] || ''
      });
    }
  }

  if (statusUpdates.length > 0) {
    for (let j = 0; j < statusUpdates.length; j++) {
      sheet.getRange(statusUpdates[j], APPLICATIONS_CONFIG.COLUMNS.STATUS).setValue('completed');
    }
    SpreadsheetApp.flush();
  }

  return opportunities;
}

/**
 * Add new opportunity
 */
function addOpportunity(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sheet = getOpportunitiesSheet();
    const lastRow = sheet.getLastRow();
    const newRow = lastRow + 1;
    const requestedId = String(data && data.id ? data.id : '').trim();
    const id = requestedId && !doesOpportunityIdExist_(sheet, requestedId)
      ? requestedId
      : generateNextOpportunityId_(sheet);

    const values = [
      id,
      data.title || '',
      data.description || '',
      normalizeOpportunityDateForStorage_(data.startDate),
      normalizeOpportunityDateForStorage_(data.endDate),
      data.status || 'open',
      data.visibility || 'public',
      data.link || ''
    ];

    sheet.getRange(newRow, 1, 1, 8).setValues([values]);
    SpreadsheetApp.flush();

    return {
      success: true,
      message: 'Opportunity created successfully',
      data: { ...data, id }
    };

  } catch (error) {
    console.error('Error adding opportunity:', error);
    return {
      success: false,
      message: error.message
    };
  } finally {
    lock.releaseLock();
  }
}

function doesOpportunityIdExist_(sheet, id) {
  var cleanId = String(id || '').trim();
  if (!cleanId) return false;

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  var idValues = sheet.getRange(2, APPLICATIONS_CONFIG.COLUMNS.ID, lastRow - 1, 1).getValues();
  for (var i = 0; i < idValues.length; i++) {
    var rowId = String(idValues[i][0] || '').trim();
    if (rowId === cleanId) return true;
  }
  return false;
}

function generateNextOpportunityId_(sheet) {
  var lastRow = sheet.getLastRow();
  var yearSuffix = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yy');
  var maxSequence = 0;
  var pattern = new RegExp('^' + OPPORTUNITY_ID_PREFIX + '(\\d{2})(\\d+)$');

  if (lastRow > 1) {
    var idValues = sheet.getRange(2, APPLICATIONS_CONFIG.COLUMNS.ID, lastRow - 1, 1).getValues();
    for (var i = 0; i < idValues.length; i++) {
      var rawId = String(idValues[i][0] || '').trim();
      if (!rawId) continue;

      var match = rawId.match(pattern);
      if (!match) continue;
      if (match[1] !== yearSuffix) continue;

      var sequence = Number(match[2]);
      if (!isNaN(sequence) && sequence > maxSequence) {
        maxSequence = sequence;
      }
    }
  }

  var nextSequence = Utilities.formatString('%0' + OPPORTUNITY_ID_DIGITS + 'd', maxSequence + 1);
  return OPPORTUNITY_ID_PREFIX + yearSuffix + nextSequence;
}

/**
 * Update existing opportunity
 */
function updateOpportunity(id, data) {
  try {
    const sheet = getOpportunitiesSheet();
    const lastRow = sheet.getLastRow();
    const col = APPLICATIONS_CONFIG.COLUMNS;
    
    // Find row
    let targetRow = -1;
    const range = sheet.getRange(2, 1, lastRow - 1, 1);
    const values = range.getValues();
    
    for (let i = 0; i < values.length; i++) {
      if (values[i][0] === id) {
        targetRow = i + 2;
        break;
      }
    }

    if (targetRow === -1) {
      return { success: false, message: 'Opportunity not found' };
    }

    // Update fields
    if (data.title !== undefined) sheet.getRange(targetRow, col.TITLE).setValue(data.title);
    if (data.description !== undefined) sheet.getRange(targetRow, col.DESCRIPTION).setValue(data.description);
    if (data.startDate !== undefined) sheet.getRange(targetRow, col.START_DATE).setValue(normalizeOpportunityDateForStorage_(data.startDate));
    if (data.endDate !== undefined) sheet.getRange(targetRow, col.END_DATE).setValue(normalizeOpportunityDateForStorage_(data.endDate));
    if (data.status !== undefined) sheet.getRange(targetRow, col.STATUS).setValue(data.status);
    if (data.visibility !== undefined) sheet.getRange(targetRow, col.VISIBILITY).setValue(data.visibility);
    if (data.link !== undefined) sheet.getRange(targetRow, col.LINK).setValue(data.link);

    SpreadsheetApp.flush();

    return {
      success: true,
      message: 'Opportunity updated successfully'
    };

  } catch (error) {
    console.error('Error updating opportunity:', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Delete opportunity
 */
function deleteOpportunity(id) {
  try {
    const sheet = getOpportunitiesSheet();
    const lastRow = sheet.getLastRow();
    
    let targetRow = -1;
    const range = sheet.getRange(2, 1, lastRow - 1, 1);
    const values = range.getValues();
    
    for (let i = 0; i < values.length; i++) {
      if (values[i][0] === id) {
        targetRow = i + 2;
        break;
      }
    }

    if (targetRow === -1) {
      return { success: false, message: 'Opportunity not found' };
    }

    sheet.deleteRow(targetRow);
    SpreadsheetApp.flush();

    return {
      success: true,
      message: 'Opportunity deleted successfully'
    };

  } catch (error) {
    console.error('Error deleting opportunity:', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Get or create the Opportunities sheet
 */
function getOpportunitiesSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(APPLICATIONS_CONFIG.SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(APPLICATIONS_CONFIG.SHEET_NAME);
    initializeOpportunitiesSheet(sheet);
  }
  
  return sheet;
}

/**
 * Initialize Opportunities sheet with headers
 */
function initializeOpportunitiesSheet(sheet) {
  const headers = ['ID', 'Title', 'Description', 'StartDate', 'EndDate', 'Status', 'Visibility', 'Link'];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Format headers
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#f6421f');
  headerRange.setFontColor('#ffffff');
  
  // Auto-resize columns
  for (let i = 1; i <= headers.length; i++) {
    sheet.autoResizeColumn(i);
  }
}

function parseOpportunityDateValue_(value) {
  if (!value) return null;

  if (Object.prototype.toString.call(value) === '[object Date]') {
    return isNaN(value.getTime()) ? null : value;
  }

  var raw = String(value).trim();
  if (!raw) return null;

  // Interpret datetime-local values as Asia/Manila local time.
  var manilaMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (manilaMatch) {
    var year = parseInt(manilaMatch[1], 10);
    var month = parseInt(manilaMatch[2], 10);
    var day = parseInt(manilaMatch[3], 10);
    var hour = parseInt(manilaMatch[4], 10);
    var minute = parseInt(manilaMatch[5], 10);
    var second = manilaMatch[6] ? parseInt(manilaMatch[6], 10) : 0;
    return new Date(Date.UTC(year, month - 1, day, hour - 8, minute, second));
  }

  var parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeOpportunityDateForStorage_(value) {
  if (!value) return '';
  var parsed = parseOpportunityDateValue_(value);
  if (!parsed) return value;
  return parsed.toISOString();
}

function formatDateForApi_(value) {
  if (!value) return '';
  var parsed = parseOpportunityDateValue_(value);
  if (!parsed) return String(value);
  return parsed.toISOString();
}

// =================== APPLICANT SHEET SYNC ===================

function syncApplicantSheet_(sheetUrl) {
  var normalizedUrl = String(sheetUrl || '').trim();
  if (!normalizedUrl) {
    return { success: false, error: 'Google Sheet link is required' };
  }

  var syncResult = readApplicantsFromSheetUrl_(normalizedUrl);
  if (!syncResult.success) {
    return syncResult;
  }

  var syncedAt = new Date().toISOString();
  setApplicantSyncSetting_(APPLICANT_SYNC_CONFIG.SETTINGS_KEYS.SHEET_URL, normalizedUrl);
  setApplicantSyncSetting_(APPLICANT_SYNC_CONFIG.SETTINGS_KEYS.LAST_SYNCED_AT, syncedAt);

  return {
    success: true,
    data: {
      sheetUrl: normalizedUrl,
      sheetName: syncResult.sheetName || '',
      headers: syncResult.headers || [],
      rowCount: syncResult.rowCount || 0,
      syncedAt: syncedAt,
      applicants: syncResult.applicants || []
    }
  };
}

function getSyncedApplicantSheetData_() {
  var savedSheetUrl = getApplicantSyncSetting_(APPLICANT_SYNC_CONFIG.SETTINGS_KEYS.SHEET_URL);
  var syncedAt = getApplicantSyncSetting_(APPLICANT_SYNC_CONFIG.SETTINGS_KEYS.LAST_SYNCED_AT) || '';

  if (!savedSheetUrl) {
    return {
      success: true,
      data: {
        sheetUrl: '',
        sheetName: '',
        headers: [],
        rowCount: 0,
        syncedAt: '',
        applicants: []
      }
    };
  }

  var syncResult = readApplicantsFromSheetUrl_(savedSheetUrl);
  if (!syncResult.success) {
    return {
      success: false,
      error: syncResult.error || 'Failed to read saved applicant sheet',
      data: {
        sheetUrl: savedSheetUrl,
        sheetName: '',
        headers: [],
        rowCount: 0,
        syncedAt: syncedAt,
        applicants: []
      }
    };
  }

  return {
    success: true,
    data: {
      sheetUrl: savedSheetUrl,
      sheetName: syncResult.sheetName || '',
      headers: syncResult.headers || [],
      rowCount: syncResult.rowCount || 0,
      syncedAt: syncedAt,
      applicants: syncResult.applicants || []
    }
  };
}

function readApplicantsFromSheetUrl_(sheetUrl) {
  try {
    var spreadsheetId = extractSpreadsheetId_(sheetUrl);
    if (!spreadsheetId) {
      return { success: false, error: 'Invalid Google Sheet link' };
    }

    var gid = extractSheetGid_(sheetUrl);
    var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    var sheet = getSheetFromSpreadsheet_(spreadsheet, gid);
    if (!sheet) {
      return { success: false, error: 'Unable to resolve sheet tab from the provided link' };
    }

    var range = sheet.getDataRange();
    var values = range.getValues();
    if (!values || values.length === 0) {
      return {
        success: true,
        sheetName: sheet.getName(),
        headers: [],
        rowCount: 0,
        applicants: []
      };
    }

    var headers = values[0].map(function(cell) { return String(cell || '').trim(); });
    var applicants = [];
    for (var i = 1; i < values.length; i++) {
      var row = values[i];
      if (!hasAnyData_(row)) continue;
      applicants.push(mapApplicantRow_(headers, row, i));
    }

    return {
      success: true,
      sheetName: sheet.getName(),
      headers: headers,
      rowCount: applicants.length,
      applicants: applicants
    };
  } catch (error) {
    console.error('Error reading applicants from sheet URL:', error);
    return { success: false, error: error && error.message ? error.message : 'Failed to parse Google Sheet data' };
  }
}

function getApplicantSyncSettingsSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(APPLICANT_SYNC_CONFIG.SETTINGS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(APPLICANT_SYNC_CONFIG.SETTINGS_SHEET_NAME);
    sheet.getRange(1, 1, 1, APPLICANT_SYNC_CONFIG.SETTINGS_HEADERS.length).setValues([APPLICANT_SYNC_CONFIG.SETTINGS_HEADERS]);
    sheet.getRange(1, 1, 1, APPLICANT_SYNC_CONFIG.SETTINGS_HEADERS.length).setFontWeight('bold');
  }
  return sheet;
}

function getApplicantSyncSetting_(key) {
  var sheet = getApplicantSyncSettingsSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return '';

  var values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || '') === key) {
      return String(values[i][1] || '');
    }
  }
  return '';
}

function setApplicantSyncSetting_(key, value) {
  var sheet = getApplicantSyncSettingsSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    sheet.getRange(2, 1, 1, 3).setValues([[key, value, new Date().toISOString()]]);
    return;
  }

  var values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || '') === key) {
      sheet.getRange(i + 2, 2).setValue(value);
      sheet.getRange(i + 2, 3).setValue(new Date().toISOString());
      return;
    }
  }

  sheet.getRange(lastRow + 1, 1, 1, 3).setValues([[key, value, new Date().toISOString()]]);
}

function extractSpreadsheetId_(input) {
  var raw = String(input || '').trim();
  if (!raw) return '';

  var urlMatch = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch && urlMatch[1]) return urlMatch[1];

  var idMatch = raw.match(/^[a-zA-Z0-9-_]{25,}$/);
  if (idMatch) return raw;

  return '';
}

function extractSheetGid_(input) {
  var raw = String(input || '').trim();
  if (!raw) return null;

  var match = raw.match(/[?#&]gid=(\d+)/);
  if (!match || !match[1]) return null;

  var gid = parseInt(match[1], 10);
  return isNaN(gid) ? null : gid;
}

function getSheetFromSpreadsheet_(spreadsheet, gid) {
  if (gid !== null && gid !== undefined) {
    var sheets = spreadsheet.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      if (sheets[i].getSheetId() === gid) {
        return sheets[i];
      }
    }
  }
  return spreadsheet.getSheets()[0] || null;
}

function hasAnyData_(row) {
  if (!row || row.length === 0) return false;
  for (var i = 0; i < row.length; i++) {
    if (String(row[i] || '').trim() !== '') return true;
  }
  return false;
}

function normalizeHeaderKey_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function toLogPreview_(value) {
  var text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= 140) return text;
  return text.slice(0, 140) + '...';
}

function logMappingDebug_(message, payload) {
  if (!isGeminiDebugEnabled_()) return;
  try {
    console.log('[Applicants Mapping Debug] ' + message, payload || {});
  } catch (e) {
    // no-op
  }
}

function readCellByAliases_(headers, row, aliases) {
  var normalizedAliases = [];
  for (var i = 0; i < aliases.length; i++) normalizedAliases.push(normalizeHeaderKey_(aliases[i]));

  // 1) Exact normalized match
  for (var h = 0; h < headers.length; h++) {
    var key = normalizeHeaderKey_(headers[h]);
    for (var a = 0; a < normalizedAliases.length; a++) {
      if (key && key === normalizedAliases[a]) {
        return { value: row[h], header: String(headers[h] || '') };
      }
    }
  }

  // 2) Loose contains match (smart fallback)
  for (var h2 = 0; h2 < headers.length; h2++) {
    var key2 = normalizeHeaderKey_(headers[h2]);
    if (!key2) continue;
    for (var a2 = 0; a2 < normalizedAliases.length; a2++) {
      var alias = normalizedAliases[a2];
      if (!alias) continue;
      if (key2.indexOf(alias) !== -1 || alias.indexOf(key2) !== -1) {
        return { value: row[h2], header: String(headers[h2] || '') };
      }
    }
  }
  return { value: '', header: '' };
}

function readCellByKeywords_(headers, row, includeWords, excludeWords) {
  var exclude = excludeWords || [];
  var normalizedIncludes = includeWords.map(function(w) { return normalizeHeaderKey_(w); }).filter(Boolean);
  var normalizedExcludes = exclude.map(function(w) { return normalizeHeaderKey_(w); }).filter(Boolean);

  for (var h = 0; h < headers.length; h++) {
    var key = normalizeHeaderKey_(headers[h]);
    if (!key) continue;

    var hasInclude = false;
    for (var i = 0; i < normalizedIncludes.length; i++) {
      if (key.indexOf(normalizedIncludes[i]) !== -1) {
        hasInclude = true;
        break;
      }
    }
    if (!hasInclude) continue;

    var hasExclude = false;
    for (var e = 0; e < normalizedExcludes.length; e++) {
      if (key.indexOf(normalizedExcludes[e]) !== -1) {
        hasExclude = true;
        break;
      }
    }
    if (hasExclude) continue;

    return { value: row[h], header: String(headers[h] || '') };
  }

  return { value: '', header: '' };
}

function registerUsedHeader_(usedHeaders, header) {
  var normalized = normalizeHeaderKey_(header);
  if (normalized) usedHeaders[normalized] = true;
}

function pickCell_(headers, row, aliases, usedHeaders, fallbackIncludeWords, fallbackExcludeWords, debugFieldName) {
  var primary = readCellByAliases_(headers, row, aliases || []);
  if (String(primary.header || '').trim()) {
    registerUsedHeader_(usedHeaders, primary.header);
    if (debugFieldName) {
      logMappingDebug_('pickCell primary match', {
        field: debugFieldName,
        header: String(primary.header || ''),
        valuePreview: toLogPreview_(primary.value)
      });
    }
    return primary.value;
  }

  if (fallbackIncludeWords && fallbackIncludeWords.length > 0) {
    var fallback = readCellByKeywords_(headers, row, fallbackIncludeWords, fallbackExcludeWords || []);
    if (String(fallback.header || '').trim()) {
      registerUsedHeader_(usedHeaders, fallback.header);
      if (debugFieldName) {
        logMappingDebug_('pickCell fallback match', {
          field: debugFieldName,
          header: String(fallback.header || ''),
          valuePreview: toLogPreview_(fallback.value)
        });
      }
      return fallback.value;
    }
  }

  if (debugFieldName) {
    logMappingDebug_('pickCell no match', { field: debugFieldName });
  }
  return '';
}

function escapeRegex_(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readCellStrictByAliases_(headers, row, aliases) {
  var normalizedAliases = {};
  for (var i = 0; i < aliases.length; i++) {
    var n = normalizeHeaderKey_(aliases[i]);
    if (n) normalizedAliases[n] = true;
  }
  for (var h = 0; h < headers.length; h++) {
    var key = normalizeHeaderKey_(headers[h]);
    if (key && normalizedAliases[key]) {
      return { value: row[h], header: String(headers[h] || '') };
    }
  }
  return { value: '', header: '' };
}

function pickSocialCell_(headers, row, usedHeaders, platform) {
  var config = {
    facebook: {
      strictAliases: ['facebook', 'facebook link', 'facebook account', 'facebook and messenger account', 'fb link'],
      strongTokens: ['facebook']
    },
    instagram: {
      strictAliases: ['instagram', 'instagram link', 'instagram account', 'ig', 'ig link'],
      strongTokens: ['instagram']
    },
    twitter: {
      strictAliases: ['twitter', 'twitter link', 'x link', 'xlink', 'x account'],
      strongTokens: ['twitter', 'xlink']
    }
  };
  var rules = config[platform];
  if (!rules) return '';

  var strict = readCellStrictByAliases_(headers, row, rules.strictAliases);
  if (String(strict.header || '').trim()) {
    registerUsedHeader_(usedHeaders, strict.header);
    logMappingDebug_('social strict match', {
      platform: platform,
      header: strict.header,
      valuePreview: toLogPreview_(strict.value)
    });
    return strict.value;
  }

  for (var h = 0; h < headers.length; h++) {
    var rawHeader = String(headers[h] || '').trim();
    var normalizedHeader = normalizeHeaderKey_(rawHeader);
    if (!normalizedHeader || usedHeaders[normalizedHeader]) continue;

    var hasStrong = false;
    for (var t = 0; t < rules.strongTokens.length; t++) {
      if (normalizedHeader.indexOf(normalizeHeaderKey_(rules.strongTokens[t])) !== -1) {
        hasStrong = true;
        break;
      }
    }
    if (!hasStrong) continue;

    registerUsedHeader_(usedHeaders, rawHeader);
    logMappingDebug_('social token match', {
      platform: platform,
      header: rawHeader,
      valuePreview: toLogPreview_(row[h])
    });
    return row[h];
  }

  for (var v = 0; v < headers.length; v++) {
    var rawHeader2 = String(headers[v] || '').trim();
    var normalizedHeader2 = normalizeHeaderKey_(rawHeader2);
    if (!normalizedHeader2 || usedHeaders[normalizedHeader2]) continue;
    var value = toStringValue_(row[v]);
    if (!value || !isLikelyPlatformLink_(value, platform)) continue;

    registerUsedHeader_(usedHeaders, rawHeader2);
    logMappingDebug_('social URL match', {
      platform: platform,
      header: rawHeader2,
      valuePreview: toLogPreview_(value)
    });
    return value;
  }

  logMappingDebug_('social no match', { platform: platform });
  return '';
}

function collectAdditionalFields_(headers, row, usedHeaders) {
  var extra = {};
  var seenHeaders = {};
  var seenValues = {};
  for (var i = 0; i < headers.length; i++) {
    var headerLabel = String(headers[i] || '').trim();
    var normalized = normalizeHeaderKey_(headerLabel);
    if (!headerLabel || !normalized) continue;
    if (usedHeaders[normalized]) continue;
    if (seenHeaders[normalized]) continue;

    var value = toStringValue_(row[i]);
    if (!value) continue;
    var normalizedValue = normalizeHeaderKey_(value);
    if (normalizedValue && seenValues[normalized + '|' + normalizedValue]) continue;

    extra[headerLabel] = value;
    seenHeaders[normalized] = true;
    if (normalizedValue) seenValues[normalized + '|' + normalizedValue] = true;
  }
  return extra;
}

function applyExplicitHeaderMappings_(headers, row, usedHeaders, fullData) {
  var manualAdditional = {};
  var addressParts = {
    street: '',
    barangay: '',
    city: '',
    province: '',
    zipCode: ''
  };

  for (var i = 0; i < headers.length; i++) {
    var rawHeader = String(headers[i] || '').trim();
    var normalizedHeader = normalizeHeaderKey_(rawHeader);
    if (!normalizedHeader || usedHeaders[normalizedHeader]) continue;

    var value = toStringValue_(row[i]);
    if (isEmptyLike_(value)) continue;

    if (
      normalizedHeader === 'dataprivacyagreement' ||
      normalizedHeader.indexOf('dataprivacy') !== -1
    ) {
      registerUsedHeader_(usedHeaders, rawHeader);
      logMappingDebug_('explicit skip data privacy header', { header: rawHeader });
      continue;
    }

    if (normalizedHeader === 'gender' || normalizedHeader === 'sex') {
      if (!hasFieldValue_(fullData.gender)) fullData.gender = value;
      registerUsedHeader_(usedHeaders, rawHeader);
      logMappingDebug_('explicit map gender', { header: rawHeader, valuePreview: toLogPreview_(value) });
      continue;
    }

    if (
      normalizedHeader === 'completepermanentaddress' ||
      normalizedHeader === 'permanentaddress' ||
      normalizedHeader === 'homeaddress' ||
      normalizedHeader === 'currentaddress'
    ) {
      addressParts.street = value;
      if (!hasFieldValue_(fullData.address)) fullData.address = value;
      registerUsedHeader_(usedHeaders, rawHeader);
      logMappingDebug_('explicit map address street', { header: rawHeader, valuePreview: toLogPreview_(value) });
      continue;
    }

    if (normalizedHeader === 'barangay') {
      addressParts.barangay = value;
      registerUsedHeader_(usedHeaders, rawHeader);
      logMappingDebug_('explicit map barangay', { header: rawHeader, valuePreview: toLogPreview_(value) });
      continue;
    }

    if (normalizedHeader === 'city' || normalizedHeader === 'municipality') {
      addressParts.city = value;
      registerUsedHeader_(usedHeaders, rawHeader);
      logMappingDebug_('explicit map city', { header: rawHeader, valuePreview: toLogPreview_(value) });
      continue;
    }

    if (normalizedHeader === 'province') {
      addressParts.province = value;
      registerUsedHeader_(usedHeaders, rawHeader);
      logMappingDebug_('explicit map province', { header: rawHeader, valuePreview: toLogPreview_(value) });
      continue;
    }

    if (normalizedHeader === 'zipcode' || normalizedHeader === 'postalcode' || normalizedHeader === 'zip') {
      addressParts.zipCode = value;
      registerUsedHeader_(usedHeaders, rawHeader);
      logMappingDebug_('explicit map zip', { header: rawHeader, valuePreview: toLogPreview_(value) });
      continue;
    }

    if (
      normalizedHeader === 'youthservicebarangaydesignation' ||
      normalizedHeader === 'barangaydesignation'
    ) {
      if (!hasFieldValue_(fullData.chapter)) fullData.chapter = value;
      registerUsedHeader_(usedHeaders, rawHeader);
      logMappingDebug_('explicit map chapter from barangay designation', {
        header: rawHeader,
        valuePreview: toLogPreview_(value)
      });
      continue;
    }

    if (normalizedHeader === 'referenceid' || normalizedHeader === 'reference') {
      manualAdditional['Reference ID'] = value;
      registerUsedHeader_(usedHeaders, rawHeader);
      logMappingDebug_('explicit map reference id', { header: rawHeader, valuePreview: toLogPreview_(value) });
      continue;
    }
  }

  // Build a full address only when we still do not have a mapped one.
  if (!hasFieldValue_(fullData.address)) {
    var composedParts = [];
    if (hasFieldValue_(addressParts.street)) composedParts.push(addressParts.street);
    if (hasFieldValue_(addressParts.barangay)) composedParts.push('Brgy. ' + addressParts.barangay);
    if (hasFieldValue_(addressParts.city)) composedParts.push(addressParts.city);
    if (hasFieldValue_(addressParts.province)) composedParts.push(addressParts.province);
    if (hasFieldValue_(addressParts.zipCode)) composedParts.push(addressParts.zipCode);
    if (composedParts.length > 0) {
      fullData.address = composedParts.join(', ');
      logMappingDebug_('explicit composed address', { valuePreview: toLogPreview_(fullData.address) });
    }
  }

  return manualAdditional;
}

function parseLabeledValue_(text, labels, nextLabels) {
  var source = String(text || '');
  if (!source) return '';
  var labelRegex = labels.map(escapeRegex_).join('|');
  var stopRegex = nextLabels.map(escapeRegex_).join('|');
  var pattern = new RegExp('(?:^|\\b)(?:' + labelRegex + ')\\s*:\\s*([\\s\\S]*?)(?=(?:\\b(?:' + stopRegex + ')\\s*:)|$)', 'i');
  var match = source.match(pattern);
  if (!match || !match[1]) return '';
  return String(match[1]).trim();
}

function extractFirstUrlByPlatform_(text, platform) {
  var source = String(text || '');
  if (!source) return '';
  var urls = source.match(/https?:\/\/[^\s)]+/gi) || [];
  for (var i = 0; i < urls.length; i++) {
    if (isLikelyPlatformLink_(urls[i], platform)) return urls[i];
  }
  return '';
}

function isCompositeApplicationBlob_(text) {
  var key = normalizeHeaderKey_(text);
  if (!key) return false;
  var hits = 0;
  if (key.indexOf('completepermanentaddress') !== -1 || key.indexOf('address') !== -1) hits++;
  if (key.indexOf('facebookandmessengeraccount') !== -1 || key.indexOf('facebook') !== -1) hits++;
  if (key.indexOf('personalemailaddress') !== -1 || key.indexOf('email') !== -1) hits++;
  if (key.indexOf('referenceid') !== -1) hits++;
  return hits >= 2;
}

function enrichFromCompositeText_(fullData, additionalFields) {
  if (!additionalFields) return;
  var blobs = [];
  var keys = Object.keys(additionalFields);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    var v = String(additionalFields[k] || '');
    var merged = (String(k || '') + ' ' + v).trim();
    if (isCompositeApplicationBlob_(merged)) {
      blobs.push(merged);
    }
  }
  if (blobs.length === 0) return;

  var text = blobs.join('\n');
  var stopLabels = [
    'Personal Email Address',
    'Complete Permanent Address',
    'Address',
    'Barangay',
    'City',
    'Province',
    'Zip Code',
    'Youth Service Barangay Designation',
    'Facebook and Messenger Account',
    'Facebook',
    'Instagram',
    'Twitter',
    'Reference ID',
    'Gender'
  ];

  var extractedAddress = parseLabeledValue_(text, ['Complete Permanent Address', 'Address'], stopLabels);
  if (!hasFieldValue_(fullData.address) && hasFieldValue_(extractedAddress)) {
    fullData.address = extractedAddress;
  }

  var extractedFacebook = extractFirstUrlByPlatform_(text, 'facebook');
  if (!hasFieldValue_(fullData.facebook) && hasFieldValue_(extractedFacebook)) {
    fullData.facebook = extractedFacebook;
  }

  var extractedInstagram = extractFirstUrlByPlatform_(text, 'instagram');
  if (!hasFieldValue_(fullData.instagram) && hasFieldValue_(extractedInstagram)) {
    fullData.instagram = extractedInstagram;
  }

  var extractedTwitter = extractFirstUrlByPlatform_(text, 'twitter');
  if (!hasFieldValue_(fullData.twitter) && hasFieldValue_(extractedTwitter)) {
    fullData.twitter = extractedTwitter;
  }

  logMappingDebug_('composite blob enrichment', {
    address: toLogPreview_(fullData.address),
    facebook: toLogPreview_(fullData.facebook),
    instagram: toLogPreview_(fullData.instagram),
    twitter: toLogPreview_(fullData.twitter)
  });

  // Remove huge composite entries once extracted so "Additional Form Fields" stays readable.
  var cleaned = {};
  for (var j = 0; j < keys.length; j++) {
    var key = keys[j];
    var combined = (String(key || '') + ' ' + String(additionalFields[key] || '')).trim();
    if (!isCompositeApplicationBlob_(combined)) cleaned[key] = additionalFields[key];
  }
  fullData.additionalFields = cleaned;
}

function sanitizeStatus_(value) {
  var normalized = String(value || 'pending').toLowerCase().trim();
  if (normalized === 'approved' || normalized === 'rejected' || normalized === 'pending') {
    return normalized;
  }
  return 'pending';
}

function toIsoStringOrNow_(value) {
  if (!value) return new Date().toISOString();
  if (Object.prototype.toString.call(value) === '[object Date]') {
    if (!isNaN(value.getTime())) return value.toISOString();
    return new Date().toISOString();
  }
  var parsed = new Date(String(value));
  if (!isNaN(parsed.getTime())) return parsed.toISOString();
  return new Date().toISOString();
}

function toNumberOrZero_(value) {
  var n = parseInt(String(value || ''), 10);
  return isNaN(n) ? 0 : n;
}

function toStringValue_(value) {
  return String(value || '').trim();
}

function extractDriveFileId_(value) {
  var raw = String(value || '').trim();
  if (!raw) return '';

  var filePathMatch = raw.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (filePathMatch && filePathMatch[1]) return filePathMatch[1];

  var openIdMatch = raw.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (openIdMatch && openIdMatch[1]) return openIdMatch[1];

  var googleusercontentMatch = raw.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
  if (googleusercontentMatch && googleusercontentMatch[1]) return googleusercontentMatch[1];

  var bareIdMatch = raw.match(/\b[a-zA-Z0-9_-]{20,}\b/);
  if (bareIdMatch && bareIdMatch[0]) return bareIdMatch[0];

  return '';
}

function toAttachmentThumbnailUrl_(value) {
  var raw = String(value || '').trim();
  if (!raw) return '';
  var driveId = extractDriveFileId_(raw);
  if (driveId) return 'https://drive.google.com/thumbnail?id=' + driveId + '&sz=w4000';
  return raw;
}

function inferImageMimeTypeFromUrl_(url) {
  var lower = String(url || '').toLowerCase();
  if (lower.indexOf('.jpg') !== -1 || lower.indexOf('.jpeg') !== -1) return 'image/jpeg';
  if (lower.indexOf('.png') !== -1) return 'image/png';
  if (lower.indexOf('.webp') !== -1) return 'image/webp';
  if (lower.indexOf('.gif') !== -1) return 'image/gif';
  return 'image/jpeg';
}

function inferImageMimeTypeFromBytes_(bytes) {
  if (!bytes || bytes.length < 12) return '';
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'image/png';
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return 'image/gif';
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return 'image/webp';
  return '';
}

function buildImageDataUrlFromBlob_(blob, sourceUrlForHint) {
  if (!blob) return '';
  var bytes = blob.getBytes();
  if (!bytes || bytes.length === 0) return '';

  var contentType = String(blob.getContentType() || '').toLowerCase().trim();
  if (!contentType || contentType.indexOf('image/') !== 0) {
    contentType = inferImageMimeTypeFromBytes_(bytes);
  }
  if (!contentType || contentType.indexOf('image/') !== 0) {
    contentType = inferImageMimeTypeFromUrl_(sourceUrlForHint);
  }
  if (!contentType || contentType.indexOf('image/') !== 0) return '';

  return 'data:' + contentType + ';base64,' + Utilities.base64Encode(bytes);
}

function buildApplicantImageCandidates_(rawUrl) {
  var raw = String(rawUrl || '').trim();
  if (!raw) return [];

  var urls = raw.match(/https?:\/\/[^\s<>"')]+/gi) || [];
  var seen = {};
  var out = [];

  function push(url) {
    var cleaned = String(url || '').replace(/[),.;]+$/, '').trim();
    if (!cleaned || seen[cleaned]) return;
    seen[cleaned] = true;
    out.push(cleaned);
  }

  function addDriveVariants(fileId) {
    if (!fileId) return;
    push('https://lh3.googleusercontent.com/d/' + fileId + '=s500');
    push('https://lh3.googleusercontent.com/d/' + fileId);
    push('https://drive.google.com/thumbnail?id=' + fileId + '&sz=w4000');
    push('https://drive.usercontent.google.com/download?id=' + fileId + '&export=view');
    push('https://drive.google.com/uc?export=view&id=' + fileId);
    push('https://drive.google.com/uc?export=download&id=' + fileId);
  }

  if (urls.length > 0) {
    for (var i = 0; i < urls.length; i++) {
      var idFromUrl = extractDriveFileId_(urls[i]);
      addDriveVariants(idFromUrl);
      push(urls[i]);
    }
  } else {
    var id = extractDriveFileId_(raw);
    if (id) addDriveVariants(id);
    push(raw);
  }

  return out;
}

function isLikelyUrlValue_(value) {
  var raw = String(value || '').trim().toLowerCase();
  if (!raw) return false;
  if (raw.indexOf('http://') === 0 || raw.indexOf('https://') === 0) return true;
  if (raw.indexOf('drive.google.com') !== -1) return true;
  if (raw.indexOf('docs.google.com') !== -1) return true;
  return false;
}

function isProfileHeader_(normalizedHeader) {
  if (!normalizedHeader) return false;
  if (normalizedHeader.indexOf('signature') !== -1 || normalizedHeader.indexOf('esign') !== -1) return false;

  return (
    normalizedHeader.indexOf('profile') !== -1 ||
    normalizedHeader.indexOf('formalpicture') !== -1 ||
    normalizedHeader.indexOf('formalphoto') !== -1 ||
    normalizedHeader.indexOf('displayphoto') !== -1 ||
    normalizedHeader.indexOf('displaypicture') !== -1 ||
    normalizedHeader.indexOf('1x1') !== -1 ||
    normalizedHeader.indexOf('photo') !== -1 ||
    normalizedHeader.indexOf('picture') !== -1
  );
}

function isSignatureHeader_(normalizedHeader) {
  if (!normalizedHeader) return false;
  return (
    normalizedHeader.indexOf('signature') !== -1 ||
    normalizedHeader.indexOf('esign') !== -1 ||
    normalizedHeader.indexOf('digitalsign') !== -1 ||
    normalizedHeader.indexOf('autograph') !== -1
  );
}

function shouldSkipAttachmentHeader_(normalizedHeader) {
  if (!normalizedHeader) return true;
  return (
    normalizedHeader.indexOf('facebook') !== -1 ||
    normalizedHeader.indexOf('instagram') !== -1 ||
    normalizedHeader.indexOf('twitter') !== -1 ||
    normalizedHeader.indexOf('email') !== -1 ||
    normalizedHeader.indexOf('phone') !== -1 ||
    normalizedHeader.indexOf('contact') !== -1 ||
    normalizedHeader.indexOf('mobile') !== -1 ||
    normalizedHeader.indexOf('address') !== -1 ||
    normalizedHeader.indexOf('name') !== -1 ||
    normalizedHeader.indexOf('chapter') !== -1 ||
    normalizedHeader.indexOf('committee') !== -1 ||
    normalizedHeader.indexOf('status') !== -1 ||
    normalizedHeader.indexOf('role') !== -1
  );
}

function inferAttachmentType_(normalizedHeader) {
  if (isSignatureHeader_(normalizedHeader)) return 'Signature';
  if (normalizedHeader.indexOf('resume') !== -1 || normalizedHeader.indexOf('cv') !== -1) return 'Resume';
  if (normalizedHeader.indexOf('certificate') !== -1 || normalizedHeader.indexOf('cert') !== -1) return 'Certificate';
  if (
    normalizedHeader.indexOf('validid') !== -1 ||
    normalizedHeader.indexOf('governmentid') !== -1 ||
    normalizedHeader.indexOf('idcard') !== -1 ||
    normalizedHeader.indexOf('idpicture') !== -1
  ) return 'ID';
  if (
    normalizedHeader.indexOf('attachment') !== -1 ||
    normalizedHeader.indexOf('supporting') !== -1 ||
    normalizedHeader.indexOf('document') !== -1 ||
    normalizedHeader.indexOf('file') !== -1
  ) return 'Attachment';
  return 'Attachment';
}

var GEMINI_HEADER_MAP_CACHE_ = {};
var GEMINI_CALL_COUNT_ = 0;

function isGeminiHeaderInferenceEnabled_() {
  var value = PropertiesService.getScriptProperties().getProperty(APPLICANT_AI_CONFIG.ENABLED_KEY);
  return String(value || '').toLowerCase().trim() === 'true';
}

function isGeminiDebugEnabled_() {
  var value = PropertiesService.getScriptProperties().getProperty(APPLICANT_AI_CONFIG.DEBUG_KEY);
  return String(value || '').toLowerCase().trim() === 'true';
}

function getGeminiModelName_() {
  var configured = String(
    PropertiesService.getScriptProperties().getProperty(APPLICANT_AI_CONFIG.MODEL_KEY) || ''
  ).trim();
  if (!configured) return APPLICANT_AI_CONFIG.DEFAULT_MODEL;
  if (configured.toLowerCase() === 'gemini-1.5-flash') return APPLICANT_AI_CONFIG.DEFAULT_MODEL;
  return configured;
}

function getGeminiApiKeys_() {
  var props = PropertiesService.getScriptProperties().getProperties();
  var keys = [];

  if (props.GEMINI_API_KEY) keys.push(String(props.GEMINI_API_KEY).trim());
  for (var i = 1; i <= 20; i++) {
    var keyName = 'GEMINI_API_KEY_' + i;
    if (props[keyName]) keys.push(String(props[keyName]).trim());
  }

  // Also support any key with prefix GEMINI_API_KEY_
  for (var name in props) {
    if (name.indexOf('GEMINI_API_KEY_') === 0 && keys.indexOf(String(props[name]).trim()) === -1) {
      keys.push(String(props[name]).trim());
    }
  }

  return keys.filter(function(k) { return !!k; });
}

function normalizeGeminiFieldName_(value) {
  var raw = normalizeHeaderKey_(value);
  var aliasMap = {
    fullname: 'fullName',
    name: 'fullName',
    email: 'email',
    phone: 'phone',
    contactnumber: 'phone',
    address: 'address',
    dateofbirth: 'dateOfBirth',
    dob: 'dateOfBirth',
    age: 'age',
    gender: 'gender',
    pronouns: 'pronouns',
    civilstatus: 'civilStatus',
    nationality: 'nationality',
    religion: 'religion',
    chapter: 'chapter',
    committeepreference: 'committeePreference',
    desiredrole: 'desiredRole',
    skills: 'skills',
    education: 'education',
    certifications: 'certifications',
    experience: 'experience',
    achievements: 'achievements',
    volunteerhistory: 'volunteerHistory',
    reasonforjoining: 'reasonForJoining',
    personalstatement: 'personalStatement',
    medicalconcerns: 'medicalConcerns',
    emergencycontactname: 'emergencyContactName',
    emergencycontactrelation: 'emergencyContactRelation',
    emergencycontactnumber: 'emergencyContactNumber',
    facebook: 'facebook',
    instagram: 'instagram',
    twitter: 'twitter',
    profilepicture: 'profilePicture'
  };
  return aliasMap[raw] || '';
}

function isLikelyPlatformLink_(value, platform) {
  var text = String(value || '').toLowerCase();
  if (!text) return false;
  if (platform === 'facebook') return text.indexOf('facebook.com') !== -1 || text.indexOf('fb.com') !== -1;
  if (platform === 'instagram') return text.indexOf('instagram.com') !== -1 || text.indexOf('instagr.am') !== -1;
  if (platform === 'twitter') return text.indexOf('twitter.com') !== -1 || text.indexOf('x.com') !== -1;
  return false;
}

function isPlausibleAiSuggestion_(field, header, value) {
  var normalizedHeader = normalizeHeaderKey_(header);
  var text = String(value || '');
  var textLower = text.toLowerCase();

  if (field === 'facebook') {
    return normalizedHeader.indexOf('facebook') !== -1 || normalizedHeader === 'fb' || isLikelyPlatformLink_(textLower, 'facebook');
  }
  if (field === 'instagram') {
    return normalizedHeader.indexOf('instagram') !== -1 || normalizedHeader === 'ig' || isLikelyPlatformLink_(textLower, 'instagram');
  }
  if (field === 'twitter') {
    return normalizedHeader.indexOf('twitter') !== -1 || normalizedHeader === 'x' || normalizedHeader.indexOf('xlink') !== -1 || isLikelyPlatformLink_(textLower, 'twitter');
  }
  if (field === 'profilePicture') {
    return (
      normalizedHeader.indexOf('profile') !== -1 ||
      normalizedHeader.indexOf('photo') !== -1 ||
      normalizedHeader.indexOf('picture') !== -1 ||
      normalizedHeader.indexOf('image') !== -1 ||
      normalizedHeader.indexOf('1x1') !== -1 ||
      textLower.indexOf('drive.google.com') !== -1 ||
      textLower.indexOf('googleusercontent.com') !== -1
    );
  }
  if (field === 'address') {
    return (
      normalizedHeader.indexOf('address') !== -1 ||
      normalizedHeader.indexOf('residence') !== -1 ||
      normalizedHeader.indexOf('street') !== -1 ||
      normalizedHeader.indexOf('barangay') !== -1 ||
      normalizedHeader.indexOf('city') !== -1 ||
      normalizedHeader.indexOf('province') !== -1 ||
      normalizedHeader.indexOf('zip') !== -1
    );
  }

  return true;
}

function callGeminiHeaderInference_(headerLabel, sampleValue) {
  if (!isGeminiHeaderInferenceEnabled_()) return null;
  if (GEMINI_CALL_COUNT_ >= APPLICANT_AI_CONFIG.MAX_CALLS_PER_EXECUTION) return null;

  var cacheKey = APPLICANT_AI_CONFIG.CACHE_PREFIX + normalizeHeaderKey_(headerLabel);
  if (GEMINI_HEADER_MAP_CACHE_[cacheKey]) return GEMINI_HEADER_MAP_CACHE_[cacheKey];

  var keys = getGeminiApiKeys_();
  if (keys.length === 0) return null;

  var model = getGeminiModelName_();
  var prompt =
    'You map applicant spreadsheet headers to one target field.\n' +
    'Allowed fields: fullName,email,phone,address,dateOfBirth,age,gender,pronouns,civilStatus,nationality,religion,chapter,committeePreference,desiredRole,skills,education,certifications,experience,achievements,volunteerHistory,reasonForJoining,personalStatement,medicalConcerns,emergencyContactName,emergencyContactRelation,emergencyContactNumber,facebook,instagram,twitter,profilePicture,unknown.\n' +
    'Return strict JSON only: {"field":"...", "confidence":0..1}\n' +
    'Header: "' + String(headerLabel || '') + '"\n' +
    'Sample value: "' + String(sampleValue || '') + '"';

  var payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1
    }
  };

  for (var i = 0; i < keys.length; i++) {
    var apiKey = keys[i];
    try {
      GEMINI_CALL_COUNT_++;
      var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(apiKey);
      var response = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });

      var status = response.getResponseCode();
      var bodyText = response.getContentText() || '';
      if (status >= 400) {
        // Try next key on quota/auth/rate errors.
        if (status === 401 || status === 403 || status === 429) continue;
        continue;
      }

      var body = JSON.parse(bodyText);
      var rawText =
        body &&
        body.candidates &&
        body.candidates[0] &&
        body.candidates[0].content &&
        body.candidates[0].content.parts &&
        body.candidates[0].content.parts[0] &&
        body.candidates[0].content.parts[0].text
          ? String(body.candidates[0].content.parts[0].text)
          : '';
      if (!rawText) continue;

      var parsed = JSON.parse(rawText);
      var normalizedField = normalizeGeminiFieldName_(parsed.field);
      var confidence = Number(parsed.confidence || 0);
      var result = {
        field: normalizedField,
        confidence: isNaN(confidence) ? 0 : confidence
      };
      if (isGeminiDebugEnabled_()) {
        console.log('[Applicants AI] Header inference success', {
          header: headerLabel,
          sampleValue: String(sampleValue || '').slice(0, 120),
          model: model,
          field: result.field,
          confidence: result.confidence
        });
      }
      GEMINI_HEADER_MAP_CACHE_[cacheKey] = result;
      return result;
    } catch (e) {
      // try next key
    }
  }

  return null;
}

function collectSmartFileLinks_(headers, row, usedHeaders, currentProfilePicture) {
  var attachments = [];
  var profilePicture = toStringValue_(currentProfilePicture);
  var seenUrls = {};

  for (var i = 0; i < headers.length; i++) {
    var rawHeader = String(headers[i] || '').trim();
    var normalizedHeader = normalizeHeaderKey_(rawHeader);
    if (!normalizedHeader) continue;

    var rawValue = toStringValue_(row[i]);
    if (!rawValue || !isLikelyUrlValue_(rawValue)) continue;
    if (seenUrls[rawValue]) continue;
    seenUrls[rawValue] = true;

    if (isProfileHeader_(normalizedHeader)) {
      if (!profilePicture) {
        profilePicture = rawValue;
        logMappingDebug_('profilePicture from smart file scan', {
          header: rawHeader,
          valuePreview: toLogPreview_(rawValue)
        });
      }
      registerUsedHeader_(usedHeaders, rawHeader);
      continue;
    }

    if (shouldSkipAttachmentHeader_(normalizedHeader) && !isSignatureHeader_(normalizedHeader)) {
      continue;
    }

    var attachmentType = inferAttachmentType_(normalizedHeader);
    attachments.push({
      type: attachmentType,
      name: rawHeader || attachmentType,
      url: rawValue,
      thumbnailUrl: toAttachmentThumbnailUrl_(rawValue)
    });
    logMappingDebug_('attachment detected', {
      header: rawHeader,
      attachmentType: attachmentType,
      valuePreview: toLogPreview_(rawValue)
    });
    registerUsedHeader_(usedHeaders, rawHeader);
  }

  return {
    profilePicture: profilePicture,
    attachments: attachments
  };
}

function isEmptyLike_(value) {
  var raw = String(value || '').trim().toLowerCase();
  return !raw || raw === 'n/a' || raw === 'na' || raw === 'none' || raw === '-';
}

function hasFieldValue_(value) {
  return !isEmptyLike_(value);
}

function inferApplicantFieldsFromRemainingHeaders_(headers, row, usedHeaders, fullData) {
  var rules = [
    { field: 'fullName', include: ['fullname', 'applicantname', 'completename', 'legalname'], exclude: ['guardian', 'parent', 'emergency'] },
    { field: 'email', include: ['email', 'mail'], exclude: ['guardian', 'parent', 'emergency'] },
    { field: 'phone', include: ['phone', 'mobile', 'contactnumber', 'cell'], exclude: ['guardian', 'parent', 'emergency'] },
    { field: 'address', include: ['address', 'residence', 'street', 'barangay', 'city', 'province', 'zipcode'], exclude: [] },
    { field: 'dateOfBirth', include: ['birth', 'dob', 'birthday'], exclude: [] },
    { field: 'age', include: ['age'], exclude: [] },
    { field: 'gender', include: ['gender', 'sex'], exclude: [] },
    { field: 'pronouns', include: ['pronoun'], exclude: [] },
    { field: 'civilStatus', include: ['civilstatus', 'maritalstatus'], exclude: [] },
    { field: 'religion', include: ['religion', 'faith'], exclude: [] },
    { field: 'nationality', include: ['nationality', 'citizenship'], exclude: [] },
    { field: 'chapter', include: ['chapter', 'branch'], exclude: [] },
    { field: 'committeePreference', include: ['committee', 'designation'], exclude: ['contact', 'emergency'] },
    { field: 'desiredRole', include: ['desiredrole', 'roleapplying', 'positiondesired', 'position'], exclude: ['committee'] },
    { field: 'education', include: ['education', 'school', 'yearlevel', 'course'], exclude: [] },
    { field: 'skills', include: ['skill'], exclude: [] },
    { field: 'certifications', include: ['certification', 'certificate', 'training', 'seminar'], exclude: [] },
    { field: 'experience', include: ['experience', 'employment', 'workhistory'], exclude: [] },
    { field: 'achievements', include: ['achievement', 'award', 'accomplishment'], exclude: [] },
    { field: 'volunteerHistory', include: ['volunteer'], exclude: [] },
    { field: 'reasonForJoining', include: ['reason', 'motivation', 'whyjoin'], exclude: [] },
    { field: 'personalStatement', include: ['personalstatement', 'aboutme', 'bio', 'statement'], exclude: [] },
    { field: 'medicalConcerns', include: ['medical', 'health', 'allerg', 'condition'], exclude: [] },
    { field: 'emergencyContactName', include: ['emergencycontactperson', 'emergencycontactname', 'nextofkin'], exclude: ['relation', 'relationship', 'number', 'phone'] },
    { field: 'emergencyContactRelation', include: ['emergency', 'relation', 'relationship'], exclude: ['number', 'phone', 'contactname'] },
    { field: 'emergencyContactNumber', include: ['emergency', 'number', 'phone', 'mobile', 'contactnumber'], exclude: ['name', 'relation', 'relationship'] },
    { field: 'facebook', include: ['facebook', 'messenger', 'fb'], exclude: [] },
    { field: 'instagram', include: ['instagram', 'ig'], exclude: [] },
    { field: 'twitter', include: ['twitter', 'xlink'], exclude: [] }
  ];

  for (var i = 0; i < headers.length; i++) {
    var rawHeader = String(headers[i] || '').trim();
    var normalizedHeader = normalizeHeaderKey_(rawHeader);
    if (!normalizedHeader) continue;
    if (usedHeaders[normalizedHeader]) continue;

    var value = toStringValue_(row[i]);
    if (isEmptyLike_(value)) continue;

    var bestField = '';
    var bestScore = 0;
    for (var r = 0; r < rules.length; r++) {
      var rule = rules[r];
      var blocked = false;
      for (var ex = 0; ex < rule.exclude.length; ex++) {
        if (normalizedHeader.indexOf(normalizeHeaderKey_(rule.exclude[ex])) !== -1) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;

      var score = 0;
      for (var inc = 0; inc < rule.include.length; inc++) {
        var key = normalizeHeaderKey_(rule.include[inc]);
        if (!key) continue;
        if (normalizedHeader === key) score += 8;
        else if (normalizedHeader.indexOf(key) !== -1) score += 4;
      }
      if (score > bestScore) {
        bestScore = score;
        bestField = rule.field;
      }
    }

    if (!bestField || bestScore <= 0) {
      var aiSuggestion = callGeminiHeaderInference_(rawHeader, value);
      if (aiSuggestion && aiSuggestion.field && aiSuggestion.confidence >= 0.65) {
        if (!isPlausibleAiSuggestion_(aiSuggestion.field, rawHeader, value)) {
          logMappingDebug_('AI suggestion rejected (implausible)', {
            header: rawHeader,
            suggestedField: aiSuggestion.field,
            confidence: aiSuggestion.confidence,
            valuePreview: toLogPreview_(value)
          });
          continue;
        }
        if (isGeminiDebugEnabled_()) {
          console.log('[Applicants AI] Applied AI field mapping', {
            header: rawHeader,
            mappedField: aiSuggestion.field,
            confidence: aiSuggestion.confidence
          });
        }
        bestField = aiSuggestion.field;
      } else {
        if (isGeminiDebugEnabled_()) {
          console.log('[Applicants AI] Unmapped header kept in additional fields', {
            header: rawHeader,
            sampleValue: String(value || '').slice(0, 120)
          });
        }
        continue;
      }
    } else if (isGeminiDebugEnabled_()) {
      console.log('[Applicants AI] Rule-based mapping', {
        header: rawHeader,
        mappedField: bestField,
        ruleScore: bestScore
      });
    }

    if (bestField === 'age') {
      if (!hasFieldValue_(String(fullData.age || ''))) {
        fullData.age = toNumberOrZero_(value);
        registerUsedHeader_(usedHeaders, rawHeader);
      }
      continue;
    }

    if (!hasFieldValue_(fullData[bestField])) {
      fullData[bestField] = value;
      registerUsedHeader_(usedHeaders, rawHeader);
    }
  }
}

function mapApplicantRow_(headers, row, rowIndex) {
  var usedHeaders = {};
  logMappingDebug_('map row start', {
    rowIndex: rowIndex,
    headerCount: headers.length
  });

  var fullName = toStringValue_(pickCell_(
    headers, row,
    ['full name', 'fullname', 'name', 'applicant name', 'first name', 'complete name'],
    usedHeaders,
    ['name'],
    ['username', 'parent', 'guardian'],
    'fullName'
  ));
  var email = toStringValue_(pickCell_(
    headers, row,
    ['email', 'email address', 'personal email address', 'gmail', 'e-mail'],
    usedHeaders,
    ['email', 'mail'],
    ['parent', 'guardian', 'emergency'],
    'email'
  ));
  var phone = toStringValue_(pickCell_(
    headers, row,
    ['phone', 'phone number', 'contact', 'contact number', 'mobile', 'cellphone', 'cp number'],
    usedHeaders,
    ['phone', 'contact', 'mobile', 'cell'],
    ['emergency', 'parent', 'guardian'],
    'phone'
  ));
  var committee = toStringValue_(pickCell_(
    headers, row,
    ['committee', 'committee preference', 'committee preferred', 'committee choice'],
    usedHeaders,
    ['committee'],
    []
  ));
  var status = sanitizeStatus_(pickCell_(
    headers, row,
    ['status', 'application status'],
    usedHeaders,
    ['status'],
    []
  ));
  var dateApplied = toIsoStringOrNow_(pickCell_(
    headers, row,
    ['date applied', 'applied at', 'timestamp', 'application date', 'date'],
    usedHeaders,
    ['date', 'time', 'timestamp'],
    ['birth']
  ));
  var recordId = toStringValue_(pickCell_(
    headers, row,
    ['id', 'application id', 'record id', 'entry id'],
    usedHeaders,
    ['id'],
    []
  ));
  // Ignore URL-like values for record IDs (e.g., "Valid ID" drive links).
  if (recordId && isLikelyUrlValue_(recordId)) {
    recordId = '';
  }
  if (!recordId) {
    recordId = 'APP-' + String(new Date().getTime()) + '-' + String(rowIndex);
  }

  var desiredRole = toStringValue_(pickCell_(
    headers, row,
    ['desired role', 'role', 'position desired', 'desired position', 'role applying for'],
    usedHeaders,
    ['role', 'position'],
    ['committee']
  ));
  var chapter = toStringValue_(pickCell_(
    headers, row,
    ['chapter', 'chapter name', 'branch'],
    usedHeaders,
    ['chapter', 'branch'],
    []
  ));

  var fullData = {
    fullName: fullName || 'Unnamed Applicant',
    email: email,
    phone: phone,
    address: toStringValue_(pickCell_(
      headers, row,
      ['address', 'home address', 'current address', 'complete address', 'residence'],
      usedHeaders,
      ['address', 'street', 'barangay', 'city', 'municipality', 'province'],
      [],
      'address'
    )),
    dateOfBirth: toStringValue_(pickCell_(
      headers, row,
      ['date of birth', 'birthday', 'birthdate', 'dob'],
      usedHeaders,
      ['birth', 'dob'],
      []
    )),
    age: toNumberOrZero_(pickCell_(headers, row, ['age'], usedHeaders, ['age'], [])),
    gender: toStringValue_(pickCell_(headers, row, ['gender', 'sex'], usedHeaders, ['gender', 'sex'], [])),
    civilStatus: toStringValue_(pickCell_(headers, row, ['civil status', 'marital status'], usedHeaders, ['civil', 'marital'], [])),
    nationality: toStringValue_(pickCell_(headers, row, ['nationality', 'citizenship'], usedHeaders, ['nationality', 'citizenship'], [])),
    chapter: chapter,
    committeePreference: committee,
    desiredRole: desiredRole,
    skills: toStringValue_(pickCell_(headers, row, ['skills', 'skill set', 'core skills'], usedHeaders, ['skill'], [])),
    education: toStringValue_(pickCell_(headers, row, ['education', 'educational background', 'school', 'school and year level'], usedHeaders, ['education', 'school', 'yearlevel'], [])),
    pronouns: toStringValue_(pickCell_(headers, row, ['pronouns', 'preferred pronouns'], usedHeaders, ['pronoun'], [])),
    religion: toStringValue_(pickCell_(headers, row, ['religion', 'faith'], usedHeaders, ['religion', 'faith'], [])),
    medicalConcerns: toStringValue_(pickCell_(headers, row, ['medical conditions', 'health concerns', 'allergies', 'existing medical conditions'], usedHeaders, ['medical', 'health', 'allerg', 'condition'], [])),
    certifications: toStringValue_(pickCell_(headers, row, ['certifications', 'certificate', 'trainings', 'seminars'], usedHeaders, ['certification', 'certificate', 'training', 'seminar'], [])),
    experience: toStringValue_(pickCell_(headers, row, ['experience', 'work experience', 'employment history'], usedHeaders, ['experience', 'employment', 'work'], [])),
    achievements: toStringValue_(pickCell_(headers, row, ['achievements', 'awards', 'accomplishments'], usedHeaders, ['achievement', 'award', 'accomplishment'], [])),
    volunteerHistory: toStringValue_(pickCell_(headers, row, ['volunteer history', 'volunteering', 'volunteer experience'], usedHeaders, ['volunteer'], [])),
    reasonForJoining: toStringValue_(pickCell_(headers, row, ['reason for joining', 'why join', 'motivation'], usedHeaders, ['reason', 'motivation', 'whyjoin'], [])),
    personalStatement: toStringValue_(pickCell_(headers, row, ['personal statement', 'statement', 'about me', 'bio'], usedHeaders, ['statement', 'about', 'bio'], [])),
    emergencyContactName: toStringValue_(pickCell_(headers, row, ['emergency contact name', 'emergency name', 'next of kin'], usedHeaders, ['emergency', 'kin'], ['relation', 'phone', 'number'])),
    emergencyContactRelation: toStringValue_(pickCell_(headers, row, ['emergency contact relation', 'relationship', 'relation to emergency contact'], usedHeaders, ['relation', 'relationship'], ['status'])),
    emergencyContactNumber: toStringValue_(pickCell_(headers, row, ['emergency contact number', 'emergency phone', 'emergency mobile'], usedHeaders, ['emergency', 'phone', 'mobile', 'number'], ['name', 'relation'])),
    facebook: toStringValue_(pickSocialCell_(headers, row, usedHeaders, 'facebook')),
    instagram: toStringValue_(pickSocialCell_(headers, row, usedHeaders, 'instagram')),
    twitter: toStringValue_(pickSocialCell_(headers, row, usedHeaders, 'twitter')),
    attachments: [],
    profilePicture: toStringValue_(pickCell_(
      headers, row,
      ['profile picture', 'formal picture', 'formal photo', '1x1 digital formal id', '1x1 photo', 'display picture', 'photo', 'image', 'photo url', 'picture url', 'image url', 'drive image link'],
      usedHeaders,
      ['profile', 'formal', '1x1', 'photo', 'picture', 'image'],
      ['signature', 'e-sign', 'esign', 'resume'],
      'profilePicture'
    ))
  };
  var manualAdditionalFields = applyExplicitHeaderMappings_(headers, row, usedHeaders, fullData);
  // Keep explicit debug line for frequently mis-mapped fields.
  logMappingDebug_('pre-infer key fields', {
    rowIndex: rowIndex,
    address: toLogPreview_(fullData.address),
    facebook: toLogPreview_(fullData.facebook),
    instagram: toLogPreview_(fullData.instagram),
    twitter: toLogPreview_(fullData.twitter),
    profilePicture: toLogPreview_(fullData.profilePicture)
  });
  inferApplicantFieldsFromRemainingHeaders_(headers, row, usedHeaders, fullData);
  var smartFiles = collectSmartFileLinks_(headers, row, usedHeaders, fullData.profilePicture);
  fullData.profilePicture = smartFiles.profilePicture || fullData.profilePicture;
  fullData.attachments = smartFiles.attachments || [];
  fullData.additionalFields = collectAdditionalFields_(headers, row, usedHeaders);
  var manualKeys = Object.keys(manualAdditionalFields || {});
  for (var m = 0; m < manualKeys.length; m++) {
    var key = manualKeys[m];
    if (!hasFieldValue_(fullData.additionalFields[key])) {
      fullData.additionalFields[key] = manualAdditionalFields[key];
    }
  }
  enrichFromCompositeText_(fullData, fullData.additionalFields);
  logMappingDebug_('final mapped key fields', {
    rowIndex: rowIndex,
    address: toLogPreview_(fullData.address),
    facebook: toLogPreview_(fullData.facebook),
    instagram: toLogPreview_(fullData.instagram),
    twitter: toLogPreview_(fullData.twitter),
    profilePicture: toLogPreview_(fullData.profilePicture),
    additionalFieldsCount: Object.keys(fullData.additionalFields || {}).length
  });

  return {
    id: recordId,
    name: fullData.fullName,
    email: fullData.email,
    phone: fullData.phone,
    dateApplied: dateApplied,
    committee: fullData.committeePreference,
    status: status,
    fullData: fullData
  };
}

// =================== SHARED UTILITIES (Copied from Homepage_Main) ===================

function validateApiKey_(key) {
  var expected = PropertiesService.getScriptProperties().getProperty('SECRET_API_KEY') || '';
  if (!expected) {
    console.error('[Applications Auth] SECRET_API_KEY is missing');
    return false;
  }
  return !!(key && String(key).trim() === expected);
}

function verifyHmacToken_(token) {
  if (!token || typeof token !== 'string') {
    console.error('[Applications Auth] verifyHmacToken_: missing or non-string token');
    return null;
  }
  var secret = PropertiesService.getScriptProperties().getProperty('SESSION_SECRET_KEY');
  if (!secret) {
    console.error('[Applications Auth] verifyHmacToken_: SESSION_SECRET_KEY is missing');
    return null;
  }
  var parts = token.split('.');
  if (parts.length !== 2) {
    console.error('[Applications Auth] verifyHmacToken_: invalid token format (expected payload.signature)');
    return null;
  }
  var payload = parts[0];
  var signature = parts[1];
  var expectedSig = bytesToHex_(Utilities.computeHmacSha256Signature(payload, secret));
  if (signature !== expectedSig) {
    console.error('[Applications Auth] verifyHmacToken_: signature mismatch');
    return null;
  }
  try {
    var decoded = Utilities.newBlob(Utilities.base64Decode(payload)).getDataAsString();
    var fields = decoded.split('|');
    if (fields.length < 2) {
      console.error('[Applications Auth] verifyHmacToken_: invalid payload fields');
      return null;
    }
    var username = fields[0];
    var expiry = parseInt(fields[1], 10);
    if (isNaN(expiry)) {
      console.error('[Applications Auth] verifyHmacToken_: invalid expiry value');
      return null;
    }
    if (new Date().getTime() > expiry) {
      console.error('[Applications Auth] verifyHmacToken_: token expired', {
        username: username,
        expiry: expiry,
        now: new Date().getTime()
      });
      return null;
    }
    return { username: username };
  } catch (e) {
    console.error('[Applications Auth] verifyHmacToken_: decode/parse error', e);
    return null;
  }
}

function bytesToHex_(bytes) {
  return bytes.map(function(b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
}

function getUserRole_(username) {
  if (!username) return null;
  try {
    var ssId = PropertiesService.getScriptProperties().getProperty('LOGIN_SPREADSHEET_ID') || '';
    if (!ssId) {
      console.error('[Applications Auth] LOGIN_SPREADSHEET_ID is not configured.');
      return null;
    }
    var ss = SpreadsheetApp.openById(ssId);
    var sheet = ss.getSheetByName('User Profiles');
    if (!sheet) {
      console.error('[Applications Auth] User Profiles sheet not found in LOGIN_SPREADSHEET_ID:', ssId);
      return null;
    }
    var data = sheet.getDataRange().getValues();
    var headers = data[0] || [];
    var usernameIdx = headers.indexOf('Username');
    var roleIdx = headers.indexOf('Role');
    if (usernameIdx === -1 || roleIdx === -1) {
      console.error('[Applications Auth] Required columns missing in User Profiles. Expected Username and Role.');
      return null;
    }
    var target = String(username).toLowerCase().trim();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][usernameIdx] || '').toLowerCase().trim() === target) {
        return String(data[i][roleIdx] || '').toLowerCase().trim();
      }
    }
    console.error('[Applications Auth] Username not found in User Profiles:', username);
    return null;
  } catch (e) {
    console.error('[Applications Auth] Error resolving role for username:', username, e);
    return null;
  }
}

function getSystemRoleRecordByName_(roleName) {
  try {
    var settingsId = PropertiesService.getScriptProperties().getProperty('SYSTEM_SETTINGS_SPREADSHEET_ID') || '';
    if (!settingsId) return null;

    var ss = SpreadsheetApp.openById(settingsId);
    var sheet = ss.getSheetByName('System_Config_Roles');
    if (!sheet || sheet.getLastRow() < 2) return null;

    var values = sheet.getDataRange().getValues();
    var headers = values[0] || [];
    var roleNameIdx = headers.indexOf('RoleName');
    var powerLevelIdx = headers.indexOf('PowerLevel');
    var permissionsIdx = headers.indexOf('Permissions');
    if (roleNameIdx === -1) return null;

    var target = String(roleName || '').toLowerCase().trim();
    for (var i = 1; i < values.length; i++) {
      var rowRoleName = String(values[i][roleNameIdx] || '').toLowerCase().trim();
      if (rowRoleName !== target) continue;

      var powerLevel = Number(values[i][powerLevelIdx]);
      var permissions = {};
      if (permissionsIdx !== -1 && values[i][permissionsIdx]) {
        try {
          permissions = JSON.parse(String(values[i][permissionsIdx]));
        } catch (e) {
          permissions = {};
        }
      }
      return {
        name: String(values[i][roleNameIdx] || ''),
        powerLevel: isNaN(powerLevel) ? 0 : powerLevel,
        permissions: permissions || {},
      };
    }
    return null;
  } catch (e) {
    console.error('[Applications Auth] Failed to resolve system role record:', e);
    return null;
  }
}

function requireAdminOrAuditor_(username, actionDescription) {
  if (!username) {
    console.error('[Applications Auth] Missing username for action:', actionDescription);
    return { success: false, error: 'Username is required', code: 400 };
  }
  var role = getUserRole_(username);
  var roleRecord = getSystemRoleRecordByName_(role);
  var hasLegacyAdminAccess = role === 'auditor' || role === 'admin';
  var hasPermissionAccess = !!(
    roleRecord &&
    (
      roleRecord.powerLevel >= 8 ||
      roleRecord.permissions.canApproveMembers === true ||
      roleRecord.permissions.canManageUsers === true
    )
  );

  if (!hasLegacyAdminAccess && !hasPermissionAccess) {
    console.error('[Applications Auth] Permission denied.', {
      username: username,
      role: role,
      roleRecord: roleRecord,
      action: actionDescription
    });
    return { success: false, error: 'Permission denied', code: 403 };
  }
  return null;
}

function createJsonResponse(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
