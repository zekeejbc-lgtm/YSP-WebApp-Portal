import React from 'react';

// Shared shimmer styles - injected once
const ShimmerStyles = () => (
  <style>{`
    .skeleton-shimmer {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(
        90deg,
        transparent 0%,
        rgba(255, 255, 255, 0.4) 50%,
        transparent 100%
      );
      animation: shimmer 1.5s infinite;
    }

    .dark .skeleton-shimmer {
      background: linear-gradient(
        90deg,
        transparent 0%,
        rgba(255, 255, 255, 0.1) 50%,
        transparent 100%
      );
    }

    @keyframes shimmer {
      0% {
        transform: translateX(-100%);
      }
      100% {
        transform: translateX(100%);
      }
    }
  `}</style>
);

/**
 * Base skeleton line component
 */
interface SkeletonLineProps {
  width?: string;
  height?: string;
  className?: string;
}

function SkeletonLine({ width = '100%', height = '1rem', className = '' }: SkeletonLineProps) {
  return (
    <div 
      className={`rounded-md bg-gray-200 dark:bg-gray-700 relative overflow-hidden ${className}`}
      style={{ width, height }}
    >
      <div className="skeleton-shimmer" />
    </div>
  );
}

/**
 * SkeletonCard Component - For project cards
 */
interface SkeletonCardProps {
  className?: string;
}

export function SkeletonCard({ className = '' }: SkeletonCardProps) {
  return (
    <div 
      className={`rounded-2xl overflow-hidden bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm ${className}`}
    >
      <ShimmerStyles />
      {/* Image skeleton */}
      <div className="w-full h-48 relative overflow-hidden bg-gray-200 dark:bg-gray-700">
        <div className="skeleton-shimmer" />
      </div>

      {/* Content skeleton */}
      <div className="p-4 space-y-3">
        <div className="space-y-2">
          <SkeletonLine width="85%" height="1.25rem" />
          <SkeletonLine width="60%" height="1.25rem" />
        </div>
        <div className="space-y-2 pt-1">
          <SkeletonLine width="100%" height="0.875rem" />
          <SkeletonLine width="100%" height="0.875rem" />
          <SkeletonLine width="75%" height="0.875rem" />
        </div>
      </div>
    </div>
  );
}

/**
 * SkeletonCardGrid Component - For projects grid
 */
interface SkeletonCardGridProps {
  count?: number;
  className?: string;
}

export function SkeletonCardGrid({ count = 6, className = '' }: SkeletonCardGridProps) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}>
      <ShimmerStyles />
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
}

/**
 * SkeletonSection Component - For About Us, Mission, Vision, Advocacy sections
 */
interface SkeletonSectionProps {
  hasIcon?: boolean;
  lines?: number;
  className?: string;
}

export function SkeletonSection({ hasIcon = true, lines = 4, className = '' }: SkeletonSectionProps) {
  return (
    <div className={`ysp-card p-6 md:p-8 ${className}`}>
      <ShimmerStyles />
      {/* Title with icon */}
      <div className="flex items-center gap-3 mb-6">
        {hasIcon && (
          <div className="w-6 h-6 rounded-md bg-gray-200 dark:bg-gray-700 relative overflow-hidden">
            <div className="skeleton-shimmer" />
          </div>
        )}
        <SkeletonLine width="180px" height="1.5rem" />
      </div>

      {/* Content lines */}
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, index) => (
          <SkeletonLine 
            key={index} 
            width={index === lines - 1 ? '75%' : '100%'} 
            height="1rem" 
          />
        ))}
      </div>
    </div>
  );
}

/**
 * SkeletonOrgChart Component - For organizational chart section
 */
export function SkeletonOrgChart({ className = '' }: { className?: string }) {
  return (
    <div className={`ysp-card p-6 md:p-8 ${className}`}>
      <ShimmerStyles />
      {/* Title */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-6 h-6 rounded-md bg-gray-200 dark:bg-gray-700 relative overflow-hidden">
          <div className="skeleton-shimmer" />
        </div>
        <SkeletonLine width="200px" height="1.5rem" />
      </div>

      {/* Image placeholder */}
      <div className="w-full h-64 md:h-96 rounded-xl bg-gray-200 dark:bg-gray-700 relative overflow-hidden">
        <div className="skeleton-shimmer" />
      </div>
    </div>
  );
}

/**
 * SkeletonContact Component - For contact section
 */
export function SkeletonContact({ className = '' }: { className?: string }) {
  return (
    <div className={`ysp-card p-6 md:p-8 ${className}`}>
      <ShimmerStyles />
      {/* Title */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-6 h-6 rounded-md bg-gray-200 dark:bg-gray-700 relative overflow-hidden">
          <div className="skeleton-shimmer" />
        </div>
        <SkeletonLine width="150px" height="1.5rem" />
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Left side - Contact info */}
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 relative overflow-hidden">
                <div className="skeleton-shimmer" />
              </div>
              <div className="flex-1 space-y-2">
                <SkeletonLine width="60%" height="0.875rem" />
                <SkeletonLine width="80%" height="0.75rem" />
              </div>
            </div>
          ))}
        </div>

        {/* Right side - Social links */}
        <div className="space-y-3">
          <SkeletonLine width="120px" height="1rem" />
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 relative overflow-hidden">
                <div className="skeleton-shimmer" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * SkeletonProfileCard Component - For developer/founder cards
 */
export function SkeletonProfileCard({ className = '' }: { className?: string }) {
  return (
    <div className={`ysp-card p-6 text-center ${className}`}>
      <ShimmerStyles />
      {/* Avatar */}
      <div className="w-24 h-24 mx-auto rounded-full bg-gray-200 dark:bg-gray-700 relative overflow-hidden mb-4">
        <div className="skeleton-shimmer" />
      </div>

      {/* Name */}
      <SkeletonLine width="60%" height="1.25rem" className="mx-auto mb-2" />
      
      {/* Position */}
      <SkeletonLine width="40%" height="0.875rem" className="mx-auto mb-4" />

      {/* Description */}
      <div className="space-y-2">
        <SkeletonLine width="90%" height="0.75rem" className="mx-auto" />
        <SkeletonLine width="85%" height="0.75rem" className="mx-auto" />
        <SkeletonLine width="70%" height="0.75rem" className="mx-auto" />
      </div>

      {/* Button */}
      <div className="mt-4">
        <SkeletonLine width="100px" height="2rem" className="mx-auto rounded-lg" />
      </div>
    </div>
  );
}

/**
 * SkeletonPartnership Component - For partnership/become partner section
 */
export function SkeletonPartnership({ className = '' }: { className?: string }) {
  return (
    <div className={`ysp-card p-6 md:p-8 ${className}`}>
      <ShimmerStyles />
      {/* Title */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-6 h-6 rounded-md bg-gray-200 dark:bg-gray-700 relative overflow-hidden">
          <div className="skeleton-shimmer" />
        </div>
        <SkeletonLine width="200px" height="1.5rem" />
      </div>

      {/* Description */}
      <div className="space-y-2 mb-6">
        <SkeletonLine width="100%" height="0.875rem" />
        <SkeletonLine width="90%" height="0.875rem" />
      </div>

      {/* Button */}
      <SkeletonLine width="140px" height="2.5rem" className="rounded-lg" />
    </div>
  );
}

/**
 * Full page skeleton for homepage
 */
export function SkeletonHomepage() {
  return (
    <div className="space-y-8">
      <ShimmerStyles />
      
      {/* Hero skeleton */}
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        <div className="ysp-card p-8 md:p-12 text-center">
          <SkeletonLine width="60%" height="2.5rem" className="mx-auto mb-4" />
          <SkeletonLine width="80%" height="1.25rem" className="mx-auto mb-2" />
          <SkeletonLine width="70%" height="1.25rem" className="mx-auto" />
        </div>
      </div>

      {/* About section */}
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        <SkeletonSection lines={5} />
      </div>

      {/* Mission & Vision grid */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 grid md:grid-cols-2 gap-6">
        <SkeletonSection lines={4} />
        <SkeletonSection lines={4} />
      </div>

      {/* Advocacy */}
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        <SkeletonSection lines={6} />
      </div>

      {/* Projects */}
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        <div className="ysp-card p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-6 h-6 rounded-md bg-gray-200 dark:bg-gray-700 relative overflow-hidden">
              <div className="skeleton-shimmer" />
            </div>
            <SkeletonLine width="220px" height="1.5rem" />
          </div>
          <SkeletonCardGrid count={3} />
        </div>
      </div>

      {/* Org Chart */}
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        <SkeletonOrgChart />
      </div>

      {/* Contact */}
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        <SkeletonContact />
      </div>

      {/* Partnership */}
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        <SkeletonPartnership />
      </div>

      {/* Developer cards */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 grid md:grid-cols-2 gap-6">
        <SkeletonProfileCard />
        <SkeletonProfileCard />
      </div>
    </div>
  );
}

/**
 * SkeletonProfilePage Component - For My Profile page loading state
 */
export function SkeletonProfilePage({ isDark = false }: { isDark?: boolean }) {
  return (
    <div className="space-y-6">
      <ShimmerStyles />
      
      {/* Profile Header Card Skeleton */}
      <div 
        className={`rounded-2xl p-8 text-center border ${isDark ? 'bg-white/5 border-white/10' : 'bg-white/50 border-black/10'}`}
      >
        {/* Profile Picture Skeleton */}
        <div className="relative inline-block mb-4">
          <div 
            className="rounded-full bg-gray-200 dark:bg-gray-700 relative overflow-hidden"
            style={{ 
              width: '120px', 
              height: '120px',
              border: '4px solid #F97316'
            }}
          >
            <div className="skeleton-shimmer" />
          </div>
        </div>
        
        {/* Name */}
        <SkeletonLine width="200px" height="1.75rem" className="mx-auto mb-2" />
        
        {/* Position/Role badges */}
        <div className="flex justify-center gap-2 mt-3">
          <div className="w-24 h-7 rounded-full bg-gray-200 dark:bg-gray-700 relative overflow-hidden">
            <div className="skeleton-shimmer" />
          </div>
          <div className="w-20 h-7 rounded-full bg-gray-200 dark:bg-gray-700 relative overflow-hidden">
            <div className="skeleton-shimmer" />
          </div>
        </div>
      </div>

      {/* Two Column Layout Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Personal Information Section */}
          <SkeletonProfileSection title="Personal Information" fields={8} isDark={isDark} />
          
          {/* Identity Section */}
          <SkeletonProfileSection title="Identity" fields={4} isDark={isDark} />
          
          {/* Address Section */}
          <SkeletonProfileSection title="Address" fields={5} isDark={isDark} />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* YSP Information Section */}
          <SkeletonProfileSection title="YSP Information" fields={5} isDark={isDark} />
          
          {/* Social Media Section */}
          <SkeletonProfileSection title="Social Media" fields={3} isDark={isDark} />
          
          {/* Emergency Contact Section */}
          <SkeletonProfileSection title="Emergency Contact" fields={3} isDark={isDark} />
          
          {/* Account Section */}
          <SkeletonProfileSection title="Account" fields={3} isDark={isDark} />
        </div>
      </div>
    </div>
  );
}

/**
 * Helper component for profile section skeletons
 */
function SkeletonProfileSection({ 
  title, 
  fields, 
  isDark = false 
}: { 
  title: string; 
  fields: number; 
  isDark?: boolean;
}) {
  return (
    <div 
      className={`rounded-2xl p-6 border ${isDark ? 'bg-white/5 border-white/10' : 'bg-white/50 border-black/10'}`}
    >
      {/* Section Title */}
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
        <div className="w-5 h-5 rounded bg-gray-200 dark:bg-gray-700 relative overflow-hidden">
          <div className="skeleton-shimmer" />
        </div>
        <SkeletonLine width="140px" height="1.25rem" />
      </div>
      
      {/* Field Skeletons - 2 column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: fields }).map((_, index) => (
          <div key={index} className="space-y-2">
            {/* Label */}
            <SkeletonLine width="80px" height="0.75rem" />
            {/* Input */}
            <div 
              className={`h-11 rounded-lg relative overflow-hidden ${isDark ? 'bg-white/10' : 'bg-gray-100'}`}
            >
              <div className="skeleton-shimmer" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SkeletonCard;
