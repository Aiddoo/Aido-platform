import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { HStack, RepeatIcon, Text } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import type { ReactNode } from 'react';

const REPEAT_HINT_ICON_SIZE = 14;

interface RepeatHintLineProps {
  isHighlighted?: boolean;
  children: string;
  right?: ReactNode;
  className?: string;
}

export function RepeatHintLine({
  isHighlighted = false,
  children,
  right,
  className,
}: RepeatHintLineProps) {
  const fontScaledSize = useFontScaledSize();
  const iconSize = fontScaledSize(REPEAT_HINT_ICON_SIZE);

  return (
    <HStack gap={4} align="center" className={cn('shrink', className)}>
      <RepeatIcon
        width={iconSize}
        height={iconSize}
        colorClassName={cn(isHighlighted && 'text-main', !isHighlighted && 'text-gray-6')}
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
