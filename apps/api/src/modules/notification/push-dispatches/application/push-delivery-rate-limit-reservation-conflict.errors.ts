/** Worker fence를 잃어 rate-limit 예약을 안전하게 영속화하지 못한 경우의 retryable 오류. */
export class PushDeliveryRateLimitReservationConflictError extends Error {
  readonly dispatchIds: readonly number[];

  constructor(dispatchIds: readonly number[]) {
    super(`Push delivery rate-limit reservation fence lost: dispatchIds=${dispatchIds.join(",")}`);
    this.dispatchIds = dispatchIds;
    this.name = PushDeliveryRateLimitReservationConflictError.name;
  }
}
