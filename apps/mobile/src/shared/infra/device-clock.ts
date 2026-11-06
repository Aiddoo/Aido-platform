import { getCalendars } from 'expo-localization';

/** 기기의 IANA 시간대. 시스템 설정 변경이 반영되도록 호출할 때마다 읽는다 (예: 'Asia/Seoul') */
export function getDeviceTimezone(): string {
  return getCalendars()[0]?.timeZone ?? 'UTC';
}
