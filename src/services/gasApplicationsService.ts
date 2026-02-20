/**
 * Service for interacting with the Google Apps Script backend for Membership Applications.
 * Endpoint: https://script.google.com/macros/s/AKfycbyrv2aWb4fXt372V4RdYM2SYU9jeK3DWfCTBLe2EI59UjIMuwh9csd8MdYh1MduVHl09A/exec
 */

import { getStoredUser, getSessionToken } from "./gasLoginService";
import { type ApplicationOpportunity } from "../components/MembershipApplicationsPage";

const API_URL = "https://script.google.com/macros/s/AKfycbyrv2aWb4fXt372V4RdYM2SYU9jeK3DWfCTBLe2EI59UjIMuwh9csd8MdYh1MduVHl09A/exec";
const API_KEY = import.meta.env.VITE_GAS_API_KEY || "";

export interface SyncedApplicant {
  id: string;
  name: string;
  email: string;
  phone: string;
  dateApplied: string;
  committee: string;
  status: "pending" | "approved" | "rejected";
  fullData: {
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
  };
}

export interface SyncedApplicantSheetData {
  sheetUrl: string;
  sheetName: string;
  headers: string[];
  rowCount: number;
  syncedAt: string;
  applicants: SyncedApplicant[];
}

function safeErrorDetails(raw: unknown) {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  return {
    code: obj.code,
    error: obj.error,
    message: obj.message,
    success: obj.success,
  };
}

function logApiError(
  action: string,
  info: {
    username?: string;
    hasSessionToken?: boolean;
    responseStatus?: number;
    responseOk?: boolean;
    payload?: unknown;
    result?: unknown;
    error?: unknown;
  }
) {
  console.error(`[Applications API] ${action} failed`, info);
}

/**
 * Fetch all opportunities from the backend
 */
export async function fetchOpportunities(): Promise<{ success: boolean; data?: ApplicationOpportunity[]; error?: string }> {
  try {
    const token = getSessionToken();
    const url = new URL(API_URL);
    url.searchParams.set("action", "getOpportunities");
    // Public endpoint: token is optional (included only when available).
    if (token) {
      url.searchParams.set("sessionToken", token);
    }
    const response = await fetch(url.toString());
    const result = await response.json();

    if (result.success && result.data) {
      return { success: true, data: result.data };
    } else {
      logApiError("fetchOpportunities", {
        responseStatus: response.status,
        responseOk: response.ok,
        result: safeErrorDetails(result),
      });
      return { success: false, error: result.error || "Failed to fetch opportunities" };
    }
  } catch (error) {
    logApiError("fetchOpportunities", { error });
    return { success: false, error: "Network error" };
  }
}

/**
 * Add a new opportunity
 */
export async function addOpportunity(opportunity: Omit<ApplicationOpportunity, "id">): Promise<{ success: boolean; data?: ApplicationOpportunity; error?: string }> {
  try {
    const user = getStoredUser();
    const token = getSessionToken();

    if (!user || !token) {
      return { success: false, error: "Authentication required" };
    }

    const payload = {
      action: "addOpportunity",
      key: API_KEY,
      sessionToken: token,
      username: user.username, // Fallback if token verification fails on old deployments
      data: opportunity,
    };

    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (result.success) {
      return { success: true, data: result.data };
    } else {
      logApiError("addOpportunity", {
        username: user.username,
        hasSessionToken: Boolean(token),
        responseStatus: response.status,
        responseOk: response.ok,
        payload: {
          action: payload.action,
          data: {
            title: opportunity.title,
            status: opportunity.status,
            visibility: opportunity.visibility,
          },
        },
        result: safeErrorDetails(result),
      });
      return { success: false, error: result.error || "Failed to add opportunity" };
    }
  } catch (error) {
    logApiError("addOpportunity", {
      error,
      payload: {
        title: opportunity.title,
        status: opportunity.status,
        visibility: opportunity.visibility,
      },
    });
    return { success: false, error: "Network error" };
  }
}

/**
 * Update an existing opportunity
 */
export async function updateOpportunity(id: string, updates: Partial<ApplicationOpportunity>): Promise<{ success: boolean; error?: string }> {
  try {
    const user = getStoredUser();
    const token = getSessionToken();

    if (!user || !token) {
      return { success: false, error: "Authentication required" };
    }

    const payload = {
      action: "updateOpportunity",
      key: API_KEY,
      sessionToken: token,
      username: user.username,
      id: id,
      data: updates,
    };

    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (result.success) {
      return { success: true };
    } else {
      logApiError("updateOpportunity", {
        username: user.username,
        hasSessionToken: Boolean(token),
        responseStatus: response.status,
        responseOk: response.ok,
        payload: { action: payload.action, id },
        result: safeErrorDetails(result),
      });
      return { success: false, error: result.error || "Failed to update opportunity" };
    }
  } catch (error) {
    logApiError("updateOpportunity", { error, payload: { id } });
    return { success: false, error: "Network error" };
  }
}

/**
 * Delete an opportunity
 */
export async function deleteOpportunity(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = getStoredUser();
    const token = getSessionToken();

    if (!user || !token) {
      return { success: false, error: "Authentication required" };
    }

    const payload = {
      action: "deleteOpportunity",
      key: API_KEY,
      sessionToken: token,
      username: user.username,
      id: id,
    };

    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (result.success) {
      return { success: true };
    } else {
      logApiError("deleteOpportunity", {
        username: user.username,
        hasSessionToken: Boolean(token),
        responseStatus: response.status,
        responseOk: response.ok,
        payload: { action: payload.action, id },
        result: safeErrorDetails(result),
      });
      return { success: false, error: result.error || "Failed to delete opportunity" };
    }
  } catch (error) {
    logApiError("deleteOpportunity", { error, payload: { id } });
    return { success: false, error: "Network error" };
  }
}

function requireAuthContext() {
  const user = getStoredUser();
  const token = getSessionToken();
  if (!user || !token) {
    return null;
  }
  return { user, token };
}

async function postAuthorized<T>(payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.json();
}

/**
 * Get persisted applicant sheet link and current parsed applicants.
 */
export async function getSyncedApplicantSheet(): Promise<{ success: boolean; data?: SyncedApplicantSheetData; error?: string }> {
  try {
    const auth = requireAuthContext();
    if (!auth) {
      return { success: false, error: "Authentication required" };
    }

    const payload = {
      action: "getSyncedApplicantSheet",
      key: API_KEY,
      sessionToken: auth.token,
      username: auth.user.username,
    };

    const result = await postAuthorized<{ success: boolean; data?: SyncedApplicantSheetData; error?: string }>(payload);
    if (result.success) {
      return { success: true, data: result.data };
    }

    logApiError("getSyncedApplicantSheet", {
      username: auth.user.username,
      hasSessionToken: Boolean(auth.token),
      payload: { action: payload.action },
      result: safeErrorDetails(result),
    });
    return { success: false, error: result.error || "Failed to load synced applicant sheet" };
  } catch (error) {
    logApiError("getSyncedApplicantSheet", { error });
    return { success: false, error: "Network error" };
  }
}

/**
 * Persist applicant sheet link and sync applicants from it.
 */
export async function syncApplicantSheet(sheetUrl: string): Promise<{ success: boolean; data?: SyncedApplicantSheetData; error?: string }> {
  try {
    const auth = requireAuthContext();
    if (!auth) {
      return { success: false, error: "Authentication required" };
    }

    const payload = {
      action: "syncApplicantSheet",
      key: API_KEY,
      sessionToken: auth.token,
      username: auth.user.username,
      sheetUrl,
    };

    const result = await postAuthorized<{ success: boolean; data?: SyncedApplicantSheetData; error?: string }>(payload);
    if (result.success) {
      return { success: true, data: result.data };
    }

    logApiError("syncApplicantSheet", {
      username: auth.user.username,
      hasSessionToken: Boolean(auth.token),
      payload: { action: payload.action },
      result: safeErrorDetails(result),
    });
    return { success: false, error: result.error || "Failed to sync applicant sheet" };
  } catch (error) {
    logApiError("syncApplicantSheet", { error });
    return { success: false, error: "Network error" };
  }
}

export async function getApplicantImageDataUrl(imageUrl: string): Promise<{ success: boolean; dataUrl?: string; error?: string }> {
  try {
    const auth = requireAuthContext();
    if (!auth) {
      return { success: false, error: "Authentication required" };
    }

    const payload = {
      action: "getApplicantImageDataUrl",
      key: API_KEY,
      sessionToken: auth.token,
      username: auth.user.username,
      imageUrl,
    };

    const result = await postAuthorized<{
      success: boolean;
      data?: { dataUrl?: string };
      error?: string;
    }>(payload);

    if (result.success && result.data?.dataUrl) {
      return { success: true, dataUrl: result.data.dataUrl };
    }

    // Image proxy is best-effort; frontend has multiple fallback loaders.
    return { success: false, error: result.error || "Failed to resolve applicant image" };
  } catch (error) {
    // Keep this silent to avoid noisy console spam in dev when fallback paths are expected.
    return { success: false, error: "Network error" };
  }
}
