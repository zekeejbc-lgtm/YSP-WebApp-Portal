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
 * 
 * =============================================================================
 */

import { useState } from "react";
import { User as UserIcon, Eye, EyeOff, Save, Edit, Camera, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageLayout, Button, DESIGN_TOKENS, getGlassStyle } from "./design-system";

interface MyProfilePageProps {
  onClose: () => void;
  isDark: boolean;
}

export default function MyProfilePage({ onClose, isDark }: MyProfilePageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const [profile, setProfile] = useState({
    // Personal Info
    fullName: "Juan Dela Cruz",
    username: "juan.delacruz",
    email: "juan.delacruz@ysp.org.ph",
    contactNumber: "+63 912 345 6789",
    birthday: "1998-05-15",
    age: 26,
    gender: "Male",
    pronouns: "He/Him",
    // Identity
    idCode: "MEM-001",
    civilStatus: "Single",
    religion: "Roman Catholic",
    nationality: "Filipino",
    // Address
    address: "123 Main Street, Tagum City",
    barangay: "New Visayas",
    city: "Tagum City",
    province: "Davao del Norte",
    zipCode: "8100",
    // YSP Information
    chapter: "Tagum Chapter",
    committee: "Executive Board",
    dateJoined: "2023-01-15",
    membershipType: "Active Member",
    // Social Media
    facebook: "facebook.com/juandelacruz",
    instagram: "@juandelacruz",
    twitter: "@juandelacruz",
    // Emergency Contact
    emergencyContactName: "Maria Dela Cruz",
    emergencyContactRelation: "Mother",
    emergencyContactNumber: "+63 912 345 6780",
    // Account
    password: "••••••••",
    position: "Chapter President",
    role: "Admin",
  });

  const handleProfileImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size too large', {
          description: 'Please upload an image smaller than 5MB'
        });
        return;
      }
      if (!file.type.match(/image\/(png|jpg|jpeg)/)) {
        toast.error('Invalid file type', {
          description: 'Please upload a PNG or JPG image'
        });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result as string);
        setHasUnsavedChanges(true);
        toast.success('Profile picture updated!');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleChange = (field: string, value: string) => {
    setProfile({ ...profile, [field]: value });
    setHasUnsavedChanges(true);
  };

  const handleSave = () => {
    toast.success("Profile Updated Successfully", {
      description: "Your changes have been saved.",
    });
    setIsEditing(false);
    setHasUnsavedChanges(false);
  };

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      if (confirm("Discard unsaved changes?")) {
        setIsEditing(false);
        setHasUnsavedChanges(false);
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
        !isEditing ? (
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
            {profileImage ? (
              <img
                src={profileImage}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <UserIcon className="w-16 h-16" />
            )}
          </div>
          
          {/* Change Picture Button */}
          {isEditing && (
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
                accept="image/png,image/jpeg,image/jpg"
                onChange={handleProfileImageUpload}
                className="hidden"
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
            { label: "Email", value: profile.email, key: "email", editable: true },
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
            { label: "Date Joined", value: profile.dateJoined, key: "dateJoined", editable: true, type: "date" },
            { label: "Membership Type", value: profile.membershipType, key: "membershipType", editable: true },
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
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={profile.password}
                onChange={(e) => handleChange("password", e.target.value)}
                disabled={!isEditing}
                className="w-full border-2 bg-white/50 dark:bg-white/5 backdrop-blur-sm transition-all disabled:opacity-60 focus:outline-none focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20"
                style={{
                  ...inputStyle,
                  paddingRight: "48px",
                  borderColor: isDark
                    ? "rgba(255, 255, 255, 0.1)"
                    : "rgba(0, 0, 0, 0.1)",
                }}
              />
              {isEditing && (
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  type="button"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              )}
            </div>
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
        </div>
      </div>

      {/* Action Buttons */}
      {isEditing && (
        <div className="flex gap-4">
          <Button variant="secondary" onClick={handleCancel} fullWidth>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            fullWidth
            icon={<Save className="w-5 h-5" />}
          >
            Save Changes
          </Button>
        </div>
      )}
    </PageLayout>
  );
}