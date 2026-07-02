/**
 * TodoToggledHandler 단위 테스트
 *
 * Suites + 포트 mock 팩토리 + GWT 패턴
 * 완료/미완료 방향에 따른 부수효과 분기를 검증합니다.
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createTodoRepositoryMock } from "@test/mocks/ports";
import { FollowService } from "../../../follow/follow.service";
import { NotificationQueueService } from "../../../notification/queue/notification-queue.service";
import { REMINDER_SCHEDULER } from "../../../scheduler/reminder";
import { StreakService } from "../../../user-settings/services/streak.service";
import { TodoToggledEvent } from "../../domain/events/todo-toggled.event";
import type { TodoRepositoryPort } from "../ports/todo.repository.port";
import { TODO_REPOSITORY } from "../ports/todo.repository.port";
import { TodoToggledHandler } from "./todo-toggled.handler";

/** 마이크로태스크 큐를 비워 fire-and-forget 비동기 부수효과를 완료시킨다 */
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe("TodoToggledHandler — 완료 토글 이벤트 핸들러", () => {
	let handler: TodoToggledHandler;
	let todoRepository: Mocked<TodoRepositoryPort>;
	let followService: Mocked<FollowService>;
	let notificationQueueService: Mocked<NotificationQueueService>;
	let streakService: Mocked<StreakService>;
	let reminderScheduler: {
		scheduleReminder: jest.Mock;
		cancelReminder: jest.Mock;
	};

	beforeEach(async () => {
		reminderScheduler = {
			scheduleReminder: jest.fn(),
			cancelReminder: jest.fn(),
		};

		const { unit, unitRef } = await TestBed.solitary(TodoToggledHandler)
			.mock<TodoRepositoryPort>(TODO_REPOSITORY)
			.impl(() => createTodoRepositoryMock())
			.mock(REMINDER_SCHEDULER)
			.impl(() => reminderScheduler)
			.compile();

		handler = unit;
		todoRepository = unitRef.get<TodoRepositoryPort>(TODO_REPOSITORY);
		followService = unitRef.get(FollowService);
		notificationQueueService = unitRef.get(NotificationQueueService);
		streakService = unitRef.get(StreakService);
	});

	it("완료로 토글되면 리마인더를 취소하고 스트릭을 갱신한다", async () => {
		// Given - 오늘 할일 통계/마일스톤 없음
		todoRepository.getTodayTodoStats.mockResolvedValue({
			total: 1,
			completed: 0,
		});
		todoRepository.countCompletedByUser.mockResolvedValue(5);

		// When
		handler.handle(new TodoToggledEvent(1, "user-123", true, "UTC"));
		await flush();

		// Then
		expect(reminderScheduler.cancelReminder).toHaveBeenCalledWith(1);
		expect(streakService.onTodoToggled).toHaveBeenCalledWith(
			"user-123",
			true,
			"UTC",
		);
	});

	it("오늘 할일을 전부 완료하면 친구 완료 알림을 큐에 등록한다", async () => {
		// Given - 오늘 할일 전부 완료 + 맞팔 친구 존재
		todoRepository.getTodayTodoStats.mockResolvedValue({
			total: 3,
			completed: 3,
		});
		todoRepository.countCompletedByUser.mockResolvedValue(7);
		followService.getMutualFriendIds.mockResolvedValue(["friend-1"]);
		followService.getUserDisplayName.mockResolvedValue("홍길동");

		// When
		handler.handle(new TodoToggledEvent(1, "user-123", true, "Asia/Seoul"));
		await flush();

		// Then
		expect(
			notificationQueueService.enqueueFriendCompleted,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				friendId: "user-123",
				notifyUserIds: ["friend-1"],
			}),
		);
	});

	it("완료 카운트가 마일스톤이면 마일스톤 알림을 큐에 등록한다", async () => {
		// Given - 누적 완료 10개 (COUNT_10 마일스톤)
		todoRepository.getTodayTodoStats.mockResolvedValue({
			total: 1,
			completed: 0,
		});
		todoRepository.countCompletedByUser.mockResolvedValue(10);

		// When
		handler.handle(new TodoToggledEvent(1, "user-123", true, "UTC"));
		await flush();

		// Then
		expect(
			notificationQueueService.enqueueMilestoneReached,
		).toHaveBeenCalledWith({ userId: "user-123", milestone: "COUNT_10" });
	});

	it("미완료로 토글되면 스트릭만 갱신하고 완료 부수효과는 실행하지 않는다", async () => {
		// When - 미완료로 토글
		handler.handle(new TodoToggledEvent(1, "user-123", false, "UTC"));
		await flush();

		// Then
		expect(streakService.onTodoToggled).toHaveBeenCalledWith(
			"user-123",
			false,
			"UTC",
		);
		expect(reminderScheduler.cancelReminder).not.toHaveBeenCalled();
		expect(
			notificationQueueService.enqueueFriendCompleted,
		).not.toHaveBeenCalled();
		expect(
			notificationQueueService.enqueueMilestoneReached,
		).not.toHaveBeenCalled();
	});
});
