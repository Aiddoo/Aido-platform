import type { CheerCountCachePort } from "#api/modules/social/cheers/application/ports/cheer-count-cache.port";
import type { NudgeCountCachePort } from "#api/modules/social/nudges/application/ports/nudge-count-cache.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 늘 다시 세고 버린 사용자를 남긴다. 콕·응원 수 캐시 자리에 같이 쓴다
export class PassThroughCountCache implements NudgeCountCachePort, CheerCountCachePort {
  readonly invalidatedUserIds: string[] = [];

  wrapReceivedCounts<T>(_userId: UserId, factory: () => Promise<T>): Promise<T> {
    return factory();
  }

  wrapSentCount(_userId: UserId, factory: () => Promise<number>): Promise<number> {
    return factory();
  }

  async invalidate(userIds: readonly UserId[]): Promise<void> {
    this.invalidatedUserIds.push(...userIds.map((userId) => userId.value));
  }
}
