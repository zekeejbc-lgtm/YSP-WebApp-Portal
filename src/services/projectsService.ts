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

/**
 * Fetch all projects from backend
 */
export async function fetchAllProjects(): Promise<{ projects: Project[]; error?: ProjectError }> {
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

    const response = await fetch(`${PROJECTS_API_BASE}?action=getProjects`, {
      method: 'GET'
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
  imageFile?: File
): Promise<{ success: boolean; projectId?: string; error?: ProjectError }> {
  try {
    let imageUrl = projectData.imageUrl;

    // Upload image if provided
    if (imageFile) {
      const uploadResult = await uploadProjectImage(imageFile);
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
      })
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
  imageFile?: File
): Promise<{ success: boolean; error?: ProjectError }> {
  try {
    let updateData = { ...projectData };

    // Upload new image if provided
    if (imageFile) {
      const uploadResult = await uploadProjectImage(imageFile);
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
      })
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
export async function deleteProject(projectId: string): Promise<{ success: boolean; error?: ProjectError }> {
  try {
    const response = await fetch(PROJECTS_API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'deleteProject',
        projectId
      })
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
export async function uploadProjectImage(file: File): Promise<{ success: boolean; imageUrl?: string; error?: ProjectError }> {
  try {
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
    const base64Data = await fileToBase64(file);

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
      })
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
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
