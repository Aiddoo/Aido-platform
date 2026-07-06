import { i18n } from '@src/shared/i18n';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

export type TimeFormat = 'TWELVE_HOUR' | 'TWENTY_FOUR_HOUR';

/** 앱 표시 언어에 맞는 Intl 로케일 태그 */
const getIntlLocale = (): string => (i18n.language === 'en' ? 'en-US' : 'ko-KR');

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

/**
 * 네이티브 DateTimePicker의 locale prop 값.
 * 24시간제는 en_GB(오전/오후 없는 스피너)로 강제하고,
 * 12시간제는 앱 표시 언어를 따른다.
 */
export const getPickerLocale = (
  resolvedLanguage: 'ko' | 'en',
  timeFormat: TimeFormat = 'TWELVE_HOUR',
): string => {
  if (timeFormat === 'TWENTY_FOUR_HOUR') {
    return 'en_GB';
  }
  return resolvedLanguage === 'en' ? 'en_US' : 'ko';
};

/** 시간+분 정수를 앱 표시 언어에 맞춰 포맷 (ko: "오전 8:30", en: "8:30 AM") */
export const formatReminderTime = (
  hour: number,
  minute: number,
  timeFormat: TimeFormat = 'TWELVE_HOUR',
): string =>
  new Intl.DateTimeFormat(getIntlLocale(), {
    hour: 'numeric',
    minute: '2-digit',
    hour12: timeFormat === 'TWELVE_HOUR',
  }).format(dayjs().hour(hour).minute(minute).second(0).toDate());

/** "HH:mm" 문자열을 사용자 시간 형식에 맞춰 표시용으로 변환 */
export const formatTimeDisplay = (time: string, timeFormat: TimeFormat = 'TWELVE_HOUR'): string => {
  if (timeFormat === 'TWENTY_FOUR_HOUR') return time;
  const parsed = dayjs(time, 'HH:mm', true);
  if (!parsed.isValid()) return time;
  return new Intl.DateTimeFormat(getIntlLocale(), {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(parsed.toDate());
};
