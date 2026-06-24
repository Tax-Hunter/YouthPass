export interface Policy {
  id: string;
  title: string;
  category: "주거" | "금융" | "일자리" | "교육" | "생활";
  dDay: string;
  description: string;
  views: string;
  target: string;
  benefits: string;
  location: string;
  employment: ("미취업" | "재직" | "프리랜서" | "재학")[];
  link: string;
  isFeatured?: boolean;
}

export const policies: Policy[] = [
  {
    id: "rent-support-2nd",
    title: "청년 월세 한시 특별지원 2차 사업",
    category: "주거",
    dDay: "D-3",
    description: "부모님과 거주하지 않는 저소득 청년 대상 월 최대 20만원 지원",
    views: "1.2k",
    target: "만 19세 ~ 34세 이하 무주택 청년 중 부모님과 별도 거주하고, 임차보증금 5천만원 및 월세 70만원 이하 주택에 거주하는 청년 (청년 가구 중위소득 60% 이하, 원가구 중위소득 100% 이하)",
    benefits: "생애 1회에 한해 실제 납부하는 월세 범위 내에서 월 최대 20만원씩 최대 12개월간 매월 분할 지원 (최대 240만원)",
    location: "전국 공통",
    employment: ["미취업", "재직", "프리랜서", "재학"],
    link: "https://www.bokjiro.go.kr",
    isFeatured: true,
  },
  {
    id: "rent-support-normal",
    title: "청년 월세 특별지원",
    category: "주거",
    dDay: "D-3",
    description: "부모님과 별도로 거주하는 무주택 청년들에게 월세를 최대 20만원까지 지원합니다.",
    views: "1.2k",
    target: "만 19세 ~ 34세 이하의 부모님과 별도 거주하는 무주택 청년 (청년독립가구 소득평가액이 기준 중위소득 60% 이하)",
    benefits: "실제 납부하는 월세 범위 내에서 최대 20만원씩 최장 12개월 동안 지원",
    location: "전국 공통",
    employment: ["미취업", "재직", "프리랜서", "재학"],
    link: "https://www.bokjiro.go.kr",
  },
  {
    id: "housing-loan",
    title: "청년 주택 안심 전세 자금 지원",
    category: "주거",
    dDay: "D-3",
    description: "서울시에 거주하는 무주택 청년을 대상으로 전세보증금 대출 이자를 지원하는 정책입니다.",
    views: "980",
    target: "서울시 거주 만 19세 ~ 39세 이하의 무주택 청년 세대주 (연소득 4천만원 이하, 보증금 3억원 이하의 임차주택)",
    benefits: "임차보증금 대출 추천 및 대출이자 연 최대 2.0% 지원 (연소득 및 조건별 차등 지원)",
    location: "서울특별시 마포구",
    employment: ["미취업", "재직", "프리랜서"],
    link: "https://saoom.seoul.go.kr",
  },
  {
    id: "saving-account",
    title: "청년도약계좌 신청",
    category: "금융",
    dDay: "D-7",
    description: "5년 만기 시 최대 5,000만원의 자산 형성을 돕는 정부 지원 금융 상품입니다.",
    views: "3.5k",
    target: "만 19세 ~ 34세 청년 중 개인소득 연 7,500만원 이하 및 가구소득 기준 중위소득 250% 이하를 모두 충족하는 청년",
    benefits: "납입한 금액에 비례해 정부 기여금 지급 (최대 월 2.4만 ~ 2.2만원) 및 이자소득 비과세 혜택 제공",
    location: "금융위원회",
    employment: ["재직", "프리랜서"],
    link: "https://ylaccount.kinfa.or.kr",
  },
  {
    id: "tax-reduction",
    title: "중소기업 취업청년 소득세 감면",
    category: "일자리",
    dDay: "상시모집",
    description: "중소기업에 취업한 청년들의 소득세를 5년간 최대 90%까지 감면해 드립니다.",
    views: "856",
    target: "중소기업 취업일 기준 만 15세 ~ 34세 이하의 청년 (근로계약 체결일 기준 연령)",
    benefits: "취업일로부터 5년간 발생하는 소득세의 90%를 감면 (연간 최대 200만원 한도)",
    location: "국세청",
    employment: ["재직"],
    link: "https://www.nts.go.kr",
  },
  {
    id: "job-incentive",
    title: "2024 청년 일자리 도약 장려금",
    category: "일자리",
    dDay: "D-5",
    description: "취업애로청년 채용 기업 대상 최대 1,200만원 지원",
    views: "1.5k",
    target: "채용일 기준 4개월 이상 실업 상태인 만 15세 ~ 34세 청년을 정규직으로 채용한 5인 이상 중소기업",
    benefits: "신규 채용 청년 1인당 월 최대 60만원씩 12개월간 지원 및 2년 근속 시 480만원 일시 추가 지급 (총 1,200만원)",
    location: "고용노동부",
    employment: ["미취업"],
    link: "https://www.work.go.kr",
  },
  {
    id: "training-card",
    title: "내일배움카드 훈련 지원",
    category: "교육",
    dDay: "D-14",
    description: "직무 역량 개발을 위한 훈련비 지원 및 장려금을 지급받을 수 있는 기회입니다.",
    views: "2.1k",
    target: "일자리를 구하고 있는 취업준비생, 재직자, 자영업자 등 직무 능력 향상을 원하는 국민 누구나",
    benefits: "5년간 300만 ~ 500만원 한도의 훈련비 지원 (훈련비의 45% ~ 85% 국비 지원 및 추가 장려금 지급)",
    location: "고용노동부",
    employment: ["미취업", "재직", "프리랜서", "재학"],
    link: "https://www.hrd.go.kr",
  },
  {
    id: "culture-pass",
    title: "청년 문화예술 패스 지원",
    category: "생활",
    dDay: "D-14",
    description: "19세 청년들에게 연 15만원 상당의 문화예술 관람을 지원하여 문화 향유 기회를 확대합니다.",
    views: "1.7k",
    target: "해당 연도에 만 19세가 되는 대한민국 청년 (2026년 기준 2007년생 청년 대상)",
    benefits: "순수예술 관람(연극, 뮤지컬, 클래식, 미술 전시 등)에 사용 가능한 문화예술패스 포인트 연 15만원 지원",
    location: "문화체육관광부",
    employment: ["미취업", "재직", "프리랜서", "재학"],
    link: "https://www.yes24.com",
  }
];
