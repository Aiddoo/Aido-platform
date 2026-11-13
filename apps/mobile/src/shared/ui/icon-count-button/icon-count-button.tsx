import { useLanguage } from '@src/shared/providers/language-provider';
import { cn } from '@src/shared/utils/cn';
import { formatCappedCount, formatCompactCount } from '@src/shared/utils/number-format';
import { PressableFeedback } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';
import { match } from 'ts-pattern';

import { Text } from '../text/text';

export const ICON_COUNT_BUTTON_ICON_SIZE = 18;

const HORIZONTAL_PADDING = 8;

const GLYPH_INSET = 2;

export const ICON_COUNT_BUTTON_INK_INSET = HORIZONTAL_PADDING + GLYPH_INSET;

const HIT_SLOP = { top: 8, bottom: 8, left: 0, right: 0 };

/** capped는 "99+"까지 보이고 0이면 자리도 비운다. compact는 "1.2K"로 줄이고 4글자 자리를 남겨 수가 바뀌어도 옆 버튼이 움직이지 않는다 */
type IconCountDisplay = 'capped' | 'compact';

interface IconCountButtonProps extends Omit<ComponentProps<typeof PressableFeedback>, 'children'> {
  icon: ReactNode;
  count: number;
  countDisplay?: IconCountDisplay;
}

export function IconCountButton({
  icon,
  count,
  countDisplay = 'capped',
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
      {match(countDisplay)
        .with('capped', () => count > 0 && <CappedCount count={count} />)
        .with('compact', () => <CompactCount count={count} />)
        .exhaustive()}
    </PressableFeedback>
  );
}

function CappedCount({ count }: { count: number }) {
  return (
    <Text size="e1" shade={6}>
      {formatCappedCount(count)}
    </Text>
  );
}

function CompactCount({ count }: { count: number }) {
  const { resolvedLanguage } = useLanguage();

  return (
    <Text size="e1" shade={7} className="min-w-[4ch] text-left tabular-nums">
      {count > 0 ? formatCompactCount(count, resolvedLanguage) : ''}
    </Text>
  );
}
