import type { SubscriptionPlan } from '../domains/subscription.model';

/** 숫자로 시작하고 끝나며 사이에 구분 기호(쉼표·점·공백·작은따옴표·스위스식 ’)가 낄 수 있다 */
const STORE_NUMBER_PATTERN = /\d(?:[\d.,\s'’]*\d)?/;
const SEPARATOR_PATTERN = /[^\d]/g;

interface StoreNumberStyle {
  decimalSeparator: string | null;
  fractionDigits: number;
  groupSeparator: string;
}

/** 마지막 구분 기호 뒤 숫자가 1~2개면 소수점이다. 3개면 천 단위 구분이라 소수가 없는 통화다 */
function readStoreNumberStyle(numberText: string): StoreNumberStyle {
  const separators = numberText.match(SEPARATOR_PATTERN) ?? [];
  const lastSeparator = separators.at(-1);
  const fraction =
    lastSeparator == null ? '' : numberText.slice(numberText.lastIndexOf(lastSeparator) + 1);
  const hasFraction = lastSeparator != null && 0 < fraction.length && fraction.length <= 2;
  const decimalSeparator = hasFraction ? lastSeparator : null;
  const groupSeparator =
    separators.find((separator) => separator !== decimalSeparator) ??
    (decimalSeparator === ',' ? '.' : ',');

  return {
    decimalSeparator,
    fractionDigits: hasFraction ? fraction.length : 0,
    groupSeparator,
  };
}

/** 스토어 표기에서 숫자를 못 찾을 때만 쓴다 */
const FALLBACK_NUMBER_STYLE: StoreNumberStyle = {
  decimalSeparator: '.',
  fractionDigits: 2,
  groupSeparator: ',',
};

function formatWithStyle(amount: number, style: StoreNumberStyle): string {
  const [integerPart = '0', fractionPart] = amount.toFixed(style.fractionDigits).split('.');
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, style.groupSeparator);

  return fractionPart == null || style.decimalSeparator == null
    ? groupedInteger
    : `${groupedInteger}${style.decimalSeparator}${fractionPart}`;
}

/** 같은 화면의 다른 금액(오늘 결제·월 환산)을 스토어 가격 표기와 같은 기호·자릿수·구분으로 적는다 */
export function formatPlanAmount(
  plan: Pick<SubscriptionPlan, 'priceString' | 'currencyCode'>,
  amount: number,
): string {
  const numberMatch = STORE_NUMBER_PATTERN.exec(plan.priceString);
  if (numberMatch == null) {
    return `${plan.currencyCode} ${formatWithStyle(amount, FALLBACK_NUMBER_STYLE)}`;
  }
  const [numberText] = numberMatch;
  const start = numberMatch.index;

  return `${plan.priceString.slice(0, start)}${formatWithStyle(amount, readStoreNumberStyle(numberText))}${plan.priceString.slice(start + numberText.length)}`;
}
