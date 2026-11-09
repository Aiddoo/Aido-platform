import { LinearGradient } from 'expo-linear-gradient';
import { ScrollShadow } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';
import { type StyleProp, StyleSheet, type ViewStyle } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useResolveClassNames } from 'uniwind';

import { SCROLL_FADE_HEIGHT } from '../screen-scroll-shadow/screen-scroll-shadow';

type SheetScrollShadowProps = Omit<
  ComponentProps<typeof ScrollShadow>,
  'LinearGradientComponent' | 'color' | 'size'
>;

export function SheetScrollShadow(props: SheetScrollShadowProps) {
  const { backgroundColor } = useResolveClassNames('bg-white dark:bg-gray-1');

  return (
    <ScrollShadow
      {...props}
      LinearGradientComponent={LinearGradient}
      color={typeof backgroundColor === 'string' ? backgroundColor : undefined}
      size={SCROLL_FADE_HEIGHT}
    />
  );
}

interface SheetScrollAreaProps extends Pick<
  ComponentProps<typeof ScrollView>,
  'contentContainerStyle'
> {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

export function SheetScrollArea({ style, contentContainerStyle, children }: SheetScrollAreaProps) {
  return (
    <SheetScrollShadow style={[styles.area, style]}>
      <ScrollView
        testID="sheet-scroll-area"
        style={styles.scroll}
        contentContainerStyle={contentContainerStyle}
        persistentScrollbar
        automaticallyAdjustsScrollIndicatorInsets={false}
        bounces={false}
      >
        {children}
      </ScrollView>
    </SheetScrollShadow>
  );
}

const styles = StyleSheet.create({
  area: { flexShrink: 1 },
  scroll: { flexGrow: 0, flexShrink: 1 },
});
