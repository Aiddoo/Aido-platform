import { ApiError, NetworkError, ParseError, ServerError, TimeoutError } from '@src/shared/errors';

import { SubscriptionFailurePolicy } from './subscription-failure.model';
import { SubscriptionErrors } from './subscription.error';

describe('SubscriptionFailurePolicy.causeOf', () => {
  it.each<[string, unknown, ReturnType<typeof SubscriptionFailurePolicy.causeOf>]>([
    ['기기 연결이 끊겨 내 정보를 받지 못하면', new NetworkError(), 'network'],
    ['내 정보 요청이 시간 초과되면', new TimeoutError(), 'network'],
    ['스토어에 연결하지 못하면', SubscriptionErrors.network('10'), 'network'],
    ['서버가 5xx로 답하면', new ServerError(503), 'server'],
    ['서버 응답이 계약과 다르면', new ParseError(), 'server'],
    ['서버가 예상하지 못한 4xx로 답하면', new ApiError('SYS_0001', 'message', 400), 'server'],
    ['무엇인지 모르는 값이 던져지면', 'unexpected', 'server'],
    ['스토어 SDK를 쓸 수 없으면', SubscriptionErrors.storeUnavailable(), 'store'],
    ['팔 요금제를 받지 못하면', SubscriptionErrors.offeringsUnavailable('16'), 'store'],
    ['사용자가 결제를 취소하면', SubscriptionErrors.purchaseCancelled('1'), 'purchaseCancelled'],
    ['결제 승인을 기다리면', SubscriptionErrors.paymentPending('20'), 'paymentPending'],
    ['결제가 실패하면', SubscriptionErrors.purchaseFailed('2'), 'purchaseFailed'],
    ['복원이 실패하면', SubscriptionErrors.restoreFailed('7'), 'restoreFailed'],
  ])('%s 원인은 %s다', (_case, error, expected) => {
    expect(SubscriptionFailurePolicy.causeOf(error)).toBe(expected);
  });
});

describe('SubscriptionFailurePolicy.diagnosticCodeOf', () => {
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
    expect(SubscriptionFailurePolicy.diagnosticCodeOf(error)).toBe(expected);
  });
});
