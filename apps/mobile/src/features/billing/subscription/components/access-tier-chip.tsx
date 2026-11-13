import { useTranslation } from '@src/shared/i18n';
import { LabelChip } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';

import { type AccessTier } from '../domains/entitlement.model';
import { useGetEntitlementsQueryOptions } from '../queries/entitlement.queries';

const ACCESS_TIER_CHIP_CONFIG = {
  ADMIN: {
    labelKey: 'tier.admin',
    color: 'warning',
    className: 'self-center shrink-0',
  },
  PREMIUM: {
    labelKey: 'tier.premium',
    color: 'accent',
    className: 'self-center shrink-0',
  },
  FREE: {
    labelKey: 'tier.basic',
    color: 'default',
    className: 'self-center shrink-0 bg-gray-3',
  },
} as const satisfies Record<AccessTier, unknown>;

export function AccessTierChip() {
  const { t } = useTranslation('subscription');
  const { data: entitlements } = useSuspenseQuery(useGetEntitlementsQueryOptions());
  const { labelKey, color, className } = ACCESS_TIER_CHIP_CONFIG[entitlements.tier];

  // 프로필 줄 안에 놓이는 표시용이라 Pressable인 Chip이 줄 탭을 가로채지 않게 한다
  return <LabelChip color={color} label={t(labelKey)} className={className} pointerEvents="none" />;
}
