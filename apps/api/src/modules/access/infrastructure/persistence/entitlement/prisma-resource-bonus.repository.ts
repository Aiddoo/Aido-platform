import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import { encodeCreate } from "#api/platform/database/database-records";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";

import type { GrantResourceBonusInput } from "../../../application/ports/entitlement/resource-bonus-granter.port.js";
import type { ResourceBonusRepositoryPort } from "../../../application/ports/entitlement/resource-bonus.repository.port.js";

@Injectable()
export class PrismaResourceBonusRepository implements ResourceBonusRepositoryPort {
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  async create(input: GrantResourceBonusInput): Promise<boolean> {
    const inserted = await this.txHost.tx.orm.public.ResourceBonus.createAndCount(
      [
        encodeCreate("ResourceBonus", {
          userId: input.userId,
          resource: input.resource,
          quantity: input.quantity,
          sourceKey: input.sourceKey,
        }),
      ],
      { onConflict: "skip", conflictOn: ["sourceKey"] },
    );
    return inserted === 1;
  }
}
