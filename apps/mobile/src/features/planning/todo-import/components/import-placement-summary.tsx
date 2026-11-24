import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/category/queries/todo-category.queries';
import { useTranslation } from '@src/shared/i18n';
import { TextSkeleton, WordWrapText } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import type { ComponentProps } from 'react';
import { match } from 'ts-pattern';

import type { ImportCollection } from '../domains/todo-import-collection.model';
import {
  type ImportTarget,
  summarizePlacements,
  type TodoImportCategoryMode,
} from '../domains/todo-import-target.model';
import { useImportPlacements } from '../hooks/use-import-placements';
import { findTargetAppearance } from '../utils/todo-import.view-model';

interface ImportPlacementSummaryProps extends Omit<
  ComponentProps<typeof WordWrapText>,
  'children'
> {
  collections: readonly ImportCollection[];
  /** 캘린더마다 넣을 곳 */
  targets: Readonly<Record<string, ImportTarget>>;
  /** 모두 넣을 곳. 한 곳에 넣을 때 이름을 부른다 */
  destination: ImportTarget;
  mode: TodoImportCategoryMode;
}

/** 모두 몇 개를 어디에 넣는지. 자리가 모자라면 실제로 들어가는 수를 함께 센다(넣을 곳 카드와 같은 계산이다) */
export function ImportPlacementSummary({
  collections,
  targets,
  destination,
  mode,
  ...props
}: ImportPlacementSummaryProps) {
  const { t } = useTranslation('todoImport');
  const { data: categoriesResult } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());
  const summary = summarizePlacements(useImportPlacements(collections, targets));

  const isPartial = summary.placedCount < summary.totalCount;
  const events = isPartial
    ? t('categories.eventCountPartial', { total: summary.totalCount, count: summary.placedCount })
    : t('categories.eventCount', { count: summary.totalCount });
  const appearance = findTargetAppearance(destination, categoriesResult.categories);
  const text = match({ mode, totalCount: summary.totalCount })
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

ImportPlacementSummary.Loading = function Loading() {
  return <TextSkeleton size="b4" className="w-48 self-center" />;
};

/** 넣을 곳 카드·캘린더 줄이 같은 조회의 오류와 다시 시도를 보여 요약 자리는 비운다 */
ImportPlacementSummary.Error = function ErrorFallback() {
  return null;
};
