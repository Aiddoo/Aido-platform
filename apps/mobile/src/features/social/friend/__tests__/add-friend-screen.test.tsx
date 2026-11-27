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
  getTrackedEvents,
} from '@src/testing/core';
import { pressTwiceInSameFrame } from '@src/testing/press';
import { renderScreen } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useNavigation } from 'expo-router';

import AddFriendScreen from '../../../../../app/(app)/(tabs)/(me,memos,todos)/friends/add';
import { createFriendApiError, createSendFriendRequestDto } from './friend.fixtures';

const USER_TAG = 'ABCD1234';
const OTHER_USER_TAG = 'WXYZ5678';

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

describe('AddFriendScreen', () => {
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
    expect(getTrackedEvents(setup.analytics, 'friend_request_sent')).toHaveLength(1);
  });

  it('돌아갈 화면이 없으면 요청을 보낸 뒤 친구 화면으로 간다', async () => {
    // Given
    jest.mocked(router.canGoBack).mockReturnValue(false);
    const setup = createAddFriendDi();
    setup.httpClient.post.mockResolvedValue(ok(createSendFriendRequestDto()));
    await renderAddFriend(setup);
    await typeTag(USER_TAG);
    await waitFor(() => expect(screen.getByTestId('friend-tag-submit')).toBeEnabled());

    // When
    await fireEvent.press(screen.getByTestId('friend-tag-submit'));

    // Then
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/friends'));
    expect(router.back).not.toHaveBeenCalled();
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
      expect(getTrackedEvents(setup.analytics, 'friend_request_sent')).toHaveLength(0);
    },
  );

  it('서버가 안내 문구 없이 거절하면 친구 요청 실패를 한 번 알린다', async () => {
    // Given
    const setup = createAddFriendDi();
    setup.httpClient.post.mockResolvedValue(
      fail(createFriendApiError({ code: ErrorCode.FOLLOW_0905, message: '' })),
    );
    await renderAddFriend(setup);
    await typeTag(USER_TAG);
    await waitFor(() => expect(screen.getByTestId('friend-tag-submit')).toBeEnabled());

    // When
    await fireEvent.press(screen.getByTestId('friend-tag-submit'));

    // Then
    expect(await screen.findAllByText('친구 요청에 실패했어요')).not.toHaveLength(0);
    expect(setup.haptics.notify).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('friend-tag-input')).toHaveDisplayValue(USER_TAG);
    expect(router.back).not.toHaveBeenCalled();
  });

  it('보내는 사이 화면을 떠났으면 요청이 끝나도 이전 화면을 한 번 더 닫지 않는다', async () => {
    // Given
    let isFocused = true;
    jest.mocked(useNavigation).mockImplementation(() => ({
      isFocused: () => isFocused,
      getParent: () => undefined,
      addListener: () => () => undefined,
    }));
    const setup = createAddFriendDi();
    const pending = createPendingResponse(ok(createSendFriendRequestDto()));
    setup.httpClient.post.mockReturnValue(pending.response);
    await renderAddFriend(setup);
    await typeTag(USER_TAG);
    await waitFor(() => expect(screen.getByTestId('friend-tag-submit')).toBeEnabled());
    await act(async () => {
      // 누름은 응답이 와야 끝나 기다리지 않는다
      fireEvent.press(screen.getByTestId('friend-tag-submit')).catch(() => undefined);
    });

    // When
    isFocused = false;
    await act(async () => {
      pending.settle();
    });

    // Then
    expect(await screen.findAllByText('친구 요청을 보냈어요')).not.toHaveLength(0);
    expect(setup.httpClient.post).toHaveBeenCalledTimes(1);
    expect(router.back).not.toHaveBeenCalled();
  });

  it('떠난 사이 요청이 끝나면 폼을 비워 같은 태그를 다시 보내지 않는다', async () => {
    // Given
    let isFocused = true;
    jest.mocked(useNavigation).mockImplementation(() => ({
      isFocused: () => isFocused,
      getParent: () => undefined,
      addListener: () => () => undefined,
    }));
    const setup = createAddFriendDi();
    const pending = createPendingResponse(ok(createSendFriendRequestDto()));
    setup.httpClient.post.mockReturnValue(pending.response);
    await renderAddFriend(setup);
    await typeTag(USER_TAG);
    await waitFor(() => expect(screen.getByTestId('friend-tag-submit')).toBeEnabled());
    await act(async () => {
      // 누름은 응답이 와야 끝나 기다리지 않는다
      fireEvent.press(screen.getByTestId('friend-tag-submit')).catch(() => undefined);
    });
    isFocused = false;

    // When
    await act(async () => {
      pending.settle();
    });

    // Then
    await waitFor(() => expect(screen.getByTestId('friend-tag-input')).toHaveDisplayValue(''));
    expect(screen.getByTestId('friend-tag-submit')).toBeDisabled();
    expect(setup.httpClient.post).toHaveBeenCalledTimes(1);
  });

  it('같은 프레임에 요청 버튼을 두 번 누르면 요청이 한 번 나간다', async () => {
    // Given
    const setup = createAddFriendDi();
    const pending = createPendingResponse(ok(createSendFriendRequestDto()));
    setup.httpClient.post.mockReturnValue(pending.response);
    await renderAddFriend(setup);
    await typeTag(USER_TAG);
    await waitFor(() => expect(screen.getByTestId('friend-tag-submit')).toBeEnabled());
    const submitButton = screen.getByTestId('friend-tag-submit');

    // When
    await pressTwiceInSameFrame(submitButton);
    await act(async () => {
      pending.settle();
    });

    // Then
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(setup.httpClient.post).toHaveBeenCalledTimes(1);
  });

  it('친구 한도에 걸렸는데 초대를 쓸 수 없으면 초대 길 없이 한도만 알리고 화면에 머문다', async () => {
    // Given
    const setup = createAddFriendDi({ isInviteAvailable: false });
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

    // When
    await fireEvent.press(screen.getByTestId('friend-tag-submit'));

    // Then
    expect(await screen.findAllByText('친구를 더 추가할 수 없어요')).not.toHaveLength(0);
    expect(screen.queryByText('친구 초대하고 1명 더 추가하기')).toBeNull();
    expect(setup.haptics.notify).toHaveBeenCalledWith('error');
    expect(screen.getByTestId('friend-tag-input')).toHaveDisplayValue(USER_TAG);
    expect(router.back).not.toHaveBeenCalled();
    expect(getTrackedEvents(setup.analytics, 'friend_request_sent')).toHaveLength(0);
  });

  it('보내는 동안 요청 버튼을 다시 눌러도 요청은 한 번이다', async () => {
    // Given
    const setup = createAddFriendDi();
    const pending = createPendingResponse(ok(createSendFriendRequestDto()));
    setup.httpClient.post.mockReturnValue(pending.response);
    await renderAddFriend(setup);
    await typeTag(USER_TAG);
    await waitFor(() => expect(screen.getByTestId('friend-tag-submit')).toBeEnabled());
    await act(async () => {
      // 누름은 응답이 와야 끝나 기다리지 않는다
      fireEvent.press(screen.getByTestId('friend-tag-submit')).catch(() => undefined);
    });
    await waitFor(() => expect(screen.getByTestId('friend-tag-submit')).toBeDisabled());

    // When
    await fireEvent.press(screen.getByTestId('friend-tag-submit'));
    await act(async () => {
      pending.settle();
    });

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

  describe('요청 뒤 떠나는 동안', () => {
    setupFakeTimersPerTest();

    it('요청을 보내 화면이 내려가는 동안 다시 눌러도 요청은 한 번이다', async () => {
      // Given
      const setup = createAddFriendDi();
      setup.httpClient.post.mockResolvedValue(ok(createSendFriendRequestDto()));
      await renderAddFriend(setup);
      await typeTag(USER_TAG);
      await waitFor(() => expect(screen.getByTestId('friend-tag-submit')).toBeEnabled());
      await fireEvent.press(screen.getByTestId('friend-tag-submit'));
      // 연타 가드(600ms)가 지난 뒤다. 화면은 뒤로 가는 전환이 끝나야 내려가 버튼이 아직 보인다
      await act(() => jest.advanceTimersByTimeAsync(1_000));
      expect(router.back).toHaveBeenCalledTimes(1);

      // When
      await fireEvent.press(screen.getByTestId('friend-tag-submit'));
      await act(() => jest.advanceTimersByTimeAsync(1_000));

      // Then
      expect(setup.httpClient.post).toHaveBeenCalledTimes(1);
    });

    it('보내는 동안 떠났다가 요청이 끝난 뒤 돌아오면 새로 쓴 태그를 보낼 수 있다', async () => {
      // Given
      let isFocused = true;
      jest.mocked(useNavigation).mockImplementation(() => ({
        isFocused: () => isFocused,
        getParent: () => undefined,
        addListener: () => () => undefined,
      }));
      const setup = createAddFriendDi();
      const pending = createPendingResponse(ok(createSendFriendRequestDto()));
      setup.httpClient.post
        .mockReturnValueOnce(pending.response)
        .mockResolvedValue(ok(createSendFriendRequestDto()));
      await renderAddFriend(setup);
      await typeTag(USER_TAG);
      await waitFor(() => expect(screen.getByTestId('friend-tag-submit')).toBeEnabled());
      await fireEvent.press(screen.getByTestId('friend-tag-submit'));
      isFocused = false;
      await act(async () => {
        pending.settle();
      });
      await act(() => jest.advanceTimersByTimeAsync(1_000));
      isFocused = true;

      // When
      await typeTag(OTHER_USER_TAG);
      await act(() => jest.advanceTimersByTimeAsync(0));
      await fireEvent.press(screen.getByTestId('friend-tag-submit'));
      await act(() => jest.advanceTimersByTimeAsync(1_000));

      // Then
      expect(setup.httpClient.post).toHaveBeenCalledTimes(2);
      expect(setup.httpClient.post).toHaveBeenLastCalledWith(`v1/follows/${OTHER_USER_TAG}`);
    });
  });
});
