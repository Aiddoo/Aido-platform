import { KeyboardBottomSheet } from '@src/shared/ui/BottomSheet';
import { Box } from '@src/shared/ui/Box/Box';
import {
  ArrowRightIcon,
  CalendarIcon,
  ClockIcon,
  EditIcon,
  SunIcon,
  TrashIcon,
} from '@src/shared/ui/Icon';
import { ListRow } from '@src/shared/ui/ListRow/ListRow';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { formatDate } from '@src/shared/utils/date';
import { useMutation } from '@tanstack/react-query';
import { PressableFeedback } from 'heroui-native';
import { deleteTodoMutationOptions } from '../../queries/delete-todo-mutation-options';
import { updateTodoScheduleMutationOptions } from '../../queries/update-todo-schedule-mutation-options';
import { calculateTomorrowSchedule } from '../../utils/calculate-tomorrow-schedule';
import type { TodoItemViewModel } from '../../view-models/todo-item.view-model';

interface TodoActionsBottomSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  todo: TodoItemViewModel;
  onNavigate: (action: 'edit' | 'date' | 'time') => void;
}

export const TodoActionsBottomSheet = ({
  isOpen,
  onOpenChange,
  onClose,
  todo,
  onNavigate,
}: TodoActionsBottomSheetProps) => {
  const deleteMutation = useMutation(deleteTodoMutationOptions());
  const updateScheduleMutation = useMutation(updateTodoScheduleMutationOptions());

  const handleDoTomorrow = () => {
    const { startDate, endDate } = calculateTomorrowSchedule(todo.endDateObj);
    updateScheduleMutation.mutate(
      {
        todoId: todo.id,
        input: {
          startDate: formatDate(startDate),
          endDate: endDate ? formatDate(endDate) : null,
          scheduledTime: todo.isAllDay ? null : (todo.scheduledTime24 ?? null),
          isAllDay: todo.isAllDay,
        },
      },
      { onSuccess: onClose },
    );
  };

  const handleDelete = () => {
    deleteMutation.mutate({ todoId: todo.id, startDate: todo.startDate }, { onSuccess: onClose });
  };

  return (
    <KeyboardBottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <VStack gap={8}>
        <PressableFeedback
          onPress={() => {
            onNavigate('edit');
            onClose();
          }}
          isDisabled={deleteMutation.isPending}
        >
          <ListRow
            horizontalPadding="medium"
            verticalPadding="medium"
            left={
              <Box className="size-7 items-center justify-center rounded-full bg-gray-2">
                <EditIcon width={16} height={16} colorClassName="text-gray-7" />
              </Box>
            }
            contents={<ListRow.Texts type="1RowTypeA" top="수정하기" topProps={{ size: 'b2' }} />}
            right={<ArrowRightIcon width={16} height={16} colorClassName="text-gray-7" />}
          />
        </PressableFeedback>

        <PressableFeedback
          onPress={() => {
            onNavigate('date');
            onClose();
          }}
          isDisabled={deleteMutation.isPending}
        >
          <ListRow
            horizontalPadding="medium"
            verticalPadding="medium"
            left={
              <Box className="size-7 items-center justify-center rounded-full bg-gray-2">
                <CalendarIcon width={16} height={16} colorClassName="text-gray-7" />
              </Box>
            }
            contents={<ListRow.Texts type="1RowTypeA" top="날짜 변경" topProps={{ size: 'b2' }} />}
            right={<ArrowRightIcon width={16} height={16} colorClassName="text-gray-7" />}
          />
        </PressableFeedback>

        <PressableFeedback
          onPress={() => {
            onNavigate('time');
            onClose();
          }}
          isDisabled={deleteMutation.isPending}
        >
          <ListRow
            horizontalPadding="medium"
            verticalPadding="medium"
            left={
              <Box className="size-7 items-center justify-center rounded-full bg-gray-2">
                <ClockIcon width={16} height={16} colorClassName="text-gray-7" />
              </Box>
            }
            contents={<ListRow.Texts type="1RowTypeA" top="시간 변경" topProps={{ size: 'b2' }} />}
            right={<ArrowRightIcon width={16} height={16} colorClassName="text-gray-7" />}
          />
        </PressableFeedback>

        <PressableFeedback onPress={handleDoTomorrow} isDisabled={deleteMutation.isPending}>
          <ListRow
            horizontalPadding="medium"
            verticalPadding="medium"
            left={
              <Box className="size-7 items-center justify-center rounded-full bg-gray-2">
                <SunIcon width={16} height={16} colorClassName="text-gray-7" />
              </Box>
            }
            contents={<ListRow.Texts type="1RowTypeA" top="내일하기" topProps={{ size: 'b2' }} />}
          />
        </PressableFeedback>

        <PressableFeedback onPress={handleDelete} isDisabled={deleteMutation.isPending}>
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
                top={deleteMutation.isPending ? '삭제 중...' : '삭제하기'}
                topProps={{ size: 'b2', tone: 'danger' }}
              />
            }
          />
        </PressableFeedback>
      </VStack>
    </KeyboardBottomSheet>
  );
};
