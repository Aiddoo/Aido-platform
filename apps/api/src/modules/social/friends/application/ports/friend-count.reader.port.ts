export const FRIEND_COUNT_READER = Symbol("FRIEND_COUNT_READER");

/** 지금 맺은 친구 수. 친구 요청·초대의 한도 검사와 같은 개수(countMutualFriends)를 캐시 없이 센다. */
export interface FriendCountReaderPort {
  countCurrentFriends(userId: string): Promise<number>;
}
