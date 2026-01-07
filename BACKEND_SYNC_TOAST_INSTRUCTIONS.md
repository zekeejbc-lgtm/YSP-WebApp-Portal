# Backend Sync Progress Toast Instructions

## Overview

Whenever implementing any function that requires **syncing data to/from the backend** (Google Apps Script / Google Sheets), you **MUST** use the **UploadToast** progress bar system for debugging and user feedback.

This ensures:
1. **Consistency** across the entire application
2. **Proper debugging visibility** - progress bar at bottom-right corner
3. **Good UX** - users can see exactly what's happening during backend operations

---

## ✅ REQUIRED: Use UploadToast System

### Import the Toast Type
```tsx
import { type UploadToastMessage } from './components/UploadToast';
```

### Accept Toast Props in Component (Optional with Defaults)
```tsx
interface MyComponentProps {
  // ... other props ...
  // Toast functions are OPTIONAL - defaults to silent no-op if not provided
  addUploadToast?: (message: UploadToastMessage) => void;
  updateUploadToast?: (id: string, updates: Partial<UploadToastMessage>) => void;
  removeUploadToast?: (id: string) => void;
}

// Default no-op toast functions for when props are not provided
const defaultAddToast = (_message: UploadToastMessage) => {};
const defaultUpdateToast = (_id: string, _updates: Partial<UploadToastMessage>) => {};
const defaultRemoveToast = (_id: string) => {};

export default function MyComponent({
  // ... other props ...
  addUploadToast = defaultAddToast,
  updateUploadToast = defaultUpdateToast,
  removeUploadToast = defaultRemoveToast,
}: MyComponentProps) {
  // Now you can use addUploadToast, updateUploadToast, removeUploadToast
  // If not passed, they will silently do nothing
}
```

### Pass Props from App.tsx (Optional)
When using the component in App.tsx, you CAN pass the toast props if they're available in scope:
```tsx
<MyComponent
  // ... other props ...
  addUploadToast={addUploadToast}
  updateUploadToast={updateUploadToast}
  removeUploadToast={removeUploadToast}
/>
```

---

## 📋 Standard Pattern for Backend Operations

### 1. CREATE Operation
```tsx
const handleCreate = async () => {
  const toastId = `create-item-${Date.now()}`;
  
  addUploadToast({
    id: toastId,
    title: 'Creating Item',
    message: 'Preparing data...',
    status: 'loading',
    progress: 0,
  });
  
  try {
    updateUploadToast(toastId, { progress: 30, message: 'Uploading to server...' });
    // ... API call ...
    
    updateUploadToast(toastId, { progress: 70, message: 'Saving to database...' });
    // ... more operations ...
    
    updateUploadToast(toastId, {
      status: 'success',
      progress: 100,
      title: 'Item Created!',
      message: 'Successfully saved to backend',
    });
  } catch (error) {
    updateUploadToast(toastId, {
      status: 'error',
      progress: 100,
      title: 'Create Failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
```

### 2. READ/FETCH Operation
```tsx
const fetchData = async () => {
  const toastId = `fetch-data-${Date.now()}`;
  
  addUploadToast({
    id: toastId,
    title: 'Loading Data',
    message: 'Connecting to backend...',
    status: 'loading',
    progress: 0,
  });
  
  try {
    updateUploadToast(toastId, { progress: 30, message: 'Fetching from Google Sheets...' });
    const data = await fetchFromAPI();
    
    updateUploadToast(toastId, { progress: 80, message: 'Processing response...' });
    // ... process data ...
    
    updateUploadToast(toastId, {
      status: 'success',
      progress: 100,
      title: 'Data Loaded',
      message: 'Successfully retrieved from backend',
    });
  } catch (error) {
    updateUploadToast(toastId, {
      status: 'error',
      progress: 100,
      title: 'Load Failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
```

### 3. UPDATE Operation
```tsx
const handleUpdate = async () => {
  const toastId = `update-item-${Date.now()}`;
  
  addUploadToast({
    id: toastId,
    title: 'Updating Item',
    message: 'Preparing changes...',
    status: 'loading',
    progress: 0,
  });
  
  try {
    updateUploadToast(toastId, { progress: 30, message: 'Sending to server...' });
    // ... API call ...
    
    updateUploadToast(toastId, { progress: 70, message: 'Saving to database...' });
    // ... more operations ...
    
    updateUploadToast(toastId, {
      status: 'success',
      progress: 100,
      title: 'Update Complete!',
      message: 'Changes saved successfully',
    });
  } catch (error) {
    updateUploadToast(toastId, {
      status: 'error',
      progress: 100,
      title: 'Update Failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
```

### 4. DELETE Operation
```tsx
const handleDelete = async () => {
  const toastId = `delete-item-${Date.now()}`;
  
  addUploadToast({
    id: toastId,
    title: 'Deleting Item',
    message: 'Processing request...',
    status: 'loading',
    progress: 0,
  });
  
  try {
    updateUploadToast(toastId, { progress: 50, message: 'Removing from database...' });
    // ... API call ...
    
    updateUploadToast(toastId, {
      status: 'success',
      progress: 100,
      title: 'Item Deleted',
      message: 'Successfully removed from backend',
    });
  } catch (error) {
    updateUploadToast(toastId, {
      status: 'error',
      progress: 100,
      title: 'Delete Failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
```

### 5. IMAGE/FILE UPLOAD Operation
```tsx
const handleImageUpload = async (file: File) => {
  const toastId = `upload-image-${Date.now()}`;
  
  addUploadToast({
    id: toastId,
    title: 'Uploading Image',
    message: 'Preparing file...',
    status: 'loading',
    progress: 0,
  });
  
  try {
    updateUploadToast(toastId, { progress: 20, message: 'Converting to base64...' });
    // ... convert file ...
    
    updateUploadToast(toastId, { progress: 40, message: 'Uploading to Google Drive...' });
    const result = await uploadToGoogleDrive(file);
    
    updateUploadToast(toastId, { progress: 80, message: 'Updating database...' });
    // ... save URL to sheets ...
    
    updateUploadToast(toastId, {
      status: 'success',
      progress: 100,
      title: 'Upload Complete!',
      message: 'Image saved to Google Drive',
    });
  } catch (error) {
    updateUploadToast(toastId, {
      status: 'error',
      progress: 100,
      title: 'Upload Failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
```

---

## ❌ DO NOT USE

Do **NOT** use `toast` from `sonner` for backend operations:
```tsx
// ❌ WRONG - Don't use this for backend sync
import { toast } from 'sonner';
toast.success('Saved!');
toast.error('Failed!');
toast.loading('Loading...');
```

The `sonner` toast appears at the **top** of the screen and doesn't have a progress bar.

---

## 🎯 Toast Message Types

```tsx
interface UploadToastMessage {
  id: string;        // Unique ID for the toast (use `${action}-${Date.now()}`)
  title: string;     // Bold title text
  message: string;   // Descriptive message
  status: 'loading' | 'success' | 'error';
  progress?: number; // 0-100 percentage for progress bar
}
```

---

## 📍 Toast Location

The UploadToast system displays progress bars at the **bottom-right corner** of the screen, stacked vertically. This is consistent across:
- Project uploads/updates/deletes
- Homepage content updates
- Developer profile updates
- Org chart uploads
- Social link management
- All other backend sync operations

---

## 📁 Reference Files

- **Toast Component:** `src/components/UploadToast.tsx`
- **Toast Container:** Used in `src/App.tsx`
- **Example Usage:** See `handleUploadProject` in `src/App.tsx` (around line 1050)
- **Developer Modal Example:** `src/components/DeveloperModal.tsx`

---

## 🔄 Existing Implementations

Already using UploadToast correctly:
1. ✅ Project Create/Update/Delete (`App.tsx`)
2. ✅ Org Chart Upload (`App.tsx`)
3. ✅ Developer Profile CRUD (`DeveloperModal.tsx`)

---

**Last Updated:** January 7, 2026
