/**
 * Memo E2E 테스트
 *
 * @description
 * 메모(Memo) 기능 전체 플로우 테스트.
 * Testcontainers를 사용하여 독립적인 PostgreSQL 환경에서 테스트합니다.
 *
 * ### 테스트 범위 (MemoController 10개 라우트 전체)
 * - GET    /memos/resource-limit
 * - POST   /memos
 * - GET    /memos
 * - GET    /memos/:id
 * - PATCH  /memos/:id
 * - PATCH  /memos/:id/pin
 * - PATCH  /memos/:id/reorder
 * - DELETE /memos/:id
 * - POST   /memos/:id/convert-to-todo
 * - POST   /memos/:id/convert-to-todos
 */

import request from "supertest";
import {
	createE2eApp,
	destroyE2eApp,
	type E2eTestContext,
	type VerifiedUser,
} from "./helpers";

describe("메모 E2E", () => {
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

	const password = "Test1234!";

	/** 메모를 생성하고 생성된 메모 객체를 반환하는 헬퍼 */
	async function createMemo(
		user: VerifiedUser,
		content: string,
	): Promise<{ id: number; sortOrder: number; isPinned: boolean }> {
		const response = await request(ctx.app.getHttpServer())
			.post("/v1/memos")
			.set("Authorization", `Bearer ${user.accessToken}`)
			.send({ content })
			.expect(201);
		return response.body.data.memo;
	}

	describe("GET /memos/resource-limit - 리소스 제한 조회", () => {
		it("초기 상태에서 현재 개수 0과 최대 한도 20을 반환한다", async () => {
			// Given - 메모가 없는 사용자
			const user = await ctx.helpers.createVerifiedUser(
				"memo-limit@test.com",
				password,
			);

			// When - 리소스 제한 조회
			const response = await request(ctx.app.getHttpServer())
				.get("/v1/memos/resource-limit")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.expect(200);

			// Then - currentCount=0, maxPerUser=20
			expect(response.body.success).toBe(true);
			expect(response.body.data.currentCount).toBe(0);
			expect(response.body.data.maxPerUser).toBe(20);
		});

		it("메모 생성 후 currentCount가 증가한다", async () => {
			// Given - 메모 2개를 가진 사용자
			const user = await ctx.helpers.createVerifiedUser(
				"memo-limit2@test.com",
				password,
			);
			await createMemo(user, "메모 1");
			await createMemo(user, "메모 2");

			// When - 리소스 제한 조회
			const response = await request(ctx.app.getHttpServer())
				.get("/v1/memos/resource-limit")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.expect(200);

			// Then - currentCount=2
			expect(response.body.data.currentCount).toBe(2);
		});

		it("인증 없이 요청 시 401 에러 반환", async () => {
			// Given - 인증 토큰 없음

			// When / Then - 401 Unauthorized
			await request(ctx.app.getHttpServer())
				.get("/v1/memos/resource-limit")
				.expect(401);
		});
	});

	describe("POST /memos - 메모 생성", () => {
		it("메모를 생성하고 생성 결과를 반환한다", async () => {
			// Given - 인증된 사용자
			const user = await ctx.helpers.createVerifiedUser(
				"memo-create@test.com",
				password,
			);

			// When - 메모 생성
			const response = await request(ctx.app.getHttpServer())
				.post("/v1/memos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ content: "장보기: 우유, 계란" })
				.expect(201);

			// Then - 생성된 메모 검증
			expect(response.body.success).toBe(true);
			expect(response.body.data.message).toBeDefined();
			expect(response.body.data.memo.id).toBeDefined();
			expect(response.body.data.memo.content).toBe("장보기: 우유, 계란");
			expect(response.body.data.memo.isPinned).toBe(false);
			expect(response.body.data.memo.userId).toBe(user.userId);
		});

		it("빈 내용으로 생성 시 400 에러 반환 (SYS_0002)", async () => {
			// Given - 인증된 사용자
			const user = await ctx.helpers.createVerifiedUser(
				"memo-create-empty@test.com",
				password,
			);

			// When - 빈 내용으로 생성
			const response = await request(ctx.app.getHttpServer())
				.post("/v1/memos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ content: "" })
				.expect(400);

			// Then - 검증 실패
			expect(response.body.success).toBe(false);
		});

		it("5000자 초과 내용으로 생성 시 400 에러 반환", async () => {
			// Given - 인증된 사용자와 5001자 텍스트
			const user = await ctx.helpers.createVerifiedUser(
				"memo-create-long@test.com",
				password,
			);
			const longContent = "가".repeat(5001);

			// When - 긴 내용으로 생성
			const response = await request(ctx.app.getHttpServer())
				.post("/v1/memos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ content: longContent })
				.expect(400);

			// Then - 검증 실패
			expect(response.body.success).toBe(false);
		});

		it("최대 한도(20개) 도달 시 403 에러 반환 (MEMO_2003)", async () => {
			// Given - 이미 20개의 메모를 가진 사용자 (DB 직접 시딩)
			const user = await ctx.helpers.createVerifiedUser(
				"memo-create-limit@test.com",
				password,
			);
			const prisma = ctx.testDatabase.getPrisma();
			await prisma.memo.createMany({
				data: Array.from({ length: 20 }, (_, i) => ({
					userId: user.userId,
					content: `시딩 메모 ${i + 1}`,
					sortOrder: i,
				})),
			});

			// When - 21번째 메모 생성 시도
			const response = await request(ctx.app.getHttpServer())
				.post("/v1/memos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ content: "한도 초과 메모" })
				.expect(403);

			// Then - MEMO_2003 에러
			expect(response.body.success).toBe(false);
			expect(response.body.error.code).toBe("MEMO_2003");
		});

		it("인증 없이 요청 시 401 에러 반환", async () => {
			// Given - 인증 토큰 없음

			// When / Then - 401 Unauthorized
			await request(ctx.app.getHttpServer())
				.post("/v1/memos")
				.send({ content: "메모" })
				.expect(401);
		});
	});

	describe("GET /memos - 메모 목록 조회", () => {
		it("고정 메모가 먼저, 나머지는 sortOrder→id 내림차순으로 정렬된다", async () => {
			// Given - 메모 3개 생성 후 첫 메모를 고정
			const user = await ctx.helpers.createVerifiedUser(
				"memo-list-order@test.com",
				password,
			);
			const m1 = await createMemo(user, "첫 번째");
			const m2 = await createMemo(user, "두 번째");
			const m3 = await createMemo(user, "세 번째");

			// m1을 고정 (목록 최상단으로 이동해야 함)
			await request(ctx.app.getHttpServer())
				.patch(`/v1/memos/${m1.id}/pin`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ isPinned: true })
				.expect(200);

			// When - 목록 조회
			const response = await request(ctx.app.getHttpServer())
				.get("/v1/memos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.expect(200);

			// Then - 고정된 m1이 최상단, 나머지는 sortOrder desc (m3, m2)
			const items = response.body.data.items;
			expect(items).toHaveLength(3);
			expect(items[0].id).toBe(m1.id);
			expect(items[0].isPinned).toBe(true);
			expect(items[1].id).toBe(m3.id);
			expect(items[2].id).toBe(m2.id);
		});

		it("커서 기반 페이지네이션으로 나누어 조회한다", async () => {
			// Given - 메모 3개
			const user = await ctx.helpers.createVerifiedUser(
				"memo-list-cursor@test.com",
				password,
			);
			const m1 = await createMemo(user, "메모 1");
			const m2 = await createMemo(user, "메모 2");
			const m3 = await createMemo(user, "메모 3");

			// When - size=2로 첫 페이지 조회
			const page1 = await request(ctx.app.getHttpServer())
				.get("/v1/memos")
				.query({ size: 2 })
				.set("Authorization", `Bearer ${user.accessToken}`)
				.expect(200);

			// Then - 2개 반환, hasNext=true, nextCursor 존재
			expect(page1.body.data.items).toHaveLength(2);
			expect(page1.body.data.pagination.hasNext).toBe(true);
			expect(page1.body.data.pagination.nextCursor).not.toBeNull();

			// When - nextCursor로 다음 페이지 조회
			const page2 = await request(ctx.app.getHttpServer())
				.get("/v1/memos")
				.query({ size: 2, cursor: page1.body.data.pagination.nextCursor })
				.set("Authorization", `Bearer ${user.accessToken}`)
				.expect(200);

			// Then - 나머지 1개 반환, 중복 없이 전체 커버
			expect(page2.body.data.items).toHaveLength(1);
			expect(page2.body.data.pagination.hasNext).toBe(false);

			const allIds = [
				...page1.body.data.items.map((it: { id: number }) => it.id),
				...page2.body.data.items.map((it: { id: number }) => it.id),
			];
			expect(new Set(allIds).size).toBe(3);
			expect(new Set(allIds)).toEqual(new Set([m1.id, m2.id, m3.id]));
		});

		it("다른 사용자의 메모는 조회되지 않는다 (사용자 격리)", async () => {
			// Given - 두 사용자가 각자 메모 생성
			const userA = await ctx.helpers.createVerifiedUser(
				"memo-iso-a@test.com",
				password,
			);
			const userB = await ctx.helpers.createVerifiedUser(
				"memo-iso-b@test.com",
				password,
			);
			await createMemo(userA, "A의 메모");
			await createMemo(userB, "B의 메모");

			// When - userA가 목록 조회
			const response = await request(ctx.app.getHttpServer())
				.get("/v1/memos")
				.set("Authorization", `Bearer ${userA.accessToken}`)
				.expect(200);

			// Then - userA의 메모만 조회됨
			expect(response.body.data.items).toHaveLength(1);
			expect(response.body.data.items[0].content).toBe("A의 메모");
		});

		it("인증 없이 요청 시 401 에러 반환", async () => {
			// Given - 인증 토큰 없음

			// When / Then - 401 Unauthorized
			await request(ctx.app.getHttpServer()).get("/v1/memos").expect(401);
		});
	});

	describe("GET /memos/:id - 메모 상세 조회", () => {
		it("메모 ID로 단일 메모를 조회한다", async () => {
			// Given - 메모를 가진 사용자
			const user = await ctx.helpers.createVerifiedUser(
				"memo-detail@test.com",
				password,
			);
			const memo = await createMemo(user, "상세 조회 대상");

			// When - 상세 조회
			const response = await request(ctx.app.getHttpServer())
				.get(`/v1/memos/${memo.id}`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.expect(200);

			// Then - 메모 정보 반환
			expect(response.body.success).toBe(true);
			expect(response.body.data.memo.id).toBe(memo.id);
			expect(response.body.data.memo.content).toBe("상세 조회 대상");
		});

		it("존재하지 않는 메모 조회 시 404 에러 반환 (MEMO_2001)", async () => {
			// Given - 인증된 사용자
			const user = await ctx.helpers.createVerifiedUser(
				"memo-detail-404@test.com",
				password,
			);

			// When - 없는 메모 조회
			const response = await request(ctx.app.getHttpServer())
				.get("/v1/memos/999999")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.expect(404);

			// Then - MEMO_2001 에러
			expect(response.body.success).toBe(false);
			expect(response.body.error.code).toBe("MEMO_2001");
		});

		it("다른 사용자의 메모 조회 시 404 에러 반환 (사용자 격리)", async () => {
			// Given - userB의 메모
			const userA = await ctx.helpers.createVerifiedUser(
				"memo-detail-iso-a@test.com",
				password,
			);
			const userB = await ctx.helpers.createVerifiedUser(
				"memo-detail-iso-b@test.com",
				password,
			);
			const memoB = await createMemo(userB, "B의 비밀 메모");

			// When - userA가 userB의 메모 조회 시도
			const response = await request(ctx.app.getHttpServer())
				.get(`/v1/memos/${memoB.id}`)
				.set("Authorization", `Bearer ${userA.accessToken}`)
				.expect(404);

			// Then - MEMO_2001 (존재하지 않는 것처럼 처리)
			expect(response.body.error.code).toBe("MEMO_2001");
		});
	});

	describe("PATCH /memos/:id - 메모 수정", () => {
		it("메모 내용을 수정한다", async () => {
			// Given - 메모를 가진 사용자
			const user = await ctx.helpers.createVerifiedUser(
				"memo-update@test.com",
				password,
			);
			const memo = await createMemo(user, "수정 전");

			// When - 내용 수정
			const response = await request(ctx.app.getHttpServer())
				.patch(`/v1/memos/${memo.id}`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ content: "수정 후" })
				.expect(200);

			// Then - 수정된 내용 반환
			expect(response.body.success).toBe(true);
			expect(response.body.data.memo.content).toBe("수정 후");
		});

		it("존재하지 않는 메모 수정 시 404 에러 반환 (MEMO_2001)", async () => {
			// Given - 인증된 사용자
			const user = await ctx.helpers.createVerifiedUser(
				"memo-update-404@test.com",
				password,
			);

			// When - 없는 메모 수정
			const response = await request(ctx.app.getHttpServer())
				.patch("/v1/memos/999999")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ content: "수정" })
				.expect(404);

			// Then - MEMO_2001 에러
			expect(response.body.error.code).toBe("MEMO_2001");
		});

		it("인증 없이 요청 시 401 에러 반환", async () => {
			// Given - 인증 토큰 없음

			// When / Then - 401 Unauthorized
			await request(ctx.app.getHttpServer())
				.patch("/v1/memos/1")
				.send({ content: "수정" })
				.expect(401);
		});
	});

	describe("PATCH /memos/:id/pin - 메모 고정/해제", () => {
		it("메모를 고정한다", async () => {
			// Given - 메모를 가진 사용자
			const user = await ctx.helpers.createVerifiedUser(
				"memo-pin@test.com",
				password,
			);
			const memo = await createMemo(user, "고정 대상");

			// When - 고정
			const response = await request(ctx.app.getHttpServer())
				.patch(`/v1/memos/${memo.id}/pin`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ isPinned: true })
				.expect(200);

			// Then - isPinned=true
			expect(response.body.data.memo.isPinned).toBe(true);
		});

		it("고정된 메모를 해제한다", async () => {
			// Given - 고정된 메모
			const user = await ctx.helpers.createVerifiedUser(
				"memo-unpin@test.com",
				password,
			);
			const memo = await createMemo(user, "고정 해제 대상");
			await request(ctx.app.getHttpServer())
				.patch(`/v1/memos/${memo.id}/pin`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ isPinned: true })
				.expect(200);

			// When - 해제
			const response = await request(ctx.app.getHttpServer())
				.patch(`/v1/memos/${memo.id}/pin`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ isPinned: false })
				.expect(200);

			// Then - isPinned=false
			expect(response.body.data.memo.isPinned).toBe(false);
		});

		it("존재하지 않는 메모 고정 시 404 에러 반환 (MEMO_2001)", async () => {
			// Given - 인증된 사용자
			const user = await ctx.helpers.createVerifiedUser(
				"memo-pin-404@test.com",
				password,
			);

			// When - 없는 메모 고정
			const response = await request(ctx.app.getHttpServer())
				.patch("/v1/memos/999999/pin")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ isPinned: true })
				.expect(404);

			// Then - MEMO_2001 에러
			expect(response.body.error.code).toBe("MEMO_2001");
		});
	});

	describe("PATCH /memos/:id/reorder - 메모 순서 변경", () => {
		it("메모 순서를 변경한다", async () => {
			// Given - 메모 3개
			const user = await ctx.helpers.createVerifiedUser(
				"memo-reorder@test.com",
				password,
			);
			const m1 = await createMemo(user, "메모 1");
			await createMemo(user, "메모 2");
			const m3 = await createMemo(user, "메모 3");

			// When - m3을 m1 뒤로 이동
			const response = await request(ctx.app.getHttpServer())
				.patch(`/v1/memos/${m3.id}/reorder`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ targetMemoId: m1.id, position: "after" })
				.expect(200);

			// Then - 이동한 메모 반환
			expect(response.body.success).toBe(true);
			expect(response.body.data.memo.id).toBe(m3.id);
		});

		it("존재하지 않는 대상 메모로 순서 변경 시 404 에러 반환 (MEMO_2002)", async () => {
			// Given - 메모를 가진 사용자
			const user = await ctx.helpers.createVerifiedUser(
				"memo-reorder-404@test.com",
				password,
			);
			const memo = await createMemo(user, "순서 변경 대상");

			// When - 없는 대상 메모 기준으로 이동
			const response = await request(ctx.app.getHttpServer())
				.patch(`/v1/memos/${memo.id}/reorder`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ targetMemoId: 999999, position: "after" })
				.expect(404);

			// Then - MEMO_2002 에러
			expect(response.body.error.code).toBe("MEMO_2002");
		});
	});

	describe("DELETE /memos/:id - 메모 삭제", () => {
		it("메모를 삭제한다", async () => {
			// Given - 메모를 가진 사용자
			const user = await ctx.helpers.createVerifiedUser(
				"memo-delete@test.com",
				password,
			);
			const memo = await createMemo(user, "삭제 대상");

			// When - 삭제
			const response = await request(ctx.app.getHttpServer())
				.delete(`/v1/memos/${memo.id}`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.expect(200);

			// Then - 삭제 성공, 이후 조회 시 404
			expect(response.body.success).toBe(true);
			await request(ctx.app.getHttpServer())
				.get(`/v1/memos/${memo.id}`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.expect(404);
		});

		it("존재하지 않는 메모 삭제 시 404 에러 반환 (MEMO_2001)", async () => {
			// Given - 인증된 사용자
			const user = await ctx.helpers.createVerifiedUser(
				"memo-delete-404@test.com",
				password,
			);

			// When - 없는 메모 삭제
			const response = await request(ctx.app.getHttpServer())
				.delete("/v1/memos/999999")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.expect(404);

			// Then - MEMO_2001 에러
			expect(response.body.error.code).toBe("MEMO_2001");
		});

		it("인증 없이 요청 시 401 에러 반환", async () => {
			// Given - 인증 토큰 없음

			// When / Then - 401 Unauthorized
			await request(ctx.app.getHttpServer()).delete("/v1/memos/1").expect(401);
		});
	});

	describe("POST /memos/:id/convert-to-todo - 메모를 할 일로 변환", () => {
		it("메모를 할 일로 변환하고 원본 메모를 삭제한다", async () => {
			// Given - 메모를 가진 사용자
			const user = await ctx.helpers.createVerifiedUser(
				"memo-convert@test.com",
				password,
			);
			const categoryId = await ctx.helpers.getDefaultCategoryId(
				user.accessToken,
			);
			const memo = await createMemo(user, "회의 준비하기");

			// When - 할 일로 변환
			const response = await request(ctx.app.getHttpServer())
				.post(`/v1/memos/${memo.id}/convert-to-todo`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ categoryId, startDate: "2026-02-01" })
				.expect(201);

			// Then - 할 일 생성됨 (제목 = 메모 내용)
			expect(response.body.success).toBe(true);
			expect(response.body.data.todo.id).toBeDefined();
			expect(response.body.data.todo.title).toBe("회의 준비하기");
			expect(response.body.data.todo.startDate).toBe("2026-02-01");

			// Then - 원본 메모는 삭제됨
			await request(ctx.app.getHttpServer())
				.get(`/v1/memos/${memo.id}`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.expect(404);
		});

		it("scheduledTime + X-Timezone(Asia/Seoul)이 UTC로 변환된다", async () => {
			// Given - 메모를 가진 사용자
			const user = await ctx.helpers.createVerifiedUser(
				"memo-convert-tz@test.com",
				password,
			);
			const categoryId = await ctx.helpers.getDefaultCategoryId(
				user.accessToken,
			);
			const memo = await createMemo(user, "아침 운동");

			// When - 09:00 KST 예정 시간으로 변환
			const response = await request(ctx.app.getHttpServer())
				.post(`/v1/memos/${memo.id}/convert-to-todo`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.set("X-Timezone", "Asia/Seoul")
				.send({
					categoryId,
					startDate: "2026-02-01",
					scheduledTime: "09:00",
					isAllDay: false,
				})
				.expect(201);

			// Then - 09:00 KST = 00:00 UTC
			expect(response.body.data.todo.scheduledTime).toBe(
				"2026-02-01T00:00:00.000Z",
			);
			expect(response.body.data.todo.isAllDay).toBe(false);
		});

		it("items로 체크리스트를 함께 생성한다", async () => {
			// Given - 메모를 가진 사용자
			const user = await ctx.helpers.createVerifiedUser(
				"memo-convert-items@test.com",
				password,
			);
			const categoryId = await ctx.helpers.getDefaultCategoryId(
				user.accessToken,
			);
			const memo = await createMemo(user, "장보기");

			// When - 하위 항목과 함께 변환
			const response = await request(ctx.app.getHttpServer())
				.post(`/v1/memos/${memo.id}/convert-to-todo`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({
					categoryId,
					startDate: "2026-02-01",
					items: [{ title: "우유" }, { title: "계란" }],
				})
				.expect(201);

			// Then - 체크리스트 2개 생성
			expect(response.body.data.todo.items).toHaveLength(2);
			expect(response.body.data.todo.itemStats.total).toBe(2);
		});

		it("존재하지 않는 카테고리로 변환 시 404 에러 반환 (TODO_CATEGORY_0851)", async () => {
			// Given - 다른 사용자의 카테고리(foreign category)
			const user = await ctx.helpers.createVerifiedUser(
				"memo-convert-cat-a@test.com",
				password,
			);
			const other = await ctx.helpers.createVerifiedUser(
				"memo-convert-cat-b@test.com",
				password,
			);
			const foreignCategoryId = await ctx.helpers.getDefaultCategoryId(
				other.accessToken,
			);
			const memo = await createMemo(user, "변환 대상");

			// When - 남의 카테고리로 변환 시도
			const response = await request(ctx.app.getHttpServer())
				.post(`/v1/memos/${memo.id}/convert-to-todo`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ categoryId: foreignCategoryId, startDate: "2026-02-01" })
				.expect(404);

			// Then - TODO_CATEGORY_0851 에러
			expect(response.body.error.code).toBe("TODO_CATEGORY_0851");
		});

		it("200자 초과 메모 내용은 할 일 제목으로 앞 200자만 사용된다", async () => {
			// Given - 250자 메모
			const user = await ctx.helpers.createVerifiedUser(
				"memo-convert-trunc@test.com",
				password,
			);
			const categoryId = await ctx.helpers.getDefaultCategoryId(
				user.accessToken,
			);
			const longContent = "가".repeat(250);
			const memo = await createMemo(user, longContent);

			// When - 할 일로 변환
			const response = await request(ctx.app.getHttpServer())
				.post(`/v1/memos/${memo.id}/convert-to-todo`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ categoryId, startDate: "2026-02-01" })
				.expect(201);

			// Then - 제목은 200자로 절삭됨
			expect(response.body.data.todo.title).toHaveLength(200);
			expect(response.body.data.todo.title).toBe("가".repeat(200));
		});

		it("존재하지 않는 메모 변환 시 404 에러 반환 (MEMO_2001)", async () => {
			// Given - 인증된 사용자
			const user = await ctx.helpers.createVerifiedUser(
				"memo-convert-404@test.com",
				password,
			);
			const categoryId = await ctx.helpers.getDefaultCategoryId(
				user.accessToken,
			);

			// When - 없는 메모 변환
			const response = await request(ctx.app.getHttpServer())
				.post("/v1/memos/999999/convert-to-todo")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ categoryId, startDate: "2026-02-01" })
				.expect(404);

			// Then - MEMO_2001 에러
			expect(response.body.error.code).toBe("MEMO_2001");
		});

		it("인증 없이 요청 시 401 에러 반환", async () => {
			// Given - 인증 토큰 없음

			// When / Then - 401 Unauthorized
			await request(ctx.app.getHttpServer())
				.post("/v1/memos/1/convert-to-todo")
				.send({ categoryId: 1, startDate: "2026-02-01" })
				.expect(401);
		});
	});

	describe("POST /memos/:id/convert-to-todos - 메모를 여러 할 일로 일괄 변환", () => {
		it("여러 할 일로 일괄 변환하고 원본 메모를 삭제한다 (반복 일정 포함)", async () => {
			// Given - 메모를 가진 사용자
			const user = await ctx.helpers.createVerifiedUser(
				"memo-convert-batch@test.com",
				password,
			);
			const categoryId = await ctx.helpers.getDefaultCategoryId(
				user.accessToken,
			);
			const memo = await createMemo(user, "이번 주 할 일들");

			// When - 단건 + 반복 일정을 일괄 변환
			const response = await request(ctx.app.getHttpServer())
				.post(`/v1/memos/${memo.id}/convert-to-todos`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.set("X-Timezone", "Asia/Seoul")
				.send({
					todos: [
						{
							title: "보고서 작성",
							categoryId,
							startDate: "2026-02-02",
						},
						{
							title: "주간 회의",
							categoryId,
							startDate: "2026-02-02",
							isRecurring: true,
							recurrence: {
								daysOfWeek: ["MON", "WED", "FRI"],
								endDate: "2026-02-15",
							},
						},
					],
				})
				.expect(201);

			// Then - 단건 1개 + 반복 여러 개 생성 (총 2개 이상)
			expect(response.body.success).toBe(true);
			expect(response.body.data.todos.length).toBeGreaterThanOrEqual(2);
			const titles = response.body.data.todos.map(
				(t: { title: string }) => t.title,
			);
			expect(titles).toContain("보고서 작성");
			expect(titles).toContain("주간 회의");

			// Then - 원본 메모는 삭제됨
			await request(ctx.app.getHttpServer())
				.get(`/v1/memos/${memo.id}`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.expect(404);
		});

		it("빈 todos 배열(0개)로 요청 시 400 에러 반환", async () => {
			// Given - 메모를 가진 사용자
			const user = await ctx.helpers.createVerifiedUser(
				"memo-convert-batch-0@test.com",
				password,
			);
			const memo = await createMemo(user, "변환 대상");

			// When - todos 0개
			const response = await request(ctx.app.getHttpServer())
				.post(`/v1/memos/${memo.id}/convert-to-todos`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ todos: [] })
				.expect(400);

			// Then - 검증 실패
			expect(response.body.success).toBe(false);
		});

		it("todos 6개로 요청 시 400 에러 반환 (최대 5개)", async () => {
			// Given - 메모를 가진 사용자
			const user = await ctx.helpers.createVerifiedUser(
				"memo-convert-batch-6@test.com",
				password,
			);
			const categoryId = await ctx.helpers.getDefaultCategoryId(
				user.accessToken,
			);
			const memo = await createMemo(user, "변환 대상");

			// When - todos 6개
			const response = await request(ctx.app.getHttpServer())
				.post(`/v1/memos/${memo.id}/convert-to-todos`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({
					todos: Array.from({ length: 6 }, (_, i) => ({
						title: `할 일 ${i + 1}`,
						categoryId,
						startDate: "2026-02-02",
					})),
				})
				.expect(400);

			// Then - 검증 실패
			expect(response.body.success).toBe(false);
		});

		it("존재하지 않는 메모 일괄 변환 시 404 에러 반환 (MEMO_2001)", async () => {
			// Given - 인증된 사용자
			const user = await ctx.helpers.createVerifiedUser(
				"memo-convert-batch-404@test.com",
				password,
			);
			const categoryId = await ctx.helpers.getDefaultCategoryId(
				user.accessToken,
			);

			// When - 없는 메모 일괄 변환
			const response = await request(ctx.app.getHttpServer())
				.post("/v1/memos/999999/convert-to-todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({
					todos: [{ title: "할 일", categoryId, startDate: "2026-02-02" }],
				})
				.expect(404);

			// Then - MEMO_2001 에러
			expect(response.body.error.code).toBe("MEMO_2001");
		});
	});
});
