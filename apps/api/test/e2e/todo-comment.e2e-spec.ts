import { randomUUID } from "node:crypto";

import {
  createTodoResponseSchema,
  todoCommentChainResponseSchema,
  todoCommentOverviewResponseSchema,
  todoCommentRepliesResponseSchema,
  todoCommentThreadsResponseSchema,
  todoConversationResponseSchema,
  z,
  type TodoComment,
  type TodoCommentOverviewResponse,
  type TodoConversationResponse,
} from "@aido/api";
import request from "supertest";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

function tamperCursorPayload(
  cursor: string,
  update: (payload: Record<string, unknown>) => void,
): string {
  const [encodedPayload, signature] = cursor.split(".");
  if (encodedPayload === undefined || signature === undefined) {
    throw new Error("테스트 cursor 형식이 올바르지 않습니다.");
  }

  const decoded = z
    .record(z.string(), z.unknown())
    .safeParse(JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")));
  if (!decoded.success) {
    throw new Error("테스트 cursor payload가 객체가 아닙니다.");
  }

  update(decoded.data);
  const payload = Buffer.from(JSON.stringify(decoded.data), "utf8").toString("base64url");
  return `${payload}.${signature}`;
}

describe("할 일 댓글 E2E", () => {
  let ctx: E2eTestContext;

  beforeAll(async () => {
    ctx = await createE2eApp();
  }, 60_000);

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  beforeEach(async () => {
    await ctx.reset();
  });

  async function createTodo(
    accessToken: string,
    visibility: "PRIVATE" | "PUBLIC" = "PRIVATE",
  ): Promise<number> {
    const categoryId = await ctx.helpers.getDefaultCategoryId(accessToken);
    const response = await request(ctx.app.getHttpServer())
      .post("/v1/todos")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        title: "댓글 테스트",
        categoryId,
        startDate: "2026-08-14",
        visibility,
      })
      .expect(201);

    return createTodoResponseSchema.parse(response.body.data).todo.id;
  }

  async function writeChain(
    accessToken: string,
    todoId: number,
    contents: string[],
    parentId: string | null = null,
  ): Promise<TodoComment[]> {
    const response = await request(ctx.app.getHttpServer())
      .post(`/v1/todos/${todoId}/comments`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        parentId,
        items: contents.map((content) => ({ clientRequestId: randomUUID(), content })),
      })
      .expect(201);

    return todoCommentChainResponseSchema.parse(response.body.data).comments;
  }

  async function writeComment(
    accessToken: string,
    todoId: number,
    content: string,
    parentId: string | null = null,
  ): Promise<string> {
    const first = (await writeChain(accessToken, todoId, [content], parentId))[0];
    if (first === undefined) {
      throw new Error("댓글 작성 응답이 비어 있습니다.");
    }

    return first.id;
  }

  async function getConversation(
    accessToken: string,
    todoId: number,
    query: Record<string, string | number> = {},
  ): Promise<TodoConversationResponse> {
    const response = await request(ctx.app.getHttpServer())
      .get(`/v1/todos/${todoId}/conversation`)
      .query(query)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    return todoConversationResponseSchema.parse(response.body.data);
  }

  async function getOverview(
    accessToken: string,
    todoId: number,
    query: Record<string, string | number> = {},
  ): Promise<TodoCommentOverviewResponse> {
    const response = await request(ctx.app.getHttpServer())
      .get(`/v1/todos/${todoId}/comments/overview`)
      .query(query)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    return todoCommentOverviewResponseSchema.parse(response.body.data);
  }

  it("1.14.0 이하 앱이 깊은 답글 대상으로 써도 같은 묶음의 2단계 대화로 읽고 focus 문맥과 좋아요를 제공한다", async () => {
    // Given
    const user = await ctx.helpers.createVerifiedUser("todo-comment@example.com", "Test1234!", {
      name: "댓글 작성자",
    });
    const todoId = await createTodo(user.accessToken);
    const depth0 = await writeComment(user.accessToken, todoId, "댓글");
    const depth1 = await writeComment(user.accessToken, todoId, "답글", depth0);
    const depth2 = await writeComment(user.accessToken, todoId, "답글의 답글", depth1);
    const depth3 = await writeComment(user.accessToken, todoId, "그 답글의 답글", depth2);

    // When
    const conversation = await getConversation(user.accessToken, todoId, {
      sort: "LATEST",
      size: 20,
    });

    // Then
    const lane = {
      visualDepth: 1,
      upperLaneDepths: [0],
      incomingBranch: { fromDepth: 0, toDepth: 1 },
    };
    expect(conversation.items.map((item) => item.comment.id)).toEqual([
      depth0,
      depth1,
      depth2,
      depth3,
    ]);
    expect(conversation.items).toMatchObject([
      {
        comment: {
          id: depth0,
          threadId: depth0,
          parentId: null,
          depth: 0,
          replyCount: 3,
          replyTo: null,
        },
        connection: {
          visualDepth: 0,
          upperLaneDepths: [],
          lowerLaneDepths: [0],
          incomingBranch: null,
        },
      },
      {
        comment: {
          id: depth1,
          threadId: depth0,
          parentId: depth0,
          depth: 1,
          replyCount: 0,
          replyTo: { commentId: depth0, authorName: "댓글 작성자" },
        },
        connection: { ...lane, lowerLaneDepths: [0] },
      },
      {
        comment: {
          id: depth2,
          threadId: depth0,
          parentId: depth0,
          depth: 1,
          replyCount: 0,
          replyTo: { commentId: depth1 },
        },
        connection: { ...lane, lowerLaneDepths: [0] },
      },
      {
        comment: {
          id: depth3,
          threadId: depth0,
          parentId: depth0,
          depth: 1,
          replyCount: 0,
          replyTo: { commentId: depth2 },
        },
        connection: { ...lane, lowerLaneDepths: [] },
      },
    ]);
    expect(conversation.items.every((item) => item.connection.visualDepth <= 1)).toBe(true);

    const focused = await getConversation(user.accessToken, todoId, {
      focusCommentId: depth2,
      size: 3,
    });

    expect(focused.items.map((item) => item.comment.id)).toEqual([depth1, depth2, depth3]);
    expect(focused.focus).toMatchObject({
      commentId: depth2,
      itemIndex: 1,
      omittedAncestorCount: 0,
    });
    expect(focused.focus?.precedingAncestors.map((ancestor) => ancestor.comment.id)).toEqual([
      depth0,
    ]);
    expect(focused.items[1]).toMatchObject({ isFocused: true });

    await request(ctx.app.getHttpServer())
      .put(`/v1/todos/${todoId}/comments/${depth3}/likes`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);

    const liked = await getConversation(user.accessToken, todoId);
    expect(liked.items.find((item) => item.comment.id === depth3)).toMatchObject({
      comment: { likeCount: 1, viewer: { isLiked: true } },
    });

    const details = await request(ctx.app.getHttpServer())
      .get(`/v1/todos/${todoId}/details`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);

    expect(details.body.data.metrics.commentCount).toBe(4);
  });

  it("focus 대화 cursor는 다른 root로 넘어가지 않고 page 경계 형제도 부모 lane으로 잇는다", async () => {
    const user = await ctx.helpers.createVerifiedUser("todo-comment@example.com", "Test1234!");
    const todoId = await createTodo(user.accessToken);
    const parentId = await writeComment(user.accessToken, todoId, "댓글");
    const replies: string[] = [];
    for (const content of ["첫 번째 답글", "두 번째 답글", "세 번째 답글"]) {
      replies.push(await writeComment(user.accessToken, todoId, content, parentId));
    }
    const unrelatedRoot = await writeComment(user.accessToken, todoId, "다른 최신 대화");

    const firstPage = await getConversation(user.accessToken, todoId, {
      sort: "LATEST",
      size: 2,
      focusCommentId: parentId,
    });

    expect(firstPage.items.map((item) => item.comment.id)).toEqual([parentId, replies[0]]);
    expect(firstPage.pagination).toMatchObject({
      hasPrevious: false,
      hasNext: true,
      size: 2,
    });
    expect(firstPage.items).toMatchObject([
      {
        connection: {
          visualDepth: 0,
          upperLaneDepths: [],
          lowerLaneDepths: [0],
          incomingBranch: null,
        },
      },
      {
        connection: {
          visualDepth: 1,
          upperLaneDepths: [0],
          lowerLaneDepths: [0],
          incomingBranch: { fromDepth: 0, toDepth: 1 },
        },
      },
    ]);
    expect(firstPage.pagination.nextCursor).not.toBeNull();
    expect(firstPage.focus).toMatchObject({ commentId: parentId, itemIndex: 0 });

    const secondPage = await getConversation(user.accessToken, todoId, {
      sort: "LATEST",
      size: 2,
      after: firstPage.pagination.nextCursor ?? "",
    });

    expect(secondPage.items.map((item) => item.comment.id)).toEqual([replies[1], replies[2]]);
    expect(secondPage.pagination).toMatchObject({
      hasPrevious: true,
      hasNext: false,
    });
    expect(secondPage.items).toMatchObject([
      {
        connection: {
          visualDepth: 1,
          upperLaneDepths: [0],
          lowerLaneDepths: [0],
          incomingBranch: { fromDepth: 0, toDepth: 1 },
        },
      },
      {
        connection: {
          visualDepth: 1,
          upperLaneDepths: [0],
          lowerLaneDepths: [],
          incomingBranch: { fromDepth: 0, toDepth: 1 },
        },
      },
    ]);
    expect(secondPage.pagination.previousCursor).not.toBeNull();
    expect(secondPage.items.some((item) => item.comment.id === unrelatedRoot)).toBe(false);

    const previousPage = await getConversation(user.accessToken, todoId, {
      sort: "LATEST",
      size: 2,
      before: secondPage.pagination.previousCursor ?? "",
    });

    expect(previousPage.items.map((item) => item.comment.id)).toEqual([parentId, replies[0]]);
    expect(previousPage.pagination.hasNext).toBe(true);
  });

  it("LATEST와 POPULAR는 root block만 재정렬하고 block 내부 형제 순서를 보존한다", async () => {
    const user = await ctx.helpers.createVerifiedUser("todo-comment@example.com", "Test1234!");
    const todoId = await createTodo(user.accessToken);
    const olderRoot = await writeComment(user.accessToken, todoId, "오래된 원문");
    const firstReply = await writeComment(user.accessToken, todoId, "첫 답글", olderRoot);
    const secondReply = await writeComment(user.accessToken, todoId, "둘째 답글", olderRoot);
    const newerRoot = await writeComment(user.accessToken, todoId, "새 원문");

    const latest = await getConversation(user.accessToken, todoId, {
      sort: "LATEST",
      size: 10,
    });
    expect(latest.items.map((item) => item.comment.id)).toEqual([
      newerRoot,
      olderRoot,
      firstReply,
      secondReply,
    ]);

    await request(ctx.app.getHttpServer())
      .put(`/v1/todos/${todoId}/comments/${olderRoot}/likes`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);

    const popular = await getConversation(user.accessToken, todoId, {
      sort: "POPULAR",
      size: 10,
    });
    expect(popular.items.map((item) => item.comment.id)).toEqual([
      olderRoot,
      firstReply,
      secondReply,
      newerRoot,
    ]);
  });

  it("overview는 묶음 단위 cursor와 owner 답글 preview, 남은 답글 수 요약을 제공한다", async () => {
    const owner = await ctx.helpers.createVerifiedUser("overview-owner@example.com", "Test1234!", {
      name: "할 일 주인",
    });
    const friend = await ctx.helpers.createVerifiedUser(
      "overview-friend@example.com",
      "Test1234!",
      { name: "친구" },
    );
    await ctx.helpers.createFriendship(owner, friend);
    const todoId = await createTodo(owner.accessToken, "PUBLIC");
    const rootId = await writeComment(friend.accessToken, todoId, "답글이 있는 원문");
    const earlyReplyId = await writeComment(friend.accessToken, todoId, "먼저 쓴 답글", rootId);
    await writeComment(friend.accessToken, todoId, "후속 답글", earlyReplyId);
    const ownerReplyId = await writeComment(owner.accessToken, todoId, "주인의 답글", rootId);
    const otherRootId = await writeComment(friend.accessToken, todoId, "다른 원문");

    await request(ctx.app.getHttpServer())
      .delete(`/v1/todos/${todoId}/comments/${earlyReplyId}`)
      .set("Authorization", `Bearer ${friend.accessToken}`)
      .expect(200);
    await request(ctx.app.getHttpServer())
      .put(`/v1/todos/${todoId}/comments/${rootId}/likes`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(200);

    const firstPage = await getOverview(owner.accessToken, todoId, {
      sort: "POPULAR",
      size: 1,
    });
    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.items[0]).toMatchObject({
      comment: {
        id: rootId,
        viewer: { isLiked: true },
      },
      previewReply: {
        id: ownerReplyId,
        author: { id: owner.userId, isTodoOwner: true },
      },
      replySummary: {
        totalCount: 2,
        hiddenCount: 1,
        hasMore: true,
        participantAuthors: [
          { id: owner.userId, isTodoOwner: true },
          { id: friend.userId, isTodoOwner: false },
        ],
      },
    });
    expect(firstPage.pagination).toMatchObject({
      hasPrevious: false,
      hasNext: true,
      size: 1,
    });
    const nextCursor = firstPage.pagination.nextCursor;
    if (nextCursor === null) {
      throw new Error("Overview first page must have a next cursor");
    }

    const secondPage = await getOverview(owner.accessToken, todoId, {
      sort: "POPULAR",
      size: 1,
      after: nextCursor,
    });
    expect(secondPage.items).toMatchObject([
      {
        comment: { id: otherRootId },
        previewReply: null,
        replySummary: {
          totalCount: 0,
          hiddenCount: 0,
          hasMore: false,
          participantAuthors: [],
        },
      },
    ]);
    expect(secondPage.pagination).toMatchObject({ hasPrevious: true, hasNext: false });
  });

  it("답글이 남은 삭제 댓글은 묘비로 남고, 삭제한 답글은 묶음에서 빠지며 마지막 답글이 지워지면 묘비도 사라진다", async () => {
    // Given
    const user = await ctx.helpers.createVerifiedUser("todo-comment@example.com", "Test1234!");
    const todoId = await createTodo(user.accessToken);
    const commentId = await writeComment(user.accessToken, todoId, "댓글");
    const replyId = await writeComment(user.accessToken, todoId, "답글", commentId);
    const nestedReplyId = await writeComment(user.accessToken, todoId, "답글의 답글", replyId);
    const deleteComment = (id: string) =>
      request(ctx.app.getHttpServer())
        .delete(`/v1/todos/${todoId}/comments/${id}`)
        .set("Authorization", `Bearer ${user.accessToken}`)
        .expect(200);

    // When
    await deleteComment(commentId);
    await deleteComment(replyId);
    const afterDeletes = await getConversation(user.accessToken, todoId);
    const deletedFocus = await getConversation(user.accessToken, todoId, {
      focusCommentId: replyId,
    });
    await deleteComment(nestedReplyId);
    const afterLastReplyDelete = await getConversation(user.accessToken, todoId);

    // Then
    expect(afterDeletes.items).toMatchObject([
      {
        comment: {
          id: commentId,
          isDeleted: true,
          content: null,
          author: null,
          replyCount: 1,
          viewer: { canEdit: false, canDelete: false, canReply: false },
        },
        connection: { visualDepth: 0, lowerLaneDepths: [0] },
      },
      {
        comment: { id: nestedReplyId, depth: 1, replyTo: { commentId: replyId } },
        connection: { visualDepth: 1, upperLaneDepths: [0], lowerLaneDepths: [] },
      },
    ]);
    expect(deletedFocus.focus).toMatchObject({ commentId: replyId, itemIndex: 1 });
    expect(deletedFocus.items.map((item) => item.comment.id)).toEqual([
      commentId,
      replyId,
      nestedReplyId,
    ]);
    expect(deletedFocus.items[1]).toMatchObject({
      comment: { isDeleted: true, content: null },
      isFocused: true,
    });
    expect(afterLastReplyDelete.items).toEqual([]);
    const details = await request(ctx.app.getHttpServer())
      .get(`/v1/todos/${todoId}/details`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);
    expect(details.body.data.metrics.commentCount).toBe(0);
  });

  it("통합 POST로 이어 쓴 글은 같은 묶음 끝에 차례로 붙고 각자 앞 글에 답하며 머리 답글 수가 개수만큼 오른다", async () => {
    // Given
    const user = await ctx.helpers.createVerifiedUser("todo-comment@example.com", "Test1234!");
    const todoId = await createTodo(user.accessToken);
    const parentId = await writeComment(user.accessToken, todoId, "댓글");

    // When
    const chain = await writeChain(user.accessToken, todoId, ["하나", "둘", "셋"], parentId);

    // Then
    const [first, second, third] = chain;
    expect(chain).toHaveLength(3);
    expect(first).toMatchObject({
      threadId: parentId,
      parentId,
      depth: 1,
      replyCount: 0,
      replyTo: { commentId: parentId },
    });
    expect(second).toMatchObject({
      threadId: parentId,
      parentId,
      depth: 1,
      replyTo: { commentId: first?.id },
    });
    expect(third).toMatchObject({
      threadId: parentId,
      parentId,
      depth: 1,
      replyTo: { commentId: second?.id },
    });
    const conversation = await getConversation(user.accessToken, todoId);
    expect(conversation.items.map((item) => item.comment.id)).toEqual([
      parentId,
      first?.id,
      second?.id,
      third?.id,
    ]);
    expect(conversation.items[0]).toMatchObject({ comment: { id: parentId, replyCount: 3 } });
    const details = await request(ctx.app.getHttpServer())
      .get(`/v1/todos/${todoId}/details`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);
    expect(details.body.data.metrics.commentCount).toBe(4);
  });

  it("작성자만 수정하고 할 일 주인은 남의 댓글도 지우며, 허용된 viewer의 좋아요 상태는 conversation에 반영한다", async () => {
    const owner = await ctx.helpers.createVerifiedUser("comment-owner@example.com", "Test1234!", {
      name: "할 일 주인",
    });
    const author = await ctx.helpers.createVerifiedUser("comment-author@example.com", "Test1234!", {
      name: "댓글 작성자",
    });
    const bystander = await ctx.helpers.createVerifiedUser(
      "comment-bystander@example.com",
      "Test1234!",
      { name: "다른 친구" },
    );
    await ctx.helpers.createFriendship(owner, author);
    await ctx.helpers.createFriendship(owner, bystander);
    const todoId = await createTodo(owner.accessToken, "PUBLIC");
    const commentId = await writeComment(author.accessToken, todoId, "수정 전");

    const ownerView = await getConversation(owner.accessToken, todoId);
    expect(ownerView.items[0]).toMatchObject({
      comment: {
        id: commentId,
        viewer: { canEdit: false, canDelete: true, canReply: true },
      },
    });
    const bystanderView = await getConversation(bystander.accessToken, todoId);
    expect(bystanderView.items[0]).toMatchObject({
      comment: { id: commentId, viewer: { canEdit: false, canDelete: false } },
    });

    const forbiddenEdit = await request(ctx.app.getHttpServer())
      .patch(`/v1/todos/${todoId}/comments/${commentId}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ content: "가로채기" })
      .expect(403);
    expect(forbiddenEdit.body.error.code).toBe("TODO_0832");

    const updated = await request(ctx.app.getHttpServer())
      .patch(`/v1/todos/${todoId}/comments/${commentId}`)
      .set("Authorization", `Bearer ${author.accessToken}`)
      .send({ content: "수정 후" })
      .expect(200);
    expect(updated.body.data.comment).toMatchObject({
      id: commentId,
      content: "수정 후",
      isEdited: true,
      viewer: { canEdit: true, canDelete: true },
    });

    const liked = await request(ctx.app.getHttpServer())
      .put(`/v1/todos/${todoId}/comments/${commentId}/likes`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(200);
    expect(liked.body.data).toMatchObject({ commentId, isLiked: true, likeCount: 1 });

    const likedView = await getConversation(owner.accessToken, todoId);
    expect(likedView.items[0]).toMatchObject({
      comment: {
        content: "수정 후",
        isEdited: true,
        likeCount: 1,
        viewer: { isLiked: true },
      },
    });

    const unliked = await request(ctx.app.getHttpServer())
      .delete(`/v1/todos/${todoId}/comments/${commentId}/likes`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(200);
    expect(unliked.body.data).toMatchObject({ commentId, isLiked: false, likeCount: 0 });

    const forbiddenDelete = await request(ctx.app.getHttpServer())
      .delete(`/v1/todos/${todoId}/comments/${commentId}`)
      .set("Authorization", `Bearer ${bystander.accessToken}`)
      .expect(403);
    expect(forbiddenDelete.body.error.code).toBe("TODO_0832");

    await request(ctx.app.getHttpServer())
      .delete(`/v1/todos/${todoId}/comments/${commentId}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(200);

    await expect(getConversation(author.accessToken, todoId)).resolves.toMatchObject({
      items: [],
    });
  });

  it("좋아요는 멱등이고 비친구와 삭제 묘비의 좋아요 변경은 일관된 오류로 거부한다", async () => {
    const owner = await ctx.helpers.createVerifiedUser("like-owner@example.com", "Test1234!", {
      name: "할 일 주인",
    });
    const author = await ctx.helpers.createVerifiedUser("like-author@example.com", "Test1234!", {
      name: "댓글 작성자",
    });
    const stranger = await ctx.helpers.createVerifiedUser("like-stranger@example.com", "Test1234!");
    await ctx.helpers.createFriendship(owner, author);
    const todoId = await createTodo(owner.accessToken, "PUBLIC");
    const rootId = await writeComment(author.accessToken, todoId, "답글이 남을 원문");
    await writeComment(author.accessToken, todoId, "원문을 보존하는 답글", rootId);

    for (const expectedLikeCount of [1, 1]) {
      const liked = await request(ctx.app.getHttpServer())
        .put(`/v1/todos/${todoId}/comments/${rootId}/likes`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .expect(200);
      expect(liked.body.data).toMatchObject({
        commentId: rootId,
        isLiked: true,
        likeCount: expectedLikeCount,
      });
    }

    const deniedLike = await request(ctx.app.getHttpServer())
      .put(`/v1/todos/${todoId}/comments/${rootId}/likes`)
      .set("Authorization", `Bearer ${stranger.accessToken}`)
      .expect(404);
    expect(deniedLike.body.error.code).toBe("TODO_0801");

    await request(ctx.app.getHttpServer())
      .delete(`/v1/todos/${todoId}/comments/${rootId}`)
      .set("Authorization", `Bearer ${author.accessToken}`)
      .expect(200);

    const likeDeletedComment = await request(ctx.app.getHttpServer())
      .put(`/v1/todos/${todoId}/comments/${rootId}/likes`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(409);
    expect(likeDeletedComment.body.error.code).toBe("TODO_0833");

    const unlikeDeletedComment = await request(ctx.app.getHttpServer())
      .delete(`/v1/todos/${todoId}/comments/${rootId}/likes`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(409);
    expect(unlikeDeletedComment.body.error.code).toBe("TODO_0833");

    const conversation = await getConversation(owner.accessToken, todoId);
    expect(conversation.items).toMatchObject([
      {
        comment: {
          id: rootId,
          isDeleted: true,
          likeCount: 0,
          viewer: { isLiked: false },
        },
      },
      { comment: { parentId: rootId, isDeleted: false } },
    ]);
  });

  it("공개 할 일도 친구만 대화 조회·작성할 수 있고 비공개·비친구 접근은 숨긴다", async () => {
    const owner = await ctx.helpers.createVerifiedUser("comment-owner@example.com", "Test1234!");
    const friend = await ctx.helpers.createVerifiedUser("comment-friend@example.com", "Test1234!");
    const stranger = await ctx.helpers.createVerifiedUser(
      "comment-stranger@example.com",
      "Test1234!",
    );
    await ctx.helpers.createFriendship(owner, friend);
    const publicTodoId = await createTodo(owner.accessToken, "PUBLIC");
    const privateTodoId = await createTodo(owner.accessToken, "PRIVATE");

    await request(ctx.app.getHttpServer())
      .get(`/v1/todos/${publicTodoId}/conversation`)
      .set("Authorization", `Bearer ${friend.accessToken}`)
      .expect(200);
    await request(ctx.app.getHttpServer())
      .get(`/v1/todos/${publicTodoId}/comments/overview`)
      .set("Authorization", `Bearer ${friend.accessToken}`)
      .expect(200);
    await writeComment(friend.accessToken, publicTodoId, "친구의 댓글");

    const deniedReads: [string, string][] = [
      [`/v1/todos/${publicTodoId}/conversation`, stranger.accessToken],
      [`/v1/todos/${publicTodoId}/comments/overview`, stranger.accessToken],
      [`/v1/todos/${privateTodoId}/conversation`, friend.accessToken],
      [`/v1/todos/${privateTodoId}/comments/overview`, friend.accessToken],
    ];
    for (const [path, token] of deniedReads) {
      const response = await request(ctx.app.getHttpServer())
        .get(path)
        .set("Authorization", `Bearer ${token}`)
        .expect(404);
      expect(response.body.error.code).toBe("TODO_0801");
    }

    const deniedWrite = await request(ctx.app.getHttpServer())
      .post(`/v1/todos/${publicTodoId}/comments`)
      .set("Authorization", `Bearer ${stranger.accessToken}`)
      .send({
        parentId: null,
        items: [{ clientRequestId: randomUUID(), content: "비친구 댓글" }],
      })
      .expect(404);
    expect(deniedWrite.body.error.code).toBe("TODO_0801");

    await request(ctx.app.getHttpServer())
      .get(`/v1/todos/${publicTodoId}/conversation`)
      .expect(401);
    await request(ctx.app.getHttpServer())
      .get(`/v1/todos/${publicTodoId}/comments/overview`)
      .expect(401);
  });

  it("cursor의 todo·thread·sort를 검증하고 모호한 위치 query를 거부한다", async () => {
    const user = await ctx.helpers.createVerifiedUser("todo-comment@example.com", "Test1234!");
    const todoId = await createTodo(user.accessToken);
    const otherTodoId = await createTodo(user.accessToken);
    const olderRootId = await writeComment(user.accessToken, todoId, "다음 원문");
    const rootId = await writeComment(user.accessToken, todoId, "원문");
    const firstReplyId = await writeComment(user.accessToken, todoId, "첫 답글", rootId);
    const secondReplyId = await writeComment(user.accessToken, todoId, "둘째 답글", rootId);
    const page = await getConversation(user.accessToken, todoId, { size: 2 });
    const cursor = page.pagination.nextCursor;
    expect(cursor).not.toBeNull();

    const crossTodo = await request(ctx.app.getHttpServer())
      .get(`/v1/todos/${otherTodoId}/conversation`)
      .query({ after: cursor })
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(400);
    expect(crossTodo.body.error.code).toBe("SYS_0002");

    const crossSort = await request(ctx.app.getHttpServer())
      .get(`/v1/todos/${todoId}/conversation`)
      .query({ sort: "POPULAR", after: cursor })
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(400);
    expect(crossSort.body.error.code).toBe("SYS_0002");

    const tamperedCursor = tamperCursorPayload(cursor ?? "", (payload) => {
      payload.threadId = payload.commentId;
    });
    const tampered = await request(ctx.app.getHttpServer())
      .get(`/v1/todos/${todoId}/conversation`)
      .query({ after: tamperedCursor })
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(400);
    expect(tampered.body.error.code).toBe("SYS_0002");

    const tamperedRankCursor = tamperCursorPayload(cursor ?? "", (payload) => {
      payload.position = { rootLikeCount: 400, rootReplyCount: 400 };
    });
    const tamperedRank = await request(ctx.app.getHttpServer())
      .get(`/v1/todos/${todoId}/conversation`)
      .query({ after: tamperedRankCursor })
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(400);
    expect(tamperedRank.body.error.code).toBe("SYS_0002");

    for (const query of [
      { focusCommentId: rootId, after: cursor },
      { before: cursor, after: cursor },
    ]) {
      const response = await request(ctx.app.getHttpServer())
        .get(`/v1/todos/${todoId}/conversation`)
        .query(query)
        .set("Authorization", `Bearer ${user.accessToken}`)
        .expect(400);
      expect(response.body.error.code).toBe("SYS_0002");
    }

    await request(ctx.app.getHttpServer())
      .delete(`/v1/todos/${todoId}/comments/${firstReplyId}`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);
    const continuedAfterDeletedBoundary = await getConversation(user.accessToken, todoId, {
      after: cursor ?? "",
      size: 10,
    });
    expect(continuedAfterDeletedBoundary.items.map((item) => item.comment.id)).toEqual([
      secondReplyId,
      olderRootId,
    ]);
  });

  it("같은 멱등 키로 다시 보내면 사슬이 두 번 생기지 않는다", async () => {
    const user = await ctx.helpers.createVerifiedUser("todo-comment@example.com", "Test1234!");
    const todoId = await createTodo(user.accessToken);
    const items = [
      { clientRequestId: randomUUID(), content: "하나" },
      { clientRequestId: randomUUID(), content: "둘" },
    ];

    const first = await request(ctx.app.getHttpServer())
      .post(`/v1/todos/${todoId}/comments`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ parentId: null, items })
      .expect(201);
    const retried = await request(ctx.app.getHttpServer())
      .post(`/v1/todos/${todoId}/comments`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ parentId: null, items })
      .expect(201);

    const firstComments = todoCommentChainResponseSchema.parse(first.body.data).comments;
    const retriedComments = todoCommentChainResponseSchema.parse(retried.body.data).comments;
    expect(retriedComments.map((comment) => comment.id)).toEqual(
      firstComments.map((comment) => comment.id),
    );
    const details = await request(ctx.app.getHttpServer())
      .get(`/v1/todos/${todoId}/details`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);
    expect(details.body.data.metrics.commentCount).toBe(2);
  });

  it("같은 멱등 명령을 동시에 보내도 하나의 사슬만 만들고 같은 결과를 replay한다", async () => {
    const user = await ctx.helpers.createVerifiedUser("todo-comment@example.com", "Test1234!");
    const todoId = await createTodo(user.accessToken);
    const items = [
      { clientRequestId: randomUUID(), content: "동시 하나" },
      { clientRequestId: randomUUID(), content: "동시 둘" },
    ];
    const post = () =>
      request(ctx.app.getHttpServer())
        .post(`/v1/todos/${todoId}/comments`)
        .set("Authorization", `Bearer ${user.accessToken}`)
        .send({ parentId: null, items })
        .expect(201);

    const [first, second] = await Promise.all([post(), post()]);
    const firstComments = todoCommentChainResponseSchema.parse(first.body.data).comments;
    const secondComments = todoCommentChainResponseSchema.parse(second.body.data).comments;
    expect(secondComments.map((comment) => comment.id)).toEqual(
      firstComments.map((comment) => comment.id),
    );
    const details = await request(ctx.app.getHttpServer())
      .get(`/v1/todos/${todoId}/details`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);
    expect(details.body.data.metrics.commentCount).toBe(2);
  });

  it("정확히 같은 답글 명령은 부모가 나중에 삭제돼도 원래 결과를 replay한다", async () => {
    const user = await ctx.helpers.createVerifiedUser("todo-comment@example.com", "Test1234!");
    const todoId = await createTodo(user.accessToken);
    const parentId = await writeComment(user.accessToken, todoId, "부모 댓글");
    const items = [{ clientRequestId: randomUUID(), content: "답글" }];
    const path = `/v1/todos/${todoId}/comments`;
    const first = await request(ctx.app.getHttpServer())
      .post(path)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ parentId, items })
      .expect(201);

    await request(ctx.app.getHttpServer())
      .delete(`/v1/todos/${todoId}/comments/${parentId}`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);

    const retried = await request(ctx.app.getHttpServer())
      .post(path)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ parentId, items })
      .expect(201);
    const firstComments = todoCommentChainResponseSchema.parse(first.body.data).comments;
    const retriedComments = todoCommentChainResponseSchema.parse(retried.body.data).comments;
    expect(retriedComments.map((comment) => comment.id)).toEqual(
      firstComments.map((comment) => comment.id),
    );
  });

  it("멱등 키는 최초 todo·parent·순서·content와 정확히 같은 명령에만 재사용한다", async () => {
    const user = await ctx.helpers.createVerifiedUser("todo-comment@example.com", "Test1234!");
    const todoId = await createTodo(user.accessToken);
    const otherTodoId = await createTodo(user.accessToken);
    const parentId = await writeComment(user.accessToken, todoId, "부모 댓글");
    const items = [
      { clientRequestId: randomUUID(), content: "원본 하나" },
      { clientRequestId: randomUUID(), content: "원본 둘" },
    ];

    await request(ctx.app.getHttpServer())
      .post(`/v1/todos/${todoId}/comments`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ parentId: null, items })
      .expect(201);

    const mismatchedCommands = [
      { todoId, parentId: null, items: [items[0], { ...items[1], content: "바뀐 내용" }] },
      { todoId, parentId: null, items: [...items].reverse() },
      { todoId, parentId, items },
      { todoId: otherTodoId, parentId: null, items },
    ];

    for (const command of mismatchedCommands) {
      const response = await request(ctx.app.getHttpServer())
        .post(`/v1/todos/${command.todoId}/comments`)
        .set("Authorization", `Bearer ${user.accessToken}`)
        .send({ parentId: command.parentId, items: command.items })
        .expect(400);
      expect(response.body.error.code).toBe("SYS_0002");
    }
  });

  it("한 요청 안의 중복 clientRequestId는 저장 전에 거부한다", async () => {
    const user = await ctx.helpers.createVerifiedUser("todo-comment@example.com", "Test1234!");
    const todoId = await createTodo(user.accessToken);
    const clientRequestId = randomUUID();

    const response = await request(ctx.app.getHttpServer())
      .post(`/v1/todos/${todoId}/comments`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({
        parentId: null,
        items: [
          { clientRequestId, content: "하나" },
          { clientRequestId, content: "둘" },
        ],
      })
      .expect(400);

    expect(response.body.error.code).toBe("SYS_0002");
  });

  it("v2는 댓글 묶음과 대표 답글, 묶음 답글 페이지와 anchor 위치를 2단계로 돌려준다", async () => {
    // Given
    const owner = await ctx.helpers.createVerifiedUser("v2-owner@example.com", "Test1234!", {
      name: "할 일 주인",
    });
    const friend = await ctx.helpers.createVerifiedUser("v2-friend@example.com", "Test1234!", {
      name: "친구",
    });
    await ctx.helpers.createFriendship(owner, friend);
    const todoId = await createTodo(owner.accessToken, "PUBLIC");
    const commentId = await writeComment(friend.accessToken, todoId, "댓글");
    const replyId = await writeComment(owner.accessToken, todoId, "주인 답글", commentId);
    const [first, second] = await writeChain(friend.accessToken, todoId, ["이어서", "또"], replyId);
    const otherCommentId = await writeComment(friend.accessToken, todoId, "다른 댓글");
    const get = (path: string, query: Record<string, string | number> = {}) =>
      request(ctx.app.getHttpServer())
        .get(path)
        .query(query)
        .set("Authorization", `Bearer ${friend.accessToken}`)
        .set("X-App-Version", "1.14.1");

    // When
    const threadsResponse = await get(`/v2/todos/${todoId}/comments`, { size: 1 }).expect(200);
    const anchoredResponse = await get(`/v2/todos/${todoId}/comments`, {
      size: 1,
      anchorCommentId: second?.id ?? "",
    }).expect(200);
    const repliesResponse = await get(`/v2/todos/${todoId}/comments/${commentId}/replies`, {
      size: 2,
    }).expect(200);
    const nextReplies = await get(`/v2/todos/${todoId}/comments/${commentId}/replies`, {
      size: 2,
      cursor:
        todoCommentRepliesResponseSchema.parse(repliesResponse.body.data).pagination.nextCursor ??
        "",
    }).expect(200);
    const replyAsThread = await get(`/v2/todos/${todoId}/comments/${replyId}/replies`).expect(404);

    // Then
    const threadsPage = todoCommentThreadsResponseSchema.parse(threadsResponse.body.data);
    expect(threadsPage.items.map((item) => item.comment.id)).toEqual([otherCommentId]);
    expect(threadsPage.anchor).toBeNull();
    expect(threadsPage.pagination.hasNext).toBe(true);
    const anchored = todoCommentThreadsResponseSchema.parse(anchoredResponse.body.data);
    expect(anchored.anchor).toEqual({ threadCommentId: commentId, replyId: second?.id });
    expect(anchored.items[0]).toMatchObject({
      comment: { id: commentId, threadCommentId: null, replyCount: 3 },
      previewReply: { id: replyId, author: { isTodoOwner: true } },
      replySummary: { totalCount: 3, hiddenCount: 2 },
    });
    const replyPage = todoCommentRepliesResponseSchema.parse(repliesResponse.body.data);
    expect(replyPage.items.map((item) => [item.id, item.threadCommentId, item.replyTo])).toEqual([
      [replyId, commentId, { commentId, authorName: "친구" }],
      [first?.id, commentId, { commentId: replyId, authorName: "할 일 주인" }],
    ]);
    expect(
      todoCommentRepliesResponseSchema.parse(nextReplies.body.data).items.map((item) => item.id),
    ).toEqual([second?.id]);
    expect(replyAsThread.body.error.code).toBe("TODO_0831");
  });

  it("v1 개요는 v2와 같은 묶음을 1.14.0 이하 앱 계약 모양으로 돌려준다", async () => {
    // Given
    const user = await ctx.helpers.createVerifiedUser("todo-comment@example.com", "Test1234!");
    const todoId = await createTodo(user.accessToken);
    const commentId = await writeComment(user.accessToken, todoId, "댓글");
    const replyId = await writeComment(user.accessToken, todoId, "답글", commentId);
    await writeComment(user.accessToken, todoId, "답글의 답글", replyId);

    // When
    const overview = await getOverview(user.accessToken, todoId);

    // Then
    expect(overview.items[0]).toMatchObject({
      comment: { id: commentId, depth: 0, replyCount: 2 },
      previewReply: { id: replyId, parentId: commentId, depth: 1 },
      replySummary: { totalCount: 2, hiddenCount: 1, hasMore: true },
    });
  });

  it("v2 목록은 답글이 남은 지운 댓글만 묘비로 남기고 지운 답글·빈 묘비·지운 anchor를 내보내지 않는다", async () => {
    // Given
    const user = await ctx.helpers.createVerifiedUser("v2-delete@example.com", "Test1234!");
    const todoId = await createTodo(user.accessToken);
    const commentId = await writeComment(user.accessToken, todoId, "댓글");
    const firstReplyId = await writeComment(user.accessToken, todoId, "첫 답글", commentId);
    const secondReplyId = await writeComment(user.accessToken, todoId, "둘째 답글", firstReplyId);
    const remove = (id: string) =>
      request(ctx.app.getHttpServer())
        .delete(`/v1/todos/${todoId}/comments/${id}`)
        .set("Authorization", `Bearer ${user.accessToken}`);
    const get = async (path: string, query: Record<string, string> = {}) =>
      (
        await request(ctx.app.getHttpServer())
          .get(path)
          .query(query)
          .set("Authorization", `Bearer ${user.accessToken}`)
          .expect(200)
      ).body.data;

    // When
    await remove(commentId).expect(200);
    await remove(commentId).expect(200);
    await remove(firstReplyId).expect(200);
    const tombstoned = todoCommentThreadsResponseSchema.parse(
      await get(`/v2/todos/${todoId}/comments`),
    );
    const remainingReplies = todoCommentRepliesResponseSchema.parse(
      await get(`/v2/todos/${todoId}/comments/${commentId}/replies`),
    );
    const deletedAnchor = todoCommentThreadsResponseSchema.parse(
      await get(`/v2/todos/${todoId}/comments`, { anchorCommentId: firstReplyId }),
    );
    const replyToDeleted = await request(ctx.app.getHttpServer())
      .post(`/v1/todos/${todoId}/comments`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ parentId: firstReplyId, items: [{ clientRequestId: randomUUID(), content: "답" }] })
      .expect(409);
    const editDeleted = await request(ctx.app.getHttpServer())
      .patch(`/v1/todos/${todoId}/comments/${firstReplyId}`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ content: "수정" })
      .expect(409);
    await remove(secondReplyId).expect(200);
    const emptied = todoCommentThreadsResponseSchema.parse(
      await get(`/v2/todos/${todoId}/comments`),
    );

    // Then
    expect(tombstoned.items).toMatchObject([
      {
        comment: { id: commentId, isDeleted: true, content: null, likeCount: 0, replyCount: 1 },
        previewReply: { id: secondReplyId, replyTo: { commentId: firstReplyId } },
        replySummary: { totalCount: 1, hiddenCount: 0 },
      },
    ]);
    expect(remainingReplies.items.map((item) => item.id)).toEqual([secondReplyId]);
    expect(deletedAnchor.anchor).toBeNull();
    expect(replyToDeleted.body.error.code).toBe("TODO_0833");
    expect(editDeleted.body.error.code).toBe("TODO_0833");
    expect(emptied.items).toEqual([]);
  });
});
