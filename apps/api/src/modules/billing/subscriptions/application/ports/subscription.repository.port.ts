import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { StoreSubscriptionId } from "../../domain/store-subscription-id.vo.js";
import type { SubscriptionId } from "../../domain/subscription-id.vo.js";
import type { Subscription } from "../../domain/subscription.aggregate.js";

/**
 * 구독 저장소 포트. 스토어 구독 이벤트와 상태 대조를 구독 행에 반영한다. 트랜잭션은 CLS로 전파된다.
 * 프리미엄 판단에 쓰는 읽기와 User projection 쓰기는 premium-grants slice의 포트가 맡는다.
 */
export abstract class SubscriptionRepositoryPort {
  abstract nextId(): Promise<SubscriptionId>;
  abstract findByStoreSubscriptionId(
    storeSubscriptionId: StoreSubscriptionId,
  ): Promise<Subscription | null>;
  /** 이 사용자가 소유한, 아직 엔타이틀먼트 상태(ACTIVE·CANCELLED)인 삭제되지 않은 체인 행 */
  abstract listReconcilableByUserId(userId: UserId): Promise<Subscription[]>;
  /** 이 사용자가 소유한 삭제되지 않은 스토어 구독 행이 하나라도 있는지 */
  abstract existsByUserId(userId: UserId): Promise<boolean>;
  /**
   * TRANSFER로 넘겨준 사용자의 삭제되지 않은 행을 한 문장으로 받은 사용자에게 옮기고 옮긴 행 수를 반환한다.
   * 이전 이벤트에 체인 ID가 없어 행마다 읽지 않는 묶음 메서드다.
   */
  abstract takeOverChains(
    fromUserId: UserId,
    toUserId: UserId,
    now: Temporal.Instant,
  ): Promise<number>;
  /** 새 행이면 넣고, 있으면 도메인이 바꾸는 칸(소유자·상품·상태·만료·유예·해지·이벤트·예약 상품·기간 유형)만 갱신한다. */
  abstract save(subscription: Subscription): Promise<void>;
}
