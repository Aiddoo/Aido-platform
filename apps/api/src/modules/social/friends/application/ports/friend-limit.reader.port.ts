import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 한도 오류 details에 그대로 싣는 서버 계산 featureQuota다. 모양은 access Context가 정한다
export type FriendQuota = Readonly<Record<string, unknown>>;

// 친구 보유 한도. null은 무제한이다
export abstract class FriendLimitReaderPort {
  // 표시용이라 캐시한 권한을 읽는다
  abstract readMaxFriendCount(userId: UserId): Promise<number | null>;
  // 잠금 뒤 한도 검사용. 활성 UoW에서 캐시 없이 다시 판단한다
  abstract readMaxFriendCountInTx(userId: UserId): Promise<number | null>;
  abstract readQuotaInTx(userId: UserId, friendCount: number): Promise<FriendQuota>;
}
