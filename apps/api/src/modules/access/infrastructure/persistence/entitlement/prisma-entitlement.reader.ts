import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import type { Prisma8TransactionalAdapter } from "../../../../../platform/database/prisma8-transactional.adapter.js";
import type {
  EntitlementDatabasePort,
  EntitlementUserState,
} from "../../../application/services/entitlement/entitlement-state.port.js";

/** Authorization reads participate in the caller's CLS transaction. */
@Injectable()
export class PrismaEntitlementReader implements EntitlementDatabasePort {
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  async findUserState(userId: string): Promise<EntitlementUserState | null> {
    return await this.txHost.tx.orm.public.User.where({ id: userId })
      .select("role", "subscriptionStatus")
      .first();
  }
}
