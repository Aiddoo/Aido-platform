import type {
  ClaimedPushDelivery,
  ClaimPushDeliveriesInput,
  PushDeliveryClaimRepositoryPort,
  ReopenPushDeliveriesAfterClaimFailureInput,
} from "#api/modules/notification/push-dispatches/application/ports/push-delivery-claim.repository.port";
import type {
  FinalizePushDeliveryResultsInput,
  FinalizeSkippedPushDeliveryInput,
  PushDeliveryFinalizationRepositoryPort,
} from "#api/modules/notification/push-dispatches/application/ports/push-delivery-finalization.repository.port";
import type {
  PushDeliveryLeaseRepositoryPort,
  ReleasePushDeliveryInput,
} from "#api/modules/notification/push-dispatches/application/ports/push-delivery-lease.repository.port";
import type { PushDeliveryFenceReadModel } from "#api/modules/notification/push-dispatches/application/read-models/push-delivery-fence.read-model";

const PUSH_DELIVERY_LIFECYCLE_OPERATIONS = [
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
export class StubPushDeliveryLifecycleRepository
  implements
    PushDeliveryClaimRepositoryPort,
    PushDeliveryFinalizationRepositoryPort,
    PushDeliveryLeaseRepositoryPort
{
  claimed: readonly ClaimedPushDelivery[] = [];
  // 정하면 markRateLimitReserved가 이 dispatch만 승인한다(fence를 잃은 worker)
  reservableDispatchIds: ReadonlySet<number> | null = null;
  // 정하면 reopenAfterFinalClaimFailure가 이만큼만 연다
  reopenableCount: number | null = null;
  readonly operations: PushDeliveryLifecycleOperation[] = [];
  readonly claimInputs: ClaimPushDeliveriesInput[] = [];
  readonly reopenAfterFinalClaimFailureInputs: ReopenPushDeliveriesAfterClaimFailureInput[] = [];
  readonly reopenFailedPublicationsInputs: ReopenPushDeliveriesAfterClaimFailureInput[] = [];
  readonly rateLimitReservations: {
    readonly fences: readonly PushDeliveryFenceReadModel[];
    readonly reservedAt: Temporal.Instant;
  }[] = [];
  readonly finalizedSkipped: FinalizeSkippedPushDeliveryInput[][] = [];
  readonly finalizedResults: FinalizePushDeliveryResultsInput[][] = [];
  readonly released: ReleasePushDeliveryInput[][] = [];
  readonly staleRecoveries: Temporal.Instant[] = [];
  readonly #failures = new Map<PushDeliveryLifecycleOperation, unknown[]>();
  readonly #observe: (operation: PushDeliveryLifecycleOperation) => void;

  constructor(observe: (operation: PushDeliveryLifecycleOperation) => void = () => {}) {
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
    fences: readonly PushDeliveryFenceReadModel[],
    reservedAt: Temporal.Instant,
  ): Promise<readonly number[]> {
    this.rateLimitReservations.push({ fences: [...fences], reservedAt });
    this.#enter("markRateLimitReserved");
    const reservable = this.reservableDispatchIds;
    return fences
      .map((fence) => fence.dispatchId)
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
