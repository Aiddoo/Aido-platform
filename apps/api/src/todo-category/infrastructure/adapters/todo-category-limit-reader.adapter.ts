import { Injectable } from "@nestjs/common";

import {
  EntitlementService,
  Resource,
} from "#api/shared/application/entitlement/entitlement.service";

import type { TodoCategoryLimitReaderPort } from "../../application/ports/todo-category-limit-reader.port.js";

/**
 * 활성 카테고리 생성 트랜잭션에서 실시간 entitlement를 읽는 어댑터.
 */
@Injectable()
export class TodoCategoryLimitReaderAdapter implements TodoCategoryLimitReaderPort {
  constructor(private readonly entitlementService: EntitlementService) {}

  async getMaxCountInTx(userId: string): Promise<number | null> {
    const { maxCount } = await this.entitlementService.getResourceLimitInTx(
      userId,
      Resource.CATEGORY,
    );
    return maxCount;
  }
}
