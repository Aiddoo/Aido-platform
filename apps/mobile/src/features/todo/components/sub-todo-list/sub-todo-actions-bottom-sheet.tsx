import { useTodoScreenParams } from '@src/features/todo/hooks/use-todo-screen-params';
import {
  useSubTodoSheetParams,
  useTodoSheetDateParam,
} from '@src/features/todo/hooks/use-todo-sheet-params';
import { useRetainedValue } from '@src/shared/hooks/use-retained-value';
import { useTranslation } from '@src/shared/i18n';
import {
  ArrowRightIcon,
  BottomSheet,
  Box,
  EditIcon,
  ListRow,
  QueryErrorBoundary,
  type QueryErrorFallbackProps,
  Result,
  type SheetRouteExit,
  TrashIcon,
  useSheetRoute,
  VStack,
} from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import { PressableFeedback, Skeleton } from 'heroui-native';
import { type ComponentProps, Suspense, useEffect } from 'react';

import { useGetTodosByDateQueryOptions } from '../../queries/get-todos-by-date-query-options';
import { useDeleteSubTodoMutationOptions } from '../../queries/use-delete-sub-todo-mutation-options';
import { subTodoSheetHref, TODO_SHEET_FALLBACK_HREF } from '../../utils/navigation/todo-sheet-href';
import {
  findSheetSubTodo,
  findSheetTodo,
} from '../../utils/view-models/todo-sheet-target.view-model';

type SubTodoActionsBottomSheetProps = Omit<
  ComponentProps<typeof BottomSheet>,
  'children' | 'isOpen' | 'onOpenChange'
>;

/** 하위 항목 동작 시트. 대상은 `/todo/[todoId]/sub-todos/[subTodoId]/actions` route에서 읽는다. */
export function SubTodoActionsBottomSheet(props: SubTodoActionsBottomSheetProps) {
  const sheet = useSheetRoute(TODO_SHEET_FALLBACK_HREF);

  return (
    <BottomSheet {...props} isOpen={sheet.isOpen} onOpenChange={sheet.onOpenChange}>
      <QueryErrorBoundary fallback={SubTodoActionsBottomSheet.Error}>
        <Suspense fallback={<SubTodoActionsBottomSheet.Loading />}>
          <SubTodoActionsBottomSheet.Content onClose={sheet.close} />
        </Suspense>
      </QueryErrorBoundary>
    </BottomSheet>
  );
}

interface SubTodoActionsContentProps {
  onClose: (next?: SheetRouteExit) => void;
}

SubTodoActionsBottomSheet.Content = function Content({ onClose }: SubTodoActionsContentProps) {
  const { t } = useTranslation('todo');
  const { todoId } = useTodoScreenParams();
  const { subTodoId } = useSubTodoSheetParams();
  const [date] = useTodoSheetDateParam();
  const { data } = useSuspenseQuery(useGetTodosByDateQueryOptions({ date }));
  const todo = useRetainedValue(findSheetTodo(data.todos, todoId));
  const subTodo = useRetainedValue(findSheetSubTodo(todo, subTodoId));
  const deleteSubTodo = useMutation(useDeleteSubTodoMutationOptions());
  const isDeleting = deleteSubTodo.isPending;

  useEffect(() => {
    if (todo == null || subTodo == null) {
      onClose();
    }
  }, [todo, subTodo, onClose]);

  if (todo == null || subTodo == null) {
    return null;
  }

  const handleDelete = async () => {
    if (isDeleting) {
      return;
    }

    const removed = await deleteSubTodo
      .mutateAsync({ todoId: todo.id, subTodoId: subTodo.id, startDate: todo.startDate })
      .catch(() => null);

    if (removed != null) {
      onClose();
    }
  };

  return (
    <VStack gap={8}>
      <PressableFeedback
        onPress={() =>
          onClose({
            type: 'replace',
            href: subTodoSheetHref('edit', { todoId: todo.id, subTodoId: subTodo.id, date }),
          })
        }
        isDisabled={isDeleting}
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

      <PressableFeedback onPress={handleDelete} isDisabled={isDeleting}>
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
              top={isDeleting ? t('actions.deleting') : t('actions.delete')}
              topProps={{ size: 'b2', tone: 'danger' }}
            />
          }
        />
      </PressableFeedback>
    </VStack>
  );
};

SubTodoActionsBottomSheet.Loading = function Loading() {
  return (
    <VStack gap={8}>
      {times(2, (index) => (
        <Skeleton key={index} className="h-14 w-full rounded-xl" />
      ))}
    </VStack>
  );
};

SubTodoActionsBottomSheet.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('common');
  return (
    <Result
      title={t('errorBoundary.title')}
      button={<Result.Button onPress={reset}>{t('errorBoundary.retry')}</Result.Button>}
    />
  );
};
