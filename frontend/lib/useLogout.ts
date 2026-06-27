"use client";

import { useState } from "react";
import { tokenStorage } from "./tokenStorage";

interface UseLogoutOptions {
  onSuccess?: () => void;
}

interface UseLogoutResult {
  logout: () => Promise<void>;
  isLoggingOut: boolean;
}

export function useLogout(options?: UseLogoutOptions): UseLogoutResult {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const logout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    const refreshToken = tokenStorage.getRefreshToken();

    try {
      if (refreshToken) {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/post/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      }
    } finally {
      tokenStorage.clear();
      options?.onSuccess?.();
    }
  };

  return { logout, isLoggingOut };
}
