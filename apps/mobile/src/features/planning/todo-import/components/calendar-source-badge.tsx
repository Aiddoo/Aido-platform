import { useTranslation } from '@src/shared/i18n';
import { LabelChip } from '@src/shared/ui';
import type { ComponentProps } from 'react';

import type { TodoImportAccountProvider } from '../domains/todo-import-collection.model';
import { getCalendarSourceLabelKey } from '../utils/todo-import.view-model';

interface CalendarSourceBadgeProps extends Omit<
  ComponentProps<typeof LabelChip>,
  'label' | 'color'
> {
  provider: TodoImportAccountProvider;
}

/** Apple·Google·Microsoft는 서면 허락 없이 로고·브랜드 색을 쓰지 못하게 해 서비스 이름 글자로만 보인다 */
export function CalendarSourceBadge({ provider, labelProps, ...props }: CalendarSourceBadgeProps) {
  const { t } = useTranslation('todoImport');

  return (
    <LabelChip
      color="default"
      label={t(getCalendarSourceLabelKey(provider))}
      labelProps={{ numberOfLines: 1, ...labelProps }}
      pointerEvents="none"
      {...props}
    />
  );
}
