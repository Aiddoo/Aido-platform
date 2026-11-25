import { NetworkError, ParseError, ServerError, TimeoutError } from '@src/shared/errors';
import { createApiError } from '@src/testing/core';

import {
  findStoreUnavailableKind,
  getSubscriptionDiagnosticCode,
  getStoreUnavailableReport,
  getSubscriptionFailureCause,
  SubscriptionErrors,
} from './subscription.error';

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
    [
      '서버 오류 코드는 그대로 쓴다',
      createApiError('SYS_0001', { message: 'message', status: 400 }),
      'SYS_0001',
    ],
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

describe('getSubscriptionFailureCause', () => {
  it.each<[string, unknown, ReturnType<typeof getSubscriptionFailureCause>]>([
    ['기기 연결이 끊겨 내 정보를 받지 못하면', new NetworkError(), 'network'],
    ['내 정보 요청이 시간 초과되면', new TimeoutError(), 'network'],
    ['스토어에 연결하지 못하면', SubscriptionErrors.network('10'), 'network'],
    ['서버가 5xx로 답하면', new ServerError(503), 'server'],
    ['서버 응답이 계약과 다르면', new ParseError(), 'server'],
    [
      '서버가 예상하지 못한 4xx로 답하면',
      createApiError('SYS_0001', { message: 'message', status: 400 }),
      'server',
    ],
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
    const cause = getSubscriptionFailureCause(error);

    // Then
    expect(cause).toBe(expected);
  });
});

describe('findStoreUnavailableKind', () => {
  it.each<[string, unknown, ReturnType<typeof findStoreUnavailableKind>]>([
    ['SDK가 초기화되지 않았으면 설정 문제로 본다', SubscriptionErrors.storeUnavailable(), 'setup'],
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
  ])('%s', (_case, error, expected) => {
    // When
    const kind = findStoreUnavailableKind(error);

    // Then
    expect(kind).toBe(expected);
  });
});

describe('getStoreUnavailableReport', () => {
  it.each([
    [
      '배포 빌드의 설정 문제는 error 이벤트로 남긴다',
      'setup',
      false,
      { channel: 'event', severity: 'error' },
    ],
    [
      '배포 빌드에서 스토어가 잠시 응답하지 못하면 warning 이벤트로 남긴다',
      'temporary',
      false,
      { channel: 'event', severity: 'warning' },
    ],
    ['개발 빌드는 Test Store라 설정 문제도 로그만 남긴다', 'setup', true, { channel: 'log' }],
  ] as const)('%s', (_case, kind, isDebugBuild, expected) => {
    // When
    const report = getStoreUnavailableReport(kind, { isDebugBuild });

    // Then
    expect(report).toEqual(expected);
  });
});
