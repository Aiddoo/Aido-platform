import { toCompassDial, toPressureGauge } from './weather-dial.view-model';

describe('toCompassDial', () => {
  it('북서풍이면 꼬리는 북서쪽, 화살촉은 남동쪽을 가리킨다', () => {
    // Given 풍향 315도 When 나침반을 그리면 Then 꼬리 점은 왼쪽 위, 화살촉 끝은 오른쪽 아래에 있다
    const dial = toCompassDial(315);

    expect(dial.needle?.tail).toEqual({ x: 28.89, y: 28.89 });
    expect(dial.needle?.head.startsWith('M92.53 92.53')).toBe(true);
  });

  it('눈금은 5도 간격 72개이고 30도마다 긴 눈금이다', () => {
    // Given 아무 풍향 When 나침반을 그리면 Then 긴 눈금 12개, 짧은 눈금 60개다
    const dial = toCompassDial(0);

    expect(dial.majorTicks.split('M')).toHaveLength(13);
    expect(dial.minorTicks.split('M')).toHaveLength(61);
  });

  it('방위 글자는 북·동·남·서 순서로 반지름 37 위에 놓인다', () => {
    // Given 아무 풍향 When 나침반을 그리면 Then 북은 위, 동은 오른쪽에 있다
    const dial = toCompassDial(90);

    expect(dial.cardinals[0]).toEqual({ direction: 'n', position: { x: 60, y: 23 } });
    expect(dial.cardinals[1]).toEqual({ direction: 'e', position: { x: 97, y: 60 } });
  });

  it('풍향이 없으면 바늘 없이 눈금만 그린다', () => {
    // Given 무풍 When 나침반을 그리면 Then 바늘이 없다
    expect(toCompassDial(null).needle).toBeNull();
  });
});

describe('toPressureGauge', () => {
  it('1010hPa는 눈금판 한가운데(위쪽)를 가리킨다', () => {
    // Given 범위 가운데 기압 When 눈금판을 그리면 Then 바늘이 12시 방향이다
    expect(toPressureGauge(1010).needle).toBe('M60 4L60 18');
  });

  it('범위를 벗어난 기압은 양 끝에 멈춘다', () => {
    // Given 아주 낮은·높은 기압 When 눈금판을 그리면 Then 범위 끝 값과 같은 바늘이다
    expect(toPressureGauge(900).needle).toBe(toPressureGauge(980).needle);
    expect(toPressureGauge(1100).needle).toBe(toPressureGauge(1040).needle);
  });
});
