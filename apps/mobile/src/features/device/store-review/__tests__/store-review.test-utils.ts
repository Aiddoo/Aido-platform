import { ok } from '@src/core/errors/result';
import { createAuthSessionStoreStub } from '@src/features/identity/auth/__tests__/create-auth-session-store-stub';
import {
  createCurrentUserDto,
  createUser,
} from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { createPushOnboardingGuardStore } from '@src/features/notification/stores/push-onboarding-guard.store';
import { createTodoDto } from '@src/features/planning/todo/__tests__/todo.fixtures';
import { createTodoServer } from '@src/features/planning/todo/__tests__/todo.test-utils';
import { toTodo } from '@src/features/planning/todo/apis/todo.mapper';
import { TODO_QUERY_KEYS } from '@src/features/planning/todo/queries/todo-query-keys';
import { createWeatherReportDto } from '@src/features/weather/__tests__/weather-report.fixtures';
import type { DateKey } from '@src/shared/date/date-key';
import {
  createAnalyticsStub,
  createAppStoreReviewGatewayStub,
  createLocationGatewayStub,
  createMemoryObservableSyncStorage,
  createTestDi,
  createTestQueryClient,
} from '@src/testing/core';
import { createDateKey } from '@src/testing/date-key';
import { act } from '@testing-library/react-native';

import { createStoreReviewRepository } from '../repositories/store-review.repository';

const ME = createCurrentUserDto();
/** 서울 2026-11-02(월) 15:26. 날씨 기본 리포트가 유효한 때다 */
export const REVIEW_NOW = new Date('2026-11-02T06:26:00.000Z');
export const REVIEW_TODAY = createDateKey('2026-11-02');
/** 오늘이 더해지면 서로 다른 날이 3일이 돼 리뷰를 물을 수 있다 */
const PAST_ACTIVE_DAYS: DateKey[] = [createDateKey('2026-10-30'), createDateKey('2026-10-31')];
/** 축하 화면이 가라앉기를 기다리는 시간(1.2초)보다 길게 */
const REVIEW_SETTLE_MS = 2_000;

/** 오늘 남은 마지막 할 일. 끝내면 오늘 할 일을 모두 끝낸다 */
export const LAST_OPEN_TODO = createTodoDto({
  id: 7,
  title: '산책',
  userId: ME.userId,
  startDate: REVIEW_TODAY,
  scheduledLocalTime: '16:30',
  scheduledTime: '2026-11-02T07:30:00.000Z',
  completed: false,
});
const DONE_TODO = createTodoDto({
  id: 6,
  title: '물 마시기',
  userId: ME.userId,
  startDate: REVIEW_TODAY,
  sortOrder: 1,
  completed: true,
  completedAt: '2026-11-02T01:00:00.000Z',
});

/**
 * 리뷰를 물을 수 있는 계정(끝낸 날 이틀)과 오늘 목록을 이미 받아 둔 앱. 할 일 상세·알림처럼 오늘 목록을 받지 않는 곳도
 * 피드를 거쳐 온 것과 같게 한다
 */
export function createReviewReadyApp() {
  const syncStorage = createMemoryObservableSyncStorage();
  createStoreReviewRepository(syncStorage).update(ME.userId, (state) => ({
    ...state,
    activeDays: PAST_ACTIVE_DAYS,
  }));
  const httpClient = createTodoServer({
    todosByDate: { [REVIEW_TODAY]: [LAST_OPEN_TODO, DONE_TODO] },
    get: {
      'v2/weather': ok(createWeatherReportDto()),
      [`v1/todos/${LAST_OPEN_TODO.id}/details`]: ok({
        todo: LAST_OPEN_TODO,
        owner: { id: ME.userId, name: '나', userTag: 'TEST2025', profileImage: null },
        permissions: { canEdit: true, canComment: true, canNudge: false, canThank: false },
        metrics: { viewCount: 0, commentCount: 0 },
      }),
      [`v2/todos/${LAST_OPEN_TODO.id}/comments`]: ok({
        items: [],
        pagination: {
          previousCursor: null,
          nextCursor: null,
          hasPrevious: false,
          hasNext: false,
          size: 30,
        },
        anchor: null,
      }),
    },
  });
  httpClient.patch.mockResolvedValue(
    ok({ message: '완료했어요', todo: { ...LAST_OPEN_TODO, completed: true } }),
  );
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: ME.userId }));
  queryClient.setQueryData(TODO_QUERY_KEYS.listByDate({ date: REVIEW_TODAY }), {
    todos: [toTodo(LAST_OPEN_TODO), toTodo(DONE_TODO)],
    hasNext: false,
    nextCursor: null,
  });
  const appStoreReview = createAppStoreReviewGatewayStub();
  const analytics = createAnalyticsStub();
  const pushOnboardingGuardStore = createPushOnboardingGuardStore();
  pushOnboardingGuardStore.markRendered('pending');
  const di = createTestDi({
    ports: {
      httpClient,
      queryClient,
      syncStorage,
      appStoreReview,
      analytics,
      deviceLocation: createLocationGatewayStub({
        permission: { status: 'granted', canAskAgain: true },
        coordinates: { latitude: 37.5636, longitude: 126.9976 },
        place: { countryCode: 'KR', name: { city: '서울', district: '중구' } },
      }),
    },
    seeds: {
      authSessionStore: createAuthSessionStoreStub('authenticated'),
      pushOnboardingGuardStore,
    },
  });

  return {
    di,
    appStoreReview,
    analytics,
    completedTodoRequests: () => httpClient.patch.mock.calls.map(([path, body]) => [path, body]),
    settleReviewWait: () => act(() => jest.advanceTimersByTimeAsync(REVIEW_SETTLE_MS)),
  };
}
