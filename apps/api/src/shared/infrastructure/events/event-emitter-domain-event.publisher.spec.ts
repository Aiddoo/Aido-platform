import { Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";

import { EventEmitterDomainEventPublisher } from "./event-emitter-domain-event.publisher";

describe("EventEmitterDomainEventPublisher — 비동기 이벤트 경계", () => {
	let eventEmitter: EventEmitter2;
	let publisher: EventEmitterDomainEventPublisher;
	let errorLogger: jest.SpyInstance;

	beforeEach(() => {
		eventEmitter = new EventEmitter2();
		publisher = new EventEmitterDomainEventPublisher(eventEmitter);
		errorLogger = jest.spyOn(Logger.prototype, "error").mockImplementation();
	});

	it("비동기 listener가 끝날 때까지 발행 Promise를 완료하지 않는다", async () => {
		// Given - 외부에서 해제할 수 있는 비동기 listener
		let release: (() => void) | undefined;
		eventEmitter.on(
			"todo.deleted",
			() =>
				new Promise<void>((resolve) => {
					release = resolve;
				}),
		);
		let settled = false;

		// When - 발행 시작
		const publishing = publisher.publishAll([{ eventName: "todo.deleted" }]).then(() => {
			settled = true;
		});
		await new Promise((resolve) => setImmediate(resolve));

		// Then - listener 완료 전에는 발행도 미완료
		expect(settled).toBe(false);
		release?.();
		await publishing;
		expect(settled).toBe(true);
	});

	it("listener rejection을 문맥과 함께 한 번 기록하고 다음 이벤트를 계속 발행한다", async () => {
		// Given - 첫 이벤트 실패, 두 번째 이벤트 정상
		const context = "Reminder cancellation failed: todoId=42, stage=60min, runtime=job-runtime";
		eventEmitter.on("todo.deleted", async () => {
			throw new Error(context);
		});
		const nextListener = jest.fn();
		eventEmitter.on("todo.updated", nextListener);

		// When & Then - post-commit 요청을 실패시키지 않고 오류를 격리
		await expect(
			publisher.publishAll([{ eventName: "todo.deleted" }, { eventName: "todo.updated" }]),
		).resolves.toBeUndefined();
		expect(nextListener).toHaveBeenCalledTimes(1);
		expect(errorLogger).toHaveBeenCalledTimes(1);
		expect(errorLogger).toHaveBeenCalledWith(
			`Failed to publish domain event todo.deleted: Error: ${context}`,
			expect.any(String),
		);
	});
});
