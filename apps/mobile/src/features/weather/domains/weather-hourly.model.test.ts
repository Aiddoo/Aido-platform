import { toInstant } from '@src/shared/date/instant';
import { range } from 'es-toolkit';

import { createHourlyForecasts, createWeatherReport } from '../__tests__/weather-report.fixtures';
import { getHourlySummary } from './weather-hourly.model';

/** 서울 오후 3시 26분 */
const NOW = toInstant('2026-11-02T06:26:00.000Z');

const DRY_CLOUDY = { condition: 'CLOUDY', precipitationChance: 10 } as const;
const RAIN = { condition: 'RAIN', precipitationChance: 80, precipitationType: 'RAIN' } as const;

describe('getHourlySummary', () => {
  it('지금 비가 오면 처음 그치는 시간을 그침 시각으로 반환한다', () => {
    // Given
    // 지금부터 2시간 비, 그 뒤 갬
    const report = createWeatherReport({ hourly: createHourlyForecasts([RAIN, RAIN, DRY_CLOUDY]) });

    // When
    const summary = getHourlySummary(report, NOW);

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
    const summary = getHourlySummary(report, NOW);

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
    const summary = getHourlySummary(report, NOW);

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
    const summary = getHourlySummary(report, NOW);

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
    const summary = getHourlySummary(report, NOW);

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
    const summary = getHourlySummary(report, NOW);

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
    const summary = getHourlySummary(report, NOW);

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
    const summary = getHourlySummary(report, NOW);

    // Then
    expect(summary).toEqual({ kind: 'steady', sky: 'cloudy', peak: null });
  });

  it('남은 시간별 예보가 없으면 null을 반환한다', () => {
    // Given
    const report = createWeatherReport({ hourly: createHourlyForecasts([DRY_CLOUDY]) });
    const lateNow = toInstant('2026-11-02T08:00:00.000Z');

    // When
    const summary = getHourlySummary(report, lateNow);

    // Then
    expect(summary).toBeNull();
  });
});
