import { createMockAnalytics, mockWindowDimensions } from '@src/shared/__tests__';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { act, fireEvent } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { CalendarProvider } from '../providers/calendar-provider';
import { FeedDateProvider } from '../providers/feed-date-provider';
import { Calendar } from './calendar';

const WINDOW_WIDTH = 1000;
const PANE_WIDTH = 400;
const CENTER_PAGE = 260;

const originalCurrentStateDescriptor = Object.getOwnPropertyDescriptor(AppState, 'currentState');

describe('달력 페이저', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date(2026, 9, 26, 3, 32) });
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      writable: true,
      value: 'active',
    });
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
    mockWindowDimensions(WINDOW_WIDTH);
  });
  afterEach(() => {
    jest.useRealTimers();
    if (originalCurrentStateDescriptor) {
      Object.defineProperty(AppState, 'currentState', originalCurrentStateDescriptor);
    }
  });

  async function setup() {
    const onDateChange = jest.fn();
    const screen = await renderUi(
      <LocalDateProvider>
        <FeedDateProvider onDateChange={onDateChange}>
          <CalendarProvider>
            <Calendar />
          </CalendarProvider>
        </FeedDateProvider>
      </LocalDateProvider>,
      {
        di: {
          analytics: createMockAnalytics(),
          errorReporter: {
            captureException: jest.fn(),
            captureMessage: jest.fn(),
            addBreadcrumb: jest.fn(),
            setUserId: jest.fn(),
          },
        },
      },
    );
    const getPager = () => screen.getByTestId('calendar-pager');
    const getPagerBox = () => getPager().parent;

    return { screen, onDateChange, getPager, getPagerBox };
  }

  function scrollEndEvent(offsetX: number, viewportWidth: number) {
    return {
      nativeEvent: {
        contentOffset: { x: offsetX, y: 0 },
        layoutMeasurement: { width: viewportWidth, height: 56 },
        contentSize: { width: viewportWidth * (CENTER_PAGE * 2 + 1), height: 56 },
      },
    };
  }

  test('Duo 분할 pane처럼 창보다 좁은 너비를 측정하면 이전 스크롤 위치를 물려받지 않게 목록을 새로 만든다', async () => {
    // Given: 측정 전 첫 프레임은 창 너비(1000)로 오늘이 있는 가운데 페이지(260×1000)에 놓인다
    const { getPager, getPagerBox } = await setup();
    const beforeLayout = getPager();

    // When: 실제 pane 너비(400)를 측정한다 — 같은 목록이면 오프셋 260×1000이 새 콘텐츠 너비
    // 521×400을 넘어 네이티브가 마지막 페이지(+260주, 5년 뒤)로 잘라 낸다
    const pagerBox = getPagerBox();
    if (pagerBox == null) {
      throw new Error('달력 페이저 컨테이너를 찾지 못했어요');
    }
    await act(async () => {
      fireEvent(pagerBox, 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: PANE_WIDTH, height: 56 } },
      });
    });

    // Then: 새 목록이 측정한 너비로 현재 페이지에서 다시 시작한다
    expect(getPager()).not.toBe(beforeLayout);
  });

  test('측정 전에 스와이프가 끝나도 네이티브 뷰포트 너비로 페이지를 계산해 다음 주로만 이동한다', async () => {
    // Given: 상태의 페이지 너비는 아직 창 너비(1000)지만 실제 뷰포트는 pane 너비(400)다
    const { getPager, onDateChange } = await setup();

    // When: 한 페이지 넘긴 위치에서 스크롤이 끝난다
    await act(async () => {
      fireEvent(
        getPager(),
        'momentumScrollEnd',
        scrollEndEvent((CENTER_PAGE + 1) * PANE_WIDTH, PANE_WIDTH),
      );
    });

    // Then: 오늘(2026-10-26 월)에서 정확히 한 주 뒤 같은 요일로 이동한다
    expect(onDateChange).toHaveBeenLastCalledWith('2026-11-02');
  });
});
