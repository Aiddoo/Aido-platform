import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { HStack, RepeatIcon, Text } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import type { ComponentProps, ReactNode } from 'react';

const REPEAT_HINT_ICON_SIZE = 14;

interface RepeatHintLineProps extends Omit<ComponentProps<typeof HStack>, 'children'> {
  isHighlighted?: boolean;
  children: string;
  right?: ReactNode;
}

export function RepeatHintLine({
  isHighlighted = false,
  children,
  right,
  className,
  ...stackProps
}: RepeatHintLineProps) {
  const fontScaledSize = useFontScaledSize();
  const iconSize = fontScaledSize(REPEAT_HINT_ICON_SIZE);

  return (
    <HStack gap={4} align="center" className={cn('shrink', className)} {...stackProps}>
      <RepeatIcon
        width={iconSize}
        height={iconSize}
        // oxlint-disable-next-line aido/no-classname-concat -- 1.15.2 전환 #1400
        colorClassName={isHighlighted ? 'text-main' : 'text-gray-6'}
      />
      <Text
        size="b4"
        tone={isHighlighted ? 'brand' : 'neutral'}
        shade={isHighlighted ? undefined : 6}
        lineBreakStrategyIOS="hangul-word"
        className="shrink"
      >
        {children}
      </Text>
      {right}
    </HStack>
  );
}
