export interface Screen {
  id: string;
  label: string;
  category: string;
  file: string;
}

export const screens: Screen[] = [
  { id: "login",          label: "로그인",        category: "인증",  file: "/screens/login.png" },
  { id: "home",           label: "홈",             category: "홈",    file: "/screens/home.png" },
  { id: "location",       label: "거주지 선택",    category: "설정",  file: "/screens/location.png" },
  { id: "policy-list",    label: "정책 목록",      category: "정책",  file: "/screens/policy-list.png" },
  { id: "policy-list-v2", label: "정책 목록 v2",   category: "정책",  file: "/screens/policy-list-v2.png" },
  { id: "policy-detail",  label: "정책 상세",      category: "정책",  file: "/screens/policy-detail.png" },
  { id: "bookmarks",      label: "찜한 정책",      category: "정책",  file: "/screens/bookmarked.png" },
  { id: "search",         label: "검색",           category: "검색",  file: "/screens/search.png" },
  { id: "filter",         label: "필터",           category: "검색",  file: "/screens/filter.png" },
  { id: "mypage",         label: "마이페이지",     category: "MY",    file: "/screens/mypage.png" },
  { id: "profile",        label: "프로필 메뉴",    category: "MY",    file: "/screens/profile.png" },
  { id: "404",            label: "404 에러",       category: "기타",  file: "/screens/404.png" },
];

export const categories = [
  "전체",
  ...Array.from(new Set(screens.map((s) => s.category))),
];
