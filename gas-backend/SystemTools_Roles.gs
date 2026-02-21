const SYSTEM_ROLES_SHEET_NAME = 'System_Config_Roles';

const SYSTEM_ROLES_HEADERS = [
  'RoleName',
  'PowerLevel',
  'Color',
  'Description',
  'Permissions',
];

const SYSTEM_PERMISSION_KEYS = [
  'canManageUsers',
  'canAccessSystemTools',
  'canExportData',
  'canEditContent',
  'canApproveMembers',
  'canManageEvents',
  'page_home',
  'page_feedback',
  'page_my_qrid',
  'page_attendance_transparency',
  'page_profile',
  'page_announcements',
  'page_issuance',
  'page_applications',
  'page_settings',
  'page_directory',
  'page_attendance_dashboard',
  'page_attendance_recording',
  'page_events',
  'page_admin_members',
  'page_admin_logs',
  'page_admin_tools',
  'page_organizational_tasks',
  'fn_manage_opportunities',
  'fn_sync_applicant_sheet',
  'fn_manage_role_permissions',
  'fn_generate_member_ids',
  'fn_manage_maintenance_mode',
  'fn_backup_database',
  'fn_export_all_data',
  'fn_manage_homepage_content',
  'fn_manage_notifications',
  'fn_manage_issuance',
  'fn_manage_attendance_events',
  'fn_moderate_feedback',
  'fn_manage_projects',
  'fn_manage_organizational_tasks',
];

function getDefaultPermissionsForLevel_(powerLevel) {
  const level = Number(powerLevel) || 0;
  const defaults = {
    canManageUsers: level >= 8,
    canAccessSystemTools: level >= 8,
    canExportData: level >= 8,
    canEditContent: level >= 4,
    canApproveMembers: level >= 5,
    canManageEvents: level >= 4,
    page_home: level >= 1,
    page_feedback: level >= 1,
    page_my_qrid: level >= 2,
    page_attendance_transparency: level >= 2,
    page_profile: level >= 2,
    page_announcements: level >= 2,
    page_issuance: level >= 2,
    page_applications: level >= 2,
    page_settings: level >= 2,
    page_directory: level >= 5,
    page_attendance_dashboard: level >= 5,
    page_attendance_recording: level >= 5,
    page_events: level >= 8,
    page_admin_members: level >= 8,
    page_admin_logs: level >= 10,
    page_admin_tools: level >= 8,
    page_organizational_tasks: level >= 2,
    fn_manage_opportunities: level >= 8,
    fn_sync_applicant_sheet: level >= 8,
    fn_manage_role_permissions: level >= 8,
    fn_generate_member_ids: level >= 8,
    fn_manage_maintenance_mode: level >= 8,
    fn_backup_database: level >= 8,
    fn_export_all_data: level >= 8,
    fn_manage_homepage_content: level >= 8,
    fn_manage_notifications: level >= 8,
    fn_manage_issuance: level >= 8,
    fn_manage_attendance_events: level >= 5,
    fn_moderate_feedback: level >= 8,
    fn_manage_projects: level >= 8,
    fn_manage_organizational_tasks: level >= 4,
  };

  if (level <= 0) {
    SYSTEM_PERMISSION_KEYS.forEach(function (key) {
      defaults[key] = false;
    });
  }

  return defaults;
}

function getDefaultSystemRoles_() {
  const defaults = [
    ['Auditor', 10, '#f59e0b', 'Top level.'],
    ['Assistant Auditor 1', 9, '#d97706', 'Assistant to Auditor.'],
    ['Assistant Auditor 2', 9, '#d97706', 'Assistant to Auditor.'],
    ['Admin', 8, '#ef4444', 'Below Auditor.'],
    ['Assistant Admin 1', 7, '#dc2626', 'Assistant to Admin.'],
    ['Assistant Admin 2', 7, '#dc2626', 'Assistant to Admin.'],
    ['Founder', 6, '#7c3aed', 'Below Admin.'],
    ['Tagum Chapter President', 5, '#059669', 'Tagum chapter leader.'],
    ['Barangay Chapter President', 4, '#10b981', 'Barangay chapter leader.'],
    ['Member', 2, '#3b82f6', 'Standard member role.'],
    ['Volunteer', 2, '#6366f1', 'Volunteer role.'],
    ['Guest', 1, '#9ca3af', 'Guest role.'],
    ['Suspended', 0, '#6b7280', 'Temporarily suspended.'],
    ['Banned', 0, '#1f2937', 'Permanently banned.'],
  ];

  return defaults.map(function (role) {
    return [
      role[0],
      role[1],
      role[2],
      role[3],
      JSON.stringify(getDefaultPermissionsForLevel_(role[1])),
    ];
  });
}

function ensureSystemRolesSheet_() {
  if (!SYSTEM_SETTINGS_SPREADSHEET_ID) {
    throw new Error('SYSTEM_SETTINGS_SPREADSHEET_ID is not configured');
  }

  const ss = SpreadsheetApp.openById(SYSTEM_SETTINGS_SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SYSTEM_ROLES_SHEET_NAME);
  const defaults = getDefaultSystemRoles_();

  if (!sheet) {
    sheet = ss.insertSheet(SYSTEM_ROLES_SHEET_NAME);
    sheet.getRange(1, 1, 1, SYSTEM_ROLES_HEADERS.length).setValues([SYSTEM_ROLES_HEADERS]);
    sheet.getRange(2, 1, defaults.length, SYSTEM_ROLES_HEADERS.length).setValues(defaults);
    sheet.getRange(1, 1, 1, SYSTEM_ROLES_HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return sheet;
  }

  const lastColumn = Math.max(sheet.getLastColumn(), SYSTEM_ROLES_HEADERS.length);
  const headerRow = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const hasAllHeaders = SYSTEM_ROLES_HEADERS.every(function (header, index) {
    return String(headerRow[index] || '').trim() === header;
  });

  if (!hasAllHeaders) {
    sheet.clearContents();
    sheet.getRange(1, 1, 1, SYSTEM_ROLES_HEADERS.length).setValues([SYSTEM_ROLES_HEADERS]);
    sheet.getRange(2, 1, defaults.length, SYSTEM_ROLES_HEADERS.length).setValues(defaults);
    sheet.getRange(1, 1, 1, SYSTEM_ROLES_HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  } else if (sheet.getLastRow() <= 1) {
    sheet.getRange(2, 1, defaults.length, SYSTEM_ROLES_HEADERS.length).setValues(defaults);
  }

  return sheet;
}

function parsePermissions_(rawValue, level) {
  const defaults = getDefaultPermissionsForLevel_(level);
  if (!rawValue) return defaults;
  try {
    const parsed = JSON.parse(String(rawValue));
    const merged = {};
    Object.keys(defaults).forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(parsed, key)) {
        merged[key] = !!parsed[key];
      } else {
        merged[key] = !!defaults[key];
      }
    });

    Object.keys(parsed || {}).forEach(function (key) {
      if (!Object.prototype.hasOwnProperty.call(merged, key)) {
        merged[key] = !!parsed[key];
      }
    });

    return merged;
  } catch (error) {
    return defaults;
  }
}

function getSystemRoles() {
  const sheet = ensureSystemRolesSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, SYSTEM_ROLES_HEADERS.length).getValues();
  return values
    .filter(function (row) {
      return String(row[0] || '').trim() !== '';
    })
    .map(function (row) {
      const powerLevel = Number(row[1]) || 0;
      return {
        name: String(row[0] || ''),
        powerLevel: powerLevel,
        color: String(row[2] || '#6b7280'),
        description: String(row[3] || ''),
        permissions: parsePermissions_(row[4], powerLevel),
      };
    })
    .sort(function (a, b) {
      return b.powerLevel - a.powerLevel || a.name.localeCompare(b.name);
    });
}

function addSystemRole(data) {
  const sheet = ensureSystemRolesSheet_();
  const roleName = String((data && (data.name || data.roleName)) || '').trim();
  const powerLevel = Number(data && data.powerLevel);
  const color = String((data && data.color) || '#6b7280').trim();
  const description = String((data && data.description) || '').trim();
  const permissions = (data && data.permissions) || getDefaultPermissionsForLevel_(powerLevel);

  if (!roleName) throw new Error('RoleName is required');
  if (isNaN(powerLevel)) throw new Error('PowerLevel must be a valid number');

  const existing = getSystemRoles();
  const duplicate = existing.some(function (role) {
    return role.name.toLowerCase() === roleName.toLowerCase();
  });
  if (duplicate) throw new Error('Role already exists: ' + roleName);

  sheet.appendRow([
    roleName,
    powerLevel,
    color,
    description,
    JSON.stringify(permissions),
  ]);

  return {
    success: true,
    message: 'Role added successfully',
    role: {
      name: roleName,
      powerLevel: powerLevel,
      color: color,
      description: description,
      permissions: permissions,
    },
  };
}

function updateSystemRole(data) {
  const sheet = ensureSystemRolesSheet_();
  const originalName = String((data && (data.originalName || data.oldRoleName || data.previousName || data.name || data.roleName)) || '').trim();
  const roleName = String((data && (data.name || data.roleName)) || '').trim();
  const powerLevel = Number(data && data.powerLevel);
  const color = String((data && data.color) || '#6b7280').trim();
  const description = String((data && data.description) || '').trim();
  const permissions = (data && data.permissions) || getDefaultPermissionsForLevel_(powerLevel);

  if (!originalName) throw new Error('Original role name is required');
  if (!roleName) throw new Error('RoleName is required');
  if (isNaN(powerLevel)) throw new Error('PowerLevel must be a valid number');

  const dataRange = sheet.getDataRange().getValues();
  let targetRow = -1;

  for (let i = 1; i < dataRange.length; i++) {
    const existingName = String(dataRange[i][0] || '').trim();
    if (existingName.toLowerCase() === originalName.toLowerCase()) {
      targetRow = i + 1;
      break;
    }
  }

  if (targetRow === -1) throw new Error('Role not found: ' + originalName);

  for (let i = 1; i < dataRange.length; i++) {
    const existingName = String(dataRange[i][0] || '').trim();
    if (
      existingName &&
      existingName.toLowerCase() === roleName.toLowerCase() &&
      i + 1 !== targetRow
    ) {
      throw new Error('Role already exists: ' + roleName);
    }
  }

  sheet.getRange(targetRow, 1, 1, SYSTEM_ROLES_HEADERS.length).setValues([[
    roleName,
    powerLevel,
    color,
    description,
    JSON.stringify(permissions),
  ]]);

  return {
    success: true,
    message: 'Role updated successfully',
    role: {
      name: roleName,
      powerLevel: powerLevel,
      color: color,
      description: description,
      permissions: permissions,
    },
  };
}

function deleteSystemRole(roleName) {
  const targetName = String(roleName || '').trim();
  if (!targetName) throw new Error('RoleName is required');

  const sheet = ensureSystemRolesSheet_();
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const existingName = String(data[i][0] || '').trim();
    if (existingName.toLowerCase() === targetName.toLowerCase()) {
      sheet.deleteRow(i + 1);
      return {
        success: true,
        message: 'Role deleted successfully',
        deletedRole: existingName,
      };
    }
  }

  throw new Error('Role not found: ' + targetName);
}
