import { getCalendars } from 'expo-localization';

/** 시스템 설정 변경이 반영되도록 호출할 때마다 읽는다 */
export function getDeviceTimezone(): string {
  return getCalendars()[0]?.timeZone ?? 'UTC';
}
