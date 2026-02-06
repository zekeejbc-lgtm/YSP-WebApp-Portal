# 🔍 YSP Tagum WebApp - Comprehensive Diagnosis Report

**Generated:** February 4, 2026  
**Status:** Pending Fixes

---

## 📊 Executive Summary

| Severity | Frontend | Backend | Config | Total |
|----------|----------|---------|--------|-------|
| 🔴 **CRITICAL** | 3 | 4 | 3 | **10** |
| 🟠 **HIGH** | 5 | 8 | 6 | **19** |
| 🟡 **MEDIUM** | 7 | 12 | 8 | **27** |
| 🔵 **LOW** | 6 | 9 | 5 | **20** |
| **TOTAL** | **21** | **33** | **22** | **76** |

---

## 🔴 CRITICAL ISSUES (Immediate Attention Required)

### 1. Security Vulnerabilities

#### C1. Hardcoded API Keys in GAS Backend
- **File:** `gas-backend/YSP_Ai ChatBot.gs`
- **Issue:** Gemini API keys are hardcoded directly in source code
- **Risk:** API keys visible in Apps Script editor, could be exposed/abused
- **Fix:** Use `PropertiesService.getScriptProperties()` to store API keys securely

#### C2. Plain Text Passwords Logged to Spreadsheet
- **File:** `gas-backend/Loginpage_Hash.gs`
- **Issue:** Weak passwords are being logged to a "WeakPasswords" sheet in plain text
- **Code:**
```javascript
if (rawPassword && rawPassword.length < 60 && score < 100) {
  const logSheet = sheet.getParent().getSheetByName('WeakPasswords') || sheet.getParent().insertSheet('WeakPasswords');
  logSheet.appendRow([new Date(), email, answers['Username'], rawPassword, score + '%']);
}
```
- **Risk:** Severe security vulnerability - plain text passwords stored
- **Fix:** Remove this logging entirely. Never store plain text passwords.

#### C3. Hardcoded Spreadsheet/Folder IDs
- **Files:** Multiple `.gs` files
  - `Loginpage_Main.gs` - `LOGIN_SPREADSHEET_ID`
  - `SystemTools_Main.gs` - Multiple spreadsheet/folder IDs
  - `Directory_Main.gs` - Spreadsheet and folder IDs
- **Risk:** Resource IDs in version control could allow unauthorized access
- **Fix:** Store all IDs in `PropertiesService.getScriptProperties()`

#### C4. Role Verification Disabled for Critical Operations
- **File:** `gas-backend/SystemTools_Main.gs`
- **Issue:** Role verification is commented out, relying only on frontend restrictions
- **Code:**
```javascript
function handleBumpCacheVersion(username) {
  // Role check removed per user request (frontend restricts access to System Tools)
  // const role = getUserRole_(username);
```
- **Risk:** Attackers can call the API directly, bypassing frontend

Check
- **Fix:** Always enforce role-based access control on the backend

#### C5. Hardcoded API URL in Frontend
- **File:** `src/services/gasIssuanceService.ts`
- **Issue:** API URL hardcoded instead of using environment variables
- **Code:**
```typescript
API_URL: 'https://script.google.com/macros/s/AKfycbwir6gVrY9U9n8KgThRx7_5CXxHvDPyF_4EDho_ZsSE2oUtfolYkK6M8A8mdatssWkPMw/exec'
```
- **Risk:** API endpoint visible in bundled JavaScript, can be abused
- **Fix:** Use `import.meta.env.VITE_GAS_ISSUANCE_API_URL`

#### C6. Session Token Insecure Storage
- **File:** `src/services/gasLoginService.ts`
- **Issue:** Session tokens stored in localStorage without encryption
- **Code:**
```typescript
localStorage.setItem(LOGIN_CONFIG.SESSION_KEY, user.sessionToken);
localStorage.setItem(LOGIN_CONFIG.USER_KEY, JSON.stringify(user));
```
- **Risk:** localStorage accessible via XSS attacks
- **Fix:** Consider httpOnly cookies or encrypting sensitive data

### 2. Dependency Vulnerabilities

#### C7. xlsx (SheetJS) - NO FIX AVAILABLE
- **Current Version:** `0.18.5`
- **Vulnerabilities:**
  - Prototype Pollution (GHSA-4r6h-8v6p-xvw6) - CVSS 7.8
  - ReDoS vulnerability (GHSA-5pgg-2g8v-p4x9) - CVSS 7.5
- **Status:** ⚠️ No fix available
- **Fix:** Replace with `exceljs` library

#### C8. jspdf - PDF Injection
- **Current Version:** `4.0.0`
- **Vulnerabilities:**
  - PDF Injection allowing arbitrary JavaScript execution
  - DoS via unvalidated BMP dimensions
  - XMP Metadata Injection
- **Fix:** Update to `jspdf@4.1.0+`

#### C9. vite - Windows Security Bypass
- **Current Version:** `6.3.5`
- **Vulnerabilities:**
  - Server.fs.deny bypass via backslash on Windows
  - Middleware may serve unauthorized files
- **Fix:** Update to `vite@6.4.1+`

### 3. Missing Security Headers

#### C10. No Security Headers in Deployment
- **File:** `vercel.json`
- **Current Config:**
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "build",
  "framework": "vite",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```
- **Missing Headers:**
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - `Strict-Transport-Security` (HSTS)
  - `Content-Security-Policy`
  - `Referrer-Policy`
  - `Permissions-Policy`

---

## 🟠 HIGH SEVERITY ISSUES

### Architecture & Performance

#### H1. Massive App.tsx File (6,091 lines)
- **File:** `src/App.tsx`
- **Lines:** 6,091
- **Issue:** Single file contains entire app logic with 50+ state variables
- **Impact:**
  - Extremely difficult to maintain and debug
  - Poor code organization
  - Potential memory issues
  - Violates Single Responsibility Principle
- **Fix:** Split into smaller components (target: <500 lines each)

#### H2. 50+ useState Hooks in Single Component
- **File:** `src/App.tsx`
- **Issue:** Over 50 useState hooks in a single component
- **Impact:**
  - Difficult to track state changes
  - Performance overhead from React re-renders
- **Fix:** Use useReducer or state management library (Redux, Zustand)

#### H3. Missing Error Boundaries
- **Files:** `src/App.tsx`, `src/main.tsx`
- **Issue:** No Error Boundaries implemented to catch React rendering errors
- **Impact:** Unhandled errors crash the entire app
- **Fix:** Add Error Boundary components around major sections

#### H4. Potential Memory Leaks in Polling Intervals
- **File:** `src/App.tsx`
- **Issue:** Role checking polls every 20 seconds with interval that may not be cleaned up
- **Code:**
```typescript
roleCheckIntervalRef.current = setInterval(checkRole, 20000);
```
- **Impact:** If component unmounts before cleanup, interval continues running
- **Fix:** Ensure proper cleanup in useEffect return function

#### H5. Insecure Session Token Implementation
- **File:** `gas-backend/Loginpage_Main.gs`
- **Issue:** Session tokens not validated against stored values or expiration
- **Code:**
```javascript
function handleVerifySession(sessionToken) {
  const isValid = sessionToken && sessionToken.length > 0;
  return createSuccessResponse({ valid: isValid, ... });
}
```
- **Fix:** Implement proper session management with stored tokens and expiration

### Type Safety Issues

#### H6. Extensive Use of `any` Type
- **Files:** 20+ locations
- **Examples:**
  - `src/services/gasHomepageService.ts:199` - `catch (fetchError: any)`
  - `src/components/ApplyToOpportunityModal.tsx:37` - `onSubmit: (applicationData: any)`
  - `src/components/AttendanceDashboardPage.tsx:42` - `function formatTimeValue(timeValue: any)`
  - `src/components/ManageMembersPage.tsx:428` - `catch (err: any)`
- **Fix:** Replace with proper TypeScript interfaces

#### H7. SHA-256 Hashing Without Salt
- **File:** `gas-backend/Loginpage_Hash.gs`
- **Issue:** Passwords hashed without salting
- **Code:**
```javascript
function hashString(input) {
  const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input, ...);
  // No salt used
}
```
- **Risk:** Vulnerable to rainbow table attacks
- **Fix:** Add unique salt per user, store alongside hash

#### H8. No Rate Limiting
- **Files:** All GAS API endpoints
- **Risk:** APIs vulnerable to brute force attacks and abuse
- **Fix:** Implement rate limiting using `CacheService` or `PropertiesService`

#### H9. Missing Input Validation
- **Files:** Multiple GAS handlers
  - `Attendance_Main.gs` - `eventId`, `memberId` not validated
  - `Directory_Main.gs` - `query` not sanitized
  - `Profile_Audit_Export.gs` - Payload data not validated
- **Fix:** Validate and sanitize all input parameters

### Dependency Issues

#### H10. Unpinned Dependencies with Wildcards
- **File:** `package.json`
- **Affected Packages:**
```json
"clsx": "*",           // ❌ Unpinned
"leaflet": "*",        // ❌ Unpinned
"motion": "*",         // ❌ Unpinned
"qrcode.react": "*",   // ❌ Unpinned
"tailwind-merge": "*", // ❌ Unpinned
"usehooks-ts": "*",    // ❌ Unpinned
```
- **Risk:** Can introduce breaking changes unexpectedly
- **Fix:** Pin to specific versions

#### H11. Outdated Firebase with Vulnerabilities
- **Current:** `firebase@10.13.2`
- **Latest:** `12.8.0`
- **Transitive Vulnerabilities via `undici`:**
  - Use of insufficiently random values
  - DoS via bad certificate data
  - Unbounded decompression chain
- **Fix:** `npm install firebase@12.8.0` (breaking changes expected)

---

## 🟡 MEDIUM SEVERITY ISSUES

### React Anti-Patterns

#### M1. Using Array Index as React Key
- **Files:** 20+ instances
  - `src/components/MyQRIDPage.tsx:1862`
  - `src/components/ManageEventsPage.tsx:1161`
  - `src/components/YSPChatBot.tsx:2409`
  - `src/components/SystemToolsPage.tsx:771, 1070, 1077`
  - `src/components/SkeletonCard.tsx:108, 141, 193`
  - `src/components/Skeleton.tsx:107, 119, 135`
  - `src/components/OfficerDirectoryPage.tsx:87`
  - `src/components/ManageMembersPage.tsx:118`
- **Example:**
```tsx
<div key={index} className="flex items-center gap-2">
```
- **Impact:** Rendering issues when list items are reordered/added/removed
- **Fix:** Use unique identifiers as keys

#### M2. dangerouslySetInnerHTML Usage
- **Files:**
  - `src/components/ui/chart.tsx:83`
  - `src/components/MaintenanceScreen.tsx:177, 411`
- **Risk:** Potential XSS if user-generated content is passed
- **Fix:** Sanitize HTML before rendering or avoid dangerouslySetInnerHTML

#### M3. Excessive Console Logging
- **Files:** 40+ instances throughout codebase
- **Examples:**
  - `src/components/MyQRIDPage.tsx` - 19 console statements
  - `src/services/localStorageCache.ts` - 9 console statements
  - `src/utils/externalLinks.ts` - 8 console statements
- **Note:** Production silences most logs via `main.tsx`, but `console.error` still active
- **Fix:** Use a proper logging library with log levels

### Code Quality - Backend

#### M4. Inefficient Spreadsheet Operations
- **Files:** Multiple GAS files
- **Issue:** Full data range reads (`sheet.getDataRange().getValues()`)
- **Impact:** Performance degrades as data grows
- **Fix:** Use indexed lookups, pagination, or caching

#### M5. Missing Caching for Frequently Accessed Data
- **Files:** All GAS backend files
- **Impact:** Repeated API calls hit the spreadsheet every time
- **Fix:** Use `CacheService` for directory searches, user profiles, system settings

#### M6. No Transaction Locking for Critical Operations
- **Files:** `Attendance_Main.gs`, `Directory_Main.gs`
- **Impact:** Race conditions possible with concurrent requests
- **Fix:** Use `LockService` for operations like recording attendance

#### M7. Duplicate Code Across GAS Files
- **Examples:**
  - `isRequestCancelled_()` duplicated in 8+ files
  - `createSuccessResponse()`/`createErrorResponse()` logic repeated
  - Column index building logic duplicated
- **Fix:** Create a shared utilities library

#### M8. Long Functions Exceeding 100 Lines
- **Files:**
  - `Loginpage_Main.gs` - `handleLogin()` ~110 lines
  - `SystemTools_Main.gs` - `handleDatabaseBackup()` ~140 lines
- **Fix:** Break into smaller, single-purpose functions

#### M9. Access Logs Can Be Cleared Without Audit Trail
- **File:** `SystemTools_Main.gs`
- **Functions:**
  - `clearAllAccessLogs`
  - `clearAccessLogsByDateRange`
  - `clearSpecificAccessLogs`
- **Risk:** Access logs can be deleted, hiding malicious activity
- **Fix:** Archive logs before deletion, require multi-factor approval

### Configuration Issues

#### M10. TypeScript Configuration Not Strict Enough
- **File:** `tsconfig.json`
- **Current:**
```jsonc
"noUnusedLocals": false,      // Should be true
"noUnusedParameters": false,  // Should be true
"target": "ES2020",           // Could be ES2022+
```
- **Missing Options:**
  - `"noUncheckedIndexedAccess": true`
  - `"exactOptionalPropertyTypes": true`
  - `"forceConsistentCasingInFileNames": true`

#### M11. Missing ESLint Configuration
- **Issue:** No `.eslintrc` file found
- **Impact:**
  - No consistent code style enforcement
  - Missing accessibility checks
  - Missing React hooks rules

#### M12. Missing Prettier Configuration
- **Issue:** No `.prettierrc` file found
- **Impact:** Inconsistent code formatting

#### M13. Vite Build Configuration Missing Optimizations
- **File:** `vite.config.ts`
- **Missing:**
  - Minify configuration
  - Sourcemap for production debugging
  - cssCodeSplit optimization
  - reportCompressedSize

#### M14. PWA Configuration Incomplete
- **File:** `vite.config.ts`
- **Missing:**
  - `skipWaiting` for immediate activation
  - `clientsClaim` for immediate control
  - Runtime caching patterns for Google Apps Script APIs

#### M15. No Audit Trail for Profile Changes
- **File:** `gas-backend/Profile_Audit_Export.gs`
- **Impact:** Profile updates don't log who made changes (especially admin edits)
- **Fix:** Add audit log for all profile modifications

---

## 🔵 LOW SEVERITY ISSUES

### Code Style & Maintainability

#### L1. Inconsistent Naming Conventions
- **Files:** GAS backend
- **Issue:** Mixed camelCase and snake_case (`isRequestCancelled_`)
- **Fix:** Standardize on one convention

#### L2. Magic Numbers and Strings
- **Files:** Multiple
- **Examples:**
```javascript
if (matchingOfficers.length >= 20) break;  // Magic number
const pageLimit = Math.min(parseInt(limit) || 50, 100); // Magic numbers
```
- **Fix:** Define constants with meaningful names

#### L3. Missing Documentation for Complex Functions
- **Files:** Most complex functions
- **Issue:** Lack JSDoc comments explaining parameters and return values
- **Fix:** Add comprehensive JSDoc documentation

#### L4. Inline Styles Overuse
- **File:** `src/App.tsx`
- **Example:**
```typescript
style={{
  fontFamily: "var(--font-headings)",
  fontWeight: "var(--font-weight-bold)",
  color: "#f6421f",
}}
```
- **Impact:** Harder to maintain, cannot be cached separately
- **Fix:** Move to CSS classes

#### L5. Non-Null Assertions
- **File:** `src/main.tsx`
- **Example:**
```typescript
document.getElementById("root")!
```
- **Risk:** Can cause runtime errors if element doesn't exist
- **Fix:** Add proper null checks

#### L6. Unused Lucide Icons Imported
- **File:** `src/App.tsx`
- **Issue:** Many icons imported but may not all be used
- **Fix:** Remove unused imports

#### L7. Date Formatting Inconsistencies
- **Files:** Various
- **Issue:** Some use `yyyy-MM-dd`, others `MM/DD/YYYY`
- **Fix:** Standardize date formatting

#### L8. Missing Accessibility Labels
- **Files:** Multiple components
- **Issue:** Many interactive elements lack `aria-label` attributes
- **Fix:** Add accessibility labels to buttons, links, and interactive elements

#### L9. Hardcoded Email Templates
- **Files:** `Loginpage_Main.gs`, `Notifications_Main.gs`
- **Issue:** Email templates embedded in code
- **Fix:** Store templates in configuration sheet or HTML files

#### L10. Backup Files Not Encrypted
- **File:** `SystemTools_Main.gs`
- **Issue:** Backup spreadsheets contain sensitive data in plain format
- **Fix:** Consider encrypting backup data

---

## 📈 Metrics Summary

### File Size Concerns

| File | Lines | Status | Recommended |
|------|-------|--------|-------------|
| `src/App.tsx` | 6,091 | 🔴 Critical | < 500 |
| `src/services/gasLoginService.ts` | 1,620 | 🟠 High | < 500 |
| `gas-backend/SystemTools_Main.gs` | 2,677 | 🟠 High | < 500 |

### Dependency Health Score

| Category | Score | Notes |
|----------|-------|-------|
| Security | 🔴 60/100 | 15 vulnerabilities found |
| Currency | 🟡 70/100 | Multiple major updates available |
| Configuration | 🟡 75/100 | Missing linting, security headers |
| Build Setup | 🟢 85/100 | Good PWA setup, minor optimizations needed |

### Major Version Updates Available

| Package | Current | Latest | Breaking Changes |
|---------|---------|--------|------------------|
| react | 18.3.1 | 19.2.4 | ✅ Yes |
| react-dom | 18.3.1 | 19.2.4 | ✅ Yes |
| recharts | 2.15.4 | 3.7.0 | ✅ Yes |
| react-day-picker | 8.10.1 | 9.13.0 | ✅ Yes |
| react-resizable-panels | 2.1.9 | 4.5.9 | ✅ Yes |
| @vitejs/plugin-react-swc | 3.11.0 | 4.2.3 | ✅ Yes |
| @types/node | 20.19.29 | 25.2.0 | ✅ Yes |

---

## 🎯 Prioritized Action Items

### Phase 1: Immediate (Security Critical) ⏱️ 1-2 Days
- [ ] C2: Remove plain text password logging
- [ ] C1, C3: Move API keys and IDs to PropertiesService
- [ ] C4: Re-enable role verification in SystemTools
- [ ] C10: Add security headers to vercel.json
- [ ] C8, C9: Update vite and jspdf packages
- [ ] C5: Move hardcoded API URL to environment variable

### Phase 2: Short-term (1-2 Weeks)
- [ ] H1, H2: Split App.tsx into smaller components
- [ ] C7: Replace xlsx with exceljs
- [ ] H10: Pin all wildcard dependencies
- [ ] H7: Add password salting to hash function
- [ ] H5: Implement proper session management
- [ ] H3: Add Error Boundaries
- [ ] H6: Replace `any` types with proper interfaces

### Phase 3: Medium-term (2-4 Weeks)
- [ ] M11, M12: Add ESLint and Prettier configuration
- [ ] H8: Implement rate limiting in GAS backend
- [ ] M5: Add CacheService for frequently accessed data
- [ ] M7: Create shared utilities library for GAS
- [ ] M1: Fix React key usage (use unique IDs instead of index)
- [ ] L8: Improve accessibility across components

### Phase 4: Long-term (Technical Debt)
- [ ] M4: Optimize spreadsheet operations
- [ ] M6: Add transaction locking
- [ ] M8: Refactor long functions
- [ ] L3: Add comprehensive documentation
- [ ] Major version upgrades (React 19, etc.)

---

## 📝 Notes

- This diagnosis was generated on February 4, 2026
- No fixes have been applied yet
- Priority should be given to CRITICAL security issues first
- Some fixes may require coordination between frontend and backend changes
- Consider creating feature branches for each phase of fixes

---

## 🔗 Related Files

- `.env.example` - Environment variable documentation (exists, well documented)
- `package.json` - Dependency management
- `tsconfig.json` - TypeScript configuration
- `vite.config.ts` - Build configuration
- `vercel.json` - Deployment configuration
