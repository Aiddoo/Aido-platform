import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

/** 댓글을 가리거나 상호작용을 막을 차단 관계를 social Context의 공개 reader로 읽는다. */
export abstract class TodoCommentBlockReaderPort {
  /** candidateUserIds 중 viewerId와 어느 방향으로든 차단 관계인 사용자 ID */
  abstract findBlockedCounterpartIds(
    viewerId: UserId,
    candidateUserIds: readonly UserId[],
  ): Promise<ReadonlySet<string>>;
}
