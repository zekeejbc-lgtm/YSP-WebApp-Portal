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

  const ISSUANCE_CONFIG = {
    SPREADSHEET_ID: '1HUimmBnzy1Rr7Kg-x24iiscKTmqHJdzDoV72N3u4wmE',
    PDF_FOLDER_ID: '1e6g6JLr7y9VcJJ2wQ5jijNu9z6WAmDnt',
    SHEETS: {
      ISSUANCES: 'Issuances',
      TEMPLATES: 'Templates',
      RECIPIENTS: 'Recipients',
      SEND_LOGS: 'SendLogs',
      SETTINGS: 'Settings'
    },
    // Default header style
    HEADER_STYLE: {
      background: '#ee8724', // YSP Orange
      fontColor: '#ffffff',  // White
      fontWeight: 'bold',
      fontSize: 11
    },
    // Branding - Use Imgur URL for email compatibility (same as OTP emails)
    LOGO_URL: 'https://i.imgur.com/J4wddTW.png',
    WEB_APP_URL: 'https://ysptagum.vercel.app',
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
      'FailedCount',
      'FieldInputs',      // JSON string with field values
      'EmailTitle',
      'EmailMessage',
      'CustomTemplateUrl',
      'Notes'
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
      'DownloadedAt'
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
    ]
  };

  // Default settings values
  const DEFAULT_SETTINGS = [
    { key: 'DefaultCertificateTemplate', value: '', description: 'Default Google Docs URL for Digital Certificates' },
    { key: 'DefaultMeetingNoticeTemplate', value: '', description: 'Default Google Docs URL for Meeting Notices' },
    { key: 'DefaultNoticeTemplate', value: '', description: 'Default Google Docs URL for General Notices' },
    { key: 'DefaultLetterTemplate', value: '', description: 'Default Google Docs URL for Letters' },
    { key: 'DefaultMemoTemplate', value: '', description: 'Default Google Docs URL for Memos' },
    { key: 'SenderName', value: 'Youth Service Philippines - Tagum Chapter', description: 'Name shown as email sender' },
    { key: 'SenderEmail', value: '', description: 'Reply-to email address' },
    { key: 'EmailFooter', value: 'This is an automated message from YSP Tagum Chapter. Please do not reply.', description: 'Footer text for all emails' }
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
  * This adds the DeliveryMethod column if missing and realigns all data
  * Run this once if your spreadsheet was created before DeliveryMethod was added
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
    
    const currentHeaders = data[0];
    const expectedHeaders = SHEET_HEADERS.Issuances;
    
    // Check if DeliveryMethod column exists
    const hasDeliveryMethod = currentHeaders.includes('DeliveryMethod');
    
    if (hasDeliveryMethod && currentHeaders.length === expectedHeaders.length) {
      return { success: true, message: 'Columns already aligned correctly', noChanges: true };
    }
    
    // Build migration results
    const results = {
      originalHeaders: currentHeaders,
      expectedHeaders: expectedHeaders,
      rowsProcessed: 0,
      changes: []
    };
    
    // If DeliveryMethod is missing, we need to insert it at position 5
    if (!hasDeliveryMethod) {
      results.changes.push('Added DeliveryMethod column at position 6');
      
      // Insert the column after Status (position 5, 0-indexed = column 6)
      sheet.insertColumnAfter(5);
      
      // Set the header
      sheet.getRange(1, 6).setValue('DeliveryMethod');
      
      // For each existing data row, shift values and add default DeliveryMethod
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        // Set default value 'Email' for all existing rows (since they were created before this feature)
        for (let i = 2; i <= lastRow; i++) {
          sheet.getRange(i, 6).setValue('Email');
        }
        results.rowsProcessed = lastRow - 1;
      }
    }
    
    // Verify and fix headers to match expected
    const newData = sheet.getDataRange().getValues();
    const newHeaders = newData[0];
    
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
        fields: JSON.stringify(['{NAME}', '{EVENT}', '{DATE}', '{POSITION}']),
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
  // MAIN ENTRY POINT - doGet / doPost
  // ============================================================================

  /**
  * Handle GET requests
  */
  function doGet(e) {
    const action = e.parameter.action;
    
    try {
      switch (action) {
        case 'init':
          return jsonResponse(initializeIssuanceSheets());
        
        case 'migrateColumns':
          return jsonResponse(migrateIssuanceColumns());
        
        case 'getIssuances':
          return jsonResponse(getIssuances(e.parameter));
        
        case 'getIssuancesByRecipient':
          return jsonResponse(getIssuancesByRecipient(e.parameter.email, e.parameter.name));
        
        case 'getIssuance':
          return jsonResponse(getIssuanceById(e.parameter.id));
        
        case 'getTemplates':
          return jsonResponse(getTemplates(e.parameter));
        
        case 'getTemplate':
          return jsonResponse(getTemplateById(e.parameter.id));
        
        case 'getSettings':
          return jsonResponse(getSettings());
        
        case 'getRecipients':
          return jsonResponse(getRecipientsByIssuance(e.parameter.issuanceId));
        
        case 'getSendLogs':
          return jsonResponse(getSendLogs(e.parameter));
        
        case 'getEventAttendees':
          return jsonResponse(getEventAttendees(e.parameter.eventId));
        
        case 'getMembers':
          return jsonResponse(getAllMembers());
        
        case 'getCommittees':
          return jsonResponse(getCommittees());
        
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
        
        case 'cancelSending':
          return jsonResponse(cancelSending(data));
        
        case 'resendToRecipient':
          return jsonResponse(resendToRecipient(data));
        
        case 'generatePdf':
          return jsonResponse(generateSinglePdf(data));
        
        case 'downloadIssuance':
          return jsonResponse(downloadIssuance(data));
        
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
      if (issuanceIds.has(obj.IssuanceID) && obj.Status !== 'Archived') {
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
  */
  function createIssuance(data) {
    const ss = SpreadsheetApp.openById(ISSUANCE_CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(ISSUANCE_CONFIG.SHEETS.ISSUANCES);
    
    // Generate unique ID
    const id = `ISS-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    
    const now = new Date().toISOString();
    
    // Determine initial status - if downloadOnly mode, mark as Sent (issued) immediately
    const initialStatus = data.downloadOnly ? 'Sent' : 'Draft';
    const sentAt = data.downloadOnly ? now : '';
    const sentBy = data.downloadOnly ? (data.createdBy || '') : '';
    
    // Delivery method: 'DownloadOnly' or 'Email'
    const deliveryMethod = data.downloadOnly ? 'DownloadOnly' : 'Email';
    
    const row = [
      id,
      data.title || '',
      data.templateId || '',
      data.templateName || '',
      initialStatus,
      deliveryMethod, // DeliveryMethod column
      data.createdBy || '',
      now,
      sentAt, // SentAt - set if downloadOnly
      sentBy, // SentBy - set if downloadOnly
      data.recipientType || '',
      JSON.stringify(data.recipientDetails || []),
      data.totalRecipients || 0,
      data.downloadOnly ? (data.totalRecipients || 0) : 0, // SentCount - set if downloadOnly
      0, // FailedCount
      JSON.stringify(data.fieldInputs || {}),
      data.emailTitle || '',
      data.emailMessage || '',
      data.customTemplateUrl || '',
      data.notes || ''
    ];
    
    sheet.appendRow(row);
    
    // Add recipients to Recipients sheet
    // If downloadOnly, mark recipients as Downloaded status
    if (data.recipients && data.recipients.length > 0) {
      addRecipients(id, data.recipients, data.downloadOnly);
    }
    
    return { 
      success: true, 
      id: id,
      message: 'Issuance created successfully' 
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
        
        // Sending-related fields
        if (data.sentAt) values[i][colMap['SentAt']] = data.sentAt;
        if (data.sentBy) values[i][colMap['SentBy']] = data.sentBy;
        if (data.sentCount !== undefined) values[i][colMap['SentCount']] = data.sentCount;
        if (data.failedCount !== undefined) values[i][colMap['FailedCount']] = data.failedCount;
        
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
  // RECIPIENT OPERATIONS
  // ============================================================================

  /**
  * Add recipients for an issuance
  * @param {string} issuanceId - The issuance ID
  * @param {Array} recipients - Array of recipient objects
  * @param {boolean} isDownloadOnly - If true, mark recipients as Sent/Downloaded status
  */
  function addRecipients(issuanceId, recipients, isDownloadOnly = false) {
    const ss = SpreadsheetApp.openById(ISSUANCE_CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(ISSUANCE_CONFIG.SHEETS.RECIPIENTS);
    
    const now = new Date().toISOString();
    
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
      ''  // DownloadedAt
    ]);
    
    if (rows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 10).setValues(rows);
    }
    
    return { success: true, count: rows.length };
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
  * Adjust font size for name to fit on one line
  * This ensures consistent formatting regardless of name length
  */
  function adjustNameFormatting(body, name, maxCharsBeforeResize = 25) {
    // Find the name text in the document
    const searchResult = body.findText(name);
    if (!searchResult) return;
    
    const element = searchResult.getElement();
    const startOffset = searchResult.getStartOffset();
    const endOffset = searchResult.getEndOffsetInclusive();
    
    // Get the text element
    const textElement = element.asText();
    
    // Calculate appropriate font size based on name length
    // Default assumption: base font size is around 24-36pt for certificates
    const nameLength = name.length;
    
    // Get current font size (or default to 28)
    let currentSize = textElement.getFontSize(startOffset);
    if (!currentSize || currentSize < 10) currentSize = 28;
    
    // Adjust font size based on name length to keep on one line
    let newSize = currentSize;
    if (nameLength > 35) {
      newSize = Math.max(14, currentSize * 0.6); // Very long names
    } else if (nameLength > 30) {
      newSize = Math.max(16, currentSize * 0.7);
    } else if (nameLength > maxCharsBeforeResize) {
      newSize = Math.max(18, currentSize * 0.8);
    }
    
    // Apply the new font size if changed
    if (newSize !== currentSize) {
      textElement.setFontSize(startOffset, endOffset, newSize);
    }
    
    // Ensure the paragraph containing the name is centered
    const paragraph = element.getParent();
    if (paragraph && paragraph.getType() === DocumentApp.ElementType.PARAGRAPH) {
      paragraph.asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER);
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
      
      // Store the name value before replacement for formatting
      const nameValue = fieldValues['{NAME}'] || recipientName || '';
      
      // Replace all field placeholders
      for (const [placeholder, value] of Object.entries(fieldValues)) {
        body.replaceText(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), value || '');
      }
      
      // Apply smart formatting to the name to ensure it fits on one line
      if (nameValue) {
        adjustNameFormatting(body, nameValue);
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
      
      // Generate PDF for each recipient
      for (const recipient of data.recipients) {
        // Prepare field values for this recipient
        const recipientFieldValues = { ...data.fieldValues };
        // Only use recipient name if no custom {NAME} value was provided
        if (!recipientFieldValues['{NAME}'] || recipientFieldValues['{NAME}'].trim() === '') {
          recipientFieldValues['{NAME}'] = recipient.name;
        }
        
        const result = generatePdfFromTemplate(
          data.templateUrl,
          recipientFieldValues,
          recipient.name
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
    
    // Get settings for email
    const settingsResult = getSettings();
    const settings = settingsResult.data || {};
    const senderName = settings.SenderName?.value || 'YSP Tagum Chapter';
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
        // Only use recipient name as fallback if no custom {NAME} value was provided
        // This allows users to set custom values like "Dear Love" when needed
        if (!recipientFieldValues['{NAME}'] || recipientFieldValues['{NAME}'].trim() === '') {
          recipientFieldValues['{NAME}'] = recipient.RecipientName;
        }

        // Generate PDF
        const pdfResult = generatePdfFromTemplate(
          templateUrl,
          recipientFieldValues,
          recipient.RecipientName
        );
        
        if (!pdfResult.success) {
          throw new Error(pdfResult.error);
        }
        
        // Build HTML email body
        const emailMessage = issuance.EmailMessage || 'Please find attached your document from YSP Tagum Chapter.';
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
    
    // Get settings for email
    const settingsResult = getSettings();
    const settings = settingsResult.data || {};
    const senderName = settings.SenderName?.value || 'YSP Tagum Chapter';
    const emailFooter = settings.EmailFooter?.value || '';
    
    try {
      // Prepare field values for this recipient
      const recipientFieldValues = { ...fieldInputs };
      // Only use recipient name as fallback if no custom {NAME} value was provided
      if (!recipientFieldValues['{NAME}'] || recipientFieldValues['{NAME}'].trim() === '') {
        recipientFieldValues['{NAME}'] = recipient.RecipientName;
      }
      
      // Generate PDF
      const pdfResult = generatePdfFromTemplate(
        templateUrl,
        recipientFieldValues,
        recipient.RecipientName
      );
      
      if (!pdfResult.success) {
        throw new Error(pdfResult.error);
      }
      
      // Build HTML email body
      const emailMessage = issuance.EmailMessage || 'Please find attached your document from YSP Tagum Chapter.';
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
      
      // Update issuance sent count
      const ss = SpreadsheetApp.openById(ISSUANCE_CONFIG.SPREADSHEET_ID);
      const issuanceSheet = ss.getSheetByName(ISSUANCE_CONFIG.SHEETS.ISSUANCES);
      const dataRange = issuanceSheet.getDataRange();
      const values = dataRange.getValues();
      const headers = values[0];
      
      for (let i = 1; i < values.length; i++) {
        if (values[i][0] === issuanceId) {
          const sentCountIdx = headers.indexOf('SentCount');
          const failedCountIdx = headers.indexOf('FailedCount');
          values[i][sentCountIdx] = (parseInt(values[i][sentCountIdx]) || 0) + 1;
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
      const DIRECTORY_SPREADSHEET_ID = '1vaQZoPq5a_verhICIiWXudBjAmfgFSIbaBX5xt9kjMk';
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
    // Return standard YSP committees
    return {
      success: true,
      data: [
        { id: 'executive', name: 'Executive Committee' },
        { id: 'environmental', name: 'Environmental Conservation' },
        { id: 'youth-dev', name: 'Youth Development' },
        { id: 'outreach', name: 'Community Outreach' },
        { id: 'education', name: 'Education and Scholarship' },
        { id: 'health', name: 'Health and Wellness' },
        { id: 'sports', name: 'Sports and Recreation' },
        { id: 'finance', name: 'Finance and Resource Mobilization' },
        { id: 'communications', name: 'Communications and Media' },
        { id: 'membership', name: 'Membership and Recruitment' },
        { id: 'events', name: 'Events and Programs' },
        { id: 'documentation', name: 'Documentation and Records' }
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
      
      // Spreadsheet IDs - same as used in Attendance_Main.gs
      const ATTENDANCE_SPREADSHEET_ID = '1Xn7w9kzNrP6dmZXYXjxaO11Lmao79wn9w1SPCiqFtcA';
      const LOGIN_SPREADSHEET_ID = '1vaQZoPq5a_verhICIiWXudBjAmfgFSIbaBX5xt9kjMk';
      
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
  function buildIssuanceEmailHtml(recipientName, subject, message, footer) {
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
                  <div class="font-header" style="color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; margin: 0;">Youth Service Philippines</div>
                  <div class="font-body" style="color: rgba(255,255,255,0.9); font-size: 14px; margin-top: 6px; font-weight: 500;">Tagum Chapter</div>
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
                      <span style="font-size: 20px;">📎</span>
                      <span class="font-body" style="color: #4a5568; font-size: 14px;">Your document is attached to this email. Please download and save it for your records.</span>
                    </div>
                  </div>
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
                    &copy; 2026 Youth Service Philippines - Tagum Chapter.<br>
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
