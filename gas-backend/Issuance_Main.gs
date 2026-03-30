  /**
  * =============================================================================
  * ISSUANCE CENTER - GOOGLE APPS SCRIPT BACKEND
  * =============================================================================
  * 
  * GAS Backend for managing issuances, certificates, notices, and templates.
  * 
  * API URL: https://script.google.com/macros/s/AKfycbwir6gVrY9U9n8KgThRx7_5CXxHvDPyF_4EDho_ZsSE2oUtfolYkK6M8A8mdatssWkPMw/exec
  * Sheet URL: https://docs.google.com/spreadsheets/d/1HUimmBnzy1Rr7Kg-x24iiscKTmqHJdzDoV72N3u4wmE/edit?gid=0#gid=0
  * PDF Storage: https://drive.google.com/drive/folders/1e6g6JLr7y9VcJJ2wQ5jijNu9z6WAmDnt
  * 
  * Features:
  * - Issuance management (create, read, update, delete)
  * - Template management with custom placeholders
  * - PDF generation from Google Docs templates
  * - Email sending with attachments
  * - Recipient selection (by event, person, committee, directory, external)
  * 
  * =============================================================================
  */

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  const ISSUANCE_BRANDING_CACHE_KEY = 'issuance_org_branding_v1';
  const ISSUANCE_BRANDING_CACHE_TTL_SECONDS = 1800;
  const ISSUANCE_BRANDING_SHEET_NAME = 'Organization Branding';
  const ISSUANCE_BRANDING_DEFAULTS = {
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

  function normalizeIssuanceBranding_(raw) {
    var merged = Object.assign({}, ISSUANCE_BRANDING_DEFAULTS, raw || {});
    merged.orgName = String(merged.orgName || '').trim() || ISSUANCE_BRANDING_DEFAULTS.orgName;
    merged.chapterName = String(merged.chapterName || '').trim() || ISSUANCE_BRANDING_DEFAULTS.chapterName;
    merged.shortName = String(merged.shortName || '').trim() || ISSUANCE_BRANDING_DEFAULTS.shortName;
    merged.motto = String(merged.motto || '').trim() || ISSUANCE_BRANDING_DEFAULTS.motto;
    merged.chapterCode = String(merged.chapterCode || '').trim() || ISSUANCE_BRANDING_DEFAULTS.chapterCode;
    merged.location = String(merged.location || '').trim() || ISSUANCE_BRANDING_DEFAULTS.location;
    merged.contactEmail = String(merged.contactEmail || '').trim() || ISSUANCE_BRANDING_DEFAULTS.contactEmail;
    merged.logoUrl = String(merged.logoUrl || '').trim() || ISSUANCE_BRANDING_DEFAULTS.logoUrl;
    merged.themeColor = String(merged.themeColor || '').trim() || ISSUANCE_BRANDING_DEFAULTS.themeColor;
    merged.fullName = merged.orgName + ' - ' + merged.chapterName;
    return merged;
  }

  function getIssuanceBrandingFromSheet_() {
    try {
      var props = PropertiesService.getScriptProperties();
      var settingsId = String(props.getProperty('SYSTEM_SETTINGS_SPREADSHEET_ID') || '').trim();
      if (!settingsId) return null;

      var ss = SpreadsheetApp.openById(settingsId);
      var sheet = ss.getSheetByName(ISSUANCE_BRANDING_SHEET_NAME);
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
      Logger.log('Issuance branding sheet fallback read error: ' + sheetReadError);
      return null;
    }
  }

  function getIssuanceOrgBranding_() {
    var cache = CacheService.getScriptCache();
    try {
      var cachedRaw = cache.get(ISSUANCE_BRANDING_CACHE_KEY);
      if (cachedRaw) {
        return normalizeIssuanceBranding_(JSON.parse(cachedRaw));
      }
    } catch (cacheReadError) {
      Logger.log('Issuance branding cache read error: ' + cacheReadError);
    }

    var branding = normalizeIssuanceBranding_({});
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
            branding = normalizeIssuanceBranding_(parsed.data);
            resolvedFromEndpoint = true;
          }
        }
      }
    } catch (fetchError) {
      Logger.log('Issuance branding fetch error: ' + fetchError);
    }

    if (!resolvedFromEndpoint) {
      var sheetBranding = getIssuanceBrandingFromSheet_();
      if (sheetBranding) {
        branding = normalizeIssuanceBranding_(sheetBranding);
      }
    }

    try {
      cache.put(ISSUANCE_BRANDING_CACHE_KEY, JSON.stringify(branding), ISSUANCE_BRANDING_CACHE_TTL_SECONDS);
    } catch (cacheWriteError) {
      Logger.log('Issuance branding cache write error: ' + cacheWriteError);
    }

    return branding;
  }

  const ISSUANCE_ORG_BRANDING = getIssuanceOrgBranding_();

  const ISSUANCE_CONFIG = {
    SPREADSHEET_ID: '1HUimmBnzy1Rr7Kg-x24iiscKTmqHJdzDoV72N3u4wmE',
    PDF_FOLDER_ID: '1e6g6JLr7y9VcJJ2wQ5jijNu9z6WAmDnt',
    SHEETS: {
      ISSUANCES: 'Issuances',
      TEMPLATES: 'Templates',
      RECIPIENTS: 'Recipients',
      SEND_LOGS: 'SendLogs',
      SETTINGS: 'Settings',
      CONTROL_SEQUENCES: 'ControlNumberSequences',
      CONTROL_TRACKING: 'ControlNumberTracking'
    },
    // Default header style
    HEADER_STYLE: {
      background: '#ee8724', // YSP Orange
      fontColor: '#ffffff',  // White
      fontWeight: 'bold',
      fontSize: 11
    },
    // Branding - Use Imgur URL for email compatibility (same as OTP emails)
    LOGO_URL: ISSUANCE_ORG_BRANDING.logoUrl || 'https://i.imgur.com/J4wddTW.png',
    WEB_APP_URL: 'https://tgm.youthserviceph.org/Home',
    FB_PAGE_URL: 'https://www.facebook.com/YSPTagumChapter'
  };

  // ============================================================================
  // SHEET HEADERS DEFINITIONS
  // ============================================================================

  const SHEET_HEADERS = {
    Issuances: [
      'IssuanceID',
      'Title',
      'TemplateID',
      'TemplateName',
      'Status',           // Draft, Sent, Downloaded, Archived
      'DeliveryMethod',   // 'DownloadOnly' or 'Email' - indicates how issuance was created
      'CreatedBy',
      'CreatedAt',
      'SentAt',
      'SentBy',
      'RecipientType',    // Event, Person, Committee, Directory, External
      'RecipientDetails', // JSON string with recipient info
      'TotalRecipients',
      'SentCount',
      'ResentCount',       // Separate count for resent emails
      'FailedCount',
      'FieldInputs',      // JSON string with field values
      'EmailTitle',
      'EmailMessage',
      'CustomTemplateUrl',
      'Notes',
      'NameAllCaps',       // true/false - whether to convert names to ALL CAPS
      'NameStartPos',      // Start position for name line (in cm)
      'NameEndPos',        // End position for name line (in cm)
      'NamePosUnit',       // Unit for positioning: 'cm' or 'inch'
      'EventID',           // Event ID if recipients are from an event (for control number)
      'EventNumber',       // Event sequence number for the year (XX in control number)
      'ControlNumberPrefix', // Base control number prefix (YSP-YY-TCXX) for this issuance
      'Attachments'        // JSON array of attachment objects [{name, url, type}]
    ],
    Templates: [
      'TemplateID',
      'Name',
      'Description',
      'Type',             // Digital Certificate, Meeting Notice, Notice, Custom
      'DocsUrl',          // Google Docs template URL
      'Fields',           // JSON array of field names like {NAME}, {EVENT}
      'IsDefault',        // true/false - is this the default for its type
      'CreatedBy',
      'CreatedAt',
      'UpdatedAt',
      'Status'            // Active, Archived
    ],
    Recipients: [
      'RecordID',
      'IssuanceID',
      'RecipientName',
      'RecipientEmail',
      'RecipientType',    // Member, External
      'Status',           // Pending, Sent, Failed, Downloaded
      'SentAt',
      'FailedReason',
      'PDFFileId',
      'DownloadedAt',
      'ControlNumber'     // Unique control number: YSP-YY-TCXXYYY
    ],
    SendLogs: [
      'LogID',
      'IssuanceID',
      'RecipientEmail',
      'RecipientName',
      'Action',           // EmailSent, EmailFailed, Downloaded
      'Timestamp',
      'Details',
      'PerformedBy'
    ],
    Settings: [
      'SettingKey',
      'SettingValue',
      'Description',
      'UpdatedAt',
      'UpdatedBy'
    ],
    ControlNumberSequences: [
      'SequenceID',        // Unique ID for the sequence
      'Year',              // 4-digit year (e.g., 2026)
      'EventID',           // Event ID from attendance system
      'EventTitle',        // Event title for reference
      'EventNumber',       // Event sequence number for the year (01, 02, etc.)
      'LastCertNumber',    // Last certificate number issued (001, 002, etc.)
      'ChapterCode',       // Chapter code used (e.g., TC)
      'CreatedAt',
      'UpdatedAt'
    ],
    ControlNumberTracking: [
      'TrackingID',        // Unique tracking ID (TRK-YYYYMMDD-XXXXX)
      'IssuanceID',        // Reference to the issuance
      'IssuanceTitle',     // Title of the issuance
      'EventID',           // Event ID from attendance system
      'EventTitle',        // Event name/title
      'EventNumber',       // Event sequence number (XX in YSP-YY-TCXX)
      'Year',              // Year (YYYY)
      'ControlNumberStart',// First control number in range (e.g., YSP-26-TC01001)
      'ControlNumberEnd',  // Last control number in range (e.g., YSP-26-TC01025)
      'TotalRecipients',   // Number of recipients in this batch
      'Recipients',        // JSON array of recipients [{name, email, controlNumber, status}]
      'TemplateID',        // Template used for the issuance
      'TemplateName',      // Template name for reference
      'DeliveryMethod',    // Email or DownloadOnly
      'CreatedBy',         // Who created this issuance
      'CreatedAt',         // When created
      'SentAt',            // When sent (if email delivery)
      'Status',            // Active, Completed, Voided
      'Notes'              // Any additional notes
    ]
  };

  // Default settings values
  const DEFAULT_SETTINGS = [
    { key: 'DefaultCertificateTemplate', value: '', description: 'Default Google Docs URL for Digital Certificates' },
    { key: 'DefaultMeetingNoticeTemplate', value: '', description: 'Default Google Docs URL for Meeting Notices' },
    { key: 'DefaultNoticeTemplate', value: '', description: 'Default Google Docs URL for General Notices' },
    { key: 'DefaultLetterTemplate', value: '', description: 'Default Google Docs URL for Letters' },
    { key: 'DefaultMemoTemplate', value: '', description: 'Default Google Docs URL for Memos' },
    { key: 'SenderName', value: ISSUANCE_ORG_BRANDING.fullName, description: 'Name shown as email sender' },
    { key: 'SenderEmail', value: '', description: 'Reply-to email address' },
    { key: 'EmailFooter', value: 'This is an automated message from ' + ISSUANCE_ORG_BRANDING.shortName + '. Please do not reply.', description: 'Footer text for all emails' },
    { key: 'ChapterCode', value: ISSUANCE_ORG_BRANDING.chapterCode || 'TC', description: 'Chapter code for control numbers (e.g., TC for your chapter)' }
  ];

  // ============================================================================
  // INITIALIZATION - CREATE SHEETS AND HEADERS
  // ============================================================================

  /**
  * Initialize all required sheets with proper headers and formatting
  * Call this function once to set up the spreadsheet structure
  */
  function initializeIssuanceSheets() {
    const ss = SpreadsheetApp.openById(ISSUANCE_CONFIG.SPREADSHEET_ID);
    const results = [];
    
    // Create each sheet if it doesn't exist
    for (const [sheetName, headers] of Object.entries(SHEET_HEADERS)) {
      try {
        let sheet = ss.getSheetByName(sheetName);
        
        if (!sheet) {
          // Create new sheet
          sheet = ss.insertSheet(sheetName);
          results.push({ sheet: sheetName, action: 'created' });
        } else {
          // Clear existing content but keep the sheet
          sheet.clear();
          results.push({ sheet: sheetName, action: 'reset' });
        }
        
        // Set headers in first row
        const headerRange = sheet.getRange(1, 1, 1, headers.length);
        headerRange.setValues([headers]);
        
        // Apply header styling
        headerRange.setBackground(ISSUANCE_CONFIG.HEADER_STYLE.background);
        headerRange.setFontColor(ISSUANCE_CONFIG.HEADER_STYLE.fontColor);
        headerRange.setFontWeight(ISSUANCE_CONFIG.HEADER_STYLE.fontWeight);
        headerRange.setFontSize(ISSUANCE_CONFIG.HEADER_STYLE.fontSize);
        headerRange.setHorizontalAlignment('center');
        
        // Freeze the header row
        sheet.setFrozenRows(1);
        
        // Auto-resize columns to fit content
        for (let i = 1; i <= headers.length; i++) {
          sheet.autoResizeColumn(i);
        }
        
        // Set minimum column width
        for (let i = 1; i <= headers.length; i++) {
          const currentWidth = sheet.getColumnWidth(i);
          if (currentWidth < 100) {
            sheet.setColumnWidth(i, 100);
          }
        }
        
      } catch (error) {
        results.push({ sheet: sheetName, action: 'error', error: error.toString() });
      }
    }
    
    // Initialize default settings if Settings sheet is empty
    const settingsSheet = ss.getSheetByName(ISSUANCE_CONFIG.SHEETS.SETTINGS);
    if (settingsSheet && settingsSheet.getLastRow() <= 1) {
      const settingsData = DEFAULT_SETTINGS.map(s => [
        s.key,
        s.value,
        s.description,
        new Date().toISOString(),
        'System'
      ]);
      if (settingsData.length > 0) {
        settingsSheet.getRange(2, 1, settingsData.length, 5).setValues(settingsData);
      }
    }
    
    // Initialize default templates
    initializeDefaultTemplates(ss);
    
    return {
      success: true,
      message: 'Issuance sheets initialized successfully',
      results: results
    };
  }

  /**
  * Migration function to fix column alignment in Issuances sheet
  * This adds missing columns (DeliveryMethod, ResentCount) and realigns all data
  * Run this once if your spreadsheet was created before these columns were added
  */
  function migrateIssuanceColumns() {
    const ss = SpreadsheetApp.openById(ISSUANCE_CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(ISSUANCE_CONFIG.SHEETS.ISSUANCES);
    
    if (!sheet) {
      return { success: false, error: 'Issuances sheet not found' };
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length === 0) {
      return { success: false, error: 'Sheet is empty' };
    }
    
    let currentHeaders = data[0];
    const expectedHeaders = SHEET_HEADERS.Issuances;
    
    // Build migration results
    const results = {
      originalHeaders: [...currentHeaders],
      expectedHeaders: expectedHeaders,
      rowsProcessed: 0,
      changes: []
    };
    
    // Check if DeliveryMethod column exists
    const hasDeliveryMethod = currentHeaders.includes('DeliveryMethod');
    
    // If DeliveryMethod is missing, we need to insert it at position 5
    if (!hasDeliveryMethod) {
      results.changes.push('Added DeliveryMethod column at position 6');
      
      // Insert the column after Status (position 5, 0-indexed = column 6)
      sheet.insertColumnAfter(5);
      
      // Set the header
      sheet.getRange(1, 6).setValue('DeliveryMethod');
      
      // For each existing data row, add default DeliveryMethod
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        // Set default value 'Email' for all existing rows (since they were created before this feature)
        for (let i = 2; i <= lastRow; i++) {
          sheet.getRange(i, 6).setValue('Email');
        }
        results.rowsProcessed = lastRow - 1;
      }
      
      // Refresh headers after insertion
      currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    }
    
    // Check if ResentCount column exists
    const hasResentCount = currentHeaders.includes('ResentCount');
    
    // If ResentCount is missing, we need to insert it after SentCount
    if (!hasResentCount) {
      // Find the position of SentCount
      const sentCountIndex = currentHeaders.indexOf('SentCount');
      
      if (sentCountIndex !== -1) {
        const insertAfterCol = sentCountIndex + 1; // 0-indexed to 1-indexed
        
        results.changes.push(`Added ResentCount column at position ${insertAfterCol + 1}`);
        
        // Insert the column after SentCount
        sheet.insertColumnAfter(insertAfterCol);
        
        // Set the header
        sheet.getRange(1, insertAfterCol + 1).setValue('ResentCount');
        
        // For each existing data row, add default ResentCount of 0
        const lastRow = sheet.getLastRow();
        if (lastRow > 1) {
          for (let i = 2; i <= lastRow; i++) {
            sheet.getRange(i, insertAfterCol + 1).setValue(0);
          }
          results.rowsProcessed = Math.max(results.rowsProcessed, lastRow - 1);
        }
      }
    }
    
    // Check if columns are already aligned
    const updatedHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Check for new name formatting columns
    const hasNameAllCaps = updatedHeaders.includes('NameAllCaps');
    const hasNameStartPos = updatedHeaders.includes('NameStartPos');
    const hasNameEndPos = updatedHeaders.includes('NameEndPos');
    const hasNamePosUnit = updatedHeaders.includes('NamePosUnit');
    
    // Add NameAllCaps column if missing (after Notes)
    if (!hasNameAllCaps) {
      const notesIndex = updatedHeaders.indexOf('Notes');
      if (notesIndex !== -1) {
        const insertAfterCol = notesIndex + 1;
        sheet.insertColumnAfter(insertAfterCol);
        sheet.getRange(1, insertAfterCol + 1).setValue('NameAllCaps');
        
        // Set default value 'true' for all existing rows
        const lastRow = sheet.getLastRow();
        if (lastRow > 1) {
          for (let i = 2; i <= lastRow; i++) {
            sheet.getRange(i, insertAfterCol + 1).setValue('true');
          }
        }
        results.changes.push('Added NameAllCaps column');
      }
    }
    
    // Refresh headers
    let refreshedHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Add NameStartPos column if missing
    if (!hasNameStartPos) {
      const allCapsIndex = refreshedHeaders.indexOf('NameAllCaps');
      if (allCapsIndex !== -1) {
        const insertAfterCol = allCapsIndex + 1;
        sheet.insertColumnAfter(insertAfterCol);
        sheet.getRange(1, insertAfterCol + 1).setValue('NameStartPos');
        
        const lastRow = sheet.getLastRow();
        if (lastRow > 1) {
          for (let i = 2; i <= lastRow; i++) {
            sheet.getRange(i, insertAfterCol + 1).setValue('8.1');
          }
        }
        results.changes.push('Added NameStartPos column');
      }
    }
    
    // Refresh headers again
    refreshedHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Add NameEndPos column if missing
    if (!hasNameEndPos) {
      const startPosIndex = refreshedHeaders.indexOf('NameStartPos');
      if (startPosIndex !== -1) {
        const insertAfterCol = startPosIndex + 1;
        sheet.insertColumnAfter(insertAfterCol);
        sheet.getRange(1, insertAfterCol + 1).setValue('NameEndPos');
        
        const lastRow = sheet.getLastRow();
        if (lastRow > 1) {
          for (let i = 2; i <= lastRow; i++) {
            sheet.getRange(i, insertAfterCol + 1).setValue('27.6');
          }
        }
        results.changes.push('Added NameEndPos column');
      }
    }
    
    // Refresh headers again
    refreshedHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Add NamePosUnit column if missing
    if (!hasNamePosUnit) {
      const endPosIndex = refreshedHeaders.indexOf('NameEndPos');
      if (endPosIndex !== -1) {
        const insertAfterCol = endPosIndex + 1;
        sheet.insertColumnAfter(insertAfterCol);
        sheet.getRange(1, insertAfterCol + 1).setValue('NamePosUnit');
        
        const lastRow = sheet.getLastRow();
        if (lastRow > 1) {
          for (let i = 2; i <= lastRow; i++) {
            sheet.getRange(i, insertAfterCol + 1).setValue('cm');
          }
        }
        results.changes.push('Added NamePosUnit column');
      }
    }
    
    // Refresh headers again
    refreshedHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Check if Attachments column exists
    const hasAttachments = refreshedHeaders.includes('Attachments');
    
    // Add Attachments column if missing (should be at the end after ControlNumberPrefix)
    if (!hasAttachments) {
      const controlPrefixIndex = refreshedHeaders.indexOf('ControlNumberPrefix');
      if (controlPrefixIndex !== -1) {
        const insertAfterCol = controlPrefixIndex + 1;
        sheet.insertColumnAfter(insertAfterCol);
        sheet.getRange(1, insertAfterCol + 1).setValue('Attachments');
        
        // Set default empty array for all existing rows
        const lastRow = sheet.getLastRow();
        if (lastRow > 1) {
          for (let i = 2; i <= lastRow; i++) {
            sheet.getRange(i, insertAfterCol + 1).setValue('[]');
          }
        }
        results.changes.push('Added Attachments column');
      } else {
        // If ControlNumberPrefix doesn't exist, add Attachments at the very end
        const lastCol = sheet.getLastColumn();
        sheet.getRange(1, lastCol + 1).setValue('Attachments');
        
        const lastRow = sheet.getLastRow();
        if (lastRow > 1) {
          for (let i = 2; i <= lastRow; i++) {
            sheet.getRange(i, lastCol + 1).setValue('[]');
          }
        }
        results.changes.push('Added Attachments column at end');
      }
    }
    
    // Refresh headers one more time
    refreshedHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    if (results.changes.length === 0 && refreshedHeaders.length === expectedHeaders.length) {
      return { success: true, message: 'Columns already aligned correctly', noChanges: true };
    }
    
    // Update headers to match expected
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    
    // Apply header styling
    const headerRange = sheet.getRange(1, 1, 1, expectedHeaders.length);
    headerRange.setBackground(ISSUANCE_CONFIG.HEADER_STYLE.background);
    headerRange.setFontColor(ISSUANCE_CONFIG.HEADER_STYLE.fontColor);
    headerRange.setFontWeight(ISSUANCE_CONFIG.HEADER_STYLE.fontWeight);
    headerRange.setFontSize(ISSUANCE_CONFIG.HEADER_STYLE.fontSize);
    headerRange.setHorizontalAlignment('center');
    
    results.changes.push('Updated headers to expected format');
    results.newHeaders = expectedHeaders;
    
    return {
      success: true,
      message: 'Migration completed successfully',
      results: results
    };
  }

  /**
  * Initialize default template types
  */
  function initializeDefaultTemplates(ss) {
    const templatesSheet = ss.getSheetByName(ISSUANCE_CONFIG.SHEETS.TEMPLATES);
    if (!templatesSheet || templatesSheet.getLastRow() > 1) return;
    
    const defaultTemplates = [
      {
        name: 'Digital Certificate - Event Participation',
        description: 'Certificate for event participation and attendance',
        type: 'Digital Certificate',
        fields: JSON.stringify(['{NAME}', '{EVENT}', '{DATE}', '{POSITION}', '{CONTROL_NUMBER}']),
        isDefault: true
      },
      {
        name: 'Meeting Notice',
        description: 'Official meeting notification',
        type: 'Meeting Notice',
        fields: JSON.stringify(['{NAME}', '{MEETING_TITLE}', '{DATE}', '{TIME}', '{VENUE}', '{AGENDA}']),
        isDefault: true
      },
      {
        name: 'General Notice',
        description: 'General announcement or notice',
        type: 'Notice',
        fields: JSON.stringify(['{NAME}', '{SUBJECT}', '{MESSAGE}', '{DATE}']),
        isDefault: true
      },
      {
        name: 'Official Letter',
        description: 'Formal letter template',
        type: 'Letter',
        fields: JSON.stringify(['{NAME}', '{SALUTATION}', '{BODY}', '{DATE}', '{SIGNATORY}']),
        isDefault: true
      },
      {
        name: 'Internal Memo',
        description: 'Internal memorandum template',
        type: 'Memo',
        fields: JSON.stringify(['{TO}', '{FROM}', '{SUBJECT}', '{DATE}', '{MESSAGE}']),
        isDefault: true
      }
    ];
    
    const templateData = defaultTemplates.map((t, i) => [
      `TMPL-${String(i + 1).padStart(4, '0')}`,
      t.name,
      t.description,
      t.type,
      '', // DocsUrl - to be filled by admin
      t.fields,
      t.isDefault,
      'System',
      new Date().toISOString(),
      new Date().toISOString(),
      'Active'
    ]);
    
    templatesSheet.getRange(2, 1, templateData.length, 11).setValues(templateData);
  }

  // ============================================================================
  // ROLE-BASED ACCESS CONTROL
  // ============================================================================

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

  // ============================================================================
  // MAIN ENTRY POINT - doGet / doPost
  // ============================================================================

  /**
  * Handle GET requests
  */
  function doGet(e) {
    const params = e.parameter || {};
    const action = params.action;
    
    try {
      // ---- Session token verification (HMAC) ----
      var tokenUser = verifyHmacToken_(params.sessionToken);
      var sessionSecret = PropertiesService.getScriptProperties().getProperty('SESSION_SECRET_KEY');
      if (!sessionSecret) {
        return jsonResponse({ success: false, error: 'Server auth misconfigured: SESSION_SECRET_KEY is missing', code: 503 });
      }
      if (!tokenUser) {
        return jsonResponse({ success: false, error: 'Invalid or expired session token', code: 401 });
      }
      params.username = tokenUser.username;

      switch (action) {
        case 'init': {
          var initUser = params.username || '';
          var initAuth = requireAdminOrAuditor_(initUser, 'initialize sheets');
          if (initAuth) return jsonResponse(initAuth);
          return jsonResponse(initializeIssuanceSheets());
        }
        
        case 'migrateColumns': {
          var migrateUser = params.username || '';
          var migrateAuth = requireAdminOrAuditor_(migrateUser, 'migrate columns');
          if (migrateAuth) return jsonResponse(migrateAuth);
          return jsonResponse(migrateIssuanceColumns());
        }
        
        case 'getIssuances':
          return jsonResponse(getIssuances(params));
        
        case 'getIssuancesByRecipient':
          return jsonResponse(getIssuancesByRecipient(params.email, params.name));
        
        case 'getIssuance':
          return jsonResponse(getIssuanceById(params.id));
        
        case 'getTemplates':
          return jsonResponse(getTemplates(params));
        
        case 'getTemplate':
          return jsonResponse(getTemplateById(params.id));
        
        case 'getSettings':
          return jsonResponse(getSettings());
        
        case 'getRecipients':
          return jsonResponse(getRecipientsByIssuance(params.issuanceId));
        
        case 'getSendLogs':
          return jsonResponse(getSendLogs(params));
        
        case 'getEventAttendees':
          return jsonResponse(getEventAttendees(params.eventId));
        
        case 'getMembers':
          return jsonResponse(getAllMembers());
        
        case 'getCommittees':
          return jsonResponse(getCommittees());
        
        case 'getControlNumberInfo':
          return jsonResponse(getControlNumberInfo(params.issuanceId));
        
        case 'getEventDetails':
          return jsonResponse(getEventDetails(params.eventId));
        
        case 'previewControlNumber':
          // Preview what control number would be assigned for an event
          return jsonResponse(previewControlNumberForEvent(params.eventId, params.eventTitle));
        
        // Control Number Tracking endpoints
        case 'getControlNumberTracking':
          return jsonResponse(getControlNumberTracking({
            year: params.year ? parseInt(params.year) : null,
            eventId: params.eventId || null,
            status: params.status || null,
            issuanceId: params.issuanceId || null
          }));
        
        case 'getControlNumberSummary':
          return jsonResponse(getControlNumberSummary(
            params.year ? parseInt(params.year) : null
          ));
        
        case 'findAvailableEventNumbers':
          return jsonResponse(findAvailableEventNumbers(
            params.year ? parseInt(params.year) : new Date().getFullYear()
          ));
        
        default:
          return jsonResponse({ error: 'Invalid action', action: action });
      }
    } catch (error) {
      return jsonResponse({ error: error.toString() });
    }
  }

  /**
  * Handle POST requests
  */
  function doPost(e) {
    try {
      const data = JSON.parse(e.postData.contents);
      const action = data.action;

      // ---- Role check: all write operations require admin or auditor ----
      const authError = requireAdminOrAuditor_(data.username, action || 'manage issuances');
      if (authError) return jsonResponse(authError);

      // ---- API key validation ----
      if (!validateApiKey_(data.key)) {
        return jsonResponse({ success: false, error: 'Invalid or missing API key', code: 401 });
      }

      // ---- Session token verification (HMAC) ----
      var tokenUser = verifyHmacToken_(data.sessionToken);
      var sessionSecret = PropertiesService.getScriptProperties().getProperty('SESSION_SECRET_KEY');
      if (!sessionSecret) {
        return jsonResponse({ success: false, error: 'Server auth misconfigured: SESSION_SECRET_KEY is missing', code: 503 });
      }
      if (!tokenUser) {
        return jsonResponse({ success: false, error: 'Invalid or expired session token', code: 401 });
      }
      data.username = tokenUser.username;
      
      switch (action) {
        case 'createIssuance':
          return jsonResponse(createIssuance(data));
        
        case 'updateIssuance':
          return jsonResponse(updateIssuance(data));
        
        case 'deleteIssuance':
          return jsonResponse(deleteIssuance(data.id));
        
        case 'permanentDeleteIssuance':
          return jsonResponse(permanentDeleteIssuance(data.id));
        
        case 'createTemplate':
          return jsonResponse(createTemplate(data));
        
        case 'updateTemplate':
          return jsonResponse(updateTemplate(data));
        
        case 'deleteTemplate':
          return jsonResponse(deleteTemplate(data.id));
        
        case 'updateSetting':
          return jsonResponse(updateSetting(data));
        
        case 'sendIssuance':
          return jsonResponse(sendIssuance(data));
        
        case 'publishIssuance':
          return jsonResponse(publishIssuance(data));
        
        case 'cancelSending':
          return jsonResponse(cancelSending(data));
        
        case 'resendToRecipient':
          return jsonResponse(resendToRecipient(data));
        
        case 'generatePdf':
          return jsonResponse(generateSinglePdf(data));
        
        case 'downloadIssuance':
          return jsonResponse(downloadIssuance(data));
        
        // Control Number Tracking - void a tracking record
        case 'voidControlNumberTracking':
          return jsonResponse(voidControlNumberTracking(data.trackingId, data.voidReason));
        
        default:
          return jsonResponse({ error: 'Invalid action', action: action });
      }
    } catch (error) {
      return jsonResponse({ error: error.toString() });
    }
  }

  /**
  * JSON response helper with success wrapper
  */
  function jsonResponse(data) {
    // Ensure data has success property if not already an error
    const responseData = data.error ? data : { success: true, ...data };
    return ContentService
      .createTextOutput(JSON.stringify(responseData))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ============================================================================
  // ISSUANCE CRUD OPERATIONS
  // ============================================================================

  /**
  * Get all issuances with optional filters
  */
  function getIssuances(params) {
    const ss = SpreadsheetApp.openById(ISSUANCE_CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(ISSUANCE_CONFIG.SHEETS.ISSUANCES);
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return { success: true, data: [] };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    
    let issuances = rows.map(row => {
      const obj = {};
      headers.forEach((header, i) => {
        obj[header] = row[i];
      });
      return obj;
    });
    
    // Apply filters
    if (params.status) {
      issuances = issuances.filter(i => i.Status === params.status);
    }
    
    if (params.search) {
      const search = params.search.toLowerCase();
      issuances = issuances.filter(i => 
        i.Title.toLowerCase().includes(search) ||
        i.TemplateName.toLowerCase().includes(search)
      );
    }
    
    // Sort by CreatedAt descending
    issuances.sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt));
    
    return { success: true, data: issuances };
  }

  /**
  * Get issuances for a specific recipient (member view)
  * Matches by email OR name for comprehensive results
  * This ensures heads, members, and other roles below auditor/admin can see their issuances
  */
  function getIssuancesByRecipient(email, name) {
    const ss = SpreadsheetApp.openById(ISSUANCE_CONFIG.SPREADSHEET_ID);
    const recipientsSheet = ss.getSheetByName(ISSUANCE_CONFIG.SHEETS.RECIPIENTS);
    const issuancesSheet = ss.getSheetByName(ISSUANCE_CONFIG.SHEETS.ISSUANCES);
    
    if (!recipientsSheet || recipientsSheet.getLastRow() <= 1) {
      return { success: true, data: [] };
    }
    
    // Get all recipients for this email or name
    const recipientsData = recipientsSheet.getDataRange().getValues();
    const recipientHeaders = recipientsData[0];
    const recipientRows = recipientsData.slice(1);
    
    const emailLower = email ? email.toLowerCase().trim() : '';
    const nameLower = name ? name.toLowerCase().trim() : '';
    const issuanceIds = new Set();
    
    recipientRows.forEach(row => {
      const obj = {};
      recipientHeaders.forEach((header, i) => {
        obj[header] = row[i];
      });
      
      // Match by email (exact match, case-insensitive)
      const recipientEmailLower = obj.RecipientEmail ? obj.RecipientEmail.toLowerCase().trim() : '';
      const emailMatches = emailLower && recipientEmailLower === emailLower;
      
      // Match by name (case-insensitive, handles variations)
      const recipientNameLower = obj.RecipientName ? obj.RecipientName.toLowerCase().trim() : '';
      const nameMatches = nameLower && recipientNameLower === nameLower;
      
      if (emailMatches || nameMatches) {
        issuanceIds.add(obj.IssuanceID);
      }
    });
    
    if (issuanceIds.size === 0) {
      return { success: true, data: [] };
    }
    
    // Get the corresponding issuances
    const issuancesData = issuancesSheet.getDataRange().getValues();
    const issuanceHeaders = issuancesData[0];
    const issuanceRows = issuancesData.slice(1);
    
    const issuances = [];
    issuanceRows.forEach(row => {
      const obj = {};
      issuanceHeaders.forEach((header, i) => {
        obj[header] = row[i];
      });
      // Only show Sent issuances to members (hide Draft and Archived)
      // Drafts should only be visible to Admin and Auditor roles
      if (issuanceIds.has(obj.IssuanceID) && obj.Status === 'Sent') {
        issuances.push(obj);
      }
    });
    
    // Sort by CreatedAt descending
    issuances.sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt));
    
    return { success: true, data: issuances };
  }

  /**
  * Get single issuance by ID
  */
  function getIssuanceById(id) {
    const ss = SpreadsheetApp.openById(ISSUANCE_CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(ISSUANCE_CONFIG.SHEETS.ISSUANCES);
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return { success: false, error: 'Issuance not found' };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    
    for (const row of rows) {
      if (row[0] === id) {
        const issuance = {};
        headers.forEach((header, i) => {
          issuance[header] = row[i];
        });
        
        // Get recipients for this issuance
        const recipients = getRecipientsByIssuance(id);
        issuance.Recipients = recipients.data || [];
        
        return { success: true, data: issuance };
      }
    }
    
    return { success: false, error: 'Issuance not found' };
  }

  /**
  * Create new issuance
  * If downloadOnly is true, marks status as 'Sent' (issued) instead of 'Draft'
  * If eventId is provided, generates control numbers for recipients
  */
  function createIssuance(data) {
    const ss = SpreadsheetApp.openById(ISSUANCE_CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(ISSUANCE_CONFIG.SHEETS.ISSUANCES);
    
    // Generate unique ID
    const id = `ISS-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    
    const now = new Date().toISOString();
    
    // All issuances start as Draft - user must manually publish/send
    const initialStatus = 'Draft';
    const sentAt = '';
    const sentBy = '';
    
    // Delivery method: 'DownloadOnly' or 'Email'
    const deliveryMethod = data.downloadOnly ? 'DownloadOnly' : 'Email';
    
    // Handle event-based control numbers
    let eventId = data.eventId || '';
    let eventNumber = '';
    let controlNumberPrefix = '';
    let eventTitle = data.eventTitle || '';
    
    // If eventId is provided (from @event command or event recipient selection), generate control number prefix
    if (eventId) {
      // Get event details if title not provided
      if (!eventTitle) {
        const eventResult = getEventDetails(eventId);
        if (eventResult.success && eventResult.data) {
          eventTitle = eventResult.data.Title || '';
        }
      }
      
      // Generate the control number prefix for this event
      const prefixResult = generateControlNumberPrefix(eventId, eventTitle);
      controlNumberPrefix = prefixResult.prefix;
      eventNumber = prefixResult.eventNumber;
    }
    
    const row = [
      id,
      data.title || '',
      data.templateId || '',
      data.templateName || '',
      initialStatus,
      deliveryMethod, // DeliveryMethod column
      data.createdBy || '',
      now,
      sentAt, // SentAt - set when published/sent
      sentBy, // SentBy - set when published/sent
      data.recipientType || '',
      JSON.stringify(data.recipientDetails || []),
      data.totalRecipients || 0,
      0, // SentCount - starts at 0, updated when published/sent
      0, // ResentCount - starts at 0, incremented when resending
      0, // FailedCount
      JSON.stringify(data.fieldInputs || {}),
      data.emailTitle || '',
      data.emailMessage || '',
      data.customTemplateUrl || '',
      data.notes || '',
      // Name formatting columns - support both naming conventions
      (data.nameAllCaps !== undefined ? String(data.nameAllCaps) : 
       (data.NameAllCaps !== undefined ? String(data.NameAllCaps) : 'true')), // NameAllCaps - default true
      (data.nameStartPos || data.nameStartPosition || '8.1'),  // NameStartPos - default 8.1cm
      (data.nameEndPos || data.nameEndPosition || '27.6'),   // NameEndPos - default 27.6cm
      (data.namePosUnit || data.namePositionUnit || 'cm'),    // NamePosUnit - default cm
      eventId, // EventID - set if linking to an event
      eventNumber, // EventNumber - sequence number for the year
      controlNumberPrefix, // ControlNumberPrefix - e.g., YSP-26-TC01
      JSON.stringify(data.attachments || []) // Attachments - array of {name, url, type}
    ];
    
    sheet.appendRow(row);
    
    // Add recipients to Recipients sheet - all start as Pending
    // If event is provided, generate control numbers for each recipient
    if (data.recipients && data.recipients.length > 0) {
      const controlNumberData = eventId ? {
        eventId: eventId,
        eventTitle: eventTitle,
        issuanceInfo: {
          issuanceId: id,
          title: data.title || '',
          templateId: data.templateId || '',
          templateName: data.templateName || '',
          deliveryMethod: deliveryMethod,
          createdBy: data.createdBy || ''
        }
      } : null;
      addRecipients(id, data.recipients, false, controlNumberData);
    }
    
    return { 
      success: true, 
      id: id,
      message: 'Issuance created successfully',
      eventId: eventId,
      eventNumber: eventNumber,
      controlNumberPrefix: controlNumberPrefix
    };
  }

  /**
  * Update existing issuance
  */
  function updateIssuance(data) {
    const ss = SpreadsheetApp.openById(ISSUANCE_CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(ISSUANCE_CONFIG.SHEETS.ISSUANCES);
    
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    const headers = values[0];
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === data.id) {
        // Update fields
        const colMap = {};
        headers.forEach((h, idx) => colMap[h] = idx);
        
        // Support both lowercase (old) and PascalCase (new) field names
        if (data.title || data.Title) values[i][colMap['Title']] = data.title || data.Title;
        if (data.status || data.Status) values[i][colMap['Status']] = data.status || data.Status;
        if (data.emailTitle || data.EmailTitle) values[i][colMap['EmailTitle']] = data.emailTitle || data.EmailTitle;
        if (data.emailMessage || data.EmailMessage) values[i][colMap['EmailMessage']] = data.emailMessage || data.EmailMessage;
        
        // Handle fieldInputs - can be object or string
        if (data.fieldInputs || data.FieldInputs) {
          const fieldData = data.fieldInputs || data.FieldInputs;
          values[i][colMap['FieldInputs']] = typeof fieldData === 'string' ? fieldData : JSON.stringify(fieldData);
        }
        
        if (data.customTemplateUrl !== undefined || data.CustomTemplateUrl !== undefined) {
          values[i][colMap['CustomTemplateUrl']] = data.customTemplateUrl ?? data.CustomTemplateUrl ?? '';
        }
        if (data.notes !== undefined || data.Notes !== undefined) {
          values[i][colMap['Notes']] = data.notes ?? data.Notes ?? '';
        }
        
        // Support template updates for draft editing
        if (data.templateId || data.TemplateID) values[i][colMap['TemplateID']] = data.templateId || data.TemplateID;
        if (data.templateName || data.TemplateName) values[i][colMap['TemplateName']] = data.templateName || data.TemplateName;
        
        // Support recipient updates for draft editing
        if (data.recipientType || data.RecipientType) values[i][colMap['RecipientType']] = data.recipientType || data.RecipientType;
        if (data.recipientDetails || data.RecipientDetails) {
          const recipientData = data.recipientDetails || data.RecipientDetails;
          values[i][colMap['RecipientDetails']] = typeof recipientData === 'string' ? recipientData : JSON.stringify(recipientData);
        }
        if (data.totalRecipients !== undefined || data.TotalRecipients !== undefined) {
          values[i][colMap['TotalRecipients']] = data.totalRecipients ?? data.TotalRecipients;
        }
        
        // Support delivery method update
        if (data.deliveryMethod || data.DeliveryMethod) {
          values[i][colMap['DeliveryMethod']] = data.deliveryMethod || data.DeliveryMethod;
        }
        
        // Name formatting columns - support both naming conventions
        if (data.nameAllCaps !== undefined || data.NameAllCaps !== undefined) {
          values[i][colMap['NameAllCaps']] = String(data.nameAllCaps ?? data.NameAllCaps);
        }
        if (data.nameStartPos !== undefined || data.nameStartPosition !== undefined || data.NameStartPos !== undefined) {
          values[i][colMap['NameStartPos']] = data.nameStartPos ?? data.nameStartPosition ?? data.NameStartPos;
        }
        if (data.nameEndPos !== undefined || data.nameEndPosition !== undefined || data.NameEndPos !== undefined) {
          values[i][colMap['NameEndPos']] = data.nameEndPos ?? data.nameEndPosition ?? data.NameEndPos;
        }
        if (data.namePosUnit !== undefined || data.namePositionUnit !== undefined || data.NamePosUnit !== undefined) {
          values[i][colMap['NamePosUnit']] = data.namePosUnit ?? data.namePositionUnit ?? data.NamePosUnit;
        }
        
        // Sending-related fields
        if (data.sentAt) values[i][colMap['SentAt']] = data.sentAt;
        if (data.sentBy) values[i][colMap['SentBy']] = data.sentBy;
        if (data.sentCount !== undefined) values[i][colMap['SentCount']] = data.sentCount;
        if (data.resentCount !== undefined) values[i][colMap['ResentCount']] = data.resentCount;
        if (data.failedCount !== undefined) values[i][colMap['FailedCount']] = data.failedCount;
        
        // Attachments - array of {name, url, type} objects
        if (data.attachments !== undefined || data.Attachments !== undefined) {
          const attachmentsData = data.attachments ?? data.Attachments;
          values[i][colMap['Attachments']] = typeof attachmentsData === 'string' 
            ? attachmentsData 
            : JSON.stringify(attachmentsData || []);
        }
        
        dataRange.setValues(values);
        return { success: true, message: 'Issuance updated successfully' };
      }
    }
    
    return { success: false, error: 'Issuance not found' };
  }

  /**
  * Delete issuance (soft delete - change status to Archived)
  */
  function deleteIssuance(id) {
    return updateIssuance({ id: id, status: 'Archived' });
  }

  /**
  * Permanently delete issuance (hard delete - removes from spreadsheet)
  */
  function permanentDeleteIssuance(id) {
    const ss = SpreadsheetApp.openById(ISSUANCE_CONFIG.SPREADSHEET_ID);
    
    // Delete from Issuances sheet
    const issuancesSheet = ss.getSheetByName(ISSUANCE_CONFIG.SHEETS.ISSUANCES);
    if (issuancesSheet && issuancesSheet.getLastRow() > 1) {
      const data = issuancesSheet.getDataRange().getValues();
      for (let i = data.length - 1; i >= 1; i--) {
        if (data[i][0] === id) {
          issuancesSheet.deleteRow(i + 1);
          break;
        }
      }
    }
    
    // Delete associated recipients
    const recipientsSheet = ss.getSheetByName(ISSUANCE_CONFIG.SHEETS.RECIPIENTS);
    if (recipientsSheet && recipientsSheet.getLastRow() > 1) {
      const recipientsData = recipientsSheet.getDataRange().getValues();
      // Delete from bottom to top to avoid row index issues
      for (let i = recipientsData.length - 1; i >= 1; i--) {
        if (recipientsData[i][1] === id) { // IssuanceID is at index 1
          recipientsSheet.deleteRow(i + 1);
        }
      }
    }
    
    // Delete associated send logs
    const logsSheet = ss.getSheetByName(ISSUANCE_CONFIG.SHEETS.SEND_LOGS);
    if (logsSheet && logsSheet.getLastRow() > 1) {
      const logsData = logsSheet.getDataRange().getValues();
      for (let i = logsData.length - 1; i >= 1; i--) {
        if (logsData[i][1] === id) { // IssuanceID is at index 1
          logsSheet.deleteRow(i + 1);
        }
      }
    }
    
    return { success: true, message: 'Issuance permanently deleted' };
  }

  // ============================================================================
  // TEMPLATE CRUD OPERATIONS
  // ============================================================================

  /**
  * Get all templates
  */
  function getTemplates(params) {
    const ss = SpreadsheetApp.openById(ISSUANCE_CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(ISSUANCE_CONFIG.SHEETS.TEMPLATES);
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return { success: true, data: [] };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    
    let templates = rows.map(row => {
      const obj = {};
      headers.forEach((header, i) => {
        obj[header] = row[i];
      });
      // Parse fields JSON
      try {
        obj.FieldsParsed = JSON.parse(obj.Fields || '[]');
      } catch (e) {
        obj.FieldsParsed = [];
      }
      return obj;
    });
    
    // Filter active templates only by default
    if (!params || params.includeArchived !== 'true') {
      templates = templates.filter(t => t.Status === 'Active');
    }
    
    // Filter by type if specified
    if (params && params.type) {
      templates = templates.filter(t => t.Type === params.type);
    }
    
    return { success: true, data: templates };
  }

  /**
  * Get single template by ID
  */
  function getTemplateById(id) {
    const ss = SpreadsheetApp.openById(ISSUANCE_CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(ISSUANCE_CONFIG.SHEETS.TEMPLATES);
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return { success: false, error: 'Template not found' };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        const template = {};
        headers.forEach((h, idx) => {
          template[h] = data[i][idx];
        });
        try {
          template.FieldsParsed = JSON.parse(template.Fields || '[]');
        } catch (e) {
          template.FieldsParsed = [];
        }
        return { success: true, data: template };
      }
    }
    
    return { success: false, error: 'Template not found' };
  }

  /**
  * Create new template
  */
  function createTemplate(data) {
    const ss = SpreadsheetApp.openById(ISSUANCE_CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(ISSUANCE_CONFIG.SHEETS.TEMPLATES);
    
    const id = `TMPL-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    const now = new Date().toISOString();
    
    const row = [
      id,
      data.name || '',
      data.description || '',
      data.type || 'Custom',
      data.docsUrl || '',
      JSON.stringify(data.fields || []),
      data.isDefault || false,
      data.createdBy || '',
      now,
      now,
      'Active'
    ];
    
    sheet.appendRow(row);
    
    return { 
      success: true, 
      id: id,
      message: 'Template created successfully' 
    };
  }

  /**
  * Update existing template
  */
  function updateTemplate(data) {
    const ss = SpreadsheetApp.openById(ISSUANCE_CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(ISSUANCE_CONFIG.SHEETS.TEMPLATES);
    
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    const headers = values[0];
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === data.id) {
        const colMap = {};
        headers.forEach((h, idx) => colMap[h] = idx);
        
        if (data.name) values[i][colMap['Name']] = data.name;
        if (data.description !== undefined) values[i][colMap['Description']] = data.description;
        if (data.type) values[i][colMap['Type']] = data.type;
        if (data.docsUrl !== undefined) values[i][colMap['DocsUrl']] = data.docsUrl;
        if (data.fields) values[i][colMap['Fields']] = JSON.stringify(data.fields);
        if (data.isDefault !== undefined) values[i][colMap['IsDefault']] = data.isDefault;
        if (data.status) values[i][colMap['Status']] = data.status;
        values[i][colMap['UpdatedAt']] = new Date().toISOString();
        
        dataRange.setValues(values);
        return { success: true, message: 'Template updated successfully' };
      }
    }
    
    return { success: false, error: 'Template not found' };
  }

  /**
  * Delete template (soft delete)
  */
  function deleteTemplate(id) {
    return updateTemplate({ id: id, status: 'Archived' });
  }

  // ============================================================================
  // CONTROL NUMBER SYSTEM
  // ============================================================================

  /**
  * Get or create the ControlNumberSequences sheet
  */
  function getControlSequencesSheet() {
    const ss = SpreadsheetApp.openById(ISSUANCE_CONFIG.SPREADSHEET_ID);
    let sheet = ss.getSheetByName(ISSUANCE_CONFIG.SHEETS.CONTROL_SEQUENCES);
    
    if (!sheet) {
      // Create the sheet with headers
      sheet = ss.insertSheet(ISSUANCE_CONFIG.SHEETS.CONTROL_SEQUENCES);
      const headers = SHEET_HEADERS.ControlNumberSequences;
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      
      // Apply header styling
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground(ISSUANCE_CONFIG.HEADER_STYLE.background);
      headerRange.setFontColor(ISSUANCE_CONFIG.HEADER_STYLE.fontColor);
      headerRange.setFontWeight(ISSUANCE_CONFIG.HEADER_STYLE.fontWeight);
      headerRange.setFontSize(ISSUANCE_CONFIG.HEADER_STYLE.fontSize);
      headerRange.setHorizontalAlignment('center');
      sheet.setFrozenRows(1);
    }
    
    return sheet;
  }

  /**
  * Get or create the ControlNumberTracking sheet
  */
  function getControlTrackingSheet() {
    const ss = SpreadsheetApp.openById(ISSUANCE_CONFIG.SPREADSHEET_ID);
    let sheet = ss.getSheetByName(ISSUANCE_CONFIG.SHEETS.CONTROL_TRACKING);
    
    if (!sheet) {
      // Create the sheet with headers
      sheet = ss.insertSheet(ISSUANCE_CONFIG.SHEETS.CONTROL_TRACKING);
      const headers = SHEET_HEADERS.ControlNumberTracking;
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      
      // Apply header styling
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground(ISSUANCE_CONFIG.HEADER_STYLE.background);
      headerRange.setFontColor(ISSUANCE_CONFIG.HEADER_STYLE.fontColor);
      headerRange.setFontWeight(ISSUANCE_CONFIG.HEADER_STYLE.fontWeight);
      headerRange.setFontSize(ISSUANCE_CONFIG.HEADER_STYLE.fontSize);
      headerRange.setHorizontalAlignment('center');
      sheet.setFrozenRows(1);
    }
    
    return sheet;
  }

  /**
  * Generate unique tracking ID
  * Format: TRK-YYYYMMDD-XXXXX (random alphanumeric)
  */
  function generateTrackingId() {
    const now = new Date();
    const dateStr = now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    return 'TRK-' + dateStr + '-' + random;
  }

  /**
  * Log control number tracking data when control numbers are generated
  * @param {Object} trackingData - The tracking information
  */
  function logControlNumberTracking(trackingData) {
    try {
      const sheet = getControlTrackingSheet();
      const headers = SHEET_HEADERS.ControlNumberTracking;
      
      const trackingId = generateTrackingId();
      const now = new Date().toISOString();
      
      // Prepare row data in header order
      const rowData = headers.map(header => {
        switch (header) {
          case 'TrackingID':
            return trackingId;
          case 'IssuanceID':
            return trackingData.issuanceId || '';
          case 'IssuanceTitle':
            return trackingData.issuanceTitle || '';
          case 'EventID':
            return trackingData.eventId || '';
          case 'EventTitle':
            return trackingData.eventTitle || '';
          case 'EventNumber':
            return trackingData.eventNumber || '';
          case 'Year':
            return trackingData.year || new Date().getFullYear();
          case 'ControlNumberStart':
            return trackingData.controlNumberStart || '';
          case 'ControlNumberEnd':
            return trackingData.controlNumberEnd || '';
          case 'TotalRecipients':
            return trackingData.totalRecipients || 0;
          case 'Recipients':
            // Store as JSON string
            return JSON.stringify(trackingData.recipients || []);
          case 'TemplateID':
            return trackingData.templateId || '';
          case 'TemplateName':
            return trackingData.templateName || '';
          case 'DeliveryMethod':
            return trackingData.deliveryMethod || '';
          case 'CreatedBy':
            return trackingData.createdBy || '';
          case 'CreatedAt':
            return now;
          case 'SentAt':
            return trackingData.sentAt || '';
          case 'Status':
            return trackingData.status || 'Active';
          case 'Notes':
            return trackingData.notes || '';
          default:
            return '';
        }
      });
      
      sheet.appendRow(rowData);
      
      return {
        success: true,
        trackingId: trackingId
      };
    } catch (e) {
      console.error('Error logging control number tracking:', e);
      return {
        success: false,
        error: e.toString()
      };
    }
  }

  /**
  * Get all control number tracking records
  * @param {Object} filters - Optional filters (year, eventId, status)
  */
  function getControlNumberTracking(filters = {}) {
    try {
      const sheet = getControlTrackingSheet();
      
      if (sheet.getLastRow() <= 1) {
        return { success: true, data: [] };
      }
      
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      
      const records = [];
      for (let i = 1; i < data.length; i++) {
        const record = {};
        headers.forEach((header, idx) => {
          let value = data[i][idx];
          // Parse Recipients JSON
          if (header === 'Recipients' && value) {
            try {
              value = JSON.parse(value);
            } catch (e) {
              value = [];
            }
          }
          record[header] = value;
        });
        
        // Apply filters
        let include = true;
        if (filters.year && record.Year !== filters.year) include = false;
        if (filters.eventId && record.EventID !== filters.eventId) include = false;
        if (filters.status && record.Status !== filters.status) include = false;
        if (filters.issuanceId && record.IssuanceID !== filters.issuanceId) include = false;
        
        if (include) {
          records.push(record);
        }
      }
      
      // Sort by CreatedAt descending (newest first)
      records.sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt));
      
      return { success: true, data: records };
    } catch (e) {
      console.error('Error getting control number tracking:', e);
      return { success: false, error: e.toString() };
    }
  }

  /**
  * Find available (unused) event numbers for a year
  * This helps handle non-chronological event IDs by reusing gaps
  */
  function findAvailableEventNumbers(year) {
    try {
      const sheet = getControlSequencesSheet();
      
      if (sheet.getLastRow() <= 1) {
        return { success: true, data: { usedNumbers: [], nextAvailable: 1, gaps: [] } };
      }
      
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      
      const yearIdx = headers.indexOf('Year');
      const eventNumIdx = headers.indexOf('EventNumber');
      const lastCertIdx = headers.indexOf('LastCertNumber');
      
      // Get all event numbers for this year with their usage status
      const eventNumbers = [];
      for (let i = 1; i < data.length; i++) {
        if (data[i][yearIdx] === year) {
          eventNumbers.push({
            number: parseInt(data[i][eventNumIdx]) || 0,
            lastCert: parseInt(data[i][lastCertIdx]) || 0,
            isEmpty: (parseInt(data[i][lastCertIdx]) || 0) === 0
          });
        }
      }
      
      // Sort by event number
      eventNumbers.sort((a, b) => a.number - b.number);
      
      // Find gaps (unused numbers) - only event numbers with no certificates
      const gaps = eventNumbers.filter(en => en.isEmpty).map(en => en.number);
      
      // Find max used number
      const maxNumber = eventNumbers.length > 0 ? 
        Math.max(...eventNumbers.map(en => en.number)) : 0;
      
      return {
        success: true,
        data: {
          usedNumbers: eventNumbers.map(en => en.number),
          nextAvailable: maxNumber + 1,
          gaps: gaps,
          // Suggest reusing first gap if any, otherwise use next available
          suggestedNext: gaps.length > 0 ? gaps[0] : maxNumber + 1
        }
      };
    } catch (e) {
      console.error('Error finding available event numbers:', e);
      return { success: false, error: e.toString() };
    }
  }

  /**
  * Void/cancel a control number tracking record
  * This marks the record as voided so control numbers can be recycled if needed
  */
  function voidControlNumberTracking(trackingId, voidReason) {
    try {
      const sheet = getControlTrackingSheet();
      
      if (sheet.getLastRow() <= 1) {
        return { success: false, error: 'No tracking records found' };
      }
      
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      
      const trackingIdIdx = headers.indexOf('TrackingID');
      const statusIdx = headers.indexOf('Status');
      const notesIdx = headers.indexOf('Notes');
      
      for (let i = 1; i < data.length; i++) {
        if (data[i][trackingIdIdx] === trackingId) {
          // Update status to Voided
          sheet.getRange(i + 1, statusIdx + 1).setValue('Voided');
          // Add void reason to notes
          const existingNotes = data[i][notesIdx] || '';
          const newNotes = existingNotes + 
            (existingNotes ? ' | ' : '') + 
            'VOIDED on ' + new Date().toISOString() + ': ' + (voidReason || 'No reason provided');
          sheet.getRange(i + 1, notesIdx + 1).setValue(newNotes);
          
          return { success: true, message: 'Tracking record voided successfully' };
        }
      }
      
      return { success: false, error: 'Tracking record not found' };
    } catch (e) {
      console.error('Error voiding control number tracking:', e);
      return { success: false, error: e.toString() };
    }
  }

  /**
  * Get summary of control numbers by year
  * Returns event-wise breakdown with control number ranges
  */
  function getControlNumberSummary(year) {
    try {
      const currentYear = year || new Date().getFullYear();
      
      // Get from sequences sheet
      const seqSheet = getControlSequencesSheet();
      const trackSheet = getControlTrackingSheet();
      
      const summary = {
        year: currentYear,
        totalEvents: 0,
        totalCertificates: 0,
        events: []
      };
      
      if (seqSheet.getLastRow() <= 1) {
        return { success: true, data: summary };
      }
      
      const seqData = seqSheet.getDataRange().getValues();
      const seqHeaders = seqData[0];
      
      const yearIdx = seqHeaders.indexOf('Year');
      const eventIdIdx = seqHeaders.indexOf('EventID');
      const eventTitleIdx = seqHeaders.indexOf('EventTitle');
      const eventNumIdx = seqHeaders.indexOf('EventNumber');
      const lastCertIdx = seqHeaders.indexOf('LastCertNumber');
      const chapterCodeIdx = seqHeaders.indexOf('ChapterCode');
      
      for (let i = 1; i < seqData.length; i++) {
        if (seqData[i][yearIdx] === currentYear) {
          const eventNumber = seqData[i][eventNumIdx];
          const lastCert = seqData[i][lastCertIdx] || 0;
          const chapterCode = seqData[i][chapterCodeIdx] || 'TC';
          const yearShort = String(currentYear).slice(-2);
          const eventNum = String(eventNumber).padStart(2, '0');
          
          const prefix = 'YSP-' + yearShort + '-' + chapterCode + eventNum;
          
          summary.events.push({
            eventId: seqData[i][eventIdIdx],
            eventTitle: seqData[i][eventTitleIdx],
            eventNumber: eventNumber,
            totalCertificates: lastCert,
            controlNumberPrefix: prefix,
            controlNumberRange: lastCert > 0 ? 
              prefix + '001 - ' + prefix + String(lastCert).padStart(3, '0') : 
              'No certificates issued'
          });
          
          summary.totalEvents++;
          summary.totalCertificates += lastCert;
        }
      }
      
      // Sort by event number
      summary.events.sort((a, b) => a.eventNumber - b.eventNumber);
      
      return { success: true, data: summary };
    } catch (e) {
      console.error('Error getting control number summary:', e);
      return { success: false, error: e.toString() };
    }
  }

  /**
  * Get the chapter code from settings
  */
  function getChapterCode() {
    const settingsResult = getSettings();
    const settings = settingsResult.data || {};
    return settings.ChapterCode?.value || 'TC';
  }

  /**
  * Get or create event sequence for a given year and event
  * Returns { eventNumber, lastCertNumber, sequenceId }
  */
  function getOrCreateEventSequence(eventId, eventTitle, year) {
    const sheet = getControlSequencesSheet();
    const chapterCode = getChapterCode();
    
    if (sheet.getLastRow() <= 1) {
      // No sequences yet, create first one
      return createEventSequence(sheet, eventId, eventTitle, year, chapterCode, 1);
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // Find column indices
    const yearIdx = headers.indexOf('Year');
    const eventIdIdx = headers.indexOf('EventID');
    const eventNumIdx = headers.indexOf('EventNumber');
    const lastCertIdx = headers.indexOf('LastCertNumber');
    const seqIdIdx = headers.indexOf('SequenceID');
    
    // Look for existing sequence for this event and year
    for (let i = 1; i < data.length; i++) {
      if (data[i][yearIdx] === year && data[i][eventIdIdx] === eventId) {
        return {
          sequenceId: data[i][seqIdIdx],
          eventNumber: data[i][eventNumIdx],
          lastCertNumber: data[i][lastCertIdx] || 0,
          rowIndex: i + 1 // 1-based row for updates
        };
      }
    }
    
    // No sequence found, find the next event number for this year
    let maxEventNumber = 0;
    for (let i = 1; i < data.length; i++) {
      if (data[i][yearIdx] === year) {
        const eventNum = parseInt(data[i][eventNumIdx]) || 0;
        if (eventNum > maxEventNumber) {
          maxEventNumber = eventNum;
        }
      }
    }
    
    // Create new sequence with next event number
    return createEventSequence(sheet, eventId, eventTitle, year, chapterCode, maxEventNumber + 1);
  }

  /**
  * Create a new event sequence record
  */
  function createEventSequence(sheet, eventId, eventTitle, year, chapterCode, eventNumber) {
    const sequenceId = `SEQ-${year}-${String(eventNumber).padStart(2, '0')}`;
    const now = new Date().toISOString();
    
    const row = [
      sequenceId,
      year,
      eventId,
      eventTitle || '',
      eventNumber,
      0, // LastCertNumber starts at 0
      chapterCode,
      now,
      now
    ];
    
    sheet.appendRow(row);
    
    return {
      sequenceId: sequenceId,
      eventNumber: eventNumber,
      lastCertNumber: 0,
      rowIndex: sheet.getLastRow()
    };
  }

  /**
  * Increment the certificate number for an event sequence and return the new number
  */
  function incrementCertNumber(sequenceRowIndex) {
    const sheet = getControlSequencesSheet();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const lastCertIdx = headers.indexOf('LastCertNumber');
    const updatedAtIdx = headers.indexOf('UpdatedAt');
    
    // Get current value
    const currentValue = sheet.getRange(sequenceRowIndex, lastCertIdx + 1).getValue() || 0;
    const newValue = parseInt(currentValue) + 1;
    
    // Update the cell
    sheet.getRange(sequenceRowIndex, lastCertIdx + 1).setValue(newValue);
    sheet.getRange(sequenceRowIndex, updatedAtIdx + 1).setValue(new Date().toISOString());
    
    return newValue;
  }

  /**
  * Generate control number for a certificate
  * Format: YSP-YY-TCXXYYY
  * - YSP: Organization prefix
  * - YY: 2-digit year
  * - TC: Chapter code
  * - XX: Event number (2 digits)
  * - YYY: Certificate number (3 digits)
  */
  function generateControlNumber(eventId, eventTitle, existingSequence = null) {
    const currentYear = new Date().getFullYear();
    const yearShort = String(currentYear).slice(-2);
    
    // Get or create the event sequence
    let sequence;
    if (existingSequence && existingSequence.rowIndex) {
      sequence = existingSequence;
    } else {
      sequence = getOrCreateEventSequence(eventId, eventTitle, currentYear);
    }
    
    // Increment and get the new certificate number
    const certNumber = incrementCertNumber(sequence.rowIndex);
    
    const chapterCode = getChapterCode();
    const eventNum = String(sequence.eventNumber).padStart(2, '0');
    const certNum = String(certNumber).padStart(3, '0');
    
    return {
      controlNumber: `YSP-${yearShort}-${chapterCode}${eventNum}${certNum}`,
      eventNumber: sequence.eventNumber,
      certNumber: certNumber,
      sequence: sequence
    };
  }

  /**
  * Generate control number prefix for an issuance (without the certificate number)
  * Format: YSP-YY-TCXX
  */
  function generateControlNumberPrefix(eventId, eventTitle) {
    const currentYear = new Date().getFullYear();
    const yearShort = String(currentYear).slice(-2);
    
    // Get or create the event sequence (don't increment cert number here)
    const sequence = getOrCreateEventSequence(eventId, eventTitle, currentYear);
    
    const chapterCode = getChapterCode();
    const eventNum = String(sequence.eventNumber).padStart(2, '0');
    
    return {
      prefix: `YSP-${yearShort}-${chapterCode}${eventNum}`,
      eventNumber: sequence.eventNumber,
      sequence: sequence
    };
  }

  /**
  * Batch generate control numbers for multiple recipients
  * More efficient than calling generateControlNumber repeatedly
  * @param {string} eventId - The event ID
  * @param {string} eventTitle - The event title
  * @param {number} recipientCount - Number of recipients
  * @param {Array} recipients - Optional array of recipient details for tracking
  * @param {Object} issuanceInfo - Optional issuance info for tracking
  */
  function batchGenerateControlNumbers(eventId, eventTitle, recipientCount, recipients, issuanceInfo) {
    const currentYear = new Date().getFullYear();
    const yearShort = String(currentYear).slice(-2);
    
    // Get or create the event sequence
    const sequence = getOrCreateEventSequence(eventId, eventTitle, currentYear);
    
    const sheet = getControlSequencesSheet();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const lastCertIdx = headers.indexOf('LastCertNumber');
    const updatedAtIdx = headers.indexOf('UpdatedAt');
    
    // Get current value and calculate new range
    const startCertNumber = (parseInt(sheet.getRange(sequence.rowIndex, lastCertIdx + 1).getValue()) || 0) + 1;
    const endCertNumber = startCertNumber + recipientCount - 1;
    
    // Update the last cert number to the end value
    sheet.getRange(sequence.rowIndex, lastCertIdx + 1).setValue(endCertNumber);
    sheet.getRange(sequence.rowIndex, updatedAtIdx + 1).setValue(new Date().toISOString());
    
    const chapterCode = getChapterCode();
    const eventNum = String(sequence.eventNumber).padStart(2, '0');
    const prefix = 'YSP-' + yearShort + '-' + chapterCode + eventNum;
    
    // Generate array of control numbers
    const controlNumbers = [];
    for (let i = 0; i < recipientCount; i++) {
      const certNum = String(startCertNumber + i).padStart(3, '0');
      controlNumbers.push(prefix + certNum);
    }
    
    // Full control number range for tracking
    const controlNumberStart = prefix + String(startCertNumber).padStart(3, '0');
    const controlNumberEnd = prefix + String(endCertNumber).padStart(3, '0');
    
    // Log to tracking sheet if recipients info is provided
    if (recipients && recipients.length > 0 && issuanceInfo) {
      const trackingRecipients = recipients.map((r, idx) => ({
        name: r.name || r.recipientName || '',
        email: r.email || r.recipientEmail || '',
        controlNumber: controlNumbers[idx] || '',
        status: 'Pending'
      }));
      
      logControlNumberTracking({
        issuanceId: issuanceInfo.issuanceId || '',
        issuanceTitle: issuanceInfo.title || '',
        eventId: eventId,
        eventTitle: eventTitle,
        eventNumber: sequence.eventNumber,
        year: currentYear,
        controlNumberStart: controlNumberStart,
        controlNumberEnd: controlNumberEnd,
        totalRecipients: recipientCount,
        recipients: trackingRecipients,
        templateId: issuanceInfo.templateId || '',
        templateName: issuanceInfo.templateName || '',
        deliveryMethod: issuanceInfo.deliveryMethod || '',
        createdBy: issuanceInfo.createdBy || '',
        status: 'Active'
      });
    }
    
    return {
      prefix: prefix,
      controlNumbers: controlNumbers,
      eventNumber: sequence.eventNumber,
      startCertNumber: startCertNumber,
      endCertNumber: endCertNumber,
      controlNumberStart: controlNumberStart,
      controlNumberEnd: controlNumberEnd
    };
  }

  /**
  * Get event details from the Attendance system
  */
  function getEventDetails(eventId) {
    try {
      const ATTENDANCE_SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('EVENTS_SPREADSHEET_ID') || '';
      
      const ss = SpreadsheetApp.openById(ATTENDANCE_SPREADSHEET_ID);
      const eventsSheet = ss.getSheetByName('Events');
      
      if (!eventsSheet || eventsSheet.getLastRow() < 2) {
        return { success: false, error: 'No events found' };
      }
      
      const data = eventsSheet.getDataRange().getValues();
      const headers = data[0];
      
      const eventIdIdx = headers.indexOf('EventID');
      const titleIdx = headers.indexOf('Title');
      
      for (let i = 1; i < data.length; i++) {
        if (data[i][eventIdIdx] === eventId) {
          const event = {};
          headers.forEach((h, idx) => {
            event[h] = data[i][idx];
          });
          return { success: true, data: event };
        }
      }
      
      return { success: false, error: 'Event not found' };
    } catch (e) {
      return { success: false, error: e.toString() };
    }
  }

  /**
  * Get control number info for an issuance (to show in preview)
  */
  function getControlNumberInfo(issuanceId) {
    const issuanceResult = getIssuanceById(issuanceId);
    if (!issuanceResult.success) {
      return { success: false, error: 'Issuance not found' };
    }
    
    const issuance = issuanceResult.data;
    const eventId = issuance.EventID;
    
    if (!eventId) {
      return { success: false, error: 'This issuance is not linked to an event' };
    }
    
    const recipientsResult = getRecipientsByIssuance(issuanceId);
    const recipients = recipientsResult.data || [];
    
    return {
      success: true,
      prefix: issuance.ControlNumberPrefix || '',
      eventNumber: issuance.EventNumber || '',
      totalRecipients: recipients.length,
      recipientsWithControlNumbers: recipients.filter(r => r.ControlNumber).length,
      recipients: recipients.map(r => ({
        name: r.RecipientName,
        controlNumber: r.ControlNumber
      }))
    };
  }

  /**
  * Preview control number format for an event (without actually creating it)
  * Useful for showing users what control numbers will look like before creating issuance
  */
  function previewControlNumberForEvent(eventId, eventTitle) {
    if (!eventId) {
      return { success: false, error: 'Event ID is required' };
    }
    
    const currentYear = new Date().getFullYear();
    const yearShort = String(currentYear).slice(-2);
    const chapterCode = getChapterCode();
    
    // Check if this event already has a sequence
    const sheet = getControlSequencesSheet();
    let eventNumber = null;
    let lastCertNumber = 0;
    let isExistingSequence = false;
    
    if (sheet.getLastRow() > 1) {
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      
      const yearIdx = headers.indexOf('Year');
      const eventIdIdx = headers.indexOf('EventID');
      const eventNumIdx = headers.indexOf('EventNumber');
      const lastCertIdx = headers.indexOf('LastCertNumber');
      
      // Look for existing sequence
      for (let i = 1; i < data.length; i++) {
        if (data[i][yearIdx] === currentYear && data[i][eventIdIdx] === eventId) {
          eventNumber = data[i][eventNumIdx];
          lastCertNumber = data[i][lastCertIdx] || 0;
          isExistingSequence = true;
          break;
        }
      }
      
      // If no sequence for this event, find the next event number
      if (eventNumber === null) {
        let maxEventNumber = 0;
        for (let i = 1; i < data.length; i++) {
          if (data[i][yearIdx] === currentYear) {
            const eventNum = parseInt(data[i][eventNumIdx]) || 0;
            if (eventNum > maxEventNumber) {
              maxEventNumber = eventNum;
            }
          }
        }
        eventNumber = maxEventNumber + 1;
      }
    } else {
      // No sequences yet, this would be event #1
      eventNumber = 1;
    }
    
    const eventNum = String(eventNumber).padStart(2, '0');
    const prefix = `YSP-${yearShort}-${chapterCode}${eventNum}`;
    
    // Get event details if title not provided
    let resolvedTitle = eventTitle;
    if (!resolvedTitle) {
      const eventResult = getEventDetails(eventId);
      if (eventResult.success && eventResult.data) {
        resolvedTitle = eventResult.data.Title || '';
      }
    }
    
    // Example control numbers
    const nextCertNum = lastCertNumber + 1;
    const exampleNumbers = [];
    for (let i = 0; i < 3; i++) {
      const certNum = String(nextCertNum + i).padStart(3, '0');
      exampleNumbers.push(`${prefix}${certNum}`);
    }
    
    return {
      success: true,
      eventId: eventId,
      eventTitle: resolvedTitle,
      year: currentYear,
      chapterCode: chapterCode,
      eventNumber: eventNumber,
      prefix: prefix,
      isExistingSequence: isExistingSequence,
      lastCertNumber: lastCertNumber,
      nextCertNumber: nextCertNum,
      exampleNumbers: exampleNumbers,
      format: 'YSP-YY-TCXXYYY',
      formatExplanation: {
        YSP: 'Organization prefix',
        YY: `Year (${yearShort})`,
        TC: `Chapter code (${chapterCode})`,
        XX: `Event number (${eventNum})`,
        YYY: 'Certificate number (001, 002, etc.)'
      }
    };
  }

  // ============================================================================
  // RECIPIENT OPERATIONS
  // ============================================================================

  /**
  * Add recipients for an issuance
  * @param {string} issuanceId - The issuance ID
  * @param {Array} recipients - Array of recipient objects
  * @param {boolean} isDownloadOnly - If true, mark recipients as Sent/Downloaded status
  * @param {Object} controlNumberData - Optional: { eventId, eventTitle, issuanceInfo } for control number generation and tracking
  */
  function addRecipients(issuanceId, recipients, isDownloadOnly = false, controlNumberData = null) {
    const ss = SpreadsheetApp.openById(ISSUANCE_CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(ISSUANCE_CONFIG.SHEETS.RECIPIENTS);
    
    const now = new Date().toISOString();
    
    // Generate control numbers if event data is provided
    let controlNumbers = [];
    if (controlNumberData && controlNumberData.eventId) {
      // Prepare issuance info for tracking
      const issuanceInfo = controlNumberData.issuanceInfo || {
        issuanceId: issuanceId,
        title: controlNumberData.issuanceTitle || '',
        templateId: controlNumberData.templateId || '',
        templateName: controlNumberData.templateName || '',
        deliveryMethod: isDownloadOnly ? 'DownloadOnly' : 'Email',
        createdBy: controlNumberData.createdBy || ''
      };
      
      const batchResult = batchGenerateControlNumbers(
        controlNumberData.eventId,
        controlNumberData.eventTitle || '',
        recipients.length,
        recipients, // Pass recipients for tracking
        issuanceInfo // Pass issuance info for tracking
      );
      controlNumbers = batchResult.controlNumbers;
    }
    
    const rows = recipients.map((r, i) => [
      `RCP-${issuanceId}-${i + 1}`,
      issuanceId,
      r.name || '',
      r.email || '',
      r.type || 'Member',
      isDownloadOnly ? 'Sent' : 'Pending', // Mark as Sent if downloadOnly
      isDownloadOnly ? now : '', // SentAt - set if downloadOnly
      '', // FailedReason
      '', // PDFFileId
      '',  // DownloadedAt
      controlNumbers[i] || r.controlNumber || '' // ControlNumber
    ]);
    
    if (rows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 11).setValues(rows);
    }
    
    return { success: true, count: rows.length, controlNumbers: controlNumbers };
  }

  /**
  * Get recipients by issuance ID
  */
  function getRecipientsByIssuance(issuanceId) {
    const ss = SpreadsheetApp.openById(ISSUANCE_CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(ISSUANCE_CONFIG.SHEETS.RECIPIENTS);
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return { success: true, data: [] };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    
    const recipients = rows
      .filter(row => row[1] === issuanceId)
      .map(row => {
        const obj = {};
        headers.forEach((h, i) => {
          obj[h] = row[i];
        });
        return obj;
      });
    
    return { success: true, data: recipients };
  }

  /**
  * Update recipient status
  */
  function updateRecipientStatus(recordId, status, details = {}) {
    const ss = SpreadsheetApp.openById(ISSUANCE_CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(ISSUANCE_CONFIG.SHEETS.RECIPIENTS);
    
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    const headers = values[0];
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === recordId) {
        const colMap = {};
        headers.forEach((h, idx) => colMap[h] = idx);
        
        values[i][colMap['Status']] = status;
        if (status === 'Sent') {
          values[i][colMap['SentAt']] = new Date().toISOString();
        }
        if (status === 'Failed' && details.reason) {
          values[i][colMap['FailedReason']] = details.reason;
        }
        if (details.pdfFileId) {
          values[i][colMap['PDFFileId']] = details.pdfFileId;
        }
        if (status === 'Downloaded') {
          values[i][colMap['DownloadedAt']] = new Date().toISOString();
        }
        
        dataRange.setValues(values);
        return { success: true };
      }
    }
    
    return { success: false, error: 'Recipient not found' };
  }

  // ============================================================================
  // SETTINGS OPERATIONS
  // ============================================================================

  /**
  * Get all settings
  */
  function getSettings() {
    const ss = SpreadsheetApp.openById(ISSUANCE_CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(ISSUANCE_CONFIG.SHEETS.SETTINGS);
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return { success: true, data: {} };
    }
    
    const data = sheet.getDataRange().getValues();
    const settings = {};
    
    for (let i = 1; i < data.length; i++) {
      settings[data[i][0]] = {
        value: data[i][1],
        description: data[i][2],
        updatedAt: data[i][3],
        updatedBy: data[i][4]
      };
    }
    
    return { success: true, data: settings };
  }

  /**
  * Update a setting
  */
  function updateSetting(data) {
    const ss = SpreadsheetApp.openById(ISSUANCE_CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(ISSUANCE_CONFIG.SHEETS.SETTINGS);
    
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === data.key) {
        values[i][1] = data.value;
        values[i][3] = new Date().toISOString();
        values[i][4] = data.updatedBy || '';
        dataRange.setValues(values);
        return { success: true, message: 'Setting updated' };
      }
    }
    
    // Add new setting if not found
    sheet.appendRow([
      data.key,
      data.value,
      data.description || '',
      new Date().toISOString(),
      data.updatedBy || ''
    ]);
    
    return { success: true, message: 'Setting added' };
  }

  // ============================================================================
  // PDF GENERATION
  // ============================================================================

  /**
  * Adjust font size for name to fit on one line within specified boundaries
  * This ensures consistent formatting regardless of name length
  * @param {Body} body - The document body
  * @param {string} name - The name text to format
  * @param {Object} positioning - Optional positioning config { start: cm, end: cm, unit: 'cm'|'inch' }
  */
  function adjustNameFormatting(body, name, positioning = null, doc = null) {
    // Find the name text in the document
    const searchResult = body.findText(name);
    if (!searchResult) return;
    
    const element = searchResult.getElement();
    const startOffset = searchResult.getStartOffset();
    const endOffset = searchResult.getEndOffsetInclusive();
    
    // Get the text element
    const textElement = element.asText();
    
    // Positioning defines the horizontal boundaries for the name on the certificate
    // These are absolute positions from the left edge where the name should be centered within
    // e.g., start=8.1cm, end=27.6cm means the name should be centered within that area
    let startCm = 8.1;  // Left boundary in cm from left edge
    let endCm = 27.6;   // Right boundary in cm from left edge
    
    if (positioning) {
      startCm = positioning.start || 8.1;
      endCm = positioning.end || 27.6;
      
      // Convert from inches to cm if needed
      if (positioning.unit === 'inch') {
        startCm = startCm * 2.54;
        endCm = endCm * 2.54;
      }
    }
    
    // Calculate available width for the name (the boundary width)
    const widthCm = endCm - startCm;
    const availableWidthPts = widthCm * 28.35; // 1 cm = 28.35 points
    
    // Get current font size (or default to 28)
    let currentSize = textElement.getFontSize(startOffset);
    if (!currentSize || currentSize < 10) currentSize = 28;
    
    // Calculate name width more accurately
    // Use a conservative character width factor to ensure single line
    const nameLength = name.length;
    const charWidthFactor = 0.65; // Conservative estimate for font width
    const safetyMargin = 0.85; // Use only 85% of available width to guarantee single line
    const effectiveWidth = availableWidthPts * safetyMargin;
    
    // Calculate the font size needed to fit the name on one line
    const estimatedTextWidth = nameLength * currentSize * charWidthFactor;
    
    let newSize = currentSize;
    if (estimatedTextWidth > effectiveWidth) {
      // Calculate required font size to fit on one line
      newSize = effectiveWidth / (nameLength * charWidthFactor);
      newSize = Math.max(10, Math.floor(newSize)); // Min 10pt, round down to be safe
    }
    
    // Apply the new font size
    textElement.setFontSize(startOffset, endOffset, newSize);
    
    // Just center align the paragraph - don't use indentation as it can cause wrapping issues
    // The name will be centered on the page, which should align with your measured boundaries
    // if the template is designed with the {NAME} placeholder in the right location
    const paragraph = element.getParent();
    if (paragraph && paragraph.getType() === DocumentApp.ElementType.PARAGRAPH) {
      const para = paragraph.asParagraph();
      
      // Ensure no indentation that could cause wrapping
      para.setIndentStart(0);
      para.setIndentEnd(0);
      para.setIndentFirstLine(0);
      
      // Center align the text
      para.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    }
  }

  /**
  * Generate PDF from Google Docs template
  */
  function generatePdfFromTemplate(templateDocsUrl, fieldValues, recipientName) {
    try {
      // Extract Doc ID from URL
      const docIdMatch = templateDocsUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (!docIdMatch) {
        return { success: false, error: 'Invalid Google Docs URL' };
      }
      const templateDocId = docIdMatch[1];
      
      // Create a copy of the template
      const templateDoc = DriveApp.getFileById(templateDocId);
      const folder = DriveApp.getFolderById(ISSUANCE_CONFIG.PDF_FOLDER_ID);
      const copyName = `${recipientName}_${Date.now()}`;
      const copy = templateDoc.makeCopy(copyName, folder);
      
      // Open the copy and replace placeholders
      const doc = DocumentApp.openById(copy.getId());
      const body = doc.getBody();
      
      // Get header and footer sections (they are separate from the body)
      const header = doc.getHeader();
      const footer = doc.getFooter();
      
      // Store the name value before replacement for formatting
      const nameValue = fieldValues['{NAME}'] || recipientName || '';
      
      // Extract name positioning config from fieldValues
      const namePositioning = {
        start: parseFloat(fieldValues['{NAME}_START']) || 8.1,
        end: parseFloat(fieldValues['{NAME}_END']) || 27.6,
        unit: fieldValues['{NAME}_UNIT'] || 'cm'
      };
      
      // Helper function to replace text in a section (body, header, or footer)
      const replaceInSection = (section, placeholder, value) => {
        if (!section) return;
        const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        section.replaceText(escapedPlaceholder, value || '');
      };
      
      // Replace all field placeholders (excluding metadata fields)
      // Replace in BODY, HEADER, and FOOTER
      for (const [placeholder, value] of Object.entries(fieldValues)) {
        // Skip metadata fields
        if (placeholder.startsWith('{NAME}_')) continue;
        if (placeholder.startsWith('{CONTROL_NUMBER}_')) continue;
        
        // Replace in body
        replaceInSection(body, placeholder, value);
        
        // Replace in header (where {CONTROL_NUMBER} typically is)
        replaceInSection(header, placeholder, value);
        
        // Replace in footer
        replaceInSection(footer, placeholder, value);
      }
      
      // Apply smart formatting to the name to ensure it fits on one line within boundaries
      if (nameValue) {
        adjustNameFormatting(body, nameValue, namePositioning, doc);
      }
      
      doc.saveAndClose();
      
      // Convert to PDF
      const pdfBlob = copy.getAs('application/pdf');
      pdfBlob.setName(`${recipientName}_Certificate.pdf`);
      
      // Save PDF to folder
      const pdfFile = folder.createFile(pdfBlob);
      
      // Delete the temporary Doc copy
      copy.setTrashed(true);
      
      return {
        success: true,
        pdfFileId: pdfFile.getId(),
        pdfUrl: pdfFile.getUrl(),
        pdfBlob: pdfBlob
      };
    } catch (error) {
      return { success: false, error: error.toString() };
    }
  }

  /**
  * Generate single PDF for preview
  * Returns base64 encoded data for direct display in frontend
  * Supports multiple recipients for combined preview
  * If previewAsImage is true, returns PNG instead of PDF for faster local preview
  */
  function generateSinglePdf(data) {
    // If multiple recipients provided, generate combined preview
    if (data.recipients && data.recipients.length > 1) {
      return generateCombinedPreviewPdf(data);
    }
    
    // Single recipient preview
    const result = generatePdfFromTemplate(
      data.templateUrl,
      data.fieldValues,
      data.recipientName || 'Preview'
    );
    
    if (result.success) {
      try {
        // Get the PDF file and convert to base64
        const pdfFile = DriveApp.getFileById(result.pdfFileId);
        const pdfBlob = pdfFile.getBlob();
        const base64Data = Utilities.base64Encode(pdfBlob.getBytes());
        
        // Delete the temporary PDF from Drive (we're returning the data directly)
        pdfFile.setTrashed(true);
        
        return {
          success: true,
          pdfBase64: base64Data,
          pdfFileId: result.pdfFileId,
          fileName: `${data.recipientName || 'Preview'}_Certificate.pdf`,
          pageCount: 1
        };
      } catch (e) {
        // Fallback: return the drive URL if base64 conversion fails
        return {
          success: true,
          pdfUrl: `https://drive.google.com/file/d/${result.pdfFileId}/preview`,
          pdfFileId: result.pdfFileId
        };
      }
    }
    
    return result;
  }

  /**
  * Generate combined multi-page PDF preview for all recipients
  * Returns array of base64 PDFs for frontend to display with pagination
  */
  function generateCombinedPreviewPdf(data) {
    try {
      const folder = DriveApp.getFolderById(ISSUANCE_CONFIG.PDF_FOLDER_ID);
      const pdfDataArray = [];
      const tempFiles = [];
      
      // Check if a custom name override was provided (applies to ALL recipients)
      const hasCustomNameOverride = data.customNameOverride && data.customNameOverride.trim() !== '';
      
      // Check for ALL CAPS setting - passed from frontend via data.useAllCaps
      const useAllCaps = data.useAllCaps === true || data.useAllCaps === 'true';
      
      // Get name positioning settings
      const namePositioning = {
        start: parseFloat(data.nameStartPosition) || 8.1,
        end: parseFloat(data.nameEndPosition) || 27.6,
        unit: data.namePositionUnit || 'cm'
      };
      
      // Generate PDF for each recipient
      for (const recipient of data.recipients) {
        // Prepare field values for this recipient
        const recipientFieldValues = { ...data.fieldValues };
        
        // Add positioning metadata
        recipientFieldValues['{NAME}_START'] = String(namePositioning.start);
        recipientFieldValues['{NAME}_END'] = String(namePositioning.end);
        recipientFieldValues['{NAME}_UNIT'] = namePositioning.unit;
        
        // Get display name - apply ALL CAPS if enabled
        let displayName = recipient.name;
        if (useAllCaps) {
          displayName = displayName.toUpperCase();
        }
        
        // Use custom name override if provided, otherwise use each recipient's own name
        if (hasCustomNameOverride) {
          let customName = data.customNameOverride.trim();
          if (useAllCaps) {
            customName = customName.toUpperCase();
          }
          recipientFieldValues['{NAME}'] = customName;
        } else {
          // Always use the recipient's name for multi-recipient previews (not custom name mode)
          recipientFieldValues['{NAME}'] = displayName;
        }
        
        // Handle control number for preview:
        // 1. If recipient has a controlNumber property (passed from frontend), use it
        // 2. If fieldValues has a valid custom control number (not a placeholder), use that
        // 3. Otherwise, use sample format for preview
        if (recipient.controlNumber && recipient.controlNumber.trim && recipient.controlNumber.trim() !== '') {
          recipientFieldValues['{CONTROL_NUMBER}'] = recipient.controlNumber;
        } else {
          const existingControlNumber = data.fieldValues['{CONTROL_NUMBER}'];
          if (existingControlNumber && 
              existingControlNumber.trim() !== '' && 
              !existingControlNumber.includes('XX') && 
              !existingControlNumber.includes('[{')) {
            // Use the custom control number from fieldValues
            recipientFieldValues['{CONTROL_NUMBER}'] = existingControlNumber;
          } else {
            // For preview without control numbers, show sample format
            recipientFieldValues['{CONTROL_NUMBER}'] = 'YSP-XX-TCXXYYY';
          }
        }
        
        const result = generatePdfFromTemplate(
          data.templateUrl,
          recipientFieldValues,
          displayName
        );
        
        if (result.success) {
          // Convert to base64 immediately
          const pdfFile = DriveApp.getFileById(result.pdfFileId);
          const pdfBlob = pdfFile.getBlob();
          const base64Data = Utilities.base64Encode(pdfBlob.getBytes());
          
          pdfDataArray.push({
            recipientName: recipient.name,
            pdfBase64: base64Data
          });
          
          tempFiles.push(result.pdfFileId);
        }
      }
      
      if (pdfDataArray.length === 0) {
        return { success: false, error: 'Failed to generate any PDFs' };
      }
      
      // Clean up temporary files
      for (const fileId of tempFiles) {
        try {
          DriveApp.getFileById(fileId).setTrashed(true);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      
      // Return all PDFs as an array for frontend pagination
      // Also return the first PDF as primary for backwards compatibility
      return {
        success: true,
        pdfBase64: pdfDataArray[0].pdfBase64, // First PDF for backwards compat
        pdfPreviews: pdfDataArray, // All PDFs with recipient names
        fileName: `Preview_${data.recipients.length}_Recipients.pdf`,
        pageCount: pdfDataArray.length
      };
    } catch (error) {
      return { success: false, error: error.toString() };
    }
  }

  // Note: PDF merging removed - frontend now handles pagination through individual previews

  // ============================================================================
  // EMAIL SENDING
  // ============================================================================

  /**
  * Cancel sending for a specific issuance
  * Sets a flag in Settings that sendIssuance checks between each recipient
  */
  function cancelSending(data) {
    const { issuanceId } = data;
    if (!issuanceId) {
      return { success: false, error: 'Missing issuanceId' };
    }
    
    const ss = SpreadsheetApp.openById(ISSUANCE_CONFIG.SPREADSHEET_ID);
    const settingsSheet = ss.getSheetByName(ISSUANCE_CONFIG.SHEETS.SETTINGS);
    
    if (!settingsSheet) {
      return { success: false, error: 'Settings sheet not found' };
    }
    
    // Set cancel flag with issuance ID and timestamp
    const cancelKey = `CANCEL_SEND_${issuanceId}`;
    const data2 = settingsSheet.getDataRange().getValues();
    const headers = data2[0];
    const keyCol = headers.indexOf('SettingKey');
    const valCol = headers.indexOf('SettingValue');
    
    // Check if flag already exists
    let found = false;
    for (let i = 1; i < data2.length; i++) {
      if (data2[i][keyCol] === cancelKey) {
        settingsSheet.getRange(i + 1, valCol + 1).setValue('true');
        settingsSheet.getRange(i + 1, headers.indexOf('UpdatedAt') + 1).setValue(new Date().toISOString());
        found = true;
        break;
      }
    }
    
    // If not found, add new row
    if (!found) {
      const newRow = [cancelKey, 'true', 'Cancel flag for sending issuance', new Date().toISOString()];
      settingsSheet.appendRow(newRow);
    }
    
    return { success: true, message: 'Sending cancel flag set' };
  }

  /**
  * Check if sending has been cancelled for a specific issuance
  */
  function isSendingCancelled(issuanceId) {
    const ss = SpreadsheetApp.openById(ISSUANCE_CONFIG.SPREADSHEET_ID);
    const settingsSheet = ss.getSheetByName(ISSUANCE_CONFIG.SHEETS.SETTINGS);
    
    if (!settingsSheet) return false;
    
    const cancelKey = `CANCEL_SEND_${issuanceId}`;
    const data = settingsSheet.getDataRange().getValues();
    const headers = data[0];
    const keyCol = headers.indexOf('SettingKey');
    const valCol = headers.indexOf('SettingValue');
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][keyCol] === cancelKey && data[i][valCol] === 'true') {
        return true;
      }
    }
    
    return false;
  }

  /**
  * Clear the cancel flag after it has been processed
  */
  function clearCancelFlag(issuanceId) {
    const ss = SpreadsheetApp.openById(ISSUANCE_CONFIG.SPREADSHEET_ID);
    const settingsSheet = ss.getSheetByName(ISSUANCE_CONFIG.SHEETS.SETTINGS);
    
    if (!settingsSheet) return;
    
    const cancelKey = `CANCEL_SEND_${issuanceId}`;
    const data = settingsSheet.getDataRange().getValues();
    const headers = data[0];
    const keyCol = headers.indexOf('SettingKey');
    const valCol = headers.indexOf('SettingValue');
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][keyCol] === cancelKey) {
        // Set to false instead of deleting (for audit trail)
        settingsSheet.getRange(i + 1, valCol + 1).setValue('false');
        settingsSheet.getRange(i + 1, headers.indexOf('UpdatedAt') + 1).setValue(new Date().toISOString());
        break;
      }
    }
  }

  /**
  * Publish a Download-Only issuance (makes it visible to members without sending emails)
  * Changes status from Draft to Sent and marks all recipients as Sent
  */
  function publishIssuance(data) {
    const ss = SpreadsheetApp.openById(ISSUANCE_CONFIG.SPREADSHEET_ID);
    
    // Get the issuance
    const issuanceResult = getIssuanceById(data.issuanceId);
    if (!issuanceResult.success) {
      return issuanceResult;
    }
    const issuance = issuanceResult.data;
    
    // Verify it's a Draft
    if (issuance.Status !== 'Draft') {
      return { success: false, error: 'Only draft issuances can be published' };
    }
    
    // Verify it's Download Only
    if (issuance.DeliveryMethod !== 'DownloadOnly') {
      return { success: false, error: 'This issuance is set to send via Email. Use the Send button instead.' };
    }
    
    const now = new Date().toISOString();
    const publishedBy = data.publishedBy || '';
    
    // Update issuance status to Sent
    const issuancesSheet = ss.getSheetByName(ISSUANCE_CONFIG.SHEETS.ISSUANCES);
    const issuancesData = issuancesSheet.getDataRange().getValues();
    const issuanceHeaders = issuancesData[0];
    
    // Find column indices
    const statusCol = issuanceHeaders.indexOf('Status');
    const sentAtCol = issuanceHeaders.indexOf('SentAt');
    const sentByCol = issuanceHeaders.indexOf('SentBy');
    const sentCountCol = issuanceHeaders.indexOf('SentCount');
    
    // Find the issuance row
    for (let i = 1; i < issuancesData.length; i++) {
      if (issuancesData[i][0] === data.issuanceId) {
        issuancesSheet.getRange(i + 1, statusCol + 1).setValue('Sent');
        issuancesSheet.getRange(i + 1, sentAtCol + 1).setValue(now);
        issuancesSheet.getRange(i + 1, sentByCol + 1).setValue(publishedBy);
        issuancesSheet.getRange(i + 1, sentCountCol + 1).setValue(issuance.TotalRecipients || 0);
        break;
      }
    }
    
    // Update all recipients to Sent status
    const recipientsSheet = ss.getSheetByName(ISSUANCE_CONFIG.SHEETS.RECIPIENTS);
    if (recipientsSheet && recipientsSheet.getLastRow() > 1) {
      const recipientsData = recipientsSheet.getDataRange().getValues();
      const recipientHeaders = recipientsData[0];
      
      const recipientStatusCol = recipientHeaders.indexOf('Status');
      const recipientSentAtCol = recipientHeaders.indexOf('SentAt');
      
      for (let i = 1; i < recipientsData.length; i++) {
        if (recipientsData[i][recipientHeaders.indexOf('IssuanceID')] === data.issuanceId) {
          recipientsSheet.getRange(i + 1, recipientStatusCol + 1).setValue('Sent');
          recipientsSheet.getRange(i + 1, recipientSentAtCol + 1).setValue(now);
        }
      }
    }
    
    return { 
      success: true, 
      message: 'Issuance published successfully. It is now visible to all recipients.',
      publishedAt: now,
      publishedBy: publishedBy,
      recipientCount: issuance.TotalRecipients || 0
    };
  }

  /**
  * Send issuance to all recipients
  */
  function sendIssuance(data) {
    const ss = SpreadsheetApp.openById(ISSUANCE_CONFIG.SPREADSHEET_ID);
    
    // Get the issuance
    const issuanceResult = getIssuanceById(data.issuanceId);
    if (!issuanceResult.success) {
      return issuanceResult;
    }
    const issuance = issuanceResult.data;
    
    // Get template
    let templateUrl = issuance.CustomTemplateUrl;
    if (!templateUrl) {
      const templateResult = getTemplateById(issuance.TemplateID);
      if (templateResult.success && templateResult.data.DocsUrl) {
        templateUrl = templateResult.data.DocsUrl;
      }
    }
    
    if (!templateUrl) {
      return { success: false, error: 'No template URL configured' };
    }
    
    // Get recipients
    const recipientsResult = getRecipientsByIssuance(data.issuanceId);
    const recipients = recipientsResult.data || [];
    
    if (recipients.length === 0) {
      return { success: false, error: 'No recipients found' };
    }
    
    // Parse field inputs
    let fieldInputs = {};
    try {
      fieldInputs = JSON.parse(issuance.FieldInputs || '{}');
    } catch (e) {}
    
    // Get name formatting settings from issuance columns
    const useAllCaps = issuance.NameAllCaps === 'true' || issuance.NameAllCaps === true;
    const namePositioning = {
      start: parseFloat(issuance.NameStartPos) || 8.1,
      end: parseFloat(issuance.NameEndPos) || 27.6,
      unit: issuance.NamePosUnit || 'cm'
    };
    
    // Store positioning in fieldValues for PDF generation
    fieldInputs['{NAME}_START'] = String(namePositioning.start);
    fieldInputs['{NAME}_END'] = String(namePositioning.end);
    fieldInputs['{NAME}_UNIT'] = namePositioning.unit;
    
    // Get settings for email
    const settingsResult = getSettings();
    const settings = settingsResult.data || {};
    const senderName = settings.SenderName?.value || ISSUANCE_ORG_BRANDING.fullName;
    const emailFooter = settings.EmailFooter?.value || '';
    
    const results = {
      total: recipients.length,
      sent: 0,
      failed: 0,
      skipped: 0, // Track already-sent recipients
      details: []
    };
    
    // Process each recipient
    for (const recipient of recipients) {
      // Check if sending has been cancelled
      if (isSendingCancelled(data.issuanceId)) {
        results.details.push({
          email: '',
          name: '',
          status: 'cancelled',
          message: 'Sending was cancelled by user'
        });
        // Clear the cancel flag
        clearCancelFlag(data.issuanceId);
        // Update issuance with partial results (include skipped in total)
        const partialSent = results.sent + results.skipped;
        updateIssuance({
          id: data.issuanceId,
          status: partialSent > 0 ? 'Sent' : 'Draft',
          sentAt: partialSent > 0 ? new Date().toISOString() : '',
          sentBy: data.sentBy || '',
          sentCount: partialSent,
          failedCount: results.failed
        });
        return {
          success: true,
          cancelled: true,
          results: results,
          message: `Sending cancelled. ${results.sent} emails were sent before cancellation.`
        };
      }
      
      if (recipient.Status === 'Sent') {
        results.skipped++; // Count already-sent recipients
        results.details.push({
          email: recipient.RecipientEmail,
          name: recipient.RecipientName,
          status: 'skipped',
          message: 'Already sent'
        });
        continue;
      }
      
      try {
        // Prepare field values for this recipient
        const recipientFieldValues = { ...fieldInputs };
        
        // Get the display name (apply ALL CAPS if enabled)
        let displayName = recipient.RecipientName;
        if (useAllCaps) {
          displayName = displayName.toUpperCase();
        }
        
        // Only use recipient name as fallback if no custom {NAME} value was provided
        // This allows users to set custom values like "Dear Love" when needed
        if (!recipientFieldValues['{NAME}'] || recipientFieldValues['{NAME}'].trim() === '') {
          recipientFieldValues['{NAME}'] = displayName;
        } else if (useAllCaps && recipientFieldValues['{NAME}']) {
          // If custom name provided, also apply ALL CAPS
          recipientFieldValues['{NAME}'] = recipientFieldValues['{NAME}'].toUpperCase();
        }
        
        // Handle control number:
        // 1. If recipient has a stored ControlNumber (from event linking), always use it
        // 2. If no stored ControlNumber but fieldInputs has a custom value (not a placeholder pattern), use that
        // 3. Otherwise, leave the placeholder empty or as-is
        if (recipient.ControlNumber && String(recipient.ControlNumber).trim() !== '') {
          recipientFieldValues['{CONTROL_NUMBER}'] = String(recipient.ControlNumber);
        } else {
          // Check if fieldInputs has a valid custom control number (not a placeholder pattern)
          const existingControlNumber = recipientFieldValues['{CONTROL_NUMBER}'];
          if (existingControlNumber && 
              existingControlNumber.trim() !== '' && 
              !existingControlNumber.includes('XX') && 
              !existingControlNumber.includes('[{')) {
            // Keep the custom control number from fieldInputs
          } else {
            // No valid control number - set to empty to avoid showing placeholder in PDF
            recipientFieldValues['{CONTROL_NUMBER}'] = '';
          }
        }

        // Generate PDF
        const pdfResult = generatePdfFromTemplate(
          templateUrl,
          recipientFieldValues,
          displayName
        );
        
        if (!pdfResult.success) {
          throw new Error(pdfResult.error);
        }
        
        // Build HTML email body
        const emailMessage = issuance.EmailMessage || ('Please find attached your document from ' + ISSUANCE_ORG_BRANDING.shortName + '.');
        const htmlBody = buildIssuanceEmailHtml(
          recipient.RecipientName,
          issuance.EmailTitle || `Document from ${senderName}`,
          emailMessage,
          emailFooter,
          recipient.ControlNumber || null
        );
        
        // Send email with HTML body
        MailApp.sendEmail({
          to: recipient.RecipientEmail,
          subject: issuance.EmailTitle || `Document from ${senderName}`,
          htmlBody: htmlBody,
          name: senderName,
          attachments: [pdfResult.pdfBlob]
        });
        
        // Update recipient status
        updateRecipientStatus(recipient.RecordID, 'Sent', {
          pdfFileId: pdfResult.pdfFileId
        });
        
        // Log the send
        logSendAction(data.issuanceId, recipient.RecipientEmail, recipient.RecipientName, 'EmailSent', 'Email sent successfully', data.sentBy);
        
        // Delete PDF from Drive (as per requirement)
        try {
          DriveApp.getFileById(pdfResult.pdfFileId).setTrashed(true);
        } catch (e) {
          // Ignore deletion errors
        }
        
        results.sent++;
        results.details.push({
          email: recipient.RecipientEmail,
          name: recipient.RecipientName,
          status: 'sent',
          message: 'Email sent successfully'
        });
        
      } catch (error) {
        results.failed++;
        
        // Update recipient status to failed
        updateRecipientStatus(recipient.RecordID, 'Failed', {
          reason: error.toString()
        });
        
        // Log the failure
        logSendAction(data.issuanceId, recipient.RecipientEmail, recipient.RecipientName, 'EmailFailed', error.toString(), data.sentBy);
        
        results.details.push({
          email: recipient.RecipientEmail,
          name: recipient.RecipientName,
          status: 'failed',
          message: error.toString()
        });
      }
    }
    
    // Update issuance counts
    // Total sent = newly sent + already sent (skipped)
    const totalSent = results.sent + results.skipped;
    updateIssuance({
      id: data.issuanceId,
      status: 'Sent',
      sentAt: new Date().toISOString(),
      sentBy: data.sentBy || '',
      sentCount: totalSent,
      failedCount: results.failed
    });
    
    return {
      success: true,
      results: results
    };
  }

  /**
  * Resend issuance to a single recipient (for failed emails)
  */
  function resendToRecipient(data) {
    const { issuanceId, recipientId, sentBy } = data;
    
    // Get the issuance
    const issuanceResult = getIssuanceById(issuanceId);
    if (!issuanceResult.success) {
      return issuanceResult;
    }
    const issuance = issuanceResult.data;
    
    // Get template
    let templateUrl = issuance.CustomTemplateUrl;
    if (!templateUrl) {
      const templateResult = getTemplateById(issuance.TemplateID);
      if (templateResult.success && templateResult.data.DocsUrl) {
        templateUrl = templateResult.data.DocsUrl;
      }
    }
    
    if (!templateUrl) {
      return { success: false, error: 'No template URL configured' };
    }
    
    // Get the specific recipient
    const recipientsResult = getRecipientsByIssuance(issuanceId);
    const recipients = recipientsResult.data || [];
    const recipient = recipients.find(r => r.RecordID === recipientId);
    
    if (!recipient) {
      return { success: false, error: 'Recipient not found' };
    }
    
    // Parse field inputs
    let fieldInputs = {};
    try {
      fieldInputs = JSON.parse(issuance.FieldInputs || '{}');
    } catch (e) {}
    
    // Get name formatting settings from issuance columns
    const useAllCaps = issuance.NameAllCaps === 'true' || issuance.NameAllCaps === true;
    const namePositioning = {
      start: parseFloat(issuance.NameStartPos) || 8.1,
      end: parseFloat(issuance.NameEndPos) || 27.6,
      unit: issuance.NamePosUnit || 'cm'
    };
    
    // Store positioning in fieldValues for PDF generation
    fieldInputs['{NAME}_START'] = String(namePositioning.start);
    fieldInputs['{NAME}_END'] = String(namePositioning.end);
    fieldInputs['{NAME}_UNIT'] = namePositioning.unit;
    
    // Get settings for email
    const settingsResult = getSettings();
    const settings = settingsResult.data || {};
    const senderName = settings.SenderName?.value || ISSUANCE_ORG_BRANDING.fullName;
    const emailFooter = settings.EmailFooter?.value || '';
    
    try {
      // Prepare field values for this recipient
      const recipientFieldValues = { ...fieldInputs };
      
      // Get the display name (apply ALL CAPS if enabled)
      let displayName = recipient.RecipientName;
      if (useAllCaps) {
        displayName = displayName.toUpperCase();
      }
      
      // Only use recipient name as fallback if no custom {NAME} value was provided
      if (!recipientFieldValues['{NAME}'] || recipientFieldValues['{NAME}'].trim() === '') {
        recipientFieldValues['{NAME}'] = displayName;
      } else if (useAllCaps && recipientFieldValues['{NAME}']) {
        // If custom name provided, also apply ALL CAPS
        recipientFieldValues['{NAME}'] = recipientFieldValues['{NAME}'].toUpperCase();
      }
      
      // Handle control number:
      // 1. If recipient has a stored ControlNumber, use it
      // 2. Otherwise check for valid custom value in fieldInputs
      if (recipient.ControlNumber && recipient.ControlNumber.trim() !== '') {
        recipientFieldValues['{CONTROL_NUMBER}'] = recipient.ControlNumber;
      } else {
        const existingControlNumber = recipientFieldValues['{CONTROL_NUMBER}'];
        if (existingControlNumber && 
            existingControlNumber.trim() !== '' && 
            !existingControlNumber.includes('XX') && 
            !existingControlNumber.includes('[{')) {
          // Keep the custom control number from fieldInputs
        } else {
          recipientFieldValues['{CONTROL_NUMBER}'] = '';
        }
      }
      
      // Generate PDF
      const pdfResult = generatePdfFromTemplate(
        templateUrl,
        recipientFieldValues,
        displayName
      );
      
      if (!pdfResult.success) {
        throw new Error(pdfResult.error);
      }
      
      // Build HTML email body
      const emailMessage = issuance.EmailMessage || ('Please find attached your document from ' + ISSUANCE_ORG_BRANDING.shortName + '.');
      const htmlBody = buildIssuanceEmailHtml(
        recipient.RecipientName,
        issuance.EmailTitle || `Document from ${senderName}`,
        emailMessage,
        emailFooter
      );
      
      // Send email with HTML body
      MailApp.sendEmail({
        to: recipient.RecipientEmail,
        subject: issuance.EmailTitle || `Document from ${senderName}`,
        htmlBody: htmlBody,
        name: senderName,
        attachments: [pdfResult.pdfBlob]
      });
      
      // Update recipient status
      updateRecipientStatus(recipient.RecordID, 'Sent', {
        pdfFileId: pdfResult.pdfFileId
      });
      
      // Log the send
      logSendAction(issuanceId, recipient.RecipientEmail, recipient.RecipientName, 'EmailSent', 'Email resent successfully', sentBy);
      
      // Delete PDF from Drive (as per requirement)
      try {
        DriveApp.getFileById(pdfResult.pdfFileId).setTrashed(true);
      } catch (e) {
        // Ignore deletion errors
      }
      
      // Update issuance resent count (separate from sent count)
      const ss = SpreadsheetApp.openById(ISSUANCE_CONFIG.SPREADSHEET_ID);
      const issuanceSheet = ss.getSheetByName(ISSUANCE_CONFIG.SHEETS.ISSUANCES);
      const dataRange = issuanceSheet.getDataRange();
      const values = dataRange.getValues();
      const headers = values[0];
      
      for (let i = 1; i < values.length; i++) {
        if (values[i][0] === issuanceId) {
          const resentCountIdx = headers.indexOf('ResentCount');
          const failedCountIdx = headers.indexOf('FailedCount');
          values[i][resentCountIdx] = (parseInt(values[i][resentCountIdx]) || 0) + 1;
          values[i][failedCountIdx] = Math.max(0, (parseInt(values[i][failedCountIdx]) || 0) - 1);
          dataRange.setValues(values);
          break;
        }
      }
      
      return {
        success: true,
        message: 'Email sent successfully',
        recipient: {
          name: recipient.RecipientName,
          email: recipient.RecipientEmail,
          status: 'Sent'
        }
      };
      
    } catch (error) {
      // Update recipient status to failed
      updateRecipientStatus(recipient.RecordID, 'Failed', {
        reason: error.toString()
      });
      
      // Log the failure
      logSendAction(issuanceId, recipient.RecipientEmail, recipient.RecipientName, 'EmailFailed', error.toString(), sentBy);
      
      return {
        success: false,
        error: error.toString()
      };
    }
  }

  /**
  * Download issuance (generate PDF without sending)
  */
  function downloadIssuance(data) {
    const issuanceResult = getIssuanceById(data.issuanceId);
    if (!issuanceResult.success) {
      return issuanceResult;
    }
    const issuance = issuanceResult.data;
    
    // Get template URL
    let templateUrl = issuance.CustomTemplateUrl;
    if (!templateUrl) {
      const templateResult = getTemplateById(issuance.TemplateID);
      if (templateResult.success && templateResult.data.DocsUrl) {
        templateUrl = templateResult.data.DocsUrl;
      }
    }
    
    if (!templateUrl) {
      return { success: false, error: 'No template URL configured' };
    }
    
    // Parse field inputs
    let fieldInputs = {};
    try {
      fieldInputs = JSON.parse(issuance.FieldInputs || '{}');
    } catch (e) {}
    
    // If downloading for a specific recipient
    if (data.recipientId) {
      const recipientsResult = getRecipientsByIssuance(data.issuanceId);
      const recipient = (recipientsResult.data || []).find(r => r.RecordID === data.recipientId);
      
      if (!recipient) {
        return { success: false, error: 'Recipient not found' };
      }
      
      const recipientFieldValues = { ...fieldInputs };
      // Only use recipient name as fallback if no custom {NAME} value was provided
      if (!recipientFieldValues['{NAME}'] || recipientFieldValues['{NAME}'].trim() === '') {
        recipientFieldValues['{NAME}'] = recipient.RecipientName;
      }
      
      // Handle control number:
      // 1. If recipient has a stored ControlNumber, use it
      // 2. Otherwise check for valid custom value in fieldInputs
      if (recipient.ControlNumber && recipient.ControlNumber.trim() !== '') {
        recipientFieldValues['{CONTROL_NUMBER}'] = recipient.ControlNumber;
      } else {
        const existingControlNumber = recipientFieldValues['{CONTROL_NUMBER}'];
        if (existingControlNumber && 
            existingControlNumber.trim() !== '' && 
            !existingControlNumber.includes('XX') && 
            !existingControlNumber.includes('[{')) {
          // Keep the custom control number from fieldInputs
        } else {
          recipientFieldValues['{CONTROL_NUMBER}'] = '';
        }
      }
      
      const pdfResult = generatePdfFromTemplate(templateUrl, recipientFieldValues, recipient.RecipientName);
      
      if (pdfResult.success) {
        updateRecipientStatus(recipient.RecordID, 'Downloaded', {
          pdfFileId: pdfResult.pdfFileId
        });
        
        logSendAction(data.issuanceId, recipient.RecipientEmail, recipient.RecipientName, 'Downloaded', 'PDF generated for download', data.downloadedBy);
      }
      
      return pdfResult;
    }
    
    // If downloading all recipients as a batch
    const recipientsResult = getRecipientsByIssuance(data.issuanceId);
    const recipients = recipientsResult.data || [];
    
    const results = [];
    for (const recipient of recipients) {
      const recipientFieldValues = { ...fieldInputs };
      // Only use recipient name as fallback if no custom {NAME} value was provided
      if (!recipientFieldValues['{NAME}'] || recipientFieldValues['{NAME}'].trim() === '') {
        recipientFieldValues['{NAME}'] = recipient.RecipientName;
      }
      
      // Handle control number:
      // 1. If recipient has a stored ControlNumber, use it
      // 2. Otherwise check for valid custom value in fieldInputs
      if (recipient.ControlNumber && recipient.ControlNumber.trim() !== '') {
        recipientFieldValues['{CONTROL_NUMBER}'] = recipient.ControlNumber;
      } else {
        const existingControlNumber = recipientFieldValues['{CONTROL_NUMBER}'];
        if (existingControlNumber && 
            existingControlNumber.trim() !== '' && 
            !existingControlNumber.includes('XX') && 
            !existingControlNumber.includes('[{')) {
          // Keep the custom control number from fieldInputs
        } else {
          recipientFieldValues['{CONTROL_NUMBER}'] = '';
        }
      }
      
      const pdfResult = generatePdfFromTemplate(templateUrl, recipientFieldValues, recipient.RecipientName);
      
      if (pdfResult.success) {
        updateRecipientStatus(recipient.RecordID, 'Downloaded', {
          pdfFileId: pdfResult.pdfFileId
        });
      }
      
      results.push({
        name: recipient.RecipientName,
        ...pdfResult
      });
    }
    
    return { success: true, results: results };
  }

  // ============================================================================
  // LOGGING
  // ============================================================================

  /**
  * Log send/download action
  */
  function logSendAction(issuanceId, email, name, action, details, performedBy) {
    const ss = SpreadsheetApp.openById(ISSUANCE_CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(ISSUANCE_CONFIG.SHEETS.SEND_LOGS);
    
    const logId = `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    
    sheet.appendRow([
      logId,
      issuanceId,
      email,
      name,
      action,
      new Date().toISOString(),
      details,
      performedBy || ''
    ]);
    
    return { success: true, logId: logId };
  }

  /**
  * Get send logs with optional filters
  */
  function getSendLogs(params) {
    const ss = SpreadsheetApp.openById(ISSUANCE_CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(ISSUANCE_CONFIG.SHEETS.SEND_LOGS);
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return { success: true, data: [] };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    
    let logs = rows.map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = row[i];
      });
      return obj;
    });
    
    // Filter by issuance
    if (params && params.issuanceId) {
      logs = logs.filter(l => l.IssuanceID === params.issuanceId);
    }
    
    // Sort by timestamp descending
    logs.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
    
    return { success: true, data: logs };
  }

  // ============================================================================
  // INTEGRATION HELPERS - GET MEMBERS FROM DIRECTORY
  // ============================================================================

  /**
  * Get all members from the Directory spreadsheet
  * Fetches from the same User Profiles sheet used by Login/Directory systems
  */
  function getAllMembers() {
    try {
      // Use the same spreadsheet as Login/Directory system (LOGIN_SPREADSHEET_ID from Loginpage_Main.gs)
      const DIRECTORY_SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('LOGIN_SPREADSHEET_ID') || '';
      const DIRECTORY_SHEET_NAME = 'Form Responses 1';
      
      const ss = SpreadsheetApp.openById(DIRECTORY_SPREADSHEET_ID);
      const sheet = ss.getSheetByName(DIRECTORY_SHEET_NAME);
      
      if (!sheet) {
        return { success: true, data: [], message: 'Directory sheet not found' };
      }
      
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      
      // Build column index
      const idx = {};
      headers.forEach((header, i) => {
        switch(header) {
          case 'Full name': idx.fullName = i; break;
          case 'Personal Email Address': idx.personalEmail = i; break;
          case 'Email Address': idx.formEmail = i; break;
          case 'Committee': idx.committee = i; break;
          case 'Status': idx.status = i; break;
          case 'Role': idx.role = i; break;
          case 'ID Code': idx.idCode = i; break;
        }
      });
      
      const members = [];
      
      // Process all rows (skip header)
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const fullName = row[idx.fullName] ? row[idx.fullName].toString().trim() : '';
        const personalEmail = row[idx.personalEmail] ? row[idx.personalEmail].toString().trim() : '';
        const formEmail = row[idx.formEmail] ? row[idx.formEmail].toString().trim() : '';
        const committee = row[idx.committee] ? row[idx.committee].toString().trim() : '';
        const status = (row[idx.status] || '').toString().toLowerCase();
        const role = (row[idx.role] || '').toString().toLowerCase();
        
        // Skip empty rows, banned, and suspended users
        if (!fullName) continue;
        if (status === 'banned' || status === 'suspended' || role === 'banned' || role === 'suspended') continue;
        
        // Use personal email first, fallback to form email
        const email = personalEmail || formEmail;
        
        if (email) {
          members.push({
            name: fullName,
            email: email,
            committee: committee
          });
        }
      }
      
      return {
        success: true,
        data: members
      };
    } catch (e) {
      Logger.log('getAllMembers Error: ' + e.toString());
      return { success: false, error: e.toString() };
    }
  }

  /**
  * Get committees list
  */
  function getCommittees() {
    // Return official YSP committees and groups
    return {
      success: true,
      data: [
        { id: 'executive-board', name: 'Executive Board' },
        { id: 'membership-internal-affairs', name: 'Membership and Internal Affairs Committee' },
        { id: 'external-relations', name: 'External Relations Committee' },
        { id: 'secretariat-documentation', name: 'Secretariat and Documentation Committee' },
        { id: 'finance-treasury', name: 'Finance and Treasury Committee' },
        { id: 'program-development', name: 'Program Development Committee' },
        { id: 'communications-marketing', name: 'Communications and Marketing Committee' },
        { id: 'barangay-chapter-leaders', name: 'Barangay Chapter Leaders' },
        { id: 'general-members', name: 'General Members' },
        { id: 'volunteers', name: 'Volunteers' },
        { id: 'probationary-members', name: 'Probationary Members' }
      ]
    };
  }

  /**
  * Get event attendees (Present + Late) from attendance records
  * Reads from the EventAttendance sheet and looks up emails from User Profiles
  */
  function getEventAttendees(eventId) {
    try {
      if (!eventId) {
        return { success: false, error: 'Event ID is required' };
      }
      
      // Spreadsheet IDs - loaded from Script Properties
      const ATTENDANCE_SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('EVENTS_SPREADSHEET_ID') || '';
      const LOGIN_SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('LOGIN_SPREADSHEET_ID') || '';
      
      // Step 1: Get attendance records for this event
      const attendanceSS = SpreadsheetApp.openById(ATTENDANCE_SPREADSHEET_ID);
      const attendanceSheet = attendanceSS.getSheetByName('EventAttendance');
      
      if (!attendanceSheet || attendanceSheet.getLastRow() < 2) {
        return { success: true, data: [], message: 'No attendance records found' };
      }
      
      const attendanceData = attendanceSheet.getDataRange().getValues();
      const attendanceHeaders = attendanceData[0];
      
      // Get column indices for attendance sheet
      const eventIdIdx = attendanceHeaders.indexOf('EventID');
      const memberIdIdx = attendanceHeaders.indexOf('MemberID');
      const memberNameIdx = attendanceHeaders.indexOf('MemberName');
      const statusIdx = attendanceHeaders.indexOf('Status');
      
      // Filter attendance records: match eventId AND status is Present or Late
      const attendees = [];
      const memberIds = new Set();
      
      for (let i = 1; i < attendanceData.length; i++) {
        const row = attendanceData[i];
        const rowEventId = row[eventIdIdx];
        const status = row[statusIdx];
        
        // Match event ID and status (Present or Late)
        if (rowEventId === eventId && (status === 'Present' || status === 'Late')) {
          const memberId = row[memberIdIdx];
          const memberName = row[memberNameIdx];
          
          // Avoid duplicates (same member shouldn't be added twice)
          if (memberId && !memberIds.has(memberId)) {
            memberIds.add(memberId);
            attendees.push({
              memberId: memberId,
              name: memberName,
              status: status
            });
          }
        }
      }
      
      if (attendees.length === 0) {
        return { success: true, data: [], message: 'No Present or Late attendees found for this event' };
      }
      
      // Step 2: Look up emails from User Profiles sheet
      const loginSS = SpreadsheetApp.openById(LOGIN_SPREADSHEET_ID);
      const userProfilesSheet = loginSS.getSheetByName('User Profiles');
      
      // Build a map of memberId -> email from User Profiles
      const emailMap = {};
      
      if (userProfilesSheet && userProfilesSheet.getLastRow() >= 2) {
        const profileData = userProfilesSheet.getDataRange().getValues();
        const profileHeaders = profileData[0];
        
        // Find column indices - User Profiles uses 'ID Code' for member ID
        const idCodeIdx = profileHeaders.indexOf('ID Code');
        const personalEmailIdx = profileHeaders.indexOf('Personal Email Address');
        const formEmailIdx = profileHeaders.indexOf('Email Address');
        const fullNameIdx = profileHeaders.indexOf('Full name');
        
        for (let i = 1; i < profileData.length; i++) {
          const row = profileData[i];
          const idCode = row[idCodeIdx] ? row[idCodeIdx].toString().trim() : '';
          const personalEmail = row[personalEmailIdx] ? row[personalEmailIdx].toString().trim() : '';
          const formEmail = row[formEmailIdx] ? row[formEmailIdx].toString().trim() : '';
          const fullName = row[fullNameIdx] ? row[fullNameIdx].toString().trim() : '';
          
          // Use personal email first, fallback to form email
          const email = personalEmail || formEmail;
          
          if (idCode && email) {
            emailMap[idCode] = { email: email, name: fullName };
          }
        }
      }
      
      // Step 3: Combine attendees with their emails
      // Include ALL attendees, even those without email (they can still get downloaded certificates)
      const result = [];
      let withEmailCount = 0;
      let withoutEmailCount = 0;
      
      for (const attendee of attendees) {
        const profileData = emailMap[attendee.memberId];
        const email = profileData ? profileData.email : '';
        
        // Use name from profile if available (may be more complete), fallback to attendance record name
        const name = profileData ? profileData.name || attendee.name : attendee.name;
        
        // Include ALL attendees - flag those without email
        result.push({
          name: name,
          email: email || '', // Empty string if no email
          hasEmail: !!email,  // Boolean flag for frontend to style accordingly
          memberId: attendee.memberId,
          status: attendee.status // Present or Late
        });
        
        if (email) {
          withEmailCount++;
        } else {
          withoutEmailCount++;
          Logger.log('Note: No email found for member ' + attendee.memberId + ' (' + name + ') - included for download');
        }
      }
      
      return { 
        success: true, 
        data: result,
        totalAttendees: attendees.length,
        withEmail: withEmailCount,
        withoutEmail: withoutEmailCount
      };
    } catch (e) {
      Logger.log('Error in getEventAttendees: ' + e.toString());
      return { success: false, error: e.toString() };
    }
  }

  // ============================================================================
  // EMAIL TEMPLATE
  // ============================================================================

  /**
  * Build HTML email for issuance
  */
  function buildIssuanceEmailHtml(recipientName, subject, message, footer, controlNumber) {
    // Format the message: convert markdown-style formatting to HTML
    // - **text** or __text__ becomes <strong>text</strong>
    // - Line breaks become <br>
    // - Links become clickable
    const formatMessage = (text) => {
      if (!text) return '';
      return text
        // Convert **bold** to <strong>
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        // Convert __bold__ to <strong>
        .replace(/__([^_]+)__/g, '<strong>$1</strong>')
        // Convert URLs to clickable links (orange color to match brand)
        .replace(/(https?:\/\/[^\s<>"]+)/g, '<a href="$1" style="color: #FF8800; text-decoration: underline;">$1</a>')
        // Convert line breaks to <br>
        .replace(/\n/g, '<br>');
    };
    
    // Build control number section HTML if it exists
    const controlNumberHtml = controlNumber ? `
                  <div style="margin-top: 16px; padding: 12px 16px; background: linear-gradient(135deg, rgba(238,135,36,0.15) 0%, rgba(246,66,31,0.08) 100%); border-radius: 8px; border: 1px solid rgba(238, 135, 36, 0.3);">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span style="font-size: 16px;">#</span>
                      <div>
                        <span class="font-body" style="color: #718096; font-size: 12px; display: block;">Control Number</span>
                        <span class="font-body" style="color: #ee8724; font-size: 15px; font-weight: 600; font-family: 'Courier New', monospace; letter-spacing: 1px;">${controlNumber}</span>
                      </div>
                    </div>
                  </div>
    ` : '';
    
    return `
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
                  <img src="${ISSUANCE_CONFIG.LOGO_URL}" alt="YSP Logo" width="70" style="display: block; width: 70px; height: auto; border-radius: 50%; background: #fff; padding: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); margin-bottom: 16px;">
                  <div class="font-header" style="color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; margin: 0;">${ISSUANCE_ORG_BRANDING.orgName}</div>
                  <div class="font-body" style="color: rgba(255,255,255,0.9); font-size: 14px; margin-top: 6px; font-weight: 500;">${ISSUANCE_ORG_BRANDING.chapterName}</div>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 30px;">
                  <div class="font-header" style="color: #1a1a1a; font-size: 20px; font-weight: 600; margin-bottom: 16px;">Hello, ${recipientName || 'Member'}</div>
                  <div class="font-body" style="color: #4a5568; font-size: 15px; line-height: 1.6;">
                    ${formatMessage(message)}
                  </div>
                  <div style="margin-top: 24px; padding: 16px; background: linear-gradient(135deg, rgba(238,135,36,0.1) 0%, rgba(246,66,31,0.1) 100%); border-radius: 8px; border-left: 4px solid #ee8724;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span style="font-size: 20px;">ðŸ“Ž</span>
                      <span class="font-body" style="color: #4a5568; font-size: 14px;">Your document is attached to this email. Please download and save it for your records.</span>
                    </div>
                  </div>
                  ${controlNumberHtml}
                  ${footer ? `
                  <div style="margin-top: 20px; color: #718096; font-size: 13px; line-height: 1.5;">
                    ${formatMessage(footer)}
                  </div>
                  ` : ''}
                  <table width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top: 30px;">
                    <tr>
                      <td align="center">
                        <a href="${ISSUANCE_CONFIG.WEB_APP_URL}" style="display: inline-block; background-color: #FF8800; color: #ffffff; font-family: 'Lexend', sans-serif; font-weight: 600; font-size: 14px; padding: 12px 28px; text-decoration: none; border-radius: 6px; box-shadow: 0 2px 4px rgba(255, 136, 0, 0.3); margin: 0 8px;">Access Web App</a>
                        <a href="${ISSUANCE_CONFIG.FB_PAGE_URL}" style="display: inline-block; background-color: #ffffff; color: #4a5568; border: 1px solid #e2e8f0; font-family: 'Lexend', sans-serif; font-weight: 600; font-size: 14px; padding: 11px 28px; text-decoration: none; border-radius: 6px; margin: 0 8px;">Facebook</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td bgcolor="#f8f9fa" align="center" style="padding: 24px; border-top: 1px solid #eeeeee;">
                  <div class="font-body" style="color: #a0aec0; font-size: 11px; line-height: 1.5;">
                    &copy; 2026 ${ISSUANCE_ORG_BRANDING.fullName}.<br>
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
  }

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  /**
  * Test initialization
  */
  function testIssuanceInit() {
    const result = initializeIssuanceSheets();
    Logger.log(JSON.stringify(result, null, 2));
    return result;
  }

  /**
  * Test creating an issuance
  */
  function testCreateIssuance() {
    const result = createIssuance({
      title: 'Test Certificate',
      templateId: 'TMPL-0001',
      templateName: 'Digital Certificate - Event Participation',
      createdBy: 'admin@ysp.org',
      recipientType: 'Person',
      recipientDetails: [{ name: 'John Doe', email: 'john@example.com' }],
      totalRecipients: 1,
      fieldInputs: {
        '{NAME}': 'John Doe',
        '{EVENT}': 'YSP General Assembly 2025',
        '{DATE}': 'January 30, 2025'
      },
      emailTitle: 'Your Certificate of Participation',
      emailMessage: 'Thank you for attending our event. Please find your certificate attached.',
      recipients: [{ name: 'John Doe', email: 'john@example.com', type: 'Member' }]
    });
    
    Logger.log(JSON.stringify(result, null, 2));
    return result;
  }

  /**
  * Test control number generation
  * Run this to verify control numbers are generated correctly
  */
  function testControlNumberGeneration() {
    // Test preview for an event
    const previewResult = previewControlNumberForEvent('TEST-EVENT-001', 'Test Event');
    Logger.log('Preview Result: ' + JSON.stringify(previewResult, null, 2));
    
    // Test batch generation
    const batchResult = batchGenerateControlNumbers('TEST-EVENT-001', 'Test Event', 5);
    Logger.log('Batch Result: ' + JSON.stringify(batchResult, null, 2));
    
    return {
      preview: previewResult,
      batch: batchResult
    };
  }

  /**
  * Test creating an issuance with event and control numbers
  */
  function testCreateIssuanceWithEvent() {
    const result = createIssuance({
      title: 'Test Certificate with Control Number',
      templateId: 'TMPL-0001',
      templateName: 'Digital Certificate - Event Participation',
      createdBy: 'admin@ysp.org',
      recipientType: 'Event',
      eventId: 'TEST-EVENT-002',
      eventTitle: 'Test Event for Control Numbers',
      recipientDetails: [
        { name: 'John Doe', email: 'john@example.com' },
        { name: 'Jane Smith', email: 'jane@example.com' }
      ],
      totalRecipients: 2,
      fieldInputs: {
        '{EVENT}': 'Test Event for Control Numbers',
        '{DATE}': 'February 5, 2026'
      },
      emailTitle: 'Your Certificate of Participation',
      emailMessage: 'Thank you for attending our event. Please find your certificate attached.',
      recipients: [
        { name: 'John Doe', email: 'john@example.com', type: 'Member' },
        { name: 'Jane Smith', email: 'jane@example.com', type: 'Member' }
      ]
    });
    
    Logger.log(JSON.stringify(result, null, 2));
    
    // Get control number info
    if (result.success) {
      const controlInfo = getControlNumberInfo(result.id);
      Logger.log('Control Number Info: ' + JSON.stringify(controlInfo, null, 2));
    }
    
    return result;
  }


