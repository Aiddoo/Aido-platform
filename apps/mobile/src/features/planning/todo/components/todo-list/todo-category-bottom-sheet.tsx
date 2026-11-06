import { useTodoScreenParams } from '@src/features/planning/todo/hooks/use-todo-screen-params';
import { useTodoSheetDateParam } from '@src/features/planning/todo/hooks/use-todo-sheet-params';
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
import { useGetTodosByDateQueryOptions } from '../../queries/get-todos-by-date-query-options';
import { useChangeTodoCategoryMutationOptions } from '../../queries/use-change-todo-category-mutation-options';
import { TODO_SHEET_FALLBACK_HREF } from '../../utils/navigation/todo-sheet-href';
import { findSheetTodo } from '../../utils/view-models/todo-sheet-target.view-model';
import { CategorySelectInput } from '../category-select-input';

type TodoCategoryBottomSheetProps = Omit<
  ComponentProps<typeof BottomSheet>,
  'children' | 'isOpen' | 'onOpenChange'
>;

export function TodoCategoryBottomSheet(props: TodoCategoryBottomSheetProps) {
  const sheet = useSheetRoute(TODO_SHEET_FALLBACK_HREF);

  return (
    <BottomSheet {...props} isOpen={sheet.isOpen} onOpenChange={sheet.onOpenChange}>
      {sheet.isOpen && (
        <QueryErrorBoundary
          fallback={(fallbackProps) => (
            <TodoCategoryBottomSheet.Error
              {...fallbackProps}
              onInquiry={() => sheet.close(INQUIRY_SHEET_EXIT)}
            />
          )}
        >
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
  const { data: todosByDate } = useSuspenseQuery(useGetTodosByDateQueryOptions({ date }));
  const todo = useRetainedValue(findSheetTodo(todosByDate.todos, todoId));
  const changeCategory = useMutation(useChangeTodoCategoryMutationOptions());
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

  return (
    <TodoScopeStep step={scopeSelector}>
      <CategorySelectInput
        value={todo.category.id}
        submitLabel={t('actions.changeSubmit')}
        isLoading={changeCategory.isPending}
        onChange={async (categoryId) => {
          if (categoryId === todo.category.id) {
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
          const changed = await changeCategory
            .mutateAsync({
              todoId: todo.id,
              input: { categoryId },
              ...(scope != null && { scope }),
            })
            .catch(() => null);

          if (changed) {
            onClose();
          }
        }}
      />
    </TodoScopeStep>
  );
};

TodoCategoryBottomSheet.Loading = CategorySelectInput.Loading;

TodoCategoryBottomSheet.Error = function ErrorFallback({
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
