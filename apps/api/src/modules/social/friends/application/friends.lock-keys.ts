import { MUTATION_KEY_PREFIX } from "#api/shared/application/ports/mutation-lock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 문자열은 옮기기 전 공용 친구 잠금 키와 같아야 배포 중 옛 버전과 같은 잠금을 잡는다
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
