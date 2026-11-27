import { getNowInstant } from '@src/shared/date/clock';
import { fromEpochMs, toInstant } from '@src/shared/date/instant';
import { createDateKey } from '@src/testing/date-key';

import {
  createHourlyForecastDto,
  createHourlySeries,
  createWeatherReport,
  createWeatherReportWithHours,
} from '../__tests__/weather-report.fixtures';
import {
  filterByLocalDate,
  ForecastHourPolicy,
  isFrozenPrecipitation,
} from './forecast-hour.model';

/** 서울 15:26 */
const NOW = toInstant('2026-11-02T06:26:00.000Z');

function createHour(row: Parameters<typeof createWeatherReportWithHours>[0][number]) {
  const [hour] = createWeatherReportWithHours([row]).hourly;
  if (hour == null) {
    throw new Error('예보 한 시간을 만들지 못했다');
  }
  return hour;
}

describe('isFrozenPrecipitation', () => {
  it.each([
    ['SNOW', true],
    ['SLEET', true],
    ['HAIL', true],
    ['RAIN', false],
    ['MIXED', false],
    ['NONE', false],
  ] as const)('%s가 얼어 내리는지는 %s다', (type, expected) => {
    // When
    const isFrozen = isFrozenPrecipitation(type);

    // Then
    expect(isFrozen).toBe(expected);
  });
});

describe('filterByLocalDate', () => {
  it.each([
    { timezone: 'Asia/Seoul', dateKey: '2026-11-03', expected: true },
    { timezone: 'America/Los_Angeles', dateKey: '2026-11-03', expected: false },
    { timezone: 'America/Los_Angeles', dateKey: '2026-11-02', expected: true },
  ])(
    '15:00Z에 시작하는 시간이 $timezone의 $dateKey에 드는지는 $expected다',
    ({ timezone, dateKey, expected }) => {
      // Given
      // 서울은 11월 3일 0시, 로스앤젤레스는 11월 2일 7시다
      const hour = createHour({ startsAt: '2026-11-02T15:00:00.000Z' });

      // When
      const isOnDate = filterByLocalDate(hour, createDateKey(dateKey), timezone);

      // Then
      expect(isOnDate).toBe(expected);
    },
  );
});

describe('ForecastHourPolicy', () => {
  describe('isWet', () => {
    it.each([
      { precipitationChance: 49, expected: false },
      { precipitationChance: 50, expected: true },
      { precipitationChance: 51, expected: true },
      { precipitationChance: 0, expected: false },
    ])(
      '강수 확률 $precipitationChance%면 비 오는 시간인지는 $expected다',
      ({ precipitationChance, expected }) => {
        // Given
        const hour = createHour({ precipitationChance });

        // When
        const result = ForecastHourPolicy.isWet(hour);

        // Then
        // 50% 이상이면 비 오는 시간이다(서버 날씨 알림과 같은 기준)
        expect(result).toBe(expected);
      },
    );
  });

  describe('findSunscreenWindow', () => {
    const now = toInstant('2026-11-02T02:30:00.000Z');
    const hourly = createWeatherReport({
      hourly: [1, 4, 5, 3, 2, 6].map((uvIndex, index) =>
        createHourlyForecastDto({
          startsAt: fromEpochMs(Date.parse('2026-11-02T02:00:00.000Z') + index * 3_600_000),
          uvIndex,
        }),
      ),
    }).hourly;

    it('오늘 남은 시간 중 자외선 3 이상인 첫 시각부터 마지막 시각 끝까지다', () => {
      // When
      const window = ForecastHourPolicy.findSunscreenWindow(hourly, now, 'Asia/Seoul');

      // Then
      // 12~15시와 16시에 자외선 3 이상이라 12시~17시(서울)다
      expect(window).toEqual({
        startsAt: toInstant('2026-11-02T03:00:00.000Z'),
        endsAt: toInstant('2026-11-02T08:00:00.000Z'),
      });
    });

    it('자외선이 약하면 null이다', () => {
      // Given
      const weakHourly = hourly.map((hour) => ({ ...hour, uvIndex: 1 }));

      // When
      const window = ForecastHourPolicy.findSunscreenWindow(weakHourly, now, 'Asia/Seoul');

      // Then
      expect(window).toBeNull();
    });
  });

  describe('calculateNextDayPrecipitation', () => {
    it('지나간 시간은 빼고 남은 시간의 강수량을 더한다', () => {
      // Given
      // 06시 0.4mm, 07시 1.25mm, 08시 2mm
      const hourly = createWeatherReport({
        hourly: [0.4, 1.25, 2].map((amount, index) =>
          createHourlyForecastDto({
            startsAt: fromEpochMs(Date.parse('2026-11-02T06:00:00.000Z') + index * 3_600_000),
            precipitationAmount: amount,
          }),
        ),
      }).hourly;
      const now = toInstant('2026-11-02T07:10:00.000Z');

      // When
      const total = ForecastHourPolicy.calculateNextDayPrecipitation(hourly, now);

      // Then
      // 07시 1.25mm와 08시 2mm를 더한 3.25mm를 소수 첫째 자리로 맞춘다
      expect(total).toBe(3.3);
    });

    it('시간별 예보가 없으면 null이다', () => {
      // When
      const total = ForecastHourPolicy.calculateNextDayPrecipitation([], getNowInstant());

      // Then
      expect(total).toBeNull();
    });
  });

  describe('findFirstStartWithin', () => {
    const RANGE = {
      startsAt: toInstant('2026-11-02T06:00:00.000Z'),
      endsAt: toInstant('2026-11-02T08:00:00.000Z'),
    };
    const { hourly: HOURLY } = createWeatherReport({
      hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [10, 10, 10]),
    });

    it('추천 시간대가 이미 시작됐으면 다음 예보 시각을 제안한다', () => {
      // When
      const startAt = ForecastHourPolicy.findFirstStartWithin(HOURLY, RANGE, NOW);

      // Then
      // 15~17시 추천을 15:26에 고르면 다음 정시는 16시다
      expect(startAt).toBe('2026-11-02T07:00:00.000Z');
    });

    it('추천 시간대의 예보 시각이 모두 지났으면 제안하지 않는다', () => {
      // Given
      const lateNow = toInstant('2026-11-02T07:10:00.000Z');

      // When
      const startAt = ForecastHourPolicy.findFirstStartWithin(HOURLY, RANGE, lateNow);

      // Then
      expect(startAt).toBeNull();
    });

    it('30분 단위 시간대는 예보 칸의 시작 시각을 제안한다', () => {
      // Given
      // 인도처럼 예보 칸이 30분에 시작한다
      const { hourly: offsetHourly } = createWeatherReport({
        hourly: createHourlySeries('2026-11-02T06:30:00.000Z', [10, 10, 10]),
      });
      const offsetRange = {
        startsAt: toInstant('2026-11-02T06:30:00.000Z'),
        endsAt: toInstant('2026-11-02T08:30:00.000Z'),
      };

      // When
      const startAt = ForecastHourPolicy.findFirstStartWithin(offsetHourly, offsetRange, NOW);

      // Then
      expect(startAt).toBe('2026-11-02T06:30:00.000Z');
    });
  });
});
