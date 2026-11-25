import { fail, ok } from '@src/core/errors/result';

import type { SubscriptionOffering } from '../domains/subscription-offering.model';
import { SubscriptionErrors } from '../domains/subscription.error';
import { toOfferingsAvailability } from './subscription.queries';

const offering: SubscriptionOffering = { identifier: 'default', plans: [] };

describe('toOfferingsAvailability', () => {
  it('요금제를 받으면 바로 보여 줄 수 있는 상태가 된다', () => {
    // When
    const availability = toOfferingsAvailability(ok(offering));

    // Then
    expect(availability).toEqual({ status: 'available', offering });
  });

  it('스토어 설정 문제는 던지지 않고 안내할 상태로 돌려준다', () => {
    // When
    const availability = toOfferingsAvailability(fail(SubscriptionErrors.storeUnavailable('23')));

    // Then
    expect(availability).toEqual({
      status: 'unavailable',
      unavailable: { kind: 'setup', diagnosticCode: 'SUBSCRIPTION_STORE_UNAVAILABLE (23)' },
    });
  });

  it('스토어 연결 오류는 오류 경계가 다시 시도를 줄 수 있게 던진다', () => {
    // Given
    const error = SubscriptionErrors.network('10');

    // When
    const run = () => toOfferingsAvailability(fail(error));

    // Then
    expect(run).toThrow(error);
  });

  it('팔 요금제를 받지 못한 오류는 오류 경계로 던진다', () => {
    // Given
    const error = SubscriptionErrors.offeringsUnavailable('16');

    // When
    const run = () => toOfferingsAvailability(fail(error));

    // Then
    expect(run).toThrow(error);
  });
});
