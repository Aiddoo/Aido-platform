import { Box } from '@src/shared/ui';
import { range } from 'es-toolkit';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  useWindowDimensions,
} from 'react-native';

import { getCalendarPageAtOffset } from '../../utils/calendar-pager.geometry';

/** 가운데(오늘이 있는 쪽)에서 양쪽으로 둘 쪽 수. 주 보기에서는 약 5년, 월 보기에서는 약 21년이다 */
const CALENDAR_PAGE_RADIUS = 260;
export const CALENDAR_TOTAL_PAGES = CALENDAR_PAGE_RADIUS * 2 + 1;
export const CALENDAR_CENTER_PAGE = CALENDAR_PAGE_RADIUS;
/** 이 쪽 수 안에서 옮길 때만 넘기는 애니메이션을 쓴다. 더 멀면 중간 쪽을 훑지 않고 바로 간다 */
const MAX_ANIMATED_PAGE_JUMP = 2;
const PAGES = range(CALENDAR_TOTAL_PAGES);

interface CalendarPagerProps {
  value: number;
  onChange: (page: number) => void;
  children: (page: number) => ReactNode;
}

export function CalendarPager({ value, onChange, children }: CalendarPagerProps) {
  // 측정 전 첫 프레임은 창 너비로 그려 달력 높이가 0에서 튀어나오지 않게 한다.
  const { width: windowWidth } = useWindowDimensions();
  const [measuredPageWidth, setMeasuredPageWidth] = useState<number | null>(null);
  const pageWidth = measuredPageWidth ?? windowWidth;
  const flatListRef = useRef<FlatList<number>>(null);
  const currentPageRef = useRef(CALENDAR_CENTER_PAGE);

  const handleScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, layoutMeasurement } = event.nativeEvent;
      const page = getCalendarPageAtOffset({
        offsetX: contentOffset.x,
        viewportWidth: layoutMeasurement.width,
        totalPages: CALENDAR_TOTAL_PAGES,
      });
      if (page === currentPageRef.current) {
        return;
      }
      currentPageRef.current = page;
      onChange(page);
    },
    [onChange],
  );

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setMeasuredPageWidth(event.nativeEvent.layout.width);
  }, []);

  useEffect(() => {
    if (value === currentPageRef.current) {
      return;
    }
    const distance = Math.abs(value - currentPageRef.current);
    currentPageRef.current = value;
    flatListRef.current?.scrollToIndex({
      index: value,
      animated: distance <= MAX_ANIMATED_PAGE_JUMP,
    });
  }, [value]);

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: pageWidth,
      offset: pageWidth * index,
      index,
    }),
    [pageWidth],
  );

  const renderItem = useCallback(
    ({ item: page }: { item: number }) => <Box style={{ width: pageWidth }}>{children(page)}</Box>,
    [pageWidth, children],
  );

  // 시작 위치는 네이티브가 뷰를 만들 때 바로 적용하는 contentOffset으로 준다. initialScrollIndex만 두면
  // 목록이 콘텐츠 크기를 받은 뒤 JS가 scrollTo를 보내는데, 앱을 다시 열 때처럼 네이티브 contentSize가
  // 아직 0이면 그 명령이 0으로 잘려 260번째 주가 화면 밖에 그려지고 날짜 줄이 빈다.
  // 목록은 너비마다 새로 만들므로 이 값도 너비가 바뀔 때만 다시 계산한다.
  const initialContentOffset = useMemo(
    () => ({ x: currentPageRef.current * pageWidth, y: 0 }),
    [pageWidth],
  );

  return (
    <Box onLayout={handleLayout}>
      {/* 너비가 바뀌면(측정·접기·펼치기) 새 목록으로 현재 페이지에서 시작한다. 이전 오프셋을 그대로 두면
          콘텐츠가 줄어들 때 네이티브가 마지막 페이지(+260주)로 잘라 내 몇 년 뒤 날짜가 선택된다. */}
      <FlatList
        key={pageWidth}
        ref={flatListRef}
        horizontal
        pagingEnabled
        data={PAGES}
        keyExtractor={(page) => String(page)}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        initialScrollIndex={currentPageRef.current}
        contentOffset={initialContentOffset}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollToIndexFailed={(info) => {
          flatListRef.current?.scrollToOffset({
            offset: info.averageItemLength * info.index,
            animated: false,
          });
        }}
        windowSize={5}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
      />
    </Box>
  );
}
