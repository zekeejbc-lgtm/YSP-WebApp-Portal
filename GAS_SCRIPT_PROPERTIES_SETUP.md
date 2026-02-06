# GAS Script Properties Setup Guide

> **Comprehensive instructions for configuring all Apps Script projects**  
> Last updated: February 6, 2026

---

## Table of Contents

1. [How to Find Your Apps Script Projects](#how-to-find-your-apps-script-projects)
2. [How to Set Script Properties](#how-to-set-script-properties)
3. [Login Project Setup](#login-project-setup)
4. [Attendance Events Project Setup](#attendance-events-project-setup)
5. [Attendance Main Project Setup](#attendance-main-project-setup)
6. [Notifications Project Setup](#notifications-project-setup)
7. [Feedback Project Setup](#feedback-project-setup)
8. [Verification Checklist](#verification-checklist)

---

## How to Find Your Apps Script Projects

### Step 1: Go to Apps Script Dashboard

1. Visit **[script.google.com](https://script.google.com/)**
2. You should see a list of all your Apps Script projects
3. Look for projects with these names:
   - **"Loginpage_Main"** ← Login Project
   - **"Attendance_Events"** ← Attendance Events Project
   - **"Attendance_Main"** ← Attendance Main Project
   - **"Notifications_Main"** ← Notifications Project
   - **"Feedback_Main"** ← Feedback Project

### Step 2: Click on a Project to Open It

- Click on the project name to open the Apps Script editor
- The editor shows all the `.gs` files for that project

### Alternative: Access Directly from Deployments

If you can't find a project in the dashboard:
1. Open your `.env` file (you have the deployed URLs)
2. Take one of the URLs: `https://script.google.com/macros/s/AKfycbxjRlhqh4pJD5M2wsjr.../exec`
3. The part between `/s/` and `/exec` is the **Deployment ID**
4. Go to **[script.google.com](https://script.google.com/)** → search for the project by name

---

## How to Set Script Properties

### Universal Process (Same for ALL Projects)

1. **Open the Apps Script project** (click on the project name)
2. Click the **⚙️ gear icon** in the left sidebar → **Project Settings**
3. Scroll down to **"Script Properties"** section
4. Click **"Edit script properties"**
5. A dialog opens showing a table with **Property** and **Value** columns
6. For each property below:
   - Click **+ Add script property**
   - Enter the **Property name** (exact spelling)
   - Enter the **Value** (the Sheet ID or Folder ID)
   - Press **Enter** or **Tab** to add the next one
7. When done, click **"Save script properties"** button
8. Close the dialog

### How to Test if Properties Are Set

In the Apps Script editor:
1. Click **⚙️ Project Settings** again
2. Scroll to **Script Properties**
3. Click **Edit script properties**
4. Verify all properties appear in the table with values (not empty)
5. Click **Save** and close

---

## Login Project Setup

**Project Name:** Loginpage_Main  
**Files in this project:**
- `Loginpage_Main.gs`
- `Loginpage_Hash.gs`
- `Directory_Main.gs`
- `Directory_Migrate.gs`
- `Profile_Audit_Export.gs`
- `SystemTools_Main.gs`
- `YSP_Ai ChatBot.gs`
- `Secrets.gs`

**Deployed as:** Single Web App (one URL in `VITE_GAS_LOGIN_API_URL`)

### Script Properties to Add

| Property Name | Value | How to Find |
|---|---|---|
| `LOGIN_SPREADSHEET_ID` | User Profiles sheet ID | Open "User Profiles" Google Sheet → copy ID from URL |
| `PROFILE_PICTURES_FOLDER_ID` | Profile pictures folder ID | Open folder in Google Drive → copy ID from URL |
| `SYSTEM_SETTINGS_SPREADSHEET_ID` | System Settings sheet ID | Open "System Settings" Google Sheet → copy ID |
| `EVENTS_SPREADSHEET_ID` | Events sheet ID | Open "Events" Google Sheet → copy ID |
| `HOMEPAGE_SPREADSHEET_ID` | Homepage sheet ID | Open "Homepage" Google Sheet → copy ID |
| `BACKUPS_FOLDER_ID` | Backups folder ID | Open/create "Backups" folder → copy ID |
| `ACCESS_LOGS_ARCHIVE_FOLDER_ID` | Access logs archive folder ID | Open/create "Access Logs Archive" folder → copy ID |
| `ACCESS_LOGS_MANUAL_EXPORT_FOLDER_ID` | Manual export folder ID | Open/create "Access Logs Manual Export" folder → copy ID |

### Step-by-Step for Login Project

1. Go to [script.google.com](https://script.google.com/)
2. Find and click **"Loginpage_Main"** project
3. Click **⚙️ Project Settings** → scroll down → **Script Properties** → **Edit script properties**
4. Add all 8 properties from the table above
5. Click **Save script properties**
6. **After deployment** (see Phase 4), verify by running: `Logger.log(PropertiesService.getScriptProperties().getProperty('LOGIN_SPREADSHEET_ID'))`

---

## Attendance Events Project Setup

**Project Name:** Attendance_Events  
**File in this project:**
- `Attendance_Events.gs`

**Deployed as:** Separate Web App (one URL in `VITE_GAS_EVENTS_API_URL`)

### Script Properties to Add

| Property Name | Value | How to Find |
|---|---|---|
| `EVENTS_SPREADSHEET_ID` | Events sheet ID | Open "Events" Google Sheet → copy ID from URL |

### Step-by-Step for Attendance Events Project

1. Go to [script.google.com](https://script.google.com/)
2. Find and click **"Attendance_Events"** project
3. Click **⚙️ Project Settings** → **Script Properties** → **Edit script properties**
4. Add `EVENTS_SPREADSHEET_ID`
5. Click **Save script properties**

---

## Attendance Main Project Setup

**Project Name:** Attendance_Main  
**File in this project:**
- `Attendance_Main.gs`

**Note:** Check if this is in the same project as `Attendance_Events` or separate. If separate, set both properties below.

### Script Properties to Add

| Property Name | Value | How to Find |
|---|---|---|
| `EVENTS_SPREADSHEET_ID` | Events sheet ID | Open "Events" Google Sheet → copy ID |
| `LOGIN_SPREADSHEET_ID` | User Profiles sheet ID | Open "User Profiles" Google Sheet → copy ID |

### Step-by-Step for Attendance Main Project

1. Go to [script.google.com](https://script.google.com/)
2. Find and click **"Attendance_Main"** project
3. Click **⚙️ Project Settings** → **Script Properties** → **Edit script properties**
4. Add both properties from the table above
5. Click **Save script properties**

---

## Notifications Project Setup

**Project Name:** Notifications_Main  
**File in this project:**
- `Notifications_Main.gs`

**Deployed as:** Separate Web App (one URL in `VITE_GAS_NOTIFICATIONS_API_URL`)

### Script Properties to Add

| Property Name | Value | How to Find |
|---|---|---|
| `NOTIFICATIONS_SPREADSHEET_ID` | Notifications sheet ID | Open "Notifications" Google Sheet → copy ID (or use default: `1hKuLWjMEZkK-PndFHbOsv7ks68V5-1g9e5p8osSE21w`) |
| `NOTIFICATIONS_API_URL` | **Set AFTER deployment** | After deploying this project, copy the deployed URL and paste it here |

### Step-by-Step for Notifications Project

1. Go to [script.google.com](https://script.google.com/)
2. Find and click **"Notifications_Main"** project
3. Click **⚙️ Project Settings** → **Script Properties** → **Edit script properties**
4. Add `NOTIFICATIONS_SPREADSHEET_ID` (and leave `NOTIFICATIONS_API_URL` empty for now)
5. Click **Save script properties**
6. **IMPORTANT:** Deploy this project first (see Phase 4 in MANUAL_SETUP_GUIDE.md)
7. After deployment, copy the deployed URL
8. Come back to **Script Properties** → **Edit** → add `NOTIFICATIONS_API_URL` with the copied URL
9. Click **Save script properties**

---

## Feedback Project Setup

**Project Name:** Feedback_Main  
**File in this project:**
- `Feedback_Main.gs`

**Deployed as:** Separate Web App (one URL in `VITE_GAS_FEEDBACK_API_URL`)

### Script Properties to Add

| Property Name | Value | How to Find |
|---|---|---|
| `FEEDBACK_SPREADSHEET_ID` | Feedback sheet ID | Open "Feedback" Google Sheet → copy ID |
| `FEEDBACK_SHEET_NAME` | Tab name in the sheet | Usually `Feedbacks` — check the sheet tab name at the bottom |
| `FEEDBACK_IMAGES_FOLDER_ID` | Feedback images folder ID | Open/create "Feedback Images" folder in Drive → copy ID |

### Step-by-Step for Feedback Project

1. Go to [script.google.com](https://script.google.com/)
2. Find and click **"Feedback_Main"** project
3. Click **⚙️ Project Settings** → **Script Properties** → **Edit script properties**
4. Add all 3 properties from the table above
5. Click **Save script properties**

---

## Verification Checklist

After setting all Script Properties, verify each project:

### ✅ Login Project
- [ ] Open project → ⚙️ Project Settings → Script Properties → see all 8 properties
- [ ] Test: Click **Editor** → type in the console area:
  ```javascript
  Logger.log(PropertiesService.getScriptProperties().getProperty('LOGIN_SPREADSHEET_ID'));
  ```
  Should print your sheet ID (not empty)

### ✅ Attendance Events Project
- [ ] Open project → ⚙️ Project Settings → Script Properties → see `EVENTS_SPREADSHEET_ID`

### ✅ Attendance Main Project
- [ ] Open project → ⚙️ Project Settings → Script Properties → see both properties

### ✅ Notifications Project
- [ ] Open project → ⚙️ Project Settings → Script Properties → see `NOTIFICATIONS_SPREADSHEET_ID`
- [ ] After deployment: see `NOTIFICATIONS_API_URL` with full deployed URL

### ✅ Feedback Project
- [ ] Open project → ⚙️ Project Settings → Script Properties → see all 3 properties

---

## Quick Reference: Where to Find IDs

### Google Sheet ID
**URL:** `https://docs.google.com/spreadsheets/d/**COPY_THIS_PART**/edit`

**Example:**
```
https://docs.google.com/spreadsheets/d/1ABC2DEF3GHI4JKL5MNO6PQR7STU8VWX9/edit
                                       ↑____________________________↑
                                              Sheet ID
```

### Drive Folder ID
**URL:** `https://drive.google.com/drive/folders/**COPY_THIS_PART**`

**Example:**
```
https://drive.google.com/drive/folders/1aXyZ9bCdE8fGhIjKlMnOpQrStUvWxYz
                                          ↑____________________________↑
                                                 Folder ID
```

### Gemini API Key
**Get from:** [Google AI Studio](https://aistudio.google.com/apikey)  
**Format:** Starts with `AIzaSy...`

---

## Common Issues & Solutions

### Issue: "PERMISSION_DENIED" when running a function

**Cause:** Script Properties not set, or set with wrong value

**Solution:**
1. Go to ⚙️ Project Settings → Script Properties → Edit
2. Verify all properties are there with values (not empty)
3. Check for typos in property names (must match EXACTLY)

### Issue: Script runs but says "Spreadsheet not found"

**Cause:** The Sheet ID in Script Properties is invalid or user doesn't have access

**Solution:**
1. Open the Google Sheet you're trying to use
2. Copy the ID from the URL again (make sure you copied the right part)
3. Update the Script Property with the correct ID
4. Test the script again

### Issue: Can't find a project in script.google.com

**Cause:** Project may be in a different Google account or archived

**Solution:**
1. Make sure you're logged into the right Google account
2. Check your .env file for the deployed URL
3. Try going directly to [script.google.com](https://script.google.com) and searching
4. If still not found, check if the project was deleted

---

## Summary: Order of Operations

```
1. Gather all Sheet IDs and Folder IDs (Phase 1)
2. Set Script Properties for Login Project (8 properties)
3. Set Script Properties for Attendance Events Project (1 property)
4. Set Script Properties for Attendance Main Project (2 properties)
5. Set Script Properties for Feedback Project (3 properties)
6. Set Script Properties for Notifications Project (1 property + 1 after deployment)
7. Deploy all GAS projects (Phase 4 in MANUAL_SETUP_GUIDE.md)
8. Complete Notifications setup (add API URL to Script Properties)
9. Run password salt migration (Phase 5 in MANUAL_SETUP_GUIDE.md)
10. Test everything (Phase 8 in MANUAL_SETUP_GUIDE.md)
```

---

## Need Help?

See **[MANUAL_SETUP_GUIDE.md](MANUAL_SETUP_GUIDE.md)** for:
- Complete deployment instructions
- Password migration steps
- One-time migrations
- Vercel setup

