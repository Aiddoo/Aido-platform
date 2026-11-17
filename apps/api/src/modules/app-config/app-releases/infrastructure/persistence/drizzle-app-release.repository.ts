import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { appRelease as appReleaseTable } from "#api/platform/database/schema/app-config.schema";

import { AppReleaseRepositoryPort } from "../../application/ports/app-release.repository.port.js";
import type { AppRelease } from "../../domain/app-release.aggregate.js";
import { toAppRelease, toAppReleaseRow } from "./app-release-row.mapper.js";

@Injectable()
export class DrizzleAppReleaseRepository implements AppReleaseRepositoryPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#transactionHost = transactionHost;
  }

  get #db() {
    return this.#transactionHost.tx;
  }

  async listLatestReleases(): Promise<AppRelease[]> {
    const rows = await this.#db.select().from(appReleaseTable);
    return rows.map(toAppRelease);
  }

  async save(appRelease: AppRelease): Promise<void> {
    const row = toAppReleaseRow(appRelease);
    await this.#db
      .insert(appReleaseTable)
      .values(row)
      .onConflictDoUpdate({
        target: appReleaseTable.platform,
        set: { latestVersion: row.latestVersion, updatedAt: row.updatedAt },
      });
  }
}
