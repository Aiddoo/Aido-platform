import { SERVICE_DEFAULT_TIMEZONE } from '@aido/api/vocabulary';

import { toEpochMs, toInstant } from '../instant';
import { getZonedHour, getZoneOffsetMs, toDateKey, toHHmm } from '../zoned';
import { formatDateLabel } from './date-format';
import { getPartsFormatter } from './intl-formatter';

// 서울 11-26 00:05이자 뉴욕 11-25 10:05인 순간
const SEOUL_JUST_AFTER_MIDNIGHT = toInstant('2026-11-25T15:05:00.000Z');

describe('계산용 파트 포매터', () => {
  it('표시 언어·기기 설정과 무관하게 그레고리력·라틴 숫자·0~23시로 고정한다', () => {
    // When
    const resolved = getPartsFormatter('Asia/Seoul', {
      year: 'numeric',
      hour: '2-digit',
    }).resolvedOptions();

    // Then
    expect(resolved).toMatchObject({
      locale: 'en-US',
      calendar: 'gregory',
      numberingSystem: 'latn',
      hourCycle: 'h23',
    });
  });

  it('런타임이 h23을 무시하고 자정을 24시로 그려도 계산은 0시로 읽는다', () => {
    // Given
    // Android Hermes가 hourCycle을 무시하는 경우를 흉내 낸다(기기 미확인)
    const formatToParts = Intl.DateTimeFormat.prototype.formatToParts;
    jest.spyOn(Intl.DateTimeFormat.prototype, 'formatToParts').mockImplementation(function asH24(
      this: Intl.DateTimeFormat,
      date,
    ) {
      return formatToParts
        .call(this, date)
        .map((part) =>
          part.type === 'hour' && part.value === '00' ? { ...part, value: '24' } : part,
        );
    });

    // When
    const time = toHHmm(SEOUL_JUST_AFTER_MIDNIGHT, 'Asia/Seoul');
    const hour = getZonedHour(SEOUL_JUST_AFTER_MIDNIGHT, 'Asia/Seoul');
    const offsetMs = getZoneOffsetMs(toEpochMs(SEOUL_JUST_AFTER_MIDNIGHT), 'Asia/Seoul');

    // Then
    expect(time).toBe('00:05');
    expect(hour).toBe(0);
    expect(offsetMs).toBe(9 * 60 * 60 * 1000);
    expect(toDateKey(SEOUL_JUST_AFTER_MIDNIGHT, 'Asia/Seoul')).toBe('2026-11-26');
  });
});

describe('런타임이 모르는 시간대 이름', () => {
  it('서버가 준 이름을 런타임이 모르면 던지지 않고 서비스 기본 시간대로 계산하고 그린다', () => {
    // Given
    const unknownTimezone = 'Mars/Olympus';

    // When
    const dateKey = toDateKey(SEOUL_JUST_AFTER_MIDNIGHT, unknownTimezone);
    const label = formatDateLabel(SEOUL_JUST_AFTER_MIDNIGHT, 'monthDay', {
      locale: 'en-US',
      timezone: unknownTimezone,
    });

    // Then
    expect(dateKey).toBe(toDateKey(SEOUL_JUST_AFTER_MIDNIGHT, SERVICE_DEFAULT_TIMEZONE));
    expect(label).toBe(
      formatDateLabel(SEOUL_JUST_AFTER_MIDNIGHT, 'monthDay', {
        locale: 'en-US',
        timezone: SERVICE_DEFAULT_TIMEZONE,
      }),
    );
  });
});
