"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/authStore";
import { useFilterStore } from "@/lib/store/filterStore";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { CITY_OPTIONS } from "@/lib/sidoMap";
import type { EmploymentStatus, EducationLevel, SpecialCondition } from "@/lib/types";
import Header from "@/app/components/layout/Header";

const TOTAL_STEPS = 6;

const CATEGORIES = [
  { key: "주거", label: "주거", desc: "월세·전세·임대주택" },
  { key: "금융", label: "금융", desc: "저축·대출·자산형성" },
  { key: "일자리", label: "일자리", desc: "취업·창업·인턴" },
  { key: "교육", label: "교육", desc: "학자금·자격증·진로" },
  { key: "생활", label: "생활", desc: "문화·건강·복지" },
];

const CATEGORY_STYLE: Record<string, { color: string; path: React.ReactNode }> = {
  주거: {
    color: "bg-blue-50 text-blue-600",
    path: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
  },
  금융: {
    color: "bg-teal-50 text-teal-600",
    path: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />,
  },
  일자리: {
    color: "bg-indigo-50 text-indigo-600",
    path: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />,
  },
  교육: {
    color: "bg-amber-50 text-amber-600",
    path: (
      <>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
      </>
    ),
  },
  생활: {
    color: "bg-rose-50 text-rose-600",
    path: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />,
  },
};

// 현재 상황 → jobCd 매핑 (백엔드 survey_codes.py JOB_CD_MAP과 slug 일치)
const EMPLOYMENT_OPTIONS: { slug: EmploymentStatus; label: string }[] = [
  { slug: "student", label: "학생" },
  { slug: "job_seeking", label: "취업 준비 중" },
  { slug: "employed", label: "직장인" },
  { slug: "startup_or_self_employed", label: "창업 준비·자영업" },
  { slug: "other", label: "기타" },
];

// 학력 → schoolCd 매핑
const EDUCATION_OPTIONS: { slug: EducationLevel; label: string }[] = [
  { slug: "high_school_or_below", label: "고등학교 이하" },
  { slug: "university_enrolled", label: "대학 재학" },
  { slug: "university_graduated", label: "대학 졸업" },
  { slug: "graduate_school", label: "대학원" },
];

// 해당되는 조건(복수) → sbizCd 매핑
const CONDITION_OPTIONS: { slug: SpecialCondition; label: string }[] = [
  { slug: "female", label: "여성" },
  { slug: "vulnerable", label: "취약계층" },
  { slug: "disabled", label: "장애인" },
  { slug: "military", label: "군인" },
  { slug: "local_talent", label: "지역인재" },
  { slug: "sme_employee", label: "중소기업 재직" },
];

const CHECK_PATH = (
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
);

interface ScreenProps {
  onNavigate?: (screenId: string) => void;
}

export default function SurveyScreen({ onNavigate }: ScreenProps) {
  const router = useRouter();
  const go = (screenId: string) => {
    if (onNavigate) { onNavigate(screenId); return; }
    if (screenId === "back") { router.back(); return; }
    router.push(`/${screenId}`);
  };
  const { user, setUser } = useAuthStore();
  const { saveFilters, filters } = useFilterStore();

  const [step, setStep] = useState(1);
  const [age, setAge] = useState(
    filters.age != null ? String(filters.age) : "",
  );
  const [city, setCity] = useState(filters.city || "전국");
  const [isCityOpen, setIsCityOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<
    Record<string, boolean>
  >(() => {
    const existing = filters.categories ?? {};
    return Object.fromEntries(
      CATEGORIES.map(({ key }) => [key, existing[key] ?? false]),
    );
  });
  const [employmentStatus, setEmploymentStatus] = useState<EmploymentStatus | null>(
    user?.employment_status ?? null,
  );
  const [educationLevel, setEducationLevel] = useState<EducationLevel | null>(
    user?.education_level ?? null,
  );
  const [specialConditions, setSpecialConditions] = useState<SpecialCondition[]>(
    user?.special_conditions ?? [],
  );
  const [termsAgreed, setTermsAgreed] = useState(
    user?.survey_completed ?? false,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditMode = user?.survey_completed === true;
  const dropdownRef = useRef<HTMLDivElement>(null);

  const toggleCategory = (key: string) =>
    setSelectedCategories((prev) => ({ ...prev, [key]: !prev[key] }));

  const toggleCondition = (slug: SpecialCondition) =>
    setSpecialConditions((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );

  const selectedCount =
    Object.values(selectedCategories).filter(Boolean).length;

  const canNext = () => {
    if (step === 1) return age !== "" && Number(age) >= 19 && Number(age) <= 34;
    if (step === 2) return city !== "";
    if (step === 3) return selectedCount > 0;
    if (step === 4) return employmentStatus !== null;
    if (step === 5) return educationLevel !== null;
    if (step === 6) return termsAgreed;
    return false;
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    const interests = Object.entries(selectedCategories)
      .filter(([, v]) => v)
      .map(([k]) => k);

    saveFilters({
      ...filters,
      city,
      categories: selectedCategories,
      age: Number(age),
    });

    if (user) {
      try {
        const BASE = process.env.NEXT_PUBLIC_API_URL;
        const url = isEditMode
          ? `${BASE}/users/put/me`
          : `${BASE}/users/post/survey`;
        // 닉네임은 설문에서 별도로 받지 않고 구글 로그인 때 채워진 값을 그대로 사용
        // (SurveyRequest(POST)는 nickname이 필수(Field(..., min_length=2))라 항상 보내야 함)
        const surveyFields = {
          age: Number(age),
          region_city: city,
          interests,
          employment_status: employmentStatus,
          // education_level·special_conditions: 백엔드 컬럼 미구현으로 임시 제외
          // (설문 UI는 유지, 응답은 로컬 상태에만 남고 전송 안 함)
          // 복구 시 여기 되돌리기 — workflow/9_feat/phase6_설문정책매칭.md 참고
          // income_level: 소득 질문 자체를 설문에서 제거(대부분 정책이 소득무관/기타라 매칭에 거의
          // 영향을 못 줘 무의미하다고 판단) — 같은 문서 참고
          ...(user.nickname && { nickname: user.nickname }),
        };
        const body = isEditMode
          ? surveyFields
          : {
              ...surveyFields,
              terms_agreed: true,
              notification_enabled: false,
            };

        const res = await fetchWithAuth(url, {
          method: isEditMode ? "PUT" : "POST",
          body: JSON.stringify(body),
        });

        if (res.ok) {
          setUser(await res.json());
        } else if (res.status === 401) {
          setError("세션이 만료되었습니다. 다시 로그인해 주세요.");
          setIsSubmitting(false);
          return;
        } else {
          const data = await res.json().catch(() => ({}));
          // FastAPI 422는 detail이 문자열이 아니라 에러 객체 배열이라 그대로 렌더하면 크래시남
          const detail = data?.detail;
          const message = typeof detail === "string"
            ? detail
            : Array.isArray(detail)
              ? detail.map((d) => d?.msg).filter(Boolean).join(", ")
              : null;
          setError(message || "제출 중 오류가 발생했습니다.");
          setIsSubmitting(false);
          return;
        }
      } catch {
        setError("네트워크 오류가 발생했습니다.");
        setIsSubmitting(false);
        return;
      }
    }

    go("search");
  };

  const goNext = () => {
    if (!canNext() || isSubmitting) return;
    if (step < TOTAL_STEPS) setStep((s) => s + 1);
    else handleSubmit();
  };

  // 드롭다운 열릴 때 선택된 항목(없으면 첫 번째) 자동 포커스
  useEffect(() => {
    if (!isCityOpen || !dropdownRef.current) return;
    const selected = dropdownRef.current.querySelector<HTMLElement>("[data-selected='true']");
    const first = dropdownRef.current.querySelector<HTMLElement>("button");
    (selected ?? first)?.focus();
  }, [isCityOpen]);

  // Step 2·3: Enter로 다음 단계 진행
  useEffect(() => {
    if (step !== 2 && step !== 3) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      if (isSubmitting) return;
      if (step === 2 && !isCityOpen && city) {
        e.preventDefault();
        goNext();
      }
      if (step === 3 && selectedCount > 0) {
        const focused = document.activeElement;
        if (!focused || focused.tagName !== "BUTTON") {
          e.preventDefault();
          goNext();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [step, isCityOpen, city, selectedCount, isSubmitting, goNext]);

  const stepMeta = [
    { q: "나이가 어떻게 되시나요?", hint: "만 19~34세" },
    { q: "어디에 거주하시나요?", hint: "시·도 기준으로 선택해주세요" },
    {
      q: "어떤 분야 정책이\n필요하신가요?",
      hint: `최대 5개 · ${selectedCount}개 선택됨`,
    },
    { q: "현재 상황은\n무엇인가요?", hint: "정책 취업 조건 매칭에 활용돼요" },
    { q: "현재 학력은\n어떻게 되나요?", hint: "정책 학력 조건 매칭에 활용돼요" },
    { q: "해당되는 조건이\n있나요?", hint: "복수 선택 가능 · 없으면 넘어가세요 · 마지막 단계예요" },
  ];

  const current = stepMeta[step - 1];

  return (
    <div className="flex flex-col h-full bg-white text-slate-800 font-sans select-none overflow-hidden pt-header">
      <Header
        isLocationHeader
        onBack={() => step > 1 ? setStep((s) => s - 1) : go("back")}
        onSkip={() => go("search")}
      />

      {/* Step indicator: segmented progress bar + step count */}
      <div className="px-screen pt-6 pb-1 shrink-0">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 flex gap-1.5">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                  i < step ? "bg-blue-600" : "bg-slate-100"
                }`}
              />
            ))}
          </div>
          <span className="text-[11px] font-extrabold text-blue-600 tabular-nums shrink-0">
            {step}<span className="text-slate-300">/{TOTAL_STEPS}</span>
          </span>
        </div>
        <h2 className="text-[26px] font-extrabold text-slate-900 leading-snug tracking-tight whitespace-pre-line">
          {current.q}
        </h2>
        <p className="text-[13px] text-slate-400 font-medium mt-1.5">
          {current.hint}
        </p>
      </div>

      {/* Content */}
      <div key={step} className="flex-1 min-h-0 overflow-y-auto px-screen pb-4 animate-fade-in">
        {/* Step 1: 나이 */}
        {step === 1 && (
          <div className="pt-2">
            <div className="relative w-full">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={2}
                value={age}
                onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 2))}
                onKeyDown={(e) => e.key === "Enter" && goNext()}
                placeholder="25"
                autoFocus
                className="w-full pl-5 pr-11 py-3.5 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-2xl outline-none text-base font-semibold text-slate-900 transition-all"
              />
              <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[12px] font-bold text-slate-400 pointer-events-none">
                세
              </span>
            </div>
          </div>
        )}

        {/* Step 2: 거주 지역 */}
        {step === 2 && (
          <div className="pt-2 relative">
            <button
              onClick={() => setIsCityOpen((v) => !v)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isCityOpen && city) {
                  e.preventDefault();
                  goNext();
                }
                if (e.key === "Escape") setIsCityOpen(false);
              }}
              className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl text-[15px] font-semibold transition-all text-left focus:outline-none border ${
                isCityOpen
                  ? "border-blue-500 bg-white"
                  : "border-slate-200 bg-slate-50 hover:border-blue-400 hover:bg-white"
              }`}
            >
              <span className={city ? "text-slate-900" : "text-slate-400"}>
                {city || "시/도 선택"}
              </span>
              <svg
                className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isCityOpen ? "rotate-180 text-blue-500" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            {isCityOpen && (
              <div
                ref={dropdownRef}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setIsCityOpen(false);
                  }
                }}
                className="absolute top-full left-0 right-0 mt-1.5 max-h-56 overflow-y-auto bg-white border border-slate-100 rounded-2xl shadow-xl z-20 divide-y divide-slate-50"
              >
                {CITY_OPTIONS.map((c) => (
                  <button
                    key={c}
                    data-selected={city === c ? "true" : undefined}
                    onClick={() => {
                      setCity(c);
                      setIsCityOpen(false);
                    }}
                    className={`w-full text-left px-5 py-3 text-[13px] font-semibold hover:bg-slate-50 transition-colors focus:bg-blue-50 focus:outline-none ${
                      city === c ? "text-blue-600 font-bold" : "text-slate-700"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: 관심 분야 */}
        {step === 3 && (
          <div className="pt-2 flex flex-col gap-2.5">
            {CATEGORIES.map(({ key, label, desc }) => {
              const active = selectedCategories[key];
              const style = CATEGORY_STYLE[key];
              return (
                <button
                  key={key}
                  onClick={() => toggleCategory(key)}
                  className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all active:scale-[0.98] ${
                    active
                      ? "border-blue-500 bg-blue-50/60"
                      : "border-slate-200 bg-slate-50 hover:border-blue-200 hover:bg-white"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${style.color}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {style.path}
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[14px] font-bold ${active ? "text-blue-700" : "text-slate-800"}`}>
                      {label}
                    </p>
                    <p className="text-[11.5px] text-slate-400 font-medium mt-0.5">{desc}</p>
                  </div>
                  <div
                    className={`w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
                      active ? "bg-blue-600 border-blue-600" : "border-slate-300"
                    }`}
                  >
                    {active && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {CHECK_PATH}
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Step 4: 현재 상황 (단일 선택) */}
        {step === 4 && (
          <div className="pt-2 flex flex-col gap-2.5">
            {EMPLOYMENT_OPTIONS.map(({ slug, label }) => {
              const active = employmentStatus === slug;
              return (
                <button
                  key={slug}
                  onClick={() => setEmploymentStatus(slug)}
                  className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border text-left transition-all active:scale-[0.98] ${
                    active
                      ? "border-blue-500 bg-blue-50/60"
                      : "border-slate-200 bg-slate-50 hover:border-blue-200 hover:bg-white"
                  }`}
                >
                  <span className={`text-[14.5px] font-bold ${active ? "text-blue-700" : "text-slate-800"}`}>
                    {label}
                  </span>
                  <div
                    className={`w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
                      active ? "bg-blue-600 border-blue-600" : "border-slate-300"
                    }`}
                  >
                    {active && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {CHECK_PATH}
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Step 5: 학력 (단일 선택) */}
        {step === 5 && (
          <div className="pt-2 flex flex-col gap-2.5">
            {EDUCATION_OPTIONS.map(({ slug, label }) => {
              const active = educationLevel === slug;
              return (
                <button
                  key={slug}
                  onClick={() => setEducationLevel(slug)}
                  className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border text-left transition-all active:scale-[0.98] ${
                    active
                      ? "border-blue-500 bg-blue-50/60"
                      : "border-slate-200 bg-slate-50 hover:border-blue-200 hover:bg-white"
                  }`}
                >
                  <span className={`text-[14.5px] font-bold ${active ? "text-blue-700" : "text-slate-800"}`}>
                    {label}
                  </span>
                  <div
                    className={`w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
                      active ? "bg-blue-600 border-blue-600" : "border-slate-300"
                    }`}
                  >
                    {active && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {CHECK_PATH}
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Step 6: 해당되는 조건 (복수 선택) + 닉네임 + 약관 동의 */}
        {step === 6 && (
          <div className="pt-2 flex flex-col gap-2.5">
            <button
              onClick={() => setSpecialConditions([])}
              className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border text-left transition-all active:scale-[0.98] ${
                specialConditions.length === 0
                  ? "border-blue-500 bg-blue-50/60"
                  : "border-slate-200 bg-slate-50 hover:border-blue-200 hover:bg-white"
              }`}
            >
              <span className={`text-[14.5px] font-bold ${specialConditions.length === 0 ? "text-blue-700" : "text-slate-800"}`}>
                없음
              </span>
              <div
                className={`w-5 h-5 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${
                  specialConditions.length === 0 ? "bg-blue-600 border-blue-600" : "border-slate-300"
                }`}
              >
                {specialConditions.length === 0 && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {CHECK_PATH}
                  </svg>
                )}
              </div>
            </button>
            {CONDITION_OPTIONS.map(({ slug, label }) => {
              const active = specialConditions.includes(slug);
              return (
                <button
                  key={slug}
                  onClick={() => toggleCondition(slug)}
                  className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border text-left transition-all active:scale-[0.98] ${
                    active
                      ? "border-blue-500 bg-blue-50/60"
                      : "border-slate-200 bg-slate-50 hover:border-blue-200 hover:bg-white"
                  }`}
                >
                  <span className={`text-[14.5px] font-bold ${active ? "text-blue-700" : "text-slate-800"}`}>
                    {label}
                  </span>
                  <div
                    className={`w-5 h-5 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${
                      active ? "bg-blue-600 border-blue-600" : "border-slate-300"
                    }`}
                  >
                    {active && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {CHECK_PATH}
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
            <button
              onClick={() => setTermsAgreed((v) => !v)}
              className="flex items-start gap-3 text-left p-4 bg-slate-50 border border-slate-200 rounded-2xl hover:bg-white transition-colors"
            >
              <div
                className={`mt-0.5 w-5 h-5 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${
                  termsAgreed
                    ? "bg-blue-600 border-blue-600"
                    : "border-slate-300"
                }`}
              >
                {termsAgreed && (
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    {CHECK_PATH}
                  </svg>
                )}
              </div>
              <span className="text-[13px] text-slate-600 font-medium leading-relaxed">
                서비스 이용약관 및 개인정보 처리방침에 동의합니다{" "}
                <span className="text-blue-600 font-bold">(필수)</span>
              </span>
            </button>
            {error && (
              <p className="text-xs text-rose-500 font-semibold">{error}</p>
            )}
            {!user && (
              <p className="text-xs text-slate-400 text-center">
                로그인 없이도 필터 설정은 저장됩니다.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="px-screen pb-10 pt-4 shrink-0 border-t border-slate-50">
        <button
          onClick={goNext}
          disabled={!canNext() || isSubmitting}
          className={`w-full h-14 rounded-2xl font-bold text-[15px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
            canNext() && !isSubmitting
              ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25"
              : "bg-blue-200 text-white cursor-not-allowed"
          }`}
        >
          {isSubmitting ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : step < TOTAL_STEPS ? (
            "다음 →"
          ) : isEditMode ? (
            "수정 완료"
          ) : (
            "시작하기"
          )}
        </button>
      </footer>
    </div>
  );
}
