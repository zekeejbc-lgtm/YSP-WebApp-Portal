# Projects Management System Setup Guide

## Overview
This system allows you to manage projects with image uploads to Google Drive, CORS-free image serving, and a complete CRUD interface with modern progress tracking.

## Backend Setup (Google Apps Script)

### 1. Get Your Google Drive Folder ID
- Go to: https://drive.google.com/drive/folders/1ACiv3LS5PrvNiQdscXCbCDzSC2phav3s
- Copy the ID from the URL: `1ACiv3LS5PrvNiQdscXCbCDzSC2phav3s`

### 2. Update the GAS Script
In your Google Apps Script project (`Projects_Manager.gs`):

```javascript
const PROJECTS_CONFIG = {
  SHEET_NAME: 'Projects',
  DRIVE_FOLDER_ID: '1ACiv3LS5PrvNiQdscXCbCDzSC2phav3s', // PASTE YOUR FOLDER ID HERE
  // ... rest of config
};
```

### 3. Deploy the GAS Script
1. Open your existing Google Apps Script deployment
2. Click "New deployment" → "Web app"
3. Configure:
   - Execute as: Your account
   - Who has access: Anyone
4. Copy the deployment URL
5. Add to your `.env.local`:
   ```
   VITE_GAS_PROJECTS_API_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
   ```

### 4. Create the Projects Sheet
The `Projects_Manager.gs` will automatically create a "Projects" sheet with these columns:
- ProjectID (auto-generated)
- Title
- Description
- ImageURL (CORS-free link)
- Link (optional)
- LinkText (optional)
- Status (Active/Inactive)

## Frontend Setup

### 1. Components Already Created
- `src/components/ProjectFormModal.tsx` - Project add/edit form
- `src/components/UploadToast.tsx` - Modern upload progress notifications
- `src/services/projectsService.ts` - API service layer

### 2. Integration in App.tsx
Add this to your App.tsx state:

```typescript
const [projects, setProjects] = useState<Project[]>([]);
const [uploadToasts, setUploadToasts] = useState<UploadToastMessage[]>([]);
const [showProjectModal, setShowProjectModal] = useState(false);
const [editingProject, setEditingProject] = useState<Project | undefined>();
const [isUploadingProject, setIsUploadingProject] = useState(false);

// Load projects on mount
useEffect(() => {
  const loadProjects = async () => {
    const result = await fetchAllProjects();
    if (result.projects.length > 0) {
      setProjects(result.projects);
    }
  };
  loadProjects();
}, []);

// Handle project upload
const handleProjectUpload = async (
  data: Omit<Project, 'projectId'>,
  imageFile?: File
) => {
  const toastId = `upload-${Date.now()}`;
  
  setIsUploadingProject(true);
  addUploadToast({
    id: toastId,
    title: editingProject ? 'Updating Project' : 'Creating Project',
    message: imageFile ? 'Uploading image...' : 'Saving project...',
    status: 'loading',
    progress: 0
  });

  try {
    let result;
    if (editingProject) {
      result = await updateProject(editingProject.projectId, data, imageFile);
    } else {
      result = await addProject(data, imageFile);
    }

    if (result.success) {
      updateUploadToast(toastId, {
        title: 'Success!',
        message: editingProject ? 'Project updated' : 'Project created',
        status: 'success',
        progress: 100
      });

      // Reload projects
      const projects = await fetchAllProjects();
      if (!projects.error) {
        setProjects(projects.projects);
      }

      setShowProjectModal(false);
      setEditingProject(undefined);
    } else {
      throw new Error(result.error?.message || 'Failed to save project');
    }
  } catch (error) {
    updateUploadToast(toastId, {
      title: 'Error',
      message: error instanceof Error ? error.message : 'Upload failed',
      status: 'error'
    });
  } finally {
    setIsUploadingProject(false);
  }
};

// Add/Update/Remove toast functions
const addUploadToast = (msg: UploadToastMessage) => {
  setUploadToasts(prev => [...prev, msg]);
};

const updateUploadToast = (id: string, updates: Partial<UploadToastMessage>) => {
  setUploadToasts(prev =>
    prev.map(msg => msg.id === id ? { ...msg, ...updates } : msg)
  );
};

const removeUploadToast = (id: string) => {
  setUploadToasts(prev => prev.filter(msg => msg.id !== id));
};

// Handle delete
const handleDeleteProject = async (projectId: string) => {
  if (!confirm('Delete this project?')) return;

  const toastId = `delete-${Date.now()}`;
  addUploadToast({
    id: toastId,
    title: 'Deleting Project',
    message: 'Please wait...',
    status: 'loading'
  });

  const result = await deleteProject(projectId);
  
  if (result.success) {
    updateUploadToast(toastId, {
      title: 'Success!',
      message: 'Project deleted',
      status: 'success'
    });
    setProjects(prev => prev.filter(p => p.projectId !== projectId));
  } else {
    updateUploadToast(toastId, {
      title: 'Error',
      message: result.error?.message || 'Failed to delete',
      status: 'error'
    });
  }
};
```

### 3. Add to JSX
In your render method:

```tsx
{/* Toast Container - Add near the end */}
<UploadToastContainer
  messages={uploadToasts}
  onDismiss={removeUploadToast}
  isDark={isDark}
/>

{/* Project Form Modal */}
<ProjectFormModal
  isOpen={showProjectModal}
  isDark={isDark}
  project={editingProject}
  onSubmit={handleProjectUpload}
  onClose={() => {
    setShowProjectModal(false);
    setEditingProject(undefined);
  }}
  isLoading={isUploadingProject}
/>

{/* Projects Grid - Display */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {projects.map(project => (
    <div key={project.projectId} className="rounded-2xl overflow-hidden bg-white dark:bg-gray-800">
      <img
        src={project.imageUrl}
        alt={project.title}
        className="w-full h-48 object-cover"
      />
      <div className="p-4">
        <h3 className="font-bold text-lg">{project.title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{project.description}</p>
        
        {isAdmin && (
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => {
                setEditingProject(project);
                setShowProjectModal(true);
              }}
              className="flex-1 px-3 py-2 bg-orange-500 text-white rounded-lg text-sm"
            >
              Edit
            </button>
            <button
              onClick={() => handleDeleteProject(project.projectId)}
              className="flex-1 px-3 py-2 bg-red-500 text-white rounded-lg text-sm"
            >
              Delete
            </button>
          </div>
        )}
        
        {project.link && (
          <a
            href={project.link}
            target="_blank"
            rel="noopener noreferrer"
            className="block mt-4 text-center py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
          >
            {project.linkText || 'View Project'}
          </a>
        )}
      </div>
    </div>
  ))}
</div>
```

## Features

### Image Upload
- ✅ Direct upload to Google Drive
- ✅ Automatic CORS-free link conversion
- ✅ 5MB size limit per image
- ✅ Image type validation
- ✅ Base64 encoding for safe transmission

### Progress Tracking
- ✅ Real-time upload progress
- ✅ Modern toast notifications
- ✅ Success/error states
- ✅ Auto-dismiss on completion

### Admin Features
- ✅ Add projects
- ✅ Edit projects
- ✅ Delete projects
- ✅ Status management (Active/Inactive)
- ✅ Batch operations

### CORS-Free Image Serving
Google Drive images are served via: `https://drive.google.com/uc?export=view&id={FILE_ID}`

This URL pattern:
- Has no CORS restrictions
- Works in all browsers
- Doesn't require authentication
- Supports direct embedding

## Troubleshooting

### Images not loading?
1. Check the CORS-free URL format
2. Ensure folder permissions allow public access
3. Verify file ID extraction is correct

### Upload fails?
1. Check API URL in .env
2. Ensure Google Drive folder is accessible
3. Check file size < 5MB
4. Review GAS logs for errors

### Sheet not created?
- GAS will auto-create on first fetch
- Or manually create "Projects" sheet with headers

## Environment Variables
```
VITE_GAS_HOMEPAGE_API_URL=https://script.google.com/macros/s/YOUR_ID/exec
```

Both endpoints use the same deployment URL.
