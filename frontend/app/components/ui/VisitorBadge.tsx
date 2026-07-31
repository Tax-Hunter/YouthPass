"use client";

import Image from "next/image";

interface VisitorBadgeProps {
  className?: string;
}

export default function VisitorBadge({ className = "" }: VisitorBadgeProps) {
  return (
    <Image
      src="/images/mascot/badge-full.png"
      alt="춘천 방문자 배지"
      width={1241}
      height={419}
      className={`h-9 w-auto mt-2 object-contain select-none ${className}`}
    />
  );
}
