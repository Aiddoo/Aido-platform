import { useTranslation } from '@src/shared/i18n';
import {
  ArrowRightIcon,
  BottomSheet,
  Box,
  CalendarIcon,
  ClockIcon,
  EditIcon,
  ListIcon,
  ListRow,
  MoveRightIcon,
  SunIcon,
  TrashIcon,
  VStack,
} from '@src/shared/ui';
import { formatDate, isDateToday } from '@src/shared/utils/date';
import { useMutation } from '@tanstack/react-query';
import { PressableFeedback } from 'heroui-native';

import { useDeleteTodoMutationOptions } from '../../queries/use-delete-todo-mutation-options';
import { useUpdateTodoScheduleMutationOptions } from '../../queries/use-update-todo-schedule-mutation-options';
import { calculateTodaySchedule } from '../../utils/calculate-today-schedule';
import { calculateTomorrowSchedule } from '../../utils/calculate-tomorrow-schedule';
import type { TodoItemViewModel } from '../../view-models/todo-item.view-model';

interface TodoActionsBottomSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  todo: TodoItemViewModel;
  onNavigate: (action: 'edit' | 'date' | 'time' | 'category') => void;
}

export const TodoActionsBottomSheet = ({
  isOpen,
  onOpenChange,
  onClose,
  todo,
  onNavigate,
}: TodoActionsBottomSheetProps) => {
  const { t } = useTranslation('todo');
  const deleteMutation = useMutation(useDeleteTodoMutationOptions());
  const updateScheduleMutation = useMutation(useUpdateTodoScheduleMutationOptions());

  const isTodoToday = isDateToday(todo.startDateObj);

  const handleScheduleToggle = () => {
    const { startDate, endDate } = isTodoToday
      ? calculateTomorrowSchedule(todo.endDateObj)
      : calculateTodaySchedule(todo.endDateObj);

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
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
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
            contents={
              <ListRow.Texts type="1RowTypeA" top={t('actions.edit')} topProps={{ size: 'b2' }} />
            }
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
            contents={
              <ListRow.Texts
                type="1RowTypeA"
                top={t('actions.changeDate')}
                topProps={{ size: 'b2' }}
              />
            }
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
            contents={
              <ListRow.Texts
                type="1RowTypeA"
                top={t('actions.changeTime')}
                topProps={{ size: 'b2' }}
              />
            }
            right={<ArrowRightIcon width={16} height={16} colorClassName="text-gray-7" />}
          />
        </PressableFeedback>

        <PressableFeedback
          onPress={() => {
            onNavigate('category');
            onClose();
          }}
          isDisabled={deleteMutation.isPending}
        >
          <ListRow
            horizontalPadding="medium"
            verticalPadding="medium"
            left={
              <Box className="size-7 items-center justify-center rounded-full bg-gray-2">
                <ListIcon width={16} height={16} colorClassName="text-gray-7" />
              </Box>
            }
            contents={
              <ListRow.Texts
                type="1RowTypeA"
                top={t('actions.changeCategory')}
                topProps={{ size: 'b2' }}
              />
            }
            right={<ArrowRightIcon width={16} height={16} colorClassName="text-gray-7" />}
          />
        </PressableFeedback>

        <PressableFeedback onPress={handleScheduleToggle} isDisabled={deleteMutation.isPending}>
          <ListRow
            horizontalPadding="medium"
            verticalPadding="medium"
            left={
              <Box className="size-7 items-center justify-center rounded-full bg-gray-2">
                {isTodoToday ? (
                  <MoveRightIcon width={16} height={16} colorClassName="text-gray-7" />
                ) : (
                  <SunIcon width={16} height={16} colorClassName="text-gray-7" />
                )}
              </Box>
            }
            contents={
              <ListRow.Texts
                type="1RowTypeA"
                top={isTodoToday ? t('actions.doTomorrow') : t('actions.doToday')}
                topProps={{ size: 'b2' }}
              />
            }
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
                top={deleteMutation.isPending ? t('actions.deleting') : t('actions.delete')}
                topProps={{ size: 'b2', tone: 'danger' }}
              />
            }
          />
        </PressableFeedback>
      </VStack>
    </BottomSheet>
  );
};
