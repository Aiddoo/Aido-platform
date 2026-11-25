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

/**
 * 기기에서 다시 읽어 앱 시간대를 정한다. 기기에서 읽은 값이 바뀌었으면 다음에 못 읽을 때를 위해 남긴다.
 * LocalDateProvider의 재평가(시작·복귀·자정·달력 변경)와 Provider 없이 도는 진입점(헤드리스 위젯)만 부른다
 */
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

/**
 * 앱이 오늘·표시를 계산하고 요청 헤더·푸시 기기 보고로 서버에 보내는 시간대. 정해 둔 값을 돌려주고, Provider보다 먼저
 * 도는 경로라 아직 정한 적이 없을 때만 한 번 정한다
 */
export function getAppTimezone(): string {
  return appTimezone ?? refreshAppTimezone();
}

/**
 * 기기 시스템 시간대 그대로. 기기가 만든 Date(캘린더 종일 일정의 00:00~23:59:59)를 해석할 때만 쓴다. 앱 시간대와 달리
 * UTC도 읽은 값이고, 런타임이 모르는 이름일 때만 앱 시간대로 읽는다
 */
export function getDeviceSystemTimezone(): string {
  const timezone = readDeviceTimezone();
  return timezone != null && isSupportedTimezone(timezone) ? timezone : getAppTimezone();
}
