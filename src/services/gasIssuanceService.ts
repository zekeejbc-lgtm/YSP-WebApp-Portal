/**
 * =============================================================================
 * ISSUANCE CENTER SERVICE
 * =============================================================================
 * 
 * Frontend service for communicating with the Issuance GAS Backend.
 * Handles issuances, templates, recipients, and PDF generation.
 * 
 * API URL: https://script.google.com/macros/s/AKfycbwir6gVrY9U9n8KgThRx7_5CXxHvDPyF_4EDho_ZsSE2oUtfolYkK6M8A8mdatssWkPMw/exec
 * 
 * =============================================================================
 */

/// <reference types="vite/client" />

// =====================================================
// TYPES
// =====================================================

export interface Issuance {
  IssuanceID: string;
  Title: string;
  TemplateID: string;
  TemplateName: string;
  Status: 'Draft' | 'Sent' | 'Downloaded' | 'Archived';
  DeliveryMethod?: 'DownloadOnly' | 'Email'; // How the issuance was created
  CreatedBy: string;
  CreatedAt: string;
  SentAt: string;
  SentBy: string;
  RecipientType: 'Event' | 'Person' | 'Committee' | 'Directory' | 'External';
  RecipientDetails: string; // JSON string
  TotalRecipients: number;
  SentCount: number;
  ResentCount: number;  // Separate count for resent emails
  FailedCount: number;
  FieldInputs: string; // JSON string
  EmailTitle: string;
  EmailMessage: string;
  CustomTemplateUrl: string;
  Notes: string;
  Recipients?: Recipient[];
  // Name formatting columns
  NameAllCaps?: string; // 'true' or 'false' - whether names should be ALL CAPS
  NameStartPos?: string; // Start position for name line (default: '8.1')
  NameEndPos?: string; // End position for name line (default: '27.6')
  NamePosUnit?: string; // Unit for positions: 'cm' or 'inch' (default: 'cm')
  // Attachments - JSON string of array [{name, url, type}]
  Attachments?: string;
}

// Attachment type for issuance attachments
export interface IssuanceAttachment {
  name: string;  // Display name for the attachment
  url: string;   // URL to the attachment (Google Drive, YouTube, Facebook, etc.)
  type: 'pdf' | 'document' | 'spreadsheet' | 'video' | 'image' | 'link' | 'other'; // Type of attachment
}

export interface IssuanceTemplate {
  TemplateID: string;
  Name: string;
  Description: string;
  Type: 'Digital Certificate' | 'Meeting Notice' | 'Notice' | 'Letter' | 'Memo' | 'Custom';
  DocsUrl: string;
  Fields: string; // JSON string of field placeholders
  FieldsParsed: string[];
  IsDefault: boolean;
  CreatedBy: string;
  CreatedAt: string;
  UpdatedAt: string;
  Status: 'Active' | 'Archived';
}

export interface Recipient {
  RecordID: string;
  IssuanceID: string;
  RecipientName: string;
  RecipientEmail: string;
  RecipientType: 'Member' | 'External';
  Status: 'Pending' | 'Sent' | 'Failed' | 'Downloaded';
  SentAt: string;
  FailedReason: string;
  PDFFileId: string;
  DownloadedAt: string;
  ControlNumber?: string; // Unique control number: YSP-YY-TCXXYYY
}

export interface SendLog {
  LogID: string;
  IssuanceID: string;
  RecipientEmail: string;
  RecipientName: string;
  Action: 'EmailSent' | 'EmailFailed' | 'Downloaded';
  Timestamp: string;
  Details: string;
  PerformedBy: string;
}

export interface IssuanceSettings {
  [key: string]: {
    value: string;
    description: string;
    updatedAt: string;
    updatedBy: string;
  };
}

export interface Committee {
  id: string;
  name: string;
}

export interface CreateIssuanceData {
  title: string;
  templateId: string;
  templateName: string;
  createdBy: string;
  recipientType: 'Event' | 'Person' | 'Committee' | 'Directory' | 'External';
  recipientDetails: Array<{ name: string; email: string; eventId?: string; source?: string }>;
  totalRecipients: number;
  fieldInputs: Record<string, string>;
  emailTitle?: string;
  emailMessage?: string;
  customTemplateUrl?: string;
  notes?: string;
  recipients: Array<{ name: string; email: string; type: 'Member' | 'External' }>;
  downloadOnly?: boolean; // If true, marks issuance as Sent immediately (no email sent)
  customNameOverride?: string; // If set, use this value for {NAME} instead of individual recipient names
  // Name formatting options
  nameAllCaps?: boolean; // If true, names will be converted to ALL CAPS
  nameStartPosition?: number; // Start position for name line (default: 8.1)
  nameEndPosition?: number; // End position for name line (default: 27.6)
  namePositionUnit?: 'cm' | 'inch'; // Unit for positions (default: 'cm')
  // Attachments - array of links to external files
  attachments?: IssuanceAttachment[];
  // Event linking for control numbers
  eventId?: string; // Event ID for control number generation
  eventTitle?: string; // Event title for control number generation
}

export interface CreateTemplateData {
  name: string;
  description?: string;
  type: string;
  docsUrl: string;
  fields: string[];
  isDefault?: boolean;
  createdBy: string;
}

export interface UpdateTemplateData {
  id: string;
  name?: string;
  description?: string;
  type?: string;
  docsUrl?: string;
  fields?: string[];
  isDefault?: boolean;
  status?: 'Active' | 'Archived';
}

export interface SendResult {
  total: number;
  sent: number;
  failed: number;
  details: Array<{
    email: string;
    name: string;
    status: 'sent' | 'failed' | 'skipped';
    message: string;
  }>;
}

export interface GASIssuanceResponse<T = unknown> {
  success: boolean;
  data?: T;
  id?: string;
  message?: string;
  error?: string;
  results?: SendResult;
  pdfUrl?: string;
  pdfFileId?: string;
  pdfBase64?: string;
  fileName?: string;
  pageCount?: number; // Number of pages in combined preview PDF
  pdfPreviews?: Array<{ recipientName: string; pdfBase64: string }>; // Array of PDFs for pagination
  cancelled?: boolean; // True if sending was cancelled mid-process
}

// =====================================================
// CONFIGURATION
// =====================================================

const GAS_ISSUANCE_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbwir6gVrY9U9n8KgThRx7_5CXxHvDPyF_4EDho_ZsSE2oUtfolYkK6M8A8mdatssWkPMw/exec',
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes cache
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
  
  const isExpired = Date.now() - entry.timestamp > GAS_ISSUANCE_CONFIG.CACHE_DURATION;
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

export function clearIssuanceCache(): void {
  const keysToDelete: string[] = [];
  cache.forEach((_, key) => {
    if (key.startsWith('issuance_')) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => cache.delete(key));
}

// =====================================================
// API HELPERS
// =====================================================

async function fetchFromGAS<T>(params: Record<string, string>): Promise<GASIssuanceResponse<T>> {
  const url = new URL(GAS_ISSUANCE_CONFIG.API_URL);
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

async function postToGAS<T>(data: Record<string, unknown>): Promise<GASIssuanceResponse<T>> {
  const response = await fetch(GAS_ISSUANCE_CONFIG.API_URL, {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'text/plain',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// =====================================================
// INITIALIZATION
// =====================================================

/**
 * Initialize the issuance sheets (run once on setup)
 */
export async function initializeIssuanceSheets(): Promise<GASIssuanceResponse<unknown>> {
  return fetchFromGAS({ action: 'init' });
}

/**
 * Migrate columns to fix alignment issues
 * Call this if spreadsheet was created before DeliveryMethod column was added
 */
export async function migrateColumns(): Promise<GASIssuanceResponse> {
  const response = await fetchFromGAS({ action: 'migrateColumns' });
  if (response.success) {
    clearIssuanceCache();
  }
  return response;
}

// =====================================================
// ISSUANCE OPERATIONS
// =====================================================

/**
 * Get all issuances with optional filters
 */
export async function getIssuances(params?: {
  status?: string;
  search?: string;
}): Promise<Issuance[]> {
  const cacheKey = `issuance_list_${JSON.stringify(params || {})}`;
  const cached = getCachedData<Issuance[]>(cacheKey);
  if (cached) return cached;

  const queryParams: Record<string, string> = { action: 'getIssuances' };
  if (params?.status) queryParams.status = params.status;
  if (params?.search) queryParams.search = params.search;

  const response = await fetchFromGAS<Issuance[]>(queryParams);
  
  if (response.success && response.data) {
    setCacheData(cacheKey, response.data);
    return response.data;
  }
  
  throw new Error(response.error || 'Failed to fetch issuances');
}

/**
 * Get issuances for a specific recipient (member view)
 * Supports matching by email and/or name for comprehensive results
 * This is used by heads, members, and other roles below auditor/admin
 */
export async function getIssuancesByRecipient(email: string, name?: string): Promise<Issuance[]> {
  const cleanEmail = email.trim(); // Ensure no trailing spaces
  const cleanName = name?.trim() || '';
  const cacheKey = `issuance_recipient_${cleanEmail}_${cleanName}`;
  const cached = getCachedData<Issuance[]>(cacheKey);
  if (cached) return cached;

  const params: Record<string, string> = { 
    action: 'getIssuancesByRecipient', 
    email: cleanEmail 
  };
  
  // Also pass name for better matching (handles cases where email might differ)
  if (cleanName) {
    params.name = cleanName;
  }

  const response = await fetchFromGAS<Issuance[]>(params);
  
  if (response.success && response.data) {
    setCacheData(cacheKey, response.data);
    return response.data;
  }
  
  throw new Error(response.error || 'Failed to fetch issuances');
}

/**
 * Get single issuance by ID
 */
export async function getIssuanceById(id: string): Promise<Issuance> {
  const cacheKey = `issuance_${id}`;
  const cached = getCachedData<Issuance>(cacheKey);
  if (cached) return cached;

  const response = await fetchFromGAS<Issuance>({ action: 'getIssuance', id });
  
  if (response.success && response.data) {
    setCacheData(cacheKey, response.data);
    return response.data;
  }
  
  throw new Error(response.error || 'Issuance not found');
}

/**
 * Create new issuance
 */
export async function createIssuance(data: CreateIssuanceData): Promise<string> {
  const response = await postToGAS<{ id: string }>({
    action: 'createIssuance',
    ...data,
  });
  
  if (response.success && response.id) {
    clearIssuanceCache();
    return response.id;
  }
  
  throw new Error(response.error || 'Failed to create issuance');
}

/**
 * Update existing issuance
 */
export async function updateIssuance(data: Partial<Issuance> & { id: string }): Promise<void> {
  const response = await postToGAS({
    action: 'updateIssuance',
    ...data,
  });
  
  if (!response.success) {
    throw new Error(response.error || 'Failed to update issuance');
  }
  
  clearIssuanceCache();
}

/**
 * Delete (archive) issuance
 */
export async function deleteIssuance(id: string): Promise<void> {
  const response = await postToGAS({
    action: 'deleteIssuance',
    id,
  });
  
  if (!response.success) {
    throw new Error(response.error || 'Failed to delete issuance');
  }
  
  clearIssuanceCache();
}

/**
 * Permanently delete issuance (removes from database completely)
 */
export async function permanentDeleteIssuance(id: string): Promise<void> {
  const response = await postToGAS({
    action: 'permanentDeleteIssuance',
    id,
  });
  
  if (!response.success) {
    throw new Error(response.error || 'Failed to permanently delete issuance');
  }
  
  clearIssuanceCache();
}

// =====================================================
// TEMPLATE OPERATIONS
// =====================================================

/**
 * Get all templates
 */
export async function getTemplates(params?: {
  type?: string;
  includeArchived?: boolean;
}): Promise<IssuanceTemplate[]> {
  const cacheKey = `issuance_templates_${JSON.stringify(params || {})}`;
  const cached = getCachedData<IssuanceTemplate[]>(cacheKey);
  if (cached) return cached;

  const queryParams: Record<string, string> = { action: 'getTemplates' };
  if (params?.type) queryParams.type = params.type;
  if (params?.includeArchived) queryParams.includeArchived = 'true';

  const response = await fetchFromGAS<IssuanceTemplate[]>(queryParams);
  
  if (response.success && response.data) {
    setCacheData(cacheKey, response.data);
    return response.data;
  }
  
  throw new Error(response.error || 'Failed to fetch templates');
}

/**
 * Get single template by ID
 */
export async function getTemplateById(id: string): Promise<IssuanceTemplate> {
  const response = await fetchFromGAS<IssuanceTemplate>({ action: 'getTemplate', id });
  
  if (response.success && response.data) {
    return response.data;
  }
  
  throw new Error(response.error || 'Template not found');
}

/**
 * Create new template
 */
export async function createTemplate(data: CreateTemplateData): Promise<string> {
  const response = await postToGAS<{ id: string }>({
    action: 'createTemplate',
    ...data,
  });
  
  if (response.success && response.id) {
    clearIssuanceCache();
    return response.id;
  }
  
  throw new Error(response.error || 'Failed to create template');
}

/**
 * Update existing template
 */
export async function updateTemplate(data: UpdateTemplateData): Promise<void> {
  const response = await postToGAS({
    action: 'updateTemplate',
    ...data,
  });
  
  if (!response.success) {
    throw new Error(response.error || 'Failed to update template');
  }
  
  clearIssuanceCache();
}

/**
 * Delete (archive) template
 */
export async function deleteTemplate(id: string): Promise<void> {
  const response = await postToGAS({
    action: 'deleteTemplate',
    id,
  });
  
  if (!response.success) {
    throw new Error(response.error || 'Failed to delete template');
  }
  
  clearIssuanceCache();
}

// =====================================================
// SETTINGS OPERATIONS
// =====================================================

/**
 * Get all settings
 */
export async function getSettings(): Promise<IssuanceSettings> {
  const cacheKey = 'issuance_settings';
  const cached = getCachedData<IssuanceSettings>(cacheKey);
  if (cached) return cached;

  const response = await fetchFromGAS<IssuanceSettings>({ action: 'getSettings' });
  
  if (response.success && response.data) {
    setCacheData(cacheKey, response.data);
    return response.data;
  }
  
  throw new Error(response.error || 'Failed to fetch settings');
}

/**
 * Update a setting
 */
export async function updateSetting(key: string, value: string, updatedBy: string): Promise<void> {
  const response = await postToGAS({
    action: 'updateSetting',
    key,
    value,
    updatedBy,
  });
  
  if (!response.success) {
    throw new Error(response.error || 'Failed to update setting');
  }
  
  clearIssuanceCache();
}

// =====================================================
// RECIPIENT OPERATIONS
// =====================================================

/**
 * Get recipients for an issuance
 */
export async function getRecipientsByIssuance(issuanceId: string): Promise<Recipient[]> {
  const response = await fetchFromGAS<Recipient[]>({ 
    action: 'getRecipients', 
    issuanceId 
  });
  
  if (response.success && response.data) {
    return response.data;
  }
  
  throw new Error(response.error || 'Failed to fetch recipients');
}

// =====================================================
// SEND LOGS
// =====================================================

/**
 * Get send logs with optional filters
 */
export async function getSendLogs(params?: {
  issuanceId?: string;
}): Promise<SendLog[]> {
  const queryParams: Record<string, string> = { action: 'getSendLogs' };
  if (params?.issuanceId) queryParams.issuanceId = params.issuanceId;

  const response = await fetchFromGAS<SendLog[]>(queryParams);
  
  if (response.success && response.data) {
    return response.data;
  }
  
  throw new Error(response.error || 'Failed to fetch send logs');
}

// =====================================================
// PDF GENERATION & SENDING
// =====================================================

// Interface for individual preview in pagination
export interface PdfPreviewItem {
  recipientName: string;
  pdfUrl: string;
  pdfBase64?: string; // Also store base64 for caching
}

/**
 * Generate PDF preview
 * If multiple recipients provided, generates a combined preview showing all certificates
 * Returns blob URLs that can be displayed in an iframe with pagination
 * Also returns base64 data for caching
 */
export async function generatePdfPreview(
  templateUrl: string,
  fieldValues: Record<string, string>,
  recipientName: string,
  recipients?: Array<{ name: string; email: string }>,
  customNameOverride?: string, // If set, use this for all {NAME} replacements
  options?: {
    useAllCaps?: boolean;
    nameStartPosition?: number;
    nameEndPosition?: number;
    namePositionUnit?: 'cm' | 'inch';
  }
): Promise<{ 
  pdfUrl: string; 
  pdfBase64?: string; // Return base64 for caching
  pdfFileId: string; 
  fileName?: string; 
  pageCount?: number;
  pdfPreviews?: PdfPreviewItem[];
  rawPdfPreviews?: Array<{ recipientName: string; pdfBase64: string }>; // Raw base64 for caching
}> {
  const response = await postToGAS({
    action: 'generatePdf',
    templateUrl,
    fieldValues,
    recipientName,
    recipients, // Pass recipients for combined preview
    customNameOverride, // Pass custom name override to backend
    // Pass name formatting options
    useAllCaps: options?.useAllCaps ?? false,
    nameStartPosition: options?.nameStartPosition ?? 8.1,
    nameEndPosition: options?.nameEndPosition ?? 27.6,
    namePositionUnit: options?.namePositionUnit ?? 'cm',
  });
  
  if (response.success) {
    // Store raw base64 for caching
    const rawPdfPreviews = response.pdfPreviews;
    
    // Handle array of PDF previews for pagination
    let pdfPreviews: PdfPreviewItem[] | undefined;
    if (response.pdfPreviews && response.pdfPreviews.length > 0) {
      pdfPreviews = response.pdfPreviews.map(preview => {
        // Convert each base64 to blob URL
        const byteCharacters = atob(preview.pdfBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        
        return {
          recipientName: preview.recipientName,
          pdfUrl: blobUrl,
          pdfBase64: preview.pdfBase64 // Include for caching
        };
      });
    }
    
    // If base64 data is returned, convert to blob URL for iframe display
    if (response.pdfBase64) {
      try {
        // Convert base64 to blob
        const byteCharacters = atob(response.pdfBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        
        return {
          pdfUrl: blobUrl,
          pdfBase64: response.pdfBase64, // Return base64 for caching
          pdfFileId: response.pdfFileId || '',
          fileName: response.fileName,
          pageCount: response.pageCount,
          pdfPreviews,
          rawPdfPreviews, // Return raw for caching
        };
      } catch (e) {
        console.error('Failed to convert base64 to blob:', e);
        throw new Error('Failed to process PDF data');
      }
    }
    
    // Fallback to URL if no base64 (shouldn't happen with updated backend)
    if (response.pdfUrl) {
      return {
        pdfUrl: response.pdfUrl,
        pdfFileId: response.pdfFileId || '',
        pdfPreviews,
        rawPdfPreviews,
      };
    }
  }
  
  throw new Error(response.error || 'Failed to generate PDF');
}

/**
 * Send issuance to all recipients
 */
export async function sendIssuance(
  issuanceId: string,
  sentBy: string,
  onProgress?: (progress: SendResult) => void
): Promise<SendResult & { cancelled?: boolean; message?: string }> {
  const response = await postToGAS<SendResult & { cancelled?: boolean; message?: string }>({
    action: 'sendIssuance',
    issuanceId,
    sentBy,
  });
  
  if (response.success && response.results) {
    clearIssuanceCache();
    if (onProgress) onProgress(response.results);
    return {
      ...response.results,
      cancelled: response.cancelled,
      message: response.message,
    };
  }
  
  throw new Error(response.error || 'Failed to send issuance');
}

/**
 * Publish a Download-Only issuance (makes it visible to members without sending emails)
 * Changes status from Draft to Sent
 */
export async function publishIssuance(
  issuanceId: string,
  publishedBy: string
): Promise<{ publishedAt: string; publishedBy: string; recipientCount: number; message: string }> {
  const response = await postToGAS({
    action: 'publishIssuance',
    issuanceId,
    publishedBy,
  });
  
  if (response.success) {
    clearIssuanceCache();
    // Backend returns these fields at root level
    const result = response as unknown as { 
      publishedAt?: string; 
      publishedBy?: string; 
      recipientCount?: number; 
      message?: string; 
    };
    return {
      publishedAt: result.publishedAt || '',
      publishedBy: result.publishedBy || publishedBy,
      recipientCount: result.recipientCount || 0,
      message: result.message || 'Published successfully',
    };
  }
  
  throw new Error(response.error || 'Failed to publish issuance');
}

/**
 * Cancel sending for a specific issuance
 * Sets a flag that the backend checks between each recipient
 */
export async function cancelSending(issuanceId: string): Promise<void> {
  const response = await postToGAS({
    action: 'cancelSending',
    issuanceId,
  });
  
  if (!response.success) {
    throw new Error(response.error || 'Failed to cancel sending');
  }
}

/**
 * Resend issuance to a single recipient (for failed emails)
 */
export async function resendToRecipient(
  issuanceId: string,
  recipientId: string,
  sentBy: string
): Promise<{ name: string; email: string; status: string }> {
  const response = await postToGAS<{ recipient: { name: string; email: string; status: string } }>({
    action: 'resendToRecipient',
    issuanceId,
    recipientId,
    sentBy,
  });
  
  // Check for recipient in response.data or directly in response (backend returns it at root level)
  const recipient = response.data?.recipient || (response as unknown as { recipient: { name: string; email: string; status: string } }).recipient;
  
  if (response.success && recipient) {
    clearIssuanceCache();
    return recipient;
  }
  
  throw new Error(response.error || 'Failed to resend email');
}

/**
 * Download issuance (generate PDFs without sending email)
 */
export async function downloadIssuance(
  issuanceId: string,
  recipientId?: string,
  downloadedBy?: string
): Promise<{ pdfUrl?: string; results?: Array<{ name: string; pdfUrl: string }> }> {
  const response = await postToGAS<{ pdfUrl?: string; downloadResults?: Array<{ name: string; pdfUrl: string; success: boolean }> }>({
    action: 'downloadIssuance',
    issuanceId,
    recipientId,
    downloadedBy,
  });
  
  if (response.success) {
    clearIssuanceCache();
    return {
      pdfUrl: response.pdfUrl,
      results: response.data?.downloadResults?.filter(r => r.success).map(r => ({ name: r.name, pdfUrl: r.pdfUrl })),
    };
  }
  
  throw new Error(response.error || 'Failed to download issuance');
}

// =====================================================
// HELPER DATA FETCHERS
// =====================================================

/**
 * Get committees list
 */
export async function getCommittees(): Promise<Committee[]> {
  const cacheKey = 'issuance_committees';
  const cached = getCachedData<Committee[]>(cacheKey);
  if (cached) return cached;

  const response = await fetchFromGAS<Committee[]>({ action: 'getCommittees' });
  
  if (response.success && response.data) {
    setCacheData(cacheKey, response.data);
    return response.data;
  }
  
  // Return default committees if API fails
  return [
    { id: 'executive', name: 'Executive Committee' },
    { id: 'environmental', name: 'Environmental Conservation' },
    { id: 'youth-dev', name: 'Youth Development' },
    { id: 'outreach', name: 'Community Outreach' },
    { id: 'education', name: 'Education and Scholarship' },
    { id: 'health', name: 'Health and Wellness' },
    { id: 'sports', name: 'Sports and Recreation' },
    { id: 'finance', name: 'Finance and Resource Mobilization' },
    { id: 'communications', name: 'Communications and Media' },
    { id: 'membership', name: 'Membership and Recruitment' },
  ];
}

/**
 * Get event attendees (Present + Late) for an event
 * Returns all attendees including those without email (hasEmail flag indicates)
 */
export async function getEventAttendees(eventId: string): Promise<Array<{ 
  name: string; 
  email: string; 
  hasEmail?: boolean;
  memberId?: string;
  status?: string;
}>> {
  const response = await fetchFromGAS<Array<{ 
    name: string; 
    email: string; 
    hasEmail?: boolean;
    memberId?: string;
    status?: string;
  }>>({ 
    action: 'getEventAttendees', 
    eventId 
  });
  
  if (response.success && response.data) {
    return response.data;
  }
  
  return [];
}

/**
 * Get all members from directory
 */
export async function getAllMembersForIssuance(): Promise<Array<{ name: string; email: string; committee?: string }>> {
  const response = await fetchFromGAS<Array<{ name: string; email: string; committee?: string }>>({ 
    action: 'getMembers' 
  });
  
  if (response.success && response.data) {
    return response.data;
  }
  
  return [];
}

// =====================================================
// PDF TO PNG CONVERSION UTILITY
// =====================================================

/**
 * Convert PDF blob URL to PNG data URL for local preview display
 * This provides faster rendering and avoids PDF viewer dependency
 * Uses pdf.js library loaded dynamically from CDN
 */
export async function convertPdfToImagePreview(
  pdfBlobUrl: string,
  scale: number = 2.0 // Higher scale = better quality
): Promise<string> {
  // Dynamically load pdf.js if not already loaded
  if (!(window as any).pdfjsLib) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        // Set worker source
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  
  const pdfjsLib = (window as any).pdfjsLib;
  
  // Fetch the PDF blob and convert to array buffer
  const response = await fetch(pdfBlobUrl);
  const arrayBuffer = await response.arrayBuffer();
  
  // Load PDF document
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1); // Get first page
  
  // Calculate viewport with scale
  const viewport = page.getViewport({ scale });
  
  // Create canvas for rendering
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  if (!context) {
    throw new Error('Failed to get canvas context');
  }
  
  canvas.height = viewport.height;
  canvas.width = viewport.width;
  
  // Render PDF page to canvas
  await page.render({
    canvasContext: context,
    viewport: viewport
  }).promise;
  
  // Convert canvas to PNG data URL
  return canvas.toDataURL('image/png');
}

/**
 * Generate proper download filename in YSP format
 * Format: YSP-Name_Title_YYYY-MM-DD.pdf
 */
export function generateIssuanceFilename(
  recipientName: string,
  issuanceTitle: string,
  extension: string = 'pdf'
): string {
  const today = new Date().toISOString().split('T')[0];
  const sanitizedName = recipientName
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .trim() || 'Recipient';
  const sanitizedTitle = issuanceTitle
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .trim() || 'Issuance';
  
  return `YSP-${sanitizedName}_${sanitizedTitle}_${today}.${extension}`;
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Parse field inputs JSON string
 */
export function parseFieldInputs(fieldInputsStr: string): Record<string, string> {
  try {
    return JSON.parse(fieldInputsStr || '{}');
  } catch {
    return {};
  }
}

/**
 * Parse recipient details JSON string
 */
export function parseRecipientDetails(recipientDetailsStr: string): Array<{ name: string; email: string }> {
  try {
    return JSON.parse(recipientDetailsStr || '[]');
  } catch {
    return [];
  }
}

/**
 * Get status color for UI
 */
export function getIssuanceStatusColor(status: string): string {
  switch (status) {
    case 'Sent':
      return '#10b981'; // Green
    case 'Downloaded':
      return '#3b82f6'; // Blue
    case 'Draft':
      return '#f59e0b'; // Amber
    case 'Archived':
      return '#6b7280'; // Gray
    default:
      return '#9ca3af';
  }
}

/**
 * Get recipient type label
 */
export function getRecipientTypeLabel(type: string): string {
  switch (type) {
    case 'Event':
      return 'Event Attendees';
    case 'Person':
      return 'Individual Members';
    case 'Committee':
      return 'Committee Members';
    case 'Directory':
      return 'All Directory';
    case 'External':
      return 'External Recipients';
    default:
      return type;
  }
}

/**
 * Format date for display
 */
export function formatIssuanceDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}
// =====================================================
// CONTROL NUMBER TRACKING TYPES
// =====================================================

export interface ControlNumberTrackingRecipient {
  name: string;
  email: string;
  controlNumber: string;
  status: 'Pending' | 'Sent' | 'Failed' | 'Downloaded';
}

export interface ControlNumberTracking {
  TrackingID: string;
  IssuanceID: string;
  IssuanceTitle: string;
  EventID: string;
  EventTitle: string;
  EventNumber: number;
  Year: number;
  ControlNumberStart: string;
  ControlNumberEnd: string;
  TotalRecipients: number;
  Recipients: ControlNumberTrackingRecipient[];
  TemplateID: string;
  TemplateName: string;
  DeliveryMethod: 'Email' | 'DownloadOnly';
  CreatedBy: string;
  CreatedAt: string;
  SentAt: string;
  Status: 'Active' | 'Completed' | 'Voided';
  Notes: string;
}

export interface ControlNumberSummaryEvent {
  eventId: string;
  eventTitle: string;
  eventNumber: number;
  totalCertificates: number;
  controlNumberPrefix: string;
  controlNumberRange: string;
}

export interface ControlNumberSummary {
  year: number;
  totalEvents: number;
  totalCertificates: number;
  events: ControlNumberSummaryEvent[];
}

export interface AvailableEventNumbers {
  usedNumbers: number[];
  nextAvailable: number;
  gaps: number[];
  suggestedNext: number;
}

// =====================================================
// CONTROL NUMBER TRACKING API
// =====================================================

/**
 * Get control number tracking records with optional filters
 */
export async function getControlNumberTracking(filters?: {
  year?: number;
  eventId?: string;
  status?: string;
  issuanceId?: string;
}): Promise<GASIssuanceResponse<ControlNumberTracking[]>> {
  const params: Record<string, string> = { action: 'getControlNumberTracking' };
  if (filters?.year) params.year = filters.year.toString();
  if (filters?.eventId) params.eventId = filters.eventId;
  if (filters?.status) params.status = filters.status;
  if (filters?.issuanceId) params.issuanceId = filters.issuanceId;

  return fetchFromGAS<ControlNumberTracking[]>(params);
}

/**
 * Get control number summary by year
 */
export async function getControlNumberSummary(year?: number): Promise<GASIssuanceResponse<ControlNumberSummary>> {
  const params: Record<string, string> = { action: 'getControlNumberSummary' };
  if (year) params.year = year.toString();

  return fetchFromGAS<ControlNumberSummary>(params);
}

/**
 * Find available (unused) event numbers for a year
 */
export async function findAvailableEventNumbers(year?: number): Promise<GASIssuanceResponse<AvailableEventNumbers>> {
  const params: Record<string, string> = { action: 'findAvailableEventNumbers' };
  if (year) params.year = year.toString();

  return fetchFromGAS<AvailableEventNumbers>(params);
}

/**
 * Void a control number tracking record
 */
export async function voidControlNumberTracking(trackingId: string, voidReason?: string): Promise<GASIssuanceResponse> {
  return postToGAS({
    action: 'voidControlNumberTracking',
    trackingId,
    voidReason: voidReason || 'No reason provided'
  });
}