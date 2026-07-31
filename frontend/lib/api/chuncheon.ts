import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/store/authStore";
import type { PolicyCardData, PolicyListResponse } from "@/lib/api/policy";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";
const BASE = process.env.NEXT_PUBLIC_API_URL;

// 백엔드 /chuncheon/get/policies가 기존 /policy 응답과 동일한 PolicyListResponse 형태를 반환하므로
// 프론트 타입/PolicyCard 컴포넌트를 그대로 재사용한다.
const fetcher = (url: string, signal?: AbortSignal) => {
  const token = useAuthStore.getState().accessToken;
  return fetch(url, {
    signal,
    ...(token && { headers: { Authorization: `Bearer ${token}` } }),
  }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });
};

export interface ChuncheonPolicyListParams {
  q?: string;
  category?: string[];
  size?: number;
  sort?: "recent" | "popular" | "deadline";
  applicable?: boolean;
}

function buildQuery(params: ChuncheonPolicyListParams) {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  params.category?.forEach((c) => query.append("category", c));
  if (params.size) query.set("size", String(params.size));
  if (params.sort) query.set("sort", params.sort);
  if (params.applicable != null) query.set("applicable", String(params.applicable));
  return query;
}

export function useChuncheonPolicyList(params: ChuncheonPolicyListParams | null) {
  const url = `${BASE}/chuncheon/get/policies?${params ? buildQuery(params).toString() : ""}`;

  const { data, error, isLoading } = useQuery<PolicyListResponse>({
    queryKey: ["chuncheon", "list", params],
    queryFn: ({ signal }) => fetcher(url, signal),
    enabled: params !== null && !USE_MOCK,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    placeholderData: keepPreviousData,
  });

  if (USE_MOCK) {
    // 대회 전용 외부 데이터라 별도 목업을 두지 않고, 목업 모드에서는 빈 목록으로 섹션 자체를 숨긴다.
    if (params === null) return { data: null, error: null, isLoading: false };
    return { data: { total: 0, page: 1, size: params.size ?? 20, items: [] as PolicyCardData[] }, error: null, isLoading: false };
  }
  return { data: data ?? null, error: error ?? null, isLoading };
}
