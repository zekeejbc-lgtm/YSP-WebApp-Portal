"use client";

import { ReactNode } from "react";
import { GlowingEffect } from "./design-system/GlowingEffect";

interface GlowingCardProps {
  children: ReactNode;
  className?: string;
  glowOnHover?: boolean;
  isDark?: boolean;
}

export default function GlowingCard({
  children,
  className = "",
  glowOnHover = true,
  isDark = false,
}: GlowingCardProps) {
  return (
    <div
      className={`relative rounded-2xl border transition-all duration-300 ${
        glowOnHover ? "hover:shadow-2xl" : ""
      } ${className}`}
      style={{
        background: isDark
          ? "rgba(17, 24, 39, 0.8)"
          : "rgba(255, 255, 255, 0.8)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
      }}
    >
      {glowOnHover && (
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
}
