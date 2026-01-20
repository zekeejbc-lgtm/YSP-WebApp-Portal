// =================== CONFIGURATION ===================
const AUDIT_SPREADSHEET_ID = '1vaQZoPq5a_verhICIiWXudBjAmfgFSIbaBX5xt9kjMk';
const AUDIT_SHEET_NAME = 'User Profiles';
const ORG_LOGO_URL = "https://i.imgur.com/J4wddTW.png"; 

// =================== MAIN FUNCTION ===================

function generateProfileAuditPDF() {
  const data = getAuditData();
  
  let logoBase64 = "";
  try {
    const imageBlob = UrlFetchApp.fetch(ORG_LOGO_URL).getBlob();
    const b64 = Utilities.base64Encode(imageBlob.getBytes());
    logoBase64 = "data:" + imageBlob.getContentType() + ";base64," + b64;
  } catch (e) {
    Logger.log("⚠️ Failed to fetch logo: " + e.toString());
  }

  const htmlContent = createAuditHTML(data, logoBase64);
  const blob = Utilities.newBlob(htmlContent, MimeType.HTML, "YSP_Audit.html");
  const pdf = blob.getAs(MimeType.PDF).setName("YSP_Profile_Audit_" + getTimestamp() + ".pdf");
  
  const file = DriveApp.createFile(pdf);
  Logger.log("✅ PDF Created: " + file.getUrl());
  return file.getUrl();
}

// =================== DATA PROCESSING ===================

function getAuditData() {
  const ss = SpreadsheetApp.openById(AUDIT_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(AUDIT_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const idx = {};
  headers.forEach((h, i) => idx[h] = i);
  
  let allIncomplete = [];
  let completeProfiles = [];
  let stats = {
    total: 0,
    complete: 0,
    missingPhoto: 0,
    unverified: 0,
    incompleteAddr: 0,
    noEmergency: 0,
    needsAttention: 0
  };

  // Lists for specific tables
  let listMissingPhoto = [];
  let listUnverified = [];
  let listIncompleteAddr = [];
  let listNoEmergency = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const name = row[idx['Full name']];
    if (!name) continue;

    let missingAll = [];
    let missingAddr = [];
    let missingEm = [];
    let isComplete = true;

    // 1. Check Verification
    const isVerified = row[idx['EmailVerified']] === true || String(row[idx['EmailVerified']]).toUpperCase() === 'TRUE';
    if (!isVerified) {
      missingAll.push("Unverified Email");
      stats.unverified++;
      isComplete = false;
    }

    // 2. Check Photo
    const hasPhoto = !!row[idx['ProfilePictureURL']];
    if (!hasPhoto) {
      missingAll.push("Missing Photo");
      stats.missingPhoto++;
      isComplete = false;
    }

    // 3. Check Address
    const addrFields = ['Address', 'Barangay', 'City', 'Province', 'Zip Code'];
    const isAddrMissing = addrFields.some(f => !row[idx[f]]);
    if (isAddrMissing) {
      addrFields.forEach(f => { 
        if (!row[idx[f]]) {
          missingAll.push(f);
          missingAddr.push(f); 
        }
      });
      stats.incompleteAddr++;
      isComplete = false;
    }

    // 4. Check Emergency
    const emFields = ['Emergency Contact Name', 'Emergency Contact Relation', 'Emergency Contact Number'];
    const isEmMissing = emFields.some(f => !row[idx[f]]);
    if (isEmMissing) {
      emFields.forEach(f => { 
        if (!row[idx[f]]) {
          missingAll.push(f);
          missingEm.push(f); 
        }
      });
      stats.noEmergency++;
      isComplete = false;
    }

    // Stats & Grouping
    stats.total++;
    const memberObj = {
      id: row[idx['ID Code']],
      name: name,
      position: row[idx['Position']],
      isVerified: isVerified
    };

    if (isComplete) {
      stats.complete++;
      completeProfiles.push({ ...memberObj, missingText: "" });
    } else {
      stats.needsAttention++;
      
      allIncomplete.push({ ...memberObj, missingText: missingAll.join(", ") });

      if (!hasPhoto) listMissingPhoto.push({ ...memberObj, missingText: "Missing Photo" });
      if (!isVerified) listUnverified.push({ ...memberObj, missingText: "Unverified Email" });
      if (isAddrMissing) listIncompleteAddr.push({ ...memberObj, missingText: missingAddr.join(", ") });
      if (isEmMissing) listNoEmergency.push({ ...memberObj, missingText: missingEm.join(", ") });
    }
  }
  
  return { 
    stats, 
    allIncomplete, 
    completeProfiles,
    listMissingPhoto,
    listUnverified,
    listIncompleteAddr,
    listNoEmergency
  };
}

// =================== HTML GENERATION ===================

function createAuditHTML(data, logoBase64) {
  const { 
    stats, 
    allIncomplete, 
    completeProfiles,
    listMissingPhoto,
    listUnverified,
    listIncompleteAddr,
    listNoEmergency
  } = data;

  const dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MM/dd/yyyy, hh:mm:ss a");
  const logoSrc = logoBase64 || ORG_LOGO_URL;

  // Colors
  const C = {
    red: '#F6421F',
    green: '#10b981',
    orange: '#f97316',
    blue: '#3b82f6',
    slate: '#64748b',
    purple: '#8b5cf6',
    yellow: '#eab308'
  };

  // UPDATED: Now accepts index 'i' to show row number
  const createRow = (m, i) => `
    <tr>
      <td style="text-align: center; color: #64748b; font-weight: bold;">${i + 1}</td>
      <td style="font-weight: bold;">${m.id}</td>
      <td>${m.name}</td>
      <td>${m.position}</td>
      <td>${m.isVerified ? '<span class="tag tag-verified">VERIFIED</span>' : '<span class="tag tag-pending">PENDING</span>'}</td>
      <td>${m.missingText || '<span class="tag tag-verified">COMPLETE</span>'}</td>
    </tr>`;

  // UPDATED: Added '#' Column Header and readjusted widths
  const createTableSection = (title, color, rows) => {
    if (rows.length === 0) return '';
    return `
      <div class="page-break"></div>
      <div class="header-spacer"></div> 
      <div class="section-container">
        <div class="section-heading" style="border-color: ${color}; color: ${color === '#eab308' ? '#b45309' : color};">
          ${title} (${rows.length})
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th style="background-color: ${color}; color: ${color === '#eab308' ? 'black' : 'white'}; text-align: center;" width="5%">#</th>
              <th style="background-color: ${color}; color: ${color === '#eab308' ? 'black' : 'white'};" width="15%">ID</th>
              <th style="background-color: ${color}; color: ${color === '#eab308' ? 'black' : 'white'};" width="20%">NAME</th>
              <th style="background-color: ${color}; color: ${color === '#eab308' ? 'black' : 'white'};" width="20%">POSITION</th>
              <th style="background-color: ${color}; color: ${color === '#eab308' ? 'black' : 'white'};" width="10%">VERIFIED?</th>
              <th style="background-color: ${color}; color: ${color === '#eab308' ? 'black' : 'white'};" width="30%">STATUS / MISSING</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((m, i) => createRow(m, i)).join('')}
          </tbody>
        </table>
      </div>
    `;
  };

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      @page { 
        size: A4 landscape; 
        margin-top: 0; 
        margin-left: 0;
        margin-right: 0;
        margin-bottom: 50px; 
      }
      body {
        font-family: 'Helvetica', 'Arial', sans-serif;
        margin: 0;
        padding: 0;
        background-color: #ffffff;
        -webkit-print-color-adjust: exact;
      }

      /* HEADER - RELATIVE */
      .header-banner {
        background-color: ${C.red};
        height: 120px;
        width: 100%;
        color: white;
        padding: 0 50px;
        display: flex;
        align-items: center;
        position: relative; 
        box-sizing: border-box;
      }
      .logo-container {
        width: 70px;
        height: 70px;
        float: left;
        margin-right: 25px;
        margin-top: 25px;
        background: white;
        border-radius: 50%;
        padding: 5px;
        box-sizing: border-box;
      }
      .logo-img { width: 100%; height: 100%; object-fit: contain; }
      .header-text { float: left; margin-top: 25px; }
      .org-title { font-size: 24px; font-weight: bold; margin: 0; line-height: 1.2; }
      .chapter-subtitle { font-size: 16px; font-weight: normal; margin: 4px 0 0 0; opacity: 0.9; }
      .report-label { margin-top: 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.8; }
      
      .meta-data { 
        position: absolute; 
        right: 50px; 
        bottom: 20px; 
        text-align: right; 
        font-size: 10px; 
        opacity: 0.9; 
      }

      /* CONTENT */
      .main-content { 
        padding: 30px 60px; 
        box-sizing: border-box;
        width: 100%;
        margin: 0 auto; 
      }
      
      .header-spacer { height: 50px; display: block; }

      .section-container { margin-top: 10px; width: 100%; padding: 0 60px; box-sizing: border-box; }
      
      .section-heading { 
        font-size: 14px; 
        font-weight: bold; 
        border-bottom: 3px solid; 
        padding-bottom: 8px; 
        margin-bottom: 15px; 
        display: block; 
        text-transform: uppercase; 
        width: 100%;
      }

      /* SUMMARY CARDS */
      .card-grid { display: table; width: 100%; border-spacing: 20px 20px; margin-left: -20px; }
      .grid-row { display: table-row; }
      .grid-cell { display: table-cell; vertical-align: middle; }
      .card { border-radius: 12px; padding: 25px; text-align: center; color: white; height: 90px; vertical-align: middle; }
      .card-val { font-size: 36px; font-weight: bold; display: block; margin-bottom: 5px; }
      .card-lbl { font-size: 10px; text-transform: uppercase; font-weight: bold; opacity: 0.95; letter-spacing: 0.5px; }

      /* TABLE */
      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      thead { display: table-header-group; } 
      tfoot { display: table-footer-group; } 
      tr { page-break-inside: avoid; }
      
      th { font-size: 10px; text-transform: uppercase; font-weight: bold; padding: 12px 15px; text-align: left; border-top: 1px solid white; }
      td { font-size: 10px; color: #334155; padding: 10px 15px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
      tr:nth-child(even) { background-color: #F8FAFC; }

      /* TAGS */
      .tag { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 8px; font-weight: bold; }
      .tag-pending { background: #fef9c3; color: #854d0e; border: 1px solid #fde047; }
      .tag-verified { background: #dcfce7; color: #166534; border: 1px solid #86efac; }

      /* FOOTER */
      .footer {
        position: fixed;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 30px;
        background-color: white;
        border-top: 2px solid ${C.red};
        padding: 5px 50px;
        box-sizing: border-box;
        font-size: 9px;
        color: #64748b;
        display: flex;
        justify-content: space-between;
        align-items: center;
        z-index: 9999;
      }
      
      .page-break { page-break-before: always; }
    </style>
  </head>
  <body>

    <div class="header-banner">
      <div class="logo-container"><img src="${logoSrc}" class="logo-img"></div>
      <div class="header-text">
        <div class="org-title">Youth Service Philippines</div>
        <div class="chapter-subtitle">Tagum Chapter</div>
        <div class="report-label">PROFILE INTEGRITY AUDIT</div>
      </div>
      <div class="meta-data">Exported: ${dateStr}</div>
    </div>

    <div class="main-content">
      <div class="section-heading" style="color: ${C.red}; border-color: ${C.red};">AUDIT SUMMARY</div>
      
      <div class="card-grid">
        <div class="grid-row">
          <div class="grid-cell" style="width: 25%"><div class="card" style="background-color: ${C.orange}"><span class="card-val">${stats.total}</span><span class="card-lbl">TOTAL MEMBERS</span></div></div>
          <div class="grid-cell" style="width: 25%"><div class="card" style="background-color: ${C.green}"><span class="card-val">${stats.complete}</span><span class="card-lbl">100% COMPLETE</span></div></div>
          <div class="grid-cell" style="width: 25%"><div class="card" style="background-color: ${C.red}"><span class="card-val">${stats.needsAttention}</span><span class="card-lbl">NEEDS ATTENTION</span></div></div>
          <div class="grid-cell" style="width: 25%"></div> 
        </div>
        <div class="grid-row">
          <div class="grid-cell"><div class="card" style="background-color: ${C.blue}"><span class="card-val">${stats.missingPhoto}</span><span class="card-lbl">MISSING PHOTO</span></div></div>
          <div class="grid-cell"><div class="card" style="background-color: ${C.yellow}"><span class="card-val">${stats.unverified}</span><span class="card-lbl">UNVERIFIED EMAIL</span></div></div>
          <div class="grid-cell"><div class="card" style="background-color: ${C.orange}"><span class="card-val">${stats.incompleteAddr}</span><span class="card-lbl">INCOMPLETE ADDRESS</span></div></div>
          <div class="grid-cell"><div class="card" style="background-color: ${C.purple}"><span class="card-val">${stats.noEmergency}</span><span class="card-lbl">NO EMERGENCY INFO</span></div></div>
        </div>
      </div>
    </div>

    ${createTableSection("GENERAL INCOMPLETE LIST", C.red, allIncomplete)}

    ${createTableSection("MISSING PROFILE PICTURES", C.blue, listMissingPhoto)}

    ${createTableSection("UNVERIFIED EMAILS", C.yellow, listUnverified)}

    ${createTableSection("INCOMPLETE ADDRESSES", C.orange, listIncompleteAddr)}

    ${createTableSection("NO EMERGENCY CONTACT", C.purple, listNoEmergency)}

    ${createTableSection("FULLY COMPLETE PROFILES", C.green, completeProfiles)}

    <div class="footer">
      <span>Youth Service Philippines - Tagum Chapter</span>
    </div>

  </body>
  </html>
  `;
}

function getTimestamp() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd_HHmm");
}