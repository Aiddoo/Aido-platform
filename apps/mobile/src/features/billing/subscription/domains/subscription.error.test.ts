import { ApiError, NetworkError, ParseError, ServerError, TimeoutError } from '@src/shared/errors';

import { getSubscriptionDiagnosticCode, SubscriptionErrors } from './subscription.error';

describe('getSubscriptionDiagnosticCode', () => {
  it.each<[string, unknown, string]>([
    [
      '스토어 코드가 있으면 괄호로 붙인다',
      SubscriptionErrors.purchaseFailed('2'),
      'SUBSCRIPTION_PURCHASE_FAILED (2)',
    ],
    [
      '스토어 코드가 없으면 도메인 코드만 쓴다',
      SubscriptionErrors.storeUnavailable(),
      'SUBSCRIPTION_STORE_UNAVAILABLE',
    ],
    ['서버 오류 코드는 그대로 쓴다', new ApiError('SYS_0001', 'message', 400), 'SYS_0001'],
    ['네트워크 오류', new NetworkError(), 'NETWORK'],
    ['시간 초과', new TimeoutError(), 'TIMEOUT'],
    ['5xx는 상태 코드를 붙인다', new ServerError(502), 'SERVER_502'],
    ['응답 계약 불일치', new ParseError('사용자에게 보이면 안 되는 상세'), 'INVALID_RESPONSE'],
    ['모르는 값', { token: 'secret' }, 'UNKNOWN'],
  ])('%s', (_case, error, expected) => {
    // When
    const diagnosticCode = getSubscriptionDiagnosticCode(error);

    // Then
    expect(diagnosticCode).toBe(expected);
  });
});
