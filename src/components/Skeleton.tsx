import React from "react";

interface SkeletonProps {
  className?: string;
  animate?: boolean;
}

// Base Skeleton component
export function Skeleton({ className = "", animate = true }: SkeletonProps) {
  return (
    <div
      className={`bg-gray-200 dark:bg-gray-700 rounded ${
        animate ? "animate-pulse" : ""
      } ${className}`}
    />
  );
}

// Card Skeleton - for project cards and similar
export function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 ${className}`}
    >
      {/* Image skeleton */}
      <Skeleton className="w-full h-48 rounded-none" />
      
      {/* Content */}
      <div className="p-5 space-y-3">
        {/* Title skeleton */}
        <Skeleton className="h-6 w-3/4" />
        
        {/* Description lines */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        
        {/* Button skeleton */}
        <Skeleton className="h-10 w-32 mt-4" />
      </div>
    </div>
  );
}

// Section Skeleton - for content sections
export function SectionSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-2xl p-6 md:p-8 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 ${className}`}
    >
      {/* Title */}
      <Skeleton className="h-8 w-48 mb-6" />
      
      {/* Content paragraphs */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}

// Hero Skeleton
export function HeroSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`text-center py-12 md:py-20 px-4 ${className}`}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Main heading */}
        <Skeleton className="h-12 w-3/4 mx-auto" />
        
        {/* Sub heading */}
        <Skeleton className="h-8 w-48 mx-auto" />
        
        {/* Tagline */}
        <div className="space-y-2 max-w-2xl mx-auto">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-2/3 mx-auto" />
        </div>
        
        {/* Buttons */}
        <div className="flex gap-4 justify-center mt-8">
          <Skeleton className="h-12 w-36" />
          <Skeleton className="h-12 w-36" />
        </div>
      </div>
    </div>
  );
}

// Project Grid Skeleton
export function ProjectGridSkeleton({
  count = 6,
  className = "",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

// Stats Skeleton
export function StatsSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${className}`}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
        >
          <Skeleton className="h-8 w-16 mb-2" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

// Table Row Skeleton
export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <tr className="border-b border-gray-200 dark:border-gray-700">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

// List Skeleton
export function ListSkeleton({
  count = 5,
  className = "",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
        >
          <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

// Avatar Skeleton
export function AvatarSkeleton({
  size = "md",
}: {
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
    xl: "w-24 h-24",
  };

  return <Skeleton className={`${sizeClasses[size]} rounded-full`} />;
}

// Text Block Skeleton
export function TextBlockSkeleton({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-4 ${i === lines - 1 ? "w-2/3" : "w-full"}`}
        />
      ))}
    </div>
  );
}

export default Skeleton;
