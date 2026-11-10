import type { ComponentRef, ReactNode, Ref } from 'react';
import { StyleSheet } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { SHEET_CONTENT_PADDING } from './bottom-sheet.constants';

interface SheetChipRowProps {
  children: ReactNode;
  /** 고른 칩을 처음부터 보이게 줄을 밀 때 쓴다 */
  ref?: Ref<ComponentRef<typeof ScrollView>>;
}

/** 시트 안에서 칩을 한 줄로 두고 넘치면 가로로 민다. 시트 좌우 끝까지 밀리도록 내용 여백만큼 바깥으로 편다 */
export function SheetChipRow({ children, ref }: SheetChipRowProps) {
  return (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="always"
      style={styles.row}
      contentContainerStyle={styles.content}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexGrow: 0, marginHorizontal: -SHEET_CONTENT_PADDING },
  content: { gap: 8, paddingHorizontal: SHEET_CONTENT_PADDING },
});
