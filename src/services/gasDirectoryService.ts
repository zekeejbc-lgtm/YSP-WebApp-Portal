/**
 * Google Apps Script Directory Service
 * Handles officer directory search and retrieval from GAS Spreadsheet Backend
 * 
 * Sheet: User Profiles (same as login system)
 * Columns: ID Code, Full name, Position, Committee, Role, Status, etc.
 */

/// <reference types="vite/client" />

// =================== TYPES ===================

export interface DirectoryOfficer {
  // Core identification
  idCode: string;
  fullName: string;
  
  // YSP Role Info
  position: string;
  committee: string;
  role: string;
  status: string;
  chapter: string;
  dateJoined: string;
  membershipType: string;
  
  // Contact Info
  email: string;
  personalEmail: string;
  contactNumber: string;
  
  // Personal Info
  birthday: string;
  age: number;
  gender: string;
  pronouns: string;
  civilStatus: string;
  nationality: string;
  religion: string;
  
  // Profile Picture
  profilePicture: string;
  
  // Social Media
  facebook: string;
  instagram: string;
  twitter: string;
}

export interface SearchOfficersResponse {
  success: boolean;
  officers?: DirectoryOfficer[];
  total?: number;
  error?: string;
  code?: number;
}

export interface GetOfficerResponse {
  success: boolean;
  officer?: DirectoryOfficer;
  error?: string;
  code?: number;
}

export interface GetAllOfficersResponse {
  success: boolean;
  officers?: DirectoryOfficer[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  error?: string;
  code?: number;
}

// =================== CONFIGURATION ===================

const DIRECTORY_CONFIG = {
  // Uses the same GAS Web App URL as login (same project, different file)
  API_URL: import.meta.env.VITE_GAS_LOGIN_API_URL || '',
  
  // Timeout for API calls (in milliseconds)
  TIMEOUT: 15000,
  
  // Cache configuration
  CACHE_KEY: 'ysp_directory_cache',
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
};

// =================== ERROR HANDLING ===================

export class DirectoryAPIError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'DirectoryAPIError';
  }
}

export const DirectoryErrorCodes = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  SERVER_ERROR: 'SERVER_ERROR',
  NO_API_URL: 'NO_API_URL',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
} as const;

// =================== CACHE HELPERS ===================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

function getCachedData<T>(key: string): T | null {
  try {
    const cached = sessionStorage.getItem(key);
    if (!cached) return null;
    
    const entry: CacheEntry<T> = JSON.parse(cached);
    const now = Date.now();
    
    if (now - entry.timestamp > DIRECTORY_CONFIG.CACHE_DURATION) {
      sessionStorage.removeItem(key);
      return null;
    }
    
    return entry.data;
  } catch {
    return null;
  }
}

function setCachedData<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
    };
    sessionStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Cache write failed, continue without caching
  }
}

// =================== API FUNCTIONS ===================

/**
 * Search officers by name, ID code, committee, or position
 * @param query - Search query string
 * @returns Promise<SearchOfficersResponse>
 */
export async function searchOfficers(query: string): Promise<SearchOfficersResponse> {
  // Return empty results for empty query
  if (!query || query.trim().length === 0) {
    return { success: true, officers: [], total: 0 };
  }

  // Check if API URL is configured
  if (!DIRECTORY_CONFIG.API_URL) {
    console.warn('Directory API URL not configured. Please set VITE_GAS_DIRECTORY_API_URL or VITE_GAS_LOGIN_API_URL environment variable.');
    throw new DirectoryAPIError(
      'Directory service not configured',
      DirectoryErrorCodes.NO_API_URL
    );
  }

  // Check cache first
  const cacheKey = `${DIRECTORY_CONFIG.CACHE_KEY}_search_${query.toLowerCase().trim()}`;
  const cachedResult = getCachedData<SearchOfficersResponse>(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DIRECTORY_CONFIG.TIMEOUT);

    const response = await fetch(DIRECTORY_CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain', // GAS requires text/plain for CORS
      },
      body: JSON.stringify({
        action: 'searchOfficers',
        query: query.trim(),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new DirectoryAPIError(
        `Server responded with status ${response.status}`,
        DirectoryErrorCodes.SERVER_ERROR,
        response.status
      );
    }

    const data: SearchOfficersResponse = await response.json();

    if (!data.success) {
      throw new DirectoryAPIError(
        data.error || 'Search failed',
        DirectoryErrorCodes.SERVER_ERROR,
        data.code
      );
    }

    // Cache the result
    setCachedData(cacheKey, data);

    return data;

  } catch (error) {
    if (error instanceof DirectoryAPIError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new DirectoryAPIError(
          'Search request timed out. Please try again.',
          DirectoryErrorCodes.TIMEOUT_ERROR
        );
      }
      throw new DirectoryAPIError(
        error.message || 'Network error occurred',
        DirectoryErrorCodes.NETWORK_ERROR
      );
    }

    throw new DirectoryAPIError(
      'An unexpected error occurred',
      DirectoryErrorCodes.SERVER_ERROR
    );
  }
}

/**
 * Get officer details by ID Code
 * @param idCode - Officer ID Code
 * @returns Promise<GetOfficerResponse>
 */
export async function getOfficerByIdCode(idCode: string): Promise<GetOfficerResponse> {
  if (!idCode || idCode.trim().length === 0) {
    throw new DirectoryAPIError(
      'ID Code is required',
      DirectoryErrorCodes.INVALID_RESPONSE
    );
  }

  if (!DIRECTORY_CONFIG.API_URL) {
    throw new DirectoryAPIError(
      'Directory service not configured',
      DirectoryErrorCodes.NO_API_URL
    );
  }

  // Check cache first
  const cacheKey = `${DIRECTORY_CONFIG.CACHE_KEY}_officer_${idCode.toLowerCase().trim()}`;
  const cachedResult = getCachedData<GetOfficerResponse>(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DIRECTORY_CONFIG.TIMEOUT);

    const response = await fetch(DIRECTORY_CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify({
        action: 'getOfficerByIdCode',
        idCode: idCode.trim(),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new DirectoryAPIError(
        `Server responded with status ${response.status}`,
        DirectoryErrorCodes.SERVER_ERROR,
        response.status
      );
    }

    const data: GetOfficerResponse = await response.json();

    if (!data.success) {
      if (data.code === 404) {
        throw new DirectoryAPIError(
          data.error || 'Officer not found',
          DirectoryErrorCodes.NOT_FOUND,
          404
        );
      }
      throw new DirectoryAPIError(
        data.error || 'Failed to fetch officer',
        DirectoryErrorCodes.SERVER_ERROR,
        data.code
      );
    }

    // Cache the result
    setCachedData(cacheKey, data);

    return data;

  } catch (error) {
    if (error instanceof DirectoryAPIError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new DirectoryAPIError(
          'Request timed out. Please try again.',
          DirectoryErrorCodes.TIMEOUT_ERROR
        );
      }
      throw new DirectoryAPIError(
        error.message || 'Network error occurred',
        DirectoryErrorCodes.NETWORK_ERROR
      );
    }

    throw new DirectoryAPIError(
      'An unexpected error occurred',
      DirectoryErrorCodes.SERVER_ERROR
    );
  }
}

/**
 * Get all officers (paginated)
 * @param page - Page number (1-indexed)
 * @param limit - Number of officers per page (default 50, max 100)
 * @returns Promise<GetAllOfficersResponse>
 */
export async function getAllOfficers(
  page: number = 1,
  limit: number = 50
): Promise<GetAllOfficersResponse> {
  if (!DIRECTORY_CONFIG.API_URL) {
    throw new DirectoryAPIError(
      'Directory service not configured',
      DirectoryErrorCodes.NO_API_URL
    );
  }

  // Check cache first
  const cacheKey = `${DIRECTORY_CONFIG.CACHE_KEY}_all_${page}_${limit}`;
  const cachedResult = getCachedData<GetAllOfficersResponse>(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DIRECTORY_CONFIG.TIMEOUT);

    const response = await fetch(DIRECTORY_CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify({
        action: 'getAllOfficers',
        page,
        limit: Math.min(limit, 100),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new DirectoryAPIError(
        `Server responded with status ${response.status}`,
        DirectoryErrorCodes.SERVER_ERROR,
        response.status
      );
    }

    const data: GetAllOfficersResponse = await response.json();

    if (!data.success) {
      throw new DirectoryAPIError(
        data.error || 'Failed to fetch officers',
        DirectoryErrorCodes.SERVER_ERROR,
        data.code
      );
    }

    // Cache the result
    setCachedData(cacheKey, data);

    return data;

  } catch (error) {
    if (error instanceof DirectoryAPIError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new DirectoryAPIError(
          'Request timed out. Please try again.',
          DirectoryErrorCodes.TIMEOUT_ERROR
        );
      }
      throw new DirectoryAPIError(
        error.message || 'Network error occurred',
        DirectoryErrorCodes.NETWORK_ERROR
      );
    }

    throw new DirectoryAPIError(
      'An unexpected error occurred',
      DirectoryErrorCodes.SERVER_ERROR
    );
  }
}

/**
 * Clear directory cache
 */
export function clearDirectoryCache(): void {
  try {
    // Get all sessionStorage keys
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(DIRECTORY_CONFIG.CACHE_KEY)) {
        keysToRemove.push(key);
      }
    }
    // Remove cached items
    keysToRemove.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // Silently fail if sessionStorage is not available
  }
}

/**
 * Check if directory API is configured and reachable
 * @returns Promise<boolean>
 */
export async function checkDirectoryApiHealth(): Promise<boolean> {
  if (!DIRECTORY_CONFIG.API_URL) {
    return false;
  }

  try {
    const response = await fetch(`${DIRECTORY_CONFIG.API_URL}?action=health`, {
      method: 'GET',
    });
    const data = await response.json();
    return data.status === 'healthy';
  } catch {
    return false;
  }
}

// =================== UTILITY FUNCTIONS ===================

/**
 * Format role for display
 */
export function getRoleDisplayName(role: string): string {
  const roleMap: Record<string, string> = {
    auditor: 'Auditor',
    admin: 'Admin',
    head: 'Head',
    member: 'Member',
    guest: 'Guest',
  };
  return roleMap[role?.toLowerCase()] || role || 'Member';
}

/**
 * Get role badge color
 */
export function getRoleBadgeColor(role: string): string {
  const colorMap: Record<string, string> = {
    auditor: 'purple',
    admin: 'red',
    head: 'orange',
    member: 'blue',
    guest: 'gray',
  };
  return colorMap[role?.toLowerCase()] || 'gray';
}
