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
    const requiresUserAccess = action && action !== 'syncMeetAttendance';

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
    sheet.clearContents();
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
    const meetingId = resolveMeetingIdForSync_(incomingMeetingId, meetingUrl);
    const attendees = Array.isArray(requestData.attendees) ? requestData.attendees : [];

    if (!meetingId) {
      return createErrorResponse('meeting.id is required', 400);
    }

    const sheet = ensureMeetAttendanceSheet_();
    const directoryMap = buildDirectoryMapForMeet_();
    const existingRowMap = buildMeetExistingRowMap_(sheet, meetingId);

    let inserted = 0;
    let updated = 0;
    let externalCount = 0;
    const rowsToAppend = [];
    const updatedAt = new Date().toISOString();
    const source = sanitizeMeetText_(requestData.source) || 'meet-extension';
    const payloadVersion = sanitizeMeetText_(requestData.payloadVersion) || '1';
    const payloadId = sanitizeMeetText_(requestData.payloadId) || (meetingId + '-' + Date.now());

    for (let i = 0; i < attendees.length; i++) {
      const parsed = normalizeIncomingAttendee_(attendees[i]);
      if (!parsed.participantKey || !parsed.name) continue;

      const directoryMatch = directoryMap[parsed.normalizedName] || null;
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

      const existingRow = existingRowMap[parsed.participantKey];
      if (existingRow) {
        sheet.getRange(existingRow, 1, 1, MEET_ATTENDANCE_HEADERS.length).setValues([rowValues]);
        updated++;
      } else {
        rowsToAppend.push(rowValues);
      }
    }

    if (rowsToAppend.length) {
      const startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, rowsToAppend.length, MEET_ATTENDANCE_HEADERS.length).setValues(rowsToAppend);
      inserted = rowsToAppend.length;
    }

    return createSuccessResponse({
      success: true,
      meetingId: meetingId,
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

    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      const meetingId = sanitizeMeetText_(row[0]);
      if (!meetingId) continue;
      if (meetingIdFilter && meetingId !== meetingIdFilter) continue;

      if (!groups[meetingId]) {
        groups[meetingId] = {
          meetingId: meetingId,
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
    const directoryMap = buildDirectoryMapForMeet_();
    const match = directoryMap[normalized] || null;
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
  const logoSrc = logoBase64 || MEET_ATTENDANCE_CONFIG.LOGO_URL;
  const rows = Array.isArray(meeting.attendees) ? meeting.attendees : [];

  function fmtDate(value) {
    if (!value) return '-';
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'MM/dd/yyyy hh:mm:ss a');
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
      return (
        '<tr>' +
        '<td style="text-align:center;color:#64748b;font-weight:bold;">' + (idx + 1) + '</td>' +
        '<td>' + escapeHtmlMeet_(r.name || '') + '</td>' +
        '<td>' + escapeHtmlMeet_(fmtDate(r.firstJoinTime)) + '</td>' +
        '<td>' + escapeHtmlMeet_(fmtDate(r.lastLeaveTime)) + '</td>' +
        '<td>' + escapeHtmlMeet_(fmtDuration(r.totalDurationSeconds)) + '</td>' +
        '</tr>'
      );
    })
    .join('');

  return (
    '<!DOCTYPE html>' +
    '<html><head><style>' +
    '@page{size:A4 landscape;margin-top:0;margin-left:0;margin-right:0;margin-bottom:50px;}' +
    'body{font-family:Helvetica,Arial,sans-serif;margin:0;padding:0;background:#fff;-webkit-print-color-adjust:exact;}' +
    '.header-banner{background:#F6421F;height:120px;width:100%;color:#fff;padding:0 50px;display:flex;align-items:center;position:relative;box-sizing:border-box;}' +
    '.logo-container{width:70px;height:70px;margin-right:25px;margin-top:25px;background:#fff;border-radius:50%;padding:5px;box-sizing:border-box;}' +
    '.logo-img{width:100%;height:100%;object-fit:contain;}' +
    '.header-text{margin-top:25px;}' +
    '.org-title{font-size:24px;font-weight:bold;margin:0;line-height:1.2;}' +
    '.chapter-subtitle{font-size:16px;margin:4px 0 0 0;opacity:.9;}' +
    '.report-label{margin-top:10px;font-size:11px;text-transform:uppercase;letter-spacing:1px;opacity:.8;}' +
    '.meta-data{position:absolute;right:50px;bottom:20px;text-align:right;font-size:10px;opacity:.9;}' +
    '.main-content{padding:30px 60px;box-sizing:border-box;width:100%;margin:0 auto;}' +
    '.section-heading{font-size:14px;font-weight:bold;border-bottom:3px solid #F6421F;padding-bottom:8px;margin-bottom:15px;display:block;text-transform:uppercase;width:100%;color:#F6421F;}' +
    '.summary-meta{font-size:11px;color:#334155;margin-bottom:14px;}' +
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
    '<div class="section-heading">MEETING ATTENDANCE</div>' +
    '<div class="summary-meta"><strong>Meeting ID:</strong> ' + escapeHtmlMeet_(meetingLabel) + '</div>' +
    '<div class="summary-meta"><strong>Meeting Date:</strong> ' + escapeHtmlMeet_(meetingDate) + '</div>' +
    '<div class="summary-meta"><strong>Total Attendees:</strong> ' + rows.length + '</div>' +
    '<table>' +
    '<thead><tr><th style="width:5%;text-align:center;">#</th><th style="width:35%;">NAME</th><th style="width:20%;">JOIN TIME</th><th style="width:20%;">LEAVE TIME</th><th style="width:20%;">DURATION</th></tr></thead>' +
    '<tbody>' + tableRows + '</tbody></table>' +
    '</div>' +
    '<div class="footer"><span>Youth Service Philippines - Tagum Chapter</span></div>' +
    '</body></html>'
  );
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
  const map = {};
  if (!MEET_ATTENDANCE_CONFIG.DIRECTORY_SPREADSHEET_ID) return map;

  const ss = SpreadsheetApp.openById(MEET_ATTENDANCE_CONFIG.DIRECTORY_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(MEET_ATTENDANCE_CONFIG.DIRECTORY_SHEET_NAME);
  if (!sheet) return map;

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return map;
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
  if (fullNameIdx === undefined) return map;

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
      map[normalized] = {
        fullName: fullName,
        idCode: idCodeIdx !== undefined ? sanitizeMeetText_(row[idCodeIdx]) : '',
        profilePictureURL: picIdx !== undefined ? sanitizeMeetText_(row[picIdx]) : '',
      };
    }
  }

  return map;
}

function normalizeIncomingAttendee_(attendee) {
  const name = sanitizeMeetText_(attendee.name);
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

function resolveMeetingIdForSync_(incomingMeetingId, meetingUrl) {
  const fromPayload = sanitizeMeetText_(incomingMeetingId);
  const fromUrl = extractMeetIdFromUrl_(meetingUrl);
  const meetCode = (fromPayload || fromUrl || '').toLowerCase();
  if (!meetCode) return '';

  const schedules = getMeetScheduleRows_();
  for (let i = 0; i < schedules.length; i++) {
    const row = schedules[i];
    const rowCode = extractMeetIdFromUrl_(row.meetUrl);
    if (!rowCode) continue;
    if (rowCode === meetCode) {
      return row.meetingId;
    }
  }
  return fromPayload || fromUrl;
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
  // Primary approach: create a Calendar event with Google Meet conference link.
  // Requires Calendar advanced service + calendar scope in the deployed project.
  if (typeof Calendar !== 'undefined' && Calendar && Calendar.Events && typeof Calendar.Events.insert === 'function') {
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
      if (fromHangout) return { meetUrl: fromHangout, calendarEventId: sanitizeMeetText_(event.id) };
      const entryPoints = event && event.conferenceData && event.conferenceData.entryPoints;
      if (entryPoints && entryPoints.length) {
        for (let i = 0; i < entryPoints.length; i++) {
          const uri = sanitizeMeetText_(entryPoints[i].uri);
          if (uri && uri.indexOf('meet.google.com') !== -1) {
            return { meetUrl: uri, calendarEventId: sanitizeMeetText_(event.id) };
          }
        }
      }
    } catch (error) {
      Logger.log('createGoogleMeetLink_ Calendar API failed, using meet.new fallback: ' + error.toString());
    }
  }

  // Fallback: provide meet.new for instant creation when Calendar advanced service is unavailable.
  return {
    meetUrl: 'https://meet.new',
    calendarEventId: '',
  };
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

function sendMeetInviteEmails_(attendees, context) {
  const recipients = Array.isArray(attendees) ? attendees : [];
  const sentAt = new Date().toISOString();
  if (!recipients.length) {
    return { sentCount: 0, failedCount: 0, sentAt: '' };
  }

  let sentCount = 0;
  let failedCount = 0;
  for (let i = 0; i < recipients.length; i++) {
    const attendee = recipients[i];
    const to = sanitizeMeetText_(attendee.email);
    if (!to) continue;

    const subject = context.mode === 'scheduled'
      ? ('[YSP] Scheduled Meet: ' + context.title)
      : ('[YSP] Meet Invite: ' + context.title);
    const htmlBody =
      '<div style="font-family:Arial,sans-serif;font-size:14px;color:#1e293b;">' +
      '<p>Hello ' + escapeHtmlMeet_(attendee.name || 'Member') + ',</p>' +
      '<p>You are invited to a Google Meet session.</p>' +
      '<p><strong>Title:</strong> ' + escapeHtmlMeet_(context.title) + '</p>' +
      '<p><strong>Meeting ID:</strong> ' + escapeHtmlMeet_(context.meetingId) + '</p>' +
      '<p><strong>Mode:</strong> ' + escapeHtmlMeet_(context.mode) + '</p>' +
      '<p><strong>Start:</strong> ' + escapeHtmlMeet_(context.scheduledStart) + '</p>' +
      '<p><strong>End:</strong> ' + escapeHtmlMeet_(context.scheduledEnd) + '</p>' +
      '<p><strong>Initiated By:</strong> ' + escapeHtmlMeet_(context.createdBy) + '</p>' +
      '<p><strong>Meet Link:</strong> <a href="' + escapeHtmlMeet_(context.meetUrl) + '">' + escapeHtmlMeet_(context.meetUrl) + '</a></p>' +
      (context.notes ? ('<p><strong>Notes:</strong> ' + escapeHtmlMeet_(context.notes) + '</p>') : '') +
      '<p>Thank you,<br>Youth Service Philippines - Tagum Chapter</p>' +
      '</div>';

    try {
      MailApp.sendEmail({
        to: to,
        subject: subject,
        htmlBody: htmlBody,
      });
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
