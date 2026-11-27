import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/category/queries/todo-category.queries';
import { KeyboardAdaptiveButton } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import type { ComponentProps } from 'react';

import { type TodoImportPlan, TodoImportPlanPolicy } from '../domains/todo-import-plan.model';
import { createDefaultTarget, type TodoImportTarget } from '../domains/todo-import-target.model';
import { useNewCategoryDefaults } from '../hooks/use-new-category-defaults';

interface ConfirmImportPlanButtonProps extends Omit<
  ComponentProps<typeof KeyboardAdaptiveButton>,
  'isDisabled'
> {
  plan: TodoImportPlan;
  // 화면에 보인 모두 넣을 곳을 함께 준다. 아직 고르지 않았으면 기본 넣을 곳이다
  onConfirm: (destination: TodoImportTarget) => void;
}

// 넣을 곳을 확정하고 다음으로 넘기는 버튼. 넣을 곳을 아직 모르거나 고른 카테고리가 사라졌으면 넘기지 않는다
export function ConfirmImportPlanButton({
  plan,
  onConfirm,
  onPress,
  ...props
}: ConfirmImportPlanButtonProps) {
  const newCategoryDefaults = useNewCategoryDefaults();

  // 넣을 곳 칸과 같은 조회를 기다리지 않고 읽어, 받는 동안과 실패했을 때는 꺼 둔다(오류와 다시 시도는 그 칸의 경계가 보인다)
  const { data: categoriesResult } = useQuery(useGetTodoCategoriesQueryOptions());

  if (categoriesResult == null) {
    return <KeyboardAdaptiveButton {...props} isDisabled />;
  }

  const defaultTarget = createDefaultTarget(categoriesResult.categories, newCategoryDefaults);

  return (
    <KeyboardAdaptiveButton
      {...props}
      // 고른 카테고리를 그사이 삭제했으면 다시 고를 때까지 넘기지 않는다
      isDisabled={TodoImportPlanPolicy.hasMissingCategory(
        plan,
        defaultTarget,
        categoriesResult.categories,
      )}
      onPress={(event) => {
        onConfirm(TodoImportPlanPolicy.getDestination(plan, defaultTarget));
        // asChild 트리거·코치마크가 자식에 넣은 onPress를 이어 불러 그 누름이 사라지지 않게 한다
        onPress?.(event);
      }}
    />
  );
}
