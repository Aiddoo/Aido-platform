import {
  type ComponentRef,
  createContext,
  type PropsWithChildren,
  use,
  useCallback,
  useRef,
  useState,
} from 'react';
import { type LayoutChangeEvent, useWindowDimensions, type View } from 'react-native';

import { Box } from '../ui/box';
import { getDistanceToWindowBottom } from '../utils/distance-to-window-bottom';

const KeyboardBottomGapContext = createContext(0);

/**
 * 화면 아래까지 닿지 않는 영역(예: Android 하단 탭 바 위의 pane) 안에서 키보드를 피하는 컴포넌트에 거리를 알려준다.
 * keyboard-controller의 `KeyboardStickyView`/`KeyboardChatScrollView`는 키보드 높이 전체만큼 움직이므로 이 거리를 빼야 과하게 뜨지 않는다.
 * 화면 전체를 쓰는 라우트에서는 감싸지 않는다(기본값 0).
 */
export function KeyboardBottomGapProvider({ children }: PropsWithChildren) {
  const { height: windowHeight } = useWindowDimensions();
  const containerRef = useRef<ComponentRef<typeof View>>(null);
  const [keyboardBottomGap, setKeyboardBottomGap] = useState(0);

  const measureGap = useCallback(
    (_event: LayoutChangeEvent) => {
      containerRef.current?.measureInWindow((_x, top, _width, height) => {
        setKeyboardBottomGap(getDistanceToWindowBottom(windowHeight, { top, height }));
      });
    },
    [windowHeight],
  );

  return (
    <Box ref={containerRef} flex={1} onLayout={measureGap}>
      <KeyboardBottomGapContext value={keyboardBottomGap}>{children}</KeyboardBottomGapContext>
    </Box>
  );
}

export function useKeyboardBottomGap(): number {
  return use(KeyboardBottomGapContext);
}
