import { lastReadTimezoneStoredValue } from '@src/shared/date/schemas/last-read-timezone-storage.schema';
import { isSupportedTimezone, resolveAppTimezone } from '@src/shared/date/timezone';
import { readStoredValue, writeStoredValue } from '@src/shared/storage/define-stored-value';
import { getCalendars } from 'expo-localization';

import { deviceSyncStorage } from '../storage/device-sync-storage';

// 앱이 정해 둔 시간대. 화면의 오늘(LocalDateProvider)과 요청 헤더·푸시 기기 보고가 한 순간에 같은 값을 보게 한 곳에 둔다
let appTimezone: string | null = null;

function readDeviceTimezone(): string | null {
  return getCalendars()[0]?.timeZone ?? null;
}

/** LocalDateProvider의 재평가(시작·복귀·자정·달력 변경)와 Provider 없이 도는 진입점(헤드리스 위젯)만 부른다 */
export function refreshAppTimezone(): string {
  const lastReadTimezone = readStoredValue(deviceSyncStorage, lastReadTimezoneStoredValue);
  const { timezone, isDeviceRead } = resolveAppTimezone(
    { deviceTimezone: readDeviceTimezone(), lastReadTimezone },
    isSupportedTimezone,
  );
  if (isDeviceRead && timezone !== lastReadTimezone) {
    writeStoredValue(deviceSyncStorage, lastReadTimezoneStoredValue, timezone);
  }
  appTimezone = timezone;
  return timezone;
}

/** Provider보다 먼저 도는 경로가 있어 아직 정한 적이 없을 때만 한 번 정한다 */
export function getAppTimezone(): string {
  return appTimezone ?? refreshAppTimezone();
}

/** 기기가 만든 Date(캘린더 종일 일정의 00:00~23:59:59)를 해석할 때만 쓴다. 앱 시간대와 달리 UTC도 읽은 값이다 */
export function getDeviceSystemTimezone(): string {
  const timezone = readDeviceTimezone();
  return timezone != null && isSupportedTimezone(timezone) ? timezone : getAppTimezone();
}
