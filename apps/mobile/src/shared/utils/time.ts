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
