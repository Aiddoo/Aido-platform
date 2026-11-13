import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { resourceBonus } from "#api/platform/database/schema/access.schema";

import type { FeatureGrantRepositoryPort } from "../../application/ports/feature-grant.repository.port.js";
import type { FeatureGrant } from "../../domain/feature-grant.aggregate.js";
import { toFeatureGrantRow } from "./feature-grant-row.mapper.js";

@Injectable()
export class DrizzleFeatureGrantRepository implements FeatureGrantRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async existsBySourceKey(sourceKey: string): Promise<boolean> {
    const row = await this.#db.query.resourceBonus.findFirst({
      columns: { id: true },
      where: { sourceKey },
    });
    return row != null;
  }

  async save(grant: FeatureGrant): Promise<void> {
    // ResourceBonus_sourceKey_key 충돌은 같은 보상의 재지급이라 오류 없이 건너뛴다(호출자 UoW를 깨지 않는다)
    await this.#db
      .insert(resourceBonus)
      .values(toFeatureGrantRow(grant))
      .onConflictDoNothing({ target: resourceBonus.sourceKey });
  }
}
