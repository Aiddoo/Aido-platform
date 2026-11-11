import { Inject, Injectable } from "@nestjs/common";

import { EntitlementReaderPort } from "#api/modules/access/entitlements/access-entitlements.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantToDate } from "#api/shared/domain/time/instant";

import { CheerLimitReaderPort } from "../../application/ports/cheer-limit.reader.port.js";
import type {
  DailySendFeatureQuota,
  DailySendQuotaUsage,
} from "../../application/ports/daily-send-usage.reader.port.js";

@Injectable()
export class CheerLimitReaderAdapter extends CheerLimitReaderPort {
  readonly #entitlementReader: Pick<
    EntitlementReaderPort,
    "getFeatureLimit" | "getFeatureLimitInTx" | "getFeatureQuotaInTx"
  >;

  constructor(
    @Inject(EntitlementReaderPort)
    entitlementReader: Pick<
      EntitlementReaderPort,
      "getFeatureLimit" | "getFeatureLimitInTx" | "getFeatureQuotaInTx"
    >,
  ) {
    super();
    this.#entitlementReader = entitlementReader;
  }

  readLimit(userId: UserId): Promise<number | null> {
    return this.#entitlementReader.getFeatureLimit(userId, "CHEER");
  }

  readLimitInTx(userId: UserId): Promise<number | null> {
    return this.#entitlementReader.getFeatureLimitInTx(userId, "CHEER");
  }

  readFeatureQuotaInTx(userId: UserId, usage: DailySendQuotaUsage): Promise<DailySendFeatureQuota> {
    return this.#entitlementReader.getFeatureQuotaInTx(userId, "CHEER", {
      used: usage.used,
      resetsAt: instantToDate(usage.resetsAt),
    });
  }
}
