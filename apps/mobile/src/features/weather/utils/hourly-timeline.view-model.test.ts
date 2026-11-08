import { toInstant } from '@src/shared/date/instant';

import { createHourlyForecasts, createWeatherReport } from '../__tests__/weather-report.fixtures';
import { toHourlyTimeline } from './hourly-timeline.view-model';

const NOW = toInstant('2026-11-02T06:26:00.000Z');

const DRY_CLOUDY = { condition: 'CLOUDY', precipitationChance: 10 } as const;

describe('toHourlyTimeline', () => {
  it('범위 안의 일몰을 시각 순서로 끼워 넣고 지난 일출은 뺀다', () => {
    // Given
    const report = createWeatherReport({
      hourly: createHourlyForecasts([DRY_CLOUDY, DRY_CLOUDY, DRY_CLOUDY, DRY_CLOUDY]),
    });

    // When
    const kinds = toHourlyTimeline(report, NOW).map((item) =>
      item.kind === 'hour' ? `hour:${item.isNow}` : item.kind,
    );

    // Then
    expect(kinds).toEqual(['hour:true', 'hour:false', 'hour:false', 'sunset', 'hour:false']);
  });

  it('일몰이 정각과 같은 시각이면 시간 칸이 일몰보다 먼저 온다', () => {
    // Given
    const base = createWeatherReport({
      hourly: createHourlyForecasts([DRY_CLOUDY, DRY_CLOUDY, DRY_CLOUDY, DRY_CLOUDY]),
    });
    const report = {
      ...base,
      daily: base.daily.map((day) => ({ ...day, sunset: toInstant('2026-11-02T08:00:00.000Z') })),
    };

    // When
    const kinds = toHourlyTimeline(report, NOW).map((item) =>
      item.kind === 'hour' ? `hour:${item.isNow}` : item.kind,
    );

    // Then
    expect(kinds).toEqual(['hour:true', 'hour:false', 'hour:false', 'sunset', 'hour:false']);
  });

  it('남은 시간이 없으면 빈 목록을 반환한다', () => {
    // When
    const report = createWeatherReport({ hourly: [] });

    // Then
    expect(toHourlyTimeline(report, NOW)).toEqual([]);
  });
});
