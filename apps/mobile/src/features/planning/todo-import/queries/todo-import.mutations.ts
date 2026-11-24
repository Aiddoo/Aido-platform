import {
  useTodoImportApi,
  useTodoImportSource,
  useTodoImportUploadSession,
} from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { useMyAccountId } from '@src/features/identity/user/hooks/use-my-account-id';
import { useTrack } from '@src/shared/analytics';
import { t } from '@src/shared/i18n';
import { useMutationErrorFeedback } from '@src/shared/query/use-mutation-error-feedback';
import { readStoredValue, writeStoredValue } from '@src/shared/storage/define-stored-value';
import { useStoredValueStorage } from '@src/shared/storage/use-stored-value';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import type { TodoImportSelection } from '../domains/todo-import-session.model';
import {
  findActiveTodoImportId,
  isTodoImportStartHandledError,
  isTodoImportStatusConflictError,
} from '../domains/todo-import.error';
import { rememberTodoImportId } from '../domains/todo-import.model';
import { lastTodoImportIdsStoredValue } from '../schemas/todo-import-last-storage.schema';
import { toTodoImportStartedParams } from '../utils/todo-import-analytics';
import {
  invalidateActiveTodoImport,
  setCachedCalendarPermission,
  invalidateTodoImport,
  setTodoImportInCache,
} from './todo-import-cache';
import { TODO_IMPORT_MUTATION_KEYS } from './todo-import-mutation-keys';

interface StartTodoImportVariables {
  accountId: string;
  selection: TodoImportSelection;
  untitledTitle: string;
}

/** "가져오기"를 누른 순간이 업로드 동의다. 시작이 받아지면 업로드는 세션이 화면 밖에서 이어 간다 */
export function useStartTodoImportMutationOptions() {
  const uploadSession = useTodoImportUploadSession();
  const queryClient = useQueryClient();
  const lastImportStorage = useStoredValueStorage(lastTodoImportIdsStoredValue);
  const { trackEvent } = useTrack();

  return mutationOptions({
    // 오프라인에서 쥐고 있다가 나중에 보내면 사용자가 모르는 사이 가져오기가 시작된다
    networkMode: 'always',
    mutationKey: TODO_IMPORT_MUTATION_KEYS.start(),
    mutationFn: async (variables: StartTodoImportVariables) =>
      unwrap(await uploadSession.start(variables)),
    onSuccess: ({ todoImport }, { accountId, selection }) => {
      setTodoImportInCache(queryClient, todoImport);
      writeStoredValue(
        lastImportStorage,
        lastTodoImportIdsStoredValue,
        rememberTodoImportId(
          readStoredValue(lastImportStorage, lastTodoImportIdsStoredValue, accountId),
          todoImport.id,
        ),
        accountId,
      );
      trackEvent('todo_import_created', toTodoImportStartedParams(selection));
    },
    onSettled: () => invalidateActiveTodoImport(queryClient),
    meta: {
      errorFeedback: {
        feature: 'todo_import',
        fallbackKey: 'todoImport:toasts.startFailed',
        isHandledByFeature: isTodoImportStartHandledError,
      },
    },
  });
}

/** 업로드 중인 가져오기를 멈춘다. 이 기기에서 올리던 것이면 이어 올릴 상태도 함께 지운다 */
export function useCancelTodoImportMutationOptions({ importId }: { importId: string }) {
  const uploadSession = useTodoImportUploadSession();
  const accountId = useMyAccountId();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const showMutationError = useMutationErrorFeedback();

  return mutationOptions({
    networkMode: 'always',
    mutationKey: TODO_IMPORT_MUTATION_KEYS.cancel({ importId }),
    mutationFn: async () => unwrap(await uploadSession.cancel({ accountId, importId })),
    onSuccess: (todoImport) => {
      setTodoImportInCache(queryClient, todoImport);
      trackEvent('todo_import_cancel_completed');
    },
    // 서버가 이미 확정해 멈출 수 없으면(2305) 여러 동작이 함께 쓰는 상태 충돌 문구 대신 이유를 알린다
    onError: (error) => {
      if (isTodoImportStatusConflictError(error)) {
        showMutationError(error, {
          feature: 'todo_import',
          title: t('todoImport:toasts.cancelTooLate'),
        });
      }
    },
    // 멈추지 못했어도 지금 상태를 다시 받아 화면이 다음 단계로 넘어간다
    onSettled: () =>
      Promise.all([
        invalidateActiveTodoImport(queryClient),
        invalidateTodoImport(queryClient, importId),
      ]),
    meta: {
      errorFeedback: {
        feature: 'todo_import',
        fallbackKey: 'todoImport:toasts.cancelFailed',
        isHandledByFeature: isTodoImportStatusConflictError,
      },
    },
  });
}

/** 되돌리기는 서버 잡이 지운다. 응답(UNDOING)을 쓰면 조회가 다시 돌아 끝날 때 할 일을 한 번 다시 받는다 */
export function useUndoTodoImportMutationOptions({ importId }: { importId: string }) {
  const todoImportApi = useTodoImportApi();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();

  return mutationOptions({
    networkMode: 'always',
    mutationKey: TODO_IMPORT_MUTATION_KEYS.undo({ importId }),
    mutationFn: async () => unwrap(await todoImportApi.undoImport(importId)),
    onSuccess: (todoImport) => {
      setTodoImportInCache(queryClient, todoImport);
      trackEvent('todo_import_undo_requested');
    },
    onSettled: () => invalidateActiveTodoImport(queryClient),
    meta: {
      errorFeedback: {
        feature: 'todo_import',
        fallbackKey: 'todoImport:toasts.undoFailed',
        // 다른 가져오기가 진행 중이라 서버가 거절했으면(2301) 언제 되돌릴 수 있는지 함께 알린다
        describe: (error) =>
          findActiveTodoImportId(error) == null
            ? undefined
            : t('todoImport:toasts.undoWhileImporting'),
      },
    },
  });
}

/** 안내 화면의 "계속"을 눌렀을 때만 시스템 창을 띄운다 */
export function useRequestCalendarPermissionMutationOptions() {
  const todoImportSource = useTodoImportSource();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();

  return mutationOptions({
    // 권한 창은 기기 안에서 뜨므로 오프라인에서도 멈추지 않는다
    networkMode: 'always',
    mutationFn: () => todoImportSource.requestPermission(),
    onSuccess: (permission) => {
      setCachedCalendarPermission(queryClient, permission);
      trackEvent('todo_import_permission_requested', { status: permission.status });
    },
    meta: {
      errorFeedback: {
        feature: 'todo_import',
        fallbackKey: 'todoImport:toasts.permissionRequestFailed',
      },
    },
  });
}
