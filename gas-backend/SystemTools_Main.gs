// =================== WEB APP ENTRY POINTS ===================

function isRequestCancelled_(params) {
  return !!(params && (params.cancelled === true || params.cancelled === 'true' || params.action === 'cancel'));
}

/**
 * Handle GET requests - for testing connectivity
 */
function doGet(e) {
  return createSuccessResponse({
    status: 'online',
    message: 'System Tools API is running',
    timestamp: new Date().toISOString()
  });
}

/**
 * Handle POST requests - main API router
 */
function doPost(e) {
  try {
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;
    if (isRequestCancelled_(requestData)) {
      return createErrorResponse('Request cancelled', 499);
    }
    
    Logger.log('doPost received action: ' + action);

    // Legacy support: action message overwrote route action in old clients
    const isLegacyLogAccess = action && action !== 'logAccess' && requestData.actionType && requestData.username;
    if (isLegacyLogAccess) {
      return handleLogAccess(
        requestData.username,
        action,
        requestData.actionType,
        requestData.status,
        requestData.ipAddress,
        requestData.device
      )
        ? createSuccessResponse({ message: 'Access logged successfully' })
        : createErrorResponse('Failed to log access', 500);
    }
    
    switch (action) {
      // System Health
      case 'getSystemHealth':
        return handleGetSystemHealth();
      
      // Cache Management
      case 'getCacheVersion':
        return handleGetCacheVersion();
      case 'bumpCacheVersion':
        return handleBumpCacheVersion(requestData.username);
      
      // Backup & Export
      case 'databaseBackup':
        return handleDatabaseBackup(requestData.username);
      case 'exportData':
        return handleExportData(requestData.username);
      
      // Maintenance Mode
      case 'getMaintenanceMode':
        return handleGetMaintenanceMode();
      case 'enableMaintenanceMode':
        return handleEnableMaintenanceMode(requestData.pageId, requestData.config, requestData.username);
      case 'disableMaintenanceMode':
        return handleDisableMaintenanceMode(requestData.pageId, requestData.username);
      case 'clearAllMaintenance':
        return handleClearAllMaintenance(requestData.username);
      
      // Access Logs
      case 'getAccessLogs':
        return handleGetAccessLogs(requestData.page || 1, requestData.limit || 50, requestData.filterType);
      case 'logAccess': {
        const logAction = requestData.logAction || requestData.actionMessage || '';
        return handleLogAccess(requestData.username, logAction, requestData.actionType, requestData.status, requestData.ipAddress, requestData.device)
          ? createSuccessResponse({ message: 'Access logged successfully' })
          : createErrorResponse('Failed to log access', 500);
      }
      case 'getAccessLogsStats':
        return handleGetAccessLogsStats();
      
      // Clear Access Logs
      case 'clearAllAccessLogs':
        return handleClearAllAccessLogs(requestData.username);
      case 'clearAccessLogsByDateRange':
        return handleClearAccessLogsByDateRange(requestData.startDate, requestData.endDate, requestData.username);
      case 'clearSpecificAccessLogs':
        return handleClearSpecificAccessLogs(requestData.logIds, requestData.username);
      
      // Manual Export Access Logs (upload PDF from frontend)
      case 'uploadAccessLogsPDF':
        return handleUploadAccessLogsPDF(requestData.pdfBase64, requestData.fileName, requestData.username, requestData.exportType);
      
      // Debug
      case 'testConnection':
        return handleTestConnection();
      
      default:
        return createErrorResponse('Unknown action: ' + action, 400);
    }
  } catch (error) {
    Logger.log('doPost error: ' + error.toString());
    return createErrorResponse('Server error: ' + error.message, 500);
  }
}

// =================== AUTHORIZATION & DEBUG ===================

/**
 * Force authorization by using all required scopes
 * RUN THIS FUNCTION MANUALLY to trigger permission prompt
 */
function forceAuthorization() {
  // This function uses all the APIs we need, forcing the auth prompt
  
  Logger.log('=== CHECKING ALL SPREADSHEETS ===');
  
  // Check ALL spreadsheets in the backup list
  for (let i = 0; i < ALL_SPREADSHEETS.length; i++) {
    const config = ALL_SPREADSHEETS[i];
    if (!config.id) {
      Logger.log('⏭ Skipping ' + config.name + ': No ID configured');
      continue;
    }
    
    try {
      const ss = SpreadsheetApp.openById(config.id);
      const sheets = ss.getSheets();
      Logger.log('✓ ' + config.name + ' OK: ' + ss.getName() + ' (' + sheets.length + ' sheets)');
    } catch (e) {
      Logger.log('✗ ' + config.name + ' FAILED: ' + e.toString());
    }
  }
  
  Logger.log('');
  Logger.log('=== CHECKING DRIVE ACCESS ===');
  
  // Check Drive folder access
  try {
    const folder = DriveApp.getFolderById(BACKUPS_FOLDER_ID);
    Logger.log('✓ Backups folder access OK: ' + folder.getName());
  } catch (e) {
    Logger.log('✗ Backups folder access FAILED: ' + e.toString());
  }
  
  // Test create/delete spreadsheet
  try {
    const testSS = SpreadsheetApp.create('_AUTH_TEST_DELETE_ME');
    const testId = testSS.getId();
    DriveApp.getFileById(testId).setTrashed(true);
    Logger.log('✓ Create/delete spreadsheet OK');
  } catch (e) {
    Logger.log('✗ Create spreadsheet FAILED: ' + e.toString());
  }
  
  Logger.log('');
  Logger.log('=== CHECKING EMAIL QUOTA ===');
  
  // Check MailApp access for email quota tracking
  try {
    const quota = MailApp.getRemainingDailyQuota();
    Logger.log('✓ Email quota access OK: ' + quota + ' emails remaining');
  } catch (e) {
    Logger.log('✗ Email quota access FAILED: ' + e.toString());
  }
  
  Logger.log('');
  Logger.log('=== AUTHORIZATION COMPLETE ===');
  Logger.log('If all checks passed, deploy as web app with access: ANYONE');
  Logger.log('If any failed, check the spreadsheet IDs and permissions.');
  
  return 'Authorization triggered. Check the Logs for details.';
}

/**
 * Force email authorization specifically
 * RUN THIS FUNCTION MANUALLY to enable email quota tracking
 */
function forceEmailAuthorization() {
  try {
    const quota = MailApp.getRemainingDailyQuota();
    Logger.log('Email quota access authorized! Remaining: ' + quota + ' emails');
    return 'Email quota tracking enabled. Remaining quota: ' + quota + ' emails/day';
  } catch (e) {
    Logger.log('Email authorization failed: ' + e.toString());
    return 'Failed to authorize email access: ' + e.toString();
  }
}

/**
 * Debug function to test all connections
 * RUN THIS MANUALLY to check everything works
 */
function debugCheckConnections() {
  const results = {
    timestamp: new Date().toISOString(),
    checks: []
  };
  
  // Check System Settings Spreadsheet
  try {
    const ss = SpreadsheetApp.openById(SYSTEM_SETTINGS_SPREADSHEET_ID);
    results.checks.push({
      name: 'System Settings Spreadsheet',
      status: 'OK',
      details: ss.getName(),
      url: ss.getUrl()
    });
  } catch (e) {
    results.checks.push({
      name: 'System Settings Spreadsheet',
      status: 'FAILED',
      error: e.toString()
    });
  }
  
  // Check Main Data Spreadsheet
  try {
    const ss = SpreadsheetApp.openById(SYSTEM_DATA_SPREADSHEET_ID);
    const sheets = ss.getSheets();
    results.checks.push({
      name: 'Main Data Spreadsheet',
      status: 'OK',
      details: ss.getName(),
      sheetsCount: sheets.length,
      sheetNames: sheets.map(s => s.getName())
    });
  } catch (e) {
    results.checks.push({
      name: 'Main Data Spreadsheet',
      status: 'FAILED',
      error: e.toString()
    });
  }
  
  // Check Backups Folder
  try {
    const folder = DriveApp.getFolderById(BACKUPS_FOLDER_ID);
    results.checks.push({
      name: 'Backups Folder',
      status: 'OK',
      details: folder.getName(),
      url: folder.getUrl()
    });
  } catch (e) {
    results.checks.push({
      name: 'Backups Folder',
      status: 'FAILED',
      error: e.toString()
    });
  }
  
  // Check User Profiles sheet exists
  try {
    const ss = SpreadsheetApp.openById(SYSTEM_DATA_SPREADSHEET_ID);
    const sheet = ss.getSheetByName('User Profiles');
    if (sheet) {
      const rows = sheet.getLastRow() - 1;
      results.checks.push({
        name: 'User Profiles Sheet',
        status: 'OK',
        userCount: rows
      });
    } else {
      results.checks.push({
        name: 'User Profiles Sheet',
        status: 'NOT FOUND',
        error: 'Sheet does not exist in spreadsheet'
      });
    }
  } catch (e) {
    results.checks.push({
      name: 'User Profiles Sheet',
      status: 'FAILED',
      error: e.toString()
    });
  }
  
  Logger.log(JSON.stringify(results, null, 2));
  return results;
}

/**
 * Handle test connection request from frontend
 */
function handleTestConnection() {
  const results = debugCheckConnections();
  return createSuccessResponse(results);
}

// =================== SYSTEM TOOLS CONFIGURATION ===================
/**
 * SystemTools_Main.gs
 * 
 * Handles:
 * - Database Backup (export all data to new spreadsheet)
 * - Export Data (create spreadsheet with all sheets)
 * - Clear Cache (bump cache version globally)
 * - Maintenance Mode (CRUD operations with separate spreadsheet)
 * - System Health monitoring
 * 
 * NOTE: These functions are routed through Loginpage_Main.gs doPost()
 */

// Main data spreadsheet (same as LOGIN_SPREADSHEET_ID)
const SYSTEM_DATA_SPREADSHEET_ID = '1vaQZoPq5a_verhICIiWXudBjAmfgFSIbaBX5xt9kjMk';

// Separate spreadsheet for System Settings (Maintenance Mode, Cache Version, etc.)
// Uses the user-provided spreadsheet ID
const SYSTEM_SETTINGS_SPREADSHEET_ID = '1ZhgrpKE3zCzohqVri0kLhi-R0HVlqjhyvMeF4su8BfI';
const SYSTEM_SETTINGS_SHEET_NAME = 'System Settings';
const MAINTENANCE_SHEET_NAME = 'Maintenance Mode';

// Backup folder in Google Drive
const BACKUPS_FOLDER_ID = '1n487dwMvqUbCP8s1ETFfRGF64ds01pXj';

// Access Logs Archive folder in Google Drive (for automatic monthly archives before deletion)
const ACCESS_LOGS_ARCHIVE_FOLDER_ID = '1v147QE9DUACrIMcnVNUk7WgevFWBVHfO';

// Access Logs Manual Export folder in Google Drive (for manual exports by users)
const ACCESS_LOGS_MANUAL_EXPORT_FOLDER_ID = '1LBMul1VdSubotA9FiwI4kvHsmUSv-n2k';

// Events Spreadsheet ID (from Attendance_Events.gs)
const EVENTS_SPREADSHEET_ID = '1Xn7w9kzNrP6dmZXYXjxaO11Lmao79wn9w1SPCiqFtcA';

// Homepage Spreadsheet ID (Homepage_Main.gs)
const HOMEPAGE_SPREADSHEET_ID = '1p7zOte14Tu8wrL5VTlU326EQ0Bf8f4uCFwKpJiHnD30';

// All spreadsheets to backup
const ALL_SPREADSHEETS = [
  { id: SYSTEM_DATA_SPREADSHEET_ID, name: 'MainData', description: 'User Profiles, Login Logs' },
  { id: SYSTEM_SETTINGS_SPREADSHEET_ID, name: 'SystemSettings', description: 'Settings, Maintenance, Backup History' },
  { id: EVENTS_SPREADSHEET_ID, name: 'Events', description: 'Events, EventAttendance' },
  { id: HOMEPAGE_SPREADSHEET_ID, name: 'Homepage', description: 'Homepage content, Projects, Contact' },
];

// =================== INITIALIZATION ===================

/**
 * Initialize System Settings sheet if it doesn't exist
 */
function initializeSystemSettingsSheet() {
  try {
    const ss = SpreadsheetApp.openById(SYSTEM_SETTINGS_SPREADSHEET_ID);
    let settingsSheet = ss.getSheetByName(SYSTEM_SETTINGS_SHEET_NAME);
    
    if (!settingsSheet) {
      settingsSheet = ss.insertSheet(SYSTEM_SETTINGS_SHEET_NAME);
      // Set up headers: SettingKey, SettingValue, LastUpdated, UpdatedBy
      settingsSheet.getRange('A1:D1').setValues([['SettingKey', 'SettingValue', 'LastUpdated', 'UpdatedBy']]);
      
      // Initialize default settings
      const defaultSettings = [
        ['cache_version', '1', new Date().toISOString(), 'system'],
        ['last_backup', '', '', ''],
        ['last_export', '', '', ''],
      ];
      settingsSheet.getRange(2, 1, defaultSettings.length, 4).setValues(defaultSettings);
      
      // Format header row
      settingsSheet.getRange('A1:D1').setFontWeight('bold');
      settingsSheet.setFrozenRows(1);
    }
    
    return settingsSheet;
  } catch (error) {
    Logger.log('Error initializing System Settings sheet: ' + error.toString());
    throw error;
  }
}

/**
 * Initialize Maintenance Mode sheet if it doesn't exist
 */
function initializeMaintenanceSheet() {
  try {
    const ss = SpreadsheetApp.openById(SYSTEM_SETTINGS_SPREADSHEET_ID);
    let maintenanceSheet = ss.getSheetByName(MAINTENANCE_SHEET_NAME);
    
    if (!maintenanceSheet) {
      maintenanceSheet = ss.insertSheet(MAINTENANCE_SHEET_NAME);
      // Headers: PageId, Enabled, Reason, Message, EstimatedTime, MaintenanceDate, DurationDays, EnabledAt, EnabledBy
      maintenanceSheet.getRange('A1:I1').setValues([[
        'PageId', 'Enabled', 'Reason', 'Message', 'EstimatedTime', 
        'MaintenanceDate', 'DurationDays', 'EnabledAt', 'EnabledBy'
      ]]);
      
      // Add default page rows
      maintenanceSheet.getRange(2, 1, 2, 9).setValues([
        ['fullPWA', 'FALSE', '', '', '', '', '', '', ''],
        ['issuance', 'FALSE', '', '', '', '', '', '', '']
      ]);
      
      // Format header row
      maintenanceSheet.getRange('A1:I1').setFontWeight('bold');
      maintenanceSheet.setFrozenRows(1);
    }
    
    return maintenanceSheet;
  } catch (error) {
    Logger.log('Error initializing Maintenance sheet: ' + error.toString());
    throw error;
  }
}

// =================== BACKUP HISTORY ===================

const BACKUP_HISTORY_SHEET_NAME = 'Backup History';

/**
 * Initialize Backup History sheet if it doesn't exist
 */
function initializeBackupHistorySheet() {
  try {
    const ss = SpreadsheetApp.openById(SYSTEM_SETTINGS_SPREADSHEET_ID);
    let historySheet = ss.getSheetByName(BACKUP_HISTORY_SHEET_NAME);
    
    if (!historySheet) {
      historySheet = ss.insertSheet(BACKUP_HISTORY_SHEET_NAME);
      // Headers: Type, Name, URL, SpreadsheetId, SheetsCount, TotalRows, TotalCells, CreatedBy, CreatedAt, FolderMoved
      historySheet.getRange('A1:J1').setValues([[
        'Type', 'Name', 'URL', 'SpreadsheetId', 'SheetsCount', 
        'TotalRows', 'TotalCells', 'CreatedBy', 'CreatedAt', 'FolderMoved'
      ]]);
      
      // Format header row
      historySheet.getRange('A1:J1').setFontWeight('bold');
      historySheet.setFrozenRows(1);
      
      // Set column widths for better readability
      historySheet.setColumnWidth(1, 80);  // Type
      historySheet.setColumnWidth(2, 200); // Name
      historySheet.setColumnWidth(3, 350); // URL
      historySheet.setColumnWidth(4, 200); // SpreadsheetId
      historySheet.setColumnWidth(5, 100); // SheetsCount
      historySheet.setColumnWidth(6, 100); // TotalRows
      historySheet.setColumnWidth(7, 100); // TotalCells
      historySheet.setColumnWidth(8, 120); // CreatedBy
      historySheet.setColumnWidth(9, 180); // CreatedAt
      historySheet.setColumnWidth(10, 100); // FolderMoved
    }
    
    return historySheet;
  } catch (error) {
    Logger.log('Error initializing Backup History sheet: ' + error.toString());
    throw error;
  }
}

/**
 * Save a backup/export record to the Backup History sheet
 */
function saveBackupRecord(record) {
  try {
    const sheet = initializeBackupHistorySheet();
    const lastRow = sheet.getLastRow();
    
    sheet.getRange(lastRow + 1, 1, 1, 10).setValues([[
      record.type || 'Backup',
      record.name || '',
      record.url || '',
      record.id || '',
      record.sheetsCount || 0,
      record.totalRows || 0,
      record.totalCells || 0,
      record.createdBy || '',
      record.createdAt || new Date().toISOString(),
      record.folderMoved ? 'Yes' : 'No'
    ]]);
    
    Logger.log('Backup record saved: ' + record.name);
    return true;
  } catch (error) {
    Logger.log('Error saving backup record: ' + error.toString());
    return false;
  }
}

// =================== SYSTEM SETTING HELPERS ===================

/**
 * Get a system setting value
 */
function getSystemSetting(key) {
  try {
    const sheet = initializeSystemSettingsSheet();
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === key) {
        return data[i][1];
      }
    }
    return null;
  } catch (error) {
    Logger.log('Error getting system setting: ' + error.toString());
    return null;
  }
}

/**
 * Set a system setting value
 */
function setSystemSetting(key, value, updatedBy) {
  try {
    const sheet = initializeSystemSettingsSheet();
    const data = sheet.getDataRange().getValues();
    
    let found = false;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === key) {
        sheet.getRange(i + 1, 2, 1, 3).setValues([[value, new Date().toISOString(), updatedBy || 'system']]);
        found = true;
        break;
      }
    }
    
    if (!found) {
      // Add new setting
      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow + 1, 1, 1, 4).setValues([[key, value, new Date().toISOString(), updatedBy || 'system']]);
    }
    
    return true;
  } catch (error) {
    Logger.log('Error setting system setting: ' + error.toString());
    return false;
  }
}

// =================== CACHE VERSION MANAGEMENT ===================

const CACHE_VERSION_PROPERTY_KEY = 'cache_version';

function getUserRole_(username) {
  if (!username) return null;

  try {
    const ss = SpreadsheetApp.openById(SYSTEM_DATA_SPREADSHEET_ID);
    const sheet = ss.getSheetByName('User Profiles');
    if (!sheet) return null;

    const data = sheet.getDataRange().getValues();
    const headers = data[0] || [];
    const usernameIndex = headers.indexOf('Username');
    const roleIndex = headers.indexOf('Role');
    if (usernameIndex === -1 || roleIndex === -1) return null;

    const usernameLower = String(username).toLowerCase().trim();
    for (let i = 1; i < data.length; i++) {
      const rowUsername = (data[i][usernameIndex] || '').toString().toLowerCase().trim();
      if (rowUsername === usernameLower) {
        return (data[i][roleIndex] || '').toString().toLowerCase().trim();
      }
    }

    return null;
  } catch (error) {
    Logger.log('Error getting user role: ' + error.toString());
    return null;
  }
}

function getScriptCacheVersion_() {
  const props = PropertiesService.getScriptProperties();
  const value = props.getProperty(CACHE_VERSION_PROPERTY_KEY);
  return value ? parseInt(value, 10) : null;
}

function setScriptCacheVersion_(version) {
  PropertiesService.getScriptProperties().setProperty(
    CACHE_VERSION_PROPERTY_KEY,
    String(version)
  );
}

/**
 * Get current cache version
 */
function getCacheVersion() {
  try {
    const propVersion = getScriptCacheVersion_();
    if (propVersion !== null && !isNaN(propVersion)) {
      return propVersion;
    }

    const sheetVersionRaw = getSystemSetting('cache_version');
    const sheetVersion = sheetVersionRaw ? parseInt(sheetVersionRaw, 10) : 1;
    setScriptCacheVersion_(sheetVersion);
    return sheetVersion;
  } catch (error) {
    Logger.log('Error getting cache version: ' + error.toString());
    return 1;
  }
}

/**
 * Bump cache version (forces all clients to refresh)
 */
function handleBumpCacheVersion(username) {
  try {
    if (!username) {
      return createErrorResponse('Username is required', 400);
    }

    // Role check removed per user request (frontend restricts access to System Tools)
    // const role = getUserRole_(username);
    // if (role !== 'auditor' && role !== 'admin') {
    //   return createErrorResponse('Only auditors or admins can bump the cache', 403);
    // }

    const currentVersion = getCacheVersion();
    const newVersion = currentVersion + 1;
    
    setScriptCacheVersion_(newVersion);
    const success = setSystemSetting('cache_version', newVersion.toString(), username);

    if (success) {
      Logger.log('Cache version bumped from ' + currentVersion + ' to ' + newVersion + ' by ' + username);
      return createSuccessResponse({
        previousVersion: currentVersion,
        newVersion: newVersion,
        message: 'Cache version bumped successfully. All clients will refresh on next load.',
        timestamp: new Date().toISOString()
      });
    } else {
      return createErrorResponse('Failed to update cache version', 500);
    }
  } catch (error) {
    Logger.log('Error bumping cache version: ' + error.toString());
    return createErrorResponse('Failed to bump cache version: ' + error.message, 500);
  }
}

/**
 * Get cache version for client to check
 */
function handleGetCacheVersion() {
  try {
    const version = getCacheVersion();
    return createSuccessResponse({
      version: version,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    Logger.log('Error getting cache version: ' + error.toString());
    return createErrorResponse('Failed to get cache version: ' + error.message, 500);
  }
}

// =================== DATABASE BACKUP ===================

/**
 * Create a backup of ALL database spreadsheets
 * Creates multiple backup spreadsheets (one per source) in the backup folder
 */
function handleDatabaseBackup(username) {
  try {
    Logger.log('Starting FULL database backup by: ' + username);
    
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd_HHmmss");
    const backupFolder = DriveApp.getFolderById(BACKUPS_FOLDER_ID);
    
    let allBackupResults = [];
    let grandTotalRows = 0;
    let grandTotalCells = 0;
    let successCount = 0;
    let failCount = 0;
    
    // Backup each spreadsheet
    for (let s = 0; s < ALL_SPREADSHEETS.length; s++) {
      const spreadsheetConfig = ALL_SPREADSHEETS[s];
      
      // Skip if no ID provided
      if (!spreadsheetConfig.id) {
        Logger.log('Skipping ' + spreadsheetConfig.name + ': No ID configured');
        continue;
      }
      
      try {
        const sourceSpreadsheet = SpreadsheetApp.openById(spreadsheetConfig.id);
        const backupName = 'YSP_Backup_' + spreadsheetConfig.name + '_' + timestamp;
        
        // Create new spreadsheet for backup
        const backupSpreadsheet = SpreadsheetApp.create(backupName);
        const backupId = backupSpreadsheet.getId();
        
        // Get all sheets from source
        const sheets = sourceSpreadsheet.getSheets();
        let copiedSheets = [];
        let totalRows = 0;
        let totalCells = 0;
        
        for (let i = 0; i < sheets.length; i++) {
          const sheet = sheets[i];
          const sheetName = sheet.getName();
          const rows = sheet.getLastRow();
          const cols = sheet.getLastColumn();
          
          // Copy sheet to backup spreadsheet
          const copiedSheet = sheet.copyTo(backupSpreadsheet);
          copiedSheet.setName(sheetName);
          
          totalRows += rows;
          totalCells += rows * cols;
          
          copiedSheets.push({
            name: sheetName,
            rows: rows,
            columns: cols
          });
        }
        
        // Remove the default Sheet1 that was created
        const defaultSheet = backupSpreadsheet.getSheetByName('Sheet1');
        if (defaultSheet && backupSpreadsheet.getSheets().length > 1) {
          backupSpreadsheet.deleteSheet(defaultSheet);
        }
        
        // Move to backups folder
        let folderMoved = false;
        try {
          const file = DriveApp.getFileById(backupId);
          backupFolder.addFile(file);
          DriveApp.getRootFolder().removeFile(file);
          folderMoved = true;
        } catch (folderError) {
          Logger.log('Could not move ' + backupName + ' to backup folder: ' + folderError.toString());
        }
        
        const backupUrl = backupSpreadsheet.getUrl();
        
        grandTotalRows += totalRows;
        grandTotalCells += totalCells;
        successCount++;
        
        allBackupResults.push({
          spreadsheet: spreadsheetConfig.name,
          description: spreadsheetConfig.description,
          backupId: backupId,
          backupUrl: backupUrl,
          backupName: backupName,
          sheets: copiedSheets,
          sheetsCount: copiedSheets.length,
          totalRows: totalRows,
          totalCells: totalCells,
          folderMoved: folderMoved,
          status: 'success'
        });
        
        Logger.log('Backup created for ' + spreadsheetConfig.name + ': ' + backupUrl);
        
      } catch (spreadsheetError) {
        Logger.log('Failed to backup ' + spreadsheetConfig.name + ': ' + spreadsheetError.toString());
        failCount++;
        allBackupResults.push({
          spreadsheet: spreadsheetConfig.name,
          description: spreadsheetConfig.description,
          status: 'error',
          error: spreadsheetError.message
        });
      }
    }
    
    const now = new Date();
    
    // Save backup record to history (summary of all backups)
    saveBackupRecord({
      type: 'Full Backup',
      name: 'YSP_FullBackup_' + timestamp,
      url: backupFolder.getUrl(),
      id: BACKUPS_FOLDER_ID,
      sheetsCount: successCount + ' spreadsheets',
      totalRows: grandTotalRows,
      totalCells: grandTotalCells,
      createdBy: username,
      createdAt: now.toISOString(),
      folderMoved: true
    });
    
    // Update last backup timestamp
    setSystemSetting('last_backup', now.toISOString(), username);
    setSystemSetting('last_backup_url', backupFolder.getUrl(), username);
    setSystemSetting('last_backup_name', 'YSP_FullBackup_' + timestamp, username);
    
    Logger.log('Full backup completed: ' + successCount + ' succeeded, ' + failCount + ' failed');
    
    return createSuccessResponse({
      backups: allBackupResults,
      totalSpreadsheets: successCount,
      failedSpreadsheets: failCount,
      grandTotalRows: grandTotalRows,
      grandTotalCells: grandTotalCells,
      folderUrl: backupFolder.getUrl(),
      timestamp: now.toISOString(),
      message: 'Full database backup completed: ' + successCount + ' spreadsheets backed up'
    });
  } catch (error) {
    Logger.log('Database backup error: ' + error.toString());
    return createErrorResponse('Failed to create backup: ' + error.message, 500);
  }
}

// =================== EXPORT DATA ===================

/**
 * Export ALL data spreadsheets to new spreadsheets
 * Creates multiple export spreadsheets (one per source) in the backup folder
 */
function handleExportData(username) {
  try {
    Logger.log('Starting FULL data export by: ' + username);
    
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd_HHmmss");
    const backupFolder = DriveApp.getFolderById(BACKUPS_FOLDER_ID);
    
    let allExportResults = [];
    let grandTotalRows = 0;
    let grandTotalCells = 0;
    let successCount = 0;
    let failCount = 0;
    
    // Export each spreadsheet
    for (let s = 0; s < ALL_SPREADSHEETS.length; s++) {
      const spreadsheetConfig = ALL_SPREADSHEETS[s];
      
      // Skip if no ID provided
      if (!spreadsheetConfig.id) {
        Logger.log('Skipping ' + spreadsheetConfig.name + ': No ID configured');
        continue;
      }
      
      try {
        const sourceSpreadsheet = SpreadsheetApp.openById(spreadsheetConfig.id);
        const exportName = 'YSP_Export_' + spreadsheetConfig.name + '_' + timestamp;
        
        // Create new spreadsheet for export
        const exportSpreadsheet = SpreadsheetApp.create(exportName);
        const exportId = exportSpreadsheet.getId();
        
        // Get all sheets from source
        const sheets = sourceSpreadsheet.getSheets();
        let exportedSheets = [];
        let totalRows = 0;
        let totalCells = 0;
        
        for (let i = 0; i < sheets.length; i++) {
          const sheet = sheets[i];
          const sheetName = sheet.getName();
          const rows = sheet.getLastRow();
          const cols = sheet.getLastColumn();
          
          // Copy sheet to export spreadsheet
          const copiedSheet = sheet.copyTo(exportSpreadsheet);
          copiedSheet.setName(sheetName);
          
          totalRows += rows;
          totalCells += rows * cols;
          
          exportedSheets.push({
            name: sheetName,
            rows: rows,
            columns: cols,
            cells: rows * cols
          });
        }
        
        // Remove the default Sheet1 that was created
        const defaultSheet = exportSpreadsheet.getSheetByName('Sheet1');
        if (defaultSheet && exportSpreadsheet.getSheets().length > 1) {
          exportSpreadsheet.deleteSheet(defaultSheet);
        }
        
        // Move to backups folder
        let folderMoved = false;
        try {
          const file = DriveApp.getFileById(exportId);
          backupFolder.addFile(file);
          DriveApp.getRootFolder().removeFile(file);
          folderMoved = true;
        } catch (folderError) {
          Logger.log('Could not move ' + exportName + ' to backup folder: ' + folderError.toString());
        }
        
        const exportUrl = exportSpreadsheet.getUrl();
        
        grandTotalRows += totalRows;
        grandTotalCells += totalCells;
        successCount++;
        
        allExportResults.push({
          spreadsheet: spreadsheetConfig.name,
          description: spreadsheetConfig.description,
          exportId: exportId,
          exportUrl: exportUrl,
          exportName: exportName,
          sheets: exportedSheets,
          sheetsCount: exportedSheets.length,
          totalRows: totalRows,
          totalCells: totalCells,
          folderMoved: folderMoved,
          status: 'success'
        });
        
        Logger.log('Export created for ' + spreadsheetConfig.name + ': ' + exportUrl);
        
      } catch (spreadsheetError) {
        Logger.log('Failed to export ' + spreadsheetConfig.name + ': ' + spreadsheetError.toString());
        failCount++;
        allExportResults.push({
          spreadsheet: spreadsheetConfig.name,
          description: spreadsheetConfig.description,
          status: 'error',
          error: spreadsheetError.message
        });
      }
    }
    
    const now = new Date();
    
    // Save export record to history (summary of all exports)
    saveBackupRecord({
      type: 'Full Export',
      name: 'YSP_FullExport_' + timestamp,
      url: backupFolder.getUrl(),
      id: BACKUPS_FOLDER_ID,
      sheetsCount: successCount + ' spreadsheets',
      totalRows: grandTotalRows,
      totalCells: grandTotalCells,
      createdBy: username,
      createdAt: now.toISOString(),
      folderMoved: true
    });
    
    // Update last export timestamp
    setSystemSetting('last_export', now.toISOString(), username);
    setSystemSetting('last_export_url', backupFolder.getUrl(), username);
    setSystemSetting('last_export_name', 'YSP_FullExport_' + timestamp, username);
    
    Logger.log('Full export completed: ' + successCount + ' succeeded, ' + failCount + ' failed');
    
    return createSuccessResponse({
      exports: allExportResults,
      totalSpreadsheets: successCount,
      failedSpreadsheets: failCount,
      grandTotalRows: grandTotalRows,
      grandTotalCells: grandTotalCells,
      folderUrl: backupFolder.getUrl(),
      timestamp: now.toISOString(),
      message: 'Full data export completed: ' + successCount + ' spreadsheets exported'
    });
  } catch (error) {
    Logger.log('Data export error: ' + error.toString());
    return createErrorResponse('Failed to export data: ' + error.message, 500);
  }
}

// =================== SYSTEM HEALTH ===================

/**
 * Get the daily email quota refresh time (midnight Pacific Time converted to local/ISO)
 */
function getEmailQuotaRefreshTime() {
  // Google Apps Script resets email quota at midnight Pacific Time
  const now = new Date();
  const pacificOffset = -8; // PST (adjust to -7 for PDT if needed)
  
  // Calculate midnight Pacific Time for tomorrow
  const utcNow = now.getTime() + (now.getTimezoneOffset() * 60000);
  const pacificNow = new Date(utcNow + (3600000 * pacificOffset));
  
  // Set to midnight tomorrow Pacific Time
  const midnightPacific = new Date(pacificNow);
  midnightPacific.setDate(midnightPacific.getDate() + 1);
  midnightPacific.setHours(0, 0, 0, 0);
  
  // Convert back to UTC
  const refreshTimeUTC = new Date(midnightPacific.getTime() - (3600000 * pacificOffset) - (now.getTimezoneOffset() * 60000));
  
  return refreshTimeUTC.toISOString();
}

/**
 * Get email quota status
 * Uses MailApp.getRemainingDailyQuota() for real-time detection
 */
function getEmailQuotaStatus() {
  try {
    // Get remaining quota - this is a real-time API call
    // Note: This requires the script to have mail permissions authorized
    let remaining;
    try {
      remaining = MailApp.getRemainingDailyQuota();
    } catch (mailError) {
      // MailApp not authorized or not available
      Logger.log('MailApp not available: ' + mailError.toString());
      return {
        remaining: null,
        dailyLimit: null,
        percentageUsed: null,
        status: 'unavailable',
        refreshTime: getEmailQuotaRefreshTime(),
        lastChecked: new Date().toISOString(),
        message: 'Email quota tracking requires mail permissions. Run forceEmailAuthorization() to enable.'
      };
    }
    
    // Daily limit varies by account type:
    // - Free Gmail: 100 emails/day
    // - Google Workspace: 1,500 emails/day (varies by plan)
    // We'll detect based on remaining quota on first check
    const cachedLimit = getSystemSetting('email_daily_limit');
    let dailyLimit = cachedLimit ? parseInt(cachedLimit) : 100;
    
    // If remaining is higher than our cached limit, update it
    if (remaining > dailyLimit) {
      dailyLimit = remaining > 100 ? 1500 : 100; // Assume Workspace if > 100
      setSystemSetting('email_daily_limit', dailyLimit.toString(), 'system');
    }
    
    // Calculate percentage used
    const used = dailyLimit - remaining;
    const percentageUsed = Math.round((used / dailyLimit) * 100 * 100) / 100;
    
    // Determine status
    let status = 'healthy';
    if (percentageUsed >= 90) {
      status = 'critical';
    } else if (percentageUsed >= 70) {
      status = 'warning';
    }
    
    return {
      remaining: remaining,
      dailyLimit: dailyLimit,
      percentageUsed: percentageUsed,
      status: status,
      refreshTime: getEmailQuotaRefreshTime(),
      lastChecked: new Date().toISOString()
    };
  } catch (error) {
    Logger.log('Email quota check error: ' + error.toString());
    return {
      remaining: null,
      dailyLimit: null,
      percentageUsed: null,
      status: 'error',
      refreshTime: getEmailQuotaRefreshTime(),
      lastChecked: new Date().toISOString(),
      error: error.toString()
    };
  }
}

/**
 * Get system health status
 */
function handleGetSystemHealth() {
  try {
    // Check database connection and count users
    let databaseStatus = 'healthy';
    let databaseRows = 0;
    try {
      const ss = SpreadsheetApp.openById(SYSTEM_DATA_SPREADSHEET_ID);
      const sheet = ss.getSheetByName('User Profiles');
      if (sheet) {
        databaseRows = sheet.getLastRow() - 1; // Exclude header
      }
    } catch (dbError) {
      databaseStatus = 'error';
      Logger.log('Database check error: ' + dbError.toString());
    }
    
    // Check email quota
    let emailQuota = getEmailQuotaStatus();
    
    // Get storage info across ALL spreadsheets
    let totalCells = 0;
    let spreadsheetDetails = [];
    
    for (let s = 0; s < ALL_SPREADSHEETS.length; s++) {
      const config = ALL_SPREADSHEETS[s];
      if (!config.id) continue;
      
      try {
        const ss = SpreadsheetApp.openById(config.id);
        const sheets = ss.getSheets();
        let spreadsheetCells = 0;
        
        for (let i = 0; i < sheets.length; i++) {
          spreadsheetCells += sheets[i].getLastRow() * sheets[i].getLastColumn();
        }
        
        totalCells += spreadsheetCells;
        spreadsheetDetails.push({
          name: config.name,
          cells: spreadsheetCells,
          sheetsCount: sheets.length
        });
      } catch (e) {
        Logger.log('Could not check spreadsheet ' + config.name + ': ' + e.toString());
      }
    }
    
    // Google Sheets limit is 10 million cells per spreadsheet
    // For multiple spreadsheets, we'll show total usage
    const maxCells = 10000000 * ALL_SPREADSHEETS.length; // 10M per spreadsheet
    const storagePercentage = Math.round((totalCells / maxCells) * 100 * 100) / 100;
    
    // Get last backup info with URL
    const lastBackup = getSystemSetting('last_backup') || 'Never';
    const lastBackupUrl = getSystemSetting('last_backup_url') || '';
    const lastBackupName = getSystemSetting('last_backup_name') || '';
    
    // Get last export info with URL
    const lastExport = getSystemSetting('last_export') || 'Never';
    const lastExportUrl = getSystemSetting('last_export_url') || '';
    const lastExportName = getSystemSetting('last_export_name') || '';
    
    const cacheVersion = getCacheVersion();
    
    return createSuccessResponse({
      database: databaseStatus,
      databaseRows: databaseRows,
      storage: storagePercentage,
      totalCells: totalCells,
      maxCells: maxCells,
      spreadsheets: spreadsheetDetails,
      spreadsheetsCount: ALL_SPREADSHEETS.length,
      api: 'online',
      lastBackup: lastBackup,
      lastBackupUrl: lastBackupUrl,
      lastBackupName: lastBackupName,
      lastExport: lastExport,
      lastExportUrl: lastExportUrl,
      lastExportName: lastExportName,
      cacheVersion: cacheVersion,
      timestamp: new Date().toISOString(),
      emailQuota: emailQuota
    });
  } catch (error) {
    Logger.log('System health check error: ' + error.toString());
    return createErrorResponse('Failed to get system health: ' + error.message, 500);
  }
}

// =================== MAINTENANCE MODE ===================

/**
 * Get all maintenance mode statuses
 */
function handleGetMaintenanceMode() {
  try {
    const sheet = initializeMaintenanceSheet();
    const data = sheet.getDataRange().getValues();
    
    let fullPWA = { enabled: false };
    let pages = {};
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const pageId = row[0];
      const enabled = row[1] === true || row[1] === 'TRUE' || row[1] === 'true';
      
      const config = {
        enabled: enabled,
        reason: row[2] || '',
        message: row[3] || '',
        estimatedTime: row[4] || '',
        maintenanceDate: row[5] || '',
        durationDays: row[6] || 0,
        enabledAt: row[7] || '',
        enabledBy: row[8] || ''
      };
      
      if (pageId === 'fullPWA') {
        fullPWA = config;
      } else if (pageId) {
        pages[pageId] = config;
      }
    }
    
    return createSuccessResponse({
      fullPWA: fullPWA,
      pages: pages,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    Logger.log('Error getting maintenance mode: ' + error.toString());
    return createErrorResponse('Failed to get maintenance mode: ' + error.message, 500);
  }
}

/**
 * Enable maintenance mode for a page or full PWA
 */
function handleEnableMaintenanceMode(pageId, config, username) {
  try {
    const sheet = initializeMaintenanceSheet();
    const data = sheet.getDataRange().getValues();
    
    let found = false;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === pageId) {
        // Update existing row
        sheet.getRange(i + 1, 2, 1, 8).setValues([[
          'TRUE',
          config.reason || '',
          config.message || '',
          config.estimatedTime || '',
          config.maintenanceDate || '',
          config.durationDays || 0,
          new Date().toISOString(),
          username || ''
        ]]);
        found = true;
        break;
      }
    }
    
    if (!found) {
      // Add new row
      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow + 1, 1, 1, 9).setValues([[
        pageId,
        'TRUE',
        config.reason || '',
        config.message || '',
        config.estimatedTime || '',
        config.maintenanceDate || '',
        config.durationDays || 0,
        new Date().toISOString(),
        username || ''
      ]]);
    }
    
    Logger.log('Maintenance mode enabled for: ' + pageId + ' by ' + username);
    
    return createSuccessResponse({
      pageId: pageId,
      enabled: true,
      message: 'Maintenance mode enabled successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    Logger.log('Error enabling maintenance mode: ' + error.toString());
    return createErrorResponse('Failed to enable maintenance mode: ' + error.message, 500);
  }
}

/**
 * Disable maintenance mode for a page or full PWA
 */
function handleDisableMaintenanceMode(pageId, username) {
  try {
    const sheet = initializeMaintenanceSheet();
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === pageId) {
        // Update row to disabled
        sheet.getRange(i + 1, 2, 1, 8).setValues([[
          'FALSE',
          '',
          '',
          '',
          '',
          0,
          new Date().toISOString(),
          username || ''
        ]]);
        break;
      }
    }
    
    Logger.log('Maintenance mode disabled for: ' + pageId + ' by ' + username);
    
    return createSuccessResponse({
      pageId: pageId,
      enabled: false,
      message: 'Maintenance mode disabled successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    Logger.log('Error disabling maintenance mode: ' + error.toString());
    return createErrorResponse('Failed to disable maintenance mode: ' + error.message, 500);
  }
}

/**
 * Clear all maintenance modes
 */
function handleClearAllMaintenance(username) {
  try {
    const sheet = initializeMaintenanceSheet();
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      // Clear all rows (set enabled to FALSE and clear other fields)
      sheet.getRange(i + 1, 2, 1, 8).setValues([[
        'FALSE', '', '', '', '', 0, new Date().toISOString(), username || ''
      ]]);
    }
    
    Logger.log('All maintenance modes cleared by: ' + username);
    
    return createSuccessResponse({
      message: 'All maintenance modes cleared successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    Logger.log('Error clearing all maintenance: ' + error.toString());
    return createErrorResponse('Failed to clear all maintenance: ' + error.message, 500);
  }
}

// =================== HELPER FUNCTIONS ===================

/**
 * Create success response
 */
function createSuccessResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify({
      success: true,
      data: data
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Create error response
 */
function createErrorResponse(message, code) {
  return ContentService
    .createTextOutput(JSON.stringify({
      success: false,
      error: message,
      code: code
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

// =================== ACCESS LOGS MANAGEMENT ===================

const ACCESS_LOGS_SHEET_NAME = 'Access Logs';

/**
 * Initialize Access Logs sheet if it doesn't exist
 */
function initializeAccessLogsSheet() {
  try {
    const ss = SpreadsheetApp.openById(SYSTEM_SETTINGS_SPREADSHEET_ID);
    let logsSheet = ss.getSheetByName(ACCESS_LOGS_SHEET_NAME);
    
    if (!logsSheet) {
      logsSheet = ss.insertSheet(ACCESS_LOGS_SHEET_NAME);
      // Headers: User, Action, Type, Status, Timestamp, IP Address, Device
      logsSheet.getRange('A1:G1').setValues([[
        'User', 'Action', 'Type', 'Status', 'Timestamp', 'IP Address', 'Device'
      ]]);
      
      // Format header row
      logsSheet.getRange('A1:G1').setFontWeight('bold');
      logsSheet.setFrozenRows(1);
      
      // Set column widths for readability
      logsSheet.setColumnWidth(1, 150); // User
      logsSheet.setColumnWidth(2, 200); // Action
      logsSheet.setColumnWidth(3, 100); // Type
      logsSheet.setColumnWidth(4, 100); // Status
      logsSheet.setColumnWidth(5, 180); // Timestamp
      logsSheet.setColumnWidth(6, 150); // IP Address
      logsSheet.setColumnWidth(7, 200); // Device
    }
    
    return logsSheet;
  } catch (error) {
    Logger.log('Error initializing Access Logs sheet: ' + error.toString());
    throw error;
  }
}

/**
 * Log a user access/action to the Access Logs sheet
 * Call this from frontend when user performs actions
 */
function handleLogAccess(username, action, actionType, status, ipAddress, device) {
  try {
    const sheet = initializeAccessLogsSheet();
    const lastRow = sheet.getLastRow();
    
    const timestamp = Utilities.formatDate(
      new Date(),
      'Asia/Manila',
      'yyyy-MM-dd hh:mm:ss a'
    );
    
    sheet.getRange(lastRow + 1, 1, 1, 7).setValues([[
      username || 'Unknown',
      action || '',
      actionType || 'view',
      status || 'success',
      timestamp,
      ipAddress || 'Unknown',
      device || 'Unknown'
    ]]);
    
    Logger.log('Access logged: ' + username + ' - ' + action);
    return true;
  } catch (error) {
    Logger.log('Error logging access: ' + error.toString());
    return false;
  }
}

/**
 * Get access logs from the Access Logs sheet
 * Returns paginated logs with metadata
 * Uses ONLY the Access Logs sheet in System Settings spreadsheet
 */
function handleGetAccessLogs(page = 1, limit = 50, filterType = null) {
  try {
    const sheet = initializeAccessLogsSheet();
    const data = sheet.getDataRange().getValues();
    
    // Skip header row
    const logs = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // Skip empty rows
      if (!row[0] && !row[1]) continue;
      
      const logType = row[2] || 'view';
      
      // Apply type filter if provided
      if (filterType && filterType !== 'all' && logType !== filterType) {
        continue;
      }
      
      logs.push({
        id: String(i),
        user: row[0] || '',
        action: row[1] || '',
        type: logType,
        status: row[3] || 'success',
        timestamp: row[4] || '',
        ipAddress: row[5] || 'Unknown',
        device: row[6] || 'Unknown'
      });
    }
    
    // Sort by timestamp descending (newest first)
    logs.sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime() || 0;
      const dateB = new Date(b.timestamp).getTime() || 0;
      return dateB - dateA;
    });
    
    // Paginate
    const totalLogs = logs.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedLogs = logs.slice(startIndex, endIndex);
    
    const totalPages = Math.ceil(totalLogs / limit);
    
    Logger.log('Returning access logs: page ' + page + ' of ' + totalPages + ', total logs: ' + totalLogs);
    
    return createSuccessResponse({
      logs: paginatedLogs,
      pagination: {
        page: page,
        limit: limit,
        totalLogs: totalLogs,
        totalPages: totalPages,
        hasMore: page < totalPages
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    Logger.log('Error getting access logs: ' + error.toString());
    return createErrorResponse('Failed to get access logs: ' + error.message, 500);
  }
}

/**
 * Get access logs statistics
 * Uses ONLY the Access Logs sheet in System Settings spreadsheet
 */
function handleGetAccessLogsStats() {
  try {
    const sheet = initializeAccessLogsSheet();
    const data = sheet.getDataRange().getValues();
    
    let stats = {
      totalLogs: 0,
      byStatus: {},
      byType: {},
      recentLogs: []
    };
    
    const logs = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // Skip empty rows
      if (!row[0] && !row[1]) continue;
      
      const status = row[3] || 'success';
      const type = row[2] || 'view';
      
      stats.totalLogs++;
      
      // Count by status
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
      
      // Count by type
      stats.byType[type] = (stats.byType[type] || 0) + 1;
      
      logs.push({
        user: row[0],
        action: row[1],
        type: type,
        status: status,
        timestamp: row[4]
      });
    }
    
    // Sort by timestamp and get 10 most recent
    logs.sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime() || 0;
      const dateB = new Date(b.timestamp).getTime() || 0;
      return dateB - dateA;
    });
    
    stats.recentLogs = logs.slice(0, 10);
    
    return createSuccessResponse({
      stats: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    Logger.log('Error getting access logs stats: ' + error.toString());
    return createErrorResponse('Failed to get access logs stats: ' + error.message, 500);
  }
}

// =================== ACCESS LOGS ARCHIVE FUNCTIONS ===================

/**
 * Create a styled PDF spreadsheet matching the frontend format
 * @param {Array} logsData - Array of log rows
 * @param {string} reportType - Type of report ('Archive', 'Manual Export')
 * @param {Object} metadata - Additional metadata
 * @returns {Spreadsheet} - The styled spreadsheet ready for PDF conversion
 */
function createStyledAccessLogsPDF(logsData, reportType, metadata) {
  const now = new Date();
  const dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  
  // Create spreadsheet
  const tempSpreadsheet = SpreadsheetApp.create('AccessLogs_temp_' + now.getTime());
  
  // ===== SUMMARY PAGE =====
  const summarySheet = tempSpreadsheet.getActiveSheet();
  summarySheet.setName('Summary');
  
  // Set column widths
  summarySheet.setColumnWidth(1, 150);
  summarySheet.setColumnWidth(2, 100);
  summarySheet.setColumnWidth(3, 100);
  summarySheet.setColumnWidth(4, 100);
  summarySheet.setColumnWidth(5, 100);
  
  let row = 1;
  
  // Organization Header
  summarySheet.getRange(row, 1, 1, 5).merge();
  summarySheet.getRange(row, 1).setValue('Youth Service Philippines - Tagum Chapter');
  summarySheet.getRange(row, 1).setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center');
  row++;
  
  // Motto
  summarySheet.getRange(row, 1, 1, 5).merge();
  summarySheet.getRange(row, 1).setValue('Shaping the Future to a Greater Society');
  summarySheet.getRange(row, 1).setFontSize(10).setFontStyle('italic').setHorizontalAlignment('center').setFontColor('#666666');
  row += 2;
  
  // Report Title
  summarySheet.getRange(row, 1, 1, 5).merge();
  summarySheet.getRange(row, 1).setValue('SYSTEM ACCESS AUDIT REPORT');
  summarySheet.getRange(row, 1).setFontSize(18).setFontWeight('bold').setHorizontalAlignment('center').setBackground('#f64218').setFontColor('#ffffff');
  row++;
  
  // Report Type
  summarySheet.getRange(row, 1, 1, 5).merge();
  summarySheet.getRange(row, 1).setValue(reportType + ' - Generated: ' + dateStr);
  summarySheet.getRange(row, 1).setFontSize(10).setHorizontalAlignment('center').setFontColor('#666666');
  row += 2;
  
  // AUDIT SUMMARY section
  summarySheet.getRange(row, 1, 1, 5).merge();
  summarySheet.getRange(row, 1).setValue('AUDIT SUMMARY');
  summarySheet.getRange(row, 1).setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center');
  row += 2;
  
  // Calculate statistics
  const successCount = logsData.filter(log => String(log[5]).toLowerCase() === 'success').length;
  const failedCount = logsData.filter(log => String(log[5]).toLowerCase() === 'failed').length;
  const warningCount = logsData.filter(log => String(log[5]).toLowerCase() === 'warning').length;
  
  // Status boxes header
  summarySheet.getRange(row, 1).setValue('TOTAL LOGS');
  summarySheet.getRange(row, 2).setValue('SUCCESSFUL');
  summarySheet.getRange(row, 3).setValue('FAILED');
  summarySheet.getRange(row, 4).setValue('WARNINGS');
  summarySheet.getRange(row, 1, 1, 4).setFontWeight('bold').setHorizontalAlignment('center').setFontSize(9);
  row++;
  
  // Status boxes values
  summarySheet.getRange(row, 1).setValue(logsData.length).setBackground('#646464').setFontColor('#ffffff');
  summarySheet.getRange(row, 2).setValue(successCount).setBackground('#10b981').setFontColor('#ffffff');
  summarySheet.getRange(row, 3).setValue(failedCount).setBackground('#ef4444').setFontColor('#ffffff');
  summarySheet.getRange(row, 4).setValue(warningCount).setBackground('#f59e0b').setFontColor('#ffffff');
  summarySheet.getRange(row, 1, 1, 4).setFontWeight('bold').setHorizontalAlignment('center').setFontSize(16);
  row += 2;
  
  // LOGS BY TYPE section
  summarySheet.getRange(row, 1, 1, 5).merge();
  summarySheet.getRange(row, 1).setValue('LOGS BY TYPE');
  summarySheet.getRange(row, 1).setFontSize(12).setFontWeight('bold');
  row++;
  
  const logTypes = [
    { name: 'LOGIN', type: 'login', color: '#f6421f' },
    { name: 'LOGOUT', type: 'logout', color: '#6b7280' },
    { name: 'VIEW', type: 'view', color: '#3b82f6' },
    { name: 'EDIT', type: 'edit', color: '#8b5cf6' },
    { name: 'CREATE', type: 'create', color: '#10b981' },
    { name: 'DELETE', type: 'delete', color: '#ef4444' },
  ];
  
  // Log type headers
  for (let i = 0; i < logTypes.length; i++) {
    summarySheet.getRange(row, i + 1).setValue(logTypes[i].name);
    summarySheet.getRange(row, i + 1).setFontWeight('bold').setHorizontalAlignment('center').setFontSize(8);
  }
  row++;
  
  // Log type counts with colors
  for (let i = 0; i < logTypes.length; i++) {
    const count = logsData.filter(log => String(log[3]).toLowerCase() === logTypes[i].type).length;
    summarySheet.getRange(row, i + 1).setValue(count);
    summarySheet.getRange(row, i + 1).setBackground(logTypes[i].color).setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center').setFontSize(14);
  }
  row += 2;
  
  // QUICK STATISTICS
  summarySheet.getRange(row, 1, 1, 5).merge();
  summarySheet.getRange(row, 1).setValue('QUICK STATISTICS');
  summarySheet.getRange(row, 1).setFontSize(12).setFontWeight('bold');
  row++;
  
  const uniqueUsers = [...new Set(logsData.map(log => log[1]))].length;
  const successRate = logsData.length > 0 ? Math.round((successCount / logsData.length) * 100) : 0;
  
  summarySheet.getRange(row, 1).setValue('Total unique users:');
  summarySheet.getRange(row, 2).setValue(uniqueUsers);
  row++;
  summarySheet.getRange(row, 1).setValue('Success rate:');
  summarySheet.getRange(row, 2).setValue(successRate + '%');
  row++;
  summarySheet.getRange(row, 1).setValue('Report period:');
  if (metadata.dateRange) {
    summarySheet.getRange(row, 2).setValue(metadata.dateRange.start + ' to ' + metadata.dateRange.end);
  } else if (metadata.monthYear) {
    summarySheet.getRange(row, 2).setValue(metadata.monthYear);
  } else {
    summarySheet.getRange(row, 2).setValue('All available logs');
  }
  row++;
  summarySheet.getRange(row, 1).setValue('Archived by:');
  summarySheet.getRange(row, 2).setValue(metadata.username || 'System');
  row += 2;
  
  // Footer
  summarySheet.getRange(row, 1, 1, 5).merge();
  summarySheet.getRange(row, 1).setValue('Youth Service Philippines - Tagum Chapter | Shaping the Future to a Greater Society');
  summarySheet.getRange(row, 1).setFontSize(8).setHorizontalAlignment('center').setFontColor('#888888');
  
  // ===== ALL LOGS PAGE (Chronological) =====
  const allLogsSheet = tempSpreadsheet.insertSheet('All Logs - Chronological');
  
  // Header
  allLogsSheet.getRange(1, 1, 1, 8).merge();
  allLogsSheet.getRange(1, 1).setValue('ALL LOGS - CHRONOLOGICAL ORDER (' + logsData.length + ' entries)');
  allLogsSheet.getRange(1, 1).setFontSize(14).setFontWeight('bold').setBackground('#646464').setFontColor('#ffffff');
  
  // Table headers
  const headers = ['#', 'Username', 'Type', 'Action', 'Status', 'Timestamp', 'IP Address', 'Device'];
  allLogsSheet.getRange(2, 1, 1, headers.length).setValues([headers]);
  allLogsSheet.getRange(2, 1, 1, headers.length).setFontWeight('bold').setBackground('#646464').setFontColor('#ffffff').setHorizontalAlignment('center');
  
  // Sort chronologically and add data
  const sortedLogs = logsData.slice().sort((a, b) => new Date(a[4]) - new Date(b[4]));
  for (let i = 0; i < sortedLogs.length; i++) {
    const log = sortedLogs[i];
    const rowData = [
      i + 1,
      log[1], // Username
      String(log[3]).charAt(0).toUpperCase() + String(log[3]).slice(1), // Type
      log[2], // Action
      String(log[5]).charAt(0).toUpperCase() + String(log[5]).slice(1), // Status
      log[4], // Timestamp
      log[6], // IP Address
      log[7], // Device
    ];
    allLogsSheet.getRange(i + 3, 1, 1, rowData.length).setValues([rowData]);
    
    // Alternate row colors
    if (i % 2 === 1) {
      allLogsSheet.getRange(i + 3, 1, 1, rowData.length).setBackground('#f8f8f8');
    }
  }
  
  // Auto-resize columns
  for (let i = 1; i <= headers.length; i++) {
    allLogsSheet.autoResizeColumn(i);
  }
  
  // ===== TABLES BY LOG TYPE =====
  const logTypeColors = {
    login: { header: '#f6421f', alt: '#fef3f0' },
    logout: { header: '#6b7280', alt: '#f5f6f7' },
    view: { header: '#3b82f6', alt: '#eff6ff' },
    edit: { header: '#8b5cf6', alt: '#f5f1fe' },
    create: { header: '#10b981', alt: '#ecfdf5' },
    delete: { header: '#ef4444', alt: '#fef2f2' },
  };
  
  for (const logType of logTypes) {
    const typeLogs = logsData.filter(log => String(log[3]).toLowerCase() === logType.type);
    if (typeLogs.length === 0) continue;
    
    const typeSheet = tempSpreadsheet.insertSheet(logType.name + ' Logs');
    const colors = logTypeColors[logType.type];
    
    // Header
    typeSheet.getRange(1, 1, 1, 7).merge();
    typeSheet.getRange(1, 1).setValue(logType.name + ' LOGS (' + typeLogs.length + ' entries)');
    typeSheet.getRange(1, 1).setFontSize(14).setFontWeight('bold').setBackground(colors.header).setFontColor('#ffffff');
    
    // Table headers
    const typeHeaders = ['#', 'User', 'Action', 'Status', 'Timestamp', 'IP Address', 'Device'];
    typeSheet.getRange(2, 1, 1, typeHeaders.length).setValues([typeHeaders]);
    typeSheet.getRange(2, 1, 1, typeHeaders.length).setFontWeight('bold').setBackground(colors.header).setFontColor('#ffffff').setHorizontalAlignment('center');
    
    // Data rows
    for (let i = 0; i < typeLogs.length; i++) {
      const log = typeLogs[i];
      const rowData = [
        i + 1,
        log[1], // Username
        log[2], // Action
        String(log[5]).charAt(0).toUpperCase() + String(log[5]).slice(1), // Status
        log[4], // Timestamp
        log[6], // IP Address
        log[7], // Device
      ];
      typeSheet.getRange(i + 3, 1, 1, rowData.length).setValues([rowData]);
      
      // Alternate row colors
      if (i % 2 === 1) {
        typeSheet.getRange(i + 3, 1, 1, rowData.length).setBackground(colors.alt);
      }
    }
    
    // Auto-resize
    for (let i = 1; i <= typeHeaders.length; i++) {
      typeSheet.autoResizeColumn(i);
    }
  }
  
  return tempSpreadsheet;
}

/**
 * Archive access logs to Google Drive before deletion as PDF
 * Creates a styled PDF matching the frontend format
 * @param {Array} logsData - Array of log rows to archive (including header)
 * @param {string} archiveType - Type of archive ('all', 'dateRange', 'monthly', 'selected')
 * @param {Object} metadata - Additional metadata (dateRange, count, etc.)
 * @returns {Object} - Archive result with file URL
 */
function archiveAccessLogsToDrive(logsData, archiveType, metadata) {
  try {
    const archiveFolder = DriveApp.getFolderById(ACCESS_LOGS_ARCHIVE_FOLDER_ID);
    
    // Generate archive filename with timestamp
    const now = new Date();
    const dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd_HH-mm-ss');
    let fileName = 'AccessLogs_Archive_' + archiveType + '_' + dateStr;
    
    if (metadata.monthYear) {
      fileName = 'AccessLogs_' + metadata.monthYear;
    }
    
    // Create spreadsheet for archive
    const archiveSpreadsheet = SpreadsheetApp.create(fileName);
    const archiveSheet = archiveSpreadsheet.getActiveSheet();
    archiveSheet.setName('Access Logs');
    
    // Set header row
    const headers = ['Log ID', 'Username', 'Action', 'Action Type', 'Timestamp', 'Status', 'IP Address', 'Device'];
    archiveSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    archiveSheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#f64218')
      .setFontColor('#ffffff');
    
    // Add data rows
    if (logsData.length > 0) {
      archiveSheet.getRange(2, 1, logsData.length, logsData[0].length).setValues(logsData);
    }
    
    // Auto-resize columns
    for (let i = 1; i <= headers.length; i++) {
      archiveSheet.autoResizeColumn(i);
    }
    
    // Add archive info sheet
    const infoSheet = archiveSpreadsheet.insertSheet('Archive Info');
    const infoData = [
      ['Archive Type', archiveType],
      ['Archive Date', now.toISOString()],
      ['Archived By', metadata.username || 'System'],
      ['Total Records', logsData.length],
      ['Date Range', metadata.startDate && metadata.endDate ? metadata.startDate + ' to ' + metadata.endDate : 'All dates'],
    ];
    infoSheet.getRange(1, 1, infoData.length, 2).setValues(infoData);
    infoSheet.getRange(1, 1, infoData.length, 1).setFontWeight('bold');
    infoSheet.autoResizeColumn(1);
    infoSheet.autoResizeColumn(2);
    
    // Move the spreadsheet to archive folder
    const spreadsheetFile = DriveApp.getFileById(archiveSpreadsheet.getId());
    archiveFolder.addFile(spreadsheetFile);
    DriveApp.getRootFolder().removeFile(spreadsheetFile);
    
    Logger.log('Access logs archived as spreadsheet: ' + fileName + ', Records: ' + logsData.length);
    
    return {
      success: true,
      fileName: fileName,
      fileUrl: archiveSpreadsheet.getUrl(),
      recordCount: logsData.length,
      archiveDate: now.toISOString()
    };
  } catch (error) {
    Logger.log('Error archiving access logs: ' + error.toString());
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get logs data for archiving (formatted for spreadsheet)
 * @param {Sheet} sheet - The access logs sheet
 * @param {Array} rowIndices - Optional specific row indices to get (1-based, excluding header)
 * @returns {Array} - Array of log data rows
 */
function getLogsDataForArchive(sheet, rowIndices) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  if (rowIndices && rowIndices.length > 0) {
    // Get specific rows
    return rowIndices
      .filter(i => i >= 1 && i < data.length)
      .map(i => data[i]);
  }
  
  // Return all data rows (excluding header)
  return data.slice(1);
}

/**
 * Auto-archive and clean logs older than specified months
 * This can be triggered by a time-based trigger for monthly cleanup
 * @param {number} monthsOld - Archive logs older than this many months (default: 1)
 */
function autoArchiveOldLogs(monthsOld) {
  const months = monthsOld || 1;
  try {
    const sheet = initializeAccessLogsSheet();
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      Logger.log('No logs to archive');
      return { archived: 0, message: 'No logs to archive' };
    }
    
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - months);
    cutoffDate.setDate(1);
    cutoffDate.setHours(0, 0, 0, 0);
    
    // Group logs by month/year for separate archives
    const logsByMonth = {};
    const rowsToDelete = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const timestampStr = row[4]; // Timestamp column
      if (!timestampStr) continue;
      
      const logDate = new Date(timestampStr);
      if (logDate < cutoffDate) {
        const monthYear = Utilities.formatDate(logDate, Session.getScriptTimeZone(), 'yyyy-MM');
        if (!logsByMonth[monthYear]) {
          logsByMonth[monthYear] = [];
        }
        logsByMonth[monthYear].push(row);
        rowsToDelete.push(i + 1); // Sheet rows are 1-indexed
      }
    }
    
    // Archive each month's logs separately
    const archiveResults = [];
    for (const monthYear in logsByMonth) {
      const result = archiveAccessLogsToDrive(
        logsByMonth[monthYear],
        'monthly',
        { monthYear: monthYear, username: 'Auto-Archive System' }
      );
      archiveResults.push({ monthYear, ...result });
    }
    
    // Delete archived rows (from bottom to top)
    rowsToDelete.sort((a, b) => b - a);
    for (const rowIndex of rowsToDelete) {
      sheet.deleteRow(rowIndex);
    }
    
    // Log this action
    if (rowsToDelete.length > 0) {
      handleLogAccess('System', 'Auto-archived and cleaned ' + rowsToDelete.length + ' old logs (' + Object.keys(logsByMonth).length + ' monthly archives)', 'delete', 'success', 'System', 'Scheduled Task');
    }
    
    Logger.log('Auto-archive complete. Archived: ' + rowsToDelete.length + ' logs into ' + Object.keys(logsByMonth).length + ' monthly files');
    
    return {
      archived: rowsToDelete.length,
      monthsArchived: Object.keys(logsByMonth).length,
      archives: archiveResults
    };
  } catch (error) {
    Logger.log('Error in auto-archive: ' + error.toString());
    return { error: error.message };
  }
}

// =================== MANUAL EXPORT ACCESS LOGS FUNCTIONS ===================

/**
 * Manually export access logs to Google Drive
 * Saves to the manual export folder (separate from automatic archives)
 * @param {string} username - User performing the export
 * @param {string} filterType - Optional filter by log type (login, logout, view, edit, create, delete)
 * @param {string} startDate - Optional start date for filtering (YYYY-MM-DD)
 * @param {string} endDate - Optional end date for filtering (YYYY-MM-DD)
 * @returns {Object} - Export result with file URL
 */
/**
 * Handle PDF upload from frontend for Google Drive storage
 * This allows the exact frontend-styled PDF to be saved to Google Drive
 * @param {string} pdfBase64 - Base64 encoded PDF data
 * @param {string} fileName - Desired file name for the PDF
 * @param {string} username - User performing the export
 * @param {string} exportType - Type of export ('manual' or 'archive')
 * @returns {Object} - Success/error response
 */
function handleUploadAccessLogsPDF(pdfBase64, fileName, username, exportType) {
  try {
    if (!pdfBase64) {
      return createErrorResponse('PDF data is required', 400);
    }
    
    // Determine which folder to use based on export type
    const folderId = exportType === 'archive' 
      ? ACCESS_LOGS_ARCHIVE_FOLDER_ID 
      : ACCESS_LOGS_MANUAL_EXPORT_FOLDER_ID;
    
    const folder = DriveApp.getFolderById(folderId);
    
    // Decode base64 PDF data
    const pdfData = Utilities.base64Decode(pdfBase64);
    const pdfBlob = Utilities.newBlob(pdfData, MimeType.PDF, fileName || 'AccessLogs_Export.pdf');
    
    // Save to Google Drive
    const pdfFile = folder.createFile(pdfBlob);
    
    // Log this action
    handleLogAccess(
      username || 'System', 
      (exportType === 'archive' ? 'Archive' : 'Manual') + ' PDF uploaded to Google Drive: ' + fileName, 
      'view', 
      'success', 
      'System', 
      exportType === 'archive' ? 'Archive Export' : 'Manual Export'
    );
    
    Logger.log('PDF uploaded to Google Drive: ' + fileName + ' to folder: ' + (exportType === 'archive' ? 'Archive' : 'Manual Export'));
    
    return createSuccessResponse({
      message: 'PDF saved to Google Drive successfully',
      fileName: fileName,
      fileUrl: pdfFile.getUrl(),
      folderUrl: folder.getUrl(),
      exportType: exportType || 'manual',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    Logger.log('Error uploading PDF to Drive: ' + error.toString());
    return createErrorResponse('Failed to upload PDF: ' + error.message, 500);
  }
}

// Keep the old function for backward compatibility with archive operations
function handleManualExportAccessLogs(username, filterType, startDate, endDate) {
  try {
    const sheet = initializeAccessLogsSheet();
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return createSuccessResponse({
        message: 'No logs to export',
        exportedCount: 0,
        timestamp: new Date().toISOString()
      });
    }
    
    // Get logs (excluding header)
    let logsToExport = data.slice(1);
    
    // Apply type filter if specified
    if (filterType && filterType !== 'all') {
      logsToExport = logsToExport.filter(row => {
        const logType = String(row[3]).toLowerCase(); // Action Type column
        return logType === filterType.toLowerCase();
      });
    }
    
    // Apply date range filter if specified
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : null;
      if (start) start.setHours(0, 0, 0, 0);
      
      const end = endDate ? new Date(endDate) : null;
      if (end) end.setHours(23, 59, 59, 999);
      
      logsToExport = logsToExport.filter(row => {
        const timestampStr = row[4]; // Timestamp column
        if (!timestampStr) return false;
        
        const logDate = new Date(timestampStr);
        if (start && logDate < start) return false;
        if (end && logDate > end) return false;
        return true;
      });
    }
    
    if (logsToExport.length === 0) {
      return createSuccessResponse({
        message: 'No logs match the specified filters',
        exportedCount: 0,
        timestamp: new Date().toISOString()
      });
    }
    
    // Get the manual export folder
    const exportFolder = DriveApp.getFolderById(ACCESS_LOGS_MANUAL_EXPORT_FOLDER_ID);
    
    // Generate filename with timestamp and filter info
    const now = new Date();
    const dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd_HH-mm-ss');
    let fileName = 'AccessLogs_Manual_Export_' + dateStr;
    
    if (filterType && filterType !== 'all') {
      fileName += '_' + filterType.toUpperCase();
    }
    if (startDate && endDate) {
      fileName += '_' + startDate + '_to_' + endDate;
    } else if (startDate) {
      fileName += '_from_' + startDate;
    } else if (endDate) {
      fileName += '_until_' + endDate;
    }
    
    // Create temporary spreadsheet for PDF conversion
    const tempSpreadsheet = SpreadsheetApp.create(fileName + '_temp');
    const exportSheet = tempSpreadsheet.getActiveSheet();
    exportSheet.setName('Exported Logs');
    
    // Set header row
    const headers = ['Log ID', 'Username', 'Action', 'Action Type', 'Timestamp', 'Status', 'IP Address', 'Device'];
    exportSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    exportSheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#f64218')
      .setFontColor('#ffffff');
    
    // Add data rows
    if (logsToExport.length > 0) {
      exportSheet.getRange(2, 1, logsToExport.length, logsToExport[0].length).setValues(logsToExport);
    }
    
    // Auto-resize columns
    for (let i = 1; i <= headers.length; i++) {
      exportSheet.autoResizeColumn(i);
    }
    
    // Add export info sheet
    const infoSheet = tempSpreadsheet.insertSheet('Export Info');
    const infoData = [
      ['Export Type', 'Manual Export (PDF)'],
      ['Exported Date', now.toISOString()],
      ['Exported By', username || 'Unknown'],
      ['Total Records', logsToExport.length],
      ['Filter Type', filterType || 'All'],
      ['Start Date', startDate || 'Not specified'],
      ['End Date', endDate || 'Not specified'],
    ];
    infoSheet.getRange(1, 1, infoData.length, 2).setValues(infoData);
    infoSheet.getRange(1, 1, infoData.length, 1).setFontWeight('bold');
    infoSheet.autoResizeColumn(1);
    infoSheet.autoResizeColumn(2);
    
    // Flush changes before PDF conversion
    SpreadsheetApp.flush();
    
    // Convert to PDF
    const pdfBlob = tempSpreadsheet.getAs(MimeType.PDF);
    pdfBlob.setName(fileName + '.pdf');
    
    // Save PDF to manual export folder
    const pdfFile = exportFolder.createFile(pdfBlob);
    
    // Delete the temporary spreadsheet
    DriveApp.getFileById(tempSpreadsheet.getId()).setTrashed(true);
    
    // Log this action
    handleLogAccess(username || 'System', 'Manual PDF export: ' + logsToExport.length + ' logs exported to Google Drive (' + fileName + '.pdf)', 'view', 'success', 'System', 'Manual Export');
    
    Logger.log('Manual access logs PDF export completed: ' + fileName + '.pdf, Records: ' + logsToExport.length);
    
    return createSuccessResponse({
      message: 'Access logs exported as PDF to Google Drive',
      exportedCount: logsToExport.length,
      fileName: fileName + '.pdf',
      fileUrl: pdfFile.getUrl(),
      folderUrl: exportFolder.getUrl(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    Logger.log('Error in manual export access logs: ' + error.toString());
    return createErrorResponse('Failed to export access logs: ' + error.message, 500);
  }
}

// =================== CLEAR ACCESS LOGS FUNCTIONS ===================

/**
 * Clear ALL access logs from the Access Logs sheet
 * Archives logs to Google Drive before deletion
 * Keeps the header row intact
 */
function handleClearAllAccessLogs(username) {
  try {
    const sheet = initializeAccessLogsSheet();
    const lastRow = sheet.getLastRow();
    
    if (lastRow <= 1) {
      return createSuccessResponse({
        message: 'No logs to clear',
        deletedCount: 0,
        timestamp: new Date().toISOString()
      });
    }
    
    // Archive logs before deletion
    const logsToArchive = getLogsDataForArchive(sheet);
    const archiveResult = archiveAccessLogsToDrive(logsToArchive, 'all', { username: username || 'System' });
    
    if (!archiveResult.success) {
      return createErrorResponse('Failed to archive logs before deletion: ' + archiveResult.error, 500);
    }
    
    // Delete all data rows except header
    const deletedCount = lastRow - 1;
    sheet.deleteRows(2, deletedCount);
    
    // Log this action
    handleLogAccess(username || 'System', 'Archived and cleared all access logs (' + deletedCount + ' entries) - Archive: ' + archiveResult.fileName, 'delete', 'success', 'System', 'System Action');
    
    Logger.log('All access logs archived and cleared by: ' + username + ', count: ' + deletedCount);
    
    return createSuccessResponse({
      message: 'All access logs archived and cleared successfully',
      deletedCount: deletedCount,
      archived: true,
      archiveUrl: archiveResult.fileUrl,
      archiveFileName: archiveResult.fileName,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    Logger.log('Error clearing all access logs: ' + error.toString());
    return createErrorResponse('Failed to clear access logs: ' + error.message, 500);
  }
}

/**
 * Clear access logs within a specific date range
 * @param {string} startDate - Start date in ISO format (YYYY-MM-DD)
 * @param {string} endDate - End date in ISO format (YYYY-MM-DD)
 * @param {string} username - User performing the action
 */
function handleClearAccessLogsByDateRange(startDate, endDate, username) {
  try {
    if (!startDate || !endDate) {
      return createErrorResponse('Start date and end date are required', 400);
    }
    
    const sheet = initializeAccessLogsSheet();
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return createSuccessResponse({
        message: 'No logs to clear',
        deletedCount: 0,
        timestamp: new Date().toISOString()
      });
    }
    
    // Parse date range
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    // Find rows to delete and collect data for archiving
    const rowsToDelete = [];
    const logsToArchive = [];
    for (let i = data.length - 1; i >= 1; i--) {
      const row = data[i];
      const timestampStr = row[4]; // Timestamp column
      
      if (!timestampStr) continue;
      
      const logDate = new Date(timestampStr);
      if (logDate >= start && logDate <= end) {
        rowsToDelete.push(i + 1); // Sheet rows are 1-indexed
        logsToArchive.push(row);
      }
    }
    
    if (rowsToDelete.length === 0) {
      return createSuccessResponse({
        message: 'No logs found in the specified date range',
        deletedCount: 0,
        dateRange: { start: startDate, end: endDate },
        timestamp: new Date().toISOString()
      });
    }
    
    // Archive logs before deletion
    const archiveResult = archiveAccessLogsToDrive(logsToArchive.reverse(), 'dateRange', { 
      username: username || 'System',
      dateRange: { start: startDate, end: endDate }
    });
    
    if (!archiveResult.success) {
      return createErrorResponse('Failed to archive logs before deletion: ' + archiveResult.error, 500);
    }
    
    // Delete rows from bottom to top to maintain correct indices
    for (const rowIndex of rowsToDelete) {
      sheet.deleteRow(rowIndex);
    }
    
    const deletedCount = rowsToDelete.length;
    
    // Log this action
    handleLogAccess(username || 'System', 'Archived and cleared access logs by date range (' + startDate + ' to ' + endDate + ', ' + deletedCount + ' entries)', 'delete', 'success', 'System', 'System Action');
    
    Logger.log('Access logs archived and cleared by date range by: ' + username + ', count: ' + deletedCount);
    
    return createSuccessResponse({
      message: 'Access logs archived and cleared successfully for date range',
      deletedCount: deletedCount,
      archived: true,
      archiveUrl: archiveResult.fileUrl,
      archiveFileName: archiveResult.fileName,
      dateRange: { start: startDate, end: endDate },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    Logger.log('Error clearing access logs by date range: ' + error.toString());
    return createErrorResponse('Failed to clear access logs: ' + error.message, 500);
  }
}

/**
 * Clear specific access logs by their IDs (row indices)
 * @param {Array<string>} logIds - Array of log IDs to delete
 * @param {string} username - User performing the action
 */
function handleClearSpecificAccessLogs(logIds, username) {
  try {
    if (!logIds || !Array.isArray(logIds) || logIds.length === 0) {
      return createErrorResponse('Log IDs array is required', 400);
    }
    
    const sheet = initializeAccessLogsSheet();
    
    // Convert IDs to row numbers and sort descending (to delete from bottom up)
    const rowNumbers = logIds
      .map(id => parseInt(id, 10))
      .filter(num => !isNaN(num) && num > 0)
      .map(id => id + 1) // Row number = ID + 1 (since ID is 0-based index from header)
      .sort((a, b) => b - a); // Sort descending
    
    // Remove duplicates
    const uniqueRows = [...new Set(rowNumbers)];
    
    // Get data for archiving before deletion
    const data = sheet.getDataRange().getValues();
    const logsToArchive = uniqueRows
      .filter(rowIndex => rowIndex > 1 && rowIndex <= data.length)
      .map(rowIndex => data[rowIndex - 1])
      .reverse(); // Maintain chronological order
    
    if (logsToArchive.length > 0) {
      // Archive logs before deletion
      const archiveResult = archiveAccessLogsToDrive(logsToArchive, 'selected', { 
        username: username || 'System',
        selectedCount: logsToArchive.length
      });
      
      if (!archiveResult.success) {
        return createErrorResponse('Failed to archive logs before deletion: ' + archiveResult.error, 500);
      }
    }
    
    // Delete rows from bottom to top
    let deletedCount = 0;
    for (const rowIndex of uniqueRows) {
      if (rowIndex > 1 && rowIndex <= sheet.getLastRow()) {
        sheet.deleteRow(rowIndex);
        deletedCount++;
      }
    }
    
    // Log this action
    handleLogAccess(username || 'System', 'Archived and cleared specific access logs (' + deletedCount + ' entries)', 'delete', 'success', 'System', 'System Action');
    
    Logger.log('Specific access logs archived and cleared by: ' + username + ', count: ' + deletedCount);
    
    return createSuccessResponse({
      message: 'Selected access logs archived and cleared successfully',
      deletedCount: deletedCount,
      archived: true,
      requestedIds: logIds.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    Logger.log('Error clearing specific access logs: ' + error.toString());
    return createErrorResponse('Failed to clear access logs: ' + error.message, 500);
  }
}

/**
 * Scheduled function to clear access logs automatically
 * Runs every Monday at 12:00 AM (midnight) Manila time
 * Clears logs older than 7 days to maintain a week's worth of data
 * Archives logs before deletion
 */
function scheduledWeeklyClearAccessLogs() {
  try {
    const sheet = initializeAccessLogsSheet();
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      Logger.log('Scheduled clear: No logs to clear');
      return;
    }
    
    // Calculate date 7 days ago
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    oneWeekAgo.setHours(0, 0, 0, 0);
    
    // Find rows to delete and collect data for archiving
    const rowsToDelete = [];
    const logsToArchive = [];
    for (let i = data.length - 1; i >= 1; i--) {
      const row = data[i];
      const timestampStr = row[4]; // Timestamp column
      
      if (!timestampStr) continue;
      
      const logDate = new Date(timestampStr);
      if (logDate < oneWeekAgo) {
        rowsToDelete.push(i + 1); // Sheet rows are 1-indexed
        logsToArchive.push(row);
      }
    }
    
    if (rowsToDelete.length === 0) {
      Logger.log('Scheduled clear: No old logs to archive/clear');
      return;
    }
    
    // Archive logs before deletion
    const archiveResult = archiveAccessLogsToDrive(logsToArchive.reverse(), 'scheduled-weekly', { 
      username: 'System Scheduler'
    });
    
    if (!archiveResult.success) {
      Logger.log('Failed to archive logs in scheduled clear: ' + archiveResult.error);
      return;
    }
    
    // Delete rows from bottom to top
    for (const rowIndex of rowsToDelete) {
      sheet.deleteRow(rowIndex);
    }
    
    const deletedCount = rowsToDelete.length;
    
    // Log the scheduled action
    handleLogAccess('System Scheduler', 'Scheduled weekly: archived and removed ' + deletedCount + ' logs older than 7 days', 'delete', 'success', 'System', 'Scheduled Task');
    
    Logger.log('Scheduled weekly clear completed: ' + deletedCount + ' logs archived and removed');
  } catch (error) {
    Logger.log('Error in scheduled weekly clear: ' + error.toString());
  }
}

/**
 * Scheduled function to archive and clean access logs monthly
 * Runs on the 1st of every month at 1:00 AM Manila time
 * Archives logs from the previous month to Google Drive
 */
function scheduledMonthlyArchiveAccessLogs() {
  try {
    const result = autoArchiveOldLogs(1); // Archive logs older than 1 month
    
    if (result.error) {
      Logger.log('Scheduled monthly archive error: ' + result.error);
      return;
    }
    
    Logger.log('Scheduled monthly archive completed: ' + result.archived + ' logs archived into ' + result.monthsArchived + ' files');
  } catch (error) {
    Logger.log('Error in scheduled monthly archive: ' + error.toString());
  }
}

/**
 * Create/update the weekly trigger for automatic access log clearing
 * Call this function once to set up the scheduled trigger
 * Runs every Monday at 12:00 AM (midnight) Manila time
 */
function setupWeeklyAccessLogClearTrigger() {
  // Delete existing triggers for this function to avoid duplicates
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'scheduledWeeklyClearAccessLogs') {
      ScriptApp.deleteTrigger(trigger);
      Logger.log('Deleted existing weekly clear trigger');
    }
  }
  
  // Create new weekly trigger for Monday at 12:00 AM
  ScriptApp.newTrigger('scheduledWeeklyClearAccessLogs')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(0) // 12:00 AM (midnight)
    .nearMinute(0)
    .inTimezone('Asia/Manila')
    .create();
  
  Logger.log('Weekly access log clear trigger created: Every Monday at 12:00 AM Manila time');
  
  return 'Weekly trigger set up successfully. Access logs older than 7 days will be archived and cleared every Monday at 12:00 AM.';
}

/**
 * Create/update the monthly trigger for automatic access log archiving
 * Call this function once to set up the scheduled trigger
 * Runs on the 1st of every month at 1:00 AM Manila time
 */
function setupMonthlyAccessLogArchiveTrigger() {
  // Delete existing triggers for this function to avoid duplicates
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'scheduledMonthlyArchiveAccessLogs') {
      ScriptApp.deleteTrigger(trigger);
      Logger.log('Deleted existing monthly archive trigger');
    }
  }
  
  // Create new monthly trigger for 1st of month at 1:00 AM
  ScriptApp.newTrigger('scheduledMonthlyArchiveAccessLogs')
    .timeBased()
    .onMonthDay(1)
    .atHour(1) // 1:00 AM
    .nearMinute(0)
    .inTimezone('Asia/Manila')
    .create();
  
  Logger.log('Monthly access log archive trigger created: 1st of every month at 1:00 AM Manila time');
  
  return 'Monthly trigger set up successfully. Access logs older than 1 month will be archived on the 1st of each month at 1:00 AM.';
}

/**
 * Remove the weekly trigger for automatic access log clearing
 * Call this function to disable automatic clearing
 */
function removeWeeklyAccessLogClearTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  let removed = 0;
  
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'scheduledWeeklyClearAccessLogs') {
      ScriptApp.deleteTrigger(trigger);
      removed++;
    }
  }
  
  Logger.log('Removed ' + removed + ' weekly clear trigger(s)');
  return 'Removed ' + removed + ' weekly clear trigger(s). Automatic clearing is now disabled.';
}

/**
 * Check if the weekly trigger is set up
 */
function checkWeeklyAccessLogClearTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'scheduledWeeklyClearAccessLogs') {
      return {
        active: true,
        nextRun: 'Every Monday at 12:00 AM Manila time',
        handlerFunction: trigger.getHandlerFunction()
      };
    }
  }
  
  return {
    active: false,
    message: 'No weekly clear trigger found. Run setupWeeklyAccessLogClearTrigger() to enable.'
  };
}

/**
 * Remove the monthly trigger for automatic access log archiving
 * Call this function to disable automatic monthly archiving
 */
function removeMonthlyAccessLogArchiveTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  let removed = 0;
  
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'scheduledMonthlyArchiveAccessLogs') {
      ScriptApp.deleteTrigger(trigger);
      removed++;
    }
  }
  
  if (removed > 0) {
    Logger.log('Removed ' + removed + ' monthly archive trigger(s)');
    return 'Monthly archive trigger removed. Automatic monthly archiving is now disabled.';
  } else {
    return 'No monthly archive trigger found to remove.';
  }
}

/**
 * Check if the monthly trigger is set up
 */
function checkMonthlyAccessLogArchiveTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'scheduledMonthlyArchiveAccessLogs') {
      return {
        active: true,
        nextRun: '1st of every month at 1:00 AM Manila time',
        handlerFunction: trigger.getHandlerFunction()
      };
    }
  }
  
  return {
    active: false,
    message: 'No monthly archive trigger found. Run setupMonthlyAccessLogArchiveTrigger() to enable.'
  };
}

/**
 * Set up all access log automation triggers (weekly clear + monthly archive)
 */
function setupAllAccessLogTriggers() {
  const weeklyResult = setupWeeklyAccessLogClearTrigger();
  const monthlyResult = setupMonthlyAccessLogArchiveTrigger();
  
  return {
    weekly: weeklyResult,
    monthly: monthlyResult,
    message: 'All access log automation triggers have been set up.'
  };
}

// =================== TESTING FUNCTIONS ===================

/**
 * Test function to manually run backup
 */
function testDatabaseBackup() {
  const result = handleDatabaseBackup('test_admin');
  Logger.log(result.getContent());
}

/**
 * Test function to manually run export
 */
function testExportData() {
  const result = handleExportData('test_admin');
  Logger.log(result.getContent());
}

/**
 * Test function to get system health
 */
function testGetSystemHealth() {
  const result = handleGetSystemHealth();
  Logger.log(result.getContent());
}

/**
 * Test function to bump cache version
 */
function testBumpCacheVersion() {
  const result = handleBumpCacheVersion('test_admin');
  Logger.log(result.getContent());
}

/**
 * Test function to get maintenance mode
 */
function testGetMaintenanceMode() {
  const result = handleGetMaintenanceMode();
  Logger.log(result.getContent());
}
