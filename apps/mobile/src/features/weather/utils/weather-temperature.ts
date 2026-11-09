export type TemperatureUnit = 'celsius' | 'fahrenheit';

const MINUS_SIGN = '−';

/** 큰 기온은 영하 기호와 숫자를 따로 그린다. */
export type TemperatureReading = { isBelowZero: boolean; magnitude: number };

/** 서버 값은 섭씨다. 반올림한 -0은 "-0°"로 보이지 않게 0으로 바꾼다. */
export function toDisplayTemperature(celsius: number, unit: TemperatureUnit): number {
  const value = unit === 'fahrenheit' ? (celsius * 9) / 5 + 32 : celsius;
  return Math.round(value) + 0;
}

export function toTemperatureReading(displayValue: number): TemperatureReading {
  return { isBelowZero: displayValue < 0, magnitude: Math.abs(displayValue) };
}

/** 영하는 하이픈 대신 마이너스 기호(−)로 써서 숫자 폭과 읽기를 맞춘다. */
export function formatDegrees(displayValue: number): string {
  const { isBelowZero, magnitude } = toTemperatureReading(displayValue);
  return `${isBelowZero ? MINUS_SIGN : ''}${magnitude}°`;
}

export function formatTemperature(celsius: number, unit: TemperatureUnit): string {
  return formatDegrees(toDisplayTemperature(celsius, unit));
}
