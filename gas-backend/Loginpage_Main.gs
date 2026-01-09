// =================== CONFIGURATION ===================
const LOGIN_SPREADSHEET_ID = '1vaQZoPq5a_verhICIiWXudBjAmfgFSIbaBX5xt9kjMk';
const LOGIN_SHEET_NAME = 'User Profiles';

// Google Drive folder for profile pictures
// From: https://drive.google.com/drive/folders/1QVb7--Ozam5QNokT1dC9Uzzg-T5QoPZx
const PROFILE_PICTURES_FOLDER_ID = '1QVb7--Ozam5QNokT1dC9Uzzg-T5QoPZx';

// =================== FORCE PERMISSIONS ===================
/**
 * 🔐 RUN THIS FUNCTION FIRST TO GRANT PERMISSIONS 🔐
 * 
 * Instructions:
 * 1. In Apps Script editor, select this function from the dropdown
 * 2. Click "Run" button
 * 3. When prompted, click "Review Permissions"
 * 4. Select your Google account
 * 5. Click "Advanced" then "Go to [Project Name] (unsafe)"
 * 6. Click "Allow" to grant all permissions
 * 7. After success, redeploy your web app
 */
function forcePermissions() {
  // Force Drive permissions
  Logger.log('=== FORCING PERMISSIONS ===');
  
  try {
    // Test Drive access - this will trigger the permission prompt
    const folder = DriveApp.getFolderById(PROFILE_PICTURES_FOLDER_ID);
    Logger.log('✅ Drive folder access: ' + folder.getName());
    
    // Test creating a file (proves write access)
    const testFile = folder.createFile('permission_test.txt', 'Testing write permissions');
    Logger.log('✅ Write permission: SUCCESS');
    testFile.setTrashed(true); // Clean up
    Logger.log('✅ Delete permission: SUCCESS');
    
  } catch (e) {
    Logger.log('❌ Drive error: ' + e.toString());
    Logger.log('   Run this function again and grant permissions when prompted.');
    return;
  }
  
  try {
    // Test Spreadsheet access
    const ss = SpreadsheetApp.openById(LOGIN_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(LOGIN_SHEET_NAME);
    Logger.log('✅ Spreadsheet access: ' + ss.getName());
    Logger.log('✅ Sheet access: ' + sheet.getName());
  } catch (e) {
    Logger.log('❌ Spreadsheet error: ' + e.toString());
  }
  
  Logger.log('=== PERMISSIONS CHECK COMPLETE ===');
  Logger.log('If all checks passed, you can now redeploy your web app!');
}

// =================== WEB API ENTRY POINT ===================

/**
 * Handle POST requests for authentication
 * @param {Object} e - Event object containing postData
 * @returns {TextOutput} JSON response
 */
function doPost(e) {
  try {
    // Parse the request body
    const requestData = JSON.parse(e.postData.contents);
    const { action, username, password } = requestData;

    // Route to appropriate handler
    switch (action) {
      case 'login':
        return handleLogin(username, password);
      case 'verifySession':
        return handleVerifySession(requestData.sessionToken);
      case 'getProfile':
        return handleGetProfile(requestData.username);
      case 'updateProfile':
        return handleUpdateProfile(requestData.username, requestData.profileData);
      case 'uploadProfilePicture':
        return handleUploadProfilePicture(requestData);
      case 'verifyPassword':
        return handleVerifyPassword(requestData.username, requestData.password);
      case 'changePassword':
        return handleChangePassword(requestData.username, requestData.currentPassword, requestData.newPassword);
      default:
        return createErrorResponse('Invalid action', 400);
    }
  } catch (error) {
    Logger.log('doPost Error: ' + error.toString());
    return createErrorResponse('Server error: ' + error.message, 500);
  }
}

/**
 * Handle GET requests (for CORS preflight and health checks)
 * @param {Object} e - Event object
 * @returns {TextOutput} JSON response
 */
function doGet(e) {
  const action = e.parameter.action;
  
  if (action === 'health') {
    return createSuccessResponse({ status: 'healthy', timestamp: new Date().toISOString() });
  }
  
  return createErrorResponse('Invalid request', 400);
}

// =================== AUTHENTICATION HANDLERS ===================

/**
 * Handle user login authentication
 * @param {string} username - Username or email
 * @param {string} password - Plain text password to verify
 * @returns {TextOutput} JSON response with user data or error
 */
function handleLogin(username, password) {
  if (!username || !password) {
    return createErrorResponse('Username and password are required', 400);
  }

  try {
    const ss = SpreadsheetApp.openById(LOGIN_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(LOGIN_SHEET_NAME);
    
    if (!sheet) {
      return createErrorResponse('User database not found', 500);
    }

    // Get headers and all data
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // Find column indices based on User Profiles sheet structure
    // Column mappings: N=Username, O=Password, U=Role, etc.
    const idx = {
      timestamp: headers.indexOf('Timestamp'),                    // A
      email: headers.indexOf('Email Address'),                    // B
      name: headers.indexOf('Full name'),                         // D
      username: headers.indexOf('Username'),                      // N
      password: headers.indexOf('Password'),                      // O
      idCode: headers.indexOf('ID Code'),                         // S
      position: headers.indexOf('Position'),                      // T
      role: headers.indexOf('Role'),                              // U
      profilePic: headers.indexOf('ProfilePictureURL'),           // V
      status: headers.indexOf('Status'),                          // AL
    };

    // Validate required columns exist
    if (idx.username === -1 || idx.password === -1) {
      Logger.log('Column mapping error - Username idx: ' + idx.username + ', Password idx: ' + idx.password);
      return createErrorResponse('Database configuration error', 500);
    }

    // Search for user by username or email (case-insensitive)
    const usernameLower = username.toLowerCase().trim();
    let userRow = null;
    
    for (let i = 1; i < data.length; i++) {
      const rowUsername = (data[i][idx.username] || '').toString().toLowerCase().trim();
      const rowEmail = idx.email > -1 ? (data[i][idx.email] || '').toString().toLowerCase().trim() : '';
      
      if (rowUsername === usernameLower || rowEmail === usernameLower) {
        userRow = data[i];
        break;
      }
    }

    if (!userRow) {
      logLoginAttempt(username, false);
      return createErrorResponse('Invalid username or password', 401);
    }

    // Verify password (hash the input and compare with stored hash)
    const storedHash = (userRow[idx.password] || '').toString().trim();
    const inputHash = hashString(password);
    
    if (storedHash !== inputHash) {
      // Log failed attempt for security monitoring
      logLoginAttempt(username, false);
      return createErrorResponse('Invalid username or password', 401);
    }

    // Get role directly from Role column (U) - values: Auditor, Admin, Head, Member, Suspended, Banned, Guest
    let role = idx.role > -1 ? (userRow[idx.role] || '').toString().trim().toLowerCase() : 'member';
    
    // Normalize role to expected values
    const validRoles = ['auditor', 'admin', 'head', 'member', 'suspended', 'banned', 'guest'];
    if (!validRoles.includes(role)) {
      role = 'member'; // Default to member if role is invalid or empty
    }

    // Get status from Status column (AL) if available, otherwise derive from role
    let status = idx.status > -1 ? (userRow[idx.status] || '').toString().toLowerCase().trim() : 'active';
    
    // If role is banned or suspended, reflect that in status
    if (role === 'banned') {
      status = 'banned';
    } else if (role === 'suspended') {
      status = 'suspended';
    }

    // Handle BANNED accounts - no access
    if (role === 'banned' || status === 'banned') {
      logLoginAttempt(username, false);
      return createErrorResponse('This account has been permanently banned. Contact admin for assistance.', 403);
    }

    // Log successful login
    logLoginAttempt(username, true);

    // Generate session token
    const sessionToken = generateSessionToken(userRow[idx.idCode] || username);

    // Return user data
    return createSuccessResponse({
      success: true,
      user: {
        id: idx.idCode > -1 ? (userRow[idx.idCode] || '') : '',
        username: userRow[idx.username] || '',
        email: idx.email > -1 ? (userRow[idx.email] || '') : '',
        name: idx.name > -1 ? (userRow[idx.name] || 'User') : 'User',
        role: role,
        status: status,
        position: idx.position > -1 ? (userRow[idx.position] || '') : '',
        profilePic: idx.profilePic > -1 ? (userRow[idx.profilePic] || '') : '',
        sessionToken: sessionToken
      }
    });

  } catch (error) {
    Logger.log('handleLogin Error: ' + error.toString());
    return createErrorResponse('Authentication failed: ' + error.message, 500);
  }
}

/**
 * Verify if a session token is still valid
 * @param {string} sessionToken - Session token to verify
 * @returns {TextOutput} JSON response
 */
function handleVerifySession(sessionToken) {
  if (!sessionToken) {
    return createErrorResponse('Session token required', 400);
  }
  
  // In a simple implementation, we just validate the token format
  // In production, you'd check against a sessions table with expiry
  const isValid = sessionToken && sessionToken.length > 0;
  
  return createSuccessResponse({
    valid: isValid,
    timestamp: new Date().toISOString()
  });
}

/**
 * Get full user profile data
 * @param {string} username - Username to fetch profile for
 * @returns {TextOutput} JSON response with profile data
 */
function handleGetProfile(username) {
  if (!username) {
    return createErrorResponse('Username is required', 400);
  }

  try {
    const ss = SpreadsheetApp.openById(LOGIN_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(LOGIN_SHEET_NAME);
    
    if (!sheet) {
      return createErrorResponse('User database not found', 500);
    }

    // Get headers and all data
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // Build complete column index mapping based on User Profiles sheet structure
    const idx = {};
    headers.forEach((header, i) => {
      idx[header] = i;
    });

    // Search for user by username (case-insensitive)
    const usernameLower = username.toLowerCase().trim();
    let userRow = null;
    let rowIndex = -1;
    
    for (let i = 1; i < data.length; i++) {
      const rowUsername = (data[i][idx['Username']] || '').toString().toLowerCase().trim();
      
      if (rowUsername === usernameLower) {
        userRow = data[i];
        rowIndex = i;
        break;
      }
    }

    if (!userRow) {
      return createErrorResponse('User not found', 404);
    }

    // Helper function to safely get value
    const getValue = (columnName) => {
      const colIdx = idx[columnName];
      if (colIdx === undefined || colIdx === -1) return '';
      return (userRow[colIdx] || '').toString();
    };

    // Helper function to format date
    const formatDate = (dateValue) => {
      if (!dateValue) return '';
      try {
        const date = new Date(dateValue);
        if (isNaN(date.getTime())) return dateValue.toString();
        return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      } catch (e) {
        return dateValue.toString();
      }
    };

    // Calculate age from birthday
    const calculateAge = (birthday) => {
      if (!birthday) return 0;
      try {
        const birthDate = new Date(birthday);
        if (isNaN(birthDate.getTime())) return 0;
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        return age;
      } catch (e) {
        return 0;
      }
    };

    // Build profile object matching the frontend structure
    const profile = {
      // Personal Info
      fullName: getValue('Full name'),
      username: getValue('Username'),
      email: getValue('Email Address'),
      personalEmail: getValue('Personal Email Address'),
      contactNumber: getValue('Contact Number'),
      birthday: formatDate(getValue('Date of Birth')),
      age: parseInt(getValue('Age')) || calculateAge(getValue('Date of Birth')),
      gender: getValue('Sex/Gender'),
      pronouns: getValue('Pronouns'),
      
      // Identity
      idCode: getValue('ID Code'),
      civilStatus: getValue('Civil Status'),
      religion: getValue('Religion'),
      nationality: getValue('Nationality'),
      
      // Address
      address: getValue('Address'),
      barangay: getValue('Barangay'),
      city: getValue('City'),
      province: getValue('Province'),
      zipCode: getValue('Zip Code'),
      
      // YSP Information
      chapter: getValue('Chapter'),
      committee: getValue('Committee'),
      dateJoined: formatDate(getValue('Date Joined')),
      membershipType: getValue('Membership Type'),
      position: getValue('Position'),
      role: getValue('Role'),
      status: getValue('Status'),
      
      // Social Media
      facebook: getValue('Facebook'),
      instagram: getValue('Instagram'),
      twitter: getValue('Twitter'),
      
      // Emergency Contact
      emergencyContactName: getValue('Emergency Contact Name'),
      emergencyContactRelation: getValue('Emergency Contact Relation'),
      emergencyContactNumber: getValue('Emergency Contact Number'),
      
      // Profile Picture
      profilePictureURL: getValue('ProfilePictureURL'),
    };

    return createSuccessResponse({
      success: true,
      profile: profile
    });

  } catch (error) {
    Logger.log('handleGetProfile Error: ' + error.toString());
    return createErrorResponse('Failed to fetch profile: ' + error.message, 500);
  }
}

/**
 * Update user profile data
 * @param {string} username - Username to update
 * @param {Object} profileData - Profile data to update
 * @returns {TextOutput} JSON response
 */
function handleUpdateProfile(username, profileData) {
  if (!username) {
    return createErrorResponse('Username is required', 400);
  }
  
  if (!profileData || typeof profileData !== 'object') {
    return createErrorResponse('Profile data is required', 400);
  }

  try {
    const ss = SpreadsheetApp.openById(LOGIN_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(LOGIN_SHEET_NAME);
    
    if (!sheet) {
      return createErrorResponse('User database not found', 500);
    }

    // Get headers and all data
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // Build column index mapping
    const idx = {};
    headers.forEach((header, i) => {
      idx[header] = i;
    });

    // Search for user by username
    const usernameLower = username.toLowerCase().trim();
    let rowIndex = -1;
    
    for (let i = 1; i < data.length; i++) {
      const rowUsername = (data[i][idx['Username']] || '').toString().toLowerCase().trim();
      
      if (rowUsername === usernameLower) {
        rowIndex = i + 1; // Convert to 1-based row number
        break;
      }
    }

    if (rowIndex === -1) {
      return createErrorResponse('User not found', 404);
    }

    // Map frontend field names to spreadsheet column names
    // Make sure column names EXACTLY match the spreadsheet headers
    const fieldMapping = {
      fullName: 'Full name',
      username: 'Username',  // Allow username updates
      email: 'Email Address',
      personalEmail: 'Personal Email Address',  // C column
      contactNumber: 'Contact Number',
      birthday: 'Date of Birth',
      gender: 'Sex/Gender',
      pronouns: 'Pronouns',
      civilStatus: 'Civil Status',
      religion: 'Religion',
      nationality: 'Nationality',
      address: 'Address',
      barangay: 'Barangay',
      city: 'City',
      province: 'Province',
      zipCode: 'Zip Code',
      chapter: 'Chapter',
      committee: 'Committee',
      facebook: 'Facebook',
      instagram: 'Instagram',
      twitter: 'Twitter',
      emergencyContactName: 'Emergency Contact Name',
      emergencyContactRelation: 'Emergency Contact Relation',
      emergencyContactNumber: 'Emergency Contact Number',
    };

    // Fields that should NOT be updated by users
    // Note: username removed from protection - users can now change their username
    const protectedFields = ['idCode', 'position', 'role', 'status', 'dateJoined', 'membershipType', 'password'];

    // Log available headers for debugging
    Logger.log('Available headers: ' + JSON.stringify(headers));
    Logger.log('Profile data received: ' + JSON.stringify(profileData));

    // Helper function to calculate age from birthday
    const calculateAge = (birthday) => {
      if (!birthday) return 0;
      try {
        const birthDate = new Date(birthday);
        if (isNaN(birthDate.getTime())) return 0;
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        return age > 0 ? age : 0;
      } catch (e) {
        return 0;
      }
    };

    // Get current row data for comparison (to detect what actually changed)
    const currentRowData = data[rowIndex - 1]; // rowIndex is 1-based, data array is 0-based
    
    // Update each allowed field
    let updatedCount = 0;
    let skippedFields = [];
    let notFoundFields = [];
    let changedFields = []; // Track what actually changed for email notification
    
    for (const [frontendField, value] of Object.entries(profileData)) {
      // Skip protected fields
      if (protectedFields.includes(frontendField)) {
        skippedFields.push(frontendField);
        continue;
      }
      
      const columnName = fieldMapping[frontendField];
      if (!columnName) {
        notFoundFields.push(frontendField + ' (no mapping)');
        continue;
      }
      
      const colIdx = idx[columnName];
      if (colIdx === undefined || colIdx === -1) {
        notFoundFields.push(frontendField + ' -> "' + columnName + '" (column not found in sheet)');
        continue;
      }
      
      // Get the old value for comparison
      const oldValue = currentRowData[colIdx] !== undefined ? currentRowData[colIdx].toString() : '';
      const newValue = value !== undefined && value !== null ? value.toString() : '';
      
      // Only update and track if value actually changed
      if (oldValue !== newValue) {
        // Update the cell (column is 1-based)
        sheet.getRange(rowIndex, colIdx + 1).setValue(value);
        updatedCount++;
        Logger.log('Updated: ' + columnName + ' = ' + value + ' (was: ' + oldValue + ')');
        
        // Track this change for email notification
        changedFields.push({
          field: columnName,
          oldVal: oldValue || '(Empty)',
          newVal: newValue || '(Empty)'
        });
      }
      
      // If birthday was updated, also update the Age column
      if (frontendField === 'birthday' && value && oldValue !== newValue) {
        const ageColIdx = idx['Age'];
        if (ageColIdx !== undefined && ageColIdx !== -1) {
          const calculatedAge = calculateAge(value);
          sheet.getRange(rowIndex, ageColIdx + 1).setValue(calculatedAge);
          Logger.log('Auto-calculated Age: ' + calculatedAge);
        }
      }
    }

    // Log summary
    Logger.log('Updated count: ' + updatedCount);
    Logger.log('Skipped (protected): ' + JSON.stringify(skippedFields));
    Logger.log('Not found: ' + JSON.stringify(notFoundFields));
    Logger.log('Changed fields: ' + JSON.stringify(changedFields));

    // Send email notification if any fields were actually changed
    if (changedFields.length > 0) {
      const userEmail = currentRowData[idx['Email Address']] || '';
      const userName = currentRowData[idx['Full name']] || 'Member';
      const userUsername = currentRowData[idx['Username']] || username;
      
      if (userEmail) {
        // Send one email per changed field (or you can consolidate - see below)
        for (const change of changedFields) {
          try {
            sendYSPEmail(userEmail, userName, "UPDATE", {
              field: change.field,
              oldVal: change.oldVal,
              newVal: change.newVal,
              username: userUsername,
              score: 0 // Not relevant for profile updates
            });
            Logger.log('Email sent for field: ' + change.field);
          } catch (emailError) {
            Logger.log('Failed to send email for ' + change.field + ': ' + emailError.toString());
          }
        }
      }
    }

    return createSuccessResponse({
      success: true,
      message: `Profile updated successfully. ${updatedCount} fields modified.`,
      updatedCount: updatedCount,
      skippedFields: skippedFields,
      notFoundFields: notFoundFields
    });

  } catch (error) {
    Logger.log('handleUpdateProfile Error: ' + error.toString());
    return createErrorResponse('Failed to update profile: ' + error.message, 500);
  }
}

// =================== PROFILE PICTURE UPLOAD ===================

/**
 * Handle profile picture upload to Google Drive
 * @param {Object} data - Contains base64Image, fileName, mimeType, username
 * @returns {TextOutput} JSON response with image URL
 */
function handleUploadProfilePicture(data) {
  try {
    const { base64Image, fileName, mimeType, username } = data;
    
    if (!base64Image) {
      return createErrorResponse('Image data is required', 400);
    }
    
    if (!username) {
      return createErrorResponse('Username is required', 400);
    }

    // Get the profile pictures folder
    const folder = DriveApp.getFolderById(PROFILE_PICTURES_FOLDER_ID);
    
    // First, get the user's full name from the spreadsheet
    const userInfo = getUserInfoForProfilePic(username);
    if (!userInfo.success) {
      return createErrorResponse(userInfo.message || 'User not found', 404);
    }
    
    // Delete old profile picture if exists
    if (userInfo.oldProfilePicUrl) {
      deleteOldProfilePicture(userInfo.oldProfilePicUrl);
    }
    
    // Decode base64 image (remove data:image/xxx;base64, prefix if present)
    const base64Data = base64Image.split(',')[1] || base64Image;
    
    // Create filename using the person's full name
    const timestamp = new Date().getTime();
    const sanitizedName = (userInfo.fullName || username)
      .replace(/[^a-zA-Z0-9\s_-]/g, '')  // Remove special characters
      .replace(/\s+/g, '_')               // Replace spaces with underscores
      .substring(0, 50);                  // Limit length
    const extension = (mimeType || 'image/jpeg').split('/')[1] || 'jpg';
    const finalFileName = `${sanitizedName}_${timestamp}.${extension}`;
    
    // Create blob from base64 data
    const blob = Utilities.newBlob(
      Utilities.base64Decode(base64Data),
      mimeType || 'image/jpeg',
      finalFileName
    );
    
    // Upload file to Drive folder
    const file = folder.createFile(blob);
    
    // Set public sharing so image can be viewed without authentication
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // Get file ID and create public URL
    // Using lh3.googleusercontent.com format which is CORS-friendly for direct embedding
    const fileId = file.getId();
    const publicUrl = 'https://lh3.googleusercontent.com/d/' + fileId;
    
    Logger.log('Uploaded profile picture: ' + finalFileName);
    Logger.log('File ID: ' + fileId);
    Logger.log('Public URL: ' + publicUrl);
    
    // Now update the user's ProfilePictureURL in the spreadsheet
    const updateResult = updateProfilePictureInSheet(username, publicUrl);
    
    if (!updateResult.success) {
      Logger.log('Warning: Image uploaded but sheet update failed: ' + updateResult.message);
    }
    
    return createSuccessResponse({
      success: true,
      message: 'Profile picture uploaded successfully',
      imageUrl: publicUrl,
      fileName: finalFileName,
      fileId: fileId
    });
    
  } catch (error) {
    Logger.log('handleUploadProfilePicture Error: ' + error.toString());
    return createErrorResponse('Failed to upload profile picture: ' + error.message, 500);
  }
}

/**
 * Update the ProfilePictureURL column in the User Profiles sheet
 * @param {string} username - Username to update
 * @param {string} imageUrl - New profile picture URL
 * @returns {Object} Success status
 */
function updateProfilePictureInSheet(username, imageUrl) {
  try {
    const ss = SpreadsheetApp.openById(LOGIN_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(LOGIN_SHEET_NAME);
    
    if (!sheet) {
      return { success: false, message: 'Sheet not found' };
    }
    
    // Get headers and data
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // Build column index mapping
    const idx = {};
    headers.forEach((header, i) => {
      idx[header] = i;
    });
    
    // Find username column and ProfilePictureURL column
    const usernameColIdx = idx['Username'];
    const profilePicColIdx = idx['ProfilePictureURL'];
    
    if (usernameColIdx === undefined || profilePicColIdx === undefined) {
      return { success: false, message: 'Required columns not found' };
    }
    
    // Search for user row
    const usernameLower = username.toLowerCase().trim();
    let rowIndex = -1;
    
    for (let i = 1; i < data.length; i++) {
      const rowUsername = (data[i][usernameColIdx] || '').toString().toLowerCase().trim();
      if (rowUsername === usernameLower) {
        rowIndex = i + 1; // 1-based row number
        break;
      }
    }
    
    if (rowIndex === -1) {
      return { success: false, message: 'User not found' };
    }
    
    // Update the ProfilePictureURL cell
    sheet.getRange(rowIndex, profilePicColIdx + 1).setValue(imageUrl);
    Logger.log('Updated ProfilePictureURL for ' + username + ': ' + imageUrl);
    
    return { success: true, message: 'Profile picture URL updated in sheet' };
    
  } catch (error) {
    Logger.log('updateProfilePictureInSheet Error: ' + error.toString());
    return { success: false, message: error.toString() };
  }
}

/**
 * Get user info needed for profile picture upload (full name and old profile pic URL)
 * @param {string} username - Username to look up
 * @returns {Object} User info with fullName and oldProfilePicUrl
 */
function getUserInfoForProfilePic(username) {
  try {
    const ss = SpreadsheetApp.openById(LOGIN_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(LOGIN_SHEET_NAME);
    
    if (!sheet) {
      return { success: false, message: 'Sheet not found' };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    const idx = {};
    headers.forEach((header, i) => {
      idx[header] = i;
    });
    
    const usernameColIdx = idx['Username'];
    const fullNameColIdx = idx['Full name'];
    const profilePicColIdx = idx['ProfilePictureURL'];
    
    if (usernameColIdx === undefined) {
      return { success: false, message: 'Username column not found' };
    }
    
    const usernameLower = username.toLowerCase().trim();
    
    for (let i = 1; i < data.length; i++) {
      const rowUsername = (data[i][usernameColIdx] || '').toString().toLowerCase().trim();
      if (rowUsername === usernameLower) {
        const fullName = fullNameColIdx !== undefined ? (data[i][fullNameColIdx] || '').toString() : '';
        const oldUrl = profilePicColIdx !== undefined ? (data[i][profilePicColIdx] || '').toString() : '';
        
        Logger.log('getUserInfoForProfilePic: Found user ' + username);
        Logger.log('getUserInfoForProfilePic: Full name: ' + fullName);
        Logger.log('getUserInfoForProfilePic: Old profile pic URL: ' + oldUrl);
        
        return {
          success: true,
          fullName: fullName,
          oldProfilePicUrl: oldUrl
        };
      }
    }
    
    return { success: false, message: 'User not found' };
    
  } catch (error) {
    Logger.log('getUserInfoForProfilePic Error: ' + error.toString());
    return { success: false, message: error.toString() };
  }
}

/**
 * Delete old profile picture from Google Drive
 * @param {string} fileUrl - The Google Drive URL of the old profile picture
 */
function deleteOldProfilePicture(fileUrl) {
  try {
    if (!fileUrl || fileUrl.trim() === '') {
      Logger.log('deleteOldProfilePicture: No URL provided, skipping');
      return;
    }
    
    Logger.log('deleteOldProfilePicture: Attempting to delete: ' + fileUrl);
    
    // Extract file ID from various URL formats
    let fileId = '';
    
    // Format: https://drive.google.com/thumbnail?id=FILE_ID&sz=...
    // or: https://drive.google.com/uc?export=view&id=FILE_ID
    if (fileUrl.includes('id=')) {
      const match = fileUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (match) {
        fileId = match[1];
      }
    }
    // Format: https://drive.google.com/file/d/FILE_ID/view
    else if (fileUrl.includes('/file/d/')) {
      fileId = fileUrl.split('/file/d/')[1].split('/')[0];
    }
    // Format: https://lh3.googleusercontent.com/d/FILE_ID
    else if (fileUrl.includes('googleusercontent.com/d/')) {
      fileId = fileUrl.split('/d/')[1].split('?')[0].split('/')[0];
    }
    
    Logger.log('deleteOldProfilePicture: Extracted fileId: ' + fileId);
    
    if (fileId && fileId.length > 10) {
      const file = DriveApp.getFileById(fileId);
      const fileName = file.getName();
      file.setTrashed(true);
      Logger.log('deleteOldProfilePicture: SUCCESS - Deleted: ' + fileName + ' (ID: ' + fileId + ')');
    } else {
      Logger.log('deleteOldProfilePicture: Could not extract valid file ID from URL');
    }
    
  } catch (error) {
    // Don't throw error if deletion fails - the old file might not exist or be inaccessible
    Logger.log('deleteOldProfilePicture: WARNING (non-fatal): ' + error.toString());
  }
}

// =================== HELPER FUNCTIONS ===================

/**
 * Hash a string using SHA-256 (matches Loginpage_Hash.gs implementation)
 * @param {string} input - String to hash
 * @returns {string} Hexadecimal hash
 */
function hashString(input) {
  const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input, Utilities.Charset.UTF_8);
  let txtHash = '';
  for (let i = 0; i < rawHash.length; i++) {
    let hashVal = rawHash[i];
    if (hashVal < 0) {
      hashVal += 256;
    }
    if (hashVal.toString(16).length == 1) {
      txtHash += '0';
    }
    txtHash += hashVal.toString(16);
  }
  return txtHash;
}

/**
 * Generate a simple session token
 * @param {string} userId - User identifier
 * @returns {string} Session token
 */
function generateSessionToken(userId) {
  const timestamp = new Date().getTime();
  const random = Math.random().toString(36).substring(2);
  const payload = userId + ':' + timestamp + ':' + random;
  return Utilities.base64Encode(payload);
}

/**
 * Log login attempt for security monitoring
 * @param {string} username - Username that attempted login
 * @param {boolean} success - Whether the login was successful
 */
function logLoginAttempt(username, success) {
  try {
    const ss = SpreadsheetApp.openById(LOGIN_SPREADSHEET_ID);
    let logSheet = ss.getSheetByName('Login Logs');
    
    // Create log sheet if it doesn't exist
    if (!logSheet) {
      logSheet = ss.insertSheet('Login Logs');
      logSheet.appendRow(['Timestamp', 'Username', 'Success', 'IP Info']);
    }
    
    logSheet.appendRow([
      new Date(),
      username,
      success ? 'Yes' : 'No',
      'Web App'
    ]);
    
    // Keep only last 1000 entries to avoid sheet bloat
    const lastRow = logSheet.getLastRow();
    if (lastRow > 1001) {
      logSheet.deleteRows(2, lastRow - 1001);
    }
  } catch (error) {
    Logger.log('logLoginAttempt Error: ' + error.toString());
    // Don't throw - logging failure shouldn't break login
  }
}

// =================== RESPONSE HELPERS ===================

/**
 * Create a success JSON response
 * @param {Object} data - Response data
 * @returns {TextOutput} JSON response
 */
function createSuccessResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Create an error JSON response
 * @param {string} message - Error message
 * @param {number} code - HTTP-like status code
 * @returns {TextOutput} JSON response
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

// =================== TEST FUNCTIONS ===================

/**
 * Test the login function directly (run from Script Editor)
 */
function testLogin() {
  // Replace with actual test credentials
  const result = handleLogin('testuser', 'testpassword');
  Logger.log(result.getContent());
}

/**
 * Test the hash function
 */
function testHash() {
  const hash = hashString('demo123');
  Logger.log('Hash of "demo123": ' + hash);
}

// =================== PASSWORD MANAGEMENT ===================

/**
 * Verify a user's current password
 * @param {string} username - Username to verify
 * @param {string} password - Plain text password to verify
 * @returns {TextOutput} JSON response with verification result
 */
function handleVerifyPassword(username, password) {
  if (!username || !password) {
    return createErrorResponse('Username and password are required', 400);
  }

  try {
    const ss = SpreadsheetApp.openById(LOGIN_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(LOGIN_SHEET_NAME);
    
    if (!sheet) {
      return createErrorResponse('User database not found', 500);
    }

    // Get headers and all data
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // Find column indices
    const idx = {
      username: headers.indexOf('Username'),
      password: headers.indexOf('Password'),
    };

    if (idx.username === -1 || idx.password === -1) {
      return createErrorResponse('Database configuration error', 500);
    }

    // Search for user by username (case-insensitive)
    const usernameLower = username.toLowerCase().trim();
    let userRow = null;
    
    for (let i = 1; i < data.length; i++) {
      const rowUsername = (data[i][idx.username] || '').toString().toLowerCase().trim();
      
      if (rowUsername === usernameLower) {
        userRow = data[i];
        break;
      }
    }

    if (!userRow) {
      return createErrorResponse('User not found', 404);
    }

    // Verify password (hash the input and compare with stored hash)
    const storedHash = (userRow[idx.password] || '').toString().trim();
    const inputHash = hashString(password);
    
    if (storedHash !== inputHash) {
      return createSuccessResponse({
        success: true,
        valid: false,
        error: 'Incorrect password'
      });
    }

    return createSuccessResponse({
      success: true,
      valid: true
    });

  } catch (error) {
    Logger.log('handleVerifyPassword Error: ' + error.toString());
    return createErrorResponse('Failed to verify password: ' + error.message, 500);
  }
}

/**
 * Change a user's password
 * @param {string} username - Username to change password for
 * @param {string} currentPassword - Current password for verification
 * @param {string} newPassword - New password to set
 * @returns {TextOutput} JSON response
 */
function handleChangePassword(username, currentPassword, newPassword) {
  if (!username || !currentPassword || !newPassword) {
    return createErrorResponse('Username, current password, and new password are required', 400);
  }

  // Validate new password strength
  if (newPassword.length < 8) {
    return createErrorResponse('New password must be at least 8 characters long', 400);
  }

  try {
    const ss = SpreadsheetApp.openById(LOGIN_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(LOGIN_SHEET_NAME);
    
    if (!sheet) {
      return createErrorResponse('User database not found', 500);
    }

    // Get headers and all data
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // Find column indices
    const idx = {
      username: headers.indexOf('Username'),
      password: headers.indexOf('Password'),
      email: headers.indexOf('Email Address'),
      name: headers.indexOf('Full name'),
    };

    if (idx.username === -1 || idx.password === -1) {
      return createErrorResponse('Database configuration error', 500);
    }

    // Search for user by username (case-insensitive)
    const usernameLower = username.toLowerCase().trim();
    let rowIndex = -1;
    let userRow = null;
    
    for (let i = 1; i < data.length; i++) {
      const rowUsername = (data[i][idx.username] || '').toString().toLowerCase().trim();
      
      if (rowUsername === usernameLower) {
        userRow = data[i];
        rowIndex = i + 1; // 1-based row number for sheet operations
        break;
      }
    }

    if (!userRow || rowIndex === -1) {
      return createErrorResponse('User not found', 404);
    }

    // Verify current password
    const storedHash = (userRow[idx.password] || '').toString().trim();
    const currentHash = hashString(currentPassword);
    
    if (storedHash !== currentHash) {
      return createErrorResponse('Current password is incorrect', 401);
    }

    // Hash the new password
    const newHash = hashString(newPassword);
    
    // Check if new password is different from current
    if (newHash === storedHash) {
      return createErrorResponse('New password must be different from current password', 400);
    }

    // Check if this password hash already exists for another user (uniqueness check)
    for (let i = 1; i < data.length; i++) {
      if (i + 1 !== rowIndex) { // Skip current user's row
        const otherHash = (data[i][idx.password] || '').toString().trim();
        if (otherHash === newHash) {
          return createErrorResponse('This password is already in use. Please choose a different password.', 400);
        }
      }
    }

    // Update the password in the spreadsheet
    sheet.getRange(rowIndex, idx.password + 1).setValue(newHash);
    
    Logger.log('Password changed successfully for user: ' + username);

    // Send security alert email for password change
    const userEmail = idx.email > -1 ? (userRow[idx.email] || '').toString().trim() : '';
    const userName = idx.name > -1 ? (userRow[idx.name] || 'Member').toString() : 'Member';
    
    if (userEmail) {
      try {
        sendYSPEmail(userEmail, userName, "UPDATE", {
          field: 'Password',
          oldVal: '(hidden)',
          newVal: '(hidden)',
          username: username,
          score: 0
        });
        Logger.log('Password change email sent to: ' + userEmail);
      } catch (emailError) {
        Logger.log('Failed to send password change email: ' + emailError.toString());
      }
    }

    return createSuccessResponse({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    Logger.log('handleChangePassword Error: ' + error.toString());
    return createErrorResponse('Failed to change password: ' + error.message, 500);
  }
}
