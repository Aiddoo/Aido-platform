import {
  FALLBACK_LOCALE,
  resolveSupportedLocale,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from '@aido/api/vocabulary';

const LANGUAGE_MODES = ['system', ...SUPPORTED_LOCALES] as const;

export type LanguageMode = (typeof LANGUAGE_MODES)[number];

export type ResolvedLanguage = SupportedLocale;

// oxlint-disable-next-line aido/storage-key-location -- 1.15.2 전환 #1400
export const LANGUAGE_MODE_STORAGE_KEY = 'aido_language';

export function isLanguageMode(value: unknown): value is LanguageMode {
  return LANGUAGE_MODES.some((candidate) => candidate === value);
}

export function toLanguageMode(saved: string | undefined): LanguageMode {
  return isLanguageMode(saved) ? saved : 'system';
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
