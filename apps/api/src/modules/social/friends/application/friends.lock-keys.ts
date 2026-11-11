import { MUTATION_KEY_PREFIX } from "#api/shared/application/ports/mutation-lock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 문자열을 바꾸면 배포가 겹치는 동안 이전 버전과 다른 잠금을 잡으므로 바이트 단위로 유지한다
export const FriendLockKeys = {
  // 두 사람 순서와 상관없이 같은 키가 되게 작은 id를 앞에 둔다
  pair: (userId: UserId, targetUserId: UserId): string => {
    const [smallerId, largerId] =
      userId.value < targetUserId.value
        ? [userId.value, targetUserId.value]
        : [targetUserId.value, userId.value];
    return `${MUTATION_KEY_PREFIX}:friend:pair:${smallerId}:${largerId}`;
  },
  list: (userId: UserId): string => `${MUTATION_KEY_PREFIX}:friend:list:${userId.value}`,
} as const;
