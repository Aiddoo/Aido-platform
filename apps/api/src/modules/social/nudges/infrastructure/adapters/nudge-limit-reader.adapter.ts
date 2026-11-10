import type { FeatureQuota } from "@aido/api";
import { Inject, Injectable } from "@nestjs/common";

import {
  ENTITLEMENT_READER,
  type EntitlementReaderPort,
} from "#api/modules/access/access-entitlement.public";

import type { DailySendUsage } from "../../../cheers/application/ports/daily-send-usage.reader.port.js";
import type { NudgeLimitReaderPort } from "../../application/ports/nudge-limit.reader.port.js";

@Injectable()
export class NudgeLimitReaderAdapter implements NudgeLimitReaderPort {
  readonly #entitlementReader: Pick<EntitlementReaderPort, "getLimitInTx" | "readFeatureQuotaInTx">;

  constructor(
    @Inject(ENTITLEMENT_READER) entitlementReader: Pick<
      EntitlementReaderPort,
      "getLimitInTx" | "readFeatureQuotaInTx"
    >,
  ) {
    this.#entitlementReader = entitlementReader;
  }

  async getDailyLimitInTx(userId: string): Promise<number | null> {
    return this.#entitlementReader.getLimitInTx(userId, "NUDGE");
  }

  async readDailyQuotaInTx(userId: string, usage: DailySendUsage): Promise<FeatureQuota> {
    return this.#entitlementReader.readFeatureQuotaInTx(userId, "NUDGE", usage);
  }
}
