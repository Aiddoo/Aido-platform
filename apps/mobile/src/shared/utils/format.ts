import type { ResolvedLanguage } from '@src/shared/preferences/language.preference';
import { match } from 'ts-pattern';

import type { DateFormatContext } from './date-format';

const ZERO_DECIMAL_CURRENCIES = new Set(['KRW', 'JPY']);

/** 통화 코드 → 해당 통화의 자연스러운 로케일 매핑 (스토어 지역 기반) */
const CURRENCY_LOCALE_MAP: Record<string, string> = {
  KRW: 'ko-KR',
  JPY: 'ja-JP',
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
  CNY: 'zh-CN',
  TWD: 'zh-TW',
  CAD: 'en-CA',
  AUD: 'en-AU',
};

function getLocaleForCurrency(currencyCode: string): string {
  return CURRENCY_LOCALE_MAP[currencyCode] ?? 'en-US';
}

/**
 * 개수 뱃지가 넘지 않는 상한. 이보다 크면 자릿수가 계속 늘어 옆 요소를 밀어낸다.
 */
export const COUNT_BADGE_MAX = 99;

/**
 * 좋아요·답글처럼 아이콘 옆에 붙는 개수를 상한까지만 보여준다.
 * 100부터는 "99+"로 접어, 숫자가 아무리 커져도 폭이 세 글자를 넘지 않는다.
 */
export function formatCappedCount(count: number, max: number = COUNT_BADGE_MAX): string {
  return count > max ? `${max}+` : `${count}`;
}

const ONE_DECIMAL = 10;

/** 소수 첫째 자리까지 버림해 표시한다. 소수가 0이면 정수만 쓴다 (19 → "1.9", 10 → "1") */
function formatTenths(tenths: number): string {
  const whole = Math.floor(tenths / ONE_DECIMAL);
  const decimal = tenths % ONE_DECIMAL;
  return decimal === 0 ? `${whole}` : `${whole}.${decimal}`;
}

function formatKoreanCompactCount(count: number): string {
  if (count < 10_000) {
    return `${formatTenths(Math.floor(count / 100))}천`;
  }
  if (count < 100_000) {
    return `${formatTenths(Math.floor(count / 1_000))}만`;
  }
  if (count < 100_000_000) {
    return `${Math.floor(count / 10_000)}만`;
  }
  return `${formatTenths(Math.floor(count / 10_000_000))}억`;
}

function formatEnglishCompactCount(count: number): string {
  if (count < 10_000) {
    return `${formatTenths(Math.floor(count / 100))}K`;
  }
  if (count < 1_000_000) {
    return `${Math.floor(count / 1_000)}K`;
  }
  if (count < 10_000_000) {
    return `${formatTenths(Math.floor(count / 100_000))}M`;
  }
  return `${Math.floor(count / 1_000_000)}M`;
}

/**
 * 좋아요·답글 수를 4글자 안팎으로 줄여 보여 준다 (ko 1.2천·1.2만·123만, en 1.2K·12K·1.2M).
 * Hermes가 Intl compact 표기를 보장하지 않아 직접 계산하고, 반올림하면 실제보다 커 보여 버림한다.
 */
export function formatCompactCount(count: number, language: ResolvedLanguage): string {
  if (count < 1_000) {
    return `${count}`;
  }
  return match(language)
    .with('ko', () => formatKoreanCompactCount(count))
    .with('en', () => formatEnglishCompactCount(count))
    .exhaustive();
}

/** 퍼센트 값을 소수점 첫째 자리까지 반올림하여 포맷한다. 정수면 소수점 생략. */
export function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : `${rounded.toFixed(1)}`;
}

/** 정수 개수를 앱 표시 언어의 자릿수 구분으로 표시한다 (예: "1,000"). */
export function formatCount(value: number, locale: DateFormatContext['locale']): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}

export function formatPrice(amount: number, currencyCode: string) {
  return new Intl.NumberFormat(getLocaleForCurrency(currencyCode), {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: ZERO_DECIMAL_CURRENCIES.has(currencyCode) ? 0 : 2,
  }).format(amount);
}
