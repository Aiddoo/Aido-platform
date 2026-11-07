import { useFontScale } from '@src/shared/providers/font-scale-provider';
import { cn } from '@src/shared/utils/cn';
import { Text as RNText } from 'react-native';

import type { TextProps } from './text.types';
import { TEXT_SHADE_CLASSES, textVariants } from './text.variants';

export function Text({
  tone,
  shade,
  weight,
  size,
  align,
  strikethrough,
  underline,
  className,
  children,
  ...props
}: TextProps) {
  const { resolveSize } = useFontScale();
  const resolvedSize = resolveSize(size ?? 'b3');
  const isNeutralTone = tone === 'neutral' || tone == null;
  const shadeClass = isNeutralTone && shade ? TEXT_SHADE_CLASSES[shade] : '';

  return (
    <RNText
      className={cn(
        textVariants({ tone, size: resolvedSize, weight, align, strikethrough, underline }),
        shadeClass,
        className,
      )}
      {...props}
      allowFontScaling={false}
    >
      {children}
    </RNText>
  );
}
