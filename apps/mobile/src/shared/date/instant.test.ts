import { getZonedHour, hasSameWallClock, toDateKey, toHHmm } from './instant';

describe('toDateKey', () => {
  it.each([
    ['서울 자정 직전', '2026-10-01T14:59:59.999Z', '2026-10-01', '2026-10-01'],
    ['서울 자정 정각', '2026-10-01T15:00:00.000Z', '2026-10-02', '2026-10-01'],
    ['LA 자정 정각', '2026-10-02T07:00:00.000Z', '2026-10-02', '2026-10-02'],
  ])('%s에는 같은 시각이어도 서울과 LA의 날짜가 다르다', (_name, iso, seoulKey, losAngelesKey) => {
    // Given
    const instant = new Date(iso);

    // When
    const seoul = toDateKey(instant, 'Asia/Seoul');
    const losAngeles = toDateKey(instant, 'America/Los_Angeles');

    // Then
    expect(seoul).toBe(seoulKey);
    expect(losAngeles).toBe(losAngelesKey);
  });

  it('윤일 경계에서 서울은 3월 1일, LA는 2월 29일이다', () => {
    // Given
    const instant = new Date('2028-02-29T15:00:00.000Z');

    // When
    const seoul = toDateKey(instant, 'Asia/Seoul');
    const losAngeles = toDateKey(instant, 'America/Los_Angeles');

    // Then
    expect(seoul).toBe('2028-03-01');
    expect(losAngeles).toBe('2028-02-29');
  });

  it('유효하지 않은 Date는 빈 문자열을 반환한다', () => {
    // Given
    const invalid = new Date(Number.NaN);

    // When
    const result = toDateKey(invalid, 'Asia/Seoul');

    // Then
    expect(result).toBe('');
  });
});

describe('getZonedHour', () => {
  it('지정 시간대의 0-23시를 반환한다', () => {
    expect(getZonedHour(new Date('2026-10-01T15:30:00Z'), 'Asia/Seoul')).toBe(0);
    expect(getZonedHour(new Date('2026-10-01T14:30:00Z'), 'Asia/Seoul')).toBe(23);
  });
});

describe('toHHmm — 시간대 기준 HH:mm', () => {
  it('같은 순간을 서울과 LA의 24시간제 HH:mm으로 읽는다', () => {
    // Given
    const instant = new Date('2028-02-29T15:05:00Z');

    // When
    const seoul = toHHmm(instant, 'Asia/Seoul');
    const losAngeles = toHHmm(instant, 'America/Los_Angeles');

    // Then
    expect(seoul).toBe('00:05');
    expect(losAngeles).toBe('07:05');
  });
});

describe('hasSameWallClock', () => {
  const instant = new Date('2026-10-01T06:20:00Z');

  it('이름이 달라도 오프셋이 같은 시간대는 같은 벽시계로 본다', () => {
    // Given 서울과 도쿄 When 비교하면 Then 같다
    expect(hasSameWallClock(instant, 'Asia/Seoul', 'Asia/Tokyo')).toBe(true);
  });

  it('30분 차이도 다른 벽시계로 본다', () => {
    // Given 인도(+5:30)와 파키스탄(+5:00) When 비교하면 Then 다르다
    expect(hasSameWallClock(instant, 'Asia/Kolkata', 'Asia/Karachi')).toBe(false);
  });

  it('서머타임으로 오프셋이 갈리는 날은 그날의 오프셋으로 판단한다', () => {
    // Given LA 서머타임 해제(11월 1일) 전후의 LA·피닉스
    const beforeFallBack = new Date('2026-10-31T20:00:00Z');
    const afterFallBack = new Date('2026-11-02T20:00:00Z');

    // When / Then 서머타임 동안(-7)만 같고 해제 뒤(-8 대 -7)에는 다르다
    expect(hasSameWallClock(beforeFallBack, 'America/Los_Angeles', 'America/Phoenix')).toBe(true);
    expect(hasSameWallClock(afterFallBack, 'America/Los_Angeles', 'America/Phoenix')).toBe(false);
  });
});
