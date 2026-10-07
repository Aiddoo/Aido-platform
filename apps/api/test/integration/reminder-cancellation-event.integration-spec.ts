import { Logger } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { Test, type TestingModule } from "@nestjs/testing";
import { vi, type MockInstance } from "vitest";

import {
  BullMQReminderSchedulerAdapter,
  TODO_REMINDER_QUEUE,
} from "#api/modules/notification/infrastructure/jobs/reminders/bullmq-reminder-scheduler.adapter";
import { REMINDER_SCHEDULER } from "#api/modules/notification/notification-reminders.public";
import { TODO_REMINDER } from "#api/modules/planning/application/ports/todos/todo-reminder.port";
import { TodoDeletedEvent } from "#api/modules/planning/domain/events/todos/todo-deleted.event";
import { TodoRescheduledEvent } from "#api/modules/planning/domain/events/todos/todo-rescheduled.event";
import { TodoReminderAdapter } from "#api/modules/planning/infrastructure/adapters/todos/todo-reminder.adapter";
import { TodoDeletedHandler } from "#api/modules/planning/infrastructure/subscribers/todos/todo-deleted.handler";
import { TodoRescheduledHandler } from "#api/modules/planning/infrastructure/subscribers/todos/todo-rescheduled.handler";
import { EventEmitterDomainEventPublisher } from "#api/platform/events/event-emitter-domain-event.publisher";
import type { DomainEventPublisherPort } from "#api/shared/application/ports/index";
import {
  JOB_RUNTIME,
  type JobCancellationResult,
} from "#api/shared/application/ports/job-runtime.port";

import { FakeJobRuntime } from "../mocks/fake-job-runtime.js";
import { suppressLogger } from "../setup/suppress-logger.js";

describe("리마인더 취소 이벤트 경계 통합 테스트 (Fake runtime)", () => {
  let module: TestingModule;
  let publisher: DomainEventPublisherPort;
  let runtime: FakeJobRuntime;
  let cancel: MockInstance<
    (queue: string, idempotencyKey: string) => Promise<JobCancellationResult>
  >;

  beforeAll(async () => {
    runtime = new FakeJobRuntime();
    module = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        EventEmitterDomainEventPublisher,
        TodoDeletedHandler,
        TodoRescheduledHandler,
        BullMQReminderSchedulerAdapter,
        TodoReminderAdapter,
        { provide: JOB_RUNTIME, useValue: runtime },
        {
          provide: REMINDER_SCHEDULER,
          useExisting: BullMQReminderSchedulerAdapter,
        },
        { provide: TODO_REMINDER, useExisting: TodoReminderAdapter },
      ],
    }).compile();
    await module.init();
    publisher = module.get(EventEmitterDomainEventPublisher);
  });

  beforeEach(() => {
    suppressLogger();
    cancel = vi.spyOn(runtime, "cancel");
    runtime.clear();
    cancel.mockReset();
    cancel.mockResolvedValue({ status: "cancelled" });
  });

  afterAll(async () => {
    await module.close();
  });

  it("handler rejection을 publisher가 한 번 관측하고 post-commit 성공은 유지한다", async () => {
    // Given - runtime→scheduler에서 문맥화된 취소 실패
    const context = "Reminder cancellation failed: todoId=42, stage=60min, runtime=job-runtime";
    cancel.mockRejectedValueOnce(new Error("postgres unavailable"));
    const errorLogger = vi.mocked(Logger.prototype.error);
    errorLogger.mockClear();

    // When - 실제 Nest @OnEvent 구독 경계로 발행
    const publication = publisher.publishAll([new TodoDeletedEvent(42, "user-123")]);

    // Then - async 실패를 기다려 한 번 기록하되 caller는 실패시키지 않음
    await expect(publication).resolves.toBeUndefined();
    expect(cancel).toHaveBeenCalledWith(TODO_REMINDER_QUEUE, "reminder_42_60min");
    expect(errorLogger).toHaveBeenCalledTimes(1);
    expect(errorLogger).toHaveBeenCalledWith(
      `Failed to publish domain event todo.deleted: Error: ${context}`,
      expect.any(String),
    );
  });

  it("non-null 재스케줄의 기존 작업 취소 실패도 publisher가 관측한다", async () => {
    // Given - scheduleReminder 내부 기존 작업 취소가 실패
    const context = "Reminder cancellation failed: todoId=42, stage=60min, runtime=job-runtime";
    cancel.mockRejectedValueOnce(new Error("postgres unavailable"));
    const errorLogger = vi.mocked(Logger.prototype.error);
    errorLogger.mockClear();

    // When - 실제 Nest handler → Todo adapter → scheduler 경계로 발행
    const publication = publisher.publishAll([
      new TodoRescheduledEvent(42, "user-123", new Date(Date.now() + 2 * 60 * 60 * 1000)),
    ]);

    // Then - HTTP/post-commit 성공을 유지하면서 실패를 한 번 관측
    await expect(publication).resolves.toBeUndefined();
    expect(cancel).toHaveBeenCalledWith(TODO_REMINDER_QUEUE, "reminder_42_60min");
    expect(runtime.enqueueCalls).toHaveLength(0);
    expect(errorLogger).toHaveBeenCalledTimes(1);
    expect(errorLogger).toHaveBeenCalledWith(
      `Failed to publish domain event todo.rescheduled: Error: ${context}`,
      expect.any(String),
    );
  });
});
