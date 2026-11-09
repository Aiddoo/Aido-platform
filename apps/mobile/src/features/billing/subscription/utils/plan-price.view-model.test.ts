import { formatPlanAmount } from './plan-price.view-model';

describe('formatPlanAmount', () => {
  it('스토어 가격 표기(US$)를 그대로 따라 다른 금액도 같은 기호·자릿수로 적는다', () => {
    // Given
    const plan = { priceString: 'US$79.99', currencyCode: 'USD' };

    // When
    const result = formatPlanAmount(plan, 79.99 / 12);

    // Then
    expect(result).toBe('US$6.67');
  });

  it('소수점이 없는 통화는 정수로 반올림하고 천 단위 구분을 따른다', () => {
    // Given
    const plan = { priceString: '₩59,000', currencyCode: 'KRW' };

    // When
    const result = formatPlanAmount(plan, 59_000 / 12);

    // Then
    expect(result).toBe('₩4,917');
  });

  it('쉼표가 소수점인 표기와 뒤에 붙는 통화 기호를 지킨다', () => {
    // Given
    const plan = { priceString: '1.234,99 €', currencyCode: 'EUR' };

    // When
    const result = formatPlanAmount(plan, 1_234.99 / 12);

    // Then
    expect(result).toBe('102,92 €');
  });

  it('큰 금액은 스토어와 같은 천 단위 구분 기호를 넣는다', () => {
    // Given
    const plan = { priceString: 'US$79.99', currencyCode: 'USD' };

    // When
    const result = formatPlanAmount(plan, 1_234.5);

    // Then
    expect(result).toBe('US$1,234.50');
  });

  it('스위스식 천 단위 구분(’)도 숫자 안으로 읽는다', () => {
    // Given
    const plan = { priceString: 'CHF 1’234.00', currencyCode: 'CHF' };

    // When
    const result = formatPlanAmount(plan, 1_234 / 12);

    // Then
    expect(result).toBe('CHF 102.83');
  });

  it('스토어 표기에서 숫자를 찾지 못하면 통화 코드로 적는다', () => {
    // Given
    const plan = { priceString: '무료', currencyCode: 'USD' };

    // When
    const result = formatPlanAmount(plan, 6.5);

    // Then
    expect(result).toBe('USD 6.50');
  });
});
