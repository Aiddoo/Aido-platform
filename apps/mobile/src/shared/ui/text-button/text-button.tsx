import { cn } from '@src/shared/utils/cn';
import { LinkButton } from 'heroui-native';

import { Box } from '../box';
import { ArrowRightIcon } from '../icon';
import { Text } from '../text/text';
import type { TextButtonProps } from './text-button.types';
import { textButtonVariants } from './text-button.variants';

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

/**
 * heroui `LinkButton`(ghost, 높이·안쪽 여백 없음) 위에 글자 크기 5단계를 얹는다.
 * 글자는 앱 글꼴 설정을 따르도록 heroui 라벨 대신 자식 `Text`로 넣는다.
 */
export function TextButton({
  children,
  size = 'medium',
  variant = 'clear',
  isDisabled = false,
  className,
  ...props
}: TextButtonProps) {
  return (
    <LinkButton
      isDisabled={isDisabled}
      className={cn(textButtonVariants({ size, variant }), className)}
      {...props}
    >
      <Text size={TEXT_SIZE_MAP[size]} shade={6} underline={variant === 'underline'}>
        {children}
      </Text>
      {variant === 'arrow' && (
        <Box className="ml-1">
          <ArrowRightIcon
            testID="text-button-arrow"
            width={ICON_SIZE_MAP[size]}
            height={ICON_SIZE_MAP[size]}
            colorClassName="text-gray-6"
          />
        </Box>
      )}
    </LinkButton>
  );
}
