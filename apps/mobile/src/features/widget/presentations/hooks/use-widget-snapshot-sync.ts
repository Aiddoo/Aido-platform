import { useWidgetSyncService } from '@src/bootstrap/providers/di-context';
import { useGetTodoSummaryQueryOptions } from '@src/features/todo/presentations/queries/use-get-todo-summary-query-options';
import { useToday } from '@src/shared/hooks/useToday';
import { i18n } from '@src/shared/i18n';
import { toResolvedLanguage } from '@src/shared/preferences/language.preference';
import { formatDate } from '@src/shared/utils/date';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import type {
  WidgetSnapshotContext,
  WidgetTranslateFn,
} from '../../services/widget-snapshot.mapper';

/**
 * 위젯 동기화가 알아야 하는 최소 인증 상태.
 * - authenticated: 요약 조회 + 스냅샷 기록
 * - unauthenticated: loggedOut 스냅샷 기록 (로그아웃/세션 만료 확정)
 * - resolving: 아무것도 하지 않음 (부팅/키체인 잠금 — 섣부른 loggedOut 기록으로
 *   콜드 스타트마다 위젯이 "로그인 필요"로 깜빡이는 것을 막는다)
 */
export type WidgetSyncAuthState = 'authenticated' | 'unauthenticated' | 'resolving';

const translate: WidgetTranslateFn = (key, params) => i18n.t(key, params);

function buildContext(): WidgetSnapshotContext {
  return { t: translate, locale: toResolvedLanguage(i18n.language), now: new Date() };
}

/**
 * 홈 위젯 스냅샷 동기화 — 앱 트리와 위젯을 잇는 유일한 통합 지점 (AuthProvider에서 호출).
 *
 * 갱신 경로가 전부 이 훅 하나로 수렴한다:
 * - 할 일 토글/생성/삭제 → completions() invalidation → 요약 refetch → 기록
 * - 앱 포그라운드 복귀 → focusManager stale refetch(staleTime 1분) → 기록
 * - 자정 넘긴 복귀 → useToday 날짜 회전 → 새 쿼리 키 → 재조회 → 기록
 * - 로그아웃/세션 만료 → loggedOut 스냅샷
 * - 언어 변경 → 같은 데이터로 문자열만 다시 구워 재기록
 */
export function useWidgetSnapshotSync(authState: WidgetSyncAuthState): void {
  const widgetSyncService = useWidgetSyncService();
  const today = useToday();
  const date = formatDate(today);

  const summaryOptions = useGetTodoSummaryQueryOptions(date);
  const { data } = useQuery({ ...summaryOptions, enabled: authState === 'authenticated' });

  // 요약 데이터 도착/변경 → 스냅샷 기록
  useEffect(() => {
    if (data === undefined) {
      return;
    }
    void widgetSyncService.syncSummary(data, buildContext());
  }, [data, widgetSyncService]);

  // 로그아웃/세션 만료 확정 → loggedOut 스냅샷
  useEffect(() => {
    if (authState !== 'unauthenticated') {
      return;
    }
    void widgetSyncService.syncLoggedOut(formatDate(new Date()), buildContext());
  }, [authState, widgetSyncService]);

  // 언어 변경 → 캐시된 데이터로 문자열만 재생성해 재기록.
  // 최신 상태는 ref로 읽어 리스너를 마운트당 1회만 구독한다 (데이터 변경마다 재구독 방지).
  const latestRef = useRef({ data, authState });
  latestRef.current = { data, authState };
  useEffect(() => {
    const handleLanguageChanged = () => {
      const latest = latestRef.current;
      if (latest.data !== undefined) {
        void widgetSyncService.syncSummary(latest.data, buildContext());
        return;
      }
      if (latest.authState === 'unauthenticated') {
        void widgetSyncService.syncLoggedOut(formatDate(new Date()), buildContext());
      }
    };

    i18n.on('languageChanged', handleLanguageChanged);
    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, [widgetSyncService]);
}
