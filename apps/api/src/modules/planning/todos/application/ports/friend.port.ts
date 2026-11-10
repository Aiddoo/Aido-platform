/**
 * 친구/맞팔 조회 포트 (follow 컨텍스트 경계)
 */
export abstract class FriendPort {
  abstract isMutualFriend(userId: string, targetUserId: string): Promise<boolean>;
  abstract getMutualFriendIds(userId: string): Promise<string[]>;
  abstract getUserDisplayName(userId: string): Promise<string>;
}
