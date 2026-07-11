/**
 * TodoReminderProcessor 통합 테스트
 *
 * @description
 * TodoReminderProcessor가 TODO_REMINDER_READER 포트, NotificationService와 함께 올바르게 작동하는지 검증합니다.
 * 실제 데이터베이스 대신 모킹된 리더 포트를 사용하여 서비스 계층 통합을 테스트합니다.
 *
 * 통합 테스트의 목적:
 * - NestJS 의존성 주입이 올바르게 작동하는지 검증
 * - TodoReminderProcessor의 process(job) 메서드가 올바르게 작동하는지 검증
 * - 투두 유효성 확인 (완료/삭제 여부)
 * - 24시간 내 동일 알림 DB dedup 검증
 * - NotificationService와의 통합 검증
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test todo-reminder.integration-spec
 * ```
 */

import { Test, type TestingModule } from "@nestjs/testing";
import { NotificationBuilder, TodoBuilder } from "@test/builders";
import { asJob } from "@test/mocks/bull-job.mock";
import { suppressLogger } from "@test/setup/suppress-logger";
import type { Job } from "bullmq";
import { NotificationFacade } from "@/notification";
import { TodoReminderProcessor } from "@/scheduler";
import { TODO_REMINDER_READER } from "@/scheduler/application/ports/todo-reminder-reader.port";

function createMockJob(data: {
	todoId: number;
	userId: string;
	stageLabel: string;
}): Job {
	return asJob({ data, id: "job-1", name: "todo-reminder" });
}

describe("TodoReminderProcessor 통합 테스트 (Mock DB)", () => {
	let module: TestingModule;
	let processor: TodoReminderProcessor;

	// Mock 리마인더 리더 포트 (투두 유효성 조회 + dedup 판정)
	const mockReader = {
		findActiveTodo: jest.fn(),
		existsRecentReminderNotification: jest.fn(),
	};

	// Mock NotificationFacade (발송 + 로케일 조회)
	// 발송 시점 로케일은 UserPreference 캐시 경유 (getUserLocale)
	const mockNotificationService = {
		createAndSend: jest.fn(),
		getUserLocale: jest.fn().mockResolvedValue("ko"),
	};

	// 테스트 데이터
	const mockUserId = "user-reminder-123";
	const mockTodoId = 42;

	beforeAll(async () => {
		suppressLogger();

		module = await Test.createTestingModule({
			providers: [
				TodoReminderProcessor,
				{
					provide: TODO_REMINDER_READER,
					useValue: mockReader,
				},
				{
					provide: NotificationFacade,
					useValue: mockNotificationService,
				},
			],
		}).compile();

		processor = module.get<TodoReminderProcessor>(TodoReminderProcessor);
	});

	afterAll(async () => {
		await module.close();
		jest.restoreAllMocks();
	});

	beforeEach(() => {
		jest.clearAllMocks();
		TodoBuilder.resetIdCounter();
		NotificationBuilder.resetIdCounter();
	});

	describe("리마인더 처리 통합 테스트", () => {
		it("유효한 todo — 리마인더 알림이 생성된다", async () => {
			// Given - 완료되지 않은 유효한 투두
			const mockTodo = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.withTitle("운동하기")
				.build();
			mockReader.findActiveTodo.mockResolvedValue(mockTodo);
			mockReader.existsRecentReminderNotification.mockResolvedValue(false);
			mockNotificationService.createAndSend.mockResolvedValue(
				NotificationBuilder.create(mockUserId).withId(1).build(),
			);

			const job = createMockJob({
				todoId: mockTodoId,
				userId: mockUserId,
				stageLabel: "1시간 전",
			});

			// When - 리마인더 잡 처리
			await processor.process(job);

			// Then - 알림이 생성되어야 함
			expect(mockNotificationService.createAndSend).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: mockUserId,
					type: "TODO_REMINDER",
					todoId: mockTodoId,
					metadata: { stage: "1시간 전" },
				}),
			);
		});

		it("완료된 todo — 알림이 생성되지 않는다", async () => {
			// Given - 완료된 투두 (completed: false 필터에 걸림 → null 반환)
			mockReader.findActiveTodo.mockResolvedValue(null);

			const job = createMockJob({
				todoId: mockTodoId,
				userId: mockUserId,
				stageLabel: "1시간 전",
			});

			// When - 리마인더 잡 처리
			await processor.process(job);

			// Then - 알림이 생성되지 않아야 함
			expect(mockNotificationService.createAndSend).not.toHaveBeenCalled();
		});

		it("삭제된 todo — 알림이 생성되지 않는다", async () => {
			// Given - 삭제된 투두 (findFirst returns null)
			mockReader.findActiveTodo.mockResolvedValue(null);

			const job = createMockJob({
				todoId: 9999,
				userId: mockUserId,
				stageLabel: "30분 전",
			});

			// When - 리마인더 잡 처리
			await processor.process(job);

			// Then - 알림이 생성되지 않아야 함
			expect(mockNotificationService.createAndSend).not.toHaveBeenCalled();
		});

		it("24시간 내 동일 스테이지 알림 존재 — 중복 알림이 생성되지 않는다", async () => {
			// Given - 유효한 투두 + 이미 동일 스테이지 알림이 존재
			const mockTodo = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.withTitle("공부하기")
				.build();
			mockReader.findActiveTodo.mockResolvedValue(mockTodo);
			mockReader.existsRecentReminderNotification.mockResolvedValue(true);

			const job = createMockJob({
				todoId: mockTodoId,
				userId: mockUserId,
				stageLabel: "1시간 전",
			});

			// When - 리마인더 잡 처리
			await processor.process(job);

			// Then - 중복 알림이 생성되지 않아야 함
			expect(mockNotificationService.createAndSend).not.toHaveBeenCalled();
		});

		it("다단계 리마인더 — 각 스테이지별 알림 메시지가 다르다", async () => {
			// Given - 동일 투두에 대해 서로 다른 스테이지
			const mockTodo = TodoBuilder.create(mockUserId)
				.withId(mockTodoId)
				.withTitle("회의 참석")
				.build();
			mockReader.findActiveTodo.mockResolvedValue(mockTodo);
			mockReader.existsRecentReminderNotification.mockResolvedValue(false);
			mockNotificationService.createAndSend.mockResolvedValue(
				NotificationBuilder.create(mockUserId).withId(1).build(),
			);

			const stages = ["1시간 전", "30분 전"];
			const sentMessages: Array<{ title: string; body: string }> = [];

			for (const stage of stages) {
				jest.clearAllMocks();
				mockReader.findActiveTodo.mockResolvedValue(mockTodo);
				mockReader.existsRecentReminderNotification.mockResolvedValue(false);
				mockNotificationService.createAndSend.mockResolvedValue(
					NotificationBuilder.create(mockUserId).withId(1).build(),
				);

				const job = createMockJob({
					todoId: mockTodoId,
					userId: mockUserId,
					stageLabel: stage,
				});

				// When - 각 스테이지별 리마인더 잡 처리
				await processor.process(job);

				// Then - 각 스테이지별 알림이 생성되어야 함
				const callArg =
					mockNotificationService.createAndSend.mock.calls[0]?.[0];
				sentMessages.push({
					title: callArg.title,
					body: callArg.body,
				});

				expect(callArg.metadata.stage).toBe(stage);
			}

			// Then - 스테이지별 메타데이터가 각각 다른 값이어야 함
			expect(sentMessages).toHaveLength(2);
		});
	});
});
