/**
 * =============================================================================
 * MANAGE MEMBERS PAGE
 * =============================================================================
 * * Admin page for managing YSP members and pending applications
 * Features:
 * - Landscape PDF Export with Branded Header
 * - Specific Committee Colors & Counts
 * - Member table with search and filters
 * - Total population stats
 * * FIX: Modals moved outside PageLayout with high z-index to sit above Header
 * =============================================================================
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Search, UserPlus, Eye, Edit, Mail, CheckCircle, Clock, X, LayoutGrid, Table as TableIcon, User, Phone, MapPin } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { PageLayout, Button, DESIGN_TOKENS } from "./design-system";
import { AddMemberModal, EditMemberModal, ViewMemberModal, type Member } from "./ManageMembersModals";
import AccountCreationModal from "./AccountCreationModal";
import CustomDropdown from "./CustomDropdown";
import { UploadToastContainer, type UploadToastMessage } from "./UploadToast";
import {
  getAllOfficers,
  searchOfficers,
  DirectoryOfficer,
  DirectoryAPIError,
  DirectoryErrorCodes,
  clearDirectoryCache,
} from "../services/gasDirectoryService";
import { updateUserProfileAsAdmin, type UserProfile } from "../services/gasLoginService";
import {
  getSyncedApplicantSheet,
  getApplicantImageDataUrl,
  syncApplicantSheet,
  type SyncedApplicantSheetData,
} from "../services/gasApplicationsService";
import { useLocation, useNavigate } from "react-router-dom";

// =================== SKELETON COMPONENTS ===================

interface SkeletonProps {
  className?: string;
  isDark?: boolean;
}

function Skeleton({ className = "", isDark = false }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded ${
        isDark ? "bg-white/10" : "bg-gray-200"
      } ${className}`}
    />
  );
}

function StatsCardSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div
      className="rounded-xl p-6 border"
      style={{
        background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(20px)',
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      }}
    >
      <Skeleton isDark={isDark} className="h-4 w-24 mb-3" />
      <Skeleton isDark={isDark} className="h-10 w-16" />
    </div>
  );
}

function MemberTileSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div
      className="p-4 rounded-xl border"
      style={{
        background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(20px)',
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <Skeleton isDark={isDark} className="h-4 w-32 mb-2" />
          <Skeleton isDark={isDark} className="h-3 w-40 mb-1" />
          <Skeleton isDark={isDark} className="h-3 w-20" />
        </div>
        <Skeleton isDark={isDark} className="h-5 w-14 rounded-full" />
      </div>
      <div className="flex gap-2 mb-3">
        <Skeleton isDark={isDark} className="h-5 w-14 rounded-full" />
        <Skeleton isDark={isDark} className="h-5 w-24 rounded" />
      </div>
      <Skeleton isDark={isDark} className="h-3 w-28 mb-3" />
      <div className="flex gap-2">
        <Skeleton isDark={isDark} className="h-8 flex-1 rounded-lg" />
        <Skeleton isDark={isDark} className="h-8 flex-1 rounded-lg" />
        <Skeleton isDark={isDark} className="h-8 flex-1 rounded-lg" />
      </div>
    </div>
  );
}

function MemberTableSkeleton({ isDark, rows = 5 }: { isDark: boolean; rows?: number }) {
  return (
    <div className="overflow-x-auto rounded-xl border" style={{
      borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
      background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(255, 255, 255, 0.5)",
    }}>
      <table className="w-full">
        <thead className="bg-gray-100 dark:bg-gray-800">
          <tr>
            {["ID", "Name", "Position", "Role", "Committee", "Status", "Actions"].map((header) => (
              <th key={header} className="px-6 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i}>
              <td className="px-6 py-4"><Skeleton isDark={isDark} className="h-4 w-20" /></td>
              <td className="px-6 py-4">
                <Skeleton isDark={isDark} className="h-4 w-32 mb-1" />
                <Skeleton isDark={isDark} className="h-3 w-40" />
              </td>
              <td className="px-6 py-4"><Skeleton isDark={isDark} className="h-4 w-24" /></td>
              <td className="px-6 py-4"><Skeleton isDark={isDark} className="h-5 w-14 rounded-full" /></td>
              <td className="px-6 py-4"><Skeleton isDark={isDark} className="h-4 w-28" /></td>
              <td className="px-6 py-4"><Skeleton isDark={isDark} className="h-5 w-14 rounded-full" /></td>
              <td className="px-6 py-4">
                <div className="flex gap-2">
                  <Skeleton isDark={isDark} className="h-8 w-8 rounded-lg" />
                  <Skeleton isDark={isDark} className="h-8 w-8 rounded-lg" />
                  <Skeleton isDark={isDark} className="h-8 w-8 rounded-lg" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  isDark,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  isDark: boolean;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);
  const maxButtons = 5;
  const half = Math.floor(maxButtons / 2);
  const startPage = Math.max(1, Math.min(currentPage - half, totalPages - maxButtons + 1));
  const endPage = Math.min(totalPages, startPage + maxButtons - 1);
  const pages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pb-6">
      <div className="text-xs text-muted-foreground">
        Showing {startItem}-{endItem} of {totalItems}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-50"
          style={{
            background: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(255, 255, 255, 0.85)",
            border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"}`,
          }}
        >
          Prev
        </button>
        {pages.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className="px-3 py-1.5 rounded-lg text-sm transition-colors"
            style={{
              background:
                page === currentPage
                  ? `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.red} 0%, ${DESIGN_TOKENS.colors.brand.orange} 100%)`
                  : isDark
                  ? "rgba(255, 255, 255, 0.06)"
                  : "rgba(255, 255, 255, 0.85)",
              color: page === currentPage ? "#ffffff" : undefined,
              border:
                page === currentPage
                  ? "none"
                  : `1px solid ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"}`,
            }}
          >
            {page}
          </button>
        ))}
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-50"
          style={{
            background: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(255, 255, 255, 0.85)",
            border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"}`,
          }}
        >
          Next
        </button>
      </div>
    </div>
  );
}

// =================== TYPE MAPPER ===================

function mapOfficerToMember(officer: DirectoryOfficer): Member {
  let status: "Active" | "Inactive" | "Suspended" = "Active";
  const backendStatus = officer.status?.toLowerCase() || "";
  if (backendStatus === "inactive") status = "Inactive";
  else if (backendStatus === "suspended") status = "Suspended";

  return {
    id: officer.idCode || "",
    username: officer.username || "",
    name: officer.fullName || "",
    position: officer.position || "Member",
    role: officer.role || "Member",
    committee: officer.committee || "",
    status,
    email: officer.email || "",
    personalEmail: officer.personalEmail || "",
    emailVerified: Boolean(officer.emailVerified),
    verifiedEmail: officer.verifiedEmail || "",
    phone: officer.contactNumber || "",
    dateJoined: officer.dateJoined || "",
    chapter: officer.chapter || "",
    membershipType: officer.membershipType || "",
    address: "",
    dateOfBirth: officer.birthday || "",
    age: officer.age || 0,
    gender: officer.gender || "",
    pronouns: officer.pronouns || "",
    civilStatus: officer.civilStatus || "",
    nationality: officer.nationality || "",
    religion: officer.religion || "",
    emergencyContact: [officer.emergencyContactName, officer.emergencyContactRelation]
      .filter(Boolean)
      .join(" - "),
    emergencyPhone: officer.emergencyContactNumber || "",
    emergencyContactName: officer.emergencyContactName || "",
    emergencyContactRelation: officer.emergencyContactRelation || "",
    emergencyContactNumber: officer.emergencyContactNumber || "",
    profilePicture: officer.profilePicture || "",
    facebook: officer.facebook || "",
    instagram: officer.instagram || "",
    twitter: officer.twitter || "",
  };
}

interface PendingApplication {
  id: string;
  name: string;
  email: string;
  phone: string;
  dateApplied: string;
  committee: string;
  status: "pending" | "approved" | "rejected";
  fullData: ApplicationData;
}

interface ApplicationData {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  dateOfBirth: string;
  age: number;
  gender: string;
  pronouns?: string;
  civilStatus: string;
  nationality: string;
  religion?: string;
  medicalConcerns?: string;
  chapter: string;
  committeePreference: string;
  desiredRole: string;
  skills?: string;
  education?: string;
  certifications?: string;
  experience?: string;
  achievements?: string;
  volunteerHistory?: string;
  reasonForJoining?: string;
  personalStatement?: string;
  emergencyContactName?: string;
  emergencyContactRelation?: string;
  emergencyContactNumber?: string;
  facebook?: string;
  instagram?: string;
  twitter?: string;
  attachments?: {
    type: string;
    name: string;
    url: string;
    thumbnailUrl?: string;
  }[];
  profilePicture?: string;
  additionalFields?: Record<string, string>;
}

interface ManageMembersPageProps {
  onClose: () => void;
  isDark: boolean;
  pendingApplications: PendingApplication[];
  setPendingApplications: (apps: PendingApplication[]) => void;
  currentUserName: string;
  onModalStateChange?: (isOpen: boolean) => void;
}

// Logo URL for PDF export
const ORG_LOGO_URL = "https://i.imgur.com/J4wddTW.png";
const ORG_NAME = "Youth Service Philippines";
const ORG_CHAPTER = "Tagum Chapter";
const ORG_MOTTO = "Shaping the Future to a Greater Society";
const ITEMS_PER_PAGE = 10;
const MEMBERS_CACHE_KEY = "ysp_manage_members_cache";
const APPLICANT_MAPPING_DEBUG = true;
const APPLICANT_IMAGE_LINK_CACHE_KEY = "ysp_applicant_image_link_cache_v1";

function getApplicantImageLinkCache(): Record<string, string> {
  try {
    const raw = localStorage.getItem(APPLICANT_IMAGE_LINK_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function setApplicantImageLinkCache(cache: Record<string, string>) {
  try {
    localStorage.setItem(APPLICANT_IMAGE_LINK_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore quota/storage errors
  }
}

function transformDriveLinkLikeProjects(rawUrl?: string): string {
  const raw = String(rawUrl || "").trim();
  if (!raw) return "";
  const fileId = extractDriveIdFromAny(raw);
  if (!fileId) return raw;
  // Mirror Homepage_Main.gs convertToCORSFreeLink output.
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w4000`;
}

function getTransformedProfileLinkWithCache(rawUrl?: string): string {
  const raw = String(rawUrl || "").trim();
  if (!raw) return "";
  const cache = getApplicantImageLinkCache();
  if (cache[raw]) return cache[raw];
  const transformed = transformDriveLinkLikeProjects(raw);
  if (transformed) {
    cache[raw] = transformed;
    setApplicantImageLinkCache(cache);
  }
  return transformed;
}

function normalizeProfileImageUrl(rawUrl?: string): string {
  const candidates = getProfileImageCandidates(rawUrl);
  return candidates[0] || "";
}

function extractUrlsFromText(raw?: string): string[] {
  const source = String(raw || "").trim();
  if (!source) return [];
  const matches = source.match(/https?:\/\/[^\s<>"')]+/gi) || [];
  const seen = new Set<string>();
  const cleaned: string[] = [];
  matches.forEach((item) => {
    const value = item.replace(/[),.;]+$/, "");
    if (!value || seen.has(value)) return;
    seen.add(value);
    cleaned.push(value);
  });
  return cleaned;
}

function extractDriveIdFromAny(raw?: string): string {
  const value = String(raw || "").trim();
  if (!value) return "";
  const filePath = value.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (filePath?.[1]) return filePath[1];

  const idParam = value.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  if (idParam?.[1]) return idParam[1];

  const standaloneIds = value.match(/\b[a-zA-Z0-9_-]{20,}\b/g) || [];
  if (standaloneIds.length === 1) return standaloneIds[0];
  return "";
}

function getProfileImageCandidates(rawUrl?: string): string[] {
  const value = (rawUrl || "").trim();
  if (!value) return [];
  const urls = extractUrlsFromText(value);
  const seen = new Set<string>();
  const candidates: string[] = [];
  const pushCandidate = (url: string) => {
    const normalized = String(url || "").trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push(normalized);
  };

  const addDriveCandidates = (id: string) => {
    if (!id) return;
    pushCandidate(`https://drive.google.com/thumbnail?id=${id}&sz=w4000`);
    pushCandidate(`https://drive.usercontent.google.com/download?id=${id}&export=view`);
    pushCandidate(`https://lh3.googleusercontent.com/d/${id}`);
    pushCandidate(`https://drive.google.com/uc?export=view&id=${id}`);
    pushCandidate(`https://drive.google.com/uc?export=download&id=${id}`);
    pushCandidate(`https://drive.google.com/open?id=${id}`);
  };

  if (urls.length > 0) {
    urls.forEach((url) => {
      const driveId = extractDriveIdFromAny(url);
      if (driveId) addDriveCandidates(driveId);
      pushCandidate(url);
    });
  } else {
    const driveId = extractDriveIdFromAny(value);
    if (driveId) addDriveCandidates(driveId);
    else pushCandidate(value.split(/[\s,\n\r]+/).find(Boolean) || value);
  }

  return candidates;
}

function getAccessibleImageUrlLikeMyQR(url: string): string {
  const source = String(url || "").trim();
  if (!source) return "";
  let fileId = "";
  const idMatch = source.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  const dMatch = source.match(/\/d\/([a-zA-Z0-9_-]+)/);
  const lh3Match = source.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
  if (idMatch?.[1]) fileId = idMatch[1];
  else if (dMatch?.[1]) fileId = dMatch[1];
  else if (lh3Match?.[1]) fileId = lh3Match[1];
  return fileId ? `https://lh3.googleusercontent.com/d/${fileId}=s500` : source;
}

function loadImageLikeMyQR(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const accessibleUrl = getAccessibleImageUrlLikeMyQR(src);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.onload = () => resolve(img);
    img.onerror = () => {
      const fileId =
        extractDriveIdFromAny(src) ||
        extractDriveIdFromAny(accessibleUrl);
      if (fileId) {
        const altUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w500`;
        const img2 = new Image();
        img2.crossOrigin = "anonymous";
        img2.referrerPolicy = "no-referrer";
        img2.onload = () => resolve(img2);
        img2.onerror = () => reject(new Error("Image load failed"));
        img2.src = altUrl;
        return;
      }
      reject(new Error("Image load failed"));
    };
    img.src = accessibleUrl;
  });
}

async function loadImageDataUrl(imageUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || 300;
          canvas.height = img.naturalHeight || 300;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/png"));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = imageUrl;
    } catch {
      resolve(null);
    }
  });
}

async function loadImageAsCircleDataUrl(imageUrl: string, size = 220): Promise<string | null> {
  const rawDataUrl = await loadImageDataUrl(imageUrl);
  if (!rawDataUrl) return null;

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.clearRect(0, 0, size, size);
          ctx.save();
          ctx.beginPath();
          ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(img, 0, 0, size, size);
          ctx.restore();
          resolve(canvas.toDataURL("image/png"));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = rawDataUrl;
    } catch {
      resolve(null);
    }
  });
}

async function loadFirstWorkingCircleDataUrl(rawValue?: string, size = 220): Promise<string | null> {
  const candidates = getProfileImageCandidates(rawValue);
  for (let i = 0; i < candidates.length; i++) {
    const dataUrl = await loadImageAsCircleDataUrl(candidates[i], size);
    if (dataUrl) return dataUrl;
  }
  return null;
}

async function loadCircleDataUrlLikeMyQR(rawValue?: string, size = 220): Promise<string | null> {
  const candidates = getProfileImageCandidates(rawValue);
  for (let i = 0; i < candidates.length; i++) {
    try {
      const img = await loadImageLikeMyQR(candidates[i]);
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      ctx.save();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, 0, 0, size, size);
      ctx.restore();
      return canvas.toDataURL("image/png");
    } catch {
      // try next candidate
    }
  }
  return null;
}

function previewDebugValue(value: unknown): string {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= 140) return text;
  return `${text.slice(0, 140)}...`;
}

function logApplicantFrontDebug(
  label: string,
  applicationOrData?: PendingApplication | ApplicationData | null
) {
  if (!APPLICANT_MAPPING_DEBUG || !applicationOrData) return;
  const data = "fullData" in applicationOrData ? applicationOrData.fullData : applicationOrData;
  const hasSocial = Boolean(data.facebook || data.instagram || data.twitter);
  const normalizedProfilePicture = normalizeProfileImageUrl(data.profilePicture);
  console.log(`[Applicants UI Debug] ${label}`, {
    name: data.fullName,
    email: data.email,
    address: previewDebugValue(data.address),
    facebook: previewDebugValue(data.facebook),
    instagram: previewDebugValue(data.instagram),
    twitter: previewDebugValue(data.twitter),
    profilePictureRaw: previewDebugValue(data.profilePicture),
    profilePictureNormalized: previewDebugValue(normalizedProfilePicture),
    hasSocial,
    additionalFieldsCount: Object.keys(data.additionalFields || {}).length,
    additionalFieldKeys: Object.keys(data.additionalFields || {}).slice(0, 8),
  });
}

function hasContent(value?: string | number | null): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return !Number.isNaN(value) && value !== 0;
  return String(value).trim().length > 0;
}

function toDriveDownloadUrl(rawUrl?: string): string {
  const value = (rawUrl || "").trim();
  if (!value) return "";

  const filePathMatch = value.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (filePathMatch?.[1]) {
    return `https://drive.google.com/uc?export=download&id=${filePathMatch[1]}`;
  }

  try {
    const parsed = new URL(value);
    const driveId = parsed.searchParams.get("id");
    if (driveId) {
      return `https://drive.google.com/uc?export=download&id=${driveId}`;
    }
    return parsed.toString();
  } catch {
    return value;
  }
}

function formatDateSafe(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value || "N/A";
  return parsed.toLocaleDateString();
}

export default function ManageMembersPage({ 
  onClose, 
  isDark, 
  pendingApplications,
  setPendingApplications,
  currentUserName,
  onModalStateChange,
}: ManageMembersPageProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterCommittee, setFilterCommittee] = useState("all");
  const [viewMode, setViewMode] = useState<"tile" | "table">("table");
  const [selectedApplication, setSelectedApplication] = useState<PendingApplication | null>(null);
  
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showEditMemberModal, setShowEditMemberModal] = useState(false);
  const [showViewMemberModal, setShowViewMemberModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showAccountModal, setShowAccountModal] = useState(false);

  const [members, setMembers] = useState<Member[]>([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasInitializedRef = useRef(false);
  const [uploadToastMessages, setUploadToastMessages] = useState<UploadToastMessage[]>([]);
  const [sheetUrlInput, setSheetUrlInput] = useState("");
  const [isSyncingApplicants, setIsSyncingApplicants] = useState(false);
  const [isLoadingSyncedApplicants, setIsLoadingSyncedApplicants] = useState(true);
  const [syncedSheetName, setSyncedSheetName] = useState("");
  const [syncedHeaders, setSyncedHeaders] = useState<string[]>([]);
  const [syncedRowCount, setSyncedRowCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState("");

  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const isPendingPageView = queryParams.get("view") === "pending";
  const selectedApplicantIdInUrl = queryParams.get("applicantId") || "";

  const addUploadToast = useCallback((message: UploadToastMessage) => {
    setUploadToastMessages(prev => [...prev, message]);
  }, []);

  const updateUploadToast = useCallback((id: string, updates: Partial<UploadToastMessage>) => {
    setUploadToastMessages(prev =>
      prev.map(msg => (msg.id === id ? { ...msg, ...updates } : msg))
    );
  }, []);

  const removeUploadToast = useCallback((id: string) => {
    setUploadToastMessages(prev => prev.filter(msg => msg.id !== id));
  }, []);

  const applySyncedApplicants = useCallback((data?: SyncedApplicantSheetData) => {
    if (!data) return;
    if (APPLICANT_MAPPING_DEBUG) {
      console.log("[Applicants UI Debug] synced payload summary", {
        sheetName: data.sheetName || "",
        rowCount: Number(data.rowCount || 0),
        headerCount: Array.isArray(data.headers) ? data.headers.length : 0,
        applicantsCount: Array.isArray(data.applicants) ? data.applicants.length : 0,
      });
      const firstApplicant = (data.applicants || [])[0] as PendingApplication | undefined;
      if (firstApplicant) {
        logApplicantFrontDebug("first applicant from sync", firstApplicant);
      }
    }
    setSheetUrlInput(data.sheetUrl || "");
    setSyncedSheetName(data.sheetName || "");
    setSyncedHeaders(Array.isArray(data.headers) ? data.headers : []);
    setSyncedRowCount(Number(data.rowCount || 0));
    setLastSyncedAt(data.syncedAt || "");
    setPendingApplications((data.applicants || []) as PendingApplication[]);
  }, [setPendingApplications]);

  const loadSyncedApplicants = useCallback(async () => {
    setIsLoadingSyncedApplicants(true);
    const result = await getSyncedApplicantSheet();
    if (result.success) {
      applySyncedApplicants(result.data);
    } else if (result.data) {
      applySyncedApplicants(result.data);
    } else if (result.error) {
      console.error("[ManageMembers] Failed to load synced applicant sheet:", result.error);
      toast.error(result.error);
    }
    setIsLoadingSyncedApplicants(false);
  }, [applySyncedApplicants]);

  const handleSyncApplicants = useCallback(async () => {
    const normalizedUrl = sheetUrlInput.trim();
    if (!normalizedUrl) {
      toast.error("Please paste a Google Sheet link first.");
      return;
    }

    setIsSyncingApplicants(true);
    const result = await syncApplicantSheet(normalizedUrl);
    if (result.success && result.data) {
      applySyncedApplicants(result.data);
      toast.success(`Synced ${result.data.applicants.length} applicant(s).`);
    } else {
      console.error("[ManageMembers] Failed to sync applicant sheet:", result.error);
      toast.error(result.error || "Failed to sync applicant sheet");
    }
    setIsSyncingApplicants(false);
  }, [applySyncedApplicants, sheetUrlInput]);

  const updateManageMembersUrl = useCallback((updates: { view?: string | null; applicantId?: string | null }) => {
    const params = new URLSearchParams(location.search);
    params.set("page", "ManageMembers");

    if (updates.view === null) params.delete("view");
    else if (updates.view !== undefined) params.set("view", updates.view);

    if (updates.applicantId === null) params.delete("applicantId");
    else if (updates.applicantId !== undefined) params.set("applicantId", updates.applicantId);

    navigate(`${location.pathname}?${params.toString()}`);
  }, [location.pathname, location.search, navigate]);

  const openPendingsPage = useCallback(() => {
    updateManageMembersUrl({ view: "pending", applicantId: null });
  }, [updateManageMembersUrl]);

  const openApplicantTrail = useCallback((applicationId: string) => {
    updateManageMembersUrl({ view: "pending", applicantId: applicationId });
  }, [updateManageMembersUrl]);

  const clearApplicantTrail = useCallback(() => {
    updateManageMembersUrl({ applicantId: null });
  }, [updateManageMembersUrl]);

  const closePendingsPage = useCallback(() => {
    updateManageMembersUrl({ view: null, applicantId: null });
  }, [updateManageMembersUrl]);

  // =================== FETCH MEMBERS FROM BACKEND ===================
  
  const filterMembersByQuery = useCallback((list: Member[], query: string) => {
    const normalized = query.toLowerCase().trim();
    if (!normalized) return [];
    return list.filter((member) =>
      [
        member.name,
        member.id,
        member.email,
        member.position,
        member.committee,
        member.role,
      ]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(normalized))
    );
  }, []);

  const fetchAllMembers = useCallback(async (options?: { suppressLoading?: boolean }) => {
    if (!options?.suppressLoading) {
      setIsLoading(true);
    }
    setError(null);

    try {
      let page = 1;
      const collected: DirectoryOfficer[] = [];
      while (true) {
        const response = await getAllOfficers(page, 100);
        if (response.success && response.officers) {
          collected.push(...response.officers);
        }
        const totalPages = response.pagination?.totalPages;
        const hasMore = response.pagination?.hasMore;
        if (!hasMore && (!totalPages || page >= totalPages)) {
          break;
        }
        if (!response.officers || response.officers.length === 0) {
          break;
        }
        page += 1;
      }

      const mappedMembers = collected.map(mapOfficerToMember);
      setAllMembers(mappedMembers);
      setMembers(mappedMembers);

      try {
        localStorage.setItem(
          MEMBERS_CACHE_KEY,
          JSON.stringify({ members: mappedMembers, timestamp: Date.now() })
        );
      } catch {
        // Ignore cache write failures
      }
    } catch (err: unknown) {
      console.error("Fetch members error:", err);
      if (err instanceof DirectoryAPIError) {
        if (err.code === DirectoryErrorCodes.NO_API_URL) {
          setError("Member service not configured. Please contact administrator.");
        } else if (err.code === DirectoryErrorCodes.TIMEOUT_ERROR) {
          setError("Request timed out. Please try again.");
        } else if (err.code === DirectoryErrorCodes.NETWORK_ERROR) {
          setError("Network error. Please check your connection.");
        } else {
          setError(err.message);
        }
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
      setMembers([]);
    } finally {
      if (!options?.suppressLoading) {
        setIsLoading(false);
      }
    }
  }, []);

  const searchMembersRemote = useCallback(async (query: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await searchOfficers(query);
      if (response.success && response.officers) {
        setMembers(response.officers.map(mapOfficerToMember));
      } else {
        setMembers([]);
      }
    } catch (err: unknown) {
      console.error("Fetch members error:", err);
      if (err instanceof DirectoryAPIError) {
        if (err.code === DirectoryErrorCodes.NO_API_URL) {
          setError("Member service not configured. Please contact administrator.");
        } else if (err.code === DirectoryErrorCodes.TIMEOUT_ERROR) {
          setError("Request timed out. Please try again.");
        } else if (err.code === DirectoryErrorCodes.NETWORK_ERROR) {
          setError("Network error. Please check your connection.");
        } else {
          setError(err.message);
        }
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
      setMembers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let hasCache = false;
    try {
      const cached = localStorage.getItem(MEMBERS_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed?.members)) {
          setMembers(parsed.members);
          setAllMembers(parsed.members);
          setIsLoading(false);
          hasCache = true;
        }
      }
    } catch {
      // Ignore cache read failures
    }

    fetchAllMembers({ suppressLoading: hasCache });

    return () => {};
  }, [fetchAllMembers]);

  useEffect(() => {
    loadSyncedApplicants();
  }, [loadSyncedApplicants]);

  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      return;
    }

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (searchQuery.trim().length >= 2) {
      searchTimerRef.current = setTimeout(() => {
        if (allMembers.length > 0) {
          setIsLoading(false);
          setMembers(filterMembersByQuery(allMembers, searchQuery));
        } else {
          searchMembersRemote(searchQuery);
        }
      }, 300);
    } else if (searchQuery.trim().length === 0) {
      if (allMembers.length > 0) {
        setIsLoading(false);
        setMembers(allMembers);
      } else {
        fetchAllMembers();
      }
    }
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery, allMembers, filterMembersByQuery, fetchAllMembers, searchMembersRemote]);

  const filteredMembers = members.filter((member) => {
    const matchesRole = filterRole === "all" || member.role === filterRole;
    const matchesCommittee = filterCommittee === "all" || member.committee === filterCommittee;
    return matchesRole && matchesCommittee;
  });

  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / ITEMS_PER_PAGE));
  const paginatedMembers = filteredMembers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const totalMembers = members.length;
  const activeMembers = members.filter((m) => m.status === "Active").length;
  const pendingApplicationsList = pendingApplications.filter((a) => a.status === "pending");
  const pendingCount = pendingApplicationsList.length;
  const selectedApplicantForTrail =
    pendingApplicationsList.find((app) => app.id === selectedApplicantIdInUrl) || null;
  const viewToggleLabel = viewMode === "table" ? "Table View" : "Tile View";

  const [exportType, setExportType] = useState("");

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterRole, filterCommittee]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!isPendingPageView) {
      if (selectedApplication) setSelectedApplication(null);
      return;
    }

    if (!selectedApplicantIdInUrl) {
      if (selectedApplication) setSelectedApplication(null);
      return;
    }

    const target = pendingApplicationsList.find((app) => app.id === selectedApplicantIdInUrl) || null;
    if (!target) {
      setSelectedApplication(null);
      return;
    }
    if (!selectedApplication || selectedApplication.id !== target.id) {
      setSelectedApplication(target);
    }
  }, [
    isPendingPageView,
    pendingApplicationsList,
    selectedApplicantIdInUrl,
    selectedApplication,
  ]);

  useEffect(() => {
    if (!selectedApplication) return;
    logApplicantFrontDebug(`selected application ${selectedApplication.id}`, selectedApplication);
  }, [selectedApplication]);

  useEffect(() => {
    const isAnyModalOpen =
      Boolean(selectedApplication) ||
      showAddMemberModal ||
      showEditMemberModal ||
      showViewMemberModal ||
      showAccountModal;
    onModalStateChange?.(isAnyModalOpen);
  }, [
    selectedApplication,
    showAddMemberModal,
    showEditMemberModal,
    showViewMemberModal,
    showAccountModal,
    onModalStateChange,
  ]);

  useEffect(() => {
    return () => {
      onModalStateChange?.(false);
    };
  }, [onModalStateChange]);

  const handleExportCSV = () => {
    if (!filteredMembers.length) {
      toast.error("No members to export");
      return;
    }
    const headers = [
      "ID", "Name", "Position", "Role", "Committee", "Status", "Email", "Phone", "Date Joined"
    ];
    const rows = filteredMembers.map(m => [
      m.id, m.name, m.position, m.role, m.committee, m.status, m.email, m.phone, m.dateJoined
    ]);
    const csvContent = [headers, ...rows].map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `YSP_Members_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("CSV exported successfully!");
  };

  /**
   * PDF EXPORT HANDLER
   * - Orientation: Landscape (A4)
   * - Page 1: Header, Status Stats, UNASSIGNED STATS (New), Committee Cards
   * - Page 2+: Member Table
   */
  const handleExportPDF = async () => {
    if (!filteredMembers.length) {
      toast.error("No members to export");
      return;
    }

    // Initialize in Landscape mode
    const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth(); // ~297mm
    const pageHeight = doc.internal.pageSize.getHeight(); // ~210mm
    const margin = 14;
    
    // --- HEADER SECTION (Page 1) ---
    // Red Background
    doc.setFillColor(246, 66, 31); // Brand Red
    doc.rect(0, 0, pageWidth, 45, 'F');
    
    // Add Logo (Attempt to load from URL)
    try {
      const img = new Image();
      img.src = ORG_LOGO_URL;
      img.crossOrigin = "Anonymous"; 
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve; 
      });
      // Draw Logo: 26mm x 26mm, positioned at x=15, y=9
      doc.addImage(img, 'PNG', 15, 9, 26, 26);
    } catch (e) {
      doc.setFillColor(255, 255, 255);
      doc.circle(28, 22, 12, 'F');
    }

    // Header Text
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.text("Youth Service Philippines", 50, 20);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(16);
    doc.text("Tagum Chapter", 50, 29);
    
    doc.setFontSize(10);
    doc.text(`MEMBERS LIST EXPORT`, 50, 38);
    doc.text(`Exported: ${new Date().toLocaleString()}`, pageWidth - margin, 38, { align: 'right' });

    // --- SUMMARY SECTION (Page 1) ---
    let yPosition = 55; // Slightly higher start to fit new rows
    
    // Section Title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('MEMBER SUMMARY', margin, yPosition);
    doc.setDrawColor(246, 66, 31);
    doc.setLineWidth(1);
    doc.line(margin, yPosition + 3, margin + 50, yPosition + 3);
    yPosition += 12;

    // --- ROW 1: STATUS STATS (Active, Inactive, Total, Exec Board) ---
    const activeCount = filteredMembers.filter(m => m.status === 'Active').length;
    const inactiveCount = filteredMembers.filter(m => m.status === 'Inactive').length;
    const totalCount = filteredMembers.length;
    const executiveCount = filteredMembers.filter(m => m.committee === 'Executive Board').length;
    
    const statusCounts = [
      { name: 'ACTIVE', color: [16, 185, 129], count: activeCount },
      { name: 'INACTIVE', color: [239, 68, 68], count: inactiveCount },
      { name: 'TOTAL', color: [246, 66, 31], count: totalCount },
      { name: 'EXECUTIVE BOARD', color: [59, 130, 246], count: executiveCount },
    ];

    const boxGap = 8;
    const boxHeight = 28; // Slightly shorter to save vertical space
    // Calculate width for 4 boxes across available width
    const boxWidth = (pageWidth - (2 * margin) - (3 * boxGap)) / 4;

    statusCounts.forEach((status, index) => {
      const boxX = margin + index * (boxWidth + boxGap);
      // @ts-ignore
      doc.setFillColor(...status.color);
      doc.roundedRect(boxX, yPosition, boxWidth, boxHeight, 3, 3, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text(String(status.count), boxX + boxWidth / 2, yPosition + 14, { align: 'center' });
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(status.name, boxX + boxWidth / 2, yPosition + 22, { align: 'center' });
    });

    yPosition += boxHeight + 10; // Add spacing before next row

    // --- ROW 2: UNASSIGNED MEMBERS & VOLUNTEERS (NEW REQUIREMENT) ---
    
    // Calculate counts for members with specific positions AND empty committees
    const memberNoCommCount = filteredMembers.filter(m => 
      m.position?.trim() === 'Member' && (!m.committee || m.committee.trim() === '')
    ).length;

    const volunteerNoCommCount = filteredMembers.filter(m => 
      m.position?.trim() === 'Volunteer Member' && (!m.committee || m.committee.trim() === '')
    ).length;

    const generalCounts = [
        { name: 'MEMBERS (NO COMMITTEE)', color: [100, 116, 139], count: memberNoCommCount }, // Slate Gray
        { name: 'VOLUNTEERS', color: [139, 92, 246], count: volunteerNoCommCount } // Violet
    ];

    // We use the same grid width logic but split into 2 large boxes or keeping 4-column alignment? 
    // Let's split the width into 2 large boxes to distinguish this section
    const genBoxWidth = (pageWidth - (2 * margin) - boxGap) / 2;

    generalCounts.forEach((item, index) => {
        const boxX = margin + index * (genBoxWidth + boxGap);
        // @ts-ignore
        doc.setFillColor(...item.color);
        doc.roundedRect(boxX, yPosition, genBoxWidth, boxHeight, 3, 3, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text(String(item.count), boxX + genBoxWidth / 2, yPosition + 14, { align: 'center' });

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(item.name, boxX + genBoxWidth / 2, yPosition + 22, { align: 'center' });
    });

    yPosition += boxHeight + 10; // Add spacing before next row

    // --- ROW 3: COMMITTEES (SPECIFIC COLORS & NAMES) ---
    const committeeList = [
      "Membership and Internal Affairs Committee",
      "External Relations Committee",
      "Secretariat and Documentation Committee",
      "Finance and Treasury Committee",
      "Program Development Committee",
      "Communications and Marketing Committee"
    ];

    // Colors matched to user request: Red, Orange, Yellow, Green, Blue, Purple
    const committeeColors = [
      [239, 68, 68],   // Red (Membership)
      [249, 115, 22],  // Orange (External)
      [234, 179, 8],   // Yellow (Secretariat) - Darker yellow for text visibility
      [34, 197, 94],   // Green (Finance)
      [59, 130, 246],  // Blue (Program)
      [168, 85, 247],  // Purple (Comms)
    ];

    const committeeCounts = committeeList.map((c, i) => ({
      name: c,
      count: filteredMembers.filter(m => m.committee === c).length,
      color: committeeColors[i % committeeColors.length],
    }));

    const commBoxHeight = 35;
    const commBoxGap = 6;
    // Calculate width for 6 boxes across available width
    const commBoxWidth = (pageWidth - (2 * margin) - (5 * commBoxGap)) / 6;

    committeeCounts.forEach((committee, idx) => {
      const commX = margin + idx * (commBoxWidth + commBoxGap);
      
      // Card Background
      // @ts-ignore
      doc.setFillColor(...committee.color);
      doc.roundedRect(commX, yPosition, commBoxWidth, commBoxHeight, 3, 3, 'F');
      
      // Count
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(String(committee.count), commX + commBoxWidth / 2, yPosition + 12, { align: 'center' });
      
      // Name (Auto-wrapping text)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7); 
      
      // Split text to fit width
      const textLines = doc.splitTextToSize(committee.name, commBoxWidth - 4);
      const textStartY = yPosition + 22; 
      
      doc.text(textLines, commX + commBoxWidth / 2, textStartY, { align: 'center', lineHeightFactor: 1.2 });
    });

    // --- TABLE SECTION (Page 2) ---
    doc.addPage(); 
    
    // Page 2 Title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('MEMBER LIST', margin, 20);
    doc.setDrawColor(246, 66, 31);
    doc.line(margin, 23, margin + 40, 23);

    autoTable(doc, {
      startY: 30,
      head: [["ID", "Name", "Position", "Role", "Committee", "Status", "Email", "Phone", "Date Joined"]],
      body: filteredMembers.map(m => [
        m.id || "", m.name, m.position, m.role, m.committee, m.status, m.email, m.phone, m.dateJoined || ""
      ]),
      theme: 'grid',
      headStyles: {
        fillColor: [246, 66, 31],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9,
        cellPadding: 3,
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [50, 50, 50],
        cellPadding: 3,
      },
      alternateRowStyles: {
        fillColor: [254, 249, 244],
      },
      columnStyles: {
        0: { cellWidth: 20, halign: 'center', fontStyle: 'bold' }, // ID
        1: { cellWidth: 45 }, // Name
        2: { cellWidth: 25 }, // Position
        3: { cellWidth: 20 }, // Role
        4: { cellWidth: 35 }, // Committee
        5: { cellWidth: 20, halign: 'center' }, // Status
        6: { cellWidth: 45 }, // Email
        7: { cellWidth: 25 }, // Phone
        8: { cellWidth: 25 }, // Date
      },
      margin: { left: margin, right: margin, bottom: 20 },
      didDrawPage: (data) => {
        // Footer for Table Pages
        doc.setDrawColor(246, 66, 31);
        doc.setLineWidth(0.5);
        doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
        
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.setFont('helvetica', 'normal');
        doc.text(
          'Youth Service Philippines - Tagum Chapter',
          margin,
          pageHeight - 10
        );
        doc.text(
          `Page ${data.pageNumber} of ${doc.getNumberOfPages()}`,
          pageWidth - margin,
          pageHeight - 10,
          { align: 'right' }
        );
      },
    });

    const filename = `YSP_Members_${new Date().toISOString().slice(0,10)}.pdf`;
    doc.save(filename);
    toast.success("PDF exported successfully!");
  };

  useEffect(() => {
    if (exportType === "csv") handleExportCSV();
    if (exportType === "pdf") handleExportPDF();
    setExportType("");
  }, [exportType]);

  const handleViewApplication = (application: PendingApplication) => {
    setSelectedApplication(application);
    openApplicantTrail(application.id);
  };

  const handleApproveApplication = (_applicationId: string) => {
    toast.success("Application Approved!", {
      description: "Member has been added to the system",
    });
    clearApplicantTrail();
  };

  const handleRejectApplication = (_applicationId: string) => {
    toast.error("Application Rejected", {
      description: "Applicant will be notified via email",
    });
    clearApplicantTrail();
  };

  const handleSendEmail = (email: string) => {
    const gmailUrl = `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(email)}`;
    window.open(gmailUrl, '_blank');
    
    toast.info("Email Composer", {
      description: `Opening Gmail to ${email}`,
    });
  };

  const handleDownloadApplicationPDF = async (application: PendingApplication) => {
    const data = application.fullData;
    const doc = new jsPDF({ orientation: "portrait", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;

    // Header (aligned with existing branded exporter style)
    doc.setFillColor(246, 66, 31);
    doc.rect(0, 0, pageWidth, 45, "F");

    try {
      const logo = new Image();
      logo.src = ORG_LOGO_URL;
      logo.crossOrigin = "Anonymous";
      await new Promise((resolve) => {
        logo.onload = resolve;
        logo.onerror = resolve;
      });
      const logoSize = 30;
      const logoX = margin;
      const logoY = 7.5;
      doc.setFillColor(255, 255, 255);
      doc.circle(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 2, "F");
      doc.addImage(logo, "PNG", logoX, logoY, logoSize, logoSize);
    } catch {
      doc.setFillColor(255, 255, 255);
      doc.circle(margin + 12, 21, 11, "F");
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(ORG_NAME, margin + 35, 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(ORG_CHAPTER, margin + 35, 26);
    doc.setFontSize(10);
    doc.text("APPLICANT PROFILE REPORT", margin + 35, 35);

    const dateStr = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    doc.setFontSize(9);
    doc.text(`Generated: ${dateStr}`, pageWidth - margin, 35, { align: "right" });
    doc.text(`Application ID: ${application.id}`, pageWidth - margin, 27, { align: "right" });

    // Profile image holder (circular)
    const profileCircleX = margin;
    const profileCircleY = 52;
    const profileCircleDiameter = 28;
    doc.setDrawColor(238, 135, 36);
    doc.setLineWidth(1.2);
    doc.circle(profileCircleX + profileCircleDiameter / 2, profileCircleY + profileCircleDiameter / 2, profileCircleDiameter / 2, "S");
    let circleDataUrl: string | null = null;
    const profileSource = String(data.profilePicture || "").trim();
    const hasCandidate = getProfileImageCandidates(profileSource).length > 0;
    if (profileSource && hasCandidate) {
      const proxiedImage = await getApplicantImageDataUrl(profileSource);
      if (proxiedImage.success && proxiedImage.dataUrl) {
        circleDataUrl = await loadImageAsCircleDataUrl(proxiedImage.dataUrl, 360);
      }
    }
    if (!circleDataUrl) {
      const cachedTransformed = getTransformedProfileLinkWithCache(profileSource);
      if (cachedTransformed) {
        circleDataUrl = await loadImageAsCircleDataUrl(cachedTransformed, 360);
      }
    }
    if (!circleDataUrl) {
      circleDataUrl = await loadFirstWorkingCircleDataUrl(data.profilePicture, 360);
    }
    if (!circleDataUrl) {
      circleDataUrl = await loadCircleDataUrlLikeMyQR(data.profilePicture, 360);
    }
    if (circleDataUrl) {
      doc.addImage(circleDataUrl, "PNG", profileCircleX, profileCircleY, profileCircleDiameter, profileCircleDiameter);
    }

    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(data.fullName || application.name || "Unnamed Applicant", margin + 36, 60);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`${data.email || application.email || "N/A"} | ${data.phone || application.phone || "N/A"}`, margin + 36, 66);

    const baseRows: [string, string][] = [
      ["Date Applied", formatDateSafe(application.dateApplied)],
      ["Committee", data.committeePreference || application.committee || "N/A"],
      ["Desired Role", data.desiredRole || "N/A"],
      ["Chapter", data.chapter || "N/A"],
      ["Gender", data.gender || "N/A"],
      ["Date of Birth", formatDateSafe(data.dateOfBirth)],
      ["Age", data.age ? `${data.age}` : "N/A"],
      ["Civil Status", data.civilStatus || "N/A"],
      ["Nationality", data.nationality || "N/A"],
      ["Address", data.address || "N/A"],
      ["Emergency Contact", data.emergencyContactName || "N/A"],
      ["Emergency Relation", data.emergencyContactRelation || "N/A"],
      ["Emergency Number", data.emergencyContactNumber || "N/A"],
      ["Facebook", data.facebook || "N/A"],
      ["Instagram", data.instagram || "N/A"],
      ["Twitter/X", data.twitter || "N/A"],
    ];

    autoTable(doc, {
      startY: 76,
      head: [["Field", "Value"]],
      body: baseRows,
      styles: { fontSize: 9, cellPadding: 2.5, overflow: "linebreak" },
      headStyles: { fillColor: [246, 66, 31], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 52, fontStyle: "bold" },
        1: { cellWidth: 118 },
      },
      margin: { left: margin, right: margin, bottom: 22 },
    });

    let currentY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || 74;
    const sectionFields: Array<{ title: string; content?: string }> = [
      { title: "Skills", content: data.skills },
      { title: "Education", content: data.education },
      { title: "Certifications", content: data.certifications },
      { title: "Experience", content: data.experience },
      { title: "Achievements", content: data.achievements },
      { title: "Volunteer History", content: data.volunteerHistory },
      { title: "Reason for Joining", content: data.reasonForJoining },
      { title: "Personal Statement", content: data.personalStatement },
    ];
    const filledSections = sectionFields.filter((s) => (s.content || "").trim().length > 0);
    if (filledSections.length > 0) {
      autoTable(doc, {
        startY: currentY + 6,
        head: [["Section", "Details"]],
        body: filledSections.map((s) => [s.title, s.content || ""]),
        styles: { fontSize: 9, cellPadding: 2.5, overflow: "linebreak" },
        headStyles: { fillColor: [238, 135, 36], textColor: 255 },
        columnStyles: {
          0: { cellWidth: 52, fontStyle: "bold" },
          1: { cellWidth: 118 },
        },
        margin: { left: margin, right: margin, bottom: 22 },
      });
      currentY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || currentY;
    }

    const extraRows = Object.entries(data.additionalFields || {}).map(([k, v]) => [k, v]);
    if (extraRows.length > 0) {
      autoTable(doc, {
        startY: currentY + 6,
        head: [["Extra Column", "Value"]],
        body: extraRows,
        styles: { fontSize: 8.5, cellPadding: 2.2, overflow: "linebreak" },
        headStyles: { fillColor: [99, 102, 112], textColor: 255 },
        columnStyles: {
          0: { cellWidth: 70, fontStyle: "bold" },
          1: { cellWidth: 100 },
        },
        margin: { left: margin, right: margin, bottom: 22 },
      });
    }

    const totalPages = doc.getNumberOfPages();
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      doc.setPage(pageNum);
      doc.setDrawColor(246, 66, 31);
      doc.setLineWidth(0.5);
      doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);

      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      doc.setFont("helvetica", "normal");
      doc.text(`${ORG_NAME} - ${ORG_CHAPTER}`, margin, pageHeight - 10);
      doc.setFont("helvetica", "italic");
      doc.text(`"${ORG_MOTTO}"`, pageWidth / 2, pageHeight - 10, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: "right" });
    }

    doc.save(`YSP_Application_${application.id}.pdf`);
    toast.success("Applicant PDF downloaded.");
  };

  return (
    <>
      <PageLayout
        title="Manage Members"
        subtitle="Oversee member roster and pending applications"
        isDark={isDark}
        onClose={onClose}
        breadcrumbs={[
          { label: "Home", onClick: onClose },
          { label: "Dashboard & Directory", onClick: undefined },
          { label: "Manage Members", onClick: undefined },
        ]}
      >
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {isLoading ? (
            <>
              <StatsCardSkeleton isDark={isDark} />
              <StatsCardSkeleton isDark={isDark} />
              <StatsCardSkeleton isDark={isDark} />
            </>
          ) : (
            <>
              <div
                className="rounded-xl p-6 border"
                style={{
                  background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
                  backdropFilter: 'blur(20px)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
              >
                <p className="text-muted-foreground text-sm mb-2">Total Members</p>
                <h3
                  style={{
                    fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.h1}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    color: DESIGN_TOKENS.colors.brand.red,
                  }}
                >
                  {totalMembers}
                </h3>
              </div>

              <div
                className="rounded-xl p-6 border"
                style={{
                  background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
                  backdropFilter: 'blur(20px)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
              >
                <p className="text-muted-foreground text-sm mb-2">Active Members</p>
                <h3
                  style={{
                    fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.h1}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    color: "#10b981",
                  }}
                >
                  {activeMembers}
                </h3>
              </div>

              <div
                className="rounded-xl p-6 border"
                style={{
                  background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
                  backdropFilter: 'blur(20px)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
              >
                <p className="text-muted-foreground text-sm mb-2">Pending Applications</p>
                <h3
                  style={{
                    fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.h1}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    color: DESIGN_TOKENS.colors.brand.orange,
                  }}
                >
                  {pendingCount}
                </h3>
              </div>
            </>
          )}
        </div>

        {isPendingPageView ? (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs sm:text-sm mb-1">
                  <button
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    onClick={closePendingsPage}
                  >
                    Manage Members
                  </button>
                  <span className="text-muted-foreground/70">/</span>
                  <span
                    style={{
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                      color: DESIGN_TOKENS.colors.brand.orange,
                    }}
                  >
                    Pending Applications
                  </span>
                  {selectedApplicantIdInUrl && (
                    <>
                      <span className="text-muted-foreground/70">/</span>
                      <span className="text-muted-foreground truncate max-w-[180px] sm:max-w-[260px]">
                        {selectedApplicantForTrail?.name || selectedApplicantIdInUrl}
                      </span>
                    </>
                  )}
                </div>
                <h3
                  style={{
                    fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.h2}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    color: DESIGN_TOKENS.colors.brand.red,
                  }}
                >
                  Pending Applications ({pendingCount})
                </h3>
              </div>
              <Button variant="secondary" size="sm" onClick={closePendingsPage}>
                Back to Members
              </Button>
            </div>

            <div
              className="rounded-xl p-4 border mb-5"
              style={{
                background: isDark ? 'rgba(30, 41, 59, 0.55)' : 'rgba(255, 255, 255, 0.75)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              <div className="flex flex-col gap-3">
                <label
                  className="text-sm"
                  style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}
                >
                  Google Sheet Link
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={sheetUrlInput}
                    onChange={(e) => setSheetUrlInput(e.target.value)}
                    placeholder="Paste Google Sheet URL here..."
                    className="flex-1 px-3 py-2 rounded-lg border text-sm bg-white dark:bg-gray-900"
                    style={{
                      borderColor: isDark ? "rgba(255, 255, 255, 0.16)" : "rgba(0, 0, 0, 0.15)",
                    }}
                  />
                  <Button
                    variant="primary"
                    onClick={handleSyncApplicants}
                    disabled={isSyncingApplicants}
                  >
                    {isSyncingApplicants ? "Syncing..." : "Sync"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={loadSyncedApplicants}
                    disabled={isLoadingSyncedApplicants || isSyncingApplicants}
                  >
                    {isLoadingSyncedApplicants ? "Loading..." : "Reload"}
                  </Button>
                </div>
                {(syncedSheetName || syncedHeaders.length > 0 || lastSyncedAt) && (
                  <div className="text-xs text-muted-foreground">
                    <span>Sheet: {syncedSheetName || "Unknown"}</span>
                    <span className="mx-2">|</span>
                    <span>Rows: {syncedRowCount}</span>
                    <span className="mx-2">|</span>
                    <span>Headers: {syncedHeaders.length}</span>
                    {lastSyncedAt && (
                      <>
                        <span className="mx-2">|</span>
                        <span>Last Synced: {new Date(lastSyncedAt).toLocaleString()}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {pendingApplicationsList.map((application) => (
                <div
                  key={application.id}
                  className="rounded-xl p-6 border cursor-pointer hover:shadow-lg transition-all"
                  style={{
                    background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }}
                  onClick={() => handleViewApplication(application)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4
                        className="mb-2"
                        style={{
                          fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                          fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                          fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                          color: DESIGN_TOKENS.colors.brand.orange,
                        }}
                      >
                        {application.name}
                      </h4>
                      <p className="text-sm text-muted-foreground mb-1">{application.email}</p>
                      <p className="text-sm text-muted-foreground mb-2">{application.phone}</p>
                    </div>
                    <button
                      className="px-3 py-1.5 rounded-lg text-white text-sm transition-all hover:scale-105"
                      style={{
                        background: "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)",
                        fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                      }}
                    >
                      View Application
                    </button>
                  </div>
                </div>
              ))}

              {pendingApplicationsList.length === 0 && (
                <div className="text-center py-12">
                  <Clock className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                  <p className="text-muted-foreground">No pending applications</p>
                </div>
              )}
            </div>
          </div>
        ) : (
        <>
        {/* Search and Filters */}
        <div className="flex flex-col gap-4 mb-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, ID, or email..."
              className="w-full pl-12 pr-4 py-3 rounded-xl border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20 transition-all outline-none"
              style={{
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <CustomDropdown
              value={filterRole}
              onChange={setFilterRole}
              options={[
                { value: "all", label: "All Roles" },
                { value: "Admin", label: "Admin" },
                { value: "Officer", label: "Officer" },
                { value: "Member", label: "Member" },
                { value: "Volunteer", label: "Volunteer" },
              ]}
              isDark={isDark}
              size="md"
              className="min-w-[180px]"
            />

            <CustomDropdown
              value={filterCommittee}
              onChange={setFilterCommittee}
              options={[
                { value: "all", label: "All Committees" },
                { value: "Executive Board", label: "Executive Board" },
                { value: "Membership and Internal Committee", label: "Membership and Internal Affairs Committee" },
                { value: "External Relations Committee", label: "External Relations Committee" },
                { value: "Secretariat and Documentation Committee", label: "Secretariat and Documentation Committee" },
                { value: "Finance and Treasury Committee", label: "Finance and Treasury Committee" },
                { value: "Program Development Committee", label: "Program Development Committee" },
                { value: "Communications and Marketing Committee", label: "Communications and Marketing Committee" },
              ]}
              isDark={isDark}
              size="md"
              className="min-w-[180px]"
            />
          </div>
        </div>

        {/* Controls Row: View Mode Toggle + Actions */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-6">
          <button
            onClick={() => setViewMode(viewMode === "table" ? "tile" : "table")}
            className="self-start md:self-auto w-fit px-4 py-2 rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 hover:shadow-md"
            style={{
              background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.red} 0%, ${DESIGN_TOKENS.colors.brand.orange} 100%)`,
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
              border: "none",
            }}
          >
            {viewMode === "table" ? <TableIcon className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
            <span className="hidden sm:inline">{viewToggleLabel}</span>
          </button>
          <div className="flex flex-wrap gap-2 justify-end">
            <Button
              variant="secondary"
              onClick={openPendingsPage}
              icon={<Clock className="w-5 h-5" />}
              size="sm"
            >
              <span className="hidden sm:inline">Pendings</span> ({pendingCount})
            </Button>
            <div style={{ minWidth: 140 }}>
              <CustomDropdown
                value={exportType}
                onChange={setExportType}
                options={[
                  { value: "csv", label: "Export as CSV" },
                  { value: "pdf", label: "Export as PDF" },
                ]}
                placeholder="Export"
                isDark={isDark}
                size="sm"
              />
            </div>
            <Button
              variant="primary"
              onClick={() => setShowAddMemberModal(true)}
              icon={<UserPlus className="w-5 h-5" />}
              size="sm"
            >
              <span className="hidden sm:inline">Add</span>
            </Button>
          </div>
        </div>

        {/* Tile View */}
        {viewMode === "tile" && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading ? (
              // Skeleton loading for tiles
              Array.from({ length: 6 }).map((_, i) => (
                <MemberTileSkeleton key={i} isDark={isDark} />
              ))
            ) : filteredMembers.length > 0 ? (
              paginatedMembers.map((member) => (
                <div 
                  key={member.id} 
                  className="p-4 rounded-xl border transition-all hover:shadow-lg"
                  style={{
                    background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
                    backdropFilter: 'blur(20px)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="text-sm mb-1" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                        {member.name}
                      </div>
                      <div className="text-xs text-muted-foreground mb-1">{member.email}</div>
                      <div className="text-xs text-muted-foreground">{member.id}</div>
                      {(member.emergencyContact || member.emergencyPhone) && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Emergency: {member.emergencyContact || "N/A"}{member.emergencyPhone ? ` | ${member.emergencyPhone}` : ""}
                        </div>
                      )}
                    </div>
                    <span
                      className="px-2 py-1 rounded-full text-xs"
                      style={{
                        backgroundColor: member.status === "Active" ? "#10b98120" : "#6b728020",
                        color: member.status === "Active" ? "#10b981" : "#6b7280",
                        fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                      }}
                    >
                      {member.status}
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span
                      className="px-2 py-1 rounded-full text-xs"
                      style={{
                        backgroundColor:
                          member.role === "Admin"
                            ? "#f6421f20"
                            : member.role === "Officer"
                            ? "#ee872420"
                            : "#10b98120",
                        color:
                          member.role === "Admin"
                            ? "#f6421f"
                            : member.role === "Officer"
                            ? "#ee8724"
                            : "#10b981",
                        fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                      }}
                    >
                      {member.role}
                    </span>
                    <span className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800">
                      {member.position}
                    </span>
                  </div>
                  
                  <div className="text-xs text-muted-foreground mb-3">{member.committee}</div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedMember(member);
                        setShowViewMemberModal(true);
                      }}
                      className="flex-1 p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm"
                    >
                      <Eye className="w-4 h-4 inline mr-1" />
                      View
                    </button>
                    <button
                      onClick={() => {
                        setSelectedMember(member);
                        setShowEditMemberModal(true);
                      }}
                      className="flex-1 p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm"
                    >
                      <Edit className="w-4 h-4 inline mr-1" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleSendEmail(member.email)}
                      className="flex-1 p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm"
                    >
                      <Mail className="w-4 h-4 inline mr-1" />
                      Email
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <User className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <p className="text-muted-foreground">No members found matching your criteria</p>
              </div>
            )}
          </div>
        )}

        {viewMode === "tile" && !error && !isLoading && (
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredMembers.length}
            pageSize={ITEMS_PER_PAGE}
            isDark={isDark}
            onPageChange={setCurrentPage}
          />
        )}

        {/* Table View */}
        {viewMode === "table" && !error && (
          isLoading ? (
            // Skeleton loading for table
            <MemberTableSkeleton isDark={isDark} rows={5} />
          ) : (
            <div className="overflow-x-auto rounded-xl border" style={{
              borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
              background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(255, 255, 255, 0.5)",
            }}>
              <table className="w-full">
                <thead className="bg-gray-100 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                      ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                      Position
                    </th>
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                      Committee
                    </th>
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {paginatedMembers.map((member) => (
                    <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {member.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                            {member.name}
                          </div>
                          <div className="text-xs text-muted-foreground">{member.email}</div>
                          {(member.emergencyContact || member.emergencyPhone) && (
                            <div className="text-xs text-muted-foreground">
                              Emergency: {member.emergencyContact || "N/A"}{member.emergencyPhone ? ` | ${member.emergencyPhone}` : ""}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {member.position}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className="px-2 py-1 rounded-full text-xs"
                          style={{
                            backgroundColor:
                              member.role === "Admin"
                                ? "#f6421f20"
                                : member.role === "Officer"
                                ? "#ee872420"
                                : "#10b98120",
                            color:
                              member.role === "Admin"
                                ? "#f6421f"
                                : member.role === "Officer"
                                ? "#ee8724"
                                : "#10b981",
                            fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                          }}
                        >
                          {member.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">{member.committee}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className="px-2 py-1 rounded-full text-xs"
                          style={{
                            backgroundColor: member.status === "Active" ? "#10b98120" : "#6b728020",
                            color: member.status === "Active" ? "#10b981" : "#6b7280",
                            fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                          }}
                        >
                          {member.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedMember(member);
                              setShowViewMemberModal(true);
                            }}
                            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedMember(member);
                              setShowEditMemberModal(true);
                            }}
                            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleSendEmail(member.email)}
                            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            title="Send Email"
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {filteredMembers.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <User className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                  <p className="text-muted-foreground">No members found matching your criteria</p>
                </div>
              )}
            </div>
          )
        )}

        {viewMode === "table" && !error && !isLoading && (
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredMembers.length}
            pageSize={ITEMS_PER_PAGE}
            isDark={isDark}
            onPageChange={setCurrentPage}
          />
        )}
        </>
        )}
      </PageLayout>

      {/* ===========================================
        MODALS - MOVED OUTSIDE PAGE LAYOUT
        ===========================================
        This ensures they stack ON TOP of the PageLayout 
        (and its sticky header) rather than being trapped inside it.
      */}

      {/* Application Panel (Resume Style) */}
      {selectedApplication && (
        <ApplicationPanel
          key={selectedApplication.id}
          application={selectedApplication}
          isDark={isDark}
          onClose={clearApplicantTrail}
          onApprove={handleApproveApplication}
          onReject={handleRejectApplication}
          onSendEmail={handleSendEmail}
          onDownload={handleDownloadApplicationPDF}
        />
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <AddMemberModal
          isDark={isDark}
          onClose={() => setShowAddMemberModal(false)}
          onSave={(newMember) => {
            setMembers([...members, { ...newMember, id: `MEM-00${members.length + 1}`, dateJoined: new Date().toISOString().split('T')[0] }]);
            setShowAddMemberModal(false);
            toast.success("Member added successfully!");
          }}
        />
      )}

      {/* Edit Member Modal */}
      {showEditMemberModal && selectedMember && (
        <EditMemberModal
          isDark={isDark}
          member={selectedMember}
          onClose={() => {
            setShowEditMemberModal(false);
            setSelectedMember(null);
          }}
          onSave={async (updatedMember, signal) => {
            if (!updatedMember.username) {
              throw new Error("Member username is missing. Please refresh the list and try again.");
            }

            const updateData: Partial<UserProfile> = {};
            if (selectedMember) {
              if (updatedMember.name !== selectedMember.name) updateData.fullName = updatedMember.name;
              if (updatedMember.position !== selectedMember.position) updateData.position = updatedMember.position;
              if (updatedMember.role !== selectedMember.role) updateData.role = updatedMember.role;
              if (updatedMember.committee !== selectedMember.committee) updateData.committee = updatedMember.committee;
              if (updatedMember.status !== selectedMember.status) updateData.status = updatedMember.status;
            } else {
              updateData.fullName = updatedMember.name;
              updateData.position = updatedMember.position;
              updateData.role = updatedMember.role;
              updateData.committee = updatedMember.committee;
              updateData.status = updatedMember.status;
            }

            if (Object.keys(updateData).length === 0) {
              return;
            }

            await updateUserProfileAsAdmin(
              updatedMember.username,
              updateData,
              currentUserName,
              signal
            );

            setMembers(members.map(m => m.id === updatedMember.id ? updatedMember : m));
            clearDirectoryCache();
            setShowEditMemberModal(false);
            setSelectedMember(null);
          }}
          addUploadToast={addUploadToast}
          updateUploadToast={updateUploadToast}
        />
      )}

      {/* View Member Modal */}
      {showViewMemberModal && selectedMember && (
        <ViewMemberModal
          isDark={isDark}
          member={selectedMember}
          onClose={() => {
            setShowViewMemberModal(false);
            setSelectedMember(null);
          }}
          onEdit={() => {
            setShowViewMemberModal(false);
            setShowEditMemberModal(true);
          }}
        />
      )}

      {/* Account Creation Modal */}
      {showAccountModal && (
        <AccountCreationModal
          isOpen={showAccountModal}
          isDark={isDark}
          applicantData={selectedApplication?.fullData ?? {
            fullName: "",
            email: "",
            committeePreference: "",
            desiredRole: "",
          }}
          onClose={() => setShowAccountModal(false)}
          onCreateAccount={(_data) => {
             // ... handle creation
             setShowAccountModal(false);
          }}
        />
      )}

      {/* Upload Toast Container - Progress bars at bottom-right */}
      <UploadToastContainer
        messages={uploadToastMessages}
        onDismiss={removeUploadToast}
        isDark={isDark}
      />
    </>
  );
}

// Application Panel Component (Resume Style)
interface ApplicationPanelProps {
  application: PendingApplication;
  isDark: boolean;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onSendEmail: (email: string) => void;
  onDownload: (application: PendingApplication) => void;
}

function ApplicationPanel({
  application,
  isDark,
  onClose,
  onApprove,
  onReject,
  onSendEmail,
  onDownload,
}: ApplicationPanelProps) {
  const data = application.fullData;
  const [adminNotes, setAdminNotes] = useState("");
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [profileImageFailed, setProfileImageFailed] = useState(false);
  const [profileImageIndex, setProfileImageIndex] = useState(0);
  const [proxiedProfileSrc, setProxiedProfileSrc] = useState("");
  const [cachedTransformedProfileSrc, setCachedTransformedProfileSrc] = useState("");
  const [actionMenuValue, setActionMenuValue] = useState("");
  const panelScrollRef = useRef<HTMLDivElement | null>(null);
  const lastProxySourceRef = useRef("");
  const profileImageCandidates = useMemo(
    () => getProfileImageCandidates(data.profilePicture),
    [data.profilePicture]
  );
  const normalizedProfileUrl = profileImageCandidates[profileImageIndex] || "";
  const displayedProfileUrl = proxiedProfileSrc || cachedTransformedProfileSrc || normalizedProfileUrl;

  useEffect(() => {
    logApplicantFrontDebug(`panel open ${application.id}`, application);
  }, [application]);

  useEffect(() => {
    setProfileImageFailed(false);
    setProfileImageIndex(0);
    setProxiedProfileSrc("");
    lastProxySourceRef.current = "";
    setCachedTransformedProfileSrc(getTransformedProfileLinkWithCache(data.profilePicture));
  }, [application.id, data.profilePicture]);

  useEffect(() => {
    let active = true;
    const source = (data.profilePicture || "").trim();
    const candidates = getProfileImageCandidates(source);
    if (!source || candidates.length === 0 || source.startsWith("data:")) {
      return () => { active = false; };
    }
    if (lastProxySourceRef.current === source) {
      return () => { active = false; };
    }
    lastProxySourceRef.current = source;

    (async () => {
      const result = await getApplicantImageDataUrl(source);
      if (!active) return;
      if (result.success && result.dataUrl) {
        setProxiedProfileSrc(result.dataUrl);
      }
    })();

    return () => {
      active = false;
    };
  }, [data.profilePicture]);

  useEffect(() => {
    if (panelScrollRef.current) {
      panelScrollRef.current.scrollTop = 0;
    }
  }, [application.id]);

  const handleApproveClick = () => {
    setShowAccountModal(true);
  };

  const handleActionMenuChange = (value: string) => {
    setActionMenuValue("");
    if (value === "reject") {
      onReject(application.id);
      return;
    }
    if (value === "email") {
      onSendEmail(data.email);
      return;
    }
    if (value === "download") {
      onDownload(application);
      return;
    }
    if (value === "close") {
      onClose();
    }
  };

  const handleAccountCreation = (accountData: any) => {
    console.log("Account created:", accountData);

    toast.success("Account Created Successfully!", {
      description: `Welcome email sent to ${data.email}`,
    });

    setShowAccountModal(false);
    onApprove(application.id);
    onClose();
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
        onClick={onClose}
      >
        <div
          ref={panelScrollRef}
          className="rounded-2xl shadow-2xl p-4 sm:p-5 lg:p-6 w-full max-w-[720px] md:max-w-[760px] lg:max-w-[800px] max-h-[80vh] overflow-y-auto border my-2 sm:my-4"
          style={{
            background: isDark ? 'rgba(17, 24, 39, 0.98)' : 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(20px)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4 sm:gap-6 mb-8 pb-6 border-b" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 flex-1 min-w-0">
              <div
                className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 rounded-full flex items-center justify-center bg-gradient-to-br from-[#f6421f] to-[#ee8724] text-white overflow-hidden shrink-0"
                style={{ border: '4px solid #ee8724' }}
              >
                {displayedProfileUrl && !profileImageFailed ? (
                  <img
                    src={displayedProfileUrl}
                    alt={data.fullName}
                    className="w-full h-full object-cover"
                    onError={() => {
                      if (proxiedProfileSrc) {
                        setProxiedProfileSrc("");
                        return;
                      }
                      if (profileImageIndex < profileImageCandidates.length - 1) {
                        setProfileImageIndex((prev) => prev + 1);
                        return;
                      }
                      setProfileImageFailed(true);
                    }}
                  />
                ) : (
                  <span className="text-3xl sm:text-4xl" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.bold }}>
                    {data.fullName.charAt(0)}
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h2
                  className="mb-2 text-2xl sm:text-3xl break-words"
                  style={{
                    fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
                    color: DESIGN_TOKENS.colors.brand.red,
                  }}
                >
                  {data.fullName}
                </h2>
                <p className="text-muted-foreground mb-1 flex items-center gap-2 break-all">
                  <Mail className="w-4 h-4" />
                  {data.email}
                </p>
                <p className="text-muted-foreground mb-1 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  {data.phone || "N/A"}
                </p>
                <p className="text-muted-foreground flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {data.address || "N/A"}
                </p>
              </div>
            </div>

            <div className="w-full xl:w-auto flex flex-row xl:flex-col items-stretch gap-2 xl:min-w-[220px]">
              <button
                onClick={handleApproveClick}
                className="px-3 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white transition-all flex items-center justify-center gap-2 text-sm"
                style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}
              >
                <CheckCircle className="w-4 h-4" />
                Approve
              </button>
              <CustomDropdown
                value={actionMenuValue}
                onChange={handleActionMenuChange}
                placeholder="More actions"
                isDark={isDark}
                size="sm"
                variant="outlined"
                className="min-w-[150px] sm:min-w-[180px] flex-1 xl:flex-none"
                options={[
                  { value: "email", label: "Send Email" },
                  { value: "download", label: "Download PDF" },
                  { value: "reject", label: "Reject Application" },
                  { value: "close", label: "Close Panel" },
                ]}
              />
              <button
                onClick={onClose}
                className="px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-all flex items-center justify-center"
                title="Close panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {(() => {
            const infoCards = [
              hasContent(data.gender) ? { title: "Gender", value: data.gender } : null,
              hasContent(data.pronouns) ? { title: "Pronouns", value: data.pronouns || "" } : null,
              hasContent(data.dateOfBirth) ? { title: "Date of Birth", value: formatDateSafe(data.dateOfBirth) } : null,
              hasContent(data.age) ? { title: "Age", value: `${data.age} years old` } : null,
              hasContent(data.civilStatus) ? { title: "Civil Status", value: data.civilStatus } : null,
              hasContent(data.nationality) ? { title: "Nationality", value: data.nationality } : null,
              hasContent(data.religion) ? { title: "Religion", value: data.religion || "" } : null,
              hasContent(data.chapter) ? { title: "YSP Chapter", value: data.chapter } : null,
              hasContent(data.committeePreference) ? { title: "Committee Preference", value: data.committeePreference } : null,
              hasContent(data.desiredRole) ? { title: "Desired Role", value: data.desiredRole } : null,
            ].filter(Boolean) as { title: string; value: string }[];

            if (infoCards.length === 0) return null;

            return (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {infoCards.map((card) => (
                  <InfoCard key={card.title} title={card.title} value={card.value} isDark={isDark} />
                ))}
              </div>
            );
          })()}

          {data.skills && <DetailCard title="Skills" content={data.skills} isDark={isDark} />}
          {data.education && <DetailCard title="Education" content={data.education} isDark={isDark} />}
          {data.certifications && <DetailCard title="Certifications" content={data.certifications} isDark={isDark} />}
          {data.experience && <DetailCard title="Experience" content={data.experience} isDark={isDark} />}
          {data.achievements && <DetailCard title="Achievements" content={data.achievements} isDark={isDark} />}
          {data.volunteerHistory && <DetailCard title="Volunteer History" content={data.volunteerHistory} isDark={isDark} />}
          {data.reasonForJoining && <DetailCard title="Reason for Joining" content={data.reasonForJoining} isDark={isDark} />}
          {data.personalStatement && <DetailCard title="Personal Statement" content={data.personalStatement} isDark={isDark} />}
          {data.medicalConcerns && <DetailCard title="Medical Concerns" content={data.medicalConcerns} isDark={isDark} />}
          {data.additionalFields && Object.keys(data.additionalFields).length > 0 && (
            <DetailCard
              title="Additional Form Fields"
              content={Object.entries(data.additionalFields)
                .map(([k, v]) => `${k}: ${v}`)
                .join("\n")}
              isDark={isDark}
            />
          )}

          {(data.emergencyContactName || data.emergencyContactRelation || data.emergencyContactNumber) && (
            <div className="mb-6">
              <h4
                className="mb-3"
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  color: DESIGN_TOKENS.colors.brand.orange,
                }}
              >
                Emergency Contact
              </h4>
              <div className="grid md:grid-cols-3 gap-4">
                {hasContent(data.emergencyContactName) && (
                  <InfoCard title="Name" value={data.emergencyContactName || ""} isDark={isDark} />
                )}
                {hasContent(data.emergencyContactRelation) && (
                  <InfoCard title="Relation" value={data.emergencyContactRelation || ""} isDark={isDark} />
                )}
                {hasContent(data.emergencyContactNumber) && (
                  <InfoCard title="Contact" value={data.emergencyContactNumber || ""} isDark={isDark} />
                )}
              </div>
            </div>
          )}

          {(data.facebook || data.instagram || data.twitter) && (
            <div className="mb-6">
              <h4
                className="mb-3"
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  color: DESIGN_TOKENS.colors.brand.orange,
                }}
              >
                Social Media
              </h4>
              <div className="grid md:grid-cols-3 gap-4">
                {data.facebook && <InfoCard title="Facebook" value={data.facebook} isDark={isDark} />}
                {data.instagram && <InfoCard title="Instagram" value={data.instagram} isDark={isDark} />}
                {data.twitter && <InfoCard title="Twitter" value={data.twitter} isDark={isDark} />}
              </div>
            </div>
          )}

          {data.attachments && data.attachments.length > 0 && (
            <div className="mb-6">
              <h4
                className="mb-3"
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  color: DESIGN_TOKENS.colors.brand.orange,
                }}
              >
                Attachments
              </h4>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.attachments.map((attachment, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg p-4 border"
                    style={{
                      background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    <p className="text-sm text-muted-foreground mb-1">{attachment.type}</p>
                    <p className="text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}>
                      {attachment.name}
                    </p>
                    <div className="mb-3 overflow-hidden rounded-md border" style={{ borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)' }}>
                      <img
                        src={normalizeProfileImageUrl(attachment.thumbnailUrl || attachment.url)}
                        alt={attachment.name}
                        className="w-full h-28 object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="text-xs px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                        onClick={() => window.open(attachment.url, '_blank')}
                      >
                        View
                      </button>
                      <button
                        className="text-xs px-2 py-1 rounded bg-green-500 text-white hover:bg-green-600 transition-colors"
                        onClick={() => window.open(toDriveDownloadUrl(attachment.url), '_blank')}
                      >
                        Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div
            className="rounded-lg p-4 border mt-6"
            style={{
              background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
          >
            <h4
              className="mb-3"
              style={{
                fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                color: DESIGN_TOKENS.colors.brand.orange,
              }}
            >
              Admin Notes
            </h4>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Add internal notes about this application..."
              className="w-full px-4 py-3 rounded-lg border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20 transition-all outline-none resize-none"
              rows={3}
              style={{
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            />
          </div>
        </div>
      </div>

      {showAccountModal && (
        <AccountCreationModal
          isOpen={showAccountModal}
          isDark={isDark}
          applicantData={data}
          onClose={() => setShowAccountModal(false)}
          onCreateAccount={handleAccountCreation}
        />
      )}
    </>
  );
}

// Helper Components
interface InfoCardProps {
  title: string;
  value: string;
  isDark: boolean;
}

function InfoCard({ title, value, isDark }: InfoCardProps) {
  return (
    <div
      className="rounded-lg p-4 border"
      style={{
        background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      }}
    >
      <p className="text-xs text-muted-foreground mb-1">{title}</p>
      <p className="text-sm" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}>
        {value}
      </p>
    </div>
  );
}

interface DetailCardProps {
  title: string;
  content: string;
  isDark: boolean;
}

function DetailCard({ title, content, isDark }: DetailCardProps) {
  return (
    <div className="mb-6">
      <h4
        className="mb-2"
        style={{
          fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
          fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
          fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
          color: DESIGN_TOKENS.colors.brand.orange,
        }}
      >
        {title}
      </h4>
      <div
        className="rounded-lg p-4 border"
        style={{
          background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        }}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
}


