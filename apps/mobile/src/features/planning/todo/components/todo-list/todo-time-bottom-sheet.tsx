import { TodoPolicy } from '@src/features/planning/todo/domains/todo.model';
import { useTodoScreenParams } from '@src/features/planning/todo/hooks/use-todo-screen-params';
import { useTodoSheetDateParam } from '@src/features/planning/todo/hooks/use-todo-sheet-params';
import { toDateKey } from '@src/shared/date/instant';
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
import { type ComponentProps, Suspense, useEffect } from 'react';

import { TodoRepeatPolicy } from '../../domains/todo-repeat.model';
import { TodoScopeStep, useSelectTodoScope } from '../../hooks/use-select-todo-scope';
import { useUpdateTodoScheduleMutationOptions } from '../../queries/todo.mutations';
import { useGetTodosByDateQueryOptions } from '../../queries/todo.queries';
import { toTodoEditFormValues } from '../../utils/to-todo-edit-form-values';
import { TodoTimePickerContent } from '../todo-time-picker-content';

type TodoTimeBottomSheetProps = Omit<
  ComponentProps<typeof BottomSheet>,
  'children' | 'isOpen' | 'onOpenChange'
>;

export function TodoTimeBottomSheet(props: TodoTimeBottomSheetProps) {
  const sheet = useSheetRoute('/feed');

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
  const { timeZone } = useDateFormatContext();
  const { todoId } = useTodoScreenParams();
  const date = useTodoSheetDateParam();
  const { data: todosByDate } = useSuspenseQuery(useGetTodosByDateQueryOptions({ date }));
  const todo = useRetainedValue(TodoPolicy.findTodo(todosByDate.todos, todoId));
  const updateSchedule = useMutation(useUpdateTodoScheduleMutationOptions());
  const scopeSelector = useSelectTodoScope();
  const { selectEditScope } = scopeSelector;

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
    <TodoScopeStep step={scopeSelector}>
      <TodoTimePickerContent
        date={editValues.startDate}
        value={{
          scheduledTime: editValues.scheduledTime,
          isAllDay: todo.isAllDay,
        }}
        onCancel={onClose}
        onChange={async ({ scheduledTime, isAllDay }) => {
          const isUnchanged =
            isAllDay === todo.isAllDay && (isAllDay || scheduledTime === editValues.scheduledTime);
          if (isUnchanged) {
            onClose();
            return;
          }
          const scope = TodoRepeatPolicy.hasRepeatRule(todo)
            ? await selectEditScope(todo.startDate)
            : undefined;
          // nullish-strict: 생략은 범위를 묻지 않은 단일 할 일, null은 시트를 닫은 취소다
          if (scope === null) {
            return;
          }
          updateSchedule.mutate({
            todoId: todo.id,
            changedField: 'time',
            ...(scope != null && { scope }),
            input: {
              startDate: toDateKey(editValues.startDate, timeZone),
              endDate: editValues.endDate ? toDateKey(editValues.endDate, timeZone) : null,
              scheduledTime: isAllDay ? null : scheduledTime,
              isAllDay,
            },
          });
          onClose();
        }}
      />
    </TodoScopeStep>
  );
};

TodoTimeBottomSheet.Loading = TodoTimePickerContent.Loading;

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
