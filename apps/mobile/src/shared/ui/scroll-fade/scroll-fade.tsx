import { LinearGradient } from 'expo-linear-gradient';
import { ScrollShadow } from 'heroui-native';
import type { ComponentProps } from 'react';
import { useResolveClassNames } from 'uniwind';

const SCROLL_FADE_HEIGHT = 32;

const SURFACE_BACKGROUND_CLASS_NAMES = {
  screen: 'bg-white',
  sheet: 'bg-white dark:bg-gray-1',
} as const;

type ScrollFadeProps = Omit<
  ComponentProps<typeof ScrollShadow>,
  'LinearGradientComponent' | 'color' | 'size'
> & {
  surface: keyof typeof SURFACE_BACKGROUND_CLASS_NAMES;
};

export function ScrollFade({ surface, ...props }: ScrollFadeProps) {
  const { backgroundColor } = useResolveClassNames(SURFACE_BACKGROUND_CLASS_NAMES[surface]);

  return (
    <ScrollShadow
      {...props}
      LinearGradientComponent={LinearGradient}
      color={typeof backgroundColor === 'string' ? backgroundColor : undefined}
      size={SCROLL_FADE_HEIGHT}
    />
  );
}
