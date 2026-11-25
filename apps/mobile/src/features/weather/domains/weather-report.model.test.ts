import type {
  WeatherAlert as WeatherAlertDto,
  WeatherNextHourPeriod,
} from '@aido/api/contracts/weather/v2';
import { fromEpochMs, toEpochMs, toInstant } from '@src/shared/date/instant';
import { range } from 'es-toolkit';

import {
  createBriefingDto,
  createBriefingTodo,
  createHourlyForecasts,
  createHourlySeries,
  createRescheduleOptionDto,
  createSeoulReportDto,
  createTokyoReportDto,
  createWeatherReport,
  createWeatherReportDto,
  createWeatherReportWithHours,
} from '../__tests__/weather-report.fixtures';
import { toWeatherReport } from '../apis/weather.mapper';
import { WeatherAlertPolicy } from './weather-alert.model';
import { WeatherReportPolicy } from './weather-report.model';

/** 서울 15:26 */
const NOW = toInstant('2026-11-02T06:26:00.000Z');

function createPeriod(overrides: Partial<WeatherNextHourPeriod> = {}): WeatherNextHourPeriod {
  return {
    condition: 'PRECIPITATION',
    precipitationType: 'RAIN',
    startsAt: '2026-11-02T06:43:00.000Z',
    endsAt: null,
    precipitationChance: 80,
    precipitationIntensity: 2.4,
    ...overrides,
  };
}

const NEXT_HOUR_MINUTES = [
  { startsAt: '2026-11-02T06:26:00.000Z', precipitationChance: 10, precipitationIntensity: 0 },
  { startsAt: '2026-11-02T07:25:00.000Z', precipitationChance: 80, precipitationIntensity: 2 },
];

function createAlert(overrides: Partial<WeatherAlertDto>): WeatherAlertDto {
  return {
    id: 'alert',
    title: '호우주의보',
    severity: 'MODERATE',
    source: '기상청',
    areaName: '서울',
    effectiveAt: '2026-11-02T05:00:00.000Z',
    expiresAt: '2026-11-02T12:00:00.000Z',
    detailsUrl: 'https://example.com/alert',
    ...overrides,
  };
}

const DRY_CLOUDY = { condition: 'CLOUDY', precipitationChance: 10 } as const;
const RAIN = { condition: 'RAIN', precipitationChance: 80, precipitationType: 'RAIN' } as const;

/** 16~18시(07:00Z~09:00Z) 비, 나머지는 맑다. */
const HOURLY = createHourlySeries('2026-11-02T06:00:00.000Z', [10, 70, 80, 20, 10, 30, 10, 10, 60]);
/** 서버가 16:30(07:30Z) 할 일 1이 비와 겹친다고 보고 19시를 추천한다 */
const RAIN_ON_TODO_1 = createBriefingDto({
  reason: 'rain',
  affectedTodoIds: [1],
  rescheduleOptions: [
    {
      todoId: 1,
      options: [createRescheduleOptionDto('2026-11-02T10:00:00.000Z', { isRecommended: true })],
    },
  ],
});
/** 서버가 고른 16~17시(07:00Z~09:00Z) 날씨 시간 */
const TODO_WINDOW = { startsAt: '2026-11-02T07:00:00.000Z', endsAt: '2026-11-02T09:00:00.000Z' };
const RAINY_HEADLINE = {
  kind: 'todoWet',
  hazard: 'rain',
  precipitationChance: 70,
  window: TODO_WINDOW,
} as const;
const rainyReport = createWeatherReport({
  hourly: HOURLY,
  briefing: RAIN_ON_TODO_1,
  headline: RAINY_HEADLINE,
});
const DRY_HOURS = range(9).map(() => ({ precipitationChance: 10 }));

/** 서버가 16:30 할 일 1만 비와 겹친다고 보고 19시·21시를 후보로 고른다 */
const SERVER_BRIEFING = createBriefingDto({
  reason: 'rain',
  affectedTodoIds: [1],
  rescheduleOptions: [
    {
      todoId: 1,
      options: [
        createRescheduleOptionDto('2026-11-02T10:00:00.000Z', { isRecommended: true }),
        createRescheduleOptionDto('2026-11-02T12:00:00.000Z'),
      ],
    },
  ],
});
const rescheduleReport = createWeatherReport({ hourly: HOURLY, briefing: SERVER_BRIEFING });

describe('WeatherReportPolicy', () => {
  describe('getTimezone', () => {
    it('예보 위치의 시간대를 돌려준다', () => {
      // Given
      const tokyo = toWeatherReport(createTokyoReportDto());

      // When
      const timezone = WeatherReportPolicy.getTimezone(tokyo);

      // Then
      expect(timezone).toBe('Asia/Tokyo');
    });

    it('런타임이 시간대 이름을 몰라 비어 있으면 서비스 기본 시간대로 읽는다', () => {
      // Given
      const report = createWeatherReport();
      const unknown = { ...report, location: { ...report.location, timezone: null } };
      // 서울 자정 직후(UTC로는 전날)
      const justAfterSeoulMidnight = toInstant('2026-09-30T15:05:00Z');

      // When
      const timezone = WeatherReportPolicy.getTimezone(unknown);
      const todayKey = WeatherReportPolicy.getTodayKey(unknown, justAfterSeoulMidnight);

      // Then
      expect(timezone).toBe('Asia/Seoul');
      expect(todayKey).toBe('2026-10-01');
    });
  });

  describe('getTodayKey', () => {
    const seoul = createWeatherReport({
      location: { latitude: 37.5, longitude: 127, timezone: 'Asia/Seoul' },
    });
    const losAngeles = createWeatherReport({
      location: { latitude: 34, longitude: -118, timezone: 'America/Los_Angeles' },
    });

    it('같은 순간도 자정 직전과 정각에 지역 날짜가 바뀐다', () => {
      // Given
      // 서울 자정 1밀리초 전과 정각
      const before = toInstant('2026-11-02T14:59:59.999Z');
      const at = toInstant('2026-11-02T15:00:00.000Z');

      // When
      const keyBefore = WeatherReportPolicy.getTodayKey(seoul, before);
      const keyAt = WeatherReportPolicy.getTodayKey(seoul, at);

      // Then
      expect(keyBefore).toBe('2026-11-02');
      expect(keyAt).toBe('2026-11-03');
    });

    it('서머타임이 끝나는 날 LA 자정은 07:00Z에서 08:00Z로 밀리지 않고 날짜 key가 이어진다', () => {
      // Given
      // LA는 2026-11-01 02:00에 서머타임이 끝난다
      const beforeEnd = toInstant('2026-11-01T08:59:59.999Z');
      const afterEnd = toInstant('2026-11-01T09:00:00.000Z');
      const nextMidnight = toInstant('2026-11-02T08:00:00.000Z');

      // When
      const keyBeforeEnd = WeatherReportPolicy.getTodayKey(losAngeles, beforeEnd);
      const keyAfterEnd = WeatherReportPolicy.getTodayKey(losAngeles, afterEnd);
      const keyNextMidnight = WeatherReportPolicy.getTodayKey(losAngeles, nextMidnight);

      // Then
      expect(keyBeforeEnd).toBe('2026-11-01');
      expect(keyAfterEnd).toBe('2026-11-01');
      expect(keyNextMidnight).toBe('2026-11-02');
    });

    it('오늘 날짜는 기기가 아니라 예보 위치 시간대로 정한다', () => {
      // Given
      // 서울 자정 직후(UTC로는 전날)
      const report = createWeatherReport();
      const justAfterSeoulMidnight = toInstant('2026-09-30T15:05:00Z');

      // When
      const key = WeatherReportPolicy.getTodayKey(report, justAfterSeoulMidnight);

      // Then
      expect(key).toBe('2026-10-01');
    });
  });

  describe('findToday', () => {
    const createDays = (...dates: string[]) =>
      dates.flatMap((date) => createWeatherReportDto().daily.map((day) => ({ ...day, date })));
    const report = createWeatherReport({ daily: createDays('2026-11-01', '2026-11-02') });

    it('위치 시간대의 오늘 예보를 고른다', () => {
      // When
      // 06:26Z는 서울 11월 2일 15:26이다
      const today = WeatherReportPolicy.findToday(report, NOW);

      // Then
      expect(today?.date).toBe('2026-11-02');
    });

    it('서울 자정 직전에는 그날, 자정에는 다음 날 예보를 고른다', () => {
      // Given
      const beforeMidnight = toInstant('2026-11-01T14:59:59.000Z');
      const atMidnight = toInstant('2026-11-01T15:00:00.000Z');

      // When
      const before = WeatherReportPolicy.findToday(report, beforeMidnight);
      const after = WeatherReportPolicy.findToday(report, atMidnight);

      // Then
      expect([before?.date, after?.date]).toEqual(['2026-11-01', '2026-11-02']);
    });

    it('일별 예보에 오늘이 없으면 첫 예보를 오늘처럼 쓴다', () => {
      // Given
      const lagging = createWeatherReport({ daily: createDays('2026-11-03', '2026-11-04') });

      // When
      const today = WeatherReportPolicy.findToday(lagging, NOW);

      // Then
      expect(today?.date).toBe('2026-11-03');
    });

    it('일별 예보가 없으면 null이다', () => {
      // Given
      const empty = createWeatherReport({ daily: [] });

      // When
      const today = WeatherReportPolicy.findToday(empty, NOW);

      // Then
      expect(today).toBeNull();
    });
  });

  describe('getFreshForMs', () => {
    it.each([
      {
        at: '2026-11-02T06:20:00.000Z',
        expiresAt: '2026-11-02T06:50:00.000Z',
        expected: 1_800_000,
      },
      { at: '2026-11-02T06:49:30.000Z', expiresAt: '2026-11-02T06:50:00.000Z', expected: 30_000 },
      { at: '2026-11-02T06:55:00.000Z', expiresAt: '2026-11-02T06:50:00.000Z', expected: 0 },
      { at: '2026-11-02T06:20:00.000Z', expiresAt: undefined, expected: 0 },
    ])(
      '$at에 만료 $expiresAt 리포트는 $expected ms 동안 같은 리포트다',
      ({ at, expiresAt, expected }) => {
        // Given
        const report = createWeatherReport({ expiresAt });

        // When
        const freshForMs = WeatherReportPolicy.getFreshForMs(report, toInstant(at));

        // Then
        expect(freshForMs).toBe(expected);
      },
    );
  });

  describe('isStale', () => {
    it('예산 절약으로 서버가 2시간 둔 리포트는 받은 지 1시간이 지나도 만료 전이라 안내하지 않는다', () => {
      // Given
      const report = createWeatherReport({
        fetchedAt: '2026-11-02T06:20:00.000Z',
        expiresAt: '2026-11-02T08:20:00.000Z',
      });

      // When
      const stale = WeatherReportPolicy.isStale(report, toInstant('2026-11-02T07:20:00.000Z'));

      // Then
      expect(stale).toBe(false);
    });

    it.each([
      { now: '2026-11-02T06:51:00.000Z', expected: false },
      { now: '2026-11-02T06:52:00.000Z', expected: false },
      { now: '2026-11-02T06:52:00.001Z', expected: true },
    ])(
      '06:50 만료 리포트는 다시 받는 동안(2분)은 두고 $now에 오래됨 $expected다',
      ({ now, expected }) => {
        // Given
        const report = createWeatherReport({ expiresAt: '2026-11-02T06:50:00.000Z' });

        // When
        const stale = WeatherReportPolicy.isStale(report, toInstant(now));

        // Then
        expect(stale).toBe(expected);
      },
    );

    it('공급자 장애로 받은 마지막 리포트(만료 없음)는 받자마자 오래된 정보로 안내한다', () => {
      // Given
      const report = createWeatherReport({ expiresAt: undefined });

      // When
      const stale = WeatherReportPolicy.isStale(report, toInstant('2026-11-02T06:21:00.000Z'));

      // Then
      expect(stale).toBe(true);
    });
  });

  describe('isNowcastExpired', () => {
    it.each([
      { now: '2026-11-02T12:20:00.000Z', expected: false },
      { now: '2026-11-02T12:20:01.000Z', expected: true },
    ])(
      '받은 지 6시간 경계에서 $now에는 곧 올 비 안내를 숨기는지가 $expected다',
      ({ now, expected }) => {
        // Given
        const report = createWeatherReport({ fetchedAt: '2026-11-02T06:20:00.000Z' });

        // When
        const expired = WeatherReportPolicy.isNowcastExpired(report, toInstant(now));

        // Then
        expect(expired).toBe(expected);
      },
    );

    it('7시간 전에 받은 리포트를 다시 열면 곧 올 비 안내도 만료된다', () => {
      // Given
      const restored = createWeatherReport({ fetchedAt: '2026-11-02T06:00:00.000Z' });
      const reopenedAt = toInstant('2026-11-02T13:10:00.000Z');

      // When
      const expired = WeatherReportPolicy.isNowcastExpired(restored, reopenedAt);

      // Then
      expect(expired).toBe(true);
    });
  });

  describe('getUpcomingHours', () => {
    it('지금이 속한 시간부터 남기고 이미 지난 시간은 뺀다', () => {
      // Given
      const report = createWeatherReport({
        hourly: createHourlySeries('2026-11-02T05:00:00.000Z', [10, 10, 10]),
      });

      // When
      const hours = WeatherReportPolicy.getUpcomingHours(report, NOW);

      // Then
      expect(hours.map((hour) => hour.startsAt)).toEqual([
        '2026-11-02T06:00:00.000Z',
        '2026-11-02T07:00:00.000Z',
      ]);
    });

    it('받은 시각이 아니라 지금 이후 시간만 남겨 지난 시간 칸을 보이지 않는다', () => {
      // Given
      // 06:00~13:00 시간별 예보를 13:10에 다시 연다
      const restored = createWeatherReport({
        hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [10, 10, 10, 10, 10, 10, 10, 10]),
      });
      const reopenedAt = toInstant('2026-11-02T13:10:00.000Z');

      // When
      const hours = WeatherReportPolicy.getUpcomingHours(restored, reopenedAt);

      // Then
      expect(hours.map((hour) => hour.startsAt)).toEqual(['2026-11-02T13:00:00.000Z']);
    });
  });

  describe('getActiveAlerts', () => {
    it('만료된 특보만 빼고 서버가 정한 심각도 순서는 바꾸지 않는다', () => {
      // Given
      const report = createWeatherReport({
        alerts: [
          createAlert({
            id: 'expired',
            severity: 'EXTREME',
            expiresAt: '2026-11-02T06:00:00.000Z',
          }),
          createAlert({ id: 'severe', severity: 'SEVERE' }),
          createAlert({ id: 'minor', severity: 'MINOR' }),
        ],
      });

      // When
      const alerts = WeatherReportPolicy.getActiveAlerts(report, NOW);

      // Then
      expect(alerts.map((alert) => alert.id)).toEqual(['severe', 'minor']);
    });

    it('발효 전인 특보는 남기되 아직 발효되지 않은 것으로 구분한다', () => {
      // Given
      const report = createWeatherReport({
        alerts: [createAlert({ id: 'upcoming', effectiveAt: '2026-11-02T09:00:00.000Z' })],
      });

      // When
      const [alert] = WeatherReportPolicy.getActiveAlerts(report, NOW);

      // Then
      expect(alert?.id).toBe('upcoming');
      expect(alert != null && WeatherAlertPolicy.isInEffect(alert, NOW)).toBe(false);
    });

    it('국내처럼 특보가 없는 지역은 빈 목록이다', () => {
      // Given
      const report = toWeatherReport(createSeoulReportDto());

      // When
      const alerts = WeatherReportPolicy.getActiveAlerts(report, NOW);

      // Then
      expect(alerts).toEqual([]);
    });

    it('도쿄 리포트의 유효한 특보는 남긴다', () => {
      // Given
      const report = toWeatherReport(createTokyoReportDto());

      // When
      const alerts = WeatherReportPolicy.getActiveAlerts(report, NOW);

      // Then
      expect(alerts).toHaveLength(1);
    });
  });

  describe('getPrecipitationWindow', () => {
    it('분 단위 예보에서 비가 시작되면 시작 시각과 시간별 예보로 찾은 그침 시각을 함께 반환한다', () => {
      // Given
      const report = createWeatherReport({
        nextHour: { periods: [createPeriod()], minutes: NEXT_HOUR_MINUTES },
        hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [80, 80, 20, 10]),
      });

      // When
      const window = WeatherReportPolicy.getPrecipitationWindow(report, NOW);

      // Then
      expect(window).toEqual({
        kind: 'upcoming',
        precision: 'minute',
        precipitationType: 'RAIN',
        startsAt: toInstant('2026-11-02T06:43:00.000Z'),
        endsAt: toInstant('2026-11-02T08:00:00.000Z'),
        endPrecision: 'hour',
        isEndingOnLaterDay: false,
      });
    });

    it('비 구간이 이미 시작됐으면 지금 오는 비로 보고 구간 끝 시각을 그침 시각으로 쓴다', () => {
      // Given
      const report = createWeatherReport({
        nextHour: {
          periods: [
            createPeriod({
              startsAt: '2026-11-02T06:20:00.000Z',
              endsAt: '2026-11-02T06:50:00.000Z',
            }),
          ],
          minutes: NEXT_HOUR_MINUTES,
        },
      });

      // When
      const window = WeatherReportPolicy.getPrecipitationWindow(report, NOW);

      // Then
      expect(window).toEqual({
        kind: 'ongoing',
        precipitationType: 'RAIN',
        endsAt: toInstant('2026-11-02T06:50:00.000Z'),
        endPrecision: 'minute',
        isEndingOnLaterDay: false,
      });
    });

    it('비가 예보 범위 끝까지 이어지면 그침 시각 없이 시작 시각만 반환한다', () => {
      // Given
      const report = createWeatherReport({
        nextHour: { periods: [createPeriod()], minutes: NEXT_HOUR_MINUTES },
        hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [80, 80, 80, 80]),
      });

      // When
      const window = WeatherReportPolicy.getPrecipitationWindow(report, NOW);

      // Then
      expect(window).toMatchObject({ kind: 'upcoming', endsAt: null, isEndingOnLaterDay: false });
    });

    it('이미 끝난 비 구간은 건너뛰고 분 단위 예보 이후의 시간별 예보를 본다', () => {
      // Given
      const report = createWeatherReport({
        nextHour: {
          periods: [
            createPeriod({
              startsAt: '2026-11-02T06:00:00.000Z',
              endsAt: '2026-11-02T06:20:00.000Z',
            }),
          ],
          minutes: NEXT_HOUR_MINUTES,
        },
        hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [80, 10, 10, 10]),
      });

      // When
      const window = WeatherReportPolicy.getPrecipitationWindow(report, NOW);

      // Then
      expect(window).toEqual({ kind: 'dry' });
    });

    it('분 단위 예보가 없는 지역은 시간별 예보로 비가 시작·그치는 시간을 정한다', () => {
      // Given
      const report = createWeatherReport({
        nextHour: null,
        hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [10, 80, 80, 10]),
      });

      // When
      const window = WeatherReportPolicy.getPrecipitationWindow(report, NOW);

      // Then
      expect(window).toEqual({
        kind: 'upcoming',
        precision: 'hour',
        precipitationType: 'RAIN',
        startsAt: toInstant('2026-11-02T07:00:00.000Z'),
        endsAt: toInstant('2026-11-02T09:00:00.000Z'),
        endPrecision: 'hour',
        isEndingOnLaterDay: false,
      });
    });

    it('분 단위 예보가 없고 지금 시간대에 비가 오면 지금 오는 비로 본다', () => {
      // Given
      const report = createWeatherReport({
        nextHour: null,
        hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [80, 10]),
      });

      // When
      const window = WeatherReportPolicy.getPrecipitationWindow(report, NOW);

      // Then
      expect(window).toMatchObject({
        kind: 'ongoing',
        endsAt: toInstant('2026-11-02T07:00:00.000Z'),
      });
    });

    it('비 예보가 없으면 맑은 상태를 반환한다', () => {
      // Given
      const report = createWeatherReport({
        nextHour: null,
        hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [10, 20, 30, 40]),
      });

      // When
      const window = WeatherReportPolicy.getPrecipitationWindow(report, NOW);

      // Then
      expect(window).toEqual({ kind: 'dry' });
    });

    it.each([
      { timezone: 'Asia/Seoul', expected: true },
      { timezone: 'Asia/Tokyo', expected: true },
      { timezone: 'Europe/London', expected: false },
    ])(
      '위치 시간대가 $timezone이면 비가 자정을 넘겨 그치는지는 $expected다',
      ({ timezone, expected }) => {
        // Given
        const now = toInstant('2026-11-02T14:26:00.000Z');
        const report = createWeatherReport({
          location: { latitude: 0, longitude: 0, timezone },
          nextHour: null,
          hourly: createHourlySeries('2026-11-02T14:00:00.000Z', [80, 10]),
        });

        // When
        const window = WeatherReportPolicy.getPrecipitationWindow(report, now);

        // Then
        expect(window).toMatchObject({
          kind: 'ongoing',
          endsAt: toInstant('2026-11-02T15:00:00.000Z'),
          isEndingOnLaterDay: expected,
        });
      },
    );

    it('국내처럼 분 단위 예보가 없으면 시간별 예보로 정시 기준 강수를 안내한다', () => {
      // Given
      const report = toWeatherReport(createSeoulReportDto());

      // When
      const window = WeatherReportPolicy.getPrecipitationWindow(report, NOW);

      // Then
      expect(window).toEqual({
        kind: 'upcoming',
        precision: 'hour',
        precipitationType: 'RAIN',
        startsAt: toInstant('2026-11-02T07:00:00.000Z'),
        endsAt: toInstant('2026-11-02T09:00:00.000Z'),
        endPrecision: 'hour',
        isEndingOnLaterDay: false,
      });
    });

    it('도쿄처럼 분 단위 예보가 있으면 분 단위로 시작을 안내하고 도쿄 시간대 기준으로 날짜를 판단한다', () => {
      // Given
      const report = toWeatherReport(createTokyoReportDto());

      // When
      const window = WeatherReportPolicy.getPrecipitationWindow(report, NOW);

      // Then
      expect(window).toMatchObject({
        kind: 'upcoming',
        precision: 'minute',
        isEndingOnLaterDay: false,
      });
    });
  });

  describe('findHourlyPrecipitationOutlook', () => {
    it('6시간 안에 비 오는 시간이 있으면 그 첫 시간과 확률을 돌려준다', () => {
      // Given
      const report = createWeatherReport({
        hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [10, 70, 60]),
      });

      // When
      const outlook = WeatherReportPolicy.findHourlyPrecipitationOutlook(report, NOW);

      // Then
      expect(outlook?.hour.startsAt).toBe('2026-11-02T07:00:00.000Z');
      expect(outlook?.hour.precipitationChance).toBe(70);
      expect(outlook?.isOngoing).toBe(false);
    });

    it('지금 시간이 비 오는 시간이면 지금 오고 있다고 본다', () => {
      // Given
      const report = createWeatherReport({
        hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [80, 10]),
      });

      // When
      const outlook = WeatherReportPolicy.findHourlyPrecipitationOutlook(report, NOW);

      // Then
      expect(outlook?.isOngoing).toBe(true);
    });

    it('6시간 안에 비 소식이 없으면 빈 카드를 만들지 않도록 null이다', () => {
      // Given
      const report = createWeatherReport({
        hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [10, 10, 10, 10, 10, 10, 10, 90]),
      });

      // When
      const outlook = WeatherReportPolicy.findHourlyPrecipitationOutlook(report, NOW);

      // Then
      expect(outlook).toBeNull();
    });
  });

  describe('findHourlySummary', () => {
    it('지금 비가 오면 처음 그치는 시간을 그침 시각으로 반환한다', () => {
      // Given
      // 지금부터 2시간 비, 그 뒤 갬
      const report = createWeatherReport({
        hourly: createHourlyForecasts([RAIN, RAIN, DRY_CLOUDY]),
      });

      // When
      const summary = WeatherReportPolicy.findHourlySummary(report, NOW);

      // Then
      // 오후 5시에 그친다
      expect(summary).toEqual({
        kind: 'precipitationOngoing',
        precipitationType: 'RAIN',
        endsAt: toInstant('2026-11-02T08:00:00.000Z'),
        isEndingOnLaterDay: false,
      });
    });

    it('시간별 확률이 낮아도 지금 관측된 비가 있으면 내리는 중으로 반환한다', () => {
      // Given
      // 지금 4.5mm/h 비가 오고 시간별 확률은 47%다
      const base = createWeatherReport({
        hourly: createHourlyForecasts([{ ...DRY_CLOUDY, precipitationChance: 47 }, DRY_CLOUDY]),
      });
      const report = {
        ...base,
        current: { ...base.current, condition: 'RAIN', precipitationIntensity: 4.5 },
      } as const;

      // When
      const summary = WeatherReportPolicy.findHourlySummary(report, NOW);

      // Then
      expect(summary).toMatchObject({
        kind: 'precipitationOngoing',
        precipitationType: 'RAIN',
        endsAt: toInstant('2026-11-02T07:00:00.000Z'),
      });
    });

    it('비가 하루 안에 그치지 않으면 그침 시각 없이 반환한다', () => {
      // Given
      const report = createWeatherReport({ hourly: createHourlyForecasts([RAIN, RAIN]) });

      // When
      const summary = WeatherReportPolicy.findHourlySummary(report, NOW);

      // Then
      expect(summary).toMatchObject({ kind: 'precipitationOngoing', endsAt: null });
    });

    it('내일 비가 오면 그 전 하늘과 함께 다음 날이라고 표시한다', () => {
      // Given
      // 오늘 밤까지 흐리고 다음 날 새벽에 비가 온다
      const report = createWeatherReport({
        hourly: createHourlyForecasts([...range(10).map(() => DRY_CLOUDY), RAIN]),
      });

      // When
      const summary = WeatherReportPolicy.findHourlySummary(report, NOW);

      // Then
      expect(summary).toEqual({
        kind: 'precipitationUpcoming',
        precipitationType: 'RAIN',
        startsAt: toInstant('2026-11-02T16:00:00.000Z'),
        isStartingOnLaterDay: true,
        skyBefore: 'cloudy',
      });
    });

    it('강수 확률이 낮은 비 상태는 비로 보지 않는다', () => {
      // Given
      // 상태는 비지만 확률은 30%다
      const report = createWeatherReport({
        hourly: createHourlyForecasts([DRY_CLOUDY, { condition: 'RAIN', precipitationChance: 30 }]),
      });

      // When
      const summary = WeatherReportPolicy.findHourlySummary(report, NOW);

      // Then
      expect(summary).not.toMatchObject({ kind: 'precipitationUpcoming' });
    });

    it('두 시간 이상 이어지는 다른 하늘이 오면 바뀌는 시각을 반환한다', () => {
      // Given
      // 맑다가 한 시간 구름, 다시 맑다가 흐림이 이어진다
      const clear = { condition: 'CLEAR', precipitationChance: 0 } as const;
      const report = createWeatherReport({
        hourly: createHourlyForecasts([clear, DRY_CLOUDY, clear, DRY_CLOUDY, DRY_CLOUDY]),
      });

      // When
      const summary = WeatherReportPolicy.findHourlySummary(report, NOW);

      // Then
      expect(summary).toEqual({
        kind: 'skyChange',
        from: 'clear',
        to: 'cloudy',
        changesAt: toInstant('2026-11-02T09:00:00.000Z'),
        isChangingOnLaterDay: false,
      });
    });

    it('하늘이 그대로인 낮에는 남은 낮의 최고 기온을 정점으로 반환한다', () => {
      // Given
      // 낮 동안 12, 16, 13도이고 밤 20도는 낮이 아니라 제외된다
      const report = createWeatherReport({
        hourly: createHourlyForecasts([
          { ...DRY_CLOUDY, temperature: 12 },
          { ...DRY_CLOUDY, temperature: 16 },
          { ...DRY_CLOUDY, temperature: 13 },
          { ...DRY_CLOUDY, temperature: 20, isDaylight: false },
        ]),
      });

      // When
      const summary = WeatherReportPolicy.findHourlySummary(report, NOW);

      // Then
      // 오후 4시 16도가 정점이다
      expect(summary).toEqual({
        kind: 'steady',
        sky: 'cloudy',
        peak: { extreme: 'highest', at: toInstant('2026-11-02T07:00:00.000Z'), temperature: 16 },
      });
    });

    it('밤에는 최저 기온을 정점으로 보고, 지금과 1° 미만 차이면 정점을 두지 않는다', () => {
      // Given
      // 밤 동안 8.0도에서 7.4도로 내려 1도 미만 차이다
      const report = createWeatherReport({
        hourly: createHourlyForecasts([
          { ...DRY_CLOUDY, temperature: 8, isDaylight: false },
          { ...DRY_CLOUDY, temperature: 7.4, isDaylight: false },
        ]),
      });

      // When
      const summary = WeatherReportPolicy.findHourlySummary(report, NOW);

      // Then
      expect(summary).toEqual({ kind: 'steady', sky: 'cloudy', peak: null });
    });

    it('남은 시간별 예보가 없으면 null을 반환한다', () => {
      // Given
      const report = createWeatherReport({ hourly: createHourlyForecasts([DRY_CLOUDY]) });
      const lateNow = toInstant('2026-11-02T08:00:00.000Z');

      // When
      const summary = WeatherReportPolicy.findHourlySummary(report, lateNow);

      // Then
      expect(summary).toBeNull();
    });
  });

  describe('findNextSunEvent', () => {
    const createDays = (...dates: string[]) =>
      dates.flatMap((date) => createWeatherReportDto().daily.map((day) => ({ ...day, date })));

    it('오늘 해가 모두 졌으면 내일 예보의 일출을 고른다', () => {
      // Given
      // 기본 예보의 일몰은 08:28Z(서울 17:28)이다
      const report = createWeatherReport({ daily: createDays('2026-11-02', '2026-11-03') });
      const afterSunset = toInstant('2026-11-02T10:00:00.000Z');

      // When
      const event = WeatherReportPolicy.findNextSunEvent(report, afterSunset);

      // Then
      expect(event?.kind).toBe('sunriseTomorrow');
    });

    it('일별 예보가 없으면 null이다', () => {
      // Given
      const empty = createWeatherReport({ daily: [] });

      // When
      const event = WeatherReportPolicy.findNextSunEvent(empty, NOW);

      // Then
      expect(event).toBeNull();
    });
  });

  describe('canBriefTodos', () => {
    const STATE_REPORT = createWeatherReport({
      fetchedAt: '2026-11-02T06:20:00.000Z',
      hourly: HOURLY,
    });

    it('6시간 넘게 갱신되지 않은 리포트로는 브리핑하지 않는다', () => {
      // Given
      const later = fromEpochMs(toEpochMs(NOW) + 7 * 60 * 60_000);

      // When
      const canBrief = WeatherReportPolicy.canBriefTodos(STATE_REPORT, later, 'Asia/Seoul');

      // Then
      expect(canBrief).toBe(false);
    });

    it.each([
      ['Asia/Tokyo', true],
      ['America/Los_Angeles', false],
    ] as const)(
      '기기 시간대가 %s이면 서울 리포트로 할 일을 브리핑하는지는 %s다',
      (deviceTimezone, expected) => {
        // When
        const canBrief = WeatherReportPolicy.canBriefTodos(STATE_REPORT, NOW, deviceTimezone);

        // Then
        expect(canBrief).toBe(expected);
      },
    );
  });

  describe('findBriefing', () => {
    it('서버가 머리글을 판단하지 못했으면(할 일 읽기 실패) 앱이 다시 판단하지 않고 브리핑하지 않는다', () => {
      // Given
      const undecided = createWeatherReport({ hourly: HOURLY, headline: null });

      // When
      const briefing = WeatherReportPolicy.findBriefing(undecided, [createBriefingTodo()], NOW);

      // Then
      expect(briefing).toBeNull();
    });

    it('알릴 날씨가 없으면 남은 시각 할 일이 있을 때만 날씨 걱정 없는 목록을 보인다', () => {
      // Given
      // 예보상 비 시간에 할 일이 있어도 서버가 알릴 날씨가 없다고 하면 다시 판단하지 않는다
      const calmReport = createWeatherReport({ hourly: HOURLY });
      const unscheduledTodo = createBriefingTodo({ id: 2, scheduledAt: null });

      // When
      const withTodo = WeatherReportPolicy.findBriefing(calmReport, [createBriefingTodo()], NOW);
      const withoutTodo = WeatherReportPolicy.findBriefing(calmReport, [unscheduledTodo], NOW);

      // Then
      expect(withTodo?.kind === 'dry' && withTodo.todos.map(({ todoId }) => todoId)).toEqual([1]);
      expect(withoutTodo).toEqual({ kind: 'noScheduledTodos' });
    });

    it('서버가 비와 겹친다고 고른 할 일을 그 시간의 예보·서버가 고른 옮길 시각 후보와 함께 돌려준다', () => {
      // When
      const briefing = WeatherReportPolicy.findBriefing(rainyReport, [createBriefingTodo()], NOW);

      // Then
      expect(briefing?.kind).toBe('rainy');
      expect(briefing?.kind === 'rainy' && briefing.todos).toEqual([
        expect.objectContaining({
          todoId: 1,
          title: '산책',
          scheduledAt: toInstant('2026-11-02T07:30:00.000Z'),
          hour: expect.objectContaining({ precipitationChance: 70, precipitationType: 'RAIN' }),
          rescheduleOptions: [
            expect.objectContaining({ startsAt: '2026-11-02T10:00:00.000Z', isRecommended: true }),
          ],
        }),
      ]);
    });

    it('서버가 고른 할 일 중 오늘 목록에서 사라졌거나 이미 지난 할 일은 빼고 서버 순서를 지킨다', () => {
      // Given
      // 3·1은 남았고, 2는 14:30이라 지났고, 9는 목록에 없다
      const serverReport = createWeatherReport({
        hourly: HOURLY,
        briefing: createBriefingDto({ reason: 'rain', affectedTodoIds: [3, 2, 1, 9] }),
        headline: RAINY_HEADLINE,
      });
      const todos = [
        createBriefingTodo({ id: 1, scheduledAt: toInstant('2026-11-02T08:30:00.000Z') }),
        createBriefingTodo({ id: 2, scheduledAt: toInstant('2026-11-02T05:30:00.000Z') }),
        createBriefingTodo({ id: 3, scheduledAt: toInstant('2026-11-02T07:30:00.000Z') }),
      ];

      // When
      const briefing = WeatherReportPolicy.findBriefing(serverReport, todos, NOW);

      // Then
      expect(briefing?.kind === 'rainy' && briefing.todos.map(({ todoId }) => todoId)).toEqual([
        3, 1,
      ]);
    });

    it('서버가 짚은 할 일이 오늘 목록에 하나도 없으면 위험 대신 남은 할 일 목록을 보인다', () => {
      // Given
      const otherTodo = createBriefingTodo({ id: 5 });

      // When
      const briefing = WeatherReportPolicy.findBriefing(rainyReport, [otherTodo], NOW);

      // Then
      expect(briefing?.kind === 'dry' && briefing.todos.map(({ todoId }) => todoId)).toEqual([5]);
    });

    it('비와 겹친 할 일을 브리핑에서 끝내도 리포트를 다시 받기 전까지 카드는 그대로 두고 완료로 보인다', () => {
      // Given
      const todos = [createBriefingTodo({ id: 1, completed: true })];

      // When
      const briefing = WeatherReportPolicy.findBriefing(rainyReport, todos, NOW);

      // Then
      expect(
        briefing?.kind === 'rainy' && briefing.todos.map(({ completed }) => completed),
      ).toEqual([true]);
    });

    it.each([
      { hazard: 'storm', kind: 'stormy' },
      { hazard: 'snow', kind: 'snowy' },
      { hazard: 'rain', kind: 'rainy' },
    ] as const)('서버가 할 일과 겹친 $hazard를 알리면 $kind 카드다', ({ hazard, kind }) => {
      // Given
      const report = createWeatherReport({
        hourly: HOURLY,
        briefing: RAIN_ON_TODO_1,
        headline: { ...RAINY_HEADLINE, hazard },
      });

      // When
      const briefing = WeatherReportPolicy.findBriefing(report, [createBriefingTodo()], NOW);

      // Then
      expect(briefing?.kind).toBe(kind);
    });

    it('뇌우·더위는 서버가 준 날씨 시간과 최고 체감 온도를 그대로 쓴다', () => {
      // Given
      const stormReport = createWeatherReport({
        hourly: HOURLY,
        briefing: RAIN_ON_TODO_1,
        headline: { ...RAINY_HEADLINE, hazard: 'storm' },
      });
      const hotReport = createWeatherReport({
        hourly: HOURLY,
        briefing: createBriefingDto({ reason: 'heat', affectedTodoIds: [1] }),
        headline: { kind: 'todoHot', peakApparentTemperature: 39, window: TODO_WINDOW },
      });
      const serverWindow = {
        startsAt: toInstant(TODO_WINDOW.startsAt),
        endsAt: toInstant(TODO_WINDOW.endsAt),
      };

      // When
      const stormy = WeatherReportPolicy.findBriefing(stormReport, [createBriefingTodo()], NOW);
      const hot = WeatherReportPolicy.findBriefing(hotReport, [createBriefingTodo()], NOW);

      // Then
      expect(stormy).toMatchObject({ kind: 'stormy', range: serverWindow });
      expect(hot).toMatchObject({ kind: 'hot', range: serverWindow, peakApparentTemperature: 39 });
    });

    it('서버가 오늘 비가 지금부터 온다고 하면 지금 비 시간에 할 일이 없어도 그 시각으로 알린다', () => {
      // Given
      // 지금 시간(15시)이 흐리고 비가 온다
      const wetNowReport = createWeatherReportWithHours([{ precipitationChance: 80 }], {
        headline: { kind: 'wetLater', startsAt: '2026-11-02T06:26:00.000Z', isSnow: false },
      });

      // When
      const briefing = WeatherReportPolicy.findBriefing(wetNowReport, [], NOW);

      // Then
      expect(briefing).toEqual({
        kind: 'rainLater',
        todos: [],
        timing: { day: 'today', startsAt: NOW },
        isSnow: false,
        isOvercast: true,
      });
    });

    it('서버가 내일 비를 알리면 서버가 고른 하루 구분으로 알린다', () => {
      // Given
      const tomorrowRainReport = createWeatherReportWithHours(DRY_HOURS, {
        headline: { kind: 'wetTomorrow', dayPart: 'afternoon', isSnow: true },
      });

      // When
      const briefing = WeatherReportPolicy.findBriefing(tomorrowRainReport, [], NOW);

      // Then
      expect(briefing).toMatchObject({
        kind: 'rainLater',
        timing: { day: 'tomorrow', dayPart: 'afternoon' },
        isSnow: true,
      });
    });

    it('맑은 날은 서버가 고른 가장 좋은 시간대를 그대로 알린다', () => {
      // Given
      const clearReport = createWeatherReportWithHours(DRY_HOURS, {
        headline: { kind: 'clear', window: TODO_WINDOW },
      });

      // When
      const briefing = WeatherReportPolicy.findBriefing(clearReport, [], NOW);

      // Then
      expect(briefing).toEqual({
        kind: 'clear',
        todos: [],
        range: { startsAt: toInstant(TODO_WINDOW.startsAt), endsAt: toInstant(TODO_WINDOW.endsAt) },
        // 16~18시 추천을 15:26에 고르면 그 안의 첫 예보 칸은 16시다
        suggestedStartAt: toInstant(TODO_WINDOW.startsAt),
      });
    });

    it('저녁 내일 기온은 오늘 줄이 없을 때만 보이고 끝낸 할 일 줄이 남아 있으면 그 목록을 보인다', () => {
      // Given
      const tomorrowReport = createWeatherReportWithHours(DRY_HOURS, {
        headline: { kind: 'tomorrow', temperatureMin: 3, temperatureMax: 16, isChilly: true },
      });
      const completedTodo = createBriefingTodo({ completed: true });

      // When
      const withoutRows = WeatherReportPolicy.findBriefing(tomorrowReport, [], NOW);
      const withRows = WeatherReportPolicy.findBriefing(tomorrowReport, [completedTodo], NOW);

      // Then
      expect(withoutRows).toEqual({
        kind: 'tomorrowMorning',
        temperatureMin: 3,
        temperatureMax: 16,
        isChilly: true,
      });
      expect(withRows?.kind).toBe('dry');
    });
  });

  describe('getReschedule', () => {
    const todos = [
      createBriefingTodo({ id: 1, scheduledAt: toInstant('2026-11-02T07:30:00.000Z') }),
      createBriefingTodo({ id: 2, scheduledAt: toInstant('2026-11-02T08:30:00.000Z') }),
    ];

    it('링크가 가리킨 할 일 중 서버가 고른 할 일만 서버 후보와 함께 돌려준다', () => {
      // When
      const { todos: affected } = WeatherReportPolicy.getReschedule(rescheduleReport, todos, {
        now: NOW,
        linkedTodoIds: [1, 2],
        linkedReason: 'rain',
      });

      // Then
      // 2도 예보상 비 시간이지만 서버가 고르지 않았다
      expect(affected.map((todo) => todo.todoId)).toEqual([1]);
      expect(affected[0]?.rescheduleOptions.map((option) => option.startsAt)).toEqual([
        '2026-11-02T10:00:00.000Z',
        '2026-11-02T12:00:00.000Z',
      ]);
    });

    it('링크의 이유나 할 일이 지금 브리핑과 달라도 지금 브리핑의 영향받는 할 일을 보여 준다', () => {
      // Given
      const heatReport = createWeatherReport({
        hourly: HOURLY,
        briefing: { ...SERVER_BRIEFING, reason: 'heat' },
      });

      // When
      const { todos: affected } = WeatherReportPolicy.getReschedule(heatReport, todos, {
        now: NOW,
        linkedTodoIds: [2],
        linkedReason: 'rain',
      });

      // Then
      expect(affected.map((todo) => todo.todoId)).toEqual([1]);
    });

    it('지금 브리핑에 영향받는 할 일이 없으면 비운다', () => {
      // Given
      const emptyReport = createWeatherReport({
        hourly: HOURLY,
        briefing: createBriefingDto({ reason: null, affectedTodoIds: [], rescheduleOptions: [] }),
      });

      // When
      const { todos: affected } = WeatherReportPolicy.getReschedule(emptyReport, todos, {
        now: NOW,
        linkedTodoIds: [1],
        linkedReason: 'rain',
      });

      // Then
      expect(affected).toEqual([]);
    });

    it('서버가 판단하지 못한 리포트로는 할 일을 다시 고르지 않는다', () => {
      // Given
      const noBriefing = createWeatherReport({ hourly: HOURLY, briefing: undefined });

      // When
      const { todos: affected } = WeatherReportPolicy.getReschedule(noBriefing, todos, {
        now: NOW,
        linkedTodoIds: [1],
        linkedReason: 'rain',
      });

      // Then
      expect(affected).toEqual([]);
    });

    it('시트를 연 사이 끝낸 할 일은 옮기지 않는다', () => {
      // Given
      const completed = [createBriefingTodo({ id: 1, completed: true })];

      // When
      const { todos: affected } = WeatherReportPolicy.getReschedule(rescheduleReport, completed, {
        now: NOW,
        linkedTodoIds: [1],
        linkedReason: 'rain',
      });

      // Then
      expect(affected).toEqual([]);
    });

    it.each([
      {
        title: '지금 브리핑의 이유가 링크와 다르면 지금 브리핑의 이유',
        briefingReason: 'heat',
        expected: 'heat',
      },
      { title: '지금 브리핑에 이유가 없으면 링크의 이유', briefingReason: null, expected: 'rain' },
    ] as const)('$title로 옮긴다', ({ briefingReason, expected }) => {
      // Given
      const changedReport = createWeatherReport({
        hourly: HOURLY,
        briefing: { ...SERVER_BRIEFING, reason: briefingReason },
      });

      // When
      const reschedule = WeatherReportPolicy.getReschedule(changedReport, todos, {
        now: NOW,
        linkedTodoIds: [1],
        linkedReason: 'rain',
      });

      // Then
      expect(reschedule.reason).toBe(expected);
    });

    it('서버가 판단하지 못한 리포트는 링크의 이유로 옮길 할 일 없이 연다', () => {
      // Given
      const noBriefing = createWeatherReport({ hourly: HOURLY, briefing: undefined });

      // When
      const reschedule = WeatherReportPolicy.getReschedule(noBriefing, todos, {
        now: NOW,
        linkedTodoIds: [1],
        linkedReason: 'heat',
      });

      // Then
      expect(reschedule).toEqual({ reason: 'heat', todos: [] });
    });
  });
});
