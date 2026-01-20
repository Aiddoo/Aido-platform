import ArrowRightIcon from '@assets/icons/ic_arrow_right.svg';
import { clsx } from 'clsx';
import { PressableFeedback } from 'heroui-native';
import { View } from 'react-native';
import { useCSSVariable } from 'uniwind';
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
  const gray6 = useCSSVariable('--gray-6');

  return (
    <PressableFeedback
      isDisabled={isDisabled}
      className={clsx(textButtonVariants({ size, variant, isDisabled }), className)}
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
            color={String(gray6)}
          />
        </View>
      )}
    </PressableFeedback>
  );
}
