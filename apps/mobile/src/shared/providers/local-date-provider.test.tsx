import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import {
  createAnalyticsStub,
  createAppLifecycleGatewayStub,
  createErrorReporterStub,
  createTestDi,
} from '@src/testing/core';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { act, renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { LocalDateProvider, useLocalDate } from './local-date-provider';

interface FakeDeviceCalendar {
  timezone: string;
}

const PROCESS_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

describe('앱 로컬 날짜 Provider', () => {
  setupFakeTimersPerTest();

  async function setup(
    device: FakeDeviceCalendar = { timezone: PROCESS_TIMEZONE },
    { notifiesCalendarChange = true }: { notifiesCalendarChange?: boolean } = {},
  ) {
    const analytics = createAnalyticsStub();
    const errorReporter = createErrorReporterStub();
    const appLifecycle = createAppLifecycleGatewayStub();
    // Android처럼 시간대만 바뀌면 달력 변경 신호가 없어 처음 받은 달력 객체를 계속 돌려준다
    const unchangedCalendar = { timeZone: device.timezone };
    const useDeviceCalendar = notifiesCalendarChange
      ? () => ({ timeZone: device.timezone })
      : () => unchangedCalendar;

    const di = createTestDi({ ports: { analytics, appLifecycle, errorReporter } });
    // 시험 대상인 Provider에 기기 달력을 넣어야 해 직접 감싼다
    const wrapper = ({ children }: PropsWithChildren) => (
      <StaticDIProvider container={di}>
        <LocalDateProvider
          useDeviceCalendar={useDeviceCalendar}
          readDeviceTimezone={() => device.timezone}
        >
          {children}
        </LocalDateProvider>
      </StaticDIProvider>
    );
    const hook = await renderHook(() => useLocalDate(), { wrapper });

    return {
      ...hook,
      analytics,
      errorReporter,
      appLifecycle,
    };
  }

  it('앱이 활성 상태인 채 자정을 지나면 새 로컬 날짜를 즉시 제공한다', async () => {
    // Given
    jest.setSystemTime(new Date(2026, 6, 14, 23, 59, 59, 900));
    const { result, analytics, errorReporter } = await setup();
    expect(result.current.currentLocalDateKey).toBe('2026-07-14');

    // When
    await act(() => {
      jest.advanceTimersByTime(200);
    });

    // Then
    expect(result.current.currentLocalDateKey).toBe('2026-07-15');
    expect(analytics.trackEvent).toHaveBeenCalledWith('local_day_changed', {
      trigger: 'midnight_timer',
    });
    expect(errorReporter.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'lifecycle',
        data: expect.objectContaining({
          previousDate: '2026-07-14',
          nextDate: '2026-07-15',
        }),
      }),
    );
  });

  it('백그라운드에서 날짜가 바뀐 뒤 foreground 복귀 시 즉시 보정한다', async () => {
    // Given
    jest.setSystemTime(new Date(2026, 6, 14, 12));
    const { result, analytics, appLifecycle } = await setup();

    // When
    await act(() => {
      appLifecycle.emit('background');
      jest.setSystemTime(new Date(2026, 6, 15, 0, 0, 1));
      appLifecycle.emit('active');
    });

    // Then
    expect(result.current.currentLocalDateKey).toBe('2026-07-15');
    expect(analytics.trackEvent).toHaveBeenCalledWith('local_day_changed', {
      trigger: 'foreground',
    });
  });

  it('날짜가 같아도 기기 시간대가 바뀌면 현재 상태를 갱신한다', async () => {
    // Given
    jest.setSystemTime(new Date('2026-07-14T00:00:00.000Z'));
    const device: FakeDeviceCalendar = { timezone: 'Asia/Seoul' };
    const { result, analytics, rerender } = await setup(device);
    const previousDate = result.current.currentLocalDate;

    // When
    device.timezone = 'Asia/Tokyo';
    await rerender({});

    // Then
    expect(result.current.currentLocalDateKey).toBe('2026-07-14');
    expect(result.current.currentTimezone).toBe('Asia/Tokyo');
    expect(result.current.currentLocalDate).not.toBe(previousDate);
    expect(analytics.trackEvent).not.toHaveBeenCalled();
  });

  it('달력 변경 신호 없이 기기 시간대만 바뀌어도 앱으로 돌아오면 새 시간대의 오늘로 바꾼다', async () => {
    // Given
    // 서울 11-18 09:00이자 뉴욕 11-17 19:00인 순간
    jest.setSystemTime(new Date('2026-11-18T00:00:00.000Z'));
    const device: FakeDeviceCalendar = { timezone: 'Asia/Seoul' };
    const { result, appLifecycle } = await setup(device, { notifiesCalendarChange: false });
    expect(result.current.currentLocalDateKey).toBe('2026-11-18');

    // When
    await act(() => {
      appLifecycle.emit('background');
      device.timezone = 'America/New_York';
      appLifecycle.emit('active');
    });

    // Then
    expect(result.current.currentTimezone).toBe('America/New_York');
    expect(result.current.currentLocalDateKey).toBe('2026-11-17');
  });

  it('앱을 켠 채 기기 시간대만 바뀌면 옛 시간대의 자정 타이머에서 새 시간대로 다시 읽는다', async () => {
    // Given
    // 서울 11-18 23:59:59.9. 이때 뉴욕은 11-18 09:59:59.9다
    jest.setSystemTime(new Date('2026-11-18T14:59:59.900Z'));
    const device: FakeDeviceCalendar = { timezone: 'Asia/Seoul' };
    const { result } = await setup(device, { notifiesCalendarChange: false });
    device.timezone = 'America/New_York';

    // When
    await act(() => {
      jest.advanceTimersByTime(200);
    });

    // Then
    expect(result.current.currentTimezone).toBe('America/New_York');
    expect(result.current.currentLocalDateKey).toBe('2026-11-18');
  });

  it('관측 어댑터 실패가 날짜 변경을 중단시키지 않는다', async () => {
    // Given
    jest.setSystemTime(new Date(2026, 6, 14, 23, 59, 59, 900));
    const { result, analytics, errorReporter } = await setup();
    analytics.trackEvent.mockImplementation(() => {
      throw new Error('analytics unavailable');
    });
    errorReporter.captureException.mockImplementation(() => {
      throw new Error('reporter unavailable');
    });

    // When
    await act(() => {
      jest.advanceTimersByTime(200);
    });

    // Then
    expect(result.current.currentLocalDateKey).toBe('2026-07-15');
    expect(errorReporter.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'analytics unavailable' }),
      expect.objectContaining({ method: 'LocalDateProvider.trackLocalDateChanged' }),
    );
  });

  it('언마운트 시 앱 수명 구독과 자정 타이머를 모두 정리한다', async () => {
    // Given
    jest.setSystemTime(new Date(2026, 6, 14, 23, 59, 59, 900));
    const { unmount, appLifecycle, analytics } = await setup();

    // When
    await unmount();
    await act(() => {
      jest.advanceTimersByTime(200);
    });

    // Then
    expect(appLifecycle.getListenerCount()).toBe(0);
    expect(analytics.trackEvent).not.toHaveBeenCalled();
  });
});
