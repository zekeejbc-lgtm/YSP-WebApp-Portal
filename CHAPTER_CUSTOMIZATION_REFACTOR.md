# Chapter and Motto Customization - Implementation Complete

This refactor is now implemented using a hybrid model:

1. Runtime branding (UI, exports, footers, email previews) comes from GAS Script Properties via System Tools action `getOrgBranding`.
2. Build-time branding (SEO metadata, manifest/PWA values) comes from Vite env variables.

This allows chapter changes without touching code for most UI text, while preserving correct static metadata at build time.

## Current Architecture

### Backend-first runtime source
- GAS endpoint in `gas-backend/SystemTools_Main.gs`:
  - action: `getOrgBranding`
  - reads Script Properties with fallbacks

### Frontend runtime hydrator
- `src/config/org.config.ts`:
  - hydrates from backend first
  - caches values in localStorage (`ysp_org_branding_cache`)
  - falls back to env defaults if backend unavailable

### App bootstrap
- `src/main.tsx` loads branding before rendering App.

### Build-time metadata source
- `index.html` and `vite.config.ts` use `VITE_*` variables.

## What You Need To Do

Follow this exact order.

1. Set GAS Script Properties in your System Tools project:
   - `ORG_NAME`
   - `ORG_CHAPTER_NAME`
   - `ORG_SHORT_NAME`
   - `ORG_MOTTO`
   - `ORG_CHAPTER_CODE`
   - `ORG_LOCATION`
   - `ORG_CONTACT_EMAIL`
   - `ORG_LOGO_URL`
   - `ORG_THEME_COLOR`

2. Redeploy the GAS Web App:
   - Deploy > Manage deployments > Edit deployment > New version > Deploy.

3. Update local env for build-time metadata:
   - Edit `.env` (or production env in hosting) to match your chapter values.
   - Keep these aligned with Script Properties:
     - `VITE_ORG_NAME`
     - `VITE_CHAPTER_NAME`
     - `VITE_SHORT_NAME`
     - `VITE_ORG_MOTTO`
     - `VITE_CHAPTER_CODE`
     - `VITE_ORG_LOCATION`
     - `VITE_ORG_EMAIL`
     - `VITE_ORG_LOGO_URL`
     - `VITE_THEME_COLOR`

4. Rebuild and redeploy frontend:
   - run: `npm run build`
   - deploy build output to your host.

5. Clear runtime cache once per browser:
   - DevTools > Application > Local Storage > remove key `ysp_org_branding_cache`.
   - Hard refresh the app.

6. Verify:
   - Top bar/sidebar/login/loading screens show new chapter branding.
   - PDF exports show new org/chapter/motto.
   - Route titles and PWA install prompt show new short name.
   - View source/meta tags reflect updated `VITE_*` values after rebuild.

## Notes

- Remaining Tagum-specific strings in active code are only intentional fallbacks or backward compatibility mappings.
- Backup and historical files can still contain old labels, but they are non-runtime.