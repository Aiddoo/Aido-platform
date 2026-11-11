import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { createAnalyticsStub, createErrorReporterStub, createTestDi } from '@src/testing/core';
import { act, renderHook } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { AppState } from 'react-native';

import { useFeedDateKey } from './use-feed-params';

const originalCurrentStateDescriptor = Object.getOwnPropertyDescriptor(AppState, 'currentState');

describe('피드 날짜 선택', () => {
  beforeEach(() => {
    // oxlint-disable-next-line jest/no-restricted-jest-methods -- 1.15.2 전환 #1400
    jest.useFakeTimers();
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      writable: true,
      value: 'active',
    });
    // oxlint-disable-next-line aido/test-spy-target -- 1.15.2 전환 #1400
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  });
  afterEach(() => {
    // oxlint-disable-next-line jest/no-restricted-jest-methods -- 1.15.2 전환 #1400
    jest.useRealTimers();
    jest.restoreAllMocks();
    if (originalCurrentStateDescriptor) {
      Object.defineProperty(AppState, 'currentState', originalCurrentStateDescriptor);
    }
  });

  async function setup(initialDate?: string) {
    let date = initialDate;
    jest.mocked(useLocalSearchParams).mockImplementation(() => ({ date }));
    jest.mocked(router.setParams).mockImplementation((next) => {
      date = typeof next?.date === 'string' ? next.date : undefined;
    });
    const container = createTestDi({
      analytics: createAnalyticsStub(),
      errorReporter: createErrorReporterStub(),
    });
    const wrapper = ({ children }: PropsWithChildren) => (
      <StaticDIProvider container={container}>
        <LocalDateProvider>{children}</LocalDateProvider>
      </StaticDIProvider>
    );
    const rendered = await renderHook(
      () => {
        const [selectedDateKey, setSelectedDateKey] = useFeedDateKey();
        return { selectedDateKey, setSelectedDateKey };
      },
      { wrapper },
    );
    return { ...rendered, readDate: () => date };
  }

  it('날짜를 지정한 딥링크는 처음부터 지정한 날짜를 보여준다', async () => {
    // Given
    jest.setSystemTime(new Date(2026, 6, 15, 12));
    // When
    const { result } = await setup('2026-07-13');
    // Then
    expect(result.current.selectedDateKey).toBe('2026-07-13');
    expect(router.setParams).not.toHaveBeenCalled();
  });

  it.each([undefined, 'today'])('오늘 보기 모드 %s는 자정 뒤 새 오늘을 따라간다', async (date) => {
    // Given
    jest.setSystemTime(new Date(2026, 6, 14, 23, 59, 59, 900));
    const { result } = await setup(date);
    // When
    await act(() => jest.advanceTimersByTimeAsync(200));
    // Then
    expect(result.current.selectedDateKey).toBe('2026-07-15');
    expect(router.setParams).not.toHaveBeenCalled();
  });

  it.each(['2026-07-13', '2026-07-16'])(
    '직접 고른 날짜 %s는 자정이 지나도 유지한다',
    async (date) => {
      // Given
      jest.setSystemTime(new Date(2026, 6, 14, 23, 59, 59, 900));
      const { result } = await setup(date);
      // When
      await act(() => jest.advanceTimersByTimeAsync(200));
      // Then
      expect(result.current.selectedDateKey).toBe(date);
      expect(router.setParams).not.toHaveBeenCalled();
    },
  );

  it('오늘 버튼을 누르면 고정 날짜를 해제하고 다음 자정도 따라간다', async () => {
    // Given
    jest.setSystemTime(new Date(2026, 6, 14, 23, 59, 59, 900));
    const { result, rerender, readDate } = await setup('2026-07-13');
    // When
    await act(() => result.current.setSelectedDateKey('2026-07-14'));
    await rerender({});
    await act(() => jest.advanceTimersByTimeAsync(200));
    // Then
    expect(readDate()).toBeUndefined();
    expect(result.current.selectedDateKey).toBe('2026-07-15');
  });

  it('다른 날을 고르면 그 날짜를 URL에 남긴다', async () => {
    // Given
    jest.setSystemTime(new Date(2026, 6, 14, 12));
    const { result, rerender, readDate } = await setup();
    // When
    await act(() => result.current.setSelectedDateKey('2026-07-20'));
    await rerender({});
    // Then
    expect(readDate()).toBe('2026-07-20');
    expect(result.current.selectedDateKey).toBe('2026-07-20');
  });

  it.each(['내일', '2026-13-40', ''])('잘못된 날짜 %s는 오늘로 읽는다', async (date) => {
    // Given
    jest.setSystemTime(new Date(2026, 6, 14, 12));
    // When
    const { result } = await setup(date);
    // Then
    expect(result.current.selectedDateKey).toBe('2026-07-14');
  });
});
