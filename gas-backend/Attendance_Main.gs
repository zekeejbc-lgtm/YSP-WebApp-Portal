/**
 * =====================================================
 * YSP TAGUM - ATTENDANCE RECORDING SYSTEM
 * Google Apps Script Backend
 * =====================================================
 * 
 * This script handles all attendance recording operations
 * for the YSP Tagum WebApp including:
 * - Time In / Time Out recording
 * - Geofence validation
 * - Attendance history lookup
 * - Member lookup for manual attendance
 * 
 * USES SAME SPREADSHEET AS Attendance_Events.gs
 * Sheet: EventAttendance
 * 
 * @author YSP Tagum Development Team
 * @version 1.0.0
 * @lastUpdated 2026-01-10
 */

// =====================================================
// CONFIGURATION
// =====================================================

/**
 * Get the Events Spreadsheet ID (same as Attendance_Events.gs)
 */
function getAttendanceSpreadsheetId() {
  return '1Xn7w9kzNrP6dmZXYXjxaO11Lmao79wn9w1SPCiqFtcA';
}

/**
 * Get the Login Spreadsheet ID (for member lookup)
 * Uses the same spreadsheet as Loginpage_Main.gs and Directory_Main.gs
 * This contains the User Profiles sheet with all member data
 */
function getLoginSpreadsheetId() {
  return '1vaQZoPq5a_verhICIiWXudBjAmfgFSIbaBX5xt9kjMk';
}

// =====================================================
// WEB APP ENTRY POINTS FOR ATTENDANCE
// =====================================================

/**
 * Handle GET requests for attendance
 */
function doGetAttendance(e) {
  const params = e.parameter;
  const action = params.action;
  
  let result;
  
  try {
    switch (action) {
      case 'getEventAttendanceRecords':
        result = getEventAttendanceRecords(params.eventId);
        break;
      case 'getMemberAttendanceHistory':
        result = getMemberAttendanceHistory(params.memberId, params.limit);
        break;
      case 'checkExistingAttendance':
        result = checkExistingAttendance(params.eventId, params.memberId);
        break;
      case 'getMembersForAttendance':
        result = getMembersForAttendance(params.search, params.limit);
        break;
      case 'validateGeofence':
        result = validateGeofence(params.eventId, params.lat, params.lng);
        break;
      default:
        result = { success: false, error: 'Invalid attendance action' };
    }
  } catch (error) {
    result = { success: false, error: error.toString() };
  }
  
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handle POST requests for attendance
 */
function doPostAttendance(e) {
  let params;
  
  try {
    params = JSON.parse(e.postData.contents);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: 'Invalid JSON payload' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  const action = params.action;
  let result;
  
  try {
    switch (action) {
      case 'recordTimeIn':
        result = recordTimeIn(params);
        break;
      case 'recordTimeOut':
        result = recordTimeOut(params);
        break;
      case 'recordManualAttendance':
        result = recordManualAttendance(params);
        break;
      case 'updateAttendanceStatus':
        result = updateAttendanceStatus(params.attendanceId, params.status, params.notes);
        break;
      default:
        result = { success: false, error: 'Invalid attendance action' };
    }
  } catch (error) {
    result = { success: false, error: error.toString() };
  }
  
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// =====================================================
// ATTENDANCE RECORDING FUNCTIONS
// =====================================================

/**
 * Record Time In for a member
 * @param {Object} params - { eventId, memberId, memberName, status, location: { lat, lng }, recordedBy }
 */
function recordTimeIn(params) {
  try {
    const { eventId, memberId, memberName, status, location, recordedBy } = params;
    
    if (!eventId || !memberId) {
      return { success: false, error: 'Event ID and Member ID are required' };
    }
    
    const ss = SpreadsheetApp.openById(getAttendanceSpreadsheetId());
    const sheet = ss.getSheetByName('EventAttendance');
    
    if (!sheet) {
      return { success: false, error: 'EventAttendance sheet not found' };
    }
    
    const now = new Date();
    const nowISO = now.toISOString();
    const timeString = Utilities.formatDate(now, 'Asia/Manila', 'hh:mm a');
    const dateString = Utilities.formatDate(now, 'Asia/Manila', 'yyyy-MM-dd');
    
    // Check for existing record
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    for (let i = 1; i < data.length; i++) {
      const rowEventId = data[i][headers.indexOf('EventID')];
      const rowMemberId = data[i][headers.indexOf('MemberID')];
      const rowDate = data[i][headers.indexOf('AttendanceDate')];
      
      // Check if same event, member, and date
      if (rowEventId === eventId && rowMemberId === memberId) {
        const existingDate = rowDate ? Utilities.formatDate(new Date(rowDate), 'Asia/Manila', 'yyyy-MM-dd') : '';
        
        if (existingDate === dateString) {
          // Already has a record for today - return existing record info
          return {
            success: false,
            error: 'EXISTING_RECORD',
            existingRecord: {
              attendanceId: data[i][headers.indexOf('AttendanceID')],
              timeIn: data[i][headers.indexOf('TimeIn')],
              timeOut: data[i][headers.indexOf('TimeOut')],
              status: data[i][headers.indexOf('Status')],
              date: existingDate
            },
            message: 'Member already has a Time In record for this event today'
          };
        }
      }
    }
    
    // Generate new attendance ID
    const attendanceId = 'ATT' + Date.now() + Math.random().toString(36).substr(2, 4).toUpperCase();
    
    // Validate geofence if location provided
    let geofenceValid = true;
    let geofenceMessage = '';
    
    if (location && location.lat && location.lng) {
      const geofenceResult = validateGeofenceInternal(eventId, location.lat, location.lng);
      geofenceValid = geofenceResult.valid;
      geofenceMessage = geofenceResult.message;
    }
    
    // Prepare new row
    const newRow = [
      attendanceId,                    // AttendanceID
      eventId,                         // EventID
      memberId,                        // MemberID
      memberName || '',                // MemberName
      status || 'Present',             // Status
      timeString,                      // TimeIn
      '',                              // TimeOut
      dateString,                      // AttendanceDate
      location ? `${location.lat},${location.lng}` : '', // Location
      geofenceValid ? 'Valid' : 'Outside Geofence',      // GeofenceStatus
      '',                              // Notes
      recordedBy || '',                // RecordedBy
      nowISO                           // RecordedAt
    ];
    
    sheet.appendRow(newRow);
    
    // Update event attendee count
    updateEventAttendeeCount(eventId);
    
    return {
      success: true,
      message: 'Time In recorded successfully',
      attendanceId: attendanceId,
      timeIn: timeString,
      date: dateString,
      geofenceValid: geofenceValid,
      geofenceMessage: geofenceMessage
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Record Time Out for a member
 * @param {Object} params - { eventId, memberId, location: { lat, lng }, recordedBy }
 */
function recordTimeOut(params) {
  try {
    const { eventId, memberId, location, recordedBy } = params;
    
    if (!eventId || !memberId) {
      return { success: false, error: 'Event ID and Member ID are required' };
    }
    
    const ss = SpreadsheetApp.openById(getAttendanceSpreadsheetId());
    const sheet = ss.getSheetByName('EventAttendance');
    
    if (!sheet) {
      return { success: false, error: 'EventAttendance sheet not found' };
    }
    
    const now = new Date();
    const timeString = Utilities.formatDate(now, 'Asia/Manila', 'hh:mm a');
    const dateString = Utilities.formatDate(now, 'Asia/Manila', 'yyyy-MM-dd');
    
    // Find existing Time In record for today
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    for (let i = 1; i < data.length; i++) {
      const rowEventId = data[i][headers.indexOf('EventID')];
      const rowMemberId = data[i][headers.indexOf('MemberID')];
      const rowDate = data[i][headers.indexOf('AttendanceDate')];
      const rowTimeOut = data[i][headers.indexOf('TimeOut')];
      
      if (rowEventId === eventId && rowMemberId === memberId) {
        const existingDate = rowDate ? Utilities.formatDate(new Date(rowDate), 'Asia/Manila', 'yyyy-MM-dd') : '';
        
        if (existingDate === dateString) {
          // Found today's record
          if (rowTimeOut && rowTimeOut.toString().trim() !== '') {
            return {
              success: false,
              error: 'ALREADY_TIMED_OUT',
              existingTimeOut: rowTimeOut,
              message: 'Member has already timed out for this event today'
            };
          }
          
          // Update Time Out
          const rowIndex = i + 1;
          sheet.getRange(rowIndex, headers.indexOf('TimeOut') + 1).setValue(timeString);
          
          // Update location if provided
          if (location && location.lat && location.lng) {
            const existingLocation = data[i][headers.indexOf('Location')] || '';
            const newLocation = existingLocation + ' | Out: ' + `${location.lat},${location.lng}`;
            sheet.getRange(rowIndex, headers.indexOf('Location') + 1).setValue(newLocation);
          }
          
          return {
            success: true,
            message: 'Time Out recorded successfully',
            attendanceId: data[i][headers.indexOf('AttendanceID')],
            timeIn: data[i][headers.indexOf('TimeIn')],
            timeOut: timeString,
            date: dateString
          };
        }
      }
    }
    
    return {
      success: false,
      error: 'NO_TIME_IN',
      message: 'No Time In record found for this member today. Please record Time In first.'
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Record manual attendance (for admin/officer use)
 * @param {Object} params - { eventId, memberId, memberName, status, timeType, notes, recordedBy }
 */
function recordManualAttendance(params) {
  try {
    const { eventId, memberId, memberName, status, timeType, notes, recordedBy, overwrite } = params;
    
    if (!eventId || !memberId || !status) {
      return { success: false, error: 'Event ID, Member ID, and Status are required' };
    }
    
    const ss = SpreadsheetApp.openById(getAttendanceSpreadsheetId());
    const sheet = ss.getSheetByName('EventAttendance');
    
    if (!sheet) {
      return { success: false, error: 'EventAttendance sheet not found' };
    }
    
    const now = new Date();
    const nowISO = now.toISOString();
    const timeString = Utilities.formatDate(now, 'Asia/Manila', 'hh:mm a');
    const dateString = Utilities.formatDate(now, 'Asia/Manila', 'yyyy-MM-dd');
    
    // Check for existing record
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    for (let i = 1; i < data.length; i++) {
      const rowEventId = data[i][headers.indexOf('EventID')];
      const rowMemberId = data[i][headers.indexOf('MemberID')];
      const rowDate = data[i][headers.indexOf('AttendanceDate')];
      
      if (rowEventId === eventId && rowMemberId === memberId) {
        const existingDate = rowDate ? Utilities.formatDate(new Date(rowDate), 'Asia/Manila', 'yyyy-MM-dd') : '';
        
        if (existingDate === dateString) {
          if (!overwrite) {
            // Return existing record for confirmation
            return {
              success: false,
              error: 'EXISTING_RECORD',
              existingRecord: {
                attendanceId: data[i][headers.indexOf('AttendanceID')],
                timeIn: data[i][headers.indexOf('TimeIn')],
                timeOut: data[i][headers.indexOf('TimeOut')],
                status: data[i][headers.indexOf('Status')],
                date: existingDate
              },
              message: 'Member already has an attendance record for this event today. Set overwrite=true to update.'
            };
          }
          
          // Overwrite existing record
          const rowIndex = i + 1;
          sheet.getRange(rowIndex, headers.indexOf('Status') + 1).setValue(status);
          
          if (timeType === 'in') {
            sheet.getRange(rowIndex, headers.indexOf('TimeIn') + 1).setValue(timeString);
          } else if (timeType === 'out') {
            sheet.getRange(rowIndex, headers.indexOf('TimeOut') + 1).setValue(timeString);
          }
          
          if (notes) {
            sheet.getRange(rowIndex, headers.indexOf('Notes') + 1).setValue(notes);
          }
          
          sheet.getRange(rowIndex, headers.indexOf('RecordedBy') + 1).setValue(recordedBy || '');
          sheet.getRange(rowIndex, headers.indexOf('RecordedAt') + 1).setValue(nowISO);
          
          return {
            success: true,
            message: 'Attendance record updated successfully',
            attendanceId: data[i][headers.indexOf('AttendanceID')],
            updated: true
          };
        }
      }
    }
    
    // Create new record
    const attendanceId = 'ATT' + Date.now() + Math.random().toString(36).substr(2, 4).toUpperCase();
    
    const newRow = [
      attendanceId,
      eventId,
      memberId,
      memberName || '',
      status,
      timeType === 'in' || timeType === 'both' ? timeString : '',
      timeType === 'out' ? timeString : '',
      dateString,
      'Manual Entry',
      'N/A',
      notes || '',
      recordedBy || '',
      nowISO
    ];
    
    sheet.appendRow(newRow);
    updateEventAttendeeCount(eventId);
    
    return {
      success: true,
      message: 'Attendance recorded successfully',
      attendanceId: attendanceId,
      created: true
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// =====================================================
// ATTENDANCE LOOKUP FUNCTIONS
// =====================================================

/**
 * Get all attendance records for an event
 */
function getEventAttendanceRecords(eventId) {
  try {
    if (!eventId) {
      return { success: false, error: 'Event ID is required' };
    }
    
    const ss = SpreadsheetApp.openById(getAttendanceSpreadsheetId());
    const sheet = ss.getSheetByName('EventAttendance');
    
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true, records: [], total: 0 };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const records = [];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][headers.indexOf('EventID')] === eventId) {
        records.push({
          attendanceId: data[i][headers.indexOf('AttendanceID')],
          eventId: data[i][headers.indexOf('EventID')],
          memberId: data[i][headers.indexOf('MemberID')],
          memberName: data[i][headers.indexOf('MemberName')],
          status: data[i][headers.indexOf('Status')],
          timeIn: data[i][headers.indexOf('TimeIn')],
          timeOut: data[i][headers.indexOf('TimeOut')],
          date: data[i][headers.indexOf('AttendanceDate')],
          geofenceStatus: data[i][headers.indexOf('GeofenceStatus')],
          notes: data[i][headers.indexOf('Notes')],
          recordedBy: data[i][headers.indexOf('RecordedBy')],
          recordedAt: data[i][headers.indexOf('RecordedAt')]
        });
      }
    }
    
    return {
      success: true,
      records: records,
      total: records.length
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Check if member already has attendance record for event today
 */
function checkExistingAttendance(eventId, memberId) {
  try {
    if (!eventId || !memberId) {
      return { success: false, error: 'Event ID and Member ID are required' };
    }
    
    const ss = SpreadsheetApp.openById(getAttendanceSpreadsheetId());
    const sheet = ss.getSheetByName('EventAttendance');
    
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true, exists: false };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const today = Utilities.formatDate(new Date(), 'Asia/Manila', 'yyyy-MM-dd');
    
    for (let i = 1; i < data.length; i++) {
      const rowEventId = data[i][headers.indexOf('EventID')];
      const rowMemberId = data[i][headers.indexOf('MemberID')];
      const rowDate = data[i][headers.indexOf('AttendanceDate')];
      
      if (rowEventId === eventId && rowMemberId === memberId) {
        const recordDate = rowDate ? Utilities.formatDate(new Date(rowDate), 'Asia/Manila', 'yyyy-MM-dd') : '';
        
        if (recordDate === today) {
          return {
            success: true,
            exists: true,
            record: {
              attendanceId: data[i][headers.indexOf('AttendanceID')],
              timeIn: data[i][headers.indexOf('TimeIn')],
              timeOut: data[i][headers.indexOf('TimeOut')],
              status: data[i][headers.indexOf('Status')],
              date: recordDate
            }
          };
        }
      }
    }
    
    return { success: true, exists: false };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Get member attendance history
 */
function getMemberAttendanceHistory(memberId, limit) {
  try {
    if (!memberId) {
      return { success: false, error: 'Member ID is required' };
    }
    
    const ss = SpreadsheetApp.openById(getAttendanceSpreadsheetId());
    const sheet = ss.getSheetByName('EventAttendance');
    
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true, records: [], total: 0 };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const records = [];
    const maxRecords = parseInt(limit) || 50;
    
    for (let i = data.length - 1; i >= 1 && records.length < maxRecords; i--) {
      if (data[i][headers.indexOf('MemberID')] === memberId) {
        records.push({
          attendanceId: data[i][headers.indexOf('AttendanceID')],
          eventId: data[i][headers.indexOf('EventID')],
          status: data[i][headers.indexOf('Status')],
          timeIn: data[i][headers.indexOf('TimeIn')],
          timeOut: data[i][headers.indexOf('TimeOut')],
          date: data[i][headers.indexOf('AttendanceDate')],
          notes: data[i][headers.indexOf('Notes')]
        });
      }
    }
    
    return {
      success: true,
      records: records,
      total: records.length
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// =====================================================
// GEOFENCE VALIDATION
// =====================================================

/**
 * Validate if location is within event geofence
 */
function validateGeofence(eventId, lat, lng) {
  const result = validateGeofenceInternal(eventId, parseFloat(lat), parseFloat(lng));
  return {
    success: true,
    valid: result.valid,
    message: result.message,
    distance: result.distance,
    radius: result.radius
  };
}

/**
 * Internal geofence validation
 */
function validateGeofenceInternal(eventId, lat, lng) {
  try {
    const ss = SpreadsheetApp.openById(getAttendanceSpreadsheetId());
    const eventsSheet = ss.getSheetByName('Events');
    
    if (!eventsSheet || eventsSheet.getLastRow() < 2) {
      return { valid: true, message: 'No geofence configured' };
    }
    
    const data = eventsSheet.getDataRange().getValues();
    const headers = data[0];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][headers.indexOf('EventID')] === eventId) {
        const eventLat = parseFloat(data[i][headers.indexOf('Latitude')]);
        const eventLng = parseFloat(data[i][headers.indexOf('Longitude')]);
        const radius = parseFloat(data[i][headers.indexOf('Radius')]) || 100;
        
        if (!eventLat || !eventLng || isNaN(eventLat) || isNaN(eventLng)) {
          return { valid: true, message: 'No geofence configured for this event' };
        }
        
        // Calculate distance using Haversine formula
        const distance = calculateDistance(lat, lng, eventLat, eventLng);
        
        if (distance <= radius) {
          return {
            valid: true,
            message: 'Within geofence',
            distance: Math.round(distance),
            radius: radius
          };
        } else {
          return {
            valid: false,
            message: `Outside geofence by ${Math.round(distance - radius)} meters`,
            distance: Math.round(distance),
            radius: radius
          };
        }
      }
    }
    
    return { valid: true, message: 'Event not found' };
  } catch (error) {
    return { valid: true, message: 'Geofence validation error: ' + error.toString() };
  }
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

// =====================================================
// MEMBER LOOKUP FOR ATTENDANCE
// =====================================================

/**
 * Get members for attendance dropdown
 * Uses the same User Profiles sheet as Directory_Main.gs
 * Filters for active members only
 */
function getMembersForAttendance(search, limit) {
  try {
    const ss = SpreadsheetApp.openById(getLoginSpreadsheetId());
    const sheet = ss.getSheetByName('User Profiles');
    
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true, members: [], total: 0 };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // Build column index (same as Directory_Main.gs)
    const idx = {};
    headers.forEach((header, i) => {
      switch(header) {
        case 'Full name': idx.fullName = i; break;
        case 'ID Code': idx.idCode = i; break;
        case 'Committee': idx.committee = i; break;
        case 'Position': idx.position = i; break;
        case 'Status': idx.status = i; break;
        case 'Role': idx.role = i; break;
        case 'ProfilePictureURL': idx.profilePic = i; break;
      }
    });
    
    const members = [];
    const maxResults = parseInt(limit) || 50;
    const searchLower = (search || '').toLowerCase();
    
    for (let i = 1; i < data.length && members.length < maxResults; i++) {
      const row = data[i];
      
      // Skip if no name or ID code
      if (!row[idx.fullName] && !row[idx.idCode]) continue;
      
      // Only include active members (skip banned/suspended)
      const status = (row[idx.status] || '').toString().toLowerCase();
      const role = (row[idx.role] || '').toString().toLowerCase();
      
      if (status === 'banned' || status === 'suspended' || role === 'banned' || role === 'suspended') {
        continue;
      }
      
      // If status is explicitly inactive, skip
      if (status === 'inactive' || status === 'archived') {
        continue;
      }
      
      const fullName = (row[idx.fullName] || '').toString().toLowerCase();
      const idCode = (row[idx.idCode] || '').toString().toLowerCase();
      const committee = (row[idx.committee] || '').toString().toLowerCase();
      
      // Apply search filter
      if (searchLower && 
          !fullName.includes(searchLower) &&
          !idCode.includes(searchLower) &&
          !committee.includes(searchLower)) {
        continue;
      }
      
      members.push({
        id: (row[idx.idCode] || '').toString(),
        name: (row[idx.fullName] || '').toString(),
        committee: (row[idx.committee] || '').toString(),
        position: (row[idx.position] || '').toString(),
        profilePicture: (row[idx.profilePic] || '').toString(),
        status: status
      });
    }
    
    return {
      success: true,
      members: members,
      total: members.length
    };
  } catch (error) {
    Logger.log('getMembersForAttendance Error: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Update event attendee count
 */
function updateEventAttendeeCount(eventId) {
  try {
    const ss = SpreadsheetApp.openById(getAttendanceSpreadsheetId());
    const eventsSheet = ss.getSheetByName('Events');
    const attendanceSheet = ss.getSheetByName('EventAttendance');
    
    if (!eventsSheet || !attendanceSheet) return;
    
    // Count unique attendees for this event
    const attendanceData = attendanceSheet.getDataRange().getValues();
    const attendanceHeaders = attendanceData[0];
    const uniqueMembers = new Set();
    
    for (let i = 1; i < attendanceData.length; i++) {
      if (attendanceData[i][attendanceHeaders.indexOf('EventID')] === eventId) {
        const status = attendanceData[i][attendanceHeaders.indexOf('Status')];
        if (status === 'Present' || status === 'Late' || status === 'CheckedIn') {
          uniqueMembers.add(attendanceData[i][attendanceHeaders.indexOf('MemberID')]);
        }
      }
    }
    
    // Update event record
    const eventsData = eventsSheet.getDataRange().getValues();
    const eventsHeaders = eventsData[0];
    
    for (let i = 1; i < eventsData.length; i++) {
      if (eventsData[i][eventsHeaders.indexOf('EventID')] === eventId) {
        const rowIndex = i + 1;
        const colIndex = eventsHeaders.indexOf('CurrentAttendees') + 1;
        eventsSheet.getRange(rowIndex, colIndex).setValue(uniqueMembers.size);
        break;
      }
    }
  } catch (error) {
    Logger.log('Error updating attendee count: ' + error.toString());
  }
}

/**
 * Update attendance status for an existing record
 * @param {string} attendanceId - The attendance record ID
 * @param {string} status - New status (Present, Late, Absent, Excused)
 * @param {string} notes - Optional notes
 */
function updateAttendanceStatus(attendanceId, status, notes) {
  try {
    if (!attendanceId || !status) {
      return { success: false, error: 'Attendance ID and Status are required' };
    }
    
    const ss = SpreadsheetApp.openById(getAttendanceSpreadsheetId());
    const sheet = ss.getSheetByName('EventAttendance');
    
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: false, error: 'No attendance records found' };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][headers.indexOf('AttendanceID')] === attendanceId) {
        const rowIndex = i + 1;
        
        // Update status
        sheet.getRange(rowIndex, headers.indexOf('Status') + 1).setValue(status);
        
        // Update notes if provided
        if (notes !== undefined && notes !== null) {
          const existingNotes = data[i][headers.indexOf('Notes')] || '';
          const updatedNotes = existingNotes 
            ? `${existingNotes} | ${notes}` 
            : notes;
          sheet.getRange(rowIndex, headers.indexOf('Notes') + 1).setValue(updatedNotes);
        }
        
        // Update timestamp
        sheet.getRange(rowIndex, headers.indexOf('RecordedAt') + 1).setValue(new Date().toISOString());
        
        return {
          success: true,
          message: 'Attendance status updated successfully',
          attendanceId: attendanceId,
          status: status
        };
      }
    }
    
    return { success: false, error: 'Attendance record not found' };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Initialize EventAttendance sheet with proper headers
 * (Call this if the sheet doesn't have the right columns)
 */
function initializeAttendanceSheet() {
  try {
    const ss = SpreadsheetApp.openById(getAttendanceSpreadsheetId());
    let sheet = ss.getSheetByName('EventAttendance');
    
    if (!sheet) {
      sheet = ss.insertSheet('EventAttendance');
    }
    
    // Set headers
    const headers = [
      'AttendanceID',
      'EventID',
      'MemberID',
      'MemberName',
      'Status',
      'TimeIn',
      'TimeOut',
      'AttendanceDate',
      'Location',
      'GeofenceStatus',
      'Notes',
      'RecordedBy',
      'RecordedAt'
    ];
    
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    
    return { success: true, message: 'EventAttendance sheet initialized' };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}
