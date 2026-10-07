import { Inject, Injectable } from "@nestjs/common";

import { ENTITLEMENT_READER } from "#api/modules/access/access-entitlement.public";
import {
  type EntitlementReaderPort,
  Resource,
} from "#api/modules/access/access-entitlement.public";

import type { TodoCategoryLimitReaderPort } from "../../../application/ports/categories/todo-category-limit-reader.port.js";

/**
 * 활성 카테고리 생성 트랜잭션에서 실시간 entitlement를 읽는 어댑터.
 */
@Injectable()
export class TodoCategoryLimitReaderAdapter implements TodoCategoryLimitReaderPort {
  constructor(
    @Inject(ENTITLEMENT_READER) private readonly entitlementReader: Pick<
      EntitlementReaderPort,
      "getResourceLimitInTx"
    >,
  ) {}

  async getMaxCountInTx(userId: string): Promise<number | null> {
    const { maxCount } = await this.entitlementReader.getResourceLimitInTx(
      userId,
      Resource.CATEGORY,
    );
    return maxCount;
  }
}
