import { toDate, toDateKey } from '@src/shared/date/instant';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useRetainedValue } from '@src/shared/hooks/use-retained-value';
import { useTranslation } from '@src/shared/i18n';
import {
  BottomSheet,
  INQUIRY_SHEET_EXIT,
  QueryErrorActions,
  QueryErrorBoundary,
  type QueryErrorFallbackProps,
  Result,
  useSheetRoute,
} from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Skeleton } from 'heroui-native';
import { type ComponentProps, Suspense, useEffect } from 'react';

import { TodoPolicy } from '../../domains/todo.model';
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
      {sheet.isOpen && (
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
      )}
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
      value={toDate(editValues.startDate)}
      onCancel={onClose}
      onChange={(startDate) => {
        const startDateKey = toDateKey(startDate, timeZone);
        if (startDateKey === todo.startDate) {
          onClose();

          return;
        }
        updateSchedule.mutate({
          todoId: todo.id,
          changedField: 'date',
          input: {
            startDate: startDateKey,
            endDate: TodoPolicy.getShiftedEndDate(todo, startDateKey),
            scheduledTime: todo.isAllDay ? null : editValues.scheduledTime,
            isAllDay: todo.isAllDay,
          },
        });
        onClose();
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
  const { t } = useTranslation('common');

  return (
    <Result
      title={t('errorBoundary.title')}
      button={<QueryErrorActions onRetry={reset} onInquiry={onInquiry} />}
    />
  );
};
