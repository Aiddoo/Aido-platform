/**
 * `acceptedTicketCountBeforeFailure`가 1 이상이면 앞선 청크가 이미 공급자에 수락됐다.
 * 호출자는 논리 배치 전체를 다시 시도하므로 그 알림은 at-least-once로 중복 전달될 수 있다.
 */
export interface RetryablePushProviderTransportErrorMetadata {
  readonly providerName: string;
  readonly resolvedPayloadCountBeforeFailure: number;
  readonly acceptedTicketCountBeforeFailure: number;
  readonly unconfirmedPayloadCount: number;
  readonly unattemptedPayloadCount: number;
}

export class RetryablePushProviderTransportError extends Error {
  readonly metadata: RetryablePushProviderTransportErrorMetadata;

  constructor(metadata: RetryablePushProviderTransportErrorMetadata, options?: ErrorOptions) {
    super(
      `Retryable push provider transport failure: provider=${metadata.providerName}, resolved=${metadata.resolvedPayloadCountBeforeFailure}, accepted=${metadata.acceptedTicketCountBeforeFailure}, unconfirmed=${metadata.unconfirmedPayloadCount}, unattempted=${metadata.unattemptedPayloadCount}`,
      options,
    );
    this.name = RetryablePushProviderTransportError.name;
    this.metadata = metadata;
  }
}

export function retryablePushProviderTransport(
  metadata: RetryablePushProviderTransportErrorMetadata,
  cause: unknown,
): RetryablePushProviderTransportError {
  return new RetryablePushProviderTransportError(metadata, { cause });
}

/** 마지막 queue attempt의 claim 실패 복구가 일부 fence만 소유한 경우 전체 rollback을 요청한다. */
export class PushDeliveryClaimRecoveryConflictError extends Error {
  readonly expectedCount: number;
  readonly recoveredCount: number;

  constructor(expectedCount: number, recoveredCount: number) {
    super(
      `Push delivery claim recovery fence mismatch: expected=${expectedCount}, recovered=${recoveredCount}`,
    );
    this.expectedCount = expectedCount;
    this.recoveredCount = recoveredCount;
    this.name = PushDeliveryClaimRecoveryConflictError.name;
  }
}

export function pushDeliveryClaimRecoveryConflict(
  expectedCount: number,
  recoveredCount: number,
): PushDeliveryClaimRecoveryConflictError {
  return new PushDeliveryClaimRecoveryConflictError(expectedCount, recoveredCount);
}

/** Worker fence를 잃어 rate-limit 예약을 안전하게 영속화하지 못한 경우의 retryable 오류. */
export class PushDeliveryRateLimitReservationConflictError extends Error {
  readonly dispatchIds: readonly number[];

  constructor(dispatchIds: readonly number[]) {
    super(`Push delivery rate-limit reservation fence lost: dispatchIds=${dispatchIds.join(",")}`);
    this.dispatchIds = dispatchIds;
    this.name = PushDeliveryRateLimitReservationConflictError.name;
  }
}

export function pushDeliveryRateLimitReservationConflict(
  dispatchIds: readonly number[],
): PushDeliveryRateLimitReservationConflictError {
  return new PushDeliveryRateLimitReservationConflictError(dispatchIds);
}

// 묶음 발송 후보의 수신자를 같은 조회에서 읽었으므로 없으면 코드가 어긋난 것이다
export function pushDeliveryRecipientMissing(userId: string): Error {
  return new Error(`Push delivery recipient missing: userId=${userId}`);
}
