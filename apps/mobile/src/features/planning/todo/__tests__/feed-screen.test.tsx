import '@src/shared/i18n/init';
import { ErrorCode } from '@aido/api/errors';
import { fail, ok } from '@src/core/errors/result';
import { RELEASE_1_17_0 } from '@src/features/app-config/whats-new/constants/releases.constants';
import { createEntitlementSnapshotDto } from '@src/features/billing/subscription/__tests__/entitlement.fixtures';
import { createCoachmarkStorage } from '@src/features/device/coachmark/__tests__/coachmark.fixtures';
import type { CoachmarkKind } from '@src/features/device/coachmark/domains/coachmark.model';
import { createAuthSessionStoreStub } from '@src/features/identity/auth/__tests__/create-auth-session-store-stub';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { createPushPermissionResponse } from '@src/features/notification/__tests__/notification.fixtures';
import {
  createPushOnboardingGuardStore,
  type PushOnboardingGuardState,
} from '@src/features/notification/stores/push-onboarding-guard.store';
import { createTodoCategoryListDto } from '@src/features/planning/category/__tests__/todo-category.fixtures';
import { createFriendsListDto } from '@src/features/social/friend/__tests__/friend.fixtures';
import { createNudgeCooldownInfoDto } from '@src/features/social/nudge/__tests__/todo-nudge.fixtures';
import { ServerError } from '@src/shared/errors/infra-error';
import {
  createAnalyticsStub,
  createApiError,
  createJsonFetcherStub,
  createPendingResponse,
  createPushNotificationGatewayStub,
  createRouteParamsFake,
  createTestDi,
  silenceConsole,
  stubWindowDimensions,
} from '@src/testing/core';
import { createDateKey } from '@src/testing/date-key';
import { renderScreen } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { noop } from 'es-toolkit';
import { router } from 'expo-router';
import { View } from 'react-native';

import FeedScreen from '../../../../../app/(app)/(tabs)/(todos)/feed/index';
import {
  createTodoDto,
  createTodoItemResponseDto,
  createTodoListResponseDto,
} from './todo.fixtures';
import {
  countGetRequests,
  createTodoServer,
  findHostsWithProp,
  createTodoSummaryDto,
  getShownTexts,
  MEETING,
  TODAY,
  TODAY_NOON,
  WORKOUT,
} from './todo.test-utils';

const PHONE_WIDTH = 390;
const FOLD_WIDTH = 900;
const TOMORROW = createDateKey('2026-11-12');
const NEXT_SUNDAY = createDateKey('2026-11-15');
const FRIEND_ID = 'clz7x5p8k0005qz0z8z8z8z8z';
const FORMER_FRIEND_ID = 'clz7x5p8k0009qz0z8z8z8z8z';
const FRIEND_TODOS_PATH = `v1/todos/friends/${FRIEND_ID}`;
const FRIEND_COMPLETIONS_PATH = `v1/daily-completions/friends/${FRIEND_ID}`;
const FRIEND_COOLDOWN_PATH = `v1/nudges/remind/cooldown/${FRIEND_ID}`;
const LOAD_ERROR = '할 일을 불러오지 못했어요.';
/** 말풍선은 포커스 뒤 450ms를 기다렸다가 연다 */
const POPOVER_WAIT = { timeout: 2_000 };
const ME_ID = createCurrentUserDto().userId;
/** 오늘에서 반복 회차를 미리 만드는 기간(약 3개월)을 넘긴 날 */
const BEYOND_REPEAT_HORIZON = createDateKey('2027-06-02');
const CAMPAIGN_CONFIG = {
  enabled: true,
  campaignId: RELEASE_1_17_0.campaignId,
  minAppVersion: '1.15.0',
  launchedAt: '2026-11-01T00:00:00.000Z',
  autoOpen: true,
};
const ACTIVE_REPEAT_OVERVIEW = { hasTodo: true, hasCompletedTodo: true, hasActiveRepeat: true };

const FRIEND_SERVER = {
  'v1/follows/friends': ok(createFriendsListDto()),
  [FRIEND_TODOS_PATH]: ok(
    createTodoListResponseDto({
      items: [
        createTodoDto({ id: 31, title: '친구 독서', startDate: TODAY }),
        createTodoDto({ id: 32, title: '친구 산책', startDate: TODAY, completed: true }),
      ],
    }),
  ),
  [FRIEND_COMPLETIONS_PATH]: ok({
    completions: [],
    totalCompleteDays: 0,
    dateRange: { startDate: '2026-11-01', endDate: '2026-12-05' },
  }),
  [FRIEND_COOLDOWN_PATH]: ok(createNudgeCooldownInfoDto()),
};

type TestPorts = NonNullable<NonNullable<Parameters<typeof createTestDi>[0]>['ports']>;

interface RenderFeedOptions {
  params?: Record<string, string>;
  width?: number;
  server?: Parameters<typeof createTodoServer>[0];
  ports?: TestPorts;
  /** 앱 화면 묶음이 정한 알림 화면 차례. 정해지기 전(`pending`)에는 자동 안내가 기다린다 */
  guard?: PushOnboardingGuardState;
}

async function renderFeed({
  params = {},
  width = PHONE_WIDTH,
  server,
  ports,
  guard = 'pending',
}: RenderFeedOptions = {}) {
  stubWindowDimensions(width);
  createRouteParamsFake(params);
  const httpClient = createTodoServer({ todosByDate: { [TODAY]: [WORKOUT, MEETING] }, ...server });
  const pushOnboardingGuardStore = createPushOnboardingGuardStore();
  pushOnboardingGuardStore.markRendered(guard);
  const rendered = await renderScreen(<FeedScreen />, {
    withLocalDate: true,
    withOverlay: true,
    di: createTestDi({
      ports: { httpClient, ...ports },
      seeds: {
        authSessionStore: createAuthSessionStoreStub('authenticated'),
        pushOnboardingGuardStore,
      },
    }),
  });

  return { httpClient, ...rendered };
}

function getTodoRequestDates(httpClient: Awaited<ReturnType<typeof renderFeed>>['httpClient']) {
  return httpClient.get.mock.calls
    .filter(([path]) => path === 'v1/todos')
    .map(([, config]) => config?.params?.startDate);
}

describe('FeedScreen', () => {
  setupFakeTimersPerTest({ now: TODAY_NOON });

  describe('오늘의 할 일', () => {
    it('카테고리 순서대로 묶어 보이고 할 일이 없는 카테고리에도 추가 줄을 둔다', async () => {
      // Given
      const categories = createTodoCategoryListDto();
      const [firstCategory] = categories.items;
      if (firstCategory == null) {
        throw new Error('카테고리 fixture가 비어 있습니다');
      }

      // When
      await renderFeed({
        server: {
          todosByDate: { [TODAY]: [MEETING, WORKOUT] },
          get: {
            'v1/todo-categories': ok({
              items: [
                ...categories.items,
                { ...firstCategory, id: 3, name: '취미', sortOrder: 2, todoCount: 0 },
              ],
            }),
          },
        },
      });
      await screen.findByText('운동');

      // Then
      const texts = getShownTexts();
      expect(
        texts.filter((text) => ['기본', '운동', '업무', '회의', '취미'].includes(text)),
      ).toEqual(['기본', '운동', '업무', '회의', '취미']);
      expect(screen.getByTestId('todo-add-3')).toBeOnTheScreen();
    });

    it('카테고리의 추가 줄을 누르면 보고 있는 날짜와 그 카테고리로 추가 시트를 연다', async () => {
      // Given
      await renderFeed({ params: { date: TOMORROW } });
      const addToWork = await screen.findByTestId('todo-add-2');

      // When
      await fireEvent.press(addToWork);

      // Then
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/todo/new',
        params: { date: TOMORROW, categoryId: 2 },
      });
    });

    it('알림이 닿지 않으면 끝나지 않은 할 일의 시간에만 알림 꺼짐을 알린다', async () => {
      // Given
      const pushNotification = createPushNotificationGatewayStub();
      pushNotification.getPermission.mockResolvedValue(
        createPushPermissionResponse({ status: 'denied', canAskAgain: false }),
      );

      // When
      await renderFeed({
        ports: { pushNotification },
        server: { todosByDate: { [TODAY]: [WORKOUT, { ...MEETING, completed: true }] } },
      });
      await screen.findByText('운동');

      // Then
      await waitFor(() => expect(screen.getAllByLabelText(/알림 꺼짐/)).toHaveLength(1));
    });

    it('알림이 켜져 있으면 시간 옆에 알림 꺼짐을 알리지 않는다', async () => {
      // When
      await renderFeed();
      await screen.findByText('운동');
      await screen.findByText('자주 하는 일을 반복으로 만들어요');

      // Then
      expect(screen.queryByLabelText(/알림 꺼짐/)).toBeNull();
    });

    it('처음 열 때 조회마다 요청을 한 번씩만 보낸다', async () => {
      // When
      const { httpClient } = await renderFeed();
      await screen.findByText('운동');
      await screen.findByText('자주 하는 일을 반복으로 만들어요');

      // Then
      await waitFor(() =>
        expect(countGetRequests(httpClient)).toEqual({
          // 내 정보는 로그인 판정과 화면이 따로 받아 지금도 두 번이다
          'v1/auth/me': 2,
          'v1/auth/preference': 1,
          'v1/entitlements': 1,
          'v1/notifications/inbox/unread-count': 1,
          'v1/invites/availability': 1,
          'v1/follows/friends': 1,
          'v1/todo-categories': 1,
          'v1/todos': 1,
          'v1/todos/summary': 1,
          // 고른 달과 앞뒤 달
          'v1/daily-completions': 3,
        }),
      );
      expect(getTodoRequestDates(httpClient)).toEqual([TODAY]);
    });
  });

  describe('날짜', () => {
    it('달력에서 다른 날을 고르면 그 날의 목록을 받아 보인다', async () => {
      // Given
      const { httpClient } = await renderFeed({
        server: {
          todosByDate: {
            [TODAY]: [WORKOUT],
            [TOMORROW]: [createTodoDto({ id: 9, title: '내일 장보기', startDate: TOMORROW })],
          },
        },
      });
      await screen.findByText('운동');

      // When
      await fireEvent.press(screen.getByLabelText('2026년 11월 12일'));

      // Then
      expect(await screen.findByText('내일 장보기')).toBeOnTheScreen();
      expect(screen.queryByText('운동')).toBeNull();
      expect(httpClient.get).toHaveBeenCalledWith(
        'v1/todos',
        expect.objectContaining({
          params: expect.objectContaining({ startDate: TOMORROW, endDate: TOMORROW }),
        }),
      );
    });

    it('다음 주로 넘기면 그 주 일요일의 목록을 받는다', async () => {
      // Given
      const { httpClient } = await renderFeed();
      await screen.findByText('운동');

      // When
      await fireEvent.press(screen.getByLabelText('다음 주'));

      // Then
      await waitFor(() => expect(getTodoRequestDates(httpClient)).toEqual([TODAY, NEXT_SUNDAY]));
    });

    it('월 보기로 바꾸면 그 달의 다른 주 날짜를 고를 수 있다', async () => {
      // Given
      const { httpClient } = await renderFeed();
      await screen.findByText('운동');
      const [, monthTab] = screen.getAllByRole('tab');
      if (monthTab == null) {
        throw new Error('월 보기 탭이 없습니다');
      }

      // When
      await fireEvent.press(monthTab);
      await fireEvent.press(await screen.findByLabelText('2026년 11월 25일'));

      // Then
      await waitFor(() => expect(getTodoRequestDates(httpClient)).toEqual([TODAY, '2026-11-25']));
      expect(screen.getByLabelText('다음 달')).toBeOnTheScreen();
    });

    it('오늘이 아닌 날을 보다가 오늘을 누르면 오늘 목록으로 돌아온다', async () => {
      // Given
      await renderFeed({ params: { date: TOMORROW } });
      await screen.findByTestId('todo-add-1');

      // When
      await fireEvent.press(screen.getByText('오늘'));

      // Then
      expect(await screen.findByText('운동')).toBeOnTheScreen();
    });
  });

  describe('완료', () => {
    it('할 일을 체크하면 응답 전에 완료로 보이고 완료 요청을 보낸다', async () => {
      // Given
      const analytics = createAnalyticsStub();
      const { httpClient } = await renderFeed({ ports: { analytics } });
      const pending = createPendingResponse(
        ok({ message: '완료', todo: { ...WORKOUT, completed: true } }),
      );
      httpClient.patch.mockReturnValue(pending.response);
      const checkbox = await screen.findByTestId('todo-checkbox-1');

      // When
      await fireEvent.press(checkbox);

      // Then
      await waitFor(() => expect(screen.getByTestId('todo-checkbox-1')).toBeChecked());
      expect(httpClient.patch).toHaveBeenCalledTimes(1);
      expect(httpClient.patch).toHaveBeenCalledWith('v1/todos/1/complete', { completed: true });
      expect(screen.getByTestId('todo-checkbox-2')).not.toBeChecked();

      // When
      await act(async () => pending.settle());

      // Then
      await waitFor(() =>
        expect(analytics.trackEvent).toHaveBeenCalledWith('todo_completed', {
          todo_id: 1,
          is_completed: true,
        }),
      );
      expect(screen.getByTestId('todo-checkbox-1')).toBeChecked();
    });

    it('완료 요청이 실패하면 체크를 되돌린다', async () => {
      // Given
      silenceConsole('error');
      const { httpClient } = await renderFeed();
      httpClient.patch.mockResolvedValue(
        fail(createApiError(ErrorCode.TODO_0801, { message: '할일을 찾을 수 없어요' })),
      );
      const checkbox = await screen.findByTestId('todo-checkbox-1');

      // When
      await fireEvent.press(checkbox);

      // Then
      await waitFor(() => expect(httpClient.patch).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.getByTestId('todo-checkbox-1')).not.toBeChecked());
      await waitFor(() => expect(screen.getByTestId('todo-checkbox-1')).toBeEnabled());
    });

    it('끝낸 할 일을 다시 누르면 완료 취소 요청을 보낸다', async () => {
      // Given
      const done = { ...WORKOUT, completed: true };
      const { httpClient } = await renderFeed({
        server: { todosByDate: { [TODAY]: [done, MEETING] } },
      });
      httpClient.patch.mockResolvedValue(ok({ message: '취소', todo: WORKOUT }));
      const checkbox = await screen.findByTestId('todo-checkbox-1');
      expect(checkbox).toBeChecked();

      // When
      await fireEvent.press(checkbox);

      // Then
      await waitFor(() => expect(screen.getByTestId('todo-checkbox-1')).not.toBeChecked());
      expect(httpClient.patch).toHaveBeenCalledWith('v1/todos/1/complete', { completed: false });
    });

    it('하위 할 일을 체크하면 응답 전에 완료로 보이고 그 항목의 완료 요청을 보낸다', async () => {
      // Given
      const item = createTodoItemResponseDto({ id: 5, title: '스트레칭' });
      const parent = { ...WORKOUT, items: [item], itemStats: { total: 1, completed: 0 } };
      const { httpClient } = await renderFeed({
        server: { todosByDate: { [TODAY]: [parent] } },
      });
      const pending = createPendingResponse(
        ok({ message: '완료', todo: { ...parent, items: [{ ...item, completed: true }] } }),
      );
      httpClient.patch.mockReturnValue(pending.response);
      const checkbox = await screen.findByTestId('sub-todo-checkbox-5');

      // When
      await fireEvent.press(checkbox);

      // Then
      await waitFor(() => expect(screen.getByTestId('sub-todo-checkbox-5')).toBeChecked());
      expect(screen.getByText('1/1')).toBeOnTheScreen();
      expect(httpClient.patch).toHaveBeenCalledWith('v1/todos/1/items/5', { completed: true });
      await act(async () => pending.settle());
    });

    it('마지막 남은 할 일을 끝내면 오늘 다 끝냈다는 초대 안내가 뜬다', async () => {
      // Given
      let isAllDone = false;
      const { httpClient } = await renderFeed({
        server: {
          todosByDate: { [TODAY]: [WORKOUT] },
          get: {
            'v1/invites/availability': ok({ enabled: true }),
            'v1/invites/me': fail(createApiError(ErrorCode.INVITE_2101)),
            'v1/todos/summary': async () =>
              ok(
                createTodoSummaryDto({
                  totalTodos: 1,
                  completedTodos: isAllDone ? 1 : 0,
                  isComplete: isAllDone,
                }),
              ),
          },
        },
      });
      httpClient.patch.mockImplementation(async () => {
        isAllDone = true;
        return ok({ message: '완료', todo: { ...WORKOUT, completed: true } });
      });
      const checkbox = await screen.findByTestId('todo-checkbox-1');
      expect(screen.queryByText('친구와 같이 하면 더 오래 이어가요')).toBeNull();

      // When
      await fireEvent.press(checkbox);

      // Then
      expect(await screen.findByText('친구와 같이 하면 더 오래 이어가요')).toBeOnTheScreen();
    });
  });

  describe('할 일 줄의 동작', () => {
    it('⋯를 누르면 보고 있는 날짜와 함께 그 할 일의 동작 시트를 연다', async () => {
      // Given
      await renderFeed();
      const more = await screen.findByTestId('todo-more-2');

      // When
      await fireEvent.press(more);

      // Then
      expect(router.push).toHaveBeenCalledTimes(1);
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/todo/[todoId]/actions',
        params: { todoId: 2, date: TODAY },
      });
    });

    it('할 일 줄을 누르면 하위 할 일 추가 줄이 펼쳐지고, 누르면 그 할 일의 추가 시트를 연다', async () => {
      // Given
      await renderFeed();
      await fireEvent.press(await screen.findByText('운동'));

      // When
      await fireEvent.press(await screen.findByText('하위 할 일 추가'));

      // Then
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/todo/[todoId]/sub-todos/new',
        params: { todoId: 1, date: TODAY },
      });
    });

    it('하위 할 일의 ⋯를 누르면 그 항목의 동작 시트를 연다', async () => {
      // Given
      const item = createTodoItemResponseDto({ id: 5, title: '스트레칭' });
      await renderFeed({
        server: {
          todosByDate: {
            [TODAY]: [{ ...WORKOUT, items: [item], itemStats: { total: 1, completed: 0 } }],
          },
        },
      });
      await screen.findByText('스트레칭');
      const [, subTodoMore] = screen.getAllByLabelText('더 보기');
      if (subTodoMore == null) {
        throw new Error('하위 할 일의 더 보기 버튼이 없습니다');
      }

      // When
      await fireEvent.press(subTodoMore);

      // Then
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/todo/[todoId]/sub-todos/[subTodoId]/actions',
        params: { todoId: 1, subTodoId: 5, date: TODAY },
      });
    });
  });

  describe('다른 화면이 보낸 할 일 추가 요청', () => {
    it('요청을 받으면 기본 카테고리로 추가 시트를 열고 요청을 지운다', async () => {
      // When
      await renderFeed({ params: { action: 'add-voice-todo' } });

      // Then
      await waitFor(() =>
        expect(router.push).toHaveBeenCalledWith({
          pathname: '/todo/new',
          params: { date: TODAY, categoryId: 1, startVoice: '1' },
        }),
      );
      expect(router.setParams).toHaveBeenCalledWith({ action: undefined });
    });
  });

  describe('친구 피드', () => {
    it('친구 줄에서 친구를 고르면 그 친구의 그날 할 일을 읽기만 하게 보이고 끝나지 않은 오늘 할 일에만 콕을 둔다', async () => {
      // Given
      const { httpClient } = await renderFeed({ server: { get: FRIEND_SERVER } });
      await screen.findByText('운동');

      // When
      await fireEvent.press(await screen.findByTestId(`friend-strip-item-${FRIEND_ID}`));

      // Then
      expect(await screen.findByText('친구 독서')).toBeOnTheScreen();
      expect(screen.queryByText('운동')).toBeNull();
      expect(screen.queryByTestId('todo-more-31')).toBeNull();
      expect(screen.queryByTestId('todo-add-1')).toBeNull();
      for (const checkbox of screen.getAllByRole('checkbox')) {
        expect(checkbox).toBeDisabled();
      }
      expect(screen.getAllByLabelText('콕 찌르기')).toHaveLength(1);
      expect(httpClient.get).toHaveBeenCalledWith(
        FRIEND_TODOS_PATH,
        expect.objectContaining({
          params: expect.objectContaining({ startDate: TODAY, endDate: TODAY }),
        }),
      );
    });

    it('친구 피드를 처음 열 때 친구의 할 일과 달력을 한 번씩만 받는다', async () => {
      // When
      const { httpClient } = await renderFeed({
        params: { friendId: FRIEND_ID },
        server: { get: FRIEND_SERVER },
      });
      await screen.findByText('친구 독서');

      // Then
      await waitFor(() =>
        expect(countGetRequests(httpClient)).toEqual({
          'v1/auth/me': 1,
          'v1/auth/preference': 1,
          'v1/entitlements': 1,
          'v1/notifications/inbox/unread-count': 1,
          'v1/invites/availability': 1,
          'v1/follows/friends': 1,
          [FRIEND_TODOS_PATH]: 1,
          [FRIEND_COMPLETIONS_PATH]: 3,
        }),
      );
    });

    it('오늘 할 일이 없는 친구에게는 독촉 콕을 권하고 다른 날에는 권하지 않는다', async () => {
      // Given
      await renderFeed({
        params: { friendId: FRIEND_ID },
        server: {
          get: {
            ...FRIEND_SERVER,
            [FRIEND_TODOS_PATH]: ok(createTodoListResponseDto({ items: [] })),
          },
        },
      });
      expect(await screen.findByText('콕 눌러 오늘의 시작을 응원해보세요')).toBeOnTheScreen();

      // When
      await fireEvent.press(screen.getByLabelText('2026년 11월 12일'));

      // Then
      await waitFor(() =>
        expect(screen.queryByText('콕 눌러 오늘의 시작을 응원해보세요')).toBeNull(),
      );
      expect(screen.getByText('친구가 아직 할 일을 만들지 않았어요')).toBeOnTheScreen();
    });

    it('친구 피드에서 나를 누르면 내 피드로 돌아온다', async () => {
      // Given
      await renderFeed({ params: { friendId: FRIEND_ID }, server: { get: FRIEND_SERVER } });
      await screen.findByText('친구 독서');

      // When
      await fireEvent.press(screen.getByTestId('friend-strip-me'));

      // Then
      expect(await screen.findByText('운동')).toBeOnTheScreen();
      expect(screen.queryByText('친구 독서')).toBeNull();
    });

    it('더는 친구가 아닌 사람의 피드 링크로 열면 내 피드로 돌아온다', async () => {
      // When
      await renderFeed({ params: { friendId: FORMER_FRIEND_ID }, server: { get: FRIEND_SERVER } });

      // Then
      expect(await screen.findByText('운동')).toBeOnTheScreen();
      expect(router.setParams).toHaveBeenCalledWith(
        expect.objectContaining({ friendId: undefined }),
      );
    });

    it('친구인지 확인하는 동안에도 달력을 보이고 그날 할 일을 함께 받기 시작한다', async () => {
      // Given
      const friends = createPendingResponse(ok(createFriendsListDto()));

      // When
      const { httpClient } = await renderFeed({
        params: { friendId: FRIEND_ID },
        server: { get: { ...FRIEND_SERVER, 'v1/follows/friends': () => friends.response } },
      });

      // Then
      expect(await screen.findByTestId('calendar-pager')).toBeOnTheScreen();
      expect(screen.queryByText('친구 독서')).toBeNull();
      await waitFor(() =>
        expect(httpClient.get).toHaveBeenCalledWith(FRIEND_TODOS_PATH, expect.anything()),
      );

      // When
      await act(async () => friends.settle());

      // Then
      expect(await screen.findByText('친구 독서')).toBeOnTheScreen();
      expect(countGetRequests(httpClient)[FRIEND_TODOS_PATH]).toBe(1);
    });

    it('친구 목록을 읽지 못하면 달력은 둔 채 오류를 보이고 다시 시도하면 친구의 할 일을 보인다', async () => {
      // Given
      silenceConsole('error');
      let isServerDown = true;
      await renderFeed({
        params: { friendId: FRIEND_ID },
        server: {
          get: {
            ...FRIEND_SERVER,
            'v1/follows/friends': async () => {
              if (isServerDown) {
                throw new ServerError(500);
              }
              return ok(createFriendsListDto());
            },
          },
        },
      });
      expect(await screen.findByText(LOAD_ERROR)).toBeOnTheScreen();
      expect(screen.getByTestId('calendar-pager')).toBeOnTheScreen();
      isServerDown = false;
      const retry = screen.getAllByRole('button', { name: '다시 시도' }).at(-1);
      if (retry == null) {
        throw new Error('다시 시도 버튼이 없습니다');
      }

      // When
      await fireEvent.press(retry);

      // Then
      expect(await screen.findByText('친구 독서')).toBeOnTheScreen();
      expect(screen.queryByText(LOAD_ERROR)).toBeNull();
    });

    it('친구의 할 일을 누르면 좁은 화면에서는 상세 화면으로 간다', async () => {
      // Given
      await renderFeed({ params: { friendId: FRIEND_ID }, server: { get: FRIEND_SERVER } });

      // When
      await fireEvent.press(await screen.findByText('친구 독서'));

      // Then
      expect(router.navigate).toHaveBeenCalledWith({
        pathname: '/todo/[todoId]',
        params: { todoId: 31 },
      });
    });
  });

  describe('상세 칸', () => {
    it('좁은 화면에서 댓글을 누르면 상세 화면으로 이동하고 옆 칸을 열지 않는다', async () => {
      // Given
      await renderFeed();
      await screen.findByText('운동');
      const [openWorkout] = screen.getAllByLabelText('댓글');
      if (openWorkout == null) {
        throw new Error('댓글 버튼이 없습니다');
      }

      // When
      await fireEvent.press(openWorkout);

      // Then
      expect(router.navigate).toHaveBeenCalledWith({
        pathname: '/todo/[todoId]',
        params: { todoId: 1 },
      });
      expect(screen.queryByTestId('todo-detail')).toBeNull();
    });

    it('넓은 화면에서 댓글을 누르면 옆 칸에 그 할 일의 상세가 열리고 다른 할 일을 고르면 바뀐다', async () => {
      // Given
      const details = () => new Promise<never>(noop);
      const { httpClient } = await renderFeed({
        width: FOLD_WIDTH,
        server: {
          get: {
            'v1/todos/1/details': details,
            'v1/todos/2/details': details,
            'v1/todos/1/comments': details,
            'v1/todos/2/comments': details,
          },
        },
      });
      await screen.findByText('운동');
      expect(screen.queryByTestId('todo-detail')).toBeNull();
      const [openWorkout, openMeeting] = screen.getAllByLabelText('댓글');
      if (openWorkout == null || openMeeting == null) {
        throw new Error('댓글 버튼이 없습니다');
      }

      // When
      await fireEvent.press(openWorkout);

      // Then
      expect(await screen.findByTestId('todo-detail')).toBeOnTheScreen();
      expect(router.navigate).not.toHaveBeenCalled();
      await waitFor(() =>
        expect(httpClient.get).toHaveBeenCalledWith('v1/todos/1/details', expect.anything()),
      );

      // When
      await fireEvent.press(openMeeting);

      // Then
      await waitFor(() =>
        expect(httpClient.get).toHaveBeenCalledWith('v1/todos/2/details', expect.anything()),
      );
      expect(screen.getByTestId('todo-detail')).toBeOnTheScreen();
    });
  });

  describe('안내와 배너', () => {
    it('가입한 지 얼마 안 됐고 아직 할 일을 끝낸 적이 없으면 시작 체크리스트를 보인다', async () => {
      // When
      await renderFeed({
        server: {
          get: {
            'v1/auth/me': ok(createCurrentUserDto({ createdAt: '2026-11-10T00:00:00.000Z' })),
            'v1/todos/overview': ok({
              hasTodo: true,
              hasCompletedTodo: false,
              hasActiveRepeat: false,
            }),
          },
        },
      });

      // Then
      expect(await screen.findByText('첫 할 일을 만들고 완료해보세요')).toBeOnTheScreen();
    });

    it('가입한 지 오래됐으면 시작 체크리스트를 보이지 않고 할 일 기록도 묻지 않는다', async () => {
      // When
      const { httpClient } = await renderFeed();
      await screen.findByText('운동');
      await screen.findByText('자주 하는 일을 반복으로 만들어요');

      // Then
      expect(screen.queryByText('첫 할 일을 만들고 완료해보세요')).toBeNull();
      expect(httpClient.get).not.toHaveBeenCalledWith('v1/todos/overview', expect.anything());
    });

    it('알림을 거절했고 오늘 알림이 갈 할 일이 남아 있으면 알림 안내를 보이고 닫으면 사라진다', async () => {
      // Given
      const pushNotification = createPushNotificationGatewayStub();
      pushNotification.getPermission.mockResolvedValue(
        createPushPermissionResponse({ status: 'denied', canAskAgain: false }),
      );
      await renderFeed({
        ports: { pushNotification },
        server: {
          todosByDate: {
            [TODAY]: [
              createTodoDto({
                id: 4,
                title: '저녁 약속',
                startDate: TODAY,
                scheduledTime: new Date(2026, 10, 11, 20).toISOString(),
              }),
            ],
          },
        },
      });
      expect(await screen.findByText('알림이 꺼져 있어요')).toBeOnTheScreen();

      // When
      await fireEvent.press(screen.getByLabelText('알림 안내 닫기'));

      // Then
      await waitFor(() => expect(screen.queryByText('알림이 꺼져 있어요')).toBeNull());
    });

    it('알림이 켜져 있으면 알림 안내를 보이지 않는다', async () => {
      // When
      await renderFeed();
      await screen.findByText('운동');
      await screen.findByText('자주 하는 일을 반복으로 만들어요');

      // Then
      expect(screen.queryByText('알림이 꺼져 있어요')).toBeNull();
    });

    it('오늘 할 일을 다 끝낸 날에는 초대 안내를 보이고 닫으면 사라진다', async () => {
      // Given
      await renderFeed({
        server: {
          get: {
            'v1/invites/availability': ok({ enabled: true }),
            'v1/invites/me': fail(createApiError(ErrorCode.INVITE_2101)),
            'v1/todos/summary': ok(
              createTodoSummaryDto({ completedTodos: 2, completionRate: 100, isComplete: true }),
            ),
          },
        },
      });
      expect(await screen.findByText('친구와 같이 하면 더 오래 이어가요')).toBeOnTheScreen();

      // When
      await fireEvent.press(screen.getByLabelText('오늘은 그만 보기'));

      // Then
      await waitFor(() =>
        expect(screen.queryByText('친구와 같이 하면 더 오래 이어가요')).toBeNull(),
      );
    });

    it('프리미엄이면 AI 제안을 받아 온다', async () => {
      // When
      const premium = await renderFeed({
        server: {
          get: {
            'v1/entitlements': ok(createEntitlementSnapshotDto({ tier: 'PREMIUM' })),
            'v1/ai/suggestions': () => new Promise<never>(noop),
            'v1/ai/consent': () => new Promise<never>(noop),
          },
        },
      });

      // Then
      await waitFor(() =>
        expect(premium.httpClient.get).toHaveBeenCalledWith('v1/ai/suggestions', expect.anything()),
      );
      expect(screen.queryByText('자주 하는 일을 반복으로 만들어요')).toBeNull();
    });
  });

  describe('새 기능 소개', () => {
    // Jest 환경에는 한가할 때 부르는 콜백이 없다. 바로 불러 첫 피드가 소개를 여는 데까지 간다
    beforeEach(() => {
      Object.defineProperty(globalThis, 'requestIdleCallback', {
        configurable: true,
        value: (callback: IdleRequestCallback) => {
          callback({ didTimeout: false, timeRemaining: () => 10 });
          return 1;
        },
      });
      Object.defineProperty(globalThis, 'cancelIdleCallback', {
        configurable: true,
        value: noop,
      });
    });

    afterEach(() => {
      Reflect.deleteProperty(globalThis, 'requestIdleCallback');
      Reflect.deleteProperty(globalThis, 'cancelIdleCallback');
    });

    it('서버가 켠 새 기능 소개를 첫 피드에서 한 번 열고, 다시 볼 카드를 남겨 닫을 수 있게 한다', async () => {
      // Given
      const jsonFetcher = createJsonFetcherStub();
      jsonFetcher.get.mockResolvedValue(CAMPAIGN_CONFIG);

      // When
      await renderFeed({ ports: { jsonFetcher }, guard: 'closed' });

      // Then
      await waitFor(() =>
        expect(router.push).toHaveBeenCalledWith({
          pathname: '/whats-new',
          params: { releaseId: RELEASE_1_17_0.id, source: 'auto' },
        }),
      );
      expect(await screen.findByText('새로운 기능을 만나보세요')).toBeOnTheScreen();

      // When
      await fireEvent.press(screen.getByLabelText('새로운 기능 카드 닫기'));

      // Then
      await waitFor(() => expect(screen.queryByText('새로운 기능을 만나보세요')).toBeNull());
      expect(router.push).toHaveBeenCalledTimes(1);
    });

    it('알림 화면을 열지 아직 정하지 못했으면 새 기능 소개를 열지 않는다', async () => {
      // Given
      const jsonFetcher = createJsonFetcherStub();
      jsonFetcher.get.mockResolvedValue(CAMPAIGN_CONFIG);
      await renderFeed({ ports: { jsonFetcher }, guard: 'pending' });
      await screen.findByText('운동');

      // When
      await act(() => jest.advanceTimersByTimeAsync(POPOVER_WAIT.timeout));

      // Then
      expect(router.push).not.toHaveBeenCalled();
      expect(screen.queryByText('새로운 기능을 만나보세요')).toBeNull();
    });
  });

  describe('말풍선', () => {
    // RN의 measure는 이미 jest.fn이라 restoreMocks가 구현을 되돌리지 못한다. 쓰고 나면 직접 비운다
    beforeEach(() => {
      jest.spyOn(View.prototype, 'measure').mockImplementation((callback) => {
        if (typeof callback === 'function') {
          callback(0, 0, 44, 44, 16, 300);
        }
      });
      jest.spyOn(View.prototype, 'measureInWindow').mockImplementation((callback) => {
        if (typeof callback === 'function') {
          callback(16, 300, 44, 44);
        }
      });
    });

    afterEach(() => {
      jest.mocked(View.prototype.measure).mockReset();
      jest.mocked(View.prototype.measureInWindow).mockReset();
    });

    async function renderFeedWithCoachmarks({
      seen = [],
      ...options
    }: RenderFeedOptions & { seen?: readonly CoachmarkKind[] }) {
      const analytics = createAnalyticsStub();
      const { syncStorage, records } = createCoachmarkStorage(
        seen.map((kind) => ({ accountId: ME_ID, kind })),
      );
      const feed = await renderFeed({ ...options, ports: { syncStorage, analytics } });

      return {
        ...feed,
        records,
        getShownCoachmarks: () =>
          analytics.trackEvent.mock.calls
            .filter(([eventName]) => eventName === 'coachmark_shown')
            .map(([, params]) => params),
      };
    }

    function getFeedScroll() {
      const [feedScroll] = findHostsWithProp('refreshControl');
      if (feedScroll == null) {
        throw new Error('피드 스크롤이 없습니다');
      }
      return feedScroll;
    }

    it('앞서 뜰 알림 화면이 없다고 정해지면 친구가 없는 계정에 친구 줄 안내를 띄우고, 피드를 내리면 닫는다', async () => {
      // Given
      const { records, getShownCoachmarks } = await renderFeedWithCoachmarks({ guard: 'closed' });
      await screen.findByTestId('hint-popover', {}, POPOVER_WAIT);
      expect(getShownCoachmarks()).toEqual([{ kind: 'friend-strip' }]);

      // When
      await fireEvent(getFeedScroll(), 'scrollBeginDrag');

      // Then
      await waitFor(() => expect(screen.queryByTestId('hint-popover')).toBeNull());
      expect(records.hasSeen({ accountId: ME_ID, kind: 'friend-strip' })).toBe(true);
    });

    it('알림 화면을 열지 아직 정하지 못했으면 안내를 띄우지 않는다', async () => {
      // Given
      const { getShownCoachmarks } = await renderFeedWithCoachmarks({ guard: 'pending' });
      await screen.findByText('운동');

      // When
      await act(() => jest.advanceTimersByTimeAsync(POPOVER_WAIT.timeout));

      // Then
      expect(screen.queryByTestId('hint-popover')).toBeNull();
      expect(getShownCoachmarks()).toEqual([]);
    });

    it('친구 줄 안내가 남은 동안에는 AI 안내를 띄우지 않고, 닫은 뒤에 띄운다', async () => {
      // Given
      const { getShownCoachmarks } = await renderFeedWithCoachmarks({ guard: 'closed' });
      await screen.findByTestId('hint-popover', {}, POPOVER_WAIT);
      await act(() => jest.advanceTimersByTimeAsync(POPOVER_WAIT.timeout));
      expect(getShownCoachmarks()).toEqual([{ kind: 'friend-strip' }]);

      // When
      await fireEvent(getFeedScroll(), 'scrollBeginDrag');
      await fireEvent(getFeedScroll(), 'scrollEndDrag');

      // Then
      await waitFor(
        () =>
          expect(getShownCoachmarks()).toEqual([
            { kind: 'friend-strip' },
            { kind: 'ai-feature-update' },
          ]),
        POPOVER_WAIT,
      );
    });

    it('피드가 움직이는 동안에는 AI 안내를 내렸다가 멈추면 다시 띄우고 본 것으로 남기지 않는다', async () => {
      // Given
      const { records, getShownCoachmarks } = await renderFeedWithCoachmarks({
        guard: 'closed',
        seen: ['friend-strip'],
      });
      await screen.findByTestId('hint-popover', {}, POPOVER_WAIT);
      expect(getShownCoachmarks()).toEqual([{ kind: 'ai-feature-update' }]);

      // When
      await fireEvent(getFeedScroll(), 'momentumScrollBegin');

      // Then
      await waitFor(() => expect(screen.queryByTestId('hint-popover')).toBeNull());
      expect(records.hasSeen({ accountId: ME_ID, kind: 'ai-feature-update' })).toBe(false);

      // When
      await fireEvent(getFeedScroll(), 'momentumScrollEnd');

      // Then
      expect(await screen.findByTestId('hint-popover', {}, POPOVER_WAIT)).toBeOnTheScreen();
    });

    it('반복을 미리 만드는 기간을 넘긴 날을 보면 안내 줄을 두고, 진행 중인 반복이 있으면 설명을 스스로 띄운다', async () => {
      // When
      const { httpClient, getShownCoachmarks } = await renderFeedWithCoachmarks({
        params: { date: BEYOND_REPEAT_HORIZON },
        guard: 'closed',
        seen: ['friend-strip', 'ai-feature-update'],
        server: { get: { 'v1/todos/overview': ok(ACTIVE_REPEAT_OVERVIEW) } },
      });

      // Then
      expect(await screen.findByTestId('repeat-horizon-hint')).toBeOnTheScreen();
      await screen.findByTestId('hint-popover', {}, POPOVER_WAIT);
      expect(getShownCoachmarks()).toEqual([{ kind: 'repeat-horizon' }]);
      expect(countGetRequests(httpClient)['v1/todos/overview']).toBe(1);
    });

    it('알림 화면을 열지 아직 정하지 못했으면 진행 중인 반복이 있어도 반복 설명을 미룬다', async () => {
      // Given
      const { getShownCoachmarks } = await renderFeedWithCoachmarks({
        params: { date: BEYOND_REPEAT_HORIZON },
        guard: 'pending',
        seen: ['friend-strip', 'ai-feature-update'],
        server: { get: { 'v1/todos/overview': ok(ACTIVE_REPEAT_OVERVIEW) } },
      });
      await screen.findByTestId('repeat-horizon-hint');

      // When
      await act(() => jest.advanceTimersByTimeAsync(POPOVER_WAIT.timeout));

      // Then
      expect(getShownCoachmarks()).toEqual([]);
    });

    it('진행 중인 반복이 없으면 기간을 넘긴 날에도 설명을 스스로 띄우지 않고, 안내 줄을 누르면 띄운다', async () => {
      // Given
      const { getShownCoachmarks } = await renderFeedWithCoachmarks({
        params: { date: BEYOND_REPEAT_HORIZON },
        guard: 'closed',
        seen: ['friend-strip', 'ai-feature-update'],
      });
      const hint = await screen.findByTestId('repeat-horizon-hint');
      await act(() => jest.advanceTimersByTimeAsync(POPOVER_WAIT.timeout));
      expect(getShownCoachmarks()).toEqual([]);

      // When
      await fireEvent.press(hint);

      // Then
      await screen.findByTestId('hint-popover', {}, POPOVER_WAIT);
      expect(getShownCoachmarks()).toEqual([{ kind: 'repeat-horizon' }]);
    });

    it('보는 날이 미리 만드는 기간 안이면 반복 안내 줄을 두지 않는다', async () => {
      // When
      await renderFeed();
      await screen.findByText('운동');

      // Then
      expect(screen.queryByTestId('repeat-horizon-hint')).toBeNull();
    });
  });

  describe('로딩과 오류', () => {
    it('목록을 받는 동안에는 할 일 대신 자리 표시를 보이고 받은 뒤 할 일을 보인다', async () => {
      // Given
      const todos = createPendingResponse(ok(createTodoListResponseDto({ items: [WORKOUT] })));

      // When
      await renderFeed({ server: { get: { 'v1/todos': () => todos.response } } });

      // Then
      expect(screen.queryByText('운동')).toBeNull();
      expect(screen.queryByText(LOAD_ERROR)).toBeNull();

      // When
      await act(async () => todos.settle());

      // Then
      expect(await screen.findByText('운동')).toBeOnTheScreen();
    });

    it('목록 조회가 실패하면 오류를 보이고 다시 시도하면 목록을 받는다', async () => {
      // Given
      silenceConsole('error');
      let isServerDown = true;
      await renderFeed({
        server: {
          get: {
            'v1/todos': async () => {
              if (isServerDown) {
                throw new ServerError(500);
              }
              return ok(createTodoListResponseDto({ items: [WORKOUT] }));
            },
          },
        },
      });
      expect(await screen.findByText(LOAD_ERROR)).toBeOnTheScreen();
      expect(screen.getByLabelText('내 할 일 보기')).toBeOnTheScreen();
      isServerDown = false;

      // When
      await fireEvent.press(screen.getByRole('button', { name: '다시 시도' }));

      // Then
      expect(await screen.findByText('운동')).toBeOnTheScreen();
      expect(screen.queryByText(LOAD_ERROR)).toBeNull();
    });

    it('당겨서 새로고침하면 보고 있는 날의 목록을 다시 받는다', async () => {
      // Given
      const { httpClient } = await renderFeed();
      await screen.findByText('운동');
      const [feedScroll] = findHostsWithProp('refreshControl');
      if (feedScroll == null) {
        throw new Error('피드 스크롤이 없습니다');
      }

      // When
      await act(async () => feedScroll.props.refreshControl.props.onRefresh());

      // Then
      await waitFor(() => expect(getTodoRequestDates(httpClient)).toEqual([TODAY, TODAY]));
    });
  });
});
