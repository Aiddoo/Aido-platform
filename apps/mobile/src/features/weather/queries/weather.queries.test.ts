import { toInstant } from '@src/shared/date/instant';
import { createTestQueryClient } from '@src/testing/core';
import { QueryObserver } from '@tanstack/react-query';

import {
  createHourlyForecasts,
  createHourlySeries,
  createWeatherReport,
} from '../__tests__/weather-report.fixtures';
import type { WeatherReport } from '../domains/weather-report.model';
import { WEATHER_QUERY_KEYS } from './weather-query-keys';
import { WeatherReportSelect } from './weather.queries';

describe('WeatherReportSelect.hourly', () => {
  it('분이 바뀌어도 같은 시간 안이면 시간별 칸 목록의 참조가 그대로라 칸이 다시 그려지지 않는다', () => {
    // Given
    const client = createTestQueryClient();
    const queryKey = WEATHER_QUERY_KEYS.report({ locationRevision: 0 });
    client.setQueryData(
      queryKey,
      createWeatherReport({
        hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [10, 10, 10, 10]),
      }),
    );
    const selectAt = (now: string) => (report: WeatherReport) =>
      WeatherReportSelect.hourly(report, toInstant(now));
    const observer = new QueryObserver(client, {
      queryKey,
      select: selectAt('2026-11-02T06:05:00.000Z'),
    });
    const first = observer.getCurrentResult().data;

    // When
    observer.setOptions({ queryKey, select: selectAt('2026-11-02T06:06:00.000Z') });
    const sameHour = observer.getCurrentResult().data;
    observer.setOptions({ queryKey, select: selectAt('2026-11-02T07:00:00.000Z') });
    const nextHour = observer.getCurrentResult().data;

    // Then
    expect(sameHour?.timeline).toBe(first?.timeline);
    expect(nextHour?.timeline).not.toBe(first?.timeline);
    expect(nextHour?.timeline).toHaveLength((first?.timeline.length ?? 0) - 1);
  });
});

/** 서울 오후 3시 26분 */
const NOW = toInstant('2026-11-02T06:26:00.000Z');

const DRY_CLOUDY = { condition: 'CLOUDY', precipitationChance: 10 } as const;

describe('WeatherReportSelect.hourly 칸 목록', () => {
  it('범위 안의 일몰을 시각 순서로 끼워 넣고 지난 일출은 뺀다', () => {
    // Given
    const report = createWeatherReport({
      hourly: createHourlyForecasts([DRY_CLOUDY, DRY_CLOUDY, DRY_CLOUDY, DRY_CLOUDY]),
    });

    // When
    const kinds = WeatherReportSelect.hourly(report, NOW).timeline.map((item) =>
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
    const kinds = WeatherReportSelect.hourly(report, NOW).timeline.map((item) =>
      item.kind === 'hour' ? `hour:${item.isNow}` : item.kind,
    );

    // Then
    expect(kinds).toEqual(['hour:true', 'hour:false', 'hour:false', 'sunset', 'hour:false']);
  });

  it('남은 시간이 없으면 빈 목록을 반환한다', () => {
    // When
    const report = createWeatherReport({ hourly: [] });

    // Then
    expect(WeatherReportSelect.hourly(report, NOW).timeline).toEqual([]);
  });
});
