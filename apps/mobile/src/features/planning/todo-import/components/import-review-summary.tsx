import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/category/queries/todo-category.queries';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTodayKey } from '@src/shared/hooks/use-today-key';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  TextSkeleton,
  WordWrapText,
} from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import type { ComponentProps } from 'react';
import { match } from 'ts-pattern';

import { TodoImportPlacementPolicy } from '../domains/todo-import-placement.model';
import type { TodoImportPlan } from '../domains/todo-import-plan.model';
import type { TodoImportRange } from '../domains/todo-import-range.model';
import { useSuspenseTodoImportPlacements } from '../hooks/use-suspense-todo-import-placements';
import {
  findTargetAppearance,
  formatImportRange,
  formatUnbreakableLabel,
  getImportRangeLabels,
} from '../utils/todo-import.view-model';

interface ImportReviewSummaryProps extends Pick<
  ComponentProps<typeof Box>,
  'className' | 'testID'
> {
  plan: TodoImportPlan;
  range: TodoImportRange;
}

// 가져오기 직전에 일정 수·기간·넣을 곳을 한 줄로 다시 보인다. 카테고리 단계가 받아 둔 조회를 다시 받지 않아 그 단계가 보인 수와 같다
export function ImportReviewSummary({ plan, range, ...props }: ImportReviewSummaryProps) {
  const { t } = useTranslation('todoImport');
  const todayKey = useTodayKey();
  const dateFormatContext = useDateFormatContext();

  const { data: categoriesResult } = useSuspenseQuery({
    ...useGetTodoCategoriesQueryOptions(),
    refetchOnMount: false,
  });
  const placements = useSuspenseTodoImportPlacements({ plan, refetchOnMount: false });

  const summary = TodoImportPlacementPolicy.getSummary(placements);
  const events =
    summary.placedCount < summary.totalCount
      ? t('categories.eventCountPartial', { total: summary.totalCount, count: summary.placedCount })
      : t('categories.eventCount', { count: summary.totalCount });
  const singleTarget = TodoImportPlacementPolicy.findSingleTarget(placements);
  // 한 곳이면 이름을 부른다. 고른 카테고리가 그사이 지워져 이름을 모르면 곳 수로 센다
  const destination = match(
    singleTarget == null ? null : findTargetAppearance(singleTarget, categoriesResult.categories),
  )
    .with({ isNew: true }, ({ name }) => t('options.destinationNew', { name }))
    .with({ isNew: false }, ({ name }) => t('options.destinationOne', { name }))
    .with(null, () => t('options.destinationCount', { count: summary.destinationCount }))
    .exhaustive();
  const { start, end } = getImportRangeLabels(range, todayKey, dateFormatContext);

  // 일정 수와 기간은 중간에서 끊기지 않아 큰 글자에서는 " · " 자리에서 줄을 넘긴다. 읽기는 끊김 방지 문자 없는 문장이다
  return (
    <Box
      accessible
      accessibilityLabel={t('options.summary', {
        events,
        range: end == null ? start : t('options.rangeLabel', { start, end }),
        destination,
      })}
      {...props}
    >
      <WordWrapText size="b3" shade={6} className="tabular-nums">
        {t('options.summary', {
          events: formatUnbreakableLabel(events),
          range: formatUnbreakableLabel(formatImportRange(range, todayKey, dateFormatContext)),
          destination,
        })}
      </WordWrapText>
    </Box>
  );
}

/** 받은 뒤와 같은 b3 한 줄 */
ImportReviewSummary.Loading = function Loading() {
  return <TextSkeleton size="b3" className="w-64" />;
};

/** 카테고리 단계와 같은 조회라 같은 문구로 그 자리에서 다시 시도한다 */
ImportReviewSummary.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('todoImport');

  return <QueryErrorFallback.Inline message={t('categories.loadFailed')} reset={reset} />;
};
