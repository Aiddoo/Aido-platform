import { useTranslation } from '@src/shared/i18n';
import { match } from 'ts-pattern';

import {
  type TodoImportPlacement,
  TodoImportPlacementPolicy,
} from '../domains/todo-import-placement.model';

interface PlacementStatusText {
  message: string;
  // 자리가 모자라 일정을 건너뛴다
  isWarning: boolean;
}

// 넣을 곳에 더 넣을 수 있는 수, 또는 몇 개를 건너뛰는지 알리는 한 줄. name은 보이는 넣을 곳 이름이다
export function useFormatPlacementStatus(): (
  placement: TodoImportPlacement,
  name: string,
) => PlacementStatusText {
  const { t } = useTranslation('todoImport');

  return (placement, name) =>
    match(TodoImportPlacementPolicy.getStatus(placement))
      .with('fits', () => ({
        message: t('categories.roomLeft', { count: placement.remainingCount }),
        isWarning: false,
      }))
      .with('fillsUp', () => ({ message: t('categories.fillsUp'), isWarning: false }))
      .with('overflow', () => ({
        message: t('categories.overflow', {
          name,
          count: placement.roomLeft,
          skipped: placement.skippedCount,
        }),
        isWarning: true,
      }))
      .with('full', () => ({ message: t('categories.fullWarning', { name }), isWarning: true }))
      .exhaustive();
}
