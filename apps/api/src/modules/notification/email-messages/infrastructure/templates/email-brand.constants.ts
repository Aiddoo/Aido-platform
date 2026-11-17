import type { SupportedLocale } from "@aido/api/vocabulary";

// 이미 보낸 메일도 이 주소를 읽으므로 랜딩(aido.kr)은 로고·약관·개인정보처리방침 경로를 지워서는 안 된다
const LANDING_ORIGIN = "https://aido.kr";

export const EMAIL_LOGO_URL = `${LANDING_ORIGIN}/logo.png`;

export function emailLinksOf(locale: SupportedLocale) {
  return {
    home: `${LANDING_ORIGIN}/${locale}`,
    terms: `${LANDING_ORIGIN}/${locale}/terms`,
    privacy: `${LANDING_ORIGIN}/${locale}/privacy`,
  };
}

// 랜딩 globals.css 토큰과 같은 값이다. 흰 글자는 brand(2.8:1)가 아니라 brandDeep(5.2:1) 위에만 쓴다
export const EMAIL_COLORS = {
  brand: "#ff6b43",
  brandDeep: "#c2410c",
  brandSoft: "#ffe9df",
  cream: "#fff8f2",
  paper: "#ffffff",
  ink: "#222222",
  muted: "#6b6b6b",
  line: "#f0e4da",
} as const;

// 웹 폰트는 메일 앱 대부분이 막아 기기 글꼴만 쓴다
export const EMAIL_FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', Pretendard, 'Malgun Gothic', 'Segoe UI', Roboto, sans-serif";

export const EMAIL_CODE_FONT_FAMILY =
  "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";
