import { Logger } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { Test, type TestingModule } from "@nestjs/testing";

import { REMINDER_SCHEDULER } from "@/scheduler";
import {
	BullMQReminderSchedulerAdapter,
	TODO_REMINDER_QUEUE,
} from "@/scheduler/infrastructure/scheduler/bullmq-reminder-scheduler.adapter";
import type { DomainEventPublisherPort } from "@/shared/application/ports";
import {
	JOB_RUNTIME,
	type JobCancellationResult,
} from "@/shared/application/ports/job-runtime.port";
import { EventEmitterDomainEventPublisher } from "@/shared/infrastructure/events/event-emitter-domain-event.publisher";
import { TodoDeletedHandler } from "@/todo/application/events/todo-deleted.handler";
import { TodoRescheduledHandler } from "@/todo/application/events/todo-rescheduled.handler";
import { TODO_REMINDER } from "@/todo/application/ports/todo-reminder.port";
import { TodoDeletedEvent } from "@/todo/domain/events/todo-deleted.event";
import { TodoRescheduledEvent } from "@/todo/domain/events/todo-rescheduled.event";
import { TodoReminderAdapter } from "@/todo/infrastructure/adapters/todo-reminder.adapter";

import { FakeJobRuntime } from "../mocks/fake-job-runtime";
import { suppressLogger } from "../setup/suppress-logger";

describe("리마인더 취소 이벤트 경계 통합 테스트 (Fake runtime)", () => {
	let module: TestingModule;
	let publisher: DomainEventPublisherPort;
	let runtime: FakeJobRuntime;
	let cancel: jest.SpiedFunction<(queue: string, jobKey: string) => Promise<JobCancellationResult>>;

	beforeAll(async () => {
		suppressLogger();
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
		cancel = jest.spyOn(runtime, "cancel");
	});

	beforeEach(() => {
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
		const errorLogger = jest.mocked(Logger.prototype.error);
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
		const errorLogger = jest.mocked(Logger.prototype.error);
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
