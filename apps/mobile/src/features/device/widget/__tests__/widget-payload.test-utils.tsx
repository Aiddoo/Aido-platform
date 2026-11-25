import { ok } from '@src/core/errors/result';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import {
  createHttpClientStub,
  createTestDi,
  createTestQueryClient,
  setupFakeTimersPerTest,
} from '@src/testing/core';
import { createDeviceWidgetBridge } from '@src/testing/device-widget-bridge';
import { renderScreenHook } from '@src/testing/render';
import { act } from '@testing-library/react-native';

import { useWidgetSnapshotSync, type WidgetSyncAuthState } from '../hooks/use-widget-snapshot-sync';

/** 서울 2026-07-12(일) 18:00. 그 주는 7월 12일~18일이다 */
export function setupWidgetPayloadClock() {
  setupFakeTimersPerTest({ now: new Date('2026-07-12T09:00:00.000Z') });
}

export const WIDGET_PAYLOAD_ACCOUNT_ID = 'account-a';

/** 할 일 넷(완료 섞임·긴 제목·소문자 HEX·HEX가 아닌 색)인 오늘과 할 일 없는 내일 */
export const MIXED_TODAY_EMPTY_TOMORROW = {
  '2026-07-12': {
    date: '2026-07-12',
    totalTodos: 4,
    completedTodos: 2,
    completionRate: 50,
    isComplete: false,
    currentStreak: 3,
    topTodos: [
      { id: 11, title: '운동하기', completed: true, categoryColor: '#B3E5C1' },
      {
        id: 12,
        title: '분기 보고서 초안을 정리하고 팀 공유 문서에 올린 뒤 피드백 받기',
        completed: false,
        categoryColor: '#ffb3b3',
      },
      { id: 13, title: '장보기', completed: false, categoryColor: 'red' },
      { id: 14, title: '물 마시기', completed: true, categoryColor: '#FF6B43' },
    ],
  },
  '2026-07-13': {
    date: '2026-07-13',
    totalTodos: 0,
    completedTodos: 0,
    completionRate: 0,
    isComplete: false,
    currentStreak: 3,
    topTodos: [],
  },
};

/** 모두 끝낸 오늘. 서버가 내일 날짜를 아직 돌려주지 않아 내일 day 없이 쓴다 */
export const ALL_DONE_TODAY_WITHOUT_TOMORROW = {
  '2026-07-12': {
    date: '2026-07-12',
    totalTodos: 2,
    completedTodos: 2,
    completionRate: 100,
    isComplete: true,
    currentStreak: 1,
    topTodos: [
      { id: 21, title: 'Morning run', completed: true, categoryColor: '#B3E5C1' },
      { id: 22, title: 'Read', completed: true, categoryColor: '#FFB3B3' },
    ],
  },
  '2026-07-13': {
    date: '2026-07-12',
    totalTodos: 2,
    completedTodos: 2,
    completionRate: 100,
    isComplete: true,
    currentStreak: 1,
    topTodos: [],
  },
};

/** 7월 1일은 다 끝낸 날(주 밖), 14일은 할 일만 있는 날 */
const JULY_COMPLETIONS = {
  completions: [
    {
      date: '2026-07-01',
      totalTodos: 2,
      completedTodos: 2,
      isComplete: true,
      completionRate: 100,
      categoryColors: [],
    },
    {
      date: '2026-07-14',
      totalTodos: 1,
      completedTodos: 0,
      isComplete: false,
      completionRate: 0,
      categoryColors: [],
    },
  ],
  totalCompleteDays: 1,
  dateRange: { startDate: '2026-07-01', endDate: '2026-07-31' },
};

/** 앱이 실제로 쓰는 경로(동기화 훅 → 서비스 → 플랫폼 브리지)로 위젯에 한 번 쓴다 */
export async function syncWidget(
  authState: WidgetSyncAuthState,
  summariesByDate: Record<string, unknown> = MIXED_TODAY_EMPTY_TOMORROW,
) {
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(async (url, options) => {
    if (url === 'v1/todos/summary') {
      return ok(summariesByDate[String(options?.params?.date)]);
    }
    return ok(JULY_COMPLETIONS);
  });
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: WIDGET_PAYLOAD_ACCOUNT_ID }));
  await renderScreenHook(() => useWidgetSnapshotSync(authState), {
    di: createTestDi({
      ports: { httpClient, queryClient, widgetBridge: createDeviceWidgetBridge() },
    }),
    withLocalDate: true,
  });
  await act(() => jest.advanceTimersByTimeAsync(0));
}
