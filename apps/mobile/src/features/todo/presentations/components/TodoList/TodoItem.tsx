import { KeyboardBottomSheet } from '@src/shared/ui/BottomSheet';
import { HStack } from '@src/shared/ui/HStack';
import { LockIcon, MoreIcon } from '@src/shared/ui/Icon';
import { useOverlay } from '@src/shared/ui/Overlay';
import { Text } from '@src/shared/ui/Text';
import { VStack } from '@src/shared/ui/VStack';
import { cn } from '@src/shared/utils/cn';
import { formatDate } from '@src/shared/utils/date';
import { useMutation } from '@tanstack/react-query';
import { Checkbox, PressableFeedback } from 'heroui-native';
import { match } from 'ts-pattern';
import { useToggleTodoMutationOptions } from '../../queries/use-toggle-todo-mutation-options';
import { useUpdateTodoScheduleMutationOptions } from '../../queries/use-update-todo-schedule-mutation-options';
import type { TodoItemViewModel } from '../../view-models/todo-item.view-model';
import { AddTodoBottomSheet } from '../AddTodoBottomSheet';
import { TodoDatePickerContent } from '../TodoDatePickerContent';
import { TodoTimePickerContent } from '../TodoTimePickerContent';
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
  const toggleMutation = useMutation(useToggleTodoMutationOptions());
  const updateScheduleMutation = useMutation(useUpdateTodoScheduleMutationOptions());
  const showDateTime = todo.formattedTime && !todo.isAllDay;

  const openEditBottomSheet = () => {
    overlay.open(({ isOpen, close, exit }) => (
      <AddTodoBottomSheet
        mode="edit"
        todo={todo}
        isOpen={isOpen}
        onClose={close}
        onOpenChange={(open) => {
          if (!open) {
            close();
            exit();
          }
        }}
      />
    ));
  };

  const openDatePickerBottomSheet = () => {
    overlay.open(({ isOpen, close, exit }) => (
      <KeyboardBottomSheet
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            close();
            exit();
          }
        }}
      >
        {isOpen && (
          <TodoDatePickerContent
            startDate={todo.startDateObj}
            onCancel={close}
            onConfirm={(startDate) => {
              updateScheduleMutation.mutate({
                todoId: todo.id,
                input: {
                  startDate: formatDate(startDate),
                  endDate: null,
                  scheduledTime: todo.isAllDay ? null : (todo.scheduledTime24 ?? null),
                  isAllDay: todo.isAllDay,
                },
              });
              close();
            }}
          />
        )}
      </KeyboardBottomSheet>
    ));
  };

  const openTimePickerBottomSheet = () => {
    overlay.open(({ isOpen, close, exit }) => (
      <KeyboardBottomSheet
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            close();
            exit();
          }
        }}
      >
        {isOpen && (
          <TodoTimePickerContent
            draftDate={todo.startDateObj}
            scheduledTime={todo.scheduledTime24}
            isAllDay={todo.isAllDay}
            onCancel={close}
            onConfirm={(scheduledTime, isAllDay) => {
              updateScheduleMutation.mutate({
                todoId: todo.id,
                input: {
                  startDate: formatDate(todo.startDateObj),
                  endDate: todo.endDateObj ? formatDate(todo.endDateObj) : null,
                  scheduledTime: isAllDay ? null : (scheduledTime ?? null),
                  isAllDay,
                },
              });
              close();
            }}
          />
        )}
      </KeyboardBottomSheet>
    ));
  };

  const openActionsBottomSheet = () => {
    let afterClose: (() => void) | null = null;

    overlay.open(({ isOpen, close, exit }) => (
      <TodoActionsBottomSheet
        isOpen={isOpen}
        todo={todo}
        onClose={close}
        onOpenChange={(open) => {
          if (!open) {
            close();
            exit();
            afterClose?.();
          }
        }}
        onNavigate={(action) => {
          afterClose = match(action)
            .with('edit', () => openEditBottomSheet)
            .with('date', () => openDatePickerBottomSheet)
            .with('time', () => openTimePickerBottomSheet)
            .exhaustive();
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

        <PressableFeedback onPress={openActionsBottomSheet} hitSlop={8}>
          <MoreIcon width={20} height={20} colorClassName="text-gray-5" />
        </PressableFeedback>
      </HStack>
    </PressableFeedback>
  );
};
