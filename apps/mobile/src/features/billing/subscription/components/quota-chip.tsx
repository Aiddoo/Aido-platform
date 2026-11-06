import { Text } from '@src/shared/ui';
import { Chip } from 'heroui-native';
import type { ComponentProps } from 'react';

import { useQuotaStatus } from '../hooks/use-quota-status';
import type { EntitlementFeature } from '../schemas/entitlement.schema';

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
