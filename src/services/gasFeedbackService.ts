/// <reference types="vite/client" />

import { getSessionToken, refreshSessionToken } from './gasLoginService';

export interface Feedback {
  id: string; // Feedback ID (unique)
  timestamp: string; // Timestamp
  author: string; // Author name
  authorId: string; // Author ID Code
  feedback: string; // Feedback text
  replyTimestamp?: string; // Reply Timestamp
  replier?: string; // Replier name
  replierId?: string; // Replier ID (hidden)
  reply?: string; // Reply text
  anonymous: boolean; // Anonymous toggle
  category: 'Complaint' | 'Suggestion' | 'Bug' | 'Compliment' | 'Inquiry' | 'Confession' | 'Feature Request' | 'General Question' | 'Privacy Concern' | 'Report Issue' | 'Appreciation' | 'Testimonial' | 'Other';
  imageUrl?: string; // Image URL
  status: 'Pending' | 'Reviewed' | 'Resolved' | 'Dropped';
  visibility: 'Public' | 'Private';
  notes?: string; // Internal notes (hidden from user)
  email?: string; // Email (optional)
  rating: number; // 1-5 stars
}

export interface FeedbackResponse<T> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
  id?: string;
  code?: number;
}

const GAS_FEEDBACK_API_URL = import.meta.env.VITE_GAS_FEEDBACK_API_URL || '';
const GAS_API_KEY = import.meta.env.VITE_GAS_API_KEY || '';

export const FeedbackErrorCodes = {
  NETWORK_ERROR: 1001,
  API_ERROR: 1002,
  NOT_CONFIGURED: 1003,
  UNAUTHORIZED: 1005,
} as const;

export class FeedbackAPIError extends Error {
  constructor(
    message: string,
    public code: number = FeedbackErrorCodes.API_ERROR,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'FeedbackAPIError';
  }
}

function normalizeFeedbackErrorCode(code?: number): number {
  if (code === 401) return FeedbackErrorCodes.UNAUTHORIZED;
  return code || FeedbackErrorCodes.API_ERROR;
}

async function callFeedbackAPI<T>(
  action: string,
  data: Record<string, unknown> = {},
  signal?: AbortSignal,
  allowRefreshRetry = true
): Promise<FeedbackResponse<T>> {
  if (!GAS_FEEDBACK_API_URL) {
    throw new FeedbackAPIError(
      'Feedback API URL not configured',
      FeedbackErrorCodes.NOT_CONFIGURED
    );
  }

  try {
    if (allowRefreshRetry) {
      await refreshSessionToken(false);
    }

    let response: Response;
    
    if (action === 'getFeedbacks' || action === 'initiate') {
      const url = new URL(GAS_FEEDBACK_API_URL);
      url.searchParams.append('action', action);
      const sessionToken = getSessionToken();
      if (sessionToken) {
        url.searchParams.append('sessionToken', sessionToken);
      }

      response = await fetch(url.toString(), {
        method: 'GET',
        signal,
      });
    } else {
      // POST requests
      response = await fetch(GAS_FEEDBACK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          action,
          ...data,
          key: GAS_API_KEY,
          sessionToken: getSessionToken(),
        }),
        signal,
      });
    }

    if (!response.ok) {
      if (allowRefreshRetry && response.status === 401) {
        const nextToken = await refreshSessionToken(true);
        if (nextToken) {
          return callFeedbackAPI(action, data, signal, false);
        }
      }
      throw new FeedbackAPIError(
        `HTTP error: ${response.status}`,
        normalizeFeedbackErrorCode(response.status)
      );
    }

    const result: FeedbackResponse<T> = await response.json();
    
    if (result.status === 'error') {
      const errorCode = normalizeFeedbackErrorCode(result.code);
      if (allowRefreshRetry && errorCode === FeedbackErrorCodes.UNAUTHORIZED) {
        const nextToken = await refreshSessionToken(true);
        if (nextToken) {
          return callFeedbackAPI(action, data, signal, false);
        }
      }
      throw new FeedbackAPIError(
        result.message || 'Unknown API error',
        errorCode
      );
    }

    return result;
  } catch (error) {
    console.error('[FeedbackService] API Error:', error);
    if (error instanceof FeedbackAPIError) {
      throw error;
    }
    throw new FeedbackAPIError(
      error instanceof Error ? error.message : 'Network error',
      FeedbackErrorCodes.NETWORK_ERROR,
      error
    );
  }
}

/**
 * Fetch all feedbacks from the backend
 */
export async function getFeedbacks(): Promise<Feedback[]> {
  const result = await callFeedbackAPI<Feedback[]>('getFeedbacks');
  return result.data || [];
}

/**
 * Create a new feedback
 */
export async function createFeedback(feedback: Feedback): Promise<{ id: string; message: string }> {
  const result = await callFeedbackAPI<{ id: string; message: string }>(
    'createFeedback',
    { feedbackData: feedback }
  );
  return { id: result.id || feedback.id, message: result.message || 'Success' };
}

/**
 * Update an existing feedback
 */
export async function updateFeedback(feedback: Feedback): Promise<{ message: string }> {
  const result = await callFeedbackAPI<{ message: string }>(
    'updateFeedback',
    { feedbackData: feedback }
  );
  return { message: result.message || 'Success' };
}

/**
 * Delete a feedback by ID
 */
export async function deleteFeedback(feedbackId: string): Promise<{ message: string }> {
  const result = await callFeedbackAPI<{ message: string }>(
    'deleteFeedback',
    { feedbackId }
  );
  return { message: result.message || 'Success' };
}

/**
 * Initiate the feedback sheets (Admin only/Setup)
 */
export async function initiateFeedbackSheets(): Promise<{ message: string }> {
  const result = await callFeedbackAPI<{ message: string }>('initiate');
  return { message: result.message || 'Success' };
}

/**
 * Upload image to Google Drive via backend
 */
export async function uploadFeedbackImage(
  file: File,
  signal?: AbortSignal,
  allowRefreshRetry = true
): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  try {
    if (allowRefreshRetry) {
      await refreshSessionToken(false);
    }

    if (signal?.aborted) {
      return { success: false, error: 'Operation cancelled' };
    }

    // Validate file
    if (!file.type.startsWith('image/')) {
      return {
        success: false,
        error: 'Only image files are allowed'
      };
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      return {
        success: false,
        error: 'Image must be smaller than 5MB'
      };
    }

    // Convert file to base64
    const base64Data = await fileToBase64(file, signal);

    if (signal?.aborted) {
      return { success: false, error: 'Operation cancelled' };
    }

    // Use text/plain to avoid CORS preflight (simple request)
    const response = await fetch(GAS_FEEDBACK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'uploadImage',
        fileName: file.name,
        fileData: base64Data,
        key: GAS_API_KEY,
        sessionToken: getSessionToken()
      }),
      signal,
    });

    if (!response.ok) {
      if (allowRefreshRetry && response.status === 401) {
        const nextToken = await refreshSessionToken(true);
        if (nextToken) {
          return uploadFeedbackImage(file, signal, false);
        }
      }
      return {
        success: false,
        error: response.status === 401 ? 'Invalid or expired session token' : `Upload failed (${response.status})`
      };
    }

    const data = await response.json();

    if (allowRefreshRetry && data?.code === 401) {
      const nextToken = await refreshSessionToken(true);
      if (nextToken) {
        return uploadFeedbackImage(file, signal, false);
      }
    }

    if (data.status === 'success') {
      return {
        success: true,
        imageUrl: data.imageUrl
      };
    }

    return {
      success: false,
      error: data.message || 'Failed to upload image'
    };

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: 'Operation cancelled' };
    }
    console.error('[Feedback] Upload error:', error);
    return {
      success: false,
      error: 'Error uploading image'
    };
  }
}

/**
 * Convert file to base64
 */
function fileToBase64(file: File, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    if (signal) {
      if (signal.aborted) {
        reader.abort();
        reject(new DOMException('Operation cancelled', 'AbortError'));
        return;
      }
      const onAbort = () => {
        reader.abort();
        reject(new DOMException('Operation cancelled', 'AbortError'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
      reader.onloadend = () => {
        signal.removeEventListener('abort', onAbort);
      };
    }
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
