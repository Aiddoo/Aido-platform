import { Logger } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { Test, type TestingModule } from "@nestjs/testing";
import type { DomainEventPublisherPort } from "@/shared/application/ports";
import { EventEmitterDomainEventPublisher } from "@/shared/infrastructure/events/event-emitter-domain-event.publisher";
import { TodoDeletedHandler } from "@/todo/application/events/todo-deleted.handler";
import {
	TODO_REMINDER,
	type TodoReminderPort,
} from "@/todo/application/ports/todo-reminder.port";
import { TodoDeletedEvent } from "@/todo/domain/events/todo-deleted.event";
import { suppressLogger } from "../setup/suppress-logger";

describe("리마인더 취소 이벤트 경계 통합 테스트 (Mock runtime)", () => {
	let module: TestingModule;
	let publisher: DomainEventPublisherPort;
	let todoReminder: jest.Mocked<TodoReminderPort>;

	beforeAll(async () => {
		suppressLogger();
		todoReminder = {
			scheduleReminder: jest.fn(),
			cancelReminder: jest.fn(),
		};
		module = await Test.createTestingModule({
			imports: [EventEmitterModule.forRoot()],
			providers: [
				EventEmitterDomainEventPublisher,
				TodoDeletedHandler,
				{ provide: TODO_REMINDER, useValue: todoReminder },
			],
		}).compile();
		await module.init();
		publisher = module.get(EventEmitterDomainEventPublisher);
	});

	afterAll(async () => {
		await module.close();
	});

	it("handler rejection을 publisher가 한 번 관측하고 post-commit 성공은 유지한다", async () => {
		// Given - runtime→scheduler에서 문맥화된 취소 실패
		const context =
			"Reminder cancellation failed: todoId=42, stage=60min, runtime=job-runtime";
		todoReminder.cancelReminder.mockRejectedValue(new Error(context));
		const errorLogger = jest.mocked(Logger.prototype.error);
		errorLogger.mockClear();

		// When - 실제 Nest @OnEvent 구독 경계로 발행
		const publication = publisher.publishAll([
			new TodoDeletedEvent(42, "user-123"),
		]);

		// Then - async 실패를 기다려 한 번 기록하되 caller는 실패시키지 않음
		await expect(publication).resolves.toBeUndefined();
		expect(todoReminder.cancelReminder).toHaveBeenCalledWith(42);
		expect(errorLogger).toHaveBeenCalledTimes(1);
		expect(errorLogger).toHaveBeenCalledWith(
			`Failed to publish domain event todo.deleted: Error: ${context}`,
			expect.any(String),
		);
	});
});
