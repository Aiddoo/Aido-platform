import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import type { Logger } from '@src/core/ports/logger';
import {
  createTodoDto,
  createTodoListResponseDto,
} from '@src/features/planning/todo/__tests__/todo.factories';
import { TodoService } from '@src/features/planning/todo/apis/todo.service';
import {
  createMemorySyncStorage,
  createMockAnalytics,
  createMockDIContainer,
  createMockHttpClient,
} from '@src/shared/__tests__';
import { act, renderHook } from '@testing-library/react-native';
import { getCalendars } from 'expo-localization';
import type { PropsWithChildren } from 'react';

import { createDeviceTimezoneRepository } from '../apis/device-timezone.repository';
import { DeviceTimezoneService } from '../apis/device-timezone.service';
import { useTimezoneChangeNotice } from './use-timezone-change-notice';

const mockToast = jest.fn();

jest.mock('@src/shared/hooks/use-app-toast', () => ({
  useAppToast: () => ({ toast: mockToast }),
}));

const silentLogger: Logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
const USER_ID = 'user-1';
const NOW = new Date('2026-11-05T12:00:00.000Z');

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

function setup(todos: ReturnType<typeof createTodoDto>[]) {
  const analytics = createMockAnalytics();
  const repository = createDeviceTimezoneRepository(createMemorySyncStorage());
  const httpClient = createMockHttpClient();
  httpClient.get.mockResolvedValue({
    ok: true,
    value: createTodoListResponseDto({ items: todos }),
  });
  const getTodos = httpClient.get;
  const container = createMockDIContainer({
    analytics,
    logger: silentLogger,
    deviceTimezoneService: new DeviceTimezoneService(repository),
    todoService: new TodoService(httpClient),
  });
  const wrapper = ({ children }: PropsWithChildren) => (
    <StaticDIProvider container={container}>{children}</StaticDIProvider>
  );
  return { analytics, repository, getTodos, wrapper };
}

async function report(
  wrapper: ({ children }: PropsWithChildren) => React.JSX.Element,
  accountId: string | null = USER_ID,
) {
  const hook = await renderHook(
    (props: { accountId: string | null; reportCount: number }) => useTimezoneChangeNotice(props),
    { wrapper, initialProps: { accountId, reportCount: 1 } },
  );
  await act(() => jest.advanceTimersByTimeAsync(0));
  return hook;
}

describe('useTimezoneChangeNotice', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    mockToast.mockClear();
    setDeviceTimeZone('America/New_York');
  });

  afterEach(() => {
    jest.useRealTimers();
    setDeviceTimeZone('UTC');
  });

  it('처음 저장할 때는 안내하지 않고 요청도 하지 않는다', async () => {
    // Given
    const { wrapper, getTodos, analytics, repository } = setup([upcomingTimedTodo]);

    // When
    await report(wrapper);

    // Then
    expect(mockToast).not.toHaveBeenCalled();
    expect(getTodos).not.toHaveBeenCalled();
    expect(analytics.trackEvent).not.toHaveBeenCalled();
    expect(repository.get(USER_ID)?.timeZone).toBe('America/New_York');
  });

  it('시간대가 바뀌었고 앞으로 시간 있는 할 일이 있으면 한 번만 안내한다', async () => {
    // Given
    const { wrapper, repository, analytics } = setup([upcomingTimedTodo]);
    repository.save(USER_ID, FAR_AWAY);

    // When
    const { rerender } = await report(wrapper);
    await rerender({ accountId: USER_ID, reportCount: 2 });
    await act(() => jest.advanceTimersByTimeAsync(0));

    // Then
    expect(mockToast).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith(
      '할 일 알림 시간을 지금 시간대에 맞췄어요',
      expect.objectContaining({ description: '오전 10시 할 일은 여기서도 오전 10시예요' }),
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
    const { wrapper, repository, analytics } = setup(todos);
    repository.save(USER_ID, FAR_AWAY);

    // When
    await report(wrapper);

    // Then
    expect(mockToast).not.toHaveBeenCalled();
    expect(repository.get(USER_ID)?.timeZone).toBe('America/New_York');
    expect(analytics.trackEvent).toHaveBeenCalledWith('device_timezone_changed', {
      offset_bucket: '8h_plus',
      notice_shown: false,
    });
  });

  it('이름만 다른 같은 오프셋이면 안내하지 않고 할 일을 묻지 않는다', async () => {
    // Given
    setDeviceTimeZone('Asia/Tokyo');
    const { wrapper, repository, getTodos, analytics } = setup([upcomingTimedTodo]);
    const offsetMinutes = -NOW.getTimezoneOffset();
    repository.save(USER_ID, { timeZone: 'Asia/Seoul', offsetMinutes });

    // When
    await report(wrapper);

    // Then
    expect(mockToast).not.toHaveBeenCalled();
    expect(getTodos).not.toHaveBeenCalled();
    expect(analytics.trackEvent).toHaveBeenCalledWith('device_timezone_changed', {
      offset_bucket: 'same',
      notice_shown: false,
    });
  });

  it('내 정보를 읽기 전에 보고가 끝나도 계정을 알게 된 뒤 판단한다', async () => {
    // Given
    const { wrapper, repository } = setup([upcomingTimedTodo]);
    repository.save(USER_ID, FAR_AWAY);

    // When
    const { rerender } = await report(wrapper, null);
    const before = mockToast.mock.calls.length;
    await rerender({ accountId: USER_ID, reportCount: 1 });
    await act(() => jest.advanceTimersByTimeAsync(0));

    // Then
    expect(before).toBe(0);
    expect(mockToast).toHaveBeenCalledTimes(1);
  });

  it('할 일을 읽지 못하면 안내 없이 넘어가고 다시 묻지 않는다', async () => {
    // Given
    const { wrapper, repository, getTodos } = setup([upcomingTimedTodo]);
    repository.save(USER_ID, FAR_AWAY);
    getTodos.mockRejectedValueOnce(new Error('offline'));

    // When
    const { rerender } = await report(wrapper);
    await rerender({ accountId: USER_ID, reportCount: 2 });
    await act(() => jest.advanceTimersByTimeAsync(0));

    // Then
    expect(mockToast).not.toHaveBeenCalled();
    expect(getTodos).toHaveBeenCalledTimes(1);
  });
});
