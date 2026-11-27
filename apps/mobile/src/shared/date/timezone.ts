import { SERVICE_DEFAULT_TIMEZONE, UTC_EQUIVALENT_TIMEZONE_NAMES } from '@aido/api/vocabulary';
import { memoize } from 'es-toolkit';

/** 런타임 Intl이 그 시간대 이름을 아는가. Hermes는 Node보다 아는 이름이 적다 */
export type TimezoneSupport = (timezone: string) => boolean;

interface AppTimezone {
  timezone: string;
  /** 기기에서 지금 읽은 값인가. 마지막으로 읽은 값으로 남길지를 정한다 */
  isDeviceRead: boolean;
}

const UTC_EQUIVALENT_NAMES = new Set<string>(
  UTC_EQUIVALENT_TIMEZONE_NAMES.map((name) => name.toLowerCase()),
);

// 기기 설정이 만드는 사용자 지정 ID(GMT+1·GMT+09:00·UTC+9). IANA 이름이 아니라 런타임이 받아도 읽지 못한 값이다.
// Etc/GMT-9는 IANA 이름이라 앞에 붙은 Etc/ 때문에 걸리지 않는다
const CUSTOM_OFFSET_TIMEZONE_ID = /^(?:GMT|UTC)[+-]\d{1,2}(?::?\d{2})?$/i;

/**
 * 포매터를 만들 수 있는 이름인가. Hermes가 모르는 이름이면 Intl.DateTimeFormat이 RangeError를 던진다. Intl에는 이름을
 * 확인하는 API가 없고(supportedValuesOf는 대표 이름만 준다) 런타임이 아는 이름은 바뀌지 않아 아는 이름·모르는 이름을 모두 기억한다
 */
export const isSupportedTimezone: TimezoneSupport = memoize((timezone: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).resolvedOptions();
    return true;
  } catch {
    return false;
  }
});

function isUtcOffset(value: string): boolean {
  return value.startsWith('+') || value.startsWith('-') || CUSTOM_OFFSET_TIMEZONE_ID.test(value);
}

/**
 * 기기가 준 시간대를 읽는다. 읽었는가(null 여부)는 서버 parseDeviceReportedTimezone과 같고, 표기(대소문자)는 서버가
 * 정식 표기로 맞춘다. 없음·빈 값, 고정 오프셋·사용자 지정 ID, UTC와 같은 이름(대소문자 무시), 런타임이 모르는 이름은
 * 읽지 못한 것(null)이다. 판정은 이름으로만 해 Europe/London은 읽은 값이다
 */
export function parseDeviceReportedTimezone(
  value: string | null | undefined,
  isSupported: TimezoneSupport,
): string | null {
  if (value == null || value.trim() === '' || isUtcOffset(value)) {
    return null;
  }
  if (UTC_EQUIVALENT_NAMES.has(value.toLowerCase()) || !isSupported(value)) {
    return null;
  }
  return value;
}

/** 앱이 계산에 쓰고 서버에 보내는 시간대. 기기에서 읽은 값 → 마지막으로 읽은 값 → 서비스 기본 시간대 순서다 */
export function resolveAppTimezone(
  {
    deviceTimezone,
    lastReadTimezone,
  }: { deviceTimezone: string | null | undefined; lastReadTimezone: string | null },
  isSupported: TimezoneSupport,
): AppTimezone {
  const read = parseDeviceReportedTimezone(deviceTimezone, isSupported);
  if (read != null) {
    return { timezone: read, isDeviceRead: true };
  }
  return {
    timezone:
      parseDeviceReportedTimezone(lastReadTimezone, isSupported) ?? SERVICE_DEFAULT_TIMEZONE,
    isDeviceRead: false,
  };
}
