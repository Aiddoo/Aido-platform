import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import { createMockAnalytics, createMockDIContainer } from '@src/shared/__tests__';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { act, renderHook } from '@testing-library/react-native';
import { type PropsWithChildren, useState } from 'react';
import { AppState } from 'react-native';

import { FeedDateProvider, useFeedDateContext } from './feed-date-provider';

const originalCurrentStateDescriptor = Object.getOwnPropertyDescriptor(AppState, 'currentState');

describe('피드 날짜 선택', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      writable: true,
      value: 'active',
    });
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    if (originalCurrentStateDescriptor)
      Object.defineProperty(AppState, 'currentState', originalCurrentStateDescriptor);
  });

  async function setup(initialDate?: string) {
    const onDateChange = jest.fn();
    const container = createMockDIContainer({
      analytics: createMockAnalytics(),
      errorReporter: {
        captureException: jest.fn(),
        captureMessage: jest.fn(),
        addBreadcrumb: jest.fn(),
        setUserId: jest.fn(),
      },
    });
    const wrapper = ({ children }: PropsWithChildren) => {
      const [date, setDate] = useState(initialDate);
      return (
        <StaticDIProvider container={container}>
          <LocalDateProvider>
            <FeedDateProvider
              date={date}
              onDateChange={(value) => {
                onDateChange(value);
                setDate(value);
              }}
            >
              {children}
            </FeedDateProvider>
          </LocalDateProvider>
        </StaticDIProvider>
      );
    };
    return { ...(await renderHook(() => useFeedDateContext(), { wrapper })), onDateChange };
  }

  test('날짜를 지정한 딥링크는 처음부터 지정한 날짜를 보여준다', async () => {
    // Given
    jest.setSystemTime(new Date(2026, 6, 15, 12));
    // When
    const { result, onDateChange } = await setup('2026-07-13');
    // Then
    expect(result.current.selectedDateKey).toBe('2026-07-13');
    expect(onDateChange).not.toHaveBeenCalled();
  });

  test.each([undefined, 'today'])(
    '오늘 보기 모드 %s는 자정 뒤 새 오늘을 따라간다',
    async (date) => {
      // Given
      jest.setSystemTime(new Date(2026, 6, 14, 23, 59, 59, 900));
      const { result, onDateChange } = await setup(date);
      // When
      await act(() => jest.advanceTimersByTime(200));
      // Then
      expect(result.current.selectedDateKey).toBe('2026-07-15');
      expect(onDateChange).not.toHaveBeenCalled();
    },
  );

  test.each(['2026-07-13', '2026-07-16'])(
    '직접 고른 날짜 %s는 자정이 지나도 유지한다',
    async (date) => {
      // Given
      jest.setSystemTime(new Date(2026, 6, 14, 23, 59, 59, 900));
      const { result, onDateChange } = await setup(date);
      const selectedDate = result.current.selectedDate;
      // When
      await act(() => jest.advanceTimersByTime(200));
      // Then
      expect(result.current.selectedDateKey).toBe(date);
      expect(result.current.selectedDate).toBe(selectedDate);
      expect(onDateChange).not.toHaveBeenCalled();
    },
  );

  test('오늘 버튼을 누르면 고정 날짜를 해제하고 다음 자정도 따라간다', async () => {
    // Given
    jest.setSystemTime(new Date(2026, 6, 14, 23, 59, 59, 900));
    const { result, onDateChange } = await setup('2026-07-13');
    // When
    await act(() => result.current.setSelectedDate(new Date(2026, 6, 14)));
    await act(() => jest.advanceTimersByTime(200));
    // Then
    expect(onDateChange).toHaveBeenCalledWith(undefined);
    expect(result.current.selectedDateKey).toBe('2026-07-15');
  });
});
