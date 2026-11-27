import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/category/queries/todo-category.queries';
import { useTranslation } from '@src/shared/i18n';
import { TextSkeleton, WordWrapText } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useSuspenseQuery } from '@tanstack/react-query';
import type { ComponentProps } from 'react';
import { match } from 'ts-pattern';

import { TodoImportPlacementPolicy } from '../domains/todo-import-placement.model';
import { type TodoImportPlan, TodoImportPlanPolicy } from '../domains/todo-import-plan.model';
import { createDefaultTarget } from '../domains/todo-import-target.model';
import { useNewCategoryDefaults } from '../hooks/use-new-category-defaults';
import { useSuspenseTodoImportPlacements } from '../hooks/use-suspense-todo-import-placements';
import { findTargetAppearance } from '../utils/todo-import.view-model';

interface ImportPlacementSummaryProps extends Omit<
  ComponentProps<typeof WordWrapText>,
  'children'
> {
  plan: TodoImportPlan;
}

// 모두 몇 개를 어디에 넣는지. 자리가 모자라면 실제로 들어가는 수를 함께 센다(넣을 곳 카드와 같은 계산이다)
export function ImportPlacementSummary({ plan, ...props }: ImportPlacementSummaryProps) {
  const { t } = useTranslation('todoImport');
  const newCategoryDefaults = useNewCategoryDefaults();

  const { data: categoriesResult } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());
  const placements = useSuspenseTodoImportPlacements({ plan });

  const summary = TodoImportPlacementPolicy.getSummary(placements);
  const isPartial = summary.placedCount < summary.totalCount;
  const events = isPartial
    ? t('categories.eventCountPartial', { total: summary.totalCount, count: summary.placedCount })
    : t('categories.eventCount', { count: summary.totalCount });
  // 한 곳에 넣을 때 그곳의 이름을 부른다
  const appearance = findTargetAppearance(
    TodoImportPlanPolicy.getDestination(
      plan,
      createDefaultTarget(categoriesResult.categories, newCategoryDefaults),
    ),
    categoriesResult.categories,
  );
  const text = match({
    mode: TodoImportPlanPolicy.getCategoryMode(plan),
    totalCount: summary.totalCount,
  })
    .with({ totalCount: 0 }, () => null)
    .with({ mode: 'single' }, () =>
      appearance == null ? null : t('categories.summary', { events, name: appearance.name }),
    )
    .with({ mode: 'separate' }, () =>
      t('categories.summarySeparate', { events, count: summary.destinationCount }),
    )
    .exhaustive();

  if (text == null) {
    return null;
  }

  return (
    <WordWrapText size="b4" shade={6} align="center" className="tabular-nums" {...props}>
      {text}
    </WordWrapText>
  );
}

type LoadingProps = Pick<ComponentProps<typeof TextSkeleton>, 'className'>;

ImportPlacementSummary.Loading = function Loading({ className }: LoadingProps) {
  return <TextSkeleton size="b4" className={cn('w-48', className)} />;
};
