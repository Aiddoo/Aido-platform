import { useIsFocused } from 'expo-router';
import { type ComponentRef, useEffect, useLayoutEffect, useRef } from 'react';
import type { NativeScrollEvent, ScrollView } from 'react-native';

import { createMyPagePaneLayoutStore } from '../utils/my-page-pane-layout-store';

const myPagePaneLayoutStore = createMyPagePaneLayoutStore();

export function useMyPagePaneLayout() {
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const restoreOffsetRef = useRef<number | null>(null);
  const isFocused = useIsFocused();

  useEffect(() => myPagePaneLayoutStore.attach(), []);

  useLayoutEffect(() => {
    if (!isFocused) {
      restoreOffsetRef.current = null;
      return;
    }
    const offset = myPagePaneLayoutStore.getScrollOffset();
    restoreOffsetRef.current = offset > 0 ? offset : null;
    scrollRef.current?.scrollTo({ y: offset, animated: false });
  }, [isFocused]);

  // 내용이 로딩 중이면 Android가 위치를 내용 높이로 자르고 이벤트를 보낸다. 복원이 끝나기 전 이벤트로 저장값을 덮지 않는다
  const handleScroll = ({
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

  const handleContentSizeChange = () => {
    if (restoreOffsetRef.current != null) {
      scrollRef.current?.scrollTo({ y: restoreOffsetRef.current, animated: false });
    }
  };

  const handleScrollBeginDrag = () => {
    restoreOffsetRef.current = null;
  };

  return {
    scrollRef,
    handleScroll,
    handleContentSizeChange,
    handleScrollBeginDrag,
  };
}
