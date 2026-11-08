import { useIsFocused } from 'expo-router';
import {
  type ComponentRef,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from 'react';
import type { NativeScrollEvent, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createMyPagePaneLayoutStore } from '../utils/my-page-pane-layout-store';

const myPagePaneLayoutStore = createMyPagePaneLayoutStore();

export function useMyPagePaneLayout() {
  const paneId = useId();
  const sharedTopInset = useSyncExternalStore(
    myPagePaneLayoutStore.subscribe,
    myPagePaneLayoutStore.getTopInset,
  );
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const restoreOffsetRef = useRef<number | null>(null);
  const isFocused = useIsFocused();
  const { top } = useSafeAreaInsets();

  useEffect(() => {
    myPagePaneLayoutStore.publishTopInset(paneId, top);
  }, [paneId, top]);

  useEffect(() => () => myPagePaneLayoutStore.removeTopInset(paneId), [paneId]);

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
    topInset: Math.max(top, sharedTopInset),
  };
}
