/**
 * StreakService 테스트 (Suites 패턴)
 *
 * @see https://docs.nestjs.com/recipes/suites
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { DatabaseService } from "@/database";
import type { UserPreference } from "@/generated/prisma/client";
import { NotificationQueueService } from "@/modules/notification/queue/notification-queue.service";

import { UserPreferenceRepository } from "../repositories/user-preference.repository";
import { StreakService } from "./streak.service";

describe("StreakService — 연속 달성 서비스", () => {
	let service: StreakService;
	let prefRepo: Mocked<UserPreferenceRepository>;
	let database: Mocked<DatabaseService>;
	let notificationQueueService: Mocked<NotificationQueueService>;

	const userId = "user-1";
	// 2026-03-07 UTC 자정 (테스트용 고정 날짜)
	const today = new Date("2026-03-07T00:00:00.000Z");
	const yesterday = new Date("2026-03-06T00:00:00.000Z");

	const basePref = {
		id: "pref-1",
		userId,
		pushEnabled: true,
		nightPushEnabled: true,
		timezone: "UTC",
		locale: "ko",
		morningReminderHour: 8,
		morningReminderMinute: 0,
		eveningReminderHour: 18,
		eveningReminderMinute: 0,
		timeFormat: "TWELVE_HOUR",
		weatherMorningEnabled: false,
		weatherMorningHour: 7,
		weatherMorningMinute: 0,
		weatherEveningEnabled: false,
		weatherEveningHour: 18,
		weatherEveningMinute: 0,
		currentStreak: 0,
		longestStreak: 0,
		lastCompletedDate: null,
	} satisfies UserPreference;

	beforeEach(async () => {
		// 시스템 시간을 테스트용 날짜로 고정 (todayInTimezone이 today를 반환하도록)
		jest.useFakeTimers({ now: new Date("2026-03-07T12:00:00.000Z") });

		// Given - Suites가 모든 의존성을 자동으로 mock
		const { unit, unitRef } = await TestBed.solitary(StreakService).compile();

		service = unit;
		prefRepo = unitRef.get(UserPreferenceRepository);
		database = unitRef.get(DatabaseService);
		notificationQueueService = unitRef.get(NotificationQueueService);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	/** 투두 통계 mock 헬퍼 */
	function mockTodoStats(total: number, completed: number) {
		const countMock = database.todo.count as jest.Mock;
		countMock
			.mockResolvedValueOnce(total) // total count
			.mockResolvedValueOnce(completed); // completed count
	}

	describe("onTodoToggled - 완료 시", () => {
		it("첫 전체 완료 시 스트릭 1로 시작", async () => {
			// Given - 투두 3개 중 3개 완료, 스트릭 없음
			mockTodoStats(3, 3);
			prefRepo.findByUserId.mockResolvedValue({ ...basePref });

			// When
			await service.onTodoToggled(userId, true, "UTC");

			// Then
			expect(prefRepo.updateStreak).toHaveBeenCalledWith(userId, {
				currentStreak: 1,
				longestStreak: 1,
				lastCompletedDate: expect.any(Date),
			});
		});

		it("연속 완료 시 스트릭 증가", async () => {
			// Given - 어제까지 5일 연속
			mockTodoStats(3, 3);
			prefRepo.findByUserId.mockResolvedValue({
				...basePref,
				currentStreak: 5,
				longestStreak: 5,
				lastCompletedDate: yesterday,
			});

			// When
			await service.onTodoToggled(userId, true, "UTC");

			// Then
			expect(prefRepo.updateStreak).toHaveBeenCalledWith(userId, {
				currentStreak: 6,
				longestStreak: 6,
				lastCompletedDate: expect.any(Date),
			});
		});

		it("이미 오늘 완료 처리 시 중복 갱신 안 함", async () => {
			// Given - 이미 오늘 lastCompletedDate 설정됨
			mockTodoStats(3, 3);
			prefRepo.findByUserId.mockResolvedValue({
				...basePref,
				currentStreak: 3,
				longestStreak: 3,
				lastCompletedDate: today,
			});

			// When
			await service.onTodoToggled(userId, true, "UTC");

			// Then - updateStreak 호출 안 됨
			expect(prefRepo.updateStreak).not.toHaveBeenCalled();
		});

		it("연속 끊김 후 완료 시 스트릭 1로 리셋", async () => {
			// Given - 2일 전이 lastCompletedDate (어제 빠짐)
			mockTodoStats(3, 3);
			prefRepo.findByUserId.mockResolvedValue({
				...basePref,
				currentStreak: 10,
				longestStreak: 10,
				lastCompletedDate: new Date("2026-03-05T00:00:00.000Z"),
			});

			// When
			await service.onTodoToggled(userId, true, "UTC");

			// Then - 스트릭 1로 리셋, longestStreak는 유지
			expect(prefRepo.updateStreak).toHaveBeenCalledWith(userId, {
				currentStreak: 1,
				longestStreak: 10,
				lastCompletedDate: expect.any(Date),
			});
		});

		it("투두 없으면 스트릭 갱신 안 함", async () => {
			// Given - 오늘 투두 없음
			mockTodoStats(0, 0);

			// When
			await service.onTodoToggled(userId, true, "UTC");

			// Then
			expect(prefRepo.findByUserId).not.toHaveBeenCalled();
			expect(prefRepo.updateStreak).not.toHaveBeenCalled();
		});

		it("일부만 완료 시 스트릭 갱신 안 함", async () => {
			// Given - 3개 중 2개만 완료
			mockTodoStats(3, 2);

			// When
			await service.onTodoToggled(userId, true, "UTC");

			// Then
			expect(prefRepo.findByUserId).not.toHaveBeenCalled();
		});

		it("최장 스트릭 갱신", async () => {
			// Given - 현재 스트릭이 최장과 같을 때
			mockTodoStats(3, 3);
			prefRepo.findByUserId.mockResolvedValue({
				...basePref,
				currentStreak: 14,
				longestStreak: 14,
				lastCompletedDate: yesterday,
			});

			// When
			await service.onTodoToggled(userId, true, "UTC");

			// Then
			expect(prefRepo.updateStreak).toHaveBeenCalledWith(userId, {
				currentStreak: 15,
				longestStreak: 15,
				lastCompletedDate: expect.any(Date),
			});
		});

		it("스트릭 3일 도달 시 STREAK_3 마일스톤 알림을 enqueue한다", async () => {
			// Given - 어제까지 2일 연속 (오늘 완료 시 3일)
			mockTodoStats(3, 3);
			prefRepo.findByUserId.mockResolvedValue({
				...basePref,
				currentStreak: 2,
				longestStreak: 2,
				lastCompletedDate: yesterday,
			});

			// When
			await service.onTodoToggled(userId, true, "UTC");

			// Then
			expect(prefRepo.updateStreak).toHaveBeenCalledWith(userId, {
				currentStreak: 3,
				longestStreak: 3,
				lastCompletedDate: expect.any(Date),
			});
			expect(
				notificationQueueService.enqueueMilestoneReached,
			).toHaveBeenCalledWith({
				userId,
				milestone: "STREAK_3",
			});
		});

		it("스트릭 3일이 아닌 경우 마일스톤 알림을 enqueue하지 않는다", async () => {
			// Given - 어제까지 5일 연속 (오늘 완료 시 6일)
			mockTodoStats(3, 3);
			prefRepo.findByUserId.mockResolvedValue({
				...basePref,
				currentStreak: 5,
				longestStreak: 5,
				lastCompletedDate: yesterday,
			});

			// When
			await service.onTodoToggled(userId, true, "UTC");

			// Then
			expect(prefRepo.updateStreak).toHaveBeenCalledWith(userId, {
				currentStreak: 6,
				longestStreak: 6,
				lastCompletedDate: expect.any(Date),
			});
			expect(
				notificationQueueService.enqueueMilestoneReached,
			).not.toHaveBeenCalled();
		});
	});

	describe("onTodoToggled - 완료 취소 시", () => {
		it("오늘 완료 취소 + 어제 완료 → 스트릭 1 감소", async () => {
			// Given - 오늘 3개 중 2개 완료 (방금 취소됨), 어제 전체 완료
			mockTodoStats(3, 2); // 오늘
			prefRepo.findByUserId.mockResolvedValue({
				...basePref,
				currentStreak: 5,
				longestStreak: 5,
				lastCompletedDate: today,
			});
			// 어제 통계 (onUncompleted 내부에서 조회)
			const countMock = database.todo.count as jest.Mock;
			countMock
				.mockResolvedValueOnce(3) // 어제 total
				.mockResolvedValueOnce(3); // 어제 completed

			// When
			await service.onTodoToggled(userId, false, "UTC");

			// Then
			expect(prefRepo.updateStreak).toHaveBeenCalledWith(userId, {
				currentStreak: 4,
				longestStreak: 5,
				lastCompletedDate: expect.any(Date), // yesterday
			});
		});

		it("오늘 완료 취소 + 어제 미완료 → 스트릭 리셋", async () => {
			// Given
			mockTodoStats(3, 2); // 오늘 전체 완료 아님
			prefRepo.findByUserId.mockResolvedValue({
				...basePref,
				currentStreak: 1,
				longestStreak: 5,
				lastCompletedDate: today,
			});
			// 어제 통계: 미완료
			const countMock = database.todo.count as jest.Mock;
			countMock
				.mockResolvedValueOnce(3) // 어제 total
				.mockResolvedValueOnce(1); // 어제 completed (미완료)

			// When
			await service.onTodoToggled(userId, false, "UTC");

			// Then
			expect(prefRepo.updateStreak).toHaveBeenCalledWith(userId, {
				currentStreak: 0,
				longestStreak: 5,
				lastCompletedDate: null,
			});
		});

		it("오늘 완료 처리 안 된 상태에서 취소 → 무시", async () => {
			// Given - lastCompletedDate가 어제 (오늘 완료 아님)
			mockTodoStats(3, 2);
			prefRepo.findByUserId.mockResolvedValue({
				...basePref,
				currentStreak: 3,
				longestStreak: 5,
				lastCompletedDate: yesterday,
			});

			// When
			await service.onTodoToggled(userId, false, "UTC");

			// Then - updateStreak 호출 안 됨
			expect(prefRepo.updateStreak).not.toHaveBeenCalled();
		});
	});

	describe("computeEffectiveStreak", () => {
		it("전체 완료 + 이미 DB 반영(오늘) → currentStreak 유지", () => {
			const result = StreakService.computeEffectiveStreak({
				currentStreak: 5,
				lastCompletedDate: today,
				todosCompleted: 3,
				todosTotal: 3,
				today,
			});

			expect(result).toEqual({ streak: 5, isAtRisk: false });
		});

		it("전체 완료 + 어제 마지막 완료(미반영) → currentStreak + 1", () => {
			const result = StreakService.computeEffectiveStreak({
				currentStreak: 5,
				lastCompletedDate: yesterday,
				todosCompleted: 3,
				todosTotal: 3,
				today,
			});

			expect(result).toEqual({ streak: 6, isAtRisk: false });
		});

		it("전체 완료 + 연속 끊김(2일 전) → streak 1로 리셋", () => {
			const result = StreakService.computeEffectiveStreak({
				currentStreak: 10,
				lastCompletedDate: new Date("2026-03-05T00:00:00.000Z"),
				todosCompleted: 3,
				todosTotal: 3,
				today,
			});

			expect(result).toEqual({ streak: 1, isAtRisk: false });
		});

		it("전체 완료 + lastCompletedDate null → streak 1", () => {
			const result = StreakService.computeEffectiveStreak({
				currentStreak: 0,
				lastCompletedDate: null,
				todosCompleted: 3,
				todosTotal: 3,
				today,
			});

			expect(result).toEqual({ streak: 1, isAtRisk: false });
		});

		it("미완료 + 2일 이상 연속 + 어제 완료 → isAtRisk true", () => {
			const result = StreakService.computeEffectiveStreak({
				currentStreak: 5,
				lastCompletedDate: yesterday,
				todosCompleted: 2,
				todosTotal: 3,
				today,
			});

			expect(result).toEqual({ streak: 5, isAtRisk: true });
		});

		it("미완료 + streak 1 → isAtRisk false (2일 미만)", () => {
			const result = StreakService.computeEffectiveStreak({
				currentStreak: 1,
				lastCompletedDate: yesterday,
				todosCompleted: 2,
				todosTotal: 3,
				today,
			});

			expect(result).toEqual({ streak: 1, isAtRisk: false });
		});

		it("미완료 + lastCompletedDate null → isAtRisk false", () => {
			const result = StreakService.computeEffectiveStreak({
				currentStreak: 0,
				lastCompletedDate: null,
				todosCompleted: 0,
				todosTotal: 3,
				today,
			});

			expect(result).toEqual({ streak: 0, isAtRisk: false });
		});

		it("투두 0개 → streak 유지, isAtRisk false", () => {
			const result = StreakService.computeEffectiveStreak({
				currentStreak: 3,
				lastCompletedDate: yesterday,
				todosCompleted: 0,
				todosTotal: 0,
				today,
			});

			expect(result).toEqual({ streak: 3, isAtRisk: false });
		});
	});

	describe("에러 처리", () => {
		it("에러 발생 시 throw하지 않고 로그만 출력", async () => {
			// Given
			const countMock = database.todo.count as jest.Mock;
			countMock.mockRejectedValue(new Error("DB error"));

			// When / Then - 에러 throw 없음
			await expect(
				service.onTodoToggled(userId, true, "UTC"),
			).resolves.toBeUndefined();
		});
	});
});
