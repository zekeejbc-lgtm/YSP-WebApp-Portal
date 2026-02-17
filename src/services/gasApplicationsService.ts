/**
 * Service for interacting with the Google Apps Script backend for Membership Applications.
 * Endpoint: https://script.google.com/macros/s/AKfycbyrv2aWb4fXt372V4RdYM2SYU9jeK3DWfCTBLe2EI59UjIMuwh9csd8MdYh1MduVHl09A/exec
 */

import { getStoredUser, getSessionToken } from "./gasLoginService";
import { type ApplicationOpportunity } from "../components/MembershipApplicationsPage";

const API_URL = "https://script.google.com/macros/s/AKfycbyrv2aWb4fXt372V4RdYM2SYU9jeK3DWfCTBLe2EI59UjIMuwh9csd8MdYh1MduVHl09A/exec";
const API_KEY = import.meta.env.VITE_GAS_API_KEY || "YSP_TAGUM_CHAPTER_SECRET_KEY_2025";

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
    const response = await fetch(`${API_URL}?action=getOpportunities`);
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
