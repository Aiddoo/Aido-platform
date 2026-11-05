import { SAVED_LOCATION_REVISION, WeatherLocationPolicy } from './weather-location.model';

const SEOUL = { latitude: 37.5636, longitude: 126.9976 };
const BUSAN = { latitude: 35.1796, longitude: 129.0756 };

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

describe('WeatherLocationPolicy.nextRevision', () => {
  it('등록한 위치가 이미 받은 리포트와 같은 격자면 리비전을 그대로 둬 다시 받지 않는다', () => {
    // When
    const revision = WeatherLocationPolicy.nextRevision(0, SEOUL, SEOUL);

    // Then
    expect(revision).toBe(0);
  });

  it('등록한 위치가 리포트와 다른 격자면 리비전을 올려 다시 받는다', () => {
    // When
    const revision = WeatherLocationPolicy.nextRevision(0, BUSAN, SEOUL);

    // Then
    expect(revision).toBe(1);
  });

  it('비교할 리포트가 없으면(서버에 위치가 없던 경우) 리비전을 올려 등록 뒤 다시 받는다', () => {
    // When
    const revision = WeatherLocationPolicy.nextRevision(2, SEOUL, null);

    // Then
    expect(revision).toBe(3);
  });
});

describe('WeatherLocationPolicy.readingRevision', () => {
  it('위치를 읽기 전에는 서버 저장 위치 리비전으로 리포트를 바로 받는다', () => {
    // When
    const revision = WeatherLocationPolicy.readingRevision(undefined);

    // Then
    expect(revision).toBe(SAVED_LOCATION_REVISION);
  });
});

describe('WeatherLocationPolicy.status', () => {
  it('위치를 처음 읽는 중이면 확인 중 상태다', () => {
    // When
    const status = WeatherLocationPolicy.status(undefined, { hasFailed: false });

    // Then
    expect(status).toEqual({ status: 'checking' });
  });

  it('위치 등록 요청이 실패하면 위치를 찾지 못한 상태다', () => {
    // When
    const status = WeatherLocationPolicy.status(undefined, { hasFailed: true });

    // Then
    expect(status).toEqual({ status: 'unavailable' });
  });

  it('권한은 있지만 좌표를 얻지 못하면 위치를 찾지 못한 상태다', () => {
    // When
    const status = WeatherLocationPolicy.status(
      { status: 'unavailable', revision: 0 },
      { hasFailed: false },
    );

    // Then
    expect(status).toEqual({ status: 'unavailable' });
  });

  it('등록을 마치면 지명과 함께 준비 상태가 된다', () => {
    // When
    const status = WeatherLocationPolicy.status(
      {
        status: 'located',
        registered: { ...SEOUL, timezone: 'Asia/Seoul' },
        place: { city: '서울', district: '중구' },
        countryCode: 'KR',
        revision: 1,
      },
      { hasFailed: false },
    );

    // Then
    expect(status).toEqual({
      status: 'ready',
      place: { city: '서울', district: '중구' },
      countryCode: 'KR',
    });
  });

  it.each(['needsPermission', 'denied'] as const)('권한 상태 %s를 그대로 전달한다', (state) => {
    // When
    const status = WeatherLocationPolicy.status({ status: state }, { hasFailed: false });

    // Then
    expect(status).toEqual({ status: state });
  });
});

describe('WeatherLocationPolicy.permissionResult', () => {
  it.each([
    [{ isGranted: true, canAskAgain: true }, 'granted'],
    [{ isGranted: false, canAskAgain: true }, 'needs_permission'],
    [{ isGranted: false, canAskAgain: false }, 'denied'],
    [null, 'needs_permission'],
  ] as const)('권한 요청 결과 %o는 %s로 기록한다', (permission, expected) => {
    // When
    const result = WeatherLocationPolicy.permissionResult(permission);

    // Then
    expect(result).toBe(expected);
  });
});

describe('WeatherLocationPolicy.foreignCountryName', () => {
  it('기기 지역과 다른 나라에 있으면 앱 언어로 나라 이름을 돌려준다', () => {
    // Given 베트남에 있고 기기 지역은 한국 When 한국어로 나라 이름을 구하면 Then 베트남이다
    const name = WeatherLocationPolicy.foreignCountryName({ countryCode: 'VN' }, 'KR', 'ko');

    expect(name).toBe('베트남');
  });

  it('기기 지역과 같은 나라면 나라 이름을 붙이지 않는다', () => {
    // Given 한국에 있고 기기 지역도 한국 When 나라 이름을 구하면 Then 없다
    const name = WeatherLocationPolicy.foreignCountryName({ countryCode: 'kr' }, 'KR', 'ko');

    expect(name).toBeNull();
  });

  it.each([
    [null, 'KR'],
    ['JP', null],
  ])('나라(%s)나 기기 지역(%s)을 모르면 나라 이름을 붙이지 않는다', (countryCode, region) => {
    // Given 나라나 기기 지역 중 하나를 모르고 When 나라 이름을 구하면 Then 없다
    const name = WeatherLocationPolicy.foreignCountryName({ countryCode }, region, 'ko');

    expect(name).toBeNull();
  });
});

describe('리포트 요청 가능 여부', () => {
  it.each([
    ['checking', true],
    ['unavailable', true],
    ['ready', true],
    ['needsPermission', false],
    ['denied', false],
  ] as const)('%s 상태에서 리포트를 받을 수 있는지는 %p이다', (status, expected) => {
    // Given / When / Then
    expect(WeatherLocationPolicy.canFetchReport(status)).toBe(expected);
  });
});
