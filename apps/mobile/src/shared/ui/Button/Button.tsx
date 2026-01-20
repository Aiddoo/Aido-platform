import { clsx } from 'clsx';
import { PressableFeedback, Spinner } from 'heroui-native';
import { Text } from '../Text/Text';
import type { ButtonProps } from './Button.types';
import { buttonVariants, highlightVariants } from './Button.variants';

const textSizeMap = {
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
    fill: 'text-white',
    weak: {
      primary: 'text-main',
      danger: 'text-error',
      dark: 'text-gray-9',
    },
  } as const;

  const textColor = variant === 'fill' ? textColorMap.fill : textColorMap.weak[color];

  const renderContent = () => {
    if (isLoading) {
      return <Spinner size="sm" color={variant === 'fill' ? 'white' : 'default'} />;
    }
    if (isTextChild) {
      return (
        <Text size={textSizeMap[size]} weight="semibold" className={textColor}>
          {children}
        </Text>
      );
    }
    return children;
  };

  return (
    <PressableFeedback
      isDisabled={disabled}
      className={clsx(
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
