/**
 * =====================================================
 * YSP TAGUM - EVENTS MANAGEMENT SYSTEM
 * Google Apps Script Backend
 * =====================================================
 * 
 * This script handles all event management operations
 * for the YSP Tagum WebApp including:
 * - Event CRUD operations with geofencing support
 * - Event attendance tracking
 * - Sheet initialization
 * 
 * SPREADSHEET STRUCTURE:
 * - Events: Main events data with geofencing (Latitude, Longitude, Radius)
 * - EventAttendance: Attendance records per event
 * - EventSettings: Configuration settings
 * 
 * @author YSP Tagum Development Team
 * @version 1.1.0
 * @lastUpdated 2026-01-10
 */

// =====================================================
// CONFIGURATION
// =====================================================

/**
 * Get the Events Spreadsheet ID
 * IMPORTANT: Update this with your actual spreadsheet ID
 */
function getEventsSpreadsheetId() {
  // Your Events Spreadsheet ID
  return '1Xn7w9kzNrP6dmZXYXjxaO11Lmao79wn9w1SPCiqFtcA';
}

/**
 * Set the Events Spreadsheet ID (optional - for dynamic configuration)
 */
function setEventsSpreadsheetId(spreadsheetId) {
  PropertiesService.getScriptProperties().setProperty('EVENTS_SPREADSHEET_ID', spreadsheetId);
}

// =====================================================
// WEB APP ENTRY POINTS
// =====================================================

/**
 * Handle GET requests
 */
function doGet(e) {
  const params = e.parameter;
  const action = params.action;
  
  let result;
  
  try {
    switch (action) {
      case 'getEvents':
        result = getEvents(params);
        break;
      case 'getEvent':
        result = getEventById(params.eventId);
        break;
      case 'getEventAttendance':
        result = getEventAttendance(params.eventId);
        break;
      case 'getUpcomingEvents':
        result = getUpcomingEvents(params.limit || 10);
        break;
      case 'getPastEvents':
        result = getPastEvents(params.limit || 10);
        break;
      case 'getEventStats':
        result = getEventStats();
        break;
      case 'initializeSheets':
        result = initializeEventSheets();
        break;
      default:
        result = { success: false, error: 'Invalid action' };
    }
  } catch (error) {
    result = { success: false, error: error.toString() };
  }
  
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handle POST requests
 */
function doPost(e) {
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
      case 'createEvent':
        result = createEvent(params.eventData);
        break;
      case 'updateEvent':
        result = updateEvent(params.eventId, params.eventData);
        break;
      case 'deleteEvent':
        result = deleteEvent(params.eventId);
        break;
      case 'recordAttendance':
        result = recordEventAttendance(params.eventId, params.memberId, params.status);
        break;
      case 'bulkRecordAttendance':
        result = bulkRecordEventAttendance(params.eventId, params.attendanceRecords);
        break;
      case 'duplicateEvent':
        result = duplicateEvent(params.eventId);
        break;
      case 'cancelEvent':
        result = cancelEvent(params.eventId, params.reason);
        break;
      default:
        result = { success: false, error: 'Invalid action' };
    }
  } catch (error) {
    result = { success: false, error: error.toString() };
  }
  
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// =====================================================
// SHEET INITIALIZATION
// =====================================================

/**
 * Initialize all required sheets for the Events system
 * Creates the spreadsheet and all necessary sheets with headers
 */
function initializeEventSheets() {
  try {
    let spreadsheetId = getEventsSpreadsheetId();
    let ss;
    
    // Create new spreadsheet if ID not set
    if (!spreadsheetId) {
      ss = SpreadsheetApp.create('YSP Tagum - Events Management');
      spreadsheetId = ss.getId();
      setEventsSpreadsheetId(spreadsheetId);
      Logger.log('Created new Events spreadsheet with ID: ' + spreadsheetId);
    } else {
      ss = SpreadsheetApp.openById(spreadsheetId);
    }
    
    // Create Events sheet
    createEventsSheet(ss);
    
    // Create EventAttendance sheet
    createEventAttendanceSheet(ss);
    
    // Create EventSettings sheet (optional, for configuration)
    createEventSettingsSheet(ss);
    
    // Remove default Sheet1 if it exists
    const defaultSheet = ss.getSheetByName('Sheet1');
    if (defaultSheet && ss.getSheets().length > 1) {
      ss.deleteSheet(defaultSheet);
    }
    
    return {
      success: true,
      message: 'Event sheets initialized successfully',
      spreadsheetId: spreadsheetId,
      spreadsheetUrl: ss.getUrl()
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Create the main Events sheet
 */
function createEventsSheet(ss) {
  let sheet = ss.getSheetByName('Events');
  
  if (!sheet) {
    sheet = ss.insertSheet('Events');
  }
  
  // Set headers
  const headers = [
    'EventID',
    'Title',
    'Description',
    'StartDate',
    'EndDate',
    'StartTime',
    'EndTime',
    'LocationName',
    'Latitude',
    'Longitude',
    'Radius',
    'GeofenceEnabled',
    'CurrentAttendees',
    'Status',
    'CreatedBy',
    'CreatedAt',
    'UpdatedAt',
    'Notes'
  ];
  
  // Check if headers already exist
  const existingHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  if (existingHeaders[0] !== 'EventID') {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // Format header row
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#FF6600')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold');
    
    // Set column widths
    sheet.setColumnWidth(1, 180);  // EventID
    sheet.setColumnWidth(2, 250);  // Title
    sheet.setColumnWidth(3, 300);  // Description
    sheet.setColumnWidth(4, 120);  // StartDate
    sheet.setColumnWidth(5, 120);  // EndDate
    sheet.setColumnWidth(6, 80);   // StartTime
    sheet.setColumnWidth(7, 80);   // EndTime
    sheet.setColumnWidth(8, 200);  // LocationName
    sheet.setColumnWidth(9, 120);  // Latitude
    sheet.setColumnWidth(10, 120); // Longitude
    sheet.setColumnWidth(11, 80);  // Radius
    
    // Freeze header row
    sheet.setFrozenRows(1);
  }
  
  return sheet;
}

/**
 * Create the EventCategories sheet
 */
/**
 * Create the EventAttendance sheet
 */
function createEventAttendanceSheet(ss) {
  let sheet = ss.getSheetByName('EventAttendance');
  
  if (!sheet) {
    sheet = ss.insertSheet('EventAttendance');
  }
  
  const headers = [
    'AttendanceID',
    'EventID',
    'MemberID',
    'MemberName',
    'Status',
    'CheckInTime',
    'CheckOutTime',
    'Notes',
    'RecordedBy',
    'RecordedAt'
  ];
  
  const existingHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  if (existingHeaders[0] !== 'AttendanceID') {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // Format header row
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#FF6600')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold');
    
    sheet.setFrozenRows(1);
  }
  
  return sheet;
}

/**
 * Create the EventSettings sheet
 */
function createEventSettingsSheet(ss) {
  let sheet = ss.getSheetByName('EventSettings');
  
  if (!sheet) {
    sheet = ss.insertSheet('EventSettings');
  }
  
  const headers = [
    'SettingKey',
    'SettingValue',
    'Description',
    'UpdatedAt'
  ];
  
  const existingHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  if (existingHeaders[0] !== 'SettingKey') {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // Format header row
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#FF6600')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold');
    
    // Add default settings
    const defaultSettings = [
      ['DEFAULT_EVENT_DURATION', '2', 'Default event duration in hours', new Date().toISOString()],
      ['ALLOW_GUEST_REGISTRATION', 'FALSE', 'Allow guests to register for events', new Date().toISOString()],
      ['SEND_REMINDERS', 'TRUE', 'Send event reminders to attendees', new Date().toISOString()],
      ['REMINDER_HOURS_BEFORE', '24', 'Hours before event to send reminder', new Date().toISOString()],
      ['MAX_EVENTS_PER_DAY', '5', 'Maximum events allowed per day', new Date().toISOString()],
      ['REQUIRE_ATTENDANCE_CONFIRMATION', 'TRUE', 'Require attendance confirmation', new Date().toISOString()]
    ];
    
    if (sheet.getLastRow() < 2) {
      sheet.getRange(2, 1, defaultSettings.length, defaultSettings[0].length).setValues(defaultSettings);
    }
    
    sheet.setFrozenRows(1);
  }
  
  return sheet;
}

// =====================================================
// EVENT CRUD OPERATIONS
// =====================================================

/**
 * Get all events with optional filtering
 */
function getEvents(params) {
  try {
    const ss = SpreadsheetApp.openById(getEventsSpreadsheetId());
    const sheet = ss.getSheetByName('Events');
    
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true, events: [], total: 0 };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const events = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue; // Skip empty rows
      
      const event = {};
      headers.forEach((header, index) => {
        event[header] = row[index];
      });
      
      // Apply filters if provided
      if (params) {
        if (params.status && event.Status !== params.status) continue;
        if (params.startDate && new Date(event.StartDate) < new Date(params.startDate)) continue;
        if (params.endDate && new Date(event.StartDate) > new Date(params.endDate)) continue;
      }
      
      events.push(event);
    }
    
    // Sort by StartDate descending (newest first)
    events.sort((a, b) => new Date(b.StartDate) - new Date(a.StartDate));
    
    return { success: true, events: events, total: events.length };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Get a single event by ID
 */
function getEventById(eventId) {
  try {
    const ss = SpreadsheetApp.openById(getEventsSpreadsheetId());
    const sheet = ss.getSheetByName('Events');
    
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: false, error: 'Event not found' };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === eventId) {
        const event = {};
        headers.forEach((header, index) => {
          event[header] = data[i][index];
        });
        return { success: true, event: event };
      }
    }
    
    return { success: false, error: 'Event not found' };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Generate a unique Event ID in format: YSPTCEV-yyyy-xxxx
 * YSPTCEV = YSP Tagum City Events
 * yyyy = current year
 * xxxx = random alphanumeric
 */
function generateEventId() {
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `YSPTCEV-${year}-${random}`;
}

/**
 * Parse a datetime string (e.g., "2026-01-18T08:00" or "2026-01-18 08:00") 
 * into separate date and time components
 * Date is formatted as MM/DD/YYYY (PH format)
 * Time is converted to Philippine format (12-hour with AM/PM)
 */
function parseDatetime(datetimeStr) {
  if (!datetimeStr) return { date: '', time: '' };
  
  // Handle ISO format (2026-01-18T08:00) or space format (2026-01-18 08:00)
  const str = String(datetimeStr);
  
  // Check if it contains time component (T separator or space with colon)
  if (str.includes('T') || (str.includes(' ') && str.includes(':'))) {
    const parts = str.includes('T') ? str.split('T') : str.split(' ');
    let datePart = parts[0]; // 2026-01-18
    let timePart = parts[1] || ''; // 08:00 or 08:00:00
    
    // Convert date from YYYY-MM-DD to MM/DD/YYYY (PH format)
    if (datePart && datePart.includes('-')) {
      const [year, month, day] = datePart.split('-');
      datePart = `${month}/${day}/${year}`;
    }
    
    // Convert to 12-hour PH format with AM/PM
    if (timePart) {
      // Remove any existing AM/PM first (in case already formatted)
      timePart = timePart.replace(/\s*(AM|PM)\s*/gi, '').trim();
      
      const timeComponents = timePart.split(':');
      let hours = parseInt(timeComponents[0], 10);
      const minutes = timeComponents[1] ? timeComponents[1].substring(0, 2) : '00';
      
      const period = hours >= 12 ? 'PM' : 'AM';
      
      // Convert to 12-hour format
      if (hours === 0) {
        hours = 12; // Midnight
      } else if (hours > 12) {
        hours = hours - 12;
      }
      
      timePart = `${hours}:${minutes} ${period}`;
    }
    
    return { date: datePart, time: timePart };
  }
  
  // No time component, just date - still format it to PH format
  let datePart = str;
  if (datePart && datePart.includes('-') && datePart.length === 10) {
    const [year, month, day] = datePart.split('-');
    datePart = `${month}/${day}/${year}`;
  }
  
  return { date: datePart, time: '' };
}

/**
 * Create a new event
 */
function createEvent(eventData) {
  try {
    const ss = SpreadsheetApp.openById(getEventsSpreadsheetId());
    const sheet = ss.getSheetByName('Events');
    
    if (!sheet) {
      return { success: false, error: 'Events sheet not found. Please initialize sheets first.' };
    }
    
    // Generate unique EventID in format: YSPTCEV-yyyy-xxxx
    const eventId = generateEventId();
    const now = new Date().toISOString();
    
    // Parse datetime into separate date and time
    const startParsed = parseDatetime(eventData.startDate);
    const endParsed = parseDatetime(eventData.endDate || eventData.startDate);
    
    const newRow = [
      eventId,
      eventData.title || '',
      eventData.description || '',
      startParsed.date,          // StartDate (date only)
      endParsed.date,            // EndDate (date only)
      startParsed.time,          // StartTime (time only)
      endParsed.time,            // EndTime (time only)
      eventData.locationName || '',
      eventData.latitude || '',
      eventData.longitude || '',
      eventData.radius || 100,
      eventData.geofenceEnabled !== false ? 'TRUE' : 'FALSE', // GeofenceEnabled (default: TRUE)
      0, // CurrentAttendees (auto-calculated)
      eventData.status || 'Scheduled',
      eventData.createdBy || '',
      now,
      now,
      eventData.notes || ''
    ];
    
    sheet.appendRow(newRow);
    
    return {
      success: true,
      message: 'Event created successfully',
      eventId: eventId,
      event: {
        EventID: eventId,
        Title: eventData.title,
        StartDate: startParsed.date,
        StartTime: startParsed.time,
        Status: 'Scheduled'
      }
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Update an existing event
 */
function updateEvent(eventId, eventData) {
  try {
    const ss = SpreadsheetApp.openById(getEventsSpreadsheetId());
    const sheet = ss.getSheetByName('Events');
    
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: false, error: 'Event not found' };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === eventId) {
        const rowIndex = i + 1;
        const now = new Date().toISOString();
        
        // Column mapping for schema (1-indexed):
        // 1=EventID, 2=Title, 3=Description, 4=StartDate, 5=EndDate
        // 6=StartTime, 7=EndTime, 8=LocationName, 9=Latitude, 10=Longitude, 11=Radius
        // 12=GeofenceEnabled, 13=CurrentAttendees (auto), 14=Status, 15=CreatedBy
        // 16=CreatedAt, 17=UpdatedAt, 18=Notes
        
        if (eventData.title !== undefined) sheet.getRange(rowIndex, 2).setValue(eventData.title);
        if (eventData.description !== undefined) sheet.getRange(rowIndex, 3).setValue(eventData.description);
        
        // Parse datetime into separate date and time for startDate
        if (eventData.startDate !== undefined) {
          const startParsed = parseDatetime(eventData.startDate);
          sheet.getRange(rowIndex, 4).setValue(startParsed.date);  // StartDate
          sheet.getRange(rowIndex, 6).setValue(startParsed.time);  // StartTime
        }
        
        // Parse datetime into separate date and time for endDate
        if (eventData.endDate !== undefined) {
          const endParsed = parseDatetime(eventData.endDate);
          sheet.getRange(rowIndex, 5).setValue(endParsed.date);    // EndDate
          sheet.getRange(rowIndex, 7).setValue(endParsed.time);    // EndTime
        }
        
        if (eventData.locationName !== undefined) sheet.getRange(rowIndex, 8).setValue(eventData.locationName);
        if (eventData.latitude !== undefined) sheet.getRange(rowIndex, 9).setValue(eventData.latitude);
        if (eventData.longitude !== undefined) sheet.getRange(rowIndex, 10).setValue(eventData.longitude);
        if (eventData.radius !== undefined) sheet.getRange(rowIndex, 11).setValue(eventData.radius);
        if (eventData.geofenceEnabled !== undefined) sheet.getRange(rowIndex, 12).setValue(eventData.geofenceEnabled ? 'TRUE' : 'FALSE');
        if (eventData.status !== undefined) sheet.getRange(rowIndex, 14).setValue(eventData.status);
        if (eventData.notes !== undefined) sheet.getRange(rowIndex, 18).setValue(eventData.notes);
        
        // Always update UpdatedAt (column 17)
        sheet.getRange(rowIndex, 17).setValue(now);
        
        return { success: true, message: 'Event updated successfully', eventId: eventId };
      }
    }
    
    return { success: false, error: 'Event not found' };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Delete an event
 */
function deleteEvent(eventId) {
  try {
    const ss = SpreadsheetApp.openById(getEventsSpreadsheetId());
    const sheet = ss.getSheetByName('Events');
    
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: false, error: 'Event not found' };
    }
    
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === eventId) {
        sheet.deleteRow(i + 1);
        
        // Also delete associated attendance records
        deleteEventAttendanceRecords(eventId);
        
        return { success: true, message: 'Event deleted successfully' };
      }
    }
    
    return { success: false, error: 'Event not found' };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Cancel an event
 */
function cancelEvent(eventId, reason) {
  try {
    const ss = SpreadsheetApp.openById(getEventsSpreadsheetId());
    const sheet = ss.getSheetByName('Events');
    
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: false, error: 'Event not found' };
    }
    
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === eventId) {
        const rowIndex = i + 1;
        const now = new Date().toISOString();
        
        // Simplified schema: Status is column 13, UpdatedAt is column 16, Notes is column 17
        sheet.getRange(rowIndex, 13).setValue('Cancelled'); // Status
        sheet.getRange(rowIndex, 16).setValue(now); // UpdatedAt
        
        // Append cancellation reason to Notes if provided
        if (reason) {
          const currentNotes = sheet.getRange(rowIndex, 17).getValue() || '';
          const updatedNotes = currentNotes 
            ? currentNotes + '\n[Cancelled: ' + reason + ']'
            : '[Cancelled: ' + reason + ']';
          sheet.getRange(rowIndex, 17).setValue(updatedNotes);
        }
        
        return { success: true, message: 'Event cancelled successfully' };
      }
    }
    
    return { success: false, error: 'Event not found' };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Duplicate an event
 */
function duplicateEvent(eventId) {
  try {
    const result = getEventById(eventId);
    
    if (!result.success) {
      return result;
    }
    
    const originalEvent = result.event;
    
    // Combine date and time for proper parsing in createEvent
    // If time is in 12-hour PH format (e.g., "8:00 AM"), convert back to 24-hour for parsing
    const startDatetime = combineDateTime(originalEvent.StartDate, originalEvent.StartTime);
    const endDatetime = combineDateTime(originalEvent.EndDate, originalEvent.EndTime);
    
    // Create a copy with new ID - using simplified schema
    const newEventData = {
      title: originalEvent.Title + ' (Copy)',
      description: originalEvent.Description,
      startDate: startDatetime,
      endDate: endDatetime,
      locationName: originalEvent.LocationName,
      latitude: originalEvent.Latitude,
      longitude: originalEvent.Longitude,
      radius: originalEvent.Radius,
      status: 'Draft',
      createdBy: originalEvent.CreatedBy,
      notes: originalEvent.Notes
    };
    
    return createEvent(newEventData);
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Combine date and time strings into datetime format
 * Handles 12-hour PH time format (e.g., "8:00 AM") and converts to 24-hour for parsing
 */
function combineDateTime(dateStr, timeStr) {
  if (!dateStr) return '';
  if (!timeStr) return dateStr;
  
  // Convert 12-hour format to 24-hour if needed
  let time24 = timeStr;
  
  if (timeStr.toUpperCase().includes('AM') || timeStr.toUpperCase().includes('PM')) {
    const isPM = timeStr.toUpperCase().includes('PM');
    const timePart = timeStr.replace(/\s*(AM|PM)\s*/i, '').trim();
    const [hours, minutes] = timePart.split(':');
    let hour24 = parseInt(hours, 10);
    
    if (isPM && hour24 !== 12) {
      hour24 += 12;
    } else if (!isPM && hour24 === 12) {
      hour24 = 0;
    }
    
    time24 = `${hour24.toString().padStart(2, '0')}:${minutes}`;
  }
  
  return `${dateStr}T${time24}`;
}

// =====================================================
// EVENT ATTENDANCE OPERATIONS
// =====================================================

/**
 * Get attendance records for an event
 */
function getEventAttendance(eventId) {
  try {
    const ss = SpreadsheetApp.openById(getEventsSpreadsheetId());
    const sheet = ss.getSheetByName('EventAttendance');
    
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true, attendance: [], total: 0 };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const attendance = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[1] === eventId) {
        const record = {};
        headers.forEach((header, index) => {
          record[header] = row[index];
        });
        attendance.push(record);
      }
    }
    
    return { success: true, attendance: attendance, total: attendance.length };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Record attendance for an event
 */
function recordEventAttendance(eventId, memberId, status) {
  try {
    const ss = SpreadsheetApp.openById(getEventsSpreadsheetId());
    const sheet = ss.getSheetByName('EventAttendance');
    
    if (!sheet) {
      return { success: false, error: 'EventAttendance sheet not found' };
    }
    
    const attendanceId = 'ATT' + Date.now() + Math.random().toString(36).substr(2, 4).toUpperCase();
    const now = new Date().toISOString();
    
    // Check if attendance already recorded
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === eventId && data[i][2] === memberId) {
        // Update existing record
        const rowIndex = i + 1;
        sheet.getRange(rowIndex, 5).setValue(status); // Status
        sheet.getRange(rowIndex, 10).setValue(now); // RecordedAt
        
        if (status === 'Present' || status === 'CheckedIn') {
          sheet.getRange(rowIndex, 6).setValue(now); // CheckInTime
        }
        
        updateEventAttendeeCount(eventId);
        
        return { success: true, message: 'Attendance updated successfully' };
      }
    }
    
    // Create new record
    const newRow = [
      attendanceId,
      eventId,
      memberId,
      '', // MemberName - to be filled by frontend or lookup
      status || 'Registered',
      status === 'Present' || status === 'CheckedIn' ? now : '',
      '', // CheckOutTime
      '', // Notes
      '', // RecordedBy
      now
    ];
    
    sheet.appendRow(newRow);
    updateEventAttendeeCount(eventId);
    
    return {
      success: true,
      message: 'Attendance recorded successfully',
      attendanceId: attendanceId
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Bulk record attendance for an event
 */
function bulkRecordEventAttendance(eventId, attendanceRecords) {
  try {
    const results = [];
    
    for (const record of attendanceRecords) {
      const result = recordEventAttendance(eventId, record.memberId, record.status);
      results.push({
        memberId: record.memberId,
        success: result.success,
        message: result.message || result.error
      });
    }
    
    return {
      success: true,
      message: 'Bulk attendance recorded',
      results: results
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Delete attendance records for an event
 */
function deleteEventAttendanceRecords(eventId) {
  try {
    const ss = SpreadsheetApp.openById(getEventsSpreadsheetId());
    const sheet = ss.getSheetByName('EventAttendance');
    
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true };
    }
    
    const data = sheet.getDataRange().getValues();
    
    // Delete from bottom to top to avoid index issues
    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][1] === eventId) {
        sheet.deleteRow(i + 1);
      }
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Update the attendee count for an event
 */
function updateEventAttendeeCount(eventId) {
  try {
    const ss = SpreadsheetApp.openById(getEventsSpreadsheetId());
    const eventsSheet = ss.getSheetByName('Events');
    const attendanceSheet = ss.getSheetByName('EventAttendance');
    
    if (!eventsSheet || !attendanceSheet) return;
    
    // Count attendance records for this event
    const attendanceData = attendanceSheet.getDataRange().getValues();
    let count = 0;
    
    for (let i = 1; i < attendanceData.length; i++) {
      if (attendanceData[i][1] === eventId) {
        const status = attendanceData[i][4];
        if (status === 'Present' || status === 'CheckedIn' || status === 'Registered') {
          count++;
        }
      }
    }
    
    // Update event record - CurrentAttendees is now column 12
    const eventsData = eventsSheet.getDataRange().getValues();
    for (let i = 1; i < eventsData.length; i++) {
      if (eventsData[i][0] === eventId) {
        eventsSheet.getRange(i + 1, 12).setValue(count); // CurrentAttendees
        break;
      }
    }
  } catch (error) {
    Logger.log('Error updating attendee count: ' + error.toString());
  }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Get upcoming events
 */
function getUpcomingEvents(limit) {
  try {
    const ss = SpreadsheetApp.openById(getEventsSpreadsheetId());
    const sheet = ss.getSheetByName('Events');
    
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true, events: [] };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const events = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;
      
      const eventDate = new Date(row[3]); // StartDate (column 4, index 3)
      const status = row[12]; // Status (column 13, index 12)
      
      if (eventDate >= today && status !== 'Cancelled') {
        const event = {};
        headers.forEach((header, index) => {
          event[header] = row[index];
        });
        events.push(event);
      }
    }
    
    // Sort by StartDate ascending
    events.sort((a, b) => new Date(a.StartDate) - new Date(b.StartDate));
    
    // Limit results
    const limitedEvents = events.slice(0, parseInt(limit) || 10);
    
    return { success: true, events: limitedEvents, total: events.length };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Get past events
 */
function getPastEvents(limit) {
  try {
    const ss = SpreadsheetApp.openById(getEventsSpreadsheetId());
    const sheet = ss.getSheetByName('Events');
    
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true, events: [] };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const events = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;
      
      const eventDate = new Date(row[3]); // StartDate (column 4, index 3)
      
      if (eventDate < today) {
        const event = {};
        headers.forEach((header, index) => {
          event[header] = row[index];
        });
        events.push(event);
      }
    }
    
    // Sort by StartDate descending
    events.sort((a, b) => new Date(b.StartDate) - new Date(a.StartDate));
    
    // Limit results
    const limitedEvents = events.slice(0, parseInt(limit) || 10);
    
    return { success: true, events: limitedEvents, total: events.length };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Get event statistics
 */
function getEventStats() {
  try {
    const ss = SpreadsheetApp.openById(getEventsSpreadsheetId());
    const sheet = ss.getSheetByName('Events');
    
    if (!sheet || sheet.getLastRow() < 2) {
      return {
        success: true,
        stats: {
          totalEvents: 0,
          upcomingEvents: 0,
          pastEvents: 0,
          cancelledEvents: 0,
          totalAttendees: 0
        }
      };
    }
    
    const data = sheet.getDataRange().getValues();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let totalEvents = 0;
    let upcomingEvents = 0;
    let pastEvents = 0;
    let cancelledEvents = 0;
    let totalAttendees = 0;
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;
      
      totalEvents++;
      
      const eventDate = new Date(row[3]); // StartDate (column 4, index 3)
      const status = row[12]; // Status (column 13, index 12)
      const attendees = parseInt(row[11]) || 0; // CurrentAttendees (column 12, index 11)
      
      if (status === 'Cancelled') {
        cancelledEvents++;
      } else if (eventDate >= today) {
        upcomingEvents++;
      } else {
        pastEvents++;
      }
      
      totalAttendees += attendees;
    }
    
    return {
      success: true,
      stats: {
        totalEvents: totalEvents,
        upcomingEvents: upcomingEvents,
        pastEvents: pastEvents,
        cancelledEvents: cancelledEvents,
        totalAttendees: totalAttendees
      }
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Search events
 */
function searchEvents(searchTerm) {
  try {
    const ss = SpreadsheetApp.openById(getEventsSpreadsheetId());
    const sheet = ss.getSheetByName('Events');
    
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true, events: [] };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const searchLower = searchTerm.toLowerCase();
    const events = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;
      
      // Search in Title, Description, LocationName
      const searchableFields = [row[1], row[2], row[7]].join(' ').toLowerCase();
      
      if (searchableFields.includes(searchLower)) {
        const event = {};
        headers.forEach((header, index) => {
          event[header] = row[index];
        });
        events.push(event);
      }
    }
    
    return { success: true, events: events, total: events.length };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// =====================================================
// TESTING & DEBUG FUNCTIONS
// =====================================================

/**
 * Test function to verify the script is working
 */
function testConnection() {
  return {
    success: true,
    message: 'Events Management API is working',
    timestamp: new Date().toISOString(),
    spreadsheetId: getEventsSpreadsheetId()
  };
}

/**
 * Clear all data (use with caution!)
 * This removes all events, attendance records, but keeps categories and settings
 */
function clearAllEventData() {
  try {
    const ss = SpreadsheetApp.openById(getEventsSpreadsheetId());
    
    // Clear Events sheet (keep headers)
    const eventsSheet = ss.getSheetByName('Events');
    if (eventsSheet && eventsSheet.getLastRow() > 1) {
      eventsSheet.deleteRows(2, eventsSheet.getLastRow() - 1);
    }
    
    // Clear EventAttendance sheet (keep headers)
    const attendanceSheet = ss.getSheetByName('EventAttendance');
    if (attendanceSheet && attendanceSheet.getLastRow() > 1) {
      attendanceSheet.deleteRows(2, attendanceSheet.getLastRow() - 1);
    }
    
    return { success: true, message: 'All event data cleared' };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Get spreadsheet info for debugging
 */
function getSpreadsheetInfo() {
  try {
    const spreadsheetId = getEventsSpreadsheetId();
    
    if (!spreadsheetId) {
      return {
        success: false,
        error: 'Spreadsheet ID not set. Run initializeEventSheets() first.'
      };
    }
    
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheets = ss.getSheets().map(sheet => ({
      name: sheet.getName(),
      rows: sheet.getLastRow(),
      columns: sheet.getLastColumn()
    }));
    
    return {
      success: true,
      spreadsheetId: spreadsheetId,
      spreadsheetName: ss.getName(),
      spreadsheetUrl: ss.getUrl(),
      sheets: sheets
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}
