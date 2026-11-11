import type { EntitlementReaderPort } from "#api/modules/access/entitlements/access-entitlements.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// identity가 읽는 공개 모양이라 resetsAt은 아직 Date다
export interface DailySendUsage {
  readonly used: number;
  readonly resetsAt: Date;
}

// 응원·찌르기 일간 사용량. 보내기 한도 검사와 같은 요청 시간대 하루를 센다
export abstract class DailySendUsageReaderPort {
  abstract readDailyUsage(userId: UserId, timezone: string): Promise<DailySendUsage>;
}

// 한도 오류 details의 featureQuota를 계산할 때 넘기는 사용량. 한도 검사와 같은 하루에서 센 값이다
export interface DailySendQuotaUsage {
  readonly used: number;
  readonly resetsAt: Temporal.Instant;
}

// 한도 오류 details에 그대로 싣는 서버 계산 featureQuota. 모양은 access가 소유한다
export type DailySendFeatureQuota = Awaited<
  ReturnType<EntitlementReaderPort["getFeatureQuotaInTx"]>
>;
