"use client";

import React from "react";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "primary" | "danger" | "neutral" | "chuncheon";
  size?: "sm" | "md";
  className?: string;
}

export default function Badge({
  children,
  variant = "primary",
  size = "sm",
  className = "",
}: BadgeProps) {
  const baseStyle = "font-extrabold inline-flex items-center justify-center select-none";
  
  const sizeStyles = {
    sm: "text-[9px] px-2.5 py-0.5 rounded-md",
    md: "text-[10px] px-3 py-1 rounded-md",
  };

  const variantStyles = {
    primary: "text-blue-600 bg-blue-50",
    danger: "text-rose-600 bg-rose-50",
    neutral: "text-slate-500 bg-slate-100",
    chuncheon: "text-violet-700 bg-violet-50",
  };

  const styles = `${baseStyle} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`;

  return <span className={styles}>{children}</span>;
}
