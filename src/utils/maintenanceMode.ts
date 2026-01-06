/**
 * =============================================================================
 * MAINTENANCE MODE UTILITY
 * =============================================================================
 * 
 * Manages maintenance mode state for pages and entire PWA
 * Uses localStorage for persistence
 * 
 * =============================================================================
 */

export interface MaintenanceConfig {
  enabled: boolean;
  reason?: string;
  message?: string;
  estimatedTime?: string;
  maintenanceDate?: string;
  durationDays?: number;
}

export interface MaintenanceModeState {
  fullPWA: MaintenanceConfig;
  pages: {
    [pageId: string]: MaintenanceConfig;
  };
}

const STORAGE_KEY = "ysp_maintenance_mode";

// Available pages that can be put in maintenance mode
export const AVAILABLE_PAGES = [
  { id: "dashboard", name: "Dashboard" },
  { id: "announcements", name: "Announcements" },
  { id: "attendance-dashboard", name: "Attendance Dashboard" },
  { id: "attendance-recording", name: "Attendance Recording" },
  { id: "attendance-transparency", name: "Attendance Transparency" },
  { id: "manage-events", name: "Manage Events" },
  { id: "my-qrid", name: "My QR ID" },
  { id: "officer-directory", name: "Officer Directory" },
  { id: "manage-members", name: "Manage Members" },
  { id: "membership-applications", name: "Membership Applications" },
  { id: "membership-editor", name: "Membership Application Form Editor" },
  { id: "feedback", name: "Feedback & Suggestions" },
  { id: "my-profile", name: "My Profile" },
  { id: "access-logs", name: "Access Logs" },
];

// Get current maintenance mode state
export function getMaintenanceMode(): MaintenanceModeState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Failed to load maintenance mode:", error);
  }

  // Default state
  return {
    fullPWA: { enabled: false },
    pages: {},
  };
}

// Save maintenance mode state
export function saveMaintenanceMode(state: MaintenanceModeState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Failed to save maintenance mode:", error);
  }
}

// Enable full PWA maintenance mode
export function enableFullPWAMaintenance(
  reason?: string,
  message?: string,
  estimatedTime?: string,
  maintenanceDate?: string,
  durationDays?: number
): void {
  const state = getMaintenanceMode();
  state.fullPWA = {
    enabled: true,
    reason,
    message,
    estimatedTime,
    maintenanceDate,
    durationDays,
  };
  saveMaintenanceMode(state);
}

// Disable full PWA maintenance mode
export function disableFullPWAMaintenance(): void {
  const state = getMaintenanceMode();
  state.fullPWA = { enabled: false };
  saveMaintenanceMode(state);
}

// Enable maintenance mode for a specific page
export function enablePageMaintenance(
  pageId: string,
  reason?: string,
  message?: string,
  estimatedTime?: string,
  maintenanceDate?: string,
  durationDays?: number
): void {
  const state = getMaintenanceMode();
  state.pages[pageId] = {
    enabled: true,
    reason,
    message,
    estimatedTime,
    maintenanceDate,
    durationDays,
  };
  saveMaintenanceMode(state);
}

// Disable maintenance mode for a specific page
export function disablePageMaintenance(pageId: string): void {
  const state = getMaintenanceMode();
  if (state.pages[pageId]) {
    state.pages[pageId] = { enabled: false };
  }
  saveMaintenanceMode(state);
}

// Check if full PWA is in maintenance mode
export function isFullPWAInMaintenance(): boolean {
  const state = getMaintenanceMode();
  return state.fullPWA.enabled;
}

// Check if a specific page is in maintenance mode
export function isPageInMaintenance(pageId: string): boolean {
  const state = getMaintenanceMode();
  return state.pages[pageId]?.enabled || false;
}

// Get maintenance config for full PWA
export function getFullPWAMaintenanceConfig(): MaintenanceConfig {
  const state = getMaintenanceMode();
  return state.fullPWA;
}

// Get maintenance config for a specific page
export function getPageMaintenanceConfig(pageId: string): MaintenanceConfig {
  const state = getMaintenanceMode();
  return state.pages[pageId] || { enabled: false };
}

// Clear all maintenance modes
export function clearAllMaintenance(): void {
  saveMaintenanceMode({
    fullPWA: { enabled: false },
    pages: {},
  });
}