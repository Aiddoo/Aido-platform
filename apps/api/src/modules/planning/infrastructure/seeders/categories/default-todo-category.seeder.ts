import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todoCategory } from "#api/platform/database/schema/index";

import type { TodoCategoryProvisionerPort } from "../../../application/ports/categories/todo-category-provisioner.port.js";
import { DEFAULT_CATEGORIES } from "../../../domain/policies/categories/default-categories.js";

/** 회원가입의 활성 CLS 트랜잭션에서 기본 카테고리를 일괄 생성한다. */
@Injectable()
export class DefaultTodoCategorySeeder implements TodoCategoryProvisionerPort {
  constructor(private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>) {}

  async seed(userId: string): Promise<number> {
    const rows = await this.txHost.tx
      .insert(todoCategory)
      .values(DEFAULT_CATEGORIES.map((category) => ({ userId, ...category })))
      .returning({ id: todoCategory.id });
    return rows.length;
  }
}
