import { clsx } from 'clsx';
import { Text as RNText } from 'react-native';
import type { TextProps } from './Text.types';
import { textVariants } from './Text.variants';

export function Text({
  color,
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
  return (
    <RNText
      className={clsx(
        textVariants({ color, weight, size, align, strikethrough, underline }),
        className,
      )}
      numberOfLines={maxLines}
      {...props}
    >
      {children}
    </RNText>
  );
}
