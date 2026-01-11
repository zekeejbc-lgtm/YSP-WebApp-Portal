# Access Logs API Reference Guide

## Quick Start

The Access Logs system is now fully integrated with the backend. Here's how to use it.

---

## API Endpoints

### 1. Get Access Logs

**Request:**
```javascript
fetch(GAS_API_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  body: JSON.stringify({
    action: 'getAccessLogs',
    page: 1,
    limit: 50,
    filterType: 'login' // or null for all types
  })
})
```

**Response:**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "1",
        "user": "Juan Dela Cruz",
        "action": "Logged into system",
        "type": "login",
        "status": "success",
        "timestamp": "2025-02-15T14:30:22.000Z",
        "ipAddress": "192.168.1.100",
        "device": "Chrome on Windows"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "totalLogs": 250,
      "totalPages": 5,
      "hasMore": true
    },
    "timestamp": "2025-02-15T14:35:00.000Z"
  }
}
```

---

### 2. Log Access

**Request:**
```javascript
fetch(GAS_API_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  body: JSON.stringify({
    action: 'logAccess',
    username: 'Juan Dela Cruz',
    action: 'Viewed Officer Directory',
    actionType: 'view',
    status: 'success',
    ipAddress: '192.168.1.100',
    device: 'Chrome on Windows'
  })
})
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Access logged successfully"
  }
}
```

---

### 3. Get Access Logs Statistics

**Request:**
```javascript
fetch(GAS_API_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  body: JSON.stringify({
    action: 'getAccessLogsStats'
  })
})
```

**Response:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalLogs": 250,
      "byStatus": {
        "success": 240,
        "failed": 8,
        "warning": 2
      },
      "byType": {
        "login": 80,
        "logout": 75,
        "view": 60,
        "edit": 20,
        "create": 10,
        "delete": 5
      },
      "recentLogs": [
        {
          "user": "Maria Santos",
          "action": "Viewed Officer Directory",
          "type": "view",
          "status": "success",
          "timestamp": "2025-02-15T14:35:22.000Z"
        }
      ]
    },
    "timestamp": "2025-02-15T14:35:00.000Z"
  }
}
```

---

## Action Types

Valid values for `actionType`:
- `login` - User authentication
- `logout` - User session ended
- `view` - Viewed a page/resource
- `edit` - Modified a record
- `create` - Created new content
- `delete` - Removed content

---

## Status Values

Valid values for `status`:
- `success` - Action completed successfully
- `failed` - Action failed (e.g., login attempt failed)
- `warning` - Action completed but with warnings

---

## Integration Examples

### Example 1: Log User Login

```typescript
async function handleUserLogin(username: string, ipAddress: string, device: string) {
  const result = await fetch(GAS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'logAccess',
      username,
      action: `Logged into system`,
      actionType: 'login',
      status: 'success',
      ipAddress,
      device
    })
  });
  
  const data = await result.json();
  if (data.success) {
    console.log('Login logged successfully');
  }
}
```

### Example 2: Fetch Filtered Logs

```typescript
async function fetchLoginLogs(page = 1) {
  const response = await fetch(GAS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'getAccessLogs',
      page,
      limit: 50,
      filterType: 'login' // Only login logs
    })
  });
  
  const data = await response.json();
  return data.data.logs;
}
```

### Example 3: Get System Statistics

```typescript
async function getAccessStats() {
  const response = await fetch(GAS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'getAccessLogsStats'
    })
  });
  
  const data = await response.json();
  console.log('Total logs:', data.data.stats.totalLogs);
  console.log('Success rate:', 
    (data.data.stats.byStatus.success / data.data.stats.totalLogs * 100).toFixed(2) + '%');
}
```

---

## Export Features

### PDF Export
- Uses jsPDF with professional formatting
- Orange branding header
- Statistics summary
- Full table of logs
- Footer with pagination info
- Progress tracking (0-100%)

**Usage:**
```typescript
const handleExportPDF = async () => {
  addUploadToast({
    id: `pdf-${Date.now()}`,
    title: 'Exporting PDF',
    message: 'Preparing document...',
    status: 'loading',
    progress: 0,
  });
  
  // ... PDF generation logic ...
  
  updateUploadToast(toastId, {
    status: 'success',
    progress: 100,
    message: 'File saved as "AccessLogs_2025-02-15.pdf"'
  });
};
```

### CSV Export
- Spreadsheet-compatible format
- Headers: User, Action, Type, Status, Timestamp, IP Address, Device
- Auto-download to browser
- Progress tracking (0-100%)

**Usage:**
```typescript
const handleExportCSV = async () => {
  addUploadToast({
    id: `csv-${Date.now()}`,
    title: 'Exporting CSV',
    message: 'Formatting data...',
    status: 'loading',
    progress: 0,
  });
  
  // ... CSV generation logic ...
  
  updateUploadToast(toastId, {
    status: 'success',
    progress: 100,
    message: 'File saved as "AccessLogs_2025-02-15.csv"'
  });
};
```

---

## Pagination

The system supports paginated results for large datasets:

```javascript
{
  "pagination": {
    "page": 1,           // Current page number
    "limit": 50,         // Items per page
    "totalLogs": 250,    // Total number of logs
    "totalPages": 5,     // Total number of pages
    "hasMore": true      // Is there more data?
  }
}
```

**Example: Fetch next page**
```typescript
const nextPageLogs = await fetch(GAS_API_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  body: JSON.stringify({
    action: 'getAccessLogs',
    page: 2,  // Next page
    limit: 50
  })
});
```

---

## Progress Toast System

The Access Logs page uses the standardized `UploadToast` system for all asynchronous operations:

```typescript
interface UploadToastMessage {
  id: string;                      // Unique identifier
  title: string;                   // Bold title
  message: string;                 // Descriptive message
  status: 'loading' | 'success' | 'error';
  progress?: number;               // 0-100 percentage
}
```

**Toast Lifecycle:**
1. Create: `addUploadToast({ id, title, message, status: 'loading', progress: 0 })`
2. Update: `updateUploadToast(id, { progress: 50, message: 'Processing...' })`
3. Complete: `updateUploadToast(id, { status: 'success', progress: 100 })`
4. Remove: `removeUploadToast(id)` (auto-removes after 3 seconds)

---

## Error Handling

### Common Errors

**Network Error:**
```json
{
  "success": false,
  "error": "Network error",
  "code": 1001
}
```

**API Error:**
```json
{
  "success": false,
  "error": "Failed to get access logs: SpreadsheetApp error",
  "code": 1002
}
```

### Graceful Handling:
```typescript
try {
  const data = await fetchAccessLogs();
  setLogs(data);
} catch (error) {
  console.error('Error:', error);
  toast.error('Failed to load logs', {
    description: error.message
  });
  // Show retry button to user
}
```

---

## Performance Tips

1. **Pagination:** Don't load all logs at once. Use limit of 50-100.
2. **Filtering:** Filter on backend before sending to frontend.
3. **Caching:** Cache stats for 1 minute to reduce API calls.
4. **Archival:** Archive logs older than 6 months to keep sheet responsive.

---

## Security Considerations

- Access Logs page is **auditor-only** (enforced via RBAC)
- All timestamps are server-side (cannot be spoofed)
- IP addresses logged for audit trail
- Device info for security monitoring
- No sensitive data stored in logs

---

## Maintenance

### Regular Tasks:
- Monitor sheet size (logs grow daily)
- Archive old logs monthly
- Review failed logins for security
- Check IP addresses for unusual patterns

### Database Backup:
Automatic backup includes Access Logs sheet. Located in System Settings spreadsheet.

---

## Support

For issues or questions:
1. Check browser console for errors
2. Review GAS logs in Google Apps Script editor
3. Verify API URL in environment variables
4. Check sheet permissions
5. Contact development team

---

**Last Updated:** January 11, 2026  
**API Version:** 1.0  
**Status:** Production Ready
