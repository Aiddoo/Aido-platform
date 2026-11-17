import { PushDispatchRepositoryPort } from "#api/modules/notification/push-dispatches/application/ports/push-dispatch.repository.port";
import { PushDispatchId } from "#api/modules/notification/push-dispatches/domain/push-dispatch-id.vo";
import type {
  PushDispatch,
  PushDispatchPrimitives,
} from "#api/modules/notification/push-dispatches/domain/push-dispatch.aggregate";

// 알림마다 dispatch 하나(PushDispatch_notificationId_key)를 두고 저장한 값을 그대로 남긴다
export class InMemoryPushDispatchRepository extends PushDispatchRepositoryPort {
  readonly dispatches: PushDispatchPrimitives[] = [];
  #sequence: number;

  constructor(firstDispatchId = 101) {
    super();
    this.#sequence = firstDispatchId - 1;
  }

  async nextIds(count: number): Promise<PushDispatchId[]> {
    return Array.from({ length: count }, () => {
      this.#sequence += 1;
      return PushDispatchId.reconstitute(this.#sequence);
    });
  }

  async saveAll(dispatches: readonly PushDispatch[]): Promise<void> {
    for (const dispatch of dispatches) {
      const primitives = dispatch.toPrimitives();
      if (this.dispatches.some((saved) => saved.notificationId === primitives.notificationId)) {
        throw new Error(
          `PushDispatch already staged for notification ${primitives.notificationId}`,
        );
      }
      this.dispatches.push(primitives);
    }
  }
}
