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
  badge?: React.ReactNode;
  title: React.ReactNode;
  subtitle: React.ReactNode;
  buttonLabel: string;
  onButtonClick: () => void;
  illustration?: React.ReactNode;
}

export default function HeroBannerSlide({
  theme,
  badge,
  title,
  subtitle,
  buttonLabel,
  onButtonClick,
  illustration,
}: HeroBannerSlideProps) {
  const styles = THEME_STYLES[theme];

  return (
    // 높이를 패딩값으로 맞추면 화면 폭에 따라 배지/타이틀 문구의 줄바꿈 지점이 슬라이드마다
    // 달라져 카드 높이가 어긋난다. h-64로 고정하고 justify-between으로 콘텐츠는 위, 버튼은
    // 아래에 붙여서 문구 길이나 화면 폭과 무관하게 캐러셀의 모든 슬라이드 높이를 동일하게 유지한다.
    <div className={`${styles.bg} text-white px-screen pt-8 pb-8 h-64 flex flex-col items-start justify-between gap-2 shadow-inner relative overflow-hidden`}>
      {illustration}
      <div className="absolute -top-12.5 -right-12.5 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
      <div className={`absolute -bottom-7.5 -left-5 w-28 h-28 ${styles.accent} rounded-full blur-xl`} />

      <div className="relative z-10 space-y-2">
        {badge}
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
