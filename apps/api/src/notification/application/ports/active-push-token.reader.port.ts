export const ACTIVE_PUSH_TOKEN_READER = Symbol("ACTIVE_PUSH_TOKEN_READER");

/** 활성 토큰의 cache-aside 조회를 푸시 전달 흐름에 제공한다. */
export interface ActivePushTokenReaderPort {
	findByUserId(userId: string): Promise<readonly string[]>;
	findByUserIds(userIds: readonly string[]): Promise<ReadonlyMap<string, readonly string[]>>;
}
