// Use PropertiesService for sensitive IDs — set these in Script Properties:
// FEEDBACK_SPREADSHEET_ID, FEEDBACK_SHEET_NAME, FEEDBACK_IMAGES_FOLDER_ID
const feedbackProps_ = PropertiesService.getScriptProperties();
const SPREADSHEET_ID = feedbackProps_.getProperty('FEEDBACK_SPREADSHEET_ID') || '';
const SHEET_NAME = feedbackProps_.getProperty('FEEDBACK_SHEET_NAME') || 'Feedbacks';
const FEEDBACK_IMAGES_FOLDER_ID = feedbackProps_.getProperty('FEEDBACK_IMAGES_FOLDER_ID') || '';

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

function requireAdminOrAuditor_(username, actionDescription) {
  if (!username) {
    return { success: false, status: 'error', message: 'Username is required for authorization', code: 400 };
  }
  var role = getUserRole_(username);
  if (role !== 'auditor' && role !== 'admin') {
    return { success: false, status: 'error', message: 'Only admins or auditors can ' + (actionDescription || 'perform this action'), code: 403 };
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

// ============================================================================
// AUTHORIZATION & DEBUG FUNCTIONS
// ============================================================================

/**
 * !!! RUN THIS FUNCTION FIRST !!!
 * 
 * This function forces the script to request the broadest Drive permissions.
 * If this still fails, you may need to:
 * 1. Reload the Apps Script tab in your browser.
 * 2. Go to Project Settings > General > "Change View" (if available) to ensure manifest is loaded.
 * 3. Manually add "Google Drive API" in the "Services" section on the left sidebar.
 */
function forceReauthorization_v2() {
  Logger.log('=== FORCING NEW AUTHORIZATION ===');
  
  // 1. Explicitly call the method requiring the broadest scope
  // We use a try-catch but we WANT the popup to trigger before the catch
  try {
    const folder = DriveApp.getFolderById(FEEDBACK_IMAGES_FOLDER_ID);
    Logger.log('✅ Access Successful! Folder Name: ' + folder.getName());
    Logger.log('You are fully authorized.');
  } catch (e) {
    Logger.log('❌ Still failing: ' + e.toString());
    Logger.log('ACTION REQUIRED: Click the "Services" + button on the left and add "Google Drive API".');
  }
}

/**
 * Original authorization function (kept for reference)
 */
function forceAuthorization() {
  Logger.log('=== AUTHORIZATION TEST STARTED ===');
  
  try {
    Logger.log('Testing SpreadsheetApp...');
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    Logger.log('✅ SpreadsheetApp: SUCCESS - Spreadsheet name: ' + ss.getName());
    
    Logger.log('Testing DriveApp...');
    const folder = DriveApp.getFolderById(FEEDBACK_IMAGES_FOLDER_ID);
    Logger.log('✅ DriveApp: SUCCESS - Folder name: ' + folder.getName());
    
    Logger.log('Testing file creation...');
    const testBlob = Utilities.newBlob('test', 'text/plain', 'authorization_test.txt');
    const testFile = folder.createFile(testBlob);
    Logger.log('✅ File creation: SUCCESS - File ID: ' + testFile.getId());
    
    testFile.setTrashed(true);
    Logger.log('✅ Cleanup: Test file deleted');
    
    Logger.log('=== ALL AUTHORIZATIONS SUCCESSFUL ===');
    
    return 'SUCCESS: All permissions granted!';
    
  } catch (error) {
    Logger.log('❌ ERROR: ' + error.toString());
    return 'ERROR: ' + error.toString();
  }
}

/**
 * STEP 2: Run this to test image upload after authorization.
 */
function testImageUpload() {
  Logger.log('=== IMAGE UPLOAD TEST ===');
  
  try {
    const folder = DriveApp.getFolderById(FEEDBACK_IMAGES_FOLDER_ID);
    Logger.log('✅ Folder access: ' + folder.getName());
    
    // Create a small test image (1x1 pixel transparent PNG)
    const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const decodedData = Utilities.base64Decode(testImageBase64);
    const blob = Utilities.newBlob(decodedData, 'image/png', 'test_upload_' + new Date().getTime() + '.png');
    
    const file = folder.createFile(blob);
    Logger.log('✅ File created: ' + file.getId());
    
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    Logger.log('✅ Sharing set');
    
    const publicUrl = 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w4000';
    Logger.log('✅ Public URL: ' + publicUrl);
    
    // Clean up
    file.setTrashed(true);
    Logger.log('✅ Test file cleaned up');
    
    Logger.log('=== IMAGE UPLOAD TEST PASSED ===');
    return 'SUCCESS: Image upload working!';
    
  } catch (error) {
    Logger.log('❌ ERROR: ' + error.toString());
    Logger.log('Run forceAuthorization() first!');
    return 'ERROR: ' + error.toString();
  }
}

/**
 * STEP 3: Run this to migrate existing image URLs in the sheet to the new format.
 */
function migrateImageUrls() {
  Logger.log('=== MIGRATION STARTED ===');
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    Logger.log('❌ Sheet not found');
    return 'Sheet not found';
  }

  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  const headers = values[0];
  
  // Find the 'imageUrl' column index
  const imageColIndex = headers.indexOf('imageUrl');
  
  if (imageColIndex === -1) {
    Logger.log('❌ imageUrl column not found');
    return 'imageUrl column not found';
  }
  
  let updatedCount = 0;
  
  // Iterate through rows (skipping header)
  for (let i = 1; i < values.length; i++) {
    const currentUrl = values[i][imageColIndex];
    
    // Check if it's a drive link that needs updating (has ID but not already in thumbnail format)
    if (currentUrl && typeof currentUrl === 'string' && currentUrl.includes('drive.google.com') && !currentUrl.includes('thumbnail?id=')) {
      
      let fileId = '';
      
      // Extract ID logic
      if (currentUrl.includes('/file/d/')) {
        fileId = currentUrl.split('/file/d/')[1].split('/')[0];
      } else if (currentUrl.includes('id=')) {
        fileId = currentUrl.split('id=')[1].split('&')[0];
      }
      
      if (fileId) {
        const newUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w4000';
        
        // Update the value in the array
        values[i][imageColIndex] = newUrl;
        
        // Update the specific cell
        sheet.getRange(i + 1, imageColIndex + 1).setValue(newUrl);
        updatedCount++;
        Logger.log(`Updated row ${i + 1}: ${currentUrl} -> ${newUrl}`);
      }
    }
  }
  
  Logger.log(`=== MIGRATION COMPLETE: Updated ${updatedCount} URLs ===`);
  return `Success: Updated ${updatedCount} URLs`;
}

/**
 * Debug function to check current permissions status
 */
function checkPermissions() {
  const results = {
    spreadsheet: false,
    drive: false,
    folder: false,
    timestamp: new Date().toISOString()
  };
  
  try {
    SpreadsheetApp.openById(SPREADSHEET_ID);
    results.spreadsheet = true;
  } catch (e) {
    results.spreadsheetError = e.toString();
  }
  
  try {
    DriveApp.getRootFolder();
    results.drive = true;
  } catch (e) {
    results.driveError = e.toString();
  }
  
  try {
    DriveApp.getFolderById(FEEDBACK_IMAGES_FOLDER_ID);
    results.folder = true;
  } catch (e) {
    results.folderError = e.toString();
  }
  
  Logger.log(JSON.stringify(results, null, 2));
  return results;
}

// ============================================================================
// MAIN WEB APP HANDLERS
// ============================================================================

function doGet(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const action = String(e.parameter.action || '').trim();

    if (action === "initiate") {
      var initUser = String(e.parameter.username || '').trim();
      var initAuth = requireAdminOrAuditor_(initUser, 'initialize feedback sheets');
      if (initAuth) {
        return ContentService.createTextOutput(JSON.stringify(initAuth)).setMimeType(ContentService.MimeType.JSON);
      }
      return initiateFeedbackSheets();
    } else if (action === "getFeedbacks") {
      return getFeedbacks();
    } else if (action === "migrateUrls") {
       var migrateUser = String(e.parameter.username || '').trim();
       var migrateAuth = requireAdminOrAuditor_(migrateUser, 'migrate image URLs');
       if (migrateAuth) {
         return ContentService.createTextOutput(JSON.stringify(migrateAuth)).setMimeType(ContentService.MimeType.JSON);
       }
       const result = migrateImageUrls();
       return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: result
      })).setMimeType(ContentService.MimeType.JSON);
    } else {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Invalid action"
      })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    // Enforce max payload size (~5MB for image uploads)
    if (e.postData && e.postData.contents && e.postData.contents.length > 5242880) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Payload too large"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const data = JSON.parse(e.postData.contents);
    const action = String(data.action || '').trim();

    // ---- API key validation ----
    if (!validateApiKey_(data.key)) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false, status: "error", message: "Invalid or missing API key", code: 401
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ---- Session token verification (HMAC) ----
    var tokenUser = verifyHmacToken_(data.sessionToken);
    var sessionSecret = PropertiesService.getScriptProperties().getProperty('SESSION_SECRET_KEY');
    if (sessionSecret && !tokenUser) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false, status: "error", message: "Invalid or expired session token", code: 401
      })).setMimeType(ContentService.MimeType.JSON);
    }
    if (tokenUser) {
      data.username = tokenUser.username;
    }

    // ---- Role checks: update/delete require admin+auditor; create/upload are open to authenticated users ----
    if (action === "updateFeedback" || action === "deleteFeedback") {
      const authError = requireAdminOrAuditor_(data.username, action);
      if (authError) {
        return ContentService.createTextOutput(JSON.stringify(authError)).setMimeType(ContentService.MimeType.JSON);
      }
    }

    if (action === "createFeedback") {
      return createFeedback(data);
    } else if (action === "updateFeedback") {
      return updateFeedback(data);
    } else if (action === "deleteFeedback") {
      return deleteFeedback(data);
    } else if (action === "uploadImage") {
      return handleImageUpload(data.fileName, data.fileData);
    } else {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Invalid action"
      })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/**
* Handle image upload to Google Drive
* Expects base64 encoded file data
* NOTE: This requires OAuth scopes in appsscript.json:
*   - https://www.googleapis.com/auth/drive
*   - https://www.googleapis.com/auth/drive.file
*/
function handleImageUpload(fileName, base64Data) {
  try {
    Logger.log('Starting image upload for: ' + fileName);
    
    // Get the target folder
    const folder = DriveApp.getFolderById(FEEDBACK_IMAGES_FOLDER_ID);
    Logger.log('Got folder successfully');
    
    // Decode base64 and create blob
    const decodedData = Utilities.base64Decode(base64Data);
    
    // Determine MIME type from filename or default to jpeg
    let mimeType = 'image/jpeg';
    if (fileName && fileName.toLowerCase().endsWith('.png')) {
      mimeType = 'image/png';
    } else if (fileName && fileName.toLowerCase().endsWith('.gif')) {
      mimeType = 'image/gif';
    } else if (fileName && fileName.toLowerCase().endsWith('.webp')) {
      mimeType = 'image/webp';
    }
    
    // Create unique filename with timestamp
    const timestamp = new Date().getTime();
    const sanitizedName = (fileName || 'feedback_image')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 50);
    const finalFileName = 'feedback_' + timestamp + '_' + sanitizedName;
    
    const blob = Utilities.newBlob(decodedData, mimeType, finalFileName);
    Logger.log('Created blob: ' + finalFileName);
    
    // Upload file to folder
    const file = folder.createFile(blob);
    Logger.log('Created file with ID: ' + file.getId());
    
    // Set public sharing so image can be viewed without authentication
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    Logger.log('Set sharing permissions');
    
    // Get file ID and create CORS-friendly public URL
    // Using thumbnail link format which works better for direct embedding and avoids virus scan warnings
    const fileId = file.getId();
    const publicUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w4000';
    
    Logger.log('Image uploaded successfully: ' + publicUrl);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      imageUrl: publicUrl,
      message: 'Image uploaded successfully',
      fileName: finalFileName,
      fileId: fileId
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log('Error uploading image: ' + error.toString());
    console.error('Error uploading image:', error);
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: 'Error uploading image: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
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


function initiateFeedbackSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  const headers = [
    "id", "timestamp", "author", "authorId", "feedback", 
    "replyTimestamp", "replier", "replierId", "reply", 
    "anonymous", "category", "imageUrl", "status", 
    "visibility", "notes", "email", "rating"
  ];

  const currentHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const headersMatch = headers.every((h, i) => h === currentHeaders[i]);

  if (!headersMatch) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    message: "Feedback sheet initiated successfully"
  })).setMimeType(ContentService.MimeType.JSON);
}

function getFeedbacks() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
     return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Sheet not found. Please initiate first."
    })).setMimeType(ContentService.MimeType.JSON);
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);

  const feedbacks = rows.map(row => {
    const feedback = {};
    headers.forEach((header, index) => {
      // Convert boolean strings back to booleans
      if (header === 'anonymous') {
         feedback[header] = row[index] === true || row[index] === "true";
      } else {
         feedback[header] = row[index];
      }
    });
    return feedback;
  });

  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    data: feedbacks
  })).setMimeType(ContentService.MimeType.JSON);
}

function createFeedback(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Sheet not found"
    })).setMimeType(ContentService.MimeType.JSON);
  }

  const feedbackData = data.feedbackData;
  // Ensure strict column order matches headers
  const rowData = [
    feedbackData.id,
    feedbackData.timestamp,
    feedbackData.author,
    feedbackData.authorId,
    feedbackData.feedback,
    feedbackData.replyTimestamp || "",
    feedbackData.replier || "",
    feedbackData.replierId || "",
    feedbackData.reply || "",
    feedbackData.anonymous,
    feedbackData.category,
    feedbackData.imageUrl || "",
    feedbackData.status,
    feedbackData.visibility,
    feedbackData.notes || "",
    feedbackData.email || "",
    feedbackData.rating
  ];

  sheet.appendRow(rowData);

  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    message: "Feedback submitted successfully",
    id: feedbackData.id
  })).setMimeType(ContentService.MimeType.JSON);
}

function updateFeedback(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  
  const feedbackData = data.feedbackData;
  const idToUpdate = feedbackData.id;
  
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  
  // Find row index (0-based) in values array, so +1 for sheet row
  const rowIndex = values.findIndex(row => row[0] === idToUpdate);
  
  if (rowIndex === -1) {
      return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Feedback ID not found"
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Map headers to column indices for updates
  const headers = values[0];
  const rowNumber = rowIndex + 1;
  
  // We'll update the whole row to be safe, constructing it same as create
  const updatedRow = [
    feedbackData.id,
    feedbackData.timestamp,
    feedbackData.author,
    feedbackData.authorId,
    feedbackData.feedback,
    feedbackData.replyTimestamp || "",
    feedbackData.replier || "",
    feedbackData.replierId || "",
    feedbackData.reply || "",
    feedbackData.anonymous,
    feedbackData.category,
    feedbackData.imageUrl || "",
    feedbackData.status,
    feedbackData.visibility,
    feedbackData.notes || "",
    feedbackData.email || "",
    feedbackData.rating
  ];

  sheet.getRange(rowNumber, 1, 1, updatedRow.length).setValues([updatedRow]);

  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    message: "Feedback updated successfully"
  })).setMimeType(ContentService.MimeType.JSON);
}

function deleteFeedback(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Sheet not found"
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  const feedbackId = data.feedbackId;
  
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  
  // Find row index (0-based) in values array, so +1 for sheet row
  const rowIndex = values.findIndex(row => row[0] === feedbackId);
  
  if (rowIndex === -1) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Feedback ID not found"
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Delete the row (rowIndex + 1 because sheet rows are 1-indexed)
  sheet.deleteRow(rowIndex + 1);

  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    message: "Feedback deleted successfully"
  })).setMimeType(ContentService.MimeType.JSON);
}