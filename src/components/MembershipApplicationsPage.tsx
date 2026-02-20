/**
 * =============================================================================
 * MEMBERSHIP APPLICATIONS PAGE
 * =============================================================================
 * 
 * Enhanced View: List of Opportunities with filters, view modes, and improved UI.
 * 
 * Features:
 * - View Modes: Grid (Tile) vs List (Table)
 * - Filtering: Status (All, Open, Closed, etc.)
 * - Search: Real-time text search
 * - Skeleton Loading: Loading state on mount
 * - Detail View: Modal for viewing full details
 * 
 * =============================================================================
 */

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  Plus, Edit, Trash2, Calendar, Clock, ExternalLink,
  Lock, Unlock, Archive, CheckCircle, Eye, EyeOff,
  AlertCircle, ChevronDown, Search,
  LayoutGrid, List as ListIcon, Filter, X, RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { PageLayout, Button, DESIGN_TOKENS, getGlassStyle } from "./design-system";
import CreateOpportunityModalEnhanced from "./CreateOpportunityModalEnhanced";
import CustomDropdown from "./CustomDropdown";
import { SkeletonCardGrid } from "./SkeletonCard";
import { type UploadToastMessage } from "./UploadToast";
import { type PendingApplication } from "../types/app";
import { 
  fetchOpportunities, 
  addOpportunity, 
  updateOpportunity, 
  deleteOpportunity 
} from "../services/gasApplicationsService";

const MANILA_TIME_ZONE = "Asia/Manila";
const OPPORTUNITIES_PAGE_LINK = "/visitor?page=Opportunities";

function normalizeRoleValue(role: string): string {
  return String(role || "").trim().toLowerCase();
}

function roleToPathSlug(role: string): string {
  const normalized = normalizeRoleValue(role);
  if (!normalized) return "guest";
  const slug = normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "guest";
}

function hasOpportunityManagementAccess(role: string): boolean {
  const normalized = normalizeRoleValue(role);
  if (!normalized) return false;
  if (["auditor", "admin", "assistant auditor 1", "assistant auditor 2", "assistant admin 1", "assistant admin 2", "founder"].includes(normalized)) {
    return true;
  }
  if (normalized.includes("auditor") || normalized.includes("admin")) {
    return true;
  }
  return false;
}

export interface ApplicationOpportunity {
  id: string;
  title: string;
  description: string;
  startDate: string; // ISO string or "YYYY-MM-DDTHH:mm"
  endDate: string;   // ISO string or "YYYY-MM-DDTHH:mm"
  status: "open" | "closed" | "completed" | "archived";
  visibility: "public" | "hidden";
  link: string;
}

interface MembershipApplicationsPageProps {
  onClose: () => void;
  isDark: boolean;
  userRole: string;
  isLoggedIn?: boolean;
  pendingApplications?: PendingApplication[];
  setPendingApplications?: (apps: PendingApplication[]) => void;
  username?: string;
  onModalStateChange?: (isOpen: boolean) => void;
  addUploadToast?: (message: UploadToastMessage) => void;
  updateUploadToast?: (id: string, updates: Partial<UploadToastMessage>) => void;
  removeUploadToast?: (id: string) => void;
}

export default function MembershipApplicationsPage({
  onClose,
  isDark,
  userRole,
  isLoggedIn = false,
  onModalStateChange,
  addUploadToast = () => {},
  updateUploadToast = () => {},
  removeUploadToast = () => {},
}: MembershipApplicationsPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isArchivedOpen, setIsArchivedOpen] = useState(false);
  const [opportunities, setOpportunities] = useState<ApplicationOpportunity[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingOpportunity, setEditingOpportunity] = useState<ApplicationOpportunity | null>(null);
  const [viewingOpportunity, setViewingOpportunity] = useState<ApplicationOpportunity | null>(null);
  const [isSavingOpportunity, setIsSavingOpportunity] = useState(false);

  const canManageOpportunities = hasOpportunityManagementAccess(userRole);

  const getRolePathSegment = useCallback((role: string) => roleToPathSlug(role), []);

  const setOpportunityIdInUrl = useCallback((opportunityId: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (opportunityId) {
      params.set("id", opportunityId);
    } else {
      params.delete("id");
    }
    const nextSearch = params.toString();
    const currentSearch = location.search.startsWith("?") ? location.search.slice(1) : location.search;
    if (nextSearch === currentSearch) return;
    navigate(`${location.pathname}${nextSearch ? `?${nextSearch}` : ""}`, { replace: true });
  }, [location.pathname, location.search, navigate, searchParams]);

  const openOpportunityDetails = useCallback((opportunity: ApplicationOpportunity) => {
    setViewingOpportunity(opportunity);
    setOpportunityIdInUrl(opportunity.id);
  }, [setOpportunityIdInUrl]);

  const closeOpportunityDetails = useCallback(() => {
    setViewingOpportunity(null);
    setOpportunityIdInUrl(null);
  }, [setOpportunityIdInUrl]);

  const handleGoHome = useCallback(() => {
    onClose();
    if (!isLoggedIn) {
      navigate("/Home");
      return;
    }
    navigate(`/${getRolePathSegment(userRole)}?page=Home`);
  }, [getRolePathSegment, isLoggedIn, navigate, onClose, userRole]);

  // Notify parent about modal state
  useEffect(() => {
    onModalStateChange?.(showCreateModal || !!viewingOpportunity);
  }, [showCreateModal, viewingOpportunity, onModalStateChange]);

  // Fetch data on mount
  const loadOpportunities = useCallback(async () => {
    setIsRefreshing(true);
    // Don't set isLoading(true) here to avoid flashing skeleton on refresh.
    setIsLoading((prev) => (opportunities.length === 0 ? true : prev));
    
    const result = await fetchOpportunities();
    if (result.success && result.data) {
      const normalized = result.data.map((opp) => {
        const parsedEnd = new Date(opp.endDate);
        const shouldAutoComplete =
          opp.status === "open" &&
          !Number.isNaN(parsedEnd.getTime()) &&
          parsedEnd.getTime() <= Date.now();
        return shouldAutoComplete ? { ...opp, status: "completed" as const } : opp;
      });
      setOpportunities(normalized);
    } else {
      console.error("[MembershipApplications] Failed to load opportunities:", result.error);
      toast.error(result.error || "Failed to load opportunities");
    }
    setIsLoading(false);
    setIsRefreshing(false);
  }, [opportunities.length]);

  // Fetch data on mount
  useEffect(() => {
    loadOpportunities();
  }, [loadOpportunities]);

  // Filter Logic
  const filteredOpportunities = opportunities.filter(opp => {
    // 1. Role-based visibility
    if (!canManageOpportunities && opp.visibility === "hidden") return false;
    
    // 2. Search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      if (!opp.title.toLowerCase().includes(query) && !opp.description.toLowerCase().includes(query)) {
        return false;
      }
    }

    // 3. Status Filter
    if (filterStatus !== "all" && opp.status !== filterStatus) return false;

    return true;
  });

  // Separate active vs archived only if "All" is selected (default view)
  const showArchivedSection = filterStatus === "all" && !searchQuery;
  
  const activeOpportunities = showArchivedSection
    ? filteredOpportunities.filter(o => o.status !== "archived")
    : filteredOpportunities;
    
  const archivedOpportunities = showArchivedSection
    ? opportunities.filter(o => o.status === "archived" && (canManageOpportunities || o.visibility === "public"))
    : [];

  // Handlers
  const handleCreateOpportunity = () => {
    setEditingOpportunity(null);
    setShowCreateModal(true);
  };

  const handleEditOpportunity = (opp: ApplicationOpportunity) => {
    setEditingOpportunity(opp);
    setShowCreateModal(true);
    closeOpportunityDetails(); // Close view modal if open
  };

  const handleDeleteOpportunity = async (id: string) => {
    if (!confirm("Are you sure you want to delete this opportunity?")) return;

    // Optimistic update
    const prevOpportunities = [...opportunities];
    setOpportunities(opportunities.filter(o => o.id !== id));
    if (viewingOpportunity?.id === id) closeOpportunityDetails();

    const toastId = toast.loading("Deleting opportunity...");
    const result = await deleteOpportunity(id);

    if (result.success) {
      toast.success("Opportunity deleted", { id: toastId });
    } else {
      console.error("[MembershipApplications] Failed to delete opportunity:", { id, error: result.error });
      setOpportunities(prevOpportunities); // Revert
      toast.error(result.error || "Failed to delete", { id: toastId });
    }
  };

  const handleToggleVisibility = async (opp: ApplicationOpportunity) => {
    const newVisibility = opp.visibility === "public" ? "hidden" : "public";
    
    // Optimistic update
    const prevOpportunities = [...opportunities];
    setOpportunities(opportunities.map(o => o.id === opp.id ? { ...o, visibility: newVisibility } : o));
    if (viewingOpportunity?.id === opp.id) setViewingOpportunity({ ...viewingOpportunity, visibility: newVisibility });

    const result = await updateOpportunity(opp.id, { visibility: newVisibility });

    if (result.success) {
      toast.success(`Opportunity is now ${newVisibility.toUpperCase()}`);
    } else {
      console.error("[MembershipApplications] Failed to update visibility:", {
        id: opp.id,
        visibility: newVisibility,
        error: result.error,
      });
      setOpportunities(prevOpportunities); // Revert
      if (viewingOpportunity?.id === opp.id) setViewingOpportunity(opp);
      toast.error(result.error || "Failed to update visibility");
    }
  };

  const handleSaveOpportunity = async (opp: ApplicationOpportunity) => {
    const isEditing = Boolean(editingOpportunity);
    const toastId = `${isEditing ? "opportunity-update" : "opportunity-create"}-${Date.now()}`;
    setIsSavingOpportunity(true);

    addUploadToast({
      id: toastId,
      title: isEditing ? "Updating Opportunity" : "Creating Opportunity",
      message: "Preparing data...",
      status: "loading",
      progress: 10,
    });
    
    try {
      if (isEditing) {
        updateUploadToast(toastId, { progress: 45, message: "Syncing updates to backend..." });
        const result = await updateOpportunity(opp.id, opp);

        if (!result.success) {
          console.error("[MembershipApplications] Failed to update opportunity:", {
            id: opp.id,
            error: result.error,
          });
          updateUploadToast(toastId, {
            status: "error",
            message: result.error || "Operation failed",
            progress: 100,
          });
          setTimeout(() => removeUploadToast(toastId), 5000);
          toast.error(result.error || "Operation failed");
          return;
        }

        updateUploadToast(toastId, { progress: 80, message: "Updating local list..." });
        setOpportunities((prev) => prev.map((o) => (o.id === opp.id ? opp : o)));
        toast.success("Opportunity updated successfully");
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, ...newOppData } = opp; // Remove ID for creation, let backend assign
        updateUploadToast(toastId, { progress: 45, message: "Syncing to backend..." });
        const result = await addOpportunity(newOppData);

        if (!result.success) {
          console.error("[MembershipApplications] Failed to create opportunity:", result.error);
          updateUploadToast(toastId, {
            status: "error",
            message: result.error || "Operation failed",
            progress: 100,
          });
          setTimeout(() => removeUploadToast(toastId), 5000);
          toast.error(result.error || "Operation failed");
          return;
        }

        updateUploadToast(toastId, { progress: 80, message: "Updating local list..." });
        const createdOpportunity = result.data;
        if (!createdOpportunity) {
          console.error("[MembershipApplications] Create succeeded but no data returned.");
          updateUploadToast(toastId, {
            status: "error",
            message: "Opportunity was created but no data was returned",
            progress: 100,
          });
          setTimeout(() => removeUploadToast(toastId), 5000);
          toast.error("Operation failed");
          return;
        }
        setOpportunities((prev) => [...prev, createdOpportunity]);
        toast.success("Opportunity created successfully");
      }

      updateUploadToast(toastId, {
        progress: 100,
        message: isEditing ? "Update complete" : "Creation complete",
        status: "success",
      });
      setTimeout(() => removeUploadToast(toastId), 3000);
      setShowCreateModal(false);
      setEditingOpportunity(null);
    } catch (error) {
      console.error("[MembershipApplications] Unexpected save error:", error);
      updateUploadToast(toastId, {
        status: "error",
        message: "An unexpected error occurred",
        progress: 100,
      });
      setTimeout(() => removeUploadToast(toastId), 5000);
      toast.error("An unexpected error occurred");
    } finally {
      setIsSavingOpportunity(false);
    }
  };

  // Open opportunity modal directly when URL contains ?id=...
  useEffect(() => {
    const deepLinkId = (searchParams.get("id") || "").trim();
    if (!deepLinkId) {
      if (viewingOpportunity) {
        setViewingOpportunity(null);
      }
      return;
    }
    if (opportunities.length === 0) return;

    const matched = opportunities.find(
      (opp) => String(opp.id || "").trim().toLowerCase() === deepLinkId.toLowerCase()
    );
    if (!matched) return;
    if (viewingOpportunity?.id === matched.id) return;

    setViewingOpportunity(matched);
  }, [opportunities, searchParams, viewingOpportunity?.id]);

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return "Invalid date";
    return date.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
      timeZone: MANILA_TIME_ZONE,
    });
  };

  const resolveOpportunityLink = (rawLink: string) => {
    const trimmed = (rawLink || "").trim();
    if (!trimmed) return "";

    const guestAliases = new Set([
      "/visitor",
      "visitor",
      "/guest",
      "guest",
      "opportunities",
      "opportunity",
      "be-a-member",
      "be a member",
      "/visitor?page=opportunities",
      "/guest?page=opportunities",
      "/visitor?page=membershipapplications",
      "/guest?page=membershipapplications",
    ]);
    if (guestAliases.has(trimmed.toLowerCase())) {
      return `${window.location.origin}${OPPORTUNITIES_PAGE_LINK}`;
    }

    try {
      const url = new URL(trimmed);
      if (url.pathname === "/guest" || url.pathname === "/visitor") {
        const page = url.searchParams.get("page");
        if (!page) {
          return `${window.location.origin}${OPPORTUNITIES_PAGE_LINK}`;
        }
      }
      return url.toString();
    } catch {
      if (trimmed.startsWith("/")) {
        if (trimmed.toLowerCase() === "/guest" || trimmed.toLowerCase() === "/visitor") {
          return `${window.location.origin}${OPPORTUNITIES_PAGE_LINK}`;
        }
        return `${window.location.origin}${trimmed}`;
      }
      return trimmed;
    }
  };

  const openOpportunityLink = (rawLink: string) => {
    const resolved = resolveOpportunityLink(rawLink);
    if (!resolved) {
      toast.error("No application link configured");
      return;
    }
    window.open(resolved, "_blank", "noopener,noreferrer");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return DESIGN_TOKENS.colors.status.success;
      case "closed": return DESIGN_TOKENS.colors.status.error;
      case "completed": return "#3b82f6";
      case "archived": return "#6b7280";
      default: return "#6b7280";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "open": return <Unlock className="w-3.5 h-3.5" />;
      case "closed": return <Lock className="w-3.5 h-3.5" />;
      case "completed": return <CheckCircle className="w-3.5 h-3.5" />;
      case "archived": return <Archive className="w-3.5 h-3.5" />;
      default: return <AlertCircle className="w-3.5 h-3.5" />;
    }
  };

  return (
    <PageLayout
      title="Membership & Opportunities"
      subtitle={canManageOpportunities ? "Manage recruitment and opportunities" : "Join us and participate in our activities"}
      isDark={isDark}
      onClose={onClose}
      breadcrumbs={[
        { label: "Home", onClick: handleGoHome },
        { label: "Opportunities", onClick: undefined },
      ]}
    >
      <div className="space-y-6">
        {/* Controls Header */}
        <div className="flex flex-col gap-4">
          {/* Row 1: Search - Full width */}
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search opportunities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none transition-all shadow-sm"
              style={{ 
                borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
                fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
              }}
            />
          </div>

          {/* Row 2: Filters & View Mode */}
          <div className="flex flex-wrap justify-between items-center w-full gap-3">
            {/* Left side: Filter */}
            <div className="w-48">
              <CustomDropdown
                value={filterStatus}
                onChange={setFilterStatus}
                options={[
                  { value: "all", label: "All Status" },
                  { value: "open", label: "Open" },
                  { value: "closed", label: "Closed" },
                  { value: "completed", label: "Completed" },
                  { value: "archived", label: "Archived" },
                ]}
                isDark={isDark}
                size="md"
              />
            </div>

            {/* Right side: Actions */}
            <div className="flex gap-2 items-center">
              {/* Refresh Button */}
              <button
                onClick={loadOpportunities}
                disabled={isRefreshing}
                className="p-2.5 rounded-xl border bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm flex items-center justify-center min-w-[44px]"
                style={{ 
                  borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
                }}
                title="Refresh List"
              >
                <RefreshCw className={`w-5 h-5 ${isRefreshing ? "animate-spin" : ""}`} />
              </button>

              {/* View Mode Toggle */}
              <button
                onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
                className="p-2.5 rounded-xl border bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm flex items-center justify-center min-w-[44px]"
                style={{ 
                  borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
                }}
                title={viewMode === "grid" ? "Switch to List View" : "Switch to Grid View"}
              >
                {viewMode === "grid" ? <ListIcon className="w-5 h-5" /> : <LayoutGrid className="w-5 h-5" />}
              </button>

              {/* Create Button (Admin) */}
              {canManageOpportunities && (
                <Button
                  variant="primary"
                  onClick={handleCreateOpportunity}
                  icon={<Plus className="w-5 h-5" />}
                  size="md"
                >
                  Create
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Content Area */}
        {isLoading ? (
          <SkeletonCardGrid count={3} />
        ) : (
          <div className="space-y-8">
            {/* Active Opportunities */}
            <div className={viewMode === "grid" ? "grid grid-cols-1 lg:grid-cols-2 gap-6" : "space-y-4"}>
              {activeOpportunities.length === 0 ? (
                <div className={`col-span-full rounded-xl p-12 border text-center ${
                  isDark ? "bg-gray-800/50 border-white/10" : "bg-white border-gray-200"
                }`}>
                  <div className="w-16 h-16 mx-auto rounded-full bg-gray-100 dark:bg-gray-700/50 flex items-center justify-center mb-4">
                     <Filter className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-muted-foreground">
                    {searchQuery || filterStatus !== 'all' 
                      ? "No opportunities found matching your filters." 
                      : "No active opportunities available."}
                  </p>
                  {canManageOpportunities && (
                    <Button 
                      variant="ghost"
                      onClick={handleCreateOpportunity}
                      className="mt-2 text-[#f6421f]"
                    >
                      Create one now
                    </Button>
                  )}
                </div>
              ) : viewMode === "grid" ? (
                activeOpportunities.map((opp) => (
                  <OpportunityCard
                    key={opp.id}
                    opp={opp}
                    viewMode={viewMode}
                    isDark={isDark}
                    isAdminOrAuditor={canManageOpportunities}
                    getStatusColor={getStatusColor}
                    getStatusIcon={getStatusIcon}
                    formatDateTime={formatDateTime}
                    onClick={() => openOpportunityDetails(opp)}
                    onToggleVisibility={handleToggleVisibility}
                    onEdit={handleEditOpportunity}
                    onDelete={handleDeleteOpportunity}
                    onOpenLink={openOpportunityLink}
                  />
                ))
              ) : (
                <OpportunityTable
                  opportunities={activeOpportunities}
                  isDark={isDark}
                  isAdminOrAuditor={canManageOpportunities}
                  formatDateTime={formatDateTime}
                  getStatusColor={getStatusColor}
                  getStatusIcon={getStatusIcon}
                  onView={openOpportunityDetails}
                  onToggleVisibility={handleToggleVisibility}
                  onEdit={handleEditOpportunity}
                  onDelete={handleDeleteOpportunity}
                  onOpenLink={openOpportunityLink}
                />
              )}
            </div>

            {/* Archived Section (Collapsible) */}
            {showArchivedSection && archivedOpportunities.length > 0 && (
              <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setIsArchivedOpen(!isArchivedOpen)}
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6 group w-full"
                >
                  <div className={`p-1 rounded-full bg-gray-100 dark:bg-gray-800 transition-transform duration-300 ${isArchivedOpen ? 'rotate-180' : ''}`}>
                    <ChevronDown className="w-4 h-4" />
                  </div>
                  <span className="font-semibold text-lg">Archived Opportunities ({archivedOpportunities.length})</span>
                </button>

                {isArchivedOpen && (
                  <div className={`animate-in fade-in slide-in-from-top-4 duration-300 ${
                    viewMode === "grid" ? "grid grid-cols-1 lg:grid-cols-2 gap-6" : "space-y-4"
                  }`}>
                    {viewMode === "grid" ? (
                      archivedOpportunities.map((opp) => (
                        <OpportunityCard
                          key={opp.id}
                          opp={opp}
                          viewMode={viewMode}
                          isDark={isDark}
                          isAdminOrAuditor={canManageOpportunities}
                          getStatusColor={getStatusColor}
                          getStatusIcon={getStatusIcon}
                          formatDateTime={formatDateTime}
                          onClick={() => openOpportunityDetails(opp)}
                          onToggleVisibility={handleToggleVisibility}
                          onEdit={handleEditOpportunity}
                          onDelete={handleDeleteOpportunity}
                          onOpenLink={openOpportunityLink}
                          isArchived={true}
                        />
                      ))
                    ) : (
                      <OpportunityTable
                        opportunities={archivedOpportunities}
                        isDark={isDark}
                        isAdminOrAuditor={canManageOpportunities}
                        formatDateTime={formatDateTime}
                        getStatusColor={getStatusColor}
                        getStatusIcon={getStatusIcon}
                        onView={openOpportunityDetails}
                        onToggleVisibility={handleToggleVisibility}
                        onEdit={handleEditOpportunity}
                        onDelete={handleDeleteOpportunity}
                        onOpenLink={openOpportunityLink}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* View Detail Modal */}
      {viewingOpportunity && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-10000 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={closeOpportunityDetails}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border max-h-[90vh] shadow-2xl relative flex flex-col overflow-hidden"
            style={{
              background: isDark ? "rgba(17, 24, 39, 0.95)" : "rgba(255, 255, 255, 0.98)",
              borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 sm:px-8 py-5 border-b border-gray-200 dark:border-gray-800 flex items-start justify-between gap-4 shrink-0">
              <div className="pr-2">
                <h2
                  className="text-2xl sm:text-3xl font-bold leading-tight"
                  style={{
                    fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                    color: DESIGN_TOKENS.colors.brand.orange,
                  }}
                >
                  {viewingOpportunity.title}
                </h2>
              </div>
              <button
                onClick={closeOpportunityDetails}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0"
                aria-label="Close details modal"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="space-y-6 px-6 sm:px-8 py-6 overflow-y-auto flex-1">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4 text-sm text-muted-foreground p-4 bg-gray-50 dark:bg-white/5 rounded-xl">
                <div className="flex items-center gap-2">
                  <span
                    className="px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 uppercase tracking-wide w-fit"
                    style={{
                      backgroundColor: `${getStatusColor(viewingOpportunity.status)}15`,
                      color: getStatusColor(viewingOpportunity.status),
                      border: `1px solid ${getStatusColor(viewingOpportunity.status)}30`,
                    }}
                  >
                    {getStatusIcon(viewingOpportunity.status)}
                    {viewingOpportunity.status}
                  </span>
                  {canManageOpportunities && (
                    <span className="text-xs text-muted-foreground bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                      {viewingOpportunity.visibility === "public" ? "Public" : "Hidden"}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#f6421f]" />
                  <span className="font-medium text-foreground">Start:</span>
                  <span>{formatDateTime(viewingOpportunity.startDate)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#f6421f]" />
                  <span className="font-medium text-foreground">End:</span>
                  <span>{formatDateTime(viewingOpportunity.endDate)}</span>
                </div>
              </div>

              <div className="prose dark:prose-invert max-w-none">
                <p className="whitespace-pre-line text-lg leading-relaxed text-gray-600 dark:text-gray-300 text-justify">
                  {viewingOpportunity.description}
                </p>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-6 sm:px-8 py-4 border-t border-gray-200 dark:border-gray-800 flex gap-3 items-center shrink-0">
              {(viewingOpportunity.status === "open" || canManageOpportunities || viewingOpportunity.status === "archived") && (
                <Button
                  variant="primary"
                  onClick={() => openOpportunityLink(viewingOpportunity.link)}
                  icon={<ExternalLink className="w-4 h-4" />}
                  className="flex-1 justify-center py-3"
                  disabled={viewingOpportunity.status !== "open" && !canManageOpportunities && viewingOpportunity.status !== "archived"}
                >
                  {viewingOpportunity.status === "open" ? "Apply Now" : "View Link"}
                </Button>
              )}

              {canManageOpportunities && (
                <button
                  onClick={() => handleEditOpportunity(viewingOpportunity)}
                  className="p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
                  title="Edit"
                  aria-label="Edit opportunity"
                >
                  <Edit className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <CreateOpportunityModalEnhanced
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setEditingOpportunity(null);
          }}
          isDark={isDark}
          opportunity={editingOpportunity}
          onSave={handleSaveOpportunity}
          isSaving={isSavingOpportunity}
        />
      )}
    </PageLayout>
  );
}

// Sub-component for rendering an opportunity card
function OpportunityCard({
  opp,
  viewMode,
  isDark,
  isAdminOrAuditor,
  getStatusColor,
  getStatusIcon,
  formatDateTime,
  onClick,
  onToggleVisibility,
  onEdit,
  onDelete,
  onOpenLink,
  isArchived = false
}: {
  opp: ApplicationOpportunity;
  viewMode: "grid" | "list";
  isDark: boolean;
  isAdminOrAuditor: boolean;
  getStatusColor: (s: string) => string;
  getStatusIcon: (s: string) => React.ReactNode;
  formatDateTime: (d: string) => string;
  onClick: () => void;
  onToggleVisibility: (o: ApplicationOpportunity) => void;
  onEdit: (o: ApplicationOpportunity) => void;
  onDelete: (id: string) => void;
  onOpenLink: (link: string) => void;
  isArchived?: boolean;
}) {
  const isList = viewMode === "list";
  const glassStyle = getGlassStyle(isDark);

  return (
    <div
      onClick={onClick}
      className={`
        relative overflow-hidden rounded-xl border transition-all duration-300 group cursor-pointer
        ${isList ? "p-4" : "p-6 flex flex-col h-full"}
        hover:border-[#f6421f]/30
        ${(isAdminOrAuditor && opp.visibility === "hidden") || isArchived ? "opacity-75 grayscale-[0.3]" : ""}
        hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20 hover:-translate-y-0.5
      `}
      style={{
        ...glassStyle,
        borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
      }}
    >
      <div className={`flex ${isList ? "items-center gap-6" : "flex-col gap-4 h-full"}`}>
        
        {/* Status Indicator Stripe */}
        <div 
          className="absolute left-0 top-0 bottom-0 w-1 transition-all group-hover:w-1.5"
          style={{ backgroundColor: getStatusColor(opp.status) }} 
        />

        {/* Main Content */}
        <div className="flex-1 min-w-0 pl-2">
          <div className="flex items-start justify-between gap-4 mb-2">
            <h3
              className={`font-bold text-lg leading-tight pr-2 whitespace-normal wrap-break-word ${isDark ? "text-gray-100" : "text-gray-900"}`}
              title={opp.title}
            >
              {opp.title}
            </h3>
            
            {/* Badges */}
            <div className="flex gap-2 shrink-0">
              <span
                className="px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 uppercase tracking-wide"
                style={{
                  backgroundColor: `${getStatusColor(opp.status)}15`,
                  color: getStatusColor(opp.status),
                  border: `1px solid ${getStatusColor(opp.status)}30`,
                }}
              >
                {getStatusIcon(opp.status)}
                {opp.status}
              </span>
              
              {isAdminOrAuditor && (
                <span
                  className="px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600"
                >
                  {opp.visibility === "public" ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                </span>
              )}
            </div>
          </div>

          <p className={`text-sm text-muted-foreground ${isList ? "line-clamp-1" : "line-clamp-2 mb-4"}`}>
            {opp.description}
          </p>

          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
            <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800/60 px-2 py-1 rounded-md">
              <Calendar className="w-3.5 h-3.5" />
              <span>{formatDateTime(opp.startDate)}</span>
            </div>
            {!isList && <span className="text-gray-300 dark:text-gray-700 hidden sm:inline">•</span>}
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Ends {formatDateTime(opp.endDate)}</span>
            </div>
          </div>
        </div>

        {/* Actions - Stop Propagation to prevent opening modal when clicking buttons */}
        <div 
          className={`flex ${isList ? "flex-row items-center" : "flex-col justify-end mt-auto pt-4 border-t border-gray-100 dark:border-gray-700/50"} gap-2`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Public: Apply Button (Active only, or view link if admin/archived) */}
          {(opp.status === "open" || isAdminOrAuditor || opp.status === "archived") && (
            <Button
              variant={opp.status === "open" ? "primary" : "secondary"}
              onClick={() => onOpenLink(opp.link)}
              icon={<ExternalLink className="w-4 h-4" />}
              size="sm"
              className={isList ? "" : "w-full justify-center"}
              disabled={opp.status !== "open" && !isAdminOrAuditor && opp.status !== "archived"}
            >
              {opp.status === "open" ? "Apply Now" : "View Link"}
            </Button>
          )}

          {/* Admin Actions */}
          {isAdminOrAuditor && (
            <div className={`flex gap-1 ${isList ? "pl-3 border-l border-gray-200 dark:border-gray-700" : "justify-end w-full"}`}>
              <button
                onClick={() => onToggleVisibility(opp)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
                title={opp.visibility === "public" ? "Hide from public" : "Show to public"}
              >
                {opp.visibility === "public" ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button
                onClick={() => onEdit(opp)}
                className="p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
                title="Edit"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(opp.id)}
                className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OpportunityTable({
  opportunities,
  isDark,
  isAdminOrAuditor,
  formatDateTime,
  getStatusColor,
  getStatusIcon,
  onView,
  onToggleVisibility,
  onEdit,
  onDelete,
  onOpenLink,
}: {
  opportunities: ApplicationOpportunity[];
  isDark: boolean;
  isAdminOrAuditor: boolean;
  formatDateTime: (d: string) => string;
  getStatusColor: (s: string) => string;
  getStatusIcon: (s: string) => React.ReactNode;
  onView: (o: ApplicationOpportunity) => void;
  onToggleVisibility: (o: ApplicationOpportunity) => void;
  onEdit: (o: ApplicationOpportunity) => void;
  onDelete: (id: string) => void;
  onOpenLink: (link: string) => void;
}) {
  return (
    <div
      className="overflow-x-auto rounded-xl border"
      style={{
        borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
        background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(255, 255, 255, 0.5)",
      }}
    >
      <table className="w-full min-w-[880px]">
        <thead className="bg-gray-100 dark:bg-gray-800">
          <tr>
            <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
              Title
            </th>
            <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
              Visibility
            </th>
            <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
              Start
            </th>
            <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
              End
            </th>
            <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {opportunities.map((opp) => (
            <tr key={opp.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <td className="px-4 py-4">
                <button
                  onClick={() => onView(opp)}
                  className="text-left w-full group"
                  title={opp.title}
                >
                  <div
                    className="text-sm group-hover:text-[#f6421f] transition-colors whitespace-normal wrap-break-word"
                    style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}
                  >
                    {opp.title}
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
                    {opp.description}
                  </div>
                </button>
              </td>
              <td className="px-4 py-4 whitespace-nowrap">
                <span
                  className="px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 uppercase tracking-wide"
                  style={{
                    backgroundColor: `${getStatusColor(opp.status)}15`,
                    color: getStatusColor(opp.status),
                    border: `1px solid ${getStatusColor(opp.status)}30`,
                  }}
                >
                  {getStatusIcon(opp.status)}
                  {opp.status}
                </span>
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-muted-foreground">
                {opp.visibility === "public" ? "Public" : "Hidden"}
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-muted-foreground">
                {formatDateTime(opp.startDate)}
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-muted-foreground">
                {formatDateTime(opp.endDate)}
              </td>
              <td className="px-4 py-4 whitespace-nowrap">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onView(opp)}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
                    title="View"
                    aria-label="View opportunity"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {(opp.status === "open" || isAdminOrAuditor || opp.status === "archived") && (
                    <button
                      onClick={() => onOpenLink(opp.link)}
                      className="p-2 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 text-gray-500 hover:text-orange-600 dark:text-gray-400 dark:hover:text-orange-400 transition-colors"
                      title={opp.status === "open" ? "Apply now" : "View link"}
                      aria-label={opp.status === "open" ? "Apply now" : "View link"}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  )}
                  {isAdminOrAuditor && (
                    <>
                      <button
                        onClick={() => onToggleVisibility(opp)}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
                        title={opp.visibility === "public" ? "Hide from public" : "Show to public"}
                        aria-label={opp.visibility === "public" ? "Hide from public" : "Show to public"}
                      >
                        {opp.visibility === "public" ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => onEdit(opp)}
                        className="p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
                        title="Edit"
                        aria-label="Edit opportunity"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(opp.id)}
                        className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
                        title="Delete"
                        aria-label="Delete opportunity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
