"use client";

import { useState } from "react";
import { screens as allScreens, categories } from "@/app/data/screens";
import PhoneCard from "./PhoneCard";
import Lightbox from "./Lightbox";

export default function ScreenGallery() {
  const [activeCategory, setActiveCategory] = useState("전체");
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const filtered =
    activeCategory === "전체"
      ? allScreens
      : allScreens.filter((s) => s.category === activeCategory);

  const handleNav = (dir: 1 | -1) => {
    if (openIndex === null) return;
    setOpenIndex((openIndex + dir + filtered.length) % filtered.length);
  };

  return (
    <>
      {/* category filter */}
      <div className="flex flex-wrap gap-2 justify-center mb-10">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => { setActiveCategory(cat); setOpenIndex(null); }}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all
              ${activeCategory === cat
                ? "bg-violet-600 border-violet-500 text-white shadow-[0_0_14px_rgba(109,92,255,0.35)]"
                : "bg-white/5 border-white/10 text-white/45 hover:text-white/75 hover:bg-white/10"
              }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5 md:gap-7">
        {filtered.map((screen, i) => (
          <PhoneCard
            key={screen.id}
            screen={screen}
            index={i}
            onClick={setOpenIndex}
          />
        ))}
      </div>

      {/* lightbox */}
      {openIndex !== null && (
        <Lightbox
          screens={filtered}
          current={openIndex}
          onClose={() => setOpenIndex(null)}
          onNav={handleNav}
          onSelectIndex={setOpenIndex}
        />
      )}
    </>
  );
}
