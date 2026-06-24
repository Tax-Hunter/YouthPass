"use client";

import { useState, useEffect } from "react";

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("youth-pass-bookmarks");
    if (saved) {
      try {
        setBookmarks(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const toggleBookmark = (id: string) => {
    const next = bookmarks.includes(id)
      ? bookmarks.filter((b) => b !== id)
      : [...bookmarks, id];
    setBookmarks(next);
    localStorage.setItem("youth-pass-bookmarks", JSON.stringify(next));
    window.dispatchEvent(new Event("bookmarks-updated"));
  };

  useEffect(() => {
    const sync = () => {
      const saved = localStorage.getItem("youth-pass-bookmarks");
      if (saved) {
        try {
          setBookmarks(JSON.parse(saved));
        } catch (e) {}
      }
    };
    window.addEventListener("bookmarks-updated", sync);
    return () => window.removeEventListener("bookmarks-updated", sync);
  }, []);

  return {
    bookmarks,
    toggleBookmark,
    isBookmarked: (id: string) => bookmarks.includes(id),
  };
}
