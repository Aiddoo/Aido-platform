import { HStack } from '@src/shared/ui/HStack/HStack';
import { LockIcon, MoreIcon } from '@src/shared/ui/Icon';
import { useOverlay } from '@src/shared/ui/Overlay';
import { Text } from '@src/shared/ui/Text/Text';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { cn } from '@src/shared/utils/cn';
import { formatDate } from '@src/shared/utils/date';
import { useMutation } from '@tanstack/react-query';
import { Checkbox, PressableFeedback } from 'heroui-native';
import { deleteTodoMutationOptions } from '../../queries/delete-todo-mutation-options';
import { toggleTodoMutationOptions } from '../../queries/toggle-todo-mutation-options';
import { updateTodoScheduleMutationOptions } from '../../queries/update-todo-schedule-mutation-options';
import type { TodoItemViewModel } from '../../view-models/todo-item.view-model';
import { AddTodoBottomSheet } from '../AddTodoBottomSheet';
import { TodoDateTimeBottomSheet } from '../TodoDateTimeBottomSheet';
import { TodoActionsBottomSheet } from './TodoActionsBottomSheet';

interface TodoItemProps {
  todo: TodoItemViewModel;
  onPress?: (todoId: number) => void;
  drag?: () => void;
  isActive?: boolean;
  isDragDisabled?: boolean;
}

export const TodoItem = ({ todo, onPress, drag, isActive, isDragDisabled }: TodoItemProps) => {
  const overlay = useOverlay();
  const toggleMutation = useMutation(toggleTodoMutationOptions());
  const deleteMutation = useMutation(deleteTodoMutationOptions());
  const updateScheduleMutation = useMutation(updateTodoScheduleMutationOptions());
  const showDateTime = todo.formattedTime && !todo.isAllDay;

  const openEditBottomSheet = () => {
    overlay.open(({ isOpen, close, exit }) => (
      <AddTodoBottomSheet
        mode="edit"
        todo={todo}
        isOpen={isOpen}
        onRequestClose={close}
        onOpenChange={(open) => {
          if (!open) {
            close();
            exit();
          }
        }}
      />
    ));
  };

  const openDateTimeBottomSheet = () => {
    overlay.open(({ isOpen, close, exit }) => (
      <TodoDateTimeBottomSheet
        isOpen={isOpen}
        onRequestClose={close}
        onOpenChange={(open) => {
          if (!open) {
            close();
            exit();
          }
        }}
        todo={todo}
        onConfirm={({ startDate, endDate, scheduledTime, isAllDay }) => {
          updateScheduleMutation.mutate({
            todoId: todo.id,
            input: {
              startDate: formatDate(startDate),
              endDate: endDate ? formatDate(endDate) : null,
              scheduledTime: isAllDay ? null : (scheduledTime ?? null),
              isAllDay,
            },
          });
        }}
      />
    ));
  };

  const openActionsBottomSheet = () => {
    let afterClose: (() => void) | null = null;

    overlay.open(({ isOpen, close, exit }) => (
      <TodoActionsBottomSheet
        isOpen={isOpen}
        isDeletePending={deleteMutation.isPending}
        onRequestClose={close}
        onOpenChange={(open) => {
          if (!open) {
            close();
            exit();
            afterClose?.();
          }
        }}
        onEdit={() => {
          afterClose = openEditBottomSheet;
        }}
        onUpdateDateTime={() => {
          afterClose = openDateTimeBottomSheet;
        }}
        onDelete={() => {
          afterClose = () => deleteMutation.mutate({ todoId: todo.id, startDate: todo.startDate });
        }}
      />
    ));
  };

  return (
    <PressableFeedback
      onPress={() => onPress?.(todo.id)}
      onLongPress={isDragDisabled ? undefined : drag}
      isDisabled={isActive}
      className={cn('py-2 rounded-xl', isActive && 'bg-gray-1')}
    >
      <HStack gap={12} align="center">
        <Checkbox
          className="shadow-none border border-main size-5 rounded-md"
          isSelected={todo.completed}
          onSelectedChange={() =>
            toggleMutation.mutate({ todoId: todo.id, body: { completed: !todo.completed } })
          }
          isDisabled={toggleMutation.isPending}
        />

        <VStack flex={1} gap={2}>
          <HStack gap={4} align="center">
            <Text
              size="b3"
              weight="medium"
              strikethrough={todo.completed}
              shade={todo.completed ? 5 : undefined}
            >
              {todo.title}
            </Text>
            {todo.visibility === 'PRIVATE' && (
              <LockIcon width={14} height={14} colorClassName="text-gray-5" />
            )}
          </HStack>
          {showDateTime && (
            <Text size="e1" shade={6}>
              {todo.formattedTime}
            </Text>
          )}
        </VStack>

        <PressableFeedback className="p-1" onPress={openActionsBottomSheet}>
          <MoreIcon width={20} height={20} colorClassName="text-gray-5" />
        </PressableFeedback>
      </HStack>
    </PressableFeedback>
  );
};
