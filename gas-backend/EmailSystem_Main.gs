/**
 * ============================================================
 * YSP CHAPTER - MASTER EMAIL SYSTEM V3.1
 * Features: Dual RSVP, Auto-Reason, Sender/Footer Split, iCal
 * ============================================================
 */

// --- SPREADSHEET ID (Required for Web API) ---
// Set this to your Email System spreadsheet ID
// You can find this in the spreadsheet URL: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('EMAIL_SYSTEM_SPREADSHEET_ID') || '';
const EMAIL_SYSTEM_BRANDING_CACHE_KEY = 'email_system_org_branding_v1';
const EMAIL_SYSTEM_BRANDING_CACHE_TTL_SECONDS = 1800;
const EMAIL_SYSTEM_BRANDING_SHEET_NAME = 'Organization Branding';
const EMAIL_SYSTEM_BRANDING_DEFAULTS = {
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

function normalizeEmailSystemBranding_(raw) {
  var merged = Object.assign({}, EMAIL_SYSTEM_BRANDING_DEFAULTS, raw || {});
  merged.orgName = String(merged.orgName || '').trim() || EMAIL_SYSTEM_BRANDING_DEFAULTS.orgName;
  merged.chapterName = String(merged.chapterName || '').trim() || EMAIL_SYSTEM_BRANDING_DEFAULTS.chapterName;
  merged.shortName = String(merged.shortName || '').trim() || EMAIL_SYSTEM_BRANDING_DEFAULTS.shortName;
  merged.motto = String(merged.motto || '').trim() || EMAIL_SYSTEM_BRANDING_DEFAULTS.motto;
  merged.chapterCode = String(merged.chapterCode || '').trim() || EMAIL_SYSTEM_BRANDING_DEFAULTS.chapterCode;
  merged.location = String(merged.location || '').trim() || EMAIL_SYSTEM_BRANDING_DEFAULTS.location;
  merged.contactEmail = String(merged.contactEmail || '').trim() || EMAIL_SYSTEM_BRANDING_DEFAULTS.contactEmail;
  merged.logoUrl = String(merged.logoUrl || '').trim() || EMAIL_SYSTEM_BRANDING_DEFAULTS.logoUrl;
  merged.themeColor = String(merged.themeColor || '').trim() || EMAIL_SYSTEM_BRANDING_DEFAULTS.themeColor;
  merged.fullName = merged.orgName + ' - ' + merged.chapterName;
  return merged;
}

function getEmailSystemBrandingFromSheet_() {
  try {
    var props = PropertiesService.getScriptProperties();
    var settingsId = String(props.getProperty('SYSTEM_SETTINGS_SPREADSHEET_ID') || '').trim();
    if (!settingsId) return null;

    var ss = SpreadsheetApp.openById(settingsId);
    var sheet = ss.getSheetByName(EMAIL_SYSTEM_BRANDING_SHEET_NAME);
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
    Logger.log('Email system branding sheet fallback read error: ' + sheetReadError);
    return null;
  }
}

function getEmailSystemOrgBranding_() {
  var cache = CacheService.getScriptCache();
  try {
    var cachedRaw = cache.get(EMAIL_SYSTEM_BRANDING_CACHE_KEY);
    if (cachedRaw) {
      return normalizeEmailSystemBranding_(JSON.parse(cachedRaw));
    }
  } catch (cacheReadError) {
    Logger.log('Email system branding cache read error: ' + cacheReadError);
  }

  var branding = normalizeEmailSystemBranding_({});
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
          branding = normalizeEmailSystemBranding_(parsed.data);
          resolvedFromEndpoint = true;
        }
      }
    }
  } catch (fetchError) {
    Logger.log('Email system branding fetch error: ' + fetchError);
  }

  if (!resolvedFromEndpoint) {
    var sheetBranding = getEmailSystemBrandingFromSheet_();
    if (sheetBranding) {
      branding = normalizeEmailSystemBranding_(sheetBranding);
    }
  }

  try {
    cache.put(EMAIL_SYSTEM_BRANDING_CACHE_KEY, JSON.stringify(branding), EMAIL_SYSTEM_BRANDING_CACHE_TTL_SECONDS);
  } catch (cacheWriteError) {
    Logger.log('Email system branding cache write error: ' + cacheWriteError);
  }

  return branding;
}

const EMAIL_SYSTEM_ORG_BRANDING = getEmailSystemOrgBranding_();
const GLOBAL_MOTTO = EMAIL_SYSTEM_ORG_BRANDING.motto;
const TIMEZONE = "Asia/Manila"; // Manila local time (UTC+8)
const LOGO_URL = EMAIL_SYSTEM_ORG_BRANDING.logoUrl;
const FB_PAGE_URL = "https://www.facebook.com/YSPTagumChapter";
const WEB_PORTAL_URL = "https://tgm.youthserviceph.org/Home";

// --- CONFIGURATION ---
// 1. WHAT SHOWS IN THE RECIPIENT'S INBOX LIST:
const SENDER_DISPLAY_NAME = EMAIL_SYSTEM_ORG_BRANDING.fullName; 

// 2. WHAT SHOWS AT THE BOTTOM OF THE EMAIL (THE FOOTER):
const FOOTER_NAME = "Ezequiel John B. Crisostomo";
const FOOTER_POSITION = "Membership & Internal Affairs Officer";
const FOOTER_ORG = EMAIL_SYSTEM_ORG_BRANDING.orgName + " — " + EMAIL_SYSTEM_ORG_BRANDING.chapterName;
const FOOTER_EMAIL = EMAIL_SYSTEM_ORG_BRANDING.contactEmail;
const FOOTER_WEBSITE = WEB_PORTAL_URL;

const SHEET_LAYOUTS = {
  "Event_Invites": {
    headers: ["Recipient Name", "Email", "Event Name", "Message", "Date", "Time", "Venue", "RSVP Link", "Registration Link", "Attachments"],
    map: { name:0, email:1, headline:2, msg:3, date:4, time:5, venue:6, link:7, registrationLink:8, attach:9 },
    btn: "Confirm Attendance",
    type: "event",
    code: "EI" // Event Invites
  },
  "Appointments": {
    headers: ["Appointee Name", "Email", "New Position", "Message", "Old Position", "Effective Date", "Department/Committee", "Reference Link", "Attachments"],
    map: { name:0, email:1, headline:2, msg:3, oldPosition:4, date:5, venue:6, link:7, attach:8 },
    btn: "Accept Designation",
    type: "appointment",
    code: "AP" // Appointments
  },
  "Payment_Reminders": {
    headers: ["Member Name", "Email", "Payment For", "Message", "Amount Due", "Due Date", "Payment Link", "Attachments"],
    map: { name:0, email:1, headline:2, msg:3, amount:4, date:5, link:6, attach:7 }, 
    btn: "I Have Paid",
    type: "payment",
    code: "PR" // Payment Reminders
  },
  "General_Notices": {
    headers: ["Recipient Name", "Email", "Subject", "Message", "Document Link", "Attachments"],
    map: { name:0, email:1, headline:2, msg:3, link:4, attach:5 },
    btn: "View Document",
    type: "simple",
    code: "GN" // General Notices
  },
  "Doc_Acknowledgment": {
    headers: ["Recipient Name", "Email", "Document Name", "Message", "Policy Link", "Deadline", "Attachments"],
    map: { name:0, email:1, headline:2, msg:3, link:4, date:5, attach:6 },
    btn: "I Acknowledge Receipt",
    type: "simple",
    code: "DA" // Doc Acknowledgment
  },
  "Volunteer_Call": {
    headers: ["Volunteer Name", "Email", "Project Name", "Message", "Date", "Time", "Role/Task", "Sign-Up Link", "Attachments"],
    map: { name:0, email:1, headline:2, msg:3, date:4, time:5, venue:6, link:7, attach:8 },
    btn: "I'm In!",
    type: "event",
    code: "VC" // Volunteer Call
  },
  "Feedback_Request": {
    headers: ["Recipient Name", "Email", "Event/Topic", "Message", "Survey Link", "Attachments"],
    map: { name:0, email:1, headline:2, msg:3, link:4, attach:5 },
    btn: "Take Short Survey",
    type: "simple",
    code: "FR" // Feedback Request
  },
  "Membership_Renewal": {
    headers: ["Member Name", "Email", "Membership Year", "Message", "Deadline", "Renewal Form Link", "Attachments"],
    map: { name:0, email:1, headline:2, msg:3, date:4, link:5, attach:6 },
    btn: "Renew My Membership",
    type: "simple",
    code: "MR" // Membership Renewal
  },
  "Resource_Share": {
    headers: ["Recipient Name", "Email", "Resource Title", "Message", "Download Link", "Attachments"],
    map: { name:0, email:1, headline:2, msg:3, link:4, attach:5 },
    btn: "Download Toolkit",
    type: "simple",
    code: "RS" // Resource Share
  },
  "Emergency_Alert": {
    headers: ["Recipient Name", "Email", "Alert Title", "Urgent Message", "Action Link", "Time of Alert", "Attachments"],
    map: { name:0, email:1, headline:2, msg:3, link:4, time:5, attach:6 },
    btn: "I Am Safe / Read This",
    type: "urgent",
    code: "EA" // Emergency Alert
  },
  "System_Instructions": {
    headers: ["Topic", "Details", "Notes", "Status"],
    map: { name:0, email:1, headline:2, msg:3 }, 
    btn: "Open Guide",
    type: "instruction",
    code: "SI" // System Instructions
  }
};

// --- CORE AUTOMATION ---

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('📧 YSP Mail System')
    // Section 1: Setup & Automation
    .addItem('▶ 1. SETUP SHEETS (Run First)', 'setupEmailSystem')
    .addItem('▶ 2. ACTIVATE AUTO-SEND', 'installTrigger') 
    .addItem('🧪 3. POPULATE TEST DATA', 'populateTestData')
    .addSeparator()
    
    // Section 2: Migration Tools
    .addSubMenu(ui.createMenu('Migration Tools')
        .addItem('Preview Migration (Dry Run)', 'previewMigration')
        .addItem('Event Invites: Insert Registration Link', 'migrateEventInvitesRegistrationLinkOnly')
        .addItem('Run Migration', 'migrateEmailSystemSchema'))
    .addSeparator()
    
    // Section 3: PDF Export
    .addItem('📄 EXPORT CURRENT SHEET AS PDF', 'generateCurrentSheetPDF')
    .addSeparator()
    
    // Section 4: Quota Check
    .addItem('📊 CHECK QUOTA', 'checkEmailQuota')
    .addSeparator()
    
    // Section 5: Manual Batch Sending
    .addSubMenu(ui.createMenu('Batch Send Manual')
        .addItem('All Event Invites', 'sendEventInvites')
        .addItem('All Appointments', 'sendAppointments')
        .addItem('All Payment Reminders', 'sendPaymentReminders')
        .addItem('All General Notices', 'sendGeneralNotices')
        .addItem('All Doc Ack', 'sendDocAck')
        .addItem('All Volunteer Call', 'sendVolunteerCall')
        .addItem('All Feedback Request', 'sendFeedbackReq')
        .addItem('All Membership Renewal', 'sendMembershipRenewal')
        .addItem('All Resource Share', 'sendResourceShare')
        .addItem('All Emergency Alert', 'sendEmergencyAlert'))
    .addToUi();
}


/**
 * INSTALLABLE TRIGGER: Run handleEdit on spreadsheet edit.
 * UPGRADED: Supports multi-row edits (Drag-and-Drop).
 */
function handleEdit(e) {
  const range = e.range;
  // ... rest of the function remains the same ...
  const sheet = range.getSheet();
  const sheetName = sheet.getName();
  
  if (!SHEET_LAYOUTS[sheetName]) return;
  const config = SHEET_LAYOUTS[sheetName];
  const statusColIndex = config.headers.length + 1;

  // Check if the edit includes the Status column
  if (range.getColumn() === statusColIndex) {
    const numRows = range.getNumRows();
    const startRow = range.getRow();
    const values = range.getValues(); // Get all values in the edited range

    // Loop through every row that was edited
    for (let i = 0; i < numRows; i++) {
      let val = values[i][0];
      const valLower = val ? String(val).toLowerCase().trim() : "";
      if (valLower === "send" || valLower === "force") {
        // Send email for this specific row
        sendSingleRow(sheet, startRow + i, config, statusColIndex);
      }
    }
  }
}

function sendSingleRow(sheet, rowIndex, config, statusColIndex) {
  const data = sheet.getRange(rowIndex, 1, 1, config.headers.length + 4).getValues()[0];
  const map = config.map;
  
  // Get status value
  const statusValue = String(data[statusColIndex-1]).trim().toLowerCase();
  const emailIdColIndex = statusColIndex + 3; // Column for Email ID (after Status, Response, Tracking Email)
  const existingEmailId = sheet.getRange(rowIndex, emailIdColIndex).getValue();
  
  // DUPLICATE PREVENTION: Check if already sent from this row
  if (statusValue.startsWith("sent") || existingEmailId) {
    SpreadsheetApp.getActiveSpreadsheet().toast("Already sent! ID: " + existingEmailId, "⚠️ SKIPPED");
    return;
  }
  
  // Check for "force" to bypass duplicate detection
  const isForced = statusValue === "force";
  
  // If not forced, check MASTER_LOG for duplicate (same email + headline combo)
  if (!isForced) {
    const recipientEmail = data[map.email];
    const headline = data[map.headline];
    const duplicateInfo = checkForDuplicate(recipientEmail, headline);
    
    if (duplicateInfo) {
      sheet.getRange(rowIndex, statusColIndex)
        .setValue("⚠️ DUPLICATE DETECTED - Previously sent " + duplicateInfo.date + " (ID: " + duplicateInfo.id + "). Type 'Force' to send anyway.")
        .setBackground("#fff3cd")
        .setFontColor("#856404");
      SpreadsheetApp.getActiveSpreadsheet().toast("Duplicate found! Type 'Force' to override.", "⚠️ DUPLICATE");
      return;
    }
  }
  
  // Lock this row to prevent concurrent sends
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // Wait up to 10 seconds
  } catch (e) {
    SpreadsheetApp.getActiveSpreadsheet().toast("Could not acquire lock. Try again.", "⚠️ BUSY");
    return;
  }

  let info = {
    name:        data[map.name],
    email:       data[map.email],
    headline:    data[map.headline],
    message:     data[map.msg],
    date:        (map.date !== undefined) ? formatDate(data[map.date]) : "",
    time:        (map.time !== undefined) ? formatTime(data[map.time]) : "",
    venue:       (map.venue !== undefined) ? data[map.venue] : "",
    amount:      (map.amount !== undefined) ? data[map.amount] : "",
    link:        (map.link !== undefined) ? data[map.link] : "",
    registrationLink: (map.registrationLink !== undefined) ? data[map.registrationLink] : "",
    attach:      (map.attach !== undefined) ? data[map.attach] : "",
    oldPosition: (map.oldPosition !== undefined) ? data[map.oldPosition] : "",
    btnText:     config.btn,
    type:        config.type,
    sheetName:   sheet.getName()
  };

  if (info.email) {
    try {
      const myEmail = Session.getActiveUser().getEmail();
      const cleanTag = info.headline.toString().replace(/[^a-zA-Z0-9]/g, '');
      const parts = myEmail.split('@');
      const trackingEmail = `${parts[0]}+${cleanTag}@${parts[1]}`;
      
      // Generate unique Email ID: YSPTC-MM-YY-XXX
      const emailId = generateEmailId(config.code);

      // 1. Get existing file attachments
      const blobs = getAttachments(info.attach);

      // 2. Generate Calendar File for Events (not for position appointments)
      if (info.type === "event" && info.sheetName !== "Appointments" && data[map.date]) {
        const calendarBlob = createIcsBlob(
          info.headline, 
          data[map.date], 
          data[map.time], 
          info.venue, 
          "Please confirm attendance via the email link."
        );
        if (calendarBlob) {
          blobs.push(calendarBlob);
        }
      }

      // 3. Generate HTML with Email ID
      const htmlBody = generateUniversalTemplate(info, trackingEmail, emailId);
      
      // 4. Send the Email
      MailApp.sendEmail({
        to: info.email,
      subject: "[YSP] " + info.headline + " - " + info.name,        htmlBody: htmlBody,
        attachments: blobs,
        name: SENDER_DISPLAY_NAME, 
        replyTo: trackingEmail
      });

      // --- NEW FEATURE: AUTO-LABEL ---
      try {
        const labelName = EMAIL_SYSTEM_ORG_BRANDING.shortName + " Email System";
        // Get label or create if it doesn't exist
        const label = GmailApp.getUserLabelByName(labelName) || GmailApp.createLabel(labelName);
        
        // PAUSE for 2 seconds to let Gmail index the sent mail
        Utilities.sleep(2000); 

        // Search for the email we just sent
        const threads = GmailApp.search('to:"' + info.email + '" subject:"' + info.headline + ' - ' + info.name + '"');
        if (threads.length > 0) {
          // Apply the label to the first matching thread
          label.addToThread(threads[0]);
        }
      } catch (err) {
        Logger.log("Labeling Error: " + err.toString()); // Log but don't stop the script
      }
      // -------------------------------

      const ts = Utilities.formatDate(new Date(), TIMEZONE, "MMM dd, yyyy h:mm a");
      sheet.getRange(rowIndex, statusColIndex).setValue("Sent: " + ts).setBackground("#d9ead3");
      sheet.getRange(rowIndex, statusColIndex + 2).setValue(trackingEmail);
      sheet.getRange(rowIndex, statusColIndex + 3).setValue(emailId); // Save Email ID
      logToMaster(info.name, info.email, sheet.getName(), ts, emailId, info.headline);
      SpreadsheetApp.flush();
      checkEmailQuota();

    } catch (e) {
      sheet.getRange(rowIndex, statusColIndex).setValue("Error: " + e.message).setBackground("#f4cccc");
    } finally {
      lock.releaseLock(); // Always release the lock
    }
  } else {
    lock.releaseLock();
  }
}

function logToMaster(name, email, type, time, emailId, headline) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let logSheet = ss.getSheetByName("MASTER_LOG");
  if (!logSheet) {
    logSheet = ss.insertSheet("MASTER_LOG");
    logSheet.appendRow(["EMAIL ID", "NAME", "EMAIL", "HEADLINE", "TEMPLATE", "TIMESTAMP"]);
    logSheet.getRange(1,1,1,6).setFontWeight("bold").setBackground("#333").setFontColor("white");
  }
  logSheet.appendRow([emailId, name, email, headline, type, time]);
}

/**
 * Generates a unique Email ID in format: YSPTC-MM-YY-XXX
 * YSPTC = chapter-specific email prefix
 * MM = 2-letter template code (EI, AP, PR, etc.)
 * YY = Last 2 digits of current year
 * XXX = Sequential 3-digit number (per template, per year)
 */
function generateEmailId(templateCode) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getScriptProperties();
  
  // Get current year (last 2 digits)
  const now = new Date();
  const year = Utilities.formatDate(now, TIMEZONE, "yy");
  
  // Property keys are per-template
  const yearKey = `EMAIL_ID_YEAR_${templateCode}`;
  const counterKey = `EMAIL_ID_COUNTER_${templateCode}`;
  
  // Get stored year and counter for this template
  const storedYear = props.getProperty(yearKey) || "";
  let counter = parseInt(props.getProperty(counterKey) || "0");
  
  // Reset counter if year changed
  if (storedYear !== year) {
    counter = 0;
    props.setProperty(yearKey, year);
  }
  
  // Generate candidate ID and check for duplicates
  let emailId;
  let attempts = 0;
  const maxAttempts = 100; // Safety limit
  
  do {
    counter++;
    const paddedCounter = String(counter).padStart(3, '0');
    emailId = `YSPTC-${templateCode}-${year}-${paddedCounter}`;
    attempts++;
  } while (emailIdExists(emailId) && attempts < maxAttempts);
  
  // Save the counter
  props.setProperty(counterKey, counter.toString());
  
  return emailId;
}

/**
 * Checks if an Email ID already exists in MASTER_LOG
 */
function emailIdExists(emailId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheetByName("MASTER_LOG");
  
  if (!logSheet || logSheet.getLastRow() < 2) return false;
  
  // Get all Email IDs (column 1)
  const existingIds = logSheet.getRange(2, 1, logSheet.getLastRow() - 1, 1).getValues();
  
  for (let i = 0; i < existingIds.length; i++) {
    if (String(existingIds[i][0]).toUpperCase() === emailId.toUpperCase()) {
      return true;
    }
  }
  
  return false;
}

/**
 * Checks MASTER_LOG for duplicate sends (same email + headline)
 * Returns { id, date } if duplicate found, null otherwise
 */
function checkForDuplicate(recipientEmail, headline) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheetByName("MASTER_LOG");
  
  if (!logSheet || logSheet.getLastRow() < 2) return null;
  
  // Get all log data (EMAIL ID, NAME, EMAIL, HEADLINE, TEMPLATE, TIMESTAMP)
  const logData = logSheet.getRange(2, 1, logSheet.getLastRow() - 1, 6).getValues();
  
  // Search for matching email + exact headline
  const searchEmail = String(recipientEmail).toLowerCase().trim();
  const searchHeadline = String(headline).toLowerCase().trim();
  
  for (let i = logData.length - 1; i >= 0; i--) {
    const row = logData[i];
    const logEmail = String(row[2]).toLowerCase().trim();
    const logHeadline = String(row[3]).toLowerCase().trim();
    const logId = row[0];
    const logDate = row[5];
    
    // Match if same email AND same headline (exact match)
    if (logEmail === searchEmail && logHeadline === searchHeadline) {
      return {
        id: logId,
        date: logDate
      };
    }
  }
  
  return null;
}

/**
 * Helper: Generate dual mailto buttons (both buttons are mailto links)
 */
function generateDualMailtoButtons(linkYes, textYes, linkNo, textNo) {
  return `
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 28px;">
      <tr>
        <td align="center">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${linkYes}" style="height:48px;v-text-anchor:middle;width:180px;" arcsize="10%" strokecolor="#F26522" fillcolor="#F26522">
            <w:anchorlock/>
            <center style="color:#ffffff;font-family:'Inter',sans-serif;font-size:14px;font-weight:600;">${textYes}</center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-->
          <a href="${linkYes}" style="background-color:#F26522; color:#ffffff; padding:14px 28px; text-decoration:none; border-radius:8px; font-weight:600; font-size:14px; display:inline-block; margin: 8px; border: none; font-family:'Inter', 'Segoe UI', sans-serif; white-space: nowrap; box-shadow: 0 2px 8px rgba(242, 101, 34, 0.3);">
            ${textYes}
          </a>
          <!--<![endif]-->
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${linkNo}" style="height:48px;v-text-anchor:middle;width:180px;" arcsize="10%" strokecolor="#F26522" fillcolor="#ffffff">
            <w:anchorlock/>
            <center style="color:#F26522;font-family:'Inter',sans-serif;font-size:14px;font-weight:600;">${textNo}</center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-->
          <a href="${linkNo}" style="background-color:#ffffff; color:#F26522; padding:14px 28px; text-decoration:none; border-radius:8px; font-weight:600; font-size:14px; display:inline-block; margin: 8px; border: 2px solid #F26522; font-family:'Inter', 'Segoe UI', sans-serif; white-space: nowrap;">
            ${textNo}
          </a>
          <!--<![endif]-->
        </td>
      </tr>
    </table>`;
}

/**
 * Helper: Generate dual buttons (primary mailto, secondary external link)
 */
function generateDualButtons(linkPrimary, textPrimary, linkSecondary, textSecondary) {
  const secondaryLink = formatActionLink(linkSecondary) || "#";
  return `
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 28px;">
      <tr>
        <td align="center">
          <!--[if !mso]><!-->
          <a href="${linkPrimary}" style="background-color:#F26522; color:#ffffff; padding:14px 28px; text-decoration:none; border-radius:8px; font-weight:600; font-size:14px; display:inline-block; margin: 8px; border: none; font-family:'Inter', 'Segoe UI', sans-serif; white-space: nowrap; box-shadow: 0 2px 8px rgba(242, 101, 34, 0.3);">
            ${textPrimary}
          </a>
          <!--<![endif]-->
          <!--[if !mso]><!-->
          <a href="${secondaryLink}" target="_blank" style="background-color:#ffffff; color:#F26522; padding:14px 28px; text-decoration:none; border-radius:8px; font-weight:600; font-size:14px; display:inline-block; margin: 8px; border: 2px solid #F26522; font-family:'Inter', 'Segoe UI', sans-serif; white-space: nowrap;">
            ${textSecondary}
          </a>
          <!--<![endif]-->
        </td>
      </tr>
    </table>`;
}

function generateTripleButtons(linkPrimary, textPrimary, linkSecondary, textSecondary, linkTertiary, textTertiary) {
  const tertiaryLink = formatActionLink(linkTertiary) || "#";
  return `
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 28px;">
      <tr>
        <td align="center">
          <a href="${linkPrimary}" style="background-color:#F26522; color:#ffffff; padding:14px 28px; text-decoration:none; border-radius:8px; font-weight:600; font-size:14px; display:inline-block; margin: 8px; border: none; font-family:'Inter', 'Segoe UI', sans-serif; white-space: nowrap; box-shadow: 0 2px 8px rgba(242, 101, 34, 0.3);">
            ${textPrimary}
          </a>
          <a href="${linkSecondary}" style="background-color:#ffffff; color:#F26522; padding:14px 28px; text-decoration:none; border-radius:8px; font-weight:600; font-size:14px; display:inline-block; margin: 8px; border: 2px solid #F26522; font-family:'Inter', 'Segoe UI', sans-serif; white-space: nowrap;">
            ${textSecondary}
          </a>
          <a href="${tertiaryLink}" target="_blank" style="background-color:#fff7ed; color:#c2410c; padding:14px 28px; text-decoration:none; border-radius:8px; font-weight:600; font-size:14px; display:inline-block; margin: 8px; border: 1px solid #fdba74; font-family:'Inter', 'Segoe UI', sans-serif; white-space: nowrap;">
            ${textTertiary}
          </a>
        </td>
      </tr>
    </table>`;
}

/**
 * Helper: Auto-detect link type and format accordingly
 * - Email addresses -> mailto:email
 * - Already mailto/tel/http/https -> return as-is
 * - Plain URLs without protocol -> add https://
 */
function formatActionLink(link) {
  if (!link || link.trim() === '') return '#';
  
  const trimmed = link.trim();
  
  // Already has a protocol (mailto:, tel:, http://, https://, etc.)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return trimmed;
  }
  
  // Looks like an email address (contains @ and has valid domain)
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return 'mailto:' + trimmed;
  }
  
  // Looks like a URL (has domain-like structure)
  if (/^[\w.-]+\.[a-z]{2,}/i.test(trimmed)) {
    return 'https://' + trimmed;
  }
  
  // Default: return as-is (could be a relative path or other)
  return trimmed;
}

function generateUniversalTemplate(data, trackingEmail, emailId) {
  // 1. Generate the Details Box (Date, Time, Venue)
  let detailBox = '';
  
  // Check if we have any detail data to show
  const hasDetails = data.date || data.time || data.venue;
  
  if (data.type === "appointment") {
    // Appointment/Designation box - shows position transition
    const oldPos = data.oldPosition || "N/A";
    const newPos = data.headline || "New Position";
    detailBox = `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%); border-left:4px solid #16A34A; border-radius:8px; margin:24px 0;">
        <tr>
          <td style="padding: 24px;">
            <p style="color:#166534; margin:0 0 16px 0; font-size:12px; text-transform:uppercase; letter-spacing:1px; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:600; text-align:center;">Position Designation</p>
            <table width="100%" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td width="45%" align="center" style="padding: 12px;">
                  <p style="color:#6B7280; margin:0 0 4px 0; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif;">From</p>
                  <p style="font-size:16px; font-weight:600; margin:0; color:#374151; font-family:'Inter', 'Segoe UI', sans-serif;">${oldPos}</p>
                </td>
                <td width="10%" align="center" style="padding: 12px;">
                  <span style="font-size:24px; color:#16A34A;">&#8594;</span>
                </td>
                <td width="45%" align="center" style="padding: 12px;">
                  <p style="color:#6B7280; margin:0 0 4px 0; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif;">To</p>
                  <p style="font-size:16px; font-weight:700; margin:0; color:#16A34A; font-family:'Inter', 'Segoe UI', sans-serif;">${newPos}</p>
                </td>
              </tr>
            </table>
            ${data.date ? `<p style="color:#166534; margin:16px 0 0 0; font-size:13px; font-family:'Inter', 'Segoe UI', sans-serif; text-align:center;">Effective: <strong>${data.date}</strong></p>` : ''}
            ${data.venue ? `<p style="color:#166534; margin:8px 0 0 0; font-size:13px; font-family:'Inter', 'Segoe UI', sans-serif; text-align:center;">Department: <strong>${data.venue}</strong></p>` : ''}
          </td>
        </tr>
      </table>`;
  } else if (data.type === "payment") {
    // Payment box - warm orange shade
    detailBox = `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%); border-left:4px solid #EA580C; border-radius:8px; margin:24px 0;">
        <tr>
          <td align="center" style="padding: 24px;">
            <p style="color:#9A3412; margin:0 0 8px 0; font-size:12px; text-transform:uppercase; letter-spacing:1px; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:600;">Amount Due</p>
            <p style="font-size:32px; font-weight:700; margin:0; color:#7C2D12; font-family:'Inter', 'Segoe UI', sans-serif;">₱${data.amount}</p>
            ${data.date ? `<p style="color:#9A3412; margin:12px 0 0 0; font-size:13px; font-family:'Inter', 'Segoe UI', sans-serif;">Due by: <strong style="color:#7C2D12;">${data.date}</strong></p>` : ''}
          </td>
        </tr>
      </table>`;
  } else if (hasDetails) {
    // Universal detail box for event, simple, urgent types - only show if there's data
    detailBox = `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FFF8F5; border-left: 4px solid #F26522; border-radius: 8px; margin: 24px 0;">
        <tr>
          <td style="padding: 20px;">
            <table width="100%" border="0" cellpadding="6" cellspacing="0">
              ${data.date ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">📅 DATE</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.date}</td>
              </tr>` : ''}
              ${data.time ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">🕐 TIME</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.time}</td>
              </tr>` : ''}
              ${data.venue ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">📍 VENUE</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.venue}</td>
              </tr>` : ''}
            </table>
          </td>
        </tr>
      </table>`;
  }

  // 2. Generate the Buttons (Per-Template RSVP)
  let buttonsHtml = '';
  
  // Template-specific RSVP buttons
  if (data.sheetName === "Event_Invites") {
    // Event Invites: Confirm Attendance / Decline
    const subYes = encodeURIComponent(`RSVP CONFIRM: ${data.headline}`);
    const bodyYes = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI am writing to formally confirm my attendance for "${data.headline}".\n\nI have taken note of the schedule and venue. See you there!\n\nBest regards,\n${data.name}`);
    const linkYes = `mailto:${trackingEmail}?subject=${subYes}&body=${bodyYes}`;

    const subNo = encodeURIComponent(`RSVP DECLINE: ${data.headline}`);
    const bodyNo = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nThank you for the invitation to "${data.headline}".\n\nRegrettably, I will not be able to attend.\n\nReason: [PLEASE TYPE YOUR REASON HERE]\n\nThank you for understanding.\n\nSincerely,\n${data.name}`);
    const linkNo = `mailto:${trackingEmail}?subject=${subNo}&body=${bodyNo}`;

    if (data.registrationLink) {
      buttonsHtml = generateTripleButtons(linkYes, "Confirm Attendance", linkNo, "Decline", data.registrationLink, "Register Now");
    } else {
      buttonsHtml = generateDualMailtoButtons(linkYes, "Confirm Attendance", linkNo, "Decline");
    }
    
  } else if (data.sheetName === "Appointments" || data.type === "appointment") {
    // Appointments: Accept Designation / Decline Appointment
    const oldPos = data.oldPosition || "current position";
    const newPos = data.headline || "new position";
    
    const subYes = encodeURIComponent(`DESIGNATION ACCEPTED: ${newPos}`);
    const bodyYes = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI am honored to formally accept my designation as "${newPos}".\n\nI am committed to fulfilling this role with dedication and excellence. Thank you for your trust and confidence.\n\nBest regards,\n${data.name}`);
    const linkYes = `mailto:${trackingEmail}?subject=${subYes}&body=${bodyYes}`;

    const subNo = encodeURIComponent(`DESIGNATION DECLINED: ${newPos}`);
    const bodyNo = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nThank you for considering me for the position of "${newPos}".\n\nAfter careful consideration, I must respectfully decline this appointment.\n\nReason: [PLEASE TYPE YOUR REASON HERE]\n\nI remain committed to supporting the organization in my ${oldPos} capacity.\n\nSincerely,\n${data.name}`);
    const linkNo = `mailto:${trackingEmail}?subject=${subNo}&body=${bodyNo}`;

    buttonsHtml = generateDualMailtoButtons(linkYes, "Accept Designation", linkNo, "Decline Appointment");
    
  } else if (data.sheetName === "Volunteer_Call") {
    // Volunteer Call: I'm In! / Can't Make It
    const subYes = encodeURIComponent(`VOLUNTEER CONFIRMED: ${data.headline}`);
    const bodyYes = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nCount me in! I am excited to volunteer for "${data.headline}".\n\nI am ready to contribute and make a difference. Looking forward to it!\n\nBest regards,\n${data.name}`);
    const linkYes = `mailto:${trackingEmail}?subject=${subYes}&body=${bodyYes}`;

    const subNo = encodeURIComponent(`VOLUNTEER UNAVAILABLE: ${data.headline}`);
    const bodyNo = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nThank you for the opportunity to volunteer for "${data.headline}".\n\nUnfortunately, I won't be able to participate this time.\n\nReason: [PLEASE TYPE YOUR REASON HERE]\n\nPlease keep me in mind for future volunteer opportunities!\n\nBest regards,\n${data.name}`);
    const linkNo = `mailto:${trackingEmail}?subject=${subNo}&body=${bodyNo}`;

    buttonsHtml = generateDualMailtoButtons(linkYes, "I'm In!", linkNo, "Can't Make It");
    
  } else if (data.sheetName === "Payment_Reminders") {
    // Payment Reminders: I Have Paid (mailto) + Pay Now (external link)
    const subPaid = encodeURIComponent(`PAYMENT CONFIRMATION: ${data.headline}`);
    const bodyPaid = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI am writing to confirm that I have completed my payment for "${data.headline}".\n\nPayment Details:\n- Amount: P${data.amount}\n- Date Paid: [DATE OF PAYMENT]\n- Reference/Receipt #: [REFERENCE NUMBER]\n\nPlease let me know if you need any additional information.\n\nBest regards,\n${data.name}`);
    const linkPaid = `mailto:${trackingEmail}?subject=${subPaid}&body=${bodyPaid}`;

    buttonsHtml = generateDualButtons(linkPaid, "I Have Paid", data.link, "Pay Now");
    
  } else if (data.sheetName === "Membership_Renewal") {
    // Membership Renewal: Fill Renewal Form (external) + Contact Us (mailto)
    const subContact = encodeURIComponent(`MEMBERSHIP INQUIRY: ${data.headline}`);
    const bodyContact = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI have a question regarding my membership renewal for "${data.headline}".\n\n[TYPE YOUR QUESTION HERE]\n\nThank you!\n\nBest regards,\n${data.name}`);
    const linkContact = `mailto:${trackingEmail}?subject=${subContact}&body=${bodyContact}`;

    // Primary button is the form link, secondary is contact
    const formLink = formatActionLink(data.link);
    buttonsHtml = `
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 28px;">
      <tr>
        <td align="center">
          <a href="${formLink}" target="_blank" style="background-color:#F26522; color:#ffffff; padding:14px 28px; text-decoration:none; border-radius:8px; font-weight:600; font-size:14px; display:inline-block; margin: 8px; border: none; font-family:'Inter', 'Segoe UI', sans-serif; white-space: nowrap; box-shadow: 0 2px 8px rgba(242, 101, 34, 0.3);">
            Renew My Membership
          </a>
          <a href="${linkContact}" style="background-color:#ffffff; color:#F26522; padding:14px 28px; text-decoration:none; border-radius:8px; font-weight:600; font-size:14px; display:inline-block; margin: 8px; border: 2px solid #F26522; font-family:'Inter', 'Segoe UI', sans-serif; white-space: nowrap;">
            Contact Us
          </a>
        </td>
      </tr>
    </table>`;
    
  } else if (data.sheetName === "Doc_Acknowledgment") {
    // Doc Acknowledgment: I Acknowledge (mailto) + View Document (external link)
    const subAck = encodeURIComponent(`DOCUMENT ACKNOWLEDGED: ${data.headline}`);
    const bodyAck = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI hereby acknowledge receipt and understanding of "${data.headline}".\n\nI have read and understood the contents of this document.\n\nBest regards,\n${data.name}`);
    const linkAck = `mailto:${trackingEmail}?subject=${subAck}&body=${bodyAck}`;

    buttonsHtml = generateDualButtons(linkAck, "I Acknowledge", data.link, "View Document");
    
  } else if (data.sheetName === "Emergency_Alert") {
    // Emergency Alert: I Am Safe (mailto) + More Info (external link)
    const subSafe = encodeURIComponent(`SAFETY CHECK-IN: ${data.headline}`);
    const bodySafe = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI am confirming that I am safe following the "${data.headline}" alert.\n\nCurrent Status: [SAFE / NEED ASSISTANCE]\nLocation: [YOUR CURRENT LOCATION]\n\nBest regards,\n${data.name}`);
    const linkSafe = `mailto:${trackingEmail}?subject=${subSafe}&body=${bodySafe}`;

    buttonsHtml = generateDualButtons(linkSafe, "I Am Safe", data.link, "More Info");
    
  } else {
    // Default: Single button with external link (auto-detect format)
    let link = formatActionLink(data.link);
    buttonsHtml = `
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 28px;">
        <tr>
          <td align="center">
            <a href="${link}" style="background-color:#F26522; color:#ffffff; padding:16px 36px; text-decoration:none; border-radius:8px; font-weight:600; font-size:15px; display:inline-block; font-family:'Inter', 'Segoe UI', sans-serif; box-shadow: 0 2px 8px rgba(242, 101, 34, 0.3);">
              ${data.btnText}
            </a>
          </td>
        </tr>
      </table>`;
  }

  // 3. Return the Full HTML (Responsive Wrapper)
  return `<!DOCTYPE html>
  <html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="x-apple-disable-message-reformatting">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <!--[if mso]>
    <noscript>
      <xml>
        <o:OfficeDocumentSettings>
          <o:PixelsPerInch>96</o:PixelsPerInch>
        </o:OfficeDocumentSettings>
      </xml>
    </noscript>
    <![endif]-->
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
      
      * { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
      
      body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
      table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
      img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
      
      @media only screen and (max-width: 620px) {
        .main-table { width: 100% !important; }
        .mobile-pad { padding: 24px 20px !important; }
        .mobile-header { padding: 32px 20px 16px 20px !important; }
        .headline { font-size: 22px !important; }
        .btn-stack { display: block !important; width: 100% !important; margin: 8px 0 !important; }
      }
    </style>
  </head>
  <body style="background-color:#f8fafc; font-family:'Inter', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif; color:#1a1a1a; margin:0; padding:0; -webkit-font-smoothing:antialiased;">
    
    <!-- Preview Text (Hidden) -->
    <div style="display:none;font-size:1px;color:#f8fafc;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
      ${data.headline} — ${data.message.substring(0, 80)}...
    </div>
    
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;">
      <tr>
        <td align="center" style="padding: 32px 16px;">
          
          <!-- Main Card -->
          <table role="presentation" class="main-table" width="100%" align="center" style="max-width:580px; background-color:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.06);">
            
            <!-- Orange Top Bar -->
            <tr>
              <td style="background: linear-gradient(90deg, #F26522 0%, #ff8a50 100%); height:6px;"></td>
            </tr>
            
            <!-- Header with Logo -->
            <tr>
              <td class="mobile-header" align="center" style="padding:40px 40px 24px 40px; background-color:#ffffff;">
                <img src="${LOGO_URL}" width="80" height="80" alt="YSP Logo" style="display:block; margin-bottom: 20px; border:0; border-radius:12px;">
                <h2 style="font-family:'Inter', 'Segoe UI', sans-serif; color:#F26522; margin:0; font-size:18px; font-weight:700; letter-spacing:0.5px; text-transform:uppercase;">
                  ${EMAIL_SYSTEM_ORG_BRANDING.orgName}
                </h2>
                <p style="font-family:'Inter', 'Segoe UI', sans-serif; color:#64748b; margin:6px 0 0 0; font-size:13px; font-weight:500; letter-spacing:0.5px;">
                  ${EMAIL_SYSTEM_ORG_BRANDING.chapterName}
                </p>
              </td>
            </tr>
            
            <!-- Divider -->
            <tr>
              <td style="padding:0 40px;">
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tr><td style="border-top:1px solid #e2e8f0;"></td></tr>
                </table>
              </td>
            </tr>

            <!-- Headline -->
            <tr>
              <td align="center" style="padding: 28px 40px 0 40px;">
                <h1 class="headline" style="color:#0f172a; margin:0; font-size:26px; font-weight:700; font-family:'Inter', 'Segoe UI', sans-serif; text-align:center; line-height:1.3;">
                  ${data.headline}
                </h1>
              </td>
            </tr>

            <!-- Body Content -->
            <tr>
              <td class="mobile-pad" style="padding:28px 40px 32px 40px;">
                <p style="font-size:16px; line-height:1.7; margin:0 0 16px 0; color:#334155; font-family:'Inter', 'Segoe UI', sans-serif;">
                  Dear <strong style="color:#0f172a;">${data.name}</strong>,
                </p>
                <p style="font-size:16px; line-height:1.7; margin:0; color:#334155; font-family:'Inter', 'Segoe UI', sans-serif; text-align:justify;">
                  ${data.message.replace(/\n/g, '<br>')}
                </p>
                
                ${detailBox}
                ${buttonsHtml}

              </td>
            </tr>

            <!-- Footer Section -->
            <tr>
              <td style="padding:0 40px;">
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tr><td style="border-top:1px solid #e2e8f0;"></td></tr>
                </table>
              </td>
            </tr>
            
            <tr>
              <td class="mobile-pad" style="padding: 28px 40px 36px 40px;">
                <!-- Signature Block -->
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td>
                      <p style="margin:0 0 4px 0; font-size:13px; color:#64748b; font-family:'Inter', 'Segoe UI', sans-serif;">Warm regards,</p>
                      <p style="font-weight:700; margin:0; font-size:17px; color:#0f172a; font-family:'Inter', 'Segoe UI', sans-serif;">${FOOTER_NAME}</p>
                      <p style="color:#F26522; font-size:13px; margin:4px 0 0 0; font-weight:600; font-family:'Inter', 'Segoe UI', sans-serif;">${FOOTER_POSITION}</p>
                      <p style="color:#64748b; font-size:13px; margin:2px 0 0 0; font-family:'Inter', 'Segoe UI', sans-serif;">${FOOTER_ORG}</p>
                    </td>
                  </tr>
                </table>
                
                <!-- Motto -->
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top:28px;">
                  <tr>
                    <td align="center" style="background-color:#fef7f4; border-radius:8px; padding:16px;">
                      <p style="color:#F26522; font-style:italic; font-size:13px; margin:0; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">
                        "${GLOBAL_MOTTO}"
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            
          </table>
          
          <!-- Footer Links -->
          <table role="presentation" width="100%" align="center" style="max-width:580px; margin-top:24px;">
            <tr>
              <td align="center" style="padding-bottom:12px;">
                <p style="color:#64748b; font-size:12px; font-family:'Inter', 'Segoe UI', sans-serif; margin:0;">
                  <a href="${FB_PAGE_URL}" target="_blank" style="color:#F26522; text-decoration:none; font-weight:600;">Facebook</a>
                  &nbsp;&nbsp;|&nbsp;&nbsp;
                  <a href="${WEB_PORTAL_URL}" target="_blank" style="color:#F26522; text-decoration:none; font-weight:600;">WebPortal</a>
                </p>
              </td>
            </tr>
            <tr>
              <td align="center">
                <p style="color:#94a3b8; font-size:12px; font-family:'Inter', 'Segoe UI', sans-serif; margin:0 0 8px 0;">
                  © ${new Date().getFullYear()} ${EMAIL_SYSTEM_ORG_BRANDING.orgName} — ${EMAIL_SYSTEM_ORG_BRANDING.chapterName}
                </p>
                <p style="color:#94a3b8; font-size:11px; font-family:'Inter', 'Segoe UI', sans-serif; margin:0 0 8px 0;">
                  This email was sent to ${data.email}
                </p>
                <p style="color:#cbd5e1; font-size:10px; font-family:'Inter', 'Segoe UI', sans-serif; margin:0; letter-spacing:1px;">
                  Reference: <strong style="color:#94a3b8;">${emailId}</strong>
                </p>
              </td>
            </tr>
          </table>

        </td>
      </tr>
    </table>
  </body>
  </html>`;
}

// --- SETUP & UTILS ---

function setupEmailSystem() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  for (let sName in SHEET_LAYOUTS) {
    let s = ss.getSheetByName(sName);
    const fullHeaders = SHEET_LAYOUTS[sName].headers.concat(["Status", "Response", "Unique Tracking Email", "Email ID"]);
    
    if (!s) {
      // Sheet doesn't exist - create it fresh
      s = ss.insertSheet(sName);
      s.getRange(1, 1, 1, fullHeaders.length).setValues([fullHeaders]).setFontWeight("bold").setBackground("#F26522").setFontColor("white");
    } else {
      // Sheet exists - only add missing columns (don't overwrite existing data)
      const existingHeaders = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0];
      const missingHeaders = fullHeaders.filter(h => !existingHeaders.includes(h));
      
      if (missingHeaders.length > 0) {
        const startCol = s.getLastColumn() + 1;
        s.getRange(1, startCol, 1, missingHeaders.length)
          .setValues([missingHeaders])
          .setFontWeight("bold")
          .setBackground("#F26522")
          .setFontColor("white");
        SpreadsheetApp.getActiveSpreadsheet().toast(`Added columns: ${missingHeaders.join(", ")}`, "📝 " + sName);
      }
    }
    s.setColumnWidth(2, 200);
  }
  logToMaster("System", "N/A", "Setup", Utilities.formatDate(new Date(), TIMEZONE, "MMM dd, yyyy h:mm a"), "YSPTC-SY-" + Utilities.formatDate(new Date(), TIMEZONE, "yy") + "-000", "System Initialization");
  SpreadsheetApp.getUi().alert("✅ System Ready!\n\nNew columns added to existing sheets (data preserved).\nNew sheets created where missing.");
}

/**
 * SAFE TARGETED MIGRATION:
 * Inserts the new "Registration Link" column into Event_Invites
 * between "RSVP Link" and "Attachments" without rewriting existing row data.
 *
 * This is safer than full-schema reorder for this specific change because
 * the Event_Invites sheet commonly has data validation on the response/status area.
 */
function migrateEventInvitesRegistrationLinkOnly() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const sheet = ss.getSheetByName("Event_Invites");

  if (!sheet) {
    ui.alert("Event_Invites sheet not found.");
    return;
  }

  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) {
    ui.alert("Event_Invites is empty. Run setupEmailSystem() instead.");
    return;
  }

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  const registrationIdx = headers.indexOf("Registration Link");
  const attachmentsIdx = headers.indexOf("Attachments");
  const rsvpIdx = headers.indexOf("RSVP Link");

  if (registrationIdx !== -1) {
    ui.alert('"Registration Link" already exists in Event_Invites.');
    return;
  }

  if (rsvpIdx === -1 || attachmentsIdx === -1) {
    ui.alert('Expected headers not found. "RSVP Link" and/or "Attachments" is missing.');
    return;
  }

  if (attachmentsIdx !== rsvpIdx + 1) {
    ui.alert('Event_Invites header order is not in the expected old format.\n\nUse Preview Migration first, then inspect the sheet before running a full migration.');
    return;
  }

  const insertAt = attachmentsIdx + 1; // 1-based position of current "Attachments" column
  sheet.insertColumnBefore(insertAt);
  sheet.getRange(1, insertAt).setValue("Registration Link");

  // Match the standard header styling for the inserted header cell.
  sheet.getRange(1, insertAt)
    .setFontWeight("bold")
    .setBackground("#F26522")
    .setFontColor("white");

  ui.alert('Event_Invites updated successfully.\n\nInserted "Registration Link" before "Attachments" and shifted existing data safely to the right.');
}

/**
 * MIGRATION FUNCTION: Safely migrate sheet headers and reorder columns to match SHEET_LAYOUTS
 * - Checks current headers vs expected headers
 * - Adds missing columns in correct positions
 * - Reorders columns to match expected layout
 * - Preserves ALL existing data
 * - Handles header renames via HEADER_RENAMES mapping
 * 
 * Run this manually from Script Editor when schema changes occur.
 */
function migrateEmailSystemSchema() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  
  // Define sheet-specific header renames here (old -> new)
  // Only applies renames to the specific sheet they belong to
  const SHEET_SPECIFIC_RENAMES = {
    // Appointments sheet migration
    "Appointments": {
      "Interview Date": "Effective Date",
      "Interview Time": "Old Position",
      "Interview Location": "Department/Committee",
      "Position Applied": "New Position",
    },
    // Membership_Renewal migration (payment -> form-based)
    // Note: "Renewal Fee" column will be kept as extra (can delete manually)
    "Membership_Renewal": {
      "Payment Link": "Renewal Form Link",
      "Benefits Link": "Renewal Form Link",
      "Due Date": "Deadline",
    }
  };
  
  const report = [];
  let totalChanges = 0;
  
  for (let sheetName in SHEET_LAYOUTS) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      report.push(`[${sheetName}] Sheet not found - will be created on next setup`);
      continue;
    }
    
    // Get sheet-specific renames (or empty object if none)
    const HEADER_RENAMES = SHEET_SPECIFIC_RENAMES[sheetName] || {};
    
    const layout = SHEET_LAYOUTS[sheetName];
    const expectedHeaders = layout.headers.concat(["Status", "Response", "Unique Tracking Email", "Email ID"]);
    
    // Get current state
    const lastCol = sheet.getLastColumn();
    const lastRow = sheet.getLastRow();
    
    if (lastCol === 0) {
      // Empty sheet - just write headers
      sheet.getRange(1, 1, 1, expectedHeaders.length)
        .setValues([expectedHeaders])
        .setFontWeight("bold")
        .setBackground("#F26522")
        .setFontColor("white");
      report.push(`[${sheetName}] Empty sheet - headers initialized`);
      totalChanges++;
      continue;
    }
    
    const currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    
    // Apply header renames first (update header row only)
    let headersChanged = false;
    const renamedHeaders = currentHeaders.map(h => {
      if (HEADER_RENAMES[h]) {
        headersChanged = true;
        return HEADER_RENAMES[h];
      }
      return h;
    });
    
    if (headersChanged) {
      sheet.getRange(1, 1, 1, renamedHeaders.length).setValues([renamedHeaders]);
      report.push(`[${sheetName}] Renamed headers: ${Object.keys(HEADER_RENAMES).filter(k => currentHeaders.includes(k)).join(", ")}`);
      totalChanges++;
    }
    
    // Now check for missing and extra columns
    const currentSet = new Set(renamedHeaders);
    const expectedSet = new Set(expectedHeaders);
    
    const missingHeaders = expectedHeaders.filter(h => !currentSet.has(h));
    const extraHeaders = renamedHeaders.filter(h => !expectedSet.has(h));
    
    // Add missing columns at the end first
    if (missingHeaders.length > 0) {
      const startCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, startCol, 1, missingHeaders.length)
        .setValues([missingHeaders])
        .setFontWeight("bold")
        .setBackground("#F26522")
        .setFontColor("white");
      report.push(`[${sheetName}] Added missing columns: ${missingHeaders.join(", ")}`);
      totalChanges++;
    }
    
    // Check if reordering is needed
    const finalHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const needsReorder = !expectedHeaders.every((h, i) => finalHeaders[i] === h);
    
    if (needsReorder && lastRow > 1) {
      // Reorder columns to match expected layout
      // Get all data including headers
      const allData = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
      const headerRow = allData[0];
      
      // Create column index mapping: expected position -> current position
      const colMapping = {};
      expectedHeaders.forEach((expectedHeader, newIndex) => {
        const currentIndex = headerRow.indexOf(expectedHeader);
        if (currentIndex !== -1) {
          colMapping[newIndex] = currentIndex;
        }
      });
      
      // Reorder all rows based on mapping
      const reorderedData = allData.map(row => {
        const newRow = [];
        expectedHeaders.forEach((_, newIndex) => {
          const oldIndex = colMapping[newIndex];
          newRow.push(oldIndex !== undefined ? row[oldIndex] : "");
        });
        return newRow;
      });
      
      // Clear content and data validation so reordered writes do not fail on old dropdown rules.
      sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).clearDataValidations();
      sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).clearContent();
      sheet.getRange(1, 1, reorderedData.length, expectedHeaders.length).setValues(reorderedData);
      
      // Reapply header formatting
      sheet.getRange(1, 1, 1, expectedHeaders.length)
        .setFontWeight("bold")
        .setBackground("#F26522")
        .setFontColor("white");
      
      report.push(`[${sheetName}] Columns reordered to match schema`);
      totalChanges++;
    }
    
    // Log extra columns (kept but noted)
    if (extraHeaders.length > 0) {
      report.push(`[${sheetName}] Note: Extra columns preserved: ${extraHeaders.join(", ")}`);
    }
    
    // Verify final state
    const verifyHeaders = sheet.getRange(1, 1, 1, expectedHeaders.length).getValues()[0];
    const isCorrect = expectedHeaders.every((h, i) => verifyHeaders[i] === h);
    if (isCorrect) {
      report.push(`[${sheetName}] Schema verified OK`);
    }
  }
  
  // Show summary
  const summary = `MIGRATION COMPLETE\n\nTotal changes: ${totalChanges}\n\n${report.join("\n")}`;
  Logger.log(summary);
  ui.alert("Migration Report", summary, ui.ButtonSet.OK);
  
  return { changes: totalChanges, report: report };
}

/**
 * DRY-RUN VERSION: Check what changes would be made without applying them
 * Run this first to preview migration impact
 */
function previewMigration() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  
  // Define sheet-specific header renames
  const SHEET_SPECIFIC_RENAMES = {
    "Appointments": {
      "Interview Date": "Effective Date",
      "Interview Time": "Old Position",
      "Interview Location": "Department/Committee",
      "Position Applied": "New Position",
    },
    // Note: "Renewal Fee" will be kept as extra column
    "Membership_Renewal": {
      "Payment Link": "Renewal Form Link",
      "Benefits Link": "Renewal Form Link",
      "Due Date": "Deadline",
    }
  };
  
  const report = [];
  
  for (let sheetName in SHEET_LAYOUTS) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      report.push(`[${sheetName}] WILL CREATE: New sheet`);
      continue;
    }
    
    // Get sheet-specific renames
    const HEADER_RENAMES = SHEET_SPECIFIC_RENAMES[sheetName] || {};
    
    const layout = SHEET_LAYOUTS[sheetName];
    const expectedHeaders = layout.headers.concat(["Status", "Response", "Unique Tracking Email", "Email ID"]);
    
    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) {
      report.push(`[${sheetName}] WILL INIT: Headers (empty sheet)`);
      continue;
    }
    
    const currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    
    // Check for renames
    const renamesNeeded = Object.keys(HEADER_RENAMES).filter(k => currentHeaders.includes(k));
    if (renamesNeeded.length > 0) {
      report.push(`[${sheetName}] WILL RENAME: ${renamesNeeded.map(k => k + " -> " + HEADER_RENAMES[k]).join(", ")}`);
    }
    
    // Apply theoretical renames for further checks
    const theoreticalHeaders = currentHeaders.map(h => HEADER_RENAMES[h] || h);
    
    // Check missing
    const missingHeaders = expectedHeaders.filter(h => !theoreticalHeaders.includes(h));
    if (missingHeaders.length > 0) {
      report.push(`[${sheetName}] WILL ADD: ${missingHeaders.join(", ")}`);
    }
    
    // Check order
    const theoreticalSet = new Set(theoreticalHeaders);
    const matchingExpected = expectedHeaders.filter(h => theoreticalSet.has(h));
    const currentOrder = theoreticalHeaders.filter(h => expectedHeaders.includes(h));
    const needsReorder = !matchingExpected.every((h, i) => currentOrder[i] === h);
    
    if (needsReorder) {
      report.push(`[${sheetName}] WILL REORDER: Columns to match schema`);
    }
    
    // Check extra
    const extraHeaders = theoreticalHeaders.filter(h => !expectedHeaders.includes(h));
    if (extraHeaders.length > 0) {
      report.push(`[${sheetName}] WILL KEEP (extra): ${extraHeaders.join(", ")}`);
    }
    
    if (renamesNeeded.length === 0 && missingHeaders.length === 0 && !needsReorder) {
      report.push(`[${sheetName}] NO CHANGES NEEDED`);
    }
  }
  
  const summary = `MIGRATION PREVIEW (Dry Run)\n\nNo changes applied. Review below:\n\n${report.join("\n")}`;
  Logger.log(summary);
  ui.alert("Migration Preview", summary, ui.ButtonSet.OK);
  
  return report;
}

function getAttachments(l) {
  if(!l) return [];
  return l.split(",").map(u => {
    try { 
      const id = (u.match(/[-\w]{25,}/) || [])[0];
      return id ? DriveApp.getFileById(id).getBlob() : null;
    } catch(e) { return null; }
  }).filter(b => b);
}

function formatDate(d) { return (d instanceof Date) ? Utilities.formatDate(d, TIMEZONE, "MMM dd, yyyy") : d; }

function formatTime(d) { 
  // If it's a Date object, format directly
  if (d instanceof Date) {
    return Utilities.formatDate(d, TIMEZONE, "h:mm a");
  }
  
  // If it's a string, try to parse and convert to 12-hour format
  if (typeof d === "string" && d.trim()) {
    const timeStr = d.trim();
    
    // Match 24-hour format: "14:00", "08:30", "23:45"
    const match24 = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (match24) {
      let hours = parseInt(match24[1]);
      const mins = match24[2];
      const period = hours >= 12 ? "PM" : "AM";
      hours = hours % 12 || 12; // Convert 0 to 12, 13-23 to 1-11
      return `${hours}:${mins} ${period}`;
    }
    
    // Already in 12-hour format or other text - return as-is
    return timeStr;
  }
  
  return d;
}
function checkEmailQuota() {
  const q = MailApp.getRemainingDailyQuota();
  SpreadsheetApp.getActive().toast(`Quota: ${q} remaining`, "📊 TRACKER");
  return q;
}

function populateDetailedInstructions() {
  const sheet = SpreadsheetApp.getActive().getSheetByName("System_Instructions");
  if (!sheet) return;
  const data = [
    ["1. FILL DATA", "Fill the row info. Do NOT touch 'Status' yet.", "Required", ""],
    ["2. TYPE SEND", "Type 'Send' in the Status column to trigger the email.", "Automated", ""],
    ["3. CONFIRMATION", "Clicking 'Confirm' in the email sends a reply back to your unique tag.", "Response Track", ""]
  ];
  sheet.getRange(2,1,data.length,4).setValues(data);
}

function populateTestData() {
  const testEmail = "ezequieljohncrisostomo20@gmail.com";
  const testUrl = "https://drive.google.com/file/d/1GpWii7lwZ5D0QHl0QU1PmrmG7MJIdnty/view?usp=sharing";
  const s = SpreadsheetApp.getActive().getSheetByName("Event_Invites");
  if(s) s.getRange(2,1,1,10).setValues([["Test User", testEmail, "General Assembly", "Testing the new mailto button logic.", "Jan 30", "1 PM", "Tagum Hall", "https://google.com", "https://forms.gle/example", testUrl]]);
}

// Wrapper Batch Functions
function sendEventInvites() { processBatch("Event_Invites"); }
function sendAppointments() { processBatch("Appointments"); }
function sendPaymentReminders() { processBatch("Payment_Reminders"); }
function sendGeneralNotices() { processBatch("General_Notices"); }
function sendDocAck() { processBatch("Doc_Acknowledgment"); }
function sendVolunteerCall() { processBatch("Volunteer_Call"); }
function sendFeedbackReq() { processBatch("Feedback_Request"); }
function sendMembershipRenewal() { processBatch("Membership_Renewal"); }
function sendResourceShare() { processBatch("Resource_Share"); }
function sendEmergencyAlert() { processBatch("Emergency_Alert"); }

function processBatch(name) {
  const s = SpreadsheetApp.getActive().getSheetByName(name);
  const config = SHEET_LAYOUTS[name];
  const last = s.getLastRow();
  const statusIdx = config.headers.length + 1;
  for(let i=2; i<=last; i++) {
    const val = s.getRange(i, statusIdx).getValue();
    if(!String(val).startsWith("Sent")) sendSingleRow(s, i, config, statusIdx);
  }
}

/**
 * --- CRITICAL AUTOMATION SWITCH ---
 * RUN THIS FUNCTION ONCE TO TURN ON THE "TYPE SEND" FEATURE
 */
function installTrigger() {
  const ss = SpreadsheetApp.getActive();
  ScriptApp.newTrigger('handleEdit')
    .forSpreadsheet(ss)
    .onEdit()
    .create();
  
  SpreadsheetApp.getUi().alert("✅ Automation Trigger Installed! You can now type 'Send' to email.");
}

/**
 * Generates an iCalendar (.ics) file with 2 reminders.
 * Fixes timezone issues by using "Floating Time" (Local script time).
 */
function createIcsBlob(title, dateObj, timeObj, venue, description) {
  try {
    // 1. Combine Date and Time columns into one specific Date Object
    let eventStart = new Date(dateObj);
    if (timeObj instanceof Date) {
      eventStart.setHours(timeObj.getHours());
      eventStart.setMinutes(timeObj.getMinutes());
    } else {
      // Default to 8 AM if no time provided
      eventStart.setHours(8, 0, 0); 
    }
    
    // Set End time (Default to 2 hours later)
    let eventEnd = new Date(eventStart);
    eventEnd.setHours(eventStart.getHours() + 2);

    // 2. Format dates for ICS
    // We use "Floating Time" (no 'Z' at the end) so the event locks to the user's local time
    const formatICS_Floating = d => Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyyMMdd'T'HHmmss");
    const formatICS_Stamp = d => Utilities.formatDate(d, "GMT", "yyyyMMdd'T'HHmmss'Z'");

    const now = formatICS_Stamp(new Date());
    const start = formatICS_Floating(eventStart);
    const end = formatICS_Floating(eventEnd);

    // 3. Build the ICS Content with DUAL ALERTS
    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//" + EMAIL_SYSTEM_ORG_BRANDING.shortName + "//Email System//EN",
      "BEGIN:VEVENT",
      "UID:" + Utilities.getUuid(),
      "DTSTAMP:" + now,
      "DTSTART:" + start, // Floating time (Local)
      "DTEND:" + end,     // Floating time (Local)
      "SUMMARY:" + title,
      "DESCRIPTION:" + description,
      "LOCATION:" + venue,
      // --- ALARM 1: 1 Day Before ---
      "BEGIN:VALARM",
      "TRIGGER:-P1D",
      "DESCRIPTION:Reminder: " + title,
      "ACTION:DISPLAY",
      "END:VALARM",
      // --- ALARM 2: At Start Time ---
      "BEGIN:VALARM",
      "TRIGGER:-PT0M",
      "DESCRIPTION:Starting Now: " + title,
      "ACTION:DISPLAY",
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");

    // 4. Return as a file blob with DYNAMIC NAME
    return Utilities.newBlob(icsContent, "text/calendar", title + ".ics");

  } catch (e) {
    Logger.log("ICS Error: " + e.toString());
    return null; // Fail gracefully if date is invalid
  }
}

// =============================================================================
// WEB API HANDLERS
// =============================================================================

/**
 * Helper: Return JSON success response
 */
function jsonSuccess_(data) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: true, data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Helper: Return JSON error response
 */
function jsonError_(message, code) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: false, error: message, code: code || 500 }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Convert byte array to hex string (for HMAC signature comparison)
 */
function bytesToHex_(bytes) {
  return bytes.map(function(b) {
    return ('0' + ((b < 0 ? b + 256 : b).toString(16))).slice(-2);
  }).join('');
}

/**
 * Verify HMAC session token
 * Must match the encoding used in Loginpage_Main.gs (hex, not base64)
 */
function verifyHmacToken_(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    var secret = PropertiesService.getScriptProperties().getProperty('SESSION_SECRET_KEY');
    if (!secret) {
      Logger.log('WARNING: SESSION_SECRET_KEY not set in EmailSystem');
      return null;
    }
    var parts = token.split('.');
    if (parts.length !== 2) return null;
    var payload = parts[0];
    var signature = parts[1];
    var expectedSig = bytesToHex_(Utilities.computeHmacSha256Signature(payload, secret));
    if (signature !== expectedSig) {
      Logger.log('EmailSystem: Signature mismatch');
      return null;
    }
    var decoded = Utilities.newBlob(Utilities.base64Decode(payload)).getDataAsString();
    var fields = decoded.split('|');
    if (fields.length < 2) return null;
    var username = fields[0];
    var expiry = parseInt(fields[1], 10);
    if (isNaN(expiry) || new Date().getTime() > expiry) {
      Logger.log('EmailSystem: Token expired');
      return null;
    }
    return { username: username };
  } catch (e) {
    Logger.log('EmailSystem verifyHmacToken_ error: ' + e.toString());
    return null;
  }
}

/**
 * GET handler - health check and read operations
 */
function doGet(e) {
  var params = e && e.parameter ? e.parameter : {};
  var action = params.action || 'health';

  if (action === 'health') {
    return jsonSuccess_({ status: 'healthy', service: 'EmailSystem', timestamp: new Date().toISOString() });
  }

  // Verify token for non-health actions
  var tokenUser = verifyHmacToken_(params.sessionToken);
  if (!tokenUser) {
    return jsonError_('Invalid or expired session token', 401);
  }

  try {
    switch (action) {
      case 'getEmails':
        return jsonSuccess_(handleGetEmails_(params));
      case 'getEmailLogs':
        return jsonSuccess_(handleGetEmailLogs_(params));
      case 'checkQuota':
        return jsonSuccess_(handleCheckQuota_());
      case 'getDirectoryMembers':
        return jsonSuccess_(handleGetDirectoryMembers_());
      default:
        return jsonError_('Invalid action: ' + action, 400);
    }
  } catch (error) {
    Logger.log('EmailSystem doGet error: ' + error);
    return jsonError_('Server error: ' + (error.message || error), 500);
  }
}

/**
 * POST handler - write operations
 */
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || '{}');
    var action = body.action || '';

    // Verify token for all actions
    var tokenUser = verifyHmacToken_(body.sessionToken);
    if (!tokenUser) {
      return jsonError_('Invalid or expired session token', 401);
    }
    body.username = tokenUser.username;

    switch (action) {
      case 'addEmailRecipient':
        return jsonSuccess_(handleAddEmailRecipient_(body));
      case 'updateEmailRecipient':
        return jsonSuccess_(handleUpdateEmailRecipient_(body));
      case 'deleteEmailRecipient':
        return jsonSuccess_(handleDeleteEmailRecipient_(body));
      case 'sendEmails':
        return jsonSuccess_(handleSendEmails_(body));
      case 'batchSendAll':
        return jsonSuccess_(handleBatchSendAll_(body));
      default:
        return jsonError_('Invalid action: ' + action, 400);
    }
  } catch (error) {
    Logger.log('EmailSystem doPost error: ' + error);
    return jsonError_('Server error: ' + (error.message || error), 500);
  }
}

// =============================================================================
// API ACTION HANDLERS
// =============================================================================

function normalizeProfilePictureUrl_(rawValue) {
  var raw = String(rawValue || '').trim();
  if (!raw) return '';

  // Handle spreadsheet IMAGE("...") formulas.
  var imageFormulaMatch = raw.match(/=IMAGE\(\s*"([^"]+)"/i);
  if (imageFormulaMatch && imageFormulaMatch[1]) {
    raw = imageFormulaMatch[1].trim();
  }

  var driveMatch = raw.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  var idParamMatch = raw.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  var gusercontentMatch = raw.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]{20,})/);
  var fileId = '';

  if (driveMatch && driveMatch[1]) fileId = driveMatch[1];
  if (!fileId && idParamMatch && idParamMatch[1]) fileId = idParamMatch[1];
  if (!fileId && gusercontentMatch && gusercontentMatch[1]) fileId = gusercontentMatch[1];

  if (fileId) {
    return 'https://lh3.googleusercontent.com/d/' + fileId + '=s240';
  }

  if (raw.indexOf('http://') === 0 || raw.indexOf('https://') === 0) {
    return raw;
  }

  return '';
}

/**
 * Get directory members for batch import
 * Reads from the directory/login spreadsheet
 */
function handleGetDirectoryMembers_() {
  var directoryId = PropertiesService.getScriptProperties().getProperty('DIRECTORY_SPREADSHEET_ID') ||
                    PropertiesService.getScriptProperties().getProperty('LOGIN_SPREADSHEET_ID') || '';
  
  if (!directoryId) {
    Logger.log('WARNING: DIRECTORY_SPREADSHEET_ID not set');
    return []; // Return empty array if no directory configured
  }
  
  try {
    var ss = SpreadsheetApp.openById(directoryId);
    var sheet = ss.getSheetByName('User Profiles') || ss.getSheetByName('Directory') || ss.getSheets()[0];
    
    if (!sheet) {
      return [];
    }
    
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];
    
    var headers = data[0].map(function(h) { return String(h).toLowerCase().trim(); });
    
    // Find column indices
    var nameIdx = headers.indexOf('full name');
    if (nameIdx === -1) nameIdx = headers.indexOf('name');
    if (nameIdx === -1) nameIdx = headers.indexOf('fullname');
    
    var emailIdx = headers.indexOf('email');
    if (emailIdx === -1) emailIdx = headers.indexOf('email address');
    
    var committeeIdx = headers.indexOf('committee');
    if (committeeIdx === -1) committeeIdx = headers.indexOf('department');
    if (committeeIdx === -1) committeeIdx = headers.indexOf('team');

    var photoIdx = headers.indexOf('profile picture');
    if (photoIdx === -1) photoIdx = headers.indexOf('profile image');
    if (photoIdx === -1) photoIdx = headers.indexOf('profile photo');
    if (photoIdx === -1) photoIdx = headers.indexOf('profilepicture');
    if (photoIdx === -1) photoIdx = headers.indexOf('profilepictureurl');
    if (photoIdx === -1) photoIdx = headers.indexOf('profile pic');
    if (photoIdx === -1) photoIdx = headers.indexOf('profilepic');
    if (photoIdx === -1) photoIdx = headers.indexOf('picture url');
    if (photoIdx === -1) photoIdx = headers.indexOf('photo url');
    if (photoIdx === -1) photoIdx = headers.indexOf('image url');
    if (photoIdx === -1) photoIdx = headers.indexOf('photo');
    if (photoIdx === -1) photoIdx = headers.indexOf('avatar');
    if (photoIdx === -1) photoIdx = headers.indexOf('picture');
    
    var statusIdx = headers.indexOf('status');
    
    if (nameIdx === -1 || emailIdx === -1) {
      Logger.log('Could not find name or email columns in directory');
      return [];
    }
    
    var members = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var name = String(row[nameIdx] || '').trim();
      var email = String(row[emailIdx] || '').trim();
      var status = statusIdx !== -1 ? String(row[statusIdx] || '').toLowerCase().trim() : 'active';
      
      // Skip empty rows and inactive members
      if (!name || !email) continue;
      if (status === 'inactive' || status === 'removed' || status === 'suspended') continue;
      
      members.push({
        name: name,
        email: email,
        committee: committeeIdx !== -1 ? String(row[committeeIdx] || '').trim() : '',
        profilePicture: photoIdx !== -1 ? normalizeProfilePictureUrl_(row[photoIdx]) : ''
      });
    }
    
    return members;
  } catch (e) {
    Logger.log('Error reading directory: ' + e.toString());
    return [];
  }
}

/**
 * Get all emails for a template type
 */
function handleGetEmails_(params) {
  var templateType = params.templateType;
  if (!templateType || !SHEET_LAYOUTS[templateType]) {
    throw new Error('Invalid template type: ' + templateType);
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(templateType);
  if (!sheet) {
    throw new Error('Sheet not found: ' + templateType);
  }

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return []; // Empty or headers only

  var headers = data[0];
  var emails = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var email = {};
    email.RowIndex = i + 1; // 1-based row index

    for (var j = 0; j < headers.length; j++) {
      var header = String(headers[j]).trim();
      var value = row[j];
      
      // Handle Date objects
      if (value instanceof Date) {
        if (header === 'Date') {
          value = Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        } else if (header === 'Time') {
          value = Utilities.formatDate(value, Session.getScriptTimeZone(), 'HH:mm');
        } else {
          value = value.toISOString();
        }
      }
      
      email[header] = value || '';
    }

    // Always expose normalized fields for frontend consistency
    var map = SHEET_LAYOUTS[templateType].map || {};
    email.RecipientName = map.name !== undefined ? (row[map.name] || '') : '';
    email.Email = map.email !== undefined ? (row[map.email] || '') : '';
    email.Headline = map.headline !== undefined ? (row[map.headline] || '') : '';
    email.Message = map.msg !== undefined ? (row[map.msg] || '') : '';
    email.Date = map.date !== undefined ? (row[map.date] || '') : '';
    email.Time = map.time !== undefined ? (row[map.time] || '') : '';
    email.Venue = map.venue !== undefined ? (row[map.venue] || '') : '';
    email.Amount = map.amount !== undefined ? (row[map.amount] || '') : '';
    email.Link = map.link !== undefined ? (row[map.link] || '') : '';
    email.RegistrationLink = map.registrationLink !== undefined ? (row[map.registrationLink] || '') : '';
    email.Attachments = map.attach !== undefined ? (row[map.attach] || '') : '';
    email.Status = row[headers.length] || '';
    email.Response = row[headers.length + 1] || '';
    email.TrackingEmail = row[headers.length + 2] || '';
    email.EmailId = row[headers.length + 3] || '';

    emails.push(email);
  }

  return emails;
}

/**
 * Get email logs from MASTER_LOG
 */
function handleGetEmailLogs_(params) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('MASTER_LOG');
  if (!sheet) {
    return [];
  }

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  var logs = [];
  var limit = params.limit ? parseInt(params.limit, 10) : 100;
  var search = params.search ? String(params.search).toLowerCase() : '';
  var templateFilter = params.templateType || '';

  for (var i = data.length - 1; i >= 1 && logs.length < limit; i--) {
    var row = data[i];
    var log = {
      EmailId: row[0] || '',
      Name: row[1] || '',
      Email: row[2] || '',
      Headline: row[3] || '',
      Template: row[4] || '',
      Timestamp: row[5] instanceof Date ? row[5].toISOString() : String(row[5])
    };

    // Apply filters
    if (templateFilter && log.Template !== templateFilter) continue;
    if (search) {
      var searchStr = (log.Name + log.Email + log.Headline).toLowerCase();
      if (searchStr.indexOf(search) === -1) continue;
    }

    logs.push(log);
  }

  return logs;
}

/**
 * Check email quota
 */
function handleCheckQuota_() {
  var remaining = MailApp.getRemainingDailyQuota();
  var dailyLimit = 1500; // Google Workspace limit
  var used = dailyLimit - remaining;
  return {
    remaining: remaining,
    dailyLimit: dailyLimit,
    percentageUsed: Math.round((used / dailyLimit) * 100)
  };
}

/**
 * Add a new email recipient
 */
function handleAddEmailRecipient_(body) {
  var templateType = body.templateType;
  if (!templateType || !SHEET_LAYOUTS[templateType]) {
    throw new Error('Invalid template type: ' + templateType);
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(templateType);
  if (!sheet) {
    throw new Error('Sheet not found: ' + templateType);
  }

  var layout = SHEET_LAYOUTS[templateType];
  var headers = layout.headers;
  var map = layout.map || {};
  var newRow = [];

  for (var i = 0; i < headers.length; i++) {
    var header = headers[i];
    var value = body[header];
    if (value === undefined || value === null || value === '') {
      if (map.name === i) value = body.RecipientName || body.Name || '';
      else if (map.email === i) value = body.Email || '';
      else if (map.headline === i) value = body.Headline || '';
      else if (map.msg === i) value = body.Message || '';
      else if (map.date === i) value = body.Date || '';
      else if (map.time === i) value = body.Time || '';
      else if (map.venue === i) value = body.Venue || '';
      else if (map.amount === i) value = body.Amount || '';
      else if (map.oldPosition === i) value = body.OldPosition || '';
      else if (map.link === i) value = body.Link || '';
      else if (map.registrationLink === i) value = body.RegistrationLink || '';
      else if (map.attach === i) value = body.Attachments || '';
      else value = '';
    }
    
    // Set defaults
    if (header === 'Status' && !value) value = 'Draft';
    if (header === 'EmailId' && !value) value = Utilities.getUuid();
    
    newRow.push(value);
  }

  sheet.appendRow(newRow);
  var rowIndex = sheet.getLastRow();

  return { rowIndex: rowIndex };
}

/**
 * Update an email recipient
 */
function handleUpdateEmailRecipient_(body) {
  var templateType = body.templateType;
  var rowIndex = parseInt(body.rowIndex, 10);

  if (!templateType || !SHEET_LAYOUTS[templateType]) {
    throw new Error('Invalid template type: ' + templateType);
  }
  if (!rowIndex || rowIndex < 2) {
    throw new Error('Invalid row index');
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(templateType);
  if (!sheet) {
    throw new Error('Sheet not found: ' + templateType);
  }

  var layout = SHEET_LAYOUTS[templateType];
  var headers = layout.headers;
  var map = layout.map || {};

  // Get current row and update values
  var range = sheet.getRange(rowIndex, 1, 1, headers.length);
  var currentValues = range.getValues()[0];

  for (var i = 0; i < headers.length; i++) {
    var header = headers[i];
    var hasCanonical =
      (map.name === i && body.hasOwnProperty('RecipientName')) ||
      (map.email === i && body.hasOwnProperty('Email')) ||
      (map.headline === i && body.hasOwnProperty('Headline')) ||
      (map.msg === i && body.hasOwnProperty('Message')) ||
      (map.date === i && body.hasOwnProperty('Date')) ||
      (map.time === i && body.hasOwnProperty('Time')) ||
      (map.venue === i && body.hasOwnProperty('Venue')) ||
      (map.amount === i && body.hasOwnProperty('Amount')) ||
      (map.oldPosition === i && body.hasOwnProperty('OldPosition')) ||
      (map.link === i && body.hasOwnProperty('Link')) ||
      (map.registrationLink === i && body.hasOwnProperty('RegistrationLink')) ||
      (map.attach === i && body.hasOwnProperty('Attachments'));

    if (body.hasOwnProperty(header) && header !== 'RowIndex') {
      currentValues[i] = body[header];
    } else if (hasCanonical) {
      if (map.name === i) currentValues[i] = body.RecipientName;
      else if (map.email === i) currentValues[i] = body.Email;
      else if (map.headline === i) currentValues[i] = body.Headline;
      else if (map.msg === i) currentValues[i] = body.Message;
      else if (map.date === i) currentValues[i] = body.Date;
      else if (map.time === i) currentValues[i] = body.Time;
      else if (map.venue === i) currentValues[i] = body.Venue;
      else if (map.amount === i) currentValues[i] = body.Amount;
      else if (map.oldPosition === i) currentValues[i] = body.OldPosition;
      else if (map.link === i) currentValues[i] = body.Link;
      else if (map.registrationLink === i) currentValues[i] = body.RegistrationLink;
      else if (map.attach === i) currentValues[i] = body.Attachments;
    }
  }

  range.setValues([currentValues]);
  return { success: true };
}

/**
 * Delete an email recipient
 */
function handleDeleteEmailRecipient_(body) {
  var templateType = body.templateType;
  var rowIndex = parseInt(body.rowIndex, 10);

  if (!templateType || !SHEET_LAYOUTS[templateType]) {
    throw new Error('Invalid template type: ' + templateType);
  }
  if (!rowIndex || rowIndex < 2) {
    throw new Error('Invalid row index');
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(templateType);
  if (!sheet) {
    throw new Error('Sheet not found: ' + templateType);
  }

  sheet.deleteRow(rowIndex);
  return { success: true };
}

/**
 * Send emails based on sendMode
 */
function handleSendEmails_(body) {
  var templateType = body.templateType;
  var sendMode = body.sendMode || 'all';
  var selectedRowIndices = body.selectedRowIndices || [];

  if (!templateType || !SHEET_LAYOUTS[templateType]) {
    throw new Error('Invalid template type: ' + templateType);
  }

  var result = {
    success: true,
    sent: 0,
    failed: 0,
    skipped: 0,
    details: []
  };

  if (sendMode === 'single' && selectedRowIndices.length > 0) {
    // Send single email
    var rowIndex = selectedRowIndices[0];
    var singleResult = sendSingleRow(templateType, rowIndex);
    if (singleResult.status === 'sent') {
      result.sent = 1;
    } else if (singleResult.status === 'failed') {
      result.failed = 1;
    } else {
      result.skipped = 1;
    }
    result.details.push({
      rowIndex: rowIndex,
      email: singleResult.email || '',
      name: singleResult.name || '',
      status: singleResult.status
    });
  } else if (sendMode === 'selected' && selectedRowIndices.length > 0) {
    // Send selected emails
    for (var i = 0; i < selectedRowIndices.length; i++) {
      var idx = selectedRowIndices[i];
      var selResult = sendSingleRow(templateType, idx);
      if (selResult.status === 'sent') {
        result.sent++;
      } else if (selResult.status === 'failed') {
        result.failed++;
      } else {
        result.skipped++;
      }
      result.details.push({
        rowIndex: idx,
        email: selResult.email || '',
        name: selResult.name || '',
        status: selResult.status
      });
    }
  } else {
    // Send all with 'Send' or 'Force' status
    var batchResult = processBatch(templateType);
    result.sent = batchResult.sent || 0;
    result.failed = batchResult.errors || 0;
    result.skipped = batchResult.skipped || 0;
  }

  return result;
}

/**
 * Batch send all pending emails
 */
function handleBatchSendAll_(body) {
  var templateType = body.templateType;

  if (!templateType || !SHEET_LAYOUTS[templateType]) {
    throw new Error('Invalid template type: ' + templateType);
  }

  var batchResult = processBatch(templateType);
  
  return {
    success: true,
    sent: batchResult.sent || 0,
    failed: batchResult.errors || 0,
    skipped: batchResult.skipped || 0,
    details: []
  };
}
