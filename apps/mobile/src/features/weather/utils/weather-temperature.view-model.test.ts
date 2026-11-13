import {
  formatDegrees,
  toDisplayTemperature,
  toTemperatureReading,
} from './weather-temperature.view-model';

describe('toDisplayTemperature', () => {
  it.each([
    [12.4, 'celsius', 12],
    [12.5, 'celsius', 13],
    [-0.4, 'celsius', 0],
    [12.4, 'fahrenheit', 54],
    [37, 'fahrenheit', 99],
    [-17.9, 'fahrenheit', 0],
  ] as const)('섭씨 %s도를 %s 단위로 반올림해 %s로 보여 준다', (celsius, unit, expected) => {
    // When
    const value = toDisplayTemperature(celsius, unit);

    // Then
    expect(Object.is(value, expected)).toBe(true);
  });
});

describe('formatDegrees', () => {
  it.each([
    [12, '12°'],
    [0, '0°'],
    [-3, '−3°'],
  ])('%s도를 마이너스 기호를 써서 %s로 보여 준다', (value, expected) => {
    // When
    const text = formatDegrees(value);

    // Then
    expect(text).toBe(expected);
  });
});

describe('toTemperatureReading', () => {
  it.each([
    [-4, { isBelowZero: true, magnitude: 4 }],
    [0, { isBelowZero: false, magnitude: 0 }],
    [23, { isBelowZero: false, magnitude: 23 }],
  ])('큰 기온 %s도는 영하 기호와 숫자를 나눠 %o로 읽는다', (value, expected) => {
    // When
    const reading = toTemperatureReading(value);

    // Then
    expect(reading).toEqual(expected);
  });
});
