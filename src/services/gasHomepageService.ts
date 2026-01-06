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
 * Check if cached content is still valid
 */
const isCacheValid = (): boolean => {
  if (!cachedContent) return false;
  return Date.now() - cacheTimestamp < GAS_CONFIG.CACHE_DURATION;
};

/**
 * Fetch homepage content from GAS API
 * Uses JSONP-style callback to avoid CORS issues
 */
export const fetchHomepageContent = async (): Promise<HomepageMainContent> => {
  // Return cached content if valid
  if (isCacheValid() && cachedContent) {
    console.log('[GAS Homepage] Returning cached content');
    return cachedContent;
  }

  // Check if API URL is configured
  if (!GAS_CONFIG.HOMEPAGE_API_URL) {
    console.warn('[GAS Homepage] API URL not configured, using default content');
    return getDefaultHomepageContent();
  }

  try {
    console.log('[GAS Homepage] Fetching content from GAS...');
    
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GAS_CONFIG.TIMEOUT);

    const response = await fetch(GAS_CONFIG.HOMEPAGE_API_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: GASResponse = await response.json();

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Invalid response from GAS API');
    }

    // Transform GAS response to HomepageMainContent
    const content: HomepageMainContent = {
      hero: {
        mainHeading: result.data.mainHeading || 'Welcome to Youth Service Philippines',
        subHeading: result.data.subHeading || 'Tagum Chapter',
        tagline: result.data.tagline || 'Empowering youth to serve communities',
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
    
    // Return cached content if available (even if expired)
    if (cachedContent) {
      console.log('[GAS Homepage] Returning stale cached content');
      return cachedContent;
    }
    
    // Return default content as fallback
    return getDefaultHomepageContent();
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

    const payload = {
      action: 'update',
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

    const response = await fetch(GAS_CONFIG.HOMEPAGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

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
      tagline: 'Empowering youth to serve communities and build a better future for all Filipinos',
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
