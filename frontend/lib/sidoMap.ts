export const CITY_TO_SIDO: Record<string, string> = {
  "서울특별시": "11",
  "부산광역시": "26",
  "대구광역시": "27",
  "인천광역시": "28",
  "광주광역시": "29",
  "대전광역시": "30",
  "울산광역시": "31",
  "세종특별자치시": "36",
  "경기도": "41",
  "강원특별자치도": "51",
  "충청북도": "43",
  "충청남도": "44",
  "전라북도": "52",
  "전라남도": "46",
  "경상북도": "47",
  "경상남도": "48",
  "제주특별자치도": "50",
};

export const SIDO_TO_CITY: Record<string, string> = Object.fromEntries(
  Object.entries(CITY_TO_SIDO).map(([k, v]) => [v, k])
);

// "춘천"은 시/도가 아니라 강원특별자치도 산하 기초자치단체라 CITY_TO_SIDO 매핑에는 없다.
// 필터 선택지 최상단에만 노출하고, cityToSido("춘천")는 계속 undefined를 반환해
// "춘천 전용 데이터 소스로 분기해야 함"을 나타내는 신호로 쓰인다.
export const CITY_OPTIONS = ["춘천", "전국", ...Object.keys(CITY_TO_SIDO)];

export function cityToSido(city: string): string | undefined {
  return CITY_TO_SIDO[city];
}
