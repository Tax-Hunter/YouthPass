import { useQuery } from "@tanstack/react-query";
import { mockDetail, MOCK_CARDS } from "./mock";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

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

const BASE = process.env.NEXT_PUBLIC_API_URL;

export function usePolicyDetail(policyId: string | null) {
  const { data, error, isLoading } = useQuery<PolicyDetailData>({
    queryKey: ["policy", "detail", policyId],
    queryFn: () => fetcher(`${BASE}/policy/get/policy/${policyId}`),
    enabled: !USE_MOCK && !!policyId,
    staleTime: 60_000,
  });

  if (USE_MOCK) {
    return { policy: policyId ? mockDetail(policyId) : null, error: null, isLoading: false };
  }
  return { policy: data ?? null, error: error ?? null, isLoading };
}

export function usePolicyList(params: {
  q?: string;
  category?: string[];
  keywords?: string[];
  sido?: string;
  age?: number;
  page?: number;
  size?: number;
  sort?: "recent" | "popular" | "deadline";
  applicable?: boolean;
} | null) {
  const query = new URLSearchParams();
  if (params) {
    if (params.q) query.set("q", params.q);
    params.category?.forEach((c) => query.append("category", c));
    params.keywords?.forEach((k) => query.append("keywords", k));
    if (params.sido) query.set("sido", params.sido);
    if (params.age != null) query.set("age", String(params.age));
    if (params.page) query.set("page", String(params.page));
    if (params.size) query.set("size", String(params.size));
    if (params.sort) query.set("sort", params.sort);
    if (params.applicable) query.set("applicable", "true");
  }

  const url = `${BASE}/policy/get/policies?${query.toString()}`;

  const { data, error, isLoading } = useQuery<PolicyListResponse>({
    queryKey: ["policy", "list", params],
    queryFn: () => fetcher(url),
    enabled: params !== null && !USE_MOCK,
    staleTime: 30_000,
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
