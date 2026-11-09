import { fromEpochMs } from '@src/shared/date/instant';
import { range } from 'es-toolkit';

import { NEXT_HOUR_CHART_SIZE, toNextHourChart } from './next-hour-chart.geometry';

const START = Date.parse('2026-11-02T06:26:00.000Z');

function createMinutes(intensities: readonly number[]) {
  return intensities.map((precipitationIntensity, index) => ({
    startsAt: fromEpochMs(START + index * 60_000),
    precipitationChance: precipitationIntensity > 0 ? 80 : 0,
    precipitationIntensity,
  }));
}

describe('강수 강도와 그래프 높이', () => {
  it.each([
    [0, 0],
    [2.5, 1 / 3],
    [7.6, 2 / 3],
    [15, 1],
    [40, 1],
  ])('%dmm/h가 이어지면 높이 %d에 수평선을 긋는다', (intensity, level) => {
    // Given
    const { baseline, top } = NEXT_HOUR_CHART_SIZE;
    const chart = toNextHourChart(createMinutes([intensity, intensity]));

    // When
    const firstY = Number(chart?.line.match(/^M0,(-?[\d.]+)/)?.[1]);

    // Then
    expect(firstY).toBeCloseTo(baseline - level * (baseline - top));
  });
});

describe('toNextHourChart', () => {
  it('강수가 없으면 선이 바닥선 위에 놓이고 길이는 그래프 폭 이상이다', () => {
    // When
    const chart = toNextHourChart(createMinutes(range(60).map(() => 0)));

    // Then
    expect(chart?.line.startsWith(`M0,${NEXT_HOUR_CHART_SIZE.baseline}`)).toBe(true);
    expect(chart?.length).toBeGreaterThanOrEqual(NEXT_HOUR_CHART_SIZE.width);
  });

  it('곡선은 단조 보간이라 바닥선 아래로 내려가지 않는다', () => {
    // Given
    const chart = toNextHourChart(createMinutes([0, 0, 20, 0, 0, 10, 0]));

    // When
    const ys = (chart?.line.match(/-?\d+(\.\d+)?/g) ?? [])
      .map(Number)
      .filter((_, i) => i % 2 === 1);

    // Then
    expect(ys.every((y) => y <= NEXT_HOUR_CHART_SIZE.baseline)).toBe(true);
    expect(chart?.area.length).toBeGreaterThan(0);
  });

  it('약함·보통·강함 눈금을 아래에서 위로 반환한다', () => {
    // When
    const chart = toNextHourChart(createMinutes([1, 2]));

    // Then
    expect(chart?.guides.map((guide) => guide.level)).toEqual(['light', 'moderate', 'heavy']);
    expect(chart?.guides.at(-1)?.y).toBe(NEXT_HOUR_CHART_SIZE.top);
  });

  it('점이 둘 미만이면 그리지 않는다', () => {
    // When
    const chart = toNextHourChart(createMinutes([3]));

    // Then
    expect(chart).toBeNull();
  });
});
