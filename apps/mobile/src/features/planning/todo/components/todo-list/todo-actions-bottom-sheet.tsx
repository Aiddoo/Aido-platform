import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import {
  RouteBottomSheet,
  CalendarIcon,
  ClockIcon,
  EditIcon,
  ListFilledIcon,
  MoveRightIcon,
  RepeatIcon,
  type SheetRouteExit,
  SunIcon,
  TrashIcon,
  useConfirmDialog,
  VStack,
} from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { Skeleton } from 'heroui-native';
import type { ComponentProps, ComponentType } from 'react';

import { type Todo, TodoPolicy } from '../../domains/todo.model';
import { useSelectTodoScope } from '../../hooks/use-select-todo-scope';
import { useSheetTodo } from '../../hooks/use-sheet-todo';
import { useTodoSheetDateKey } from '../../hooks/use-todo-sheet-date-key';
import { useStopTodoSeriesMutationOptions } from '../../queries/todo-series.mutations';
import {
  useDeleteTodoMutationOptions,
  useUpdateTodoScheduleMutationOptions,
} from '../../queries/todo.mutations';
import { formatTodoPeriod } from '../../utils/todo-period.view-model';
import { TodoActionRow } from '../todo-action-row';
import { TodoScopeStep } from '../todo-scope-step';

type TodoActionsBottomSheetProps = Omit<
  ComponentProps<typeof RouteBottomSheet>,
  'fallbackHref' | 'loading' | 'children'
> & {
  /** 목록 맨 위에 붙는 요약 줄(받은 감사 등). 다시 마운트되지 않도록 모듈 수준 컴포넌트를 넘긴다 */
  summary: ComponentType<TodoActionsSummaryProps>;
};

interface TodoActionsSummaryProps {
  todo: Todo;
  onClose: (next?: SheetRouteExit) => void;
}

export function TodoActionsBottomSheet({ summary, ...props }: TodoActionsBottomSheetProps) {
  return (
    <RouteBottomSheet {...props} fallbackHref="/feed" loading={<TodoActionsBottomSheet.Loading />}>
      {(sheet) => <TodoActionsBottomSheet.ActionList summary={summary} onClose={sheet.close} />}
    </RouteBottomSheet>
  );
}

interface TodoActionListProps {
  summary: ComponentType<TodoActionsSummaryProps>;
  onClose: (next?: SheetRouteExit) => void;
}

TodoActionsBottomSheet.ActionList = function ActionList({
  summary: Summary,
  onClose,
}: TodoActionListProps) {
  const { t } = useTranslation(['todo', 'common']);
  const todayKey = useTodayKey();
  const [date] = useTodoSheetDateKey();
  const todo = useSheetTodo({ onMissing: onClose });
  const deleteMutation = useMutation(useDeleteTodoMutationOptions());
  const updateScheduleMutation = useMutation(useUpdateTodoScheduleMutationOptions());
  const stopSeriesMutation = useMutation(useStopTodoSeriesMutationOptions());
  const scopeSelector = useSelectTodoScope();
  const { selectDeleteScope } = scopeSelector;
  const confirmDialog = useConfirmDialog();
  const dateFormatContext = useDateFormatContext();

  if (todo == null) {
    return null;
  }

  // 저장 중에는 같은 요청이 두 번 가거나 저장 중에 지우거나 고치러 들어가지 않게 모든 행을 잠근다
  const isBusy =
    deleteMutation.isPending || updateScheduleMutation.isPending || stopSeriesMutation.isPending;
  const isTodoToday = todo.startDate === todayKey;

  const sheetParams = { todoId: todo.id, date };

  const handleScheduleToggle = () => {
    const { startDate, endDate } = TodoPolicy.getTodayToggleDates(todo, todayKey);

    updateScheduleMutation.mutate(
      {
        todoId: todo.id,
        changedField: 'date',
        input: {
          startDate,
          endDate,
          scheduledTime: TodoPolicy.getLocalTime(todo, dateFormatContext.timeZone),
          isAllDay: todo.isAllDay,
        },
      },
      { onSuccess: () => onClose() },
    );
  };

  const confirmDeleteMultiDayTodo = () =>
    confirmDialog.openAsync({
      title: t('multiDayDelete.title'),
      description: t('multiDayDelete.description', {
        period: formatTodoPeriod(todo, todayKey, dateFormatContext),
      }),
      cancelLabel: t('common:actions.cancel'),
      confirmLabel: t('multiDayDelete.confirm'),
      confirmColor: 'danger',
    });

  const handleDelete = async () => {
    if (!TodoPolicy.isRecurringTodo(todo)) {
      if (TodoPolicy.isMultiDayTodo(todo) && !(await confirmDeleteMultiDayTodo())) {
        return;
      }
      deleteMutation.mutate({ todoId: todo.id, date }, { onSuccess: () => onClose() });

      return;
    }

    const scope = await selectDeleteScope(todo.startDate, TodoPolicy.getDeleteScopes(todo));
    if (scope == null) {
      return;
    }
    deleteMutation.mutate({ todoId: todo.id, date, scope }, { onSuccess: () => onClose() });
  };

  const handleStopRepeat = () =>
    stopSeriesMutation.mutate({ todoId: todo.id }, { onSuccess: () => onClose() });

  return (
    <TodoScopeStep step={scopeSelector}>
      <VStack gap={8}>
        <Summary todo={todo} onClose={onClose} />
        <TodoActionRow
          icon={<EditIcon width={16} height={16} colorClassName="text-main" />}
          label={t('actions.edit')}
          hasArrow
          isDisabled={isBusy}
          onPress={() =>
            onClose({
              type: 'replace',
              href: { pathname: '/todo/[todoId]/edit', params: sheetParams },
            })
          }
        />

        <TodoActionRow
          icon={<CalendarIcon width={16} height={16} colorClassName="text-main" />}
          label={t('actions.changeDate')}
          hasArrow
          isDisabled={isBusy}
          onPress={() =>
            onClose({
              type: 'replace',
              href: { pathname: '/todo/[todoId]/date', params: sheetParams },
            })
          }
        />

        <TodoActionRow
          icon={<ClockIcon width={16} height={16} colorClassName="text-main" />}
          label={t('actions.changeTime')}
          hasArrow
          isDisabled={isBusy}
          onPress={() =>
            onClose({
              type: 'replace',
              href: { pathname: '/todo/[todoId]/time', params: sheetParams },
            })
          }
        />

        <TodoActionRow
          icon={<ListFilledIcon width={16} height={16} colorClassName="text-main" />}
          label={t('actions.changeCategory')}
          hasArrow
          isDisabled={isBusy}
          onPress={() =>
            onClose({
              type: 'replace',
              href: { pathname: '/todo/[todoId]/category', params: sheetParams },
            })
          }
        />

        <TodoActionRow
          icon={
            isTodoToday ? (
              <MoveRightIcon width={16} height={16} colorClassName="text-main" />
            ) : (
              <SunIcon width={16} height={16} colorClassName="text-main" />
            )
          }
          label={isTodoToday ? t('actions.doTomorrow') : t('actions.doToday')}
          isDisabled={isBusy}
          onPress={handleScheduleToggle}
        />

        {TodoPolicy.hasRepeatRule(todo) && (
          <TodoActionRow
            icon={<RepeatIcon width={16} height={16} colorClassName="text-main" />}
            label={t('actions.stopRepeat')}
            isDisabled={isBusy}
            onPress={handleStopRepeat}
          />
        )}

        <TodoActionRow
          icon={<TrashIcon width={16} height={16} colorClassName="text-error" />}
          label={deleteMutation.isPending ? t('actions.deleting') : t('actions.delete')}
          isDanger
          isDisabled={isBusy}
          onPress={handleDelete}
          testID="todo-action-delete"
        />
      </VStack>
    </TodoScopeStep>
  );
};

TodoActionsBottomSheet.Loading = function Loading() {
  return (
    <VStack gap={8}>
      {range(6).map((index) => (
        <Skeleton key={index} className="h-14 w-full rounded-xl" />
      ))}
    </VStack>
  );
};
