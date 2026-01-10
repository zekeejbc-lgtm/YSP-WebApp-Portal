// =================== WEB APP ENTRY POINTS ===================

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
    
    Logger.log('doPost received action: ' + action);
    
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
  Logger.log('=== AUTHORIZATION COMPLETE ===');
  Logger.log('If all checks passed, deploy as web app with access: ANYONE');
  Logger.log('If any failed, check the spreadsheet IDs and permissions.');
  
  return 'Authorization triggered. Check the Logs for details.';
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
      
      // Add fullPWA row as first entry
      maintenanceSheet.getRange(2, 1, 1, 9).setValues([[
        'fullPWA', 'FALSE', '', '', '', '', '', '', ''
      ]]);
      
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

/**
 * Get current cache version
 */
function getCacheVersion() {
  try {
    const version = getSystemSetting('cache_version');
    return version ? parseInt(version, 10) : 1;
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
    const currentVersion = getCacheVersion();
    const newVersion = currentVersion + 1;
    
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
      timestamp: new Date().toISOString()
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
