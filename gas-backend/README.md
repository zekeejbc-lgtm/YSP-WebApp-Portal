# Google Apps Script Backend

This folder contains Google Apps Script files for the YSP Tagum WebApp backend.

## Files Overview

| File | Description |
|------|-------------|
| `Homepage_Main.gs` | Main homepage content API |
| `Loginpage_Main.gs` | User authentication and profile management API |
| `Loginpage_Hash.gs` | Password hashing and ID generation triggers |
| `Directory_Main.gs` | Officer directory search API |

## Sheets Structure

### User Profiles Sheet
Used by `Loginpage_Main.gs` and `Directory_Main.gs` for authentication and officer directory.

| Column | Header | Description |
|--------|--------|-------------|
| A | Timestamp | Form submission timestamp |
| B | Email Address | User's official email |
| D | Full name | User's full name |
| N | Username | Login username |
| O | Password | Hashed password |
| S | ID Code | Unique identifier (e.g., HD-001, MEM-020) |
| T | Position | User's position/title |
| U | Role | User role (auditor/admin/head/member/guest) |
| V | ProfilePictureURL | Profile picture URL |
| AL | Status | Account status (active/suspended/banned) |
| - | Committee | User's committee assignment |
| - | Contact Number | Phone number |
| - | Date of Birth | Birthday |
| - | Age | User's age |
| - | Sex/Gender | Gender |
| - | Civil Status | Marital status |
| - | Nationality | Nationality |
| - | Religion | Religion |
| - | Personal Email Address | Personal email |
| - | Address, Barangay, City, Province, Zip Code | Address fields |
| - | Chapter | YSP Chapter |
| - | Date Joined | Membership start date |
| - | Membership Type | Type of membership |
| - | Facebook, Instagram, Twitter | Social media links |
| - | Emergency Contact fields | Emergency contact info |

### Homepage_Main
Stores the main homepage content.

| Column | Header | Description |
|--------|--------|-------------|
| A | Main Heading | Main title displayed on hero |
| B | Sub Heading | Subtitle (e.g., "Tagum Chapter") |
| C | Tagline | Hero section tagline |
| D | Section Title_About Us | About section title |
| E | Content_About Us | About section content |
| F | Section Title_Our Mission | Mission section title |
| G | Content_Our Mission | Mission section content |
| H | Section Title_Our Vision | Vision section title |
| I | Content_Our Vision | Vision section content |
| J | Section Title_Our Advocacy Pillars | Advocacy section title |
| K | Content_Our Advocacy Pillars | Advocacy section content |

- **Row 1**: Headers
- **Row 2**: Values (editable content)

## Setup Instructions

### 1. Create Google Spreadsheet
1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet
3. Rename it to "YSP Tagum WebApp Data" (or your preferred name)
4. Rename the first sheet to `Homepage_Main`

### 2. Set Up Headers
Add these headers in Row 1 (A1 to K1):
```
Main Heading | Sub Heading | Tagline | Section Title_About Us | Content_About Us | Section Title_Our Mission | Content_Our Mission | Section Title_Our Vision | Content_Our Vision | Section Title_Our Advocacy Pillars | Content_Our Advocacy Pillars
```

### 3. Add Initial Content
Add your content in Row 2 (A2 to K2).

### 4. Create Apps Script
1. In Google Sheets, go to **Extensions > Apps Script**
2. Delete any existing code in `Code.gs`
3. Copy the contents of `Homepage_Main.gs` from this folder
4. Paste into the Apps Script editor
5. Save the project (Ctrl+S or Cmd+S)

### 5. Deploy as Web App
1. Click **Deploy > New deployment**
2. Click the gear icon ⚙️ next to "Select type"
3. Choose **Web app**
4. Configure:
   - **Description**: "Homepage API v1" (or similar)
   - **Execute as**: Me
   - **Who has access**: Anyone
5. Click **Deploy**
6. Copy the Web App URL

### 6. Configure Frontend
1. Open your project's `.env` file
2. Set the API URL:
   ```
   VITE_GAS_HOMEPAGE_API_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
   ```
3. Restart your development server

## Testing

### Test the API
You can test your deployed API by visiting:
```
https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

You should see a JSON response with your homepage content.

### Health Check
```
https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?action=health
```

## Updating the Script

When you update the script:
1. Make changes in Apps Script editor
2. Save the project
3. Go to **Deploy > Manage deployments**
4. Click the pencil icon ✏️ on your deployment
5. Change "Version" to "New version"
6. Click **Deploy**

## CORS Notes

The GAS Web App is configured to work with CORS by:
- Using `ContentService.createTextOutput()` with JSON MIME type
- Allowing GET and POST requests from any origin

If you encounter CORS issues:
1. Ensure the deployment is set to "Anyone" access
2. Use the `/exec` endpoint (not `/dev`)
3. Check browser console for specific error messages

## Security Considerations

- The API is public (Anyone can access)
- Consider adding authentication for write operations
- Keep your spreadsheet private if it contains sensitive data
- Monitor access logs in Google Cloud Console
