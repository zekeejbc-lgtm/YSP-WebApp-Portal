/**
 * Google Apps Script Events Service
 * Handles all event management operations with GAS Spreadsheet Backend
 * 
 * Spreadsheet Structure:
 * - Events: Main events data with geofencing
 * - EventAttendance: Attendance records per event
 * - EventSettings: Configuration settings
 */

/// <reference types="vite/client" />

// =====================================================
// TYPES
// =====================================================

export interface EventData {
  EventID: string;
  Title: string;
  Description: string;
  StartDate: string;
  EndDate: string;
  StartTime: string;
  EndTime: string;
  LocationName: string;
  Latitude: number | string;
  Longitude: number | string;
  Radius: number | string;
  GeofenceEnabled: boolean | string;
  CurrentAttendees: number;
  Status: 'Scheduled' | 'Active' | 'Inactive' | 'Completed' | 'Cancelled' | 'Draft';
  CreatedBy: string;
  CreatedAt: string;
  UpdatedAt: string;
  Notes: string;
  // New fields for recipient targeting and time windows
  Recipients?: string; // JSON string: { type: 'All' | 'Committee' | 'Person', ids: string[], names: string[], committees?: string[] }
  TimeInStart?: string;
  TimeInEnd?: string;
  TimeOutStart?: string;
  TimeOutEnd?: string;
}

export interface EventRecipients {
  type: 'All' | 'Committee' | 'Person';
  ids: string[];
  names: string[];
  committees?: string[];
}

export interface EventAttendanceRecord {
  AttendanceID: string;
  EventID: string;
  MemberID: string;
  MemberName: string;
  Status: 'Registered' | 'Present' | 'Absent' | 'CheckedIn' | 'CheckedOut' | 'Late';
  CheckInTime: string;
  CheckOutTime: string;
  Notes: string;
  RecordedBy: string;
  RecordedAt: string;
}

export interface EventStats {
  totalEvents: number;
  upcomingEvents: number;
  pastEvents: number;
  cancelledEvents: number;
  totalAttendees: number;
}

export interface CreateEventData {
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
  geofenceEnabled?: boolean;
  status?: string;
  createdBy?: string;
  notes?: string;
  // New fields for recipient targeting and time windows
  recipients?: string; // JSON string of EventRecipients
  timeInStart?: string;
  timeInEnd?: string;
  timeOutStart?: string;
  timeOutEnd?: string;
}

export interface MemberEventsResponse {
  success: boolean;
  scheduled: EventData[];
  active: EventData[];
  completed: EventData[];
  total: number;
  error?: string;
}

export interface GASEventsResponse<T = unknown> {
  success: boolean;
  data?: T;
  events?: EventData[];
  event?: EventData;
  attendance?: EventAttendanceRecord[];
  stats?: EventStats;
  total?: number;
  eventId?: string;
  attendanceId?: string;
  message?: string;
  error?: string;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
}

// =====================================================
// CONFIGURATION
// =====================================================

const GAS_EVENTS_CONFIG = {
  // Replace with your deployed GAS Web App URL for Events
  // Deploy as: Execute as "Me", Who has access: "Anyone"
  API_URL: import.meta.env.VITE_GAS_EVENTS_API_URL || '',
  
  // Timeout for API calls (in milliseconds)
  TIMEOUT: 15000,
  
  // Cache duration (in milliseconds) - 2 minutes for in-memory cache
  CACHE_DURATION: 2 * 60 * 1000,
};

// In-memory cache for events
let cachedEvents: EventData[] | null = null;
let eventsCacheTimestamp: number = 0;

// LocalStorage cache keys
const EVENTS_CACHE_KEY = 'ysp_events_cache_v1';
const EVENTS_CACHE_TS_KEY = 'ysp_events_cache_ts_v1';

// =====================================================
// LOCALSTORAGE CACHE FUNCTIONS
// =====================================================

/**
 * Load events from localStorage cache
 * Returns null if cache doesn't exist or is invalid
 */
export function loadEventsFromLocalStorage(): EventData[] | null {
  try {
    const raw = localStorage.getItem(EVENTS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as EventData[];
  } catch {
    return null;
  }
}

/**
 * Save events to localStorage cache
 */
export function saveEventsToLocalStorage(events: EventData[]): void {
  try {
    localStorage.setItem(EVENTS_CACHE_KEY, JSON.stringify(events));
    localStorage.setItem(EVENTS_CACHE_TS_KEY, String(Date.now()));
    console.log(`📦 Cached ${events.length} events to localStorage`);
  } catch (error) {
    console.warn('Failed to cache events to localStorage:', error);
  }
}

/**
 * Clear events localStorage cache
 */
export function clearEventsLocalStorage(): void {
  try {
    localStorage.removeItem(EVENTS_CACHE_KEY);
    localStorage.removeItem(EVENTS_CACHE_TS_KEY);
  } catch {
    // Ignore errors
  }
}

/**
 * Check if a member is a target recipient for an event using CACHED data
 * This is faster than network calls and works offline
 * Returns null if event not found in cache (caller should fall back to network)
 */
export function checkIsTargetRecipientLocal(
  eventId: string,
  memberId: string
): { isTarget: boolean; recipientType: string } | null {
  // Try in-memory cache first
  let events = cachedEvents;
  
  // Fall back to localStorage cache
  if (!events || events.length === 0) {
    events = loadEventsFromLocalStorage();
  }
  
  if (!events || events.length === 0) {
    return null; // No cache - need network call
  }
  
  // Find the event
  const event = events.find(e => e.EventID === eventId);
  if (!event) {
    return null; // Event not in cache
  }
  
  // Parse recipients
  const recipients = parseEventRecipients(event.Recipients);
  
  // If no recipients defined, everyone is a target (type: All)
  if (!recipients) {
    return { isTarget: true, recipientType: 'All' };
  }
  
  // If type is 'All', everyone is a target
  if (recipients.type === 'All') {
    return { isTarget: true, recipientType: 'All' };
  }
  
  // Check if member ID is in the recipients list
  if (recipients.ids && recipients.ids.includes(memberId)) {
    return { isTarget: true, recipientType: recipients.type };
  }
  
  // Not in recipients list = external attendee
  return { isTarget: false, recipientType: recipients.type };
}

// =====================================================
// ERROR HANDLING
// =====================================================

export const EventsErrorCodes = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  API_NOT_CONFIGURED: 'API_NOT_CONFIGURED',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  EVENT_NOT_FOUND: 'EVENT_NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
} as const;

export class EventsAPIError extends Error {
  code: string;
  details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'EventsAPIError';
    this.code = code;
    this.details = details;
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Check if API is configured
 */
function isApiConfigured(): boolean {
  return !!GAS_EVENTS_CONFIG.API_URL;
}

/**
 * Build URL with query parameters
 */
function buildUrl(action: string, params?: Record<string, string | number | boolean>): string {
  const url = new URL(GAS_EVENTS_CONFIG.API_URL);
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
async function gasGet<T>(
  action: string,
  params?: Record<string, string | number | boolean>,
  signal?: AbortSignal
): Promise<GASEventsResponse<T>> {
  if (!isApiConfigured()) {
    throw new EventsAPIError(
      EventsErrorCodes.API_NOT_CONFIGURED,
      'Events API URL not configured. Please set VITE_GAS_EVENTS_API_URL in your environment.'
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GAS_EVENTS_CONFIG.TIMEOUT);
  const onExternalAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  try {
    const response = await fetch(buildUrl(action, params), {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (signal) {
      signal.removeEventListener('abort', onExternalAbort);
    }

    if (!response.ok) {
      throw new EventsAPIError(
        EventsErrorCodes.SERVER_ERROR,
        `HTTP error! status: ${response.status}`
      );
    }

    const data = await response.json();
    return data as GASEventsResponse<T>;
  } catch (error) {
    clearTimeout(timeoutId);
    if (signal) {
      signal.removeEventListener('abort', onExternalAbort);
    }
    
    if (error instanceof EventsAPIError) {
      throw error;
    }
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new EventsAPIError(EventsErrorCodes.TIMEOUT, 'Request timed out');
      }
      throw new EventsAPIError(EventsErrorCodes.NETWORK_ERROR, error.message);
    }
    
    throw new EventsAPIError(EventsErrorCodes.NETWORK_ERROR, 'Unknown error occurred');
  }
}

/**
 * Make POST request to GAS API
 */
async function gasPost<T>(
  payload: Record<string, unknown>,
  signal?: AbortSignal
): Promise<GASEventsResponse<T>> {
  if (!isApiConfigured()) {
    throw new EventsAPIError(
      EventsErrorCodes.API_NOT_CONFIGURED,
      'Events API URL not configured. Please set VITE_GAS_EVENTS_API_URL in your environment.'
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GAS_EVENTS_CONFIG.TIMEOUT);
  const onExternalAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  try {
    const response = await fetch(GAS_EVENTS_CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain', // GAS requires text/plain for CORS
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (signal) {
      signal.removeEventListener('abort', onExternalAbort);
    }

    if (!response.ok) {
      throw new EventsAPIError(
        EventsErrorCodes.SERVER_ERROR,
        `HTTP error! status: ${response.status}`
      );
    }

    const data = await response.json();
    return data as GASEventsResponse<T>;
  } catch (error) {
    clearTimeout(timeoutId);
    if (signal) {
      signal.removeEventListener('abort', onExternalAbort);
    }
    
    if (error instanceof EventsAPIError) {
      throw error;
    }
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new EventsAPIError(EventsErrorCodes.TIMEOUT, 'Request timed out');
      }
      throw new EventsAPIError(EventsErrorCodes.NETWORK_ERROR, error.message);
    }
    
    throw new EventsAPIError(EventsErrorCodes.NETWORK_ERROR, 'Unknown error occurred');
  }
}

// =====================================================
// EVENTS API FUNCTIONS
// =====================================================

/**
 * Fetch all events with optional filtering
 * Uses localStorage cache with background refresh for faster loading
 */
export async function fetchEvents(
  params?: {
  status?: string;
  eventType?: string;
  startDate?: string;
  endDate?: string;
},
  signal?: AbortSignal
): Promise<EventData[]> {
  // Check in-memory cache first
  const now = Date.now();
  if (cachedEvents && (now - eventsCacheTimestamp) < GAS_EVENTS_CONFIG.CACHE_DURATION) {
    let events = [...cachedEvents];
    
    // Apply filters to cached data
    if (params) {
      if (params.status) events = events.filter(e => e.Status === params.status);
    }
    
    return events;
  }

  const response = await gasGet<EventData[]>('getEvents', params as Record<string, string>, signal);
  
  if (!response.success) {
    throw new EventsAPIError(EventsErrorCodes.SERVER_ERROR, response.error || 'Failed to fetch events');
  }

  cachedEvents = response.events || [];
  eventsCacheTimestamp = now;
  
  // Also save to localStorage for offline/fast access
  saveEventsToLocalStorage(cachedEvents);
  
  return cachedEvents;
}

/**
 * Fetch all events (safe version - returns empty array on error)
 */
export async function fetchEventsSafe(
  params?: {
  status?: string;
  eventType?: string;
},
  signal?: AbortSignal
): Promise<EventData[]> {
  try {
    return await fetchEvents(params, signal);
  } catch (error) {
    console.error('Failed to fetch events:', error);
    return [];
  }
}

/**
 * Fetch a single event by ID
 */
export async function fetchEventById(
  eventId: string,
  signal?: AbortSignal
): Promise<EventData | null> {
  const response = await gasGet<EventData>('getEvent', { eventId }, signal);
  
  if (!response.success) {
    if (response.error?.includes('not found')) {
      return null;
    }
    throw new EventsAPIError(EventsErrorCodes.SERVER_ERROR, response.error || 'Failed to fetch event');
  }

  return response.event || null;
}

/**
 * Fetch upcoming events
 */
export async function fetchUpcomingEvents(
  limit: number = 10,
  signal?: AbortSignal
): Promise<EventData[]> {
  const response = await gasGet<EventData[]>('getUpcomingEvents', { limit }, signal);
  
  if (!response.success) {
    throw new EventsAPIError(EventsErrorCodes.SERVER_ERROR, response.error || 'Failed to fetch upcoming events');
  }

  return response.events || [];
}

/**
 * Fetch past events
 */
export async function fetchPastEvents(
  limit: number = 10,
  signal?: AbortSignal
): Promise<EventData[]> {
  const response = await gasGet<EventData[]>('getPastEvents', { limit }, signal);
  
  if (!response.success) {
    throw new EventsAPIError(EventsErrorCodes.SERVER_ERROR, response.error || 'Failed to fetch past events');
  }

  return response.events || [];
}

/**
 * Create a new event
 */
export async function createEvent(
  eventData: CreateEventData,
  signal?: AbortSignal
): Promise<{ eventId: string; event: EventData }> {
  const response = await gasPost<{ eventId: string; event: EventData }>({
    action: 'createEvent',
    eventData: {
      title: eventData.title,
      description: eventData.description || '',
      startDate: eventData.startDate,
      endDate: eventData.endDate || eventData.startDate,
      startTime: eventData.startTime || '',
      endTime: eventData.endTime || '',
      locationName: eventData.locationName || '',
      latitude: eventData.latitude || '',
      longitude: eventData.longitude || '',
      radius: eventData.radius || 100,
      geofenceEnabled: eventData.geofenceEnabled !== false,
      status: eventData.status || 'Scheduled',
      createdBy: eventData.createdBy || '',
      notes: eventData.notes || '',
      // New fields for recipient targeting and time windows
      recipients: eventData.recipients || '',
      timeInStart: eventData.timeInStart || '',
      timeInEnd: eventData.timeInEnd || '',
      timeOutStart: eventData.timeOutStart || '',
      timeOutEnd: eventData.timeOutEnd || '',
    },
  }, signal);

  if (!response.success) {
    throw new EventsAPIError(EventsErrorCodes.SERVER_ERROR, response.error || 'Failed to create event');
  }

  // Invalidate cache
  clearEventsCache();

  return {
    eventId: response.eventId || '',
    event: response.event as EventData,
  };
}

/**
 * Update an existing event
 */
export async function updateEvent(
  eventId: string,
  eventData: Partial<CreateEventData>,
  signal?: AbortSignal
): Promise<void> {
  const response = await gasPost({
    action: 'updateEvent',
    eventId,
    eventData: {
      title: eventData.title,
      description: eventData.description,
      startDate: eventData.startDate,
      endDate: eventData.endDate,
      startTime: eventData.startTime,
      endTime: eventData.endTime,
      locationName: eventData.locationName,
      latitude: eventData.latitude,
      longitude: eventData.longitude,
      radius: eventData.radius,
      geofenceEnabled: eventData.geofenceEnabled,
      status: eventData.status,
      notes: eventData.notes,
      // New fields for recipient targeting and time windows
      recipients: eventData.recipients,
      timeInStart: eventData.timeInStart,
      timeInEnd: eventData.timeInEnd,
      timeOutStart: eventData.timeOutStart,
      timeOutEnd: eventData.timeOutEnd,
    },
  }, signal);

  if (!response.success) {
    throw new EventsAPIError(EventsErrorCodes.SERVER_ERROR, response.error || 'Failed to update event');
  }

  // Invalidate cache
  clearEventsCache();
}

/**
 * Delete an event
 */
export async function deleteEvent(
  eventId: string,
  signal?: AbortSignal
): Promise<void> {
  const response = await gasPost({
    action: 'deleteEvent',
    eventId,
  }, signal);

  if (!response.success) {
    throw new EventsAPIError(EventsErrorCodes.SERVER_ERROR, response.error || 'Failed to delete event');
  }

  // Invalidate cache
  clearEventsCache();
}

/**
 * Cancel an event
 */
export async function cancelEvent(
  eventId: string,
  reason?: string,
  signal?: AbortSignal
): Promise<void> {
  const response = await gasPost({
    action: 'cancelEvent',
    eventId,
    reason: reason || '',
  }, signal);

  if (!response.success) {
    throw new EventsAPIError(EventsErrorCodes.SERVER_ERROR, response.error || 'Failed to cancel event');
  }

  // Invalidate cache
  clearEventsCache();
}

/**
 * Duplicate an event
 */
export async function duplicateEvent(
  eventId: string,
  signal?: AbortSignal
): Promise<{ eventId: string }> {
  const response = await gasPost<{ eventId: string }>({
    action: 'duplicateEvent',
    eventId,
  }, signal);

  if (!response.success) {
    throw new EventsAPIError(EventsErrorCodes.SERVER_ERROR, response.error || 'Failed to duplicate event');
  }

  // Invalidate cache
  clearEventsCache();

  return { eventId: response.eventId || '' };
}

/**
 * Add a single recipient to an event
 * Appends to the existing recipients list without overwriting
 */
export async function addEventRecipient(
  eventId: string,
  recipientId: string,
  recipientName: string,
  signal?: AbortSignal
): Promise<{ message: string; totalRecipients?: number; alreadyExists?: boolean }> {
  const response = await gasPost<{ message: string; totalRecipients?: number; alreadyExists?: boolean }>({
    action: 'addEventRecipient',
    eventId,
    recipientId,
    recipientName,
  }, signal);

  if (!response.success) {
    throw new EventsAPIError(EventsErrorCodes.SERVER_ERROR, response.error || 'Failed to add recipient');
  }

  // Invalidate cache
  clearEventsCache();

  return { 
    message: response.message || 'Recipient added',
    totalRecipients: response.totalRecipients,
    alreadyExists: response.alreadyExists
  };
}

/**
 * Add multiple recipients to an event at once
 */
export async function addEventRecipients(
  eventId: string,
  recipients: Array<{ id: string; name: string }>,
  signal?: AbortSignal
): Promise<{ message: string; addedCount: number; skippedCount: number; totalRecipients?: number }> {
  const response = await gasPost<{ message: string; addedCount: number; skippedCount: number; totalRecipients?: number }>({
    action: 'addEventRecipients',
    eventId,
    recipients,
  }, signal);

  if (!response.success) {
    throw new EventsAPIError(EventsErrorCodes.SERVER_ERROR, response.error || 'Failed to add recipients');
  }

  // Invalidate cache
  clearEventsCache();

  return { 
    message: response.message || 'Recipients added',
    addedCount: response.addedCount || 0,
    skippedCount: response.skippedCount || 0,
    totalRecipients: response.totalRecipients
  };
}

// =====================================================
// ATTENDANCE API FUNCTIONS
// =====================================================

/**
 * Fetch attendance for an event
 */
export async function fetchEventAttendance(
  eventId: string,
  signal?: AbortSignal
): Promise<EventAttendanceRecord[]> {
  const response = await gasGet<EventAttendanceRecord[]>('getEventAttendance', { eventId }, signal);
  
  if (!response.success) {
    throw new EventsAPIError(EventsErrorCodes.SERVER_ERROR, response.error || 'Failed to fetch attendance');
  }

  return response.attendance || [];
}

/**
 * Record attendance for an event
 */
export async function recordEventAttendance(
  eventId: string,
  memberId: string,
  status: string,
  signal?: AbortSignal
): Promise<{ attendanceId: string }> {
  const response = await gasPost<{ attendanceId: string }>({
    action: 'recordAttendance',
    eventId,
    memberId,
    status,
  }, signal);

  if (!response.success) {
    throw new EventsAPIError(EventsErrorCodes.SERVER_ERROR, response.error || 'Failed to record attendance');
  }

  return { attendanceId: response.attendanceId || '' };
}

/**
 * Bulk record attendance
 */
export async function bulkRecordEventAttendance(
  eventId: string,
  attendanceRecords: Array<{ memberId: string; status: string }>,
  signal?: AbortSignal
): Promise<void> {
  const response = await gasPost({
    action: 'bulkRecordAttendance',
    eventId,
    attendanceRecords,
  }, signal);

  if (!response.success) {
    throw new EventsAPIError(EventsErrorCodes.SERVER_ERROR, response.error || 'Failed to record attendance');
  }
}

// =====================================================
// STATISTICS & UTILITIES
// =====================================================

/**
 * Fetch event statistics
 */
export async function fetchEventStats(): Promise<EventStats> {
  const response = await gasGet<EventStats>('getEventStats');
  
  if (!response.success) {
    throw new EventsAPIError(EventsErrorCodes.SERVER_ERROR, response.error || 'Failed to fetch stats');
  }

  return response.stats || {
    totalEvents: 0,
    upcomingEvents: 0,
    pastEvents: 0,
    cancelledEvents: 0,
    totalAttendees: 0,
  };
}

/**
 * Initialize sheets (admin function)
 */
export async function initializeEventSheets(): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const response = await gasGet<{ spreadsheetId: string; spreadsheetUrl: string }>('initializeSheets');
  
  if (!response.success) {
    throw new EventsAPIError(EventsErrorCodes.SERVER_ERROR, response.error || 'Failed to initialize sheets');
  }

  return {
    spreadsheetId: response.spreadsheetId || '',
    spreadsheetUrl: response.spreadsheetUrl || '',
  };
}

/**
 * Check API health
 */
export async function checkEventsApiHealth(): Promise<boolean> {
  if (!isApiConfigured()) {
    return false;
  }

  try {
    const response = await gasGet('getEventStats');
    return response.success === true;
  } catch {
    return false;
  }
}

/**
 * Clear events cache (both in-memory and localStorage)
 */
export function clearEventsCache(): void {
  cachedEvents = null;
  eventsCacheTimestamp = 0;
  // Note: localStorage is intentionally NOT cleared here for offline support
  // Use clearEventsLocalStorage() explicitly if needed
}

/**
 * Clear all cache (both in-memory and localStorage)
 */
export function clearAllEventsCache(): void {
  cachedEvents = null;
  eventsCacheTimestamp = 0;
  clearEventsLocalStorage();
}

// =====================================================
// HELPER: Get geofence data from event
// =====================================================

export function getEventGeofence(event: EventData): {
  lat: number;
  lng: number;
  radius: number;
  name: string;
} | null {
  const lat = typeof event.Latitude === 'string' ? parseFloat(event.Latitude) : event.Latitude;
  const lng = typeof event.Longitude === 'string' ? parseFloat(event.Longitude) : event.Longitude;
  const radius = typeof event.Radius === 'string' ? parseFloat(event.Radius) : event.Radius;
  
  if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
    return null;
  }
  
  return {
    lat: lat,
    lng: lng,
    radius: radius || 100,
    name: event.LocationName || '',
  };
}

/**
 * Format event date for display
 */
export function formatEventDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format event time for display
 */
export function formatEventTime(timeStr: string): string {
  if (!timeStr) return '';
  return timeStr;
}

/**
 * Check if event is upcoming
 */
export function isEventUpcoming(event: EventData): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDate = new Date(event.StartDate);
  return eventDate >= today && event.Status !== 'Cancelled';
}

/**
 * Check if event is past
 */
export function isEventPast(event: EventData): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDate = new Date(event.StartDate);
  return eventDate < today;
}
// =====================================================
// NEW: MEMBER-SPECIFIC EVENT FUNCTIONS
// =====================================================

/**
 * Fetch events that a specific member is a target recipient for
 * Used by Attendance Transparency page to show scheduled events
 */
export async function fetchEventsForMember(
  memberId: string,
  includeArchived: boolean = false,
  signal?: AbortSignal
): Promise<MemberEventsResponse> {
  const response = await gasGet<MemberEventsResponse>('getEventsForMember', { 
    memberId, 
    includeArchived: includeArchived ? 'true' : 'false' 
  }, signal);
  
  if (!response.success) {
    throw new EventsAPIError(EventsErrorCodes.SERVER_ERROR, response.error || 'Failed to fetch events for member');
  }

  return {
    success: true,
    scheduled: (response as unknown as MemberEventsResponse).scheduled || [],
    active: (response as unknown as MemberEventsResponse).active || [],
    completed: (response as unknown as MemberEventsResponse).completed || [],
    total: (response as unknown as MemberEventsResponse).total || 0
  };
}

/**
 * Check if a member is a target recipient for an event
 * Uses local cache first for speed, falls back to network if needed
 * Returns { isTarget, isRecipient (alias), recipientType }
 */
export async function checkIsTargetRecipient(
  eventId: string,
  memberId: string,
  signal?: AbortSignal
): Promise<{ isTarget: boolean; isRecipient: boolean; recipientType: string }> {
  // Try local cache first (fast, works offline)
  const localResult = checkIsTargetRecipientLocal(eventId, memberId);
  if (localResult !== null) {
    console.log(`📦 Recipient check from cache: ${memberId} -> ${localResult.isTarget ? 'Target' : 'External'}`);
    return {
      isTarget: localResult.isTarget,
      isRecipient: localResult.isTarget, // Alias for backward compatibility
      recipientType: localResult.recipientType
    };
  }
  
  // Fall back to network call
  console.log(`🌐 Recipient check from network: ${eventId}, ${memberId}`);
  const response = await gasGet<{ isRecipient: boolean; recipientType: string }>('checkIsTargetRecipient', { 
    eventId, 
    memberId 
  }, signal);
  
  if (!response.success) {
    // Default to allowing attendance if check fails
    return { isTarget: true, isRecipient: true, recipientType: 'Unknown' };
  }

  const isRecipient = (response as unknown as { isRecipient: boolean }).isRecipient ?? true;
  return {
    isTarget: isRecipient,
    isRecipient: isRecipient,
    recipientType: (response as unknown as { recipientType: string }).recipientType || 'Unknown'
  };
}

/**
 * Get event time windows for late detection
 */
export async function getEventTimeWindows(
  eventId: string,
  signal?: AbortSignal
): Promise<{
  timeInStart?: string;
  timeInEnd?: string;
  timeOutStart?: string;
  timeOutEnd?: string;
}> {
  const response = await gasGet<{ timeWindows: { timeInStart?: string; timeInEnd?: string; timeOutStart?: string; timeOutEnd?: string } }>('getEventTimeWindows', { eventId }, signal);
  
  if (!response.success) {
    return {};
  }

  return (response as unknown as { timeWindows: { timeInStart?: string; timeInEnd?: string; timeOutStart?: string; timeOutEnd?: string } }).timeWindows || {};
}

/**
 * Migrate events schema to add new columns
 * Safe to run multiple times
 */
export async function migrateEventsSchema(signal?: AbortSignal): Promise<{ success: boolean; message: string }> {
  const response = await gasGet<{ message: string }>('migrateEventsSchema', undefined, signal);
  
  return {
    success: response.success,
    message: response.message || (response.success ? 'Schema migrated successfully' : 'Migration failed')
  };
}

/**
 * Parse recipients JSON string to EventRecipients object
 */
export function parseEventRecipients(recipientsJson: string | undefined): EventRecipients | null {
  if (!recipientsJson) return null;
  try {
    return JSON.parse(recipientsJson) as EventRecipients;
  } catch {
    return null;
  }
}

/**
 * Stringify EventRecipients object to JSON
 */
export function stringifyEventRecipients(recipients: EventRecipients): string {
  return JSON.stringify(recipients);
}