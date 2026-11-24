import { useTranslation } from '@src/shared/i18n';
import { match } from 'ts-pattern';

import type { ImportTargetAppearance } from '../utils/todo-import.view-model';

/** 넣을 곳 이름. 새로 만들 카테고리는 "새 · 이름", 삭제돼 사라진 카테고리는 "고르지 않음"이다 */
export function useFormatImportTargetName(): (appearance: ImportTargetAppearance | null) => string {
  const { t } = useTranslation('todoImport');

  return (appearance) =>
    match(appearance)
      .with(null, () => t('categories.unassigned'))
      .with({ isNew: true }, ({ name }) => t('categories.newTarget', { name }))
      .with({ isNew: false }, ({ name }) => name)
      .exhaustive();
}
