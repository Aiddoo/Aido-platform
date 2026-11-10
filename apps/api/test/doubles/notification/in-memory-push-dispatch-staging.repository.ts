import {
  PushDispatchStagingRepositoryPort,
  type StagedPushDispatch,
  type StagePushDispatchInput,
} from "#api/modules/notification/push/application/ports/push-dispatch-staging.repository.port";

export interface InMemoryStagedPushDispatch extends StagePushDispatchInput {
  readonly dispatchId: number;
}

// 알림마다 dispatch 하나(PushDispatch_notificationId_key)를 만들고 받은 입력을 그대로 남긴다
export class InMemoryPushDispatchStagingRepository extends PushDispatchStagingRepositoryPort {
  readonly dispatches: InMemoryStagedPushDispatch[] = [];
  #sequence: number;

  constructor(firstDispatchId = 101) {
    super();
    this.#sequence = firstDispatchId - 1;
  }

  async stage(input: StagePushDispatchInput): Promise<StagedPushDispatch> {
    const existing = this.dispatches.find(
      (dispatch) => dispatch.notificationId === input.notificationId,
    );
    if (existing != null) {
      throw new Error(`PushDispatch already staged for notification ${input.notificationId}`);
    }
    this.#sequence += 1;
    this.dispatches.push({ ...input, dispatchId: this.#sequence });
    return { dispatchId: this.#sequence, notificationId: input.notificationId };
  }

  async stageMany(
    inputs: readonly StagePushDispatchInput[],
  ): Promise<readonly StagedPushDispatch[]> {
    const staged: StagedPushDispatch[] = [];
    for (const input of inputs) {
      staged.push(await this.stage(input));
    }
    return staged;
  }
}
