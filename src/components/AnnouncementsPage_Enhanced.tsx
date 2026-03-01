import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  BarChart3,
  Bell,
  Building,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit2,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  Filter,
  Globe,
  GripVertical,
  Link2,
  Loader2,
  Mail,
  MapPin,
  Paperclip,
  Pin,
  PinOff,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  TrendingUp,
  Upload,
  User,
  Users,
  X,
  XCircle,
} from "lucide-react";
import {
  PageLayout,
  Button,
  SearchInput,
  StatusChip,
  DESIGN_TOKENS,
  getGlassStyle,
} from "./design-system";
import CustomDropdown from "./CustomDropdown";
import { toast } from "sonner";
import { logCreate, logDelete, logEdit } from "../services/gasSystemToolsService";
import {
  addAnnouncementLinkAttachment,
  archiveAnnouncement,
  type AnnouncementEmailOptions,
  type CustomButton,
  type CustomButtonType,
  createAnnouncementDraft,
  deleteAnnouncement,
  fetchAnnouncements,
  getAnnouncementById,
  getAnnouncementReadDashboard,
  getAnnouncementSendLogs,
  markAnnouncementRead,
  previewAnnouncementRecipients,
  removeAnnouncementAttachment,
  resendAnnouncementRecipient,
  sendAnnouncement,
  updateAnnouncementDraft,
  uploadAnnouncementAttachment,
  type AnnouncementAttachment,
  type AnnouncementItem,
  type AnnouncementPriority,
  type AnnouncementSendLog,
  type AnnouncementReadDashboardItem,
  type RecipientType,
} from "../services/gasAnnouncementsService";
import { getAllOfficers, type DirectoryOfficer } from "../services/gasDirectoryService";
import type { UploadToastMessage } from "./UploadToast";

/* ─────────────────────────────── types ─────────────────────────────── */

interface AnnouncementsPageProps {
  onClose: () => void;
  isDark: boolean;
  userRole?: string;
  username?: string;
  initialAnnouncementId?: string;
  buildShareableUrl?: (page: string, params?: Record<string, string>) => string;
  addUploadToast?: (message: UploadToastMessage) => void;
  updateUploadToast?: (id: string, updates: Partial<UploadToastMessage>) => void;
  removeUploadToast?: (id: string) => void;
}

type RecipientSearchCommand = "@Person" | "@Committee" | "@Heads" | "@All" | "@External" | null;

interface SelectedRecipientChip {
  id: string;
  label: string;
  type: "person" | "committee" | "heads" | "all" | "external";
}

interface MemberWithEmail {
  id: string;
  name: string;
  username: string;
  email: string;
  committee?: string;
  profilePicture?: string;
}

/* ─────────────────────────────── constants ─────────────────────────────── */

const emptyForm = {
  title: "",
  subtitle: "",
  body: "",
  category: "Updates",
  priority: "normal" as AnnouncementPriority,
  recipientType: "All" as RecipientType,
  isPinned: false,
};

const CATEGORY_OPTIONS = [
  "Updates",
  "Events",
  "Meetings",
  "Reminders",
  "Announcements",
  "Training",
  "Social",
  "Urgent",
  "General",
];

const emptyEmailOptions = {
  fileButtonLabel: "",
  fileButtonMatch: "",
  eventStart: "",
  eventEnd: "",
  eventLocation: "",
  rsvpEmail: "",
  rsvpOptionsText: "",
  rsvpMessageTemplate: "",
};

const BUTTON_TYPE_OPTIONS: { value: CustomButtonType; label: string; icon: typeof Link2; description: string }[] = [
  { value: "link", label: "Link", icon: ExternalLink, description: "Opens a URL (webpage, form, etc.)" },
  { value: "document", label: "Document", icon: FileText, description: "Links to an uploaded attachment" },
  { value: "rsvp", label: "RSVP Email", icon: Mail, description: "Opens a mailto with a pretyped message" },
];

const ALLOWED_FILE_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
]);

const RECIPIENT_COMMANDS: {
  command: RecipientSearchCommand;
  icon: typeof User;
  label: string;
  color: string;
  recipientType: RecipientType;
}[] = [
  { command: "@Person", icon: User, label: "Search individual members", color: "#3b82f6", recipientType: "Person" },
  { command: "@Committee", icon: Building, label: "Search by committee", color: "#10b981", recipientType: "Committee" },
  { command: "@Heads", icon: Users, label: "Select all heads / leads", color: "#8b5cf6", recipientType: "Heads" },
  { command: "@All", icon: Users, label: "Select all members", color: DESIGN_TOKENS.colors.brand.orange, recipientType: "All" },
  { command: "@External", icon: Globe, label: "Add external recipient", color: "#ec4899", recipientType: "Person" },
];

/* ─────────────────────── localStorage caching ─────────────────────── */

const ANNOUNCEMENTS_CACHE_KEYS = {
  members: "ysp_announcements_members",
};
const ANNOUNCEMENTS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

interface CachedItem<T> {
  data: T;
  timestamp: number;
}

function getCachedData<T>(key: string): T | null {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    const parsed: CachedItem<T> = JSON.parse(cached);
    if (Date.now() - parsed.timestamp < ANNOUNCEMENTS_CACHE_TTL) {
      return parsed.data;
    }
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
  return null;
}

function setCachedData<T>(key: string, data: T) {
  try {
    const item: CachedItem<T> = { data, timestamp: Date.now() };
    localStorage.setItem(key, JSON.stringify(item));
  } catch {
    /* ignore - quota exceeded or disabled */
  }
}

/* ───────────────────────── getInitials helper ────────────────────────── */

function getInitials(name: string): string {
  if (!name) return "?";
  let displayName = name;
  if (name.includes(",")) {
    const parts = name.split(",").map((p) => p.trim());
    if (parts.length >= 2) {
      const firstNames = parts[1].split(" ").filter((p) => p.length > 0);
      const lastName = parts[0].split(" ")[0];
      displayName = `${firstNames[0] || ""} ${lastName}`;
    }
  }
  const words = displayName.split(" ").filter((p) => p.length > 0);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}

/* ─────────────────────────────── skeleton ─────────────────────────────── */

function Skeleton({ className = "", isDark = false }: { className?: string; isDark?: boolean }) {
  return (
    <div
      className={`animate-pulse rounded ${className}`}
      style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }}
    />
  );
}

function AnnouncementCardSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div
      className="p-6 sm:p-6"
      style={{
        borderRadius: DESIGN_TOKENS.radius.card,
        border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
        ...getGlassStyle(isDark),
      }}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1">
          <Skeleton isDark={isDark} className="h-5 w-2/5 mb-2" />
          <Skeleton isDark={isDark} className="h-3 w-3/5 mb-3" />
          <div className="flex gap-2">
            <Skeleton isDark={isDark} className="h-6 w-16 rounded-full" />
            <Skeleton isDark={isDark} className="h-6 w-20 rounded-full" />
            <Skeleton isDark={isDark} className="h-6 w-14 rounded-full" />
          </div>
        </div>
        <Skeleton isDark={isDark} className="h-8 w-20" />
      </div>
      <Skeleton isDark={isDark} className="h-3 w-full mb-1.5" />
      <Skeleton isDark={isDark} className="h-3 w-5/6 mb-1.5" />
      <Skeleton isDark={isDark} className="h-3 w-4/6" />
    </div>
  );
}

function DetailModalSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <Skeleton isDark={isDark} className="h-7 w-3/5 mb-2" />
          <Skeleton isDark={isDark} className="h-4 w-4/5" />
        </div>
        <div className="flex gap-2 shrink-0">
          <Skeleton isDark={isDark} className="h-8 w-8 rounded-lg" />
          <Skeleton isDark={isDark} className="h-8 w-8 rounded-lg" />
          <Skeleton isDark={isDark} className="h-8 w-8 rounded-lg" />
        </div>
      </div>
      {/* Body */}
      <div className="space-y-2">
        <Skeleton isDark={isDark} className="h-4 w-full" />
        <Skeleton isDark={isDark} className="h-4 w-full" />
        <Skeleton isDark={isDark} className="h-4 w-5/6" />
        <Skeleton isDark={isDark} className="h-4 w-4/6" />
        <Skeleton isDark={isDark} className="h-4 w-3/5" />
      </div>
      {/* Attachments */}
      <div>
        <Skeleton isDark={isDark} className="h-5 w-28 mb-3" />
        <div className="space-y-2">
          <Skeleton isDark={isDark} className="h-10 w-full rounded-lg" />
          <Skeleton isDark={isDark} className="h-10 w-full rounded-lg" />
        </div>
      </div>
      {/* Recipients */}
      <div>
        <Skeleton isDark={isDark} className="h-5 w-48 mb-3" />
        <div className="space-y-1">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} isDark={isDark} className="h-9 w-full rounded-lg" />
          ))}
        </div>
      </div>
      {/* Send Logs */}
      <div>
        <Skeleton isDark={isDark} className="h-5 w-24 mb-3" />
        <div className="space-y-1">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} isDark={isDark} className="h-9 w-full rounded-lg" />
          ))}
        </div>
      </div>
      {/* Send controls */}
      <div className="flex gap-3 pt-2">
        <Skeleton isDark={isDark} className="h-10 w-40 rounded-lg" />
        <Skeleton isDark={isDark} className="h-10 w-36 rounded-lg" />
      </div>
    </div>
  );
}

function ReadDashboardSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div className="space-y-6">
      {/* Search/filter bar */}
      <div
        className="p-5"
        style={{
          borderRadius: DESIGN_TOKENS.radius.card,
          border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)"}`,
          ...getGlassStyle(isDark),
        }}
      >
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <Skeleton isDark={isDark} className="h-4 w-24 mb-2" />
            <Skeleton isDark={isDark} className="h-10 w-full rounded-lg" />
          </div>
          <div>
            <Skeleton isDark={isDark} className="h-4 w-16 mb-2" />
            <Skeleton isDark={isDark} className="h-10 w-full rounded-lg" />
          </div>
          <Skeleton isDark={isDark} className="h-16 w-full rounded-xl" />
        </div>
      </div>
      {/* Cards */}
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="p-4"
          style={{
            borderRadius: DESIGN_TOKENS.radius.card,
            border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)"}`,
            ...getGlassStyle(isDark),
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1 min-w-0">
              <Skeleton isDark={isDark} className="h-5 w-2/5 mb-2" />
              <Skeleton isDark={isDark} className="h-3 w-3/5" />
            </div>
            <Skeleton isDark={isDark} className="h-5 w-16" />
          </div>
          <div className="space-y-1.5">
            <Skeleton isDark={isDark} className="h-8 w-full rounded-lg" />
            <Skeleton isDark={isDark} className="h-8 w-full rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────── helpers ─────────────────────────────── */

function inputStyle(isDark: boolean): React.CSSProperties {
  return {
    height: DESIGN_TOKENS.interactive.input.height,
    borderRadius: DESIGN_TOKENS.radius.input,
    background: isDark ? "rgba(30,41,59,0.8)" : "rgba(255,255,255,0.9)",
    borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)",
    color: isDark ? "#fff" : "#000",
  };
}

function textareaStyle(isDark: boolean): React.CSSProperties {
  return {
    borderRadius: DESIGN_TOKENS.radius.input,
    background: isDark ? "rgba(30,41,59,0.8)" : "rgba(255,255,255,0.9)",
    borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)",
    color: isDark ? "#fff" : "#000",
  };
}

function modalOverlayStyle(): React.CSSProperties {
  return { zIndex: 9999991 };
}

function modalContentStyle(isDark: boolean): React.CSSProperties {
  return {
    zIndex: 9999992,
    maxWidth: DESIGN_TOKENS.modal.maxWidthDesktop,
    borderRadius: DESIGN_TOKENS.radius.modal,
    background: isDark ? "rgba(15,23,42,0.98)" : "rgba(255,255,255,0.98)",
    border: `2px solid ${isDark ? "rgba(238,135,36,0.3)" : "rgba(0,0,0,0.1)"}`,
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
  };
}

function cardStyle(isDark: boolean): React.CSSProperties {
  return {
    borderRadius: DESIGN_TOKENS.radius.card,
    border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)"}`,
    ...getGlassStyle(isDark),
  };
}

/* ═══════════════════════════════ COMPONENT ═══════════════════════════════ */

export default function AnnouncementsPageEnhanced({
  onClose,
  isDark,
  userRole: _userRole,
  username = "",
  initialAnnouncementId,
  buildShareableUrl: _buildShareableUrl,
  addUploadToast,
  updateUploadToast,
  removeUploadToast,
}: AnnouncementsPageProps) {
  /* ───── error logger ───── */
  const logErr = (scope: string, error: unknown, extra?: Record<string, unknown>) => {
    console.error(`[Announcements UI] ${scope}`, {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      ...extra,
    });
  };

  /* ───── core state ───── */
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [permissions, setPermissions] = useState({
    canManage: false,
    canSend: false,
    canView: true,
    canViewReadDashboard: false,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const handledInitialIdRef = useRef(false);

  /* ───── editor state ───── */
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<AnnouncementItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [emailOptions, setEmailOptions] = useState(emptyEmailOptions);
  const [customButtons, setCustomButtons] = useState<CustomButton[]>([]);
  const [showAddButtonModal, setShowAddButtonModal] = useState(false);
  const [editingButtonIndex, setEditingButtonIndex] = useState<number | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [links, setLinks] = useState<Array<{ name: string; url: string; _existing?: true }>>([{ name: "", url: "" }]);
  const [recipientPreview, setRecipientPreview] = useState({ total: 0, eligible: 0, ineligible: 0 });

  /* ───── recipient smart-search state ───── */
  const [recipientChips, setRecipientChips] = useState<SelectedRecipientChip[]>([]);
  const [activeCommand, setActiveCommand] = useState<RecipientSearchCommand>(null);
  const [recipientSearchQuery, setRecipientSearchQuery] = useState("");
  const [commandSearchQuery, setCommandSearchQuery] = useState("");
  const [showRecipientDropdown, setShowRecipientDropdown] = useState(false);
  const [showAllChips, setShowAllChips] = useState(false);
  const recipientSearchRef = useRef<HTMLDivElement>(null);

  /* ───── directory members (local cache) ───── */
  const [members, setMembers] = useState<MemberWithEmail[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  /* ───── @External form state ───── */
  const [externalName, setExternalName] = useState("");
  const [externalEmail, setExternalEmail] = useState("");

  /* ───── detail modal state ───── */
  const [viewing, setViewing] = useState<AnnouncementItem | null>(null);
  const [viewingLoading, setViewingLoading] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const detailRequestRef = useRef(0);
  const [viewContext, setViewContext] = useState<"recipient" | "dashboard">("recipient");
  const [logs, setLogs] = useState<AnnouncementSendLog[]>([]);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [deliveryChannel, setDeliveryChannel] = useState<"email" | "frontend">("email");
  const [selectedTargets, setSelectedTargets] = useState<Record<string, boolean>>({});
  const [hideAuthor, setHideAuthor] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showEmailHeader, setShowEmailHeader] = useState(false);
  const [showEmailFooter, setShowEmailFooter] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  /* ───── read dashboard state ───── */
  const [readDashboard, setReadDashboard] = useState<AnnouncementReadDashboardItem[]>([]);
  const [showReadDashboard, setShowReadDashboard] = useState(false);
  const [readDashboardLoading, setReadDashboardLoading] = useState(false);
  const [readDashboardQuery, setReadDashboardQuery] = useState("");
  const [readDashboardStatus, setReadDashboardStatus] = useState("All");

  /* ───── filter state ───── */
  const [showFilters, setShowFilters] = useState(false);
  const [filterShowPinned, setFilterShowPinned] = useState<"all" | "pinned" | "unpinned">("all");
  const [filterShowRead, setFilterShowRead] = useState<"all" | "read" | "unread">("all");
  const [readAnnouncementIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("ysp_ann_read_ids");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  /* ───── dashboard tab state (for managers) ───── */
  const [dashboardTab, setDashboardTab] = useState<"drafts" | "archived">("drafts");

  const closeDetailModal = useCallback(() => {
    detailRequestRef.current += 1; // invalidate any in-flight openView request
    setIsDetailModalOpen(false);
    setViewingLoading(false);
    setViewing(null);
    setLogs([]);
    setLightboxUrl(null);
    setConfirmingDeleteId(null);
  }, []);

  /* ═══════════════════════ DERIVED DATA ═══════════════════════ */

  /* Split items by status */
  const sentItems = useMemo(() => items.filter((x) => x.status === "Sent"), [items]);
  const draftItems = useMemo(() => items.filter((x) => x.status === "Draft"), [items]);
  const archivedItems = useMemo(() => items.filter((x) => x.status === "Archived"), [items]);

  const categories = useMemo(() => {
    const dynamicCategories = Array.from(new Set(sentItems.map((x) => x.category)));
    const additionalLegacy = dynamicCategories.filter((c) => !CATEGORY_OPTIONS.includes(c));
    return ["all", ...CATEGORY_OPTIONS, ...additionalLegacy];
  }, [sentItems]);
  const categoryOptions = useMemo(
    () => categories.map((value) => ({ value, label: value === "all" ? "All" : value })),
    [categories]
  );

  /* Track read announcements locally */
  const markLocalRead = useCallback((id: string) => {
    readAnnouncementIds.add(id);
    try { localStorage.setItem("ysp_ann_read_ids", JSON.stringify([...readAnnouncementIds])); } catch { /* */ }
  }, [readAnnouncementIds]);

  /* Main page: only Sent announcements the user is a recipient of, with filters */
  const filtered = useMemo(
    () =>
      sentItems
        .filter((x) => {
          // For managers, only show announcements they are targeted in (recipient view)
          // Non-managers are already filtered by the backend
          if (permissions.canManage && x.isTargeted === false) return false;
          const q = search.toLowerCase().trim();
          const matchQ =
            !q ||
            x.title.toLowerCase().includes(q) ||
            x.subtitle.toLowerCase().includes(q) ||
            x.body.toLowerCase().includes(q);
          const matchC = category === "all" || x.category === category;
          // Pinned filter
          const matchPinned =
            filterShowPinned === "all" ||
            (filterShowPinned === "pinned" && x.isPinned) ||
            (filterShowPinned === "unpinned" && !x.isPinned);
          // Read filter
          const isRead = readAnnouncementIds.has(x.announcementId) || (x.readCount && x.readCount > 0);
          const matchRead =
            filterShowRead === "all" ||
            (filterShowRead === "read" && isRead) ||
            (filterShowRead === "unread" && !isRead);
          return matchQ && matchC && matchPinned && matchRead;
        })
        .sort((a, b) =>
          a.isPinned === b.isPinned
            ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            : a.isPinned
            ? -1
            : 1
        ),
    [sentItems, search, category, filterShowPinned, filterShowRead, readAnnouncementIds, permissions.canManage]
  );

  /* Dashboard items filtered by tab */
  const dashboardItems = useMemo(() => {
    const source = dashboardTab === "drafts" ? draftItems : archivedItems;
    const q = search.toLowerCase().trim();
    return source.filter((x) => {
      const matchQ = !q || x.title.toLowerCase().includes(q) || x.subtitle.toLowerCase().includes(q);
      const matchC = category === "all" || x.category === category;
      return matchQ && matchC;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [dashboardTab, draftItems, archivedItems, search, category]);

  /* Analytics for dashboard */
  const analytics = useMemo(() => {
    const totalSent = sentItems.length;
    const totalDrafts = draftItems.length;
    const totalArchived = archivedItems.length;
    const totalRead = sentItems.reduce((sum, x) => sum + (x.readCount || 0), 0);
    const avgRead = totalSent > 0 ? Math.round(totalRead / totalSent) : 0;
    const categoryBreakdown: Record<string, number> = {};
    sentItems.forEach((x) => { categoryBreakdown[x.category] = (categoryBreakdown[x.category] || 0) + 1; });
    const priorityBreakdown: Record<string, number> = { urgent: 0, important: 0, normal: 0 };
    sentItems.forEach((x) => { priorityBreakdown[x.priority] = (priorityBreakdown[x.priority] || 0) + 1; });
    return { totalSent, totalDrafts, totalArchived, totalRead, avgRead, categoryBreakdown, priorityBreakdown };
  }, [sentItems, draftItems, archivedItems]);
  const filteredReadDashboard = useMemo(() => {
    const q = readDashboardQuery.toLowerCase().trim();
    return readDashboard.filter((row) => {
      const statusOk = readDashboardStatus === "All" || row.status === readDashboardStatus;
      const searchOk =
        !q || row.title.toLowerCase().includes(q) || row.subtitle.toLowerCase().includes(q);
      return statusOk && searchOk;
    });
  }, [readDashboard, readDashboardQuery, readDashboardStatus]);

  /* Derive recipientType + IDs from chips */
  const derivedRecipientType = useMemo((): RecipientType => {
    if (recipientChips.length === 0) return "All";
    const types = new Set(recipientChips.map((c) => c.type));
    if (types.has("all")) return "All";
    if (types.has("heads")) return "Heads";
    if (types.has("committee")) return "Committee";
    if (types.has("person") || types.has("external")) return "Person";
    return "All";
  }, [recipientChips]);

  const derivedRecipientIds = useMemo(
    () => recipientChips.map((c) => c.id),
    [recipientChips]
  );

  /* ─── Recipient smart-search: command suggestions ─── */
  const commandSuggestions = useMemo(() => {
    if (activeCommand) return [];
    if (!recipientSearchQuery.startsWith("@")) return [];
    const q = recipientSearchQuery.toLowerCase();
    return RECIPIENT_COMMANDS.filter(
      (c) =>
        c.command!.toLowerCase().startsWith(q) ||
        c.label.toLowerCase().includes(q.replace("@", ""))
    );
  }, [activeCommand, recipientSearchQuery]);

  /* ─── Client-side recipient filtering from locally cached members ─── */
  const localRecipientSuggestions = useMemo(() => {
    if (!activeCommand) return [];
    const query = commandSearchQuery.toLowerCase().trim();

    switch (activeCommand) {
      case "@Person":
        if (!query) return members.slice(0, 8);
        return members
          .filter(
            (m) =>
              m.name.toLowerCase().includes(query) ||
              m.email?.toLowerCase().includes(query) ||
              m.username?.toLowerCase().includes(query)
          )
          .slice(0, 8);

      case "@Committee": {
        // Build unique committees from loaded members
        const committeeSet = new Map<string, number>();
        members.forEach((m) => {
          if (m.committee) {
            const key = m.committee.trim();
            committeeSet.set(key, (committeeSet.get(key) || 0) + 1);
          }
        });
        const committees = Array.from(committeeSet.entries()).map(([name, count]) => ({
          id: name,
          label: name,
          type: "committee" as const,
          subtitle: `${count} member${count !== 1 ? "s" : ""}`,
        }));
        if (!query) return committees.slice(0, 8);
        return committees
          .filter((c) => c.label.toLowerCase().includes(query))
          .slice(0, 8);
      }

      default:
        return [];
    }
  }, [activeCommand, commandSearchQuery, members]);

  /* ═══════════════════════ DATA FETCHING ═══════════════════════ */

  const load = useCallback(async (signal?: AbortSignal, opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const res = await fetchAnnouncements({ status: "All" });
      if (signal?.aborted) return;
      setItems(res.items);
      setPermissions({
        canManage: Boolean(res.permissions.canManage),
        canSend: Boolean(res.permissions.canSend),
        canView: Boolean(res.permissions.canView),
        canViewReadDashboard: Boolean(res.permissions.canViewReadDashboard),
      });
    } catch (e) {
      if (signal?.aborted) return;
      logErr("load", e);
      toast.error("Failed to load announcements", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      if (!signal?.aborted && !opts?.silent) setLoading(false);
    }
  }, []);

  /* Load directory members into local cache for instant search */
  const loadMembers = useCallback(async (forceRefresh = false) => {
    setIsLoadingMembers(true);
    setMembersError(null);
    try {
      if (!forceRefresh) {
        const cached = getCachedData<MemberWithEmail[]>(ANNOUNCEMENTS_CACHE_KEYS.members);
        if (cached && cached.length > 0) {
          setMembers(cached);
          setIsLoadingMembers(false);
          return;
        }
      }
      const allMembers: MemberWithEmail[] = [];
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const response = await getAllOfficers(page, 100);
        if (response.success && response.officers) {
          const mapped = response.officers
            .filter((o: DirectoryOfficer) => o.personalEmail || o.email)
            .map((o: DirectoryOfficer, idx: number) => ({
              id: `member-${page}-${idx}`,
              name: o.fullName,
              username: o.username || "",
              email: o.personalEmail || o.email,
              committee: o.committee || "",
              profilePicture: o.profilePicture || "",
            }));
          allMembers.push(...mapped);
          hasMore = response.pagination?.hasMore || false;
          page++;
        } else {
          hasMore = false;
        }
      }
      const uniqueMembers = allMembers.filter(
        (m, idx, arr) =>
          arr.findIndex((x) => x.email.toLowerCase() === m.email.toLowerCase()) === idx
      );
      if (uniqueMembers.length === 0) {
        setMembersError("No members with email addresses found. Use @External to add recipients manually.");
      } else {
        setMembers(uniqueMembers);
        setCachedData(ANNOUNCEMENTS_CACHE_KEYS.members, uniqueMembers);
      }
    } catch (error) {
      logErr("loadMembers", error);
      setMembersError("Failed to load members. Click to retry or use @External to add recipients.");
    } finally {
      setIsLoadingMembers(false);
    }
  }, []);

  /* Initial load */
  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [load]);

  /* Handle initial deep-link once */
  useEffect(() => {
    if (!initialAnnouncementId || handledInitialIdRef.current || loading) return;
    const hit = items.find((x) => x.announcementId === initialAnnouncementId);
    if (hit) {
      handledInitialIdRef.current = true;
      void openView(hit.announcementId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, loading, initialAnnouncementId]);

  /* Load members when user has manage permissions (for recipient search) */
  useEffect(() => {
    if (permissions.canManage) {
      void loadMembers();
    }
  }, [permissions.canManage, loadMembers]);

  /* Preview recipients when editor is open */
  useEffect(() => {
    if (!showEditor || !permissions.canManage) {
      setRecipientPreview({ total: 0, eligible: 0, ineligible: 0 });
      return;
    }
    if (recipientChips.length === 0 && derivedRecipientType === "All") {
      setRecipientPreview({ total: 0, eligible: 0, ineligible: 0 });
      return;
    }
    const recipientPayload =
      derivedRecipientType === "Person"
        ? { usernames: derivedRecipientIds }
        : derivedRecipientType === "Committee"
        ? { committees: derivedRecipientIds }
        : {};
    const t = window.setTimeout(async () => {
      try {
        const targets = await previewAnnouncementRecipients({
          recipientType: derivedRecipientType,
          recipientPayload,
        });
        const eligible = targets.filter((x) => x.eligibility === "eligible").length;
        setRecipientPreview({
          total: targets.length,
          eligible,
          ineligible: targets.length - eligible,
        });
      } catch {
        setRecipientPreview({ total: 0, eligible: 0, ineligible: 0 });
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [derivedRecipientType, derivedRecipientIds, recipientChips.length, showEditor, permissions.canManage]);

  /* Read dashboard debounced refresh */
  useEffect(() => {
    if (!showReadDashboard || readDashboardLoading) return;
    const t = window.setTimeout(async () => {
      try {
        setReadDashboard(await getAnnouncementReadDashboard(undefined, readDashboardQuery));
      } catch (e) {
        logErr("refreshReadDashboard", e);
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [readDashboardQuery, readDashboardLoading, showReadDashboard]);

  /* Close recipient dropdown on outside click */
  useEffect(() => {
    if (!showRecipientDropdown) return;
    const handleClick = (e: MouseEvent) => {
      if (recipientSearchRef.current && !recipientSearchRef.current.contains(e.target as Node)) {
        setShowRecipientDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showRecipientDropdown]);

  /* Escape key handler for modals */
  useEffect(() => {
    if (!showEditor && !isDetailModalOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showEditor) setShowEditor(false);
        else if (isDetailModalOpen) closeDetailModal();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [showEditor, isDetailModalOpen, closeDetailModal]);

  /* Scroll lock when modal is open */
  useEffect(() => {
    if (showEditor || isDetailModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showEditor, isDetailModalOpen]);

  /* ═══════════════════════ ACTIONS ═══════════════════════ */

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setRecipientChips([]);
    setEmailOptions(emptyEmailOptions);
    setCustomButtons([]);
    setHideAuthor(false);
    setPendingFiles([]);
    setLinks([{ name: "", url: "" }]);
    setActiveCommand(null);
    setRecipientSearchQuery("");
    setCommandSearchQuery("");
    setExternalName("");
    setExternalEmail("");
    setShowEditor(true);
  };

  const openEdit = (item: AnnouncementItem) => {
    const storedEmailOptions = (item.recipientPayload?.emailOptions || {}) as AnnouncementEmailOptions;
    setEditing(item);
    setForm({
      title: item.title,
      subtitle: item.subtitle,
      body: item.body,
      category: item.category,
      priority: item.priority,
      recipientType: item.recipientType,
      isPinned: item.isPinned,
    });

    /* Restore recipient chips */
    const chips: SelectedRecipientChip[] = [];
    if (item.recipientType === "Person" && item.recipientPayload?.usernames) {
      item.recipientPayload.usernames.forEach((u) =>
        chips.push({ id: u, label: u, type: "person" })
      );
    } else if (item.recipientType === "Committee" && item.recipientPayload?.committees) {
      item.recipientPayload.committees.forEach((c) =>
        chips.push({ id: c, label: c, type: "committee" })
      );
    } else if (item.recipientType === "Heads") {
      chips.push({ id: "heads", label: "All Heads", type: "heads" });
    } else if (item.recipientType === "All") {
      chips.push({ id: "all", label: "All Members", type: "all" });
    }
    setRecipientChips(chips);

    setEmailOptions({
      fileButtonLabel: storedEmailOptions.fileButtonLabel || "",
      fileButtonMatch: storedEmailOptions.fileButtonMatch || "",
      eventStart: storedEmailOptions.eventStart || "",
      eventEnd: storedEmailOptions.eventEnd || "",
      eventLocation: storedEmailOptions.eventLocation || "",
      rsvpEmail: storedEmailOptions.rsvpEmail || "",
      rsvpOptionsText: Array.isArray(storedEmailOptions.rsvpOptions)
        ? storedEmailOptions.rsvpOptions.join(", ")
        : storedEmailOptions.rsvpOptions || "",
      rsvpMessageTemplate: storedEmailOptions.rsvpMessageTemplate || "",
    });
    setCustomButtons(storedEmailOptions.customButtons || []);
    setHideAuthor(!!storedEmailOptions.hideAuthor);
    setPendingFiles([]);
    /* Pre-populate existing link attachments so we don't re-add them on save */
    const existingLinks = (item.attachments || [])
      .filter((a) => a.attachmentType === "link")
      .map((a) => ({ name: a.name, url: a.url, _existing: true as const }));
    setLinks(existingLinks.length > 0 ? existingLinks : [{ name: "", url: "" }]);
    setActiveCommand(null);
    setRecipientSearchQuery("");
    setCommandSearchQuery("");
    setShowEditor(true);
  };

  const save = async () => {
    if (isSaving) return;
    if (!form.title.trim() || !form.subtitle.trim() || !form.body.trim())
      return toast.error("Title, subtitle, and body are required");
    if (
      (derivedRecipientType === "Person" || derivedRecipientType === "Committee") &&
      derivedRecipientIds.length === 0
    )
      return toast.error("Select at least one recipient");
    if (pendingFiles.some((f) => f.size > 10 * 1024 * 1024))
      return toast.error("One or more files exceed 10MB");

    const toastId = `ann_save_${Date.now()}`;
    addUploadToast?.({
      id: toastId,
      title: editing ? "Updating announcement" : "Creating announcement",
      message: "Saving draft...",
      status: "loading",
      progress: 10,
    });

    setIsSaving(true);
    try {
      const recipientPayload =
        derivedRecipientType === "Person"
          ? { usernames: derivedRecipientIds }
          : derivedRecipientType === "Committee"
          ? { committees: derivedRecipientIds }
          : {};

      const cleanedEmailOptions: AnnouncementEmailOptions = {};
      if (emailOptions.fileButtonLabel.trim() && emailOptions.fileButtonMatch.trim()) {
        cleanedEmailOptions.fileButtonLabel = emailOptions.fileButtonLabel.trim();
        cleanedEmailOptions.fileButtonMatch = emailOptions.fileButtonMatch.trim();
      }
      if (emailOptions.eventStart) cleanedEmailOptions.eventStart = emailOptions.eventStart;
      if (emailOptions.eventEnd) cleanedEmailOptions.eventEnd = emailOptions.eventEnd;
      if (emailOptions.eventLocation.trim())
        cleanedEmailOptions.eventLocation = emailOptions.eventLocation.trim();
      if (emailOptions.rsvpEmail.trim())
        cleanedEmailOptions.rsvpEmail = emailOptions.rsvpEmail.trim();
      const parsedRsvpOptions = emailOptions.rsvpOptionsText
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      if (parsedRsvpOptions.length > 0) cleanedEmailOptions.rsvpOptions = parsedRsvpOptions;
      if (emailOptions.rsvpMessageTemplate.trim())
        cleanedEmailOptions.rsvpMessageTemplate = emailOptions.rsvpMessageTemplate.trim();
      if (customButtons.length > 0)
        cleanedEmailOptions.customButtons = customButtons;
      if (hideAuthor) cleanedEmailOptions.hideAuthor = true;
      if (Object.keys(cleanedEmailOptions).length > 0)
        Object.assign(recipientPayload, { emailOptions: cleanedEmailOptions });

      const payload = {
        ...form,
        title: form.title.trim(),
        subtitle: form.subtitle.trim(),
        body: form.body.trim(),
        recipientType: derivedRecipientType,
        recipientPayload,
      };
      const saved = editing
        ? await updateAnnouncementDraft(editing.announcementId, payload)
        : await createAnnouncementDraft(payload);

      updateUploadToast?.(toastId, { progress: 40, message: "Syncing attachments..." });

      const goodLinks = links.filter((x) => x.name.trim() && x.url.trim() && !("_existing" in x));
      for (let i = 0; i < goodLinks.length; i++) {
        await addAnnouncementLinkAttachment({
          announcementId: saved.announcementId,
          name: goodLinks[i].name.trim(),
          url: goodLinks[i].url.trim(),
        });
        updateUploadToast?.(toastId, {
          progress: 45 + Math.floor((i / Math.max(goodLinks.length, 1)) * 20),
          message: `Adding link ${i + 1}/${goodLinks.length}`,
        });
      }

      for (let i = 0; i < pendingFiles.length; i++) {
        const f = pendingFiles[i];
        const base64 = await fileToBase64(f);
        await uploadAnnouncementAttachment({
          announcementId: saved.announcementId,
          fileName: f.name,
          mimeType: f.type || "application/octet-stream",
          base64Data: base64,
          sizeBytes: f.size,
        });
        updateUploadToast?.(toastId, {
          progress: 70 + Math.floor((i / Math.max(pendingFiles.length, 1)) * 25),
          message: `Uploading ${i + 1}/${pendingFiles.length}`,
        });
      }

      if (editing) logEdit(username, "Announcement", saved.title);
      else logCreate(username, "Announcement", saved.title);

      updateUploadToast?.(toastId, { status: "success", progress: 100, message: "Saved" });
      setTimeout(() => removeUploadToast?.(toastId), 2800);
      setShowEditor(false);
      setEditing(null);
      await load();
      const full = await getAnnouncementById(saved.announcementId);
      setIsDetailModalOpen(true);
      setViewing(full);
      setLogs(await getAnnouncementSendLogs(saved.announcementId));
    } catch (e) {
      logErr("save", e, { editingId: editing?.announcementId, formTitle: form.title });
      updateUploadToast?.(toastId, {
        status: "error",
        message: e instanceof Error ? e.message : "Save failed",
      });
      setTimeout(() => removeUploadToast?.(toastId), 4200);
      toast.error("Failed to save", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const onPickFiles = (files: File[]) => {
    const validFiles: File[] = [];
    for (const f of files) {
      if (!ALLOWED_FILE_MIME.has(f.type)) {
        toast.error("Unsupported file type", { description: `${f.name} is not allowed` });
        continue;
      }
      if (f.size > 10 * 1024 * 1024) {
        toast.error("File exceeds 10MB", { description: f.name });
        continue;
      }
      validFiles.push(f);
    }
    if (validFiles.length === 0) return;
    const merged = [...pendingFiles, ...validFiles];
    if (merged.length > 10) {
      toast.error("Maximum 10 files allowed");
      return;
    }
    setPendingFiles(merged);
  };

  const openView = async (id: string, context: "recipient" | "dashboard" = "recipient") => {
    const requestId = ++detailRequestRef.current;
    setIsDetailModalOpen(true);
    setViewingLoading(true);
    setViewing(null);
    setLogs([]);
    setViewContext(context);
    setLightboxUrl(null);
    const toastId = `ann_view_${Date.now()}`;
    addUploadToast?.({ id: toastId, title: "Loading announcement", message: "Fetching details...", status: "loading", progress: 20 });
    try {
      await markAnnouncementRead(id);
      if (requestId !== detailRequestRef.current) return;
      markLocalRead(id);
      updateUploadToast?.(toastId, { progress: 50, message: "Loading details..." });
      const full = await getAnnouncementById(id);
      if (requestId !== detailRequestRef.current) return;
      setViewing(full);
      updateUploadToast?.(toastId, { progress: 80, message: "Loading logs..." });
      const loadedLogs = await getAnnouncementSendLogs(id);
      if (requestId !== detailRequestRef.current) return;
      setLogs(loadedLogs);
      const selected: Record<string, boolean> = {};
      (full.targets || []).forEach((t) => {
        if (t.eligibility === "eligible") selected[t.targetId] = false;
      });
      setSelectedTargets(selected);
      setDeliveryChannel("email");
      setConfirmingDeleteId(null);
      updateUploadToast?.(toastId, { status: "success", progress: 100, message: "Loaded" });
      setTimeout(() => removeUploadToast?.(toastId), 1500);
      await load(undefined, { silent: true });
    } catch (e) {
      if (requestId !== detailRequestRef.current) return;
      logErr("openView", e, { announcementId: id });
      updateUploadToast?.(toastId, { status: "error", message: e instanceof Error ? e.message : "Failed to load" });
      setTimeout(() => removeUploadToast?.(toastId), 3500);
      toast.error("Failed to load details", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      if (requestId === detailRequestRef.current) {
        setViewingLoading(false);
      }
    }
  };

  const handleDelete = async (announcementId: string, title: string, fromDetail = false) => {
    const toastId = `ann_del_${Date.now()}`;
    addUploadToast?.({ id: toastId, title: "Deleting announcement", message: "Removing...", status: "loading", progress: 30 });
    try {
      await deleteAnnouncement(announcementId);
      logDelete(username, "Announcement", title);
      updateUploadToast?.(toastId, { status: "success", progress: 100, message: "Deleted" });
      setTimeout(() => removeUploadToast?.(toastId), 2000);
      if (fromDetail) closeDetailModal();
      setConfirmingDeleteId(null);
      await load();
    } catch (e) {
      logErr("delete", e, { announcementId });
      updateUploadToast?.(toastId, { status: "error", message: e instanceof Error ? e.message : "Delete failed" });
      setTimeout(() => removeUploadToast?.(toastId), 3500);
      toast.error("Failed to delete", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const handleArchive = async (announcementId: string) => {
    const toastId = `ann_arch_${Date.now()}`;
    addUploadToast?.({ id: toastId, title: "Archiving announcement", message: "Archiving...", status: "loading", progress: 30 });
    try {
      await archiveAnnouncement(announcementId);
      updateUploadToast?.(toastId, { status: "success", progress: 100, message: "Archived" });
      setTimeout(() => removeUploadToast?.(toastId), 2000);
      const full = await getAnnouncementById(announcementId);
      setViewing(full);
      await load();
    } catch (e) {
      logErr("archive", e, { announcementId });
      updateUploadToast?.(toastId, { status: "error", message: e instanceof Error ? e.message : "Archive failed" });
      setTimeout(() => removeUploadToast?.(toastId), 3500);
      toast.error("Failed to archive", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const handleRemoveAttachment = async (announcementId: string, attachmentId: string) => {
    const toastId = `ann_rmatt_${Date.now()}`;
    addUploadToast?.({ id: toastId, title: "Removing attachment", message: "Removing...", status: "loading", progress: 30 });
    try {
      await removeAnnouncementAttachment(announcementId, attachmentId);
      updateUploadToast?.(toastId, { status: "success", progress: 100, message: "Removed" });
      setTimeout(() => removeUploadToast?.(toastId), 2000);
      const full = await getAnnouncementById(announcementId);
      setViewing(full);
      await load();
    } catch (e) {
      logErr("removeAttachment", e, { announcementId, attachmentId });
      updateUploadToast?.(toastId, { status: "error", message: e instanceof Error ? e.message : "Failed" });
      setTimeout(() => removeUploadToast?.(toastId), 3500);
      toast.error("Failed to remove attachment", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const openReadDashboard = async () => {
    setShowReadDashboard(true);
    setReadDashboardLoading(true);
    const toastId = `ann_rdash_${Date.now()}`;
    addUploadToast?.({ id: toastId, title: "Loading dashboard", message: "Fetching analytics...", status: "loading", progress: 20 });
    try {
      const dashboard = await getAnnouncementReadDashboard();
      setReadDashboard(dashboard);
      updateUploadToast?.(toastId, { status: "success", progress: 100, message: "Loaded" });
      setTimeout(() => removeUploadToast?.(toastId), 1500);
    } catch (e) {
      logErr("openReadDashboard", e);
      updateUploadToast?.(toastId, { status: "error", message: e instanceof Error ? e.message : "Failed" });
      setTimeout(() => removeUploadToast?.(toastId), 3500);
      toast.error("Failed to load read dashboard", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setReadDashboardLoading(false);
    }
  };

  const sendNow = async (mode: "all" | "specific") => {
    if (!viewing || isSending) return;
    const ids = Object.keys(selectedTargets).filter((k) => selectedTargets[k]);
    if (mode === "specific" && ids.length === 0) return toast.error("Select at least one recipient");

    const toastId = `ann_send_${Date.now()}`;
    const label =
      deliveryChannel === "email" ? "Sending emails..." : "Publishing in app only...";
    addUploadToast?.({
      id: toastId,
      title: "Sending announcement",
      message: label,
      status: "loading",
      progress: 20,
    });
    setIsSending(true);
    try {
      const summary = await sendAnnouncement({
        announcementId: viewing.announcementId,
        mode,
        deliveryChannel,
        recipientIds: mode === "specific" ? ids : undefined,
      });
      updateUploadToast?.(toastId, {
        status: "success",
        progress: 100,
        message: `Sent ${summary.sent}, failed ${summary.failed}, skipped ${summary.skipped}`,
      });
      setTimeout(() => removeUploadToast?.(toastId), 3200);
      const full = await getAnnouncementById(viewing.announcementId);
      setViewing(full);
      setLogs(await getAnnouncementSendLogs(viewing.announcementId));
      await load();
    } catch (e) {
      logErr("sendNow", e, {
        announcementId: viewing.announcementId,
        mode,
        deliveryChannel,
        selectedCount: ids.length,
      });
      updateUploadToast?.(toastId, {
        status: "error",
        message: e instanceof Error ? e.message : "Send failed",
      });
      setTimeout(() => removeUploadToast?.(toastId), 4200);
      toast.error("Send failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setIsSending(false);
    }
  };

  /* ───── Recipient smart-search handlers ───── */

  const handleRecipientInput = (value: string) => {
    setRecipientSearchQuery(value);
    setShowRecipientDropdown(true);
    if (value.startsWith("@") && !activeCommand) return;
    if (activeCommand) setCommandSearchQuery(value);
  };

  const handleSelectCommand = (cmd: RecipientSearchCommand) => {
    setActiveCommand(cmd);
    setRecipientSearchQuery("");
    setCommandSearchQuery("");
    setShowRecipientDropdown(true);

    if (cmd === "@All") {
      setRecipientChips([{ id: "all", label: "All Members", type: "all" }]);
      setActiveCommand(null);
      setShowRecipientDropdown(false);
    } else if (cmd === "@Heads") {
      setRecipientChips([{ id: "heads", label: "All Heads", type: "heads" }]);
      setActiveCommand(null);
      setShowRecipientDropdown(false);
    }
    // @Person, @Committee, @External stay open for search / input
  };

  /** Add a member from local directory to chips */
  const handleAddMemberChip = (member: MemberWithEmail) => {
    const chipId = member.username || member.email;
    const exists = recipientChips.some((c) => c.id === chipId);
    if (exists) {
      toast.info(`${member.name} is already selected`, { duration: 2000 });
      return;
    }
    const newChips = recipientChips.filter((c) => c.type !== "all" && c.type !== "heads");
    newChips.push({
      id: chipId,
      label: member.name,
      type: "person",
    });
    setRecipientChips(newChips);
    setCommandSearchQuery("");
    setRecipientSearchQuery("");
    toast.success(`Added: ${member.name}`, { duration: 1500 });
  };

  /** Add a committee from locally-derived list */
  const handleAddCommitteeChip = (committee: { id: string; label: string }) => {
    const exists = recipientChips.some((c) => c.id === committee.id && c.type === "committee");
    if (exists) {
      toast.info(`${committee.label} is already selected`, { duration: 2000 });
      return;
    }
    const newChips = recipientChips.filter((c) => c.type !== "all" && c.type !== "heads");
    newChips.push({
      id: committee.id,
      label: committee.label,
      type: "committee",
    });
    setRecipientChips(newChips);
    setCommandSearchQuery("");
    setRecipientSearchQuery("");
    toast.success(`Added: ${committee.label}`, { duration: 1500 });
  };

  /** Add an external recipient with name + email */
  const handleAddExternalRecipient = () => {
    if (!externalName.trim() || !externalEmail.trim()) {
      toast.error("Please enter both name and email");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(externalEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }
    const exists = recipientChips.some(
      (c) => c.id === externalEmail.trim().toLowerCase()
    );
    if (exists) {
      toast.info("A recipient with this email is already added", { duration: 2000 });
      return;
    }
    const newChips = recipientChips.filter((c) => c.type !== "all" && c.type !== "heads");
    newChips.push({
      id: externalEmail.trim().toLowerCase(),
      label: `${externalName.trim()} (${externalEmail.trim()})`,
      type: "external",
    });
    setRecipientChips(newChips);
    setExternalName("");
    setExternalEmail("");
    toast.success(`Added external: ${externalName.trim()}`, { duration: 1500 });
  };

  const handleRemoveRecipientChip = (id: string) => {
    setRecipientChips((prev) => prev.filter((c) => c.id !== id));
  };

  const handleRecipientKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setShowRecipientDropdown(false);
      setActiveCommand(null);
    } else if (
      e.key === "Backspace" &&
      !recipientSearchQuery &&
      !commandSearchQuery &&
      !activeCommand
    ) {
      setRecipientChips((prev) => prev.slice(0, -1));
    }
  };

  /* ═══════════════════════ RENDER ═══════════════════════ */

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
      {/* ═══════════════════ LIST VIEW (Sent announcements) ═══════════════════ */}
      {!showReadDashboard && (
        <>
          {/* Row 1: Search | Refresh */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 min-w-0">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search announcements..."
                isDark={isDark}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={() => void load()}
              aria-label="Refresh"
            />
          </div>

          {/* Row 2: Category | Filter | Dashboard */}
          <div className="flex items-center gap-2 mb-4">
            <div className="w-full sm:max-w-xs">
              <CustomDropdown
                value={category}
                onChange={setCategory}
                options={categoryOptions}
                isDark={isDark}
                size="md"
              />
            </div>
            <div className="flex items-center gap-2 ml-auto shrink-0">
              <Button
                variant="ghost"
                size="sm"
                icon={<Filter className="w-4 h-4" />}
                onClick={() => setShowFilters((v) => !v)}
                aria-label="Toggle filters"
              />
              {permissions.canViewReadDashboard && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<BarChart3 className="w-4 h-4" />}
                  onClick={() => void openReadDashboard()}
                >
                  Dashboard
                </Button>
              )}
            </div>
          </div>

          {/* Filter bar */}
          {showFilters && (
            <div
              className="mb-4 p-3 rounded-xl flex flex-wrap gap-3 items-center"
              style={{
                ...cardStyle(isDark),
              }}
            >
              {/* Pinned filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium" style={{ opacity: 0.6 }}>Pinned:</span>
                {(["all", "pinned", "unpinned"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setFilterShowPinned(v)}
                    className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                    style={{
                      background: filterShowPinned === v
                        ? DESIGN_TOKENS.colors.brand.orange + "20"
                        : isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                      color: filterShowPinned === v ? DESIGN_TOKENS.colors.brand.orange : undefined,
                      border: `1px solid ${filterShowPinned === v ? DESIGN_TOKENS.colors.brand.orange + "50" : "transparent"}`,
                    }}
                  >
                    {v === "all" ? "All" : v === "pinned" ? <><Pin className="w-3 h-3 inline mr-0.5" />Pinned</> : <><PinOff className="w-3 h-3 inline mr-0.5" />Unpinned</>}
                  </button>
                ))}
              </div>
              {/* Read filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium" style={{ opacity: 0.6 }}>Read:</span>
                {(["all", "read", "unread"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setFilterShowRead(v)}
                    className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                    style={{
                      background: filterShowRead === v
                        ? DESIGN_TOKENS.colors.brand.orange + "20"
                        : isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                      color: filterShowRead === v ? DESIGN_TOKENS.colors.brand.orange : undefined,
                      border: `1px solid ${filterShowRead === v ? DESIGN_TOKENS.colors.brand.orange + "50" : "transparent"}`,
                    }}
                  >
                    {v === "all" ? "All" : v === "read" ? <><Eye className="w-3 h-3 inline mr-0.5" />Read</> : <><EyeOff className="w-3 h-3 inline mr-0.5" />Unread</>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Cards list */}
          <div className="space-y-4">
            {loading ? (
              <>
                <AnnouncementCardSkeleton isDark={isDark} />
                <AnnouncementCardSkeleton isDark={isDark} />
                <AnnouncementCardSkeleton isDark={isDark} />
              </>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <Bell
                  className="w-16 h-16 mx-auto mb-4"
                  style={{ color: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.2)" }}
                />
                <p
                  style={{
                    fontSize: DESIGN_TOKENS.typography.fontSize.body,
                    color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)",
                  }}
                >
                  No announcements found
                </p>
              </div>
            ) : (
              filtered.map((item) => (
                <div
                  key={item.announcementId}
                  role="button"
                  tabIndex={0}
                  onClick={() => void openView(item.announcementId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      void openView(item.announcementId);
                    }
                  }}
                  className="p-4 sm:p-6 cursor-pointer transition-all duration-200 hover:shadow-lg focus:outline-none"
                  style={{
                    ...cardStyle(isDark),
                    outline: "2px solid transparent",
                  }}
                  onFocus={(e) => {
                    (e.currentTarget as HTMLElement).style.outline = `2px solid ${DESIGN_TOKENS.colors.brand.orange}`;
                  }}
                  onBlur={(e) => {
                    (e.currentTarget as HTMLElement).style.outline = "2px solid transparent";
                  }}
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {!readAnnouncementIds.has(item.announcementId) && (
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ background: DESIGN_TOKENS.colors.status.error }}
                            title="Unread"
                          />
                        )}
                        {item.isPinned && (
                          <Pin
                            className="w-4 h-4 shrink-0"
                            style={{ color: DESIGN_TOKENS.colors.brand.red }}
                          />
                        )}
                        <h3
                          className="font-semibold truncate"
                          style={{ fontSize: DESIGN_TOKENS.typography.fontSize.h3 }}
                        >
                          {item.title}
                        </h3>
                      </div>
                      <p
                        className="truncate mt-0.5"
                        style={{
                          fontSize: DESIGN_TOKENS.typography.fontSize.caption,
                          opacity: 0.75,
                        }}
                      >
                        {item.subtitle}
                      </p>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <StatusChip
                          status={item.priority}
                          label={item.priority.toUpperCase()}
                          customColor={
                            item.priority === "urgent"
                              ? DESIGN_TOKENS.colors.status.error
                              : item.priority === "important"
                              ? DESIGN_TOKENS.colors.brand.orange
                              : DESIGN_TOKENS.colors.status.success
                          }
                        />
                        <span
                          className="px-2.5 py-1 rounded-full text-xs font-medium"
                          style={{
                            background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
                            color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)",
                          }}
                        >
                          {item.category}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="line-clamp-3 whitespace-pre-line" style={{ fontSize: DESIGN_TOKENS.typography.fontSize.caption }}>
                    {item.body}
                  </p>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* ═══════════════════ MANAGER DASHBOARD ═══════════════════ */}
      {showReadDashboard && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="secondary"
              size="md"
              icon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => setShowReadDashboard(false)}
            >
              Back
            </Button>
            {permissions.canManage && (
              <Button
                variant="primary"
                size="md"
                icon={<Plus className="w-4 h-4" />}
                onClick={openCreate}
              >
                New
              </Button>
            )}
          </div>

          {readDashboardLoading ? (
            <ReadDashboardSkeleton isDark={isDark} />
          ) : (
          <>
          {/* ─── Analytics Summary Cards ─── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Sent", value: analytics.totalSent, color: DESIGN_TOKENS.colors.status.success, icon: Send },
              { label: "Drafts", value: analytics.totalDrafts, color: "#3b82f6", icon: Edit2 },
              { label: "Archived", value: analytics.totalArchived, color: "#6b7280", icon: Archive },
              { label: "Total Reads", value: analytics.totalRead, color: DESIGN_TOKENS.colors.brand.orange, icon: Eye },
            ].map((stat) => (
              <div
                key={stat.label}
                className="p-4 rounded-xl flex items-center gap-3"
                style={{
                  ...cardStyle(isDark),
                }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: stat.color + "15" }}
                >
                  <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
                </div>
                <div>
                  <div className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
                  <div className="text-xs" style={{ opacity: 0.6 }}>{stat.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ─── Category & Priority Breakdown ─── */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Category breakdown */}
            <div className="p-4 rounded-xl" style={cardStyle(isDark)}>
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
                Sent by Category
              </h3>
              {Object.entries(analytics.categoryBreakdown).length === 0 ? (
                <div className="text-xs" style={{ opacity: 0.5 }}>No sent announcements yet</div>
              ) : (
                <div className="space-y-2">
                  {Object.entries(analytics.categoryBreakdown).sort((a, b) => b[1] - a[1]).map(([cat, count]) => {
                    const pct = analytics.totalSent > 0 ? Math.round((count / analytics.totalSent) * 100) : 0;
                    return (
                      <div key={cat}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium">{cat}</span>
                          <span style={{ opacity: 0.6 }}>{count} ({pct}%)</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: DESIGN_TOKENS.colors.brand.orange }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {/* Priority breakdown */}
            <div className="p-4 rounded-xl" style={cardStyle(isDark)}>
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" style={{ color: "#8b5cf6" }} />
                Sent by Priority
              </h3>
              <div className="space-y-2">
                {[
                  { key: "urgent", label: "Urgent", color: DESIGN_TOKENS.colors.status.error },
                  { key: "important", label: "Important", color: DESIGN_TOKENS.colors.brand.orange },
                  { key: "normal", label: "Normal", color: DESIGN_TOKENS.colors.status.success },
                ].map((p) => {
                  const count = analytics.priorityBreakdown[p.key] || 0;
                  const pct = analytics.totalSent > 0 ? Math.round((count / analytics.totalSent) * 100) : 0;
                  return (
                    <div key={p.key}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium" style={{ color: p.color }}>{p.label}</span>
                        <span style={{ opacity: 0.6 }}>{count} ({pct}%)</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: p.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 pt-3 text-xs flex items-center gap-2" style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`, opacity: 0.6 }}>
                <Eye className="w-3.5 h-3.5" />
                Avg reads per announcement: <strong>{analytics.avgRead}</strong>
              </div>
            </div>
          </div>

          {/* ─── Draft / Archived Tabs ─── */}
          <div className="flex items-center gap-2">
            {(["drafts", "archived"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setDashboardTab(tab)}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: dashboardTab === tab
                    ? DESIGN_TOKENS.colors.brand.orange + "20"
                    : isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                  color: dashboardTab === tab ? DESIGN_TOKENS.colors.brand.orange : undefined,
                  border: `1px solid ${dashboardTab === tab ? DESIGN_TOKENS.colors.brand.orange + "50" : "transparent"}`,
                }}
              >
                {tab === "drafts" ? `Drafts (${draftItems.length})` : `Archived (${archivedItems.length})`}
              </button>
            ))}
          </div>

          {/* Draft / Archived list */}
          <div className="space-y-3">
            {dashboardItems.length === 0 ? (
              <div className="text-center py-8 text-sm" style={{ opacity: 0.5 }}>
                No {dashboardTab} announcements.
              </div>
            ) : (
              dashboardItems.map((item) => (
                <div
                  key={item.announcementId}
                  role="button"
                  tabIndex={0}
                  onClick={() => void openView(item.announcementId, "dashboard")}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); void openView(item.announcementId, "dashboard"); } }}
                  className="p-4 cursor-pointer transition-all duration-200 hover:shadow-lg focus:outline-none"
                  style={cardStyle(isDark)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {item.isPinned && <Pin className="w-3.5 h-3.5 shrink-0" style={{ color: DESIGN_TOKENS.colors.brand.red }} />}
                        <h4 className="font-semibold truncate text-sm">{item.title}</h4>
                      </div>
                      <p className="text-xs truncate" style={{ opacity: 0.6 }}>{item.subtitle}</p>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <StatusChip
                          status={item.status}
                          label={item.status}
                          customColor={item.status === "Draft" ? "#3b82f6" : "#6b7280"}
                        />
                        <span className="px-2 py-0.5 rounded-full text-xs" style={{
                          background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                          opacity: 0.7,
                        }}>{item.category}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" icon={<Edit2 className="w-4 h-4" />} onClick={() => openEdit(item)} aria-label="Edit" />
                      <Button variant="ghost" size="sm" icon={<Trash2 className="w-4 h-4" />} onClick={() => void handleDelete(item.announcementId, item.title)} aria-label="Delete" />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ─── Read Receipts Section ─── */}
          <div>
            <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
              <Eye className="w-5 h-5" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
              Read Receipts
            </h3>
          <div
            className="p-5"
            style={{
              ...cardStyle(isDark),
            }}
          >
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block mb-2 text-sm font-semibold">Smart Search</label>
                <SearchInput
                  value={readDashboardQuery}
                  onChange={setReadDashboardQuery}
                  placeholder="Search announcement title..."
                  isDark={isDark}
                />
              </div>
              <div>
                <label className="block mb-2 text-sm font-semibold">Status</label>
                <CustomDropdown
                  value={readDashboardStatus}
                  onChange={setReadDashboardStatus}
                  options={["All", "Draft", "Sent", "Archived"]}
                  isDark={isDark}
                  size="md"
                />
              </div>
              <div
                className="rounded-xl p-3 flex items-center justify-between"
                style={{
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                }}
              >
                <span className="text-sm" style={{ opacity: 0.75 }}>
                  Showing
                </span>
                <span
                  className="text-xl font-bold"
                  style={{ color: DESIGN_TOKENS.colors.brand.red }}
                >
                  {filteredReadDashboard.length}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4 mt-4">
            {filteredReadDashboard.length === 0 ? (
              <div className="text-sm" style={{ opacity: 0.7 }}>
                No data yet.
              </div>
            ) : (
              filteredReadDashboard.map((row) => (
                <div
                  key={row.announcementId}
                  className="p-4"
                  style={cardStyle(isDark)}
                >
                  <div className="flex items-center justify-between mb-2 gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{row.title}</div>
                      <div className="text-sm truncate" style={{ opacity: 0.75 }}>
                        {row.subtitle}
                      </div>
                    </div>
                    <div className="text-sm font-medium shrink-0 flex items-center gap-1.5">
                      <Eye className="w-4 h-4" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
                      {row.readCount}
                    </div>
                  </div>
                  <div
                    className="overflow-y-auto rounded-lg"
                    style={{
                      maxHeight: "clamp(120px, 25vh, 200px)",
                      border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                    }}
                  >
                    {row.readers.length === 0 ? (
                      <div className="p-2 text-xs" style={{ opacity: 0.7 }}>
                        No readers yet.
                      </div>
                    ) : (
                      row.readers.map((r) => (
                        <div
                          key={r.readId}
                          className="px-3 py-2 text-xs flex items-center justify-between"
                          style={{
                            borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
                          }}
                        >
                          <div>
                            {r.fullName || r.username} ({r.username})
                          </div>
                          <div style={{ opacity: 0.7 }}>
                            {new Date(r.readAt).toLocaleString()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          </div>
          </>
          )}
        </div>
      )}

      {/* ═══════════════════ EDITOR MODAL ═══════════════════ */}
      {showEditor && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            style={modalOverlayStyle()}
            onClick={() => setShowEditor(false)}
          />
          <div
            className="fixed inset-0 flex items-center justify-center p-4"
            style={{ zIndex: 9999992 }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={editing ? "Edit Announcement" : "Create Announcement"}
              className="w-full max-h-[90vh] flex flex-col"
              style={modalContentStyle(isDark)}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                className="px-6 py-4 flex items-center justify-between shrink-0"
                style={{
                  borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                }}
              >
                <h2
                  className="font-semibold"
                  style={{ fontSize: DESIGN_TOKENS.typography.fontSize.h2 }}
                >
                  {editing ? "Edit" : "Create"} Announcement
                </h2>
                <button
                  onClick={() => setShowEditor(false)}
                  aria-label="Close editor"
                  className="p-2 rounded-lg transition-colors"
                  style={{
                    background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                  }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-4 overflow-y-auto space-y-4 flex-1">
                {/* Title */}
                <div>
                  <label className="block mb-1.5 text-sm font-medium">Title</label>
                  <input
                    className="w-full px-4 border transition-colors focus:outline-none focus:ring-2"
                    style={inputStyle(isDark)}
                    placeholder="Enter announcement title"
                    value={form.title}
                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  />
                </div>

                {/* Subtitle */}
                <div>
                  <label className="block mb-1.5 text-sm font-medium">Subtitle</label>
                  <input
                    className="w-full px-4 border transition-colors focus:outline-none focus:ring-2"
                    style={inputStyle(isDark)}
                    placeholder="Short description or context"
                    value={form.subtitle}
                    onChange={(e) => setForm((p) => ({ ...p, subtitle: e.target.value }))}
                  />
                </div>

                {/* Body */}
                <div>
                  <label className="block mb-1.5 text-sm font-medium">Body</label>
                  <textarea
                    className="w-full px-4 py-3 border min-h-[140px] transition-colors focus:outline-none focus:ring-2"
                    style={textareaStyle(isDark)}
                    placeholder="Full announcement content"
                    value={form.body}
                    onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
                  />
                </div>

                {/* Dropdowns row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block mb-1.5 text-sm font-medium">Priority</label>
                    <CustomDropdown
                      value={form.priority}
                      onChange={(v) =>
                        setForm((p) => ({ ...p, priority: v as AnnouncementPriority }))
                      }
                      options={["normal", "important", "urgent"]}
                      isDark={isDark}
                      size="md"
                    />
                  </div>
                  <div>
                    <label className="block mb-1.5 text-sm font-medium">Category</label>
                    <CustomDropdown
                      value={form.category}
                      onChange={(v) => setForm((p) => ({ ...p, category: v }))}
                      options={CATEGORY_OPTIONS}
                      isDark={isDark}
                      size="md"
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="inline-flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg transition-colors"
                      style={{
                        height: DESIGN_TOKENS.interactive.input.height,
                        background: form.isPinned
                          ? (isDark ? "rgba(246,66,31,0.2)" : "rgba(246,66,31,0.1)")
                          : (isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)"),
                        border: `1px solid ${form.isPinned ? DESIGN_TOKENS.colors.brand.red + "60" : (isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)")}`,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={form.isPinned}
                        onChange={(e) => setForm((p) => ({ ...p, isPinned: e.target.checked }))}
                        className="sr-only"
                      />
                      <Pin
                        className="w-4 h-4"
                        style={{
                          color: form.isPinned
                            ? DESIGN_TOKENS.colors.brand.red
                            : isDark
                            ? "rgba(255,255,255,0.4)"
                            : "rgba(0,0,0,0.3)",
                        }}
                      />
                      <span className="text-sm font-medium">
                        {form.isPinned ? "Pinned" : "Pin"}
                      </span>
                    </label>
                  </div>
                  {/* Hide Author toggle */}
                  <div className="flex items-end">
                    <label className="inline-flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg transition-colors"
                      style={{
                        height: DESIGN_TOKENS.interactive.input.height,
                        background: hideAuthor
                          ? (isDark ? "rgba(238,135,36,0.2)" : "rgba(238,135,36,0.1)")
                          : (isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)"),
                        border: `1px solid ${hideAuthor ? DESIGN_TOKENS.colors.brand.orange + "60" : (isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)")}`,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={hideAuthor}
                        onChange={(e) => setHideAuthor(e.target.checked)}
                        className="sr-only"
                      />
                      {hideAuthor ? (
                        <EyeOff className="w-4 h-4" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
                      ) : (
                        <Eye className="w-4 h-4" style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)" }} />
                      )}
                      <span className="text-sm font-medium">
                        {hideAuthor ? "Author Hidden" : "Show Author"}
                      </span>
                    </label>
                  </div>
                </div>

                {/* ═══ RECIPIENT SMART SEARCH (Issuance-style) ═══ */}
                <div>
                  <label className="block mb-1.5 text-sm font-medium">Recipients</label>

                  {/* Selected chips */}
                  {recipientChips.length > 0 && (
                    <div className="mb-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs" style={{ color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)" }}>
                          {recipientChips.length} recipient{recipientChips.length !== 1 ? "s" : ""} selected
                        </span>
                        <div className="flex items-center gap-2">
                          {recipientChips.length > 8 && (
                            <button
                              onClick={() => setShowAllChips(!showAllChips)}
                              className="text-xs font-medium"
                              style={{ color: "#3b82f6" }}
                            >
                              {showAllChips ? "Show less" : `Show all ${recipientChips.length}`}
                            </button>
                          )}
                          <button
                            onClick={() => { setRecipientChips([]); setShowAllChips(false); }}
                            className="text-xs"
                            style={{ color: DESIGN_TOKENS.colors.status.error }}
                          >
                            Clear all
                          </button>
                        </div>
                      </div>
                      <div
                        className={`flex flex-wrap gap-2 p-2 rounded-lg overflow-hidden transition-all ${showAllChips ? "overflow-y-auto" : ""}`}
                        style={{ maxHeight: showAllChips ? "clamp(100px, 20vh, 192px)" : "4rem", background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.02)" }}
                      >
                        {(showAllChips ? recipientChips : recipientChips.slice(0, 8)).map((chip) => {
                          const chipCmd = RECIPIENT_COMMANDS.find(
                            (c) => c.recipientType.toLowerCase() === chip.type || c.command?.toLowerCase().replace("@", "") === chip.type
                          );
                          const chipColor = chipCmd?.color || DESIGN_TOKENS.colors.brand.orange;
                          return (
                            <div
                              key={chip.id}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
                              style={{
                                background: isDark ? `${chipColor}20` : `${chipColor}10`,
                                border: `1px solid ${chipColor}40`,
                              }}
                            >
                              <span className="font-medium" style={{ color: chipColor }}>
                                {chip.label}
                              </span>
                              <button
                                onClick={() => handleRemoveRecipientChip(chip.id)}
                                className="p-0.5 rounded-full hover:opacity-70"
                              >
                                <X className="w-3 h-3" style={{ color: DESIGN_TOKENS.colors.status.error }} />
                              </button>
                            </div>
                          );
                        })}
                        {!showAllChips && recipientChips.length > 8 && (
                          <div
                            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer hover:opacity-80"
                            style={{ background: isDark ? "rgba(100,100,100,0.3)" : "rgba(0,0,0,0.1)" }}
                            onClick={() => setShowAllChips(true)}
                          >
                            +{recipientChips.length - 8} more
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Search input with command system */}
                  <div className="relative" ref={recipientSearchRef}>
                    <div className="relative">
                      {activeCommand ? (
                        (() => {
                          const cmd = RECIPIENT_COMMANDS.find((c) => c.command === activeCommand);
                          return cmd ? (
                            <cmd.icon
                              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
                              style={{ color: cmd.color }}
                            />
                          ) : null;
                        })()
                      ) : (
                        <Search
                          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
                          style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)" }}
                        />
                      )}
                      <input
                        type="text"
                        value={activeCommand ? commandSearchQuery : recipientSearchQuery}
                        onChange={(e) => handleRecipientInput(e.target.value)}
                        onFocus={() => setShowRecipientDropdown(true)}
                        onKeyDown={handleRecipientKeyDown}
                        placeholder={
                          activeCommand === "@Person"
                            ? "Search by name or email..."
                            : activeCommand === "@Committee"
                            ? "Search committees..."
                            : activeCommand === "@External"
                            ? "Use the form below to add..."
                            : "Type @ to see commands, or search..."
                        }
                        className="w-full py-3 pl-12 pr-4 border-2 transition-all focus:outline-none"
                        style={{
                          borderRadius: DESIGN_TOKENS.radius.input + 4,
                          background: activeCommand
                            ? isDark
                              ? `${RECIPIENT_COMMANDS.find((c) => c.command === activeCommand)?.color || "#3b82f6"}15`
                              : `${RECIPIENT_COMMANDS.find((c) => c.command === activeCommand)?.color || "#3b82f6"}08`
                            : isDark
                            ? "rgba(30,41,59,0.8)"
                            : "rgba(255,255,255,0.9)",
                          borderColor: activeCommand
                            ? `${RECIPIENT_COMMANDS.find((c) => c.command === activeCommand)?.color || "#3b82f6"}50`
                            : isDark
                            ? "rgba(255,255,255,0.1)"
                            : "rgba(0,0,0,0.1)",
                          color: isDark ? "#fff" : "#000",
                        }}
                      />
                      {activeCommand && (
                        <button
                          onClick={() => {
                            setActiveCommand(null);
                            setCommandSearchQuery("");
                            setRecipientSearchQuery("");
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:opacity-70"
                          aria-label="Clear command"
                        >
                          <X className="w-4 h-4" style={{ color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)" }} />
                        </button>
                      )}
                    </div>

                    {/* Dropdown */}
                    {showRecipientDropdown && (
                      <div
                        className="absolute top-full left-0 right-0 mt-1 rounded-xl shadow-xl overflow-y-auto"
                        style={{
                          maxHeight: "clamp(160px, 35vh, 320px)",
                          background: isDark ? "rgba(17,24,39,0.98)" : "rgba(255,255,255,0.98)",
                          border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                          zIndex: 9999999,
                        }}
                      >
                        {/* Command suggestions when typing @ */}
                        {!activeCommand && commandSuggestions.length > 0 && (
                          <div>
                            <div className="px-3 py-2 text-xs font-semibold" style={{ opacity: 0.5 }}>
                              Commands
                            </div>
                            {commandSuggestions.map((cmd) => (
                              <button
                                key={cmd.command}
                                className="w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors"
                                style={{
                                  background: "transparent",
                                }}
                                onMouseEnter={(e) => {
                                  (e.currentTarget as HTMLElement).style.background = isDark
                                    ? "rgba(255,255,255,0.05)"
                                    : "rgba(0,0,0,0.03)";
                                }}
                                onMouseLeave={(e) => {
                                  (e.currentTarget as HTMLElement).style.background = "transparent";
                                }}
                                onClick={() => handleSelectCommand(cmd.command)}
                              >
                                <cmd.icon className="w-5 h-5 shrink-0" style={{ color: cmd.color }} />
                                <div>
                                  <div className="font-medium text-sm">{cmd.command}</div>
                                  <div className="text-xs" style={{ opacity: 0.6 }}>
                                    {cmd.label}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Empty hint when no command and no @ typed */}
                        {!activeCommand && commandSuggestions.length === 0 && !recipientSearchQuery && (
                          <div className="p-4">
                            <div className="text-xs mb-3" style={{ opacity: 0.6 }}>
                              Type <span className="font-mono font-bold">@</span> to see commands, or use quick actions:
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {RECIPIENT_COMMANDS.map((cmd) => (
                                <button
                                  key={cmd.command}
                                  onClick={() => handleSelectCommand(cmd.command)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-opacity hover:opacity-80"
                                  style={{
                                    background: isDark ? `${cmd.color}20` : `${cmd.color}10`,
                                    color: cmd.color,
                                    border: `1px solid ${cmd.color}30`,
                                  }}
                                >
                                  <cmd.icon className="w-3.5 h-3.5" />
                                  {cmd.command}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* ─── @Person loading / error / results ─── */}
                        {activeCommand === "@Person" && isLoadingMembers && (
                          <div className="p-6 text-center">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" style={{ color: "#3b82f6" }} />
                            <p className="text-sm" style={{ opacity: 0.6 }}>Loading members...</p>
                          </div>
                        )}
                        {activeCommand === "@Person" && !isLoadingMembers && membersError && (
                          <div className="p-4 text-center">
                            <p className="text-sm mb-2" style={{ color: DESIGN_TOKENS.colors.status.error }}>{membersError}</p>
                            <button
                              onClick={() => void loadMembers(true)}
                              className="text-sm px-3 py-1.5 rounded-md transition-colors"
                              style={{
                                background: isDark ? "rgba(59,130,246,0.2)" : "rgba(59,130,246,0.1)",
                                color: "#3b82f6",
                              }}
                            >
                              Retry Loading Members
                            </button>
                          </div>
                        )}
                        {activeCommand === "@Person" && !isLoadingMembers && !membersError && members.length === 0 && (
                          <div className="p-4 text-center">
                            <p className="text-sm mb-2" style={{ opacity: 0.6 }}>No members loaded yet.</p>
                            <button
                              onClick={() => void loadMembers(true)}
                              className="text-sm px-3 py-1.5 rounded-md transition-colors"
                              style={{
                                background: isDark ? "rgba(59,130,246,0.2)" : "rgba(59,130,246,0.1)",
                                color: "#3b82f6",
                              }}
                            >
                              Load Members
                            </button>
                          </div>
                        )}
                        {activeCommand === "@Person" && !isLoadingMembers && (localRecipientSuggestions as MemberWithEmail[]).length > 0 && (
                          <>
                            <div
                              className="px-3 py-2 text-xs font-semibold"
                              style={{
                                opacity: 0.5,
                                borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                              }}
                            >
                              Members ({members.length} total)
                            </div>
                            {(localRecipientSuggestions as MemberWithEmail[]).map((member) => {
                              const isSelected = recipientChips.some(
                                (c) => (c.id === (member.username || member.email)) && c.type === "person"
                              );
                              return (
                                <button
                                  key={member.id}
                                  className="w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors"
                                  style={{
                                    background: isSelected
                                      ? isDark
                                        ? "rgba(238,135,36,0.1)"
                                        : "rgba(238,135,36,0.05)"
                                      : "transparent",
                                    opacity: isSelected ? 0.7 : 1,
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isSelected) {
                                      (e.currentTarget as HTMLElement).style.background = isDark
                                        ? "rgba(255,255,255,0.05)"
                                        : "rgba(0,0,0,0.03)";
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    (e.currentTarget as HTMLElement).style.background = isSelected
                                      ? isDark
                                        ? "rgba(238,135,36,0.1)"
                                        : "rgba(238,135,36,0.05)"
                                      : "transparent";
                                  }}
                                  onClick={() => handleAddMemberChip(member)}
                                  disabled={!member.email}
                                >
                                  {/* Profile Picture with Fallback */}
                                  <div className="relative w-8 h-8 shrink-0">
                                    {member.profilePicture ? (
                                      <>
                                        <img
                                          src={member.profilePicture}
                                          alt={member.name}
                                          className="w-8 h-8 rounded-full object-cover absolute inset-0"
                                          onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = "none";
                                          }}
                                        />
                                        <div
                                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                          style={{ background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)" }}
                                        >
                                          {getInitials(member.name)}
                                        </div>
                                      </>
                                    ) : (
                                      <div
                                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                        style={{ background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)" }}
                                      >
                                        {getInitials(member.name)}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm truncate">{member.name}</div>
                                    <div className="text-xs truncate" style={{ opacity: 0.6 }}>
                                      {member.email || "No email"}{member.committee ? ` · ${member.committee}` : ""}
                                    </div>
                                  </div>
                                  {isSelected && (
                                    <CheckCircle className="w-4 h-4 shrink-0" style={{ color: "#22c55e" }} />
                                  )}
                                </button>
                              );
                            })}
                          </>
                        )}
                        {/* No results for @Person search */}
                        {activeCommand === "@Person" && !isLoadingMembers && !membersError && members.length > 0 && (localRecipientSuggestions as MemberWithEmail[]).length === 0 && commandSearchQuery && (
                          <div className="p-4 text-center text-sm" style={{ opacity: 0.5 }}>
                            No results found for &ldquo;{commandSearchQuery}&rdquo;
                          </div>
                        )}

                        {/* ─── @Committee results ─── */}
                        {activeCommand === "@Committee" && isLoadingMembers && (
                          <div className="p-6 text-center">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" style={{ color: "#10b981" }} />
                            <p className="text-sm" style={{ opacity: 0.6 }}>Loading committees...</p>
                          </div>
                        )}
                        {activeCommand === "@Committee" && !isLoadingMembers && (localRecipientSuggestions as { id: string; label: string; subtitle?: string }[]).length > 0 && (
                          <>
                            <div
                              className="px-3 py-2 text-xs font-semibold"
                              style={{
                                opacity: 0.5,
                                borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                              }}
                            >
                              Committees
                            </div>
                            {(localRecipientSuggestions as { id: string; label: string; type: string; subtitle?: string }[]).map((c) => {
                              const isSelected = recipientChips.some(
                                (ch) => ch.id === c.id && ch.type === "committee"
                              );
                              return (
                                <button
                                  key={c.id}
                                  className="w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors"
                                  style={{
                                    background: isSelected
                                      ? isDark
                                        ? "rgba(238,135,36,0.1)"
                                        : "rgba(238,135,36,0.05)"
                                      : "transparent",
                                    opacity: isSelected ? 0.7 : 1,
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isSelected) {
                                      (e.currentTarget as HTMLElement).style.background = isDark
                                        ? "rgba(255,255,255,0.05)"
                                        : "rgba(0,0,0,0.03)";
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    (e.currentTarget as HTMLElement).style.background = isSelected
                                      ? isDark
                                        ? "rgba(238,135,36,0.1)"
                                        : "rgba(238,135,36,0.05)"
                                      : "transparent";
                                  }}
                                  onClick={() => handleAddCommitteeChip(c)}
                                >
                                  <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                                    style={{
                                      background: isDark ? "rgba(16,185,129,0.2)" : "rgba(16,185,129,0.1)",
                                      color: "#10b981",
                                    }}
                                  >
                                    <Building className="w-4 h-4" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm truncate">{c.label}</div>
                                    {c.subtitle && (
                                      <div className="text-xs truncate" style={{ opacity: 0.6 }}>
                                        {c.subtitle}
                                      </div>
                                    )}
                                  </div>
                                  {isSelected && (
                                    <CheckCircle className="w-4 h-4 shrink-0" style={{ color: "#22c55e" }} />
                                  )}
                                </button>
                              );
                            })}
                          </>
                        )}
                        {activeCommand === "@Committee" && !isLoadingMembers && (localRecipientSuggestions as unknown[]).length === 0 && commandSearchQuery && (
                          <div className="p-4 text-center text-sm" style={{ opacity: 0.5 }}>
                            No committees found for &ldquo;{commandSearchQuery}&rdquo;
                          </div>
                        )}
                        {activeCommand === "@Committee" && !isLoadingMembers && members.length === 0 && !commandSearchQuery && (
                          <div className="p-4 text-center">
                            <p className="text-sm mb-2" style={{ opacity: 0.6 }}>No members loaded yet.</p>
                            <button
                              onClick={() => void loadMembers(true)}
                              className="text-sm px-3 py-1.5 rounded-md transition-colors"
                              style={{
                                background: isDark ? "rgba(16,185,129,0.2)" : "rgba(16,185,129,0.1)",
                                color: "#10b981",
                              }}
                            >
                              Load Members
                            </button>
                          </div>
                        )}

                        {/* ─── @External form ─── */}
                        {activeCommand === "@External" && (
                          <div className="p-4 space-y-3">
                            <div className="text-xs font-semibold mb-2" style={{ opacity: 0.5 }}>
                              Add External Recipient
                            </div>
                            <input
                              type="text"
                              value={externalName}
                              onChange={(e) => setExternalName(e.target.value)}
                              placeholder="Full Name"
                              className="w-full p-2.5 rounded-lg border transition-all focus:outline-none"
                              style={{
                                background: isDark ? "rgba(30,41,59,0.8)" : "rgba(255,255,255,0.9)",
                                borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
                                color: isDark ? "#fff" : "#000",
                              }}
                            />
                            <input
                              type="email"
                              value={externalEmail}
                              onChange={(e) => setExternalEmail(e.target.value)}
                              placeholder="email@example.com"
                              className="w-full p-2.5 rounded-lg border transition-all focus:outline-none"
                              style={{
                                background: isDark ? "rgba(30,41,59,0.8)" : "rgba(255,255,255,0.9)",
                                borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
                                color: isDark ? "#fff" : "#000",
                              }}
                            />
                            <Button
                              variant="secondary"
                              onClick={handleAddExternalRecipient}
                              icon={<Globe className="w-4 h-4" />}
                              fullWidth
                              disabled={!externalName.trim() || !externalEmail.trim()}
                            >
                              Add External Recipient
                            </Button>
                          </div>
                        )}

                        {/* ─── "Combine with other sources" footer ─── */}
                        {activeCommand && activeCommand !== "@External" && (
                          <div
                            className="border-t px-3 py-2"
                            style={{ borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs" style={{ opacity: 0.5 }}>
                                Combine with other sources:
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {RECIPIENT_COMMANDS.filter((c) => c.command !== activeCommand).map((cmd) => (
                                <button
                                  key={cmd.command}
                                  onClick={() => handleSelectCommand(cmd.command)}
                                  className="px-2 py-1 rounded-md text-xs font-medium transition-all hover:scale-105 flex items-center gap-1"
                                  style={{
                                    background: cmd.color + "15",
                                    color: cmd.color,
                                    border: `1px solid ${cmd.color}30`,
                                  }}
                                >
                                  <cmd.icon className="w-3 h-3" />
                                  {cmd.command!.replace("@", "")}
                                </button>
                              ))}
                            </div>
                            {recipientChips.length > 0 && (
                              <p className="text-[10px] mt-1.5" style={{ opacity: 0.4 }}>
                                Tip: Duplicates are automatically prevented
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Preview stats */}
                  <div
                    className="mt-2 text-xs flex items-center gap-3"
                    style={{ opacity: 0.6 }}
                  >
                    <span>
                      {recipientPreview.total} total
                    </span>
                    <span className="flex items-center gap-1" style={{ color: DESIGN_TOKENS.colors.status.success }}>
                      <CheckCircle className="w-3 h-3" />
                      {recipientPreview.eligible} ready
                    </span>
                    {recipientPreview.ineligible > 0 && (
                      <span className="flex items-center gap-1" style={{ color: DESIGN_TOKENS.colors.status.error }}>
                        <AlertTriangle className="w-3 h-3" />
                        {recipientPreview.ineligible} not ready
                      </span>
                    )}
                  </div>
                </div>

                {/* ═══ LINK ATTACHMENTS ═══ */}
                <div>
                  <label className="block mb-1.5 text-sm font-medium">Attachments</label>
                  {links.map((l, i) => (
                    <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                      <input
                        className="px-3 border transition-colors focus:outline-none focus:ring-2"
                        style={inputStyle(isDark)}
                        placeholder="Link label"
                        value={l.name}
                        onChange={(e) =>
                          setLinks((p) =>
                            p.map((x, idx) =>
                              idx === i ? { ...x, name: e.target.value } : x
                            )
                          )
                        }
                      />
                      <input
                        className="px-3 border transition-colors focus:outline-none focus:ring-2"
                        style={inputStyle(isDark)}
                        placeholder="https://..."
                        value={l.url}
                        onChange={(e) =>
                          setLinks((p) =>
                            p.map((x, idx) =>
                              idx === i ? { ...x, url: e.target.value } : x
                            )
                          )
                        }
                      />
                    </div>
                  ))}
                  <button
                    className="text-sm font-medium"
                    style={{ color: DESIGN_TOKENS.colors.brand.orange }}
                    onClick={() => setLinks((p) => [...p, { name: "", url: "" }])}
                  >
                    + Add Link
                  </button>

                  {/* File upload */}
                  <label
                    className="mt-2 flex items-center gap-2 px-4 cursor-pointer transition-colors"
                    style={{
                      height: DESIGN_TOKENS.interactive.input.height,
                      borderRadius: DESIGN_TOKENS.radius.input,
                      border: `1px dashed ${isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"}`,
                      background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                    }}
                  >
                    <Upload className="w-4 h-4" style={{ opacity: 0.7 }} />
                    <span className="text-sm" style={{ opacity: 0.7 }}>
                      Add files (max 10, 10MB each)
                    </span>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.txt"
                      className="hidden"
                      onChange={(e) => {
                        const f = Array.from(e.target.files || []);
                        onPickFiles(f);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>
                  {pendingFiles.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {pendingFiles.map((f, i) => (
                        <div
                          key={`${f.name}-${i}`}
                          className="flex items-center justify-between text-xs px-3 py-2 rounded-lg"
                          style={{
                            background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                          }}
                        >
                          <span className="truncate pr-2">{f.name}</span>
                          <button
                            onClick={() =>
                              setPendingFiles((p) => p.filter((_, idx) => idx !== i))
                            }
                          >
                            <X className="w-3 h-3" style={{ color: DESIGN_TOKENS.colors.status.error }} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ═══ EMAIL ENHANCEMENTS ═══ */}
                <div
                  className="p-4 space-y-4"
                  style={{
                    borderRadius: DESIGN_TOKENS.radius.card,
                    border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                    background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)",
                  }}
                >
                  <div className="text-sm font-semibold flex items-center gap-2">
                    <Calendar className="w-4 h-4" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
                    Email Enhancements (Optional)
                  </div>

                  {/* ── Date & Time ── */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold flex items-center gap-1.5" style={{ opacity: 0.8 }}>
                      <Calendar className="w-3.5 h-3.5" /> Date &amp; Time (Manila Time)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block mb-1 text-xs" style={{ opacity: 0.6 }}>From</label>
                        <input
                          type="datetime-local"
                          className="w-full px-3 border transition-colors focus:outline-none focus:ring-2"
                          style={inputStyle(isDark)}
                          value={emailOptions.eventStart}
                          onChange={(e) =>
                            setEmailOptions((p) => ({ ...p, eventStart: e.target.value }))
                          }
                        />
                      </div>
                      <div>
                        <label className="block mb-1 text-xs" style={{ opacity: 0.6 }}>To</label>
                        <input
                          type="datetime-local"
                          className="w-full px-3 border transition-colors focus:outline-none focus:ring-2"
                          style={inputStyle(isDark)}
                          value={emailOptions.eventEnd}
                          onChange={(e) =>
                            setEmailOptions((p) => ({ ...p, eventEnd: e.target.value }))
                          }
                        />
                      </div>
                    </div>
                    <div className="text-xs" style={{ opacity: 0.45 }}>
                      Times are in Manila local time (UTC+8). If set, a calendar invite (.ics) is attached to the email.
                    </div>
                  </div>

                  {/* ── Location ── */}
                  <div className="space-y-1">
                    <div className="text-xs font-semibold flex items-center gap-1.5" style={{ opacity: 0.8 }}>
                      <MapPin className="w-3.5 h-3.5" /> Location
                    </div>
                    <input
                      className="w-full px-3 border transition-colors focus:outline-none focus:ring-2"
                      style={inputStyle(isDark)}
                      placeholder="e.g. YSP Tagum Office, Zoom Meeting"
                      value={emailOptions.eventLocation}
                      onChange={(e) =>
                        setEmailOptions((p) => ({ ...p, eventLocation: e.target.value }))
                      }
                    />
                  </div>

                  {/* ── RSVP Email ── */}
                  <div className="space-y-1">
                    <div className="text-xs font-semibold flex items-center gap-1.5" style={{ opacity: 0.8 }}>
                      <Mail className="w-3.5 h-3.5" /> RSVP Email
                    </div>
                    <input
                      className="w-full px-3 border transition-colors focus:outline-none focus:ring-2"
                      style={inputStyle(isDark)}
                      placeholder="Email that receives RSVP responses"
                      value={emailOptions.rsvpEmail}
                      onChange={(e) =>
                        setEmailOptions((p) => ({ ...p, rsvpEmail: e.target.value }))
                      }
                    />
                    <div className="text-xs" style={{ opacity: 0.45 }}>
                      When set, RSVP-type buttons will send a mailto: to this email. Leave blank to disable RSVP.
                    </div>
                  </div>

                  {/* ── Legacy conditional file button ── */}
                  <div className="space-y-1">
                    <div className="text-xs font-semibold" style={{ opacity: 0.6 }}>Conditional File Button (Legacy)</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        className="px-3 border transition-colors focus:outline-none focus:ring-2"
                        style={inputStyle(isDark)}
                        placeholder="Button label (e.g. View Form)"
                        value={emailOptions.fileButtonLabel}
                        onChange={(e) =>
                          setEmailOptions((p) => ({ ...p, fileButtonLabel: e.target.value }))
                        }
                      />
                      <input
                        className="px-3 border transition-colors focus:outline-none focus:ring-2"
                        style={inputStyle(isDark)}
                        placeholder="Match file name containing..."
                        value={emailOptions.fileButtonMatch}
                        onChange={(e) =>
                          setEmailOptions((p) => ({ ...p, fileButtonMatch: e.target.value }))
                        }
                      />
                    </div>
                  </div>

                  {/* ═══════ CUSTOM BUTTONS ═══════ */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold flex items-center gap-1.5" style={{ opacity: 0.8 }}>
                        <ExternalLink className="w-3.5 h-3.5" /> Email Buttons
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<Plus size={14} />}
                        onClick={() => {
                          setEditingButtonIndex(null);
                          setShowAddButtonModal(true);
                        }}
                      >
                        Add Button
                      </Button>
                    </div>

                    {customButtons.length === 0 && (
                      <div className="text-xs py-3 text-center rounded-lg" style={{
                        opacity: 0.5,
                        border: `1px dashed ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)"}`,
                      }}>
                        No custom buttons yet. Click &quot;Add Button&quot; to create one.
                      </div>
                    )}

                    {customButtons.map((btn, idx) => {
                      const typeInfo = BUTTON_TYPE_OPTIONS.find((t) => t.value === btn.type);
                      const TypeIcon = typeInfo?.icon || Link2;
                      return (
                        <div
                          key={btn.id}
                          className="flex items-center gap-2 p-2.5 rounded-lg"
                          style={{
                            background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
                            border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
                          }}
                        >
                          <GripVertical className="w-3.5 h-3.5 shrink-0" style={{ opacity: 0.3 }} />
                          <div
                            className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                            style={{
                              background: btn.style === "primary"
                                ? DESIGN_TOKENS.colors.brand.orange + "20"
                                : isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
                            }}
                          >
                            <TypeIcon className="w-3.5 h-3.5" style={{
                              color: btn.style === "primary" ? DESIGN_TOKENS.colors.brand.orange : undefined,
                            }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{btn.label}</div>
                            <div className="text-xs truncate" style={{ opacity: 0.5 }}>
                              {btn.type === "rsvp" ? `RSVP → ${btn.rsvpEmail || emailOptions.rsvpEmail || "—"}` :
                               btn.type === "document" ? `Doc: ${btn.documentMatch || "—"}` :
                               btn.url || "—"}
                            </div>
                          </div>
                          <button
                            className="p-1 rounded transition-colors hover:bg-black/5"
                            onClick={() => {
                              setEditingButtonIndex(idx);
                              setShowAddButtonModal(true);
                            }}
                          >
                            <Edit2 className="w-3.5 h-3.5" style={{ opacity: 0.5 }} />
                          </button>
                          <button
                            className="p-1 rounded transition-colors hover:bg-black/5"
                            onClick={() =>
                              setCustomButtons((p) => p.filter((_, i) => i !== idx))
                            }
                          >
                            <Trash2 className="w-3.5 h-3.5" style={{ color: DESIGN_TOKENS.colors.status.error, opacity: 0.7 }} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ═══ ADD BUTTON MODAL ═══ */}
                {showAddButtonModal && (
                  <AddButtonModal
                    isDark={isDark}
                    existingButton={editingButtonIndex !== null ? customButtons[editingButtonIndex] : undefined}
                    rsvpEmailFallback={emailOptions.rsvpEmail}
                    onSave={(btn) => {
                      if (editingButtonIndex !== null) {
                        setCustomButtons((p) => {
                          const copy = [...p];
                          copy[editingButtonIndex] = btn;
                          return copy;
                        });
                      } else {
                        setCustomButtons((p) => [...p, btn]);
                      }
                      setShowAddButtonModal(false);
                      setEditingButtonIndex(null);
                    }}
                    onClose={() => {
                      setShowAddButtonModal(false);
                      setEditingButtonIndex(null);
                    }}
                  />
                )}
              </div>

              {/* Footer */}
              <div
                className="px-6 py-4 shrink-0 flex justify-end gap-2"
                style={{
                  borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                }}
              >
                <Button variant="secondary" size="md" onClick={() => setShowEditor(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="md" onClick={() => void save()} disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════ DETAIL MODAL ═══════════════════ */}
      {isDetailModalOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            style={modalOverlayStyle()}
            onClick={closeDetailModal}
          />
          <div
            className="fixed inset-0 flex items-center justify-center p-2 sm:p-4"
            style={{ zIndex: 9999992 }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Announcement Details"
              className={`w-full max-h-[90vh] overflow-y-auto ${viewContext === "recipient" ? "p-3 sm:p-5" : "p-4 sm:p-6"}`}
              style={modalContentStyle(isDark)}
              onClick={(e) => e.stopPropagation()}
            >
              {viewingLoading && !viewing ? (
                <>
                  <div className="flex items-center justify-end mb-2">
                    <button
                      onClick={closeDetailModal}
                      aria-label="Close"
                      className="p-2 rounded-full transition-colors hover:scale-105"
                      style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)" }}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <DetailModalSkeleton isDark={isDark} />
                </>
              ) : viewing ? (
              viewContext === "recipient" ? (
              /* ════════════ RECIPIENT VIEW — Email Format ════════════ */
              <>
              {/* Close button — top right */}
              <div className="flex items-center justify-end mb-2">
                <button
                  onClick={closeDetailModal}
                  aria-label="Close"
                  className="p-2 rounded-full transition-colors hover:scale-105"
                  style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)" }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* ─── Email Container ─── */}
              <div
                className="rounded-xl overflow-hidden"
                style={{
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "#e2e8f0"}`,
                  background: isDark ? "#1a1a2e" : "#ffffff",
                  boxShadow: isDark ? "0 4px 24px rgba(0,0,0,0.4)" : "0 4px 24px rgba(0,0,0,0.08)",
                }}
              >
                {/* ─── Orange Header Banner ─── */}
                <div
                  className="px-4 sm:px-6 py-4 sm:py-5 text-center"
                  style={{ background: "linear-gradient(135deg, #FF8800 0%, #F97316 100%)" }}
                >
                  <img
                    src="https://i.imgur.com/J4wddTW.png"
                    alt="YSP Logo"
                    className="mx-auto rounded-full"
                    style={{ width: 52, height: 52, background: "#fff", padding: 2, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
                  />
                  <div className="text-white font-bold text-base sm:text-lg mt-2 tracking-tight">Youth Service Philippines</div>
                  <div className="text-xs sm:text-sm mt-0.5" style={{ color: "#ffe7cc" }}>Tagum Chapter</div>
                </div>

                {/* ─── Email Header: From / To / Date ─── */}
                <div
                  className="px-4 sm:px-6 py-3 sm:py-4 space-y-1.5 text-xs sm:text-sm"
                  style={{
                    borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9"}`,
                    background: isDark ? "rgba(255,255,255,0.02)" : "#fafbfc",
                  }}
                >
                  <div className="flex flex-wrap gap-x-1 gap-y-0.5">
                    <span className="font-semibold shrink-0" style={{ opacity: 0.5, minWidth: 40 }}>From:</span>
                    <span className="font-medium">
                      {viewing.recipientPayload?.emailOptions?.hideAuthor
                        ? "Youth Service Philippines Tagum Chapter"
                        : (viewing.createdByFullName || viewing.createdBy)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-1 gap-y-0.5">
                    <span className="font-semibold shrink-0" style={{ opacity: 0.5, minWidth: 40 }}>To:</span>
                    <span className="font-medium">
                      {viewing.recipientType === "All" ? "All Members"
                        : viewing.recipientType === "Heads" ? "Committee Heads"
                        : viewing.recipientType === "Committee"
                          ? (viewing.recipientPayload?.committees || []).join(", ") || "Committees"
                          : viewing.recipientType === "Person"
                            ? `${(viewing.targets || []).length} recipient${(viewing.targets || []).length !== 1 ? "s" : ""}`
                            : viewing.recipientType}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-1 gap-y-0.5">
                    <span className="font-semibold shrink-0" style={{ opacity: 0.5, minWidth: 40 }}>Date:</span>
                    <span>{new Date(viewing.createdAt).toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </div>

                {/* ─── Subject Line ─── */}
                <div
                  className="px-4 sm:px-6 py-3 sm:py-4"
                  style={{ borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9"}` }}
                >
                  <h2 className="font-bold text-base sm:text-lg leading-snug">{viewing.title}</h2>
                  {viewing.subtitle && (
                    <p className="mt-1 text-xs sm:text-sm" style={{ opacity: 0.55 }}>{viewing.subtitle}</p>
                  )}
                  {/* Priority & Category chips */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <StatusChip
                      status={viewing.priority === "urgent" ? "error" : viewing.priority === "important" ? "warning" : "success"}
                      label={viewing.priority.toUpperCase()}
                      customColor={
                        viewing.priority === "urgent" ? DESIGN_TOKENS.colors.status.error
                          : viewing.priority === "important" ? DESIGN_TOKENS.colors.brand.orange
                          : DESIGN_TOKENS.colors.status.success
                      }
                    />
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium"
                      style={{
                        background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.04)",
                        color: isDark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.55)",
                      }}
                    >
                      {viewing.category}
                    </span>
                    {viewing.isPinned && (
                      <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium" style={{ color: DESIGN_TOKENS.colors.brand.red, background: isDark ? "rgba(239,68,68,0.1)" : "rgba(239,68,68,0.06)" }}>
                        <Pin className="w-3 h-3" /> Pinned
                      </span>
                    )}
                  </div>
                </div>

                {/* ─── Email Body ─── */}
                <div className="px-4 sm:px-6 py-4 sm:py-5">
                  <div
                    className="whitespace-pre-line text-sm sm:text-[0.9375rem]"
                    style={{ lineHeight: 1.75, textAlign: "justify", fontFamily: "'Segoe UI', Roboto, Arial, sans-serif" }}
                  >
                    {viewing.body}
                  </div>
                </div>

                {/* ─── Event Details Card ─── */}
                {(() => {
                  const eo = viewing.recipientPayload?.emailOptions;
                  if (!eo?.eventStart) return null;
                  return (
                    <div className="px-4 sm:px-6 pb-3">
                      <div
                        className="rounded-lg p-3 sm:p-4"
                        style={{
                          background: isDark ? "rgba(255,140,0,0.06)" : "#FFF7ED",
                          border: `1px solid ${isDark ? "rgba(255,140,0,0.15)" : "#FDBA74"}`,
                        }}
                      >
                        <div className="flex items-center gap-1.5 text-sm font-bold mb-2" style={{ color: isDark ? "#FF8800" : "#C2410C" }}>
                          <Calendar className="w-4 h-4" />
                          Event Details
                        </div>
                        <div className="text-xs sm:text-sm space-y-1" style={{ opacity: 0.85 }}>
                          <div className="flex flex-wrap gap-x-1">
                            <strong className="shrink-0">Start:</strong>
                            <span>{new Date(eo.eventStart!).toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" })}</span>
                          </div>
                          {eo.eventEnd && (
                            <div className="flex flex-wrap gap-x-1">
                              <strong className="shrink-0">End:</strong>
                              <span>{new Date(eo.eventEnd).toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" })}</span>
                            </div>
                          )}
                          {eo.eventLocation && (
                            <div className="flex items-start gap-1">
                              <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: isDark ? "#FF8800" : "#C2410C" }} />
                              <span>{eo.eventLocation}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* ─── Attachments ─── */}
                {(viewing.attachments || []).length > 0 && (() => {
                  const images = viewing.attachments.filter((a) => a.mimeType?.startsWith("image/"));
                  const files = viewing.attachments.filter((a) => !a.mimeType?.startsWith("image/"));
                  return (
                    <div
                      className="px-4 sm:px-6 py-3 sm:py-4"
                      style={{
                        borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9"}`,
                        background: isDark ? "rgba(255,255,255,0.015)" : "#f8fafc",
                      }}
                    >
                      <div className="flex items-center gap-1.5 mb-2.5 text-xs font-bold" style={{ opacity: 0.55 }}>
                        <Paperclip className="w-3.5 h-3.5" />
                        Attachments ({viewing.attachments.length})
                      </div>

                      {/* Image thumbnails */}
                      {images.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {images.map((a) => (
                            <button
                              key={a.attachmentId}
                              onClick={() => setLightboxUrl(a.url)}
                              className="rounded-lg overflow-hidden border-2 transition-all hover:scale-105 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-orange-400"
                              style={{
                                borderColor: isDark ? "rgba(255,255,255,0.1)" : "#e2e8f0",
                                width: 80,
                                height: 80,
                              }}
                              title={`View: ${a.name}`}
                            >
                              <img src={a.url} alt={a.name} className="w-full h-full object-cover" loading="lazy" />
                            </button>
                          ))}
                        </div>
                      )}

                      {/* File attachments */}
                      {files.length > 0 && (
                        <div className="space-y-1">
                          {files.map((a) => {
                            const sizeStr = a.sizeBytes
                              ? a.sizeBytes > 1048576
                                ? `${(a.sizeBytes / 1048576).toFixed(1)} MB`
                                : `${Math.round(a.sizeBytes / 1024)} KB`
                              : "";
                            return (
                              <a
                                key={a.attachmentId}
                                href={a.url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs sm:text-sm transition-colors hover:opacity-80"
                                style={{
                                  background: isDark ? "rgba(255,255,255,0.04)" : "#fff",
                                  border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "#e2e8f0"}`,
                                }}
                              >
                                <FileText className="w-4 h-4 shrink-0" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate" style={{ color: DESIGN_TOKENS.colors.brand.orange }}>{a.name}</div>
                                  {sizeStr && <div className="text-[10px]" style={{ opacity: 0.45 }}>{sizeStr}</div>}
                                </div>
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ─── Action Buttons (RSVP, Calendar, Custom) ─── */}
                {(() => {
                  const eo = viewing.recipientPayload?.emailOptions;
                  if (!eo) return null;
                  const hasEvent = !!eo.eventStart;
                  const rsvpEmail = eo.rsvpEmail?.trim();
                  const rsvpOpts = Array.isArray(eo.rsvpOptions) ? eo.rsvpOptions : (typeof eo.rsvpOptions === "string" && eo.rsvpOptions.trim() ? eo.rsvpOptions.split(",").map((s) => s.trim()).filter(Boolean) : []);
                  const customBtns = eo.customButtons || [];
                  const hasAny = hasEvent || (rsvpEmail && rsvpOpts.length > 0) || customBtns.length > 0;
                  if (!hasAny) return null;

                  const buildCalUrl = () => {
                    if (!eo.eventStart) return "";
                    const start = new Date(eo.eventStart);
                    const end = eo.eventEnd ? new Date(eo.eventEnd) : new Date(start.getTime() + 3600000);
                    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
                    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(viewing.title)}&dates=${fmt(start)}/${fmt(end)}${eo.eventLocation ? `&location=${encodeURIComponent(eo.eventLocation)}` : ""}&details=${encodeURIComponent(viewing.subtitle || viewing.body.slice(0, 200))}`;
                  };

                  const buildMailto = (email: string, optLabel: string) => {
                    const subject = `RSVP: ${viewing.title} [${optLabel}]`;
                    const body = eo.rsvpMessageTemplate
                      ? eo.rsvpMessageTemplate.replace(/\{response\}/gi, optLabel).replace(/\{title\}/gi, viewing.title).replace(/\{name\}/gi, username || "").replace(/\{email\}/gi, email)
                      : `RSVP Response\n\nAnnouncement: ${viewing.title}\nResponse: ${optLabel}\nName: ${username || ""}\n`;
                    return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                  };

                  return (
                    <div
                      className="px-4 sm:px-6 py-3 sm:py-4"
                      style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9"}` }}
                    >
                      <div className="flex flex-wrap gap-2">
                        {/* Calendar */}
                        {hasEvent && (
                          <a
                            href={buildCalUrl()}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all hover:scale-[1.02] hover:shadow-sm"
                            style={{
                              background: isDark ? "rgba(255,255,255,0.07)" : "#fff",
                              border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "#e2e8f0"}`,
                              color: isDark ? "#fff" : "#475569",
                            }}
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            Add to Calendar
                          </a>
                        )}
                        {/* RSVP */}
                        {rsvpEmail && rsvpOpts.length > 0 && rsvpOpts.map((opt, i) => (
                          <a
                            key={opt}
                            href={buildMailto(rsvpEmail, opt)}
                            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all hover:scale-[1.02] hover:shadow-sm"
                            style={i === 0 ? {
                              background: "linear-gradient(135deg, #FF8800 0%, #F97316 100%)",
                              color: "#fff",
                              boxShadow: "0 2px 8px rgba(255,136,0,0.25)",
                            } : {
                              background: isDark ? "rgba(255,255,255,0.07)" : "#fff",
                              border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "#e2e8f0"}`,
                              color: isDark ? "#fff" : "#475569",
                            }}
                          >
                            <Mail className="w-3.5 h-3.5" />
                            RSVP: {opt}
                          </a>
                        ))}
                        {/* Custom */}
                        {customBtns.map((btn) => {
                          let href = btn.url || "";
                          if (btn.type === "rsvp") {
                            const e = btn.rsvpEmail || rsvpEmail || "";
                            if (e) href = buildMailto(e, btn.label);
                          } else if (btn.type === "document") {
                            const match = viewing.attachments?.find((a) => a.name.toLowerCase().includes((btn.documentMatch || "").toLowerCase()));
                            if (match) href = match.url;
                          }
                          if (!href) return null;
                          return (
                            <a
                              key={btn.id}
                              href={href}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all hover:scale-[1.02] hover:shadow-sm"
                              style={btn.style === "primary" ? {
                                background: "linear-gradient(135deg, #FF8800 0%, #F97316 100%)",
                                color: "#fff",
                                boxShadow: "0 2px 8px rgba(255,136,0,0.25)",
                              } : {
                                background: isDark ? "rgba(255,255,255,0.07)" : "#fff",
                                border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "#e2e8f0"}`,
                                color: isDark ? "#fff" : "#475569",
                              }}
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              {btn.label}
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* ─── Email Footer ─── */}
                <div
                  className="px-4 sm:px-6 py-3 text-center"
                  style={{
                    borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9"}`,
                    background: isDark ? "rgba(255,255,255,0.02)" : "#f8fafc",
                  }}
                >
                  <div className="text-[11px] sm:text-xs font-semibold" style={{ opacity: 0.5 }}>
                    Youth Service Philippines &bull; Tagum Chapter
                  </div>
                  <div className="text-[10px] sm:text-[11px] mt-0.5" style={{ opacity: 0.35 }}>
                    Announcement ID: {viewing.announcementId}
                  </div>
                  <div className="text-[10px] sm:text-[11px] mt-0.5" style={{ opacity: 0.3 }}>
                    This is an automated notification from the YSP Web App.
                  </div>
                </div>
              </div>
              </>
              ) : (
              /* ════════════ DASHBOARD / AUTHOR VIEW ════════════ */
              <>
              {/* Top action bar */}
              <div className="flex items-center justify-end gap-2 mb-3">
                {permissions.canManage && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Edit2 className="w-4 h-4" />}
                      onClick={() => {
                        closeDetailModal();
                        openEdit(viewing);
                      }}
                      aria-label="Edit"
                    />
                    {viewing.status === "Sent" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Archive className="w-4 h-4" />}
                        onClick={() => void handleArchive(viewing.announcementId)}
                        aria-label="Archive"
                      />
                    )}
                    {confirmingDeleteId === viewing.announcementId ? (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<X className="w-4 h-4" />}
                          onClick={() => setConfirmingDeleteId(null)}
                        />
                        <button
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors"
                          style={{ background: DESIGN_TOKENS.colors.status.error }}
                          onClick={() =>
                            void handleDelete(
                              viewing.announcementId,
                              viewing.title,
                              true
                            )
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                          Confirm
                        </button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Trash2 className="w-4 h-4" />}
                        onClick={() => setConfirmingDeleteId(viewing.announcementId)}
                        aria-label="Delete"
                      />
                    )}
                  </>
                )}
                <button
                  onClick={closeDetailModal}
                  aria-label="Close details"
                  className="p-2 rounded-lg transition-colors"
                  style={{
                    background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                  }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* ═══ EMAIL PREVIEW CONTAINER ═══ */}
              <div
                className="rounded-xl overflow-hidden mb-4"
                style={{
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)"}`,
                  background: isDark ? "rgba(255,255,255,0.02)" : "#fff",
                  boxShadow: isDark
                    ? "0 2px 12px rgba(0,0,0,0.3)"
                    : "0 2px 12px rgba(0,0,0,0.06)",
                }}
              >
                {/* ─── Header Button (collapsible) ─── */}
                <button
                  onClick={() => setShowEmailHeader((v) => !v)}
                  className="w-full text-left px-5 py-3 flex items-center justify-between transition-colors"
                  style={{
                    background: isDark
                      ? "rgba(238,135,36,0.08)"
                      : "rgba(238,135,36,0.04)",
                    borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.orange}, ${DESIGN_TOKENS.colors.brand.red})` }}
                    >
                      {((viewing.createdByFullName || viewing.createdBy) || "?")[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{viewing.createdByFullName || viewing.createdBy}</div>
                      <div className="text-[11px] truncate" style={{ opacity: 0.5 }}>
                        {viewing.status === "Sent" ? "Sent" : viewing.status} &bull; {new Date(viewing.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusChip
                      status={viewing.priority === "urgent" ? "error" : viewing.priority === "important" ? "warning" : "success"}
                      label={viewing.priority}
                    />
                    {showEmailHeader ? <ChevronUp className="w-4 h-4" style={{ opacity: 0.4 }} /> : <ChevronDown className="w-4 h-4" style={{ opacity: 0.4 }} />}
                  </div>
                </button>

                {/* Header expanded details */}
                {showEmailHeader && (
                  <div
                    className="px-5 py-3 space-y-2 text-xs"
                    style={{
                      background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.015)",
                      borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"}`,
                    }}
                  >
                    <div className="flex items-start gap-6 flex-wrap">
                      <div>
                        <span style={{ opacity: 0.5 }}>From:</span>{" "}
                        <span className="font-medium">{viewing.createdByFullName || viewing.createdBy}</span>
                      </div>
                      <div>
                        <span style={{ opacity: 0.5 }}>To:</span>{" "}
                        <span className="font-medium">
                          {viewing.recipientType === "All" ? "Everyone" :
                           viewing.recipientType === "Heads" ? "Committee Heads" :
                           viewing.recipientType === "Committee"
                             ? (viewing.recipientPayload?.committees || []).join(", ") || "Committees"
                             : viewing.recipientType === "Person"
                             ? `${(viewing.targets || []).length} recipient${(viewing.targets || []).length !== 1 ? "s" : ""}`
                             : viewing.recipientType}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-start gap-6 flex-wrap">
                      <div>
                        <span style={{ opacity: 0.5 }}>Category:</span>{" "}
                        <span className="font-medium">{viewing.category}</span>
                      </div>
                      <div>
                        <span style={{ opacity: 0.5 }}>Status:</span>{" "}
                        <StatusChip status={viewing.status} label={viewing.status} />
                      </div>
                      {viewing.isPinned && (
                        <div className="flex items-center gap-1">
                          <Pin className="w-3 h-3" style={{ color: DESIGN_TOKENS.colors.brand.red }} />
                          <span className="font-medium" style={{ color: DESIGN_TOKENS.colors.brand.red }}>Pinned</span>
                        </div>
                      )}
                    </div>
                    {viewing.updatedAt && viewing.updatedAt !== viewing.createdAt && (
                      <div style={{ opacity: 0.4 }}>
                        Last updated: {new Date(viewing.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    )}
                  </div>
                )}

                {/* ─── Email Subject Line ─── */}
                <div
                  className="px-5 py-3"
                  style={{
                    borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"}`,
                  }}
                >
                  <h2
                    className="font-bold leading-tight"
                    style={{ fontSize: DESIGN_TOKENS.typography.fontSize.h1 }}
                  >
                    {viewing.title}
                  </h2>
                  {viewing.subtitle && (
                    <p className="mt-1" style={{ opacity: 0.6, fontSize: DESIGN_TOKENS.typography.fontSize.caption }}>
                      {viewing.subtitle}
                    </p>
                  )}
                </div>

                {/* ─── Email Body ─── */}
                <div className="px-5 py-4">
                  <p className="whitespace-pre-line" style={{ lineHeight: 1.75, fontSize: "0.9375rem" }}>
                    {viewing.body}
                  </p>
                </div>

                {/* ─── Attachments inside email ─── */}
                {(viewing.attachments || []).length > 0 && (
                  <div
                    className="px-5 py-3"
                    style={{
                      borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"}`,
                    }}
                  >
                    <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold" style={{ opacity: 0.6 }}>
                      <Link2 className="w-3.5 h-3.5" />
                      Attachments ({viewing.attachments.length})
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {viewing.attachments.map((a: AnnouncementAttachment) => (
                        <div
                          key={a.attachmentId}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
                          style={{
                            background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                            border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
                          }}
                        >
                          <a
                            href={a.url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium truncate max-w-[200px]"
                            style={{ color: DESIGN_TOKENS.colors.brand.orange }}
                          >
                            {a.name}
                          </a>
                          {permissions.canManage && (
                            <button
                              onClick={() =>
                                void handleRemoveAttachment(
                                  viewing.announcementId,
                                  a.attachmentId
                                )
                              }
                              aria-label="Remove attachment"
                              className="shrink-0"
                            >
                              <X
                                className="w-3 h-3"
                                style={{ color: DESIGN_TOKENS.colors.status.error, opacity: 0.7 }}
                              />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ─── Footer Button (collapsible) ─── */}
                <button
                  onClick={() => setShowEmailFooter((v) => !v)}
                  className="w-full text-left px-5 py-2.5 flex items-center justify-between transition-colors"
                  style={{
                    borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
                    background: isDark
                      ? "rgba(255,255,255,0.03)"
                      : "rgba(0,0,0,0.015)",
                  }}
                >
                  <span className="text-[11px] font-medium" style={{ opacity: 0.45 }}>
                    {viewing.readCount !== undefined ? `${viewing.readCount} read` : ""} 
                    {viewing.readCount !== undefined && viewing.updatedAt ? " • " : ""}
                    {viewing.updatedAt ? `Updated ${new Date(viewing.updatedAt).toLocaleDateString()}` : ""}
                  </span>
                  <div className="flex items-center gap-1 text-[11px]" style={{ opacity: 0.4 }}>
                    <span>Details</span>
                    {showEmailFooter ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </div>
                </button>

                {/* Footer expanded details */}
                {showEmailFooter && (
                  <div
                    className="px-5 py-3 text-xs space-y-1.5"
                    style={{
                      background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)",
                      borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"}`,
                    }}
                  >
                    <div className="flex flex-wrap gap-x-6 gap-y-1">
                      <div><span style={{ opacity: 0.5 }}>ID:</span> <span className="font-mono text-[10px]">{viewing.announcementId}</span></div>
                      <div><span style={{ opacity: 0.5 }}>Created:</span> {new Date(viewing.createdAt).toLocaleString()}</div>
                      {viewing.updatedAt && <div><span style={{ opacity: 0.5 }}>Updated:</span> {new Date(viewing.updatedAt).toLocaleString()}</div>}
                      <div><span style={{ opacity: 0.5 }}>Priority:</span> <span className="font-medium capitalize">{viewing.priority}</span></div>
                      <div><span style={{ opacity: 0.5 }}>Category:</span> <span className="font-medium">{viewing.category}</span></div>
                      <div><span style={{ opacity: 0.5 }}>Recipient Type:</span> <span className="font-medium">{viewing.recipientType}</span></div>
                      {viewing.readCount !== undefined && <div><span style={{ opacity: 0.5 }}>Total Reads:</span> <span className="font-medium">{viewing.readCount}</span></div>}
                    </div>
                  </div>
                )}
              </div>

              {/* Recipients - Table View (Issuance Center style) */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold" style={{ fontSize: DESIGN_TOKENS.typography.fontSize.h4 }}>
                    Recipients ({(viewing.targets || []).length})
                  </h3>
                  {/* Status summary */}
                  <div className="flex items-center gap-3 text-xs flex-wrap justify-end">
                    {(() => {
                      const targets = viewing.targets || [];
                      const ready = targets.filter((t) => t.eligibility === "eligible").length;
                      const notReady = targets.length - ready;
                      const sentCount = targets.filter((t) => logs.some((l) => l.targetId === t.targetId && l.result === "sent")).length;
                      const failedCount = targets.filter((t) => logs.some((l) => l.targetId === t.targetId && l.result === "failed")).length;
                      return (
                        <>
                          {sentCount > 0 && (
                            <span className="flex items-center gap-1" style={{ color: DESIGN_TOKENS.colors.status.success }}>
                              <CheckCircle className="w-3 h-3" />
                              {sentCount} sent
                            </span>
                          )}
                          {failedCount > 0 && (
                            <span className="flex items-center gap-1" style={{ color: DESIGN_TOKENS.colors.status.error }}>
                              <XCircle className="w-3 h-3" />
                              {failedCount} failed
                            </span>
                          )}
                          {ready - sentCount - failedCount > 0 && (
                            <span className="flex items-center gap-1" style={{ color: DESIGN_TOKENS.colors.brand.orange }}>
                              <Clock className="w-3 h-3" />
                              {ready - sentCount - failedCount} pending
                            </span>
                          )}
                          {notReady > 0 && (
                            <span className="flex items-center gap-1" style={{ opacity: 0.5 }}>
                              <AlertTriangle className="w-3 h-3" />
                              {notReady} ineligible
                            </span>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
                <div
                  className="rounded-lg border overflow-hidden"
                  style={{
                    borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
                    background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)",
                  }}
                >
                  <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: "clamp(160px, 30vh, 300px)" }}>
                    <table className="w-full min-w-[600px]">
                      <thead>
                        <tr
                          className="border-b text-left text-xs font-semibold sticky top-0"
                          style={{
                            borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
                            background: isDark ? "rgba(30,30,30,0.98)" : "rgba(250,250,250,0.98)",
                          }}
                        >
                          <th className="px-2 py-2" style={{ width: "36px" }}></th>
                          <th className="px-2 py-2" style={{ opacity: 0.6 }}>Name</th>
                          <th className="px-2 py-2" style={{ opacity: 0.6 }}>Email</th>
                          <th className="px-2 py-2" style={{ opacity: 0.6 }}>Status</th>
                          <th className="px-2 py-2 text-center" style={{ opacity: 0.6 }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(viewing.targets || []).length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-3 text-sm text-center" style={{ opacity: 0.7 }}>
                              No resolved recipients.
                            </td>
                          </tr>
                        ) : (
                          (viewing.targets || []).map((t, idx) => {
                            const latestLog = logs.filter((l) => l.targetId === t.targetId).sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())[0];
                            const sendStatus = latestLog ? latestLog.result : (t.eligibility === "eligible" ? "pending" : "ineligible");
                            const statusConfig: Record<string, { icon: React.ReactNode; text: string; color: string }> = {
                              sent: { icon: <CheckCircle className="w-3.5 h-3.5" />, text: "Sent", color: DESIGN_TOKENS.colors.status.success },
                              failed: { icon: <XCircle className="w-3.5 h-3.5" />, text: "Failed", color: DESIGN_TOKENS.colors.status.error },
                              skipped: { icon: <AlertTriangle className="w-3.5 h-3.5" />, text: "Skipped", color: "#6b7280" },
                              pending: { icon: <Clock className="w-3.5 h-3.5" />, text: "Pending", color: DESIGN_TOKENS.colors.brand.orange },
                              ineligible: { icon: <AlertTriangle className="w-3.5 h-3.5" />, text: t.reason || "Ineligible", color: "#6b7280" },
                            };
                            const st = statusConfig[sendStatus] || statusConfig.pending;
                            return (
                              <tr
                                key={t.targetId}
                                className="border-b last:border-b-0 transition-colors"
                                style={{
                                  borderColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                                  background: idx % 2 === 0 ? "transparent" : (isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)"),
                                }}
                              >
                                {/* Checkbox */}
                                <td className="px-2 py-2 text-center">
                                  <input
                                    type="checkbox"
                                    disabled={t.eligibility !== "eligible"}
                                    checked={!!selectedTargets[t.targetId]}
                                    onChange={(e) =>
                                      setSelectedTargets((p) => ({
                                        ...p,
                                        [t.targetId]: e.target.checked,
                                      }))
                                    }
                                    className="accent-orange-500"
                                  />
                                </td>
                                {/* Name */}
                                <td className="px-2 py-2">
                                  <div className="text-sm font-medium truncate max-w-[160px]">{t.fullName}</div>
                                  <div className="text-[10px] truncate" style={{ opacity: 0.5 }}>{t.username}</div>
                                </td>
                                {/* Email */}
                                <td className="px-2 py-2">
                                  <span className="text-xs truncate max-w-[180px] block" style={{ opacity: 0.7 }}>{t.email || "—"}</span>
                                </td>
                                {/* Status */}
                                <td className="px-2 py-2">
                                  <div
                                    className="flex items-center gap-1.5 whitespace-nowrap"
                                    title={latestLog?.reason || t.reason || st.text}
                                  >
                                    <span style={{ color: st.color }}>{st.icon}</span>
                                    <span className="text-xs font-medium" style={{ color: st.color }}>{st.text}</span>
                                  </div>
                                </td>
                                {/* Actions */}
                                <td className="px-2 py-2 text-center">
                                  {permissions.canSend && sendStatus === "failed" ? (
                                    <button
                                      onClick={async () => {
                                        const tid = `resend-${t.targetId}-${Date.now()}`;
                                        addUploadToast?.({
                                          id: tid,
                                          title: "Resending recipient",
                                          message: `Resending to ${t.fullName}...`,
                                          progress: 30,
                                          status: "loading",
                                        });
                                        try {
                                          updateUploadToast?.(tid, { progress: 60 });
                                          await resendAnnouncementRecipient(viewing.announcementId, t.targetId);
                                          updateUploadToast?.(tid, { progress: 100, status: "success" });
                                          setTimeout(() => removeUploadToast?.(tid), 2000);
                                          setLogs(await getAnnouncementSendLogs(viewing.announcementId));
                                          toast.success("Resent successfully");
                                        } catch (e) {
                                          logErr("resend", e);
                                          updateUploadToast?.(tid, { progress: 100, status: "error" });
                                          setTimeout(() => removeUploadToast?.(tid), 3000);
                                          toast.error("Resend failed", { description: e instanceof Error ? e.message : String(e) });
                                        }
                                      }}
                                      className="px-2 py-1 rounded-md text-xs font-medium transition-all hover:scale-105 active:scale-95 flex items-center gap-1 mx-auto whitespace-nowrap"
                                      style={{
                                        background: "linear-gradient(135deg, #ee8724 0%, #f6421f 100%)",
                                        color: "#fff",
                                      }}
                                    >
                                      <RefreshCw className="w-3 h-3" />
                                      Resend
                                    </button>
                                  ) : (
                                    <span className="text-xs" style={{ opacity: 0.35 }}>—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Send Logs */}
              <div className="mb-4">
                <h3 className="font-semibold mb-2" style={{ fontSize: DESIGN_TOKENS.typography.fontSize.h4 }}>
                  Send Logs
                </h3>
                <div
                  className="overflow-y-auto rounded-lg"
                  style={{
                    maxHeight: "clamp(140px, 28vh, 260px)",
                    border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                  }}
                >
                  {logs.length === 0 ? (
                    <div className="p-3 text-sm" style={{ opacity: 0.7 }}>
                      No logs yet.
                    </div>
                  ) : (
                    logs.map((l) => (
                      <div
                        key={l.logId}
                        className="px-3 py-2 text-sm flex items-center gap-2"
                        style={{
                          borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{l.email || l.username}</div>
                          <div className="text-xs" style={{ opacity: 0.7 }}>
                            {l.result.toUpperCase()} &bull; {l.reason || "-"}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Send controls */}
              {permissions.canSend && (
                <div className="space-y-3">
                  <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deliveryChannel === "email"}
                      onChange={(e) =>
                        setDeliveryChannel(e.target.checked ? "email" : "frontend")
                      }
                    />
                    Send Email Notifications (off = frontend only)
                  </label>
                  <div className="flex gap-3">
                    <Button
                      variant="primary"
                      size="md"
                      icon={<Send className="w-4 h-4" />}
                      onClick={() => void sendNow("all")}
                      disabled={isSending}
                    >
                      {isSending
                        ? "Sending..."
                        : deliveryChannel === "email"
                        ? "Send to All"
                        : "Publish to All"}
                    </Button>
                    <Button
                      variant="secondary"
                      size="md"
                      icon={<Send className="w-4 h-4" />}
                      onClick={() => void sendNow("specific")}
                      disabled={isSending}
                    >
                      {deliveryChannel === "email" ? "Send Selected" : "Publish Selected"}
                    </Button>
                  </div>
                </div>
              )}
              </>
              )
              ) : null}
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════ IMAGE LIGHTBOX ═══════════════════ */}
      {lightboxUrl && (
        <>
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm cursor-pointer"
            style={{ zIndex: 99999998 }}
            onClick={() => setLightboxUrl(null)}
          />
          <div
            className="fixed inset-0 flex items-center justify-center p-4 cursor-pointer"
            style={{ zIndex: 99999999 }}
            onClick={() => setLightboxUrl(null)}
          >
            <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setLightboxUrl(null)}
                className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-black/80 text-white flex items-center justify-center hover:bg-black transition-colors"
                aria-label="Close image"
              >
                <X className="w-4 h-4" />
              </button>
              <img
                src={lightboxUrl}
                alt="Attachment preview"
                className="max-w-full max-h-[85vh] rounded-lg object-contain"
                style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}
              />
            </div>
          </div>
        </>
      )}
    </PageLayout>
  );
}

/* ═══════════════════════ ADD BUTTON MODAL ═══════════════════════ */

function AddButtonModal({
  isDark,
  existingButton,
  rsvpEmailFallback,
  onSave,
  onClose,
}: {
  isDark: boolean;
  existingButton?: CustomButton;
  rsvpEmailFallback: string;
  onSave: (btn: CustomButton) => void;
  onClose: () => void;
}) {
  const [btnType, setBtnType] = useState<CustomButtonType>(existingButton?.type || "link");
  const [label, setLabel] = useState(existingButton?.label || "");
  const [url, setUrl] = useState(existingButton?.url || "");
  const [style, setStyle] = useState<"primary" | "secondary">(existingButton?.style || "secondary");
  const [rsvpEmail, setRsvpEmail] = useState(existingButton?.rsvpEmail || "");
  const [rsvpMessage, setRsvpMessage] = useState(
    existingButton?.rsvpMessage ||
      "Hi,\n\nI would like to RSVP: {response}\n\nTitle: {title}\nName: {name}\nEmail: {email}\n\nThank you!"
  );
  const [documentMatch, setDocumentMatch] = useState(existingButton?.documentMatch || "");

  const handleSave = () => {
    if (!label.trim()) return;
    const btn: CustomButton = {
      id: existingButton?.id || `btn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: btnType,
      label: label.trim(),
      style,
    };
    if (btnType === "link") {
      btn.url = url.trim();
    } else if (btnType === "document") {
      btn.documentMatch = documentMatch.trim();
      btn.url = url.trim();
    } else if (btnType === "rsvp") {
      btn.rsvpEmail = rsvpEmail.trim() || rsvpEmailFallback;
      btn.rsvpMessage = rsvpMessage;
    }
    onSave(btn);
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 99999999 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-md overflow-y-auto max-h-[85vh] p-5 space-y-4"
        style={{
          zIndex: 99999999,
          borderRadius: DESIGN_TOKENS.radius.modal,
          background: isDark ? "rgba(15,23,42,0.98)" : "rgba(255,255,255,0.98)",
          border: `2px solid ${isDark ? "rgba(238,135,36,0.3)" : "rgba(0,0,0,0.1)"}`,
          backdropFilter: "blur(20px)",
        }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">
            {existingButton ? "Edit Button" : "Add Button"}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{
            background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
          }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Button Type Selection */}
        <div className="space-y-2">
          <label className="text-xs font-semibold" style={{ opacity: 0.7 }}>Button Type</label>
          <div className="grid grid-cols-3 gap-2">
            {BUTTON_TYPE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const selected = btnType === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setBtnType(opt.value)}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-lg transition-all text-center"
                  style={{
                    border: `2px solid ${selected ? DESIGN_TOKENS.colors.brand.orange : (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)")}`,
                    background: selected
                      ? DESIGN_TOKENS.colors.brand.orange + "10"
                      : isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.01)",
                  }}
                >
                  <Icon className="w-5 h-5" style={{
                    color: selected ? DESIGN_TOKENS.colors.brand.orange : undefined,
                  }} />
                  <span className="text-xs font-semibold">{opt.label}</span>
                </button>
              );
            })}
          </div>
          <div className="text-xs" style={{ opacity: 0.5 }}>
            {BUTTON_TYPE_OPTIONS.find((o) => o.value === btnType)?.description}
          </div>
        </div>

        {/* Label */}
        <div>
          <label className="block mb-1 text-xs font-semibold" style={{ opacity: 0.7 }}>Button Label *</label>
          <input
            className="w-full px-3 border transition-colors focus:outline-none focus:ring-2"
            style={inputStyle(isDark)}
            placeholder={btnType === "rsvp" ? "e.g. RSVP: Going" : "e.g. Register Now"}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>

        {/* Style */}
        <div>
          <label className="block mb-1 text-xs font-semibold" style={{ opacity: 0.7 }}>Style</label>
          <div className="flex gap-2">
            {(["primary", "secondary"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStyle(s)}
                className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
                style={{
                  border: `2px solid ${style === s ? DESIGN_TOKENS.colors.brand.orange : (isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)")}`,
                  background: s === "primary"
                    ? (style === s ? DESIGN_TOKENS.colors.brand.orange : isDark ? "rgba(255,136,0,0.15)" : "rgba(255,136,0,0.08)")
                    : (style === s ? (isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)") : "transparent"),
                  color: s === "primary"
                    ? (style === s ? "#fff" : DESIGN_TOKENS.colors.brand.orange)
                    : undefined,
                }}
              >
                {s === "primary" ? "Primary (Orange)" : "Secondary (Outlined)"}
              </button>
            ))}
          </div>
        </div>

        {/* Type-specific fields */}
        {btnType === "link" && (
          <div>
            <label className="block mb-1 text-xs font-semibold" style={{ opacity: 0.7 }}>URL</label>
            <input
              className="w-full px-3 border transition-colors focus:outline-none focus:ring-2"
              style={inputStyle(isDark)}
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
        )}

        {btnType === "document" && (
          <>
            <div>
              <label className="block mb-1 text-xs font-semibold" style={{ opacity: 0.7 }}>Match Attachment Name</label>
              <input
                className="w-full px-3 border transition-colors focus:outline-none focus:ring-2"
                style={inputStyle(isDark)}
                placeholder="File name contains..."
                value={documentMatch}
                onChange={(e) => setDocumentMatch(e.target.value)}
              />
              <div className="text-xs mt-1" style={{ opacity: 0.45 }}>
                The button will link to the first uploaded attachment whose name contains this text.
              </div>
            </div>
            <div>
              <label className="block mb-1 text-xs font-semibold" style={{ opacity: 0.7 }}>Fallback URL (optional)</label>
              <input
                className="w-full px-3 border transition-colors focus:outline-none focus:ring-2"
                style={inputStyle(isDark)}
                placeholder="https://... (used if no matching attachment found)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
          </>
        )}

        {btnType === "rsvp" && (
          <>
            <div>
              <label className="block mb-1 text-xs font-semibold" style={{ opacity: 0.7 }}>
                RSVP Email (leave blank to use global RSVP email)
              </label>
              <input
                className="w-full px-3 border transition-colors focus:outline-none focus:ring-2"
                style={inputStyle(isDark)}
                placeholder={rsvpEmailFallback || "recipient@example.com"}
                value={rsvpEmail}
                onChange={(e) => setRsvpEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block mb-1 text-xs font-semibold" style={{ opacity: 0.7 }}>
                Pretyped Message
              </label>
              <textarea
                className="w-full px-3 py-2 border min-h-[120px] text-sm transition-colors focus:outline-none focus:ring-2"
                style={{
                  borderRadius: DESIGN_TOKENS.radius.input,
                  background: isDark ? "rgba(30,41,59,0.8)" : "rgba(255,255,255,0.9)",
                  borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)",
                  color: isDark ? "#fff" : "#000",
                }}
                value={rsvpMessage}
                onChange={(e) => setRsvpMessage(e.target.value)}
              />
              <div className="text-xs mt-1 space-y-0.5" style={{ opacity: 0.45 }}>
                <div>This message will be pre-filled when the recipient presses the button.</div>
                <div>Placeholders: <code>{"{response}"}</code> <code>{"{title}"}</code> <code>{"{name}"}</code> <code>{"{username}"}</code> <code>{"{email}"}</code> <code>{"{announcementId}"}</code></div>
                <div>Works on both mobile and desktop — opens native mail app or web email.</div>
              </div>
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="md" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSave}
            disabled={!label.trim()}
          >
            {existingButton ? "Update" : "Add"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ UTILITY ═══════════════════════ */

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || "");
      resolve(raw.includes(",") ? raw.split(",")[1] : raw);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}
