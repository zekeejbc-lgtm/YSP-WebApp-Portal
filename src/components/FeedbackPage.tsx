import { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, Send, Star, MessageSquare, ThumbsUp, AlertCircle, Upload, X, Eye, User, Clock, CheckCircle, XCircle, Mail, Image as ImageIcon, Trash2, Search, RefreshCw, Copy, BarChart3, PieChart as PieChartIcon, Download, FileText, FileSpreadsheet, Settings, ChevronDown, TrendingUp, MessageCircle, Filter, Table2 as TableIcon, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { ImageWithFallback } from './figma/ImageWithFallback';
import CustomDropdown from './CustomDropdown';
import Breadcrumb from './design-system/Breadcrumb';
import { DESIGN_TOKENS } from './design-system';
import { logCreate, logEdit, logDelete } from "../services/gasSystemToolsService";
import { getFeedbacks, createFeedback, updateFeedback, deleteFeedback, uploadFeedbackImage, Feedback } from '../services/gasFeedbackService';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// Organization details for export
const ORG_LOGO_URL = "https://i.imgur.com/J4wddTW.png";
const ORG_NAME = "Youth Service Philippines";
const ORG_CHAPTER = "Tagum Chapter";

// Upload toast message interface
interface UploadToastMessage {
  id: string;
  title: string;
  message: string;
  status: 'loading' | 'success' | 'error' | 'info';
  progress?: number;
  onCancel?: () => void;
}

interface FeedbackPageProps {
  onClose: () => void;
  isAdmin: boolean;
  isDark: boolean;
  userRole?: string;
  username?: string;
  addUploadToast?: (message: UploadToastMessage) => void;
  updateUploadToast?: (id: string, updates: Partial<UploadToastMessage>) => void;
  removeUploadToast?: (id: string) => void;
}

// Skeleton Loading Component
const SkeletonCard = () => (
  <div className="animate-pulse rounded-xl p-4 border" style={{
    background: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(238, 135, 36, 0.2)'
  }}>
    <div className="flex justify-between mb-3">
      <div className="h-4 bg-gray-700 rounded w-1/3"></div>
      <div className="h-4 bg-gray-700 rounded w-20"></div>
    </div>
    <div className="space-y-2">
      <div className="h-3 bg-gray-700 rounded w-full"></div>
      <div className="h-3 bg-gray-700 rounded w-5/6"></div>
    </div>
  </div>
);

export default function FeedbackPage({ onClose, isAdmin, isDark, userRole = 'guest', username = 'guest', addUploadToast, updateUploadToast, removeUploadToast }: FeedbackPageProps) {
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFeedbackIdModal, setShowFeedbackIdModal] = useState(false);
  const [newFeedbackId, setNewFeedbackId] = useState('');
  const [adminReply, setAdminReply] = useState('');
  const [editingFeedback, setEditingFeedback] = useState<Feedback | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false); // Delete confirmation state
  
  // Admin/Auditor dashboard states
  const [showDashboard, setShowDashboard] = useState(false);
  const [chartType, setChartType] = useState<'pie' | 'donut' | 'bar'>('pie');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [showExportModal, setShowExportModal] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [exportModalTab, setExportModalTab] = useState<'preview' | 'settings'>('preview');
  const [exportFormat, setExportFormat] = useState<'pdf' | 'spreadsheet'>('pdf');
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    includeStatistics: true,
    includeCharts: true,
    showAuthorCodes: true,
    showAuthorNames: false,
    showAuthorEmails: false,
    showEmptyTables: false,
    showStatusTables: true,
    showCategoryTables: true,
    dateRange: {
      start: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0], // Default 1 month ago
      end: new Date().toISOString().split('T')[0]
    },
    customTitle: '',
    selectedStatuses: ['Pending', 'Reviewed', 'Resolved', 'Dropped'] as string[],
    selectedCategories: [] as string[],
  });
  
  // Form states with complete schema
  const [formData, setFormData] = useState({
    author: '',
    email: '',
    rating: 0,
    category: 'Other' as Feedback['category'],
    feedback: '',
    anonymous: false,
    preferPrivate: false
  });
  const [hoveredRating, setHoveredRating] = useState(0);
  const [uploadedImages, setUploadedImages] = useState<Array<{ file: File; preview: string }>>([]);
  
  // Real feedbacks from backend
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);

  // Guest's temporary feedbacks (stored in sessionStorage, cleared on refresh)
  const [guestFeedbacks, setGuestFeedbacks] = useState<Feedback[]>([]);

  const fetchFeedbacks = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getFeedbacks();
      // Sort by timestamp descending (newest first)
      const sortedData = data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setFeedbacks(sortedData);
    } catch (error) {
      console.error("Failed to fetch feedbacks:", error);
      toast.error("Failed to load feedbacks", {
        description: "Please check your internet connection and try again."
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchFeedbacks();
  }, [fetchFeedbacks]);

  // Load guest feedbacks from sessionStorage on mount
  useEffect(() => {
    if (userRole === 'guest') {
      const stored = sessionStorage.getItem('guestFeedbacks');
      if (stored) {
        try {
          setGuestFeedbacks(JSON.parse(stored));
        } catch (e) {
          console.error('Failed to parse guest feedbacks:', e);
        }
      }
    }
  }, [userRole]);

  // Save guest feedbacks to sessionStorage whenever they change
  useEffect(() => {
    if (userRole === 'guest' && guestFeedbacks.length > 0) {
      sessionStorage.setItem('guestFeedbacks', JSON.stringify(guestFeedbacks));
    }
  }, [guestFeedbacks, userRole]);

  const categories: Feedback['category'][] = ['Complaint', 'Suggestion', 'Bug', 'Compliment', 'Inquiry', 'Confession', 'Feature Request', 'General Question', 'Privacy Concern', 'Report Issue', 'Appreciation', 'Testimonial', 'Other'];

  // Expanded category colors
  const getCategoryColor = (category: Feedback['category']) => {
    switch (category) {
      case 'Complaint': return { bg: 'rgba(239, 68, 68, 0.2)', border: 'rgba(239, 68, 68, 0.4)', text: '#ef4444' };
      case 'Suggestion': return { bg: 'rgba(59, 130, 246, 0.2)', border: 'rgba(59, 130, 246, 0.4)', text: '#3b82f6' };
      case 'Bug': return { bg: 'rgba(168, 85, 247, 0.2)', border: 'rgba(168, 85, 247, 0.4)', text: '#a855f7' };
      case 'Compliment': return { bg: 'rgba(34, 197, 94, 0.2)', border: 'rgba(34, 197, 94, 0.4)', text: '#22c55e' };
      case 'Inquiry': return { bg: 'rgba(251, 191, 36, 0.2)', border: 'rgba(251, 191, 36, 0.4)', text: '#fbbf24' };
      case 'Confession': return { bg: 'rgba(236, 72, 153, 0.2)', border: 'rgba(236, 72, 153, 0.4)', text: '#ec4899' };
      case 'Feature Request': return { bg: 'rgba(6, 182, 212, 0.2)', border: 'rgba(6, 182, 212, 0.4)', text: '#06b6d4' };
      case 'General Question': return { bg: 'rgba(99, 102, 241, 0.2)', border: 'rgba(99, 102, 241, 0.4)', text: '#6366f1' };
      case 'Privacy Concern': return { bg: 'rgba(239, 68, 68, 0.2)', border: 'rgba(239, 68, 68, 0.4)', text: '#dc2626' };
      case 'Report Issue': return { bg: 'rgba(249, 115, 22, 0.2)', border: 'rgba(249, 115, 22, 0.4)', text: '#f97316' };
      case 'Appreciation': return { bg: 'rgba(16, 185, 129, 0.2)', border: 'rgba(16, 185, 129, 0.4)', text: '#10b981' };
      case 'Testimonial': return { bg: 'rgba(139, 92, 246, 0.2)', border: 'rgba(139, 92, 246, 0.4)', text: '#8b5cf6' };
      default: return { bg: 'rgba(107, 114, 128, 0.2)', border: 'rgba(107, 114, 128, 0.4)', text: '#6b7280' };
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Check if adding these files would exceed the limit
    if (uploadedImages.length + files.length > 3) {
      toast.error('Maximum 3 images allowed', {
        description: 'You can only upload up to 3 images per feedback'
      });
      return;
    }

    // Validate each file
    const validFiles: Array<{ file: File; preview: string }> = [];
    
    for (const file of files) {
      // Check file type
      if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
        toast.error('Invalid file type', {
          description: `${file.name} is not a .jpg or .png file`
        });
        continue;
      }

      // Check file size (10MB = 10 * 1024 * 1024 bytes)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File too large', {
          description: `${file.name} exceeds 10MB limit`
        });
        continue;
      }

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        validFiles.push({ file, preview: reader.result as string });
        if (validFiles.length === files.length || validFiles.length + uploadedImages.length >= 3) {
          setUploadedImages([...uploadedImages, ...validFiles].slice(0, 3));
        }
      };
      reader.readAsDataURL(file);
    }

    // Reset input
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    setUploadedImages(uploadedImages.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.anonymous && !formData.author.trim()) {
      toast.error('Name required', { description: 'Please enter your name or choose to stay anonymous' });
      return;
    }

    if (formData.rating === 0) {
      toast.error('Rating required', { description: 'Please provide a rating' });
      return;
    }

    if (!formData.feedback.trim()) {
      toast.error('Feedback required', { description: 'Please enter your feedback' });
      return;
    }

    setIsLoading(true);
    
    // Generate ID: YSPTFB-YYYY-XXXX
    const manilaDate = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Manila"}));
    const manilaYear = manilaDate.getFullYear();
    const uniqueCode = Math.random().toString(36).substr(2, 4).toUpperCase();
    const feedbackId = `YSPTFB-${manilaYear}-${uniqueCode}`;
    
    const toastId = `submit-${Date.now()}`;
    if (addUploadToast) {
      addUploadToast({
        id: toastId,
        title: 'Submitting Feedback',
        message: 'Preparing data...',
        status: 'loading',
        progress: 10
      });
    }

    try {
      // Handle Image Uploads
      let finalImageUrl = undefined;
      
      if (uploadedImages.length > 0) {
        if (updateUploadToast) {
          updateUploadToast(toastId, {
            message: 'Uploading images to Drive...',
            progress: 30
          });
        }

        const uploadedUrls: string[] = [];
        for (let i = 0; i < uploadedImages.length; i++) {
          if (updateUploadToast) {
            updateUploadToast(toastId, {
               message: `Uploading image ${i + 1} of ${uploadedImages.length}...`,
             progress: 30 + Math.round((i / uploadedImages.length) * 40)
            });
          }
          
          const result = await uploadFeedbackImage(uploadedImages[i].file);
          if (result.success && result.imageUrl) {
            uploadedUrls.push(result.imageUrl);
          } else {
            console.error(`Failed to upload image ${i+1}:`, result.error);
            // We continue even if one image fails, but log it
          }
        }
        
        if (uploadedUrls.length > 0) {
          finalImageUrl = uploadedUrls.join(',');
        }
      }

      if (updateUploadToast) {
        updateUploadToast(toastId, {
          message: 'Saving feedback to database...',
          progress: 80
        });
      }

      // Format timestamp for Manila timezone
      const manilaTimestamp = new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });

      // Determine Author and AuthorId based on anonymous setting
      // If anonymous: author = "Anonymous", authorId = "Anonymous"
      // If not anonymous: author = form name, authorId = username (for officers) or "Guest" (for guests)
      const feedbackAuthor = formData.anonymous ? 'Anonymous' : formData.author;
      const feedbackAuthorId = formData.anonymous ? 'Anonymous' : (userRole === 'guest' ? 'Guest' : (username || 'YSP-Member'));

      const newFeedback: Feedback = {
        id: feedbackId,
        timestamp: manilaTimestamp,
        author: feedbackAuthor,
        authorId: feedbackAuthorId,
        feedback: formData.feedback,
        anonymous: formData.anonymous,
        category: formData.category,
        imageUrl: finalImageUrl,
        status: 'Pending',
        visibility: formData.preferPrivate ? 'Private' : 'Public',
        email: formData.anonymous ? undefined : formData.email, // Don't save email if anonymous
        rating: formData.rating
      };

      // Call Backend
      await createFeedback(newFeedback);

      if (updateUploadToast) {
        updateUploadToast(toastId, {
          status: 'success',
          message: 'Feedback submitted successfully!',
          progress: 100
        });
      }
      if (removeUploadToast) {
        setTimeout(() => removeUploadToast(toastId), 3000);
      }

      // For guests: add to temporary storage
      if (userRole === 'guest') {
        setGuestFeedbacks([newFeedback, ...guestFeedbacks]);
        setNewFeedbackId(feedbackId);
        setShowFeedbackIdModal(true);
      } else {
        // For logged-in users: add to main feedbacks locally (optimistic)
        setFeedbacks([newFeedback, ...feedbacks]);
        toast.success('Feedback submitted!', {
          description: 'Thank you for your valuable feedback. We\'ll review it shortly!'
        });
      }
      
      const logUser = username || (formData.anonymous ? 'Anonymous' : formData.author || 'Guest');
      // We don't await this log call to speed up UI
      logCreate(logUser, "Feedback", newFeedback.id).catch(console.error);

      // Reset form
      setFormData({
        author: '',
        email: '',
        rating: 0,
        category: 'Other',
        feedback: '',
        anonymous: false,
        preferPrivate: false
      });
      setUploadedImages([]);
      setShowSubmitModal(false);

    } catch (error) {
      console.error("Submission failed:", error);
      
      if (updateUploadToast) {
        updateUploadToast(toastId, {
          status: 'error',
          message: 'Submission failed. Please try again.',
          progress: 100
        });
      }
      if (removeUploadToast) {
        setTimeout(() => removeUploadToast(toastId), 5000);
      }

      toast.error("Submission failed", {
        description: error instanceof Error ? error.message : "There was an error submitting your feedback."
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshMyFeedbacks = () => {
    if (userRole === 'guest' && guestFeedbacks.length > 0) {
      // Show warning toast for guests
      toast.warning('Save your Feedback ID!', {
        description: 'Your feedbacks will be cleared after refresh. Make sure to save your Feedback ID to track status.',
        action: {
          label: 'Confirm Refresh',
          onClick: () => {
            setGuestFeedbacks([]);
            sessionStorage.removeItem('guestFeedbacks');
            toast.success('Feedbacks refreshed');
          }
        },
        duration: 10000,
      });
    } else {
      // For logged-in users, refresh from backend
      fetchFeedbacks();
      toast.success('Refreshing feedbacks...');
    }
  };

  const handleRefreshPublicFeedbacks = () => {
    fetchFeedbacks();
    toast.success('Refreshing public feedbacks...');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied!', { description: 'Feedback ID copied to clipboard' });
  };

  const getStatusColor = (status: Feedback['status']) => {
    switch (status) {
      case 'Pending': return { bg: 'rgba(251, 191, 36, 0.2)', border: 'rgba(251, 191, 36, 0.4)', text: '#fbbf24' };
      case 'Reviewed': return { bg: 'rgba(59, 130, 246, 0.2)', border: 'rgba(59, 130, 246, 0.4)', text: '#3b82f6' };
      case 'Resolved': return { bg: 'rgba(34, 197, 94, 0.2)', border: 'rgba(34, 197, 94, 0.4)', text: '#22c55e' };
      case 'Dropped': return { bg: 'rgba(239, 68, 68, 0.2)', border: 'rgba(239, 68, 68, 0.4)', text: '#ef4444' };
    }
  };

  // Filter feedbacks based on user role and search query
  const getMyFeedbacks = () => {
    let baseFeedbacks: Feedback[];
    
    if (userRole === 'guest') {
      baseFeedbacks = guestFeedbacks;
    } else if (isAdmin || userRole === 'auditor') {
      baseFeedbacks = feedbacks;
    } else {
      // For regular logged in users, match by username/authorId
      // Note: We use the same identifier logic as creation
      const currentAuthorId = username || 'YSP-Member';
      baseFeedbacks = feedbacks.filter(f => f.authorId === currentAuthorId); 
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return baseFeedbacks.filter(f => 
        f.id.toLowerCase().includes(query) ||
        f.author.toLowerCase().includes(query) ||
        f.feedback.toLowerCase().includes(query) ||
        f.category.toLowerCase().includes(query) ||
        f.email?.toLowerCase().includes(query)
      );
    }

    return baseFeedbacks;
  };

  const myFeedbacks = getMyFeedbacks();
  const publicFeedbacks = feedbacks.filter(f => f.visibility === 'Public');

  // ============================================
  // DASHBOARD STATISTICS & CALCULATIONS
  // ============================================
  
  // Get filtered feedbacks for dashboard
  const getDashboardFeedbacks = useMemo(() => {
    let filtered = feedbacks;
    
    // Apply category filter
    if (categoryFilter !== 'All') {
      filtered = filtered.filter(f => f.category === categoryFilter);
    }
    
    // Apply status filter  
    if (statusFilter !== 'All') {
      filtered = filtered.filter(f => f.status === statusFilter);
    }
    
    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(f =>
        f.id.toLowerCase().includes(query) ||
        f.author.toLowerCase().includes(query) ||
        f.feedback.toLowerCase().includes(query) ||
        f.category.toLowerCase().includes(query) ||
        f.status.toLowerCase().includes(query) ||
        f.email?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [feedbacks, categoryFilter, statusFilter, searchQuery]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const total = feedbacks.length;
    const pending = feedbacks.filter(f => f.status === 'Pending').length;
    const reviewed = feedbacks.filter(f => f.status === 'Reviewed').length;
    const resolved = feedbacks.filter(f => f.status === 'Resolved').length;
    const dropped = feedbacks.filter(f => f.status === 'Dropped').length;
    const notReplied = feedbacks.filter(f => !f.reply || f.reply.trim() === '').length;
    
    // Calculate average rating
    const ratedFeedbacks = feedbacks.filter(f => f.rating > 0);
    const avgRating = ratedFeedbacks.length > 0 
      ? ratedFeedbacks.reduce((sum, f) => sum + f.rating, 0) / ratedFeedbacks.length 
      : 0;
    
    // Category breakdown
    const categoryBreakdown = categories.reduce((acc, cat) => {
      acc[cat] = feedbacks.filter(f => f.category === cat).length;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      total,
      pending,
      reviewed,
      resolved,
      dropped,
      notReplied,
      avgRating,
      categoryBreakdown,
      publicCount: feedbacks.filter(f => f.visibility === 'Public').length,
      privateCount: feedbacks.filter(f => f.visibility === 'Private').length,
      anonymousCount: feedbacks.filter(f => f.anonymous).length,
    };
  }, [feedbacks]);

  // Chart data for status distribution
  const statusChartData = useMemo(() => [
    { name: 'Pending', value: statistics.pending, color: '#fbbf24' },
    { name: 'Reviewed', value: statistics.reviewed, color: '#3b82f6' },
    { name: 'Resolved', value: statistics.resolved, color: '#22c55e' },
    { name: 'Dropped', value: statistics.dropped, color: '#ef4444' },
  ].filter(d => d.value > 0), [statistics]);

  // Chart data for category distribution  
  const categoryChartData = useMemo(() => 
    Object.entries(statistics.categoryBreakdown)
      .filter(([_, count]) => count > 0)
      .map(([category, count]) => ({
        name: category,
        value: count,
        color: getCategoryColor(category as Feedback['category']).text,
      }))
  , [statistics.categoryBreakdown]);

  // Helper function to load image for PDF
  const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  };

  // Generate PDF Preview
  const generatePDFPreview = async () => {
    setIsGeneratingPreview(true);
    
    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
    }

    try {
      const doc = await generatePDFDocument();
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      setPdfPreviewUrl(url);
    } catch (error) {
      console.error('PDF Preview Generation Error:', error);
      toast.error('Failed to generate PDF preview');
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  // Generate PDF Document
  const generatePDFDocument = async () => {
    const doc = new jsPDF('portrait', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const generatedTimestamp = new Date().toLocaleString();
    const orgMotto = "Shaping the Future to a Greater Society";

    // 1. Filter Data based on Export Settings
    const startDate = new Date(exportOptions.dateRange.start);
    const endDate = new Date(exportOptions.dateRange.end);
    endDate.setHours(23, 59, 59, 999); // End of day

    const reportFeedbacks = feedbacks.filter(f => {
      const fDate = new Date(f.timestamp);
      return fDate >= startDate && fDate <= endDate;
    });

    // Recalculate stats for this report
    const reportStats = {
      total: reportFeedbacks.length,
      pending: reportFeedbacks.filter(f => f.status === 'Pending').length,
      reviewed: reportFeedbacks.filter(f => f.status === 'Reviewed').length,
      resolved: reportFeedbacks.filter(f => f.status === 'Resolved').length,
      dropped: reportFeedbacks.filter(f => f.status === 'Dropped').length,
      notReplied: reportFeedbacks.filter(f => !f.reply || f.reply.trim() === '').length,
      avgRating: reportFeedbacks.length > 0 
        ? reportFeedbacks.reduce((a, b) => a + b.rating, 0) / reportFeedbacks.filter(f => f.rating > 0).length || 0 
        : 0,
      categoryBreakdown: categories.reduce((acc, cat) => {
         acc[cat] = reportFeedbacks.filter(f => f.category === cat).length;
         return acc;
      }, {} as Record<string, number>)
    };

    // Helper function to draw page footer
    const drawFooter = (pageNum: number, totalPages: number) => {
      doc.setDrawColor(246, 66, 31);
      doc.setLineWidth(0.5);
      doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
      
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      doc.setFont('helvetica', 'normal');
      doc.text('Youth Service Philippines - Tagum Chapter', margin, pageHeight - 10);
      doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
      
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.text(`"${orgMotto}"`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    };

    // Load logo
    let logoLoaded = false;
    try {
      const logoImg = await loadImage(ORG_LOGO_URL);
      doc.setFillColor(246, 66, 31);
      doc.rect(0, 0, pageWidth, 45, 'F');
      
      const logoSize = 30;
      const logoX = margin;
      const logoY = 7.5;
      
      doc.setFillColor(255, 255, 255);
      doc.circle(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 2, 'F');
      doc.addImage(logoImg, 'PNG', logoX, logoY, logoSize, logoSize);
      logoLoaded = true;
    } catch {
      doc.setFillColor(246, 66, 31);
      doc.rect(0, 0, pageWidth, 45, 'F');
    }

    // Organization name
    doc.setTextColor(255, 255, 255);
    const orgNameX = logoLoaded ? margin + 35 : margin;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(ORG_NAME, orgNameX, 18);
    doc.setFontSize(12);
    doc.text(ORG_CHAPTER, orgNameX, 26);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('FEEDBACK REPORT', orgNameX, 35);
    doc.setFontSize(8);
    doc.text(`Generated: ${generatedTimestamp}`, pageWidth - margin, 35, { align: 'right' });

    let yPosition = 52;

    // Divider
    doc.setDrawColor(246, 66, 31);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 8;

    // PAGE 1: SMART EXECUTIVE SUMMARY & BOXES
    if (exportOptions.includeStatistics) {
      
      // --- SMART SUMMARY GENERATION LOGIC ---
      const generateSmartSummary = () => {
        if (reportStats.total === 0) {
          return `Between ${startDate.toLocaleDateString()} and ${endDate.toLocaleDateString()}, no feedback entries were recorded. The system is active and ready to receive submissions. No immediate actions are required at this time.`;
        }

        const resolutionRate = (reportStats.resolved / reportStats.total) * 100;
        const pendingRate = (reportStats.pending / reportStats.total) * 100;
        const responseRate = ((reportStats.total - reportStats.notReplied) / reportStats.total) * 100;
        
        // Find top category
        const topCategoryEntry = Object.entries(reportStats.categoryBreakdown).sort((a, b) => b[1] - a[1])[0];
        const topCategoryName = topCategoryEntry ? topCategoryEntry[0] : 'N/A';
        const topCategoryCount = topCategoryEntry ? topCategoryEntry[1] : 0;
        const topCategoryPercent = ((topCategoryCount / reportStats.total) * 100).toFixed(1);

        let narrative = `From ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}, the organization received a total of ${reportStats.total} feedbacks. `;

        // Status Narrative
        if (resolutionRate >= 80) {
          narrative += `The team has demonstrated exceptional performance, successfully resolving ${reportStats.resolved} issues (${resolutionRate.toFixed(1)}% resolution rate). `;
        } else if (resolutionRate >= 50) {
          narrative += `We have made steady progress, resolving ${reportStats.resolved} issues (${resolutionRate.toFixed(1)}% resolution rate). `;
        } else if (reportStats.resolved === 0 && reportStats.total > 0) {
           narrative += `Currently, no issues have been marked as resolved yet. `;
        } else {
           narrative += `Resolution efforts are ongoing, with ${reportStats.resolved} issues resolved (${resolutionRate.toFixed(1)}% rate). `;
        }

        if (pendingRate > 40) {
          narrative += `Attention is advised as ${reportStats.pending} items (${pendingRate.toFixed(1)}%) remain in 'Pending' status. Prioritizing these items is recommended. `;
        } else if (reportStats.pending > 0) {
          narrative += `There are ${reportStats.pending} pending items currently in the queue. `;
        } else {
          narrative += `There are zero pending items, indicating a clear backlog. `;
        }

        // Category Narrative
        if (topCategoryCount > 0) {
           narrative += `The primary driver of feedback for this period is '${topCategoryName}', accounting for ${topCategoryPercent}% of all submissions. `;
        }

        // Rating Narrative
        if (reportStats.avgRating > 0) {
           if (reportStats.avgRating >= 4.5) {
             narrative += `User sentiment is overwhelmingly positive with an excellent average rating of ${reportStats.avgRating.toFixed(2)}/5. `;
           } else if (reportStats.avgRating >= 3.0) {
             narrative += `User sentiment is generally positive, averaging ${reportStats.avgRating.toFixed(2)}/5. `;
           } else {
             narrative += `User satisfaction metrics indicate room for improvement, with an average rating of ${reportStats.avgRating.toFixed(2)}/5. `;
           }
        }

        // Response Narrative
        if (reportStats.notReplied === 0) {
          narrative += `Notably, the administration has achieved a 100% response rate, replying to all submissions.`;
        } else if (reportStats.notReplied > 0) {
          narrative += `${reportStats.notReplied} submissions are still awaiting an official response (${responseRate.toFixed(1)}% coverage).`;
        }

        return narrative;
      };

      const summaryText = generateSmartSummary();

      // --- SUMMARY CARD ---
      doc.setFillColor(248, 250, 252); // Very light gray/slate
      doc.setDrawColor(226, 232, 240); // Border color
      doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, 45, 3, 3, 'FD'); // Filled and Stroked
      
      // Card Title
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(246, 66, 31); // Brand Orange
      doc.text('EXECUTIVE SUMMARY', margin + 6, yPosition + 8);

      // Card Body
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85); // Slate 700
      
      const summaryLines = doc.splitTextToSize(summaryText, pageWidth - 2 * margin - 12);
      doc.text(summaryLines, margin + 6, yPosition + 15);
      
      yPosition += 55; // Move past the card

      // --- STATUS BOXES ---
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('STATUS OVERVIEW', margin, yPosition);
      doc.setDrawColor(246, 66, 31);
      doc.setLineWidth(0.3);
      doc.line(margin, yPosition + 2, margin + 40, yPosition + 2);
      yPosition += 8;

      const statusBoxWidth = (pageWidth - 2 * margin - 9) / 4;
      const statusBoxHeight = 22;
      const statuses = [
        { name: 'PENDING', color: [251, 191, 36], count: reportStats.pending },
        { name: 'REVIEWED', color: [59, 130, 246], count: reportStats.reviewed },
        { name: 'RESOLVED', color: [34, 197, 94], count: reportStats.resolved },
        { name: 'DROPPED', color: [239, 68, 68], count: reportStats.dropped },
      ];

      statuses.forEach((status, index) => {
        const boxX = margin + index * (statusBoxWidth + 3);
        
        // Box Background
        doc.setFillColor(status.color[0], status.color[1], status.color[2]);
        doc.roundedRect(boxX, yPosition, statusBoxWidth, statusBoxHeight, 2, 2, 'F');
        
        // Count
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text(String(status.count), boxX + statusBoxWidth / 2, yPosition + 10, { align: 'center' });
        
        // Label
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(status.name, boxX + statusBoxWidth / 2, yPosition + 17, { align: 'center' });
      });
      yPosition += statusBoxHeight + 12;

      // --- CATEGORY BOXES ---
      // We want to fit this on the first page.
      // Check remaining space
      const remainingSpace = pageHeight - margin - yPosition - 15; // 15 for footer
      if (remainingSpace > 40) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('CATEGORY BREAKDOWN', margin, yPosition);
        doc.setDrawColor(246, 66, 31);
        doc.setLineWidth(0.3);
        doc.line(margin, yPosition + 2, margin + 45, yPosition + 2);
        yPosition += 8;

        // Grid Layout for Categories
        const catBoxWidth = (pageWidth - 2 * margin - 9) / 4; // 4 columns
        const catBoxHeight = 16;
        const gap = 3;
        
        // Filter out 0 counts if space is tight, or show top N?
        // Let's show all non-zero, then 0s if space permits.
        const activeCategories = Object.entries(reportStats.categoryBreakdown)
           .filter(([_, count]) => count > 0)
           .sort((a, b) => b[1] - a[1]);
        
        // If no categories active, show empty state or just a few 0s
        const displayCategories = activeCategories.length > 0 ? activeCategories : categories.slice(0, 8).map(c => [c, 0]);

        displayCategories.forEach((cat, index) => {
           // Check if we are running off the page
           if (yPosition + catBoxHeight > pageHeight - 20) return;

           const col = index % 4;
           const row = Math.floor(index / 4);
           
           // If we are starting a new row, verify space
           if (col === 0 && row > 0) {
              yPosition += catBoxHeight + gap;
              if (yPosition + catBoxHeight > pageHeight - 20) return;
           }

           // Special handling for first row yPosition
           const currentY = row === 0 ? yPosition : yPosition; 
           // Wait, the logic above increments yPosition for rows > 0. 
           // Let's simplify:
           // We calculate absolute pos based on row.
        });

        // Simpler loop
        let currentRow = 0;
        let currentCol = 0;
        const startY = yPosition;

        displayCategories.forEach(([name, count]) => {
           const boxX = margin + currentCol * (catBoxWidth + gap);
           const boxY = startY + currentRow * (catBoxHeight + gap);

           // Stop if off page
           if (boxY + catBoxHeight > pageHeight - 20) return;

           // Draw Box
           // We need RGB for setFillColor. Convert hex or rgba.
           // For simplicity, we'll use a standard light gray fill and colored text/border to match theme.
           
           doc.setDrawColor(200, 200, 200);
           doc.setFillColor(255, 255, 255);
           doc.roundedRect(boxX, boxY, catBoxWidth, catBoxHeight, 2, 2, 'FD');

           // Count Pill
           doc.setFillColor(246, 66, 31);
           doc.roundedRect(boxX + catBoxWidth - 12, boxY + 3, 9, 6, 2, 2, 'F');
           doc.setTextColor(255, 255, 255);
           doc.setFontSize(7);
           doc.setFont('helvetica', 'bold');
           doc.text(String(count), boxX + catBoxWidth - 7.5, boxY + 7, { align: 'center' });

           // Category Name
           doc.setTextColor(50, 50, 50);
           doc.setFontSize(7);
           doc.setFont('helvetica', 'bold');
           // Truncate name if too long
           const displayName = name.length > 18 ? name.substring(0, 16) + '..' : name;
           doc.text(String(displayName), boxX + 3, boxY + 10);

           currentCol++;
           if (currentCol >= 4) {
             currentCol = 0;
             currentRow++;
           }
        });
      }
    }

    // Helper to generate table for a specific dataset
    const generateTable = (title: string, data: Feedback[]) => {
      if (data.length === 0 && !exportOptions.showEmptyTables) return;

      doc.addPage();
      yPosition = 20;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(`${title} (${data.length})`, margin, yPosition);
      yPosition += 5;

      const tableData = data.map((fb, index) => {
        let authorDisplay = fb.id;
        if (exportOptions.showAuthorNames && !fb.anonymous) {
          authorDisplay = fb.author;
        } else if (exportOptions.showAuthorEmails && fb.email && !fb.anonymous) {
          authorDisplay = fb.email;
        } else if (fb.anonymous) {
          authorDisplay = 'Anonymous';
        }

        // NO TRUNCATION HERE - Let autoTable wrap it
        const imageLinks = fb.imageUrl ? 
          fb.imageUrl.split(',').map((_, i) => `[Image ${i + 1}]`).join(' ') : '-';

        return [
          String(index + 1),
          fb.id,
          authorDisplay,
          fb.category,
          fb.feedback || '-', // Full text
          imageLinks,
          fb.status,
          fb.rating > 0 ? `${fb.rating}/5` : '-',
          new Date(fb.timestamp).toLocaleDateString(),
        ];
      });

      autoTable(doc, {
        startY: yPosition,
        head: [['#', 'ID', 'Author', 'Category', 'Message', 'Images', 'Status', 'Rating', 'Date']],
        body: tableData.length > 0 ? tableData : [['-', '-', '-', '-', 'No data available', '-', '-', '-', '-']],
        theme: 'grid',
        headStyles: {
          fillColor: [246, 66, 31],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 8,
        },
        bodyStyles: { fontSize: 8, textColor: [50, 50, 50] },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 22 },
          2: { cellWidth: 20 },
          3: { cellWidth: 18 },
          4: { cellWidth: 'auto' }, // Allow wrapping
          5: { cellWidth: 15 },
          6: { cellWidth: 15, halign: 'center' },
          7: { cellWidth: 12, halign: 'center' },
          8: { cellWidth: 18, halign: 'center' },
        },
        margin: { left: margin, right: margin },
        styles: { overflow: 'linebreak', cellPadding: 2 },
      });
    };

    // PAGE 2+: TABLES PER STATUS (Filtered by Toggle)
    if (exportOptions.showStatusTables) {
      const statusGroups = ['Pending', 'Reviewed', 'Resolved', 'Dropped'];
      statusGroups.forEach(status => {
        const statusData = reportFeedbacks.filter(f => f.status === status);
        generateTable(`Status: ${status}`, statusData);
      });
    }

    // PAGE N: TABLES PER CATEGORY (Filtered by Toggle)
    if (exportOptions.showCategoryTables) {
      categories.forEach(category => {
        const categoryData = reportFeedbacks.filter(f => f.category === category);
        generateTable(`Category: ${category}`, categoryData);
      });
    }

    // PAGE LAST: CHARTS
    if (exportOptions.includeCharts) {
      doc.addPage();
      yPosition = 20;

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('ANALYTICS CHARTS', margin, yPosition);
      yPosition += 20;

      // Draw Bar Chart: Status Distribution
      doc.setFontSize(11);
      doc.text('Status Distribution', margin, yPosition);
      yPosition += 10;

      const maxVal = Math.max(reportStats.pending, reportStats.reviewed, reportStats.resolved, reportStats.dropped, 1);
      const chartHeight = 60;
      const chartWidth = pageWidth - 2 * margin;
      const barWidth = (chartWidth / 4) - 10;
      
      const statusChartData = [
        { label: 'Pending', value: reportStats.pending, color: [251, 191, 36] },
        { label: 'Reviewed', value: reportStats.reviewed, color: [59, 130, 246] },
        { label: 'Resolved', value: reportStats.resolved, color: [34, 197, 94] },
        { label: 'Dropped', value: reportStats.dropped, color: [239, 68, 68] },
      ];

      // Draw axes
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, yPosition + chartHeight, margin + chartWidth, yPosition + chartHeight); // X axis
      doc.line(margin, yPosition, margin, yPosition + chartHeight); // Y axis

      // Draw bars
      statusChartData.forEach((data, index) => {
        const barHeight = (data.value / maxVal) * chartHeight;
        const x = margin + 10 + (index * (barWidth + 10));
        const y = yPosition + chartHeight - barHeight;
        
        doc.setFillColor(data.color[0], data.color[1], data.color[2]);
        doc.rect(x, y, barWidth, barHeight, 'F');
        
        // Label
        doc.setFontSize(8);
        doc.setTextColor(50, 50, 50);
        doc.text(String(data.value), x + barWidth/2, y - 2, { align: 'center' });
        doc.text(data.label, x + barWidth/2, yPosition + chartHeight + 5, { align: 'center' });
      });

      yPosition += chartHeight + 30;

      // Draw Bar Chart: Category Distribution (Top 5)
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Top Categories', margin, yPosition);
      yPosition += 10;

      const sortedCategories = Object.entries(reportStats.categoryBreakdown)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5); // Top 5
      
      if (sortedCategories.length > 0) {
        const maxCatVal = Math.max(...sortedCategories.map(c => c[1]), 1);
        const catBarWidth = (chartWidth / sortedCategories.length) - 10;

        // Draw axes
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, yPosition + chartHeight, margin + chartWidth, yPosition + chartHeight);
        doc.line(margin, yPosition, margin, yPosition + chartHeight);

        sortedCategories.forEach((data, index) => {
          const barHeight = (data[1] / maxCatVal) * chartHeight;
          const x = margin + 10 + (index * (catBarWidth + 10));
          const y = yPosition + chartHeight - barHeight;
          
          doc.setFillColor(246, 66, 31); // Brand Orange
          doc.rect(x, y, catBarWidth, barHeight, 'F');
          
          doc.setFontSize(8);
          doc.setTextColor(50, 50, 50);
          doc.text(String(data[1]), x + catBarWidth/2, y - 2, { align: 'center' });
          
          // Truncate label if too long
          const label = data[0].length > 10 ? data[0].substring(0, 8) + '..' : data[0];
          doc.text(label, x + catBarWidth/2, yPosition + chartHeight + 5, { align: 'center' });
        });
      } else {
         doc.text('No category data available.', margin, yPosition + 10);
      }
    }

    // Update footers
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      drawFooter(i, totalPages);
    }

    return doc;
  };

  // Export PDF with progress toast
  const handleExportPDF = async () => {
    const toastId = `pdf-export-${Date.now()}`;
    
    if (addUploadToast) {
      addUploadToast({
        id: toastId,
        title: 'Exporting PDF',
        message: 'Preparing document...',
        status: 'loading',
        progress: 10,
      });
    }

    try {
      if (updateUploadToast) {
        updateUploadToast(toastId, { message: 'Generating PDF...', progress: 50 });
      }

      const doc = await generatePDFDocument();
      
      if (updateUploadToast) {
        updateUploadToast(toastId, { message: 'Saving file...', progress: 90 });
      }

      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `Feedback_Report_${dateStr}.pdf`;
      doc.save(filename);

      if (updateUploadToast && removeUploadToast) {
        updateUploadToast(toastId, {
          status: 'success',
          message: `File saved as "${filename}"`,
          progress: 100,
        });
        setTimeout(() => removeUploadToast(toastId), 3000);
      }
    } catch (error) {
      console.error('PDF Export Error:', error);
      if (updateUploadToast && removeUploadToast) {
        updateUploadToast(toastId, {
          status: 'error',
          message: 'Failed to export PDF',
          progress: 100,
        });
        setTimeout(() => removeUploadToast(toastId), 5000);
      }
    }
  };

  // Export Spreadsheet with progress toast
  const handleExportSpreadsheet = async () => {
    const toastId = `spreadsheet-export-${Date.now()}`;
    
    if (addUploadToast) {
      addUploadToast({
        id: toastId,
        title: 'Exporting Spreadsheet',
        message: 'Preparing workbook...',
        status: 'loading',
        progress: 10,
      });
    }

    try {
      if (updateUploadToast) {
        updateUploadToast(toastId, { message: 'Processing data...', progress: 40 });
      }

      const workbook = XLSX.utils.book_new();

      // Header information
      const headerData: (string | number)[][] = [
        [`${ORG_NAME} - ${ORG_CHAPTER}`],
        ['Feedback Report'],
        [''],
        ['STATISTICS'],
        ['Total Feedbacks:', statistics.total],
        ['Pending:', statistics.pending],
        ['Reviewed:', statistics.reviewed],
        ['Resolved:', statistics.resolved],
        ['Dropped:', statistics.dropped],
        ['Not Replied:', statistics.notReplied],
        ['Average Rating:', statistics.avgRating.toFixed(2)],
        [''],
        ['Generated:', new Date().toLocaleString()],
        [''],
        ['FEEDBACK LIST'],
        ['#', 'Code/Author', 'Category', 'Status', 'Rating', 'Replied', 'Date', 'Feedback Preview'],
      ];

      // Add feedback data
      getDashboardFeedbacks.forEach((fb, index) => {
        let authorDisplay = fb.id;
        if (exportOptions.showAuthorNames && !fb.anonymous) {
          authorDisplay = fb.author;
        } else if (exportOptions.showAuthorEmails && fb.email && !fb.anonymous) {
          authorDisplay = fb.email;
        } else if (fb.anonymous) {
          authorDisplay = 'Anonymous';
        }

        headerData.push([
          index + 1,
          authorDisplay,
          fb.category,
          fb.status,
          fb.rating > 0 ? fb.rating : '-',
          fb.reply ? 'Yes' : 'No',
          new Date(fb.timestamp).toLocaleDateString(),
          fb.feedback.substring(0, 100) + (fb.feedback.length > 100 ? '...' : ''),
        ]);
      });

      if (updateUploadToast) {
        updateUploadToast(toastId, { message: 'Creating spreadsheet...', progress: 70 });
      }

      const worksheet = XLSX.utils.aoa_to_sheet(headerData);

      worksheet['!cols'] = [
        { wch: 5 },
        { wch: 30 },
        { wch: 18 },
        { wch: 12 },
        { wch: 8 },
        { wch: 10 },
        { wch: 12 },
        { wch: 50 },
      ];

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Feedback Report');

      if (updateUploadToast) {
        updateUploadToast(toastId, { message: 'Saving file...', progress: 90 });
      }

      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `Feedback_Report_${dateStr}.xlsx`;
      XLSX.writeFile(workbook, filename);

      if (updateUploadToast && removeUploadToast) {
        updateUploadToast(toastId, {
          status: 'success',
          message: `File saved as "${filename}"`,
          progress: 100,
        });
        setTimeout(() => removeUploadToast(toastId), 3000);
      }
    } catch (error) {
      console.error('Spreadsheet Export Error:', error);
      if (updateUploadToast && removeUploadToast) {
        updateUploadToast(toastId, {
          status: 'error',
          message: 'Failed to export spreadsheet',
          progress: 100,
        });
        setTimeout(() => removeUploadToast(toastId), 5000);
      }
    }
  };

  // Handle export modal close
  const handleCloseExportModal = () => {
    setShowExportModal(false);
    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
    }
  };

  // Open export with preview
  const handleExportWithPreview = (format: 'pdf' | 'spreadsheet') => {
    setExportFormat(format);
    setExportModalTab('preview');
    setShowExportModal(true);
    
    if (format === 'pdf') {
      generatePDFPreview();
    }
  };

  const openDetailModal = (feedback: Feedback) => {
    setSelectedFeedback(feedback);
    setEditingFeedback({ ...feedback });
    setAdminReply(feedback.reply || '');
    setShowDetailModal(true);
  };

  const handleUpdateFeedback = async () => {
    if (!editingFeedback || !selectedFeedback) return;
    
    setIsLoading(true);
    const updateToastId = `update-${Date.now()}`;
    
    if (addUploadToast) {
      addUploadToast({
        id: updateToastId,
        title: 'Updating Feedback',
        message: 'Saving changes to database...',
        status: 'loading',
        progress: 30
      });
    }
    
    try {
      // Format reply timestamp for Manila timezone if replying
      const replyTimestamp = adminReply ? new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }) : editingFeedback.replyTimestamp;
      
      const updatedData: Feedback = {
        ...editingFeedback,
        reply: adminReply || undefined,
        replyTimestamp: replyTimestamp,
        replier: adminReply ? (username || 'Admin Team') : editingFeedback.replier,
        replierId: adminReply ? 'ADMIN-ACTION' : editingFeedback.replierId
      };

      await updateFeedback(updatedData);

      if (updateUploadToast) {
        updateUploadToast(updateToastId, {
          status: 'success',
          message: 'Feedback updated successfully!',
          progress: 100
        });
      }
      if (removeUploadToast) {
        setTimeout(() => removeUploadToast(updateToastId), 3000);
      }

      const wasDropped = selectedFeedback.status === 'Dropped';
      const isDropped = updatedData.status === 'Dropped';

      // Update local state
      const updatedFeedbacks = feedbacks.map(f => 
        f.id === updatedData.id ? updatedData : f
      );

      setFeedbacks(updatedFeedbacks);
      
      // Also update guest feedbacks if it exists there (edge case where admin edits a guest feedback that is still in guest's session)
      // This won't update other users' sessions, obviously.
      
      toast.success('Feedback updated!', {
        description: 'Changes have been saved successfully.'
      });
      
      if (!wasDropped && isDropped) {
        logDelete(username || 'admin', "Feedback", updatedData.id).catch(console.error);
      } else {
        logEdit(username || 'admin', "Feedback", updatedData.id).catch(console.error);
      }
      setShowDetailModal(false);
      setSelectedFeedback(null);
      setConfirmingDelete(false);
    } catch (error) {
      console.error("Update failed:", error);
      
      if (updateUploadToast) {
        updateUploadToast(updateToastId, {
          status: 'error',
          message: 'Failed to update feedback.',
          progress: 100
        });
      }
      if (removeUploadToast) {
        setTimeout(() => removeUploadToast(updateToastId), 5000);
      }
      
      toast.error("Update failed", {
        description: "Failed to save changes. Please try again."
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteFeedback = async () => {
    if (!selectedFeedback) return;
    
    // If not confirming yet, show confirmation buttons
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    
    // User confirmed, proceed with deletion
    setIsLoading(true);
    const deleteToastId = `delete-${Date.now()}`;
    
    if (addUploadToast) {
      addUploadToast({
        id: deleteToastId,
        title: 'Deleting Feedback',
        message: 'Removing feedback from database...',
        status: 'loading',
        progress: 30
      });
    }
    
    try {
      await deleteFeedback(selectedFeedback.id);

      if (updateUploadToast) {
        updateUploadToast(deleteToastId, {
          status: 'success',
          message: 'Feedback deleted successfully!',
          progress: 100
        });
      }
      if (removeUploadToast) {
        setTimeout(() => removeUploadToast(deleteToastId), 3000);
      }

      // Remove from local state
      setFeedbacks(feedbacks.filter(f => f.id !== selectedFeedback.id));
      
      toast.success('Feedback deleted!', {
        description: 'The feedback has been permanently removed.'
      });
      
      logDelete(username || 'admin', "Feedback", selectedFeedback.id).catch(console.error);
      
      setShowDetailModal(false);
      setSelectedFeedback(null);
      setConfirmingDelete(false);
    } catch (error) {
      console.error("Delete failed:", error);
      
      if (updateUploadToast) {
        updateUploadToast(deleteToastId, {
          status: 'error',
          message: 'Failed to delete feedback.',
          progress: 100
        });
      }
      if (removeUploadToast) {
        setTimeout(() => removeUploadToast(deleteToastId), 5000);
      }
      
      toast.error("Delete failed", {
        description: "Failed to delete feedback. Please try again."
      });
      setConfirmingDelete(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen ${isDark ? 'dark' : ''} relative overflow-hidden`} style={{ background: isDark ? '#0f172a' : '#f8fafc' }}>
      {/* Animated Background Blobs - Same as Homepage */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-200/40 dark:bg-orange-500/10 rounded-full mix-blend-multiply dark:mix-blend-normal filter blur-3xl opacity-70 animate-blob" />
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-yellow-200/40 dark:bg-yellow-500/10 rounded-full mix-blend-multiply dark:mix-blend-normal filter blur-3xl opacity-70 animate-blob animation-delay-2000" />
        <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-red-200/40 dark:bg-red-500/10 rounded-full mix-blend-multiply dark:mix-blend-normal filter blur-3xl opacity-70 animate-blob animation-delay-4000" />
        <div className="absolute bottom-0 right-1/3 w-96 h-96 bg-pink-200/40 dark:bg-pink-500/10 rounded-full mix-blend-multiply dark:mix-blend-normal filter blur-3xl opacity-70 animate-blob animation-delay-6000" />
      </div>

      {/* Glassmorphism Header - Matching Homepage Exactly */}
      <header
        className="fixed top-4 left-4 right-4 z-50 h-16 rounded-2xl border shadow-2xl transition-all duration-300"
        style={{
          background: isDark 
            ? 'rgba(17, 24, 39, 0.7)'
            : 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)',
          boxShadow: isDark 
            ? '0 8px 32px 0 rgba(0, 0, 0, 0.3), inset 0 1px 0 0 rgba(255, 255, 255, 0.05)'
            : '0 8px 32px 0 rgba(31, 38, 135, 0.15), inset 0 1px 0 0 rgba(255, 255, 255, 0.5)'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-full flex items-center gap-3">
          {/* Back Button */}
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, rgba(238, 135, 36, 0.15), rgba(246, 66, 31, 0.15))',
              border: '2px solid rgba(238, 135, 36, 0.3)',
              color: '#ee8724',
              fontWeight: '600',
              fontSize: '0.875rem'
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </button>

          {/* Title Section - Centered */}
          <div className="flex-1 text-center min-w-0">
            <h1 
              className="text-base sm:text-lg md:text-xl lg:text-2xl"
              style={{
                fontFamily: 'var(--font-headings)',
                fontWeight: 'var(--font-weight-bold)',
                letterSpacing: '-0.02em',
                color: isDark ? '#fb923c' : '#ea580c',
                lineHeight: '1.2'
              }}
            >
              {showDashboard ? 'Feedback Dashboard' : 'Feedback Center'}
            </h1>
            <p className={`text-xs hidden sm:block ${isDark ? 'text-gray-400' : 'text-gray-600'}`} style={{ fontWeight: '500', lineHeight: '1.2' }}>
              {showDashboard ? 'Analytics & Export' : 'Your voice shapes our community'}
            </p>
          </div>

          {/* Empty div to balance the header layout */}
          <div className="w-20 sm:w-24 flex-shrink-0" />
        </div>
      </header>

      {/* Add top padding to account for fixed header */}
      <div className="h-24" />

      {/* Breadcrumbs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
        <Breadcrumb
          items={[
            { label: "Home", onClick: onClose },
            { label: "Communication Center", onClick: undefined },
            { label: showDashboard ? "Feedback Dashboard" : "Feedback", onClick: undefined },
          ]}
          isDark={isDark}
        />
      </div>

      {/* ADMIN DASHBOARD VIEW */}
      {showDashboard && (isAdmin || userRole === 'auditor') ? (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 relative z-10">
          {/* Back Button */}
          <button
            onClick={() => setShowDashboard(false)}
            className="mb-4 flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all duration-300 hover:scale-105 active:scale-95 text-sm"
            style={{
              background: isDark ? 'rgba(238, 135, 36, 0.15)' : 'rgba(238, 135, 36, 0.1)',
              border: '1.5px solid rgba(238, 135, 36, 0.3)',
              color: '#ee8724',
              fontWeight: '600',
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </button>

          {/* Search and Filter Controls */}
          <div
            className="rounded-xl p-6 mb-6 border"
            style={{
              background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
              backdropFilter: 'blur(20px)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
          >
            <div className="grid md:grid-cols-3 gap-4">
              {/* Search */}
              <div>
                <label className="block mb-2 text-sm font-semibold" style={{ color: DESIGN_TOKENS.colors.brand.orange }}>
                  Smart Search
                </label>
                <div className="relative">
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search ID, author, content..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 transition-all duration-300 focus:outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.9)',
                      borderColor: isDark ? 'rgba(238, 135, 36, 0.3)' : 'rgba(238, 135, 36, 0.4)',
                      color: isDark ? '#fff' : '#1e293b'
                    }}
                  />
                </div>
              </div>

              {/* Category Filter */}
              <div>
                <label className="block mb-2 text-sm font-semibold" style={{ color: DESIGN_TOKENS.colors.brand.orange }}>
                  Category
                </label>
                <CustomDropdown
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  options={['All', ...categories]}
                  isDark={isDark}
                  size="md"
                />
              </div>

              {/* Status Filter */}
              <div>
                <label className="block mb-2 text-sm font-semibold" style={{ color: DESIGN_TOKENS.colors.brand.orange }}>
                  Status
                </label>
                <CustomDropdown
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={['All', 'Pending', 'Reviewed', 'Resolved', 'Dropped']}
                  isDark={isDark}
                  size="md"
                />
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
            {/* Total */}
            <div
              className="rounded-xl p-4 border cursor-pointer hover:scale-105 transition-transform"
              style={{
                background: isDark ? 'rgba(246, 66, 31, 0.15)' : 'rgba(246, 66, 31, 0.1)',
                borderColor: '#f6421f',
              }}
            >
              <p className="text-sm text-muted-foreground mb-1">Total</p>
              <p className="text-2xl font-bold" style={{ color: '#f6421f' }}>{statistics.total}</p>
            </div>
            {/* Pending */}
            <div
              className="rounded-xl p-4 border cursor-pointer hover:scale-105 transition-transform"
              style={{
                background: isDark ? 'rgba(251, 191, 36, 0.15)' : 'rgba(251, 191, 36, 0.1)',
                borderColor: '#fbbf24',
              }}
            >
              <p className="text-sm text-muted-foreground mb-1">Pending</p>
              <p className="text-2xl font-bold" style={{ color: '#fbbf24' }}>{statistics.pending}</p>
            </div>
            {/* Reviewed */}
            <div
              className="rounded-xl p-4 border cursor-pointer hover:scale-105 transition-transform"
              style={{
                background: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)',
                borderColor: '#3b82f6',
              }}
            >
              <p className="text-sm text-muted-foreground mb-1">Reviewed</p>
              <p className="text-2xl font-bold" style={{ color: '#3b82f6' }}>{statistics.reviewed}</p>
            </div>
            {/* Resolved */}
            <div
              className="rounded-xl p-4 border cursor-pointer hover:scale-105 transition-transform"
              style={{
                background: isDark ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.1)',
                borderColor: '#22c55e',
              }}
            >
              <p className="text-sm text-muted-foreground mb-1">Resolved</p>
              <p className="text-2xl font-bold" style={{ color: '#22c55e' }}>{statistics.resolved}</p>
            </div>
            {/* Dropped */}
            <div
              className="rounded-xl p-4 border cursor-pointer hover:scale-105 transition-transform"
              style={{
                background: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                borderColor: '#ef4444',
              }}
            >
              <p className="text-sm text-muted-foreground mb-1">Dropped</p>
              <p className="text-2xl font-bold" style={{ color: '#ef4444' }}>{statistics.dropped}</p>
            </div>
            {/* Not Replied */}
            <div
              className="rounded-xl p-4 border cursor-pointer hover:scale-105 transition-transform"
              style={{
                background: isDark ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.15)',
                borderColor: '#dc2626',
                borderWidth: 2,
              }}
            >
              <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                <MessageCircle className="w-3 h-3" />
                Not Replied
              </p>
              <p className="text-2xl font-bold" style={{ color: '#dc2626' }}>{statistics.notReplied}</p>
            </div>
          </div>

          {/* Chart Section */}
          <div
            className="rounded-xl p-6 mb-6 border relative"
            style={{
              background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
              backdropFilter: 'blur(20px)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              zIndex: 20,
            }}
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${DESIGN_TOKENS.colors.brand.orange}15` }}>
                  <TrendingUp className="w-5 h-5" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
                </div>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-headings)', fontWeight: 'bold', fontSize: '1.1rem' }}>
                    Feedback Analytics
                  </h3>
                  <p className="text-sm text-muted-foreground">{getDashboardFeedbacks.length} feedbacks shown</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Chart Type Selector */}
                <div className="flex gap-1 p-1 rounded-lg" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                  {(['pie', 'donut', 'bar'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setChartType(type)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${chartType === type ? 'bg-[#f6421f] text-white' : ''}`}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Export Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowExportDropdown(!showExportDropdown)}
                    className="px-4 py-2 rounded-lg bg-[#f6421f] text-white hover:bg-[#d93819] transition-colors flex items-center gap-2"
                    style={{ fontWeight: 600 }}
                  >
                    <Download className="w-4 h-4" />
                    Export
                    <ChevronDown className={`w-4 h-4 transition-transform ${showExportDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {/* Export Dropdown Menu */}
                  {showExportDropdown && (
                    <div
                      className="absolute right-0 top-full mt-2 w-56 rounded-xl border shadow-xl overflow-hidden"
                      style={{
                        background: isDark ? 'rgba(17, 24, 39, 0.98)' : 'rgba(255, 255, 255, 0.98)',
                        backdropFilter: 'blur(20px)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        zIndex: 100,
                      }}
                    >
                      <button
                        onClick={() => {
                          setShowExportDropdown(false);
                          handleExportWithPreview('pdf');
                        }}
                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                      >
                        <FileText className="w-5 h-5 text-[#f6421f]" />
                        <div>
                          <div className="font-medium">Export as PDF</div>
                          <div className="text-xs text-muted-foreground">With preview & charts</div>
                        </div>
                      </button>
                      <div style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }} />
                      <button
                        onClick={() => {
                          setShowExportDropdown(false);
                          handleExportWithPreview('spreadsheet');
                        }}
                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                      >
                        <FileSpreadsheet className="w-5 h-5 text-green-600" />
                        <div>
                          <div className="font-medium">Export as Spreadsheet</div>
                          <div className="text-xs text-muted-foreground">Excel-compatible format</div>
                        </div>
                      </button>
                    </div>
                  )}
                  
                  {/* Backdrop to close dropdown */}
                  {showExportDropdown && (
                    <div 
                      className="fixed inset-0" 
                      style={{ zIndex: 50 }}
                      onClick={() => setShowExportDropdown(false)}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Status Distribution */}
              <div className="rounded-xl p-4" style={{ background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)' }}>
                <h4 className="font-semibold mb-4">Status Distribution</h4>
                {statusChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    {chartType === 'bar' ? (
                      <BarChart data={statusChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value">
                          {statusChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    ) : (
                      <PieChart>
                        <Pie
                          data={statusChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          innerRadius={chartType === 'donut' ? 50 : 0}
                          outerRadius={80}
                          dataKey="value"
                        >
                          {statusChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    )}
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    No data available
                  </div>
                )}
              </div>

              {/* Category Distribution */}
              <div className="rounded-xl p-4" style={{ background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)' }}>
                <h4 className="font-semibold mb-4">Category Distribution</h4>
                {categoryChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={categoryChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="value">
                        {categoryChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    No data available
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Feedback List Table */}
          <div
            className="rounded-xl p-6 border relative"
            style={{
              background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
              backdropFilter: 'blur(20px)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              zIndex: 10,
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ fontFamily: 'var(--font-headings)', fontWeight: 'bold', fontSize: '1.1rem' }}>
                Feedback List ({getDashboardFeedbacks.length})
              </h3>
              <button
                onClick={() => fetchFeedbacks()}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                    <th className="text-left py-3 px-2 font-semibold">ID</th>
                    <th className="text-left py-3 px-2 font-semibold">Author</th>
                    <th className="text-left py-3 px-2 font-semibold">Category</th>
                    <th className="text-left py-3 px-2 font-semibold">Status</th>
                    <th className="text-left py-3 px-2 font-semibold">Rating</th>
                    <th className="text-left py-3 px-2 font-semibold">Replied</th>
                    <th className="text-left py-3 px-2 font-semibold">Date</th>
                    <th className="text-left py-3 px-2 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {getDashboardFeedbacks.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-muted-foreground">
                        No feedbacks found matching your filters
                      </td>
                    </tr>
                  ) : (
                    getDashboardFeedbacks.slice(0, 20).map((fb) => (
                      <tr
                        key={fb.id}
                        className="border-b hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                        style={{ borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                        onClick={() => openDetailModal(fb)}
                      >
                        <td className="py-3 px-2 font-mono text-xs">{fb.id}</td>
                        <td className="py-3 px-2">
                          {fb.anonymous ? (
                            <span className="text-muted-foreground italic">Anonymous</span>
                          ) : (
                            fb.author
                          )}
                        </td>
                        <td className="py-3 px-2">
                          <span
                            className="px-2 py-0.5 rounded text-xs font-medium"
                            style={{
                              background: getCategoryColor(fb.category).bg,
                              color: getCategoryColor(fb.category).text,
                            }}
                          >
                            {fb.category}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <span
                            className="px-2 py-0.5 rounded text-xs font-medium"
                            style={{
                              background: getStatusColor(fb.status).bg,
                              color: getStatusColor(fb.status).text,
                            }}
                          >
                            {fb.status}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className="w-3 h-3"
                                fill={fb.rating >= star ? '#ee8724' : 'transparent'}
                                stroke={fb.rating >= star ? '#ee8724' : '#6b7280'}
                              />
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          {fb.reply ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-400" />
                          )}
                        </td>
                        <td className="py-3 px-2 text-muted-foreground text-xs">
                          {new Date(fb.timestamp).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openDetailModal(fb);
                            }}
                            className="px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-600 hover:bg-orange-200 transition-colors"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {getDashboardFeedbacks.length > 20 && (
                <p className="text-center text-sm text-muted-foreground mt-4">
                  Showing first 20 of {getDashboardFeedbacks.length} feedbacks. Use filters to narrow down results.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* REGULAR FEEDBACK VIEW */
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 relative z-10">
          {/* Top Horizontal Card - Submit Feedback Action */}
          <div 
            className="rounded-2xl p-6 mb-6 text-center"
            style={{
              background: isDark 
                ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)'
                : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.98) 100%)',
              border: isDark ? '2px solid rgba(238, 135, 36, 0.2)' : '2px solid rgba(238, 135, 36, 0.3)',
              boxShadow: isDark ? '0 8px 24px rgba(0, 0, 0, 0.4)' : '0 8px 24px rgba(0, 0, 0, 0.1)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
          >
            <ThumbsUp className={`w-14 h-14 mx-auto mb-4 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />
            <h2 
              style={{
                fontFamily: 'var(--font-headings)',
                fontSize: 'clamp(1.5rem, 3vw, 2rem)',
                fontWeight: 'var(--font-weight-bold)',
                letterSpacing: '-0.02em',
                color: isDark ? '#fff' : '#1e293b',
                marginBottom: '0.75rem'
              }}
            >
              Share Your Voice
            </h2>
            <p className={`max-w-2xl mx-auto mb-6 ${isDark ? 'text-gray-300' : 'text-gray-700'}`} style={{ fontWeight: '500', fontSize: '0.875rem', lineHeight: '1.6' }}>
              Help us improve by sharing your thoughts, suggestions, and experiences.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => setShowSubmitModal(true)}
                className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg text-white transition-all duration-300 hover:shadow-xl hover:scale-105 active:scale-95 inline-flex items-center gap-2 text-sm sm:text-base"
                style={{
                  background: 'linear-gradient(135deg, #f6421f 0%, #ee8724 100%)',
                  fontWeight: '600',
                  boxShadow: '0 4px 15px rgba(246, 66, 31, 0.35)'
                }}
              >
                <Send className="w-4 h-4" />
                <span className="hidden xs:inline">Submit Feedback</span>
                <span className="xs:hidden">Submit</span>
              </button>

              {/* Dashboard Button for Admin/Auditor */}
              {(isAdmin || userRole === 'auditor') && (
                <button
                  onClick={() => setShowDashboard(true)}
                  className="px-4 sm:px-5 py-2.5 sm:py-3 rounded-lg transition-all duration-300 hover:shadow-lg hover:scale-105 active:scale-95 inline-flex items-center gap-2 text-sm sm:text-base"
                  style={{
                    background: isDark ? 'rgba(238, 135, 36, 0.15)' : 'rgba(238, 135, 36, 0.1)',
                    border: '1.5px solid rgba(238, 135, 36, 0.4)',
                    color: '#ee8724',
                    fontWeight: '600',
                  }}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span className="hidden sm:inline">Dashboard</span>
                </button>
              )}
            </div>
          </div>

          {/* Two Vertical Cards - My Feedbacks & Public Feedbacks */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Card - My Feedbacks (or All Feedbacks for Admin/Auditor) */}
            <div 
              className="rounded-2xl p-6 flex flex-col"
              style={{
              background: isDark 
                ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)'
                : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.98) 100%)',
              border: isDark ? '2px solid rgba(238, 135, 36, 0.2)' : '2px solid rgba(238, 135, 36, 0.3)',
              boxShadow: isDark ? '0 8px 24px rgba(0, 0, 0, 0.4)' : '0 8px 24px rgba(0, 0, 0, 0.1)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              minHeight: '600px'
            }}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 
                className={isDark ? 'text-white' : 'text-gray-900'}
                style={{
                  fontFamily: 'var(--font-headings)',
                  fontSize: '1.375rem',
                  fontWeight: 'var(--font-weight-bold)',
                  letterSpacing: '-0.01em'
                }}
              >
                {isAdmin || userRole === 'auditor' ? 'All Feedbacks' : 'My Feedbacks'}
              </h3>
              <button
                onClick={handleRefreshMyFeedbacks}
                className="p-2.5 rounded-xl transition-all hover:scale-110 active:scale-95"
                style={{
                  background: isDark ? 'rgba(238, 135, 36, 0.15)' : 'rgba(238, 135, 36, 0.1)',
                  border: `2px solid ${isDark ? 'rgba(238, 135, 36, 0.3)' : 'rgba(238, 135, 36, 0.4)'}`,
                  color: '#ee8724'
                }}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Search Bar - Moved to Top */}
            <div className="relative mb-4">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by ID, name, keywords..."
                className="w-full pl-10 pr-4 py-3 rounded-xl border-2 transition-all duration-300 focus:outline-none"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.9)',
                  borderColor: isDark ? 'rgba(238, 135, 36, 0.3)' : 'rgba(238, 135, 36, 0.4)',
                  color: isDark ? '#fff' : '#1e293b'
                }}
              />
            </div>

            <div className="flex-1 space-y-4 max-h-[420px] overflow-y-auto pr-2">
              {isLoading ? (
                <>
                  <SkeletonCard />
                  <SkeletonCard />
                  <SkeletonCard />
                </>
              ) : myFeedbacks.length > 0 ? (
                myFeedbacks.map((feedback) => {
                  const statusColor = getStatusColor(feedback.status);
                  return (
                    <button
                      key={feedback.id}
                      onClick={() => openDetailModal(feedback)}
                      className="w-full text-left p-4 rounded-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"
                      style={{
                        background: isDark ? 'rgba(238, 135, 36, 0.1)' : 'rgba(238, 135, 36, 0.05)',
                        border: `1px solid ${isDark ? 'rgba(238, 135, 36, 0.2)' : 'rgba(238, 135, 36, 0.3)'}`,
                        minHeight: '120px',
                        maxHeight: '120px',
                        overflow: 'hidden'
                      }}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <div 
                            className="px-2 py-1 rounded text-xs"
                            style={{
                              background: getCategoryColor(feedback.category).bg,
                              border: `1px solid ${getCategoryColor(feedback.category).border}`,
                              color: getCategoryColor(feedback.category).text,
                              fontWeight: '600'
                            }}
                          >
                            {feedback.category}
                          </div>
                          <span className={`text-sm ${isDark ? 'text-orange-300' : 'text-orange-600'}`} style={{ fontWeight: '700' }}>
                            {feedback.id}
                          </span>
                        </div>
                        <div 
                          className="px-2 py-1 rounded text-xs"
                          style={{
                            background: statusColor.bg,
                            border: `1px solid ${statusColor.border}`,
                            color: statusColor.text,
                            fontWeight: '600'
                          }}
                        >
                          {feedback.status}
                        </div>
                      </div>

                      <p className={`text-sm mb-2 line-clamp-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`} style={{ fontWeight: '500' }}>
                        {feedback.feedback}
                      </p>

                      <div className="flex items-center justify-between">
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className="w-3 h-3"
                              fill={feedback.rating >= star ? '#ee8724' : 'transparent'}
                              stroke={feedback.rating >= star ? '#ee8724' : '#6b7280'}
                              strokeWidth={2}
                            />
                          ))}
                        </div>
                        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`} style={{ fontWeight: '500' }}>
                          {new Date(feedback.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="text-center py-12">
                  <AlertCircle className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                  <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`} style={{ fontWeight: '500' }}>
                    {searchQuery ? 'No matching feedbacks found.' : 'No feedbacks yet.'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Card - Public Feedbacks (Dark Theme) */}
          <div 
            className="rounded-2xl p-6"
            style={{
              background: 'linear-gradient(135deg, rgba(17, 24, 39, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
              border: '2px solid rgba(238, 135, 36, 0.2)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              minHeight: '600px'
            }}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 
                className="text-white"
                style={{
                  fontFamily: 'var(--font-headings)',
                  fontSize: '1.375rem',
                  fontWeight: 'var(--font-weight-bold)',
                  letterSpacing: '-0.01em'
                }}
              >
                Public Feedbacks
              </h3>
              <button
                onClick={handleRefreshPublicFeedbacks}
                className="p-2.5 rounded-xl transition-all hover:scale-110 active:scale-95"
                style={{
                  background: 'rgba(238, 135, 36, 0.15)',
                  border: '2px solid rgba(238, 135, 36, 0.3)',
                  color: '#ee8724'
                }}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 max-h-[520px] overflow-y-auto pr-2">
              {isLoading ? (
                <>
                  <SkeletonCard />
                  <SkeletonCard />
                  <SkeletonCard />
                </>
              ) : publicFeedbacks.length > 0 ? (
                publicFeedbacks.map((feedback) => {
                  const statusColor = getStatusColor(feedback.status);
                  return (
                    <button
                      key={feedback.id}
                      onClick={() => openDetailModal(feedback)}
                      className="w-full text-left p-4 rounded-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"
                      style={{
                        background: 'rgba(238, 135, 36, 0.1)',
                        border: '1px solid rgba(238, 135, 36, 0.2)',
                        minHeight: '120px',
                        maxHeight: '120px',
                        overflow: 'hidden'
                      }}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <div 
                            className="px-2 py-1 rounded text-xs"
                            style={{
                              background: getCategoryColor(feedback.category).bg,
                              border: `1px solid ${getCategoryColor(feedback.category).border}`,
                              color: getCategoryColor(feedback.category).text,
                              fontWeight: '600'
                            }}
                          >
                            {feedback.category}
                          </div>
                          <span className="text-white" style={{ fontWeight: '700' }}>
                            {feedback.anonymous ? 'Anonymous' : feedback.author}
                          </span>
                        </div>
                        <div 
                          className="px-2 py-1 rounded text-xs"
                          style={{
                            background: statusColor.bg,
                            border: `1px solid ${statusColor.border}`,
                            color: statusColor.text,
                            fontWeight: '600'
                          }}
                        >
                          {feedback.status}
                        </div>
                      </div>

                      <p className="text-gray-300 text-sm mb-2 line-clamp-2" style={{ fontWeight: '500' }}>
                        {feedback.feedback}
                      </p>

                      <div className="flex items-center justify-between">
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className="w-3 h-3"
                              fill={feedback.rating >= star ? '#ee8724' : 'transparent'}
                              stroke={feedback.rating >= star ? '#ee8724' : '#6b7280'}
                              strokeWidth={2}
                            />
                          ))}
                        </div>
                        <span className="text-gray-400 text-xs" style={{ fontWeight: '500' }}>
                          {new Date(feedback.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="text-center py-12">
                  <AlertCircle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400" style={{ fontWeight: '500' }}>
                    No public feedbacks yet.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Submit Feedback Modal */}
      {showSubmitModal && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            style={{ zIndex: 9999991 }}
            onClick={() => {
              // Clear form when closing modal
              setFormData({
                author: '',
                email: '',
                rating: 0,
                category: 'Other',
                feedback: '',
                anonymous: false,
                preferPrivate: false
              });
              setUploadedImages([]);
              setShowSubmitModal(false);
            }}
          />
          <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 9999992 }}>
            <div 
              className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl"
              style={{
                background: isDark ? 'rgba(15, 23, 42, 0.98)' : 'rgba(255, 255, 255, 0.98)',
                border: '2px solid rgba(238, 135, 36, 0.3)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
              }}
            >
              <div className="flex-shrink-0 p-4 sm:p-6 border-b flex items-center justify-between"
                style={{
                  background: isDark ? 'rgba(15, 23, 42, 0.98)' : 'rgba(255, 255, 255, 0.98)',
                  backdropFilter: 'blur(20px)',
                  borderColor: isDark ? 'rgba(238, 135, 36, 0.2)' : 'rgba(238, 135, 36, 0.3)',
                }}
              >
                <h3 
                  className={isDark ? 'text-white' : 'text-gray-900'}
                  style={{
                    fontFamily: 'var(--font-headings)',
                    fontSize: '1.5rem',
                    fontWeight: 'var(--font-weight-bold)',
                  }}
                >
                  Submit Feedback
                </h3>
                <button
                  onClick={() => {
                    // Clear form when closing modal
                    setFormData({
                      author: '',
                      email: '',
                      rating: 0,
                      category: 'Other',
                      feedback: '',
                      anonymous: false,
                      preferPrivate: false
                    });
                    setUploadedImages([]);
                    setShowSubmitModal(false);
                  }}
                  className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
                {/* Anonymous Toggle */}
                <div className="flex items-center gap-3 p-4 rounded-xl" style={{
                  background: isDark ? 'rgba(238, 135, 36, 0.1)' : 'rgba(238, 135, 36, 0.05)',
                  border: `1px solid ${isDark ? 'rgba(238, 135, 36, 0.2)' : 'rgba(238, 135, 36, 0.3)'}`
                }}>
                  <input
                    type="checkbox"
                    id="anonymous"
                    checked={formData.anonymous}
                    onChange={(e) => setFormData({ ...formData, anonymous: e.target.checked })}
                    className="w-5 h-5 rounded accent-orange-500"
                  />
                  <label htmlFor="anonymous" className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`} style={{ fontWeight: '600' }}>
                    Stay Anonymous
                  </label>
                </div>

                {/* Name (conditional) */}
                {!formData.anonymous && (
                  <div>
                    <label className={`block mb-2 text-sm ${isDark ? 'text-white' : 'text-gray-900'}`} style={{ fontWeight: '600' }}>
                      Your Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.author}
                      onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                      placeholder="Enter your name"
                      className="w-full px-4 py-3 rounded-xl border-2 transition-all duration-300 focus:outline-none"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.9)',
                        borderColor: isDark ? 'rgba(238, 135, 36, 0.3)' : 'rgba(238, 135, 36, 0.4)',
                        color: isDark ? '#fff' : '#1e293b'
                      }}
                    />
                  </div>
                )}

                {/* Email (optional) */}
                <div>
                  <label className={`block mb-2 text-sm ${isDark ? 'text-white' : 'text-gray-900'}`} style={{ fontWeight: '600' }}>
                    Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="your.email@example.com"
                    className="w-full px-4 py-3 rounded-xl border-2 transition-all duration-300 focus:outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.9)',
                      borderColor: isDark ? 'rgba(238, 135, 36, 0.3)' : 'rgba(238, 135, 36, 0.4)',
                      color: isDark ? '#fff' : '#1e293b'
                    }}
                  />
                </div>

                {/* Rating */}
                <div>
                  <label className={`block mb-2 text-sm ${isDark ? 'text-white' : 'text-gray-900'}`} style={{ fontWeight: '600' }}>
                    Rating <span className="text-red-400">*</span>
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFormData({ ...formData, rating: star })}
                        onMouseEnter={() => setHoveredRating(star)}
                        onMouseLeave={() => setHoveredRating(0)}
                        className="transition-all duration-300 hover:scale-125 active:scale-95"
                      >
                        <Star
                          className="w-8 h-8"
                          fill={(hoveredRating || formData.rating) >= star ? '#ee8724' : 'transparent'}
                          stroke={(hoveredRating || formData.rating) >= star ? '#ee8724' : '#6b7280'}
                          strokeWidth={2}
                        />
                      </button>
                    ))}
                    {formData.rating > 0 && (
                      <span className="ml-2 text-orange-400 self-center" style={{ fontWeight: '700' }}>
                        {formData.rating}/5
                      </span>
                    )}
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label className={`block mb-2 text-sm ${isDark ? 'text-white' : 'text-gray-900'}`} style={{ fontWeight: '600' }}>
                    Category <span className="text-red-400">*</span>
                  </label>
                  <CustomDropdown
                    value={formData.category}
                    onChange={(value) => setFormData({ ...formData, category: value as Feedback['category'] })}
                    options={categories}
                    isDark={isDark}
                    size="md"
                  />
                </div>

                {/* Feedback Text */}
                <div>
                  <label className={`block mb-2 text-sm ${isDark ? 'text-white' : 'text-gray-900'}`} style={{ fontWeight: '600' }}>
                    Your Feedback <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={formData.feedback}
                    onChange={(e) => setFormData({ ...formData, feedback: e.target.value })}
                    placeholder="Share your thoughts, suggestions, or concerns..."
                    rows={5}
                    className="w-full px-4 py-3 rounded-xl border-2 transition-all duration-300 focus:outline-none resize-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.9)',
                      borderColor: isDark ? 'rgba(238, 135, 36, 0.3)' : 'rgba(238, 135, 36, 0.4)',
                      color: isDark ? '#fff' : '#1e293b'
                    }}
                    required
                  />
                </div>

                {/* Image Upload with Preview */}
                <div>
                  <label className={`block mb-2 text-sm ${isDark ? 'text-white' : 'text-gray-900'}`} style={{ fontWeight: '600' }}>
                    Attach Images (Optional - Max 3, 10MB each, .jpg/.png only)
                  </label>
                  
                  {uploadedImages.length < 3 && (
                    <label 
                      className="flex items-center gap-2 px-4 py-3 rounded-xl cursor-pointer transition-all hover:scale-105 w-fit"
                      style={{
                        background: isDark ? 'rgba(238, 135, 36, 0.2)' : 'rgba(238, 135, 36, 0.1)',
                        border: `1px solid ${isDark ? 'rgba(238, 135, 36, 0.3)' : 'rgba(238, 135, 36, 0.4)'}`,
                        color: '#ee8724',
                        fontWeight: '600'
                      }}
                    >
                      <Upload className="w-5 h-5" />
                      Upload Images ({uploadedImages.length}/3)
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png"
                        multiple
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  )}

                  {/* Image Previews */}
                  {uploadedImages.length > 0 && (
                    <div className="grid grid-cols-3 gap-3 mt-3">
                      {uploadedImages.map((image, index) => (
                        <div key={index} className="relative">
                          <img
                            src={image.preview}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-32 object-cover rounded-xl"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg transition-all hover:scale-110 shadow-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Prefer Private Option */}
                <div className="flex items-center gap-3 p-4 rounded-xl" style={{
                  background: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)',
                  border: `1px solid ${isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.3)'}`
                }}>
                  <input
                    type="checkbox"
                    id="preferPrivate"
                    checked={formData.preferPrivate}
                    onChange={(e) => setFormData({ ...formData, preferPrivate: e.target.checked })}
                    className="w-5 h-5 rounded accent-blue-500"
                  />
                  <label htmlFor="preferPrivate" className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`} style={{ fontWeight: '600' }}>
                    I prefer to keep my feedback private
                  </label>
                </div>
                </div>

                {/* Action Buttons - Fixed Footer */}
                <div 
                  className="flex-shrink-0 flex gap-3 p-4 sm:p-6 border-t"
                  style={{
                    background: isDark ? 'rgba(15, 23, 42, 0.98)' : 'rgba(255, 255, 255, 0.98)',
                    borderColor: isDark ? 'rgba(238, 135, 36, 0.2)' : 'rgba(238, 135, 36, 0.3)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      // Clear form when closing modal
                      setFormData({
                        author: '',
                        email: '',
                        rating: 0,
                        category: 'Other',
                        feedback: '',
                        anonymous: false,
                        preferPrivate: false
                      });
                      setUploadedImages([]);
                      setShowSubmitModal(false);
                    }}
                    className="flex-1 py-2.5 rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-95"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                      border: `2px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                      color: isDark ? '#fff' : '#1e293b',
                      fontWeight: '600',
                      fontSize: '0.875rem'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 py-2.5 rounded-xl text-white transition-all duration-300 hover:shadow-xl hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: 'linear-gradient(135deg, #f6421f 0%, #ee8724 100%)',
                      fontWeight: '600',
                      fontSize: '0.875rem',
                      boxShadow: '0 4px 12px rgba(246, 66, 31, 0.3)'
                    }}
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Submit</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Feedback ID Modal (for guests) */}
      {showFeedbackIdModal && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            style={{ zIndex: 9999991 }}
            onClick={() => setShowFeedbackIdModal(false)}
          />
          <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 9999992 }}>
            <div 
              className="w-full max-w-md rounded-2xl p-6 text-center"
              style={{
                background: isDark ? 'rgba(15, 23, 42, 0.98)' : 'rgba(255, 255, 255, 0.98)',
                border: '2px solid rgba(34, 197, 94, 0.5)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                boxShadow: '0 8px 32px rgba(34, 197, 94, 0.3)'
              }}
            >
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              
              <h3 
                className={`mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}
                style={{
                  fontFamily: 'var(--font-headings)',
                  fontSize: '1.5rem',
                  fontWeight: 'var(--font-weight-bold)',
                }}
              >
                Feedback Submitted!
              </h3>

              <p className={`mb-6 ${isDark ? 'text-gray-300' : 'text-gray-700'}`} style={{ fontWeight: '500' }}>
                Save your Feedback ID to track the status of your feedback.
              </p>

              <div 
                className="p-4 rounded-xl mb-6"
                style={{
                  background: isDark ? 'rgba(238, 135, 36, 0.1)' : 'rgba(238, 135, 36, 0.05)',
                  border: `2px solid ${isDark ? 'rgba(238, 135, 36, 0.3)' : 'rgba(238, 135, 36, 0.4)'}`
                }}
              >
                <p className={`text-xs mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} style={{ fontWeight: '600' }}>
                  YOUR FEEDBACK ID
                </p>
                <div className="flex items-center justify-center gap-3">
                  <p 
                    className={`text-xl ${isDark ? 'text-orange-400' : 'text-orange-600'}`}
                    style={{ fontFamily: 'monospace', fontWeight: '700' }}
                  >
                    {newFeedbackId}
                  </p>
                  <button
                    onClick={() => copyToClipboard(newFeedbackId)}
                    className="p-2 rounded-lg transition-all hover:scale-110 active:scale-95"
                    style={{
                      background: isDark ? 'rgba(238, 135, 36, 0.2)' : 'rgba(238, 135, 36, 0.1)',
                      border: `1px solid ${isDark ? 'rgba(238, 135, 36, 0.3)' : 'rgba(238, 135, 36, 0.4)'}`,
                      color: '#ee8724'
                    }}
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div 
                className="p-4 rounded-xl mb-6 border-2" 
                style={{
                  background: isDark ? 'rgba(251, 191, 36, 0.1)' : 'rgba(251, 191, 36, 0.05)',
                  borderColor: isDark ? 'rgba(251, 191, 36, 0.3)' : 'rgba(251, 191, 36, 0.4)'
                }}
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`} />
                  <p className={`text-sm ${isDark ? 'text-yellow-300' : 'text-yellow-800'}`} style={{ fontWeight: '500', lineHeight: '1.5' }}>
                    <span style={{ fontWeight: '700' }}>Important:</span> Your feedback will disappear from "My Feedbacks" when you refresh the page. Use the search bar with your Feedback ID to find it again.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowFeedbackIdModal(false)}
                className="w-full py-3.5 rounded-xl text-white transition-all duration-300 hover:shadow-2xl hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #f6421f 0%, #ee8724 100%)',
                  fontWeight: '700',
                  fontSize: '1rem',
                  boxShadow: '0 8px 20px rgba(246, 66, 31, 0.4)'
                }}
              >
                <CheckCircle className="w-5 h-5" />
                <span>Got it!</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedFeedback && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            style={{ zIndex: 9999991 }}
            onClick={() => { setShowDetailModal(false); setConfirmingDelete(false); }}
          />
          <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 9999992 }}>
            <div 
              className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl"
              style={{
                background: isDark ? 'rgba(15, 23, 42, 0.98)' : 'rgba(255, 255, 255, 0.98)',
                border: '2px solid rgba(238, 135, 36, 0.3)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
              }}
            >
              <div className="sticky top-0 p-6 border-b flex items-center justify-between"
                style={{
                  background: isDark ? 'rgba(15, 23, 42, 0.98)' : 'rgba(255, 255, 255, 0.98)',
                  backdropFilter: 'blur(20px)',
                  borderColor: isDark ? 'rgba(238, 135, 36, 0.2)' : 'rgba(238, 135, 36, 0.3)',
                  zIndex: 20
                }}
              >
                <div>
                  <h3 
                    className={isDark ? 'text-white' : 'text-gray-900'}
                    style={{
                      fontFamily: 'var(--font-headings)',
                      fontSize: '1.5rem',
                      fontWeight: 'var(--font-weight-bold)',
                    }}
                  >
                    Feedback Details
                  </h3>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`} style={{ fontWeight: '500' }}>
                    ID: {selectedFeedback.id}
                  </p>
                </div>
                <button
                  onClick={() => { setShowDetailModal(false); setConfirmingDelete(false); }}
                  className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Author Info */}
                <div className="flex items-center gap-4 p-4 rounded-xl" style={{
                  background: isDark ? 'rgba(238, 135, 36, 0.1)' : 'rgba(238, 135, 36, 0.05)',
                  border: `1px solid ${isDark ? 'rgba(238, 135, 36, 0.2)' : 'rgba(238, 135, 36, 0.3)'}`
                }}>
                  <User className="w-12 h-12 text-orange-500" />
                  <div>
                    <p className={`${isDark ? 'text-white' : 'text-gray-900'}`} style={{ fontWeight: '700' }}>
                      {selectedFeedback.author}
                    </p>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`} style={{ fontWeight: '500' }}>
                      {selectedFeedback.authorId}
                    </p>
                    {selectedFeedback.email && (
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`} style={{ fontWeight: '500' }}>
                        {selectedFeedback.email}
                      </p>
                    )}
                  </div>
                </div>

                {/* Status & Category - Editable for Admin/Auditor */}
                <div className="flex gap-4">
                  <div className="flex-1">
                    <p className={`text-sm mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} style={{ fontWeight: '600' }}>
                      Status {(isAdmin || userRole === 'auditor') && <span className="text-orange-500">*</span>}
                    </p>
                    {(isAdmin || userRole === 'auditor') && editingFeedback ? (
                      <CustomDropdown
                        value={editingFeedback.status}
                        onChange={(value) => setEditingFeedback({ ...editingFeedback, status: value as Feedback['status'] })}
                        options={[
                          { value: "Pending", label: "Pending" },
                          { value: "Reviewed", label: "Reviewed" },
                          { value: "Resolved", label: "Resolved" },
                          { value: "Dropped", label: "Dropped" },
                        ]}
                        isDark={isDark}
                        size="md"
                      />
                    ) : (
                      <div 
                        className="p-4 rounded-xl"
                        style={{
                          background: getStatusColor(selectedFeedback.status).bg,
                          border: `1px solid ${getStatusColor(selectedFeedback.status).border}`
                        }}
                      >
                        <p style={{ color: getStatusColor(selectedFeedback.status).text, fontWeight: '700' }}>
                          {selectedFeedback.status}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} style={{ fontWeight: '600' }}>
                      Category
                    </p>
                    <div 
                      className="p-4 rounded-xl"
                      style={{
                        background: getCategoryColor(selectedFeedback.category).bg,
                        border: `1px solid ${getCategoryColor(selectedFeedback.category).border}`
                      }}
                    >
                      <p style={{ color: getCategoryColor(selectedFeedback.category).text, fontWeight: '700' }}>
                        {selectedFeedback.category}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Rating & Timestamp */}
                <div className="flex gap-4">
                  <div className="flex-1">
                    <p className={`text-sm mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} style={{ fontWeight: '600' }}>Rating</p>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className="w-5 h-5"
                          fill={selectedFeedback.rating >= star ? '#ee8724' : 'transparent'}
                          stroke={selectedFeedback.rating >= star ? '#ee8724' : '#6b7280'}
                          strokeWidth={2}
                        />
                      ))}
                      <span className="ml-2 text-orange-400" style={{ fontWeight: '700' }}>
                        {selectedFeedback.rating}/5
                      </span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} style={{ fontWeight: '600' }}>Submitted</p>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-orange-500" />
                      <span className={isDark ? 'text-white' : 'text-gray-900'} style={{ fontWeight: '500' }}>
                        {new Date(selectedFeedback.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Feedback Content */}
                <div>
                  <p className={`text-sm mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} style={{ fontWeight: '600' }}>Feedback</p>
                  <div className="p-4 rounded-xl" style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                  }}>
                    <p className={isDark ? 'text-gray-200' : 'text-gray-800'} style={{ fontWeight: '500', lineHeight: '1.6' }}>
                      {selectedFeedback.feedback}
                    </p>
                  </div>
                </div>

                {/* Image(s) */}
                {selectedFeedback.imageUrl && (
                  <div>
                    <p className={`text-sm mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} style={{ fontWeight: '600' }}>
                      Attachment{selectedFeedback.imageUrl.includes(',') ? 's' : ''}
                    </p>
                    <div className={`grid gap-3 ${selectedFeedback.imageUrl.split(',').length > 1 ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-1'}`}>
                      {selectedFeedback.imageUrl.split(',').map((url, idx) => (
                        <ImageWithFallback
                          key={idx}
                          src={url.trim()}
                          alt={`Feedback attachment ${idx + 1}`}
                          className="w-full rounded-xl max-h-64 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => window.open(url.trim(), '_blank')}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Admin Reply Section */}
                {(isAdmin || userRole === 'auditor') ? (
                  <div>
                    <p className={`text-sm mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} style={{ fontWeight: '600' }}>
                      Admin Reply
                    </p>
                    <textarea
                      value={adminReply}
                      onChange={(e) => setAdminReply(e.target.value)}
                      placeholder="Write a reply to this feedback..."
                      rows={4}
                      className="w-full px-4 py-3 rounded-xl border-2 transition-all duration-300 focus:outline-none resize-none"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.9)',
                        borderColor: isDark ? 'rgba(238, 135, 36, 0.3)' : 'rgba(238, 135, 36, 0.4)',
                        color: isDark ? '#fff' : '#1e293b'
                      }}
                    />
                    {selectedFeedback.reply && selectedFeedback.replyTimestamp && (
                      <p className={`text-xs mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} style={{ fontWeight: '500' }}>
                        Last reply by {selectedFeedback.replier} on {new Date(selectedFeedback.replyTimestamp).toLocaleString()}
                      </p>
                    )}
                  </div>
                ) : (
                  selectedFeedback.reply && (
                    <div className="p-4 rounded-xl" style={{
                      background: isDark ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.05)',
                      border: `1px solid ${isDark ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.3)'}`
                    }}>
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <p className={`${isDark ? 'text-green-400' : 'text-green-600'}`} style={{ fontWeight: '700' }}>
                          Admin Reply
                        </p>
                      </div>
                      <p className={`text-sm mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`} style={{ fontWeight: '500' }}>
                        {selectedFeedback.reply}
                      </p>
                      <div className="flex items-center gap-4 text-xs mt-3">
                        <span className={isDark ? 'text-gray-400' : 'text-gray-600'} style={{ fontWeight: '500' }}>
                          Replied by: {selectedFeedback.replier}
                        </span>
                        {selectedFeedback.replyTimestamp && (
                          <span className={isDark ? 'text-gray-400' : 'text-gray-600'} style={{ fontWeight: '500' }}>
                            {new Date(selectedFeedback.replyTimestamp).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                )}

                {/* Visibility Control - Admin/Auditor Only */}
                {(isAdmin || userRole === 'auditor') && editingFeedback ? (
                  <div>
                    <p className={`text-sm mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} style={{ fontWeight: '600' }}>
                      Visibility {(isAdmin || userRole === 'auditor') && <span className="text-orange-500">*</span>}
                    </p>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="visibility"
                          value="Public"
                          checked={editingFeedback.visibility === 'Public'}
                          onChange={(e) => setEditingFeedback({ ...editingFeedback, visibility: e.target.value as 'Public' | 'Private' })}
                          className="w-5 h-5 accent-orange-500"
                        />
                        <span className={`${isDark ? 'text-gray-300' : 'text-gray-700'}`} style={{ fontWeight: '500' }}>Public</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="visibility"
                          value="Private"
                          checked={editingFeedback.visibility === 'Private'}
                          onChange={(e) => setEditingFeedback({ ...editingFeedback, visibility: e.target.value as 'Public' | 'Private' })}
                          className="w-5 h-5 accent-orange-500"
                        />
                        <span className={`${isDark ? 'text-gray-300' : 'text-gray-700'}`} style={{ fontWeight: '500' }}>Private</span>
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Eye className="w-5 h-5 text-gray-500" />
                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`} style={{ fontWeight: '500' }}>
                      Visibility: {selectedFeedback.visibility}
                    </span>
                  </div>
                )}

                {/* Admin Action Buttons */}
                {(isAdmin || userRole === 'auditor') && (
                  <div className="flex flex-col gap-3 pt-6 mt-6 border-t" style={{ borderColor: isDark ? 'rgba(238, 135, 36, 0.2)' : 'rgba(238, 135, 36, 0.3)' }}>
                    <div className="flex gap-3">
                      <button
                        onClick={() => { setShowDetailModal(false); setConfirmingDelete(false); }}
                        className="flex-1 py-2.5 rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-95"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                          border: `2px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                          color: isDark ? '#fff' : '#1e293b',
                          fontWeight: '600',
                          fontSize: '0.875rem'
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleUpdateFeedback}
                        disabled={isLoading}
                        className="flex-1 py-2.5 rounded-xl text-white transition-all duration-300 hover:shadow-xl hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                        style={{
                          background: 'linear-gradient(135deg, #f6421f 0%, #ee8724 100%)',
                          fontWeight: '600',
                          fontSize: '0.875rem',
                          boxShadow: '0 4px 12px rgba(246, 66, 31, 0.3)'
                        }}
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Save</span>
                      </button>
                    </div>
                    {/* Delete Button with Inline Confirmation */}
                    {confirmingDelete ? (
                      <div className="flex gap-3">
                        <button
                          onClick={() => setConfirmingDelete(false)}
                          disabled={isLoading}
                          className="flex-1 py-2.5 rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
                          style={{
                            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                            border: `2px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                            color: isDark ? '#fff' : '#1e293b',
                            fontWeight: '600',
                            fontSize: '0.875rem'
                          }}
                        >
                          <X className="w-4 h-4" />
                          <span>Cancel</span>
                        </button>
                        <button
                          onClick={handleDeleteFeedback}
                          disabled={isLoading}
                          className="flex-1 py-2.5 rounded-xl text-white transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                          style={{
                            background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
                            fontWeight: '600',
                            fontSize: '0.875rem',
                            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)'
                          }}
                        >
                          {isLoading ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              <span>Deleting...</span>
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-4 h-4" />
                              <span>Yes, Delete</span>
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleDeleteFeedback}
                        disabled={isLoading}
                        className="w-full py-2.5 rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                        style={{
                          background: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                          border: `2px solid ${isDark ? 'rgba(239, 68, 68, 0.4)' : 'rgba(239, 68, 68, 0.5)'}`,
                          color: '#ef4444',
                          fontWeight: '600',
                          fontSize: '0.875rem'
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Delete Feedback</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          style={{ zIndex: 9999993 }}
          onClick={handleCloseExportModal}
        >
          <div
            className="rounded-xl w-full border flex flex-col overflow-hidden shadow-2xl"
            style={{
              maxWidth: exportModalTab === 'preview' && exportFormat === 'pdf' ? 900 : 600,
              maxHeight: '90vh',
              background: isDark ? 'rgba(17, 24, 39, 0.98)' : 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(20px)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              transition: 'max-width 0.3s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Tab Navigation */}
            <div 
              className="shrink-0"
              style={{
                background: DESIGN_TOKENS.colors.brand.orange,
              }}
            >
              <div className="px-5 py-4 flex items-center justify-between">
                <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                  {exportFormat === 'pdf' ? <FileText className="w-5 h-5" /> : <Download className="w-5 h-5" />}
                  Export Feedback Data
                </h3>
                <button
                  onClick={handleCloseExportModal}
                  className="p-1.5 rounded-lg hover:bg-white/20 transition-colors text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Tab Buttons */}
              <div className="px-5 pb-2 flex gap-2">
                <button
                  onClick={() => setExportModalTab('preview')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    exportModalTab === 'preview'
                      ? 'bg-white text-[#f6421f] shadow-lg'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  Preview
                </button>
                <button
                  onClick={() => setExportModalTab('settings')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    exportModalTab === 'settings'
                      ? 'bg-white text-[#f6421f] shadow-lg'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </button>
              </div>

              {/* Subtitle under tabs */}
              <div className="px-5 pb-3">
                <p className="text-white/80 text-sm">
                  {getDashboardFeedbacks.length} feedbacks to export
                </p>
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Tab 1: Preview */}
              {exportModalTab === 'preview' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Preview Toolbar */}
                  <div 
                    className="px-4 py-2 border-b flex items-center justify-between shrink-0"
                    style={{ 
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                      background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
                    }}
                  >
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground">
                        {exportFormat === 'pdf' ? 'PDF Preview' : 'Spreadsheet Export'}
                      </span>
                    </div>
                    {exportFormat === 'pdf' && (
                      <button
                        onClick={() => generatePDFPreview()}
                        disabled={isGeneratingPreview}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className={`w-4 h-4 ${isGeneratingPreview ? 'animate-spin' : ''}`} />
                        Refresh
                      </button>
                    )}
                  </div>
                  
                  {/* Preview Content */}
                  <div className="flex-1 bg-gray-200 dark:bg-gray-900 overflow-hidden relative">
                    {exportFormat === 'pdf' ? (
                      isGeneratingPreview ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                          <RefreshCw className="w-10 h-10 animate-spin text-[#f6421f]" />
                          <div className="text-center">
                            <p className="font-medium">Generating Preview...</p>
                            <p className="text-sm text-muted-foreground">This may take a moment</p>
                          </div>
                        </div>
                      ) : pdfPreviewUrl ? (
                        <iframe
                          src={pdfPreviewUrl}
                          className="w-full h-full"
                          style={{ minHeight: 450 }}
                          title="PDF Preview"
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center p-8">
                          <FileText className="w-16 h-16 text-muted-foreground/50" />
                          <div>
                            <p className="font-medium">No Preview Available</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              Click Refresh or configure settings first
                            </p>
                          </div>
                          <button
                            onClick={() => generatePDFPreview()}
                            className="mt-2 px-4 py-2 rounded-lg bg-[#f6421f] text-white hover:bg-[#d93819] transition-colors text-sm"
                          >
                            Generate Preview
                          </button>
                        </div>
                      )
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center p-8">
                        <FileSpreadsheet className="w-16 h-16 text-green-500/50" />
                        <div>
                          <p className="font-medium">Spreadsheet Export</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Configure your export settings then click Export
                          </p>
                        </div>
                        <button
                          onClick={() => setExportModalTab('settings')}
                          className="mt-2 px-4 py-2 rounded-lg bg-[#f6421f] text-white hover:bg-[#d93819] transition-colors text-sm"
                        >
                          Go to Settings
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 2: Settings */}
              {exportModalTab === 'settings' && (
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                  {/* Export Format */}
                  <div>
                    <h4 className="font-semibold mb-3">Export Format</h4>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setExportFormat('pdf')}
                        className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                          exportFormat === 'pdf'
                            ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                            : 'border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <FileText className={`w-8 h-8 mx-auto mb-2 ${exportFormat === 'pdf' ? 'text-orange-500' : 'text-gray-400'}`} />
                        <p className="text-center font-medium">PDF</p>
                        <p className="text-xs text-center text-muted-foreground">Print-ready document</p>
                      </button>
                      <button
                        onClick={() => setExportFormat('spreadsheet')}
                        className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                          exportFormat === 'spreadsheet'
                            ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                            : 'border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <FileSpreadsheet className={`w-8 h-8 mx-auto mb-2 ${exportFormat === 'spreadsheet' ? 'text-orange-500' : 'text-gray-400'}`} />
                        <p className="text-center font-medium">Spreadsheet</p>
                        <p className="text-xs text-center text-muted-foreground">Excel-compatible format</p>
                      </button>
                    </div>
                  </div>

                  {/* Content Options */}
                  <div>
                    <h4 className="font-semibold mb-3">Content Options</h4>
                    <div className="space-y-4">
                      {/* Date Range Settings */}
                      <div className="p-3 rounded-lg border" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                        <p className="text-sm font-medium mb-2">Report Period</p>
                        <div className="flex gap-3">
                          <div className="flex-1">
                            <label className="block text-xs text-muted-foreground mb-1">Start Date</label>
                            <input
                              type="date"
                              value={exportOptions.dateRange.start}
                              onChange={(e) => setExportOptions({
                                ...exportOptions,
                                dateRange: { ...exportOptions.dateRange, start: e.target.value }
                              })}
                              className="w-full px-3 py-2 rounded-lg border text-sm bg-transparent"
                              style={{ borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }}
                            />
                          </div>
                          <div className="flex-1">
                            <label className="block text-xs text-muted-foreground mb-1">End Date</label>
                            <input
                              type="date"
                              value={exportOptions.dateRange.end}
                              onChange={(e) => setExportOptions({
                                ...exportOptions,
                                dateRange: { ...exportOptions.dateRange, end: e.target.value }
                              })}
                              className="w-full px-3 py-2 rounded-lg border text-sm bg-transparent"
                              style={{ borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          style={{
                            background: exportOptions.includeStatistics 
                              ? (isDark ? 'rgba(246,66,31,0.1)' : 'rgba(246,66,31,0.05)')
                              : 'transparent',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={exportOptions.includeStatistics}
                            onChange={(e) => setExportOptions({ ...exportOptions, includeStatistics: e.target.checked })}
                            className="w-4 h-4 rounded accent-[#f6421f]"
                          />
                          <div className="flex-1">
                            <span className="font-medium">Include Statistics Summary</span>
                            <p className="text-xs text-muted-foreground">Total, pending, reviewed counts and average rating</p>
                          </div>
                        </label>

                        <label className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          style={{
                            background: exportOptions.includeCharts 
                              ? (isDark ? 'rgba(246,66,31,0.1)' : 'rgba(246,66,31,0.05)')
                              : 'transparent',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={exportOptions.includeCharts}
                            onChange={(e) => setExportOptions({ ...exportOptions, includeCharts: e.target.checked })}
                            className="w-4 h-4 rounded accent-[#f6421f]"
                          />
                          <div className="flex-1">
                            <span className="font-medium">Include Charts</span>
                            <p className="text-xs text-muted-foreground">Visual representation of data (PDF only)</p>
                          </div>
                        </label>

                        <label className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          style={{
                            background: exportOptions.showEmptyTables 
                              ? (isDark ? 'rgba(246,66,31,0.1)' : 'rgba(246,66,31,0.05)')
                              : 'transparent',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={exportOptions.showEmptyTables}
                            onChange={(e) => setExportOptions({ ...exportOptions, showEmptyTables: e.target.checked })}
                            className="w-4 h-4 rounded accent-[#f6421f]"
                          />
                          <div className="flex-1">
                            <span className="font-medium">Show Empty Tables</span>
                            <p className="text-xs text-muted-foreground">Display status/category tables even if they have no data</p>
                          </div>
                        </label>
                        
                        <label className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          style={{
                            background: exportOptions.showStatusTables 
                              ? (isDark ? 'rgba(246,66,31,0.1)' : 'rgba(246,66,31,0.05)')
                              : 'transparent',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={exportOptions.showStatusTables}
                            onChange={(e) => setExportOptions({ ...exportOptions, showStatusTables: e.target.checked })}
                            className="w-4 h-4 rounded accent-[#f6421f]"
                          />
                          <div className="flex-1">
                            <span className="font-medium">Show Status Tables</span>
                            <p className="text-xs text-muted-foreground">Include individual tables for each status (Pending, Resolved, etc.)</p>
                          </div>
                        </label>

                        <label className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          style={{
                            background: exportOptions.showCategoryTables 
                              ? (isDark ? 'rgba(246,66,31,0.1)' : 'rgba(246,66,31,0.05)')
                              : 'transparent',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={exportOptions.showCategoryTables}
                            onChange={(e) => setExportOptions({ ...exportOptions, showCategoryTables: e.target.checked })}
                            className="w-4 h-4 rounded accent-[#f6421f]"
                          />
                          <div className="flex-1">
                            <span className="font-medium">Show Category Tables</span>
                            <p className="text-xs text-muted-foreground">Include individual tables for each category (Bug, Suggestion, etc.)</p>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Privacy Options */}
                  <div>
                    <h4 className="font-semibold mb-3">Privacy Options</h4>
                    <div 
                      className="p-3 rounded-lg border mb-3 flex items-start gap-2"
                      style={{
                        background: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)',
                        borderColor: 'rgba(239, 68, 68, 0.3)'
                      }}
                    >
                      <Shield className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-600 dark:text-red-400">Privacy Notice</p>
                        <p className="text-xs text-muted-foreground">
                          Anonymous feedback will always remain anonymous regardless of settings.
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        style={{
                          background: exportOptions.showAuthorCodes 
                            ? (isDark ? 'rgba(246,66,31,0.1)' : 'rgba(246,66,31,0.05)')
                            : 'transparent',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={exportOptions.showAuthorCodes}
                          onChange={(e) => setExportOptions({ ...exportOptions, showAuthorCodes: e.target.checked })}
                          className="w-4 h-4 rounded accent-[#f6421f]"
                        />
                        <div className="flex-1">
                          <span className="font-medium">Show Author Codes</span>
                          <p className="text-xs text-muted-foreground">Display member codes (e.g., YSP-001)</p>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        style={{
                          background: exportOptions.showAuthorNames 
                            ? (isDark ? 'rgba(246,66,31,0.1)' : 'rgba(246,66,31,0.05)')
                            : 'transparent',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={exportOptions.showAuthorNames}
                          onChange={(e) => setExportOptions({ ...exportOptions, showAuthorNames: e.target.checked })}
                          className="w-4 h-4 rounded accent-[#f6421f]"
                        />
                        <div className="flex-1">
                          <span className="font-medium">Show Author Names</span>
                          <p className="text-xs text-muted-foreground">Display full names (non-anonymous only)</p>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        style={{
                          background: exportOptions.showAuthorEmails 
                            ? (isDark ? 'rgba(246,66,31,0.1)' : 'rgba(246,66,31,0.05)')
                            : 'transparent',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={exportOptions.showAuthorEmails}
                          onChange={(e) => setExportOptions({ ...exportOptions, showAuthorEmails: e.target.checked })}
                          className="w-4 h-4 rounded accent-[#f6421f]"
                        />
                        <div className="flex-1">
                          <span className="font-medium">Show Author Emails</span>
                          <p className="text-xs text-muted-foreground">Display email addresses (non-anonymous only)</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Preview Hint for PDF */}
                  {exportFormat === 'pdf' && (
                    <div 
                      className="p-3 rounded-lg border flex items-center gap-3"
                      style={{
                        background: isDark ? 'rgba(246,66,31,0.1)' : 'rgba(246,66,31,0.05)',
                        borderColor: isDark ? 'rgba(246,66,31,0.3)' : 'rgba(246,66,31,0.2)',
                      }}
                    >
                      <Eye className="w-5 h-5 text-[#f6421f] shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Preview Available</p>
                        <p className="text-xs text-muted-foreground">Switch to the Preview tab to see exactly how your PDF will look before exporting.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div 
              className="px-5 py-4 border-t shrink-0 flex items-center justify-end gap-3"
              style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
            >
              <button
                onClick={handleCloseExportModal}
                className="px-4 py-2 rounded-lg border hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                style={{ borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleCloseExportModal();
                  if (exportFormat === 'pdf') {
                    handleExportPDF();
                  } else {
                    handleExportSpreadsheet();
                  }
                }}
                className="px-4 py-2 rounded-lg bg-[#f6421f] text-white hover:bg-[#d93819] transition-colors flex items-center gap-2"
                style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}
              >
                <Download className="w-4 h-4" />
                Export {exportFormat === 'pdf' ? 'PDF' : 'Spreadsheet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

