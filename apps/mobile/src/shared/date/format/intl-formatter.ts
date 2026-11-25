import { SERVICE_DEFAULT_TIMEZONE } from '@aido/api/vocabulary';

import { isSupportedTimezone } from '../timezone';

interface FormatterContext {
  locale: string;
  timezone: string;
}

// 파트로 숫자를 읽을 때 쓰는 고정 로케일. 표시 언어와 무관하다
const PARTS_LOCALE = 'en-US';

// 계산용 파트는 로케일·기기 설정의 기본값에 기대지 않고 그레고리력·라틴 숫자·0~23시로 고정한다
const PARTS_OPTIONS = {
  calendar: 'gregory',
  numberingSystem: 'latn',
} as const satisfies Intl.DateTimeFormatOptions;
const PARTS_HOUR_CYCLE = { hourCycle: 'h23' } as const satisfies Intl.DateTimeFormatOptions;

// 시간대 계산과 표시가 같은 포매터를 번갈아 쓴다. 넘치면 가장 오래 안 쓴 것 하나만 버린다(Map은 넣은 순서다)
const formatterCache = new Map<string, Intl.DateTimeFormat>();
const MAX_FORMATTERS = 32;

/**
 * 캐시한 포매터. 계산·표시가 쓰는 Intl.DateTimeFormat은 여기서만 만든다(이름 확인은 isSupportedTimezone).
 * 서버가 준 시간대나 옛 저장값을 런타임(Hermes)이 모르면 렌더 중 RangeError를 던지지 않고 서비스 기본 시간대로 그린다.
 * 렌더를 지키는 마지막 안전망이고, 다른 시간대를 모른다는 것을 화면에 알리는 일은 그 값을 읽는 쪽이 한다
 */
export function getFormatter(
  context: FormatterContext,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const timezone = isSupportedTimezone(context.timezone)
    ? context.timezone
    : SERVICE_DEFAULT_TIMEZONE;
  const key = JSON.stringify([context.locale, timezone, options]);
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
  const formatter = new Intl.DateTimeFormat(context.locale, { ...options, timeZone: timezone });
  formatterCache.set(key, formatter);
  return formatter;
}

/** 날짜 key·벽시계·오프셋 계산처럼 글자가 아니라 숫자 파트를 읽는 포매터 */
export function getPartsFormatter(
  timezone: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  return getFormatter(
    { locale: PARTS_LOCALE, timezone },
    { ...options, ...PARTS_OPTIONS, ...(options.hour != null && PARTS_HOUR_CYCLE) },
  );
}

export function getPartValue(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): string {
  return parts.find((part) => part.type === type)?.value ?? '';
}

const HOURS_PER_DAY = 24;

/**
 * 시 파트를 0~23으로 읽는다. Android Hermes가 hourCycle h23을 무시하고 h24로 그리면 자정이 "24"로 온다(기기 미확인).
 * 그때도 날짜 파트는 이미 새 날이라 24만 0으로 읽으면 된다
 */
export function getHourPartValue(parts: Intl.DateTimeFormatPart[]): number {
  return Number(getPartValue(parts, 'hour')) % HOURS_PER_DAY;
}
