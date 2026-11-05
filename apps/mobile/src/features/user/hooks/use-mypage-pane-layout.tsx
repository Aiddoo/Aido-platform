import { useIsFocused } from 'expo-router';
import {
  type ComponentRef,
  createContext,
  type PropsWithChildren,
  type RefObject,
  use,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface MyPagePaneLayoutValue {
  offsetRef: RefObject<number>;
  topInset: number;
  publishTopInset: (topInset: number) => void;
}

const MyPagePaneLayoutContext = createContext<MyPagePaneLayoutValue | null>(null);

/**
 * 탭과 메뉴 화면은 왼쪽 메뉴를 따로 그린다. 들어가고 나올 때 메뉴가 움직이지 않도록 스크롤과 위 여백을 나눠 갖는다.
 * 위 쪽 탭 바(iPad)는 탭 화면에만 있어 두 화면의 위 inset 중 큰 값을 쓴다. 기기에 남기지 않는 화면 임시 값이다.
 */
export function MyPagePaneLayoutProvider({ children }: PropsWithChildren) {
  const offsetRef = useRef(0);
  const [topInset, setTopInset] = useState(0);
  const value = useMemo(
    () => ({
      offsetRef,
      topInset,
      publishTopInset: (next: number) => setTopInset((current) => Math.max(current, next)),
    }),
    [topInset],
  );

  return <MyPagePaneLayoutContext value={value}>{children}</MyPagePaneLayoutContext>;
}

export function useMyPagePaneLayout() {
  const layout = use(MyPagePaneLayoutContext);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const isFocused = useIsFocused();
  const { top } = useSafeAreaInsets();
  const offsetRef = layout?.offsetRef;
  const publishTopInset = layout?.publishTopInset;

  useEffect(() => {
    publishTopInset?.(top);
  }, [publishTopInset, top]);

  useLayoutEffect(() => {
    if (isFocused && offsetRef != null) {
      scrollRef.current?.scrollTo({ y: offsetRef.current, animated: false });
    }
  }, [isFocused, offsetRef]);

  const handleScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (offsetRef != null) {
      offsetRef.current = nativeEvent.contentOffset.y;
    }
  };

  return { scrollRef, handleScroll, topInset: Math.max(top, layout?.topInset ?? 0) };
}
