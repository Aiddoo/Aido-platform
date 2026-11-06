import { LinearGradient } from 'expo-linear-gradient';
import { ScrollShadow } from 'heroui-native';
import type { ComponentProps } from 'react';
import { useResolveClassNames } from 'uniwind';

export const SCROLL_FADE_HEIGHT = 32;

type ScreenScrollShadowProps = Omit<
  ComponentProps<typeof ScrollShadow>,
  'LinearGradientComponent' | 'color' | 'size'
>;

export function ScreenScrollShadow(props: ScreenScrollShadowProps) {
  const { backgroundColor } = useResolveClassNames('bg-white');

  return (
    <ScrollShadow
      {...props}
      LinearGradientComponent={LinearGradient}
      color={typeof backgroundColor === 'string' ? backgroundColor : undefined}
      size={SCROLL_FADE_HEIGHT}
    />
  );
}
