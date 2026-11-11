import { CheerLimitReaderPort } from "#api/modules/social/cheers/application/ports/cheer-limit.reader.port";
import type {
  DailySendFeatureQuota,
  DailySendQuotaUsage,
} from "#api/modules/social/cheers/application/ports/daily-send-usage.reader.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { toIsoString } from "#api/shared/domain/time/instant";

// 고정 일일 한도의 featureQuota. 권한별 실제 계산은 access 단위 테스트가 본다
export function toStubDailyQuota(
  feature: "CHEER" | "NUDGE",
  limit: number | null,
  usage: DailySendQuotaUsage,
): DailySendFeatureQuota {
  return {
    feature,
    allowed: true,
    limit,
    used: usage.used,
    remaining: limit == null ? null : Math.max(0, limit - usage.used),
    period: "day",
    resetsAt: toIsoString(usage.resetsAt),
    isFairUse: false,
    perUse: null,
  };
}

// 사용자와 무관하게 같은 한도를 준다. null은 무제한이다
export class StubCheerLimitReader extends CheerLimitReaderPort {
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
    return toStubDailyQuota("CHEER", this.dailyLimit, usage);
  }
}
