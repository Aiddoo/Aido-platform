const LANGUAGE_MODES = ['system', 'ko', 'en'] as const;

export type LanguageMode = (typeof LANGUAGE_MODES)[number];

export type ResolvedLanguage = 'ko' | 'en';

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

/** 임의 언어 코드를 지원 언어로 좁힌다. ko 외에는 모두 en이며 폴백 규칙의 단일 소스다 */
export function toResolvedLanguage(value: string | null | undefined): ResolvedLanguage {
  return value === 'ko' ? 'ko' : 'en';
}
