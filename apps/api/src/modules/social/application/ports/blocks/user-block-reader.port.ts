export const USER_BLOCK_READER = Symbol("USER_BLOCK_READER");

/** 두 사용자 사이의 차단 상태. 어느 쪽이든 차단이 있으면 서로의 콘텐츠와 상호작용을 막는다. */
export interface UserBlockRelation {
  /** userId가 상대를 차단했다 */
  readonly isBlocking: boolean;
  /** 상대가 userId를 차단했다 */
  readonly isBlockedBy: boolean;
}

/**
 * 다른 slice·Context가 차단 테이블을 직접 읽지 않고 쓰는 공개 capability.
 *
 * 활성 UoW 안에서 부르면 같은 transaction의 연결로 읽는다.
 */
export interface UserBlockReaderPort {
  findRelation(userId: string, otherUserId: string): Promise<UserBlockRelation>;
  /** candidateUserIds 중 viewerId와 어느 방향으로든 차단 관계인 사용자 ID. 한 번의 조회로 읽는다. */
  findBlockedCounterpartIds(
    viewerId: string,
    candidateUserIds: readonly string[],
  ): Promise<ReadonlySet<string>>;
}
