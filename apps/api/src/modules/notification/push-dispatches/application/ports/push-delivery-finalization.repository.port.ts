import type { PushDispatchSkipReason } from "@aido/api/vocabulary";

import type { PushDeliveryFenceReadModel } from "../read-models/push-delivery-fence.read-model.js";
import type { PushResult } from "./push-provider.port.js";

export interface PushDeliveryContext {
  readonly timezone: string;
  readonly localDate: Temporal.PlainDate;
}

export interface FinalizeSkippedPushDeliveryInput {
  readonly fence: PushDeliveryFenceReadModel;
  readonly context: PushDeliveryContext;
  readonly reason: PushDispatchSkipReason;
}

export interface FinalizePushDeliveryResultsInput {
  readonly fence: PushDeliveryFenceReadModel;
  readonly context: PushDeliveryContext;
  readonly results: readonly PushResult[];
}

// 담당 표시가 맞는 발송만 끝낸다. 늦은 worker는 0건이다
export abstract class PushDeliveryFinalizationRepositoryPort {
  abstract finalizeSkipped(inputs: readonly FinalizeSkippedPushDeliveryInput[]): Promise<number>;
  abstract finalizeResults(inputs: readonly FinalizePushDeliveryResultsInput[]): Promise<number>;
}
