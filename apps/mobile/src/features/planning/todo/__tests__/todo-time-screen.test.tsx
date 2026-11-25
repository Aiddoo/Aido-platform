import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import { ServerError } from '@src/shared/errors/infra-error';
import { createPendingResponse, createRouteParamsFake, createTestDi } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { noop } from 'es-toolkit';
import { router } from 'expo-router';

import TodoTimeSheetRoute from '../../../../../app/(app)/todo/[todoId]/time';
import { createTodoServer, layoutSheetRoute, TODAY, TODAY_NOON, WORKOUT } from './todo.test-utils';

const ALL_DAY_WORKOUT = { ...WORKOUT, scheduledTime: null, isAllDay: true };

async function renderTodoTime() {
  createRouteParamsFake({ todoId: String(WORKOUT.id), date: TODAY });
  const httpClient = createTodoServer({ todosByDate: { [TODAY]: [WORKOUT] } });
  await renderScreen(<TodoTimeSheetRoute />, {
    withLocalDate: true,
    withOverlay: true,
    di: createTestDi({ ports: { httpClient } }),
  });
  await layoutSheetRoute();
  await screen.findByText('종일');

  return { httpClient };
}

describe('TodoTimeSheetRoute', () => {
  setupFakeTimersPerTest({ now: TODAY_NOON });

  it('종일로 바꿔 확인하면 시각을 비운 일정 요청을 보내고 저장되면 닫는다', async () => {
    // Given
    const { httpClient } = await renderTodoTime();
    const saving = createPendingResponse(ok({ message: '저장', todo: ALL_DAY_WORKOUT }));
    httpClient.patch.mockReturnValue(saving.response);

    // When
    await fireEvent.press(screen.getByText('종일'));
    await fireEvent.press(screen.getByText('확인'));

    // Then
    await waitFor(() => expect(httpClient.patch).toHaveBeenCalledTimes(1));
    expect(httpClient.patch).toHaveBeenCalledWith('v1/todos/1/schedule', {
      startDate: TODAY,
      endDate: null,
      scheduledTime: null,
      isAllDay: true,
    });
    expect(router.back).not.toHaveBeenCalled();

    // When
    await act(async () => saving.settle());

    // Then
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
  });

  it('시각을 바꾸지 않고 확인하면 요청 없이 닫는다', async () => {
    // Given
    const { httpClient } = await renderTodoTime();

    // When
    await fireEvent.press(screen.getByText('확인'));

    // Then
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(httpClient.patch).not.toHaveBeenCalled();
  });

  it('저장이 실패하면 시트를 남겨 다시 저장할 수 있다', async () => {
    // Given
    jest.spyOn(console, 'error').mockImplementation(noop);
    const { httpClient } = await renderTodoTime();
    httpClient.patch.mockRejectedValueOnce(new ServerError(500));
    await fireEvent.press(screen.getByText('종일'));
    await fireEvent.press(screen.getByText('확인'));
    await waitFor(() => expect(httpClient.patch).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('확인')).toBeEnabled());
    expect(router.back).not.toHaveBeenCalled();
    httpClient.patch.mockResolvedValue(ok({ message: '저장', todo: ALL_DAY_WORKOUT }));

    // When
    await fireEvent.press(screen.getByText('확인'));

    // Then
    await waitFor(() => expect(httpClient.patch).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
  });
});
