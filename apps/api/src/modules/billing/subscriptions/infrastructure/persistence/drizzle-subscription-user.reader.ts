import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";

import {
  type SubscriptionUser,
  SubscriptionUserReaderPort,
} from "../../application/ports/subscription-user.reader.port.js";

@Injectable()
export class DrizzleSubscriptionUserReader extends SubscriptionUserReaderPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    super();
    this.#txHost = txHost;
  }

  // RevenueCat은 처음에 User.id를 appUserId로 쓰고, 별칭이 생기면 storeAppUserId가 달라진다
  async findByAppUserId(appUserId: string): Promise<SubscriptionUser | null> {
    const row = await this.#txHost.tx.query.user.findFirst({
      columns: { id: true, email: true },
      where: { OR: [{ storeAppUserId: appUserId }, { id: appUserId }] },
      with: { profile: { columns: { name: true } } },
    });
    return row ?? null;
  }
}
