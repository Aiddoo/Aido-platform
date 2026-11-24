import { useTranslation } from '@src/shared/i18n';

import type { NewCategoryNames } from '../apis/todo-import-target.mapper';
import { CALENDAR_SOURCE_LABEL_KEYS } from '../utils/todo-import.view-model';

/** 새 카테고리 기본 이름에 쓰는 앱 언어 문구. 이메일 모양 캘린더 이름 대신 서비스 이름("Google")을 쓴다 */
export function useNewCategoryNames(): NewCategoryNames {
  const { t } = useTranslation('todoImport');

  return {
    fallbackName: t('categories.newCategoryName'),
    accountNames: {
      icloud: t(CALENDAR_SOURCE_LABEL_KEYS.icloud),
      google: t(CALENDAR_SOURCE_LABEL_KEYS.google),
      outlook: t(CALENDAR_SOURCE_LABEL_KEYS.outlook),
      device: null,
      subscribed: null,
      birthdays: null,
      other: null,
    },
  };
}
