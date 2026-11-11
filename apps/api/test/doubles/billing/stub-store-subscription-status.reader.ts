import { StoreSubscriptionStatusReaderPort } from "#api/modules/billing/subscriptions/application/ports/store-subscription-status.reader.port";
import type { StoreSubscriptionId } from "#api/modules/billing/subscriptions/domain/store-subscription-id.vo";
import type { StoreSubscriptionState } from "#api/modules/billing/subscriptions/domain/subscription.aggregate";

// 스토어가 알려 주는 체인 상태를 시나리오가 정해 두고, failure를 두면 읽기 실패를 흉내 낸다
export class StubStoreSubscriptionStatusReader extends StoreSubscriptionStatusReaderPort {
  readonly states = new Map<string, StoreSubscriptionState>();
  failure: Error | null = null;

  async read(
    storeSubscriptionIds: readonly StoreSubscriptionId[],
  ): Promise<StoreSubscriptionState[]> {
    if (this.failure != null) {
      throw this.failure;
    }
    return storeSubscriptionIds.flatMap((id) => {
      const state = this.states.get(id.value);
      return state == null ? [] : [{ ...state }];
    });
  }
}
