import { useAppWindow } from '@src/shared/hooks/use-app-window';
import { Box } from '@src/shared/ui';
import { getDistanceToWindowBottom } from '@src/shared/utils/get-distance-to-window-bottom';
import {
  type ComponentRef,
  createContext,
  type PropsWithChildren,
  use,
  useRef,
  useState,
} from 'react';
import { type LayoutChangeEvent, type View } from 'react-native';

const KeyboardBottomGapContext = createContext(0);

/** `KeyboardStickyView`/`KeyboardChatScrollView`는 키보드 높이 전체만큼 움직여, 화면 끝까지 닿지 않는 pane은 이 거리를 빼야 과하게 뜨지 않는다 */
export function KeyboardBottomGapProvider({ children }: PropsWithChildren) {
  const { height: windowHeight } = useAppWindow();
  const containerRef = useRef<ComponentRef<typeof View>>(null);
  const [keyboardBottomGap, setKeyboardBottomGap] = useState(0);

  const measureGap = (_event: LayoutChangeEvent) => {
    containerRef.current?.measureInWindow((_x, top, _width, height) => {
      setKeyboardBottomGap(getDistanceToWindowBottom(windowHeight, { top, height }));
    });
  };

  return (
    <Box ref={containerRef} flex={1} onLayout={measureGap}>
      <KeyboardBottomGapContext value={keyboardBottomGap}>{children}</KeyboardBottomGapContext>
    </Box>
  );
}

export function useKeyboardBottomGap(): number {
  return use(KeyboardBottomGapContext);
}
