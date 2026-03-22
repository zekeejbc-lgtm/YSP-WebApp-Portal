/**
 * =============================================================================
 * MY PROFILE PAGE
 * =============================================================================
 * * SMART SPEC COMPLIANCE:
 * ✅ Uses PageLayout master component
 * ✅ Profile image: 120px with orange border (4px)
 * ✅ Form inputs: 44px height
 * ✅ Button components: Edit, Save, Cancel variants
 * ✅ Two-column layout with proper spacing
 * ✅ Connected to real backend via GAS API
 * ✅ Progress toast for save operations
 * * =============================================================================
 */

import { useState, useEffect, useRef } from "react";
import { User as UserIcon, Save, Edit, Camera, Loader2, Lock, Mail, CheckCircle2, AlertCircle, X, Settings } from "lucide-react";
import { toast } from "sonner";
import { PageLayout, Button, DESIGN_TOKENS, getGlassStyle } from "./design-system";
import { SkeletonProfilePage } from "./SkeletonCard";
import { UploadToastMessage } from "./UploadToast";
import ChangePasswordModal from "./ChangePasswordModal";
import EmailVerificationModal from "./EmailVerificationModal";
import Setup2FAModal from "./Setup2FAModal";
import TwoFactorActionModal from "./TwoFactorActionModal";
import {
  saveUserProfileToCache,
  loadUserProfileFromCache,
  clearUserProfileCache,
  type CachedUserProfile,
} from "../services/localStorageCache";
import { 
  fetchUserProfile, 
  updateUserProfile, 
  uploadProfilePicture,
  getStoredUser,
  verifyPassword,
  changePassword,
  get2FAStatus,
  generateTotpEnrollment,
  enrollUser2FA,
  enableUser2FA,
  disableUser2FA,
  beginTotpSecretReset,
  confirmTotpSecretReset,
  sendVerificationOTP,
  verifyOTP,
  checkEmailVerified,
  type UserProfile 
} from "../services/gasLoginService";

interface MyProfilePageProps {
  onClose: () => void;
  isDark: boolean;
  addUploadToast?: (message: UploadToastMessage) => void;
  updateUploadToast?: (id: string, updates: Partial<UploadToastMessage>) => void;
  removeUploadToast?: (id: string) => void;
  onProfilePictureChange?: (newUrl: string) => void;
  onEditingChange?: (isEditing: boolean) => void;
  startInEditMode?: boolean;
  onOpenSettings?: () => void;
}

export default function MyProfilePage({ 
  onClose, 
  isDark,
  addUploadToast,
  updateUploadToast,
  removeUploadToast,
  onProfilePictureChange,
  onEditingChange,
  startInEditMode = false,
  onOpenSettings,
}: MyProfilePageProps) {
  const [isEditing, setIsEditing] = useState(startInEditMode);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null); // Local preview before save
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null); // Local blob URL for preview
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [currentUsername, setCurrentUsername] = useState<string>('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [authenticatorLinked, setAuthenticatorLinked] = useState(false);
  const [showSetup2FAModal, setShowSetup2FAModal] = useState(false);
  const [setupMode, setSetupMode] = useState<"enroll" | "reset">("enroll");
  const [showTwoFactorActionModal, setShowTwoFactorActionModal] = useState(false);
  const [twoFactorAction, setTwoFactorAction] = useState<"enable" | "disable" | "reset">("disable");
  const [prefetchedSetupResponse, setPrefetchedSetupResponse] = useState<{
    success: boolean;
    secret?: string;
    otpAuthUri?: string;
    expiresInSeconds?: number;
    error?: string;
  } | null>(null);
  const [originalProfile, setOriginalProfile] = useState<typeof profile | null>(null); // Track original values
  
  // Email verification states
  const [showEmailVerificationModal, setShowEmailVerificationModal] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState<string>(''); // Track which email was verified
  const [isCheckingVerification, setIsCheckingVerification] = useState(false);
  const hasLoadedRef = useRef(false);

  const getManilaDateParts = () => {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(new Date());
    const lookup = (type: string) => parts.find((part) => part.type === type)?.value || '0';
    return {
      year: Number(lookup('year')),
      month: Number(lookup('month')),
      day: Number(lookup('day')),
    };
  };

  const getBirthdayParts = (birthday: string) => {
    if (!birthday) return null;

    const exactDateMatch = birthday.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (exactDateMatch) {
      return {
        year: Number(exactDateMatch[1]),
        month: Number(exactDateMatch[2]),
        day: Number(exactDateMatch[3]),
      };
    }

    const parsed = new Date(birthday);
    if (isNaN(parsed.getTime())) {
      return null;
    }

    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(parsed);
    const lookup = (type: string) => parts.find((part) => part.type === type)?.value || '0';
    return {
      year: Number(lookup('year')),
      month: Number(lookup('month')),
      day: Number(lookup('day')),
    };
  };

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

  // Notify parent when editing state changes
  useEffect(() => {
    onEditingChange?.(isEditing);
  }, [isEditing, onEditingChange]);

  // React to external trigger to start edit mode
  useEffect(() => {
    if (startInEditMode && !isEditing) {
      setIsEditing(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startInEditMode]);

  // Fetch profile data on mount - with local storage cache for fast loading
  useEffect(() => {
    const loadProfile = async () => {
      if (hasLoadedRef.current) {
        return;
      }
      hasLoadedRef.current = true;
      
      const controller = new AbortController();
      const { signal } = controller;
      
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

      // ===== STEP 1: Try to load from cache for instant display =====
      const cachedData = loadUserProfileFromCache(storedUser.username);
      let loadedFromCache = false;
      
      if (cachedData) {
        // [FIXED] Removed console.log
        const { data: cached, isStale } = cachedData;
        
        // Apply cached data immediately
        const cachedProfile = {
          ...cached.profile,
          age: calculateAge(cached.profile.birthday || ''),
          password: '••••••••',
        };
        setProfile(cachedProfile);
        setOriginalProfile(cachedProfile);
        
        if (cached.profile.profilePictureURL) {
          setProfileImage(cached.profile.profilePictureURL);
        }
        
        setIsEmailVerified(cached.emailVerified);
        setVerifiedEmail(cached.verifiedEmail);
        
        loadedFromCache = true;
        
        // If cache is fresh (not stale), we're done - just do background sync
        if (!isStale) {
          setIsLoading(false);
          // [FIXED] Removed console.log
          // Continue to background sync below
        } else {
          // [FIXED] Removed console.log
        }
      }

      // If we loaded from cache, skip showing the loading toast for faster perceived performance
      const toastId = `profile-load-${Date.now()}`;
      const shouldShowToast = !loadedFromCache;
      
      if (shouldShowToast) {
        setIsLoading(true);
        if (addUploadToast) {
          addUploadToast({
            id: toastId,
            title: 'Loading Profile',
            message: 'Starting up...',
            status: 'loading',
            progress: 5,
            progressLabel: 'Loading...',
            onCancel: () => {
              controller.abort();
              if (updateUploadToast) {
                updateUploadToast(toastId, {
                  status: 'info',
                  progress: 100,
                  title: 'Cancelled',
                  message: 'Profile load cancelled',
                });
              }
            },
          });
        }
      }

      // ===== STEP 2: Fetch from backend (sync or refresh) =====
      try {
        if (shouldShowToast && updateUploadToast) {
          updateUploadToast(toastId, { progress: 20, message: 'Connecting to backend...' });
        }

        const response = await fetchUserProfile(storedUser.username, signal);
        if (signal.aborted) {
          return;
        }
        
        if (shouldShowToast && updateUploadToast) {
          updateUploadToast(toastId, { progress: 55, message: 'Applying profile data...' });
        }

        if (response.success && response.profile) {
          const p = response.profile;
          const loadedProfile = {
            fullName: p.fullName || '',
            username: p.username || '',
            email: p.email || '',
            personalEmail: p.personalEmail || '',
            contactNumber: p.contactNumber || '',
            birthday: p.birthday || '',
            age: calculateAge(p.birthday || ''),
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
          
          // Update state with fresh data
          setProfile(loadedProfile);
          setOriginalProfile(loadedProfile);
          
          // Set profile picture if available
          if (p.profilePictureURL) {
            setProfileImage(p.profilePictureURL);
          }
          
          // Check email verification status
          let emailVerified = false;
          let verifiedEmailAddr = '';
          if (p.personalEmail) {
            setIsCheckingVerification(true);
            if (shouldShowToast && updateUploadToast) {
              updateUploadToast(toastId, { progress: 75, message: 'Checking email verification...' });
            }
            try {
              const verifyResult = await checkEmailVerified(storedUser.username, p.personalEmail, signal);
              if (signal.aborted) {
                return;
              }
              if (verifyResult.success && verifyResult.verified) {
                emailVerified = true;
                verifiedEmailAddr = p.personalEmail;
                setIsEmailVerified(true);
                setVerifiedEmail(p.personalEmail);
              }
            } catch (verifyError) {
              console.error('Failed to check email verification:', verifyError);
            } finally {
              setIsCheckingVerification(false);
            }
          }

          // ===== STEP 3: Save to cache for next time =====
          const cacheData: CachedUserProfile = {
            username: storedUser.username,
            profile: {
              fullName: p.fullName || '',
              username: p.username || '',
              email: p.email || '',
              personalEmail: p.personalEmail || '',
              contactNumber: p.contactNumber || '',
              birthday: p.birthday || '',
              age: calculateAge(p.birthday || ''),
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
              position: p.position || '',
              role: p.role || '',
              status: p.status || '',
              profilePictureURL: p.profilePictureURL,
            },
            emailVerified,
            verifiedEmail: verifiedEmailAddr,
          };
          saveUserProfileToCache(cacheData);
          // [FIXED] Removed console.log

          if (shouldShowToast) {
            if (updateUploadToast) {
              updateUploadToast(toastId, {
                status: 'success',
                progress: 100,
                title: 'Profile Ready',
                message: 'Profile loaded successfully.',
              });
            }
            if (removeUploadToast) {
              setTimeout(() => removeUploadToast(toastId), 2500);
            }
          } else if (loadedFromCache) {
            // Background sync completed silently
            // [FIXED] Removed console.log
          }
        } else {
          // Only show error if we didn't load from cache
          if (!loadedFromCache) {
            if (shouldShowToast && updateUploadToast) {
              updateUploadToast(toastId, {
                status: 'error',
                progress: 100,
                title: 'Load Failed',
                message: response.error || 'Unable to load profile data.',
              });
            }
            if (shouldShowToast && removeUploadToast) {
              setTimeout(() => removeUploadToast(toastId), 5000);
            }
            toast.error('Failed to load profile', {
              description: response.error || 'Please try again later',
            });
          }
        }
      } catch (error) {
        if (signal.aborted) {
          return;
        }
        console.error('Failed to load profile:', error);
        
        // Only show error if we didn't load from cache
        if (!loadedFromCache) {
          if (shouldShowToast && updateUploadToast) {
            updateUploadToast(toastId, {
              status: 'error',
              progress: 100,
              title: 'Load Failed',
              message: error instanceof Error ? error.message : 'Please try again later',
            });
          }
          if (shouldShowToast && removeUploadToast) {
            setTimeout(() => removeUploadToast(toastId), 5000);
          }
          toast.error('Failed to load profile', {
            description: error instanceof Error ? error.message : 'Please try again later'
          });
        } else {
          // Loaded from cache but backend failed - show subtle warning
          console.warn('[Profile] Backend sync failed, using cached data');
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [onClose, addUploadToast, updateUploadToast, removeUploadToast]); // [FIXED] Added missing dependencies

  const refresh2FAStatus = async () => {
    if (!currentUsername) return;
    try {
      const result = await get2FAStatus();
      if (result.success) {
        setTwoFactorEnabled(!!(result.loginEnabled ?? result.enabled));
        setAuthenticatorLinked(!!(result.authenticatorLinked ?? result.enabled));
      }
    } catch {
      // Keep profile usable even when 2FA status check fails.
    }
  };

  useEffect(() => {
    void refresh2FAStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUsername]);

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
      const birthDate = getBirthdayParts(birthday);
      if (!birthDate) return 0;
      const today = getManilaDateParts();
      let age = today.year - birthDate.year;
      if (today.month < birthDate.month || (today.month === birthDate.month && today.day < birthDate.day)) {
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
    const controller = new AbortController();
    const { signal } = controller;
    
    // Show progress toast
    if (addUploadToast) {
      addUploadToast({
        id: toastId,
        title: 'Saving Profile',
        message: 'Preparing data...',
        status: 'loading',
        progress: 10,
        onCancel: () => {
          controller.abort();
          if (updateUploadToast) {
            updateUploadToast(toastId, {
              status: 'info',
              progress: 100,
              title: 'Cancelled',
              message: 'Profile save cancelled',
            });
          }
        },
      });
    }
    
    try {
      // Update progress
      if (updateUploadToast) {
        updateUploadToast(toastId, { progress: 25, message: 'Validating fields...' });
      }

      // Upload pending profile picture if there is one
      if (pendingImageFile) {
        setIsUploadingImage(true); // [FIXED] Used the variable
        if (updateUploadToast) {
          updateUploadToast(toastId, { progress: 25, message: 'Uploading profile picture...' });
        }
        
        try {
          const uploadResult = await uploadProfilePicture(pendingImageFile, currentUsername, signal);

          if (signal.aborted) {
            setIsUploadingImage(false);
            return;
          }
          
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
            
            // [FIXED] Removed console.log
          } else {
            throw new Error(uploadResult.error || 'Failed to upload profile picture');
          }
        } catch (uploadError) {
          console.error('Profile picture upload error:', uploadError);
          // Continue with other saves even if image upload fails
          toast.warning('Profile picture upload failed', {
            description: 'Your other changes will still be saved',
          });
        } finally {
          setIsUploadingImage(false); // [FIXED] Reset state
        }
      }

      // Update progress
      if (updateUploadToast) {
        updateUploadToast(toastId, { progress: 40, message: 'Validating fields...' });
      }

      // Build the update data object - ONLY include fields that have changed
      const editableFields = [
        'fullName', 'username', 'personalEmail', 'contactNumber', 'birthday',
        'gender', 'pronouns', 'civilStatus', 'religion', 'nationality',
        'address', 'barangay', 'city', 'province', 'zipCode',
        'facebook', 'instagram', 'twitter', // [FIXED] Removed chapter/committee from this list
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

      const response = await updateUserProfile(currentUsername, updateData, signal);

      if (signal.aborted) {
        return;
      }
      
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
        
        // If username was changed, update local storage and state
        if (updateData.username && updateData.username !== currentUsername) {
          const newUsername = updateData.username as string;
          
          // Update the stored user object in localStorage
          const storedUser = localStorage.getItem('ysp_user');
          if (storedUser) {
            try {
              const userObj = JSON.parse(storedUser);
              userObj.username = newUsername;
              localStorage.setItem('ysp_user', JSON.stringify(userObj));
              // [FIXED] Removed console.log
            } catch (e) {
              console.error('Failed to update username in localStorage:', e);
            }
          }
          
          // Update the currentUsername state so future saves use the new username
          setCurrentUsername(newUsername);
          
          detailMessage += ' (Username changed - you may need to use your new username to log in next time)';
        }
        
        // Update original profile to match current after successful save
        setOriginalProfile({ ...profile });
        
        // Update the cache with the new profile data
        const updatedUsername = (updateData.username as string) || currentUsername;
        const cacheData: CachedUserProfile = {
          username: updatedUsername,
          profile: {
            fullName: profile.fullName || '',
            username: profile.username || '',
            email: profile.email || '',
            personalEmail: profile.personalEmail || '',
            contactNumber: profile.contactNumber || '',
            birthday: profile.birthday || '',
            age: calculateAge(profile.birthday || ''),
            gender: profile.gender || '',
            pronouns: profile.pronouns || '',
            idCode: profile.idCode || '',
            civilStatus: profile.civilStatus || '',
            religion: profile.religion || '',
            nationality: profile.nationality || '',
            address: profile.address || '',
            barangay: profile.barangay || '',
            city: profile.city || '',
            province: profile.province || '',
            zipCode: profile.zipCode || '',
            chapter: profile.chapter || '',
            committee: profile.committee || '',
            dateJoined: profile.dateJoined || '',
            membershipType: profile.membershipType || '',
            facebook: profile.facebook || '',
            instagram: profile.instagram || '',
            twitter: profile.twitter || '',
            emergencyContactName: profile.emergencyContactName || '',
            emergencyContactRelation: profile.emergencyContactRelation || '',
            emergencyContactNumber: profile.emergencyContactNumber || '',
            position: profile.position || '',
            role: profile.role || '',
            status: profile.status || '',
            profilePictureURL: profileImage || undefined,
          },
          emailVerified: isEmailVerified,
          verifiedEmail: verifiedEmail,
        };
        saveUserProfileToCache(cacheData);
        
        // If username changed, clear old cache
        if (updateData.username && updateData.username !== currentUsername) {
          clearUserProfileCache(currentUsername);
        }
        // [FIXED] Removed console.log
        
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
      if (signal.aborted) {
        return;
      }
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
      actions={onOpenSettings ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={onOpenSettings}
          icon={<Settings className="w-4 h-4" />}
          className="px-2! min-w-0!"
          style={{ width: "36px" }}
        />
      ) : undefined}
      breadcrumbs={[
        { label: "Home", onClick: onClose },
        { label: "My Profile", onClick: undefined },
      ]}
    >
      {/* Loading State - Skeleton UI */}
      {isLoading ? (
        <SkeletonProfilePage isDark={isDark} />
      ) : (
        <>
      {/* Profile Header Card */}
      <div
        className="border rounded-lg text-center mb-6 relative"
        style={{
          borderRadius: `${DESIGN_TOKENS.radius.card}px`,
          padding: `${DESIGN_TOKENS.spacing.scale["2xl"]}px`,
          borderColor: isDark
            ? "rgba(255, 255, 255, 0.1)"
            : "rgba(0, 0, 0, 0.1)",
          ...glassStyle,
        }}
      >
        {/* Edit/Save/Cancel Buttons - Top Right */}
        <div className="absolute top-2 right-2 sm:top-3 sm:right-3 md:top-4 md:right-4 flex gap-1 sm:gap-2">
          {isEditing ? (
            <>
              <Button 
                variant="secondary" 
                onClick={handleCancel} 
                disabled={isSaving}
                className="p-1.5! sm:p-2! md:px-4! md:py-2! min-w-0!"
                icon={<X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
              >
                <span className="hidden md:inline text-sm">Cancel</span>
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={isSaving}
                icon={isSaving ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" /> : <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                className="p-1.5! sm:p-2! md:px-4! md:py-2! min-w-0!"
              >
                <span className="hidden md:inline text-sm">{isSaving ? 'Saving...' : 'Save'}</span>
              </Button>
            </>
          ) : (
            !isLoading && (
              <Button
                variant="primary"
                onClick={() => setIsEditing(true)}
                icon={<Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                className="p-1.5! sm:p-2! md:px-4! md:py-2! min-w-0!"
              >
                <span className="hidden md:inline text-sm">Edit</span>
              </Button>
            )
          )}
        </div>

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
                onLoad={() => {
                  // [FIXED] Removed console.log
                }}
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
                      // [FIXED] Removed console.log
                      target.src = altUrl;
                    } else if (profileImage.includes('lh3.googleusercontent.com')) {
                      const altUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w500`;
                      // [FIXED] Removed console.log
                      target.src = altUrl;
                    } else {
                      const altUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w500`;
                      // [FIXED] Removed console.log
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
          {/* Full Name Field */}
          <div>
            <label
              className="block text-muted-foreground mb-2"
              style={{
                fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
              }}
            >
              Full Name
            </label>
            <input
              type="text"
              value={profile.fullName}
              onChange={(e) => handleChange("fullName", e.target.value)}
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

          {/* Personal Email Field with Verification */}
          <div>
            <label
              className="flex items-center gap-2 text-muted-foreground mb-2"
              style={{
                fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
              }}
            >
              <span>Personal Email</span>
              {/* Verification status indicator */}
              {isCheckingVerification ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
              ) : isEmailVerified && profile.personalEmail === verifiedEmail ? (
                <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span style={{ fontSize: `${DESIGN_TOKENS.typography.fontSize.small}px` }}>Verified</span>
                </span>
              ) : profile.personalEmail ? (
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span style={{ fontSize: `${DESIGN_TOKENS.typography.fontSize.small}px` }}>Not verified</span>
                </span>
              ) : null}
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={profile.personalEmail}
                onChange={(e) => {
                  handleChange("personalEmail", e.target.value);
                  // If email changes, reset verification status
                  if (e.target.value !== verifiedEmail) {
                    setIsEmailVerified(false);
                  }
                }}
                disabled={!isEditing}
                className="flex-1 border-2 bg-white/50 dark:bg-white/5 backdrop-blur-sm transition-all disabled:opacity-60 focus:outline-none focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20"
                style={{
                  ...inputStyle,
                  borderColor: isEmailVerified && profile.personalEmail === verifiedEmail
                    ? "#22c55e"
                    : isDark
                    ? "rgba(255, 255, 255, 0.1)"
                    : "rgba(0, 0, 0, 0.1)",
                }}
                placeholder="your.email@example.com"
              />
              {/* Verify button - show when email is not verified or changed */}
              {profile.personalEmail && (!isEmailVerified || profile.personalEmail !== verifiedEmail) && (
                <button
                  onClick={() => setShowEmailVerificationModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all hover:opacity-90"
                  style={{
                    background: "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)",
                    color: "#fff",
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    height: `${DESIGN_TOKENS.interactive.input.height}px`,
                    whiteSpace: "nowrap",
                  }}
                >
                  <Mail className="w-4 h-4" />
                  <span>Verify</span>
                </button>
              )}
            </div>
          </div>

          {/* Other fields */}
          {[
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
            { label: "Chapter", value: profile.chapter, key: "chapter", editable: false }, // [FIXED] editable: false
            { label: "Committee", value: profile.committee, key: "committee", editable: false }, // [FIXED] editable: false
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

      {/* Authenticator Security */}
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
          Authenticator
        </h3>
        <p
          className="mb-4 text-sm"
          style={{
            color: isDark ? "rgba(255,255,255,0.72)" : "rgba(0,0,0,0.62)",
          }}
        >
          Manage your two-factor authentication for login and account recovery.
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <span
            className="rounded-full border px-2 py-1 text-xs"
            style={{
              borderColor: twoFactorEnabled ? "rgba(34,197,94,0.35)" : "rgba(107,114,128,0.25)",
              color: twoFactorEnabled ? "#16a34a" : "#6b7280",
              backgroundColor: twoFactorEnabled ? "rgba(34,197,94,0.08)" : "rgba(107,114,128,0.08)",
            }}
          >
            {twoFactorEnabled ? "Authenticator Enabled" : "Authenticator Disabled"}
          </span>
          <button
            type="button"
            onClick={() => {
              if (twoFactorEnabled) {
                setTwoFactorAction("disable");
                setShowTwoFactorActionModal(true);
                return;
              }
              if (authenticatorLinked) {
                setTwoFactorAction("enable");
                setShowTwoFactorActionModal(true);
                return;
              }
              setSetupMode("enroll");
              setShowSetup2FAModal(true);
            }}
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs"
            style={{
              borderColor: twoFactorEnabled ? "rgba(34,197,94,0.35)" : "rgba(107,114,128,0.3)",
              color: twoFactorEnabled ? "#16a34a" : "#6b7280",
              backgroundColor: twoFactorEnabled ? "rgba(34,197,94,0.08)" : "rgba(107,114,128,0.08)",
            }}
            aria-label={twoFactorEnabled ? "Disable two-factor authentication" : "Enable two-factor authentication"}
          >
            <span
              className="relative inline-block"
              style={{
                width: "34px",
                height: "18px",
                borderRadius: "999px",
                backgroundColor: twoFactorEnabled ? "rgba(34,197,94,0.45)" : "rgba(107,114,128,0.35)",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: "2px",
                  left: twoFactorEnabled ? "18px" : "2px",
                  width: "14px",
                  height: "14px",
                  borderRadius: "999px",
                  backgroundColor: "#fff",
                  transition: "left 0.2s ease",
                }}
              />
            </span>
            <span>{twoFactorEnabled ? "On" : "Off"}</span>
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (twoFactorEnabled) {
                setTwoFactorAction("disable");
                setShowTwoFactorActionModal(true);
                return;
              }
              if (authenticatorLinked) {
                setTwoFactorAction("enable");
                setShowTwoFactorActionModal(true);
                return;
              }
              setSetupMode("enroll");
              setShowSetup2FAModal(true);
            }}
            className="rounded-lg border px-3 py-1.5 text-xs"
            style={{
              borderColor: twoFactorEnabled ? "rgba(239,68,68,0.35)" : "rgba(246,66,31,0.3)",
              color: twoFactorEnabled ? "#dc2626" : "#f6421f",
              backgroundColor: twoFactorEnabled ? "rgba(239,68,68,0.06)" : "rgba(246,66,31,0.06)",
            }}
          >
            {twoFactorEnabled ? "Disable 2FA" : "Enable 2FA"}
          </button>
          {authenticatorLinked && (
            <button
              type="button"
              onClick={() => {
                setTwoFactorAction("reset");
                setShowTwoFactorActionModal(true);
              }}
              className="rounded-lg border px-3 py-1.5 text-xs"
              style={{
                borderColor: "rgba(246,66,31,0.3)",
                color: "#f6421f",
                backgroundColor: "rgba(246,66,31,0.06)",
              }}
            >
              Reset Secret
            </button>
          )}
        </div>
      </div>
        </>
      )}

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        twoFactorEnabled={twoFactorEnabled}
        onVerifyPassword={async (password) => {
          return await verifyPassword(currentUsername, password);
        }}
        onChangePassword={async (currentPwd, newPwd, totpCode, signal) => {
          return await changePassword(currentUsername, currentPwd, newPwd, totpCode, signal);
        }}
        isDark={isDark}
        addUploadToast={addUploadToast}
        updateUploadToast={updateUploadToast}
      />

      <Setup2FAModal
        isOpen={showSetup2FAModal}
        isDark={isDark}
        mode={setupMode}
        onClose={() => {
          setShowSetup2FAModal(false);
          setPrefetchedSetupResponse(null);
        }}
        onStart={async () => {
          if (setupMode === "reset" && prefetchedSetupResponse) {
            return prefetchedSetupResponse;
          }
          return await generateTotpEnrollment();
        }}
        onConfirm={async (code) => {
          return setupMode === "reset" ? await confirmTotpSecretReset(code) : await enrollUser2FA(code);
        }}
        onCompleted={() => {
          void refresh2FAStatus();
          toast.success(setupMode === "reset" ? "Authenticator secret reset." : "Two-factor authentication enabled.");
        }}
      />

      <TwoFactorActionModal
        isOpen={showTwoFactorActionModal}
        isDark={isDark}
        title={
          twoFactorAction === "reset"
            ? "Reset Authenticator Secret"
            : twoFactorAction === "enable"
              ? "Enable Two-Factor Authentication"
              : "Disable Two-Factor Authentication"
        }
        subtitle={
          twoFactorAction === "reset"
            ? "Re-verify your identity to generate a new authenticator secret."
            : twoFactorAction === "enable"
              ? "Confirm your identity to re-enable login authenticator verification."
              : "Confirm your identity before disabling login authenticator verification."
        }
        confirmLabel={twoFactorAction === "reset" ? "Continue" : twoFactorAction === "enable" ? "Enable 2FA" : "Disable 2FA"}
        loadingLabel={twoFactorAction === "reset" ? "Starting reset..." : twoFactorAction === "enable" ? "Enabling..." : "Disabling..."}
        onClose={() => setShowTwoFactorActionModal(false)}
        onConfirm={async (currentPassword, totpCode) => {
          if (twoFactorAction === "enable") {
            const result = await enableUser2FA(currentPassword, totpCode);
            if (result.success) {
              setTwoFactorEnabled(true);
              setAuthenticatorLinked(true);
              toast.success("Two-factor authentication enabled for login.");
              return { success: true };
            }
            return { success: false, error: result.error || "Failed to enable 2FA." };
          }

          if (twoFactorAction === "disable") {
            const result = await disableUser2FA(currentPassword, totpCode);
            if (result.success) {
              setTwoFactorEnabled(false);
              setAuthenticatorLinked(!!(result.authenticatorLinked ?? true));
              toast.success("Two-factor login verification disabled.");
              return { success: true };
            }
            return { success: false, error: result.error || "Failed to disable 2FA." };
          }

          const beginResult = await beginTotpSecretReset(currentPassword, totpCode);
          if (!beginResult.success) {
            return { success: false, error: beginResult.error || "Failed to start reset." };
          }

          setPrefetchedSetupResponse(beginResult);
          setShowTwoFactorActionModal(false);
          setSetupMode("reset");
          setShowSetup2FAModal(true);
          return { success: true };
        }}
      />

      {/* Email Verification Modal */}
      <EmailVerificationModal
        isOpen={showEmailVerificationModal}
        onClose={() => {
          setShowEmailVerificationModal(false);
          // Re-check verification status when modal closes
          if (profile.personalEmail && currentUsername) {
            checkEmailVerified(currentUsername, profile.personalEmail).then(result => {
              if (result.success && result.verified) {
                setIsEmailVerified(true);
                setVerifiedEmail(profile.personalEmail);
              }
            });
          }
        }}
        email={profile.personalEmail}
        username={currentUsername}
        onSendOTP={async (email, signal) => {
          const result = await sendVerificationOTP(currentUsername, email, signal);
          return result;
        }}
        onVerifyOTP={async (otp, signal) => {
          const result = await verifyOTP(currentUsername, profile.personalEmail, otp, signal);
          if (result.success && result.verified) {
            setIsEmailVerified(true);
            setVerifiedEmail(profile.personalEmail);
          }
          return result;
        }}
        isDark={isDark}
        addUploadToast={addUploadToast}
        updateUploadToast={updateUploadToast}
      />
    </PageLayout>
  );
}
