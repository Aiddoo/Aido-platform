import { useTranslation } from '@src/shared/i18n';
import { match } from 'ts-pattern';

import {
  calculateRemainingCapacity,
  type TodoImportTargetRejection,
} from '../domains/todo-import.error';

// 서버가 넣을 곳을 받지 않은 이유를 그 캘린더 줄에 보일 한 줄
export function useFormatTargetRejection(): (rejection: TodoImportTargetRejection) => string {
  const { t } = useTranslation('todoImport');

  return (rejection) =>
    match(rejection.reason)
      .with('CAPACITY', () =>
        t('categories.rejected.capacity', {
          expected: rejection.expected ?? 0,
          count: calculateRemainingCapacity(rejection),
        }),
      )
      .with('CATEGORY_NAME_TAKEN', () => t('categories.rejected.nameTaken'))
      .with('CATEGORY_NOT_FOUND', () => t('categories.rejected.notFound'))
      .exhaustive();
}
