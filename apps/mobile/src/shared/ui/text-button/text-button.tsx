import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { cn } from '@src/shared/utils/cn';
import { LinkButton } from 'heroui-native';

import { Box } from '../box/box';
import { ArrowRightIcon } from '../icon/icons';
import { Text } from '../text/text';
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

/** 글자 줄 높이만큼만 눌려 44pt에 못 미치므로, 모양은 두고 눌리는 범위만 넓힌다 */
const HIT_SLOP = { top: 12, bottom: 12, left: 8, right: 8 };

/** 글자는 앱 글꼴 설정을 따르도록 heroui 라벨 대신 자식 `Text`로 넣는다 */
export function TextButton({
  children,
  size = 'medium',
  variant = 'clear',
  isDisabled = false,
  hitSlop = HIT_SLOP,
  className,
  ...props
}: TextButtonProps) {
  const fontScaledSize = useFontScaledSize();
  const arrowSize = fontScaledSize(ICON_SIZE_MAP[size]);

  return (
    <LinkButton
      isDisabled={isDisabled}
      hitSlop={hitSlop}
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
