import { ThanksSummaryRow } from '@src/features/nudge/components/nudge-interactions/thanks-summary-row';
import { NudgeInteractionPolicy } from '@src/features/nudge/domains/nudge-interaction.model';
import { useTodoScreenParams } from '@src/features/todo/hooks/use-todo-screen-params';
import { useTodoSheetDateParam } from '@src/features/todo/hooks/use-todo-sheet-params';
import { toTodoEditFormValues } from '@src/features/todo/utils/to-todo-edit-form-values';
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
  QueryErrorActions,
  QueryErrorBoundary,
  type QueryErrorFallbackProps,
  Result,
  type SheetRouteExit,
  SunIcon,
  TrashIcon,
  useSheetRoute,
  VStack,
} from '@src/shared/ui';
import { formatDate, isDateToday } from '@src/shared/utils/date';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import { PressableFeedback, Skeleton } from 'heroui-native';
import { type ComponentProps, Suspense, useEffect } from 'react';

import { useGetTodosByDateQueryOptions } from '../../queries/get-todos-by-date-query-options';
import { useDeleteTodoMutationOptions } from '../../queries/use-delete-todo-mutation-options';
import { useUpdateTodoScheduleMutationOptions } from '../../queries/use-update-todo-schedule-mutation-options';
import { calculateTodaySchedule } from '../../utils/calculate-today-schedule';
import { calculateTomorrowSchedule } from '../../utils/calculate-tomorrow-schedule';
import {
  TODO_SHEET_FALLBACK_HREF,
  todoActionSheetHref,
  type TodoSheetAction,
  todoThanksSheetHref,
} from '../../utils/navigation/todo-sheet-href';
import { findSheetTodo } from '../../utils/view-models/todo-sheet-target.view-model';

type TodoActionsBottomSheetProps = Omit<
  ComponentProps<typeof BottomSheet>,
  'children' | 'isOpen' | 'onOpenChange'
>;

export function TodoActionsBottomSheet(props: TodoActionsBottomSheetProps) {
  const sheet = useSheetRoute(TODO_SHEET_FALLBACK_HREF);

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
  const { t } = useTranslation('todo');
  const today = useToday();
  const { todoId } = useTodoScreenParams();
  const [date] = useTodoSheetDateParam();
  const { data: todosByDate } = useSuspenseQuery(useGetTodosByDateQueryOptions({ date }));
  const todo = useRetainedValue(findSheetTodo(todosByDate.todos, todoId));
  const deleteMutation = useMutation(useDeleteTodoMutationOptions());
  const updateScheduleMutation = useMutation(useUpdateTodoScheduleMutationOptions());

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

  const openActionSheet = (action: TodoSheetAction) =>
    onClose({ type: 'replace', href: todoActionSheetHref(action, { todoId: todo.id, date }) });

  const handleScheduleToggle = () => {
    const { startDate, endDate } = isTodoToday
      ? calculateTomorrowSchedule(editValues.endDate, today)
      : calculateTodaySchedule(editValues.endDate, today);

    updateScheduleMutation.mutate(
      {
        todoId: todo.id,
        input: {
          startDate: formatDate(startDate),
          endDate: endDate ? formatDate(endDate) : null,
          scheduledTime: todo.isAllDay ? null : (editValues.scheduledTime ?? null),
          isAllDay: todo.isAllDay,
        },
      },
      { onSuccess: () => onClose() },
    );
  };

  const handleDelete = () => {
    deleteMutation.mutate(
      { todoId: todo.id, startDate: todo.startDate },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <VStack gap={8}>
      {NudgeInteractionPolicy.isThankableTodo(todo, { isOwner: true }) && (
        <QueryErrorBoundary resetKeys={[todo.id]} fallback={() => null}>
          <Suspense fallback={<ThanksSummaryRow.Loading />}>
            <ThanksSummaryRow
              todoId={todo.id}
              onThanksPress={() =>
                onClose({ type: 'replace', href: todoThanksSheetHref({ todoId: todo.id }) })
              }
            />
          </Suspense>
        </QueryErrorBoundary>
      )}
      <PressableFeedback
        onPress={() => openActionSheet('edit')}
        isDisabled={deleteMutation.isPending}
      >
        <ListRow
          horizontalPadding="medium"
          verticalPadding="medium"
          left={
            <Box className="size-7 items-center justify-center rounded-full bg-gray-2">
              <EditIcon width={16} height={16} colorClassName="text-gray-7" />
            </Box>
          }
          contents={
            <ListRow.Texts type="1RowTypeA" top={t('actions.edit')} topProps={{ size: 'b2' }} />
          }
          right={<ArrowRightIcon width={16} height={16} colorClassName="text-gray-7" />}
        />
      </PressableFeedback>

      <PressableFeedback
        onPress={() => openActionSheet('date')}
        isDisabled={deleteMutation.isPending}
      >
        <ListRow
          horizontalPadding="medium"
          verticalPadding="medium"
          left={
            <Box className="size-7 items-center justify-center rounded-full bg-gray-2">
              <CalendarIcon width={16} height={16} colorClassName="text-gray-7" />
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
        onPress={() => openActionSheet('time')}
        isDisabled={deleteMutation.isPending}
      >
        <ListRow
          horizontalPadding="medium"
          verticalPadding="medium"
          left={
            <Box className="size-7 items-center justify-center rounded-full bg-gray-2">
              <ClockIcon width={16} height={16} colorClassName="text-gray-7" />
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
        onPress={() => openActionSheet('category')}
        isDisabled={deleteMutation.isPending}
      >
        <ListRow
          horizontalPadding="medium"
          verticalPadding="medium"
          left={
            <Box className="size-7 items-center justify-center rounded-full bg-gray-2">
              <ListIcon width={16} height={16} colorClassName="text-gray-7" />
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
            <Box className="size-7 items-center justify-center rounded-full bg-gray-2">
              {isTodoToday ? (
                <MoveRightIcon width={16} height={16} colorClassName="text-gray-7" />
              ) : (
                <SunIcon width={16} height={16} colorClassName="text-gray-7" />
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
  );
};

TodoActionsBottomSheet.Loading = function Loading() {
  return (
    <VStack gap={8}>
      {times(6, (index) => (
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
