import type { FeatureQuota } from "@aido/api";
import { Inject, Injectable } from "@nestjs/common";

import {
  ENTITLEMENT_READER,
  type EntitlementReaderPort,
} from "#api/modules/access/access-entitlement.public";

import type { TodoCategoryLimitReaderPort } from "../../application/ports/todo-category-limit.reader.port.js";

/**
 * 활성 카테고리 생성 트랜잭션에서 실시간 entitlement를 읽는 어댑터.
 */
@Injectable()
export class TodoCategoryLimitReaderAdapter implements TodoCategoryLimitReaderPort {
  readonly #entitlementReader: Pick<EntitlementReaderPort, "getLimitInTx" | "readFeatureQuotaInTx">;

  constructor(
    @Inject(ENTITLEMENT_READER) entitlementReader: Pick<
      EntitlementReaderPort,
      "getLimitInTx" | "readFeatureQuotaInTx"
    >,
  ) {
    this.#entitlementReader = entitlementReader;
  }

  async getMaxCountInTx(userId: string): Promise<number | null> {
    return this.#entitlementReader.getLimitInTx(userId, "TODO_CATEGORY");
  }

  async readQuotaInTx(userId: string, count: number): Promise<FeatureQuota> {
    return this.#entitlementReader.readFeatureQuotaInTx(userId, "TODO_CATEGORY", {
      used: count,
      resetsAt: null,
    });
  }
}
