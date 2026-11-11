import type { ComponentProps, ReactNode } from 'react';
import { type StyleProp, StyleSheet, type ViewStyle } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { ScrollFade } from '../scroll-fade/scroll-fade';

interface SheetScrollAreaProps extends Pick<
  ComponentProps<typeof ScrollView>,
  'contentContainerStyle'
> {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

export function SheetScrollArea({ style, contentContainerStyle, children }: SheetScrollAreaProps) {
  return (
    <ScrollFade surface="sheet" style={[styles.area, style]}>
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
    </ScrollFade>
  );
}

const styles = StyleSheet.create({
  area: { flexShrink: 1 },
  scroll: { flexGrow: 0, flexShrink: 1 },
});
