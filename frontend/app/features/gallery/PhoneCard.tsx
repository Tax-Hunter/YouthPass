"use client";

import Image from "next/image";
import { Screen } from "@/app/data/screens";

interface Props {
  screen: Screen;
  index: number;
  onClick: (index: number) => void;
}

export default function PhoneCard({ screen, index, onClick }: Props) {
  return (
    <button
      onClick={() => onClick(index)}
      className="group flex flex-col items-center gap-3 cursor-pointer focus:outline-none"
    >
      {/* phone shell */}
      <div
        className="relative w-full overflow-hidden
                   border border-white/[0.07]
                   shadow-[0_4px_24px_rgba(0,0,0,0.5)]
                   transition-all duration-300 ease-out
                   group-hover:-translate-y-2
                   group-hover:border-violet-500/50
                   group-hover:shadow-[0_12px_40px_rgba(109,92,255,0.25)]"
        style={{ aspectRatio: "9/19.5" }}
      >
        <Image
          src={screen.file}
          alt={screen.label}
          fill
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 15vw"
          className="object-cover object-top"
          priority={index < 6}
        />
      </div>

      {/* label */}
      <div className="flex flex-col items-center gap-1.5">
        <span className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full
                         bg-violet-500/10 text-violet-400 border border-violet-500/20
                         transition-colors group-hover:bg-violet-500/20 group-hover:text-violet-300">
          {screen.category}
        </span>
        <span className="text-[13px] font-medium text-white/60 transition-colors group-hover:text-white/90">
          {screen.label}
        </span>
      </div>
    </button>
  );
}
