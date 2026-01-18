import { clsx } from 'clsx';
import { Text as RNText } from 'react-native';
import type { TextProps } from './Text.types';
import { shadeClasses, textVariants } from './Text.variants';

export function Text({
  tone,
  shade,
  weight,
  size,
  align,
  maxLines,
  strikethrough,
  underline,
  className,
  children,
  ...props
}: TextProps) {
  const shadeClass = tone === 'neutral' && shade ? shadeClasses[shade] : '';

  return (
    <RNText
      className={clsx(
        textVariants({ tone, size, weight, align, strikethrough, underline }),
        shadeClass,
        className,
      )}
      numberOfLines={maxLines}
      {...props}
    >
      {children}
    </RNText>
  );
}
