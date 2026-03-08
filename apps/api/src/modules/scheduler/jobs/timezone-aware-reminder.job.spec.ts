import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { DatabaseService } from "@/database/database.service";

import { TimezoneReminderQueueService } from "../queue";
import {
	EveningReminderStrategy,
	MorningReminderStrategy,
	NudgeSuggestStrategy,
	SocialDigestStrategy,
	WeeklyAchievementStrategy,
	WeeklyReportStrategy,
	WinbackStrategy,
} from "./strategies";
import { TimezoneAwareReminderJob } from "./timezone-aware-reminder.job";

// =============================================================================
// Tests — 오케스트레이터 단위 테스트
// Strategy는 모두 auto-mock, 오케스트레이션 로직만 검증
// =============================================================================

describe("TimezoneAwareReminderJob", () => {
	let job: TimezoneAwareReminderJob;
	let databaseService: Mocked<DatabaseService>;
	let queueService: Mocked<TimezoneReminderQueueService>;
	let morningReminder: Mocked<MorningReminderStrategy>;
	let eveningReminder: Mocked<EveningReminderStrategy>;
	let weeklyReport: Mocked<WeeklyReportStrategy>;
	let weeklyAchievement: Mocked<WeeklyAchievementStrategy>;
	let winback: Mocked<WinbackStrategy>;
	let nudgeSuggest: Mocked<NudgeSuggestStrategy>;
	let socialDigest: Mocked<SocialDigestStrategy>;

	beforeEach(async () => {
		jest.useFakeTimers();

		const { unit, unitRef } = await TestBed.solitary(
			TimezoneAwareReminderJob,
		).compile();

		job = unit;
		databaseService = unitRef.get(DatabaseService);
		queueService = unitRef.get(TimezoneReminderQueueService);
		morningReminder = unitRef.get(MorningReminderStrategy);
		eveningReminder = unitRef.get(EveningReminderStrategy);
		weeklyReport = unitRef.get(WeeklyReportStrategy);
		weeklyAchievement = unitRef.get(WeeklyAchievementStrategy);
		winback = unitRef.get(WinbackStrategy);
		nudgeSuggest = unitRef.get(NudgeSuggestStrategy);
		socialDigest = unitRef.get(SocialDigestStrategy);

		// 기본: 모든 Strategy는 { sent: 0 } 반환
		morningReminder.execute.mockResolvedValue({ sent: 0 });
		eveningReminder.execute.mockResolvedValue({ sent: 0 });
		weeklyReport.execute.mockResolvedValue({ sent: 0 });
		weeklyAchievement.execute.mockResolvedValue({ sent: 0 });
		winback.execute.mockResolvedValue({ sent: 0 });
		nudgeSuggest.execute.mockResolvedValue({ sent: 0 });
		socialDigest.execute.mockResolvedValue({ sent: 0 });
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	// =========================================================================
	// handleHourlySweep
	// =========================================================================

	describe("handleHourlySweep", () => {
		it("pushEnabled=true 타임존 목록을 조회하고 각 타임존별 Strategy를 호출한다", async () => {
			const fakeNow = new Date("2024-01-16T23:00:00Z"); // KST 08:00 (화요일)
			jest.setSystemTime(fakeNow);

			databaseService.userPreference.findMany.mockResolvedValue([
				{ timezone: "Asia/Seoul" },
			] as never);

			await job.handleHourlySweep();

			// 타임존 조회
			expect(databaseService.userPreference.findMany).toHaveBeenCalledWith({
				where: { pushEnabled: true },
				select: { timezone: true },
				distinct: ["timezone"],
			});

			// 아침/저녁 리마인더는 매분 호출
			expect(morningReminder.execute).toHaveBeenCalledTimes(1);
			expect(eveningReminder.execute).toHaveBeenCalledTimes(1);

			// context 검증
			const ctx = morningReminder.execute.mock.calls[0]?.[0];
			expect(ctx).toMatchObject({
				tz: "Asia/Seoul",
				localHour: 8,
				localMinute: 0,
			});
		});

		it("다중 타임존을 병렬 처리한다", async () => {
			const fakeNow = new Date("2024-01-16T23:00:00Z");
			jest.setSystemTime(fakeNow);

			databaseService.userPreference.findMany.mockResolvedValue([
				{ timezone: "Asia/Seoul" },
				{ timezone: "America/New_York" },
			] as never);

			await job.handleHourlySweep();

			// 각 타임존별로 morning/evening 호출
			expect(morningReminder.execute).toHaveBeenCalledTimes(2);
			expect(eveningReminder.execute).toHaveBeenCalledTimes(2);
		});

		it("pushEnabled=false인 타임존만 있으면 조회 결과가 비어 Strategy 미호출", async () => {
			databaseService.userPreference.findMany.mockResolvedValue([] as never);

			await job.handleHourlySweep();

			expect(morningReminder.execute).not.toHaveBeenCalled();
			expect(eveningReminder.execute).not.toHaveBeenCalled();
		});

		describe("조건부 Strategy 호출", () => {
			it("월요일(dayOfWeek=1)에 주간 리포트 Strategy를 호출한다", async () => {
				// 2024-01-15 = 월요일, KST 08:00 = UTC 2024-01-14T23:00:00Z
				const monday = new Date("2024-01-14T23:00:00Z");
				jest.useFakeTimers();
				jest.setSystemTime(monday);

				databaseService.userPreference.findMany.mockResolvedValue([
					{ timezone: "Asia/Seoul" },
				] as never);

				await job.handleHourlySweep();

				expect(weeklyReport.execute).toHaveBeenCalledTimes(1);
				expect(weeklyAchievement.execute).not.toHaveBeenCalled();

				jest.useRealTimers();
			});

			it("일요일(dayOfWeek=0)에 주간 달성 배지 Strategy를 호출한다", async () => {
				// 2024-01-14 = 일요일, KST 18:00 = UTC 2024-01-14T09:00:00Z
				const sunday = new Date("2024-01-14T09:00:00Z");
				jest.useFakeTimers();
				jest.setSystemTime(sunday);

				databaseService.userPreference.findMany.mockResolvedValue([
					{ timezone: "Asia/Seoul" },
				] as never);

				await job.handleHourlySweep();

				expect(weeklyAchievement.execute).toHaveBeenCalledTimes(1);
				expect(weeklyReport.execute).not.toHaveBeenCalled();

				jest.useRealTimers();
			});

			it("로컬 12:00에 Win-back Strategy를 호출한다", async () => {
				// KST 12:00 = UTC 03:00
				const noon = new Date("2024-01-16T03:00:00Z"); // 화요일
				jest.useFakeTimers();
				jest.setSystemTime(noon);

				databaseService.userPreference.findMany.mockResolvedValue([
					{ timezone: "Asia/Seoul" },
				] as never);

				await job.handleHourlySweep();

				expect(winback.execute).toHaveBeenCalledTimes(1);

				jest.useRealTimers();
			});

			it("로컬 12:01에는 Win-back Strategy를 호출하지 않는다", async () => {
				// KST 12:01 = UTC 03:01
				const notNoon = new Date("2024-01-16T03:01:00Z");
				jest.useFakeTimers();
				jest.setSystemTime(notNoon);

				databaseService.userPreference.findMany.mockResolvedValue([
					{ timezone: "Asia/Seoul" },
				] as never);

				await job.handleHourlySweep();

				expect(winback.execute).not.toHaveBeenCalled();

				jest.useRealTimers();
			});

			it("로컬 14:00에 Nudge Suggest Strategy를 호출한다", async () => {
				// KST 14:00 = UTC 05:00
				const afternoon = new Date("2024-01-16T05:00:00Z");
				jest.useFakeTimers();
				jest.setSystemTime(afternoon);

				databaseService.userPreference.findMany.mockResolvedValue([
					{ timezone: "Asia/Seoul" },
				] as never);

				await job.handleHourlySweep();

				expect(nudgeSuggest.execute).toHaveBeenCalledTimes(1);

				jest.useRealTimers();
			});
		});

		describe("Social Digest delayed job", () => {
			it("저녁 리마인더 발송 성공 시 Social Digest delayed job 등록", async () => {
				const fakeNow = new Date("2024-01-16T09:00:00Z"); // KST 18:00
				jest.useFakeTimers();
				jest.setSystemTime(fakeNow);

				databaseService.userPreference.findMany.mockResolvedValue([
					{ timezone: "Asia/Seoul" },
				] as never);

				eveningReminder.execute.mockResolvedValue({ sent: 3 });

				await job.handleHourlySweep();

				expect(queueService.enqueueSocialDigest).toHaveBeenCalledWith({
					timezone: "Asia/Seoul",
				});

				jest.useRealTimers();
			});

			it("저녁 리마인더 대상 없으면 Social Digest delayed job 미등록", async () => {
				const fakeNow = new Date("2024-01-16T09:00:00Z");
				jest.useFakeTimers();
				jest.setSystemTime(fakeNow);

				databaseService.userPreference.findMany.mockResolvedValue([
					{ timezone: "Asia/Seoul" },
				] as never);

				eveningReminder.execute.mockResolvedValue({ sent: 0 });

				await job.handleHourlySweep();

				expect(queueService.enqueueSocialDigest).not.toHaveBeenCalled();

				jest.useRealTimers();
			});
		});

		describe("에러 처리", () => {
			it("DB 에러 시 throw하지 않고 로깅", async () => {
				databaseService.userPreference.findMany.mockRejectedValue(
					new Error("DB Error"),
				);

				await expect(job.handleHourlySweep()).resolves.toBeUndefined();
			});

			it("한 타임존 Strategy 실패 시 다른 타임존은 정상 처리된다", async () => {
				const fakeNow = new Date("2024-01-16T23:00:00Z");
				jest.useFakeTimers();
				jest.setSystemTime(fakeNow);

				databaseService.userPreference.findMany.mockResolvedValue([
					{ timezone: "Asia/Seoul" },
					{ timezone: "America/New_York" },
				] as never);

				// 첫 번째 타임존에서 morning이 실패 → #processTimezone 전체가 reject
				morningReminder.execute
					.mockRejectedValueOnce(new Error("Strategy Error"))
					.mockResolvedValueOnce({ sent: 1 });

				await expect(job.handleHourlySweep()).resolves.toBeUndefined();

				// 두 번째 타임존의 morning/evening은 정상 호출
				expect(morningReminder.execute).toHaveBeenCalledTimes(2);
				// 첫 번째 타임존은 morning에서 throw 되어 evening 미도달, 두 번째만 호출
				expect(eveningReminder.execute).toHaveBeenCalledTimes(1);

				jest.useRealTimers();
			});
		});
	});

	// =========================================================================
	// handleReminderHourChanged
	// =========================================================================

	describe("handleReminderHourChanged", () => {
		it("변경된 아침 리마인더 시간이 현재 시:분과 일치하면 morning Strategy 호출", async () => {
			// KST 09:30
			const fakeNow = new Date("2024-01-16T00:30:00Z");
			jest.setSystemTime(fakeNow);

			await job.handleReminderHourChanged({
				userId: "user-1",
				timezone: "Asia/Seoul",
				morningReminderHour: 9,
				morningReminderMinute: 30,
			});

			expect(morningReminder.execute).toHaveBeenCalledTimes(1);
			const ctx = morningReminder.execute.mock.calls[0]?.[0];
			expect(ctx).toMatchObject({
				tz: "Asia/Seoul",
				localHour: 9,
				localMinute: 30,
				userId: "user-1",
			});
		});

		it("변경된 저녁 리마인더 시간이 현재 시:분과 일치하면 evening Strategy 호출", async () => {
			// KST 20:00
			const fakeNow = new Date("2024-01-16T11:00:00Z");
			jest.setSystemTime(fakeNow);

			await job.handleReminderHourChanged({
				userId: "user-1",
				timezone: "Asia/Seoul",
				eveningReminderHour: 20,
				eveningReminderMinute: 0,
			});

			expect(eveningReminder.execute).toHaveBeenCalledTimes(1);
		});

		it("변경된 시간이 현재 시와 불일치하면 Strategy 미호출", async () => {
			// KST 10:00
			const fakeNow = new Date("2024-01-16T01:00:00Z");
			jest.setSystemTime(fakeNow);

			await job.handleReminderHourChanged({
				userId: "user-1",
				timezone: "Asia/Seoul",
				morningReminderHour: 9, // 현재 10시인데 9시로 설정 → 불일치
			});

			expect(morningReminder.execute).not.toHaveBeenCalled();
		});

		it("변경된 분이 현재 분과 불일치하면 Strategy 미호출", async () => {
			// KST 09:15
			const fakeNow = new Date("2024-01-16T00:15:00Z");
			jest.setSystemTime(fakeNow);

			await job.handleReminderHourChanged({
				userId: "user-1",
				timezone: "Asia/Seoul",
				morningReminderHour: 9,
				morningReminderMinute: 30, // 현재 15분인데 30분으로 설정 → 불일치
			});

			expect(morningReminder.execute).not.toHaveBeenCalled();
		});

		it("에러 발생 시 throw하지 않고 로깅", async () => {
			const fakeNow = new Date("2024-01-16T00:00:00Z");
			jest.setSystemTime(fakeNow);

			morningReminder.execute.mockRejectedValue(new Error("fail"));

			await expect(
				job.handleReminderHourChanged({
					userId: "user-1",
					timezone: "Asia/Seoul",
					morningReminderHour: 9,
					morningReminderMinute: 0,
				}),
			).resolves.toBeUndefined();
		});
	});

	// =========================================================================
	// handleSocialDigest
	// =========================================================================

	describe("handleSocialDigest", () => {
		it("socialDigest Strategy에 위임한다", async () => {
			jest.setSystemTime(new Date("2024-01-16T09:00:00Z"));

			await job.handleSocialDigest({ timezone: "Asia/Seoul" });

			expect(socialDigest.execute).toHaveBeenCalledTimes(1);
			const ctx = socialDigest.execute.mock.calls[0]?.[0];
			expect(ctx).toMatchObject({ tz: "Asia/Seoul" });
		});

		it("에러 발생 시 throw하지 않고 로깅", async () => {
			jest.setSystemTime(new Date("2024-01-16T09:00:00Z"));

			socialDigest.execute.mockRejectedValue(new Error("fail"));

			await expect(
				job.handleSocialDigest({ timezone: "Asia/Seoul" }),
			).resolves.toBeUndefined();
		});
	});
});
