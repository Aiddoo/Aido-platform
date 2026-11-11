export const SUPPORTED_LOCALES = ["ko", "en"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

// 언어를 보고하지 않던 옛 앱은 한국어 사용자였다
export const DEFAULT_LOCALE = "ko" satisfies SupportedLocale;

// 지원하지 않는 언어는 앱과 같은 규칙으로 영어를 쓴다
export const FALLBACK_LOCALE = "en" satisfies SupportedLocale;

export function resolveSupportedLocale(raw: string | null | undefined): SupportedLocale {
  const trimmed = raw?.trim() ?? "";
  if (trimmed.length === 0) {
    return DEFAULT_LOCALE;
  }
  const [language] = trimmed.toLowerCase().split(/[-_]/);
  return SUPPORTED_LOCALES.find((locale) => locale === language) ?? FALLBACK_LOCALE;
}
