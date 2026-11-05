import { Text } from '@src/shared/ui';
import { Chip } from 'heroui-native';
import type { ComponentProps } from 'react';

import type { EntitlementFeature } from '../domains/entitlement.model';
import { useQuotaStatus } from '../hooks/use-quota-status';

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
  const { type, label } = useQuotaStatus(feature);

  if (label == null) {
    return null;
  }

  return type === 'remaining' ? (
    <Chip size={size} variant={variant} color="accent" {...chipProps}>
      <Text size="e1" weight="semibold" tone="brand" maxLines={1} className="shrink tabular-nums">
        {label}
      </Text>
    </Chip>
  ) : (
    <Chip size={size} variant={variant} color="default" {...chipProps}>
      <Text size="e1" weight="semibold" shade={6} maxLines={1} className="shrink">
        {label}
      </Text>
    </Chip>
  );
}
