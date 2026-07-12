import { getDeviceLanguage } from '@src/shared/i18n/device-language';
import type { ResolvedLanguage } from '@src/shared/preferences/language.preference';

import type { WidgetSnapshot, WidgetSnapshotStrings } from '../models/widget-snapshot.model';

/**
 * 앱이 스냅샷을 기록하기 전(첫 설치 직후 위젯 추가 등)에 쓰는 정적 폴백.
 *
 * headless 컨텍스트는 i18next 초기화 없이 실행될 수 있어 카탈로그 대신
 * 정적 2개 국어 맵을 사용한다. 문구는 widget.json과 동일하게 유지할 것.
 */
const FALLBACK_STRINGS: Record<ResolvedLanguage, WidgetSnapshotStrings> = {
  ko: {
    progressTitle: '오늘의 할 일',
    progressLabel: '0/0 완료',
    percentLabel: '0%',
    streakLabel: '0일 연속',
    allDoneLabel: '모두 완료!',
    moreLabelTemplate: '+{count}개 더',
    emptyTitle: '오늘 할 일이 없어요',
    emptyCta: '탭해서 추가하기',
    loggedOutTitle: '로그인이 필요해요',
    loggedOutCta: '탭해서 시작하기',
    staleTitle: '새로운 하루가 시작됐어요',
    staleCta: '앱을 열어 확인하기',
  },
  en: {
    progressTitle: "Today's todos",
    progressLabel: '0/0 done',
    percentLabel: '0%',
    streakLabel: '0 day streak',
    allDoneLabel: 'All done!',
    moreLabelTemplate: '+{count} more',
    emptyTitle: 'Nothing to do today',
    emptyCta: 'Tap to add a todo',
    loggedOutTitle: 'Sign in to get started',
    loggedOutCta: 'Tap to sign in',
    staleTitle: 'A new day has started',
    staleCta: 'Open the app to refresh',
  },
};

export function resolveFallbackLanguage(): ResolvedLanguage {
  return getDeviceLanguage() === 'ko' ? 'ko' : 'en';
}

/** 스냅샷 부재 시 렌더할 로그인 유도 스냅샷 */
export function createFallbackSnapshot(localDate: string, now: Date): WidgetSnapshot {
  const locale = resolveFallbackLanguage();

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
    strings: FALLBACK_STRINGS[locale],
  };
}
