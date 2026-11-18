import { ErrorCode, HttpStatus } from '@aido/api/errors';
import { err, ok, type Result } from '@src/core/errors/result';
import type { PushNotificationResponse } from '@src/core/ports/push-notification-gateway';
import { createAuthSessionStoreStub } from '@src/features/identity/auth/__tests__/create-auth-session-store-stub';
import { createPreferenceDto } from '@src/features/identity/preference/__tests__/preference.fixtures';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { createMarkReadResponseDto } from '@src/features/notification/__tests__/notification.fixtures';
import {
  createTodoApiError,
  createTodoDetails,
  createTodoDto,
} from '@src/features/planning/todo/__tests__/todo.fixtures';
import { TODO_QUERY_KEYS } from '@src/features/planning/todo/queries/todo-query-keys';
import { ApiError, NetworkError } from '@src/shared/errors';
import {
  createHttpClientStub,
  createPushNotificationGatewayStub,
  createTestDi,
  stubWindowDimensions,
} from '@src/testing/core';
import { renderAppRoute } from '@src/testing/render-route-hook';
import * as ExpoLinking from 'expo-linking';
import { Stack, Tabs } from 'expo-router';
import { act, screen, waitFor } from 'expo-router/testing-library';
import { Linking, Text } from 'react-native';

import { unstable_settings as feedTabSettings } from '../../../app/(app)/(tabs)/(todos)/_layout';
import { unstable_settings as tabsSettings } from '../../../app/(app)/(tabs)/_layout';
import { unstable_settings as appSettings } from '../../../app/(app)/_layout';
import RootIndex from '../../../app/index';
import { AuthGateLayout } from './auth-gate-layout';

// renderRouter는 실제 라우터로 URL·이동을 검증하므로 jest.setup의 전역 mock을 끈다
jest.unmock('expo-router');

const NOTIFICATION_ID = 7;
const TODO_ID = 42;
const COMPLETE_PATH = `v1/todos/${TODO_ID}/complete`;
const DETAILS_PATH = `v1/todos/${TODO_ID}/details`;
const SNOOZE_PATH = `v1/todo-reminders/${TODO_ID}/snoozes`;

function createReminderResponse(actionIdentifier: 'complete' | 'snooze'): PushNotificationResponse {
  return {
    id: `response-${actionIdentifier}`,
    actionIdentifier,
    data: {
      notificationId: NOTIFICATION_ID,
      type: 'TODO_REMINDER',
      action: { type: 'DEEP_LINK' },
      navigation: { kind: 'TODO', todoId: TODO_ID, todoDate: '2026-11-18' },
    },
  };
}

type HttpResult = Promise<Result<unknown, ApiError>>;

interface SetupOptions {
  details?: () => HttpResult;
  complete?: () => HttpResult;
  snooze?: () => HttpResult;
}

/** 서버가 지금 주는 그 할 일의 상세 */
function createDetailsDto({ completed }: { completed: boolean }) {
  return {
    todo: createTodoDto({ id: TODO_ID, title: '저녁 운동', completed }),
    owner: { id: 'clz7x5p8k0010qz0z8z8z8z8z', name: '나', profileImage: null },
    permissions: { canEdit: true, canComment: true, canNudge: false },
    metrics: { viewCount: 0, commentCount: 0 },
  };
}

function createTodoUnavailableError() {
  return createTodoApiError({ code: ErrorCode.TODO_0801, message: '할 일을 찾을 수 없어요' });
}

function createStackLayout(unstableSettings: { anchor: string }) {
  return {
    default: () => <Stack screenOptions={{ headerShown: false, animation: 'none' }} />,
    unstable_settings: unstableSettings,
  };
}

async function setup({
  details = async () => ok(createDetailsDto({ completed: false })),
  complete,
  snooze,
}: SetupOptions = {}) {
  const gateway = createPushNotificationGatewayStub();
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(async (url: string) => {
    if (url === 'v1/auth/me') {
      return ok(createCurrentUserDto());
    }
    if (url === 'v1/auth/preference') {
      return ok(createPreferenceDto());
    }
    if (url === DETAILS_PATH) {
      return details();
    }
    return ok({ unreadCount: 0 });
  });
  httpClient.patch.mockImplementation(async (url: string) => {
    if (url === COMPLETE_PATH && complete != null) {
      return complete();
    }
    return ok(createMarkReadResponseDto());
  });
  httpClient.post.mockImplementation(async (url: string) => {
    if (url === SNOOZE_PATH && snooze != null) {
      return snooze();
    }
    return ok({ opened: true });
  });
  const di = createTestDi({
    ports: { httpClient, pushNotification: gateway },
    seeds: { authSessionStore: createAuthSessionStoreStub('authenticated') },
  });

  const routes = {
    _layout: AuthGateLayout,
    index: RootIndex,
    '(app)/_layout': createStackLayout(appSettings),
    // NativeTabs는 Jest에서 그려지지 않아 같은 탭 라우터를 쓰는 JS Tabs로 대신한다
    '(app)/(tabs)/_layout': {
      default: () => (
        <Tabs screenOptions={{ headerShown: false }}>
          <Tabs.Screen name="(todos)" />
        </Tabs>
      ),
      unstable_settings: tabsSettings,
    },
    '(app)/(tabs)/(todos)/_layout': createStackLayout(feedTabSettings),
    '(app)/(tabs)/(todos)/feed/index': () => <Text>Feed</Text>,
    '(app)/todo/[todoId]/index': () => <Text testID="todo-detail">Todo details</Text>,
  };
  const route = await renderAppRoute(routes, { url: '/', di, withLocalDate: true });
  await waitFor(() => expect(route.getPathname()).toBe('/feed'));

  return {
    route,
    gateway,
    httpClient,
    queryClient: route.queryClient,
    haptics: di.haptics,
    analytics: di.analytics,
  };
}

describe('리마인드 알림 버튼', () => {
  beforeEach(() => {
    stubWindowDimensions(390);
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
    jest.mocked(ExpoLinking.useLinkingURL).mockReturnValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('완료를 누르면 할 일 화면을 열고 완료한 뒤 그 할 일 이름으로 알린다', async () => {
    // Given
    const { route, gateway, httpClient, analytics } = await setup({
      complete: async () =>
        ok({
          message: '할 일이 완료되었습니다.',
          todo: createTodoDto({ id: TODO_ID, title: '저녁 운동', completed: true }),
        }),
    });

    // When
    await act(async () => gateway.emitResponse(createReminderResponse('complete')));

    // Then
    await waitFor(() => expect(route.getPathname()).toBe(`/todo/${TODO_ID}`));
    expect(await screen.findAllByText('‘저녁 운동’ 완료했어요')).not.toHaveLength(0);
    expect(httpClient.patch).toHaveBeenCalledWith(COMPLETE_PATH, { completed: true });
    expect(analytics.trackEvent).toHaveBeenCalledWith('todo_reminder_action_tapped', {
      action: 'complete',
      outcome: 'succeeded',
    });
  });

  it('완료를 누른 때 연결이 끊겼으면 할 일 화면은 열고 연결 오류를 알린다', async () => {
    // Given
    const { route, gateway, analytics } = await setup({
      complete: async () => {
        throw new NetworkError();
      },
    });

    // When
    await act(async () => gateway.emitResponse(createReminderResponse('complete')));

    // Then
    await waitFor(() => expect(route.getPathname()).toBe(`/todo/${TODO_ID}`));
    expect(await screen.findAllByText('인터넷 연결을 확인해주세요')).not.toHaveLength(0);
    await waitFor(() =>
      expect(analytics.trackEvent).toHaveBeenCalledWith('todo_reminder_action_tapped', {
        action: 'complete',
        outcome: 'failed',
      }),
    );
  });

  it.each([
    {
      name: '캐시는 열린 할 일이어도 서버가 끝냈다고 하면 완료를 보내지 않고 끝냈다고만 알린다',
      cachedCompleted: false,
      serverCompleted: true,
      message: '이미 완료한 할 일이에요',
      outcome: 'already_completed',
      patchCount: 0,
    },
    {
      name: '캐시는 끝낸 할 일이어도 서버가 열려 있다고 하면 완료한다',
      cachedCompleted: true,
      serverCompleted: false,
      message: '‘저녁 운동’ 완료했어요',
      outcome: 'succeeded',
      patchCount: 1,
    },
  ])('$name', async ({ cachedCompleted, serverCompleted, message, outcome, patchCount }) => {
    // Given
    const { gateway, httpClient, queryClient, analytics } = await setup({
      details: async () => ok(createDetailsDto({ completed: serverCompleted })),
      complete: async () =>
        ok({
          message: '할 일이 완료되었습니다.',
          todo: createTodoDto({ id: TODO_ID, title: '저녁 운동', completed: true }),
        }),
    });
    const cached = createTodoDetails();
    queryClient.setQueryData(
      TODO_QUERY_KEYS.detail({ todoId: TODO_ID }),
      createTodoDetails({ todo: { ...cached.todo, id: TODO_ID, completed: cachedCompleted } }),
    );

    // When
    await act(async () => gateway.emitResponse(createReminderResponse('complete')));

    // Then
    expect(await screen.findAllByText(message)).not.toHaveLength(0);
    expect(httpClient.patch.mock.calls.filter(([url]) => url === COMPLETE_PATH)).toHaveLength(
      patchCount,
    );
    expect(analytics.trackEvent).toHaveBeenCalledWith('todo_reminder_action_tapped', {
      action: 'complete',
      outcome,
    });
  });

  it.each([
    {
      name: '완료를 누른 할 일을 지웠으면',
      action: 'complete' as const,
      setupOptions: { details: async () => err(createTodoUnavailableError()) },
    },
    {
      name: '완료를 보내는 사이 할 일을 지웠으면',
      action: 'complete' as const,
      setupOptions: { complete: async () => err(createTodoUnavailableError()) },
    },
    {
      name: '10분 뒤 다시를 누른 할 일을 지웠으면',
      action: 'snooze' as const,
      setupOptions: { snooze: async () => err(createTodoUnavailableError()) },
    },
  ])(
    '$name 할 일 화면의 안내에 맡기고 전역 오류를 더 띄우지 않는다',
    async ({ action, setupOptions }) => {
      // Given
      const { route, gateway, haptics, analytics } = await setup(setupOptions);

      // When
      await act(async () => gateway.emitResponse(createReminderResponse(action)));

      // Then
      await waitFor(() => expect(route.getPathname()).toBe(`/todo/${TODO_ID}`));
      await waitFor(() =>
        expect(analytics.trackEvent).toHaveBeenCalledWith('todo_reminder_action_tapped', {
          action,
          outcome: 'not_found',
        }),
      );
      expect(screen.queryByText('할 일을 찾을 수 없어요')).toBeNull();
      expect(haptics.notify).not.toHaveBeenCalledWith('error');
    },
  );

  it('10분 뒤 다시를 누르면 할 일 화면을 열고 누른 알림으로 다시 알림을 예약한다', async () => {
    // Given
    const { route, gateway, httpClient, analytics } = await setup({
      snooze: async () => ok({ remindAt: '2026-11-18T11:40:00.000Z' }),
    });

    // When
    await act(async () => gateway.emitResponse(createReminderResponse('snooze')));

    // Then
    await waitFor(() => expect(route.getPathname()).toBe(`/todo/${TODO_ID}`));
    expect(await screen.findAllByText('10분 뒤 다시 알려드릴게요')).not.toHaveLength(0);
    expect(screen.getAllByText(/에 알려드려요$/)).not.toHaveLength(0);
    expect(httpClient.post).toHaveBeenCalledWith(SNOOZE_PATH, {
      notificationId: NOTIFICATION_ID,
    });
    expect(analytics.trackEvent).toHaveBeenCalledWith('todo_reminder_action_tapped', {
      action: 'snooze',
      outcome: 'succeeded',
    });
  });

  it('버튼을 처리하면 그 알림을 알림 센터에서 지워 남은 버튼을 다시 누르지 않게 한다', async () => {
    // Given
    const { route, gateway } = await setup({
      snooze: async () => ok({ remindAt: '2026-11-18T11:40:00.000Z' }),
    });

    // When
    await act(async () => gateway.emitResponse(createReminderResponse('snooze')));

    // Then
    await waitFor(() => expect(route.getPathname()).toBe(`/todo/${TODO_ID}`));
    await waitFor(() =>
      expect(gateway.dismissNotification).toHaveBeenCalledWith('response-snooze'),
    );
    expect(gateway.dismissNotification).toHaveBeenCalledTimes(1);
  });

  it('이미 끝낸 할 일에 다시 알림을 누르면 오류 대신 끝냈다고만 알린다', async () => {
    // Given
    const { route, gateway, haptics, analytics } = await setup({
      snooze: async () =>
        err(
          new ApiError(
            ErrorCode.NOTIFICATION_1007,
            '이미 완료한 할 일입니다.',
            HttpStatus.CONFLICT,
          ),
        ),
    });

    // When
    await act(async () => gateway.emitResponse(createReminderResponse('snooze')));

    // Then
    await waitFor(() => expect(route.getPathname()).toBe(`/todo/${TODO_ID}`));
    expect(await screen.findAllByText('이미 완료한 할 일이에요')).not.toHaveLength(0);
    expect(haptics.notify).not.toHaveBeenCalledWith('error');
    expect(analytics.trackEvent).toHaveBeenCalledWith('todo_reminder_action_tapped', {
      action: 'snooze',
      outcome: 'already_completed',
    });
  });
});
