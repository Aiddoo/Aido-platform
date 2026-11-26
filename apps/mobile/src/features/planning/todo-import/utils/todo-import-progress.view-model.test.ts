import { ErrorCode } from '@aido/api/errors';

import {
  createTodoImport,
  createTodoImportApiError,
  IMPORT_ID,
} from '../__tests__/todo-import.fixtures';
import type { TodoImportUploadSnapshot } from '../services/todo-import-upload.session';
import { getProgressView } from './todo-import-progress.view-model';

const IDLE: TodoImportUploadSnapshot = { stage: 'idle' };
const UPLOADING: TodoImportUploadSnapshot = {
  stage: 'uploading',
  importId: IMPORT_ID,
  uploadedChunkCount: 1,
  chunkCount: 2,
};
const INTERRUPTED: TodoImportUploadSnapshot = {
  stage: 'paused',
  importId: IMPORT_ID,
  reason: 'interrupted',
};
const FAILED: TodoImportUploadSnapshot = {
  stage: 'failed',
  importId: IMPORT_ID,
  rejection: createTodoImportApiError({ code: ErrorCode.TODO_IMPORT_2306 }),
};

describe('getProgressView', () => {
  it.each<[string, TodoImportUploadSnapshot, boolean, boolean, boolean]>([
    ['이 기기가 보내는 중이면 멈출 수 없다', UPLOADING, false, true, false],
    ['끊겨 멈췄으면 다시 시도와 멈추기를 보인다', INTERRUPTED, false, true, true],
    ['서버가 받지 않아 이 기기의 업로드가 끝났으면 멈출 수 있다', FAILED, false, true, true],
    ['다른 기기에서 보내는 중이면 멈출 수 있다', IDLE, false, true, true],
    ['다시 연 앱이 이어 보낼 상태를 가졌으면 멈출 수 없다', IDLE, true, true, false],
    ['오프라인이면 멈춘 이유도 멈추기도 보이지 않는다', INTERRUPTED, false, false, false],
    ['오프라인이면 실패한 업로드도 멈추기를 보이지 않는다', FAILED, false, false, false],
  ])('%s', (_case, snapshot, hasStoredSession, isOnline, expectedCanStop) => {
    // Given
    const todoImport = createTodoImport({ status: 'UPLOADING' });

    // When
    const view = getProgressView(todoImport, snapshot, { hasStoredSession, isOnline });

    // Then
    expect(view.canStop).toBe(expectedCanStop);
  });

  it.each<[string, TodoImportUploadSnapshot, boolean, 'interrupted' | null]>([
    ['끊겨 멈췄고 온라인이면 다시 시도를 보인다', INTERRUPTED, true, 'interrupted'],
    ['오프라인이면 다시 시도 대신 오프라인 안내만 보인다', INTERRUPTED, false, null],
    ['실패한 업로드는 다시 시도를 보이지 않는다', FAILED, true, null],
  ])('%s', (_case, snapshot, isOnline, expectedPauseReason) => {
    // Given
    const todoImport = createTodoImport({ status: 'UPLOADING' });

    // When
    const view = getProgressView(todoImport, snapshot, { hasStoredSession: true, isOnline });

    // Then
    expect(view.pauseReason).toBe(expectedPauseReason);
  });

  it('서버가 확정한 뒤에는 이 기기 상태와 상관없이 멈출 수 없다', () => {
    // Given
    const todoImport = createTodoImport({ status: 'RUNNING' });

    // When
    const view = getProgressView(todoImport, FAILED, { hasStoredSession: false, isOnline: true });

    // Then
    expect(view.canStop).toBe(false);
  });
});
