import React, { useRef, useState, useEffect, memo } from 'react';

interface LazyProjectCardProps {
  children: React.ReactNode;
  index: number;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * LazyProjectCard - A component that defers rendering of project cards
 * until they are close to the viewport. Uses Intersection Observer for
 * optimal performance and reduces initial render time.
 */
const LazyProjectCard = memo(function LazyProjectCard({ 
  children, 
  index, 
  style,
  className 
}: LazyProjectCardProps) {
  const ref = useRef<HTMLSpanElement>(null);
  // First 3 cards render immediately for LCP, others are lazy
  const [isVisible, setIsVisible] = useState(index < 3);

  useEffect(() => {
    // Skip observer for first 3 cards (already visible)
    if (index < 3) return;

    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            // Once visible, stop observing
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: '200px', // Start loading 200px before entering viewport
        threshold: 0,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [index]);

  return (
    <span 
      ref={ref} 
      style={{ 
        display: 'inline-block', 
        verticalAlign: 'top', 
        marginRight: 24, 
        width: 350, 
        maxWidth: '90vw',
        ...style 
      }}
      className={className}
    >
      {isVisible ? (
        children
      ) : (
        // Placeholder skeleton while not visible
        <div 
          className="overflow-hidden rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse"
          style={{ width: '100%', height: 296 }}
        >
          <div className="w-full h-48 bg-gray-200 dark:bg-gray-700" />
          <div className="p-4 space-y-3">
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
          </div>
        </div>
      )}
    </span>
  );
});

export default LazyProjectCard;
