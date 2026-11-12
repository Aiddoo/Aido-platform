import { createContext, type ReactNode, use } from 'react';
import { StyleSheet } from 'react-native';

import { Box } from '../box';
import { VStack } from '../v-stack/v-stack';
import { SHARED_SHEET_STYLES, SHEET_CONTENT_PADDING } from './bottom-sheet.constants';
import { SheetScrollView } from './sheet-scroll-view';

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

const { paddingBottom: SHEET_BOTTOM_PADDING } = SHARED_SHEET_STYLES.content;

const styles = StyleSheet.create({
  layout: { flexShrink: 1 },
  bleed: { marginHorizontal: -SHEET_CONTENT_PADDING },
  bleedToBottom: { marginHorizontal: -SHEET_CONTENT_PADDING, marginBottom: -SHEET_BOTTOM_PADDING },
  body: { paddingHorizontal: SHEET_CONTENT_PADDING },
});
