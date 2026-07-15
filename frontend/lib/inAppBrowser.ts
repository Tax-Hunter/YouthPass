const IN_APP_BROWSER_PATTERNS = [
  /KAKAOTALK/i,
  /NAVER\(/i,
  /Instagram/i,
  /FBAN|FBAV|FB_IAB/i,
  /Line\//i,
  /; wv\)/i,
];

export function isInAppBrowser(userAgent?: string): boolean {
  const ua = userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");
  return IN_APP_BROWSER_PATTERNS.some((pattern) => pattern.test(ua));
}

export function isAndroid(userAgent?: string): boolean {
  const ua = userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");
  return /Android/i.test(ua);
}

export function isKakaoTalk(userAgent?: string): boolean {
  const ua = userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");
  return /KAKAOTALK/i.test(ua);
}

/**
 * 카카오톡 인앱브라우저 전용 스킴 — 현재 URL을 외부 브라우저(Android: Chrome/기본브라우저,
 * iOS: Safari)로 즉시 강제 실행시킨다. 사용자의 추가 조작(복사/붙여넣기) 없이 자동 전환 가능.
 */
export function getKakaoExternalBrowserUrl(url: string): string {
  return `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
}

export function getGoogleLoginUrl(): string {
  return `${process.env.NEXT_PUBLIC_API_URL}/auth/get/google-login?redirect_origin=${encodeURIComponent(window.location.origin)}`;
}

/**
 * 인앱 브라우저(WebView)에서는 Google이 disallowed_useragent(403)로 로그인을 차단하므로,
 * 이 경우 곧바로 Google로 보내지 않는다.
 * - 카카오톡/Android는 클릭 한 번으로 외부 브라우저(Chrome/Safari) 자동 전환을 시도한다.
 * - 그 외(iOS + 인스타그램/페이스북/라인 등)는 자동 전환 API가 없어 onBlocked 콜백(안내 모달)을 실행한다.
 */
export function startGoogleLogin(onBlocked: () => void): void {
  if (isInAppBrowser()) {
    // 외부 브라우저가 곧장 Google 로그인 URL로 열리도록 목적지를 지정 —
    // 현재 페이지로 열면 사용자가 외부 브라우저에서 로그인 버튼을 다시 눌러야 함
    if (tryAutoExitInAppBrowser(getGoogleLoginUrl())) return;
    onBlocked();
    return;
  }
  window.location.href = getGoogleLoginUrl();
}

/** Android에서 targetUrl을 Chrome으로 강제 실행하는 intent URL */
export function getAndroidChromeIntentUrl(targetUrl: string): string {
  const withoutProtocol = targetUrl.replace(/^https?:\/\//, "");
  return `intent://${withoutProtocol}#Intent;scheme=https;package=com.android.chrome;end`;
}

/**
 * 인앱 브라우저 진입 시 가능한 경우 클릭 없이 즉시 외부 브라우저로 targetUrl을 열도록 탈출을 시도한다.
 * - 카카오톡: openExternal 스킴으로 Android/iOS 모두 자동 전환 가능
 * - 카카오톡 외 Android(인스타그램/페이스북/네이버 등 WebView): intent URL로 Chrome 자동 전환 가능
 * - 카카오톡 외 iOS(인스타그램/페이스북/라인 등): OS 차원의 강제 전환 API가 없어 자동 탈출 불가 → false 반환
 * @returns 자동 탈출을 시도했으면 true, 수동 안내(모달)가 필요하면 false
 */
export function tryAutoExitInAppBrowser(targetUrl: string = typeof window !== "undefined" ? window.location.href : ""): boolean {
  if (!isInAppBrowser()) return false;

  if (isKakaoTalk()) {
    window.location.href = getKakaoExternalBrowserUrl(targetUrl);
    return true;
  }
  if (isAndroid()) {
    window.location.href = getAndroidChromeIntentUrl(targetUrl);
    return true;
  }
  return false;
}

const AUTO_EXIT_ATTEMPTED_KEY = "youthpass_auto_redirect_attempted";

/** 이번 탭 세션에서 진입 시점 자동 전환을 이미 시도했는지 여부 (새로고침/재방문마다 반복 시도되는 것을 방지) */
function hasAttemptedAutoExitOnEntry(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.sessionStorage.getItem(AUTO_EXIT_ATTEMPTED_KEY) === "1";
  } catch {
    return false;
  }
}

function markAutoExitAttemptedOnEntry(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(AUTO_EXIT_ATTEMPTED_KEY, "1");
  } catch {
    // sessionStorage 접근 불가(프라이빗 모드 등) — 무시하고 매 진입마다 재시도되도록 둔다
  }
}

/**
 * 사이트 진입(페이지 최초 로드) 시점에 1회만 인앱 브라우저 자동 전환을 시도한다.
 * 로그인 버튼 클릭(startGoogleLogin)과 달리 세션당 한 번만 동작 — intent URL이 먹히지 않는 환경에서
 * 새로고침마다 무한히 외부 브라우저 전환을 재시도하는 것을 막기 위함.
 * @returns "auto" 자동 전환 시도함 / "blocked" 수동 안내(모달) 필요 / "skipped" 인앱 브라우저 아니거나 이미 시도함
 */
export function attemptAutoExitOnEntry(): "auto" | "blocked" | "skipped" {
  if (!isInAppBrowser()) return "skipped";
  if (hasAttemptedAutoExitOnEntry()) return "skipped";

  markAutoExitAttemptedOnEntry();
  const autoExited = tryAutoExitInAppBrowser(window.location.href);
  return autoExited ? "auto" : "blocked";
}
