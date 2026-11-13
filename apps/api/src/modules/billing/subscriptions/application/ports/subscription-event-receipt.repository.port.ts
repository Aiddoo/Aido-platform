import type { SubscriptionEventReceipt } from "../../domain/subscription-event-receipt.entity.js";

/** 처리 원장. 트랜잭션은 CLS로 전파돼 구독 변경과 함께 커밋·롤백된다. */
export abstract class SubscriptionEventReceiptRepositoryPort {
  /** 처음 기록하면 true, 같은 (공급자, 이벤트 ID)를 이미 기록했으면 아무것도 바꾸지 않고 false다. */
  abstract claim(receipt: SubscriptionEventReceipt): Promise<boolean>;
}
