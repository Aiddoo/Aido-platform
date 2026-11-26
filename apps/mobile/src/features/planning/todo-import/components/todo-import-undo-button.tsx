import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useTranslation } from '@src/shared/i18n';
import { Button, useConfirmDialog } from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import type { ComponentProps } from 'react';

import { TodoImportPolicy } from '../domains/todo-import.model';
import { useTodoImportId } from '../hooks/use-todo-import-params';
import { useUndoTodoImportMutationOptions } from '../queries/todo-import.mutations';
import { useGetTodoImportQueryOptions } from '../queries/todo-import.queries';

type TodoImportUndoButtonProps = Omit<ComponentProps<typeof Button>, 'onPress' | 'isLoading'>;

/** 확인을 받고 가져온 할 일을 되돌린다. 서버가 되돌릴 수 있다고 할 때(기한 안)만 보인다 */
export function TodoImportUndoButton(props: TodoImportUndoButtonProps) {
  const { t } = useTranslation(['todoImport', 'common']);
  const [importId] = useTodoImportId();
  const now = useMinuteNow();
  const confirmDialog = useConfirmDialog();
  const { data: todoImport } = useSuspenseQuery(useGetTodoImportQueryOptions({ importId }));
  const undo = useMutation(useUndoTodoImportMutationOptions({ importId }));

  if (!TodoImportPolicy.canUndo(todoImport, now)) {
    return null;
  }

  const handleUndoPress = () =>
    confirmDialog.openAsync({
      title: t('result.undoConfirmTitle'),
      description: t('result.undoConfirmDescription'),
      confirmLabel: t('result.undo'),
      confirmColor: 'danger',
      cancelLabel: t('common:actions.cancel'),
      onConfirm: () => undo.mutateAsync(),
    });

  return (
    <Button
      testID="todo-import-undo"
      isLoading={undo.isPending}
      onPress={handleUndoPress}
      {...props}
    />
  );
}
