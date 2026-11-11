import type { StoreSubscriptionId } from "../../domain/store-subscription-id.vo.js";
import type { StoreSubscriptionState } from "../../domain/subscription.aggregate.js";

export abstract class StoreSubscriptionStatusReaderPort {
  /**
   * 우리 체인 키로 스토어의 지금 상태를 읽는다. 스토어가 모르는 체인은 결과에서 빠진다.
   * 읽기 설정이 없으면 null이고, 읽기에 실패하면 던진다(호출부가 다시 시도한다).
   */
  abstract read(
    storeSubscriptionIds: readonly StoreSubscriptionId[],
  ): Promise<StoreSubscriptionState[] | null>;
}
