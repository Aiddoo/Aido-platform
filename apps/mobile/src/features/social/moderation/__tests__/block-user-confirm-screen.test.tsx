import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import {
  countGetRequests,
  layoutSheetRoute,
} from '@src/features/planning/todo/__tests__/todo.test-utils';
import { NetworkError } from '@src/shared/errors/infra-error';
import {
  createAnalyticsStub,
  createHapticsGatewayStub,
  createHttpClientStub,
  createPendingResponse,
  createRouteParamsFake,
  createTestDi,
  getTrackedEvents,
} from '@src/testing/core';
import { pressTwiceInSameFrame } from '@src/testing/press';
import { renderScreen } from '@src/testing/render';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useNavigation } from 'expo-router';

import BlockUserConfirmRoute from '../../../../../app/(app)/users/[userId]/block';
import { BLOCKED_USER_ID, createBlockUserResponseDto } from './moderation.fixtures';

const USER_NAME = '홍길동';

async function renderBlockUserConfirm() {
  createRouteParamsFake({ userId: BLOCKED_USER_ID, name: USER_NAME });
  const httpClient = createHttpClientStub();
  const analytics = createAnalyticsStub();
  const haptics = createHapticsGatewayStub();
  await renderScreen(<BlockUserConfirmRoute />, {
    di: createTestDi({ ports: { httpClient, analytics, haptics } }),
  });
  await layoutSheetRoute();
  await screen.findByText(`${USER_NAME}님을 차단할까요?`);

  return { httpClient, analytics, haptics };
}

describe('BlockUserConfirmRoute', () => {
  it('차단하면 그 사람을 한 번 차단하고 알린 뒤 확인 창을 닫는다', async () => {
    // Given
    const { httpClient, analytics, haptics } = await renderBlockUserConfirm();
    httpClient.post.mockResolvedValue(ok(createBlockUserResponseDto()));

    // When
    await fireEvent.press(screen.getByTestId('block-user-confirm'));

    // Then
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(httpClient.post).toHaveBeenCalledTimes(1);
    expect(httpClient.post).toHaveBeenCalledWith(`v1/blocks/${BLOCKED_USER_ID}`);
    expect(await screen.findByText(`${USER_NAME}님을 차단했어요`)).toBeOnTheScreen();
    expect(haptics.notify).toHaveBeenCalledWith('success');
    expect(getTrackedEvents(analytics, 'user_blocked')).toHaveLength(1);
  });

  it('차단하는 사이 확인 창을 떠났으면 차단이 끝나도 아래 화면을 닫지 않는다', async () => {
    // Given
    let isFocused = true;
    jest.mocked(useNavigation).mockImplementation(() => ({
      isFocused: () => isFocused,
      getParent: () => undefined,
      addListener: () => () => undefined,
    }));
    const { httpClient } = await renderBlockUserConfirm();
    const pending = createPendingResponse(ok(createBlockUserResponseDto()));
    httpClient.post.mockReturnValue(pending.response);
    await act(async () => {
      // 누름은 차단이 끝나야 풀려 기다리지 않는다
      fireEvent.press(screen.getByTestId('block-user-confirm')).catch(() => undefined);
    });

    // When
    isFocused = false;
    await act(async () => {
      pending.settle();
    });

    // Then
    expect(await screen.findByText(`${USER_NAME}님을 차단했어요`)).toBeOnTheScreen();
    expect(httpClient.post).toHaveBeenCalledTimes(1);
    expect(router.back).not.toHaveBeenCalled();
  });

  it('처음 열 때 서버에서 아무것도 받지 않는다', async () => {
    // When
    const { httpClient } = await renderBlockUserConfirm();

    // Then
    expect(countGetRequests(httpClient)).toEqual({});
  });

  it('취소하면 차단하지 않고 닫는다', async () => {
    // Given
    const { httpClient } = await renderBlockUserConfirm();

    // When
    await fireEvent.press(screen.getByRole('button', { name: '취소' }));

    // Then
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(httpClient.post).not.toHaveBeenCalled();
  });

  it('연결이 끊겨 차단하지 못하면 한 번 알리고 확인 창을 남겨 다시 누를 수 있다', async () => {
    // Given
    const { httpClient, analytics, haptics } = await renderBlockUserConfirm();
    httpClient.post.mockRejectedValue(new NetworkError());

    // When
    await fireEvent.press(screen.getByTestId('block-user-confirm'));

    // Then
    expect(await screen.findAllByText(new NetworkError().message)).not.toHaveLength(0);
    expect(haptics.notify).toHaveBeenCalledTimes(1);
    expect(haptics.notify).toHaveBeenCalledWith('error');
    expect(screen.getByText(`${USER_NAME}님을 차단할까요?`)).toBeOnTheScreen();
    expect(screen.getByTestId('block-user-confirm')).toBeEnabled();
    expect(router.back).not.toHaveBeenCalled();
    expect(getTrackedEvents(analytics, 'user_blocked')).toHaveLength(0);
  });

  it('차단하는 동안 다시 눌러도 요청은 한 번이다', async () => {
    // Given
    const { httpClient } = await renderBlockUserConfirm();
    const pending = createPendingResponse(ok(createBlockUserResponseDto()));
    httpClient.post.mockReturnValue(pending.response);
    const confirm = screen.getByTestId('block-user-confirm');
    await act(async () => {
      // 누름은 차단이 끝나야 풀려 기다리지 않는다
      fireEvent.press(confirm).catch(() => undefined);
    });

    // When
    await act(async () => {
      fireEvent.press(screen.getByTestId('block-user-confirm')).catch(() => undefined);
    });
    await act(async () => {
      pending.settle();
    });

    // Then
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(httpClient.post).toHaveBeenCalledTimes(1);
  });

  it('같은 프레임에 차단을 두 번 누르면 요청이 한 번 나간다', async () => {
    // Given
    const { httpClient } = await renderBlockUserConfirm();
    const pending = createPendingResponse(ok(createBlockUserResponseDto()));
    httpClient.post.mockReturnValue(pending.response);
    const confirm = screen.getByTestId('block-user-confirm');

    // When
    await pressTwiceInSameFrame(confirm);
    await act(async () => {
      pending.settle();
    });

    // Then
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(httpClient.post).toHaveBeenCalledTimes(1);
  });
});
