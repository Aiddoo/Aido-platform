import { useTranslation } from '@src/shared/i18n';
import { useLanguage } from '@src/shared/providers/language-provider';
import { Text } from '@src/shared/ui';
import { toDateFormatLocale } from '@src/shared/utils/date-format';
import { formatCount } from '@src/shared/utils/format';
import { useQuery } from '@tanstack/react-query';
import { Chip } from 'heroui-native';
import type { ComponentProps } from 'react';
import { match } from 'ts-pattern';

import { type EntitlementFeature, EntitlementPolicy } from '../domains/entitlement.model';
import { useGetEntitlementsQueryOptions } from '../queries/get-entitlements-query-options';

interface QuotaChipProps extends Omit<ComponentProps<typeof Chip>, 'children'> {
  feature: EntitlementFeature;
}

/** 남은 횟수 알약. 스냅샷을 스스로 구독하고 무제한·공정 사용 한도·아직 모를 때는 그리지 않는다 */
export function QuotaChip({
  feature,
  size = 'sm',
  variant = 'soft',
  ...chipProps
}: QuotaChipProps) {
  const { t } = useTranslation('subscription');
  const locale = toDateFormatLocale(useLanguage().resolvedLanguage);
  const { data: snapshot } = useQuery(useGetEntitlementsQueryOptions());

  if (snapshot == null) {
    return null;
  }

  return match(EntitlementPolicy.getQuotaStatus(snapshot, feature))
    .with({ type: 'hidden' }, () => null)
    .with({ type: 'remaining' }, ({ count }) => (
      <Chip size={size} variant={variant} color="accent" {...chipProps}>
        <Text size="e1" weight="semibold" tone="brand" maxLines={1} className="shrink tabular-nums">
          {t('quota.remaining', { amount: formatCount(count, locale) })}
        </Text>
      </Chip>
    ))
    .with({ type: 'used-up' }, ({ period }) => (
      <Chip size={size} variant={variant} color="default" {...chipProps}>
        <Text size="e1" weight="semibold" shade={6} maxLines={1} className="shrink">
          {match(period)
            .with('month', () => t('quota.usedUpMonth'))
            .with('day', () => t('quota.usedUpDay'))
            .exhaustive()}
        </Text>
      </Chip>
    ))
    .exhaustive();
}
