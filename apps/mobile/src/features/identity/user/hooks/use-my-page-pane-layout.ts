import { useMyPagePaneLayoutStore } from '@src/bootstrap/providers/di-context';
import { useIsFocused } from 'expo-router';
import { type ComponentRef, useEffect, useLayoutEffect, useRef } from 'react';
import type { NativeScrollEvent, ScrollView } from 'react-native';

export function useMyPagePaneLayout() {
  const myPagePaneLayoutStore = useMyPagePaneLayoutStore();
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const restoreOffsetRef = useRef<number | null>(null);
  const isFocused = useIsFocused();

  useEffect(() => myPagePaneLayoutStore.attach(), [myPagePaneLayoutStore]);

  useLayoutEffect(() => {
    if (!isFocused) {
      restoreOffsetRef.current = null;
      return;
    }
    const offset = myPagePaneLayoutStore.getScrollOffset();
    restoreOffsetRef.current = offset > 0 ? offset : null;
    scrollRef.current?.scrollTo({ y: offset, animated: false });
  }, [isFocused, myPagePaneLayoutStore]);

  // 스크롤이 멈출 때만 저장해 프레임마다 JS로 오지 않는다. 복원이 끝나기 전 잘린 위치로 저장값을 덮지 않는다
  const handleScrollEnd = ({
    nativeEvent,
  }: {
    nativeEvent: Pick<NativeScrollEvent, 'contentOffset'>;
  }) => {
    if (!isFocused) {
      return;
    }
    const { y } = nativeEvent.contentOffset;
    if (restoreOffsetRef.current == null) {
      myPagePaneLayoutStore.setScrollOffset(y);
      return;
    }
    if (Math.abs(y - restoreOffsetRef.current) < 1) {
      restoreOffsetRef.current = null;
    }
  };

  const handleSizeChange = () => {
    if (restoreOffsetRef.current != null) {
      scrollRef.current?.scrollTo({ y: restoreOffsetRef.current, animated: false });
    }
  };

  const handleScrollBeginDrag = () => {
    restoreOffsetRef.current = null;
  };

  return {
    scrollRef,
    handleScrollEnd,
    handleSizeChange,
    handleScrollBeginDrag,
  };
}
