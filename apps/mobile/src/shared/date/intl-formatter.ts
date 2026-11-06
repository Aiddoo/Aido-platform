interface FormatterContext {
  locale: string;
  timeZone: string;
}

/** 파트로 숫자를 읽을 때 쓰는 고정 로케일. 표시 언어와 무관하다 */
export const PARTS_LOCALE = 'en-US';

const formatterCache = new Map<string, Intl.DateTimeFormat>();
const MAX_FORMATTERS = 32;

export function getFormatter(
  context: FormatterContext,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
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

export function isValidDate(date: Date): boolean {
  return Number.isFinite(date.getTime());
}

export function findPart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): string {
  return parts.find((part) => part.type === type)?.value ?? '';
}
