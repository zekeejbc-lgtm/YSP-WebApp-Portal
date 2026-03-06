/**
 * =============================================================================
 * EMAIL SYSTEM SERVICE
 * =============================================================================
 * 
 * Frontend service for communicating with the EmailSystem GAS Backend.
 * Handles email templates, recipients, sending, and tracking.
 * 
 * API URL: Set via VITE_GAS_EMAIL_SYSTEM_API_URL environment variable
 * 
 * =============================================================================
 */

/// <reference types="vite/client" />

import { getSessionToken } from './gasLoginService';

// =====================================================
// TYPES
// =====================================================

export type EmailTemplateType = 
  | 'Event_Invites'
  | 'Appointments'
  | 'Payment_Reminders'
  | 'General_Notices'
  | 'Doc_Acknowledgment'
  | 'Volunteer_Call'
  | 'Feedback_Request'
  | 'Membership_Renewal'
  | 'Resource_Share'
  | 'Emergency_Alert';

export type EmailStatus = 
  | 'Draft'
  | 'Send'
  | 'Force'
  | 'Sent'
  | 'Error'
  | 'Duplicate';

export interface EmailRecipient {
  RowIndex?: number;
  RecipientName: string;
  Email: string;
  Headline: string;
  Message: string;
  Date?: string;
  Time?: string;
  Venue?: string;
  Amount?: string;
  OldPosition?: string;  // For Appointments template (position transitions)
  Link?: string;
  Attachments?: string;
  Status: string;
  Response?: string;
  TrackingEmail?: string;
  EmailId?: string;
}

export interface EmailTemplate {
  code: string;
  name: string;
  headers: string[];
  buttonText: string;
  declineButtonText?: string;  // For dual-button templates
  type: 'event' | 'payment' | 'simple' | 'urgent' | 'instruction' | 'appointment';
  description: string;
  hasOldPosition?: boolean;    // For Appointments template
  hasDeadline?: boolean;       // For templates with deadline field (not event/payment)
}

export interface EmailLog {
  EmailId: string;
  Name: string;
  Email: string;
  Headline: string;
  Template: string;
  Timestamp: string;
}

export interface EmailQuota {
  remaining: number;
  dailyLimit: number;
  percentageUsed: number;
}

export interface SendEmailData {
  templateType: EmailTemplateType;
  recipients: EmailRecipient[];
  sendMode: 'all' | 'selected' | 'single';
  selectedRowIndices?: number[];
}

export interface SendEmailResult {
  success: boolean;
  sent: number;
  failed: number;
  skipped: number;
  details: Array<{
    rowIndex: number;
    email: string;
    name: string;
    status: 'sent' | 'failed' | 'skipped' | 'duplicate';
    message: string;
    emailId?: string;
  }>;
  quota?: EmailQuota;
}

export interface GASEmailSystemResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  quota?: EmailQuota;
}

// =====================================================
// TEMPLATE DEFINITIONS (Matching Backend)
// =====================================================

export const EMAIL_TEMPLATES: Record<EmailTemplateType, EmailTemplate> = {
  'Event_Invites': {
    code: 'EI',
    name: 'Event Invites',
    headers: ['Recipient Name', 'Email', 'Event Name', 'Message', 'Date', 'Time', 'Venue', 'RSVP Link', 'Attachments'],
    buttonText: 'Confirm Attendance',
    type: 'event',
    description: 'Send event invitations with RSVP options'
  },
  'Appointments': {
    code: 'AP',
    name: 'Position Appointments',
    headers: ['Appointee Name', 'Email', 'New Position', 'Message', 'Old Position', 'Effective Date', 'Department/Committee', 'Reference Link', 'Attachments'],
    buttonText: 'Accept Designation',
    declineButtonText: 'Decline Appointment',
    type: 'appointment',
    description: 'Send position/designation appointment notifications',
    hasOldPosition: true
  },
  'Payment_Reminders': {
    code: 'PR',
    name: 'Payment Reminders',
    headers: ['Member Name', 'Email', 'Payment For', 'Message', 'Amount Due', 'Due Date', 'Payment Link', 'Attachments'],
    buttonText: 'I Have Paid',
    type: 'payment',
    description: 'Send payment reminders with amount and due dates'
  },
  'General_Notices': {
    code: 'GN',
    name: 'General Notices',
    headers: ['Recipient Name', 'Email', 'Subject', 'Message', 'Document Link', 'Attachments'],
    buttonText: 'View Document',
    type: 'simple',
    description: 'Send general announcements and notices'
  },
  'Doc_Acknowledgment': {
    code: 'DA',
    name: 'Document Acknowledgment',
    headers: ['Recipient Name', 'Email', 'Document Name', 'Message', 'Policy Link', 'Deadline', 'Attachments'],
    buttonText: 'I Acknowledge Receipt',
    type: 'simple',
    description: 'Send documents that require acknowledgment',
    hasDeadline: true
  },
  'Volunteer_Call': {
    code: 'VC',
    name: 'Volunteer Call',
    headers: ['Volunteer Name', 'Email', 'Project Name', 'Message', 'Date', 'Time', 'Role/Task', 'Sign-Up Link', 'Attachments'],
    buttonText: 'I\'m In!',
    type: 'event',
    description: 'Call for volunteers with event details'
  },
  'Feedback_Request': {
    code: 'FR',
    name: 'Feedback Request',
    headers: ['Recipient Name', 'Email', 'Event/Topic', 'Message', 'Survey Link', 'Attachments'],
    buttonText: 'Take Short Survey',
    type: 'simple',
    description: 'Request feedback with survey links'
  },
  'Membership_Renewal': {
    code: 'MR',
    name: 'Membership Renewal',
    headers: ['Member Name', 'Email', 'Membership Year', 'Message', 'Deadline', 'Renewal Form Link', 'Attachments'],
    buttonText: 'Renew My Membership',
    type: 'simple',
    description: 'Send membership renewal notices with form link',
    hasDeadline: true
  },
  'Resource_Share': {
    code: 'RS',
    name: 'Resource Share',
    headers: ['Recipient Name', 'Email', 'Resource Title', 'Message', 'Download Link', 'Attachments'],
    buttonText: 'Download Toolkit',
    type: 'simple',
    description: 'Share resources and toolkits'
  },
  'Emergency_Alert': {
    code: 'EA',
    name: 'Emergency Alert',
    headers: ['Recipient Name', 'Email', 'Alert Title', 'Urgent Message', 'Action Link', 'Time of Alert', 'Attachments'],
    buttonText: 'I Am Safe / Read This',
    type: 'urgent',
    description: 'Send urgent emergency notifications'
  }
};

/**
 * RSVP Button Configuration per Template
 * Defines button labels and pre-typed email text for each template type
 */
export const RSVP_CONFIG: Record<EmailTemplateType, {
  primaryButton: string;
  secondaryButton?: string;
  confirmSubjectPrefix: string;
  declineSubjectPrefix: string;
  hasDualButtons: boolean;
  secondaryIsExternal: boolean;
}> = {
  'Event_Invites': {
    primaryButton: 'Confirm Attendance',
    secondaryButton: 'Decline',
    confirmSubjectPrefix: 'RSVP CONFIRM',
    declineSubjectPrefix: 'RSVP DECLINE',
    hasDualButtons: true,
    secondaryIsExternal: false
  },
  'Appointments': {
    primaryButton: 'Accept Designation',
    secondaryButton: 'Decline Appointment',
    confirmSubjectPrefix: 'DESIGNATION ACCEPTED',
    declineSubjectPrefix: 'DESIGNATION DECLINED',
    hasDualButtons: true,
    secondaryIsExternal: false
  },
  'Volunteer_Call': {
    primaryButton: "I'm In!",
    secondaryButton: "Can't Make It",
    confirmSubjectPrefix: 'VOLUNTEER CONFIRMED',
    declineSubjectPrefix: 'VOLUNTEER UNAVAILABLE',
    hasDualButtons: true,
    secondaryIsExternal: false
  },
  'Payment_Reminders': {
    primaryButton: 'I Have Paid',
    secondaryButton: 'Pay Now',
    confirmSubjectPrefix: 'PAYMENT CONFIRMATION',
    declineSubjectPrefix: '',
    hasDualButtons: true,
    secondaryIsExternal: true
  },
  'Membership_Renewal': {
    primaryButton: 'Renew My Membership',
    secondaryButton: 'Contact Us',
    confirmSubjectPrefix: 'MEMBERSHIP INQUIRY',
    declineSubjectPrefix: '',
    hasDualButtons: true,
    secondaryIsExternal: false  // Secondary is mailto for inquiries
  },
  'Doc_Acknowledgment': {
    primaryButton: 'I Acknowledge',
    secondaryButton: 'View Document',
    confirmSubjectPrefix: 'DOCUMENT ACKNOWLEDGED',
    declineSubjectPrefix: '',
    hasDualButtons: true,
    secondaryIsExternal: true
  },
  'Emergency_Alert': {
    primaryButton: 'I Am Safe',
    secondaryButton: 'More Info',
    confirmSubjectPrefix: 'SAFETY CHECK-IN',
    declineSubjectPrefix: '',
    hasDualButtons: true,
    secondaryIsExternal: true
  },
  'General_Notices': {
    primaryButton: 'View Document',
    confirmSubjectPrefix: '',
    declineSubjectPrefix: '',
    hasDualButtons: false,
    secondaryIsExternal: true
  },
  'Feedback_Request': {
    primaryButton: 'Take Short Survey',
    confirmSubjectPrefix: '',
    declineSubjectPrefix: '',
    hasDualButtons: false,
    secondaryIsExternal: true
  },
  'Resource_Share': {
    primaryButton: 'Download Toolkit',
    confirmSubjectPrefix: '',
    declineSubjectPrefix: '',
    hasDualButtons: false,
    secondaryIsExternal: true
  }
};

// =====================================================
// CONFIGURATION
// =====================================================

const GAS_EMAIL_SYSTEM_CONFIG = {
  API_URL: import.meta.env.VITE_GAS_EMAIL_SYSTEM_API_URL || '',
  CACHE_DURATION: 2 * 60 * 1000, // 2 minutes cache (shorter for emails)
};

// =====================================================
// CACHE MANAGEMENT
// =====================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCachedData<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  
  const isExpired = Date.now() - entry.timestamp > GAS_EMAIL_SYSTEM_CONFIG.CACHE_DURATION;
  if (isExpired) {
    cache.delete(key);
    return null;
  }
  
  return entry.data;
}

function setCacheData<T>(key: string, data: T): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

export function clearEmailSystemCache(): void {
  const keysToDelete: string[] = [];
  cache.forEach((_, key) => {
    if (key.startsWith('email_')) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => cache.delete(key));
}

// =====================================================
// API HELPERS
// =====================================================

function validateApiUrl(): void {
  if (!GAS_EMAIL_SYSTEM_CONFIG.API_URL) {
    throw new Error('Email System API not configured. Please set VITE_GAS_EMAIL_SYSTEM_API_URL in your environment.');
  }
}

async function fetchFromGAS<T>(params: Record<string, string>): Promise<GASEmailSystemResponse<T>> {
  validateApiUrl();
  const url = new URL(GAS_EMAIL_SYSTEM_CONFIG.API_URL);
  const sessionToken = getSessionToken();
  if (sessionToken) {
    url.searchParams.append('sessionToken', sessionToken);
  }
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  const response = await fetch(url.toString(), {
    method: 'GET',
    mode: 'cors',
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

async function postToGAS<T>(data: Record<string, unknown>): Promise<GASEmailSystemResponse<T>> {
  validateApiUrl();
  const response = await fetch(GAS_EMAIL_SYSTEM_CONFIG.API_URL, {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'text/plain',
    },
    body: JSON.stringify({ ...data, sessionToken: getSessionToken() }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// =====================================================
// EMAIL OPERATIONS
// =====================================================

/**
 * Get all emails for a specific template type
 */
export async function getEmails(templateType: EmailTemplateType): Promise<EmailRecipient[]> {
  const cacheKey = `email_list_${templateType}`;
  const cached = getCachedData<EmailRecipient[]>(cacheKey);
  if (cached) return cached;

  const response = await fetchFromGAS<EmailRecipient[]>({ 
    action: 'getEmails',
    templateType 
  });
  
  if (response.success && response.data) {
    setCacheData(cacheKey, response.data);
    return response.data;
  }
  
  throw new Error(response.error || 'Failed to fetch emails');
}

/**
 * Get email logs from MASTER_LOG
 */
export async function getEmailLogs(params?: {
  templateType?: EmailTemplateType;
  search?: string;
  limit?: number;
}): Promise<EmailLog[]> {
  const cacheKey = `email_logs_${JSON.stringify(params || {})}`;
  const cached = getCachedData<EmailLog[]>(cacheKey);
  if (cached) return cached;

  const queryParams: Record<string, string> = { action: 'getEmailLogs' };
  if (params?.templateType) queryParams.templateType = params.templateType;
  if (params?.search) queryParams.search = params.search;
  if (params?.limit) queryParams.limit = String(params.limit);

  const response = await fetchFromGAS<EmailLog[]>(queryParams);
  
  if (response.success && response.data) {
    setCacheData(cacheKey, response.data);
    return response.data;
  }
  
  throw new Error(response.error || 'Failed to fetch email logs');
}

/**
 * Add a new email recipient row
 */
export async function addEmailRecipient(
  templateType: EmailTemplateType,
  recipient: Omit<EmailRecipient, 'RowIndex' | 'Status' | 'Response' | 'TrackingEmail' | 'EmailId'>
): Promise<{ rowIndex: number }> {
  const response = await postToGAS<{ rowIndex: number }>({
    action: 'addEmailRecipient',
    templateType,
    ...recipient,
  });
  
  if (response.success && response.data) {
    clearEmailSystemCache();
    return response.data;
  }
  
  throw new Error(response.error || 'Failed to add email recipient');
}

/**
 * Update an existing email recipient row
 */
export async function updateEmailRecipient(
  templateType: EmailTemplateType,
  rowIndex: number,
  updates: Partial<EmailRecipient>
): Promise<void> {
  const response = await postToGAS({
    action: 'updateEmailRecipient',
    templateType,
    rowIndex,
    ...updates,
  });
  
  if (response.success) {
    clearEmailSystemCache();
    return;
  }
  
  throw new Error(response.error || 'Failed to update email recipient');
}

/**
 * Delete an email recipient row
 */
export async function deleteEmailRecipient(
  templateType: EmailTemplateType,
  rowIndex: number
): Promise<void> {
  const response = await postToGAS({
    action: 'deleteEmailRecipient',
    templateType,
    rowIndex,
  });
  
  if (response.success) {
    clearEmailSystemCache();
    return;
  }
  
  throw new Error(response.error || 'Failed to delete email recipient');
}

/**
 * Send emails (single, selected, or all)
 */
export async function sendEmails(
  data: SendEmailData,
  onProgress?: (progress: { sent: number; failed: number; total: number }) => void
): Promise<SendEmailResult> {
  const response = await postToGAS<SendEmailResult>({
    action: 'sendEmails',
    ...data,
  });
  
  if (response.success && response.data) {
    clearEmailSystemCache();
    
    // Report progress if callback provided
    if (onProgress) {
      onProgress({
        sent: response.data.sent,
        failed: response.data.failed,
        total: response.data.sent + response.data.failed + response.data.skipped,
      });
    }
    
    return response.data;
  }
  
  throw new Error(response.error || 'Failed to send emails');
}

/**
 * Send a single email by row index
 */
export async function sendSingleEmail(
  templateType: EmailTemplateType,
  rowIndex: number,
  _force?: boolean
): Promise<SendEmailResult> {
  return sendEmails({
    templateType,
    recipients: [],
    sendMode: 'single',
    selectedRowIndices: [rowIndex],
  });
}

/**
 * Batch send all pending emails for a template
 */
export async function batchSendAll(
  templateType: EmailTemplateType,
  onProgress?: (progress: { sent: number; failed: number; total: number }) => void
): Promise<SendEmailResult> {
  const response = await postToGAS<SendEmailResult>({
    action: 'batchSendAll',
    templateType,
  });
  
  if (response.success && response.data) {
    clearEmailSystemCache();
    if (onProgress) {
      onProgress({
        sent: response.data.sent,
        failed: response.data.failed,
        total: response.data.sent + response.data.failed + response.data.skipped,
      });
    }
    return response.data;
  }
  
  throw new Error(response.error || 'Failed to batch send emails');
}

/**
 * Check email quota
 */
export async function checkEmailQuota(): Promise<EmailQuota> {
  const cacheKey = 'email_quota';
  const cached = getCachedData<EmailQuota>(cacheKey);
  if (cached) return cached;

  const response = await fetchFromGAS<EmailQuota>({ action: 'checkQuota' });
  
  if (response.success && response.data) {
    setCacheData(cacheKey, response.data);
    return response.data;
  }
  
  throw new Error(response.error || 'Failed to check email quota');
}

/**
 * Get directory members for recipient selection
 */
export async function getDirectoryMembers(forceRefresh = false): Promise<Array<{ name: string; email: string; committee?: string; profilePicture?: string }>> {
  const cacheKey = 'email_directory_members';
  if (!forceRefresh) {
    const cached = getCachedData<Array<{ name: string; email: string; committee?: string; profilePicture?: string }>>(cacheKey);
    if (cached) return cached;
  }

  const response = await fetchFromGAS<Array<{ name: string; email: string; committee?: string; profilePicture?: string }>>({ 
    action: 'getDirectoryMembers' 
  });
  
  if (response.success && response.data) {
    setCacheData(cacheKey, response.data);
    return response.data;
  }
  
  throw new Error(response.error || 'Failed to fetch directory members');
}

/**
 * Import recipients from directory/event
 */
export async function importRecipients(params: {
  source: 'directory' | 'event' | 'committee';
  eventId?: string;
  committee?: string;
}): Promise<Array<{ name: string; email: string; source: string }>> {
  const response = await fetchFromGAS<Array<{ name: string; email: string; source: string }>>({
    action: 'importRecipients',
    source: params.source,
    ...(params.eventId && { eventId: params.eventId }),
    ...(params.committee && { committee: params.committee }),
  });
  
  if (response.success && response.data) {
    return response.data;
  }
  
  throw new Error(response.error || 'Failed to import recipients');
}

// =====================================================
// FORMATTING HELPERS
// =====================================================

/**
 * Format date for display in emails
 */
export function formatEmailDate(date: Date | string): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return String(date);
  return d.toLocaleDateString('en-US', { 
    month: 'short', 
    day: '2-digit', 
    year: 'numeric' 
  });
}

/**
 * Format time for display in emails
 */
export function formatEmailTime(time: Date | string): string {
  if (!time) return '';
  if (typeof time === 'string') {
    // Handle 24-hour format strings like "14:00"
    const match24 = time.match(/^(\d{1,2}):(\d{2})$/);
    if (match24) {
      let hours = parseInt(match24[1]);
      const mins = match24[2];
      const period = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${hours}:${mins} ${period}`;
    }
    // Already in 12-hour format
    return time;
  }
  const d = time instanceof Date ? time : new Date(time);
  if (isNaN(d.getTime())) return String(time);
  return d.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
}

/**
 * Get status color for email status
 */
export function getEmailStatusColor(status: string): { bg: string; text: string; border: string } {
  const statusLower = status.toLowerCase().trim();
  
  if (statusLower.startsWith('sent')) {
    return { bg: '#d9ead3', text: '#155724', border: '#c3e6cb' };
  }
  if (statusLower.startsWith('error')) {
    return { bg: '#f4cccc', text: '#721c24', border: '#f5c6cb' };
  }
  if (statusLower.includes('duplicate')) {
    return { bg: '#fff3cd', text: '#856404', border: '#ffeeba' };
  }
  if (statusLower === 'send' || statusLower === 'force') {
    return { bg: '#cce5ff', text: '#004085', border: '#b8daff' };
  }
  // Default (draft/empty)
  return { bg: '#f8f9fa', text: '#6c757d', border: '#dee2e6' };
}

/**
 * Get template icon name for Lucide React icons
 * Returns icon component name to be rendered in the UI
 */
export type TemplateIconName = 
  | 'calendar'
  | 'clipboard-list'
  | 'credit-card'
  | 'megaphone'
  | 'file-text'
  | 'hand-helping'
  | 'message-square'
  | 'refresh-cw'
  | 'package'
  | 'alert-triangle'
  | 'mail';

export function getTemplateIconName(templateType: EmailTemplateType): TemplateIconName {
  const icons: Record<EmailTemplateType, TemplateIconName> = {
    'Event_Invites': 'calendar',
    'Appointments': 'clipboard-list',
    'Payment_Reminders': 'credit-card',
    'General_Notices': 'megaphone',
    'Doc_Acknowledgment': 'file-text',
    'Volunteer_Call': 'hand-helping',
    'Feedback_Request': 'message-square',
    'Membership_Renewal': 'refresh-cw',
    'Resource_Share': 'package',
    'Emergency_Alert': 'alert-triangle'
  };
  return icons[templateType] || 'mail';
}
