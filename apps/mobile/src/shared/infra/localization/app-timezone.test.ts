import type * as NodeCrypto from 'node:crypto';

import { SERVICE_DEFAULT_TIMEZONE } from '@aido/api/vocabulary';
import { readLocalDateState } from '@src/shared/date/clock';
import { toInstant } from '@src/shared/date/instant';
import { lastReadTimezoneStoredValue } from '@src/shared/date/schemas/last-read-timezone-storage.schema';
import { toDateKey } from '@src/shared/date/zoned';
import { readStoredValue, removeStoredValue } from '@src/shared/storage/define-stored-value';
import { getCalendars } from 'expo-localization';

import { toImportEventPreview } from '../calendar/calendar-import-record';
import { setPerRequestHeaders } from '../http/request-headers';
import { deviceSyncStorage } from '../storage/device-sync-storage';
import { getAppTimezone, getDeviceSystemTimezone, refreshAppTimezone } from './app-timezone';

// 네이티브 expo-crypto는 Jest에 없으므로 같은 계약(UUID v4)의 Node 구현으로 바꾼다
jest.mock('expo-crypto', () => ({
  randomUUID: () => jest.requireActual<typeof NodeCrypto>('node:crypto').randomUUID(),
}));

// 서울 11-26 01:00이자 뉴욕 11-25 11:00, 런던 11-25 16:00인 순간
const NOW = toInstant('2026-11-25T16:00:00.000Z');
const deviceCalendars = jest.mocked(getCalendars).getMockImplementation();

function setDeviceTimezone(timezone: string | null) {
  jest
    .mocked(getCalendars)
    .mockReturnValue([
      { calendar: null, uses24hourClock: false, firstWeekday: 1, timeZone: timezone },
    ]);
}

/** LocalDateProvider가 재평가할 때처럼 기기 시간대를 바꾸고 앱 시간대를 다시 정한다 */
function moveDeviceTo(timezone: string | null) {
  setDeviceTimezone(timezone);
  refreshAppTimezone();
}

/** 한 시점에 앱이 계산에 쓰는 시간대·오늘 key와 요청 헤더에 싣는 시간대 */
function readAppTimezoneUse() {
  const headers = new Headers();
  setPerRequestHeaders(headers);
  const { currentTimezone, currentLocalDateKey } = readLocalDateState({ now: NOW });
  return { currentTimezone, currentLocalDateKey, header: headers.get('X-Timezone') };
}

function readLastReadTimezone() {
  return readStoredValue(deviceSyncStorage, lastReadTimezoneStoredValue);
}

beforeEach(() => {
  removeStoredValue(deviceSyncStorage, lastReadTimezoneStoredValue);
});

// randomize로 다음 파일·테스트가 이 파일의 기기 달력·마지막 값을 물려받지 않게 되돌린다
afterEach(() => {
  jest.mocked(getCalendars).mockImplementation(deviceCalendars);
  removeStoredValue(deviceSyncStorage, lastReadTimezoneStoredValue);
  refreshAppTimezone();
});

describe('refreshAppTimezone', () => {
  it('서울 사용자 기기가 시간대를 한 번 못 읽으면 오늘 key와 요청 헤더가 함께 마지막으로 읽은 서울이다', () => {
    // Given
    moveDeviceTo('Asia/Seoul');

    // When
    moveDeviceTo(null);
    const used = readAppTimezoneUse();

    // Then
    expect(used).toEqual({
      currentTimezone: 'Asia/Seoul',
      currentLocalDateKey: toDateKey(NOW, 'Asia/Seoul'),
      header: 'Asia/Seoul',
    });
  });

  it('서울에서 뉴욕으로 오면 오늘 key·헤더·마지막으로 읽은 값이 함께 뉴욕이다', () => {
    // Given
    moveDeviceTo('Asia/Seoul');

    // When
    moveDeviceTo('America/New_York');
    const used = readAppTimezoneUse();

    // Then
    expect(used).toEqual({
      currentTimezone: 'America/New_York',
      currentLocalDateKey: '2026-11-25',
      header: 'America/New_York',
    });
    expect(readLastReadTimezone()).toBe('America/New_York');
  });

  it('런던 겨울처럼 오프셋이 0인 지역 이름은 읽은 값으로 쓰고 보낸다', () => {
    // Given
    moveDeviceTo('Asia/Seoul');

    // When
    moveDeviceTo('Europe/London');
    const used = readAppTimezoneUse();

    // Then
    expect(used.header).toBe('Europe/London');
    expect(used.currentTimezone).toBe('Europe/London');
  });

  it('기기를 일부러 Etc/UTC로 맞추면 마지막으로 읽은 이름을 쓰고 남긴 값도 바꾸지 않는다', () => {
    // Given
    moveDeviceTo('Asia/Seoul');

    // When
    moveDeviceTo('Etc/UTC');
    const used = readAppTimezoneUse();

    // Then
    expect(used.header).toBe('Asia/Seoul');
    expect(used.currentTimezone).toBe('Asia/Seoul');
    expect(readLastReadTimezone()).toBe('Asia/Seoul');
  });

  it('처음 설치했는데 못 읽으면 서비스 기본 시간대로 계산하고 보내며 남기지 않는다', () => {
    // When
    moveDeviceTo('UTC');
    const used = readAppTimezoneUse();

    // Then
    expect(used.header).toBe(SERVICE_DEFAULT_TIMEZONE);
    expect(used.currentTimezone).toBe(SERVICE_DEFAULT_TIMEZONE);
    expect(readLastReadTimezone()).toBeNull();
  });
});

describe('getAppTimezone', () => {
  it('정해 둔 값만 읽어 다시 정하기 전까지 화면의 오늘과 요청 헤더가 같은 값이다', () => {
    // Given
    moveDeviceTo('Asia/Seoul');
    setDeviceTimezone('America/New_York');
    jest.mocked(getCalendars).mockClear();

    // When
    const used = readAppTimezoneUse();

    // Then
    expect(used).toEqual({
      currentTimezone: 'Asia/Seoul',
      currentLocalDateKey: toDateKey(NOW, 'Asia/Seoul'),
      header: 'Asia/Seoul',
    });
    expect(getCalendars).not.toHaveBeenCalled();
    expect(readLastReadTimezone()).toBe('Asia/Seoul');
  });
});

describe('getDeviceSystemTimezone', () => {
  it('UTC로 맞춘 기기는 앱 시간대가 서울이어도 기기 시간대 UTC 그대로다', () => {
    // Given
    moveDeviceTo('UTC');

    // When
    const timezone = getDeviceSystemTimezone();

    // Then
    expect(getAppTimezone()).toBe(SERVICE_DEFAULT_TIMEZONE);
    expect(timezone).toBe('UTC');
  });

  it('UTC로 맞춘 iOS 기기가 준 하루 종일 일정은 하루다', () => {
    // Given
    // iOS는 종일 일정을 기기 시간대의 00:00부터 그날 23:59:59까지로 준다
    moveDeviceTo('UTC');
    const event = {
      id: 'event-1',
      calendarId: 'calendar-1',
      title: '휴가',
      startDate: '2026-11-26T00:00:00.000Z',
      endDate: '2026-11-26T23:59:59.000Z',
      allDay: true,
      status: null,
    };

    // When
    const preview = toImportEventPreview({
      event,
      collectionKey: 'collection-1',
      allDayTimezone: getDeviceSystemTimezone(),
    });

    // Then
    expect(preview?.time).toEqual({
      kind: 'allDay',
      startDate: '2026-11-26',
      endDateExclusive: '2026-11-27',
    });
  });

  it('런타임이 모르는 이름이면 앱 시간대로 읽는다', () => {
    // Given
    moveDeviceTo('Asia/Seoul');

    // When
    setDeviceTimezone('Mars/Olympus');
    const timezone = getDeviceSystemTimezone();

    // Then
    expect(timezone).toBe('Asia/Seoul');
  });
});
