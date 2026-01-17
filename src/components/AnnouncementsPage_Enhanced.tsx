/**
 * =============================================================================
 * ANNOUNCEMENTS PAGE - ENHANCED VERSION
 * =============================================================================
 * 
 * Complete announcement system with:
 * - Title, Subject, Recipient Type, Body
 * - Image uploads (max 5, 5MB each)
 * - Priority and Category
 * - Pin announcements
 * - Mobile-responsive modals
 * 
 * =============================================================================
 */

import { X, Plus, Pin, Edit2, Trash2, Bell, AlertCircle, Upload, Image as ImageIcon } from "lucide-react";
import { useState } from "react";
import { PageLayout, Button, SearchInput, StatusChip, DESIGN_TOKENS } from "./design-system";
import CustomDropdown from "./CustomDropdown";
import { toast } from "sonner";
import { logCreate, logEdit, logDelete } from "../services/gasSystemToolsService";

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: "urgent" | "important" | "normal";
  isPinned: boolean;
  isRead: boolean;
  author: string;
  date: string;
  category: string;
  images?: Array<{ preview: string }>;
}

interface AnnouncementsPageProps {
  onClose: () => void;
  isDark: boolean;
  userRole: string;
  username?: string;
}

export default function AnnouncementsPageEnhanced({
  onClose,
  isDark,
  userRole,
  username = "admin",
}: AnnouncementsPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteQuery, setAutocompleteQuery] = useState("");
  const [viewingAnnouncement, setViewingAnnouncement] = useState<Announcement | null>(null);
  
  const [formData, setFormData] = useState({
    title: "",
    subject: "",
    recipientType: "All" as "All" | "Only Heads" | "Specific Committee" | "Specific Person",
    specificRecipients: "",
    content: "",
    priority: "normal" as "urgent" | "important" | "normal",
    category: "Updates",
    customCategory: "",
    isPinned: false,
  });
  
  const [uploadedImages, setUploadedImages] = useState<Array<{ file: File; preview: string }>>([]);
  
  // Sample member names for autocomplete with profile pictures
  const memberNames = [
    { name: "Juan Dela Cruz", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Juan" },
    { name: "Maria Santos", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Maria" },
    { name: "Pedro Garcia", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Pedro" },
    { name: "Ana Lopez", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ana" },
    { name: "Carlos Reyes", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Carlos" },
    { name: "Sofia Torres", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sofia" },
    { name: "Miguel Fernandez", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Miguel" },
    { name: "Isabella Rodriguez", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Isabella" },
    { name: "Diego Martinez", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Diego" },
    { name: "Gabriela Morales", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Gabriela" },
    { name: "Luis Gonzales", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Luis" },
    { name: "Carmen Ramos", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Carmen" },
    { name: "Jorge Mendoza", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jorge" },
    { name: "Elena Castro", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Elena" },
    { name: "Ricardo Navarro", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ricardo" }
  ];
  
  // Sample committee names for autocomplete
  const committeeNames = [
    "Environmental Conservation",
    "Youth Development",
    "Community Outreach",
    "Education and Scholarship",
    "Health and Wellness",
    "Sports and Recreation",
    "Finance and Resource Mobilization",
    "Communications and Media",
    "Membership and Recruitment"
  ];
  
  const [announcements, setAnnouncements] = useState<Announcement[]>([
    {
      id: "1",
      title: "Community Cleanup Drive - February 20",
      content: "Join us for our monthly community cleanup drive! Meet at Tagum City Hall at 6:00 AM. Bring gloves and enthusiasm!",
      priority: "important",
      isPinned: true,
      isRead: false,
      author: "Admin Team",
      date: "2025-02-10",
      category: "Events",
    },
    {
      id: "2",
      title: "New Member Orientation Schedule",
      content: "New member orientation will be held every Saturday at 2:00 PM. Please bring valid ID and membership form.",
      priority: "normal",
      isPinned: true,
      isRead: true,
      author: "Membership Committee",
      date: "2025-02-08",
      category: "Training",
    },
    {
      id: "3",
      title: "URGENT: Change in Meeting Schedule",
      content: "This week's general assembly has been moved to Thursday, 6:00 PM due to venue conflicts. Please inform your co-members.",
      priority: "urgent",
      isPinned: false,
      isRead: false,
      author: "Admin Team",
      date: "2025-02-15",
      category: "Updates",
    },
    {
      id: "4",
      title: "Scholarship Program Applications Open",
      content: "Applications for our scholarship program are now open! Deadline is March 15. Visit our office for forms.",
      priority: "important",
      isPinned: false,
      isRead: true,
      author: "Education Committee",
      date: "2025-02-05",
      category: "Programs",
    },
  ]);

  const categories = ["all", "Events", "Training", "Updates", "Programs"];

  const filteredAnnouncements = announcements
    .filter((ann) => {
      const matchesSearch =
        ann.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ann.content.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === "all" || ann.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      if (!a.isRead && b.isRead) return -1;
      if (a.isRead && !b.isRead) return 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

  const handleMarkAsRead = (id: string) => {
    setAnnouncements((prev) =>
      prev.map((ann) => (ann.id === id ? { ...ann, isRead: true } : ann))
    );
  };

  const handleTogglePin = (id: string) => {
    if (userRole !== "admin") {
      toast.error("Only admins can pin announcements");
      return;
    }
    setAnnouncements((prev) =>
      prev.map((ann) =>
        ann.id === id ? { ...ann, isPinned: !ann.isPinned } : ann
      )
    );
    toast.success("Announcement pin status updated");
  };

  const handleDelete = (id: string) => {
    if (userRole !== "admin") {
      toast.error("Only admins can delete announcements");
      return;
    }
    const target = announcements.find((ann) => ann.id === id);
    setAnnouncements((prev) => prev.filter((ann) => ann.id !== id));
    toast.success("Announcement deleted");
    logDelete(username, "Announcement", target?.title || id);
  };

  const handleEdit = (announcement: Announcement) => {
    if (userRole !== "admin") {
      toast.error("Only admins can edit announcements");
      return;
    }
    setEditingAnnouncement(announcement);
    setFormData({
      title: announcement.title.split(" - ")[0] || announcement.title,
      subject: announcement.title.split(" - ")[1] || "",
      recipientType: "All",
      specificRecipients: "",
      content: announcement.content,
      priority: announcement.priority,
      category: announcement.category,
      customCategory: "",
      isPinned: announcement.isPinned,
    });
    // Load existing images into the form
    if (announcement.images && announcement.images.length > 0) {
      setUploadedImages(announcement.images.map(img => ({ 
        file: new File([], "existing-image"), 
        preview: img.preview 
      })));
    } else {
      setUploadedImages([]);
    }
    setShowCreateModal(true);
  };

  const handleCreateNew = () => {
    setEditingAnnouncement(null);
    setFormData({
      title: "",
      subject: "",
      recipientType: "All",
      specificRecipients: "",
      content: "",
      priority: "normal",
      category: "Updates",
      customCategory: "",
      isPinned: false,
    });
    setUploadedImages([]);
    setShowCreateModal(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (uploadedImages.length + files.length > 5) {
      toast.error('Maximum 5 images allowed', {
        description: 'You can only upload up to 5 images per announcement'
      });
      return;
    }

    const validFiles: Array<{ file: File; preview: string }> = [];
    
    for (const file of files) {
      if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
        toast.error('Invalid file type', {
          description: `${file.name} is not a .jpg or .png file`
        });
        continue;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error('File too large', {
          description: `${file.name} exceeds 5MB limit`
        });
        continue;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        validFiles.push({ file, preview: reader.result as string });
        if (validFiles.length === files.length || validFiles.length + uploadedImages.length >= 5) {
          setUploadedImages([...uploadedImages, ...validFiles].slice(0, 5));
        }
      };
      reader.readAsDataURL(file);
    }

    e.target.value = '';
  };

  const removeImage = (index: number) => {
    setUploadedImages(uploadedImages.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!formData.subject.trim()) {
      toast.error("Subject is required");
      return;
    }
    if (!formData.content.trim()) {
      toast.error("Body content is required");
      return;
    }
    if ((formData.recipientType === "Specific Committee" || formData.recipientType === "Specific Person") && !formData.specificRecipients.trim()) {
      toast.error("Please specify recipients");
      return;
    }
    if (formData.category === "Other" && !formData.customCategory.trim()) {
      toast.error("Please enter a custom category name");
      return;
    }

    const recipientInfo = formData.recipientType === "All" 
      ? "All Members" 
      : formData.recipientType === "Only Heads"
      ? "All Heads"
      : `${formData.recipientType}: ${formData.specificRecipients}`;

    const finalCategory = formData.category === "Other" ? formData.customCategory : formData.category;

    if (editingAnnouncement) {
      setAnnouncements((prev) =>
        prev.map((ann) =>
          ann.id === editingAnnouncement.id
            ? {
                ...ann,
                title: `${formData.title} - ${formData.subject}`,
                content: formData.content,
                priority: formData.priority,
                category: finalCategory,
                isPinned: formData.isPinned,
                images: uploadedImages.length > 0 ? uploadedImages.map(img => ({ preview: img.preview })) : undefined,
              }
            : ann
        )
      );
      toast.success("Announcement updated successfully");
      logEdit(username, "Announcement", `${formData.title} - ${formData.subject}`);
    } else {
      const newAnnouncement: Announcement = {
        id: `ANN-${Date.now()}`,
        title: `${formData.title} - ${formData.subject}`,
        content: formData.content,
        priority: formData.priority,
        category: finalCategory,
        isPinned: formData.isPinned,
        isRead: false,
        author: "Admin Team",
        date: new Date().toISOString().split("T")[0],
        images: uploadedImages.length > 0 ? uploadedImages.map(img => ({ preview: img.preview })) : undefined,
      };
      setAnnouncements((prev) => [newAnnouncement, ...prev]);
      toast.success("Announcement created successfully");
      logCreate(username, "Announcement", newAnnouncement.title);
    }

    setShowCreateModal(false);
    setEditingAnnouncement(null);
    setUploadedImages([]);
    setFormData({
      title: "",
      subject: "",
      recipientType: "All",
      specificRecipients: "",
      content: "",
      priority: "normal",
      category: "Updates",
      customCategory: "",
      isPinned: false,
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return DESIGN_TOKENS.colors.status.error;
      case "important":
        return DESIGN_TOKENS.colors.brand.orange;
      default:
        return DESIGN_TOKENS.colors.status.success;
    }
  };

  return (
    <PageLayout
      title="Announcements"
      subtitle="Stay updated with the latest news and information"
      isDark={isDark}
      onClose={onClose}
      breadcrumbs={[
        { label: "Home", onClick: onClose },
        { label: "Communication Center", onClick: undefined },
        { label: "Announcements", onClick: undefined },
      ]}
    >
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search announcements..."
            isDark={isDark}
          />
        </div>
        {userRole === "admin" && (
          <Button
            variant="primary"
            size="md"
            onClick={handleCreateNew}
            icon={<Plus className="w-4 h-4" />}
          >
            New Announcement
          </Button>
        )}
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap ${
              selectedCategory === cat
                ? "bg-[#f6421f] text-white"
                : "bg-white/50 dark:bg-white/5 hover:bg-white/70 dark:hover:bg-white/10"
            }`}
            style={{
              fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
              fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
              transitionDuration: `${DESIGN_TOKENS.motion.duration.fast}ms`,
            }}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {/* Announcements List */}
      <div className="space-y-4">
        {filteredAnnouncements.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p
              style={{
                fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                color: isDark ? "#9ca3af" : "#6b7280",
              }}
            >
              No announcements found
            </p>
          </div>
        ) : (
          filteredAnnouncements.map((announcement) => (
            <div
              key={announcement.id}
              onClick={() => {
                setViewingAnnouncement(announcement);
                if (!announcement.isRead) {
                  handleMarkAsRead(announcement.id);
                }
              }}
              className={`p-6 rounded-xl border-2 transition-all cursor-pointer hover:scale-[1.01] ${
                !announcement.isRead
                  ? "border-[#f6421f]/50 bg-[#f6421f]/10"
                  : isDark
                  ? "border-white/40 bg-white/10"
                  : "border-gray-400 bg-white"
              }`}
              style={{
                boxShadow: isDark
                  ? "0 4px 16px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2)"
                  : "0 4px 16px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.1)",
              }}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {announcement.isPinned && (
                      <Pin className="w-4 h-4 text-[#f6421f]" />
                    )}
                    {!announcement.isRead && (
                      <span className="w-2 h-2 bg-[#f6421f] rounded-full" />
                    )}
                    <h3
                      style={{
                        fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                        fontSize: `${DESIGN_TOKENS.typography.fontSize.h4}px`,
                        fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                        color: isDark ? "#ffffff" : "#000000",
                      }}
                    >
                      {announcement.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusChip
                      status={announcement.priority}
                      label={announcement.priority.toUpperCase()}
                      customColor={getPriorityColor(announcement.priority)}
                    />
                    <span
                      className="px-2 py-1 rounded-lg"
                      style={{
                        backgroundColor: isDark
                          ? "rgba(255, 255, 255, 0.1)"
                          : "rgba(0, 0, 0, 0.05)",
                        fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                        fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                        color: isDark ? "#ffffff" : "#000000",
                      }}
                    >
                      {announcement.category}
                    </span>
                  </div>
                </div>
                {userRole === "admin" && (
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePin(announcement.id);
                      }}
                      className={`p-2 rounded-lg transition-all ${
                        announcement.isPinned
                          ? "bg-[#f6421f] text-white"
                          : "hover:bg-white/50 dark:hover:bg-white/10"
                      }`}
                      aria-label="Toggle pin"
                    >
                      <Pin className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(announcement);
                      }}
                      className="p-2 rounded-lg hover:bg-white/50 dark:hover:bg-white/10 transition-all"
                      aria-label="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(announcement.id);
                      }}
                      className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 transition-all"
                      aria-label="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Content */}
              <p
                className="mb-4 whitespace-pre-line"
                style={{
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                  lineHeight: 1.6,
                }}
              >
                {announcement.content}
              </p>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-black/5 dark:border-white/5">
                <div
                  style={{
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                    color: isDark ? "#9ca3af" : "#6b7280",
                  }}
                >
                  By {announcement.author} • {announcement.date}
                </div>
                {!announcement.isRead && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleMarkAsRead(announcement.id)}
                  >
                    Mark as Read
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Modal - MOBILE RESPONSIVE */}
      {showCreateModal && (
        <div 
          className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-2 sm:p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border p-4 sm:p-8 my-4 sm:my-8 max-h-[95vh] flex flex-col"
            style={{
              background: isDark
                ? "rgba(17, 24, 39, 0.98)"
                : "rgba(255, 255, 255, 0.98)",
              backdropFilter: "blur(20px)",
              borderColor: isDark
                ? "rgba(255, 255, 255, 0.1)"
                : "rgba(0, 0, 0, 0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header - Fixed */}
            <div className="flex items-center justify-between mb-4 sm:mb-6 flex-shrink-0">
              <h2
                className="text-lg sm:text-2xl"
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  color: DESIGN_TOKENS.colors.brand.red,
                }}
              >
                {editingAnnouncement ? "Edit Announcement" : "Create Announcement"}
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 rounded-lg hover:bg-white/50 dark:hover:bg-white/10 transition-all flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form - Scrollable */}
            <div className="space-y-4 overflow-y-auto pr-2 flex-1" style={{ minHeight: 0 }}>
              {/* Title */}
              <div>
                <label
                  className="block mb-2 text-sm"
                  style={{
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    color: isDark ? "#9ca3af" : "#6b7280",
                  }}
                >
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., General Assembly"
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 rounded-xl border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20 transition-all outline-none text-sm sm:text-base"
                  style={{
                    borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
                  }}
                />
              </div>

              {/* Subject */}
              <div>
                <label
                  className="block mb-2 text-sm"
                  style={{
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    color: isDark ? "#9ca3af" : "#6b7280",
                  }}
                >
                  Subject <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="e.g., Reminder about upcoming event"
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 rounded-xl border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20 transition-all outline-none text-sm sm:text-base"
                  style={{
                    borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
                  }}
                />
              </div>

              {/* Recipient Type */}
              <div>
                <label
                  className="block mb-2 text-sm"
                  style={{
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    color: isDark ? "#9ca3af" : "#6b7280",
                  }}
                >
                  Recipient Type <span className="text-red-500">*</span>
                </label>
                <CustomDropdown
                  value={formData.recipientType}
                  onChange={(value) => setFormData({ ...formData, recipientType: value as typeof formData.recipientType, specificRecipients: "" })}
                  options={[
                    "All",
                    "Only Heads",
                    "Specific Committee",
                    "Specific Person"
                  ]}
                  isDark={isDark}
                  size="md"
                />
              </div>

              {/* Specific Recipients (conditional) */}
              {(formData.recipientType === "Specific Committee" || formData.recipientType === "Specific Person") && (
                <div className="relative">
                  <label
                    className="block mb-2 text-sm"
                    style={{
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                      color: isDark ? "#9ca3af" : "#6b7280",
                    }}
                  >
                    {formData.recipientType === "Specific Committee" ? "Committee Name" : "Person Names (comma-separated)"} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.specificRecipients}
                      onChange={(e) => {
                        setFormData({ ...formData, specificRecipients: e.target.value });
                        const lastWord = e.target.value.split(',').pop()?.trim() || '';
                        setAutocompleteQuery(lastWord);
                        setShowAutocomplete(lastWord.length > 0);
                      }}
                      onFocus={() => {
                        const lastWord = formData.specificRecipients.split(',').pop()?.trim() || '';
                        setAutocompleteQuery(lastWord);
                        setShowAutocomplete(lastWord.length > 0);
                      }}
                      onBlur={() => setTimeout(() => setShowAutocomplete(false), 200)}
                      placeholder={formData.recipientType === "Specific Committee" ? "Start typing a committee name..." : "Start typing a name..."}
                      className="w-full px-3 sm:px-4 py-2 sm:py-3 rounded-xl border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20 transition-all outline-none text-sm sm:text-base"
                      style={{
                        borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
                      }}
                    />
                    
                    {/* Autocomplete Dropdown - For Person */}
                    {showAutocomplete && formData.recipientType === "Specific Person" && (
                      <div
                        className="absolute z-50 w-full mt-2 rounded-xl border-2 overflow-hidden max-h-48 overflow-y-auto"
                        style={{
                          background: isDark ? "rgba(17, 24, 39, 0.98)" : "rgba(255, 255, 255, 0.98)",
                          backdropFilter: "blur(20px)",
                          borderColor: isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)",
                          boxShadow: isDark
                            ? "0 8px 24px rgba(0, 0, 0, 0.5)"
                            : "0 8px 24px rgba(0, 0, 0, 0.15)",
                        }}
                      >
                        {memberNames
                          .filter((member) =>
                            member.name.toLowerCase().includes(autocompleteQuery.toLowerCase())
                          )
                          .map((member, index) => (
                            <button
                              key={index}
                              type="button"
                              onClick={() => {
                                const currentNames = formData.specificRecipients.split(',').map(n => n.trim()).filter(n => n);
                                currentNames.pop(); // Remove last partial name
                                currentNames.push(member.name);
                                const newValue = currentNames.join(', ');
                                setFormData({ ...formData, specificRecipients: newValue });
                                setShowAutocomplete(false);
                              }}
                              className="w-full px-4 py-2.5 text-left hover:bg-[#f6421f]/10 transition-colors border-b last:border-b-0 flex items-center gap-3"
                              style={{
                                fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                                color: isDark ? "#ffffff" : "#000000",
                                borderColor: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)",
                              }}
                            >
                              <img
                                src={member.avatar}
                                alt={member.name}
                                className="w-8 h-8 rounded-full border-2 border-white/20"
                              />
                              <span>{member.name}</span>
                            </button>
                          ))}
                        {memberNames.filter((member) =>
                          member.name.toLowerCase().includes(autocompleteQuery.toLowerCase())
                        ).length === 0 && (
                          <div
                            className="px-4 py-3 text-center"
                            style={{
                              fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                              color: isDark ? "#9ca3af" : "#6b7280",
                            }}
                          >
                            No matching names found
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Autocomplete Dropdown - For Committee */}
                    {showAutocomplete && formData.recipientType === "Specific Committee" && (
                      <div
                        className="absolute z-50 w-full mt-2 rounded-xl border-2 overflow-hidden max-h-48 overflow-y-auto"
                        style={{
                          background: isDark ? "rgba(17, 24, 39, 0.98)" : "rgba(255, 255, 255, 0.98)",
                          backdropFilter: "blur(20px)",
                          borderColor: isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)",
                          boxShadow: isDark
                            ? "0 8px 24px rgba(0, 0, 0, 0.5)"
                            : "0 8px 24px rgba(0, 0, 0, 0.15)",
                        }}
                      >
                        {committeeNames
                          .filter((committee) =>
                            committee.toLowerCase().includes(autocompleteQuery.toLowerCase())
                          )
                          .map((committee, index) => (
                            <button
                              key={index}
                              type="button"
                              onClick={() => {
                                const currentCommittees = formData.specificRecipients.split(',').map(n => n.trim()).filter(n => n);
                                currentCommittees.pop(); // Remove last partial name
                                currentCommittees.push(committee);
                                const newValue = currentCommittees.join(', ');
                                setFormData({ ...formData, specificRecipients: newValue });
                                setShowAutocomplete(false);
                              }}
                              className="w-full px-4 py-2.5 text-left hover:bg-[#f6421f]/10 transition-colors border-b last:border-b-0"
                              style={{
                                fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                                color: isDark ? "#ffffff" : "#000000",
                                borderColor: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)",
                              }}
                            >
                              {committee}
                            </button>
                          ))}
                        {committeeNames.filter((committee) =>
                          committee.toLowerCase().includes(autocompleteQuery.toLowerCase())
                        ).length === 0 && (
                          <div
                            className="px-4 py-3 text-center"
                            style={{
                              fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                              color: isDark ? "#9ca3af" : "#6b7280",
                            }}
                          >
                            No matching committees found
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Body Content */}
              <div>
                <label
                  className="block mb-2 text-sm"
                  style={{
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    color: isDark ? "#9ca3af" : "#6b7280",
                  }}
                >
                  Body <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Enter the main announcement content..."
                  rows={4}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 rounded-xl border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20 transition-all outline-none resize-none text-sm sm:text-base"
                  style={{
                    borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
                  }}
                />
              </div>

              {/* Priority and Category - Responsive Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Priority */}
                <div>
                  <label
                    className="block mb-2 text-sm"
                    style={{
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                      color: isDark ? "#9ca3af" : "#6b7280",
                    }}
                  >
                    Priority
                  </label>
                  <CustomDropdown
                    value={formData.priority}
                    onChange={(value) => setFormData({ ...formData, priority: value as typeof formData.priority })}
                    options={[
                      { value: "normal", label: "Normal" },
                      { value: "important", label: "Important" },
                      { value: "urgent", label: "Urgent" }
                    ]}
                    isDark={isDark}
                    size="md"
                  />
                </div>

                {/* Category */}
                <div>
                  <label
                    className="block mb-2 text-sm"
                    style={{
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                      color: isDark ? "#9ca3af" : "#6b7280",
                    }}
                  >
                    Category
                  </label>
                  <CustomDropdown
                    value={formData.category}
                    onChange={(value) => setFormData({ ...formData, category: value, customCategory: value === "Other" ? formData.customCategory : "" })}
                    options={["Events", "Training", "Updates", "Programs", "Other"]}
                    isDark={isDark}
                    size="md"
                  />
                </div>
              </div>

              {/* Custom Category Field (conditional) */}
              {formData.category === "Other" && (
                <div>
                  <label
                    className="block mb-2 text-sm"
                    style={{
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                      color: isDark ? "#9ca3af" : "#6b7280",
                    }}
                  >
                    Custom Category <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.customCategory}
                    onChange={(e) => setFormData({ ...formData, customCategory: e.target.value })}
                    placeholder="Enter custom category name..."
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 rounded-xl border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20 transition-all outline-none text-sm sm:text-base"
                    style={{
                      borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
                    }}
                  />
                </div>
              )}

              {/* Image Upload */}
              <div>
                <label
                  className="block mb-2 text-sm"
                  style={{
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    color: isDark ? "#9ca3af" : "#6b7280",
                  }}
                >
                  Images (Max 5, 5MB each)
                </label>
                
                {uploadedImages.length < 5 && (
                  <label
                    htmlFor="imageUpload"
                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer hover:border-[#f6421f] transition-colors"
                    style={{
                      borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
                      backgroundColor: isDark ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0.02)",
                    }}
                  >
                    <Upload className="w-8 h-8 mb-2 text-gray-400" />
                    <p className="text-sm text-gray-500">Click to upload images</p>
                    <p className="text-xs text-gray-400 mt-1">PNG or JPG, max 5MB each</p>
                    <input
                      id="imageUpload"
                      type="file"
                      accept="image/png,image/jpeg,image/jpg"
                      multiple
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                )}

                {/* Image Previews */}
                {uploadedImages.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-3">
                    {uploadedImages.map((img, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={img.preview}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-20 object-cover rounded-lg border-2"
                          style={{
                            borderColor: DESIGN_TOKENS.colors.brand.orange,
                          }}
                        />
                        <button
                          onClick={() => removeImage(index)}
                          className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pin Announcement */}
              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="isPinned"
                  checked={formData.isPinned}
                  onChange={(e) => setFormData({ ...formData, isPinned: e.target.checked })}
                  className="w-5 h-5 rounded border-2 border-gray-300 dark:border-gray-600 text-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20"
                />
                <label
                  htmlFor="isPinned"
                  className="cursor-pointer text-sm sm:text-base"
                  style={{
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                  }}
                >
                  <Pin className="w-4 h-4 inline mr-2" />
                  Pin this announcement to the top
                </label>
              </div>
            </div>

            {/* Actions - Fixed Bottom */}
            <div className="flex gap-3 mt-4 sm:mt-6 pt-4 border-t flex-shrink-0" style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}>
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 sm:py-3 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm sm:text-base"
                style={{
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 px-4 py-2 sm:py-3 rounded-xl text-white transition-colors text-sm sm:text-base"
                style={{
                  background: "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)",
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                }}
              >
                {editingAnnouncement ? "Save Changes" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Announcement Modal */}
      {viewingAnnouncement && (
        <div 
          className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-2 sm:p-4"
          onClick={() => setViewingAnnouncement(null)}
        >
          <div
            className="w-full max-w-3xl rounded-2xl border-2 p-6 sm:p-8 my-4 sm:my-8 max-h-[95vh] flex flex-col"
            style={{
              background: isDark
                ? "rgba(17, 24, 39, 0.98)"
                : "rgba(255, 255, 255, 0.98)",
              backdropFilter: "blur(20px)",
              borderColor: isDark
                ? "rgba(255, 255, 255, 0.2)"
                : "rgba(0, 0, 0, 0.2)",
              boxShadow: isDark
                ? "0 8px 32px rgba(0, 0, 0, 0.6)"
                : "0 8px 32px rgba(0, 0, 0, 0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-6 flex-shrink-0">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  {viewingAnnouncement.isPinned && (
                    <Pin className="w-5 h-5 text-[#f6421f]" />
                  )}
                  <h2
                    style={{
                      fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                      fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
                      color: isDark ? "#ffffff" : "#000000",
                    }}
                  >
                    {viewingAnnouncement.title}
                  </h2>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusChip
                    status={viewingAnnouncement.priority}
                    label={viewingAnnouncement.priority.toUpperCase()}
                    customColor={getPriorityColor(viewingAnnouncement.priority)}
                  />
                  <span
                    className="px-3 py-1.5 rounded-lg"
                    style={{
                      backgroundColor: isDark
                        ? "rgba(255, 255, 255, 0.15)"
                        : "rgba(0, 0, 0, 0.08)",
                      fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                      color: isDark ? "#ffffff" : "#000000",
                    }}
                  >
                    {viewingAnnouncement.category}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setViewingAnnouncement(null)}
                className="p-2 rounded-lg hover:bg-white/50 dark:hover:bg-white/10 transition-all flex-shrink-0"
                style={{
                  color: isDark ? "#ffffff" : "#000000",
                }}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto pr-2" style={{ minHeight: 0 }}>
              <p
                className="whitespace-pre-line mb-6"
                style={{
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                  lineHeight: 1.7,
                  color: isDark ? "#e5e7eb" : "#374151",
                }}
              >
                {viewingAnnouncement.content}
              </p>

              {/* Images Gallery */}
              {viewingAnnouncement.images && viewingAnnouncement.images.length > 0 && (
                <div className="mb-6">
                  <h3
                    className="mb-3"
                    style={{
                      fontSize: `${DESIGN_TOKENS.typography.fontSize.h5}px`,
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                      color: isDark ? "#ffffff" : "#000000",
                    }}
                  >
                    Attached Images
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {viewingAnnouncement.images.map((img, index) => (
                      <img
                        key={index}
                        src={img.preview}
                        alt={`Attachment ${index + 1}`}
                        className="w-full h-32 sm:h-40 object-cover rounded-lg border-2 cursor-pointer hover:opacity-80 transition-opacity"
                        style={{
                          borderColor: isDark
                            ? "rgba(255, 255, 255, 0.2)"
                            : "rgba(0, 0, 0, 0.2)",
                        }}
                        onClick={() => window.open(img.preview, '_blank')}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div
                className="pt-6 border-t"
                style={{
                  borderColor: isDark
                    ? "rgba(255, 255, 255, 0.1)"
                    : "rgba(0, 0, 0, 0.1)",
                }}
              >
                <div className="flex items-center gap-4 text-sm">
                  <div
                    style={{
                      fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                      color: isDark ? "#9ca3af" : "#6b7280",
                    }}
                  >
                    <span style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                      Posted by:
                    </span>{" "}
                    {viewingAnnouncement.author}
                  </div>
                  <div
                    style={{
                      fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                      color: isDark ? "#9ca3af" : "#6b7280",
                    }}
                  >
                    <span style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                      Date:
                    </span>{" "}
                    {viewingAnnouncement.date}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6 pt-6 border-t flex-shrink-0" style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}>
              <button
                onClick={() => setViewingAnnouncement(null)}
                className="flex-1 px-6 py-3 rounded-xl text-white transition-all"
                style={{
                  background: "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)",
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
