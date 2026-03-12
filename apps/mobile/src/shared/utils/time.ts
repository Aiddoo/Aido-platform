import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

export type TimeFormat = 'TWELVE_HOUR' | 'TWENTY_FOUR_HOUR';

export const toHHmm = (date: Date): string => dayjs(date).format('HH:mm');

export const getDateWithTime = (
  date: Date,
  time: string | undefined,
  fallbackTime: string,
): Date => {
  const parsed = dayjs(time ?? fallbackTime, 'HH:mm', true);
  const safe = parsed.isValid() ? parsed : dayjs(fallbackTime, 'HH:mm', true);

  return dayjs(date).hour(safe.hour()).minute(safe.minute()).second(0).millisecond(0).toDate();
};

/** 시간+분 정수를 오늘 날짜의 Date 객체로 변환 (DatePicker용) */
export const timeToDate = (hour: number, minute: number): Date =>
  dayjs().hour(hour).minute(minute).second(0).millisecond(0).toDate();

/** 시간+분 정수를 디바이스 locale에 맞춰 포맷 (한국: "오전 8:30", 미국: "8:30 AM") */
export const formatReminderTime = (
  hour: number,
  minute: number,
  timeFormat: TimeFormat = 'TWELVE_HOUR',
): string =>
  new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: timeFormat === 'TWELVE_HOUR',
  }).format(dayjs().hour(hour).minute(minute).second(0).toDate());

/** "HH:mm" 문자열을 사용자 시간 형식에 맞춰 표시용으로 변환 */
export const formatTimeDisplay = (
  time: string,
  timeFormat: TimeFormat = 'TWENTY_FOUR_HOUR',
): string => {
  if (timeFormat === 'TWENTY_FOUR_HOUR') return time;
  const parsed = dayjs(time, 'HH:mm', true);
  if (!parsed.isValid()) return time;
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(parsed.toDate());
};
