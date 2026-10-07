import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import { encodeCreate } from "#api/platform/database/database-records";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";

import type { TodoCategoryProvisionerPort } from "../../../application/ports/categories/todo-category-provisioner.port.js";
import { DEFAULT_CATEGORIES } from "../../../domain/policies/categories/default-categories.js";

/** 회원가입의 활성 CLS 트랜잭션에서 기본 카테고리를 일괄 생성한다. */
@Injectable()
export class DefaultTodoCategorySeeder implements TodoCategoryProvisionerPort {
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  async seed(userId: string): Promise<number> {
    const client = this.txHost.tx;
    const data = DEFAULT_CATEGORIES.map((category) => ({
      userId,
      ...category,
    }));
    return client.orm.public.TodoCategory.createAndCount(
      data.map((value) => encodeCreate("TodoCategory", value)),
    );
  }
}
