import { useFontScale } from '@src/shared/providers/font-scale-provider';
import { cn } from '@src/shared/utils/cn';
import { range } from 'es-toolkit';
import { Skeleton } from 'heroui-native';
import { useResolveClassNames } from 'uniwind';

import { Box } from '../box/box';
import type { TextSize } from '../text/text.types';
import { TEXT_SIZE_CLASSES } from '../text/text.variants';

export interface RedactedTextProps {
  /** 가린 글자의 크기. 줄 높이와 막대 두께가 같은 크기의 글자와 같다 */
  size?: TextSize;
  /** 여러 줄이면 마지막 줄을 짧게 그린다 */
  lineCount?: number;
  /** 스크린 리더가 가린 글자 대신 읽는 말 */
  accessibilityLabel: string;
  className?: string;
  testID?: string;
}

export function RedactedText({
  size = 'b3',
  lineCount = 1,
  accessibilityLabel,
  className,
  testID,
}: RedactedTextProps) {
  const { resolveSize } = useFontScale();
  const { fontSize, lineHeight } = useResolveClassNames(TEXT_SIZE_CLASSES[resolveSize(size)]);

  return (
    <Box
      className={className}
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {range(lineCount).map((index) => (
        <Box
          key={index}
          className={cn('justify-center', 1 < lineCount && index === lineCount - 1 && 'w-3/5')}
          style={{ height: lineHeight }}
        >
          {/* 불러오는 중인 TextSkeleton과 같은 면이지만 움직이지 않아 가린 글자로 읽힌다 */}
          <Skeleton
            variant="none"
            className="rounded dark:bg-gray-2"
            style={{ height: fontSize }}
          />
        </Box>
      ))}
    </Box>
  );
}
