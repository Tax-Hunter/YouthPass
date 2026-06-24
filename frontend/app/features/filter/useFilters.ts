"use client";

import { useState, useEffect } from "react";

export interface FilterState {
  city: string;
  district: string;
  employment: string;
  categories: Record<string, boolean>;
}

const DEFAULT_FILTERS: FilterState = {
  city: "서울특별시",
  district: "전체",
  employment: "미취업",
  categories: {
    주거: true,
    금융: true,
    일자리: false,
    교육: false,
  },
};

export function useFilters() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  useEffect(() => {
    const saved = localStorage.getItem("youth-pass-filters");
    if (saved) {
      try {
        setFilters(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const saveFilters = (newFilters: FilterState) => {
    setFilters(newFilters);
    localStorage.setItem("youth-pass-filters", JSON.stringify(newFilters));
    window.dispatchEvent(new Event("filters-updated"));
  };

  useEffect(() => {
    const sync = () => {
      const saved = localStorage.getItem("youth-pass-filters");
      if (saved) {
        try {
          setFilters(JSON.parse(saved));
        } catch (e) {}
      }
    };
    window.addEventListener("filters-updated", sync);
    return () => window.removeEventListener("filters-updated", sync);
  }, []);

  return {
    filters,
    saveFilters,
  };
}
