import { TODO_IMPORT_LIMITS } from '@aido/api/vocabulary';
import { useTranslation } from '@src/shared/i18n';
import { InlineAlert, Text, VStack } from '@src/shared/ui';

import { TodoImportCollectionPolicy } from '../domains/todo-import-collection.model';
import type { TodoImportRange } from '../domains/todo-import-range.model';
import { useSelectedImportCollections } from '../hooks/use-selected-import-collections';

interface CalendarSelectionSummaryProps extends TodoImportRange {
  /** 고른 캘린더 키. null은 기본 선택이다 */
  value: readonly string[] | null;
}

// 고른 캘린더에서 가져올 일정 수. 한 번에 가져올 수 있는 수를 넘으면 다음 버튼이 왜 꺼졌는지 알린다
export function CalendarSelectionSummary({
  startDate,
  endDate,
  value,
}: CalendarSelectionSummaryProps) {
  const { t } = useTranslation('todoImport');
  const selected = useSelectedImportCollections({ startDate, endDate, selectedKeys: value });

  if (TodoImportCollectionPolicy.isOverImportLimit(selected)) {
    return (
      <InlineAlert
        status="danger"
        title={t('calendars.tooMany', { limit: TODO_IMPORT_LIMITS.MAX_ITEMS_PER_IMPORT })}
      />
    );
  }

  return (
    <VStack gap={2}>
      <Text size="b4" shade={6} align="center" className="tabular-nums">
        {t('calendars.selectedCount', {
          count: TodoImportCollectionPolicy.calculateItemCount(selected),
        })}
      </Text>
      {/* 더 고를 수 없어 막힌 캘린더 줄의 이유 */}
      {TodoImportCollectionPolicy.isAtCollectionLimit(selected) && (
        <Text size="b4" shade={6} align="center">
          {t('calendars.collectionLimit', { limit: TODO_IMPORT_LIMITS.MAX_COLLECTIONS })}
        </Text>
      )}
    </VStack>
  );
}
