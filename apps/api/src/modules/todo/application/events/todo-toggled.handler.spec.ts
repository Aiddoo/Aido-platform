/**
 * TodoToggledHandler 단위 테스트
 *
 * Suites + 포트 mock 팩토리 + GWT 패턴
 * 완료/미완료 방향에 따른 부수효과 분기를 검증합니다.
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import {
	createFriendMock,
	createStreakMock,
	createTodoNotificationMock,
	createTodoReadRepositoryMock,
} from "@test/mocks/ports";
import {
	type IReminderScheduler,
	REMINDER_SCHEDULER,
} from "../../../scheduler/reminder";
import { TodoToggledEvent } from "../../domain/events/todo-toggled.event";
import { FRIEND_PORT, type FriendPort } from "../ports/friend.port";
import { STREAK_PORT, type StreakPort } from "../ports/streak.port";
import {
	TODO_NOTIFICATION,
	type TodoNotificationPort,
} from "../ports/todo-notification.port";
import {
	TODO_READ_REPOSITORY,
	type TodoReadRepositoryPort,
} from "../ports/todo-read.repository.port";
import { TodoToggledHandler } from "./todo-toggled.handler";

/** 마이크로태스크 큐를 비워 fire-and-forget 비동기 부수효과를 완료시킨다 */
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe("TodoToggledHandler — 완료 토글 이벤트 핸들러", () => {
	let handler: TodoToggledHandler;
	let todoReadRepository: Mocked<TodoReadRepositoryPort>;
	let friendPort: Mocked<FriendPort>;
	let todoNotification: Mocked<TodoNotificationPort>;
	let streakPort: Mocked<StreakPort>;
	let reminderScheduler: IReminderScheduler;

	beforeEach(async () => {
		reminderScheduler = {
			scheduleReminder: jest.fn(),
			cancelReminder: jest.fn(),
		};

		const { unit, unitRef } = await TestBed.solitary(TodoToggledHandler)
			.mock<TodoReadRepositoryPort>(TODO_READ_REPOSITORY)
			.impl(() => createTodoReadRepositoryMock())
			.mock<FriendPort>(FRIEND_PORT)
			.impl(() => createFriendMock())
			.mock<StreakPort>(STREAK_PORT)
			.impl(() => createStreakMock())
			.mock<TodoNotificationPort>(TODO_NOTIFICATION)
			.impl(() => createTodoNotificationMock())
			.mock(REMINDER_SCHEDULER)
			.impl(() => reminderScheduler)
			.compile();

		handler = unit;
		todoReadRepository =
			unitRef.get<TodoReadRepositoryPort>(TODO_READ_REPOSITORY);
		friendPort = unitRef.get<FriendPort>(FRIEND_PORT);
		todoNotification = unitRef.get<TodoNotificationPort>(TODO_NOTIFICATION);
		streakPort = unitRef.get<StreakPort>(STREAK_PORT);
	});

	it("완료로 토글되면 리마인더를 취소하고 스트릭을 갱신한다", async () => {
		// Given - 오늘 할일 통계/마일스톤 없음
		todoReadRepository.getTodayTodoStats.mockResolvedValue({
			total: 1,
			completed: 0,
		});
		todoReadRepository.countCompletedByUser.mockResolvedValue(5);

		// When
		handler.handle(new TodoToggledEvent(1, "user-123", true, "UTC"));
		await flush();

		// Then
		expect(reminderScheduler.cancelReminder).toHaveBeenCalledWith(1);
		expect(streakPort.onTodoToggled).toHaveBeenCalledWith(
			"user-123",
			true,
			"UTC",
		);
	});

	it("오늘 할일을 전부 완료하면 친구 완료 알림을 큐에 등록한다", async () => {
		// Given - 오늘 할일 전부 완료 + 맞팔 친구 존재
		todoReadRepository.getTodayTodoStats.mockResolvedValue({
			total: 3,
			completed: 3,
		});
		todoReadRepository.countCompletedByUser.mockResolvedValue(7);
		friendPort.getMutualFriendIds.mockResolvedValue(["friend-1"]);
		friendPort.getUserDisplayName.mockResolvedValue("홍길동");

		// When
		handler.handle(new TodoToggledEvent(1, "user-123", true, "Asia/Seoul"));
		await flush();

		// Then
		expect(todoNotification.enqueueFriendCompleted).toHaveBeenCalledWith(
			expect.objectContaining({
				friendId: "user-123",
				notifyUserIds: ["friend-1"],
			}),
		);
	});

	it("완료 카운트가 마일스톤이면 마일스톤 알림을 큐에 등록한다", async () => {
		// Given - 누적 완료 10개 (COUNT_10 마일스톤)
		todoReadRepository.getTodayTodoStats.mockResolvedValue({
			total: 1,
			completed: 0,
		});
		todoReadRepository.countCompletedByUser.mockResolvedValue(10);

		// When
		handler.handle(new TodoToggledEvent(1, "user-123", true, "UTC"));
		await flush();

		// Then
		expect(todoNotification.enqueueMilestoneReached).toHaveBeenCalledWith({
			userId: "user-123",
			milestone: "COUNT_10",
		});
	});

	it("미완료로 토글되면 스트릭만 갱신하고 완료 부수효과는 실행하지 않는다", async () => {
		// When - 미완료로 토글
		handler.handle(new TodoToggledEvent(1, "user-123", false, "UTC"));
		await flush();

		// Then
		expect(streakPort.onTodoToggled).toHaveBeenCalledWith(
			"user-123",
			false,
			"UTC",
		);
		expect(reminderScheduler.cancelReminder).not.toHaveBeenCalled();
		expect(todoNotification.enqueueFriendCompleted).not.toHaveBeenCalled();
		expect(todoNotification.enqueueMilestoneReached).not.toHaveBeenCalled();
	});
});
