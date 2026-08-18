import { randomUUID } from "node:crypto";

import request from "supertest";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers";

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

	async function createTodo(accessToken: string): Promise<number> {
		const categoryId = await ctx.helpers.getDefaultCategoryId(accessToken);
		const response = await request(ctx.app.getHttpServer())
			.post("/v1/todos")
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ title: "댓글 테스트", categoryId, startDate: "2026-08-14" })
			.expect(201);

		return response.body.data.todo.id as number;
	}

	async function writeChain(
		accessToken: string,
		todoId: number,
		contents: string[],
		parentId?: string,
	): Promise<string[]> {
		const path =
			parentId === undefined
				? `/v1/todos/${todoId}/comments`
				: `/v1/todos/${todoId}/comments/${parentId}/replies`;
		const response = await request(ctx.app.getHttpServer())
			.post(path)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ items: contents.map((content) => ({ clientRequestId: randomUUID(), content })) })
			.expect(201);

		return (response.body.data.comments as { id: string }[]).map((comment) => comment.id);
	}

	async function writeComment(
		accessToken: string,
		todoId: number,
		content: string,
		parentId?: string,
	): Promise<string> {
		const [id] = await writeChain(accessToken, todoId, [content], parentId);

		return id ?? "";
	}

	it("깊이 제한 없이 답글을 이어 달고 어느 깊이에서도 좋아요·미리보기·조상 사슬을 제공한다", async () => {
		const user = await ctx.helpers.createVerifiedUser("todo-comment@example.com", "Test1234!");
		const todoId = await createTodo(user.accessToken);

		// 댓글 → 답글 → 답글의 답글 → 그 답글의 답글 (깊이 3)
		const depth0 = await writeComment(user.accessToken, todoId, "댓글");
		const depth1 = await writeComment(user.accessToken, todoId, "답글", depth0);
		const depth2 = await writeComment(user.accessToken, todoId, "답글의 답글", depth1);
		const depth3 = await writeComment(user.accessToken, todoId, "그 답글의 답글", depth2);

		const listResponse = await request(ctx.app.getHttpServer())
			.get(`/v1/todos/${todoId}/comments`)
			.query({ sort: "LATEST", size: 20 })
			.set("Authorization", `Bearer ${user.accessToken}`)
			.expect(200);

		// 최상위 목록은 자기 자식만 담는다 — 손자부터는 다음 화면 몫이다.
		expect(listResponse.body.data.items).toHaveLength(1);
		expect(listResponse.body.data.items[0]).toMatchObject({
			id: depth0,
			parentId: null,
			rootId: null,
			depth: 0,
			replyCount: 1,
			hasReplies: true,
			hasMoreReplies: false,
		});
		expect(listResponse.body.data.items[0].replyPreview).toHaveLength(1);
		expect(listResponse.body.data.items[0].replyPreview[0]).toMatchObject({
			id: depth1,
			parentId: depth0,
			rootId: depth0,
			depth: 1,
			replyCount: 1,
			hasReplies: true,
			hasMoreReplies: true,
			replyTo: { commentId: depth0 },
		});

		// 깊이 2의 스레드 머리말 — 조상은 뿌리 → 부모 순서로 쌓인다.
		const threadResponse = await request(ctx.app.getHttpServer())
			.get(`/v1/todos/${todoId}/comments/${depth2}/thread`)
			.set("Authorization", `Bearer ${user.accessToken}`)
			.expect(200);

		expect(
			threadResponse.body.data.ancestors.map((ancestor: { id: string }) => ancestor.id),
		).toEqual([depth0, depth1]);
		expect(threadResponse.body.data.comment).toMatchObject({ id: depth2, depth: 2 });

		const depth2Replies = await request(ctx.app.getHttpServer())
			.get(`/v1/todos/${todoId}/comments/${depth2}/replies`)
			.query({ sort: "LATEST", size: 20 })
			.set("Authorization", `Bearer ${user.accessToken}`)
			.expect(200);

		expect(depth2Replies.body.data.items).toHaveLength(1);
		expect(depth2Replies.body.data.items[0]).toMatchObject({ id: depth3, depth: 3 });

		// 좋아요는 깊이와 무관하다.
		await request(ctx.app.getHttpServer())
			.put(`/v1/todos/${todoId}/comments/${depth3}/likes`)
			.set("Authorization", `Bearer ${user.accessToken}`)
			.expect(200);

		const likedReplies = await request(ctx.app.getHttpServer())
			.get(`/v1/todos/${todoId}/comments/${depth2}/replies`)
			.query({ sort: "LATEST", size: 20 })
			.set("Authorization", `Bearer ${user.accessToken}`)
			.expect(200);

		expect(likedReplies.body.data.items[0]).toMatchObject({
			likeCount: 1,
			viewer: { isLiked: true },
		});

		const details = await request(ctx.app.getHttpServer())
			.get(`/v1/todos/${todoId}/details`)
			.set("Authorization", `Bearer ${user.accessToken}`)
			.expect(200);

		expect(details.body.data.metrics.commentCount).toBe(4);
	});

	it("답글 목록은 정렬과 cursor를 최상위 목록과 같은 계약으로 제공한다", async () => {
		const user = await ctx.helpers.createVerifiedUser("todo-comment@example.com", "Test1234!");
		const todoId = await createTodo(user.accessToken);
		const parentId = await writeComment(user.accessToken, todoId, "댓글");

		// 첫 페이지 캐시를 먼저 채워 답글 작성이 무효화하는지도 함께 본다.
		await request(ctx.app.getHttpServer())
			.get(`/v1/todos/${todoId}/comments`)
			.query({ sort: "LATEST", size: 20 })
			.set("Authorization", `Bearer ${user.accessToken}`)
			.expect(200);

		for (const content of ["첫 번째 답글", "두 번째 답글", "세 번째 답글"]) {
			await writeComment(user.accessToken, todoId, content, parentId);
		}

		const listResponse = await request(ctx.app.getHttpServer())
			.get(`/v1/todos/${todoId}/comments`)
			.query({ sort: "LATEST", size: 20 })
			.set("Authorization", `Bearer ${user.accessToken}`)
			.expect(200);

		expect(listResponse.body.data.items[0]).toMatchObject({
			replyCount: 3,
			hasMoreReplies: true,
		});
		expect(listResponse.body.data.items[0].replyPreview).toHaveLength(2);
		expect(
			listResponse.body.data.items[0].replyPreview.map(
				(reply: { content: string }) => reply.content,
			),
		).toContain("세 번째 답글");

		const firstPage = await request(ctx.app.getHttpServer())
			.get(`/v1/todos/${todoId}/comments/${parentId}/replies`)
			.query({ sort: "LATEST", size: 2 })
			.set("Authorization", `Bearer ${user.accessToken}`)
			.expect(200);

		expect(firstPage.body.data.items).toHaveLength(2);
		expect(firstPage.body.data.pagination.hasNext).toBe(true);

		const secondPage = await request(ctx.app.getHttpServer())
			.get(`/v1/todos/${todoId}/comments/${parentId}/replies`)
			.query({ sort: "LATEST", size: 2, cursor: firstPage.body.data.pagination.nextCursor })
			.set("Authorization", `Bearer ${user.accessToken}`)
			.expect(200);

		expect(secondPage.body.data.items).toHaveLength(1);
		expect(secondPage.body.data.pagination.hasNext).toBe(false);
	});

	it("답글이 남은 댓글은 묘비로 자리를 지키고, 마지막 답글이 사라지면 묘비도 함께 걷힌다", async () => {
		const user = await ctx.helpers.createVerifiedUser("todo-comment@example.com", "Test1234!");
		const todoId = await createTodo(user.accessToken);
		const depth0 = await writeComment(user.accessToken, todoId, "댓글");
		const depth1 = await writeComment(user.accessToken, todoId, "답글", depth0);
		const depth2 = await writeComment(user.accessToken, todoId, "답글의 답글", depth1);

		async function listTopLevel() {
			const response = await request(ctx.app.getHttpServer())
				.get(`/v1/todos/${todoId}/comments`)
				.query({ sort: "LATEST", size: 20 })
				.set("Authorization", `Bearer ${user.accessToken}`)
				.expect(200);

			return response.body.data.items;
		}

		// 답글이 남았으므로 중간 댓글은 묘비로 남는다.
		await request(ctx.app.getHttpServer())
			.delete(`/v1/todos/${todoId}/comments/${depth1}`)
			.set("Authorization", `Bearer ${user.accessToken}`)
			.expect(200);

		const afterMiddleDelete = await listTopLevel();

		expect(afterMiddleDelete[0]).toMatchObject({ id: depth0, replyCount: 1 });
		expect(afterMiddleDelete[0].replyPreview[0]).toMatchObject({
			id: depth1,
			isDeleted: true,
			content: null,
			author: null,
			replyCount: 1,
		});

		// 마지막 답글이 사라지면 빈 묘비도 함께 걷히고 그만큼 위로 정산된다.
		await request(ctx.app.getHttpServer())
			.delete(`/v1/todos/${todoId}/comments/${depth2}`)
			.set("Authorization", `Bearer ${user.accessToken}`)
			.expect(200);

		const afterLeafDelete = await listTopLevel();

		expect(afterLeafDelete[0]).toMatchObject({
			id: depth0,
			isDeleted: false,
			replyCount: 0,
			hasReplies: false,
			hasMoreReplies: false,
		});
		expect(afterLeafDelete[0].replyPreview).toEqual([]);

		const details = await request(ctx.app.getHttpServer())
			.get(`/v1/todos/${todoId}/details`)
			.set("Authorization", `Bearer ${user.accessToken}`)
			.expect(200);

		expect(details.body.data.metrics.commentCount).toBe(1);
	});

	it("한 번에 이어 쓴 글은 사슬이 되고, 부모의 답글 수는 하나만 오른다", async () => {
		const user = await ctx.helpers.createVerifiedUser("todo-comment@example.com", "Test1234!");
		const todoId = await createTodo(user.accessToken);
		const parentId = await writeComment(user.accessToken, todoId, "댓글");

		const chain = await writeChain(user.accessToken, todoId, ["하나", "둘", "셋"], parentId);

		expect(chain).toHaveLength(3);

		// 각 글이 바로 앞 글의 답글로 이어진다.
		const [first, second, third] = chain;
		const depths = await Promise.all(
			chain.map(async (commentId) => {
				const response = await request(ctx.app.getHttpServer())
					.get(`/v1/todos/${todoId}/comments/${commentId}/thread`)
					.set("Authorization", `Bearer ${user.accessToken}`)
					.expect(200);

				return response.body.data.comment as { depth: number; parentId: string | null };
			}),
		);

		expect(depths[0]).toMatchObject({ depth: 1, parentId });
		expect(depths[1]).toMatchObject({ depth: 2, parentId: first });
		expect(depths[2]).toMatchObject({ depth: 3, parentId: second });
		expect(third).toBeDefined();

		// 직계 자식은 사슬의 첫 글 하나뿐이다.
		const listResponse = await request(ctx.app.getHttpServer())
			.get(`/v1/todos/${todoId}/comments`)
			.query({ sort: "LATEST", size: 20 })
			.set("Authorization", `Bearer ${user.accessToken}`)
			.expect(200);

		expect(listResponse.body.data.items[0]).toMatchObject({ id: parentId, replyCount: 1 });

		// 할 일의 댓글 수는 사슬 길이만큼 오른다.
		const details = await request(ctx.app.getHttpServer())
			.get(`/v1/todos/${todoId}/details`)
			.set("Authorization", `Bearer ${user.accessToken}`)
			.expect(200);

		expect(details.body.data.metrics.commentCount).toBe(4);
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
			.send({ items })
			.expect(201);
		const retried = await request(ctx.app.getHttpServer())
			.post(`/v1/todos/${todoId}/comments`)
			.set("Authorization", `Bearer ${user.accessToken}`)
			.send({ items })
			.expect(201);

		expect(retried.body.data.comments.map((c: { id: string }) => c.id)).toEqual(
			first.body.data.comments.map((c: { id: string }) => c.id),
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
				.send({ items })
				.expect(201);

		const [first, second] = await Promise.all([post(), post()]);

		expect(second.body.data.comments.map((comment: { id: string }) => comment.id)).toEqual(
			first.body.data.comments.map((comment: { id: string }) => comment.id),
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
		const path = `/v1/todos/${todoId}/comments/${parentId}/replies`;
		const first = await request(ctx.app.getHttpServer())
			.post(path)
			.set("Authorization", `Bearer ${user.accessToken}`)
			.send({ items })
			.expect(201);

		await request(ctx.app.getHttpServer())
			.delete(`/v1/todos/${todoId}/comments/${parentId}`)
			.set("Authorization", `Bearer ${user.accessToken}`)
			.expect(200);

		const retried = await request(ctx.app.getHttpServer())
			.post(path)
			.set("Authorization", `Bearer ${user.accessToken}`)
			.send({ items })
			.expect(201);

		expect(retried.body.data.comments.map((comment: { id: string }) => comment.id)).toEqual(
			first.body.data.comments.map((comment: { id: string }) => comment.id),
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
			.send({ items })
			.expect(201);

		const mismatchedCommands = [
			{
				path: `/v1/todos/${todoId}/comments`,
				items: [items[0], { ...items[1], content: "바뀐 내용" }],
			},
			{ path: `/v1/todos/${todoId}/comments`, items: [...items].reverse() },
			{ path: `/v1/todos/${todoId}/comments/${parentId}/replies`, items },
			{ path: `/v1/todos/${otherTodoId}/comments`, items },
		];

		for (const command of mismatchedCommands) {
			const response = await request(ctx.app.getHttpServer())
				.post(command.path)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ items: command.items })
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
				items: [
					{ clientRequestId, content: "하나" },
					{ clientRequestId, content: "둘" },
				],
			})
			.expect(400);

		expect(response.body.error.code).toBe("SYS_0002");
	});
});
