/**
 * Todo API E2E 테스트
 *
 * @description
 * Todo CRUD API의 전체 흐름을 실제 HTTP 요청으로 검증합니다.
 * Testcontainers를 사용하여 독립적인 PostgreSQL 환경에서 테스트합니다.
 *
 * 테스트 전략:
 * - 실제 HTTP 요청을 통한 API 검증 (supertest)
 * - Testcontainers로 독립적인 DB 환경 제공
 * - 각 테스트 케이스는 독립적으로 실행 가능해야 함
 * - 응답은 ResponseTransformInterceptor에 의해 {success, data, timestamp} 구조로 래핑됨
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test:e2e
 * ```
 */

import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { ZodValidationPipe } from "nestjs-zod";
import request from "supertest";
import type { App } from "supertest/types";
import { AppModule } from "@/app.module";
import { DatabaseService } from "@/database";
import { TestDatabase } from "../setup/test-database";

// Controller에서 사용하는 임시 사용자 ID와 동일해야 함
const TEMP_USER_ID = "temp_user_id_for_development";

describe("TodoController (e2e)", () => {
	let app: INestApplication<App>;
	let testDatabase: TestDatabase;

	beforeAll(async () => {
		// Testcontainers로 PostgreSQL 컨테이너 시작
		testDatabase = new TestDatabase();
		await testDatabase.start();

		// Mock 사용자 생성 (Todo 생성 시 userId FK 참조를 위해 필요)
		const prisma = testDatabase.getPrisma();
		await prisma.user.create({
			data: {
				id: TEMP_USER_ID,
				email: "test@example.com",
			},
		});
		console.log("✅ Mock user created for E2E tests");

		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		})
			.overrideProvider(DatabaseService)
			.useValue(testDatabase.getPrisma())
			.compile();

		app = moduleFixture.createNestApplication();
		app.useGlobalPipes(new ZodValidationPipe());
		await app.init();
	});

	afterAll(async () => {
		await app.close();
		await testDatabase.stop();
	});

	// ===========================================================================
	// POST /todos - Todo 생성
	// ===========================================================================

	describe("POST /todos", () => {
		it("should create a new todo with title and content", async () => {
			const createDto = {
				title: "E2E Test Todo",
				content: "This is an E2E test content",
			};

			const response = await request(app.getHttpServer())
				.post("/todos")
				.send(createDto)
				.expect(201);

			expect(response.body.success).toBe(true);
			expect(response.body.data).toMatchObject({
				title: createDto.title,
				content: createDto.content,
				completed: false,
			});
			expect(response.body.data.id).toBeDefined();
			expect(response.body.data.createdAt).toBeDefined();
			expect(response.body.data.updatedAt).toBeDefined();
			expect(response.body.timestamp).toBeDefined();

			// 정리
			await request(app.getHttpServer()).delete(
				`/todos/${response.body.data.id}`,
			);
		});

		it("should create a todo with title only", async () => {
			const createDto = { title: "Title Only E2E Todo" };

			const response = await request(app.getHttpServer())
				.post("/todos")
				.send(createDto)
				.expect(201);

			expect(response.body.success).toBe(true);
			expect(response.body.data.title).toBe(createDto.title);
			expect(response.body.data.content).toBeNull();
			expect(response.body.data.completed).toBe(false);

			// 정리
			await request(app.getHttpServer()).delete(
				`/todos/${response.body.data.id}`,
			);
		});

		it("should return 400 for empty title", async () => {
			const invalidDto = { title: "" };

			const response = await request(app.getHttpServer())
				.post("/todos")
				.send(invalidDto)
				.expect(400);

			expect(response.body.success).toBe(false);
		});

		it("should return 400 for missing title", async () => {
			const invalidDto = { content: "Content without title" };

			const response = await request(app.getHttpServer())
				.post("/todos")
				.send(invalidDto)
				.expect(400);

			expect(response.body.success).toBe(false);
		});

		it("should return 400 for title exceeding max length", async () => {
			const invalidDto = { title: "a".repeat(201) }; // 200자 초과

			const response = await request(app.getHttpServer())
				.post("/todos")
				.send(invalidDto)
				.expect(400);

			expect(response.body.success).toBe(false);
		});
	});

	// ===========================================================================
	// GET /todos - 모든 Todo 조회
	// ===========================================================================

	describe("GET /todos", () => {
		it("should return paginated todos", async () => {
			const response = await request(app.getHttpServer())
				.get("/todos")
				.expect(200);

			expect(response.body.success).toBe(true);
			// 페이지네이션 응답 구조: { items: [...], pagination: {...} }
			expect(response.body.data).toHaveProperty("items");
			expect(response.body.data).toHaveProperty("pagination");
			expect(Array.isArray(response.body.data.items)).toBe(true);
		});

		it("should include created todo in the list", async () => {
			// 먼저 todo 생성
			const createResponse = await request(app.getHttpServer())
				.post("/todos")
				.send({ title: "List Test Todo" })
				.expect(201);

			const createdId = createResponse.body.data.id;

			// 조회
			const response = await request(app.getHttpServer())
				.get("/todos")
				.expect(200);

			expect(response.body.success).toBe(true);
			// 페이지네이션 응답에서 items 배열 내에서 찾기
			const foundTodo = response.body.data.items.find(
				(todo: { id: number }) => todo.id === createdId,
			);
			expect(foundTodo).toBeDefined();
			expect(foundTodo.title).toBe("List Test Todo");

			// 정리
			await request(app.getHttpServer()).delete(`/todos/${createdId}`);
		});
	});

	// ===========================================================================
	// GET /todos/:id - Todo 상세 조회
	// ===========================================================================

	describe("GET /todos/:id", () => {
		it("should return a todo by id", async () => {
			// 먼저 todo 생성
			const createResponse = await request(app.getHttpServer())
				.post("/todos")
				.send({ title: "Get By Id Test", content: "Test content" })
				.expect(201);

			const createdId = createResponse.body.data.id;

			// 조회
			const response = await request(app.getHttpServer())
				.get(`/todos/${createdId}`)
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.id).toBe(createdId);
			expect(response.body.data.title).toBe("Get By Id Test");
			expect(response.body.data.content).toBe("Test content");

			// 정리
			await request(app.getHttpServer()).delete(`/todos/${createdId}`);
		});

		it("should return 404 for non-existent id", async () => {
			const response = await request(app.getHttpServer())
				.get("/todos/999999")
				.expect(404);

			expect(response.body.success).toBe(false);
		});

		it("should return 404 for invalid id format", async () => {
			// CUID 기반 ID를 사용하므로, 존재하지 않는 형식의 ID는 404 반환
			const response = await request(app.getHttpServer())
				.get("/todos/invalid")
				.expect(404);

			expect(response.body.success).toBe(false);
		});
	});

	// ===========================================================================
	// PUT /todos/:id - Todo 수정
	// ===========================================================================

	describe("PUT /todos/:id", () => {
		it("should update todo title", async () => {
			// 먼저 todo 생성
			const createResponse = await request(app.getHttpServer())
				.post("/todos")
				.send({ title: "Original Title", content: "Original content" })
				.expect(201);

			const createdId = createResponse.body.data.id;

			// 수정
			const updateDto = { title: "Updated E2E Title" };
			const response = await request(app.getHttpServer())
				.put(`/todos/${createdId}`)
				.send(updateDto)
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.id).toBe(createdId);
			expect(response.body.data.title).toBe("Updated E2E Title");
			expect(response.body.data.content).toBe("Original content"); // 변경되지 않음

			// 정리
			await request(app.getHttpServer()).delete(`/todos/${createdId}`);
		});

		it("should update todo completed status", async () => {
			// 먼저 todo 생성
			const createResponse = await request(app.getHttpServer())
				.post("/todos")
				.send({ title: "Complete Status Test" })
				.expect(201);

			const createdId = createResponse.body.data.id;

			// 수정
			const updateDto = { completed: true };
			const response = await request(app.getHttpServer())
				.put(`/todos/${createdId}`)
				.send(updateDto)
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.completed).toBe(true);

			// 정리
			await request(app.getHttpServer()).delete(`/todos/${createdId}`);
		});

		it("should update multiple fields at once", async () => {
			// 먼저 todo 생성
			const createResponse = await request(app.getHttpServer())
				.post("/todos")
				.send({ title: "Multi Update Test" })
				.expect(201);

			const createdId = createResponse.body.data.id;

			// 수정
			const updateDto = {
				title: "Final Updated Title",
				content: "Final Updated Content",
				completed: true,
			};
			const response = await request(app.getHttpServer())
				.put(`/todos/${createdId}`)
				.send(updateDto)
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.title).toBe("Final Updated Title");
			expect(response.body.data.content).toBe("Final Updated Content");
			expect(response.body.data.completed).toBe(true);

			// 정리
			await request(app.getHttpServer()).delete(`/todos/${createdId}`);
		});

		it("should return 404 for non-existent id", async () => {
			const updateDto = { title: "Should Not Update" };

			const response = await request(app.getHttpServer())
				.put("/todos/999999")
				.send(updateDto)
				.expect(404);

			expect(response.body.success).toBe(false);
		});

		it("should return 400 for invalid update data", async () => {
			// 먼저 todo 생성
			const createResponse = await request(app.getHttpServer())
				.post("/todos")
				.send({ title: "Invalid Update Test" })
				.expect(201);

			const createdId = createResponse.body.data.id;

			// 잘못된 데이터로 수정 시도
			const invalidDto = { title: "" };
			const response = await request(app.getHttpServer())
				.put(`/todos/${createdId}`)
				.send(invalidDto)
				.expect(400);

			expect(response.body.success).toBe(false);

			// 정리
			await request(app.getHttpServer()).delete(`/todos/${createdId}`);
		});
	});

	// ===========================================================================
	// DELETE /todos/:id - Todo 삭제
	// ===========================================================================

	describe("DELETE /todos/:id", () => {
		it("should return 404 for non-existent id", async () => {
			const response = await request(app.getHttpServer())
				.delete("/todos/999999")
				.expect(404);

			expect(response.body.success).toBe(false);
		});

		it("should delete the todo and return deleted data", async () => {
			// 삭제용 todo 생성
			const createResponse = await request(app.getHttpServer())
				.post("/todos")
				.send({ title: "Todo to Delete" })
				.expect(201);

			const todoIdToDelete = createResponse.body.data.id;

			// 삭제 수행
			const deleteResponse = await request(app.getHttpServer())
				.delete(`/todos/${todoIdToDelete}`)
				.expect(200);

			expect(deleteResponse.body.success).toBe(true);
			expect(deleteResponse.body.data.id).toBe(todoIdToDelete);
			expect(deleteResponse.body.data.title).toBe("Todo to Delete");

			// 삭제 확인
			await request(app.getHttpServer())
				.get(`/todos/${todoIdToDelete}`)
				.expect(404);
		});
	});

	// ===========================================================================
	// 통합 CRUD 시나리오
	// ===========================================================================

	describe("Full CRUD Flow", () => {
		it("should complete full CRUD cycle", async () => {
			// 1. Create
			const createResponse = await request(app.getHttpServer())
				.post("/todos")
				.send({ title: "CRUD Flow Todo", content: "Initial content" })
				.expect(201);

			expect(createResponse.body.success).toBe(true);
			const todoId = createResponse.body.data.id;
			expect(todoId).toBeDefined();

			// 2. Read
			const readResponse = await request(app.getHttpServer())
				.get(`/todos/${todoId}`)
				.expect(200);

			expect(readResponse.body.success).toBe(true);
			expect(readResponse.body.data.title).toBe("CRUD Flow Todo");

			// 3. Update
			const updateResponse = await request(app.getHttpServer())
				.put(`/todos/${todoId}`)
				.send({ title: "Updated CRUD Todo", completed: true })
				.expect(200);

			expect(updateResponse.body.success).toBe(true);
			expect(updateResponse.body.data.title).toBe("Updated CRUD Todo");
			expect(updateResponse.body.data.completed).toBe(true);

			// 4. Delete
			const deleteResponse = await request(app.getHttpServer())
				.delete(`/todos/${todoId}`)
				.expect(200);

			expect(deleteResponse.body.success).toBe(true);
			expect(deleteResponse.body.data.id).toBe(todoId);

			// 5. Verify deletion
			await request(app.getHttpServer()).get(`/todos/${todoId}`).expect(404);
		});
	});
});
