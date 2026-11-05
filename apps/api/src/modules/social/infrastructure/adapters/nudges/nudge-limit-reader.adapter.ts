import type { FeatureQuota } from "@aido/api";
import { Inject, Injectable } from "@nestjs/common";

import {
  ENTITLEMENT_READER,
  type EntitlementReaderPort,
} from "#api/modules/access/access-entitlement.public";

import type { NudgeLimitReaderPort } from "../../../application/ports/nudges/nudge-limit-reader.port.js";
import type { DailySendUsage } from "../../../application/ports/quotas/daily-send-usage-reader.port.js";

@Injectable()
export class NudgeLimitReaderAdapter implements NudgeLimitReaderPort {
  constructor(
    @Inject(ENTITLEMENT_READER) private readonly entitlementReader: Pick<
      EntitlementReaderPort,
      "getLimitInTx" | "readFeatureQuotaInTx"
    >,
  ) {}

  async getDailyLimitInTx(userId: string): Promise<number | null> {
    return this.entitlementReader.getLimitInTx(userId, "NUDGE");
  }

  async readDailyQuotaInTx(userId: string, usage: DailySendUsage): Promise<FeatureQuota> {
    return this.entitlementReader.readFeatureQuotaInTx(userId, "NUDGE", usage);
  }
}
