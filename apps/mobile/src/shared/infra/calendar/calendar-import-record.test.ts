import { createHash } from 'node:crypto';

import {
  type CalendarEventFields,
  getAndroidAccountKind,
  getIosAccountKind,
  toImportEventRecord,
} from './calendar-import-record';

const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

async function hashSha256(text: string) {
  return createHash('sha256').update(text).digest('hex');
}

function createEvent(overrides: Partial<CalendarEventFields> = {}): CalendarEventFields {
  return {
    id: 'event-1',
    calendarId: 'someone@gmail.com',
    title: '팀 회의',
    startDate: '2026-11-24T01:00:00.000Z',
    endDate: '2026-11-24T02:00:00.000Z',
    allDay: false,
    status: 'confirmed',
    ...overrides,
  };
}

function readRecord(event: CalendarEventFields, allDayTimezone = 'Asia/Seoul') {
  return toImportEventRecord({
    event,
    collectionKey: 'collection-key',
    allDayTimezone,
    hashText: hashSha256,
  });
}

describe('toImportEventRecord', () => {
  describe('종일 일정', () => {
    it.each([
      {
        scenario: 'iOS 서울 하루 일정은 기기 시간대 자정부터 그날 23:59:59까지다',
        startDate: '2026-11-23T15:00:00.000Z',
        endDate: '2026-11-24T14:59:59.000Z',
        timezone: 'Asia/Seoul',
        expected: { startDate: '2026-11-24', endDateExclusive: '2026-11-25' },
      },
      {
        scenario: 'iOS 뉴욕 서머타임 시작일은 23시간이어도 하루 일정이다',
        startDate: '2026-03-08T05:00:00.000Z',
        endDate: '2026-03-09T03:59:59.000Z',
        timezone: 'America/New_York',
        expected: { startDate: '2026-03-08', endDateExclusive: '2026-03-09' },
      },
      {
        scenario: 'iOS 베를린 서머타임이 끝나는 날을 지나는 이틀 일정은 이틀이다',
        startDate: '2026-10-24T22:00:00.000Z',
        endDate: '2026-10-26T22:59:59.000Z',
        timezone: 'Europe/Berlin',
        expected: { startDate: '2026-10-25', endDateExclusive: '2026-10-27' },
      },
      {
        scenario: 'Android UTC 자정 일정은 배타적 끝을 그대로 쓴다',
        startDate: '2026-11-24T00:00:00.000Z',
        endDate: '2026-11-25T00:00:00.000Z',
        timezone: 'UTC',
        expected: { startDate: '2026-11-24', endDateExclusive: '2026-11-25' },
      },
      {
        scenario: '끝이 시작과 같으면 하루 일정으로 본다',
        startDate: '2026-11-24T00:00:00.000Z',
        endDate: '2026-11-24T00:00:00.000Z',
        timezone: 'UTC',
        expected: { startDate: '2026-11-24', endDateExclusive: '2026-11-25' },
      },
    ])('$scenario', async ({ startDate, endDate, timezone, expected }) => {
      // Given
      const event = createEvent({ allDay: true, startDate, endDate });

      // When
      const record = await readRecord(event, timezone);

      // Then
      expect(record.time).toEqual({ kind: 'allDay', ...expected });
    });
  });

  it('시각 일정은 오프셋과 종일 시간대에 상관없이 같은 UTC 순간이다', async () => {
    // Given
    const event = createEvent({
      startDate: '2026-11-24T10:00:00.000+09:00',
      endDate: new Date('2026-11-24T02:00:00.000Z'),
    });

    // When
    const records = await Promise.all([
      readRecord(event, 'America/Los_Angeles'),
      readRecord(event, 'Asia/Seoul'),
    ]);

    // Then
    for (const record of records) {
      expect(record.time).toEqual({
        kind: 'timed',
        startsAt: '2026-11-24T01:00:00.000Z',
        endsAt: '2026-11-24T02:00:00.000Z',
      });
    }
  });

  it('반복 일정의 회차는 같은 일정 id여도 회차 시작마다 다른 sha256 키다', async () => {
    // Given
    const first = createEvent();
    const second = createEvent({
      startDate: '2026-12-01T01:00:00.000Z',
      endDate: '2026-12-01T02:00:00.000Z',
    });

    // When
    const [firstRecord, secondRecord, firstAgain] = await Promise.all([
      readRecord(first),
      readRecord(second),
      readRecord(first),
    ]);

    // Then
    expect(firstRecord.occurrenceKey).toMatch(SHA256_HEX_PATTERN);
    expect(firstRecord.occurrenceKey).not.toBe(secondRecord.occurrenceKey);
    expect(firstRecord.occurrenceKey).toBe(firstAgain.occurrenceKey);
    expect(JSON.stringify(firstRecord)).not.toContain('someone@gmail.com');
  });

  it('종일 일정의 회차 키는 기기 시간대가 바뀌어도 같은 날짜면 같다', async () => {
    // Given
    const seoulEvent = createEvent({
      allDay: true,
      startDate: '2026-11-23T15:00:00.000Z',
      endDate: '2026-11-24T14:59:59.000Z',
    });
    const newYorkEvent = createEvent({
      allDay: true,
      startDate: '2026-11-24T05:00:00.000Z',
      endDate: '2026-11-25T04:59:59.000Z',
    });

    // When
    const [seoulRecord, newYorkRecord] = await Promise.all([
      readRecord(seoulEvent, 'Asia/Seoul'),
      readRecord(newYorkEvent, 'America/New_York'),
    ]);

    // Then
    expect(seoulRecord.occurrenceKey).toBe(newYorkRecord.occurrenceKey);
  });

  it.each([
    { status: 'cancelled', isCanceled: true },
    { status: 'canceled', isCanceled: true },
    { status: 'confirmed', isCanceled: false },
    { status: null, isCanceled: false },
  ])('상태 $status는 취소 여부 $isCanceled이다', async ({ status, isCanceled }) => {
    // When
    const record = await readRecord(createEvent({ status }));

    // Then
    expect(record.isCanceled).toBe(isCanceled);
  });

  it('빈 제목은 제목 없음(null)이다', async () => {
    // When
    const record = await readRecord(createEvent({ title: '' }));

    // Then
    expect(record.title).toBeNull();
  });
});

describe('getIosAccountKind', () => {
  it.each([
    { calendarType: 'local', expected: 'local' },
    { calendarType: 'caldav', expected: 'cloud' },
    { calendarType: 'mobileme', expected: 'cloud' },
    { calendarType: 'exchange', expected: 'exchange' },
    { calendarType: 'subscribed', expected: 'subscribed' },
    { calendarType: 'birthdays', expected: 'birthdays' },
    { calendarType: 'unknown', expected: 'other' },
    { calendarType: null, expected: 'other' },
  ])('캘린더 종류 $calendarType는 $expected이다', ({ calendarType, expected }) => {
    // When
    const accountKind = getIosAccountKind({
      calendarType,
      title: '개인',
      allowsModifications: true,
    });

    // Then
    expect(accountKind).toBe(expected);
  });

  it.each([
    { title: '대한민국의 휴일', allowsModifications: false, expected: 'holidays' },
    { title: 'Holidays in United States', allowsModifications: false, expected: 'holidays' },
    { title: '日本の祝日', allowsModifications: false, expected: 'holidays' },
    { title: '팀 공유 일정', allowsModifications: false, expected: 'cloud' },
    { title: '휴일 근무표', allowsModifications: true, expected: 'cloud' },
  ])(
    'Google 계정의 CalDAV 캘린더 "$title"(수정 가능 $allowsModifications)는 $expected이다',
    ({ title, allowsModifications, expected }) => {
      // When
      const accountKind = getIosAccountKind({ calendarType: 'caldav', title, allowsModifications });

      // Then
      expect(accountKind).toBe(expected);
    },
  );
});

describe('getAndroidAccountKind', () => {
  it.each([
    {
      accountType: 'com.google',
      ownerAccount: 'ko.south_korea#holiday@group.v.calendar.google.com',
      expected: 'holidays',
    },
    {
      accountType: 'com.google',
      ownerAccount: 'addressbook#contacts@group.v.calendar.google.com',
      expected: 'birthdays',
    },
    {
      accountType: 'com.google',
      ownerAccount: 'e_2_ko#weeknum@group.v.calendar.google.com',
      expected: 'subscribed',
    },
    {
      accountType: 'com.google',
      ownerAccount: 'abc123@import.calendar.google.com',
      expected: 'subscribed',
    },
    { accountType: 'com.google', ownerAccount: 'someone@gmail.com', expected: 'cloud' },
    { accountType: 'LOCAL', ownerAccount: null, expected: 'local' },
    {
      accountType: 'com.google.android.gm.exchange',
      ownerAccount: 'someone@company.com',
      expected: 'exchange',
    },
    { accountType: null, ownerAccount: null, expected: 'other' },
  ])(
    '계정 종류 $accountType·소유 계정 $ownerAccount는 $expected이다',
    ({ accountType, ownerAccount, expected }) => {
      // When
      const accountKind = getAndroidAccountKind({ accountType, ownerAccount });

      // Then
      expect(accountKind).toBe(expected);
    },
  );
});
