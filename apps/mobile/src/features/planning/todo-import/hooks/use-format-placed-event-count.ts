import { useTranslation } from '@src/shared/i18n';

import type { TodoImportPlacementSummary } from '../domains/todo-import-placement.model';

// 가져올 일정 수. 자리가 모자라면 실제로 들어가는 수를 함께 센다. 카테고리 단계와 옵션 단계가 같은 글을 보인다
export function useFormatPlacedEventCount(): (summary: TodoImportPlacementSummary) => string {
  const { t } = useTranslation('todoImport');

  return (summary) =>
    summary.placedCount < summary.totalCount
      ? t('categories.eventCountPartial', { total: summary.totalCount, count: summary.placedCount })
      : t('categories.eventCount', { count: summary.totalCount });
}
