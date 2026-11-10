// 활성 토큰의 cache-aside 조회를 푸시 전달 흐름에 제공한다
export abstract class ActivePushTokenReaderPort {
  abstract findByUserId(userId: string): Promise<readonly string[]>;
  abstract findByUserIds(
    userIds: readonly string[],
  ): Promise<ReadonlyMap<string, readonly string[]>>;
}
