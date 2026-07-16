/**
 * TimezoneAwareReminderOrchestrator 통합 테스트
 *
 * @description
 * 오케스트레이터가 각 전략(Strategy)과 함께 올바르게 작동하는지 검증합니다.
 * 매분 스윕(handleMinuteSweep)에서 타임존별 로컬 시간에 따라 적절한 전략이 실행되는지 확인합니다.
 *
 * 통합 테스트의 목적:
 * - NestJS 의존성 주입이 올바르게 작동하는지 검증
 * - 타임존별 로컬 시간 변환 및 전략 분기가 정상 동작하는지 검증
 * - 전략 실행 조건(요일, 시간, 월 1일 등)이 올바르게 적용되는지 검증
 * - 한 타임존 실패가 다른 타임존에 영향을 주지 않는지 검증
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test scheduler.integration-spec
 * ```
 */

import { Test, type TestingModule } from "@nestjs/testing";
import { TEST_CUID } from "@test/fixtures";
import { suppressLogger } from "@test/setup/suppress-logger";
import {
	EveningReminderStrategy,
	LunchNudgeStrategy,
	MonthlyReportStrategy,
	MorningReminderStrategy,
	NudgeSuggestStrategy,
	OnboardingStrategy,
	SocialDigestStrategy,
	StreakAtRiskStrategy,
	TimezoneAwareReminderOrchestrator,
	WeatherEveningStrategy,
	WeatherMorningStrategy,
	WeeklyAchievementStrategy,
	WeeklyReportStrategy,
	WinbackStrategy,
} from "@/scheduler";
import { SCHEDULER_PREFERENCE_READER } from "@/scheduler/application/ports/scheduler-preference-reader.port";
import { TIMEZONE_REMINDER_ENQUEUER } from "@/scheduler/application/ports/timezone-reminder-enqueuer.port";
import { NOTIFICATION_SCHEDULE } from "@/scheduler/domain/services/notification-schedule";

describe("TimezoneAwareReminderOrchestrator 통합 테스트 (Mock 포트)", () => {
	let module: TestingModule;
	let orchestrator: TimezoneAwareReminderOrchestrator;

	// ── Strategy mocks ──────────────────────────────────────────────────
	const mockMorningReminder = {
		execute: jest.fn().mockResolvedValue({ sent: 0 }),
	};
	const mockEveningReminder = {
		execute: jest.fn().mockResolvedValue({ sent: 0, recipientUserIds: [] }),
	};
	const mockOnboarding = { execute: jest.fn().mockResolvedValue({ sent: 0 }) };
	const mockWeeklyReport = {
		execute: jest.fn().mockResolvedValue({ sent: 0 }),
	};
	const mockMonthlyReport = {
		execute: jest.fn().mockResolvedValue({ sent: 0 }),
	};
	const mockWeeklyAchievement = {
		execute: jest.fn().mockResolvedValue({ sent: 0 }),
	};
	const mockWinback = { execute: jest.fn().mockResolvedValue({ sent: 0 }) };
	const mockNudgeSuggest = {
		execute: jest.fn().mockResolvedValue({ sent: 0 }),
	};
	const mockSocialDigest = {
		execute: jest.fn().mockResolvedValue({ sent: 0 }),
	};
	const mockLunchNudge = { execute: jest.fn().mockResolvedValue({ sent: 0 }) };
	const mockStreakAtRisk = {
		execute: jest.fn().mockResolvedValue({ sent: 0 }),
	};
	const mockWeatherMorning = {
		execute: jest.fn().mockResolvedValue({ sent: 0 }),
	};
	const mockWeatherEvening = {
		execute: jest.fn().mockResolvedValue({ sent: 0 }),
	};

	// ── Port mocks ──────────────────────────────────────────────────────
	const mockPreferenceReader = {
		findActiveTimezones: jest.fn(),
		findUserLocales: jest.fn(),
	};

	const mockEnqueuer = {
		registerSweepScheduler: jest.fn(),
		enqueueReminderHourChanged: jest.fn(),
		enqueueSocialDigest: jest.fn(),
	};

	beforeAll(async () => {
		suppressLogger();

		module = await Test.createTestingModule({
			providers: [
				TimezoneAwareReminderOrchestrator,
				{
					provide: SCHEDULER_PREFERENCE_READER,
					useValue: mockPreferenceReader,
				},
				{ provide: TIMEZONE_REMINDER_ENQUEUER, useValue: mockEnqueuer },
				{ provide: MorningReminderStrategy, useValue: mockMorningReminder },
				{ provide: EveningReminderStrategy, useValue: mockEveningReminder },
				{ provide: OnboardingStrategy, useValue: mockOnboarding },
				{ provide: WeeklyReportStrategy, useValue: mockWeeklyReport },
				{ provide: MonthlyReportStrategy, useValue: mockMonthlyReport },
				{
					provide: WeeklyAchievementStrategy,
					useValue: mockWeeklyAchievement,
				},
				{ provide: WinbackStrategy, useValue: mockWinback },
				{ provide: NudgeSuggestStrategy, useValue: mockNudgeSuggest },
				{ provide: SocialDigestStrategy, useValue: mockSocialDigest },
				{ provide: LunchNudgeStrategy, useValue: mockLunchNudge },
				{ provide: StreakAtRiskStrategy, useValue: mockStreakAtRisk },
				{ provide: WeatherMorningStrategy, useValue: mockWeatherMorning },
				{ provide: WeatherEveningStrategy, useValue: mockWeatherEvening },
			],
		}).compile();

		orchestrator = module.get<TimezoneAwareReminderOrchestrator>(
			TimezoneAwareReminderOrchestrator,
		);
	});

	afterAll(async () => {
		await module.close();
		jest.restoreAllMocks();
	});

	beforeEach(() => {
		jest.useFakeTimers();
		jest.clearAllMocks();

		// 기본: 활성 타임존 조회 결과
		mockPreferenceReader.findActiveTimezones.mockResolvedValue(["Asia/Seoul"]);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe("handleMinuteSweep 전략 실행", () => {
		it("KST 08:00 — 아침 리마인더 전략이 실행된다", async () => {
			// Given - UTC 2026-03-15 23:00 = KST 2026-03-16 (월) 08:00
			jest.setSystemTime(new Date("2026-03-15T23:00:00Z"));

			// When - 매분 스윕 실행
			await orchestrator.handleMinuteSweep();

			// Then - 아침 리마인더가 실행되어야 함
			expect(mockMorningReminder.execute).toHaveBeenCalledWith(
				expect.objectContaining({
					tz: "Asia/Seoul",
					localHour: 8,
					localMinute: 0,
				}),
			);
			// 08:00에는 주간 리포트(09:00), 월간 리포트(10:00) 등은 실행되지 않음
			expect(mockWeeklyReport.execute).not.toHaveBeenCalled();
			expect(mockMonthlyReport.execute).not.toHaveBeenCalled();
			expect(mockWinback.execute).not.toHaveBeenCalled();
			expect(mockNudgeSuggest.execute).not.toHaveBeenCalled();
			expect(mockLunchNudge.execute).not.toHaveBeenCalled();
			expect(mockStreakAtRisk.execute).not.toHaveBeenCalled();
		});

		it("KST 18:00 — 저녁 리마인더 전략이 실행되고 SocialDigest가 지연 enqueue된다", async () => {
			// Given - UTC 2026-03-16 09:00 = KST 2026-03-16 (월) 18:00
			jest.setSystemTime(new Date("2026-03-16T09:00:00Z"));
			mockEveningReminder.execute.mockResolvedValue({
				sent: 5,
				recipientUserIds: [
					TEST_CUID.USER_1,
					TEST_CUID.USER_2,
					TEST_CUID.USER_3,
					TEST_CUID.USER_4,
					TEST_CUID.USER_5,
				],
			});

			// When - 매분 스윕 실행
			await orchestrator.handleMinuteSweep();

			// Then - 저녁 리마인더가 실행되고 SocialDigest enqueue
			expect(mockEveningReminder.execute).toHaveBeenCalledWith(
				expect.objectContaining({
					tz: "Asia/Seoul",
					localHour: 18,
					localMinute: 0,
				}),
			);
			expect(mockEnqueuer.enqueueSocialDigest).toHaveBeenCalledWith({
				timezone: "Asia/Seoul",
				recipientUserIds: [
					TEST_CUID.USER_1,
					TEST_CUID.USER_2,
					TEST_CUID.USER_3,
					TEST_CUID.USER_4,
					TEST_CUID.USER_5,
				],
			});
		});

		it("월요일 KST 11:30 — 주간 리포트 전략이 실행된다", async () => {
			// Given - UTC 2026-03-16 02:30 = KST 2026-03-16 (월) 11:30
			jest.setSystemTime(new Date("2026-03-16T02:30:00Z"));

			// When - 매분 스윕 실행
			await orchestrator.handleMinuteSweep();

			// Then - 주간 리포트가 실행되어야 함
			expect(mockWeeklyReport.execute).toHaveBeenCalledWith(
				expect.objectContaining({
					tz: "Asia/Seoul",
					localHour: NOTIFICATION_SCHEDULE.WEEKLY_REPORT.hour,
					localMinute: NOTIFICATION_SCHEDULE.WEEKLY_REPORT.minute,
				}),
			);
		});

		it("매월 1일 KST 11:30 — 월간 리포트 전략이 실행된다", async () => {
			// Given - UTC 2026-04-01 02:30 = KST 2026-04-01 (수) 11:30
			jest.setSystemTime(new Date("2026-04-01T02:30:00Z"));

			// When - 매분 스윕 실행
			await orchestrator.handleMinuteSweep();

			// Then - 월간 리포트가 실행되어야 함
			expect(mockMonthlyReport.execute).toHaveBeenCalledWith(
				expect.objectContaining({
					tz: "Asia/Seoul",
					localHour: NOTIFICATION_SCHEDULE.MONTHLY_REPORT.hour,
					localMinute: NOTIFICATION_SCHEDULE.MONTHLY_REPORT.minute,
				}),
			);
		});

		it("월요일 KST 11:30 — 주간 달성 전략이 실행된다", async () => {
			// Given - UTC 2026-03-16 02:30 = KST 2026-03-16 (월) 11:30
			jest.setSystemTime(new Date("2026-03-16T02:30:00Z"));

			// When - 매분 스윕 실행
			await orchestrator.handleMinuteSweep();

			// Then - 주간 달성 전략이 실행되어야 함
			expect(mockWeeklyAchievement.execute).toHaveBeenCalledWith(
				expect.objectContaining({
					tz: "Asia/Seoul",
					localHour: NOTIFICATION_SCHEDULE.WEEKLY_ACHIEVEMENT.hour,
					localMinute: NOTIFICATION_SCHEDULE.WEEKLY_ACHIEVEMENT.minute,
				}),
			);
		});
	});

	describe("handleMinuteSweep 오류 격리", () => {
		it("한 타임존 실패 시 — 다른 타임존은 정상 실행된다", async () => {
			// Given - 2개 타임존, 첫 번째 타임존에서 에러 발생
			jest.setSystemTime(new Date("2026-03-15T23:00:00Z"));

			mockPreferenceReader.findActiveTimezones.mockResolvedValue([
				"America/New_York",
				"Asia/Seoul",
			]);

			// America/New_York 처리 시 morningReminder에서 에러 발생
			let callCount = 0;
			mockMorningReminder.execute.mockImplementation(() => {
				callCount++;
				if (callCount === 1) {
					return Promise.reject(new Error("Strategy execution failed"));
				}
				return Promise.resolve({ sent: 0 });
			});

			// When - 매분 스윕 실행
			await orchestrator.handleMinuteSweep();

			// Then - morningReminder가 2번 호출됨 (각 타임존마다 1번)
			expect(mockMorningReminder.execute).toHaveBeenCalledTimes(2);
			// 두 번째 타임존(Asia/Seoul)도 정상 실행됨
			expect(mockMorningReminder.execute).toHaveBeenCalledWith(
				expect.objectContaining({
					tz: "Asia/Seoul",
				}),
			);
		});
	});

	describe("handleMinuteSweep 빈 타임존", () => {
		it("활성 타임존 없는 경우 — 전략이 실행되지 않는다", async () => {
			// Given - 활성 타임존 없음
			jest.setSystemTime(new Date("2026-03-15T23:00:00Z"));
			mockPreferenceReader.findActiveTimezones.mockResolvedValue([]);

			// When - 매분 스윕 실행
			await orchestrator.handleMinuteSweep();

			// Then - 어떤 전략도 실행되지 않아야 함
			expect(mockMorningReminder.execute).not.toHaveBeenCalled();
			expect(mockEveningReminder.execute).not.toHaveBeenCalled();
			expect(mockOnboarding.execute).not.toHaveBeenCalled();
			expect(mockWeeklyReport.execute).not.toHaveBeenCalled();
			expect(mockMonthlyReport.execute).not.toHaveBeenCalled();
			expect(mockWeeklyAchievement.execute).not.toHaveBeenCalled();
			expect(mockWinback.execute).not.toHaveBeenCalled();
			expect(mockNudgeSuggest.execute).not.toHaveBeenCalled();
			expect(mockSocialDigest.execute).not.toHaveBeenCalled();
			expect(mockLunchNudge.execute).not.toHaveBeenCalled();
			expect(mockStreakAtRisk.execute).not.toHaveBeenCalled();
		});
	});
});
