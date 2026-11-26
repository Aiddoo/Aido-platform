/**
 * @jest-environment <rootDir>/jest.time-zone-environment.cjs
 * @time-zone Asia/Seoul
 */
import '@src/shared/i18n/init';
import type { Todo as TodoDto } from '@aido/api/contracts/todo/v1';
import type { WeatherReportResponse } from '@aido/api/contracts/weather/v2';
import type { WeatherRescheduleReason } from '@aido/api/vocabulary';
import type { HttpClient } from '@src/core/ports/http-client';
import { createTodoApiError } from '@src/features/planning/todo/__tests__/todo.fixtures';
import { countGetRequests } from '@src/features/planning/todo/__tests__/todo.test-utils';
import { MINUTE_MS, SECOND_MS } from '@src/shared/constants/time-units';
import { fail, ok } from '@src/shared/errors';
import { createAnalyticsStub, createTestDi, getTrackedEvents } from '@src/testing/core';
import { renderAppRoute } from '@src/testing/render-route-hook';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import { View } from 'react-native';

import WeatherRescheduleSheetRoute from '../../../../app/(app)/weather/reschedule';
import {
  createAffectedBriefingDto,
  createBriefingDto,
  createHourlySeries,
  createRescheduleOptionDto,
  createWeatherReportDto,
} from './weather-report.fixtures';
import {
  createTodayTodoDto,
  createWeatherHttpClient,
  REPORT_PATH,
  respondWeather,
  TODOS_PATH,
  WEATHER_NOW,
  WEATHER_TODAY,
} from './weather.test-utils';

jest.unmock('expo-router');

setupFakeTimersPerTest({ now: WEATHER_NOW });

/** 서울 16:30 산책, 17:10 장보기가 16~18시 비와 겹친다. 20시 빨래는 겹치지 않는다 */
const WALK = createTodayTodoDto({ id: 7, title: '산책', localTime: '16:30' });
const GROCERY = createTodayTodoDto({ id: 8, title: '장보기', localTime: '17:10' });
const LAUNDRY = createTodayTodoDto({ id: 9, title: '빨래', localTime: '20:00' });

/** 서울 18시(추천)·19시 */
const EVENING_OPTIONS = [
  createRescheduleOptionDto('2026-11-02T09:00:00.000Z', { isRecommended: true }),
  createRescheduleOptionDto('2026-11-02T10:00:00.000Z', { apparentTemperature: 7.4 }),
];

/** 서버가 산책·장보기가 날씨와 겹친다고 판단한 브리핑 */
function createWalkAndGroceryBriefingDto(reason: WeatherRescheduleReason) {
  return createAffectedBriefingDto([WALK, GROCERY], reason, EVENING_OPTIONS);
}

function createRainyReportDto(overrides: Partial<WeatherReportResponse> = {}) {
  return createWeatherReportDto({
    hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [10, 70, 80, 20, 10, 10]),
    briefing: createWalkAndGroceryBriefingDto('rain'),
    headline: {
      kind: 'todoWet',
      hazard: 'rain',
      precipitationChance: 70,
      window: { startsAt: '2026-11-02T07:00:00.000Z', endsAt: '2026-11-02T09:00:00.000Z' },
    },
    ...overrides,
  });
}

type HostNode = ReturnType<typeof screen.getByTestId>;

function findLayoutHost(node: HostNode): HostNode | null {
  if ('onLayout' in node.props) {
    return node;
  }
  for (const child of node.children) {
    const found = typeof child === 'string' ? null : findLayoutHost(child);
    if (found != null) {
      return found;
    }
  }
  return null;
}

interface OpenSheetOptions {
  /** 알림·브리핑이 여는 옮기기 링크의 query */
  link: string;
  report?: WeatherReportResponse;
  todos?: readonly TodoDto[];
}

/** 날씨 화면 위에 옮기기 시트를 링크로 연다. 시트 route 모달은 크기를 받은 뒤 내용을 그린다 */
async function openSheet({
  link,
  report = createRainyReportDto(),
  todos = [WALK, GROCERY, LAUNDRY],
}: OpenSheetOptions) {
  const httpClient = createWeatherHttpClient({ report: ok(report), todos });
  const analytics = createAnalyticsStub();
  const route = await renderAppRoute(
    {
      _layout: () => <Stack screenOptions={{ animation: 'none' }} />,
      'weather/index': () => null,
      'weather/reschedule': () => (
        <View testID="sheet-route">
          <WeatherRescheduleSheetRoute />
        </View>
      ),
    },
    {
      url: `/weather/reschedule?${link}`,
      di: createTestDi({ ports: { httpClient, analytics } }),
      withLocalDate: true,
    },
  );
  // 틀린 링크는 시트 route를 그리지 않고 떠난다
  const sheetRoute = screen.queryByTestId('sheet-route');
  const layoutHost = sheetRoute == null ? null : findLayoutHost(sheetRoute);
  if (layoutHost != null) {
    await fireEvent(layoutHost, 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } },
    });
  }
  return { httpClient, analytics, route };
}

function respondScheduleUpdates(
  httpClient: jest.Mocked<HttpClient>,
  todos: readonly TodoDto[] = [WALK, GROCERY],
) {
  httpClient.patch.mockImplementation(async (url) => {
    const todo = todos.find((candidate) => url === `v1/todos/${candidate.id}/schedule`);
    if (todo == null) {
      throw new Error(`respondScheduleUpdates: ${url} 응답을 정하지 않았습니다`);
    }
    return ok({ message: '수정했어요', todo });
  });
}

function getScheduleRequests(httpClient: jest.Mocked<HttpClient>) {
  return httpClient.patch.mock.calls.map(([url, body]) => [url, body]);
}

function getSubmitButton(count: number) {
  return screen.getByRole('button', { name: `${count}개 옮기기` });
}

describe('WeatherRescheduleSheetRoute', () => {
  describe('열기', () => {
    it('알림·브리핑 링크가 가리킨 할 일을 추천 시각이 골라진 채로 보이고 조회는 한 번씩만 한다', async () => {
      // When
      const { httpClient } = await openSheet({ link: 'todoIds=7,8&reason=rain' });

      // Then
      expect(await screen.findByText('비 피해서 시간 옮기기')).toBeOnTheScreen();
      expect(screen.getByText('산책')).toBeOnTheScreen();
      expect(screen.getByText('장보기')).toBeOnTheScreen();
      expect(screen.queryByText('빨래')).not.toBeOnTheScreen();
      expect(screen.getByLabelText('오늘 남은 시간의 시간별 강수 확률 그래프')).toBeOnTheScreen();
      expect(
        screen.getAllByRole('radio', { name: '오후 6:00, 강수 확률 10%', checked: true }),
      ).toHaveLength(2);
      expect(getSubmitButton(2)).toBeEnabled();
      expect(countGetRequests(httpClient)[REPORT_PATH]).toBe(1);
      expect(countGetRequests(httpClient)[TODOS_PATH]).toBe(1);
      expect(countGetRequests(httpClient)['v1/auth/preference']).toBe(1);
    });

    it('링크가 일부만 가리키면 그 할 일만 보인다', async () => {
      // When
      await openSheet({ link: 'todoIds=8&reason=rain' });

      // Then
      expect(await screen.findByText('장보기')).toBeOnTheScreen();
      expect(screen.queryByText('산책')).not.toBeOnTheScreen();
      expect(getSubmitButton(1)).toBeEnabled();
    });

    it('이유가 없는 옛 링크는 비를 피하는 시트로 연다', async () => {
      // When
      await openSheet({ link: 'todoIds=7' });

      // Then
      expect(await screen.findByText('비 피해서 시간 옮기기')).toBeOnTheScreen();
      expect(getSubmitButton(1)).toBeEnabled();
    });

    it('링크의 이유가 지금 브리핑과 다르면 지금 브리핑의 이유로 안내한다', async () => {
      // Given
      const report = createRainyReportDto({ briefing: createWalkAndGroceryBriefingDto('heat') });

      // When
      await openSheet({ link: 'todoIds=7,8&reason=rain', report });

      // Then
      expect(await screen.findByText('더 선선한 시간으로 옮기기')).toBeOnTheScreen();
      expect(screen.getAllByRole('radio', { name: '오후 7:00, 체감 7°' })).toHaveLength(2);
      expect(
        screen.queryByLabelText('오늘 남은 시간의 시간별 강수 확률 그래프'),
      ).not.toBeOnTheScreen();
    });

    it('완료한 할 일은 옮길 목록에서 뺀다', async () => {
      // When
      await openSheet({
        link: 'todoIds=7,8&reason=rain',
        todos: [WALK, { ...GROCERY, completed: true, completedAt: '2026-11-02T05:00:00.000Z' }],
      });

      // Then
      expect(await screen.findByText('산책')).toBeOnTheScreen();
      expect(screen.queryByText('장보기')).not.toBeOnTheScreen();
      expect(getSubmitButton(1)).toBeEnabled();
    });

    it('옮길 시각 후보가 없는 할 일은 피할 시간이 없다고 알리고 세지 않는다', async () => {
      // Given
      const report = createRainyReportDto({
        briefing: createBriefingDto({
          reason: 'rain',
          affectedTodoIds: [WALK.id, GROCERY.id],
          rescheduleOptions: [{ todoId: WALK.id, options: EVENING_OPTIONS }],
        }),
      });

      // When
      await openSheet({ link: 'todoIds=7,8&reason=rain', report });

      // Then
      expect(await screen.findByText('오늘은 비를 피할 시간이 없어요')).toBeOnTheScreen();
      expect(getSubmitButton(1)).toBeEnabled();
    });

    it('지금 날씨와 겹치는 할 일이 없으면 옮길 할 일을 찾지 못했다고 알린다', async () => {
      // When
      await openSheet({
        link: 'todoIds=7,8&reason=rain',
        report: createWeatherReportDto(),
      });

      // Then
      expect(await screen.findByText('옮길 할 일을 찾지 못했어요')).toBeOnTheScreen();
      expect(getSubmitButton(0)).toBeDisabled();
    });

    it('할 일 id가 없는 링크는 시트를 열지 않고 날씨 화면으로 돌린다', async () => {
      // When
      const { route } = await openSheet({ link: 'reason=rain' });

      // Then
      await waitFor(() => expect(route.getPathname()).toBe('/weather'));
    });

    // 버튼은 링크의 할 일 id가 아니라 목록이 보이는 할 일을 센다. 링크가 낡으면 둘이 다르다
    it('링크의 할 일이 낡아 지금 영향받는 할 일을 모두 보일 때 옮기기 버튼도 그 할 일들을 센다', async () => {
      // When
      await openSheet({ link: 'todoIds=99&reason=rain' });

      // Then
      expect(await screen.findByText('산책')).toBeOnTheScreen();
      expect(screen.getByText('장보기')).toBeOnTheScreen();
      expect(getSubmitButton(2)).toBeEnabled();
    });
  });

  describe('하나 빼기', () => {
    it('그대로 두기를 누른 할 일은 목록과 링크에서 빠지고 버튼이 남은 수를 센다', async () => {
      // Given
      const { route } = await openSheet({ link: 'todoIds=7,8&reason=rain' });
      const [keepWalk] = await screen.findAllByText('이 할 일은 그대로 두기');
      if (keepWalk == null) {
        throw new Error('그대로 두기 버튼이 없습니다');
      }

      // When
      await fireEvent.press(keepWalk);

      // Then
      await waitFor(() => expect(screen.queryByText('산책')).not.toBeOnTheScreen());
      expect(screen.getByText('장보기')).toBeOnTheScreen();
      expect(getSubmitButton(1)).toBeEnabled();
      expect(route.getPathnameWithParams()).toBe('/weather/reschedule?todoIds=8&reason=rain');
    });

    it('마지막 하나까지 빼면 시트를 닫고 날씨 화면으로 돌아간다', async () => {
      // Given
      const { route, httpClient } = await openSheet({ link: 'todoIds=8&reason=rain' });

      // When
      await fireEvent.press(await screen.findByText('이 할 일은 그대로 두기'));

      // Then
      await waitFor(() => expect(route.getPathname()).toBe('/weather'));
      expect(httpClient.patch).not.toHaveBeenCalled();
    });

    it('그대로 두기로 하나를 뺀 뒤 옮기면 남은 할 일만 요청에 실린다', async () => {
      // Given
      const { httpClient, analytics, route } = await openSheet({
        link: 'todoIds=7,8&reason=rain',
      });
      respondScheduleUpdates(httpClient);
      const [keepWalk] = await screen.findAllByText('이 할 일은 그대로 두기');
      if (keepWalk == null) {
        throw new Error('그대로 두기 버튼이 없습니다');
      }
      await fireEvent.press(keepWalk);
      await waitFor(() => expect(screen.queryByText('산책')).not.toBeOnTheScreen());

      // When
      await fireEvent.press(getSubmitButton(1));

      // Then
      await waitFor(() => expect(route.getPathname()).toBe('/weather'));
      expect(getScheduleRequests(httpClient)).toEqual([
        [
          'v1/todos/8/schedule',
          { startDate: WEATHER_TODAY, endDate: null, scheduledTime: '18:00', isAllDay: false },
        ],
      ]);
      expect(getTrackedEvents(analytics, 'weather_reschedule_applied')).toEqual([
        { moved_count: 1, reason: 'rain' },
      ]);
    });

    it('뺀 할 일이 리포트를 다시 받아 목록에 돌아오면 전에 고른 시각이 아니라 추천 시각으로 다시 센다', async () => {
      // Given
      const { httpClient, route } = await openSheet({ link: 'todoIds=7,8&reason=rain' });
      respondScheduleUpdates(httpClient);
      const [walkAtSeven] = await screen.findAllByRole('radio', {
        name: '오후 7:00, 강수 확률 10%',
      });
      const [keepWalk] = screen.getAllByText('이 할 일은 그대로 두기');
      if (walkAtSeven == null || keepWalk == null) {
        throw new Error('산책 칸이 없습니다');
      }
      await fireEvent.press(walkAtSeven);
      await fireEvent.press(keepWalk);
      await waitFor(() => expect(screen.queryByText('산책')).not.toBeOnTheScreen());

      // When
      // 남긴 장보기는 더 영향받지 않고 뺀 산책만 영향받는다. 링크의 할 일이 낡아 지금 영향받는 산책을 다시 보인다
      const walkOnly = createBriefingDto({
        reason: 'rain',
        affectedTodoIds: [WALK.id],
        rescheduleOptions: [{ todoId: WALK.id, options: EVENING_OPTIONS }],
      });
      respondWeather(httpClient, {
        report: ok(createRainyReportDto({ briefing: walkOnly })),
        todos: [WALK, GROCERY, LAUNDRY],
      });
      await act(() => route.queryClient.refetchQueries());

      // Then
      expect(await screen.findByText('산책')).toBeOnTheScreen();
      expect(screen.queryByText('장보기')).not.toBeOnTheScreen();
      expect(
        screen.getByRole('radio', { name: '오후 6:00, 강수 확률 10%', checked: true }),
      ).toBeOnTheScreen();

      // When
      await fireEvent.press(getSubmitButton(1));

      // Then
      await waitFor(() => expect(httpClient.patch).toHaveBeenCalledTimes(1));
      expect(getScheduleRequests(httpClient)).toEqual([
        [
          'v1/todos/7/schedule',
          { startDate: WEATHER_TODAY, endDate: null, scheduledTime: '18:00', isAllDay: false },
        ],
      ]);
    });
  });

  describe('옮기기', () => {
    it('고른 시각으로 할 일마다 일정 변경을 보내고, 목록과 리포트를 다시 받은 뒤 닫는다', async () => {
      // Given
      const { httpClient, analytics, route } = await openSheet({
        link: 'todoIds=7,8&reason=rain',
      });
      respondScheduleUpdates(httpClient);
      const [walkAtSeven] = await screen.findAllByRole('radio', {
        name: '오후 7:00, 강수 확률 10%',
      });
      if (walkAtSeven == null) {
        throw new Error('오후 7시 후보가 없습니다');
      }
      await fireEvent.press(walkAtSeven);

      // When
      await fireEvent.press(getSubmitButton(2));

      // Then
      await waitFor(() => expect(route.getPathname()).toBe('/weather'));
      expect(getScheduleRequests(httpClient)).toEqual([
        [
          'v1/todos/7/schedule',
          { startDate: WEATHER_TODAY, endDate: null, scheduledTime: '19:00', isAllDay: false },
        ],
        [
          'v1/todos/8/schedule',
          { startDate: WEATHER_TODAY, endDate: null, scheduledTime: '18:00', isAllDay: false },
        ],
      ]);
      expect(screen.getAllByText('할 일 2개를 옮겼어요')).not.toHaveLength(0);
      expect(getTrackedEvents(analytics, 'weather_reschedule_applied')).toEqual([
        {
          moved_count: 2,
          reason: 'rain',
        },
      ]);
      expect(countGetRequests(httpClient)[TODOS_PATH]).toBe(2);
      expect(countGetRequests(httpClient)[REPORT_PATH]).toBe(2);
    });

    it('옮기기를 같은 프레임에 두 번 눌러도 일정 변경은 할 일마다 한 번만 보낸다', async () => {
      // Given
      const { httpClient, analytics } = await openSheet({ link: 'todoIds=7,8&reason=rain' });
      respondScheduleUpdates(httpClient);
      await screen.findByText('산책');
      const submit = getSubmitButton(2);

      // When
      await act(async () => {
        await fireEvent.press(submit);
        await fireEvent.press(submit);
      });

      // Then
      await waitFor(() => expect(screen.getAllByText('할 일 2개를 옮겼어요')).not.toHaveLength(0));
      expect(httpClient.patch).toHaveBeenCalledTimes(2);
      expect(getTrackedEvents(analytics, 'weather_reschedule_applied')).toEqual([
        { moved_count: 2, reason: 'rain' },
      ]);
    });

    it('되돌리기를 누르면 옮기기 전 날짜와 시각으로 다시 저장한다', async () => {
      // Given
      const { httpClient, analytics } = await openSheet({ link: 'todoIds=7,8&reason=rain' });
      respondScheduleUpdates(httpClient);
      await screen.findByText('산책');
      await fireEvent.press(getSubmitButton(2));
      const [undo] = await screen.findAllByText('되돌리기');
      if (undo == null) {
        throw new Error('되돌리기 버튼이 없습니다');
      }
      httpClient.patch.mockClear();

      // When
      await fireEvent.press(undo);

      // Then
      await waitFor(() =>
        expect(screen.getAllByText('원래 시간으로 되돌렸어요')).not.toHaveLength(0),
      );
      expect(getScheduleRequests(httpClient)).toEqual([
        [
          'v1/todos/7/schedule',
          { startDate: WEATHER_TODAY, endDate: null, scheduledTime: '16:30', isAllDay: false },
        ],
        [
          'v1/todos/8/schedule',
          { startDate: WEATHER_TODAY, endDate: null, scheduledTime: '17:10', isAllDay: false },
        ],
      ]);
      expect(getTrackedEvents(analytics, 'weather_reschedule_undone')).toEqual([
        {
          moved_count: 2,
          reason: 'rain',
        },
      ]);
    });

    it('시트를 연 채 고른 시각이 지나면 옮기지 않고 다음 후보로 바꿔 다시 확인받는다', async () => {
      // Given
      // 서울 16시(추천)·18시 후보. 15:26에 열어 16:06까지 둔다
      const options = [
        createRescheduleOptionDto('2026-11-02T07:00:00.000Z', { isRecommended: true }),
        createRescheduleOptionDto('2026-11-02T09:00:00.000Z'),
      ];
      const report = createRainyReportDto({
        briefing: createBriefingDto({
          reason: 'rain',
          affectedTodoIds: [WALK.id],
          rescheduleOptions: [{ todoId: WALK.id, options }],
        }),
      });
      const { httpClient, route } = await openSheet({ link: 'todoIds=7&reason=rain', report });
      respondScheduleUpdates(httpClient);
      expect(
        await screen.findByRole('radio', { name: '오후 4:00, 강수 확률 10%', checked: true }),
      ).toBeOnTheScreen();
      await act(() => jest.advanceTimersByTimeAsync(40 * MINUTE_MS));

      // When
      await fireEvent.press(getSubmitButton(1));

      // Then
      expect(
        await screen.findAllByText(
          '시간이 지나서 다른 시간으로 바꿨어요. 확인하고 다시 눌러주세요',
        ),
      ).not.toHaveLength(0);
      expect(httpClient.patch).not.toHaveBeenCalled();
      expect(
        screen.getByRole('radio', { name: '오후 6:00, 강수 확률 10%', checked: true }),
      ).toBeOnTheScreen();

      // When
      // 안내를 읽고 바뀐 시각을 확인한 뒤 다시 누른다
      await act(() => jest.advanceTimersByTimeAsync(SECOND_MS));
      await fireEvent.press(getSubmitButton(1));

      // Then
      await waitFor(() => expect(route.getPathname()).toBe('/weather'));
      expect(getScheduleRequests(httpClient)).toEqual([
        [
          'v1/todos/7/schedule',
          { startDate: WEATHER_TODAY, endDate: null, scheduledTime: '18:00', isAllDay: false },
        ],
      ]);
    });

    it('모두 실패하면 시트를 닫지 않고 한 번만 알린다', async () => {
      // Given
      const { httpClient, analytics, route } = await openSheet({
        link: 'todoIds=7,8&reason=rain',
      });
      httpClient.patch.mockResolvedValue(fail(createTodoApiError({ status: 500 })));
      await screen.findByText('산책');

      // When
      await fireEvent.press(getSubmitButton(2));

      // Then
      await waitFor(() => expect(httpClient.patch).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(getSubmitButton(2)).toBeEnabled());
      expect(route.getPathname()).toBe('/weather/reschedule');
      expect(screen.queryByText('할 일 2개를 옮겼어요')).not.toBeOnTheScreen();
      expect(analytics.trackEvent).not.toHaveBeenCalledWith(
        'weather_reschedule_applied',
        expect.anything(),
      );
    });

    it('일부만 실패하면 옮긴 수만 알리고 닫는다', async () => {
      // Given
      const { httpClient, analytics, route } = await openSheet({
        link: 'todoIds=7,8&reason=rain',
      });
      httpClient.patch.mockImplementation(async (url) =>
        url === 'v1/todos/7/schedule'
          ? ok({ message: '수정했어요', todo: WALK })
          : fail(createTodoApiError({ status: 500 })),
      );
      await screen.findByText('산책');

      // When
      await fireEvent.press(getSubmitButton(2));

      // Then
      await waitFor(() => expect(route.getPathname()).toBe('/weather'));
      expect(screen.getAllByText('할 일 1개를 옮겼어요')).not.toHaveLength(0);
      expect(getTrackedEvents(analytics, 'weather_reschedule_applied')).toEqual([
        {
          moved_count: 1,
          reason: 'rain',
        },
      ]);
    });
  });
});
