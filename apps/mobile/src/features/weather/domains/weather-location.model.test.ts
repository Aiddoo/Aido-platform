import { UNLOCATED_REVISION, WeatherLocationPolicy } from './weather-location.model';

const SEOUL = { latitude: 37.5636, longitude: 126.9976 };

describe('WeatherLocationPolicy.isRelocationNeeded', () => {
  it('등록한 위치가 없으면 다시 등록한다', () => {
    // When
    const needed = WeatherLocationPolicy.isRelocationNeeded(SEOUL, null);

    // Then
    expect(needed).toBe(true);
  });

  it('위도·경도가 0.01도 미만으로 바뀌면 다시 등록하지 않는다', () => {
    // When
    const needed = WeatherLocationPolicy.isRelocationNeeded(
      { latitude: SEOUL.latitude + 0.0099, longitude: SEOUL.longitude - 0.0099 },
      SEOUL,
    );

    // Then
    expect(needed).toBe(false);
  });

  it('위도나 경도 중 하나라도 0.01도 이상 바뀌면 다시 등록한다', () => {
    // When
    const needed = WeatherLocationPolicy.isRelocationNeeded(
      { latitude: SEOUL.latitude, longitude: SEOUL.longitude + 0.01 },
      SEOUL,
    );

    // Then
    expect(needed).toBe(true);
  });
});

describe('WeatherLocationPolicy.status', () => {
  it('위치를 처음 읽는 중이면 확인 중 상태다', () => {
    // When
    const status = WeatherLocationPolicy.status(undefined, { hasFailed: false });

    // Then
    expect(status).toEqual({ status: 'checking' });
  });

  it('위치를 읽지 못하면 서버에 남은 위치로 날씨를 요청하도록 준비 상태가 된다', () => {
    // When
    const status = WeatherLocationPolicy.status(undefined, { hasFailed: true });

    // Then
    expect(status).toEqual({
      status: 'ready',
      locationRevision: UNLOCATED_REVISION,
      placeName: null,
    });
  });

  it('등록한 위치는 소수 둘째 자리 좌표를 리비전으로 쓴다', () => {
    // When
    const status = WeatherLocationPolicy.status(
      {
        status: 'located',
        registered: { ...SEOUL, timezone: 'Asia/Seoul' },
        placeName: '서울 중구',
      },
      { hasFailed: false },
    );

    // Then
    expect(status).toEqual({
      status: 'ready',
      locationRevision: '37.56,127.00',
      placeName: '서울 중구',
    });
  });

  it.each(['needsPermission', 'denied'] as const)('권한 상태 %s를 그대로 전달한다', (state) => {
    // When
    const status = WeatherLocationPolicy.status({ status: state }, { hasFailed: false });

    // Then
    expect(status).toEqual({ status: state });
  });
});
