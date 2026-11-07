import { toVisibilityKilometers } from './visibility-kilometers';

describe('toVisibilityKilometers', () => {
  it.each([
    [16000, 16],
    [6000, 6],
    [1240, 1.2],
  ] as const)('가시거리 %dm는 %fkm로 보여 준다', (meters, kilometers) => {
    // Given 가시거리(m) When 표시 값을 구하면 Then 10km 미만만 소수 한 자리다
    expect(toVisibilityKilometers(meters)).toBe(kilometers);
  });
});
