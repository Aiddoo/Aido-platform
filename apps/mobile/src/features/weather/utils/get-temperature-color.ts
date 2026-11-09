/** 각 값(°C) 이하일 때의 기온 막대 색. 추울수록 파랗고 더울수록 붉다. */
const TEMPERATURE_COLOR_STEPS = [
  { upTo: 0, color: '#7FB2FF' },
  { upTo: 10, color: '#8BD3F7' },
  { upTo: 18, color: '#9BE3B5' },
  { upTo: 25, color: '#F5D76E' },
  { upTo: 30, color: '#FFB062' },
] as const;
const HOTTEST_COLOR = '#FF7A45';

export function getTemperatureColor(celsius: number): string {
  return TEMPERATURE_COLOR_STEPS.find((step) => celsius <= step.upTo)?.color ?? HOTTEST_COLOR;
}
