interface FormatterContext {
  locale: string;
  timeZone: string;
}

/** 파트로 숫자를 읽을 때 쓰는 고정 로케일. 표시 언어와 무관하다 */
export const PARTS_LOCALE = 'en-US';

// 시간대 계산과 표시가 같은 포매터를 번갈아 쓴다. 넘치면 가장 오래 안 쓴 것 하나만 버린다(Map은 넣은 순서다)
const formatterCache = new Map<string, Intl.DateTimeFormat>();
const MAX_FORMATTERS = 32;

export function getFormatter(
  context: FormatterContext,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = JSON.stringify([context.locale, context.timeZone, options]);
  const cached = formatterCache.get(key);
  if (cached != null) {
    formatterCache.delete(key);
    formatterCache.set(key, cached);
    return cached;
  }

  const oldestKey = formatterCache.keys().next().value;
  if (formatterCache.size >= MAX_FORMATTERS && oldestKey != null) {
    formatterCache.delete(oldestKey);
  }
  const formatter = new Intl.DateTimeFormat(context.locale, {
    ...options,
    timeZone: context.timeZone,
  });
  formatterCache.set(key, formatter);
  return formatter;
}

export function getPartValue(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): string {
  return parts.find((part) => part.type === type)?.value ?? '';
}
