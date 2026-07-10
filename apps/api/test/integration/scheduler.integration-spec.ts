/**
 * TimezoneAwareReminderJob 통합 테스트
 *
 * @description
 * TimezoneAwareReminderJob이 각 전략(Strategy)과 함께 올바르게 작동하는지 검증합니다.
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
import { UserPreferenceBuilder } from "@test/builders";
import { createMockDatabaseService } from "@test/mocks/mock-database.factory";
import { suppressLogger } from "@test/setup/suppress-logger";
import { EveningReminderStrategy } from "@/scheduler/jobs/strategies/evening-reminder.strategy";
import { LunchNudgeStrategy } from "@/scheduler/jobs/strategies/lunch-nudge.strategy";
import { MonthlyReportStrategy } from "@/scheduler/jobs/strategies/monthly-report.strategy";
import { MorningReminderStrategy } from "@/scheduler/jobs/strategies/morning-reminder.strategy";
import { NudgeSuggestStrategy } from "@/scheduler/jobs/strategies/nudge-suggest.strategy";
import { OnboardingStrategy } from "@/scheduler/jobs/strategies/onboarding.strategy";
import { SocialDigestStrategy } from "@/scheduler/jobs/strategies/social-digest.strategy";
import { StreakAtRiskStrategy } from "@/scheduler/jobs/strategies/streak-at-risk.strategy";
import { WeatherEveningStrategy } from "@/scheduler/jobs/strategies/weather-evening.strategy";
import { WeatherMorningStrategy } from "@/scheduler/jobs/strategies/weather-morning.strategy";
import { WeeklyAchievementStrategy } from "@/scheduler/jobs/strategies/weekly-achievement.strategy";
import { WeeklyReportStrategy } from "@/scheduler/jobs/strategies/weekly-report.strategy";
import { WinbackStrategy } from "@/scheduler/jobs/strategies/winback.strategy";
import { TimezoneAwareReminderJob } from "@/scheduler/jobs/timezone-aware-reminder.job";
import { TimezoneReminderQueueService } from "@/scheduler/queue";
import { TimezoneReminderProcessor } from "@/scheduler/queue/timezone-reminder-queue.processor";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import { DatabaseService } from "@/shared/infrastructure/database/database.service";

describe("TimezoneAwareReminderJob 통합 테스트 (Mock DB)", () => {
	let module: TestingModule;
	let job: TimezoneAwareReminderJob;

	// ── Strategy mocks ──────────────────────────────────────────────────
	const mockMorningReminder = {
		execute: jest.fn().mockResolvedValue({ sent: 0 }),
	};
	const mockEveningReminder = {
		execute: jest.fn().mockResolvedValue({ sent: 0 }),
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

	// ── Infrastructure mocks ────────────────────────────────────────────
	const mockCacheService = {
		wrapActiveTimezones: jest
			.fn()
			.mockImplementation((factory: () => Promise<unknown>) => factory()),
		wrapAllTimezones: jest
			.fn()
			.mockImplementation((factory: () => Promise<unknown>) => factory()),
	};

	const mockUserPreferenceDb = {
		findMany: jest.fn(),
		groupBy: jest.fn(),
	};

	const mockDatabaseService = createMockDatabaseService({
		userPreference: mockUserPreferenceDb,
	});

	const mockQueueService = {
		registerSweepScheduler: jest.fn(),
		enqueueSocialDigest: jest.fn(),
	};

	const mockProcessor = {
		setReminderJob: jest.fn(),
	};

	beforeAll(async () => {
		suppressLogger();

		module = await Test.createTestingModule({
			providers: [
				TimezoneAwareReminderJob,
				{
					provide: DatabaseService,
					useValue: mockDatabaseService,
				},
				{
					provide: CacheService,
					useValue: mockCacheService,
				},
				{
					provide: TimezoneReminderQueueService,
					useValue: mockQueueService,
				},
				{
					provide: TimezoneReminderProcessor,
					useValue: mockProcessor,
				},
				{
					provide: MorningReminderStrategy,
					useValue: mockMorningReminder,
				},
				{
					provide: EveningReminderStrategy,
					useValue: mockEveningReminder,
				},
				{
					provide: OnboardingStrategy,
					useValue: mockOnboarding,
				},
				{
					provide: WeeklyReportStrategy,
					useValue: mockWeeklyReport,
				},
				{
					provide: MonthlyReportStrategy,
					useValue: mockMonthlyReport,
				},
				{
					provide: WeeklyAchievementStrategy,
					useValue: mockWeeklyAchievement,
				},
				{
					provide: WinbackStrategy,
					useValue: mockWinback,
				},
				{
					provide: NudgeSuggestStrategy,
					useValue: mockNudgeSuggest,
				},
				{
					provide: SocialDigestStrategy,
					useValue: mockSocialDigest,
				},
				{
					provide: LunchNudgeStrategy,
					useValue: mockLunchNudge,
				},
				{
					provide: StreakAtRiskStrategy,
					useValue: mockStreakAtRisk,
				},
				{
					provide: WeatherMorningStrategy,
					useValue: mockWeatherMorning,
				},
				{
					provide: WeatherEveningStrategy,
					useValue: mockWeatherEvening,
				},
			],
		}).compile();

		job = module.get<TimezoneAwareReminderJob>(TimezoneAwareReminderJob);
	});

	afterAll(async () => {
		await module.close();
		jest.restoreAllMocks();
	});

	beforeEach(() => {
		jest.useFakeTimers();
		jest.clearAllMocks();
		UserPreferenceBuilder.resetIdCounter();

		// 기본: pushEnabled 유저의 distinct timezone 조회 결과
		mockUserPreferenceDb.findMany.mockResolvedValue([
			UserPreferenceBuilder.create("user-1").withTimezone("Asia/Seoul").build(),
		]);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe("handleMinuteSweep 전략 실행", () => {
		it("KST 08:00 — 아침 리마인더 전략이 실행된다", async () => {
			// Given - UTC 2026-03-15 23:00 = KST 2026-03-16 (월) 08:00
			jest.setSystemTime(new Date("2026-03-15T23:00:00Z"));

			// When - 매분 스윕 실행
			await job.handleMinuteSweep();

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
			mockEveningReminder.execute.mockResolvedValue({ sent: 5 });

			// When - 매분 스윕 실행
			await job.handleMinuteSweep();

			// Then - 저녁 리마인더가 실행되고 SocialDigest enqueue
			expect(mockEveningReminder.execute).toHaveBeenCalledWith(
				expect.objectContaining({
					tz: "Asia/Seoul",
					localHour: 18,
					localMinute: 0,
				}),
			);
			expect(mockQueueService.enqueueSocialDigest).toHaveBeenCalledWith({
				timezone: "Asia/Seoul",
			});
		});

		it("월요일 KST 09:00 — 주간 리포트 전략이 실행된다", async () => {
			// Given - UTC 2026-03-16 00:00 = KST 2026-03-16 (월) 09:00
			jest.setSystemTime(new Date("2026-03-16T00:00:00Z"));

			// When - 매분 스윕 실행
			await job.handleMinuteSweep();

			// Then - 주간 리포트가 실행되어야 함
			expect(mockWeeklyReport.execute).toHaveBeenCalledWith(
				expect.objectContaining({
					tz: "Asia/Seoul",
					localHour: 9,
					localMinute: 0,
				}),
			);
		});

		it("매월 1일 KST 10:00 — 월간 리포트 전략이 실행된다", async () => {
			// Given - UTC 2026-04-01 01:00 = KST 2026-04-01 (수) 10:00
			jest.setSystemTime(new Date("2026-04-01T01:00:00Z"));

			// When - 매분 스윕 실행
			await job.handleMinuteSweep();

			// Then - 월간 리포트가 실행되어야 함
			expect(mockMonthlyReport.execute).toHaveBeenCalledWith(
				expect.objectContaining({
					tz: "Asia/Seoul",
					localHour: 10,
					localMinute: 0,
				}),
			);
		});

		it("월요일 KST 08:30 — 주간 달성 전략이 실행된다", async () => {
			// Given - UTC 2026-03-15 23:30 = KST 2026-03-16 (월) 08:30
			jest.setSystemTime(new Date("2026-03-15T23:30:00Z"));

			// When - 매분 스윕 실행
			await job.handleMinuteSweep();

			// Then - 주간 달성 전략이 실행되어야 함
			expect(mockWeeklyAchievement.execute).toHaveBeenCalledWith(
				expect.objectContaining({
					tz: "Asia/Seoul",
					localHour: 8,
					localMinute: 30,
				}),
			);
		});
	});

	describe("handleMinuteSweep 오류 격리", () => {
		it("한 타임존 실패 시 — 다른 타임존은 정상 실행된다", async () => {
			// Given - 2개 타임존, 첫 번째 타임존에서 에러 발생
			jest.setSystemTime(new Date("2026-03-15T23:00:00Z"));

			mockUserPreferenceDb.findMany.mockResolvedValue([
				UserPreferenceBuilder.create("user-ny")
					.withTimezone("America/New_York")
					.build(),
				UserPreferenceBuilder.create("user-seoul")
					.withTimezone("Asia/Seoul")
					.build(),
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
			await job.handleMinuteSweep();

			// Then - morningReminder가 2번 호출됨 (각 타임존마다 1번)
			expect(mockMorningReminder.execute).toHaveBeenCalledTimes(2);
			// 두 번째 타임존(Asia/Seoul)도 정상 실행됨
			expect(mockOnboarding.execute).toHaveBeenCalledWith(
				expect.objectContaining({
					tz: "Asia/Seoul",
				}),
			);
		});
	});

	describe("handleMinuteSweep 빈 타임존", () => {
		it("pushEnabled 사용자 없는 경우 — 전략이 실행되지 않는다", async () => {
			// Given - 활성 타임존 없음
			jest.setSystemTime(new Date("2026-03-15T23:00:00Z"));
			mockUserPreferenceDb.findMany.mockResolvedValue([]);

			// When - 매분 스윕 실행
			await job.handleMinuteSweep();

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
