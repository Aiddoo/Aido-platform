import { useTodoScreenParams } from '@src/features/planning/todo/hooks/use-todo-screen-params';
import { useTodoSheetDateParam } from '@src/features/planning/todo/hooks/use-todo-sheet-params';
import { isDateToday } from '@src/features/planning/todo/utils/calendar-date';
import { toTodoEditFormValues } from '@src/features/planning/todo/utils/to-todo-edit-form-values';
import { ThanksSummaryRow } from '@src/features/social/nudge/components/nudge-interactions/thanks-summary-row';
import { NudgeInteractionPolicy } from '@src/features/social/nudge/domains/nudge-interaction.model';
import { formatDateKeyCompactRange } from '@src/shared/date/date-format';
import { toDateKey } from '@src/shared/date/instant';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useRetainedValue } from '@src/shared/hooks/use-retained-value';
import { useToday } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import {
  ArrowRightIcon,
  BottomSheet,
  Box,
  CalendarIcon,
  ClockIcon,
  EditIcon,
  INQUIRY_SHEET_EXIT,
  ListIcon,
  ListRow,
  MoveRightIcon,
  RepeatIcon,
  QueryErrorActions,
  QueryErrorBoundary,
  type QueryErrorFallbackProps,
  Result,
  type SheetRouteExit,
  SunIcon,
  TrashIcon,
  useConfirmDialog,
  useSheetRoute,
  VStack,
} from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { PressableFeedback, Skeleton } from 'heroui-native';
import { type ComponentProps, Suspense, useEffect } from 'react';

import { TodoRepeatPolicy } from '../../domains/todo-repeat.model';
import { TodoPolicy } from '../../domains/todo.model';
import { TodoScopeStep, useSelectTodoScope } from '../../hooks/use-select-todo-scope';
import { useStopTodoSeriesMutationOptions } from '../../queries/todo-series.mutations';
import { useDeleteTodoMutationOptions } from '../../queries/todo.mutations';
import { useUpdateTodoScheduleMutationOptions } from '../../queries/todo.mutations';
import { useGetTodosByDateQueryOptions } from '../../queries/todo.queries';
import { calculateTodaySchedule } from '../../utils/calculate-today-schedule';
import { calculateTomorrowSchedule } from '../../utils/calculate-tomorrow-schedule';

type TodoActionsBottomSheetProps = Omit<
  ComponentProps<typeof BottomSheet>,
  'children' | 'isOpen' | 'onOpenChange'
>;

export function TodoActionsBottomSheet(props: TodoActionsBottomSheetProps) {
  const sheet = useSheetRoute('/feed');

  return (
    <BottomSheet {...props} isOpen={sheet.isOpen} onOpenChange={sheet.onOpenChange}>
      <QueryErrorBoundary
        fallback={(fallbackProps) => (
          <TodoActionsBottomSheet.Error
            {...fallbackProps}
            onInquiry={() => sheet.close(INQUIRY_SHEET_EXIT)}
          />
        )}
      >
        <Suspense fallback={<TodoActionsBottomSheet.Loading />}>
          <TodoActionsBottomSheet.Content onClose={sheet.close} />
        </Suspense>
      </QueryErrorBoundary>
    </BottomSheet>
  );
}

interface TodoActionsContentProps {
  onClose: (next?: SheetRouteExit) => void;
}

TodoActionsBottomSheet.Content = function Content({ onClose }: TodoActionsContentProps) {
  const { t } = useTranslation(['todo', 'common']);
  const today = useToday();
  const { todoId } = useTodoScreenParams();
  const date = useTodoSheetDateParam();
  const { data: todosByDate } = useSuspenseQuery(useGetTodosByDateQueryOptions({ date }));
  const todo = useRetainedValue(TodoPolicy.findTodo(todosByDate.todos, todoId));
  const deleteMutation = useMutation(useDeleteTodoMutationOptions());
  const updateScheduleMutation = useMutation(useUpdateTodoScheduleMutationOptions());
  const stopSeriesMutation = useMutation(useStopTodoSeriesMutationOptions());
  const scopeSelector = useSelectTodoScope();
  const { selectDeleteScope } = scopeSelector;
  const confirmDialog = useConfirmDialog();
  const dateFormatContext = useDateFormatContext();

  useEffect(() => {
    if (todo == null) {
      onClose();
    }
  }, [todo, onClose]);

  if (todo == null) {
    return null;
  }

  const editValues = toTodoEditFormValues(todo);
  const isTodoToday = isDateToday(editValues.startDate, today);

  const sheetParams = { todoId: todo.id, date };

  const handleScheduleToggle = () => {
    const { startDate, endDate } = isTodoToday
      ? calculateTomorrowSchedule(editValues.endDate, today)
      : calculateTodaySchedule(editValues.endDate, today);

    updateScheduleMutation.mutate(
      {
        todoId: todo.id,
        changedField: 'date',
        input: {
          startDate: toDateKey(startDate, dateFormatContext.timeZone),
          endDate: endDate == null ? null : toDateKey(endDate, dateFormatContext.timeZone),
          scheduledTime: todo.isAllDay ? null : editValues.scheduledTime,
          isAllDay: todo.isAllDay,
        },
      },
      { onSuccess: () => onClose() },
    );
  };

  const confirmDeleteMultiDayTodo = () =>
    confirmDialog.open({
      title: t('multiDayDelete.title'),
      description: t('multiDayDelete.description', {
        period: formatDateKeyCompactRange(
          todo.startDate,
          todo.endDate ?? todo.startDate,
          dateFormatContext,
        ),
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

    const scope = await selectDeleteScope(todo.startDate, TodoRepeatPolicy.getDeleteScopes(todo));
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
        {NudgeInteractionPolicy.isThankableTodo(todo, { isOwner: true }) && (
          <QueryErrorBoundary
            resetKeys={[todo.id]}
            fallback={(props) => (
              <ThanksSummaryRow.Error {...props} onInquiry={() => onClose(INQUIRY_SHEET_EXIT)} />
            )}
          >
            <Suspense fallback={null}>
              <ThanksSummaryRow
                todoId={todo.id}
                onThanksPress={() =>
                  onClose({
                    type: 'replace',
                    href: { pathname: '/todo/[todoId]/thanks', params: { todoId: todo.id } },
                  })
                }
              />
            </Suspense>
          </QueryErrorBoundary>
        )}
        <PressableFeedback
          onPress={() =>
            onClose({
              type: 'replace',
              href: { pathname: '/todo/[todoId]/edit', params: sheetParams },
            })
          }
          isDisabled={deleteMutation.isPending}
        >
          <ListRow
            horizontalPadding="medium"
            verticalPadding="medium"
            left={
              <Box className="size-7 items-center justify-center rounded-full bg-main/10">
                <EditIcon width={16} height={16} colorClassName="text-main" />
              </Box>
            }
            contents={
              <ListRow.Texts type="1RowTypeA" top={t('actions.edit')} topProps={{ size: 'b2' }} />
            }
            right={<ArrowRightIcon width={16} height={16} colorClassName="text-gray-7" />}
          />
        </PressableFeedback>

        <PressableFeedback
          onPress={() =>
            onClose({
              type: 'replace',
              href: { pathname: '/todo/[todoId]/date', params: sheetParams },
            })
          }
          isDisabled={deleteMutation.isPending}
        >
          <ListRow
            horizontalPadding="medium"
            verticalPadding="medium"
            left={
              <Box className="size-7 items-center justify-center rounded-full bg-main/10">
                <CalendarIcon width={16} height={16} colorClassName="text-main" />
              </Box>
            }
            contents={
              <ListRow.Texts
                type="1RowTypeA"
                top={t('actions.changeDate')}
                topProps={{ size: 'b2' }}
              />
            }
            right={<ArrowRightIcon width={16} height={16} colorClassName="text-gray-7" />}
          />
        </PressableFeedback>

        <PressableFeedback
          onPress={() =>
            onClose({
              type: 'replace',
              href: { pathname: '/todo/[todoId]/time', params: sheetParams },
            })
          }
          isDisabled={deleteMutation.isPending}
        >
          <ListRow
            horizontalPadding="medium"
            verticalPadding="medium"
            left={
              <Box className="size-7 items-center justify-center rounded-full bg-main/10">
                <ClockIcon width={16} height={16} colorClassName="text-main" />
              </Box>
            }
            contents={
              <ListRow.Texts
                type="1RowTypeA"
                top={t('actions.changeTime')}
                topProps={{ size: 'b2' }}
              />
            }
            right={<ArrowRightIcon width={16} height={16} colorClassName="text-gray-7" />}
          />
        </PressableFeedback>

        <PressableFeedback
          onPress={() =>
            onClose({
              type: 'replace',
              href: { pathname: '/todo/[todoId]/category', params: sheetParams },
            })
          }
          isDisabled={deleteMutation.isPending}
        >
          <ListRow
            horizontalPadding="medium"
            verticalPadding="medium"
            left={
              <Box className="size-7 items-center justify-center rounded-full bg-main/10">
                <ListIcon width={16} height={16} colorClassName="text-main" />
              </Box>
            }
            contents={
              <ListRow.Texts
                type="1RowTypeA"
                top={t('actions.changeCategory')}
                topProps={{ size: 'b2' }}
              />
            }
            right={<ArrowRightIcon width={16} height={16} colorClassName="text-gray-7" />}
          />
        </PressableFeedback>

        <PressableFeedback onPress={handleScheduleToggle} isDisabled={deleteMutation.isPending}>
          <ListRow
            horizontalPadding="medium"
            verticalPadding="medium"
            left={
              <Box className="size-7 items-center justify-center rounded-full bg-main/10">
                {isTodoToday ? (
                  <MoveRightIcon width={16} height={16} colorClassName="text-main" />
                ) : (
                  <SunIcon width={16} height={16} colorClassName="text-main" />
                )}
              </Box>
            }
            contents={
              <ListRow.Texts
                type="1RowTypeA"
                top={isTodoToday ? t('actions.doTomorrow') : t('actions.doToday')}
                topProps={{ size: 'b2' }}
              />
            }
          />
        </PressableFeedback>

        {TodoRepeatPolicy.hasRepeatRule(todo) && (
          <PressableFeedback
            onPress={handleStopRepeat}
            isDisabled={deleteMutation.isPending || stopSeriesMutation.isPending}
          >
            <ListRow
              horizontalPadding="medium"
              verticalPadding="medium"
              left={
                <Box className="size-7 items-center justify-center rounded-full bg-main/10">
                  <RepeatIcon width={16} height={16} colorClassName="text-main" />
                </Box>
              }
              contents={
                <ListRow.Texts
                  type="1RowTypeA"
                  top={t('actions.stopRepeat')}
                  topProps={{ size: 'b2' }}
                />
              }
            />
          </PressableFeedback>
        )}

        <PressableFeedback onPress={handleDelete} isDisabled={deleteMutation.isPending}>
          <ListRow
            horizontalPadding="medium"
            verticalPadding="medium"
            left={
              <Box className="size-7 items-center justify-center rounded-full bg-error/10 dark:bg-error/20">
                <TrashIcon width={16} height={16} colorClassName="text-error" />
              </Box>
            }
            contents={
              <ListRow.Texts
                type="1RowTypeA"
                top={deleteMutation.isPending ? t('actions.deleting') : t('actions.delete')}
                topProps={{ size: 'b2', tone: 'danger' }}
              />
            }
          />
        </PressableFeedback>
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

TodoActionsBottomSheet.Error = function ErrorFallback({
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
