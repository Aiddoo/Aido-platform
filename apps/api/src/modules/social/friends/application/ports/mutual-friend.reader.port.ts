import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 다른 slice·Context가 묻는 친구 판정이다. current 메서드는 권한·한도를 판단하는 쓰기 경로라 캐시를 거치지 않는다
export abstract class MutualFriendReaderPort {
  abstract isMutualFriend(userId: UserId, targetUserId: UserId): Promise<boolean>;
  abstract isCurrentMutualFriend(userId: UserId, targetUserId: UserId): Promise<boolean>;
  abstract countFriends(userId: UserId): Promise<number>;
  // 친구 요청·초대의 한도 검사와 같은 개수(countMutualFriends)다
  abstract countCurrentFriends(userId: UserId): Promise<number>;
  abstract getMutualFriendIds(userId: UserId): Promise<string[]>;
  abstract getCurrentMutualFriendIds(userId: UserId): Promise<string[]>;
  // 알림에 쓰는 이름이다. 이름이 없으면 Aido ID(userTag)다
  abstract getUserDisplayName(userId: UserId): Promise<string>;
}
