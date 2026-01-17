/**
 * Google Apps Script Login Service
 * Handles user authentication against GAS Spreadsheet Backend
 * 
 * Sheet: User Profiles
 * Columns: Username, Email Address, Password (hashed), Full name, Position, Status, ID Code, etc.
 */

/// <reference types="vite/client" />

// =================== TYPES ===================

export interface LoginUser {
  id: string;
  username: string;
  email: string;
  name: string;
  role: 'auditor' | 'admin' | 'head' | 'member' | 'suspended' | 'banned' | 'guest';
  status: string;
  position: string;
  profilePic: string;
  sessionToken: string;
}

export interface LoginResponse {
  success: boolean;
  user?: LoginUser;
  error?: string;
  code?: number;
}

export interface SessionVerifyResponse {
  valid: boolean;
  timestamp: string;
}

// User Profile interface matching the backend data
export interface UserProfile {
  // Personal Info
  fullName: string;
  username: string;
  email: string;
  personalEmail: string;
  contactNumber: string;
  birthday: string;
  age: number;
  gender: string;
  pronouns: string;
  
  // Identity
  idCode: string;
  civilStatus: string;
  religion: string;
  nationality: string;
  
  // Address
  address: string;
  barangay: string;
  city: string;
  province: string;
  zipCode: string;
  
  // YSP Information
  chapter: string;
  committee: string;
  dateJoined: string;
  membershipType: string;
  position: string;
  role: string;
  status: string;
  
  // Social Media
  facebook: string;
  instagram: string;
  twitter: string;
  
  // Emergency Contact
  emergencyContactName: string;
  emergencyContactRelation: string;
  emergencyContactNumber: string;
  
  // Profile Picture
  profilePictureURL: string;
}

export interface ProfileResponse {
  success: boolean;
  profile?: UserProfile;
  error?: string;
  code?: number;
}

export interface ProfileUpdateResponse {
  success: boolean;
  message?: string;
  updatedCount?: number;
  skippedFields?: string[];
  notFoundFields?: string[];
  error?: string;
  code?: number;
}

// =================== CONFIGURATION ===================

const LOGIN_CONFIG = {
  // Replace with your deployed GAS Web App URL for login
  // Deploy as: Execute as "Me", Who has access: "Anyone"
  API_URL: import.meta.env.VITE_GAS_LOGIN_API_URL || '',
  
  // Timeout for API calls (in milliseconds)
  TIMEOUT: 15000,
  
  // Session storage key
  SESSION_KEY: 'ysp_session',
  USER_KEY: 'ysp_user',
};

// =================== ERROR HANDLING ===================

export class LoginAPIError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'LoginAPIError';
  }
}

export const LoginErrorCodes = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_BANNED: 'ACCOUNT_BANNED',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  SERVER_ERROR: 'SERVER_ERROR',
  NO_API_URL: 'NO_API_URL',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
} as const;

// =================== API FUNCTIONS ===================

/**
 * Authenticate user with username/email and password
 * @param username - Username or email
 * @param password - Plain text password (will be hashed server-side)
 * @returns Promise<LoginResponse>
 */
export async function authenticateUser(
  username: string,
  password: string
): Promise<LoginResponse> {
  // Check if API URL is configured
  if (!LOGIN_CONFIG.API_URL) {
    console.warn('Login API URL not configured. Please set VITE_GAS_LOGIN_API_URL environment variable.');
    throw new LoginAPIError(
      'Login service not configured',
      LoginErrorCodes.NO_API_URL
    );
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LOGIN_CONFIG.TIMEOUT);

    const response = await fetch(LOGIN_CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain', // GAS requires text/plain for CORS
      },
      body: JSON.stringify({
        action: 'login',
        username: username.trim(),
        password: password,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new LoginAPIError(
        `Server responded with status ${response.status}`,
        LoginErrorCodes.SERVER_ERROR,
        response.status
      );
    }

    const data: LoginResponse = await response.json();

    if (!data.success) {
      // Handle specific error codes
      if (data.code === 401) {
        throw new LoginAPIError(
          data.error || 'Invalid username or password',
          LoginErrorCodes.INVALID_CREDENTIALS,
          401
        );
      }
      if (data.code === 403) {
        throw new LoginAPIError(
          data.error || 'Account access denied',
          LoginErrorCodes.ACCOUNT_BANNED,
          403
        );
      }
      throw new LoginAPIError(
        data.error || 'Authentication failed',
        LoginErrorCodes.SERVER_ERROR,
        data.code
      );
    }

    // Store session on successful login
    if (data.user) {
      storeSession(data.user);
    }

    return data;

  } catch (error) {
    if (error instanceof LoginAPIError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new LoginAPIError(
          'Login request timed out. Please try again.',
          LoginErrorCodes.TIMEOUT_ERROR
        );
      }
      throw new LoginAPIError(
        error.message || 'Network error occurred',
        LoginErrorCodes.NETWORK_ERROR
      );
    }

    throw new LoginAPIError(
      'An unexpected error occurred',
      LoginErrorCodes.SERVER_ERROR
    );
  }
}

/**
 * Check if API is configured and reachable
 * @returns Promise<boolean>
 */
export async function checkLoginApiHealth(): Promise<boolean> {
  if (!LOGIN_CONFIG.API_URL) {
    return false;
  }

  try {
    const response = await fetch(`${LOGIN_CONFIG.API_URL}?action=health`, {
      method: 'GET',
    });
    const data = await response.json();
    return data.status === 'healthy';
  } catch {
    return false;
  }
}

// =================== PROFILE API FUNCTIONS ===================

/**
 * Fetch user profile from backend
 * @param username - Username to fetch profile for
 * @returns Promise<ProfileResponse>
 */
export async function fetchUserProfile(
  username: string,
  signal?: AbortSignal
): Promise<ProfileResponse> {
  if (!LOGIN_CONFIG.API_URL) {
    throw new LoginAPIError(
      'Login service not configured',
      LoginErrorCodes.NO_API_URL
    );
  }

  if (!username) {
    throw new LoginAPIError(
      'Username is required',
      LoginErrorCodes.INVALID_RESPONSE
    );
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LOGIN_CONFIG.TIMEOUT);
    const onExternalAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) {
        controller.abort();
      } else {
        signal.addEventListener('abort', onExternalAbort, { once: true });
      }
    }

    const response = await fetch(LOGIN_CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify({
        action: 'getProfile',
        username: username.trim(),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (signal) {
      signal.removeEventListener('abort', onExternalAbort);
    }

    if (!response.ok) {
      throw new LoginAPIError(
        `Server responded with status ${response.status}`,
        LoginErrorCodes.SERVER_ERROR,
        response.status
      );
    }

    const data: ProfileResponse = await response.json();

    if (!data.success) {
      throw new LoginAPIError(
        data.error || 'Failed to fetch profile',
        LoginErrorCodes.SERVER_ERROR,
        data.code
      );
    }

    return data;

  } catch (error) {
    if (error instanceof LoginAPIError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new LoginAPIError(
          'Request timed out. Please try again.',
          LoginErrorCodes.TIMEOUT_ERROR
        );
      }
      throw new LoginAPIError(
        error.message || 'Network error occurred',
        LoginErrorCodes.NETWORK_ERROR
      );
    }

    throw new LoginAPIError(
      'An unexpected error occurred',
      LoginErrorCodes.SERVER_ERROR
    );
  }
}

/**
 * Update user profile on backend
 * @param username - Username to update
 * @param profileData - Partial profile data to update
 * @returns Promise<ProfileUpdateResponse>
 */
export async function updateUserProfile(
  username: string,
  profileData: Partial<UserProfile>,
  signal?: AbortSignal
): Promise<ProfileUpdateResponse> {
  if (!LOGIN_CONFIG.API_URL) {
    throw new LoginAPIError(
      'Login service not configured',
      LoginErrorCodes.NO_API_URL
    );
  }

  if (!username) {
    throw new LoginAPIError(
      'Username is required',
      LoginErrorCodes.INVALID_RESPONSE
    );
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LOGIN_CONFIG.TIMEOUT);
    const onExternalAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) {
        controller.abort();
      } else {
        signal.addEventListener('abort', onExternalAbort, { once: true });
      }
    }

    const response = await fetch(LOGIN_CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify({
        action: 'updateProfile',
        username: username.trim(),
        profileData: profileData,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (signal) {
      signal.removeEventListener('abort', onExternalAbort);
    }

    if (!response.ok) {
      throw new LoginAPIError(
        `Server responded with status ${response.status}`,
        LoginErrorCodes.SERVER_ERROR,
        response.status
      );
    }

    const data: ProfileUpdateResponse = await response.json();

    if (!data.success) {
      throw new LoginAPIError(
        data.error || 'Failed to update profile',
        LoginErrorCodes.SERVER_ERROR,
        data.code
      );
    }

    return data;

  } catch (error) {
    if (signal) {
      signal.removeEventListener('abort', onExternalAbort);
    }
    if (error instanceof LoginAPIError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new LoginAPIError(
          'Request timed out. Please try again.',
          LoginErrorCodes.TIMEOUT_ERROR
        );
      }
      throw new LoginAPIError(
        error.message || 'Network error occurred',
        LoginErrorCodes.NETWORK_ERROR
      );
    }

    throw new LoginAPIError(
      'An unexpected error occurred',
      LoginErrorCodes.SERVER_ERROR
    );
  }
}

/**
 * Update user profile on backend as an admin/auditor
 * @param username - Username to update
 * @param profileData - Partial profile data to update
 * @param adminUsername - Admin/auditor username performing the update
 * @returns Promise<ProfileUpdateResponse>
 */
export async function updateUserProfileAsAdmin(
  username: string,
  profileData: Partial<UserProfile>,
  adminUsername: string,
  signal?: AbortSignal
): Promise<ProfileUpdateResponse> {
  if (!LOGIN_CONFIG.API_URL) {
    throw new LoginAPIError(
      'Login service not configured',
      LoginErrorCodes.NO_API_URL
    );
  }

  if (!username) {
    throw new LoginAPIError(
      'Username is required',
      LoginErrorCodes.INVALID_RESPONSE
    );
  }

  if (!adminUsername) {
    throw new LoginAPIError(
      'Admin username is required',
      LoginErrorCodes.INVALID_RESPONSE
    );
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LOGIN_CONFIG.TIMEOUT);
    const onExternalAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) {
        controller.abort();
      } else {
        signal.addEventListener('abort', onExternalAbort, { once: true });
      }
    }

    const response = await fetch(LOGIN_CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify({
        action: 'updateProfile',
        username: username.trim(),
        adminUsername: adminUsername.trim(),
        profileData: profileData,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (signal) {
      signal.removeEventListener('abort', onExternalAbort);
    }

    if (!response.ok) {
      throw new LoginAPIError(
        `Server responded with status ${response.status}`,
        LoginErrorCodes.SERVER_ERROR,
        response.status
      );
    }

    const data: ProfileUpdateResponse = await response.json();

    if (!data.success) {
      throw new LoginAPIError(
        data.error || 'Failed to update profile',
        LoginErrorCodes.SERVER_ERROR,
        data.code
      );
    }

    return data;

  } catch (error) {
    if (signal) {
      signal.removeEventListener('abort', onExternalAbort);
    }
    if (error instanceof LoginAPIError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new LoginAPIError(
          'Request timed out. Please try again.',
          LoginErrorCodes.TIMEOUT_ERROR
        );
      }
      throw new LoginAPIError(
        error.message || 'Network error occurred',
        LoginErrorCodes.NETWORK_ERROR
      );
    }

    throw new LoginAPIError(
      'An unexpected error occurred',
      LoginErrorCodes.SERVER_ERROR
    );
  }
}

// =================== PROFILE PICTURE UPLOAD ===================

export interface ProfilePictureUploadResponse {
  success: boolean;
  imageUrl?: string;
  fileName?: string;
  fileId?: string;
  message?: string;
  error?: string;
  code?: number;
}

/**
 * Upload profile picture to Google Drive via backend
 * @param file - Image file to upload
 * @param username - Username to associate with the image
 * @returns Promise<ProfilePictureUploadResponse>
 */
export async function uploadProfilePicture(
  file: File,
  username: string,
  signal?: AbortSignal
): Promise<ProfilePictureUploadResponse> {
  if (!LOGIN_CONFIG.API_URL) {
    throw new LoginAPIError(
      'Login service not configured',
      LoginErrorCodes.NO_API_URL
    );
  }

  if (!username) {
    throw new LoginAPIError(
      'Username is required',
      LoginErrorCodes.INVALID_RESPONSE
    );
  }

  // Validate file type
  const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    return {
      success: false,
      error: 'Invalid file type. Please use JPG, PNG, or WebP.',
    };
  }

  // Validate file size (max 5MB)
  const MAX_SIZE = 5 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return {
      success: false,
      error: 'File size must be less than 5MB',
    };
  }

  try {
    // Convert file to base64
    const base64Image = await fileToBase64(file, signal);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout for uploads
    const onExternalAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) {
        controller.abort();
      } else {
        signal.addEventListener('abort', onExternalAbort, { once: true });
      }
    }

    // Use text/plain to avoid CORS preflight
    const response = await fetch(LOGIN_CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify({
        action: 'uploadProfilePicture',
        username: username.trim(),
        base64Image: base64Image,
        fileName: file.name,
        mimeType: file.type,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (signal) {
      signal.removeEventListener('abort', onExternalAbort);
    }

    if (!response.ok) {
      throw new LoginAPIError(
        `Server responded with status ${response.status}`,
        LoginErrorCodes.SERVER_ERROR,
        response.status
      );
    }

    const data: ProfilePictureUploadResponse = await response.json();

    if (!data.success) {
      return {
        success: false,
        error: data.error || 'Failed to upload profile picture',
      };
    }

    return data;

  } catch (error) {
    if (error instanceof LoginAPIError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Upload timed out. Please try again.',
        };
      }
      return {
        success: false,
        error: error.message || 'Network error occurred',
      };
    }

    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}

/**
 * Convert file to base64 string
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
      // Return full data URL (includes data:image/xxx;base64,)
      resolve(reader.result as string);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// =================== SESSION MANAGEMENT ===================

/**
 * Store user session in localStorage
 * @param user - User data to store
 */
export function storeSession(user: LoginUser): void {
  try {
    localStorage.setItem(LOGIN_CONFIG.SESSION_KEY, user.sessionToken);
    localStorage.setItem(LOGIN_CONFIG.USER_KEY, JSON.stringify(user));
  } catch (error) {
    console.error('Failed to store session:', error);
  }
}

/**
 * Get stored session token
 * @returns Session token or null
 */
export function getSessionToken(): string | null {
  try {
    return localStorage.getItem(LOGIN_CONFIG.SESSION_KEY);
  } catch {
    return null;
  }
}

/**
 * Get stored user data
 * @returns User data or null
 */
export function getStoredUser(): LoginUser | null {
  try {
    const userData = localStorage.getItem(LOGIN_CONFIG.USER_KEY);
    if (userData) {
      return JSON.parse(userData) as LoginUser;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Clear session data (logout)
 */
export function clearSession(): void {
  try {
    localStorage.removeItem(LOGIN_CONFIG.SESSION_KEY);
    localStorage.removeItem(LOGIN_CONFIG.USER_KEY);
  } catch (error) {
    console.error('Failed to clear session:', error);
  }
}

/**
 * Check if user has an active session
 * @returns boolean
 */
export function hasActiveSession(): boolean {
  const token = getSessionToken();
  const user = getStoredUser();
  return !!(token && user);
}

/**
 * Verify session with backend (optional - for enhanced security)
 * @returns Promise<boolean>
 */
export async function verifySession(): Promise<boolean> {
  const token = getSessionToken();
  if (!token || !LOGIN_CONFIG.API_URL) {
    return false;
  }

  try {
    const response = await fetch(LOGIN_CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify({
        action: 'verifySession',
        sessionToken: token,
      }),
    });

    const data: SessionVerifyResponse = await response.json();
    return data.valid;
  } catch {
    return false;
  }
}

// =================== ROLE HELPERS ===================

/**
 * Get role display name
 * @param role - Role identifier
 * @returns Display name
 */
export function getRoleDisplayName(role: LoginUser['role']): string {
  const roleNames: Record<LoginUser['role'], string> = {
    auditor: 'Auditor',
    admin: 'Administrator',
    head: 'Committee Head',
    member: 'Member',
    suspended: 'Suspended',
    banned: 'Banned',
    guest: 'Guest',
  };
  return roleNames[role] || 'Unknown';
}

/**
 * Check if role has admin privileges
 * @param role - Role to check
 * @returns boolean
 */
export function hasAdminAccess(role: LoginUser['role']): boolean {
  return ['auditor', 'admin'].includes(role);
}

/**
 * Check if role has leadership privileges (admin + head)
 * @param role - Role to check
 * @returns boolean
 */
export function hasLeadershipAccess(role: LoginUser['role']): boolean {
  return ['auditor', 'admin', 'head'].includes(role);
}

/**
 * Check if account is restricted
 * @param role - Role to check
 * @returns boolean
 */
export function isRestricted(role: LoginUser['role']): boolean {
  return ['suspended', 'banned'].includes(role);
}

// =================== PASSWORD MANAGEMENT ===================

/**
 * Verify user's current password
 * @param username - Username to verify
 * @param password - Password to verify
 * @returns Promise<{ valid: boolean; error?: string }>
 */
export async function verifyPassword(
  username: string,
  password: string,
  signal?: AbortSignal
): Promise<{ valid: boolean; error?: string }> {
  if (!LOGIN_CONFIG.API_URL) {
    console.error('GAS Login API URL not configured');
    return { valid: false, error: 'API not configured' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LOGIN_CONFIG.TIMEOUT);
    const onExternalAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) {
        controller.abort();
      } else {
        signal.addEventListener('abort', onExternalAbort, { once: true });
      }
    }

    const response = await fetch(LOGIN_CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify({
        action: 'verifyPassword',
        username,
        password,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (signal) {
      signal.removeEventListener('abort', onExternalAbort);
    }

    if (!response.ok) {
      return { valid: false, error: 'Server error' };
    }

    const data = await response.json();
    
    if (data.success && data.valid) {
      return { valid: true };
    } else {
      return { valid: false, error: data.error || 'Incorrect password' };
    }
  } catch (error) {
    console.error('verifyPassword Error:', error);
    if (signal) {
      signal.removeEventListener('abort', onExternalAbort);
    }
    if (error instanceof Error && error.name === 'AbortError') {
      return { valid: false, error: 'Request timed out' };
    }
    return { valid: false, error: 'Network error' };
  }
}

/**
 * Change user's password
 * @param username - Username
 * @param currentPassword - Current password for verification
 * @param newPassword - New password to set
 * @returns Promise<{ success: boolean; error?: string }>
 */
export async function changePassword(
  username: string,
  currentPassword: string,
  newPassword: string,
  signal?: AbortSignal
): Promise<{ success: boolean; error?: string }> {
  if (!LOGIN_CONFIG.API_URL) {
    console.error('GAS Login API URL not configured');
    return { success: false, error: 'API not configured' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LOGIN_CONFIG.TIMEOUT);
    const onExternalAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) {
        controller.abort();
      } else {
        signal.addEventListener('abort', onExternalAbort, { once: true });
      }
    }

    const response = await fetch(LOGIN_CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify({
        action: 'changePassword',
        username,
        currentPassword,
        newPassword,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (signal) {
      signal.removeEventListener('abort', onExternalAbort);
    }

    if (!response.ok) {
      return { success: false, error: 'Server error' };
    }

    const data = await response.json();
    
    if (data.success) {
      return { success: true };
    } else {
      return { success: false, error: data.error || 'Failed to change password' };
    }
  } catch (error) {
    console.error('changePassword Error:', error);
    if (signal) {
      signal.removeEventListener('abort', onExternalAbort);
    }
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: 'Request timed out' };
    }
    return { success: false, error: 'Network error' };
  }
}

// =================== EMAIL VERIFICATION ===================

export interface SendOTPResponse {
  success: boolean;
  message?: string;
  expiresInMinutes?: number;
  error?: string;
}

export interface VerifyOTPResponse {
  success: boolean;
  verified?: boolean;
  message?: string;
  error?: string;
}

export interface CheckEmailVerifiedResponse {
  success: boolean;
  verified?: boolean;
  verifiedEmail?: string;
  error?: string;
}

// =================== PASSWORD RESET ===================

export interface PasswordResetLookupResponse {
  success: boolean;
  user?: {
    fullName: string;
    username: string;
    email: string;
    idCode?: string;
  };
  matchedBy?: 'email' | 'username' | 'fullName';
  error?: string;
}

export interface PasswordResetVerifyResponse {
  success: boolean;
  verified?: boolean;
  resetToken?: string;
  message?: string;
  error?: string;
}

/**
 * Send OTP verification email
 * @param username - Username requesting verification
 * @param email - Email address to verify
 * @returns Promise<SendOTPResponse>
 */
export async function sendVerificationOTP(
  username: string,
  email: string,
  signal?: AbortSignal
): Promise<SendOTPResponse> {
  if (!LOGIN_CONFIG.API_URL) {
    return { success: false, error: 'Service not configured' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LOGIN_CONFIG.TIMEOUT);
    const onExternalAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) {
        controller.abort();
      } else {
        signal.addEventListener('abort', onExternalAbort, { once: true });
      }
    }

    const response = await fetch(LOGIN_CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify({
        action: 'sendVerificationOTP',
        username: username.trim(),
        email: email.trim(),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (signal) {
      signal.removeEventListener('abort', onExternalAbort);
    }

    if (!response.ok) {
      return { success: false, error: 'Server error' };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('sendVerificationOTP Error:', error);
    if (signal) {
      signal.removeEventListener('abort', onExternalAbort);
    }
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: 'Request timed out' };
    }
    return { success: false, error: 'Network error' };
  }
}

/**
 * Verify OTP code
 * @param username - Username verifying email
 * @param email - Email being verified
 * @param otp - OTP code entered by user
 * @returns Promise<VerifyOTPResponse>
 */
export async function verifyOTP(
  username: string,
  email: string,
  otp: string,
  signal?: AbortSignal
): Promise<VerifyOTPResponse> {
  if (!LOGIN_CONFIG.API_URL) {
    return { success: false, error: 'Service not configured' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LOGIN_CONFIG.TIMEOUT);
    const onExternalAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) {
        controller.abort();
      } else {
        signal.addEventListener('abort', onExternalAbort, { once: true });
      }
    }

    const response = await fetch(LOGIN_CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify({
        action: 'verifyOTP',
        username,
        email,
        otp,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (signal) {
      signal.removeEventListener('abort', onExternalAbort);
    }

    if (!response.ok) {
      return { success: false, error: 'Server error' };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('verifyOTP Error:', error);
    if (signal) {
      signal.removeEventListener('abort', onExternalAbort);
    }
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: 'Request timed out' };
    }
    return { success: false, error: 'Network error' };
  }
}

/**
 * Check if an email is verified for a user
 * @param username - Username to check
 * @param email - Email to check
 * @returns Promise<CheckEmailVerifiedResponse>
 */
export async function checkEmailVerified(
  username: string,
  email: string,
  signal?: AbortSignal
): Promise<CheckEmailVerifiedResponse> {
  if (!LOGIN_CONFIG.API_URL) {
    return { success: false, error: 'Service not configured' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LOGIN_CONFIG.TIMEOUT);
    const onExternalAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) {
        controller.abort();
      } else {
        signal.addEventListener('abort', onExternalAbort, { once: true });
      }
    }

    const response = await fetch(LOGIN_CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify({
        action: 'checkEmailVerified',
        username,
        email,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (signal) {
      signal.removeEventListener('abort', onExternalAbort);
    }

    if (!response.ok) {
      return { success: false, error: 'Server error' };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('checkEmailVerified Error:', error);
    if (signal) {
      signal.removeEventListener('abort', onExternalAbort);
    }
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: 'Request timed out' };
    }
    return { success: false, error: 'Network error' };
  }
}

/**
 * Lookup account details for password reset
 * @param identifier - Username, full name, or email
 */
export async function lookupPasswordResetUser(
  identifier: string,
  signal?: AbortSignal
): Promise<PasswordResetLookupResponse> {
  if (!LOGIN_CONFIG.API_URL) {
    return { success: false, error: 'Service not configured' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LOGIN_CONFIG.TIMEOUT);
    const onExternalAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) {
        controller.abort();
      } else {
        signal.addEventListener('abort', onExternalAbort, { once: true });
      }
    }

    const response = await fetch(LOGIN_CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify({
        action: 'lookupPasswordResetUser',
        identifier: identifier.trim(),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (signal) {
      signal.removeEventListener('abort', onExternalAbort);
    }

    if (!response.ok) {
      return { success: false, error: 'Server error' };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('lookupPasswordResetUser Error:', error);
    if (signal) {
      signal.removeEventListener('abort', onExternalAbort);
    }
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: 'Request timed out' };
    }
    return { success: false, error: 'Network error' };
  }
}

/**
 * Send password reset OTP
 */
export async function sendPasswordResetOTP(
  username: string,
  email: string,
  signal?: AbortSignal
): Promise<SendOTPResponse> {
  if (!LOGIN_CONFIG.API_URL) {
    return { success: false, error: 'Service not configured' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LOGIN_CONFIG.TIMEOUT);
    const onExternalAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) {
        controller.abort();
      } else {
        signal.addEventListener('abort', onExternalAbort, { once: true });
      }
    }

    const response = await fetch(LOGIN_CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify({
        action: 'sendPasswordResetOTP',
        username: username.trim(),
        email: email.trim(),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (signal) {
      signal.removeEventListener('abort', onExternalAbort);
    }

    if (!response.ok) {
      return { success: false, error: 'Server error' };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('sendPasswordResetOTP Error:', error);
    if (signal) {
      signal.removeEventListener('abort', onExternalAbort);
    }
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: 'Request timed out' };
    }
    return { success: false, error: 'Network error' };
  }
}

/**
 * Verify password reset OTP
 */
export async function verifyPasswordResetOTP(
  username: string,
  email: string,
  otp: string,
  signal?: AbortSignal
): Promise<PasswordResetVerifyResponse> {
  if (!LOGIN_CONFIG.API_URL) {
    return { success: false, error: 'Service not configured' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LOGIN_CONFIG.TIMEOUT);
    const onExternalAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) {
        controller.abort();
      } else {
        signal.addEventListener('abort', onExternalAbort, { once: true });
      }
    }

    const response = await fetch(LOGIN_CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify({
        action: 'verifyPasswordResetOTP',
        username,
        email,
        otp,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (signal) {
      signal.removeEventListener('abort', onExternalAbort);
    }

    if (!response.ok) {
      return { success: false, error: 'Server error' };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('verifyPasswordResetOTP Error:', error);
    if (signal) {
      signal.removeEventListener('abort', onExternalAbort);
    }
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: 'Request timed out' };
    }
    return { success: false, error: 'Network error' };
  }
}

/**
 * Reset password using a verified token
 */
export async function resetPasswordWithToken(
  username: string,
  resetToken: string,
  newPassword: string,
  signal?: AbortSignal
): Promise<{ success: boolean; error?: string }> {
  if (!LOGIN_CONFIG.API_URL) {
    return { success: false, error: 'Service not configured' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LOGIN_CONFIG.TIMEOUT);
    const onExternalAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) {
        controller.abort();
      } else {
        signal.addEventListener('abort', onExternalAbort, { once: true });
      }
    }

    const response = await fetch(LOGIN_CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify({
        action: 'resetPasswordWithToken',
        username,
        resetToken,
        newPassword,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (signal) {
      signal.removeEventListener('abort', onExternalAbort);
    }

    if (!response.ok) {
      return { success: false, error: 'Server error' };
    }

    const data = await response.json();
    if (data.success) {
      return { success: true };
    }
    return { success: false, error: data.error || 'Failed to reset password' };
  } catch (error) {
    console.error('resetPasswordWithToken Error:', error);
    if (signal) {
      signal.removeEventListener('abort', onExternalAbort);
    }
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: 'Request timed out' };
    }
    return { success: false, error: 'Network error' };
  }
}

// =================== DEFAULT EXPORT ===================

export default {
  authenticateUser,
  checkLoginApiHealth,
  fetchUserProfile,
  updateUserProfile,
  updateUserProfileAsAdmin,
  storeSession,
  getSessionToken,
  getStoredUser,
  clearSession,
  hasActiveSession,
  verifySession,
  getRoleDisplayName,
  hasAdminAccess,
  hasLeadershipAccess,
  isRestricted,
  verifyPassword,
  changePassword,
  sendVerificationOTP,
  verifyOTP,
  checkEmailVerified,
  lookupPasswordResetUser,
  sendPasswordResetOTP,
  verifyPasswordResetOTP,
  resetPasswordWithToken,
  LoginErrorCodes,
};
