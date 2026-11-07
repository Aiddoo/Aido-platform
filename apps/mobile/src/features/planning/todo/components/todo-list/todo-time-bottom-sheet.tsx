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
import { type ComponentProps, Suspense, useEffect } from 'react';

import { TodoRepeatPolicy } from '../../domains/todo-repeat.model';
import { TodoPolicy } from '../../domains/todo.model';
import { useSelectTodoScope } from '../../hooks/use-select-todo-scope';
import { useTodoId } from '../../hooks/use-todo-params';
import { useTodoSheetDateKey } from '../../hooks/use-todo-sheet-date-key';
import { useUpdateTodoScheduleMutationOptions } from '../../queries/todo.mutations';
import { useGetTodosByDateQueryOptions } from '../../queries/todo.queries';
import { toTodoScheduleValues } from '../../utils/todo-schedule-values';
import { TodoScopeStep } from '../todo-scope-step';
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
            <TodoTimeBottomSheet.TimeForm onClose={() => sheet.close()} />
          </Suspense>
        </QueryErrorBoundary>
      )}
    </BottomSheet>
  );
}

TodoTimeBottomSheet.TimeForm = function TimeForm({ onClose }: { onClose: () => void }) {
  const { timeZone } = useDateFormatContext();
  const [todoId] = useTodoId();
  const [date] = useTodoSheetDateKey();
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

  const editValues = toTodoScheduleValues(todo, timeZone);

  return (
    <TodoScopeStep step={scopeSelector}>
      <TodoTimePickerContent
        date={toDate(editValues.startDate)}
        value={{
          scheduledTime: editValues.scheduledTime,
          isAllDay: todo.isAllDay,
        }}
        onCancel={onClose}
        onChange={async ({ scheduledTime, isAllDay }) => {
          const isUnchanged = !TodoPolicy.hasScheduleChanged(
            { isAllDay, scheduledTime },
            { isAllDay: todo.isAllDay, scheduledTime: editValues.scheduledTime },
          );
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
              endDate: editValues.endDate == null ? null : toDateKey(editValues.endDate, timeZone),
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
