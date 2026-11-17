import type {
  ClaimedPushDeliveryPublicationReadModel,
  PushDeliveryPublicationReadModel,
} from "../read-models/push-delivery.read-model.js";

export interface ClaimPushDeliveryOutboxInput {
  readonly limit: number;
  readonly lockedAt: Temporal.Instant;
}

export interface DeferPushDeliveryPublicationsInput {
  readonly publications: readonly PushDeliveryPublicationReadModel[];
  readonly availableAt: Temporal.Instant;
  readonly error: string;
}

// 일반 알림 outbox의 claim generation과 relay 상태 전이를 원자적으로 저장한다. 상태 변경은 정렬된 row lock을 지키도록 UnitOfWork 안에서 호출한다
export abstract class PushDeliveryOutboxRepositoryPort {
  abstract claimByDispatchIds(
    dispatchIds: readonly number[],
    lockedAt: Temporal.Instant,
  ): Promise<readonly ClaimedPushDeliveryPublicationReadModel[]>;
  abstract claimAvailable(
    input: ClaimPushDeliveryOutboxInput,
  ): Promise<readonly ClaimedPushDeliveryPublicationReadModel[]>;
  abstract markPublished(
    publications: readonly PushDeliveryPublicationReadModel[],
    publishedAt: Temporal.Instant,
  ): Promise<number>;
  abstract defer(input: DeferPushDeliveryPublicationsInput): Promise<number>;
  abstract recoverStaleProcessing(lockedBefore: Temporal.Instant): Promise<number>;
}
