import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { HStack, RepeatIcon, Text } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import type { ComponentProps, ReactNode } from 'react';

const REPEAT_HINT_ICON_SIZE = 14;

interface RepeatHintLineProps extends Omit<ComponentProps<typeof HStack>, 'children'> {
  /** 지금 고른 규칙처럼 강조할 줄 */
  isHighlighted?: boolean;
  children: string;
  /** 문구 뒤에 붙는 것(ⓘ) */
  right?: ReactNode;
}

/** 반복에 대한 짧은 안내 한 줄. 반복 아이콘과 같은 크기·색의 글자를 어디서나 똑같이 쓴다 */
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
