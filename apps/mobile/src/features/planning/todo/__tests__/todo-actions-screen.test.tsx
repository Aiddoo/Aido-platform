import '@src/shared/i18n/init';
import { ErrorCode } from '@aido/api/errors';
import { fail, ok } from '@src/core/errors/result';
import {
  createApiError,
  createPendingResponse,
  createRouteParamsFake,
  createTestDi,
  silenceConsole,
} from '@src/testing/core';
import { createDateKey } from '@src/testing/date-key';
import { renderScreen } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { noop } from 'es-toolkit';
import { router } from 'expo-router';

import TodoActionsSheetRoute from '../../../../../app/(app)/todo/[todoId]/actions';
import { getCachedTodoListByDate } from '../queries/todo-cache';
import {
  createTodoServer,
  layoutSheetRoute,
  MEETING,
  TODAY,
  TODAY_NOON,
  WORKOUT,
} from './todo.test-utils';

const TOMORROW = createDateKey('2026-11-12');
const SHEET_PARAMS = { todoId: WORKOUT.id, date: TODAY };

async function renderTodoActions({ todoId = WORKOUT.id }: { todoId?: number } = {}) {
  createRouteParamsFake({ todoId: String(todoId), date: TODAY });
  const httpClient = createTodoServer({
    todosByDate: { [TODAY]: [WORKOUT, MEETING] },
    // 받은 감사 요약은 이 화면의 관심이 아니라 받는 중으로 둔다
    get: { [`v1/todos/${todoId}/details`]: () => new Promise<never>(noop) },
  });
  const rendered = await renderScreen(<TodoActionsSheetRoute />, {
    withLocalDate: true,
    withOverlay: true,
    di: createTestDi({ ports: { httpClient } }),
  });
  await layoutSheetRoute();

  return {
    httpClient,
    getTodayTitles: () =>
      getCachedTodoListByDate(rendered.queryClient, { date: TODAY })?.todos.map(
        (todo) => todo.title,
      ),
  };
}

describe('TodoActionsSheetRoute', () => {
  setupFakeTimersPerTest({ now: TODAY_NOON });

  it('오늘 할 일에서 내일 하기를 누르면 같은 시각의 내일로 옮기는 요청을 보내고 저장되면 닫는다', async () => {
    // Given
    const { httpClient } = await renderTodoActions();
    const saving = createPendingResponse(
      ok({ message: '저장', todo: { ...WORKOUT, startDate: TOMORROW } }),
    );
    httpClient.patch.mockReturnValue(saving.response);

    // When
    await fireEvent.press(await screen.findByText('내일 하기'));

    // Then
    await waitFor(() => expect(httpClient.patch).toHaveBeenCalledTimes(1));
    expect(httpClient.patch).toHaveBeenCalledWith('v1/todos/1/schedule', {
      startDate: TOMORROW,
      endDate: null,
      scheduledTime: '18:00',
      isAllDay: false,
    });
    expect(router.back).not.toHaveBeenCalled();

    // When
    await act(async () => saving.settle());

    // Then
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
  });

  it('저장하는 동안에는 다른 동작을 눌러도 요청을 더 보내지 않는다', async () => {
    // Given
    const { httpClient } = await renderTodoActions();
    const saving = createPendingResponse(ok({ message: '저장', todo: WORKOUT }));
    httpClient.patch.mockReturnValue(saving.response);
    await fireEvent.press(await screen.findByText('내일 하기'));
    await waitFor(() => expect(screen.getByTestId('todo-action-delete')).toBeDisabled());

    // When
    await fireEvent.press(screen.getByText('내일 하기'));
    await fireEvent.press(screen.getByTestId('todo-action-delete'));
    await fireEvent.press(screen.getByText('시간 변경'));

    // Then
    expect(httpClient.patch).toHaveBeenCalledTimes(1);
    expect(httpClient.delete).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    await act(async () => saving.settle());
  });

  it('삭제하기를 누르면 응답 전에 목록에서 빼고 삭제 요청을 보낸 뒤 닫는다', async () => {
    // Given
    const { httpClient, getTodayTitles } = await renderTodoActions();
    const removal = createPendingResponse(ok({ message: '할 일이 삭제되었습니다.' }));
    httpClient.delete.mockReturnValue(removal.response);
    const deleteAction = await screen.findByTestId('todo-action-delete');
    expect(getTodayTitles()).toEqual(['운동', '회의']);

    // When
    await fireEvent.press(deleteAction);

    // Then
    await waitFor(() => expect(getTodayTitles()).toEqual(['회의']));
    expect(httpClient.delete).toHaveBeenCalledTimes(1);
    expect(httpClient.delete).toHaveBeenCalledWith('v1/todos/1');

    // When
    await act(async () => removal.settle());

    // Then
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
  });

  it('삭제가 실패하면 목록에 되돌리고 시트를 닫지 않는다', async () => {
    // Given
    silenceConsole('error');
    const { httpClient, getTodayTitles } = await renderTodoActions();
    httpClient.delete.mockResolvedValue(
      fail(createApiError(ErrorCode.TODO_0801, { message: '할일을 찾을 수 없어요' })),
    );

    // When
    await fireEvent.press(await screen.findByTestId('todo-action-delete'));

    // Then
    await waitFor(() => expect(httpClient.delete).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(getTodayTitles()).toContain('운동'));
    expect(router.back).not.toHaveBeenCalled();
  });

  it.each([
    ['수정하기', '/todo/[todoId]/edit'],
    ['날짜 변경', '/todo/[todoId]/date'],
    ['시간 변경', '/todo/[todoId]/time'],
    ['카테고리 변경', '/todo/[todoId]/category'],
  ])('%s를 누르면 같은 할 일·날짜의 시트(%s)로 바꾼다', async (label, pathname) => {
    // Given
    await renderTodoActions();

    // When
    await fireEvent.press(await screen.findByText(label));

    // Then
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({ pathname, params: SHEET_PARAMS }),
    );
  });

  it('그날 목록에 없는 할 일로 열면 동작을 보이지 않고 시트를 닫는다', async () => {
    // When
    await renderTodoActions({ todoId: 99 });

    // Then
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('todo-action-delete')).toBeNull();
  });
});
