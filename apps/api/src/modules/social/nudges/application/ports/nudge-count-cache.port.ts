import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export interface ReceivedNudgeCounts {
  readonly total: number;
  readonly unread: number;
}

/**
 * 목록이 매 쪽 함께 주는 콕 수를 짧게 담는다. 만들기·읽음·차단 때 그 사용자들 값을 버리고,
 * 할 일·계정 삭제로 줄어든 수는 TTL(1분) 안에 맞춰진다
 */
export abstract class NudgeCountCachePort {
  abstract wrapReceivedCounts(
    userId: UserId,
    factory: () => Promise<ReceivedNudgeCounts>,
  ): Promise<ReceivedNudgeCounts>;
  abstract wrapSentCount(userId: UserId, factory: () => Promise<number>): Promise<number>;
  /** 받은·보낸 수를 모두 버린다 */
  abstract invalidate(userIds: readonly UserId[]): Promise<void>;
}
