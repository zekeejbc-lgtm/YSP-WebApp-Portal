import type React from "react";

// Pending Application type definition
export interface PendingApplication {
  id: string;
  name: string;
  email: string;
  phone: string;
  dateApplied: string;
  committee: string;
  status: "pending" | "approved" | "rejected";
  rejectionReason?: string;
  rejectionMessage?: string;
  adminNotes?: string;
  approvedBy?: string;
  approvedDate?: string;
  rejectedBy?: string;
  rejectedDate?: string;
  accountCreated?: boolean;
  fullData: ApplicationData;
}

export interface ApplicationData {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  dateOfBirth: string;
  age: number;
  gender: string;
  civilStatus: string;
  nationality: string;
  chapter: string;
  committeePreference: string;
  desiredRole: string;
  skills?: string;
  education?: string;
  certifications?: string;
  experience?: string;
  achievements?: string;
  volunteerHistory?: string;
  reasonForJoining?: string;
  personalStatement?: string;
  emergencyContactName?: string;
  emergencyContactRelation?: string;
  emergencyContactNumber?: string;
  facebook?: string;
  instagram?: string;
  twitter?: string;
  attachments?: {
    type: string;
    name: string;
    url: string;
  }[];
  profilePicture?: string;
  additionalFields?: Record<string, string>;
}

// Navigation types
export interface NavPage {
  id: string;
  label: string;
  action: () => void;
  roles?: string[]; // Optional: roles that can see this page
  icon?: React.ReactNode;
}

export interface NavGroup {
  id: string;
  label: string;
  pages: NavPage[];
  roles?: string[]; // Optional: roles that can see this group
  icon?: React.ReactNode;
}

// Social Media Platform Detection Helper
export interface SocialPlatform {
  name: string;
  color: string;
  bgColor: string;
  darkBgColor: string;
  borderColor: string;
  darkBorderColor: string;
  icon: string; // SVG path or emoji
}

export interface PermissionSet {
  canManageUsers: boolean;
  canAccessSystemTools: boolean;
  canExportData: boolean;
  canEditContent: boolean;
  canApproveMembers: boolean;
  canManageEvents: boolean;
  [key: string]: boolean;
}

export interface SystemRole {
  name: string;
  powerLevel: number;
  color: string;
  description?: string;
  permissions: PermissionSet;
}

export const DEFAULT_PERMISSIONS: PermissionSet = {
  canManageUsers: false,
  canAccessSystemTools: false,
  canExportData: false,
  canEditContent: false,
  canApproveMembers: false,
  canManageEvents: false,
  page_home: false,
  page_feedback: false,
  page_my_qrid: false,
  page_attendance_transparency: false,
  page_profile: false,
  page_announcements: false,
  page_issuance: false,
  page_applications: false,
  page_settings: false,
  page_directory: false,
  page_attendance_dashboard: false,
  page_attendance_recording: false,
  page_events: false,
  page_admin_members: false,
  page_admin_logs: false,
  page_admin_tools: false,
  page_organizational_tasks: false,
  page_kaagapai_meet: false,
  fn_manage_opportunities: false,
  fn_sync_applicant_sheet: false,
  fn_manage_role_permissions: false,
  fn_generate_member_ids: false,
  fn_manage_maintenance_mode: false,
  fn_backup_database: false,
  fn_export_all_data: false,
  fn_manage_homepage_content: false,
  fn_manage_notifications: false,
  fn_manage_issuance: false,
  fn_manage_attendance_events: false,
  fn_moderate_feedback: false,
  fn_manage_projects: false,
  fn_manage_organizational_tasks: false,
};

export interface PermissionToggleDefinition {
  key: string;
  label: string;
  group: "core" | "pages" | "functions";
}

export const PERMISSION_TOGGLE_DEFINITIONS: PermissionToggleDefinition[] = [
  { key: "canManageUsers", label: "Manage Users", group: "core" },
  { key: "canAccessSystemTools", label: "Access System Tools", group: "core" },
  { key: "canExportData", label: "Export Data", group: "core" },
  { key: "canEditContent", label: "Edit Content", group: "core" },
  { key: "canApproveMembers", label: "Approve Members", group: "core" },
  { key: "canManageEvents", label: "Manage Events", group: "core" },
  { key: "page_home", label: "Page: Home", group: "pages" },
  { key: "page_feedback", label: "Page: Feedback", group: "pages" },
  { key: "page_my_qrid", label: "Page: My QR ID", group: "pages" },
  { key: "page_attendance_transparency", label: "Page: Attendance Transparency", group: "pages" },
  { key: "page_profile", label: "Page: My Profile", group: "pages" },
  { key: "page_announcements", label: "Page: Announcements", group: "pages" },
  { key: "page_issuance", label: "Page: Issuance Center", group: "pages" },
  { key: "page_applications", label: "Page: Membership Applications", group: "pages" },
  { key: "page_settings", label: "Page: Settings", group: "pages" },
  { key: "page_directory", label: "Page: Officer Directory", group: "pages" },
  { key: "page_attendance_dashboard", label: "Page: Attendance Dashboard", group: "pages" },
  { key: "page_attendance_recording", label: "Page: Attendance Recording", group: "pages" },
  { key: "page_events", label: "Page: Manage Events", group: "pages" },
  { key: "page_admin_members", label: "Page: Manage Members", group: "pages" },
  { key: "page_admin_logs", label: "Page: Access Logs", group: "pages" },
  { key: "page_admin_tools", label: "Page: System Tools", group: "pages" },
  { key: "page_organizational_tasks", label: "Page: Organizational Task", group: "pages" },
  { key: "page_kaagapai_meet", label: "Page: KaagapAI Meet", group: "pages" },
  { key: "fn_manage_opportunities", label: "Function: Manage Opportunities", group: "functions" },
  { key: "fn_sync_applicant_sheet", label: "Function: Sync Applicant Sheet", group: "functions" },
  { key: "fn_manage_role_permissions", label: "Function: Manage Role Permissions", group: "functions" },
  { key: "fn_generate_member_ids", label: "Function: Generate Member IDs", group: "functions" },
  { key: "fn_manage_maintenance_mode", label: "Function: Manage Maintenance", group: "functions" },
  { key: "fn_backup_database", label: "Function: Backup Database", group: "functions" },
  { key: "fn_export_all_data", label: "Function: Export All Data", group: "functions" },
  { key: "fn_manage_homepage_content", label: "Function: Manage Homepage Content", group: "functions" },
  { key: "fn_manage_notifications", label: "Function: Manage Notifications", group: "functions" },
  { key: "fn_manage_issuance", label: "Function: Manage Issuance", group: "functions" },
  { key: "fn_manage_attendance_events", label: "Function: Manage Attendance Events", group: "functions" },
  { key: "fn_moderate_feedback", label: "Function: Moderate Feedback", group: "functions" },
  { key: "fn_manage_projects", label: "Function: Manage Projects", group: "functions" },
  { key: "fn_manage_organizational_tasks", label: "Function: Manage Organizational Tasks", group: "functions" },
];

// Role hierarchy levels
export const ROLE_HIERARCHY: Record<string, number> = {
  banned: 0,
  suspended: 1,
  guest: 2,
  member: 2,
  head: 3,
  admin: 4,
  auditor: 5,
};
