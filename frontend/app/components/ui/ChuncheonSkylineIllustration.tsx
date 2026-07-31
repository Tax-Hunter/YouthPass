"use client";

import React from "react";

export default function ChuncheonSkylineIllustration() {
  return (
    <svg
      viewBox="0 0 400 220"
      preserveAspectRatio="xMaxYMax slice"
      className="absolute inset-0 h-full w-full pointer-events-none select-none"
    >
      {/* clouds */}
      <ellipse cx="330" cy="98" rx="26" ry="11" fill="#fff" opacity="0.18" />
      <ellipse cx="352" cy="92" rx="18" ry="9" fill="#fff" opacity="0.18" />
      <ellipse cx="230" cy="118" rx="20" ry="8" fill="#fff" opacity="0.12" />

      {/* birds */}
      <path d="M296 58 q4 -6 8 0 q4 -6 8 0" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.5" />
      <path d="M318 76 q3 -5 6 0 q3 -5 6 0" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.4" />

      {/* mountain layers */}
      <path d="M180 220 L270 112 Q280 100 290 112 L400 220 Z" fill="#fff" opacity="0.10" />
      <path d="M240 220 L312 132 Q320 123 328 132 L400 220 Z" fill="#fff" opacity="0.16" />

      {/* tower */}
      <line x1="330" y1="86" x2="330" y2="150" stroke="#fff" strokeWidth="2" opacity="0.6" />
      <rect x="323" y="95" width="14" height="11" rx="2" fill="#fff" opacity="0.5" />
      <circle cx="330" cy="82" r="2.5" fill="#fff" opacity="0.6" />

      {/* skyline buildings */}
      <rect x="298" y="172" width="18" height="48" fill="#fff" opacity="0.14" />
      <rect x="320" y="186" width="14" height="34" fill="#fff" opacity="0.12" />
      <rect x="338" y="160" width="20" height="60" fill="#fff" opacity="0.16" />
      <rect x="362" y="178" width="16" height="42" fill="#fff" opacity="0.13" />
      <rect x="382" y="150" width="16" height="70" fill="#fff" opacity="0.18" />

      {/* river */}
      <rect x="0" y="206" width="400" height="14" fill="#fff" opacity="0.08" />

      {/* cable-stayed bridge */}
      <line x1="140" y1="206" x2="360" y2="206" stroke="#fff" strokeWidth="2" opacity="0.55" />
      <line x1="230" y1="148" x2="230" y2="206" stroke="#fff" strokeWidth="2.5" opacity="0.6" />
      <line x1="230" y1="148" x2="180" y2="206" stroke="#fff" strokeWidth="1.2" opacity="0.5" />
      <line x1="230" y1="148" x2="205" y2="206" stroke="#fff" strokeWidth="1.2" opacity="0.5" />
      <line x1="230" y1="148" x2="280" y2="206" stroke="#fff" strokeWidth="1.2" opacity="0.5" />
      <line x1="230" y1="148" x2="255" y2="206" stroke="#fff" strokeWidth="1.2" opacity="0.5" />
    </svg>
  );
}
