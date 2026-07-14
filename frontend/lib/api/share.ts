import { useQuery } from "@tanstack/react-query";
import type { PolicyListResponse } from "./policy";

const BASE = process.env.NEXT_PUBLIC_API_URL;
// 공유 링크에 붙일 프론트 도메인 — window.location.origin은 로컬 개발 중 localhost로 찍혀
// 실제로 공유 불가능한 링크가 생성되므로, 배포 도메인을 env로 고정한다.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

export interface ShareCreateResponse {
  share_code: string;
  expires_at: string;
}

// 찜 목록(plcy_no 배열) 스냅샷을 서버에 저장하고 공유 코드를 발급받는다. 로그인 불필요.
export async function createShareLink(plcyNos: string[]): Promise<ShareCreateResponse> {
  const res = await fetch(`${BASE}/policy/post/share`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plcy_nos: plcyNos }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// 찜 목록 스냅샷을 저장하고 배포 도메인 기준 공유 URL을 완성해 반환한다.
export async function createShareUrl(plcyNos: string[]): Promise<string> {
  const { share_code } = await createShareLink(plcyNos);
  return `${SITE_URL}/share/${share_code}`;
}

export function useSharedPolicies(code: string | null) {
  const { data, error, isLoading } = useQuery<PolicyListResponse>({
    queryKey: ["policy", "share", code],
    queryFn: async ({ signal }) => {
      const res = await fetch(`${BASE}/policy/get/share/${code}`, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: !!code,
  });

  return { data: data ?? null, error: error ?? null, isLoading };
}
