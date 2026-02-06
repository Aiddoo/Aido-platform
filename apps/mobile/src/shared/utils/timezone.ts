/**
 * 디바이스의 IANA 타임존을 반환
 * @example getDeviceTimezone() // 'Asia/Seoul'
 */
export const getDeviceTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
  } catch {
    return 'UTC';
  }
};
