import { toPurchaseFailedReason } from './subscription-analytics';

describe('toPurchaseFailedReason', () => {
  it.each([
    ['network', 'network'],
    ['server', 'server'],
    ['store', 'store_unavailable'],
    ['purchaseFailed', 'store_error'],
  ] as const)('문의로 안내한 실패 원인 %p는 사유 %p로 센다', (cause, expected) => {
    // When
    const reason = toPurchaseFailedReason(cause);

    // Then
    expect(reason).toBe(expected);
  });

  it.each(['purchaseCancelled', 'paymentPending'] as const)(
    '사용자가 알고 있는 %p는 결제 실패로 세지 않는다',
    (cause) => {
      // When
      const reason = toPurchaseFailedReason(cause);

      // Then
      expect(reason).toBeNull();
    },
  );
});
