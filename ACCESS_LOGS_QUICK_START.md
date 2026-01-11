# Access Logs - Quick Setup & Deployment Guide

## 🚀 5-Minute Deployment

### Prerequisites
- ✅ Node.js 16+ and npm installed
- ✅ VS Code or similar editor
- ✅ Google Apps Script access
- ✅ Environment variables configured

---

## Step 1: Deploy Backend (GAS)

### 1.1 Copy New Functions
```
File: gas-backend/SystemTools_Main.gs

NEW FUNCTIONS TO ADD:
✓ initializeAccessLogsSheet() [~50 lines]
✓ handleLogAccess() [~20 lines]
✓ handleGetAccessLogs() [~50 lines]
✓ handleGetAccessLogsStats() [~50 lines]

NEW ROUTES TO ADD (in doPost):
✓ case 'getAccessLogs': handleGetAccessLogs()
✓ case 'logAccess': handleLogAccess()
✓ case 'getAccessLogsStats': handleGetAccessLogsStats()
```

### 1.2 Deploy to GAS
1. Open Google Apps Script: `script.google.com`
2. Select your project
3. Replace SystemTools_Main.gs content
4. Click "Deploy" → "New deployment"
5. Select type: "Web app"
6. Execute as: Your account
7. New users: "Anyone"
8. Click "Deploy"
9. Copy the Deployment ID

### 1.3 Test Backend
```javascript
// In GAS editor, run:
function test() {
  debugCheckConnections(); // Should show all OK
}
```

---

## Step 2: Configure Environment

### 2.1 Set API URL
```env
# .env or .env.local
VITE_GAS_SYSTEM_TOOLS_API_URL=https://script.google.com/macros/d/{DEPLOYMENT_ID}/usercopy

# Or use existing login API
VITE_GAS_LOGIN_API_URL=<your-existing-url>
```

### 2.2 Verify Configuration
```bash
# Check that API URL is set
grep "VITE_GAS" .env
```

---

## Step 3: Deploy Frontend

### 3.1 Install Dependencies (if needed)
```bash
cd /path/to/project
npm install
```

### 3.2 Build Project
```bash
npm run build
```

### 3.3 Deploy to Vercel (or your host)
```bash
npm run deploy
# or
vercel
```

---

## Step 4: Verify Everything Works

### 4.1 Test in Browser
1. Open your app URL
2. Login as AUDITOR role
3. Navigate to "Access Logs"
4. Verify:
   - [ ] Skeleton loads for 2 seconds
   - [ ] Real logs appear from backend
   - [ ] Stats show correct numbers
   - [ ] Filters work (click buttons)
   - [ ] Search works in real-time
   - [ ] View toggle works (tile/table)
   - [ ] Click log for detail modal

### 4.2 Test Exports
1. Click "Export PDF"
   - [ ] Progress toast shows
   - [ ] Progress bar fills to 100%
   - [ ] PDF downloads
   - [ ] Toast shows success
   - [ ] Auto-dismisses in 3 seconds

2. Click "Export CSV"
   - [ ] Progress toast shows
   - [ ] Progress bar fills to 100%
   - [ ] CSV downloads
   - [ ] Can open in Excel/Sheets
   - [ ] Data matches table

### 4.3 Test Error Handling
1. Temporarily break API URL
2. Refresh page
3. Verify:
   - [ ] Error message shows
   - [ ] "Retry" button appears
   - [ ] Can click retry to recover

---

## Step 5: Monitor & Maintain

### 5.1 Check Logs
```
Location: Google Sheets > System Settings > Access Logs
Columns: User | Action | Type | Status | Timestamp | IP | Device
```

### 5.2 Regular Maintenance
```
Weekly:
- Check Access Logs sheet (growing normally?)
- Review failed login attempts (security)
- Monitor IP addresses for unusual patterns

Monthly:
- Archive logs older than 3 months
- Backup database via System Tools
- Review statistics

Quarterly:
- Deep security audit
- Performance optimization
- Update documentation
```

---

## Troubleshooting

### Issue: "API URL not configured"
**Solution:**
```bash
# Check .env file exists and has:
VITE_GAS_SYSTEM_TOOLS_API_URL=<your-url>

# Rebuild:
npm run build
```

### Issue: "No logs showing"
**Solution:**
1. Check GAS deployment is active
2. Verify API URL is correct
3. Open browser console (F12)
4. Check for errors in Network tab
5. Run `debugCheckConnections()` in GAS

### Issue: "Export fails"
**Solution:**
1. Verify jsPDF and autoTable installed
2. Check browser console for errors
3. Try CSV export first (simpler)
4. Check available disk space

### Issue: "Skeleton loader stuck"
**Solution:**
1. Hard refresh (Ctrl+Shift+R)
2. Clear browser cache
3. Check network connection
4. Verify GAS API is responding

---

## Performance Tips

### Optimize Data Loading
```javascript
// Instead of:
limit: 1000  // Loads 1000 logs at once

// Use:
limit: 50    // Load 50, allow pagination
```

### Cache Statistics
```javascript
// Cache stats for 1 minute
const STATS_CACHE_TTL = 60 * 1000;
```

### Archive Old Logs
```javascript
// Monthly cleanup
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
// Delete logs before this date
```

---

## Security Checklist

- [✓] Access Logs page is auditor-only
- [✓] RBAC enforced in App.tsx
- [✓] Timestamps are server-side (can't spoof)
- [✓] IP addresses logged for audit trail
- [✓] No sensitive data stored
- [✓] API calls over HTTPS
- [✓] Error messages don't leak system info

---

## Files Changed Summary

```
MODIFIED: 3 files
CREATED:  3 documentation files

Backend (Gas):
  gas-backend/SystemTools_Main.gs
  - Added: ~170 lines of code
  - Functions: 4 new
  - Routes: 3 new

Frontend (React):
  src/components/AccessLogsPage.tsx
  - Removed: All demo data
  - Added: Real data integration
  - Added: Skeleton loading
  - Added: Export functionality
  - Added: Progress tracking

Integration:
  src/App.tsx
  - Added: Toast props passing
  - Added: Username prop passing

Documentation:
  ACCESS_LOGS_IMPLEMENTATION_COMPLETE.md
  ACCESS_LOGS_API_REFERENCE.md
  ACCESS_LOGS_VISUAL_SUMMARY.md
```

---

## Rollback Plan (if needed)

If something goes wrong:

### Option 1: Revert Backend
```
1. Go to Google Apps Script
2. Deployments > View all
3. Select previous version
4. Click deploy
5. Update DEPLOYMENT_ID in .env
```

### Option 2: Revert Frontend
```bash
# Using Git:
git revert <commit-hash>
npm run build
npm run deploy
```

### Option 3: Hard Rollback
```bash
# Use previous build/backup
vercel deployments list
vercel --prod <previous-url>
```

---

## Success Indicators

After deployment, you should see:

```
✅ Access Logs page loads (auditor-only)
✅ Real data shows (not demo data)
✅ Skeleton loader during fetch
✅ Stats calculate correctly
✅ Filters work without page reload
✅ Search updates in real-time
✅ PDF export with progress
✅ CSV export with progress
✅ Progress toast shows 0-100%
✅ Exports download successfully
✅ Dark mode styling works
✅ Mobile responsive layout
✅ No console errors
✅ No TypeScript warnings
```

---

## Next Steps

After successful deployment:

1. **Monitor:** Watch for errors in first 24 hours
2. **Test:** Have users test in staging first
3. **Document:** Share API reference with team
4. **Train:** Show team how to use new features
5. **Archive:** Set up monthly log archival
6. **Security:** Review access logs regularly

---

## Support Resources

- **API Reference:** ACCESS_LOGS_API_REFERENCE.md
- **Implementation Details:** ACCESS_LOGS_IMPLEMENTATION_COMPLETE.md
- **Visual Overview:** ACCESS_LOGS_VISUAL_SUMMARY.md
- **Code:** src/components/AccessLogsPage.tsx (inline comments)
- **Backend:** gas-backend/SystemTools_Main.gs (inline comments)

---

## Contact

For issues:
1. Check documentation
2. Review browser console (F12)
3. Check GAS logs
4. Verify environment variables
5. Test with curl/Postman
6. Contact development team

---

**🎉 You're all set! Access Logs page is ready to go live!**

**Date:** January 11, 2026  
**Status:** ✅ Production Ready  
**Version:** 2.0
