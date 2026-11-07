import { CategorySelectInput } from '@src/features/planning/category/components/category-select-input';
import { useReportUnexpectedError } from '@src/shared/hooks/use-report-unexpected-error';
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
import { useTodoParams } from '../../hooks/use-todo-params';
import { useTodoSheetDateParam } from '../../hooks/use-todo-sheet-params';
import { useChangeTodoCategoryMutationOptions } from '../../queries/todo.mutations';
import { useGetTodosByDateQueryOptions } from '../../queries/todo.queries';
import { TodoScopeStep } from '../todo-scope-step';

type TodoCategoryBottomSheetProps = Omit<
  ComponentProps<typeof BottomSheet>,
  'children' | 'isOpen' | 'onOpenChange'
>;

export function TodoCategoryBottomSheet(props: TodoCategoryBottomSheetProps) {
  const sheet = useSheetRoute('/feed');

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
            <TodoCategoryBottomSheet.CategoryForm onClose={() => sheet.close()} />
          </Suspense>
        </QueryErrorBoundary>
      )}
    </BottomSheet>
  );
}

TodoCategoryBottomSheet.CategoryForm = function CategoryForm({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('todo');
  const { todoId } = useTodoParams();
  const date = useTodoSheetDateParam();
  const { data: todosByDate } = useSuspenseQuery(useGetTodosByDateQueryOptions({ date }));
  const todo = useRetainedValue(TodoPolicy.findTodo(todosByDate.todos, todoId));
  const changeCategory = useMutation(useChangeTodoCategoryMutationOptions());
  const reportUnexpectedError = useReportUnexpectedError('todo');
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
          try {
            await changeCategory.mutateAsync({
              todoId: todo.id,
              input: { categoryId },
              ...(scope != null && { scope }),
            });
            onClose();
          } catch (error) {
            reportUnexpectedError(error);
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
