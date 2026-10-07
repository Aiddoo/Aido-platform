export const FOLLOW_READER = Symbol("FOLLOW_READER");

export interface FollowReaderPort {
  isMutualFriend(userId: string, targetUserId: string): Promise<boolean>;
  countFriends(userId: string): Promise<number>;
  getUserDisplayName(userId: string): Promise<string>;
  getMutualFriendIds(userId: string): Promise<string[]>;
  getCurrentMutualFriendIds(userId: string): Promise<string[]>;
}
