/**
 * =====================================================
 * YSP - ATTENDANCE RECORDING SYSTEM
 * Google Apps Script Backend
 * =====================================================
 * 
 * This script handles all attendance recording operations
 * for the YSP WebApp including:
 * - Time In / Time Out recording
 * - Geofence validation
 * - Attendance history lookup
 * - Member lookup for manual attendance
 * 
 * USES SAME SPREADSHEET AS Attendance_Events.gs
 * Sheet: EventAttendance
 * 
 * @author YSP Development Team
 * @version 1.0.0
 * @lastUpdated 2026-01-10
 */

// =====================================================
// CONFIGURATION
// =====================================================

/**
 * Get the Events Spreadsheet ID from PropertiesService
 * Set EVENTS_SPREADSHEET_ID in Script Properties
 */
function getAttendanceSpreadsheetId() {
  return PropertiesService.getScriptProperties().getProperty('EVENTS_SPREADSHEET_ID') || '';
}

/**
 * Get the Login Spreadsheet ID from PropertiesService
 * Set LOGIN_SPREADSHEET_ID in Script Properties
 */
function getLoginSpreadsheetId() {
  return PropertiesService.getScriptProperties().getProperty('LOGIN_SPREADSHEET_ID') || '';
}

// =====================================================
// INPUT VALIDATION HELPERS
// =====================================================

/**
 * Sanitize a string parameter: trim, enforce max length, strip control chars
 * @param {string} value - Raw input
 * @param {number} [maxLen=200] - Maximum allowed length
 * @returns {string} Sanitized string or empty string
 */
function sanitizeAttendanceParam_(value, maxLen) {
  if (value === null || value === undefined) return '';
  var str = String(value).trim();
  // Strip control characters (allow newlines/tabs for notes)
  str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  var limit = maxLen || 200;
  if (str.length > limit) str = str.substring(0, limit);
  return str;
}

/**
 * Validate that a value looks like a safe ID (alphanumeric, hyphens, underscores)
 * @param {string} value - ID to validate
 * @returns {boolean}
 */
function isValidId_(value) {
  if (!value) return false;
  return /^[\w\-]{1,100}$/.test(String(value));
}

/**
 * Validate that a value is a reasonable numeric string
 * @param {string} value - Number to validate
 * @returns {boolean}
 */
function isValidNumeric_(value) {
  if (value === null || value === undefined) return false;
  return /^-?\d{1,10}(\.\d{1,10})?$/.test(String(value));
}

function hasAttendanceValue_(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

// =====================================================
// NOTE: doGet/doPost entry points and role-check helpers
// (getUserRole_, requireAdminOrAuditor_, requireHeadOrAbove_,
//  isRequestCancelled_, validateApiKey_) are defined in
//  Attendance_Events.gs — DO NOT duplicate them here.
// =====================================================

// =====================================================
// ATTENDANCE RECORDING FUNCTIONS
// =====================================================

/**
 * Record Time In for a member
 * Extended with external attendee detection and late tracking
 * @param {Object} params - { eventId, memberId, memberName, status, location: { lat, lng }, recordedBy, isExternal }
 */
function recordTimeIn(params) {
  try {
    const { eventId, memberId, memberName, status, location, recordedBy, isExternal } = params;
    
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
    
    // Check if time is late based on event time windows
    let isLateTimeIn = false;
    let timeInWindowEnd = '';
    try {
      const timeWindows = getEventTimeWindows(eventId);
      if (timeWindows.success && timeWindows.timeWindows.timeInEnd) {
        timeInWindowEnd = String(timeWindows.timeWindows.timeInEnd || '');
        isLateTimeIn = isTimeLate(timeString, timeWindows.timeWindows.timeInEnd);
      }
    } catch (e) {
      Logger.log('Error checking late status: ' + e.toString());
    }
    
    // Determine if external attendee (if not explicitly set, check against recipients)
    let externalFlag = isExternal === true || isExternal === 'true';
    if (!externalFlag && isExternal !== false && isExternal !== 'false') {
      // Check if member is a target recipient
      try {
        const recipientCheck = checkIsTargetRecipient(eventId, memberId);
        externalFlag = !recipientCheck.isRecipient;
      } catch (e) {
        Logger.log('Error checking recipient status: ' + e.toString());
      }
    }
    
    // Prepare new row - with new columns at the end
    const newRow = [
      attendanceId,                    // AttendanceID
      eventId,                         // EventID
      memberId,                        // MemberID
      memberName || '',                // MemberName
      isLateTimeIn ? 'Late' : (status || 'Present'), // Status - auto-set to Late if after time window
      timeString,                      // TimeIn
      '',                              // TimeOut
      dateString,                      // AttendanceDate
      location ? `${location.lat},${location.lng}` : '', // Location
      geofenceValid ? 'Valid' : 'Outside Geofence',      // GeofenceStatus
      '',                              // Notes
      recordedBy || '',                // RecordedByTimeIn
      '',                              // RecordedByTimeOut
      nowISO,                          // RecordedAt
      externalFlag ? 'TRUE' : 'FALSE', // IsExternal
      isLateTimeIn ? 'TRUE' : 'FALSE', // LateTimeIn
      'FALSE'                          // LateTimeOut (not applicable for Time In)
    ];
    
    sheet.appendRow(newRow);
    
    // Update event attendee count
    updateEventAttendeeCount(eventId);
    
    return {
      success: true,
      message: isLateTimeIn ? 'Time In recorded (Late)' : 'Time In recorded successfully',
      attendanceId: attendanceId,
      timeIn: timeString,
      date: dateString,
      geofenceValid: geofenceValid,
      geofenceMessage: geofenceMessage,
      isExternal: externalFlag,
      isLate: isLateTimeIn,
      debugLateCheck: {
        currentTime: timeString,
        timeWindowEnd: timeInWindowEnd,
        computedIsLate: isLateTimeIn
      }
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Record Time Out for a member
 * Extended with late Time Out detection
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
    
    // Check if time is late for Time Out based on event time windows
    let isLateTimeOut = false;
    let timeOutWindowEnd = '';
    try {
      const timeWindows = getEventTimeWindows(eventId);
      if (timeWindows.success && timeWindows.timeWindows.timeOutEnd) {
        timeOutWindowEnd = String(timeWindows.timeWindows.timeOutEnd || '');
        isLateTimeOut = isTimeLate(timeString, timeWindows.timeWindows.timeOutEnd);
      }
    } catch (e) {
      Logger.log('Error checking late Time Out status: ' + e.toString());
    }
    
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
          
          // Update RecordedByTimeOut
          if (recordedBy) {
            sheet.getRange(rowIndex, headers.indexOf('RecordedByTimeOut') + 1).setValue(recordedBy);
          }
          
          // Update LateTimeOut column if it exists
          const lateTimeOutColIdx = headers.indexOf('LateTimeOut');
          if (lateTimeOutColIdx >= 0) {
            sheet.getRange(rowIndex, lateTimeOutColIdx + 1).setValue(isLateTimeOut ? 'TRUE' : 'FALSE');
          }
          
          // Update location if provided
          if (location && location.lat && location.lng) {
            const existingLocation = data[i][headers.indexOf('Location')] || '';
            const newLocation = existingLocation + ' | Out: ' + `${location.lat},${location.lng}`;
            sheet.getRange(rowIndex, headers.indexOf('Location') + 1).setValue(newLocation);
          }
          
          return {
            success: true,
            message: isLateTimeOut ? 'Time Out recorded (Late)' : 'Time Out recorded successfully',
            attendanceId: data[i][headers.indexOf('AttendanceID')],
            timeIn: data[i][headers.indexOf('TimeIn')],
            timeOut: timeString,
            date: dateString,
            isLateTimeOut: isLateTimeOut,
            debugLateCheck: {
              currentTime: timeString,
              timeWindowEnd: timeOutWindowEnd,
              computedIsLate: isLateTimeOut
            }
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

    if ((status === 'Absent' || status === 'Excused') && timeType === 'out') {
      return { success: false, error: 'INVALID_TIME_OUT_STATUS', message: 'Cannot record Time Out for Absent or Excused status' };
    }
    
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
          const existingTimeIn = data[i][headers.indexOf('TimeIn')];
          const existingTimeOut = data[i][headers.indexOf('TimeOut')];
          const hasExistingTimeIn = hasAttendanceValue_(existingTimeIn);
          const hasExistingTimeOut = hasAttendanceValue_(existingTimeOut);

          if (timeType === 'out' && !hasExistingTimeIn) {
            return {
              success: false,
              error: 'NO_TIME_IN',
              message: 'No Time In record found for this member today. Please record Time In first.'
            };
          }

          if (timeType === 'out' && hasExistingTimeIn && !hasExistingTimeOut) {
            const rowIndexAutoUpdate = i + 1;
            sheet.getRange(rowIndexAutoUpdate, headers.indexOf('Status') + 1).setValue(status);
            sheet.getRange(rowIndexAutoUpdate, headers.indexOf('TimeOut') + 1).setValue(timeString);

            if (notes) {
              const existingNotesAuto = data[i][headers.indexOf('Notes')] || '';
              const mergedNotesAuto = existingNotesAuto ? `${existingNotesAuto} | ${notes}` : notes;
              sheet.getRange(rowIndexAutoUpdate, headers.indexOf('Notes') + 1).setValue(mergedNotesAuto);
            }

            if (recordedBy) {
              sheet.getRange(rowIndexAutoUpdate, headers.indexOf('RecordedByTimeOut') + 1).setValue(recordedBy);
            }
            sheet.getRange(rowIndexAutoUpdate, headers.indexOf('RecordedAt') + 1).setValue(nowISO);

            return {
              success: true,
              message: 'Attendance Time Out recorded successfully',
              attendanceId: data[i][headers.indexOf('AttendanceID')],
              updated: true,
              autoCompletedTimeOut: true
            };
          }

          if (!overwrite) {
            // Return existing record for confirmation
            return {
              success: false,
              error: 'EXISTING_RECORD',
              existingRecord: {
                attendanceId: data[i][headers.indexOf('AttendanceID')],
                timeIn: existingTimeIn,
                timeOut: existingTimeOut,
                status: data[i][headers.indexOf('Status')],
                date: existingDate,
                hasTimeIn: hasExistingTimeIn,
                hasTimeOut: hasExistingTimeOut
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
          
          // Update RecordedBy based on timeType
          if (timeType === 'in' || timeType === 'both') {
            sheet.getRange(rowIndex, headers.indexOf('RecordedByTimeIn') + 1).setValue(recordedBy || '');
          }
          if (timeType === 'out' || timeType === 'both') {
            sheet.getRange(rowIndex, headers.indexOf('RecordedByTimeOut') + 1).setValue(recordedBy || '');
          }
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

    if (timeType === 'out') {
      return {
        success: false,
        error: 'NO_TIME_IN',
        message: 'No Time In record found for this member today. Please record Time In first.'
      };
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
      timeType === 'in' || timeType === 'both' ? (recordedBy || '') : '',  // RecordedByTimeIn
      timeType === 'out' || timeType === 'both' ? (recordedBy || '') : '',  // RecordedByTimeOut
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
    
    // Helper function to format time values properly
    const formatTimeValue = (value) => {
      if (!value) return '';
      // If it's already a string in proper format, return as-is
      if (typeof value === 'string' && /^\d{1,2}:\d{2}\s?(AM|PM|am|pm)$/i.test(value.trim())) {
        return value.trim();
      }
      // If it's a Date object (Google Sheets stores times as Date with 1899 base date)
      if (value instanceof Date) {
        return Utilities.formatDate(value, 'Asia/Manila', 'hh:mm a');
      }
      // If it's a string that might be an ISO date
      if (typeof value === 'string' && value.includes('T')) {
        try {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            return Utilities.formatDate(date, 'Asia/Manila', 'hh:mm a');
          }
        } catch (e) {
          // Fall through
        }
      }
      return String(value);
    };
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][headers.indexOf('EventID')] === eventId) {
        records.push({
          attendanceId: data[i][headers.indexOf('AttendanceID')],
          eventId: data[i][headers.indexOf('EventID')],
          memberId: data[i][headers.indexOf('MemberID')],
          memberName: data[i][headers.indexOf('MemberName')],
          status: data[i][headers.indexOf('Status')],
          timeIn: formatTimeValue(data[i][headers.indexOf('TimeIn')]),
          timeOut: formatTimeValue(data[i][headers.indexOf('TimeOut')]),
          date: data[i][headers.indexOf('AttendanceDate')],
          geofenceStatus: data[i][headers.indexOf('GeofenceStatus')],
          notes: data[i][headers.indexOf('Notes')],
          recordedByTimeIn: data[i][headers.indexOf('RecordedByTimeIn')] || '',
          recordedByTimeOut: data[i][headers.indexOf('RecordedByTimeOut')] || '',
          recordedAt: data[i][headers.indexOf('RecordedAt')],
          // New fields for external attendee and late tracking
          isExternal: data[i][headers.indexOf('IsExternal')] === 'TRUE' || data[i][headers.indexOf('IsExternal')] === true,
          lateTimeIn: data[i][headers.indexOf('LateTimeIn')] === 'TRUE' || data[i][headers.indexOf('LateTimeIn')] === true,
          lateTimeOut: data[i][headers.indexOf('LateTimeOut')] === 'TRUE' || data[i][headers.indexOf('LateTimeOut')] === true
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
    
    // Helper function to format time values properly
    const formatTimeValue = (value) => {
      if (!value) return '';
      // If it's already a string in proper format, return as-is
      if (typeof value === 'string' && /^\d{1,2}:\d{2}\s?(AM|PM|am|pm)$/i.test(value.trim())) {
        return value.trim();
      }
      // If it's a Date object (Google Sheets stores times as Date with 1899 base date)
      if (value instanceof Date) {
        return Utilities.formatDate(value, 'Asia/Manila', 'hh:mm a');
      }
      // If it's a string that might be an ISO date
      if (typeof value === 'string' && value.includes('T')) {
        try {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            return Utilities.formatDate(date, 'Asia/Manila', 'hh:mm a');
          }
        } catch (e) {
          // Fall through
        }
      }
      return String(value);
    };
    
    for (let i = 1; i < data.length; i++) {
      const rowEventId = data[i][headers.indexOf('EventID')];
      const rowMemberId = data[i][headers.indexOf('MemberID')];
      const rowDate = data[i][headers.indexOf('AttendanceDate')];
      
      if (rowEventId === eventId && rowMemberId === memberId) {
        const recordDate = rowDate ? Utilities.formatDate(new Date(rowDate), 'Asia/Manila', 'yyyy-MM-dd') : '';
        
        if (recordDate === today) {
          const rawTimeIn = data[i][headers.indexOf('TimeIn')];
          const rawTimeOut = data[i][headers.indexOf('TimeOut')];
          return {
            success: true,
            exists: true,
            hasTimeIn: hasAttendanceValue_(rawTimeIn),
            hasTimeOut: hasAttendanceValue_(rawTimeOut),
            record: {
              attendanceId: data[i][headers.indexOf('AttendanceID')],
              timeIn: formatTimeValue(rawTimeIn),
              timeOut: formatTimeValue(rawTimeOut),
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
          notes: data[i][headers.indexOf('Notes')],
          recordedByTimeIn: data[i][headers.indexOf('RecordedByTimeIn')] || '',
          recordedByTimeOut: data[i][headers.indexOf('RecordedByTimeOut')] || ''
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

/**
 * Migrate legacy attendance MemberID values to harmonized ID codes.
 * Source of truth for latest IDs:
 * 1) Directory sheet (if it has Name/ID Code columns)
 * 2) User Profiles sheet fallback
 *
 * Migration strategy:
 * - Keep already harmonized MemberID values
 * - Match attendance rows by MemberName -> latest ID Code
 * - Update EventAttendance.MemberID in batch
 */
function migrateAttendanceMemberIdsToHarmonizedCodes() {
  try {
    const attendanceSs = SpreadsheetApp.openById(getAttendanceSpreadsheetId());
    const attendanceSheet = attendanceSs.getSheetByName('EventAttendance');
    if (!attendanceSheet || attendanceSheet.getLastRow() < 2) {
      return { success: true, updated: 0, skipped: 0, unresolved: 0, message: 'No attendance rows to migrate.' };
    }

    const lastCol = attendanceSheet.getLastColumn();
    const data = attendanceSheet.getRange(1, 1, attendanceSheet.getLastRow(), lastCol).getValues();
    const headers = data[0];

    const memberIdCol = findHeaderIndex_(headers, ['MemberID']);
    const memberNameCol = findHeaderIndex_(headers, ['MemberName']);
    if (memberIdCol < 0 || memberNameCol < 0) {
      return { success: false, error: 'EventAttendance is missing MemberID or MemberName column.' };
    }

    const idLookup = buildHarmonizedIdLookup_();
    if (Object.keys(idLookup.byName).length === 0) {
      return { success: false, error: 'No harmonized ID codes found in Directory/User Profiles.' };
    }

    const idColValues = data.slice(1).map(function (row) {
      return [String(row[memberIdCol] || '').trim()];
    });

    let updated = 0;
    let skipped = 0;
    let unresolved = 0;
    const unresolvedRows = [];

    for (var i = 1; i < data.length; i++) {
      const row = data[i];
      const existingMemberId = String(row[memberIdCol] || '').trim();
      const memberName = String(row[memberNameCol] || '').trim();

      if (isHarmonizedIdCode_(existingMemberId)) {
        skipped++;
        continue;
      }

      const normalizedName = normalizeNameForLookup_(memberName);
      const mappedId = normalizedName ? idLookup.byName[normalizedName] : '';

      if (!mappedId) {
        unresolved++;
        if (unresolvedRows.length < 25) {
          unresolvedRows.push({
            row: i + 1,
            memberName: memberName,
            currentMemberId: existingMemberId
          });
        }
        continue;
      }

      if (mappedId === existingMemberId) {
        skipped++;
        continue;
      }

      idColValues[i - 1][0] = mappedId;
      updated++;
    }

    if (updated > 0) {
      attendanceSheet.getRange(2, memberIdCol + 1, idColValues.length, 1).setValues(idColValues);
    }

    return {
      success: true,
      updated: updated,
      skipped: skipped,
      unresolved: unresolved,
      unresolvedSample: unresolvedRows
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function buildHarmonizedIdLookup_() {
  const lookup = { byName: {} };
  const loginSs = SpreadsheetApp.openById(getLoginSpreadsheetId());

  // Preferred: Directory sheet (as requested)
  const directorySheet = loginSs.getSheetByName('Directory');
  if (directorySheet && directorySheet.getLastRow() >= 2) {
    const dirData = directorySheet.getDataRange().getValues();
    const dirHeaders = dirData[0];
    const dirNameCol = findHeaderIndex_(dirHeaders, ['Name', 'Full name', 'Full Name']);
    const dirIdCol = findHeaderIndex_(dirHeaders, ['ID Code', 'ID']);

    if (dirNameCol >= 0 && dirIdCol >= 0) {
      for (var i = 1; i < dirData.length; i++) {
        const name = normalizeNameForLookup_(dirData[i][dirNameCol]);
        const idCode = String(dirData[i][dirIdCol] || '').trim();
        if (!name || !isHarmonizedIdCode_(idCode)) continue;
        lookup.byName[name] = idCode;
      }
    }
  }

  // Fallback/augment: User Profiles
  const profilesSheet = loginSs.getSheetByName('User Profiles');
  if (profilesSheet && profilesSheet.getLastRow() >= 2) {
    const profileData = profilesSheet.getDataRange().getValues();
    const profileHeaders = profileData[0];
    const nameCol = findHeaderIndex_(profileHeaders, ['Full name', 'Full Name', 'Name']);
    const idCol = findHeaderIndex_(profileHeaders, ['ID Code', 'ID']);

    if (nameCol >= 0 && idCol >= 0) {
      for (var j = 1; j < profileData.length; j++) {
        const nameKey = normalizeNameForLookup_(profileData[j][nameCol]);
        const latestId = String(profileData[j][idCol] || '').trim();
        if (!nameKey || !isHarmonizedIdCode_(latestId)) continue;
        lookup.byName[nameKey] = latestId;
      }
    }
  }

  return lookup;
}

function findHeaderIndex_(headers, candidates) {
  const normalizedHeaders = headers.map(function (h) {
    return String(h || '').trim().toLowerCase();
  });
  for (var i = 0; i < candidates.length; i++) {
    const target = String(candidates[i] || '').trim().toLowerCase();
    const idx = normalizedHeaders.indexOf(target);
    if (idx >= 0) return idx;
  }
  return -1;
}

function normalizeNameForLookup_(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function isHarmonizedIdCode_(value) {
  return /^YSPTC-\d{2}\d{3,}$/i.test(String(value || '').trim());
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
 * Extended with IsExternal, LateTimeIn, LateTimeOut columns
 */
function initializeAttendanceSheet() {
  try {
    const ss = SpreadsheetApp.openById(getAttendanceSpreadsheetId());
    let sheet = ss.getSheetByName('EventAttendance');
    
    if (!sheet) {
      sheet = ss.insertSheet('EventAttendance');
    }
    
    // Extended headers with external attendee and late tracking
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
      'RecordedByTimeIn',
      'RecordedByTimeOut',
      'RecordedAt',
      // New fields
      'IsExternal',        // TRUE if person is not a target recipient
      'LateTimeIn',        // TRUE if Time In was after TimeInEnd
      'LateTimeOut'        // TRUE if Time Out was after TimeOutEnd
    ];
    
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#FF6600')
      .setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
    
    return { success: true, message: 'EventAttendance sheet initialized with extended schema' };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// =====================================================
// COMPREHENSIVE SCHEMA MIGRATION FUNCTIONS
// =====================================================

/**
 * UNIFIED SCHEMA - The expected 17-column EventAttendance schema
 * Both Attendance_Main.gs and Attendance_Events.gs must use this same schema
 */
const UNIFIED_ATTENDANCE_SCHEMA = [
  'AttendanceID',      // 1
  'EventID',           // 2
  'MemberID',          // 3
  'MemberName',        // 4
  'Status',            // 5
  'TimeIn',            // 6
  'TimeOut',           // 7
  'AttendanceDate',    // 8
  'Location',          // 9
  'GeofenceStatus',    // 10
  'Notes',             // 11
  'RecordedByTimeIn',  // 12
  'RecordedByTimeOut', // 13
  'RecordedAt',        // 14
  'IsExternal',        // 15
  'LateTimeIn',        // 16
  'LateTimeOut'        // 17
];

/**
 * MASTER MIGRATION FUNCTION - Run this to upgrade EventAttendance sheet to unified 17-column schema
 * 
 * This function handles all migration scenarios:
 * - Old 10-column schema (original)
 * - Old 13-column schema (with external/late fields)
 * - Any partially migrated state
 * 
 * It will:
 * 1. Rename CheckInTime → TimeIn (if exists)
 * 2. Rename CheckOutTime → TimeOut (if exists)
 * 3. Rename RecordedBy → RecordedByTimeIn (if exists)
 * 4. Insert missing columns at correct positions
 * 5. Preserve all existing data
 * 
 * Safe to run multiple times - skips already migrated columns
 * 
 * @returns {Object} Migration results with detailed log
 */
function migrateEventAttendanceToUnifiedSchema() {
  const results = {
    renames: [],
    insertions: [],
    existing: [],
    errors: []
  };
  
  try {
    const ss = SpreadsheetApp.openById(getAttendanceSpreadsheetId());
    const sheet = ss.getSheetByName('EventAttendance');
    
    if (!sheet) {
      return { success: false, error: 'EventAttendance sheet not found' };
    }
    
    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) {
      // Empty sheet - just initialize
      return initializeAttendanceSheet();
    }
    
    // Get current headers
    let headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    
    Logger.log('Current headers before migration: ' + JSON.stringify(headers));
    
    // ===== STEP 1: RENAME COLUMNS (header only, data stays in place) =====
    
    // Rename CheckInTime → TimeIn
    const checkInIdx = headers.indexOf('CheckInTime');
    if (checkInIdx >= 0 && headers.indexOf('TimeIn') < 0) {
      sheet.getRange(1, checkInIdx + 1).setValue('TimeIn');
      results.renames.push({ from: 'CheckInTime', to: 'TimeIn', column: checkInIdx + 1 });
      headers[checkInIdx] = 'TimeIn';
    }
    
    // Rename CheckOutTime → TimeOut
    const checkOutIdx = headers.indexOf('CheckOutTime');
    if (checkOutIdx >= 0 && headers.indexOf('TimeOut') < 0) {
      sheet.getRange(1, checkOutIdx + 1).setValue('TimeOut');
      results.renames.push({ from: 'CheckOutTime', to: 'TimeOut', column: checkOutIdx + 1 });
      headers[checkOutIdx] = 'TimeOut';
    }
    
    // Rename RecordedBy → RecordedByTimeIn (only if RecordedByTimeIn doesn't exist)
    const recordedByIdx = headers.indexOf('RecordedBy');
    if (recordedByIdx >= 0 && headers.indexOf('RecordedByTimeIn') < 0) {
      sheet.getRange(1, recordedByIdx + 1).setValue('RecordedByTimeIn');
      results.renames.push({ from: 'RecordedBy', to: 'RecordedByTimeIn', column: recordedByIdx + 1 });
      headers[recordedByIdx] = 'RecordedByTimeIn';
    }
    
    // ===== STEP 2: INSERT MISSING COLUMNS AT CORRECT POSITIONS =====
    // Refresh headers after renames
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    for (let i = 0; i < UNIFIED_ATTENDANCE_SCHEMA.length; i++) {
      const expectedHeader = UNIFIED_ATTENDANCE_SCHEMA[i];
      const currentIdx = headers.indexOf(expectedHeader);
      
      if (currentIdx < 0) {
        // Column doesn't exist - need to insert it at position i+1
        const insertResult = insertColumnAtPosition_(sheet, expectedHeader, i + 1, getDefaultValue_(expectedHeader));
        if (insertResult.success) {
          results.insertions.push({ column: expectedHeader, position: i + 1 });
        } else {
          results.errors.push({ column: expectedHeader, error: insertResult.error });
        }
        // Refresh headers after insertion
        headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      } else if (currentIdx !== i) {
        // Column exists but at wrong position
        results.existing.push({ 
          column: expectedHeader, 
          currentPosition: currentIdx + 1, 
          expectedPosition: i + 1,
          note: 'Column exists at different position - manual reorder may be needed'
        });
      } else {
        results.existing.push({ column: expectedHeader, position: i + 1, status: 'OK' });
      }
    }
    
    // ===== STEP 3: FORMAT HEADER ROW =====
    const finalColCount = sheet.getLastColumn();
    sheet.getRange(1, 1, 1, finalColCount)
      .setBackground('#FF6600')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold');
    sheet.setFrozenRows(1);
    
    // Get final headers for verification
    const finalHeaders = sheet.getRange(1, 1, 1, finalColCount).getValues()[0];
    
    Logger.log('Final headers after migration: ' + JSON.stringify(finalHeaders));
    
    return {
      success: true,
      message: 'EventAttendance schema migration completed',
      beforeColumnCount: lastCol,
      afterColumnCount: finalColCount,
      finalHeaders: finalHeaders,
      results: results
    };
    
  } catch (error) {
    Logger.log('Migration error: ' + error.toString());
    return { success: false, error: error.toString(), results: results };
  }
}

/**
 * Insert a column at a specific position, shifting existing columns right
 * All data in existing rows will get an empty value (or default) in the new column
 * 
 * @param {Sheet} sheet - The sheet to modify
 * @param {string} headerName - Name for the new column header
 * @param {number} position - 1-indexed position where to insert
 * @param {string} defaultValue - Default value for existing data rows
 * @returns {Object} Result with success status
 */
function insertColumnAtPosition_(sheet, headerName, position, defaultValue) {
  try {
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    
    // Validate position
    if (position < 1) position = 1;
    if (position > lastCol + 1) position = lastCol + 1;
    
    // Insert column at position
    sheet.insertColumnBefore(position);
    
    // Set header
    sheet.getRange(1, position).setValue(headerName);
    
    // Set default values for existing data rows
    if (lastRow > 1 && defaultValue !== undefined && defaultValue !== '') {
      const numDataRows = lastRow - 1;
      const defaultValues = Array(numDataRows).fill([defaultValue]);
      sheet.getRange(2, position, numDataRows, 1).setValues(defaultValues);
    }
    
    // Apply header styling
    sheet.getRange(1, position)
      .setBackground('#FF6600')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold');
    
    Logger.log('Inserted column "' + headerName + '" at position ' + position);
    
    return { success: true, position: position };
  } catch (error) {
    Logger.log('Error inserting column "' + headerName + '": ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * Get default value for a column based on its name
 */
function getDefaultValue_(columnName) {
  const defaults = {
    'AttendanceDate': '',
    'Location': '',
    'GeofenceStatus': 'N/A',
    'RecordedByTimeOut': '',
    'IsExternal': 'FALSE',
    'LateTimeIn': 'FALSE',
    'LateTimeOut': 'FALSE'
  };
  return defaults[columnName] || '';
}

/**
 * Verify the current EventAttendance schema matches the expected unified schema
 * Use this to check if migration is needed
 * 
 * @returns {Object} Schema validation results
 */
function verifyEventAttendanceSchema() {
  try {
    const ss = SpreadsheetApp.openById(getAttendanceSpreadsheetId());
    const sheet = ss.getSheetByName('EventAttendance');
    
    if (!sheet) {
      return { success: false, needsMigration: true, error: 'EventAttendance sheet not found' };
    }
    
    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) {
      return { success: true, needsMigration: true, message: 'Sheet is empty - needs initialization' };
    }
    
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    
    const issues = [];
    
    // Check for missing columns
    for (const expected of UNIFIED_ATTENDANCE_SCHEMA) {
      if (!headers.includes(expected)) {
        issues.push({ type: 'missing', column: expected });
      }
    }
    
    // Check for old column names that need renaming
    if (headers.includes('CheckInTime')) {
      issues.push({ type: 'rename_needed', from: 'CheckInTime', to: 'TimeIn' });
    }
    if (headers.includes('CheckOutTime')) {
      issues.push({ type: 'rename_needed', from: 'CheckOutTime', to: 'TimeOut' });
    }
    if (headers.includes('RecordedBy') && !headers.includes('RecordedByTimeIn')) {
      issues.push({ type: 'rename_needed', from: 'RecordedBy', to: 'RecordedByTimeIn' });
    }
    
    // Check column order
    let orderIssues = [];
    for (let i = 0; i < UNIFIED_ATTENDANCE_SCHEMA.length; i++) {
      const headerIdx = headers.indexOf(UNIFIED_ATTENDANCE_SCHEMA[i]);
      if (headerIdx >= 0 && headerIdx !== i) {
        orderIssues.push({ column: UNIFIED_ATTENDANCE_SCHEMA[i], expected: i + 1, actual: headerIdx + 1 });
      }
    }
    
    const needsMigration = issues.length > 0 || orderIssues.length > 0;
    
    return {
      success: true,
      needsMigration: needsMigration,
      currentHeaders: headers,
      expectedHeaders: UNIFIED_ATTENDANCE_SCHEMA,
      columnCount: { current: lastCol, expected: 17 },
      issues: issues,
      orderIssues: orderIssues,
      message: needsMigration 
        ? 'Schema needs migration - run migrateEventAttendanceToUnifiedSchema()' 
        : 'Schema is up to date'
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Migrate EventAttendance sheet to add new columns (legacy - use migrateEventAttendanceToUnifiedSchema instead)
 * Safe to run multiple times
 */
function migrateAttendanceSchema() {
  const columns = [
    { name: 'IsExternal', defaultValue: 'FALSE' },
    { name: 'LateTimeIn', defaultValue: 'FALSE' },
    { name: 'LateTimeOut', defaultValue: 'FALSE' }
  ];
  
  const results = [];
  
  for (const col of columns) {
    const result = safeAddAttendanceColumn(col.name, col.defaultValue);
    results.push({ column: col.name, ...result });
  }
  
  return { success: true, message: 'Attendance schema migration completed', results };
}

/**
 * Safely add a column to EventAttendance sheet (appends at end)
 */
function safeAddAttendanceColumn(columnName, defaultValue) {
  try {
    const ss = SpreadsheetApp.openById(getAttendanceSpreadsheetId());
    const sheet = ss.getSheetByName('EventAttendance');
    
    if (!sheet) {
      return { success: false, error: 'EventAttendance sheet not found' };
    }
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    if (headers.includes(columnName)) {
      return { success: true, message: `Column "${columnName}" already exists`, alreadyExists: true };
    }
    
    const newColIndex = sheet.getLastColumn() + 1;
    sheet.getRange(1, newColIndex).setValue(columnName);
    sheet.getRange(1, newColIndex)
      .setBackground('#FF6600')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold');
    
    if (defaultValue !== undefined && sheet.getLastRow() > 1) {
      const numRows = sheet.getLastRow() - 1;
      const defaultValues = Array(numRows).fill([defaultValue]);
      sheet.getRange(2, newColIndex, numRows, 1).setValues(defaultValues);
    }
    
    return { success: true, message: `Column "${columnName}" added`, columnIndex: newColIndex };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// =====================================================
// SCHEMA STATUS CHECK
// =====================================================

/**
 * CHECK ATTENDANCE SHEETS CONFIGURATION STATUS
 * 
 * Run this function to verify if all sheets are properly configured.
 * Returns a clear status message indicating if everything is ready or what needs to be fixed.
 * 
 * @returns {Object} Status with clear message
 */
function checkAttendanceSheetsStatus() {
  const status = {
    timestamp: new Date().toISOString(),
    configured: true,
    sheets: {
      eventAttendance: { exists: false, schemaValid: false, issues: [] }
    },
    summary: '',
    action: ''
  };
  
  try {
    const ss = SpreadsheetApp.openById(getAttendanceSpreadsheetId());
    
    // ===== CHECK EventAttendance SHEET =====
    const attendanceSheet = ss.getSheetByName('EventAttendance');
    
    if (!attendanceSheet) {
      status.sheets.eventAttendance.exists = false;
      status.sheets.eventAttendance.issues.push('Sheet does not exist');
      status.configured = false;
    } else {
      status.sheets.eventAttendance.exists = true;
      
      const lastCol = attendanceSheet.getLastColumn();
      if (lastCol === 0) {
        status.sheets.eventAttendance.issues.push('Sheet is empty - no headers');
        status.configured = false;
      } else {
        const headers = attendanceSheet.getRange(1, 1, 1, lastCol).getValues()[0];
        status.sheets.eventAttendance.currentHeaders = headers;
        status.sheets.eventAttendance.columnCount = lastCol;
        
        // Check against unified schema
        const missingColumns = [];
        const renameNeeded = [];
        
        for (const expected of UNIFIED_ATTENDANCE_SCHEMA) {
          if (!headers.includes(expected)) {
            missingColumns.push(expected);
          }
        }
        
        // Check for old column names
        if (headers.includes('CheckInTime') && !headers.includes('TimeIn')) {
          renameNeeded.push('CheckInTime → TimeIn');
        }
        if (headers.includes('CheckOutTime') && !headers.includes('TimeOut')) {
          renameNeeded.push('CheckOutTime → TimeOut');
        }
        if (headers.includes('RecordedBy') && !headers.includes('RecordedByTimeIn')) {
          renameNeeded.push('RecordedBy → RecordedByTimeIn');
        }
        
        if (missingColumns.length === 0 && renameNeeded.length === 0) {
          status.sheets.eventAttendance.schemaValid = true;
        } else {
          status.sheets.eventAttendance.schemaValid = false;
          status.configured = false;
          
          if (missingColumns.length > 0) {
            status.sheets.eventAttendance.issues.push('Missing columns: ' + missingColumns.join(', '));
          }
          if (renameNeeded.length > 0) {
            status.sheets.eventAttendance.issues.push('Columns need renaming: ' + renameNeeded.join(', '));
          }
        }
      }
    }
    
    // ===== GENERATE SUMMARY MESSAGE =====
    if (status.configured) {
      status.summary = '✅ SHEETS ARE CONFIGURED - All attendance sheets have the correct schema and are ready to use.';
      status.action = 'No action needed. System is ready for attendance recording.';
      Logger.log('✅ SHEETS ARE CONFIGURED');
    } else {
      status.summary = '⚠️ MIGRATION NEEDED - Some sheets require schema updates.';
      status.action = 'Run migrateEventAttendanceToUnifiedSchema() to fix the issues.';
      Logger.log('⚠️ MIGRATION NEEDED');
      Logger.log('Issues: ' + JSON.stringify(status.sheets.eventAttendance.issues));
    }
    
    return status;
    
  } catch (error) {
    status.configured = false;
    status.summary = '❌ ERROR - Could not check sheet configuration.';
    status.action = 'Check that the spreadsheet ID is correct and you have access.';
    status.error = error.toString();
    Logger.log('❌ ERROR: ' + error.toString());
    return status;
  }
}
