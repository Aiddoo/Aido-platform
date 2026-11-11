import { ErrorCode } from "@aido/api/errors";

import { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import {
  createTodoCommentReadModelFixture,
  TODO_COMMENT_FIXTURE_TODO_ID,
  TODO_COMMENT_FIXTURE_VIEWER_ID,
} from "#test/fixtures/engagement/todo-comment.fixture";
import {
  createTodoCommentsFixture,
  type TodoCommentsFixture,
} from "#test/fixtures/engagement/todo-comments.fixture";

import { TodoCommentId } from "../../domain/todo-comment-id.vo.js";
import type { TodoConversationReadModel } from "../read-models/todo-comment.read-model.js";
import { GetTodoConversationUseCase } from "./get-todo-conversation.use-case.js";

const TODO_ID = TODO_COMMENT_FIXTURE_TODO_ID;
const HEAD_ID = "cm1rootcomment000000000001";
const REPLY_ID = "cm1replycomment00000000001";
const POSITION = { rootLikeCount: 4, rootReplyCount: 1 };

function createItem(overrides: Partial<TodoConversationReadModel> = {}): TodoConversationReadModel {
  return {
    ...createTodoCommentReadModelFixture({ id: HEAD_ID, ...overrides }),
    conversationPosition: POSITION,
  };
}

const reply = createItem({ id: REPLY_ID, threadCommentId: HEAD_ID, replyToCommentId: HEAD_ID });
const query = {
  todoId: TODO_ID,
  viewerId: TODO_COMMENT_FIXTURE_VIEWER_ID,
  sort: "POPULAR",
  size: 2,
} as const;

describe("GetTodoConversationUseCase — 1.14.0 이하 앱의 대화", () => {
  let fixture: TodoCommentsFixture;

  beforeEach(async () => {
    fixture = createTodoCommentsFixture();
    await fixture.addComment({ id: HEAD_ID, replyCount: 1 });
    await fixture.addComment({ id: REPLY_ID, parentId: HEAD_ID, replyToCommentId: HEAD_ID });
  });

  it("처음 페이지는 할 일 범위 cursor를 만들고 창 뒤 행을 연결선 판단용으로 넘긴다", async () => {
    // Given
    fixture.reader.conversationWindow = {
      items: [createItem()],
      anchorIndex: null,
      previousItem: null,
      nextItem: reply,
      hasPrevious: false,
      hasNext: true,
    };

    // When
    const page = await new GetTodoConversationUseCase(fixture).execute(query);

    // Then
    expect(page.nextItem?.id).toBe(REPLY_ID);
    expect(page.focus).toBeNull();
    expect(page.pagination).toMatchObject({
      previousCursor: null,
      nextCursor: `conversation:POPULAR:TODO:${HEAD_ID}`,
    });
  });

  it("cursor에 담긴 범위·묶음·인기 점수를 reader 경계에 그대로 넘긴다", async () => {
    // Given
    fixture.cursorCodec.register("after", {
      sort: "POPULAR",
      todoId: TODO_ID,
      commentId: REPLY_ID,
      threadId: HEAD_ID,
      scope: "THREAD",
      position: POSITION,
    });
    fixture.reader.conversationWindow = {
      items: [createItem({ id: "cm1nextcomment00000000001" })],
      anchorIndex: null,
      previousItem: null,
      nextItem: null,
      hasPrevious: true,
      hasNext: false,
    };

    // When
    const page = await new GetTodoConversationUseCase(fixture).execute({
      ...query,
      after: "after",
    });

    // Then
    expect(fixture.reader.conversationParams).toEqual([
      {
        todoId: TodoId.reconstitute(TODO_ID),
        sort: "POPULAR",
        size: 2,
        mode: "AFTER",
        scope: "THREAD",
        anchorCommentId: TodoCommentId.reconstitute(REPLY_ID),
        anchorThreadId: TodoCommentId.reconstitute(HEAD_ID),
        anchorPosition: POSITION,
      },
    ]);
    expect(page.pagination.previousCursor).toBe(
      "conversation:POPULAR:THREAD:cm1nextcomment00000000001",
    );
  });

  it("다른 할 일의 cursor는 reader를 부르기 전에 SYS_0002로 거부한다", async () => {
    // Given
    fixture.cursorCodec.register("foreign", {
      sort: "POPULAR",
      todoId: TODO_ID + 1,
      commentId: HEAD_ID,
      threadId: HEAD_ID,
      scope: "TODO",
      position: POSITION,
    });

    // When
    const reading = new GetTodoConversationUseCase(fixture).execute({
      ...query,
      before: "foreign",
    });

    // Then
    await expect(reading).rejects.toMatchObject({ errorCode: ErrorCode.SYS_0002 });
    expect(fixture.reader.conversationParams).toEqual([]);
  });

  it("focus 답글 앞 페이지 밖의 묶음 머리를 따로 한 번 싣는다", async () => {
    // Given
    fixture.reader.conversationWindow = {
      items: [reply],
      anchorIndex: 0,
      previousItem: null,
      nextItem: null,
      hasPrevious: true,
      hasNext: false,
    };

    // When
    const page = await new GetTodoConversationUseCase(fixture).execute({
      ...query,
      focusCommentId: REPLY_ID,
    });

    // Then
    expect(page.focus).toMatchObject({ commentId: REPLY_ID, itemIndex: 0 });
    expect(page.focus?.precedingThreadComments.map((comment) => comment.id)).toEqual([HEAD_ID]);
    expect(fixture.reader.conversationParams.at(0)).toMatchObject({
      mode: "FOCUS",
      scope: "THREAD",
    });
  });

  it("없거나 대화에서 사라진 focus는 다른 묶음 대신 빈 대화로 연다", async () => {
    // Given
    fixture.reader.conversationWindow = {
      items: [createItem()],
      anchorIndex: 0,
      previousItem: null,
      nextItem: null,
      hasPrevious: false,
      hasNext: false,
    };

    // When
    const page = await new GetTodoConversationUseCase(fixture).execute({
      ...query,
      focusCommentId: REPLY_ID,
    });

    // Then
    expect({ items: page.items, focus: page.focus, pagination: page.pagination }).toEqual({
      items: [],
      focus: null,
      pagination: {
        previousCursor: null,
        nextCursor: null,
        hasPrevious: false,
        hasNext: false,
        size: 2,
      },
    });
  });
});
