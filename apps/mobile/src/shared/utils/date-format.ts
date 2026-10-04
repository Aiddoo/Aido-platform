export interface DateFormatContext {
  locale: 'ko-KR' | 'en-US';
  timeZone: string;
}

type DateLabel = 'fullDate' | 'monthDay' | 'dayOfMonth' | 'yearMonth' | 'month';

const DATE_OPTIONS: Record<DateLabel, Intl.DateTimeFormatOptions> = {
  fullDate: { year: 'numeric', month: 'long', day: 'numeric' },
  monthDay: { month: 'short', day: 'numeric' },
  dayOfMonth: { day: 'numeric' },
  yearMonth: { year: 'numeric', month: 'long' },
  month: { month: 'short' },
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();
const MAX_FORMATTERS = 32;

function getFormatter(context: DateFormatContext, options: Intl.DateTimeFormatOptions) {
  const key = JSON.stringify([context.locale, context.timeZone, options]);
  const cached = formatterCache.get(key);
  if (cached) return cached;

  if (formatterCache.size >= MAX_FORMATTERS) formatterCache.clear();
  const formatter = new Intl.DateTimeFormat(context.locale, {
    ...options,
    timeZone: context.timeZone,
  });
  formatterCache.set(key, formatter);
  return formatter;
}

export function formatDateLabel(date: Date, kind: DateLabel, context: DateFormatContext) {
  if (!Number.isFinite(date.getTime())) return '';
  const formatter = getFormatter(context, DATE_OPTIONS[kind]);
  if (kind === 'dayOfMonth') {
    const day = formatter.formatToParts(date).find((part) => part.type === 'day')?.value ?? '';
    return context.locale === 'ko-KR' ? `${day}일` : day;
  }
  return formatter.format(date);
}

export function formatClockTime(
  date: Date,
  timeFormat: 'TWELVE_HOUR' | 'TWENTY_FOUR_HOUR',
  context: DateFormatContext,
) {
  if (!Number.isFinite(date.getTime())) return '';
  const formatter = getFormatter(context, {
    hour: timeFormat === 'TWENTY_FOUR_HOUR' ? '2-digit' : 'numeric',
    minute: '2-digit',
    hourCycle: timeFormat === 'TWENTY_FOUR_HOUR' ? 'h23' : 'h12',
  });
  const parts = formatter.formatToParts(date);
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '';
  const dayPeriod = parts.find((part) => part.type === 'dayPeriod')?.value;
  return dayPeriod ? `${dayPeriod} ${hour}:${minute}` : `${hour}:${minute}`;
}

export function formatDateKey(date: Date, timeZone: string): string {
  if (!Number.isFinite(date.getTime())) return '';
  const parts = getFormatter(
    { locale: 'en-US', timeZone },
    { year: 'numeric', month: '2-digit', day: '2-digit' },
  ).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return year && month && day ? `${year}-${month}-${day}` : '';
}
