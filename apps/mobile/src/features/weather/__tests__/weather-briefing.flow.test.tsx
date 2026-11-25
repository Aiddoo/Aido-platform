/**
 * @jest-environment <rootDir>/jest.time-zone-environment.cjs
 * @time-zone Asia/Seoul
 */
import type { Todo as TodoDto } from '@aido/api/contracts/todo/v1';
import type { WeatherReportResponse } from '@aido/api/contracts/weather/v2';
import type { WeatherRescheduleReason } from '@aido/api/vocabulary';
import { ok } from '@src/shared/errors';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import {
  createBriefingDto,
  createHourlySeries,
  createRescheduleOptionDto,
  createWeatherReportDto,
} from './weather-report.fixtures';
import {
  createTodayTodoDto,
  createWeatherHttpClient,
  getTrackedEvents,
  renderWeatherScreen,
  WEATHER_NOW,
} from './weather.test-utils';

jest.unmock('expo-router');

setupFakeTimersPerTest({ now: WEATHER_NOW });

const WALK = createTodayTodoDto({ id: 7, title: '산책', localTime: '16:30' });
const GROCERY = createTodayTodoDto({ id: 8, title: '장보기', localTime: '17:10' });
const RUNNING = createTodayTodoDto({ id: 9, title: '달리기', localTime: '17:20' });
const CAR_WASH = createTodayTodoDto({ id: 10, title: '세차', localTime: '17:40' });

/** 서울 16~18시 */
const TODO_WINDOW = {
  startsAt: '2026-11-02T07:00:00.000Z',
  endsAt: '2026-11-02T09:00:00.000Z',
} as const;

/** 서울 18시(추천)·19시 */
const EVENING_OPTIONS = [
  createRescheduleOptionDto('2026-11-02T09:00:00.000Z', { isRecommended: true }),
  createRescheduleOptionDto('2026-11-02T10:00:00.000Z'),
];

function createAffectedBriefingDto(todos: readonly TodoDto[], reason: WeatherRescheduleReason) {
  return createBriefingDto({
    reason,
    affectedTodoIds: todos.map((todo) => todo.id),
    rescheduleOptions: todos.map((todo) => ({ todoId: todo.id, options: EVENING_OPTIONS })),
  });
}

/** 서버가 그 할 일들이 비와 겹친다고 판단한 리포트 */
function createAffectedReportDto(
  todos: readonly TodoDto[],
  overrides: Partial<WeatherReportResponse> = {},
) {
  return createWeatherReportDto({
    hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [10, 70, 80, 20, 10, 10]),
    briefing: createAffectedBriefingDto(todos, 'rain'),
    headline: { kind: 'todoWet', hazard: 'rain', precipitationChance: 70, window: TODO_WINDOW },
    ...overrides,
  });
}

interface RenderBriefingOptions {
  report: WeatherReportResponse;
  todos?: readonly TodoDto[];
}

async function renderBriefing({ report, todos = [] }: RenderBriefingOptions) {
  const rendered = await renderWeatherScreen({
    httpClient: createWeatherHttpClient({ report: ok(report), todos }),
  });
  // 리포트 칸이 그려진 뒤에 브리핑의 유무를 본다
  await screen.findByLabelText('서울 중구, 지금 12도, 흐림');
  return rendered;
}

describe('WeatherBriefing', () => {
  describe('보이는 조건', () => {
    it('남은 할 일이 날씨와 겹치지 않으면 걱정 없다고 알리고 할 일마다 그 시각의 날씨를 보인다', async () => {
      // When
      const { analytics } = await renderBriefing({
        report: createWeatherReportDto(),
        todos: [WALK],
      });

      // Then
      expect(await screen.findByText('남은 할 일, 날씨 걱정 없어요')).toBeOnTheScreen();
      expect(screen.getByLabelText('산책, 오후 4:30, 흐림, 12°')).toBeOnTheScreen();
      expect(getTrackedEvents(analytics, 'weather_briefing_shown')).toEqual([{ kind: 'dry' }]);
    });

    it('시간이 정해진 남은 할 일이 없으면 없다고 알린다', async () => {
      // When
      await renderBriefing({ report: createWeatherReportDto() });

      // Then
      expect(await screen.findByText('오늘 시간이 정해진 남은 할 일이 없어요')).toBeOnTheScreen();
    });

    it('예보 위치의 벽시계가 기기와 다르면 할 일과 겹쳐 안내하지 않는다', async () => {
      // Given
      const report = createAffectedReportDto([WALK], {
        location: { latitude: 40.7128, longitude: -74.006, timezone: 'America/New_York' },
      });

      // When
      const rendered = await renderWeatherScreen({
        httpClient: createWeatherHttpClient({ report: ok(report), todos: [WALK] }),
      });
      await screen.findByText('해와 달');

      // Then
      expect(screen.queryByText('아이두 브리핑')).not.toBeOnTheScreen();
      expect(rendered.analytics.trackEvent).not.toHaveBeenCalledWith(
        'weather_briefing_shown',
        expect.anything(),
      );
    });

    it('6시간 넘게 낡은 리포트로는 브리핑도 곧 올 비도 안내하지 않는다', async () => {
      // Given
      // 서울 09:20에 받은 리포트를 15:26에 본다
      const report = createAffectedReportDto([WALK], {
        fetchedAt: '2026-11-02T00:20:00.000Z',
        expiresAt: '2026-11-02T00:50:00.000Z',
      });

      // When
      await renderBriefing({ report, todos: [WALK] });
      await screen.findByText('해와 달');

      // Then
      expect(screen.queryByText('아이두 브리핑')).not.toBeOnTheScreen();
      expect(screen.queryByText(/비 올 확률/)).not.toBeOnTheScreen();
    });

    it('서버가 머리글을 정하지 못한 리포트는 브리핑을 그리지 않는다', async () => {
      // When
      await renderBriefing({
        report: createWeatherReportDto({ headline: null }),
        todos: [WALK],
      });
      await screen.findByText('해와 달');

      // Then
      expect(screen.queryByText('아이두 브리핑')).not.toBeOnTheScreen();
    });
  });

  describe('비가 시작됐는가', () => {
    it('오늘 올 비가 아직이면 시작 시각을 알린다', async () => {
      // When
      await renderBriefing({
        report: createWeatherReportDto({
          headline: { kind: 'wetLater', startsAt: '2026-11-02T09:00:00.000Z', isSnow: false },
        }),
        todos: [WALK],
      });

      // Then
      expect(
        await screen.findByText('오후 6시부터 비가 와요. 밖에 나갈 일은 그 전에 끝내두세요'),
      ).toBeOnTheScreen();
      expect(screen.getByLabelText('산책, 오후 4:30, 비 오기 전이에요, 12°')).toBeOnTheScreen();
    });

    it('서버가 알린 시작 시각이 이미 지났으면 지금 오고 있다고 알린다', async () => {
      // When
      await renderBriefing({
        report: createWeatherReportDto({
          headline: { kind: 'wetLater', startsAt: '2026-11-02T06:20:00.000Z', isSnow: false },
        }),
        todos: [WALK],
      });

      // Then
      expect(
        await screen.findByText('지금 비가 오고 있어요. 나갈 땐 우산을 챙겨주세요'),
      ).toBeOnTheScreen();
    });

    it('눈이 이미 시작됐으면 미끄럼을 조심하라고 알린다', async () => {
      // When
      await renderBriefing({
        report: createWeatherReportDto({
          headline: { kind: 'wetLater', startsAt: '2026-11-02T06:20:00.000Z', isSnow: true },
        }),
      });

      // Then
      expect(
        await screen.findByText('지금 눈이 오고 있어요. 나갈 땐 미끄럼에 조심하세요'),
      ).toBeOnTheScreen();
    });
  });

  describe('옮기기 제안', () => {
    it('비와 겹치는 할 일이 있으면 옮기기를 권하고, 누르면 그 할 일들로 옮기기 시트를 연다', async () => {
      // Given
      const { route, analytics } = await renderBriefing({
        report: createAffectedReportDto([WALK, GROCERY]),
        todos: [WALK, GROCERY],
      });
      expect(await screen.findByText('할 일 2개가 비와 겹쳐요')).toBeOnTheScreen();
      expect(
        screen.getByLabelText('산책, 오후 4:30, 오후 6:00엔 비가 안 와요, 70%'),
      ).toBeOnTheScreen();

      // When
      await fireEvent.press(screen.getByText('비 피해서 시간 옮기기'));

      // Then
      await waitFor(() =>
        expect(route.getPathnameWithParams()).toBe('/weather/reschedule?todoIds=7%2C8&reason=rain'),
      );
      expect(getTrackedEvents(analytics, 'weather_reschedule_opened')).toEqual([
        {
          todo_count: 2,
          reason: 'rain',
        },
      ]);
    });

    it('겹치는 할 일 가운데 완료한 것은 줄로 남기되 옮기기 대상에서 뺀다', async () => {
      // Given
      const doneGrocery = createTodayTodoDto({
        id: 8,
        title: '장보기',
        localTime: '17:10',
        completed: true,
      });
      const { route } = await renderBriefing({
        report: createAffectedReportDto([WALK, GROCERY]),
        todos: [WALK, doneGrocery],
      });
      expect(await screen.findByText('장보기')).toBeOnTheScreen();

      // When
      await fireEvent.press(screen.getByText('비 피해서 시간 옮기기'));

      // Then
      await waitFor(() =>
        expect(route.getPathnameWithParams()).toBe('/weather/reschedule?todoIds=7&reason=rain'),
      );
    });

    it('겹치는 할 일을 모두 끝냈으면 옮기기를 권하지 않는다', async () => {
      // When
      await renderBriefing({
        report: createAffectedReportDto([WALK]),
        todos: [createTodayTodoDto({ id: 7, title: '산책', localTime: '16:30', completed: true })],
      });

      // Then
      expect(await screen.findByText('‘산책’ 할 때 비가 올 수 있어요')).toBeOnTheScreen();
      expect(screen.queryByText('비 피해서 시간 옮기기')).not.toBeOnTheScreen();
    });

    it('눈과 겹치면 일찍 나가라고만 알리고 옮기기를 권하지 않는다', async () => {
      // When
      await renderBriefing({
        report: createAffectedReportDto([WALK], {
          headline: {
            kind: 'todoWet',
            hazard: 'snow',
            precipitationChance: 70,
            window: TODO_WINDOW,
          },
        }),
        todos: [WALK],
      });

      // Then
      expect(await screen.findByText('눈길이라 이동이 오래 걸려요')).toBeOnTheScreen();
      expect(screen.queryByText('비 피해서 시간 옮기기')).not.toBeOnTheScreen();
    });

    it('더위와 겹치면 더 선선한 시간으로 옮기기를 권하고 더위를 이유로 시트를 연다', async () => {
      // Given
      const report = createAffectedReportDto([WALK], {
        briefing: createAffectedBriefingDto([WALK], 'heat'),
        headline: { kind: 'todoHot', peakApparentTemperature: 34, window: TODO_WINDOW },
      });
      const { route } = await renderBriefing({ report, todos: [WALK] });

      // When
      await fireEvent.press(await screen.findByText('더 선선한 시간으로 옮기기'));

      // Then
      await waitFor(() =>
        expect(route.getPathnameWithParams()).toBe('/weather/reschedule?todoIds=7&reason=heat'),
      );
    });

    it('겹치는 할 일이 셋을 넘으면 셋만 보이고, 더 보기를 누르면 모두를 담아 시트를 연다', async () => {
      // Given
      const todos = [WALK, GROCERY, RUNNING, CAR_WASH];
      const { route } = await renderBriefing({ report: createAffectedReportDto(todos), todos });
      expect(await screen.findByText('달리기')).toBeOnTheScreen();
      expect(screen.queryByText('세차')).not.toBeOnTheScreen();

      // When
      await fireEvent.press(screen.getByText('외 1개 더 보기'));

      // Then
      await waitFor(() =>
        expect(route.getPathnameWithParams()).toBe(
          '/weather/reschedule?todoIds=7%2C8%2C9%2C10&reason=rain',
        ),
      );
    });
  });

  describe('할 일 줄과 할 일 제안', () => {
    it('내일 비 소식이면 오늘 할 일 추가를 권하고, 누르면 제목을 채워 할 일 추가를 연다', async () => {
      // Given
      const { route, analytics } = await renderBriefing({
        report: createWeatherReportDto({
          headline: { kind: 'wetTomorrow', dayPart: 'morning', isSnow: false },
        }),
      });
      expect(
        await screen.findByText('내일 오전부터 비가 와요. 빨래나 세차는 오늘 해두는 게 좋아요'),
      ).toBeOnTheScreen();

      // When
      await fireEvent.press(screen.getByText('비 오기 전에 할 일 추가'));

      // Then
      await waitFor(() => expect(route.getPathname()).toBe('/todo/new'));
      expect(route.getSearchParams()).toEqual({ date: '2026-11-02', title: '빨래' });
      expect(getTrackedEvents(analytics, 'weather_todo_suggestion_opened')).toEqual([
        {
          reason: 'rain_later',
        },
      ]);
    });

    it('할 일 줄의 체크를 누르면 그 할 일을 오늘 날짜로 완료한다', async () => {
      // Given
      const { httpClient } = await renderBriefing({
        report: createWeatherReportDto(),
        todos: [WALK],
      });
      httpClient.patch.mockResolvedValue(
        ok({ message: '완료했어요', todo: { ...WALK, completed: true } }),
      );

      // When
      await fireEvent.press(await screen.findByRole('checkbox', { name: '산책' }));

      // Then
      await waitFor(() =>
        expect(httpClient.patch).toHaveBeenCalledWith('v1/todos/7/complete', { completed: true }),
      );
    });

    it('할 일 줄을 누르면 그 할 일의 메뉴를 연다', async () => {
      // Given
      const { route } = await renderBriefing({
        report: createWeatherReportDto(),
        todos: [WALK],
      });

      // When
      await fireEvent.press(await screen.findByLabelText('산책, 오후 4:30, 흐림, 12°'));

      // Then
      await waitFor(() => expect(route.getPathname()).toBe('/todo/7/actions'));
      expect(route.getSearchParams()).toEqual({ todoId: '7', date: '2026-11-02' });
    });
  });
});
