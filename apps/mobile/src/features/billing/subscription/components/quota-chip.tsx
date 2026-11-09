import { Text } from '@src/shared/ui';
import { Chip } from 'heroui-native';
import type { ComponentProps } from 'react';

import { type EntitlementFeature } from '../domains/entitlement.model';
import { useQuotaStatus } from '../hooks/use-quota-status';

interface QuotaChipProps extends Omit<ComponentProps<typeof Chip>, 'children'> {
  feature: EntitlementFeature;
}

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
      <Text
        size="e1"
        weight="semibold"
        numberOfLines={1}
        className="shrink text-accent-soft-foreground tabular-nums"
      >
        {label}
      </Text>
    </Chip>
  ) : (
    <Chip size={size} variant={variant} color="default" {...chipProps}>
      <Text size="e1" weight="semibold" shade={6} numberOfLines={1} className="shrink">
        {label}
      </Text>
    </Chip>
  );
}
