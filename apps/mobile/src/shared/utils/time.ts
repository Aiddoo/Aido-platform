import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

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

/** 0-23 시간 정수를 오늘 날짜의 Date 객체로 변환 (DatePicker용) */
export const hourToDate = (hour: number): Date =>
  dayjs().hour(hour).minute(0).second(0).millisecond(0).toDate();

/** 0-23 시간 정수를 디바이스 locale에 맞춰 포맷 (한국: "오전 8:00", 미국: "8:00 AM") */
export const formatReminderHour = (hour: number): string =>
  new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(dayjs().hour(hour).minute(0).second(0).toDate());
