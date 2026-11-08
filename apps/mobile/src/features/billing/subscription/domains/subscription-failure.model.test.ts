import { ApiError, NetworkError, ParseError, ServerError, TimeoutError } from '@src/shared/errors';

import { SubscriptionFailurePolicy } from './subscription-failure.model';
import { SubscriptionErrors } from './subscription.error';

describe('getFailureCause', () => {
  it.each<[string, unknown, ReturnType<typeof SubscriptionFailurePolicy.getFailureCause>]>([
    ['기기 연결이 끊겨 내 정보를 받지 못하면', new NetworkError(), 'network'],
    ['내 정보 요청이 시간 초과되면', new TimeoutError(), 'network'],
    ['스토어에 연결하지 못하면', SubscriptionErrors.network('10'), 'network'],
    ['서버가 5xx로 답하면', new ServerError(503), 'server'],
    ['서버 응답이 계약과 다르면', new ParseError(), 'server'],
    ['서버가 예상하지 못한 4xx로 답하면', new ApiError('SYS_0001', 'message', 400), 'server'],
    ['무엇인지 모르는 값이 던져지면', 'unexpected', 'server'],
    ['스토어 SDK를 쓸 수 없으면', SubscriptionErrors.storeUnavailable(), 'store'],
    ['스토어가 잠시 응답하지 못하면', SubscriptionErrors.storeProblem('2'), 'store'],
    ['팔 요금제를 받지 못하면', SubscriptionErrors.offeringsUnavailable('16'), 'store'],
    ['사용자가 결제를 취소하면', SubscriptionErrors.purchaseCancelled('1'), 'purchaseCancelled'],
    ['결제 승인을 기다리면', SubscriptionErrors.paymentPending('20'), 'paymentPending'],
    ['결제가 실패하면', SubscriptionErrors.purchaseFailed('2'), 'purchaseFailed'],
    ['복원이 실패하면', SubscriptionErrors.restoreFailed('7'), 'restoreFailed'],
  ])('%s 원인은 %s다', (_case, error, expected) => {
    // When
    const cause = SubscriptionFailurePolicy.getFailureCause(error);

    // Then
    expect(cause).toBe(expected);
  });
});

describe('findStoreUnavailableKind', () => {
  it.each<[string, unknown, ReturnType<typeof SubscriptionFailurePolicy.findStoreUnavailableKind>]>(
    [
      [
        'SDK가 초기화되지 않았으면 설정 문제로 본다',
        SubscriptionErrors.storeUnavailable(),
        'setup',
      ],
      ['스토어 설정 오류면 설정 문제로 본다', SubscriptionErrors.storeUnavailable('23'), 'setup'],
      [
        '스토어가 잠시 응답하지 못하면 일시적 문제로 본다',
        SubscriptionErrors.storeProblem('2'),
        'temporary',
      ],
      ['연결 문제는 스토어 상태가 아니다', SubscriptionErrors.network('10'), null],
      [
        '팔 요금제를 받지 못한 것은 스토어 상태가 아니다',
        SubscriptionErrors.offeringsUnavailable('16'),
        null,
      ],
      ['서버 오류는 스토어 상태가 아니다', new ServerError(503), null],
    ],
  )('%s', (_case, error, expected) => {
    // When
    const kind = SubscriptionFailurePolicy.findStoreUnavailableKind(error);

    // Then
    expect(kind).toBe(expected);
  });
});
