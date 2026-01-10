/**
 * Google Apps Script System Tools Service
 * Handles system administration operations against GAS Backend
 * 
 * Features:
 * - Database backup/export
 * - Cache version management (force refresh)
 * - Maintenance mode management
 * - System health monitoring
 */

/// <reference types="vite/client" />

// =================== TYPES ===================

export interface SystemHealthData {
  database: 'healthy' | 'warning' | 'error';
  databaseRows: number;
  storage: number; // percentage used
  totalCells: number;
  maxCells: number;
  api: 'online' | 'offline';
  lastBackup: string;
  lastExport: string;
  cacheVersion: number;
  timestamp: string;
}

export interface BackupResult {
  backupId: string;
  backupUrl: string;
  backupName: string;
  sheets: Array<{ name: string; rows: number; columns: number }>;
  sheetsCount: number;
  timestamp: string;
  message: string;
}

export interface ExportResult {
  exportId: string;
  exportUrl: string;
  exportName: string;
  sheets: Array<{ name: string; rows: number; columns: number; cells: number }>;
  sheetsCount: number;
  totalRows: number;
  totalCells: number;
  timestamp: string;
  message: string;
}

export interface CacheVersionResult {
  previousVersion: number;
  newVersion: number;
  message: string;
  timestamp: string;
}

export interface MaintenanceConfig {
  enabled: boolean;
  reason?: string;
  message?: string;
  estimatedTime?: string;
  maintenanceDate?: string;
  durationDays?: number;
  enabledAt?: string;
  enabledBy?: string;
}

export interface MaintenanceModeState {
  fullPWA: MaintenanceConfig;
  pages: {
    [pageId: string]: MaintenanceConfig;
  };
  timestamp?: string;
}

export interface SystemToolsResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: number;
}

// =================== API CONFIGURATION ===================

// Prefer dedicated System Tools API URL; fallback to login API
const GAS_API_URL =
  import.meta.env.VITE_GAS_SYSTEM_TOOLS_API_URL ||
  import.meta.env.VITE_GAS_LOGIN_API_URL ||
  '';

// Debug: Log API URL on load (remove in production)
console.log('[SystemTools] API URL configured:', GAS_API_URL ? GAS_API_URL.substring(0, 60) + '...' : 'NOT SET');

// Cache keys
const CACHE_VERSION_KEY = 'ysp_cache_version';
const MAINTENANCE_CACHE_KEY = 'ysp_maintenance_mode';
const MAINTENANCE_CACHE_TTL = 60 * 1000; // 1 minute cache for maintenance mode

// =================== ERROR HANDLING ===================

export class SystemToolsAPIError extends Error {
  constructor(
    message: string,
    public code: number,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'SystemToolsAPIError';
  }
}

export const SystemToolsErrorCodes = {
  NETWORK_ERROR: 1001,
  API_ERROR: 1002,
  PARSE_ERROR: 1003,
  NOT_CONFIGURED: 1004,
  UNAUTHORIZED: 1005,
} as const;

// =================== API HELPERS ===================

async function callSystemToolsAPI<T>(
  action: string,
  data: Record<string, unknown> = {}
): Promise<T> {
  if (!GAS_API_URL) {
    console.error('[SystemTools] API URL not configured!');
    throw new SystemToolsAPIError(
      'System Tools API not configured',
      SystemToolsErrorCodes.NOT_CONFIGURED
    );
  }

  console.log('[SystemTools] Calling API:', action, { url: GAS_API_URL.substring(0, 60) });

  try {
    const response = await fetch(GAS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({ action, ...data }),
    });

    console.log('[SystemTools] Response status:', response.status, response.statusText);

    if (!response.ok) {
      throw new SystemToolsAPIError(
        `HTTP error: ${response.status}`,
        SystemToolsErrorCodes.API_ERROR
      );
    }

    const result: SystemToolsResponse<T> = await response.json();
    console.log('[SystemTools] Response data:', result.success ? 'success' : 'failed', result);

    if (!result.success) {
      throw new SystemToolsAPIError(
        result.error || 'Unknown API error',
        result.code || SystemToolsErrorCodes.API_ERROR
      );
    }

    return result.data as T;
  } catch (error) {
    console.error('[SystemTools] API Error:', error);
    if (error instanceof SystemToolsAPIError) {
      throw error;
    }
    throw new SystemToolsAPIError(
      error instanceof Error ? error.message : 'Network error',
      SystemToolsErrorCodes.NETWORK_ERROR,
      error
    );
  }
}

// =================== SYSTEM HEALTH ===================

/**
 * Get system health status from backend
 */
export async function getSystemHealth(): Promise<SystemHealthData> {
  return callSystemToolsAPI<SystemHealthData>('getSystemHealth');
}

// =================== DATABASE BACKUP ===================

/**
 * Create a database backup
 */
export async function createDatabaseBackup(username: string): Promise<BackupResult> {
  return callSystemToolsAPI<BackupResult>('databaseBackup', { username });
}

// =================== EXPORT DATA ===================

/**
 * Export all data to a new spreadsheet
 */
export async function exportData(username: string): Promise<ExportResult> {
  return callSystemToolsAPI<ExportResult>('exportData', { username });
}

// =================== CACHE VERSION MANAGEMENT ===================

/**
 * Get current cache version from backend
 */
export async function getCacheVersionFromBackend(): Promise<number> {
  const result = await callSystemToolsAPI<{ version: number }>('getCacheVersion');
  return result.version;
}

/**
 * Bump cache version (force all clients to refresh)
 */
export async function bumpCacheVersion(username: string): Promise<CacheVersionResult> {
  const result = await callSystemToolsAPI<CacheVersionResult>('bumpCacheVersion', { username });
  
  // Update local cache version to match
  localStorage.setItem(CACHE_VERSION_KEY, result.newVersion.toString());
  
  return result;
}

/**
 * Get locally stored cache version
 */
export function getLocalCacheVersion(): number {
  const stored = localStorage.getItem(CACHE_VERSION_KEY);
  return stored ? parseInt(stored, 10) : 0;
}

/**
 * Set local cache version
 */
export function setLocalCacheVersion(version: number): void {
  localStorage.setItem(CACHE_VERSION_KEY, version.toString());
}

/**
 * Check if cache needs refresh (local version differs from backend)
 */
export async function checkCacheRefreshNeeded(): Promise<boolean> {
  try {
    const backendVersion = await getCacheVersionFromBackend();
    const localVersion = getLocalCacheVersion();
    
    if (backendVersion > localVersion) {
      // Update local version and signal refresh needed
      setLocalCacheVersion(backendVersion);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking cache version:', error);
    return false;
  }
}

/**
 * Force clear all caches and reload
 */
export async function forceClearAllCaches(): Promise<void> {
  // Clear all localStorage except session data
  const sessionData = localStorage.getItem('ysp_session');
  const user = localStorage.getItem('ysp_user');
  
  // Clear service worker caches if available
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
  }
  
  // Clear localStorage
  localStorage.clear();
  
  // Restore session data
  if (sessionData) localStorage.setItem('ysp_session', sessionData);
  if (user) localStorage.setItem('ysp_user', user);
  
  // Reload the page
  window.location.reload();
}

// =================== MAINTENANCE MODE ===================

let maintenanceModeCache: { data: MaintenanceModeState; timestamp: number } | null = null;

/**
 * Get maintenance mode status from backend
 */
export async function getMaintenanceModeFromBackend(forceRefresh = false): Promise<MaintenanceModeState> {
  // Check cache first (unless forced refresh)
  if (!forceRefresh && maintenanceModeCache) {
    const now = Date.now();
    if (now - maintenanceModeCache.timestamp < MAINTENANCE_CACHE_TTL) {
      return maintenanceModeCache.data;
    }
  }
  
  try {
    const result = await callSystemToolsAPI<MaintenanceModeState>('getMaintenanceMode');
    
    // Update cache
    maintenanceModeCache = {
      data: result,
      timestamp: Date.now()
    };
    
    // Also save to localStorage for offline access
    localStorage.setItem(MAINTENANCE_CACHE_KEY, JSON.stringify(result));
    
    return result;
  } catch (error) {
    // If backend fails, try to use cached data
    const cached = localStorage.getItem(MAINTENANCE_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Return default state if no cache available
    return {
      fullPWA: { enabled: false },
      pages: {}
    };
  }
}

/**
 * Enable maintenance mode for a page or full PWA
 */
export async function enableMaintenanceModeBackend(
  pageId: string,
  config: Omit<MaintenanceConfig, 'enabled' | 'enabledAt' | 'enabledBy'>,
  username: string
): Promise<{ pageId: string; enabled: boolean; message: string }> {
  const result = await callSystemToolsAPI<{ pageId: string; enabled: boolean; message: string }>(
    'enableMaintenanceMode',
    { pageId, config, username }
  );
  
  // Clear maintenance mode cache
  maintenanceModeCache = null;
  localStorage.removeItem(MAINTENANCE_CACHE_KEY);
  
  return result;
}

/**
 * Disable maintenance mode for a page or full PWA
 */
export async function disableMaintenanceModeBackend(
  pageId: string,
  username: string
): Promise<{ pageId: string; enabled: boolean; message: string }> {
  const result = await callSystemToolsAPI<{ pageId: string; enabled: boolean; message: string }>(
    'disableMaintenanceMode',
    { pageId, username }
  );
  
  // Clear maintenance mode cache
  maintenanceModeCache = null;
  localStorage.removeItem(MAINTENANCE_CACHE_KEY);
  
  return result;
}

/**
 * Clear all maintenance modes
 */
export async function clearAllMaintenanceBackend(
  username: string
): Promise<{ message: string }> {
  const result = await callSystemToolsAPI<{ message: string }>(
    'clearAllMaintenance',
    { username }
  );
  
  // Clear maintenance mode cache
  maintenanceModeCache = null;
  localStorage.removeItem(MAINTENANCE_CACHE_KEY);
  
  return result;
}

/**
 * Check if a specific page is in maintenance mode
 * Uses cached data for quick checks
 */
export async function isPageInMaintenanceBackend(pageId: string): Promise<boolean> {
  try {
    const state = await getMaintenanceModeFromBackend();
    
    // Check full PWA first
    if (state.fullPWA.enabled) {
      return true;
    }
    
    // Check specific page
    return state.pages[pageId]?.enabled || false;
  } catch (error) {
    console.error('Error checking maintenance mode:', error);
    return false;
  }
}

/**
 * Get maintenance config for a page
 */
export async function getMaintenanceConfigForPage(pageId: string): Promise<MaintenanceConfig | null> {
  try {
    const state = await getMaintenanceModeFromBackend();
    
    // Check full PWA first
    if (state.fullPWA.enabled) {
      return state.fullPWA;
    }
    
    // Check specific page
    if (state.pages[pageId]?.enabled) {
      return state.pages[pageId];
    }
    
    return null;
  } catch (error) {
    console.error('Error getting maintenance config:', error);
    return null;
  }
}

// =================== CACHE VERSION POLLING ===================

let cachePollingInterval: number | null = null;

/**
 * Start polling for cache version changes
 * If version changes, prompts user to refresh
 */
export function startCacheVersionPolling(intervalMs = 60000): void {
  if (cachePollingInterval) return;
  
  cachePollingInterval = window.setInterval(async () => {
    try {
      const needsRefresh = await checkCacheRefreshNeeded();
      if (needsRefresh) {
        // Dispatch custom event that can be caught by the app
        window.dispatchEvent(new CustomEvent('cache-version-changed', {
          detail: { message: 'A new version is available. Please refresh.' }
        }));
      }
    } catch (error) {
      console.error('Cache version polling error:', error);
    }
  }, intervalMs);
}

/**
 * Stop cache version polling
 */
export function stopCacheVersionPolling(): void {
  if (cachePollingInterval) {
    window.clearInterval(cachePollingInterval);
    cachePollingInterval = null;
  }
}

// =================== AVAILABLE PAGES FOR MAINTENANCE ===================

export const AVAILABLE_PAGES_BACKEND = [
  { id: 'dashboard', name: 'Dashboard' },
  { id: 'announcements', name: 'Announcements' },
  { id: 'attendance-dashboard', name: 'Attendance Dashboard' },
  { id: 'attendance-recording', name: 'Attendance Recording' },
  { id: 'attendance-transparency', name: 'Attendance Transparency' },
  { id: 'manage-events', name: 'Manage Events' },
  { id: 'my-qrid', name: 'My QR ID' },
  { id: 'officer-directory', name: 'Officer Directory' },
  { id: 'manage-members', name: 'Manage Members' },
  { id: 'membership-applications', name: 'Membership Applications' },
  { id: 'membership-editor', name: 'Membership Application Form Editor' },
  { id: 'feedback', name: 'Feedback & Suggestions' },
  { id: 'my-profile', name: 'My Profile' },
  { id: 'access-logs', name: 'Access Logs' },
  { id: 'system-tools', name: 'System Tools' },
];
