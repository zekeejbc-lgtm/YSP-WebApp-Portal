/// <reference types="vite/client" />

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
  category: 'Complaint' | 'Suggestion' | 'Bug' | 'Compliment' | 'Inquiry' | 'Confession' | 'Other';
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
}

const GAS_FEEDBACK_API_URL = "https://script.google.com/macros/s/AKfycbxRhzJaZBgrg6KKabNlp7YTqNlA_IDtVWxWCkU4atpKtoWHc-M-GkKxs0FWBdkZ15U6/exec";

export class FeedbackAPIError extends Error {
  constructor(message: string, public originalError?: unknown) {
    super(message);
    this.name = 'FeedbackAPIError';
  }
}

async function callFeedbackAPI<T>(
  action: string,
  data: Record<string, unknown> = {},
  signal?: AbortSignal
): Promise<FeedbackResponse<T>> {
  if (!GAS_FEEDBACK_API_URL) {
    throw new FeedbackAPIError('Feedback API URL not configured');
  }

  try {
    // For GET requests like 'getFeedbacks' and 'initiate', we use POST with action in body
    // because GAS often handles everything in doPost easier for JSON payloads, 
    // OR we can use URL parameters for GET.
    // The backend I wrote handles 'doGet' for 'getFeedbacks' and 'initiate', 
    // and 'doPost' for 'createFeedback' and 'updateFeedback'.
    
    let response: Response;
    
    if (action === 'getFeedbacks' || action === 'initiate') {
      const url = new URL(GAS_FEEDBACK_API_URL);
      url.searchParams.append('action', action);
      
      response = await fetch(url.toString(), {
        method: 'GET',
        signal,
      });
    } else {
      // POST requests
      response = await fetch(GAS_FEEDBACK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8', // GAS requires text/plain to avoid CORS preflight issues sometimes, or handle OPTIONS.
        },
        body: JSON.stringify({ action, ...data }),
        signal,
      });
    }

    if (!response.ok) {
      throw new FeedbackAPIError(`HTTP error: ${response.status}`);
    }

    const result: FeedbackResponse<T> = await response.json();
    
    if (result.status === 'error') {
      throw new FeedbackAPIError(result.message || 'Unknown API error');
    }

    return result;
  } catch (error) {
    console.error('[FeedbackService] API Error:', error);
    if (error instanceof FeedbackAPIError) {
      throw error;
    }
    throw new FeedbackAPIError(
      error instanceof Error ? error.message : 'Network error',
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
  signal?: AbortSignal
): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  try {
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
        fileData: base64Data
      }),
      signal,
    });

    const data = await response.json();

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
