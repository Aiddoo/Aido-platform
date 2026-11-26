import '@src/shared/i18n/init';
import type { ApiError } from '@src/core/errors/api-error';
import { ok, type Result } from '@src/core/errors/result';
import { createAuthSessionStoreStub } from '@src/features/identity/auth/__tests__/create-auth-session-store-stub';
import { createPushOnboardingGuardStore } from '@src/features/notification/stores/push-onboarding-guard.store';
import {
  createTodoDto,
  createTodoListResponseDto,
} from '@src/features/planning/todo/__tests__/todo.fixtures';
import {
  createTodoServer,
  TODAY,
  TODAY_NOON,
} from '@src/features/planning/todo/__tests__/todo.test-utils';
import { createFriendsListDto } from '@src/features/social/friend/__tests__/friend.fixtures';
import {
  createAnalyticsStub,
  createRouteParamsFake,
  createTestDi,
  stubWindowDimensions,
  getTrackedEvents,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import FeedScreen from '../../../../../app/(app)/(tabs)/(todos)/feed/index';
import { createNudgeCooldownInfoDto, createSendNudgeResponseDto } from './todo-nudge.fixtures';

const FRIEND_ID = 'clz7x5p8k0005qz0z8z8z8z8z';
const FRIEND_NAME = '홍길동';
const FRIEND_TODO_ID = 31;
const FRIEND_TODOS_PATH = `v1/todos/friends/${FRIEND_ID}`;
const FRIEND_COOLDOWN_PATH = `v1/nudges/remind/cooldown/${FRIEND_ID}`;
const TODO_NUDGE_PLACEHOLDER = '(선택) 네 속도로 해도 괜찮아. 응원할게!';
const REMIND_PROMPT = '콕 눌러 오늘의 시작을 응원해보세요';

function createFriendServer({
  friendTodos,
  cooldown = ok(createNudgeCooldownInfoDto()),
}: {
  friendTodos: ReturnType<typeof createTodoDto>[];
  cooldown?: Result<unknown, ApiError>;
}) {
  return createTodoServer({
    get: {
      'v1/follows/friends': ok(createFriendsListDto()),
      [FRIEND_TODOS_PATH]: ok(createTodoListResponseDto({ items: friendTodos })),
      [`v1/daily-completions/friends/${FRIEND_ID}`]: ok({
        completions: [],
        totalCompleteDays: 0,
        dateRange: { startDate: '2026-11-01', endDate: '2026-12-05' },
      }),
      [FRIEND_COOLDOWN_PATH]: cooldown,
    },
  });
}

async function renderFriendFeed(httpClient: ReturnType<typeof createFriendServer>) {
  stubWindowDimensions(390);
  createRouteParamsFake({ friendId: FRIEND_ID });
  const analytics = createAnalyticsStub();
  const pushOnboardingGuardStore = createPushOnboardingGuardStore();
  pushOnboardingGuardStore.markRendered('closed');
  await renderScreen(<FeedScreen />, {
    withLocalDate: true,
    withOverlay: true,
    di: createTestDi({
      ports: { httpClient, analytics },
      seeds: {
        authSessionStore: createAuthSessionStoreStub('authenticated'),
        pushOnboardingGuardStore,
      },
    }),
  });

  return { analytics };
}

describe('친구 피드의 콕', () => {
  setupFakeTimersPerTest({ now: TODAY_NOON });

  it('친구의 오늘 할 일에 콕을 누르면 시트에서 그 할 일로 메시지를 보내고 시트를 닫는다', async () => {
    // Given
    const httpClient = createFriendServer({
      friendTodos: [createTodoDto({ id: FRIEND_TODO_ID, title: '친구 독서', startDate: TODAY })],
    });
    httpClient.post.mockResolvedValue(ok(createSendNudgeResponseDto()));
    const { analytics } = await renderFriendFeed(httpClient);
    await fireEvent.press(await screen.findByLabelText('콕 찌르기'));
    await fireEvent.changeText(
      await screen.findByPlaceholderText(TODO_NUDGE_PLACEHOLDER),
      ' 힘내! ',
    );

    // When
    await fireEvent.press(screen.getByRole('button', { name: '응원 보내기' }));

    // Then
    await waitFor(() => expect(screen.queryByPlaceholderText(TODO_NUDGE_PLACEHOLDER)).toBeNull());
    expect(httpClient.post).toHaveBeenCalledTimes(1);
    expect(httpClient.post).toHaveBeenCalledWith('v1/nudges', {
      receiverId: FRIEND_ID,
      todoId: FRIEND_TODO_ID,
      message: '힘내!',
    });
    expect(getTrackedEvents(analytics, 'nudge_sent')).toHaveLength(1);
  });

  it('오늘 할 일이 없는 친구에게 독촉 콕을 누르면 그 친구의 독촉 시트를 연다', async () => {
    // Given
    const httpClient = createFriendServer({ friendTodos: [] });
    await renderFriendFeed(httpClient);
    expect(await screen.findByText(REMIND_PROMPT)).toBeOnTheScreen();
    await waitFor(() => expect(screen.getByRole('button', { name: '콕 찌르기' })).toBeEnabled());

    // When
    await fireEvent.press(screen.getByRole('button', { name: '콕 찌르기' }));

    // Then
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/users/[userId]/nudge',
      params: { userId: FRIEND_ID, name: FRIEND_NAME },
    });
  });

  it('독촉 쿨다운 중이면 이미 찔렀다고 보이고 눌러도 시트를 열지 않는다', async () => {
    // Given
    const httpClient = createFriendServer({
      friendTodos: [],
      cooldown: ok(
        createNudgeCooldownInfoDto({
          canNudge: false,
          cooldownEndsAt: new Date(TODAY_NOON.getTime() + 30 * 60_000).toISOString(),
          remainingSeconds: 1800,
        }),
      ),
    });
    await renderFriendFeed(httpClient);
    const button = await screen.findByRole('button', { name: '이미 콕 찔렀어요' });

    // When
    await fireEvent.press(button);

    // Then
    expect(button).toBeDisabled();
    expect(router.push).not.toHaveBeenCalled();
  });
});
