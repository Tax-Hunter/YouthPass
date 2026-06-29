import { tokenStorage } from "./tokenStorage";

const BASE = process.env.NEXT_PUBLIC_API_URL;

let refreshPromise: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${BASE}/auth/post/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) {
      tokenStorage.clear();
      return false;
    }
    const { access_token } = await res.json();
    tokenStorage.setTokens(access_token, refreshToken);
    return true;
  } catch {
    tokenStorage.clear();
    return false;
  }
}

// 동시 401 발생 시 refresh를 한 번만 실행
function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function fetchWithAuth(
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const token = tokenStorage.getAccessToken();
  const authHeaders: HeadersInit = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers, ...authHeaders },
  });

  if (res.status !== 401) return res;

  const refreshed = await tryRefresh();
  if (!refreshed) return res;

  const newToken = tokenStorage.getAccessToken();
  return fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
      Authorization: `Bearer ${newToken}`,
    },
  });
}
