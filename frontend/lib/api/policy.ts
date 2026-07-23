import { useQuery, useInfiniteQuery, keepPreviousData, type QueryClient } from "@tanstack/react-query";
import { mockDetail, MOCK_CARDS } from "./mock";
import { useAuthStore } from "@/lib/store/authStore";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

// 로그인 상태면 토큰을 실어 보내 sort=recommended 등 개인화 정렬이 동작하게 함(비로그인도 정상 동작)
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

export interface PolicyDetailData {
  plcy_no: string;
  plcy_nm: string;
  category?: string | null;
  lclsf_nm?: string | null;
  mclsf_nm?: string | null;
  plcy_expln_cn?: string | null;
  plcy_sprt_cn?: string | null;
  region: string;
  region_sido: string[];
  is_nationwide: boolean;
  keywords: string[];
  sprt_trgt_min_age?: number | null;
  sprt_trgt_max_age?: number | null;
  earn_cnd_se_cd?: string | null;
  earn_min_amt?: number | null;
  earn_max_amt?: number | null;
  mrg_stts_cd?: string | null;
  aply_prd_se_cd?: string | null;
  is_always_open: boolean;
  apply_start_date?: string | null;
  apply_end_date?: string | null;
  dday: string;
  days?: number | null;
  sprvsn_inst_cd_nm?: string | null;
  aply_url_addr?: string | null;
  views: number;
  frst_reg_dt?: string | null;
  last_mdfcn_dt?: string | null;
  age_label?: string | null;
  target?: string | null;
  apply_method?: string | null;
  documents?: string | null;
  screening?: string | null;
  etc_notes?: string | null;
  oper_inst_nm?: string | null;
  contact?: string | null;
  ref_urls?: string[] | null;
  biz_period?: string | null;
}

export interface PolicyCardData {
  plcy_no: string;
  plcy_nm: string;
  category?: string | null;
  region: string;
  org?: string | null;
  summary?: string | null;
  benefit?: string | null;
  dday: string;
  days?: number | null;
  views: number;
  is_always_open: boolean;
  sprt_arvl_seq_yn?: boolean | null;
  apply_end_date?: string | null;
  keywords?: string[] | null;
  aply_url_addr?: string | null;
  age_label?: string | null;
}

export interface PolicyListResponse {
  total: number;
  page: number;
  size: number;
  items: PolicyCardData[];
}

// 마감(dday === "마감")인 정책은 가장 아래로, 나머지는 D-day 오름차순(남은 일수 적은 순)으로 정렬
// days가 없는 상시모집 정책은 남은 일수가 무한한 것으로 취급해 마감되지 않은 정책 중 가장 뒤에 위치
export function sortPoliciesByDeadline<T extends { dday: string; days?: number | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aClosed = a.dday === "마감";
    const bClosed = b.dday === "마감";
    if (aClosed !== bClosed) return aClosed ? 1 : -1;
    if (aClosed) return 0;
    return (a.days ?? Infinity) - (b.days ?? Infinity);
  });
}

const BASE = process.env.NEXT_PUBLIC_API_URL;

export interface PolicyListParams {
  q?: string;
  category?: string[];
  keywords?: string[];
  sido?: string;
  age?: number;
  size?: number;
  // "recommended": 백엔드 sort 패턴(popular|deadline|recent)에 아직 없음 — 지원 전까지 사용 금지.
  // 복구 시 workflow/9_feat/phase6_설문정책매칭.md 참고.
  sort?: "recent" | "popular" | "deadline" | "recommended";
  applicable?: boolean;
  job?: string[];
}

function buildPolicyQuery(params: PolicyListParams & { page?: number }) {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  params.category?.forEach((c) => query.append("category", c));
  params.keywords?.forEach((k) => query.append("keywords", k));
  params.job?.forEach((j) => query.append("job", j));
  if (params.sido) query.set("sido", params.sido);
  if (params.age != null) query.set("age", String(params.age));
  if (params.page) query.set("page", String(params.page));
  if (params.size) query.set("size", String(params.size));
  if (params.sort) query.set("sort", params.sort);
  if (params.applicable) query.set("applicable", "true");
  return query;
}

function policyDetailQueryOptions(policyId: string) {
  return {
    queryKey: ["policy", "detail", policyId] as const,
    queryFn: ({ signal }: { signal?: AbortSignal }) =>
      fetcher(`${BASE}/policy/get/policy/${policyId}`, signal),
    staleTime: 60_000,
  };
}

// 카드에 hover하는 순간 상세 데이터를 미리 캐시에 채워, 클릭 후 진입 시 로딩 없이 바로 렌더되게 함
export function prefetchPolicyDetail(queryClient: QueryClient, policyId: string) {
  if (USE_MOCK || !policyId) return;
  return queryClient.prefetchQuery(policyDetailQueryOptions(policyId));
}

export function usePolicyDetail(policyId: string | null) {
  const { data, error, isLoading } = useQuery<PolicyDetailData>({
    ...policyDetailQueryOptions(policyId ?? ""),
    enabled: !USE_MOCK && !!policyId,
  });

  if (USE_MOCK) {
    return { policy: policyId ? mockDetail(policyId) : null, error: null, isLoading: false };
  }
  return { policy: data ?? null, error: error ?? null, isLoading };
}

export function usePolicyList(params: (PolicyListParams & { page?: number }) | null) {
  const url = `${BASE}/policy/get/search?${params ? buildPolicyQuery(params).toString() : ""}`;

  const { data, error, isLoading } = useQuery<PolicyListResponse>({
    queryKey: ["policy", "list", params],
    queryFn: ({ signal }) => fetcher(url, signal),
    enabled: params !== null && !USE_MOCK,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    placeholderData: keepPreviousData,
  });

  if (USE_MOCK) {
    if (params === null) return { data: null, error: null, isLoading: false };
    let items = MOCK_CARDS;
    if (params.q) {
      const q = params.q.toLowerCase();
      items = items.filter(
        (c) =>
          c.plcy_nm.toLowerCase().includes(q) ||
          c.summary?.toLowerCase().includes(q) ||
          c.keywords?.some((k) => k.toLowerCase().includes(q))
      );
    }
    return { data: { total: items.length, page: 1, size: params.size ?? 20, items }, error: null, isLoading: false };
  }
  return { data: data ?? null, error: error ?? null, isLoading };
}

// 스크롤 시 다음 페이지를 이어붙여 전체 정책을 가져오는 무한스크롤용 훅
export function useInfinitePolicyList(params: PolicyListParams | null) {
  const size = params?.size ?? 20;

  const query = useInfiniteQuery<PolicyListResponse>({
    queryKey: ["policy", "list", "infinite", params],
    queryFn: ({ pageParam, signal }) =>
      fetcher(`${BASE}/policy/get/search?${buildPolicyQuery({ ...params, size, page: pageParam as number }).toString()}`, signal),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page * lastPage.size < lastPage.total ? lastPage.page + 1 : undefined,
    enabled: params !== null && !USE_MOCK,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    placeholderData: keepPreviousData,
  });

  if (USE_MOCK) {
    let items = params === null ? [] : MOCK_CARDS;
    if (params?.q) {
      const q = params.q.toLowerCase();
      items = items.filter(
        (c) =>
          c.plcy_nm.toLowerCase().includes(q) ||
          c.summary?.toLowerCase().includes(q) ||
          c.keywords?.some((k) => k.toLowerCase().includes(q))
      );
    }
    return {
      items,
      total: items.length,
      error: null,
      isLoading: false,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: () => {},
    };
  }

  return {
    items: query.data?.pages.flatMap((p) => p.items) ?? [],
    total: query.data?.pages[0]?.total ?? 0,
    error: query.error ?? null,
    isLoading: query.isLoading,
    hasNextPage: !!query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
  };
}
