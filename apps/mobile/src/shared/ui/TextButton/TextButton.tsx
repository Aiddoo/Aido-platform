import { cn } from '@src/shared/utils/cn';
import { PressableFeedback } from 'heroui-native';
import { View } from 'react-native';
import { ArrowRightIcon } from '../Icon';
import { Text } from '../Text/Text';
import type { TextButtonProps } from './TextButton.types';
import { textButtonVariants } from './TextButton.variants';

const textSizeMap = {
  xsmall: 'e2',
  small: 'e1',
  medium: 'b4',
  large: 'b3',
  xlarge: 'b2',
} as const;

const iconSizeMap = {
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
      <Text size={textSizeMap[size]} shade={6} underline={variant === 'underline'}>
        {children}
      </Text>
      {variant === 'arrow' && (
        <View className="ml-1">
          <ArrowRightIcon
            width={iconSizeMap[size]}
            height={iconSizeMap[size]}
            colorClassName="text-gray-6"
          />
        </View>
      )}
    </PressableFeedback>
  );
}
