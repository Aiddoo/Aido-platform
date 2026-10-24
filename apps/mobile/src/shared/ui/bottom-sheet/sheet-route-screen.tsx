import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { OverlayProvider } from '../overlay/overlay-provider';

interface SheetRouteScreenProps {
  children: ReactNode;
}

/**
 * 시트 route 화면의 바탕. iOS transparentModal은 루트 위에 따로 표시되므로 제스처 루트와
 * Overlay를 이 화면 안에 다시 두어, 시트 안에서 여는 피커·다이얼로그가 시트 위에 그려지게 한다.
 */
export function SheetRouteScreen({ children }: SheetRouteScreenProps) {
  return (
    <GestureHandlerRootView style={styles.root}>
      <OverlayProvider>{children}</OverlayProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
