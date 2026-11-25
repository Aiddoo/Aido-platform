import '@src/shared/i18n/init';
import { NUDGE_LIMITS } from '@aido/api/vocabulary';
import { fail, ok } from '@src/core/errors/result';
import { layoutSheetRoute } from '@src/features/planning/todo/__tests__/todo.test-utils';
import { NetworkError } from '@src/shared/errors/infra-error';
import {
  createAnalyticsStub,
  createApiError,
  createHapticsGatewayStub,
  createHttpClientStub,
  createPendingResponse,
  createTestDi,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';

import RemindNudgeSheetRoute from '../../../../../app/(app)/users/[userId]/nudge';
import { createSendRemindNudgeResponseDto } from './todo-nudge.fixtures';

const FRIEND_ID = 'clz7x5p8k0005qz0z8z8z8z8z';
const PLACEHOLDER = '(선택) 작은 할 일 하나부터 같이 시작해보자!';
const SEND = '응원 보내기';
const COOLDOWN_MESSAGE = '리마인드 쿨다운 기간입니다. 1시간 뒤에 다시 시도해주세요.';

async function renderRemindNudgeSheet(params: Record<string, string> = {}) {
  const httpClient = createHttpClientStub();
  const analytics = createAnalyticsStub();
  const haptics = createHapticsGatewayStub();
  jest.mocked(useLocalSearchParams).mockReturnValue({ userId: FRIEND_ID, name: '민지', ...params });
  await renderScreen(<RemindNudgeSheetRoute />, {
    di: createTestDi({ ports: { httpClient, analytics, haptics } }),
    withLocalDate: true,
  });
  await layoutSheetRoute();

  return { httpClient, analytics, haptics };
}

async function typeMessage(message: string) {
  await fireEvent.changeText(await screen.findByPlaceholderText(PLACEHOLDER), message);
}

function countEvents(analytics: ReturnType<typeof createAnalyticsStub>, eventName: string) {
  return analytics.trackEvent.mock.calls.filter(([name]) => name === eventName).length;
}

describe('RemindNudgeSheetRoute', () => {
  it('적은 메시지를 다듬어 그 친구에게 보내고 시트를 닫으며 한 번 남긴다', async () => {
    // Given
    const { httpClient, analytics } = await renderRemindNudgeSheet();
    httpClient.post.mockResolvedValue(ok(createSendRemindNudgeResponseDto()));
    await typeMessage('  같이 하자  ');

    // When
    await fireEvent.press(screen.getByRole('button', { name: SEND }));

    // Then
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(httpClient.post).toHaveBeenCalledTimes(1);
    expect(httpClient.post).toHaveBeenCalledWith('v1/nudges/remind', {
      receiverId: FRIEND_ID,
      message: '같이 하자',
    });
    expect(countEvents(analytics, 'remind_nudge_sent')).toBe(1);
  });

  it('공백뿐인 메시지는 message 칸 없이 보낸다', async () => {
    // Given
    const { httpClient } = await renderRemindNudgeSheet();
    httpClient.post.mockResolvedValue(ok(createSendRemindNudgeResponseDto()));
    await typeMessage('   ');

    // When
    await fireEvent.press(screen.getByRole('button', { name: SEND }));

    // Then
    await waitFor(() => expect(httpClient.post).toHaveBeenCalledTimes(1));
    // undefined 칸은 JSON 본문에 실리지 않는다
    expect(httpClient.post).toHaveBeenCalledWith('v1/nudges/remind', { receiverId: FRIEND_ID });
  });

  it('한도를 넘긴 메시지는 칸에 알리고 보내기를 끈다', async () => {
    // Given
    const { httpClient } = await renderRemindNudgeSheet();

    // When
    await typeMessage('가'.repeat(NUDGE_LIMITS.MAX_MESSAGE_LENGTH + 1));

    // Then
    expect(
      await screen.findByText(`메시지는 ${NUDGE_LIMITS.MAX_MESSAGE_LENGTH}자 이내로 입력해주세요`),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: SEND })).toBeDisabled();
    expect(httpClient.post).not.toHaveBeenCalled();
  });

  it.each([
    {
      reason: '쿨다운이라 서버가 거절해',
      respond: (httpClient: ReturnType<typeof createHttpClientStub>) =>
        httpClient.post.mockResolvedValue(fail(createApiError('NUDGE_1108'))),
      message: COOLDOWN_MESSAGE,
    },
    {
      reason: '연결이 끊겨',
      respond: (httpClient: ReturnType<typeof createHttpClientStub>) =>
        httpClient.post.mockRejectedValue(new NetworkError()),
      message: new NetworkError().message,
    },
  ])('$reason 보내지 못하면 한 번 알리고 시트와 메시지를 둔다', async ({ respond, message }) => {
    // Given
    const { httpClient, analytics, haptics } = await renderRemindNudgeSheet();
    respond(httpClient);
    await typeMessage('같이 하자');

    // When
    await fireEvent.press(screen.getByRole('button', { name: SEND }));

    // Then
    expect(await screen.findAllByText(message)).not.toHaveLength(0);
    expect(haptics.notify).toHaveBeenCalledTimes(1);
    expect(haptics.notify).toHaveBeenCalledWith('error');
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toHaveDisplayValue('같이 하자');
    expect(router.back).not.toHaveBeenCalled();
    expect(countEvents(analytics, 'remind_nudge_sent')).toBe(0);
  });

  it('같은 프레임에 보내기를 두 번 누르면 요청이 한 번 나간다', async () => {
    // Given
    const { httpClient } = await renderRemindNudgeSheet();
    const pending = createPendingResponse(ok(createSendRemindNudgeResponseDto()));
    httpClient.post.mockReturnValue(pending.response);
    await typeMessage('같이 하자');
    const send = screen.getByRole('button', { name: SEND });

    // When
    await act(async () => {
      // 누름은 응답이 와야 끝날 수 있어 기다리지 않고, 다시 그리기 전에 두 번 닿게 한 act 안에서 누른다
      fireEvent.press(send).catch(() => undefined);
      fireEvent.press(send).catch(() => undefined);
    });
    await act(async () => {
      pending.settle();
    });

    // Then
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(httpClient.post).toHaveBeenCalledTimes(1);
  });

  it('받는 사람 이름이 없는 주소는 피드로 돌려보낸다', async () => {
    // When
    await renderRemindNudgeSheet({ name: ' ' });

    // Then
    expect(jest.mocked(Redirect)).toHaveBeenCalledWith(
      expect.objectContaining({ href: '/feed' }),
      undefined,
    );
    expect(screen.queryByPlaceholderText(PLACEHOLDER)).toBeNull();
  });

  describe('시트가 내려가는 동안', () => {
    setupFakeTimersPerTest({ advanceTimers: true });

    it('보낸 뒤 시트가 내려가는 동안 다시 눌러도 요청은 한 번이다', async () => {
      // Given
      const { httpClient } = await renderRemindNudgeSheet();
      httpClient.post.mockResolvedValue(ok(createSendRemindNudgeResponseDto()));
      await typeMessage('같이 하자');
      await fireEvent.press(screen.getByRole('button', { name: SEND }));
      await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
      // 연타 가드(600ms)를 넘긴 뒤의 누름이다
      await act(() => jest.advanceTimersByTimeAsync(700));

      // When
      await fireEvent.press(screen.getByTestId('nudge-send'));
      await act(() => jest.advanceTimersByTimeAsync(0));

      // Then
      expect(httpClient.post).toHaveBeenCalledTimes(1);
    });
  });
});
