import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { RouteBottomSheet } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import type { ComponentProps } from 'react';

import { TodoRepeatPolicy } from '../../domains/todo-repeat.model';
import type { TodoUpdateScope } from '../../domains/todo-repeat.model';
import { getScheduledTime, hasScheduleChanged, TodoPolicy } from '../../domains/todo.model';
import { useSelectTodoScope } from '../../hooks/use-select-todo-scope';
import { useSheetTodo } from '../../hooks/use-sheet-todo';
import { useUpdateTodoScheduleMutationOptions } from '../../queries/todo.mutations';
import { TodoScopeStep } from '../todo-scope-step';
import { TodoTimePicker } from '../todo-time-picker';

type TodoTimeBottomSheetProps = Omit<
  ComponentProps<typeof RouteBottomSheet>,
  'fallbackHref' | 'loading' | 'children'
> & {
  /** 종일이 아닌 시각을 저장한 뒤 불린다. 알림 권한은 위층 기능이라 route가 넘긴다 */
  onTimeScheduled?: () => void;
};

export function TodoTimeBottomSheet({ onTimeScheduled, ...props }: TodoTimeBottomSheetProps) {
  return (
    <RouteBottomSheet {...props} fallbackHref="/feed" loading={<TodoTimeBottomSheet.Loading />}>
      {(sheet) => (
        <TodoTimeBottomSheet.TimeForm
          onClose={() => sheet.close()}
          onTimeScheduled={onTimeScheduled}
        />
      )}
    </RouteBottomSheet>
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
  const todo = useSheetTodo({ onMissing: onClose });
  const updateSchedule = useMutation(useUpdateTodoScheduleMutationOptions());
  const scopeSelector = useSelectTodoScope();
  const { selectEditScope } = scopeSelector;

  if (todo == null) {
    return null;
  }

  const localTime = TodoPolicy.getLocalTime(todo, timeZone);

  return (
    <TodoScopeStep step={scopeSelector}>
      <TodoTimePicker
        value={{ scheduledTime: localTime, isAllDay: todo.isAllDay }}
        onCancel={onClose}
        isConfirmDisabled={updateSchedule.isPending}
        onChange={async ({ scheduledTime, isAllDay }) => {
          const isUnchanged = !hasScheduleChanged(
            { isAllDay, scheduledTime },
            { isAllDay: todo.isAllDay, scheduledTime: localTime },
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
                  startDate: todo.startDate,
                  endDate: todo.endDate,
                  scheduledTime: getScheduledTime({ isAllDay, scheduledTime }),
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

TodoTimeBottomSheet.Loading = TodoTimePicker.Loading;
