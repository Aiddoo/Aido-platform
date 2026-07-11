/**
 * TimezoneAwareReminderOrchestrator 단위 테스트
 *
 * @description
 * 오케스트레이터의 타임존별 Strategy 위임 로직을 격리 테스트합니다.
 * Strategy는 모두 auto-mock, 오케스트레이션 로직만 검증합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test timezone-aware-reminder.orchestrator
 * ```
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import {
	SCHEDULER_PREFERENCE_READER,
	type SchedulerPreferenceReaderPort,
} from "../ports/scheduler-preference-reader.port";
import {
	TIMEZONE_REMINDER_ENQUEUER,
	type TimezoneReminderEnqueuerPort,
} from "../ports/timezone-reminder-enqueuer.port";
import {
	EveningReminderStrategy,
	MonthlyReportStrategy,
	MorningReminderStrategy,
	NudgeSuggestStrategy,
	SocialDigestStrategy,
	WeeklyAchievementStrategy,
	WeeklyReportStrategy,
	WinbackStrategy,
} from "../strategies";
import { TimezoneAwareReminderOrchestrator } from "./timezone-aware-reminder.orchestrator";

describe("TimezoneAwareReminderOrchestrator — 타임존 리마인더 오케스트레이터", () => {
	let orchestrator: TimezoneAwareReminderOrchestrator;
	let preferenceReader: Mocked<SchedulerPreferenceReaderPort>;
	let enqueuer: Mocked<TimezoneReminderEnqueuerPort>;
	let morningReminder: Mocked<MorningReminderStrategy>;
	let eveningReminder: Mocked<EveningReminderStrategy>;
	let weeklyAchievement: Mocked<WeeklyAchievementStrategy>;
	let winback: Mocked<WinbackStrategy>;
	let nudgeSuggest: Mocked<NudgeSuggestStrategy>;
	let socialDigest: Mocked<SocialDigestStrategy>;
	let weeklyReport: Mocked<WeeklyReportStrategy>;
	let monthlyReport: Mocked<MonthlyReportStrategy>;

	beforeEach(async () => {
		jest.useFakeTimers();

		const { unit, unitRef } = await TestBed.solitary(
			TimezoneAwareReminderOrchestrator,
		).compile();

		orchestrator = unit;
		preferenceReader = unitRef.get(SCHEDULER_PREFERENCE_READER);
		enqueuer = unitRef.get(TIMEZONE_REMINDER_ENQUEUER);
		morningReminder = unitRef.get(MorningReminderStrategy);
		eveningReminder = unitRef.get(EveningReminderStrategy);
		weeklyAchievement = unitRef.get(WeeklyAchievementStrategy);
		winback = unitRef.get(WinbackStrategy);
		nudgeSuggest = unitRef.get(NudgeSuggestStrategy);
		socialDigest = unitRef.get(SocialDigestStrategy);
		weeklyReport = unitRef.get(WeeklyReportStrategy);
		monthlyReport = unitRef.get(MonthlyReportStrategy);

		// 기본: 활성 타임존 없음 + 모든 Strategy는 { sent: 0 } 반환
		preferenceReader.findActiveTimezones.mockResolvedValue([]);
		morningReminder.execute.mockResolvedValue({ sent: 0 });
		eveningReminder.execute.mockResolvedValue({ sent: 0 });
		weeklyAchievement.execute.mockResolvedValue({ sent: 0 });
		winback.execute.mockResolvedValue({ sent: 0 });
		nudgeSuggest.execute.mockResolvedValue({ sent: 0 });
		socialDigest.execute.mockResolvedValue({ sent: 0 });
		weeklyReport.execute.mockResolvedValue({ sent: 0 });
		monthlyReport.execute.mockResolvedValue({ sent: 0 });
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe("handleMinuteSweep", () => {
		it("활성 타임존을 조회하고 각 타임존별 Strategy를 호출한다", async () => {
			// Given
			const fakeNow = new Date("2024-01-16T23:00:00Z"); // KST 08:00 (화요일)
			jest.setSystemTime(fakeNow);

			preferenceReader.findActiveTimezones.mockResolvedValue(["Asia/Seoul"]);

			// When
			await orchestrator.handleMinuteSweep();

			// Then
			expect(preferenceReader.findActiveTimezones).toHaveBeenCalledTimes(1);

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
			// Given
			const fakeNow = new Date("2024-01-16T23:00:00Z");
			jest.setSystemTime(fakeNow);

			preferenceReader.findActiveTimezones.mockResolvedValue([
				"Asia/Seoul",
				"America/New_York",
			]);

			// When
			await orchestrator.handleMinuteSweep();

			// Then
			expect(morningReminder.execute).toHaveBeenCalledTimes(2);
			expect(eveningReminder.execute).toHaveBeenCalledTimes(2);
		});

		it("조회 결과가 비어있으면 Strategy 미호출", async () => {
			// Given
			preferenceReader.findActiveTimezones.mockResolvedValue([]);

			// When
			await orchestrator.handleMinuteSweep();

			// Then
			expect(morningReminder.execute).not.toHaveBeenCalled();
			expect(eveningReminder.execute).not.toHaveBeenCalled();
		});

		describe("조건부 Strategy 호출", () => {
			it("월요일 08:30에 주간 달성 배지 Strategy를 호출한다", async () => {
				// 2024-01-15 = 월요일, KST 08:30 = UTC 2024-01-14T23:30:00Z
				jest.setSystemTime(new Date("2024-01-14T23:30:00Z"));
				preferenceReader.findActiveTimezones.mockResolvedValue(["Asia/Seoul"]);

				await orchestrator.handleMinuteSweep();

				expect(weeklyAchievement.execute).toHaveBeenCalledTimes(1);
			});

			it("일요일 08:30에는 주간 달성 배지 Strategy를 호출하지 않는다", async () => {
				// 2024-01-14 = 일요일, KST 08:30 = UTC 2024-01-13T23:30:00Z
				jest.setSystemTime(new Date("2024-01-13T23:30:00Z"));
				preferenceReader.findActiveTimezones.mockResolvedValue(["Asia/Seoul"]);

				await orchestrator.handleMinuteSweep();

				expect(weeklyAchievement.execute).not.toHaveBeenCalled();
			});

			it("로컬 12:00에 Win-back Strategy를 호출한다", async () => {
				// KST 12:00 = UTC 03:00 (화요일)
				jest.setSystemTime(new Date("2024-01-16T03:00:00Z"));
				preferenceReader.findActiveTimezones.mockResolvedValue(["Asia/Seoul"]);

				await orchestrator.handleMinuteSweep();

				expect(winback.execute).toHaveBeenCalledTimes(1);
			});

			it("로컬 12:01에는 Win-back Strategy를 호출하지 않는다", async () => {
				jest.setSystemTime(new Date("2024-01-16T03:01:00Z"));
				preferenceReader.findActiveTimezones.mockResolvedValue(["Asia/Seoul"]);

				await orchestrator.handleMinuteSweep();

				expect(winback.execute).not.toHaveBeenCalled();
			});

			it("로컬 14:00에 Nudge Suggest Strategy를 호출한다", async () => {
				// KST 14:00 = UTC 05:00
				jest.setSystemTime(new Date("2024-01-16T05:00:00Z"));
				preferenceReader.findActiveTimezones.mockResolvedValue(["Asia/Seoul"]);

				await orchestrator.handleMinuteSweep();

				expect(nudgeSuggest.execute).toHaveBeenCalledTimes(1);
			});

			it("월요일 09:00에 주간 리포트 Strategy를 호출한다", async () => {
				// 2024-01-15 = 월요일, KST 09:00 = UTC 2024-01-15T00:00:00Z
				jest.setSystemTime(new Date("2024-01-15T00:00:00Z"));
				preferenceReader.findActiveTimezones.mockResolvedValue(["Asia/Seoul"]);

				await orchestrator.handleMinuteSweep();

				expect(weeklyReport.execute).toHaveBeenCalledTimes(1);
			});

			it("월요일 08:00에는 주간 리포트 Strategy를 호출하지 않는다", async () => {
				// 2024-01-15 = 월요일, KST 08:00 = UTC 2024-01-14T23:00:00Z
				jest.setSystemTime(new Date("2024-01-14T23:00:00Z"));
				preferenceReader.findActiveTimezones.mockResolvedValue(["Asia/Seoul"]);

				await orchestrator.handleMinuteSweep();

				expect(weeklyReport.execute).not.toHaveBeenCalled();
			});

			it("월요일이 아닌 날에는 주간 리포트 Strategy를 호출하지 않는다", async () => {
				// 2024-01-16 = 화요일, KST 09:00 = UTC 2024-01-16T00:00:00Z
				jest.setSystemTime(new Date("2024-01-16T00:00:00Z"));
				preferenceReader.findActiveTimezones.mockResolvedValue(["Asia/Seoul"]);

				await orchestrator.handleMinuteSweep();

				expect(weeklyReport.execute).not.toHaveBeenCalled();
			});

			it("매월 1일 10:00에 월간 리포트 Strategy를 호출한다", async () => {
				// 2024-02-01 = 1일, KST 10:00 = UTC 2024-02-01T01:00:00Z
				jest.setSystemTime(new Date("2024-02-01T01:00:00Z"));
				preferenceReader.findActiveTimezones.mockResolvedValue(["Asia/Seoul"]);

				await orchestrator.handleMinuteSweep();

				expect(monthlyReport.execute).toHaveBeenCalledTimes(1);
			});

			it("매월 1일 08:00에는 월간 리포트 Strategy를 호출하지 않는다", async () => {
				// 2024-02-01 = 1일, KST 08:00 = UTC 2024-01-31T23:00:00Z
				jest.setSystemTime(new Date("2024-01-31T23:00:00Z"));
				preferenceReader.findActiveTimezones.mockResolvedValue(["Asia/Seoul"]);

				await orchestrator.handleMinuteSweep();

				expect(monthlyReport.execute).not.toHaveBeenCalled();
			});

			it("1일이 아닌 날에는 월간 리포트 Strategy를 호출하지 않는다", async () => {
				// 2024-01-15 = 15일, KST 10:00 = UTC 2024-01-15T01:00:00Z
				jest.setSystemTime(new Date("2024-01-15T01:00:00Z"));
				preferenceReader.findActiveTimezones.mockResolvedValue(["Asia/Seoul"]);

				await orchestrator.handleMinuteSweep();

				expect(monthlyReport.execute).not.toHaveBeenCalled();
			});
		});

		describe("Social Digest delayed job", () => {
			it("저녁 리마인더 발송 성공 시 Social Digest delayed job 등록", async () => {
				// KST 18:00
				jest.setSystemTime(new Date("2024-01-16T09:00:00Z"));
				preferenceReader.findActiveTimezones.mockResolvedValue(["Asia/Seoul"]);
				eveningReminder.execute.mockResolvedValue({ sent: 3 });

				await orchestrator.handleMinuteSweep();

				expect(enqueuer.enqueueSocialDigest).toHaveBeenCalledWith({
					timezone: "Asia/Seoul",
				});
			});

			it("저녁 리마인더 대상 없으면 Social Digest delayed job 미등록", async () => {
				jest.setSystemTime(new Date("2024-01-16T09:00:00Z"));
				preferenceReader.findActiveTimezones.mockResolvedValue(["Asia/Seoul"]);
				eveningReminder.execute.mockResolvedValue({ sent: 0 });

				await orchestrator.handleMinuteSweep();

				expect(enqueuer.enqueueSocialDigest).not.toHaveBeenCalled();
			});
		});

		describe("에러 처리", () => {
			it("조회 에러 시 throw하지 않고 로깅", async () => {
				// Given
				preferenceReader.findActiveTimezones.mockRejectedValue(
					new Error("DB Error"),
				);

				// When & Then
				await expect(orchestrator.handleMinuteSweep()).resolves.toBeUndefined();
			});

			it("한 타임존 Strategy 실패 시 다른 타임존은 정상 처리된다", async () => {
				// Given
				jest.setSystemTime(new Date("2024-01-16T23:00:00Z"));
				preferenceReader.findActiveTimezones.mockResolvedValue([
					"Asia/Seoul",
					"America/New_York",
				]);

				// 첫 번째 타임존에서 morning이 실패 → #processTimezone 전체가 reject
				morningReminder.execute
					.mockRejectedValueOnce(new Error("Strategy Error"))
					.mockResolvedValueOnce({ sent: 1 });

				// When
				await expect(orchestrator.handleMinuteSweep()).resolves.toBeUndefined();

				// Then
				expect(morningReminder.execute).toHaveBeenCalledTimes(2);
				// 첫 번째 타임존은 morning에서 throw 되어 evening 미도달, 두 번째만 호출
				expect(eveningReminder.execute).toHaveBeenCalledTimes(1);
			});
		});
	});

	describe("handleReminderHourChanged", () => {
		it("변경된 아침 리마인더 시간이 현재 시:분과 일치하면 morning Strategy 호출", async () => {
			// KST 09:30
			jest.setSystemTime(new Date("2024-01-16T00:30:00Z"));

			await orchestrator.handleReminderHourChanged({
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
			jest.setSystemTime(new Date("2024-01-16T11:00:00Z"));

			await orchestrator.handleReminderHourChanged({
				userId: "user-1",
				timezone: "Asia/Seoul",
				eveningReminderHour: 20,
				eveningReminderMinute: 0,
			});

			expect(eveningReminder.execute).toHaveBeenCalledTimes(1);
		});

		it("변경된 시간이 현재 시와 불일치하면 Strategy 미호출", async () => {
			// KST 10:00
			jest.setSystemTime(new Date("2024-01-16T01:00:00Z"));

			await orchestrator.handleReminderHourChanged({
				userId: "user-1",
				timezone: "Asia/Seoul",
				morningReminderHour: 9, // 현재 10시인데 9시 → 불일치
			});

			expect(morningReminder.execute).not.toHaveBeenCalled();
		});

		it("변경된 분이 현재 분과 불일치하면 Strategy 미호출", async () => {
			// KST 09:15
			jest.setSystemTime(new Date("2024-01-16T00:15:00Z"));

			await orchestrator.handleReminderHourChanged({
				userId: "user-1",
				timezone: "Asia/Seoul",
				morningReminderHour: 9,
				morningReminderMinute: 30, // 현재 15분인데 30분 → 불일치
			});

			expect(morningReminder.execute).not.toHaveBeenCalled();
		});

		it("에러 발생 시 throw하지 않고 로깅", async () => {
			jest.setSystemTime(new Date("2024-01-16T00:00:00Z"));
			morningReminder.execute.mockRejectedValue(new Error("fail"));

			await expect(
				orchestrator.handleReminderHourChanged({
					userId: "user-1",
					timezone: "Asia/Seoul",
					morningReminderHour: 9,
					morningReminderMinute: 0,
				}),
			).resolves.toBeUndefined();
		});
	});

	describe("handleSocialDigest", () => {
		it("socialDigest Strategy에 위임한다", async () => {
			jest.setSystemTime(new Date("2024-01-16T09:00:00Z"));

			await orchestrator.handleSocialDigest({ timezone: "Asia/Seoul" });

			expect(socialDigest.execute).toHaveBeenCalledTimes(1);
			const ctx = socialDigest.execute.mock.calls[0]?.[0];
			expect(ctx).toMatchObject({ tz: "Asia/Seoul" });
		});

		it("에러 발생 시 throw하지 않고 로깅", async () => {
			jest.setSystemTime(new Date("2024-01-16T09:00:00Z"));
			socialDigest.execute.mockRejectedValue(new Error("fail"));

			await expect(
				orchestrator.handleSocialDigest({ timezone: "Asia/Seoul" }),
			).resolves.toBeUndefined();
		});
	});
});
