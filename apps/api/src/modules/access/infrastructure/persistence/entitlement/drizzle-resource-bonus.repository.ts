import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { resourceBonus } from "#api/platform/database/schema/index";

import type { GrantResourceBonusInput } from "../../../application/ports/entitlement/resource-bonus-granter.port.js";
import type { ResourceBonusRepositoryPort } from "../../../application/ports/entitlement/resource-bonus.repository.port.js";

@Injectable()
export class DrizzleResourceBonusRepository implements ResourceBonusRepositoryPort {
  constructor(private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>) {}

  async create(input: GrantResourceBonusInput): Promise<boolean> {
    const inserted = await this.txHost.tx
      .insert(resourceBonus)
      .values({
        userId: input.userId,
        resource: input.resource,
        quantity: input.quantity,
        sourceKey: input.sourceKey,
      })
      .onConflictDoNothing({ target: resourceBonus.sourceKey })
      .returning({ id: resourceBonus.id });
    return inserted.length === 1;
  }
}
