import { useFontScale } from '@src/shared/providers/font-scale-provider';
import { cn } from '@src/shared/utils/cn';
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
  const { resolveSize } = useFontScale();
  const resolvedSize = resolveSize(size ?? 'b3');
  const isNeutralTone = tone === 'neutral' || tone === undefined;
  const shadeClass = isNeutralTone && shade ? shadeClasses[shade] : '';

  return (
    <RNText
      className={cn(
        textVariants({ tone, size: resolvedSize, weight, align, strikethrough, underline }),
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
