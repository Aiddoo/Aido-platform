import { ErrorCode } from "@aido/api/errors";

import { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import { InMemoryTodoCommentRepository } from "#test/doubles/engagement/in-memory-todo-comment.repository";
import {
  nextClientRequestId,
  TODO_COMMENT_FIXTURE_FRIEND_ID,
  TODO_COMMENT_FIXTURE_OWNER_ID,
  TODO_COMMENT_FIXTURE_TODO_ID,
  TODO_COMMENT_FIXTURE_VIEWER_ID,
} from "#test/fixtures/engagement/todo-comment.fixture";
import {
  createTodoCommentsFixture,
  type TodoCommentsFixture,
} from "#test/fixtures/engagement/todo-comments.fixture";

import { TodoCommentIdempotencyRace } from "../comments.errors.js";
import { TodoCommentLockKeys } from "../comments.lock-keys.js";
import { TodoCommentLogEvent } from "../comments.log-events.js";
import { WriteTodoCommentChainUseCase } from "./write-todo-comment-chain.use-case.js";

const TODO_ID = TODO_COMMENT_FIXTURE_TODO_ID;

function createUseCase(fixture: TodoCommentsFixture) {
  return new WriteTodoCommentChainUseCase(fixture);
}

function chainOf(...contents: string[]) {
  return contents.map((content) => ({ clientRequestId: nextClientRequestId(), content }));
}

describe("WriteTodoCommentChainUseCase — 댓글 작성과 멱등성", () => {
  let fixture: TodoCommentsFixture;

  beforeEach(() => {
    fixture = createTodoCommentsFixture();
  });

  it("원문을 다듬어 저장하고 알림에는 원문 없이 작성 정보만 넘긴다", async () => {
    // Given
    const useCase = createUseCase(fixture);

    // When
    const result = await useCase.execute({
      todoId: TODO_ID,
      authorId: TODO_COMMENT_FIXTURE_VIEWER_ID,
      parentId: null,
      items: chainOf("  함께 해요  "),
    });

    // Then
    expect(result.comments.map((comment) => comment.content)).toEqual(["함께 해요"]);
    expect(fixture.engagementCounter.commentCounts.get(TODO_ID)).toBe(1);
    expect(fixture.todoViewCache.invalidatedTodoIds).toEqual([TODO_ID]);
    expect(fixture.notification.written).toEqual([
      {
        recipientId: TODO_COMMENT_FIXTURE_OWNER_ID,
        senderId: TODO_COMMENT_FIXTURE_VIEWER_ID,
        senderName: "방문자",
        todoId: TODO_ID,
        commentId: result.comments[0]?.id,
        threadRootId: result.comments[0]?.id,
        replyTarget: null,
        commentCount: 1,
      },
    ]);
    expect(JSON.stringify(fixture.notification.written)).not.toContain("함께 해요");
  });

  it("할 일에 이어 쓴 글은 첫 글을 머리로 한 묶음의 답글이 되고 각자 앞 글에 답한다", async () => {
    // Given
    const useCase = createUseCase(fixture);

    // When
    const result = await useCase.execute({
      todoId: TODO_ID,
      authorId: TODO_COMMENT_FIXTURE_VIEWER_ID,
      parentId: null,
      items: chainOf("하나", "둘", "셋"),
    });

    // Then
    const [head, second, third] = result.comments;
    expect(head).toMatchObject({ threadCommentId: null, replyCount: 2 });
    expect(second).toMatchObject({ threadCommentId: head?.id, replyToCommentId: head?.id });
    expect(third).toMatchObject({ threadCommentId: head?.id, replyToCommentId: second?.id });
    expect(fixture.engagementCounter.commentCounts.get(TODO_ID)).toBe(3);
    expect(fixture.notification.written.map((input) => input.commentCount)).toEqual([3]);
  });

  it("답글에 답하면 같은 묶음 끝에 붙고 머리 답글 수를 올리며 답글 작성자에게 알린다", async () => {
    // Given
    const head = await fixture.addComment({ replyCount: 1 });
    const reply = await fixture.addComment({
      authorId: TODO_COMMENT_FIXTURE_FRIEND_ID,
      parentId: head.id.value,
      replyToCommentId: head.id.value,
    });

    // When
    const result = await createUseCase(fixture).execute({
      todoId: TODO_ID,
      authorId: TODO_COMMENT_FIXTURE_VIEWER_ID,
      parentId: reply.id.value,
      items: chainOf("답글에 답글"),
    });

    // Then
    expect(result.comments[0]).toMatchObject({
      threadCommentId: head.id.value,
      replyToCommentId: reply.id.value,
    });
    const storedHead = await fixture.repository.findByIdAndTodoId(
      head.id,
      TodoId.reconstitute(TODO_ID),
    );
    expect(storedHead?.replyCount).toBe(2);
    expect(fixture.mutationLock.acquiredKeys.at(0)?.slice(1)).toEqual([
      TodoCommentLockKeys.comment(reply.id.value),
      TodoCommentLockKeys.comment(head.id.value),
    ]);
    expect(fixture.notification.written[0]).toMatchObject({
      recipientId: TODO_COMMENT_FIXTURE_FRIEND_ID,
      threadRootId: head.id.value,
      replyTarget: "REPLY",
    });
  });

  it("묘비가 된 댓글의 답글에는 답할 수 있지만 지운 글에는 답하지 못한다", async () => {
    // Given
    const tombstone = await fixture.addComment({
      content: null,
      replyCount: 1,
      deletedAt: TODO_COMMENT_FIXTURE_NOW_PLUS_MINUTE,
    });
    const reply = await fixture.addComment({
      authorId: TODO_COMMENT_FIXTURE_FRIEND_ID,
      parentId: tombstone.id.value,
      replyToCommentId: tombstone.id.value,
    });
    const useCase = createUseCase(fixture);

    // When
    const toReply = await useCase.execute({
      todoId: TODO_ID,
      authorId: TODO_COMMENT_FIXTURE_VIEWER_ID,
      parentId: reply.id.value,
      items: chainOf("살아 있는 답글에"),
    });
    const toTombstone = useCase.execute({
      todoId: TODO_ID,
      authorId: TODO_COMMENT_FIXTURE_VIEWER_ID,
      parentId: tombstone.id.value,
      items: chainOf("지운 글에"),
    });

    // Then
    expect(toReply.comments).toHaveLength(1);
    await expect(toTombstone).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0833 });
  });

  it("차단 관계인 사람의 글에는 답글을 저장하지 않는다", async () => {
    // Given
    const comment = await fixture.addComment({ authorId: TODO_COMMENT_FIXTURE_FRIEND_ID });
    fixture.blockReader.block(TODO_COMMENT_FIXTURE_FRIEND_ID, TODO_COMMENT_FIXTURE_VIEWER_ID);

    // When
    const writing = createUseCase(fixture).execute({
      todoId: TODO_ID,
      authorId: TODO_COMMENT_FIXTURE_VIEWER_ID,
      parentId: comment.id.value,
      items: chainOf("답글"),
    });

    // Then
    await expect(writing).rejects.toMatchObject({ errorCode: ErrorCode.BLOCK_2204 });
    expect(fixture.repository.list()).toHaveLength(1);
  });

  it("알림이 실패해도 저장한 글과 성공 응답을 유지하고 오류 원문을 로그에 남기지 않는다", async () => {
    // Given
    fixture.notification.failure = new Error("private notification failure");

    // When
    const result = await createUseCase(fixture).execute({
      todoId: TODO_ID,
      authorId: TODO_COMMENT_FIXTURE_VIEWER_ID,
      parentId: null,
      items: chainOf("알림 실패"),
    });

    // Then
    expect(result.comments).toHaveLength(1);
    expect(fixture.logger.messages).toEqual([
      expect.objectContaining({ event: TodoCommentLogEvent.WRITE_NOTIFICATION_FAILED }),
    ]);
    expect(JSON.stringify(fixture.logger.messages)).not.toContain("private notification failure");
  });

  it("같은 멱등 키로 다시 보내면 원래 글과 좋아요를 돌려주고 수·알림을 다시 바꾸지 않는다", async () => {
    // Given
    const useCase = createUseCase(fixture);
    const command = {
      todoId: TODO_ID,
      authorId: TODO_COMMENT_FIXTURE_VIEWER_ID,
      parentId: null,
      items: chainOf("한 번만"),
    };
    const first = await useCase.execute(command);

    // When
    const replay = await useCase.execute(command);

    // Then
    expect(replay.comments.map((comment) => comment.id)).toEqual(
      first.comments.map((comment) => comment.id),
    );
    expect(fixture.engagementCounter.commentCounts.get(TODO_ID)).toBe(1);
    expect(fixture.notification.written).toHaveLength(1);
  });

  it("같은 멱등 키를 다른 내용에 쓰면 SYS_0002로 거부하고 원래 글을 둔다", async () => {
    // Given
    const useCase = createUseCase(fixture);
    const [item] = chainOf("원래 내용");
    if (item == null) {
      throw new Error("chain fixture missing");
    }
    await useCase.execute({
      todoId: TODO_ID,
      authorId: TODO_COMMENT_FIXTURE_VIEWER_ID,
      parentId: null,
      items: [item],
    });

    // When
    const conflicting = useCase.execute({
      todoId: TODO_ID,
      authorId: TODO_COMMENT_FIXTURE_VIEWER_ID,
      parentId: null,
      items: [{ ...item, content: "다른 내용" }],
    });

    // Then
    await expect(conflicting).rejects.toMatchObject({ errorCode: ErrorCode.SYS_0002 });
    expect(fixture.repository.list().map((comment) => comment.content)).toEqual(["원래 내용"]);
  });

  it("다른 요청과 멱등 키 경합에서 지면 새 UoW에서 먼저 저장한 글을 돌려주고 수·알림을 두 번 바꾸지 않는다", async () => {
    // Given
    const command = {
      todoId: TODO_ID,
      authorId: TODO_COMMENT_FIXTURE_VIEWER_ID,
      parentId: null,
      items: chainOf("경합"),
    };
    await createUseCase(fixture).execute(command);
    const racing = new RacingTodoCommentRepository(fixture.repository);

    // When
    const result = await new WriteTodoCommentChainUseCase({
      ...fixture,
      repository: racing,
    }).execute(command);

    // Then
    expect(result.comments.map((comment) => comment.content)).toEqual(["경합"]);
    expect(fixture.unitOfWork.runCount).toBe(3);
    expect(fixture.engagementCounter.commentCounts.get(TODO_ID)).toBe(1);
    expect(fixture.notification.written).toHaveLength(1);
  });

  it("경합 뒤 할 일을 볼 수 없게 되면 먼저 저장한 글이 있어도 TODO_0801로 거부한다", async () => {
    // Given
    const command = {
      todoId: TODO_ID,
      authorId: TODO_COMMENT_FIXTURE_VIEWER_ID,
      parentId: null,
      items: chainOf("경합"),
    };
    await createUseCase(fixture).execute(command);
    const racing = new RacingTodoCommentRepository(fixture.repository, () =>
      fixture.reader.revokeAccess(TODO_ID, TODO_COMMENT_FIXTURE_VIEWER_ID),
    );

    // When
    const writing = new WriteTodoCommentChainUseCase({ ...fixture, repository: racing }).execute(
      command,
    );

    // Then
    await expect(writing).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
  });
});

const TODO_COMMENT_FIXTURE_NOW_PLUS_MINUTE = Temporal.Instant.from("2026-08-26T00:01:00Z");

/** 처음 조회에서는 먼저 저장한 요청을 못 본 것처럼 굴고, 새 글을 넣을 때 유니크 경합을 낸다 */
class RacingTodoCommentRepository extends InMemoryTodoCommentRepository {
  readonly #inner: InMemoryTodoCommentRepository;
  readonly #onRace: () => void;
  #hasRaced = false;

  constructor(inner: InMemoryTodoCommentRepository, onRace: () => void = () => undefined) {
    super();
    this.#inner = inner;
    this.#onRace = onRace;
  }

  override listByAuthorIdAndClientRequestIds(
    ...args: Parameters<InMemoryTodoCommentRepository["listByAuthorIdAndClientRequestIds"]>
  ) {
    return this.#hasRaced
      ? this.#inner.listByAuthorIdAndClientRequestIds(...args)
      : Promise.resolve([]);
  }

  override async insertMany(): Promise<void> {
    this.#hasRaced = true;
    this.#onRace();
    throw new TodoCommentIdempotencyRace();
  }
}
