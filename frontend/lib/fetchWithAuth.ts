import { useAuthStore } from "@/lib/store/authStore";

const BASE = process.env.NEXT_PUBLIC_API_URL;

let refreshPromise: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/auth/post/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) {
      useAuthStore.getState().setAccessToken(null);
      return false;
    }
    const { access_token } = await res.json();
    useAuthStore.getState().setAccessToken(access_token);
    return true;
  } catch {
    useAuthStore.getState().setAccessToken(null);
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
  const token = useAuthStore.getState().accessToken;
  const authHeaders: HeadersInit = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init.headers, ...authHeaders },
  });

  if (res.status !== 401) return res;

  const refreshed = await tryRefresh();
  if (!refreshed) return res;

  const newToken = useAuthStore.getState().accessToken;
  return fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
      Authorization: `Bearer ${newToken}`,
    },
  });
}
