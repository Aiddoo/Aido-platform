import { ErrorCode } from "@aido/api/errors";

import { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import {
  createTodoCommentLikeFixture,
  createTodoCommentReadModelFixture,
  TODO_COMMENT_FIXTURE_FRIEND_ID,
  TODO_COMMENT_FIXTURE_TODO_ID,
  TODO_COMMENT_FIXTURE_VIEWER_ID,
} from "#test/fixtures/engagement/todo-comment.fixture";
import {
  createTodoCommentsFixture,
  type TodoCommentsFixture,
} from "#test/fixtures/engagement/todo-comments.fixture";

import { TodoCommentId } from "../../domain/todo-comment-id.vo.js";
import type { TodoCommentThreadItemReadModel } from "../read-models/todo-comment.read-model.js";
import { ListTodoCommentThreadsUseCase } from "./list-todo-comment-threads.use-case.js";

const TODO_ID = TODO_COMMENT_FIXTURE_TODO_ID;
const HEAD_ID = "cm1rootcomment000000000001";
const REPLY_ID = "cm1replycomment00000000001";

function createThreadItem(): TodoCommentThreadItemReadModel {
  return {
    comment: {
      ...createTodoCommentReadModelFixture({ id: HEAD_ID, likeCount: 3, replyCount: 2 }),
      threadPosition: { rootLikeCount: 3, rootReplyCount: 2 },
    },
    previewReply: createTodoCommentReadModelFixture({
      id: REPLY_ID,
      authorId: TODO_COMMENT_FIXTURE_FRIEND_ID,
      threadCommentId: HEAD_ID,
      replyToCommentId: HEAD_ID,
    }),
    totalCount: 2,
    participantAuthors: [
      {
        id: TODO_COMMENT_FIXTURE_FRIEND_ID,
        name: "친구",
        userTag: null,
        profileImage: null,
        isTodoOwner: false,
      },
    ],
  };
}

const query = {
  todoId: TODO_ID,
  viewerId: TODO_COMMENT_FIXTURE_VIEWER_ID,
  sort: "POPULAR",
  size: 10,
} as const;

describe("ListTodoCommentThreadsUseCase — 댓글 묶음 목록", () => {
  let fixture: TodoCommentsFixture;

  beforeEach(() => {
    fixture = createTodoCommentsFixture();
    fixture.reader.threadsWindow = {
      items: [createThreadItem()],
      hasPrevious: true,
      hasNext: true,
    };
  });

  it("묶음 머리·대표 답글·참여자의 좋아요와 차단을 한 번에 모으고 양방향 cursor를 만든다", async () => {
    // Given
    await fixture.likeRepository.save(createTodoCommentLikeFixture({ commentId: REPLY_ID }));
    fixture.blockReader.block(TODO_COMMENT_FIXTURE_VIEWER_ID, TODO_COMMENT_FIXTURE_FRIEND_ID);

    // When
    const page = await new ListTodoCommentThreadsUseCase(fixture).execute({
      ...query,
      page: { kind: "FIRST" },
    });

    // Then
    expect(page.viewer).toEqual({
      viewerId: TODO_COMMENT_FIXTURE_VIEWER_ID,
      likedCommentIds: new Set([REPLY_ID]),
      blockedAuthorIds: new Set([TODO_COMMENT_FIXTURE_FRIEND_ID]),
    });
    expect(page.pagination).toEqual({
      previousCursor: `threads:POPULAR:BEFORE:${HEAD_ID}`,
      nextCursor: `threads:POPULAR:AFTER:${HEAD_ID}`,
      hasPrevious: true,
      hasNext: true,
      size: 10,
    });
    expect(page.anchor).toBeNull();
  });

  it("답글로 anchor를 주면 그 묶음 머리가 든 페이지를 읽고 위치를 돌려준다", async () => {
    // Given
    const head = await fixture.addComment({ id: HEAD_ID });
    const reply = await fixture.addComment({
      id: REPLY_ID,
      parentId: head.id.value,
      replyToCommentId: head.id.value,
    });

    // When
    const page = await new ListTodoCommentThreadsUseCase(fixture).execute({
      ...query,
      page: { kind: "ANCHOR", commentId: reply.id.value },
    });

    // Then
    expect(fixture.reader.threadParams).toEqual([
      {
        todoId: TodoId.reconstitute(TODO_ID),
        sort: "POPULAR",
        size: 10,
        mode: "ANCHOR",
        anchorCommentId: TodoCommentId.reconstitute(HEAD_ID),
      },
    ]);
    expect(page.anchor).toEqual({ threadCommentId: HEAD_ID, replyId: REPLY_ID });
  });

  it("anchor 묶음이 목록에서 보이지 않으면 첫 페이지와 빈 anchor로 연다", async () => {
    // Given
    await fixture.addComment({ id: HEAD_ID });
    fixture.reader.isAnchorMissing = true;

    // When
    const page = await new ListTodoCommentThreadsUseCase(fixture).execute({
      ...query,
      page: { kind: "ANCHOR", commentId: HEAD_ID },
    });

    // Then
    expect(fixture.reader.threadParams.map((params) => params.mode)).toEqual(["ANCHOR", "INITIAL"]);
    expect(page.anchor).toBeNull();
  });

  it("지운 글이나 없는 글로 anchor를 주면 오류 없이 첫 페이지를 연다", async () => {
    // Given
    await fixture.addComment({
      id: HEAD_ID,
      content: null,
      deletedAt: Temporal.Instant.from("2026-08-26T00:10:00Z"),
    });
    const useCase = new ListTodoCommentThreadsUseCase(fixture);

    // When
    const deleted = await useCase.execute({
      ...query,
      page: { kind: "ANCHOR", commentId: HEAD_ID },
    });
    const missing = await useCase.execute({
      ...query,
      page: { kind: "ANCHOR", commentId: "cm1missingcomment00000001" },
    });

    // Then
    expect([deleted.anchor, missing.anchor]).toEqual([null, null]);
    expect(fixture.reader.threadParams.map((params) => params.mode)).toEqual([
      "INITIAL",
      "INITIAL",
    ]);
  });

  it("cursor에 담긴 방향과 인기 점수를 reader 경계에 그대로 넘기고, 방향이 없으면 다음 페이지로 읽는다", async () => {
    // Given
    const position = { rootLikeCount: 7, rootReplyCount: 1 };
    fixture.cursorCodec.register("before", {
      sort: "POPULAR",
      todoId: TODO_ID,
      rootId: HEAD_ID,
      position,
      direction: "BEFORE",
    });
    fixture.cursorCodec.register("legacy", {
      sort: "POPULAR",
      todoId: TODO_ID,
      rootId: HEAD_ID,
      position,
    });
    const useCase = new ListTodoCommentThreadsUseCase(fixture);

    // When
    await useCase.execute({ ...query, page: { kind: "CURSOR", cursor: "before" } });
    await useCase.execute({ ...query, page: { kind: "CURSOR", cursor: "legacy" } });

    // Then
    const base = {
      todoId: TodoId.reconstitute(TODO_ID),
      sort: "POPULAR",
      size: 10,
      anchorCommentId: TodoCommentId.reconstitute(HEAD_ID),
      anchorPosition: position,
    };
    expect(fixture.reader.threadParams).toEqual([
      { ...base, mode: "BEFORE" },
      { ...base, mode: "AFTER" },
    ]);
  });

  it("다른 할 일의 cursor는 SYS_0002, 볼 수 없는 할 일은 TODO_0801로 reader를 부르기 전에 거부한다", async () => {
    // Given
    fixture.cursorCodec.register("foreign", {
      sort: "POPULAR",
      todoId: TODO_ID + 1,
      rootId: HEAD_ID,
      position: { rootLikeCount: 0, rootReplyCount: 0 },
    });
    const useCase = new ListTodoCommentThreadsUseCase(fixture);

    // When
    const foreign = useCase.execute({ ...query, page: { kind: "CURSOR", cursor: "foreign" } });
    const inaccessible = useCase.execute({
      ...query,
      viewerId: "cm1stranger00000000000001",
      page: { kind: "FIRST" },
    });

    // Then
    await expect(foreign).rejects.toMatchObject({ errorCode: ErrorCode.SYS_0002 });
    await expect(inaccessible).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
    expect(fixture.reader.threadParams).toEqual([]);
  });
});
