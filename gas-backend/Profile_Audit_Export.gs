// =================== CONFIGURATION ===================
const AUDIT_SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('LOGIN_SPREADSHEET_ID') || '';
const AUDIT_SHEET_NAME = 'User Profiles';
const ORG_LOGO_URL = "https://i.imgur.com/J4wddTW.png"; 
const PROFILE_AUDIT_BRANDING_CACHE_KEY = 'profile_audit_org_branding_v1';
const PROFILE_AUDIT_BRANDING_CACHE_TTL_SECONDS = 1800;
const PROFILE_AUDIT_BRANDING_SHEET_NAME = 'Organization Branding';
const PROFILE_AUDIT_BRANDING_DEFAULTS = {
  orgName: 'Youth Service Philippines',
  chapterName: 'Tagum Chapter',
  shortName: 'YSP Tagum',
  motto: 'Shaping the Future to a Greater Society',
  chapterCode: 'TC',
  location: 'Tagum City, Davao del Norte, Philippines',
  contactEmail: 'ysptagumchapter@gmail.com',
  logoUrl: ORG_LOGO_URL,
  themeColor: '#f6421f'
};

function normalizeAuditBranding_(raw) {
  var merged = Object.assign({}, PROFILE_AUDIT_BRANDING_DEFAULTS, raw || {});
  merged.orgName = String(merged.orgName || '').trim() || PROFILE_AUDIT_BRANDING_DEFAULTS.orgName;
  merged.chapterName = String(merged.chapterName || '').trim() || PROFILE_AUDIT_BRANDING_DEFAULTS.chapterName;
  merged.shortName = String(merged.shortName || '').trim() || PROFILE_AUDIT_BRANDING_DEFAULTS.shortName;
  merged.motto = String(merged.motto || '').trim() || PROFILE_AUDIT_BRANDING_DEFAULTS.motto;
  merged.chapterCode = String(merged.chapterCode || '').trim() || PROFILE_AUDIT_BRANDING_DEFAULTS.chapterCode;
  merged.location = String(merged.location || '').trim() || PROFILE_AUDIT_BRANDING_DEFAULTS.location;
  merged.contactEmail = String(merged.contactEmail || '').trim() || PROFILE_AUDIT_BRANDING_DEFAULTS.contactEmail;
  merged.logoUrl = String(merged.logoUrl || '').trim() || PROFILE_AUDIT_BRANDING_DEFAULTS.logoUrl;
  merged.themeColor = String(merged.themeColor || '').trim() || PROFILE_AUDIT_BRANDING_DEFAULTS.themeColor;
  merged.fullName = merged.orgName + ' - ' + merged.chapterName;
  return merged;
}

function getAuditBrandingFromSheet_() {
  try {
    var props = PropertiesService.getScriptProperties();
    var settingsId = String(props.getProperty('SYSTEM_SETTINGS_SPREADSHEET_ID') || '').trim();
    if (!settingsId) return null;

    var ss = SpreadsheetApp.openById(settingsId);
    var sheet = ss.getSheetByName(PROFILE_AUDIT_BRANDING_SHEET_NAME);
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
    Logger.log('Profile audit branding sheet fallback read error: ' + sheetReadError);
    return null;
  }
}

function getAuditOrgBranding_() {
  var cache = CacheService.getScriptCache();
  try {
    var cachedRaw = cache.get(PROFILE_AUDIT_BRANDING_CACHE_KEY);
    if (cachedRaw) {
      return normalizeAuditBranding_(JSON.parse(cachedRaw));
    }
  } catch (cacheReadError) {
    Logger.log('Profile audit branding cache read error: ' + cacheReadError);
  }

  var branding = normalizeAuditBranding_({});
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
          branding = normalizeAuditBranding_(parsed.data);
          resolvedFromEndpoint = true;
        }
      }
    }
  } catch (fetchError) {
    Logger.log('Profile audit branding fetch error: ' + fetchError);
  }

  if (!resolvedFromEndpoint) {
    var sheetBranding = getAuditBrandingFromSheet_();
    if (sheetBranding) {
      branding = normalizeAuditBranding_(sheetBranding);
    }
  }

  try {
    cache.put(PROFILE_AUDIT_BRANDING_CACHE_KEY, JSON.stringify(branding), PROFILE_AUDIT_BRANDING_CACHE_TTL_SECONDS);
  } catch (cacheWriteError) {
    Logger.log('Profile audit branding cache write error: ' + cacheWriteError);
  }

  return branding;
}

// =================== MAIN FUNCTION ===================

function generateProfileAuditPDF() {
  const orgBranding = getAuditOrgBranding_();
  const data = getAuditData();
  
  let logoBase64 = "";
  try {
    const imageBlob = UrlFetchApp.fetch(orgBranding.logoUrl).getBlob();
    const b64 = Utilities.base64Encode(imageBlob.getBytes());
    logoBase64 = "data:" + imageBlob.getContentType() + ";base64," + b64;
  } catch (e) {
    Logger.log("⚠️ Failed to fetch logo: " + e.toString());
  }

  const htmlContent = createAuditHTML(data, logoBase64, orgBranding);
  const blob = Utilities.newBlob(htmlContent, MimeType.HTML, "YSP_Audit.html");
  const filenamePrefix = String(orgBranding.shortName || 'YSP').replace(/\s+/g, '_');
  const pdf = blob.getAs(MimeType.PDF).setName(filenamePrefix + "_Profile_Audit_" + getTimestamp() + ".pdf");
  
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

function createAuditHTML(data, logoBase64, orgBranding) {
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
  const branding = normalizeAuditBranding_(orgBranding || {});
  const logoSrc = logoBase64 || branding.logoUrl || ORG_LOGO_URL;

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
        <div class="org-title">${branding.orgName}</div>
        <div class="chapter-subtitle">${branding.chapterName}</div>
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
      <span>${branding.fullName}</span>
    </div>

  </body>
  </html>
  `;
}

function getTimestamp() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd_HHmm");
}