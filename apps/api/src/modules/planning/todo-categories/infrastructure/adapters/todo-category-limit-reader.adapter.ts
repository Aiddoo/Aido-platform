import { Inject, Injectable } from "@nestjs/common";

import { EntitlementReaderPort } from "#api/modules/access/feature-grants/access-feature-grants.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  TodoCategoryLimitReaderPort,
  type TodoCategoryFeatureQuota,
} from "../../application/ports/todo-category-limit.reader.port.js";

/** 카테고리 보유 한도를 access entitlement에서 읽는다. 생성 트랜잭션에서는 캐시 없는 실시간 값을 쓴다. */
@Injectable()
export class TodoCategoryLimitReaderAdapter extends TodoCategoryLimitReaderPort {
  readonly #entitlementReader: Pick<
    EntitlementReaderPort,
    "getFeatureLimit" | "getFeatureLimitInTransaction" | "getFeatureQuotaInTransaction"
  >;

  constructor(
    @Inject(EntitlementReaderPort)
    entitlementReader: Pick<
      EntitlementReaderPort,
      "getFeatureLimit" | "getFeatureLimitInTransaction" | "getFeatureQuotaInTransaction"
    >,
  ) {
    super();
    this.#entitlementReader = entitlementReader;
  }

  readLimit(userId: UserId): Promise<number | null> {
    return this.#entitlementReader.getFeatureLimit(userId, "TODO_CATEGORY");
  }

  readLimitInTransaction(userId: UserId): Promise<number | null> {
    return this.#entitlementReader.getFeatureLimitInTransaction(userId, "TODO_CATEGORY");
  }

  readFeatureQuotaInTransaction(userId: UserId, count: number): Promise<TodoCategoryFeatureQuota> {
    return this.#entitlementReader.getFeatureQuotaInTransaction(userId, "TODO_CATEGORY", {
      used: count,
      resetsAt: null,
    });
  }
}
