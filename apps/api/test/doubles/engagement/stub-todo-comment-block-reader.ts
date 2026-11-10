import { TodoCommentBlockReaderPort } from "#api/modules/engagement/comments/application/ports/todo-comment-block-reader.port";

/** 차단 쌍을 방향과 상관없이 기억한다 */
export class StubTodoCommentBlockReader extends TodoCommentBlockReaderPort {
  readonly #blockedPairs = new Set<string>();

  block(blockerId: string, blockedId: string): void {
    this.#blockedPairs.add(`${blockerId}:${blockedId}`);
  }

  async findBlockedCounterpartIds(
    viewerId: string,
    candidateUserIds: readonly string[],
  ): Promise<ReadonlySet<string>> {
    return new Set(
      candidateUserIds.filter(
        (userId) =>
          this.#blockedPairs.has(`${viewerId}:${userId}`) ||
          this.#blockedPairs.has(`${userId}:${viewerId}`),
      ),
    );
  }
}
