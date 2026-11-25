import '@src/shared/i18n/init';
import { ErrorCode } from '@aido/api/errors';
import { fail, ok } from '@src/core/errors/result';
import { createEntitlementSnapshotDto } from '@src/features/billing/subscription/__tests__/entitlement.fixtures';
import { NetworkError } from '@src/shared/errors/infra-error';
import {
  createAnalyticsStub,
  createHapticsGatewayStub,
  createHttpClientStub,
  createPendingResponse,
  createTestDi,
  respondByPath,
  createApiError,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import AddFriendScreen from '../../../../../app/(app)/(tabs)/(me,memos,todos)/friends/add';
import { createFriendApiError, createSendFriendRequestDto } from './friend.fixtures';

const USER_TAG = 'ABCD1234';

function createAddFriendDi({ isInviteAvailable = true }: { isInviteAvailable?: boolean } = {}) {
  const httpClient = createHttpClientStub();
  // 한도 안내가 쓰는 이용권과 초대 길이 화면과 함께 불린다
  httpClient.get.mockImplementation(
    respondByPath({
      'v1/entitlements': ok(createEntitlementSnapshotDto()),
      'v1/invites/availability': ok({ enabled: isInviteAvailable }),
    }),
  );
  const analytics = createAnalyticsStub();
  const haptics = createHapticsGatewayStub();
  const di = createTestDi({ ports: { httpClient, analytics, haptics } });

  return { di, httpClient, analytics, haptics };
}

async function renderAddFriend({ di }: ReturnType<typeof createAddFriendDi>) {
  await renderScreen(<AddFriendScreen />, { di, withLocalDate: true, withOverlay: true });
}

async function typeTag(userTag: string) {
  await fireEvent.changeText(screen.getByTestId('friend-tag-input'), userTag);
}

function countEvents(analytics: ReturnType<typeof createAnalyticsStub>, eventName: string) {
  return analytics.trackEvent.mock.calls.filter(([name]) => name === eventName).length;
}

describe('친구 추가 화면', () => {
  it('소문자로 쓴 태그를 대문자로 맞춰 요청하고 보냈다고 알린 뒤 돌아간다', async () => {
    // Given
    const setup = createAddFriendDi();
    setup.httpClient.post.mockResolvedValue(ok(createSendFriendRequestDto()));
    await renderAddFriend(setup);
    await typeTag('abcd1234');
    await waitFor(() => expect(screen.getByTestId('friend-tag-submit')).toBeEnabled());

    // When
    await fireEvent.press(screen.getByTestId('friend-tag-submit'));

    // Then
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(setup.httpClient.post).toHaveBeenCalledTimes(1);
    expect(setup.httpClient.post).toHaveBeenCalledWith(`v1/follows/${USER_TAG}`);
    expect(await screen.findAllByText('친구 요청을 보냈어요')).not.toHaveLength(0);
    expect(countEvents(setup.analytics, 'friend_request_sent')).toBe(1);
  });

  it('완료 키로도 요청을 보낸다', async () => {
    // Given
    const setup = createAddFriendDi();
    setup.httpClient.post.mockResolvedValue(ok(createSendFriendRequestDto()));
    await renderAddFriend(setup);
    await typeTag(USER_TAG);
    await waitFor(() => expect(screen.getByTestId('friend-tag-submit')).toBeEnabled());

    // When
    await fireEvent(screen.getByTestId('friend-tag-input'), 'submitEditing');

    // Then
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(setup.httpClient.post).toHaveBeenCalledTimes(1);
  });

  it.each([
    { userTag: 'ABC123', message: '해시태그는 8자리예요' },
    { userTag: 'ABCD-123', message: '해시태그는 영문 대문자와 숫자만 사용할 수 있어요' },
  ])(
    '형식에 맞지 않는 태그($userTag)는 칸에 알리고 보내지 않는다',
    async ({ userTag, message }) => {
      // Given
      const setup = createAddFriendDi();
      await renderAddFriend(setup);

      // When
      await typeTag(userTag);
      await fireEvent(screen.getByTestId('friend-tag-input'), 'submitEditing');

      // Then
      expect(await screen.findByText(message)).toBeOnTheScreen();
      expect(screen.getByTestId('friend-tag-submit')).toBeDisabled();
      expect(setup.httpClient.post).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      reason: '연결이 끊겨',
      respond: (httpClient: ReturnType<typeof createHttpClientStub>) =>
        httpClient.post.mockRejectedValue(new NetworkError()),
      message: new NetworkError().message,
    },
    {
      reason: '서버가 거절해',
      respond: (httpClient: ReturnType<typeof createHttpClientStub>) =>
        httpClient.post.mockResolvedValue(fail(createFriendApiError())),
      message: '자기 자신에게 친구 요청을 보낼 수 없어요',
    },
  ])(
    '$reason 요청하지 못하면 한 번 알리고 태그를 둔 채 화면에 머문다',
    async ({ respond, message }) => {
      // Given
      const setup = createAddFriendDi();
      respond(setup.httpClient);
      await renderAddFriend(setup);
      await typeTag(USER_TAG);
      await waitFor(() => expect(screen.getByTestId('friend-tag-submit')).toBeEnabled());

      // When
      await fireEvent.press(screen.getByTestId('friend-tag-submit'));

      // Then
      expect(await screen.findAllByText(message)).not.toHaveLength(0);
      expect(setup.haptics.notify).toHaveBeenCalledTimes(1);
      expect(setup.haptics.notify).toHaveBeenCalledWith('error');
      expect(screen.getByTestId('friend-tag-input')).toHaveDisplayValue(USER_TAG);
      expect(router.back).not.toHaveBeenCalled();
      expect(countEvents(setup.analytics, 'friend_request_sent')).toBe(0);
    },
  );

  it('보내는 동안 요청 버튼을 다시 눌러도 요청은 한 번이다', async () => {
    // Given
    const setup = createAddFriendDi();
    const pending = createPendingResponse(ok(createSendFriendRequestDto()));
    setup.httpClient.post.mockReturnValue(pending.response);
    await renderAddFriend(setup);
    await typeTag(USER_TAG);
    await waitFor(() => expect(screen.getByTestId('friend-tag-submit')).toBeEnabled());
    // 응답이 오기 전에는 누름이 끝나지 않을 수 있어 기다리지 않고 둔다
    const firstPress = fireEvent.press(screen.getByTestId('friend-tag-submit'));
    await waitFor(() => expect(screen.getByTestId('friend-tag-submit')).toBeDisabled());

    // When
    await fireEvent.press(screen.getByTestId('friend-tag-submit'));
    pending.settle();
    await firstPress;

    // Then
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(setup.httpClient.post).toHaveBeenCalledTimes(1);
  });

  it('친구 한도에 걸리면 초대로 자리를 늘리는 길을 안내하고 누르면 내 초대 화면을 연다', async () => {
    // Given
    const setup = createAddFriendDi();
    setup.httpClient.post.mockResolvedValue(
      fail(
        createApiError(ErrorCode.FOLLOW_0909, {
          message: '친구 한도',
          details: { current: 7, limit: 7 },
        }),
      ),
    );
    await renderAddFriend(setup);
    await typeTag(USER_TAG);
    await waitFor(() => expect(screen.getByTestId('friend-tag-submit')).toBeEnabled());
    await fireEvent.press(screen.getByTestId('friend-tag-submit'));

    // When
    await fireEvent.press(await screen.findByText('친구 초대하고 1명 더 추가하기'));

    // Then
    expect(router.push).toHaveBeenCalledWith('/friends/invite');
    expect(screen.getByTestId('friend-tag-input')).toHaveDisplayValue(USER_TAG);
    expect(router.back).not.toHaveBeenCalled();
  });
});
