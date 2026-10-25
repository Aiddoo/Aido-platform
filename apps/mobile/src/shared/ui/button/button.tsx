import { cn } from '@src/shared/utils/cn';
import { PressableFeedback, Spinner } from 'heroui-native';

import { Text } from '../text/text';
import type { ButtonProps } from './button.types';
import { buttonVariants, highlightVariants } from './button.variants';

const TEXT_SIZE_MAP = {
  small: 'e1',
  medium: 'b4',
  large: 'b4',
  xlarge: 'b3',
} as const;

export function Button({
  children,
  size = 'xlarge',
  variant = 'fill',
  color = 'primary',
  display = 'full',
  radius = 'lg',
  isLoading = false,
  isDisabled = false,
  className,
  ...props
}: ButtonProps) {
  const disabled = isDisabled || isLoading;
  const isTextChild = typeof children === 'string';

  const textColorMap = {
    fill: {
      primary: 'text-white dark:text-gray-9',
      danger: 'text-white dark:text-gray-9',
      dark: 'text-white dark:text-gray-9',
    },
    weak: {
      primary: 'text-main',
      danger: 'text-error',
      dark: 'text-gray-9',
    },
  } as const;

  const baseTextColor = variant === 'fill' ? textColorMap.fill[color] : textColorMap.weak[color];
  const textColor = disabled ? `${baseTextColor} opacity-40` : baseTextColor;

  const renderContent = () => {
    if (isLoading) {
      return <Spinner size="sm" color={variant === 'fill' ? 'white' : 'default'} />;
    }
    if (isTextChild) {
      return (
        <Text size={TEXT_SIZE_MAP[size]} weight="semibold" className={textColor}>
          {children}
        </Text>
      );
    }
    return children;
  };

  return (
    <PressableFeedback
      isDisabled={disabled}
      className={cn(
        buttonVariants({ size, variant, color, display, radius, isDisabled: disabled }),
        className,
      )}
      {...props}
    >
      <PressableFeedback.Highlight className={highlightVariants({ radius })} />
      {renderContent()}
    </PressableFeedback>
  );
}
