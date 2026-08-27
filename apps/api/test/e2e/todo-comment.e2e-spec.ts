import { randomUUID } from "node:crypto";

import {
	createTodoResponseSchema,
	todoCommentChainResponseSchema,
	todoCommentOverviewResponseSchema,
	todoConversationResponseSchema,
	z,
	type TodoComment,
	type TodoCommentOverviewResponse,
	type TodoConversationResponse,
} from "@aido/validators";
import request from "supertest";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers";

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
	}, 60000);

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

	it("깊이 제한 없이 답글을 한 화면의 DFS 대화로 읽고 focus 조상 문맥과 좋아요를 제공한다", async () => {
		const user = await ctx.helpers.createVerifiedUser("todo-comment@example.com", "Test1234!", {
			name: "댓글 작성자",
		});
		const todoId = await createTodo(user.accessToken);

		const depth0 = await writeComment(user.accessToken, todoId, "댓글");
		const depth1 = await writeComment(user.accessToken, todoId, "답글", depth0);
		const depth2 = await writeComment(user.accessToken, todoId, "답글의 답글", depth1);
		const depth3 = await writeComment(user.accessToken, todoId, "그 답글의 답글", depth2);

		const conversation = await getConversation(user.accessToken, todoId, {
			sort: "LATEST",
			size: 20,
		});

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
					replyCount: 1,
					replyTo: null,
				},
				connection: {
					visualDepth: 0,
					upperLaneDepths: [],
					lowerLaneDepths: [0],
					incomingBranch: null,
				},
				isFocused: false,
			},
			{
				comment: {
					id: depth1,
					threadId: depth0,
					parentId: depth0,
					depth: 1,
					replyCount: 1,
					replyTo: { commentId: depth0 },
				},
				connection: {
					visualDepth: 1,
					upperLaneDepths: [0],
					lowerLaneDepths: [1],
					incomingBranch: { fromDepth: 0, toDepth: 1 },
				},
				isFocused: false,
			},
			{
				comment: {
					id: depth2,
					threadId: depth0,
					parentId: depth1,
					depth: 2,
					replyCount: 1,
					replyTo: { commentId: depth1 },
				},
				connection: {
					visualDepth: 2,
					upperLaneDepths: [1],
					lowerLaneDepths: [2],
					incomingBranch: { fromDepth: 1, toDepth: 2 },
				},
				isFocused: false,
			},
			{
				comment: {
					id: depth3,
					threadId: depth0,
					parentId: depth2,
					depth: 3,
					replyCount: 0,
					replyTo: { commentId: depth2 },
				},
				connection: {
					visualDepth: 3,
					upperLaneDepths: [2],
					lowerLaneDepths: [],
					incomingBranch: { fromDepth: 2, toDepth: 3 },
				},
				isFocused: false,
			},
		]);

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

	it("overview는 root 단위 cursor와 owner 답글 preview, 삭제 조상을 포함한 요약을 제공한다", async () => {
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
				totalCount: 3,
				hiddenCount: 2,
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

	it("답글이 남은 삭제 댓글은 묘비로 보존하고 마지막 후손 삭제 뒤 함께 걷는다", async () => {
		const user = await ctx.helpers.createVerifiedUser("todo-comment@example.com", "Test1234!");
		const todoId = await createTodo(user.accessToken);
		const depth0 = await writeComment(user.accessToken, todoId, "댓글");
		const depth1 = await writeComment(user.accessToken, todoId, "답글", depth0);
		const depth2 = await writeComment(user.accessToken, todoId, "답글의 답글", depth1);

		await request(ctx.app.getHttpServer())
			.delete(`/v1/todos/${todoId}/comments/${depth1}`)
			.set("Authorization", `Bearer ${user.accessToken}`)
			.expect(200);

		const afterMiddleDelete = await getConversation(user.accessToken, todoId);
		expect(afterMiddleDelete.items.map((item) => item.comment.id)).toEqual([
			depth0,
			depth1,
			depth2,
		]);
		expect(afterMiddleDelete.items[1]).toMatchObject({
			comment: {
				id: depth1,
				isDeleted: true,
				content: null,
				author: null,
				replyCount: 1,
				viewer: { canEdit: false, canDelete: false, canReply: false },
			},
			connection: {
				visualDepth: 1,
				upperLaneDepths: [0],
				lowerLaneDepths: [1],
				incomingBranch: { fromDepth: 0, toDepth: 1 },
			},
		});
		expect(afterMiddleDelete.items[2]?.connection).toEqual({
			visualDepth: 2,
			upperLaneDepths: [1],
			lowerLaneDepths: [],
			incomingBranch: { fromDepth: 1, toDepth: 2 },
		});
		const unrelatedRoot = await writeComment(user.accessToken, todoId, "다른 대화 원문");

		const deletedFocus = await getConversation(user.accessToken, todoId, {
			focusCommentId: depth1,
		});
		expect(deletedFocus.focus).toBeNull();
		expect(deletedFocus.items.map((item) => item.comment.id)).toEqual([depth0, depth1, depth2]);
		expect(deletedFocus.items.some((item) => item.comment.id === unrelatedRoot)).toBe(false);

		await request(ctx.app.getHttpServer())
			.delete(`/v1/todos/${todoId}/comments/${depth2}`)
			.set("Authorization", `Bearer ${user.accessToken}`)
			.expect(200);

		const afterLeafDelete = await getConversation(user.accessToken, todoId);
		expect(afterLeafDelete.items).toMatchObject([
			{ comment: { id: unrelatedRoot, isDeleted: false, replyCount: 0 } },
			{ comment: { id: depth0, isDeleted: false, replyCount: 0 } },
		]);

		const missingFocus = await getConversation(user.accessToken, todoId, {
			focusCommentId: depth2,
		});
		expect(missingFocus.focus).toBeNull();
		expect(missingFocus.items).toEqual([]);

		const details = await request(ctx.app.getHttpServer())
			.get(`/v1/todos/${todoId}/details`)
			.set("Authorization", `Bearer ${user.accessToken}`)
			.expect(200);
		expect(details.body.data.metrics.commentCount).toBe(2);
	});

	it("통합 POST로 이어 쓴 글은 사슬이 되고 원래 부모의 직계 답글 수만 하나 오른다", async () => {
		const user = await ctx.helpers.createVerifiedUser("todo-comment@example.com", "Test1234!");
		const todoId = await createTodo(user.accessToken);
		const parentId = await writeComment(user.accessToken, todoId, "댓글");
		const chain = await writeChain(user.accessToken, todoId, ["하나", "둘", "셋"], parentId);
		const [first, second, third] = chain;

		expect(chain).toHaveLength(3);
		expect(first).toMatchObject({ threadId: parentId, parentId, depth: 1, replyCount: 1 });
		expect(second).toMatchObject({
			threadId: parentId,
			parentId: first?.id,
			depth: 2,
			replyCount: 1,
		});
		expect(third).toMatchObject({
			threadId: parentId,
			parentId: second?.id,
			depth: 3,
			replyCount: 0,
		});

		const conversation = await getConversation(user.accessToken, todoId);
		expect(conversation.items.map((item) => item.comment.id)).toEqual([
			parentId,
			first?.id,
			second?.id,
			third?.id,
		]);
		expect(conversation.items[0]).toMatchObject({
			comment: { id: parentId, replyCount: 1 },
		});

		const details = await request(ctx.app.getHttpServer())
			.get(`/v1/todos/${todoId}/details`)
			.set("Authorization", `Bearer ${user.accessToken}`)
			.expect(200);
		expect(details.body.data.metrics.commentCount).toBe(4);
	});

	it("작성자만 수정·삭제하고, 허용된 viewer의 좋아요 상태는 conversation에 반영한다", async () => {
		const owner = await ctx.helpers.createVerifiedUser("comment-owner@example.com", "Test1234!", {
			name: "할 일 주인",
		});
		const author = await ctx.helpers.createVerifiedUser("comment-author@example.com", "Test1234!", {
			name: "댓글 작성자",
		});
		await ctx.helpers.createFriendship(owner, author);
		const todoId = await createTodo(owner.accessToken, "PUBLIC");
		const commentId = await writeComment(author.accessToken, todoId, "수정 전");

		const ownerView = await getConversation(owner.accessToken, todoId);
		expect(ownerView.items[0]).toMatchObject({
			comment: {
				id: commentId,
				viewer: { canEdit: false, canDelete: false, canReply: true },
			},
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
			.set("Authorization", `Bearer ${owner.accessToken}`)
			.expect(403);
		expect(forbiddenDelete.body.error.code).toBe("TODO_0832");

		await request(ctx.app.getHttpServer())
			.delete(`/v1/todos/${todoId}/comments/${commentId}`)
			.set("Authorization", `Bearer ${author.accessToken}`)
			.expect(200);

		await expect(getConversation(owner.accessToken, todoId)).resolves.toMatchObject({ items: [] });
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
});
