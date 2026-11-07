import { toCompassDial, toPressureGauge } from './weather-dial.geometry';

describe('toCompassDial', () => {
  it('북서풍이면 꼬리는 북서쪽, 화살촉은 남동쪽을 가리킨다', () => {
    // When
    const dial = toCompassDial(315);

    // Then
    expect(dial.needle?.tail).toEqual({ x: 28.89, y: 28.89 });
    expect(dial.needle?.head.startsWith('M92.53 92.53')).toBe(true);
  });

  it('눈금은 5도 간격 72개이고 30도마다 긴 눈금이다', () => {
    // When
    const dial = toCompassDial(0);

    // Then
    expect(dial.majorTicks.split('M')).toHaveLength(13);
    expect(dial.minorTicks.split('M')).toHaveLength(61);
  });

  it('방위 글자는 북·동·남·서 순서로 반지름 37 위에 놓인다', () => {
    // When
    const dial = toCompassDial(90);

    // Then
    expect(dial.cardinals[0]).toEqual({ direction: 'n', position: { x: 60, y: 23 } });
    expect(dial.cardinals[1]).toEqual({ direction: 'e', position: { x: 97, y: 60 } });
  });

  it('풍향이 없으면 바늘 없이 눈금만 그린다', () => {
    // When
    const dial = toCompassDial(null);

    // Then
    expect(dial.needle).toBeNull();
  });
});

describe('toPressureGauge', () => {
  it('1010hPa는 눈금판 한가운데(위쪽)를 가리킨다', () => {
    // When
    const gauge = toPressureGauge(1010);

    // Then
    expect(gauge.needle).toBe('M60 4L60 18');
  });

  it('범위를 벗어난 기압은 양 끝에 멈춘다', () => {
    // When
    const belowMin = toPressureGauge(900);
    const atMin = toPressureGauge(980);
    const aboveMax = toPressureGauge(1100);
    const atMax = toPressureGauge(1040);

    // Then
    expect(belowMin.needle).toBe(atMin.needle);
    expect(aboveMax.needle).toBe(atMax.needle);
  });
});
