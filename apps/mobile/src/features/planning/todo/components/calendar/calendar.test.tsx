import '@src/shared/i18n/init';
import { writeStoredValue } from '@src/shared/storage/define-stored-value';
import {
  createMemoryObservableSyncStorage,
  createRouteParamsFake,
  createTestDi,
  setupFakeTimersPerTest,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import {
  type CalendarViewMode,
  calendarViewModeStoredValue,
} from '../../schemas/calendar-view-mode-storage.schema';
import { Calendar } from './calendar';
import { CALENDAR_CENTER_PAGE } from './calendar-pager';

// 오늘과 겹치지 않게 지난 해의 날을 고른다
const SELECTED_DATE = '2020-03-11';
const DAYS_PER_MONTH_PAGE = 42;
// iPad 13 QA에서 잰 폭: 전체 화면 목록 칸 400, 사이드바를 연 목록 칸 680(400 + 사이드바 280), 윈도우형 700 창의 목록 칸 320
const FULL_SCREEN_PAGE_WIDTH_PT = 400;
const SIDEBAR_LIST_WIDTH_PT = 680;
const WINDOWED_PAGE_WIDTH_PT = 320;
const PAGER_HEIGHT_PT = 56;
const VIEW_MODES = ['week', 'month'] as const satisfies readonly CalendarViewMode[];
// 반 폭은 792e95e2b의 Duo 분할이다. 옛 오프셋(260 × 800)이 새 콘텐츠 폭(521 × 380)을 넘는다
const WIDTH_CHANGES = [
  { name: '넓게 → 좁게 → 넓게', firstWidth: 680, nextWidths: [320, 680] },
  { name: '반 아래로(Duo 접기)', firstWidth: 800, nextWidths: [380] },
  { name: '여러 번 연달아', firstWidth: 400, nextWidths: [374, 320, 680, 320, 374, 400] },
];

async function renderCalendar(
  viewMode: CalendarViewMode,
  params: Record<string, string> = { date: SELECTED_DATE },
) {
  createRouteParamsFake(params);
  const syncStorage = createMemoryObservableSyncStorage();
  writeStoredValue(syncStorage, calendarViewModeStoredValue, viewMode);
  await renderScreen(<Calendar />, {
    di: createTestDi({ ports: { syncStorage } }),
    withLocalDate: true,
  });

  return { syncStorage };
}

function countRouteParamsReads() {
  return jest.mocked(useLocalSearchParams).mock.calls.length;
}

function getPager() {
  return screen.getByTestId('calendar-pager');
}

/** 쪽 너비는 쪽 목록을 감싼 칸에서 잰다 */
async function layoutPager(width: number) {
  const pagerBox = getPager().parent;
  if (pagerBox == null) {
    throw new Error('달력 쪽 목록을 감싼 칸을 찾지 못했어요');
  }
  await fireEvent(pagerBox, 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width, height: PAGER_HEIGHT_PT } },
  });
}

/** 네이티브는 넘기지 않아도 뷰가 창에서 떨어질 때·멈춘 scrollTo 끝에 지금 위치로 스크롤 끝을 보낸다 */
function createScrollEndEvent({
  offsetX,
  viewportWidth,
}: {
  offsetX: number;
  viewportWidth: number;
}) {
  return {
    nativeEvent: {
      contentOffset: { x: offsetX, y: 0 },
      layoutMeasurement: { width: viewportWidth, height: PAGER_HEIGHT_PT },
    },
  };
}

/** 쪽 너비를 미루는 동안 옛 폭(fromWidth)의 목록이 이미 새 폭(toWidth)이 된 뷰포트에서 스크롤 끝을 보낸 뒤 새 폭을 잰다 */
async function resizePagerAfterStaleScrollEnd({
  page,
  fromWidth,
  toWidth,
}: {
  page: number;
  fromWidth: number;
  toWidth: number;
}) {
  await fireEvent(
    getPager(),
    'momentumScrollEnd',
    createScrollEndEvent({ offsetX: page * fromWidth, viewportWidth: toWidth }),
  );
  await layoutPager(toWidth);
}

describe('Calendar', () => {
  it('월 보기에서 다른 날을 누르면 그 날을 URL에 담고 선택을 옮긴다', async () => {
    // Given
    await renderCalendar('month');
    jest.mocked(useLocalSearchParams).mockClear();

    // When
    await fireEvent.press(screen.getByRole('button', { name: '2020년 3월 12일' }));

    // Then
    expect(router.setParams).toHaveBeenCalledWith({ date: '2020-03-12' });
    expect(screen.getByRole('button', { name: '2020년 3월 12일' })).toBeSelected();
    expect(screen.getByRole('button', { name: '2020년 3월 11일' })).not.toBeSelected();
    expect(countRouteParamsReads()).toBeLessThan(DAYS_PER_MONTH_PAGE);
  });

  it.each<{ viewMode: CalendarViewMode; name: string; date: string }>([
    { viewMode: 'week', name: '이전 주', date: '2020-03-01' },
    { viewMode: 'week', name: '다음 주', date: '2020-03-15' },
    { viewMode: 'month', name: '이전 달', date: '2020-02-01' },
    { viewMode: 'month', name: '다음 달', date: '2020-04-01' },
  ])('$viewMode 보기의 "$name" 버튼은 이름대로 옮긴다', async ({ viewMode, name, date }) => {
    // Given
    await renderCalendar(viewMode);

    // When
    await fireEvent.press(screen.getByRole('button', { name }));

    // Then
    expect(router.setParams).toHaveBeenCalledWith({ date });
  });

  describe('창 폭이 바뀔 때', () => {
    it.each(
      VIEW_MODES.flatMap((viewMode) => WIDTH_CHANGES.map((change) => ({ viewMode, ...change }))),
    )(
      '$viewMode 보기에서 폭을 $name 바꿔도 날짜를 바꾸지 않고 고른 날의 쪽을 보인다',
      async ({ viewMode, firstWidth, nextWidths }) => {
        // Given
        await renderCalendar(viewMode);
        await layoutPager(firstWidth);

        // When
        // 폭마다 옛 폭의 목록이 새 뷰포트에서 스크롤 끝을 보낸 뒤 새 폭으로 바뀐다
        let previousWidth = firstWidth;
        for (const width of nextWidths) {
          await resizePagerAfterStaleScrollEnd({
            page: CALENDAR_CENTER_PAGE,
            fromWidth: previousWidth,
            toWidth: width,
          });
          previousWidth = width;
        }

        // Then
        // 고치기 전에는 쪽 × 옛 폭 ÷ 새 폭인 쪽(400 → 320이면 325쪽, 65주 뒤)을 골랐다
        expect(router.setParams).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: '2020년 3월 11일' })).toBeSelected();
      },
    );

    describe('오늘이 2026-11-13이면', () => {
      setupFakeTimersPerTest({ now: new Date(2026, 10, 13, 9) });

      it.each<{ viewMode: CalendarViewMode; date: string }>([
        { viewMode: 'week', date: '2026-11-25' },
        { viewMode: 'month', date: '2027-01-15' },
      ])(
        "$viewMode 보기에서 '오늘'로 넘기는 사이 폭이 바뀌어도 오늘이 있는 쪽을 보인다",
        async ({ viewMode, date }) => {
          // Given
          // 오늘 쪽이 고른 쪽보다 두 쪽 앞이라 '오늘'은 넘기는 애니메이션으로 간다
          await renderCalendar(viewMode, { date });
          await layoutPager(FULL_SCREEN_PAGE_WIDTH_PT);

          // When
          // 넘기기가 이미 좁아진 뷰포트에서 끝나 옛 폭 목록이 스크롤 끝을 보낸 뒤 새 폭으로 바뀐다
          await fireEvent.press(screen.getByText('오늘'));
          await resizePagerAfterStaleScrollEnd({
            page: CALENDAR_CENTER_PAGE - 2,
            fromWidth: FULL_SCREEN_PAGE_WIDTH_PT,
            toWidth: WINDOWED_PAGE_WIDTH_PT,
          });

          // Then
          // 고치기 전에는 258 × 400 ÷ 320 → 323쪽을 골랐다
          expect(screen.getByRole('button', { name: '2026년 11월 13일' })).toBeSelected();
        },
      );

      it("윈도우형으로 바꾸는 사이 옛 목록이 알린 쪽이 반영되지 않아도 '오늘'을 누르면 오늘이 있는 주를 보인다", async () => {
        // Given
        // iPad QA처럼 오늘을 보던 400 폭 목록이 사이드바를 연 목록 폭(680) 뷰포트에서 스크롤 끝을 보내고,
        // 같은 순간 피드 링크가 날짜를 오늘로 다시 열어 고른 날짜는 그대로 오늘이다
        await renderCalendar('week', {});
        await layoutPager(FULL_SCREEN_PAGE_WIDTH_PT);
        await act(async () => {
          getPager().props.onMomentumScrollEnd(
            createScrollEndEvent({
              offsetX: CALENDAR_CENTER_PAGE * FULL_SCREEN_PAGE_WIDTH_PT,
              viewportWidth: SIDEBAR_LIST_WIDTH_PT,
            }),
          );
          router.setParams({ date: undefined });
        });
        await layoutPager(WINDOWED_PAGE_WIDTH_PT);

        // When
        await fireEvent.press(screen.getByText('오늘'));

        // Then
        // 고치기 전에는 머리가 '11월 2주차'인 채 260 × 400 ÷ 680 → 153쪽(2024-10-20 주)이 남았다
        expect(screen.getByRole('button', { name: '2026년 11월 13일' })).toBeSelected();
      });
    });
  });
});
