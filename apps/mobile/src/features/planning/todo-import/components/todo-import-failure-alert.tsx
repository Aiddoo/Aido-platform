import { TODO_IMPORT_LIMITS } from '@aido/api/vocabulary';
import { useTodoImportUploadSession } from '@src/bootstrap/providers/di-context';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { Button, HStack, InlineAlert } from '@src/shared/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { type ComponentProps, useSyncExternalStore } from 'react';

import {
  getTodoImportUploadFailure,
  type TodoImportUploadFailure,
} from '../domains/todo-import.error';
import { useTodoImportId } from '../hooks/use-todo-import-params';
import { invalidateActiveTodoImport } from '../queries/todo-import-cache';

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

/** 멈춘 이유는 이 기기에서 보낸 가져오기만 알아서 아니면 그리지 않는다 */
export function TodoImportFailureAlert(props: TodoImportFailureAlertProps) {
  const { t } = useTranslation('todoImport');
  const [importId] = useTodoImportId();
  const uploadSession = useTodoImportUploadSession();
  const snapshot = useSyncExternalStore(uploadSession.subscribe, uploadSession.getSnapshot);
  const gate = useEntitlementGate('CALENDAR_IMPORT', { surface: 'todo_import' });
  const queryClient = useQueryClient();
  const router = useRouter();
  const replace = useSingleTap(router.replace);

  if (snapshot.stage !== 'failed' || snapshot.importId !== importId) {
    return null;
  }

  const { rejection } = snapshot;
  const failure = getTodoImportUploadFailure(rejection);
  const isLimitFailure = failure === 'PLAN_LIMIT' || failure === 'CATEGORY_LIMIT';

  // 서버에는 아직 업로드 중으로 남아 있을 수 있어 진행 중으로 알던 값을 낡게 해 설정 화면이 되돌려 보내지 않는다
  const handleSetUpAgainPress = () => {
    invalidateActiveTodoImport(queryClient);
    replace('/todo-import');
  };

  return (
    <InlineAlert
      status="danger"
      title={t(FAILURE_LABEL_KEYS[failure], { limit: TODO_IMPORT_LIMITS.MAX_ITEMS_PER_IMPORT })}
      action={
        <HStack gap={8} className="flex-wrap">
          <Button size="small" variant="weak" display="inline" onPress={handleSetUpAgainPress}>
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
