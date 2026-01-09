// =================== DIRECTORY SERVICE ===================
// Officer Directory Search - Handler Functions
// Uses the same User Profiles sheet as Login system
// NOTE: This file is part of the same GAS project as Loginpage_Main.gs
// The doPost routing is handled in Loginpage_Main.gs
// ========================================================

// Uses constants from Loginpage_Main.gs:
// - LOGIN_SPREADSHEET_ID
// - LOGIN_SHEET_NAME
// Uses helper functions from Loginpage_Main.gs:
// - createSuccessResponse()
// - createErrorResponse()

// =================== DIRECTORY HANDLERS ===================

/**
 * Search officers by name, ID code, or committee
 * @param {string} query - Search query
 * @returns {TextOutput} JSON response with matching officers
 */
function handleSearchOfficers(query) {
  if (!query || query.trim().length === 0) {
    return createSuccessResponse({
      success: true,
      officers: [],
      total: 0
    });
  }

  try {
    const ss = SpreadsheetApp.openById(LOGIN_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(LOGIN_SHEET_NAME);
    
    if (!sheet) {
      return createErrorResponse('Directory database not found', 500);
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idx = buildDirectoryColumnIndex(headers);

    const queryLower = query.toLowerCase().trim();
    const matchingOfficers = [];

    // Search through all rows (skip header row)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // Skip invalid/empty rows
      if (!row[idx.fullName] && !row[idx.idCode]) continue;
      
      // Skip suspended and banned users from directory search
      const status = getDirectoryValue(row, idx.status).toLowerCase();
      const role = getDirectoryValue(row, idx.role).toLowerCase();
      if (status === 'banned' || status === 'suspended' || role === 'banned' || role === 'suspended') {
        continue;
      }

      // Search in multiple fields
      const fullName = getDirectoryValue(row, idx.fullName).toLowerCase();
      const idCode = getDirectoryValue(row, idx.idCode).toLowerCase();
      const committee = getDirectoryValue(row, idx.committee).toLowerCase();
      const position = getDirectoryValue(row, idx.position).toLowerCase();
      const email = getDirectoryValue(row, idx.email).toLowerCase();

      // Check if query matches any searchable field
      if (
        fullName.includes(queryLower) ||
        idCode.includes(queryLower) ||
        committee.includes(queryLower) ||
        position.includes(queryLower) ||
        email.includes(queryLower)
      ) {
        const officer = buildOfficerObject(row, idx);
        matchingOfficers.push(officer);
      }

      // Limit results to prevent performance issues
      if (matchingOfficers.length >= 20) break;
    }

    return createSuccessResponse({
      success: true,
      officers: matchingOfficers,
      total: matchingOfficers.length
    });

  } catch (error) {
    Logger.log('handleSearchOfficers Error: ' + error.toString());
    return createErrorResponse('Search failed: ' + error.message, 500);
  }
}

/**
 * Get officer details by ID Code
 * @param {string} idCode - Officer ID Code
 * @returns {TextOutput} JSON response with officer details
 */
function handleGetOfficerByIdCode(idCode) {
  if (!idCode || idCode.trim().length === 0) {
    return createErrorResponse('ID Code is required', 400);
  }

  try {
    const ss = SpreadsheetApp.openById(LOGIN_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(LOGIN_SHEET_NAME);
    
    if (!sheet) {
      return createErrorResponse('Directory database not found', 500);
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idx = buildDirectoryColumnIndex(headers);

    const idCodeLower = idCode.toLowerCase().trim();

    // Search for officer by exact ID Code match
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowIdCode = getDirectoryValue(row, idx.idCode).toLowerCase().trim();

      if (rowIdCode === idCodeLower) {
        // Check if officer is banned/suspended
        const status = getDirectoryValue(row, idx.status).toLowerCase();
        const role = getDirectoryValue(row, idx.role).toLowerCase();
        if (status === 'banned' || role === 'banned') {
          return createErrorResponse('This officer profile is not available', 404);
        }

        const officer = buildOfficerObject(row, idx);
        return createSuccessResponse({
          success: true,
          officer: officer
        });
      }
    }

    return createErrorResponse('Officer not found', 404);

  } catch (error) {
    Logger.log('handleGetOfficerByIdCode Error: ' + error.toString());
    return createErrorResponse('Failed to fetch officer: ' + error.message, 500);
  }
}

/**
 * Get all officers (paginated)
 * @param {number} page - Page number (1-indexed)
 * @param {number} limit - Number of officers per page
 * @returns {TextOutput} JSON response with officers list
 */
function handleGetAllOfficers(page, limit) {
  const pageNum = parseInt(page) || 1;
  const pageLimit = Math.min(parseInt(limit) || 50, 100); // Max 100 per page

  try {
    const ss = SpreadsheetApp.openById(LOGIN_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(LOGIN_SHEET_NAME);
    
    if (!sheet) {
      return createErrorResponse('Directory database not found', 500);
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idx = buildDirectoryColumnIndex(headers);

    const allOfficers = [];

    // Collect all valid officers (skip header row)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // Skip invalid/empty rows
      if (!row[idx.fullName] && !row[idx.idCode]) continue;
      
      // Skip suspended and banned users
      const status = getDirectoryValue(row, idx.status).toLowerCase();
      const role = getDirectoryValue(row, idx.role).toLowerCase();
      if (status === 'banned' || status === 'suspended' || role === 'banned' || role === 'suspended') {
        continue;
      }

      const officer = buildOfficerObject(row, idx);
      allOfficers.push(officer);
    }

    // Calculate pagination
    const totalOfficers = allOfficers.length;
    const totalPages = Math.ceil(totalOfficers / pageLimit);
    const startIndex = (pageNum - 1) * pageLimit;
    const endIndex = Math.min(startIndex + pageLimit, totalOfficers);
    const paginatedOfficers = allOfficers.slice(startIndex, endIndex);

    return createSuccessResponse({
      success: true,
      officers: paginatedOfficers,
      pagination: {
        page: pageNum,
        limit: pageLimit,
        total: totalOfficers,
        totalPages: totalPages,
        hasMore: pageNum < totalPages
      }
    });

  } catch (error) {
    Logger.log('handleGetAllOfficers Error: ' + error.toString());
    return createErrorResponse('Failed to fetch officers: ' + error.message, 500);
  }
}

// =================== HELPER FUNCTIONS ===================

/**
 * Build column index mapping from headers for Directory
 * Column mapping based on User Profiles sheet structure:
 * A=Timestamp, B=Email Address, C=(unused), D=Full name, ...
 * N=Username, O=Password, P=..., S=ID Code, T=Position, U=Role, V=ProfilePictureURL
 * ... continuing to other columns like Committee, Status, Contact info, etc.
 */
function buildDirectoryColumnIndex(headers) {
  const idx = {};
  headers.forEach((header, i) => {
    // Map header names to indices
    switch(header) {
      case 'Timestamp': idx.timestamp = i; break;
      case 'Email Address': idx.email = i; break;
      case 'Full name': idx.fullName = i; break;
      case 'Username': idx.username = i; break;
      case 'Password': idx.password = i; break;
      case 'ID Code': idx.idCode = i; break;
      case 'Position': idx.position = i; break;
      case 'Role': idx.role = i; break;
      case 'ProfilePictureURL': idx.profilePic = i; break;
      case 'Status': idx.status = i; break;
      case 'Committee': idx.committee = i; break;
      case 'Contact Number': idx.contactNumber = i; break;
      case 'Date of Birth': idx.birthday = i; break;
      case 'Age': idx.age = i; break;
      case 'Sex/Gender': idx.gender = i; break;
      case 'Civil Status': idx.civilStatus = i; break;
      case 'Nationality': idx.nationality = i; break;
      case 'Religion': idx.religion = i; break;
      case 'Pronouns': idx.pronouns = i; break;
      case 'Personal Email Address': idx.personalEmail = i; break;
      case 'Address': idx.address = i; break;
      case 'Barangay': idx.barangay = i; break;
      case 'City': idx.city = i; break;
      case 'Province': idx.province = i; break;
      case 'Zip Code': idx.zipCode = i; break;
      case 'Chapter': idx.chapter = i; break;
      case 'Date Joined': idx.dateJoined = i; break;
      case 'Membership Type': idx.membershipType = i; break;
      case 'Facebook': idx.facebook = i; break;
      case 'Instagram': idx.instagram = i; break;
      case 'Twitter': idx.twitter = i; break;
      case 'Emergency Contact Name': idx.emergencyContactName = i; break;
      case 'Emergency Contact Relation': idx.emergencyContactRelation = i; break;
      case 'Emergency Contact Number': idx.emergencyContactNumber = i; break;
    }
  });
  return idx;
}

/**
 * Safely get value from row (Directory version)
 */
function getDirectoryValue(row, colIdx) {
  if (colIdx === undefined || colIdx === null || colIdx < 0) return '';
  const rawValue = row[colIdx];
  
  // Handle Date objects
  if (rawValue instanceof Date) {
    const year = rawValue.getFullYear();
    // If year is unreasonably large, it might be a number like zip code
    if (year > 2100) {
      return year.toString();
    }
  }
  
  return (rawValue || '').toString();
}

/**
 * Format date value (Directory version)
 */
function formatDirectoryDate(dateValue) {
  if (!dateValue) return '';
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return dateValue.toString();
    return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  } catch (e) {
    return dateValue.toString();
  }
}

/**
 * Calculate age from birthday (Directory version)
 */
function calculateDirectoryAge(birthday) {
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
}

/**
 * Build officer object from row data
 * Returns a sanitized officer object for directory display
 * NOTE: Sensitive data like password is NOT included
 */
function buildOfficerObject(row, idx) {
  const birthdayRaw = idx.birthday !== undefined ? row[idx.birthday] : '';
  const birthdayFormatted = formatDirectoryDate(birthdayRaw);
  const ageValue = idx.age !== undefined ? parseInt(getDirectoryValue(row, idx.age)) : 0;
  const calculatedAge = ageValue || calculateDirectoryAge(birthdayRaw);

  return {
    // Core identification
    idCode: getDirectoryValue(row, idx.idCode),
    fullName: getDirectoryValue(row, idx.fullName),
    
    // YSP Role Info
    position: getDirectoryValue(row, idx.position),
    committee: getDirectoryValue(row, idx.committee),
    role: getDirectoryValue(row, idx.role),
    status: getDirectoryValue(row, idx.status),
    chapter: getDirectoryValue(row, idx.chapter),
    dateJoined: formatDirectoryDate(idx.dateJoined !== undefined ? row[idx.dateJoined] : ''),
    membershipType: getDirectoryValue(row, idx.membershipType),
    
    // Contact Info
    email: getDirectoryValue(row, idx.email),
    personalEmail: getDirectoryValue(row, idx.personalEmail),
    contactNumber: getDirectoryValue(row, idx.contactNumber),
    
    // Personal Info
    birthday: birthdayFormatted,
    age: calculatedAge,
    gender: getDirectoryValue(row, idx.gender),
    pronouns: getDirectoryValue(row, idx.pronouns),
    civilStatus: getDirectoryValue(row, idx.civilStatus),
    nationality: getDirectoryValue(row, idx.nationality),
    religion: getDirectoryValue(row, idx.religion),
    
    // Profile Picture
    profilePicture: getDirectoryValue(row, idx.profilePic),
    
    // Social Media (optional for directory)
    facebook: getDirectoryValue(row, idx.facebook),
    instagram: getDirectoryValue(row, idx.instagram),
    twitter: getDirectoryValue(row, idx.twitter),
  };
}

// =================== TESTING FUNCTIONS ===================
// Note: createSuccessResponse and createErrorResponse are defined in Loginpage_Main.gs

/**
 * Test function to verify sheet access and column mapping
 * Run this in GAS editor to debug
 */
function testDirectoryAccess() {
  Logger.log('=== Testing Directory Access ===');
  
  try {
    const ss = SpreadsheetApp.openById(LOGIN_SPREADSHEET_ID);
    Logger.log('✅ Spreadsheet access: ' + ss.getName());
    
    const sheet = ss.getSheetByName(LOGIN_SHEET_NAME);
    Logger.log('✅ Sheet access: ' + sheet.getName());
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    Logger.log('Headers: ' + headers.join(', '));
    
    const idx = buildDirectoryColumnIndex(headers);
    Logger.log('Column mapping:');
    Logger.log('  Full name: ' + idx.fullName);
    Logger.log('  ID Code: ' + idx.idCode);
    Logger.log('  Committee: ' + idx.committee);
    Logger.log('  Position: ' + idx.position);
    Logger.log('  Role: ' + idx.role);
    Logger.log('  Status: ' + idx.status);
    
    const rowCount = sheet.getLastRow() - 1; // Exclude header
    Logger.log('Total users: ' + rowCount);
    
    Logger.log('=== Test Complete ===');
  } catch (e) {
    Logger.log('❌ Error: ' + e.toString());
  }
}

/**
 * Test search functionality
 */
function testDirectorySearch() {
  // Test the handleSearchOfficers function directly
  const response = handleSearchOfficers('admin');
  Logger.log('Search result: ' + response.getContent());
}
