/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GAS_HOMEPAGE_API_URL: string;
  readonly VITE_GAS_PROJECTS_API_URL?: string;
  readonly VITE_GAS_CONTACT_API_URL?: string;
  readonly VITE_GAS_OFFICERS_API_URL?: string;
  // Add more env variables here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
