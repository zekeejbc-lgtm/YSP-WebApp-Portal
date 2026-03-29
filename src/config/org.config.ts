import { getOrgBrandingFromBackend, type OrgBrandingConfig } from "../services/gasSystemToolsService";

const ORG_CONFIG_CACHE_KEY = "ysp_org_branding_cache";

const DEFAULT_ORG_CONFIG: OrgBrandingConfig = {
  orgName: import.meta.env.VITE_ORG_NAME || "Youth Service Philippines",
  chapterName: import.meta.env.VITE_CHAPTER_NAME || "Tagum Chapter",
  shortName: import.meta.env.VITE_SHORT_NAME || "YSP Tagum",
  fullName: "",
  motto: import.meta.env.VITE_ORG_MOTTO || "Shaping the Future to a Greater Society",
  chapterCode: import.meta.env.VITE_CHAPTER_CODE || "TC",
  location: import.meta.env.VITE_ORG_LOCATION || "Tagum City, Davao del Norte, Philippines",
  contactEmail: import.meta.env.VITE_ORG_EMAIL || "ysptagumchapter@gmail.com",
  logoUrl: import.meta.env.VITE_ORG_LOGO_URL || "https://i.imgur.com/J4wddTW.png",
  themeColor: import.meta.env.VITE_THEME_COLOR || "#f6421f",
};

DEFAULT_ORG_CONFIG.fullName = `${DEFAULT_ORG_CONFIG.orgName} - ${DEFAULT_ORG_CONFIG.chapterName}`;

let currentOrgConfig: OrgBrandingConfig = { ...DEFAULT_ORG_CONFIG };

function normalizeOrgConfig(input: Partial<OrgBrandingConfig> | null | undefined): OrgBrandingConfig {
  const merged: OrgBrandingConfig = {
    ...DEFAULT_ORG_CONFIG,
    ...(input || {}),
    fullName: "",
  };

  const orgName = String(merged.orgName || DEFAULT_ORG_CONFIG.orgName).trim();
  const chapterName = String(merged.chapterName || DEFAULT_ORG_CONFIG.chapterName).trim();

  merged.orgName = orgName;
  merged.chapterName = chapterName;
  merged.shortName = String(merged.shortName || DEFAULT_ORG_CONFIG.shortName).trim();
  merged.motto = String(merged.motto || DEFAULT_ORG_CONFIG.motto).trim();
  merged.chapterCode = String(merged.chapterCode || DEFAULT_ORG_CONFIG.chapterCode).trim();
  merged.location = String(merged.location || DEFAULT_ORG_CONFIG.location).trim();
  merged.contactEmail = String(merged.contactEmail || DEFAULT_ORG_CONFIG.contactEmail).trim();
  merged.logoUrl = String(merged.logoUrl || DEFAULT_ORG_CONFIG.logoUrl).trim();
  merged.themeColor = String(merged.themeColor || DEFAULT_ORG_CONFIG.themeColor).trim();
  merged.fullName = String(merged.fullName || `${orgName} - ${chapterName}`).trim();

  return merged;
}

function saveOrgConfigToCache(config: OrgBrandingConfig): void {
  try {
    localStorage.setItem(ORG_CONFIG_CACHE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage failures.
  }
}

function getCachedOrgConfig(): OrgBrandingConfig | null {
  try {
    const raw = localStorage.getItem(ORG_CONFIG_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OrgBrandingConfig>;
    return normalizeOrgConfig(parsed);
  } catch {
    return null;
  }
}

export function getCurrentOrgConfig(): OrgBrandingConfig {
  return currentOrgConfig;
}

export async function hydrateOrgConfigFromBackend(forceRefresh = false): Promise<OrgBrandingConfig> {
  if (!forceRefresh) {
    const cached = getCachedOrgConfig();
    if (cached) {
      currentOrgConfig = cached;
    }
  }

  try {
    const backendConfig = await getOrgBrandingFromBackend();
    currentOrgConfig = normalizeOrgConfig(backendConfig);
    saveOrgConfigToCache(currentOrgConfig);
  } catch {
    if (!forceRefresh) {
      const cached = getCachedOrgConfig();
      if (cached) {
        currentOrgConfig = cached;
      }
    }
  }

  return currentOrgConfig;
}

export const orgConfig = {
  get orgName() {
    return currentOrgConfig.orgName;
  },
  get chapterName() {
    return currentOrgConfig.chapterName;
  },
  get chapterLocation() {
    return currentOrgConfig.location;
  },
  get shortName() {
    return currentOrgConfig.shortName;
  },
  get fullName() {
    return currentOrgConfig.fullName;
  },
  get motto() {
    return currentOrgConfig.motto;
  },
  get chapterCode() {
    return currentOrgConfig.chapterCode;
  },
  get location() {
    return currentOrgConfig.location;
  },
  get contactEmail() {
    return currentOrgConfig.contactEmail;
  },
  get logoUrl() {
    return currentOrgConfig.logoUrl;
  },
  get themeColor() {
    return currentOrgConfig.themeColor;
  },
  get portalName() {
    return `${currentOrgConfig.shortName} Portal`;
  },
};
