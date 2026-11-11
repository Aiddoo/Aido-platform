import { CategorySelectInput } from '@src/features/planning/category/components/category-select-input';
import { useTranslation } from '@src/shared/i18n';
import { RouteBottomSheet } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import type { ComponentProps } from 'react';

import { TodoRepeatPolicy } from '../../domains/todo-repeat.model';
import type { TodoUpdateScope } from '../../domains/todo-repeat.model';
import { useSelectTodoScope } from '../../hooks/use-select-todo-scope';
import { useSheetTodo } from '../../hooks/use-sheet-todo';
import { useChangeTodoCategoryMutationOptions } from '../../queries/todo.mutations';
import { TodoScopeStep } from '../todo-scope-step';

type TodoCategoryBottomSheetProps = Omit<
  ComponentProps<typeof RouteBottomSheet>,
  'fallbackHref' | 'loading' | 'children'
>;

export function TodoCategoryBottomSheet(props: TodoCategoryBottomSheetProps) {
  return (
    <RouteBottomSheet {...props} fallbackHref="/feed" loading={<TodoCategoryBottomSheet.Loading />}>
      {(sheet) => <TodoCategoryBottomSheet.CategoryForm onClose={() => sheet.close()} />}
    </RouteBottomSheet>
  );
}

TodoCategoryBottomSheet.CategoryForm = function CategoryForm({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('todo');
  const todo = useSheetTodo({ onMissing: onClose });
  const changeCategory = useMutation(useChangeTodoCategoryMutationOptions());
  const scopeSelector = useSelectTodoScope();
  const { selectEditScope } = scopeSelector;

  if (todo == null) {
    return null;
  }

  const changeTodoCategory = async (input: { categoryId: number }, scope?: TodoUpdateScope) => {
    try {
      await changeCategory.mutateAsync({
        todoId: todo.id,
        input,
        ...(scope != null && { scope }),
      });
      onClose();
    } catch {
      // 실패 안내와 보고는 mutation의 meta.errorFeedback이 맡는다
    }
  };

  return (
    <TodoScopeStep step={scopeSelector}>
      <CategorySelectInput
        defaultValue={todo.category.id}
        submitLabel={t('actions.changeSubmit')}
        isLoading={changeCategory.isPending}
        onSubmit={async (categoryId) => {
          if (categoryId === todo.category.id) {
            onClose();

            return;
          }
          if (!TodoRepeatPolicy.hasRepeatRule(todo)) {
            await changeTodoCategory({ categoryId });

            return;
          }
          const scope = await selectEditScope(todo.startDate);
          // oxlint-disable-next-line aido/no-strict-nullish -- null은 범위 선택에서 시트를 닫거나 뒤로 간 취소다
          if (scope === null) {
            return;
          }
          await changeTodoCategory({ categoryId }, scope);
        }}
      />
    </TodoScopeStep>
  );
};

TodoCategoryBottomSheet.Loading = CategorySelectInput.Loading;
