import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { uniq, uniqBy } from "es-toolkit";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { StoreAppUserReaderPort } from "../../application/ports/store-app-user.reader.port.js";
import type { StoreAppUserReadModel } from "../../application/read-models/store-app-user.read-model.js";

interface StoreAppUserRow {
  readonly id: string;
  readonly email: string;
  readonly storeAppUserId: string | null;
  readonly profile: { readonly name: string | null } | null;
}

@Injectable()
export class DrizzleStoreAppUserReader extends StoreAppUserReaderPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    super();
    this.#transactionHost = transactionHost;
  }

  // RevenueCat은 처음에 User.id를 appUserId로 쓰고, 별칭이 생기면 storeAppUserId가 달라진다
  async listByStoreAppUserIds(appUserIds: readonly string[]): Promise<StoreAppUserReadModel[]> {
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
    return uniqBy(matched, (row) => row.id).map(toStoreAppUser);
  }
}

function toStoreAppUser(row: StoreAppUserRow): StoreAppUserReadModel {
  return { id: UserId.reconstitute(row.id), email: row.email, name: row.profile?.name ?? null };
}
