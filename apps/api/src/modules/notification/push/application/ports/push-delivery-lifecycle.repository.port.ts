import type { PushDispatchSkipReason } from "@aido/api/vocabulary";

import type { PushDeliveryMode } from "../../domain/push-delivery-status.constants.js";
import type {
  PushDeliveryItem,
  PushDeliveryPublication,
} from "../read-models/push-delivery.read-model.js";
import type { PushResult } from "./push-provider.port.js";

export interface PushDeliveryFence {
  readonly dispatchId: number;
  readonly publishAttempt: number;
  readonly processingJobId: string;
  readonly deliveryAttemptCount: number;
}

export interface ClaimedPushDelivery {
  readonly fence: PushDeliveryFence;
  readonly deliveryMode: PushDeliveryMode;
  readonly force: boolean;
  readonly rateLimitReservation: { readonly status: "pending" } | { readonly status: "reserved" };
  readonly item: PushDeliveryItem;
}

export interface PushDeliveryContext {
  readonly timezone: string;
  readonly localDate: Temporal.PlainDate;
}

export interface ClaimPushDeliveriesInput {
  readonly publications: readonly PushDeliveryPublication[];
  readonly processingJobId: string;
  readonly processingJobAttempt: number;
  readonly startedAt: Temporal.Instant;
}

export interface ReopenPushDeliveriesAfterClaimFailureInput {
  readonly publications: readonly PushDeliveryPublication[];
  readonly availableAt: Temporal.Instant;
  readonly error: string;
}

export interface FinalizeSkippedPushDeliveryInput {
  readonly fence: PushDeliveryFence;
  readonly context: PushDeliveryContext;
  readonly reason: PushDispatchSkipReason;
}

export interface FinalizePushDeliveryResultsInput {
  readonly fence: PushDeliveryFence;
  readonly context: PushDeliveryContext;
  readonly results: readonly PushResult[];
}

export interface ReleasePushDeliveryInput {
  readonly fence: PushDeliveryFence;
  readonly error: string;
  // JobRuntime의 마지막 attempt일 때만 새 publication generation을 열어 둔다.
  readonly reopenOutbox: boolean;
  readonly availableAt: Temporal.Instant;
}

// PushDispatch worker lease를 job ID와 증가 attempt로 fencing한다.
export abstract class PushDeliveryLifecycleRepositoryPort {
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
    fences: readonly PushDeliveryFence[],
    reservedAt: Temporal.Instant,
  ): Promise<readonly number[]>;
  abstract finalizeSkipped(inputs: readonly FinalizeSkippedPushDeliveryInput[]): Promise<number>;
  abstract finalizeResults(inputs: readonly FinalizePushDeliveryResultsInput[]): Promise<number>;
  abstract release(inputs: readonly ReleasePushDeliveryInput[]): Promise<number>;
  abstract recoverStaleProcessing(startedBefore: Temporal.Instant): Promise<number>;
}
