import { getAnnualDiscountPercent, getMonthlyEquivalent } from './subscription.model';

describe('구독 가격 계산', () => {
  test.each([
    [8_900, 68_000, 36],
    [1_000, 12_000, 0],
  ])('월 %s원, 연 %s원의 할인율은 %s%%이다', (monthlyPrice, annualPrice, expected) => {
    // Given
    const prices = { monthlyPrice, annualPrice };
    // When
    const result = getAnnualDiscountPercent(prices.monthlyPrice, prices.annualPrice);
    // Then
    expect(result).toBe(expected);
  });

  test.each([
    [68_000, 5666.67],
    [12_000, 1_000],
  ])('연 %s원의 월 환산 금액은 %s원이다', (annualPrice, expected) => {
    // Given
    const price = annualPrice;
    // When
    const result = getMonthlyEquivalent(price);
    // Then
    expect(result).toBeCloseTo(expected, 2);
  });
});
