// FilterScreen의 "취업 상태" 라벨 → 온통청년 jobCd(그룹 0013) 매핑.
// 코드정의서 0013 그룹: 001 재직자, 002 자영업자, 003 미취업자, 004 프리랜서,
// 005 일용근로자, 006 (예비)창업자, 007 단기근로자, 008 영농종사자, 009 기타, 010 제한없음.
// "재학"만 대응하는 코드가 없어 미취업자(003)로 근사.
export const EMPLOYMENT_TO_JOB_CODES: Record<string, string[]> = {
  "미취업": ["0013003"],
  "재직": ["0013001"],
  "프리랜서": ["0013004"],
  "재학": ["0013003"],
};

export function employmentToJobCodes(employment: string): string[] {
  return EMPLOYMENT_TO_JOB_CODES[employment] ?? [];
}
