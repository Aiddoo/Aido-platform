import { NetworkError, ServerError } from '@src/shared/errors';

import { SubscriptionErrors } from '../../domains/subscription.error';
import {
  toSubscriptionActionFailure,
  toSubscriptionLoadFailure,
} from './subscription-failure.view-model';

describe('toSubscriptionLoadFailure', () => {
  it.each([
    {
      when: '내 정보가 네트워크 오류로 실패하면',
      target: 'receipt' as const,
      error: new NetworkError(),
      titleKey: 'subscription:failure.title.receipt',
      descriptionKey: 'subscription:failure.description.network',
    },
    {
      when: '내 정보가 서버 오류로 실패하면',
      target: 'receipt' as const,
      error: new ServerError(500),
      titleKey: 'subscription:failure.title.receipt',
      descriptionKey: 'subscription:failure.description.server',
    },
    {
      when: '요금제를 스토어에서 받지 못하면',
      target: 'plans' as const,
      error: SubscriptionErrors.offeringsUnavailable('16'),
      titleKey: 'subscription:failure.title.plans',
      descriptionKey: 'subscription:failure.description.store',
    },
    {
      when: '요금제 조회 중 스토어 연결이 끊기면',
      target: 'plans' as const,
      error: SubscriptionErrors.network('10'),
      titleKey: 'subscription:failure.title.plans',
      descriptionKey: 'subscription:failure.description.network',
    },
  ])('$when 무엇이 실패했는지와 할 일을 알린다', ({ target, error, titleKey, descriptionKey }) => {
    // When
    const failure = toSubscriptionLoadFailure(target, error);

    // Then
    expect(failure).toMatchObject({ titleKey, descriptionKey });
  });
});

describe('toSubscriptionActionFailure', () => {
  it('사용자가 결제를 취소하면 아무것도 알리지 않는다', () => {
    // When
    const failure = toSubscriptionActionFailure(
      'purchase',
      SubscriptionErrors.purchaseCancelled('1'),
    );

    // Then
    expect(failure).toEqual({ type: 'cancelled' });
  });

  it('결제 승인을 기다리면 문의 대신 승인 대기를 알린다', () => {
    // When
    const failure = toSubscriptionActionFailure(
      'purchase',
      SubscriptionErrors.paymentPending('20'),
    );

    // Then
    expect(failure).toEqual({ type: 'paymentPending' });
  });

  it.each([
    {
      when: '결제가 스토어 문제로 실패하면',
      target: 'purchase' as const,
      error: SubscriptionErrors.purchaseFailed('2'),
      titleKey: 'subscription:failure.title.purchase',
      descriptionKey: 'subscription:failure.description.purchase',
      diagnosticCode: 'SUBSCRIPTION_PURCHASE_FAILED (2)',
    },
    {
      when: '결제 중 연결이 끊기면',
      target: 'purchase' as const,
      error: SubscriptionErrors.network('10'),
      titleKey: 'subscription:failure.title.purchase',
      descriptionKey: 'subscription:failure.description.network',
      diagnosticCode: 'SUBSCRIPTION_NETWORK (10)',
    },
    {
      when: '복원이 실패하면',
      target: 'restore' as const,
      error: SubscriptionErrors.restoreFailed('7'),
      titleKey: 'subscription:failure.title.restore',
      descriptionKey: 'subscription:failure.description.restore',
      diagnosticCode: 'SUBSCRIPTION_RESTORE_FAILED (7)',
    },
  ])('$when 문의하기로 안내한다', ({ when: _when, target, error, ...expected }) => {
    // When
    const failure = toSubscriptionActionFailure(target, error);

    // Then
    expect(failure).toEqual({ type: 'contactSupport', ...expected });
  });
});
