import { useState, useEffect } from 'react';
import { ArrowLeft, Send, Star, MessageSquare, ThumbsUp, AlertCircle, Upload, X, Eye, User, Clock, CheckCircle, XCircle, Mail, Image as ImageIcon, Trash2, Search, RefreshCw, Copy } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { ImageWithFallback } from './figma/ImageWithFallback';
import CustomDropdown from './CustomDropdown';
import Breadcrumb from './design-system/Breadcrumb';

// Complete Backend Schema
interface Feedback {
  id: string; // Feedback ID (unique)
  timestamp: string; // Timestamp
  author: string; // Author name
  authorId: string; // Author ID Code
  feedback: string; // Feedback text
  replyTimestamp?: string; // Reply Timestamp
  replier?: string; // Replier name
  replierId?: string; // Replier ID (hidden)
  reply?: string; // Reply text
  anonymous: boolean; // Anonymous toggle
  category: 'Complaint' | 'Suggestion' | 'Bug' | 'Compliment' | 'Inquiry' | 'Confession' | 'Other';
  imageUrl?: string; // Image URL
  status: 'Pending' | 'Reviewed' | 'Resolved' | 'Dropped';
  visibility: 'Public' | 'Private';
  notes?: string; // Internal notes (hidden from user)
  email?: string; // Email (optional)
  rating: number; // 1-5 stars
}

interface FeedbackPageProps {
  onClose: () => void;
  isAdmin: boolean;
  isDark: boolean;
  userRole?: string;
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

export default function FeedbackPage({ onClose, isAdmin, isDark, userRole = 'guest' }: FeedbackPageProps) {
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFeedbackIdModal, setShowFeedbackIdModal] = useState(false);
  const [newFeedbackId, setNewFeedbackId] = useState('');
  const [adminReply, setAdminReply] = useState('');
  const [editingFeedback, setEditingFeedback] = useState<Feedback | null>(null);
  
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
  
  // Mock feedbacks with complete schema (persistent data)
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([
    {
      id: 'FB-001',
      timestamp: '2025-01-28T10:30:00',
      author: 'Juan Dela Cruz',
      authorId: 'YSP-2024-001',
      feedback: 'Great website! Very informative and easy to navigate. Love the new design!',
      replyTimestamp: '2025-01-28T14:20:00',
      replier: 'Admin Team',
      replierId: 'ADMIN-001',
      reply: 'Thank you for your positive feedback! We\'re glad you enjoy the new design.',
      anonymous: false,
      category: 'Compliment',
      imageUrl: undefined,
      status: 'Resolved',
      visibility: 'Public',
      email: 'juan@example.com',
      rating: 5,
      notes: 'User seems satisfied'
    },
    {
      id: 'FB-002',
      timestamp: '2025-01-27T15:45:00',
      author: 'Anonymous',
      authorId: 'Guest',
      feedback: 'Would love to see more volunteer opportunities posted regularly.',
      anonymous: true,
      category: 'Suggestion',
      status: 'Reviewed',
      visibility: 'Public',
      rating: 4
    },
    {
      id: 'FB-003',
      timestamp: '2025-01-26T09:15:00',
      author: 'Maria Santos',
      authorId: 'YSP-2024-015',
      feedback: 'The donation process could be simplified. Having issues with payment.',
      anonymous: false,
      category: 'Complaint',
      status: 'Pending',
      visibility: 'Private',
      email: 'maria@example.com',
      rating: 3
    }
  ]);

  // Guest's temporary feedbacks (stored in sessionStorage, cleared on refresh)
  const [guestFeedbacks, setGuestFeedbacks] = useState<Feedback[]>([]);

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

  const categories: Feedback['category'][] = ['Complaint', 'Suggestion', 'Bug', 'Compliment', 'Inquiry', 'Confession', 'Other'];

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

  const handleSubmit = (e: React.FormEvent) => {
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
    
    // Simulate API call
    setTimeout(() => {
      const feedbackId = `FB-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const newFeedback: Feedback = {
        id: feedbackId,
        timestamp: new Date().toISOString(),
        author: formData.anonymous ? 'Anonymous' : formData.author,
        authorId: userRole === 'guest' ? 'Guest' : 'YSP-2024-XXX',
        feedback: formData.feedback,
        anonymous: formData.anonymous,
        category: formData.category,
        imageUrl: uploadedImages.length > 0 ? uploadedImages[0].preview : undefined,
        status: 'Pending',
        visibility: formData.preferPrivate ? 'Private' : 'Public',
        email: formData.email || undefined,
        rating: formData.rating
      };

      // For guests: add to temporary storage
      if (userRole === 'guest') {
        setGuestFeedbacks([newFeedback, ...guestFeedbacks]);
        setNewFeedbackId(feedbackId);
        setShowFeedbackIdModal(true);
      } else {
        // For logged-in users: add to main feedbacks
        setFeedbacks([newFeedback, ...feedbacks]);
        toast.success('Feedback submitted!', {
          description: 'Thank you for your valuable feedback. We\'ll review it shortly!'
        });
      }

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
      setIsLoading(false);
    }, 1500);
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
      // For logged-in users or empty guest list
      setIsLoading(true);
      setTimeout(() => {
        setIsLoading(false);
        toast.success('Feedbacks refreshed');
      }, 1000);
    }
  };

  const handleRefreshPublicFeedbacks = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      toast.success('Public feedbacks refreshed');
    }, 1000);
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

  const getCategoryColor = (category: Feedback['category']) => {
    switch (category) {
      case 'Complaint': return { bg: 'rgba(239, 68, 68, 0.2)', border: 'rgba(239, 68, 68, 0.4)', text: '#ef4444' };
      case 'Suggestion': return { bg: 'rgba(59, 130, 246, 0.2)', border: 'rgba(59, 130, 246, 0.4)', text: '#3b82f6' };
      case 'Bug': return { bg: 'rgba(168, 85, 247, 0.2)', border: 'rgba(168, 85, 247, 0.4)', text: '#a855f7' };
      case 'Compliment': return { bg: 'rgba(34, 197, 94, 0.2)', border: 'rgba(34, 197, 94, 0.4)', text: '#22c55e' };
      case 'Inquiry': return { bg: 'rgba(251, 191, 36, 0.2)', border: 'rgba(251, 191, 36, 0.4)', text: '#fbbf24' };
      case 'Confession': return { bg: 'rgba(236, 72, 153, 0.2)', border: 'rgba(236, 72, 153, 0.4)', text: '#ec4899' };
      default: return { bg: 'rgba(107, 114, 128, 0.2)', border: 'rgba(107, 114, 128, 0.4)', text: '#6b7280' };
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
      baseFeedbacks = feedbacks.filter(f => f.authorId === 'YSP-2024-XXX'); // Mock: would be actual user ID
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

  const openDetailModal = (feedback: Feedback) => {
    setSelectedFeedback(feedback);
    setEditingFeedback({ ...feedback });
    setAdminReply(feedback.reply || '');
    setShowDetailModal(true);
  };

  const handleUpdateFeedback = () => {
    if (!editingFeedback) return;

    const updatedFeedbacks = feedbacks.map(f => 
      f.id === editingFeedback.id ? {
        ...editingFeedback,
        reply: adminReply || undefined,
        replyTimestamp: adminReply ? new Date().toISOString() : undefined,
        replier: adminReply ? 'Admin Team' : undefined,
        replierId: adminReply ? 'ADMIN-001' : undefined
      } : f
    );

    setFeedbacks(updatedFeedbacks);
    toast.success('Feedback updated!', {
      description: 'Changes have been saved successfully.'
    });
    setShowDetailModal(false);
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
              Feedback Center
            </h1>
            <p className={`text-xs hidden sm:block ${isDark ? 'text-gray-400' : 'text-gray-600'}`} style={{ fontWeight: '500', lineHeight: '1.2' }}>
              Your voice shapes our community
            </p>
          </div>

          {/* Spacer for balance */}
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
            { label: "Feedback", onClick: undefined },
          ]}
          isDark={isDark}
        />
      </div>

      {/* Main Content - Three Card Layout */}
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
          <p className={`max-w-2xl mx-auto mb-8 ${isDark ? 'text-gray-300' : 'text-gray-700'}`} style={{ fontWeight: '500', fontSize: '0.9375rem', lineHeight: '1.6' }}>
            Help us improve by sharing your thoughts, suggestions, and experiences.
          </p>
          <button
            onClick={() => setShowSubmitModal(true)}
            className="px-10 py-4 rounded-xl text-white transition-all duration-300 hover:shadow-2xl hover:scale-105 active:scale-95 inline-flex items-center gap-2.5"
            style={{
              background: 'linear-gradient(135deg, #f6421f 0%, #ee8724 100%)',
              fontWeight: '700',
              fontSize: '1.0625rem',
              boxShadow: '0 8px 20px rgba(246, 66, 31, 0.4)'
            }}
          >
            <Send className="w-5 h-5" />
            <span>Submit Feedback</span>
          </button>
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

      {/* Submit Feedback Modal */}
      {showSubmitModal && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-80"
            onClick={() => setShowSubmitModal(false)}
          />
          <div className="fixed inset-0 z-90 flex items-center justify-center p-4">
            <div 
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl"
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
                  onClick={() => setShowSubmitModal(false)}
                  className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
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
                        <div key={index} className="relative group">
                          <img
                            src={image.preview}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-32 object-cover rounded-xl"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
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

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowSubmitModal(false)}
                    className="flex-1 py-3.5 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                      border: `2px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                      color: isDark ? '#fff' : '#1e293b',
                      fontWeight: '600',
                      fontSize: '1rem'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 py-3.5 rounded-xl text-white transition-all duration-300 hover:shadow-2xl hover:scale-105 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: 'linear-gradient(135deg, #f6421f 0%, #ee8724 100%)',
                      fontWeight: '700',
                      fontSize: '1rem',
                      boxShadow: '0 8px 20px rgba(246, 66, 31, 0.4)'
                    }}
                  >
                    {isLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        <span>Submit Feedback</span>
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
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-80"
            onClick={() => setShowFeedbackIdModal(false)}
          />
          <div className="fixed inset-0 z-90 flex items-center justify-center p-4">
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
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-80"
            onClick={() => setShowDetailModal(false)}
          />
          <div className="fixed inset-0 z-90 flex items-center justify-center p-4">
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
                  onClick={() => setShowDetailModal(false)}
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

                {/* Image */}
                {selectedFeedback.imageUrl && (
                  <div>
                    <p className={`text-sm mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} style={{ fontWeight: '600' }}>Attachment</p>
                    <ImageWithFallback
                      src={selectedFeedback.imageUrl}
                      alt="Feedback attachment"
                      className="w-full rounded-xl max-h-64 object-cover"
                    />
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
                  <div className="flex gap-3 pt-6 mt-6 border-t" style={{ borderColor: isDark ? 'rgba(238, 135, 36, 0.2)' : 'rgba(238, 135, 36, 0.3)' }}>
                    <button
                      onClick={() => setShowDetailModal(false)}
                      className="flex-1 py-3.5 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                        border: `2px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                        color: isDark ? '#fff' : '#1e293b',
                        fontWeight: '600',
                        fontSize: '1rem'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpdateFeedback}
                      className="flex-1 py-3.5 rounded-xl text-white transition-all duration-300 hover:shadow-2xl hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                      style={{
                        background: 'linear-gradient(135deg, #f6421f 0%, #ee8724 100%)',
                        fontWeight: '700',
                        fontSize: '1rem',
                        boxShadow: '0 8px 20px rgba(246, 66, 31, 0.4)'
                      }}
                    >
                      <CheckCircle className="w-5 h-5" />
                      <span>Save Changes</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
