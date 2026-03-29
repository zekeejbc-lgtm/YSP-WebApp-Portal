/**
 * =====================================================
 * YSP - NOTIFICATIONS SYSTEM
 * Google Apps Script Backend
 * =====================================================
 *
 * This script stores notification subscriptions and
 * notification records for the WebApp.
 *
 * NOTE:
 * - Web push delivery requires an external push service.
 * - This backend stores subscriptions and queues records.
 *
 * @version 1.0.0
 * @lastUpdated 2026-01-16
 */

// =====================================================
// CONFIGURATION
// =====================================================

function getNotificationsSpreadsheetId() {
  return PropertiesService.getScriptProperties().getProperty('NOTIFICATIONS_SPREADSHEET_ID')
    || '1hKuLWjMEZkK-PndFHbOsv7ks68V5-1g9e5p8osSE21w';
}

function setNotificationsSpreadsheetId(spreadsheetId) {
  PropertiesService.getScriptProperties().setProperty('NOTIFICATIONS_SPREADSHEET_ID', spreadsheetId);
}

function getNotificationsApiUrl() {
  return PropertiesService.getScriptProperties().getProperty('NOTIFICATIONS_API_URL') || '';
}

function setNotificationsApiUrl(apiUrl) {
  PropertiesService.getScriptProperties().setProperty('NOTIFICATIONS_API_URL', apiUrl);
}

const NOTIFICATIONS_BRANDING_DEFAULTS = {
  shortName: 'YSP Tagum',
  chapterName: 'Tagum Chapter'
};
const NOTIFICATIONS_BRANDING_SHEET_NAME = 'Organization Branding';

function toSafeNotificationsText_(value, fallbackValue, maxLen) {
  var text = String(value || '').trim();
  if (!text) text = String(fallbackValue || '').trim();
  var limit = maxLen || 200;
  return text.length > limit ? text.substring(0, limit) : text;
}

function normalizeNotificationsBranding_(raw) {
  var props = PropertiesService.getScriptProperties();
  var branding = raw || {};
  return {
    shortName: toSafeNotificationsText_(
      branding.shortName || props.getProperty('ORG_SHORT_NAME') || NOTIFICATIONS_BRANDING_DEFAULTS.shortName,
      NOTIFICATIONS_BRANDING_DEFAULTS.shortName,
      120
    ),
    chapterName: toSafeNotificationsText_(
      branding.chapterName || props.getProperty('ORG_CHAPTER_NAME') || NOTIFICATIONS_BRANDING_DEFAULTS.chapterName,
      NOTIFICATIONS_BRANDING_DEFAULTS.chapterName,
      120
    )
  };
}

function getNotificationsBrandingFromSheet_() {
  try {
    var props = PropertiesService.getScriptProperties();
    var settingsId = toSafeNotificationsText_(props.getProperty('SYSTEM_SETTINGS_SPREADSHEET_ID'), '', 120);
    if (!settingsId) return null;

    var ss = SpreadsheetApp.openById(settingsId);
    var sheet = ss.getSheetByName(NOTIFICATIONS_BRANDING_SHEET_NAME);
    if (!sheet || sheet.getLastRow() < 2) return null;

    var values = sheet.getDataRange().getValues();
    var headers = values[0] || [];
    var keyIdx = headers.indexOf('ConfigKey');
    var valueIdx = headers.indexOf('Value');
    if (keyIdx === -1 || valueIdx === -1) return null;

    var rowMap = {};
    for (var i = 1; i < values.length; i++) {
      var key = toSafeNotificationsText_(values[i][keyIdx], '', 120);
      if (!key) continue;
      rowMap[key] = toSafeNotificationsText_(values[i][valueIdx], '', 500);
    }

    return {
      shortName: rowMap.shortName || '',
      chapterName: rowMap.chapterName || ''
    };
  } catch (sheetReadError) {
    Logger.log('Notifications branding sheet fallback read failed: ' + sheetReadError.toString());
    return null;
  }
}

function getNotificationsOrgBranding_() {
  var branding = normalizeNotificationsBranding_({});
  var resolvedFromEndpoint = false;

  try {
    var props = PropertiesService.getScriptProperties();
    var endpoint = toSafeNotificationsText_(
      props.getProperty('SYSTEM_TOOLS_BRANDING_URL') || props.getProperty('SYSTEM_TOOLS_WEB_APP_URL'),
      '',
      500
    );

    if (endpoint) {
      var response = UrlFetchApp.fetch(endpoint, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({ action: 'getOrgBranding' }),
        muteHttpExceptions: true
      });
      if (response.getResponseCode() >= 200 && response.getResponseCode() < 300) {
        var parsed = JSON.parse(response.getContentText() || '{}');
        if (parsed && parsed.success === true && parsed.data) {
          branding = normalizeNotificationsBranding_(parsed.data);
          resolvedFromEndpoint = true;
        }
      }
    }
  } catch (error) {
    Logger.log('Notifications branding fetch failed: ' + error.toString());
  }

  if (!resolvedFromEndpoint) {
    var sheetBranding = getNotificationsBrandingFromSheet_();
    if (sheetBranding) {
      branding = normalizeNotificationsBranding_(sheetBranding);
    }
  }

  return branding;
}

// =====================================================
// WEB APP ENTRY POINTS
// =====================================================

function isRequestCancelled_(params) {
  return !!(params && (params.cancelled === true || params.cancelled === 'true' || params.action === 'cancel'));
}

function doGet(e) {
  const params = (e && e.parameter) || {};
  const action = params.action || 'health';

  try {
    if (isRequestCancelled_(params)) {
      return createJsonResponse_({ success: false, cancelled: true, message: 'Request cancelled' });
    }

    // Keep health endpoint public; require token for all others.
    if (action !== 'health') {
      var tokenUser = verifyHmacToken_(params.sessionToken);
      var sessionSecret = PropertiesService.getScriptProperties().getProperty('SESSION_SECRET_KEY');
      if (!sessionSecret) {
        return createJsonResponse_({ success: false, error: 'Server auth misconfigured: SESSION_SECRET_KEY is missing', code: 503 });
      }
      if (!tokenUser) {
        return createJsonResponse_({ success: false, error: 'Invalid or expired session token', code: 401 });
      }
      params.username = tokenUser.username;
    }

    switch (action) {
      case 'health':
        return createJsonResponse_({
          success: true,
          status: 'online',
          timestamp: new Date().toISOString(),
        });
      case 'initializeSheets': {
        var initUser = params.username || '';
        var initAuth = requireAdminOrAuditor_(initUser, 'initialize sheets');
        if (initAuth) return createJsonResponse_(initAuth);
        return createJsonResponse_(initializeNotificationSheets());
      }
      case 'getNotifications':
        return createJsonResponse_(getNotifications(params));
      case 'getSubscriptions': {
        var subUser = params.username || '';
        var subAuth = requireAdminOrAuditor_(subUser, 'view subscriptions');
        if (subAuth) return createJsonResponse_(subAuth);
        return createJsonResponse_(getSubscriptions(params));
      }
      case 'getConfig':
        return createJsonResponse_({
          success: true,
          spreadsheetId: getNotificationsSpreadsheetId(),
          apiUrl: getNotificationsApiUrl(),
        });
      default:
        return createJsonResponse_({ success: false, error: 'Invalid action' });
    }
  } catch (error) {
    return createJsonResponse_({ success: false, error: error.toString() });
  }
}

// =====================================================
// ROLE-BASED ACCESS CONTROL
// =====================================================

/**
 * Look up a user's role from the User Profiles sheet.
 * Requires LOGIN_SPREADSHEET_ID in Script Properties.
 */
function getUserRole_(username) {
  if (!username) return null;
  try {
    var ssId = PropertiesService.getScriptProperties().getProperty('LOGIN_SPREADSHEET_ID') || '';
    if (!ssId) return null;
    var ss = SpreadsheetApp.openById(ssId);
    var sheet = ss.getSheetByName('User Profiles');
    if (!sheet) return null;
    var data = sheet.getDataRange().getValues();
    var headers = data[0] || [];
    var usernameIdx = headers.indexOf('Username');
    var roleIdx = headers.indexOf('Role');
    if (usernameIdx === -1 || roleIdx === -1) return null;
    var target = String(username).toLowerCase().trim();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][usernameIdx] || '').toLowerCase().trim() === target) {
        return String(data[i][roleIdx] || '').toLowerCase().trim();
      }
    }
    return null;
  } catch (e) {
    Logger.log('getUserRole_ error: ' + e.toString());
    return null;
  }
}

function normalizeRoleValue_(roleName) {
  return String(roleName || '').toLowerCase().trim();
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

    var target = normalizeRoleValue_(roleName);
    for (var i = 1; i < values.length; i++) {
      var rowName = normalizeRoleValue_(values[i][roleNameIdx]);
      if (rowName !== target) continue;

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
    Logger.log('getSystemRoleRecordByName_ error: ' + e.toString());
    return null;
  }
}

function requireAdminOrAuditor_(username, actionDescription) {
  if (!username) {
    return { success: false, error: 'Username is required for authorization', code: 400 };
  }
  var role = normalizeRoleValue_(getUserRole_(username));
  if (role === 'banned' || role === 'suspended') {
    return { success: false, error: 'Account is restricted', code: 403 };
  }
  var roleRecord = getSystemRoleRecordByName_(role);
  var hasLegacyAdminAccess = role === 'auditor' || role === 'admin' || role === 'head' || role.indexOf('admin') !== -1 || role.indexOf('auditor') !== -1;
  var hasPermissionAccess = !!(
    roleRecord &&
    (
      roleRecord.powerLevel >= 8 ||
      roleRecord.permissions.canEditContent === true ||
      roleRecord.permissions.canManageUsers === true
    )
  );
  if (!hasLegacyAdminAccess && !hasPermissionAccess) {
    return { success: false, error: 'Permission denied: cannot ' + (actionDescription || 'perform this action'), code: 403 };
  }
  return null;
}

/**
 * Validate the request API key.
 * Set SECRET_API_KEY in Script Properties for each deployment.
 */
function validateApiKey_(key) {
  var expected = PropertiesService.getScriptProperties().getProperty('SECRET_API_KEY') || '';
  if (!expected) {
    Logger.log('ERROR: SECRET_API_KEY not set — rejecting request');
    return false;
  }
  return !!(key && String(key).trim() === expected);
}

// ---- HMAC Session Token Verification ----

function bytesToHex_(bytes) {
  return bytes.map(function(b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
}

function verifyHmacToken_(token) {
  if (!token || typeof token !== 'string') return null;
  var secret = PropertiesService.getScriptProperties().getProperty('SESSION_SECRET_KEY');
  if (!secret) {
    Logger.log('WARNING: SESSION_SECRET_KEY not set â€” token verification skipped');
    return null;
  }
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
    Logger.log('verifyHmacToken_ error: ' + e.toString());
    return null;
  }
}

function doPost(e) {
  let params;
  try {
    params = JSON.parse(e.postData.contents);
  } catch (error) {
    return createJsonResponse_({ success: false, error: 'Invalid JSON payload' });
  }

  try {
    if (isRequestCancelled_(params)) {
      return createJsonResponse_({ success: false, cancelled: true, message: 'Request cancelled' });
    }

    // ---- API key validation ----
    if (!validateApiKey_(params.key)) {
      return createJsonResponse_({ success: false, error: 'Invalid or missing API key', code: 401 });
    }

    // ---- Session token verification (HMAC) ----
    var tokenUser = verifyHmacToken_(params.sessionToken);
    var sessionSecret = PropertiesService.getScriptProperties().getProperty('SESSION_SECRET_KEY');
    if (!sessionSecret) {
      return createJsonResponse_({ success: false, error: 'Server auth misconfigured: SESSION_SECRET_KEY is missing', code: 503 });
    }
    if (!tokenUser) {
      return createJsonResponse_({ success: false, error: 'Invalid or expired session token', code: 401 });
    }
    params.username = tokenUser.username;

    switch (params.action) {
      case 'initializeSheets': {
        // ---- Role check: only admin or auditor can initialize sheets ----
        const initAuth = requireAdminOrAuditor_(params.username, 'initialize sheets');
        if (initAuth) return createJsonResponse_(initAuth);
        return createJsonResponse_(initializeNotificationSheets());
      }
      case 'registerSubscription':
        return createJsonResponse_(registerSubscription(params));
      case 'registerFcmToken':
        return createJsonResponse_(registerFcmToken(params));
      case 'unregisterSubscription':
        return createJsonResponse_(unregisterSubscription(params));
      case 'createNotification': {
        // ---- Role check: only admin or auditor can create notifications ----
        const authError = requireAdminOrAuditor_(params.username || params.userId, 'create notifications');
        if (authError) return createJsonResponse_(authError);
        return createJsonResponse_(createNotification(params));
      }
      case 'queueNotification': {
        // ---- Role check: only admin or auditor can queue notifications ----
        const authError = requireAdminOrAuditor_(params.username || params.userId, 'queue notifications');
        if (authError) return createJsonResponse_(authError);
        return createJsonResponse_(queueNotification(params));
      }
      default:
        return createJsonResponse_({ success: false, error: 'Invalid action' });
    }
  } catch (error) {
    return createJsonResponse_({ success: false, error: error.toString() });
  }
}

// =====================================================
// SHEET INITIALIZATION
// =====================================================

function initializeNotificationSheets() {
  try {
    let spreadsheetId = getNotificationsSpreadsheetId();
    let ss;
    var orgBranding = getNotificationsOrgBranding_();

    if (!spreadsheetId) {
      ss = SpreadsheetApp.create(orgBranding.shortName + ' - Notifications');
      spreadsheetId = ss.getId();
      setNotificationsSpreadsheetId(spreadsheetId);
    } else {
      ss = SpreadsheetApp.openById(spreadsheetId);
    }

    createSheetWithHeaders_(ss, 'Subscriptions', [
      'SubscriptionId',
      'Provider',
      'FcmToken',
      'Endpoint',
      'P256dh',
      'Auth',
      'UserId',
      'UserName',
      'Role',
      'Platform',
      'UserAgent',
      'CreatedAt',
      'UpdatedAt',
      'Active',
    ]);

    createSheetWithHeaders_(ss, 'Notifications', [
      'NotificationId',
      'Title',
      'Body',
      'Url',
      'Icon',
      'Image',
      'TargetRole',
      'TargetUserId',
      'DataJson',
      'Status',
      'CreatedAt',
      'SentAt',
      'CreatedBy',
      'DeliveryCount',
      'Error',
    ]);

    createSheetWithHeaders_(ss, 'NotificationLogs', [
      'NotificationId',
      'SubscriptionId',
      'Status',
      'Message',
      'Timestamp',
    ]);

    const defaultSheet = ss.getSheetByName('Sheet1');
    if (defaultSheet && ss.getSheets().length > 1) {
      ss.deleteSheet(defaultSheet);
    }

    return {
      success: true,
      message: 'Notification sheets initialized successfully',
      spreadsheetId: spreadsheetId,
      spreadsheetUrl: ss.getUrl(),
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function createSheetWithHeaders_(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
}

// =====================================================
// SUBSCRIPTION MANAGEMENT
// =====================================================

function registerSubscription(params) {
  const subscription = params.subscription;
  if (!subscription || !subscription.endpoint || !subscription.keys) {
    return { success: false, error: 'Subscription object is required' };
  }

  const ss = getNotificationsSpreadsheet_();
  if (!ss) return { success: false, error: 'Notification database not configured' };

  const sheet = ss.getSheetByName('Subscriptions');
  const headers = getHeaderMap_(sheet);
  const data = sheet.getDataRange().getValues();

  const endpoint = subscription.endpoint;
  const rowIndex = findRowByValue_(data, headers.Endpoint, endpoint);
  const now = new Date().toISOString();
  const subscriptionId = rowIndex > 0 ? data[rowIndex - 1][headers.SubscriptionId - 1] : Utilities.getUuid();

  const rowValues = [];
  rowValues[headers.SubscriptionId - 1] = subscriptionId;
  rowValues[headers.Provider - 1] = 'webpush';
  rowValues[headers.FcmToken - 1] = '';
  rowValues[headers.Endpoint - 1] = endpoint;
  rowValues[headers.P256dh - 1] = subscription.keys.p256dh || '';
  rowValues[headers.Auth - 1] = subscription.keys.auth || '';
  rowValues[headers.UserId - 1] = params.userId || '';
  rowValues[headers.UserName - 1] = params.userName || '';
  rowValues[headers.Role - 1] = params.role || '';
  rowValues[headers.Platform - 1] = params.platform || '';
  rowValues[headers.UserAgent - 1] = params.userAgent || '';
  rowValues[headers.CreatedAt - 1] = rowIndex > 0 ? data[rowIndex - 1][headers.CreatedAt - 1] : now;
  rowValues[headers.UpdatedAt - 1] = now;
  rowValues[headers.Active - 1] = 'TRUE';

  writeRow_(sheet, rowIndex, headers, rowValues);

  return {
    success: true,
    message: 'Subscription saved',
    subscriptionId: subscriptionId,
  };
}

function registerFcmToken(params) {
  const fcmToken = params.fcmToken;
  if (!fcmToken) {
    return { success: false, error: 'FCM token is required' };
  }

  const ss = getNotificationsSpreadsheet_();
  if (!ss) return { success: false, error: 'Notification database not configured' };

  const sheet = ss.getSheetByName('Subscriptions');
  const headers = getHeaderMap_(sheet);
  const data = sheet.getDataRange().getValues();

  const rowIndex = findRowByValue_(data, headers.FcmToken, fcmToken);
  const now = new Date().toISOString();
  const subscriptionId = rowIndex > 0 ? data[rowIndex - 1][headers.SubscriptionId - 1] : Utilities.getUuid();

  const rowValues = [];
  rowValues[headers.SubscriptionId - 1] = subscriptionId;
  rowValues[headers.Provider - 1] = 'fcm';
  rowValues[headers.FcmToken - 1] = fcmToken;
  rowValues[headers.Endpoint - 1] = '';
  rowValues[headers.P256dh - 1] = '';
  rowValues[headers.Auth - 1] = '';
  rowValues[headers.UserId - 1] = params.userId || '';
  rowValues[headers.UserName - 1] = params.userName || '';
  rowValues[headers.Role - 1] = params.role || '';
  rowValues[headers.Platform - 1] = params.platform || '';
  rowValues[headers.UserAgent - 1] = params.userAgent || '';
  rowValues[headers.CreatedAt - 1] = rowIndex > 0 ? data[rowIndex - 1][headers.CreatedAt - 1] : now;
  rowValues[headers.UpdatedAt - 1] = now;
  rowValues[headers.Active - 1] = 'TRUE';

  writeRow_(sheet, rowIndex, headers, rowValues);

  return {
    success: true,
    message: 'FCM token saved',
    subscriptionId: subscriptionId,
  };
}

function unregisterSubscription(params) {
  const endpoint = params.endpoint;
  const subscriptionId = params.subscriptionId;
  const fcmToken = params.fcmToken;
  if (!endpoint && !subscriptionId && !fcmToken) {
    return { success: false, error: 'Endpoint or subscriptionId is required' };
  }

  const ss = getNotificationsSpreadsheet_();
  if (!ss) return { success: false, error: 'Notification database not configured' };

  const sheet = ss.getSheetByName('Subscriptions');
  const headers = getHeaderMap_(sheet);
  const data = sheet.getDataRange().getValues();
  let rowIndex = -1;

  if (endpoint) {
    rowIndex = findRowByValue_(data, headers.Endpoint, endpoint);
  } else if (subscriptionId) {
    rowIndex = findRowByValue_(data, headers.SubscriptionId, subscriptionId);
  } else if (fcmToken) {
    rowIndex = findRowByValue_(data, headers.FcmToken, fcmToken);
  }

  if (rowIndex < 2) {
    return { success: false, error: 'Subscription not found' };
  }

  sheet.getRange(rowIndex, headers.Active).setValue('FALSE');
  sheet.getRange(rowIndex, headers.UpdatedAt).setValue(new Date().toISOString());

  return { success: true, message: 'Subscription disabled' };
}

function getSubscriptions(params) {
  const ss = getNotificationsSpreadsheet_();
  if (!ss) return { success: false, error: 'Notification database not configured' };

  const sheet = ss.getSheetByName('Subscriptions');
  const values = sheet.getDataRange().getValues();
  const headers = values.shift();
  const results = [];

  values.forEach((row) => {
    results.push(rowToObject_(headers, row));
  });

  return { success: true, subscriptions: results };
}

// =====================================================
// NOTIFICATION RECORDS
// =====================================================

function createNotification(params) {
  const payload = params.notification || {};
  if (!payload.title || !payload.body) {
    return { success: false, error: 'Title and body are required' };
  }

  const ss = getNotificationsSpreadsheet_();
  if (!ss) return { success: false, error: 'Notification database not configured' };

  const sheet = ss.getSheetByName('Notifications');
  const headers = getHeaderMap_(sheet);
  const notificationId = Utilities.getUuid();
  const now = new Date().toISOString();

  const rowValues = [];
  rowValues[headers.NotificationId - 1] = notificationId;
  rowValues[headers.Title - 1] = payload.title;
  rowValues[headers.Body - 1] = payload.body;
  rowValues[headers.Url - 1] = payload.url || '';
  rowValues[headers.Icon - 1] = payload.icon || '';
  rowValues[headers.Image - 1] = payload.image || '';
  rowValues[headers.TargetRole - 1] = payload.targetRole || '';
  rowValues[headers.TargetUserId - 1] = payload.targetUserId || '';
  rowValues[headers.DataJson - 1] = JSON.stringify(payload.data || {});
  rowValues[headers.Status - 1] = 'created';
  rowValues[headers.CreatedAt - 1] = now;
  rowValues[headers.SentAt - 1] = '';
  rowValues[headers.CreatedBy - 1] = payload.createdBy || '';
  rowValues[headers.DeliveryCount - 1] = 0;
  rowValues[headers.Error - 1] = '';

  sheet.appendRow(ensureRowWidth_(headers, rowValues));

  return {
    success: true,
    message: 'Notification created',
    notificationId: notificationId,
  };
}

function queueNotification(params) {
  const createResult = createNotification(params);
  if (!createResult.success) return createResult;

  const ss = getNotificationsSpreadsheet_();
  if (!ss) return { success: false, error: 'Notification database not configured' };

  const subscriptionsSheet = ss.getSheetByName('Subscriptions');
  const subscriptions = subscriptionsSheet.getDataRange().getValues();
  const subHeaders = subscriptions.shift();
  const activeIndex = subHeaders.indexOf('Active');
  const subscriptionIdIndex = subHeaders.indexOf('SubscriptionId');

  const logsSheet = ss.getSheetByName('NotificationLogs');
  const now = new Date().toISOString();
  let queuedCount = 0;

  subscriptions.forEach((row) => {
    const isActive = String(row[activeIndex]).toUpperCase() === 'TRUE';
    if (!isActive) return;
    const subscriptionId = row[subscriptionIdIndex];
    logsSheet.appendRow([createResult.notificationId, subscriptionId, 'queued', 'Queued for delivery', now]);
    queuedCount += 1;
  });

  const notificationsSheet = ss.getSheetByName('Notifications');
  const notifHeaders = getHeaderMap_(notificationsSheet);
  const data = notificationsSheet.getDataRange().getValues();
  const rowIndex = findRowByValue_(data, notifHeaders.NotificationId, createResult.notificationId);
  if (rowIndex > 1) {
    notificationsSheet.getRange(rowIndex, notifHeaders.Status).setValue('queued');
    notificationsSheet.getRange(rowIndex, notifHeaders.DeliveryCount).setValue(queuedCount);
  }

  return {
    success: true,
    message: 'Notification queued',
    notificationId: createResult.notificationId,
    queuedCount: queuedCount,
  };
}

function getNotifications(params) {
  const ss = getNotificationsSpreadsheet_();
  if (!ss) return { success: false, error: 'Notification database not configured' };

  const sheet = ss.getSheetByName('Notifications');
  const values = sheet.getDataRange().getValues();
  const headers = values.shift();
  const results = [];

  const targetUserId = params.targetUserId || '';
  const targetRole = params.targetRole || '';
  const status = params.status || '';

  values.forEach((row) => {
    const rowObj = rowToObject_(headers, row);
    if (status && rowObj.Status !== status) return;
    if (targetUserId && rowObj.TargetUserId && rowObj.TargetUserId !== targetUserId) return;
    if (targetRole && rowObj.TargetRole && rowObj.TargetRole !== targetRole) return;
    results.push(rowObj);
  });

  return { success: true, notifications: results };
}

// =====================================================
// HELPERS
// =====================================================

function getNotificationsSpreadsheet_() {
  const spreadsheetId = getNotificationsSpreadsheetId();
  if (!spreadsheetId) return null;
  return SpreadsheetApp.openById(spreadsheetId);
}

function createJsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function getHeaderMap_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = {};
  headers.forEach((header, index) => {
    map[header] = index + 1;
  });
  return map;
}

function ensureRowWidth_(headers, rowValues) {
  const maxLen = Object.keys(headers).length;
  const filled = [];
  for (let i = 0; i < maxLen; i += 1) {
    filled[i] = rowValues[i] !== undefined ? rowValues[i] : '';
  }
  return filled;
}

function findRowByValue_(data, columnIndex, value) {
  if (!columnIndex) return -1;
  for (let i = 1; i < data.length; i += 1) {
    if (data[i][columnIndex - 1] === value) {
      return i + 1;
    }
  }
  return -1;
}

function writeRow_(sheet, rowIndex, headers, rowValues) {
  if (rowIndex > 1) {
    sheet.getRange(rowIndex, 1, 1, Object.keys(headers).length).setValues([ensureRowWidth_(headers, rowValues)]);
  } else {
    sheet.appendRow(ensureRowWidth_(headers, rowValues));
  }
}

function rowToObject_(headers, row) {
  const obj = {};
  headers.forEach((header, index) => {
    obj[header] = row[index];
  });
  return obj;
}


