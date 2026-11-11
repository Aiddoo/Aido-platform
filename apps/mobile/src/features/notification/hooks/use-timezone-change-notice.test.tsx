import {
  createTodoDto,
  createTodoListResponseDto,
} from '@src/features/planning/todo/__tests__/todo.fixtures';
import { readStoredValue, writeStoredValue } from '@src/shared/storage/define-stored-value';
import {
  createAnalyticsStub,
  createHttpClientStub,
  createMemoryObservableSyncStorage,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { act, screen } from '@testing-library/react-native';
import { getCalendars } from 'expo-localization';

import type { DeviceTimezone } from '../domains/device-timezone.model';
import { deviceTimezoneStoredValue } from '../schemas/device-timezone-storage.schema';
import { useTimezoneChangeNotice } from './use-timezone-change-notice';

const USER_ID = 'user-1';
const NOW = new Date('2026-11-05T12:00:00.000Z');
const NOTICE_TITLE = '할 일 알림 시간을 지금 시간대에 맞췄어요';

// 이 프로세스 시간대에서 크게 멀어진 곳에서 왔다. 오프셋은 기기 시계에서 읽어 시간대 이름과 따로 논다
const FAR_AWAY = { timeZone: 'Asia/Seoul', offsetMinutes: -NOW.getTimezoneOffset() + 13 * 60 };

const upcomingTimedTodo = createTodoDto({
  completed: false,
  startDate: '2026-11-10',
  scheduledLocalTime: '10:00',
  scheduledTime: '2026-11-10T15:00:00.000Z',
  isAllDay: false,
});

function setDeviceTimeZone(timeZone: string) {
  jest
    .mocked(getCalendars)
    .mockReturnValue([{ calendar: null, uses24hourClock: false, firstWeekday: 1, timeZone }]);
}

interface ProbeProps {
  accountId: string | null;
  reportCount: number;
}

function Probe(props: ProbeProps) {
  useTimezoneChangeNotice(props);
  return null;
}

function setup(todos: ReturnType<typeof createTodoDto>[]) {
  const analytics = createAnalyticsStub();
  const httpClient = createHttpClientStub();
  httpClient.get.mockResolvedValue({
    ok: true,
    value: createTodoListResponseDto({ items: todos }),
  });
  const getTodos = httpClient.get;
  const syncStorage = createMemoryObservableSyncStorage();
  const di = { analytics, httpClient, syncStorage };
  const recordedTimezone = {
    find: () => readStoredValue(syncStorage, deviceTimezoneStoredValue)?.deviceTimezone,
    save: (deviceTimezone: DeviceTimezone) =>
      writeStoredValue(syncStorage, deviceTimezoneStoredValue, { userId: USER_ID, deviceTimezone }),
  };
  return { analytics, recordedTimezone, getTodos, di };
}

async function report(di: ReturnType<typeof setup>['di'], accountId: string | null = USER_ID) {
  const rendered = await renderScreen(<Probe accountId={accountId} reportCount={1} />, {
    di,
    withLocalDate: true,
  });
  await act(() => jest.advanceTimersByTimeAsync(0));
  return {
    rerender: async (props: ProbeProps) => {
      await rendered.rerender(<Probe {...props} />);
      await act(() => jest.advanceTimersByTimeAsync(0));
    },
  };
}

describe('useTimezoneChangeNotice', () => {
  setupFakeTimersPerTest({ now: NOW });

  beforeEach(() => {
    setDeviceTimeZone('America/New_York');
  });

  afterEach(() => {
    setDeviceTimeZone('UTC');
  });

  it('처음 저장할 때는 안내하지 않고 요청도 하지 않는다', async () => {
    // Given
    const { di, getTodos, analytics, recordedTimezone } = setup([upcomingTimedTodo]);

    // When
    await report(di);

    // Then
    expect(screen.queryByText(NOTICE_TITLE)).toBeNull();
    expect(getTodos).not.toHaveBeenCalled();
    expect(analytics.trackEvent).not.toHaveBeenCalled();
    expect(recordedTimezone.find()?.timeZone).toBe('America/New_York');
  });

  it('시간대가 바뀌었고 앞으로 시간 있는 할 일이 있으면 한 번만 안내한다', async () => {
    // Given
    const { di, recordedTimezone, analytics } = setup([upcomingTimedTodo]);
    recordedTimezone.save(FAR_AWAY);

    // When
    const { rerender } = await report(di);
    await rerender({ accountId: USER_ID, reportCount: 2 });

    // Then
    expect(screen.getAllByText(NOTICE_TITLE).length).toBeGreaterThan(0);
    expect(screen.getAllByText('오전 10시 할 일은 여기서도 오전 10시예요').length).toBeGreaterThan(
      0,
    );
    expect(analytics.trackEvent).toHaveBeenCalledTimes(1);
    expect(analytics.trackEvent).toHaveBeenCalledWith('device_timezone_changed', {
      offset_bucket: '8h_plus',
      notice_shown: true,
    });
  });

  it.each([
    { name: '할 일이 없다', todos: [] },
    {
      name: '종일 할 일뿐이다',
      todos: [
        createTodoDto({
          startDate: '2026-11-10',
          scheduledLocalTime: null,
          scheduledTime: null,
          isAllDay: true,
        }),
      ],
    },
    { name: '완료한 할 일뿐이다', todos: [{ ...upcomingTimedTodo, completed: true }] },
    {
      name: '오늘 이미 지난 시각뿐이다',
      todos: [{ ...upcomingTimedTodo, startDate: '2026-11-05', scheduledLocalTime: '06:00' }],
    },
  ])('$name: 값은 저장하고 안내는 하지 않는다', async ({ todos }) => {
    // Given
    const { di, recordedTimezone, analytics } = setup(todos);
    recordedTimezone.save(FAR_AWAY);

    // When
    await report(di);

    // Then
    expect(screen.queryByText(NOTICE_TITLE)).toBeNull();
    expect(recordedTimezone.find()?.timeZone).toBe('America/New_York');
    expect(analytics.trackEvent).toHaveBeenCalledWith('device_timezone_changed', {
      offset_bucket: '8h_plus',
      notice_shown: false,
    });
  });

  it('이름만 다른 같은 오프셋이면 안내하지 않고 할 일을 묻지 않는다', async () => {
    // Given
    setDeviceTimeZone('Asia/Tokyo');
    const { di, recordedTimezone, getTodos, analytics } = setup([upcomingTimedTodo]);
    const offsetMinutes = -NOW.getTimezoneOffset();
    recordedTimezone.save({ timeZone: 'Asia/Seoul', offsetMinutes });

    // When
    await report(di);

    // Then
    expect(screen.queryByText(NOTICE_TITLE)).toBeNull();
    expect(getTodos).not.toHaveBeenCalled();
    expect(analytics.trackEvent).toHaveBeenCalledWith('device_timezone_changed', {
      offset_bucket: 'same',
      notice_shown: false,
    });
  });

  it('내 정보를 읽기 전에 보고가 끝나도 계정을 알게 된 뒤 판단한다', async () => {
    // Given
    const { di, recordedTimezone } = setup([upcomingTimedTodo]);
    recordedTimezone.save(FAR_AWAY);

    // When
    const { rerender } = await report(di, null);
    const before = screen.queryAllByText(NOTICE_TITLE).length;
    await rerender({ accountId: USER_ID, reportCount: 1 });

    // Then
    expect(before).toBe(0);
    expect(screen.getAllByText(NOTICE_TITLE).length).toBeGreaterThan(0);
  });

  it('할 일을 읽지 못하면 안내 없이 넘어가고 다시 묻지 않는다', async () => {
    // Given
    const { di, recordedTimezone, getTodos } = setup([upcomingTimedTodo]);
    recordedTimezone.save(FAR_AWAY);
    getTodos.mockRejectedValueOnce(new Error('offline'));

    // When
    const { rerender } = await report(di);
    await rerender({ accountId: USER_ID, reportCount: 2 });

    // Then
    expect(screen.queryByText(NOTICE_TITLE)).toBeNull();
    expect(getTodos).toHaveBeenCalledTimes(1);
  });
});
