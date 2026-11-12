import { tv } from '@src/shared/utils/tv';
import { clamp } from 'es-toolkit';
import type { ViewProps } from 'react-native';
import type { VariantProps } from 'tailwind-variants';

import { Box } from '../box';

const meter = tv({
  slots: { track: 'overflow-hidden rounded-full', indicator: 'h-full rounded-full bg-main' },
  variants: {
    size: {
      small: { track: 'h-1' },
      medium: { track: 'h-2' },
    },
    tone: {
      surface: { track: 'bg-gray-2' },
      onSky: { track: 'bg-on-sky/20' },
    },
  },
  defaultVariants: { size: 'small', tone: 'surface' },
});

type MeterProps = VariantProps<typeof meter> &
  Pick<ViewProps, 'accessibilityElementsHidden' | 'importantForAccessibility'> & {
    value: number;
    max: number;
    className?: string;
  };

/** 넘친 값은 가득, 최댓값이 0이면 빈 막대다. 폭은 부모가 정한다 */
export function Meter({
  value,
  max,
  size,
  tone,
  className,
  accessibilityElementsHidden,
  importantForAccessibility,
}: MeterProps) {
  const ratio = max > 0 ? clamp(value / max, 0, 1) : 0;
  const styles = meter({ size, tone });

  return (
    <Box
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max, now: clamp(value, 0, max) }}
      className={styles.track({ className })}
      accessibilityElementsHidden={accessibilityElementsHidden}
      importantForAccessibility={importantForAccessibility}
    >
      <Box className={styles.indicator()} style={{ width: `${ratio * 100}%` }} />
    </Box>
  );
}
