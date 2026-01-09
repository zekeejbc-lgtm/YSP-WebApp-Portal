// =================== CONFIGURATION ===================
const LOGIN_SPREADSHEET_ID = '1vaQZoPq5a_verhICIiWXudBjAmfgFSIbaBX5xt9kjMk';
const LOGIN_SHEET_NAME = 'User Profiles';

// Google Drive folder for profile pictures
// From: https://drive.google.com/drive/folders/1QVb7--Ozam5QNokT1dC9Uzzg-T5QoPZx
const PROFILE_PICTURES_FOLDER_ID = '1QVb7--Ozam5QNokT1dC9Uzzg-T5QoPZx';

// Email configuration
const LOGO_URL = "https://i.imgur.com/J4wddTW.png";
const WEB_APP_URL = "https://www.youthservicephilippinestagum.me/";
const FB_PAGE_URL = "https://www.facebook.com/YSPTagumChapter";

// =================== EMAIL FUNCTION FOR PROFILE UPDATES ===================

/**
 * Send profile update email with all changes
 * @param {string} email - Recipient email
 * @param {string} name - User's name
 * @param {Array} changes - Array of {field, oldVal, newVal}
 * @param {string} username - User's username
 */
function sendProfileUpdateEmail(email, name, changes, username) {
  Logger.log('sendProfileUpdateEmail called');
  Logger.log('Email: ' + email);
  Logger.log('Name: ' + name);
  Logger.log('Changes count: ' + changes.length);
  
  const dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMMM dd, yyyy");
  const timeStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "hh:mm a");
  
  const changesCount = changes.length;
  const subjectLine = `Profile Update Notification - ${changesCount} Field${changesCount !== 1 ? 's' : ''} Modified`;
  
  let allChangesHTML = "";
  
  // Loop through all changes and build HTML for each
  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    
    if (change.field === 'Password') {
      // Password gets special security alert styling
      allChangesHTML += `
        <div style="margin-bottom: 20px;">
          <div style="background-color: #fff5f5; border: 1px solid #fed7d7; border-radius: 8px; padding: 16px; text-align: center;">
            <div style="font-size: 20px; margin-bottom: 8px;">🔐</div>
            <div style="font-family: 'Lexend', sans-serif; color: #c53030; font-weight: 700; font-size: 14px; margin-bottom: 6px;">
              PASSWORD CHANGED
            </div>
            <div style="color: #742a2a; font-size: 12px;">
              Your account password has been updated successfully.
            </div>
          </div>
        </div>
      `;
    } else {
      // Normal field change with old → new
      allChangesHTML += `
        <div style="margin-bottom: 20px;">
          <div style="margin-bottom: 8px; font-size: 12px; color: #888; text-transform: uppercase; font-weight: 600;">${change.field}</div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td valign="top" width="45%" style="padding: 10px; background-color: #fff5f5; border: 1px solid #fed7d7; border-radius: 6px;">
                <div style="font-size: 11px; color: #c53030; margin-bottom: 4px; font-weight: bold;">PREVIOUS</div>
                <div style="font-size: 14px; color: #742a2a; word-break: break-word;">${change.oldVal || '(Empty)'}</div>
              </td>
              <td valign="middle" align="center" width="10%" style="color: #999;">
                <span style="font-size: 20px;">➝</span>
              </td>
              <td valign="top" width="45%" style="padding: 10px; background-color: #f0fff4; border: 1px solid #c6f6d5; border-radius: 6px;">
                <div style="font-size: 11px; color: #2f855a; margin-bottom: 4px; font-weight: bold;">NEW</div>
                <div style="font-size: 14px; color: #22543d; word-break: break-word; font-weight: 600;">${change.newVal || '(Empty)'}</div>
              </td>
            </tr>
          </table>
        </div>
      `;
    }
  }

  const mainContent = `
    <p style="margin-bottom: 24px;">Your profile was updated on <strong>${dateStr}</strong> at ${timeStr}. The following ${changesCount} field${changesCount !== 1 ? 's were' : ' was'} modified:</p>
    
    <div style="background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
      <div style="background-color: #f8f9fa; padding: 12px 20px; border-bottom: 1px solid #eeeeee;">
        <span style="font-family: 'Lexend', sans-serif; font-size: 12px; font-weight: 600; color: #666; letter-spacing: 0.5px; text-transform: uppercase;">All Modifications</span>
      </div>
      <div style="padding: 20px;">
        ${allChangesHTML} 
      </div>
    </div>`;

  const htmlBody = `
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
                <img src="${LOGO_URL}" alt="YSP Logo" width="70" style="display: block; width: 70px; height: auto; border-radius: 50%; background: #fff; padding: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); margin-bottom: 16px;">
                <div class="font-header" style="color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; margin: 0;">Youth Service Philippines</div>
                <div class="font-body" style="color: rgba(255,255,255,0.9); font-size: 14px; margin-top: 6px; font-weight: 500;">Tagum Chapter</div>
              </td>
            </tr>
            <tr>
              <td style="padding: 40px 30px;">
                <div class="font-header" style="color: #1a1a1a; font-size: 20px; font-weight: 600; margin-bottom: 16px;">Hello, ${name || 'Member'}</div>
                <div class="font-body" style="color: #4a5568; font-size: 15px; line-height: 1.6;">
                  ${mainContent}
                </div>
                <div style="margin-top: 30px; border-top: 1px solid #eeeeee; padding-top: 20px;">
                   <table width="100%">
                     <tr>
                       <td width="20" valign="top" style="color: #aaa; font-size: 16px;">ℹ️</td>
                       <td style="font-size: 12px; color: #888; line-height: 1.5;">
                         <strong>Notice:</strong> If you did not initiate this change, please contact your administrator immediately.
                       </td>
                     </tr>
                   </table>
                </div>
                <table width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top: 30px;">
                  <tr>
                    <td align="center">
                      <a href="${WEB_APP_URL}" style="display: inline-block; background-color: #FF8800; color: #ffffff; font-family: 'Lexend', sans-serif; font-weight: 600; font-size: 14px; padding: 12px 28px; text-decoration: none; border-radius: 6px; box-shadow: 0 2px 4px rgba(255, 136, 0, 0.3); margin: 0 8px;">Access Web App</a>
                      <a href="${FB_PAGE_URL}" style="display: inline-block; background-color: #ffffff; color: #4a5568; border: 1px solid #e2e8f0; font-family: 'Lexend', sans-serif; font-weight: 600; font-size: 14px; padding: 11px 28px; text-decoration: none; border-radius: 6px; margin: 0 8px;">Facebook</a>
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

  Logger.log('Sending email via MailApp...');
  MailApp.sendEmail({
    to: email,
    subject: subjectLine,
    htmlBody: htmlBody
  });
  Logger.log('MailApp.sendEmail completed');
}

/**
 * Send password change security alert email
 * @param {string} email - Recipient email
 * @param {string} name - User's name
 * @param {string} username - User's username
 */
function sendPasswordChangeEmail(email, name, username) {
  Logger.log('sendPasswordChangeEmail called');
  
  const dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMMM dd, yyyy");
  const timeStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "hh:mm a");
  
  const subjectLine = "Security Alert - Password Changed";
  
  const mainContent = `
    <p style="margin-bottom: 24px;">Your password was changed on <strong>${dateStr}</strong> at ${timeStr}.</p>
    
    <div style="background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
      <div style="background-color: #f8f9fa; padding: 12px 20px; border-bottom: 1px solid #eeeeee;">
        <span style="font-family: 'Lexend', sans-serif; font-size: 12px; font-weight: 600; color: #666; letter-spacing: 0.5px; text-transform: uppercase;">Security Update</span>
      </div>
      <div style="padding: 20px;">
        <div style="background-color: #fff5f5; border: 1px solid #fed7d7; border-radius: 8px; padding: 20px; text-align: center;">
          <div style="font-size: 24px; margin-bottom: 10px;">🔐</div>
          <div style="font-family: 'Lexend', sans-serif; color: #c53030; font-weight: 700; font-size: 16px; margin-bottom: 8px;">
            SECURITY ALERT
          </div>
          <div style="color: #742a2a; font-size: 14px;">
            Your account password has been changed successfully.
          </div>
          <div style="margin-top: 12px; font-size: 12px; color: #742a2a;">
            (For security reasons, we do not display the password in this email.)
          </div>
        </div>
      </div>
    </div>`;

  const htmlBody = `
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
                <img src="${LOGO_URL}" alt="YSP Logo" width="70" style="display: block; width: 70px; height: auto; border-radius: 50%; background: #fff; padding: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); margin-bottom: 16px;">
                <div class="font-header" style="color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; margin: 0;">Youth Service Philippines</div>
                <div class="font-body" style="color: rgba(255,255,255,0.9); font-size: 14px; margin-top: 6px; font-weight: 500;">Tagum Chapter</div>
              </td>
            </tr>
            <tr>
              <td style="padding: 40px 30px;">
                <div class="font-header" style="color: #1a1a1a; font-size: 20px; font-weight: 600; margin-bottom: 16px;">Hello, ${name || 'Member'}</div>
                <div class="font-body" style="color: #4a5568; font-size: 15px; line-height: 1.6;">
                  ${mainContent}
                </div>
                <div style="margin-top: 30px; border-top: 1px solid #eeeeee; padding-top: 20px;">
                   <table width="100%">
                     <tr>
                       <td width="20" valign="top" style="color: #aaa; font-size: 16px;">ℹ️</td>
                       <td style="font-size: 12px; color: #888; line-height: 1.5;">
                         <strong>Notice:</strong> If you did not initiate this change, please contact your administrator immediately.
                       </td>
                     </tr>
                   </table>
                </div>
                <table width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top: 30px;">
                  <tr>
                    <td align="center">
                      <a href="${WEB_APP_URL}" style="display: inline-block; background-color: #FF8800; color: #ffffff; font-family: 'Lexend', sans-serif; font-weight: 600; font-size: 14px; padding: 12px 28px; text-decoration: none; border-radius: 6px; box-shadow: 0 2px 4px rgba(255, 136, 0, 0.3); margin: 0 8px;">Access Web App</a>
                      <a href="${FB_PAGE_URL}" style="display: inline-block; background-color: #ffffff; color: #4a5568; border: 1px solid #e2e8f0; font-family: 'Lexend', sans-serif; font-weight: 600; font-size: 14px; padding: 11px 28px; text-decoration: none; border-radius: 6px; margin: 0 8px;">Facebook</a>
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

  Logger.log('Sending password change email via MailApp...');
  MailApp.sendEmail({
    to: email,
    subject: subjectLine,
    htmlBody: htmlBody
  });
  Logger.log('Password change email sent successfully');
}

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
  Logger.log('=== FORCING PERMISSIONS ===');
  
  // Test Drive permissions
  try {
    const folder = DriveApp.getFolderById(PROFILE_PICTURES_FOLDER_ID);
    Logger.log('✅ Drive folder access: ' + folder.getName());
    
    const testFile = folder.createFile('permission_test.txt', 'Testing write permissions');
    Logger.log('✅ Drive write permission: SUCCESS');
    testFile.setTrashed(true);
    Logger.log('✅ Drive delete permission: SUCCESS');
  } catch (e) {
    Logger.log('❌ Drive error: ' + e.toString());
    Logger.log('   Run this function again and grant permissions when prompted.');
  }
  
  // Test Spreadsheet permissions
  try {
    const ss = SpreadsheetApp.openById(LOGIN_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(LOGIN_SHEET_NAME);
    Logger.log('✅ Spreadsheet access: ' + ss.getName());
    Logger.log('✅ Sheet access: ' + sheet.getName());
  } catch (e) {
    Logger.log('❌ Spreadsheet error: ' + e.toString());
  }
  
  // Test Email (MailApp) permissions
  try {
    const remainingQuota = MailApp.getRemainingDailyQuota();
    Logger.log('✅ Email (MailApp) access: SUCCESS');
    Logger.log('✅ Remaining daily email quota: ' + remainingQuota);
    
    if (remainingQuota <= 0) {
      Logger.log('⚠️ WARNING: Daily email quota exhausted! Emails will not be sent until quota resets.');
    }
  } catch (e) {
    Logger.log('❌ Email (MailApp) error: ' + e.toString());
    Logger.log('   You need to grant email permissions. Run this function again.');
  }
  
  Logger.log('=== PERMISSIONS CHECK COMPLETE ===');
  Logger.log('If all checks passed (✅), you can now redeploy your web app!');
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
      // Email verification actions
      case 'sendVerificationOTP':
        return handleSendVerificationOTP(requestData.username, requestData.email);
      case 'verifyOTP':
        return handleVerifyOTP(requestData.username, requestData.email, requestData.otp);
      case 'checkEmailVerified':
        return handleCheckEmailVerified(requestData.username, requestData.email);
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
      const rawValue = userRow[colIdx];
      
      // Handle Date objects that shouldn't be dates (like zip codes mistakenly formatted as dates)
      if (rawValue instanceof Date) {
        // If the year is unreasonably large (like 8100), it's probably a zip code
        const year = rawValue.getFullYear();
        if (year > 2100) {
          // Return the year as the value (it was probably a number like 8100)
          return year.toString();
        }
      }
      
      return (rawValue || '').toString();
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
    // Note: email (Account Email) is protected - users can only edit personalEmail
    const protectedFields = ['idCode', 'position', 'role', 'status', 'dateJoined', 'membershipType', 'password', 'email'];

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

    // Send ONE consolidated email notification if any fields were actually changed
    Logger.log('=== EMAIL DEBUG START ===');
    Logger.log('changedFields.length: ' + changedFields.length);
    
    if (changedFields.length > 0) {
      const userEmail = currentRowData[idx['Email Address']] || '';
      const userName = currentRowData[idx['Full name']] || 'Member';
      const userUsername = currentRowData[idx['Username']] || username;
      
      Logger.log('userEmail: ' + userEmail);
      Logger.log('userName: ' + userName);
      Logger.log('userUsername: ' + userUsername);
      
      if (userEmail) {
        try {
          Logger.log('Attempting to send BULK_UPDATE email...');
          // Send ONE email with ALL changes using BULK_UPDATE type
          sendProfileUpdateEmail(userEmail, userName, changedFields, userUsername);
          Logger.log('✅ Bulk update email sent successfully with ' + changedFields.length + ' changes');
        } catch (emailError) {
          Logger.log('❌ Failed to send bulk update email: ' + emailError.toString());
          Logger.log('Error stack: ' + emailError.stack);
        }
      } else {
        Logger.log('❌ No email address found for user');
      }
    } else {
      Logger.log('No fields changed - skipping email');
    }
    Logger.log('=== EMAIL DEBUG END ===');

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

/**
 * 📧 RUN THIS TO GRANT EMAIL PERMISSION 📧
 * This will send a test email to yourself and grant the email scope.
 */
function grantEmailPermission() {
  Logger.log('=== GRANTING EMAIL PERMISSION ===');
  
  // Get your email (the account running this script)
  const myEmail = Session.getActiveUser().getEmail();
  Logger.log('Your email: ' + myEmail);
  
  if (!myEmail) {
    Logger.log('❌ Could not get your email. Make sure you are logged in.');
    return;
  }
  
  try {
    // Send a simple test email - this will trigger the permission prompt
    MailApp.sendEmail({
      to: myEmail,
      subject: 'YSP System - Email Permission Test',
      body: 'This is a test email to confirm that the YSP System can send emails.\n\nIf you received this, email permissions are working correctly!\n\n- YSP System'
    });
    
    Logger.log('✅ Test email sent successfully to: ' + myEmail);
    Logger.log('✅ EMAIL PERMISSION GRANTED!');
    Logger.log('');
    Logger.log('You can now redeploy your web app.');
    
    // Also show remaining quota
    const quota = MailApp.getRemainingDailyQuota();
    Logger.log('Remaining daily email quota: ' + quota);
    
  } catch (e) {
    Logger.log('❌ Email error: ' + e.toString());
    Logger.log('');
    Logger.log('If you see a permission error, run this function again and ACCEPT the permission prompt.');
  }
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
    
    Logger.log('=== PASSWORD EMAIL DEBUG ===');
    Logger.log('userEmail: ' + userEmail);
    Logger.log('userName: ' + userName);
    
    if (userEmail) {
      try {
        Logger.log('Attempting to send password change email...');
        sendPasswordChangeEmail(userEmail, userName, username);
        Logger.log('✅ Password change email sent to: ' + userEmail);
      } catch (emailError) {
        Logger.log('❌ Failed to send password change email: ' + emailError.toString());
        Logger.log('Error stack: ' + emailError.stack);
      }
    } else {
      Logger.log('❌ No email address found');
    }
    Logger.log('=== PASSWORD EMAIL DEBUG END ===');

    return createSuccessResponse({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    Logger.log('handleChangePassword Error: ' + error.toString());
    return createErrorResponse('Failed to change password: ' + error.message, 500);
  }
}

// =================== EMAIL VERIFICATION SYSTEM ===================

const OTP_SHEET_NAME = 'Email_Verification_OTPs';
const OTP_EXPIRY_MINUTES = 15;

// Security Configuration - Progressive Cooldowns (anti-spam)
// Format: [seconds to wait before next request]
const OTP_COOLDOWNS = [
  15,      // 1st request: 15 seconds before 2nd
  30,      // 2nd request: 30 seconds before 3rd  
  60,      // 3rd request: 1 minute before 4th
  180,     // 4th request: 3 minutes before 5th
  86400    // 5th+ request: 24 hours lockout
];
const MAX_FAILED_ATTEMPTS = 5;         // Max wrong OTP entries before lockout
const LOCKOUT_MINUTES = 30;            // Lockout duration after max failures

/**
 * 🔧 RUN THIS FUNCTION ONCE TO ADD EMAIL VERIFICATION COLUMNS 🔧
 * 
 * Adds EmailVerified and VerifiedEmail columns to User Profiles sheet
 * This is required for verification status to persist after page refresh
 */
function setupEmailVerificationColumns() {
  Logger.log('=== SETTING UP EMAIL VERIFICATION COLUMNS ===');
  
  try {
    const ss = SpreadsheetApp.openById(LOGIN_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(LOGIN_SHEET_NAME);
    
    if (!sheet) {
      Logger.log('❌ User Profiles sheet not found');
      return { success: false, message: 'User Profiles sheet not found' };
    }
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const lastCol = sheet.getLastColumn();
    
    let emailVerifiedIdx = headers.indexOf('EmailVerified');
    let verifiedEmailIdx = headers.indexOf('VerifiedEmail');
    
    let columnsAdded = [];
    
    // Add EmailVerified column if it doesn't exist
    if (emailVerifiedIdx === -1) {
      sheet.getRange(1, lastCol + 1).setValue('EmailVerified');
      sheet.getRange(1, lastCol + 1).setFontWeight('bold');
      columnsAdded.push('EmailVerified');
      Logger.log('✅ Added EmailVerified column at position ' + (lastCol + 1));
    } else {
      Logger.log('ℹ️ EmailVerified column already exists at position ' + (emailVerifiedIdx + 1));
    }
    
    // Refresh headers after possible addition
    const newHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const newLastCol = sheet.getLastColumn();
    
    // Add VerifiedEmail column if it doesn't exist
    verifiedEmailIdx = newHeaders.indexOf('VerifiedEmail');
    if (verifiedEmailIdx === -1) {
      sheet.getRange(1, newLastCol + 1).setValue('VerifiedEmail');
      sheet.getRange(1, newLastCol + 1).setFontWeight('bold');
      columnsAdded.push('VerifiedEmail');
      Logger.log('✅ Added VerifiedEmail column at position ' + (newLastCol + 1));
    } else {
      Logger.log('ℹ️ VerifiedEmail column already exists at position ' + (verifiedEmailIdx + 1));
    }
    
    if (columnsAdded.length > 0) {
      Logger.log('✅ Setup complete! Added columns: ' + columnsAdded.join(', '));
      return { success: true, message: 'Added columns: ' + columnsAdded.join(', ') };
    } else {
      Logger.log('ℹ️ All columns already exist. No changes made.');
      return { success: true, message: 'All columns already exist' };
    }
    
  } catch (error) {
    Logger.log('❌ setupEmailVerificationColumns Error: ' + error.toString());
    return { success: false, message: error.toString() };
  }
}

/**
 * Clean up expired and used OTPs from the sheet
 * Called automatically during verification operations
 */
function cleanupExpiredOTPs() {
  try {
    const ss = SpreadsheetApp.openById(LOGIN_SPREADSHEET_ID);
    const otpSheet = ss.getSheetByName(OTP_SHEET_NAME);
    
    if (!otpSheet) {
      return { deleted: 0 };
    }
    
    const otpData = otpSheet.getDataRange().getValues();
    const now = new Date();
    let deletedCount = 0;
    
    // Delete from bottom to top to avoid index shifting issues
    for (let i = otpData.length - 1; i >= 1; i--) {
      const rowExpiry = new Date(otpData[i][4]);
      const rowVerified = otpData[i][5];
      
      // Delete if expired OR if verified (used)
      if (now > rowExpiry || rowVerified === true) {
        otpSheet.deleteRow(i + 1);
        deletedCount++;
      }
    }
    
    if (deletedCount > 0) {
      Logger.log('🧹 Cleaned up ' + deletedCount + ' expired/used OTP records');
    }
    
    return { deleted: deletedCount };
    
  } catch (error) {
    Logger.log('cleanupExpiredOTPs Error: ' + error.toString());
    return { deleted: 0, error: error.toString() };
  }
}

/**
 * Get OTP request history for progressive cooldown
 * @param {string} username - Username requesting OTP
 * @returns {Object} { requestCount: number, lastRequestTime: Date, canRequest: boolean, waitSeconds: number }
 */
function getOTPRequestHistory(username) {
  try {
    const ss = SpreadsheetApp.openById(LOGIN_SPREADSHEET_ID);
    let historySheet = ss.getSheetByName('OTP_Request_History');
    
    if (!historySheet) {
      // Create the sheet if it doesn't exist
      historySheet = ss.insertSheet('OTP_Request_History');
      historySheet.appendRow(['Username', 'Request_Count', 'Last_Request', 'Cooldown_Until']);
      historySheet.getRange(1, 1, 1, 4).setFontWeight('bold');
      historySheet.setFrozenRows(1);
    }
    
    const data = historySheet.getDataRange().getValues();
    const now = new Date();
    
    for (let i = 1; i < data.length; i++) {
      const rowUsername = (data[i][0] || '').toString().toLowerCase().trim();
      
      if (rowUsername === username.toLowerCase().trim()) {
        const requestCount = parseInt(data[i][1]) || 0;
        const lastRequestTime = data[i][2] ? new Date(data[i][2]) : null;
        const cooldownUntil = data[i][3] ? new Date(data[i][3]) : null;
        
        // Check if still in cooldown
        if (cooldownUntil && now < cooldownUntil) {
          const waitSeconds = Math.ceil((cooldownUntil.getTime() - now.getTime()) / 1000);
          return { 
            requestCount, 
            lastRequestTime, 
            canRequest: false, 
            waitSeconds,
            cooldownUntil,
            rowIndex: i + 1 
          };
        }
        
        // Cooldown expired, can request
        return { 
          requestCount, 
          lastRequestTime, 
          canRequest: true, 
          waitSeconds: 0,
          rowIndex: i + 1 
        };
      }
    }
    
    // No history found, first request
    return { requestCount: 0, lastRequestTime: null, canRequest: true, waitSeconds: 0, rowIndex: -1 };
    
  } catch (error) {
    Logger.log('getOTPRequestHistory Error: ' + error.toString());
    return { requestCount: 0, lastRequestTime: null, canRequest: true, waitSeconds: 0, rowIndex: -1 };
  }
}

/**
 * Record OTP request and set next cooldown
 * @param {string} username - Username
 */
function recordOTPRequest(username) {
  try {
    const ss = SpreadsheetApp.openById(LOGIN_SPREADSHEET_ID);
    let historySheet = ss.getSheetByName('OTP_Request_History');
    
    if (!historySheet) {
      historySheet = ss.insertSheet('OTP_Request_History');
      historySheet.appendRow(['Username', 'Request_Count', 'Last_Request', 'Cooldown_Until']);
      historySheet.getRange(1, 1, 1, 4).setFontWeight('bold');
      historySheet.setFrozenRows(1);
    }
    
    const history = getOTPRequestHistory(username);
    const now = new Date();
    const newCount = history.requestCount + 1;
    
    // Calculate cooldown based on request count
    const cooldownIndex = Math.min(newCount - 1, OTP_COOLDOWNS.length - 1);
    const cooldownSeconds = OTP_COOLDOWNS[cooldownIndex];
    const cooldownUntil = new Date(now.getTime() + cooldownSeconds * 1000);
    
    Logger.log('📊 OTP Request #' + newCount + ' for ' + username);
    Logger.log('⏱️ Next cooldown: ' + cooldownSeconds + ' seconds (until ' + cooldownUntil + ')');
    
    if (history.rowIndex > 0) {
      // Update existing row
      historySheet.getRange(history.rowIndex, 2).setValue(newCount);
      historySheet.getRange(history.rowIndex, 3).setValue(now);
      historySheet.getRange(history.rowIndex, 4).setValue(cooldownUntil);
    } else {
      // Add new row
      historySheet.appendRow([username, newCount, now, cooldownUntil]);
    }
    
    return { requestCount: newCount, cooldownSeconds, cooldownUntil };
    
  } catch (error) {
    Logger.log('recordOTPRequest Error: ' + error.toString());
    return { requestCount: 0, cooldownSeconds: 0 };
  }
}

/**
 * Reset OTP request history after successful email verification
 * @param {string} username - Username
 */
function resetOTPRequestHistory(username) {
  try {
    const ss = SpreadsheetApp.openById(LOGIN_SPREADSHEET_ID);
    const historySheet = ss.getSheetByName('OTP_Request_History');
    
    if (!historySheet) return;
    
    const history = getOTPRequestHistory(username);
    
    if (history.rowIndex > 0) {
      historySheet.deleteRow(history.rowIndex);
      Logger.log('✅ Reset OTP request history for ' + username);
    }
    
  } catch (error) {
    Logger.log('resetOTPRequestHistory Error: ' + error.toString());
  }
}

/**
 * Format wait time for user-friendly display
 * @param {number} seconds - Seconds to wait
 * @returns {string} Formatted time string
 */
function formatWaitTime(seconds) {
  if (seconds < 60) {
    return seconds + ' second' + (seconds !== 1 ? 's' : '');
  } else if (seconds < 3600) {
    const minutes = Math.ceil(seconds / 60);
    return minutes + ' minute' + (minutes !== 1 ? 's' : '');
  } else if (seconds < 86400) {
    const hours = Math.ceil(seconds / 3600);
    return hours + ' hour' + (hours !== 1 ? 's' : '');
  } else {
    const hours = Math.ceil(seconds / 3600);
    return hours + ' hours';
  }
}

/**
 * Track failed OTP attempts
 * @param {string} username - Username
 * @param {string} email - Email
 * @returns {Object} { attempts: number, lockedUntil: Date|null, isLocked: boolean }
 */
function getFailedAttempts(username, email) {
  try {
    const ss = SpreadsheetApp.openById(LOGIN_SPREADSHEET_ID);
    let attemptsSheet = ss.getSheetByName('OTP_Failed_Attempts');
    
    if (!attemptsSheet) {
      // Create the sheet if it doesn't exist
      attemptsSheet = ss.insertSheet('OTP_Failed_Attempts');
      attemptsSheet.appendRow(['Username', 'Email', 'Failed_Attempts', 'Last_Attempt', 'Locked_Until']);
      attemptsSheet.getRange(1, 1, 1, 5).setFontWeight('bold');
      attemptsSheet.setFrozenRows(1);
    }
    
    const data = attemptsSheet.getDataRange().getValues();
    const now = new Date();
    
    for (let i = 1; i < data.length; i++) {
      const rowUsername = (data[i][0] || '').toString().toLowerCase().trim();
      const rowEmail = (data[i][1] || '').toString().toLowerCase().trim();
      
      if (rowUsername === username.toLowerCase().trim() && 
          rowEmail === email.toLowerCase().trim()) {
        const attempts = parseInt(data[i][2]) || 0;
        const lockedUntil = data[i][4] ? new Date(data[i][4]) : null;
        const isLocked = lockedUntil && now < lockedUntil;
        
        return { attempts, lockedUntil, isLocked, rowIndex: i + 1 };
      }
    }
    
    return { attempts: 0, lockedUntil: null, isLocked: false, rowIndex: -1 };
    
  } catch (error) {
    Logger.log('getFailedAttempts Error: ' + error.toString());
    return { attempts: 0, lockedUntil: null, isLocked: false, rowIndex: -1 };
  }
}

/**
 * Record a failed OTP attempt
 * @param {string} username - Username
 * @param {string} email - Email
 */
function recordFailedAttempt(username, email) {
  try {
    const ss = SpreadsheetApp.openById(LOGIN_SPREADSHEET_ID);
    let attemptsSheet = ss.getSheetByName('OTP_Failed_Attempts');
    
    if (!attemptsSheet) {
      attemptsSheet = ss.insertSheet('OTP_Failed_Attempts');
      attemptsSheet.appendRow(['Username', 'Email', 'Failed_Attempts', 'Last_Attempt', 'Locked_Until']);
      attemptsSheet.getRange(1, 1, 1, 5).setFontWeight('bold');
      attemptsSheet.setFrozenRows(1);
    }
    
    const failedInfo = getFailedAttempts(username, email);
    const now = new Date();
    const newAttempts = failedInfo.attempts + 1;
    
    // Calculate lockout if max attempts reached
    let lockedUntil = null;
    if (newAttempts >= MAX_FAILED_ATTEMPTS) {
      lockedUntil = new Date(now.getTime() + LOCKOUT_MINUTES * 60 * 1000);
      Logger.log('⚠️ User ' + username + ' locked out until ' + lockedUntil);
    }
    
    if (failedInfo.rowIndex > 0) {
      // Update existing row
      attemptsSheet.getRange(failedInfo.rowIndex, 3).setValue(newAttempts);
      attemptsSheet.getRange(failedInfo.rowIndex, 4).setValue(now);
      attemptsSheet.getRange(failedInfo.rowIndex, 5).setValue(lockedUntil || '');
    } else {
      // Add new row
      attemptsSheet.appendRow([username, email, newAttempts, now, lockedUntil || '']);
    }
    
    return { attempts: newAttempts, isLocked: newAttempts >= MAX_FAILED_ATTEMPTS, lockedUntil };
    
  } catch (error) {
    Logger.log('recordFailedAttempt Error: ' + error.toString());
    return { attempts: 0, isLocked: false };
  }
}

/**
 * Reset failed attempts after successful verification
 * @param {string} username - Username
 * @param {string} email - Email
 */
function resetFailedAttempts(username, email) {
  try {
    const ss = SpreadsheetApp.openById(LOGIN_SPREADSHEET_ID);
    const attemptsSheet = ss.getSheetByName('OTP_Failed_Attempts');
    
    if (!attemptsSheet) return;
    
    const failedInfo = getFailedAttempts(username, email);
    
    if (failedInfo.rowIndex > 0) {
      attemptsSheet.deleteRow(failedInfo.rowIndex);
      Logger.log('✅ Reset failed attempts for ' + username);
    }
    
  } catch (error) {
    Logger.log('resetFailedAttempts Error: ' + error.toString());
  }
}

/**
 * 🔧 RUN THIS FUNCTION TO CREATE THE OTP VERIFICATION SHEET 🔧
 * 
 * Creates the Email_Verification_OTPs sheet with proper structure
 * Run this once in Apps Script editor before using email verification
 */
function setupEmailVerificationSheet() {
  Logger.log('=== SETTING UP EMAIL VERIFICATION SHEET ===');
  
  try {
    const ss = SpreadsheetApp.openById(LOGIN_SPREADSHEET_ID);
    
    // Check if sheet already exists
    let sheet = ss.getSheetByName(OTP_SHEET_NAME);
    
    if (sheet) {
      Logger.log('⚠️ Sheet "' + OTP_SHEET_NAME + '" already exists.');
      Logger.log('Checking structure...');
      
      const headers = sheet.getRange(1, 1, 1, 6).getValues()[0];
      const expectedHeaders = ['Username', 'Email', 'OTP_Code', 'Created_At', 'Expires_At', 'Verified'];
      
      const headersMatch = expectedHeaders.every((h, i) => headers[i] === h);
      
      if (headersMatch) {
        Logger.log('✅ Sheet structure is correct!');
      } else {
        Logger.log('⚠️ Sheet exists but headers are different. Current headers: ' + JSON.stringify(headers));
        Logger.log('Expected headers: ' + JSON.stringify(expectedHeaders));
      }
      
      return;
    }
    
    // Create new sheet
    sheet = ss.insertSheet(OTP_SHEET_NAME);
    
    // Set headers
    const headers = ['Username', 'Email', 'OTP_Code', 'Created_At', 'Expires_At', 'Verified'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // Format header row
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#FF8800');
    headerRange.setFontColor('#FFFFFF');
    
    // Set column widths
    sheet.setColumnWidth(1, 150); // Username
    sheet.setColumnWidth(2, 250); // Email
    sheet.setColumnWidth(3, 100); // OTP_Code
    sheet.setColumnWidth(4, 180); // Created_At
    sheet.setColumnWidth(5, 180); // Expires_At
    sheet.setColumnWidth(6, 80);  // Verified
    
    // Freeze header row
    sheet.setFrozenRows(1);
    
    Logger.log('✅ Sheet "' + OTP_SHEET_NAME + '" created successfully!');
    Logger.log('');
    Logger.log('Column Structure:');
    Logger.log('  A: Username - The user requesting verification');
    Logger.log('  B: Email - Email address being verified');
    Logger.log('  C: OTP_Code - 6-digit verification code');
    Logger.log('  D: Created_At - When OTP was generated');
    Logger.log('  E: Expires_At - When OTP expires (15 min from creation)');
    Logger.log('  F: Verified - TRUE if email verified, FALSE otherwise');
    Logger.log('');
    Logger.log('=== SETUP COMPLETE ===');
    
  } catch (error) {
    Logger.log('❌ Error creating sheet: ' + error.toString());
    Logger.log('Make sure you have edit access to the spreadsheet.');
  }
}

/**
 * Generate a 6-digit OTP code
 * @returns {string} 6-digit OTP
 */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send OTP verification email
 * @param {string} email - Recipient email
 * @param {string} name - User's name  
 * @param {string} otp - 6-digit OTP code
 */
function sendOTPVerificationEmail(email, name, otp) {
  Logger.log('sendOTPVerificationEmail called');
  Logger.log('Email: ' + email);
  Logger.log('Name: ' + name);
  Logger.log('OTP: ' + otp);
  
  const dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMMM dd, yyyy");
  const timeStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "hh:mm a");
  
  const subjectLine = "Email Verification Code - YSP Tagum";
  
  const mainContent = `
    <p style="margin-bottom: 24px;">You requested to verify your email address on <strong>${dateStr}</strong> at ${timeStr}.</p>
    
    <div style="background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
      <div style="background-color: #f8f9fa; padding: 12px 20px; border-bottom: 1px solid #eeeeee;">
        <span style="font-family: 'Lexend', sans-serif; font-size: 12px; font-weight: 600; color: #666; letter-spacing: 0.5px; text-transform: uppercase;">Your Verification Code</span>
      </div>
      <div style="padding: 30px; text-align: center;">
        <div style="font-size: 40px; font-weight: 700; letter-spacing: 8px; color: #FF8800; font-family: 'Roboto Mono', monospace; background-color: #fff8f0; padding: 20px 30px; border-radius: 12px; display: inline-block; border: 2px dashed #FFD4A8;">
          ${otp}
        </div>
        <div style="margin-top: 20px;">
          <div style="background-color: #fef3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 12px 16px; display: inline-block;">
            <span style="font-size: 16px; margin-right: 8px;">⏱️</span>
            <span style="font-size: 14px; color: #856404; font-weight: 600;">This code expires in 15 minutes</span>
          </div>
        </div>
      </div>
    </div>
    
    <div style="margin-top: 20px; background-color: #e8f5e9; border: 1px solid #c8e6c9; border-radius: 8px; padding: 16px;">
      <div style="display: flex; align-items: flex-start;">
        <span style="font-size: 18px; margin-right: 10px;">🔒</span>
        <div>
          <div style="font-weight: 600; color: #2e7d32; margin-bottom: 4px;">Security Notice</div>
          <div style="font-size: 13px; color: #388e3c;">
            Never share this code with anyone. YSP staff will never ask for your verification code.
          </div>
        </div>
      </div>
    </div>`;

  const htmlBody = `
  <!DOCTYPE html>
  <html>
  <head>
    <link href="https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&family=Roboto:wght@400;500;700&family=Roboto+Mono:wght@700&display=swap" rel="stylesheet">
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
                <img src="${LOGO_URL}" alt="YSP Logo" width="70" style="display: block; width: 70px; height: auto; border-radius: 50%; background: #fff; padding: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); margin-bottom: 16px;">
                <div class="font-header" style="color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; margin: 0;">Youth Service Philippines</div>
                <div class="font-body" style="color: rgba(255,255,255,0.9); font-size: 14px; margin-top: 6px; font-weight: 500;">Tagum Chapter</div>
              </td>
            </tr>
            <tr>
              <td style="padding: 40px 30px;">
                <div class="font-header" style="color: #1a1a1a; font-size: 20px; font-weight: 600; margin-bottom: 16px;">Hello, ${name || 'Member'}</div>
                <div class="font-body" style="color: #4a5568; font-size: 15px; line-height: 1.6;">
                  ${mainContent}
                </div>
                <div style="margin-top: 30px; border-top: 1px solid #eeeeee; padding-top: 20px;">
                   <table width="100%">
                     <tr>
                       <td width="20" valign="top" style="color: #aaa; font-size: 16px;">ℹ️</td>
                       <td style="font-size: 12px; color: #888; line-height: 1.5;">
                         <strong>Didn't request this?</strong> If you didn't request email verification, you can safely ignore this email.
                       </td>
                     </tr>
                   </table>
                </div>
                <table width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top: 30px;">
                  <tr>
                    <td align="center">
                      <a href="${WEB_APP_URL}" style="display: inline-block; background-color: #FF8800; color: #ffffff; font-family: 'Lexend', sans-serif; font-weight: 600; font-size: 14px; padding: 12px 28px; text-decoration: none; border-radius: 6px; box-shadow: 0 2px 4px rgba(255, 136, 0, 0.3); margin: 0 8px;">Access Web App</a>
                      <a href="${FB_PAGE_URL}" style="display: inline-block; background-color: #ffffff; color: #4a5568; border: 1px solid #e2e8f0; font-family: 'Lexend', sans-serif; font-weight: 600; font-size: 14px; padding: 11px 28px; text-decoration: none; border-radius: 6px; margin: 0 8px;">Facebook</a>
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

  Logger.log('Sending OTP verification email via MailApp...');
  MailApp.sendEmail({
    to: email,
    subject: subjectLine,
    htmlBody: htmlBody
  });
  Logger.log('OTP verification email sent successfully');
}

/**
 * Handle sending verification OTP
 * @param {string} username - Username requesting verification
 * @param {string} email - Email to verify
 * @returns {TextOutput} JSON response
 */
function handleSendVerificationOTP(username, email) {
  Logger.log('=== handleSendVerificationOTP ===');
  
  // Trim inputs to remove any whitespace
  username = (username || '').toString().trim();
  email = (email || '').toString().trim();
  
  Logger.log('Username: ' + username);
  Logger.log('Email: ' + email);
  Logger.log('Email length: ' + email.length);
  
  if (!username) {
    return createErrorResponse('Username is required', 400);
  }
  
  if (!email) {
    return createErrorResponse('Email is required', 400);
  }
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    Logger.log('Email validation failed for: [' + email + ']');
    return createErrorResponse('Invalid email format', 400);
  }

  try {
    const ss = SpreadsheetApp.openById(LOGIN_SPREADSHEET_ID);
    
    // Get OTP sheet
    let otpSheet = ss.getSheetByName(OTP_SHEET_NAME);
    if (!otpSheet) {
      Logger.log('OTP sheet not found, creating...');
      setupEmailVerificationSheet();
      otpSheet = ss.getSheetByName(OTP_SHEET_NAME);
    }
    
    // 🧹 Clean up expired OTPs first
    cleanupExpiredOTPs();
    
    // 🔒 Check progressive cooldown (anti-spam)
    const requestHistory = getOTPRequestHistory(username);
    if (!requestHistory.canRequest) {
      const waitTimeStr = formatWaitTime(requestHistory.waitSeconds);
      Logger.log('⚠️ User in cooldown: ' + username + ' - wait ' + requestHistory.waitSeconds + 's');
      return createErrorResponse(
        'Please wait ' + waitTimeStr + ' before requesting another verification code.', 
        429
      );
    }
    
    // 🔒 Check if user is locked out from failed attempts
    const failedInfo = getFailedAttempts(username, email);
    if (failedInfo.isLocked) {
      const lockTimeStr = failedInfo.lockedUntil ? failedInfo.lockedUntil.toLocaleTimeString() : 'later';
      Logger.log('⚠️ User is locked out: ' + username);
      return createErrorResponse(
        'Account temporarily locked due to too many failed verification attempts. Please try again after ' + lockTimeStr + '.',
        423
      );
    }
    
    // Get user's full name from User Profiles
    const userSheet = ss.getSheetByName(LOGIN_SHEET_NAME);
    const userData = userSheet.getDataRange().getValues();
    const userHeaders = userData[0];
    const usernameIdx = userHeaders.indexOf('Username');
    const nameIdx = userHeaders.indexOf('Full name');
    
    let userName = 'Member';
    for (let i = 1; i < userData.length; i++) {
      if ((userData[i][usernameIdx] || '').toString().toLowerCase().trim() === username.toLowerCase().trim()) {
        userName = userData[i][nameIdx] || 'Member';
        break;
      }
    }
    
    // Delete any existing OTPs for this username+email combination
    const otpData = otpSheet.getDataRange().getValues();
    for (let i = otpData.length - 1; i >= 1; i--) {
      const rowUsername = (otpData[i][0] || '').toString().toLowerCase().trim();
      const rowEmail = (otpData[i][1] || '').toString().toLowerCase().trim();
      if (rowUsername === username.toLowerCase().trim() && rowEmail === email.toLowerCase().trim()) {
        otpSheet.deleteRow(i + 1);
        Logger.log('Deleted existing OTP row: ' + (i + 1));
      }
    }
    
    // Generate new OTP
    const otp = generateOTP();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);
    
    // Store OTP in sheet
    otpSheet.appendRow([
      username,
      email,
      otp,
      now,
      expiresAt,
      false
    ]);
    
    // 📊 Record this request for progressive cooldown
    const cooldownInfo = recordOTPRequest(username);
    
    Logger.log('OTP stored: ' + otp);
    Logger.log('Expires at: ' + expiresAt);
    Logger.log('Request #' + cooldownInfo.requestCount + ' - Next cooldown: ' + cooldownInfo.cooldownSeconds + 's');
    
    // Send OTP email
    try {
      sendOTPVerificationEmail(email, userName, otp);
      Logger.log('✅ OTP email sent successfully');
    } catch (emailError) {
      Logger.log('❌ Failed to send OTP email: ' + emailError.toString());
      return createErrorResponse('Failed to send verification email. Please try again.', 500);
    }
    
    // Calculate next cooldown message for user
    const nextCooldownIndex = Math.min(cooldownInfo.requestCount, OTP_COOLDOWNS.length - 1);
    const nextCooldownSeconds = OTP_COOLDOWNS[nextCooldownIndex];
    const nextCooldownMsg = formatWaitTime(nextCooldownSeconds);
    
    return createSuccessResponse({
      success: true,
      message: 'Verification code sent to ' + email,
      expiresInMinutes: OTP_EXPIRY_MINUTES,
      requestNumber: cooldownInfo.requestCount,
      nextCooldown: nextCooldownMsg
    });
    
  } catch (error) {
    Logger.log('handleSendVerificationOTP Error: ' + error.toString());
    return createErrorResponse('Failed to send verification code: ' + error.message, 500);
  }
}

/**
 * Handle OTP verification
 * @param {string} username - Username verifying email
 * @param {string} email - Email being verified
 * @param {string} otp - OTP code entered by user
 * @returns {TextOutput} JSON response
 */
function handleVerifyOTP(username, email, otp) {
  Logger.log('=== handleVerifyOTP ===');
  Logger.log('Username: ' + username);
  Logger.log('Email: ' + email);
  Logger.log('OTP: ' + otp);
  
  if (!username || !email || !otp) {
    return createErrorResponse('Username, email, and OTP are required', 400);
  }

  try {
    // 🔒 Check if user is locked out from failed attempts
    const failedInfo = getFailedAttempts(username, email);
    if (failedInfo.isLocked) {
      const lockTimeStr = failedInfo.lockedUntil ? failedInfo.lockedUntil.toLocaleTimeString() : 'later';
      Logger.log('⚠️ User is locked out: ' + username);
      return createErrorResponse(
        'Account temporarily locked due to too many failed verification attempts. Please try again after ' + lockTimeStr + '.',
        423
      );
    }
    
    const ss = SpreadsheetApp.openById(LOGIN_SPREADSHEET_ID);
    const otpSheet = ss.getSheetByName(OTP_SHEET_NAME);
    
    if (!otpSheet) {
      return createErrorResponse('Verification system not initialized', 500);
    }
    
    // 🧹 Clean up expired OTPs first
    cleanupExpiredOTPs();
    
    const otpData = otpSheet.getDataRange().getValues();
    const now = new Date();
    
    // Find matching OTP entry
    for (let i = 1; i < otpData.length; i++) {
      const rowUsername = (otpData[i][0] || '').toString().toLowerCase().trim();
      const rowEmail = (otpData[i][1] || '').toString().toLowerCase().trim();
      const rowOTP = (otpData[i][2] || '').toString().trim();
      const rowExpiry = new Date(otpData[i][4]);
      const rowVerified = otpData[i][5];
      
      if (rowUsername === username.toLowerCase().trim() && 
          rowEmail === email.toLowerCase().trim()) {
        
        // Check if already verified
        if (rowVerified === true) {
          // 🧹 Delete the used OTP record
          otpSheet.deleteRow(i + 1);
          Logger.log('🧹 Deleted already-verified OTP record');
          return createSuccessResponse({
            success: true,
            verified: true,
            message: 'Email already verified'
          });
        }
        
        // Check if OTP expired
        if (now > rowExpiry) {
          // 🧹 Delete expired OTP
          otpSheet.deleteRow(i + 1);
          Logger.log('🧹 Deleted expired OTP record');
          return createErrorResponse('Verification code has expired. Please request a new one.', 410);
        }
        
        // Check if OTP matches
        if (rowOTP === otp.trim()) {
          // ✅ Successful verification - delete the OTP record immediately
          otpSheet.deleteRow(i + 1);
          Logger.log('🧹 Deleted used OTP record after successful verification');
          
          // Update user profile with verified email
          const updateResult = updateVerifiedEmailInProfile(username, email);
          
          // 🔒 Reset failed attempts on successful verification
          resetFailedAttempts(username, email);
          
          // 🔒 Reset OTP request history (progressive cooldown resets)
          resetOTPRequestHistory(username);
          
          Logger.log('✅ OTP verified successfully for: ' + email);
          
          return createSuccessResponse({
            success: true,
            verified: true,
            message: 'Email verified successfully'
          });
        } else {
          // 🔒 Record failed attempt
          const attemptResult = recordFailedAttempt(username, email);
          const remainingAttempts = MAX_FAILED_ATTEMPTS - attemptResult.attempts;
          
          Logger.log('❌ Invalid OTP. Failed attempts: ' + attemptResult.attempts + '/' + MAX_FAILED_ATTEMPTS);
          
          if (attemptResult.isLocked) {
            return createErrorResponse(
              'Too many failed attempts. Account locked for ' + LOCKOUT_MINUTES + ' minutes.',
              423
            );
          }
          
          return createErrorResponse(
            'Invalid verification code. ' + remainingAttempts + ' attempts remaining.',
            401
          );
        }
      }
    }
    
    return createErrorResponse('No pending verification found for this email', 404);
    
  } catch (error) {
    Logger.log('handleVerifyOTP Error: ' + error.toString());
    return createErrorResponse('Failed to verify code: ' + error.message, 500);
  }
}

/**
 * Update the verified email in user profile
 * @param {string} username - Username to update
 * @param {string} verifiedEmail - The verified email address
 * @returns {Object} Success status
 */
function updateVerifiedEmailInProfile(username, verifiedEmail) {
  try {
    const ss = SpreadsheetApp.openById(LOGIN_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(LOGIN_SHEET_NAME);
    
    if (!sheet) {
      return { success: false, message: 'User sheet not found' };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    const idx = {};
    headers.forEach((header, i) => {
      idx[header] = i;
    });
    
    const usernameColIdx = idx['Username'];
    const emailVerifiedColIdx = idx['EmailVerified'];
    const verifiedEmailColIdx = idx['VerifiedEmail'];
    
    // Search for user row
    const usernameLower = username.toLowerCase().trim();
    let rowIndex = -1;
    
    for (let i = 1; i < data.length; i++) {
      const rowUsername = (data[i][usernameColIdx] || '').toString().toLowerCase().trim();
      if (rowUsername === usernameLower) {
        rowIndex = i + 1;
        break;
      }
    }
    
    if (rowIndex === -1) {
      return { success: false, message: 'User not found' };
    }
    
    // Update EmailVerified and VerifiedEmail columns if they exist
    if (emailVerifiedColIdx !== undefined) {
      sheet.getRange(rowIndex, emailVerifiedColIdx + 1).setValue(true);
    }
    if (verifiedEmailColIdx !== undefined) {
      sheet.getRange(rowIndex, verifiedEmailColIdx + 1).setValue(verifiedEmail);
    }
    
    Logger.log('Updated email verification status for ' + username);
    return { success: true };
    
  } catch (error) {
    Logger.log('updateVerifiedEmailInProfile Error: ' + error.toString());
    return { success: false, message: error.toString() };
  }
}

/**
 * Check if an email is verified for a user
 * Now checks the user profile directly since OTPs are deleted after use
 * @param {string} username - Username to check
 * @param {string} email - Email to check
 * @returns {TextOutput} JSON response with verification status
 */
function handleCheckEmailVerified(username, email) {
  if (!username || !email) {
    return createErrorResponse('Username and email are required', 400);
  }

  try {
    // 🧹 Clean up expired OTPs opportunistically
    cleanupExpiredOTPs();
    
    const ss = SpreadsheetApp.openById(LOGIN_SPREADSHEET_ID);
    
    // First, check the user profile for verification status
    const userSheet = ss.getSheetByName(LOGIN_SHEET_NAME);
    if (userSheet) {
      const userData = userSheet.getDataRange().getValues();
      const headers = userData[0];
      
      const usernameIdx = headers.indexOf('Username');
      const emailVerifiedIdx = headers.indexOf('EmailVerified');
      const verifiedEmailIdx = headers.indexOf('VerifiedEmail');
      
      for (let i = 1; i < userData.length; i++) {
        const rowUsername = (userData[i][usernameIdx] || '').toString().toLowerCase().trim();
        
        if (rowUsername === username.toLowerCase().trim()) {
          const isVerified = userData[i][emailVerifiedIdx] === true;
          const storedVerifiedEmail = (userData[i][verifiedEmailIdx] || '').toString().toLowerCase().trim();
          
          // Email is verified if the flag is true AND the stored email matches
          if (isVerified && storedVerifiedEmail === email.toLowerCase().trim()) {
            return createSuccessResponse({
              success: true,
              verified: true,
              verifiedEmail: email
            });
          }
          break;
        }
      }
    }
    
    return createSuccessResponse({
      success: true,
      verified: false
    });
    
  } catch (error) {
    Logger.log('handleCheckEmailVerified Error: ' + error.toString());
    return createErrorResponse('Failed to check verification status: ' + error.message, 500);
  }
}
