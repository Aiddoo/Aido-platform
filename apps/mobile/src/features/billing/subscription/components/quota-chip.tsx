import { LabelChip, Text } from '@src/shared/ui';
import { Chip } from 'heroui-native';
import type { ComponentProps } from 'react';

import { type EntitlementFeature } from '../domains/entitlement.model';
import { useQuotaStatus } from '../hooks/use-quota-status';

interface QuotaChipProps extends Omit<
  ComponentProps<typeof Chip>,
  'children' | 'color' | 'variant'
> {
  feature: EntitlementFeature;
}

export function QuotaChip({ feature, size = 'sm', ...chipProps }: QuotaChipProps) {
  const { type, label } = useQuotaStatus(feature);

  if (label == null) {
    return null;
  }

  return type === 'remaining' ? (
    <LabelChip
      color="accent"
      label={label}
      size={size}
      labelProps={{ weight: 'semibold', numberOfLines: 1, className: 'shrink tabular-nums' }}
      {...chipProps}
    />
  ) : (
    <Chip size={size} variant="soft" color="default" {...chipProps}>
      <Text size="e1" weight="semibold" shade={6} numberOfLines={1} className="shrink">
        {label}
      </Text>
    </Chip>
  );
}
