export const FRIEND_PORT = Symbol("FRIEND_PORT");

/**
 * 친구/맞팔 조회 포트 (follow 컨텍스트 경계)
 */
export interface FriendPort {
	isMutualFriend(userId: string, targetUserId: string): Promise<boolean>;
}
