import { Inject, Injectable } from "@nestjs/common";

import { EntitlementReaderPort } from "#api/modules/access/feature-grants/access-feature-grants.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantToDate } from "#api/shared/domain/time/instant";

import type {
  DailySendFeatureQuota,
  DailySendQuotaUsage,
} from "../../../shared/application/ports/daily-send-usage.reader.port.js";
import { CheerLimitReaderPort } from "../../application/ports/cheer-limit.reader.port.js";

@Injectable()
export class CheerLimitReaderAdapter extends CheerLimitReaderPort {
  readonly #entitlementReader: Pick<
    EntitlementReaderPort,
    "getFeatureLimit" | "getFeatureLimitInTransaction" | "getFeatureQuotaInTransaction"
  >;

  constructor(
    @Inject(EntitlementReaderPort)
    entitlementReader: Pick<
      EntitlementReaderPort,
      "getFeatureLimit" | "getFeatureLimitInTransaction" | "getFeatureQuotaInTransaction"
    >,
  ) {
    super();
    this.#entitlementReader = entitlementReader;
  }

  readLimit(userId: UserId): Promise<number | null> {
    return this.#entitlementReader.getFeatureLimit(userId, "CHEER");
  }

  readLimitInTransaction(userId: UserId): Promise<number | null> {
    return this.#entitlementReader.getFeatureLimitInTransaction(userId, "CHEER");
  }

  readFeatureQuotaInTransaction(
    userId: UserId,
    usage: DailySendQuotaUsage,
  ): Promise<DailySendFeatureQuota> {
    return this.#entitlementReader.getFeatureQuotaInTransaction(userId, "CHEER", {
      used: usage.used,
      resetsAt: instantToDate(usage.resetsAt),
    });
  }
}
