import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { createEntityId } from "#api/platform/database/entity-id";
import { resourceBonus } from "#api/platform/database/schema/access.schema";

import { ResourceBonusRepositoryPort } from "../../application/ports/resource-bonus.repository.port.js";
import { ResourceBonusId } from "../../domain/resource-bonus-id.vo.js";
import type { ResourceBonus } from "../../domain/resource-bonus.aggregate.js";
import { toResourceBonusRow } from "./resource-bonus-row.mapper.js";

@Injectable()
export class DrizzleResourceBonusRepository extends ResourceBonusRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    super();
    this.#txHost = txHost;
  }

  async nextId(): Promise<ResourceBonusId> {
    return ResourceBonusId.reconstitute(createEntityId());
  }

  async saveIfAbsent(bonus: ResourceBonus): Promise<boolean> {
    // ResourceBonus_sourceKey_key 충돌은 같은 보상의 재지급이라 오류가 아니라 false다
    const inserted = await this.#txHost.tx
      .insert(resourceBonus)
      .values(toResourceBonusRow(bonus))
      .onConflictDoNothing({ target: resourceBonus.sourceKey })
      .returning({ id: resourceBonus.id });
    return inserted.length === 1;
  }
}
