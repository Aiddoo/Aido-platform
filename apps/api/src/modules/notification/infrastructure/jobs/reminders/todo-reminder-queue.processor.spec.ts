import { TestBed } from "@suites/unit";
import type { Mocked } from "vitest";

import {
  NotificationPublisher,
  NOTIFICATION_RECIPIENT_LOCALE_READER,
  type NotificationRecipientLocaleReaderPort,
} from "#api/modules/notification/notification-delivery.public";

import {
  TODO_REMINDER_READER,
  type TodoReminderReaderPort,
} from "../../../application/ports/reminders/todo-reminder-reader.port.js";
import { SCHEDULER_CAMPAIGN_KEY } from "../../../domain/services/reminders/notification-campaign.js";
import { type ReminderJobData, TODO_REMINDER_JOB_NAME } from "./todo-reminder-queue.constants.js";
import { TodoReminderQueueProcessor } from "./todo-reminder-queue.processor.js";

const USER_ID = "user-1";
const TODO_TITLE = "Test Todo";

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
  let notificationPublisher: Mocked<NotificationPublisher>;
  let recipientLocaleReader: Mocked<NotificationRecipientLocaleReaderPort>;

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(TodoReminderQueueProcessor).compile();

    processor = unit;
    reader = unitRef.get(TODO_REMINDER_READER);
    notificationPublisher = unitRef.get(NotificationPublisher);
    recipientLocaleReader = unitRef.get(NOTIFICATION_RECIPIENT_LOCALE_READER);
    recipientLocaleReader.getLocale.mockResolvedValue("ko");
  });

  /** 리더 mock 설정 헬퍼 */
  const setupMocks = (
    options: {
      todoExists?: boolean;
      notificationExists?: boolean;
      todoTitle?: string;
    } = {},
  ) => {
    const { todoExists = true, notificationExists = false, todoTitle = TODO_TITLE } = options;

    reader.findActiveTodo.mockResolvedValue(todoExists ? { id: 1, title: todoTitle } : null);
    reader.existsRecentReminderNotification.mockResolvedValue(notificationExists);
  };

  describe("정상 처리", () => {
    it("유효한 투두에 대해 알림을 발송한다", async () => {
      // Given
      setupMocks({ todoExists: true, notificationExists: false });
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
      setupMocks({ todoExists: true, notificationExists: false });
      notificationPublisher.publish.mockResolvedValue(null);

      // When
      await processor.process(makeJob({ stageLabel: "10min" }));

      // Then
      expect(notificationPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: { stage: "10min" } }),
      );
    });

    it("immediate 단계 알림을 발송한다", async () => {
      // Given
      setupMocks({ todoExists: true, notificationExists: false });
      notificationPublisher.publish.mockResolvedValue(null);

      // When
      await processor.process(makeJob({ stageLabel: "immediate" }));

      // Then
      expect(notificationPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: { stage: "immediate" } }),
      );
    });

    it("스케줄링 이후 제목이 변경된 경우 DB의 최신 제목으로 알림을 발송한다", async () => {
      // Given — DB에는 변경된 제목
      setupMocks({
        todoExists: true,
        notificationExists: false,
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

  describe("DB 중복 방지", () => {
    it("24시간 내 동일 알림이 있으면 스킵한다", async () => {
      // Given — 투두는 존재하지만 동일 알림이 이미 발송됨
      setupMocks({ todoExists: true, notificationExists: true });

      // When
      await processor.process(makeJob());

      // Then
      expect(notificationPublisher.publish).not.toHaveBeenCalled();
    });

    it("동일 알림이 없으면 정상 발송한다", async () => {
      // Given
      setupMocks({ todoExists: true, notificationExists: false });
      notificationPublisher.publish.mockResolvedValue(null);

      // When
      await processor.process(makeJob());

      // Then
      expect(notificationPublisher.publish).toHaveBeenCalledTimes(1);
    });
  });

  describe("에러 처리", () => {
    it("알림 발송 실패 시 에러가 전파된다 (job runtime 재시도)", async () => {
      // Given
      setupMocks({ todoExists: true, notificationExists: false });
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
