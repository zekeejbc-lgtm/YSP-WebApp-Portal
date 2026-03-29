  // =================== CONFIGURATION ===================
  const DIR_SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('LOGIN_SPREADSHEET_ID') || '';
  const SOURCE_SHEET_NAME = 'User Profiles';
  const TARGET_SHEET_NAME = 'Directory';
  const CHAPTER_NAME = String(PropertiesService.getScriptProperties().getProperty('ORG_CHAPTER_NAME') || 'Tagum Chapter').trim() || 'Tagum Chapter';
  const CHAPTER_PRESIDENT_POSITION = CHAPTER_NAME + ' President';

  const POSITION_RANK_BASE = [
    CHAPTER_PRESIDENT_POSITION,
    'Membership and Internal Affairs Officer',            // 2
    'External Relations Officer',                         // 3
    'Secretary and Documentation Officer',                // 4
    'Finance and Treasury Officer',                       // 5
    'Communications and Marketing Officer',               // 6
    'Program Development Officer',                        // 7
    'Committee Member: Membership and Internal Affairs',  // 8
    'Committee Member: External Relations',               // 9
    'Committee Member: Secretariat and Documentation',    // 10
    'Committee Member: Finance and Treasury',             // 11
    'Committee Member: Program Development',              // 12
    'Committee Member: Communications and Marketing',     // 13
    'Volunteer Member',                                   // 14
    'Member'                                              // 15
  ];

  if (CHAPTER_PRESIDENT_POSITION !== 'Tagum Chapter President') {
    POSITION_RANK_BASE.push('Tagum Chapter President');
  }

  // =================== HIERARCHY RANKING ===================
  const POSITION_RANK = POSITION_RANK_BASE;

  // =================== 1. ONE-TIME SETUP FUNCTION ===================
  /**
  * ⚠️ RUN THIS FUNCTION ONCE TO START AUTOMATION
  */
  function INITIAL_SETUP_RUN_ONCE() {
    const ss = SpreadsheetApp.openById(DIR_SPREADSHEET_ID);
    ensureDirectorySheetExists(ss);
    refreshDirectory();
    
    // Clean up old triggers
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(t => {
      if (t.getHandlerFunction() === 'autoRefreshTrigger') {
        ScriptApp.deleteTrigger(t);
      }
    });
    
    // Create new auto-trigger
    ScriptApp.newTrigger('autoRefreshTrigger')
      .forSpreadsheet(ss)
      .onChange()
      .create();
      
    Logger.log("✅ Setup Complete: Auto-Refresh Active.");
  }

  // =================== 2. TRIGGER HANDLER ===================
  function autoRefreshTrigger(e) {
    refreshDirectory();
  }

  // =================== 3. CORE LOGIC ===================

  function refreshDirectory() {
    const ss = SpreadsheetApp.openById(DIR_SPREADSHEET_ID);
    const srcSheet = ss.getSheetByName(SOURCE_SHEET_NAME);
    let targetSheet = ensureDirectorySheetExists(ss);

    const data = srcSheet.getDataRange().getValues();
    if (data.length < 2) return; 
    
    const headers = data[0];
    
    // Dynamic Column Mapping
    const idx = {
      pos: headers.indexOf('Position'),
      name: headers.indexOf('Full name'),
      age: headers.indexOf('Age'),
      sex: headers.indexOf('Sex/Gender'),
      // Note: Assuming 'Pronouns' or 'Gender Identity' column exists. 
      // If you have a specific "Gender Identity" column, change 'Pronouns' to that name below.
      gender: headers.indexOf('Pronouns'), 
      address: headers.indexOf('Address'),
      email: headers.indexOf('Email Address'),
      contact: headers.indexOf('Contact Number'),
      id: headers.indexOf('ID Code'),
      status: headers.indexOf('Status')
    };

    let outputRows = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const position = (row[idx.pos] || '').toString().trim();
      const status = (row[idx.status] || '').toString().toLowerCase().trim();
      const name = (row[idx.name] || '').toString().trim();

      // FILTER: Must have Position & Name. Must NOT be Banned/Suspended.
      if (!position || !name || status === 'banned' || status === 'suspended') {
        continue;
      }

      // === DATA CONVERSION ===
      const rawSex = idx.sex > -1 ? row[idx.sex] : '';
      const rawGender = idx.gender > -1 ? row[idx.gender] : '';

      const cleanSex = convertSex(rawSex);
      const cleanGender = convertGenderIdentity(rawGender);

      outputRows.push({
        position: position,
        name: name,
        age: row[idx.age],
        sex: cleanSex,            // Uses the converted M/F
        genderIdentity: cleanGender, // Uses the converted L,G,B,T...
        address: row[idx.address],
        email: row[idx.email],
        contact: row[idx.contact],
        idCode: (row[idx.id] || '').toString(), 
        rankIndex: POSITION_RANK.indexOf(position)
      });
    }

    // --- Sort Logic ---
    outputRows.sort((a, b) => {
      const rankA = a.rankIndex === -1 ? 999 : a.rankIndex;
      const rankB = b.rankIndex === -1 ? 999 : b.rankIndex;

      if (rankA !== rankB) return rankA - rankB; // Sort by Hierarchy
      if (a.idCode < b.idCode) return -1;         // Tie-break by ID
      if (a.idCode > b.idCode) return 1;
      return 0;
    });

    // --- Write to Sheet ---
    const finalValues = outputRows.map(r => [
      r.position,
      r.name,
      r.age,
      r.sex,
      r.genderIdentity,
      r.address,
      r.email,
      r.contact
    ]);

    const lastRow = targetSheet.getLastRow();
    if (lastRow > 1) {
      targetSheet.getRange(2, 1, lastRow - 1, targetSheet.getLastColumn()).clearContent();
    }

    if (finalValues.length > 0) {
      targetSheet.getRange(2, 1, finalValues.length, finalValues[0].length).setValues(finalValues);
    }
  }

  // =================== 4. ONE-TIME ID MIGRATION ===================

  /**
  * Optional safety backup before running ID migration.
  * Creates a full copy of User Profiles in the same spreadsheet.
  */
  function backupUserProfilesBeforeIdMigration() {
    const ss = SpreadsheetApp.openById(DIR_SPREADSHEET_ID);
    const src = ss.getSheetByName(SOURCE_SHEET_NAME);
    if (!src) throw new Error('Source sheet not found: ' + SOURCE_SHEET_NAME);

    const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
    const copyName = SOURCE_SHEET_NAME + '_Backup_' + stamp;
    const copy = src.copyTo(ss).setName(copyName);
    ss.setActiveSheet(copy);
    ss.moveActiveSheet(ss.getNumSheets());
    Logger.log('Backup created: ' + copyName);
    return copyName;
  }

  /**
  * One-time migration from legacy/position-based IDs to harmonized IDs.
  * New format: YSPTC-YYXXX
  *
  * Rules:
  * - Keep already-harmonized IDs as-is
  * - Migrate legacy IDs (or empty IDs) to new format
  * - Year suffix uses Date Joined when available, otherwise current year
  * - Sequence is collision-safe per year
  */
  function migrateLegacyIdCodesToHarmonized() {
    const ss = SpreadsheetApp.openById(DIR_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SOURCE_SHEET_NAME);
    if (!sheet) throw new Error('Source sheet not found: ' + SOURCE_SHEET_NAME);

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow < 2 || lastCol < 1) {
      Logger.log('No data rows found for migration.');
      return { success: true, migrated: 0, skipped: 0, message: 'No data rows found.' };
    }

    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const idCol = headers.indexOf('ID Code');
    const usernameCol = headers.indexOf('Username');
    const fullNameCol = headers.indexOf('Full name');
    const dateJoinedCol = headers.indexOf('Date Joined');
    if (idCol === -1) throw new Error("Column 'ID Code' not found in User Profiles");

    const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    const currentYearSuffix = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yy');

    // Build per-year max sequence from existing harmonized IDs.
    const maxSeqByYear = {};
    for (let i = 0; i < data.length; i++) {
      const idValue = String(data[i][idCol] || '').trim();
      const match = idValue.match(/^YSPTC-(\d{2})(\d{3,})$/);
      if (!match) continue;
      const yy = match[1];
      const seq = Number(match[2]);
      if (isNaN(seq)) continue;
      if (!maxSeqByYear[yy] || seq > maxSeqByYear[yy]) {
        maxSeqByYear[yy] = seq;
      }
    }

    let migrated = 0;
    let skipped = 0;
    let untouchedEmptyRows = 0;
    const idWrites = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const existingId = String(row[idCol] || '').trim();
      const username = usernameCol > -1 ? String(row[usernameCol] || '').trim() : '';
      const fullName = fullNameCol > -1 ? String(row[fullNameCol] || '').trim() : '';

      // Skip blank rows
      if (!username && !fullName && !existingId) {
        idWrites.push([existingId]);
        untouchedEmptyRows++;
        continue;
      }

      // Keep already harmonized IDs
      if (/^YSPTC-\d{2}\d{3,}$/.test(existingId)) {
        idWrites.push([existingId]);
        skipped++;
        continue;
      }

      const yy = deriveYearSuffixForMigration_(dateJoinedCol > -1 ? row[dateJoinedCol] : '', currentYearSuffix);
      const nextSeq = (maxSeqByYear[yy] || 0) + 1;
      maxSeqByYear[yy] = nextSeq;
      const newId = 'YSPTC-' + yy + Utilities.formatString('%03d', nextSeq);

      idWrites.push([newId]);
      migrated++;
    }

    // Batch update IDs
    sheet.getRange(2, idCol + 1, idWrites.length, 1).setValues(idWrites);
    // Keep Directory sheet ordering in sync after ID changes.
    refreshDirectory();

    Logger.log('=== ID Migration Complete ===');
    Logger.log('Migrated legacy/missing IDs: ' + migrated);
    Logger.log('Skipped (already harmonized): ' + skipped);
    Logger.log('Untouched blank rows: ' + untouchedEmptyRows);
    Logger.log('Total processed rows: ' + data.length);

    return {
      success: true,
      migrated: migrated,
      skipped: skipped,
      untouchedEmptyRows: untouchedEmptyRows,
      totalRows: data.length
    };
  }

  function deriveYearSuffixForMigration_(value, fallbackYearSuffix) {
    // Native date cell
    if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
      return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yy');
    }

    const raw = String(value || '').trim();
    if (!raw) return fallbackYearSuffix;

    // Try standard Date parsing first
    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) {
      return Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'yy');
    }

    // Fallback: extract 4-digit year (e.g., 2024) from strings
    const yearMatch = raw.match(/\b(20\d{2})\b/);
    if (yearMatch) {
      return yearMatch[1].slice(2);
    }

    return fallbackYearSuffix;
  }

  // =================== 5. SMART CONVERSION HELPERS ===================

  /**
  * Converts input to M or F.
  * Reads: "Male", "Female", "M", "F", "Man", "Woman" (Case Insensitive)
  */
  function convertSex(input) {
    if (!input) return '';
    const s = input.toString().trim().toUpperCase();
    
    if (s.startsWith('M')) return 'M'; // Matches Male, Man, M
    if (s.startsWith('F')) return 'F'; // Matches Female, F
    if (s === 'WOMAN') return 'F';
    if (s === 'BOY') return 'M';
    if (s === 'GIRL') return 'F';
    
    return s; // Fallback: return original if unsure
  }

  /**
  * Converts input to L, G, B, T, Q, I, M, F.
  * Reads full words or codes (Case Insensitive)
  */
  function convertGenderIdentity(input) {
    if (!input) return '';
    const g = input.toString().trim().toUpperCase();
    
    // 1. Check for single letter codes first
    if (['L','G','B','T','Q','I','M','F'].includes(g)) return g;

    // 2. Check for Keywords (Priority Order: LGBTQ+ specific first)
    if (g.includes('LESBIAN')) return 'L';
    if (g.includes('GAY')) return 'G';
    if (g.includes('BISEXUAL') || g === 'BI') return 'B';
    if (g.includes('TRANSGENDER') || g.includes('TRANS')) return 'T';
    if (g.includes('QUEER')) return 'Q';
    if (g.includes('INTERSEX')) return 'I';
    
    // 3. Check for Cisgender terms
    if (g === 'MALE' || g === 'MAN' || g === 'HE/HIM') return 'M';
    if (g === 'FEMALE' || g === 'WOMAN' || g === 'SHE/HER') return 'F';

    return g; // Fallback
  }

  // =================== HELPER: SHEET CREATION ===================

  function ensureDirectorySheetExists(ss) {
    let sheet = ss.getSheetByName(TARGET_SHEET_NAME);
    
    if (!sheet) {
      sheet = ss.insertSheet(TARGET_SHEET_NAME);
      sheet.activate();
      ss.moveActiveSheet(ss.getNumSheets());
    }
    
    const HEADERS = [['POSITION', 'NAME', 'AGE', 'SEX', 'GENDER IDENTITY', 'ADDRESS', 'E-MAIL', 'CONTACT NUMBER']];
    const headerRange = sheet.getRange(1, 1, 1, HEADERS[0].length);
    
    headerRange.setValues(HEADERS)
      .setFontWeight('bold')
      .setBackground('#FF8800')
      .setFontColor('#FFFFFF')
      .setHorizontalAlignment('center');
      
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, HEADERS[0].length);
    
    return sheet;
  }
