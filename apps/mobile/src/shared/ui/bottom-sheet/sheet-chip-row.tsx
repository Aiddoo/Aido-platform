import type { ComponentProps } from 'react';
import { StyleSheet } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { SHEET_CONTENT_PADDING } from './bottom-sheet.constants';

type SheetChipRowProps = Omit<
  ComponentProps<typeof ScrollView>,
  | 'horizontal'
  | 'showsHorizontalScrollIndicator'
  | 'keyboardShouldPersistTaps'
  | 'contentContainerStyle'
>;

/** 시트 안에서 칩을 한 줄로 두고 넘치면 가로로 민다. 시트 내용 여백만큼 바깥으로 펴서 시트 끝(레일을 덮은 시트는 레일 앞)까지 밀린다 */
export function SheetChipRow({ style, ...props }: SheetChipRowProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="always"
      style={[styles.row, style]}
      contentContainerStyle={styles.content}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexGrow: 0, marginHorizontal: -SHEET_CONTENT_PADDING },
  content: { gap: 8, paddingHorizontal: SHEET_CONTENT_PADDING },
});
