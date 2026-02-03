/**
 * Local Storage Cache Service
 * Provides caching utilities for fast loading with background sync
 * 
 * Features:
 * - Instant loading from cache
 * - Background sync with backend
 * - Change detection and smart updates
 * - Deleted items detection
 */

// =================== TYPES ===================

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: string;
  checksum?: string;
}

export interface CacheConfig {
  key: string;
  maxAge: number; // milliseconds
  version: string;
}

// =================== CACHE KEYS ===================

export const CACHE_KEYS = {
  USER_PROFILE: 'ysp_user_profile_cache',
  HOMEPAGE_CONTENT: 'ysp_homepage_content_cache',
  HOMEPAGE_OTHER: 'ysp_homepage_other_cache',
  PROJECTS: 'ysp_projects_cache',
} as const;

// =================== CACHE VERSIONS ===================
// Increment these when data structure changes to invalidate old caches

export const CACHE_VERSIONS = {
  USER_PROFILE: '1.0.0',
  HOMEPAGE_CONTENT: '1.0.0',
  HOMEPAGE_OTHER: '1.0.0',
  PROJECTS: '1.0.0',
} as const;

// =================== CACHE DURATIONS ===================

export const CACHE_DURATIONS = {
  USER_PROFILE: 30 * 60 * 1000, // 30 minutes
  HOMEPAGE_CONTENT: 5 * 60 * 1000, // 5 minutes
  HOMEPAGE_OTHER: 5 * 60 * 1000, // 5 minutes
  PROJECTS: 10 * 60 * 1000, // 10 minutes
} as const;

// =================== UTILITY FUNCTIONS ===================

/**
 * Generate a simple checksum for change detection
 */
export function generateChecksum(data: unknown): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

/**
 * Check if cache entry is expired
 */
export function isCacheExpired(entry: CacheEntry<unknown>, maxAge: number): boolean {
  const now = Date.now();
  return (now - entry.timestamp) > maxAge;
}

/**
 * Check if cache version matches current version
 */
export function isCacheVersionValid(entry: CacheEntry<unknown>, currentVersion: string): boolean {
  return entry.version === currentVersion;
}

// =================== CACHE OPERATIONS ===================

/**
 * Save data to cache
 */
export function saveToCache<T>(key: string, data: T, version: string): void {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      version,
      checksum: generateChecksum(data),
    };
    localStorage.setItem(key, JSON.stringify(entry));
    console.log(`[Cache] Saved to ${key}`);
  } catch (error) {
    console.error(`[Cache] Failed to save to ${key}:`, error);
  }
}

/**
 * Load data from cache
 * Returns null if cache doesn't exist, is expired, or version mismatch
 */
export function loadFromCache<T>(
  key: string, 
  maxAge: number, 
  currentVersion: string
): { data: T; isStale: boolean } | null {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) {
      console.log(`[Cache] No cache found for ${key}`);
      return null;
    }

    const entry: CacheEntry<T> = JSON.parse(stored);

    // Check version
    if (!isCacheVersionValid(entry, currentVersion)) {
      console.log(`[Cache] Version mismatch for ${key}, invalidating`);
      localStorage.removeItem(key);
      return null;
    }

    // Check if stale (but still return data for instant loading)
    const isStale = isCacheExpired(entry, maxAge);
    
    console.log(`[Cache] Loaded from ${key}, isStale: ${isStale}`);
    return { data: entry.data, isStale };
  } catch (error) {
    console.error(`[Cache] Failed to load from ${key}:`, error);
    localStorage.removeItem(key);
    return null;
  }
}

/**
 * Check if cached data differs from new data
 */
export function hasDataChanged<T>(key: string, newData: T): boolean {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return true;

    const entry: CacheEntry<T> = JSON.parse(stored);
    const newChecksum = generateChecksum(newData);
    
    return entry.checksum !== newChecksum;
  } catch {
    return true;
  }
}

/**
 * Clear specific cache
 */
export function clearCache(key: string): void {
  try {
    localStorage.removeItem(key);
    console.log(`[Cache] Cleared ${key}`);
  } catch (error) {
    console.error(`[Cache] Failed to clear ${key}:`, error);
  }
}

/**
 * Clear all YSP caches
 */
export function clearAllCaches(): void {
  Object.values(CACHE_KEYS).forEach(key => {
    clearCache(key);
  });
  console.log('[Cache] All caches cleared');
}

// =================== USER PROFILE CACHE ===================

export interface CachedUserProfile {
  username: string;
  profile: {
    fullName: string;
    username: string;
    email: string;
    personalEmail: string;
    contactNumber: string;
    birthday: string;
    age: number;
    gender: string;
    pronouns: string;
    idCode: string;
    civilStatus: string;
    religion: string;
    nationality: string;
    address: string;
    barangay: string;
    city: string;
    province: string;
    zipCode: string;
    chapter: string;
    committee: string;
    dateJoined: string;
    membershipType: string;
    facebook: string;
    instagram: string;
    twitter: string;
    emergencyContactName: string;
    emergencyContactRelation: string;
    emergencyContactNumber: string;
    position: string;
    role: string;
    status: string;
    profilePictureURL?: string;
  };
  emailVerified: boolean;
  verifiedEmail: string;
}

/**
 * Save user profile to cache
 */
export function saveUserProfileToCache(data: CachedUserProfile): void {
  const key = `${CACHE_KEYS.USER_PROFILE}_${data.username}`;
  saveToCache(key, data, CACHE_VERSIONS.USER_PROFILE);
}

/**
 * Load user profile from cache
 */
export function loadUserProfileFromCache(username: string): { data: CachedUserProfile; isStale: boolean } | null {
  const key = `${CACHE_KEYS.USER_PROFILE}_${username}`;
  return loadFromCache<CachedUserProfile>(
    key,
    CACHE_DURATIONS.USER_PROFILE,
    CACHE_VERSIONS.USER_PROFILE
  );
}

/**
 * Check if profile has changed
 */
export function hasProfileChanged(username: string, newData: CachedUserProfile): boolean {
  const key = `${CACHE_KEYS.USER_PROFILE}_${username}`;
  return hasDataChanged(key, newData);
}

/**
 * Clear user profile cache
 */
export function clearUserProfileCache(username: string): void {
  const key = `${CACHE_KEYS.USER_PROFILE}_${username}`;
  clearCache(key);
}

// =================== HOMEPAGE CONTENT CACHE ===================

export interface CachedHomepageContent {
  hero: {
    mainHeading: string;
    subHeading: string;
    tagline: string;
    loginButtonText: string;
    memberButtonText: string;
  };
  about: { title: string; content: string };
  mission: { title: string; content: string };
  vision: { title: string; content: string };
  advocacyPillars: { title: string; content: string };
  themeSong: { title: string; url: string };
}

/**
 * Save homepage content to cache
 */
export function saveHomepageContentToCache(data: CachedHomepageContent): void {
  saveToCache(CACHE_KEYS.HOMEPAGE_CONTENT, data, CACHE_VERSIONS.HOMEPAGE_CONTENT);
}

/**
 * Load homepage content from cache
 */
export function loadHomepageContentFromCache(): { data: CachedHomepageContent; isStale: boolean } | null {
  return loadFromCache<CachedHomepageContent>(
    CACHE_KEYS.HOMEPAGE_CONTENT,
    CACHE_DURATIONS.HOMEPAGE_CONTENT,
    CACHE_VERSIONS.HOMEPAGE_CONTENT
  );
}

/**
 * Check if homepage content has changed
 */
export function hasHomepageContentChanged(newData: CachedHomepageContent): boolean {
  return hasDataChanged(CACHE_KEYS.HOMEPAGE_CONTENT, newData);
}

// =================== HOMEPAGE OTHER CONTENT CACHE ===================

export interface CachedHomepageOther {
  orgChartUrl: string;
  contact: {
    title: string;
    email: string;
    phone: string;
    location: string;
    locationLink: string;
    socialLinks: { id: number; url: string; label: string }[];
    partnerTitle: string;
    partnerDescription: string;
    partnerButtonText: string;
    partnerButtonLink: string;
  };
}

/**
 * Save homepage other content to cache
 */
export function saveHomepageOtherToCache(data: CachedHomepageOther): void {
  saveToCache(CACHE_KEYS.HOMEPAGE_OTHER, data, CACHE_VERSIONS.HOMEPAGE_OTHER);
}

/**
 * Load homepage other content from cache
 */
export function loadHomepageOtherFromCache(): { data: CachedHomepageOther; isStale: boolean } | null {
  return loadFromCache<CachedHomepageOther>(
    CACHE_KEYS.HOMEPAGE_OTHER,
    CACHE_DURATIONS.HOMEPAGE_OTHER,
    CACHE_VERSIONS.HOMEPAGE_OTHER
  );
}

/**
 * Check if homepage other content has changed
 */
export function hasHomepageOtherChanged(newData: CachedHomepageOther): boolean {
  return hasDataChanged(CACHE_KEYS.HOMEPAGE_OTHER, newData);
}

// =================== PROJECTS CACHE ===================

export interface CachedProject {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  category: string;
  status: string;
  date: string;
  location?: string;
  participants?: number;
  featured?: boolean;
}

/**
 * Save projects to cache
 */
export function saveProjectsToCache(projects: CachedProject[]): void {
  saveToCache(CACHE_KEYS.PROJECTS, projects, CACHE_VERSIONS.PROJECTS);
}

/**
 * Load projects from cache
 */
export function loadProjectsFromCache(): { data: CachedProject[]; isStale: boolean } | null {
  return loadFromCache<CachedProject[]>(
    CACHE_KEYS.PROJECTS,
    CACHE_DURATIONS.PROJECTS,
    CACHE_VERSIONS.PROJECTS
  );
}

/**
 * Check if projects have changed (including deletions)
 */
export function getProjectChanges(newProjects: CachedProject[]): {
  hasChanges: boolean;
  added: CachedProject[];
  updated: CachedProject[];
  deleted: string[];
} {
  const cached = loadProjectsFromCache();
  
  if (!cached) {
    return {
      hasChanges: true,
      added: newProjects,
      updated: [],
      deleted: [],
    };
  }

  const cachedMap = new Map(cached.data.map(p => [p.id, p]));
  const newMap = new Map(newProjects.map(p => [p.id, p]));

  const added: CachedProject[] = [];
  const updated: CachedProject[] = [];
  const deleted: string[] = [];

  // Check for added/updated
  for (const project of newProjects) {
    const cachedProject = cachedMap.get(project.id);
    if (!cachedProject) {
      added.push(project);
    } else if (generateChecksum(cachedProject) !== generateChecksum(project)) {
      updated.push(project);
    }
  }

  // Check for deleted
  for (const cachedProject of cached.data) {
    if (!newMap.has(cachedProject.id)) {
      deleted.push(cachedProject.id);
    }
  }

  return {
    hasChanges: added.length > 0 || updated.length > 0 || deleted.length > 0,
    added,
    updated,
    deleted,
  };
}
