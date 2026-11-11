import { useTranslation } from '@src/shared/i18n';
import { RouteBottomSheet, EditIcon, type SheetRouteExit, TrashIcon, VStack } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { Skeleton } from 'heroui-native';
import type { ComponentProps } from 'react';

import { useSheetSubTodo } from '../../hooks/use-sheet-todo';
import { useTodoSheetDateKey } from '../../hooks/use-todo-sheet-date-key';
import { useDeleteSubTodoMutationOptions } from '../../queries/sub-todo.mutations';
import { TodoActionRow } from '../todo-action-row';

type SubTodoActionsBottomSheetProps = Omit<
  ComponentProps<typeof RouteBottomSheet>,
  'fallbackHref' | 'loading' | 'children'
>;

export function SubTodoActionsBottomSheet(props: SubTodoActionsBottomSheetProps) {
  return (
    <RouteBottomSheet
      {...props}
      fallbackHref="/feed"
      loading={<SubTodoActionsBottomSheet.Loading />}
    >
      {(sheet) => <SubTodoActionsBottomSheet.ActionList onClose={sheet.close} />}
    </RouteBottomSheet>
  );
}

interface SubTodoActionListProps {
  onClose: (next?: SheetRouteExit) => void;
}

SubTodoActionsBottomSheet.ActionList = function ActionList({ onClose }: SubTodoActionListProps) {
  const { t } = useTranslation('todo');
  const [date] = useTodoSheetDateKey();
  const target = useSheetSubTodo({ onMissing: onClose });
  const deleteSubTodo = useMutation(useDeleteSubTodoMutationOptions());
  const isDeleting = deleteSubTodo.isPending;

  if (target == null) {
    return null;
  }
  const { todo, subTodo } = target;

  const handleDelete = async () => {
    if (isDeleting) {
      return;
    }

    try {
      await deleteSubTodo.mutateAsync({ todoId: todo.id, subTodoId: subTodo.id, date });
      onClose();
    } catch {
      // 실패 안내와 보고는 mutation의 meta.errorFeedback이 맡는다
    }
  };

  return (
    <VStack gap={8}>
      <TodoActionRow
        icon={<EditIcon width={16} height={16} colorClassName="text-main" />}
        label={t('actions.edit')}
        hasArrow
        isDisabled={isDeleting}
        onPress={() =>
          onClose({
            type: 'replace',
            href: {
              pathname: '/todo/[todoId]/sub-todos/[subTodoId]/edit',
              params: { todoId: todo.id, subTodoId: subTodo.id, date },
            },
          })
        }
      />

      <TodoActionRow
        icon={<TrashIcon width={16} height={16} colorClassName="text-error" />}
        label={isDeleting ? t('actions.deleting') : t('actions.delete')}
        isDanger
        isDisabled={isDeleting}
        onPress={handleDelete}
      />
    </VStack>
  );
};

SubTodoActionsBottomSheet.Loading = function Loading() {
  return (
    <VStack gap={8}>
      {range(2).map((index) => (
        <Skeleton key={index} className="h-14 w-full rounded-xl" />
      ))}
    </VStack>
  );
};
