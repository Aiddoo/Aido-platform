import { compareSemanticVersions, isSemanticVersionAtLeast } from "@aido/api";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { ClientAppVersionReaderPort } from "../../application/ports/client-app-version.reader.port.js";

/** 푸시 토큰에 남은 기기별 앱 버전 중 가장 높은 버전을 고른다. 형식이 틀린 버전은 무시한다 */
@Injectable()
export class DrizzleClientAppVersionReader implements ClientAppVersionReaderPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  async findLatestAppVersion(userId: UserId): Promise<string | null> {
    const tokens = await this.#txHost.tx.query.pushToken.findMany({
      columns: { appVersion: true },
      where: { userId: userId.value, isActive: true, appVersion: { isNotNull: true } },
    });

    let latest: string | null = null;
    for (const { appVersion } of tokens) {
      // 0.0.0 이상인지 묻는 것으로 SemVer 형식이 맞는지 확인한다
      if (appVersion == null || !isSemanticVersionAtLeast(appVersion, "0.0.0")) {
        continue;
      }
      if (latest == null || (compareSemanticVersions(appVersion, latest) ?? 0) > 0) {
        latest = appVersion;
      }
    }
    return latest;
  }
}
