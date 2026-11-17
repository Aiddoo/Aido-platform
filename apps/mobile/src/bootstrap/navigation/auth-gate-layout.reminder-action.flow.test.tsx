import { ErrorCode, HttpStatus } from '@aido/api/errors';
import { err, ok, type Result } from '@src/core/errors/result';
import type { PushNotificationResponse } from '@src/core/ports/push-notification-gateway';
import { createAuthSessionStoreStub } from '@src/features/identity/auth/__tests__/create-auth-session-store-stub';
import { createPreferenceDto } from '@src/features/identity/preference/__tests__/preference.fixtures';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { createMarkReadResponseDto } from '@src/features/notification/__tests__/notification.fixtures';
import { createTodoDto } from '@src/features/planning/todo/__tests__/todo.fixtures';
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
  complete?: () => HttpResult;
  snooze?: () => HttpResult;
}

function createStackLayout(unstableSettings: { anchor: string }) {
  return {
    default: () => <Stack screenOptions={{ headerShown: false, animation: 'none' }} />,
    unstable_settings: unstableSettings,
  };
}

async function setup({ complete, snooze }: SetupOptions = {}) {
  const gateway = createPushNotificationGatewayStub();
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(async (url: string) => {
    if (url === 'v1/auth/me') {
      return ok(createCurrentUserDto());
    }
    if (url === 'v1/auth/preference') {
      return ok(createPreferenceDto());
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

  return { route, gateway, httpClient, haptics: di.haptics, analytics: di.analytics };
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
