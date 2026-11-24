import type { ApiError } from '@src/core/errors/api-error';
import { ok, type Result } from '@src/core/errors/result';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { writeStoredValue } from '@src/shared/storage/define-stored-value';
import {
  createHttpClientStub,
  createMemorySyncStorage,
  createTestDi,
  createTodoImportSourceStub,
} from '@src/testing/core';
import { renderScreenHook } from '@src/testing/render';
import { onlineManager } from '@tanstack/react-query';

import {
  createTodoImportDto,
  createTodoImportSelection,
  IMPORT_ID,
} from '../__tests__/todo-import.fixtures';
import {
  createTodoImportSession,
  TodoImportSessionPolicy,
} from '../domains/todo-import-session.model';
import { todoImportSessionStoredValue } from '../schemas/todo-import-session-storage.schema';
import { useTodoImportResume } from './use-todo-import-resume';

const ACCOUNT_ID = 'user-1';
const DETAIL_PATH = `v1/todo-imports/${IMPORT_ID}`;
const ITEMS_PATH = `${DETAIL_PATH}/items`;
const COMMIT_PATH = `${DETAIL_PATH}/commit`;

/** 시작까지 받고 일정을 아직 하나도 올리지 않은 가져오기가 계정 저장소에 남은 기기 */
function setup() {
  const httpClient = createHttpClientStub();
  const draftStorage = createMemorySyncStorage();
  const todoImportSource = createTodoImportSourceStub({
    permission: { status: 'granted', canAskAgain: true },
  });
  const upload = Promise.withResolvers<Result<unknown, ApiError>>();
  const uploadStarted = Promise.withResolvers<void>();
  httpClient.get.mockImplementation(async (url) =>
    url === DETAIL_PATH
      ? ok({ todoImport: createTodoImportDto() })
      : new Promise<Result<unknown, ApiError>>(() => undefined),
  );
  httpClient.post.mockImplementation(async (url) => {
    if (url === ITEMS_PATH) {
      uploadStarted.resolve();
      return upload.promise;
    }
    return ok({ todoImport: createTodoImportDto({ status: 'QUEUED' }) });
  });
  writeStoredValue(
    draftStorage,
    todoImportSessionStoredValue,
    TodoImportSessionPolicy.withImportId(
      createTodoImportSession({
        idempotencyKey: 'stored-key',
        selection: createTodoImportSelection(),
        hasAdjustedRange: false,
      }),
      IMPORT_ID,
    ),
    ACCOUNT_ID,
  );
  const di = createTestDi({ ports: { httpClient, draftStorage, todoImportSource } });
  di.queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: ACCOUNT_ID }));
  return { httpClient, draftStorage, di, upload, uploadStarted };
}

describe('useTodoImportResume', () => {
  beforeEach(() => {
    onlineManager.setOnline(true);
  });

  it('앱 화면 묶음이 내려가면 올리던 업로드를 멈추고 확정하지 않는다', async () => {
    // Given
    const { httpClient, draftStorage, di, upload, uploadStarted } = setup();
    const { unmount } = await renderScreenHook(() => useTodoImportResume(), { di });
    await uploadStarted.promise;

    // When
    await unmount();
    upload.resolve(ok({ acceptedCount: 2, receivedItemCount: 2 }));
    // 멈춘 실행이 아직 돌고 있어 resume은 그 실행이 끝나길 기다린다
    await di.todoImportUploadSession.resume({ accountId: ACCOUNT_ID, untitledTitle: '' });

    // Then
    const commits = httpClient.post.mock.calls.filter(([url]) => url === COMMIT_PATH);
    expect(commits).toHaveLength(0);
    expect(httpClient.post.mock.calls.filter(([url]) => url === ITEMS_PATH)).toHaveLength(1);
    expect(draftStorage.keys()).toHaveLength(1);
  });
});
