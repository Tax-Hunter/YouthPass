"use client";

import React from "react";

type HeroBannerTheme = "blue" | "indigo";

const THEME_STYLES: Record<HeroBannerTheme, { bg: string; accent: string; buttonText: string; buttonHover: string }> = {
  blue: {
    bg: "bg-blue-600",
    accent: "bg-blue-500",
    buttonText: "text-blue-600",
    buttonHover: "hover:bg-blue-50",
  },
  indigo: {
    bg: "bg-indigo-600",
    accent: "bg-indigo-500",
    buttonText: "text-indigo-600",
    buttonHover: "hover:bg-indigo-50",
  },
};

interface HeroBannerSlideProps {
  theme: HeroBannerTheme;
  title: React.ReactNode;
  subtitle: React.ReactNode;
  buttonLabel: string;
  onButtonClick: () => void;
}

export default function HeroBannerSlide({
  theme,
  title,
  subtitle,
  buttonLabel,
  onButtonClick,
}: HeroBannerSlideProps) {
  const styles = THEME_STYLES[theme];

  return (
    <div className={`${styles.bg} text-white px-screen pt-9 pb-11 flex flex-col items-start gap-4 shadow-inner relative overflow-hidden`}>
      <div className="absolute -top-12.5 -right-12.5 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
      <div className={`absolute -bottom-7.5 -left-5 w-28 h-28 ${styles.accent} rounded-full blur-xl`} />

      <div className="relative z-10 space-y-2">
        <h2 className="text-[22px] font-bold leading-tight">{title}</h2>
        <p className="text-xs text-white/80 leading-relaxed font-medium">{subtitle}</p>
      </div>

      <button
        onClick={onButtonClick}
        className={`relative z-10 px-5 py-2.5 bg-white ${styles.buttonText} ${styles.buttonHover} text-[13px] font-bold rounded-xl shadow-md transition-all active:scale-[0.98]`}
      >
        {buttonLabel}
      </button>
    </div>
  );
}
