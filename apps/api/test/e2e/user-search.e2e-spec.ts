/**
 * 사용자 검색(이름 또는 태그) E2E 테스트
 *
 * @description
 * 인스타그램 스타일 유저 디스커버리 API(GET /follows/search)를 Testcontainers 실제
 * PostgreSQL에서 검증한다. 저장소의 원시 SQL(관련도 랭킹·관계 flag·keyset 페이지네이션)이
 * 실제 DB에서 올바르게 동작하는지 확인한다.
 *
 * 시나리오:
 * 1. 인증(미인증 401)
 * 2. 이름/태그 검색 + 본인 제외
 * 3. 동명이인 → userTag로 구분
 * 4. 관계 flag (requestPending / isFriend)
 * 5. 한글 이름 검색
 * 6. 잘못된 검색어(2자 미만) 400
 * 7. nextCursor 페이지네이션
 */

import request from "supertest";
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers";

describe("사용자 검색 E2E", () => {
	let ctx: E2eTestContext;
	const password = "Test1234!";

	beforeAll(async () => {
		ctx = await createE2eApp();
	}, 60000);

	afterAll(async () => {
		await destroyE2eApp(ctx);
	});

	beforeEach(async () => {
		await ctx.reset();
	});

	it("미인증 요청은 401을 반환한다", async () => {
		await request(ctx.app.getHttpServer())
			.get("/v1/follows/search")
			.query({ q: "김철수" })
			.expect(401);
	});

	it("이름으로 검색하면 매칭 사용자를 반환하고 본인은 제외한다", async () => {
		const me = await ctx.helpers.createVerifiedUser(
			"me-search@example.com",
			password,
			{ name: "검색하는나" },
		);
		await ctx.helpers.createVerifiedUser("target1@example.com", password, {
			name: "김철수",
		});

		const response = await request(ctx.app.getHttpServer())
			.get("/v1/follows/search")
			.query({ q: "김철수" })
			.set("Authorization", `Bearer ${me.accessToken}`)
			.expect(200);

		expect(response.body.success).toBe(true);
		const names = response.body.data.items.map(
			(u: { name: string | null }) => u.name,
		);
		expect(names).toContain("김철수");
		// 본인(검색하는나)은 결과에 없음
		expect(names).not.toContain("검색하는나");
		expect(response.body.data.nextCursor).toBeNull();
	});

	it("태그로 검색하면 해당 사용자를 반환한다", async () => {
		const me = await ctx.helpers.createVerifiedUser(
			"me-tag@example.com",
			password,
		);
		const target = await ctx.helpers.createVerifiedUser(
			"target-tag@example.com",
			password,
			{ name: "박영희" },
		);

		const response = await request(ctx.app.getHttpServer())
			.get("/v1/follows/search")
			.query({ q: target.userTag })
			.set("Authorization", `Bearer ${me.accessToken}`)
			.expect(200);

		const tags = response.body.data.items.map(
			(u: { userTag: string }) => u.userTag,
		);
		expect(tags).toContain(target.userTag);
	});

	it("동명이인은 모두 반환되고 userTag로 구분된다", async () => {
		const me = await ctx.helpers.createVerifiedUser(
			"me-dup@example.com",
			password,
		);
		const a = await ctx.helpers.createVerifiedUser(
			"dup-a@example.com",
			password,
			{
				name: "홍길동",
			},
		);
		const b = await ctx.helpers.createVerifiedUser(
			"dup-b@example.com",
			password,
			{
				name: "홍길동",
			},
		);

		const response = await request(ctx.app.getHttpServer())
			.get("/v1/follows/search")
			.query({ q: "홍길동" })
			.set("Authorization", `Bearer ${me.accessToken}`)
			.expect(200);

		const dupItems = response.body.data.items.filter(
			(u: { name: string | null }) => u.name === "홍길동",
		);
		expect(dupItems.length).toBe(2);
		const tags = dupItems.map((u: { userTag: string }) => u.userTag);
		expect(new Set(tags).size).toBe(2);
		expect(tags).toContain(a.userTag);
		expect(tags).toContain(b.userTag);
	});

	it("보낸 친구 요청은 requestPending=true로 표시된다", async () => {
		const me = await ctx.helpers.createVerifiedUser(
			"me-pending@example.com",
			password,
		);
		const target = await ctx.helpers.createVerifiedUser(
			"target-pending@example.com",
			password,
			{ name: "요청대상자" },
		);

		await request(ctx.app.getHttpServer())
			.post(`/v1/follows/${target.userTag}`)
			.set("Authorization", `Bearer ${me.accessToken}`)
			.expect(201);

		const response = await request(ctx.app.getHttpServer())
			.get("/v1/follows/search")
			.query({ q: "요청대상자" })
			.set("Authorization", `Bearer ${me.accessToken}`)
			.expect(200);

		const found = response.body.data.items.find(
			(u: { userTag: string }) => u.userTag === target.userTag,
		);
		expect(found).toBeDefined();
		expect(found.requestPending).toBe(true);
		expect(found.isFriend).toBe(false);
	});

	it("맞팔 친구는 isFriend=true로 표시된다", async () => {
		const me = await ctx.helpers.createVerifiedUser(
			"me-friend@example.com",
			password,
		);
		const friend = await ctx.helpers.createVerifiedUser(
			"friend-search@example.com",
			password,
			{ name: "내친구야" },
		);

		await ctx.helpers.createFriendship(me, friend);

		const response = await request(ctx.app.getHttpServer())
			.get("/v1/follows/search")
			.query({ q: "내친구야" })
			.set("Authorization", `Bearer ${me.accessToken}`)
			.expect(200);

		const found = response.body.data.items.find(
			(u: { userTag: string }) => u.userTag === friend.userTag,
		);
		expect(found).toBeDefined();
		expect(found.isFriend).toBe(true);
		expect(found.isFollowing).toBe(true);
		expect(found.isFollower).toBe(true);
	});

	it("검색어가 2자 미만이면 400을 반환한다", async () => {
		const me = await ctx.helpers.createVerifiedUser(
			"me-short@example.com",
			password,
		);

		await request(ctx.app.getHttpServer())
			.get("/v1/follows/search")
			.query({ q: "a" })
			.set("Authorization", `Bearer ${me.accessToken}`)
			.expect(400);
	});

	it("nextCursor로 다음 페이지를 이어서 조회한다 (중복 없음)", async () => {
		const me = await ctx.helpers.createVerifiedUser(
			"me-page@example.com",
			password,
		);
		// 동일 접두어 이름 3명
		await ctx.helpers.createVerifiedUser("page-1@example.com", password, {
			name: "페이지유저",
		});
		await ctx.helpers.createVerifiedUser("page-2@example.com", password, {
			name: "페이지유저",
		});
		await ctx.helpers.createVerifiedUser("page-3@example.com", password, {
			name: "페이지유저",
		});

		const first = await request(ctx.app.getHttpServer())
			.get("/v1/follows/search")
			.query({ q: "페이지유저", limit: "2" })
			.set("Authorization", `Bearer ${me.accessToken}`)
			.expect(200);

		expect(first.body.data.items.length).toBe(2);
		expect(first.body.data.hasMore).toBe(true);
		expect(first.body.data.nextCursor).not.toBeNull();

		const second = await request(ctx.app.getHttpServer())
			.get("/v1/follows/search")
			.query({
				q: "페이지유저",
				limit: "2",
				cursor: first.body.data.nextCursor,
			})
			.set("Authorization", `Bearer ${me.accessToken}`)
			.expect(200);

		const firstIds = first.body.data.items.map((u: { id: string }) => u.id);
		const secondIds = second.body.data.items.map((u: { id: string }) => u.id);
		// 페이지 간 중복 없음
		for (const id of secondIds) {
			expect(firstIds).not.toContain(id);
		}
	});
});
