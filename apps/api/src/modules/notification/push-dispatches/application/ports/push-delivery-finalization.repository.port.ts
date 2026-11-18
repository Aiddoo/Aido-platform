import type { PushDispatchSkipReason } from "@aido/api/vocabulary";

import type { PushDeliveryFenceReadModel } from "../read-models/push-delivery-fence.read-model.js";
import type { PushSendResult } from "./push-channel.port.js";

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
  readonly results: readonly PushSendResult[];
}

// 담당 표시가 맞는 발송만 끝낸다. 늦은 worker는 0건이다
// 묶음 결과를 한 번에 쓰므로 PushDispatch를 한 건씩 복원하지 않고 집합 SQL로 마무리한다
export abstract class PushDeliveryFinalizationRepositoryPort {
  abstract finalizeSkipped(inputs: readonly FinalizeSkippedPushDeliveryInput[]): Promise<number>;
  abstract finalizeResults(inputs: readonly FinalizePushDeliveryResultsInput[]): Promise<number>;
}
