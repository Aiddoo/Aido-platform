import { vi } from "vitest";

import {
  createEngagementCommentFixture,
  ENGAGEMENT_TIME,
  ENGAGEMENT_OWNER_ID,
  ENGAGEMENT_VIEWER_ID,
} from "#test/fixtures/engagement-comment.fixture";

import { EngagementCommentLogEvent } from "../../observability/comments/engagement-comment-log.events.js";
import {
  TodoCommentIdempotencyConflict,
  TodoCommentIdempotencyRace,
} from "../../ports/comments/todo-comment.repository.port.js";
import {
  WriteTodoCommentChain,
  type WriteTodoCommentChainInput,
} from "./write-todo-comment-chain.use-case.js";

describe("WriteTodoCommentChain — 댓글 작성과 멱등성", () => {
  let fixture: ReturnType<typeof createEngagementCommentFixture>;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(ENGAGEMENT_TIME);
    fixture = createEngagementCommentFixture();
  });
  afterEach(() => vi.useRealTimers());

  function input(): WriteTodoCommentChainInput {
    return {
      todoId: 1,
      authorId: ENGAGEMENT_VIEWER_ID,
      parentId: null,
      items: [
        { clientRequestId: "b7b0f6d4-6f1e-4d6a-9e0a-2d6a1c1f3a11", content: "  함께 해요  " },
      ],
    };
  }

  it("원문을 정규화해 저장하고 알림 경계에는 원문 없이 작성 정보만 전달한다", async () => {
    // Given
    const useCase = new WriteTodoCommentChain(fixture);
    // When
    const result = await useCase.execute(input());
    // Then
    const comment = result.comments[0];
    if (comment === undefined) throw new Error("댓글 응답 fixture가 비어 있습니다.");
    expect(comment.content).toBe("함께 해요");
    expect(fixture.repository.comments.get(comment.id)?.content).toBe("함께 해요");
    expect(fixture.repository.commentCounts.get(1)).toBe(1);
    expect(fixture.notification.written).toEqual([
      {
        recipientId: ENGAGEMENT_OWNER_ID,
        senderId: ENGAGEMENT_VIEWER_ID,
        senderName: "방문자",
        todoId: 1,
        commentId: comment.id,
        threadRootId: comment.id,
        isReply: false,
        commentCount: 1,
      },
    ]);
    expect(fixture.invalidatedTodoIds).toEqual([1]);
  });

  it("알림이 실패해도 저장된 댓글과 성공 응답을 유지한다", async () => {
    // Given
    vi.spyOn(fixture.notification, "notifyCommentsWritten").mockRejectedValueOnce(
      new Error("push down"),
    );
    // When
    const result = await new WriteTodoCommentChain(fixture).execute(input());
    // Then
    expect(result.comments).toHaveLength(1);
    expect(fixture.repository.comments.size).toBe(1);
    expect(fixture.repository.commentCounts.get(1)).toBe(1);
    expect(fixture.invalidatedTodoIds).toEqual([1]);
  });

  it("캐시 정리가 동기로 실패해도 둘째 알림 작업과 성공 응답을 유지하며 원문 오류를 기록하지 않는다", async () => {
    // Given
    vi.spyOn(fixture.todoViewCache, "invalidateForTodo").mockImplementation(() => {
      throw new Error("private cache error content");
    });
    const warning = vi.spyOn(fixture.logger, "warn");
    // When
    const result = await new WriteTodoCommentChain(fixture).execute(input());
    // Then
    expect(result.comments).toHaveLength(1);
    expect(fixture.notification.written).toHaveLength(1);
    expect(fixture.repository.comments.size).toBe(1);
    expect(warning).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warning.mock.calls)).not.toContain("private cache error content");
    expect(warning.mock.calls[0]?.[0]).toEqual({
      event: EngagementCommentLogEvent.VIEW_CACHE_INVALIDATION_FAILED,
      todoId: 1,
      userId: ENGAGEMENT_VIEWER_ID,
      errorType: "Error",
    });
  });

  it("작성 멱등 잠금은 UoW 안에서 획득하고 완료 뒤에만 알림을 처리한다", async () => {
    // Given
    let insideUnitOfWork = false;
    const prepared = Promise.withResolvers<void>();
    const finish = Promise.withResolvers<void>();
    const lock = vi.spyOn(fixture.mutationLock, "acquire").mockImplementation(async () => {
      expect(insideUnitOfWork).toBe(true);
    });
    fixture.unitOfWork.run = async (work) => {
      insideUnitOfWork = true;
      const result = await work();
      insideUnitOfWork = false;
      prepared.resolve();
      await finish.promise;
      return result;
    };
    // When
    const outcome = new WriteTodoCommentChain(fixture).execute(input());
    await Promise.race([
      prepared.promise,
      outcome.then(() => {
        throw new Error("UoW 대기 전에 작성이 끝났습니다.");
      }),
    ]);
    // Then
    try {
      expect(fixture.notification.written).toEqual([]);
      expect(fixture.invalidatedTodoIds).toEqual([]);
      expect(lock).toHaveBeenCalledTimes(1);
    } finally {
      finish.resolve();
    }
    await outcome;
    expect(fixture.notification.written).toHaveLength(1);
  });

  it("정확한 replay는 원래 댓글과 viewer 좋아요를 반환하고 count·알림을 다시 변경하지 않는다", async () => {
    // Given
    const useCase = new WriteTodoCommentChain(fixture);
    const original = await useCase.execute(input());
    const commentId = original.comments[0]?.id;
    if (commentId === undefined) throw new Error("댓글 fixture가 비어 있습니다.");
    await fixture.repository.setLike(1, commentId, ENGAGEMENT_VIEWER_ID);
    // When
    const result = await useCase.execute(input());
    // Then
    expect(result.comments[0]?.id).toBe(commentId);
    expect(result.comments[0]?.viewer.isLiked).toBe(true);
    expect(fixture.repository.comments.size).toBe(1);
    expect(fixture.repository.commentCounts.get(1)).toBe(1);
    expect(fixture.notification.written).toHaveLength(1);
    expect(fixture.invalidatedTodoIds).toEqual([1]);
  });

  it("같은 멱등 키의 다른 명령은 SYS_0002로 거부하고 원래 댓글을 유지한다", async () => {
    // Given
    const useCase = new WriteTodoCommentChain(fixture);
    await useCase.execute(input());
    // When / Then
    await expect(
      useCase.execute({
        ...input(),
        items: [{ clientRequestId: input().items[0]?.clientRequestId ?? "", content: "다른 내용" }],
      }),
    ).rejects.toMatchObject({ errorCode: "SYS_0002" });
    expect(fixture.repository.comments.size).toBe(1);
    expect(fixture.repository.commentCounts.get(1)).toBe(1);
  });

  it("멱등 경합 신호를 받으면 새 UoW에서 승자 결과를 replay하고 counter·알림을 중복 처리하지 않는다", async () => {
    // Given
    const create = fixture.repository.createCommentChain.bind(fixture.repository);
    vi.spyOn(fixture.repository, "createCommentChain").mockImplementationOnce(async (command) => {
      await create(command);
      throw new TodoCommentIdempotencyRace();
    });
    const run = vi.spyOn(fixture.unitOfWork, "run");
    // When
    const result = await new WriteTodoCommentChain(fixture).execute(input());
    // Then
    expect(result.comments).toHaveLength(1);
    expect(fixture.repository.comments.size).toBe(1);
    expect(fixture.repository.commentCounts.get(1)).toBeUndefined();
    expect(fixture.notification.written).toEqual([]);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("경합 뒤 승자 명령이 다르면 SYS_0002로 거부한다", async () => {
    // Given
    const replay = vi
      .spyOn(fixture.repository, "findCommentChainReplay")
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new TodoCommentIdempotencyConflict());
    vi.spyOn(fixture.repository, "createCommentChain").mockRejectedValueOnce(
      new TodoCommentIdempotencyRace(),
    );
    // When / Then
    await expect(new WriteTodoCommentChain(fixture).execute(input())).rejects.toMatchObject({
      errorCode: "SYS_0002",
    });
    expect(replay).toHaveBeenCalledTimes(2);
    expect(fixture.notification.written).toEqual([]);
  });

  it("경합 뒤 접근권한을 잃으면 승자 댓글이 있어도 새 UoW에서 TODO_0801로 거부한다", async () => {
    // Given
    const create = fixture.repository.createCommentChain.bind(fixture.repository);
    vi.spyOn(fixture.repository, "createCommentChain").mockImplementationOnce(async (command) => {
      await create(command);
      fixture.reader.accessiblePairs.delete(`1:${ENGAGEMENT_VIEWER_ID}`);
      throw new TodoCommentIdempotencyRace();
    });
    // When / Then
    await expect(new WriteTodoCommentChain(fixture).execute(input())).rejects.toMatchObject({
      errorCode: "TODO_0801",
    });
    expect(fixture.repository.comments.size).toBe(1);
    expect(fixture.notification.written).toEqual([]);
    expect(fixture.invalidatedTodoIds).toEqual([]);
  });
});
