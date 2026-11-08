import { tv } from '@src/shared/utils/tv';
import { clamp } from 'es-toolkit';
import type { ComponentProps } from 'react';
import type { VariantProps } from 'tailwind-variants';

import { Box } from '../box';

const meter = tv({
  slots: { track: 'overflow-hidden rounded-full', indicator: 'h-full rounded-full' },
  variants: {
    size: {
      small: { track: 'h-1' },
      medium: { track: 'h-2' },
    },
    color: {
      primary: { indicator: 'bg-main' },
      neutral: { indicator: 'bg-gray-5' },
    },
    tone: {
      surface: { track: 'bg-gray-2' },
      onSky: { track: 'bg-on-sky/20' },
    },
  },
  defaultVariants: { size: 'small', color: 'primary', tone: 'surface' },
});

type MeterProps = Omit<ComponentProps<typeof Box>, 'children'> &
  VariantProps<typeof meter> & {
    value: number;
    max: number;
  };

/** 넘친 값은 가득, 최댓값이 0이면 빈 막대다. 폭은 부모가 정한다 */
export function Meter({ value, max, size, color, tone, className, ...props }: MeterProps) {
  const ratio = max > 0 ? clamp(value / max, 0, 1) : 0;
  const styles = meter({ size, color, tone });

  return (
    <Box
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max, now: clamp(value, 0, max) }}
      className={styles.track({ className })}
      {...props}
    >
      <Box className={styles.indicator()} style={{ width: `${ratio * 100}%` }} />
    </Box>
  );
}
