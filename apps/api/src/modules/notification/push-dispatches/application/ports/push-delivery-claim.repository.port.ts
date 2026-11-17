import type { PushDeliveryJobId } from "../../domain/push-delivery-job-id.vo.js";
import type { PushDeliveryMode } from "../../domain/push-delivery-status.constants.js";
import type { PushDeliveryFenceReadModel } from "../read-models/push-delivery-fence.read-model.js";
import type {
  PushDeliveryItemReadModel,
  PushDeliveryPublicationReadModel,
} from "../read-models/push-delivery.read-model.js";

export interface ClaimedPushDelivery {
  readonly fence: PushDeliveryFenceReadModel;
  readonly deliveryMode: PushDeliveryMode;
  readonly force: boolean;
  readonly rateLimitReservation: { readonly status: "pending" } | { readonly status: "reserved" };
  readonly item: PushDeliveryItemReadModel;
}

export interface ClaimPushDeliveriesInput {
  readonly publications: readonly PushDeliveryPublicationReadModel[];
  readonly processingJobId: PushDeliveryJobId;
  readonly processingJobAttempt: number;
  readonly startedAt: Temporal.Instant;
}

export interface ReopenPushDeliveriesAfterClaimFailureInput {
  readonly publications: readonly PushDeliveryPublicationReadModel[];
  readonly availableAt: Temporal.Instant;
  readonly error: string;
}

// PushDispatch worker lease를 job ID와 증가 attempt로 fencing한다
// 초당 수백 건을 옮기므로 PushDispatch를 한 건씩 복원하지 않고 집합 SQL 한 문장으로 바꾼다
export abstract class PushDeliveryClaimRepositoryPort {
  // Outbox ownership과 dispatch lease를 함께 rollback할 수 있도록 UnitOfWorkPort.run 안에서 호출한다.
  abstract claim(input: ClaimPushDeliveriesInput): Promise<readonly ClaimedPushDelivery[]>;
  // Generation row lock 뒤 최신 dispatch 상태를 재검사하므로 UnitOfWorkPort.run 안에서 호출한다.
  abstract reopenAfterFinalClaimFailure(
    input: ReopenPushDeliveriesAfterClaimFailureInput,
  ): Promise<number>;
  // DLQ에서 현재 generation 중 안전하게 재발행 가능한 subset만 UnitOfWorkPort.run 안에서 연다.
  abstract reopenFailedPublications(
    input: ReopenPushDeliveriesAfterClaimFailureInput,
  ): Promise<number>;
  abstract markRateLimitReserved(
    fences: readonly PushDeliveryFenceReadModel[],
    reservedAt: Temporal.Instant,
  ): Promise<readonly number[]>;
}
