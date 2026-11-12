import { Box } from '@src/shared/ui';
import { range } from 'es-toolkit';
import { type ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import { FlatList, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

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
  /** 달력이 잰 쪽 너비. 주·월을 바꿀 때마다 새로 재지 않도록 바깥에서 받는다 */
  pageWidth: number;
  onChange: (page: number) => void;
  children: (page: number) => ReactNode;
}

export function CalendarPager({ value, pageWidth, onChange, children }: CalendarPagerProps) {
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

  // initialScrollIndex만 두면 다시 열 때 네이티브 contentSize가 0이라 scrollTo가 잘려 날짜 줄이 빈다. contentOffset으로 준다
  const initialContentOffset = useMemo(
    // oxlint-disable-next-line react/refs -- 목록을 새로 만들 때 한 번만 지금 쪽을 시작 위치로 읽는다
    () => ({ x: currentPageRef.current * pageWidth, y: 0 }),
    [pageWidth],
  );

  // 너비마다 새 목록으로 지금 쪽에서 시작한다. 같은 목록이면 이전 픽셀 오프셋이 남아, 폭이 반 아래로 줄 때(Duo 분할)
  // 새 목록 폭을 넘어 네이티브가 마지막 쪽(+260주, 5년 뒤)으로 잘라 그 주가 선택된다(792e95e2b)
  return (
    <FlatList
      key={pageWidth}
      ref={flatListRef}
      horizontal
      pagingEnabled
      data={PAGES}
      keyExtractor={(page) => String(page)}
      renderItem={renderItem}
      getItemLayout={getItemLayout}
      // oxlint-disable-next-line react/refs -- 위 contentOffset과 같은 이유로 새 목록의 시작 쪽만 정한다
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
      // 애니메이션으로 넘기는 최대 거리(MAX_ANIMATED_PAGE_JUMP = 2쪽)까지 미리 그려 넘기는 중 빈 쪽이 보이지 않게 한다
      windowSize={5}
      // 보기를 바꾼 첫 프레임에는 보이는 쪽만 그리고, 양옆 쪽은 다음 배치에서 채운다
      initialNumToRender={1}
      maxToRenderPerBatch={2}
    />
  );
}
