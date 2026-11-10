import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { EntityId } from "#api/shared/domain/model/entity-id";

/** 스토어 갱신 체인의 ID(원 거래 ID). 갱신마다 바뀌는 거래 ID와 섞이지 않게 값으로 감싼다. */
export class StoreSubscriptionId extends EntityId<string> {
  /** 체인 ID가 없으면 처리할 구독을 찾을 수 없어 SUBSCRIPTION_1604로 거절한다. */
  static create(raw: string | null | undefined): StoreSubscriptionId {
    if (raw == null || raw === "") {
      throw new DomainException(ErrorCode.SUBSCRIPTION_1604, {
        reason: "Missing store subscription id",
      });
    }
    return new StoreSubscriptionId(raw);
  }

  static reconstitute(raw: string): StoreSubscriptionId {
    return new StoreSubscriptionId(raw);
  }
}
