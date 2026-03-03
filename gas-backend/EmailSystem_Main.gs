/**
 * ============================================================
 * YSP TAGUM CHAPTER - MASTER EMAIL SYSTEM V3.1
 * Features: Dual RSVP, Auto-Reason, Sender/Footer Split, iCal
 * ============================================================
 */

const GLOBAL_MOTTO = "Shaping the Future to a Greater Society";
const TIMEZONE = "Asia/Manila"; // Manila local time (UTC+8)
const LOGO_URL = "https://i.imgur.com/J4wddTW.png";

// --- CONFIGURATION ---
// 1. WHAT SHOWS IN THE RECIPIENT'S INBOX LIST:
const SENDER_DISPLAY_NAME = "Youth Service Philippines Tagum Chapter"; 

// 2. WHAT SHOWS AT THE BOTTOM OF THE EMAIL (THE FOOTER):
const FOOTER_NAME = "Ezequiel John B. Crisostomo";
const FOOTER_POSITION = "Membership & Internal Affairs Officer";
const FOOTER_ORG = "Youth Service Philippines — Tagum Chapter";
const FOOTER_EMAIL = "ysptagumchapter@gmail.com";
const FOOTER_WEBSITE = "https://www.youthservicephilippinestagum.me/Home";

const SHEET_LAYOUTS = {
  "Event_Invites": {
    headers: ["Recipient Name", "Email", "Event Name", "Message", "Date", "Time", "Venue", "RSVP Link", "Attachments"],
    map: { name:0, email:1, headline:2, msg:3, date:4, time:5, venue:6, link:7, attach:8 },
    btn: "Confirm Attendance",
    type: "event",
    code: "EI" // Event Invites
  },
  "Appointments": {
    headers: ["Candidate Name", "Email", "Role/Position", "Message", "Interview Date", "Interview Time", "Location/Link", "Confirm Link", "Attachments"],
    map: { name:0, email:1, headline:2, msg:3, date:4, time:5, venue:6, link:7, attach:8 },
    btn: "Accept Appointment",
    type: "event",
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
    headers: ["Member Name", "Email", "Membership Year", "Message", "Renewal Fee", "Due Date", "Payment Link", "Attachments"],
    map: { name:0, email:1, headline:2, msg:3, amount:4, date:5, link:6, attach:7 },
    btn: "Renew Membership",
    type: "payment",
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
    
    // Section 2: PDF Export (NEW ADDITION)
    .addItem('📄 EXPORT CURRENT SHEET AS PDF', 'generateCurrentSheetPDF')
    .addSeparator()
    
    // Section 3: Quota Check
    .addItem('📊 CHECK QUOTA', 'checkEmailQuota')
    .addSeparator()
    
    // Section 4: Manual Batch Sending
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
    name:     data[map.name],
    email:    data[map.email],
    headline: data[map.headline],
    message:  data[map.msg],
    date:     (map.date !== undefined) ? formatDate(data[map.date]) : "",
    time:     (map.time !== undefined) ? formatTime(data[map.time]) : "",
    venue:    (map.venue !== undefined) ? data[map.venue] : "",
    amount:   (map.amount !== undefined) ? data[map.amount] : "",
    link:     (map.link !== undefined) ? data[map.link] : "",
    attach:   (map.attach !== undefined) ? data[map.attach] : "",
    btnText:  config.btn,
    type:     config.type
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

      // 2. Generate Calendar File for Events
      if (info.type === "event" && data[map.date]) {
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
        const labelName = "YSP Tagum Email System";
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
 * YSPTC = Youth Service Philippines Tagum Chapter
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

function generateUniversalTemplate(data, trackingEmail, emailId) {
  // 1. Generate the Details Box (Date, Time, Venue)
  let detailBox = '';
  
  // Check if we have any detail data to show
  const hasDetails = data.date || data.time || data.venue;
  
  if (data.type === "payment") {
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

  // 2. Generate the Buttons (Mobile Friendly with Gaps)
  let buttonsHtml = '';
  
  if (data.type === "event") {
    // --- OPTION A: CONFIRM ---
    const subYes = encodeURIComponent(`RSVP CONFIRM: ${data.headline}`);
    const bodyYes = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI am writing to formally confirm my attendance for "${data.headline}".\n\nI have taken note of the schedule and venue. See you there!\n\nBest regards,\n${data.name}`);
    const linkYes = `mailto:${trackingEmail}?subject=${subYes}&body=${bodyYes}`;

    // --- OPTION B: DECLINE ---
    const subNo = encodeURIComponent(`RSVP DECLINE: ${data.headline}`);
    const bodyNo = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nThank you for the invitation to "${data.headline}".\n\nRegrettably, I will not be able to attend.\n\nReason: [PLEASE TYPE YOUR REASON HERE]\n\nThank you for understanding.\n\nSincerely,\n${data.name}`);
    const linkNo = `mailto:${trackingEmail}?subject=${subNo}&body=${bodyNo}`;

    buttonsHtml = `
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 28px;">
        <tr>
          <td align="center">
            <!--[if mso]>
            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${linkYes}" style="height:48px;v-text-anchor:middle;width:180px;" arcsize="10%" strokecolor="#F26522" fillcolor="#F26522">
              <w:anchorlock/>
              <center style="color:#ffffff;font-family:'Inter',sans-serif;font-size:14px;font-weight:600;">✓ Confirm Attendance</center>
            </v:roundrect>
            <![endif]-->
            <!--[if !mso]><!-->
            <a href="${linkYes}" style="background-color:#F26522; color:#ffffff; padding:14px 28px; text-decoration:none; border-radius:8px; font-weight:600; font-size:14px; display:inline-block; margin: 8px; border: none; font-family:'Inter', 'Segoe UI', sans-serif; white-space: nowrap; box-shadow: 0 2px 8px rgba(242, 101, 34, 0.3); transition: all 0.2s;">
              ✓ Confirm Attendance
            </a>
            <!--<![endif]-->
            <!--[if mso]>
            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${linkNo}" style="height:48px;v-text-anchor:middle;width:180px;" arcsize="10%" strokecolor="#F26522" fillcolor="#ffffff">
              <w:anchorlock/>
              <center style="color:#F26522;font-family:'Inter',sans-serif;font-size:14px;font-weight:600;">✗ Decline</center>
            </v:roundrect>
            <![endif]-->
            <!--[if !mso]><!-->
            <a href="${linkNo}" style="background-color:#ffffff; color:#F26522; padding:14px 28px; text-decoration:none; border-radius:8px; font-weight:600; font-size:14px; display:inline-block; margin: 8px; border: 2px solid #F26522; font-family:'Inter', 'Segoe UI', sans-serif; white-space: nowrap;">
              ✗ Decline
            </a>
            <!--<![endif]-->
          </td>
        </tr>
      </table>`;
  } else {
    // --- STANDARD BUTTON ---
    let link = data.link || "#";
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
                  Youth Service Philippines
                </h2>
                <p style="font-family:'Inter', 'Segoe UI', sans-serif; color:#64748b; margin:6px 0 0 0; font-size:13px; font-weight:500; letter-spacing:0.5px;">
                  Tagum Chapter
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
                  <a href="https://www.facebook.com/YSPTagumChapter" target="_blank" style="color:#F26522; text-decoration:none; font-weight:600;">Facebook</a>
                  &nbsp;&nbsp;|&nbsp;&nbsp;
                  <a href="https://www.youthservicephilippinestagum.me/Home" target="_blank" style="color:#F26522; text-decoration:none; font-weight:600;">WebPortal</a>
                </p>
              </td>
            </tr>
            <tr>
              <td align="center">
                <p style="color:#94a3b8; font-size:12px; font-family:'Inter', 'Segoe UI', sans-serif; margin:0 0 8px 0;">
                  © ${new Date().getFullYear()} Youth Service Philippines — Tagum Chapter
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
  if(s) s.getRange(2,1,1,9).setValues([["Test User", testEmail, "General Assembly", "Testing the new mailto button logic.", "Jan 30", "1 PM", "Tagum Hall", "https://google.com", testUrl]]);
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
      "PRODID:-//YSP Tagum//Email System//EN",
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