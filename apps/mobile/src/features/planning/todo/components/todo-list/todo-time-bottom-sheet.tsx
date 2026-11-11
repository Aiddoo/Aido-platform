import { instantToDate } from '@src/shared/date/native-date';
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
import { type ComponentProps, Suspense, useEffect } from 'react';

import { TodoRepeatPolicy } from '../../domains/todo-repeat.model';
import type { TodoUpdateScope } from '../../domains/todo-repeat.model';
import { hasScheduleChanged, TodoPolicy } from '../../domains/todo.model';
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
> & {
  /** 종일이 아닌 시각을 저장한 뒤 불린다. 알림 권한은 위층 기능이라 route가 넘긴다 */
  onTimeScheduled?: () => void;
};

export function TodoTimeBottomSheet({ onTimeScheduled, ...props }: TodoTimeBottomSheetProps) {
  const sheet = useSheetRoute('/feed');

  return (
    <BottomSheet {...props} isOpen={sheet.isOpen} onOpenChange={sheet.onOpenChange}>
      <QueryErrorBoundary
        fallback={(fallbackProps) => (
          <TodoTimeBottomSheet.Error
            {...fallbackProps}
            onInquiry={() => sheet.close(INQUIRY_SHEET_EXIT)}
          />
        )}
      >
        <Suspense fallback={<TodoTimeBottomSheet.Loading />}>
          <TodoTimeBottomSheet.TimeForm
            onClose={() => sheet.close()}
            onTimeScheduled={onTimeScheduled}
          />
        </Suspense>
      </QueryErrorBoundary>
    </BottomSheet>
  );
}

TodoTimeBottomSheet.TimeForm = function TimeForm({
  onClose,
  onTimeScheduled,
}: {
  onClose: () => void;
  onTimeScheduled?: () => void;
}) {
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
        date={instantToDate(editValues.startDate)}
        value={{
          scheduledTime: editValues.scheduledTime,
          isAllDay: todo.isAllDay,
        }}
        onCancel={onClose}
        isConfirmDisabled={updateSchedule.isPending}
        onChange={async ({ scheduledTime, isAllDay }) => {
          const isUnchanged = !hasScheduleChanged(
            { isAllDay, scheduledTime },
            { isAllDay: todo.isAllDay, scheduledTime: editValues.scheduledTime },
          );
          if (isUnchanged) {
            onClose();

            return;
          }
          const saveTime = (scope?: TodoUpdateScope) =>
            updateSchedule.mutate(
              {
                todoId: todo.id,
                changedField: 'time',
                ...(scope != null && { scope }),
                input: {
                  startDate: toDateKey(editValues.startDate, timeZone),
                  endDate:
                    editValues.endDate == null ? null : toDateKey(editValues.endDate, timeZone),
                  scheduledTime: isAllDay ? null : scheduledTime,
                  isAllDay,
                },
              },
              // 실패하면 시트를 남겨 고른 시간으로 다시 저장할 수 있게 한다
              {
                onSuccess: () => {
                  onClose();
                  if (!isAllDay) {
                    onTimeScheduled?.();
                  }
                },
              },
            );
          if (!TodoRepeatPolicy.hasRepeatRule(todo)) {
            saveTime();

            return;
          }
          const scope = await selectEditScope(todo.startDate);
          // oxlint-disable-next-line aido/no-strict-nullish -- null은 범위 선택에서 시트를 닫거나 뒤로 간 취소다
          if (scope === null) {
            return;
          }
          saveTime(scope);
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
  return <QueryErrorFallback reset={reset} onInquiry={onInquiry} />;
};
