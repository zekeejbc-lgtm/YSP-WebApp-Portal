# Code Citations

## License: unknown
https://github.com/matthelbig/matthelbig.github.io/blob/c06879688437a0d898e0918ea0b12e31a7230163/site-old/EMMA-Entry/EMMA-email-template.html

```
I don't have file editing tools enabled. Here's the complete implementation guide file content:

```markdown
# EMAIL_SYSTEM_RSVP_OVERHAUL.md

## Email System RSVP Overhaul and Appointments Fix

This document provides complete implementation details for transforming the Email System's RSVP functionality and fixing the Appointments template. All code changes are provided for both **backend (GAS)** and **frontend (TypeScript)** to maintain consistency.

---

## Table of Contents

1. [Overview](#overview)
2. [Backend Changes (EmailSystem_Main.gs)](#backend-changes)
3. [Frontend Changes (gasEmailSystemService.ts)](#frontend-changes)
4. [Pre-Typed RSVP Email Text](#pre-typed-rsvp-email-text)
5. [Testing Checklist](#testing-checklist)

---

## Overview

### Current Issues

1. **Appointments Template**: Currently interview-focused but should be for position/designation appointments (e.g., "You've been appointed as Committee Head")
2. **Hardcoded RSVP Buttons**: All event-type templates display "Confirm Attendance" regardless of configured `btnText`
3. **Missing Old Position Field**: No way to track position transitions (FROM -> TO)
4. **Non-Event Templates**: Lack mailto RSVP buttons for response tracking

### Solution Summary

- New template type: `appointment` (separate from `event`)
- Old Position field for position transitions
- Per-template RSVP buttons with contextual pre-typed email text
- Dual-button layouts for payment and acknowledgment templates

---

## Backend Changes

### File: `gas-backend/EmailSystem_Main.gs`

---

### 1. Update SHEET_LAYOUTS - Appointments Template (Lines 37-43)

**REPLACE:**
```javascript
"Appointments": {
  headers: ["Candidate Name", "Email", "Role/Position", "Message", "Interview Date", "Interview Time", "Location/Link", "Confirm Link", "Attachments"],
  map: { name:0, email:1, headline:2, msg:3, date:4, time:5, venue:6, link:7, attach:8 },
  btn: "Accept Appointment",
  type: "event",
  code: "AP"
},
```

**WITH:**
```javascript
"Appointments": {
  headers: ["Appointee Name", "Email", "New Position", "Message", "Old Position", "Effective Date", "Department/Committee", "Reference Link", "Attachments"],
  map: { name:0, email:1, headline:2, msg:3, oldPosition:4, date:5, venue:6, link:7, attach:8 },
  btn: "Accept Designation",
  type: "appointment",
  code: "AP"
},
```

---

### 2. Update sendSingleRow() - Add sheetName and oldPosition (Lines 144-220)

**FIND the info object initialization (around line 196) and REPLACE:**

```javascript
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
```

**WITH:**

```javascript
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
  attach:      (map.attach !== undefined) ? data[map.attach] : "",
  oldPosition: (map.oldPosition !== undefined) ? data[map.oldPosition] : "",
  btnText:     config.btn,
  type:        config.type,
  sheetName:   sheet.getName()
};
```

---

### 3. Update Calendar Generation Logic (Around line 227)

**FIND:**
```javascript
// 2. Generate Calendar File for Events
if (info.type === "event" && data[map.date]) {
```

**REPLACE WITH:**
```javascript
// 2. Generate Calendar File for Events (not for appointments)
if (info.type === "event" && info.sheetName !== "Appointments" && data[map.date]) {
```

---

### 4. Update generateUniversalTemplate() - Add Appointment Detail Box (Lines 330-395)

**FIND the detailBox section and REPLACE the entire block starting from `let detailBox = '';`:**

```javascript
function generateUniversalTemplate(data, trackingEmail, emailId) {
  // 1. Generate the Details Box (Date, Time, Venue, Position Transition)
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
            <p style="font-size:32px; font-weight:700; margin:0; color:#7C2D12; font-family:'Inter', 'Segoe UI', sans-serif;">P${data.amount}</p>
            ${data.date ? `<p style="color:#9A3412; margin:12px 0 0 0; font-size:13px; font-family:'Inter', 'Segoe UI', sans-serif;">Due by: <strong style="color:#7C2D12;">${data.date}</strong></p>` : ''}
          </td>
        </tr>
      </table>`;
  } else if (hasDetails) {
    // Universal detail box for event, simple, urgent types
    detailBox = `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FFF8F5; border-left: 4px solid #F26522; border-radius: 8px; margin: 24px 0;">
        <tr>
          <td style="padding: 20px;">
            <table width="100%" border="0" cellpadding="6" cellspacing="0">
              ${data.date ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">DATE</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.date}</td>
              </tr>` : ''}
              ${data.time ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">TIME</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.time}</td>
              </tr>` : ''}
              ${data.venue ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">VENUE</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.venue}</td>
              </tr>` : ''}
            </table>
          </td>
        </tr>
      </table>`;
  }
```

---

### 5. Replace Button Generation Logic (Lines 396-450)

**REPLACE the entire buttonsHtml section with:**

```javascript
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

    buttonsHtml = generateDualMailtoButtons(linkYes, "Confirm Attendance", linkNo, "Decline");
    
  } else if (data.sheetName === "Appointments") {
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
    
  } else if (data.sheetName === "Payment_Reminders" || data.sheetName === "Membership_Renewal") {
    // Payment: I Have Paid (mailto) + Pay Now (external link)
    const subPaid = encodeURIComponent(`PAYMENT CONFIRMATION: ${data.headline}`);
    const bodyPaid = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI am writing to confirm that I have completed my payment for "${data.headline}".\n\nPayment Details:\n- Amount: P${data.amount}\n- Date Paid: [DATE OF PAYMENT]\n- Reference/Receipt #: [REFERENCE NUMBER]\n\nPlease let me know if you need any additional information.\n\nBest regards,\n${data.name}`);
    const linkPaid = `mailto:${trackingEmail}?subject=${subPaid}&body=${bodyPaid}`;

    buttonsHtml = generateDualButtons(linkPaid, "I Have Paid", data.link, data.sheetName === "Membership_Renewal" ? "Renew Now" : "Pay Now", true);
    
  } else if (data.sheetName === "Doc_Acknowledgment") {
    // Doc Acknowledgment: I Acknowledge (mailto) + View Document (external link)
    const subAck = encodeURIComponent(`DOCUMENT ACKNOWLEDGED: ${data.headline}`);
    const bodyAck = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI hereby acknowledge receipt and understanding of "${data.headline}".\n\nI have read and understood the contents of this document.\n\nBest regards,\n${data.name}`);
    const linkAck = `mailto:${trackingEmail}?subject=${subAck}&body=${bodyAck}`;

    buttonsHtml = generateDualButtons(linkAck, "I Acknowledge", data.link, "View Document", true);
    
  } else if (data.sheetName === "Emergency_Alert") {
    // Emergency Alert: I Am Safe (mailto) + More Info (external link)
    const subSafe = encodeURIComponent(`SAFETY CHECK-IN: ${data.headline}`);
    const bodySafe = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI am confirming that I am safe following the "${data.headline}" alert.\n\nCurrent Status: [SAFE / NEED ASSISTANCE]\nLocation: [YOUR CURRENT LOCATION]\n\nBest regards,\n${data.name}`);
    const linkSafe = `mailto:${trackingEmail}?subject=${subSafe}&body=${bodySafe}`;

    buttonsHtml = generateDualButtons(linkSafe, "I Am Safe", data.link, "More Info", true);
    
  } else {
    // Default: Single button with external link
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
```

---

### 6. Add Helper Functions for Button Generation (Add before generateUniversalTemplate)

```javascript
/**
 * Helper: Generate dual mailto buttons (both buttons are mailto links)
 */
function generateDualMailtoButtons(linkYes, textYes, linkNo, textNo) {
  return `
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 28px;">
      <tr>
        <td align="center">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${linkYes}" style="height:48
```


## License: unknown
https://github.com/matthelbig/matthelbig.github.io/blob/c06879688437a0d898e0918ea0b12e31a7230163/site-old/EMMA-Entry/EMMA-email-template.html

```
I don't have file editing tools enabled. Here's the complete implementation guide file content:

```markdown
# EMAIL_SYSTEM_RSVP_OVERHAUL.md

## Email System RSVP Overhaul and Appointments Fix

This document provides complete implementation details for transforming the Email System's RSVP functionality and fixing the Appointments template. All code changes are provided for both **backend (GAS)** and **frontend (TypeScript)** to maintain consistency.

---

## Table of Contents

1. [Overview](#overview)
2. [Backend Changes (EmailSystem_Main.gs)](#backend-changes)
3. [Frontend Changes (gasEmailSystemService.ts)](#frontend-changes)
4. [Pre-Typed RSVP Email Text](#pre-typed-rsvp-email-text)
5. [Testing Checklist](#testing-checklist)

---

## Overview

### Current Issues

1. **Appointments Template**: Currently interview-focused but should be for position/designation appointments (e.g., "You've been appointed as Committee Head")
2. **Hardcoded RSVP Buttons**: All event-type templates display "Confirm Attendance" regardless of configured `btnText`
3. **Missing Old Position Field**: No way to track position transitions (FROM -> TO)
4. **Non-Event Templates**: Lack mailto RSVP buttons for response tracking

### Solution Summary

- New template type: `appointment` (separate from `event`)
- Old Position field for position transitions
- Per-template RSVP buttons with contextual pre-typed email text
- Dual-button layouts for payment and acknowledgment templates

---

## Backend Changes

### File: `gas-backend/EmailSystem_Main.gs`

---

### 1. Update SHEET_LAYOUTS - Appointments Template (Lines 37-43)

**REPLACE:**
```javascript
"Appointments": {
  headers: ["Candidate Name", "Email", "Role/Position", "Message", "Interview Date", "Interview Time", "Location/Link", "Confirm Link", "Attachments"],
  map: { name:0, email:1, headline:2, msg:3, date:4, time:5, venue:6, link:7, attach:8 },
  btn: "Accept Appointment",
  type: "event",
  code: "AP"
},
```

**WITH:**
```javascript
"Appointments": {
  headers: ["Appointee Name", "Email", "New Position", "Message", "Old Position", "Effective Date", "Department/Committee", "Reference Link", "Attachments"],
  map: { name:0, email:1, headline:2, msg:3, oldPosition:4, date:5, venue:6, link:7, attach:8 },
  btn: "Accept Designation",
  type: "appointment",
  code: "AP"
},
```

---

### 2. Update sendSingleRow() - Add sheetName and oldPosition (Lines 144-220)

**FIND the info object initialization (around line 196) and REPLACE:**

```javascript
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
```

**WITH:**

```javascript
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
  attach:      (map.attach !== undefined) ? data[map.attach] : "",
  oldPosition: (map.oldPosition !== undefined) ? data[map.oldPosition] : "",
  btnText:     config.btn,
  type:        config.type,
  sheetName:   sheet.getName()
};
```

---

### 3. Update Calendar Generation Logic (Around line 227)

**FIND:**
```javascript
// 2. Generate Calendar File for Events
if (info.type === "event" && data[map.date]) {
```

**REPLACE WITH:**
```javascript
// 2. Generate Calendar File for Events (not for appointments)
if (info.type === "event" && info.sheetName !== "Appointments" && data[map.date]) {
```

---

### 4. Update generateUniversalTemplate() - Add Appointment Detail Box (Lines 330-395)

**FIND the detailBox section and REPLACE the entire block starting from `let detailBox = '';`:**

```javascript
function generateUniversalTemplate(data, trackingEmail, emailId) {
  // 1. Generate the Details Box (Date, Time, Venue, Position Transition)
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
            <p style="font-size:32px; font-weight:700; margin:0; color:#7C2D12; font-family:'Inter', 'Segoe UI', sans-serif;">P${data.amount}</p>
            ${data.date ? `<p style="color:#9A3412; margin:12px 0 0 0; font-size:13px; font-family:'Inter', 'Segoe UI', sans-serif;">Due by: <strong style="color:#7C2D12;">${data.date}</strong></p>` : ''}
          </td>
        </tr>
      </table>`;
  } else if (hasDetails) {
    // Universal detail box for event, simple, urgent types
    detailBox = `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FFF8F5; border-left: 4px solid #F26522; border-radius: 8px; margin: 24px 0;">
        <tr>
          <td style="padding: 20px;">
            <table width="100%" border="0" cellpadding="6" cellspacing="0">
              ${data.date ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">DATE</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.date}</td>
              </tr>` : ''}
              ${data.time ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">TIME</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.time}</td>
              </tr>` : ''}
              ${data.venue ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">VENUE</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.venue}</td>
              </tr>` : ''}
            </table>
          </td>
        </tr>
      </table>`;
  }
```

---

### 5. Replace Button Generation Logic (Lines 396-450)

**REPLACE the entire buttonsHtml section with:**

```javascript
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

    buttonsHtml = generateDualMailtoButtons(linkYes, "Confirm Attendance", linkNo, "Decline");
    
  } else if (data.sheetName === "Appointments") {
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
    
  } else if (data.sheetName === "Payment_Reminders" || data.sheetName === "Membership_Renewal") {
    // Payment: I Have Paid (mailto) + Pay Now (external link)
    const subPaid = encodeURIComponent(`PAYMENT CONFIRMATION: ${data.headline}`);
    const bodyPaid = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI am writing to confirm that I have completed my payment for "${data.headline}".\n\nPayment Details:\n- Amount: P${data.amount}\n- Date Paid: [DATE OF PAYMENT]\n- Reference/Receipt #: [REFERENCE NUMBER]\n\nPlease let me know if you need any additional information.\n\nBest regards,\n${data.name}`);
    const linkPaid = `mailto:${trackingEmail}?subject=${subPaid}&body=${bodyPaid}`;

    buttonsHtml = generateDualButtons(linkPaid, "I Have Paid", data.link, data.sheetName === "Membership_Renewal" ? "Renew Now" : "Pay Now", true);
    
  } else if (data.sheetName === "Doc_Acknowledgment") {
    // Doc Acknowledgment: I Acknowledge (mailto) + View Document (external link)
    const subAck = encodeURIComponent(`DOCUMENT ACKNOWLEDGED: ${data.headline}`);
    const bodyAck = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI hereby acknowledge receipt and understanding of "${data.headline}".\n\nI have read and understood the contents of this document.\n\nBest regards,\n${data.name}`);
    const linkAck = `mailto:${trackingEmail}?subject=${subAck}&body=${bodyAck}`;

    buttonsHtml = generateDualButtons(linkAck, "I Acknowledge", data.link, "View Document", true);
    
  } else if (data.sheetName === "Emergency_Alert") {
    // Emergency Alert: I Am Safe (mailto) + More Info (external link)
    const subSafe = encodeURIComponent(`SAFETY CHECK-IN: ${data.headline}`);
    const bodySafe = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI am confirming that I am safe following the "${data.headline}" alert.\n\nCurrent Status: [SAFE / NEED ASSISTANCE]\nLocation: [YOUR CURRENT LOCATION]\n\nBest regards,\n${data.name}`);
    const linkSafe = `mailto:${trackingEmail}?subject=${subSafe}&body=${bodySafe}`;

    buttonsHtml = generateDualButtons(linkSafe, "I Am Safe", data.link, "More Info", true);
    
  } else {
    // Default: Single button with external link
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
```

---

### 6. Add Helper Functions for Button Generation (Add before generateUniversalTemplate)

```javascript
/**
 * Helper: Generate dual mailto buttons (both buttons are mailto links)
 */
function generateDualMailtoButtons(linkYes, textYes, linkNo, textNo) {
  return `
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 28px;">
      <tr>
        <td align="center">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${linkYes}" style="height:48
```


## License: unknown
https://github.com/matthelbig/matthelbig.github.io/blob/c06879688437a0d898e0918ea0b12e31a7230163/site-old/EMMA-Entry/EMMA-email-template.html

```
I don't have file editing tools enabled. Here's the complete implementation guide file content:

```markdown
# EMAIL_SYSTEM_RSVP_OVERHAUL.md

## Email System RSVP Overhaul and Appointments Fix

This document provides complete implementation details for transforming the Email System's RSVP functionality and fixing the Appointments template. All code changes are provided for both **backend (GAS)** and **frontend (TypeScript)** to maintain consistency.

---

## Table of Contents

1. [Overview](#overview)
2. [Backend Changes (EmailSystem_Main.gs)](#backend-changes)
3. [Frontend Changes (gasEmailSystemService.ts)](#frontend-changes)
4. [Pre-Typed RSVP Email Text](#pre-typed-rsvp-email-text)
5. [Testing Checklist](#testing-checklist)

---

## Overview

### Current Issues

1. **Appointments Template**: Currently interview-focused but should be for position/designation appointments (e.g., "You've been appointed as Committee Head")
2. **Hardcoded RSVP Buttons**: All event-type templates display "Confirm Attendance" regardless of configured `btnText`
3. **Missing Old Position Field**: No way to track position transitions (FROM -> TO)
4. **Non-Event Templates**: Lack mailto RSVP buttons for response tracking

### Solution Summary

- New template type: `appointment` (separate from `event`)
- Old Position field for position transitions
- Per-template RSVP buttons with contextual pre-typed email text
- Dual-button layouts for payment and acknowledgment templates

---

## Backend Changes

### File: `gas-backend/EmailSystem_Main.gs`

---

### 1. Update SHEET_LAYOUTS - Appointments Template (Lines 37-43)

**REPLACE:**
```javascript
"Appointments": {
  headers: ["Candidate Name", "Email", "Role/Position", "Message", "Interview Date", "Interview Time", "Location/Link", "Confirm Link", "Attachments"],
  map: { name:0, email:1, headline:2, msg:3, date:4, time:5, venue:6, link:7, attach:8 },
  btn: "Accept Appointment",
  type: "event",
  code: "AP"
},
```

**WITH:**
```javascript
"Appointments": {
  headers: ["Appointee Name", "Email", "New Position", "Message", "Old Position", "Effective Date", "Department/Committee", "Reference Link", "Attachments"],
  map: { name:0, email:1, headline:2, msg:3, oldPosition:4, date:5, venue:6, link:7, attach:8 },
  btn: "Accept Designation",
  type: "appointment",
  code: "AP"
},
```

---

### 2. Update sendSingleRow() - Add sheetName and oldPosition (Lines 144-220)

**FIND the info object initialization (around line 196) and REPLACE:**

```javascript
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
```

**WITH:**

```javascript
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
  attach:      (map.attach !== undefined) ? data[map.attach] : "",
  oldPosition: (map.oldPosition !== undefined) ? data[map.oldPosition] : "",
  btnText:     config.btn,
  type:        config.type,
  sheetName:   sheet.getName()
};
```

---

### 3. Update Calendar Generation Logic (Around line 227)

**FIND:**
```javascript
// 2. Generate Calendar File for Events
if (info.type === "event" && data[map.date]) {
```

**REPLACE WITH:**
```javascript
// 2. Generate Calendar File for Events (not for appointments)
if (info.type === "event" && info.sheetName !== "Appointments" && data[map.date]) {
```

---

### 4. Update generateUniversalTemplate() - Add Appointment Detail Box (Lines 330-395)

**FIND the detailBox section and REPLACE the entire block starting from `let detailBox = '';`:**

```javascript
function generateUniversalTemplate(data, trackingEmail, emailId) {
  // 1. Generate the Details Box (Date, Time, Venue, Position Transition)
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
            <p style="font-size:32px; font-weight:700; margin:0; color:#7C2D12; font-family:'Inter', 'Segoe UI', sans-serif;">P${data.amount}</p>
            ${data.date ? `<p style="color:#9A3412; margin:12px 0 0 0; font-size:13px; font-family:'Inter', 'Segoe UI', sans-serif;">Due by: <strong style="color:#7C2D12;">${data.date}</strong></p>` : ''}
          </td>
        </tr>
      </table>`;
  } else if (hasDetails) {
    // Universal detail box for event, simple, urgent types
    detailBox = `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FFF8F5; border-left: 4px solid #F26522; border-radius: 8px; margin: 24px 0;">
        <tr>
          <td style="padding: 20px;">
            <table width="100%" border="0" cellpadding="6" cellspacing="0">
              ${data.date ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">DATE</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.date}</td>
              </tr>` : ''}
              ${data.time ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">TIME</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.time}</td>
              </tr>` : ''}
              ${data.venue ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">VENUE</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.venue}</td>
              </tr>` : ''}
            </table>
          </td>
        </tr>
      </table>`;
  }
```

---

### 5. Replace Button Generation Logic (Lines 396-450)

**REPLACE the entire buttonsHtml section with:**

```javascript
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

    buttonsHtml = generateDualMailtoButtons(linkYes, "Confirm Attendance", linkNo, "Decline");
    
  } else if (data.sheetName === "Appointments") {
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
    
  } else if (data.sheetName === "Payment_Reminders" || data.sheetName === "Membership_Renewal") {
    // Payment: I Have Paid (mailto) + Pay Now (external link)
    const subPaid = encodeURIComponent(`PAYMENT CONFIRMATION: ${data.headline}`);
    const bodyPaid = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI am writing to confirm that I have completed my payment for "${data.headline}".\n\nPayment Details:\n- Amount: P${data.amount}\n- Date Paid: [DATE OF PAYMENT]\n- Reference/Receipt #: [REFERENCE NUMBER]\n\nPlease let me know if you need any additional information.\n\nBest regards,\n${data.name}`);
    const linkPaid = `mailto:${trackingEmail}?subject=${subPaid}&body=${bodyPaid}`;

    buttonsHtml = generateDualButtons(linkPaid, "I Have Paid", data.link, data.sheetName === "Membership_Renewal" ? "Renew Now" : "Pay Now", true);
    
  } else if (data.sheetName === "Doc_Acknowledgment") {
    // Doc Acknowledgment: I Acknowledge (mailto) + View Document (external link)
    const subAck = encodeURIComponent(`DOCUMENT ACKNOWLEDGED: ${data.headline}`);
    const bodyAck = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI hereby acknowledge receipt and understanding of "${data.headline}".\n\nI have read and understood the contents of this document.\n\nBest regards,\n${data.name}`);
    const linkAck = `mailto:${trackingEmail}?subject=${subAck}&body=${bodyAck}`;

    buttonsHtml = generateDualButtons(linkAck, "I Acknowledge", data.link, "View Document", true);
    
  } else if (data.sheetName === "Emergency_Alert") {
    // Emergency Alert: I Am Safe (mailto) + More Info (external link)
    const subSafe = encodeURIComponent(`SAFETY CHECK-IN: ${data.headline}`);
    const bodySafe = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI am confirming that I am safe following the "${data.headline}" alert.\n\nCurrent Status: [SAFE / NEED ASSISTANCE]\nLocation: [YOUR CURRENT LOCATION]\n\nBest regards,\n${data.name}`);
    const linkSafe = `mailto:${trackingEmail}?subject=${subSafe}&body=${bodySafe}`;

    buttonsHtml = generateDualButtons(linkSafe, "I Am Safe", data.link, "More Info", true);
    
  } else {
    // Default: Single button with external link
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
```

---

### 6. Add Helper Functions for Button Generation (Add before generateUniversalTemplate)

```javascript
/**
 * Helper: Generate dual mailto buttons (both buttons are mailto links)
 */
function generateDualMailtoButtons(linkYes, textYes, linkNo, textNo) {
  return `
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 28px;">
      <tr>
        <td align="center">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${linkYes}" style="height:48
```


## License: unknown
https://github.com/matthelbig/matthelbig.github.io/blob/c06879688437a0d898e0918ea0b12e31a7230163/site-old/EMMA-Entry/EMMA-email-template.html

```
I don't have file editing tools enabled. Here's the complete implementation guide file content:

```markdown
# EMAIL_SYSTEM_RSVP_OVERHAUL.md

## Email System RSVP Overhaul and Appointments Fix

This document provides complete implementation details for transforming the Email System's RSVP functionality and fixing the Appointments template. All code changes are provided for both **backend (GAS)** and **frontend (TypeScript)** to maintain consistency.

---

## Table of Contents

1. [Overview](#overview)
2. [Backend Changes (EmailSystem_Main.gs)](#backend-changes)
3. [Frontend Changes (gasEmailSystemService.ts)](#frontend-changes)
4. [Pre-Typed RSVP Email Text](#pre-typed-rsvp-email-text)
5. [Testing Checklist](#testing-checklist)

---

## Overview

### Current Issues

1. **Appointments Template**: Currently interview-focused but should be for position/designation appointments (e.g., "You've been appointed as Committee Head")
2. **Hardcoded RSVP Buttons**: All event-type templates display "Confirm Attendance" regardless of configured `btnText`
3. **Missing Old Position Field**: No way to track position transitions (FROM -> TO)
4. **Non-Event Templates**: Lack mailto RSVP buttons for response tracking

### Solution Summary

- New template type: `appointment` (separate from `event`)
- Old Position field for position transitions
- Per-template RSVP buttons with contextual pre-typed email text
- Dual-button layouts for payment and acknowledgment templates

---

## Backend Changes

### File: `gas-backend/EmailSystem_Main.gs`

---

### 1. Update SHEET_LAYOUTS - Appointments Template (Lines 37-43)

**REPLACE:**
```javascript
"Appointments": {
  headers: ["Candidate Name", "Email", "Role/Position", "Message", "Interview Date", "Interview Time", "Location/Link", "Confirm Link", "Attachments"],
  map: { name:0, email:1, headline:2, msg:3, date:4, time:5, venue:6, link:7, attach:8 },
  btn: "Accept Appointment",
  type: "event",
  code: "AP"
},
```

**WITH:**
```javascript
"Appointments": {
  headers: ["Appointee Name", "Email", "New Position", "Message", "Old Position", "Effective Date", "Department/Committee", "Reference Link", "Attachments"],
  map: { name:0, email:1, headline:2, msg:3, oldPosition:4, date:5, venue:6, link:7, attach:8 },
  btn: "Accept Designation",
  type: "appointment",
  code: "AP"
},
```

---

### 2. Update sendSingleRow() - Add sheetName and oldPosition (Lines 144-220)

**FIND the info object initialization (around line 196) and REPLACE:**

```javascript
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
```

**WITH:**

```javascript
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
  attach:      (map.attach !== undefined) ? data[map.attach] : "",
  oldPosition: (map.oldPosition !== undefined) ? data[map.oldPosition] : "",
  btnText:     config.btn,
  type:        config.type,
  sheetName:   sheet.getName()
};
```

---

### 3. Update Calendar Generation Logic (Around line 227)

**FIND:**
```javascript
// 2. Generate Calendar File for Events
if (info.type === "event" && data[map.date]) {
```

**REPLACE WITH:**
```javascript
// 2. Generate Calendar File for Events (not for appointments)
if (info.type === "event" && info.sheetName !== "Appointments" && data[map.date]) {
```

---

### 4. Update generateUniversalTemplate() - Add Appointment Detail Box (Lines 330-395)

**FIND the detailBox section and REPLACE the entire block starting from `let detailBox = '';`:**

```javascript
function generateUniversalTemplate(data, trackingEmail, emailId) {
  // 1. Generate the Details Box (Date, Time, Venue, Position Transition)
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
            <p style="font-size:32px; font-weight:700; margin:0; color:#7C2D12; font-family:'Inter', 'Segoe UI', sans-serif;">P${data.amount}</p>
            ${data.date ? `<p style="color:#9A3412; margin:12px 0 0 0; font-size:13px; font-family:'Inter', 'Segoe UI', sans-serif;">Due by: <strong style="color:#7C2D12;">${data.date}</strong></p>` : ''}
          </td>
        </tr>
      </table>`;
  } else if (hasDetails) {
    // Universal detail box for event, simple, urgent types
    detailBox = `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FFF8F5; border-left: 4px solid #F26522; border-radius: 8px; margin: 24px 0;">
        <tr>
          <td style="padding: 20px;">
            <table width="100%" border="0" cellpadding="6" cellspacing="0">
              ${data.date ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">DATE</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.date}</td>
              </tr>` : ''}
              ${data.time ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">TIME</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.time}</td>
              </tr>` : ''}
              ${data.venue ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">VENUE</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.venue}</td>
              </tr>` : ''}
            </table>
          </td>
        </tr>
      </table>`;
  }
```

---

### 5. Replace Button Generation Logic (Lines 396-450)

**REPLACE the entire buttonsHtml section with:**

```javascript
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

    buttonsHtml = generateDualMailtoButtons(linkYes, "Confirm Attendance", linkNo, "Decline");
    
  } else if (data.sheetName === "Appointments") {
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
    
  } else if (data.sheetName === "Payment_Reminders" || data.sheetName === "Membership_Renewal") {
    // Payment: I Have Paid (mailto) + Pay Now (external link)
    const subPaid = encodeURIComponent(`PAYMENT CONFIRMATION: ${data.headline}`);
    const bodyPaid = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI am writing to confirm that I have completed my payment for "${data.headline}".\n\nPayment Details:\n- Amount: P${data.amount}\n- Date Paid: [DATE OF PAYMENT]\n- Reference/Receipt #: [REFERENCE NUMBER]\n\nPlease let me know if you need any additional information.\n\nBest regards,\n${data.name}`);
    const linkPaid = `mailto:${trackingEmail}?subject=${subPaid}&body=${bodyPaid}`;

    buttonsHtml = generateDualButtons(linkPaid, "I Have Paid", data.link, data.sheetName === "Membership_Renewal" ? "Renew Now" : "Pay Now", true);
    
  } else if (data.sheetName === "Doc_Acknowledgment") {
    // Doc Acknowledgment: I Acknowledge (mailto) + View Document (external link)
    const subAck = encodeURIComponent(`DOCUMENT ACKNOWLEDGED: ${data.headline}`);
    const bodyAck = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI hereby acknowledge receipt and understanding of "${data.headline}".\n\nI have read and understood the contents of this document.\n\nBest regards,\n${data.name}`);
    const linkAck = `mailto:${trackingEmail}?subject=${subAck}&body=${bodyAck}`;

    buttonsHtml = generateDualButtons(linkAck, "I Acknowledge", data.link, "View Document", true);
    
  } else if (data.sheetName === "Emergency_Alert") {
    // Emergency Alert: I Am Safe (mailto) + More Info (external link)
    const subSafe = encodeURIComponent(`SAFETY CHECK-IN: ${data.headline}`);
    const bodySafe = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI am confirming that I am safe following the "${data.headline}" alert.\n\nCurrent Status: [SAFE / NEED ASSISTANCE]\nLocation: [YOUR CURRENT LOCATION]\n\nBest regards,\n${data.name}`);
    const linkSafe = `mailto:${trackingEmail}?subject=${subSafe}&body=${bodySafe}`;

    buttonsHtml = generateDualButtons(linkSafe, "I Am Safe", data.link, "More Info", true);
    
  } else {
    // Default: Single button with external link
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
```

---

### 6. Add Helper Functions for Button Generation (Add before generateUniversalTemplate)

```javascript
/**
 * Helper: Generate dual mailto buttons (both buttons are mailto links)
 */
function generateDualMailtoButtons(linkYes, textYes, linkNo, textNo) {
  return `
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 28px;">
      <tr>
        <td align="center">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${linkYes}" style="height:48
```


## License: unknown
https://github.com/matthelbig/matthelbig.github.io/blob/c06879688437a0d898e0918ea0b12e31a7230163/site-old/EMMA-Entry/EMMA-email-template.html

```
I don't have file editing tools enabled. Here's the complete implementation guide file content:

```markdown
# EMAIL_SYSTEM_RSVP_OVERHAUL.md

## Email System RSVP Overhaul and Appointments Fix

This document provides complete implementation details for transforming the Email System's RSVP functionality and fixing the Appointments template. All code changes are provided for both **backend (GAS)** and **frontend (TypeScript)** to maintain consistency.

---

## Table of Contents

1. [Overview](#overview)
2. [Backend Changes (EmailSystem_Main.gs)](#backend-changes)
3. [Frontend Changes (gasEmailSystemService.ts)](#frontend-changes)
4. [Pre-Typed RSVP Email Text](#pre-typed-rsvp-email-text)
5. [Testing Checklist](#testing-checklist)

---

## Overview

### Current Issues

1. **Appointments Template**: Currently interview-focused but should be for position/designation appointments (e.g., "You've been appointed as Committee Head")
2. **Hardcoded RSVP Buttons**: All event-type templates display "Confirm Attendance" regardless of configured `btnText`
3. **Missing Old Position Field**: No way to track position transitions (FROM -> TO)
4. **Non-Event Templates**: Lack mailto RSVP buttons for response tracking

### Solution Summary

- New template type: `appointment` (separate from `event`)
- Old Position field for position transitions
- Per-template RSVP buttons with contextual pre-typed email text
- Dual-button layouts for payment and acknowledgment templates

---

## Backend Changes

### File: `gas-backend/EmailSystem_Main.gs`

---

### 1. Update SHEET_LAYOUTS - Appointments Template (Lines 37-43)

**REPLACE:**
```javascript
"Appointments": {
  headers: ["Candidate Name", "Email", "Role/Position", "Message", "Interview Date", "Interview Time", "Location/Link", "Confirm Link", "Attachments"],
  map: { name:0, email:1, headline:2, msg:3, date:4, time:5, venue:6, link:7, attach:8 },
  btn: "Accept Appointment",
  type: "event",
  code: "AP"
},
```

**WITH:**
```javascript
"Appointments": {
  headers: ["Appointee Name", "Email", "New Position", "Message", "Old Position", "Effective Date", "Department/Committee", "Reference Link", "Attachments"],
  map: { name:0, email:1, headline:2, msg:3, oldPosition:4, date:5, venue:6, link:7, attach:8 },
  btn: "Accept Designation",
  type: "appointment",
  code: "AP"
},
```

---

### 2. Update sendSingleRow() - Add sheetName and oldPosition (Lines 144-220)

**FIND the info object initialization (around line 196) and REPLACE:**

```javascript
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
```

**WITH:**

```javascript
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
  attach:      (map.attach !== undefined) ? data[map.attach] : "",
  oldPosition: (map.oldPosition !== undefined) ? data[map.oldPosition] : "",
  btnText:     config.btn,
  type:        config.type,
  sheetName:   sheet.getName()
};
```

---

### 3. Update Calendar Generation Logic (Around line 227)

**FIND:**
```javascript
// 2. Generate Calendar File for Events
if (info.type === "event" && data[map.date]) {
```

**REPLACE WITH:**
```javascript
// 2. Generate Calendar File for Events (not for appointments)
if (info.type === "event" && info.sheetName !== "Appointments" && data[map.date]) {
```

---

### 4. Update generateUniversalTemplate() - Add Appointment Detail Box (Lines 330-395)

**FIND the detailBox section and REPLACE the entire block starting from `let detailBox = '';`:**

```javascript
function generateUniversalTemplate(data, trackingEmail, emailId) {
  // 1. Generate the Details Box (Date, Time, Venue, Position Transition)
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
            <p style="font-size:32px; font-weight:700; margin:0; color:#7C2D12; font-family:'Inter', 'Segoe UI', sans-serif;">P${data.amount}</p>
            ${data.date ? `<p style="color:#9A3412; margin:12px 0 0 0; font-size:13px; font-family:'Inter', 'Segoe UI', sans-serif;">Due by: <strong style="color:#7C2D12;">${data.date}</strong></p>` : ''}
          </td>
        </tr>
      </table>`;
  } else if (hasDetails) {
    // Universal detail box for event, simple, urgent types
    detailBox = `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FFF8F5; border-left: 4px solid #F26522; border-radius: 8px; margin: 24px 0;">
        <tr>
          <td style="padding: 20px;">
            <table width="100%" border="0" cellpadding="6" cellspacing="0">
              ${data.date ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">DATE</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.date}</td>
              </tr>` : ''}
              ${data.time ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">TIME</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.time}</td>
              </tr>` : ''}
              ${data.venue ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">VENUE</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.venue}</td>
              </tr>` : ''}
            </table>
          </td>
        </tr>
      </table>`;
  }
```

---

### 5. Replace Button Generation Logic (Lines 396-450)

**REPLACE the entire buttonsHtml section with:**

```javascript
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

    buttonsHtml = generateDualMailtoButtons(linkYes, "Confirm Attendance", linkNo, "Decline");
    
  } else if (data.sheetName === "Appointments") {
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
    
  } else if (data.sheetName === "Payment_Reminders" || data.sheetName === "Membership_Renewal") {
    // Payment: I Have Paid (mailto) + Pay Now (external link)
    const subPaid = encodeURIComponent(`PAYMENT CONFIRMATION: ${data.headline}`);
    const bodyPaid = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI am writing to confirm that I have completed my payment for "${data.headline}".\n\nPayment Details:\n- Amount: P${data.amount}\n- Date Paid: [DATE OF PAYMENT]\n- Reference/Receipt #: [REFERENCE NUMBER]\n\nPlease let me know if you need any additional information.\n\nBest regards,\n${data.name}`);
    const linkPaid = `mailto:${trackingEmail}?subject=${subPaid}&body=${bodyPaid}`;

    buttonsHtml = generateDualButtons(linkPaid, "I Have Paid", data.link, data.sheetName === "Membership_Renewal" ? "Renew Now" : "Pay Now", true);
    
  } else if (data.sheetName === "Doc_Acknowledgment") {
    // Doc Acknowledgment: I Acknowledge (mailto) + View Document (external link)
    const subAck = encodeURIComponent(`DOCUMENT ACKNOWLEDGED: ${data.headline}`);
    const bodyAck = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI hereby acknowledge receipt and understanding of "${data.headline}".\n\nI have read and understood the contents of this document.\n\nBest regards,\n${data.name}`);
    const linkAck = `mailto:${trackingEmail}?subject=${subAck}&body=${bodyAck}`;

    buttonsHtml = generateDualButtons(linkAck, "I Acknowledge", data.link, "View Document", true);
    
  } else if (data.sheetName === "Emergency_Alert") {
    // Emergency Alert: I Am Safe (mailto) + More Info (external link)
    const subSafe = encodeURIComponent(`SAFETY CHECK-IN: ${data.headline}`);
    const bodySafe = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI am confirming that I am safe following the "${data.headline}" alert.\n\nCurrent Status: [SAFE / NEED ASSISTANCE]\nLocation: [YOUR CURRENT LOCATION]\n\nBest regards,\n${data.name}`);
    const linkSafe = `mailto:${trackingEmail}?subject=${subSafe}&body=${bodySafe}`;

    buttonsHtml = generateDualButtons(linkSafe, "I Am Safe", data.link, "More Info", true);
    
  } else {
    // Default: Single button with external link
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
```

---

### 6. Add Helper Functions for Button Generation (Add before generateUniversalTemplate)

```javascript
/**
 * Helper: Generate dual mailto buttons (both buttons are mailto links)
 */
function generateDualMailtoButtons(linkYes, textYes, linkNo, textNo) {
  return `
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 28px;">
      <tr>
        <td align="center">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${linkYes}" style="height:48
```


## License: unknown
https://github.com/matthelbig/matthelbig.github.io/blob/c06879688437a0d898e0918ea0b12e31a7230163/site-old/EMMA-Entry/EMMA-email-template.html

```
I don't have file editing tools enabled. Here's the complete implementation guide file content:

```markdown
# EMAIL_SYSTEM_RSVP_OVERHAUL.md

## Email System RSVP Overhaul and Appointments Fix

This document provides complete implementation details for transforming the Email System's RSVP functionality and fixing the Appointments template. All code changes are provided for both **backend (GAS)** and **frontend (TypeScript)** to maintain consistency.

---

## Table of Contents

1. [Overview](#overview)
2. [Backend Changes (EmailSystem_Main.gs)](#backend-changes)
3. [Frontend Changes (gasEmailSystemService.ts)](#frontend-changes)
4. [Pre-Typed RSVP Email Text](#pre-typed-rsvp-email-text)
5. [Testing Checklist](#testing-checklist)

---

## Overview

### Current Issues

1. **Appointments Template**: Currently interview-focused but should be for position/designation appointments (e.g., "You've been appointed as Committee Head")
2. **Hardcoded RSVP Buttons**: All event-type templates display "Confirm Attendance" regardless of configured `btnText`
3. **Missing Old Position Field**: No way to track position transitions (FROM -> TO)
4. **Non-Event Templates**: Lack mailto RSVP buttons for response tracking

### Solution Summary

- New template type: `appointment` (separate from `event`)
- Old Position field for position transitions
- Per-template RSVP buttons with contextual pre-typed email text
- Dual-button layouts for payment and acknowledgment templates

---

## Backend Changes

### File: `gas-backend/EmailSystem_Main.gs`

---

### 1. Update SHEET_LAYOUTS - Appointments Template (Lines 37-43)

**REPLACE:**
```javascript
"Appointments": {
  headers: ["Candidate Name", "Email", "Role/Position", "Message", "Interview Date", "Interview Time", "Location/Link", "Confirm Link", "Attachments"],
  map: { name:0, email:1, headline:2, msg:3, date:4, time:5, venue:6, link:7, attach:8 },
  btn: "Accept Appointment",
  type: "event",
  code: "AP"
},
```

**WITH:**
```javascript
"Appointments": {
  headers: ["Appointee Name", "Email", "New Position", "Message", "Old Position", "Effective Date", "Department/Committee", "Reference Link", "Attachments"],
  map: { name:0, email:1, headline:2, msg:3, oldPosition:4, date:5, venue:6, link:7, attach:8 },
  btn: "Accept Designation",
  type: "appointment",
  code: "AP"
},
```

---

### 2. Update sendSingleRow() - Add sheetName and oldPosition (Lines 144-220)

**FIND the info object initialization (around line 196) and REPLACE:**

```javascript
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
```

**WITH:**

```javascript
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
  attach:      (map.attach !== undefined) ? data[map.attach] : "",
  oldPosition: (map.oldPosition !== undefined) ? data[map.oldPosition] : "",
  btnText:     config.btn,
  type:        config.type,
  sheetName:   sheet.getName()
};
```

---

### 3. Update Calendar Generation Logic (Around line 227)

**FIND:**
```javascript
// 2. Generate Calendar File for Events
if (info.type === "event" && data[map.date]) {
```

**REPLACE WITH:**
```javascript
// 2. Generate Calendar File for Events (not for appointments)
if (info.type === "event" && info.sheetName !== "Appointments" && data[map.date]) {
```

---

### 4. Update generateUniversalTemplate() - Add Appointment Detail Box (Lines 330-395)

**FIND the detailBox section and REPLACE the entire block starting from `let detailBox = '';`:**

```javascript
function generateUniversalTemplate(data, trackingEmail, emailId) {
  // 1. Generate the Details Box (Date, Time, Venue, Position Transition)
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
            <p style="font-size:32px; font-weight:700; margin:0; color:#7C2D12; font-family:'Inter', 'Segoe UI', sans-serif;">P${data.amount}</p>
            ${data.date ? `<p style="color:#9A3412; margin:12px 0 0 0; font-size:13px; font-family:'Inter', 'Segoe UI', sans-serif;">Due by: <strong style="color:#7C2D12;">${data.date}</strong></p>` : ''}
          </td>
        </tr>
      </table>`;
  } else if (hasDetails) {
    // Universal detail box for event, simple, urgent types
    detailBox = `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FFF8F5; border-left: 4px solid #F26522; border-radius: 8px; margin: 24px 0;">
        <tr>
          <td style="padding: 20px;">
            <table width="100%" border="0" cellpadding="6" cellspacing="0">
              ${data.date ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">DATE</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.date}</td>
              </tr>` : ''}
              ${data.time ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">TIME</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.time}</td>
              </tr>` : ''}
              ${data.venue ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">VENUE</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.venue}</td>
              </tr>` : ''}
            </table>
          </td>
        </tr>
      </table>`;
  }
```

---

### 5. Replace Button Generation Logic (Lines 396-450)

**REPLACE the entire buttonsHtml section with:**

```javascript
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

    buttonsHtml = generateDualMailtoButtons(linkYes, "Confirm Attendance", linkNo, "Decline");
    
  } else if (data.sheetName === "Appointments") {
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
    
  } else if (data.sheetName === "Payment_Reminders" || data.sheetName === "Membership_Renewal") {
    // Payment: I Have Paid (mailto) + Pay Now (external link)
    const subPaid = encodeURIComponent(`PAYMENT CONFIRMATION: ${data.headline}`);
    const bodyPaid = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI am writing to confirm that I have completed my payment for "${data.headline}".\n\nPayment Details:\n- Amount: P${data.amount}\n- Date Paid: [DATE OF PAYMENT]\n- Reference/Receipt #: [REFERENCE NUMBER]\n\nPlease let me know if you need any additional information.\n\nBest regards,\n${data.name}`);
    const linkPaid = `mailto:${trackingEmail}?subject=${subPaid}&body=${bodyPaid}`;

    buttonsHtml = generateDualButtons(linkPaid, "I Have Paid", data.link, data.sheetName === "Membership_Renewal" ? "Renew Now" : "Pay Now", true);
    
  } else if (data.sheetName === "Doc_Acknowledgment") {
    // Doc Acknowledgment: I Acknowledge (mailto) + View Document (external link)
    const subAck = encodeURIComponent(`DOCUMENT ACKNOWLEDGED: ${data.headline}`);
    const bodyAck = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI hereby acknowledge receipt and understanding of "${data.headline}".\n\nI have read and understood the contents of this document.\n\nBest regards,\n${data.name}`);
    const linkAck = `mailto:${trackingEmail}?subject=${subAck}&body=${bodyAck}`;

    buttonsHtml = generateDualButtons(linkAck, "I Acknowledge", data.link, "View Document", true);
    
  } else if (data.sheetName === "Emergency_Alert") {
    // Emergency Alert: I Am Safe (mailto) + More Info (external link)
    const subSafe = encodeURIComponent(`SAFETY CHECK-IN: ${data.headline}`);
    const bodySafe = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI am confirming that I am safe following the "${data.headline}" alert.\n\nCurrent Status: [SAFE / NEED ASSISTANCE]\nLocation: [YOUR CURRENT LOCATION]\n\nBest regards,\n${data.name}`);
    const linkSafe = `mailto:${trackingEmail}?subject=${subSafe}&body=${bodySafe}`;

    buttonsHtml = generateDualButtons(linkSafe, "I Am Safe", data.link, "More Info", true);
    
  } else {
    // Default: Single button with external link
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
```

---

### 6. Add Helper Functions for Button Generation (Add before generateUniversalTemplate)

```javascript
/**
 * Helper: Generate dual mailto buttons (both buttons are mailto links)
 */
function generateDualMailtoButtons(linkYes, textYes, linkNo, textNo) {
  return `
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 28px;">
      <tr>
        <td align="center">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${linkYes}" style="height:48
```


## License: unknown
https://github.com/matthelbig/matthelbig.github.io/blob/c06879688437a0d898e0918ea0b12e31a7230163/site-old/EMMA-Entry/EMMA-email-template.html

```
I don't have file editing tools enabled. Here's the complete implementation guide file content:

```markdown
# EMAIL_SYSTEM_RSVP_OVERHAUL.md

## Email System RSVP Overhaul and Appointments Fix

This document provides complete implementation details for transforming the Email System's RSVP functionality and fixing the Appointments template. All code changes are provided for both **backend (GAS)** and **frontend (TypeScript)** to maintain consistency.

---

## Table of Contents

1. [Overview](#overview)
2. [Backend Changes (EmailSystem_Main.gs)](#backend-changes)
3. [Frontend Changes (gasEmailSystemService.ts)](#frontend-changes)
4. [Pre-Typed RSVP Email Text](#pre-typed-rsvp-email-text)
5. [Testing Checklist](#testing-checklist)

---

## Overview

### Current Issues

1. **Appointments Template**: Currently interview-focused but should be for position/designation appointments (e.g., "You've been appointed as Committee Head")
2. **Hardcoded RSVP Buttons**: All event-type templates display "Confirm Attendance" regardless of configured `btnText`
3. **Missing Old Position Field**: No way to track position transitions (FROM -> TO)
4. **Non-Event Templates**: Lack mailto RSVP buttons for response tracking

### Solution Summary

- New template type: `appointment` (separate from `event`)
- Old Position field for position transitions
- Per-template RSVP buttons with contextual pre-typed email text
- Dual-button layouts for payment and acknowledgment templates

---

## Backend Changes

### File: `gas-backend/EmailSystem_Main.gs`

---

### 1. Update SHEET_LAYOUTS - Appointments Template (Lines 37-43)

**REPLACE:**
```javascript
"Appointments": {
  headers: ["Candidate Name", "Email", "Role/Position", "Message", "Interview Date", "Interview Time", "Location/Link", "Confirm Link", "Attachments"],
  map: { name:0, email:1, headline:2, msg:3, date:4, time:5, venue:6, link:7, attach:8 },
  btn: "Accept Appointment",
  type: "event",
  code: "AP"
},
```

**WITH:**
```javascript
"Appointments": {
  headers: ["Appointee Name", "Email", "New Position", "Message", "Old Position", "Effective Date", "Department/Committee", "Reference Link", "Attachments"],
  map: { name:0, email:1, headline:2, msg:3, oldPosition:4, date:5, venue:6, link:7, attach:8 },
  btn: "Accept Designation",
  type: "appointment",
  code: "AP"
},
```

---

### 2. Update sendSingleRow() - Add sheetName and oldPosition (Lines 144-220)

**FIND the info object initialization (around line 196) and REPLACE:**

```javascript
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
```

**WITH:**

```javascript
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
  attach:      (map.attach !== undefined) ? data[map.attach] : "",
  oldPosition: (map.oldPosition !== undefined) ? data[map.oldPosition] : "",
  btnText:     config.btn,
  type:        config.type,
  sheetName:   sheet.getName()
};
```

---

### 3. Update Calendar Generation Logic (Around line 227)

**FIND:**
```javascript
// 2. Generate Calendar File for Events
if (info.type === "event" && data[map.date]) {
```

**REPLACE WITH:**
```javascript
// 2. Generate Calendar File for Events (not for appointments)
if (info.type === "event" && info.sheetName !== "Appointments" && data[map.date]) {
```

---

### 4. Update generateUniversalTemplate() - Add Appointment Detail Box (Lines 330-395)

**FIND the detailBox section and REPLACE the entire block starting from `let detailBox = '';`:**

```javascript
function generateUniversalTemplate(data, trackingEmail, emailId) {
  // 1. Generate the Details Box (Date, Time, Venue, Position Transition)
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
            <p style="font-size:32px; font-weight:700; margin:0; color:#7C2D12; font-family:'Inter', 'Segoe UI', sans-serif;">P${data.amount}</p>
            ${data.date ? `<p style="color:#9A3412; margin:12px 0 0 0; font-size:13px; font-family:'Inter', 'Segoe UI', sans-serif;">Due by: <strong style="color:#7C2D12;">${data.date}</strong></p>` : ''}
          </td>
        </tr>
      </table>`;
  } else if (hasDetails) {
    // Universal detail box for event, simple, urgent types
    detailBox = `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FFF8F5; border-left: 4px solid #F26522; border-radius: 8px; margin: 24px 0;">
        <tr>
          <td style="padding: 20px;">
            <table width="100%" border="0" cellpadding="6" cellspacing="0">
              ${data.date ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">DATE</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.date}</td>
              </tr>` : ''}
              ${data.time ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">TIME</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.time}</td>
              </tr>` : ''}
              ${data.venue ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">VENUE</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.venue}</td>
              </tr>` : ''}
            </table>
          </td>
        </tr>
      </table>`;
  }
```

---

### 5. Replace Button Generation Logic (Lines 396-450)

**REPLACE the entire buttonsHtml section with:**

```javascript
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

    buttonsHtml = generateDualMailtoButtons(linkYes, "Confirm Attendance", linkNo, "Decline");
    
  } else if (data.sheetName === "Appointments") {
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
    
  } else if (data.sheetName === "Payment_Reminders" || data.sheetName === "Membership_Renewal") {
    // Payment: I Have Paid (mailto) + Pay Now (external link)
    const subPaid = encodeURIComponent(`PAYMENT CONFIRMATION: ${data.headline}`);
    const bodyPaid = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI am writing to confirm that I have completed my payment for "${data.headline}".\n\nPayment Details:\n- Amount: P${data.amount}\n- Date Paid: [DATE OF PAYMENT]\n- Reference/Receipt #: [REFERENCE NUMBER]\n\nPlease let me know if you need any additional information.\n\nBest regards,\n${data.name}`);
    const linkPaid = `mailto:${trackingEmail}?subject=${subPaid}&body=${bodyPaid}`;

    buttonsHtml = generateDualButtons(linkPaid, "I Have Paid", data.link, data.sheetName === "Membership_Renewal" ? "Renew Now" : "Pay Now", true);
    
  } else if (data.sheetName === "Doc_Acknowledgment") {
    // Doc Acknowledgment: I Acknowledge (mailto) + View Document (external link)
    const subAck = encodeURIComponent(`DOCUMENT ACKNOWLEDGED: ${data.headline}`);
    const bodyAck = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI hereby acknowledge receipt and understanding of "${data.headline}".\n\nI have read and understood the contents of this document.\n\nBest regards,\n${data.name}`);
    const linkAck = `mailto:${trackingEmail}?subject=${subAck}&body=${bodyAck}`;

    buttonsHtml = generateDualButtons(linkAck, "I Acknowledge", data.link, "View Document", true);
    
  } else if (data.sheetName === "Emergency_Alert") {
    // Emergency Alert: I Am Safe (mailto) + More Info (external link)
    const subSafe = encodeURIComponent(`SAFETY CHECK-IN: ${data.headline}`);
    const bodySafe = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI am confirming that I am safe following the "${data.headline}" alert.\n\nCurrent Status: [SAFE / NEED ASSISTANCE]\nLocation: [YOUR CURRENT LOCATION]\n\nBest regards,\n${data.name}`);
    const linkSafe = `mailto:${trackingEmail}?subject=${subSafe}&body=${bodySafe}`;

    buttonsHtml = generateDualButtons(linkSafe, "I Am Safe", data.link, "More Info", true);
    
  } else {
    // Default: Single button with external link
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
```

---

### 6. Add Helper Functions for Button Generation (Add before generateUniversalTemplate)

```javascript
/**
 * Helper: Generate dual mailto buttons (both buttons are mailto links)
 */
function generateDualMailtoButtons(linkYes, textYes, linkNo, textNo) {
  return `
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 28px;">
      <tr>
        <td align="center">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${linkYes}" style="height:48
```


## License: unknown
https://github.com/matthelbig/matthelbig.github.io/blob/c06879688437a0d898e0918ea0b12e31a7230163/site-old/EMMA-Entry/EMMA-email-template.html

```
I don't have file editing tools enabled. Here's the complete implementation guide file content:

```markdown
# EMAIL_SYSTEM_RSVP_OVERHAUL.md

## Email System RSVP Overhaul and Appointments Fix

This document provides complete implementation details for transforming the Email System's RSVP functionality and fixing the Appointments template. All code changes are provided for both **backend (GAS)** and **frontend (TypeScript)** to maintain consistency.

---

## Table of Contents

1. [Overview](#overview)
2. [Backend Changes (EmailSystem_Main.gs)](#backend-changes)
3. [Frontend Changes (gasEmailSystemService.ts)](#frontend-changes)
4. [Pre-Typed RSVP Email Text](#pre-typed-rsvp-email-text)
5. [Testing Checklist](#testing-checklist)

---

## Overview

### Current Issues

1. **Appointments Template**: Currently interview-focused but should be for position/designation appointments (e.g., "You've been appointed as Committee Head")
2. **Hardcoded RSVP Buttons**: All event-type templates display "Confirm Attendance" regardless of configured `btnText`
3. **Missing Old Position Field**: No way to track position transitions (FROM -> TO)
4. **Non-Event Templates**: Lack mailto RSVP buttons for response tracking

### Solution Summary

- New template type: `appointment` (separate from `event`)
- Old Position field for position transitions
- Per-template RSVP buttons with contextual pre-typed email text
- Dual-button layouts for payment and acknowledgment templates

---

## Backend Changes

### File: `gas-backend/EmailSystem_Main.gs`

---

### 1. Update SHEET_LAYOUTS - Appointments Template (Lines 37-43)

**REPLACE:**
```javascript
"Appointments": {
  headers: ["Candidate Name", "Email", "Role/Position", "Message", "Interview Date", "Interview Time", "Location/Link", "Confirm Link", "Attachments"],
  map: { name:0, email:1, headline:2, msg:3, date:4, time:5, venue:6, link:7, attach:8 },
  btn: "Accept Appointment",
  type: "event",
  code: "AP"
},
```

**WITH:**
```javascript
"Appointments": {
  headers: ["Appointee Name", "Email", "New Position", "Message", "Old Position", "Effective Date", "Department/Committee", "Reference Link", "Attachments"],
  map: { name:0, email:1, headline:2, msg:3, oldPosition:4, date:5, venue:6, link:7, attach:8 },
  btn: "Accept Designation",
  type: "appointment",
  code: "AP"
},
```

---

### 2. Update sendSingleRow() - Add sheetName and oldPosition (Lines 144-220)

**FIND the info object initialization (around line 196) and REPLACE:**

```javascript
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
```

**WITH:**

```javascript
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
  attach:      (map.attach !== undefined) ? data[map.attach] : "",
  oldPosition: (map.oldPosition !== undefined) ? data[map.oldPosition] : "",
  btnText:     config.btn,
  type:        config.type,
  sheetName:   sheet.getName()
};
```

---

### 3. Update Calendar Generation Logic (Around line 227)

**FIND:**
```javascript
// 2. Generate Calendar File for Events
if (info.type === "event" && data[map.date]) {
```

**REPLACE WITH:**
```javascript
// 2. Generate Calendar File for Events (not for appointments)
if (info.type === "event" && info.sheetName !== "Appointments" && data[map.date]) {
```

---

### 4. Update generateUniversalTemplate() - Add Appointment Detail Box (Lines 330-395)

**FIND the detailBox section and REPLACE the entire block starting from `let detailBox = '';`:**

```javascript
function generateUniversalTemplate(data, trackingEmail, emailId) {
  // 1. Generate the Details Box (Date, Time, Venue, Position Transition)
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
            <p style="font-size:32px; font-weight:700; margin:0; color:#7C2D12; font-family:'Inter', 'Segoe UI', sans-serif;">P${data.amount}</p>
            ${data.date ? `<p style="color:#9A3412; margin:12px 0 0 0; font-size:13px; font-family:'Inter', 'Segoe UI', sans-serif;">Due by: <strong style="color:#7C2D12;">${data.date}</strong></p>` : ''}
          </td>
        </tr>
      </table>`;
  } else if (hasDetails) {
    // Universal detail box for event, simple, urgent types
    detailBox = `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FFF8F5; border-left: 4px solid #F26522; border-radius: 8px; margin: 24px 0;">
        <tr>
          <td style="padding: 20px;">
            <table width="100%" border="0" cellpadding="6" cellspacing="0">
              ${data.date ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">DATE</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.date}</td>
              </tr>` : ''}
              ${data.time ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">TIME</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.time}</td>
              </tr>` : ''}
              ${data.venue ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">VENUE</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.venue}</td>
              </tr>` : ''}
            </table>
          </td>
        </tr>
      </table>`;
  }
```

---

### 5. Replace Button Generation Logic (Lines 396-450)

**REPLACE the entire buttonsHtml section with:**

```javascript
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

    buttonsHtml = generateDualMailtoButtons(linkYes, "Confirm Attendance", linkNo, "Decline");
    
  } else if (data.sheetName === "Appointments") {
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
    
  } else if (data.sheetName === "Payment_Reminders" || data.sheetName === "Membership_Renewal") {
    // Payment: I Have Paid (mailto) + Pay Now (external link)
    const subPaid = encodeURIComponent(`PAYMENT CONFIRMATION: ${data.headline}`);
    const bodyPaid = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI am writing to confirm that I have completed my payment for "${data.headline}".\n\nPayment Details:\n- Amount: P${data.amount}\n- Date Paid: [DATE OF PAYMENT]\n- Reference/Receipt #: [REFERENCE NUMBER]\n\nPlease let me know if you need any additional information.\n\nBest regards,\n${data.name}`);
    const linkPaid = `mailto:${trackingEmail}?subject=${subPaid}&body=${bodyPaid}`;

    buttonsHtml = generateDualButtons(linkPaid, "I Have Paid", data.link, data.sheetName === "Membership_Renewal" ? "Renew Now" : "Pay Now", true);
    
  } else if (data.sheetName === "Doc_Acknowledgment") {
    // Doc Acknowledgment: I Acknowledge (mailto) + View Document (external link)
    const subAck = encodeURIComponent(`DOCUMENT ACKNOWLEDGED: ${data.headline}`);
    const bodyAck = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI hereby acknowledge receipt and understanding of "${data.headline}".\n\nI have read and understood the contents of this document.\n\nBest regards,\n${data.name}`);
    const linkAck = `mailto:${trackingEmail}?subject=${subAck}&body=${bodyAck}`;

    buttonsHtml = generateDualButtons(linkAck, "I Acknowledge", data.link, "View Document", true);
    
  } else if (data.sheetName === "Emergency_Alert") {
    // Emergency Alert: I Am Safe (mailto) + More Info (external link)
    const subSafe = encodeURIComponent(`SAFETY CHECK-IN: ${data.headline}`);
    const bodySafe = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI am confirming that I am safe following the "${data.headline}" alert.\n\nCurrent Status: [SAFE / NEED ASSISTANCE]\nLocation: [YOUR CURRENT LOCATION]\n\nBest regards,\n${data.name}`);
    const linkSafe = `mailto:${trackingEmail}?subject=${subSafe}&body=${bodySafe}`;

    buttonsHtml = generateDualButtons(linkSafe, "I Am Safe", data.link, "More Info", true);
    
  } else {
    // Default: Single button with external link
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
```

---

### 6. Add Helper Functions for Button Generation (Add before generateUniversalTemplate)

```javascript
/**
 * Helper: Generate dual mailto buttons (both buttons are mailto links)
 */
function generateDualMailtoButtons(linkYes, textYes, linkNo, textNo) {
  return `
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 28px;">
      <tr>
        <td align="center">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${linkYes}" style="height:48
```


## License: unknown
https://github.com/matthelbig/matthelbig.github.io/blob/c06879688437a0d898e0918ea0b12e31a7230163/site-old/EMMA-Entry/EMMA-email-template.html

```
I don't have file editing tools enabled. Here's the complete implementation guide file content:

```markdown
# EMAIL_SYSTEM_RSVP_OVERHAUL.md

## Email System RSVP Overhaul and Appointments Fix

This document provides complete implementation details for transforming the Email System's RSVP functionality and fixing the Appointments template. All code changes are provided for both **backend (GAS)** and **frontend (TypeScript)** to maintain consistency.

---

## Table of Contents

1. [Overview](#overview)
2. [Backend Changes (EmailSystem_Main.gs)](#backend-changes)
3. [Frontend Changes (gasEmailSystemService.ts)](#frontend-changes)
4. [Pre-Typed RSVP Email Text](#pre-typed-rsvp-email-text)
5. [Testing Checklist](#testing-checklist)

---

## Overview

### Current Issues

1. **Appointments Template**: Currently interview-focused but should be for position/designation appointments (e.g., "You've been appointed as Committee Head")
2. **Hardcoded RSVP Buttons**: All event-type templates display "Confirm Attendance" regardless of configured `btnText`
3. **Missing Old Position Field**: No way to track position transitions (FROM -> TO)
4. **Non-Event Templates**: Lack mailto RSVP buttons for response tracking

### Solution Summary

- New template type: `appointment` (separate from `event`)
- Old Position field for position transitions
- Per-template RSVP buttons with contextual pre-typed email text
- Dual-button layouts for payment and acknowledgment templates

---

## Backend Changes

### File: `gas-backend/EmailSystem_Main.gs`

---

### 1. Update SHEET_LAYOUTS - Appointments Template (Lines 37-43)

**REPLACE:**
```javascript
"Appointments": {
  headers: ["Candidate Name", "Email", "Role/Position", "Message", "Interview Date", "Interview Time", "Location/Link", "Confirm Link", "Attachments"],
  map: { name:0, email:1, headline:2, msg:3, date:4, time:5, venue:6, link:7, attach:8 },
  btn: "Accept Appointment",
  type: "event",
  code: "AP"
},
```

**WITH:**
```javascript
"Appointments": {
  headers: ["Appointee Name", "Email", "New Position", "Message", "Old Position", "Effective Date", "Department/Committee", "Reference Link", "Attachments"],
  map: { name:0, email:1, headline:2, msg:3, oldPosition:4, date:5, venue:6, link:7, attach:8 },
  btn: "Accept Designation",
  type: "appointment",
  code: "AP"
},
```

---

### 2. Update sendSingleRow() - Add sheetName and oldPosition (Lines 144-220)

**FIND the info object initialization (around line 196) and REPLACE:**

```javascript
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
```

**WITH:**

```javascript
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
  attach:      (map.attach !== undefined) ? data[map.attach] : "",
  oldPosition: (map.oldPosition !== undefined) ? data[map.oldPosition] : "",
  btnText:     config.btn,
  type:        config.type,
  sheetName:   sheet.getName()
};
```

---

### 3. Update Calendar Generation Logic (Around line 227)

**FIND:**
```javascript
// 2. Generate Calendar File for Events
if (info.type === "event" && data[map.date]) {
```

**REPLACE WITH:**
```javascript
// 2. Generate Calendar File for Events (not for appointments)
if (info.type === "event" && info.sheetName !== "Appointments" && data[map.date]) {
```

---

### 4. Update generateUniversalTemplate() - Add Appointment Detail Box (Lines 330-395)

**FIND the detailBox section and REPLACE the entire block starting from `let detailBox = '';`:**

```javascript
function generateUniversalTemplate(data, trackingEmail, emailId) {
  // 1. Generate the Details Box (Date, Time, Venue, Position Transition)
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
            <p style="font-size:32px; font-weight:700; margin:0; color:#7C2D12; font-family:'Inter', 'Segoe UI', sans-serif;">P${data.amount}</p>
            ${data.date ? `<p style="color:#9A3412; margin:12px 0 0 0; font-size:13px; font-family:'Inter', 'Segoe UI', sans-serif;">Due by: <strong style="color:#7C2D12;">${data.date}</strong></p>` : ''}
          </td>
        </tr>
      </table>`;
  } else if (hasDetails) {
    // Universal detail box for event, simple, urgent types
    detailBox = `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FFF8F5; border-left: 4px solid #F26522; border-radius: 8px; margin: 24px 0;">
        <tr>
          <td style="padding: 20px;">
            <table width="100%" border="0" cellpadding="6" cellspacing="0">
              ${data.date ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">DATE</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.date}</td>
              </tr>` : ''}
              ${data.time ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">TIME</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.time}</td>
              </tr>` : ''}
              ${data.venue ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">VENUE</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.venue}</td>
              </tr>` : ''}
            </table>
          </td>
        </tr>
      </table>`;
  }
```

---

### 5. Replace Button Generation Logic (Lines 396-450)

**REPLACE the entire buttonsHtml section with:**

```javascript
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

    buttonsHtml = generateDualMailtoButtons(linkYes, "Confirm Attendance", linkNo, "Decline");
    
  } else if (data.sheetName === "Appointments") {
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
    
  } else if (data.sheetName === "Payment_Reminders" || data.sheetName === "Membership_Renewal") {
    // Payment: I Have Paid (mailto) + Pay Now (external link)
    const subPaid = encodeURIComponent(`PAYMENT CONFIRMATION: ${data.headline}`);
    const bodyPaid = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI am writing to confirm that I have completed my payment for "${data.headline}".\n\nPayment Details:\n- Amount: P${data.amount}\n- Date Paid: [DATE OF PAYMENT]\n- Reference/Receipt #: [REFERENCE NUMBER]\n\nPlease let me know if you need any additional information.\n\nBest regards,\n${data.name}`);
    const linkPaid = `mailto:${trackingEmail}?subject=${subPaid}&body=${bodyPaid}`;

    buttonsHtml = generateDualButtons(linkPaid, "I Have Paid", data.link, data.sheetName === "Membership_Renewal" ? "Renew Now" : "Pay Now", true);
    
  } else if (data.sheetName === "Doc_Acknowledgment") {
    // Doc Acknowledgment: I Acknowledge (mailto) + View Document (external link)
    const subAck = encodeURIComponent(`DOCUMENT ACKNOWLEDGED: ${data.headline}`);
    const bodyAck = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI hereby acknowledge receipt and understanding of "${data.headline}".\n\nI have read and understood the contents of this document.\n\nBest regards,\n${data.name}`);
    const linkAck = `mailto:${trackingEmail}?subject=${subAck}&body=${bodyAck}`;

    buttonsHtml = generateDualButtons(linkAck, "I Acknowledge", data.link, "View Document", true);
    
  } else if (data.sheetName === "Emergency_Alert") {
    // Emergency Alert: I Am Safe (mailto) + More Info (external link)
    const subSafe = encodeURIComponent(`SAFETY CHECK-IN: ${data.headline}`);
    const bodySafe = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI am confirming that I am safe following the "${data.headline}" alert.\n\nCurrent Status: [SAFE / NEED ASSISTANCE]\nLocation: [YOUR CURRENT LOCATION]\n\nBest regards,\n${data.name}`);
    const linkSafe = `mailto:${trackingEmail}?subject=${subSafe}&body=${bodySafe}`;

    buttonsHtml = generateDualButtons(linkSafe, "I Am Safe", data.link, "More Info", true);
    
  } else {
    // Default: Single button with external link
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
```

---

### 6. Add Helper Functions for Button Generation (Add before generateUniversalTemplate)

```javascript
/**
 * Helper: Generate dual mailto buttons (both buttons are mailto links)
 */
function generateDualMailtoButtons(linkYes, textYes, linkNo, textNo) {
  return `
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 28px;">
      <tr>
        <td align="center">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${linkYes}" style="height:48
```


## License: unknown
https://github.com/akshcllctve/fuzzy-octo-dubstep/blob/be471078921f0b1e4ddd0dd2500fe76a37a30c69/newsletter.html

```
I don't have file editing tools enabled. Here's the complete implementation guide file content:

```markdown
# EMAIL_SYSTEM_RSVP_OVERHAUL.md

## Email System RSVP Overhaul and Appointments Fix

This document provides complete implementation details for transforming the Email System's RSVP functionality and fixing the Appointments template. All code changes are provided for both **backend (GAS)** and **frontend (TypeScript)** to maintain consistency.

---

## Table of Contents

1. [Overview](#overview)
2. [Backend Changes (EmailSystem_Main.gs)](#backend-changes)
3. [Frontend Changes (gasEmailSystemService.ts)](#frontend-changes)
4. [Pre-Typed RSVP Email Text](#pre-typed-rsvp-email-text)
5. [Testing Checklist](#testing-checklist)

---

## Overview

### Current Issues

1. **Appointments Template**: Currently interview-focused but should be for position/designation appointments (e.g., "You've been appointed as Committee Head")
2. **Hardcoded RSVP Buttons**: All event-type templates display "Confirm Attendance" regardless of configured `btnText`
3. **Missing Old Position Field**: No way to track position transitions (FROM -> TO)
4. **Non-Event Templates**: Lack mailto RSVP buttons for response tracking

### Solution Summary

- New template type: `appointment` (separate from `event`)
- Old Position field for position transitions
- Per-template RSVP buttons with contextual pre-typed email text
- Dual-button layouts for payment and acknowledgment templates

---

## Backend Changes

### File: `gas-backend/EmailSystem_Main.gs`

---

### 1. Update SHEET_LAYOUTS - Appointments Template (Lines 37-43)

**REPLACE:**
```javascript
"Appointments": {
  headers: ["Candidate Name", "Email", "Role/Position", "Message", "Interview Date", "Interview Time", "Location/Link", "Confirm Link", "Attachments"],
  map: { name:0, email:1, headline:2, msg:3, date:4, time:5, venue:6, link:7, attach:8 },
  btn: "Accept Appointment",
  type: "event",
  code: "AP"
},
```

**WITH:**
```javascript
"Appointments": {
  headers: ["Appointee Name", "Email", "New Position", "Message", "Old Position", "Effective Date", "Department/Committee", "Reference Link", "Attachments"],
  map: { name:0, email:1, headline:2, msg:3, oldPosition:4, date:5, venue:6, link:7, attach:8 },
  btn: "Accept Designation",
  type: "appointment",
  code: "AP"
},
```

---

### 2. Update sendSingleRow() - Add sheetName and oldPosition (Lines 144-220)

**FIND the info object initialization (around line 196) and REPLACE:**

```javascript
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
```

**WITH:**

```javascript
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
  attach:      (map.attach !== undefined) ? data[map.attach] : "",
  oldPosition: (map.oldPosition !== undefined) ? data[map.oldPosition] : "",
  btnText:     config.btn,
  type:        config.type,
  sheetName:   sheet.getName()
};
```

---

### 3. Update Calendar Generation Logic (Around line 227)

**FIND:**
```javascript
// 2. Generate Calendar File for Events
if (info.type === "event" && data[map.date]) {
```

**REPLACE WITH:**
```javascript
// 2. Generate Calendar File for Events (not for appointments)
if (info.type === "event" && info.sheetName !== "Appointments" && data[map.date]) {
```

---

### 4. Update generateUniversalTemplate() - Add Appointment Detail Box (Lines 330-395)

**FIND the detailBox section and REPLACE the entire block starting from `let detailBox = '';`:**

```javascript
function generateUniversalTemplate(data, trackingEmail, emailId) {
  // 1. Generate the Details Box (Date, Time, Venue, Position Transition)
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
            <p style="font-size:32px; font-weight:700; margin:0; color:#7C2D12; font-family:'Inter', 'Segoe UI', sans-serif;">P${data.amount}</p>
            ${data.date ? `<p style="color:#9A3412; margin:12px 0 0 0; font-size:13px; font-family:'Inter', 'Segoe UI', sans-serif;">Due by: <strong style="color:#7C2D12;">${data.date}</strong></p>` : ''}
          </td>
        </tr>
      </table>`;
  } else if (hasDetails) {
    // Universal detail box for event, simple, urgent types
    detailBox = `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FFF8F5; border-left: 4px solid #F26522; border-radius: 8px; margin: 24px 0;">
        <tr>
          <td style="padding: 20px;">
            <table width="100%" border="0" cellpadding="6" cellspacing="0">
              ${data.date ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">DATE</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.date}</td>
              </tr>` : ''}
              ${data.time ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">TIME</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.time}</td>
              </tr>` : ''}
              ${data.venue ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">VENUE</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.venue}</td>
              </tr>` : ''}
            </table>
          </td>
        </tr>
      </table>`;
  }
```

---

### 5. Replace Button Generation Logic (Lines 396-450)

**REPLACE the entire buttonsHtml section with:**

```javascript
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

    buttonsHtml = generateDualMailtoButtons(linkYes, "Confirm Attendance", linkNo, "Decline");
    
  } else if (data.sheetName === "Appointments") {
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
    
  } else if (data.sheetName === "Payment_Reminders" || data.sheetName === "Membership_Renewal") {
    // Payment: I Have Paid (mailto) + Pay Now (external link)
    const subPaid = encodeURIComponent(`PAYMENT CONFIRMATION: ${data.headline}`);
    const bodyPaid = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI am writing to confirm that I have completed my payment for "${data.headline}".\n\nPayment Details:\n- Amount: P${data.amount}\n- Date Paid: [DATE OF PAYMENT]\n- Reference/Receipt #: [REFERENCE NUMBER]\n\nPlease let me know if you need any additional information.\n\nBest regards,\n${data.name}`);
    const linkPaid = `mailto:${trackingEmail}?subject=${subPaid}&body=${bodyPaid}`;

    buttonsHtml = generateDualButtons(linkPaid, "I Have Paid", data.link, data.sheetName === "Membership_Renewal" ? "Renew Now" : "Pay Now", true);
    
  } else if (data.sheetName === "Doc_Acknowledgment") {
    // Doc Acknowledgment: I Acknowledge (mailto) + View Document (external link)
    const subAck = encodeURIComponent(`DOCUMENT ACKNOWLEDGED: ${data.headline}`);
    const bodyAck = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI hereby acknowledge receipt and understanding of "${data.headline}".\n\nI have read and understood the contents of this document.\n\nBest regards,\n${data.name}`);
    const linkAck = `mailto:${trackingEmail}?subject=${subAck}&body=${bodyAck}`;

    buttonsHtml = generateDualButtons(linkAck, "I Acknowledge", data.link, "View Document", true);
    
  } else if (data.sheetName === "Emergency_Alert") {
    // Emergency Alert: I Am Safe (mailto) + More Info (external link)
    const subSafe = encodeURIComponent(`SAFETY CHECK-IN: ${data.headline}`);
    const bodySafe = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI am confirming that I am safe following the "${data.headline}" alert.\n\nCurrent Status: [SAFE / NEED ASSISTANCE]\nLocation: [YOUR CURRENT LOCATION]\n\nBest regards,\n${data.name}`);
    const linkSafe = `mailto:${trackingEmail}?subject=${subSafe}&body=${bodySafe}`;

    buttonsHtml = generateDualButtons(linkSafe, "I Am Safe", data.link, "More Info", true);
    
  } else {
    // Default: Single button with external link
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
```

---

### 6. Add Helper Functions for Button Generation (Add before generateUniversalTemplate)

```javascript
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
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${linkNo}" style="height:48
```


## License: unknown
https://github.com/akshcllctve/fuzzy-octo-dubstep/blob/be471078921f0b1e4ddd0dd2500fe76a37a30c69/newsletter.html

```
I don't have file editing tools enabled. Here's the complete implementation guide file content:

```markdown
# EMAIL_SYSTEM_RSVP_OVERHAUL.md

## Email System RSVP Overhaul and Appointments Fix

This document provides complete implementation details for transforming the Email System's RSVP functionality and fixing the Appointments template. All code changes are provided for both **backend (GAS)** and **frontend (TypeScript)** to maintain consistency.

---

## Table of Contents

1. [Overview](#overview)
2. [Backend Changes (EmailSystem_Main.gs)](#backend-changes)
3. [Frontend Changes (gasEmailSystemService.ts)](#frontend-changes)
4. [Pre-Typed RSVP Email Text](#pre-typed-rsvp-email-text)
5. [Testing Checklist](#testing-checklist)

---

## Overview

### Current Issues

1. **Appointments Template**: Currently interview-focused but should be for position/designation appointments (e.g., "You've been appointed as Committee Head")
2. **Hardcoded RSVP Buttons**: All event-type templates display "Confirm Attendance" regardless of configured `btnText`
3. **Missing Old Position Field**: No way to track position transitions (FROM -> TO)
4. **Non-Event Templates**: Lack mailto RSVP buttons for response tracking

### Solution Summary

- New template type: `appointment` (separate from `event`)
- Old Position field for position transitions
- Per-template RSVP buttons with contextual pre-typed email text
- Dual-button layouts for payment and acknowledgment templates

---

## Backend Changes

### File: `gas-backend/EmailSystem_Main.gs`

---

### 1. Update SHEET_LAYOUTS - Appointments Template (Lines 37-43)

**REPLACE:**
```javascript
"Appointments": {
  headers: ["Candidate Name", "Email", "Role/Position", "Message", "Interview Date", "Interview Time", "Location/Link", "Confirm Link", "Attachments"],
  map: { name:0, email:1, headline:2, msg:3, date:4, time:5, venue:6, link:7, attach:8 },
  btn: "Accept Appointment",
  type: "event",
  code: "AP"
},
```

**WITH:**
```javascript
"Appointments": {
  headers: ["Appointee Name", "Email", "New Position", "Message", "Old Position", "Effective Date", "Department/Committee", "Reference Link", "Attachments"],
  map: { name:0, email:1, headline:2, msg:3, oldPosition:4, date:5, venue:6, link:7, attach:8 },
  btn: "Accept Designation",
  type: "appointment",
  code: "AP"
},
```

---

### 2. Update sendSingleRow() - Add sheetName and oldPosition (Lines 144-220)

**FIND the info object initialization (around line 196) and REPLACE:**

```javascript
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
```

**WITH:**

```javascript
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
  attach:      (map.attach !== undefined) ? data[map.attach] : "",
  oldPosition: (map.oldPosition !== undefined) ? data[map.oldPosition] : "",
  btnText:     config.btn,
  type:        config.type,
  sheetName:   sheet.getName()
};
```

---

### 3. Update Calendar Generation Logic (Around line 227)

**FIND:**
```javascript
// 2. Generate Calendar File for Events
if (info.type === "event" && data[map.date]) {
```

**REPLACE WITH:**
```javascript
// 2. Generate Calendar File for Events (not for appointments)
if (info.type === "event" && info.sheetName !== "Appointments" && data[map.date]) {
```

---

### 4. Update generateUniversalTemplate() - Add Appointment Detail Box (Lines 330-395)

**FIND the detailBox section and REPLACE the entire block starting from `let detailBox = '';`:**

```javascript
function generateUniversalTemplate(data, trackingEmail, emailId) {
  // 1. Generate the Details Box (Date, Time, Venue, Position Transition)
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
            <p style="font-size:32px; font-weight:700; margin:0; color:#7C2D12; font-family:'Inter', 'Segoe UI', sans-serif;">P${data.amount}</p>
            ${data.date ? `<p style="color:#9A3412; margin:12px 0 0 0; font-size:13px; font-family:'Inter', 'Segoe UI', sans-serif;">Due by: <strong style="color:#7C2D12;">${data.date}</strong></p>` : ''}
          </td>
        </tr>
      </table>`;
  } else if (hasDetails) {
    // Universal detail box for event, simple, urgent types
    detailBox = `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FFF8F5; border-left: 4px solid #F26522; border-radius: 8px; margin: 24px 0;">
        <tr>
          <td style="padding: 20px;">
            <table width="100%" border="0" cellpadding="6" cellspacing="0">
              ${data.date ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">DATE</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.date}</td>
              </tr>` : ''}
              ${data.time ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">TIME</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.time}</td>
              </tr>` : ''}
              ${data.venue ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">VENUE</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.venue}</td>
              </tr>` : ''}
            </table>
          </td>
        </tr>
      </table>`;
  }
```

---

### 5. Replace Button Generation Logic (Lines 396-450)

**REPLACE the entire buttonsHtml section with:**

```javascript
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

    buttonsHtml = generateDualMailtoButtons(linkYes, "Confirm Attendance", linkNo, "Decline");
    
  } else if (data.sheetName === "Appointments") {
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
    
  } else if (data.sheetName === "Payment_Reminders" || data.sheetName === "Membership_Renewal") {
    // Payment: I Have Paid (mailto) + Pay Now (external link)
    const subPaid = encodeURIComponent(`PAYMENT CONFIRMATION: ${data.headline}`);
    const bodyPaid = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI am writing to confirm that I have completed my payment for "${data.headline}".\n\nPayment Details:\n- Amount: P${data.amount}\n- Date Paid: [DATE OF PAYMENT]\n- Reference/Receipt #: [REFERENCE NUMBER]\n\nPlease let me know if you need any additional information.\n\nBest regards,\n${data.name}`);
    const linkPaid = `mailto:${trackingEmail}?subject=${subPaid}&body=${bodyPaid}`;

    buttonsHtml = generateDualButtons(linkPaid, "I Have Paid", data.link, data.sheetName === "Membership_Renewal" ? "Renew Now" : "Pay Now", true);
    
  } else if (data.sheetName === "Doc_Acknowledgment") {
    // Doc Acknowledgment: I Acknowledge (mailto) + View Document (external link)
    const subAck = encodeURIComponent(`DOCUMENT ACKNOWLEDGED: ${data.headline}`);
    const bodyAck = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI hereby acknowledge receipt and understanding of "${data.headline}".\n\nI have read and understood the contents of this document.\n\nBest regards,\n${data.name}`);
    const linkAck = `mailto:${trackingEmail}?subject=${subAck}&body=${bodyAck}`;

    buttonsHtml = generateDualButtons(linkAck, "I Acknowledge", data.link, "View Document", true);
    
  } else if (data.sheetName === "Emergency_Alert") {
    // Emergency Alert: I Am Safe (mailto) + More Info (external link)
    const subSafe = encodeURIComponent(`SAFETY CHECK-IN: ${data.headline}`);
    const bodySafe = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI am confirming that I am safe following the "${data.headline}" alert.\n\nCurrent Status: [SAFE / NEED ASSISTANCE]\nLocation: [YOUR CURRENT LOCATION]\n\nBest regards,\n${data.name}`);
    const linkSafe = `mailto:${trackingEmail}?subject=${subSafe}&body=${bodySafe}`;

    buttonsHtml = generateDualButtons(linkSafe, "I Am Safe", data.link, "More Info", true);
    
  } else {
    // Default: Single button with external link
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
```

---

### 6. Add Helper Functions for Button Generation (Add before generateUniversalTemplate)

```javascript
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
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${linkNo}" style="height:48
```


## License: unknown
https://github.com/akshcllctve/fuzzy-octo-dubstep/blob/be471078921f0b1e4ddd0dd2500fe76a37a30c69/newsletter.html

```
I don't have file editing tools enabled. Here's the complete implementation guide file content:

```markdown
# EMAIL_SYSTEM_RSVP_OVERHAUL.md

## Email System RSVP Overhaul and Appointments Fix

This document provides complete implementation details for transforming the Email System's RSVP functionality and fixing the Appointments template. All code changes are provided for both **backend (GAS)** and **frontend (TypeScript)** to maintain consistency.

---

## Table of Contents

1. [Overview](#overview)
2. [Backend Changes (EmailSystem_Main.gs)](#backend-changes)
3. [Frontend Changes (gasEmailSystemService.ts)](#frontend-changes)
4. [Pre-Typed RSVP Email Text](#pre-typed-rsvp-email-text)
5. [Testing Checklist](#testing-checklist)

---

## Overview

### Current Issues

1. **Appointments Template**: Currently interview-focused but should be for position/designation appointments (e.g., "You've been appointed as Committee Head")
2. **Hardcoded RSVP Buttons**: All event-type templates display "Confirm Attendance" regardless of configured `btnText`
3. **Missing Old Position Field**: No way to track position transitions (FROM -> TO)
4. **Non-Event Templates**: Lack mailto RSVP buttons for response tracking

### Solution Summary

- New template type: `appointment` (separate from `event`)
- Old Position field for position transitions
- Per-template RSVP buttons with contextual pre-typed email text
- Dual-button layouts for payment and acknowledgment templates

---

## Backend Changes

### File: `gas-backend/EmailSystem_Main.gs`

---

### 1. Update SHEET_LAYOUTS - Appointments Template (Lines 37-43)

**REPLACE:**
```javascript
"Appointments": {
  headers: ["Candidate Name", "Email", "Role/Position", "Message", "Interview Date", "Interview Time", "Location/Link", "Confirm Link", "Attachments"],
  map: { name:0, email:1, headline:2, msg:3, date:4, time:5, venue:6, link:7, attach:8 },
  btn: "Accept Appointment",
  type: "event",
  code: "AP"
},
```

**WITH:**
```javascript
"Appointments": {
  headers: ["Appointee Name", "Email", "New Position", "Message", "Old Position", "Effective Date", "Department/Committee", "Reference Link", "Attachments"],
  map: { name:0, email:1, headline:2, msg:3, oldPosition:4, date:5, venue:6, link:7, attach:8 },
  btn: "Accept Designation",
  type: "appointment",
  code: "AP"
},
```

---

### 2. Update sendSingleRow() - Add sheetName and oldPosition (Lines 144-220)

**FIND the info object initialization (around line 196) and REPLACE:**

```javascript
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
```

**WITH:**

```javascript
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
  attach:      (map.attach !== undefined) ? data[map.attach] : "",
  oldPosition: (map.oldPosition !== undefined) ? data[map.oldPosition] : "",
  btnText:     config.btn,
  type:        config.type,
  sheetName:   sheet.getName()
};
```

---

### 3. Update Calendar Generation Logic (Around line 227)

**FIND:**
```javascript
// 2. Generate Calendar File for Events
if (info.type === "event" && data[map.date]) {
```

**REPLACE WITH:**
```javascript
// 2. Generate Calendar File for Events (not for appointments)
if (info.type === "event" && info.sheetName !== "Appointments" && data[map.date]) {
```

---

### 4. Update generateUniversalTemplate() - Add Appointment Detail Box (Lines 330-395)

**FIND the detailBox section and REPLACE the entire block starting from `let detailBox = '';`:**

```javascript
function generateUniversalTemplate(data, trackingEmail, emailId) {
  // 1. Generate the Details Box (Date, Time, Venue, Position Transition)
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
            <p style="font-size:32px; font-weight:700; margin:0; color:#7C2D12; font-family:'Inter', 'Segoe UI', sans-serif;">P${data.amount}</p>
            ${data.date ? `<p style="color:#9A3412; margin:12px 0 0 0; font-size:13px; font-family:'Inter', 'Segoe UI', sans-serif;">Due by: <strong style="color:#7C2D12;">${data.date}</strong></p>` : ''}
          </td>
        </tr>
      </table>`;
  } else if (hasDetails) {
    // Universal detail box for event, simple, urgent types
    detailBox = `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FFF8F5; border-left: 4px solid #F26522; border-radius: 8px; margin: 24px 0;">
        <tr>
          <td style="padding: 20px;">
            <table width="100%" border="0" cellpadding="6" cellspacing="0">
              ${data.date ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">DATE</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.date}</td>
              </tr>` : ''}
              ${data.time ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">TIME</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.time}</td>
              </tr>` : ''}
              ${data.venue ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">VENUE</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.venue}</td>
              </tr>` : ''}
            </table>
          </td>
        </tr>
      </table>`;
  }
```

---

### 5. Replace Button Generation Logic (Lines 396-450)

**REPLACE the entire buttonsHtml section with:**

```javascript
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

    buttonsHtml = generateDualMailtoButtons(linkYes, "Confirm Attendance", linkNo, "Decline");
    
  } else if (data.sheetName === "Appointments") {
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
    
  } else if (data.sheetName === "Payment_Reminders" || data.sheetName === "Membership_Renewal") {
    // Payment: I Have Paid (mailto) + Pay Now (external link)
    const subPaid = encodeURIComponent(`PAYMENT CONFIRMATION: ${data.headline}`);
    const bodyPaid = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI am writing to confirm that I have completed my payment for "${data.headline}".\n\nPayment Details:\n- Amount: P${data.amount}\n- Date Paid: [DATE OF PAYMENT]\n- Reference/Receipt #: [REFERENCE NUMBER]\n\nPlease let me know if you need any additional information.\n\nBest regards,\n${data.name}`);
    const linkPaid = `mailto:${trackingEmail}?subject=${subPaid}&body=${bodyPaid}`;

    buttonsHtml = generateDualButtons(linkPaid, "I Have Paid", data.link, data.sheetName === "Membership_Renewal" ? "Renew Now" : "Pay Now", true);
    
  } else if (data.sheetName === "Doc_Acknowledgment") {
    // Doc Acknowledgment: I Acknowledge (mailto) + View Document (external link)
    const subAck = encodeURIComponent(`DOCUMENT ACKNOWLEDGED: ${data.headline}`);
    const bodyAck = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI hereby acknowledge receipt and understanding of "${data.headline}".\n\nI have read and understood the contents of this document.\n\nBest regards,\n${data.name}`);
    const linkAck = `mailto:${trackingEmail}?subject=${subAck}&body=${bodyAck}`;

    buttonsHtml = generateDualButtons(linkAck, "I Acknowledge", data.link, "View Document", true);
    
  } else if (data.sheetName === "Emergency_Alert") {
    // Emergency Alert: I Am Safe (mailto) + More Info (external link)
    const subSafe = encodeURIComponent(`SAFETY CHECK-IN: ${data.headline}`);
    const bodySafe = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI am confirming that I am safe following the "${data.headline}" alert.\n\nCurrent Status: [SAFE / NEED ASSISTANCE]\nLocation: [YOUR CURRENT LOCATION]\n\nBest regards,\n${data.name}`);
    const linkSafe = `mailto:${trackingEmail}?subject=${subSafe}&body=${bodySafe}`;

    buttonsHtml = generateDualButtons(linkSafe, "I Am Safe", data.link, "More Info", true);
    
  } else {
    // Default: Single button with external link
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
```

---

### 6. Add Helper Functions for Button Generation (Add before generateUniversalTemplate)

```javascript
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
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${linkNo}" style="height:48
```


## License: unknown
https://github.com/akshcllctve/fuzzy-octo-dubstep/blob/be471078921f0b1e4ddd0dd2500fe76a37a30c69/newsletter.html

```
I don't have file editing tools enabled. Here's the complete implementation guide file content:

```markdown
# EMAIL_SYSTEM_RSVP_OVERHAUL.md

## Email System RSVP Overhaul and Appointments Fix

This document provides complete implementation details for transforming the Email System's RSVP functionality and fixing the Appointments template. All code changes are provided for both **backend (GAS)** and **frontend (TypeScript)** to maintain consistency.

---

## Table of Contents

1. [Overview](#overview)
2. [Backend Changes (EmailSystem_Main.gs)](#backend-changes)
3. [Frontend Changes (gasEmailSystemService.ts)](#frontend-changes)
4. [Pre-Typed RSVP Email Text](#pre-typed-rsvp-email-text)
5. [Testing Checklist](#testing-checklist)

---

## Overview

### Current Issues

1. **Appointments Template**: Currently interview-focused but should be for position/designation appointments (e.g., "You've been appointed as Committee Head")
2. **Hardcoded RSVP Buttons**: All event-type templates display "Confirm Attendance" regardless of configured `btnText`
3. **Missing Old Position Field**: No way to track position transitions (FROM -> TO)
4. **Non-Event Templates**: Lack mailto RSVP buttons for response tracking

### Solution Summary

- New template type: `appointment` (separate from `event`)
- Old Position field for position transitions
- Per-template RSVP buttons with contextual pre-typed email text
- Dual-button layouts for payment and acknowledgment templates

---

## Backend Changes

### File: `gas-backend/EmailSystem_Main.gs`

---

### 1. Update SHEET_LAYOUTS - Appointments Template (Lines 37-43)

**REPLACE:**
```javascript
"Appointments": {
  headers: ["Candidate Name", "Email", "Role/Position", "Message", "Interview Date", "Interview Time", "Location/Link", "Confirm Link", "Attachments"],
  map: { name:0, email:1, headline:2, msg:3, date:4, time:5, venue:6, link:7, attach:8 },
  btn: "Accept Appointment",
  type: "event",
  code: "AP"
},
```

**WITH:**
```javascript
"Appointments": {
  headers: ["Appointee Name", "Email", "New Position", "Message", "Old Position", "Effective Date", "Department/Committee", "Reference Link", "Attachments"],
  map: { name:0, email:1, headline:2, msg:3, oldPosition:4, date:5, venue:6, link:7, attach:8 },
  btn: "Accept Designation",
  type: "appointment",
  code: "AP"
},
```

---

### 2. Update sendSingleRow() - Add sheetName and oldPosition (Lines 144-220)

**FIND the info object initialization (around line 196) and REPLACE:**

```javascript
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
```

**WITH:**

```javascript
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
  attach:      (map.attach !== undefined) ? data[map.attach] : "",
  oldPosition: (map.oldPosition !== undefined) ? data[map.oldPosition] : "",
  btnText:     config.btn,
  type:        config.type,
  sheetName:   sheet.getName()
};
```

---

### 3. Update Calendar Generation Logic (Around line 227)

**FIND:**
```javascript
// 2. Generate Calendar File for Events
if (info.type === "event" && data[map.date]) {
```

**REPLACE WITH:**
```javascript
// 2. Generate Calendar File for Events (not for appointments)
if (info.type === "event" && info.sheetName !== "Appointments" && data[map.date]) {
```

---

### 4. Update generateUniversalTemplate() - Add Appointment Detail Box (Lines 330-395)

**FIND the detailBox section and REPLACE the entire block starting from `let detailBox = '';`:**

```javascript
function generateUniversalTemplate(data, trackingEmail, emailId) {
  // 1. Generate the Details Box (Date, Time, Venue, Position Transition)
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
            <p style="font-size:32px; font-weight:700; margin:0; color:#7C2D12; font-family:'Inter', 'Segoe UI', sans-serif;">P${data.amount}</p>
            ${data.date ? `<p style="color:#9A3412; margin:12px 0 0 0; font-size:13px; font-family:'Inter', 'Segoe UI', sans-serif;">Due by: <strong style="color:#7C2D12;">${data.date}</strong></p>` : ''}
          </td>
        </tr>
      </table>`;
  } else if (hasDetails) {
    // Universal detail box for event, simple, urgent types
    detailBox = `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FFF8F5; border-left: 4px solid #F26522; border-radius: 8px; margin: 24px 0;">
        <tr>
          <td style="padding: 20px;">
            <table width="100%" border="0" cellpadding="6" cellspacing="0">
              ${data.date ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">DATE</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.date}</td>
              </tr>` : ''}
              ${data.time ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">TIME</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.time}</td>
              </tr>` : ''}
              ${data.venue ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">VENUE</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.venue}</td>
              </tr>` : ''}
            </table>
          </td>
        </tr>
      </table>`;
  }
```

---

### 5. Replace Button Generation Logic (Lines 396-450)

**REPLACE the entire buttonsHtml section with:**

```javascript
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

    buttonsHtml = generateDualMailtoButtons(linkYes, "Confirm Attendance", linkNo, "Decline");
    
  } else if (data.sheetName === "Appointments") {
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
    
  } else if (data.sheetName === "Payment_Reminders" || data.sheetName === "Membership_Renewal") {
    // Payment: I Have Paid (mailto) + Pay Now (external link)
    const subPaid = encodeURIComponent(`PAYMENT CONFIRMATION: ${data.headline}`);
    const bodyPaid = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI am writing to confirm that I have completed my payment for "${data.headline}".\n\nPayment Details:\n- Amount: P${data.amount}\n- Date Paid: [DATE OF PAYMENT]\n- Reference/Receipt #: [REFERENCE NUMBER]\n\nPlease let me know if you need any additional information.\n\nBest regards,\n${data.name}`);
    const linkPaid = `mailto:${trackingEmail}?subject=${subPaid}&body=${bodyPaid}`;

    buttonsHtml = generateDualButtons(linkPaid, "I Have Paid", data.link, data.sheetName === "Membership_Renewal" ? "Renew Now" : "Pay Now", true);
    
  } else if (data.sheetName === "Doc_Acknowledgment") {
    // Doc Acknowledgment: I Acknowledge (mailto) + View Document (external link)
    const subAck = encodeURIComponent(`DOCUMENT ACKNOWLEDGED: ${data.headline}`);
    const bodyAck = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI hereby acknowledge receipt and understanding of "${data.headline}".\n\nI have read and understood the contents of this document.\n\nBest regards,\n${data.name}`);
    const linkAck = `mailto:${trackingEmail}?subject=${subAck}&body=${bodyAck}`;

    buttonsHtml = generateDualButtons(linkAck, "I Acknowledge", data.link, "View Document", true);
    
  } else if (data.sheetName === "Emergency_Alert") {
    // Emergency Alert: I Am Safe (mailto) + More Info (external link)
    const subSafe = encodeURIComponent(`SAFETY CHECK-IN: ${data.headline}`);
    const bodySafe = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI am confirming that I am safe following the "${data.headline}" alert.\n\nCurrent Status: [SAFE / NEED ASSISTANCE]\nLocation: [YOUR CURRENT LOCATION]\n\nBest regards,\n${data.name}`);
    const linkSafe = `mailto:${trackingEmail}?subject=${subSafe}&body=${bodySafe}`;

    buttonsHtml = generateDualButtons(linkSafe, "I Am Safe", data.link, "More Info", true);
    
  } else {
    // Default: Single button with external link
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
```

---

### 6. Add Helper Functions for Button Generation (Add before generateUniversalTemplate)

```javascript
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
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${linkNo}" style="height:48
```


## License: unknown
https://github.com/akshcllctve/fuzzy-octo-dubstep/blob/be471078921f0b1e4ddd0dd2500fe76a37a30c69/newsletter.html

```
I don't have file editing tools enabled. Here's the complete implementation guide file content:

```markdown
# EMAIL_SYSTEM_RSVP_OVERHAUL.md

## Email System RSVP Overhaul and Appointments Fix

This document provides complete implementation details for transforming the Email System's RSVP functionality and fixing the Appointments template. All code changes are provided for both **backend (GAS)** and **frontend (TypeScript)** to maintain consistency.

---

## Table of Contents

1. [Overview](#overview)
2. [Backend Changes (EmailSystem_Main.gs)](#backend-changes)
3. [Frontend Changes (gasEmailSystemService.ts)](#frontend-changes)
4. [Pre-Typed RSVP Email Text](#pre-typed-rsvp-email-text)
5. [Testing Checklist](#testing-checklist)

---

## Overview

### Current Issues

1. **Appointments Template**: Currently interview-focused but should be for position/designation appointments (e.g., "You've been appointed as Committee Head")
2. **Hardcoded RSVP Buttons**: All event-type templates display "Confirm Attendance" regardless of configured `btnText`
3. **Missing Old Position Field**: No way to track position transitions (FROM -> TO)
4. **Non-Event Templates**: Lack mailto RSVP buttons for response tracking

### Solution Summary

- New template type: `appointment` (separate from `event`)
- Old Position field for position transitions
- Per-template RSVP buttons with contextual pre-typed email text
- Dual-button layouts for payment and acknowledgment templates

---

## Backend Changes

### File: `gas-backend/EmailSystem_Main.gs`

---

### 1. Update SHEET_LAYOUTS - Appointments Template (Lines 37-43)

**REPLACE:**
```javascript
"Appointments": {
  headers: ["Candidate Name", "Email", "Role/Position", "Message", "Interview Date", "Interview Time", "Location/Link", "Confirm Link", "Attachments"],
  map: { name:0, email:1, headline:2, msg:3, date:4, time:5, venue:6, link:7, attach:8 },
  btn: "Accept Appointment",
  type: "event",
  code: "AP"
},
```

**WITH:**
```javascript
"Appointments": {
  headers: ["Appointee Name", "Email", "New Position", "Message", "Old Position", "Effective Date", "Department/Committee", "Reference Link", "Attachments"],
  map: { name:0, email:1, headline:2, msg:3, oldPosition:4, date:5, venue:6, link:7, attach:8 },
  btn: "Accept Designation",
  type: "appointment",
  code: "AP"
},
```

---

### 2. Update sendSingleRow() - Add sheetName and oldPosition (Lines 144-220)

**FIND the info object initialization (around line 196) and REPLACE:**

```javascript
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
```

**WITH:**

```javascript
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
  attach:      (map.attach !== undefined) ? data[map.attach] : "",
  oldPosition: (map.oldPosition !== undefined) ? data[map.oldPosition] : "",
  btnText:     config.btn,
  type:        config.type,
  sheetName:   sheet.getName()
};
```

---

### 3. Update Calendar Generation Logic (Around line 227)

**FIND:**
```javascript
// 2. Generate Calendar File for Events
if (info.type === "event" && data[map.date]) {
```

**REPLACE WITH:**
```javascript
// 2. Generate Calendar File for Events (not for appointments)
if (info.type === "event" && info.sheetName !== "Appointments" && data[map.date]) {
```

---

### 4. Update generateUniversalTemplate() - Add Appointment Detail Box (Lines 330-395)

**FIND the detailBox section and REPLACE the entire block starting from `let detailBox = '';`:**

```javascript
function generateUniversalTemplate(data, trackingEmail, emailId) {
  // 1. Generate the Details Box (Date, Time, Venue, Position Transition)
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
            <p style="font-size:32px; font-weight:700; margin:0; color:#7C2D12; font-family:'Inter', 'Segoe UI', sans-serif;">P${data.amount}</p>
            ${data.date ? `<p style="color:#9A3412; margin:12px 0 0 0; font-size:13px; font-family:'Inter', 'Segoe UI', sans-serif;">Due by: <strong style="color:#7C2D12;">${data.date}</strong></p>` : ''}
          </td>
        </tr>
      </table>`;
  } else if (hasDetails) {
    // Universal detail box for event, simple, urgent types
    detailBox = `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FFF8F5; border-left: 4px solid #F26522; border-radius: 8px; margin: 24px 0;">
        <tr>
          <td style="padding: 20px;">
            <table width="100%" border="0" cellpadding="6" cellspacing="0">
              ${data.date ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">DATE</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.date}</td>
              </tr>` : ''}
              ${data.time ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">TIME</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.time}</td>
              </tr>` : ''}
              ${data.venue ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">VENUE</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.venue}</td>
              </tr>` : ''}
            </table>
          </td>
        </tr>
      </table>`;
  }
```

---

### 5. Replace Button Generation Logic (Lines 396-450)

**REPLACE the entire buttonsHtml section with:**

```javascript
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

    buttonsHtml = generateDualMailtoButtons(linkYes, "Confirm Attendance", linkNo, "Decline");
    
  } else if (data.sheetName === "Appointments") {
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
    
  } else if (data.sheetName === "Payment_Reminders" || data.sheetName === "Membership_Renewal") {
    // Payment: I Have Paid (mailto) + Pay Now (external link)
    const subPaid = encodeURIComponent(`PAYMENT CONFIRMATION: ${data.headline}`);
    const bodyPaid = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI am writing to confirm that I have completed my payment for "${data.headline}".\n\nPayment Details:\n- Amount: P${data.amount}\n- Date Paid: [DATE OF PAYMENT]\n- Reference/Receipt #: [REFERENCE NUMBER]\n\nPlease let me know if you need any additional information.\n\nBest regards,\n${data.name}`);
    const linkPaid = `mailto:${trackingEmail}?subject=${subPaid}&body=${bodyPaid}`;

    buttonsHtml = generateDualButtons(linkPaid, "I Have Paid", data.link, data.sheetName === "Membership_Renewal" ? "Renew Now" : "Pay Now", true);
    
  } else if (data.sheetName === "Doc_Acknowledgment") {
    // Doc Acknowledgment: I Acknowledge (mailto) + View Document (external link)
    const subAck = encodeURIComponent(`DOCUMENT ACKNOWLEDGED: ${data.headline}`);
    const bodyAck = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI hereby acknowledge receipt and understanding of "${data.headline}".\n\nI have read and understood the contents of this document.\n\nBest regards,\n${data.name}`);
    const linkAck = `mailto:${trackingEmail}?subject=${subAck}&body=${bodyAck}`;

    buttonsHtml = generateDualButtons(linkAck, "I Acknowledge", data.link, "View Document", true);
    
  } else if (data.sheetName === "Emergency_Alert") {
    // Emergency Alert: I Am Safe (mailto) + More Info (external link)
    const subSafe = encodeURIComponent(`SAFETY CHECK-IN: ${data.headline}`);
    const bodySafe = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI am confirming that I am safe following the "${data.headline}" alert.\n\nCurrent Status: [SAFE / NEED ASSISTANCE]\nLocation: [YOUR CURRENT LOCATION]\n\nBest regards,\n${data.name}`);
    const linkSafe = `mailto:${trackingEmail}?subject=${subSafe}&body=${bodySafe}`;

    buttonsHtml = generateDualButtons(linkSafe, "I Am Safe", data.link, "More Info", true);
    
  } else {
    // Default: Single button with external link
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
```

---

### 6. Add Helper Functions for Button Generation (Add before generateUniversalTemplate)

```javascript
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
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${linkNo}" style="height:48
```


## License: unknown
https://github.com/akshcllctve/fuzzy-octo-dubstep/blob/be471078921f0b1e4ddd0dd2500fe76a37a30c69/newsletter.html

```
I don't have file editing tools enabled. Here's the complete implementation guide file content:

```markdown
# EMAIL_SYSTEM_RSVP_OVERHAUL.md

## Email System RSVP Overhaul and Appointments Fix

This document provides complete implementation details for transforming the Email System's RSVP functionality and fixing the Appointments template. All code changes are provided for both **backend (GAS)** and **frontend (TypeScript)** to maintain consistency.

---

## Table of Contents

1. [Overview](#overview)
2. [Backend Changes (EmailSystem_Main.gs)](#backend-changes)
3. [Frontend Changes (gasEmailSystemService.ts)](#frontend-changes)
4. [Pre-Typed RSVP Email Text](#pre-typed-rsvp-email-text)
5. [Testing Checklist](#testing-checklist)

---

## Overview

### Current Issues

1. **Appointments Template**: Currently interview-focused but should be for position/designation appointments (e.g., "You've been appointed as Committee Head")
2. **Hardcoded RSVP Buttons**: All event-type templates display "Confirm Attendance" regardless of configured `btnText`
3. **Missing Old Position Field**: No way to track position transitions (FROM -> TO)
4. **Non-Event Templates**: Lack mailto RSVP buttons for response tracking

### Solution Summary

- New template type: `appointment` (separate from `event`)
- Old Position field for position transitions
- Per-template RSVP buttons with contextual pre-typed email text
- Dual-button layouts for payment and acknowledgment templates

---

## Backend Changes

### File: `gas-backend/EmailSystem_Main.gs`

---

### 1. Update SHEET_LAYOUTS - Appointments Template (Lines 37-43)

**REPLACE:**
```javascript
"Appointments": {
  headers: ["Candidate Name", "Email", "Role/Position", "Message", "Interview Date", "Interview Time", "Location/Link", "Confirm Link", "Attachments"],
  map: { name:0, email:1, headline:2, msg:3, date:4, time:5, venue:6, link:7, attach:8 },
  btn: "Accept Appointment",
  type: "event",
  code: "AP"
},
```

**WITH:**
```javascript
"Appointments": {
  headers: ["Appointee Name", "Email", "New Position", "Message", "Old Position", "Effective Date", "Department/Committee", "Reference Link", "Attachments"],
  map: { name:0, email:1, headline:2, msg:3, oldPosition:4, date:5, venue:6, link:7, attach:8 },
  btn: "Accept Designation",
  type: "appointment",
  code: "AP"
},
```

---

### 2. Update sendSingleRow() - Add sheetName and oldPosition (Lines 144-220)

**FIND the info object initialization (around line 196) and REPLACE:**

```javascript
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
```

**WITH:**

```javascript
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
  attach:      (map.attach !== undefined) ? data[map.attach] : "",
  oldPosition: (map.oldPosition !== undefined) ? data[map.oldPosition] : "",
  btnText:     config.btn,
  type:        config.type,
  sheetName:   sheet.getName()
};
```

---

### 3. Update Calendar Generation Logic (Around line 227)

**FIND:**
```javascript
// 2. Generate Calendar File for Events
if (info.type === "event" && data[map.date]) {
```

**REPLACE WITH:**
```javascript
// 2. Generate Calendar File for Events (not for appointments)
if (info.type === "event" && info.sheetName !== "Appointments" && data[map.date]) {
```

---

### 4. Update generateUniversalTemplate() - Add Appointment Detail Box (Lines 330-395)

**FIND the detailBox section and REPLACE the entire block starting from `let detailBox = '';`:**

```javascript
function generateUniversalTemplate(data, trackingEmail, emailId) {
  // 1. Generate the Details Box (Date, Time, Venue, Position Transition)
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
            <p style="font-size:32px; font-weight:700; margin:0; color:#7C2D12; font-family:'Inter', 'Segoe UI', sans-serif;">P${data.amount}</p>
            ${data.date ? `<p style="color:#9A3412; margin:12px 0 0 0; font-size:13px; font-family:'Inter', 'Segoe UI', sans-serif;">Due by: <strong style="color:#7C2D12;">${data.date}</strong></p>` : ''}
          </td>
        </tr>
      </table>`;
  } else if (hasDetails) {
    // Universal detail box for event, simple, urgent types
    detailBox = `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FFF8F5; border-left: 4px solid #F26522; border-radius: 8px; margin: 24px 0;">
        <tr>
          <td style="padding: 20px;">
            <table width="100%" border="0" cellpadding="6" cellspacing="0">
              ${data.date ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">DATE</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.date}</td>
              </tr>` : ''}
              ${data.time ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">TIME</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.time}</td>
              </tr>` : ''}
              ${data.venue ? `<tr>
                <td width="70" style="color:#F26522; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Inter', 'Segoe UI', sans-serif; vertical-align:top; padding:4px 0;">VENUE</td>
                <td style="font-size:15px; color:#1a1a1a; font-family:'Inter', 'Segoe UI', sans-serif; font-weight:500;">${data.venue}</td>
              </tr>` : ''}
            </table>
          </td>
        </tr>
      </table>`;
  }
```

---

### 5. Replace Button Generation Logic (Lines 396-450)

**REPLACE the entire buttonsHtml section with:**

```javascript
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

    buttonsHtml = generateDualMailtoButtons(linkYes, "Confirm Attendance", linkNo, "Decline");
    
  } else if (data.sheetName === "Appointments") {
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
    
  } else if (data.sheetName === "Payment_Reminders" || data.sheetName === "Membership_Renewal") {
    // Payment: I Have Paid (mailto) + Pay Now (external link)
    const subPaid = encodeURIComponent(`PAYMENT CONFIRMATION: ${data.headline}`);
    const bodyPaid = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI am writing to confirm that I have completed my payment for "${data.headline}".\n\nPayment Details:\n- Amount: P${data.amount}\n- Date Paid: [DATE OF PAYMENT]\n- Reference/Receipt #: [REFERENCE NUMBER]\n\nPlease let me know if you need any additional information.\n\nBest regards,\n${data.name}`);
    const linkPaid = `mailto:${trackingEmail}?subject=${subPaid}&body=${bodyPaid}`;

    buttonsHtml = generateDualButtons(linkPaid, "I Have Paid", data.link, data.sheetName === "Membership_Renewal" ? "Renew Now" : "Pay Now", true);
    
  } else if (data.sheetName === "Doc_Acknowledgment") {
    // Doc Acknowledgment: I Acknowledge (mailto) + View Document (external link)
    const subAck = encodeURIComponent(`DOCUMENT ACKNOWLEDGED: ${data.headline}`);
    const bodyAck = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI hereby acknowledge receipt and understanding of "${data.headline}".\n\nI have read and understood the contents of this document.\n\nBest regards,\n${data.name}`);
    const linkAck = `mailto:${trackingEmail}?subject=${subAck}&body=${bodyAck}`;

    buttonsHtml = generateDualButtons(linkAck, "I Acknowledge", data.link, "View Document", true);
    
  } else if (data.sheetName === "Emergency_Alert") {
    // Emergency Alert: I Am Safe (mailto) + More Info (external link)
    const subSafe = encodeURIComponent(`SAFETY CHECK-IN: ${data.headline}`);
    const bodySafe = encodeURIComponent(`Dear ${SENDER_DISPLAY_NAME},\n\nI am confirming that I am safe following the "${data.headline}" alert.\n\nCurrent Status: [SAFE / NEED ASSISTANCE]\nLocation: [YOUR CURRENT LOCATION]\n\nBest regards,\n${data.name}`);
    const linkSafe = `mailto:${trackingEmail}?subject=${subSafe}&body=${bodySafe}`;

    buttonsHtml = generateDualButtons(linkSafe, "I Am Safe", data.link, "More Info", true);
    
  } else {
    // Default: Single button with external link
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
```

---

### 6. Add Helper Functions for Button Generation (Add before generateUniversalTemplate)

```javascript
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
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${linkNo}" style="height:48
```

