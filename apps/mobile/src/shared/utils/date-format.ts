export interface DateFormatContext {
  locale: 'ko-KR' | 'en-US';
  timeZone: string;
}

type DateLabel = 'fullDate' | 'monthDay' | 'dayOfMonth' | 'yearMonth' | 'month' | 'weekday';

const DATE_OPTIONS: Record<DateLabel, Intl.DateTimeFormatOptions> = {
  fullDate: { year: 'numeric', month: 'long', day: 'numeric' },
  monthDay: { month: 'short', day: 'numeric' },
  dayOfMonth: { day: 'numeric' },
  yearMonth: { year: 'numeric', month: 'long' },
  month: { month: 'short' },
  weekday: { weekday: 'short' },
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();
const MAX_FORMATTERS = 32;

function getFormatter(context: DateFormatContext, options: Intl.DateTimeFormatOptions) {
  const key = JSON.stringify([context.locale, context.timeZone, options]);
  const cached = formatterCache.get(key);
  if (cached) {
    return cached;
  }

  if (formatterCache.size >= MAX_FORMATTERS) {
    formatterCache.clear();
  }
  const formatter = new Intl.DateTimeFormat(context.locale, {
    ...options,
    timeZone: context.timeZone,
  });
  formatterCache.set(key, formatter);
  return formatter;
}

export function formatDateLabel(date: Date, kind: DateLabel, context: DateFormatContext) {
  if (!Number.isFinite(date.getTime())) {
    return '';
  }
  const formatter = getFormatter(context, DATE_OPTIONS[kind]);
  if (kind === 'dayOfMonth') {
    const day = formatter.formatToParts(date).find((part) => part.type === 'day')?.value ?? '';
    return context.locale === 'ko-KR' ? `${day}일` : day;
  }
  return formatter.format(date);
}

/** YYYY-MM-DD 날짜 key를 기기 시간대와 무관하게 그 날짜 그대로 표시한다. */
export function formatDateKeyLabel(dateKey: string, kind: DateLabel, context: DateFormatContext) {
  return formatDateLabel(new Date(`${dateKey}T00:00:00Z`), kind, { ...context, timeZone: 'UTC' });
}

/** 로케일 순서의 시:분 (ko: "오전 8:30", en: "8:30 AM", 24시간제: "18:30"). */
export function formatClockTime(
  date: Date,
  timeFormat: 'TWELVE_HOUR' | 'TWENTY_FOUR_HOUR',
  context: DateFormatContext,
): string {
  if (!Number.isFinite(date.getTime())) {
    return '';
  }
  const hourCycleOptions: Intl.DateTimeFormatOptions =
    timeFormat === 'TWELVE_HOUR' ? { hour12: true } : { hourCycle: 'h23' };
  return getFormatter(context, { hour: 'numeric', minute: '2-digit', ...hourCycleOptions }).format(
    date,
  );
}

/** 로케일 기본 순서의 시:분 (ko: "오전 8:30", en: "8:30 AM"). hour12가 false면 "18:30". */
export function formatLocaleTime(date: Date, hour12: boolean, context: DateFormatContext) {
  if (!Number.isFinite(date.getTime())) {
    return '';
  }
  return getFormatter(context, { hour: 'numeric', minute: '2-digit', hour12 }).format(date);
}

export function formatDateKey(date: Date, timeZone: string): string {
  if (!Number.isFinite(date.getTime())) {
    return '';
  }
  const parts = getFormatter(
    { locale: 'en-US', timeZone },
    { year: 'numeric', month: '2-digit', day: '2-digit' },
  ).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return year && month && day ? `${year}-${month}-${day}` : '';
}
