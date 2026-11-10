import { Inject, Injectable } from "@nestjs/common";

import {
  ENTITLEMENT_READER,
  type EntitlementReaderPort,
} from "#api/modules/access/access-entitlement.public";

import type {
  CategoryFeatureQuota,
  TodoCategoryLimitReaderPort,
} from "../../application/ports/todo-category-limit.reader.port.js";

/** 카테고리 보유 한도를 access entitlement에서 읽는다. 생성 트랜잭션에서는 캐시 없는 실시간 값을 쓴다. */
@Injectable()
export class TodoCategoryLimitReaderAdapter implements TodoCategoryLimitReaderPort {
  readonly #entitlementReader: Pick<
    EntitlementReaderPort,
    "getLimit" | "getLimitInTx" | "readFeatureQuotaInTx"
  >;

  constructor(
    @Inject(ENTITLEMENT_READER)
    entitlementReader: Pick<
      EntitlementReaderPort,
      "getLimit" | "getLimitInTx" | "readFeatureQuotaInTx"
    >,
  ) {
    this.#entitlementReader = entitlementReader;
  }

  getMaxCount(userId: string): Promise<number | null> {
    return this.#entitlementReader.getLimit(userId, "TODO_CATEGORY");
  }

  getMaxCountInTx(userId: string): Promise<number | null> {
    return this.#entitlementReader.getLimitInTx(userId, "TODO_CATEGORY");
  }

  readQuotaInTx(userId: string, count: number): Promise<CategoryFeatureQuota> {
    return this.#entitlementReader.readFeatureQuotaInTx(userId, "TODO_CATEGORY", {
      used: count,
      resetsAt: null,
    });
  }
}
