import { compareSemanticVersions, isSemanticVersionAtLeast } from "@aido/api";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and } from "@prisma/orm-postgres/orm-client";

import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";

import type { ClientAppVersionReaderPort } from "../../../application/ports/delivery/client-app-version.reader.port.js";

/** 푸시 토큰에 남은 기기별 앱 버전 중 가장 높은 버전을 고른다. 형식이 틀린 버전은 무시한다 */
@Injectable()
export class PrismaClientAppVersionReader implements ClientAppVersionReaderPort {
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  async findLatestAppVersion(userId: string): Promise<string | null> {
    const tokens = await this.txHost.tx.orm.public.PushToken.where((row) =>
      and(row.userId.eq(userId), row.isActive.eq(true), row.appVersion.isNotNull()),
    )
      .select("appVersion")
      .all();

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
