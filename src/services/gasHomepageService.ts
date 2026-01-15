/**
 * Google Apps Script Homepage Service
 * Handles fetching homepage content from GAS Spreadsheet Backend
 * 
 * Sheet: Homepage_Main
 * Row 1: Headers
 * Row 2: Values
 * 
 * Columns:
 * A: Main Heading
 * B: Sub Heading
 * C: Tagline
 * D: Section Title_About Us
 * E: Content_About Us
 * F: Section Title_Our Mission
 * G: Content_Our Mission
 * H: Section Title_Our Vision
 * I: Content_Our Vision
 * J: Section Title_Our Advocacy Pillars
 * K: Content_Our Advocacy Pillars
 */

/// <reference types="vite/client" />

// Types for Homepage Content
export interface HomepageHeroContent {
  mainHeading: string;
  subHeading: string;
  tagline: string;
  loginButtonText: string;
  memberButtonText: string;
}

export interface HomepageAboutContent {
  title: string;
  content: string;
}

export interface HomepageMissionContent {
  title: string;
  content: string;
}

export interface HomepageVisionContent {
  title: string;
  content: string;
}

export interface HomepageAdvocacyPillarsContent {
  title: string;
  content: string;
}

export interface HomepageMainContent {
  hero: HomepageHeroContent;
  about: HomepageAboutContent;
  mission: HomepageMissionContent;
  vision: HomepageVisionContent;
  advocacyPillars: HomepageAdvocacyPillarsContent;
}

// GAS API Response Type
interface GASResponse {
  success: boolean;
  data?: {
    mainHeading: string;
    subHeading: string;
    tagline: string;
    aboutTitle: string;
    aboutContent: string;
    missionTitle: string;
    missionContent: string;
    visionTitle: string;
    visionContent: string;
    advocacyPillarsTitle: string;
    advocacyPillarsContent: string;
  };
  error?: string;
  timestamp?: string;
}

// Configuration
const GAS_CONFIG = {
  // Replace this with your deployed GAS Web App URL
  // Deploy as: Execute as "Me", Who has access: "Anyone"
  HOMEPAGE_API_URL: import.meta.env.VITE_GAS_HOMEPAGE_API_URL || '',
  
  // Timeout for API calls (in milliseconds)
  TIMEOUT: 10000,
  
  // Cache duration (in milliseconds) - 5 minutes
  CACHE_DURATION: 5 * 60 * 1000,
};

// Cache for homepage content
let cachedContent: HomepageMainContent | null = null;
let cacheTimestamp: number = 0;

/**
 * Error codes for debugging
 * HP001 - API URL not configured
 * HP002 - Network timeout
 * HP003 - HTTP error (non-200 response)
 * HP004 - Invalid API response format
 * HP005 - API returned error
 * HP006 - Network/fetch error
 * HP007 - Unknown error
 */
export interface GASError {
  code: string;
  message: string;
  details?: string;
}

export class HomepageAPIError extends Error {
  code: string;
  details?: string;

  constructor(code: string, message: string, details?: string) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = 'HomepageAPIError';
  }
}

/**
 * Check if cached content is still valid
 */
const isCacheValid = (): boolean => {
  if (!cachedContent) return false;
  return Date.now() - cacheTimestamp < GAS_CONFIG.CACHE_DURATION;
};

/**
 * Fetch homepage content from GAS API
 * Uses JSONP-style callback to avoid CORS issues
 * @throws HomepageAPIError with error code for debugging
 */
export const fetchHomepageContent = async (): Promise<HomepageMainContent> => {
  // Return cached content if valid
  if (isCacheValid() && cachedContent) {
    console.log('[GAS Homepage] Returning cached content');
    return cachedContent;
  }

  // Check if API URL is configured
  if (!GAS_CONFIG.HOMEPAGE_API_URL) {
    console.warn('[GAS Homepage] API URL not configured (HP001)');
    throw new HomepageAPIError(
      'HP001',
      'API URL not configured',
      'Set VITE_GAS_HOMEPAGE_API_URL in environment variables'
    );
  }

  try {
    console.log('[GAS Homepage] Fetching content from GAS...');
    console.log('[GAS Homepage] API URL:', GAS_CONFIG.HOMEPAGE_API_URL.substring(0, 50) + '...');
    
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GAS_CONFIG.TIMEOUT);

    let response: Response;
    try {
      response = await fetch(GAS_CONFIG.HOMEPAGE_API_URL, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new HomepageAPIError(
          'HP002',
          'Request timeout',
          `API did not respond within ${GAS_CONFIG.TIMEOUT}ms`
        );
      }
      throw new HomepageAPIError(
        'HP006',
        'Network error',
        fetchError.message || 'Failed to connect to API'
      );
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new HomepageAPIError(
        'HP003',
        `HTTP error ${response.status}`,
        `Server returned status ${response.status}: ${response.statusText}`
      );
    }

    let result: GASResponse;
    try {
      result = await response.json();
    } catch (parseError) {
      throw new HomepageAPIError(
        'HP004',
        'Invalid response format',
        'API did not return valid JSON'
      );
    }

    if (!result.success) {
      throw new HomepageAPIError(
        'HP005',
        'API error',
        result.error || 'API returned success: false'
      );
    }

    if (!result.data) {
      throw new HomepageAPIError(
        'HP004',
        'Invalid response format',
        'API response missing data field'
      );
    }

    // Transform GAS response to HomepageMainContent
    const content: HomepageMainContent = {
      hero: {
        mainHeading: result.data.mainHeading || 'Welcome to Youth Service Philippines',
        subHeading: result.data.subHeading || 'Tagum Chapter',
        tagline: result.data.tagline || 'Shaping the Future to a Greater Society',
        loginButtonText: 'Log In',
        memberButtonText: 'Be a Member!',
      },
      about: {
        title: result.data.aboutTitle || 'About Us',
        content: result.data.aboutContent || '',
      },
      mission: {
        title: result.data.missionTitle || 'Our Mission',
        content: result.data.missionContent || '',
      },
      vision: {
        title: result.data.visionTitle || 'Our Vision',
        content: result.data.visionContent || '',
      },
      advocacyPillars: {
        title: result.data.advocacyPillarsTitle || 'Our Advocacy Pillars',
        content: result.data.advocacyPillarsContent || '',
      },
    };

    // Update cache
    cachedContent = content;
    cacheTimestamp = Date.now();
    
    console.log('[GAS Homepage] Content fetched successfully');
    return content;

  } catch (error) {
    console.error('[GAS Homepage] Error fetching content:', error);
    
    // If it's already a HomepageAPIError, re-throw it
    if (error instanceof HomepageAPIError) {
      throw error;
    }
    
    // Wrap unknown errors
    throw new HomepageAPIError(
      'HP007',
      'Unknown error',
      error instanceof Error ? error.message : 'An unexpected error occurred'
    );
  }
};

/**
 * Fetch homepage content with fallback to defaults
 * This version catches errors and returns default content
 */
export const fetchHomepageContentSafe = async (): Promise<{
  content: HomepageMainContent;
  error?: GASError;
  fromCache?: boolean;
}> => {
  try {
    const content = await fetchHomepageContent();
    return { content, fromCache: isCacheValid() };
  } catch (error) {
    if (error instanceof HomepageAPIError) {
      console.warn(`[GAS Homepage] ${error.code}: ${error.message}`);
      
      // Return cached content if available
      if (cachedContent) {
        return {
          content: cachedContent,
          error: { code: error.code, message: error.message, details: error.details },
          fromCache: true,
        };
      }
      
      // Return default content
      return {
        content: getDefaultHomepageContent(),
        error: { code: error.code, message: error.message, details: error.details },
      };
    }
    
    // Unknown error
    return {
      content: getDefaultHomepageContent(),
      error: { code: 'HP007', message: 'Unknown error', details: String(error) },
    };
  }
};

/**
 * Update homepage content via GAS API
 * Only available for admin/auditor roles
 */
export const updateHomepageContent = async (content: HomepageMainContent): Promise<boolean> => {
  if (!GAS_CONFIG.HOMEPAGE_API_URL) {
    console.error('[GAS Homepage] API URL not configured');
    return false;
  }

  try {
    console.log('[GAS Homepage] Updating content...');
    console.log('[GAS Homepage] API URL:', GAS_CONFIG.HOMEPAGE_API_URL);

    const payload = {
      action: 'updateHomepage',
      data: {
        mainHeading: content.hero.mainHeading,
        subHeading: content.hero.subHeading,
        tagline: content.hero.tagline,
        aboutTitle: content.about.title,
        aboutContent: content.about.content,
        missionTitle: content.mission.title,
        missionContent: content.mission.content,
        visionTitle: content.vision.title,
        visionContent: content.vision.content,
        advocacyPillarsTitle: content.advocacyPillars.title,
        advocacyPillarsContent: content.advocacyPillars.content,
      },
    };

    console.log('[GAS Homepage] Payload:', JSON.stringify(payload));

    const response = await fetch(GAS_CONFIG.HOMEPAGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    console.log('[GAS Homepage] Response status:', response.status);
    console.log('[GAS Homepage] Response ok:', response.ok);

    // GAS may redirect, so check if we got a response
    const responseText = await response.text();
    console.log('[GAS Homepage] Response text:', responseText);

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[GAS Homepage] Failed to parse response:', parseError);
      // If we can't parse but got 200, it might still be successful
      if (response.ok) {
        console.log('[GAS Homepage] Response OK but not JSON, assuming success');
        cachedContent = null;
        cacheTimestamp = 0;
        return true;
      }
      throw new Error('Invalid response from server');
    }

    if (result.success) {
      // Invalidate cache so next fetch gets fresh data
      cachedContent = null;
      cacheTimestamp = 0;
      console.log('[GAS Homepage] Content updated successfully');
      return true;
    }

    throw new Error(result.error || 'Failed to update content');

  } catch (error) {
    console.error('[GAS Homepage] Error updating content:', error);
    return false;
  }
};

/**
 * Clear the content cache
 * Call this when you want to force a fresh fetch
 */
export const clearHomepageCache = (): void => {
  cachedContent = null;
  cacheTimestamp = 0;
  console.log('[GAS Homepage] Cache cleared');
};

/**
 * Get default homepage content (fallback when API is unavailable)
 */
export const getDefaultHomepageContent = (): HomepageMainContent => {
  return {
    hero: {
      mainHeading: 'Welcome to Youth Service Philippines',
      subHeading: 'Tagum Chapter',
      tagline: 'Shaping the Future to a Greater Society',
      loginButtonText: 'Log In',
      memberButtonText: 'Be a Member!',
    },
    about: {
      title: 'About Us',
      content: 'Youth Service Philippines - Tagum Chapter is a dynamic organization dedicated to mobilizing Filipino youth to actively participate in nation-building through community service and volunteerism.',
    },
    mission: {
      title: 'Our Mission',
      content: 'To inspire and empower Filipino youth in Tagum City and Davao del Norte to become active agents of positive change.',
    },
    vision: {
      title: 'Our Vision',
      content: 'A community where every young person in Tagum City and Davao del Norte is actively engaged in building strong, resilient, and compassionate communities.',
    },
    advocacyPillars: {
      title: 'Our Advocacy Pillars',
      content: 'Education • Environment • Health & Wellness • Community Development • Leadership & Civic Engagement',
    },
  };
};

/**
 * Check if the GAS API is configured and reachable
 */
export const checkHomepageApiHealth = async (): Promise<{
  configured: boolean;
  reachable: boolean;
  error?: string;
}> => {
  if (!GAS_CONFIG.HOMEPAGE_API_URL) {
    return { configured: false, reachable: false, error: 'API URL not configured' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${GAS_CONFIG.HOMEPAGE_API_URL}?action=health`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    return {
      configured: true,
      reachable: response.ok,
      error: response.ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      configured: true,
      reachable: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

// ==================== HOMEPAGE_OTHER (CONTACT SECTION) SERVICE ====================

/**
 * Types for Homepage_Other (Contact Section) Content
 */
export interface SocialLinkData {
  id: number;
  url: string;
  displayName: string;
}

export interface HomepageOtherContent {
  sectionTitle: string;
  orgChartUrl: string;
  orgEmail: string;
  orgPhone: string;
  orgLocation: string;
  orgGoogleMapUrl: string;
  partnerTitle: string;
  partnerDescription: string;
  partnerButtonText: string;
  partnerGformUrl: string;
  socialLinks: SocialLinkData[];
}

// GAS API Response Type for Homepage_Other
interface GASHomepageOtherResponse {
  success: boolean;
  data?: HomepageOtherContent;
  error?: string;
  timestamp?: string;
}

// Cache for Homepage_Other content
let cachedOtherContent: HomepageOtherContent | null = null;
let otherCacheTimestamp: number = 0;

/**
 * Check if Homepage_Other cached content is still valid
 */
const isOtherCacheValid = (): boolean => {
  if (!cachedOtherContent) return false;
  return Date.now() - otherCacheTimestamp < GAS_CONFIG.CACHE_DURATION;
};

/**
 * Invalidate the Homepage_Other cache to force fresh fetch
 */
export const invalidateOtherContentCache = (): void => {
  cachedOtherContent = null;
  otherCacheTimestamp = 0;
  console.log('[GAS Homepage_Other] Cache invalidated');
};

/**
 * Fetch Homepage_Other (Contact Section) content from GAS API
 * @throws HomepageAPIError with error code for debugging
 */
export const fetchHomepageOtherContent = async (): Promise<HomepageOtherContent> => {
  // Return cached content if valid
  if (isOtherCacheValid() && cachedOtherContent) {
    console.log('[GAS Homepage_Other] Returning cached content');
    return cachedOtherContent;
  }

  // Check if API URL is configured
  if (!GAS_CONFIG.HOMEPAGE_API_URL) {
    console.warn('[GAS Homepage_Other] API URL not configured (HO001)');
    throw new HomepageAPIError(
      'HO001',
      'API URL not configured',
      'Set VITE_GAS_HOMEPAGE_API_URL in environment variables'
    );
  }

  try {
    console.log('[GAS Homepage_Other] Fetching content from GAS...');
    
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GAS_CONFIG.TIMEOUT);

    let response: Response;
    try {
      response = await fetch(`${GAS_CONFIG.HOMEPAGE_API_URL}?action=getHomepageOther`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new HomepageAPIError(
          'HO002',
          'Request timeout',
          `API did not respond within ${GAS_CONFIG.TIMEOUT}ms`
        );
      }
      throw new HomepageAPIError(
        'HO006',
        'Network error',
        fetchError.message || 'Failed to connect to API'
      );
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new HomepageAPIError(
        'HO003',
        `HTTP error ${response.status}`,
        `Server returned status ${response.status}: ${response.statusText}`
      );
    }

    let result: GASHomepageOtherResponse;
    try {
      result = await response.json();
    } catch (parseError) {
      throw new HomepageAPIError(
        'HO004',
        'Invalid response format',
        'API did not return valid JSON'
      );
    }

    if (!result.success) {
      throw new HomepageAPIError(
        'HO005',
        'API error',
        result.error || 'API returned success: false'
      );
    }

    if (!result.data) {
      throw new HomepageAPIError(
        'HO004',
        'Invalid response format',
        'API response missing data field'
      );
    }

    // Update cache
    cachedOtherContent = result.data;
    otherCacheTimestamp = Date.now();
    
    console.log('[GAS Homepage_Other] Content fetched successfully');
    return result.data;

  } catch (error) {
    console.error('[GAS Homepage_Other] Error fetching content:', error);
    
    // If it's already a HomepageAPIError, re-throw it
    if (error instanceof HomepageAPIError) {
      throw error;
    }
    
    // Wrap unknown errors
    throw new HomepageAPIError(
      'HO007',
      'Unknown error',
      error instanceof Error ? error.message : 'An unexpected error occurred'
    );
  }
};

/**
 * Fetch Homepage_Other content with fallback to defaults
 */
export const fetchHomepageOtherContentSafe = async (): Promise<{
  content: HomepageOtherContent;
  error?: GASError;
  fromCache?: boolean;
}> => {
  try {
    const content = await fetchHomepageOtherContent();
    return { content, fromCache: isOtherCacheValid() };
  } catch (error) {
    if (error instanceof HomepageAPIError) {
      console.warn(`[GAS Homepage_Other] ${error.code}: ${error.message}`);
      
      // Return cached content if available
      if (cachedOtherContent) {
        return {
          content: cachedOtherContent,
          error: { code: error.code, message: error.message, details: error.details },
          fromCache: true,
        };
      }
      
      // Return default content
      return {
        content: getDefaultHomepageOtherContent(),
        error: { code: error.code, message: error.message, details: error.details },
      };
    }
    
    // Unknown error
    return {
      content: getDefaultHomepageOtherContent(),
      error: { code: 'HO007', message: 'Unknown error', details: String(error) },
    };
  }
};

/**
 * Get default Homepage_Other content (fallback when API is unavailable)
 */
export const getDefaultHomepageOtherContent = (): HomepageOtherContent => {
  return {
    sectionTitle: 'Get in Touch',
    orgChartUrl: '',
    orgEmail: 'YSPTagumChapter@gmail.com',
    orgPhone: '+63 917 123 4567',
    orgLocation: 'Tagum City, Davao del Norte, Philippines',
    orgGoogleMapUrl: 'https://maps.google.com/?q=Tagum+City,Davao+del+Norte,Philippines',
    partnerTitle: '🤝 Become Our Partner',
    partnerDescription: 'Join us in making a difference in our community. Partner with YSP and help us create lasting impact through collaborative projects.',
    partnerButtonText: 'Partner with Us',
    partnerGformUrl: '',
    socialLinks: [
      { id: 1, url: 'https://www.facebook.com/YSPTagumChapter', displayName: 'YSP Tagum Chapter' },
    ],
  };
};

/**
 * Update Homepage_Other (Contact Section) content via GAS API
 */
export const updateHomepageOtherContent = async (content: Partial<HomepageOtherContent>): Promise<boolean> => {
  if (!GAS_CONFIG.HOMEPAGE_API_URL) {
    console.error('[GAS Homepage_Other] API URL not configured');
    return false;
  }

  try {
    console.log('[GAS Homepage_Other] Updating content...');

    const payload = {
      action: 'updateHomepageOther',
      data: content,
    };

    const response = await fetch(GAS_CONFIG.HOMEPAGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log('[GAS Homepage_Other] Response:', responseText);

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      if (response.ok) {
        console.log('[GAS Homepage_Other] Response OK but not JSON, assuming success');
        cachedOtherContent = null;
        otherCacheTimestamp = 0;
        return true;
      }
      throw new Error('Invalid response from server');
    }

    if (result.success) {
      // Invalidate cache
      cachedOtherContent = null;
      otherCacheTimestamp = 0;
      console.log('[GAS Homepage_Other] Content updated successfully');
      return true;
    }

    throw new Error(result.error || 'Failed to update content');

  } catch (error) {
    console.error('[GAS Homepage_Other] Error updating content:', error);
    return false;
  }
};

/**
 * Upload Org Chart image via GAS API
 * Uses the same mechanism as project image uploads
 */
export const uploadOrgChart = async (file: File): Promise<{ success: boolean; imageUrl?: string; error?: string }> => {
  if (!GAS_CONFIG.HOMEPAGE_API_URL) {
    return { success: false, error: 'API URL not configured' };
  }

  try {
    // Validate file
    if (!file.type.startsWith('image/')) {
      return { success: false, error: 'Only image files are allowed' };
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit for org chart
      return { success: false, error: 'Image must be smaller than 10MB' };
    }

    // Convert file to base64
    const base64Data = await fileToBase64(file);

    console.log('[GAS Homepage_Other] Uploading org chart:', file.name, 'size:', file.size);
    console.log('[GAS Homepage_Other] API URL:', GAS_CONFIG.HOMEPAGE_API_URL);
    
    // Use text/plain to avoid CORS preflight (simple request)
    // application/json triggers OPTIONS preflight which GAS doesn't handle
    const response = await fetch(GAS_CONFIG.HOMEPAGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'uploadOrgChart',
        fileName: file.name,
        fileData: base64Data
      })
    });

    console.log('[GAS Homepage_Other] Response status:', response.status);
    
    const responseText = await response.text();
    console.log('[GAS Homepage_Other] Raw response:', responseText);
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[GAS Homepage_Other] Failed to parse response:', parseError);
      return { success: false, error: 'Invalid response from server: ' + responseText.substring(0, 100) };
    }

    console.log('[GAS Homepage_Other] Parsed response:', data);

    if (data.success) {
      // Invalidate cache
      cachedOtherContent = null;
      otherCacheTimestamp = 0;
      return { success: true, imageUrl: data.imageUrl };
    }

    return { success: false, error: data.message || data.error || 'Failed to upload org chart' };

  } catch (error) {
    console.error('[GAS Homepage_Other] Upload error:', error);
    return { success: false, error: 'Error uploading org chart: ' + (error as Error).message };
  }
};

/**
 * Add a new social link
 */
export const addSocialLink = async (url: string, displayName: string): Promise<{ success: boolean; data?: SocialLinkData; error?: string }> => {
  if (!GAS_CONFIG.HOMEPAGE_API_URL) {
    return { success: false, error: 'API URL not configured' };
  }

  try {
    const response = await fetch(GAS_CONFIG.HOMEPAGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'addSocialLink',
        data: { url, displayName },
      }),
    });

    const responseText = await response.text();
    const result = JSON.parse(responseText);

    if (result.success) {
      // Invalidate cache
      cachedOtherContent = null;
      otherCacheTimestamp = 0;
      return { success: true, data: result.data };
    }

    return { success: false, error: result.message || 'Failed to add social link' };

  } catch (error) {
    console.error('[GAS Homepage_Other] Add social link error:', error);
    return { success: false, error: 'Error adding social link' };
  }
};

/**
 * Remove a social link
 */
export const removeSocialLink = async (index: number): Promise<{ success: boolean; error?: string }> => {
  if (!GAS_CONFIG.HOMEPAGE_API_URL) {
    return { success: false, error: 'API URL not configured' };
  }

  try {
    const response = await fetch(GAS_CONFIG.HOMEPAGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'removeSocialLink',
        index,
      }),
    });

    const responseText = await response.text();
    const result = JSON.parse(responseText);

    if (result.success) {
      // Invalidate cache
      cachedOtherContent = null;
      otherCacheTimestamp = 0;
      return { success: true };
    }

    return { success: false, error: result.message || 'Failed to remove social link' };

  } catch (error) {
    console.error('[GAS Homepage_Other] Remove social link error:', error);
    return { success: false, error: 'Error removing social link' };
  }
};

/**
 * Update a social link
 */
export const updateSocialLink = async (index: number, url: string, displayName: string): Promise<{ success: boolean; error?: string }> => {
  if (!GAS_CONFIG.HOMEPAGE_API_URL) {
    return { success: false, error: 'API URL not configured' };
  }

  try {
    const response = await fetch(GAS_CONFIG.HOMEPAGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'updateSocialLink',
        index,
        data: { url, displayName },
      }),
    });

    const responseText = await response.text();
    const result = JSON.parse(responseText);

    if (result.success) {
      // Invalidate cache
      cachedOtherContent = null;
      otherCacheTimestamp = 0;
      return { success: true };
    }

    return { success: false, error: result.message || 'Failed to update social link' };

  } catch (error) {
    console.error('[GAS Homepage_Other] Update social link error:', error);
    return { success: false, error: 'Error updating social link' };
  }
};

/**
 * Clear the Homepage_Other content cache
 */
export const clearHomepageOtherCache = (): void => {
  cachedOtherContent = null;
  otherCacheTimestamp = 0;
  console.log('[GAS Homepage_Other] Cache cleared');
};

/**
 * Convert file to base64 (helper function)
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ==================== HOMEPAGE_DEV INFO (DEVELOPER PROFILE) SERVICE ====================

/**
 * Types for Homepage_Dev Info (Developer Profile) Content
 */
export interface DevAffiliationData {
  id: number;
  orgName: string;
  position: string;
}

export interface DevSocialLinkData {
  id: number;
  url: string;
}

export interface DevInfoContent {
  profileUrl: string;
  name: string;
  nickname: string;
  position: string;
  organization: string;
  about: string;
  background: string;
  devPhilosophy: string;
  email: string;
  phone: string;
  location: string;
  affiliations: DevAffiliationData[];
  socialLinks: DevSocialLinkData[];
}

// GAS API Response Type for Dev Info
interface GASDevInfoResponse {
  success: boolean;
  data?: DevInfoContent;
  error?: string;
  timestamp?: string;
}

// Cache for Dev Info content
let cachedDevInfoContent: DevInfoContent | null = null;
let devInfoCacheTimestamp: number = 0;

/**
 * Check if Dev Info cached content is still valid
 */
const isDevInfoCacheValid = (): boolean => {
  if (!cachedDevInfoContent) return false;
  return Date.now() - devInfoCacheTimestamp < GAS_CONFIG.CACHE_DURATION;
};

/**
 * Fetch Dev Info (Developer Profile) content from GAS API
 * @throws HomepageAPIError with error code for debugging
 */
export const fetchDevInfoContent = async (): Promise<DevInfoContent> => {
  // Return cached content if valid
  if (isDevInfoCacheValid() && cachedDevInfoContent) {
    console.log('[GAS DevInfo] Returning cached content');
    return cachedDevInfoContent;
  }

  // Check if API URL is configured
  if (!GAS_CONFIG.HOMEPAGE_API_URL) {
    console.warn('[GAS DevInfo] API URL not configured (DI001)');
    throw new HomepageAPIError(
      'DI001',
      'API URL not configured',
      'Set VITE_GAS_HOMEPAGE_API_URL in environment variables'
    );
  }

  try {
    console.log('[GAS DevInfo] Fetching content from GAS...');
    
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GAS_CONFIG.TIMEOUT);

    let response: Response;
    try {
      response = await fetch(`${GAS_CONFIG.HOMEPAGE_API_URL}?action=getDevInfo`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new HomepageAPIError(
          'DI002',
          'Request timeout',
          `API did not respond within ${GAS_CONFIG.TIMEOUT}ms`
        );
      }
      throw new HomepageAPIError(
        'DI006',
        'Network error',
        fetchError.message || 'Failed to connect to API'
      );
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new HomepageAPIError(
        'DI003',
        `HTTP error ${response.status}`,
        `Server returned status ${response.status}: ${response.statusText}`
      );
    }

    let result: GASDevInfoResponse;
    try {
      result = await response.json();
    } catch (parseError) {
      throw new HomepageAPIError(
        'DI004',
        'Invalid response format',
        'API did not return valid JSON'
      );
    }

    if (!result.success) {
      throw new HomepageAPIError(
        'DI005',
        'API error',
        result.error || 'API returned success: false'
      );
    }

    if (!result.data) {
      throw new HomepageAPIError(
        'DI004',
        'Invalid response format',
        'API response missing data field'
      );
    }

    // Update cache
    cachedDevInfoContent = result.data;
    devInfoCacheTimestamp = Date.now();
    
    console.log('[GAS DevInfo] Content fetched successfully');
    return result.data;

  } catch (error) {
    console.error('[GAS DevInfo] Error fetching content:', error);
    
    // If it's already a HomepageAPIError, re-throw it
    if (error instanceof HomepageAPIError) {
      throw error;
    }
    
    // Wrap unknown errors
    throw new HomepageAPIError(
      'DI007',
      'Unknown error',
      error instanceof Error ? error.message : 'An unexpected error occurred'
    );
  }
};

/**
 * Fetch Dev Info content with fallback to defaults
 */
export const fetchDevInfoContentSafe = async (): Promise<{
  content: DevInfoContent;
  error?: GASError;
  fromCache?: boolean;
}> => {
  try {
    const content = await fetchDevInfoContent();
    return { content, fromCache: isDevInfoCacheValid() };
  } catch (error) {
    if (error instanceof HomepageAPIError) {
      console.warn(`[GAS DevInfo] ${error.code}: ${error.message}`);
      
      // Return cached content if available
      if (cachedDevInfoContent) {
        return {
          content: cachedDevInfoContent,
          error: { code: error.code, message: error.message, details: error.details },
          fromCache: true,
        };
      }
      
      // Return default content
      return {
        content: getDefaultDevInfoContent(),
        error: { code: error.code, message: error.message, details: error.details },
      };
    }
    
    // Unknown error
    return {
      content: getDefaultDevInfoContent(),
      error: { code: 'DI007', message: 'Unknown error', details: String(error) },
    };
  }
};

/**
 * Get default Dev Info content (fallback when API is unavailable)
 */
export const getDefaultDevInfoContent = (): DevInfoContent => {
  return {
    profileUrl: '',
    name: '',
    nickname: '',
    position: '',
    organization: '',
    about: '',
    background: '',
    devPhilosophy: '',
    email: '',
    phone: '',
    location: '',
    affiliations: [],
    socialLinks: [],
  };
};

/**
 * Update Dev Info (Developer Profile) content via GAS API
 */
export const updateDevInfoContent = async (content: Partial<DevInfoContent>): Promise<boolean> => {
  if (!GAS_CONFIG.HOMEPAGE_API_URL) {
    console.error('[GAS DevInfo] API URL not configured');
    return false;
  }

  try {
    console.log('[GAS DevInfo] Updating content...');

    const payload = {
      action: 'updateDevInfo',
      data: content,
    };

    const response = await fetch(GAS_CONFIG.HOMEPAGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log('[GAS DevInfo] Response:', responseText);

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      if (response.ok) {
        console.log('[GAS DevInfo] Response OK but not JSON, assuming success');
        cachedDevInfoContent = null;
        devInfoCacheTimestamp = 0;
        return true;
      }
      throw new Error('Invalid response from server');
    }

    if (result.success) {
      // Invalidate cache
      cachedDevInfoContent = null;
      devInfoCacheTimestamp = 0;
      console.log('[GAS DevInfo] Content updated successfully');
      return true;
    }

    throw new Error(result.error || 'Failed to update content');

  } catch (error) {
    console.error('[GAS DevInfo] Error updating content:', error);
    return false;
  }
};

/**
 * Upload Dev Profile image via GAS API
 */
export const uploadDevProfile = async (file: File): Promise<{ success: boolean; imageUrl?: string; error?: string }> => {
  if (!GAS_CONFIG.HOMEPAGE_API_URL) {
    return { success: false, error: 'API URL not configured' };
  }

  try {
    // Validate file
    if (!file.type.startsWith('image/')) {
      return { success: false, error: 'Only image files are allowed' };
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      return { success: false, error: 'Image must be smaller than 10MB' };
    }

    // Convert file to base64
    const base64Data = await fileToBase64(file);

    console.log('[GAS DevInfo] Uploading profile image:', file.name, 'size:', file.size);
    
    const response = await fetch(GAS_CONFIG.HOMEPAGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'uploadDevProfile',
        fileName: file.name,
        fileData: base64Data
      })
    });

    console.log('[GAS DevInfo] Response status:', response.status);
    
    const responseText = await response.text();
    console.log('[GAS DevInfo] Raw response:', responseText);
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[GAS DevInfo] Failed to parse response:', parseError);
      return { success: false, error: 'Invalid response from server: ' + responseText.substring(0, 100) };
    }

    console.log('[GAS DevInfo] Parsed response:', data);

    if (data.success) {
      // Invalidate cache
      cachedDevInfoContent = null;
      devInfoCacheTimestamp = 0;
      return { success: true, imageUrl: data.imageUrl };
    }

    return { success: false, error: data.message || data.error || 'Failed to upload profile image' };

  } catch (error) {
    console.error('[GAS DevInfo] Upload error:', error);
    return { success: false, error: 'Error uploading profile image: ' + (error as Error).message };
  }
};

/**
 * Add a new affiliation
 */
export const addDevAffiliation = async (orgName: string, position: string): Promise<{ success: boolean; data?: DevAffiliationData; error?: string }> => {
  if (!GAS_CONFIG.HOMEPAGE_API_URL) {
    return { success: false, error: 'API URL not configured' };
  }

  try {
    const response = await fetch(GAS_CONFIG.HOMEPAGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'addDevAffiliation',
        data: { orgName, position },
      }),
    });

    const responseText = await response.text();
    const result = JSON.parse(responseText);

    if (result.success) {
      // Invalidate cache
      cachedDevInfoContent = null;
      devInfoCacheTimestamp = 0;
      return { success: true, data: result.data };
    }

    return { success: false, error: result.message || 'Failed to add affiliation' };

  } catch (error) {
    console.error('[GAS DevInfo] Add affiliation error:', error);
    return { success: false, error: 'Error adding affiliation' };
  }
};

/**
 * Remove an affiliation
 */
export const removeDevAffiliation = async (index: number): Promise<{ success: boolean; error?: string }> => {
  if (!GAS_CONFIG.HOMEPAGE_API_URL) {
    return { success: false, error: 'API URL not configured' };
  }

  try {
    const response = await fetch(GAS_CONFIG.HOMEPAGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'removeDevAffiliation',
        index,
      }),
    });

    const responseText = await response.text();
    const result = JSON.parse(responseText);

    if (result.success) {
      // Invalidate cache
      cachedDevInfoContent = null;
      devInfoCacheTimestamp = 0;
      return { success: true };
    }

    return { success: false, error: result.message || 'Failed to remove affiliation' };

  } catch (error) {
    console.error('[GAS DevInfo] Remove affiliation error:', error);
    return { success: false, error: 'Error removing affiliation' };
  }
};

/**
 * Update an affiliation
 */
export const updateDevAffiliation = async (index: number, orgName: string, position: string): Promise<{ success: boolean; error?: string }> => {
  if (!GAS_CONFIG.HOMEPAGE_API_URL) {
    return { success: false, error: 'API URL not configured' };
  }

  try {
    const response = await fetch(GAS_CONFIG.HOMEPAGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'updateDevAffiliation',
        index,
        data: { orgName, position },
      }),
    });

    const responseText = await response.text();
    const result = JSON.parse(responseText);

    if (result.success) {
      // Invalidate cache
      cachedDevInfoContent = null;
      devInfoCacheTimestamp = 0;
      return { success: true };
    }

    return { success: false, error: result.message || 'Failed to update affiliation' };

  } catch (error) {
    console.error('[GAS DevInfo] Update affiliation error:', error);
    return { success: false, error: 'Error updating affiliation' };
  }
};

/**
 * Add a new dev social link
 */
export const addDevSocialLink = async (url: string): Promise<{ success: boolean; data?: DevSocialLinkData; error?: string }> => {
  if (!GAS_CONFIG.HOMEPAGE_API_URL) {
    return { success: false, error: 'API URL not configured' };
  }

  try {
    const response = await fetch(GAS_CONFIG.HOMEPAGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'addDevSocialLink',
        data: { url },
      }),
    });

    const responseText = await response.text();
    const result = JSON.parse(responseText);

    if (result.success) {
      // Invalidate cache
      cachedDevInfoContent = null;
      devInfoCacheTimestamp = 0;
      return { success: true, data: result.data };
    }

    return { success: false, error: result.message || 'Failed to add social link' };

  } catch (error) {
    console.error('[GAS DevInfo] Add social link error:', error);
    return { success: false, error: 'Error adding social link' };
  }
};

/**
 * Remove a dev social link
 */
export const removeDevSocialLink = async (index: number): Promise<{ success: boolean; error?: string }> => {
  if (!GAS_CONFIG.HOMEPAGE_API_URL) {
    return { success: false, error: 'API URL not configured' };
  }

  try {
    const response = await fetch(GAS_CONFIG.HOMEPAGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'removeDevSocialLink',
        index,
      }),
    });

    const responseText = await response.text();
    const result = JSON.parse(responseText);

    if (result.success) {
      // Invalidate cache
      cachedDevInfoContent = null;
      devInfoCacheTimestamp = 0;
      return { success: true };
    }

    return { success: false, error: result.message || 'Failed to remove social link' };

  } catch (error) {
    console.error('[GAS DevInfo] Remove social link error:', error);
    return { success: false, error: 'Error removing social link' };
  }
};

/**
 * Update a dev social link
 */
export const updateDevSocialLink = async (index: number, url: string): Promise<{ success: boolean; error?: string }> => {
  if (!GAS_CONFIG.HOMEPAGE_API_URL) {
    return { success: false, error: 'API URL not configured' };
  }

  try {
    const response = await fetch(GAS_CONFIG.HOMEPAGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'updateDevSocialLink',
        index,
        data: { url },
      }),
    });

    const responseText = await response.text();
    const result = JSON.parse(responseText);

    if (result.success) {
      // Invalidate cache
      cachedDevInfoContent = null;
      devInfoCacheTimestamp = 0;
      return { success: true };
    }

    return { success: false, error: result.message || 'Failed to update social link' };

  } catch (error) {
    console.error('[GAS DevInfo] Update social link error:', error);
    return { success: false, error: 'Error updating social link' };
  }
};

/**
 * Clear the Dev Info content cache
 */
export const clearDevInfoCache = (): void => {
  cachedDevInfoContent = null;
  devInfoCacheTimestamp = 0;
  console.log('[GAS DevInfo] Cache cleared');
};


// ==================== HOMEPAGE_FOUNDER INFO (FOUNDER PROFILE) ====================

/**
 * Types for Homepage_Founder Info (Founder Profile) Content
 */
export interface FounderKeyAchievementData {
  id: number;
  achievement: string;
}

export interface FounderSocialLinkData {
  id: number;
  url: string;
}

export interface FounderInfoContent {
  profileUrl: string;
  name: string;
  nickname: string;
  position: string;
  about: string;
  background: string;
  organizationalImpact: string;
  leadershipPhilosophy: string;
  email: string;
  phone: string;
  officeLocation: string;
  keyAchievements: FounderKeyAchievementData[];
  socialLinks: FounderSocialLinkData[];
}

// GAS API Response Type for Founder Info
interface GASFounderInfoResponse {
  success: boolean;
  data?: FounderInfoContent;
  error?: string;
  timestamp?: string;
}

// Cache for Founder Info content
let cachedFounderInfoContent: FounderInfoContent | null = null;
let founderInfoCacheTimestamp: number = 0;

/**
 * Check if Founder Info cached content is still valid
 */
const isFounderInfoCacheValid = (): boolean => {
  if (!cachedFounderInfoContent) return false;
  return Date.now() - founderInfoCacheTimestamp < GAS_CONFIG.CACHE_DURATION;
};

/**
 * Fetch Founder Info (Founder Profile) content from GAS API
 * @throws HomepageAPIError with error code for debugging
 */
export const fetchFounderInfoContent = async (): Promise<FounderInfoContent> => {
  // Return cached content if valid
  if (isFounderInfoCacheValid() && cachedFounderInfoContent) {
    console.log('[GAS FounderInfo] Returning cached content');
    return cachedFounderInfoContent;
  }

  // Check if API URL is configured
  if (!GAS_CONFIG.HOMEPAGE_API_URL) {
    console.warn('[GAS FounderInfo] API URL not configured (FI001)');
    throw new HomepageAPIError(
      'FI001',
      'API URL not configured',
      'Set VITE_GAS_HOMEPAGE_API_URL in environment variables'
    );
  }

  try {
    console.log('[GAS FounderInfo] Fetching content from GAS...');
    
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GAS_CONFIG.TIMEOUT);

    let response: Response;
    try {
      response = await fetch(`${GAS_CONFIG.HOMEPAGE_API_URL}?action=getFounderInfo`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new HomepageAPIError(
          'FI002',
          'Request timeout',
          `API did not respond within ${GAS_CONFIG.TIMEOUT}ms`
        );
      }
      throw new HomepageAPIError(
        'FI006',
        'Network error',
        fetchError.message || 'Failed to connect to API'
      );
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new HomepageAPIError(
        'FI003',
        `HTTP error ${response.status}`,
        `Server returned status ${response.status}: ${response.statusText}`
      );
    }

    let result: GASFounderInfoResponse;
    try {
      result = await response.json();
    } catch (parseError) {
      throw new HomepageAPIError(
        'FI004',
        'Invalid response format',
        'API did not return valid JSON'
      );
    }

    if (!result.success) {
      throw new HomepageAPIError(
        'FI005',
        'API error',
        result.error || 'API returned success: false'
      );
    }

    if (!result.data) {
      throw new HomepageAPIError(
        'FI004',
        'Invalid response format',
        'API response missing data field'
      );
    }

    // Cache the result
    cachedFounderInfoContent = result.data;
    founderInfoCacheTimestamp = Date.now();

    console.log('[GAS FounderInfo] Content fetched successfully');
    return result.data;

  } catch (error) {
    if (error instanceof HomepageAPIError) {
      throw error;
    }
    throw new HomepageAPIError(
      'FI999',
      'Unknown error',
      error instanceof Error ? error.message : 'An unknown error occurred'
    );
  }
};

/**
 * Update Founder Info content in GAS
 */
export const updateFounderInfoContent = async (content: Partial<FounderInfoContent>): Promise<boolean> => {
  if (!GAS_CONFIG.HOMEPAGE_API_URL) {
    console.warn('[GAS FounderInfo] API URL not configured');
    return false;
  }

  try {
    console.log('[GAS FounderInfo] Updating content...');
    
    const response = await fetch(GAS_CONFIG.HOMEPAGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'updateFounderInfo',
        data: content,
      }),
    });

    const responseText = await response.text();
    const result = JSON.parse(responseText);

    if (result.success) {
      // Invalidate cache so next fetch gets fresh data
      cachedFounderInfoContent = null;
      founderInfoCacheTimestamp = 0;
      console.log('[GAS FounderInfo] Content updated successfully');
      return true;
    }

    console.error('[GAS FounderInfo] Update failed:', result.message);
    return false;

  } catch (error) {
    console.error('[GAS FounderInfo] Update error:', error);
    return false;
  }
};

/**
 * Upload Founder profile image to Google Drive via GAS
 */
export const uploadFounderProfile = async (file: File): Promise<{ success: boolean; imageUrl?: string; error?: string }> => {
  if (!GAS_CONFIG.HOMEPAGE_API_URL) {
    return { success: false, error: 'API URL not configured' };
  }

  // Validate file size (max 10MB for Drive)
  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return { success: false, error: 'File size must be less than 10MB' };
  }

  // Validate file type
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (!validTypes.includes(file.type)) {
    return { success: false, error: 'Invalid file type. Use JPG, PNG, or WebP.' };
  }

  try {
    // Convert file to base64
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    // Generate unique filename
    const timestamp = Date.now();
    const extension = file.name.split('.').pop() || 'jpg';
    const fileName = `founder_profile_${timestamp}.${extension}`;

    console.log('[GAS FounderInfo] Uploading profile image...');

    const response = await fetch(GAS_CONFIG.HOMEPAGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'uploadFounderProfile',
        fileName,
        fileData: base64Data,
      }),
    });

    const responseText = await response.text();
    const result = JSON.parse(responseText);

    if (result.success && result.imageUrl) {
      // Invalidate cache
      cachedFounderInfoContent = null;
      founderInfoCacheTimestamp = 0;
      console.log('[GAS FounderInfo] Profile image uploaded:', result.imageUrl);
      return { success: true, imageUrl: result.imageUrl };
    }

    return { success: false, error: result.message || 'Failed to upload profile image' };

  } catch (error) {
    console.error('[GAS FounderInfo] Profile upload error:', error);
    return { success: false, error: 'Error uploading profile image' };
  }
};

/**
 * Add a new key achievement
 */
export const addFounderAchievement = async (achievement: string): Promise<{ success: boolean; data?: FounderKeyAchievementData; error?: string }> => {
  if (!GAS_CONFIG.HOMEPAGE_API_URL) {
    return { success: false, error: 'API URL not configured' };
  }

  try {
    const response = await fetch(GAS_CONFIG.HOMEPAGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'addFounderAchievement',
        data: { achievement },
      }),
    });

    const responseText = await response.text();
    const result = JSON.parse(responseText);

    if (result.success) {
      // Invalidate cache
      cachedFounderInfoContent = null;
      founderInfoCacheTimestamp = 0;
      return { success: true, data: result.data };
    }

    return { success: false, error: result.message || 'Failed to add achievement' };

  } catch (error) {
    console.error('[GAS FounderInfo] Add achievement error:', error);
    return { success: false, error: 'Error adding achievement' };
  }
};

/**
 * Remove a key achievement
 */
export const removeFounderAchievement = async (index: number): Promise<{ success: boolean; error?: string }> => {
  if (!GAS_CONFIG.HOMEPAGE_API_URL) {
    return { success: false, error: 'API URL not configured' };
  }

  try {
    const response = await fetch(GAS_CONFIG.HOMEPAGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'removeFounderAchievement',
        index,
      }),
    });

    const responseText = await response.text();
    const result = JSON.parse(responseText);

    if (result.success) {
      // Invalidate cache
      cachedFounderInfoContent = null;
      founderInfoCacheTimestamp = 0;
      return { success: true };
    }

    return { success: false, error: result.message || 'Failed to remove achievement' };

  } catch (error) {
    console.error('[GAS FounderInfo] Remove achievement error:', error);
    return { success: false, error: 'Error removing achievement' };
  }
};

/**
 * Update a key achievement
 */
export const updateFounderAchievement = async (index: number, achievement: string): Promise<{ success: boolean; error?: string }> => {
  if (!GAS_CONFIG.HOMEPAGE_API_URL) {
    return { success: false, error: 'API URL not configured' };
  }

  try {
    const response = await fetch(GAS_CONFIG.HOMEPAGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'updateFounderAchievement',
        index,
        data: { achievement },
      }),
    });

    const responseText = await response.text();
    const result = JSON.parse(responseText);

    if (result.success) {
      // Invalidate cache
      cachedFounderInfoContent = null;
      founderInfoCacheTimestamp = 0;
      return { success: true };
    }

    return { success: false, error: result.message || 'Failed to update achievement' };

  } catch (error) {
    console.error('[GAS FounderInfo] Update achievement error:', error);
    return { success: false, error: 'Error updating achievement' };
  }
};

/**
 * Add a new founder social link
 */
export const addFounderSocialLink = async (url: string): Promise<{ success: boolean; data?: FounderSocialLinkData; error?: string }> => {
  if (!GAS_CONFIG.HOMEPAGE_API_URL) {
    return { success: false, error: 'API URL not configured' };
  }

  try {
    const response = await fetch(GAS_CONFIG.HOMEPAGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'addFounderSocialLink',
        data: { url },
      }),
    });

    const responseText = await response.text();
    const result = JSON.parse(responseText);

    if (result.success) {
      // Invalidate cache
      cachedFounderInfoContent = null;
      founderInfoCacheTimestamp = 0;
      return { success: true, data: result.data };
    }

    return { success: false, error: result.message || 'Failed to add social link' };

  } catch (error) {
    console.error('[GAS FounderInfo] Add social link error:', error);
    return { success: false, error: 'Error adding social link' };
  }
};

/**
 * Remove a founder social link
 */
export const removeFounderSocialLink = async (index: number): Promise<{ success: boolean; error?: string }> => {
  if (!GAS_CONFIG.HOMEPAGE_API_URL) {
    return { success: false, error: 'API URL not configured' };
  }

  try {
    const response = await fetch(GAS_CONFIG.HOMEPAGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'removeFounderSocialLink',
        index,
      }),
    });

    const responseText = await response.text();
    const result = JSON.parse(responseText);

    if (result.success) {
      // Invalidate cache
      cachedFounderInfoContent = null;
      founderInfoCacheTimestamp = 0;
      return { success: true };
    }

    return { success: false, error: result.message || 'Failed to remove social link' };

  } catch (error) {
    console.error('[GAS FounderInfo] Remove social link error:', error);
    return { success: false, error: 'Error removing social link' };
  }
};

/**
 * Update a founder social link
 */
export const updateFounderSocialLink = async (index: number, url: string): Promise<{ success: boolean; error?: string }> => {
  if (!GAS_CONFIG.HOMEPAGE_API_URL) {
    return { success: false, error: 'API URL not configured' };
  }

  try {
    const response = await fetch(GAS_CONFIG.HOMEPAGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'updateFounderSocialLink',
        index,
        data: { url },
      }),
    });

    const responseText = await response.text();
    const result = JSON.parse(responseText);

    if (result.success) {
      // Invalidate cache
      cachedFounderInfoContent = null;
      founderInfoCacheTimestamp = 0;
      return { success: true };
    }

    return { success: false, error: result.message || 'Failed to update social link' };

  } catch (error) {
    console.error('[GAS FounderInfo] Update social link error:', error);
    return { success: false, error: 'Error updating social link' };
  }
};

/**
 * Clear the Founder Info content cache
 */
export const clearFounderInfoCache = (): void => {
  cachedFounderInfoContent = null;
  founderInfoCacheTimestamp = 0;
  console.log('[GAS FounderInfo] Cache cleared');
};
