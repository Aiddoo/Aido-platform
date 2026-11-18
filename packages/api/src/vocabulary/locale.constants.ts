export const SUPPORTED_LOCALES = ["ko", "en"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export type Localized<T> = Readonly<Record<SupportedLocale, T>>;

// 언어를 보고하지 않던 옛 앱은 한국어 사용자였다
export const DEFAULT_LOCALE = "ko" satisfies SupportedLocale;

// 지원하지 않는 언어는 앱과 같은 규칙으로 영어를 쓴다
export const FALLBACK_LOCALE = "en" satisfies SupportedLocale;

// 언어 코드만으로 고를 수 없는 태그(예: "zh-tw" → "zh-Hant"). findSupportedLocale이 소문자 태그로 찾아 키를 소문자로 적는다
export const LOCALE_FALLBACKS: Readonly<Record<string, SupportedLocale>> = {};

// Hermes가 Intl.Locale을 다 지원하지 않아 language[-script][-region]을 직접 나눈다
export function findSupportedLocale(tag: string): SupportedLocale | null {
  const normalized = tag.trim().toLowerCase().replaceAll("_", "-");
  const [language = ""] = normalized.split("-");
  const candidates = [normalized, LOCALE_FALLBACKS[normalized], language];
  return (
    candidates
      .map((candidate) => SUPPORTED_LOCALES.find((locale) => locale === candidate))
      .find((locale) => locale != null) ?? null
  );
}

export function resolveSupportedLocale(tag: string | null | undefined): SupportedLocale {
  const trimmed = tag?.trim() ?? "";
  if (trimmed.length === 0) {
    return DEFAULT_LOCALE;
  }
  return findSupportedLocale(trimmed) ?? FALLBACK_LOCALE;
}
