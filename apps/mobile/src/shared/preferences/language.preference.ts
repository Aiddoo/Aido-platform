import type { SyncStorage } from '@src/core/ports/sync-storage';

export const LANGUAGE_MODES = ['system', 'ko', 'en'] as const;

export type LanguageMode = (typeof LANGUAGE_MODES)[number];

export type ResolvedLanguage = 'ko' | 'en';

const KEY = 'aido_language';

export function isLanguageMode(value: unknown): value is LanguageMode {
  return typeof value === 'string' && LANGUAGE_MODES.includes(value as LanguageMode);
}

export function readLanguageMode(storage: SyncStorage): LanguageMode {
  const saved = storage.getString(KEY);

  if (isLanguageMode(saved)) {
    return saved;
  }

  return 'system';
}

export function writeLanguageMode(storage: SyncStorage, mode: LanguageMode): void {
  storage.set(KEY, mode);
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

/** 임의 언어 코드 → 지원 언어 내로잉 (ko 외 전부 en) — 폴백 규칙의 단일 소스 */
export function toResolvedLanguage(value: string | null | undefined): ResolvedLanguage {
  return value === 'ko' ? 'ko' : 'en';
}
