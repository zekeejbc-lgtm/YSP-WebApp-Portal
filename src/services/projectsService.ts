/**
 * Projects Management Service
 * Handles all project CRUD operations with image uploads
 */

const PROJECTS_API_BASE = import.meta.env.VITE_GAS_HOMEPAGE_API_URL;

export interface Project {
  projectId: string;
  title: string;
  description: string;
  imageUrl: string;
  link?: string;
  linkText?: string;
  status: 'Active' | 'Inactive';
}

export interface ProjectError {
  code: string;
  message: string;
}

const CANCELED_ERROR: ProjectError = {
  code: 'PJ_CANCELLED',
  message: 'Operation cancelled',
};

/**
 * Fetch all projects from backend
 */
export async function fetchAllProjects(
  signal?: AbortSignal
): Promise<{ projects: Project[]; error?: ProjectError }> {
  try {
    if (!PROJECTS_API_BASE) {
      return {
        projects: [],
        error: {
          code: 'PJ001',
          message: 'API URL not configured'
        }
      };
    }

    if (signal?.aborted) {
      return {
        projects: [],
        error: CANCELED_ERROR,
      };
    }

    const response = await fetch(`${PROJECTS_API_BASE}?action=getProjects`, {
      method: 'GET',
      signal,
    });

    const data = await response.json();

    if (data.success) {
      return {
        projects: data.data || []
      };
    }

    return {
      projects: [],
      error: {
        code: 'PJ002',
        message: data.error || 'Failed to fetch projects'
      }
    };

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        projects: [],
        error: CANCELED_ERROR,
      };
    }
    console.error('[Projects] Fetch error:', error);
    return {
      projects: [],
      error: {
        code: 'PJ003',
        message: 'Network error fetching projects'
      }
    };
  }
}

/**
 * Add new project with image
 */
export async function addProject(
  projectData: Omit<Project, 'projectId'>,
  imageFile?: File,
  signal?: AbortSignal
): Promise<{ success: boolean; projectId?: string; error?: ProjectError }> {
  try {
    let imageUrl = projectData.imageUrl;

    if (signal?.aborted) {
      return { success: false, error: CANCELED_ERROR };
    }

    // Upload image if provided
    if (imageFile) {
      const uploadResult = await uploadProjectImage(imageFile, signal);
      if (!uploadResult.success) {
        return {
          success: false,
          error: uploadResult.error
        };
      }
      imageUrl = uploadResult.imageUrl!;
    }

    const response = await fetch(PROJECTS_API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'addProject',
        data: {
          ...projectData,
          imageUrl
        }
      }),
      signal,
    });

    const data = await response.json();

    if (data.success) {
      return {
        success: true,
        projectId: data.projectId
      };
    }

    return {
      success: false,
      error: {
        code: 'PJ004',
        message: data.message || 'Failed to add project'
      }
    };

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: CANCELED_ERROR };
    }
    console.error('[Projects] Add error:', error);
    return {
      success: false,
      error: {
        code: 'PJ005',
        message: 'Error adding project'
      }
    };
  }
}

/**
 * Update existing project
 */
export async function updateProject(
  projectId: string,
  projectData: Partial<Project>,
  imageFile?: File,
  signal?: AbortSignal
): Promise<{ success: boolean; error?: ProjectError }> {
  try {
    let updateData = { ...projectData };

    if (signal?.aborted) {
      return { success: false, error: CANCELED_ERROR };
    }

    // Upload new image if provided
    if (imageFile) {
      const uploadResult = await uploadProjectImage(imageFile, signal);
      if (!uploadResult.success) {
        return {
          success: false,
          error: uploadResult.error
        };
      }
      updateData.imageUrl = uploadResult.imageUrl;
    }

    const response = await fetch(PROJECTS_API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'updateProject',
        projectId,
        data: updateData
      }),
      signal,
    });

    const data = await response.json();

    if (data.success) {
      return { success: true };
    }

    return {
      success: false,
      error: {
        code: 'PJ006',
        message: data.message || 'Failed to update project'
      }
    };

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: CANCELED_ERROR };
    }
    console.error('[Projects] Update error:', error);
    return {
      success: false,
      error: {
        code: 'PJ007',
        message: 'Error updating project'
      }
    };
  }
}

/**
 * Delete project
 */
export async function deleteProject(
  projectId: string,
  signal?: AbortSignal
): Promise<{ success: boolean; error?: ProjectError }> {
  try {
    const response = await fetch(PROJECTS_API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'deleteProject',
        projectId
      }),
      signal,
    });

    const data = await response.json();

    if (data.success) {
      return { success: true };
    }

    return {
      success: false,
      error: {
        code: 'PJ008',
        message: data.message || 'Failed to delete project'
      }
    };

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: CANCELED_ERROR };
    }
    console.error('[Projects] Delete error:', error);
    return {
      success: false,
      error: {
        code: 'PJ009',
        message: 'Error deleting project'
      }
    };
  }
}

/**
 * Upload image to Google Drive via backend
 */
export async function uploadProjectImage(
  file: File,
  signal?: AbortSignal
): Promise<{ success: boolean; imageUrl?: string; error?: ProjectError }> {
  try {
    if (signal?.aborted) {
      return { success: false, error: CANCELED_ERROR };
    }

    // Validate file
    if (!file.type.startsWith('image/')) {
      return {
        success: false,
        error: {
          code: 'PJ010',
          message: 'Only image files are allowed'
        }
      };
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      return {
        success: false,
        error: {
          code: 'PJ011',
          message: 'Image must be smaller than 5MB'
        }
      };
    }

    // Convert file to base64
    const base64Data = await fileToBase64(file, signal);

    if (signal?.aborted) {
      return { success: false, error: CANCELED_ERROR };
    }

    // Use text/plain to avoid CORS preflight (simple request)
    // application/json triggers OPTIONS preflight which GAS doesn't handle
    const response = await fetch(PROJECTS_API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'uploadImage',
        fileName: file.name,
        fileData: base64Data
      }),
      signal,
    });

    const data = await response.json();

    if (data.success) {
      return {
        success: true,
        imageUrl: data.imageUrl
      };
    }

    return {
      success: false,
      error: {
        code: 'PJ012',
        message: data.message || 'Failed to upload image'
      }
    };

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: CANCELED_ERROR };
    }
    console.error('[Projects] Upload error:', error);
    return {
      success: false,
      error: {
        code: 'PJ013',
        message: 'Error uploading image'
      }
    };
  }
}

/**
 * Convert file to base64
 */
function fileToBase64(file: File, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    if (signal) {
      if (signal.aborted) {
        reader.abort();
        reject(new DOMException('Operation cancelled', 'AbortError'));
        return;
      }
      const onAbort = () => {
        reader.abort();
        reject(new DOMException('Operation cancelled', 'AbortError'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
      reader.onloadend = () => {
        signal.removeEventListener('abort', onAbort);
      };
    }
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
