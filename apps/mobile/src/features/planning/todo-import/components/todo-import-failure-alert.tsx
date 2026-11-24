import { TODO_IMPORT_LIMITS } from '@aido/api/vocabulary';
import { useTodoImportUploadSession } from '@src/bootstrap/providers/di-context';
import { useTranslation } from '@src/shared/i18n';
import { InlineAlert } from '@src/shared/ui';
import { type ComponentProps, useSyncExternalStore } from 'react';

import {
  getTodoImportUploadFailure,
  type TodoImportUploadFailure,
} from '../domains/todo-import.error';
import { useTodoImportId } from '../hooks/use-todo-import-id';

const FAILURE_LABEL_KEYS = {
  TOO_MANY_ITEMS: 'failure.tooManyItems',
  INVALID: 'failure.invalid',
  REJECTED: 'failure.rejected',
} as const satisfies Record<TodoImportUploadFailure, string>;

type TodoImportFailureAlertProps = Omit<
  ComponentProps<typeof InlineAlert>,
  'status' | 'title' | 'description'
>;

/** 서버가 일정을 받지 않아 멈춘 이유. 이유는 이 기기에서 보낸 가져오기만 알아서 아니면 그리지 않는다 */
export function TodoImportFailureAlert(props: TodoImportFailureAlertProps) {
  const { t } = useTranslation('todoImport');
  const [importId] = useTodoImportId();
  const uploadSession = useTodoImportUploadSession();
  const snapshot = useSyncExternalStore(uploadSession.subscribe, uploadSession.getSnapshot);

  if (snapshot.stage !== 'failed' || snapshot.importId !== importId) {
    return null;
  }

  return (
    <InlineAlert
      status="danger"
      title={t(FAILURE_LABEL_KEYS[getTodoImportUploadFailure(snapshot.code)], {
        limit: TODO_IMPORT_LIMITS.MAX_ITEMS_PER_IMPORT,
      })}
      {...props}
    />
  );
}
