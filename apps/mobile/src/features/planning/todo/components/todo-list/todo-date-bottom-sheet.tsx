import { toDateKey } from '@src/shared/date/zoned';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useRetainedValue } from '@src/shared/hooks/use-retained-value';
import {
  BottomSheet,
  INQUIRY_SHEET_EXIT,
  QueryErrorBoundary,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  useSheetRoute,
} from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Skeleton } from 'heroui-native';
import { type ComponentProps, Suspense, useEffect } from 'react';

import { getShiftedEndDate, TodoPolicy } from '../../domains/todo.model';
import { useTodoId } from '../../hooks/use-todo-params';
import { useTodoSheetDateKey } from '../../hooks/use-todo-sheet-date-key';
import { useUpdateTodoScheduleMutationOptions } from '../../queries/todo.mutations';
import { useGetTodosByDateQueryOptions } from '../../queries/todo.queries';
import { toTodoScheduleValues } from '../../utils/todo-schedule-values';
import { TodoDatePickerContent } from '../todo-date-picker-content';

type TodoDateBottomSheetProps = Omit<
  ComponentProps<typeof BottomSheet>,
  'children' | 'isOpen' | 'onOpenChange'
>;

export function TodoDateBottomSheet(props: TodoDateBottomSheetProps) {
  const sheet = useSheetRoute('/feed');

  return (
    <BottomSheet {...props} isOpen={sheet.isOpen} onOpenChange={sheet.onOpenChange}>
      <QueryErrorBoundary
        fallback={(fallbackProps) => (
          <TodoDateBottomSheet.Error
            {...fallbackProps}
            onInquiry={() => sheet.close(INQUIRY_SHEET_EXIT)}
          />
        )}
      >
        <Suspense fallback={<TodoDateBottomSheet.Loading />}>
          <TodoDateBottomSheet.DateForm onClose={() => sheet.close()} />
        </Suspense>
      </QueryErrorBoundary>
    </BottomSheet>
  );
}

TodoDateBottomSheet.DateForm = function DateForm({ onClose }: { onClose: () => void }) {
  const { timeZone } = useDateFormatContext();
  const [todoId] = useTodoId();
  const [date] = useTodoSheetDateKey();
  const { data: todosByDate } = useSuspenseQuery(useGetTodosByDateQueryOptions({ date }));
  const todo = useRetainedValue(TodoPolicy.findTodo(todosByDate.todos, todoId));
  const updateSchedule = useMutation(useUpdateTodoScheduleMutationOptions());

  useEffect(() => {
    if (todo == null) {
      onClose();
    }
  }, [todo, onClose]);

  if (todo == null) {
    return null;
  }

  const editValues = toTodoScheduleValues(todo, timeZone);

  return (
    <TodoDatePickerContent
      value={toDateKey(editValues.startDate, timeZone)}
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
              scheduledTime: todo.isAllDay ? null : editValues.scheduledTime,
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

TodoDateBottomSheet.Error = function ErrorFallback({
  reset,
  onInquiry,
}: QueryErrorFallbackProps & { onInquiry: () => void }) {
  return <QueryErrorFallback reset={reset} onInquiry={onInquiry} />;
};
