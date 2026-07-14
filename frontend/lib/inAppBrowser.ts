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
