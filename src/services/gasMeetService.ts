import { getStoredUser } from './gasLoginService';

const MEET_API_URL =
  import.meta.env.VITE_GAS_MEET_API_URL ||
  'https://script.google.com/macros/s/AKfycbyTYEMa5apc6ZSCVce1qowpbcooRB88OjtW-nSvsb4ZK-W8N9XcQp2dbigoaPTg316J/exec';

type MeetApiResponse<T> = T & { success?: boolean; error?: string; code?: number };

async function callMeetApi<T>(action: string, data: Record<string, unknown> = {}): Promise<T> {
  if (!MEET_API_URL) throw new Error('Meet API URL not configured');
  const response = await fetch(MEET_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action, ...data }),
  });
  if (!response.ok) throw new Error('Meet API request failed: ' + response.status);
  const payload = (await response.json()) as MeetApiResponse<T>;
  if (payload.success === false) throw new Error(payload.error || 'Meet API error');
  return payload as T;
}

export interface MeetAttendanceDetail {
  participantKey: string;
  name: string;
  firstJoinTime: string;
  lastLeaveTime: string;
  totalDurationSeconds: number;
  joinCount: number;
  exitCount: number;
  isPresent: boolean;
  isExternalParticipant: boolean;
  profilePictureURL?: string;
}

export interface MeetAttendanceMeeting {
  meetingId: string;
  meetingDate: string;
  meetingUrl: string;
  totalAttendees: number;
  externalParticipants: number;
  totalDurationSeconds: number;
  lastSyncedAt: string;
  attendees: MeetAttendanceDetail[];
}

export interface MeetDashboardCard {
  meetingId: string;
  title?: string;
  mode?: string;
  meetUrl: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  status: string;
  createdAt?: string;
  createdBy?: string;
  completedAt?: string;
  completedBy?: string;
  notes?: string;
  meetingDate?: string;
  expectedAttendees?: Array<{ name: string; email?: string; committee?: string }>;
  emailSentCount?: number;
  emailLastSentAt?: string;
  calendarEventId?: string;
  attendance: {
    totalAttendees: number;
    currentlyInMeeting: number;
    externalParticipants: number;
    totalDurationSeconds: number;
    lastSyncedAt: string;
  };
}

export interface MeetDashboardResponse {
  success: boolean;
  createdMeetings: MeetDashboardCard[];
  completedMeetings: MeetDashboardCard[];
  manualMeetings: MeetDashboardCard[];
}

export interface MeetCommittee {
  id: string;
  name: string;
}

export interface MeetDirectoryMember {
  name: string;
  email: string;
  committee?: string;
}

export async function getMeetDashboard(limit = 100): Promise<MeetDashboardResponse> {
  return callMeetApi<MeetDashboardResponse>('getMeetDashboard', { limit });
}

export async function getMeetAttendance(meetingId: string): Promise<MeetAttendanceMeeting | null> {
  const res = await callMeetApi<{ success: boolean; meeting: MeetAttendanceMeeting | null }>('getMeetAttendance', { meetingId });
  return res.meeting || null;
}

export async function createMeetSession(params: {
  title: string;
  mode: 'instant' | 'scheduled';
  scheduledStart?: string;
  scheduledEnd?: string;
  notes?: string;
  expectedAttendees?: Array<{ name: string; email?: string; committee?: string }>;
}) {
  const user = getStoredUser();
  return callMeetApi<{
    success: boolean;
    meeting: MeetDashboardCard;
    meta?: { calendarEventId?: string; emailSentCount?: number; emailFailedCount?: number };
  }>('createMeetSession', {
    ...params,
    username: user?.username || 'meet-webapp',
  });
}

export async function markMeetSessionComplete(meetingId: string) {
  const user = getStoredUser();
  return callMeetApi<{ success: boolean; meetingId: string; status: string }>('markMeetSessionComplete', {
    meetingId,
    username: user?.username || '',
  });
}

export async function getMeetMembers(search = '', limit = 2000): Promise<MeetDirectoryMember[]> {
  const res = await callMeetApi<{ success: boolean; data?: MeetDirectoryMember[] }>('getMembers', {
    search,
    limit,
  });
  return Array.isArray(res.data) ? res.data : [];
}

export async function getMeetCommittees(): Promise<MeetCommittee[]> {
  const res = await callMeetApi<{ success: boolean; data?: MeetCommittee[] }>('getCommittees');
  return Array.isArray(res.data) ? res.data : [];
}
