"use client";

import { useState, useEffect } from "react";
import { tokenStorage } from "./tokenStorage";

interface User {
  id: string;
  email: string;
  nickname: string | null;
  profile_image: string | null;
  created_at: string;
  survey_completed: boolean;
}

interface UseUserResult {
  user: User | null;
  isLoading: boolean;
}

export function useUser(): UseUserResult {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = tokenStorage.getAccessToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/get/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) return null;
        return res.json() as Promise<User>;
      })
      .then((data) => setUser(data))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  return { user, isLoading };
}
