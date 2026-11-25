import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import { countGetRequests } from '@src/features/planning/todo/__tests__/todo.test-utils';
import { NetworkError } from '@src/shared/errors/infra-error';
import {
  createAnalyticsStub,
  createHapticsGatewayStub,
  createHttpClientStub,
  createTestDi,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import BlockedUsersScreen from '../../../../../app/(app)/(tabs)/(me,memos,todos)/settings/blocked-users';
import {
  BLOCKED_USER_ID,
  createBlockedUserDto,
  createBlockedUsersDto,
} from './moderation.fixtures';

const OTHER_BLOCKED_USER_ID = 'clz7x5p8k0006qz0z8z8z8z8z';
const TWO_BLOCKED_USERS = createBlockedUsersDto({
  items: [
    createBlockedUserDto(),
    createBlockedUserDto({ id: OTHER_BLOCKED_USER_ID, userTag: 'MINA2026', name: '미나' }),
  ],
  totalCount: 2,
});
const ONE_BLOCKED_USER = createBlockedUsersDto({
  items: [createBlockedUserDto({ id: OTHER_BLOCKED_USER_ID, userTag: 'MINA2026', name: '미나' })],
  totalCount: 1,
});

async function renderBlockedUsers(httpClient: ReturnType<typeof createHttpClientStub>) {
  const analytics = createAnalyticsStub();
  const haptics = createHapticsGatewayStub();
  await renderScreen(<BlockedUsersScreen />, {
    di: createTestDi({ ports: { httpClient, analytics, haptics } }),
    withOverlay: true,
    withLocalDate: true,
  });

  return { analytics, haptics };
}

async function confirmUnblock(userId: string, name: string) {
  await act(async () => {
    // 누른 동작은 다이얼로그의 답을 기다리는 동안 끝나지 않아 기다리지 않는다
    fireEvent.press(screen.getByTestId(`blocked-user-unblock-${userId}`)).catch(() => undefined);
  });
  await screen.findByText(`${name}님 차단을 해제할까요?`);
  await fireEvent.press(screen.getByTestId('blocked-user-unblock-confirm'));
}

describe('BlockedUsersScreen', () => {
  it('처음 열면 차단 목록 첫 쪽을 한 번 받아 최근에 차단한 순서로 보인다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.get.mockResolvedValue(ok(TWO_BLOCKED_USERS));

    // When
    await renderBlockedUsers(httpClient);

    // Then
    expect(await screen.findByText('존')).toBeOnTheScreen();
    expect(screen.getByText('미나')).toBeOnTheScreen();
    expect(countGetRequests(httpClient)).toEqual({ 'v1/blocks': 1 });
    expect(httpClient.get).toHaveBeenCalledWith('v1/blocks', {
      signal: expect.any(AbortSignal),
      params: { cursor: undefined, limit: 20 },
    });
  });

  it('차단을 해제하면 한 번 해제하고 다시 받은 목록에서 그 사람이 빠진다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.get
      .mockResolvedValueOnce(ok(TWO_BLOCKED_USERS))
      .mockResolvedValue(ok(ONE_BLOCKED_USER));
    httpClient.delete.mockResolvedValue(ok({ message: '차단을 해제했습니다.' }));
    const { analytics } = await renderBlockedUsers(httpClient);
    await screen.findByText('존');

    // When
    await confirmUnblock(BLOCKED_USER_ID, '존');

    // Then
    await waitFor(() => expect(screen.queryByText('존')).toBeNull());
    expect(screen.getByText('미나')).toBeOnTheScreen();
    expect(httpClient.delete).toHaveBeenCalledTimes(1);
    expect(httpClient.delete).toHaveBeenCalledWith(`v1/blocks/${BLOCKED_USER_ID}`);
    expect(await screen.findByText('차단을 해제했어요')).toBeOnTheScreen();
    expect(
      analytics.trackEvent.mock.calls.filter(([name]) => name === 'user_unblocked'),
    ).toHaveLength(1);
  });

  it('해제하지 못하면 한 번 알리고 그 사람을 목록에 남긴다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.get.mockResolvedValue(ok(TWO_BLOCKED_USERS));
    httpClient.delete.mockRejectedValue(new NetworkError());
    const { haptics } = await renderBlockedUsers(httpClient);
    await screen.findByText('존');

    // When
    await confirmUnblock(BLOCKED_USER_ID, '존');

    // Then
    expect(await screen.findAllByText(new NetworkError().message)).not.toHaveLength(0);
    expect(haptics.notify).toHaveBeenCalledTimes(1);
    expect(haptics.notify).toHaveBeenCalledWith('error');
    expect(countGetRequests(httpClient)).toEqual({ 'v1/blocks': 1 });
    await fireEvent.press(screen.getByRole('button', { name: '취소' }));
    expect(screen.getByText('존')).toBeOnTheScreen();
  });

  it('마지막 사람을 해제하면 빈 목록 안내를 보인다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.get
      .mockResolvedValueOnce(ok(createBlockedUsersDto()))
      .mockResolvedValue(ok(createBlockedUsersDto({ items: [], totalCount: 0 })));
    httpClient.delete.mockResolvedValue(ok({ message: '차단을 해제했습니다.' }));
    await renderBlockedUsers(httpClient);
    await screen.findByText('존');

    // When
    await confirmUnblock(BLOCKED_USER_ID, '존');

    // Then
    expect(await screen.findByTestId('blocked-users-empty')).toBeOnTheScreen();
  });
});
