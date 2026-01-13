/**
 * =============================================================================
 * MEMBERSHIP REGISTRATION MODAL
 * =============================================================================
 * 
 * Comprehensive membership registration form with:
 * - Personal Information
 * - Full Address Details
 * - Demographics
 * - YSP Chapter & Committee Selection
 * - Skills & Education
 * - Emergency Contact
 * - Social Media Links (multiple)
 * - File Attachments (Valid ID, 1x1 Picture)
 * 
 * Mobile and Desktop Responsive
 * =============================================================================
 */

import { useState } from "react";
import { X, Upload, Plus, Trash, User, MapPin, Briefcase, Heart, Share2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { Button, DESIGN_TOKENS } from "./design-system";
import { MODAL_REGULATIONS, getModalStyles } from "./modal-regulations";

interface SocialMediaLink {
  id: string;
  platform: string;
  url: string;
}

interface FileAttachment {
  id: string;
  type: "validId" | "formalPicture";
  file: File | null;
  preview?: string;
}

interface RegistrationFormData {
  // Personal Info
  fullName: string;
  email: string;
  phone: string;
  
  // Address
  country: string;
  province: string;
  city: string;
  barangay: string;
  purok: string;
  
  // Demographics
  gender: string;
  dateOfBirth: string;
  age: string;
  civilStatus: string;
  nationality: string;
  
  // YSP Info
  chapter: string;
  committeePreference: string;
  desiredRole: string;
  
  // Additional Info
  skills: string;
  educationCurrent: string;
  reasonForJoining: string;
  personalStatement: string;
  
  // Emergency Contact
  emergencyContactName: string;
  emergencyContactRelation: string;
  emergencyContactNumber: string;
  
  // Social Media
  socialMedia: SocialMediaLink[];
  
  // Attachments
  validId: FileAttachment | null;
  formalPicture: FileAttachment | null;
}

interface MembershipRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  onSubmit: (data: RegistrationFormData) => void;
}

export default function MembershipRegistrationModal({
  isOpen,
  onClose,
  isDark,
  onSubmit,
}: MembershipRegistrationModalProps) {
  const [currentTab, setCurrentTab] = useState<"personal" | "yspinfo" | "additional">("personal");
  
  const [formData, setFormData] = useState<RegistrationFormData>({
    fullName: "",
    email: "",
    phone: "",
    country: "Philippines",
    province: "",
    city: "",
    barangay: "",
    purok: "",
    gender: "",
    dateOfBirth: "",
    age: "",
    civilStatus: "",
    nationality: "Filipino",
    chapter: "Tagum Chapter",
    committeePreference: "",
    desiredRole: "",
    skills: "",
    educationCurrent: "",
    reasonForJoining: "",
    personalStatement: "",
    emergencyContactName: "",
    emergencyContactRelation: "",
    emergencyContactNumber: "",
    socialMedia: [],
    validId: null,
    formalPicture: null,
  });

  const committees = [
    "Community Development",
    "Environmental Conservation",
    "Youth Development",
    "Health & Wellness",
    "Education & Literacy",
    "Disaster Response",
    "Events Management",
    "Communications & Media",
  ];

  const roles = ["Volunteer", "Member", "Officer", "Committee Head"];

  const handleInputChange = (field: keyof RegistrationFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    
    // Auto-calculate age when date of birth changes
    if (field === "dateOfBirth" && value) {
      const birthDate = new Date(value);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        setFormData((prev) => ({ ...prev, age: String(age - 1) }));
      } else {
        setFormData((prev) => ({ ...prev, age: String(age) }));
      }
    }
  };

  const handleAddSocialMedia = () => {
    const newLink: SocialMediaLink = {
      id: Date.now().toString(),
      platform: "",
      url: "",
    };
    setFormData((prev) => ({
      ...prev,
      socialMedia: [...prev.socialMedia, newLink],
    }));
  };

  const handleRemoveSocialMedia = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      socialMedia: prev.socialMedia.filter((link) => link.id !== id),
    }));
  };

  const handleUpdateSocialMedia = (id: string, field: "platform" | "url", value: string) => {
    setFormData((prev) => ({
      ...prev,
      socialMedia: prev.socialMedia.map((link) =>
        link.id === id ? { ...link, [field]: value } : link
      ),
    }));
  };

  const handleFileUpload = (type: "validId" | "formalPicture", event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    // Validate file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif"];
    if (!validTypes.includes(file.type)) {
      toast.error("Please upload an image file (JPEG, PNG, or GIF)");
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      const attachment: FileAttachment = {
        id: Date.now().toString(),
        type,
        file,
        preview: reader.result as string,
      };

      if (type === "validId") {
        setFormData((prev) => ({ ...prev, validId: attachment }));
      } else {
        setFormData((prev) => ({ ...prev, formalPicture: attachment }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveFile = (type: "validId" | "formalPicture") => {
    if (type === "validId") {
      setFormData((prev) => ({ ...prev, validId: null }));
    } else {
      setFormData((prev) => ({ ...prev, formalPicture: null }));
    }
  };

  const validateForm = (): boolean => {
    // Personal Info
    if (!formData.fullName || !formData.email || !formData.phone) {
      toast.error("Please fill in all required personal information");
      setCurrentTab("personal");
      return false;
    }

    // Address
    if (!formData.province || !formData.city || !formData.barangay) {
      toast.error("Please complete your address information");
      setCurrentTab("personal");
      return false;
    }

    // Demographics
    if (!formData.gender || !formData.dateOfBirth || !formData.civilStatus) {
      toast.error("Please complete demographics information");
      setCurrentTab("personal");
      return false;
    }

    // YSP Info
    if (!formData.committeePreference || !formData.desiredRole) {
      toast.error("Please select your committee preference and desired role");
      setCurrentTab("yspinfo");
      return false;
    }

    // Additional Info
    if (!formData.reasonForJoining || !formData.personalStatement) {
      toast.error("Please provide your reason for joining and personal statement");
      setCurrentTab("additional");
      return false;
    }

    // Emergency Contact
    if (!formData.emergencyContactName || !formData.emergencyContactRelation || !formData.emergencyContactNumber) {
      toast.error("Please provide emergency contact information");
      setCurrentTab("additional");
      return false;
    }

    // Attachments
    if (!formData.validId || !formData.formalPicture) {
      toast.error("Please upload both your Valid ID and 1x1 Formal Picture");
      setCurrentTab("additional");
      return false;
    }

    return true;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;
    
    onSubmit(formData);
    toast.success("Membership application submitted successfully!");
    onClose();
  };

  if (!isOpen) return null;

  const modalStyles = getModalStyles(isDark, "large");

  const tabs = [
    { id: "personal", label: "Personal Info", icon: User },
    { id: "yspinfo", label: "YSP Information", icon: Briefcase },
    { id: "additional", label: "Additional Details", icon: Paperclip },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
      style={{
        background: modalStyles.overlay.background,
        backdropFilter: modalStyles.overlay.backdropFilter,
      }}
      onClick={onClose}
    >
      <div
        className="w-full overflow-hidden animate-in"
        style={{
          maxWidth: modalStyles.panel.maxWidth,
          maxHeight: "calc(100vh - 64px)",
          background: modalStyles.panel.background,
          backdropFilter: modalStyles.panel.backdropFilter,
          border: `${modalStyles.panel.borderWidth} solid ${modalStyles.panel.borderColor}`,
          borderRadius: modalStyles.panel.borderRadius,
          boxShadow: modalStyles.panel.boxShadow,
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="p-4 md:p-6 border-b"
          style={{
            borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
            background: `linear-gradient(135deg, ${isDark ? "rgba(246, 66, 31, 0.1)" : "rgba(246, 66, 31, 0.05)"} 0%, ${isDark ? "rgba(238, 135, 36, 0.1)" : "rgba(238, 135, 36, 0.05)"} 100%)`,
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2
              style={{
                fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                fontSize: `${DESIGN_TOKENS.typography.fontSize.h2}px`,
                fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
                color: isDark ? "#fb923c" : "#ea580c",
              }}
            >
              Membership Registration
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setCurrentTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-all ${
                    isActive ? "text-white" : "hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                  style={{
                    background: isActive
                      ? "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)"
                      : "transparent",
                    fontWeight: isActive
                      ? DESIGN_TOKENS.typography.fontWeight.semibold
                      : DESIGN_TOKENS.typography.fontWeight.medium,
                  }}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body - Scrollable */}
        <div className="p-4 md:p-6 overflow-y-auto flex-1" style={{ minHeight: 0 }}>
          {/* Personal Info Tab */}
          {currentTab === "personal" && (
            <div className="space-y-6">
              {/* Basic Information */}
              <div>
                <h3
                  className="mb-4 flex items-center gap-2"
                  style={{
                    fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  }}
                >
                  <User className="w-5 h-5 text-[#f6421f]" />
                  Basic Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => handleInputChange("fullName", e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none"
                      style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                      placeholder="Juan Dela Cruz"
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                      Email Address *
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none"
                      style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                      placeholder="juan@email.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none"
                      style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                      placeholder="+63 912 345 6789"
                    />
                  </div>
                </div>
              </div>

              {/* Address Information */}
              <div>
                <h3
                  className="mb-4 flex items-center gap-2"
                  style={{
                    fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  }}
                >
                  <MapPin className="w-5 h-5 text-[#ee8724]" />
                  Address Details
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                      Country *
                    </label>
                    <input
                      type="text"
                      value={formData.country}
                      onChange={(e) => handleInputChange("country", e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none"
                      style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                      Province *
                    </label>
                    <input
                      type="text"
                      value={formData.province}
                      onChange={(e) => handleInputChange("province", e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none"
                      style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                      placeholder="Davao del Norte"
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                      City *
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => handleInputChange("city", e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none"
                      style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                      placeholder="Tagum City"
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                      Barangay *
                    </label>
                    <input
                      type="text"
                      value={formData.barangay}
                      onChange={(e) => handleInputChange("barangay", e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none"
                      style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                      placeholder="Barangay Name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                      Purok / Street
                    </label>
                    <input
                      type="text"
                      value={formData.purok}
                      onChange={(e) => handleInputChange("purok", e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none"
                      style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                      placeholder="Purok 1"
                    />
                  </div>
                </div>
              </div>

              {/* Demographics */}
              <div>
                <h3
                  className="mb-4 flex items-center gap-2"
                  style={{
                    fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  }}
                >
                  Demographics
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                      Gender *
                    </label>
                    <select
                      value={formData.gender}
                      onChange={(e) => handleInputChange("gender", e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none"
                      style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                      Date of Birth *
                    </label>
                    <input
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => handleInputChange("dateOfBirth", e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none"
                      style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                      Age
                    </label>
                    <input
                      type="text"
                      value={formData.age}
                      readOnly
                      className="w-full px-4 py-2 rounded-lg border bg-gray-100 dark:bg-gray-700 outline-none"
                      style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                      placeholder="Auto-calculated"
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                      Civil Status *
                    </label>
                    <select
                      value={formData.civilStatus}
                      onChange={(e) => handleInputChange("civilStatus", e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none"
                      style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                    >
                      <option value="">Select Status</option>
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="Widowed">Widowed</option>
                      <option value="Separated">Separated</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                      Nationality *
                    </label>
                    <input
                      type="text"
                      value={formData.nationality}
                      onChange={(e) => handleInputChange("nationality", e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none"
                      style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* YSP Information Tab */}
          {currentTab === "yspinfo" && (
            <div className="space-y-6">
              <div>
                <h3
                  className="mb-4 flex items-center gap-2"
                  style={{
                    fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  }}
                >
                  <Briefcase className="w-5 h-5 text-[#f6421f]" />
                  YSP Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                      YSP Chapter *
                    </label>
                    <input
                      type="text"
                      value={formData.chapter}
                      readOnly
                      className="w-full px-4 py-2 rounded-lg border bg-gray-100 dark:bg-gray-700 outline-none"
                      style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                      Committee Preference *
                    </label>
                    <select
                      value={formData.committeePreference}
                      onChange={(e) => handleInputChange("committeePreference", e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none"
                      style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                    >
                      <option value="">Select Committee</option>
                      {committees.map((committee) => (
                        <option key={committee} value={committee}>
                          {committee}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                      Desired Role *
                    </label>
                    <select
                      value={formData.desiredRole}
                      onChange={(e) => handleInputChange("desiredRole", e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none"
                      style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                    >
                      <option value="">Select Role</option>
                      {roles.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                  Skills & Expertise
                </label>
                <textarea
                  value={formData.skills}
                  onChange={(e) => handleInputChange("skills", e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none resize-none"
                  style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                  rows={3}
                  placeholder="List your skills, e.g., Public Speaking, Event Planning, Graphic Design..."
                />
              </div>

              <div>
                <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                  Current Education
                </label>
                <input
                  type="text"
                  value={formData.educationCurrent}
                  onChange={(e) => handleInputChange("educationCurrent", e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none"
                  style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                  placeholder="e.g., BS Computer Science, University of Mindanao"
                />
              </div>
            </div>
          )}

          {/* Additional Details Tab */}
          {currentTab === "additional" && (
            <div className="space-y-6">
              {/* Motivation */}
              <div>
                <h3
                  className="mb-4"
                  style={{
                    fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  }}
                >
                  About You
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                      Why do you want to join YSP? *
                    </label>
                    <textarea
                      value={formData.reasonForJoining}
                      onChange={(e) => handleInputChange("reasonForJoining", e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none resize-none"
                      style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                      rows={4}
                      placeholder="Share your motivation and what you hope to contribute..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                      Personal Statement *
                    </label>
                    <textarea
                      value={formData.personalStatement}
                      onChange={(e) => handleInputChange("personalStatement", e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none resize-none"
                      style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                      rows={4}
                      placeholder="Tell us about yourself, your values, and how you align with YSP's mission..."
                    />
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div>
                <h3
                  className="mb-4 flex items-center gap-2"
                  style={{
                    fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  }}
                >
                  <Heart className="w-5 h-5 text-[#ee8724]" />
                  Emergency Contact
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                      Contact Name *
                    </label>
                    <input
                      type="text"
                      value={formData.emergencyContactName}
                      onChange={(e) => handleInputChange("emergencyContactName", e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none"
                      style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                      placeholder="Full Name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                      Relation *
                    </label>
                    <input
                      type="text"
                      value={formData.emergencyContactRelation}
                      onChange={(e) => handleInputChange("emergencyContactRelation", e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none"
                      style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                      placeholder="e.g., Mother, Father, Spouse"
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                      Contact Number *
                    </label>
                    <input
                      type="tel"
                      value={formData.emergencyContactNumber}
                      onChange={(e) => handleInputChange("emergencyContactNumber", e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none"
                      style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                      placeholder="+63 912 345 6789"
                    />
                  </div>
                </div>
              </div>

              {/* Social Media */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3
                    className="flex items-center gap-2"
                    style={{
                      fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                      fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    }}
                  >
                    <Share2 className="w-5 h-5 text-[#fbcb29]" />
                    Social Media
                  </h3>
                  <button
                    onClick={handleAddSocialMedia}
                    className="px-3 py-1.5 rounded-lg bg-[#f6421f] text-white hover:bg-[#ee8724] transition-all text-sm flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Add Link
                  </button>
                </div>

                {formData.socialMedia.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No social media links added yet. Click "Add Link" to include your social profiles.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {formData.socialMedia.map((link) => (
                      <div key={link.id} className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-3">
                        <input
                          type="text"
                          value={link.platform}
                          onChange={(e) => handleUpdateSocialMedia(link.id, "platform", e.target.value)}
                          className="px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none"
                          style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                          placeholder="Platform (e.g., Facebook)"
                        />
                        <input
                          type="url"
                          value={link.url}
                          onChange={(e) => handleUpdateSocialMedia(link.id, "url", e.target.value)}
                          className="px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none"
                          style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                          placeholder="URL"
                        />
                        <button
                          onClick={() => handleRemoveSocialMedia(link.id)}
                          className="px-3 py-2 rounded-lg bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800 transition-all"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* File Attachments */}
              <div>
                <h3
                  className="mb-4 flex items-center gap-2"
                  style={{
                    fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  }}
                >
                  <Paperclip className="w-5 h-5 text-[#f6421f]" />
                  Required Attachments
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Valid ID */}
                  <div>
                    <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                      Valid ID *
                    </label>
                    {formData.validId ? (
                      <div
                        className="relative rounded-lg border p-3"
                        style={{
                          borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
                          background: isDark ? "rgba(30, 41, 59, 0.5)" : "rgba(249, 250, 251, 0.8)",
                        }}
                      >
                        <img
                          src={formData.validId.preview}
                          alt="Valid ID"
                          className="w-full h-32 object-cover rounded-lg mb-2"
                        />
                        <p className="text-xs text-muted-foreground mb-2 truncate">{formData.validId.file?.name}</p>
                        <button
                          onClick={() => handleRemoveFile("validId")}
                          className="w-full px-3 py-1.5 rounded bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800 transition-all text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <label
                        className="block w-full p-6 rounded-lg border-2 border-dashed cursor-pointer hover:border-[#f6421f] transition-all"
                        style={{
                          borderColor: isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)",
                          background: isDark ? "rgba(30, 41, 59, 0.3)" : "rgba(249, 250, 251, 0.5)",
                        }}
                      >
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileUpload("validId", e)}
                          className="hidden"
                        />
                        <div className="text-center">
                          <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Click to upload Valid ID</p>
                          <p className="text-xs text-muted-foreground mt-1">Max 5MB (JPEG, PNG, GIF)</p>
                        </div>
                      </label>
                    )}
                  </div>

                  {/* 1x1 Formal Picture */}
                  <div>
                    <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                      1x1 Formal Picture *
                    </label>
                    {formData.formalPicture ? (
                      <div
                        className="relative rounded-lg border p-3"
                        style={{
                          borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
                          background: isDark ? "rgba(30, 41, 59, 0.5)" : "rgba(249, 250, 251, 0.8)",
                        }}
                      >
                        <img
                          src={formData.formalPicture.preview}
                          alt="Formal Picture"
                          className="w-full h-32 object-cover rounded-lg mb-2"
                        />
                        <p className="text-xs text-muted-foreground mb-2 truncate">{formData.formalPicture.file?.name}</p>
                        <button
                          onClick={() => handleRemoveFile("formalPicture")}
                          className="w-full px-3 py-1.5 rounded bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800 transition-all text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <label
                        className="block w-full p-6 rounded-lg border-2 border-dashed cursor-pointer hover:border-[#f6421f] transition-all"
                        style={{
                          borderColor: isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)",
                          background: isDark ? "rgba(30, 41, 59, 0.3)" : "rgba(249, 250, 251, 0.5)",
                        }}
                      >
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileUpload("formalPicture", e)}
                          className="hidden"
                        />
                        <div className="text-center">
                          <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Click to upload 1x1 Picture</p>
                          <p className="text-xs text-muted-foreground mt-1">Max 5MB (JPEG, PNG, GIF)</p>
                        </div>
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="p-4 md:p-6 border-t flex flex-col sm:flex-row gap-3"
          style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
        >
          <Button variant="secondary" onClick={onClose} className="flex-1 sm:flex-none sm:w-32">
            Cancel
          </Button>

          {/* Navigation Buttons */}
          <div className="flex gap-3 flex-1">
            {currentTab !== "personal" && (
              <Button
                variant="secondary"
                onClick={() => {
                  const tabs: Array<"personal" | "yspinfo" | "additional"> = ["personal", "yspinfo", "additional"];
                  const currentIndex = tabs.indexOf(currentTab);
                  if (currentIndex > 0) setCurrentTab(tabs[currentIndex - 1]);
                }}
                className="flex-1"
              >
                Previous
              </Button>
            )}

            {currentTab !== "additional" ? (
              <Button
                variant="primary"
                onClick={() => {
                  const tabs: Array<"personal" | "yspinfo" | "additional"> = ["personal", "yspinfo", "additional"];
                  const currentIndex = tabs.indexOf(currentTab);
                  if (currentIndex < tabs.length - 1) setCurrentTab(tabs[currentIndex + 1]);
                }}
                className="flex-1"
              >
                Next
              </Button>
            ) : (
              <Button variant="primary" onClick={handleSubmit} className="flex-1">
                Submit Application
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
