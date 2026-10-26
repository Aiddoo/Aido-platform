import { useTodoScreenParams } from '@src/features/todo/hooks/use-todo-screen-params';
import { useTodoSheetDateParam } from '@src/features/todo/hooks/use-todo-sheet-params';
import { useRetainedValue } from '@src/shared/hooks/use-retained-value';
import { useTranslation } from '@src/shared/i18n';
import {
  BottomSheet,
  Box,
  INQUIRY_SHEET_EXIT,
  QueryErrorActions,
  QueryErrorBoundary,
  type QueryErrorFallbackProps,
  Result,
  useSheetRoute,
} from '@src/shared/ui';
import { formatDate } from '@src/shared/utils/date';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Spinner } from 'heroui-native';
import { type ComponentProps, Suspense, useEffect } from 'react';

import { useGetTodosByDateQueryOptions } from '../../queries/get-todos-by-date-query-options';
import { useUpdateTodoScheduleMutationOptions } from '../../queries/use-update-todo-schedule-mutation-options';
import { TODO_SHEET_FALLBACK_HREF } from '../../utils/navigation/todo-sheet-href';
import { toTodoEditFormValues } from '../../utils/to-todo-edit-form-values';
import { findSheetTodo } from '../../utils/view-models/todo-sheet-target.view-model';
import { TodoTimePickerContent } from '../todo-time-picker-content';

type TodoTimeBottomSheetProps = Omit<
  ComponentProps<typeof BottomSheet>,
  'children' | 'isOpen' | 'onOpenChange'
>;

export function TodoTimeBottomSheet(props: TodoTimeBottomSheetProps) {
  const sheet = useSheetRoute(TODO_SHEET_FALLBACK_HREF);

  return (
    <BottomSheet {...props} isOpen={sheet.isOpen} onOpenChange={sheet.onOpenChange}>
      {sheet.isOpen && (
        <QueryErrorBoundary
          fallback={(fallbackProps) => (
            <TodoTimeBottomSheet.Error
              {...fallbackProps}
              onInquiry={() => sheet.close(INQUIRY_SHEET_EXIT)}
            />
          )}
        >
          <Suspense fallback={<TodoTimeBottomSheet.Loading />}>
            <TodoTimeBottomSheet.Content onClose={() => sheet.close()} />
          </Suspense>
        </QueryErrorBoundary>
      )}
    </BottomSheet>
  );
}

TodoTimeBottomSheet.Content = function Content({ onClose }: { onClose: () => void }) {
  const { todoId } = useTodoScreenParams();
  const [date] = useTodoSheetDateParam();
  const { data: todosByDate } = useSuspenseQuery(useGetTodosByDateQueryOptions({ date }));
  const todo = useRetainedValue(findSheetTodo(todosByDate.todos, todoId));
  const updateSchedule = useMutation(useUpdateTodoScheduleMutationOptions());

  useEffect(() => {
    if (todo == null) {
      onClose();
    }
  }, [todo, onClose]);

  if (todo == null) {
    return null;
  }

  const editValues = toTodoEditFormValues(todo);

  return (
    <TodoTimePickerContent
      date={editValues.startDate}
      value={{
        scheduledTime: editValues.scheduledTime ?? undefined,
        isAllDay: todo.isAllDay,
      }}
      onCancel={onClose}
      onChange={({ scheduledTime, isAllDay }) => {
        updateSchedule.mutate({
          todoId: todo.id,
          input: {
            startDate: formatDate(editValues.startDate),
            endDate: editValues.endDate ? formatDate(editValues.endDate) : null,
            scheduledTime: isAllDay ? null : (scheduledTime ?? null),
            isAllDay,
          },
        });
        onClose();
      }}
    />
  );
};

TodoTimeBottomSheet.Loading = function Loading() {
  return (
    <Box py={24} className="items-center">
      <Spinner />
    </Box>
  );
};

TodoTimeBottomSheet.Error = function ErrorFallback({
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
