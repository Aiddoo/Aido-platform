import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { featureGrant } from "#api/platform/database/schema/access.schema";

import type { FeatureGrantRepositoryPort } from "../../application/ports/feature-grant.repository.port.js";
import type { FeatureGrant } from "../../domain/feature-grant.aggregate.js";
import { toFeatureGrant, toFeatureGrantRow } from "./feature-grant-row.mapper.js";

@Injectable()
export class DrizzleFeatureGrantRepository implements FeatureGrantRepositoryPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#transactionHost = transactionHost;
  }

  async findBySourceKey(sourceKey: string): Promise<FeatureGrant | null> {
    const row = await this.#db.query.featureGrant.findFirst({ where: { sourceKey } });
    return row == null ? null : toFeatureGrant(row);
  }

  async save(grant: FeatureGrant): Promise<void> {
    // ResourceBonus_sourceKey_key 충돌은 같은 보상의 재지급이라 오류 없이 건너뛴다(호출자 UoW를 깨지 않는다)
    await this.#db
      .insert(featureGrant)
      .values(toFeatureGrantRow(grant))
      .onConflictDoNothing({ target: featureGrant.sourceKey });
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}
