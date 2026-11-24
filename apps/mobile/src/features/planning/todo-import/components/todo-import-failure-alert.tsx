import { TODO_IMPORT_LIMITS } from '@aido/api/vocabulary';
import { useTodoImportUploadSession } from '@src/bootstrap/providers/di-context';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { Button, HStack, InlineAlert } from '@src/shared/ui';
import { router } from 'expo-router';
import { type ComponentProps, useSyncExternalStore } from 'react';

import {
  getTodoImportUploadFailure,
  type TodoImportUploadFailure,
} from '../domains/todo-import.error';
import { useTodoImportId } from '../hooks/use-todo-import-id';

const FAILURE_LABEL_KEYS = {
  TOO_MANY_ITEMS: 'failure.tooManyItems',
  INVALID: 'failure.invalid',
  PLAN_LIMIT: 'failure.planLimit',
  CATEGORY_LIMIT: 'failure.categoryLimit',
  CATEGORY_NAME_TAKEN: 'failure.categoryNameTaken',
  CATEGORY_NOT_FOUND: 'failure.categoryNotFound',
  REJECTED: 'failure.rejected',
} as const satisfies Record<TodoImportUploadFailure, string>;

type TodoImportFailureAlertProps = Omit<
  ComponentProps<typeof InlineAlert>,
  'status' | 'title' | 'description' | 'action'
>;

/**
 * 서버가 일정을 받지 않아 멈춘 이유와 무엇을 바꿔 다시 설정할지. 확정할 때 바뀐 요금제·카테고리 한도면
 * 한도 안내도 열 수 있다. 이유는 이 기기에서 보낸 가져오기만 알아서 아니면 그리지 않는다
 */
export function TodoImportFailureAlert(props: TodoImportFailureAlertProps) {
  const { t } = useTranslation('todoImport');
  const [importId] = useTodoImportId();
  const uploadSession = useTodoImportUploadSession();
  const snapshot = useSyncExternalStore(uploadSession.subscribe, uploadSession.getSnapshot);
  const gate = useEntitlementGate('CALENDAR_IMPORT', { surface: 'todo_import' });
  const replace = useSingleTap(router.replace);

  if (snapshot.stage !== 'failed' || snapshot.importId !== importId) {
    return null;
  }

  const { rejection } = snapshot;
  const failure = getTodoImportUploadFailure(rejection);
  const isLimitFailure = failure === 'PLAN_LIMIT' || failure === 'CATEGORY_LIMIT';

  return (
    <InlineAlert
      status="danger"
      title={t(FAILURE_LABEL_KEYS[failure], { limit: TODO_IMPORT_LIMITS.MAX_ITEMS_PER_IMPORT })}
      action={
        <HStack gap={8} className="flex-wrap">
          <Button
            size="small"
            variant="weak"
            display="inline"
            onPress={() => replace('/todo-import')}
          >
            {t('failure.setUpAgain')}
          </Button>
          {isLimitFailure && (
            <Button
              size="small"
              variant="weak"
              display="inline"
              onPress={() => gate.promptIfBlockedError(rejection)}
            >
              {t('failure.viewPlan')}
            </Button>
          )}
        </HStack>
      }
      {...props}
    />
  );
}
