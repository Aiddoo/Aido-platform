import { type ComponentProps, createContext, type ReactNode, use } from 'react';
import { type StyleProp, StyleSheet, type ViewStyle } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { Box } from '../box/box';
import { ScrollFade } from '../scroll-fade/scroll-fade';
import { VStack } from '../v-stack/v-stack';
import { SHARED_SHEET_STYLES, SHEET_CONTENT_PADDING } from './bottom-sheet.constants';

export const SheetFixedHeaderContext = createContext(false);

interface SheetHeaderLayoutProps {
  header: ReactNode;
  footer?: ReactNode;
  gap: number;
  children: ReactNode;
}

export function SheetHeaderLayout({ header, footer, gap, children }: SheetHeaderLayoutProps) {
  const hasFixedHeader = use(SheetFixedHeaderContext);

  if (!hasFixedHeader) {
    return (
      <VStack gap={gap}>
        {header}
        {children}
        {footer}
      </VStack>
    );
  }

  return (
    <Box style={styles.layout}>
      <Box style={{ paddingBottom: gap }}>{header}</Box>
      <SheetScrollView
        style={footer == null ? styles.bleedToBottom : styles.bleed}
        contentContainerStyle={[
          styles.body,
          { paddingBottom: footer == null ? SHEET_BOTTOM_PADDING : gap },
        ]}
      >
        {children}
      </SheetScrollView>
      {footer}
    </Box>
  );
}

interface SheetScrollViewProps extends Pick<
  ComponentProps<typeof ScrollView>,
  'contentContainerStyle'
> {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

/** 머리글 아래 본문 스크롤. 넘칠 때 스크롤 막대와 잘리는 쪽 흐림을 보인다 */
function SheetScrollView({ style, contentContainerStyle, children }: SheetScrollViewProps) {
  return (
    <ScrollFade surface="sheet" style={[styles.scrollArea, style]}>
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

const { paddingBottom: SHEET_BOTTOM_PADDING } = SHARED_SHEET_STYLES.content;

const styles = StyleSheet.create({
  layout: { flexShrink: 1 },
  bleed: { marginHorizontal: -SHEET_CONTENT_PADDING },
  bleedToBottom: { marginHorizontal: -SHEET_CONTENT_PADDING, marginBottom: -SHEET_BOTTOM_PADDING },
  body: { paddingHorizontal: SHEET_CONTENT_PADDING },
  scrollArea: { flexShrink: 1 },
  scroll: { flexGrow: 0, flexShrink: 1 },
});
