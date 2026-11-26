import '@src/shared/i18n/init';
import { ErrorCode } from '@aido/api/errors';
import { fail, ok } from '@src/core/errors/result';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import {
  createAnalyticsStub,
  createHttpClientStub,
  createRouteParamsFake,
  createTestDi,
  getTrackedEvents,
  respondByPath,
  silenceConsole,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import TodoImportRoute from '../../../../../app/(app)/(tabs)/(me,memos,todos)/todo-import/[importId]';
import { createTodoImportApiError, createTodoImportDto, IMPORT_ID } from './todo-import.fixtures';

/** 2026-11-24 10:00 KST. 가져오기를 시작한 시각이다 */
const NOW = new Date('2026-11-24T01:00:00.000Z');
const DETAIL_PATH = `v1/todo-imports/${IMPORT_ID}`;
/** 처리 중인 가져오기를 다시 묻는 가장 긴 간격(업로드·대기 3초)을 넘긴다 */
const NEXT_POLL_MS = 3_000;

const RUNNING = createTodoImportDto({
  status: 'RUNNING',
  receivedItemCount: 4,
  processedItemCount: 1,
});
const COMPLETED = createTodoImportDto({
  status: 'COMPLETED',
  receivedItemCount: 4,
  processedItemCount: 4,
  counts: {
    created: 3,
    skippedDuplicate: 1,
    skippedCapacity: 0,
    skippedCategoryMissing: 0,
    skippedInvalid: 0,
    undone: 0,
    keptCompleted: 0,
  },
  firstDate: '2026-11-25',
  undoableUntil: '2026-12-01T01:00:00.000Z',
  completedAt: '2026-11-24T01:00:00.000Z',
});

type ImportDto = ReturnType<typeof createTodoImportDto>;

/** 서버의 지금 상태. 테스트가 바꾸면 다음 조회부터 그 값을 받는다 */
function createImportServer(initial: ImportDto) {
  let current: ImportDto = initial;
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(
    respondByPath({
      'v1/auth/me': ok(createCurrentUserDto()),
      'v1/todo-imports/active': async () => ok({ todoImport: null }),
      [DETAIL_PATH]: async () => ok({ todoImport: current }),
    }),
  );

  return {
    httpClient,
    moveTo(next: ImportDto) {
      current = next;
    },
  };
}

async function renderImport(server: ReturnType<typeof createImportServer>) {
  const analytics = createAnalyticsStub();
  createRouteParamsFake({ importId: IMPORT_ID });
  const view = await renderScreen(<TodoImportRoute />, {
    di: createTestDi({ ports: { httpClient: server.httpClient, analytics } }),
    withLocalDate: true,
    withOverlay: true,
  });

  return { analytics, unmount: view.unmount };
}

async function pollNext() {
  await act(() => jest.advanceTimersByTimeAsync(NEXT_POLL_MS));
}

/** 확인 다이얼로그의 확인 단추는 화면의 단추와 이름이 같아 나중에 그려진 것을 누른다 */
async function confirmInDialog(title: string, confirmLabel: string) {
  await screen.findByText(title);
  const buttons = screen.getAllByRole('button', { name: confirmLabel });
  const confirmButton = buttons.at(-1);
  if (confirmButton == null) {
    throw new Error(`${confirmLabel} 확인 단추가 없습니다`);
  }
  await fireEvent.press(confirmButton);
}

describe('TodoImportRoute', () => {
  setupFakeTimersPerTest({ now: NOW, advanceTimers: true });

  it('만드는 중이던 가져오기가 끝나면 결과를 보이고 끝남을 한 번 남긴다', async () => {
    // Given
    const server = createImportServer(RUNNING);
    const { analytics } = await renderImport(server);
    expect(await screen.findByLabelText('할 일 만드는 중, 진행 중')).toBeOnTheScreen();
    expect(screen.getByText('앱을 나가도 계속 가져와요')).toBeOnTheScreen();

    // When
    server.moveTo(COMPLETED);
    await pollNext();

    // Then
    expect(await screen.findByText('할 일 3개를 가져왔어요')).toBeOnTheScreen();
    expect(getTrackedEvents(analytics, 'todo_import_completed')).toEqual([
      { created_bucket: '1_10', skipped_duplicate: 1, skipped_capacity: 0 },
    ]);
    expect(getTrackedEvents(analytics, 'todo_import_failed')).toEqual([]);
    await pollNext();
    expect(getTrackedEvents(analytics, 'todo_import_completed')).toHaveLength(1);
  });

  it('끝난 결과에서 할 일 보러 가기를 누르면 처음 가져온 날의 피드로 간다', async () => {
    // Given
    await renderImport(createImportServer(COMPLETED));

    // When
    await fireEvent.press(await screen.findByRole('button', { name: '할 일 보러 가기' }));

    // Then
    expect(router.navigate).toHaveBeenCalledWith({
      pathname: '/feed',
      params: { date: '2026-11-25' },
    });
  });

  it('만들다 서버가 멈추면 만든 수와 다시 가져오기를 보이고 실패를 한 번 남긴다', async () => {
    // Given
    const server = createImportServer(RUNNING);
    const { analytics } = await renderImport(server);
    await screen.findByLabelText('할 일 만드는 중, 진행 중');

    // When
    server.moveTo(
      createTodoImportDto({
        ...COMPLETED,
        status: 'FAILED',
        failureReason: 'MATERIALIZATION_FAILED',
        counts: { ...COMPLETED.counts, created: 2 },
      }),
    );
    await pollNext();

    // Then
    expect(await screen.findByText('가져오다 멈췄어요')).toBeOnTheScreen();
    expect(
      screen.getByText('만든 할 일 2개는 그대로 있어요. 다시 가져오면 남은 일정만 이어서 만들어요'),
    ).toBeOnTheScreen();
    expect(getTrackedEvents(analytics, 'todo_import_failed')).toEqual([
      { reason: 'server_failed' },
    ]);
    expect(getTrackedEvents(analytics, 'todo_import_completed')).toEqual([]);

    // When
    await fireEvent.press(screen.getByRole('button', { name: '다시 가져오기' }));

    // Then
    expect(router.replace).toHaveBeenCalledWith('/todo-import');
  });

  it('다른 기기에서 올리던 가져오기를 확인하고 멈추면 멈춘 결과를 보이고 취소로 남긴다', async () => {
    // Given
    const server = createImportServer(createTodoImportDto({ status: 'UPLOADING' }));
    server.httpClient.delete.mockImplementation(async () => {
      const canceled = createTodoImportDto({ status: 'CANCELED' });
      server.moveTo(canceled);
      return ok({ todoImport: canceled });
    });
    const { analytics } = await renderImport(server);
    await act(async () => {
      // 누른 동작은 다이얼로그의 답을 기다리는 동안 끝나지 않아 기다리지 않는다
      fireEvent
        .press(await screen.findByRole('button', { name: '가져오기 멈추기' }))
        .catch(() => undefined);
    });

    // When
    await confirmInDialog('가져오기를 멈출까요?', '가져오기 멈추기');

    // Then
    expect(await screen.findByText('가져오기를 멈췄어요')).toBeOnTheScreen();
    expect(server.httpClient.delete).toHaveBeenCalledTimes(1);
    expect(server.httpClient.delete).toHaveBeenCalledWith(DETAIL_PATH);
    expect(getTrackedEvents(analytics, 'todo_import_cancel_completed')).toHaveLength(1);
    expect(getTrackedEvents(analytics, 'todo_import_failed')).toEqual([{ reason: 'canceled' }]);
  });

  it('되돌리기를 확인하면 한 번 요청해 되돌리는 중을 보이고 끝나면 되돌린 수를 보인다', async () => {
    // Given
    const server = createImportServer(COMPLETED);
    server.httpClient.post.mockImplementation(async () => {
      const undoing = createTodoImportDto({ ...COMPLETED, status: 'UNDOING' });
      server.moveTo(undoing);
      return ok({ todoImport: undoing });
    });
    const { analytics } = await renderImport(server);
    await act(async () => {
      fireEvent
        .press(await screen.findByRole('button', { name: '되돌리기' }))
        .catch(() => undefined);
    });

    // When
    await confirmInDialog('가져온 할 일을 되돌릴까요?', '되돌리기');

    // Then
    expect(await screen.findByText('되돌리는 중이에요')).toBeOnTheScreen();
    expect(server.httpClient.post).toHaveBeenCalledTimes(1);
    expect(server.httpClient.post).toHaveBeenCalledWith(`${DETAIL_PATH}/undo`);
    expect(getTrackedEvents(analytics, 'todo_import_undo_requested')).toHaveLength(1);

    // When
    server.moveTo(
      createTodoImportDto({
        ...COMPLETED,
        status: 'UNDONE',
        undoableUntil: null,
        counts: { ...COMPLETED.counts, undone: 2, keptCompleted: 1 },
      }),
    );
    await pollNext();

    // Then
    expect(await screen.findByText('할 일 2개를 되돌렸어요')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: '되돌리기' })).toBeNull();
    expect(getTrackedEvents(analytics, 'todo_import_completed')).toEqual([]);
    expect(getTrackedEvents(analytics, 'todo_import_failed')).toEqual([]);
  });

  it('처리 중에 화면을 떠났다가 끝난 뒤 다시 열면 결과만 보이고 끝남을 남기지 않는다', async () => {
    // Given
    const server = createImportServer(RUNNING);
    const first = await renderImport(server);
    await screen.findByLabelText('할 일 만드는 중, 진행 중');
    await act(async () => first.unmount());
    server.moveTo(COMPLETED);

    // When
    const second = await renderImport(server);

    // Then
    expect(await screen.findByText('할 일 3개를 가져왔어요')).toBeOnTheScreen();
    expect(getTrackedEvents(first.analytics, 'todo_import_completed')).toEqual([]);
    expect(getTrackedEvents(second.analytics, 'todo_import_completed')).toEqual([]);
  });

  it('다른 계정의 기록이나 지워진 가져오기면 새로 가져오기로 보낸다', async () => {
    // Given
    // 조회 경계가 잡은 오류를 React가 console.error로 다시 찍는다
    silenceConsole('error');
    const server = createImportServer(RUNNING);
    server.httpClient.get.mockImplementation(
      respondByPath({
        'v1/auth/me': ok(createCurrentUserDto()),
        [DETAIL_PATH]: async () =>
          fail(createTodoImportApiError({ code: ErrorCode.TODO_IMPORT_2304, status: 404 })),
      }),
    );
    await renderImport(server);

    // When
    await fireEvent.press(await screen.findByRole('button', { name: '새로 가져오기' }));

    // Then
    expect(screen.getByText('가져오기 기록을 찾을 수 없어요')).toBeOnTheScreen();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/todo-import'));
  });
});
