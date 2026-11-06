import { toMoonGeometry } from './moon-phase.geometry';

describe('toMoonGeometry', () => {
  it.each([
    ['NEW', 0],
    ['WAXING_CRESCENT', 0.146],
    ['FIRST_QUARTER', 0.5],
    ['WAXING_GIBBOUS', 0.854],
    ['FULL', 1],
    ['THIRD_QUARTER', 0.5],
  ] as const)('%s 달은 %s만큼 밝다', (phase, illumination) => {
    // Given 달 위상 When 달 모양을 구하면 Then 밝은 면적 비율이다
    expect(toMoonGeometry(phase, 37).illumination).toBe(illumination);
  });

  it.each([
    ['WAXING_CRESCENT', 12.73, 'M24 6a18 18 0 0 1 0 36a12.73 18 0 0 0 0 -36z'],
    ['FIRST_QUARTER', 0, 'M24 6a18 18 0 0 1 0 36a0 18 0 0 0 0 -36z'],
    ['WAXING_GIBBOUS', 12.73, 'M24 6a18 18 0 0 1 0 36a12.73 18 0 0 1 0 -36z'],
    ['WANING_CRESCENT', 12.73, 'M24 6a18 18 0 0 0 0 36a12.73 18 0 0 1 0 -36z'],
  ] as const)('%s 달의 명암 경계는 가로 반지름 %s인 반타원이다', (phase, rx, path) => {
    // Given 달 위상 When 달 모양을 구하면 Then 차오르면 오른쪽, 기울면 왼쪽이 밝고 경계는 타원이다
    const geometry = toMoonGeometry(phase, 37);

    expect(geometry.terminatorRx).toBe(rx);
    expect(geometry.litPath).toBe(path);
  });

  it('삭에는 밝은 면을 그리지 않는다', () => {
    // Given 삭 When 달 모양을 구하면 Then 밝은 면과 반그림자가 없다
    const geometry = toMoonGeometry('NEW', 37);

    expect(geometry.litPath).toBeNull();
    expect(geometry.penumbraPath).toBeNull();
  });

  it('반그림자 면은 밝은 면보다 어두운 쪽으로 조금 넓다', () => {
    // Given 상현달 When 달 모양을 구하면 Then 반그림자 경계가 어두운 쪽으로 볼록하다
    expect(toMoonGeometry('FIRST_QUARTER', 37).penumbraPath).toBe(
      'M24 6a18 18 0 0 1 0 36a2.16 18 0 0 1 0 -36z',
    );
  });

  it('남반구에서는 달을 180도 돌려 그린다', () => {
    // Given 남·북반구 위도 When 달 모양을 구하면 Then 남반구만 뒤집힌다
    expect(toMoonGeometry('WAXING_CRESCENT', -33.9).rotation).toBe(180);
    expect(toMoonGeometry('WAXING_CRESCENT', 37.5).rotation).toBe(0);
  });
});
