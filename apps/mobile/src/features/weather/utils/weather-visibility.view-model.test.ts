import { getVisibilityKilometers } from './weather-visibility.view-model';

describe('getVisibilityKilometers', () => {
  it.each([
    [16000, 16],
    [6000, 6],
    [1240, 1.2],
  ] as const)('가시거리 %dm는 %fkm로 보여 준다', (meters, kilometers) => {
    // When
    const result = getVisibilityKilometers(meters);

    // Then
    expect(result).toBe(kilometers);
  });
});
