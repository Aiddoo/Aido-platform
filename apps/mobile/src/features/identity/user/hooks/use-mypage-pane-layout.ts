import { useIsFocused } from 'expo-router';
import { type ComponentRef, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createMyPagePaneLayoutStore } from './mypage-pane-layout-store';

const myPagePaneLayoutStore = createMyPagePaneLayoutStore();

export function useMyPagePaneLayout() {
  const sharedTopInset = useSyncExternalStore(
    myPagePaneLayoutStore.subscribe,
    myPagePaneLayoutStore.getTopInset,
  );
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const isFocused = useIsFocused();
  const { top } = useSafeAreaInsets();

  useEffect(() => {
    myPagePaneLayoutStore.publishTopInset(top);
  }, [top]);

  useLayoutEffect(() => {
    if (isFocused) {
      scrollRef.current?.scrollTo({ y: myPagePaneLayoutStore.getScrollOffset(), animated: false });
    }
  }, [isFocused]);

  const handleScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    myPagePaneLayoutStore.setScrollOffset(nativeEvent.contentOffset.y);
  };

  return { scrollRef, handleScroll, topInset: Math.max(top, sharedTopInset) };
}
