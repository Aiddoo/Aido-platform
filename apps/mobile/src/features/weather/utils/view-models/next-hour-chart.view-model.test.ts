import { NEXT_HOUR_CHART_SIZE, toNextHourChart } from './next-hour-chart.view-model';

const START = Date.parse('2026-11-02T06:26:00.000Z');

function createMinutes(intensities: readonly number[]) {
  return intensities.map((precipitationIntensity, index) => ({
    startsAt: new Date(START + index * 60_000),
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
    // Given 같은 강도가 이어지는 분 예보 When 그래프를 만들면 Then 약함·보통·강함 눈금 높이에 놓인다
    const { baseline, top } = NEXT_HOUR_CHART_SIZE;
    const chart = toNextHourChart(createMinutes([intensity, intensity]));
    const firstY = Number(chart?.line.match(/^M0,(-?[\d.]+)/)?.[1]);

    expect(firstY).toBeCloseTo(baseline - level * (baseline - top));
  });
});

describe('toNextHourChart', () => {
  it('강수가 없으면 선이 바닥선 위에 놓이고 길이는 그래프 폭 이상이다', () => {
    // Given 1시간 내내 0mm/h When 그래프를 만들면 Then 선이 바닥선을 따라간다
    const chart = toNextHourChart(createMinutes(Array.from({ length: 60 }, () => 0)));

    expect(chart?.line.startsWith(`M0,${NEXT_HOUR_CHART_SIZE.baseline}`)).toBe(true);
    expect(chart?.length).toBeGreaterThanOrEqual(NEXT_HOUR_CHART_SIZE.width);
  });

  it('곡선은 단조 보간이라 바닥선 아래로 내려가지 않는다', () => {
    // Given 0에서 강함으로 급히 오르내림 When 그래프를 만들면 Then 모든 y가 바닥선 이하다
    const chart = toNextHourChart(createMinutes([0, 0, 20, 0, 0, 10, 0]));
    const ys = (chart?.line.match(/-?\d+(\.\d+)?/g) ?? [])
      .map(Number)
      .filter((_, i) => i % 2 === 1);

    expect(ys.every((y) => y <= NEXT_HOUR_CHART_SIZE.baseline)).toBe(true);
    expect(chart?.area.length).toBeGreaterThan(0);
  });

  it('약함·보통·강함 눈금을 아래에서 위로 반환한다', () => {
    // Given 아무 강도 When 그래프를 만들면 Then 눈금 세 개가 위로 갈수록 y가 작다
    const chart = toNextHourChart(createMinutes([1, 2]));

    expect(chart?.guides.map((guide) => guide.level)).toEqual(['light', 'moderate', 'heavy']);
    expect(chart?.guides.at(-1)?.y).toBe(NEXT_HOUR_CHART_SIZE.top);
  });

  it('점이 둘 미만이면 그리지 않는다', () => {
    // Given 분 예보 한 개 When 그래프를 만들면 Then null이다
    expect(toNextHourChart(createMinutes([3]))).toBeNull();
  });
});
