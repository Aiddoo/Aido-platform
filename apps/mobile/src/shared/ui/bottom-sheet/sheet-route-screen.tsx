import { PortalHost } from 'heroui-native';
import { type ReactNode, useId, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { OverlayProvider } from '../overlay/overlay-provider';
import { FullWindowHostContext } from './full-window-host-context';
import { SheetRoutePortalHostContext } from './sheet-route-portal-host';

interface SheetRouteScreenProps {
  children: ReactNode;
}

/**
 * 시트 route 화면의 바탕. iOS transparentModal은 루트 위에 따로 표시되므로 제스처 루트와
 * Overlay를 이 화면 안에 다시 두어, 시트 안에서 여는 피커·다이얼로그가 시트 위에 그려지게 한다.
 * 시트에서 시트로 replace하면 새 모달이 크기를 받기 전에 그려질 수 있어, 모달 크기가 정해진 뒤
 * 시트를 그린다. 모달은 창 전체를 덮으므로 reserved region은 앱 루트 provider의 측정값을 그대로 쓴다.
 * 다이얼로그 Portal도 이 모달 안의 PortalHost에 그려 접근성 트리에 남게 한다.
 */
export function SheetRouteScreen({ children }: SheetRouteScreenProps) {
  const [hasLayout, setHasLayout] = useState(false);
  const portalHostName = useId();

  function handleLayout(event: LayoutChangeEvent) {
    if (event.nativeEvent.layout.height > 0) {
      setHasLayout(true);
    }
  }

  return (
    <GestureHandlerRootView style={styles.root} onLayout={handleLayout}>
      <FullWindowHostContext value>
        <SheetRoutePortalHostContext value={portalHostName}>
          <OverlayProvider>{hasLayout && children}</OverlayProvider>
        </SheetRoutePortalHostContext>
      </FullWindowHostContext>
      <PortalHost name={portalHostName} />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
