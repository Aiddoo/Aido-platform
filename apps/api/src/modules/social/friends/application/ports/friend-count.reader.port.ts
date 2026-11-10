// 옛 Symbol 토큰. identity가 클래스 토큰으로 옮길 때까지 FriendCountReaderPort의 같은 인스턴스 별칭이다
export const FRIEND_COUNT_READER = Symbol("FRIEND_COUNT_READER");

/** 지금 맺은 친구 수. 친구 요청·초대의 한도 검사와 같은 개수(countMutualFriends)를 캐시 없이 센다. */
export abstract class FriendCountReaderPort {
  abstract countCurrentFriends(userId: string): Promise<number>;
}
