import type { ComponentProps, ReactNode } from 'react';
import { type StyleProp, StyleSheet, type ViewStyle } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { ScrollFade } from '../scroll-fade/scroll-fade';

interface SheetScrollViewProps extends Pick<
  ComponentProps<typeof ScrollView>,
  'contentContainerStyle'
> {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

/** 머리글 아래 본문 스크롤. 넘칠 때 스크롤 막대와 잘리는 쪽 흐림을 보인다 */
export function SheetScrollView({ style, contentContainerStyle, children }: SheetScrollViewProps) {
  return (
    <ScrollFade surface="sheet" style={[styles.area, style]}>
      <ScrollView
        testID="sheet-scroll-view"
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
