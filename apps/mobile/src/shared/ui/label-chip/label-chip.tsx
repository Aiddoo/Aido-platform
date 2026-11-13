import { cn } from '@src/shared/utils/cn';
import { Chip } from 'heroui-native';
import type { ComponentProps } from 'react';

import { Text } from '../text/text';
import type { TextProps } from '../text/text.types';

type ChipProps = ComponentProps<typeof Chip>;
type ChipColor = NonNullable<ChipProps['color']>;
type ChipSize = NonNullable<ChipProps['size']>;

const LABEL_COLOR_CLASS_NAMES = {
  accent: 'text-accent-soft-foreground',
  default: 'text-default-soft-foreground',
  success: 'text-success-soft-foreground',
  warning: 'text-warning-soft-foreground',
  danger: 'text-danger-soft-foreground',
} as const satisfies Record<ChipColor, string>;

const LABEL_SIZES = {
  sm: 'e1',
  md: 'b3',
  lg: 'b3',
} as const satisfies Record<ChipSize, NonNullable<TextProps['size']>>;

type LabelChipProps = Omit<ChipProps, 'children' | 'color' | 'variant'> & {
  color: ChipColor;
  label: string;
  labelProps?: Omit<TextProps, 'children' | 'size'>;
};

export function LabelChip({ color, label, size = 'sm', labelProps, ...chipProps }: LabelChipProps) {
  return (
    <Chip size={size} variant="soft" color={color} {...chipProps}>
      <Text
        size={LABEL_SIZES[size]}
        weight="medium"
        {...labelProps}
        className={cn(LABEL_COLOR_CLASS_NAMES[color], labelProps?.className)}
      >
        {label}
      </Text>
    </Chip>
  );
}
