import { Test, type TestingModule } from "@nestjs/testing";
import { vi } from "vitest";

import { SchedulerPreferenceReaderPort } from "#api/modules/notification/reminders/application/ports/scheduler-preference-reader.port";
import { TimezoneReminderEnqueuerPort } from "#api/modules/notification/reminders/application/ports/timezone-reminder-enqueuer.port";
import { SendEveningReminderUseCase } from "#api/modules/notification/reminders/application/use-cases/send-evening-reminder.use-case";
import { SendLunchNudgeUseCase } from "#api/modules/notification/reminders/application/use-cases/send-lunch-nudge.use-case";
import { SendMonthlyReportUseCase } from "#api/modules/notification/reminders/application/use-cases/send-monthly-report.use-case";
import { SendMorningReminderUseCase } from "#api/modules/notification/reminders/application/use-cases/send-morning-reminder.use-case";
import { SendNudgeSuggestUseCase } from "#api/modules/notification/reminders/application/use-cases/send-nudge-suggest.use-case";
import { SendOnboardingUseCase } from "#api/modules/notification/reminders/application/use-cases/send-onboarding.use-case";
import { SendSocialDigestUseCase } from "#api/modules/notification/reminders/application/use-cases/send-social-digest.use-case";
import { SendStreakAtRiskUseCase } from "#api/modules/notification/reminders/application/use-cases/send-streak-at-risk.use-case";
import { SendWeatherEveningUseCase } from "#api/modules/notification/reminders/application/use-cases/send-weather-evening.use-case";
import { SendWeatherMorningUseCase } from "#api/modules/notification/reminders/application/use-cases/send-weather-morning.use-case";
import { SendWeeklyAchievementUseCase } from "#api/modules/notification/reminders/application/use-cases/send-weekly-achievement.use-case";
import { SendWeeklyReportUseCase } from "#api/modules/notification/reminders/application/use-cases/send-weekly-report.use-case";
import { SendWinbackUseCase } from "#api/modules/notification/reminders/application/use-cases/send-winback.use-case";
import { SweepTimezoneRemindersUseCase } from "#api/modules/notification/reminders/application/use-cases/sweep-timezone-reminders.use-case";
import { NOTIFICATION_SCHEDULE } from "#api/modules/notification/reminders/domain/notification-schedule.domain-service";
import { provideSweepTimezoneRemindersUseCase } from "#api/modules/notification/reminders/notification-reminders.providers";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import { SweepCursorPort } from "#api/shared/application/ports/sweep-cursor.port";
import { InMemorySweepCursor } from "#test/doubles/notification/in-memory-sweep-cursor";
import { DateClock } from "#test/doubles/platform/date-clock";
import { RecordingOperationalAlert } from "#test/doubles/platform/recording-operational-alert";
import { TEST_CUID } from "#test/fixtures/index";
import { suppressLogger } from "#test/setup/suppress-logger";

describe("SweepTimezoneRemindersUseCase 통합 테스트 (Mock 포트)", () => {
  let module: TestingModule;
  let orchestrator: SweepTimezoneRemindersUseCase;

  // ── Strategy mocks ──────────────────────────────────────────────────
  const mockMorningReminder = {
    execute: vi.fn().mockResolvedValue({ sent: 0 }),
  };
  const mockEveningReminder = {
    execute: vi.fn().mockResolvedValue({ sent: 0, recipientUserIds: [] }),
  };
  const mockOnboarding = { execute: vi.fn().mockResolvedValue({ sent: 0 }) };
  const mockWeeklyReport = {
    execute: vi.fn().mockResolvedValue({ sent: 0 }),
  };
  const mockMonthlyReport = {
    execute: vi.fn().mockResolvedValue({ sent: 0 }),
  };
  const mockWeeklyAchievement = {
    execute: vi.fn().mockResolvedValue({ sent: 0 }),
  };
  const mockWinback = { execute: vi.fn().mockResolvedValue({ sent: 0 }) };
  const mockNudgeSuggest = {
    execute: vi.fn().mockResolvedValue({ sent: 0 }),
  };
  const mockSocialDigest = {
    execute: vi.fn().mockResolvedValue({ sent: 0 }),
  };
  const mockLunchNudge = { execute: vi.fn().mockResolvedValue({ sent: 0 }) };
  const mockStreakAtRisk = {
    execute: vi.fn().mockResolvedValue({ sent: 0 }),
  };
  const mockWeatherMorning = {
    execute: vi.fn().mockResolvedValue({ sent: 0 }),
  };
  const mockWeatherEvening = {
    execute: vi.fn().mockResolvedValue({ sent: 0 }),
  };

  // ── Port mocks ──────────────────────────────────────────────────────
  const mockPreferenceReader = {
    findActiveTimezones: vi.fn(),
    findUserLocales: vi.fn(),
  };

  const mockEnqueuer = {
    enqueueReminderHourChanged: vi.fn(),
    enqueueSocialDigest: vi.fn(),
  };

  beforeAll(() => {
    suppressLogger();
  });

  // 시각이 테스트마다 앞뒤로 움직이므로 따라잡기 커서를 테스트마다 새로 둔다
  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        provideSweepTimezoneRemindersUseCase(),
        { provide: SchedulerPreferenceReaderPort, useValue: mockPreferenceReader },
        { provide: TimezoneReminderEnqueuerPort, useValue: mockEnqueuer },
        { provide: SweepCursorPort, useValue: new InMemorySweepCursor() },
        { provide: ClockPort, useValue: new DateClock() },
        { provide: OperationalAlertPort, useValue: new RecordingOperationalAlert() },
        { provide: SendMorningReminderUseCase, useValue: mockMorningReminder },
        { provide: SendEveningReminderUseCase, useValue: mockEveningReminder },
        { provide: SendOnboardingUseCase, useValue: mockOnboarding },
        { provide: SendWeeklyReportUseCase, useValue: mockWeeklyReport },
        { provide: SendMonthlyReportUseCase, useValue: mockMonthlyReport },
        {
          provide: SendWeeklyAchievementUseCase,
          useValue: mockWeeklyAchievement,
        },
        { provide: SendWinbackUseCase, useValue: mockWinback },
        { provide: SendNudgeSuggestUseCase, useValue: mockNudgeSuggest },
        { provide: SendSocialDigestUseCase, useValue: mockSocialDigest },
        { provide: SendLunchNudgeUseCase, useValue: mockLunchNudge },
        { provide: SendStreakAtRiskUseCase, useValue: mockStreakAtRisk },
        { provide: SendWeatherMorningUseCase, useValue: mockWeatherMorning },
        { provide: SendWeatherEveningUseCase, useValue: mockWeatherEvening },
      ],
    }).compile();

    orchestrator = module.get<SweepTimezoneRemindersUseCase>(SweepTimezoneRemindersUseCase);
  });

  afterEach(async () => {
    await module.close();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    // 기본: 활성 타임존 조회 결과
    mockPreferenceReader.findActiveTimezones.mockResolvedValue(["Asia/Seoul"]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("handleMinuteSweep 전략 실행", () => {
    it("KST 08:00 — 아침 리마인더 전략이 실행된다", async () => {
      // Given - UTC 2026-03-15 23:00 = KST 2026-03-16 (월) 08:00
      vi.setSystemTime(new Date("2026-03-15T23:00:00Z"));

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
      vi.setSystemTime(new Date("2026-03-16T09:00:00Z"));
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
      vi.setSystemTime(new Date("2026-03-16T02:30:00Z"));

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
      vi.setSystemTime(new Date("2026-04-01T02:30:00Z"));

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
      vi.setSystemTime(new Date("2026-03-16T02:30:00Z"));

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
      vi.setSystemTime(new Date("2026-03-15T23:00:00Z"));

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
      vi.setSystemTime(new Date("2026-03-15T23:00:00Z"));
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
