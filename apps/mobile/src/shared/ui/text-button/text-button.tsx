import { cn } from '@src/shared/utils/cn';
import { PressableFeedback } from 'heroui-native';

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

export function TextButton({
  children,
  size = 'medium',
  variant = 'clear',
  isDisabled = false,
  className,
  ...props
}: TextButtonProps) {
  return (
    <PressableFeedback
      isDisabled={isDisabled}
      className={cn(textButtonVariants({ size, variant, isDisabled }), className)}
      {...props}
    >
      <Text size={TEXT_SIZE_MAP[size]} shade={6} underline={variant === 'underline'}>
        {children}
      </Text>
      {variant === 'arrow' && (
        <Box className="ml-1">
          <ArrowRightIcon
            width={ICON_SIZE_MAP[size]}
            height={ICON_SIZE_MAP[size]}
            colorClassName="text-gray-6"
          />
        </Box>
      )}
    </PressableFeedback>
  );
}
