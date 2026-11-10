import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todoCategory } from "#api/platform/database/schema/index";
import { DEFAULT_LOCALE, type SupportedLocale } from "#api/shared/domain/locale";

import type { TodoCategoryProvisionerPort } from "../../application/ports/todo-category-provisioner.port.js";
import { DEFAULT_CATEGORIES } from "../../domain/categories.constants.js";

/** 회원가입의 활성 CLS 트랜잭션에서 기본 카테고리를 일괄 생성한다. */
@Injectable()
export class DefaultTodoCategoryProvisionerAdapter implements TodoCategoryProvisionerPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  async seed(userId: string, locale: SupportedLocale = DEFAULT_LOCALE): Promise<number> {
    const rows = await this.#txHost.tx
      .insert(todoCategory)
      .values(DEFAULT_CATEGORIES[locale].map((category) => ({ userId, ...category })))
      .returning({ id: todoCategory.id });
    return rows.length;
  }
}
