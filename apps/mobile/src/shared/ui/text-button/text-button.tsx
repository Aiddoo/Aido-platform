import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useFontScale } from '@src/shared/providers/font-scale-provider';
import { cn } from '@src/shared/utils/cn';
import { LinkButton } from 'heroui-native';
import { useResolveClassNames } from 'uniwind';

import { Box } from '../box/box';
import { ArrowRightIcon } from '../icon/icons';
import { Text } from '../text/text';
import { TEXT_SIZE_CLASSES } from '../text/text.variants';
import { getTouchTargetInset } from '../touch-target/touch-target';
import type { TextButtonProps } from './text-button.types';

const TEXT_SIZE_MAP = {
  xsmall: 'e2',
  small: 'e1',
  medium: 'b4',
  large: 'b3',
  xlarge: 'b2',
} as const;

const ICON_SIZE_MAP = {
  xsmall: 12,
  small: 14,
  medium: 16,
  large: 18,
  xlarge: 20,
} as const;

/** 가로는 글자 폭이 대개 44를 넘고 옆 글자 버튼과 겹치지 않게 조금만 넓힌다. 위아래는 아래에서 44 이상으로 올린다 */
const DEFAULT_HIT_SLOP = { top: 12, bottom: 12, left: 8, right: 8 };

/** 글자는 앱 글꼴 설정을 따르도록 heroui 라벨 대신 자식 `Text`로 넣는다 */
export function TextButton({
  children,
  size = 'medium',
  variant = 'clear',
  isDisabled = false,
  hitSlop,
  className,
  ...props
}: TextButtonProps) {
  const fontScaledSize = useFontScaledSize();
  const { resolveSize } = useFontScale();
  const arrowSize = fontScaledSize(ICON_SIZE_MAP[size]);
  // 글자 줄 높이만큼만 눌려 44pt에 못 미치므로 지금 글꼴 단계의 줄 높이로 위아래를 채운다
  const { lineHeight } = useResolveClassNames(TEXT_SIZE_CLASSES[resolveSize(TEXT_SIZE_MAP[size])]);
  const minVerticalHitSlop = typeof lineHeight === 'number' ? getTouchTargetInset(lineHeight) : 0;
  const hitSlopInsets =
    typeof hitSlop === 'number'
      ? { top: hitSlop, bottom: hitSlop, left: hitSlop, right: hitSlop }
      : { ...DEFAULT_HIT_SLOP, ...hitSlop };

  return (
    <LinkButton
      isDisabled={isDisabled}
      hitSlop={{
        ...hitSlopInsets,
        top: Math.max(hitSlopInsets.top ?? 0, minVerticalHitSlop),
        bottom: Math.max(hitSlopInsets.bottom ?? 0, minVerticalHitSlop),
      }}
      className={cn('flex-row items-center justify-center gap-0 disabled:opacity-40', className)}
      {...props}
    >
      <Text size={TEXT_SIZE_MAP[size]} shade={6} underline={variant === 'underline'}>
        {children}
      </Text>
      {variant === 'arrow' && (
        <Box className="ml-1">
          <ArrowRightIcon width={arrowSize} height={arrowSize} colorClassName="text-gray-6" />
        </Box>
      )}
    </LinkButton>
  );
}
