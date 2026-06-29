"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/authStore";
import { useFilterStore } from "@/lib/store/filterStore";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { CITY_OPTIONS } from "@/lib/sidoMap";
import Header from "@/app/components/layout/Header";

const TOTAL_STEPS = 4;

const CATEGORIES = [
  { key: "주거", label: "주거", desc: "월세·전세·임대주택" },
  { key: "금융", label: "금융", desc: "저축·대출·자산형성" },
  { key: "일자리", label: "일자리", desc: "취업·창업·인턴" },
  { key: "교육", label: "교육", desc: "학자금·자격증·진로" },
  { key: "생활", label: "생활", desc: "문화·건강·복지" },
];

export default function SurveyScreen() {
  const router = useRouter();
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
  const [nickname, setNickname] = useState(user?.nickname ?? "");
  const [termsAgreed, setTermsAgreed] = useState(
    user?.survey_completed ?? false,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditMode = user?.survey_completed === true;

  const toggleCategory = (key: string) =>
    setSelectedCategories((prev) => ({ ...prev, [key]: !prev[key] }));

  const selectedCount =
    Object.values(selectedCategories).filter(Boolean).length;

  const canNext = () => {
    if (step === 1) return age !== "" && Number(age) >= 14;
    if (step === 2) return city !== "";
    if (step === 3) return selectedCount > 0;
    if (step === 4) return nickname.trim().length >= 2 && termsAgreed;
    return false;
  };

  const goNext = () => {
    if (!canNext() || isSubmitting) return;
    if (step < TOTAL_STEPS) setStep((s) => s + 1);
    else handleSubmit();
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
        const body = isEditMode
          ? {
              nickname: nickname.trim(),
              age: Number(age),
              region_city: city,
              interests,
            }
          : {
              nickname: nickname.trim(),
              age: Number(age),
              region_city: city,
              interests,
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
          setError(data?.detail ?? "제출 중 오류가 발생했습니다.");
          setIsSubmitting(false);
          return;
        }
      } catch {
        setError("네트워크 오류가 발생했습니다.");
        setIsSubmitting(false);
        return;
      }
    }

    router.push("/list");
  };

  const stepMeta = [
    { q: "나이가 어떻게 되시나요?", hint: "만 19세 이상 " },
    { q: "어디에 거주하시나요?", hint: "시·도 기준으로 선택해주세요" },
    {
      q: "어떤 분야 정책이\n필요하신가요?",
      hint: `최대 5개 · ${selectedCount}개 선택됨`,
    },
    {
      q: "마지막으로\n닉네임을 정해주세요",
      hint: "2~10자, 언제든 변경 가능해요",
    },
  ];

  const current = stepMeta[step - 1];

  return (
    <div className="flex flex-col h-full bg-white text-slate-800 font-sans select-none overflow-hidden pt-19">
      <Header
        isLocationHeader
        onBack={() => step > 1 ? setStep((s) => s - 1) : router.back()}
        onSkip={() => router.push("/list")}
      />

      {/* Step indicator: document icon + step number */}
      <div className="px-6 pt-6 pb-1 shrink-0">
        <div className="flex items-center gap-1.5 text-blue-600 mb-3">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-[15px] font-extrabold">{step}</span>
        </div>
        <h2 className="text-[26px] font-extrabold text-slate-900 leading-snug tracking-tight whitespace-pre-line">
          {current.q}
        </h2>
        <p className="text-[13px] text-slate-400 font-medium mt-1.5">
          {current.hint}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-4">
        {/* Step 1: 나이 */}
        {step === 1 && (
          <div className="relative pt-2">
            <input
              type="number"
              min={14}
              max={39}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && goNext()}
              placeholder="25"
              autoFocus
              className="w-full pl-5 pr-14 py-4 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-2xl outline-none text-[22px] font-bold text-slate-900 transition-all [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[15px] font-bold text-slate-400 pointer-events-none">
              세
            </span>
          </div>
        )}

        {/* Step 2: 거주 지역 */}
        {step === 2 && (
          <div className="pt-2 relative">
            <button
              onClick={() => setIsCityOpen((v) => !v)}
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
              <div className="absolute top-full left-0 right-0 mt-1.5 max-h-56 overflow-y-auto bg-white border border-slate-100 rounded-2xl shadow-xl z-20 divide-y divide-slate-50">
                {CITY_OPTIONS.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setCity(c);
                      setIsCityOpen(false);
                    }}
                    className={`w-full text-left px-5 py-3 text-[13px] font-semibold hover:bg-slate-50 transition-colors ${
                      city === c ? "text-blue-600" : "text-slate-700"
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
          <div className="pt-2 flex flex-wrap gap-2.5">
            {CATEGORIES.map(({ key, label }) => {
              const selected = selectedCategories[key];
              return (
                <button
                  key={key}
                  onClick={() => toggleCategory(key)}
                  className={`px-5 py-2.5 rounded-full text-[14px] font-bold border transition-all active:scale-95 ${
                    selected
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* Step 4: 닉네임 + 약관 */}
        {step === 4 && (
          <div className="pt-2 flex flex-col gap-5">
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && goNext()}
              placeholder="닉네임 입력 (2~10자)"
              maxLength={10}
              autoFocus
              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-2xl outline-none text-[16px] font-semibold text-slate-900 transition-all"
            />
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
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="3"
                      d="M5 13l4 4L19 7"
                    />
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
      <footer className="px-6 pb-10 pt-4 shrink-0 border-t border-slate-50">
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
