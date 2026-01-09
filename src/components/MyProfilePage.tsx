/**
 * =============================================================================
 * MY PROFILE PAGE
 * =============================================================================
 * 
 * SMART SPEC COMPLIANCE:
 * ✅ Uses PageLayout master component
 * ✅ Profile image: 120px with orange border (4px)
 * ✅ Form inputs: 44px height
 * ✅ Button components: Edit, Save, Cancel variants
 * ✅ Two-column layout with proper spacing
 * ✅ Connected to real backend via GAS API
 * ✅ Progress toast for save operations
 * 
 * =============================================================================
 */

import { useState, useEffect } from "react";
import { User as UserIcon, Save, Edit, Camera, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { PageLayout, Button, DESIGN_TOKENS, getGlassStyle } from "./design-system";
import { SkeletonProfilePage } from "./SkeletonCard";
import { UploadToastMessage } from "./UploadToast";
import ChangePasswordModal from "./ChangePasswordModal";
import { 
  fetchUserProfile, 
  updateUserProfile, 
  uploadProfilePicture,
  getStoredUser,
  verifyPassword,
  changePassword,
  type UserProfile 
} from "../services/gasLoginService";

interface MyProfilePageProps {
  onClose: () => void;
  isDark: boolean;
  addUploadToast?: (message: UploadToastMessage) => void;
  updateUploadToast?: (id: string, updates: Partial<UploadToastMessage>) => void;
  onProfilePictureChange?: (newUrl: string) => void;
}

export default function MyProfilePage({ 
  onClose, 
  isDark,
  addUploadToast,
  updateUploadToast,
  onProfilePictureChange,
}: MyProfilePageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null); // Local preview before save
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null); // Local blob URL for preview
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [currentUsername, setCurrentUsername] = useState<string>('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [originalProfile, setOriginalProfile] = useState<typeof profile | null>(null); // Track original values

  const [profile, setProfile] = useState({
    // Personal Info
    fullName: "",
    username: "",
    email: "",
    personalEmail: "",
    contactNumber: "",
    birthday: "",
    age: 0,
    gender: "",
    pronouns: "",
    // Identity
    idCode: "",
    civilStatus: "",
    religion: "",
    nationality: "",
    // Address
    address: "",
    barangay: "",
    city: "",
    province: "",
    zipCode: "",
    // YSP Information
    chapter: "",
    committee: "",
    dateJoined: "",
    membershipType: "",
    // Social Media
    facebook: "",
    instagram: "",
    twitter: "",
    // Emergency Contact
    emergencyContactName: "",
    emergencyContactRelation: "",
    emergencyContactNumber: "",
    // Account
    password: "••••••••",
    position: "",
    role: "",
    status: "",
  });

  // Fetch profile data on mount
  useEffect(() => {
    const loadProfile = async () => {
      setIsLoading(true);
      
      // Get the logged-in user from session
      const storedUser = getStoredUser();
      if (!storedUser?.username) {
        toast.error('Not logged in', {
          description: 'Please log in to view your profile'
        });
        setIsLoading(false);
        onClose();
        return;
      }

      setCurrentUsername(storedUser.username);

      try {
        const response = await fetchUserProfile(storedUser.username);
        
        if (response.success && response.profile) {
          const p = response.profile;
          const loadedProfile = {
            fullName: p.fullName || '',
            username: p.username || '',
            email: p.email || '',
            personalEmail: p.personalEmail || '',
            contactNumber: p.contactNumber || '',
            birthday: p.birthday || '',
            age: p.age || 0,
            gender: p.gender || '',
            pronouns: p.pronouns || '',
            idCode: p.idCode || '',
            civilStatus: p.civilStatus || '',
            religion: p.religion || '',
            nationality: p.nationality || '',
            address: p.address || '',
            barangay: p.barangay || '',
            city: p.city || '',
            province: p.province || '',
            zipCode: p.zipCode || '',
            chapter: p.chapter || '',
            committee: p.committee || '',
            dateJoined: p.dateJoined || '',
            membershipType: p.membershipType || '',
            facebook: p.facebook || '',
            instagram: p.instagram || '',
            twitter: p.twitter || '',
            emergencyContactName: p.emergencyContactName || '',
            emergencyContactRelation: p.emergencyContactRelation || '',
            emergencyContactNumber: p.emergencyContactNumber || '',
            password: '••••••••',
            position: p.position || '',
            role: p.role || '',
            status: p.status || '',
          };
          setProfile(loadedProfile);
          setOriginalProfile(loadedProfile); // Store original for comparison
          
          // Set profile picture if available
          if (p.profilePictureURL) {
            setProfileImage(p.profilePictureURL);
          }
        }
      } catch (error) {
        console.error('Failed to load profile:', error);
        toast.error('Failed to load profile', {
          description: error instanceof Error ? error.message : 'Please try again later'
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [onClose]);

  // Cleanup local preview URL on unmount
  useEffect(() => {
    return () => {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
      }
    };
  }, [localPreviewUrl]);

  const handleProfileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file size
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size too large', {
        description: 'Please upload an image smaller than 5MB'
      });
      return;
    }
    
    // Validate file type
    if (!file.type.match(/image\/(png|jpg|jpeg|webp)/)) {
      toast.error('Invalid file type', {
        description: 'Please upload a PNG, JPG, or WebP image'
      });
      return;
    }
    
    // Store the file for later upload when Save is clicked
    setPendingImageFile(file);
    
    // Revoke old preview URL to prevent memory leaks
    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
    }
    
    // Create local preview URL
    const previewUrl = URL.createObjectURL(file);
    setLocalPreviewUrl(previewUrl);
    
    // Mark as having unsaved changes
    setHasUnsavedChanges(true);
    
    toast.info('Image selected', {
      description: 'Click "Save Changes" to upload your new profile picture',
    });
  };

  // Calculate age from birthday
  const calculateAge = (birthday: string): number => {
    if (!birthday) return 0;
    try {
      const birthDate = new Date(birthday);
      if (isNaN(birthDate.getTime())) return 0;
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age > 0 ? age : 0;
    } catch {
      return 0;
    }
  };

  const handleChange = (field: string, value: string) => {
    // If birthday changes, automatically recalculate age
    if (field === 'birthday') {
      const newAge = calculateAge(value);
      setProfile({ ...profile, birthday: value, age: newAge });
    } else {
      setProfile({ ...profile, [field]: value });
    }
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    if (!currentUsername) {
      toast.error('Not logged in', {
        description: 'Please log in to save your profile'
      });
      return;
    }

    setIsSaving(true);
    const toastId = `profile-save-${Date.now()}`;
    
    // Show progress toast
    if (addUploadToast) {
      addUploadToast({
        id: toastId,
        title: 'Saving Profile',
        message: 'Preparing data...',
        status: 'loading',
        progress: 10,
      });
    }
    
    try {
      // Update progress
      if (updateUploadToast) {
        updateUploadToast(toastId, { progress: 25, message: 'Validating fields...' });
      }

      // Upload pending profile picture if there is one
      if (pendingImageFile) {
        if (updateUploadToast) {
          updateUploadToast(toastId, { progress: 25, message: 'Uploading profile picture...' });
        }
        
        try {
          const uploadResult = await uploadProfilePicture(pendingImageFile, currentUsername);
          
          if (uploadResult.success && uploadResult.imageUrl) {
            // Update the profile image with the new URL
            const cacheBustedUrl = uploadResult.imageUrl + '?t=' + Date.now();
            setProfileImage(cacheBustedUrl);
            
            // Update sidebar profile picture
            if (onProfilePictureChange) {
              onProfilePictureChange(cacheBustedUrl);
            }
            
            // Clear the pending file and local preview
            setPendingImageFile(null);
            if (localPreviewUrl) {
              URL.revokeObjectURL(localPreviewUrl);
              setLocalPreviewUrl(null);
            }
            
            console.log('Profile picture uploaded successfully:', uploadResult.imageUrl);
          } else {
            throw new Error(uploadResult.error || 'Failed to upload profile picture');
          }
        } catch (uploadError) {
          console.error('Profile picture upload error:', uploadError);
          // Continue with other saves even if image upload fails
          toast.warning('Profile picture upload failed', {
            description: 'Your other changes will still be saved',
          });
        }
      }

      // Update progress
      if (updateUploadToast) {
        updateUploadToast(toastId, { progress: 40, message: 'Validating fields...' });
      }

      // Build the update data object - ONLY include fields that have changed
      const editableFields = [
        'fullName', 'email', 'personalEmail', 'contactNumber', 'birthday',
        'gender', 'pronouns', 'civilStatus', 'religion', 'nationality',
        'address', 'barangay', 'city', 'province', 'zipCode',
        'chapter', 'committee', 'facebook', 'instagram', 'twitter',
        'emergencyContactName', 'emergencyContactRelation', 'emergencyContactNumber'
      ] as const;
      
      const updateData: Partial<UserProfile> = {};
      let changedFieldCount = 0;
      
      for (const field of editableFields) {
        const currentValue = profile[field];
        const originalValue = originalProfile ? originalProfile[field] : undefined;
        
        // Only include field if it has changed from original
        if (currentValue !== originalValue) {
          (updateData as Record<string, unknown>)[field] = currentValue;
          changedFieldCount++;
        }
      }
      
      // If no fields changed, skip the backend call
      if (changedFieldCount === 0 && !pendingImageFile) {
        if (updateUploadToast) {
          updateUploadToast(toastId, {
            status: 'success',
            progress: 100,
            title: 'No Changes',
            message: 'No fields were modified',
          });
        }
        setIsEditing(false);
        setHasUnsavedChanges(false);
        return;
      }

      // Update progress
      if (updateUploadToast) {
        updateUploadToast(toastId, { progress: 60, message: 'Sending to backend...' });
      }

      const response = await updateUserProfile(currentUsername, updateData);
      
      // Update progress
      if (updateUploadToast) {
        updateUploadToast(toastId, { progress: 90, message: 'Processing response...' });
      }
      
      if (response.success) {
        // Build detailed message - use our count of changed fields
        let detailMessage = `${changedFieldCount} field${changedFieldCount !== 1 ? 's' : ''} updated successfully!`;
        
        // Show warning if some fields weren't found
        if (response.notFoundFields && response.notFoundFields.length > 0) {
          console.warn('Fields not found in spreadsheet:', response.notFoundFields);
          detailMessage += ` (${response.notFoundFields.length} not found in sheet)`;
        }
        
        // Update original profile to match current after successful save
        setOriginalProfile({ ...profile });
        
        // Success toast
        if (updateUploadToast) {
          updateUploadToast(toastId, {
            status: 'success',
            progress: 100,
            title: 'Profile Saved',
            message: detailMessage,
          });
        } else {
          toast.success("Profile Updated Successfully", {
            description: detailMessage,
          });
        }
        setIsEditing(false);
        setHasUnsavedChanges(false);
      } else {
        // Error toast
        if (updateUploadToast) {
          updateUploadToast(toastId, {
            status: 'error',
            progress: 100,
            title: 'Save Failed',
            message: response.message || "Please try again later.",
          });
        } else {
          toast.error("Failed to update profile", {
            description: response.message || "Please try again later.",
          });
        }
      }
    } catch (error) {
      console.error('Failed to save profile:', error);
      const errorMessage = error instanceof Error ? error.message : "Please try again later.";
      
      // Error toast
      if (updateUploadToast) {
        updateUploadToast(toastId, {
          status: 'error',
          progress: 100,
          title: 'Save Failed',
          message: errorMessage,
        });
      } else {
        toast.error("Failed to update profile", {
          description: errorMessage,
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      if (confirm("Discard unsaved changes?")) {
        setIsEditing(false);
        setHasUnsavedChanges(false);
        
        // Clear pending image and local preview
        if (localPreviewUrl) {
          URL.revokeObjectURL(localPreviewUrl);
          setLocalPreviewUrl(null);
        }
        setPendingImageFile(null);
      }
    } else {
      setIsEditing(false);
    }
  };

  const glassStyle = getGlassStyle(isDark);

  const inputStyle = {
    height: `${DESIGN_TOKENS.interactive.input.height}px`,
    paddingLeft: `${DESIGN_TOKENS.interactive.input.paddingX}px`,
    paddingRight: `${DESIGN_TOKENS.interactive.input.paddingX}px`,
    borderRadius: `${DESIGN_TOKENS.radius.input}px`,
    fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
    fontWeight: DESIGN_TOKENS.typography.fontWeight.normal,
    borderWidth: "2px",
    transitionDuration: `${DESIGN_TOKENS.motion.duration.fast}ms`,
  };

  return (
    <PageLayout
      title="My Profile"
      subtitle="View and manage your personal information"
      isDark={isDark}
      onClose={onClose}
      breadcrumbs={[
        { label: "Home", onClick: onClose },
        { label: "My Profile", onClick: undefined },
      ]}
      actions={
        !isEditing && !isLoading ? (
          <Button
            variant="primary"
            onClick={() => setIsEditing(true)}
            icon={<Edit className="w-5 h-5" />}
          >
            Edit Profile
          </Button>
        ) : null
      }
    >
      {/* Loading State - Skeleton UI */}
      {isLoading ? (
        <SkeletonProfilePage isDark={isDark} />
      ) : (
        <>
      {/* Profile Header Card */}
      <div
        className="border rounded-lg text-center mb-6"
        style={{
          borderRadius: `${DESIGN_TOKENS.radius.card}px`,
          padding: `${DESIGN_TOKENS.spacing.scale["2xl"]}px`,
          borderColor: isDark
            ? "rgba(255, 255, 255, 0.1)"
            : "rgba(0, 0, 0, 0.1)",
          ...glassStyle,
        }}
      >
        {/* Profile Picture */}
        <div className="relative inline-block">
          <div
            className="rounded-full flex items-center justify-center text-white overflow-hidden"
            style={{
              width: `${DESIGN_TOKENS.media.profileImage.size}px`,
              height: `${DESIGN_TOKENS.media.profileImage.size}px`,
              background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.red} 0%, ${DESIGN_TOKENS.colors.brand.orange} 100%)`,
              border: `4px solid ${DESIGN_TOKENS.colors.brand.orange}`,
            }}
          >
            {isUploadingImage ? (
              <div className="flex items-center justify-center w-full h-full">
                <Loader2 className="w-12 h-12 text-white animate-spin" />
              </div>
            ) : localPreviewUrl ? (
              // Show local preview (before save)
              <img
                src={localPreviewUrl}
                alt="Profile Preview"
                className="w-full h-full object-cover"
              />
            ) : profileImage ? (
              <img
                src={profileImage}
                alt="Profile"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onLoad={() => console.log('Profile image loaded successfully')}
                onError={(e) => {
                  // If image fails to load, try alternate URL format or show default
                  console.error('Failed to load profile image:', profileImage);
                  const target = e.currentTarget;
                  
                  // Extract file ID from URL
                  let fileId = '';
                  const idMatch = profileImage.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                  const lh3Match = profileImage.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
                  
                  if (idMatch) {
                    fileId = idMatch[1];
                  } else if (lh3Match) {
                    fileId = lh3Match[1];
                  }
                  
                  if (fileId) {
                    // Try different URL formats
                    if (profileImage.includes('thumbnail')) {
                      const altUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
                      console.log('Trying lh3 format:', altUrl);
                      target.src = altUrl;
                    } else if (profileImage.includes('lh3.googleusercontent.com')) {
                      const altUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w500`;
                      console.log('Trying thumbnail format:', altUrl);
                      target.src = altUrl;
                    } else {
                      const altUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w500`;
                      console.log('Trying thumbnail format:', altUrl);
                      target.src = altUrl;
                    }
                  } else {
                    // Hide the broken image
                    target.style.display = 'none';
                  }
                }}
              />
            ) : (
              <UserIcon className="w-16 h-16" />
            )}
          </div>
          
          {/* Change Picture Button */}
          {isEditing && !isUploadingImage && (
            <label
              className="absolute bottom-0 right-0 cursor-pointer rounded-full p-2 transition-all hover:scale-110"
              style={{
                background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.red} 0%, ${DESIGN_TOKENS.colors.brand.orange} 100%)`,
                boxShadow: "0 4px 12px rgba(246, 66, 31, 0.3)",
              }}
            >
              <Camera className="w-5 h-5 text-white" />
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={handleProfileImageUpload}
                className="hidden"
                disabled={isUploadingImage}
              />
            </label>
          )}
        </div>

        {/* Name and Username */}
        <h2
          className="mt-4"
          style={{
            fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
            fontSize: `${DESIGN_TOKENS.typography.fontSize.h2}px`,
            fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
            color: DESIGN_TOKENS.colors.brand.red,
            marginBottom: `${DESIGN_TOKENS.spacing.scale.xs}px`,
          }}
        >
          {profile.fullName}
        </h2>
        <p
          style={{
            fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
            fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
            color: DESIGN_TOKENS.colors.brand.orange,
          }}
        >
          @{profile.username}
        </p>
      </div>

      {/* Personal Information */}
      <div
        className="border rounded-lg mb-6"
        style={{
          borderRadius: `${DESIGN_TOKENS.radius.card}px`,
          padding: `${DESIGN_TOKENS.spacing.scale.xl}px`,
          borderColor: isDark
            ? "rgba(255, 255, 255, 0.1)"
            : "rgba(0, 0, 0, 0.1)",
          ...glassStyle,
        }}
      >
        <h3
          className="mb-4"
          style={{
            fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
            fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
            fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
            color: DESIGN_TOKENS.colors.brand.orange,
          }}
        >
          Personal Information
        </h3>
        <div
          className="grid md:grid-cols-2"
          style={{
            gap: `${DESIGN_TOKENS.spacing.scale.lg}px`,
          }}
        >
          {[
            { label: "Full Name", value: profile.fullName, key: "fullName", editable: true },
            { label: "Email (Account)", value: profile.email, key: "email", editable: true },
            { label: "Personal Email", value: profile.personalEmail, key: "personalEmail", editable: true },
            { label: "Contact Number", value: profile.contactNumber, key: "contactNumber", editable: true },
            { label: "Birthday", value: profile.birthday, key: "birthday", editable: true, type: "date" },
            { label: "Age", value: profile.age.toString(), key: "age", editable: false },
            { label: "Gender", value: profile.gender, key: "gender", editable: true },
            { label: "Pronouns", value: profile.pronouns, key: "pronouns", editable: true },
          ].map((field) => (
            <div key={field.key}>
              <label
                className="block text-muted-foreground mb-2"
                style={{
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                }}
              >
                {field.label}
              </label>
              <input
                type={field.type || "text"}
                value={field.value}
                onChange={(e) => handleChange(field.key, e.target.value)}
                disabled={!isEditing || !field.editable}
                className="w-full border-2 bg-white/50 dark:bg-white/5 backdrop-blur-sm transition-all disabled:opacity-60 focus:outline-none focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20"
                style={{
                  ...inputStyle,
                  borderColor: isDark
                    ? "rgba(255, 255, 255, 0.1)"
                    : "rgba(0, 0, 0, 0.1)",
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Identity Information */}
      <div
        className="border rounded-lg mb-6"
        style={{
          borderRadius: `${DESIGN_TOKENS.radius.card}px`,
          padding: `${DESIGN_TOKENS.spacing.scale.xl}px`,
          borderColor: isDark
            ? "rgba(255, 255, 255, 0.1)"
            : "rgba(0, 0, 0, 0.1)",
          ...glassStyle,
        }}
      >
        <h3
          className="mb-4"
          style={{
            fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
            fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
            fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
            color: DESIGN_TOKENS.colors.brand.orange,
          }}
        >
          Identity Information
        </h3>
        <div
          className="grid md:grid-cols-2"
          style={{
            gap: `${DESIGN_TOKENS.spacing.scale.lg}px`,
          }}
        >
          {[
            { label: "ID Code", value: profile.idCode, key: "idCode", editable: false },
            { label: "Civil Status", value: profile.civilStatus, key: "civilStatus", editable: true },
            { label: "Religion", value: profile.religion, key: "religion", editable: true },
            { label: "Nationality", value: profile.nationality, key: "nationality", editable: true },
          ].map((field) => (
            <div key={field.key}>
              <label
                className="block text-muted-foreground mb-2"
                style={{
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                }}
              >
                {field.label}
              </label>
              <input
                type="text"
                value={field.value}
                onChange={(e) => handleChange(field.key, e.target.value)}
                disabled={!isEditing || !field.editable}
                className="w-full border-2 bg-white/50 dark:bg-white/5 backdrop-blur-sm transition-all disabled:opacity-60 focus:outline-none focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20"
                style={{
                  ...inputStyle,
                  borderColor: isDark
                    ? "rgba(255, 255, 255, 0.1)"
                    : "rgba(0, 0, 0, 0.1)",
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Address Information */}
      <div
        className="border rounded-lg mb-6"
        style={{
          borderRadius: `${DESIGN_TOKENS.radius.card}px`,
          padding: `${DESIGN_TOKENS.spacing.scale.xl}px`,
          borderColor: isDark
            ? "rgba(255, 255, 255, 0.1)"
            : "rgba(0, 0, 0, 0.1)",
          ...glassStyle,
        }}
      >
        <h3
          className="mb-4"
          style={{
            fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
            fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
            fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
            color: DESIGN_TOKENS.colors.brand.orange,
          }}
        >
          Address Information
        </h3>
        <div
          className="grid md:grid-cols-2"
          style={{
            gap: `${DESIGN_TOKENS.spacing.scale.lg}px`,
          }}
        >
          {[
            { label: "Address", value: profile.address, key: "address", editable: true },
            { label: "Barangay", value: profile.barangay, key: "barangay", editable: true },
            { label: "City", value: profile.city, key: "city", editable: true },
            { label: "Province", value: profile.province, key: "province", editable: true },
            { label: "Zip Code", value: profile.zipCode, key: "zipCode", editable: true },
          ].map((field) => (
            <div key={field.key}>
              <label
                className="block text-muted-foreground mb-2"
                style={{
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                }}
              >
                {field.label}
              </label>
              <input
                type="text"
                value={field.value}
                onChange={(e) => handleChange(field.key, e.target.value)}
                disabled={!isEditing || !field.editable}
                className="w-full border-2 bg-white/50 dark:bg-white/5 backdrop-blur-sm transition-all disabled:opacity-60 focus:outline-none focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20"
                style={{
                  ...inputStyle,
                  borderColor: isDark
                    ? "rgba(255, 255, 255, 0.1)"
                    : "rgba(0, 0, 0, 0.1)",
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* YSP Information */}
      <div
        className="border rounded-lg mb-6"
        style={{
          borderRadius: `${DESIGN_TOKENS.radius.card}px`,
          padding: `${DESIGN_TOKENS.spacing.scale.xl}px`,
          borderColor: isDark
            ? "rgba(255, 255, 255, 0.1)"
            : "rgba(0, 0, 0, 0.1)",
          ...glassStyle,
        }}
      >
        <h3
          className="mb-4"
          style={{
            fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
            fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
            fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
            color: DESIGN_TOKENS.colors.brand.orange,
          }}
        >
          YSP Information
        </h3>
        <div
          className="grid md:grid-cols-2"
          style={{
            gap: `${DESIGN_TOKENS.spacing.scale.lg}px`,
          }}
        >
          {[
            { label: "Chapter", value: profile.chapter, key: "chapter", editable: true },
            { label: "Committee", value: profile.committee, key: "committee", editable: true },
            { label: "Date Joined", value: profile.dateJoined, key: "dateJoined", editable: false, type: "date" },
            { label: "Membership Type", value: profile.membershipType, key: "membershipType", editable: false },
          ].map((field) => (
            <div key={field.key}>
              <label
                className="block text-muted-foreground mb-2"
                style={{
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                }}
              >
                {field.label}
              </label>
              <input
                type={field.type || "text"}
                value={field.value}
                onChange={(e) => handleChange(field.key, e.target.value)}
                disabled={!isEditing || !field.editable}
                className="w-full border-2 bg-white/50 dark:bg-white/5 backdrop-blur-sm transition-all disabled:opacity-60 focus:outline-none focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20"
                style={{
                  ...inputStyle,
                  borderColor: isDark
                    ? "rgba(255, 255, 255, 0.1)"
                    : "rgba(0, 0, 0, 0.1)",
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Social Media Information */}
      <div
        className="border rounded-lg mb-6"
        style={{
          borderRadius: `${DESIGN_TOKENS.radius.card}px`,
          padding: `${DESIGN_TOKENS.spacing.scale.xl}px`,
          borderColor: isDark
            ? "rgba(255, 255, 255, 0.1)"
            : "rgba(0, 0, 0, 0.1)",
          ...glassStyle,
        }}
      >
        <h3
          className="mb-4"
          style={{
            fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
            fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
            fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
            color: DESIGN_TOKENS.colors.brand.orange,
          }}
        >
          Social Media Information
        </h3>
        <div
          className="grid md:grid-cols-2"
          style={{
            gap: `${DESIGN_TOKENS.spacing.scale.lg}px`,
          }}
        >
          {[
            { label: "Facebook", value: profile.facebook, key: "facebook", editable: true },
            { label: "Instagram", value: profile.instagram, key: "instagram", editable: true },
            { label: "Twitter", value: profile.twitter, key: "twitter", editable: true },
          ].map((field) => (
            <div key={field.key}>
              <label
                className="block text-muted-foreground mb-2"
                style={{
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                }}
              >
                {field.label}
              </label>
              <input
                type="text"
                value={field.value}
                onChange={(e) => handleChange(field.key, e.target.value)}
                disabled={!isEditing || !field.editable}
                className="w-full border-2 bg-white/50 dark:bg-white/5 backdrop-blur-sm transition-all disabled:opacity-60 focus:outline-none focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20"
                style={{
                  ...inputStyle,
                  borderColor: isDark
                    ? "rgba(255, 255, 255, 0.1)"
                    : "rgba(0, 0, 0, 0.1)",
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Emergency Contact Information */}
      <div
        className="border rounded-lg mb-6"
        style={{
          borderRadius: `${DESIGN_TOKENS.radius.card}px`,
          padding: `${DESIGN_TOKENS.spacing.scale.xl}px`,
          borderColor: isDark
            ? "rgba(255, 255, 255, 0.1)"
            : "rgba(0, 0, 0, 0.1)",
          ...glassStyle,
        }}
      >
        <h3
          className="mb-4"
          style={{
            fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
            fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
            fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
            color: DESIGN_TOKENS.colors.brand.orange,
          }}
        >
          Emergency Contact Information
        </h3>
        <div
          className="grid md:grid-cols-2"
          style={{
            gap: `${DESIGN_TOKENS.spacing.scale.lg}px`,
          }}
        >
          {[
            { label: "Name", value: profile.emergencyContactName, key: "emergencyContactName", editable: true },
            { label: "Relation", value: profile.emergencyContactRelation, key: "emergencyContactRelation", editable: true },
            { label: "Contact Number", value: profile.emergencyContactNumber, key: "emergencyContactNumber", editable: true },
          ].map((field) => (
            <div key={field.key}>
              <label
                className="block text-muted-foreground mb-2"
                style={{
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                }}
              >
                {field.label}
              </label>
              <input
                type="text"
                value={field.value}
                onChange={(e) => handleChange(field.key, e.target.value)}
                disabled={!isEditing || !field.editable}
                className="w-full border-2 bg-white/50 dark:bg-white/5 backdrop-blur-sm transition-all disabled:opacity-60 focus:outline-none focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20"
                style={{
                  ...inputStyle,
                  borderColor: isDark
                    ? "rgba(255, 255, 255, 0.1)"
                    : "rgba(0, 0, 0, 0.1)",
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Account Information */}
      <div
        className="border rounded-lg mb-6"
        style={{
          borderRadius: `${DESIGN_TOKENS.radius.card}px`,
          padding: `${DESIGN_TOKENS.spacing.scale.xl}px`,
          borderColor: isDark
            ? "rgba(255, 255, 255, 0.1)"
            : "rgba(0, 0, 0, 0.1)",
          ...glassStyle,
        }}
      >
        <h3
          className="mb-4"
          style={{
            fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
            fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
            fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
            color: DESIGN_TOKENS.colors.brand.orange,
          }}
        >
          Account Information
        </h3>
        <div
          className="grid md:grid-cols-2"
          style={{
            gap: `${DESIGN_TOKENS.spacing.scale.lg}px`,
          }}
        >
          <div>
            <label
              className="block text-muted-foreground mb-2"
              style={{
                fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
              }}
            >
              Username
            </label>
            <input
              type="text"
              value={profile.username}
              onChange={(e) => handleChange("username", e.target.value)}
              disabled={!isEditing}
              className="w-full border-2 bg-white/50 dark:bg-white/5 backdrop-blur-sm transition-all disabled:opacity-60 focus:outline-none focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20"
              style={{
                ...inputStyle,
                borderColor: isDark
                  ? "rgba(255, 255, 255, 0.1)"
                  : "rgba(0, 0, 0, 0.1)",
              }}
            />
          </div>

          <div>
            <label
              className="block text-muted-foreground mb-2"
              style={{
                fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
              }}
            >
              Password
            </label>
            <button
              type="button"
              onClick={() => setShowPasswordModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)",
                height: `${DESIGN_TOKENS.interactive.input.height}px`,
                fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
              }}
            >
              <Lock className="w-4 h-4" />
              Change Password
            </button>
          </div>

          <div>
            <label
              className="block text-muted-foreground mb-2"
              style={{
                fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
              }}
            >
              Position (Read Only)
            </label>
            <input
              type="text"
              value={profile.position}
              disabled
              className="w-full border-2 bg-white/50 dark:bg-white/5 backdrop-blur-sm opacity-60"
              style={{
                ...inputStyle,
                borderColor: isDark
                  ? "rgba(255, 255, 255, 0.1)"
                  : "rgba(0, 0, 0, 0.1)",
              }}
            />
          </div>

          <div>
            <label
              className="block text-muted-foreground mb-2"
              style={{
                fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
              }}
            >
              Role (Read Only)
            </label>
            <input
              type="text"
              value={profile.role}
              disabled
              className="w-full border-2 bg-white/50 dark:bg-white/5 backdrop-blur-sm opacity-60"
              style={{
                ...inputStyle,
                borderColor: isDark
                  ? "rgba(255, 255, 255, 0.1)"
                  : "rgba(0, 0, 0, 0.1)",
              }}
            />
          </div>

          {/* Status Field */}
          <div>
            <label
              className="block text-muted-foreground mb-2"
              style={{
                fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
              }}
            >
              Status (Read Only)
            </label>
            <input
              type="text"
              value={profile.status}
              disabled
              className="w-full border-2 bg-white/50 dark:bg-white/5 backdrop-blur-sm opacity-60"
              style={{
                ...inputStyle,
                borderColor: isDark
                  ? "rgba(255, 255, 255, 0.1)"
                  : "rgba(0, 0, 0, 0.1)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Floating Action Buttons - Bottom Right */}
      {isEditing && (
        <div 
          className="fixed bottom-6 right-6 flex gap-3 z-50"
          style={{
            filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.15))',
          }}
        >
          <Button 
            variant="secondary" 
            onClick={handleCancel} 
            disabled={isSaving}
            className="!px-6"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={isSaving}
            icon={isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            className="!px-6"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      )}
        </>
      )}

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onVerifyPassword={async (password) => {
          return await verifyPassword(currentUsername, password);
        }}
        onChangePassword={async (currentPwd, newPwd) => {
          return await changePassword(currentUsername, currentPwd, newPwd);
        }}
        isDark={isDark}
        addUploadToast={addUploadToast}
        updateUploadToast={updateUploadToast}
      />
    </PageLayout>
  );
}