"use client";

import { ReactNode, useState, useEffect, memo } from "react";
import { GlowingEffect } from "./design-system/GlowingEffect";

interface GlowingCardProps {
  children: ReactNode;
  className?: string;
  glowOnHover?: boolean;
  isDark?: boolean;
}

// Hook to detect mobile devices - cached to avoid re-renders
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768 || 'ontouchstart' in window;
  });

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window);
    };
    
    // Only listen for resize, not continuous
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
};

const GlowingCard = memo(function GlowingCard({
  children,
  className = "",
  glowOnHover = true,
  isDark = false,
}: GlowingCardProps) {
  const isMobile = useIsMobile();
  
  // Disable expensive effects on mobile for performance
  const shouldShowGlow = glowOnHover && !isMobile;
  const shouldUseBlur = !isMobile;

  return (
    <div
      className={`relative rounded-2xl border transition-all duration-300 ${
        glowOnHover ? "hover:shadow-2xl" : ""
      } ${className}`}
      style={{
        background: isDark
          ? "rgba(17, 24, 39, 0.95)"
          : "rgba(255, 255, 255, 0.95)",
        // Disable backdrop blur on mobile - very expensive
        ...(shouldUseBlur && {
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }),
        borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
      }}
    >
      {/* Only render GlowingEffect on desktop - too expensive on mobile */}
      {shouldShowGlow && (
        <GlowingEffect
          blur={20}
          spread={60}
          inactiveZone={0.5}
          proximity={100}
          disabled={false}
          movementDuration={1.5}
          borderWidth={2}
          variant="default"
        />
      )}
      {children}
    </div>
  );
});

export default GlowingCard;
