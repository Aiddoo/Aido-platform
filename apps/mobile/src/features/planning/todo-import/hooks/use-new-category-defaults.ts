import { CATEGORY_COLORS } from '@src/features/planning/category/constants/todo-category.constants';
import { useTranslation } from '@src/shared/i18n';

import type { NewCategoryDefaults } from '../domains/todo-import-target.model';
import { getCalendarSourceLabelKey } from '../utils/todo-import.view-model';

// 새 카테고리의 처음 이름(앱 언어 문구)과 색 팔레트. 넣을 곳을 계산하는 곳이 모두 같은 값을 쓴다
export function useNewCategoryDefaults(): NewCategoryDefaults {
  const { t } = useTranslation('todoImport');

  return {
    naming: {
      fallbackName: t('categories.newCategoryName'),
      // 이메일 모양 캘린더 이름 대신 서비스 이름("Google")을 쓴다
      accountNames: {
        icloud: t(getCalendarSourceLabelKey('icloud')),
        google: t(getCalendarSourceLabelKey('google')),
        outlook: t(getCalendarSourceLabelKey('outlook')),
        device: null,
        subscribed: null,
        birthdays: null,
        other: null,
      },
    },
    palette: CATEGORY_COLORS,
  };
}
