/**
 * =============================================================================
 * ANNOUNCEMENTS PAGE
 * =============================================================================
 * 
 * Communication center for organization-wide announcements
 * Features:
 * - View all announcements with filters
 * - Admin can create/edit/delete announcements
 * - Priority levels (urgent, important, normal)
 * - Read/unread status
 * - Pin important announcements
 * - Clickable cards with detail modal
 * - Image upload with preview
 * - Autocomplete for person names
 * - Custom category option
 * 
 * Uses Design System Components
 * =============================================================================
 */

import { X, Plus, Pin, Edit2, Trash2, Bell, AlertCircle, Upload, Image as ImageIcon } from "lucide-react";
import { useState, useRef } from "react";
import { PageLayout, Button, SearchInput, StatusChip, DESIGN_TOKENS } from "./design-system";
import CustomDropdown from "./CustomDropdown";
import { toast } from "sonner";

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
  images?: string[];
}

interface AnnouncementsPageProps {
  onClose: () => void;
  isDark: boolean;
  userRole: string;
}

export default function AnnouncementsPage({
  onClose,
  isDark,
  userRole,
}: AnnouncementsPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    subject: "",
    recipientType: "All Members" as string,
    specificRecipients: "",
    content: "",
    priority: "normal" as "urgent" | "important" | "normal",
    category: "Events",
    customCategory: "",
    isPinned: false,
  });
  const [uploadedImages, setUploadedImages] = useState<Array<{ file: File; preview: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
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

  // Sample person names for autocomplete
  const allPersonNames = [
    "Juan Dela Cruz",
    "Maria Santos",
    "Pedro Garcia",
    "Ana Lopez",
    "Carlos Reyes",
    "Sofia Martinez",
    "Miguel Torres",
    "Isabella Ramos",
  ];

  const categories = ["all", "Events", "Training", "Updates", "Programs", "Other"];
  const recipientTypes = [
    "All Members",
    "Only Heads",
    "Specific Committee",
    "Specific Person",
  ];

  const filteredPersonNames = allPersonNames.filter((name) =>
    name.toLowerCase().includes(formData.specificRecipients.toLowerCase())
  );

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

  const handleTogglePin = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
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

  const handleDelete = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (userRole !== "admin") {
      toast.error("Only admins can delete announcements");
      return;
    }
    setAnnouncements((prev) => prev.filter((ann) => ann.id !== id));
    toast.success("Announcement deleted");
  };

  const handleEdit = (announcement: Announcement, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (userRole !== "admin") {
      toast.error("Only admins can edit announcements");
      return;
    }
    setEditingAnnouncement(announcement);
    setFormData({
      title: announcement.title.split(" - ")[0] || announcement.title,
      subject: announcement.title.split(" - ")[1] || "",
      recipientType: "All Members",
      specificRecipients: "",
      content: announcement.content.split("\\n\\n📢")[0] || announcement.content,
      priority: announcement.priority,
      category: announcement.category,
      customCategory: "",
      isPinned: announcement.isPinned,
    });
    // Mock existing images if any
    if (announcement.images) {
      const mockImages = announcement.images.map((img, idx) => ({
        file: new File([], `image-${idx}.jpg`),
        preview: img,
      }));
      setUploadedImages(mockImages);
    } else {
      setUploadedImages([]);
    }
    setShowCreateModal(true);
  };

  const handleCardClick = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
    setShowDetailModal(true);
    handleMarkAsRead(announcement.id);
  };

  const handleCreateNew = () => {
    setEditingAnnouncement(null);
    setFormData({
      title: "",
      subject: "",
      recipientType: "All Members",
      specificRecipients: "",
      content: "",
      priority: "normal",
      category: "Events",
      customCategory: "",
      isPinned: false,
    });
    setUploadedImages([]);
    setShowCreateModal(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (uploadedImages.length + files.length > 5) {
      toast.error('Maximum 5 images allowed');
      return;
    }

    for (const file of files) {
      if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
        toast.error(`${file.name} is not a .jpg or .png file`);
        continue;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 5MB limit`);
        continue;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImages((prev) => [...prev, { file, preview: reader.result as string }].slice(0, 5));
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
    if (formData.recipientType === "Specific Person" && !formData.specificRecipients.trim()) {
      toast.error("Please specify person name");
      return;
    }
    if (formData.category === "Other" && !formData.customCategory.trim()) {
      toast.error("Please specify custom category");
      return;
    }

    const finalCategory = formData.category === "Other" ? formData.customCategory : formData.category;
    const recipientInfo = formData.recipientType === "Specific Person" 
      ? `Specific Person: ${formData.specificRecipients}`
      : `Recipient: ${formData.recipientType}`;

    if (editingAnnouncement) {
      setAnnouncements((prev) =>
        prev.map((ann) =>
          ann.id === editingAnnouncement.id
            ? {
                ...ann,
                title: `${formData.title} - ${formData.subject}`,
                content: `${formData.content}\\n\\n📢 ${recipientInfo}`,
                priority: formData.priority,
                category: finalCategory,
                isPinned: formData.isPinned,
              }
            : ann
        )
      );
      toast.success("Announcement updated successfully");
    } else {
      const newAnnouncement: Announcement = {
        id: `ANN-${Date.now()}`,
        title: `${formData.title} - ${formData.subject}`,
        content: `${formData.content}\\n\\n📢 ${recipientInfo}${uploadedImages.length > 0 ? `\\n📷 ${uploadedImages.length} image(s) attached` : ''}`,
        priority: formData.priority,
        category: finalCategory,
        isPinned: formData.isPinned,
        isRead: false,
        author: "Admin Team",
        date: new Date().toISOString().split("T")[0],
      };
      setAnnouncements((prev) => [newAnnouncement, ...prev]);
      toast.success("Announcement created successfully");
    }

    setShowCreateModal(false);
    setEditingAnnouncement(null);
    setUploadedImages([]);
    setFormData({
      title: "",
      subject: "",
      recipientType: "All Members",
      specificRecipients: "",
      content: "",
      priority: "normal",
      category: "Events",
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
            className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap border-2 ${
              selectedCategory === cat
                ? "bg-[#f6421f] text-white border-[#f6421f]"
                : isDark
                ? "bg-white/10 border-white/20 hover:bg-white/20"
                : "bg-gray-100 border-gray-300 hover:bg-gray-200"
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

      {/* Announcements List - Smaller Cards */}
      <div className="space-y-3">
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
              onClick={() => handleCardClick(announcement)}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer hover:scale-[1.02] ${
                !announcement.isRead
                  ? "border-[#f6421f]/50 bg-[#f6421f]/10"
                  : isDark
                  ? "border-white/30 bg-white/10 hover:bg-white/15"
                  : "border-gray-400 bg-white hover:bg-gray-50"
              }`}
              style={{
                boxShadow: isDark
                  ? "0 4px 16px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.2)"
                  : "0 4px 16px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)",
              }}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {announcement.isPinned && (
                      <Pin className="w-3.5 h-3.5 text-[#f6421f]" />
                    )}
                    {!announcement.isRead && (
                      <span className="w-2 h-2 bg-[#f6421f] rounded-full" />
                    )}
                    <h3
                      style={{
                        fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                        fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
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
                      size="sm"
                    />
                    <span
                      className="px-2 py-0.5 rounded-lg"
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
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => handleTogglePin(announcement.id, e)}
                      className={`p-1.5 rounded-lg border-2 transition-all ${
                        announcement.isPinned
                          ? "bg-[#f6421f] text-white border-[#f6421f]"
                          : isDark
                          ? "border-white/30 bg-white/10 hover:bg-white/20"
                          : "border-gray-400 bg-gray-100 hover:bg-gray-200"
                      }`}
                      style={{
                        boxShadow: isDark
                          ? "0 2px 8px rgba(0, 0, 0, 0.3)"
                          : "0 2px 8px rgba(0, 0, 0, 0.1)",
                      }}
                      aria-label="Toggle pin"
                    >
                      <Pin className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleEdit(announcement, e)}
                      className="p-1.5 rounded-lg border-2 transition-all"
                      style={{
                        borderColor: isDark ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.25)",
                        backgroundColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(255, 255, 255, 0.9)",
                        boxShadow: isDark
                          ? "0 2px 8px rgba(0, 0, 0, 0.3)"
                          : "0 2px 8px rgba(0, 0, 0, 0.1)",
                        color: isDark ? "#ffffff" : "#000000",
                      }}
                      aria-label="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(announcement.id, e)}
                      className="p-1.5 rounded-lg border-2 border-red-400 bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all"
                      style={{
                        boxShadow: isDark
                          ? "0 2px 8px rgba(0, 0, 0, 0.3)"
                          : "0 2px 8px rgba(0, 0, 0, 0.1)",
                      }}
                      aria-label="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Content Preview - Smaller */}
              <p
                className="mb-2 line-clamp-2"
                style={{
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                  lineHeight: 1.5,
                  color: isDark ? "#d1d5db" : "#4b5563",
                }}
              >
                {announcement.content.split("\\n\\n")[0]}
              </p>

              {/* Footer */}
              <div
                className="flex items-center justify-between text-sm"
                style={{
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                  color: isDark ? "#9ca3af" : "#6b7280",
                }}
              >
                <span>By {announcement.author} • {announcement.date}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedAnnouncement && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={() => setShowDetailModal(false)}
        >
          <div
            className="max-w-3xl w-full rounded-2xl border-2 p-8"
            style={{
              background: isDark
                ? "rgba(17, 24, 39, 0.95)"
                : "rgba(255, 255, 255, 0.95)",
              backdropFilter: "blur(20px)",
              borderColor: isDark
                ? "rgba(255, 255, 255, 0.2)"
                : "rgba(0, 0, 0, 0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  {selectedAnnouncement.isPinned && (
                    <Pin className="w-5 h-5 text-[#f6421f]" />
                  )}
                  <h2
                    style={{
                      fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                      fontSize: `${DESIGN_TOKENS.typography.fontSize.h2}px`,
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
                    }}
                  >
                    {selectedAnnouncement.title}
                  </h2>
                </div>
                <div className="flex items-center gap-2 flex-wrap mb-4">
                  <StatusChip
                    status={selectedAnnouncement.priority}
                    label={selectedAnnouncement.priority.toUpperCase()}
                    customColor={getPriorityColor(selectedAnnouncement.priority)}
                  />
                  <span
                    className="px-3 py-1 rounded-lg"
                    style={{
                      backgroundColor: isDark
                        ? "rgba(255, 255, 255, 0.1)"
                        : "rgba(0, 0, 0, 0.05)",
                      fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                    }}
                  >
                    {selectedAnnouncement.category}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-2 rounded-lg hover:bg-white/50 dark:hover:bg-white/10 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <p
              className="mb-6 whitespace-pre-wrap"
              style={{
                fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                lineHeight: 1.7,
              }}
            >
              {selectedAnnouncement.content.replace(/\\n/g, '\n')}
            </p>

            <div
              className="pt-4 border-t"
              style={{
                borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
                fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                color: isDark ? "#9ca3af" : "#6b7280",
              }}
            >
              By {selectedAnnouncement.author} • {selectedAnnouncement.date}
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="max-w-2xl w-full rounded-2xl border-2 p-8 my-8"
            style={{
              background: isDark
                ? "rgba(17, 24, 39, 0.95)"
                : "rgba(255, 255, 255, 0.95)",
              backdropFilter: "blur(20px)",
              borderColor: isDark
                ? "rgba(255, 255, 255, 0.2)"
                : "rgba(0, 0, 0, 0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  color: DESIGN_TOKENS.colors.brand.red,
                }}
              >
                {editingAnnouncement ? "Edit Announcement" : "Create Announcement"}
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 rounded-lg hover:bg-white/50 dark:hover:bg-white/10 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              {/* Title */}
              <div>
                <label
                  className="block mb-2"
                  style={{
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    color: DESIGN_TOKENS.colors.brand.orange,
                  }}
                >
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter announcement title"
                  className="w-full px-4 py-3 rounded-xl border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20 transition-all outline-none"
                  style={{
                    borderColor: isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)",
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                  }}
                />
              </div>

              {/* Subject */}
              <div>
                <label
                  className="block mb-2"
                  style={{
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    color: DESIGN_TOKENS.colors.brand.orange,
                  }}
                >
                  Subject <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="Enter announcement subject"
                  className="w-full px-4 py-3 rounded-xl border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20 transition-all outline-none"
                  style={{
                    borderColor: isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)",
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                  }}
                />
              </div>

              {/* Recipient Type */}
              <div>
                <label
                  className="block mb-2"
                  style={{
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    color: DESIGN_TOKENS.colors.brand.orange,
                  }}
                >
                  Recipient Type <span className="text-red-500">*</span>
                </label>
                <CustomDropdown
                  value={formData.recipientType}
                  onChange={(value) => setFormData({ ...formData, recipientType: value })}
                  options={recipientTypes.map(type => ({ value: type, label: type }))}
                  isDark={isDark}
                  size="md"
                />
              </div>

              {/* Person Names - with Autocomplete */}
              {formData.recipientType === "Specific Person" && (
                <div className="relative">
                  <label
                    className="block mb-2"
                    style={{
                      fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                      color: DESIGN_TOKENS.colors.brand.orange,
                    }}
                  >
                    Person Names (comma-separated) <span className="text-red-500">*</span>
                  </label>
                  <input
                    ref={inputRef}
                    type="text"
                    value={formData.specificRecipients}
                    onChange={(e) => {
                      setFormData({ ...formData, specificRecipients: e.target.value });
                      setShowSuggestions(e.target.value.length > 0);
                    }}
                    onFocus={() => setShowSuggestions(formData.specificRecipients.length > 0)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    placeholder="Start typing a name..."
                    className="w-full px-4 py-3 rounded-xl border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20 transition-all outline-none"
                    style={{
                      borderColor: isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)",
                      fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                    }}
                  />
                  {/* Autocomplete Suggestions */}
                  {showSuggestions && filteredPersonNames.length > 0 && (
                    <div
                      className="absolute z-10 w-full mt-1 rounded-xl border-2 overflow-hidden shadow-lg"
                      style={{
                        background: isDark ? "rgba(17, 24, 39, 0.95)" : "rgba(255, 255, 255, 0.95)",
                        borderColor: isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)",
                        backdropFilter: "blur(20px)",
                      }}
                    >
                      {filteredPersonNames.map((name, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            const current = formData.specificRecipients.split(',').map(s => s.trim()).filter(Boolean);
                            const lastValue = current[current.length - 1] || "";
                            
                            // If user is typing, replace the last value
                            if (lastValue && !allPersonNames.includes(lastValue)) {
                              current[current.length - 1] = name;
                            } else {
                              // Otherwise just add to the list
                              current.push(name);
                            }
                            
                            setFormData({ 
                              ...formData, 
                              specificRecipients: current.join(', ') + ', '
                            });
                            setShowSuggestions(false);
                            inputRef.current?.focus();
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-[#f6421f]/10 transition-colors"
                          style={{
                            fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                          }}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Body */}
              <div>
                <label
                  className="block mb-2"
                  style={{
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    color: DESIGN_TOKENS.colors.brand.orange,
                  }}
                >
                  Body <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Enter the main announcement content..."
                  rows={5}
                  className="w-full px-4 py-3 rounded-xl border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20 transition-all outline-none resize-none"
                  style={{
                    borderColor: isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)",
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                  }}
                />
              </div>

              {/* Priority and Category */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label
                    className="block mb-2"
                    style={{
                      fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                      color: DESIGN_TOKENS.colors.brand.orange,
                    }}
                  >
                    Priority
                  </label>
                  <CustomDropdown
                    value={formData.priority}
                    onChange={(value) => setFormData({ ...formData, priority: value as "urgent" | "important" | "normal" })}
                    options={[
                      { value: "normal", label: "Normal" },
                      { value: "important", label: "Important" },
                      { value: "urgent", label: "Urgent" }
                    ]}
                    isDark={isDark}
                    size="md"
                  />
                </div>

                <div>
                  <label
                    className="block mb-2"
                    style={{
                      fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                      color: DESIGN_TOKENS.colors.brand.orange,
                    }}
                  >
                    Category
                  </label>
                  <CustomDropdown
                    value={formData.category}
                    onChange={(value) => setFormData({ ...formData, category: value })}
                    options={categories.filter(c => c !== "all").map(c => ({ value: c, label: c }))}
                    isDark={isDark}
                    size="md"
                  />
                </div>
              </div>

              {/* Custom Category Input */}
              {formData.category === "Other" && (
                <div>
                  <label
                    className="block mb-2"
                    style={{
                      fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                      color: DESIGN_TOKENS.colors.brand.orange,
                    }}
                  >
                    Specify Other Category <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.customCategory}
                    onChange={(e) => setFormData({ ...formData, customCategory: e.target.value })}
                    placeholder="Enter custom category name"
                    className="w-full px-4 py-3 rounded-xl border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20 transition-all outline-none"
                    style={{
                      borderColor: isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)",
                      fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                    }}
                  />
                </div>
              )}

              {/* Image Upload */}
              <div>
                <label
                  className="block mb-2"
                  style={{
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    color: DESIGN_TOKENS.colors.brand.orange,
                  }}
                >
                  Attach Images (Max 5)
                </label>
                <label
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer hover:border-[#f6421f] transition-all"
                  style={{
                    borderColor: isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)",
                  }}
                >
                  <Upload className="w-5 h-5" />
                  <span style={{ fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px` }}>
                    Click to upload images
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>

                {/* Image Previews */}
                {uploadedImages.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    {uploadedImages.map((img, idx) => (
                      <div key={idx} className="relative group">
                        <img
                          src={img.preview}
                          alt={`Preview ${idx + 1}`}
                          className="w-full h-24 object-cover rounded-lg"
                        />
                        <button
                          onClick={() => removeImage(idx)}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pin Announcement */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isPinned"
                  checked={formData.isPinned}
                  onChange={(e) => setFormData({ ...formData, isPinned: e.target.checked })}
                  className="w-5 h-5 rounded border-2 border-gray-300 dark:border-gray-600 text-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20"
                />
                <label
                  htmlFor="isPinned"
                  className="cursor-pointer"
                  style={{
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                  }}
                >
                  <Pin className="w-4 h-4 inline mr-2" />
                  Pin this announcement to the top
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-3 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                style={{
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 px-4 py-3 rounded-xl text-white transition-colors"
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
    </PageLayout>
  );
}