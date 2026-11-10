import { Inject, Injectable } from "@nestjs/common";

import {
  ENTITLEMENT_READER,
  type EntitlementReaderPort,
} from "#api/modules/access/access-entitlement.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantToDate } from "#api/shared/domain/time/instant";

import { CheerLimitReaderPort } from "../../application/ports/cheer-limit.reader.port.js";
import type {
  DailySendQuota,
  DailySendQuotaUsage,
} from "../../application/ports/daily-send-usage.reader.port.js";

@Injectable()
export class CheerLimitReaderAdapter extends CheerLimitReaderPort {
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
    return this.#entitlementReader.getLimit(userId.value, "CHEER");
  }

  readDailyLimitInTx(userId: UserId): Promise<number | null> {
    return this.#entitlementReader.getLimitInTx(userId.value, "CHEER");
  }

  readDailyQuotaInTx(userId: UserId, usage: DailySendQuotaUsage): Promise<DailySendQuota> {
    return this.#entitlementReader.readFeatureQuotaInTx(userId.value, "CHEER", {
      used: usage.used,
      resetsAt: instantToDate(usage.resetsAt),
    });
  }
}
