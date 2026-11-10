import { Inject, Injectable } from "@nestjs/common";

import {
  ENTITLEMENT_READER,
  type EntitlementReaderPort,
} from "#api/modules/access/access-entitlement.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantToDate } from "#api/shared/domain/time/instant";

import type {
  DailySendQuota,
  DailySendQuotaUsage,
} from "../../../cheers/application/ports/daily-send-usage.reader.port.js";
import { NudgeLimitReaderPort } from "../../application/ports/nudge-limit.reader.port.js";

@Injectable()
export class NudgeLimitReaderAdapter extends NudgeLimitReaderPort {
  readonly #entitlementReader: Pick<
    EntitlementReaderPort,
    "getLimit" | "getLimitInTx" | "readFeatureQuotaInTx"
  >;

  constructor(
    @Inject(ENTITLEMENT_READER)
    entitlementReader: Pick<
      EntitlementReaderPort,
      "getLimit" | "getLimitInTx" | "readFeatureQuotaInTx"
    >,
  ) {
    super();
    this.#entitlementReader = entitlementReader;
  }

  readDailyLimit(userId: UserId): Promise<number | null> {
    return this.#entitlementReader.getLimit(userId.value, "NUDGE");
  }

  readDailyLimitInTx(userId: UserId): Promise<number | null> {
    return this.#entitlementReader.getLimitInTx(userId.value, "NUDGE");
  }

  readDailyQuotaInTx(userId: UserId, usage: DailySendQuotaUsage): Promise<DailySendQuota> {
    return this.#entitlementReader.readFeatureQuotaInTx(userId.value, "NUDGE", {
      used: usage.used,
      resetsAt: instantToDate(usage.resetsAt),
    });
  }
}
