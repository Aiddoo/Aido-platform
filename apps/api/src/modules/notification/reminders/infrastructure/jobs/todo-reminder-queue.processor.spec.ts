import { Logger } from "@nestjs/common";
import { vi } from "vitest";

import { RecordingNotificationPublisher } from "#test/doubles/notification/recording-notification-publisher";
import { StubNotificationRecipientLocaleReader } from "#test/doubles/notification/stub-notification-recipient-locale.reader";
import { StubTodoReminderReader } from "#test/doubles/notification/stub-todo-reminder.reader";
import { StubTodoSeriesOwnerDormancy } from "#test/doubles/notification/stub-todo-series-owner-dormancy";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";
import { RecordingOperationalAlert } from "#test/doubles/platform/recording-operational-alert";

import { NotificationProviderLogEvent } from "../../../push/infrastructure/adapters/notification-provider.log-events.js";
import type { ActiveTodo } from "../../application/read-models/scheduler.read-model.js";
import { ReminderAlerts } from "../../application/reminders.alerts.js";
import { NotificationRemindersLogEvent } from "../../application/reminders.log-events.js";
import { SCHEDULER_CAMPAIGN_KEY } from "../../domain/notification-campaign.constants.js";
import {
  REMINDER_LATE_SKIP_THRESHOLD,
  REMINDER_LATE_SKIP_WINDOW_MS,
  TodoReminderQueueProcessor,
} from "./todo-reminder-queue.processor.js";
import {
  type ReminderJobData,
  type TodoReminderRuntimeJob,
  TODO_REMINDER_JOB_NAME,
  TODO_REMINDER_QUEUE,
  TODO_SERIES_PAUSED_JOB_NAME,
} from "./todo-reminder.queue.js";

const USER_ID = "user-1";
const TODO_TITLE = "Test Todo";
// 60분 단계가 막 울릴 시각: 할 일은 한 시간 뒤다
const NOW = Temporal.Instant.from("2026-11-05T00:00:00Z");

const activeTodo = (overrides: Partial<ActiveTodo> = {}): ActiveTodo => ({
  id: 1,
  title: TODO_TITLE,
  seriesId: null,
  startDate: "2026-11-05",
  scheduledLocalTime: "10:00",
  scheduledAt: NOW.add({ minutes: 60 }),
  ...overrides,
});

const makeJob = (data: Partial<ReminderJobData> = {}): TodoReminderRuntimeJob => ({
  name: TODO_REMINDER_JOB_NAME,
  data: {
    todoId: data.todoId ?? 1,
    userId: data.userId ?? USER_ID,
    stageLabel: data.stageLabel ?? "60min",
  },
});

describe("TodoReminderQueueProcessor — 할 일 리마인더 프로세서", () => {
  let reader: StubTodoReminderReader;
  let seriesOwnerDormancy: StubTodoSeriesOwnerDormancy;
  let publisher: RecordingNotificationPublisher;
  let localeReader: StubNotificationRecipientLocaleReader;
  let jobQueue: InMemoryJobQueue;
  let clock: FixedClock;
  let alert: RecordingOperationalAlert;
  let processor: TodoReminderQueueProcessor;

  beforeEach(() => {
    reader = new StubTodoReminderReader();
    seriesOwnerDormancy = new StubTodoSeriesOwnerDormancy();
    publisher = new RecordingNotificationPublisher();
    localeReader = new StubNotificationRecipientLocaleReader();
    jobQueue = new InMemoryJobQueue();
    clock = new FixedClock(NOW);
    alert = new RecordingOperationalAlert();
    processor = new TodoReminderQueueProcessor(
      reader,
      seriesOwnerDormancy,
      publisher,
      localeReader,
      jobQueue,
      clock,
      alert,
    );
    reader.todos.set(1, activeTodo());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("반복 회차와 휴면", () => {
    const logSpy = () => vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);

    it("소유자가 휴면이면 보내지 않고 내용 없이 로그 키로 남긴다", async () => {
      // Given
      reader.todos.set(1, activeTodo({ seriesId: "series-1" }));
      seriesOwnerDormancy.dormantSince = "2026-08-01";
      const log = logSpy();
      // When
      await processor.process(makeJob({ stageLabel: "10min" }));
      // Then
      expect(seriesOwnerDormancy.askedUserIds).toEqual([USER_ID]);
      expect(publisher.published).toEqual([]);
      expect(log).toHaveBeenCalledExactlyOnceWith({
        event: NotificationProviderLogEvent.TODO_REMINDER_DORMANT_OWNER_SKIPPED,
        todoId: 1,
        userId: USER_ID,
        stage: "10min",
      });
      expect(JSON.stringify(log.mock.calls)).not.toContain(TODO_TITLE);
    });

    it("휴면 기간마다 같은 key로 안내 작업을 하나만 등록한다", async () => {
      // Given
      reader.todos.set(1, activeTodo({ seriesId: "series-1" }));
      seriesOwnerDormancy.dormantSince = "2026-08-01";
      logSpy();
      // When
      await processor.process(makeJob({ stageLabel: "60min" }));
      await processor.process(makeJob({ stageLabel: "10min" }));
      // Then
      expect(jobQueue.jobsIn(TODO_REMINDER_QUEUE)).toEqual([
        {
          queue: TODO_REMINDER_QUEUE.name,
          payload: { name: TODO_SERIES_PAUSED_JOB_NAME, data: { todoId: 1, userId: USER_ID } },
          options: { idempotencyKey: `series-paused_${USER_ID}_2026-08-01` },
        },
      ]);
    });

    it.each([
      { locale: "ko", title: "반복 할 일 알림을 잠시 멈췄어요", body: "앱을 열면 다시 시작돼요" },
      {
        locale: "en",
        title: "Repeating to-do reminders paused",
        body: "Open the app to start them again",
      },
    ] as const)(
      "안내 작업은 $locale 문구를 리마인더와 같은 동의로 보낸다",
      async ({ locale, title, body }) => {
        // Given
        localeReader.locale = locale;
        logSpy();
        // When
        await processor.process({
          name: TODO_SERIES_PAUSED_JOB_NAME,
          data: { todoId: 7, userId: USER_ID },
        });
        // Then
        expect(publisher.published).toEqual([
          {
            mode: "publish",
            data: expect.objectContaining({
              userId: USER_ID,
              type: "TODO_REMINDER",
              purpose: "SCHEDULED_SERVICE",
              campaignKey: "todo_series_paused_v1",
              todoId: 7,
              title,
              body,
              metadata: { stage: "series-paused" },
            }),
          },
        ]);
      },
    );

    it("소유자가 활동 중이면 반복 회차도 그대로 보낸다", async () => {
      // Given
      reader.todos.set(1, activeTodo({ seriesId: "series-1" }));
      // When
      await processor.process(makeJob());
      // Then
      expect(publisher.published).toHaveLength(1);
    });

    it("단일 할 일은 휴면을 묻지 않고 그대로 보낸다", async () => {
      // Given
      seriesOwnerDormancy.dormantSince = "2026-08-01";
      // When
      await processor.process(makeJob());
      // Then
      expect(seriesOwnerDormancy.askedUserIds).toEqual([]);
      expect(publisher.published).toHaveLength(1);
    });
  });

  describe("정상 처리", () => {
    it("유효한 투두에 대해 알림을 발송한다", async () => {
      // When
      await processor.process(makeJob({ todoId: 1, stageLabel: "60min" }));
      // Then
      expect(publisher.published).toEqual([
        {
          mode: "publish",
          data: expect.objectContaining({
            userId: USER_ID,
            type: "TODO_REMINDER",
            campaignKey: SCHEDULER_CAMPAIGN_KEY.TODO_REMINDER,
            variantId: expect.stringMatching(/^todo_reminder_v4\.60min\.v[1-3]$/),
            todoId: 1,
            metadata: { stage: "60min" },
          }),
        },
      ]);
    });

    it("10min 단계 알림을 발송한다", async () => {
      // Given
      reader.todos.set(1, activeTodo({ scheduledAt: NOW.add({ minutes: 10 }) }));
      // When
      await processor.process(makeJob({ stageLabel: "10min" }));
      // Then
      expect(publisher.published[0]?.data).toMatchObject({ metadata: { stage: "10min" } });
    });

    it("스케줄링 이후 제목이 변경된 경우 DB의 최신 제목으로 알림을 발송한다", async () => {
      // Given — DB에는 변경된 제목
      reader.todos.set(1, activeTodo({ title: "밥먹고 약먹기" }));
      // When
      await processor.process(makeJob({ todoId: 1, stageLabel: "60min" }));
      // Then — DB의 최신 제목은 잠금 화면 길이를 보호하는 본문 preview에 사용됨
      const payload = publisher.published[0]?.data;
      expect(payload?.body).toContain("밥먹고 약먹기");
      expect(`${payload?.title}${payload?.body}`).not.toContain("{todoTitle}");
    });
  });

  describe("늦은 리마인더", () => {
    it("울려야 했던 시각보다 15분을 넘게 늦으면 보내지 않고 사유를 남긴다", async () => {
      // Given: 60분 단계가 16분 전에 울렸어야 했다(배포로 worker가 멈춘 사이)
      reader.todos.set(1, activeTodo({ scheduledAt: NOW.add({ minutes: 44 }) }));
      const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
      // When
      await processor.process(makeJob({ stageLabel: "60min" }));
      // Then
      expect(publisher.published).toEqual([]);
      expect(warn).toHaveBeenCalledExactlyOnceWith({
        event: NotificationRemindersLogEvent.TODO_REMINDER_LATE_SKIPPED,
        todoId: 1,
        userId: USER_ID,
        stage: "60min",
        reason: "late-over-15m",
        lateMinutes: 16,
      });
    });

    it("한 시간 안에 버린 리마인더가 기준 수에 닿는 순간 한 번만 경보한다", async () => {
      // Given
      reader.todos.set(1, activeTodo({ scheduledAt: NOW.add({ minutes: 44 }) }));
      vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

      // When
      for (let index = 0; index <= REMINDER_LATE_SKIP_THRESHOLD; index++) {
        await processor.process(makeJob({ stageLabel: "60min" }));
      }

      // Then
      expect(alert.alerts).toEqual([
        {
          ...ReminderAlerts.LATE_SKIPS_HIGH,
          details: {
            skippedCount: REMINDER_LATE_SKIP_THRESHOLD,
            windowMinutes: REMINDER_LATE_SKIP_WINDOW_MS / 60_000,
          },
        },
      ]);
    });

    it("정확히 15분 늦은 리마인더는 보낸다", async () => {
      // Given: 10분 단계가 15분 전에 울렸어야 했다
      reader.todos.set(1, activeTodo({ scheduledAt: NOW.subtract({ minutes: 5 }) }));
      // When
      await processor.process(makeJob({ stageLabel: "10min" }));
      // Then
      expect(publisher.published).toHaveLength(1);
    });

    it("시각이 없는 할 일은 늦음을 판단하지 않고 보낸다", async () => {
      // Given
      reader.todos.set(1, activeTodo({ scheduledAt: null }));
      clock.advanceBy({ hours: 3 });
      // When
      await processor.process(makeJob());
      // Then
      expect(publisher.published).toHaveLength(1);
    });
  });

  describe("투두 유효성 검증", () => {
    it("투두가 완료·삭제되었으면 알림을 발송하지 않는다", async () => {
      // Given — findActiveTodo가 null 반환
      reader.todos.clear();
      // When
      await processor.process(makeJob());
      // Then
      expect(publisher.published).toEqual([]);
    });
  });

  describe("회차 중복 방지", () => {
    it.each([
      { name: "시간 일정은 날짜와 벽시계", scheduledLocalTime: "10:00", key: "2026-11-05T10:00" },
      { name: "벽시계가 빈 행은 날짜만", scheduledLocalTime: null, key: "2026-11-05" },
    ])("$name로 회차를 넘긴다", async ({ scheduledLocalTime, key }) => {
      // Given
      reader.todos.set(1, activeTodo({ scheduledLocalTime }));
      // When
      await processor.process(makeJob());
      // Then
      expect(publisher.published[0]?.data).toMatchObject({
        reminderOccurrenceKey: key,
        metadata: { stage: "60min" },
      });
    });

    it("이미 울린 회차면 건너뛴 것으로 남기고 완료로 세지 않는다", async () => {
      // Given: 기록 발행기는 이미 울린 회차처럼 null을 돌려준다
      const debug = vi.spyOn(Logger.prototype, "debug").mockImplementation(() => undefined);
      const log = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
      // When
      await processor.process(makeJob());
      // Then
      expect(debug).toHaveBeenCalledWith(
        expect.objectContaining({
          event: NotificationProviderLogEvent.JOB_SKIPPED,
          reason: "ALREADY_NOTIFIED",
        }),
      );
      expect(log).not.toHaveBeenCalled();
    });
  });

  describe("에러 처리", () => {
    it("알림 발송 실패 시 에러가 전파된다 (job runtime 재시도)", async () => {
      // Given
      publisher.failWith = new Error("Push failed");
      // When & Then
      await expect(processor.process(makeJob())).rejects.toThrow("Push failed");
    });

    it("DB 조회 실패 시 에러가 전파된다 (job runtime 재시도)", async () => {
      // Given
      reader.failWith = new Error("DB connection failed");
      // When & Then
      await expect(processor.process(makeJob())).rejects.toThrow("DB connection failed");
    });
  });
});
