import {
  FALLBACK_LOCALE,
  resolveSupportedLocale,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from '@aido/api/vocabulary';

export const LANGUAGE_MODES = ['system', ...SUPPORTED_LOCALES] as const;

export type LanguageMode = (typeof LANGUAGE_MODES)[number];

export type ResolvedLanguage = SupportedLocale;

export function isLanguageMode(value: unknown): value is LanguageMode {
  return LANGUAGE_MODES.some((candidate) => candidate === value);
}

/**
 * 언어 모드를 실제 표시 언어로 해석한다.
 * 'system'은 기기 언어가 한국어일 때만 ko, 그 외 모든 언어는 en으로 해석한다.
 */
export function resolveLanguage(
  mode: LanguageMode,
  deviceLanguage?: string | null,
): ResolvedLanguage {
  if (mode !== 'system') {
    return mode;
  }

  return toResolvedLanguage(deviceLanguage);
}

/** 언어 규칙은 서버와 같은 `resolveSupportedLocale`이다. 감지하지 못한 기기 언어만 앱에서 en으로 둔다 */
export function toResolvedLanguage(value: string | null | undefined): ResolvedLanguage {
  return value == null ? FALLBACK_LOCALE : resolveSupportedLocale(value);
}
