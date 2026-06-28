const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const PENDING_LOGOUT_KEY = "pending_logout_token";

export const tokenStorage = {
  getAccessToken: (): string | null =>
    typeof window !== "undefined" ? localStorage.getItem(ACCESS_TOKEN_KEY) : null,

  getRefreshToken: (): string | null =>
    typeof window !== "undefined" ? localStorage.getItem(REFRESH_TOKEN_KEY) : null,

  setTokens: (accessToken: string, refreshToken: string): void => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },

  clear: (): void => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },

  setPendingLogout: (refreshToken: string): void => {
    localStorage.setItem(PENDING_LOGOUT_KEY, refreshToken);
  },

  getPendingLogout: (): string | null =>
    typeof window !== "undefined" ? localStorage.getItem(PENDING_LOGOUT_KEY) : null,

  clearPendingLogout: (): void => {
    localStorage.removeItem(PENDING_LOGOUT_KEY);
  },
};
