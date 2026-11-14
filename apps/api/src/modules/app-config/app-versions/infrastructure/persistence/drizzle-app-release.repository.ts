import { TransactionHost } from "@nestjs-cls/transactional";
import { Inject, Injectable } from "@nestjs/common";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { appRelease as appReleaseTable } from "#api/platform/database/schema/app-config.schema";

import {
  type AppConfigAppVersionsConfig,
  appConfigAppVersionsConfig,
} from "../../app-config-app-versions.config.js";
import { AppReleaseRepositoryPort } from "../../application/ports/app-release.repository.port.js";
import type { AppRelease } from "../../domain/app-release.aggregate.js";
import { withEnvironmentFallback } from "./app-release-env.mapper.js";
import { toAppRelease, toAppReleaseRow } from "./app-release-row.mapper.js";

@Injectable()
export class DrizzleAppReleaseRepository implements AppReleaseRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #config: AppConfigAppVersionsConfig;

  constructor(
    txHost: TransactionHost<DrizzleTransactionalAdapter>,
    @Inject(appConfigAppVersionsConfig.KEY) config: AppConfigAppVersionsConfig,
  ) {
    this.#txHost = txHost;
    this.#config = config;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async listLatestReleases(): Promise<AppRelease[]> {
    const rows = await this.#db.select().from(appReleaseTable);
    return withEnvironmentFallback(rows.map(toAppRelease), this.#config);
  }

  async save(release: AppRelease): Promise<void> {
    const row = toAppReleaseRow(release);
    await this.#db
      .insert(appReleaseTable)
      .values(row)
      .onConflictDoUpdate({
        target: appReleaseTable.platform,
        set: { latestVersion: row.latestVersion, updatedAt: row.updatedAt },
      });
  }
}
