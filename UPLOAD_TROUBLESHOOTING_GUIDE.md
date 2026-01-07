# 🔧 UPLOAD SYSTEM - TROUBLESHOOTING GUIDE

## Common Issues & Solutions

---

## Issue 1: Data Still Not Appearing in Google Sheets ❌

### Symptoms
- Upload succeeds locally
- Success toast appears
- Project visible in app
- BUT Google Sheets is still empty

### Diagnosis Steps

#### Step 1: Check GAS URL Configuration
```
File: .env or .env.local
Look for: VITE_GAS_HOMEPAGE_API_URL=https://script.google.com/macros/d/.../usercontent

Is it present? 
  ✅ YES → Go to Step 2
  ❌ NO → Add the GAS URL to .env file
```

#### Step 2: Test GAS Endpoint
1. Open browser DevTools (F12)
2. Go to Network tab
3. Try uploading a project
4. Look for POST request to your GAS URL
5. Click on the request
6. Check Response tab

**Expected Response:**
```json
{
  "success": true,
  "message": "Project added successfully",
  "projectId": "PRJ-abc123...",
  "data": {
    "projectId": "PRJ-abc123...",
    "title": "My Project",
    "description": "...",
    "imageUrl": "data:image/jpeg;base64,...",
    "link": "...",
    "linkText": "...",
    "status": "Active"
  }
}
```

**If seeing error:**
```json
{
  "success": false,
  "error": "..."
}
```

Go to Step 3.

#### Step 3: Check GAS Deployment
1. Open Google Apps Script (from Sheets > Extensions > Apps Script)
2. Click "Deploy" button
3. Verify deployment is set to:
   - **Type:** Web app
   - **Execute as:** Me
   - **Who has access:** Anyone
4. Copy the deployment URL
5. Update .env with this URL

#### Step 4: Check Google Sheets Tab
1. Open the Google Sheets associated with GAS
2. Look for "Homepage_Projects" sheet tab
3. Does it exist?
   - ✅ YES → Check if data is in it
   - ❌ NO → GAS will auto-create on first project upload

#### Step 5: Check Project Data in Sheets
1. Go to "Homepage_Projects" sheet
2. Headers should be: ProjectID | Title | Description | ImageURL | Link | LinkText | Status
3. Data rows should have your uploaded projects
4. If empty:
   - Try uploading again
   - Check browser console for errors

### Solution Checklist
- [ ] GAS URL is configured in .env
- [ ] GAS is deployed as "Web app" for "Anyone"
- [ ] "Homepage_Projects" sheet exists
- [ ] Browser console shows no errors
- [ ] Network tab shows successful POST requests
- [ ] Uploaded project data appears in sheet

---

## Issue 2: Orange Button Not Showing ❌

### Symptoms
- Button area is blank or shows old design
- Orange color not visible
- Can still upload but don't see new button

### Causes & Solutions

#### Solution 1: Clear Browser Cache
1. Press `Ctrl+Shift+Delete` (or Cmd+Shift+Delete on Mac)
2. Select "All time" time range
3. Check all boxes
4. Click "Clear data"
5. Refresh page (Ctrl+R)

#### Solution 2: Hard Refresh
1. Press `Ctrl+Shift+R` (or Cmd+Shift+R on Mac)
2. This skips cache completely

#### Solution 3: Check Tailwind CSS
1. Open DevTools (F12)
2. Go to Console tab
3. Paste: `document.querySelectorAll('[class*="orange"]').length`
4. Should return > 0
5. If returns 0, Tailwind CSS not loaded

#### Solution 4: Check CSS in HTML
1. Go to page source (Ctrl+U)
2. Search for "tailwind"
3. Should find Tailwind CSS link
4. If not found, CSS not imported

### If Still Not Working
1. Check if the file saved properly: `src/App.tsx`
2. Verify line 3610-3620 has orange button code
3. Restart dev server: `npm run dev`
4. Check for build errors in terminal

---

## Issue 3: Progress Toast Not Showing ❌

### Symptoms
- Upload seems to work
- But no progress indicator at bottom-right
- No visual feedback

### Diagnosis

#### Check 1: Is toast container rendered?
1. DevTools > Elements tab
2. Search for "UploadToastContainer"
3. Should find the component

#### Check 2: Is state updating?
1. DevTools > Console
2. Paste: `localStorage.getItem('debug_upload_toast')`
3. Should show toast messages

#### Check 3: CSS hidden?
1. Right-click bottom-right corner
2. Select "Inspect"
3. Check if element has `display: none`
4. Check `z-index` (should be high)

### Solutions

#### Solution 1: Restart Dev Server
```bash
Ctrl+C (stop server)
npm run dev (restart)
```

#### Solution 2: Check Browser Extensions
1. Disable ad blockers
2. Disable popup blockers
3. They may be blocking toast

#### Solution 3: Clear App Cache
```javascript
// Open DevTools Console and run:
localStorage.clear()
sessionStorage.clear()
```

#### Solution 4: Check for JavaScript Errors
1. Open DevTools Console
2. Look for red error messages
3. Check if UploadToast component is imported

---

## Issue 4: Upload Stuck in Loading State ❌

### Symptoms
- Click upload
- Loading toast shows
- Spinner keeps spinning forever
- Never reaches 100%

### Causes

#### Cause 1: Network Issue
- Check internet connection
- Try uploading with smaller image

#### Cause 2: GAS Endpoint Timeout
- Large image taking too long
- Server unresponsive

#### Cause 3: CORS Issue
- GAS endpoint blocked by browser
- Check browser console for CORS error

### Solutions

#### Solution 1: Check Network Tab
1. DevTools > Network tab
2. Try uploading
3. Watch for:
   - Red X = request failed
   - Hanging request = server not responding
   - 403/500 errors = server issue

#### Solution 2: Check Image Size
1. Ensure image < 5MB
2. Try with smaller image
3. Check file type (JPEG/PNG)

#### Solution 3: Check GAS Logs
1. Open GAS (Extensions > Apps Script)
2. Go to "Executions" tab
3. Look for recent failures
4. Check error messages
5. Fix any issues noted

#### Solution 4: Timeout Fix
```javascript
// Edit the fetch timeout (in handleUploadProject)
const uploadResponse = await fetch(gasUrl, {
  method: 'POST',
  body: JSON.stringify({...}),
  signal: AbortSignal.timeout(30000) // 30 second timeout
});
```

---

## Issue 5: Image Not Uploading But Project Data Shows ❌

### Symptoms
- Project created successfully
- Data in Google Sheets
- But image URL shows as broken
- Image shows 404 error

### Cause
Image is stored as base64 data URL, which might be too large for Sheets.

### Solution 1: Use External Image Host
Instead of base64, use:
- Imgur (free image hosting)
- Google Drive (with public sharing)
- AWS S3
- Cloudinary

### Solution 2: Compress Image
1. Before uploading:
2. Reduce dimensions (e.g., 800x600)
3. Use JPEG instead of PNG
4. Compress using online tool

### Solution 3: Check Image URL in Sheets
1. Open "Homepage_Projects" sheet
2. Click on ImageURL cell
3. Should start with `data:image/` or `https://`
4. If broken, re-upload

---

## Issue 6: Error "GAS backend URL not configured"

### Symptoms
- Toast shows: "GAS backend URL not configured"
- Upload fails immediately

### Cause
Environment variable not set.

### Solution
1. Create/edit `.env.local` file in project root
2. Add:
```
VITE_GAS_HOMEPAGE_API_URL=https://script.google.com/macros/d/YOUR_DEPLOYMENT_ID/usercontent
```

3. Replace `YOUR_DEPLOYMENT_ID` with actual ID from GAS
4. Save file
5. Restart dev server (`npm run dev`)

---

## Issue 7: Permission Error from GAS

### Symptoms
- Toast shows: "You do not have permission..."
- OR: "Authorization required"

### Cause
GAS not deployed properly or not authorized.

### Solution
1. Open GAS (Extensions > Apps Script in Sheets)
2. Click "Deploy" > "New Deployment"
3. Select type: "Web app"
4. Execute as: "Me" (your account)
5. Who has access: "Anyone"
6. Copy new URL
7. Update .env
8. Test again

---

## Issue 8: Button Disabled After Upload Fails

### Symptoms
- Upload fails
- Button stays disabled (grayed out)
- Can't retry

### Cause
Error in error handling code.

### Solution
1. Check console for errors
2. Reload page (should reset)
3. Or clear localStorage:
```javascript
localStorage.clear()
// Reload page
```

---

## Debug Checklist

When upload fails, check in this order:

1. **Network Tab**
   - [ ] POST request sent to GAS URL
   - [ ] Response has `success: true`
   - [ ] No CORS errors
   - [ ] No timeout errors

2. **Console Errors**
   - [ ] No red error messages
   - [ ] No "Cannot read property" errors
   - [ ] No fetch/network errors

3. **Environment**
   - [ ] .env file exists
   - [ ] VITE_GAS_HOMEPAGE_API_URL set
   - [ ] GAS URL is valid/current
   - [ ] Dev server restarted

4. **GAS Backend**
   - [ ] GAS script exists
   - [ ] Deployed as Web App
   - [ ] Execute as: Me
   - [ ] Access: Anyone
   - [ ] No errors in GAS logs

5. **Google Sheets**
   - [ ] Sheet exists (Homepage_Projects)
   - [ ] Headers present
   - [ ] Permissions allow writes
   - [ ] Not read-only

6. **Image**
   - [ ] File < 5MB
   - [ ] Format JPEG/PNG
   - [ ] Not corrupted

---

## Getting Help

If none of above solutions work:

### Collect Information
1. Screenshot of error
2. Console errors (copy-paste)
3. Network request/response
4. .env configuration
5. GAS execution logs

### Check These Resources
- [GAS Troubleshooting Guide](https://developers.google.com/apps-script/guides/troubleshoot)
- [Fetch API Errors](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [Tailwind CSS Docs](https://tailwindcss.com)

### Ask for Help
Provide:
- [ ] Error message (exact text)
- [ ] What you tried
- [ ] Steps to reproduce
- [ ] Browser/OS version
- [ ] Screenshots of:
  - Error toast
  - Console errors
  - Network tab
  - GAS logs

---

## Prevention Tips

To avoid issues in future:

1. **Always check environment variables**
   - Print to console: `console.log(import.meta.env.VITE_GAS_HOMEPAGE_API_URL)`
   - Confirm it shows a valid URL

2. **Test GAS endpoint separately**
   - Use Postman or curl
   - Verify it responds correctly

3. **Monitor Google Sheets**
   - Regularly check if data appears
   - Catch issues early

4. **Keep images reasonable**
   - < 3MB is safe
   - Use JPEG for photos

5. **Log progress**
   - Add `console.log` at each stage
   - Makes debugging easier

6. **Test in incognito**
   - Avoid cache issues
   - Fresh browser state

7. **Backup data**
   - Regularly export from Sheets
   - Keep local copy

---

## Summary

| Issue | Quick Fix |
|-------|-----------|
| No data in Sheets | Check GAS URL config |
| No orange button | Clear cache + hard refresh |
| No progress toast | Restart dev server |
| Upload stuck | Check network tab |
| Broken images | Compress image before upload |
| Permission error | Redeploy GAS as "Anyone" |
| Button disabled | Reload page + clear localStorage |

**Status:** Troubleshooting Guide Complete ✅

**Last Updated:** January 7, 2026
