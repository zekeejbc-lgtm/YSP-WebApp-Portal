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

/**
 * Handle GET requests - Fetch opportunities
 */
function doGet(e) {
  try {
    const action = e && e.parameter ? e.parameter.action : 'getOpportunities';
    
    if (action === 'health') {
      return createJsonResponse({ success: true, status: 'healthy' });
    }

    if (action === 'getOpportunities') {
      const opportunities = getOpportunities();
      return createJsonResponse({
        success: true,
        data: opportunities,
        timestamp: new Date().toISOString()
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

    // ---- API key validation ----
    if (!validateApiKey_(payload.key)) {
      return createJsonResponse({ success: false, error: 'Invalid or missing API key', code: 401 });
    }

    // ---- Session token verification (HMAC) ----
    var tokenUser = verifyHmacToken_(payload.sessionToken);
    var sessionSecret = PropertiesService.getScriptProperties().getProperty('SESSION_SECRET_KEY');
    if (sessionSecret && !tokenUser) {
      return createJsonResponse({ success: false, error: 'Invalid or expired session token', code: 401 });
    }
    if (tokenUser) {
      payload.username = tokenUser.username;
    }

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

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if (row[0]) { // If ID exists
      opportunities.push({
        id: row[0],
        title: row[1] || '',
        description: row[2] || '',
        startDate: row[3] || '',
        endDate: row[4] || '',
        status: row[5] || 'closed',
        visibility: row[6] || 'hidden',
        link: row[7] || ''
      });
    }
  }

  return opportunities;
}

/**
 * Add new opportunity
 */
function addOpportunity(data) {
  try {
    const sheet = getOpportunitiesSheet();
    const lastRow = sheet.getLastRow();
    const newRow = lastRow + 1;
    
    // Generate ID: OPP-TIMESTAMP
    const id = data.id || `OPP-${Date.now()}`;

    const values = [
      id,
      data.title || '',
      data.description || '',
      data.startDate || '',
      data.endDate || '',
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
  }
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
    if (data.startDate !== undefined) sheet.getRange(targetRow, col.START_DATE).setValue(data.startDate);
    if (data.endDate !== undefined) sheet.getRange(targetRow, col.END_DATE).setValue(data.endDate);
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

// =================== SHARED UTILITIES (Copied from Homepage_Main) ===================

function validateApiKey_(key) {
  var expected = PropertiesService.getScriptProperties().getProperty('SECRET_API_KEY') || '';
  if (!expected) return true;
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

function requireAdminOrAuditor_(username, actionDescription) {
  if (!username) {
    console.error('[Applications Auth] Missing username for action:', actionDescription);
    return { success: false, error: 'Username is required', code: 400 };
  }
  var role = getUserRole_(username);
  if (role !== 'auditor' && role !== 'admin') {
    console.error('[Applications Auth] Permission denied.', {
      username: username,
      role: role,
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
