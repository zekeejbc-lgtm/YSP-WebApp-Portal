/**
 * =====================================================
 * YSP TAGUM - EVENTS MANAGEMENT SYSTEM
 * Google Apps Script Backend
 * =====================================================
 * 
 * This script handles all event management operations
 * for the YSP Tagum WebApp including:
 * - Event CRUD operations with geofencing support
 * - Event attendance tracking
 * - Sheet initialization
 * 
 * SPREADSHEET STRUCTURE:
 * - Events: Main events data with geofencing (Latitude, Longitude, Radius)
 * - EventAttendance: Attendance records per event
 * - EventSettings: Configuration settings
 * 
 * @author YSP Tagum Development Team
 * @version 1.1.0
 * @lastUpdated 2026-01-10
 */

// =====================================================
// CONFIGURATION
// =====================================================

/**
 * Get the Events Spreadsheet ID from PropertiesService
 * Set EVENTS_SPREADSHEET_ID in Script Properties
 */
function getEventsSpreadsheetId() {
  var cached = PropertiesService.getScriptProperties().getProperty('EVENTS_SPREADSHEET_ID');
  return cached || '';
}

/**
 * Set the Events Spreadsheet ID (optional - for dynamic configuration)
 */
function setEventsSpreadsheetId(spreadsheetId) {
  PropertiesService.getScriptProperties().setProperty('EVENTS_SPREADSHEET_ID', spreadsheetId);
}

// =====================================================
// WEB APP ENTRY POINTS
// =====================================================

function isRequestCancelled_(params) {
  return !!(params && (params.cancelled === true || params.cancelled === 'true' || params.action === 'cancel'));
}

/**
 * Handle GET requests
 */
/**
 * Sanitize a string parameter for Events: trim, enforce max length, strip control chars
 */
function sanitizeEventsParam_(value, maxLen) {
  if (value === null || value === undefined) return '';
  var str = String(value).trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  var limit = maxLen || 200;
  return str.length > limit ? str.substring(0, limit) : str;
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
      roleRecord.permissions.canManageUsers === true ||
      roleRecord.permissions.canAccessSystemTools === true
    )
  );
  if (!hasLegacyAdminAccess && !hasPermissionAccess) {
    return { success: false, error: 'Permission denied: cannot ' + (actionDescription || 'perform this action'), code: 403 };
  }
  return null;
}

function requireHeadOrAbove_(username, actionDescription) {
  if (!username) {
    return { success: false, error: 'Username is required for authorization', code: 400 };
  }
  var role = normalizeRoleValue_(getUserRole_(username));
  if (role === 'banned' || role === 'suspended') {
    return { success: false, error: 'Account is restricted', code: 403 };
  }
  var roleRecord = getSystemRoleRecordByName_(role);
  var hasLegacyHeadAccess = role === 'head' || role === 'officer' || role === 'admin' || role === 'auditor' || role.indexOf('president') !== -1;
  var hasPermissionAccess = !!(
    roleRecord &&
    (
      roleRecord.powerLevel >= 5 ||
      roleRecord.permissions.canManageEvents === true ||
      roleRecord.permissions.canEditContent === true ||
      roleRecord.permissions.canApproveMembers === true
    )
  );
  if (!hasLegacyHeadAccess && !hasPermissionAccess) {
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
    Logger.log('WARNING: SECRET_API_KEY not set \u2014 API key validation skipped');
    return true;
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
    Logger.log('WARNING: SESSION_SECRET_KEY not set — token verification skipped');
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

function doGet(e) {
  const params = e.parameter;
  const action = sanitizeEventsParam_(params.action, 50);
  
  let result;
  
  try {
    if (isRequestCancelled_(params)) {
      result = { success: false, cancelled: true, message: 'Request cancelled' };
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    // Sanitize common params
    const eventId = sanitizeEventsParam_(params.eventId, 100);
    const memberId = sanitizeEventsParam_(params.memberId, 100);
    const limit = params.limit ? sanitizeEventsParam_(params.limit, 10) : undefined;
    
    switch (action) {
      case 'getEvents':
        result = getEvents(params);
        break;
      case 'getEvent':
        result = getEventById(eventId);
        break;
      case 'getEventAttendance':
        result = getEventAttendance(eventId);
        break;
      case 'getUpcomingEvents':
        result = getUpcomingEvents(limit || 10);
        break;
      case 'getPastEvents':
        result = getPastEvents(limit || 10);
        break;
      case 'getEventStats':
        result = getEventStats();
        break;
      case 'initializeSheets': {
        var initUser = sanitizeEventsParam_(params.username, 100);
        var initAuth = requireAdminOrAuditor_(initUser, 'initialize sheets');
        if (initAuth) { result = initAuth; break; }
        result = initializeEventSheets();
        break;
      }
      // Attendance Recording Actions (from Attendance_Main.gs)
      case 'getEventAttendanceRecords':
        result = getEventAttendanceRecords(eventId);
        break;
      case 'getMemberAttendanceHistory':
        result = getMemberAttendanceHistory(memberId, limit);
        break;
      case 'checkExistingAttendance':
        result = checkExistingAttendance(eventId, memberId);
        break;
      case 'getMembersForAttendance': {
        const search = sanitizeEventsParam_(params.search, 100);
        result = getMembersForAttendance(search, limit);
        break;
      }
      case 'validateGeofence': {
        const lat = sanitizeEventsParam_(params.lat, 20);
        const lng = sanitizeEventsParam_(params.lng, 20);
        result = validateGeofence(eventId, lat, lng);
        break;
      }
      // New actions for recipient-based event filtering
      case 'getEventsForMember':
        result = getEventsForMember(memberId, params.includeArchived);
        break;
      case 'checkIsTargetRecipient':
        result = checkIsTargetRecipient(eventId, memberId);
        break;
      case 'getEventTimeWindows':
        result = getEventTimeWindows(eventId);
        break;
      case 'migrateEventsSchema': {
        var migrateUser = sanitizeEventsParam_(params.username, 100);
        var migrateAuth = requireAdminOrAuditor_(migrateUser, 'migrate events schema');
        if (migrateAuth) { result = migrateAuth; break; }
        result = migrateEventsSchema();
        break;
      }
      case 'migrateAttendanceMemberIdsToHarmonizedCodes': {
        var migrateAttendanceUser = sanitizeEventsParam_(params.username, 100);
        var migrateAttendanceAuth = requireAdminOrAuditor_(migrateAttendanceUser, 'migrate attendance member ids');
        if (migrateAttendanceAuth) { result = migrateAttendanceAuth; break; }
        result = migrateAttendanceMemberIdsToHarmonizedCodes();
        break;
      }
      default:
        result = { success: false, error: 'Invalid action' };
    }
  } catch (error) {
    result = { success: false, error: error.toString() };
  }
  
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handle POST requests
 * Uses LockService to prevent concurrent write race conditions
 */
function doPost(e) {
  let params;
  
  try {
    params = JSON.parse(e.postData.contents);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: 'Invalid JSON payload' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  // Enforce max payload size (~500KB)
  if (e.postData && e.postData.contents && e.postData.contents.length > 512000) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: 'Payload too large' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  const action = sanitizeEventsParam_(params.action, 50);
  let result;

  // ---- API key validation ----
  if (!validateApiKey_(params.key)) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: 'Invalid or missing API key', code: 401 }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ---- Session token verification (HMAC) ----
  var tokenUser = verifyHmacToken_(params.sessionToken);
  var sessionSecret = PropertiesService.getScriptProperties().getProperty('SESSION_SECRET_KEY');
  if (sessionSecret && !tokenUser) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: 'Invalid or expired session token', code: 401 }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (tokenUser) {
    params.username = tokenUser.username;
  }
  
  // Acquire script lock to prevent concurrent write race conditions
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: 'Server busy, please try again' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  try {
    if (isRequestCancelled_(params)) {
      result = { success: false, cancelled: true, message: 'Request cancelled' };
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ---- Role-based access control ----
    var username = sanitizeEventsParam_(params.username, 100);
    var adminOnlyActions = ['createEvent', 'updateEvent', 'deleteEvent', 'duplicateEvent', 'cancelEvent', 'addEventRecipient', 'addEventRecipients', 'updateAttendanceStatus', 'migrateAttendanceMemberIdsToHarmonizedCodes'];
    var headActions = ['recordAttendance', 'bulkRecordAttendance', 'recordTimeIn', 'recordTimeOut', 'recordManualAttendance'];
    if (adminOnlyActions.indexOf(action) !== -1) {
      var authError = requireAdminOrAuditor_(username, action);
      if (authError) {
        result = authError;
        return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
      }
    } else if (headActions.indexOf(action) !== -1) {
      var authError = requireHeadOrAbove_(username, action);
      if (authError) {
        result = authError;
        return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
      }
    }

    switch (action) {
      case 'createEvent':
        result = createEvent(params.eventData);
        break;
      case 'updateEvent':
        result = updateEvent(sanitizeEventsParam_(params.eventId, 100), params.eventData);
        break;
      case 'deleteEvent':
        result = deleteEvent(sanitizeEventsParam_(params.eventId, 100));
        break;
      case 'recordAttendance':
        result = recordEventAttendance(sanitizeEventsParam_(params.eventId, 100), sanitizeEventsParam_(params.memberId, 100), sanitizeEventsParam_(params.status, 50));
        break;
      case 'bulkRecordAttendance':
        result = bulkRecordEventAttendance(sanitizeEventsParam_(params.eventId, 100), params.attendanceRecords);
        break;
      case 'duplicateEvent':
        result = duplicateEvent(sanitizeEventsParam_(params.eventId, 100));
        break;
      case 'cancelEvent':
        result = cancelEvent(sanitizeEventsParam_(params.eventId, 100), sanitizeEventsParam_(params.reason, 500));
        break;
      // Attendance Recording Actions (from Attendance_Main.gs)
      case 'recordTimeIn':
        result = recordTimeIn(params);
        break;
      case 'recordTimeOut':
        result = recordTimeOut(params);
        break;
      case 'recordManualAttendance':
        result = recordManualAttendance(params);
        break;
      case 'updateAttendanceStatus':
        result = updateAttendanceStatus(sanitizeEventsParam_(params.attendanceId, 100), sanitizeEventsParam_(params.status, 50), sanitizeEventsParam_(params.notes, 500));
        break;
      case 'addEventRecipient':
        result = addEventRecipient(sanitizeEventsParam_(params.eventId, 100), sanitizeEventsParam_(params.recipientId, 100), sanitizeEventsParam_(params.recipientName, 200));
        break;
      case 'addEventRecipients':
        result = addEventRecipients(sanitizeEventsParam_(params.eventId, 100), params.recipients);
        break;
      case 'migrateAttendanceMemberIdsToHarmonizedCodes':
        result = migrateAttendanceMemberIdsToHarmonizedCodes();
        break;
      default:
        result = { success: false, error: 'Invalid action' };
    }
  } catch (error) {
    result = { success: false, error: error.toString() };
  } finally {
    lock.releaseLock();
  }
  
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// =====================================================
// SHEET INITIALIZATION
// =====================================================

/**
 * Initialize all required sheets for the Events system
 * Creates the spreadsheet and all necessary sheets with headers
 */
function initializeEventSheets() {
  try {
    let spreadsheetId = getEventsSpreadsheetId();
    let ss;
    
    // Create new spreadsheet if ID not set
    if (!spreadsheetId) {
      ss = SpreadsheetApp.create('YSP Tagum - Events Management');
      spreadsheetId = ss.getId();
      setEventsSpreadsheetId(spreadsheetId);
      Logger.log('Created new Events spreadsheet with ID: ' + spreadsheetId);
    } else {
      ss = SpreadsheetApp.openById(spreadsheetId);
    }
    
    // Create Events sheet
    createEventsSheet(ss);
    
    // Create EventAttendance sheet
    createEventAttendanceSheet(ss);
    
    // Create EventSettings sheet (optional, for configuration)
    createEventSettingsSheet(ss);
    
    // Remove default Sheet1 if it exists
    const defaultSheet = ss.getSheetByName('Sheet1');
    if (defaultSheet && ss.getSheets().length > 1) {
      ss.deleteSheet(defaultSheet);
    }
    
    return {
      success: true,
      message: 'Event sheets initialized successfully',
      spreadsheetId: spreadsheetId,
      spreadsheetUrl: ss.getUrl()
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Create the main Events sheet
 * Extended with Recipients and Time In/Out window fields
 */
function createEventsSheet(ss) {
  let sheet = ss.getSheetByName('Events');
  
  if (!sheet) {
    sheet = ss.insertSheet('Events');
  }
  
  // Set headers - Extended schema with recipients and time windows
  const headers = [
    'EventID',
    'Title',
    'Description',
    'StartDate',
    'EndDate',
    'StartTime',
    'EndTime',
    'LocationName',
    'Latitude',
    'Longitude',
    'Radius',
    'GeofenceEnabled',
    'CurrentAttendees',
    'Status',
    'CreatedBy',
    'CreatedAt',
    'UpdatedAt',
    'Notes',
    // New fields for recipient targeting
    'Recipients',           // JSON: { type: 'All' | 'Committee' | 'Person', ids: string[], names: string[] }
    // Time In window (for late detection)
    'TimeInStart',          // Time when Time In opens (e.g., "8:00 AM")
    'TimeInEnd',            // Time when Time In closes - after this = Late (e.g., "9:00 AM")
    // Time Out window
    'TimeOutStart',         // Time when Time Out opens (e.g., "5:00 PM")
    'TimeOutEnd'            // Time when Time Out closes - after this = Late Time Out (e.g., "6:00 PM")
  ];
  
  // Check if headers already exist
  const existingHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  if (existingHeaders[0] !== 'EventID') {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // Format header row
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#FF6600')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold');
    
    // Set column widths
    sheet.setColumnWidth(1, 180);  // EventID
    sheet.setColumnWidth(2, 250);  // Title
    sheet.setColumnWidth(3, 300);  // Description
    sheet.setColumnWidth(4, 120);  // StartDate
    sheet.setColumnWidth(5, 120);  // EndDate
    sheet.setColumnWidth(6, 80);   // StartTime
    sheet.setColumnWidth(7, 80);   // EndTime
    sheet.setColumnWidth(8, 200);  // LocationName
    sheet.setColumnWidth(9, 120);  // Latitude
    sheet.setColumnWidth(10, 120); // Longitude
    sheet.setColumnWidth(11, 80);  // Radius
    
    // Freeze header row
    sheet.setFrozenRows(1);
  }
  
  return sheet;
}

/**
 * Create the EventCategories sheet
 */
/**
 * Create the EventAttendance sheet
 * Extended with IsExternal and Late status fields
 * UNIFIED SCHEMA: Must match Attendance_Main.gs initializeAttendanceSheet
 */
function createEventAttendanceSheet(ss) {
  let sheet = ss.getSheetByName('EventAttendance');
  
  if (!sheet) {
    sheet = ss.insertSheet('EventAttendance');
  }
  
  // Extended headers with external attendee and late tracking
  // UNIFIED with Attendance_Main.gs schema (17 columns)
  const headers = [
    'AttendanceID',
    'EventID',
    'MemberID',
    'MemberName',
    'Status',
    'TimeIn',            // Changed from CheckInTime for consistency
    'TimeOut',           // Changed from CheckOutTime for consistency
    'AttendanceDate',    // Added: Date of attendance record
    'Location',          // Added: GPS coordinates
    'GeofenceStatus',    // Added: Whether within geofence
    'Notes',
    'RecordedByTimeIn',  // Changed from RecordedBy - who recorded Time In
    'RecordedByTimeOut', // Added: who recorded Time Out
    'RecordedAt',
    // New fields for external attendee and late tracking
    'IsExternal',        // TRUE if person is not a target recipient (external attendee)
    'LateTimeIn',        // TRUE if Time In was after TimeInEnd
    'LateTimeOut'        // TRUE if Time Out was after TimeOutEnd
  ];
  
  const existingHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  if (existingHeaders[0] !== 'AttendanceID') {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // Format header row
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#FF6600')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold');
    
    sheet.setFrozenRows(1);
  }
  
  return sheet;
}

/**
 * Create the EventSettings sheet
 */
function createEventSettingsSheet(ss) {
  let sheet = ss.getSheetByName('EventSettings');
  
  if (!sheet) {
    sheet = ss.insertSheet('EventSettings');
  }
  
  const headers = [
    'SettingKey',
    'SettingValue',
    'Description',
    'UpdatedAt'
  ];
  
  const existingHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  if (existingHeaders[0] !== 'SettingKey') {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // Format header row
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#FF6600')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold');
    
    // Add default settings
    const defaultSettings = [
      ['DEFAULT_EVENT_DURATION', '2', 'Default event duration in hours', new Date().toISOString()],
      ['ALLOW_GUEST_REGISTRATION', 'FALSE', 'Allow guests to register for events', new Date().toISOString()],
      ['SEND_REMINDERS', 'TRUE', 'Send event reminders to attendees', new Date().toISOString()],
      ['REMINDER_HOURS_BEFORE', '24', 'Hours before event to send reminder', new Date().toISOString()],
      ['MAX_EVENTS_PER_DAY', '5', 'Maximum events allowed per day', new Date().toISOString()],
      ['REQUIRE_ATTENDANCE_CONFIRMATION', 'TRUE', 'Require attendance confirmation', new Date().toISOString()]
    ];
    
    if (sheet.getLastRow() < 2) {
      sheet.getRange(2, 1, defaultSettings.length, defaultSettings[0].length).setValues(defaultSettings);
    }
    
    sheet.setFrozenRows(1);
  }
  
  return sheet;
}

// =====================================================
// EVENT STATUS CALCULATION
// =====================================================

/**
 * Calculate the dynamic status of an event based on current date/time
 * Manual overrides (Cancelled, Disabled, Completed) are respected and not changed
 * This allows admins to manually complete an event to stop attendance recording
 * @param {Object} event - Event object with StartDate, EndDate, StartTime, EndTime, Status
 * @returns {string} - Calculated status: Scheduled, Active, Completed, Cancelled, or Disabled
 */
function calculateEventStatus(event) {
  // Respect manual overrides - Cancelled, Disabled, and Completed should never be auto-calculated
  // This allows admins to manually complete an event to stop attendance recording
  const storedStatus = String(event.Status || '').trim();
  if (storedStatus === 'Cancelled' || storedStatus === 'Disabled' || storedStatus === 'Completed') {
    return storedStatus;
  }
  
  // Get current time in Philippines timezone
  const now = new Date();
  const phNow = Utilities.formatDate(now, 'Asia/Manila', 'yyyy-MM-dd HH:mm:ss');
  const currentDateTime = new Date(phNow);
  
  // Parse event start date/time
  const startDate = parseEventDate(event.StartDate);
  const endDate = parseEventDate(event.EndDate || event.StartDate);
  const startTime = parseEventTime(event.StartTime);
  const endTime = parseEventTime(event.EndTime || event.StartTime);
  
  if (!startDate) {
    // If no valid start date, keep stored status or default to Scheduled
    return storedStatus || 'Scheduled';
  }
  
  // Combine date and time for start
  const eventStart = new Date(startDate);
  if (startTime) {
    eventStart.setHours(startTime.hours, startTime.minutes, 0, 0);
  } else {
    // Default to start of day if no time specified
    eventStart.setHours(0, 0, 0, 0);
  }
  
  // Combine date and time for end
  const eventEnd = new Date(endDate);
  if (endTime) {
    eventEnd.setHours(endTime.hours, endTime.minutes, 0, 0);
  } else {
    // Default to end of day if no time specified
    eventEnd.setHours(23, 59, 59, 999);
  }
  
  // Calculate status based on current time
  if (currentDateTime < eventStart) {
    return 'Scheduled';
  } else if (currentDateTime >= eventStart && currentDateTime <= eventEnd) {
    return 'Active';
  } else {
    return 'Completed';
  }
}

/**
 * Parse date string in various formats to Date object
 * Supports: MM/DD/YYYY, YYYY-MM-DD, Date objects
 */
function parseEventDate(dateValue) {
  if (!dateValue) return null;
  
  // If already a Date object
  if (dateValue instanceof Date && !isNaN(dateValue)) {
    return dateValue;
  }
  
  const dateStr = String(dateValue).trim();
  if (!dateStr) return null;
  
  // Try MM/DD/YYYY format (PH format)
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const month = parseInt(parts[0], 10) - 1;
      const day = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      if (!isNaN(date)) return date;
    }
  }
  
  // Try YYYY-MM-DD format (ISO format)
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      if (!isNaN(date)) return date;
    }
  }
  
  // Try standard Date parsing as fallback
  const parsed = new Date(dateStr);
  if (!isNaN(parsed)) return parsed;
  
  return null;
}

/**
 * Parse time string in various formats
 * Supports: HH:MM AM/PM, HH:MM (24-hour)
 * @returns {Object|null} - { hours: number, minutes: number } in 24-hour format
 */
function parseEventTime(timeValue) {
  if (!timeValue) return null;
  
  const timeStr = String(timeValue).trim();
  if (!timeStr) return null;
  
  // Check for AM/PM format (e.g., "8:00 AM", "2:30 PM")
  const ampmMatch = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = parseInt(ampmMatch[2], 10);
    const period = ampmMatch[3].toUpperCase();
    
    // Convert to 24-hour format
    if (period === 'AM' && hours === 12) {
      hours = 0; // 12 AM = 0:00
    } else if (period === 'PM' && hours !== 12) {
      hours += 12; // PM (except 12 PM)
    }
    
    return { hours, minutes };
  }
  
  // Check for 24-hour format (e.g., "08:00", "14:30")
  const h24Match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (h24Match) {
    const hours = parseInt(h24Match[1], 10);
    const minutes = parseInt(h24Match[2], 10);
    return { hours, minutes };
  }
  
  return null;
}

/**
 * Format cell values for API response.
 * Dates use MM/dd/yyyy, times use h:mm a (PH timezone).
 */
function formatCellValue(header, value) {
  if (value instanceof Date && !isNaN(value)) {
    const timezone = 'Asia/Manila';
    const normalizedHeader = String(header || '')
      .replace(/\s+/g, '')
      .toLowerCase();
    const isTimeHeader = normalizedHeader === 'starttime' || normalizedHeader === 'endtime';
    const isTimeOnlyDate = value.getFullYear() === 1899;
    if (isTimeHeader || isTimeOnlyDate) {
      return Utilities.formatDate(value, timezone, 'h:mm a');
    }
    return Utilities.formatDate(value, timezone, 'MM/dd/yyyy');
  }
  return value;
}

// =====================================================
// EVENT CRUD OPERATIONS
// =====================================================

/**
 * Get all events with optional filtering
 * Status is calculated dynamically based on current date/time
 */
function getEvents(params) {
  try {
    const ss = SpreadsheetApp.openById(getEventsSpreadsheetId());
    const sheet = ss.getSheetByName('Events');
    
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true, events: [], total: 0 };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const events = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue; // Skip empty rows
      
      const event = {};
      headers.forEach((header, index) => {
        event[header] = formatCellValue(header, row[index]);
      });
      
      // Calculate dynamic status based on current date/time
      // Store original status for reference, calculate current status
      event.StoredStatus = event.Status;
      event.Status = calculateEventStatus(event);
      
      // Apply filters if provided
      if (params) {
        if (params.status && event.Status !== params.status) continue;
        if (params.startDate && new Date(event.StartDate) < new Date(params.startDate)) continue;
        if (params.endDate && new Date(event.StartDate) > new Date(params.endDate)) continue;
        // Support filtering for archived (completed) events
        if (params.includeArchived === false && event.Status === 'Completed') continue;
      }
      
      events.push(event);
    }
    
    // Sort by StartDate descending (newest first)
    events.sort((a, b) => new Date(b.StartDate) - new Date(a.StartDate));
    
    return { success: true, events: events, total: events.length };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Get a single event by ID
 * Status is calculated dynamically based on current date/time
 */
function getEventById(eventId) {
  try {
    const ss = SpreadsheetApp.openById(getEventsSpreadsheetId());
    const sheet = ss.getSheetByName('Events');
    
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: false, error: 'Event not found' };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === eventId) {
        const event = {};
        headers.forEach((header, index) => {
          event[header] = formatCellValue(header, data[i][index]);
        });
        
        // Calculate dynamic status based on current date/time
        event.StoredStatus = event.Status;
        event.Status = calculateEventStatus(event);
        
        return { success: true, event: event };
      }
    }
    
    return { success: false, error: 'Event not found' };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Generate a unique Event ID in format: YSPTCEV-yyyy-xxxx
 * YSPTCEV = YSP Tagum City Events
 * yyyy = current year
 * xxxx = random alphanumeric
 */
function generateEventId() {
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `YSPTCEV-${year}-${random}`;
}

/**
 * Parse a datetime string (e.g., "2026-01-18T08:00" or "2026-01-18 08:00") 
 * into separate date and time components
 * Date is formatted as MM/DD/YYYY (PH format)
 * Time is converted to Philippine format (12-hour with AM/PM)
 */
/**
 * Parse date string to MM/DD/YYYY format (PH format)
 * Handles: YYYY-MM-DD, MM/DD/YYYY
 */
function parseDate(dateStr) {
  if (!dateStr) return '';
  
  const str = String(dateStr).trim();
  
  // Already in MM/DD/YYYY format
  if (str.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
    return str;
  }
  
  // YYYY-MM-DD format (from HTML date input)
  if (str.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = str.split('-');
    return `${month}/${day}/${year}`;
  }
  
  return str;
}

/**
 * Parse time string to HH:MM AM/PM format (12-hour PH format)
 * Handles: HH:MM (24-hour from HTML time input), HH:MM AM/PM
 */
function parseTime(timeStr) {
  if (!timeStr) return '';
  
  const str = String(timeStr).trim();
  
  // Already in 12-hour format with AM/PM
  if (str.match(/\d{1,2}:\d{2}\s*(AM|PM)/i)) {
    return str;
  }
  
  // 24-hour format HH:MM (from HTML time input)
  if (str.match(/^\d{2}:\d{2}$/)) {
    const [hours, minutes] = str.split(':');
    let h = parseInt(hours, 10);
    const period = h >= 12 ? 'PM' : 'AM';
    
    if (h === 0) {
      h = 12; // Midnight
    } else if (h > 12) {
      h = h - 12;
    }
    
    return `${h}:${minutes} ${period}`;
  }
  
  return str;
}

function parseDatetime(datetimeStr) {
  if (!datetimeStr) return { date: '', time: '' };
  
  // Handle ISO format (2026-01-18T08:00) or space format (2026-01-18 08:00)
  const str = String(datetimeStr);
  
  // Check if it contains time component (T separator or space with colon)
  if (str.includes('T') || (str.includes(' ') && str.includes(':'))) {
    const parts = str.includes('T') ? str.split('T') : str.split(' ');
    let datePart = parts[0]; // 2026-01-18
    let timePart = parts[1] || ''; // 08:00 or 08:00:00
    
    // Convert date from YYYY-MM-DD to MM/DD/YYYY (PH format)
    if (datePart && datePart.includes('-')) {
      const [year, month, day] = datePart.split('-');
      datePart = `${month}/${day}/${year}`;
    }
    
    // Convert to 12-hour PH format with AM/PM
    if (timePart) {
      // Remove any existing AM/PM first (in case already formatted)
      timePart = timePart.replace(/\s*(AM|PM)\s*/gi, '').trim();
      
      const timeComponents = timePart.split(':');
      let hours = parseInt(timeComponents[0], 10);
      const minutes = timeComponents[1] ? timeComponents[1].substring(0, 2) : '00';
      
      const period = hours >= 12 ? 'PM' : 'AM';
      
      // Convert to 12-hour format
      if (hours === 0) {
        hours = 12; // Midnight
      } else if (hours > 12) {
        hours = hours - 12;
      }
      
      timePart = `${hours}:${minutes} ${period}`;
    }
    
    return { date: datePart, time: timePart };
  }
  
  // No time component, just date - still format it to PH format
  let datePart = str;
  if (datePart && datePart.includes('-') && datePart.length === 10) {
    const [year, month, day] = datePart.split('-');
    datePart = `${month}/${day}/${year}`;
  }
  
  return { date: datePart, time: '' };
}

/**
 * Create a new event
 */
function createEvent(eventData) {
  try {
    const ss = SpreadsheetApp.openById(getEventsSpreadsheetId());
    const sheet = ss.getSheetByName('Events');
    
    if (!sheet) {
      return { success: false, error: 'Events sheet not found. Please initialize sheets first.' };
    }
    
    // Generate unique EventID in format: YSPTCEV-yyyy-xxxx
    const eventId = generateEventId();
    const now = new Date().toISOString();
    
    // Handle date and time - check if separate time fields are provided
    let startDateFormatted, startTimeFormatted, endDateFormatted, endTimeFormatted;
    
    if (eventData.startTime !== undefined && eventData.startTime !== '') {
      // Separate date and time fields provided
      startDateFormatted = parseDate(eventData.startDate);
      startTimeFormatted = parseTime(eventData.startTime);
    } else {
      // Combined datetime string (legacy support)
      const startParsed = parseDatetime(eventData.startDate);
      startDateFormatted = startParsed.date;
      startTimeFormatted = startParsed.time;
    }
    
    if (eventData.endTime !== undefined && eventData.endTime !== '') {
      // Separate date and time fields provided
      endDateFormatted = parseDate(eventData.endDate || eventData.startDate);
      endTimeFormatted = parseTime(eventData.endTime);
    } else {
      // Combined datetime string (legacy support)
      const endParsed = parseDatetime(eventData.endDate || eventData.startDate);
      endDateFormatted = endParsed.date;
      endTimeFormatted = endParsed.time;
    }
    
    const newRow = [
      eventId,
      eventData.title || '',
      eventData.description || '',
      startDateFormatted,          // StartDate (date only)
      endDateFormatted,            // EndDate (date only)
      startTimeFormatted,          // StartTime (time only)
      endTimeFormatted,            // EndTime (time only)
      eventData.locationName || '',
      eventData.latitude || '',
      eventData.longitude || '',
      eventData.radius || 100,
      eventData.geofenceEnabled !== false ? 'TRUE' : 'FALSE', // GeofenceEnabled (default: TRUE)
      0, // CurrentAttendees (auto-calculated)
      eventData.status || 'Scheduled',
      eventData.createdBy || '',
      now,
      now,
      eventData.notes || '',
      // New fields for recipient targeting and time windows
      eventData.recipients || '',           // Recipients (JSON string)
      eventData.timeInStart || '',          // TimeInStart
      eventData.timeInEnd || '',            // TimeInEnd
      eventData.timeOutStart || '',         // TimeOutStart
      eventData.timeOutEnd || ''            // TimeOutEnd
    ];
    
    sheet.appendRow(newRow);
    
    return {
      success: true,
      message: 'Event created successfully',
      eventId: eventId,
      event: {
        EventID: eventId,
        Title: eventData.title,
        StartDate: startDateFormatted,
        StartTime: startTimeFormatted,
        Status: 'Scheduled'
      }
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Update an existing event
 */
function updateEvent(eventId, eventData) {
  try {
    const ss = SpreadsheetApp.openById(getEventsSpreadsheetId());
    const sheet = ss.getSheetByName('Events');
    
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: false, error: 'Event not found' };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === eventId) {
        const rowIndex = i + 1;
        const now = new Date().toISOString();
        
        // Column mapping for schema (1-indexed):
        // 1=EventID, 2=Title, 3=Description, 4=StartDate, 5=EndDate
        // 6=StartTime, 7=EndTime, 8=LocationName, 9=Latitude, 10=Longitude, 11=Radius
        // 12=GeofenceEnabled, 13=CurrentAttendees (auto), 14=Status, 15=CreatedBy
        // 16=CreatedAt, 17=UpdatedAt, 18=Notes
        
        if (eventData.title !== undefined) sheet.getRange(rowIndex, 2).setValue(eventData.title);
        if (eventData.description !== undefined) sheet.getRange(rowIndex, 3).setValue(eventData.description);
        
        // Handle startDate - check if separate time is provided
        if (eventData.startDate !== undefined) {
          if (eventData.startTime !== undefined && eventData.startTime !== '') {
            // Separate date and time fields provided
            const dateParsed = parseDate(eventData.startDate);
            const timeParsed = parseTime(eventData.startTime);
            sheet.getRange(rowIndex, 4).setValue(dateParsed);  // StartDate
            sheet.getRange(rowIndex, 6).setValue(timeParsed);  // StartTime
          } else {
            // Combined datetime string (legacy support)
            const startParsed = parseDatetime(eventData.startDate);
            sheet.getRange(rowIndex, 4).setValue(startParsed.date);  // StartDate
            sheet.getRange(rowIndex, 6).setValue(startParsed.time);  // StartTime
          }
        } else if (eventData.startTime !== undefined) {
          // Only time provided (update time only)
          const timeParsed = parseTime(eventData.startTime);
          sheet.getRange(rowIndex, 6).setValue(timeParsed);  // StartTime
        }
        
        // Handle endDate - check if separate time is provided
        if (eventData.endDate !== undefined) {
          if (eventData.endTime !== undefined && eventData.endTime !== '') {
            // Separate date and time fields provided
            const dateParsed = parseDate(eventData.endDate);
            const timeParsed = parseTime(eventData.endTime);
            sheet.getRange(rowIndex, 5).setValue(dateParsed);  // EndDate
            sheet.getRange(rowIndex, 7).setValue(timeParsed);  // EndTime
          } else {
            // Combined datetime string (legacy support)
            const endParsed = parseDatetime(eventData.endDate);
            sheet.getRange(rowIndex, 5).setValue(endParsed.date);    // EndDate
            sheet.getRange(rowIndex, 7).setValue(endParsed.time);    // EndTime
          }
        } else if (eventData.endTime !== undefined) {
          // Only time provided (update time only)
          const timeParsed = parseTime(eventData.endTime);
          sheet.getRange(rowIndex, 7).setValue(timeParsed);  // EndTime
        }
        
        if (eventData.locationName !== undefined) sheet.getRange(rowIndex, 8).setValue(eventData.locationName);
        if (eventData.latitude !== undefined) sheet.getRange(rowIndex, 9).setValue(eventData.latitude);
        if (eventData.longitude !== undefined) sheet.getRange(rowIndex, 10).setValue(eventData.longitude);
        if (eventData.radius !== undefined) sheet.getRange(rowIndex, 11).setValue(eventData.radius);
        if (eventData.geofenceEnabled !== undefined) sheet.getRange(rowIndex, 12).setValue(eventData.geofenceEnabled ? 'TRUE' : 'FALSE');
        if (eventData.status !== undefined) sheet.getRange(rowIndex, 14).setValue(eventData.status);
        if (eventData.notes !== undefined) sheet.getRange(rowIndex, 18).setValue(eventData.notes);
        
        // New fields for recipient targeting and time windows (columns 19-23)
        if (eventData.recipients !== undefined) sheet.getRange(rowIndex, 19).setValue(eventData.recipients);
        if (eventData.timeInStart !== undefined) sheet.getRange(rowIndex, 20).setValue(parseTime(eventData.timeInStart));
        if (eventData.timeInEnd !== undefined) sheet.getRange(rowIndex, 21).setValue(parseTime(eventData.timeInEnd));
        if (eventData.timeOutStart !== undefined) sheet.getRange(rowIndex, 22).setValue(parseTime(eventData.timeOutStart));
        if (eventData.timeOutEnd !== undefined) sheet.getRange(rowIndex, 23).setValue(parseTime(eventData.timeOutEnd));
        
        // Always update UpdatedAt (column 17)
        sheet.getRange(rowIndex, 17).setValue(now);
        
        return { success: true, message: 'Event updated successfully', eventId: eventId };
      }
    }
    
    return { success: false, error: 'Event not found' };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Add a single recipient to an event
 * Appends to the existing recipients list without overwriting
 * @param {string} eventId - Event ID
 * @param {string} recipientId - Member ID to add
 * @param {string} recipientName - Member name (for display/reference)
 * @returns {Object} - Success/error response
 */
function addEventRecipient(eventId, recipientId, recipientName) {
  try {
    if (!eventId) {
      return { success: false, error: 'Event ID is required' };
    }
    if (!recipientId && !recipientName) {
      return { success: false, error: 'Recipient ID or Name is required' };
    }
    
    const ss = SpreadsheetApp.openById(getEventsSpreadsheetId());
    const sheet = ss.getSheetByName('Events');
    
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: false, error: 'Event not found' };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const recipientsColIdx = headers.indexOf('Recipients');
    
    if (recipientsColIdx < 0) {
      return { success: false, error: 'Recipients column not found - please run migrateEventsSchema' };
    }
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === eventId) {
        const rowIndex = i + 1;
        const currentRecipientsJson = data[i][recipientsColIdx] || '';
        
        let recipients = { type: 'Person', ids: [], names: [] };
        
        if (currentRecipientsJson && currentRecipientsJson.trim() !== '') {
          try {
            const parsed = JSON.parse(currentRecipientsJson);
            // If type is 'All', keep it but also add to ids/names for tracking
            if (parsed.type === 'All') {
              return { success: true, message: 'Event is open to all members - no need to add individual recipients' };
            }
            recipients = {
              type: parsed.type || 'Person',
              ids: Array.isArray(parsed.ids) ? parsed.ids : [],
              names: Array.isArray(parsed.names) ? parsed.names : [],
              committees: Array.isArray(parsed.committees) ? parsed.committees : []
            };
          } catch (e) {
            // If JSON parse fails, start fresh with Person type
            recipients = { type: 'Person', ids: [], names: [] };
          }
        }
        
        // Add recipient if not already present
        let added = false;
        if (recipientId && !recipients.ids.includes(recipientId)) {
          recipients.ids.push(recipientId);
          added = true;
        }
        if (recipientName && !recipients.names.includes(recipientName)) {
          recipients.names.push(recipientName);
          added = true;
        }
        
        if (!added) {
          return { success: true, message: 'Recipient already exists in the event', alreadyExists: true };
        }
        
        // Ensure type is Person if we're adding individual recipients
        if (recipients.type !== 'Committee') {
          recipients.type = 'Person';
        }
        
        // Update the recipients column
        sheet.getRange(rowIndex, recipientsColIdx + 1).setValue(JSON.stringify(recipients));
        
        // Update timestamp
        const updatedAtColIdx = headers.indexOf('UpdatedAt');
        if (updatedAtColIdx >= 0) {
          sheet.getRange(rowIndex, updatedAtColIdx + 1).setValue(new Date().toISOString());
        }
        
        return { 
          success: true, 
          message: `Added ${recipientName || recipientId} to event recipients`,
          totalRecipients: recipients.ids.length
        };
      }
    }
    
    return { success: false, error: 'Event not found' };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Add multiple recipients to an event at once
 * @param {string} eventId - Event ID
 * @param {Array} recipients - Array of { id: string, name: string } objects
 * @returns {Object} - Success/error response with counts
 */
function addEventRecipients(eventId, recipientsList) {
  try {
    if (!eventId) {
      return { success: false, error: 'Event ID is required' };
    }
    if (!Array.isArray(recipientsList) || recipientsList.length === 0) {
      return { success: false, error: 'Recipients list is required' };
    }
    
    const ss = SpreadsheetApp.openById(getEventsSpreadsheetId());
    const sheet = ss.getSheetByName('Events');
    
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: false, error: 'Event not found' };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const recipientsColIdx = headers.indexOf('Recipients');
    
    if (recipientsColIdx < 0) {
      return { success: false, error: 'Recipients column not found - please run migrateEventsSchema' };
    }
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === eventId) {
        const rowIndex = i + 1;
        const currentRecipientsJson = data[i][recipientsColIdx] || '';
        
        let recipients = { type: 'Person', ids: [], names: [] };
        
        if (currentRecipientsJson && currentRecipientsJson.trim() !== '') {
          try {
            const parsed = JSON.parse(currentRecipientsJson);
            if (parsed.type === 'All') {
              return { success: true, message: 'Event is open to all members', addedCount: 0, skippedCount: recipientsList.length };
            }
            recipients = {
              type: parsed.type || 'Person',
              ids: Array.isArray(parsed.ids) ? parsed.ids : [],
              names: Array.isArray(parsed.names) ? parsed.names : [],
              committees: Array.isArray(parsed.committees) ? parsed.committees : []
            };
          } catch (e) {
            recipients = { type: 'Person', ids: [], names: [] };
          }
        }
        
        let addedCount = 0;
        let skippedCount = 0;
        
        for (const recipient of recipientsList) {
          let added = false;
          
          if (recipient.id && !recipients.ids.includes(recipient.id)) {
            recipients.ids.push(recipient.id);
            added = true;
          }
          if (recipient.name && !recipients.names.includes(recipient.name)) {
            recipients.names.push(recipient.name);
            added = true;
          }
          
          if (added) {
            addedCount++;
          } else {
            skippedCount++;
          }
        }
        
        // Ensure type is Person if we're adding individual recipients
        if (recipients.type !== 'Committee') {
          recipients.type = 'Person';
        }
        
        // Update the recipients column
        sheet.getRange(rowIndex, recipientsColIdx + 1).setValue(JSON.stringify(recipients));
        
        // Update timestamp
        const updatedAtColIdx = headers.indexOf('UpdatedAt');
        if (updatedAtColIdx >= 0) {
          sheet.getRange(rowIndex, updatedAtColIdx + 1).setValue(new Date().toISOString());
        }
        
        return { 
          success: true, 
          message: `Added ${addedCount} recipient(s), ${skippedCount} already existed`,
          addedCount: addedCount,
          skippedCount: skippedCount,
          totalRecipients: recipients.ids.length
        };
      }
    }
    
    return { success: false, error: 'Event not found' };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Delete an event
 */
function deleteEvent(eventId) {
  try {
    const ss = SpreadsheetApp.openById(getEventsSpreadsheetId());
    const sheet = ss.getSheetByName('Events');
    
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: false, error: 'Event not found' };
    }
    
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === eventId) {
        sheet.deleteRow(i + 1);
        
        // Also delete associated attendance records
        deleteEventAttendanceRecords(eventId);
        
        return { success: true, message: 'Event deleted successfully' };
      }
    }
    
    return { success: false, error: 'Event not found' };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Cancel an event
 * UPDATED: Uses header-based column lookups instead of hardcoded indices
 */
function cancelEvent(eventId, reason) {
  try {
    const ss = SpreadsheetApp.openById(getEventsSpreadsheetId());
    const sheet = ss.getSheetByName('Events');
    
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: false, error: 'Event not found' };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    const statusColIdx = headers.indexOf('Status');
    const updatedAtColIdx = headers.indexOf('UpdatedAt');
    const notesColIdx = headers.indexOf('Notes');
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][headers.indexOf('EventID')] === eventId) {
        const rowIndex = i + 1;
        const now = new Date().toISOString();
        
        // Set Status to Cancelled
        if (statusColIdx >= 0) {
          sheet.getRange(rowIndex, statusColIdx + 1).setValue('Cancelled');
        }
        
        // Update UpdatedAt timestamp
        if (updatedAtColIdx >= 0) {
          sheet.getRange(rowIndex, updatedAtColIdx + 1).setValue(now);
        }
        
        // Append cancellation reason to Notes if provided
        if (reason && notesColIdx >= 0) {
          const currentNotes = data[i][notesColIdx] || '';
          const updatedNotes = currentNotes 
            ? currentNotes + '\n[Cancelled: ' + reason + ']'
            : '[Cancelled: ' + reason + ']';
          sheet.getRange(rowIndex, notesColIdx + 1).setValue(updatedNotes);
        }
        
        return { success: true, message: 'Event cancelled successfully' };
      }
    }
    
    return { success: false, error: 'Event not found' };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Duplicate an event
 */
function duplicateEvent(eventId) {
  try {
    const result = getEventById(eventId);
    
    if (!result.success) {
      return result;
    }
    
    const originalEvent = result.event;
    
    // Combine date and time for proper parsing in createEvent
    // If time is in 12-hour PH format (e.g., "8:00 AM"), convert back to 24-hour for parsing
    const startDatetime = combineDateTime(originalEvent.StartDate, originalEvent.StartTime);
    const endDatetime = combineDateTime(originalEvent.EndDate, originalEvent.EndTime);
    
    // Create a copy with new ID - using simplified schema
    const newEventData = {
      title: originalEvent.Title + ' (Copy)',
      description: originalEvent.Description,
      startDate: startDatetime,
      endDate: endDatetime,
      locationName: originalEvent.LocationName,
      latitude: originalEvent.Latitude,
      longitude: originalEvent.Longitude,
      radius: originalEvent.Radius,
      status: 'Draft',
      createdBy: originalEvent.CreatedBy,
      notes: originalEvent.Notes
    };
    
    return createEvent(newEventData);
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Combine date and time strings into datetime format
 * Handles 12-hour PH time format (e.g., "8:00 AM") and converts to 24-hour for parsing
 */
function combineDateTime(dateStr, timeStr) {
  if (!dateStr) return '';
  if (!timeStr) return dateStr;
  
  // Convert 12-hour format to 24-hour if needed
  let time24 = timeStr;
  
  if (timeStr.toUpperCase().includes('AM') || timeStr.toUpperCase().includes('PM')) {
    const isPM = timeStr.toUpperCase().includes('PM');
    const timePart = timeStr.replace(/\s*(AM|PM)\s*/i, '').trim();
    const [hours, minutes] = timePart.split(':');
    let hour24 = parseInt(hours, 10);
    
    if (isPM && hour24 !== 12) {
      hour24 += 12;
    } else if (!isPM && hour24 === 12) {
      hour24 = 0;
    }
    
    time24 = `${hour24.toString().padStart(2, '0')}:${minutes}`;
  }
  
  return `${dateStr}T${time24}`;
}

// =====================================================
// EVENT ATTENDANCE OPERATIONS
// =====================================================

/**
 * Get attendance records for an event
 */
function getEventAttendance(eventId) {
  try {
    const ss = SpreadsheetApp.openById(getEventsSpreadsheetId());
    const sheet = ss.getSheetByName('EventAttendance');
    
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true, attendance: [], total: 0 };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const attendance = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[1] === eventId) {
        const record = {};
        headers.forEach((header, index) => {
          record[header] = row[index];
        });
        attendance.push(record);
      }
    }
    
    return { success: true, attendance: attendance, total: attendance.length };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Record attendance for an event
 * UPDATED: Uses header-based column lookups instead of hardcoded indices
 * UPDATED: Supports unified 17-column schema
 */
function recordEventAttendance(eventId, memberId, status) {
  try {
    const ss = SpreadsheetApp.openById(getEventsSpreadsheetId());
    const sheet = ss.getSheetByName('EventAttendance');
    
    if (!sheet) {
      return { success: false, error: 'EventAttendance sheet not found' };
    }
    
    const attendanceId = 'ATT' + Date.now() + Math.random().toString(36).substr(2, 4).toUpperCase();
    const now = new Date();
    const nowISO = now.toISOString();
    const timeString = Utilities.formatDate(now, 'Asia/Manila', 'hh:mm a');
    const dateString = Utilities.formatDate(now, 'Asia/Manila', 'yyyy-MM-dd');
    
    // Get headers for column lookups
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // Check if attendance already recorded
    for (let i = 1; i < data.length; i++) {
      if (data[i][headers.indexOf('EventID')] === eventId && 
          data[i][headers.indexOf('MemberID')] === memberId) {
        // Update existing record
        const rowIndex = i + 1;
        
        const statusColIdx = headers.indexOf('Status');
        const recordedAtColIdx = headers.indexOf('RecordedAt');
        const timeInColIdx = headers.indexOf('TimeIn');
        
        if (statusColIdx >= 0) sheet.getRange(rowIndex, statusColIdx + 1).setValue(status);
        if (recordedAtColIdx >= 0) sheet.getRange(rowIndex, recordedAtColIdx + 1).setValue(nowISO);
        
        if ((status === 'Present' || status === 'CheckedIn') && timeInColIdx >= 0) {
          sheet.getRange(rowIndex, timeInColIdx + 1).setValue(timeString);
        }
        
        updateEventAttendeeCount(eventId);
        
        return { success: true, message: 'Attendance updated successfully' };
      }
    }
    
    // Create new record with unified 17-column schema
    const newRow = [
      attendanceId,                     // AttendanceID
      eventId,                          // EventID
      memberId,                         // MemberID
      '',                               // MemberName - to be filled by frontend or lookup
      status || 'Registered',           // Status
      status === 'Present' || status === 'CheckedIn' ? timeString : '',  // TimeIn
      '',                               // TimeOut
      dateString,                       // AttendanceDate
      '',                               // Location
      'N/A',                            // GeofenceStatus
      '',                               // Notes
      '',                               // RecordedByTimeIn
      '',                               // RecordedByTimeOut
      nowISO,                           // RecordedAt
      'FALSE',                          // IsExternal
      'FALSE',                          // LateTimeIn
      'FALSE'                           // LateTimeOut
    ];
    
    sheet.appendRow(newRow);
    updateEventAttendeeCount(eventId);
    
    return {
      success: true,
      message: 'Attendance recorded successfully',
      attendanceId: attendanceId
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Bulk record attendance for an event
 */
function bulkRecordEventAttendance(eventId, attendanceRecords) {
  try {
    const results = [];
    
    for (const record of attendanceRecords) {
      const result = recordEventAttendance(eventId, record.memberId, record.status);
      results.push({
        memberId: record.memberId,
        success: result.success,
        message: result.message || result.error
      });
    }
    
    return {
      success: true,
      message: 'Bulk attendance recorded',
      results: results
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Delete attendance records for an event
 * UPDATED: Uses header-based column lookups instead of hardcoded indices
 */
function deleteEventAttendanceRecords(eventId) {
  try {
    const ss = SpreadsheetApp.openById(getEventsSpreadsheetId());
    const sheet = ss.getSheetByName('EventAttendance');
    
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const eventIdColIdx = headers.indexOf('EventID');
    
    // Delete from bottom to top to avoid index issues
    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][eventIdColIdx] === eventId) {
        sheet.deleteRow(i + 1);
      }
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Update the attendee count for an event
 * UPDATED: Uses header-based column lookups instead of hardcoded indices
 */
function updateEventAttendeeCount(eventId) {
  try {
    const ss = SpreadsheetApp.openById(getEventsSpreadsheetId());
    const eventsSheet = ss.getSheetByName('Events');
    const attendanceSheet = ss.getSheetByName('EventAttendance');
    
    if (!eventsSheet || !attendanceSheet) return;
    
    // Count attendance records for this event using header lookups
    const attendanceData = attendanceSheet.getDataRange().getValues();
    const attendanceHeaders = attendanceData[0];
    const eventIdColIdx = attendanceHeaders.indexOf('EventID');
    const statusColIdx = attendanceHeaders.indexOf('Status');
    
    let count = 0;
    
    for (let i = 1; i < attendanceData.length; i++) {
      if (attendanceData[i][eventIdColIdx] === eventId) {
        const status = attendanceData[i][statusColIdx];
        if (status === 'Present' || status === 'CheckedIn' || status === 'Registered' || status === 'Late') {
          count++;
        }
      }
    }
    
    // Update event record using header lookup
    const eventsData = eventsSheet.getDataRange().getValues();
    const eventsHeaders = eventsData[0];
    const eventsEventIdColIdx = eventsHeaders.indexOf('EventID');
    const currentAttendeesColIdx = eventsHeaders.indexOf('CurrentAttendees');
    
    for (let i = 1; i < eventsData.length; i++) {
      if (eventsData[i][eventsEventIdColIdx] === eventId) {
        eventsSheet.getRange(i + 1, currentAttendeesColIdx + 1).setValue(count);
        break;
      }
    }
  } catch (error) {
    Logger.log('Error updating attendee count: ' + error.toString());
  }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Get upcoming events
 * UPDATED: Uses header-based column lookups instead of hardcoded indices
 */
function getUpcomingEvents(limit) {
  try {
    const ss = SpreadsheetApp.openById(getEventsSpreadsheetId());
    const sheet = ss.getSheetByName('Events');
    
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true, events: [] };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startDateColIdx = headers.indexOf('StartDate');
    const statusColIdx = headers.indexOf('Status');
    
    const events = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;
      
      const eventDate = new Date(row[startDateColIdx]);
      const status = row[statusColIdx];
      
      if (eventDate >= today && status !== 'Cancelled') {
        const event = {};
        headers.forEach((header, index) => {
          event[header] = formatCellValue(header, row[index]);
        });
        events.push(event);
      }
    }
    
    // Sort by StartDate ascending
    events.sort((a, b) => new Date(a.StartDate) - new Date(b.StartDate));
    
    // Limit results
    const limitedEvents = events.slice(0, parseInt(limit) || 10);
    
    return { success: true, events: limitedEvents, total: events.length };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Get past events
 * UPDATED: Uses header-based column lookups instead of hardcoded indices
 */
function getPastEvents(limit) {
  try {
    const ss = SpreadsheetApp.openById(getEventsSpreadsheetId());
    const sheet = ss.getSheetByName('Events');
    
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true, events: [] };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startDateColIdx = headers.indexOf('StartDate');
    
    const events = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;
      
      const eventDate = new Date(row[startDateColIdx]);
      
      if (eventDate < today) {
        const event = {};
        headers.forEach((header, index) => {
          event[header] = formatCellValue(header, row[index]);
        });
        events.push(event);
      }
    }
    
    // Sort by StartDate descending
    events.sort((a, b) => new Date(b.StartDate) - new Date(a.StartDate));
    
    // Limit results
    const limitedEvents = events.slice(0, parseInt(limit) || 10);
    
    return { success: true, events: limitedEvents, total: events.length };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Get event statistics
 * UPDATED: Uses header-based column lookups instead of hardcoded indices
 */
function getEventStats() {
  try {
    const ss = SpreadsheetApp.openById(getEventsSpreadsheetId());
    const sheet = ss.getSheetByName('Events');
    
    if (!sheet || sheet.getLastRow() < 2) {
      return {
        success: true,
        stats: {
          totalEvents: 0,
          upcomingEvents: 0,
          pastEvents: 0,
          cancelledEvents: 0,
          totalAttendees: 0
        }
      };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startDateColIdx = headers.indexOf('StartDate');
    const statusColIdx = headers.indexOf('Status');
    const attendeesColIdx = headers.indexOf('CurrentAttendees');
    
    let totalEvents = 0;
    let upcomingEvents = 0;
    let pastEvents = 0;
    let cancelledEvents = 0;
    let totalAttendees = 0;
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;
      
      totalEvents++;
      
      const eventDate = new Date(row[startDateColIdx]);
      const status = row[statusColIdx];
      const attendees = parseInt(row[attendeesColIdx]) || 0;
      
      if (status === 'Cancelled') {
        cancelledEvents++;
      } else if (eventDate >= today) {
        upcomingEvents++;
      } else {
        pastEvents++;
      }
      
      totalAttendees += attendees;
    }
    
    return {
      success: true,
      stats: {
        totalEvents: totalEvents,
        upcomingEvents: upcomingEvents,
        pastEvents: pastEvents,
        cancelledEvents: cancelledEvents,
        totalAttendees: totalAttendees
      }
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Search events
 */
function searchEvents(searchTerm) {
  try {
    const ss = SpreadsheetApp.openById(getEventsSpreadsheetId());
    const sheet = ss.getSheetByName('Events');
    
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true, events: [] };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const searchLower = searchTerm.toLowerCase();
    const events = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;
      
      // Search in Title, Description, LocationName
      const searchableFields = [row[1], row[2], row[7]].join(' ').toLowerCase();
      
      if (searchableFields.includes(searchLower)) {
        const event = {};
        headers.forEach((header, index) => {
          event[header] = row[index];
        });
        events.push(event);
      }
    }
    
    return { success: true, events: events, total: events.length };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// =====================================================
// TESTING & DEBUG FUNCTIONS
// =====================================================

/**
 * Safely add a new column to an existing sheet if it doesn't exist
 * This prevents breaking existing data when adding new columns
 * @param {string} sheetName - Name of the sheet to modify
 * @param {string} columnName - Name of the new column header
 * @param {string} defaultValue - Optional default value for existing rows
 * @returns {Object} Result with success status and message
 */
function safeAddColumn(sheetName, columnName, defaultValue) {
  try {
    const ss = SpreadsheetApp.openById(getEventsSpreadsheetId());
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return { success: false, error: `Sheet "${sheetName}" not found` };
    }
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Check if column already exists
    if (headers.includes(columnName)) {
      return { success: true, message: `Column "${columnName}" already exists`, alreadyExists: true };
    }
    
    // Add new column at the end
    const newColIndex = sheet.getLastColumn() + 1;
    sheet.getRange(1, newColIndex).setValue(columnName);
    
    // Apply header styling
    sheet.getRange(1, newColIndex)
      .setBackground('#FF6600')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold');
    
    // Set default value for existing rows if provided
    if (defaultValue !== undefined && defaultValue !== null && sheet.getLastRow() > 1) {
      const numRows = sheet.getLastRow() - 1;
      const defaultValues = Array(numRows).fill([defaultValue]);
      sheet.getRange(2, newColIndex, numRows, 1).setValues(defaultValues);
    }
    
    Logger.log(`Added column "${columnName}" to sheet "${sheetName}" at position ${newColIndex}`);
    
    return { 
      success: true, 
      message: `Column "${columnName}" added successfully`,
      columnIndex: newColIndex
    };
  } catch (error) {
    Logger.log(`Error adding column: ${error.toString()}`);
    return { success: false, error: error.toString() };
  }
}

/**
 * Migrate existing sheets to add new columns for recipients and time windows
 * Safe to run multiple times - will skip columns that already exist
 * UPDATED: Now includes all columns to match unified Attendance_Main.gs schema
 */
function migrateEventsSchema() {
  const results = {
    events: [],
    attendance: []
  };
  
  // Add new columns to Events sheet
  const eventColumns = [
    { name: 'Recipients', defaultValue: '' },
    { name: 'TimeInStart', defaultValue: '' },
    { name: 'TimeInEnd', defaultValue: '' },
    { name: 'TimeOutStart', defaultValue: '' },
    { name: 'TimeOutEnd', defaultValue: '' }
  ];
  
  for (const col of eventColumns) {
    const result = safeAddColumn('Events', col.name, col.defaultValue);
    results.events.push({ column: col.name, ...result });
  }
  
  // Add/migrate columns to EventAttendance sheet for unified schema
  // This ensures compatibility with Attendance_Main.gs (17-column schema)
  const attendanceColumns = [
    // Renamed columns - need to check if old names exist
    { name: 'TimeIn', defaultValue: '' },            // Was CheckInTime
    { name: 'TimeOut', defaultValue: '' },           // Was CheckOutTime
    { name: 'AttendanceDate', defaultValue: '' },    // New column
    { name: 'Location', defaultValue: '' },          // New column
    { name: 'GeofenceStatus', defaultValue: 'N/A' }, // New column
    { name: 'RecordedByTimeIn', defaultValue: '' },  // Was RecordedBy
    { name: 'RecordedByTimeOut', defaultValue: '' }, // New column
    { name: 'IsExternal', defaultValue: 'FALSE' },
    { name: 'LateTimeIn', defaultValue: 'FALSE' },
    { name: 'LateTimeOut', defaultValue: 'FALSE' }
  ];
  
  for (const col of attendanceColumns) {
    const result = safeAddColumn('EventAttendance', col.name, col.defaultValue);
    results.attendance.push({ column: col.name, ...result });
  }
  
  return {
    success: true,
    message: 'Schema migration completed - EventAttendance now has unified 17-column schema',
    results: results
  };
}

// =====================================================
// COMPREHENSIVE SCHEMA MIGRATION FUNCTIONS
// =====================================================

/**
 * MASTER MIGRATION FUNCTION - Run this to upgrade EventAttendance sheet to unified 17-column schema
 * 
 * This function handles all migration scenarios:
 * - Old 10-column schema (original)
 * - Old 13-column schema (with external/late fields)
 * - Any partially migrated state
 * 
 * It will:
 * 1. Rename CheckInTime → TimeIn (if exists)
 * 2. Rename CheckOutTime → TimeOut (if exists)
 * 3. Rename RecordedBy → RecordedByTimeIn (if exists)
 * 4. Insert missing columns at correct positions
 * 5. Preserve all existing data
 * 
 * Safe to run multiple times - skips already migrated columns
 * 
 * @returns {Object} Migration results with detailed log
 */
function migrateEventAttendanceToUnifiedSchema() {
  const results = {
    renames: [],
    insertions: [],
    existing: [],
    errors: []
  };
  
  try {
    const ss = SpreadsheetApp.openById(getEventsSpreadsheetId());
    const sheet = ss.getSheetByName('EventAttendance');
    
    if (!sheet) {
      return { success: false, error: 'EventAttendance sheet not found' };
    }
    
    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) {
      // Empty sheet - just set up headers
      return initializeEventAttendanceWithUnifiedSchema_();
    }
    
    // Get current headers
    let headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    
    Logger.log('Current headers before migration: ' + JSON.stringify(headers));
    
    // ===== STEP 1: RENAME COLUMNS (header only, data stays in place) =====
    
    // Rename CheckInTime → TimeIn
    const checkInIdx = headers.indexOf('CheckInTime');
    if (checkInIdx >= 0 && headers.indexOf('TimeIn') < 0) {
      sheet.getRange(1, checkInIdx + 1).setValue('TimeIn');
      results.renames.push({ from: 'CheckInTime', to: 'TimeIn', column: checkInIdx + 1 });
      headers[checkInIdx] = 'TimeIn';
    }
    
    // Rename CheckOutTime → TimeOut
    const checkOutIdx = headers.indexOf('CheckOutTime');
    if (checkOutIdx >= 0 && headers.indexOf('TimeOut') < 0) {
      sheet.getRange(1, checkOutIdx + 1).setValue('TimeOut');
      results.renames.push({ from: 'CheckOutTime', to: 'TimeOut', column: checkOutIdx + 1 });
      headers[checkOutIdx] = 'TimeOut';
    }
    
    // Rename RecordedBy → RecordedByTimeIn (only if RecordedByTimeIn doesn't exist)
    const recordedByIdx = headers.indexOf('RecordedBy');
    if (recordedByIdx >= 0 && headers.indexOf('RecordedByTimeIn') < 0) {
      sheet.getRange(1, recordedByIdx + 1).setValue('RecordedByTimeIn');
      results.renames.push({ from: 'RecordedBy', to: 'RecordedByTimeIn', column: recordedByIdx + 1 });
      headers[recordedByIdx] = 'RecordedByTimeIn';
    }
    
    // ===== STEP 2: DEFINE TARGET SCHEMA =====
    // Unified 17-column schema (must match Attendance_Main.gs)
    const targetSchema = [
      'AttendanceID',      // 1
      'EventID',           // 2
      'MemberID',          // 3
      'MemberName',        // 4
      'Status',            // 5
      'TimeIn',            // 6
      'TimeOut',           // 7
      'AttendanceDate',    // 8
      'Location',          // 9
      'GeofenceStatus',    // 10
      'Notes',             // 11
      'RecordedByTimeIn',  // 12
      'RecordedByTimeOut', // 13
      'RecordedAt',        // 14
      'IsExternal',        // 15
      'LateTimeIn',        // 16
      'LateTimeOut'        // 17
    ];
    
    // ===== STEP 3: INSERT MISSING COLUMNS AT CORRECT POSITIONS =====
    // Refresh headers after renames
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    for (let i = 0; i < targetSchema.length; i++) {
      const expectedHeader = targetSchema[i];
      const currentIdx = headers.indexOf(expectedHeader);
      
      if (currentIdx < 0) {
        // Column doesn't exist - need to insert it at position i+1
        const insertResult = insertColumnAtPosition_(sheet, expectedHeader, i + 1, getDefaultValue_(expectedHeader));
        if (insertResult.success) {
          results.insertions.push({ column: expectedHeader, position: i + 1 });
        } else {
          results.errors.push({ column: expectedHeader, error: insertResult.error });
        }
        // Refresh headers after insertion
        headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      } else if (currentIdx !== i) {
        // Column exists but at wrong position - we need to move it
        // For safety, we'll just log this and not move (could cause data loss if done wrong)
        results.existing.push({ 
          column: expectedHeader, 
          currentPosition: currentIdx + 1, 
          expectedPosition: i + 1,
          note: 'Column exists at different position - manual reorder may be needed'
        });
      } else {
        results.existing.push({ column: expectedHeader, position: i + 1, status: 'OK' });
      }
    }
    
    // ===== STEP 4: FORMAT HEADER ROW =====
    const finalColCount = sheet.getLastColumn();
    sheet.getRange(1, 1, 1, finalColCount)
      .setBackground('#FF6600')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold');
    sheet.setFrozenRows(1);
    
    // Get final headers for verification
    const finalHeaders = sheet.getRange(1, 1, 1, finalColCount).getValues()[0];
    
    Logger.log('Final headers after migration: ' + JSON.stringify(finalHeaders));
    
    return {
      success: true,
      message: 'EventAttendance schema migration completed',
      beforeColumnCount: lastCol,
      afterColumnCount: finalColCount,
      finalHeaders: finalHeaders,
      results: results
    };
    
  } catch (error) {
    Logger.log('Migration error: ' + error.toString());
    return { success: false, error: error.toString(), results: results };
  }
}

/**
 * Insert a column at a specific position, shifting existing columns right
 * All data in existing rows will get an empty value (or default) in the new column
 * 
 * @param {Sheet} sheet - The sheet to modify
 * @param {string} headerName - Name for the new column header
 * @param {number} position - 1-indexed position where to insert
 * @param {string} defaultValue - Default value for existing data rows
 * @returns {Object} Result with success status
 */
function insertColumnAtPosition_(sheet, headerName, position, defaultValue) {
  try {
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    
    // Validate position
    if (position < 1) position = 1;
    if (position > lastCol + 1) position = lastCol + 1;
    
    // Insert column at position
    sheet.insertColumnBefore(position);
    
    // Set header
    sheet.getRange(1, position).setValue(headerName);
    
    // Set default values for existing data rows
    if (lastRow > 1 && defaultValue !== undefined && defaultValue !== '') {
      const numDataRows = lastRow - 1;
      const defaultValues = Array(numDataRows).fill([defaultValue]);
      sheet.getRange(2, position, numDataRows, 1).setValues(defaultValues);
    }
    
    // Apply header styling
    sheet.getRange(1, position)
      .setBackground('#FF6600')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold');
    
    Logger.log('Inserted column "' + headerName + '" at position ' + position);
    
    return { success: true, position: position };
  } catch (error) {
    Logger.log('Error inserting column "' + headerName + '": ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * Get default value for a column based on its name
 */
function getDefaultValue_(columnName) {
  const defaults = {
    'AttendanceDate': '',
    'Location': '',
    'GeofenceStatus': 'N/A',
    'RecordedByTimeOut': '',
    'IsExternal': 'FALSE',
    'LateTimeIn': 'FALSE',
    'LateTimeOut': 'FALSE'
  };
  return defaults[columnName] || '';
}

/**
 * Initialize a fresh EventAttendance sheet with the unified schema
 */
function initializeEventAttendanceWithUnifiedSchema_() {
  try {
    const ss = SpreadsheetApp.openById(getEventsSpreadsheetId());
    let sheet = ss.getSheetByName('EventAttendance');
    
    if (!sheet) {
      sheet = ss.insertSheet('EventAttendance');
    }
    
    const headers = [
      'AttendanceID',
      'EventID',
      'MemberID',
      'MemberName',
      'Status',
      'TimeIn',
      'TimeOut',
      'AttendanceDate',
      'Location',
      'GeofenceStatus',
      'Notes',
      'RecordedByTimeIn',
      'RecordedByTimeOut',
      'RecordedAt',
      'IsExternal',
      'LateTimeIn',
      'LateTimeOut'
    ];
    
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#FF6600')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold');
    sheet.setFrozenRows(1);
    
    return {
      success: true,
      message: 'EventAttendance sheet initialized with unified 17-column schema',
      headers: headers
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Verify the current EventAttendance schema matches the expected unified schema
 * Use this to check if migration is needed
 * 
 * @returns {Object} Schema validation results
 */
function verifyEventAttendanceSchema() {
  try {
    const ss = SpreadsheetApp.openById(getEventsSpreadsheetId());
    const sheet = ss.getSheetByName('EventAttendance');
    
    if (!sheet) {
      return { success: false, needsMigration: true, error: 'EventAttendance sheet not found' };
    }
    
    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) {
      return { success: true, needsMigration: true, message: 'Sheet is empty - needs initialization' };
    }
    
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    
    const expectedHeaders = [
      'AttendanceID', 'EventID', 'MemberID', 'MemberName', 'Status',
      'TimeIn', 'TimeOut', 'AttendanceDate', 'Location', 'GeofenceStatus',
      'Notes', 'RecordedByTimeIn', 'RecordedByTimeOut', 'RecordedAt',
      'IsExternal', 'LateTimeIn', 'LateTimeOut'
    ];
    
    const issues = [];
    
    // Check for missing columns
    for (const expected of expectedHeaders) {
      if (!headers.includes(expected)) {
        issues.push({ type: 'missing', column: expected });
      }
    }
    
    // Check for old column names that need renaming
    if (headers.includes('CheckInTime')) {
      issues.push({ type: 'rename_needed', from: 'CheckInTime', to: 'TimeIn' });
    }
    if (headers.includes('CheckOutTime')) {
      issues.push({ type: 'rename_needed', from: 'CheckOutTime', to: 'TimeOut' });
    }
    if (headers.includes('RecordedBy') && !headers.includes('RecordedByTimeIn')) {
      issues.push({ type: 'rename_needed', from: 'RecordedBy', to: 'RecordedByTimeIn' });
    }
    
    // Check column order
    let orderIssues = [];
    for (let i = 0; i < expectedHeaders.length; i++) {
      const headerIdx = headers.indexOf(expectedHeaders[i]);
      if (headerIdx >= 0 && headerIdx !== i) {
        orderIssues.push({ column: expectedHeaders[i], expected: i + 1, actual: headerIdx + 1 });
      }
    }
    
    const needsMigration = issues.length > 0 || orderIssues.length > 0;
    
    return {
      success: true,
      needsMigration: needsMigration,
      currentHeaders: headers,
      expectedHeaders: expectedHeaders,
      columnCount: { current: lastCol, expected: 17 },
      issues: issues,
      orderIssues: orderIssues,
      message: needsMigration 
        ? 'Schema needs migration - run migrateEventAttendanceToUnifiedSchema()' 
        : 'Schema is up to date'
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * EVENTS SHEET MIGRATION - Add new columns for recipients and time windows
 * Safe to run multiple times
 */
function migrateEventsSheetSchema() {
  const results = {
    insertions: [],
    existing: [],
    errors: []
  };
  
  try {
    const ss = SpreadsheetApp.openById(getEventsSpreadsheetId());
    const sheet = ss.getSheetByName('Events');
    
    if (!sheet) {
      return { success: false, error: 'Events sheet not found' };
    }
    
    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) {
      return { success: false, error: 'Events sheet is empty' };
    }
    
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    
    // New columns to add (will be appended at end if not exists)
    const newColumns = [
      { name: 'Recipients', defaultValue: '' },
      { name: 'TimeInStart', defaultValue: '' },
      { name: 'TimeInEnd', defaultValue: '' },
      { name: 'TimeOutStart', defaultValue: '' },
      { name: 'TimeOutEnd', defaultValue: '' }
    ];
    
    for (const col of newColumns) {
      if (headers.includes(col.name)) {
        results.existing.push({ column: col.name, status: 'already exists' });
      } else {
        // Append at end
        const newColIdx = sheet.getLastColumn() + 1;
        sheet.getRange(1, newColIdx).setValue(col.name);
        sheet.getRange(1, newColIdx)
          .setBackground('#FF6600')
          .setFontColor('#FFFFFF')
          .setFontWeight('bold');
        
        // Set default for existing rows
        const lastRow = sheet.getLastRow();
        if (lastRow > 1 && col.defaultValue !== '') {
          const numRows = lastRow - 1;
          const defaults = Array(numRows).fill([col.defaultValue]);
          sheet.getRange(2, newColIdx, numRows, 1).setValues(defaults);
        }
        
        results.insertions.push({ column: col.name, position: newColIdx });
      }
    }
    
    return {
      success: true,
      message: 'Events schema migration completed',
      results: results
    };
  } catch (error) {
    return { success: false, error: error.toString(), results: results };
  }
}

/**
 * FULL MIGRATION - Run both Events and EventAttendance migrations
 * This is the main function to run for complete schema upgrade
 */
function runFullSchemaMigration() {
  Logger.log('========== STARTING FULL SCHEMA MIGRATION ==========');
  
  const results = {
    events: null,
    attendance: null,
    timestamp: new Date().toISOString()
  };
  
  // Migrate Events sheet
  Logger.log('--- Migrating Events sheet ---');
  results.events = migrateEventsSheetSchema();
  Logger.log('Events migration result: ' + JSON.stringify(results.events));
  
  // Migrate EventAttendance sheet
  Logger.log('--- Migrating EventAttendance sheet ---');
  results.attendance = migrateEventAttendanceToUnifiedSchema();
  Logger.log('EventAttendance migration result: ' + JSON.stringify(results.attendance));
  
  Logger.log('========== FULL SCHEMA MIGRATION COMPLETE ==========');
  
  return {
    success: results.events.success && results.attendance.success,
    message: 'Full schema migration completed',
    results: results
  };
}

/**
 * Get column index by header name (1-indexed for sheet operations)
 * @param {Sheet} sheet - The sheet to search
 * @param {string} columnName - The header name to find
 * @returns {number} Column index (1-indexed) or -1 if not found
 */
function getColumnIndex(sheet, columnName) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const index = headers.indexOf(columnName);
  return index >= 0 ? index + 1 : -1; // Convert to 1-indexed
}

/**
 * Check if a member is a target recipient for an event
 * @param {string} eventId - The event ID
 * @param {string} memberId - The member ID to check
 * @returns {Object} { isRecipient: boolean, recipientType: string }
 */
function checkIsTargetRecipient(eventId, memberId) {
  try {
    const ss = SpreadsheetApp.openById(getEventsSpreadsheetId());
    const eventsSheet = ss.getSheetByName('Events');
    
    if (!eventsSheet || eventsSheet.getLastRow() < 2) {
      return { isRecipient: true, recipientType: 'Unknown' }; // Allow if no event data
    }
    
    const data = eventsSheet.getDataRange().getValues();
    const headers = data[0];
    const recipientsColIdx = headers.indexOf('Recipients');
    
    // If Recipients column doesn't exist, everyone is a recipient (backward compatibility)
    if (recipientsColIdx < 0) {
      return { isRecipient: true, recipientType: 'All' };
    }
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === eventId) {
        const recipientsJson = data[i][recipientsColIdx];
        
        // If no recipients defined, everyone is a recipient
        if (!recipientsJson || recipientsJson === '') {
          return { isRecipient: true, recipientType: 'All' };
        }
        
        try {
          const recipients = JSON.parse(recipientsJson);
          
          // If type is 'All', everyone is a recipient
          if (recipients.type === 'All') {
            return { isRecipient: true, recipientType: 'All' };
          }
          
          // Check if member ID is in the recipients list
          if (recipients.ids && recipients.ids.includes(memberId)) {
            return { isRecipient: true, recipientType: recipients.type };
          }
          
          // If type is Committee, need to check member's committee
          if (recipients.type === 'Committee' && recipients.committees) {
            const memberCommittee = getMemberCommittee(memberId);
            if (memberCommittee && recipients.committees.includes(memberCommittee)) {
              return { isRecipient: true, recipientType: 'Committee' };
            }
          }
          
          return { isRecipient: false, recipientType: recipients.type };
        } catch (parseError) {
          Logger.log('Error parsing recipients JSON: ' + parseError.toString());
          return { isRecipient: true, recipientType: 'All' }; // Allow on error
        }
      }
    }
    
    return { isRecipient: true, recipientType: 'Unknown' }; // Event not found, allow
  } catch (error) {
    Logger.log('checkIsTargetRecipient error: ' + error.toString());
    return { isRecipient: true, recipientType: 'Unknown' };
  }
}

/**
 * Get member's committee from User Profiles
 * @param {string} memberId - The member ID
 * @returns {string|null} Committee name or null
 */
function getMemberCommittee(memberId) {
  try {
    const ss = SpreadsheetApp.openById(getLoginSpreadsheetId());
    const sheet = ss.getSheetByName('User Profiles');
    
    if (!sheet || sheet.getLastRow() < 2) return null;
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idCodeIdx = headers.indexOf('ID Code');
    const committeeIdx = headers.indexOf('Committee');
    
    if (idCodeIdx < 0 || committeeIdx < 0) return null;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][idCodeIdx] === memberId) {
        return data[i][committeeIdx] || null;
      }
    }
    
    return null;
  } catch (error) {
    Logger.log('getMemberCommittee error: ' + error.toString());
    return null;
  }
}

/**
 * Get event time windows for late detection
 * @param {string} eventId - The event ID
 * @returns {Object} Time window configuration
 */
function getEventTimeWindows(eventId) {
  try {
    const ss = SpreadsheetApp.openById(getEventsSpreadsheetId());
    const sheet = ss.getSheetByName('Events');
    
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: false, error: 'No events found' };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === eventId) {
        const getColValue = (colName) => {
          const idx = headers.indexOf(colName);
          return idx >= 0 ? data[i][idx] : null;
        };
        
        return {
          success: true,
          timeWindows: {
            timeInStart: getColValue('TimeInStart') || getColValue('StartTime'),
            timeInEnd: getColValue('TimeInEnd'),
            timeOutStart: getColValue('TimeOutStart'),
            timeOutEnd: getColValue('TimeOutEnd') || getColValue('EndTime')
          }
        };
      }
    }
    
    return { success: false, error: 'Event not found' };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Check if a time is late based on the time window end
 * @param {string} currentTimeStr - Current time as string (e.g., "9:30 AM")
 * @param {string} windowEndStr - Window end time as string (e.g., "9:00 AM")
 * @returns {boolean} True if current time is after window end
 */
function isTimeLate(currentTimeStr, windowEndStr) {
  if (!windowEndStr) return false; // No window set, not late
  
  const parseTimeToMinutes = (timeStr) => {
    if (!timeStr) return null;
    const parsed = parseEventTime(timeStr);
    if (!parsed) return null;
    return parsed.hours * 60 + parsed.minutes;
  };
  
  const currentMinutes = parseTimeToMinutes(currentTimeStr);
  const windowEndMinutes = parseTimeToMinutes(windowEndStr);
  
  if (currentMinutes === null || windowEndMinutes === null) return false;
  
  return currentMinutes > windowEndMinutes;
}

/**
 * Get Login Spreadsheet ID (for member lookup)
 */
function getLoginSpreadsheetId() {
  return '1vaQZoPq5a_verhICIiWXudBjAmfgFSIbaBX5xt9kjMk';
}

/**
 * Get events that a specific member is a target recipient for
 * Used by Attendance Transparency page to show scheduled events
 * @param {string} memberId - The member ID to filter for
 * @param {boolean} includeArchived - Whether to include completed events
 * @returns {Object} { success, scheduled: [], active: [], completed: [] }
 */
function getEventsForMember(memberId, includeArchived) {
  try {
    const ss = SpreadsheetApp.openById(getEventsSpreadsheetId());
    const sheet = ss.getSheetByName('Events');
    
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true, scheduled: [], active: [], completed: [], total: 0 };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const recipientsColIdx = headers.indexOf('Recipients');
    
    // Get member's committee for committee-based filtering
    const memberCommittee = getMemberCommittee(memberId);
    
    const scheduled = [];
    const active = [];
    const completed = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue; // Skip empty rows
      
      // Build event object
      const event = {};
      headers.forEach((header, index) => {
        event[header] = formatCellValue(header, row[index]);
      });
      
      // Calculate dynamic status
      event.StoredStatus = event.Status;
      event.Status = calculateEventStatus(event);
      
      // Skip cancelled/disabled events
      if (event.Status === 'Cancelled' || event.Status === 'Disabled') {
        continue;
      }
      
      // Check if member is a target recipient
      let isRecipient = true;
      if (recipientsColIdx >= 0 && row[recipientsColIdx]) {
        try {
          const recipients = JSON.parse(row[recipientsColIdx]);
          
          if (recipients.type !== 'All') {
            isRecipient = false;
            
            // Check if member ID is in the recipients list
            if (recipients.ids && recipients.ids.includes(memberId)) {
              isRecipient = true;
            }
            
            // Check committee-based targeting
            if (!isRecipient && recipients.type === 'Committee' && recipients.committees) {
              if (memberCommittee && recipients.committees.includes(memberCommittee)) {
                isRecipient = true;
              }
            }
          }
        } catch (parseError) {
          // If parsing fails, include the event (backward compatibility)
          isRecipient = true;
        }
      }
      
      if (!isRecipient) continue;
      
      // Add time window info to event
      event.TimeInStart = row[headers.indexOf('TimeInStart')] || '';
      event.TimeInEnd = row[headers.indexOf('TimeInEnd')] || '';
      event.TimeOutStart = row[headers.indexOf('TimeOutStart')] || '';
      event.TimeOutEnd = row[headers.indexOf('TimeOutEnd')] || '';
      
      // Categorize by status
      if (event.Status === 'Active') {
        active.push(event);
      } else if (event.Status === 'Scheduled') {
        scheduled.push(event);
      } else if (event.Status === 'Completed' && includeArchived) {
        completed.push(event);
      }
    }
    
    // Sort: scheduled by start date ascending, active by start date, completed by date descending
    scheduled.sort((a, b) => new Date(a.StartDate) - new Date(b.StartDate));
    active.sort((a, b) => new Date(a.StartDate) - new Date(b.StartDate));
    completed.sort((a, b) => new Date(b.StartDate) - new Date(a.StartDate));
    
    return {
      success: true,
      scheduled: scheduled,
      active: active,
      completed: completed,
      total: scheduled.length + active.length + completed.length
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Test function to verify the script is working
 */
function testConnection() {
  return {
    success: true,
    message: 'Events Management API is working',
    timestamp: new Date().toISOString(),
    spreadsheetId: getEventsSpreadsheetId()
  };
}

/**
 * Clear all data (use with caution!)
 * This removes all events, attendance records, but keeps categories and settings
 */
function clearAllEventData() {
  try {
    const ss = SpreadsheetApp.openById(getEventsSpreadsheetId());
    
    // Clear Events sheet (keep headers)
    const eventsSheet = ss.getSheetByName('Events');
    if (eventsSheet && eventsSheet.getLastRow() > 1) {
      eventsSheet.deleteRows(2, eventsSheet.getLastRow() - 1);
    }
    
    // Clear EventAttendance sheet (keep headers)
    const attendanceSheet = ss.getSheetByName('EventAttendance');
    if (attendanceSheet && attendanceSheet.getLastRow() > 1) {
      attendanceSheet.deleteRows(2, attendanceSheet.getLastRow() - 1);
    }
    
    return { success: true, message: 'All event data cleared' };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Get spreadsheet info for debugging
 */
function getSpreadsheetInfo() {
  try {
    const spreadsheetId = getEventsSpreadsheetId();
    
    if (!spreadsheetId) {
      return {
        success: false,
        error: 'Spreadsheet ID not set. Run initializeEventSheets() first.'
      };
    }
    
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheets = ss.getSheets().map(sheet => ({
      name: sheet.getName(),
      rows: sheet.getLastRow(),
      columns: sheet.getLastColumn()
    }));
    
    return {
      success: true,
      spreadsheetId: spreadsheetId,
      spreadsheetName: ss.getName(),
      spreadsheetUrl: ss.getUrl(),
      sheets: sheets
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// =====================================================
// SCHEMA STATUS CHECK
// =====================================================

/**
 * CHECK ALL ATTENDANCE SHEETS CONFIGURATION STATUS
 * 
 * Run this function to verify if all sheets are properly configured.
 * Returns a clear status message indicating if everything is ready or what needs to be fixed.
 * 
 * Checks:
 * - Events sheet (has Recipients, TimeInStart, TimeInEnd, TimeOutStart, TimeOutEnd)
 * - EventAttendance sheet (has all 17 unified schema columns)
 * 
 * @returns {Object} Status with clear message
 */
function checkAttendanceSheetsStatus() {
  const UNIFIED_ATTENDANCE_SCHEMA = [
    'AttendanceID', 'EventID', 'MemberID', 'MemberName', 'Status',
    'TimeIn', 'TimeOut', 'AttendanceDate', 'Location', 'GeofenceStatus',
    'Notes', 'RecordedByTimeIn', 'RecordedByTimeOut', 'RecordedAt',
    'IsExternal', 'LateTimeIn', 'LateTimeOut'
  ];
  
  const REQUIRED_EVENTS_COLUMNS = [
    'Recipients', 'TimeInStart', 'TimeInEnd', 'TimeOutStart', 'TimeOutEnd'
  ];
  
  const status = {
    timestamp: new Date().toISOString(),
    configured: true,
    sheets: {
      events: { exists: false, schemaValid: false, issues: [] },
      eventAttendance: { exists: false, schemaValid: false, issues: [] }
    },
    summary: '',
    action: ''
  };
  
  try {
    const ss = SpreadsheetApp.openById(getEventsSpreadsheetId());
    
    // ===== CHECK Events SHEET =====
    const eventsSheet = ss.getSheetByName('Events');
    
    if (!eventsSheet) {
      status.sheets.events.exists = false;
      status.sheets.events.issues.push('Sheet does not exist');
      status.configured = false;
    } else {
      status.sheets.events.exists = true;
      
      const lastCol = eventsSheet.getLastColumn();
      if (lastCol === 0) {
        status.sheets.events.issues.push('Sheet is empty - no headers');
        status.configured = false;
      } else {
        const headers = eventsSheet.getRange(1, 1, 1, lastCol).getValues()[0];
        status.sheets.events.columnCount = lastCol;
        
        // Check for required columns
        const missingColumns = [];
        for (const required of REQUIRED_EVENTS_COLUMNS) {
          if (!headers.includes(required)) {
            missingColumns.push(required);
          }
        }
        
        if (missingColumns.length === 0) {
          status.sheets.events.schemaValid = true;
        } else {
          status.sheets.events.schemaValid = false;
          status.configured = false;
          status.sheets.events.issues.push('Missing columns: ' + missingColumns.join(', '));
        }
      }
    }
    
    // ===== CHECK EventAttendance SHEET =====
    const attendanceSheet = ss.getSheetByName('EventAttendance');
    
    if (!attendanceSheet) {
      status.sheets.eventAttendance.exists = false;
      status.sheets.eventAttendance.issues.push('Sheet does not exist');
      status.configured = false;
    } else {
      status.sheets.eventAttendance.exists = true;
      
      const lastCol = attendanceSheet.getLastColumn();
      if (lastCol === 0) {
        status.sheets.eventAttendance.issues.push('Sheet is empty - no headers');
        status.configured = false;
      } else {
        const headers = attendanceSheet.getRange(1, 1, 1, lastCol).getValues()[0];
        status.sheets.eventAttendance.columnCount = lastCol;
        
        // Check against unified schema
        const missingColumns = [];
        const renameNeeded = [];
        
        for (const expected of UNIFIED_ATTENDANCE_SCHEMA) {
          if (!headers.includes(expected)) {
            missingColumns.push(expected);
          }
        }
        
        // Check for old column names
        if (headers.includes('CheckInTime') && !headers.includes('TimeIn')) {
          renameNeeded.push('CheckInTime → TimeIn');
        }
        if (headers.includes('CheckOutTime') && !headers.includes('TimeOut')) {
          renameNeeded.push('CheckOutTime → TimeOut');
        }
        if (headers.includes('RecordedBy') && !headers.includes('RecordedByTimeIn')) {
          renameNeeded.push('RecordedBy → RecordedByTimeIn');
        }
        
        if (missingColumns.length === 0 && renameNeeded.length === 0) {
          status.sheets.eventAttendance.schemaValid = true;
        } else {
          status.sheets.eventAttendance.schemaValid = false;
          status.configured = false;
          
          if (missingColumns.length > 0) {
            status.sheets.eventAttendance.issues.push('Missing columns: ' + missingColumns.join(', '));
          }
          if (renameNeeded.length > 0) {
            status.sheets.eventAttendance.issues.push('Columns need renaming: ' + renameNeeded.join(', '));
          }
        }
      }
    }
    
    // ===== GENERATE SUMMARY MESSAGE =====
    if (status.configured) {
      status.summary = '✅ SHEETS ARE CONFIGURED - All attendance sheets have the correct schema and are ready to use.';
      status.action = 'No action needed. System is ready for attendance recording.';
      Logger.log('');
      Logger.log('========================================');
      Logger.log('✅ SHEETS ARE CONFIGURED');
      Logger.log('========================================');
      Logger.log('Events sheet: OK');
      Logger.log('EventAttendance sheet: OK');
      Logger.log('System is ready for attendance recording.');
      Logger.log('========================================');
    } else {
      const allIssues = [
        ...status.sheets.events.issues.map(i => 'Events: ' + i),
        ...status.sheets.eventAttendance.issues.map(i => 'EventAttendance: ' + i)
      ];
      status.summary = '⚠️ MIGRATION NEEDED - Some sheets require schema updates.';
      status.action = 'Run runFullSchemaMigration() to fix all issues.';
      Logger.log('');
      Logger.log('========================================');
      Logger.log('⚠️ MIGRATION NEEDED');
      Logger.log('========================================');
      Logger.log('Issues found:');
      allIssues.forEach(issue => Logger.log('  - ' + issue));
      Logger.log('');
      Logger.log('Action: Run runFullSchemaMigration()');
      Logger.log('========================================');
    }
    
    return status;
    
  } catch (error) {
    status.configured = false;
    status.summary = '❌ ERROR - Could not check sheet configuration.';
    status.action = 'Check that the spreadsheet ID is correct and you have access.';
    status.error = error.toString();
    Logger.log('');
    Logger.log('========================================');
    Logger.log('❌ ERROR');
    Logger.log('========================================');
    Logger.log('Error: ' + error.toString());
    Logger.log('========================================');
    return status;
  }
}
