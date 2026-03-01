/// <reference types="vite/client" />

import { getSessionToken, getStoredUser } from './gasLoginService';

export type AnnouncementPriority = 'urgent' | 'important' | 'normal';
export type AnnouncementStatus = 'Draft' | 'Sent' | 'Archived';
export type RecipientType = 'All' | 'Heads' | 'Committee' | 'Person';

export type CustomButtonType = 'link' | 'document' | 'rsvp';
export type CustomButtonStyle = 'primary' | 'secondary';

export interface CustomButton {
  id: string;
  type: CustomButtonType;
  label: string;
  url?: string;
  style?: CustomButtonStyle;
  /** For type='rsvp': the email to send RSVP to */
  rsvpEmail?: string;
  /** For type='rsvp': a pretyped message template. Placeholders: {response}, {title}, {name}, {username}, {email}, {announcementId} */
  rsvpMessage?: string;
  /** For type='document': match attachment by name */
  documentMatch?: string;
}

export interface AnnouncementEmailOptions {
  fileButtonLabel?: string;
  fileButtonMatch?: string;
  eventStart?: string;
  eventEnd?: string;
  eventLocation?: string;
  rsvpEmail?: string;
  rsvpOptions?: string[] | string;
  rsvpMessageTemplate?: string;
  customButtons?: CustomButton[];
  hideAuthor?: boolean;
}

export interface AnnouncementAttachment {
  attachmentId: string;
  announcementId: string;
  attachmentType: 'file' | 'link';
  name: string;
  url: string;
  driveFileId?: string;
  mimeType?: string;
  sizeBytes?: number;
  createdBy?: string;
  createdAt?: string;
}

export interface AnnouncementTarget {
  targetId: string;
  announcementId: string;
  username: string;
  fullName: string;
  email: string;
  committee: string;
  role: string;
  status: string;
  emailVerified: boolean;
  eligibility: 'eligible' | 'ineligible';
  reason: string;
}

export interface AnnouncementSendLog {
  logId: string;
  announcementId: string;
  targetId: string;
  username: string;
  email: string;
  action: string;
  result: 'sent' | 'failed' | 'skipped';
  reason: string;
  sentAt: string;
  sentBy: string;
}

export interface AnnouncementItem {
  announcementId: string;
  title: string;
  subtitle: string;
  body: string;
  category: string;
  priority: AnnouncementPriority;
  recipientType: RecipientType;
  recipientPayload: {
    committees?: string[];
    usernames?: string[];
    emailOptions?: AnnouncementEmailOptions;
  };
  status: AnnouncementStatus;
  isPinned: boolean;
  createdBy: string;
  createdByFullName?: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  attachments: AnnouncementAttachment[];
  readCount?: number;
  readUsers?: string[];
  targets?: AnnouncementTarget[];
  sendLogs?: AnnouncementSendLog[];
  isTargeted?: boolean;
}

export interface AnnouncementReadReceipt {
  readId: string;
  announcementId: string;
  username: string;
  fullName: string;
  email: string;
  readAt: string;
}

export interface AnnouncementReadDashboardItem {
  announcementId: string;
  title: string;
  subtitle: string;
  status: AnnouncementStatus;
  readCount: number;
  readers: AnnouncementReadReceipt[];
}

export interface RecipientSuggestion {
  type: 'person' | 'committee' | 'special';
  id: string;
  label: string;
  subtitle?: string;
}

interface AnnouncementApiResponse<T = unknown> {
  success: boolean;
  error?: string;
  code?: number;
  data?: T;
  message?: string;
  items?: AnnouncementItem[];
  item?: AnnouncementItem;
  suggestions?: RecipientSuggestion[];
  targets?: AnnouncementTarget[];
  logs?: AnnouncementSendLog[];
  dashboard?: AnnouncementReadDashboardItem[];
  permissions?: {
    canManage: boolean;
    canSend: boolean;
    canView: boolean;
    canViewReadDashboard?: boolean;
  };
  summary?: {
    total: number;
    sent: number;
    failed: number;
    skipped: number;
  };
}

const GAS_ANNOUNCEMENTS_API_URL =
  import.meta.env.VITE_GAS_ANNOUNCEMENTS_API_URL ||
  import.meta.env.VITE_GAS_LOGIN_API_URL ||
  '';

async function postToAnnouncements<T>(payload: Record<string, unknown>): Promise<AnnouncementApiResponse<T>> {
  if (!GAS_ANNOUNCEMENTS_API_URL) {
    console.error('[Announcements API] Missing API URL (set VITE_GAS_ANNOUNCEMENTS_API_URL or VITE_GAS_LOGIN_API_URL)', {
      action: payload.action,
      hasSessionToken: Boolean(getSessionToken()),
      hasStoredUser: Boolean(getStoredUser()?.username),
    });
    throw new Error('Announcements API URL not configured (set VITE_GAS_ANNOUNCEMENTS_API_URL or VITE_GAS_LOGIN_API_URL)');
  }

  const response = await fetch(GAS_ANNOUNCEMENTS_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
    },
    body: JSON.stringify({
      ...payload,
      username: getStoredUser()?.username || '',
      sessionToken: getSessionToken() || undefined,
    }),
  });

  if (!response.ok) {
    console.error('[Announcements API] Non-OK HTTP response', {
      action: payload.action,
      status: response.status,
      statusText: response.statusText,
      url: GAS_ANNOUNCEMENTS_API_URL,
    });
    throw new Error(`Announcements API request failed: ${response.status}`);
  }

  const data = (await response.json()) as AnnouncementApiResponse<T>;
  if (!data.success) {
    console.error('[Announcements API] API returned success=false', {
      action: payload.action,
      code: data.code,
      error: data.error,
      response: data,
    });
    throw new Error(data.error || 'Announcements API error');
  }

  return data;
}

export async function fetchAnnouncements(params?: {
  search?: string;
  category?: string;
  status?: AnnouncementStatus | 'All';
  recipientView?: boolean;
}): Promise<{ items: AnnouncementItem[]; permissions: { canManage: boolean; canSend: boolean; canView: boolean; canViewReadDashboard?: boolean } }> {
  const response = await postToAnnouncements<{ items: AnnouncementItem[]; permissions: { canManage: boolean; canSend: boolean; canView: boolean; canViewReadDashboard?: boolean } }>({
    action: 'getAnnouncements',
    search: params?.search || '',
    category: params?.category || '',
    status: params?.status || 'All',
    recipientView: params?.recipientView || false,
  });

  return {
    items: response.items || response.data?.items || [],
    permissions: response.permissions || response.data?.permissions || { canManage: false, canSend: false, canView: true, canViewReadDashboard: false },
  };
}

export async function getAnnouncementById(announcementId: string): Promise<AnnouncementItem> {
  const response = await postToAnnouncements<{ item: AnnouncementItem }>({
    action: 'getAnnouncementById',
    announcementId,
  });

  const item = response.item || response.data?.item;
  if (!item) throw new Error('Announcement not found');
  return item;
}

export async function createAnnouncementDraft(input: {
  title: string;
  subtitle: string;
  body: string;
  category: string;
  priority: AnnouncementPriority;
  recipientType: RecipientType;
  recipientPayload: { committees?: string[]; usernames?: string[]; emailOptions?: AnnouncementEmailOptions };
  isPinned: boolean;
}): Promise<AnnouncementItem> {
  const response = await postToAnnouncements<{ item: AnnouncementItem }>({
    action: 'createAnnouncementDraft',
    input,
  });
  const item = response.item || response.data?.item;
  if (!item) throw new Error('Failed to create announcement draft');
  return item;
}

export async function updateAnnouncementDraft(announcementId: string, input: {
  title: string;
  subtitle: string;
  body: string;
  category: string;
  priority: AnnouncementPriority;
  recipientType: RecipientType;
  recipientPayload: { committees?: string[]; usernames?: string[]; emailOptions?: AnnouncementEmailOptions };
  isPinned: boolean;
}): Promise<AnnouncementItem> {
  const response = await postToAnnouncements<{ item: AnnouncementItem }>({
    action: 'updateAnnouncementDraft',
    announcementId,
    input,
  });
  const item = response.item || response.data?.item;
  if (!item) throw new Error('Failed to update announcement draft');
  return item;
}

export async function archiveAnnouncement(announcementId: string): Promise<void> {
  await postToAnnouncements({
    action: 'archiveAnnouncement',
    announcementId,
  });
}

export async function deleteAnnouncement(announcementId: string): Promise<void> {
  await postToAnnouncements({
    action: 'deleteAnnouncement',
    announcementId,
  });
}

export async function searchAnnouncementRecipients(query: string, recipientType: RecipientType): Promise<RecipientSuggestion[]> {
  const response = await postToAnnouncements<{ suggestions: RecipientSuggestion[] }>({
    action: 'searchAnnouncementRecipients',
    query,
    recipientType,
  });
  return response.suggestions || response.data?.suggestions || [];
}

export async function previewAnnouncementRecipients(payload: {
  recipientType: RecipientType;
  recipientPayload: { committees?: string[]; usernames?: string[]; emailOptions?: AnnouncementEmailOptions };
}): Promise<AnnouncementTarget[]> {
  const response = await postToAnnouncements<{ targets: AnnouncementTarget[] }>({
    action: 'previewAnnouncementRecipients',
    payload,
  });
  return response.targets || response.data?.targets || [];
}

export async function uploadAnnouncementAttachment(input: {
  announcementId: string;
  fileName: string;
  mimeType: string;
  base64Data: string;
  sizeBytes: number;
}): Promise<AnnouncementAttachment> {
  const response = await postToAnnouncements<{ attachment: AnnouncementAttachment }>({
    action: 'uploadAnnouncementAttachment',
    ...input,
  });
  const attachment = response.data?.attachment;
  if (!attachment || typeof attachment !== 'object' || !('attachmentId' in attachment)) {
    throw new Error('Failed to upload attachment — unexpected response shape');
  }
  return attachment;
}

export async function addAnnouncementLinkAttachment(input: {
  announcementId: string;
  name: string;
  url: string;
}): Promise<AnnouncementAttachment> {
  const response = await postToAnnouncements<{ attachment: AnnouncementAttachment }>({
    action: 'addAnnouncementLinkAttachment',
    ...input,
  });
  const attachment = response.data?.attachment;
  if (!attachment || typeof attachment !== 'object' || !('attachmentId' in attachment)) {
    throw new Error('Failed to add link attachment — unexpected response shape');
  }
  return attachment;
}

export async function removeAnnouncementAttachment(announcementId: string, attachmentId: string): Promise<void> {
  await postToAnnouncements({
    action: 'removeAnnouncementAttachment',
    announcementId,
    attachmentId,
  });
}

export async function sendAnnouncement(input: {
  announcementId: string;
  mode: 'all' | 'specific';
  deliveryChannel?: 'email' | 'frontend';
  recipientIds?: string[];
}): Promise<{ total: number; sent: number; failed: number; skipped: number }> {
  const { deliveryChannel: _dc, ...rest } = input;
  const response = await postToAnnouncements({
    action: 'sendAnnouncement',
    deliveryChannel: input.deliveryChannel || 'email',
    ...rest,
  });
  return response.summary || { total: 0, sent: 0, failed: 0, skipped: 0 };
}

export async function resendAnnouncementRecipient(announcementId: string, targetId: string): Promise<void> {
  await postToAnnouncements({
    action: 'resendAnnouncementRecipient',
    announcementId,
    targetId,
  });
}

export async function getAnnouncementSendLogs(announcementId: string): Promise<AnnouncementSendLog[]> {
  const response = await postToAnnouncements<{ logs: AnnouncementSendLog[] }>({
    action: 'getAnnouncementSendLogs',
    announcementId,
  });
  return response.logs || response.data?.logs || [];
}

export async function markAnnouncementRead(announcementId: string): Promise<{ alreadyRead: boolean }> {
  const response = await postToAnnouncements<{ alreadyRead: boolean }>({
    action: 'markAnnouncementRead',
    announcementId,
  });
  return { alreadyRead: Boolean(response.data?.alreadyRead) };
}

export async function getAnnouncementReadDashboard(announcementId?: string, query?: string): Promise<AnnouncementReadDashboardItem[]> {
  const response = await postToAnnouncements<{ dashboard: AnnouncementReadDashboardItem[] }>({
    action: 'getAnnouncementReadDashboard',
    announcementId: announcementId || '',
    query: query || '',
  });
  return response.dashboard || response.data?.dashboard || [];
}
