/**
 * =============================================================================
 * GOOGLE MEET ATTENDANCE BACKEND
 * =============================================================================
 *
 * Script Properties:
 * - MEET_SPREADSHEET_ID (recommended; dedicated spreadsheet for meet data)
 * - LOGIN_SPREADSHEET_ID (fallback only)
 * - DIRECTORY_SPREADSHEET_ID (optional; where User Profiles lives)
 * - MEET_EXTENSION_SHARED_SECRET (new, required for extension sync auth)
 *
 * Sheets:
 * - Meet_Attendance
 * - User Profiles (directory source, existing)
 */

const MEET_ATTENDANCE_CONFIG = {
  SHEET_NAME: 'Meet_Attendance',
  SCHEDULE_SHEET_NAME: 'Meet_Schedule',
  DIRECTORY_SHEET_NAME: 'User Profiles',
  SPREADSHEET_ID:
    PropertiesService.getScriptProperties().getProperty('MEET_SPREADSHEET_ID') ||
    PropertiesService.getScriptProperties().getProperty('LOGIN_SPREADSHEET_ID') ||
    '',
  DIRECTORY_SPREADSHEET_ID:
    PropertiesService.getScriptProperties().getProperty('DIRECTORY_SPREADSHEET_ID') ||
    PropertiesService.getScriptProperties().getProperty('LOGIN_SPREADSHEET_ID') ||
    PropertiesService.getScriptProperties().getProperty('MEET_SPREADSHEET_ID') ||
    '',
  EXTENSION_SECRET: PropertiesService.getScriptProperties().getProperty('MEET_EXTENSION_SHARED_SECRET') || '',
  LOGO_URL: 'https://i.imgur.com/J4wddTW.png',
};

const MEET_ATTENDANCE_HEADERS = [
  'MeetingId',
  'MeetingDate',
  'MeetingUrl',
  'ParticipantKey',
  'ParticipantName',
  'NormalizedName',
  'FirstJoinTime',
  'LastLeaveTime',
  'TotalDurationSeconds',
  'JoinCount',
  'ExitCount',
  'IsPresent',
  'IsExternalParticipant',
  'DirectoryName',
  'DirectoryIdCode',
  'ProfilePictureURL',
  'SessionsJSON',
  'LastSyncedAt',
  'Source',
  'PayloadVersion',
  'PayloadId',
  'UpdatedBy',
];

function canAccessMeetAttendanceByUsername_(username) {
  // Standalone Meet project fallback:
  // If shared auth helpers are unavailable in this GAS project, allow access.
  if (typeof getUserRoleForLoginActions_ !== 'function' || typeof canAccessPathByRole_ !== 'function') {
    return true;
  }
  const role = getUserRoleForLoginActions_(username);
  if (!role) return false;
  return canAccessPathByRole_(role, 'kaagapai-meet');
}

/**
 * Standalone Web App endpoints for the Meet-only GAS project.
 * Expected actions:
 * - syncMeetAttendance
 * - getMeetAttendance
 * - updateMeetAttendanceParticipant
 * - exportMeetAttendancePDF
 */
function doPost(e) {
  try {
    const requestData = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = sanitizeMeetText_(requestData.action);
    // Actions that use extensionSecret instead of username for auth
    const extensionAuthActions = ['syncMeetAttendance', 'registerAdHocMeeting'];
    const requiresUserAccess = action && extensionAuthActions.indexOf(action) === -1;

    if (requiresUserAccess) {
      const username = sanitizeMeetText_(requestData.username);
      if (!username) {
        return createErrorResponse('username is required', 401);
      }
      if (!canAccessMeetAttendanceByUsername_(username)) {
        return createErrorResponse('Permission denied', 403);
      }
    }

    switch (action) {
      case 'syncMeetAttendance':
        return handleSyncMeetAttendance(requestData);
      case 'getMembers':
        return handleGetMeetMembers(requestData);
      case 'getCommittees':
        return handleGetMeetCommittees();
      case 'createMeetSession':
        return handleCreateMeetSession(requestData);
      case 'registerAdHocMeeting':
        return handleRegisterAdHocMeeting(requestData);
      case 'markMeetSessionComplete':
        return handleMarkMeetSessionComplete(requestData);
      case 'getMeetDashboard':
        return handleGetMeetDashboard(requestData);
      case 'getMeetAttendance':
        return handleGetMeetAttendance(requestData);
      case 'updateMeetAttendanceParticipant':
        return handleUpdateMeetAttendanceParticipant(requestData, requestData.username || 'meet-webapp');
      case 'exportMeetAttendancePDF':
        return handleExportMeetAttendancePDF(requestData.meetingId);
      case 'checkMeetPermissions':
        return createSuccessResponse({
          success: true,
          data: checkMeetCalendarPermissions_(),
        });
      case 'checkMeetPermissionsFull':
        return createSuccessResponse({
          success: true,
          data: runMeetFullDiagnosis(),
        });
      case 'attemptMeetPermissionAutoFix':
        return createSuccessResponse({
          success: true,
          data: attemptMeetPermissionAutoFix_(),
        });
      case 'recoverMeetPermissions':
        return createSuccessResponse({
          success: true,
          data: runMeetPermissionRecovery_(),
        });
      default:
        return createErrorResponse('Unknown action: ' + action, 400);
    }
  } catch (error) {
    Logger.log('Meet doPost Error: ' + error.toString());
    return createErrorResponse('Server error: ' + error.message, 500);
  }
}

function doGet() {
  return createSuccessResponse({
    success: true,
    service: 'meet-attendance',
    status: 'online',
    timestamp: new Date().toISOString(),
  });
}

// Local response helpers for standalone Meet GAS project
function createSuccessResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function createErrorResponse(message, code) {
  return ContentService
    .createTextOutput(JSON.stringify({
      success: false,
      error: message,
      code: code || 500,
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleGetMeetMembers(requestData) {
  try {
    const search = sanitizeMeetText_(requestData.search).toLowerCase();
    const limit = Math.min(Math.max(parseInt(requestData.limit, 10) || 1000, 1), 5000);
    const members = getMeetDirectoryMembers_(search, limit);
    return createSuccessResponse({
      success: true,
      data: members,
    });
  } catch (error) {
    Logger.log('handleGetMeetMembers Error: ' + error.toString());
    return createErrorResponse('Failed to fetch members: ' + error.message, 500);
  }
}

function handleGetMeetCommittees() {
  return createSuccessResponse({
    success: true,
    data: [
      { id: 'executive-board', name: 'Executive Board' },
      { id: 'membership-internal-affairs', name: 'Membership and Internal Affairs Committee' },
      { id: 'external-relations', name: 'External Relations Committee' },
      { id: 'secretariat-documentation', name: 'Secretariat and Documentation Committee' },
      { id: 'finance-treasury', name: 'Finance and Treasury Committee' },
      { id: 'program-development', name: 'Program Development Committee' },
      { id: 'communications-marketing', name: 'Communications and Marketing Committee' },
      { id: 'barangay-chapter-leaders', name: 'Barangay Chapter Leaders' },
      { id: 'general-members', name: 'General Members' },
      { id: 'volunteers', name: 'Volunteers' },
      { id: 'probationary-members', name: 'Probationary Members' },
    ],
  });
}

function getMeetDirectoryMembers_(search, limit) {
  const out = [];
  if (!MEET_ATTENDANCE_CONFIG.DIRECTORY_SPREADSHEET_ID) return out;

  const ss = SpreadsheetApp.openById(MEET_ATTENDANCE_CONFIG.DIRECTORY_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(MEET_ATTENDANCE_CONFIG.DIRECTORY_SHEET_NAME);
  if (!sheet) return out;

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return out;
  const headers = data[0];
  const idx = {};
  headers.forEach(function (header, i) {
    idx[String(header || '').trim()] = i;
  });

  const fullNameIdx = idx['Full name'];
  const personalEmailIdx = idx['Personal Email Address'];
  const formEmailIdx = idx['Email Address'];
  const committeeIdx = idx['Committee'];
  const roleIdx = idx['Role'];
  const statusIdx = idx['Status'];
  if (fullNameIdx === undefined) return out;

  const seenEmails = {};
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const fullName = sanitizeMeetText_(row[fullNameIdx]);
    if (!fullName) continue;
    const personalEmail = personalEmailIdx !== undefined ? sanitizeMeetText_(row[personalEmailIdx]).toLowerCase() : '';
    const formEmail = formEmailIdx !== undefined ? sanitizeMeetText_(row[formEmailIdx]).toLowerCase() : '';
    const email = personalEmail || formEmail;
    if (!email) continue;

    const role = sanitizeMeetText_(roleIdx !== undefined ? row[roleIdx] : '').toLowerCase();
    const status = sanitizeMeetText_(statusIdx !== undefined ? row[statusIdx] : '').toLowerCase();
    if (role === 'banned' || status === 'banned' || status === 'suspended') continue;

    if (search) {
      const hay = (fullName + ' ' + email).toLowerCase();
      if (hay.indexOf(search) === -1) continue;
    }
    if (seenEmails[email]) continue;
    seenEmails[email] = true;

    out.push({
      name: fullName,
      email: email,
      committee: committeeIdx !== undefined ? sanitizeMeetText_(row[committeeIdx]) : '',
    });
    if (out.length >= limit) break;
  }
  return out;
}

function ensureMeetAttendanceSheet_() {
  if (!MEET_ATTENDANCE_CONFIG.SPREADSHEET_ID) {
    throw new Error('MEET_SPREADSHEET_ID is not configured');
  }

  const ss = SpreadsheetApp.openById(MEET_ATTENDANCE_CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(MEET_ATTENDANCE_CONFIG.SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(MEET_ATTENDANCE_CONFIG.SHEET_NAME);
    sheet.getRange(1, 1, 1, MEET_ATTENDANCE_HEADERS.length).setValues([MEET_ATTENDANCE_HEADERS]);
    sheet.getRange(1, 1, 1, MEET_ATTENDANCE_HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return sheet;
  }

  const existingHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), MEET_ATTENDANCE_HEADERS.length)).getValues()[0];
  let valid = true;
  for (let i = 0; i < MEET_ATTENDANCE_HEADERS.length; i++) {
    if (String(existingHeaders[i] || '').trim() !== MEET_ATTENDANCE_HEADERS[i]) {
      valid = false;
      break;
    }
  }

  if (!valid) {
    // Repair only the header row to avoid wiping existing attendance data.
    if (sheet.getMaxColumns() < MEET_ATTENDANCE_HEADERS.length) {
      sheet.insertColumnsAfter(sheet.getMaxColumns(), MEET_ATTENDANCE_HEADERS.length - sheet.getMaxColumns());
    }
    sheet.getRange(1, 1, 1, MEET_ATTENDANCE_HEADERS.length).setValues([MEET_ATTENDANCE_HEADERS]);
    sheet.getRange(1, 1, 1, MEET_ATTENDANCE_HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  return sheet;
}

const MEET_SCHEDULE_HEADERS = [
  'MeetingId',
  'Title',
  'Mode',
  'MeetUrl',
  'ScheduledStart',
  'ScheduledEnd',
  'Status',
  'CreatedAt',
  'CreatedBy',
  'CompletedAt',
  'CompletedBy',
  'Notes',
  'ExpectedAttendeesJSON',
  'EmailSentCount',
  'EmailLastSentAt',
  'CalendarEventId',
];

function ensureMeetScheduleSheet_() {
  if (!MEET_ATTENDANCE_CONFIG.SPREADSHEET_ID) {
    throw new Error('MEET_SPREADSHEET_ID is not configured');
  }

  const ss = SpreadsheetApp.openById(MEET_ATTENDANCE_CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(MEET_ATTENDANCE_CONFIG.SCHEDULE_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(MEET_ATTENDANCE_CONFIG.SCHEDULE_SHEET_NAME);
    sheet.getRange(1, 1, 1, MEET_SCHEDULE_HEADERS.length).setValues([MEET_SCHEDULE_HEADERS]);
    sheet.getRange(1, 1, 1, MEET_SCHEDULE_HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return sheet;
  }
  const existing = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), MEET_SCHEDULE_HEADERS.length)).getValues()[0];
  for (let i = 0; i < MEET_SCHEDULE_HEADERS.length; i++) {
    if (sanitizeMeetText_(existing[i]) !== MEET_SCHEDULE_HEADERS[i]) {
      sheet.getRange(1, i + 1).setValue(MEET_SCHEDULE_HEADERS[i]);
    }
  }
  sheet.getRange(1, 1, 1, MEET_SCHEDULE_HEADERS.length).setFontWeight('bold');
  return sheet;
}

function handleCreateMeetSession(requestData) {
  try {
    const username = sanitizeMeetText_(requestData.username) || 'meet-webapp';
    const mode = sanitizeMeetText_(requestData.mode).toLowerCase() === 'scheduled' ? 'scheduled' : 'instant';
    const title = sanitizeMeetText_(requestData.title) || 'KaagapAI Meet Session';
    const notes = sanitizeMeetText_(requestData.notes);
    const scheduledStart = normalizeMeetDateTimeInput_(requestData.scheduledStart);
    const scheduledEnd = normalizeMeetDateTimeInput_(requestData.scheduledEnd);
    const expectedAttendees = normalizeExpectedAttendees_(requestData.expectedAttendees);

    let startIso = scheduledStart;
    let endIso = scheduledEnd;
    const now = new Date();
    if (!startIso) startIso = now.toISOString();
    if (!endIso) {
      const end = new Date(Date.parse(startIso) + (60 * 60 * 1000));
      endIso = end.toISOString();
    }
    if ((Date.parse(endIso) || 0) <= (Date.parse(startIso) || 0)) {
      endIso = new Date(Date.parse(startIso) + (60 * 60 * 1000)).toISOString();
    }

    const meetData = createGoogleMeetLink_(title, startIso, endIso, notes, expectedAttendees);
    const meetUrl = meetData.meetUrl;
    const meetingId = generateMeetBusinessId_();
    const createdAt = new Date().toISOString();
    const emailDispatch = sendMeetInviteEmails_(expectedAttendees, {
      title: title,
      mode: mode,
      meetUrl: meetUrl,
      scheduledStart: startIso,
      scheduledEnd: endIso,
      notes: notes,
      createdBy: username,
      meetingId: meetingId,
    });

    const sheet = ensureMeetScheduleSheet_();
    sheet.appendRow([
      meetingId,
      title,
      mode,
      meetUrl,
      startIso,
      endIso,
      'ongoing',
      createdAt,
      username,
      '',
      '',
      notes,
      JSON.stringify(expectedAttendees),
      emailDispatch.sentCount,
      emailDispatch.sentAt,
      meetData.calendarEventId || '',
    ]);

    return createSuccessResponse({
      success: true,
      meeting: {
        meetingId: meetingId,
        title: title,
        mode: mode,
        meetUrl: meetUrl,
        scheduledStart: startIso,
        scheduledEnd: endIso,
        status: 'ongoing',
        createdAt: createdAt,
        createdBy: username,
        expectedAttendees: expectedAttendees,
      },
      meta: {
        calendarEventId: meetData.calendarEventId || '',
        emailSentCount: emailDispatch.sentCount,
        emailFailedCount: emailDispatch.failedCount,
      },
    });
  } catch (error) {
    Logger.log('handleCreateMeetSession Error: ' + error.toString());
    return createErrorResponse('Failed to create meeting: ' + error.message, 500);
  }
}

/**
 * Register an ad-hoc Google Meet that was not created through the frontend.
 * This creates a schedule entry for the existing meeting without creating a new link.
 * Called from the Chrome extension when tracking an unregistered meeting.
 */
function handleRegisterAdHocMeeting(requestData) {
  try {
    // Validate extension secret
    const secret = String(requestData.extensionSecret || '').trim();
    const expected = String(MEET_ATTENDANCE_CONFIG.EXTENSION_SECRET || '').trim();
    if (!expected) {
      return createErrorResponse('Server misconfigured: MEET_EXTENSION_SHARED_SECRET missing', 503);
    }
    if (!secret || secret !== expected) {
      return createErrorResponse('Unauthorized extension request', 401);
    }

    const meetCode = sanitizeMeetText_(requestData.meetCode);
    const meetUrl = sanitizeMeetText_(requestData.meetUrl) || ('https://meet.google.com/' + meetCode);
    const title = sanitizeMeetText_(requestData.title) || 'Ad-hoc Meeting';
    const notes = sanitizeMeetText_(requestData.notes) || 'Registered via YSP Meet Extension';
    const registeredBy = sanitizeMeetText_(requestData.registeredBy) || 'extension';

    if (!meetCode || !/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/i.test(meetCode)) {
      return createErrorResponse('Valid meetCode is required (e.g., abc-defg-hij)', 400);
    }

    // Check if already registered
    const existingContext = resolveMeetingSyncContext_(meetCode, meetUrl);
    if (existingContext.meetingOrigin === 'frontend' && existingContext.matchedScheduledMeetingId) {
      // Already registered - return existing info
      return createSuccessResponse({
        success: true,
        alreadyRegistered: true,
        meeting: {
          meetingId: existingContext.matchedScheduledMeetingId,
          meetCode: meetCode,
          meetUrl: meetUrl,
          origin: 'frontend',
        },
        message: 'Meeting already registered',
      });
    }

    // Register as a new scheduled meeting (ad-hoc type)
    const meetingId = generateMeetBusinessId_();
    const createdAt = new Date().toISOString();
    const startIso = createdAt;
    const endIso = new Date(Date.now() + (2 * 60 * 60 * 1000)).toISOString(); // +2 hours default

    const sheet = ensureMeetScheduleSheet_();
    sheet.appendRow([
      meetingId,                // MeetingId
      title,                    // Title
      'adhoc',                  // Mode (adhoc type)
      meetUrl,                  // MeetUrl
      startIso,                 // ScheduledStart
      endIso,                   // ScheduledEnd
      'ongoing',                // Status
      createdAt,                // CreatedAt
      registeredBy,             // CreatedBy
      '',                       // CompletedAt
      '',                       // CompletedBy
      notes,                    // Notes
      '[]',                     // ExpectedAttendees JSON
      0,                        // EmailSentCount
      '',                       // EmailSentAt
      '',                       // CalendarEventId
    ]);

    Logger.log('Ad-hoc meeting registered: ' + meetingId + ' for ' + meetCode);

    return createSuccessResponse({
      success: true,
      alreadyRegistered: false,
      meeting: {
        meetingId: meetingId,
        meetCode: meetCode,
        meetUrl: meetUrl,
        title: title,
        mode: 'adhoc',
        status: 'ongoing',
        createdAt: createdAt,
        registeredBy: registeredBy,
        origin: 'frontend',
      },
      message: 'Meeting registered successfully',
    });
  } catch (error) {
    Logger.log('handleRegisterAdHocMeeting Error: ' + error.toString());
    return createErrorResponse('Failed to register meeting: ' + error.message, 500);
  }
}

function handleMarkMeetSessionComplete(requestData) {
  try {
    const meetingId = sanitizeMeetText_(requestData.meetingId);
    const username = sanitizeMeetText_(requestData.username);
    if (!meetingId) return createErrorResponse('meetingId is required', 400);
    if (!username) return createErrorResponse('username is required', 400);
    if (!canUserCompleteMeetSession_(username)) {
      return createErrorResponse('Only Head, Admin, or Auditor can complete meetings', 403);
    }

    const sheet = ensureMeetScheduleSheet_();
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return createErrorResponse('Meeting not found', 404);

    const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    let rowIndex = -1;
    for (let i = 0; i < values.length; i++) {
      if (sanitizeMeetText_(values[i][0]) === meetingId) {
        rowIndex = i + 2;
        break;
      }
    }
    if (rowIndex === -1) return createErrorResponse('Meeting not found', 404);

    const nowIso = new Date().toISOString();
    sheet.getRange(rowIndex, 7).setValue('completed');
    sheet.getRange(rowIndex, 10).setValue(nowIso);
    sheet.getRange(rowIndex, 11).setValue(username);

    return createSuccessResponse({
      success: true,
      meetingId: meetingId,
      status: 'completed',
      completedAt: nowIso,
      completedBy: username,
    });
  } catch (error) {
    Logger.log('handleMarkMeetSessionComplete Error: ' + error.toString());
    return createErrorResponse('Failed to mark meeting complete: ' + error.message, 500);
  }
}

function handleGetMeetDashboard(requestData) {
  try {
    const limit = Math.min(Math.max(parseInt(requestData.limit, 10) || 100, 1), 300);
    const schedules = getMeetScheduleRows_();
    const attendanceSummaryByMeeting = getMeetAttendanceSummaryMap_();

    const createdMeetings = [];
    const completedMeetings = [];
    const createdIds = {};

    for (let i = 0; i < schedules.length; i++) {
      const item = schedules[i];
      createdIds[item.meetingId] = true;
      const summary = attendanceSummaryByMeeting[item.meetingId] || defaultMeetSummary_();
      const card = {
        meetingId: item.meetingId,
        meetingOrigin: 'frontend',
        title: item.title,
        mode: item.mode,
        meetUrl: item.meetUrl,
        scheduledStart: item.scheduledStart,
        scheduledEnd: item.scheduledEnd,
        status: item.status,
        createdAt: item.createdAt,
        createdBy: item.createdBy,
        completedAt: item.completedAt,
        completedBy: item.completedBy,
        notes: item.notes,
        expectedAttendees: item.expectedAttendees,
        emailSentCount: item.emailSentCount,
        emailLastSentAt: item.emailLastSentAt,
        calendarEventId: item.calendarEventId,
        attendance: summary,
      };
      if (item.status === 'completed') {
        completedMeetings.push(card);
      } else {
        createdMeetings.push(card);
      }
    }

    const manualMeetings = [];
    Object.keys(attendanceSummaryByMeeting).forEach(function (meetingId) {
      if (createdIds[meetingId]) return;
      const summary = attendanceSummaryByMeeting[meetingId];
      manualMeetings.push({
        meetingId: meetingId,
        meetingOrigin: 'manual_gmeet',
        meetingDate: summary.meetingDate,
        meetUrl: summary.meetingUrl,
        status: 'manual',
        attendance: summary,
      });
    });

    function sortDescByDate(a, b) {
      const da = Date.parse(a.createdAt || a.meetingDate || a.attendance.lastSyncedAt || '') || 0;
      const db = Date.parse(b.createdAt || b.meetingDate || b.attendance.lastSyncedAt || '') || 0;
      return db - da;
    }

    createdMeetings.sort(sortDescByDate);
    completedMeetings.sort(sortDescByDate);
    manualMeetings.sort(sortDescByDate);

    return createSuccessResponse({
      success: true,
      createdMeetings: createdMeetings.slice(0, limit),
      completedMeetings: completedMeetings.slice(0, limit),
      manualMeetings: manualMeetings.slice(0, limit),
    });
  } catch (error) {
    Logger.log('handleGetMeetDashboard Error: ' + error.toString());
    return createErrorResponse('Failed to fetch meet dashboard: ' + error.message, 500);
  }
}

function handleSyncMeetAttendance(requestData) {
  try {
    const secret = String(requestData.extensionSecret || '').trim();
    const expected = String(MEET_ATTENDANCE_CONFIG.EXTENSION_SECRET || '').trim();
    if (!expected) {
      return createErrorResponse('Server misconfigured: MEET_EXTENSION_SHARED_SECRET missing', 503);
    }
    if (!secret || secret !== expected) {
      return createErrorResponse('Unauthorized extension sync', 401);
    }

    const meeting = requestData.meeting || {};
    const incomingMeetingId = sanitizeMeetText_(meeting.id);
    const meetingDate = sanitizeMeetText_(meeting.date) || new Date().toISOString().slice(0, 10);
    const meetingUrl = sanitizeMeetText_(meeting.url);
    const syncContext = resolveMeetingSyncContext_(incomingMeetingId, meetingUrl);
    const meetingId = syncContext.meetingId;
    const attendees = Array.isArray(requestData.attendees) ? requestData.attendees : [];
    Logger.log('[SYNC DEBUG] meetingId=' + meetingId + ', incoming attendees count=' + attendees.length);
    Logger.log('[SYNC DEBUG] Raw attendees array: ' + JSON.stringify(attendees.map(function(a){ return { name: a.name, pk: a.participantKey }; })));

    if (!meetingId) {
      return createErrorResponse('meeting.id is required', 400);
    }

    const sheet = ensureMeetAttendanceSheet_();
    const directoryLookup = buildDirectoryLookupForMeet_();
    const directoryMap = directoryLookup.map;
    const directoryList = directoryLookup.list;
    const existingLookup = buildMeetExistingRowLookupForSync_(sheet, meetingId);

    let inserted = 0;
    let updated = 0;
    let externalCount = 0;
    const rowsToAppend = [];
    const updatedAt = new Date().toISOString();
    const source = sanitizeMeetText_(requestData.source) || 'meet-extension';
    const payloadVersion = sanitizeMeetText_(requestData.payloadVersion) || '1';
    const payloadId = sanitizeMeetText_(requestData.payloadId) || (meetingId + '-' + Date.now());

    Logger.log('[SYNC DEBUG] Processing ' + attendees.length + ' incoming attendees');
    for (let i = 0; i < attendees.length; i++) {
      Logger.log('[SYNC DEBUG] Attendee ' + i + ' raw: ' + JSON.stringify(attendees[i]));
      const parsed = normalizeIncomingAttendee_(attendees[i]);
      Logger.log('[SYNC DEBUG] Attendee ' + i + ' parsed: pk=' + parsed.participantKey + ', name=' + parsed.name + ', normalized=' + parsed.normalizedName);
      if (!parsed.participantKey || !parsed.name) {
        Logger.log('[SYNC DEBUG] Attendee ' + i + ' SKIPPED - missing participantKey or name');
        continue;
      }

      const directoryMatch = findBestDirectoryMatchForMeet_(parsed.normalizedName, directoryMap, directoryList);
      const isExternal = !directoryMatch;
      if (isExternal) externalCount++;

      const rowValues = [
        meetingId,
        meetingDate,
        meetingUrl,
        parsed.participantKey,
        parsed.name,
        parsed.normalizedName,
        parsed.firstJoinTime,
        parsed.lastLeaveTime,
        parsed.totalDurationSeconds,
        parsed.joinCount,
        parsed.exitCount,
        parsed.isPresent ? 'TRUE' : 'FALSE',
        isExternal ? 'TRUE' : 'FALSE',
        directoryMatch ? directoryMatch.fullName : '',
        directoryMatch ? directoryMatch.idCode : '',
        directoryMatch ? directoryMatch.profilePictureURL : '',
        JSON.stringify(parsed.sessions),
        updatedAt,
        source,
        payloadVersion,
        payloadId,
        'extension',
      ];

      const existingEntry = findMeetExistingEntryForParsed_(existingLookup, parsed);
      Logger.log('[SYNC DEBUG] Attendee ' + i + ' existingEntry found: ' + (existingEntry ? 'row ' + existingEntry.rowIndex : 'NO'));
      if (existingEntry && existingEntry.rowIndex) {
        const mergedValues = mergeMeetAttendanceRowValues_(existingEntry.rowValues, rowValues);
        sheet.getRange(existingEntry.rowIndex, 1, 1, MEET_ATTENDANCE_HEADERS.length).setValues([mergedValues]);
        Logger.log('[SYNC DEBUG] Attendee ' + i + ' UPDATED at row ' + existingEntry.rowIndex);
        updated++;
      } else {
        rowsToAppend.push(rowValues);
        Logger.log('[SYNC DEBUG] Attendee ' + i + ' QUEUED for insert');
      }
    }

    Logger.log('[SYNC DEBUG] Final: inserting ' + rowsToAppend.length + ' rows, updated ' + updated);
    if (rowsToAppend.length) {
      const startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, rowsToAppend.length, MEET_ATTENDANCE_HEADERS.length).setValues(rowsToAppend);
      inserted = rowsToAppend.length;
    }

    return createSuccessResponse({
      success: true,
      meetingId: meetingId,
      meetingOrigin: syncContext.meetingOrigin,
      matchedScheduledMeetingId: syncContext.matchedScheduledMeetingId,
      detectedMeetCode: syncContext.detectedMeetCode,
      inserted: inserted,
      updated: updated,
      externalParticipants: externalCount,
      totalIncoming: attendees.length,
      syncedAt: updatedAt,
    });
  } catch (error) {
    Logger.log('handleSyncMeetAttendance Error: ' + error.toString());
    return createErrorResponse('Failed to sync meet attendance: ' + error.message, 500);
  }
}

function handleGetMeetAttendance(requestData) {
  try {
    const meetingIdFilter = sanitizeMeetText_(requestData.meetingId);
    const limit = Math.min(Math.max(parseInt(requestData.limit, 10) || 50, 1), 200);
    const sheet = ensureMeetAttendanceSheet_();
    const lastRow = sheet.getLastRow();

    if (lastRow <= 1) {
      return createSuccessResponse({
        success: true,
        meetings: [],
        meeting: null,
      });
    }

    const values = sheet.getRange(2, 1, lastRow - 1, MEET_ATTENDANCE_HEADERS.length).getValues();
    const groups = {};
    const scheduledIdSet = getScheduledMeetingIdSet_();

    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      const meetingId = sanitizeMeetText_(row[0]);
      if (!meetingId) continue;
      if (meetingIdFilter && meetingId !== meetingIdFilter) continue;

      if (!groups[meetingId]) {
        groups[meetingId] = {
          meetingId: meetingId,
          meetingOrigin: inferMeetingOriginByMeetingId_(meetingId, scheduledIdSet),
          meetingDate: sanitizeMeetText_(row[1]),
          meetingUrl: sanitizeMeetText_(row[2]),
          attendees: [],
          totalAttendees: 0,
          externalParticipants: 0,
          totalDurationSeconds: 0,
          lastSyncedAt: sanitizeMeetText_(row[17]),
        };
      }

      const attendee = {
        participantKey: sanitizeMeetText_(row[3]),
        name: sanitizeMeetText_(row[4]),
        normalizedName: sanitizeMeetText_(row[5]),
        firstJoinTime: sanitizeMeetText_(row[6]),
        lastLeaveTime: sanitizeMeetText_(row[7]),
        totalDurationSeconds: Number(row[8] || 0),
        joinCount: Number(row[9] || 0),
        exitCount: Number(row[10] || 0),
        isPresent: String(row[11]).toUpperCase() === 'TRUE',
        isExternalParticipant: String(row[12]).toUpperCase() === 'TRUE',
        directoryName: sanitizeMeetText_(row[13]),
        directoryIdCode: sanitizeMeetText_(row[14]),
        profilePictureURL: sanitizeMeetText_(row[15]),
        committee: '',
        position: '',
      };

      groups[meetingId].attendees.push(attendee);
      groups[meetingId].totalAttendees++;
      groups[meetingId].totalDurationSeconds += attendee.totalDurationSeconds;
      if (attendee.isExternalParticipant) groups[meetingId].externalParticipants++;
      if (sanitizeMeetText_(row[17]) > groups[meetingId].lastSyncedAt) {
        groups[meetingId].lastSyncedAt = sanitizeMeetText_(row[17]);
      }
    }

    const meetings = Object.keys(groups).map(function (key) {
      return groups[key];
    });

    meetings.sort(function (a, b) {
      const da = Date.parse(a.meetingDate || a.lastSyncedAt || '') || 0;
      const db = Date.parse(b.meetingDate || b.lastSyncedAt || '') || 0;
      return db - da;
    });

    if (meetingIdFilter) {
      // Enrich attendees with committee and position from directory lookup
      if (meetings.length > 0) {
        const directoryLookup = buildDirectoryLookupForMeet_();
        const meeting = meetings[0];
        for (let a = 0; a < meeting.attendees.length; a++) {
          const attendee = meeting.attendees[a];
          const match = findBestDirectoryMatchForMeet_(attendee.normalizedName, directoryLookup.map, directoryLookup.list);
          if (match) {
            attendee.committee = match.committee || '';
            attendee.position = match.position || '';
            // Also update profilePictureURL if empty
            if (!attendee.profilePictureURL && match.profilePictureURL) {
              attendee.profilePictureURL = match.profilePictureURL;
            }
          }
        }
      }
      return createSuccessResponse({
        success: true,
        meetings: [],
        meeting: meetings.length ? meetings[0] : null,
      });
    }

    return createSuccessResponse({
      success: true,
      meetings: meetings.slice(0, limit).map(function (m) {
        return {
          meetingId: m.meetingId,
          meetingOrigin: m.meetingOrigin,
          meetingDate: m.meetingDate,
          meetingUrl: m.meetingUrl,
          totalAttendees: m.totalAttendees,
          externalParticipants: m.externalParticipants,
          totalDurationSeconds: m.totalDurationSeconds,
          lastSyncedAt: m.lastSyncedAt,
        };
      }),
      meeting: null,
    });
  } catch (error) {
    Logger.log('handleGetMeetAttendance Error: ' + error.toString());
    return createErrorResponse('Failed to fetch meet attendance: ' + error.message, 500);
  }
}

function handleUpdateMeetAttendanceParticipant(requestData, updatedBy) {
  try {
    const meetingId = sanitizeMeetText_(requestData.meetingId);
    const participantKey = sanitizeMeetText_(requestData.participantKey);
    const correctedName = sanitizeMeetText_(requestData.correctedName);

    if (!meetingId || !participantKey || !correctedName) {
      return createErrorResponse('meetingId, participantKey, and correctedName are required', 400);
    }

    const sheet = ensureMeetAttendanceSheet_();
    const rowMap = buildMeetExistingRowMap_(sheet, meetingId);
    const rowIndex = rowMap[participantKey];
    if (!rowIndex) {
      return createErrorResponse('Participant record not found', 404);
    }

    const normalized = normalizeMeetName_(correctedName);
    const directoryLookup = buildDirectoryLookupForMeet_();
    const match = findBestDirectoryMatchForMeet_(normalized, directoryLookup.map, directoryLookup.list);
    const isExternal = !match;
    const nowIso = new Date().toISOString();

    sheet.getRange(rowIndex, 5).setValue(correctedName);
    sheet.getRange(rowIndex, 6).setValue(normalized);
    sheet.getRange(rowIndex, 13).setValue(isExternal ? 'TRUE' : 'FALSE');
    sheet.getRange(rowIndex, 14).setValue(match ? match.fullName : '');
    sheet.getRange(rowIndex, 15).setValue(match ? match.idCode : '');
    sheet.getRange(rowIndex, 16).setValue(match ? match.profilePictureURL : '');
    sheet.getRange(rowIndex, 18).setValue(nowIso);
    sheet.getRange(rowIndex, 22).setValue(sanitizeMeetText_(updatedBy) || 'manual-update');

    return createSuccessResponse({
      success: true,
      meetingId: meetingId,
      participantKey: participantKey,
      correctedName: correctedName,
      isExternalParticipant: isExternal,
      updatedAt: nowIso,
    });
  } catch (error) {
    Logger.log('handleUpdateMeetAttendanceParticipant Error: ' + error.toString());
    return createErrorResponse('Failed to update participant: ' + error.message, 500);
  }
}

function handleExportMeetAttendancePDF(meetingId) {
  try {
    const safeMeetingId = sanitizeMeetText_(meetingId);
    if (!safeMeetingId) {
      return createErrorResponse('meetingId is required', 400);
    }

    const detailResponse = JSON.parse(handleGetMeetAttendance({ meetingId: safeMeetingId }).getContent());
    const meeting = detailResponse && detailResponse.meeting ? detailResponse.meeting : null;
    if (!meeting) {
      return createErrorResponse('Meeting not found', 404);
    }

    let logoBase64 = '';
    try {
      const logoBlob = UrlFetchApp.fetch(MEET_ATTENDANCE_CONFIG.LOGO_URL).getBlob();
      logoBase64 = 'data:' + logoBlob.getContentType() + ';base64,' + Utilities.base64Encode(logoBlob.getBytes());
    } catch (logoError) {
      Logger.log('Meet PDF logo fetch failed: ' + logoError.toString());
    }

    const html = createMeetAttendancePdfHtml_(meeting, logoBase64);
    const htmlBlob = Utilities.newBlob(html, MimeType.HTML, 'YSP_Meet_Attendance.html');
    const fileName = 'YSP_Meet_Attendance_' + safeMeetingId + '_' + getMeetTimestamp_() + '.pdf';
    const pdfBlob = htmlBlob.getAs(MimeType.PDF).setName(fileName);
    const driveFile = DriveApp.createFile(pdfBlob);

    return createSuccessResponse({
      success: true,
      meetingId: safeMeetingId,
      fileName: fileName,
      mimeType: 'application/pdf',
      pdfBase64: Utilities.base64Encode(pdfBlob.getBytes()),
      downloadUrl: driveFile.getUrl(),
    });
  } catch (error) {
    Logger.log('handleExportMeetAttendancePDF Error: ' + error.toString());
    return createErrorResponse('Failed to export PDF: ' + error.message, 500);
  }
}

function createMeetAttendancePdfHtml_(meeting, logoBase64) {
  const dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MM/dd/yyyy, hh:mm:ss a');
  const meetingLabel = sanitizeMeetText_(meeting.meetingId || '');
  const meetingDate = sanitizeMeetText_(meeting.meetingDate || '');
  const meetingTitle = sanitizeMeetText_(meeting.title || meeting.meetingId || 'Untitled Meeting');
  const meetingUrl = sanitizeMeetText_(meeting.meetUrl || '');
  const organizer = sanitizeMeetText_(meeting.organizer || '');
  const logoSrc = logoBase64 || MEET_ATTENDANCE_CONFIG.LOGO_URL;
  const rows = Array.isArray(meeting.attendees) ? meeting.attendees : [];

  function fmtDate(value) {
    if (!value) return '-';
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'hh:mm:ss a');
  }

  function fmtDuration(totalSeconds) {
    const sec = Math.max(0, Number(totalSeconds) || 0);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return h + 'h ' + m + 'm ' + s + 's';
  }

  const tableRows = rows
    .map(function (r, idx) {
      const displayName = escapeHtmlMeet_(r.directoryName || r.name || '');
      const committee = escapeHtmlMeet_(r.committee || '-');
      const position = escapeHtmlMeet_(r.position || '-');
      return (
        '<tr>' +
        '<td style="text-align:center;color:#64748b;font-weight:bold;">' + (idx + 1) + '</td>' +
        '<td>' + displayName + '</td>' +
        '<td>' + committee + '</td>' +
        '<td>' + position + '</td>' +
        '<td>' + escapeHtmlMeet_(fmtDate(r.firstJoinTime)) + '</td>' +
        '<td>' + escapeHtmlMeet_(fmtDuration(r.totalDurationSeconds)) + '</td>' +
        '</tr>'
      );
    })
    .join('');

  // Meeting details section
  var meetingDetailsHtml = '<div class="meeting-details">' +
    '<div class="section-heading">MEETING DETAILS</div>' +
    '<div class="details-grid">' +
    '<div class="detail-item"><span class="detail-label">Title:</span> <span class="detail-value">' + escapeHtmlMeet_(meetingTitle) + '</span></div>' +
    '<div class="detail-item"><span class="detail-label">Meeting ID:</span> <span class="detail-value">' + escapeHtmlMeet_(meetingLabel) + '</span></div>' +
    '<div class="detail-item"><span class="detail-label">Date:</span> <span class="detail-value">' + escapeHtmlMeet_(meetingDate) + '</span></div>';
  
  if (organizer) {
    meetingDetailsHtml += '<div class="detail-item"><span class="detail-label">Organizer:</span> <span class="detail-value">' + escapeHtmlMeet_(organizer) + '</span></div>';
  }
  if (meetingUrl) {
    meetingDetailsHtml += '<div class="detail-item"><span class="detail-label">Meet URL:</span> <span class="detail-value">' + escapeHtmlMeet_(meetingUrl) + '</span></div>';
  }
  meetingDetailsHtml += '<div class="detail-item"><span class="detail-label">Total Attendees:</span> <span class="detail-value">' + rows.length + '</span></div>' +
    '</div></div>';

  return (
    '<!DOCTYPE html>' +
    '<html><head><style>' +
    '@page{size:A4 landscape;margin-top:0;margin-left:0;margin-right:0;margin-bottom:50px;}' +
    'body{font-family:Helvetica,Arial,sans-serif;margin:0;padding:0;background:#fff;-webkit-print-color-adjust:exact;}' +
    '.header-banner{background:#F6421F;height:120px;width:100%;color:#fff;padding:0 50px;display:flex;align-items:center;position:relative;box-sizing:border-box;}' +
    '.logo-container{width:70px;height:70px;float:left;margin-right:25px;margin-top:25px;background:#fff;border-radius:50%;padding:5px;box-sizing:border-box;}' +
    '.logo-img{width:100%;height:100%;object-fit:contain;}' +
    '.header-text{float:left;margin-top:25px;}' +
    '.org-title{font-size:24px;font-weight:bold;margin:0;line-height:1.2;}' +
    '.chapter-subtitle{font-size:16px;font-weight:normal;margin:4px 0 0 0;opacity:.9;}' +
    '.report-label{margin-top:10px;font-size:11px;text-transform:uppercase;letter-spacing:1px;opacity:.8;}' +
    '.meta-data{position:absolute;right:50px;bottom:20px;text-align:right;font-size:10px;opacity:.9;}' +
    '.main-content{padding:30px 60px;box-sizing:border-box;width:100%;margin:0 auto;}' +
    '.section-heading{font-size:14px;font-weight:bold;border-bottom:3px solid #F6421F;padding-bottom:8px;margin-bottom:15px;display:block;text-transform:uppercase;width:100%;color:#F6421F;}' +
    '.meeting-details{margin-bottom:25px;}' +
    '.details-grid{display:flex;flex-wrap:wrap;gap:8px 30px;}' +
    '.detail-item{font-size:11px;color:#334155;}' +
    '.detail-label{font-weight:bold;color:#1e293b;}' +
    '.detail-value{color:#475569;}' +
    'table{width:100%;border-collapse:collapse;margin-bottom:20px;}' +
    'thead{display:table-header-group;}' +
    'tr{page-break-inside:avoid;}' +
    'th{font-size:10px;text-transform:uppercase;font-weight:bold;padding:12px 15px;text-align:left;background:#F6421F;color:#fff;}' +
    'td{font-size:10px;color:#334155;padding:10px 15px;border-bottom:1px solid #e2e8f0;vertical-align:top;}' +
    'tr:nth-child(even){background:#F8FAFC;}' +
    '.footer{position:fixed;bottom:0;left:0;width:100%;height:30px;background:#fff;border-top:2px solid #F6421F;padding:5px 50px;box-sizing:border-box;font-size:9px;color:#64748b;display:flex;justify-content:space-between;align-items:center;z-index:9999;}' +
    '</style></head><body>' +
    '<div class="header-banner">' +
    '<div class="logo-container"><img src="' + logoSrc + '" class="logo-img"></div>' +
    '<div class="header-text">' +
    '<div class="org-title">Youth Service Philippines</div>' +
    '<div class="chapter-subtitle">Tagum Chapter</div>' +
    '<div class="report-label">GOOGLE MEET ATTENDANCE REPORT</div>' +
    '</div>' +
    '<div class="meta-data">Exported: ' + dateStr + '</div>' +
    '</div>' +
    '<div class="main-content">' +
    meetingDetailsHtml +
    '<div class="section-heading">ATTENDANCE LIST</div>' +
    '<table>' +
    '<thead><tr><th style="width:5%;text-align:center;">#</th><th style="width:30%;">NAME</th><th style="width:20%;">COMMITTEE</th><th style="width:20%;">POSITION</th><th style="width:13%;">JOIN TIME</th><th style="width:12%;">DURATION</th></tr></thead>' +
    '<tbody>' + tableRows + '</tbody></table>' +
    '</div>' +
    '<div class="footer"><span>Youth Service Philippines - Tagum Chapter</span></div>' +
    '</body></html>'
  );
}

function buildMeetExistingRowLookupForSync_(sheet, meetingId) {
  const lookup = {};
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return lookup;

  const values = sheet.getRange(2, 1, lastRow - 1, MEET_ATTENDANCE_HEADERS.length).getValues();
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rowMeetingId = sanitizeMeetText_(row[0]);
    if (rowMeetingId !== meetingId) continue;
    const rowIndex = i + 2;
    const participantKey = sanitizeMeetText_(row[3]);
    const participantName = sanitizeMeetText_(row[4]);
    const normalizedName = sanitizeMeetText_(row[5]) || normalizeMeetName_(participantName);
    const entry = { rowIndex: rowIndex, rowValues: row };

    if (participantKey) lookup['pk:' + participantKey] = entry;
    if (normalizedName) lookup['nn:' + normalizedName] = entry;
    if (participantName) lookup['nm:' + normalizeMeetName_(participantName)] = entry;
  }

  return lookup;
}

function findMeetExistingEntryForParsed_(lookup, parsed) {
  const participantKey = sanitizeMeetText_(parsed && parsed.participantKey);
  const normalizedName = sanitizeMeetText_(parsed && parsed.normalizedName);
  const normalizedFromName = normalizeMeetName_(sanitizeMeetText_(parsed && parsed.name));
  return (
    (participantKey && lookup['pk:' + participantKey]) ||
    (normalizedName && lookup['nn:' + normalizedName]) ||
    (normalizedFromName && lookup['nm:' + normalizedFromName]) ||
    null
  );
}

function mergeMeetAttendanceRowValues_(existingRow, incomingRow) {
  const prev = Array.isArray(existingRow) ? existingRow : [];
  const next = Array.isArray(incomingRow) ? incomingRow.slice(0) : [];

  function parseIso(value) {
    const t = Date.parse(sanitizeMeetText_(value));
    return isNaN(t) ? 0 : t;
  }
  function pickEarliestIso(a, b) {
    const ta = parseIso(a);
    const tb = parseIso(b);
    if (!ta) return sanitizeMeetText_(b);
    if (!tb) return sanitizeMeetText_(a);
    return ta <= tb ? sanitizeMeetText_(a) : sanitizeMeetText_(b);
  }
  function pickLatestIso(a, b) {
    const ta = parseIso(a);
    const tb = parseIso(b);
    if (!ta) return sanitizeMeetText_(b);
    if (!tb) return sanitizeMeetText_(a);
    return ta >= tb ? sanitizeMeetText_(a) : sanitizeMeetText_(b);
  }
  function asBoolString(value) {
    return String(value).toUpperCase() === 'TRUE' ? 'TRUE' : 'FALSE';
  }
  function asNumber(value) {
    const n = Number(value || 0);
    return isNaN(n) ? 0 : n;
  }
  function isSyntheticName(value) {
    return /^external participant #?\d+$/i.test(sanitizeMeetText_(value));
  }
  function pickPreferredName(prevName, nextName) {
    const a = sanitizeMeetText_(prevName);
    const b = sanitizeMeetText_(nextName);
    if (!a) return b;
    if (!b) return a;
    if (isSyntheticName(a) && !isSyntheticName(b)) return b;
    if (isSyntheticName(b) && !isSyntheticName(a)) return a;
    return b;
  }

  next[3] = pickPreferredName(prev[3], next[3]); // ParticipantKey
  next[4] = pickPreferredName(prev[4], next[4]); // ParticipantName
  next[5] = pickPreferredName(prev[5], next[5]); // NormalizedName
  next[6] = pickEarliestIso(prev[6], next[6]); // FirstJoinTime
  next[7] = pickLatestIso(prev[7], next[7]); // LastLeaveTime
  next[8] = Math.max(asNumber(prev[8]), asNumber(next[8])); // TotalDurationSeconds
  next[9] = Math.max(asNumber(prev[9]), asNumber(next[9])); // JoinCount
  next[10] = Math.max(asNumber(prev[10]), asNumber(next[10])); // ExitCount
  next[11] = (asBoolString(prev[11]) === 'TRUE' || asBoolString(next[11]) === 'TRUE') ? 'TRUE' : 'FALSE'; // IsPresent
  next[12] = (asBoolString(prev[12]) === 'TRUE' || asBoolString(next[12]) === 'TRUE') ? 'TRUE' : 'FALSE'; // IsExternalParticipant

  // Keep richer sessions payload when one side is clearly more complete.
  const prevSessions = sanitizeMeetText_(prev[16]);
  const nextSessions = sanitizeMeetText_(next[16]);
  if (prevSessions && prevSessions.length > nextSessions.length) {
    next[16] = prevSessions;
  }

  return next;
}

function buildMeetExistingRowMap_(sheet, meetingId) {
  const map = {};
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return map;

  const values = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  for (let i = 0; i < values.length; i++) {
    const rowMeetingId = sanitizeMeetText_(values[i][0]);
    const participantKey = sanitizeMeetText_(values[i][3]);
    if (rowMeetingId === meetingId && participantKey) {
      map[participantKey] = i + 2;
    }
  }
  return map;
}

function buildDirectoryMapForMeet_() {
  return buildDirectoryLookupForMeet_().map;
}

function buildDirectoryLookupForMeet_() {
  const map = {};
  const list = [];
  if (!MEET_ATTENDANCE_CONFIG.DIRECTORY_SPREADSHEET_ID) return { map: map, list: list };

  const ss = SpreadsheetApp.openById(MEET_ATTENDANCE_CONFIG.DIRECTORY_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(MEET_ATTENDANCE_CONFIG.DIRECTORY_SHEET_NAME);
  if (!sheet) return { map: map, list: list };

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { map: map, list: list };
  const headers = data[0];
  const idx = {};
  headers.forEach(function (header, i) {
    idx[String(header || '').trim()] = i;
  });

  const fullNameIdx = idx['Full name'];
  const idCodeIdx = idx['ID Code'];
  const picIdx = idx['ProfilePictureURL'];
  const roleIdx = idx['Role'];
  const statusIdx = idx['Status'];
  const committeeIdx = idx['Committee'];
  const positionIdx = idx['Position'];
  if (fullNameIdx === undefined) return { map: map, list: list };

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const fullName = sanitizeMeetText_(row[fullNameIdx]);
    if (!fullName) continue;
    const normalized = normalizeMeetName_(fullName);
    if (!normalized) continue;

    const role = sanitizeMeetText_(roleIdx !== undefined ? row[roleIdx] : '').toLowerCase();
    const status = sanitizeMeetText_(statusIdx !== undefined ? row[statusIdx] : '').toLowerCase();
    if (role === 'banned' || status === 'banned' || status === 'suspended') {
      continue;
    }

    if (!map[normalized]) {
      const entry = {
        fullName: fullName,
        normalizedName: normalized,
        idCode: idCodeIdx !== undefined ? sanitizeMeetText_(row[idCodeIdx]) : '',
        profilePictureURL: picIdx !== undefined ? sanitizeMeetText_(row[picIdx]) : '',
        committee: committeeIdx !== undefined ? sanitizeMeetText_(row[committeeIdx]) : '',
        position: positionIdx !== undefined ? sanitizeMeetText_(row[positionIdx]) : '',
      };
      map[normalized] = entry;
      list.push(entry);
    }
  }

  return { map: map, list: list };
}

function findBestDirectoryMatchForMeet_(normalizedName, directoryMap, directoryList) {
  const key = sanitizeMeetText_(normalizedName);
  if (!key) return null;
  
  // 1. Exact match
  if (directoryMap && directoryMap[key]) return directoryMap[key];

  const list = Array.isArray(directoryList) ? directoryList : [];
  if (!list.length) return null;

  const inputTokens = key.split(/\s+/).filter(function(t) { return t.length >= 2; });
  if (!inputTokens.length) return null;

  // Build candidates with multiple scoring strategies
  var candidates = [];
  
  for (var i = 0; i < list.length; i++) {
    var item = list[i];
    if (!item || !item.normalizedName) continue;
    
    var dirName = item.normalizedName;
    var dirTokens = dirName.split(/\s+/).filter(function(t) { return t.length >= 2; });
    
    var scores = [];
    
    // Strategy 1: Levenshtein similarity on full normalized name
    var levScore = computeMeetNameSimilarity_(key, dirName);
    scores.push({ type: 'levenshtein', score: levScore });
    
    // Strategy 2: Token containment - how many input tokens are in directory name
    var containedCount = 0;
    for (var j = 0; j < inputTokens.length; j++) {
      if (dirName.indexOf(inputTokens[j]) !== -1) containedCount++;
    }
    var tokenContainScore = inputTokens.length > 0 ? containedCount / inputTokens.length : 0;
    scores.push({ type: 'tokenContain', score: tokenContainScore });
    
    // Strategy 3: Token overlap (Jaccard-like)
    var inputSet = {};
    var dirSet = {};
    for (var j = 0; j < inputTokens.length; j++) inputSet[inputTokens[j]] = true;
    for (var j = 0; j < dirTokens.length; j++) dirSet[dirTokens[j]] = true;
    var intersection = 0;
    for (var t in inputSet) {
      if (dirSet[t]) intersection++;
    }
    var union = Object.keys(inputSet).length + Object.keys(dirSet).length - intersection;
    var jaccardScore = union > 0 ? intersection / union : 0;
    scores.push({ type: 'jaccard', score: jaccardScore });
    
    // Strategy 4: First token matching (first name match)
    var firstNameScore = 0;
    if (inputTokens[0] && dirTokens.length > 0) {
      for (var j = 0; j < dirTokens.length; j++) {
        var sim = computeMeetNameSimilarity_(inputTokens[0], dirTokens[j]);
        if (sim > firstNameScore) firstNameScore = sim;
      }
    }
    scores.push({ type: 'firstName', score: firstNameScore });
    
    // Strategy 5: Substring check - input is substring of directory name or vice versa
    var substringScore = 0;
    if (dirName.indexOf(key) !== -1) substringScore = 0.95;
    else if (key.indexOf(dirName) !== -1) substringScore = 0.9;
    scores.push({ type: 'substring', score: substringScore });
    
    // Strategy 6: Sorted tokens comparison (handles name reordering)
    var sortedInput = inputTokens.slice().sort().join(' ');
    var sortedDir = dirTokens.slice().sort().join(' ');
    var sortedScore = computeMeetNameSimilarity_(sortedInput, sortedDir);
    scores.push({ type: 'sorted', score: sortedScore });
    
    // Compute weighted best score
    // Prioritize: levenshtein (strong), sorted (name order), tokenContain, jaccard
    var weightedScore = Math.max(
      levScore,
      sortedScore * 0.98,
      substringScore,
      (tokenContainScore >= 0.8 && firstNameScore >= 0.9) ? 0.88 : 0,
      (jaccardScore >= 0.5 && firstNameScore >= 0.85) ? 0.85 : 0
    );
    
    if (weightedScore > 0.5) {
      candidates.push({
        item: item,
        score: weightedScore,
        levScore: levScore,
        scores: scores
      });
    }
  }
  
  // Sort by score descending
  candidates.sort(function(a, b) { return b.score - a.score; });
  
  // Return best match if score >= 0.75 (lowered threshold for better matching)
  if (candidates.length > 0 && candidates[0].score >= 0.75) {
    return candidates[0].item;
  }
  
  return null;
}

function computeMeetNameSimilarity_(a, b) {
  const left = sanitizeMeetText_(a);
  const right = sanitizeMeetText_(b);
  if (!left || !right) return 0;
  if (left === right) return 1;

  const sortedLeft = left.split(' ').filter(Boolean).sort().join(' ');
  const sortedRight = right.split(' ').filter(Boolean).sort().join(' ');
  if (sortedLeft && sortedLeft === sortedRight) return 1;

  const maxLen = Math.max(left.length, right.length);
  if (maxLen <= 0) return 0;
  const dist = levenshteinMeet_(left, right);
  return Math.max(0, 1 - (dist / maxLen));
}

function levenshteinMeet_(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = [];
  for (let i = 0; i <= m; i++) {
    dp[i] = [i];
  }
  for (let j = 1; j <= n; j++) {
    dp[0][j] = j;
  }
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

function normalizeIncomingAttendee_(attendee) {
  const name = sanitizeMeetText_(attendee.name);
  if (!isLikelyMeetParticipantName_(name)) {
    return {
      participantKey: '',
      name: '',
      normalizedName: '',
      firstJoinTime: '',
      lastLeaveTime: '',
      totalDurationSeconds: 0,
      joinCount: 0,
      exitCount: 0,
      isPresent: false,
      sessions: [],
    };
  }
  const normalizedName = sanitizeMeetText_(attendee.normalizedName) || normalizeMeetName_(name);
  const participantKey = sanitizeMeetText_(attendee.participantKey) || normalizedName;
  const firstJoinTime = sanitizeMeetText_(attendee.firstJoinTime);
  const lastLeaveTime = sanitizeMeetText_(attendee.lastLeaveTime);
  const totalDurationSeconds = Math.max(0, Number(attendee.totalDurationSeconds || 0));
  const joinCount = Math.max(0, Number(attendee.joinCount || 0));
  const exitCount = Math.max(0, Number(attendee.exitCount || 0));
  const isPresent = !!attendee.isPresent;
  const sessions = Array.isArray(attendee.sessions) ? attendee.sessions : [];

  return {
    participantKey: participantKey,
    name: name,
    normalizedName: normalizedName,
    firstJoinTime: firstJoinTime,
    lastLeaveTime: lastLeaveTime,
    totalDurationSeconds: totalDurationSeconds,
    joinCount: joinCount,
    exitCount: exitCount,
    isPresent: isPresent,
    sessions: sessions.slice(0, 1000),
  };
}

function isLikelyMeetParticipantName_(value) {
  const cleaned = sanitizeMeetText_(value);
  if (!cleaned) return false;
  if (cleaned.length < 2 || cleaned.length > 80) return false;
  if (!/[a-z0-9]/i.test(cleaned)) return false;

  const lower = cleaned.toLowerCase();
  
  // Comprehensive list of Google Meet UI action texts and button labels to filter out
  const disallowed = [
    // Original disallowed
    'more options for',
    'more_vert',
    'frame_person',
    'reframe',
    'visual effects',
    'backgrounds and effects',
    'others might still see your full video',
    'present now',
    'meeting details',
    'raise hand',
    'leave call',
    'camera off',
    'microphone off',
    'search',
    'people',
    'chat',
    // Admit/Deny actions
    'admit',
    'deny',
    'deny entry',
    'admit all',
    'deny all',
    'waiting',
    'let in',
    'remove',
    'remove from call',
    'remove participant',
    // Hand raise actions
    'lower hand',
    'raised hand',
    'hand raised',
    'hands',
    // Reactions
    'react',
    'reactions',
    'send a reaction',
    'thumbs up',
    'thumbs down',
    'clap',
    'heart',
    'joy',
    'surprised',
    'thinking',
    'tada',
    'party popper',
    // Pin/Spotlight actions
    'pin',
    'unpin',
    'pin to main screen',
    'spotlight',
    'add spotlight',
    'remove spotlight',
    // Audio/Video controls
    'mute',
    'unmute',
    'mute all',
    'turn off camera',
    'turn on camera',
    'turn off microphone',
    'turn on microphone',
    'stop video',
    'start video',
    'host controls',
    'co-host',
    'make host',
    'make co-host',
    // Presentation
    'present',
    'stop presenting',
    'share screen',
    'share audio',
    'share a tab',
    'your entire screen',
    'a window',
    'a chrome tab',
    // Captions
    'captions',
    'turn on captions',
    'turn off captions',
    'live captions',
    // Effects and settings
    'apply visual effects',
    'change background',
    'blur',
    'blur background',
    'settings',
    'audio settings',
    'video settings',
    // Breakout rooms
    'breakout rooms',
    'join room',
    'leave room',
    'open rooms',
    'close rooms',
    // Whiteboard
    'whiteboard',
    'start whiteboard',
    'open whiteboard',
    // Recording
    'record',
    'start recording',
    'stop recording',
    'recording',
    // Live stream
    'live stream',
    'start live stream',
    'stop live stream',
    // Q&A and Polls
    'q&a',
    'questions',
    'polls',
    'start poll',
    // Activities
    'activities',
    'activity',
    // General UI elements
    'more actions',
    'more',
    'show more',
    'show less',
    'close',
    'cancel',
    'confirm',
    'ok',
    'yes',
    'no',
    'done',
    'save',
    'apply',
    'expand',
    'collapse',
    'minimize',
    'maximize',
    'fullscreen',
    'exit fullscreen',
    'add people',
    'invite',
    'copy joining info',
    'info',
    'details',
    // Status indicators
    'presenting',
    'speaking',
    'muted',
    'mic off',
    'cam off',
    'poor connection',
    'reconnecting',
    'you',
    '(you)',
    // Layout
    'tiled',
    'spotlight',
    'sidebar',
    'auto',
    'layout',
    'change layout',
    // Waiting room
    'waiting room',
    'lobby',
    'in the waiting room',
    'ask to join',
    'joining',
    // Time/Duration
    'started at',
    'call started',
    'elapsed time',
    // Empty/default states
    'no one else is here',
    'waiting for others',
    'you are the only one here',
  ];
  
  for (let i = 0; i < disallowed.length; i++) {
    if (lower === disallowed[i] || lower.indexOf(disallowed[i]) !== -1) return false;
  }

  // Also check for exact match with common single-word actions
  const exactDisallowed = [
    'admit', 'deny', 'pin', 'unpin', 'mute', 'unmute', 'remove', 'hand',
    'react', 'present', 'you', 'more', 'close', 'cancel', 'ok', 'yes', 'no',
    'done', 'save', 'apply', 'info', 'host', 'muted', 'call', 'waiting',
  ];
  if (exactDisallowed.indexOf(lower) !== -1) return false;

  // Check if string is just repeated characters or patterns
  if (cleaned.length % 2 === 0 && cleaned.length >= 8) {
    const half = cleaned.length / 2;
    if (cleaned.slice(0, half) === cleaned.slice(half)) return false;
  }

  // Filter out strings that are mostly numbers (like phone numbers or IDs)
  const alphaCount = (cleaned.match(/[a-z]/gi) || []).length;
  if (alphaCount < 2) return false;

  return true;
}

function sanitizeMeetText_(value) {
  return String(value == null ? '' : value)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
}

function normalizeMeetName_(value) {
  return sanitizeMeetText_(value)
    .toLowerCase()
    .replace(/\(you\)/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtmlMeet_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getMeetTimestamp_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
}

function getMeetScheduleRows_() {
  const sheet = ensureMeetScheduleSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, MEET_SCHEDULE_HEADERS.length).getValues();
  const rows = [];
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const meetingId = sanitizeMeetText_(row[0]);
    if (!meetingId) continue;
    rows.push({
      meetingId: meetingId,
      title: sanitizeMeetText_(row[1]),
      mode: sanitizeMeetText_(row[2]) || 'instant',
      meetUrl: sanitizeMeetText_(row[3]),
      scheduledStart: sanitizeMeetText_(row[4]),
      scheduledEnd: sanitizeMeetText_(row[5]),
      status: sanitizeMeetText_(row[6]) || 'ongoing',
      createdAt: sanitizeMeetText_(row[7]),
      createdBy: sanitizeMeetText_(row[8]),
      completedAt: sanitizeMeetText_(row[9]),
      completedBy: sanitizeMeetText_(row[10]),
      notes: sanitizeMeetText_(row[11]),
      expectedAttendees: parseExpectedAttendees_(row[12]),
      emailSentCount: Number(row[13] || 0),
      emailLastSentAt: sanitizeMeetText_(row[14]),
      calendarEventId: sanitizeMeetText_(row[15]),
    });
  }
  return rows;
}

function getMeetAttendanceSummaryMap_() {
  const sheet = ensureMeetAttendanceSheet_();
  const lastRow = sheet.getLastRow();
  const out = {};
  const scheduledIdSet = getScheduledMeetingIdSet_();
  if (lastRow <= 1) return out;
  const values = sheet.getRange(2, 1, lastRow - 1, MEET_ATTENDANCE_HEADERS.length).getValues();
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const source = sanitizeMeetText_(row[18]).toLowerCase();
    const payloadId = sanitizeMeetText_(row[20]).toLowerCase();
    // Skip one-off manual test payload rows from dashboard sections.
    if (source === 'manual-test' || payloadId.indexOf('test-') === 0) continue;
    const meetingId = sanitizeMeetText_(row[0]);
    if (!meetingId) continue;
    if (!out[meetingId]) {
      out[meetingId] = defaultMeetSummary_();
      out[meetingId].meetingId = meetingId;
      out[meetingId].meetingOrigin = inferMeetingOriginByMeetingId_(meetingId, scheduledIdSet);
      out[meetingId].meetingDate = sanitizeMeetText_(row[1]);
      out[meetingId].meetingUrl = sanitizeMeetText_(row[2]);
    }
    const s = out[meetingId];
    const isPresent = String(row[11]).toUpperCase() === 'TRUE';
    const isExternal = String(row[12]).toUpperCase() === 'TRUE';
    s.totalAttendees++;
    if (isPresent) s.currentlyInMeeting++;
    if (isExternal) s.externalParticipants++;
    s.totalDurationSeconds += Number(row[8] || 0);
    const synced = sanitizeMeetText_(row[17]);
    if (synced > s.lastSyncedAt) s.lastSyncedAt = synced;
  }
  return out;
}

function defaultMeetSummary_() {
  return {
    meetingId: '',
    meetingOrigin: '',
    meetingDate: '',
    meetingUrl: '',
    totalAttendees: 0,
    currentlyInMeeting: 0,
    externalParticipants: 0,
    totalDurationSeconds: 0,
    lastSyncedAt: '',
  };
}

function extractMeetIdFromUrl_(url) {
  const safe = sanitizeMeetText_(url);
  const m = safe.match(/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i);
  return m ? m[1].toLowerCase() : '';
}

function generateMeetBusinessId_() {
  const sheet = ensureMeetScheduleSheet_();
  const now = new Date();
  const yy = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yy');
  const prefix = 'YSPTMB-' + yy;

  let next = 1;
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      const id = sanitizeMeetText_(ids[i][0]);
      const match = id.match(new RegExp('^' + prefix + '(\\d{3})$'));
      if (!match) continue;
      const num = Number(match[1] || 0);
      if (num >= next) next = num + 1;
    }
  }
  const serial = ('000' + next).slice(-3);
  return prefix + serial;
}

function resolveMeetingSyncContext_(incomingMeetingId, meetingUrl) {
  const fromPayload = sanitizeMeetText_(incomingMeetingId);
  const fromUrl = extractMeetIdFromUrl_(meetingUrl);
  const payloadLooksLikeMeetCode = /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/i.test(fromPayload);
  const detectedMeetCode = (fromUrl || (payloadLooksLikeMeetCode ? fromPayload : '') || '').toLowerCase();

  // If payload is already a known scheduled business ID, trust it.
  if (fromPayload && !payloadLooksLikeMeetCode) {
    const scheduledIds = getScheduledMeetingIdSet_();
    if (scheduledIds[fromPayload]) {
      return {
        meetingId: fromPayload,
        meetingOrigin: 'frontend',
        matchedScheduledMeetingId: fromPayload,
        detectedMeetCode: detectedMeetCode,
      };
    }
  }

  if (!detectedMeetCode) {
    return {
      meetingId: fromPayload || '',
      meetingOrigin: 'manual_gmeet',
      matchedScheduledMeetingId: '',
      detectedMeetCode: '',
    };
  }

  const schedules = getMeetScheduleRows_();
  for (let i = 0; i < schedules.length; i++) {
    const row = schedules[i];
    const rowCode = extractMeetIdFromUrl_(row.meetUrl);
    if (!rowCode) continue;
    if (rowCode === detectedMeetCode) {
      return {
        meetingId: row.meetingId,
        meetingOrigin: 'frontend',
        matchedScheduledMeetingId: row.meetingId,
        detectedMeetCode: detectedMeetCode,
      };
    }
  }

  return {
    meetingId: fromPayload || detectedMeetCode,
    meetingOrigin: 'manual_gmeet',
    matchedScheduledMeetingId: '',
    detectedMeetCode: detectedMeetCode,
  };
}

function resolveMeetingIdForSync_(incomingMeetingId, meetingUrl) {
  return resolveMeetingSyncContext_(incomingMeetingId, meetingUrl).meetingId;
}

function getScheduledMeetingIdSet_() {
  const schedules = getMeetScheduleRows_();
  const set = {};
  for (let i = 0; i < schedules.length; i++) {
    const id = sanitizeMeetText_(schedules[i].meetingId);
    if (!id) continue;
    set[id] = true;
  }
  return set;
}

function inferMeetingOriginByMeetingId_(meetingId, scheduledIdSet) {
  const id = sanitizeMeetText_(meetingId);
  if (!id) return 'manual_gmeet';
  const set = scheduledIdSet || getScheduledMeetingIdSet_();
  return set[id] ? 'frontend' : 'manual_gmeet';
}

function canUserCompleteMeetSession_(username) {
  const uname = sanitizeMeetText_(username).toLowerCase();
  if (!uname) return false;
  if (!MEET_ATTENDANCE_CONFIG.DIRECTORY_SPREADSHEET_ID) return false;

  try {
    const ss = SpreadsheetApp.openById(MEET_ATTENDANCE_CONFIG.DIRECTORY_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(MEET_ATTENDANCE_CONFIG.DIRECTORY_SHEET_NAME);
    if (!sheet) return false;
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return false;
    const headers = data[0];
    const idx = {
      username: headers.indexOf('Username'),
      role: headers.indexOf('Role'),
      position: headers.indexOf('Position'),
    };
    if (idx.username < 0) return false;

    for (let i = 1; i < data.length; i++) {
      const rowUname = sanitizeMeetText_(data[i][idx.username]).toLowerCase();
      if (rowUname !== uname) continue;
      const role = sanitizeMeetText_(idx.role >= 0 ? data[i][idx.role] : '').toLowerCase();
      const position = sanitizeMeetText_(idx.position >= 0 ? data[i][idx.position] : '').toLowerCase();
      if (role.indexOf('auditor') !== -1 || role.indexOf('admin') !== -1 || role === 'head') return true;
      if (position.indexOf('head') !== -1 || position.indexOf('president') !== -1) return true;
      return false;
    }
  } catch (error) {
    Logger.log('canUserCompleteMeetSession_ Error: ' + error.toString());
  }
  return false;
}

function createGoogleMeetLink_(title, startIso, endIso, notes, expectedAttendees) {
  // Always require a real, pre-created Google Meet room from Calendar API.
  if (typeof Calendar === 'undefined' || !Calendar || !Calendar.Events || typeof Calendar.Events.insert !== 'function') {
    throw new Error('Google Calendar advanced service is not enabled for this deployment');
  }

  try {
    const attendees = (Array.isArray(expectedAttendees) ? expectedAttendees : [])
      .filter(function (a) { return a && a.email; })
      .map(function (a) { return { email: a.email }; });
    const req = {
      summary: title,
      description: notes || '',
      start: { dateTime: startIso },
      end: { dateTime: endIso },
      attendees: attendees,
      conferenceData: {
        createRequest: {
          requestId: Utilities.getUuid(),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    };
    const event = Calendar.Events.insert(req, 'primary', {
      conferenceDataVersion: 1,
      sendUpdates: 'none',
    });
    const fromHangout = sanitizeMeetText_(event && event.hangoutLink);
    if (fromHangout && fromHangout.indexOf('meet.google.com') !== -1) {
      return { meetUrl: fromHangout, calendarEventId: sanitizeMeetText_(event.id) };
    }
    const entryPoints = event && event.conferenceData && event.conferenceData.entryPoints;
    if (entryPoints && entryPoints.length) {
      for (let i = 0; i < entryPoints.length; i++) {
        const uri = sanitizeMeetText_(entryPoints[i].uri);
        if (uri && uri.indexOf('meet.google.com') !== -1) {
          return { meetUrl: uri, calendarEventId: sanitizeMeetText_(event.id) };
        }
      }
    }
    throw new Error('Calendar event was created but no Google Meet join link was returned');
  } catch (error) {
    Logger.log('createGoogleMeetLink_ failed: ' + error.toString());
    throw new Error(formatMeetCalendarErrorMessage_(error));
  }
}

function formatMeetCalendarErrorMessage_(error) {
  const raw = String((error && (error.message || error.toString())) || '');
  const lower = raw.toLowerCase();

  const missingAdvancedService =
    lower.indexOf('calendar advanced service') !== -1 ||
    lower.indexOf('calendar is not defined') !== -1 ||
    lower.indexOf('calendar.events') !== -1 && lower.indexOf('undefined') !== -1;

  if (missingAdvancedService) {
    return 'Unable to create an actual Google Meet room. Calendar advanced service is not enabled in this deployment.';
  }

  const missingScope =
    lower.indexOf('insufficient permission') !== -1 ||
    lower.indexOf('insufficientpermissions') !== -1 ||
    lower.indexOf('calendar.events.insert') !== -1 ||
    lower.indexOf('www.googleapis.com/auth/calendar.events') !== -1 ||
    lower.indexOf('not have permission') !== -1 ||
    lower.indexOf('request had insufficient authentication scopes') !== -1;

  if (missingScope) {
    return 'Unable to create an actual Google Meet room. Missing Calendar scope (https://www.googleapis.com/auth/calendar.events). Reauthorize and redeploy the Meet web app.';
  }

  return 'Unable to create an actual Google Meet room. ' + raw;
}

/**
 * Diagnose whether this deployment can create real Google Meet links via Calendar API.
 * Safe to run manually from Apps Script editor:
 * - runMeetPermissionCheck()
 */
function checkMeetCalendarPermissions_() {
  const diagnostics = {
    success: false,
    timestamp: new Date().toISOString(),
    calendarAdvancedServiceEnabled: false,
    eventsInsertAvailable: false,
    canCreateCalendarEvent: false,
    canGenerateMeetLink: false,
    testCalendarEventId: '',
    testMeetUrl: '',
    cleanupStatus: '',
    requiredConfig: {
      advancedService: 'Calendar API (v3) in appsscript.json dependencies.enabledAdvancedServices',
      oauthScope: 'https://www.googleapis.com/auth/calendar.events',
      cloudApi: 'Google Calendar API enabled in linked Google Cloud project',
    },
    error: '',
  };

  diagnostics.calendarAdvancedServiceEnabled = !!(
    typeof Calendar !== 'undefined' &&
    Calendar &&
    Calendar.Events
  );
  diagnostics.eventsInsertAvailable = !!(
    diagnostics.calendarAdvancedServiceEnabled &&
    typeof Calendar.Events.insert === 'function'
  );

  if (!diagnostics.eventsInsertAvailable) {
    diagnostics.error = 'Calendar advanced service is not enabled for this deployment';
    return diagnostics;
  }

  let testEventId = '';
  try {
    const start = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    const end = new Date(Date.now() + 17 * 60 * 1000).toISOString();
    const req = {
      summary: 'YSP Meet Permission Check (Auto Cleanup)',
      description: 'Temporary event created by runMeetPermissionCheck().',
      start: { dateTime: start },
      end: { dateTime: end },
      conferenceData: {
        createRequest: {
          requestId: Utilities.getUuid(),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    };

    const event = Calendar.Events.insert(req, 'primary', {
      conferenceDataVersion: 1,
      sendUpdates: 'none',
    });

    testEventId = sanitizeMeetText_(event && event.id);
    diagnostics.testCalendarEventId = testEventId;
    diagnostics.canCreateCalendarEvent = !!testEventId;

    const fromHangout = sanitizeMeetText_(event && event.hangoutLink);
    if (fromHangout && fromHangout.indexOf('meet.google.com') !== -1) {
      diagnostics.testMeetUrl = fromHangout;
      diagnostics.canGenerateMeetLink = true;
    } else {
      const entryPoints = event && event.conferenceData && event.conferenceData.entryPoints;
      if (entryPoints && entryPoints.length) {
        for (let i = 0; i < entryPoints.length; i++) {
          const uri = sanitizeMeetText_(entryPoints[i].uri);
          if (uri && uri.indexOf('meet.google.com') !== -1) {
            diagnostics.testMeetUrl = uri;
            diagnostics.canGenerateMeetLink = true;
            break;
          }
        }
      }
    }

    diagnostics.success = diagnostics.canCreateCalendarEvent && diagnostics.canGenerateMeetLink;
    if (!diagnostics.success) {
      diagnostics.error = 'Calendar event was created, but no Meet join link was returned';
    }
  } catch (error) {
    diagnostics.error = error && error.message ? String(error.message) : String(error);
  } finally {
    if (testEventId) {
      try {
        Calendar.Events.remove('primary', testEventId, { sendUpdates: 'none' });
        diagnostics.cleanupStatus = 'Temporary test event deleted';
      } catch (cleanupError) {
        diagnostics.cleanupStatus = 'Temporary test event was NOT deleted: ' + cleanupError;
      }
    } else {
      diagnostics.cleanupStatus = 'No temporary event created';
    }
  }

  return diagnostics;
}

function runMeetPermissionCheck() {
  const result = checkMeetCalendarPermissions_();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function getMeetAuthorizationStatus_() {
  const requiredScope = 'https://www.googleapis.com/auth/calendar.events';
  const out = {
    status: 'UNKNOWN',
    authorizationUrl: '',
    requiredScopes: [requiredScope],
    error: '',
  };

  try {
    const info = ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL, [requiredScope]);
    out.status = String(info.getAuthorizationStatus());
    out.authorizationUrl = String(info.getAuthorizationUrl() || '');
    return out;
  } catch (error) {
    out.error = String(error && (error.message || error.toString()) || 'Unknown authorization status error');
    return out;
  }
}

function getMeetGrantedScopes_() {
  const requiredScope = 'https://www.googleapis.com/auth/calendar.events';
  const out = {
    requiredScope: requiredScope,
    hasRequiredScope: false,
    grantedScopes: [],
    source: 'tokeninfo',
    error: '',
  };

  try {
    const token = ScriptApp.getOAuthToken();
    if (!token) {
      out.error = 'No OAuth token available in current execution context';
      return out;
    }

    const url = 'https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(token);
    const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const code = resp.getResponseCode();
    if (code !== 200) {
      out.error = 'tokeninfo request failed with status ' + code + ': ' + resp.getContentText();
      return out;
    }

    const payload = JSON.parse(resp.getContentText() || '{}');
    const scopes = String(payload.scope || '')
      .split(/\s+/)
      .map(function (s) { return String(s || '').trim(); })
      .filter(function (s) { return !!s; });

    out.grantedScopes = scopes;
    out.hasRequiredScope = scopes.indexOf(requiredScope) !== -1;
    return out;
  } catch (error) {
    out.error = String(error && (error.message || error.toString()) || 'Unknown scope check error');
    return out;
  }
}

function runMeetFullDiagnosis() {
  const basic = checkMeetCalendarPermissions_();
  const scopeInfo = getMeetGrantedScopes_();
  const authInfo = getMeetAuthorizationStatus_();
  const needsScopeGrant =
    basic &&
    String(basic.error || '').toLowerCase().indexOf('required permissions: https://www.googleapis.com/auth/calendar.events') !== -1;
  const hasScope = scopeInfo.hasRequiredScope === true;

  const diagnosis = {
    success: basic.success === true && hasScope === true,
    timestamp: new Date().toISOString(),
    basic: basic,
    oauth: scopeInfo,
    authorization: authInfo,
    inferredRootCause: '',
    canAutoFix: false,
    autoFixReason: 'Google OAuth consent and deployment authorization cannot be fully completed by script code.',
    recoverySteps: [],
  };

  if (basic.success === true) {
    diagnosis.inferredRootCause = 'No blocking permission issue detected.';
    diagnosis.recoverySteps = ['No action required.'];
    return diagnosis;
  }

  if (needsScopeGrant || !hasScope || authInfo.status === 'REQUIRED') {
    diagnosis.inferredRootCause = 'Deployment owner has not granted Calendar scope for this script version.';
    diagnosis.recoverySteps = [
      'Open Apps Script Editor for this Meet project while signed in as the DEPLOYING account',
      'Run runMeetPermissionCheck() and click Allow on the OAuth consent screen',
      authInfo.authorizationUrl ? ('If shown, open this authorization URL: ' + authInfo.authorizationUrl) : 'If no auth URL is returned, run any Calendar action in editor to trigger consent',
      'Deploy a NEW web app version after consent is granted',
      'Re-test createMeetSession from frontend',
    ];
    return diagnosis;
  }

  diagnosis.inferredRootCause = 'Calendar API/service/deployment mismatch (not pure OAuth scope issue).';
  diagnosis.recoverySteps = [
    'Confirm appsscript.json has Calendar advanced service (v3) and oauthScope https://www.googleapis.com/auth/calendar.events',
    'In Apps Script Editor > Services, ensure Calendar API is enabled',
    'In linked Google Cloud Project, enable Google Calendar API',
    'Deploy a NEW web app version after manifest/service updates',
    'Run runMeetPermissionCheck() manually as deployment owner and grant permissions when prompted',
    'Retry createMeetSession from frontend',
  ];
  return diagnosis;
}

function attemptMeetPermissionAutoFix_() {
  const before = runMeetFullDiagnosis();
  const result = {
    success: false,
    timestamp: new Date().toISOString(),
    before: before,
    attemptedActions: [],
    note: 'Full automatic fix is not possible from Apps Script because OAuth consent + redeploy are manual platform steps.',
    nextSteps: before.recoverySteps,
  };

  try {
    if (typeof ScriptApp.invalidateAuth === 'function') {
      ScriptApp.invalidateAuth();
      result.attemptedActions.push('Called ScriptApp.invalidateAuth() to force fresh authorization on next manual run');
    } else {
      result.attemptedActions.push('ScriptApp.invalidateAuth() not available in this context');
    }
  } catch (error) {
    result.attemptedActions.push('invalidateAuth failed: ' + String(error && (error.message || error.toString()) || error));
  }

  result.after = runMeetFullDiagnosis();
  return result;
}

function runMeetPermissionRecovery_() {
  const diagnosis = runMeetFullDiagnosis();
  const out = {
    success: diagnosis.success,
    timestamp: new Date().toISOString(),
    diagnosis: diagnosis,
    attempted: null,
    nextSteps: diagnosis.recoverySteps,
  };

  if (!diagnosis.success) {
    out.attempted = attemptMeetPermissionAutoFix_();
    out.nextSteps = out.attempted && out.attempted.nextSteps ? out.attempted.nextSteps : diagnosis.recoverySteps;
  }

  return out;
}

function normalizeExpectedAttendees_(value) {
  const list = Array.isArray(value) ? value : [];
  const dedupe = {};
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i] || {};
    const name = sanitizeMeetText_(item.name);
    const email = sanitizeMeetText_(item.email).toLowerCase();
    const committee = sanitizeMeetText_(item.committee);
    if (!name && !email) continue;
    const key = email || normalizeMeetName_(name);
    if (!key || dedupe[key]) continue;
    dedupe[key] = true;
    out.push({
      name: name || email,
      email: email,
      committee: committee,
    });
  }
  return out.slice(0, 300);
}

function parseExpectedAttendees_(value) {
  const raw = sanitizeMeetText_(value);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return normalizeExpectedAttendees_(parsed);
  } catch (error) {
    return [];
  }
}

function formatMeetIcsDateUtc_(date) {
  return Utilities.formatDate(date, 'UTC', "yyyyMMdd'T'HHmmss'Z'");
}

function escapeIcsTextMeet_(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function buildMeetCalendarIcsBlob_(context) {
  var startDate = new Date(context.scheduledStart);
  var endDate = new Date(context.scheduledEnd);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return null;

  var uid = (context.meetingId || Utilities.getUuid()) + '@ysp-tagum-meet';
  var nowStamp = formatMeetIcsDateUtc_(new Date());
  var title = escapeIcsTextMeet_(context.title || 'KaagapAI Meet Session');
  var description = escapeIcsTextMeet_(
    'Meeting ID: ' + (context.meetingId || '') +
    '\\nMode: ' + (context.mode || 'instant') +
    '\\nInitiated By: ' + (context.createdBy || '') +
    '\\nJoin: ' + (context.meetUrl || '') +
    (context.notes ? '\\nNotes: ' + context.notes : '')
  );
  var location = escapeIcsTextMeet_(context.meetUrl || '');

  var ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//YSP Tagum//KaagapAI Meet//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'X-WR-TIMEZONE:Asia/Manila',
    'BEGIN:VEVENT',
    'UID:' + uid,
    'DTSTAMP:' + nowStamp,
    'DTSTART:' + formatMeetIcsDateUtc_(startDate),
    'DTEND:' + formatMeetIcsDateUtc_(endDate),
    'SUMMARY:' + title,
    'DESCRIPTION:' + description,
    'LOCATION:' + location,
    'URL:' + (context.meetUrl || ''),
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  return Utilities.newBlob(ics, 'text/calendar', 'meet-invite.ics');
}

function buildMeetGoogleCalendarUrl_(context) {
  var startDate = new Date(context.scheduledStart);
  var endDate = new Date(context.scheduledEnd);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return '';

  var dates = formatMeetIcsDateUtc_(startDate) + '/' + formatMeetIcsDateUtc_(endDate);
  var details = 'Meeting ID: ' + (context.meetingId || '') +
    '\nMode: ' + (context.mode || 'instant') +
    '\nInitiated By: ' + (context.createdBy || '') +
    '\nJoin: ' + (context.meetUrl || '') +
    (context.notes ? '\nNotes: ' + context.notes : '');

  var params = [
    'action=TEMPLATE',
    'text=' + encodeURIComponent(String(context.title || 'KaagapAI Meet Session')),
    'details=' + encodeURIComponent(details),
    'location=' + encodeURIComponent(String(context.meetUrl || '')),
    'dates=' + encodeURIComponent(dates)
  ];
  return 'https://calendar.google.com/calendar/render?' + params.join('&');
}

function buildMeetInviteEmailHtml_(attendeeName, context, googleCalUrl) {
  var logoUrl = MEET_ATTENDANCE_CONFIG.LOGO_URL || 'https://i.imgur.com/J4wddTW.png';
  var webAppUrl = 'https://www.youthservicephilippinestagum.me/';
  var fbPageUrl = 'https://www.facebook.com/YSPTagumChapter';
  var name = escapeHtmlMeet_(attendeeName || 'Member');
  var title = escapeHtmlMeet_(context.title || 'KaagapAI Meet Session');
  var meetingId = escapeHtmlMeet_(context.meetingId || '');
  var mode = escapeHtmlMeet_(context.mode === 'scheduled' ? 'Scheduled' : 'Instant');
  var meetUrl = escapeHtmlMeet_(context.meetUrl || '');
  var createdBy = escapeHtmlMeet_(context.createdBy || '');
  var notes = context.notes ? escapeHtmlMeet_(context.notes) : '';

  var startStr = '';
  var endStr = '';
  try {
    var tz = Session.getScriptTimeZone();
    var s = new Date(context.scheduledStart);
    var e = new Date(context.scheduledEnd);
    if (!isNaN(s.getTime())) startStr = Utilities.formatDate(s, tz, 'MMMM d, yyyy h:mm a');
    if (!isNaN(e.getTime())) endStr = Utilities.formatDate(e, tz, 'MMMM d, yyyy h:mm a');
  } catch (err) {
    startStr = escapeHtmlMeet_(context.scheduledStart || '');
    endStr = escapeHtmlMeet_(context.scheduledEnd || '');
  }

  var notesSection = notes
    ? '<tr><td style="padding:6px 0"><span style="font-size:12px;color:#64748b;text-transform:uppercase;font-weight:600;letter-spacing:0.5px">Notes</span></td></tr>' +
      '<tr><td style="padding:0 0 6px 0;font-size:14px;color:#334155;line-height:1.5">' + notes + '</td></tr>'
    : '';

  var calendarButtonHtml = '';
  if (googleCalUrl) {
    calendarButtonHtml =
      '<a href="' + escapeHtmlMeet_(googleCalUrl) + '" target="_blank" ' +
      'style="display:inline-block;background-color:#ffffff;color:#334155;border:1px solid #e2e8f0;' +
      'font-family:\'Segoe UI\',Roboto,Arial,sans-serif;font-weight:600;font-size:14px;padding:12px 24px;' +
      'text-decoration:none;border-radius:6px;margin:0 6px 8px 0">Add to Calendar</a>';
  }

  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">' +
    '<meta http-equiv="X-UA-Compatible" content="IE=edge">' +
    '<style type="text/css">' +
    'body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}' +
    'table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}' +
    'img{-ms-interpolation-mode:bicubic;border:0;height:auto;line-height:100%;outline:none;text-decoration:none}' +
    'body{margin:0;padding:0;width:100%!important;min-width:100%!important}' +
    '@media only screen and (max-width:620px){' +
    '.email-container{width:100%!important;max-width:100%!important}' +
    '.email-padding{padding:20px 16px!important}' +
    '.email-header{padding:20px 16px!important}' +
    '.btn-row a{display:block!important;width:100%!important;max-width:100%!important;text-align:center!important;margin:4px 0!important;box-sizing:border-box!important}' +
    '}' +
    '</style></head>' +
    '<body style="margin:0;padding:0;background:#f4f6f8;font-family:Roboto,\'Segoe UI\',Arial,Helvetica,sans-serif">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8">' +
    '<tr><td align="center" style="padding:30px 10px">' +

    // Main container
    '<table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">' +

    // Header banner (matches existing YSP email style)
    '<tr><td align="center" class="email-header" style="background:linear-gradient(135deg,#FF8800 0%,#F97316 100%);padding:28px 20px">' +
    '<img src="' + logoUrl + '" width="64" height="64" alt="YSP Logo" style="border-radius:50%;background:#fff;padding:3px;display:block;margin:0 auto" />' +
    '<div style="color:#ffffff;font-weight:700;font-size:22px;margin-top:10px;letter-spacing:-0.3px">Youth Service Philippines</div>' +
    '<div style="color:#ffe7cc;font-size:13px;margin-top:2px">Tagum Chapter</div></td></tr>' +

    // Content area
    '<tr><td class="email-padding" style="padding:30px">' +

    // Greeting
    '<div style="font-size:20px;font-weight:700;color:#1a1a1a;margin-bottom:6px;line-height:1.3">Hello, ' + name + '</div>' +
    '<div style="color:#64748b;font-size:14px;margin-bottom:18px;line-height:1.4">You have been invited to a Google Meet session.</div>' +

    // Meeting details card
    '<table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border-radius:8px;border:1px solid #E2E8F0;margin-bottom:20px">' +
    '<tr><td style="padding:16px 20px">' +
    '<div style="font-size:13px;font-weight:700;color:#334155;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.5px">Meeting Details</div>' +
    '<table width="100%" cellpadding="0" cellspacing="0">' +
    '<tr><td style="padding:6px 0"><span style="font-size:12px;color:#64748b;text-transform:uppercase;font-weight:600;letter-spacing:0.5px">Title</span></td></tr>' +
    '<tr><td style="padding:0 0 6px 0;font-size:14px;color:#1a1a1a;font-weight:600">' + title + '</td></tr>' +
    '<tr><td style="padding:6px 0"><span style="font-size:12px;color:#64748b;text-transform:uppercase;font-weight:600;letter-spacing:0.5px">Meeting ID</span></td></tr>' +
    '<tr><td style="padding:0 0 6px 0;font-size:14px;color:#334155">' + meetingId + '</td></tr>' +
    '<tr><td style="padding:6px 0"><span style="font-size:12px;color:#64748b;text-transform:uppercase;font-weight:600;letter-spacing:0.5px">Mode</span></td></tr>' +
    '<tr><td style="padding:0 0 6px 0;font-size:14px;color:#334155">' + mode + '</td></tr>' +
    '<tr><td style="padding:6px 0"><span style="font-size:12px;color:#64748b;text-transform:uppercase;font-weight:600;letter-spacing:0.5px">Start</span></td></tr>' +
    '<tr><td style="padding:0 0 6px 0;font-size:14px;color:#334155">' + startStr + '</td></tr>' +
    '<tr><td style="padding:6px 0"><span style="font-size:12px;color:#64748b;text-transform:uppercase;font-weight:600;letter-spacing:0.5px">End</span></td></tr>' +
    '<tr><td style="padding:0 0 6px 0;font-size:14px;color:#334155">' + endStr + '</td></tr>' +
    '<tr><td style="padding:6px 0"><span style="font-size:12px;color:#64748b;text-transform:uppercase;font-weight:600;letter-spacing:0.5px">Initiated By</span></td></tr>' +
    '<tr><td style="padding:0 0 6px 0;font-size:14px;color:#334155">' + createdBy + '</td></tr>' +
    notesSection +
    '</table>' +
    '</td></tr></table>' +

    // Action buttons
    '<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px"><tr><td class="btn-row">' +
    '<a href="' + meetUrl + '" target="_blank" ' +
    'style="display:inline-block;background-color:#FF8800;color:#ffffff;font-family:\'Segoe UI\',Roboto,Arial,sans-serif;font-weight:600;font-size:14px;padding:12px 24px;text-decoration:none;border-radius:6px;margin:0 6px 8px 0;box-shadow:0 2px 4px rgba(255,136,0,0.3)">Join Meeting</a>' +
    calendarButtonHtml +
    '<a href="' + webAppUrl + '" target="_blank" ' +
    'style="display:inline-block;background-color:#ffffff;color:#4a5568;border:1px solid #e2e8f0;font-family:\'Segoe UI\',Roboto,Arial,sans-serif;font-weight:600;font-size:14px;padding:12px 24px;text-decoration:none;border-radius:6px;margin:0 6px 8px 0">Open Web App</a>' +
    '</td></tr></table>' +

    // Notice
    '<div style="margin-top:20px;border-top:1px solid #eeeeee;padding-top:16px">' +
    '<table width="100%"><tr>' +
    '<td style="font-size:12px;color:#888;line-height:1.5">' +
    '<strong>Notice:</strong> This meeting was created through the YSP KaagapAI Meet system. ' +
    'If you did not expect this invitation, please contact the meeting organizer.' +
    '</td></tr></table></div>' +

    '</td></tr>' +

    // Footer (matches existing YSP style)
    '<tr><td style="padding:16px 30px;background:#F8FAFC;border-top:1px solid #E2E8F0;text-align:center">' +
    '<div style="font-size:11px;color:#94a3b8;line-height:1.5">' +
    'Youth Service Philippines &bull; Tagum Chapter<br/>' +
    'This is an automated notification from the YSP Web App.' +
    '</div></td></tr>' +

    '</table></td></tr></table></body></html>';
}

function sendMeetInviteEmails_(attendees, context) {
  const recipients = Array.isArray(attendees) ? attendees : [];
  const sentAt = new Date().toISOString();
  if (!recipients.length) {
    return { sentCount: 0, failedCount: 0, sentAt: '' };
  }

  // Build calendar attachments and link
  var calendarIcsBlob = buildMeetCalendarIcsBlob_(context);
  var googleCalUrl = buildMeetGoogleCalendarUrl_(context);

  let sentCount = 0;
  let failedCount = 0;
  for (let i = 0; i < recipients.length; i++) {
    const attendee = recipients[i];
    const to = sanitizeMeetText_(attendee.email);
    if (!to) continue;

    const subject = context.mode === 'scheduled'
      ? ('[YSP] Scheduled Meet: ' + context.title)
      : ('[YSP] Meet Invite: ' + context.title);
    const htmlBody = buildMeetInviteEmailHtml_(attendee.name, context, googleCalUrl);

    var emailPayload = {
      to: to,
      subject: subject,
      htmlBody: htmlBody,
    };

    // Attach .ics calendar file so recipients can add to any calendar app
    if (calendarIcsBlob) {
      emailPayload.attachments = [calendarIcsBlob];
    }

    try {
      MailApp.sendEmail(emailPayload);
      sentCount++;
    } catch (error) {
      failedCount++;
      Logger.log('Meet invite send failed for ' + to + ': ' + error.toString());
    }
  }
  return {
    sentCount: sentCount,
    failedCount: failedCount,
    sentAt: sentCount ? sentAt : '',
  };
}

function normalizeMeetDateTimeInput_(value) {
  const raw = sanitizeMeetText_(value);
  if (!raw) return '';
  const parsed = new Date(raw);
  if (isNaN(parsed.getTime())) return '';
  return parsed.toISOString();
}
