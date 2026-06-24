"use client";

import React from "react";

interface PromoBannerProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClick?: () => void;
  onMouseEnter?: () => void;
  rightElement?: React.ReactNode;
  className?: string;
}

export default function PromoBanner({
  title,
  subtitle,
  onClick,
  onMouseEnter,
  rightElement,
  className = "",
}: PromoBannerProps) {
  const isClickable = !!onClick;
  
  const baseStyle = "p-4.5 bg-blue-50/50 border border-blue-100 rounded-2xl flex items-center justify-between transition-all select-none";
  const cursorStyle = isClickable ? "cursor-pointer hover:shadow-sm" : "";
  const styles = `${baseStyle} ${cursorStyle} ${className}`;

  return (
    <div onClick={onClick} onMouseEnter={onMouseEnter} className={styles}>
      <div className="space-y-1">
        {title}
        {subtitle}
      </div>
      {rightElement && <div className="shrink-0">{rightElement}</div>}
    </div>
  );
}
