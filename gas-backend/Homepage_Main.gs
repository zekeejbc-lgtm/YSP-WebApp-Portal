/**
 * Google Apps Script - Homepage Main Content API
 * 
 * SETUP INSTRUCTIONS:
 * 1. Create a new Google Spreadsheet
 * 2. Rename the first sheet to "Homepage_Main"
 * 3. Set up headers in Row 1 (A1 to K1):
 *    A1: Main Heading
 *    B1: Sub Heading
 *    C1: Tagline
 *    D1: Section Title_About Us
 *    E1: Content_About Us
 *    F1: Section Title_Our Mission
 *    G1: Content_Our Mission
 *    H1: Section Title_Our Vision
 *    I1: Content_Our Vision
 *    J1: Section Title_Our Advocacy Pillars
 *    K1: Content_Our Advocacy Pillars
 * 
 * 4. Add your content in Row 2 (A2 to K2)
 * 5. Go to Extensions > Apps Script
 * 6. Paste this code
 * 7. Deploy as Web App:
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 8. Copy the Web App URL and add it to your .env file as VITE_GAS_HOMEPAGE_API_URL
 */

// Configuration
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

/**
 * Handle GET requests - Fetch homepage content
 */
function doGet(e) {
  try {
    // Handle health check
    if (e && e.parameter && e.parameter.action === 'health') {
      return createJsonResponse({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString()
      });
    }

    // Fetch homepage content
    const content = getHomepageContent();
    
    return createJsonResponse({
      success: true,
      data: content,
      timestamp: new Date().toISOString()
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
 * Handle POST requests - Update homepage content
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    
    if (payload.action === 'update' && payload.data) {
      const success = updateHomepageContent(payload.data);
      
      return createJsonResponse({
        success: success,
        message: success ? 'Content updated successfully' : 'Failed to update content',
        timestamp: new Date().toISOString()
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
