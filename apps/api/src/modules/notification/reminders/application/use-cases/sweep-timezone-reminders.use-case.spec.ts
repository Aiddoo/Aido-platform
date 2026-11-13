import { InMemorySweepCursor } from "#test/doubles/notification/in-memory-sweep-cursor";
import { RecordingNotificationPublisher } from "#test/doubles/notification/recording-notification-publisher";
import { StubNotificationHistoryReader } from "#test/doubles/notification/stub-notification-history.reader";
import { StubScheduledReminderReader } from "#test/doubles/notification/stub-scheduled-reminder.reader";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { RecordingOperationalAlert } from "#test/doubles/platform/recording-operational-alert";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { TEST_CUID } from "#test/fixtures/index";

import type { TimezoneContext } from "../../domain/timezone-context.read-model.js";
import { SchedulerPreferenceReaderPort } from "../ports/scheduler-preference-reader.port.js";
import {
  type TargetedSocialDigestJobData,
  TimezoneReminderEnqueuerPort,
} from "../ports/timezone-reminder-enqueuer.port.js";
import type { UserLocaleMap } from "../read-models/scheduler.read-model.js";
import { ReminderAlerts } from "../reminders.alerts.js";
import { NotificationRemindersLogEvent } from "../reminders.log-events.js";
import { SendMorningReminderUseCase } from "./send-morning-reminder.use-case.js";
import {
  SweepTimezoneRemindersUseCase,
  TIMEZONE_REMINDER_SWEEP_CURSOR_KEY,
} from "./sweep-timezone-reminders.use-case.js";

// 받은 컨텍스트를 남긴다. failures에 넣은 오류는 그 순서대로 한 번씩 던진다
class RecordingStrategy {
  readonly contexts: TimezoneContext[] = [];
  readonly failures: Error[] = [];

  async execute(context: TimezoneContext): Promise<{ sent: number }> {
    this.contexts.push(context);
    const failure = this.failures.shift();
    if (failure != null) {
      throw failure;
    }
    return { sent: 0 };
  }
}

interface EveningRecipient {
  readonly userId: string;
  readonly timezone: string;
}

class RecordingEveningStrategy {
  readonly contexts: TimezoneContext[] = [];
  recipients: EveningRecipient[] = [];

  async execute(
    context: TimezoneContext,
  ): Promise<{ sent: number; recipients: EveningRecipient[] }> {
    this.contexts.push(context);
    return { sent: this.recipients.length, recipients: this.recipients };
  }
}

class RecordingSocialDigestStrategy {
  readonly calls: Array<{ context: TimezoneContext; recipientUserIds: readonly string[] }> = [];
  failWith: Error | null = null;

  async execute(
    context: TimezoneContext,
    recipientUserIds: readonly string[],
  ): Promise<{ sent: number }> {
    if (this.failWith != null) {
      throw this.failWith;
    }
    this.calls.push({ context, recipientUserIds });
    return { sent: recipientUserIds.length };
  }
}

class StubPreferenceReader extends SchedulerPreferenceReaderPort {
  timezones: string[] = [];
  failWith: Error | null = null;

  async findActiveTimezones(): Promise<string[]> {
    if (this.failWith != null) {
      throw this.failWith;
    }
    return this.timezones;
  }

  async findUserLocales(): Promise<UserLocaleMap> {
    return new Map();
  }
}

class RecordingEnqueuer extends TimezoneReminderEnqueuerPort {
  readonly socialDigests: TargetedSocialDigestJobData[] = [];

  enqueueReminderHourChanged(): void {}

  enqueueSocialDigest(payload: TargetedSocialDigestJobData): void {
    this.socialDigests.push(payload);
  }
}

function createHarness(nowIso: string) {
  const clock = new FixedClock(Temporal.Instant.from(nowIso));
  const strategies = {
    morningReminder: new RecordingStrategy(),
    eveningReminder: new RecordingEveningStrategy(),
    weeklyReport: new RecordingStrategy(),
    monthlyReport: new RecordingStrategy(),
    weeklyAchievement: new RecordingStrategy(),
    winback: new RecordingStrategy(),
    nudgeSuggest: new RecordingStrategy(),
    socialDigest: new RecordingSocialDigestStrategy(),
    lunchNudge: new RecordingStrategy(),
    streakAtRisk: new RecordingStrategy(),
    onboarding: new RecordingStrategy(),
    weatherMorning: new RecordingStrategy(),
    weatherEvening: new RecordingStrategy(),
  };
  const preferenceReader = new StubPreferenceReader();
  preferenceReader.timezones = ["Asia/Seoul"];
  const enqueuer = new RecordingEnqueuer();
  const sweepCursor = new InMemorySweepCursor();
  const logger = new SilentLogger();
  const alert = new RecordingOperationalAlert();
  const orchestrator = new SweepTimezoneRemindersUseCase({
    ...strategies,
    preferenceReader,
    enqueuer,
    sweepCursor,
    clock,
    logger,
    alert,
  });
  return {
    clock,
    strategies,
    preferenceReader,
    enqueuer,
    sweepCursor,
    logger,
    alert,
    orchestrator,
  };
}

// +9·+8·0·-5·-8(1월, 서머타임 없음) 시간대 10개씩
const FIFTY_TIMEZONES_IN_FIVE_OFFSETS = [
  "Asia/Seoul",
  "Asia/Tokyo",
  "Asia/Pyongyang",
  "Asia/Jayapura",
  "Pacific/Palau",
  "Asia/Dili",
  "Asia/Chita",
  "Asia/Yakutsk",
  "Asia/Khandyga",
  "Etc/GMT-9",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Taipei",
  "Asia/Singapore",
  "Asia/Manila",
  "Asia/Kuala_Lumpur",
  "Australia/Perth",
  "Asia/Makassar",
  "Asia/Irkutsk",
  "Asia/Macau",
  "Etc/UTC",
  "Europe/London",
  "Europe/Lisbon",
  "Africa/Abidjan",
  "Africa/Accra",
  "Atlantic/Reykjavik",
  "Africa/Dakar",
  "Europe/Dublin",
  "Africa/Bamako",
  "Etc/GMT",
  "America/New_York",
  "America/Toronto",
  "America/Detroit",
  "America/Nassau",
  "America/Panama",
  "America/Jamaica",
  "America/Cancun",
  "America/Lima",
  "America/Bogota",
  "America/Guayaquil",
  "America/Los_Angeles",
  "America/Vancouver",
  "America/Tijuana",
  "Pacific/Pitcairn",
  "Etc/GMT+8",
  "US/Pacific",
  "Canada/Pacific",
  "PST8PDT",
  "America/Santa_Isabel",
  "America/Ensenada",
];

const localTimes = (contexts: readonly TimezoneContext[]) =>
  contexts.map(
    ({ timezones, localHour, localMinute }) => `${timezones.join(",")} ${localHour}:${localMinute}`,
  );

describe("SweepTimezoneRemindersUseCase — 타임존 리마인더 오케스트레이터", () => {
  describe("handleMinuteSweep", () => {
    it("활성 타임존을 조회하고 각 타임존별 Strategy를 호출한다", async () => {
      // Given: KST 08:00 (화요일)
      const { orchestrator, strategies } = createHarness("2024-01-16T23:00:00Z");

      // When
      await orchestrator.handleMinuteSweep();

      // Then
      expect(strategies.morningReminder.contexts).toEqual([
        {
          timezones: ["Asia/Seoul"],
          localHour: 8,
          localMinute: 0,
          dayOfWeek: 3,
          today: Temporal.PlainDate.from("2024-01-17"),
          tomorrow: Temporal.PlainDate.from("2024-01-18"),
          userId: undefined,
        },
      ]);
      expect(strategies.eveningReminder.contexts).toHaveLength(1);
    });

    it("다중 타임존을 각자의 현지 시각으로 처리한다", async () => {
      // Given
      const { orchestrator, strategies, preferenceReader } = createHarness("2024-01-16T23:00:00Z");
      preferenceReader.timezones = ["Asia/Seoul", "America/New_York"];

      // When
      await orchestrator.handleMinuteSweep();

      // Then
      expect(localTimes(strategies.morningReminder.contexts)).toEqual([
        "Asia/Seoul 8:0",
        "America/New_York 18:0",
      ]);
      expect(strategies.eveningReminder.contexts).toHaveLength(2);
    });

    it("현지 날짜·시·분이 같은 시간대는 한 묶음으로 Strategy를 한 번 부른다", async () => {
      // Given: 서울·도쿄는 KST 08:00, 뉴욕·토론토는 전날 18:00
      const { orchestrator, strategies, preferenceReader } = createHarness("2024-01-16T23:00:00Z");
      preferenceReader.timezones = [
        "Asia/Seoul",
        "America/New_York",
        "Asia/Tokyo",
        "America/Toronto",
      ];

      // When
      await orchestrator.handleMinuteSweep();

      // Then
      expect(localTimes(strategies.morningReminder.contexts)).toEqual([
        "Asia/Seoul,Asia/Tokyo 8:0",
        "America/New_York,America/Toronto 18:0",
      ]);
      expect(strategies.eveningReminder.contexts).toHaveLength(2);
    });

    it("시간대 50개를 오프셋 5개에 걸쳐 돌면 아침 리마인더 조회는 50번이 아니라 5번이다", async () => {
      // Given
      const harness = createHarness("2024-01-16T23:00:00Z");
      harness.preferenceReader.timezones = FIFTY_TIMEZONES_IN_FIVE_OFFSETS;
      const reader = new StubScheduledReminderReader();
      const orchestrator = new SweepTimezoneRemindersUseCase({
        ...harness,
        ...harness.strategies,
        morningReminder: new SendMorningReminderUseCase({
          reader,
          notificationPublisher: new RecordingNotificationPublisher(),
          notificationHistoryReader: new StubNotificationHistoryReader(),
          logger: new SilentLogger(),
        }),
      });

      // When
      await orchestrator.handleMinuteSweep();

      // Then
      const premiumQueries = reader.queries.filter(
        ({ method }) => method === "findPremiumMorningReminderUsers",
      );
      expect(premiumQueries).toHaveLength(5);
      expect(premiumQueries.flatMap(({ params }) => params.timezones).toSorted()).toEqual(
        FIFTY_TIMEZONES_IN_FIVE_OFFSETS.toSorted(),
      );
    });

    it("조회 결과가 비어있으면 Strategy 미호출", async () => {
      // Given
      const { orchestrator, strategies, preferenceReader } = createHarness("2024-01-16T23:00:00Z");
      preferenceReader.timezones = [];

      // When
      await orchestrator.handleMinuteSweep();

      // Then
      expect(strategies.morningReminder.contexts).toEqual([]);
      expect(strategies.eveningReminder.contexts).toEqual([]);
    });

    describe("조건부 Strategy 호출", () => {
      it.each([
        // 2024-01-15 = 월요일
        {
          name: "월요일 11:30 주간 달성",
          at: "2024-01-15T02:30:00Z",
          key: "weeklyAchievement",
          calls: 1,
        },
        {
          name: "일요일 11:30 주간 달성 없음",
          at: "2024-01-14T02:30:00Z",
          key: "weeklyAchievement",
          calls: 0,
        },
        { name: "로컬 16:00 Win-back", at: "2024-01-16T07:00:00Z", key: "winback", calls: 1 },
        // sweep 한 분이 지연/누락돼도 16:00~16:02 사이면 발송(멱등)
        {
          name: "로컬 16:01(grace 안) Win-back",
          at: "2024-01-16T07:01:00Z",
          key: "winback",
          calls: 1,
        },
        { name: "로컬 15:59 Win-back 없음", at: "2024-01-16T06:59:00Z", key: "winback", calls: 0 },
        {
          name: "로컬 16:03(grace 경계) Win-back 없음",
          at: "2024-01-16T07:03:00Z",
          key: "winback",
          calls: 0,
        },
        { name: "로컬 15:00 넛지 추천", at: "2024-01-16T06:00:00Z", key: "nudgeSuggest", calls: 1 },
        {
          name: "월요일 11:30 주간 리포트",
          at: "2024-01-15T02:30:00Z",
          key: "weeklyReport",
          calls: 1,
        },
        {
          name: "월요일 11:29 주간 리포트 없음",
          at: "2024-01-15T02:29:00Z",
          key: "weeklyReport",
          calls: 0,
        },
        {
          name: "화요일 주간 리포트 없음",
          at: "2024-01-16T02:30:00Z",
          key: "weeklyReport",
          calls: 0,
        },
        {
          name: "매월 1일 11:30 월간 리포트",
          at: "2024-02-01T02:30:00Z",
          key: "monthlyReport",
          calls: 1,
        },
        {
          name: "매월 1일 11:29 월간 리포트 없음",
          at: "2024-02-01T02:29:00Z",
          key: "monthlyReport",
          calls: 0,
        },
        {
          name: "15일 월간 리포트 없음",
          at: "2024-01-15T02:30:00Z",
          key: "monthlyReport",
          calls: 0,
        },
        { name: "로컬 12:30 점심 넛지", at: "2024-01-16T03:30:00Z", key: "lunchNudge", calls: 1 },
        {
          name: "로컬 20:15 스트릭 위기",
          at: "2024-01-16T11:15:00Z",
          key: "streakAtRisk",
          calls: 1,
        },
      ] as const)("$name", async ({ at, key, calls }) => {
        // Given
        const { orchestrator, strategies } = createHarness(at);

        // When
        await orchestrator.handleMinuteSweep();

        // Then
        expect(strategies[key].contexts).toHaveLength(calls);
      });

      it("매월 1일이 월요일이면 월간 리포트가 주간 리포트를 대체한다", async () => {
        // Given: 2024-04-01 월요일 KST 11:30
        const { orchestrator, strategies } = createHarness("2024-04-01T02:30:00Z");

        // When
        await orchestrator.handleMinuteSweep();

        // Then
        expect(strategies.monthlyReport.contexts).toHaveLength(1);
        expect(strategies.weeklyReport.contexts).toHaveLength(0);
        expect(strategies.weeklyAchievement.contexts).toHaveLength(1);
      });

      it("온보딩은 로컬 10:30에만 실행한다", async () => {
        // Given
        const { orchestrator, strategies, clock } = createHarness("2024-01-16T01:29:00Z");
        await orchestrator.handleMinuteSweep();
        expect(strategies.onboarding.contexts).toHaveLength(0);

        // When
        clock.advanceBy({ minutes: 1 });
        await orchestrator.handleMinuteSweep();

        // Then
        expect(localTimes(strategies.onboarding.contexts)).toEqual(["Asia/Seoul 10:30"]);
      });
    });

    describe("놓친 분 따라잡기", () => {
      it("처음 실행하면 지금 분만 처리하고 커서에 그 분을 남긴다", async () => {
        // Given
        const { orchestrator, strategies, sweepCursor } = createHarness("2024-01-16T23:00:42Z");

        // When
        await orchestrator.handleMinuteSweep();

        // Then
        expect(localTimes(strategies.morningReminder.contexts)).toEqual(["Asia/Seoul 8:0"]);
        expect(await sweepCursor.findLastCompletedAt(TIMEZONE_REMINDER_SWEEP_CURSOR_KEY)).toEqual(
          Temporal.Instant.from("2024-01-16T23:00:00Z"),
        );
      });

      it("멈춘 사이의 분을 오래된 순서로 한 번씩, 그 분의 현지 시각으로 처리한다", async () => {
        // Given: 07:58에 마지막으로 돌고 08:02에 다시 돈다
        const { orchestrator, strategies, sweepCursor, clock } =
          createHarness("2024-01-16T22:58:00Z");
        await orchestrator.handleMinuteSweep();
        clock.advanceBy({ minutes: 4 });

        // When
        await orchestrator.handleMinuteSweep();

        // Then
        expect(localTimes(strategies.morningReminder.contexts)).toEqual([
          "Asia/Seoul 7:58",
          "Asia/Seoul 7:59",
          "Asia/Seoul 8:0",
          "Asia/Seoul 8:1",
          "Asia/Seoul 8:2",
        ]);
        expect(sweepCursor.marked.map(String)).toEqual([
          "2024-01-16T22:58:00Z",
          "2024-01-16T22:59:00Z",
          "2024-01-16T23:00:00Z",
          "2024-01-16T23:01:00Z",
          "2024-01-16T23:02:00Z",
        ]);
      });

      it("자정을 넘겨 따라잡아도 놓친 분은 그 분의 날짜로 보낸다", async () => {
        // Given: KST 23:58에 멈췄다 00:01에 다시 돈다
        const { orchestrator, strategies, clock } = createHarness("2024-01-16T14:58:00Z");
        await orchestrator.handleMinuteSweep();
        clock.advanceBy({ minutes: 3 });

        // When
        await orchestrator.handleMinuteSweep();

        // Then
        expect(
          strategies.morningReminder.contexts.map(({ localHour, localMinute, today }) => [
            `${localHour}:${localMinute}`,
            today.toString(),
          ]),
        ).toEqual([
          ["23:58", "2024-01-16"],
          ["23:59", "2024-01-16"],
          ["0:0", "2024-01-17"],
          ["0:1", "2024-01-17"],
        ]);
      });

      it("같은 분에 다시 돌면 아무것도 처리하지 않는다", async () => {
        // Given
        const { orchestrator, strategies } = createHarness("2024-01-16T23:00:00Z");
        await orchestrator.handleMinuteSweep();

        // When
        await orchestrator.handleMinuteSweep();

        // Then
        expect(strategies.morningReminder.contexts).toHaveLength(1);
      });

      it("15분보다 오래된 분은 보내지 않고 버린 분 수를 사유와 함께 남기고 경보한다", async () => {
        // Given: 40분 동안 멈췄다
        const { orchestrator, strategies, clock, logger, alert } =
          createHarness("2024-01-16T22:20:00Z");
        await orchestrator.handleMinuteSweep();
        clock.advanceBy({ minutes: 40 });

        // When
        await orchestrator.handleMinuteSweep();

        // Then
        const caughtUp = localTimes(strategies.morningReminder.contexts).slice(1);
        expect(caughtUp).toHaveLength(15);
        expect(caughtUp[0]).toBe("Asia/Seoul 7:46");
        expect(caughtUp.at(-1)).toBe("Asia/Seoul 8:0");
        expect(logger.messages).toContainEqual({
          event: NotificationRemindersLogEvent.TIMEZONE_AWARE_REMINDER_MINUTES_SKIPPED,
          reason: "late-over-15m",
          skippedMinutes: 25,
        });
        expect(alert.alerts).toEqual([
          {
            ...ReminderAlerts.SWEEP_CATCH_UP_CAPPED,
            details: { skippedMinutes: 25, maxCatchUpMinutes: 15 },
          },
        ]);
      });

      it("시간대 목록을 읽지 못하면 커서를 옮기지 않아 다음 실행이 같은 분부터 처리한다", async () => {
        // Given: 07:59는 끝냈고 08:00 실행은 조회 실패로 멈췄다
        const { orchestrator, strategies, preferenceReader, sweepCursor, clock } =
          createHarness("2024-01-16T22:59:00Z");
        await orchestrator.handleMinuteSweep();
        clock.advanceBy({ minutes: 1 });
        preferenceReader.failWith = new Error("DB Error");
        await orchestrator.handleMinuteSweep();
        preferenceReader.failWith = null;
        clock.advanceBy({ minutes: 1 });

        // When
        await orchestrator.handleMinuteSweep();

        // Then
        expect(sweepCursor.marked.map(String)).toEqual([
          "2024-01-16T22:59:00Z",
          "2024-01-16T23:00:00Z",
          "2024-01-16T23:01:00Z",
        ]);
        expect(localTimes(strategies.morningReminder.contexts)).toEqual([
          "Asia/Seoul 7:59",
          "Asia/Seoul 8:0",
          "Asia/Seoul 8:1",
        ]);
      });
    });

    describe("친구 활동 요약 지연 job", () => {
      it("저녁 리마인더 발송 성공 시 Social Digest delayed job 등록", async () => {
        // Given: KST 18:00
        const { orchestrator, strategies, enqueuer } = createHarness("2024-01-16T09:00:00Z");
        strategies.eveningReminder.recipients = [
          { userId: TEST_CUID.USER_1, timezone: "Asia/Seoul" },
          { userId: TEST_CUID.USER_2, timezone: "Asia/Seoul" },
          { userId: TEST_CUID.USER_3, timezone: "Asia/Seoul" },
        ];

        // When
        await orchestrator.handleMinuteSweep();

        // Then
        expect(enqueuer.socialDigests).toEqual([
          {
            timezone: "Asia/Seoul",
            recipientUserIds: [TEST_CUID.USER_1, TEST_CUID.USER_2, TEST_CUID.USER_3],
          },
        ]);
      });

      it("묶어서 보낸 저녁 리마인더도 Social Digest는 시간대마다 같은 payload로 등록한다", async () => {
        // Given: 서울·도쿄 18:00이 한 묶음이다
        const { orchestrator, strategies, enqueuer, preferenceReader } =
          createHarness("2024-01-16T09:00:00Z");
        preferenceReader.timezones = ["Asia/Seoul", "Asia/Tokyo"];
        strategies.eveningReminder.recipients = [
          { userId: TEST_CUID.USER_1, timezone: "Asia/Seoul" },
          { userId: TEST_CUID.USER_2, timezone: "Asia/Tokyo" },
          { userId: TEST_CUID.USER_3, timezone: "Asia/Seoul" },
        ];

        // When
        await orchestrator.handleMinuteSweep();

        // Then
        expect(strategies.eveningReminder.contexts).toHaveLength(1);
        expect(enqueuer.socialDigests).toEqual([
          { timezone: "Asia/Seoul", recipientUserIds: [TEST_CUID.USER_1, TEST_CUID.USER_3] },
          { timezone: "Asia/Tokyo", recipientUserIds: [TEST_CUID.USER_2] },
        ]);
      });

      it("저녁 리마인더 대상 없으면 Social Digest delayed job 미등록", async () => {
        // Given
        const { orchestrator, enqueuer } = createHarness("2024-01-16T09:00:00Z");

        // When
        await orchestrator.handleMinuteSweep();

        // Then
        expect(enqueuer.socialDigests).toEqual([]);
      });
    });

    describe("에러 처리", () => {
      it("조회 에러 시 throw하지 않고 로깅", async () => {
        // Given
        const { orchestrator, preferenceReader, logger } = createHarness("2024-01-16T23:00:00Z");
        preferenceReader.failWith = new Error("DB Error");

        // When & Then
        await expect(orchestrator.handleMinuteSweep()).resolves.toBeUndefined();
        expect(logger.messages).toContainEqual({
          event: NotificationRemindersLogEvent.TIMEZONE_AWARE_REMINDER_SWEEP_FAILED,
          errorType: "sweep-execution",
        });
      });

      it("한 타임존 Strategy 실패 시 다른 타임존은 정상 처리된다", async () => {
        // Given: 첫 번째 타임존에서 morning이 실패 → 그 타임존 처리 전체가 reject
        const { orchestrator, strategies, preferenceReader } =
          createHarness("2024-01-16T23:00:00Z");
        preferenceReader.timezones = ["Asia/Seoul", "America/New_York"];
        strategies.morningReminder.failures.push(new Error("Strategy Error"));

        // When
        await expect(orchestrator.handleMinuteSweep()).resolves.toBeUndefined();

        // Then
        expect(strategies.morningReminder.contexts).toHaveLength(2);
        expect(localTimes(strategies.eveningReminder.contexts)).toEqual(["America/New_York 18:0"]);
      });
    });
  });

  describe("handleReminderHourChanged", () => {
    it("변경된 아침 리마인더 시간이 현재 시:분과 일치하면 morning Strategy 호출", async () => {
      // Given: KST 09:30
      const { orchestrator, strategies } = createHarness("2024-01-16T00:30:00Z");

      // When
      await orchestrator.handleReminderHourChanged({
        userId: "user-1",
        timezone: "Asia/Seoul",
        morningReminderHour: 9,
        morningReminderMinute: 30,
      });

      // Then
      expect(strategies.morningReminder.contexts).toEqual([
        expect.objectContaining({
          timezones: ["Asia/Seoul"],
          localHour: 9,
          localMinute: 30,
          userId: "user-1",
        }),
      ]);
    });

    it("변경된 저녁 리마인더 시간이 현재 시:분과 일치하면 evening Strategy 호출", async () => {
      // Given: KST 20:00
      const { orchestrator, strategies } = createHarness("2024-01-16T11:00:00Z");

      // When
      await orchestrator.handleReminderHourChanged({
        userId: "user-1",
        timezone: "Asia/Seoul",
        eveningReminderHour: 20,
        eveningReminderMinute: 0,
      });

      // Then
      expect(strategies.eveningReminder.contexts).toHaveLength(1);
    });

    it.each([
      { name: "시", at: "2024-01-16T01:00:00Z", hour: 9, minute: undefined },
      { name: "분", at: "2024-01-16T00:15:00Z", hour: 9, minute: 30 },
    ])("변경된 $name이 현재와 불일치하면 Strategy 미호출", async ({ at, hour, minute }) => {
      // Given
      const { orchestrator, strategies } = createHarness(at);

      // When
      await orchestrator.handleReminderHourChanged({
        userId: "user-1",
        timezone: "Asia/Seoul",
        morningReminderHour: hour,
        morningReminderMinute: minute,
      });

      // Then
      expect(strategies.morningReminder.contexts).toEqual([]);
    });

    it("에러 발생 시 throw하지 않고 로깅", async () => {
      // Given
      const { orchestrator, strategies } = createHarness("2024-01-16T00:00:00Z");
      strategies.morningReminder.failures.push(new Error("fail"));

      // When & Then
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
      // Given
      const { orchestrator, strategies } = createHarness("2024-01-16T09:00:00Z");

      // When
      await orchestrator.handleSocialDigest({
        timezone: "Asia/Seoul",
        recipientUserIds: [TEST_CUID.USER_1],
      });

      // Then
      expect(strategies.socialDigest.calls).toEqual([
        {
          context: expect.objectContaining({
            timezones: ["Asia/Seoul"],
            today: Temporal.PlainDate.from("2024-01-16"),
          }),
          recipientUserIds: [TEST_CUID.USER_1],
        },
      ]);
    });

    it("구버전 큐 페이로드에 대상 목록이 없으면 오발송하지 않는다", async () => {
      // Given
      const { orchestrator, strategies } = createHarness("2024-01-16T09:00:00Z");

      // When
      await orchestrator.handleSocialDigest({ timezone: "Asia/Seoul" });

      // Then
      expect(strategies.socialDigest.calls).toEqual([]);
    });

    it("에러 발생 시 throw하지 않고 로깅", async () => {
      // Given
      const { orchestrator, strategies } = createHarness("2024-01-16T09:00:00Z");
      strategies.socialDigest.failWith = new Error("fail");

      // When & Then
      await expect(
        orchestrator.handleSocialDigest({
          timezone: "Asia/Seoul",
          recipientUserIds: [TEST_CUID.USER_1],
        }),
      ).resolves.toBeUndefined();
    });
  });
});
