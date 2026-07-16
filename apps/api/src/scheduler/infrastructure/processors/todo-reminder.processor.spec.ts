/**
 * TodoReminderProcessor 잡/프로세서 단위 테스트
 *
 * @description
 * TodoReminderProcessor의 비동기 작업 로직을 격리 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test todo-reminder.processor
 * ```
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createMockJob } from "@test/mocks";
import { NotificationFacade } from "@/notification";

import {
	TODO_REMINDER_READER,
	type TodoReminderReaderPort,
} from "../../application/ports/todo-reminder-reader.port";
import { SCHEDULER_CAMPAIGN_KEY } from "../../domain/services/notification-campaign";
import type { ReminderJobData } from "../scheduler/bullmq-reminder-scheduler.adapter";
import { TodoReminderProcessor } from "./todo-reminder.processor";

const USER_ID = "user-1";
const TODO_TITLE = "Test Todo";

const makeJob = (data: Partial<ReminderJobData> = {}) =>
	createMockJob("send-reminder", {
		todoId: data.todoId ?? 1,
		userId: data.userId ?? USER_ID,
		stageLabel: data.stageLabel ?? "60min",
	});

describe("TodoReminderProcessor — 할 일 리마인더 프로세서", () => {
	let processor: TodoReminderProcessor;
	let reader: Mocked<TodoReminderReaderPort>;
	let notification: Mocked<NotificationFacade>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			TodoReminderProcessor,
		).compile();

		processor = unit;
		reader = unitRef.get(TODO_REMINDER_READER);
		notification = unitRef.get(NotificationFacade);
		notification.getUserLocale.mockResolvedValue("ko");
	});

	/** 리더 mock 설정 헬퍼 */
	const setupMocks = (
		options: {
			todoExists?: boolean;
			notificationExists?: boolean;
			todoTitle?: string;
		} = {},
	) => {
		const {
			todoExists = true,
			notificationExists = false,
			todoTitle = TODO_TITLE,
		} = options;

		reader.findActiveTodo.mockResolvedValue(
			todoExists ? { id: 1, title: todoTitle } : null,
		);
		reader.existsRecentReminderNotification.mockResolvedValue(
			notificationExists,
		);
	};

	describe("onStalled", () => {
		it("stalled 발생 시 에러 없이 처리해야 한다", () => {
			expect(() => processor.onStalled("test-job-id")).not.toThrow();
		});
	});

	describe("정상 처리", () => {
		it("유효한 투두에 대해 알림을 발송한다", async () => {
			// Given
			setupMocks({ todoExists: true, notificationExists: false });
			notification.createAndSend.mockResolvedValue(null);

			// When
			await processor.process(makeJob({ todoId: 1, stageLabel: "60min" }));

			// Then
			expect(notification.createAndSend).toHaveBeenCalledTimes(1);
			expect(notification.createAndSend).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: USER_ID,
					type: "TODO_REMINDER",
					campaignKey: SCHEDULER_CAMPAIGN_KEY.TODO_REMINDER,
					variantId: expect.stringMatching(/^todo_reminder_v2\.60min\.v[1-4]$/),
					todoId: 1,
					metadata: { stage: "60min" },
				}),
			);
		});

		it("10min 단계 알림을 발송한다", async () => {
			// Given
			setupMocks({ todoExists: true, notificationExists: false });
			notification.createAndSend.mockResolvedValue(null);

			// When
			await processor.process(makeJob({ stageLabel: "10min" }));

			// Then
			expect(notification.createAndSend).toHaveBeenCalledWith(
				expect.objectContaining({ metadata: { stage: "10min" } }),
			);
		});

		it("immediate 단계 알림을 발송한다", async () => {
			// Given
			setupMocks({ todoExists: true, notificationExists: false });
			notification.createAndSend.mockResolvedValue(null);

			// When
			await processor.process(makeJob({ stageLabel: "immediate" }));

			// Then
			expect(notification.createAndSend).toHaveBeenCalledWith(
				expect.objectContaining({ metadata: { stage: "immediate" } }),
			);
		});

		it("스케줄링 이후 제목이 변경된 경우 DB의 최신 제목으로 알림을 발송한다", async () => {
			// Given — DB에는 변경된 제목
			setupMocks({
				todoExists: true,
				notificationExists: false,
				todoTitle: "밥먹고 약먹기",
			});
			notification.createAndSend.mockResolvedValue(null);

			// When
			await processor.process(makeJob({ todoId: 1, stageLabel: "60min" }));

			// Then — DB의 최신 제목이 알림에 사용되고 플레이스홀더는 남지 않음
			const payload = notification.createAndSend.mock.calls[0]?.[0];
			expect(payload?.title).toContain("밥먹고 약먹기");
			expect(payload?.title).not.toContain("{todoTitle}");
		});
	});

	describe("투두 유효성 검증", () => {
		it("투두가 완료되었으면 알림을 발송하지 않는다", async () => {
			// Given
			setupMocks({ todoExists: false });

			// When
			await processor.process(makeJob());

			// Then
			expect(notification.createAndSend).not.toHaveBeenCalled();
		});

		it("투두가 삭제되었으면 알림을 발송하지 않는다", async () => {
			// Given — findActiveTodo가 null 반환 (삭제됨)
			setupMocks({ todoExists: false });

			// When
			await processor.process(makeJob());

			// Then
			expect(notification.createAndSend).not.toHaveBeenCalled();
		});
	});

	describe("DB 중복 방지", () => {
		it("24시간 내 동일 알림이 있으면 스킵한다", async () => {
			// Given — 투두는 존재하지만 동일 알림이 이미 발송됨
			setupMocks({ todoExists: true, notificationExists: true });

			// When
			await processor.process(makeJob());

			// Then
			expect(notification.createAndSend).not.toHaveBeenCalled();
		});

		it("동일 알림이 없으면 정상 발송한다", async () => {
			// Given
			setupMocks({ todoExists: true, notificationExists: false });
			notification.createAndSend.mockResolvedValue(null);

			// When
			await processor.process(makeJob());

			// Then
			expect(notification.createAndSend).toHaveBeenCalledTimes(1);
		});
	});

	describe("에러 처리", () => {
		it("알림 발송 실패 시 에러가 전파된다 (BullMQ 재시도)", async () => {
			// Given
			setupMocks({ todoExists: true, notificationExists: false });
			notification.createAndSend.mockRejectedValue(new Error("Push failed"));

			// When & Then — BullMQ가 재시도하도록 에러 전파
			await expect(processor.process(makeJob())).rejects.toThrow("Push failed");
		});

		it("DB 조회 실패 시 에러가 전파된다 (BullMQ 재시도)", async () => {
			// Given
			reader.findActiveTodo.mockRejectedValue(
				new Error("DB connection failed"),
			);

			// When & Then
			await expect(processor.process(makeJob())).rejects.toThrow(
				"DB connection failed",
			);
		});
	});
});
