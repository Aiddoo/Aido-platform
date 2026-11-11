import type {
  DailySendFeatureQuota,
  DailySendQuotaUsage,
} from "#api/modules/social/cheers/application/ports/daily-send-usage.reader.port";
import { NudgeLimitReaderPort } from "#api/modules/social/nudges/application/ports/nudge-limit.reader.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { toStubDailyQuota } from "./stub-cheer-limit-reader.js";

// 사용자와 무관하게 같은 한도를 준다. null은 무제한이다
export class StubNudgeLimitReader extends NudgeLimitReaderPort {
  dailyLimit: number | null;

  constructor(dailyLimit: number | null) {
    super();
    this.dailyLimit = dailyLimit;
  }

  async readLimit(_userId: UserId): Promise<number | null> {
    return this.dailyLimit;
  }

  async readLimitInTx(_userId: UserId): Promise<number | null> {
    return this.dailyLimit;
  }

  async readFeatureQuotaInTx(
    _userId: UserId,
    usage: DailySendQuotaUsage,
  ): Promise<DailySendFeatureQuota> {
    return toStubDailyQuota("NUDGE", this.dailyLimit, usage);
  }
}
