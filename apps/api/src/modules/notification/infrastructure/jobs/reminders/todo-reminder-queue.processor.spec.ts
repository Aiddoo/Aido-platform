import { Logger } from "@nestjs/common";
import { TestBed } from "@suites/unit";
import { vi, type Mocked } from "vitest";

import {
  NotificationPublisher,
  NOTIFICATION_RECIPIENT_LOCALE_READER,
  type NotificationRecipientLocaleReaderPort,
} from "#api/modules/notification/notification-delivery.public";
import { FakeJobRuntime } from "#test/mocks/fake-job-runtime";

import {
  TODO_REMINDER_READER,
  type TodoReminderReaderPort,
} from "../../../application/ports/reminders/todo-reminder-reader.port.js";
import {
  TODO_SERIES_OWNER_DORMANCY,
  type TodoSeriesOwnerDormancyPort,
} from "../../../application/ports/reminders/todo-series-owner-dormancy.port.js";
import { SCHEDULER_CAMPAIGN_KEY } from "../../../domain/services/reminders/notification-campaign.js";
import { NotificationProviderLogEvent } from "../../observability/delivery/notification-provider-log.events.js";
import {
  type ReminderJobData,
  TODO_REMINDER_JOB_NAME,
  TODO_REMINDER_QUEUE,
  TODO_SERIES_PAUSED_JOB_NAME,
  TODO_SERIES_PAUSED_JOB_POLICY,
} from "./todo-reminder-queue.constants.js";
import { TodoReminderQueueProcessor } from "./todo-reminder-queue.processor.js";

const USER_ID = "user-1";
const TODO_TITLE = "Test Todo";
const SCHEDULE = { startDate: "2026-11-05", scheduledLocalTime: "10:00" };

const makeJob = (data: Partial<ReminderJobData> = {}) => ({
  name: TODO_REMINDER_JOB_NAME,
  data: {
    todoId: data.todoId ?? 1,
    userId: data.userId ?? USER_ID,
    stageLabel: data.stageLabel ?? "60min",
  },
});

describe("TodoReminderQueueProcessor — 할 일 리마인더 프로세서", () => {
  let processor: TodoReminderQueueProcessor;
  let reader: Mocked<TodoReminderReaderPort>;
  let seriesOwnerDormancy: Mocked<TodoSeriesOwnerDormancyPort>;
  let notificationPublisher: Mocked<NotificationPublisher>;
  let recipientLocaleReader: Mocked<NotificationRecipientLocaleReaderPort>;

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(TodoReminderQueueProcessor).compile();

    processor = unit;
    reader = unitRef.get(TODO_REMINDER_READER);
    seriesOwnerDormancy = unitRef.get(TODO_SERIES_OWNER_DORMANCY);
    notificationPublisher = unitRef.get(NotificationPublisher);
    recipientLocaleReader = unitRef.get(NOTIFICATION_RECIPIENT_LOCALE_READER);
    recipientLocaleReader.getLocale.mockResolvedValue("ko");
  });

  /** 리더 mock 설정 헬퍼 */
  const setupMocks = (
    options: {
      todoExists?: boolean;
      todoTitle?: string;
    } = {},
  ) => {
    const { todoExists = true, todoTitle = TODO_TITLE } = options;

    reader.findActiveTodo.mockResolvedValue(
      todoExists ? { id: 1, title: todoTitle, seriesId: null, ...SCHEDULE } : null,
    );
  };

  describe("반복 회차와 휴면", () => {
    const logSpy = () => vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);

    it("소유자가 휴면이면 보내지 않고 내용 없이 로그 키로 남긴다", async () => {
      // Given
      setupMocks();
      reader.findActiveTodo.mockResolvedValue({
        id: 1,
        title: TODO_TITLE,
        seriesId: "series-1",
        ...SCHEDULE,
      });
      seriesOwnerDormancy.findDormantSince.mockResolvedValue("2026-08-01");
      const log = logSpy();
      // When
      await processor.process(makeJob({ stageLabel: "10min" }));
      // Then
      expect(seriesOwnerDormancy.findDormantSince).toHaveBeenCalledWith(USER_ID);
      expect(notificationPublisher.publish).not.toHaveBeenCalled();
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
      const runtime = new FakeJobRuntime();
      const withRuntime = new TodoReminderQueueProcessor(
        reader,
        seriesOwnerDormancy,
        notificationPublisher,
        recipientLocaleReader,
        runtime,
      );
      setupMocks();
      reader.findActiveTodo.mockResolvedValue({
        id: 1,
        title: TODO_TITLE,
        seriesId: "series-1",
        ...SCHEDULE,
      });
      seriesOwnerDormancy.findDormantSince.mockResolvedValue("2026-08-01");
      // When
      await withRuntime.process(makeJob({ stageLabel: "60min" }));
      await withRuntime.process(makeJob({ stageLabel: "10min" }));
      // Then
      expect(runtime.enqueueCalls).toEqual([
        {
          queue: TODO_REMINDER_QUEUE,
          data: {
            name: TODO_SERIES_PAUSED_JOB_NAME,
            data: { todoId: 1, userId: USER_ID },
          },
          options: {
            ...TODO_SERIES_PAUSED_JOB_POLICY,
            idempotencyKey: `series-paused_${USER_ID}_2026-08-01`,
          },
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
        recipientLocaleReader.getLocale.mockResolvedValue(locale);
        vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
        // When
        await processor.process({
          name: TODO_SERIES_PAUSED_JOB_NAME,
          data: { todoId: 7, userId: USER_ID },
        });
        // Then
        expect(notificationPublisher.publish).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({
            userId: USER_ID,
            type: "TODO_REMINDER",
            purpose: "SCHEDULED_SERVICE",
            campaignKey: "todo_series_paused_v1",
            todoId: 7,
            title,
            body,
            metadata: { stage: "series-paused" },
          }),
        );
      },
    );

    it("소유자가 활동 중이면 반복 회차도 그대로 보낸다", async () => {
      // Given
      setupMocks();
      reader.findActiveTodo.mockResolvedValue({
        id: 1,
        title: TODO_TITLE,
        seriesId: "series-1",
        ...SCHEDULE,
      });
      seriesOwnerDormancy.findDormantSince.mockResolvedValue(null);
      // When
      await processor.process(makeJob());
      // Then
      expect(notificationPublisher.publish).toHaveBeenCalledOnce();
    });

    it("단일 할 일은 휴면을 묻지 않고 그대로 보낸다", async () => {
      // Given
      setupMocks();
      seriesOwnerDormancy.findDormantSince.mockResolvedValue("2026-08-01");
      // When
      await processor.process(makeJob());
      // Then
      expect(seriesOwnerDormancy.findDormantSince).not.toHaveBeenCalled();
      expect(notificationPublisher.publish).toHaveBeenCalledOnce();
    });
  });

  describe("정상 처리", () => {
    it("유효한 투두에 대해 알림을 발송한다", async () => {
      // Given
      setupMocks({ todoExists: true });
      notificationPublisher.publish.mockResolvedValue(null);

      // When
      await processor.process(makeJob({ todoId: 1, stageLabel: "60min" }));

      // Then
      expect(notificationPublisher.publish).toHaveBeenCalledTimes(1);
      expect(notificationPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_ID,
          type: "TODO_REMINDER",
          campaignKey: SCHEDULER_CAMPAIGN_KEY.TODO_REMINDER,
          variantId: expect.stringMatching(/^todo_reminder_v4\.60min\.v[1-3]$/),
          todoId: 1,
          metadata: { stage: "60min" },
        }),
      );
    });

    it("10min 단계 알림을 발송한다", async () => {
      // Given
      setupMocks({ todoExists: true });
      notificationPublisher.publish.mockResolvedValue(null);

      // When
      await processor.process(makeJob({ stageLabel: "10min" }));

      // Then
      expect(notificationPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: { stage: "10min" } }),
      );
    });

    it("스케줄링 이후 제목이 변경된 경우 DB의 최신 제목으로 알림을 발송한다", async () => {
      // Given — DB에는 변경된 제목
      setupMocks({
        todoExists: true,
        todoTitle: "밥먹고 약먹기",
      });
      notificationPublisher.publish.mockResolvedValue(null);

      // When
      await processor.process(makeJob({ todoId: 1, stageLabel: "60min" }));

      // Then — DB의 최신 제목은 잠금 화면 길이를 보호하는 본문 preview에 사용됨
      const payload = notificationPublisher.publish.mock.calls[0]?.[0];
      expect(payload?.body).toContain("밥먹고 약먹기");
      expect(`${payload?.title}${payload?.body}`).not.toContain("{todoTitle}");
    });
  });

  describe("투두 유효성 검증", () => {
    it("투두가 완료되었으면 알림을 발송하지 않는다", async () => {
      // Given
      setupMocks({ todoExists: false });

      // When
      await processor.process(makeJob());

      // Then
      expect(notificationPublisher.publish).not.toHaveBeenCalled();
    });

    it("투두가 삭제되었으면 알림을 발송하지 않는다", async () => {
      // Given — findActiveTodo가 null 반환 (삭제됨)
      setupMocks({ todoExists: false });

      // When
      await processor.process(makeJob());

      // Then
      expect(notificationPublisher.publish).not.toHaveBeenCalled();
    });
  });

  describe("회차 중복 방지", () => {
    it.each([
      { name: "시간 일정은 날짜와 벽시계", scheduledLocalTime: "10:00", key: "2026-11-05T10:00" },
      { name: "벽시계가 빈 행은 날짜만", scheduledLocalTime: null, key: "2026-11-05" },
    ])("$name로 회차를 넘긴다", async ({ scheduledLocalTime, key }) => {
      // Given
      reader.findActiveTodo.mockResolvedValue({
        id: 1,
        title: TODO_TITLE,
        seriesId: null,
        startDate: "2026-11-05",
        scheduledLocalTime,
      });
      notificationPublisher.publish.mockResolvedValue(null);
      // When
      await processor.process(makeJob());
      // Then
      expect(notificationPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ reminderOccurrenceKey: key, metadata: { stage: "60min" } }),
      );
    });

    it("이미 울린 회차면 건너뛴 것으로 남기고 완료로 세지 않는다", async () => {
      // Given
      setupMocks({ todoExists: true });
      notificationPublisher.publish.mockResolvedValue(null);
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
      setupMocks({ todoExists: true });
      notificationPublisher.publish.mockRejectedValue(new Error("Push failed"));

      // When & Then
      await expect(processor.process(makeJob())).rejects.toThrow("Push failed");
    });

    it("DB 조회 실패 시 에러가 전파된다 (job runtime 재시도)", async () => {
      // Given
      reader.findActiveTodo.mockRejectedValue(new Error("DB connection failed"));

      // When & Then
      await expect(processor.process(makeJob())).rejects.toThrow("DB connection failed");
    });
  });
});
