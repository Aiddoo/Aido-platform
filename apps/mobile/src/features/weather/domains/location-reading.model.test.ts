import {
  type LocationReading,
  LocationReadingPolicy,
  shouldFetchReport,
  shouldRelocate,
} from './location-reading.model';

const SEOUL = { latitude: 37.5636, longitude: 126.9976 };
const BUSAN = { latitude: 35.1796, longitude: 129.0756 };

function createUnavailableReading(revision: number): LocationReading {
  return { status: 'unavailable', revision };
}

const LOCATED = {
  status: 'located',
  registered: { ...SEOUL, timezone: 'Asia/Seoul' },
  place: { city: '서울', district: '중구' },
  countryCode: 'KR',
  revision: 1,
  isLastKnown: false,
} as const satisfies LocationReading;

describe('shouldRelocate', () => {
  it('등록한 위치가 없으면 다시 등록한다', () => {
    // When
    const needed = shouldRelocate(SEOUL, null);

    // Then
    expect(needed).toBe(true);
  });

  it('위도·경도가 0.01도 미만으로 바뀌면 다시 등록하지 않는다', () => {
    // When
    const needed = shouldRelocate(
      { latitude: SEOUL.latitude + 0.0099, longitude: SEOUL.longitude - 0.0099 },
      SEOUL,
    );

    // Then
    expect(needed).toBe(false);
  });

  it('위도나 경도 중 하나라도 0.01도 이상 바뀌면 다시 등록한다', () => {
    // When
    const needed = shouldRelocate(
      { latitude: SEOUL.latitude, longitude: SEOUL.longitude + 0.01 },
      SEOUL,
    );

    // Then
    expect(needed).toBe(true);
  });
});

describe('shouldFetchReport', () => {
  it.each([
    ['checking', true],
    ['unavailable', true],
    ['ready', true],
    ['needsPermission', false],
    ['denied', false],
  ] as const)('%s 상태에서 리포트를 받을 수 있는지는 %p이다', (status, expected) => {
    // When
    const canFetch = shouldFetchReport(status);

    // Then
    expect(canFetch).toBe(expected);
  });
});

describe('LocationReadingPolicy', () => {
  describe('getNextRevision', () => {
    it('등록한 위치가 이미 받은 리포트와 같은 격자면 리비전을 그대로 둬 다시 받지 않는다', () => {
      // Given
      const previous = createUnavailableReading(0);

      // When
      const revision = LocationReadingPolicy.getNextRevision(previous, SEOUL, SEOUL);

      // Then
      expect(revision).toBe(0);
    });

    it('등록한 위치가 리포트와 다른 격자면 리비전을 올려 다시 받는다', () => {
      // Given
      const previous = createUnavailableReading(0);

      // When
      const revision = LocationReadingPolicy.getNextRevision(previous, BUSAN, SEOUL);

      // Then
      // 0 + 1 = 1
      expect(revision).toBe(1);
    });

    it('비교할 리포트가 없으면(서버에 위치가 없던 경우) 리비전을 올려 등록 뒤 다시 받는다', () => {
      // Given
      const previous = createUnavailableReading(2);

      // When
      const revision = LocationReadingPolicy.getNextRevision(previous, SEOUL, null);

      // Then
      // 2 + 1 = 3
      expect(revision).toBe(3);
    });

    it('위치를 읽기 전이면 서버 저장 위치 리비전에서 올린다', () => {
      // When
      const revision = LocationReadingPolicy.getNextRevision(undefined, BUSAN, SEOUL);

      // Then
      // 서버 저장 위치 리비전 0 + 1
      expect(revision).toBe(1);
    });
  });

  describe('getRevision', () => {
    it('위치를 읽기 전에는 서버 저장 위치 리비전으로 리포트를 바로 받는다', () => {
      // When
      const revision = LocationReadingPolicy.getRevision(undefined);

      // Then
      expect(revision).toBe(0);
    });
  });

  describe('getStatus', () => {
    it('권한은 있지만 좌표를 얻지 못하면 위치를 찾지 못한 상태다', () => {
      // When
      const status = LocationReadingPolicy.getStatus({
        status: 'unavailable',
        revision: 0,
      });

      // Then
      expect(status).toEqual({ status: 'unavailable' });
    });

    it('등록을 마치면 지명과 함께 준비 상태가 된다', () => {
      // When
      const status = LocationReadingPolicy.getStatus({
        status: 'located',
        registered: { ...SEOUL, timezone: 'Asia/Seoul' },
        place: { city: '서울', district: '중구' },
        countryCode: 'KR',
        revision: 1,
        isLastKnown: false,
      });

      // Then
      expect(status).toEqual({
        status: 'ready',
        place: { city: '서울', district: '중구' },
        countryCode: 'KR',
        isLastKnown: false,
      });
    });

    it('권한을 확인하지 못해 직전 위치를 쓰는 중이면 마지막 위치임을 알린다', () => {
      // When
      const status = LocationReadingPolicy.getStatus({
        status: 'located',
        registered: { ...SEOUL, timezone: 'Asia/Seoul' },
        place: { city: '서울', district: '중구' },
        countryCode: 'KR',
        revision: 1,
        isLastKnown: true,
      });

      // Then
      expect(status).toMatchObject({ status: 'ready', isLastKnown: true });
    });

    it.each(['needsPermission', 'denied'] as const)('권한 상태 %s를 그대로 전달한다', (state) => {
      // When
      const status = LocationReadingPolicy.getStatus({ status: state });

      // Then
      expect(status).toEqual({ status: state });
    });
  });

  describe('withLastKnown', () => {
    it.each([true, false])(
      '읽은 위치의 마지막 위치 표시를 %s로 바꾸고 나머지는 둔다',
      (isLastKnown) => {
        // When
        const reading = LocationReadingPolicy.withLastKnown(LOCATED, isLastKnown);

        // Then
        expect(reading).toEqual({ ...LOCATED, isLastKnown });
      },
    );

    it('위치를 읽지 못한 결과는 그대로다', () => {
      // Given
      const unavailable = createUnavailableReading(1);

      // When
      const reading = LocationReadingPolicy.withLastKnown(unavailable, true);

      // Then
      expect(reading).toBe(unavailable);
    });
  });

  describe('withPlaceRead', () => {
    it('다시 읽은 지명으로 바꾸고 마지막 위치 표시를 푼다', () => {
      // Given
      const lastKnown = { ...LOCATED, isLastKnown: true };

      // When
      const reading = LocationReadingPolicy.withPlaceRead(lastKnown, {
        name: { city: '서울', district: '종로구' },
        countryCode: 'KR',
      });

      // Then
      expect(reading).toMatchObject({
        place: { city: '서울', district: '종로구' },
        isLastKnown: false,
      });
    });

    it('지명을 읽지 못하면 앞의 지명과 나라를 둔다', () => {
      // When
      const reading = LocationReadingPolicy.withPlaceRead(LOCATED, {
        name: null,
        countryCode: null,
      });

      // Then
      expect(reading).toMatchObject({ place: LOCATED.place, countryCode: 'KR' });
    });
  });

  describe('withRegistered', () => {
    it('읽은 위치의 등록 위치만 바꾼다', () => {
      // Given
      const registered = { ...BUSAN, timezone: 'Asia/Seoul' };

      // When
      const reading = LocationReadingPolicy.withRegistered(LOCATED, registered);

      // Then
      expect(reading).toEqual({ ...LOCATED, registered });
    });

    it('권한이 없는 결과는 그대로다', () => {
      // When
      const reading = LocationReadingPolicy.withRegistered(
        { status: 'denied' },
        {
          ...BUSAN,
          timezone: 'Asia/Seoul',
        },
      );

      // Then
      expect(reading).toEqual({ status: 'denied' });
    });
  });
});
