import { EntitlementPolicy } from '@src/features/billing/subscription/domains/entitlement.model';
import { useGetEntitlementsQueryOptions } from '@src/features/billing/subscription/queries/entitlement.queries';
import { formatYearAwareDateKeyLabel } from '@src/shared/date/format/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { WordWrapText } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import { PressableFeedback } from 'heroui-native';
import type { ComponentProps } from 'react';

import { findLastAllowedDate } from '../domains/todo-import.model';
import { toUnbreakableLabel } from '../utils/todo-import.view-model';

interface ImportFreePlanNoticeProps extends Omit<
  ComponentProps<typeof WordWrapText>,
  'children' | 'size' | 'shade'
> {
  /** 주면 프리미엄 안내로 가는 글자에 밑줄을 긋고 문장 전체를 누를 수 있다 */
  onPremiumPress?: () => void;
}

/** 무료 플랜이 가져올 수 있는 기간. 요금제를 모르거나 기간 제한이 없으면 그리지 않는다 */
export function ImportFreePlanNotice({ onPremiumPress, ...props }: ImportFreePlanNoticeProps) {
  const { t } = useTranslation('todoImport');
  const todayKey = useTodayKey();
  const dateFormatContext = useDateFormatContext();
  const { data: snapshot } = useQuery(useGetEntitlementsQueryOptions());

  const horizonDays =
    snapshot == null ? null : EntitlementPolicy.findLimit(snapshot, 'CALENDAR_IMPORT');
  const lastAllowedDate = findLastAllowedDate(todayKey, horizonDays);

  if (
    snapshot == null ||
    !EntitlementPolicy.shouldOfferPremium(snapshot) ||
    horizonDays == null ||
    lastAllowedDate == null
  ) {
    return null;
  }

  const notice = (
    <WordWrapText size="b4" shade={6} {...props}>
      {[
        {
          text: `${t('range.freeUntil', {
            count: horizonDays,
            date: toUnbreakableLabel(
              formatYearAwareDateKeyLabel(lastAllowedDate, todayKey, dateFormatContext),
            ),
          })} `,
        },
        { text: t('range.freeUntilPremium'), isUnderlined: onPremiumPress != null },
      ]}
    </WordWrapText>
  );

  if (onPremiumPress == null) {
    return notice;
  }

  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityHint={t('range.freeUntilHint')}
      onPress={onPremiumPress}
      className="self-start"
    >
      {notice}
    </PressableFeedback>
  );
}
