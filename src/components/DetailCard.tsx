import React from "react";
import { DESIGN_TOKENS } from "./design-system";

export interface DetailCardProps {
  title: string;
  content: string;
  isDark: boolean;
}

export function DetailCard({ title, content, isDark }: DetailCardProps) {
  return (
    <div
      className="rounded-lg p-4 border mb-4"
      style={{
        background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      }}
    >
      <h4
        className="mb-2"
        style={{
          fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
          fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
          fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
          color: DESIGN_TOKENS.colors.brand.orange,
        }}
      >
        {title}
      </h4>
      <p className="text-sm text-muted-foreground">{content}</p>
    </div>
  );
}
