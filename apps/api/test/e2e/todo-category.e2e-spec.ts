/**
 * TodoCategory E2E 테스트
 *
 * @description
 * TodoCategory CRUD 전체 플로우 테스트
 * Testcontainers를 사용하여 독립적인 PostgreSQL 환경에서 테스트합니다.
 */

import request from "supertest";
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers";

describe("TodoCategory (e2e)", () => {
	let ctx: E2eTestContext;

	beforeAll(async () => {
		ctx = await createE2eApp();
	}, 60000);

	afterAll(async () => {
		await destroyE2eApp(ctx);
	});

	describe("기본 카테고리 생성", () => {
		const testEmail = "category-default@example.com";
		const testPassword = "Test1234!";

		it("회원가입 시 기본 카테고리 2개가 자동 생성된다", async () => {
			// Given - 새 사용자

			// When - 회원가입 및 인증
			const { accessToken } = await ctx.helpers.createVerifiedUser(
				testEmail,
				testPassword,
			);

			// Then - 카테고리 목록 조회
			const response = await request(ctx.app.getHttpServer())
				.get("/todo-categories")
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
		const testEmail = "category-crud@example.com";
		const testPassword = "Test1234!";
		let accessToken: string;
		let createdCategoryId: number;

		beforeAll(async () => {
			const user = await ctx.helpers.createVerifiedUser(
				testEmail,
				testPassword,
			);
			accessToken = user.accessToken;
		});

		describe("POST /todo-categories - 카테고리 생성", () => {
			it("새 카테고리 생성 성공", async () => {
				// Given - 인증된 사용자

				// When - 카테고리 생성 API 호출
				const response = await request(ctx.app.getHttpServer())
					.post("/todo-categories")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						name: "공부",
						color: "#00FF00",
					})
					.expect(201);

				// Then - 카테고리 생성 성공 검증
				expect(response.body.data.message).toBe("카테고리가 생성되었습니다.");
				expect(response.body.data.category).toMatchObject({
					name: "공부",
					color: "#00FF00",
				});
				expect(response.body.data.category.id).toBeDefined();

				createdCategoryId = response.body.data.category.id;
			});

			it("중복된 이름으로 생성 시 409 에러", async () => {
				// Given - 이미 "공부" 카테고리가 존재하는 상태

				// When - 동일 이름으로 카테고리 생성 API 호출
				const response = await request(ctx.app.getHttpServer())
					.post("/todo-categories")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						name: "공부",
						color: "#FF0000",
					})
					.expect(409);

				// Then - 중복 에러 검증
				expect(response.body.error.code).toBe("TODO_CATEGORY_0853");
			});

			it("이름 누락 시 400 에러", async () => {
				// Given - 인증된 사용자

				// When - 이름 없이 카테고리 생성 API 호출
				await request(ctx.app.getHttpServer())
					.post("/todo-categories")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						color: "#00FF00",
					})
					.expect(400);

				// Then - 400 Bad Request 응답 확인 (expect에서 검증)
			});

			it("색상 누락 시 400 에러", async () => {
				// Given - 인증된 사용자

				// When - 색상 없이 카테고리 생성 API 호출
				await request(ctx.app.getHttpServer())
					.post("/todo-categories")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						name: "새 카테고리",
					})
					.expect(400);

				// Then - 400 Bad Request 응답 확인 (expect에서 검증)
			});

			it("잘못된 색상 형식 시 400 에러", async () => {
				// Given - 인증된 사용자

				// When - 잘못된 색상으로 카테고리 생성 API 호출
				await request(ctx.app.getHttpServer())
					.post("/todo-categories")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						name: "테스트",
						color: "not-a-color",
					})
					.expect(400);

				// Then - 400 Bad Request 응답 확인 (expect에서 검증)
			});

			it("인증 없이 생성 시 401 에러", async () => {
				// Given - 인증 토큰 없음

				// When - 인증 없이 카테고리 생성 API 호출
				await request(ctx.app.getHttpServer())
					.post("/todo-categories")
					.send({
						name: "테스트",
						color: "#000000",
					})
					.expect(401);

				// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
			});
		});

		describe("GET /todo-categories - 카테고리 목록 조회", () => {
			it("카테고리 목록 조회 성공", async () => {
				// Given - 기본 카테고리 2개 + 생성한 "공부" 카테고리

				// When - 카테고리 목록 조회 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/todo-categories")
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(200);

				// Then - 카테고리 목록 검증
				expect(response.body.data.items).toBeDefined();
				expect(Array.isArray(response.body.data.items)).toBe(true);
				expect(response.body.data.items.length).toBe(3);

				// todoCount가 포함되어야 함
				for (const category of response.body.data.items) {
					expect(category.todoCount).toBeDefined();
					expect(typeof category.todoCount).toBe("number");
				}
			});

			it("sortOrder 순서로 정렬되어 반환된다", async () => {
				// Given - 카테고리가 존재하는 상태

				// When - 카테고리 목록 조회 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/todo-categories")
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(200);

				// Then - 정렬 검증
				const sortOrders = response.body.data.items.map(
					(c: { sortOrder: number }) => c.sortOrder,
				);

				const isSorted = sortOrders.every(
					(val: number, i: number, arr: number[]) => {
						const prev = arr[i - 1];
						return i === 0 || (prev !== undefined && prev <= val);
					},
				);
				expect(isSorted).toBe(true);
			});

			it("인증 없이 조회 시 401 에러", async () => {
				// Given - 인증 토큰 없음

				// When - 인증 없이 카테고리 목록 조회 API 호출
				await request(ctx.app.getHttpServer())
					.get("/todo-categories")
					.expect(401);

				// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
			});
		});

		describe("GET /todo-categories/:id - 카테고리 상세 조회", () => {
			it("카테고리 상세 조회 성공", async () => {
				// Given - 생성된 카테고리 ID

				// When - 카테고리 상세 조회 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get(`/todo-categories/${createdCategoryId}`)
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(200);

				// Then - 카테고리 상세 정보 검증
				expect(response.body.data.category.id).toBe(createdCategoryId);
				expect(response.body.data.category.name).toBe("공부");
				expect(response.body.data.category.todoCount).toBeDefined();
			});

			it("존재하지 않는 ID로 조회 시 404 에러", async () => {
				// Given - 존재하지 않는 카테고리 ID

				// When - 존재하지 않는 ID로 조회 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/todo-categories/999999")
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(404);

				// Then - 404 에러 검증
				expect(response.body.error.code).toBe("TODO_CATEGORY_0851");
			});

			it("인증 없이 조회 시 401 에러", async () => {
				// Given - 인증 토큰 없음

				// When - 인증 없이 카테고리 상세 조회 API 호출
				await request(ctx.app.getHttpServer())
					.get(`/todo-categories/${createdCategoryId}`)
					.expect(401);

				// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
			});
		});

		describe("PATCH /todo-categories/:id - 카테고리 수정", () => {
			it("이름 수정 성공", async () => {
				// Given - 생성된 카테고리

				// When - 이름 수정 API 호출
				const response = await request(ctx.app.getHttpServer())
					.patch(`/todo-categories/${createdCategoryId}`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						name: "수정된 카테고리",
					})
					.expect(200);

				// Then - 수정 결과 검증
				expect(response.body.data.message).toBe("카테고리가 수정되었습니다.");
				expect(response.body.data.category.name).toBe("수정된 카테고리");
			});

			it("색상 수정 성공", async () => {
				// Given - 생성된 카테고리

				// When - 색상 수정 API 호출
				const response = await request(ctx.app.getHttpServer())
					.patch(`/todo-categories/${createdCategoryId}`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						color: "#0000FF",
					})
					.expect(200);

				// Then - 수정 결과 검증
				expect(response.body.data.category.color).toBe("#0000FF");
			});

			it("이름과 색상 동시 수정 성공", async () => {
				// Given - 생성된 카테고리

				// When - 이름과 색상 동시 수정 API 호출
				const response = await request(ctx.app.getHttpServer())
					.patch(`/todo-categories/${createdCategoryId}`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						name: "최종 수정",
						color: "#AABBCC",
					})
					.expect(200);

				// Then - 수정 결과 검증
				expect(response.body.data.category.name).toBe("최종 수정");
				expect(response.body.data.category.color).toBe("#AABBCC");
			});

			it("중복된 이름으로 수정 시 409 에러", async () => {
				// Given - 기본 카테고리 "중요한 일"이 존재

				// When - 기본 카테고리와 중복된 이름으로 수정 API 호출
				const response = await request(ctx.app.getHttpServer())
					.patch(`/todo-categories/${createdCategoryId}`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						name: "중요한 일", // 기본 카테고리와 중복
					})
					.expect(409);

				// Then - 중복 에러 검증
				expect(response.body.error.code).toBe("TODO_CATEGORY_0853");
			});

			it("존재하지 않는 ID로 수정 시 404 에러", async () => {
				// Given - 존재하지 않는 카테고리 ID

				// When - 존재하지 않는 ID로 수정 API 호출
				const response = await request(ctx.app.getHttpServer())
					.patch("/todo-categories/999999")
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
					.patch(`/todo-categories/${createdCategoryId}`)
					.send({ name: "테스트" })
					.expect(401);

				// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
			});
		});

		describe("PATCH /todo-categories/:id/reorder - 카테고리 순서 변경", () => {
			let category1Id: number;
			let category2Id: number;
			let category3Id: number;

			beforeAll(async () => {
				// 추가 카테고리 생성
				const res1 = await request(ctx.app.getHttpServer())
					.post("/todo-categories")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ name: "순서 테스트 1", color: "#111111" })
					.expect(201);
				category1Id = res1.body.data.category.id;

				const res2 = await request(ctx.app.getHttpServer())
					.post("/todo-categories")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ name: "순서 테스트 2", color: "#222222" })
					.expect(201);
				category2Id = res2.body.data.category.id;

				const res3 = await request(ctx.app.getHttpServer())
					.post("/todo-categories")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ name: "순서 테스트 3", color: "#333333" })
					.expect(201);
				category3Id = res3.body.data.category.id;
			});

			it("특정 카테고리 앞으로 이동 성공 (before)", async () => {
				// Given - 3개의 카테고리

				// When - category3을 category1 앞으로 이동
				const response = await request(ctx.app.getHttpServer())
					.patch(`/todo-categories/${category3Id}/reorder`)
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
				// Given - 카테고리가 존재하는 상태

				// When - category1을 category2 뒤로 이동
				const response = await request(ctx.app.getHttpServer())
					.patch(`/todo-categories/${category1Id}/reorder`)
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
				// Given - 카테고리가 존재하는 상태

				// When - category2를 맨 앞으로 이동
				const response = await request(ctx.app.getHttpServer())
					.patch(`/todo-categories/${category2Id}/reorder`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						position: "before",
					})
					.expect(200);

				// Then - sortOrder 0 검증
				expect(response.body.data.category.sortOrder).toBe(0);
			});

			it("맨 뒤로 이동 성공 (targetCategoryId 없이 after)", async () => {
				// Given - 현재 최대 sortOrder 확인
				const beforeResponse = await request(ctx.app.getHttpServer())
					.get("/todo-categories")
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(200);

				const maxSortOrder = Math.max(
					...beforeResponse.body.data.items.map(
						(c: { sortOrder: number }) => c.sortOrder,
					),
				);

				// When - category1을 맨 뒤로 이동
				const response = await request(ctx.app.getHttpServer())
					.patch(`/todo-categories/${category1Id}/reorder`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						position: "after",
					})
					.expect(200);

				// Then - 맨 뒤로 이동 후 가장 큰 sortOrder 값을 가져야 함
				expect(response.body.data.category.sortOrder).toBeGreaterThanOrEqual(
					maxSortOrder,
				);
			});
		});

		describe("DELETE /todo-categories/:id - 카테고리 삭제", () => {
			let categoryToDelete: number;
			let targetCategoryId: number;

			beforeAll(async () => {
				// 삭제용 카테고리 생성
				const res = await request(ctx.app.getHttpServer())
					.post("/todo-categories")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ name: "삭제될 카테고리", color: "#FF0000" })
					.expect(201);
				categoryToDelete = res.body.data.category.id;

				// 이동 대상 카테고리 (기본 카테고리)
				const listRes = await request(ctx.app.getHttpServer())
					.get("/todo-categories")
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(200);
				targetCategoryId = listRes.body.data.items[0].id;
			});

			it("Todo가 없는 카테고리 삭제 성공", async () => {
				// Given - Todo가 없는 카테고리

				// When - 카테고리 삭제 API 호출
				const response = await request(ctx.app.getHttpServer())
					.delete(`/todo-categories/${categoryToDelete}`)
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(200);

				// Then - 삭제 성공 검증
				expect(response.body.data.message).toBe("카테고리가 삭제되었습니다.");

				// 삭제 확인
				await request(ctx.app.getHttpServer())
					.get(`/todo-categories/${categoryToDelete}`)
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(404);
			});

			it("Todo가 있는 카테고리 삭제 시 이동 대상 필요", async () => {
				// Given - Todo가 있는 카테고리 생성
				const catRes = await request(ctx.app.getHttpServer())
					.post("/todo-categories")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ name: "Todo 있는 카테고리", color: "#00FF00" })
					.expect(201);
				const categoryWithTodos = catRes.body.data.category.id;

				// Todo 생성
				await request(ctx.app.getHttpServer())
					.post("/todos")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						title: "테스트 할 일",
						categoryId: categoryWithTodos,
						startDate: "2024-01-15",
					})
					.expect(201);

				// When - 이동 대상 없이 삭제 시도
				const response = await request(ctx.app.getHttpServer())
					.delete(`/todo-categories/${categoryWithTodos}`)
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(400);

				// Then - 이동 대상 필요 에러 검증
				expect(response.body.error.code).toBe("TODO_CATEGORY_0855");
			});

			it("moveToCategoryId가 삭제 대상과 같으면 400을 반환해야 한다", async () => {
				// Given - Todo가 있는 카테고리 생성
				const catRes = await request(ctx.app.getHttpServer())
					.post("/todo-categories")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ name: "셀프 이동 테스트", color: "#FF0000" })
					.expect(201);
				const categoryId = catRes.body.data.category.id;

				// Todo 생성
				await request(ctx.app.getHttpServer())
					.post("/todos")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						title: "셀프 이동 할 일",
						categoryId,
						startDate: "2024-01-15",
					})
					.expect(201);

				// When - 자기 자신으로 이동 시도
				const response = await request(ctx.app.getHttpServer())
					.delete(`/todo-categories/${categoryId}`)
					.set("Authorization", `Bearer ${accessToken}`)
					.query({ moveToCategoryId: categoryId })
					.expect(400);

				// Then - 셀프 이동 에러 검증
				expect(response.body.error.code).toBe("SYS_0002");
			});

			it("Todo가 있는 카테고리를 이동 대상과 함께 삭제 성공", async () => {
				// Given - Todo가 있는 카테고리 생성
				const catRes = await request(ctx.app.getHttpServer())
					.post("/todo-categories")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ name: "이동 후 삭제", color: "#0000FF" })
					.expect(201);
				const categoryWithTodos = catRes.body.data.category.id;

				// Todo 생성
				const todoRes = await request(ctx.app.getHttpServer())
					.post("/todos")
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
					.delete(`/todo-categories/${categoryWithTodos}`)
					.query({ moveToCategoryId: targetCategoryId })
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(200);

				// Then - 삭제 성공 및 Todo 이동 검증
				expect(response.body.data.message).toBe("카테고리가 삭제되었습니다.");

				// Todo가 이동되었는지 확인
				const todoResponse = await request(ctx.app.getHttpServer())
					.get(`/todos/${todoId}`)
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
					.get("/todo-categories")
					.set("Authorization", `Bearer ${newUserToken}`)
					.expect(200);

				const categories = listRes.body.data.items;
				expect(categories).toHaveLength(2);

				// When - 첫 번째 카테고리 삭제
				await request(ctx.app.getHttpServer())
					.delete(`/todo-categories/${categories[0].id}`)
					.set("Authorization", `Bearer ${newUserToken}`)
					.expect(200);

				// When - 마지막 카테고리 삭제 시도
				const response = await request(ctx.app.getHttpServer())
					.delete(`/todo-categories/${categories[1].id}`)
					.set("Authorization", `Bearer ${newUserToken}`)
					.expect(400);

				// Then - 마지막 카테고리 삭제 에러 검증
				expect(response.body.error.code).toBe("TODO_CATEGORY_0854");
			});

			it("존재하지 않는 ID로 삭제 시 404 에러", async () => {
				// Given - 존재하지 않는 카테고리 ID

				// When - 존재하지 않는 ID로 삭제 API 호출
				const response = await request(ctx.app.getHttpServer())
					.delete("/todo-categories/999999")
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(404);

				// Then - 404 에러 검증
				expect(response.body.error.code).toBe("TODO_CATEGORY_0851");
			});

			it("인증 없이 삭제 시 401 에러", async () => {
				// Given - 인증 토큰 없음

				// When - 인증 없이 카테고리 삭제 API 호출
				await request(ctx.app.getHttpServer())
					.delete(`/todo-categories/${createdCategoryId}`)
					.expect(401);

				// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
			});
		});
	});

	describe("사용자 격리 테스트", () => {
		const user1Email = "cat-user1@example.com";
		const user2Email = "cat-user2@example.com";
		const testPassword = "Test1234!";
		let user1Token: string;
		let user2Token: string;
		let user1CategoryId: number;

		beforeAll(async () => {
			const user1 = await ctx.helpers.createVerifiedUser(
				user1Email,
				testPassword,
			);
			const user2 = await ctx.helpers.createVerifiedUser(
				user2Email,
				testPassword,
			);
			user1Token = user1.accessToken;
			user2Token = user2.accessToken;

			// user1의 카테고리 생성
			const response = await request(ctx.app.getHttpServer())
				.post("/todo-categories")
				.set("Authorization", `Bearer ${user1Token}`)
				.send({
					name: "User1 카테고리",
					color: "#FF0000",
				})
				.expect(201);

			user1CategoryId = response.body.data.category.id;
		});

		it("다른 사용자의 카테고리 조회 시 403 에러", async () => {
			// Given - user2가 user1의 카테고리 접근

			// When - 다른 사용자의 카테고리 상세 조회 API 호출
			const response = await request(ctx.app.getHttpServer())
				.get(`/todo-categories/${user1CategoryId}`)
				.set("Authorization", `Bearer ${user2Token}`)
				.expect(403);

			// Then - 권한 에러 검증
			expect(response.body.error.code).toBe("TODO_CATEGORY_0852");
		});

		it("다른 사용자의 카테고리 수정 시 404 에러", async () => {
			// Given - user2가 user1의 카테고리 수정 시도

			// When - 다른 사용자의 카테고리 수정 API 호출
			const response = await request(ctx.app.getHttpServer())
				.patch(`/todo-categories/${user1CategoryId}`)
				.set("Authorization", `Bearer ${user2Token}`)
				.send({ name: "해킹 시도" })
				.expect(404);

			// Then - 404 에러 검증
			expect(response.body.error.code).toBe("TODO_CATEGORY_0851");
		});

		it("다른 사용자의 카테고리 삭제 시 404 에러", async () => {
			// Given - user2가 user1의 카테고리 삭제 시도

			// When - 다른 사용자의 카테고리 삭제 API 호출
			const response = await request(ctx.app.getHttpServer())
				.delete(`/todo-categories/${user1CategoryId}`)
				.set("Authorization", `Bearer ${user2Token}`)
				.expect(404);

			// Then - 404 에러 검증
			expect(response.body.error.code).toBe("TODO_CATEGORY_0851");
		});

		it("같은 이름의 카테고리를 다른 사용자가 각각 생성 가능", async () => {
			// Given - user1이 "운동" 카테고리 생성
			await request(ctx.app.getHttpServer())
				.post("/todo-categories")
				.set("Authorization", `Bearer ${user1Token}`)
				.send({
					name: "운동",
					color: "#00FF00",
				})
				.expect(201);

			// When - user2도 "운동" 카테고리 생성
			const response = await request(ctx.app.getHttpServer())
				.post("/todo-categories")
				.set("Authorization", `Bearer ${user2Token}`)
				.send({
					name: "운동",
					color: "#0000FF",
				})
				.expect(201);

			// Then - 생성 성공 검증
			expect(response.body.data.category.name).toBe("운동");
		});

		it("각 사용자는 자신의 카테고리만 목록에서 조회됨", async () => {
			// Given - 두 사용자 각각 카테고리 보유

			// When - user1의 목록 조회
			const user1List = await request(ctx.app.getHttpServer())
				.get("/todo-categories")
				.set("Authorization", `Bearer ${user1Token}`)
				.expect(200);

			// When - user2의 목록 조회
			const user2List = await request(ctx.app.getHttpServer())
				.get("/todo-categories")
				.set("Authorization", `Bearer ${user2Token}`)
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
