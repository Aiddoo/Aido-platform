/**
 * TodoCategory E2E 테스트
 *
 * @description
 * TodoCategory CRUD 전체 플로우 테스트
 * Testcontainers를 사용하여 독립적인 PostgreSQL 환경에서 테스트합니다.
 */

import request from "supertest";
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers";

describe("할 일 카테고리 E2E", () => {
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

	/**
	 * 프리미엄 유저 생성 헬퍼
	 */
	async function createPremiumUser(email: string, password: string) {
		const user = await ctx.helpers.createVerifiedUser(email, password);
		const prisma = ctx.testDatabase.getPrisma();
		await prisma.user.update({
			where: { id: user.userId },
			data: { subscriptionStatus: "ACTIVE" },
		});
		return user;
	}

	describe("기본 카테고리 생성", () => {
		it("회원가입 시 기본 카테고리 2개가 자동 생성된다", async () => {
			// Given - 새 사용자

			// When - 회원가입 및 인증
			const { accessToken } = await ctx.helpers.createVerifiedUser(
				"category-default@example.com",
				"Test1234!",
			);

			// Then - 카테고리 목록 조회
			const response = await request(ctx.app.getHttpServer())
				.get("/v1/todo-categories")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			expect(response.body.data.items).toHaveLength(2);

			// 기본 카테고리 확인
			const categories = response.body.data.items;
			const categoryNames = categories.map((c: { name: string }) => c.name);

			expect(categoryNames).toContain("중요한 일");
			expect(categoryNames).toContain("할 일");

			// 색상 확인
			const importantCategory = categories.find(
				(c: { name: string }) => c.name === "중요한 일",
			);
			const todoCategory = categories.find(
				(c: { name: string }) => c.name === "할 일",
			);

			expect(importantCategory.color).toBe("#FFB3B3");
			expect(todoCategory.color).toBe("#FF6B43");
		});
	});

	describe("카테고리 CRUD 플로우", () => {
		const testPassword = "Test1234!";

		it("카테고리 생성 → 조회 → 수정 → 삭제 전체 플로우", async () => {
			// Given - 프리미엄 인증된 사용자
			const { accessToken } = await createPremiumUser(
				"category-crud@example.com",
				testPassword,
			);

			// When - 카테고리 생성 API 호출
			const createResponse = await request(ctx.app.getHttpServer())
				.post("/v1/todo-categories")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					name: "공부",
					color: "#00FF00",
				})
				.expect(201);

			// Then - 카테고리 생성 성공 검증
			expect(createResponse.body.data.message).toBe(
				"카테고리가 생성되었습니다.",
			);
			expect(createResponse.body.data.category).toMatchObject({
				name: "공부",
				color: "#00FF00",
			});
			expect(createResponse.body.data.category.id).toBeDefined();

			const createdCategoryId = createResponse.body.data.category.id;

			// When - 카테고리 목록 조회
			const listResponse = await request(ctx.app.getHttpServer())
				.get("/v1/todo-categories")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then - 카테고리 목록 검증 (기본 2개 + 생성한 1개)
			expect(listResponse.body.data.items).toBeDefined();
			expect(Array.isArray(listResponse.body.data.items)).toBe(true);
			expect(listResponse.body.data.items.length).toBe(3);

			// todoCount가 포함되어야 함
			for (const category of listResponse.body.data.items) {
				expect(category.todoCount).toBeDefined();
				expect(typeof category.todoCount).toBe("number");
			}

			// sortOrder 순서로 정렬 검증
			const sortOrders = listResponse.body.data.items.map(
				(c: { sortOrder: number }) => c.sortOrder,
			);
			const isSorted = sortOrders.every(
				(val: number, i: number, arr: number[]) => {
					const prev = arr[i - 1];
					return i === 0 || (prev !== undefined && prev <= val);
				},
			);
			expect(isSorted).toBe(true);

			// When - 카테고리 상세 조회
			const detailResponse = await request(ctx.app.getHttpServer())
				.get(`/v1/todo-categories/${createdCategoryId}`)
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then - 카테고리 상세 정보 검증
			expect(detailResponse.body.data.category.id).toBe(createdCategoryId);
			expect(detailResponse.body.data.category.name).toBe("공부");
			expect(detailResponse.body.data.category.todoCount).toBeDefined();

			// When - 이름 수정
			const updateNameResponse = await request(ctx.app.getHttpServer())
				.patch(`/v1/todo-categories/${createdCategoryId}`)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ name: "수정된 카테고리" })
				.expect(200);

			// Then - 수정 결과 검증
			expect(updateNameResponse.body.data.message).toBe(
				"카테고리가 수정되었습니다.",
			);
			expect(updateNameResponse.body.data.category.name).toBe(
				"수정된 카테고리",
			);

			// When - 색상 수정
			const updateColorResponse = await request(ctx.app.getHttpServer())
				.patch(`/v1/todo-categories/${createdCategoryId}`)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ color: "#0000FF" })
				.expect(200);

			// Then - 색상 수정 결과 검증
			expect(updateColorResponse.body.data.category.color).toBe("#0000FF");

			// When - 이름과 색상 동시 수정
			const updateBothResponse = await request(ctx.app.getHttpServer())
				.patch(`/v1/todo-categories/${createdCategoryId}`)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ name: "최종 수정", color: "#AABBCC" })
				.expect(200);

			// Then - 동시 수정 결과 검증
			expect(updateBothResponse.body.data.category.name).toBe("최종 수정");
			expect(updateBothResponse.body.data.category.color).toBe("#AABBCC");

			// When - 카테고리 삭제 (Todo가 없으므로 바로 삭제 가능)
			const deleteResponse = await request(ctx.app.getHttpServer())
				.delete(`/v1/todo-categories/${createdCategoryId}`)
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then - 삭제 성공 검증
			expect(deleteResponse.body.data.message).toBe(
				"카테고리가 삭제되었습니다.",
			);

			// 삭제 확인
			await request(ctx.app.getHttpServer())
				.get(`/v1/todo-categories/${createdCategoryId}`)
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(404);
		});

		it("중복된 이름으로 생성 시 409 에러", async () => {
			// Given - 프리미엄 인증된 사용자, "공부" 카테고리 존재
			const { accessToken } = await createPremiumUser(
				"category-dup@example.com",
				testPassword,
			);

			await request(ctx.app.getHttpServer())
				.post("/v1/todo-categories")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ name: "공부", color: "#00FF00" })
				.expect(201);

			// When - 동일 이름으로 카테고리 생성 API 호출
			const response = await request(ctx.app.getHttpServer())
				.post("/v1/todo-categories")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ name: "공부", color: "#FF0000" })
				.expect(409);

			// Then - 중복 에러 검증
			expect(response.body.error.code).toBe("TODO_CATEGORY_0853");
		});

		it("이름 누락 시 400 에러", async () => {
			// Given - 프리미엄 인증된 사용자
			const { accessToken } = await createPremiumUser(
				"category-noname@example.com",
				testPassword,
			);

			// When - 이름 없이 카테고리 생성 API 호출
			await request(ctx.app.getHttpServer())
				.post("/v1/todo-categories")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ color: "#00FF00" })
				.expect(400);

			// Then - 400 Bad Request 응답 확인 (expect에서 검증)
		});

		it("색상 누락 시 400 에러", async () => {
			// Given - 프리미엄 인증된 사용자
			const { accessToken } = await createPremiumUser(
				"category-nocolor@example.com",
				testPassword,
			);

			// When - 색상 없이 카테고리 생성 API 호출
			await request(ctx.app.getHttpServer())
				.post("/v1/todo-categories")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ name: "새 카테고리" })
				.expect(400);

			// Then - 400 Bad Request 응답 확인 (expect에서 검증)
		});

		it("잘못된 색상 형식 시 400 에러", async () => {
			// Given - 프리미엄 인증된 사용자
			const { accessToken } = await createPremiumUser(
				"category-badcolor@example.com",
				testPassword,
			);

			// When - 잘못된 색상으로 카테고리 생성 API 호출
			await request(ctx.app.getHttpServer())
				.post("/v1/todo-categories")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ name: "테스트", color: "not-a-color" })
				.expect(400);

			// Then - 400 Bad Request 응답 확인 (expect에서 검증)
		});

		it("인증 없이 생성 시 401 에러", async () => {
			// Given - 인증 토큰 없음

			// When - 인증 없이 카테고리 생성 API 호출
			await request(ctx.app.getHttpServer())
				.post("/v1/todo-categories")
				.send({ name: "테스트", color: "#000000" })
				.expect(401);

			// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
		});

		it("존재하지 않는 ID로 조회 시 404 에러", async () => {
			// Given - 인증된 사용자
			const { accessToken } = await createPremiumUser(
				"category-404@example.com",
				testPassword,
			);

			// When - 존재하지 않는 ID로 조회 API 호출
			const response = await request(ctx.app.getHttpServer())
				.get("/v1/todo-categories/999999")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(404);

			// Then - 404 에러 검증
			expect(response.body.error.code).toBe("TODO_CATEGORY_0851");
		});

		it("인증 없이 조회 시 401 에러", async () => {
			// Given - 인증 토큰 없음

			// When - 인증 없이 카테고리 목록 조회 API 호출
			await request(ctx.app.getHttpServer())
				.get("/v1/todo-categories")
				.expect(401);

			// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
		});

		it("중복된 이름으로 수정 시 409 에러", async () => {
			// Given - 프리미엄 인증된 사용자와 카테고리 생성
			const { accessToken } = await createPremiumUser(
				"category-dupupdate@example.com",
				testPassword,
			);

			const createResponse = await request(ctx.app.getHttpServer())
				.post("/v1/todo-categories")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ name: "공부", color: "#00FF00" })
				.expect(201);

			const createdCategoryId = createResponse.body.data.category.id;

			// When - 기본 카테고리와 중복된 이름으로 수정 API 호출
			const response = await request(ctx.app.getHttpServer())
				.patch(`/v1/todo-categories/${createdCategoryId}`)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ name: "중요한 일" })
				.expect(409);

			// Then - 중복 에러 검증
			expect(response.body.error.code).toBe("TODO_CATEGORY_0853");
		});

		it("존재하지 않는 ID로 수정 시 404 에러", async () => {
			// Given - 인증된 사용자
			const { accessToken } = await createPremiumUser(
				"category-update404@example.com",
				testPassword,
			);

			// When - 존재하지 않는 ID로 수정 API 호출
			const response = await request(ctx.app.getHttpServer())
				.patch("/v1/todo-categories/999999")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ name: "테스트" })
				.expect(404);

			// Then - 404 에러 검증
			expect(response.body.error.code).toBe("TODO_CATEGORY_0851");
		});

		it("인증 없이 수정 시 401 에러", async () => {
			// Given - 인증 토큰 없음

			// When - 인증 없이 카테고리 수정 API 호출
			await request(ctx.app.getHttpServer())
				.patch("/v1/todo-categories/1")
				.send({ name: "테스트" })
				.expect(401);

			// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
		});

		it("인증 없이 상세 조회 시 401 에러", async () => {
			// Given - 인증 토큰 없음

			// When - 인증 없이 카테고리 상세 조회 API 호출
			await request(ctx.app.getHttpServer())
				.get("/v1/todo-categories/1")
				.expect(401);

			// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
		});
	});

	describe("카테고리 순서 변경", () => {
		const testPassword = "Test1234!";

		it("특정 카테고리 앞으로 이동 성공 (before)", async () => {
			// Given - 프리미엄 사용자와 3개의 추가 카테고리
			const { accessToken } = await createPremiumUser(
				"cat-reorder-before@example.com",
				testPassword,
			);

			const res1 = await request(ctx.app.getHttpServer())
				.post("/v1/todo-categories")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ name: "순서 테스트 1", color: "#111111" })
				.expect(201);
			const category1Id = res1.body.data.category.id;

			const _res2 = await request(ctx.app.getHttpServer())
				.post("/v1/todo-categories")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ name: "순서 테스트 2", color: "#222222" })
				.expect(201);

			const res3 = await request(ctx.app.getHttpServer())
				.post("/v1/todo-categories")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ name: "순서 테스트 3", color: "#333333" })
				.expect(201);
			const category3Id = res3.body.data.category.id;

			// When - category3을 category1 앞으로 이동
			const response = await request(ctx.app.getHttpServer())
				.patch(`/v1/todo-categories/${category3Id}/reorder`)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					targetCategoryId: category1Id,
					position: "before",
				})
				.expect(200);

			// Then - 이동 성공 검증
			expect(response.body.data.message).toBe(
				"카테고리 순서가 변경되었습니다.",
			);
		});

		it("특정 카테고리 뒤로 이동 성공 (after)", async () => {
			// Given - 프리미엄 사용자와 3개의 추가 카테고리
			const { accessToken } = await createPremiumUser(
				"cat-reorder-after@example.com",
				testPassword,
			);

			const res1 = await request(ctx.app.getHttpServer())
				.post("/v1/todo-categories")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ name: "순서 테스트 1", color: "#111111" })
				.expect(201);
			const category1Id = res1.body.data.category.id;

			const res2 = await request(ctx.app.getHttpServer())
				.post("/v1/todo-categories")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ name: "순서 테스트 2", color: "#222222" })
				.expect(201);
			const category2Id = res2.body.data.category.id;

			// When - category1을 category2 뒤로 이동
			const response = await request(ctx.app.getHttpServer())
				.patch(`/v1/todo-categories/${category1Id}/reorder`)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					targetCategoryId: category2Id,
					position: "after",
				})
				.expect(200);

			// Then - 이동 성공 검증
			expect(response.body.data.message).toBe(
				"카테고리 순서가 변경되었습니다.",
			);
		});

		it("맨 앞으로 이동 성공 (targetCategoryId 없이 before)", async () => {
			// Given - 프리미엄 사용자와 카테고리
			const { accessToken } = await createPremiumUser(
				"cat-reorder-first@example.com",
				testPassword,
			);

			const res = await request(ctx.app.getHttpServer())
				.post("/v1/todo-categories")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ name: "순서 테스트", color: "#111111" })
				.expect(201);
			const categoryId = res.body.data.category.id;

			// When - 맨 앞으로 이동
			const response = await request(ctx.app.getHttpServer())
				.patch(`/v1/todo-categories/${categoryId}/reorder`)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ position: "before" })
				.expect(200);

			// Then - sortOrder 0 검증
			expect(response.body.data.category.sortOrder).toBe(0);
		});

		it("맨 뒤로 이동 성공 (targetCategoryId 없이 after)", async () => {
			// Given - 프리미엄 사용자와 카테고리
			const { accessToken } = await createPremiumUser(
				"cat-reorder-last@example.com",
				testPassword,
			);

			const res = await request(ctx.app.getHttpServer())
				.post("/v1/todo-categories")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ name: "순서 테스트", color: "#111111" })
				.expect(201);
			const categoryId = res.body.data.category.id;

			// 현재 최대 sortOrder 확인
			const beforeResponse = await request(ctx.app.getHttpServer())
				.get("/v1/todo-categories")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			const maxSortOrder = Math.max(
				...beforeResponse.body.data.items.map(
					(c: { sortOrder: number }) => c.sortOrder,
				),
			);

			// When - 맨 뒤로 이동
			const response = await request(ctx.app.getHttpServer())
				.patch(`/v1/todo-categories/${categoryId}/reorder`)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ position: "after" })
				.expect(200);

			// Then - 맨 뒤로 이동 후 가장 큰 sortOrder 값을 가져야 함
			expect(response.body.data.category.sortOrder).toBeGreaterThanOrEqual(
				maxSortOrder,
			);
		});
	});

	describe("카테고리 삭제", () => {
		const testPassword = "Test1234!";

		it("Todo가 없는 카테고리 삭제 성공", async () => {
			// Given - 프리미엄 사용자와 삭제용 카테고리
			const { accessToken } = await createPremiumUser(
				"cat-del-empty@example.com",
				testPassword,
			);

			const res = await request(ctx.app.getHttpServer())
				.post("/v1/todo-categories")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ name: "삭제될 카테고리", color: "#FF0000" })
				.expect(201);
			const categoryToDelete = res.body.data.category.id;

			// When - 카테고리 삭제 API 호출
			const response = await request(ctx.app.getHttpServer())
				.delete(`/v1/todo-categories/${categoryToDelete}`)
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then - 삭제 성공 검증
			expect(response.body.data.message).toBe("카테고리가 삭제되었습니다.");

			// 삭제 확인
			await request(ctx.app.getHttpServer())
				.get(`/v1/todo-categories/${categoryToDelete}`)
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(404);
		});

		it("Todo가 있는 카테고리 삭제 시 이동 대상 필요", async () => {
			// Given - 프리미엄 사용자, Todo가 있는 카테고리
			const { accessToken } = await createPremiumUser(
				"cat-del-todos@example.com",
				testPassword,
			);

			const catRes = await request(ctx.app.getHttpServer())
				.post("/v1/todo-categories")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ name: "Todo 있는 카테고리", color: "#00FF00" })
				.expect(201);
			const categoryWithTodos = catRes.body.data.category.id;

			await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					title: "테스트 할 일",
					categoryId: categoryWithTodos,
					startDate: "2024-01-15",
				})
				.expect(201);

			// When - 이동 대상 없이 삭제 시도
			const response = await request(ctx.app.getHttpServer())
				.delete(`/v1/todo-categories/${categoryWithTodos}`)
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(400);

			// Then - 이동 대상 필요 에러 검증
			expect(response.body.error.code).toBe("TODO_CATEGORY_0855");
		});

		it("moveToCategoryId가 삭제 대상과 같으면 400을 반환해야 한다", async () => {
			// Given - 프리미엄 사용자, Todo가 있는 카테고리
			const { accessToken } = await createPremiumUser(
				"cat-del-self@example.com",
				testPassword,
			);

			const catRes = await request(ctx.app.getHttpServer())
				.post("/v1/todo-categories")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ name: "셀프 이동 테스트", color: "#FF0000" })
				.expect(201);
			const categoryId = catRes.body.data.category.id;

			await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					title: "셀프 이동 할 일",
					categoryId,
					startDate: "2024-01-15",
				})
				.expect(201);

			// When - 자기 자신으로 이동 시도
			const response = await request(ctx.app.getHttpServer())
				.delete(`/v1/todo-categories/${categoryId}`)
				.set("Authorization", `Bearer ${accessToken}`)
				.query({ moveToCategoryId: categoryId })
				.expect(400);

			// Then - 셀프 이동 에러 검증
			expect(response.body.error.code).toBe("SYS_0002");
		});

		it("Todo가 있는 카테고리를 이동 대상과 함께 삭제 성공", async () => {
			// Given - 프리미엄 사용자, Todo가 있는 카테고리와 이동 대상 카테고리
			const { accessToken } = await createPremiumUser(
				"cat-del-move@example.com",
				testPassword,
			);

			const listRes = await request(ctx.app.getHttpServer())
				.get("/v1/todo-categories")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);
			const targetCategoryId = listRes.body.data.items[0].id;

			const catRes = await request(ctx.app.getHttpServer())
				.post("/v1/todo-categories")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ name: "이동 후 삭제", color: "#0000FF" })
				.expect(201);
			const categoryWithTodos = catRes.body.data.category.id;

			const todoRes = await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					title: "이동될 할 일",
					categoryId: categoryWithTodos,
					startDate: "2024-01-15",
				})
				.expect(201);
			const todoId = todoRes.body.data.todo.id;

			// When - 이동 대상과 함께 삭제
			const response = await request(ctx.app.getHttpServer())
				.delete(`/v1/todo-categories/${categoryWithTodos}`)
				.query({ moveToCategoryId: targetCategoryId })
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then - 삭제 성공 및 Todo 이동 검증
			expect(response.body.data.message).toBe("카테고리가 삭제되었습니다.");

			// Todo가 이동되었는지 확인
			const todoResponse = await request(ctx.app.getHttpServer())
				.get(`/v1/todos/${todoId}`)
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			expect(todoResponse.body.data.category.id).toBe(targetCategoryId);
		});

		it("마지막 카테고리 삭제 시 400 에러", async () => {
			// Given - 새 사용자 생성 (카테고리 2개만 있음)
			const { accessToken: newUserToken } =
				await ctx.helpers.createVerifiedUser(
					"last-category@example.com",
					testPassword,
				);

			// 카테고리 목록 조회
			const listRes = await request(ctx.app.getHttpServer())
				.get("/v1/todo-categories")
				.set("Authorization", `Bearer ${newUserToken}`)
				.expect(200);

			const categories = listRes.body.data.items;
			expect(categories).toHaveLength(2);

			// When - 첫 번째 카테고리 삭제
			await request(ctx.app.getHttpServer())
				.delete(`/v1/todo-categories/${categories[0].id}`)
				.set("Authorization", `Bearer ${newUserToken}`)
				.expect(200);

			// When - 마지막 카테고리 삭제 시도
			const response = await request(ctx.app.getHttpServer())
				.delete(`/v1/todo-categories/${categories[1].id}`)
				.set("Authorization", `Bearer ${newUserToken}`)
				.expect(400);

			// Then - 마지막 카테고리 삭제 에러 검증
			expect(response.body.error.code).toBe("TODO_CATEGORY_0854");
		});

		it("존재하지 않는 ID로 삭제 시 404 에러", async () => {
			// Given - 인증된 사용자
			const { accessToken } = await createPremiumUser(
				"cat-del-404@example.com",
				testPassword,
			);

			// When - 존재하지 않는 ID로 삭제 API 호출
			const response = await request(ctx.app.getHttpServer())
				.delete("/v1/todo-categories/999999")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(404);

			// Then - 404 에러 검증
			expect(response.body.error.code).toBe("TODO_CATEGORY_0851");
		});

		it("인증 없이 삭제 시 401 에러", async () => {
			// Given - 인증 토큰 없음

			// When - 인증 없이 카테고리 삭제 API 호출
			await request(ctx.app.getHttpServer())
				.delete("/v1/todo-categories/1")
				.expect(401);

			// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
		});
	});

	describe("사용자 격리 테스트", () => {
		const testPassword = "Test1234!";

		it("다른 사용자의 카테고리 조회 시 403 에러", async () => {
			// Given - 두 프리미엄 사용자와 user1의 카테고리
			const user1 = await createPremiumUser(
				"cat-user1-403@example.com",
				testPassword,
			);
			const user2 = await createPremiumUser(
				"cat-user2-403@example.com",
				testPassword,
			);

			const response = await request(ctx.app.getHttpServer())
				.post("/v1/todo-categories")
				.set("Authorization", `Bearer ${user1.accessToken}`)
				.send({ name: "User1 카테고리", color: "#FF0000" })
				.expect(201);
			const user1CategoryId = response.body.data.category.id;

			// When - 다른 사용자의 카테고리 상세 조회 API 호출
			const getResponse = await request(ctx.app.getHttpServer())
				.get(`/v1/todo-categories/${user1CategoryId}`)
				.set("Authorization", `Bearer ${user2.accessToken}`)
				.expect(403);

			// Then - 권한 에러 검증
			expect(getResponse.body.error.code).toBe("TODO_CATEGORY_0852");
		});

		it("다른 사용자의 카테고리 수정 시 404 에러", async () => {
			// Given - 두 프리미엄 사용자와 user1의 카테고리
			const user1 = await createPremiumUser(
				"cat-user1-patch@example.com",
				testPassword,
			);
			const user2 = await createPremiumUser(
				"cat-user2-patch@example.com",
				testPassword,
			);

			const response = await request(ctx.app.getHttpServer())
				.post("/v1/todo-categories")
				.set("Authorization", `Bearer ${user1.accessToken}`)
				.send({ name: "User1 카테고리", color: "#FF0000" })
				.expect(201);
			const user1CategoryId = response.body.data.category.id;

			// When - 다른 사용자의 카테고리 수정 API 호출
			const patchResponse = await request(ctx.app.getHttpServer())
				.patch(`/v1/todo-categories/${user1CategoryId}`)
				.set("Authorization", `Bearer ${user2.accessToken}`)
				.send({ name: "해킹 시도" })
				.expect(404);

			// Then - 404 에러 검증
			expect(patchResponse.body.error.code).toBe("TODO_CATEGORY_0851");
		});

		it("다른 사용자의 카테고리 삭제 시 404 에러", async () => {
			// Given - 두 프리미엄 사용자와 user1의 카테고리
			const user1 = await createPremiumUser(
				"cat-user1-del@example.com",
				testPassword,
			);
			const user2 = await createPremiumUser(
				"cat-user2-del@example.com",
				testPassword,
			);

			const response = await request(ctx.app.getHttpServer())
				.post("/v1/todo-categories")
				.set("Authorization", `Bearer ${user1.accessToken}`)
				.send({ name: "User1 카테고리", color: "#FF0000" })
				.expect(201);
			const user1CategoryId = response.body.data.category.id;

			// When - 다른 사용자의 카테고리 삭제 API 호출
			const delResponse = await request(ctx.app.getHttpServer())
				.delete(`/v1/todo-categories/${user1CategoryId}`)
				.set("Authorization", `Bearer ${user2.accessToken}`)
				.expect(404);

			// Then - 404 에러 검증
			expect(delResponse.body.error.code).toBe("TODO_CATEGORY_0851");
		});

		it("같은 이름의 카테고리를 다른 사용자가 각각 생성 가능", async () => {
			// Given - 두 프리미엄 사용자
			const user1 = await createPremiumUser(
				"cat-user1-same@example.com",
				testPassword,
			);
			const user2 = await createPremiumUser(
				"cat-user2-same@example.com",
				testPassword,
			);

			// user1이 "운동" 카테고리 생성
			await request(ctx.app.getHttpServer())
				.post("/v1/todo-categories")
				.set("Authorization", `Bearer ${user1.accessToken}`)
				.send({ name: "운동", color: "#00FF00" })
				.expect(201);

			// When - user2도 "운동" 카테고리 생성
			const response = await request(ctx.app.getHttpServer())
				.post("/v1/todo-categories")
				.set("Authorization", `Bearer ${user2.accessToken}`)
				.send({ name: "운동", color: "#0000FF" })
				.expect(201);

			// Then - 생성 성공 검증
			expect(response.body.data.category.name).toBe("운동");
		});

		it("각 사용자는 자신의 카테고리만 목록에서 조회됨", async () => {
			// Given - 두 프리미엄 사용자
			const user1 = await createPremiumUser(
				"cat-user1-list@example.com",
				testPassword,
			);
			const user2 = await createPremiumUser(
				"cat-user2-list@example.com",
				testPassword,
			);

			// user1이 카테고리 생성
			await request(ctx.app.getHttpServer())
				.post("/v1/todo-categories")
				.set("Authorization", `Bearer ${user1.accessToken}`)
				.send({ name: "User1 카테고리", color: "#FF0000" })
				.expect(201);

			// When - user1의 목록 조회
			const user1List = await request(ctx.app.getHttpServer())
				.get("/v1/todo-categories")
				.set("Authorization", `Bearer ${user1.accessToken}`)
				.expect(200);

			// When - user2의 목록 조회
			const user2List = await request(ctx.app.getHttpServer())
				.get("/v1/todo-categories")
				.set("Authorization", `Bearer ${user2.accessToken}`)
				.expect(200);

			// Then - 격리 검증
			const user1Names = user1List.body.data.items.map(
				(c: { name: string }) => c.name,
			);
			const user2Names = user2List.body.data.items.map(
				(c: { name: string }) => c.name,
			);

			expect(user1Names).toContain("User1 카테고리");
			expect(user2Names).not.toContain("User1 카테고리");
		});
	});
});
