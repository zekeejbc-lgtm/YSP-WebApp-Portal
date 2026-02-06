# YSP Tagum WebApp — Manual Setup Guide

> **Purpose:** Lists every manual configuration step that cannot be automated through code commits.  
> Keep this file updated as new GAS projects or properties are added.
>
> **Last updated:** February 6, 2026 — Phase 5 quick-wins remediation

---

## Table of Contents

1. [Frontend Environment Variables (.env)](#1-frontend-environment-variables)
2. [GAS Script Properties (per project)](#2-gas-script-properties)
3. [One-Time Migrations](#3-one-time-migrations)
4. [GAS Deployment Checklist](#4-gas-deployment-checklist)
5. [Vercel Environment Variables](#5-vercel-environment-variables)
6. [Firebase Setup](#6-firebase-setup)
7. [Google Sheets Structure](#7-google-sheets-structure)
8. [Pending Code Changes in GAS Files](#8-pending-code-changes-in-gas-files)
9. [Known Limitations & Future Work](#9-known-limitations--future-work)

---

## 1. Frontend Environment Variables

Copy `.env.example` → `.env` and fill in all values.

### Required — GAS API URLs (app won't function without these)

| Variable | Your Current Value | Description |
|---|---|---|
| `VITE_GAS_HOMEPAGE_API_URL` | `https://script.google.com/macros/s/AKfycbxjRlhqh4pJD5M2wsjr.../exec` | Homepage_Main.gs deployed URL |
| `VITE_GAS_LOGIN_API_URL` | `https://script.google.com/macros/s/AKfycbwx1MdprRNPoCaQ07CM.../exec` | Loginpage_Main.gs deployed URL |
| `VITE_GAS_EVENTS_API_URL` | `https://script.google.com/macros/s/AKfycbwax5mEtUQ7q6btf.../exec` | Attendance_Events.gs deployed URL |
| `VITE_GAS_SYSTEM_TOOLS_API_URL` | `https://script.google.com/macros/s/AKfycbwchimdF5wVehmHf.../exec` | SystemTools_Main.gs deployed URL |
| `VITE_GAS_NOTIFICATIONS_API_URL` | `https://script.google.com/macros/s/AKfycbyIaNxjImOfwE7OCE.../exec` | Notifications_Main.gs deployed URL |
| `VITE_GAS_ISSUANCE_API_URL` | `https://script.google.com/macros/s/AKfycbwir6gVrY9U9n8Kg.../exec` | Issuance_Main.gs deployed URL |
| `VITE_GAS_FEEDBACK_API_URL` | `https://script.google.com/macros/s/AKfycbxRhzJaZBgrg6KKab.../exec` | Feedback_Main.gs deployed URL |
| `VITE_GAS_CHATBOT_API_URL` | `https://script.google.com/macros/s/AKfycbxBc_bEYUCdt71zuUZ.../exec` | YSP_Ai ChatBot.gs deployed URL |

### Optional — Firebase (push notifications disabled if missing)

| Variable | Your Current Value | Description |
|---|---|---|
| `VITE_FIREBASE_SDK_VERSION` | `10.13.2` | Firebase JS SDK version loaded from CDN |
| `VITE_FIREBASE_API_KEY` | `YOUR_FIREBASE_API_KEY` | Firebase Web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | `ysp-backend.firebaseapp.com` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | `ysp-backend` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | `ysp-backend.firebasestorage.app` | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `7662627926` | FCM sender ID |
| `VITE_FIREBASE_APP_ID` | `1:7662627926:web:013c2dff4c4cd59f60dff7` | Firebase app ID |
| `VITE_FIREBASE_VAPID_KEY` | `BMlGdGmf_fu0QwdfENtuIWeTVv6-...` | FCM VAPID key for web push |

### Reserved for Future (currently commented out in .env)

| Variable | Description |
|---|---|
| `VITE_GAS_PROJECTS_API_URL` | For a separate Projects GAS project |
| `VITE_GAS_CONTACT_API_URL` | For a separate Contact GAS project |
| `VITE_GAS_OFFICERS_API_URL` | For a separate Officers GAS project |

---

## 2. GAS Script Properties

Each GAS project needs **Script Properties** configured in the Apps Script editor.

### How to set Script Properties

1. Open the Apps Script project at [script.google.com](https://script.google.com/)
2. Click the **⚙️ gear icon** (Project Settings) in the left sidebar
3. Scroll down to **Script Properties**
4. Click **Edit script properties**
5. Click **+ Add script property** for each key below
6. Enter the **Property** (key) and **Value** exactly as shown
7. Click **Save script properties**

> **Where to find a Google Sheet ID:** Open the spreadsheet → look at the URL:  
> `https://docs.google.com/spreadsheets/d/`**`<THIS_IS_THE_ID>`**`/edit`
>
> **Where to find a Drive Folder ID:** Open the folder → look at the URL:  
> `https://drive.google.com/drive/folders/`**`<THIS_IS_THE_ID>`**

---

### 🔐 Login Project

**Files in this project:** `Loginpage_Main.gs`, `Loginpage_Hash.gs`, `Directory_Main.gs`, `Directory_Migrate.gs`, `Profile_Audit_Export.gs`, `SystemTools_Main.gs`, `YSP_Ai ChatBot.gs`, `Secrets.gs`

> This is the main project — it contains the login/auth backend and several other modules that share the same deployment.

| Property Key | Value | Description |
|---|---|---|
| `LOGIN_SPREADSHEET_ID` | `1vaQZoPq5a_verhICIiWXudBjAmfgFSIbaBX5xt9kjMk` | User Profiles spreadsheet |
| `PROFILE_PICTURES_FOLDER_ID` | `1QVb7--Ozam5QNokT1dC9Uzzg-T5QoPZx` | Profile pictures Drive folder |
| `SYSTEM_SETTINGS_SPREADSHEET_ID` | `1ZhgrpKE3zCzohqVri0kLhi-R0HVlqjhyvMeF4su8BfI` | System Settings spreadsheet |
| `EVENTS_SPREADSHEET_ID` | `1Xn7w9kzNrP6dmZXYXjxaO11Lmao79wn9w1SPCiqFtcA` | Events spreadsheet |
| `HOMEPAGE_SPREADSHEET_ID` | `1p7zOte14Tu8wrL5VTlU326EQ0Bf8f4uCFwKpJiHnD30` | Homepage spreadsheet |
| `BACKUPS_FOLDER_ID` | `1n487dwMvqUbCP8s1ETFfRGF64ds01pXj` | Backups Drive folder |
| `ACCESS_LOGS_ARCHIVE_FOLDER_ID` | `1v147QE9DUACrIMcnVNUk7WgevFWBVHfO` | Access logs archive Drive folder |
| `ACCESS_LOGS_MANUAL_EXPORT_FOLDER_ID` | `1LBMul1VdSubotA9FiwI4kvHsmUSv-n2k` | Manual export Drive folder |
| `GEMINI_API_KEY` | *Your Google Gemini API key* | Get from [Google AI Studio](https://aistudio.google.com/apikey) |

> ⚠️ **Secrets.gs fix required:** The `GEMINI_API_KEY` property is set above, but `Secrets.gs` currently has an **empty** `API_KEYS` array (line 12) with the code to load from Script Properties commented out (lines 14-15). The ChatBot will **not work** until this is fixed — see [Section 8](#8-pending-code-changes-in-gas-files) for the exact code change.

**Step-by-step (Login Project):**
1. Go to [script.google.com](https://script.google.com/) → find your Login project
2. Click ⚙️ **Project Settings** in the left sidebar
3. Under **Script Properties**, click **Edit script properties**
4. Add each property from the table above
5. Click **Save script properties**
6. To verify: run `Logger.log(PropertiesService.getScriptProperties().getProperty('LOGIN_SPREADSHEET_ID'))` in the editor

---

### 📅 Attendance Events Project

**File:** `Attendance_Events.gs`

> This is a **separate** Apps Script project deployed as its own web app.

| Property Key | Value | Description |
|---|---|---|
| `EVENTS_SPREADSHEET_ID` | `1Xn7w9kzNrP6dmZXYXjxaO11Lmao79wn9w1SPCiqFtcA` | Events spreadsheet (same as Login project) |

**Step-by-step:**
1. Open the Attendance Events project in Apps Script
2. ⚙️ **Project Settings** → **Script Properties** → **Edit**
3. Add `EVENTS_SPREADSHEET_ID` with the value above
4. Save

---

### 📋 Attendance Main Project

**File:** `Attendance_Main.gs`

> This may be in the same project as Attendance_Events.gs or a separate one — check your setup.

| Property Key | Value | Description |
|---|---|---|
| `EVENTS_SPREADSHEET_ID` | `1Xn7w9kzNrP6dmZXYXjxaO11Lmao79wn9w1SPCiqFtcA` | Events spreadsheet |
| `LOGIN_SPREADSHEET_ID` | `1vaQZoPq5a_verhICIiWXudBjAmfgFSIbaBX5xt9kjMk` | User Profiles spreadsheet (for member name lookups) |

---

### 🔔 Notifications Project

**File:** `Notifications_Main.gs`

> Deployed as a **separate** web app.
>
> ⚠️ **Security note:** This file has a **hardcoded fallback ID** (`1hKuLWjMEZkK-PndFHbOsv7ks68V5-1g9e5p8osSE21w`) at line 25. You **must** set the `NOTIFICATIONS_SPREADSHEET_ID` Script Property below, then remove the hardcoded fallback — see [Section 8](#8-pending-code-changes-in-gas-files).

| Property Key | Value | Description |
|---|---|---|
| `NOTIFICATIONS_SPREADSHEET_ID` | `1hKuLWjMEZkK-PndFHbOsv7ks68V5-1g9e5p8osSE21w` | Notifications spreadsheet |
| `NOTIFICATIONS_API_URL` | *(paste your deployed Notifications web app URL after deploying)* | Self-referencing URL — set after deployment (see step 5 below) |

**Step-by-step:**
1. Open the Notifications project in Apps Script
2. ⚙️ **Project Settings** → **Script Properties** → **Edit**
3. Add `NOTIFICATIONS_SPREADSHEET_ID`
4. Deploy the project as Web App (see Section 4)
5. Copy the deployed URL → add it as `NOTIFICATIONS_API_URL` in Script Properties
6. Save

---

### 📬 Feedback Project

**File:** `Feedback_Main.gs`

> Deployed as a **separate** web app.

| Property Key | Value | Description |
|---|---|---|
| `FEEDBACK_SPREADSHEET_ID` | `1837AfQpepOB0IIHtUvTqomBmeaiX-5r64J8tEpEmXL4` | Feedbacks spreadsheet |
| `FEEDBACK_SHEET_NAME` | `Feedbacks` | Tab/sheet name inside the spreadsheet |
| `FEEDBACK_IMAGES_FOLDER_ID` | `1K-QweGSEp2HNQZnkPIE8f3FKuQkLp_mp` | Feedback images Drive folder |

---

### 📜 Issuance Project

**File:** `Issuance_Main.gs`

> **Note:** This file currently has **hardcoded IDs** in the `ISSUANCE_CONFIG` object (lines 27-28). These **must** be moved to Script Properties — see [Section 8](#8-pending-code-changes-in-gas-files) for the exact code change.

| Property Key | Value | Description |
|---|---|---|
| `EVENTS_SPREADSHEET_ID` | `1Xn7w9kzNrP6dmZXYXjxaO11Lmao79wn9w1SPCiqFtcA` | Events spreadsheet (for attendance-based certificates) |
| `LOGIN_SPREADSHEET_ID` | `1vaQZoPq5a_verhICIiWXudBjAmfgFSIbaBX5xt9kjMk` | User Profiles spreadsheet (for directory/member lookups) |
| `ISSUANCE_SPREADSHEET_ID` | `1HUimmBnzy1Rr7Kg-x24iiscKTmqHJdzDoV72N3u4wmE` | Issuance spreadsheet (currently hardcoded in config) |
| `ISSUANCE_PDF_FOLDER_ID` | `1e6g6JLr7y9VcJJ2wQ5jijNu9z6WAmDnt` | PDF output Drive folder (currently hardcoded in config) |

**Step-by-step (Issuance Project):**
1. Open the Issuance project in Apps Script
2. ⚙️ **Project Settings** → **Script Properties** → **Edit**
3. Add all 4 properties from the table above
4. Save
5. To verify: run `Logger.log(PropertiesService.getScriptProperties().getProperty('ISSUANCE_SPREADSHEET_ID'))` in the editor
6. **Then** apply the code change in [Section 8](#8-pending-code-changes-in-gas-files) to remove the hardcoded IDs from `Issuance_Main.gs`

---

### 🏠 Homepage Project

**File:** `Homepage_Main.gs`

> This is a **container-bound** script — it lives inside the Homepage spreadsheet itself. It uses `SpreadsheetApp.getActiveSpreadsheet()` so no spreadsheet ID is needed.
>
> ⚠️ This file currently has **4 hardcoded Drive Folder IDs** that should be moved to Script Properties — see [Section 8](#8-pending-code-changes-in-gas-files) for the exact code changes.

| Property Key | Value | Description |
|---|---|---|
| `PROJECTS_DRIVE_FOLDER_ID` | `1ACiv3LS5PrvNiQdscXCbCDzSC2phav3s` | Projects images folder (hardcoded at line ~95) |
| `ORG_CHART_FOLDER_ID` | `1_k7uANemaDnWPTUY1piYOcJg0lBiW_H-` | Org Chart images folder (hardcoded at line ~112) |
| `DEV_PROFILE_FOLDER_ID` | `1gofrR_P3W3G2FPI_VPejv6JLVgivQAiz` | Developer profile images folder (hardcoded at line ~136) |
| `FOUNDER_PROFILE_FOLDER_ID` | `1Myzg0iFO8yY3Hs-uX1D7HzFlMHfBEASU` | Founder profile images folder (hardcoded at line ~161) |

**Step-by-step (Homepage Project):**
1. Open the Homepage spreadsheet → Extensions → Apps Script
2. ⚙️ **Project Settings** → **Script Properties** → **Edit**
3. Add all 4 properties from the table above
4. Save
5. **Then** apply the code changes in [Section 8](#8-pending-code-changes-in-gas-files) to remove the hardcoded IDs from `Homepage_Main.gs`

---

## 3. One-Time Migrations

### 3a. Password Salt Migration ⚠️ CRITICAL

**When to run:** After deploying the updated `Loginpage_Hash.gs` code (Phase 4 H7 changes).

**What it does:**
- Creates a new **"Salt"** column in the User Profiles sheet (if it doesn't exist)
- For every user that has a hashed password but **no salt**: generates a unique 32-char random salt
- Re-hashes as: `SHA-256(salt + existingHash)` — this is the double-hash approach
- Writes the new salted hash and salt back to the sheet
- Already-salted users are **skipped** (safe to re-run)

**Why it's non-breaking:**
- The updated `handleLogin()` and `handleVerifyPassword()` check if a user has a salt
- If salt exists → uses `SHA-256(salt + SHA-256(password))` for comparison
- If no salt → falls back to plain `SHA-256(password)` (pre-migration mode)
- After migration, all users will have salts and use the new scheme

**Step-by-step instructions:**

1. **Back up first!** Open the User Profiles spreadsheet → File → Make a copy
2. Open the **Login** Apps Script project at [script.google.com](https://script.google.com/)
3. Make sure `Loginpage_Hash.gs` has the latest code (contains `migratePasswordsToSalted` function)
4. In the toolbar function dropdown, select: **`migratePasswordsToSalted`**
5. Click **▶ Run**
6. If prompted, **authorize** the script (first-time only)
7. Wait for execution to complete (check the **Execution log** at the bottom)
8. You should see output like:
   ```
   Created "Salt" column at position 39
   === Salt Migration Complete ===
   Migrated: 47 users
   Skipped (already salted): 0 users
   Skipped (empty password): 3 rows
   Total rows processed: 50
   ```
9. Open the User Profiles spreadsheet → verify the new **Salt** column has values
10. Test login with a known user to confirm it works

**Troubleshooting:**
- If you see "Error: Sheet 'User Profiles' not found" → check `SHEET_NAME` variable in `Loginpage_Hash.gs` matches your actual sheet tab name
- If `Migrated: 0 users` → all passwords may already be salted, or the Password column is empty
- If login breaks → restore from the backup copy you made in step 1

---

### 3b. Legacy: Convert Plaintext Passwords to Hashes

> Only needed if some passwords are still in **plaintext** (not 64-char hex strings).

1. Open the Login Apps Script project
2. Select function: **`convertAllPasswordsToHash`**
3. Click **▶ Run**
4. Check log for: `Migration Complete: All plain text passwords have been hashed.`
5. **Then** run `migratePasswordsToSalted` (step 3a above)

---

## 4. GAS Deployment Checklist

### How to deploy a GAS project as a Web App

1. Open the Apps Script project at [script.google.com](https://script.google.com/)
2. Click **Deploy** (blue button, top right) → **New deployment**
3. Click the **⚙️ gear icon** next to "Select type" → choose **Web app**
4. Fill in:
   - **Description:** (optional) e.g., "v2.0 - salt migration"
   - **Execute as:** **Me** (your-email@gmail.com)
   - **Who has access:** **Anyone**
5. Click **Deploy**
6. **Copy the URL** that appears (starts with `https://script.google.com/macros/s/...`)
7. Paste the URL into your `.env` file for the matching `VITE_GAS_*_API_URL` variable
8. Also add it to Vercel (see Section 5)

> **⚠️ After updating GAS code**, you must click **Deploy** → **Manage deployments** → **Edit (pencil icon)** → change **Version** to "New version" → **Deploy**. Otherwise your old code is still running!

### Projects to Deploy

| # | GAS Project Files | .env Variable | Deployed With |
|---|---|---|---|
| 1 | `Homepage_Main.gs` | `VITE_GAS_HOMEPAGE_API_URL` | Container-bound script (inside Homepage spreadsheet) |
| 2 | `Loginpage_Main.gs` + `Loginpage_Hash.gs` + `Directory_Main.gs` + `Directory_Migrate.gs` + `Profile_Audit_Export.gs` + `SystemTools_Main.gs` + `YSP_Ai ChatBot.gs` + `Secrets.gs` | `VITE_GAS_LOGIN_API_URL` | All in the same project |
| 3 | `Attendance_Events.gs` | `VITE_GAS_EVENTS_API_URL` | Separate project |
| 4 | `SystemTools_Main.gs` | `VITE_GAS_SYSTEM_TOOLS_API_URL` | Same as Login project (#2) |
| 5 | `Notifications_Main.gs` | `VITE_GAS_NOTIFICATIONS_API_URL` | Separate project |
| 6 | `Issuance_Main.gs` | `VITE_GAS_ISSUANCE_API_URL` | Separate project |
| 7 | `Feedback_Main.gs` | `VITE_GAS_FEEDBACK_API_URL` | Separate project |
| 8 | `YSP_Ai ChatBot.gs` | `VITE_GAS_CHATBOT_API_URL` | Same as Login project (#2) |

> **Note:** `Loginpage_Main.gs`, `SystemTools_Main.gs`, and `YSP_Ai ChatBot.gs` are all in the **same** Apps Script project. The Login URL (`VITE_GAS_LOGIN_API_URL`) and System Tools URL (`VITE_GAS_SYSTEM_TOOLS_API_URL`) **may be the same URL** if they share a deployment, or different if SystemTools has its own deployment.

---

## 5. Vercel Environment Variables

All `VITE_*` variables must be set in Vercel for the production build.

### How to set Vercel environment variables

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click your project → **Settings** (top tab)
3. Click **Environment Variables** in the left sidebar
4. For each variable below, click **Add New**:
   - **Key:** the variable name (e.g., `VITE_GAS_LOGIN_API_URL`)
   - **Value:** the full URL or value
   - **Environment:** check **Production**, **Preview**, and **Development**
5. Click **Save**
6. **Redeploy** for changes to take effect (Deployments tab → three dots → Redeploy)

### Variables to add

Copy all the variables from your `.env` file:

```
VITE_GAS_HOMEPAGE_API_URL=...
VITE_GAS_LOGIN_API_URL=...
VITE_GAS_EVENTS_API_URL=...
VITE_GAS_SYSTEM_TOOLS_API_URL=...
VITE_GAS_NOTIFICATIONS_API_URL=...
VITE_GAS_ISSUANCE_API_URL=...
VITE_GAS_FEEDBACK_API_URL=...
VITE_GAS_CHATBOT_API_URL=...
VITE_FIREBASE_SDK_VERSION=10.13.2
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_VAPID_KEY=...
```

---

## 6. Firebase Setup

Firebase Cloud Messaging (FCM) is loaded directly from **Google's CDN** — the `firebase` npm package is not used.

### Initial Setup (if not already done)

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it (yours is `ysp-backend`)
3. Once created, click **⚙️ gear icon** → **Project settings**
4. Under **General** tab → scroll down → click **Add app** → choose **Web** (`</>`)
5. Register the app → copy the **firebaseConfig** values:
   ```js
   apiKey: "AIzaSyCe...",       → VITE_FIREBASE_API_KEY
   authDomain: "ysp-backend..", → VITE_FIREBASE_AUTH_DOMAIN
   projectId: "ysp-backend",    → VITE_FIREBASE_PROJECT_ID
   storageBucket: "ysp-back..", → VITE_FIREBASE_STORAGE_BUCKET
   messagingSenderId: "7662..", → VITE_FIREBASE_MESSAGING_SENDER_ID
   appId: "1:7662627926:web:.." → VITE_FIREBASE_APP_ID
   ```
6. Go to **Cloud Messaging** tab → under **Web Push certificates** → click **Generate key pair**
7. Copy the key → `VITE_FIREBASE_VAPID_KEY`
8. Paste all values into your `.env` file and Vercel

### Your current Firebase config

| Setting | Value |
|---|---|
| Project ID | `ysp-backend` |
| Auth Domain | `ysp-backend.firebaseapp.com` |
| Storage Bucket | `ysp-backend.firebasestorage.app` |
| Messaging Sender ID | `7662627926` |
| SDK Version (CDN) | `10.13.2` |

---

## 7. Google Sheets Structure

### User Profiles Sheet (Login Spreadsheet)

**Required columns** in the header row (Row 1). The app looks up columns by header name, so spelling must match exactly:

| Column | Header Name | Purpose |
|---|---|---|
| A | `Timestamp` | Form submission timestamp |
| B | `Email Address` | User's email |
| D | `Full name` | Display name |
| N | `Username` | Login username |
| O | `Password` | Hashed password (64-char hex) |
| — | `Salt` | Per-user salt for password hashing (auto-created by migration) |
| S | `ID Code` | Unique member ID |
| T | `Position` | Member position |
| U | `Role` | `Auditor`, `Admin`, `Head`, `Member`, `Suspended`, `Banned`, `Guest` |
| V | `ProfilePictureURL` | URL to profile image |
| — | `Numeric ID` | Auto-generated numeric ID |
| — | `EmailVerified` | `TRUE` / `FALSE` |
| AL | `Status` | Account status |

> Column letters are approximate — the code finds columns by header name, not position.  
> The **Salt** column is auto-created by `migratePasswordsToSalted()` if it doesn't exist.

### Events Sheet (Events Spreadsheet)

Managed by `Attendance_Events.gs`. Contains:
- `Title`, `StartDate`, `StartTime`, `EndTime`, `Status`, etc.

### Feedback Sheet

- Tab name must match `FEEDBACK_SHEET_NAME` Script Property (default: **`Feedbacks`**)

### Issuance Sheets

Managed by `Issuance_Main.gs`. Contains these tabs:
- `Issuances`, `Templates`, `Recipients`, `SendLogs`, `Settings`, `ControlNumberSequences`, `ControlNumberTracking`

### Notifications Sheet

Managed by `Notifications_Main.gs`.
- Spreadsheet ID: `1hKuLWjMEZkK-PndFHbOsv7ks68V5-1g9e5p8osSE21w` (default fallback)

### System Settings Sheet

Referenced by `SystemTools_Main.gs`. Contains tabs:
- `System Settings`, `Maintenance Mode`

---

## 8. Pending Code Changes in GAS Files

> These changes must be made **in the Apps Script editor** at [script.google.com](https://script.google.com/). After making changes, **redeploy** the affected project (see [Section 4](#4-gas-deployment-checklist)).

### 8a. Issuance_Main.gs — Move hardcoded IDs to Script Properties

**Prerequisite:** Set `ISSUANCE_SPREADSHEET_ID` and `ISSUANCE_PDF_FOLDER_ID` in Script Properties first (see [Section 2 → Issuance Project](#-issuance-project)).

**Step 1:** Find the `ISSUANCE_CONFIG` object near **line 27** and replace the hardcoded values:

```javascript
// ❌ BEFORE (lines 27-28):
const ISSUANCE_CONFIG = {
  SPREADSHEET_ID: '1HUimmBnzy1Rr7Kg-x24iiscKTmqHJdzDoV72N3u4wmE',
  PDF_FOLDER_ID: '1e6g6JLr7y9VcJJ2wQ5jijNu9z6WAmDnt',

// ✅ AFTER:
const ISSUANCE_CONFIG = {
  SPREADSHEET_ID: PropertiesService.getScriptProperties().getProperty('ISSUANCE_SPREADSHEET_ID'),
  PDF_FOLDER_ID: PropertiesService.getScriptProperties().getProperty('ISSUANCE_PDF_FOLDER_ID'),
```

**Step 2:** Remove the hardcoded URLs from the **file header comments** (lines 8-10):

```javascript
// ❌ REMOVE these lines from the top of the file:
// * API URL: https://script.google.com/macros/s/AKfycbwir6gVrY9U9n8Kg.../exec
// * Sheet URL: https://docs.google.com/spreadsheets/d/1HUimmBnzy.../edit
// * PDF Storage: https://drive.google.com/drive/folders/1e6g6JLr.../
```

**Step 3:** Redeploy the Issuance project.

---

### 8b. Homepage_Main.gs — Move hardcoded folder IDs to Script Properties

**Prerequisite:** Set all 4 folder ID properties in Script Properties first (see [Section 2 → Homepage Project](#-homepage-project)).

Replace each hardcoded ID with a `PropertiesService` call:

```javascript
// ❌ BEFORE (line ~95):
DRIVE_FOLDER_ID: '1ACiv3LS5PrvNiQdscXCbCDzSC2phav3s',

// ✅ AFTER:
DRIVE_FOLDER_ID: PropertiesService.getScriptProperties().getProperty('PROJECTS_DRIVE_FOLDER_ID'),
```

```javascript
// ❌ BEFORE (line ~112):
ORG_CHART_FOLDER_ID: '1_k7uANemaDnWPTUY1piYOcJg0lBiW_H-',

// ✅ AFTER:
ORG_CHART_FOLDER_ID: PropertiesService.getScriptProperties().getProperty('ORG_CHART_FOLDER_ID'),
```

```javascript
// ❌ BEFORE (line ~136, inside HOMEPAGE_DEV_INFO_CONFIG):
PROFILE_FOLDER_ID: '1gofrR_P3W3G2FPI_VPejv6JLVgivQAiz',

// ✅ AFTER:
PROFILE_FOLDER_ID: PropertiesService.getScriptProperties().getProperty('DEV_PROFILE_FOLDER_ID'),
```

```javascript
// ❌ BEFORE (line ~161, inside HOMEPAGE_FOUNDER_INFO_CONFIG):
PROFILE_FOLDER_ID: '1Myzg0iFO8yY3Hs-uX1D7HzFlMHfBEASU',

// ✅ AFTER:
PROFILE_FOLDER_ID: PropertiesService.getScriptProperties().getProperty('FOUNDER_PROFILE_FOLDER_ID'),
```

> **Tip:** To avoid calling `PropertiesService` on every request, you can cache the IDs at the top of the file:
> ```javascript
> const SCRIPT_PROPS_ = PropertiesService.getScriptProperties();
> ```
> Then use `SCRIPT_PROPS_.getProperty('...')` everywhere.

**After all 4 replacements:** Redeploy the Homepage project.

---

### 8c. Notifications_Main.gs — Remove hardcoded fallback ID

**Prerequisite:** Confirm `NOTIFICATIONS_SPREADSHEET_ID` is set in Script Properties (see [Section 2 → Notifications Project](#-notifications-project)).

```javascript
// ❌ BEFORE (line ~25):
return PropertiesService.getScriptProperties().getProperty('NOTIFICATIONS_SPREADSHEET_ID')
    || '1hKuLWjMEZkK-PndFHbOsv7ks68V5-1g9e5p8osSE21w';

// ✅ AFTER:
const id = PropertiesService.getScriptProperties().getProperty('NOTIFICATIONS_SPREADSHEET_ID');
if (!id) throw new Error('NOTIFICATIONS_SPREADSHEET_ID is not set in Script Properties');
return id;
```

**Then:** Redeploy the Notifications project.

---

### 8d. Secrets.gs — Enable Gemini API key loading from Script Properties

**Prerequisite:** `GEMINI_API_KEY` must be set in the Login project's Script Properties (see [Section 2 → Login Project](#-login-project)).

The `API_KEYS` array is currently empty and the runtime loading code is commented out. Fix:

```javascript
// ❌ BEFORE (lines 12-15):
const API_KEYS = [];
// Populate from Script Properties at runtime if needed:
// const storedKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
// if (storedKey) API_KEYS.push(storedKey);

// ✅ AFTER:
const API_KEYS = [];
const storedKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
if (storedKey) API_KEYS.push(storedKey);
```

**Then:** Redeploy the Login project. Test the ChatBot to confirm Gemini API calls succeed.

---

### 8e. Verification checklist

After applying all code changes and redeploying:

- [ ] **Issuance:** Open the Issuance page → create a test issuance → verify it saves to the correct spreadsheet and generates a PDF in the correct folder
- [ ] **Homepage:** Load the homepage → verify Projects section images, Org Chart, Dev profiles, and Founder profiles all load correctly
- [ ] **Notifications:** Trigger a test notification → verify it reads/writes to the correct spreadsheet
- [ ] **ChatBot:** Send a test message to the AI ChatBot → verify it responds (Gemini API key is loading)

---

## 9. Known Limitations & Future Work

> Issues from the [WEBAPP_DIAGNOSIS_REPORT.md](./WEBAPP_DIAGNOSIS_REPORT.md) that are documented but deferred for future phases.

### Security

| Item | Summary | Ref |
|---|---|---|
| **Rate limiting** | Only the `/login` endpoint has rate limiting (5 attempts / 15 min via `CacheService`). Other endpoints (directory search, attendance, system tools, notifications) have **no rate limiting** and are vulnerable to abuse. | H8 |
| **Session obfuscation** | Session tokens are XOR-obfuscated in `localStorage` — better than plaintext, but not true encryption. The XOR key is embedded in the bundled JavaScript. An `httpOnly` cookie approach would be more secure. | C6 |

### Architecture

| Item | Summary | Ref |
|---|---|---|
| **App.tsx is 5,644 lines** | Contains 60+ `useState` hooks in a single component. Needs decomposition into smaller components (target: <500 lines each). This is a multi-day refactor with regression risk. | H1, H2 |
| **`any` types in 20+ locations** | ESLint warns but doesn't block. Locations include service files, modals, dashboard pages. Should be replaced with proper TypeScript interfaces. | H6 |

### Code Quality

| Item | Summary | Ref |
|---|---|---|
| **Array index as React key** | Used in 20+ component locations (`key={index}`). Can cause rendering issues when list items are reordered. Should use unique identifiers. | M1 |
| **`dangerouslySetInnerHTML`** | Used in `MaintenanceScreen.tsx` (lines 177, 411) and `chart.tsx` (line 83). Low actual risk — only `<style>` tags rendered, no user-generated HTML. | M2 |
| **Duplicated GAS utility functions** | `isRequestCancelled_()`, `createSuccessResponse()`, `createErrorResponse()`, and column-index-building logic are duplicated across 8+ GAS files. Should be extracted to a shared utilities library. | M7 |
| **Long functions** | `handleLogin()` in `Loginpage_Main.gs` (~130 lines), `handleDatabaseBackup()` in `SystemTools_Main.gs` (~140 lines). Should be broken into smaller single-purpose functions. | M8 |
| **Full spreadsheet reads** | Most GAS files use `sheet.getDataRange().getValues()` which reads entire sheets. Performance degrades as data grows. Should use indexed lookups, pagination, or `CacheService`. | M4 |

### Audit & Compliance

| Item | Summary | Ref |
|---|---|---|
| **No profile modification audit trail** | `Profile_Audit_Export.gs` is a profile **completeness** report, not a change tracker. There is no mechanism to log who changed what field in user profiles (especially admin edits). | M15 |
| **Access logs archival** | Already implemented — `clearAllAccessLogs`, `clearAccessLogsByDateRange`, and `clearSpecificAccessLogs` all archive to Drive before deletion. | M9 ✅ |

### Accessibility

| Item | Summary | Ref |
|---|---|---|
| **Partial `aria-label` coverage** | ~43 `aria-label` instances across the codebase, concentrated on close/toggle buttons. Several major pages (`SystemToolsPage`, `MyProfilePage`, `ManageMembersPage`, `IssuanceCenterPage`) appear to have icon-only buttons without labels. No `aria-live` regions for toast notifications. | L8 |

### Dependencies

| Item | Summary | Ref |
|---|---|---|
| **Major version upgrades available** | React 18→19, Recharts 2→3, react-day-picker 8→9, react-resizable-panels 2→4, @vitejs/plugin-react-swc 3→4, @types/node 20→25. All have breaking changes and should be done one at a time with thorough testing. | Report metrics |

---

## Quick Reference: What to Do After a Fresh Clone

```
Step 1:  npm install
Step 2:  Copy .env.example → .env → fill in all values (see Section 1)
Step 3:  Set GAS Script Properties for each project (see Section 2)
Step 4:  Deploy all GAS projects as Web Apps (see Section 4)
Step 5:  Paste deployed URLs into .env and Vercel
Step 6:  Run migratePasswordsToSalted() if upgrading (see Section 3a)
Step 7:  npm run build    ← verify everything compiles
Step 8:  npm run dev       ← start local dev server
```

---

## Summary of All Spreadsheets & Folders

| Resource | ID | Type | Used By |
|---|---|---|---|
| **User Profiles** spreadsheet | `1vaQZoPq5a_verhICIiWXudBjAmfgFSIbaBX5xt9kjMk` | Google Sheet | Login, Directory, Attendance, SystemTools, ChatBot, Issuance |
| **Events** spreadsheet | `1Xn7w9kzNrP6dmZXYXjxaO11Lmao79wn9w1SPCiqFtcA` | Google Sheet | Attendance_Events, Attendance_Main, SystemTools, Issuance |
| **Homepage** spreadsheet | `1p7zOte14Tu8wrL5VTlU326EQ0Bf8f4uCFwKpJiHnD30` | Google Sheet | Homepage_Main (container-bound) |
| **System Settings** spreadsheet | `1ZhgrpKE3zCzohqVri0kLhi-R0HVlqjhyvMeF4su8BfI` | Google Sheet | SystemTools |
| **Notifications** spreadsheet | `1hKuLWjMEZkK-PndFHbOsv7ks68V5-1g9e5p8osSE21w` | Google Sheet | Notifications_Main |
| **Feedback** spreadsheet | `1837AfQpepOB0IIHtUvTqomBmeaiX-5r64J8tEpEmXL4` | Google Sheet | Feedback_Main |
| **Issuance** spreadsheet | `1HUimmBnzy1Rr7Kg-x24iiscKTmqHJdzDoV72N3u4wmE` | Google Sheet | Issuance_Main |
| Profile Pictures folder | `1QVb7--Ozam5QNokT1dC9Uzzg-T5QoPZx` | Drive Folder | Loginpage_Main |
| Projects Images folder | `1ACiv3LS5PrvNiQdscXCbCDzSC2phav3s` | Drive Folder | Homepage_Main |
| Org Chart folder | `1_k7uANemaDnWPTUY1piYOcJg0lBiW_H-` | Drive Folder | Homepage_Main |
| Dev Profile folder | `1gofrR_P3W3G2FPI_VPejv6JLVgivQAiz` | Drive Folder | Homepage_Main |
| Founder Profile folder | `1Myzg0iFO8yY3Hs-uX1D7HzFlMHfBEASU` | Drive Folder | Homepage_Main |
| PDF folder | `1e6g6JLr7y9VcJJ2wQ5jijNu9z6WAmDnt` | Drive Folder | Issuance_Main |
| Feedback Images folder | `1K-QweGSEp2HNQZnkPIE8f3FKuQkLp_mp` | Drive Folder | Feedback_Main |
| Backups folder | `1n487dwMvqUbCP8s1ETFfRGF64ds01pXj` | Drive Folder | SystemTools |
| Access Logs Archive folder | `1v147QE9DUACrIMcnVNUk7WgevFWBVHfO` | Drive Folder | SystemTools |
| Access Logs Manual Export folder | `1LBMul1VdSubotA9FiwI4kvHsmUSv-n2k` | Drive Folder | SystemTools |
