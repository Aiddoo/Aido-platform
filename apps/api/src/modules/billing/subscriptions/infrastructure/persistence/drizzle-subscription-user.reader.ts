import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { uniq, uniqBy } from "es-toolkit";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { SubscriptionUserReaderPort } from "../../application/ports/subscription-user.reader.port.js";
import type { SubscriptionUserReadModel } from "../../application/read-models/subscription-user.read-model.js";

interface SubscriptionUserRow {
  readonly id: string;
  readonly email: string;
  readonly storeAppUserId: string | null;
  readonly profile: { readonly name: string | null } | null;
}

@Injectable()
export class DrizzleSubscriptionUserReader implements SubscriptionUserReaderPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#transactionHost = transactionHost;
  }

  async findFirstByAppUserIds(
    appUserIds: readonly string[],
  ): Promise<SubscriptionUserReadModel | null> {
    const [first] = await this.listByAppUserIds(appUserIds);
    return first ?? null;
  }

  // RevenueCat은 처음에 User.id를 appUserId로 쓰고, 별칭이 생기면 storeAppUserId가 달라진다
  async listByAppUserIds(appUserIds: readonly string[]): Promise<SubscriptionUserReadModel[]> {
    const ids = uniq(appUserIds);
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.#transactionHost.tx.query.user.findMany({
      columns: { id: true, email: true, storeAppUserId: true },
      where: { OR: [{ storeAppUserId: { in: ids } }, { id: { in: ids } }] },
      with: { profile: { columns: { name: true } } },
    });
    const matched = ids.flatMap((appUserId) => {
      const row =
        rows.find((candidate) => candidate.storeAppUserId === appUserId) ??
        rows.find((candidate) => candidate.id === appUserId);
      return row == null ? [] : [row];
    });
    return uniqBy(matched, (row) => row.id).map(toSubscriptionUser);
  }
}

function toSubscriptionUser(row: SubscriptionUserRow): SubscriptionUserReadModel {
  return { id: UserId.reconstitute(row.id), email: row.email, name: row.profile?.name ?? null };
}
