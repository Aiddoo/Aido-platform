import { cn } from '@src/shared/utils/cn';
import { Button as HeroButton, PressableFeedback, Spinner } from 'heroui-native';

import { Text } from '../text/text';
import type { ButtonProps } from './button.types';
import { buttonVariants, highlightVariants } from './button.variants';

const TEXT_SIZE_MAP = {
  small: 'e1',
  medium: 'b4',
  large: 'b4',
  xlarge: 'b3',
} as const;

const HERO_VARIANT_MAP = {
  fill: { primary: 'primary', danger: 'danger', dark: 'primary' },
  weak: { primary: 'secondary', danger: 'danger-soft', dark: 'secondary' },
} as const;

const TEXT_COLOR_MAP = {
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

/** Uniwind는 같은 우선순위면 뒤에 온 클래스가 이겨 `className`이 heroui 기본 클래스를 덮는다. 비활성은 회색 면 + 글자 흐림이라 heroui의 비활성 투명도는 `disabled:opacity-100`으로 끈다 */
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
  const isInactive = isDisabled || isLoading;
  const isTextChild = typeof children === 'string';
  const textColor = cn(TEXT_COLOR_MAP[variant][color], isInactive && 'opacity-40');

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
    <HeroButton
      variant={HERO_VARIANT_MAP[variant][color]}
      feedbackVariant="scale"
      isDisabled={isInactive}
      className={cn(
        buttonVariants({ size, variant, color, display, radius, isDisabled: isInactive }),
        className,
      )}
      {...props}
    >
      <PressableFeedback.Highlight className={highlightVariants({ radius })} />
      {renderContent()}
    </HeroButton>
  );
}
