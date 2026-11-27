import type { OsPermission } from '@src/core/ports/os-permission';
import { TODO_QUERY_KEYS } from '@src/features/planning/todo/queries/todo-query-keys';
import { createTestQueryClient } from '@src/testing/core';

import { createTodoImport } from '../__tests__/todo-import.fixtures';
import {
  findCachedActiveTodoImport,
  invalidateActiveTodoImport,
  keepBlockedCalendarPermission,
  settleTodoImportFinished,
} from './todo-import-cache';
import { TODO_IMPORT_QUERY_KEYS } from './todo-import-query-keys';

const GRANTED: OsPermission = { status: 'granted', canAskAgain: true };
const UNDETERMINED: OsPermission = { status: 'undetermined', canAskAgain: true };
const DENIED: OsPermission = { status: 'denied', canAskAgain: true };
const BLOCKED: OsPermission = { status: 'denied', canAskAgain: false };

describe('settleTodoImportFinished', () => {
  it.each([
    ['처음 보는 가져오기(이전 값 없음)', null, 'COMPLETED', false],
    ['아직 처리 중', 'QUEUED', 'RUNNING', false],
    ['처리 중에서 처음 끝남', 'RUNNING', 'COMPLETED', true],
    ['되돌리기가 처음 끝남', 'UNDOING', 'UNDONE', true],
    ['이미 끝난 뒤 다시 받음', 'COMPLETED', 'COMPLETED', false],
  ] as const)('%s', async (_case, previousStatus, nextStatus, shouldRefresh) => {
    // Given
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(TODO_QUERY_KEYS.lists(), []);

    // When
    await settleTodoImportFinished(queryClient, {
      previous: previousStatus == null ? null : createTodoImport({ status: previousStatus }),
      next: createTodoImport({ status: nextStatus }),
    });

    // Then
    expect(queryClient.getQueryState(TODO_QUERY_KEYS.lists())?.isInvalidated).toBe(shouldRefresh);
  });
});

describe('settleTodoImportFinished › 진행 중으로 알던 가져오기', () => {
  it('다른 기기에서 끝난 가져오기를 처음 받으면 진행 중으로 알던 값만 낡게 한다', async () => {
    // Given
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(TODO_QUERY_KEYS.lists(), []);
    queryClient.setQueryData(TODO_IMPORT_QUERY_KEYS.active(), createTodoImport());

    // When
    await settleTodoImportFinished(queryClient, {
      previous: null,
      next: createTodoImport({ status: 'COMPLETED' }),
    });

    // Then
    expect(queryClient.getQueryState(TODO_IMPORT_QUERY_KEYS.active())?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(TODO_QUERY_KEYS.lists())?.isInvalidated).toBe(false);
  });
});

describe('findCachedActiveTodoImport', () => {
  it('받아 둔 진행 중인 가져오기를 준다', () => {
    // Given
    const queryClient = createTestQueryClient();
    const activeImport = createTodoImport();
    queryClient.setQueryData(TODO_IMPORT_QUERY_KEYS.active(), activeImport);

    // When
    const cached = findCachedActiveTodoImport(queryClient);

    // Then
    expect(cached).toEqual(activeImport);
  });

  it('아직 묻지 않았으면 모른다', () => {
    // Given
    const queryClient = createTestQueryClient();

    // When
    const cached = findCachedActiveTodoImport(queryClient);

    // Then
    expect(cached).toBeNull();
  });

  it('진행 중인 가져오기가 없다고 받았으면 없다', () => {
    // Given
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(TODO_IMPORT_QUERY_KEYS.active(), null);

    // When
    const cached = findCachedActiveTodoImport(queryClient);

    // Then
    expect(cached).toBeNull();
  });

  it('낡음 표시가 붙은 값은 믿지 않아 설정 화면이 끝난 가져오기로 되돌려 보내지 않는다', async () => {
    // Given
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(TODO_IMPORT_QUERY_KEYS.active(), createTodoImport());
    await invalidateActiveTodoImport(queryClient);

    // When
    const cached = findCachedActiveTodoImport(queryClient);

    // Then
    expect(cached).toBeNull();
  });
});

describe('keepBlockedCalendarPermission', () => {
  it('다시 묻지 않음 답을 받은 뒤 Android가 묻기 전으로 읽어도 다시 묻지 않음을 남긴다', () => {
    // When
    const permission = keepBlockedCalendarPermission(BLOCKED, UNDETERMINED);

    // Then
    expect(permission).toEqual(BLOCKED);
  });

  it('설정에서 허용하고 돌아오면 허용으로 바꾼다', () => {
    // When
    const permission = keepBlockedCalendarPermission(BLOCKED, GRANTED);

    // Then
    expect(permission).toEqual(GRANTED);
  });

  it('다시 물을 수 있던 답은 새로 읽은 값을 따른다', () => {
    // When
    const permission = keepBlockedCalendarPermission(DENIED, UNDETERMINED);

    // Then
    expect(permission).toEqual(UNDETERMINED);
  });
});
