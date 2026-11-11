import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  DailySendFeatureQuota,
  DailySendQuotaUsage,
} from "../../../cheers/application/ports/daily-send-usage.reader.port.js";

// 콕 일간 한도. null은 무제한이다. InTx는 보내기 잠금 안에서 캐시 없이 최신 권한으로 읽는다
export abstract class NudgeLimitReaderPort {
  abstract readLimit(userId: UserId): Promise<number | null>;
  abstract readLimitInTx(userId: UserId): Promise<number | null>;
  abstract readFeatureQuotaInTx(
    userId: UserId,
    usage: DailySendQuotaUsage,
  ): Promise<DailySendFeatureQuota>;
}
