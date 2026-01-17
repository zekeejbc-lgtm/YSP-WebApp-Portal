/**
 * =====================================================
 * YSP TAGUM - NOTIFICATIONS SYSTEM
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

    switch (action) {
      case 'health':
        return createJsonResponse_({
          success: true,
          status: 'online',
          timestamp: new Date().toISOString(),
        });
      case 'initializeSheets':
        return createJsonResponse_(initializeNotificationSheets());
      case 'getNotifications':
        return createJsonResponse_(getNotifications(params));
      case 'getSubscriptions':
        return createJsonResponse_(getSubscriptions(params));
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

    switch (params.action) {
      case 'initializeSheets':
        return createJsonResponse_(initializeNotificationSheets());
      case 'registerSubscription':
        return createJsonResponse_(registerSubscription(params));
      case 'registerFcmToken':
        return createJsonResponse_(registerFcmToken(params));
      case 'unregisterSubscription':
        return createJsonResponse_(unregisterSubscription(params));
      case 'createNotification':
        return createJsonResponse_(createNotification(params));
      case 'queueNotification':
        return createJsonResponse_(queueNotification(params));
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

    if (!spreadsheetId) {
      ss = SpreadsheetApp.create('YSP Tagum - Notifications');
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
