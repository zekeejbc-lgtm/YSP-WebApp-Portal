/**
 * =============================================================================
 * ORGANIZATIONAL TASK BACKEND
 * =============================================================================
 *
 * Script Properties required:
 * - TASK_SPREADSHEET_ID: Spreadsheet that stores committee tasks
 * - LOGIN_SPREADSHEET_ID: Spreadsheet that stores User Profiles
 * - SYSTEM_SETTINGS_SPREADSHEET_ID: Spreadsheet that stores System_Config_Roles
 * - SESSION_SECRET_KEY: HMAC secret used for session token verification
 *
 * Sheet:
 * - OrganizationalTasks
 */

const TASK_CONFIG = {
  SPREADSHEET_ID: PropertiesService.getScriptProperties().getProperty('TASK_SPREADSHEET_ID') || '',
  LOGIN_SPREADSHEET_ID: PropertiesService.getScriptProperties().getProperty('LOGIN_SPREADSHEET_ID') || '',
  SYSTEM_SETTINGS_SPREADSHEET_ID: PropertiesService.getScriptProperties().getProperty('SYSTEM_SETTINGS_SPREADSHEET_ID') || '',
  SHEET_NAME: 'OrganizationalTasks',
};

const TASK_HEADERS = [
  'TaskID',
  'CommitteeId',
  'CommitteeName',
  'Title',
  'Description',
  'Priority',
  'Status',
  'DueDate',
  'Assignee',
  'Checklist',
  'CreatedBy',
  'CreatedAt',
  'UpdatedBy',
  'UpdatedAt',
];

const COMMITTEES = [
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
];

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const action = String(params.action || '').trim();
    const tokenUser = verifyHmacToken_(params.sessionToken);
    if (!tokenUser) return jsonResponse({ success: false, error: 'Invalid or expired session token', code: 401 });

    const auth = requireTaskPageAccess_(tokenUser.username);
    if (auth) return jsonResponse(auth);

    if (action === 'getCommittees') {
      return jsonResponse({ success: true, data: COMMITTEES });
    }

    if (action === 'getCommitteeTasks') {
      return jsonResponse(getCommitteeTasks_(params.committeeId));
    }

    return jsonResponse({ success: false, error: 'Invalid action', code: 400 });
  } catch (error) {
    return jsonResponse({ success: false, error: error.toString(), code: 500 });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = String(payload.action || '').trim();
    const tokenUser = verifyHmacToken_(payload.sessionToken);
    if (!tokenUser) return jsonResponse({ success: false, error: 'Invalid or expired session token', code: 401 });

    const pageAuth = requireTaskPageAccess_(tokenUser.username);
    if (pageAuth) return jsonResponse(pageAuth);

    const writeAuth = requireTaskManageAccess_(tokenUser.username);
    if (action === 'saveTask' || action === 'deleteTask') {
      if (writeAuth) return jsonResponse(writeAuth);
    }

    if (action === 'saveTask') {
      payload.username = tokenUser.username;
      return jsonResponse(saveTask_(payload));
    }

    if (action === 'deleteTask') {
      return jsonResponse(deleteTask_(payload.taskId));
    }

    return jsonResponse({ success: false, error: 'Invalid action', code: 400 });
  } catch (error) {
    return jsonResponse({ success: false, error: error.toString(), code: 500 });
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function ensureTaskSheet_() {
  if (!TASK_CONFIG.SPREADSHEET_ID) {
    throw new Error('TASK_SPREADSHEET_ID is not configured');
  }
  const ss = SpreadsheetApp.openById(TASK_CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(TASK_CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(TASK_CONFIG.SHEET_NAME);
    sheet.getRange(1, 1, 1, TASK_HEADERS.length).setValues([TASK_HEADERS]);
    sheet.getRange(1, 1, 1, TASK_HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  } else {
    const lastColumn = Math.max(sheet.getLastColumn(), TASK_HEADERS.length);
    const headerRow = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
    const validHeader = TASK_HEADERS.every(function(header, idx) {
      return String(headerRow[idx] || '').trim() === header;
    });
    if (!validHeader) {
      const existingLastRow = sheet.getLastRow();
      const existingData = existingLastRow > 1
        ? sheet.getRange(2, 1, existingLastRow - 1, lastColumn).getValues()
        : [];
      const oldHeaderIndexMap = {};
      headerRow.forEach(function(header, idx) {
        const key = String(header || '').trim();
        if (key) oldHeaderIndexMap[key] = idx;
      });

      sheet.clearContents();
      sheet.getRange(1, 1, 1, TASK_HEADERS.length).setValues([TASK_HEADERS]);
      sheet.getRange(1, 1, 1, TASK_HEADERS.length).setFontWeight('bold');
      sheet.setFrozenRows(1);

      if (existingData.length) {
        const migratedRows = existingData.map(function(row) {
          return TASK_HEADERS.map(function(header) {
            if (header === 'Checklist') return '[]';
            if (Object.prototype.hasOwnProperty.call(oldHeaderIndexMap, header)) {
              return row[oldHeaderIndexMap[header]];
            }
            return '';
          });
        });
        sheet.getRange(2, 1, migratedRows.length, TASK_HEADERS.length).setValues(migratedRows);
      }
    }
  }
  return sheet;
}

function normalizeChecklistItem_(item, fallbackId) {
  const text = String((item && item.text) || '').trim();
  if (!text) return null;
  return {
    id: String((item && item.id) || fallbackId || ('item-' + Date.now())),
    text: text,
    done: !!(item && item.done),
  };
}

function parseChecklistFromPayload_(rawChecklist) {
  if (!rawChecklist) return [];
  if (!Array.isArray(rawChecklist)) return [];
  const out = [];
  for (let i = 0; i < rawChecklist.length; i++) {
    const normalized = normalizeChecklistItem_(rawChecklist[i], 'item-' + (i + 1));
    if (normalized) out.push(normalized);
  }
  return out;
}

function parseChecklistFromCell_(rawValue) {
  if (!rawValue) return [];
  try {
    const parsed = JSON.parse(String(rawValue));
    if (!Array.isArray(parsed)) return [];
    const out = [];
    for (let i = 0; i < parsed.length; i++) {
      const normalized = normalizeChecklistItem_(parsed[i], 'item-' + (i + 1));
      if (normalized) out.push(normalized);
    }
    return out;
  } catch (error) {
    return [];
  }
}

function getCommitteeTasks_(committeeId) {
  const targetCommitteeId = String(committeeId || '').trim();
  if (!targetCommitteeId) {
    return { success: false, error: 'committeeId is required', code: 400 };
  }
  const sheet = ensureTaskSheet_();
  if (sheet.getLastRow() <= 1) {
    return { success: true, data: [] };
  }
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const rows = values.slice(1);
  const tasks = rows
    .filter(function(row) {
      return String(row[1] || '').trim() === targetCommitteeId;
    })
    .map(function(row) {
      const item = {};
      headers.forEach(function(header, idx) {
        item[header] = row[idx] || '';
      });
      item.Checklist = parseChecklistFromCell_(item.Checklist);
      return item;
    });
  return { success: true, data: tasks };
}

function saveTask_(payload) {
  const sheet = ensureTaskSheet_();
  const now = new Date().toISOString();
  const username = String(payload.username || '').trim();

  const taskId = String(payload.taskId || '').trim();
  const committeeId = String(payload.committeeId || '').trim();
  const committeeName = String(payload.committeeName || '').trim();
  const title = String(payload.title || '').trim();
  const description = String(payload.description || '').trim();
  const priority = String(payload.priority || 'Medium').trim();
  const status = String(payload.status || 'Not Started').trim();
  const dueDate = String(payload.dueDate || '').trim();
  const assignee = String(payload.assignee || '').trim();
  const checklistItems = parseChecklistFromPayload_(payload.checklist);
  const checklistJson = JSON.stringify(checklistItems);

  if (!committeeId || !committeeName) {
    return { success: false, error: 'Committee is required', code: 400 };
  }
  if (!title) {
    return { success: false, error: 'Title is required', code: 400 };
  }

  if (!taskId) {
    const newTaskId = 'TASK-' + Date.now() + '-' + Math.floor(Math.random() * 9000 + 1000);
    sheet.appendRow([
      newTaskId,
      committeeId,
      committeeName,
      title,
      description,
      priority,
      status,
      dueDate,
      assignee,
      checklistJson,
      username,
      now,
      username,
      now,
    ]);
    return {
      success: true,
      data: {
        TaskID: newTaskId,
        CommitteeId: committeeId,
        CommitteeName: committeeName,
        Title: title,
        Description: description,
        Priority: priority,
        Status: status,
        DueDate: dueDate,
        Assignee: assignee,
        Checklist: checklistItems,
        CreatedBy: username,
        CreatedAt: now,
        UpdatedBy: username,
        UpdatedAt: now,
      },
      message: 'Task created successfully',
    };
  }

  if (sheet.getLastRow() <= 1) {
    return { success: false, error: 'Task not found', code: 404 };
  }

  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === taskId) {
      sheet.getRange(i + 1, 2, 1, 9).setValues([[committeeId, committeeName, title, description, priority, status, dueDate, assignee, checklistJson]]);
      sheet.getRange(i + 1, 13, 1, 2).setValues([[username, now]]);

      return {
        success: true,
        data: {
          TaskID: taskId,
          CommitteeId: committeeId,
          CommitteeName: committeeName,
          Title: title,
          Description: description,
          Priority: priority,
          Status: status,
          DueDate: dueDate,
          Assignee: assignee,
          Checklist: checklistItems,
          CreatedBy: values[i][10] || '',
          CreatedAt: values[i][11] || '',
          UpdatedBy: username,
          UpdatedAt: now,
        },
        message: 'Task updated successfully',
      };
    }
  }

  return { success: false, error: 'Task not found', code: 404 };
}

function deleteTask_(taskId) {
  const id = String(taskId || '').trim();
  if (!id) return { success: false, error: 'taskId is required', code: 400 };

  const sheet = ensureTaskSheet_();
  if (sheet.getLastRow() <= 1) {
    return { success: false, error: 'Task not found', code: 404 };
  }

  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === id) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Task deleted successfully' };
    }
  }

  return { success: false, error: 'Task not found', code: 404 };
}

function normalizeRoleValue_(roleName) {
  return String(roleName || '').toLowerCase().trim();
}

function getUserRole_(username) {
  const target = normalizeRoleValue_(username);
  if (!target || !TASK_CONFIG.LOGIN_SPREADSHEET_ID) return '';
  try {
    const ss = SpreadsheetApp.openById(TASK_CONFIG.LOGIN_SPREADSHEET_ID);
    const sheet = ss.getSheetByName('User Profiles');
    if (!sheet || sheet.getLastRow() < 2) return '';
    const values = sheet.getDataRange().getValues();
    const headers = values[0] || [];
    const usernameIdx = headers.indexOf('Username');
    const roleIdx = headers.indexOf('Role');
    if (usernameIdx === -1 || roleIdx === -1) return '';

    for (let i = 1; i < values.length; i++) {
      if (normalizeRoleValue_(values[i][usernameIdx]) === target) {
        return normalizeRoleValue_(values[i][roleIdx]);
      }
    }
  } catch (error) {
    Logger.log('getUserRole_ error: ' + error.toString());
  }
  return '';
}

function getSystemRoleRecordByName_(roleName) {
  const target = normalizeRoleValue_(roleName);
  if (!target || !TASK_CONFIG.SYSTEM_SETTINGS_SPREADSHEET_ID) return null;
  try {
    const ss = SpreadsheetApp.openById(TASK_CONFIG.SYSTEM_SETTINGS_SPREADSHEET_ID);
    const sheet = ss.getSheetByName('System_Config_Roles');
    if (!sheet || sheet.getLastRow() < 2) return null;
    const values = sheet.getDataRange().getValues();
    const headers = values[0] || [];
    const roleNameIdx = headers.indexOf('RoleName');
    const powerLevelIdx = headers.indexOf('PowerLevel');
    const permissionsIdx = headers.indexOf('Permissions');
    if (roleNameIdx === -1) return null;

    for (let i = 1; i < values.length; i++) {
      if (normalizeRoleValue_(values[i][roleNameIdx]) !== target) continue;
      let permissions = {};
      if (permissionsIdx !== -1 && values[i][permissionsIdx]) {
        try {
          permissions = JSON.parse(String(values[i][permissionsIdx]));
        } catch (e) {
          permissions = {};
        }
      }
      const powerLevel = Number(values[i][powerLevelIdx]);
      return {
        name: String(values[i][roleNameIdx] || ''),
        powerLevel: isNaN(powerLevel) ? 0 : powerLevel,
        permissions: permissions || {},
      };
    }
  } catch (error) {
    Logger.log('getSystemRoleRecordByName_ error: ' + error.toString());
  }
  return null;
}

function requireTaskPageAccess_(username) {
  const role = getUserRole_(username);
  if (!role) return { success: false, error: 'User role not found', code: 403 };
  if (role === 'banned' || role === 'suspended') {
    return { success: false, error: 'Account is restricted', code: 403 };
  }

  const roleRecord = getSystemRoleRecordByName_(role);
  if (roleRecord && roleRecord.permissions && Object.prototype.hasOwnProperty.call(roleRecord.permissions, 'page_organizational_tasks')) {
    if (roleRecord.permissions.page_organizational_tasks !== true) {
      return { success: false, error: 'Permission denied for Organizational Task page', code: 403 };
    }
    return null;
  }

  const level = roleRecord ? Number(roleRecord.powerLevel) || 0 : 0;
  if (level < 2 && role === 'guest') {
    return { success: false, error: 'Permission denied for Organizational Task page', code: 403 };
  }
  return null;
}

function requireTaskManageAccess_(username) {
  const role = getUserRole_(username);
  if (!role) return { success: false, error: 'User role not found', code: 403 };
  if (role === 'banned' || role === 'suspended') {
    return { success: false, error: 'Account is restricted', code: 403 };
  }

  const roleRecord = getSystemRoleRecordByName_(role);
  if (roleRecord) {
    const permissions = roleRecord.permissions || {};
    if (permissions.fn_manage_organizational_tasks === true) return null;
    if (permissions.canEditContent === true) return null;
    if ((Number(roleRecord.powerLevel) || 0) >= 4) return null;
    return { success: false, error: 'Permission denied: cannot manage organizational tasks', code: 403 };
  }

  return { success: false, error: 'Permission denied: cannot manage organizational tasks', code: 403 };
}

function bytesToHex_(bytes) {
  return bytes.map(function(b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
}

function verifyHmacToken_(token) {
  if (!token || typeof token !== 'string') return null;
  const secret = PropertiesService.getScriptProperties().getProperty('SESSION_SECRET_KEY');
  if (!secret) return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const payload = parts[0];
  const signature = parts[1];
  const expectedSig = bytesToHex_(Utilities.computeHmacSha256Signature(payload, secret));
  if (signature !== expectedSig) return null;

  try {
    const decoded = Utilities.newBlob(Utilities.base64Decode(payload)).getDataAsString();
    const fields = decoded.split('|');
    if (fields.length < 2) return null;
    const username = fields[0];
    const expiry = parseInt(fields[1], 10);
    if (isNaN(expiry) || new Date().getTime() > expiry) return null;
    return { username: username };
  } catch (error) {
    Logger.log('verifyHmacToken_ error: ' + error.toString());
    return null;
  }
}
