import { Inject, Injectable } from "@nestjs/common";

import { EntitlementReaderPort } from "#api/modules/access/entitlements/access-entitlements.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantToDate } from "#api/shared/domain/time/instant";

import type {
  DailySendFeatureQuota,
  DailySendQuotaUsage,
} from "../../../shared/application/ports/daily-send-usage.reader.port.js";
import { NudgeLimitReaderPort } from "../../application/ports/nudge-limit.reader.port.js";

@Injectable()
export class NudgeLimitReaderAdapter extends NudgeLimitReaderPort {
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
    return this.#entitlementReader.getFeatureLimit(userId, "NUDGE");
  }

  readLimitInTx(userId: UserId): Promise<number | null> {
    return this.#entitlementReader.getFeatureLimitInTx(userId, "NUDGE");
  }

  readFeatureQuotaInTx(userId: UserId, usage: DailySendQuotaUsage): Promise<DailySendFeatureQuota> {
    return this.#entitlementReader.getFeatureQuotaInTx(userId, "NUDGE", {
      used: usage.used,
      resetsAt: instantToDate(usage.resetsAt),
    });
  }
}
