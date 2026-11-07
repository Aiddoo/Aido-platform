import { toPurchaseFailedReason } from './subscription-analytics';

describe('toPurchaseFailedReason', () => {
  it.each([
    ['network', 'network'],
    ['server', 'server'],
    ['store', 'store_unavailable'],
    ['purchaseFailed', 'store_error'],
  ] as const)('문의로 안내한 실패 원인 %p는 사유 %p로 센다', (cause, expected) => {
    // Given 문의 안내 실패 / When 사유로 바꾸면 / Then 자유 문자열 없이 enum만 남는다
    expect(toPurchaseFailedReason(cause)).toBe(expected);
  });

  it.each(['purchaseCancelled', 'paymentPending'] as const)(
    '사용자가 알고 있는 %p는 결제 실패로 세지 않는다',
    (cause) => {
      // Given 직접 취소·승인 대기 / When 사유로 바꾸면 / Then null이다
      expect(toPurchaseFailedReason(cause)).toBeNull();
    },
  );
});
