import {
  type ClaimedPushDelivery,
  type ClaimPushDeliveriesInput,
  type FinalizePushDeliveryResultsInput,
  type FinalizeSkippedPushDeliveryInput,
  type ReleasePushDeliveryInput,
  type ReopenPushDeliveriesAfterClaimFailureInput,
  PushDeliveryLifecycleRepositoryPort,
  type ReservePushDeliveryRateLimitInput,
} from "#api/modules/notification/push/application/ports/push-delivery-lifecycle.repository.port";

export const PUSH_DELIVERY_LIFECYCLE_OPERATIONS = [
  "claim",
  "reopenAfterFinalClaimFailure",
  "reopenFailedPublications",
  "markRateLimitReserved",
  "finalizeSkipped",
  "finalizeResults",
  "release",
  "recoverStaleProcessing",
] as const;

export type PushDeliveryLifecycleOperation = (typeof PUSH_DELIVERY_LIFECYCLE_OPERATIONS)[number];

// claim은 정해 둔 배송을 주고 나머지 쓰기는 모두 반영된 것처럼 답한다. 받은 입력과 순서를 남기고, failNext로 받은 뒤 한 번씩 실패시킨다
export class StubPushDeliveryLifecycleRepository extends PushDeliveryLifecycleRepositoryPort {
  claimed: readonly ClaimedPushDelivery[] = [];
  // 정하면 markRateLimitReserved가 이 dispatch만 승인한다(fence를 잃은 worker)
  reservableDispatchIds: ReadonlySet<number> | null = null;
  // 정하면 reopenAfterFinalClaimFailure가 이만큼만 연다
  reopenableCount: number | null = null;
  readonly operations: PushDeliveryLifecycleOperation[] = [];
  readonly claimInputs: ClaimPushDeliveriesInput[] = [];
  readonly reopenAfterFinalClaimFailureInputs: ReopenPushDeliveriesAfterClaimFailureInput[] = [];
  readonly reopenFailedPublicationsInputs: ReopenPushDeliveriesAfterClaimFailureInput[] = [];
  readonly rateLimitReservations: ReservePushDeliveryRateLimitInput[][] = [];
  readonly finalizedSkipped: FinalizeSkippedPushDeliveryInput[][] = [];
  readonly finalizedResults: FinalizePushDeliveryResultsInput[][] = [];
  readonly released: ReleasePushDeliveryInput[][] = [];
  readonly staleRecoveries: Temporal.Instant[] = [];
  readonly #failures = new Map<PushDeliveryLifecycleOperation, unknown[]>();
  readonly #observe: (operation: PushDeliveryLifecycleOperation) => void;

  constructor(observe: (operation: PushDeliveryLifecycleOperation) => void = () => {}) {
    super();
    this.#observe = observe;
  }

  failNext(operation: PushDeliveryLifecycleOperation, error: unknown): void {
    this.#failures.set(operation, [...(this.#failures.get(operation) ?? []), error]);
  }

  async claim(input: ClaimPushDeliveriesInput): Promise<readonly ClaimedPushDelivery[]> {
    this.claimInputs.push(input);
    this.#enter("claim");
    return this.claimed;
  }

  async reopenAfterFinalClaimFailure(
    input: ReopenPushDeliveriesAfterClaimFailureInput,
  ): Promise<number> {
    this.reopenAfterFinalClaimFailureInputs.push(input);
    this.#enter("reopenAfterFinalClaimFailure");
    return this.reopenableCount ?? input.publications.length;
  }

  async reopenFailedPublications(
    input: ReopenPushDeliveriesAfterClaimFailureInput,
  ): Promise<number> {
    this.reopenFailedPublicationsInputs.push(input);
    this.#enter("reopenFailedPublications");
    return this.reopenableCount ?? input.publications.length;
  }

  async markRateLimitReserved(
    inputs: readonly ReservePushDeliveryRateLimitInput[],
  ): Promise<readonly number[]> {
    this.rateLimitReservations.push([...inputs]);
    this.#enter("markRateLimitReserved");
    const reservable = this.reservableDispatchIds;
    return inputs
      .map((input) => input.fence.dispatchId)
      .filter((dispatchId) => reservable == null || reservable.has(dispatchId));
  }

  async finalizeSkipped(inputs: readonly FinalizeSkippedPushDeliveryInput[]): Promise<number> {
    this.finalizedSkipped.push([...inputs]);
    this.#enter("finalizeSkipped");
    return inputs.length;
  }

  async finalizeResults(inputs: readonly FinalizePushDeliveryResultsInput[]): Promise<number> {
    this.finalizedResults.push([...inputs]);
    this.#enter("finalizeResults");
    return inputs.length;
  }

  async release(inputs: readonly ReleasePushDeliveryInput[]): Promise<number> {
    this.released.push([...inputs]);
    this.#enter("release");
    return inputs.length;
  }

  async recoverStaleProcessing(startedBefore: Temporal.Instant): Promise<number> {
    this.staleRecoveries.push(startedBefore);
    this.#enter("recoverStaleProcessing");
    return 0;
  }

  #enter(operation: PushDeliveryLifecycleOperation): void {
    this.operations.push(operation);
    this.#observe(operation);
    const [failure, ...rest] = this.#failures.get(operation) ?? [];
    if (failure !== undefined) {
      this.#failures.set(operation, rest);
      throw failure;
    }
  }
}
