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

describe("Todo (e2e)", () => {
	let ctx: E2eTestContext;

	beforeAll(async () => {
		ctx = await createE2eApp();
	}, 60000);

	afterAll(async () => {
		await destroyE2eApp(ctx);
	});

	describe("Todo CRUD 플로우", () => {
		const testEmail = "todo-test@example.com";
		const testPassword = "Test1234!";
		let accessToken: string;
		let categoryId: number;
		let createdTodoId: string;

		beforeAll(async () => {
			const user = await ctx.helpers.createVerifiedUser(
				testEmail,
				testPassword,
			);
			accessToken = user.accessToken;
			categoryId = await ctx.helpers.getDefaultCategoryId(accessToken);
		});

		describe("POST /todos - 할 일 생성", () => {
			it("필수 필드만으로 할 일 생성", async () => {
				// Given - 인증된 사용자와 기본 카테고리

				// When - 할 일 생성 API 호출
				const response = await request(ctx.app.getHttpServer())
					.post("/todos")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						title: "테스트 할 일",
						categoryId,
						startDate: "2024-01-15",
					})
					.expect(201);

				// Then - 할 일 생성 성공 검증
				expect(response.body.data.message).toBe("할 일이 생성되었습니다.");
				expect(response.body.data.todo).toMatchObject({
					title: "테스트 할 일",
					startDate: "2024-01-15",
					completed: false,
					isAllDay: true,
					visibility: "PUBLIC",
				});
				expect(response.body.data.todo.id).toBeDefined();
				expect(response.body.data.todo.category).toBeDefined();
				expect(response.body.data.todo.category.id).toBe(categoryId);

				createdTodoId = response.body.data.todo.id;
			});

			it("모든 필드를 포함하여 할 일 생성", async () => {
				// Given - 인증된 사용자와 기본 카테고리

				// When - 모든 필드로 할 일 생성 API 호출
				const response = await request(ctx.app.getHttpServer())
					.post("/todos")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						title: "운동하기",
						content: "헬스장에서 1시간 운동",
						categoryId,
						startDate: "2024-01-20",
						endDate: "2024-01-20",
						scheduledTime: "09:00",
						isAllDay: false,
						visibility: "PRIVATE",
					})
					.expect(201);

				// Then - 모든 필드 검증
				expect(response.body.data.todo).toMatchObject({
					title: "운동하기",
					content: "헬스장에서 1시간 운동",
					startDate: "2024-01-20",
					endDate: "2024-01-20",
					isAllDay: false,
					visibility: "PRIVATE",
				});
				expect(response.body.data.todo.scheduledTime).toBeTruthy();
				expect(response.body.data.todo.category).toBeDefined();
			});

			it("인증 없이 생성 시도 시 401 에러", async () => {
				// Given - 인증 토큰 없음

				// When - 인증 없이 할 일 생성 API 호출
				await request(ctx.app.getHttpServer())
					.post("/todos")
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

				// When - categoryId 없이 할 일 생성 API 호출
				const response = await request(ctx.app.getHttpServer())
					.post("/todos")
					.set("Authorization", `Bearer ${accessToken}`)
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

				// When - title 없이 할 일 생성 API 호출
				const response = await request(ctx.app.getHttpServer())
					.post("/todos")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						categoryId,
						content: "내용만 있음",
					})
					.expect(400);

				// Then - 400 Bad Request 검증
				expect(response.body.success).toBe(false);
			});

			it("잘못된 날짜 형식 시 400 에러", async () => {
				// Given - 인증된 사용자

				// When - 잘못된 날짜로 할 일 생성 API 호출
				const response = await request(ctx.app.getHttpServer())
					.post("/todos")
					.set("Authorization", `Bearer ${accessToken}`)
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
				// Given - 존재하지 않는 카테고리 ID

				// When - 존재하지 않는 카테고리로 할 일 생성 API 호출
				const response = await request(ctx.app.getHttpServer())
					.post("/todos")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						title: "테스트",
						categoryId: 999999,
						startDate: "2024-01-15",
					})
					.expect(404);

				// Then - 404 에러 검증
				expect(response.body.error.code).toBe("TODO_CATEGORY_0851");
			});
		});

		describe("GET /todos - 할 일 목록 조회", () => {
			it("할 일 목록 조회 성공", async () => {
				// Given - 할 일이 존재하는 상태

				// When - 할 일 목록 조회 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/todos")
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(200);

				// Then - 목록 검증
				expect(response.body.data.items).toBeDefined();
				expect(Array.isArray(response.body.data.items)).toBe(true);
				expect(response.body.data.items.length).toBeGreaterThan(0);
				expect(response.body.data.pagination).toBeDefined();
				// 각 항목에 category가 포함되어야 함
				for (const item of response.body.data.items) {
					expect(item.category).toBeDefined();
					expect(item.category.id).toBeDefined();
					expect(item.category.name).toBeDefined();
					expect(item.category.color).toBeDefined();
					expect(item.category.sortOrder).toBeDefined();
				}
			});

			it("페이지 크기 지정하여 조회", async () => {
				// Given - 할 일이 존재하는 상태

				// When - size 파라미터로 할 일 목록 조회 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/todos")
					.query({ size: 1 })
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(200);

				// Then - 페이지 크기 검증
				expect(response.body.data.items.length).toBeLessThanOrEqual(1);
				expect(response.body.data.pagination.size).toBe(1);
			});

			it("완료 상태로 필터링", async () => {
				// Given - 미완료 항목 필터

				// When - completed=false로 할 일 목록 조회 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/todos")
					.query({ completed: false })
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(200);

				// Then - 미완료 항목만 검증
				for (const item of response.body.data.items) {
					expect(item.completed).toBe(false);
				}
			});

			it("날짜 범위로 필터링", async () => {
				// Given - 날짜 범위 필터

				// When - 날짜 범위로 할 일 목록 조회 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/todos")
					.query({
						startDate: "2024-01-01",
						endDate: "2024-01-31",
					})
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(200);

				// Then - 결과 존재 검증
				expect(response.body.data.items).toBeDefined();
			});

			it("다중일 투두가 범위 필터에서 정상 노출된다", async () => {
				// Given - 다중일 투두 생성 (1/15 ~ 1/20)
				await request(ctx.app.getHttpServer())
					.post("/todos")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						title: "다중일 할 일",
						categoryId,
						startDate: "2024-01-15",
						endDate: "2024-01-20",
					})
					.expect(201);

				// When - 1/18로 필터
				const response = await request(ctx.app.getHttpServer())
					.get("/todos")
					.query({
						startDate: "2024-01-18",
						endDate: "2024-01-18",
					})
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(200);

				// Then - 다중일 투두 포함 확인
				const titles = response.body.data.items.map((t: Todo) => t.title);
				expect(titles).toContain("다중일 할 일");
			});

			it("특정 하루(2월 1일)만 조회할 수 있다", async () => {
				// Given - 2월 1일, 2일 투두 생성
				await request(ctx.app.getHttpServer())
					.post("/todos")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						title: "2월1일 단건",
						categoryId,
						startDate: "2024-02-01",
					})
					.expect(201);

				await request(ctx.app.getHttpServer())
					.post("/todos")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						title: "2월2일 단건",
						categoryId,
						startDate: "2024-02-02",
					})
					.expect(201);

				// When - 2월 1일만 조회
				const response = await request(ctx.app.getHttpServer())
					.get("/todos")
					.query({
						startDate: "2024-02-01",
						endDate: "2024-02-01",
					})
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(200);

				// Then - 2월 1일 투두만 포함 검증
				const titles = response.body.data.items.map((t: Todo) => t.title);
				expect(titles).toContain("2월1일 단건");
				expect(titles).not.toContain("2월2일 단건");
			});

			it("기간(2월 2일~2월 3일) 조회가 가능하다", async () => {
				// Given - 2월 2일, 3일, 4일 투두 생성
				await request(ctx.app.getHttpServer())
					.post("/todos")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						title: "2월2일 포함",
						categoryId,
						startDate: "2024-02-02",
					})
					.expect(201);

				await request(ctx.app.getHttpServer())
					.post("/todos")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						title: "2월3일 포함",
						categoryId,
						startDate: "2024-02-03",
					})
					.expect(201);

				await request(ctx.app.getHttpServer())
					.post("/todos")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						title: "2월4일 제외",
						categoryId,
						startDate: "2024-02-04",
					})
					.expect(201);

				// When - 2월 2일~3일 기간 조회
				const response = await request(ctx.app.getHttpServer())
					.get("/todos")
					.query({
						startDate: "2024-02-02",
						endDate: "2024-02-03",
					})
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(200);

				// Then - 범위 내 투두만 포함 검증
				const titles = response.body.data.items.map((t: Todo) => t.title);
				expect(titles).toContain("2월2일 포함");
				expect(titles).toContain("2월3일 포함");
				expect(titles).not.toContain("2월4일 제외");
			});

			it("카테고리로 필터링", async () => {
				// Given - 카테고리 ID 필터

				// When - categoryId로 할 일 목록 조회 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/todos")
					.query({ categoryId })
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(200);

				// Then - 해당 카테고리 투두만 검증
				for (const item of response.body.data.items) {
					expect(item.category.id).toBe(categoryId);
				}
			});

			it("인증 없이 조회 시도 시 401 에러", async () => {
				// Given - 인증 토큰 없음

				// When - 인증 없이 할 일 목록 조회 API 호출
				await request(ctx.app.getHttpServer()).get("/todos").expect(401);

				// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
			});
		});

		describe("GET /todos/:id - 할 일 상세 조회", () => {
			it("할 일 상세 조회 성공", async () => {
				// Given - 생성된 할 일 ID

				// When - 할 일 상세 조회 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get(`/todos/${createdTodoId}`)
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(200);

				// Then - 상세 정보 검증
				expect(response.body.data.id).toBe(createdTodoId);
				expect(response.body.data.title).toBe("테스트 할 일");
				expect(response.body.data.category).toBeDefined();
			});

			it("존재하지 않는 ID로 조회 시 404 에러", async () => {
				// Given - 존재하지 않는 할 일 ID

				// When - 존재하지 않는 ID로 조회 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/todos/999999")
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(404);

				// Then - 404 에러 검증
				expect(response.body.success).toBe(false);
				expect(response.body.error.code).toBe("TODO_0801");
			});

			it("인증 없이 조회 시도 시 401 에러", async () => {
				// Given - 인증 토큰 없음

				// When - 인증 없이 할 일 상세 조회 API 호출
				await request(ctx.app.getHttpServer())
					.get(`/todos/${createdTodoId}`)
					.expect(401);

				// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
			});
		});

		describe("PATCH /todos/:id - 할 일 수정", () => {
			it("제목 수정 성공", async () => {
				// Given - 생성된 할 일

				// When - 제목 수정 API 호출
				const response = await request(ctx.app.getHttpServer())
					.patch(`/todos/${createdTodoId}`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						title: "수정된 할 일",
					})
					.expect(200);

				// Then - 수정 결과 검증
				expect(response.body.data.message).toBe("할 일이 수정되었습니다.");
				expect(response.body.data.todo.title).toBe("수정된 할 일");
			});

			it("완료 처리 성공", async () => {
				// Given - 미완료 할 일

				// When - 완료 처리 API 호출
				const response = await request(ctx.app.getHttpServer())
					.patch(`/todos/${createdTodoId}`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						completed: true,
					})
					.expect(200);

				// Then - 완료 상태 검증
				expect(response.body.data.todo.completed).toBe(true);
				expect(response.body.data.todo.completedAt).toBeTruthy();
			});

			it("완료 취소 처리 성공", async () => {
				// Given - 완료된 할 일

				// When - 완료 취소 API 호출
				const response = await request(ctx.app.getHttpServer())
					.patch(`/todos/${createdTodoId}`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						completed: false,
					})
					.expect(200);

				// Then - 미완료 상태 검증
				expect(response.body.data.todo.completed).toBe(false);
				expect(response.body.data.todo.completedAt).toBeNull();
			});

			it("여러 필드 동시 수정 성공", async () => {
				// Given - 생성된 할 일

				// When - 여러 필드 동시 수정 API 호출
				const response = await request(ctx.app.getHttpServer())
					.patch(`/todos/${createdTodoId}`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						title: "최종 수정된 제목",
						content: "새로운 내용",
					})
					.expect(200);

				// Then - 수정 결과 검증
				expect(response.body.data.todo.title).toBe("최종 수정된 제목");
				expect(response.body.data.todo.content).toBe("새로운 내용");
			});

			it("null 값으로 필드 삭제 성공", async () => {
				// Given - 내용이 있는 할 일

				// When - content를 null로 수정 API 호출
				const response = await request(ctx.app.getHttpServer())
					.patch(`/todos/${createdTodoId}`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						content: null,
					})
					.expect(200);

				// Then - null 검증
				expect(response.body.data.todo.content).toBeNull();
			});

			it("존재하지 않는 ID로 수정 시 404 에러", async () => {
				// Given - 존재하지 않는 할 일 ID

				// When - 존재하지 않는 ID로 수정 API 호출
				const response = await request(ctx.app.getHttpServer())
					.patch("/todos/999999")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ title: "수정" })
					.expect(404);

				// Then - 404 에러 검증
				expect(response.body.error.code).toBe("TODO_0801");
			});

			it("인증 없이 수정 시도 시 401 에러", async () => {
				// Given - 인증 토큰 없음

				// When - 인증 없이 할 일 수정 API 호출
				await request(ctx.app.getHttpServer())
					.patch(`/todos/${createdTodoId}`)
					.send({ title: "수정" })
					.expect(401);

				// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
			});
		});

		describe("PATCH /todos/:id/complete - 완료 상태 토글", () => {
			it("미완료 상태에서 완료 처리 성공", async () => {
				// Given - 미완료 Todo 생성
				const createResponse = await request(ctx.app.getHttpServer())
					.post("/todos")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						title: "완료 테스트용 할 일",
						categoryId,
						startDate: "2024-01-15",
					})
					.expect(201);

				const todoId = createResponse.body.data.todo.id;

				// When - 완료 처리
				const response = await request(ctx.app.getHttpServer())
					.patch(`/todos/${todoId}/complete`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ completed: true })
					.expect(200);

				// Then - 완료 상태 검증
				expect(response.body.data.todo.completed).toBe(true);
				expect(response.body.data.todo.completedAt).toBeTruthy();
			});

			it("완료 상태에서 미완료 처리 성공", async () => {
				// Given - 완료 상태 Todo 생성
				const createResponse = await request(ctx.app.getHttpServer())
					.post("/todos")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						title: "완료 취소 테스트용",
						categoryId,
						startDate: "2024-01-15",
					})
					.expect(201);

				const todoId = createResponse.body.data.todo.id;

				// 먼저 완료 처리
				await request(ctx.app.getHttpServer())
					.patch(`/todos/${todoId}/complete`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ completed: true })
					.expect(200);

				// When - 미완료 처리
				const response = await request(ctx.app.getHttpServer())
					.patch(`/todos/${todoId}/complete`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ completed: false })
					.expect(200);

				// Then - 미완료 상태 검증
				expect(response.body.data.todo.completed).toBe(false);
				expect(response.body.data.todo.completedAt).toBeNull();
			});

			it("존재하지 않는 Todo는 404 에러", async () => {
				// Given - 존재하지 않는 할 일 ID

				// When - 존재하지 않는 ID로 완료 처리 API 호출
				const response = await request(ctx.app.getHttpServer())
					.patch("/todos/999999/complete")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ completed: true })
					.expect(404);

				// Then - 404 에러 검증
				expect(response.body.error.code).toBe("TODO_0801");
			});

			it("completed 필드 누락 시 400 에러", async () => {
				// Given - 인증된 사용자

				// When - completed 필드 없이 완료 처리 API 호출
				await request(ctx.app.getHttpServer())
					.patch(`/todos/${createdTodoId}/complete`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({})
					.expect(400);

				// Then - 400 Bad Request 응답 확인 (expect에서 검증)
			});
		});

		describe("PATCH /todos/:id/visibility - 공개 범위 변경", () => {
			it("PUBLIC에서 PRIVATE으로 변경 성공", async () => {
				// Given - PUBLIC Todo 생성
				const createResponse = await request(ctx.app.getHttpServer())
					.post("/todos")
					.set("Authorization", `Bearer ${accessToken}`)
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
					.patch(`/todos/${todoId}/visibility`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ visibility: "PRIVATE" })
					.expect(200);

				// Then - 변경 결과 검증
				expect(response.body.data.todo.visibility).toBe("PRIVATE");
			});

			it("PRIVATE에서 PUBLIC으로 변경 성공", async () => {
				// Given - PRIVATE Todo 생성
				const createResponse = await request(ctx.app.getHttpServer())
					.post("/todos")
					.set("Authorization", `Bearer ${accessToken}`)
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
					.patch(`/todos/${todoId}/visibility`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ visibility: "PUBLIC" })
					.expect(200);

				// Then - 변경 결과 검증
				expect(response.body.data.todo.visibility).toBe("PUBLIC");
			});

			it("잘못된 visibility 값은 400 에러", async () => {
				// Given - 인증된 사용자

				// When - 잘못된 visibility 값으로 변경 API 호출
				await request(ctx.app.getHttpServer())
					.patch(`/todos/${createdTodoId}/visibility`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ visibility: "INVALID" })
					.expect(400);

				// Then - 400 Bad Request 응답 확인 (expect에서 검증)
			});
		});

		describe("PATCH /todos/:id/category - 카테고리 변경", () => {
			let secondCategoryId: number;

			beforeAll(async () => {
				// 두 번째 카테고리 생성
				const response = await request(ctx.app.getHttpServer())
					.post("/todo-categories")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						name: "새 카테고리",
						color: "#00FF00",
					})
					.expect(201);

				secondCategoryId = response.body.data.category.id;
			});

			it("카테고리 변경 성공", async () => {
				// Given - Todo 생성
				const createResponse = await request(ctx.app.getHttpServer())
					.post("/todos")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						title: "카테고리 변경 테스트",
						categoryId,
						startDate: "2024-01-15",
					})
					.expect(201);

				const todoId = createResponse.body.data.todo.id;

				// When - 카테고리 변경 API 호출
				const response = await request(ctx.app.getHttpServer())
					.patch(`/todos/${todoId}/category`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ categoryId: secondCategoryId })
					.expect(200);

				// Then - 변경 결과 검증
				expect(response.body.data.todo.category.id).toBe(secondCategoryId);
			});

			it("존재하지 않는 카테고리는 404 에러", async () => {
				// Given - 존재하지 않는 카테고리 ID

				// When - 존재하지 않는 카테고리로 변경 API 호출
				const response = await request(ctx.app.getHttpServer())
					.patch(`/todos/${createdTodoId}/category`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ categoryId: 999999 })
					.expect(404);

				// Then - 404 에러 검증
				expect(response.body.error.code).toBe("TODO_CATEGORY_0851");
			});
		});

		describe("PATCH /todos/:id/schedule - 일정 변경", () => {
			it("일정 변경 성공 (종일 이벤트)", async () => {
				// Given - 생성된 할 일

				// When - 종일 일정으로 변경 API 호출
				const response = await request(ctx.app.getHttpServer())
					.patch(`/todos/${createdTodoId}/schedule`)
					.set("Authorization", `Bearer ${accessToken}`)
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
				// Given - 생성된 할 일

				// When - 시간 지정 일정으로 변경 API 호출
				const response = await request(ctx.app.getHttpServer())
					.patch(`/todos/${createdTodoId}/schedule`)
					.set("Authorization", `Bearer ${accessToken}`)
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
				// Given - 인증된 사용자

				// When - startDate 없이 일정 변경 API 호출
				await request(ctx.app.getHttpServer())
					.patch(`/todos/${createdTodoId}/schedule`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ endDate: "2024-02-01" })
					.expect(400);

				// Then - 400 Bad Request 응답 확인 (expect에서 검증)
			});

			it("endDate가 startDate보다 이전이면 400 에러", async () => {
				// Given - 인증된 사용자

				// When - endDate < startDate로 일정 변경 API 호출
				await request(ctx.app.getHttpServer())
					.patch(`/todos/${createdTodoId}/schedule`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						startDate: "2024-02-15",
						endDate: "2024-02-10",
					})
					.expect(400);

				// Then - 400 Bad Request 응답 확인 (expect에서 검증)
			});
		});

		describe("PATCH /todos/:id/content - 제목/내용 수정", () => {
			it("제목만 수정 성공", async () => {
				// Given - 생성된 할 일

				// When - 제목 수정 API 호출
				const response = await request(ctx.app.getHttpServer())
					.patch(`/todos/${createdTodoId}/content`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ title: "SRP로 수정된 제목" })
					.expect(200);

				// Then - 수정 결과 검증
				expect(response.body.data.todo.title).toBe("SRP로 수정된 제목");
			});

			it("내용만 수정 성공", async () => {
				// Given - 생성된 할 일

				// When - 내용 수정 API 호출
				const response = await request(ctx.app.getHttpServer())
					.patch(`/todos/${createdTodoId}/content`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ content: "SRP로 수정된 내용" })
					.expect(200);

				// Then - 수정 결과 검증
				expect(response.body.data.todo.content).toBe("SRP로 수정된 내용");
			});

			it("제목과 내용 모두 수정 성공", async () => {
				// Given - 생성된 할 일

				// When - 제목과 내용 동시 수정 API 호출
				const response = await request(ctx.app.getHttpServer())
					.patch(`/todos/${createdTodoId}/content`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						title: "새 제목",
						content: "새 내용",
					})
					.expect(200);

				// Then - 수정 결과 검증
				expect(response.body.data.todo.title).toBe("새 제목");
				expect(response.body.data.todo.content).toBe("새 내용");
			});

			it("빈 요청은 400 에러", async () => {
				// Given - 인증된 사용자

				// When - 빈 요청으로 수정 API 호출
				await request(ctx.app.getHttpServer())
					.patch(`/todos/${createdTodoId}/content`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({})
					.expect(400);

				// Then - 400 Bad Request 응답 확인 (expect에서 검증)
			});

			it("제목이 200자 초과하면 400 에러", async () => {
				// Given - 200자 초과 제목
				const longTitle = "a".repeat(201);

				// When - 긴 제목으로 수정 API 호출
				await request(ctx.app.getHttpServer())
					.patch(`/todos/${createdTodoId}/content`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ title: longTitle })
					.expect(400);

				// Then - 400 Bad Request 응답 확인 (expect에서 검증)
			});
		});

		describe("PATCH /todos/:id/reorder - 순서 변경", () => {
			let todo1Id: number;
			let todo2Id: number;
			let todo3Id: number;

			beforeAll(async () => {
				// 테스트용 할 일 3개 생성
				const res1 = await request(ctx.app.getHttpServer())
					.post("/todos")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						title: "순서 테스트 1",
						categoryId,
						startDate: "2024-03-01",
					})
					.expect(201);
				todo1Id = res1.body.data.todo.id;

				const res2 = await request(ctx.app.getHttpServer())
					.post("/todos")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						title: "순서 테스트 2",
						categoryId,
						startDate: "2024-03-01",
					})
					.expect(201);
				todo2Id = res2.body.data.todo.id;

				const res3 = await request(ctx.app.getHttpServer())
					.post("/todos")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						title: "순서 테스트 3",
						categoryId,
						startDate: "2024-03-01",
					})
					.expect(201);
				todo3Id = res3.body.data.todo.id;
			});

			it("특정 Todo 앞으로 이동 성공 (before)", async () => {
				// Given - 3개의 할 일

				// When - todo3를 todo1 앞으로 이동
				const response = await request(ctx.app.getHttpServer())
					.patch(`/todos/${todo3Id}/reorder`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						targetTodoId: todo1Id,
						position: "before",
					})
					.expect(200);

				// Then - 이동 성공 검증
				expect(response.body.data.message).toBe("할 일 순서가 변경되었습니다.");
				expect(response.body.data.todo.id).toBe(todo3Id);
			});

			it("특정 Todo 뒤로 이동 성공 (after)", async () => {
				// Given - 할 일이 존재하는 상태

				// When - todo1을 todo2 뒤로 이동
				const response = await request(ctx.app.getHttpServer())
					.patch(`/todos/${todo1Id}/reorder`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						targetTodoId: todo2Id,
						position: "after",
					})
					.expect(200);

				// Then - 이동 성공 검증
				expect(response.body.data.todo.id).toBe(todo1Id);
			});

			it("맨 앞으로 이동 성공 (targetTodoId 없이 before)", async () => {
				// Given - 할 일이 존재하는 상태

				// When - todo2를 맨 앞으로 이동
				const response = await request(ctx.app.getHttpServer())
					.patch(`/todos/${todo2Id}/reorder`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						position: "before",
					})
					.expect(200);

				// Then - sortOrder 0 검증
				expect(response.body.data.todo.sortOrder).toBe(0);
			});

			it("존재하지 않는 Todo로 이동 시도 시 404 에러", async () => {
				// Given - 존재하지 않는 target Todo ID

				// When - 존재하지 않는 Todo로 이동 API 호출
				const response = await request(ctx.app.getHttpServer())
					.patch(`/todos/${todo1Id}/reorder`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						targetTodoId: 999999,
						position: "before",
					})
					.expect(404);

				// Then - 404 에러 검증
				expect(response.body.error.code).toBe("TODO_0810");
			});
		});

		describe("DELETE /todos/:id - 할 일 삭제", () => {
			let todoToDelete: number;

			beforeAll(async () => {
				// 삭제 테스트용 할 일 생성
				const response = await request(ctx.app.getHttpServer())
					.post("/todos")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						title: "삭제될 할 일",
						categoryId,
						startDate: "2024-01-25",
					})
					.expect(201);

				todoToDelete = response.body.data.todo.id;
			});

			it("할 일 삭제 성공", async () => {
				// Given - 삭제할 할 일 (beforeAll에서 생성)

				// When - 할 일 삭제 API 호출
				const response = await request(ctx.app.getHttpServer())
					.delete(`/todos/${todoToDelete}`)
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(200);

				// Then - 삭제 성공 검증
				expect(response.body.data.message).toBe("할 일이 삭제되었습니다.");

				// 삭제 확인
				await request(ctx.app.getHttpServer())
					.get(`/todos/${todoToDelete}`)
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(404);
			});

			it("존재하지 않는 ID로 삭제 시 404 에러", async () => {
				// Given - 존재하지 않는 할 일 ID

				// When - 존재하지 않는 ID로 삭제 API 호출
				const response = await request(ctx.app.getHttpServer())
					.delete("/todos/999999")
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(404);

				// Then - 404 에러 검증
				expect(response.body.error.code).toBe("TODO_0801");
			});

			it("인증 없이 삭제 시도 시 401 에러", async () => {
				// Given - 인증 토큰 없음

				// When - 인증 없이 할 일 삭제 API 호출
				await request(ctx.app.getHttpServer())
					.delete(`/todos/${createdTodoId}`)
					.expect(401);

				// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
			});
		});
	});

	describe("사용자 격리 테스트", () => {
		const user1Email = "user1@example.com";
		const user2Email = "user2@example.com";
		const testPassword = "Test1234!";
		let user1Token: string;
		let user2Token: string;
		let user1CategoryId: number;
		let user2CategoryId: number;
		let user1TodoId: string;

		beforeAll(async () => {
			// 두 명의 사용자 생성
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

			// 각 사용자의 기본 카테고리 ID 조회
			user1CategoryId = await ctx.helpers.getDefaultCategoryId(user1Token);
			user2CategoryId = await ctx.helpers.getDefaultCategoryId(user2Token);

			// user1의 할 일 생성
			const response = await request(ctx.app.getHttpServer())
				.post("/todos")
				.set("Authorization", `Bearer ${user1Token}`)
				.send({
					title: "User1의 할 일",
					categoryId: user1CategoryId,
					startDate: "2024-02-01",
				})
				.expect(201);

			user1TodoId = response.body.data.todo.id;
		});

		it("다른 사용자의 할 일 조회 시 404 에러", async () => {
			// Given - user2가 user1의 할 일 접근

			// When - 다른 사용자의 할 일 상세 조회 API 호출
			const response = await request(ctx.app.getHttpServer())
				.get(`/todos/${user1TodoId}`)
				.set("Authorization", `Bearer ${user2Token}`)
				.expect(404);

			// Then - 404 에러 검증
			expect(response.body.error.code).toBe("TODO_0801");
		});

		it("다른 사용자의 할 일 수정 시 404 에러", async () => {
			// Given - user2가 user1의 할 일 수정 시도

			// When - 다른 사용자의 할 일 수정 API 호출
			const response = await request(ctx.app.getHttpServer())
				.patch(`/todos/${user1TodoId}`)
				.set("Authorization", `Bearer ${user2Token}`)
				.send({ title: "해킹 시도" })
				.expect(404);

			// Then - 404 에러 검증
			expect(response.body.error.code).toBe("TODO_0801");
		});

		it("다른 사용자의 할 일 삭제 시 404 에러", async () => {
			// Given - user2가 user1의 할 일 삭제 시도

			// When - 다른 사용자의 할 일 삭제 API 호출
			const response = await request(ctx.app.getHttpServer())
				.delete(`/todos/${user1TodoId}`)
				.set("Authorization", `Bearer ${user2Token}`)
				.expect(404);

			// Then - 404 에러 검증
			expect(response.body.error.code).toBe("TODO_0801");
		});

		it("각 사용자는 자신의 할 일만 목록에서 조회됨", async () => {
			// Given - user2의 할 일 생성
			await request(ctx.app.getHttpServer())
				.post("/todos")
				.set("Authorization", `Bearer ${user2Token}`)
				.send({
					title: "User2의 할 일",
					categoryId: user2CategoryId,
					startDate: "2024-02-01",
				})
				.expect(201);

			// When - user1의 목록 조회
			const user1List = await request(ctx.app.getHttpServer())
				.get("/todos")
				.set("Authorization", `Bearer ${user1Token}`)
				.expect(200);

			// When - user2의 목록 조회
			const user2List = await request(ctx.app.getHttpServer())
				.get("/todos")
				.set("Authorization", `Bearer ${user2Token}`)
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
		const paginationEmail = "pagination@example.com";
		const testPassword = "Test1234!";
		let accessToken: string;
		let categoryId: number;

		beforeAll(async () => {
			const user = await ctx.helpers.createVerifiedUser(
				paginationEmail,
				testPassword,
			);
			accessToken = user.accessToken;
			categoryId = await ctx.helpers.getDefaultCategoryId(accessToken);

			// 10개의 할 일 생성
			for (let i = 0; i < 10; i++) {
				await request(ctx.app.getHttpServer())
					.post("/todos")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						title: `페이지네이션 테스트 ${i + 1}`,
						categoryId,
						startDate: "2024-03-01",
					})
					.expect(201);
			}
		});

		it("커서 기반 페이지네이션 동작 확인", async () => {
			// Given - 10개의 할 일

			// When - 첫 페이지 조회 (5개)
			const page1 = await request(ctx.app.getHttpServer())
				.get("/todos")
				.query({ size: 5 })
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then - 첫 페이지 검증
			expect(page1.body.data.items.length).toBe(5);
			expect(page1.body.data.pagination.hasNext).toBe(true);
			expect(page1.body.data.pagination.nextCursor).toBeTruthy();

			// When - 두 번째 페이지 조회
			const page2 = await request(ctx.app.getHttpServer())
				.get("/todos")
				.query({
					size: 5,
					cursor: page1.body.data.pagination.nextCursor,
				})
				.set("Authorization", `Bearer ${accessToken}`)
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
		const validationEmail = "validation@example.com";
		const testPassword = "Test1234!";
		let accessToken: string;
		let categoryId: number;

		beforeAll(async () => {
			const user = await ctx.helpers.createVerifiedUser(
				validationEmail,
				testPassword,
			);
			accessToken = user.accessToken;
			categoryId = await ctx.helpers.getDefaultCategoryId(accessToken);
		});

		it("제목이 200자 초과하면 400 에러", async () => {
			// Given - 200자 초과 제목
			const longTitle = "a".repeat(201);

			// When - 긴 제목으로 할 일 생성 API 호출
			const response = await request(ctx.app.getHttpServer())
				.post("/todos")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					title: longTitle,
					categoryId,
					startDate: "2024-01-15",
				})
				.expect(400);

			// Then - 400 Bad Request 검증
			expect(response.body.success).toBe(false);
		});

		it("잘못된 visibility 값은 400 에러", async () => {
			// Given - 잘못된 visibility 값

			// When - 잘못된 visibility로 할 일 생성 API 호출
			const response = await request(ctx.app.getHttpServer())
				.post("/todos")
				.set("Authorization", `Bearer ${accessToken}`)
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
			// Given - 잘못된 시간 형식

			// When - 잘못된 시간으로 할 일 생성 API 호출
			const response = await request(ctx.app.getHttpServer())
				.post("/todos")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					title: "테스트",
					categoryId,
					startDate: "2024-01-15",
					scheduledTime: "25:00", // 잘못된 시간
				})
				.expect(400);

			// Then - 400 Bad Request 검증
			expect(response.body.success).toBe(false);
		});
	});

	describe("카테고리 순서 기반 정렬 테스트", () => {
		const sortEmail = "sort-test@example.com";
		const testPassword = "Test1234!";
		let accessToken: string;
		let category1Id: number;
		let category2Id: number;
		let category3Id: number;

		beforeAll(async () => {
			const user = await ctx.helpers.createVerifiedUser(
				sortEmail,
				testPassword,
			);
			accessToken = user.accessToken;

			// 기본 카테고리 조회 (회원가입 시 "중요한 일", "할 일" 자동 생성)
			const catResponse = await request(ctx.app.getHttpServer())
				.get("/todo-categories")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			const defaultCategories = catResponse.body.data.items;
			category1Id = defaultCategories[0].id; // sortOrder 0
			category2Id = defaultCategories[1].id; // sortOrder 1

			// 세 번째 카테고리 생성 (sortOrder 2)
			const cat3Response = await request(ctx.app.getHttpServer())
				.post("/todo-categories")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ name: "공부", color: "#0000FF" })
				.expect(201);

			category3Id = cat3Response.body.data.category.id;

			// 카테고리별 할 일 생성
			// 카테고리3 (sortOrder 2)에 먼저 생성 -- 정렬이 카테고리 순서 기반인지 확인
			await request(ctx.app.getHttpServer())
				.post("/todos")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					title: "공부-할일1",
					categoryId: category3Id,
					startDate: "2024-06-01",
				})
				.expect(201);

			await request(ctx.app.getHttpServer())
				.post("/todos")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					title: "공부-할일2",
					categoryId: category3Id,
					startDate: "2024-06-01",
				})
				.expect(201);

			// 카테고리1 (sortOrder 0)
			await request(ctx.app.getHttpServer())
				.post("/todos")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					title: "중요-할일1",
					categoryId: category1Id,
					startDate: "2024-06-01",
				})
				.expect(201);

			await request(ctx.app.getHttpServer())
				.post("/todos")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					title: "중요-할일2",
					categoryId: category1Id,
					startDate: "2024-06-01",
				})
				.expect(201);

			// 카테고리2 (sortOrder 1)
			await request(ctx.app.getHttpServer())
				.post("/todos")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					title: "할일-할일1",
					categoryId: category2Id,
					startDate: "2024-06-01",
				})
				.expect(201);
		});

		it("categoryId 없이 조회 시 category.sortOrder -> todo.sortOrder -> id 순으로 정렬된다", async () => {
			// Given - 카테고리별 할 일이 존재하는 상태

			// When - 할 일 목록 조회
			const response = await request(ctx.app.getHttpServer())
				.get("/todos")
				.query({ startDate: "2024-06-01", endDate: "2024-06-01" })
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then - 카테고리 sortOrder 순 정렬 검증
			const items = response.body.data.items;
			expect(items.length).toBe(5);

			// category1 (sortOrder 0) -> category2 (sortOrder 1) -> category3 (sortOrder 2)
			expect(items[0].category.id).toBe(category1Id);
			expect(items[1].category.id).toBe(category1Id);
			expect(items[2].category.id).toBe(category2Id);
			expect(items[3].category.id).toBe(category3Id);
			expect(items[4].category.id).toBe(category3Id);

			// 같은 카테고리 내에서는 sortOrder ASC -> id ASC
			expect(items[0].sortOrder).toBeLessThanOrEqual(items[1].sortOrder);
			expect(items[3].sortOrder).toBeLessThanOrEqual(items[4].sortOrder);
		});

		it("각 todo의 category 객체에 sortOrder 필드가 포함된다", async () => {
			// Given - 카테고리별 할 일이 존재하는 상태

			// When - 할 일 목록 조회
			const response = await request(ctx.app.getHttpServer())
				.get("/todos")
				.query({ startDate: "2024-06-01", endDate: "2024-06-01" })
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then - sortOrder 필드 포함 검증
			for (const item of response.body.data.items) {
				expect(typeof item.category.sortOrder).toBe("number");
			}

			// 카테고리별 sortOrder 값 검증
			const cat1Items = response.body.data.items.filter(
				(t: Todo) => t.category.id === category1Id,
			);
			const cat3Items = response.body.data.items.filter(
				(t: Todo) => t.category.id === category3Id,
			);

			expect(cat1Items[0].category.sortOrder).toBeLessThan(
				cat3Items[0].category.sortOrder,
			);
		});

		it("페이지네이션 시 카테고리 순서가 유지된다", async () => {
			// Given - 5개의 할 일

			// When - 첫 페이지 (3개)
			const page1 = await request(ctx.app.getHttpServer())
				.get("/todos")
				.query({ startDate: "2024-06-01", endDate: "2024-06-01", size: 3 })
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then - 첫 페이지 검증
			expect(page1.body.data.items.length).toBe(3);
			expect(page1.body.data.pagination.hasNext).toBe(true);

			// When - 두 번째 페이지
			const page2 = await request(ctx.app.getHttpServer())
				.get("/todos")
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
			expect(page1Last.category.sortOrder).toBeLessThanOrEqual(
				page2First.category.sortOrder,
			);
		});

		it("카테고리 reorder 후 조회하면 새 순서가 반영된다", async () => {
			// Given - 카테고리3(공부)를 카테고리1(중요한 일) 앞으로 이동
			await request(ctx.app.getHttpServer())
				.patch(`/todo-categories/${category3Id}/reorder`)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					targetCategoryId: category1Id,
					position: "before",
				})
				.expect(200);

			// When - 할 일 목록 조회
			const response = await request(ctx.app.getHttpServer())
				.get("/todos")
				.query({ startDate: "2024-06-01", endDate: "2024-06-01" })
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			const items = response.body.data.items;

			// Then - 카테고리3(공부)의 할 일이 카테고리1(중요한 일) 할 일보다 먼저 나옴
			const firstCat3Index = items.findIndex(
				(t: Todo) => t.category.id === category3Id,
			);
			const firstCat1Index = items.findIndex(
				(t: Todo) => t.category.id === category1Id,
			);

			expect(firstCat3Index).toBeLessThan(firstCat1Index);
		});
	});
});
