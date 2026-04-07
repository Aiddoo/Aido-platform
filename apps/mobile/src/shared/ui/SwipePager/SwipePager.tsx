import React, { useEffect, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  View,
} from 'react-native';

interface SwipePagerProps {
  children: React.ReactNode;
  onPageSelected?: (index: number) => void;
  initialPage?: number;
  resetKey?: string | number;
  className?: string;
}

export function SwipePager({
  children,
  onPageSelected,
  initialPage = 0,
  resetKey,
  className,
}: SwipePagerProps) {
  const scrollRef = useRef<ScrollView>(null);
  const isResetting = useRef(false);
  const [pageWidth, setPageWidth] = useState(0);

  const pages = React.Children.toArray(children);

  const handleLayout = (e: LayoutChangeEvent) => {
    setPageWidth(e.nativeEvent.layout.width);
  };

  useEffect(() => {
    if (pageWidth === 0) return;

    // resetKey를 의존성으로 유지하기 위해 void로 참조
    void resetKey;

    isResetting.current = true;
    scrollRef.current?.scrollTo({
      x: initialPage * pageWidth,
      animated: false,
    });

    requestAnimationFrame(() => {
      isResetting.current = false;
    });
  }, [pageWidth, initialPage, resetKey]);

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isResetting.current || pageWidth === 0) return;

    const offsetX = e.nativeEvent.contentOffset.x;
    const page = Math.round(offsetX / pageWidth);

    onPageSelected?.(page);
  };

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      scrollEventThrottle={16}
      onLayout={handleLayout}
      onMomentumScrollEnd={handleScrollEnd}
      contentOffset={{ x: initialPage * pageWidth, y: 0 }}
      className={className}
    >
      {pages.map((page, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: 페이지 순서 기반 배치
        <View key={index} style={{ width: pageWidth }}>
          {page}
        </View>
      ))}
    </ScrollView>
  );
}
