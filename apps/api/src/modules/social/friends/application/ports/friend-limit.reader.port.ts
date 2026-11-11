import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 한도 오류 details에 그대로 싣는 서버 계산 featureQuota다. 모양은 access Context가 정한다
export type FriendFeatureQuota = Readonly<Record<string, unknown>>;

// 친구 보유 한도. null은 무제한이다. InTx는 잠금 안에서 캐시 없이 최신 권한으로 읽는다
export abstract class FriendLimitReaderPort {
  // 표시용이라 캐시한 권한을 읽는다
  abstract readLimit(userId: UserId): Promise<number | null>;
  abstract readLimitInTx(userId: UserId): Promise<number | null>;
  // friendCount는 같은 잠금 안에서 센 지금 친구 수다
  abstract readFeatureQuotaInTx(userId: UserId, friendCount: number): Promise<FriendFeatureQuota>;
}
