  /**
  * Google Apps Script - Homepage & Projects Management API
  * 
  * SETUP INSTRUCTIONS:
  * ... (Use the Diagnostic Tool below to check setup) ...
  */

  /**
  * 🕵️‍♂️ FULL SYSTEM DIAGNOSIS 🕵️‍♂️
  * 
  * Instructions:
  * 1. Select 'runFullDiagnosis' from the toolbar function dropdown.
  * 2. Click 'Run'.
  * 3. Checking the "Execution Log" at the bottom:
  *    - If you see "✅ SYSTEM HEALTHY", you HAVE permissions (even if it didn't ask).
  *    - If you see "❌ FAILED", it will tell you exactly why.
  */
  function runFullDiagnosis() {
    console.log('--- STARTING DIAGNOSIS ---');
    
    // 1. Check User Identity
    const user = Session.getActiveUser().getEmail();
    const effective = Session.getEffectiveUser().getEmail();
    console.log(`👤 User: ${user}`);
    console.log(`🤖 Effective Execution User: ${effective}`);
    
    // 2. Check Drive Permissions (The common failure point)
    try {
      const folderId = PROJECTS_CONFIG.DRIVE_FOLDER_ID;
      console.log(`📂 Checking Drive Folder ID: ${folderId}`);
      
      // Test 1: Generic Drive Access
      const root = DriveApp.getRootFolder(); 
      console.log('   ✅ Basic Drive Access: GRANTED');
      
      // Test 2: Specific Folder Access
      const folder = DriveApp.getFolderById(folderId);
      console.log(`   ✅ Project Folder Access: GRANTED (Found "${folder.getName()}")`);
      
      // Test 3: Create Permission (Simulate Upload)
      const testFile = folder.createFile('permission_check.txt', 'This is a test file to verify write access.');
      console.log('   ✅ Write/Create Access: GRANTED');
      testFile.setTrashed(true); // Clean up
      console.log('   ✅ Delete/Cleanup Access: GRANTED');
      
    } catch (e) {
      console.error('   ❌ DRIVE ERROR: ' + e.toString());
      console.log('      SOLUTION: Run this function again. If prompt appears, click Allow.');
      console.log('      If no prompt appears, check your DRIVE_FOLDER_ID is correct.');
    }

    // 3. Check Spreadsheet Permissions
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      console.log(`📊 Spreadsheet Access: GRANTED (Found "${ss.getName()}")`);
    } catch (e) {
      console.error('   ❌ SPREADSHEET ERROR: ' + e.toString());
    }

    console.log('--- DIAGNOSIS COMPLETE ---');
  }

  /**
  * ⚠️ OLD SETUP FUNCTION - IGNORE ⚠️
  */
  function forcePermissions() {
    runFullDiagnosis(); // Redirect to diagnosis
  }

  // Configuration - Homepage
  const CONFIG = {
    SHEET_NAME: 'Homepage_Main',
    HEADER_ROW: 1,
    DATA_ROW: 2,
    COLUMNS: {
      MAIN_HEADING: 1,        // Column A
      SUB_HEADING: 2,         // Column B
      TAGLINE: 3,             // Column C
      ABOUT_TITLE: 4,         // Column D
      ABOUT_CONTENT: 5,       // Column E
      MISSION_TITLE: 6,       // Column F
      MISSION_CONTENT: 7,     // Column G
      VISION_TITLE: 8,        // Column H
      VISION_CONTENT: 9,      // Column I
      ADVOCACY_TITLE: 10,     // Column J
      ADVOCACY_CONTENT: 11,   // Column K
    }
  };

  // Configuration - Projects
  const PROJECTS_CONFIG = {
    SHEET_NAME: 'Homepage_Projects',
    DRIVE_FOLDER_ID: '1ACiv3LS5PrvNiQdscXCbCDzSC2phav3s', // UPDATE WITH YOUR FOLDER ID
    HEADER_ROW: 1,
    COLUMNS: {
      PROJECT_ID: 1,      // Column A
      TITLE: 2,           // Column B
      DESCRIPTION: 3,     // Column C
      IMAGE_URL: 4,       // Column D
      LINK: 5,            // Column E
      LINK_TEXT: 6,       // Column F
      STATUS: 7,          // Column G
    }
  };

  // Configuration - Homepage_Other (Contact Section)
  const HOMEPAGE_OTHER_CONFIG = {
    SHEET_NAME: 'Homepage_Other',
    // Drive folder for Org Chart uploads
    ORG_CHART_FOLDER_ID: '1_k7uANemaDnWPTUY1piYOcJg0lBiW_H-',
    HEADER_ROW: 1,
    DATA_ROW: 2,
    // Fixed columns (Row 2 values)
    COLUMNS: {
      SECTION_TITLE: 1,        // Column A - "Get in Touch"
      ORGCHART_URL: 2,         // Column B - Org Chart Image URL
      ORG_EMAIL: 3,            // Column C - Email
      ORG_PHONE: 4,            // Column D - Phone
      ORG_LOCATION: 5,         // Column E - Location text
      ORG_GOOGLE_MAP_URL: 6,   // Column F - Google Maps link
      PARTNER_TITLE: 7,        // Column G - Partnership section title
      PARTNER_DESCRIPTION: 8,  // Column H - Partnership description
      PARTNER_BUTTON_TEXT: 9,  // Column I - Button text
      PARTNER_GFORM_URL: 10,   // Column J - Google Form link
      SOCIAL_URL: 11,          // Column K - Social URLs (dynamic rows)
      SOCIAL_DISPLAY_NAME: 12, // Column L - Social Display Names (dynamic rows)
    }
  };

  // Configuration - Homepage_Dev Info (Developer Profile)
  const HOMEPAGE_DEV_INFO_CONFIG = {
    SHEET_NAME: 'Homepage_Dev Info',
    // Drive folder for Profile image uploads
    PROFILE_FOLDER_ID: '1gofrR_P3W3G2FPI_VPejv6JLVgivQAiz',
    HEADER_ROW: 1,
    DATA_ROW: 2,
    COLUMNS: {
      PROFILE_URL: 1,              // Column A - Profile Image URL
      NAME: 2,                     // Column B - Full Name
      NICKNAME: 3,                 // Column C - Nickname
      POSITION: 4,                 // Column D - Position
      ORGANIZATION: 5,             // Column E - Organization
      ABOUT: 6,                    // Column F - About
      BACKGROUND: 7,               // Column G - Background
      DEV_PHILOSOPHY: 8,           // Column H - Development Philosophy
      EMAIL: 9,                    // Column I - Email
      PHONE: 10,                   // Column J - Phone
      LOCATION: 11,                // Column K - Location
      AFFILIATION_ORG_NAME: 12,    // Column L - Affiliation Org Names (dynamic rows)
      AFFILIATION_POSITION: 13,    // Column M - Affiliation Positions (dynamic rows)
      SOCIAL_LINKS: 14,            // Column N - Social Links (dynamic rows)
    }
  };

  // Configuration - Homepage_Founder Info (Founder Profile)
  const HOMEPAGE_FOUNDER_INFO_CONFIG = {
    SHEET_NAME: 'Homepage_Founder Info',
    // Drive folder for Founder Profile image uploads
    PROFILE_FOLDER_ID: '1Myzg0iFO8yY3Hs-uX1D7HzFlMHfBEASU',
    HEADER_ROW: 1,
    DATA_ROW: 2,
    COLUMNS: {
      PROFILE_URL: 1,              // Column A - Profile Image URL
      NAME: 2,                     // Column B - Full Name
      NICKNAME: 3,                 // Column C - Nickname
      POSITION: 4,                 // Column D - Position
      ABOUT: 5,                    // Column E - About
      BACKGROUND: 6,               // Column F - Background
      ORGANIZATIONAL_IMPACT: 7,    // Column G - Organizational Impact
      LEADERSHIP_PHILOSOPHY: 8,    // Column H - Leadership Philosophy
      EMAIL: 9,                    // Column I - Email
      PHONE: 10,                   // Column J - Phone
      OFFICE_LOCATION: 11,         // Column K - Office Location
      KEY_ACHIEVEMENTS: 12,        // Column L - Key Achievements (dynamic rows)
      SOCIAL_LINKS: 13,            // Column M - Social Links (dynamic rows)
    }
  };

  /**
  * Handle GET requests - Fetch homepage or projects content
  */
  function doGet(e) {
    try {
      const action = e && e.parameter ? e.parameter.action : 'getHomepage';

      // Handle health check
      if (action === 'health') {
        return createJsonResponse({
          success: true,
          status: 'healthy',
          timestamp: new Date().toISOString()
        });
      }

      // Get homepage content
      if (action === 'getHomepage' || !action) {
        const content = getHomepageContent();
        return createJsonResponse({
          success: true,
          data: content,
          timestamp: new Date().toISOString()
        });
      }

      // Get all projects
      if (action === 'getProjects') {
        const projects = getAllProjects();
        return createJsonResponse({
          success: true,
          data: projects,
          timestamp: new Date().toISOString()
        });
      }

      // Get Homepage_Other (Contact Section) content
      if (action === 'getHomepageOther') {
        const content = getHomepageOtherContent();
        return createJsonResponse({
          success: true,
          data: content,
          timestamp: new Date().toISOString()
        });
      }

      // Get Homepage_Dev Info (Developer Profile) content
      if (action === 'getDevInfo') {
        const content = getDevInfoContent();
        return createJsonResponse({
          success: true,
          data: content,
          timestamp: new Date().toISOString()
        });
      }

      // Get Homepage_Founder Info (Founder Profile) content
      if (action === 'getFounderInfo') {
        const content = getFounderInfoContent();
        return createJsonResponse({
          success: true,
          data: content,
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
        error: error.message || 'Unknown error occurred',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
  * Handle POST requests - Update homepage or manage projects
  */
  function doPost(e) {
    try {
      const payload = JSON.parse(e.postData.contents);
      
      // Homepage update
      if (payload.action === 'updateHomepage' && payload.data) {
        const success = updateHomepageContent(payload.data);
        return createJsonResponse({
          success: success,
          message: success ? 'Content updated successfully' : 'Failed to update content',
          timestamp: new Date().toISOString()
        });
      }

      // Project management
      if (payload.action === 'addProject') {
        const result = addProject(payload.data);
        return createJsonResponse({
          success: result.success,
          message: result.message,
          projectId: result.projectId,
          data: result.data
        });
      }

      if (payload.action === 'updateProject') {
        const result = updateProject(payload.projectId, payload.data);
        return createJsonResponse({
          success: result.success,
          message: result.message
        });
      }

      if (payload.action === 'deleteProject') {
        const result = deleteProject(payload.projectId);
        return createJsonResponse({
          success: result.success,
          message: result.message
        });
      }

      if (payload.action === 'uploadImage') {
        const result = handleImageUpload(payload.fileName, payload.fileData);
        return createJsonResponse({
          success: result.success,
          imageUrl: result.imageUrl,
          message: result.message
        });
      }

      if (payload.action === 'uploadProjectImage') {
        const result = handleImageUpload(payload.fileName, payload.base64Data);
        return createJsonResponse({
          success: result.success,
          data: {
            imageUrl: result.imageUrl,
            message: result.message
          }
        });
      }

      // Homepage_Other (Contact Section) update
      if (payload.action === 'updateHomepageOther' && payload.data) {
        const success = updateHomepageOtherContent(payload.data);
        return createJsonResponse({
          success: success,
          message: success ? 'Contact section updated successfully' : 'Failed to update contact section',
          timestamp: new Date().toISOString()
        });
      }

      // Upload Org Chart image
      if (payload.action === 'uploadOrgChart') {
        const result = handleOrgChartUpload(payload.fileName, payload.fileData);
        return createJsonResponse({
          success: result.success,
          imageUrl: result.imageUrl,
          message: result.message
        });
      }

      // Add new social link
      if (payload.action === 'addSocialLink' && payload.data) {
        const result = addSocialLink(payload.data.url, payload.data.displayName);
        return createJsonResponse({
          success: result.success,
          message: result.message,
          data: result.data
        });
      }

      // Remove social link
      if (payload.action === 'removeSocialLink' && payload.index !== undefined) {
        const result = removeSocialLink(payload.index);
        return createJsonResponse({
          success: result.success,
          message: result.message
        });
      }

      // Update social link
      if (payload.action === 'updateSocialLink' && payload.data) {
        const result = updateSocialLink(payload.index, payload.data.url, payload.data.displayName);
        return createJsonResponse({
          success: result.success,
          message: result.message
        });
      }

      // ==================== DEV INFO ACTIONS ====================

      // Update Dev Info content
      if (payload.action === 'updateDevInfo' && payload.data) {
        const success = updateDevInfoContent(payload.data);
        return createJsonResponse({
          success: success,
          message: success ? 'Developer info updated successfully' : 'Failed to update developer info',
          timestamp: new Date().toISOString()
        });
      }

      // Upload Dev Profile image
      if (payload.action === 'uploadDevProfile') {
        const result = handleDevProfileUpload(payload.fileName, payload.fileData);
        return createJsonResponse({
          success: result.success,
          imageUrl: result.imageUrl,
          message: result.message
        });
      }

      // Add new affiliation
      if (payload.action === 'addDevAffiliation' && payload.data) {
        const result = addDevAffiliation(payload.data.orgName, payload.data.position);
        return createJsonResponse({
          success: result.success,
          message: result.message,
          data: result.data
        });
      }

      // Remove affiliation
      if (payload.action === 'removeDevAffiliation' && payload.index !== undefined) {
        const result = removeDevAffiliation(payload.index);
        return createJsonResponse({
          success: result.success,
          message: result.message
        });
      }

      // Update affiliation
      if (payload.action === 'updateDevAffiliation' && payload.data) {
        const result = updateDevAffiliation(payload.index, payload.data.orgName, payload.data.position);
        return createJsonResponse({
          success: result.success,
          message: result.message
        });
      }

      // Add new dev social link
      if (payload.action === 'addDevSocialLink' && payload.data) {
        const result = addDevSocialLink(payload.data.url);
        return createJsonResponse({
          success: result.success,
          message: result.message,
          data: result.data
        });
      }

      // Remove dev social link
      if (payload.action === 'removeDevSocialLink' && payload.index !== undefined) {
        const result = removeDevSocialLink(payload.index);
        return createJsonResponse({
          success: result.success,
          message: result.message
        });
      }

      // Update dev social link
      if (payload.action === 'updateDevSocialLink' && payload.data) {
        const result = updateDevSocialLink(payload.index, payload.data.url);
        return createJsonResponse({
          success: result.success,
          message: result.message
        });
      }

      // ==================== FOUNDER INFO ACTIONS ====================

      // Update Founder Info content
      if (payload.action === 'updateFounderInfo' && payload.data) {
        const success = updateFounderInfoContent(payload.data);
        return createJsonResponse({
          success: success,
          message: success ? 'Founder info updated successfully' : 'Failed to update founder info',
          timestamp: new Date().toISOString()
        });
      }

      // Upload Founder Profile image
      if (payload.action === 'uploadFounderProfile') {
        const result = handleFounderProfileUpload(payload.fileName, payload.fileData);
        return createJsonResponse({
          success: result.success,
          imageUrl: result.imageUrl,
          message: result.message
        });
      }

      // Add new founder key achievement
      if (payload.action === 'addFounderAchievement' && payload.data) {
        const result = addFounderAchievement(payload.data.achievement);
        return createJsonResponse({
          success: result.success,
          message: result.message,
          data: result.data
        });
      }

      // Remove founder key achievement
      if (payload.action === 'removeFounderAchievement' && payload.index !== undefined) {
        const result = removeFounderAchievement(payload.index);
        return createJsonResponse({
          success: result.success,
          message: result.message
        });
      }

      // Update founder key achievement
      if (payload.action === 'updateFounderAchievement' && payload.data) {
        const result = updateFounderAchievement(payload.index, payload.data.achievement);
        return createJsonResponse({
          success: result.success,
          message: result.message
        });
      }

      // Add new founder social link
      if (payload.action === 'addFounderSocialLink' && payload.data) {
        const result = addFounderSocialLink(payload.data.url);
        return createJsonResponse({
          success: result.success,
          message: result.message,
          data: result.data
        });
      }

      // Remove founder social link
      if (payload.action === 'removeFounderSocialLink' && payload.index !== undefined) {
        const result = removeFounderSocialLink(payload.index);
        return createJsonResponse({
          success: result.success,
          message: result.message
        });
      }

      // Update founder social link
      if (payload.action === 'updateFounderSocialLink' && payload.data) {
        const result = updateFounderSocialLink(payload.index, payload.data.url);
        return createJsonResponse({
          success: result.success,
          message: result.message
        });
      }

      return createJsonResponse({
        success: false,
        error: 'Invalid action or missing data',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error in doPost:', error);
      return createJsonResponse({
        success: false,
        error: error.message || 'Unknown error occurred',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
  * Get homepage content from spreadsheet
  */
  function getHomepageContent() {
    const sheet = getSheet();
    const dataRow = CONFIG.DATA_ROW;
    const cols = CONFIG.COLUMNS;

    return {
      mainHeading: getCellValue(sheet, dataRow, cols.MAIN_HEADING),
      subHeading: getCellValue(sheet, dataRow, cols.SUB_HEADING),
      tagline: getCellValue(sheet, dataRow, cols.TAGLINE),
      aboutTitle: getCellValue(sheet, dataRow, cols.ABOUT_TITLE),
      aboutContent: getCellValue(sheet, dataRow, cols.ABOUT_CONTENT),
      missionTitle: getCellValue(sheet, dataRow, cols.MISSION_TITLE),
      missionContent: getCellValue(sheet, dataRow, cols.MISSION_CONTENT),
      visionTitle: getCellValue(sheet, dataRow, cols.VISION_TITLE),
      visionContent: getCellValue(sheet, dataRow, cols.VISION_CONTENT),
      advocacyPillarsTitle: getCellValue(sheet, dataRow, cols.ADVOCACY_TITLE),
      advocacyPillarsContent: getCellValue(sheet, dataRow, cols.ADVOCACY_CONTENT),
    };
  }

  /**
  * Update homepage content in spreadsheet
  */
  function updateHomepageContent(data) {
    try {
      const sheet = getSheet();
      const dataRow = CONFIG.DATA_ROW;
      const cols = CONFIG.COLUMNS;

      // Update each cell if data is provided
      if (data.mainHeading !== undefined) {
        sheet.getRange(dataRow, cols.MAIN_HEADING).setValue(data.mainHeading);
      }
      if (data.subHeading !== undefined) {
        sheet.getRange(dataRow, cols.SUB_HEADING).setValue(data.subHeading);
      }
      if (data.tagline !== undefined) {
        sheet.getRange(dataRow, cols.TAGLINE).setValue(data.tagline);
      }
      if (data.aboutTitle !== undefined) {
        sheet.getRange(dataRow, cols.ABOUT_TITLE).setValue(data.aboutTitle);
      }
      if (data.aboutContent !== undefined) {
        sheet.getRange(dataRow, cols.ABOUT_CONTENT).setValue(data.aboutContent);
      }
      if (data.missionTitle !== undefined) {
        sheet.getRange(dataRow, cols.MISSION_TITLE).setValue(data.missionTitle);
      }
      if (data.missionContent !== undefined) {
        sheet.getRange(dataRow, cols.MISSION_CONTENT).setValue(data.missionContent);
      }
      if (data.visionTitle !== undefined) {
        sheet.getRange(dataRow, cols.VISION_TITLE).setValue(data.visionTitle);
      }
      if (data.visionContent !== undefined) {
        sheet.getRange(dataRow, cols.VISION_CONTENT).setValue(data.visionContent);
      }
      if (data.advocacyPillarsTitle !== undefined) {
        sheet.getRange(dataRow, cols.ADVOCACY_TITLE).setValue(data.advocacyPillarsTitle);
      }
      if (data.advocacyPillarsContent !== undefined) {
        sheet.getRange(dataRow, cols.ADVOCACY_CONTENT).setValue(data.advocacyPillarsContent);
      }

      // Force spreadsheet to save
      SpreadsheetApp.flush();
      
      return true;
    } catch (error) {
      console.error('Error updating content:', error);
      return false;
    }
  }

  /**
  * Get the Homepage_Main sheet
  */
  function getSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    
    if (!sheet) {
      // Create the sheet if it doesn't exist
      sheet = ss.insertSheet(CONFIG.SHEET_NAME);
      initializeSheet(sheet);
    }
    
    return sheet;
  }

  /**
  * Initialize sheet with headers
  */
  function initializeSheet(sheet) {
    const headers = [
      'Main Heading',
      'Sub Heading',
      'Tagline',
      'Section Title_About Us',
      'Content_About Us',
      'Section Title_Our Mission',
      'Content_Our Mission',
      'Section Title_Our Vision',
      'Content_Our Vision',
      'Section Title_Our Advocacy Pillars',
      'Content_Our Advocacy Pillars'
    ];

    // Set headers in row 1
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // Set default values in row 2
    const defaultValues = [
      'Welcome to Youth Service Philippines',
      'Tagum Chapter',
      'Empowering youth to serve communities and build a better future for all Filipinos',
      'About Us',
      'Youth Service Philippines - Tagum Chapter is a dynamic organization dedicated to mobilizing Filipino youth.',
      'Our Mission',
      'To inspire and empower Filipino youth in Tagum City and Davao del Norte.',
      'Our Vision',
      'A community where every young person is actively engaged in building strong communities.',
      'Our Advocacy Pillars',
      'Education • Environment • Health & Wellness • Community Development • Leadership & Civic Engagement'
    ];
    
    sheet.getRange(2, 1, 1, defaultValues.length).setValues([defaultValues]);
    
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

  /**
  * Get cell value with fallback
  */
  function getCellValue(sheet, row, col) {
    const value = sheet.getRange(row, col).getValue();
    return value !== null && value !== undefined ? String(value) : '';
  }

  /**
  * Create JSON response with CORS headers
  */
  function createJsonResponse(data) {
    const output = ContentService.createTextOutput(JSON.stringify(data));
    output.setMimeType(ContentService.MimeType.JSON);
    return output;
  }

  /**
  * Test function - Run this to verify the setup
  */
  function testGetContent() {
    const content = getHomepageContent();
    console.log('Homepage Content:', JSON.stringify(content, null, 2));
  }

  /**
  * Setup function - Run this once to initialize the sheet
  */
  function setupSheet() {
    const sheet = getSheet();
    console.log('Sheet setup complete:', sheet.getName());
  }

  // ==================== PROJECTS MANAGEMENT ====================

  /**
  * Get all projects from spreadsheet
  */
  function getAllProjects() {
    const sheet = getProjectsSheet();
    const lastRow = sheet.getLastRow();
    
    if (lastRow < 2) {
      return [];
    }

    const range = sheet.getRange(2, 1, lastRow - 1, 7);
    const values = range.getValues();
    const projects = [];

    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      if (row[0]) { // If Project ID exists
        projects.push({
          projectId: row[0],
          title: row[1] || '',
          description: row[2] || '',
          imageUrl: row[3] || '',
          link: row[4] || '',
          linkText: row[5] || '',
          status: row[6] || 'Inactive'
        });
      }
    }

    return projects;
  }

  /**
  * Add new project to spreadsheet
  */
  function addProject(data) {
    try {
      const sheet = getProjectsSheet();
      const lastRow = sheet.getLastRow();
      const newRow = lastRow + 1;
      
      // Generate Project ID if not provided
      const projectId = data.projectId || 'PRJ-' + Utilities.getUuid().substring(0, 8);
      
      // Ensure imageUrl is a CORS-free public link
      let imageUrl = data.imageUrl || '';
      if (imageUrl && imageUrl.includes('drive.google.com')) {
        imageUrl = convertToCORSFreeLink(imageUrl);
      }

      const values = [
        projectId,
        data.title || '',
        data.description || '',
        imageUrl,
        data.link || '',
        data.linkText || '',
        data.status || 'Active'
      ];

      sheet.getRange(newRow, 1, 1, 7).setValues([values]);
      SpreadsheetApp.flush();

      return {
        success: true,
        message: 'Project added successfully',
        projectId: projectId,
        data: {
          projectId,
          title: data.title,
          description: data.description,
          imageUrl,
          link: data.link,
          linkText: data.linkText,
          status: data.status
        }
      };

    } catch (error) {
      console.error('Error adding project:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
  * Update existing project
  */
  function updateProject(projectId, data) {
    try {
      const sheet = getProjectsSheet();
      const lastRow = sheet.getLastRow();
      const col = PROJECTS_CONFIG.COLUMNS;
      
      // Find the row with this projectId
      let targetRow = -1;
      const range = sheet.getRange(2, 1, lastRow - 1, 1);
      const values = range.getValues();
      
      for (let i = 0; i < values.length; i++) {
        if (values[i][0] === projectId) {
          targetRow = i + 2;
          break;
        }
      }

      if (targetRow === -1) {
        return {
          success: false,
          message: 'Project not found'
        };
      }

      // Update fields
      if (data.title !== undefined) {
        sheet.getRange(targetRow, col.TITLE).setValue(data.title);
      }
      if (data.description !== undefined) {
        sheet.getRange(targetRow, col.DESCRIPTION).setValue(data.description);
      }
      if (data.imageUrl !== undefined) {
        // Get old image URL to delete the old file coming from Drive
        const oldImageUrl = sheet.getRange(targetRow, col.IMAGE_URL).getValue();
        if (oldImageUrl && oldImageUrl !== data.imageUrl) {
            deleteDriveFile(oldImageUrl);
        }

        let imageUrl = data.imageUrl;
        if (imageUrl && imageUrl.includes('drive.google.com')) {
          imageUrl = convertToCORSFreeLink(imageUrl);
        }
        sheet.getRange(targetRow, col.IMAGE_URL).setValue(imageUrl);
      }
      if (data.link !== undefined) {
        sheet.getRange(targetRow, col.LINK).setValue(data.link);
      }
      if (data.linkText !== undefined) {
        sheet.getRange(targetRow, col.LINK_TEXT).setValue(data.linkText);
      }
      if (data.status !== undefined) {
        sheet.getRange(targetRow, col.STATUS).setValue(data.status);
      }

      SpreadsheetApp.flush();

      return {
        success: true,
        message: 'Project updated successfully'
      };

    } catch (error) {
      console.error('Error updating project:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
  * Delete project from spreadsheet
  */
  function deleteProject(projectId) {
    try {
      const sheet = getProjectsSheet();
      const lastRow = sheet.getLastRow();
      
      // Find and delete the row
      let targetRow = -1;
      const range = sheet.getRange(2, 1, lastRow - 1, 1);
      const values = range.getValues();
      
      for (let i = 0; i < values.length; i++) {
        if (values[i][0] === projectId) {
          targetRow = i + 2;
          break;
        }
      }

      if (targetRow === -1) {
        return {
          success: false,
          message: 'Project not found'
        };
      }

      // Delete image from Drive first
      const imageUrl = sheet.getRange(targetRow, PROJECTS_CONFIG.COLUMNS.IMAGE_URL).getValue();
      deleteDriveFile(imageUrl);

      sheet.deleteRow(targetRow);
      SpreadsheetApp.flush();

      return {
        success: true,
        message: 'Project deleted successfully'
      };

    } catch (error) {
      console.error('Error deleting project:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
  * Helper to delete file from Drive
  */
  function deleteDriveFile(fileUrl) {
    try {
      if (!fileUrl) return;
      let fileId = '';
      
      // Extract ID logic similar to convertToCORSFreeLink
      if (fileUrl.includes('/file/d/')) {
        fileId = fileUrl.split('/file/d/')[1].split('/')[0];
      } else if (fileUrl.includes('id=')) {
        fileId = fileUrl.split('id=')[1].split('&')[0];
      } else if (fileUrl.includes('?id=')) {
        fileId = fileUrl.split('?id=')[1];
      }

      if (fileId) {
         DriveApp.getFileById(fileId).setTrashed(true);
      }
    } catch (e) {
      console.error('Error deleting file: ' + e.toString());
      // Don't throw error, just log it, so row deletion can proceed
    }
  }

  /**
  * Handle image upload to Google Drive
  * Expects base64 encoded file data
  */
  function handleImageUpload(fileName, base64Data) {
    try {
      const folder = DriveApp.getFolderById(PROJECTS_CONFIG.DRIVE_FOLDER_ID);
      
      // Decode base64 and create blob
      const decodedData = Utilities.base64Decode(base64Data);
      const blob = Utilities.newBlob(decodedData, 'image/jpeg', fileName);
      
      // Upload file to folder
      const file = folder.createFile(blob);
      
      // Set public sharing
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      
      // Get the CORS-free public link
      const publicLink = convertToCORSFreeLink(file.getUrl());
      
      return {
        success: true,
        imageUrl: publicLink,
        message: 'Image uploaded successfully',
        fileName: fileName
      };

    } catch (error) {
      console.error('Error uploading image:', error);
      return {
        success: false,
        message: 'Error uploading image: ' + error.toString()
      };
    }
  }

  /**
  * Convert Google Drive link to CORS-free public view link
  * Modified to strongly force thumbnail generation for better CORS support
  */
  function convertToCORSFreeLink(driveUrl) {
    try {
      // Extract file ID from various Google Drive URL formats
      let fileId = '';
      
      if (driveUrl.includes('/file/d/')) {
        fileId = driveUrl.split('/file/d/')[1].split('/')[0];
      } else if (driveUrl.includes('id=')) {
        fileId = driveUrl.split('id=')[1].split('&')[0];
      } else if (driveUrl.includes('?id=')) {
        fileId = driveUrl.split('?id=')[1];
      }

      if (!fileId) {
        return driveUrl; // Return original if can't parse
      }

      // Return Google Drive Thumbnail Link 
      // AND bypass virus scan warnings for larger images
      // sz=w4000 asks for a width of 4000px, ensuring high quality
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w4000`;

    } catch (error) {
      console.error('Error converting link:', error);
      return driveUrl;
    }
  }

  /**
  * Get or create the Projects sheet
  */
  function getProjectsSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(PROJECTS_CONFIG.SHEET_NAME);
    
    if (!sheet) {
      sheet = ss.insertSheet(PROJECTS_CONFIG.SHEET_NAME);
      initializeProjectsSheet(sheet);
    }
    
    return sheet;
  }

  /**
  * Initialize Projects sheet with headers
  */
  function initializeProjectsSheet(sheet) {
    const headers = ['ProjectID', 'Title', 'Description', 'ImageURL', 'Link', 'LinkText', 'Status'];
    
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

  // ==================== HOMEPAGE_OTHER (CONTACT SECTION) MANAGEMENT ====================

  /**
  * Get or create the Homepage_Other sheet
  */
  function getHomepageOtherSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(HOMEPAGE_OTHER_CONFIG.SHEET_NAME);
    
    if (!sheet) {
      sheet = ss.insertSheet(HOMEPAGE_OTHER_CONFIG.SHEET_NAME);
      initializeHomepageOtherSheet(sheet);
    }
    
    return sheet;
  }

  /**
  * Initialize Homepage_Other sheet with headers and default values
  */
  function initializeHomepageOtherSheet(sheet) {
    const headers = [
      'Section_Title',      // A
      'OrgChart_Url',       // B
      'Org_Email',          // C
      'Org_Phone',          // D
      'Org_Location',       // E
      'Org_GoogleMapURL',   // F
      'Partner_Title',      // G
      'Partner_Description', // H
      'Partner_Button_Text', // I
      'Partner_GformURL',   // J
      'Social_URL',         // K
      'Social_Display_Name' // L
    ];

    // Set headers in row 1
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // Set default values in row 2
    const defaultValues = [
      'Get in Touch',                                    // Section_Title
      '',                                                // OrgChart_Url (empty by default)
      'YSPTagumChapter@gmail.com',                       // Org_Email
      '+63 917 123 4567',                                // Org_Phone
      'Tagum City, Davao del Norte, Philippines',        // Org_Location
      'https://maps.google.com/?q=Tagum+City,Davao+del+Norte,Philippines', // Org_GoogleMapURL
      '🤝 Become Our Partner',                           // Partner_Title
      'Join us in making a difference in our community. Partner with YSP and help us create lasting impact through collaborative projects.', // Partner_Description
      'Partner with Us',                                 // Partner_Button_Text
      '',                                                // Partner_GformURL (empty by default)
      'https://www.facebook.com/YSPTagumChapter',        // Social_URL (first social link)
      'YSP Tagum Chapter'                                // Social_Display_Name (first social link)
    ];
    
    sheet.getRange(2, 1, 1, defaultValues.length).setValues([defaultValues]);
    
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

  /**
  * Get Homepage_Other content from spreadsheet
  */
  function getHomepageOtherContent() {
    const sheet = getHomepageOtherSheet();
    const dataRow = HOMEPAGE_OTHER_CONFIG.DATA_ROW;
    const cols = HOMEPAGE_OTHER_CONFIG.COLUMNS;
    const lastRow = sheet.getLastRow();

    // Get fixed data from row 2
    const fixedData = {
      sectionTitle: getCellValue(sheet, dataRow, cols.SECTION_TITLE),
      orgChartUrl: getCellValue(sheet, dataRow, cols.ORGCHART_URL),
      orgEmail: getCellValue(sheet, dataRow, cols.ORG_EMAIL),
      orgPhone: getCellValue(sheet, dataRow, cols.ORG_PHONE),
      orgLocation: getCellValue(sheet, dataRow, cols.ORG_LOCATION),
      orgGoogleMapUrl: getCellValue(sheet, dataRow, cols.ORG_GOOGLE_MAP_URL),
      partnerTitle: getCellValue(sheet, dataRow, cols.PARTNER_TITLE),
      partnerDescription: getCellValue(sheet, dataRow, cols.PARTNER_DESCRIPTION),
      partnerButtonText: getCellValue(sheet, dataRow, cols.PARTNER_BUTTON_TEXT),
      partnerGformUrl: getCellValue(sheet, dataRow, cols.PARTNER_GFORM_URL),
    };

    // Get social links from all rows (starting at row 2)
    const socialLinks = [];
    for (let row = dataRow; row <= lastRow; row++) {
      const url = getCellValue(sheet, row, cols.SOCIAL_URL);
      const displayName = getCellValue(sheet, row, cols.SOCIAL_DISPLAY_NAME);
      
      // Only add if URL exists
      if (url && url.trim() !== '') {
        socialLinks.push({
          id: row - 1, // Use row number as ID (1-indexed from data rows)
          url: url,
          displayName: displayName || ''
        });
      }
    }

    return {
      ...fixedData,
      socialLinks: socialLinks
    };
  }

  /**
  * Update Homepage_Other content in spreadsheet
  */
  function updateHomepageOtherContent(data) {
    try {
      const sheet = getHomepageOtherSheet();
      const dataRow = HOMEPAGE_OTHER_CONFIG.DATA_ROW;
      const cols = HOMEPAGE_OTHER_CONFIG.COLUMNS;

      // Update fixed fields (only if provided)
      if (data.sectionTitle !== undefined) {
        sheet.getRange(dataRow, cols.SECTION_TITLE).setValue(data.sectionTitle);
      }
      if (data.orgChartUrl !== undefined) {
        // Handle org chart URL update - delete old file if different
        const oldUrl = sheet.getRange(dataRow, cols.ORGCHART_URL).getValue();
        if (oldUrl && oldUrl !== data.orgChartUrl) {
          deleteDriveFile(oldUrl);
        }
        let orgChartUrl = data.orgChartUrl;
        if (orgChartUrl && orgChartUrl.includes('drive.google.com')) {
          orgChartUrl = convertToCORSFreeLink(orgChartUrl);
        }
        sheet.getRange(dataRow, cols.ORGCHART_URL).setValue(orgChartUrl);
      }
      if (data.orgEmail !== undefined) {
        sheet.getRange(dataRow, cols.ORG_EMAIL).setValue(data.orgEmail);
      }
      if (data.orgPhone !== undefined) {
        sheet.getRange(dataRow, cols.ORG_PHONE).setValue(data.orgPhone);
      }
      if (data.orgLocation !== undefined) {
        sheet.getRange(dataRow, cols.ORG_LOCATION).setValue(data.orgLocation);
      }
      if (data.orgGoogleMapUrl !== undefined) {
        sheet.getRange(dataRow, cols.ORG_GOOGLE_MAP_URL).setValue(data.orgGoogleMapUrl);
      }
      if (data.partnerTitle !== undefined) {
        sheet.getRange(dataRow, cols.PARTNER_TITLE).setValue(data.partnerTitle);
      }
      if (data.partnerDescription !== undefined) {
        sheet.getRange(dataRow, cols.PARTNER_DESCRIPTION).setValue(data.partnerDescription);
      }
      if (data.partnerButtonText !== undefined) {
        sheet.getRange(dataRow, cols.PARTNER_BUTTON_TEXT).setValue(data.partnerButtonText);
      }
      if (data.partnerGformUrl !== undefined) {
        sheet.getRange(dataRow, cols.PARTNER_GFORM_URL).setValue(data.partnerGformUrl);
      }

      // Update social links if provided (complete replacement)
      if (data.socialLinks !== undefined && Array.isArray(data.socialLinks)) {
        // Clear existing social links (columns K and L, from row 2 onwards)
        const lastRow = sheet.getLastRow();
        if (lastRow >= dataRow) {
          sheet.getRange(dataRow, cols.SOCIAL_URL, lastRow - dataRow + 1, 2).clearContent();
        }

        // Add new social links
        data.socialLinks.forEach((link, index) => {
          const row = dataRow + index;
          sheet.getRange(row, cols.SOCIAL_URL).setValue(link.url || '');
          sheet.getRange(row, cols.SOCIAL_DISPLAY_NAME).setValue(link.displayName || link.label || '');
        });
      }

      // Force spreadsheet to save
      SpreadsheetApp.flush();
      
      return true;
    } catch (error) {
      console.error('Error updating Homepage_Other content:', error);
      return false;
    }
  }

  /**
  * Add a new social link to the sheet
  */
  function addSocialLink(url, displayName) {
    try {
      const sheet = getHomepageOtherSheet();
      const cols = HOMEPAGE_OTHER_CONFIG.COLUMNS;
      const lastRow = sheet.getLastRow();
      const dataRow = HOMEPAGE_OTHER_CONFIG.DATA_ROW;

      // Find the next empty row for social links
      let nextRow = dataRow;
      for (let row = dataRow; row <= lastRow + 1; row++) {
        const existingUrl = getCellValue(sheet, row, cols.SOCIAL_URL);
        if (!existingUrl || existingUrl.trim() === '') {
          nextRow = row;
          break;
        }
        nextRow = row + 1;
      }

      sheet.getRange(nextRow, cols.SOCIAL_URL).setValue(url);
      sheet.getRange(nextRow, cols.SOCIAL_DISPLAY_NAME).setValue(displayName);
      SpreadsheetApp.flush();

      return {
        success: true,
        message: 'Social link added successfully',
        data: {
          id: nextRow - 1,
          url: url,
          displayName: displayName
        }
      };
    } catch (error) {
      console.error('Error adding social link:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
  * Remove a social link from the sheet
  * @param {number} index - The index of the social link (1-indexed from data rows)
  */
  function removeSocialLink(index) {
    try {
      const sheet = getHomepageOtherSheet();
      const cols = HOMEPAGE_OTHER_CONFIG.COLUMNS;
      const dataRow = HOMEPAGE_OTHER_CONFIG.DATA_ROW;
      const targetRow = dataRow + index - 1;

      // Clear the social link cells
      sheet.getRange(targetRow, cols.SOCIAL_URL).clearContent();
      sheet.getRange(targetRow, cols.SOCIAL_DISPLAY_NAME).clearContent();

      // Compact the list by shifting remaining links up
      const lastRow = sheet.getLastRow();
      for (let row = targetRow; row < lastRow; row++) {
        const nextUrl = getCellValue(sheet, row + 1, cols.SOCIAL_URL);
        const nextName = getCellValue(sheet, row + 1, cols.SOCIAL_DISPLAY_NAME);
        sheet.getRange(row, cols.SOCIAL_URL).setValue(nextUrl);
        sheet.getRange(row, cols.SOCIAL_DISPLAY_NAME).setValue(nextName);
      }

      // Clear the last row
      if (lastRow >= dataRow) {
        sheet.getRange(lastRow, cols.SOCIAL_URL).clearContent();
        sheet.getRange(lastRow, cols.SOCIAL_DISPLAY_NAME).clearContent();
      }

      SpreadsheetApp.flush();

      return {
        success: true,
        message: 'Social link removed successfully'
      };
    } catch (error) {
      console.error('Error removing social link:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
  * Update an existing social link
  * @param {number} index - The index of the social link (1-indexed from data rows)
  * @param {string} url - The new URL
  * @param {string} displayName - The new display name
  */
  function updateSocialLink(index, url, displayName) {
    try {
      const sheet = getHomepageOtherSheet();
      const cols = HOMEPAGE_OTHER_CONFIG.COLUMNS;
      const dataRow = HOMEPAGE_OTHER_CONFIG.DATA_ROW;
      const targetRow = dataRow + index - 1;

      if (url !== undefined) {
        sheet.getRange(targetRow, cols.SOCIAL_URL).setValue(url);
      }
      if (displayName !== undefined) {
        sheet.getRange(targetRow, cols.SOCIAL_DISPLAY_NAME).setValue(displayName);
      }

      SpreadsheetApp.flush();

      return {
        success: true,
        message: 'Social link updated successfully'
      };
    } catch (error) {
      console.error('Error updating social link:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
  * Handle Org Chart image upload to Google Drive
  * Uses the same mechanism as project image uploads
  */
  function handleOrgChartUpload(fileName, base64Data) {
    try {
      const folder = DriveApp.getFolderById(HOMEPAGE_OTHER_CONFIG.ORG_CHART_FOLDER_ID);
      
      // Delete any existing org chart file first
      const sheet = getHomepageOtherSheet();
      const existingUrl = getCellValue(sheet, HOMEPAGE_OTHER_CONFIG.DATA_ROW, HOMEPAGE_OTHER_CONFIG.COLUMNS.ORGCHART_URL);
      if (existingUrl) {
        deleteDriveFile(existingUrl);
      }
      
      // Decode base64 and create blob
      const decodedData = Utilities.base64Decode(base64Data);
      const blob = Utilities.newBlob(decodedData, 'image/jpeg', fileName);
      
      // Upload file to folder
      const file = folder.createFile(blob);
      
      // Set public sharing
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      
      // Get the CORS-free public link
      const publicLink = convertToCORSFreeLink(file.getUrl());
      
      // Update the sheet with the new URL
      sheet.getRange(HOMEPAGE_OTHER_CONFIG.DATA_ROW, HOMEPAGE_OTHER_CONFIG.COLUMNS.ORGCHART_URL).setValue(publicLink);
      SpreadsheetApp.flush();
      
      return {
        success: true,
        imageUrl: publicLink,
        message: 'Org chart uploaded successfully',
        fileName: fileName
      };

    } catch (error) {
      console.error('Error uploading org chart:', error);
      return {
        success: false,
        message: 'Error uploading org chart: ' + error.toString()
      };
    }
  }

  /**
  * Test function - Run this to verify Homepage_Other setup
  */
  function testGetHomepageOther() {
    const content = getHomepageOtherContent();
    console.log('Homepage_Other Content:', JSON.stringify(content, null, 2));
  }

  /**
  * Setup function - Run this once to initialize Homepage_Other sheet
  */
  function setupHomepageOtherSheet() {
    const sheet = getHomepageOtherSheet();
    console.log('Homepage_Other sheet setup complete:', sheet.getName());
  }

  // ==================== HOMEPAGE_DEV INFO (DEVELOPER PROFILE) MANAGEMENT ====================

  /**
  * Get or create the Homepage_Dev Info sheet
  */
  function getDevInfoSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(HOMEPAGE_DEV_INFO_CONFIG.SHEET_NAME);
    
    if (!sheet) {
      sheet = ss.insertSheet(HOMEPAGE_DEV_INFO_CONFIG.SHEET_NAME);
      initializeDevInfoSheet(sheet);
    }
    
    return sheet;
  }

  /**
  * Initialize Homepage_Dev Info sheet with headers and default values
  */
  function initializeDevInfoSheet(sheet) {
    const headers = [
      'Profile_URL',           // A
      'Name',                  // B
      'Nickname',              // C
      'Position',              // D
      'Organization',          // E
      'About',                 // F
      'Background',            // G
      'Development_Philosophy', // H
      'Email',                 // I
      'Phone',                 // J
      'Location',              // K
      'Affiliation_Org_Name',  // L
      'Affiliation_Position',  // M
      'Social_Links'           // N
    ];

    // Set headers in row 1
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // Set default values in row 2 (empty - to be filled by user)
    const defaultValues = [
      '',     // Profile_URL (empty by default)
      '',     // Name
      '',     // Nickname
      '',     // Position
      '',     // Organization
      '',     // About
      '',     // Background
      '',     // Development_Philosophy
      '',     // Email
      '',     // Phone
      '',     // Location
      '',     // Affiliation_Org_Name (empty by default)
      '',     // Affiliation_Position (empty by default)
      ''      // Social_Links (empty by default)
    ];
    
    sheet.getRange(2, 1, 1, defaultValues.length).setValues([defaultValues]);
    
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

  /**
  * Get Homepage_Dev Info content from spreadsheet
  */
  function getDevInfoContent() {
    const sheet = getDevInfoSheet();
    const dataRow = HOMEPAGE_DEV_INFO_CONFIG.DATA_ROW;
    const cols = HOMEPAGE_DEV_INFO_CONFIG.COLUMNS;
    const lastRow = sheet.getLastRow();

    // Get fixed data from row 2
    const fixedData = {
      profileUrl: getCellValue(sheet, dataRow, cols.PROFILE_URL),
      name: getCellValue(sheet, dataRow, cols.NAME),
      nickname: getCellValue(sheet, dataRow, cols.NICKNAME),
      position: getCellValue(sheet, dataRow, cols.POSITION),
      organization: getCellValue(sheet, dataRow, cols.ORGANIZATION),
      about: getCellValue(sheet, dataRow, cols.ABOUT),
      background: getCellValue(sheet, dataRow, cols.BACKGROUND),
      devPhilosophy: getCellValue(sheet, dataRow, cols.DEV_PHILOSOPHY),
      email: getCellValue(sheet, dataRow, cols.EMAIL),
      phone: getCellValue(sheet, dataRow, cols.PHONE),
      location: getCellValue(sheet, dataRow, cols.LOCATION),
    };

    // Get affiliations from all rows (starting at row 2)
    const affiliations = [];
    for (let row = dataRow; row <= lastRow; row++) {
      const orgName = getCellValue(sheet, row, cols.AFFILIATION_ORG_NAME);
      const position = getCellValue(sheet, row, cols.AFFILIATION_POSITION);
      
      // Only add if org name exists
      if (orgName && orgName.trim() !== '') {
        affiliations.push({
          id: row - 1, // Use row number as ID (1-indexed from data rows)
          orgName: orgName,
          position: position || ''
        });
      }
    }

    // Get social links from all rows (starting at row 2)
    const socialLinks = [];
    for (let row = dataRow; row <= lastRow; row++) {
      const url = getCellValue(sheet, row, cols.SOCIAL_LINKS);
      
      // Only add if URL exists
      if (url && url.trim() !== '') {
        socialLinks.push({
          id: row - 1, // Use row number as ID (1-indexed from data rows)
          url: url
        });
      }
    }

    return {
      ...fixedData,
      affiliations: affiliations,
      socialLinks: socialLinks
    };
  }

  /**
  * Update Homepage_Dev Info content in spreadsheet
  */
  function updateDevInfoContent(data) {
    try {
      const sheet = getDevInfoSheet();
      const dataRow = HOMEPAGE_DEV_INFO_CONFIG.DATA_ROW;
      const cols = HOMEPAGE_DEV_INFO_CONFIG.COLUMNS;

      // Update fixed fields (only if provided)
      if (data.profileUrl !== undefined) {
        // Handle profile URL update - delete old file if different
        const oldUrl = sheet.getRange(dataRow, cols.PROFILE_URL).getValue();
        if (oldUrl && oldUrl !== data.profileUrl) {
          deleteDriveFile(oldUrl);
        }
        let profileUrl = data.profileUrl;
        if (profileUrl && profileUrl.includes('drive.google.com')) {
          profileUrl = convertToCORSFreeLink(profileUrl);
        }
        sheet.getRange(dataRow, cols.PROFILE_URL).setValue(profileUrl);
      }
      if (data.name !== undefined) {
        sheet.getRange(dataRow, cols.NAME).setValue(data.name);
      }
      if (data.nickname !== undefined) {
        sheet.getRange(dataRow, cols.NICKNAME).setValue(data.nickname);
      }
      if (data.position !== undefined) {
        sheet.getRange(dataRow, cols.POSITION).setValue(data.position);
      }
      if (data.organization !== undefined) {
        sheet.getRange(dataRow, cols.ORGANIZATION).setValue(data.organization);
      }
      if (data.about !== undefined) {
        sheet.getRange(dataRow, cols.ABOUT).setValue(data.about);
      }
      if (data.background !== undefined) {
        sheet.getRange(dataRow, cols.BACKGROUND).setValue(data.background);
      }
      if (data.devPhilosophy !== undefined) {
        sheet.getRange(dataRow, cols.DEV_PHILOSOPHY).setValue(data.devPhilosophy);
      }
      if (data.email !== undefined) {
        sheet.getRange(dataRow, cols.EMAIL).setValue(data.email);
      }
      if (data.phone !== undefined) {
        sheet.getRange(dataRow, cols.PHONE).setValue(data.phone);
      }
      if (data.location !== undefined) {
        sheet.getRange(dataRow, cols.LOCATION).setValue(data.location);
      }

      // Update affiliations if provided (complete replacement)
      if (data.affiliations !== undefined && Array.isArray(data.affiliations)) {
        // Clear existing affiliations (columns L and M, from row 2 onwards)
        const lastRow = sheet.getLastRow();
        if (lastRow >= dataRow) {
          sheet.getRange(dataRow, cols.AFFILIATION_ORG_NAME, lastRow - dataRow + 1, 2).clearContent();
        }

        // Add new affiliations
        data.affiliations.forEach((aff, index) => {
          const row = dataRow + index;
          sheet.getRange(row, cols.AFFILIATION_ORG_NAME).setValue(aff.orgName || '');
          sheet.getRange(row, cols.AFFILIATION_POSITION).setValue(aff.position || '');
        });
      }

      // Update social links if provided (complete replacement)
      if (data.socialLinks !== undefined && Array.isArray(data.socialLinks)) {
        // Clear existing social links (column N, from row 2 onwards)
        const lastRow = sheet.getLastRow();
        if (lastRow >= dataRow) {
          sheet.getRange(dataRow, cols.SOCIAL_LINKS, lastRow - dataRow + 1, 1).clearContent();
        }

        // Add new social links
        data.socialLinks.forEach((link, index) => {
          const row = dataRow + index;
          sheet.getRange(row, cols.SOCIAL_LINKS).setValue(link.url || link || '');
        });
      }

      // Force spreadsheet to save
      SpreadsheetApp.flush();
      
      return true;
    } catch (error) {
      console.error('Error updating Dev Info content:', error);
      return false;
    }
  }

  /**
  * Handle Dev Profile image upload to Google Drive
  */
  function handleDevProfileUpload(fileName, base64Data) {
    try {
      const folder = DriveApp.getFolderById(HOMEPAGE_DEV_INFO_CONFIG.PROFILE_FOLDER_ID);
      
      // Delete any existing profile image first
      const sheet = getDevInfoSheet();
      const existingUrl = getCellValue(sheet, HOMEPAGE_DEV_INFO_CONFIG.DATA_ROW, HOMEPAGE_DEV_INFO_CONFIG.COLUMNS.PROFILE_URL);
      if (existingUrl) {
        deleteDriveFile(existingUrl);
      }
      
      // Decode base64 and create blob
      const decodedData = Utilities.base64Decode(base64Data);
      const blob = Utilities.newBlob(decodedData, 'image/jpeg', fileName);
      
      // Upload file to folder
      const file = folder.createFile(blob);
      
      // Set public sharing
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      
      // Get the CORS-free public link
      const publicLink = convertToCORSFreeLink(file.getUrl());
      
      // Update the sheet with the new URL
      sheet.getRange(HOMEPAGE_DEV_INFO_CONFIG.DATA_ROW, HOMEPAGE_DEV_INFO_CONFIG.COLUMNS.PROFILE_URL).setValue(publicLink);
      SpreadsheetApp.flush();
      
      return {
        success: true,
        imageUrl: publicLink,
        message: 'Profile image uploaded successfully',
        fileName: fileName
      };

    } catch (error) {
      console.error('Error uploading profile image:', error);
      return {
        success: false,
        message: 'Error uploading profile image: ' + error.toString()
      };
    }
  }

  /**
  * Add a new affiliation to the sheet
  */
  function addDevAffiliation(orgName, position) {
    try {
      const sheet = getDevInfoSheet();
      const cols = HOMEPAGE_DEV_INFO_CONFIG.COLUMNS;
      const lastRow = sheet.getLastRow();
      const dataRow = HOMEPAGE_DEV_INFO_CONFIG.DATA_ROW;

      // Find the next empty row for affiliations
      let nextRow = dataRow;
      for (let row = dataRow; row <= lastRow + 1; row++) {
        const existingOrg = getCellValue(sheet, row, cols.AFFILIATION_ORG_NAME);
        if (!existingOrg || existingOrg.trim() === '') {
          nextRow = row;
          break;
        }
        nextRow = row + 1;
      }

      sheet.getRange(nextRow, cols.AFFILIATION_ORG_NAME).setValue(orgName);
      sheet.getRange(nextRow, cols.AFFILIATION_POSITION).setValue(position);
      SpreadsheetApp.flush();

      return {
        success: true,
        message: 'Affiliation added successfully',
        data: {
          id: nextRow - 1,
          orgName: orgName,
          position: position
        }
      };
    } catch (error) {
      console.error('Error adding affiliation:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
  * Remove an affiliation from the sheet
  * @param {number} index - The index of the affiliation (1-indexed from data rows)
  */
  function removeDevAffiliation(index) {
    try {
      const sheet = getDevInfoSheet();
      const cols = HOMEPAGE_DEV_INFO_CONFIG.COLUMNS;
      const dataRow = HOMEPAGE_DEV_INFO_CONFIG.DATA_ROW;
      const targetRow = dataRow + index - 1;

      // Clear the affiliation cells
      sheet.getRange(targetRow, cols.AFFILIATION_ORG_NAME).clearContent();
      sheet.getRange(targetRow, cols.AFFILIATION_POSITION).clearContent();

      // Compact the list by shifting remaining affiliations up
      const lastRow = sheet.getLastRow();
      for (let row = targetRow; row < lastRow; row++) {
        const nextOrg = getCellValue(sheet, row + 1, cols.AFFILIATION_ORG_NAME);
        const nextPos = getCellValue(sheet, row + 1, cols.AFFILIATION_POSITION);
        sheet.getRange(row, cols.AFFILIATION_ORG_NAME).setValue(nextOrg);
        sheet.getRange(row, cols.AFFILIATION_POSITION).setValue(nextPos);
      }

      // Clear the last row
      if (lastRow >= dataRow) {
        sheet.getRange(lastRow, cols.AFFILIATION_ORG_NAME).clearContent();
        sheet.getRange(lastRow, cols.AFFILIATION_POSITION).clearContent();
      }

      SpreadsheetApp.flush();

      return {
        success: true,
        message: 'Affiliation removed successfully'
      };
    } catch (error) {
      console.error('Error removing affiliation:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
  * Update an existing affiliation
  * @param {number} index - The index of the affiliation (1-indexed from data rows)
  * @param {string} orgName - The new organization name
  * @param {string} position - The new position
  */
  function updateDevAffiliation(index, orgName, position) {
    try {
      const sheet = getDevInfoSheet();
      const cols = HOMEPAGE_DEV_INFO_CONFIG.COLUMNS;
      const dataRow = HOMEPAGE_DEV_INFO_CONFIG.DATA_ROW;
      const targetRow = dataRow + index - 1;

      if (orgName !== undefined) {
        sheet.getRange(targetRow, cols.AFFILIATION_ORG_NAME).setValue(orgName);
      }
      if (position !== undefined) {
        sheet.getRange(targetRow, cols.AFFILIATION_POSITION).setValue(position);
      }

      SpreadsheetApp.flush();

      return {
        success: true,
        message: 'Affiliation updated successfully'
      };
    } catch (error) {
      console.error('Error updating affiliation:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
  * Add a new dev social link to the sheet
  */
  function addDevSocialLink(url) {
    try {
      const sheet = getDevInfoSheet();
      const cols = HOMEPAGE_DEV_INFO_CONFIG.COLUMNS;
      const lastRow = sheet.getLastRow();
      const dataRow = HOMEPAGE_DEV_INFO_CONFIG.DATA_ROW;

      // Find the next empty row for social links
      let nextRow = dataRow;
      for (let row = dataRow; row <= lastRow + 1; row++) {
        const existingUrl = getCellValue(sheet, row, cols.SOCIAL_LINKS);
        if (!existingUrl || existingUrl.trim() === '') {
          nextRow = row;
          break;
        }
        nextRow = row + 1;
      }

      sheet.getRange(nextRow, cols.SOCIAL_LINKS).setValue(url);
      SpreadsheetApp.flush();

      return {
        success: true,
        message: 'Social link added successfully',
        data: {
          id: nextRow - 1,
          url: url
        }
      };
    } catch (error) {
      console.error('Error adding dev social link:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
  * Remove a dev social link from the sheet
  * @param {number} index - The index of the social link (1-indexed from data rows)
  */
  function removeDevSocialLink(index) {
    try {
      const sheet = getDevInfoSheet();
      const cols = HOMEPAGE_DEV_INFO_CONFIG.COLUMNS;
      const dataRow = HOMEPAGE_DEV_INFO_CONFIG.DATA_ROW;
      const targetRow = dataRow + index - 1;

      // Clear the social link cell
      sheet.getRange(targetRow, cols.SOCIAL_LINKS).clearContent();

      // Compact the list by shifting remaining links up
      const lastRow = sheet.getLastRow();
      for (let row = targetRow; row < lastRow; row++) {
        const nextUrl = getCellValue(sheet, row + 1, cols.SOCIAL_LINKS);
        sheet.getRange(row, cols.SOCIAL_LINKS).setValue(nextUrl);
      }

      // Clear the last row
      if (lastRow >= dataRow) {
        sheet.getRange(lastRow, cols.SOCIAL_LINKS).clearContent();
      }

      SpreadsheetApp.flush();

      return {
        success: true,
        message: 'Social link removed successfully'
      };
    } catch (error) {
      console.error('Error removing dev social link:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
  * Update an existing dev social link
  * @param {number} index - The index of the social link (1-indexed from data rows)
  * @param {string} url - The new URL
  */
  function updateDevSocialLink(index, url) {
    try {
      const sheet = getDevInfoSheet();
      const cols = HOMEPAGE_DEV_INFO_CONFIG.COLUMNS;
      const dataRow = HOMEPAGE_DEV_INFO_CONFIG.DATA_ROW;
      const targetRow = dataRow + index - 1;

      if (url !== undefined) {
        sheet.getRange(targetRow, cols.SOCIAL_LINKS).setValue(url);
      }

      SpreadsheetApp.flush();

      return {
        success: true,
        message: 'Social link updated successfully'
      };
    } catch (error) {
      console.error('Error updating dev social link:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
  * Test function - Run this to verify Homepage_Dev Info setup
  */
  function testGetDevInfo() {
    const content = getDevInfoContent();
    console.log('Homepage_Dev Info Content:', JSON.stringify(content, null, 2));
  }

  /**
  * Setup function - Run this once to initialize Homepage_Dev Info sheet
  */
  function setupDevInfoSheet() {
    const sheet = getDevInfoSheet();
    console.log('Homepage_Dev Info sheet setup complete:', sheet.getName());
  }

  // ==================== HOMEPAGE_FOUNDER INFO (FOUNDER PROFILE) MANAGEMENT ====================

  /**
  * Get or create the Homepage_Founder Info sheet
  */
  function getFounderInfoSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(HOMEPAGE_FOUNDER_INFO_CONFIG.SHEET_NAME);
    
    if (!sheet) {
      sheet = ss.insertSheet(HOMEPAGE_FOUNDER_INFO_CONFIG.SHEET_NAME);
      initializeFounderInfoSheet(sheet);
    }
    
    return sheet;
  }

  /**
  * Initialize Homepage_Founder Info sheet with headers and default values
  */
  function initializeFounderInfoSheet(sheet) {
    const headers = [
      'Profile_URL',           // A
      'Name',                  // B
      'Nickname',              // C
      'Position',              // D
      'About',                 // E
      'Background',            // F
      'Organizational_Impact', // G
      'Leadership_Philosophy', // H
      'Email',                 // I
      'Phone',                 // J
      'Office_Location',       // K
      'Key_Achievements',      // L
      'Social_Links'           // M
    ];

    // Set headers in row 1
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // Set default values in row 2 (empty - to be filled by user)
    const defaultValues = [
      '',     // Profile_URL (empty by default)
      '',     // Name
      '',     // Nickname
      '',     // Position
      '',     // About
      '',     // Background
      '',     // Organizational_Impact
      '',     // Leadership_Philosophy
      '',     // Email
      '',     // Phone
      '',     // Office_Location
      '',     // Key_Achievements (empty by default)
      ''      // Social_Links (empty by default)
    ];
    
    sheet.getRange(2, 1, 1, defaultValues.length).setValues([defaultValues]);
    
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

  /**
  * Get Homepage_Founder Info content from spreadsheet
  */
  function getFounderInfoContent() {
    const sheet = getFounderInfoSheet();
    const dataRow = HOMEPAGE_FOUNDER_INFO_CONFIG.DATA_ROW;
    const cols = HOMEPAGE_FOUNDER_INFO_CONFIG.COLUMNS;
    const lastRow = sheet.getLastRow();

    // Get fixed data from row 2
    const fixedData = {
      profileUrl: getCellValue(sheet, dataRow, cols.PROFILE_URL),
      name: getCellValue(sheet, dataRow, cols.NAME),
      nickname: getCellValue(sheet, dataRow, cols.NICKNAME),
      position: getCellValue(sheet, dataRow, cols.POSITION),
      about: getCellValue(sheet, dataRow, cols.ABOUT),
      background: getCellValue(sheet, dataRow, cols.BACKGROUND),
      organizationalImpact: getCellValue(sheet, dataRow, cols.ORGANIZATIONAL_IMPACT),
      leadershipPhilosophy: getCellValue(sheet, dataRow, cols.LEADERSHIP_PHILOSOPHY),
      email: getCellValue(sheet, dataRow, cols.EMAIL),
      phone: getCellValue(sheet, dataRow, cols.PHONE),
      officeLocation: getCellValue(sheet, dataRow, cols.OFFICE_LOCATION),
    };

    // Get key achievements from all rows (starting at row 2)
    const keyAchievements = [];
    for (let row = dataRow; row <= lastRow; row++) {
      const achievement = getCellValue(sheet, row, cols.KEY_ACHIEVEMENTS);
      
      // Only add if achievement exists
      if (achievement && achievement.trim() !== '') {
        keyAchievements.push({
          id: row - 1, // Use row number as ID (1-indexed from data rows)
          achievement: achievement
        });
      }
    }

    // Get social links from all rows (starting at row 2)
    const socialLinks = [];
    for (let row = dataRow; row <= lastRow; row++) {
      const url = getCellValue(sheet, row, cols.SOCIAL_LINKS);
      
      // Only add if URL exists
      if (url && url.trim() !== '') {
        socialLinks.push({
          id: row - 1, // Use row number as ID (1-indexed from data rows)
          url: url
        });
      }
    }

    return {
      ...fixedData,
      keyAchievements: keyAchievements,
      socialLinks: socialLinks
    };
  }

  /**
  * Update Homepage_Founder Info content in spreadsheet
  */
  function updateFounderInfoContent(data) {
    try {
      const sheet = getFounderInfoSheet();
      const dataRow = HOMEPAGE_FOUNDER_INFO_CONFIG.DATA_ROW;
      const cols = HOMEPAGE_FOUNDER_INFO_CONFIG.COLUMNS;

      // Update fixed fields (only if provided)
      if (data.profileUrl !== undefined) {
        // Handle profile URL update - delete old file if different
        const oldUrl = sheet.getRange(dataRow, cols.PROFILE_URL).getValue();
        if (oldUrl && oldUrl !== data.profileUrl) {
          deleteDriveFile(oldUrl);
        }
        let profileUrl = data.profileUrl;
        if (profileUrl && profileUrl.includes('drive.google.com')) {
          profileUrl = convertToCORSFreeLink(profileUrl);
        }
        sheet.getRange(dataRow, cols.PROFILE_URL).setValue(profileUrl);
      }
      if (data.name !== undefined) {
        sheet.getRange(dataRow, cols.NAME).setValue(data.name);
      }
      if (data.nickname !== undefined) {
        sheet.getRange(dataRow, cols.NICKNAME).setValue(data.nickname);
      }
      if (data.position !== undefined) {
        sheet.getRange(dataRow, cols.POSITION).setValue(data.position);
      }
      if (data.about !== undefined) {
        sheet.getRange(dataRow, cols.ABOUT).setValue(data.about);
      }
      if (data.background !== undefined) {
        sheet.getRange(dataRow, cols.BACKGROUND).setValue(data.background);
      }
      if (data.organizationalImpact !== undefined) {
        sheet.getRange(dataRow, cols.ORGANIZATIONAL_IMPACT).setValue(data.organizationalImpact);
      }
      if (data.leadershipPhilosophy !== undefined) {
        sheet.getRange(dataRow, cols.LEADERSHIP_PHILOSOPHY).setValue(data.leadershipPhilosophy);
      }
      if (data.email !== undefined) {
        sheet.getRange(dataRow, cols.EMAIL).setValue(data.email);
      }
      if (data.phone !== undefined) {
        sheet.getRange(dataRow, cols.PHONE).setValue(data.phone);
      }
      if (data.officeLocation !== undefined) {
        sheet.getRange(dataRow, cols.OFFICE_LOCATION).setValue(data.officeLocation);
      }

      // Update key achievements if provided (complete replacement)
      if (data.keyAchievements !== undefined && Array.isArray(data.keyAchievements)) {
        // Clear existing key achievements (column L, from row 2 onwards)
        const lastRow = sheet.getLastRow();
        if (lastRow >= dataRow) {
          sheet.getRange(dataRow, cols.KEY_ACHIEVEMENTS, lastRow - dataRow + 1, 1).clearContent();
        }

        // Add new key achievements
        data.keyAchievements.forEach((item, index) => {
          const row = dataRow + index;
          sheet.getRange(row, cols.KEY_ACHIEVEMENTS).setValue(item.achievement || item || '');
        });
      }

      // Update social links if provided (complete replacement)
      if (data.socialLinks !== undefined && Array.isArray(data.socialLinks)) {
        // Clear existing social links (column M, from row 2 onwards)
        const lastRow = sheet.getLastRow();
        if (lastRow >= dataRow) {
          sheet.getRange(dataRow, cols.SOCIAL_LINKS, lastRow - dataRow + 1, 1).clearContent();
        }

        // Add new social links
        data.socialLinks.forEach((link, index) => {
          const row = dataRow + index;
          sheet.getRange(row, cols.SOCIAL_LINKS).setValue(link.url || link || '');
        });
      }

      // Force spreadsheet to save
      SpreadsheetApp.flush();
      
      return true;
    } catch (error) {
      console.error('Error updating Founder Info content:', error);
      return false;
    }
  }

  /**
  * Handle Founder Profile image upload to Google Drive
  */
  function handleFounderProfileUpload(fileName, base64Data) {
    try {
      const folder = DriveApp.getFolderById(HOMEPAGE_FOUNDER_INFO_CONFIG.PROFILE_FOLDER_ID);
      
      // Delete any existing profile image first
      const sheet = getFounderInfoSheet();
      const existingUrl = getCellValue(sheet, HOMEPAGE_FOUNDER_INFO_CONFIG.DATA_ROW, HOMEPAGE_FOUNDER_INFO_CONFIG.COLUMNS.PROFILE_URL);
      if (existingUrl) {
        deleteDriveFile(existingUrl);
      }
      
      // Decode base64 and create blob
      const decodedData = Utilities.base64Decode(base64Data);
      const blob = Utilities.newBlob(decodedData, 'image/jpeg', fileName);
      
      // Upload file to folder
      const file = folder.createFile(blob);
      
      // Set public sharing
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      
      // Get the CORS-free public link
      const publicLink = convertToCORSFreeLink(file.getUrl());
      
      // Update the sheet with the new URL
      sheet.getRange(HOMEPAGE_FOUNDER_INFO_CONFIG.DATA_ROW, HOMEPAGE_FOUNDER_INFO_CONFIG.COLUMNS.PROFILE_URL).setValue(publicLink);
      SpreadsheetApp.flush();
      
      return {
        success: true,
        imageUrl: publicLink,
        message: 'Founder profile image uploaded successfully',
        fileName: fileName
      };

    } catch (error) {
      console.error('Error uploading founder profile image:', error);
      return {
        success: false,
        message: 'Error uploading founder profile image: ' + error.toString()
      };
    }
  }

  /**
  * Add a new key achievement to the sheet
  */
  function addFounderAchievement(achievement) {
    try {
      const sheet = getFounderInfoSheet();
      const cols = HOMEPAGE_FOUNDER_INFO_CONFIG.COLUMNS;
      const lastRow = sheet.getLastRow();
      const dataRow = HOMEPAGE_FOUNDER_INFO_CONFIG.DATA_ROW;

      // Find the next empty row for key achievements
      let nextRow = dataRow;
      for (let row = dataRow; row <= lastRow + 1; row++) {
        const existingAchievement = getCellValue(sheet, row, cols.KEY_ACHIEVEMENTS);
        if (!existingAchievement || existingAchievement.trim() === '') {
          nextRow = row;
          break;
        }
        nextRow = row + 1;
      }

      sheet.getRange(nextRow, cols.KEY_ACHIEVEMENTS).setValue(achievement);
      SpreadsheetApp.flush();

      return {
        success: true,
        message: 'Key achievement added successfully',
        data: {
          id: nextRow - 1,
          achievement: achievement
        }
      };
    } catch (error) {
      console.error('Error adding key achievement:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
  * Remove a key achievement from the sheet
  * @param {number} index - The index of the achievement (1-indexed from data rows)
  */
  function removeFounderAchievement(index) {
    try {
      const sheet = getFounderInfoSheet();
      const cols = HOMEPAGE_FOUNDER_INFO_CONFIG.COLUMNS;
      const dataRow = HOMEPAGE_FOUNDER_INFO_CONFIG.DATA_ROW;
      const targetRow = dataRow + index - 1;

      // Clear the key achievement cell
      sheet.getRange(targetRow, cols.KEY_ACHIEVEMENTS).clearContent();

      // Compact the list by shifting remaining achievements up
      const lastRow = sheet.getLastRow();
      for (let row = targetRow; row < lastRow; row++) {
        const nextAchievement = getCellValue(sheet, row + 1, cols.KEY_ACHIEVEMENTS);
        sheet.getRange(row, cols.KEY_ACHIEVEMENTS).setValue(nextAchievement);
      }

      // Clear the last row
      if (lastRow >= dataRow) {
        sheet.getRange(lastRow, cols.KEY_ACHIEVEMENTS).clearContent();
      }

      SpreadsheetApp.flush();

      return {
        success: true,
        message: 'Key achievement removed successfully'
      };
    } catch (error) {
      console.error('Error removing key achievement:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
  * Update an existing key achievement
  * @param {number} index - The index of the achievement (1-indexed from data rows)
  * @param {string} achievement - The new achievement text
  */
  function updateFounderAchievement(index, achievement) {
    try {
      const sheet = getFounderInfoSheet();
      const cols = HOMEPAGE_FOUNDER_INFO_CONFIG.COLUMNS;
      const dataRow = HOMEPAGE_FOUNDER_INFO_CONFIG.DATA_ROW;
      const targetRow = dataRow + index - 1;

      if (achievement !== undefined) {
        sheet.getRange(targetRow, cols.KEY_ACHIEVEMENTS).setValue(achievement);
      }

      SpreadsheetApp.flush();

      return {
        success: true,
        message: 'Key achievement updated successfully'
      };
    } catch (error) {
      console.error('Error updating key achievement:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
  * Add a new founder social link to the sheet
  */
  function addFounderSocialLink(url) {
    try {
      const sheet = getFounderInfoSheet();
      const cols = HOMEPAGE_FOUNDER_INFO_CONFIG.COLUMNS;
      const lastRow = sheet.getLastRow();
      const dataRow = HOMEPAGE_FOUNDER_INFO_CONFIG.DATA_ROW;

      // Find the next empty row for social links
      let nextRow = dataRow;
      for (let row = dataRow; row <= lastRow + 1; row++) {
        const existingUrl = getCellValue(sheet, row, cols.SOCIAL_LINKS);
        if (!existingUrl || existingUrl.trim() === '') {
          nextRow = row;
          break;
        }
        nextRow = row + 1;
      }

      sheet.getRange(nextRow, cols.SOCIAL_LINKS).setValue(url);
      SpreadsheetApp.flush();

      return {
        success: true,
        message: 'Social link added successfully',
        data: {
          id: nextRow - 1,
          url: url
        }
      };
    } catch (error) {
      console.error('Error adding founder social link:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
  * Remove a founder social link from the sheet
  * @param {number} index - The index of the social link (1-indexed from data rows)
  */
  function removeFounderSocialLink(index) {
    try {
      const sheet = getFounderInfoSheet();
      const cols = HOMEPAGE_FOUNDER_INFO_CONFIG.COLUMNS;
      const dataRow = HOMEPAGE_FOUNDER_INFO_CONFIG.DATA_ROW;
      const targetRow = dataRow + index - 1;

      // Clear the social link cell
      sheet.getRange(targetRow, cols.SOCIAL_LINKS).clearContent();

      // Compact the list by shifting remaining links up
      const lastRow = sheet.getLastRow();
      for (let row = targetRow; row < lastRow; row++) {
        const nextUrl = getCellValue(sheet, row + 1, cols.SOCIAL_LINKS);
        sheet.getRange(row, cols.SOCIAL_LINKS).setValue(nextUrl);
      }

      // Clear the last row
      if (lastRow >= dataRow) {
        sheet.getRange(lastRow, cols.SOCIAL_LINKS).clearContent();
      }

      SpreadsheetApp.flush();

      return {
        success: true,
        message: 'Social link removed successfully'
      };
    } catch (error) {
      console.error('Error removing founder social link:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
  * Update an existing founder social link
  * @param {number} index - The index of the social link (1-indexed from data rows)
  * @param {string} url - The new URL
  */
  function updateFounderSocialLink(index, url) {
    try {
      const sheet = getFounderInfoSheet();
      const cols = HOMEPAGE_FOUNDER_INFO_CONFIG.COLUMNS;
      const dataRow = HOMEPAGE_FOUNDER_INFO_CONFIG.DATA_ROW;
      const targetRow = dataRow + index - 1;

      if (url !== undefined) {
        sheet.getRange(targetRow, cols.SOCIAL_LINKS).setValue(url);
      }

      SpreadsheetApp.flush();

      return {
        success: true,
        message: 'Social link updated successfully'
      };
    } catch (error) {
      console.error('Error updating founder social link:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
  * Test function - Run this to verify Homepage_Founder Info setup
  */
  function testGetFounderInfo() {
    const content = getFounderInfoContent();
    console.log('Homepage_Founder Info Content:', JSON.stringify(content, null, 2));
  }

  /**
  * Setup function - Run this once to initialize Homepage_Founder Info sheet
  */
  function setupFounderInfoSheet() {
    const sheet = getFounderInfoSheet();
    console.log('Homepage_Founder Info sheet setup complete:', sheet.getName());
  }
