import { useTranslation } from '@src/shared/i18n';
import {
  ArrowRightIcon,
  BottomSheet,
  Box,
  EditIcon,
  ListRow,
  TrashIcon,
  VStack,
} from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { PressableFeedback } from 'heroui-native';

import type { SubTodo } from '../../domains/sub-todo.model';
import type { Todo } from '../../domains/todo.model';
import { useDeleteSubTodoMutationOptions } from '../../queries/use-delete-sub-todo-mutation-options';

interface SubTodoActionsBottomSheetProps {
  todo: Todo;
  subTodo: SubTodo;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  onEdit: () => void;
}

export function SubTodoActionsBottomSheet({
  todo,
  subTodo,
  isOpen,
  onOpenChange,
  onClose,
  onEdit,
}: SubTodoActionsBottomSheetProps) {
  const { t } = useTranslation('todo');
  const deleteSubTodo = useMutation(useDeleteSubTodoMutationOptions());
  const isDeleting = deleteSubTodo.isPending;

  const handleDelete = async () => {
    if (isDeleting) {
      return;
    }

    const removed = await deleteSubTodo
      .mutateAsync({ todoId: todo.id, subTodoId: subTodo.id, startDate: todo.startDate })
      .catch(() => null);

    if (removed != null) {
      onClose();
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <VStack gap={8}>
        <PressableFeedback
          onPress={() => {
            onEdit();
            onClose();
          }}
          isDisabled={isDeleting}
        >
          <ListRow
            horizontalPadding="medium"
            verticalPadding="medium"
            left={
              <Box className="size-7 items-center justify-center rounded-full bg-gray-2">
                <EditIcon width={16} height={16} colorClassName="text-gray-7" />
              </Box>
            }
            contents={
              <ListRow.Texts type="1RowTypeA" top={t('actions.edit')} topProps={{ size: 'b2' }} />
            }
            right={<ArrowRightIcon width={16} height={16} colorClassName="text-gray-7" />}
          />
        </PressableFeedback>

        <PressableFeedback onPress={handleDelete} isDisabled={isDeleting}>
          <ListRow
            horizontalPadding="medium"
            verticalPadding="medium"
            left={
              <Box className="size-7 items-center justify-center rounded-full bg-error/10 dark:bg-error/20">
                <TrashIcon width={16} height={16} colorClassName="text-error" />
              </Box>
            }
            contents={
              <ListRow.Texts
                type="1RowTypeA"
                top={isDeleting ? t('actions.deleting') : t('actions.delete')}
                topProps={{ size: 'b2', tone: 'danger' }}
              />
            }
          />
        </PressableFeedback>
      </VStack>
    </BottomSheet>
  );
}
