/**
 * =============================================================================
 * ANIMATED HAMBURGER BUTTON COMPONENT
 * =============================================================================
 * 
 * Animated hamburger menu button that transforms into X when open
 * 
 * =============================================================================
 */

import { motion } from "motion/react";

interface AnimatedHamburgerProps {
  isOpen: boolean;
  onClick: () => void;
  isDark?: boolean;
  className?: string;
}

export default function AnimatedHamburger({
  isOpen,
  onClick,
  isDark = false,
  className = "",
}: AnimatedHamburgerProps) {
  const lineColor = isDark ? "#e5e7eb" : "#1f2937";

  return (
    <button
      onClick={onClick}
      className={`relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${className}`}
      aria-label={isOpen ? "Close menu" : "Open menu"}
    >
      <div className="w-5 h-4 relative flex flex-col justify-between">
        {/* Top line */}
        <motion.span
          className="absolute h-0.5 w-5 rounded-full"
          style={{ backgroundColor: lineColor }}
          animate={{
            rotate: isOpen ? 45 : 0,
            y: isOpen ? 7 : 0,
          }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        />
        
        {/* Middle line */}
        <motion.span
          className="absolute h-0.5 w-5 rounded-full top-1/2 -translate-y-1/2"
          style={{ backgroundColor: lineColor }}
          animate={{
            opacity: isOpen ? 0 : 1,
            x: isOpen ? -10 : 0,
          }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        />
        
        {/* Bottom line */}
        <motion.span
          className="absolute bottom-0 h-0.5 w-5 rounded-full"
          style={{ backgroundColor: lineColor }}
          animate={{
            rotate: isOpen ? -45 : 0,
            y: isOpen ? -7 : 0,
          }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        />
      </div>
    </button>
  );
}
