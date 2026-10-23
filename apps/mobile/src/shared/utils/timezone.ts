import { getCalendars } from 'expo-localization';

/**
 * 디바이스의 IANA 타임존을 반환
 * 시스템 설정 변경이 반영되도록 호출 시마다 읽는다.
 * @example getDeviceTimezone() // 'Asia/Seoul'
 */
export const getDeviceTimezone = (): string => getCalendars()[0]?.timeZone ?? 'UTC';
