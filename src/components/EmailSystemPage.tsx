/**
 * =============================================================================
 * EMAIL SYSTEM PAGE
 * =============================================================================
 * 
 * Admin email management system for sending templated emails.
 * 
 * Features:
 * - Template selection (Event Invites, Appointments, Payment Reminders, etc.)
 * - Recipient table with inline editing
 * - Rich text message formatting (justified, fonts, line breaks)
 * - Send single, selected, or batch all emails
 * - Email tracking with unique IDs
 * - Quota monitoring
 * 
 * =============================================================================
 */

import { useState, useEffect, useMemo, useCallback, useRef, Fragment } from "react";
import { toast } from "sonner";
import {
  X, Plus, Mail, Send, Eye, Edit2, Trash2,
  Loader2, CheckCircle, XCircle, AlertCircle, AlertTriangle,
  LayoutGrid, List, Calendar, RefreshCw, Clock, FileText,
  MapPin,
  Users, Globe, Filter, Check, Search, Layers, ChevronDown, ChevronRight, User, Building
} from "lucide-react";
import { PageLayout, Button, SearchInput, DESIGN_TOKENS } from "./design-system";
import CustomDropdown from "./CustomDropdown";
import { UploadToastContainer, type UploadToastMessage } from "./UploadToast";
import { FormattedText } from "./FormattedText";
import {
  getEmails,
  getEmailLogs,
  getDirectoryMembers,
  addEmailRecipient,
  updateEmailRecipient,
  deleteEmailRecipient,
  sendEmails,
  batchSendAll,
  checkEmailQuota,
  clearEmailSystemCache,
  getEmailStatusColor,
  EMAIL_TEMPLATES,
  type EmailTemplateType,
  type EmailRecipient,
  type EmailLog,
  type EmailQuota,
} from "../services/gasEmailSystemService";
import { logCreate, logEdit, logDelete } from "../services/gasSystemToolsService";
import { YSP_COMMITTEES as SHARED_COMMITTEES, type CommitteeItem } from "../constants/committees";
import { fetchEvents, type EventData } from "../services/gasEventsService";
import { getEventAttendees } from "../services/gasIssuanceService";
import { orgConfig } from "../config/org.config";

// =====================================================
// TYPES & INTERFACES
// =====================================================

interface EmailSystemPageProps {
  onClose: () => void;
  isDark: boolean;
  userRole: string;
  username?: string;
  userEmail?: string;
  onModalStateChange?: (isOpen: boolean) => void;
}

type ViewMode = 'table' | 'card';
type FilterMode = 'all' | 'members' | 'external' | 'sent' | 'draft' | 'error';
type TemplateSelection = EmailTemplateType | 'ALL';

interface DirectoryMember {
  name: string;
  email: string;
  committee?: string;
  profilePicture?: string;
}

interface PendingBatchRecipient {
  queueId: string;
  RecipientName: string;
  Email: string;
  Headline?: string;
  Message?: string;
  sourceType?: 'committee' | 'event' | 'all' | 'person' | 'external';
  sourceLabel?: string;
}

type EmailRecipientRow = EmailRecipient & {
  __templateKey?: EmailTemplateType;
  __templateName?: string;
};

const CACHE_KEYS = {
  members: 'ysp_emailsystem_members_v2',
  committees: 'ysp_emailsystem_committees',
  events: 'ysp_emailsystem_events',
};
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// =====================================================
// CONSTANTS
// =====================================================

// Search commands for recipient selection (like Issuance Center)
type SearchCommand = '@Person' | '@Event' | '@Committee' | '@All' | '@External' | null;

const SEARCH_COMMANDS = [
  { command: '@Person' as const, icon: User, label: 'Search individual members', color: '#3b82f6' },
  { command: '@Event' as const, icon: Calendar, label: 'Load attendees from event', color: '#8b5cf6' },
  { command: '@Committee' as const, icon: Building, label: 'Load members by committee', color: '#10b981' },
  { command: '@All' as const, icon: Users, label: 'Load all directory members', color: '#f59e0b' },
  { command: '@External' as const, icon: Globe, label: 'Add external recipient', color: '#ec4899' },
];

const normalizeProfileImageUrl = (rawUrl?: string): string => {
  const raw = String(rawUrl || '').trim();
  if (!raw) return '';

  const driveMatch = raw.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  const idParamMatch = raw.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  const gusercontentMatch = raw.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]{20,})/);
  const fileId = (driveMatch && driveMatch[1]) || (idParamMatch && idParamMatch[1]) || (gusercontentMatch && gusercontentMatch[1]) || '';

  if (fileId) return `https://lh3.googleusercontent.com/d/${fileId}=s240`;
  return /^https?:\/\//i.test(raw) ? raw : '';
};

const getInitials = (name: string): string => {
  if (!name) return '?';
  const words = name.split(' ').filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
};

// Helper to get the "subject" field name for each template (always 3rd column/index 2)
const getSubjectFieldName = (template: EmailTemplateType): string => {
  return EMAIL_TEMPLATES[template].headers[2]; // Index 2 is always the subject/headline column
};

// Helper to get subject value from recipient (handles both normalized and raw field names)
const getRecipientSubject = (r: EmailRecipient, template: EmailTemplateType): string => {
  // First try the template-specific field name
  const fieldName = getSubjectFieldName(template);
  const rawValue = (r as unknown as Record<string, unknown>)[fieldName];
  if (rawValue && typeof rawValue === 'string' && rawValue.trim()) {
    return rawValue.trim();
  }
  // Fallback to Headline (in case backend normalizes it)
  if (r.Headline?.trim()) {
    return r.Headline.trim();
  }
  return 'No Subject';
};

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function EmailSystemPage({
  onClose,
  isDark,
  userRole,
  username = "admin",
  onModalStateChange,
}: EmailSystemPageProps) {
  
  // Check if user can send emails (Admin or Auditor only)
  const roleLower = userRole.toLowerCase();
  const canSend = roleLower === 'admin' || roleLower === 'auditor';
  
  // ============= STATE =============
  // Template & Data state
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateSelection>('Event_Invites');
  const [recipients, setRecipients] = useState<EmailRecipientRow[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  
  // Selection state
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<EmailRecipient | null>(null);
  const [deletingRowIndex, setDeletingRowIndex] = useState<number | null>(null);
  const [previewingRecipient, setPreviewingRecipient] = useState<EmailRecipient | null>(null);
  
  // Form state for create/edit
  const [formData, setFormData] = useState<Partial<EmailRecipient>>({});
  
  // Sending state
  const [isSending, setIsSending] = useState(false);
  const [, setSendProgress] = useState<{ sent: number; failed: number; total: number } | null>(null);
  
  // Quota state
  const [quota, setQuota] = useState<EmailQuota | null>(null);
  const [, setIsLoadingQuota] = useState(false);
  
  // Upload Toast State
  const [uploadToastMessages, setUploadToastMessages] = useState<UploadToastMessage[]>([]);
  
  // Smart Filter State
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [directoryMembers, setDirectoryMembers] = useState<DirectoryMember[]>([]);
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(false);
  
  // Command Palette State for Create Modal (like Issuance Center)
  const [activeCommand, setActiveCommand] = useState<SearchCommand>(null);
  const [commandSearchQuery, setCommandSearchQuery] = useState("");
  const [recipientSearchQuery, setRecipientSearchQuery] = useState("");
  const [showRecipientDropdown, setShowRecipientDropdown] = useState(false);
  const [externalName, setExternalName] = useState("");
  const [externalEmail, setExternalEmail] = useState("");
  const recipientSearchRef = useRef<HTMLDivElement>(null);
  
  // Grouping State
  const [groupBySubject, setGroupBySubject] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  // Events State (for @Event command)
  const [events, setEvents] = useState<EventData[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [pendingBatchRecipients, setPendingBatchRecipients] = useState<PendingBatchRecipient[]>([]);
  const [pendingBatchSource, setPendingBatchSource] = useState('');
  const [showQueuedRecipients, setShowQueuedRecipients] = useState(true);
  const [showAllQueuedRecipients, setShowAllQueuedRecipients] = useState(false);
  const isAllTemplates = selectedTemplate === 'ALL';
  const activeTemplate = isAllTemplates ? null : selectedTemplate;
  const subjectTemplateFallback: EmailTemplateType = activeTemplate ?? 'General_Notices';
  const canSendForCurrentTemplate = canSend && !!activeTemplate;

  const createQueueId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  
  // ============= MODAL STATE TRACKING FOR CHATBOT VISIBILITY =============
  useEffect(() => {
    const anyModalOpen = showCreateModal || showEditModal || showDeleteConfirmModal || showLogsModal || showPreviewModal;
    onModalStateChange?.(anyModalOpen);
  }, [showCreateModal, showEditModal, showDeleteConfirmModal, showLogsModal, showPreviewModal, onModalStateChange]);

  // ============= UPLOAD TOAST HELPERS =============
  const addUploadToast = (message: UploadToastMessage) => {
    setUploadToastMessages(prev => [...prev.filter(m => m.id !== message.id), message]);
  };

  const updateUploadToast = (id: string, updates: Partial<UploadToastMessage>) => {
    setUploadToastMessages(prev => 
      prev.map(m => m.id === id ? { ...m, ...updates } : m)
    );
  };

  const removeUploadToast = (id: string) => {
    setUploadToastMessages(prev => prev.filter(m => m.id !== id));
  };

  // ============= LOCAL STORAGE CACHING (like Issuance Center) =============
  interface CachedItem<T> {
    data: T;
    timestamp: number;
  }

  const getCachedData = useCallback(<T,>(key: string): T | null => {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;
      const parsed: CachedItem<T> = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < CACHE_TTL) {
        return parsed.data;
      }
      localStorage.removeItem(key);
    } catch { /* ignore */ }
    return null;
  }, []);

  const setCachedData = useCallback(<T,>(key: string, data: T) => {
    try {
      const item: CachedItem<T> = { data, timestamp: Date.now() };
      localStorage.setItem(key, JSON.stringify(item));
    } catch { /* ignore - quota exceeded or disabled */ }
  }, []);

  // Get unique committees from loaded members
  const uniqueCommittees = useMemo(() => {
    const committees = new Set<string>();
    directoryMembers.forEach(m => {
      if (m.committee) committees.add(m.committee);
    });
    // Also add shared committees
    SHARED_COMMITTEES.forEach((c: CommitteeItem) => committees.add(c.name));
    return Array.from(committees).sort();
  }, [directoryMembers]);

  // ============= DATA LOADING =============
  const loadRecipients = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!activeTemplate) {
        const templateKeys = Object.keys(EMAIL_TEMPLATES) as EmailTemplateType[];
        const allResults = await Promise.all(
          templateKeys.map(async (templateKey) => {
            const data = await getEmails(templateKey);
            return data.map((r) => ({
              ...r,
              __templateKey: templateKey,
              __templateName: EMAIL_TEMPLATES[templateKey].name,
            }));
          })
        );
        setRecipients(allResults.flat());
      } else {
        const data = await getEmails(activeTemplate);
        setRecipients(
          data.map((r) => ({
            ...r,
            __templateKey: activeTemplate,
            __templateName: EMAIL_TEMPLATES[activeTemplate].name,
          }))
        );
      }
      setSelectedRows(new Set());
      setSelectAll(false);
    } catch (error) {
      console.error('Error loading recipients:', error);
      toast.error('Failed to load email recipients');
    } finally {
      setIsLoading(false);
    }
  }, [activeTemplate]);

  const loadQuota = useCallback(async () => {
    setIsLoadingQuota(true);
    try {
      const q = await checkEmailQuota();
      setQuota(q);
    } catch (error) {
      console.error('Error loading quota:', error);
    } finally {
      setIsLoadingQuota(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      const logs = await getEmailLogs({ templateType: activeTemplate || undefined, limit: 100 });
      setEmailLogs(logs);
    } catch (error) {
      console.error('Error loading logs:', error);
      toast.error('Failed to load email logs');
    } finally {
      setIsLoadingLogs(false);
    }
  }, [activeTemplate]);

  const loadDirectoryMembers = useCallback(async (forceRefresh = false) => {
    setIsLoadingDirectory(true);
    try {
      // Try localStorage cache first (like Issuance Center)
      if (!forceRefresh) {
        const cached = getCachedData<DirectoryMember[]>(CACHE_KEYS.members);
        if (cached && cached.length > 0) {
          setDirectoryMembers(cached);
          setIsLoadingDirectory(false);
          return;
        }
      }

      // Fetch from EmailSystem backend directory endpoint to match actual recipient source.
      const fetchedMembers = await getDirectoryMembers(forceRefresh);
      const uniqueMembers = fetchedMembers
        .filter((m) => m.email && m.name)
        .map((m) => ({
          name: m.name,
          email: m.email,
          committee: m.committee || '',
          profilePicture: normalizeProfileImageUrl(m.profilePicture),
        }))
        .filter((m, idx, arr) =>
          arr.findIndex((x) => x.email.toLowerCase() === m.email.toLowerCase()) === idx
        );

      if (uniqueMembers.length > 0) {
        setDirectoryMembers(uniqueMembers);
        setCachedData(CACHE_KEYS.members, uniqueMembers);
      } else {
        toast.error('No members with email addresses found');
      }
    } catch (error) {
      console.error('Error loading directory:', error);
      toast.error('Failed to load directory members');
    } finally {
      setIsLoadingDirectory(false);
    }
  }, [getCachedData, setCachedData]);

  // Load events for @Event command  
  const loadEvents = useCallback(async (forceRefresh = false) => {
    setIsLoadingEvents(true);
    try {
      // Try cache first (unless force refresh)
      if (!forceRefresh) {
        const cached = getCachedData<EventData[]>(CACHE_KEYS.events);
        if (cached && cached.length > 0) {
          setEvents(cached);
          setIsLoadingEvents(false);
          return;
        }
      }
      const data = await fetchEvents();
      // Filter for Active or Completed events (same as Issuance Center)
      const filtered = data.filter((e: EventData) => e.Status === 'Active' || e.Status === 'Completed');
      setEvents(filtered);
      setCachedData(CACHE_KEYS.events, filtered);
    } catch (error) {
      console.error("Error loading events:", error);
      toast.error('Failed to load events');
    } finally {
      setIsLoadingEvents(false);
    }
  }, [getCachedData, setCachedData]);

  useEffect(() => {
    loadRecipients();
    loadQuota();
  }, [loadRecipients, loadQuota]);

  // ============= FILTERED DATA =============
  const filteredRecipients = useMemo(() => {
    let filtered = recipients;
    
    // Apply filter mode
    if (filterMode !== 'all') {
      filtered = filtered.filter(r => {
        const status = r.Status?.toLowerCase() || 'draft';
        const email = r.Email?.toLowerCase() || '';
        
        switch (filterMode) {
          case 'members':
            // Members have @gmail.com or internal domains
            return email.includes('@gmail.com') || email.includes('@ysp') || email.includes('@youthservice');
          case 'external':
            // External emails (not gmail or ysp)
            return !email.includes('@gmail.com') && !email.includes('@ysp') && !email.includes('@youthservice');
          case 'sent':
            return status.startsWith('sent');
          case 'draft':
            return status === 'draft' || status === '' || !status;
          case 'error':
            return status.includes('error') || status.includes('duplicate');
          default:
            return true;
        }
      });
    }
    
    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r => {
        const subject = getRecipientSubject(r, r.__templateKey || subjectTemplateFallback);
        return r.RecipientName?.toLowerCase().includes(query) ||
          r.Email?.toLowerCase().includes(query) ||
          subject.toLowerCase().includes(query) ||
          r.EmailId?.toLowerCase().includes(query);
      });
    }
    
    return filtered;
  }, [recipients, searchQuery, filterMode, subjectTemplateFallback]);

  // Group recipients by Subject/Headline
  type GroupedRecipients = { subject: string; recipients: EmailRecipientRow[]; sentCount: number; totalCount: number }[];
  
  const groupedRecipients = useMemo<GroupedRecipients>(() => {
    if (!groupBySubject) return [];
    
    const groups = new Map<string, EmailRecipientRow[]>();
    
    filteredRecipients.forEach(r => {
      const subject = getRecipientSubject(r, r.__templateKey || subjectTemplateFallback);
      if (!groups.has(subject)) {
        groups.set(subject, []);
      }
      groups.get(subject)!.push(r);
    });
    
    // Convert to array and sort by subject name
    return Array.from(groups.entries())
      .map(([subject, recipients]) => ({
        subject,
        recipients,
        sentCount: recipients.filter(r => r.Status?.toLowerCase().startsWith('sent')).length,
        totalCount: recipients.length,
      }))
      .sort((a, b) => a.subject.localeCompare(b.subject));
  }, [filteredRecipients, groupBySubject, subjectTemplateFallback]);

  // Toggle group expansion
  const toggleGroupExpansion = (subject: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(subject)) {
        newSet.delete(subject);
      } else {
        newSet.add(subject);
      }
      return newSet;
    });
  };

  // Expand/collapse all groups
  const toggleAllGroups = () => {
    if (expandedGroups.size === groupedRecipients.length) {
      setExpandedGroups(new Set());
    } else {
      setExpandedGroups(new Set(groupedRecipients.map(g => g.subject)));
    }
  };

  // Auto-expand all groups when grouping is enabled
  useEffect(() => {
    if (groupBySubject && groupedRecipients.length > 0) {
      setExpandedGroups(new Set(groupedRecipients.map(g => g.subject)));
    }
  }, [groupBySubject, groupedRecipients]);

  // Note: uniqueCommittees is defined earlier in the file


  // Universal search suggestions based on active command (like Issuance Center)
  const universalSearchSuggestions = useMemo(() => {
    // If no active command and searching for a command
    if (!activeCommand && recipientSearchQuery.startsWith('@')) {
      const cmdQuery = recipientSearchQuery.toLowerCase();
      return SEARCH_COMMANDS.filter(c => 
        c.command.toLowerCase().startsWith(cmdQuery) || 
        c.label.toLowerCase().includes(cmdQuery.replace('@', ''))
      );
    }

    // If no active command and user types a name/email, search members directly.
    if (!activeCommand && recipientSearchQuery.trim() && !recipientSearchQuery.startsWith('@')) {
      const query = recipientSearchQuery.toLowerCase();
      return directoryMembers.filter(m =>
        m.name.toLowerCase().includes(query) ||
        m.email.toLowerCase().includes(query) ||
        (m.committee?.toLowerCase().includes(query))
      ).slice(0, 8);
    }
    
    // Filter based on active command
    switch (activeCommand) {
      case '@Person': {
        const query = commandSearchQuery.toLowerCase();
        if (!query) return directoryMembers.slice(0, 8);
        return directoryMembers.filter(m =>
          m.name.toLowerCase().includes(query) ||
          m.email.toLowerCase().includes(query) ||
          (m.committee?.toLowerCase().includes(query))
        ).slice(0, 8);
      }
      
      case '@Event': {
        const query = commandSearchQuery.toLowerCase();
        if (!query) return events.slice(0, 8);
        return events.filter(e =>
          e.Title.toLowerCase().includes(query) ||
          e.Status?.toLowerCase().includes(query)
        ).slice(0, 8);
      }
      
      case '@Committee': {
        const query = commandSearchQuery.toLowerCase();
        const committees = uniqueCommittees.map(name => ({ id: name.toLowerCase().replace(/\s+/g, '-'), name }));
        if (!query) return committees.slice(0, 10);
        return committees.filter(c => c.name.toLowerCase().includes(query)).slice(0, 10);
      }
      
      case '@All':
        return []; // No suggestions needed, direct action
      
      case '@External':
        return []; // No suggestions, manual input
      
      default:
        return [];
    }
  }, [activeCommand, commandSearchQuery, recipientSearchQuery, directoryMembers, uniqueCommittees, events]);

  // ============= SELECTION HANDLERS =============
  const getRecipientRowKey = useCallback((recipient: EmailRecipientRow): number => {
    if (typeof recipient.RowIndex === 'number' && recipient.RowIndex > 0) {
      return recipient.RowIndex;
    }
    const fallbackIndex = recipients.findIndex(r => r === recipient);
    return fallbackIndex >= 0 ? fallbackIndex + 2 : -1;
  }, [recipients]);

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedRows(new Set());
    } else {
      const allIndices = filteredRecipients
        .map((recipient) => getRecipientRowKey(recipient))
        .filter((rowIndex) => rowIndex > 0);
      setSelectedRows(new Set(allIndices));
    }
    setSelectAll(!selectAll);
  };

  const handleSelectRow = (rowIndex: number) => {
    const newSelection = new Set(selectedRows);
    if (newSelection.has(rowIndex)) {
      newSelection.delete(rowIndex);
    } else {
      newSelection.add(rowIndex);
    }
    setSelectedRows(newSelection);
    setSelectAll(newSelection.size === filteredRecipients.length);
  };

  // ============= FORM HANDLERS =============

  const initFormData = (recipient?: EmailRecipient) => {
    const data: Partial<EmailRecipient> = {};
    
    if (recipient) {
      data.RecipientName = recipient.RecipientName || '';
      data.Email = recipient.Email || '';
      data.Headline = recipient.Headline || '';
      data.Message = recipient.Message || '';
      data.Date = recipient.Date || '';
      data.Time = recipient.Time || '';
      data.Venue = recipient.Venue || '';
      data.Amount = recipient.Amount || '';
      data.Link = recipient.Link || '';
      data.RegistrationLink = recipient.RegistrationLink || '';
      data.Attachments = recipient.Attachments || '';
    }
    
    setFormData(data);
  };

  const handleOpenCreateModal = async () => {
    initFormData();
    // Reset command palette state
    setActiveCommand(null);
    setCommandSearchQuery('');
    setRecipientSearchQuery('');
    setShowRecipientDropdown(false);
    setExternalName('');
    setExternalEmail('');
    setPendingBatchRecipients([]);
    setPendingBatchSource('');
    setShowQueuedRecipients(true);
    setShowAllQueuedRecipients(false);
    setShowCreateModal(true);
    
    // Pre-load directory members
    if (directoryMembers.length === 0) {
      await loadDirectoryMembers();
    }
  };

  const handleOpenEditModal = (recipient: EmailRecipient) => {
    setEditingRecipient(recipient);
    initFormData(recipient);
    setShowEditModal(true);
  };

  const handleOpenDeleteConfirm = (rowIndex: number) => {
    setDeletingRowIndex(rowIndex);
    setShowDeleteConfirmModal(true);
  };

  const handleOpenPreview = (recipient: EmailRecipient) => {
    setPreviewingRecipient(recipient);
    setShowPreviewModal(true);
  };

  // ============= COMMAND PALETTE HANDLERS FOR CREATE MODAL (like Issuance Center) =============
  
  // Handle universal search input
  const handleUniversalSearchInput = (value: string) => {
    setRecipientSearchQuery(value);
    setShowRecipientDropdown(true);
    
    // Check if typing a command
    if (value.startsWith('@') && !activeCommand) {
      // User is typing a command
      return;
    }
    
    // If command is active, update command search query
    if (activeCommand) {
      setCommandSearchQuery(value);
    }
  };
  
  // Handle command selection
  const handleSelectCommand = (command: typeof SEARCH_COMMANDS[number]['command']) => {
    setActiveCommand(command);
    setRecipientSearchQuery('');
    setCommandSearchQuery('');
    setShowRecipientDropdown(true);

    if (command === '@All') {
      handleLoadAllDirectory();
      return;
    }
    
    // Load directory members if not loaded for @Person or @Committee
    if ((command === '@Person' || command === '@Committee') && directoryMembers.length === 0) {
      loadDirectoryMembers();
    }
    
    // Load events if not loaded for @Event
    if (command === '@Event' && events.length === 0) {
      loadEvents();
    }
  };
  
  // Handle selecting a member from suggestions
  const handleSelectSuggestion = (member: DirectoryMember) => {
    const normalizedEmail = member.email.toLowerCase().trim();
    setPendingBatchRecipients((prev) => {
      const exists = prev.some((r) => r.Email.toLowerCase().trim() === normalizedEmail);
      if (exists) return prev;
      return [
        ...prev,
        {
          queueId: createQueueId(),
          RecipientName: member.name,
          Email: member.email,
          Headline: '',
          Message: '',
          sourceType: 'person',
          sourceLabel: 'Person Search',
        },
      ];
    });
    setPendingBatchSource('');
    setShowQueuedRecipients(true);
    setRecipientSearchQuery('');
    setCommandSearchQuery('');
    setShowRecipientDropdown(false);
    setActiveCommand(null);
    toast.success(`Queued: ${member.name}`);
  };
  
  // Handle selecting a committee (batch add all members from committee)
  const handleSelectCommittee = async (committeeName: string) => {
    if (!activeTemplate) {
      toast.error('Select a specific template to add recipients');
      return;
    }
    // Find all members from this committee
    const normalizedTarget = committeeName.toLowerCase().trim();
    const committeeMembers = directoryMembers.filter((m) => {
      const normalizedMemberCommittee = (m.committee || "").toLowerCase().trim();
      if (normalizedTarget === 'general members' || normalizedTarget.includes('general')) {
        return !normalizedMemberCommittee || normalizedMemberCommittee.includes('general');
      }
      return normalizedMemberCommittee === normalizedTarget;
    });
    
    if (committeeMembers.length === 0) {
      toast.error(`No members found in ${committeeName}`);
      setActiveCommand(null);
      return;
    }
    
    // Stage recipients only (save will happen on Add button)
    setRecipientSearchQuery('');
    setCommandSearchQuery('');
    setShowRecipientDropdown(false);
    setActiveCommand(null);
    setFormData(prev => ({ ...prev, RecipientName: '', Email: '' }));

    const staged = committeeMembers
      .map(m => ({
        queueId: createQueueId(),
        RecipientName: m.name,
        Email: m.email,
        Headline: '',
        Message: '',
        sourceType: 'committee' as const,
        sourceLabel: committeeName,
      }));

    setPendingBatchRecipients(staged);
    setPendingBatchSource(`Committee: ${committeeName}`);
    toast.success(`${staged.length} recipients queued. Press Add to save.`);
  };
  
  // Handle selecting an event (batch add all attendees from event)
  const handleSelectEvent = async (event: EventData) => {
    if (!activeTemplate) {
      toast.error('Select a specific template to add recipients');
      return;
    }
    setIsLoadingEvents(true);
    try {
      const attendees = await getEventAttendees(event.EventID);
      // Filter to those with email
      const validAttendees = attendees.filter(a => a.email && a.email.trim());
      
      if (validAttendees.length === 0) {
        toast.error(`No attendees with email found for "${event.Title}"`);
        setIsLoadingEvents(false);
        setActiveCommand(null);
        return;
      }
      
      // Stage recipients only (save will happen on Add button)
      setRecipientSearchQuery('');
      setCommandSearchQuery('');
      setShowRecipientDropdown(false);
      setActiveCommand(null);
      setFormData(prev => ({ ...prev, RecipientName: '', Email: '' }));
      setIsLoadingEvents(false);

    const staged = validAttendees
        .map(a => ({
          queueId: createQueueId(),
          RecipientName: a.name,
          Email: a.email,
          Headline: event.Title,
          Message: '',
          sourceType: 'event' as const,
          sourceLabel: event.Title,
        }));

      setPendingBatchRecipients(staged);
      setPendingBatchSource(`Event: ${event.Title}`);
      toast.success(`${staged.length} recipients queued. Press Add to save.`);
    } catch (error) {
      console.error("Error loading event attendees:", error);
      toast.error('Failed to load event attendees');
      setIsLoadingEvents(false);
      setActiveCommand(null);
    }
  };
  
  // Handle clearing the command
  const handleClearCommand = () => {
    setActiveCommand(null);
    setCommandSearchQuery('');
    setRecipientSearchQuery('');
  };
  
  // Handle adding external recipient
  const handleAddExternalRecipient = () => {
    if (!externalName.trim() || !externalEmail.trim()) {
      toast.error("Please enter both name and email");
      return;
    }
    
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(externalEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }
    
    const name = externalName.trim();
    const email = externalEmail.trim();
    const normalizedEmail = email.toLowerCase();
    setPendingBatchRecipients((prev) => {
      const exists = prev.some((r) => r.Email.toLowerCase().trim() === normalizedEmail);
      if (exists) return prev;
      return [
        ...prev,
        {
          queueId: createQueueId(),
          RecipientName: name,
          Email: email,
          Headline: '',
          Message: '',
          sourceType: 'external',
          sourceLabel: 'External',
        },
      ];
    });
    setPendingBatchSource('');
    setShowQueuedRecipients(true);
    
    setExternalName("");
    setExternalEmail("");
    setActiveCommand(null);
    setShowRecipientDropdown(false);
    toast.success(`Queued: ${name}`);
  };
  
  // Handle loading all directory members (for @All command - batch add ALL members)
  const handleLoadAllDirectory = async () => {
    if (!activeTemplate) {
      toast.error('Select a specific template to add recipients');
      return;
    }
    let members = directoryMembers;
    if (members.length === 0) {
      try {
        const fetched = await getDirectoryMembers(true);
        members = fetched
          .filter((m) => m.email && m.name)
          .map((m) => ({
            name: m.name,
            email: m.email,
            committee: m.committee || '',
            profilePicture: normalizeProfileImageUrl(m.profilePicture),
          }));
        if (members.length > 0) {
          setDirectoryMembers(members);
        }
      } catch (error) {
        console.error('Error loading all directory members:', error);
      }
    }

    if (members.length === 0) {
      toast.error("No directory members found. Try refreshing.");
      return;
    }
    
    // Stage recipients only (save will happen on Add button)
    setActiveCommand(null);
    setRecipientSearchQuery('');
    setCommandSearchQuery('');
    setShowRecipientDropdown(false);
    setFormData(prev => ({ ...prev, RecipientName: '', Email: '' }));

    const staged = members
      .map(m => ({
        queueId: createQueueId(),
        RecipientName: m.name,
        Email: m.email,
        Headline: '',
        Message: '',
        sourceType: 'all' as const,
        sourceLabel: 'All Directory Members',
      }));

    setPendingBatchRecipients(staged);
    setPendingBatchSource('All Directory Members');
    toast.success(`${staged.length} recipients queued. Press Add to save.`);
  };

  const handleRemoveQueuedRecipient = (queueId: string) => {
    setPendingBatchRecipients((prev) => {
      const next = prev.filter((recipient) => recipient.queueId !== queueId);
      if (next.length === 0) {
        setPendingBatchSource('');
        setShowQueuedRecipients(true);
        setShowAllQueuedRecipients(false);
      }
      return next;
    });
  };

  const handleClearQueuedRecipients = () => {
    setPendingBatchRecipients([]);
    setPendingBatchSource('');
    setShowQueuedRecipients(true);
    setShowAllQueuedRecipients(false);
    setFormData(prev => ({ ...prev, RecipientName: '', Email: '' }));
  };

  useEffect(() => {
    if (pendingBatchRecipients.length <= 8) {
      setShowAllQueuedRecipients(false);
    }
  }, [pendingBatchRecipients.length]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (recipientSearchRef.current && !recipientSearchRef.current.contains(event.target as Node)) {
        setShowRecipientDropdown(false);
      }
    };

    if (showRecipientDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showRecipientDropdown]);

  // ============= CRUD OPERATIONS =============
  const handleCreateRecipient = async () => {
    if (!activeTemplate) {
      toast.error('Select a specific template to add recipients');
      return;
    }
    if (pendingBatchRecipients.length > 0) {
      const toastId = `create-batch-${Date.now()}`;
      addUploadToast({
        id: toastId,
        title: 'Adding Recipients',
        message: `Adding ${pendingBatchRecipients.length} recipients...`,
        status: 'loading',
        progress: 10,
      });

      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < pendingBatchRecipients.length; i++) {
        const recipient = pendingBatchRecipients[i];
        try {
          await addEmailRecipient(activeTemplate, {
            RecipientName: recipient.RecipientName || '',
            Email: recipient.Email || '',
            Headline: recipient.Headline || '',
            Message: recipient.Message || '',
            Date: '',
            Time: '',
            Venue: '',
            Amount: '',
            Link: '',
            RegistrationLink: '',
            Attachments: '',
          });
          successCount++;
          updateUploadToast(toastId, {
            progress: Math.round(((i + 1) / pendingBatchRecipients.length) * 100),
            message: `Adding ${recipient.RecipientName}... (${i + 1}/${pendingBatchRecipients.length})`,
          });
        } catch (error) {
          errorCount++;
          console.error('Failed to add queued recipient:', recipient.RecipientName, error);
        }
      }

      updateUploadToast(toastId, {
        status: errorCount === 0 ? 'success' : 'error',
        title: 'Batch Add Complete',
        message: `Added ${successCount}${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
        progress: 100,
      });
      setTimeout(() => removeUploadToast(toastId), 5000);

      setPendingBatchRecipients([]);
      setPendingBatchSource('');
      setShowCreateModal(false);
      setShowQueuedRecipients(true);
      setShowAllQueuedRecipients(false);
      loadRecipients();
      await logCreate(username, 'EmailSystem', `Batch added ${successCount} recipients${pendingBatchSource ? ` from ${pendingBatchSource}` : ''} to ${selectedTemplate}`);
      return;
    }

    const toastId = `create-${Date.now()}`;
    addUploadToast({
      id: toastId,
      title: 'Adding Recipient',
      message: 'Creating new email recipient...',
      status: 'loading',
      progress: 50,
    });

    try {
      await addEmailRecipient(activeTemplate, {
        RecipientName: formData.RecipientName || '',
        Email: formData.Email || '',
        Headline: formData.Headline || '',
        Message: formData.Message || '',
        Date: formData.Date,
        Time: formData.Time,
        Venue: formData.Venue,
        Amount: formData.Amount,
        OldPosition: formData.OldPosition,
        Link: formData.Link,
        RegistrationLink: formData.RegistrationLink,
        Attachments: formData.Attachments,
      });

      updateUploadToast(toastId, {
        status: 'success',
        title: 'Recipient Added',
        message: `Added ${formData.RecipientName} to ${EMAIL_TEMPLATES[activeTemplate].name}`,
        progress: 100,
      });
      setTimeout(() => removeUploadToast(toastId), 3000);

      setShowCreateModal(false);
      loadRecipients();
      
      // Log the action
      await logCreate(
        username,
        'EmailSystem',
        `Added recipient: ${formData.RecipientName} to ${selectedTemplate}`
      );
    } catch (error) {
      updateUploadToast(toastId, {
        status: 'error',
        title: 'Failed to Add',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        progress: 100,
      });
      setTimeout(() => removeUploadToast(toastId), 5000);
    }
  };

  const handleUpdateRecipient = async () => {
    if (!activeTemplate) {
      toast.error('Select a specific template to update recipients');
      return;
    }
    if (!editingRecipient?.RowIndex) return;

    const toastId = `update-${Date.now()}`;
    addUploadToast({
      id: toastId,
      title: 'Updating Recipient',
      message: 'Saving changes...',
      status: 'loading',
      progress: 50,
    });

    try {
      await updateEmailRecipient(activeTemplate, editingRecipient.RowIndex, {
        RecipientName: formData.RecipientName,
        Email: formData.Email,
        Headline: formData.Headline,
        Message: formData.Message,
        Date: formData.Date,
        Time: formData.Time,
        Venue: formData.Venue,
        Amount: formData.Amount,
        OldPosition: formData.OldPosition,
        Link: formData.Link,
        RegistrationLink: formData.RegistrationLink,
        Attachments: formData.Attachments,
      });

      updateUploadToast(toastId, {
        status: 'success',
        title: 'Recipient Updated',
        message: `Updated ${formData.RecipientName}`,
        progress: 100,
      });
      setTimeout(() => removeUploadToast(toastId), 3000);

      setShowEditModal(false);
      setEditingRecipient(null);
      loadRecipients();
      
      await logEdit(
        username,
        'EmailSystem',
        `Updated recipient: ${formData.RecipientName} in ${selectedTemplate}`
      );
    } catch (error) {
      updateUploadToast(toastId, {
        status: 'error',
        title: 'Update Failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        progress: 100,
      });
      setTimeout(() => removeUploadToast(toastId), 5000);
    }
  };

  const handleDeleteRecipient = async () => {
    if (!activeTemplate) {
      toast.error('Select a specific template to delete recipients');
      return;
    }
    if (deletingRowIndex === null) return;

    const toastId = `delete-${Date.now()}`;
    addUploadToast({
      id: toastId,
      title: 'Deleting Recipient',
      message: 'Removing recipient...',
      status: 'loading',
      progress: 50,
    });

    try {
      const recipient = recipients.find(r => r.RowIndex === deletingRowIndex);
      await deleteEmailRecipient(activeTemplate, deletingRowIndex);

      updateUploadToast(toastId, {
        status: 'success',
        title: 'Recipient Deleted',
        message: `Removed ${recipient?.RecipientName || 'recipient'}`,
        progress: 100,
      });
      setTimeout(() => removeUploadToast(toastId), 3000);

      setShowDeleteConfirmModal(false);
      setDeletingRowIndex(null);
      loadRecipients();
      
      await logDelete(
        username,
        'EmailSystem',
        `Deleted recipient: ${recipient?.RecipientName} from ${selectedTemplate}`
      );
    } catch (error) {
      updateUploadToast(toastId, {
        status: 'error',
        title: 'Delete Failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        progress: 100,
      });
      setTimeout(() => removeUploadToast(toastId), 5000);
    }
  };

  // ============= SEND OPERATIONS =============
  const handleSendSingle = async (rowIndex: number) => {
    if (!canSendForCurrentTemplate) {
      toast.error('You do not have permission to send emails');
      return;
    }
    if (!activeTemplate) return;

    const recipient = recipients.find(r => r.RowIndex === rowIndex);
    if (!recipient) return;

    const toastId = `send-single-${Date.now()}`;
    setIsSending(true);
    addUploadToast({
      id: toastId,
      title: 'Sending Email',
      message: `Sending to ${recipient.RecipientName}...`,
      status: 'loading',
      progress: 30,
    });

    try {
      const result = await sendEmails({
        templateType: activeTemplate,
        recipients: [recipient],
        sendMode: 'single',
        selectedRowIndices: [rowIndex],
      });

      if (result.sent > 0) {
        updateUploadToast(toastId, {
          status: 'success',
          title: 'Email Sent',
          message: `Successfully sent to ${recipient.Email}`,
          progress: 100,
        });
      } else {
        updateUploadToast(toastId, {
          status: 'error',
          title: 'Send Failed',
          message: result.details[0]?.message || 'Failed to send email',
          progress: 100,
        });
      }
      setTimeout(() => removeUploadToast(toastId), 4000);

      loadRecipients();
      loadQuota();
    } catch (error) {
      updateUploadToast(toastId, {
        status: 'error',
        title: 'Send Failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        progress: 100,
      });
      setTimeout(() => removeUploadToast(toastId), 5000);
    } finally {
      setIsSending(false);
    }
  };

  const handleSendSelected = async () => {
    if (!canSendForCurrentTemplate) {
      toast.error('You do not have permission to send emails');
      return;
    }
    if (!activeTemplate) return;

    if (selectedRows.size === 0) {
      toast.error('No recipients selected');
      return;
    }

    const toastId = `send-selected-${Date.now()}`;
    setIsSending(true);
    addUploadToast({
      id: toastId,
      title: 'Sending Emails',
      message: `Sending to ${selectedRows.size} recipients...`,
      status: 'loading',
      progress: 10,
    });

    try {
      const selectedIndices = Array.from(selectedRows).filter((rowIndex) => rowIndex > 0);
      const selectedRecipients = recipients.filter((recipient) => selectedRows.has(getRecipientRowKey(recipient)));

      const result = await sendEmails({
        templateType: activeTemplate,
        recipients: selectedRecipients,
        sendMode: 'selected',
        selectedRowIndices: selectedIndices,
      }, (progress) => {
        setSendProgress(progress);
        const percent = Math.round(10 + (progress.sent / progress.total) * 85);
        updateUploadToast(toastId, {
          progress: percent,
          progressLabel: `Sent ${progress.sent}/${progress.total}...`,
          message: `Sent ${progress.sent} of ${progress.total}${progress.failed > 0 ? ` (${progress.failed} failed)` : ''}`,
        });
      });

      if (result.failed > 0) {
        updateUploadToast(toastId, {
          status: 'error',
          title: 'Partially Sent',
          message: `Sent: ${result.sent} | Failed: ${result.failed}`,
          progress: 100,
        });
      } else {
        updateUploadToast(toastId, {
          status: 'success',
          title: 'Emails Sent',
          message: `Successfully sent ${result.sent} emails!`,
          progress: 100,
        });
      }
      setTimeout(() => removeUploadToast(toastId), 5000);

      setSelectedRows(new Set());
      setSelectAll(false);
      loadRecipients();
      loadQuota();
    } catch (error) {
      updateUploadToast(toastId, {
        status: 'error',
        title: 'Send Failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        progress: 100,
      });
      setTimeout(() => removeUploadToast(toastId), 5000);
    } finally {
      setIsSending(false);
      setSendProgress(null);
    }
  };

  const handleSendAll = async () => {
    if (!canSendForCurrentTemplate) {
      toast.error('You do not have permission to send emails');
      return;
    }
    if (!activeTemplate) return;

    const pendingRecipients = recipients.filter(r => !r.Status?.toLowerCase().startsWith('sent') && !r.EmailId);
    if (pendingRecipients.length === 0) {
      toast.info('No pending emails to send');
      return;
    }

    const toastId = `send-all-${Date.now()}`;
    setIsSending(true);
    addUploadToast({
      id: toastId,
      title: 'Batch Sending',
      message: `Sending ${pendingRecipients.length} emails...`,
      status: 'loading',
      progress: 10,
    });

    try {
      const result = await batchSendAll(activeTemplate, (progress) => {
        setSendProgress(progress);
        const percent = Math.round(10 + (progress.sent / progress.total) * 85);
        updateUploadToast(toastId, {
          progress: percent,
          progressLabel: `Sent ${progress.sent}/${progress.total}...`,
          message: `Sent ${progress.sent} of ${progress.total}${progress.failed > 0 ? ` (${progress.failed} failed)` : ''}`,
        });
      });

      if (result.failed > 0) {
        updateUploadToast(toastId, {
          status: 'error',
          title: 'Batch Complete with Errors',
          message: `Sent: ${result.sent} | Failed: ${result.failed} | Skipped: ${result.skipped}`,
          progress: 100,
        });
      } else {
        updateUploadToast(toastId, {
          status: 'success',
          title: 'Batch Complete',
          message: `Successfully sent ${result.sent} emails!`,
          progress: 100,
        });
      }
      setTimeout(() => removeUploadToast(toastId), 5000);

      loadRecipients();
      loadQuota();
    } catch (error) {
      updateUploadToast(toastId, {
        status: 'error',
        title: 'Batch Failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        progress: 100,
      });
      setTimeout(() => removeUploadToast(toastId), 5000);
    } finally {
      setIsSending(false);
      setSendProgress(null);
    }
  };

  // ============= RENDER HELPERS =============
  const formatSentStatusTime = (rawValue: string) => {
    const raw = rawValue.trim();
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return raw;
    }
    return parsed.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      year: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const renderStatusBadge = (status: string) => {
    const colors = getEmailStatusColor(status);
    const statusLower = status?.toLowerCase() || '';
    
    let icon = null;
    if (statusLower.startsWith('sent')) {
      icon = <CheckCircle className="w-3 h-3" />;
    } else if (statusLower.startsWith('error')) {
      icon = <XCircle className="w-3 h-3" />;
    } else if (statusLower.includes('duplicate')) {
      icon = <AlertCircle className="w-3 h-3" />;
    }

    if (statusLower.startsWith('sent:')) {
      const sentTimeRaw = status.replace(/^sent\s*:\s*/i, '').trim();
      const sentTime = formatSentStatusTime(sentTimeRaw);
      return (
        <span
          className="inline-flex max-w-[170px] items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium leading-tight"
          style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
          title={status}
        >
          {icon}
          <span className="min-w-0">
            <span className="block font-semibold">Sent</span>
            <span className="block truncate opacity-80">{sentTime}</span>
          </span>
        </span>
      );
    }

    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
        style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
        title={status || 'Draft'}
      >
        {icon}
        {status || 'Draft'}
      </span>
    );
  };

  const getActionLinkUrl = (rawLink?: string) => {
    const trimmed = (rawLink || '').trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  };

  const currentTemplate = isAllTemplates
    ? {
        code: 'ALL',
        name: 'All Templates',
        headers: EMAIL_TEMPLATES.General_Notices.headers,
        buttonText: 'Open Link',
        type: 'simple' as const,
        description: 'Combined recipients from all email templates',
      }
    : EMAIL_TEMPLATES[selectedTemplate];
  const previewActionLink = getActionLinkUrl(previewingRecipient?.Link);
  const queuedGroups = useMemo(() => {
    const groups = new Map<string, PendingBatchRecipient[]>();
    pendingBatchRecipients.forEach((recipient) => {
      const key = `${recipient.sourceType || 'all'}::${recipient.sourceLabel || pendingBatchSource || 'Queued Recipients'}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(recipient);
    });
    return Array.from(groups.entries()).map(([key, recipients]) => {
      const parts = key.split('::');
      return {
        sourceType: (parts[0] || 'all') as 'committee' | 'event' | 'all' | 'person' | 'external',
        sourceLabel: parts[1] || 'Queued Recipients',
        recipients,
      };
    });
  }, [pendingBatchRecipients, pendingBatchSource]);

  const getQueueSourceStyle = (sourceType: 'committee' | 'event' | 'all' | 'person' | 'external') => {
    if (sourceType === 'person') {
      return {
        bg: isDark ? 'rgba(59,130,246,0.18)' : 'rgba(59,130,246,0.10)',
        border: isDark ? 'rgba(59,130,246,0.45)' : 'rgba(59,130,246,0.28)',
        text: '#2563eb',
      };
    }
    if (sourceType === 'external') {
      return {
        bg: isDark ? 'rgba(236,72,153,0.18)' : 'rgba(236,72,153,0.10)',
        border: isDark ? 'rgba(236,72,153,0.45)' : 'rgba(236,72,153,0.28)',
        text: '#db2777',
      };
    }
    if (sourceType === 'committee') {
      return {
        bg: isDark ? 'rgba(59,130,246,0.18)' : 'rgba(59,130,246,0.10)',
        border: isDark ? 'rgba(59,130,246,0.45)' : 'rgba(59,130,246,0.28)',
        text: '#2563eb',
      };
    }
    if (sourceType === 'event') {
      return {
        bg: isDark ? 'rgba(168,85,247,0.18)' : 'rgba(168,85,247,0.10)',
        border: isDark ? 'rgba(168,85,247,0.45)' : 'rgba(168,85,247,0.28)',
        text: '#9333ea',
      };
    }
    return {
      bg: isDark ? 'rgba(16,185,129,0.18)' : 'rgba(16,185,129,0.10)',
      border: isDark ? 'rgba(16,185,129,0.45)' : 'rgba(16,185,129,0.28)',
      text: '#059669',
    };
  };

  const tableColumnCount =
    (canSendForCurrentTemplate ? 1 : 0) +
    6 +
    (isAllTemplates ? 1 : 0) +
    (currentTemplate.type === 'event' ? 2 : 0) +
    (currentTemplate.type === 'payment' ? 1 : 0);

  // ============= RENDER =============
  return (
    <PageLayout
      title="Email System"
      subtitle={`${currentTemplate.name} - ${currentTemplate.description}`}
      onClose={onClose}
      isDark={isDark}
      breadcrumbs={[
        { label: "Home", onClick: onClose },
        { label: "Communication Center", onClick: undefined },
        { label: "Email System" },
      ]}
    >
      {/* Compact Toolbar */}
      <div className="mb-4 p-4 rounded-xl"
        style={{
          background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
        }}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
              Email Template
            </label>
            <CustomDropdown
                value={selectedTemplate}
                onChange={(value) => setSelectedTemplate(value as TemplateSelection)}
                options={[
                  { value: 'ALL', label: 'All Templates' },
                  ...(Object.keys(EMAIL_TEMPLATES) as EmailTemplateType[]).map((templateKey) => ({
                    value: templateKey,
                    label: EMAIL_TEMPLATES[templateKey].name,
                  })),
                ]}
                placeholder="Select template"
                isDark={isDark}
                size="sm"
                maxHeight={320}
                forceDirection="down"
              />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
              <Filter className="mr-1 inline h-3.5 w-3.5" />
              Filter
            </label>
            <CustomDropdown
                value={filterMode}
                onChange={(value) => setFilterMode(value as FilterMode)}
                options={[
                  { value: 'all', label: `All (${recipients.length})` },
                  { value: 'members', label: `Members (${recipients.filter(r => r.Email?.includes('@gmail.com') || r.Email?.includes('@ysp')).length})` },
                  { value: 'external', label: `External (${recipients.filter(r => !r.Email?.includes('@gmail.com') && !r.Email?.includes('@ysp')).length})` },
                  { value: 'sent', label: `Sent (${recipients.filter(r => r.Status?.toLowerCase().startsWith('sent')).length})` },
                  { value: 'draft', label: `Draft (${recipients.filter(r => !r.Status || r.Status.toLowerCase() === 'draft').length})` },
                  { value: 'error', label: `Errors (${recipients.filter(r => r.Status?.toLowerCase().includes('error') || r.Status?.toLowerCase().includes('duplicate')).length})` },
                ]}
                placeholder="Filter recipients"
                isDark={isDark}
                size="sm"
                maxHeight={320}
                forceDirection="down"
              />
          </div>
        </div>
      </div>

      {/* Search Row */}
      <div className="mb-3">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search recipients..."
          isDark={isDark}
        />
      </div>

      {/* Action Bar */}
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle */}
          <button
            onClick={() => setViewMode(prev => (prev === 'table' ? 'card' : 'table'))}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all"
            style={{
              background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
              color: isDark ? '#d1d5db' : '#374151',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
            }}
            title={`Switch to ${viewMode === 'table' ? 'card' : 'table'} view`}
          >
            {viewMode === 'table' ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
            <span className="hidden md:inline">{viewMode === 'table' ? 'Table View' : 'Card View'}</span>
            <span className="hidden min-[481px]:inline md:hidden">{viewMode === 'table' ? 'Table' : 'Card'}</span>
          </button>

          {/* Group by Subject Toggle */}
          <button
            onClick={() => setGroupBySubject(!groupBySubject)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: groupBySubject ? DESIGN_TOKENS.colors.brand.orange : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
              color: groupBySubject ? '#fff' : isDark ? '#9ca3af' : '#6b7280',
              border: `1px solid ${groupBySubject ? DESIGN_TOKENS.colors.brand.orange : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
            }}
            title="Group by Subject"
          >
            <Layers className="w-4 h-4" />
            <span className="hidden sm:inline">Group</span>
          </button>

          {/* Quota Display */}
          {quota && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap"
              style={{
                background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                color: quota.remaining < 50 ? '#ef4444' : quota.remaining < 200 ? '#f59e0b' : 'inherit'
              }}
            >
              <Mail className="w-4 h-4 shrink-0" />
              <span>{quota.remaining} left</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Refresh Button */}
          <button
            onClick={() => {
              clearEmailSystemCache();
              loadRecipients();
              loadQuota();
            }}
            disabled={isLoading}
            className="p-2 rounded-lg transition-all hover:scale-105 active:scale-95"
            style={{
              background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
              opacity: isLoading ? 0.6 : 1,
            }}
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
          </button>

          {/* View Logs Button */}
          <button
            onClick={() => {
              loadLogs();
              setShowLogsModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all hover:scale-105 active:scale-95"
            style={{
              background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
            }}
          >
            <FileText className="w-4 h-4" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
            <span className="text-sm font-medium">Logs</span>
          </button>

          {canSendForCurrentTemplate && (
            <>
              {/* Add Recipient Button */}
              <button 
                onClick={handleOpenCreateModal}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all hover:scale-105 active:scale-95"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                }}
              >
                <Plus className="w-4 h-4" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
                <span className="text-sm font-medium">Add</span>
              </button>

              {/* Send Selected Button */}
              {selectedRows.size > 0 && (
                <button 
                  onClick={handleSendSelected}
                  disabled={isSending}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg transition-all hover:scale-105 active:scale-95 text-white font-semibold text-sm"
                  style={{
                    background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.orange} 0%, ${DESIGN_TOKENS.colors.brand.red} 100%)`,
                    boxShadow: '0 4px 12px rgba(246, 66, 31, 0.3)',
                    opacity: isSending ? 0.7 : 1,
                  }}
                >
                  {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>Send ({selectedRows.size})</span>
                </button>
              )}

              {/* Send All Button */}
              <button 
                onClick={handleSendAll}
                disabled={isSending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg transition-all hover:scale-105 active:scale-95 text-white font-semibold text-sm"
                style={{
                  background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.orange} 0%, ${DESIGN_TOKENS.colors.brand.red} 100%)`,
                  boxShadow: '0 4px 12px rgba(246, 66, 31, 0.3)',
                  opacity: isSending ? 0.7 : 1,
                }}
              >
                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>Send All</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Recipients Table/Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
        </div>
      ) : filteredRecipients.length === 0 ? (
        <div className="text-center py-20">
          <Mail className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium mb-2">No recipients found</p>
          <p className="text-sm opacity-60">Add recipients to start sending emails</p>
        </div>
      ) : viewMode === 'table' ? (
        <div className="overflow-x-auto rounded-xl border"
          style={{ 
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
          }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }}>
                {canSendForCurrentTemplate && (
                  <th className="p-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded"
                    />
                  </th>
                )}
                <th className="p-3 text-left font-semibold">Recipient</th>
                <th className="p-3 text-left font-semibold">Email</th>
                {isAllTemplates && <th className="p-3 text-left font-semibold">Template</th>}
                <th className="p-3 text-left font-semibold">{currentTemplate.type === 'event' ? 'Event/Subject' : 'Subject'}</th>
                {currentTemplate.type === 'event' && (
                  <>
                    <th className="p-3 text-left font-semibold">Date</th>
                    <th className="p-3 text-left font-semibold">Time</th>
                  </>
                )}
                {currentTemplate.type === 'payment' && (
                  <th className="p-3 text-left font-semibold">Amount</th>
                )}
                <th className="p-3 text-left font-semibold">Status</th>
                <th className="p-3 text-left font-semibold">Email ID</th>
                <th className="p-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {groupBySubject ? (
                // Grouped View
                <>
                  {/* Expand/Collapse All Header */}
                  <tr style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                    <td colSpan={tableColumnCount} className="p-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold" style={{ color: DESIGN_TOKENS.colors.brand.orange }}>
                          {groupedRecipients.length} Groups • {filteredRecipients.length} Recipients
                        </span>
                        <button
                          onClick={toggleAllGroups}
                          className="text-xs px-2 py-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                        >
                          {expandedGroups.size === groupedRecipients.length ? 'Collapse All' : 'Expand All'}
                        </button>
                      </div>
                    </td>
                  </tr>
                  
                  {groupedRecipients.map((group) => {
                    const isExpanded = expandedGroups.has(group.subject);
                    
                    return (
                      <Fragment key={group.subject}>
                        {/* Group Header Row */}
                        <tr 
                          onClick={() => toggleGroupExpansion(group.subject)}
                          className="cursor-pointer transition-colors hover:bg-orange-500/5"
                          style={{ 
                            background: isDark ? 'rgba(249,115,22,0.1)' : 'rgba(249,115,22,0.05)',
                            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                          }}
                        >
                          <td colSpan={tableColumnCount} className="p-3">
                            <div className="flex items-center gap-3">
                              {isExpanded ? (
                                <ChevronDown className="w-5 h-5" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
                              ) : (
                                <ChevronRight className="w-5 h-5" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold truncate" title={group.subject}>
                                  {group.subject}
                                </div>
                                <div className="text-xs opacity-60 mt-0.5">
                                  {group.totalCount} recipient{group.totalCount !== 1 ? 's' : ''} • {group.sentCount} sent
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span 
                                  className="text-xs px-2 py-1 rounded-full"
                                  style={{ 
                                    background: group.sentCount === group.totalCount 
                                      ? isDark ? 'rgba(34,197,94,0.2)' : 'rgba(34,197,94,0.1)'
                                      : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                                    color: group.sentCount === group.totalCount ? '#22c55e' : 'inherit'
                                  }}
                                >
                                  {group.sentCount}/{group.totalCount}
                                </span>
                                {group.sentCount === group.totalCount && (
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                        
                        {/* Group Recipients */}
                        {isExpanded && group.recipients.map((recipient) => {
                          const rowIndex = getRecipientRowKey(recipient);
                          const isSelected = selectedRows.has(rowIndex);
                          const isSent = recipient.Status?.toLowerCase().startsWith('sent');
                          
                          return (
                            <tr 
                              key={rowIndex}
                              className="transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                              style={{ 
                                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                                opacity: isSent ? 0.7 : 1,
                                background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.5)',
                              }}
                            >
                              {canSendForCurrentTemplate && (
                                <td className="p-3 pl-10">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleSelectRow(rowIndex)}
                                    disabled={isSent}
                                    className="w-4 h-4 rounded"
                                  />
                                </td>
                              )}
                              <td className="p-3 font-medium">{recipient.RecipientName}</td>
                              <td className="p-3 text-blue-500">{recipient.Email}</td>
                              {isAllTemplates && <td className="p-3 text-xs opacity-70">{recipient.__templateName || 'Unknown'}</td>}
                              <td className="p-3 max-w-xs truncate opacity-50 text-xs" title={getRecipientSubject(recipient, recipient.__templateKey || subjectTemplateFallback)}>
                                —
                              </td>
                              {currentTemplate.type === 'event' && (
                                <>
                                  <td className="p-3">{recipient.Date || '—'}</td>
                                  <td className="p-3">{recipient.Time || '—'}</td>
                                </>
                              )}
                              {currentTemplate.type === 'payment' && (
                                <td className="p-3">₱{recipient.Amount || '0'}</td>
                              )}
                              <td className="p-3">{renderStatusBadge(recipient.Status || '')}</td>
                              <td className="p-3 font-mono text-xs">{recipient.EmailId || '—'}</td>
                              <td className="p-3">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => handleOpenPreview(recipient)}
                                    className="p-1.5 rounded-lg transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                                    title="Preview"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  {canSendForCurrentTemplate && (
                                    <>
                                      <button
                                        onClick={() => handleOpenEditModal(recipient)}
                                        className="p-1.5 rounded-lg transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                                        title="Edit"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                      {!isSent && (
                                        <button
                                          onClick={() => handleSendSingle(rowIndex)}
                                          disabled={isSending}
                                          className="p-1.5 rounded-lg transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                                          title="Send"
                                          style={{ color: DESIGN_TOKENS.colors.brand.orange }}
                                        >
                                          <Send className="w-4 h-4" />
                                        </button>
                                      )}
                                      <button
                                        onClick={() => handleOpenDeleteConfirm(rowIndex)}
                                        className="p-1.5 rounded-lg transition-colors hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                                        title="Delete"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </>
              ) : (
                // Flat View (Original)
                filteredRecipients.map((recipient) => {
                const rowIndex = getRecipientRowKey(recipient);
                const isSelected = selectedRows.has(rowIndex);
                const isSent = recipient.Status?.toLowerCase().startsWith('sent');
                
                return (
                  <tr 
                    key={rowIndex}
                    className="transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                    style={{ 
                      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                      opacity: isSent ? 0.7 : 1,
                    }}
                  >
                    {canSendForCurrentTemplate && (
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(rowIndex)}
                          disabled={isSent}
                          className="w-4 h-4 rounded"
                        />
                      </td>
                    )}
                    <td className="p-3 font-medium">{recipient.RecipientName}</td>
                    <td className="p-3 text-blue-500">{recipient.Email}</td>
                    {isAllTemplates && <td className="p-3 text-xs opacity-70">{recipient.__templateName || 'Unknown'}</td>}
                    <td className="p-3 max-w-xs truncate" title={getRecipientSubject(recipient, recipient.__templateKey || subjectTemplateFallback)}>
                      {getRecipientSubject(recipient, recipient.__templateKey || subjectTemplateFallback)}
                    </td>
                    {currentTemplate.type === 'event' && (
                      <>
                        <td className="p-3">{recipient.Date || '—'}</td>
                        <td className="p-3">{recipient.Time || '—'}</td>
                      </>
                    )}
                    {currentTemplate.type === 'payment' && (
                      <td className="p-3">₱{recipient.Amount || '0'}</td>
                    )}
                    <td className="p-3">{renderStatusBadge(recipient.Status || '')}</td>
                    <td className="p-3 font-mono text-xs">{recipient.EmailId || '—'}</td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenPreview(recipient)}
                          className="p-1.5 rounded-lg transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                          title="Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {canSendForCurrentTemplate && (
                          <>
                            <button
                              onClick={() => handleOpenEditModal(recipient)}
                              className="p-1.5 rounded-lg transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {!isSent && (
                              <button
                                onClick={() => handleSendSingle(rowIndex)}
                                disabled={isSending}
                                className="p-1.5 rounded-lg transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                                title="Send"
                                style={{ color: DESIGN_TOKENS.colors.brand.orange }}
                              >
                                <Send className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenDeleteConfirm(rowIndex)}
                              className="p-1.5 rounded-lg transition-colors hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        // Card View
        <div className="space-y-4">
          {groupBySubject ? (
            // Grouped Card View
            <>
              {/* Expand/Collapse All */}
              <div className="flex items-center justify-between px-2">
                <span className="text-sm font-semibold" style={{ color: DESIGN_TOKENS.colors.brand.orange }}>
                  {groupedRecipients.length} Groups • {filteredRecipients.length} Recipients
                </span>
                <button
                  onClick={toggleAllGroups}
                  className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                  }}
                >
                  {expandedGroups.size === groupedRecipients.length ? 'Collapse All' : 'Expand All'}
                </button>
              </div>
              
              {groupedRecipients.map((group) => {
                const isExpanded = expandedGroups.has(group.subject);
                
                return (
                  <div key={group.subject} className="rounded-xl overflow-hidden border"
                    style={{
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                      background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.5)',
                    }}
                  >
                    {/* Group Header */}
                    <button
                      onClick={() => toggleGroupExpansion(group.subject)}
                      className="w-full p-4 flex items-center gap-3 transition-colors hover:bg-orange-500/5"
                      style={{ background: isDark ? 'rgba(249,115,22,0.08)' : 'rgba(249,115,22,0.05)' }}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 shrink-0" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
                      ) : (
                        <ChevronRight className="w-5 h-5 shrink-0" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
                      )}
                      <div className="flex-1 min-w-0 text-left">
                        <div className="font-semibold truncate">{group.subject}</div>
                        <div className="text-xs opacity-60 mt-0.5">
                          {group.totalCount} recipient{group.totalCount !== 1 ? 's' : ''} • {group.sentCount} sent
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span 
                          className="text-xs px-2 py-1 rounded-full"
                          style={{ 
                            background: group.sentCount === group.totalCount 
                              ? isDark ? 'rgba(34,197,94,0.2)' : 'rgba(34,197,94,0.1)'
                              : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                            color: group.sentCount === group.totalCount ? '#22c55e' : 'inherit'
                          }}
                        >
                          {group.sentCount}/{group.totalCount}
                        </span>
                        {group.sentCount === group.totalCount && (
                          <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                        )}
                      </div>
                    </button>
                    
                    {/* Group Cards */}
                    {isExpanded && (
                      <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3"
                        style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.8)' }}
                      >
                        {group.recipients.map((recipient) => {
                          const rowIndex = getRecipientRowKey(recipient);
                          const isSelected = selectedRows.has(rowIndex);
                          const isSent = recipient.Status?.toLowerCase().startsWith('sent');
                          
                          return (
                            <div
                              key={rowIndex}
                              className="p-3 rounded-lg border transition-all"
                              style={{
                                borderColor: isSelected ? DESIGN_TOKENS.colors.brand.orange : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                                background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                                opacity: isSent ? 0.7 : 1,
                              }}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  {canSendForCurrentTemplate && (
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => handleSelectRow(rowIndex)}
                                      disabled={isSent}
                                      className="w-4 h-4 rounded"
                                    />
                                  )}
                                  <div>
                                    <p className="font-medium text-sm">{recipient.RecipientName}</p>
                                    <p className="text-xs text-blue-500">{recipient.Email}</p>
                                    {isAllTemplates && (
                                      <p className="text-[11px] opacity-60">{recipient.__templateName || 'Unknown'}</p>
                                    )}
                                  </div>
                                </div>
                                {renderStatusBadge(recipient.Status || '')}
                              </div>
                              
                              <div className="flex items-center justify-end gap-1 pt-2 border-t"
                                style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }}
                              >
                                <button onClick={() => handleOpenPreview(recipient)} className="p-1.5 rounded transition-colors hover:bg-black/10 dark:hover:bg-white/10">
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                {canSendForCurrentTemplate && (
                                  <>
                                    <button onClick={() => handleOpenEditModal(recipient)} className="p-1.5 rounded transition-colors hover:bg-black/10 dark:hover:bg-white/10">
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    {!isSent && (
                                      <button onClick={() => handleSendSingle(rowIndex)} disabled={isSending} className="p-1.5 rounded transition-colors hover:bg-black/10 dark:hover:bg-white/10" style={{ color: DESIGN_TOKENS.colors.brand.orange }}>
                                        <Send className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    <button onClick={() => handleOpenDeleteConfirm(rowIndex)} className="p-1.5 rounded transition-colors hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          ) : (
            // Flat Card View
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredRecipients.map((recipient) => {
                const rowIndex = getRecipientRowKey(recipient);
                const isSelected = selectedRows.has(rowIndex);
                const isSent = recipient.Status?.toLowerCase().startsWith('sent');
                
                return (
                  <div
                    key={rowIndex}
                    className="p-4 rounded-xl border transition-all"
                    style={{
                      borderColor: isSelected ? DESIGN_TOKENS.colors.brand.orange : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                      background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
                      opacity: isSent ? 0.7 : 1,
                    }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {canSendForCurrentTemplate && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleSelectRow(rowIndex)}
                            disabled={isSent}
                            className="w-4 h-4 rounded"
                          />
                        )}
                        <div>
                          <p className="font-semibold">{recipient.RecipientName}</p>
                          <p className="text-sm text-blue-500">{recipient.Email}</p>
                          {isAllTemplates && (
                            <p className="text-[11px] opacity-60">{recipient.__templateName || 'Unknown'}</p>
                          )}
                        </div>
                      </div>
                      {renderStatusBadge(recipient.Status || '')}
                    </div>
                    
                    <p className="text-sm mb-3 line-clamp-2" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                      {getRecipientSubject(recipient, recipient.__templateKey || subjectTemplateFallback)}
                    </p>
                    
                    {currentTemplate.type === 'event' && (recipient.Date || recipient.Time) && (
                      <div className="flex items-center gap-4 text-sm mb-3">
                        {recipient.Date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {recipient.Date}
                          </span>
                        )}
                        {recipient.Time && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {recipient.Time}
                          </span>
                        )}
                      </div>
                    )}
                    
                    {recipient.EmailId && (
                      <p className="text-xs font-mono opacity-50 mb-3">ID: {recipient.EmailId}</p>
                    )}
                    
                    <div className="flex items-center justify-end gap-1 pt-2 border-t"
                      style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}
                    >
                      <button
                        onClick={() => handleOpenPreview(recipient)}
                        className="p-2 rounded-lg transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {canSendForCurrentTemplate && (
                        <>
                          <button
                            onClick={() => handleOpenEditModal(recipient)}
                            className="p-2 rounded-lg transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {!isSent && (
                            <button
                              onClick={() => handleSendSingle(rowIndex)}
                              disabled={isSending}
                              className="p-2 rounded-lg transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                              style={{ color: DESIGN_TOKENS.colors.brand.orange }}
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenDeleteConfirm(rowIndex)}
                            className="p-2 rounded-lg transition-colors hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div 
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl scrollbar-thin"
            style={{
              background: isDark ? '#1e1e1e' : '#ffffff',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              scrollbarWidth: 'thin',
              scrollbarColor: isDark ? 'rgba(255,255,255,0.2) transparent' : 'rgba(0,0,0,0.2) transparent',
            }}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b"
              style={{ 
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                background: isDark ? 'rgba(30,30,30,0.95)' : 'rgba(255,255,255,0.95)',
              }}
            >
              <h2 className="text-xl font-bold">
                {showCreateModal ? 'Add Recipient' : 'Edit Recipient'}
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setPendingBatchRecipients([]);
                  setPendingBatchSource('');
                  setShowQueuedRecipients(true);
                  setShowAllQueuedRecipients(false);
                  setShowEditModal(false);
                  setEditingRecipient(null);
                }}
                className="p-2 rounded-lg transition-colors hover:bg-black/10 dark:hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Command Palette Recipient Search - Only show for Create Modal (like Issuance Center) */}
              {showCreateModal && (
                <div ref={recipientSearchRef}>
                  <label className="block text-sm font-semibold mb-2" style={{ color: DESIGN_TOKENS.colors.brand.orange }}>
                    Select Recipient *
                  </label>
                  
                  {/* Universal Search Bar with Command Palette */}
                  <div className="relative">
                    <div className="relative">
                      {/* Command icon indicator inside input */}
                      {activeCommand && (() => {
                        const cmd = SEARCH_COMMANDS.find(c => c.command === activeCommand);
                        return cmd ? (
                          <cmd.icon 
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" 
                            style={{ color: cmd.color }} 
                          />
                        ) : null;
                      })()}
                      {!activeCommand && (
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      )}
                      <input
                        type="text"
                        value={activeCommand ? commandSearchQuery : recipientSearchQuery}
                        onChange={(e) => handleUniversalSearchInput(e.target.value)}
                        onFocus={() => setShowRecipientDropdown(true)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            // If showing commands, select first command
                            if (!activeCommand && universalSearchSuggestions.length > 0 && recipientSearchQuery.startsWith('@')) {
                              const firstCmd = universalSearchSuggestions[0] as typeof SEARCH_COMMANDS[number];
                              if (firstCmd.command) {
                                handleSelectCommand(firstCmd.command);
                              }
                            }
                            // Direct typing mode: pick first matching member
                            else if (!activeCommand && universalSearchSuggestions.length > 0 && recipientSearchQuery.trim() && !recipientSearchQuery.startsWith('@')) {
                              handleSelectSuggestion(universalSearchSuggestions[0] as DirectoryMember);
                            }
                            // If @Person and has suggestions, select first person
                            else if (activeCommand === '@Person' && universalSearchSuggestions.length > 0) {
                              handleSelectSuggestion(universalSearchSuggestions[0] as DirectoryMember);
                            }
                            // If @External, add external recipient
                            else if (activeCommand === '@External' && externalName.trim() && externalEmail.trim()) {
                              handleAddExternalRecipient();
                            }
                          }
                          if (e.key === 'Escape') {
                            if (activeCommand) {
                              handleClearCommand();
                            } else {
                              setShowRecipientDropdown(false);
                            }
                          }
                          if (e.key === 'Backspace' && activeCommand && !commandSearchQuery) {
                            handleClearCommand();
                          }
                        }}
                        placeholder={
                          activeCommand === '@Person' ? 'Search by name, email, or committee...' :
                          activeCommand === '@External' ? 'Fill in the form below' :
                          'Type @ to see commands'
                        }
                        className="w-full py-3 pl-12 pr-4 rounded-xl border-2 transition-all focus:outline-none"
                        style={{
                          background: activeCommand 
                            ? (isDark ? `${SEARCH_COMMANDS.find(c => c.command === activeCommand)?.color}15` : `${SEARCH_COMMANDS.find(c => c.command === activeCommand)?.color}08`)
                            : (isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)'),
                          borderColor: activeCommand
                            ? `${SEARCH_COMMANDS.find(c => c.command === activeCommand)?.color}50`
                            : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'),
                          color: isDark ? '#fff' : '#000',
                        }}
                      />
                      {/* Clear command button */}
                      {activeCommand && (
                        <button
                          onClick={handleClearCommand}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10"
                        >
                          <X className="w-4 h-4 text-gray-400" />
                        </button>
                      )}
                    </div>
                    
                    {/* Dropdown Suggestions */}
                    {showRecipientDropdown && (
                      <div
                        className="absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-xl max-h-64 overflow-y-auto"
                        style={{
                          background: isDark ? 'rgba(17, 24, 39, 0.98)' : 'rgba(255, 255, 255, 0.98)',
                          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                          zIndex: 9999999,
                        }}
                      >
                        {/* Command Suggestions */}
                        {!activeCommand && recipientSearchQuery.startsWith('@') && universalSearchSuggestions.length > 0 && (
                          <>
                            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                              Commands
                            </div>
                            {(universalSearchSuggestions as typeof SEARCH_COMMANDS).map((cmd) => (
                              <button
                                key={cmd.command}
                                onClick={() => handleSelectCommand(cmd.command)}
                                className="w-full p-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
                              >
                                <div
                                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                                  style={{ background: cmd.color + '20' }}
                                >
                                  <cmd.icon className="w-4 h-4" style={{ color: cmd.color }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold" style={{ color: cmd.color }}>
                                    {cmd.command}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {cmd.label}
                                  </p>
                                </div>
                              </button>
                            ))}
                          </>
                        )}
                        
                        {/* Show hint when no @ typed */}
                        {!activeCommand && !recipientSearchQuery.startsWith('@') && !recipientSearchQuery && (
                          <div className="p-4 text-center">
                            <p className="text-sm text-muted-foreground mb-3">
                              Type <span className="font-mono text-[#f6421f]">@</span> to see available commands
                            </p>
                            <div className="flex flex-wrap justify-center gap-2">
                              {SEARCH_COMMANDS.map((cmd) => (
                                <button
                                  key={cmd.command}
                                  onClick={() => handleSelectCommand(cmd.command)}
                                  className="px-2 py-1 rounded-md text-xs font-medium transition-all hover:scale-105"
                                  style={{
                                    background: cmd.color + '15',
                                    color: cmd.color,
                                    border: `1px solid ${cmd.color}30`,
                                  }}
                                >
                                  {cmd.command}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Direct Member Search (no @ command required) */}
                        {!activeCommand && recipientSearchQuery.trim() && !recipientSearchQuery.startsWith('@') && universalSearchSuggestions.length > 0 && (
                          <>
                            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                              Members ({directoryMembers.length} total)
                            </div>
                            {(universalSearchSuggestions as DirectoryMember[]).map((member, idx) => (
                              <button
                                key={`${member.email}-${idx}`}
                                onClick={() => handleSelectSuggestion(member)}
                                className="w-full p-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
                              >
                                <div className="relative w-8 h-8 shrink-0">
                                  {member.profilePicture ? (
                                    <>
                                      <img
                                        src={member.profilePicture}
                                        alt={member.name}
                                        className="w-8 h-8 rounded-full object-cover absolute inset-0"
                                        onError={(e) => {
                                          const target = e.target as HTMLImageElement;
                                          target.style.display = 'none';
                                        }}
                                      />
                                      <div
                                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                        style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }}
                                      >
                                        {getInitials(member.name)}
                                      </div>
                                    </>
                                  ) : (
                                    <div
                                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                      style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }}
                                    >
                                      {getInitials(member.name)}
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate" style={{ color: isDark ? '#fff' : '#000' }}>
                                    {member.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {member.email}
                                  </p>
                                </div>
                                {member.committee && (
                                  <span className="text-xs px-2 py-1 rounded-full" style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                                    {member.committee}
                                  </span>
                                )}
                              </button>
                            ))}
                          </>
                        )}

                        {!activeCommand && recipientSearchQuery.trim() && !recipientSearchQuery.startsWith('@') && universalSearchSuggestions.length === 0 && (
                          <div className="p-4 text-center text-muted-foreground text-sm">
                            No members found matching "{recipientSearchQuery}"
                          </div>
                        )}
                        
                        {/* Person Suggestions - Loading State */}
                        {activeCommand === '@Person' && isLoadingDirectory && (
                          <div className="p-6 text-center">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" style={{ color: '#3b82f6' }} />
                            <p className="text-sm text-muted-foreground">Loading members...</p>
                          </div>
                        )}
                        
                        {/* Person Suggestions - Empty State */}
                        {activeCommand === '@Person' && !isLoadingDirectory && directoryMembers.length === 0 && (
                          <div className="p-4 text-center">
                            <p className="text-sm text-muted-foreground mb-2">No members loaded yet.</p>
                            <button
                              onClick={() => loadDirectoryMembers(true)}
                              className="text-sm px-3 py-1.5 rounded-md transition-colors"
                              style={{ 
                                background: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
                                color: '#3b82f6'
                              }}
                            >
                              Load Members
                            </button>
                          </div>
                        )}
                        
                        {/* Person Suggestions - Results */}
                        {activeCommand === '@Person' && !isLoadingDirectory && universalSearchSuggestions.length > 0 && (
                          <>
                            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                              Members ({directoryMembers.length} total)
                            </div>
                            {(universalSearchSuggestions as DirectoryMember[]).map((member, idx) => (
                              <button
                                key={idx}
                                onClick={() => handleSelectSuggestion(member)}
                                className="w-full p-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
                              >
                                <div className="relative w-8 h-8 shrink-0">
                                  {member.profilePicture ? (
                                    <>
                                      <img
                                        src={member.profilePicture}
                                        alt={member.name}
                                        className="w-8 h-8 rounded-full object-cover absolute inset-0"
                                        onError={(e) => {
                                          const target = e.target as HTMLImageElement;
                                          target.style.display = 'none';
                                        }}
                                      />
                                      <div
                                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                        style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }}
                                      >
                                        {getInitials(member.name)}
                                      </div>
                                    </>
                                  ) : (
                                    <div
                                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                      style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }}
                                    >
                                      {getInitials(member.name)}
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate" style={{ color: isDark ? '#fff' : '#000' }}>
                                    {member.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {member.email}
                                  </p>
                                </div>
                                {member.committee && (
                                  <span className="text-xs px-2 py-1 rounded-full" style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                                    {member.committee}
                                  </span>
                                )}
                                {pendingBatchRecipients.some(r => r.Email.toLowerCase() === member.email.toLowerCase()) && (
                                  <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                                )}
                              </button>
                            ))}
                          </>
                        )}
                        
                        {/* Person Suggestions - No results */}
                        {activeCommand === '@Person' && !isLoadingDirectory && directoryMembers.length > 0 && commandSearchQuery && universalSearchSuggestions.length === 0 && (
                          <div className="p-4 text-center text-muted-foreground text-sm">
                            No members found matching "{commandSearchQuery}"
                          </div>
                        )}
                        
                        {/* Event Suggestions - Loading State */}
                        {activeCommand === '@Event' && isLoadingEvents && (
                          <div className="p-6 text-center">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" style={{ color: '#8b5cf6' }} />
                            <p className="text-sm text-muted-foreground">Loading events...</p>
                          </div>
                        )}
                        
                        {/* Event Suggestions - Empty State */}
                        {activeCommand === '@Event' && !isLoadingEvents && events.length === 0 && (
                          <div className="p-4 text-center">
                            <p className="text-sm text-muted-foreground mb-2">No events found.</p>
                            <button
                              onClick={() => loadEvents(true)}
                              className="text-sm px-3 py-1.5 rounded-md transition-colors"
                              style={{ 
                                background: isDark ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.1)',
                                color: '#8b5cf6'
                              }}
                            >
                              Refresh Events
                            </button>
                          </div>
                        )}
                        
                        {/* Event Suggestions - Results */}
                        {activeCommand === '@Event' && !isLoadingEvents && universalSearchSuggestions.length > 0 && (
                          <>
                            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                              Events - Click to load attendees
                            </div>
                            {(universalSearchSuggestions as EventData[]).map((event) => (
                              <button
                                key={event.EventID}
                                onClick={() => handleSelectEvent(event)}
                                className="w-full p-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
                              >
                                <div
                                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                                  style={{ background: '#8b5cf620' }}
                                >
                                  <Calendar className="w-4 h-4" style={{ color: '#8b5cf6' }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate" style={{ color: isDark ? '#fff' : '#000' }}>
                                    {event.Title}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {event.StartDate} • {event.Status}
                                  </p>
                                </div>
                                <span 
                                  className="text-xs px-2 py-1 rounded-full"
                                  style={{ 
                                    background: event.Status === 'Active' ? '#10b98120' : '#6b728020',
                                    color: event.Status === 'Active' ? '#10b981' : '#6b7280',
                                  }}
                                >
                                  {event.Status}
                                </span>
                              </button>
                            ))}
                          </>
                        )}
                        
                        {/* Event Suggestions - No results */}
                        {activeCommand === '@Event' && !isLoadingEvents && events.length > 0 && commandSearchQuery && universalSearchSuggestions.length === 0 && (
                          <div className="p-4 text-center text-muted-foreground text-sm">
                            No events found matching "{commandSearchQuery}"
                          </div>
                        )}
                        
                        {/* Committee Suggestions */}
                        {activeCommand === '@Committee' && isLoadingDirectory && (
                          <div className="p-6 text-center">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" style={{ color: '#10b981' }} />
                            <p className="text-sm text-muted-foreground">Loading committees...</p>
                          </div>
                        )}
                        
                        {activeCommand === '@Committee' && !isLoadingDirectory && universalSearchSuggestions.length > 0 && (
                          <>
                            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                              Committees - Click to select first member
                            </div>
                            {(universalSearchSuggestions as Array<{id: string; name: string}>).map((committee) => (
                              <button
                                key={committee.id}
                                onClick={() => handleSelectCommittee(committee.name)}
                                className="w-full p-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
                              >
                                <div
                                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                                  style={{ background: '#10b98120' }}
                                >
                                  <Building className="w-4 h-4" style={{ color: '#10b981' }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate" style={{ color: isDark ? '#fff' : '#000' }}>
                                    {committee.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {directoryMembers.filter(m => (m.committee || '').toLowerCase() === committee.name.toLowerCase()).length} members
                                  </p>
                                </div>
                              </button>
                            ))}
                          </>
                        )}
                        
                        {activeCommand === '@Committee' && !isLoadingDirectory && commandSearchQuery && universalSearchSuggestions.length === 0 && (
                          <div className="p-4 text-center text-muted-foreground text-sm">
                            No committees found matching "{commandSearchQuery}"
                          </div>
                        )}
                        
                        {/* External Input Form */}
                        {activeCommand === '@External' && (
                          <div className="p-4 space-y-3">
                            <div className="text-xs font-semibold text-muted-foreground mb-2">
                              Add External Recipient
                            </div>
                            <input
                              type="text"
                              value={externalName}
                              onChange={(e) => setExternalName(e.target.value)}
                              placeholder="Full Name"
                              className="w-full p-2.5 rounded-lg border transition-all focus:outline-none focus:border-[#ec4899]"
                              style={{
                                background: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                                borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
                                color: isDark ? '#fff' : '#000',
                              }}
                            />
                            <input
                              type="email"
                              value={externalEmail}
                              onChange={(e) => setExternalEmail(e.target.value)}
                              placeholder="email@example.com"
                              className="w-full p-2.5 rounded-lg border transition-all focus:outline-none focus:border-[#ec4899]"
                              style={{
                                background: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                                borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
                                color: isDark ? '#fff' : '#000',
                              }}
                            />
                            <Button
                              variant="secondary"
                              onClick={handleAddExternalRecipient}
                              icon={<Check className="w-4 h-4" />}
                              fullWidth
                              disabled={!externalName.trim() || !externalEmail.trim()}
                            >
                              Select External Recipient
                            </Button>
                          </div>
                        )}
                        
                        {/* Quick Switch Commands */}
                        {activeCommand && activeCommand !== '@External' && (
                          <div 
                            className="border-t px-3 py-2"
                            style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-muted-foreground">
                                Switch to:
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {SEARCH_COMMANDS.filter(c => c.command !== activeCommand).map((cmd) => (
                                <button
                                  key={cmd.command}
                                  onClick={() => handleSelectCommand(cmd.command)}
                                  className="px-2 py-1 rounded-md text-xs font-medium transition-all hover:scale-105 flex items-center gap-1"
                                  style={{
                                    background: cmd.color + '15',
                                    color: cmd.color,
                                    border: `1px solid ${cmd.color}30`,
                                  }}
                                >
                                  <cmd.icon className="w-3 h-3" />
                                  {cmd.command.replace('@', '')}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {showCreateModal && pendingBatchRecipients.length > 0 && (
                <div
                  className="rounded-xl p-3 text-sm"
                  style={{
                    background: isDark ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.08)',
                    border: `1px solid ${isDark ? 'rgba(34,197,94,0.35)' : 'rgba(34,197,94,0.25)'}`,
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setShowQueuedRecipients(!showQueuedRecipients)}
                      className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
                    >
                      <span className="font-semibold truncate">Queued Recipients: {pendingBatchRecipients.length}</span>
                      {showQueuedRecipients ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                    </button>
                    <div className="flex items-center gap-2">
                      {pendingBatchRecipients.length > 8 && (
                        <button
                          type="button"
                          onClick={() => setShowAllQueuedRecipients(!showAllQueuedRecipients)}
                          className="text-xs font-medium text-blue-500 hover:text-blue-600"
                        >
                          {showAllQueuedRecipients ? 'Show less' : `Show all ${pendingBatchRecipients.length}`}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleClearQueuedRecipients}
                        className="text-xs font-medium text-red-500 hover:text-red-600"
                      >
                        Clear all
                      </button>
                    </div>
                  </div>
                  {pendingBatchSource && <p className="opacity-80 mt-1">Source: {pendingBatchSource}</p>}
                  <p className="opacity-70 mt-1">Nothing is saved yet. Press Add to save these recipients.</p>

                  {showQueuedRecipients && (
                    <div className="mt-3 space-y-2 max-h-52 overflow-y-auto pr-1">
                      {queuedGroups.map((group) => {
                        const sourceStyle = getQueueSourceStyle(group.sourceType);
                        const recipientsToShow = showAllQueuedRecipients ? group.recipients : group.recipients.slice(0, 8);
                        return (
                          <div
                            key={`${group.sourceType}-${group.sourceLabel}`}
                            className="rounded-lg border p-2"
                            style={{ borderColor: sourceStyle.border, background: sourceStyle.bg }}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold" style={{ color: sourceStyle.text }}>
                                {group.sourceLabel}
                              </span>
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: sourceStyle.border, color: sourceStyle.text }}>
                                {group.recipients.length}
                              </span>
                            </div>
                            <div className="space-y-1">
                              {recipientsToShow.map((recipient) => (
                                <div key={recipient.queueId} className="text-xs flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="truncate font-medium">{recipient.RecipientName}</p>
                                    <p className="truncate opacity-75">{recipient.Email}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveQueuedRecipient(recipient.queueId)}
                                    className="p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 shrink-0"
                                    title="Remove from queue"
                                  >
                                    <X className="w-3.5 h-3.5 text-red-500" />
                                  </button>
                                </div>
                              ))}
                              {!showAllQueuedRecipients && group.recipients.length > 8 && (
                                <button
                                  type="button"
                                  className="text-[11px] font-medium text-blue-500 hover:text-blue-600"
                                  onClick={() => setShowAllQueuedRecipients(true)}
                                >
                                  +{group.recipients.length - 8} more
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Edit Mode - Regular Inputs */}
              {showEditModal && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Recipient Name *</label>
                    <input
                      type="text"
                      value={formData.RecipientName || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, RecipientName: e.target.value }))}
                      placeholder="Enter recipient name"
                      className="w-full px-4 py-2.5 rounded-xl border transition-colors focus:outline-none focus:ring-2"
                      style={{
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Email Address *</label>
                    <input
                      type="email"
                      value={formData.Email || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, Email: e.target.value }))}
                      placeholder="email@example.com"
                      className="w-full px-4 py-2.5 rounded-xl border transition-colors focus:outline-none focus:ring-2"
                      style={{
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
                      }}
                    />
                  </div>
                </>
              )}

              {/* Headline/Subject */}
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  {currentTemplate.type === 'event' ? 'Event Name / Subject' : 
                   currentTemplate.type === 'appointment' ? 'New Position' :
                   currentTemplate.type === 'payment' ? 'Payment For' : 'Subject'} *
                </label>
                <input
                  type="text"
                  value={formData.Headline || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, Headline: e.target.value }))}
                  placeholder={
                    currentTemplate.type === 'appointment' ? 'e.g., Vice President, Committee Head' :
                    currentTemplate.type === 'payment' ? 'e.g., Membership Fee, Event Registration' :
                    'Enter subject or event name'
                  }
                  className="w-full px-4 py-2.5 rounded-xl border transition-colors focus:outline-none focus:ring-2"
                  style={{
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
                  }}
                />
              </div>

              {/* Message - Rich Text */}
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Message * 
                  <span className="text-xs opacity-60 ml-2">(Supports line breaks and formatting)</span>
                </label>
                <textarea
                  value={formData.Message || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, Message: e.target.value }))}
                  placeholder="Enter your message content. Use line breaks for paragraph formatting."
                  rows={5}
                  className="w-full px-4 py-2.5 rounded-xl border transition-colors focus:outline-none focus:ring-2 resize-none"
                  style={{
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
                    textAlign: 'justify',
                  }}
                />
              </div>

              {/* Event-specific fields */}
              {currentTemplate.type === 'event' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Date</label>
                    <input
                      type="text"
                      value={formData.Date || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, Date: e.target.value }))}
                      placeholder="e.g., Jan 30, 2026"
                      className="w-full px-4 py-2.5 rounded-xl border transition-colors focus:outline-none focus:ring-2"
                      style={{
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Time</label>
                    <input
                      type="text"
                      value={formData.Time || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, Time: e.target.value }))}
                      placeholder="e.g., 2:00 PM"
                      className="w-full px-4 py-2.5 rounded-xl border transition-colors focus:outline-none focus:ring-2"
                      style={{
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
                      }}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1.5">Venue / Location</label>
                    <input
                      type="text"
                      value={formData.Venue || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, Venue: e.target.value }))}
                      placeholder="Enter venue or meeting link"
                      className="w-full px-4 py-2.5 rounded-xl border transition-colors focus:outline-none focus:ring-2"
                      style={{
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Payment-specific fields */}
              {currentTemplate.type === 'payment' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Amount Due (P)</label>
                    <input
                      type="text"
                      value={formData.Amount || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, Amount: e.target.value }))}
                      placeholder="e.g., 500"
                      className="w-full px-4 py-2.5 rounded-xl border transition-colors focus:outline-none focus:ring-2"
                      style={{
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Due Date</label>
                    <input
                      type="text"
                      value={formData.Date || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, Date: e.target.value }))}
                      placeholder="e.g., Feb 15, 2026"
                      className="w-full px-4 py-2.5 rounded-xl border transition-colors focus:outline-none focus:ring-2"
                      style={{
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Appointment-specific fields (Position Designations) */}
              {currentTemplate.type === 'appointment' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Old Position</label>
                    <input
                      type="text"
                      value={formData.OldPosition || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, OldPosition: e.target.value }))}
                      placeholder="e.g., Member, Committee Head"
                      className="w-full px-4 py-2.5 rounded-xl border transition-colors focus:outline-none focus:ring-2"
                      style={{
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Effective Date</label>
                    <input
                      type="text"
                      value={formData.Date || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, Date: e.target.value }))}
                      placeholder="e.g., Mar 15, 2026"
                      className="w-full px-4 py-2.5 rounded-xl border transition-colors focus:outline-none focus:ring-2"
                      style={{
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
                      }}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1.5">Department / Committee</label>
                    <input
                      type="text"
                      value={formData.Venue || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, Venue: e.target.value }))}
                      placeholder="e.g., Membership Affairs, Events Committee"
                      className="w-full px-4 py-2.5 rounded-xl border transition-colors focus:outline-none focus:ring-2"
                      style={{
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Deadline field for simple templates with deadline (Membership_Renewal, Doc_Acknowledgment) */}
              {currentTemplate.hasDeadline && (
                <div>
                  <label className="block text-sm font-medium mb-1.5">Deadline</label>
                  <input
                    type="text"
                    value={formData.Date || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, Date: e.target.value }))}
                    placeholder="e.g., Mar 31, 2026"
                    className="w-full px-4 py-2.5 rounded-xl border transition-colors focus:outline-none focus:ring-2"
                    style={{
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                      background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
                    }}
                  />
                </div>
              )}

              {/* Link */}
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  {currentTemplate.type === 'event' ? 'RSVP / Confirm Link' : 'Action Link'}
                </label>
                <input
                  type="url"
                  value={formData.Link || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, Link: e.target.value }))}
                  placeholder="https://..."
                  className="w-full px-4 py-2.5 rounded-xl border transition-colors focus:outline-none focus:ring-2"
                  style={{
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
                  }}
                />
              </div>

              {selectedTemplate === 'Event_Invites' && (
                <div>
                  <label className="block text-sm font-medium mb-1.5">Registration Link</label>
                  <input
                    type="url"
                    value={formData.RegistrationLink || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, RegistrationLink: e.target.value }))}
                    placeholder="https://..."
                    className="w-full px-4 py-2.5 rounded-xl border transition-colors focus:outline-none focus:ring-2"
                    style={{
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                      background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
                    }}
                  />
                </div>
              )}

              {/* Attachments */}
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Attachments 
                  <span className="text-xs opacity-60 ml-2">(Comma-separated Google Drive links)</span>
                </label>
                <input
                  type="text"
                  value={formData.Attachments || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, Attachments: e.target.value }))}
                  placeholder="https://drive.google.com/..."
                  className="w-full px-4 py-2.5 rounded-xl border transition-colors focus:outline-none focus:ring-2"
                  style={{
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
                  }}
                />
              </div>

            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 flex items-center justify-end gap-3 p-5 border-t"
              style={{ 
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                background: isDark ? 'rgba(30,30,30,0.95)' : 'rgba(255,255,255,0.95)',
              }}
            >
              <Button
                variant="secondary"
                onClick={() => {
                  setShowCreateModal(false);
                  setPendingBatchRecipients([]);
                  setPendingBatchSource('');
                  setShowQueuedRecipients(true);
                  setShowAllQueuedRecipients(false);
                  setShowEditModal(false);
                  setEditingRecipient(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={showCreateModal ? handleCreateRecipient : handleUpdateRecipient}
                disabled={
                  showCreateModal
                    ? (pendingBatchRecipients.length === 0 && (!formData.RecipientName || !formData.Email || !formData.Headline || !formData.Message))
                    : (!formData.RecipientName || !formData.Email || !formData.Headline || !formData.Message)
                }
              >
                {showCreateModal ? 'Add' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmModal && deletingRowIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div 
            className="w-full max-w-md rounded-2xl shadow-2xl p-6"
            style={{
              background: isDark ? '#1e1e1e' : '#ffffff',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Delete Recipient?</h3>
                <p className="text-sm opacity-60">This action cannot be undone.</p>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 mt-6">
              <Button variant="secondary" onClick={() => setShowDeleteConfirmModal(false)}>
                Cancel
              </Button>
              <Button 
                variant="primary" 
                onClick={handleDeleteRecipient}
                style={{ background: '#ef4444' }}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && previewingRecipient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div 
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
            style={{
              background: isDark ? '#1e1e1e' : '#ffffff',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              scrollbarWidth: 'thin',
              scrollbarColor: isDark ? 'rgba(255,255,255,0.2) transparent' : 'rgba(0,0,0,0.2) transparent',
            }}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b"
              style={{ 
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                background: isDark ? 'rgba(30,30,30,0.95)' : 'rgba(255,255,255,0.95)',
              }}
            >
              <h2 className="text-xl font-bold">Email Preview</h2>
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  setPreviewingRecipient(null);
                }}
                className="p-2 rounded-lg transition-colors hover:bg-black/10 dark:hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5">
              {/* Email Header Preview */}
              <div className="mb-6 p-4 rounded-xl"
                style={{ 
                  background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`
                }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <Mail className="w-5 h-5" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
                  <span className="text-sm font-medium">{orgConfig.fullName}</span>
                </div>
                <div className="space-y-1 text-sm">
                  <p><span className="opacity-60">To:</span> {previewingRecipient.Email}</p>
                  <p><span className="opacity-60">Subject:</span> [YSP] {getRecipientSubject(previewingRecipient, (previewingRecipient as EmailRecipientRow).__templateKey || subjectTemplateFallback)} - {previewingRecipient.RecipientName}</p>
                </div>
              </div>

              {/* Email Body Preview */}
              <div className="space-y-4">
                <div>
                  <p className="text-sm opacity-60 mb-1">Recipient:</p>
                  <p className="font-semibold">{previewingRecipient.RecipientName}</p>
                </div>
                
                <div>
                  <p className="text-sm opacity-60 mb-1">Message:</p>
                  <div className="p-4 rounded-xl" style={{ 
                    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                    textAlign: 'justify',
                  }}>
                    <FormattedText text={previewingRecipient.Message || ''} />
                  </div>
                </div>

                {currentTemplate.type === 'event' && (
                  <div className="grid grid-cols-3 gap-4 p-4 rounded-xl"
                    style={{ 
                      background: '#FFF8F5',
                      borderLeft: `4px solid ${DESIGN_TOKENS.colors.brand.orange}`,
                    }}
                  >
                    {previewingRecipient.Date && (
                      <div>
                        <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide mb-1" style={{ color: DESIGN_TOKENS.colors.brand.orange }}>
                          <Calendar className="w-3.5 h-3.5" /> Date
                        </p>
                        <p className="font-semibold">{previewingRecipient.Date}</p>
                      </div>
                    )}
                    {previewingRecipient.Time && (
                      <div>
                        <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide mb-1" style={{ color: DESIGN_TOKENS.colors.brand.orange }}>
                          <Clock className="w-3.5 h-3.5" /> Time
                        </p>
                        <p className="font-semibold">{previewingRecipient.Time}</p>
                      </div>
                    )}
                    {previewingRecipient.Venue && (
                      <div>
                        <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide mb-1" style={{ color: DESIGN_TOKENS.colors.brand.orange }}>
                          <MapPin className="w-3.5 h-3.5" /> Venue
                        </p>
                        <p className="font-semibold">{previewingRecipient.Venue}</p>
                      </div>
                    )}
                  </div>
                )}

                {currentTemplate.type === 'payment' && previewingRecipient.Amount && (
                  <div className="p-4 rounded-xl text-center"
                    style={{ 
                      background: 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)',
                      borderLeft: `4px solid #EA580C`,
                    }}
                  >
                    <p className="text-xs uppercase tracking-wide mb-2" style={{ color: '#9A3412' }}>Amount Due</p>
                    <p className="text-3xl font-bold" style={{ color: '#7C2D12' }}>₱{previewingRecipient.Amount}</p>
                    {previewingRecipient.Date && (
                      <p className="text-sm mt-2" style={{ color: '#9A3412' }}>
                        Due by: <strong>{previewingRecipient.Date}</strong>
                      </p>
                    )}
                  </div>
                )}

                {/* CTA Button Preview */}
                <div className="text-center pt-4">
                  {previewActionLink ? (
                    <a
                      href={previewActionLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block px-8 py-3 rounded-xl font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                      style={{
                        background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.orange} 0%, #f6421f 100%)`,
                        boxShadow: '0 4px 16px rgba(242, 101, 34, 0.3)',
                      }}
                      title={previewActionLink}
                    >
                      {currentTemplate.buttonText}
                    </a>
                  ) : (
                    <div
                      className="inline-block px-8 py-3 rounded-xl font-semibold opacity-60 cursor-not-allowed"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                        color: isDark ? '#d1d5db' : '#6b7280',
                      }}
                      title="No action link provided for this recipient"
                    >
                      {currentTemplate.buttonText}
                    </div>
                  )}
                </div>

                {previewingRecipient.EmailId && (
                  <div className="text-center pt-4 border-t" 
                    style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}
                  >
                    <p className="text-xs opacity-50">Reference: {previewingRecipient.EmailId}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Logs Modal */}
      {showLogsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div 
            className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
            style={{
              background: isDark ? '#1e1e1e' : '#ffffff',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              scrollbarWidth: 'thin',
              scrollbarColor: isDark ? 'rgba(255,255,255,0.2) transparent' : 'rgba(0,0,0,0.2) transparent',
            }}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b"
              style={{ 
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                background: isDark ? 'rgba(30,30,30,0.95)' : 'rgba(255,255,255,0.95)',
              }}
            >
              <h2 className="text-xl font-bold">Email Logs - {currentTemplate.name}</h2>
              <button
                onClick={() => setShowLogsModal(false)}
                className="p-2 rounded-lg transition-colors hover:bg-black/10 dark:hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5">
              {isLoadingLogs ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-8 h-8 animate-spin" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
                </div>
              ) : emailLogs.length === 0 ? (
                <p className="text-center py-10 opacity-60">No logs found</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }}>
                        <th className="p-3 text-left font-semibold">Email ID</th>
                        <th className="p-3 text-left font-semibold">Name</th>
                        <th className="p-3 text-left font-semibold">Email</th>
                        <th className="p-3 text-left font-semibold">Headline</th>
                        <th className="p-3 text-left font-semibold">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {emailLogs.map((log, idx) => (
                        <tr 
                          key={idx}
                          style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}
                        >
                          <td className="p-3 font-mono text-xs">{log.EmailId}</td>
                          <td className="p-3">{log.Name}</td>
                          <td className="p-3 text-blue-500">{log.Email}</td>
                          <td className="p-3 max-w-xs truncate">{log.Headline}</td>
                          <td className="p-3 text-xs opacity-60">{log.Timestamp}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload Toast Container */}
      <UploadToastContainer
        messages={uploadToastMessages}
        onDismiss={removeUploadToast}
        isDark={isDark}
      />
    </PageLayout>
  );
}

