import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import type { ErrorReporter } from '@src/core/ports/error-reporter';
import { createMockAnalytics, createMockDIContainer } from '@src/shared/__tests__';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { act, renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { AppState } from 'react-native';

import { FeedDateProvider, useFeedDateContext } from './feed-date-provider';

const mockSetParams = jest.fn();
const mockNavigation = { setParams: mockSetParams };
let mockRouteDate: string | undefined;

jest.mock('expo-router', () => ({
  useNavigation: () => mockNavigation,
  useGlobalSearchParams: () => ({ date: mockRouteDate }),
}));

const originalCurrentStateDescriptor = Object.getOwnPropertyDescriptor(AppState, 'currentState');

function createMockErrorReporter(): jest.Mocked<ErrorReporter> {
  return {
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    addBreadcrumb: jest.fn(),
    setUserId: jest.fn(),
  };
}

describe('FeedDateProvider', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockSetParams.mockReset();
    mockRouteDate = undefined;
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      writable: true,
      value: 'active',
    });
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  });

  afterEach(() => {
    jest.useRealTimers();
    if (originalCurrentStateDescriptor) {
      Object.defineProperty(AppState, 'currentState', originalCurrentStateDescriptor);
    }
  });

  async function setup() {
    const analytics = createMockAnalytics();
    const errorReporter = createMockErrorReporter();
    const wrapper = ({ children }: PropsWithChildren) => (
      <StaticDIProvider container={createMockDIContainer({ analytics, errorReporter })}>
        <LocalDateProvider>
          <FeedDateProvider>{children}</FeedDateProvider>
        </LocalDateProvider>
      </StaticDIProvider>
    );

    return { ...(await renderHook(() => useFeedDateContext(), { wrapper })), errorReporter };
  }

  it('콜드 스타트의 과거 route 날짜를 표시하지 않고 오늘로 정규화한다', async () => {
    jest.setSystemTime(new Date(2026, 6, 15, 0, 0, 1));
    mockRouteDate = '2026-07-14';

    const { result, errorReporter } = await setup();

    expect(result.current.selectedDateKey).toBe('2026-07-15');
    expect(mockSetParams).toHaveBeenCalledWith({ date: undefined });
    expect(errorReporter.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'navigation',
        data: expect.objectContaining({ reason: 'initial_route', previousDate: '2026-07-14' }),
      }),
    );
  });

  it('사용자가 과거 날짜를 보고 있어도 자정이 지나면 즉시 새 오늘로 돌아간다', async () => {
    jest.setSystemTime(new Date(2026, 6, 14, 23, 59, 59, 900));
    const { result, errorReporter } = await setup();
    await act(() => {
      result.current.setSelectedDate(new Date(2026, 6, 13, 12));
    });
    expect(result.current.selectedDateKey).toBe('2026-07-13');

    await act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(result.current.selectedDateKey).toBe('2026-07-15');
    expect(mockSetParams).toHaveBeenLastCalledWith({ date: undefined });
    expect(errorReporter.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'navigation',
        data: expect.objectContaining({ reason: 'day_changed', nextDate: '2026-07-15' }),
      }),
    );
  });

  it('route 정규화 실패가 오늘 날짜 표시를 중단시키지 않는다', async () => {
    jest.setSystemTime(new Date(2026, 6, 15, 0, 0, 1));
    mockRouteDate = '2026-07-14';
    mockSetParams.mockImplementation(() => {
      throw new Error('navigation unavailable');
    });

    const { result, errorReporter } = await setup();

    expect(result.current.selectedDateKey).toBe('2026-07-15');
    expect(errorReporter.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'navigation unavailable' }),
      expect.objectContaining({ method: 'FeedDateProvider.setRouteDate' }),
    );
  });
});
