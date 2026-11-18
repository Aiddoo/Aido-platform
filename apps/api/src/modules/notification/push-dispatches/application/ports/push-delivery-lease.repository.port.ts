import type { PushDeliveryFenceReadModel } from "../read-models/push-delivery-fence.read-model.js";

export interface ReleasePushDeliveryInput {
  readonly fence: PushDeliveryFenceReadModel;
  readonly error: string;
  // JobRuntime의 마지막 attempt일 때만 새 publication generation을 열어 둔다.
  readonly reopenOutbox: boolean;
  readonly availableAt: Temporal.Instant;
}

// 작업 실패·lease 만료로 발송을 다시 PENDING으로 돌린다
// 만료 회수는 수천 건일 수 있어 PushDispatch를 한 건씩 복원하지 않고 집합 SQL로 돌린다
export abstract class PushDeliveryLeaseRepositoryPort {
  abstract release(inputs: readonly ReleasePushDeliveryInput[]): Promise<number>;
  abstract recoverStaleProcessing(startedBefore: Temporal.Instant): Promise<number>;
}
