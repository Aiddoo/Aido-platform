import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { createEntityId } from "#api/platform/database/entity-id";
import { resourceBonus } from "#api/platform/database/schema/access.schema";

import { FeatureGrantRepositoryPort } from "../../application/ports/feature-grant.repository.port.js";
import { FeatureGrantId } from "../../domain/feature-grant-id.vo.js";
import type { FeatureGrant } from "../../domain/feature-grant.aggregate.js";
import { toFeatureGrantRow } from "./feature-grant-row.mapper.js";

@Injectable()
export class DrizzleFeatureGrantRepository extends FeatureGrantRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    super();
    this.#txHost = txHost;
  }

  async nextId(): Promise<FeatureGrantId> {
    return FeatureGrantId.reconstitute(createEntityId());
  }

  async saveIfAbsent(grant: FeatureGrant): Promise<boolean> {
    // ResourceBonus_sourceKey_key 충돌은 같은 보상의 재지급이라 오류가 아니라 false다
    const inserted = await this.#txHost.tx
      .insert(resourceBonus)
      .values(toFeatureGrantRow(grant))
      .onConflictDoNothing({ target: resourceBonus.sourceKey })
      .returning({ id: resourceBonus.id });
    return inserted.length === 1;
  }
}
