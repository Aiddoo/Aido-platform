import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { DailySendQuota, DailySendQuotaUsage } from "./daily-send-usage.reader.port.js";

// 응원 일간 한도. null은 무제한이다. InTx는 보내기 잠금 안에서 캐시 없이 최신 권한으로 읽는다
export abstract class CheerLimitReaderPort {
  abstract readDailyLimit(userId: UserId): Promise<number | null>;
  abstract readDailyLimitInTx(userId: UserId): Promise<number | null>;
  abstract readDailyQuotaInTx(userId: UserId, usage: DailySendQuotaUsage): Promise<DailySendQuota>;
}
