import { toInstant } from '@src/shared/date/instant';
import { createDateKey } from '@src/testing/date-key';

import { createForecastDay, createWeatherReport } from '../__tests__/weather-report.fixtures';
import { ForecastDayPolicy } from './forecast-day.model';

const SUNRISE = toInstant('2026-11-01T21:51:00.000Z');
const SUNSET = toInstant('2026-11-02T08:28:00.000Z');
const DAY = createForecastDay({ sunrise: SUNRISE, sunset: SUNSET });

describe('ForecastDayPolicy', () => {
  describe('getSunEvents', () => {
    it('일출·일몰이 모두 있으면 두 시각을 그대로 보여 준다', () => {
      // Given
      const [day] = createWeatherReport().daily;

      // When
      const events = day == null ? null : ForecastDayPolicy.getSunEvents(day, true);

      // Then
      expect(events).toEqual({
        kind: 'regular',
        sunrise: toInstant('2026-11-01T21:51:00.000Z'),
        sunset: toInstant('2026-11-02T08:28:00.000Z'),
      });
    });

    it.each([
      [true, 'polarDay'],
      [false, 'polarNight'],
    ] as const)('일출·일몰이 모두 없고 낮 여부가 %s이면 %s로 보여 준다', (isDaylight, kind) => {
      // Given
      const [day] = createWeatherReport().daily;

      // When
      const events =
        day == null
          ? null
          : ForecastDayPolicy.getSunEvents({ ...day, sunrise: null, sunset: null }, isDaylight);

      // Then
      expect(events).toEqual({ kind });
    });

    it('일몰만 없는 날은 일출 시각만 남긴다', () => {
      // Given
      const [day] = createWeatherReport().daily;

      // When
      const events =
        day == null ? null : ForecastDayPolicy.getSunEvents({ ...day, sunset: null }, true);

      // Then
      expect(events).toMatchObject({ kind: 'regular', sunset: null });
    });
  });

  describe('findNextSunEvent', () => {
    const tomorrow = createForecastDay({ sunrise: toInstant('2026-11-02T21:52:00.000Z') });

    it.each([
      { now: '2026-11-01T20:00:00.000Z', kind: 'sunrise' },
      { now: '2026-11-02T06:00:00.000Z', kind: 'sunset' },
      { now: '2026-11-02T10:00:00.000Z', kind: 'sunriseTomorrow' },
    ] as const)('$now에는 아직 오지 않은 가장 가까운 해 일정이 $kind다', ({ now, kind }) => {
      // When
      const event = ForecastDayPolicy.findNextSunEvent(DAY, tomorrow, toInstant(now));

      // Then
      expect(event?.kind).toBe(kind);
    });

    it('일몰 뒤 내일 예보가 없으면 null이다', () => {
      // Given
      const afterSunset = toInstant('2026-11-02T10:00:00.000Z');

      // When
      const event = ForecastDayPolicy.findNextSunEvent(DAY, null, afterSunset);

      // Then
      expect(event).toBeNull();
    });
  });

  describe('findDaylightDuration', () => {
    it('일출부터 일몰까지를 시간·분으로 나눈다', () => {
      // When
      const duration = ForecastDayPolicy.findDaylightDuration(DAY);

      // Then
      // 06:51~17:28(서울)이라 10시간 37분이다
      expect(duration).toEqual({ hours: 10, minutes: 37 });
    });
  });

  describe('findDayAfter', () => {
    const [today] = createWeatherReport().daily;
    const daily =
      today == null
        ? []
        : [
            today,
            { ...today, date: createDateKey('2026-11-03') },
            { ...today, date: createDateKey('2026-11-04') },
          ];

    it('오늘 다음 날짜의 예보를 찾는다', () => {
      // When
      const day = ForecastDayPolicy.findDayAfter(daily, createDateKey('2026-11-02'));

      // Then
      expect(day?.date).toBe('2026-11-03');
    });

    it('오늘 다음 날짜 중 가장 이른 예보를 찾는다', () => {
      // When
      const day = ForecastDayPolicy.findDayAfter(daily, createDateKey('2026-11-03'));

      // Then
      expect(day?.date).toBe('2026-11-04');
    });

    it('예보 범위의 마지막 날이면 null이다', () => {
      // When
      const day = ForecastDayPolicy.findDayAfter(daily, createDateKey('2026-11-04'));

      // Then
      expect(day).toBeNull();
    });
  });

  describe('findNextFullMoon', () => {
    const daily = createWeatherReport().daily;
    const [today] = daily;

    it('오늘 뒤 처음 오는 보름달 날짜를 찾는다', () => {
      // Given
      // 오늘 하현, 사흘 뒤와 닷새 뒤 보름
      const forecast =
        today == null
          ? []
          : [
              today,
              { ...today, date: createDateKey('2026-11-05'), moonPhase: 'FULL' as const },
              { ...today, date: createDateKey('2026-11-07'), moonPhase: 'FULL' as const },
            ];

      // When
      const fullMoonDate = ForecastDayPolicy.findNextFullMoon(
        forecast,
        createDateKey('2026-11-02'),
      );

      // Then
      expect(fullMoonDate).toBe('2026-11-05');
    });

    it('예보 범위에 보름달이 없으면 null이다', () => {
      // When
      const fullMoonDate = ForecastDayPolicy.findNextFullMoon(daily, createDateKey('2026-11-02'));

      // Then
      expect(fullMoonDate).toBeNull();
    });
  });
});
