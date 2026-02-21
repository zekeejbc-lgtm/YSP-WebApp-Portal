/// <reference types="vite/client" />

import { YSP_COMMITTEES } from "../constants/committees";
import { getSessionToken, refreshSessionToken } from "./gasLoginService";

export interface OrganizationalTask {
  TaskID: string;
  CommitteeId: string;
  CommitteeName: string;
  Title: string;
  Description: string;
  Priority: "Low" | "Medium" | "High" | "Urgent";
  Status: "Not Started" | "In Progress" | "Completed" | "Blocked";
  DueDate: string;
  Assignee: string;
  CreatedBy: string;
  CreatedAt: string;
  UpdatedBy: string;
  UpdatedAt: string;
  Checklist: TaskChecklistItem[];
}

export interface TaskChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface SaveOrganizationalTaskPayload {
  taskId?: string;
  committeeId: string;
  committeeName: string;
  title: string;
  description?: string;
  priority?: "Low" | "Medium" | "High" | "Urgent";
  status?: "Not Started" | "In Progress" | "Completed" | "Blocked";
  dueDate?: string;
  assignee?: string;
  checklist?: TaskChecklistItem[];
  username?: string;
}

interface GasTaskResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: number;
}

const GAS_TASK_CONFIG = {
  API_URL: import.meta.env.VITE_GAS_TASK_API_URL || "",
};

function normalizeChecklist(raw: unknown): TaskChecklistItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => {
      const row = item as Partial<TaskChecklistItem>;
      const text = String(row.text || "").trim();
      if (!text) return null;
      return {
        id: String(row.id || `item-${index + 1}`),
        text,
        done: !!row.done,
      } as TaskChecklistItem;
    })
    .filter((item): item is TaskChecklistItem => item !== null);
}

function normalizeTask(task: OrganizationalTask): OrganizationalTask {
  return {
    ...task,
    Checklist: normalizeChecklist((task as unknown as { Checklist?: unknown }).Checklist),
  };
}

function isTokenError(response: GasTaskResponse<unknown>): boolean {
  if ((response as { code?: number }).code === 401) return true;
  const message = String(response.error || response.message || "").toLowerCase();
  return message.includes("invalid or expired session token");
}

function ensureApiUrl(): void {
  if (!GAS_TASK_CONFIG.API_URL) {
    throw new Error("Task API URL is not configured. Set VITE_GAS_TASK_API_URL.");
  }
}

async function fetchFromGAS<T>(params: Record<string, string>): Promise<GasTaskResponse<T>> {
  ensureApiUrl();

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt === 0) {
      await refreshSessionToken(false);
    } else {
      const refreshed = await refreshSessionToken(true);
      if (!refreshed) break;
    }

    const url = new URL(GAS_TASK_CONFIG.API_URL);
    const sessionToken = getSessionToken();
    if (sessionToken) {
      url.searchParams.set("sessionToken", sessionToken);
    }

    Object.entries(params).forEach(([k, v]) => {
      url.searchParams.set(k, v);
    });

    const response = await fetch(url.toString(), {
      method: "GET",
      mode: "cors",
    });

    if (!response.ok) {
      throw new Error(`Task backend HTTP ${response.status}`);
    }

    const payload: GasTaskResponse<T> = await response.json();
    if (attempt === 0 && isTokenError(payload)) {
      continue;
    }
    return payload;
  }

  return { success: false, error: "Invalid or expired session token", message: "Session expired", code: 401 } as GasTaskResponse<T>;
}

async function postToGAS<T>(payload: Record<string, unknown>): Promise<GasTaskResponse<T>> {
  ensureApiUrl();

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt === 0) {
      await refreshSessionToken(false);
    } else {
      const refreshed = await refreshSessionToken(true);
      if (!refreshed) break;
    }

    const response = await fetch(GAS_TASK_CONFIG.API_URL, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "text/plain",
      },
      body: JSON.stringify({
        ...payload,
        sessionToken: getSessionToken(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Task backend HTTP ${response.status}`);
    }

    const result: GasTaskResponse<T> = await response.json();
    if (attempt === 0 && isTokenError(result)) {
      continue;
    }
    return result;
  }

  return { success: false, error: "Invalid or expired session token", message: "Session expired", code: 401 } as GasTaskResponse<T>;
}

export async function getTaskCommittees() {
  try {
    const response = await fetchFromGAS<{ id: string; name: string }[]>({ action: "getCommittees" });
    if (response.success && Array.isArray(response.data)) {
      return response.data;
    }
  } catch {
    // Fallback below
  }
  return YSP_COMMITTEES;
}

export async function getCommitteeTasks(committeeId: string): Promise<OrganizationalTask[]> {
  const response = await fetchFromGAS<OrganizationalTask[]>({
    action: "getCommitteeTasks",
    committeeId,
  });

  if (!response.success) {
    throw new Error(response.error || "Failed to load committee tasks");
  }

  return Array.isArray(response.data) ? response.data.map(normalizeTask) : [];
}

export async function saveOrganizationalTask(payload: SaveOrganizationalTaskPayload): Promise<OrganizationalTask> {
  const response = await postToGAS<OrganizationalTask>({
    action: "saveTask",
    ...payload,
  });

  if (!response.success || !response.data) {
    throw new Error(response.error || "Failed to save task");
  }

  return normalizeTask(response.data);
}

export async function deleteOrganizationalTask(taskId: string, username?: string): Promise<void> {
  const response = await postToGAS({
    action: "deleteTask",
    taskId,
    username: username || "",
  });

  if (!response.success) {
    throw new Error(response.error || "Failed to delete task");
  }
}
