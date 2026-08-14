/**
 * Todo E2E 테스트
 *
 * @description
 * Todo CRUD 전체 플로우 테스트
 * Testcontainers를 사용하여 독립적인 PostgreSQL 환경에서 테스트합니다.
 */

import type { Todo } from "@aido/validators";
import request from "supertest";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers";

describe("할 일 E2E", () => {
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

	describe("Todo CRUD 플로우", () => {
		const testEmail = "todo-test@example.com";
		const testPassword = "Test1234!";

		it("할 일 생성 → 조회 → 수정 → 삭제 전체 플로우", async () => {
			// Given - 인증된 사용자와 기본 카테고리
			const user = await ctx.helpers.createVerifiedUser(testEmail, testPassword);
			const accessToken = user.accessToken;
			const categoryId = await ctx.helpers.getDefaultCategoryId(accessToken);

			// When - 필수 필드만으로 할 일 생성
			const createResponse = await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					title: "테스트 할 일",
					categoryId,
					startDate: "2024-01-15",
				})
				.expect(201);

			// Then - 할 일 생성 성공 검증
			expect(createResponse.body.data.message).toBe("할 일이 생성되었습니다.");
			expect(createResponse.body.data.todo).toMatchObject({
				title: "테스트 할 일",
				startDate: "2024-01-15",
				completed: false,
				isAllDay: true,
				visibility: "PUBLIC",
			});
			expect(createResponse.body.data.todo.id).toBeDefined();
			expect(createResponse.body.data.todo.category).toBeDefined();
			expect(createResponse.body.data.todo.category.id).toBe(categoryId);

			const createdTodoId = createResponse.body.data.todo.id;

			// When - 모든 필드를 포함하여 할 일 생성
			const createAllResponse = await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					title: "운동하기",
					categoryId,
					startDate: "2024-01-20",
					endDate: "2024-01-20",
					scheduledTime: "09:00",
					isAllDay: false,
					visibility: "PRIVATE",
				})
				.expect(201);

			// Then - 모든 필드 검증
			expect(createAllResponse.body.data.todo).toMatchObject({
				title: "운동하기",
				startDate: "2024-01-20",
				endDate: "2024-01-20",
				isAllDay: false,
				visibility: "PRIVATE",
			});
			expect(createAllResponse.body.data.todo.scheduledTime).toBeTruthy();
			expect(createAllResponse.body.data.todo.category).toBeDefined();

			// When - 할 일 목록 조회
			const listResponse = await request(ctx.app.getHttpServer())
				.get("/v1/todos")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then - 목록 검증
			expect(listResponse.body.data.items).toBeDefined();
			expect(Array.isArray(listResponse.body.data.items)).toBe(true);
			expect(listResponse.body.data.items.length).toBeGreaterThan(0);
			expect(listResponse.body.data.pagination).toBeDefined();
			for (const item of listResponse.body.data.items) {
				expect(item.category).toBeDefined();
				expect(item.category.id).toBeDefined();
				expect(item.category.name).toBeDefined();
				expect(item.category.color).toBeDefined();
				expect(item.category.sortOrder).toBeDefined();
			}

			// When - 할 일 상세 조회
			const detailResponse = await request(ctx.app.getHttpServer())
				.get(`/v1/todos/${createdTodoId}`)
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then - 상세 정보 검증
			expect(detailResponse.body.data.id).toBe(createdTodoId);
			expect(detailResponse.body.data.title).toBe("테스트 할 일");
			expect(detailResponse.body.data.category).toBeDefined();

			// When - 제목 수정
			const updateTitleResponse = await request(ctx.app.getHttpServer())
				.patch(`/v1/todos/${createdTodoId}`)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ title: "수정된 할 일" })
				.expect(200);

			// Then - 수정 결과 검증
			expect(updateTitleResponse.body.data.message).toBe("할 일이 수정되었습니다.");
			expect(updateTitleResponse.body.data.todo.title).toBe("수정된 할 일");

			// When - 완료 처리
			const completeResponse = await request(ctx.app.getHttpServer())
				.patch(`/v1/todos/${createdTodoId}`)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ completed: true })
				.expect(200);

			// Then - 완료 상태 검증
			expect(completeResponse.body.data.todo.completed).toBe(true);
			expect(completeResponse.body.data.todo.completedAt).toBeTruthy();

			// When - 완료 취소
			const uncompleteResponse = await request(ctx.app.getHttpServer())
				.patch(`/v1/todos/${createdTodoId}`)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ completed: false })
				.expect(200);

			// Then - 미완료 상태 검증
			expect(uncompleteResponse.body.data.todo.completed).toBe(false);
			expect(uncompleteResponse.body.data.todo.completedAt).toBeNull();

			// When - 여러 필드 동시 수정
			const updateMultiResponse = await request(ctx.app.getHttpServer())
				.patch(`/v1/todos/${createdTodoId}`)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ title: "최종 수정된 제목" })
				.expect(200);

			// Then - 수정 결과 검증
			expect(updateMultiResponse.body.data.todo.title).toBe("최종 수정된 제목");

			// When - 할 일 삭제
			const deleteResponse = await request(ctx.app.getHttpServer())
				.delete(`/v1/todos/${createdTodoId}`)
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then - 삭제 성공 검증
			expect(deleteResponse.body.data.message).toBe("할 일이 삭제되었습니다.");

			// 삭제 확인
			await request(ctx.app.getHttpServer())
				.get(`/v1/todos/${createdTodoId}`)
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(404);
		});

		it("인증 없이 생성 시도 시 401 에러", async () => {
			// Given - 인증 토큰 없음
			const user = await ctx.helpers.createVerifiedUser("todo-401@example.com", testPassword);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

			// When - 인증 없이 할 일 생성 API 호출
			await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.send({
					title: "테스트",
					categoryId,
					startDate: "2024-01-15",
				})
				.expect(401);

			// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
		});

		it("필수 필드 누락 시 400 에러 (categoryId 누락)", async () => {
			// Given - 인증된 사용자
			const user = await ctx.helpers.createVerifiedUser("todo-nocat@example.com", testPassword);

			// When - categoryId 없이 할 일 생성 API 호출
			const response = await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({
					title: "테스트 할 일",
					startDate: "2024-01-15",
				})
				.expect(400);

			// Then - 400 Bad Request 검증
			expect(response.body.success).toBe(false);
		});

		it("필수 필드 누락 시 400 에러 (title 누락)", async () => {
			// Given - 인증된 사용자
			const user = await ctx.helpers.createVerifiedUser("todo-notitle@example.com", testPassword);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

			// When - title 없이 할 일 생성 API 호출
			const response = await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({
					categoryId,
				})
				.expect(400);

			// Then - 400 Bad Request 검증
			expect(response.body.success).toBe(false);
		});

		it("잘못된 날짜 형식 시 400 에러", async () => {
			// Given - 인증된 사용자
			const user = await ctx.helpers.createVerifiedUser("todo-baddate@example.com", testPassword);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

			// When - 잘못된 날짜로 할 일 생성 API 호출
			const response = await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({
					title: "테스트",
					categoryId,
					startDate: "invalid-date",
				})
				.expect(400);

			// Then - 400 Bad Request 검증
			expect(response.body.success).toBe(false);
		});

		it("존재하지 않는 카테고리로 생성 시 404 에러", async () => {
			// Given - 인증된 사용자, 존재하지 않는 카테고리 ID
			const user = await ctx.helpers.createVerifiedUser("todo-nocat404@example.com", testPassword);

			// When - 존재하지 않는 카테고리로 할 일 생성 API 호출
			const response = await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({
					title: "테스트",
					categoryId: 999999,
					startDate: "2024-01-15",
				})
				.expect(404);

			// Then - 404 에러 검증
			expect(response.body.error.code).toBe("TODO_CATEGORY_0851");
		});

		it("페이지 크기 지정하여 조회", async () => {
			// Given - 인증된 사용자와 할 일
			const user = await ctx.helpers.createVerifiedUser("todo-pagesize@example.com", testPassword);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

			await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ title: "테스트 1", categoryId, startDate: "2024-01-15" })
				.expect(201);

			await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ title: "테스트 2", categoryId, startDate: "2024-01-15" })
				.expect(201);

			// When - size 파라미터로 할 일 목록 조회 API 호출
			const response = await request(ctx.app.getHttpServer())
				.get("/v1/todos")
				.query({ size: 1 })
				.set("Authorization", `Bearer ${user.accessToken}`)
				.expect(200);

			// Then - 페이지 크기 검증
			expect(response.body.data.items.length).toBeLessThanOrEqual(1);
			expect(response.body.data.pagination.size).toBe(1);
		});

		it("완료 상태로 필터링", async () => {
			// Given - 인증된 사용자와 미완료 할 일
			const user = await ctx.helpers.createVerifiedUser("todo-filter@example.com", testPassword);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

			await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ title: "미완료 할 일", categoryId, startDate: "2024-01-15" })
				.expect(201);

			// When - completed=false로 할 일 목록 조회 API 호출
			const response = await request(ctx.app.getHttpServer())
				.get("/v1/todos")
				.query({ completed: false })
				.set("Authorization", `Bearer ${user.accessToken}`)
				.expect(200);

			// Then - 미완료 항목만 검증
			for (const item of response.body.data.items) {
				expect(item.completed).toBe(false);
			}
		});

		it("날짜 범위로 필터링", async () => {
			// Given - 인증된 사용자와 할 일
			const user = await ctx.helpers.createVerifiedUser("todo-daterange@example.com", testPassword);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

			await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ title: "1월 할 일", categoryId, startDate: "2024-01-15" })
				.expect(201);

			// When - 날짜 범위로 할 일 목록 조회 API 호출
			const response = await request(ctx.app.getHttpServer())
				.get("/v1/todos")
				.query({ startDate: "2024-01-01", endDate: "2024-01-31" })
				.set("Authorization", `Bearer ${user.accessToken}`)
				.expect(200);

			// Then - 결과 존재 검증
			expect(response.body.data.items).toBeDefined();
		});

		it("다중일 투두가 범위 필터에서 정상 노출된다", async () => {
			// Given - 인증된 사용자와 다중일 투두 생성 (1/15 ~ 1/20)
			const user = await ctx.helpers.createVerifiedUser("todo-multiday@example.com", testPassword);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

			await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({
					title: "다중일 할 일",
					categoryId,
					startDate: "2024-01-15",
					endDate: "2024-01-20",
				})
				.expect(201);

			// When - 1/18로 필터
			const response = await request(ctx.app.getHttpServer())
				.get("/v1/todos")
				.query({ startDate: "2024-01-18", endDate: "2024-01-18" })
				.set("Authorization", `Bearer ${user.accessToken}`)
				.expect(200);

			// Then - 다중일 투두 포함 확인
			const titles = response.body.data.items.map((t: Todo) => t.title);
			expect(titles).toContain("다중일 할 일");
		});

		it("특정 하루(2월 1일)만 조회할 수 있다", async () => {
			// Given - 인증된 사용자와 2월 1일, 2일 투두 생성
			const user = await ctx.helpers.createVerifiedUser("todo-singleday@example.com", testPassword);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

			await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ title: "2월1일 단건", categoryId, startDate: "2024-02-01" })
				.expect(201);

			await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ title: "2월2일 단건", categoryId, startDate: "2024-02-02" })
				.expect(201);

			// When - 2월 1일만 조회
			const response = await request(ctx.app.getHttpServer())
				.get("/v1/todos")
				.query({ startDate: "2024-02-01", endDate: "2024-02-01" })
				.set("Authorization", `Bearer ${user.accessToken}`)
				.expect(200);

			// Then - 2월 1일 투두만 포함 검증
			const titles = response.body.data.items.map((t: Todo) => t.title);
			expect(titles).toContain("2월1일 단건");
			expect(titles).not.toContain("2월2일 단건");
		});

		it("기간(2월 2일~2월 3일) 조회가 가능하다", async () => {
			// Given - 인증된 사용자와 2월 2일, 3일, 4일 투두 생성
			const user = await ctx.helpers.createVerifiedUser("todo-period@example.com", testPassword);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

			await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ title: "2월2일 포함", categoryId, startDate: "2024-02-02" })
				.expect(201);

			await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ title: "2월3일 포함", categoryId, startDate: "2024-02-03" })
				.expect(201);

			await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ title: "2월4일 제외", categoryId, startDate: "2024-02-04" })
				.expect(201);

			// When - 2월 2일~3일 기간 조회
			const response = await request(ctx.app.getHttpServer())
				.get("/v1/todos")
				.query({ startDate: "2024-02-02", endDate: "2024-02-03" })
				.set("Authorization", `Bearer ${user.accessToken}`)
				.expect(200);

			// Then - 범위 내 투두만 포함 검증
			const titles = response.body.data.items.map((t: Todo) => t.title);
			expect(titles).toContain("2월2일 포함");
			expect(titles).toContain("2월3일 포함");
			expect(titles).not.toContain("2월4일 제외");
		});

		it("카테고리로 필터링", async () => {
			// Given - 인증된 사용자와 카테고리별 할 일
			const user = await ctx.helpers.createVerifiedUser("todo-catfilter@example.com", testPassword);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

			await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({
					title: "카테고리 필터 테스트",
					categoryId,
					startDate: "2024-01-15",
				})
				.expect(201);

			// When - categoryId로 할 일 목록 조회 API 호출
			const response = await request(ctx.app.getHttpServer())
				.get("/v1/todos")
				.query({ categoryId })
				.set("Authorization", `Bearer ${user.accessToken}`)
				.expect(200);

			// Then - 해당 카테고리 투두만 검증
			for (const item of response.body.data.items) {
				expect(item.category.id).toBe(categoryId);
			}
		});

		it("인증 없이 조회 시도 시 401 에러", async () => {
			// Given - 인증 토큰 없음

			// When - 인증 없이 할 일 목록 조회 API 호출
			await request(ctx.app.getHttpServer()).get("/v1/todos").expect(401);

			// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
		});

		it("존재하지 않는 ID로 조회 시 404 에러", async () => {
			// Given - 인증된 사용자, 존재하지 않는 할 일 ID
			const user = await ctx.helpers.createVerifiedUser("todo-get404@example.com", testPassword);

			// When - 존재하지 않는 ID로 조회 API 호출
			const response = await request(ctx.app.getHttpServer())
				.get("/v1/todos/999999")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.expect(404);

			// Then - 404 에러 검증
			expect(response.body.success).toBe(false);
			expect(response.body.error.code).toBe("TODO_0801");
		});

		it("존재하지 않는 ID로 수정 시 404 에러", async () => {
			// Given - 인증된 사용자
			const user = await ctx.helpers.createVerifiedUser("todo-patch404@example.com", testPassword);

			// When - 존재하지 않는 ID로 수정 API 호출
			const response = await request(ctx.app.getHttpServer())
				.patch("/v1/todos/999999")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ title: "수정" })
				.expect(404);

			// Then - 404 에러 검증
			expect(response.body.error.code).toBe("TODO_0801");
		});

		it("존재하지 않는 ID로 삭제 시 404 에러", async () => {
			// Given - 인증된 사용자
			const user = await ctx.helpers.createVerifiedUser("todo-del404@example.com", testPassword);

			// When - 존재하지 않는 ID로 삭제 API 호출
			const response = await request(ctx.app.getHttpServer())
				.delete("/v1/todos/999999")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.expect(404);

			// Then - 404 에러 검증
			expect(response.body.error.code).toBe("TODO_0801");
		});
	});

	describe("완료 상태 토글", () => {
		const testPassword = "Test1234!";

		it("미완료 상태에서 완료 처리 성공", async () => {
			// Given - 인증된 사용자와 미완료 Todo 생성
			const user = await ctx.helpers.createVerifiedUser("todo-complete@example.com", testPassword);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

			const createResponse = await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({
					title: "완료 테스트용 할 일",
					categoryId,
					startDate: "2024-01-15",
				})
				.expect(201);
			const todoId = createResponse.body.data.todo.id;

			// When - 완료 처리
			const response = await request(ctx.app.getHttpServer())
				.patch(`/v1/todos/${todoId}/complete`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ completed: true })
				.expect(200);

			// Then - 완료 상태 검증
			expect(response.body.data.todo.completed).toBe(true);
			expect(response.body.data.todo.completedAt).toBeTruthy();
		});

		it("완료 상태에서 미완료 처리 성공", async () => {
			// Given - 인증된 사용자와 완료된 Todo
			const user = await ctx.helpers.createVerifiedUser(
				"todo-uncomplete@example.com",
				testPassword,
			);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

			const createResponse = await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({
					title: "완료 취소 테스트용",
					categoryId,
					startDate: "2024-01-15",
				})
				.expect(201);
			const todoId = createResponse.body.data.todo.id;

			// 먼저 완료 처리
			await request(ctx.app.getHttpServer())
				.patch(`/v1/todos/${todoId}/complete`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ completed: true })
				.expect(200);

			// When - 미완료 처리
			const response = await request(ctx.app.getHttpServer())
				.patch(`/v1/todos/${todoId}/complete`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ completed: false })
				.expect(200);

			// Then - 미완료 상태 검증
			expect(response.body.data.todo.completed).toBe(false);
			expect(response.body.data.todo.completedAt).toBeNull();
		});

		it("존재하지 않는 Todo는 404 에러", async () => {
			// Given - 인증된 사용자
			const user = await ctx.helpers.createVerifiedUser(
				"todo-complete-404@example.com",
				testPassword,
			);

			// When - 존재하지 않는 ID로 완료 처리 API 호출
			const response = await request(ctx.app.getHttpServer())
				.patch("/v1/todos/999999/complete")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ completed: true })
				.expect(404);

			// Then - 404 에러 검증
			expect(response.body.error.code).toBe("TODO_0801");
		});

		it("completed 필드 누락 시 400 에러", async () => {
			// Given - 인증된 사용자와 할 일
			const user = await ctx.helpers.createVerifiedUser(
				"todo-complete-400@example.com",
				testPassword,
			);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

			const createResponse = await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ title: "테스트", categoryId, startDate: "2024-01-15" })
				.expect(201);
			const todoId = createResponse.body.data.todo.id;

			// When - completed 필드 없이 완료 처리 API 호출
			await request(ctx.app.getHttpServer())
				.patch(`/v1/todos/${todoId}/complete`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({})
				.expect(400);

			// Then - 400 Bad Request 응답 확인 (expect에서 검증)
		});
	});

	describe("공개 범위 변경", () => {
		const testPassword = "Test1234!";

		it("PUBLIC에서 PRIVATE으로 변경 성공", async () => {
			// Given - 인증된 사용자와 PUBLIC Todo
			const user = await ctx.helpers.createVerifiedUser("todo-vis-priv@example.com", testPassword);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

			const createResponse = await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({
					title: "공개 범위 테스트",
					categoryId,
					startDate: "2024-01-15",
					visibility: "PUBLIC",
				})
				.expect(201);
			const todoId = createResponse.body.data.todo.id;

			// When - PRIVATE으로 변경
			const response = await request(ctx.app.getHttpServer())
				.patch(`/v1/todos/${todoId}/visibility`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ visibility: "PRIVATE" })
				.expect(200);

			// Then - 변경 결과 검증
			expect(response.body.data.todo.visibility).toBe("PRIVATE");
		});

		it("PRIVATE에서 PUBLIC으로 변경 성공", async () => {
			// Given - 인증된 사용자와 PRIVATE Todo
			const user = await ctx.helpers.createVerifiedUser("todo-vis-pub@example.com", testPassword);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

			const createResponse = await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({
					title: "비공개 할 일",
					categoryId,
					startDate: "2024-01-15",
					visibility: "PRIVATE",
				})
				.expect(201);
			const todoId = createResponse.body.data.todo.id;

			// When - PUBLIC으로 변경
			const response = await request(ctx.app.getHttpServer())
				.patch(`/v1/todos/${todoId}/visibility`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ visibility: "PUBLIC" })
				.expect(200);

			// Then - 변경 결과 검증
			expect(response.body.data.todo.visibility).toBe("PUBLIC");
		});

		it("잘못된 visibility 값은 400 에러", async () => {
			// Given - 인증된 사용자와 할 일
			const user = await ctx.helpers.createVerifiedUser(
				"todo-vis-invalid@example.com",
				testPassword,
			);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

			const createResponse = await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ title: "테스트", categoryId, startDate: "2024-01-15" })
				.expect(201);
			const todoId = createResponse.body.data.todo.id;

			// When - 잘못된 visibility 값으로 변경 API 호출
			await request(ctx.app.getHttpServer())
				.patch(`/v1/todos/${todoId}/visibility`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ visibility: "INVALID" })
				.expect(400);

			// Then - 400 Bad Request 응답 확인 (expect에서 검증)
		});
	});

	describe("카테고리 변경", () => {
		const testPassword = "Test1234!";

		it("카테고리 변경 성공", async () => {
			// Given - 인증된 사용자, 두 번째 카테고리 생성
			const user = await ctx.helpers.createVerifiedUser("todo-catchange@example.com", testPassword);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

			const catResponse = await request(ctx.app.getHttpServer())
				.post("/v1/todo-categories")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ name: "새 카테고리", color: "#00FF00" })
				.expect(201);
			const secondCategoryId = catResponse.body.data.category.id;

			const createResponse = await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({
					title: "카테고리 변경 테스트",
					categoryId,
					startDate: "2024-01-15",
				})
				.expect(201);
			const todoId = createResponse.body.data.todo.id;

			// When - 카테고리 변경 API 호출
			const response = await request(ctx.app.getHttpServer())
				.patch(`/v1/todos/${todoId}/category`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ categoryId: secondCategoryId })
				.expect(200);

			// Then - 변경 결과 검증
			expect(response.body.data.todo.category.id).toBe(secondCategoryId);
		});

		it("존재하지 않는 카테고리는 404 에러", async () => {
			// Given - 인증된 사용자와 할 일
			const user = await ctx.helpers.createVerifiedUser(
				"todo-catchange-404@example.com",
				testPassword,
			);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

			const createResponse = await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ title: "테스트", categoryId, startDate: "2024-01-15" })
				.expect(201);
			const todoId = createResponse.body.data.todo.id;

			// When - 존재하지 않는 카테고리로 변경 API 호출
			const response = await request(ctx.app.getHttpServer())
				.patch(`/v1/todos/${todoId}/category`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ categoryId: 999999 })
				.expect(404);

			// Then - 404 에러 검증
			expect(response.body.error.code).toBe("TODO_CATEGORY_0851");
		});
	});

	describe("일정 변경", () => {
		const testPassword = "Test1234!";

		it("일정 변경 성공 (종일 이벤트)", async () => {
			// Given - 인증된 사용자와 할 일
			const user = await ctx.helpers.createVerifiedUser(
				"todo-sched-allday@example.com",
				testPassword,
			);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

			const createResponse = await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ title: "일정 테스트", categoryId, startDate: "2024-01-15" })
				.expect(201);
			const todoId = createResponse.body.data.todo.id;

			// When - 종일 일정으로 변경 API 호출
			const response = await request(ctx.app.getHttpServer())
				.patch(`/v1/todos/${todoId}/schedule`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({
					startDate: "2024-02-01",
					endDate: "2024-02-02",
					isAllDay: true,
				})
				.expect(200);

			// Then - 일정 변경 검증
			expect(response.body.data.todo.startDate).toBe("2024-02-01");
			expect(response.body.data.todo.endDate).toBe("2024-02-02");
			expect(response.body.data.todo.isAllDay).toBe(true);
		});

		it("일정 변경 성공 (시간 지정)", async () => {
			// Given - 인증된 사용자와 할 일
			const user = await ctx.helpers.createVerifiedUser(
				"todo-sched-time@example.com",
				testPassword,
			);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

			const createResponse = await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ title: "시간 테스트", categoryId, startDate: "2024-01-15" })
				.expect(201);
			const todoId = createResponse.body.data.todo.id;

			// When - 시간 지정 일정으로 변경 API 호출
			const response = await request(ctx.app.getHttpServer())
				.patch(`/v1/todos/${todoId}/schedule`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({
					startDate: "2024-02-15",
					scheduledTime: "14:30",
					isAllDay: false,
				})
				.expect(200);

			// Then - 일정 변경 검증
			expect(response.body.data.todo.startDate).toBe("2024-02-15");
			expect(response.body.data.todo.isAllDay).toBe(false);
			expect(response.body.data.todo.scheduledTime).toBeTruthy();
		});

		it("startDate 필드 누락 시 400 에러", async () => {
			// Given - 인증된 사용자와 할 일
			const user = await ctx.helpers.createVerifiedUser(
				"todo-sched-nostart@example.com",
				testPassword,
			);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

			const createResponse = await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ title: "테스트", categoryId, startDate: "2024-01-15" })
				.expect(201);
			const todoId = createResponse.body.data.todo.id;

			// When - startDate 없이 일정 변경 API 호출
			await request(ctx.app.getHttpServer())
				.patch(`/v1/todos/${todoId}/schedule`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ endDate: "2024-02-01" })
				.expect(400);

			// Then - 400 Bad Request 응답 확인 (expect에서 검증)
		});

		it("endDate가 startDate보다 이전이면 400 에러", async () => {
			// Given - 인증된 사용자와 할 일
			const user = await ctx.helpers.createVerifiedUser(
				"todo-sched-badrange@example.com",
				testPassword,
			);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

			const createResponse = await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ title: "테스트", categoryId, startDate: "2024-01-15" })
				.expect(201);
			const todoId = createResponse.body.data.todo.id;

			// When - endDate < startDate로 일정 변경 API 호출
			await request(ctx.app.getHttpServer())
				.patch(`/v1/todos/${todoId}/schedule`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ startDate: "2024-02-15", endDate: "2024-02-10" })
				.expect(400);

			// Then - 400 Bad Request 응답 확인 (expect에서 검증)
		});
	});

	describe("제목 수정 (SRP 엔드포인트)", () => {
		const testPassword = "Test1234!";

		it("제목 수정 성공", async () => {
			// Given - 인증된 사용자와 할 일
			const user = await ctx.helpers.createVerifiedUser(
				"todo-title-update@example.com",
				testPassword,
			);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

			const createResponse = await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ title: "원래 제목", categoryId, startDate: "2024-01-15" })
				.expect(201);
			const todoId = createResponse.body.data.todo.id;

			// When - 제목 수정 API 호출
			const response = await request(ctx.app.getHttpServer())
				.patch(`/v1/todos/${todoId}/title`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ title: "SRP로 수정된 제목" })
				.expect(200);

			// Then - 수정 결과 검증
			expect(response.body.data.todo.title).toBe("SRP로 수정된 제목");
		});

		it("빈 요청은 400 에러", async () => {
			// Given - 인증된 사용자와 할 일
			const user = await ctx.helpers.createVerifiedUser(
				"todo-title-empty@example.com",
				testPassword,
			);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

			const createResponse = await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ title: "테스트", categoryId, startDate: "2024-01-15" })
				.expect(201);
			const todoId = createResponse.body.data.todo.id;

			// When - 빈 요청으로 수정 API 호출
			await request(ctx.app.getHttpServer())
				.patch(`/v1/todos/${todoId}/title`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({})
				.expect(400);

			// Then - 400 Bad Request 응답 확인 (expect에서 검증)
		});

		it("제목이 200자 초과하면 400 에러", async () => {
			// Given - 인증된 사용자와 할 일
			const user = await ctx.helpers.createVerifiedUser(
				"todo-title-long@example.com",
				testPassword,
			);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

			const createResponse = await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ title: "테스트", categoryId, startDate: "2024-01-15" })
				.expect(201);
			const todoId = createResponse.body.data.todo.id;

			// When - 긴 제목으로 수정 API 호출
			await request(ctx.app.getHttpServer())
				.patch(`/v1/todos/${todoId}/title`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ title: "a".repeat(201) })
				.expect(400);

			// Then - 400 Bad Request 응답 확인 (expect에서 검증)
		});
	});

	describe("순서 변경", () => {
		const testPassword = "Test1234!";

		it("특정 Todo 앞/뒤로 이동 및 맨 앞으로 이동 성공", async () => {
			// Given - 인증된 사용자와 3개의 할 일
			const user = await ctx.helpers.createVerifiedUser("todo-reorder@example.com", testPassword);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

			const res1 = await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ title: "순서 테스트 1", categoryId, startDate: "2024-03-01" })
				.expect(201);
			const todo1Id = res1.body.data.todo.id;

			const res2 = await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ title: "순서 테스트 2", categoryId, startDate: "2024-03-01" })
				.expect(201);
			const todo2Id = res2.body.data.todo.id;

			const res3 = await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ title: "순서 테스트 3", categoryId, startDate: "2024-03-01" })
				.expect(201);
			const todo3Id = res3.body.data.todo.id;

			// When - todo3를 todo1 앞으로 이동 (before)
			const beforeResponse = await request(ctx.app.getHttpServer())
				.patch(`/v1/todos/${todo3Id}/reorder`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ targetTodoId: todo1Id, position: "before" })
				.expect(200);

			// Then - 이동 성공 검증
			expect(beforeResponse.body.data.message).toBe("할 일 순서가 변경되었습니다.");
			expect(beforeResponse.body.data.todo.id).toBe(todo3Id);

			// When - todo1을 todo2 뒤로 이동 (after)
			const afterResponse = await request(ctx.app.getHttpServer())
				.patch(`/v1/todos/${todo1Id}/reorder`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ targetTodoId: todo2Id, position: "after" })
				.expect(200);

			// Then - 이동 성공 검증
			expect(afterResponse.body.data.todo.id).toBe(todo1Id);

			// When - todo2를 맨 앞으로 이동 (targetTodoId 없이 before)
			const firstResponse = await request(ctx.app.getHttpServer())
				.patch(`/v1/todos/${todo2Id}/reorder`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ position: "before" })
				.expect(200);

			// Then - sortOrder 0 검증
			expect(firstResponse.body.data.todo.sortOrder).toBe(0);
		});

		it("존재하지 않는 Todo로 이동 시도 시 404 에러", async () => {
			// Given - 인증된 사용자와 할 일
			const user = await ctx.helpers.createVerifiedUser(
				"todo-reorder-404@example.com",
				testPassword,
			);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

			const res = await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ title: "순서 테스트", categoryId, startDate: "2024-03-01" })
				.expect(201);
			const todoId = res.body.data.todo.id;

			// When - 존재하지 않는 Todo로 이동 API 호출
			const response = await request(ctx.app.getHttpServer())
				.patch(`/v1/todos/${todoId}/reorder`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ targetTodoId: 999999, position: "before" })
				.expect(404);

			// Then - 404 에러 검증
			expect(response.body.error.code).toBe("TODO_0810");
		});
	});

	describe("사용자 격리 테스트", () => {
		const testPassword = "Test1234!";

		it("다른 사용자의 할 일에 접근/수정/삭제 시 404 에러", async () => {
			// Given - 두 명의 사용자 생성
			const user1 = await ctx.helpers.createVerifiedUser("user1@example.com", testPassword);
			const user2 = await ctx.helpers.createVerifiedUser("user2@example.com", testPassword);
			const user1CategoryId = await ctx.helpers.getDefaultCategoryId(user1.accessToken);

			const response = await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user1.accessToken}`)
				.send({
					title: "User1의 할 일",
					categoryId: user1CategoryId,
					startDate: "2024-02-01",
				})
				.expect(201);
			const user1TodoId = response.body.data.todo.id;

			// When/Then - 다른 사용자의 할 일 조회 시 404 에러
			const getResponse = await request(ctx.app.getHttpServer())
				.get(`/v1/todos/${user1TodoId}`)
				.set("Authorization", `Bearer ${user2.accessToken}`)
				.expect(404);
			expect(getResponse.body.error.code).toBe("TODO_0801");

			// When/Then - 다른 사용자의 할 일 수정 시 404 에러
			const patchResponse = await request(ctx.app.getHttpServer())
				.patch(`/v1/todos/${user1TodoId}`)
				.set("Authorization", `Bearer ${user2.accessToken}`)
				.send({ title: "해킹 시도" })
				.expect(404);
			expect(patchResponse.body.error.code).toBe("TODO_0801");

			// When/Then - 다른 사용자의 할 일 삭제 시 404 에러
			const deleteResponse = await request(ctx.app.getHttpServer())
				.delete(`/v1/todos/${user1TodoId}`)
				.set("Authorization", `Bearer ${user2.accessToken}`)
				.expect(404);
			expect(deleteResponse.body.error.code).toBe("TODO_0801");
		});

		it("각 사용자는 자신의 할 일만 목록에서 조회됨", async () => {
			// Given - 두 명의 사용자와 각자의 할 일
			const user1 = await ctx.helpers.createVerifiedUser("user1-list@example.com", testPassword);
			const user2 = await ctx.helpers.createVerifiedUser("user2-list@example.com", testPassword);
			const user1CategoryId = await ctx.helpers.getDefaultCategoryId(user1.accessToken);
			const user2CategoryId = await ctx.helpers.getDefaultCategoryId(user2.accessToken);

			await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user1.accessToken}`)
				.send({
					title: "User1의 할 일",
					categoryId: user1CategoryId,
					startDate: "2024-02-01",
				})
				.expect(201);

			await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user2.accessToken}`)
				.send({
					title: "User2의 할 일",
					categoryId: user2CategoryId,
					startDate: "2024-02-01",
				})
				.expect(201);

			// When - user1의 목록 조회
			const user1List = await request(ctx.app.getHttpServer())
				.get("/v1/todos")
				.set("Authorization", `Bearer ${user1.accessToken}`)
				.expect(200);

			// When - user2의 목록 조회
			const user2List = await request(ctx.app.getHttpServer())
				.get("/v1/todos")
				.set("Authorization", `Bearer ${user2.accessToken}`)
				.expect(200);

			// Then - 각 사용자는 자신의 할 일만 볼 수 있음
			const user1Titles = user1List.body.data.items.map((t: Todo) => t.title);
			const user2Titles = user2List.body.data.items.map((t: Todo) => t.title);

			expect(user1Titles).toContain("User1의 할 일");
			expect(user1Titles).not.toContain("User2의 할 일");
			expect(user2Titles).toContain("User2의 할 일");
			expect(user2Titles).not.toContain("User1의 할 일");
		});
	});

	describe("페이지네이션 테스트", () => {
		const testPassword = "Test1234!";

		it("커서 기반 페이지네이션 동작 확인", async () => {
			// Given - 인증된 사용자와 10개의 할 일
			const user = await ctx.helpers.createVerifiedUser("pagination@example.com", testPassword);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

			for (let i = 0; i < 10; i++) {
				await request(ctx.app.getHttpServer())
					.post("/v1/todos")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.send({
						title: `페이지네이션 테스트 ${i + 1}`,
						categoryId,
						startDate: "2024-03-01",
					})
					.expect(201);
			}

			// When - 첫 페이지 조회 (5개)
			const page1 = await request(ctx.app.getHttpServer())
				.get("/v1/todos")
				.query({ size: 5 })
				.set("Authorization", `Bearer ${user.accessToken}`)
				.expect(200);

			// Then - 첫 페이지 검증
			expect(page1.body.data.items.length).toBe(5);
			expect(page1.body.data.pagination.hasNext).toBe(true);
			expect(page1.body.data.pagination.nextCursor).toBeTruthy();

			// When - 두 번째 페이지 조회
			const page2 = await request(ctx.app.getHttpServer())
				.get("/v1/todos")
				.query({ size: 5, cursor: page1.body.data.pagination.nextCursor })
				.set("Authorization", `Bearer ${user.accessToken}`)
				.expect(200);

			// Then - 두 번째 페이지 검증 (중복 없음)
			expect(page2.body.data.items.length).toBe(5);

			const page1Ids = page1.body.data.items.map((t: Todo) => t.id);
			const page2Ids = page2.body.data.items.map((t: Todo) => t.id);

			for (const id of page1Ids) {
				expect(page2Ids).not.toContain(id);
			}
		});
	});

	describe("유효성 검사 테스트", () => {
		const testPassword = "Test1234!";

		it("제목이 200자 초과하면 400 에러", async () => {
			// Given - 인증된 사용자
			const user = await ctx.helpers.createVerifiedUser(
				"validation-title@example.com",
				testPassword,
			);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

			// When - 긴 제목으로 할 일 생성 API 호출
			const response = await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ title: "a".repeat(201), categoryId, startDate: "2024-01-15" })
				.expect(400);

			// Then - 400 Bad Request 검증
			expect(response.body.success).toBe(false);
		});

		it("잘못된 visibility 값은 400 에러", async () => {
			// Given - 인증된 사용자
			const user = await ctx.helpers.createVerifiedUser("validation-vis@example.com", testPassword);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

			// When - 잘못된 visibility로 할 일 생성 API 호출
			const response = await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({
					title: "테스트",
					categoryId,
					startDate: "2024-01-15",
					visibility: "INVALID",
				})
				.expect(400);

			// Then - 400 Bad Request 검증
			expect(response.body.success).toBe(false);
		});

		it("잘못된 scheduledTime 형식은 400 에러", async () => {
			// Given - 인증된 사용자
			const user = await ctx.helpers.createVerifiedUser(
				"validation-time@example.com",
				testPassword,
			);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

			// When - 잘못된 시간으로 할 일 생성 API 호출
			const response = await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({
					title: "테스트",
					categoryId,
					startDate: "2024-01-15",
					scheduledTime: "25:00",
				})
				.expect(400);

			// Then - 400 Bad Request 검증
			expect(response.body.success).toBe(false);
		});
	});

	describe("반복 할 일 생성", () => {
		const testPassword = "Test1234!";

		it("필수 필드로 반복 할 일 생성 후 조회 및 독립 완료 처리", async () => {
			// Given - 인증된 사용자와 기본 카테고리
			const user = await ctx.helpers.createVerifiedUser("recurring-test@example.com", testPassword);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

			// When - 반복 할 일 생성 API 호출 (2026-03-02~2026-03-08, 월수금)
			const response = await request(ctx.app.getHttpServer())
				.post("/v1/todos/recurring")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({
					title: "반복 할 일 테스트",
					categoryId,
					startDate: "2026-03-02",
					endDate: "2026-03-08",
					daysOfWeek: ["MON", "WED", "FRI"],
				})
				.expect(201);

			// Then - 반복 할 일 생성 성공 검증
			expect(response.body.data.count).toBe(3);
			expect(response.body.data.todos).toHaveLength(3);
			expect(response.body.data.message).toContain("3개");

			for (const todo of response.body.data.todos) {
				expect(todo.title).toBe("반복 할 일 테스트");
				expect(todo.completed).toBe(false);
				expect(todo.recurrenceGroupId).toBeTruthy();
				expect(todo.category.id).toBe(categoryId);
			}

			const groupIds = new Set(response.body.data.todos.map((t: Todo) => t.recurrenceGroupId));
			expect(groupIds.size).toBe(1);

			// When - 생성된 반복 할 일이 GET /todos로 조회
			const listResponse = await request(ctx.app.getHttpServer())
				.get("/v1/todos")
				.query({ startDate: "2026-03-02", endDate: "2026-03-08" })
				.set("Authorization", `Bearer ${user.accessToken}`)
				.expect(200);

			// Then - 반복 할 일이 조회됨
			const recurringTodos = listResponse.body.data.items.filter(
				(t: Todo) => t.recurrenceGroupId !== null,
			);
			expect(recurringTodos.length).toBe(3);

			// When - 첫 번째만 완료 처리
			const firstTodoId = recurringTodos[0].id;
			const secondTodoId = recurringTodos[1].id;

			await request(ctx.app.getHttpServer())
				.patch(`/v1/todos/${firstTodoId}/complete`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ completed: true })
				.expect(200);

			// Then - 첫 번째만 완료, 나머지는 미완료
			const firstTodo = await request(ctx.app.getHttpServer())
				.get(`/v1/todos/${firstTodoId}`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.expect(200);
			expect(firstTodo.body.data.completed).toBe(true);

			const secondTodo = await request(ctx.app.getHttpServer())
				.get(`/v1/todos/${secondTodoId}`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.expect(200);
			expect(secondTodo.body.data.completed).toBe(false);
		});

		it("잘못된 요일 값은 400 에러", async () => {
			// Given - 인증된 사용자
			const user = await ctx.helpers.createVerifiedUser(
				"recurring-badday@example.com",
				testPassword,
			);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

			// When - 잘못된 요일로 반복 할 일 생성
			const response = await request(ctx.app.getHttpServer())
				.post("/v1/todos/recurring")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({
					title: "잘못된 요일",
					categoryId,
					startDate: "2026-03-01",
					endDate: "2026-03-31",
					daysOfWeek: ["INVALID"],
				})
				.expect(400);

			// Then - 400 Bad Request 검증
			expect(response.body.success).toBe(false);
		});

		it("startDate > endDate이면 400 에러", async () => {
			// Given - 인증된 사용자
			const user = await ctx.helpers.createVerifiedUser(
				"recurring-badrange@example.com",
				testPassword,
			);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

			// When - 잘못된 날짜 범위로 반복 할 일 생성
			const response = await request(ctx.app.getHttpServer())
				.post("/v1/todos/recurring")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({
					title: "잘못된 범위",
					categoryId,
					startDate: "2026-03-31",
					endDate: "2026-03-01",
					daysOfWeek: ["MON"],
				})
				.expect(400);

			// Then - 400 Bad Request 검증
			expect(response.body.success).toBe(false);
		});

		it("인증 없이 요청 시 401 에러", async () => {
			// Given - 인증 토큰 없음

			// When - 인증 없이 반복 할 일 생성
			await request(ctx.app.getHttpServer())
				.post("/v1/todos/recurring")
				.send({
					title: "인증 없음",
					categoryId: 1,
					startDate: "2026-03-01",
					endDate: "2026-03-31",
					daysOfWeek: ["MON"],
				})
				.expect(401);

			// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
		});
	});

	describe("카테고리 순서 기반 정렬 테스트", () => {
		const testPassword = "Test1234!";

		it("categoryId 없이 조회 시 category.sortOrder -> todo.sortOrder -> id 순으로 정렬된다", async () => {
			// Given - 인증된 사용자와 카테고리별 할 일
			const user = await ctx.helpers.createVerifiedUser("sort-test@example.com", testPassword);
			const accessToken = user.accessToken;

			const catResponse = await request(ctx.app.getHttpServer())
				.get("/v1/todo-categories")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			const defaultCategories = catResponse.body.data.items;
			const category1Id = defaultCategories[0].id;
			const category2Id = defaultCategories[1].id;

			const cat3Response = await request(ctx.app.getHttpServer())
				.post("/v1/todo-categories")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ name: "공부", color: "#0000FF" })
				.expect(201);
			const category3Id = cat3Response.body.data.category.id;

			// 카테고리별 할 일 생성
			await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					title: "공부-할일1",
					categoryId: category3Id,
					startDate: "2024-06-01",
				})
				.expect(201);

			await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					title: "공부-할일2",
					categoryId: category3Id,
					startDate: "2024-06-01",
				})
				.expect(201);

			await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					title: "중요-할일1",
					categoryId: category1Id,
					startDate: "2024-06-01",
				})
				.expect(201);

			await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					title: "중요-할일2",
					categoryId: category1Id,
					startDate: "2024-06-01",
				})
				.expect(201);

			await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					title: "할일-할일1",
					categoryId: category2Id,
					startDate: "2024-06-01",
				})
				.expect(201);

			// When - 할 일 목록 조회
			const response = await request(ctx.app.getHttpServer())
				.get("/v1/todos")
				.query({ startDate: "2024-06-01", endDate: "2024-06-01" })
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then - 카테고리 sortOrder 순 정렬 검증
			const items = response.body.data.items;
			expect(items.length).toBe(5);

			expect(items[0].category.id).toBe(category1Id);
			expect(items[1].category.id).toBe(category1Id);
			expect(items[2].category.id).toBe(category2Id);
			expect(items[3].category.id).toBe(category3Id);
			expect(items[4].category.id).toBe(category3Id);

			expect(items[0].sortOrder).toBeLessThanOrEqual(items[1].sortOrder);
			expect(items[3].sortOrder).toBeLessThanOrEqual(items[4].sortOrder);
		});

		it("각 todo의 category 객체에 sortOrder 필드가 포함된다", async () => {
			// Given - 인증된 사용자와 카테고리별 할 일
			const user = await ctx.helpers.createVerifiedUser("sort-field@example.com", testPassword);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

			await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ title: "테스트", categoryId, startDate: "2024-06-01" })
				.expect(201);

			// When - 할 일 목록 조회
			const response = await request(ctx.app.getHttpServer())
				.get("/v1/todos")
				.query({ startDate: "2024-06-01", endDate: "2024-06-01" })
				.set("Authorization", `Bearer ${user.accessToken}`)
				.expect(200);

			// Then - sortOrder 필드 포함 검증
			for (const item of response.body.data.items) {
				expect(typeof item.category.sortOrder).toBe("number");
			}
		});

		it("페이지네이션 시 카테고리 순서가 유지된다", async () => {
			// Given - 인증된 사용자와 여러 카테고리의 할 일
			const user = await ctx.helpers.createVerifiedUser("sort-page@example.com", testPassword);
			const accessToken = user.accessToken;

			const catResponse = await request(ctx.app.getHttpServer())
				.get("/v1/todo-categories")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			const category1Id = catResponse.body.data.items[0].id;
			const category2Id = catResponse.body.data.items[1].id;

			await request(ctx.app.getHttpServer())
				.post("/v1/todo-categories")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ name: "공부", color: "#0000FF" })
				.expect(201);

			// 5개의 할 일 생성
			for (let i = 0; i < 3; i++) {
				await request(ctx.app.getHttpServer())
					.post("/v1/todos")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						title: `할일 ${i}`,
						categoryId: category1Id,
						startDate: "2024-06-01",
					})
					.expect(201);
			}
			for (let i = 0; i < 2; i++) {
				await request(ctx.app.getHttpServer())
					.post("/v1/todos")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						title: `할일 ${i + 3}`,
						categoryId: category2Id,
						startDate: "2024-06-01",
					})
					.expect(201);
			}

			// When - 첫 페이지 (3개)
			const page1 = await request(ctx.app.getHttpServer())
				.get("/v1/todos")
				.query({ startDate: "2024-06-01", endDate: "2024-06-01", size: 3 })
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then - 첫 페이지 검증
			expect(page1.body.data.items.length).toBe(3);
			expect(page1.body.data.pagination.hasNext).toBe(true);

			// When - 두 번째 페이지
			const page2 = await request(ctx.app.getHttpServer())
				.get("/v1/todos")
				.query({
					startDate: "2024-06-01",
					endDate: "2024-06-01",
					size: 3,
					cursor: page1.body.data.pagination.nextCursor,
				})
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then - 페이지 간 카테고리 순서 유지 검증
			const page1Last = page1.body.data.items[page1.body.data.items.length - 1];
			const page2First = page2.body.data.items[0];
			expect(page1Last.category.sortOrder).toBeLessThanOrEqual(page2First.category.sortOrder);
		});

		it("카테고리 reorder 후 조회하면 새 순서가 반영된다", async () => {
			// Given - 인증된 사용자와 카테고리별 할 일
			const user = await ctx.helpers.createVerifiedUser("sort-reorder@example.com", testPassword);
			const accessToken = user.accessToken;

			const catResponse = await request(ctx.app.getHttpServer())
				.get("/v1/todo-categories")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			const category1Id = catResponse.body.data.items[0].id;

			const cat3Response = await request(ctx.app.getHttpServer())
				.post("/v1/todo-categories")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ name: "공부", color: "#0000FF" })
				.expect(201);
			const category3Id = cat3Response.body.data.category.id;

			await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					title: "공부-할일",
					categoryId: category3Id,
					startDate: "2024-06-01",
				})
				.expect(201);

			await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					title: "중요-할일",
					categoryId: category1Id,
					startDate: "2024-06-01",
				})
				.expect(201);

			// When - 카테고리3(공부)를 카테고리1(중요한 일) 앞으로 이동
			await request(ctx.app.getHttpServer())
				.patch(`/v1/todo-categories/${category3Id}/reorder`)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ targetCategoryId: category1Id, position: "before" })
				.expect(200);

			// When - 할 일 목록 조회
			const response = await request(ctx.app.getHttpServer())
				.get("/v1/todos")
				.query({ startDate: "2024-06-01", endDate: "2024-06-01" })
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			const items = response.body.data.items;

			// Then - 카테고리3(공부)의 할 일이 카테고리1(중요한 일) 할 일보다 먼저 나옴
			const firstCat3Index = items.findIndex((t: Todo) => t.category.id === category3Id);
			const firstCat1Index = items.findIndex((t: Todo) => t.category.id === category1Id);

			expect(firstCat3Index).toBeLessThan(firstCat1Index);
		});
	});

	describe("하위 항목 (체크리스트) 플로우", () => {
		const testPassword = "Test1234!";

		it("인라인 체크리스트 생성 → 추가 → 수정 → 삭제 → 순서 변경 전체 플로우", async () => {
			// Given - 인증된 사용자와 카테고리
			const user = await ctx.helpers.createVerifiedUser("todo-item-test@example.com", testPassword);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);
			const accessToken = user.accessToken;

			// When - items 배열과 함께 할 일 생성
			const createResponse = await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					title: "배포 준비",
					categoryId,
					startDate: "2024-06-15",
					items: [{ title: "체인지로그" }, { title: "빌드" }, { title: "심사" }],
				})
				.expect(201);

			// Then - items와 itemStats가 올바르게 포함
			expect(createResponse.body.data.todo.items).toHaveLength(3);
			expect(createResponse.body.data.todo.itemStats).toEqual({
				total: 3,
				completed: 0,
			});

			// When - items 없이 생성 시
			const noItemsResponse = await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					title: "items 없는 할 일",
					categoryId,
					startDate: "2024-06-16",
				})
				.expect(201);

			// Then - 빈 items 배열과 초기 itemStats
			expect(noItemsResponse.body.data.todo.items).toEqual([]);
			expect(noItemsResponse.body.data.todo.itemStats).toEqual({
				total: 0,
				completed: 0,
			});

			// Given - 부모 Todo 생성
			const parentRes = await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ title: "부모 할 일", categoryId, startDate: "2024-06-01" })
				.expect(201);
			const parentTodoId = parentRes.body.data.todo.id;

			// When - 하위 항목 추가
			const addResponse = await request(ctx.app.getHttpServer())
				.post(`/v1/todos/${parentTodoId}/items`)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ title: "새 하위 항목" })
				.expect(201);

			// Then - 하위 항목이 추가되고 completed=false
			expect(addResponse.body.data.todo.items.length).toBeGreaterThanOrEqual(1);
			const addedItem = addResponse.body.data.todo.items.find(
				(i: { title: string }) => i.title === "새 하위 항목",
			);
			expect(addedItem).toBeDefined();
			expect(addedItem.completed).toBe(false);

			// When - 하위 항목 추가 (토글 테스트용)
			const toggleAddRes = await request(ctx.app.getHttpServer())
				.post(`/v1/todos/${parentTodoId}/items`)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ title: "토글 테스트" })
				.expect(201);
			const toggleItemId = toggleAddRes.body.data.todo.items.find(
				(i: { title: string }) => i.title === "토글 테스트",
			).id;

			// When - 하위 항목 완료 토글
			const toggleResponse = await request(ctx.app.getHttpServer())
				.patch(`/v1/todos/${parentTodoId}/items/${toggleItemId}`)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ completed: true })
				.expect(200);

			// Then - 완료 상태 변경 및 itemStats 반영
			const updatedItem = toggleResponse.body.data.todo.items.find(
				(i: { id: number }) => i.id === toggleItemId,
			);
			expect(updatedItem.completed).toBe(true);
			expect(toggleResponse.body.data.todo.itemStats.completed).toBeGreaterThanOrEqual(1);

			// When - 하위 항목 추가 (삭제 테스트용)
			const deleteAddRes = await request(ctx.app.getHttpServer())
				.post(`/v1/todos/${parentTodoId}/items`)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ title: "삭제할 항목" })
				.expect(201);
			const deleteItemsBefore = deleteAddRes.body.data.todo.items;
			const deleteItemId = deleteItemsBefore.find(
				(i: { title: string }) => i.title === "삭제할 항목",
			).id;
			const countBefore = deleteItemsBefore.length;

			// When - 하위 항목 삭제
			const deleteResponse = await request(ctx.app.getHttpServer())
				.delete(`/v1/todos/${parentTodoId}/items/${deleteItemId}`)
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then - 항목이 제거되고 itemStats 재계산
			expect(deleteResponse.body.data.todo.items).toHaveLength(countBefore - 1);
			const deletedItem = deleteResponse.body.data.todo.items.find(
				(i: { id: number }) => i.id === deleteItemId,
			);
			expect(deletedItem).toBeUndefined();
			expect(deleteResponse.body.data.todo.itemStats.total).toBe(countBefore - 1);
		});

		it("존재하지 않는 Todo에 추가 시 404", async () => {
			// Given - 인증된 사용자
			const user = await ctx.helpers.createVerifiedUser("todo-item-404@example.com", testPassword);

			// When - 존재하지 않는 Todo에 하위 항목 추가 시도
			await request(ctx.app.getHttpServer())
				.post("/v1/todos/999999/items")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ title: "테스트 항목" })
				.expect(404);

			// Then - 404 Not Found (expect에서 검증)
		});

		it("빈 제목 시 400", async () => {
			// Given - 인증된 사용자와 부모 Todo
			const user = await ctx.helpers.createVerifiedUser(
				"todo-item-empty@example.com",
				testPassword,
			);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

			const parentRes = await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ title: "부모", categoryId, startDate: "2024-06-01" })
				.expect(201);
			const parentTodoId = parentRes.body.data.todo.id;

			// When - 빈 제목으로 하위 항목 추가 시도
			await request(ctx.app.getHttpServer())
				.post(`/v1/todos/${parentTodoId}/items`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ title: "" })
				.expect(400);

			// Then - 400 Bad Request (expect에서 검증)
		});

		it("인증 없이 시도 시 401", async () => {
			// Given - 인증 토큰 없음

			// When - 인증 없이 하위 항목 추가 시도
			await request(ctx.app.getHttpServer())
				.post("/v1/todos/1/items")
				.send({ title: "테스트 항목" })
				.expect(401);

			// Then - 401 Unauthorized (expect에서 검증)
		});

		it("존재하지 않는 itemId 시 404", async () => {
			// Given - 인증된 사용자와 부모 Todo
			const user = await ctx.helpers.createVerifiedUser(
				"todo-item-itemid404@example.com",
				testPassword,
			);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

			const parentRes = await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ title: "부모", categoryId, startDate: "2024-06-01" })
				.expect(201);
			const parentTodoId = parentRes.body.data.todo.id;

			// When - 존재하지 않는 하위 항목 수정 시도
			await request(ctx.app.getHttpServer())
				.patch(`/v1/todos/${parentTodoId}/items/999999`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ completed: true })
				.expect(404);

			// Then - 404 Not Found (expect에서 검증)
		});

		it("전체 ID 배열로 순서 변경 성공", async () => {
			// Given - 인증된 사용자와 인라인 items가 있는 Todo
			const user = await ctx.helpers.createVerifiedUser(
				"todo-item-reorder@example.com",
				testPassword,
			);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

			const createRes = await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({
					title: "순서 테스트",
					categoryId,
					startDate: "2024-06-20",
					items: [{ title: "첫 번째" }, { title: "두 번째" }, { title: "세 번째" }],
				})
				.expect(201);
			const todoId = createRes.body.data.todo.id;
			const itemIds = createRes.body.data.todo.items.map((i: { id: number }) => i.id);

			// When - 역순으로 재정렬
			const reversedIds = [...itemIds].reverse();
			const response = await request(ctx.app.getHttpServer())
				.patch(`/v1/todos/${todoId}/items/reorder`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ itemIds: reversedIds })
				.expect(200);

			// Then - 순서가 변경됨
			const reorderedIds = response.body.data.todo.items.map((i: { id: number }) => i.id);
			expect(reorderedIds).toEqual(reversedIds);
		});

		it("부분 ID 전달 시 400", async () => {
			// Given - 인증된 사용자와 인라인 items가 있는 Todo
			const user = await ctx.helpers.createVerifiedUser(
				"todo-item-partial@example.com",
				testPassword,
			);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

			const createRes = await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({
					title: "부분 순서 테스트",
					categoryId,
					startDate: "2024-06-21",
					items: [{ title: "A" }, { title: "B" }, { title: "C" }],
				})
				.expect(201);
			const todoId = createRes.body.data.todo.id;
			const itemIds = createRes.body.data.todo.items.map((i: { id: number }) => i.id);

			// When - 일부 ID만 전달
			await request(ctx.app.getHttpServer())
				.patch(`/v1/todos/${todoId}/items/reorder`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ itemIds: [itemIds[0]] })
				.expect(400);

			// Then - 400 Bad Request (expect에서 검증)
		});

		it("목록 조회 시 각 투두에 items, itemStats 필드 존재", async () => {
			// Given - 인증된 사용자와 하위 항목이 있는 할 일
			const user = await ctx.helpers.createVerifiedUser("todo-item-list@example.com", testPassword);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

			await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({
					title: "항목 있는 할 일",
					categoryId,
					startDate: "2024-06-01",
					items: [{ title: "항목1" }],
				})
				.expect(201);

			// When - 할 일 목록 조회
			const response = await request(ctx.app.getHttpServer())
				.get("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.expect(200);

			// Then - 각 투두에 items와 itemStats 필드 포함
			for (const todo of response.body.data.items) {
				expect(todo.items).toBeDefined();
				expect(Array.isArray(todo.items)).toBe(true);
				expect(todo.itemStats).toBeDefined();
				expect(todo.itemStats.total).toBeDefined();
				expect(todo.itemStats.completed).toBeDefined();
			}
		});

		it("부모 완료해도 하위 항목 completed 변경 없음", async () => {
			// Given - 인증된 사용자와 하위 항목이 있는 Todo
			const user = await ctx.helpers.createVerifiedUser(
				"todo-item-indep@example.com",
				testPassword,
			);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

			const createRes = await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({
					title: "완료 독립성 테스트",
					categoryId,
					startDate: "2024-06-25",
					items: [{ title: "완료할 항목" }, { title: "미완료 항목" }],
				})
				.expect(201);
			const todoId = createRes.body.data.todo.id;
			const firstItemId = createRes.body.data.todo.items[0].id;

			// 첫 번째 항목만 완료 처리
			await request(ctx.app.getHttpServer())
				.patch(`/v1/todos/${todoId}/items/${firstItemId}`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ completed: true })
				.expect(200);

			// When - 부모 Todo 완료 처리
			const completeRes = await request(ctx.app.getHttpServer())
				.patch(`/v1/todos/${todoId}/complete`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({ completed: true })
				.expect(200);

			// Then - 부모는 완료되었지만 하위 항목 상태는 변경 없음
			const items = completeRes.body.data.todo.items;
			const completedItem = items.find((i: { id: number }) => i.id === firstItemId);
			const incompletedItem = items.find((i: { id: number }) => i.id !== firstItemId);
			expect(completedItem.completed).toBe(true);
			expect(incompletedItem.completed).toBe(false);
		});
	});
});
