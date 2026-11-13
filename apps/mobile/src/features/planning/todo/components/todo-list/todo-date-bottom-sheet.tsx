import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { RouteBottomSheet } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { Skeleton } from 'heroui-native';
import type { ComponentProps } from 'react';

import { getShiftedEndDate, TodoPolicy } from '../../domains/todo.model';
import { useSheetTodo } from '../../hooks/use-sheet-todo';
import { useUpdateTodoScheduleMutationOptions } from '../../queries/todo.mutations';
import { TodoDatePicker } from '../todo-date-picker';

type TodoDateBottomSheetProps = Omit<
  ComponentProps<typeof RouteBottomSheet>,
  'fallbackHref' | 'loading' | 'children'
>;

export function TodoDateBottomSheet(props: TodoDateBottomSheetProps) {
  return (
    <RouteBottomSheet {...props} fallbackHref="/feed" loading={<TodoDateBottomSheet.Loading />}>
      {(sheet) => <TodoDateBottomSheet.DateForm onClose={() => sheet.close()} />}
    </RouteBottomSheet>
  );
}

TodoDateBottomSheet.DateForm = function DateForm({ onClose }: { onClose: () => void }) {
  const { timeZone } = useDateFormatContext();
  const todo = useSheetTodo({ onMissing: onClose });
  const updateSchedule = useMutation(useUpdateTodoScheduleMutationOptions());

  if (todo == null) {
    return null;
  }

  return (
    <TodoDatePicker
      value={todo.startDate}
      onCancel={onClose}
      isConfirmDisabled={updateSchedule.isPending}
      onChange={(startDateKey) => {
        // 빠른 날짜 행도 같은 길로 오므로 저장 중에는 다시 보내지 않는다
        if (updateSchedule.isPending) {
          return;
        }
        if (startDateKey === todo.startDate) {
          onClose();

          return;
        }
        updateSchedule.mutate(
          {
            todoId: todo.id,
            changedField: 'date',
            input: {
              startDate: startDateKey,
              endDate: getShiftedEndDate(todo, startDateKey),
              scheduledTime: TodoPolicy.getLocalTime(todo, timeZone),
              isAllDay: todo.isAllDay,
            },
          },
          // 실패하면 시트를 남겨 고른 날짜로 다시 저장할 수 있게 한다
          { onSuccess: () => onClose() },
        );
      }}
    />
  );
};

TodoDateBottomSheet.Loading = function Loading() {
  return <Skeleton className="h-96 w-full rounded-xl" />;
};
