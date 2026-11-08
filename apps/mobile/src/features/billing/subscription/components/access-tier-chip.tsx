import { useTranslation } from '@src/shared/i18n';
import { Text } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Chip } from 'heroui-native';

import { type AccessTier } from '../domains/entitlement.model';
import { useGetEntitlementsQueryOptions } from '../queries/entitlement.queries';

const ACCESS_TIER_CHIP_CONFIG = {
  ADMIN: {
    labelKey: 'tier.admin',
    color: 'warning',
    className: 'self-center shrink-0',
    textClassName: 'text-warning-soft-foreground',
  },
  PREMIUM: {
    labelKey: 'tier.premium',
    color: 'accent',
    className: 'self-center shrink-0',
    textClassName: 'text-accent-soft-foreground',
  },
  FREE: {
    labelKey: 'tier.basic',
    color: 'default',
    className: 'self-center shrink-0 bg-gray-3',
    textClassName: 'text-default-soft-foreground',
  },
} as const satisfies Record<AccessTier, unknown>;

export function AccessTierChip() {
  const { t } = useTranslation('subscription');
  const { data: entitlements } = useSuspenseQuery(useGetEntitlementsQueryOptions());
  const { labelKey, color, className, textClassName } = ACCESS_TIER_CHIP_CONFIG[entitlements.tier];

  return (
    <Chip size="sm" variant="soft" color={color} className={className}>
      <Text size="e1" weight="medium" className={textClassName}>
        {t(labelKey)}
      </Text>
    </Chip>
  );
}
