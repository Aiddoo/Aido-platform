import '@src/shared/i18n/init';
import type { ApiError } from '@src/core/errors/api-error';
import { fail, ok, type Result } from '@src/core/errors/result';
import { layoutSheetRoute } from '@src/features/planning/todo/__tests__/todo.test-utils';
import {
  createAnalyticsStub,
  createApiError,
  createHttpClientStub,
  createPendingResponse,
  createTestDi,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import TodoThanksSheetRoute from '../../../../../app/(app)/todo/[todoId]/thanks';
import {
  createNudgeThanksPreviewDto,
  createNudgeThanksRecipientDtos,
} from './nudge-interaction.fixtures';

const TODO_ID = 4;
const THROUGH_NUDGE_ID = 12;
const THANKS_PATH = `v1/nudges/todos/${TODO_ID}/thanks`;

function createPreviewWithRecipients(recipientCount: number) {
  return createNudgeThanksPreviewDto({
    todoId: TODO_ID,
    throughNudgeId: THROUGH_NUDGE_ID,
    recipients: createNudgeThanksRecipientDtos(recipientCount),
    totalRecipients: recipientCount,
  });
}

async function renderThanksSheet(preview: Result<unknown, ApiError>) {
  const httpClient = createHttpClientStub();
  httpClient.get.mockResolvedValue(preview);
  const analytics = createAnalyticsStub();
  jest.mocked(useLocalSearchParams).mockReturnValue({ todoId: String(TODO_ID) });
  await renderScreen(<TodoThanksSheetRoute />, {
    di: createTestDi({ ports: { httpClient, analytics } }),
    withLocalDate: true,
  });
  await layoutSheetRoute();

  return { httpClient, analytics };
}

function countEvents(analytics: ReturnType<typeof createAnalyticsStub>, eventName: string) {
  return analytics.trackEvent.mock.calls.filter(([name]) => name === eventName).length;
}

describe('TodoThanksSheetRoute', () => {
  it('응원해준 친구를 보이고 미리보기 시점까지의 콕으로 고마움을 전한 뒤 완료로 닫는다', async () => {
    // Given
    const { httpClient, analytics } = await renderThanksSheet(ok(createPreviewWithRecipients(2)));
    httpClient.put.mockResolvedValue(ok({ sentCount: 2 }));
    expect(await screen.findByText('고마운친구0')).toBeOnTheScreen();
    expect(screen.getByText('고마운친구1')).toBeOnTheScreen();

    // When
    await fireEvent.press(screen.getByRole('button', { name: '2명에게 고마움 전하기' }));

    // Then
    expect(await screen.findByText('친구에게 고마운 마음을 전했어요')).toBeOnTheScreen();
    expect(httpClient.put).toHaveBeenCalledTimes(1);
    expect(httpClient.put).toHaveBeenCalledWith(THANKS_PATH, { throughNudgeId: THROUGH_NUDGE_ID });
    expect(analytics.trackEvent).toHaveBeenCalledWith('nudge_thanks_sent', { recipient_count: 2 });
    expect(countEvents(analytics, 'nudge_thanks_sent')).toBe(1);

    // When
    await fireEvent.press(screen.getByRole('button', { name: '완료' }));

    // Then
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
  });

  it('다른 기기에서 이미 전해 보낸 수가 0이면 이미 전했다고 알리고 남기지 않는다', async () => {
    // Given
    const { httpClient, analytics } = await renderThanksSheet(ok(createPreviewWithRecipients(1)));
    httpClient.put.mockResolvedValue(ok({ sentCount: 0 }));

    // When
    await fireEvent.press(await screen.findByRole('button', { name: '1명에게 고마움 전하기' }));

    // Then
    expect(await screen.findByText('이미 고마운 마음을 전했어요')).toBeOnTheScreen();
    expect(countEvents(analytics, 'nudge_thanks_sent')).toBe(0);
  });

  it('고마움을 전할 친구가 없으면 보내기 없이 알린다', async () => {
    // When
    const { httpClient } = await renderThanksSheet(
      ok(createNudgeThanksPreviewDto({ todoId: TODO_ID, thankedRecipientCount: 1 })),
    );

    // Then
    expect(await screen.findByText('지금은 고마움을 전할 친구가 없어요')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /고마움 전하기/u })).toBeNull();
    expect(httpClient.put).not.toHaveBeenCalled();
  });

  it('같은 프레임에 보내기를 두 번 누르면 요청이 한 번 나간다', async () => {
    // Given
    const { httpClient } = await renderThanksSheet(ok(createPreviewWithRecipients(1)));
    const pending = createPendingResponse(ok({ sentCount: 1 }));
    httpClient.put.mockReturnValue(pending.response);
    const send = await screen.findByRole('button', { name: '1명에게 고마움 전하기' });

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
    expect(await screen.findByText('친구에게 고마운 마음을 전했어요')).toBeOnTheScreen();
    expect(httpClient.put).toHaveBeenCalledTimes(1);
  });

  it('사라진 콕이면 서버 안내를 보이고 닫기로 시트를 닫는다', async () => {
    // Given
    await renderThanksSheet(fail(createApiError('NUDGE_1111')));
    expect(
      await screen.findByText('지금은 콕 답장과 감사를 사용할 수 없습니다.'),
    ).toBeOnTheScreen();

    // When
    await fireEvent.press(screen.getByRole('button', { name: '닫기' }));

    // Then
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
  });

  it('그 밖의 실패는 다시 시도로 감사 현황을 다시 받는다', async () => {
    // Given
    const { httpClient } = await renderThanksSheet(fail(createApiError('SYS_0001')));
    expect(await screen.findByText('응원해준 친구들을 불러오지 못했어요')).toBeOnTheScreen();
    httpClient.get.mockResolvedValue(ok(createPreviewWithRecipients(1)));

    // When
    await fireEvent.press(screen.getByRole('button', { name: '다시 시도' }));

    // Then
    expect(await screen.findByText('고마운친구0')).toBeOnTheScreen();
    expect(httpClient.get).toHaveBeenCalledTimes(2);
  });
});
