/**
 * YSP Announcements Backend (Dedicated GAS Project)
 * Draft-first announcements with recipient targeting, attachments, email sending, and logs.
 */

const ANNOUNCEMENTS_DEFAULT_SPREADSHEET_ID = '1ilNOdC-k10ZWs6mNdxjEUHKLyLi6-YTUbKEdKXOCGJg';
const ANNOUNCEMENTS_DEFAULT_DRIVE_FOLDER_ID = '1NZqmXNEHL3-b7A4cZxw3SwGtoFpkkOQo';
const ANNOUNCEMENTS_SHEET_NAME = 'Announcements';
const ANNOUNCEMENTS_ATTACHMENTS_SHEET = 'Announcement_Attachments';
const ANNOUNCEMENTS_TARGETS_SHEET = 'Announcement_Targets';
const ANNOUNCEMENTS_LOGS_SHEET = 'Announcement_Send_Logs';
const ANNOUNCEMENTS_READ_SHEET = 'Announcement_Read_Receipts';

const LOGO_URL = 'https://i.imgur.com/J4wddTW.png';
const WEB_APP_URL = 'https://tgm.youthserviceph.org/Home';
const FB_PAGE_URL = 'https://www.facebook.com/YSPTagumChapter';
const MANILA_TIMEZONE = 'Asia/Manila';
const MANILA_UTC_OFFSET_HOURS = 8;
const ANNOUNCEMENTS_BRANDING_CACHE_KEY = 'announcements_org_branding_v1';
const ANNOUNCEMENTS_BRANDING_CACHE_TTL_SECONDS = 1800;
const ANNOUNCEMENTS_BRANDING_SHEET_NAME = 'Organization Branding';
const ANNOUNCEMENTS_BRANDING_DEFAULTS = {
  orgName: 'Youth Service Philippines',
  chapterName: 'Tagum Chapter',
  shortName: 'YSP Tagum',
  motto: 'Shaping the Future to a Greater Society',
  chapterCode: 'TC',
  location: 'Tagum City, Davao del Norte, Philippines',
  contactEmail: 'ysptagumchapter@gmail.com',
  logoUrl: LOGO_URL,
  themeColor: '#f6421f'
};

function toSlugToken_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeAnnouncementsBranding_(raw) {
  var merged = Object.assign({}, ANNOUNCEMENTS_BRANDING_DEFAULTS, raw || {});
  merged.orgName = normalizeText_(merged.orgName) || ANNOUNCEMENTS_BRANDING_DEFAULTS.orgName;
  merged.chapterName = normalizeText_(merged.chapterName) || ANNOUNCEMENTS_BRANDING_DEFAULTS.chapterName;
  merged.shortName = normalizeText_(merged.shortName) || ANNOUNCEMENTS_BRANDING_DEFAULTS.shortName;
  merged.motto = normalizeText_(merged.motto) || ANNOUNCEMENTS_BRANDING_DEFAULTS.motto;
  merged.chapterCode = normalizeText_(merged.chapterCode) || ANNOUNCEMENTS_BRANDING_DEFAULTS.chapterCode;
  merged.location = normalizeText_(merged.location) || ANNOUNCEMENTS_BRANDING_DEFAULTS.location;
  merged.contactEmail = normalizeText_(merged.contactEmail) || ANNOUNCEMENTS_BRANDING_DEFAULTS.contactEmail;
  merged.logoUrl = normalizeText_(merged.logoUrl) || ANNOUNCEMENTS_BRANDING_DEFAULTS.logoUrl;
  merged.themeColor = normalizeText_(merged.themeColor) || ANNOUNCEMENTS_BRANDING_DEFAULTS.themeColor;
  merged.fullName = merged.orgName + ' - ' + merged.chapterName;
  return merged;
}

function getAnnouncementsBrandingFromSheet_() {
  try {
    var props = PropertiesService.getScriptProperties();
    var settingsId = normalizeText_(props.getProperty('SYSTEM_SETTINGS_SPREADSHEET_ID'));
    if (!settingsId) return null;

    var ss = SpreadsheetApp.openById(settingsId);
    var sheet = ss.getSheetByName(ANNOUNCEMENTS_BRANDING_SHEET_NAME);
    if (!sheet || sheet.getLastRow() < 2) return null;

    var values = sheet.getDataRange().getValues();
    var headers = values[0] || [];
    var keyIdx = headers.indexOf('ConfigKey');
    var valueIdx = headers.indexOf('Value');
    if (keyIdx === -1 || valueIdx === -1) return null;

    var rowMap = {};
    for (var i = 1; i < values.length; i++) {
      var key = normalizeText_(values[i][keyIdx]);
      if (!key) continue;
      rowMap[key] = normalizeText_(values[i][valueIdx]);
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
    Logger.log('Announcements branding sheet fallback read error: ' + sheetReadError);
    return null;
  }
}

function getAnnouncementsOrgBranding_() {
  var cache = CacheService.getScriptCache();
  try {
    var cachedRaw = cache.get(ANNOUNCEMENTS_BRANDING_CACHE_KEY);
    if (cachedRaw) {
      var cachedParsed = parseJsonSafe_(cachedRaw, null);
      if (cachedParsed) {
        return normalizeAnnouncementsBranding_(cachedParsed);
      }
    }
  } catch (cacheReadError) {
    Logger.log('Announcements branding cache read error: ' + cacheReadError);
  }

  var branding = normalizeAnnouncementsBranding_({});
  var resolvedFromEndpoint = false;
  try {
    var props = PropertiesService.getScriptProperties();
    var endpoint = normalizeText_(props.getProperty('SYSTEM_TOOLS_BRANDING_URL') || props.getProperty('SYSTEM_TOOLS_WEB_APP_URL'));

    if (endpoint) {
      var response = UrlFetchApp.fetch(endpoint, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({ action: 'getOrgBranding' }),
        muteHttpExceptions: true
      });
      var code = response.getResponseCode();
      if (code >= 200 && code < 300) {
        var payload = parseJsonSafe_(response.getContentText(), null);
        if (payload && payload.success === true && payload.data) {
          branding = normalizeAnnouncementsBranding_(payload.data);
          resolvedFromEndpoint = true;
        }
      }
    }
  } catch (fetchError) {
    Logger.log('Announcements branding fetch error: ' + fetchError);
  }

  if (!resolvedFromEndpoint) {
    var sheetBranding = getAnnouncementsBrandingFromSheet_();
    if (sheetBranding) {
      branding = normalizeAnnouncementsBranding_(sheetBranding);
    }
  }

  try {
    cache.put(ANNOUNCEMENTS_BRANDING_CACHE_KEY, JSON.stringify(branding), ANNOUNCEMENTS_BRANDING_CACHE_TTL_SECONDS);
  } catch (cacheWriteError) {
    Logger.log('Announcements branding cache write error: ' + cacheWriteError);
  }

  return branding;
}

function getAnnouncementsSpreadsheetId_() {
  return PropertiesService.getScriptProperties().getProperty('ANNOUNCEMENTS_SPREADSHEET_ID') || ANNOUNCEMENTS_DEFAULT_SPREADSHEET_ID;
}

function getAnnouncementsDriveFolderId_() {
  return PropertiesService.getScriptProperties().getProperty('ANNOUNCEMENTS_DRIVE_FOLDER_ID') || ANNOUNCEMENTS_DEFAULT_DRIVE_FOLDER_ID;
}

function getLoginSpreadsheetId_() {
  return PropertiesService.getScriptProperties().getProperty('LOGIN_SPREADSHEET_ID') || '';
}

function getSystemSettingsSpreadsheetId_() {
  return PropertiesService.getScriptProperties().getProperty('SYSTEM_SETTINGS_SPREADSHEET_ID') || '';
}

function jsonSuccess_(data) {
  return ContentService.createTextOutput(JSON.stringify(Object.assign({ success: true }, data || {}))).setMimeType(ContentService.MimeType.JSON);
}

function jsonError_(message, code) {
  return ContentService.createTextOutput(JSON.stringify({ success: false, error: message, code: code || 500 })).setMimeType(ContentService.MimeType.JSON);
}

function nowIso_() {
  return new Date().toISOString();
}

function normalizeText_(v) {
  return String(v || '').trim();
}

function normalizeLower_(v) {
  return normalizeText_(v).toLowerCase();
}

function parseBool_(v) {
  return v === true || v === 'true' || v === '1' || v === 1;
}

function parseJsonSafe_(v, fallback) {
  try {
    return v ? JSON.parse(String(v)) : fallback;
  } catch (e) {
    return fallback;
  }
}

function isAllowedAttachmentMime_(mimeType) {
  var allowed = {
    'application/pdf': true,
    'application/msword': true,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true,
    'application/vnd.ms-excel': true,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': true,
    'application/vnd.ms-powerpoint': true,
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': true,
    'image/jpeg': true,
    'image/png': true,
    'image/webp': true,
    'text/plain': true
  };
  return !!allowed[normalizeLower_(mimeType)];
}

function bytesToHex_(bytes) {
  return bytes.map(function(b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
}

function verifyHmacToken_(token) {
  if (!token || typeof token !== 'string') return null;
  var secret = PropertiesService.getScriptProperties().getProperty('SESSION_SECRET_KEY');
  if (!secret) return null;
  var parts = token.split('.');
  if (parts.length !== 2) return null;
  var payload = parts[0];
  var signature = parts[1];
  var expectedSig = bytesToHex_(Utilities.computeHmacSha256Signature(payload, secret));
  if (signature !== expectedSig) return null;
  try {
    var decoded = Utilities.newBlob(Utilities.base64Decode(payload)).getDataAsString();
    var fields = decoded.split('|');
    if (fields.length < 2) return null;
    var username = fields[0];
    var expiry = parseInt(fields[1], 10);
    if (isNaN(expiry) || new Date().getTime() > expiry) return null;
    return { username: username };
  } catch (e) {
    return null;
  }
}

function isRequestCancelled_(params) {
  return !!(params && (params.cancelled === true || params.cancelled === 'true' || params.action === 'cancel'));
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'health';
  if (action === 'health') {
    return jsonSuccess_({ status: 'healthy', timestamp: nowIso_() });
  }
  return jsonError_('Invalid request', 400);
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || '{}');
    if (isRequestCancelled_(body)) return jsonError_('Request cancelled', 499);
    var action = normalizeText_(body.action);

    var publicActions = ['health'];
    if (publicActions.indexOf(action) === -1) {
      var tokenUser = verifyHmacToken_(body.sessionToken);
      var sessionSecret = PropertiesService.getScriptProperties().getProperty('SESSION_SECRET_KEY');
      if (!sessionSecret) return jsonError_('Server auth misconfigured: SESSION_SECRET_KEY is missing', 503);
      if (!tokenUser) return jsonError_('Invalid or expired session token', 401);
      body.username = tokenUser.username;
    }

    switch (action) {
      case 'bootstrapAnnouncementsSystem':
        return jsonSuccess_(bootstrapAnnouncementsSystem_(body));
      case 'initializeAnnouncementsSystem':
        return jsonSuccess_(initializeAnnouncementsSystem_(body));
      case 'setAnnouncementsConfig':
        return jsonSuccess_(setAnnouncementsConfig_(body));
      case 'ensureAnnouncementsSheets':
        return jsonSuccess_(ensureAnnouncementsSheets_());
      case 'getAnnouncements':
        return jsonSuccess_(handleGetAnnouncements_(body));
      case 'getAnnouncementById':
        return jsonSuccess_(handleGetAnnouncementById_(body));
      case 'createAnnouncementDraft':
        return jsonSuccess_(handleCreateAnnouncementDraft_(body));
      case 'updateAnnouncementDraft':
        return jsonSuccess_(handleUpdateAnnouncementDraft_(body));
      case 'archiveAnnouncement':
        return jsonSuccess_(handleArchiveAnnouncement_(body));
      case 'deleteAnnouncement':
        return jsonSuccess_(handleDeleteAnnouncement_(body));
      case 'searchAnnouncementRecipients':
        return jsonSuccess_(handleSearchAnnouncementRecipients_(body));
      case 'previewAnnouncementRecipients':
        return jsonSuccess_(handlePreviewAnnouncementRecipients_(body));
      case 'uploadAnnouncementAttachment':
        return jsonSuccess_(handleUploadAnnouncementAttachment_(body));
      case 'addAnnouncementLinkAttachment':
        return jsonSuccess_(handleAddAnnouncementLinkAttachment_(body));
      case 'removeAnnouncementAttachment':
        return jsonSuccess_(handleRemoveAnnouncementAttachment_(body));
      case 'sendAnnouncement':
        return jsonSuccess_(handleSendAnnouncement_(body));
      case 'resendAnnouncementRecipient':
        return jsonSuccess_(handleResendAnnouncementRecipient_(body));
      case 'getAnnouncementSendLogs':
        return jsonSuccess_(handleGetAnnouncementSendLogs_(body));
      case 'markAnnouncementRead':
        return jsonSuccess_(handleMarkAnnouncementRead_(body));
      case 'getAnnouncementReadDashboard':
        return jsonSuccess_(handleGetAnnouncementReadDashboard_(body));
      default:
        return jsonError_('Invalid action', 400);
    }
  } catch (error) {
    Logger.log('Announcements doPost error: ' + error);
    return jsonError_('Server error: ' + (error && error.message ? error.message : error), 500);
  }
}

function ensureSessionSecret_(providedSecret) {
  var existing = PropertiesService.getScriptProperties().getProperty('SESSION_SECRET_KEY');
  var supplied = normalizeText_(providedSecret);
  if (supplied) {
    PropertiesService.getScriptProperties().setProperty('SESSION_SECRET_KEY', supplied);
    return { value: supplied, generated: false, source: 'request' };
  }
  if (existing) {
    return { value: existing, generated: false, source: 'existing' };
  }
  var generated = bytesToHex_(Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    Utilities.getUuid() + '|' + nowIso_() + '|' + Utilities.getUuid()
  ));
  PropertiesService.getScriptProperties().setProperty('SESSION_SECRET_KEY', generated);
  return { value: generated, generated: true, source: 'generated' };
}

function validateSpreadsheetAccess_(id, label) {
  if (!id) throw new Error(label + ' is required');
  var ss = SpreadsheetApp.openById(id);
  return { id: ss.getId(), name: ss.getName() };
}

function validateDriveFolderAccess_(id, label) {
  if (!id) throw new Error(label + ' is required');
  var folder = DriveApp.getFolderById(id);
  return { id: folder.getId(), name: folder.getName() };
}

/**
 * Bootstrap all announcements dependencies and script properties in one call.
 *
 * Optional request fields:
 * - announcementsSpreadsheetId
 * - announcementsDriveFolderId
 * - loginSpreadsheetId
 * - systemSettingsSpreadsheetId
 * - sessionSecretKey
 *
 * If omitted, existing script properties are used.
 * For ANNOUNCEMENTS_* fields, defaults are used when no property exists yet.
 */
function bootstrapAnnouncementsSystem_(body) {
  var input = body || {};
  var props = PropertiesService.getScriptProperties();

  var announcementsSpreadsheetId = normalizeText_(
    input.announcementsSpreadsheetId ||
    props.getProperty('ANNOUNCEMENTS_SPREADSHEET_ID') ||
    ANNOUNCEMENTS_DEFAULT_SPREADSHEET_ID
  );
  var announcementsDriveFolderId = normalizeText_(
    input.announcementsDriveFolderId ||
    props.getProperty('ANNOUNCEMENTS_DRIVE_FOLDER_ID') ||
    ANNOUNCEMENTS_DEFAULT_DRIVE_FOLDER_ID
  );
  var loginSpreadsheetId = normalizeText_(
    input.loginSpreadsheetId ||
    props.getProperty('LOGIN_SPREADSHEET_ID')
  );
  var systemSettingsSpreadsheetId = normalizeText_(
    input.systemSettingsSpreadsheetId ||
    props.getProperty('SYSTEM_SETTINGS_SPREADSHEET_ID')
  );

  var announcementsSpreadsheet = validateSpreadsheetAccess_(announcementsSpreadsheetId, 'ANNOUNCEMENTS_SPREADSHEET_ID');
  var driveFolder = validateDriveFolderAccess_(announcementsDriveFolderId, 'ANNOUNCEMENTS_DRIVE_FOLDER_ID');

  var loginSpreadsheet = null;
  if (loginSpreadsheetId) {
    loginSpreadsheet = validateSpreadsheetAccess_(loginSpreadsheetId, 'LOGIN_SPREADSHEET_ID');
  } else {
    throw new Error('LOGIN_SPREADSHEET_ID is required (pass loginSpreadsheetId or set property)');
  }

  var systemSettingsSpreadsheet = null;
  if (systemSettingsSpreadsheetId) {
    systemSettingsSpreadsheet = validateSpreadsheetAccess_(systemSettingsSpreadsheetId, 'SYSTEM_SETTINGS_SPREADSHEET_ID');
  }

  props.setProperty('ANNOUNCEMENTS_SPREADSHEET_ID', announcementsSpreadsheetId);
  props.setProperty('ANNOUNCEMENTS_DRIVE_FOLDER_ID', announcementsDriveFolderId);
  props.setProperty('LOGIN_SPREADSHEET_ID', loginSpreadsheetId);
  if (systemSettingsSpreadsheetId) {
    props.setProperty('SYSTEM_SETTINGS_SPREADSHEET_ID', systemSettingsSpreadsheetId);
  }

  var secretMeta = ensureSessionSecret_(input.sessionSecretKey);
  var ensured = ensureAnnouncementsSheets_();

  return {
    message: 'Announcements bootstrap completed',
    apiReady: true,
    ensuredSheets: ensured,
    properties: {
      ANNOUNCEMENTS_SPREADSHEET_ID: announcementsSpreadsheetId,
      ANNOUNCEMENTS_DRIVE_FOLDER_ID: announcementsDriveFolderId,
      LOGIN_SPREADSHEET_ID: loginSpreadsheetId,
      SYSTEM_SETTINGS_SPREADSHEET_ID: systemSettingsSpreadsheetId || '',
      SESSION_SECRET_KEY: secretMeta.value ? '[set]' : '[missing]',
      SESSION_SECRET_SOURCE: secretMeta.source
    },
    resources: {
      announcementsSpreadsheet: announcementsSpreadsheet,
      announcementsDriveFolder: driveFolder,
      loginSpreadsheet: loginSpreadsheet,
      systemSettingsSpreadsheet: systemSettingsSpreadsheet
    },
    warnings: systemSettingsSpreadsheetId ? [] : [
      'SYSTEM_SETTINGS_SPREADSHEET_ID is not set. Dynamic role permissions will be limited.'
    ]
  };
}

/**
 * Manual runner for Apps Script editor (Run button).
 * Uses existing script properties/defaults and ensures everything is configured.
 */
function runBootstrapAnnouncementsSystem() {
  var result = bootstrapAnnouncementsSystem_({});
  Logger.log(JSON.stringify(result));
  return result;
}

function ensureAnnouncementsSheets_() {
  var ss = SpreadsheetApp.openById(getAnnouncementsSpreadsheetId_());
  ensureSheet_(ss, ANNOUNCEMENTS_SHEET_NAME, [
    'AnnouncementID', 'Title', 'Subtitle', 'Body', 'Category', 'Priority',
    'RecipientType', 'RecipientPayload', 'Status', 'IsPinned',
    'CreatedBy', 'CreatedAt', 'UpdatedBy', 'UpdatedAt', 'ArchivedAt'
  ]);
  ensureSheet_(ss, ANNOUNCEMENTS_ATTACHMENTS_SHEET, [
    'AttachmentID', 'AnnouncementID', 'AttachmentType', 'Name', 'Url', 'DriveFileId',
    'MimeType', 'SizeBytes', 'CreatedBy', 'CreatedAt'
  ]);
  ensureSheet_(ss, ANNOUNCEMENTS_TARGETS_SHEET, [
    'TargetID', 'AnnouncementID', 'Username', 'FullName', 'Email', 'Committee',
    'Role', 'Status', 'EmailVerified', 'Eligibility', 'Reason', 'CreatedAt'
  ]);
  ensureSheet_(ss, ANNOUNCEMENTS_LOGS_SHEET, [
    'LogID', 'AnnouncementID', 'TargetID', 'Username', 'Email', 'Action',
    'Result', 'Reason', 'SentAt', 'SentBy'
  ]);
  ensureSheet_(ss, ANNOUNCEMENTS_READ_SHEET, [
    'ReadID', 'AnnouncementID', 'Username', 'FullName', 'Email', 'ReadAt'
  ]);
  return { message: 'Sheets ensured', spreadsheetId: ss.getId() };
}

function ensureSheet_(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  var existing = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0] || [];
  var valid = true;
  for (var i = 0; i < headers.length; i++) {
    if (String(existing[i] || '').trim() !== headers[i]) {
      valid = false;
      break;
    }
  }
  if (!valid) {
    sheet.clearContents();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function initializeAnnouncementsSystem_(body) {
  setAnnouncementsConfig_(body || {});
  return ensureAnnouncementsSheets_();
}

function setAnnouncementsConfig_(body) {
  var props = PropertiesService.getScriptProperties();
  if (body.announcementsSpreadsheetId) props.setProperty('ANNOUNCEMENTS_SPREADSHEET_ID', normalizeText_(body.announcementsSpreadsheetId));
  if (body.announcementsDriveFolderId) props.setProperty('ANNOUNCEMENTS_DRIVE_FOLDER_ID', normalizeText_(body.announcementsDriveFolderId));
  if (body.loginSpreadsheetId) props.setProperty('LOGIN_SPREADSHEET_ID', normalizeText_(body.loginSpreadsheetId));
  if (body.systemSettingsSpreadsheetId) props.setProperty('SYSTEM_SETTINGS_SPREADSHEET_ID', normalizeText_(body.systemSettingsSpreadsheetId));
  if (body.sessionSecretKey) props.setProperty('SESSION_SECRET_KEY', normalizeText_(body.sessionSecretKey));
  return { message: 'Configuration updated' };
}

function getUserProfiles_() {
  var loginId = getLoginSpreadsheetId_();
  if (!loginId) throw new Error('LOGIN_SPREADSHEET_ID missing');
  var ss = SpreadsheetApp.openById(loginId);
  var sheet = ss.getSheetByName('User Profiles');
  if (!sheet) throw new Error('User Profiles sheet not found');
  var values = sheet.getDataRange().getValues();
  var headers = values[0] || [];
  var idx = {
    username: headers.indexOf('Username'),
    fullName: headers.indexOf('Full name'),
    email: headers.indexOf('Email Address'),
    committee: headers.indexOf('Committee'),
    role: headers.indexOf('Role'),
    status: headers.indexOf('Status'),
    emailVerified: headers.indexOf('EmailVerified')
  };
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    rows.push({
      username: normalizeText_(values[i][idx.username]),
      fullName: normalizeText_(values[i][idx.fullName]),
      email: normalizeText_(values[i][idx.email]),
      committee: normalizeText_(values[i][idx.committee]),
      role: normalizeText_(values[i][idx.role]),
      status: normalizeText_(values[i][idx.status] || 'Active'),
      emailVerified: parseBool_(values[i][idx.emailVerified])
    });
  }
  return rows;
}

function getUserRole_(username) {
  var target = normalizeLower_(username);
  var users = getUserProfiles_();
  for (var i = 0; i < users.length; i++) {
    if (normalizeLower_(users[i].username) === target) return normalizeLower_(users[i].role);
  }
  return '';
}

function getSystemRoleRecord_(roleName) {
  var settingsId = getSystemSettingsSpreadsheetId_();
  if (!settingsId) return null;
  var ss = SpreadsheetApp.openById(settingsId);
  var sheet = ss.getSheetByName('System_Config_Roles');
  if (!sheet || sheet.getLastRow() < 2) return null;
  var values = sheet.getDataRange().getValues();
  var headers = values[0] || [];
  var roleIdx = headers.indexOf('RoleName');
  var levelIdx = headers.indexOf('PowerLevel');
  var permsIdx = headers.indexOf('Permissions');
  var target = normalizeLower_(roleName);
  for (var i = 1; i < values.length; i++) {
    if (normalizeLower_(values[i][roleIdx]) !== target) continue;
    return {
      powerLevel: Number(values[i][levelIdx]) || 0,
      permissions: parseJsonSafe_(values[i][permsIdx], {}) || {}
    };
  }
  return null;
}

function canManageAnnouncements_(username) {
  var role = getUserRole_(username);
  if (!role) return false;
  if (role === 'admin' || role === 'auditor' || role === 'head' || role.indexOf('admin') !== -1 || role.indexOf('auditor') !== -1) return true;
  var record = getSystemRoleRecord_(role);
  if (!record) return false;
  return !!(record.powerLevel >= 5 || record.permissions.canEditContent === true || record.permissions.canManageUsers === true);
}

function canViewAnnouncements_(username) {
  var role = getUserRole_(username);
  if (!role) return false;
  if (role === 'banned' || role === 'suspended') return false;
  var record = getSystemRoleRecord_(role);
  if (!record) return role !== 'guest';
  if (record.permissions && Object.prototype.hasOwnProperty.call(record.permissions, 'page_announcements')) {
    return !!record.permissions.page_announcements;
  }
  return record.powerLevel >= 2;
}

function getPermissionBlock_(username) {
  var canManage = canManageAnnouncements_(username);
  return {
    canView: canViewAnnouncements_(username),
    canManage: canManage,
    canSend: canManage,
    canViewReadDashboard: canManage
  };
}

function readAnnouncementsRaw_() {
  var ss = SpreadsheetApp.openById(getAnnouncementsSpreadsheetId_());
  var sheet = ensureSheet_(ss, ANNOUNCEMENTS_SHEET_NAME, [
    'AnnouncementID', 'Title', 'Subtitle', 'Body', 'Category', 'Priority',
    'RecipientType', 'RecipientPayload', 'Status', 'IsPinned',
    'CreatedBy', 'CreatedAt', 'UpdatedBy', 'UpdatedAt', 'ArchivedAt'
  ]);
  var values = sheet.getDataRange().getValues();
  var headers = values[0] || [];
  var idx = {};
  headers.forEach(function(h, i) { idx[h] = i; });
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    if (!normalizeText_(values[i][idx.AnnouncementID])) continue;
    rows.push({
      row: i + 1,
      announcementId: normalizeText_(values[i][idx.AnnouncementID]),
      title: normalizeText_(values[i][idx.Title]),
      subtitle: normalizeText_(values[i][idx.Subtitle]),
      body: normalizeText_(values[i][idx.Body]),
      category: normalizeText_(values[i][idx.Category] || 'Updates'),
      priority: normalizeLower_(values[i][idx.Priority] || 'normal') || 'normal',
      recipientType: normalizeText_(values[i][idx.RecipientType] || 'All'),
      recipientPayload: parseJsonSafe_(values[i][idx.RecipientPayload], {}),
      status: normalizeText_(values[i][idx.Status] || 'Draft'),
      isPinned: parseBool_(values[i][idx.IsPinned]),
      createdBy: normalizeText_(values[i][idx.CreatedBy]),
      createdAt: normalizeText_(values[i][idx.CreatedAt]),
      updatedBy: normalizeText_(values[i][idx.UpdatedBy]),
      updatedAt: normalizeText_(values[i][idx.UpdatedAt]),
      archivedAt: normalizeText_(values[i][idx.ArchivedAt])
    });
  }
  return { sheet: sheet, rows: rows };
}

function readAttachmentsByAnnouncement_(announcementId) {
  var ss = SpreadsheetApp.openById(getAnnouncementsSpreadsheetId_());
  var sheet = ensureSheet_(ss, ANNOUNCEMENTS_ATTACHMENTS_SHEET, [
    'AttachmentID', 'AnnouncementID', 'AttachmentType', 'Name', 'Url', 'DriveFileId',
    'MimeType', 'SizeBytes', 'CreatedBy', 'CreatedAt'
  ]);
  var values = sheet.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < values.length; i++) {
    if (normalizeText_(values[i][1]) !== announcementId) continue;
    out.push({
      attachmentId: normalizeText_(values[i][0]),
      announcementId: normalizeText_(values[i][1]),
      attachmentType: normalizeText_(values[i][2]),
      name: normalizeText_(values[i][3]),
      url: normalizeText_(values[i][4]),
      driveFileId: normalizeText_(values[i][5]),
      mimeType: normalizeText_(values[i][6]),
      sizeBytes: Number(values[i][7] || 0),
      createdBy: normalizeText_(values[i][8]),
      createdAt: normalizeText_(values[i][9])
    });
  }
  return out;
}

function mapAnnouncementForApi_(row, includeExtras) {
  var readSummary = getAnnouncementReadSummary_(row.announcementId);
  var item = {
    announcementId: row.announcementId,
    title: row.title,
    subtitle: row.subtitle,
    body: row.body,
    category: row.category,
    priority: row.priority,
    recipientType: row.recipientType,
    recipientPayload: row.recipientPayload || {},
    status: row.status,
    isPinned: row.isPinned,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt,
    attachments: readAttachmentsByAnnouncement_(row.announcementId),
    readCount: readSummary.count,
    readUsers: readSummary.users
  };
  if (includeExtras) {
    item.targets = readTargets_(row.announcementId);
    item.sendLogs = readLogs_(row.announcementId);
  }
  return item;
}

function handleGetAnnouncements_(body) {
  var perms = getPermissionBlock_(body.username);
  if (!perms.canView) throw new Error('Permission denied');
  var raw = readAnnouncementsRaw_();
  var q = normalizeLower_(body.search);
  var category = normalizeText_(body.category);
  var status = normalizeText_(body.status || 'All');
  var items = raw.rows.filter(function(r) {
    // Non-managers can only see Sent announcements (drafts & archived are hidden)
    if (!perms.canManage && normalizeLower_(r.status) !== 'sent') return false;
    if (status !== 'All' && normalizeLower_(r.status) !== normalizeLower_(status)) return false;
    if (category && normalizeLower_(category) !== 'all' && normalizeLower_(r.category) !== normalizeLower_(category)) return false;
    if (!q) return true;
    return normalizeLower_(r.title).indexOf(q) !== -1 || normalizeLower_(r.subtitle).indexOf(q) !== -1 || normalizeLower_(r.body).indexOf(q) !== -1;
  }).map(function(r) { return mapAnnouncementForApi_(r, false); });
  return { items: items, permissions: perms };
}

function handleGetAnnouncementById_(body) {
  var perms = getPermissionBlock_(body.username);
  if (!perms.canView) throw new Error('Permission denied');
  var id = normalizeText_(body.announcementId);
  var raw = readAnnouncementsRaw_();
  for (var i = 0; i < raw.rows.length; i++) {
    if (raw.rows[i].announcementId !== id) continue;
    // Non-managers can only view Sent announcements
    if (!perms.canManage && normalizeLower_(raw.rows[i].status) !== 'sent') {
      throw new Error('Announcement not found');
    }
    return { item: mapAnnouncementForApi_(raw.rows[i], perms.canManage) };
  }
  throw new Error('Announcement not found');
}

function buildRecipientTargets_(announcementId, recipientType, recipientPayload) {
  var users = getUserProfiles_();
  var type = normalizeText_(recipientType || 'All');
  var payload = recipientPayload || {};
  var committees = (payload.committees || []).map(normalizeLower_);
  var usernames = (payload.usernames || []).map(normalizeLower_);

  var headsAllowed = {};
  users.forEach(function(u) {
    var roleRec = getSystemRoleRecord_(u.role);
    if (roleRec && (roleRec.powerLevel >= 5 || roleRec.permissions.canEditContent === true)) {
      headsAllowed[normalizeLower_(u.username)] = true;
    }
  });

  var selected = users.filter(function(u) {
    if (!u.username) return false;
    if (type === 'All') return true;
    if (type === 'Heads') return !!headsAllowed[normalizeLower_(u.username)];
    if (type === 'Committee') return committees.indexOf(normalizeLower_(u.committee)) !== -1;
    if (type === 'Person') return usernames.indexOf(normalizeLower_(u.username)) !== -1 || (u.email && usernames.indexOf(normalizeLower_(u.email)) !== -1);
    return false;
  });

  return selected.map(function(u) {
    var status = normalizeLower_(u.status || 'active');
    var reason = '';
    var eligible = 'eligible';
    if (!u.email) {
      eligible = 'ineligible';
      reason = 'No email';
    } else if (status !== 'active') {
      eligible = 'ineligible';
      reason = 'Inactive status';
    } else if (!u.emailVerified) {
      eligible = 'ineligible';
      reason = 'Email not verified';
    }

    return {
      targetId: Utilities.getUuid(),
      announcementId: announcementId,
      username: u.username,
      fullName: u.fullName,
      email: u.email,
      committee: u.committee,
      role: u.role,
      status: u.status,
      emailVerified: !!u.emailVerified,
      eligibility: eligible,
      reason: reason,
      createdAt: nowIso_()
    };
  });
}

function writeTargets_(announcementId, targets) {
  var ss = SpreadsheetApp.openById(getAnnouncementsSpreadsheetId_());
  var sheet = ensureSheet_(ss, ANNOUNCEMENTS_TARGETS_SHEET, [
    'TargetID', 'AnnouncementID', 'Username', 'FullName', 'Email', 'Committee',
    'Role', 'Status', 'EmailVerified', 'Eligibility', 'Reason', 'CreatedAt'
  ]);
  var values = sheet.getDataRange().getValues();
  for (var i = values.length - 1; i >= 1; i--) {
    if (normalizeText_(values[i][1]) === announcementId) sheet.deleteRow(i + 1);
  }
  if (!targets || !targets.length) return;
  var rows = targets.map(function(t) {
    return [t.targetId, t.announcementId, t.username, t.fullName, t.email, t.committee, t.role, t.status, t.emailVerified, t.eligibility, t.reason, t.createdAt];
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

function readTargets_(announcementId) {
  var ss = SpreadsheetApp.openById(getAnnouncementsSpreadsheetId_());
  var sheet = ensureSheet_(ss, ANNOUNCEMENTS_TARGETS_SHEET, [
    'TargetID', 'AnnouncementID', 'Username', 'FullName', 'Email', 'Committee',
    'Role', 'Status', 'EmailVerified', 'Eligibility', 'Reason', 'CreatedAt'
  ]);
  var values = sheet.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < values.length; i++) {
    if (normalizeText_(values[i][1]) !== announcementId) continue;
    out.push({
      targetId: normalizeText_(values[i][0]),
      announcementId: normalizeText_(values[i][1]),
      username: normalizeText_(values[i][2]),
      fullName: normalizeText_(values[i][3]),
      email: normalizeText_(values[i][4]),
      committee: normalizeText_(values[i][5]),
      role: normalizeText_(values[i][6]),
      status: normalizeText_(values[i][7]),
      emailVerified: parseBool_(values[i][8]),
      eligibility: normalizeText_(values[i][9]),
      reason: normalizeText_(values[i][10]),
      createdAt: normalizeText_(values[i][11])
    });
  }
  return out;
}

function readLogs_(announcementId) {
  var ss = SpreadsheetApp.openById(getAnnouncementsSpreadsheetId_());
  var sheet = ensureSheet_(ss, ANNOUNCEMENTS_LOGS_SHEET, [
    'LogID', 'AnnouncementID', 'TargetID', 'Username', 'Email', 'Action',
    'Result', 'Reason', 'SentAt', 'SentBy'
  ]);
  var values = sheet.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < values.length; i++) {
    if (normalizeText_(values[i][1]) !== announcementId) continue;
    out.push({
      logId: normalizeText_(values[i][0]),
      announcementId: normalizeText_(values[i][1]),
      targetId: normalizeText_(values[i][2]),
      username: normalizeText_(values[i][3]),
      email: normalizeText_(values[i][4]),
      action: normalizeText_(values[i][5]),
      result: normalizeText_(values[i][6]),
      reason: normalizeText_(values[i][7]),
      sentAt: normalizeText_(values[i][8]),
      sentBy: normalizeText_(values[i][9])
    });
  }
  return out;
}

function appendLog_(announcementId, target, action, result, reason, sentBy) {
  var ss = SpreadsheetApp.openById(getAnnouncementsSpreadsheetId_());
  var sheet = ensureSheet_(ss, ANNOUNCEMENTS_LOGS_SHEET, [
    'LogID', 'AnnouncementID', 'TargetID', 'Username', 'Email', 'Action',
    'Result', 'Reason', 'SentAt', 'SentBy'
  ]);
  sheet.appendRow([Utilities.getUuid(), announcementId, target.targetId, target.username, target.email, action, result, reason || '', nowIso_(), sentBy || '']);
}

function readReceipts_(announcementId) {
  var ss = SpreadsheetApp.openById(getAnnouncementsSpreadsheetId_());
  var sheet = ensureSheet_(ss, ANNOUNCEMENTS_READ_SHEET, [
    'ReadID', 'AnnouncementID', 'Username', 'FullName', 'Email', 'ReadAt'
  ]);
  var values = sheet.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < values.length; i++) {
    if (announcementId && normalizeText_(values[i][1]) !== announcementId) continue;
    out.push({
      readId: normalizeText_(values[i][0]),
      announcementId: normalizeText_(values[i][1]),
      username: normalizeText_(values[i][2]),
      fullName: normalizeText_(values[i][3]),
      email: normalizeText_(values[i][4]),
      readAt: normalizeText_(values[i][5])
    });
  }
  return out;
}

function getAnnouncementReadSummary_(announcementId) {
  var receipts = readReceipts_(announcementId);
  var users = {};
  for (var i = 0; i < receipts.length; i++) {
    users[normalizeLower_(receipts[i].username)] = true;
  }
  return { count: Object.keys(users).length, users: Object.keys(users) };
}

function resolveUserByUsername_(username) {
  var clean = normalizeLower_(username);
  var users = getUserProfiles_();
  for (var i = 0; i < users.length; i++) {
    if (normalizeLower_(users[i].username) === clean) return users[i];
  }
  return null;
}

function handleMarkAnnouncementRead_(body) {
  var perms = getPermissionBlock_(body.username);
  if (!perms.canView) throw new Error('Permission denied');
  var announcementId = normalizeText_(body.announcementId);
  if (!announcementId) throw new Error('announcementId is required');
  var username = normalizeText_(body.username);
  if (!username) throw new Error('username is required');

  var ss = SpreadsheetApp.openById(getAnnouncementsSpreadsheetId_());
  var sheet = ensureSheet_(ss, ANNOUNCEMENTS_READ_SHEET, [
    'ReadID', 'AnnouncementID', 'Username', 'FullName', 'Email', 'ReadAt'
  ]);
  var values = sheet.getDataRange().getValues();
  var usernameLower = normalizeLower_(username);
  for (var i = 1; i < values.length; i++) {
    if (normalizeText_(values[i][1]) !== announcementId) continue;
    if (normalizeLower_(values[i][2]) === usernameLower) {
      return { message: 'Already marked as read', alreadyRead: true };
    }
  }

  var user = resolveUserByUsername_(username) || {};
  sheet.appendRow([
    Utilities.getUuid(),
    announcementId,
    username,
    normalizeText_(user.fullName || username),
    normalizeText_(user.email || ''),
    nowIso_()
  ]);
  return { message: 'Marked as read', alreadyRead: false };
}

function handleGetAnnouncementReadDashboard_(body) {
  var perms = getPermissionBlock_(body.username);
  if (!perms.canViewReadDashboard) throw new Error('Permission denied');
  var announcementId = normalizeText_(body.announcementId);
  var query = normalizeLower_(body.query);
  var receipts = readReceipts_(announcementId);
  var grouped = {};

  for (var i = 0; i < receipts.length; i++) {
    var r = receipts[i];
    var aid = r.announcementId;
    if (!grouped[aid]) grouped[aid] = [];
    if (query) {
      var hay = normalizeLower_(r.fullName + ' ' + r.username + ' ' + r.email);
      if (hay.indexOf(query) === -1) continue;
    }
    grouped[aid].push(r);
  }

  var raw = readAnnouncementsRaw_();
  var announcementsById = {};
  for (var j = 0; j < raw.rows.length; j++) {
    announcementsById[raw.rows[j].announcementId] = raw.rows[j];
  }

  var dashboard = [];
  raw.rows.forEach(function(ann) {
    var aid = ann.announcementId;
    var entries = grouped[aid] || [];
    dashboard.push({
      announcementId: aid,
      title: ann.title,
      subtitle: ann.subtitle,
      status: ann.status,
      readCount: entries.length,
      readers: entries.sort(function(a, b) {
        return new Date(b.readAt).getTime() - new Date(a.readAt).getTime();
      })
    });
  });

  dashboard.sort(function(a, b) {
    return new Date(announcementsById[b.announcementId].createdAt).getTime() - new Date(announcementsById[a.announcementId].createdAt).getTime();
  });

  return { dashboard: dashboard };
}

function handleCreateAnnouncementDraft_(body) {
  if (!canManageAnnouncements_(body.username)) throw new Error('Permission denied');
  var input = body.input || {};
  var id = 'ANN-' + new Date().getTime();
  var now = nowIso_();
  var raw = readAnnouncementsRaw_();
  raw.sheet.appendRow([
    id,
    normalizeText_(input.title),
    normalizeText_(input.subtitle),
    normalizeText_(input.body),
    normalizeText_(input.category || 'Updates'),
    normalizeLower_(input.priority || 'normal'),
    normalizeText_(input.recipientType || 'All'),
    JSON.stringify(input.recipientPayload || {}),
    'Draft',
    parseBool_(input.isPinned),
    normalizeText_(body.username),
    now,
    normalizeText_(body.username),
    now,
    ''
  ]);
  var targets = buildRecipientTargets_(id, input.recipientType, input.recipientPayload || {});
  writeTargets_(id, targets);
  return handleGetAnnouncementById_({ username: body.username, announcementId: id });
}

function handleUpdateAnnouncementDraft_(body) {
  if (!canManageAnnouncements_(body.username)) throw new Error('Permission denied');
  var id = normalizeText_(body.announcementId);
  var input = body.input || {};
  var raw = readAnnouncementsRaw_();
  for (var i = 0; i < raw.rows.length; i++) {
    var r = raw.rows[i];
    if (r.announcementId !== id) continue;
    raw.sheet.getRange(r.row, 2, 1, 13).setValues([[
      normalizeText_(input.title),
      normalizeText_(input.subtitle),
      normalizeText_(input.body),
      normalizeText_(input.category || 'Updates'),
      normalizeLower_(input.priority || 'normal'),
      normalizeText_(input.recipientType || 'All'),
      JSON.stringify(input.recipientPayload || {}),
      r.status || 'Draft',
      parseBool_(input.isPinned),
      r.createdBy,
      r.createdAt,
      normalizeText_(body.username),
      nowIso_()
    ]]);
    var targets = buildRecipientTargets_(id, input.recipientType, input.recipientPayload || {});
    writeTargets_(id, targets);
    return handleGetAnnouncementById_({ username: body.username, announcementId: id });
  }
  throw new Error('Announcement not found');
}

function handleArchiveAnnouncement_(body) {
  if (!canManageAnnouncements_(body.username)) throw new Error('Permission denied');
  var id = normalizeText_(body.announcementId);
  var raw = readAnnouncementsRaw_();
  for (var i = 0; i < raw.rows.length; i++) {
    if (raw.rows[i].announcementId !== id) continue;
    raw.sheet.getRange(raw.rows[i].row, 9).setValue('Archived');
    raw.sheet.getRange(raw.rows[i].row, 14).setValue(nowIso_());
    raw.sheet.getRange(raw.rows[i].row, 15).setValue(nowIso_());
    return { message: 'Announcement archived' };
  }
  throw new Error('Announcement not found');
}

function deleteRowsByAnnouncementId_(sheetName, announcementId, announcementColIdx) {
  var ss = SpreadsheetApp.openById(getAnnouncementsSpreadsheetId_());
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return;
  var values = sheet.getDataRange().getValues();
  for (var i = values.length - 1; i >= 1; i--) {
    if (normalizeText_(values[i][announcementColIdx]) === announcementId) {
      sheet.deleteRow(i + 1);
    }
  }
}

function handleDeleteAnnouncement_(body) {
  if (!canManageAnnouncements_(body.username)) throw new Error('Permission denied');
  var id = normalizeText_(body.announcementId);
  if (!id) throw new Error('announcementId is required');

  var attachments = readAttachmentsByAnnouncement_(id);
  for (var a = 0; a < attachments.length; a++) {
    var driveFileId = normalizeText_(attachments[a].driveFileId);
    if (!driveFileId) continue;
    try {
      DriveApp.getFileById(driveFileId).setTrashed(true);
    } catch (e) {}
  }

  var ss = SpreadsheetApp.openById(getAnnouncementsSpreadsheetId_());
  var sheet = ensureSheet_(ss, ANNOUNCEMENTS_SHEET_NAME, [
    'AnnouncementID', 'Title', 'Subtitle', 'Body', 'Category', 'Priority',
    'RecipientType', 'RecipientPayload', 'Status', 'IsPinned',
    'CreatedBy', 'CreatedAt', 'UpdatedBy', 'UpdatedAt', 'ArchivedAt'
  ]);
  var values = sheet.getDataRange().getValues();
  var deleted = false;
  for (var i = values.length - 1; i >= 1; i--) {
    if (normalizeText_(values[i][0]) !== id) continue;
    sheet.deleteRow(i + 1);
    deleted = true;
    break;
  }
  if (!deleted) throw new Error('Announcement not found');

  deleteRowsByAnnouncementId_(ANNOUNCEMENTS_ATTACHMENTS_SHEET, id, 1);
  deleteRowsByAnnouncementId_(ANNOUNCEMENTS_TARGETS_SHEET, id, 1);
  deleteRowsByAnnouncementId_(ANNOUNCEMENTS_LOGS_SHEET, id, 1);
  deleteRowsByAnnouncementId_(ANNOUNCEMENTS_READ_SHEET, id, 1);

  return { message: 'Announcement deleted permanently' };
}

function handleSearchAnnouncementRecipients_(body) {
  if (!canManageAnnouncements_(body.username)) throw new Error('Permission denied');
  var query = normalizeLower_(body.query);
  var type = normalizeText_(body.recipientType || 'All');
  var users = getUserProfiles_();
  var suggestions = [];

  if (type === 'Person') {
    users.forEach(function(u) {
      if (!u.username) return;
      var hay = normalizeLower_(u.fullName + ' ' + u.username + ' ' + u.committee);
      if (!query || hay.indexOf(query) !== -1) {
        suggestions.push({ type: 'person', id: u.username, label: u.fullName || u.username, subtitle: u.username + ' • ' + (u.committee || 'No committee') });
      }
    });
  } else if (type === 'Committee') {
    var seen = {};
    users.forEach(function(u) {
      var c = normalizeText_(u.committee);
      if (!c) return;
      if (query && normalizeLower_(c).indexOf(query) === -1) return;
      if (seen[normalizeLower_(c)]) return;
      seen[normalizeLower_(c)] = true;
      suggestions.push({ type: 'committee', id: c, label: c });
    });
  }

  return { suggestions: suggestions.slice(0, 20) };
}

function handlePreviewAnnouncementRecipients_(body) {
  if (!canManageAnnouncements_(body.username)) throw new Error('Permission denied');
  var payload = body.payload || {};
  var targets = buildRecipientTargets_('PREVIEW', payload.recipientType, payload.recipientPayload || {});
  return { targets: targets };
}

function countFileAttachments_(announcementId) {
  var attachments = readAttachmentsByAnnouncement_(announcementId);
  var fileCount = 0;
  for (var i = 0; i < attachments.length; i++) {
    if (normalizeLower_(attachments[i].attachmentType) === 'file') fileCount++;
  }
  return fileCount;
}

function handleUploadAnnouncementAttachment_(body) {
  if (!canManageAnnouncements_(body.username)) throw new Error('Permission denied');
  var announcementId = normalizeText_(body.announcementId);
  if (!announcementId) throw new Error('announcementId is required');
  if (countFileAttachments_(announcementId) >= 10) throw new Error('Maximum 10 file attachments reached');

  var fileName = normalizeText_(body.fileName || 'attachment.bin');
  var mimeType = normalizeText_(body.mimeType || 'application/octet-stream');
  var base64Data = normalizeText_(body.base64Data);
  var sizeBytes = Number(body.sizeBytes || 0);
  if (!base64Data) throw new Error('base64Data is required');
  if (sizeBytes > 10 * 1024 * 1024) throw new Error('Attachment exceeds 10MB limit');
  if (!isAllowedAttachmentMime_(mimeType)) throw new Error('Unsupported file type');

  var folder = DriveApp.getFolderById(getAnnouncementsDriveFolderId_());
  var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, fileName);
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  var url = 'https://lh3.googleusercontent.com/d/' + file.getId();
  var attachmentId = Utilities.getUuid();
  var ss = SpreadsheetApp.openById(getAnnouncementsSpreadsheetId_());
  var sheet = ensureSheet_(ss, ANNOUNCEMENTS_ATTACHMENTS_SHEET, [
    'AttachmentID', 'AnnouncementID', 'AttachmentType', 'Name', 'Url', 'DriveFileId',
    'MimeType', 'SizeBytes', 'CreatedBy', 'CreatedAt'
  ]);
  sheet.appendRow([attachmentId, announcementId, 'file', fileName, url, file.getId(), mimeType, sizeBytes, normalizeText_(body.username), nowIso_()]);

  return {
    data: {
      attachment: {
        attachmentId: attachmentId,
        announcementId: announcementId,
        attachmentType: 'file',
        name: fileName,
        url: url,
        driveFileId: file.getId(),
        mimeType: mimeType,
        sizeBytes: sizeBytes,
        createdBy: normalizeText_(body.username),
        createdAt: nowIso_()
      }
    }
  };
}

function handleAddAnnouncementLinkAttachment_(body) {
  if (!canManageAnnouncements_(body.username)) throw new Error('Permission denied');
  var announcementId = normalizeText_(body.announcementId);
  if (!announcementId) throw new Error('announcementId is required');

  var name = normalizeText_(body.name);
  var url = normalizeText_(body.url);
  if (!name || !url) throw new Error('name and url are required');

  var attachmentId = Utilities.getUuid();
  var ss = SpreadsheetApp.openById(getAnnouncementsSpreadsheetId_());
  var sheet = ensureSheet_(ss, ANNOUNCEMENTS_ATTACHMENTS_SHEET, [
    'AttachmentID', 'AnnouncementID', 'AttachmentType', 'Name', 'Url', 'DriveFileId',
    'MimeType', 'SizeBytes', 'CreatedBy', 'CreatedAt'
  ]);
  sheet.appendRow([attachmentId, announcementId, 'link', name, url, '', '', 0, normalizeText_(body.username), nowIso_()]);

  return {
    data: {
      attachment: {
        attachmentId: attachmentId,
        announcementId: announcementId,
        attachmentType: 'link',
        name: name,
        url: url,
        createdBy: normalizeText_(body.username),
        createdAt: nowIso_()
      }
    }
  };
}

function handleRemoveAnnouncementAttachment_(body) {
  if (!canManageAnnouncements_(body.username)) throw new Error('Permission denied');
  var announcementId = normalizeText_(body.announcementId);
  var attachmentId = normalizeText_(body.attachmentId);
  var ss = SpreadsheetApp.openById(getAnnouncementsSpreadsheetId_());
  var sheet = ensureSheet_(ss, ANNOUNCEMENTS_ATTACHMENTS_SHEET, [
    'AttachmentID', 'AnnouncementID', 'AttachmentType', 'Name', 'Url', 'DriveFileId',
    'MimeType', 'SizeBytes', 'CreatedBy', 'CreatedAt'
  ]);
  var values = sheet.getDataRange().getValues();
  for (var i = values.length - 1; i >= 1; i--) {
    if (normalizeText_(values[i][0]) !== attachmentId || normalizeText_(values[i][1]) !== announcementId) continue;
    var driveFileId = normalizeText_(values[i][5]);
    if (driveFileId) {
      try { DriveApp.getFileById(driveFileId).setTrashed(true); } catch (e) {}
    }
    sheet.deleteRow(i + 1);
    return { message: 'Attachment removed' };
  }
  throw new Error('Attachment not found');
}

function escapeHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseDateSafe_(value) {
  if (!value) return null;
  var text = String(value).trim();
  if (!text) return null;

  // For datetime-local values (YYYY-MM-DDTHH:mm[:ss]), interpret as Manila local time.
  // Example: 2026-03-15T14:30 means 2:30 PM in Asia/Manila.
  var match = text.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (match) {
    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var hour = Number(match[4]);
    var minute = Number(match[5]);
    var second = Number(match[6] || 0);
    var utcMillis = Date.UTC(year, month - 1, day, hour - MANILA_UTC_OFFSET_HOURS, minute, second);
    return new Date(utcMillis);
  }

  // If value already has timezone info (e.g. Z / +08:00), keep native parse.
  var date = new Date(text);
  if (isNaN(date.getTime())) return null;
  return date;
}

function formatIcsDateUtc_(date) {
  return Utilities.formatDate(date, 'UTC', "yyyyMMdd'T'HHmmss'Z'");
}

function formatIcsDateManila_(date) {
  return Utilities.formatDate(date, MANILA_TIMEZONE, "yyyyMMdd'T'HHmmss");
}

function escapeIcsText_(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function buildCalendarIcsBlob_(announcement, eventStart, eventEnd, emailOptions) {
  if (!eventStart || !eventEnd) return null;
  var orgBranding = getAnnouncementsOrgBranding_();
  var orgSlug = toSlugToken_(orgBranding.shortName || orgBranding.chapterName || 'ysp');
  var uid = (announcement.announcementId || Utilities.getUuid()) + '@' + (orgSlug || 'ysp') + '-announcements';
  var nowStamp = formatIcsDateUtc_(new Date());
  var title = escapeIcsText_(announcement.title || 'YSP Event');
  var description = escapeIcsText_(announcement.body || '');
  var location = escapeIcsText_(emailOptions.eventLocation || '');
  var ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//' + escapeIcsText_(orgBranding.shortName || orgBranding.orgName) + '//Announcements//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'X-WR-TIMEZONE:' + MANILA_TIMEZONE,
    'BEGIN:VEVENT',
    'UID:' + uid,
    'DTSTAMP:' + nowStamp,
    'DTSTART;TZID=' + MANILA_TIMEZONE + ':' + formatIcsDateManila_(eventStart),
    'DTEND;TZID=' + MANILA_TIMEZONE + ':' + formatIcsDateManila_(eventEnd),
    'SUMMARY:' + title,
    'DESCRIPTION:' + description,
    'LOCATION:' + location,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  return Utilities.newBlob(ics, 'text/calendar', 'calendar-invite.ics');
}

function buildGoogleCalendarUrl_(announcement, eventStart, eventEnd, emailOptions) {
  if (!eventStart || !eventEnd) return '';
  var dates = formatIcsDateUtc_(eventStart) + '/' + formatIcsDateUtc_(eventEnd);
  var params = [
    'action=TEMPLATE',
    'text=' + encodeURIComponent(String(announcement.title || 'YSP Event')),
    'details=' + encodeURIComponent(String(announcement.body || '')),
    'location=' + encodeURIComponent(String(emailOptions.eventLocation || '')),
    'dates=' + encodeURIComponent(dates)
  ];
  return 'https://calendar.google.com/calendar/render?' + params.join('&');
}

function findAttachmentByNameMatch_(attachments, matchText) {
  var needle = normalizeLower_(matchText);
  if (!needle) return null;
  for (var i = 0; i < attachments.length; i++) {
    if (normalizeLower_(attachments[i].name).indexOf(needle) !== -1) return attachments[i];
  }
  return null;
}

function normalizeRsvpOptions_(optionsText) {
  var raw = String(optionsText || '').trim();
  if (!raw) return ['Going', 'Maybe', 'Not Going'];
  var list = raw.split(',').map(function(part) { return normalizeText_(part); }).filter(function(part) { return !!part; });
  return list.length ? list : ['Going', 'Maybe', 'Not Going'];
}

function buildRsvpMailtoUrl_(email, announcement, optionLabel, target, eventStart, eventEnd, customMessage) {
  var recipient = normalizeText_(email);
  if (!recipient) return '';
  var subject = 'RSVP: ' + normalizeText_(announcement.title) + ' [' + optionLabel + ']';
  var bodyLines;
  if (customMessage) {
    // Replace placeholders in custom message template
    bodyLines = [String(customMessage)
      .replace(/\{response\}/gi, optionLabel)
      .replace(/\{title\}/gi, normalizeText_(announcement.title))
      .replace(/\{name\}/gi, normalizeText_(target.fullName || target.username))
      .replace(/\{username\}/gi, normalizeText_(target.username))
      .replace(/\{email\}/gi, normalizeText_(target.email))
      .replace(/\{announcementId\}/gi, normalizeText_(announcement.announcementId))
    ];
  } else {
    bodyLines = [
      'RSVP Response',
      '',
      'Announcement ID: ' + normalizeText_(announcement.announcementId),
      'Title: ' + normalizeText_(announcement.title),
      'Response: ' + optionLabel,
      'Name: ' + normalizeText_(target.fullName || target.username),
      'Username: ' + normalizeText_(target.username),
      'Email: ' + normalizeText_(target.email)
    ];
  }
  if (eventStart) bodyLines.push('Event Start: ' + eventStart.toISOString());
  if (eventEnd) bodyLines.push('Event End: ' + eventEnd.toISOString());
  return 'mailto:' + encodeURIComponent(recipient) +
    '?subject=' + encodeURIComponent(subject) +
    '&body=' + encodeURIComponent(bodyLines.join('\n'));
}

function buildButtonHtml_(href, label, kind) {
  var safeUrl = escapeHtml_(href);
  var safeLabel = escapeHtml_(label);
  var primary = kind === 'primary';
  return '<a href="' + safeUrl + '" style="display:inline-block;' +
    (primary
      ? 'background:#FF8800;color:#ffffff;border:1px solid #FF8800;'
      : 'background:#ffffff;color:#475569;border:1px solid #e2e8f0;') +
    'text-decoration:none;padding:10px 18px;border-radius:8px;margin:4px 6px 4px 0;font-size:13px;font-weight:600;' +
    'mso-padding-alt:0;line-height:1.4;">' +
    safeLabel + '</a>';
}

/** Build HTML for all custom buttons defined in emailOptions.customButtons */
function buildCustomButtonsHtml_(customButtons, safeAttachments, target, announcement, eventStart, eventEnd, emailOptions) {
  if (!customButtons || !customButtons.length) return '';
  var html = '';
  for (var b = 0; b < customButtons.length; b++) {
    var btn = customButtons[b];
    var btnType = normalizeText_(btn.type);
    var btnLabel = normalizeText_(btn.label);
    if (!btnLabel) continue;
    var btnUrl = '';

    if (btnType === 'rsvp') {
      // RSVP mailto button with pretyped custom message
      var rsvpEmail = normalizeText_(btn.rsvpEmail || (emailOptions && emailOptions.rsvpEmail) || '');
      if (rsvpEmail) {
        btnUrl = buildRsvpMailtoUrl_(rsvpEmail, announcement, btnLabel, target, eventStart, eventEnd, btn.rsvpMessage || '');
      }
    } else if (btnType === 'document') {
      // Find matching attachment by name
      var matchText = normalizeText_(btn.documentMatch);
      if (matchText) {
        var found = findAttachmentByNameMatch_(safeAttachments, matchText);
        if (found && found.url) btnUrl = found.url;
      }
      if (!btnUrl) btnUrl = normalizeText_(btn.url);
    } else {
      // link or any other type
      btnUrl = normalizeText_(btn.url);
    }

    if (btnUrl) {
      var btnKind = normalizeText_(btn.style) === 'primary' ? 'primary' : 'secondary';
      html += buildButtonHtml_(btnUrl, btnLabel, btnKind);
    }
  }
  return html;
}

function formatManilaDate_(date) {
  if (!date) return '';
  return Utilities.formatDate(date, MANILA_TIMEZONE, 'MMMM d, yyyy h:mm a') + ' (Manila Time)';
}

function sendAnnouncementEmail_(target, announcement, attachments) {
  var subject = '[YSP Announcement] ' + announcement.title + ' - ' + announcement.subtitle;
  var safeAttachments = attachments || [];
  var emailOptions = (announcement.recipientPayload && announcement.recipientPayload.emailOptions) || {};

  // Build attachment links for the email body
  var attachmentLinks = safeAttachments.map(function(a) {
    var icon = '📎';
    var mime = normalizeLower_(a.mimeType);
    if (mime.indexOf('pdf') !== -1) icon = '📄';
    else if (mime.indexOf('image') !== -1) icon = '🖼️';
    else if (mime.indexOf('spreadsheet') !== -1 || mime.indexOf('excel') !== -1) icon = '📊';
    else if (mime.indexOf('presentation') !== -1 || mime.indexOf('powerpoint') !== -1) icon = '📽️';
    else if (mime.indexOf('word') !== -1 || mime.indexOf('document') !== -1) icon = '📝';
    var sizeStr = '';
    if (a.sizeBytes && a.sizeBytes > 0) {
      sizeStr = a.sizeBytes > 1048576
        ? ' (' + (a.sizeBytes / 1048576).toFixed(1) + ' MB)'
        : ' (' + Math.round(a.sizeBytes / 1024) + ' KB)';
    }
    return '<tr><td style="padding:6px 0"><a href="' + escapeHtml_(a.url) + '" style="color:#FF8800;text-decoration:none;font-size:13px;font-weight:500">' + icon + ' ' + escapeHtml_(a.name) + escapeHtml_(sizeStr) + '</a></td></tr>';
  }).join('');

  var eventStart = parseDateSafe_(emailOptions.eventStart);
  var eventEnd = parseDateSafe_(emailOptions.eventEnd);
  if (eventStart && !eventEnd) {
    eventEnd = new Date(eventStart.getTime() + 60 * 60 * 1000);
  }
  if (eventStart && eventEnd && eventEnd.getTime() <= eventStart.getTime()) {
    eventEnd = new Date(eventStart.getTime() + 60 * 60 * 1000);
  }

  // Event info block
  var eventInfoHtml = '';
  if (eventStart) {
    var eventLocation = normalizeText_(emailOptions.eventLocation);
    eventInfoHtml = '<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;background:#FFF7ED;border-radius:8px;border:1px solid #FDBA74">' +
      '<tr><td style="padding:16px">' +
      '<div style="font-size:14px;font-weight:700;color:#C2410C;margin-bottom:8px">📅 Event Details</div>' +
      '<div style="font-size:13px;color:#334155;line-height:1.6">' +
      '<strong>Start:</strong> ' + escapeHtml_(formatManilaDate_(eventStart)) + '<br/>' +
      '<strong>End:</strong> ' + escapeHtml_(formatManilaDate_(eventEnd)) +
      (eventLocation ? '<br/><strong>Location:</strong> ' + escapeHtml_(eventLocation) : '') +
      '</div></td></tr></table>';
  }

  // Legacy conditional file button (still supported for backwards compat)
  var conditionalFileButtonHtml = '';
  var fileButtonLabel = normalizeText_(emailOptions.fileButtonLabel);
  var fileButtonMatch = normalizeText_(emailOptions.fileButtonMatch);
  if (fileButtonLabel && fileButtonMatch) {
    var matchedAttachment = findAttachmentByNameMatch_(safeAttachments, fileButtonMatch);
    if (matchedAttachment && matchedAttachment.url) {
      conditionalFileButtonHtml = buildButtonHtml_(matchedAttachment.url, fileButtonLabel, 'secondary');
    }
  }

  // Calendar button + ICS
  var calendarButtonHtml = '';
  var calendarIcsBlob = null;
  if (eventStart && eventEnd) {
    var calendarUrl = buildGoogleCalendarUrl_(announcement, eventStart, eventEnd, emailOptions);
    calendarIcsBlob = buildCalendarIcsBlob_(announcement, eventStart, eventEnd, emailOptions);
    if (calendarUrl) {
      calendarButtonHtml = buildButtonHtml_(calendarUrl, '📅 Add to Calendar', 'secondary');
    }
  }

  // Legacy RSVP buttons (from rsvpOptions)
  var rsvpButtonsHtml = '';
  var rsvpEmail = normalizeText_(emailOptions.rsvpEmail);
  if (rsvpEmail && emailOptions.rsvpOptions) {
    var rsvpOptions = normalizeRsvpOptions_(emailOptions.rsvpOptions);
    var rsvpLine = '';
    for (var r = 0; r < rsvpOptions.length; r++) {
      var optionLabel = rsvpOptions[r];
      var mailto = buildRsvpMailtoUrl_(rsvpEmail, announcement, optionLabel, target, eventStart, eventEnd, emailOptions.rsvpMessageTemplate || '');
      if (!mailto) continue;
      rsvpLine += buildButtonHtml_(mailto, 'RSVP: ' + optionLabel, r === 0 ? 'primary' : 'secondary');
    }
    if (rsvpLine) {
      rsvpButtonsHtml = '<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px"><tr><td>' +
        '<div style="font-size:13px;font-weight:600;margin-bottom:8px;color:#334155">RSVP</div>' +
        '<div>' + rsvpLine + '</div></td></tr></table>';
    }
  }

  // Custom buttons from emailOptions.customButtons array
  var customButtonsHtml = buildCustomButtonsHtml_(
    emailOptions.customButtons || [],
    safeAttachments, target, announcement, eventStart, eventEnd, emailOptions
  );
  var customButtonsSection = '';
  if (customButtonsHtml) {
    customButtonsSection = '<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px"><tr><td>' +
      '<div style="font-size:13px;font-weight:600;margin-bottom:8px;color:#334155">Quick Actions</div>' +
      '<div>' + customButtonsHtml + '</div></td></tr></table>';
  }

  // ──── Fully responsive email HTML ────
  var orgBranding = getAnnouncementsOrgBranding_();
  var htmlBody =
    '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<meta http-equiv="X-UA-Compatible" content="IE=edge">' +
    '<style type="text/css">' +
    'body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}' +
    'table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}' +
    'img{-ms-interpolation-mode:bicubic;border:0;height:auto;line-height:100%;outline:none;text-decoration:none}' +
    'body{margin:0;padding:0;width:100%!important;min-width:100%!important}' +
    '@media only screen and (max-width:620px){' +
    '.email-container{width:100%!important;max-width:100%!important}' +
    '.email-padding{padding:20px 16px!important}' +
    '.email-header{padding:20px 16px!important}' +
    '.btn-row a{display:block!important;width:100%!important;max-width:100%!important;text-align:center!important;margin:4px 0!important;box-sizing:border-box!important}' +
    '}' +
    '</style></head>' +
    '<body style="margin:0;padding:0;background:#f4f6f8;font-family:Roboto,\'Segoe UI\',Arial,Helvetica,sans-serif">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8">' +
    '<tr><td align="center" style="padding:30px 10px">' +

    // Main container
    '<table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">' +

    // Header banner
    '<tr><td align="center" class="email-header" style="background:linear-gradient(135deg,#FF8800 0%,#F97316 100%);padding:28px 20px">' +
    '<img src="' + orgBranding.logoUrl + '" width="64" height="64" alt="YSP Logo" style="border-radius:50%;background:#fff;padding:3px;display:block;margin:0 auto" />' +
    '<div style="color:#ffffff;font-weight:700;font-size:22px;margin-top:10px;letter-spacing:-0.3px">' + escapeHtml_(orgBranding.orgName) + '</div>' +
    '<div style="color:#ffe7cc;font-size:13px;margin-top:2px">' + escapeHtml_(orgBranding.chapterName) + '</div></td></tr>' +

    // Content area
    '<tr><td class="email-padding" style="padding:30px">' +

    // Title
    '<div style="font-size:20px;font-weight:700;color:#1a1a1a;margin-bottom:6px;line-height:1.3">' + escapeHtml_(announcement.title) + '</div>' +
    '<div style="color:#64748b;font-size:14px;margin-bottom:18px;line-height:1.4">' + escapeHtml_(announcement.subtitle) + '</div>' +

    // Body
    '<div style="color:#334155;font-size:14px;line-height:1.7;white-space:pre-line">' + escapeHtml_(announcement.body) + '</div>' +

    // Event info
    eventInfoHtml +

    // Attachments
    (attachmentLinks
      ? '<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;background:#F8FAFC;border-radius:8px;border:1px solid #E2E8F0">' +
        '<tr><td style="padding:12px 16px">' +
        '<div style="font-size:13px;font-weight:700;color:#334155;margin-bottom:6px">📎 Attachments</div>' +
        '<table cellpadding="0" cellspacing="0">' + attachmentLinks + '</table>' +
        '</td></tr></table>'
      : '') +

    // Default buttons row
    '<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px"><tr><td class="btn-row">' +
    buildButtonHtml_(WEB_APP_URL, 'Open Web App', 'primary') +
    buildButtonHtml_(FB_PAGE_URL, 'Facebook', 'secondary') +
    conditionalFileButtonHtml +
    calendarButtonHtml +
    '</td></tr></table>' +

    // Custom buttons
    customButtonsSection +

    // RSVP buttons
    rsvpButtonsHtml +

    '</td></tr>' +

    // Footer
    '<tr><td style="padding:16px 30px;background:#F8FAFC;border-top:1px solid #E2E8F0;text-align:center">' +
    '<div style="font-size:11px;color:#94a3b8;line-height:1.5">' +
    escapeHtml_(orgBranding.orgName) + ' &bull; ' + escapeHtml_(orgBranding.chapterName) + '<br/>' +
    'This is an automated notification from the YSP Web App.' +
    '</div></td></tr>' +

    '</table></td></tr></table></body></html>';

  // ──── Build email attachments (calendar ICS + uploaded Drive files) ────
  var emailPayload = { to: target.email, subject: subject, htmlBody: htmlBody };
  var allEmailAttachments = [];
  if (calendarIcsBlob) allEmailAttachments.push(calendarIcsBlob);

  // Attach actual uploaded files from Drive
  for (var fi = 0; fi < safeAttachments.length; fi++) {
    var att = safeAttachments[fi];
    if (normalizeLower_(att.attachmentType) !== 'file') continue;
    var driveId = normalizeText_(att.driveFileId);
    if (!driveId) continue;
    try {
      var driveFile = DriveApp.getFileById(driveId);
      var fileBlob = driveFile.getBlob();
      // Gmail attachment limit is ~25MB, skip large files
      if (fileBlob.getBytes().length <= 20 * 1024 * 1024) {
        allEmailAttachments.push(fileBlob);
      }
    } catch (e) {
      // Skip if file not accessible
      Logger.log('Could not attach Drive file ' + driveId + ': ' + e);
    }
  }

  if (allEmailAttachments.length) {
    emailPayload.attachments = allEmailAttachments;
  }
  MailApp.sendEmail(emailPayload);
}

function handleSendAnnouncement_(body) {
  if (!canManageAnnouncements_(body.username)) throw new Error('Permission denied');
  var announcementId = normalizeText_(body.announcementId);
  var mode = normalizeText_(body.mode || 'all');
  var deliveryChannel = normalizeLower_(body.deliveryChannel || 'email');
  if (deliveryChannel !== 'email' && deliveryChannel !== 'frontend') {
    throw new Error('deliveryChannel must be email or frontend');
  }
  var specificSet = {};
  (body.recipientIds || []).forEach(function(id) { specificSet[normalizeText_(id)] = true; });

  var full = handleGetAnnouncementById_({ username: body.username, announcementId: announcementId }).item;
  var targets = full.targets || [];
  var attachments = full.attachments || [];
  var sent = 0, failed = 0, skipped = 0;

  for (var i = 0; i < targets.length; i++) {
    var t = targets[i];
    if (mode === 'specific' && !specificSet[t.targetId]) continue;
    if (t.eligibility !== 'eligible') {
      skipped++;
      appendLog_(announcementId, t, 'sendAnnouncement', 'skipped', t.reason || 'Not eligible', body.username);
      continue;
    }
    if (deliveryChannel === 'frontend') {
      sent++;
      appendLog_(announcementId, t, 'sendAnnouncement', 'sent', 'Frontend-only delivery', body.username);
      continue;
    }
    try {
      sendAnnouncementEmail_(t, full, attachments);
      sent++;
      appendLog_(announcementId, t, 'sendAnnouncement', 'sent', '', body.username);
    } catch (e) {
      failed++;
      appendLog_(announcementId, t, 'sendAnnouncement', 'failed', String(e), body.username);
    }
  }

  var raw = readAnnouncementsRaw_();
  for (var r = 0; r < raw.rows.length; r++) {
    if (raw.rows[r].announcementId !== announcementId) continue;
    raw.sheet.getRange(raw.rows[r].row, 9).setValue('Sent');
    raw.sheet.getRange(raw.rows[r].row, 13).setValue(normalizeText_(body.username));
    raw.sheet.getRange(raw.rows[r].row, 14).setValue(nowIso_());
    break;
  }

  return { summary: { total: sent + failed + skipped, sent: sent, failed: failed, skipped: skipped, deliveryChannel: deliveryChannel } };
}

function handleResendAnnouncementRecipient_(body) {
  if (!canManageAnnouncements_(body.username)) throw new Error('Permission denied');
  var announcementId = normalizeText_(body.announcementId);
  var targetId = normalizeText_(body.targetId);
  var full = handleGetAnnouncementById_({ username: body.username, announcementId: announcementId }).item;
  var targets = full.targets || [];
  var target = null;
  for (var i = 0; i < targets.length; i++) {
    if (targets[i].targetId === targetId) { target = targets[i]; break; }
  }
  if (!target) throw new Error('Target not found');
  if (target.eligibility !== 'eligible') throw new Error('Target is not eligible');

  try {
    sendAnnouncementEmail_(target, full, full.attachments || []);
    appendLog_(announcementId, target, 'resendAnnouncementRecipient', 'sent', '', body.username);
    return { message: 'Resent successfully' };
  } catch (e) {
    appendLog_(announcementId, target, 'resendAnnouncementRecipient', 'failed', String(e), body.username);
    throw e;
  }
}

function handleGetAnnouncementSendLogs_(body) {
  var perms = getPermissionBlock_(body.username);
  if (!perms.canView) throw new Error('Permission denied');
  return { logs: readLogs_(normalizeText_(body.announcementId)) };
}
