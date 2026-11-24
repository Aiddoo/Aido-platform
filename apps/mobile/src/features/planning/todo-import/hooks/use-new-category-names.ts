import { useTranslation } from '@src/shared/i18n';

import type { NewCategoryNames } from '../apis/todo-import-target.mapper';

/** 새 카테고리 기본 이름에 쓰는 앱 언어 문구. 이메일 모양 캘린더 이름 대신 계정 종류 이름을 쓴다 */
export function useNewCategoryNames(): NewCategoryNames {
  const { t } = useTranslation('todoImport');

  return {
    fallbackName: t('categories.fallbackName'),
    accountNames: {
      icloud: t('categories.accountNames.icloud'),
      google: t('categories.accountNames.google'),
      outlook: t('categories.accountNames.outlook'),
      device: null,
      subscribed: null,
      birthdays: null,
      other: null,
    },
  };
}
