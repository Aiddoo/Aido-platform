import { type ReactNode, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { OverlayProvider } from '../overlay/overlay-provider';
import { SheetToastLayer } from '../toast/toast-layer';

interface SheetRouteScreenProps {
  children: ReactNode;
}

/** iOS transparentModal은 루트 위에 따로 표시되므로 제스처 루트와 Overlay·PortalHost·토스트 면을 이 화면 안에 다시 둔다. 시트에서 시트로 replace하면 새 모달이 크기를 받기 전에 그려질 수 있어 크기가 정해진 뒤 시트를 그린다 */
export function SheetRouteScreen({ children }: SheetRouteScreenProps) {
  const [hasLayout, setHasLayout] = useState(false);

  const handleLayout = (event: LayoutChangeEvent) => {
    if (event.nativeEvent.layout.height > 0) {
      setHasLayout(true);
    }
  };

  return (
    <GestureHandlerRootView style={styles.root} onLayout={handleLayout}>
      <SheetToastLayer>
        <OverlayProvider disableFullWindowOverlay>{hasLayout && children}</OverlayProvider>
      </SheetToastLayer>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
