import { cn } from '@src/shared/utils/cn';
import { formatCappedCount } from '@src/shared/utils/format';
import { PressableFeedback } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';

import { Text } from '../Text';

export const ICON_COUNT_BUTTON_ICON_SIZE = 18;

const HORIZONTAL_PADDING = 8;

const GLYPH_INSET = 2;

export const ICON_COUNT_BUTTON_INK_INSET = HORIZONTAL_PADDING + GLYPH_INSET;

const HIT_SLOP = { top: 8, bottom: 8, left: 0, right: 0 };

interface IconCountButtonProps extends Omit<ComponentProps<typeof PressableFeedback>, 'children'> {
  icon: ReactNode;
  count: number;
}

export function IconCountButton({
  icon,
  count,
  className,
  hitSlop = HIT_SLOP,
  ...props
}: IconCountButtonProps) {
  return (
    <PressableFeedback
      {...props}
      hitSlop={hitSlop}
      className={cn(
        'min-h-11 min-w-11 flex-row items-center justify-center gap-1 px-2 py-1.5',
        className,
      )}
    >
      {icon}
      {count > 0 && (
        <Text size="e1" shade={6}>
          {formatCappedCount(count)}
        </Text>
      )}
    </PressableFeedback>
  );
}
