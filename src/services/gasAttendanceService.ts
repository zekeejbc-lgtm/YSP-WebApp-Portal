/**
 * Google Apps Script Attendance Service
 * Handles all attendance recording operations with GAS Spreadsheet Backend
 * 
 * Connected to: Attendance_Main.gs
 * 
 * Spreadsheet Structure:
 * - EventAttendance: Attendance records (TimeIn, TimeOut, Status, etc.)
 * - Events: Event details with geofencing
 * - User Profiles: Member lookup for attendance
 */

/// <reference types="vite/client" />

// =====================================================
// TYPES
// =====================================================

export interface AttendanceRecord {
  attendanceId: string;
  eventId: string;
  memberId: string;
  memberName: string;
  status: 'Present' | 'Late' | 'Absent' | 'Excused' | 'CheckedIn' | 'CheckedOut';
  timeIn: string;
  timeOut: string;
  date: string;
  location?: string;
  geofenceStatus?: string;
  notes?: string;
  recordedBy?: string;
  recordedAt?: string;
}

export interface MemberForAttendance {
  id: string;
  name: string;
  committee: string;
  position: string;
  profilePicture?: string;
}

export interface RecordTimeInParams {
  eventId: string;
  memberId: string;
  memberName?: string;
  status?: 'Present' | 'Late';
  location?: {
    lat: number;
    lng: number;
  };
  recordedBy?: string;
}

export interface RecordTimeOutParams {
  eventId: string;
  memberId: string;
  location?: {
    lat: number;
    lng: number;
  };
  recordedBy?: string;
}

export interface RecordManualAttendanceParams {
  eventId: string;
  memberId: string;
  memberName?: string;
  status: 'Present' | 'Late' | 'Absent' | 'Excused';
  timeType: 'in' | 'out' | 'both';
  notes?: string;
  recordedBy?: string;
  overwrite?: boolean;
}

export interface TimeInResponse {
  success: boolean;
  message?: string;
  attendanceId?: string;
  timeIn?: string;
  date?: string;
  geofenceValid?: boolean;
  geofenceMessage?: string;
  error?: string;
  existingRecord?: AttendanceRecord;
}

export interface TimeOutResponse {
  success: boolean;
  message?: string;
  attendanceId?: string;
  timeIn?: string;
  timeOut?: string;
  date?: string;
  error?: string;
  existingTimeOut?: string;
}

export interface ManualAttendanceResponse {
  success: boolean;
  message?: string;
  attendanceId?: string;
  created?: boolean;
  updated?: boolean;
  error?: string;
  existingRecord?: AttendanceRecord;
}

export interface ExistingAttendanceResponse {
  success: boolean;
  exists: boolean;
  record?: {
    attendanceId: string;
    timeIn: string;
    timeOut: string;
    status: string;
    date: string;
  };
  error?: string;
}

export interface GeofenceValidationResponse {
  success: boolean;
  valid: boolean;
  message: string;
  distance?: number;
  radius?: number;
}

export interface GASAttendanceResponse<T = unknown> {
  success: boolean;
  data?: T;
  records?: AttendanceRecord[];
  members?: MemberForAttendance[];
  total?: number;
  message?: string;
  error?: string;
}

// =====================================================
// CONFIGURATION
// =====================================================

const GAS_ATTENDANCE_CONFIG = {
  // Use the same API URL as Events service (they share the same GAS deployment)
  // The Attendance_Main.gs functions are routed through the main doGet/doPost
  API_URL: import.meta.env.VITE_GAS_EVENTS_API_URL || '',
  
  // Timeout for API calls (in milliseconds)
  TIMEOUT: 15000,
  
  // Cache duration for members list (in milliseconds) - 5 minutes
  MEMBERS_CACHE_DURATION: 5 * 60 * 1000,
};

// Cache for members list
let cachedMembers: MemberForAttendance[] | null = null;
let membersCacheTimestamp: number = 0;

// =====================================================
// ERROR HANDLING
// =====================================================

export const AttendanceErrorCodes = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  API_NOT_CONFIGURED: 'API_NOT_CONFIGURED',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  EXISTING_RECORD: 'EXISTING_RECORD',
  NO_TIME_IN: 'NO_TIME_IN',
  ALREADY_TIMED_OUT: 'ALREADY_TIMED_OUT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
} as const;

export class AttendanceAPIError extends Error {
  code: string;
  details?: unknown;
  existingRecord?: AttendanceRecord;

  constructor(code: string, message: string, details?: unknown, existingRecord?: AttendanceRecord) {
    super(message);
    this.name = 'AttendanceAPIError';
    this.code = code;
    this.details = details;
    this.existingRecord = existingRecord;
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Check if API is configured
 */
function isApiConfigured(): boolean {
  return !!GAS_ATTENDANCE_CONFIG.API_URL;
}

/**
 * Build URL with query parameters
 */
function buildUrl(action: string, params?: Record<string, string | number | boolean>): string {
  const url = new URL(GAS_ATTENDANCE_CONFIG.API_URL);
  url.searchParams.append('action', action);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }
  
  return url.toString();
}

/**
 * Make GET request to GAS API
 */
async function gasGet<T>(action: string, params?: Record<string, string | number | boolean>): Promise<GASAttendanceResponse<T>> {
  if (!isApiConfigured()) {
    throw new AttendanceAPIError(
      AttendanceErrorCodes.API_NOT_CONFIGURED,
      'Attendance API URL not configured. Please set VITE_GAS_EVENTS_API_URL in your environment.'
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GAS_ATTENDANCE_CONFIG.TIMEOUT);

  try {
    const response = await fetch(buildUrl(action, params), {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new AttendanceAPIError(
        AttendanceErrorCodes.SERVER_ERROR,
        `HTTP error! status: ${response.status}`
      );
    }

    const data = await response.json();
    return data as GASAttendanceResponse<T>;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof AttendanceAPIError) {
      throw error;
    }
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new AttendanceAPIError(
          AttendanceErrorCodes.TIMEOUT,
          'Request timed out. Please try again.'
        );
      }
      throw new AttendanceAPIError(
        AttendanceErrorCodes.NETWORK_ERROR,
        `Network error: ${error.message}`
      );
    }
    
    throw new AttendanceAPIError(
      AttendanceErrorCodes.NETWORK_ERROR,
      'An unexpected error occurred'
    );
  }
}

/**
 * Make POST request to GAS API
 */
async function gasPost<T>(action: string, data: Record<string, unknown>): Promise<GASAttendanceResponse<T> & T> {
  if (!isApiConfigured()) {
    throw new AttendanceAPIError(
      AttendanceErrorCodes.API_NOT_CONFIGURED,
      'Attendance API URL not configured. Please set VITE_GAS_EVENTS_API_URL in your environment.'
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GAS_ATTENDANCE_CONFIG.TIMEOUT);

  try {
    const response = await fetch(GAS_ATTENDANCE_CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain', // GAS requires text/plain for CORS
      },
      body: JSON.stringify({ action, ...data }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new AttendanceAPIError(
        AttendanceErrorCodes.SERVER_ERROR,
        `HTTP error! status: ${response.status}`
      );
    }

    const result = await response.json();
    return result as GASAttendanceResponse<T> & T;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof AttendanceAPIError) {
      throw error;
    }
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new AttendanceAPIError(
          AttendanceErrorCodes.TIMEOUT,
          'Request timed out. Please try again.'
        );
      }
      throw new AttendanceAPIError(
        AttendanceErrorCodes.NETWORK_ERROR,
        `Network error: ${error.message}`
      );
    }
    
    throw new AttendanceAPIError(
      AttendanceErrorCodes.NETWORK_ERROR,
      'An unexpected error occurred'
    );
  }
}

// =====================================================
// ATTENDANCE RECORDING FUNCTIONS
// =====================================================

/**
 * Record Time In for a member
 * @param params - Time In parameters
 * @returns TimeInResponse with success/error info
 */
export async function recordTimeIn(params: RecordTimeInParams): Promise<TimeInResponse> {
  const response = await gasPost<TimeInResponse>('recordTimeIn', {
    eventId: params.eventId,
    memberId: params.memberId,
    memberName: params.memberName || '',
    status: params.status || 'Present',
    location: params.location,
    recordedBy: params.recordedBy || '',
  });

  if (!response.success) {
    // Check if it's an existing record error
    if (response.error === 'EXISTING_RECORD') {
      throw new AttendanceAPIError(
        AttendanceErrorCodes.EXISTING_RECORD,
        response.message || 'Member already has a Time In record for this event today',
        undefined,
        response.existingRecord as AttendanceRecord
      );
    }
    throw new AttendanceAPIError(
      AttendanceErrorCodes.SERVER_ERROR,
      response.error || 'Failed to record Time In'
    );
  }

  return response;
}

/**
 * Record Time Out for a member
 * @param params - Time Out parameters
 * @returns TimeOutResponse with success/error info
 */
export async function recordTimeOut(params: RecordTimeOutParams): Promise<TimeOutResponse> {
  const response = await gasPost<TimeOutResponse>('recordTimeOut', {
    eventId: params.eventId,
    memberId: params.memberId,
    location: params.location,
    recordedBy: params.recordedBy || '',
  });

  if (!response.success) {
    // Check for specific errors
    if (response.error === 'NO_TIME_IN') {
      throw new AttendanceAPIError(
        AttendanceErrorCodes.NO_TIME_IN,
        response.message || 'No Time In record found for this member today. Please record Time In first.'
      );
    }
    if (response.error === 'ALREADY_TIMED_OUT') {
      throw new AttendanceAPIError(
        AttendanceErrorCodes.ALREADY_TIMED_OUT,
        response.message || 'Member has already timed out for this event today'
      );
    }
    throw new AttendanceAPIError(
      AttendanceErrorCodes.SERVER_ERROR,
      response.error || 'Failed to record Time Out'
    );
  }

  return response;
}

/**
 * Record manual attendance (for admin/officer use)
 * @param params - Manual attendance parameters
 * @returns ManualAttendanceResponse with success/error info
 */
export async function recordManualAttendance(params: RecordManualAttendanceParams): Promise<ManualAttendanceResponse> {
  const response = await gasPost<ManualAttendanceResponse>('recordManualAttendance', {
    eventId: params.eventId,
    memberId: params.memberId,
    memberName: params.memberName || '',
    status: params.status,
    timeType: params.timeType,
    notes: params.notes || '',
    recordedBy: params.recordedBy || '',
    overwrite: params.overwrite || false,
  });

  if (!response.success) {
    // Check if it's an existing record error
    if (response.error === 'EXISTING_RECORD') {
      throw new AttendanceAPIError(
        AttendanceErrorCodes.EXISTING_RECORD,
        response.message || 'Member already has an attendance record for this event today',
        undefined,
        response.existingRecord as AttendanceRecord
      );
    }
    throw new AttendanceAPIError(
      AttendanceErrorCodes.SERVER_ERROR,
      response.error || 'Failed to record attendance'
    );
  }

  return response;
}

// =====================================================
// ATTENDANCE LOOKUP FUNCTIONS
// =====================================================

/**
 * Check if a member already has attendance for an event today
 * @param eventId - Event ID
 * @param memberId - Member ID
 * @returns Existing attendance info if found
 */
export async function checkExistingAttendance(eventId: string, memberId: string): Promise<ExistingAttendanceResponse> {
  const response = await gasGet<ExistingAttendanceResponse>('checkExistingAttendance', {
    eventId,
    memberId,
  });

  if (!response.success) {
    throw new AttendanceAPIError(
      AttendanceErrorCodes.SERVER_ERROR,
      response.error || 'Failed to check existing attendance'
    );
  }

  return response as ExistingAttendanceResponse;
}

/**
 * Get all attendance records for an event
 * @param eventId - Event ID
 * @returns Array of attendance records
 */
export async function getEventAttendanceRecords(eventId: string): Promise<AttendanceRecord[]> {
  const response = await gasGet<{ records: AttendanceRecord[] }>('getEventAttendanceRecords', {
    eventId,
  });

  if (!response.success) {
    throw new AttendanceAPIError(
      AttendanceErrorCodes.SERVER_ERROR,
      response.error || 'Failed to fetch attendance records'
    );
  }

  return response.records || [];
}

/**
 * Get member attendance history
 * @param memberId - Member ID
 * @param limit - Maximum number of records (default 50)
 * @returns Array of attendance records
 */
export async function getMemberAttendanceHistory(memberId: string, limit: number = 50): Promise<AttendanceRecord[]> {
  const response = await gasGet<{ records: AttendanceRecord[] }>('getMemberAttendanceHistory', {
    memberId,
    limit,
  });

  if (!response.success) {
    throw new AttendanceAPIError(
      AttendanceErrorCodes.SERVER_ERROR,
      response.error || 'Failed to fetch attendance history'
    );
  }

  return response.records || [];
}

// =====================================================
// MEMBER LOOKUP FUNCTIONS
// =====================================================

/**
 * Get members for attendance dropdown
 * @param search - Optional search query
 * @param limit - Maximum number of results (default 50)
 * @returns Array of members
 */
export async function getMembersForAttendance(search?: string, limit: number = 50): Promise<MemberForAttendance[]> {
  // Check cache first if no search query
  if (!search && cachedMembers && (Date.now() - membersCacheTimestamp < GAS_ATTENDANCE_CONFIG.MEMBERS_CACHE_DURATION)) {
    return cachedMembers;
  }

  const response = await gasGet<{ members: MemberForAttendance[] }>('getMembersForAttendance', {
    search: search || '',
    limit,
  });

  if (!response.success) {
    throw new AttendanceAPIError(
      AttendanceErrorCodes.SERVER_ERROR,
      response.error || 'Failed to fetch members'
    );
  }

  const members = response.members || [];
  
  // Cache the result if no search query
  if (!search) {
    cachedMembers = members;
    membersCacheTimestamp = Date.now();
  }

  return members;
}

/**
 * Clear members cache
 */
export function clearMembersCache(): void {
  cachedMembers = null;
  membersCacheTimestamp = 0;
}

// =====================================================
// GEOFENCE VALIDATION
// =====================================================

/**
 * Validate if location is within event geofence
 * @param eventId - Event ID
 * @param lat - User latitude
 * @param lng - User longitude
 * @returns Geofence validation result
 */
export async function validateGeofence(eventId: string, lat: number, lng: number): Promise<GeofenceValidationResponse> {
  const response = await gasGet<GeofenceValidationResponse>('validateGeofence', {
    eventId,
    lat,
    lng,
  });

  if (!response.success) {
    throw new AttendanceAPIError(
      AttendanceErrorCodes.SERVER_ERROR,
      response.error || 'Failed to validate geofence'
    );
  }

  return {
    success: true,
    valid: (response as unknown as GeofenceValidationResponse).valid ?? true,
    message: (response as unknown as GeofenceValidationResponse).message || '',
    distance: (response as unknown as GeofenceValidationResponse).distance,
    radius: (response as unknown as GeofenceValidationResponse).radius,
  };
}

// =====================================================
// API HEALTH CHECK
// =====================================================

/**
 * Check if the Attendance API is healthy
 * @returns true if API is reachable and configured
 */
export async function checkAttendanceApiHealth(): Promise<boolean> {
  if (!isApiConfigured()) {
    return false;
  }

  try {
    // Try to fetch members as a health check
    const response = await gasGet('getMembersForAttendance', { limit: 1 });
    return response.success;
  } catch {
    return false;
  }
}

/**
 * Check if API is configured
 */
export function isAttendanceApiConfigured(): boolean {
  return isApiConfigured();
}
