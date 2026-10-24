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
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Spinner } from 'heroui-native';
import { type ComponentProps, Suspense, useEffect } from 'react';

import { useGetTodosByDateQueryOptions } from '../../queries/get-todos-by-date-query-options';
import { useChangeTodoCategoryMutationOptions } from '../../queries/use-change-todo-category-mutation-options';
import { TODO_SHEET_FALLBACK_HREF } from '../../utils/navigation/todo-sheet-href';
import { findSheetTodo } from '../../utils/view-models/todo-sheet-target.view-model';
import { CategorySelectInput } from '../category-select-bottom-sheet';

type TodoCategoryBottomSheetProps = Omit<
  ComponentProps<typeof BottomSheet>,
  'children' | 'isOpen' | 'onOpenChange'
>;

/** 할 일의 카테고리를 바꾸는 시트. 대상은 `/todo/[todoId]/category` route에서 읽는다. */
export function TodoCategoryBottomSheet(props: TodoCategoryBottomSheetProps) {
  const sheet = useSheetRoute(TODO_SHEET_FALLBACK_HREF);

  return (
    <BottomSheet {...props} isOpen={sheet.isOpen} onOpenChange={sheet.onOpenChange}>
      {sheet.isOpen && (
        <QueryErrorBoundary fallback={TodoCategoryBottomSheet.Error}>
          <Suspense fallback={<TodoCategoryBottomSheet.Loading />}>
            <TodoCategoryBottomSheet.Content onClose={() => sheet.close()} />
          </Suspense>
        </QueryErrorBoundary>
      )}
    </BottomSheet>
  );
}

TodoCategoryBottomSheet.Content = function Content({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('todo');
  const { todoId } = useTodoScreenParams();
  const [date] = useTodoSheetDateParam();
  const { data } = useSuspenseQuery(useGetTodosByDateQueryOptions({ date }));
  const todo = useRetainedValue(findSheetTodo(data.todos, todoId));
  const changeCategory = useMutation(useChangeTodoCategoryMutationOptions());

  useEffect(() => {
    if (todo == null) {
      onClose();
    }
  }, [todo, onClose]);

  if (todo == null) {
    return null;
  }

  return (
    <CategorySelectInput
      value={todo.category.id}
      submitLabel={t('actions.changeSubmit')}
      isPending={changeCategory.isPending}
      onChange={async (categoryId) => {
        const changed = await changeCategory
          .mutateAsync({ todoId: todo.id, input: { categoryId } })
          .catch(() => null);

        if (changed) {
          onClose();
        }
      }}
    />
  );
};

TodoCategoryBottomSheet.Loading = function Loading() {
  return (
    <Box py={24} className="items-center">
      <Spinner />
    </Box>
  );
};

TodoCategoryBottomSheet.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('common');
  return (
    <Result
      title={t('errorBoundary.title')}
      button={<Result.Button onPress={reset}>{t('errorBoundary.retry')}</Result.Button>}
    />
  );
};
