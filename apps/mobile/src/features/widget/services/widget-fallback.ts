import { getDeviceLanguage } from '@src/shared/i18n/device-language';
import {
  type ResolvedLanguage,
  toResolvedLanguage,
} from '@src/shared/preferences/language.preference';

import type { WidgetSnapshot, WidgetSnapshotStrings } from '../models/widget-snapshot.model';

/**
 * 앱이 스냅샷을 기록하기 전(첫 설치 직후 위젯 추가 등)에 쓰는 정적 폴백.
 *
 * headless 컨텍스트는 i18next 초기화 없이 실행될 수 있어 카탈로그 대신 정적 문자열을
 * 사용한다. 폴백 스냅샷은 항상 loggedOut 상태이므로 렌더 경로(StateWidget)가 읽는
 * 로그인 문구 2종만 유지하면 된다 — widget.json의 state.loggedOut*과 동일하게 유지할 것.
 */
const FALLBACK_LOGGED_OUT: Record<ResolvedLanguage, { title: string; cta: string }> = {
  ko: { title: '로그인이 필요해요', cta: '탭해서 시작하기' },
  en: { title: 'Sign in to get started', cta: 'Tap to sign in' },
};

/** loggedOut 렌더 경로가 읽지 않는 나머지 문구 — 도달 불가, 빈 값으로 채운다 */
const UNREACHABLE_STRINGS: Omit<WidgetSnapshotStrings, 'loggedOutTitle' | 'loggedOutCta'> = {
  progressTitle: '',
  percentLabel: '',
  streakLabel: '',
  allDoneLabel: '',
  moreLabelTemplate: '',
  emptyTitle: '',
  emptyCta: '',
  staleTitle: '',
  staleCta: '',
};

export function resolveFallbackLanguage(): ResolvedLanguage {
  return toResolvedLanguage(getDeviceLanguage());
}

/** 스냅샷 부재 시 렌더할 로그인 유도 스냅샷 */
export function createFallbackSnapshot(localDate: string, now: Date): WidgetSnapshot {
  const locale = resolveFallbackLanguage();
  const loggedOut = FALLBACK_LOGGED_OUT[locale];

  return {
    version: 1,
    state: 'loggedOut',
    date: localDate,
    updatedAtIso: now.toISOString(),
    totalTodos: 0,
    completedTodos: 0,
    completionRate: 0,
    isComplete: false,
    currentStreak: 0,
    topTodos: [],
    locale,
    strings: {
      ...UNREACHABLE_STRINGS,
      loggedOutTitle: loggedOut.title,
      loggedOutCta: loggedOut.cta,
    },
  };
}
