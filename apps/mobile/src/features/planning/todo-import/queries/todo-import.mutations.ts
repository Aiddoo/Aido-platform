import {
  useTodoImportApi,
  useTodoImportSource,
  useTodoImportUploadSession,
} from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { useTrack } from '@src/shared/analytics';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import type { TodoImportSelection } from '../domains/todo-import-session.model';
import { isTodoImportStartHandledError } from '../domains/todo-import.error';
import { toTodoImportStartedParams } from '../utils/todo-import-analytics';
import {
  invalidateActiveTodoImport,
  setCachedCalendarPermission,
  setTodoImportInCache,
} from './todo-import-cache';
import { TODO_IMPORT_MUTATION_KEYS } from './todo-import-mutation-keys';

interface StartTodoImportVariables {
  accountId: string;
  selection: TodoImportSelection;
  /** 제목이 빈 일정에 붙일 문구(앱 언어) */
  untitledTitle: string;
}

/** "가져오기"를 누른 순간이 업로드 동의다. 시작이 받아지면 업로드는 세션이 화면 밖에서 이어 간다 */
export function useStartTodoImportMutationOptions() {
  const uploadSession = useTodoImportUploadSession();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();

  return mutationOptions({
    // 오프라인에서 쥐고 있다가 나중에 보내면 사용자가 모르는 사이 가져오기가 시작된다
    networkMode: 'always',
    mutationKey: TODO_IMPORT_MUTATION_KEYS.start(),
    mutationFn: async (variables: StartTodoImportVariables) =>
      unwrap(await uploadSession.start(variables)),
    onSuccess: ({ todoImport }, { selection }) => {
      setTodoImportInCache(queryClient, todoImport);
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

/** 확정 전(업로드 중)에만 멈춘다. 이 기기에 이어 보낼 상태가 없을 때(다른 기기에서 시작) 쓴다 */
export function useCancelTodoImportMutationOptions({ importId }: { importId: string }) {
  const todoImportApi = useTodoImportApi();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();

  return mutationOptions({
    networkMode: 'always',
    mutationKey: TODO_IMPORT_MUTATION_KEYS.cancel({ importId }),
    mutationFn: async () => unwrap(await todoImportApi.cancelImport(importId)),
    onSuccess: (todoImport) => {
      setTodoImportInCache(queryClient, todoImport);
      trackEvent('todo_import_cancel_completed');
    },
    onSettled: () => invalidateActiveTodoImport(queryClient),
    meta: {
      errorFeedback: { feature: 'todo_import', fallbackKey: 'todoImport:toasts.cancelFailed' },
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
      errorFeedback: { feature: 'todo_import', fallbackKey: 'todoImport:toasts.undoFailed' },
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
