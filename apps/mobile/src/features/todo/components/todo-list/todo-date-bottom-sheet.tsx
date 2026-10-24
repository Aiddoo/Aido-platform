import { useTodoScreenParams } from '@src/features/todo/hooks/use-todo-screen-params';
import { useTodoSheetDateParam } from '@src/features/todo/hooks/use-todo-sheet-params';
import { useRetainedValue } from '@src/shared/hooks/use-retained-value';
import { useTranslation } from '@src/shared/i18n';
import {
  BottomSheet,
  Box,
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
import { TodoDatePickerContent } from '../todo-date-picker-content';

type TodoDateBottomSheetProps = Omit<
  ComponentProps<typeof BottomSheet>,
  'children' | 'isOpen' | 'onOpenChange'
>;

/** 할 일의 날짜를 바꾸는 시트. 대상은 `/todo/[todoId]/date` route에서 읽는다. */
export function TodoDateBottomSheet(props: TodoDateBottomSheetProps) {
  const sheet = useSheetRoute(TODO_SHEET_FALLBACK_HREF);

  return (
    <BottomSheet {...props} isOpen={sheet.isOpen} onOpenChange={sheet.onOpenChange}>
      {sheet.isOpen && (
        <QueryErrorBoundary fallback={TodoDateBottomSheet.Error}>
          <Suspense fallback={<TodoDateBottomSheet.Loading />}>
            <TodoDateBottomSheet.Content onClose={() => sheet.close()} />
          </Suspense>
        </QueryErrorBoundary>
      )}
    </BottomSheet>
  );
}

TodoDateBottomSheet.Content = function Content({ onClose }: { onClose: () => void }) {
  const { todoId } = useTodoScreenParams();
  const [date] = useTodoSheetDateParam();
  const { data } = useSuspenseQuery(useGetTodosByDateQueryOptions({ date }));
  const todo = useRetainedValue(findSheetTodo(data.todos, todoId));
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
    <TodoDatePickerContent
      value={editValues.startDate}
      onCancel={onClose}
      onChange={(startDate) => {
        updateSchedule.mutate({
          todoId: todo.id,
          input: {
            startDate: formatDate(startDate),
            endDate: null,
            scheduledTime: todo.isAllDay ? null : (editValues.scheduledTime ?? null),
            isAllDay: todo.isAllDay,
          },
        });
        onClose();
      }}
    />
  );
};

TodoDateBottomSheet.Loading = function Loading() {
  return (
    <Box py={24} className="items-center">
      <Spinner />
    </Box>
  );
};

TodoDateBottomSheet.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('common');
  return (
    <Result
      title={t('errorBoundary.title')}
      button={<Result.Button onPress={reset}>{t('errorBoundary.retry')}</Result.Button>}
    />
  );
};
