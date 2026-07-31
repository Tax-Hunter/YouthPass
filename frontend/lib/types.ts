export type EmploymentStatus = "student" | "job_seeking" | "employed" | "startup_or_self_employed" | "other"
export type EducationLevel = "high_school_or_below" | "university_enrolled" | "university_graduated" | "graduate_school"
export type SpecialCondition = "female" | "vulnerable" | "disabled" | "military" | "local_talent" | "sme_employee"
export type IncomeLevel = "under_60" | "60_100" | "100_150" | "150_200" | "over_200" | "unknown"

export interface User {
  id: string
  email: string
  nickname: string | null
  profile_image: string | null
  age: number | null
  region_city: string | null
  interests: string[] | null
  employment_status: EmploymentStatus | null
  // 백엔드 UserResponse에 아직 없는 필드 — 키 자체가 응답에 없을 수 있어 optional
  // (workflow/9_feat/phase6_설문정책매칭.md 참고)
  education_level?: EducationLevel | null
  special_conditions?: SpecialCondition[] | null
  income_level: IncomeLevel | null
  created_at: string
  survey_completed: boolean
}

export interface FilterState {
  city: string
  employment: string
  categories: Record<string, boolean>
  keywords?: string[]
  age?: number
  educationLevel?: EducationLevel
}

// 정책 상세 조회 소스 — "policy"는 자체 DB(PostgreSQL), "chuncheon"은 외부 춘천 API 프록시.
// 같은 plcy_no라도 소스에 따라 실제 데이터가 존재하는 곳이 다르므로 항상 함께 다뤄야 한다.
export type PolicySource = "policy" | "chuncheon"

export interface BookmarkItem {
  plcy_no: string
  source: PolicySource
}
