/**
 * =============================================================================
 * MANAGE MEMBERS MODALS
 * =============================================================================
 * 
 * Modals for Add, Edit, and View Member functionality
 * 
 * =============================================================================
 */

import { useState } from "react";
import { X, Save, Edit, Loader2 } from "lucide-react";
import { DESIGN_TOKENS } from "./design-system";
import CustomDropdown from "./CustomDropdown";
import { type UploadToastMessage } from "./UploadToast";

interface Member {
  id?: string;
  name: string;
  position: string;
  role: string;
  committee: string;
  status: "Active" | "Inactive" | "Suspended";
  email: string;
  phone: string;
  dateJoined?: string;
  address?: string;
  dateOfBirth?: string;
  age?: number;
  gender?: string;
  civilStatus?: string;
  nationality?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  bloodType?: string;
  medicalConditions?: string;
  profilePicture?: string;
}

// ADD MEMBER MODAL
interface AddMemberModalProps {
  isDark: boolean;
  onClose: () => void;
  onSave: (member: Member) => void;
}

export function AddMemberModal({ isDark, onClose, onSave }: AddMemberModalProps) {
  const [formData, setFormData] = useState<Member>({
    name: "",
    position: "",
    role: "Member",
    committee: "Youth Development",
    status: "Active",
    email: "",
    phone: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      style={{ zIndex: 'var(--z-modal, 230)' }}
      onClick={onClose}
    >
      <div
        className="rounded-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto border"
        style={{
          background: isDark ? 'rgba(17, 24, 39, 0.98)' : 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(20px)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3
            style={{
              fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
              fontSize: `${DESIGN_TOKENS.typography.fontSize.h2}px`,
              fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
              color: DESIGN_TOKENS.colors.brand.red,
            }}
          >
            Add New Member
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}>
                Full Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20 transition-all outline-none"
                style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
              />
            </div>

            <div>
              <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}>
                Position *
              </label>
              <CustomDropdown
                value={formData.position}
                onChange={(value) => setFormData({ ...formData, position: value })}
                options={[
                  { value: "Tagum Chapter President", label: "Tagum Chapter President" },
                  { value: "Membership and Internal Affairs Officer", label: "Membership and Internal Affairs Officer" },
                  { value: "External Relations Officer", label: "External Relations Officer" },
                  { value: "Secretariat and Documentation Officer", label: "Secretariat and Documentation Officer" },
                  { value: "Finance and Treasury Officer", label: "Finance and Treasury Officer" },
                  { value: "Program Development Officer", label: "Program Development Officer" },
                  { value: "Communications and Marketing Officer", label: "Communications and Marketing Officer" },
                  { value: "Committee Member", label: "Committee Member" },
                  { value: "Member", label: "Member" },
                  { value: "Volunteer", label: "Volunteer" },
                ]}
                isDark={isDark}
                size="md"
              />
            </div>

            <div>
              <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}>
                Role *
              </label>
              <CustomDropdown
                value={formData.role}
                onChange={(value) => setFormData({ ...formData, role: value })}
                options={[
                  { value: "Auditor", label: "Auditor" },
                  { value: "Admin", label: "Admin" },
                  { value: "Head", label: "Head" },
                  { value: "Member", label: "Member" },
                  { value: "Guest", label: "Guest" },
                  { value: "Suspended", label: "Suspended" },
                  { value: "Banned", label: "Banned" },
                ]}
                isDark={isDark}
                size="md"
              />
            </div>

            <div>
              <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}>
                Committee *
              </label>
              <CustomDropdown
                value={formData.committee}
                onChange={(value) => setFormData({ ...formData, committee: value })}
                options={[
                  { value: "Executive Board", label: "Executive Board" },
                  { value: "Membership and Internal Affairs Committee", label: "Membership and Internal Affairs Committee" },
                  { value: "External Relations Committee", label: "External Relations Committee" },
                  { value: "Secretariat and Documentation Committee", label: "Secretariat and Documentation Committee" },
                  { value: "Finance and Treasury Committee", label: "Finance and Treasury Committee" },
                  { value: "Program Development Committee", label: "Program Development Committee" },
                  { value: "Communications and Marketing Committee", label: "Communications and Marketing Committee" },
                  { value: "None", label: "None" },
                ]}
                isDark={isDark}
                size="md"
              />
            </div>

            <div>
              <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}>
                Email *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20 transition-all outline-none"
                style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
              />
            </div>

            <div>
              <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}>
                Phone *
              </label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20 transition-all outline-none"
                style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
              />
            </div>

            <div>
              <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}>
                Status *
              </label>
              <CustomDropdown
                value={formData.status}
                onChange={(value) => setFormData({ ...formData, status: value as "Active" | "Inactive" | "Suspended" })}
                options={[
                  { value: "Active", label: "Active" },
                  { value: "Inactive", label: "Inactive" },
                  { value: "Suspended", label: "Suspended" },
                ]}
                isDark={isDark}
                size="md"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
              style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 rounded-lg bg-gradient-to-r from-[#f6421f] to-[#ee8724] text-white hover:shadow-lg transition-all flex items-center gap-2"
              style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}
            >
              <Save className="w-4 h-4" />
              Add Member
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Default no-op toast functions
const defaultAddToast = (_message: UploadToastMessage) => {};
const defaultUpdateToast = (_id: string, _updates: Partial<UploadToastMessage>) => {};

// EDIT MEMBER MODAL
interface EditMemberModalProps {
  isDark: boolean;
  member: Member;
  onClose: () => void;
  onSave: (member: Member) => void;
  addUploadToast?: (message: UploadToastMessage) => void;
  updateUploadToast?: (id: string, updates: Partial<UploadToastMessage>) => void;
}

export function EditMemberModal({ 
  isDark, 
  member, 
  onClose, 
  onSave,
  addUploadToast = defaultAddToast,
  updateUploadToast = defaultUpdateToast,
}: EditMemberModalProps) {
  const [formData, setFormData] = useState<Member>(member);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const toastId = `update-member-${Date.now()}`;
    setIsSaving(true);
    
    // Start the progress toast
    addUploadToast({
      id: toastId,
      title: 'Updating Member',
      message: 'Preparing changes...',
      status: 'loading',
      progress: 0,
    });
    
    try {
      updateUploadToast(toastId, { progress: 30, message: 'Syncing to backend...' });
      
      // Simulate a small delay for backend sync (in real implementation, this would be the actual API call)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      updateUploadToast(toastId, { progress: 70, message: 'Saving to database...' });
      
      // Call the parent's onSave (which handles the actual backend call)
      onSave(formData);
      
      updateUploadToast(toastId, {
        status: 'success',
        progress: 100,
        title: 'Update Complete!',
        message: `${formData.name}'s profile updated successfully`,
      });
    } catch (error) {
      updateUploadToast(toastId, {
        status: 'error',
        progress: 100,
        title: 'Update Failed',
        message: error instanceof Error ? error.message : 'Failed to update member',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      style={{ zIndex: 'var(--z-modal, 230)' }}
      onClick={onClose}
    >
      <div
        className="rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col border"
        style={{
          background: isDark ? 'rgba(17, 24, 39, 0.98)' : 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(20px)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header */}
        <div
          className="flex items-center justify-between p-6 border-b flex-shrink-0"
          style={{
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          }}
        >
          <h3
            style={{
              fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
              fontSize: `${DESIGN_TOKENS.typography.fontSize.h2}px`,
              fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
              color: DESIGN_TOKENS.colors.brand.red,
            }}
          >
            Edit Member: {member.name}
          </h3>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable Content - with contained overflow for dropdowns */}
        <form 
          id="edit-member-form" 
          onSubmit={handleSubmit} 
          className="p-6 overflow-y-auto overflow-x-hidden flex-1"
          style={{
            // Ensure dropdowns stay within this boundary
            contain: 'paint',
          }}
        >
          <div className="grid md:grid-cols-2 gap-6">
            <div className="relative">
              <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}>
                Full Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20 transition-all outline-none"
                style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
                disabled={isSaving}
              />
            </div>

            <div className="relative">
              <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}>
                Position *
              </label>
              <CustomDropdown
                value={formData.position}
                onChange={(value) => setFormData({ ...formData, position: value })}
                options={[
                  { value: "Tagum Chapter President", label: "Tagum Chapter President" },
                  { value: "Membership and Internal Affairs Officer", label: "Membership and Internal Affairs Officer" },
                  { value: "External Relations Officer", label: "External Relations Officer" },
                  { value: "Secretariat and Documentation Officer", label: "Secretariat and Documentation Officer" },
                  { value: "Finance and Treasury Officer", label: "Finance and Treasury Officer" },
                  { value: "Program Development Officer", label: "Program Development Officer" },
                  { value: "Communications and Marketing Officer", label: "Communications and Marketing Officer" },
                  { value: "Committee Member", label: "Committee Member" },
                  { value: "Member", label: "Member" },
                  { value: "Volunteer", label: "Volunteer" },
                ]}
                isDark={isDark}
                size="md"
              />
            </div>

            <div className="relative">
              <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}>
                Role *
              </label>
              <CustomDropdown
                value={formData.role}
                onChange={(value) => setFormData({ ...formData, role: value })}
                options={[
                  { value: "Auditor", label: "Auditor" },
                  { value: "Admin", label: "Admin" },
                  { value: "Head", label: "Head" },
                  { value: "Member", label: "Member" },
                  { value: "Guest", label: "Guest" },
                  { value: "Suspended", label: "Suspended" },
                  { value: "Banned", label: "Banned" },
                ]}
                isDark={isDark}
                size="md"
              />
            </div>

            <div className="relative">
              <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}>
                Committee *
              </label>
              <CustomDropdown
                value={formData.committee}
                onChange={(value) => setFormData({ ...formData, committee: value })}
                options={[
                  { value: "Executive Board", label: "Executive Board" },
                  { value: "Membership and Internal Affairs Committee", label: "Membership and Internal Affairs Committee" },
                  { value: "External Relations Committee", label: "External Relations Committee" },
                  { value: "Secretariat and Documentation Committee", label: "Secretariat and Documentation Committee" },
                  { value: "Finance and Treasury Committee", label: "Finance and Treasury Committee" },
                  { value: "Program Development Committee", label: "Program Development Committee" },
                  { value: "Communications and Marketing Committee", label: "Communications and Marketing Committee" },
                  { value: "None", label: "None" },
                ]}
                isDark={isDark}
                size="md"
              />
            </div>

            <div className="relative">
              <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}>
                Status *
              </label>
              <CustomDropdown
                value={formData.status}
                onChange={(value) => setFormData({ ...formData, status: value as "Active" | "Inactive" | "Suspended" })}
                options={[
                  { value: "Active", label: "Active" },
                  { value: "Inactive", label: "Inactive" },
                  { value: "Suspended", label: "Suspended" },
                ]}
                isDark={isDark}
                size="md"
                forceDirection="up"
              />
            </div>
          </div>
          {/* Spacer to ensure dropdowns have room */}
          <div className="h-4" />
        </form>

        {/* Sticky Footer with Action Buttons */}
        <div
          className="p-6 border-t flex-shrink-0"
          style={{
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          }}
        >
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-6 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-all disabled:opacity-50"
              style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-member-form"
              disabled={isSaving}
              className="px-6 py-2 rounded-lg bg-gradient-to-r from-[#f6421f] to-[#ee8724] text-white hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
              style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// VIEW MEMBER MODAL
interface ViewMemberModalProps {
  isDark: boolean;
  member: Member;
  onClose: () => void;
  onEdit: () => void;
}

export function ViewMemberModal({ isDark, member, onClose, onEdit }: ViewMemberModalProps) {

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      style={{ zIndex: 'var(--z-modal, 230)' }}
      onClick={onClose}
    >
      <div
        className="rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto border"
        style={{
          background: isDark ? 'rgba(17, 24, 39, 0.98)' : 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(20px)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3
            style={{
              fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
              fontSize: `${DESIGN_TOKENS.typography.fontSize.h2}px`,
              fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
              color: DESIGN_TOKENS.colors.brand.red,
            }}
          >
            Member Details
          </h3>
          <div className="flex gap-2">
            <button
              onClick={onEdit}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#f6421f] to-[#ee8724] text-white hover:shadow-lg transition-all flex items-center gap-2"
              style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Profile Header */}
        <div className="flex gap-6 mb-6 pb-6 border-b" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
          <div
            className="rounded-full flex items-center justify-center bg-gradient-to-br from-[#f6421f] to-[#ee8724] text-white overflow-hidden"
            style={{
              width: '100px',
              height: '100px',
              fontSize: '40px',
              fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
              border: '3px solid #ee8724',
            }}
          >
            {member.profilePicture ? (
              <img
                src={member.profilePicture}
                alt={member.name}
                className="w-full h-full object-cover"
                style={{ borderRadius: '9999px' }}
              />
            ) : (
              member.name.charAt(0)
            )}
          </div>
          <div className="flex-1">
            <h2
              className="mb-2"
              style={{
                fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                fontSize: '28px',
                fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
                color: DESIGN_TOKENS.colors.brand.red,
              }}
            >
              {member.name}
            </h2>
            <p className="text-muted-foreground mb-1">{member.position}</p>
            <div className="flex gap-2">
              <span
                className="px-3 py-1 rounded-full text-xs"
                style={{
                  backgroundColor: member.role === "Admin" ? "#f6421f20" : member.role === "Officer" ? "#ee872420" : "#10b98120",
                  color: member.role === "Admin" ? "#f6421f" : member.role === "Officer" ? "#ee8724" : "#10b981",
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                }}
              >
                {member.role}
              </span>
              <span
                className="px-3 py-1 rounded-full text-xs"
                style={{
                  backgroundColor: member.status === "Active" ? "#10b98120" : "#6b728020",
                  color: member.status === "Active" ? "#10b981" : "#6b7280",
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                }}
              >
                {member.status}
              </span>
            </div>
          </div>
        </div>

        {/* Information Grid */}
        <div className="grid md:grid-cols-2 gap-4">
          <InfoField label="Member ID" value={member.id || "N/A"} isDark={isDark} />
          <InfoField label="Email" value={member.email} isDark={isDark} />
          <InfoField label="Phone" value={member.phone} isDark={isDark} />
          <InfoField label="Committee" value={member.committee} isDark={isDark} />
          <InfoField label="Date Joined" value={member.dateJoined ? new Date(member.dateJoined).toLocaleDateString() : "N/A"} isDark={isDark} />
          <InfoField label="Gender" value={member.gender || "N/A"} isDark={isDark} />
          <InfoField label="Civil Status" value={member.civilStatus || "N/A"} isDark={isDark} />
          <InfoField label="Nationality" value={member.nationality || "N/A"} isDark={isDark} />
          {member.address && <InfoField label="Address" value={member.address} isDark={isDark} className="md:col-span-2" />}
          {member.emergencyContact && <InfoField label="Emergency Contact" value={member.emergencyContact} isDark={isDark} />}
          {member.emergencyPhone && <InfoField label="Emergency Phone" value={member.emergencyPhone} isDark={isDark} />}
          {member.bloodType && <InfoField label="Blood Type" value={member.bloodType} isDark={isDark} />}
          {member.medicalConditions && <InfoField label="Medical Conditions" value={member.medicalConditions} isDark={isDark} className="md:col-span-2" />}
        </div>
      </div>
    </div>
  );
}

// Helper Component
interface InfoFieldProps {
  label: string;
  value: string;
  isDark: boolean;
  className?: string;
}

function InfoField({ label, value, isDark, className = "" }: InfoFieldProps) {
  return (
    <div
      className={`rounded-lg p-4 border ${className}`}
      style={{
        background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      }}
    >
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}>
        {value}
      </p>
    </div>
  );
}