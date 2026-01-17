/**
 * Todo E2E 테스트
 *
 * @description
 * Todo CRUD 전체 플로우 테스트
 * Testcontainers를 사용하여 독립적인 PostgreSQL 환경에서 테스트합니다.
 */

import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { ZodValidationPipe } from "nestjs-zod";
import request from "supertest";
import type { App } from "supertest/types";
import { AppModule } from "@/app.module";
import { DatabaseService } from "@/database";
import { OAuthTokenVerifierService } from "@/modules/auth/services/oauth-token-verifier.service";
import { EmailService } from "@/modules/email/email.service";
import { FakeEmailService } from "../mocks/fake-email.service";
import { FakeOAuthTokenVerifierService } from "../mocks/fake-oauth-token-verifier.service";
import { TestDatabase } from "../setup/test-database";

describe("Todo (e2e)", () => {
	let app: INestApplication<App>;
	let testDatabase: TestDatabase;
	let fakeEmailService: FakeEmailService;
	let fakeOAuthTokenVerifierService: FakeOAuthTokenVerifierService;

	/**
	 * 테스트용 사용자 등록 및 인증 헬퍼
	 */
	async function createVerifiedUser(
		email: string,
		password: string,
	): Promise<string> {
		// 등록
		await request(app.getHttpServer())
			.post("/auth/register")
			.send({
				email,
				password,
				passwordConfirm: password,
				termsAgreed: true,
				privacyAgreed: true,
			})
			.expect(201);

		// 인증
		const code = fakeEmailService.getLastCode(email);
		const response = await request(app.getHttpServer())
			.post("/auth/verify-email")
			.send({ email, code })
			.expect(200);

		return response.body.data.accessToken;
	}

	beforeAll(async () => {
		// Testcontainers로 PostgreSQL 컨테이너 시작
		testDatabase = new TestDatabase();
		await testDatabase.start();

		// FakeEmailService 인스턴스 생성
		fakeEmailService = new FakeEmailService();

		// FakeOAuthTokenVerifierService 인스턴스 생성
		fakeOAuthTokenVerifierService = new FakeOAuthTokenVerifierService();

		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		})
			.overrideProvider(DatabaseService)
			.useValue(testDatabase.getPrisma())
			.overrideProvider(EmailService)
			.useValue(fakeEmailService)
			.overrideProvider(OAuthTokenVerifierService)
			.useValue(fakeOAuthTokenVerifierService)
			.compile();

		app = moduleFixture.createNestApplication();
		app.useGlobalPipes(new ZodValidationPipe());
		await app.init();
	}, 60000);

	afterAll(async () => {
		await app.close();
		await testDatabase.stop();
	});

	describe("Todo CRUD 플로우", () => {
		const testEmail = "todo-test@example.com";
		const testPassword = "Test1234!";
		let accessToken: string;
		let createdTodoId: string;

		beforeAll(async () => {
			accessToken = await createVerifiedUser(testEmail, testPassword);
		});

		describe("POST /todos - 할 일 생성", () => {
			it("필수 필드만으로 할 일 생성", async () => {
				const response = await request(app.getHttpServer())
					.post("/todos")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						title: "테스트 할 일",
						startDate: "2024-01-15",
					})
					.expect(201);

				expect(response.body.data.message).toBe("할 일이 생성되었습니다.");
				expect(response.body.data.todo).toMatchObject({
					title: "테스트 할 일",
					startDate: "2024-01-15",
					completed: false,
					isAllDay: true,
					visibility: "PUBLIC",
				});
				expect(response.body.data.todo.id).toBeDefined();

				createdTodoId = response.body.data.todo.id;
			});

			it("모든 필드를 포함하여 할 일 생성", async () => {
				const response = await request(app.getHttpServer())
					.post("/todos")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						title: "운동하기",
						content: "헬스장에서 1시간 운동",
						color: "#FF5733",
						startDate: "2024-01-20",
						endDate: "2024-01-20",
						scheduledTime: "09:00",
						isAllDay: false,
						visibility: "PRIVATE",
					})
					.expect(201);

				expect(response.body.data.todo).toMatchObject({
					title: "운동하기",
					content: "헬스장에서 1시간 운동",
					color: "#FF5733",
					startDate: "2024-01-20",
					endDate: "2024-01-20",
					isAllDay: false,
					visibility: "PRIVATE",
				});
				expect(response.body.data.todo.scheduledTime).toBeTruthy();
			});

			it("인증 없이 생성 시도 시 401 에러", async () => {
				await request(app.getHttpServer())
					.post("/todos")
					.send({
						title: "테스트",
						startDate: "2024-01-15",
					})
					.expect(401);
			});

			it("필수 필드 누락 시 400 에러", async () => {
				const response = await request(app.getHttpServer())
					.post("/todos")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						content: "내용만 있음",
					})
					.expect(400);

				expect(response.body.success).toBe(false);
			});

			it("잘못된 날짜 형식 시 400 에러", async () => {
				const response = await request(app.getHttpServer())
					.post("/todos")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						title: "테스트",
						startDate: "invalid-date",
					})
					.expect(400);

				expect(response.body.success).toBe(false);
			});
		});

		describe("GET /todos - 할 일 목록 조회", () => {
			it("할 일 목록 조회 성공", async () => {
				const response = await request(app.getHttpServer())
					.get("/todos")
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(200);

				expect(response.body.data.items).toBeDefined();
				expect(Array.isArray(response.body.data.items)).toBe(true);
				expect(response.body.data.items.length).toBeGreaterThan(0);
				expect(response.body.data.pagination).toBeDefined();
			});

			it("페이지 크기 지정하여 조회", async () => {
				const response = await request(app.getHttpServer())
					.get("/todos")
					.query({ size: 1 })
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(200);

				expect(response.body.data.items.length).toBeLessThanOrEqual(1);
				expect(response.body.data.pagination.size).toBe(1);
			});

			it("완료 상태로 필터링", async () => {
				// 미완료 항목만 조회
				const response = await request(app.getHttpServer())
					.get("/todos")
					.query({ completed: false })
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(200);

				for (const item of response.body.data.items) {
					expect(item.completed).toBe(false);
				}
			});

			it("날짜 범위로 필터링", async () => {
				const response = await request(app.getHttpServer())
					.get("/todos")
					.query({
						startDate: "2024-01-01",
						endDate: "2024-01-31",
					})
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(200);

				expect(response.body.data.items).toBeDefined();
			});

			it("인증 없이 조회 시도 시 401 에러", async () => {
				await request(app.getHttpServer()).get("/todos").expect(401);
			});
		});

		describe("GET /todos/:id - 할 일 상세 조회", () => {
			it("할 일 상세 조회 성공", async () => {
				const response = await request(app.getHttpServer())
					.get(`/todos/${createdTodoId}`)
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(200);

				expect(response.body.data.id).toBe(createdTodoId);
				expect(response.body.data.title).toBe("테스트 할 일");
			});

			it("존재하지 않는 ID로 조회 시 404 에러", async () => {
				const response = await request(app.getHttpServer())
					.get("/todos/999999")
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(404);

				expect(response.body.success).toBe(false);
				expect(response.body.error.code).toBe("TODO_0801");
			});

			it("인증 없이 조회 시도 시 401 에러", async () => {
				await request(app.getHttpServer())
					.get(`/todos/${createdTodoId}`)
					.expect(401);
			});
		});

		describe("PATCH /todos/:id - 할 일 수정", () => {
			it("제목 수정 성공", async () => {
				const response = await request(app.getHttpServer())
					.patch(`/todos/${createdTodoId}`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						title: "수정된 할 일",
					})
					.expect(200);

				expect(response.body.data.message).toBe("할 일이 수정되었습니다.");
				expect(response.body.data.todo.title).toBe("수정된 할 일");
			});

			it("완료 처리 성공", async () => {
				const response = await request(app.getHttpServer())
					.patch(`/todos/${createdTodoId}`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						completed: true,
					})
					.expect(200);

				expect(response.body.data.todo.completed).toBe(true);
				expect(response.body.data.todo.completedAt).toBeTruthy();
			});

			it("완료 취소 처리 성공", async () => {
				const response = await request(app.getHttpServer())
					.patch(`/todos/${createdTodoId}`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						completed: false,
					})
					.expect(200);

				expect(response.body.data.todo.completed).toBe(false);
				expect(response.body.data.todo.completedAt).toBeNull();
			});

			it("여러 필드 동시 수정 성공", async () => {
				const response = await request(app.getHttpServer())
					.patch(`/todos/${createdTodoId}`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						title: "최종 수정된 제목",
						content: "새로운 내용",
						color: "#00FF00",
					})
					.expect(200);

				expect(response.body.data.todo.title).toBe("최종 수정된 제목");
				expect(response.body.data.todo.content).toBe("새로운 내용");
				expect(response.body.data.todo.color).toBe("#00FF00");
			});

			it("null 값으로 필드 삭제 성공", async () => {
				const response = await request(app.getHttpServer())
					.patch(`/todos/${createdTodoId}`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						content: null,
						color: null,
					})
					.expect(200);

				expect(response.body.data.todo.content).toBeNull();
				expect(response.body.data.todo.color).toBeNull();
			});

			it("존재하지 않는 ID로 수정 시 404 에러", async () => {
				const response = await request(app.getHttpServer())
					.patch("/todos/999999")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ title: "수정" })
					.expect(404);

				expect(response.body.error.code).toBe("TODO_0801");
			});

			it("인증 없이 수정 시도 시 401 에러", async () => {
				await request(app.getHttpServer())
					.patch(`/todos/${createdTodoId}`)
					.send({ title: "수정" })
					.expect(401);
			});
		});

		describe("PATCH /todos/:id/complete - 완료 상태 토글", () => {
			it("미완료 상태에서 완료 처리 성공", async () => {
				// Given: 미완료 Todo 생성
				const createResponse = await request(app.getHttpServer())
					.post("/todos")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						title: "완료 테스트용 할 일",
						startDate: "2024-01-15",
					})
					.expect(201);

				const todoId = createResponse.body.data.todo.id;

				// When: 완료 처리
				const response = await request(app.getHttpServer())
					.patch(`/todos/${todoId}/complete`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ completed: true })
					.expect(200);

				// Then
				expect(response.body.data.todo.completed).toBe(true);
				expect(response.body.data.todo.completedAt).toBeTruthy();
			});

			it("완료 상태에서 미완료 처리 성공", async () => {
				// Given: 완료 상태 Todo 생성
				const createResponse = await request(app.getHttpServer())
					.post("/todos")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						title: "완료 취소 테스트용",
						startDate: "2024-01-15",
					})
					.expect(201);

				const todoId = createResponse.body.data.todo.id;

				// 먼저 완료 처리
				await request(app.getHttpServer())
					.patch(`/todos/${todoId}/complete`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ completed: true })
					.expect(200);

				// When: 미완료 처리
				const response = await request(app.getHttpServer())
					.patch(`/todos/${todoId}/complete`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ completed: false })
					.expect(200);

				// Then
				expect(response.body.data.todo.completed).toBe(false);
				expect(response.body.data.todo.completedAt).toBeNull();
			});

			it("존재하지 않는 Todo는 404 에러", async () => {
				const response = await request(app.getHttpServer())
					.patch("/todos/999999/complete")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ completed: true })
					.expect(404);

				expect(response.body.error.code).toBe("TODO_0801");
			});

			it("completed 필드 누락 시 400 에러", async () => {
				await request(app.getHttpServer())
					.patch(`/todos/${createdTodoId}/complete`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({})
					.expect(400);
			});
		});

		describe("PATCH /todos/:id/visibility - 공개 범위 변경", () => {
			it("PUBLIC에서 PRIVATE으로 변경 성공", async () => {
				// Given: PUBLIC Todo
				const createResponse = await request(app.getHttpServer())
					.post("/todos")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						title: "공개 범위 테스트",
						startDate: "2024-01-15",
						visibility: "PUBLIC",
					})
					.expect(201);

				const todoId = createResponse.body.data.todo.id;

				// When
				const response = await request(app.getHttpServer())
					.patch(`/todos/${todoId}/visibility`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ visibility: "PRIVATE" })
					.expect(200);

				// Then
				expect(response.body.data.todo.visibility).toBe("PRIVATE");
			});

			it("PRIVATE에서 PUBLIC으로 변경 성공", async () => {
				// Given: PRIVATE Todo
				const createResponse = await request(app.getHttpServer())
					.post("/todos")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						title: "비공개 할 일",
						startDate: "2024-01-15",
						visibility: "PRIVATE",
					})
					.expect(201);

				const todoId = createResponse.body.data.todo.id;

				// When
				const response = await request(app.getHttpServer())
					.patch(`/todos/${todoId}/visibility`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ visibility: "PUBLIC" })
					.expect(200);

				// Then
				expect(response.body.data.todo.visibility).toBe("PUBLIC");
			});

			it("잘못된 visibility 값은 400 에러", async () => {
				await request(app.getHttpServer())
					.patch(`/todos/${createdTodoId}/visibility`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ visibility: "INVALID" })
					.expect(400);
			});
		});

		describe("PATCH /todos/:id/color - 색상 변경", () => {
			it("색상 설정 성공", async () => {
				// When
				const response = await request(app.getHttpServer())
					.patch(`/todos/${createdTodoId}/color`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ color: "#FF5733" })
					.expect(200);

				// Then
				expect(response.body.data.todo.color).toBe("#FF5733");
			});

			it("색상 삭제 (null로 설정) 성공", async () => {
				// Given: 색상이 설정된 Todo
				await request(app.getHttpServer())
					.patch(`/todos/${createdTodoId}/color`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ color: "#00FF00" })
					.expect(200);

				// When: null로 설정
				const response = await request(app.getHttpServer())
					.patch(`/todos/${createdTodoId}/color`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ color: null })
					.expect(200);

				// Then
				expect(response.body.data.todo.color).toBeNull();
			});

			it("잘못된 HEX 색상 코드는 400 에러", async () => {
				await request(app.getHttpServer())
					.patch(`/todos/${createdTodoId}/color`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ color: "not-a-color" })
					.expect(400);
			});
		});

		describe("PATCH /todos/:id/schedule - 일정 변경", () => {
			it("일정 변경 성공 (종일 이벤트)", async () => {
				// When
				const response = await request(app.getHttpServer())
					.patch(`/todos/${createdTodoId}/schedule`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						startDate: "2024-02-01",
						endDate: "2024-02-02",
						isAllDay: true,
					})
					.expect(200);

				// Then
				expect(response.body.data.todo.startDate).toBe("2024-02-01");
				expect(response.body.data.todo.endDate).toBe("2024-02-02");
				expect(response.body.data.todo.isAllDay).toBe(true);
			});

			it("일정 변경 성공 (시간 지정)", async () => {
				// When
				const response = await request(app.getHttpServer())
					.patch(`/todos/${createdTodoId}/schedule`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						startDate: "2024-02-15",
						scheduledTime: "14:30",
						isAllDay: false,
					})
					.expect(200);

				// Then
				expect(response.body.data.todo.startDate).toBe("2024-02-15");
				expect(response.body.data.todo.isAllDay).toBe(false);
				expect(response.body.data.todo.scheduledTime).toBeTruthy();
			});

			it("startDate 필드 누락 시 400 에러", async () => {
				await request(app.getHttpServer())
					.patch(`/todos/${createdTodoId}/schedule`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ endDate: "2024-02-01" })
					.expect(400);
			});

			it("endDate가 startDate보다 이전이면 400 에러", async () => {
				await request(app.getHttpServer())
					.patch(`/todos/${createdTodoId}/schedule`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						startDate: "2024-02-15",
						endDate: "2024-02-10",
					})
					.expect(400);
			});
		});

		describe("PATCH /todos/:id/content - 제목/내용 수정", () => {
			it("제목만 수정 성공", async () => {
				// When
				const response = await request(app.getHttpServer())
					.patch(`/todos/${createdTodoId}/content`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ title: "SRP로 수정된 제목" })
					.expect(200);

				// Then
				expect(response.body.data.todo.title).toBe("SRP로 수정된 제목");
			});

			it("내용만 수정 성공", async () => {
				// When
				const response = await request(app.getHttpServer())
					.patch(`/todos/${createdTodoId}/content`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ content: "SRP로 수정된 내용" })
					.expect(200);

				// Then
				expect(response.body.data.todo.content).toBe("SRP로 수정된 내용");
			});

			it("제목과 내용 모두 수정 성공", async () => {
				// When
				const response = await request(app.getHttpServer())
					.patch(`/todos/${createdTodoId}/content`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						title: "새 제목",
						content: "새 내용",
					})
					.expect(200);

				// Then
				expect(response.body.data.todo.title).toBe("새 제목");
				expect(response.body.data.todo.content).toBe("새 내용");
			});

			it("빈 요청은 400 에러", async () => {
				await request(app.getHttpServer())
					.patch(`/todos/${createdTodoId}/content`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({})
					.expect(400);
			});

			it("제목이 200자 초과하면 400 에러", async () => {
				const longTitle = "a".repeat(201);

				await request(app.getHttpServer())
					.patch(`/todos/${createdTodoId}/content`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ title: longTitle })
					.expect(400);
			});
		});

		describe("DELETE /todos/:id - 할 일 삭제", () => {
			let todoToDelete: number;

			beforeAll(async () => {
				// 삭제 테스트용 할 일 생성
				const response = await request(app.getHttpServer())
					.post("/todos")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						title: "삭제될 할 일",
						startDate: "2024-01-25",
					})
					.expect(201);

				todoToDelete = response.body.data.todo.id;
			});

			it("할 일 삭제 성공", async () => {
				const response = await request(app.getHttpServer())
					.delete(`/todos/${todoToDelete}`)
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(200);

				expect(response.body.data.message).toBe("할 일이 삭제되었습니다.");

				// 삭제 확인
				await request(app.getHttpServer())
					.get(`/todos/${todoToDelete}`)
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(404);
			});

			it("존재하지 않는 ID로 삭제 시 404 에러", async () => {
				const response = await request(app.getHttpServer())
					.delete("/todos/999999")
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(404);

				expect(response.body.error.code).toBe("TODO_0801");
			});

			it("인증 없이 삭제 시도 시 401 에러", async () => {
				await request(app.getHttpServer())
					.delete(`/todos/${createdTodoId}`)
					.expect(401);
			});
		});
	});

	describe("사용자 격리 테스트", () => {
		const user1Email = "user1@example.com";
		const user2Email = "user2@example.com";
		const testPassword = "Test1234!";
		let user1Token: string;
		let user2Token: string;
		let user1TodoId: string;

		beforeAll(async () => {
			// 두 명의 사용자 생성
			user1Token = await createVerifiedUser(user1Email, testPassword);
			user2Token = await createVerifiedUser(user2Email, testPassword);

			// user1의 할 일 생성
			const response = await request(app.getHttpServer())
				.post("/todos")
				.set("Authorization", `Bearer ${user1Token}`)
				.send({
					title: "User1의 할 일",
					startDate: "2024-02-01",
				})
				.expect(201);

			user1TodoId = response.body.data.todo.id;
		});

		it("다른 사용자의 할 일 조회 시 404 에러", async () => {
			const response = await request(app.getHttpServer())
				.get(`/todos/${user1TodoId}`)
				.set("Authorization", `Bearer ${user2Token}`)
				.expect(404);

			expect(response.body.error.code).toBe("TODO_0801");
		});

		it("다른 사용자의 할 일 수정 시 404 에러", async () => {
			const response = await request(app.getHttpServer())
				.patch(`/todos/${user1TodoId}`)
				.set("Authorization", `Bearer ${user2Token}`)
				.send({ title: "해킹 시도" })
				.expect(404);

			expect(response.body.error.code).toBe("TODO_0801");
		});

		it("다른 사용자의 할 일 삭제 시 404 에러", async () => {
			const response = await request(app.getHttpServer())
				.delete(`/todos/${user1TodoId}`)
				.set("Authorization", `Bearer ${user2Token}`)
				.expect(404);

			expect(response.body.error.code).toBe("TODO_0801");
		});

		it("각 사용자는 자신의 할 일만 목록에서 조회됨", async () => {
			// user2의 할 일 생성
			await request(app.getHttpServer())
				.post("/todos")
				.set("Authorization", `Bearer ${user2Token}`)
				.send({
					title: "User2의 할 일",
					startDate: "2024-02-01",
				})
				.expect(201);

			// user1의 목록 조회
			const user1List = await request(app.getHttpServer())
				.get("/todos")
				.set("Authorization", `Bearer ${user1Token}`)
				.expect(200);

			// user2의 목록 조회
			const user2List = await request(app.getHttpServer())
				.get("/todos")
				.set("Authorization", `Bearer ${user2Token}`)
				.expect(200);

			// 각 사용자는 자신의 할 일만 볼 수 있음
			const user1Titles = user1List.body.data.items.map(
				(t: { title: string }) => t.title,
			);
			const user2Titles = user2List.body.data.items.map(
				(t: { title: string }) => t.title,
			);

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

		beforeAll(async () => {
			accessToken = await createVerifiedUser(paginationEmail, testPassword);

			// 10개의 할 일 생성
			for (let i = 0; i < 10; i++) {
				await request(app.getHttpServer())
					.post("/todos")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({
						title: `페이지네이션 테스트 ${i + 1}`,
						startDate: "2024-03-01",
					})
					.expect(201);
			}
		});

		it("커서 기반 페이지네이션 동작 확인", async () => {
			// 첫 페이지 조회 (5개)
			const page1 = await request(app.getHttpServer())
				.get("/todos")
				.query({ size: 5 })
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			expect(page1.body.data.items.length).toBe(5);
			expect(page1.body.data.pagination.hasNext).toBe(true);
			expect(page1.body.data.pagination.nextCursor).toBeTruthy();

			// 두 번째 페이지 조회
			const page2 = await request(app.getHttpServer())
				.get("/todos")
				.query({
					size: 5,
					cursor: page1.body.data.pagination.nextCursor,
				})
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			expect(page2.body.data.items.length).toBe(5);

			// 첫 페이지와 두 번째 페이지의 항목이 겹치지 않는지 확인
			const page1Ids = page1.body.data.items.map((t: { id: number }) => t.id);
			const page2Ids = page2.body.data.items.map((t: { id: number }) => t.id);

			for (const id of page1Ids) {
				expect(page2Ids).not.toContain(id);
			}
		});
	});

	describe("유효성 검사 테스트", () => {
		const validationEmail = "validation@example.com";
		const testPassword = "Test1234!";
		let accessToken: string;

		beforeAll(async () => {
			accessToken = await createVerifiedUser(validationEmail, testPassword);
		});

		it("제목이 200자 초과하면 400 에러", async () => {
			const longTitle = "a".repeat(201);

			const response = await request(app.getHttpServer())
				.post("/todos")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					title: longTitle,
					startDate: "2024-01-15",
				})
				.expect(400);

			expect(response.body.success).toBe(false);
		});

		it("잘못된 HEX 색상 코드는 400 에러", async () => {
			const response = await request(app.getHttpServer())
				.post("/todos")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					title: "테스트",
					startDate: "2024-01-15",
					color: "not-a-hex-color",
				})
				.expect(400);

			expect(response.body.success).toBe(false);
		});

		it("잘못된 visibility 값은 400 에러", async () => {
			const response = await request(app.getHttpServer())
				.post("/todos")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					title: "테스트",
					startDate: "2024-01-15",
					visibility: "INVALID",
				})
				.expect(400);

			expect(response.body.success).toBe(false);
		});

		it("잘못된 scheduledTime 형식은 400 에러", async () => {
			const response = await request(app.getHttpServer())
				.post("/todos")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					title: "테스트",
					startDate: "2024-01-15",
					scheduledTime: "25:00", // 잘못된 시간
				})
				.expect(400);

			expect(response.body.success).toBe(false);
		});
	});
});
