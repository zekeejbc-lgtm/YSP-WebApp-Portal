/**
 * =============================================================================
 * MEMBERSHIP APPLICATIONS PAGE
 * =============================================================================
 * 
 * Admin/Auditor View: Editor to manage application settings (Open/Close)
 * Public View: Application form when open, closed message when closed
 * 
 * Features:
 * - Open/Close applications toggle (Admin/Auditor only)
 * - Stats display (Open Positions, Total Applicants, Available Slots)
 * - Create new application opportunities (Admin/Auditor only)
 * - Manage application settings
 * - Public registration form integration
 * 
 * =============================================================================
 */

import { useState } from "react";
import {
  Plus, Edit, Trash2, Users, BarChart3, AlertCircle, 
  UserPlus, CheckCircle, X, Lock, Unlock, Settings,
  ClipboardList, Calendar, Clock, GripVertical, Eye, EyeOff,
  Type, AlignLeft, Mail, Phone, List, Circle, Square, 
  FileText, Upload, ChevronDown, ChevronUp
} from "lucide-react";
import { toast } from "sonner";
import { PageLayout, Button, DESIGN_TOKENS } from "./design-system";
import MembershipRegistrationModal from "./MembershipRegistrationModal";
import CreateOpportunityModalEnhanced from "./CreateOpportunityModalEnhanced";
import ApplyToOpportunityModal from "./ApplyToOpportunityModal";
import CustomizeMembershipFormModal, { MembershipFormField } from "./CustomizeMembershipFormModal";

interface ApplicationOpportunity {
  id: string;
  title: string;
  description: string;
  committee: string;
  availableSlots: number;
  deadline: string;
  status: "open" | "closed";
  customFields?: CustomField[];
}

interface CustomField {
  id: string;
  label: string;
  type: "text" | "textarea" | "email" | "phone" | "select" | "radio" | "checkbox" | "date" | "file";
  required: boolean;
  enabled: boolean;
  options?: string[]; // for select, radio, checkbox
  placeholder?: string;
}

interface MembershipApplicationsPageProps {
  onClose: () => void;
  isDark: boolean;
  userRole: string;
  isLoggedIn?: boolean;
  pendingApplications: any[];
  setPendingApplications: (apps: any[]) => void;
  username?: string;
}

export default function MembershipApplicationsPage({
  onClose,
  isDark,
  userRole,
  isLoggedIn = false,
  pendingApplications,
  setPendingApplications,
  username = "admin",
}: MembershipApplicationsPageProps) {
  // Global application status
  const [applicationsOpen, setApplicationsOpen] = useState(true);
  
  // Application opportunities
  const [opportunities, setOpportunities] = useState<ApplicationOpportunity[]>([
    {
      id: "OPP-001",
      title: "Community Development Officer",
      description: "Lead community outreach programs and coordinate volunteer activities",
      committee: "Community Development",
      availableSlots: 2,
      deadline: "2025-12-31",
      status: "open",
    },
    {
      id: "OPP-002",
      title: "Environmental Conservation Volunteer",
      description: "Join tree planting campaigns and coastal cleanup initiatives",
      committee: "Environmental Conservation",
      availableSlots: 8,
      deadline: "2025-12-25",
      status: "open",
    },
  ]);

  // Modals
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [showCreateOpportunityModal, setShowCreateOpportunityModal] = useState(false);
  const [editingOpportunity, setEditingOpportunity] = useState<ApplicationOpportunity | null>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<ApplicationOpportunity | null>(null);
  const [showCustomizeFormModal, setShowCustomizeFormModal] = useState(false);

  // Membership Form Fields Configuration
  const [membershipFormFields, setMembershipFormFields] = useState<MembershipFormField[]>([
    // Personal Information
    { id: "fullName", label: "Full name", type: "text", required: true, enabled: true, category: "personal", systemField: true, order: 1, placeholder: "Enter your full name" },
    { id: "dateOfBirth", label: "Date of Birth", type: "date", required: true, enabled: true, category: "personal", order: 2 },
    { id: "age", label: "Age", type: "number", required: true, enabled: true, category: "personal", order: 3, placeholder: "Enter your age" },
    
    // Demographics
    { id: "sexGender", label: "Sex/Gender", type: "select", required: true, enabled: true, category: "demographics", order: 4, options: ["Male", "Female", "Non-binary", "Prefer not to say"] },
    { id: "pronouns", label: "Pronouns", type: "select", required: false, enabled: true, category: "demographics", order: 5, options: ["He/Him", "She/Her", "They/Them", "Other"] },
    { id: "civilStatus", label: "Civil Status", type: "select", required: true, enabled: true, category: "demographics", order: 6, options: ["Single", "Married", "Widowed", "Separated", "Divorced"] },
    { id: "religion", label: "Religion", type: "text", required: false, enabled: true, category: "demographics", order: 7, placeholder: "Enter your religion" },
    { id: "nationality", label: "Nationality", type: "text", required: true, enabled: true, category: "demographics", order: 8, placeholder: "Enter your nationality" },
    
    // Contact Information
    { id: "email", label: "Email Address", type: "email", required: true, enabled: true, category: "contact", systemField: true, order: 9, placeholder: "your.email@example.com" },
    { id: "personalEmail", label: "Personal Email Address", type: "email", required: false, enabled: true, category: "contact", order: 10, placeholder: "personal.email@example.com" },
    { id: "phone", label: "Contact Number", type: "phone", required: true, enabled: true, category: "contact", systemField: true, order: 11, placeholder: "+63 XXX XXX XXXX" },
    
    // Address
    { id: "address", label: "Address", type: "text", required: true, enabled: true, category: "address", order: 12, placeholder: "Street Address" },
    { id: "barangay", label: "Barangay", type: "text", required: true, enabled: true, category: "address", order: 13, placeholder: "Barangay" },
    { id: "city", label: "City", type: "text", required: true, enabled: true, category: "address", order: 14, placeholder: "City" },
    { id: "province", label: "Province", type: "text", required: true, enabled: true, category: "address", order: 15, placeholder: "Province" },
    { id: "zipCode", label: "Zip Code", type: "text", required: false, enabled: true, category: "address", order: 16, placeholder: "0000" },
    
    // Social Media
    { id: "facebook", label: "Facebook", type: "url", required: false, enabled: true, category: "social", order: 17, placeholder: "https://facebook.com/username" },
    { id: "instagram", label: "Instagram", type: "url", required: false, enabled: true, category: "social", order: 18, placeholder: "https://instagram.com/username" },
    { id: "twitter", label: "Twitter", type: "url", required: false, enabled: true, category: "social", order: 19, placeholder: "https://twitter.com/username" },
    
    // Emergency Contact
    { id: "emergencyName", label: "Emergency Contact Name", type: "text", required: true, enabled: true, category: "emergency", order: 20, placeholder: "Enter emergency contact name" },
    { id: "emergencyRelation", label: "Emergency Contact Relation", type: "text", required: true, enabled: true, category: "emergency", order: 21, placeholder: "Relationship (Mother, Father, Sibling, etc.)" },
    { id: "emergencyNumber", label: "Emergency Contact Number", type: "phone", required: true, enabled: true, category: "emergency", order: 22, placeholder: "+63 XXX XXX XXXX" },
    
    // YSP Information
    { id: "chapter", label: "Chapter", type: "select", required: true, enabled: true, category: "ysp", order: 23, options: ["Tagum Chapter", "Davao Chapter", "Manila Chapter"] },
    { id: "committee", label: "Committee", type: "select", required: true, enabled: true, category: "ysp", order: 24, options: ["Community Development", "Environmental Conservation", "Education & Training", "Health & Wellness", "Communications & Media"] },
    { id: "position", label: "Position", type: "text", required: false, enabled: false, category: "ysp", order: 25, placeholder: "Desired position" },
    { id: "role", label: "Role", type: "select", required: false, enabled: false, category: "ysp", order: 26, options: ["Member", "Volunteer", "Officer"] },
    { id: "membershipType", label: "Membership Type", type: "select", required: false, enabled: false, category: "ysp", order: 27, options: ["Regular", "Associate", "Honorary"] },
    { id: "dateJoined", label: "Date Joined", type: "date", required: false, enabled: false, category: "ysp", order: 28 },
    { id: "status", label: "Status", type: "select", required: false, enabled: false, category: "system", systemField: true, order: 29, options: ["Active", "Inactive", "Pending"] },
    
    // Privacy & Agreements
    { id: "dataPrivacyAgreement", label: "DATA PRIVACY AGREEMENT", type: "checkbox", required: true, enabled: true, category: "privacy", order: 30, options: ["I agree to the Data Privacy Agreement"] },
    { id: "dataPrivacyAcknowledgment", label: "Data Privacy Acknowledgment", type: "checkbox", required: true, enabled: true, category: "privacy", order: 31, options: ["I acknowledge the data privacy terms"] },
    { id: "declarationTruthfulness", label: "Declaration of Truthfulness and Responsibility", type: "checkbox", required: true, enabled: true, category: "privacy", order: 32, options: ["I declare that all information provided is true and accurate"] },
    { id: "prohibitionAcknowledgment", label: "Do you understand that by prohibiting the collection of your personal information, your application will not be processed?", type: "radio", required: true, enabled: true, category: "privacy", order: 33, options: ["Yes, I understand", "No"], conditionalField: true, showWhen: { fieldId: "dataPrivacyAgreement", condition: "unchecked" } },
    
    // Account Creation
    { id: "username", label: "Username", type: "text", required: true, enabled: true, category: "account", systemField: true, order: 34, placeholder: "Choose a unique username" },
    { id: "password", label: "Password", type: "password", required: true, enabled: true, category: "account", systemField: true, order: 35, placeholder: "Create a secure password (min 8 characters)" },
    { id: "profilePictureURL", label: "Profile Picture", type: "file", required: true, enabled: true, category: "account", systemField: true, order: 36, placeholder: "Upload your profile picture" },
    
    // System Fields (Admin Only)
    { id: "idCode", label: "ID Code", type: "text", required: false, enabled: false, category: "system", systemField: true, order: 37, placeholder: "Auto-generated ID" },
    { id: "timestamp", label: "Timestamp", type: "text", required: false, enabled: false, category: "system", systemField: true, order: 38 },
  ]);

  // Calculate stats
  const totalApplicants = pendingApplications?.length || 0;
  const openPositions = opportunities.filter(o => o.status === "open").length;
  const availableSlots = opportunities.reduce((sum, o) => sum + o.availableSlots, 0);

  // Handlers
  const handleToggleApplications = () => {
    setApplicationsOpen(!applicationsOpen);
    toast.success(
      applicationsOpen 
        ? "Applications Closed" 
        : "Applications Opened",
      {
        description: applicationsOpen
          ? "New registrations are now disabled"
          : "New registrations are now enabled"
      }
    );
  };

  const handleCreateOpportunity = () => {
    setEditingOpportunity(null);
    setShowCreateOpportunityModal(true);
  };

  const handleEditOpportunity = (opp: ApplicationOpportunity) => {
    setEditingOpportunity(opp);
    setShowCreateOpportunityModal(true);
  };

  const handleDeleteOpportunity = (id: string) => {
    setOpportunities(opportunities.filter(o => o.id !== id));
    toast.success("Opportunity deleted");
  };

  const handleToggleOpportunityStatus = (id: string) => {
    setOpportunities(
      opportunities.map(o =>
        o.id === id ? { ...o, status: o.status === "open" ? "closed" : "open" } : o
      )
    );
    toast.success("Status updated");
  };

  const handleRegistrationSubmit = (formData: any) => {
    // Add to pending applications
    const newApplication = {
      id: `APP-${String((pendingApplications?.length || 0) + 1).padStart(3, "0")}`,
      name: formData.fullName,
      email: formData.email,
      phone: formData.phone,
      dateApplied: new Date().toISOString().split("T")[0],
      committee: formData.committeePreference,
      status: "pending" as const,
      fullData: formData,
    };

    setPendingApplications([...(pendingApplications || []), newApplication]);
    
    toast.success("Application Submitted Successfully!", {
      description: "Your application is now pending review by our admin team.",
    });

    setShowRegistrationModal(false);
  };

  const isAdminOrAuditor = userRole === "admin" || userRole === "auditor";

  return (
    <PageLayout
      title="Membership Applications"
      subtitle={isAdminOrAuditor ? "Manage membership application settings" : "Apply for positions and join our team"}
      isDark={isDark}
      onClose={onClose}
      breadcrumbs={[
        { label: "Home", onClick: onClose },
        { label: "Membership Applications", onClick: undefined },
      ]}
      actions={
        isAdminOrAuditor ? (
          <div className="flex flex-wrap gap-2 justify-end">
            <Button
              variant={applicationsOpen ? "secondary" : "primary"}
              onClick={handleToggleApplications}
              icon={applicationsOpen ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
              size="sm"
              style={
                applicationsOpen
                  ? undefined
                  : {
                      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    }
              }
            >
              <span className="hidden sm:inline">{applicationsOpen ? "Close" : "Open"}</span>
              <span className="sm:hidden">{applicationsOpen ? "Close" : "Open"}</span>
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateOpportunity}
              icon={<Plus className="w-5 h-5" />}
              size="sm"
            >
              <span className="hidden sm:inline">Create</span>
            </Button>
          </div>
        ) : null
      }
    >
      {/* Admin/Auditor Editor View */}
      {isAdminOrAuditor && (
        <>
          {/* Global Status Banner */}
          <div
            className="rounded-xl p-6 border mb-6"
            style={{
              background: applicationsOpen
                ? isDark
                  ? "rgba(16, 185, 129, 0.1)"
                  : "rgba(16, 185, 129, 0.05)"
                : isDark
                ? "rgba(239, 68, 68, 0.1)"
                : "rgba(239, 68, 68, 0.05)",
              borderColor: applicationsOpen ? "#10b981" : "#ef4444",
            }}
          >
            <div className="flex items-center gap-3">
              {applicationsOpen ? (
                <CheckCircle className="w-6 h-6 text-green-500" />
              ) : (
                <Lock className="w-6 h-6 text-red-500" />
              )}
              <div className="flex-1">
                <h3
                  style={{
                    fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    color: applicationsOpen ? "#10b981" : "#ef4444",
                  }}
                >
                  Applications {applicationsOpen ? "Open" : "Closed"}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {applicationsOpen
                    ? "New membership registrations are currently being accepted"
                    : "New membership registrations are currently disabled"}
                </p>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Open Positions */}
            <div
              className="rounded-xl p-6 border"
              style={{
                background: isDark ? "rgba(30, 41, 59, 0.7)" : "rgba(255, 255, 255, 0.7)",
                backdropFilter: "blur(20px)",
                borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <p className="text-sm text-muted-foreground">Open Positions</p>
              </div>
              <h3
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.h1}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
                  color: "#10b981",
                }}
              >
                {openPositions}
              </h3>
            </div>

            {/* Total Applicants */}
            <div
              className="rounded-xl p-6 border"
              style={{
                background: isDark ? "rgba(30, 41, 59, 0.7)" : "rgba(255, 255, 255, 0.7)",
                backdropFilter: "blur(20px)",
                borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <Users className="w-5 h-5" style={{ color: DESIGN_TOKENS.colors.brand.red }} />
                <p className="text-sm text-muted-foreground">Total Applicants</p>
              </div>
              <h3
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.h1}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
                  color: DESIGN_TOKENS.colors.brand.red,
                }}
              >
                {totalApplicants}
              </h3>
            </div>

            {/* Available Slots */}
            <div
              className="rounded-xl p-6 border"
              style={{
                background: isDark ? "rgba(30, 41, 59, 0.7)" : "rgba(255, 255, 255, 0.7)",
                backdropFilter: "blur(20px)",
                borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <BarChart3 className="w-5 h-5" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
                <p className="text-sm text-muted-foreground">Available Slots</p>
              </div>
              <h3
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.h1}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
                  color: DESIGN_TOKENS.colors.brand.orange,
                }}
              >
                {availableSlots}
              </h3>
            </div>
          </div>

          {/* Membership Registration Section */}
          {applicationsOpen && (
            <div className="mb-6">
              <h3
                className="mb-4"
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                }}
              >
                Membership Registration
              </h3>
              <div
                className="rounded-xl p-8 border cursor-pointer hover:shadow-lg transition-all"
                style={{
                  background: `linear-gradient(135deg, ${
                    isDark ? "rgba(246, 66, 31, 0.1)" : "rgba(246, 66, 31, 0.05)"
                  } 0%, ${isDark ? "rgba(238, 135, 36, 0.1)" : "rgba(238, 135, 36, 0.05)"} 100%)`,
                  borderColor: DESIGN_TOKENS.colors.brand.orange,
                }}
                onClick={() => setShowRegistrationModal(true)}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="rounded-full p-4"
                    style={{
                      background: "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)",
                    }}
                  >
                    <UserPlus className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3
                      className="mb-2"
                      style={{
                        fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                        fontSize: `${DESIGN_TOKENS.typography.fontSize.h2}px`,
                        fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                        color: DESIGN_TOKENS.colors.brand.red,
                      }}
                    >
                      Become a Member of YSP Tagum
                    </h3>
                    <p className="text-muted-foreground">
                      Submit your membership registration application to join our organization
                    </p>
                  </div>
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    {(userRole === "admin" || userRole === "auditor") && (
                      <Button
                        variant="secondary"
                        icon={<Settings className="w-5 h-5" />}
                        onClick={() => setShowCustomizeFormModal(true)}
                      >
                        <span className="hidden sm:inline">Customize Form</span>
                      </Button>
                    )}
                    <Button
                      variant="primary"
                      icon={<UserPlus className="w-5 h-5" />}
                      onClick={() => setShowRegistrationModal(true)}
                    >
                      Apply Now
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Application Opportunities List */}
          <div className="space-y-4">
            <h3
              style={{
                fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
              }}
            >
              Application Opportunities
            </h3>

            {opportunities.map((opp) => (
              <div
                key={opp.id}
                className="rounded-xl p-6 border cursor-pointer hover:shadow-lg transition-all"
                onClick={() => {
                  setSelectedOpportunity(opp);
                  setShowApplyModal(true);
                }}
                style={{
                  background: isDark ? "rgba(30, 41, 59, 0.7)" : "rgba(255, 255, 255, 0.7)",
                  backdropFilter: "blur(20px)",
                  borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4
                        style={{
                          fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                          fontSize: `${DESIGN_TOKENS.typography.fontSize.h4}px`,
                          fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                        }}
                      >
                        {opp.title}
                      </h4>
                      <span
                        className="px-3 py-1 rounded-full text-xs"
                        style={{
                          backgroundColor: opp.status === "open" ? "#10b98120" : "#6b728020",
                          color: opp.status === "open" ? "#10b981" : "#6b7280",
                          fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                        }}
                      >
                        {opp.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{opp.description}</p>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{opp.committee}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{opp.availableSlots} slots</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          Deadline: {new Date(opp.deadline).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons - Stop propagation to prevent triggering card click */}
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleToggleOpportunityStatus(opp.id)}
                      className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                      title={opp.status === "open" ? "Close" : "Open"}
                    >
                      {opp.status === "open" ? (
                        <Lock className="w-5 h-5 text-red-500" />
                      ) : (
                        <Unlock className="w-5 h-5 text-green-500" />
                      )}
                    </button>
                    <button
                      onClick={() => handleEditOpportunity(opp)}
                      className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteOpportunity(opp.id)}
                      className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5 text-red-500" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {opportunities.length === 0 && (
              <div
                className="rounded-xl p-12 border text-center"
                style={{
                  background: isDark ? "rgba(30, 41, 59, 0.7)" : "rgba(255, 255, 255, 0.7)",
                  backdropFilter: "blur(20px)",
                  borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
                }}
              >
                <ClipboardList className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <p className="text-muted-foreground">No application opportunities yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Click "Create New Opportunity" to add positions
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Public View (Guest/Member) */}
      {!isAdminOrAuditor && (
        <>
          {applicationsOpen ? (
            <>
              {/* Membership Registration Section */}
              {applicationsOpen && (
                <div className="mb-6">
                  <h3
                    className="mb-4"
                    style={{
                      fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                      fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    }}
                  >
                    Membership Registration
                  </h3>
                  <div
                    className="rounded-xl p-8 border cursor-pointer hover:shadow-lg transition-all"
                    style={{
                      background: `linear-gradient(135deg, ${
                        isDark ? "rgba(246, 66, 31, 0.1)" : "rgba(246, 66, 31, 0.05)"
                      } 0%, ${isDark ? "rgba(238, 135, 36, 0.1)" : "rgba(238, 135, 36, 0.05)"} 100%)`,
                      borderColor: DESIGN_TOKENS.colors.brand.orange,
                    }}
                    onClick={() => setShowRegistrationModal(true)}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="rounded-full p-4"
                        style={{
                          background: "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)",
                        }}
                      >
                        <UserPlus className="w-8 h-8 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3
                          className="mb-2"
                          style={{
                            fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                            fontSize: `${DESIGN_TOKENS.typography.fontSize.h2}px`,
                            fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                            color: DESIGN_TOKENS.colors.brand.red,
                          }}
                        >
                          Become a Member of YSP Tagum
                        </h3>
                        <p className="text-muted-foreground">
                          Submit your membership registration application to join our organization
                        </p>
                      </div>
                      <Button
                        variant="primary"
                        icon={<UserPlus className="w-5 h-5" />}
                      >
                        Apply Now
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Application Opportunities List */}
              <div className="space-y-4">
                <h3
                  style={{
                    fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  }}
                >
                  Application Opportunities
                </h3>

                {opportunities
                  .filter((opp) => opp.status === "open")
                  .map((opp) => (
                    <div
                      key={opp.id}
                      className="rounded-xl p-6 border cursor-pointer hover:shadow-lg transition-all"
                      onClick={() => {
                        setSelectedOpportunity(opp);
                        setShowApplyModal(true);
                      }}
                      style={{
                        background: isDark ? "rgba(30, 41, 59, 0.7)" : "rgba(255, 255, 255, 0.7)",
                        backdropFilter: "blur(20px)",
                        borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <h4
                          style={{
                            fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                            fontSize: `${DESIGN_TOKENS.typography.fontSize.h4}px`,
                            fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                          }}
                        >
                          {opp.title}
                        </h4>
                        <span
                          className="px-3 py-1 rounded-full text-xs"
                          style={{
                            backgroundColor: "#10b98120",
                            color: "#10b981",
                            fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                          }}
                        >
                          OPEN
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{opp.description}</p>
                      <div className="flex flex-wrap gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <ClipboardList className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">{opp.committee}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">{opp.availableSlots} slots available</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            Apply by {new Date(opp.deadline).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </>
          ) : (
            /* Applications Closed Message */
            <div
              className="rounded-xl p-12 border text-center"
              style={{
                background: isDark ? "rgba(239, 68, 68, 0.1)" : "rgba(254, 226, 226, 0.8)",
                borderColor: "#ef4444",
              }}
            >
              <Lock className="w-16 h-16 mx-auto text-red-500 mb-4" />
              <h3
                className="mb-2"
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.h2}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  color: "#ef4444",
                }}
              >
                Applications Currently Closed
              </h3>
              <p className="text-muted-foreground">
                Membership applications are not being accepted at this time. Please check back later.
              </p>
            </div>
          )}
        </>
      )}

      {/* Registration Modal */}
      {showRegistrationModal && (
        <MembershipRegistrationModal
          isOpen={showRegistrationModal}
          onClose={() => setShowRegistrationModal(false)}
          isDark={isDark}
          onSubmit={handleRegistrationSubmit}
        />
      )}

      {/* Create/Edit Opportunity Modal */}
      {showCreateOpportunityModal && (
        <CreateOpportunityModalEnhanced
          isOpen={showCreateOpportunityModal}
          onClose={() => {
            setShowCreateOpportunityModal(false);
            setEditingOpportunity(null);
          }}
          isDark={isDark}
          opportunity={editingOpportunity}
          onSave={(opp) => {
            if (editingOpportunity) {
              // Edit existing
              setOpportunities(
                opportunities.map((o) => (o.id === opp.id ? opp : o))
              );
              toast.success("Opportunity updated");
            } else {
              // Create new
              const newOpp = {
                ...opp,
                id: `OPP-${String(opportunities.length + 1).padStart(3, "0")}`,
              };
              setOpportunities([...opportunities, newOpp]);
              toast.success("Opportunity created");
            }
            setShowCreateOpportunityModal(false);
            setEditingOpportunity(null);
          }}
        />
      )}

      {/* Apply to Opportunity Modal */}
      {showApplyModal && selectedOpportunity && (
        <ApplyToOpportunityModal
          isOpen={showApplyModal}
          onClose={() => setShowApplyModal(false)}
          isDark={isDark}
          opportunity={selectedOpportunity}
          onSubmit={handleRegistrationSubmit}
        />
      )}

      {/* Customize Form Modal */}
      {showCustomizeFormModal && (
        <CustomizeMembershipFormModal
          isOpen={showCustomizeFormModal}
          onClose={() => setShowCustomizeFormModal(false)}
          isDark={isDark}
          fields={membershipFormFields}
          onSave={(fields) => {
            setMembershipFormFields(fields);
            toast.success("Form customized successfully");
            setShowCustomizeFormModal(false);
          }}
          username={username}
        />
      )}
    </PageLayout>
  );
}
