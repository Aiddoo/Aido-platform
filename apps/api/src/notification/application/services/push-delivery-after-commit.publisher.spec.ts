import { Logger } from "@nestjs/common";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import {
	AFTER_COMMIT_TASK_REGISTRY,
	type AfterCommitTask,
	type AfterCommitTaskRegistryPort,
} from "@/shared/application/ports";

import { PublishPushDeliveryOutboxUseCase } from "../use-cases/publish-push-delivery-outbox/publish-push-delivery-outbox.use-case";
import { PushDeliveryAfterCommitPublisher } from "./push-delivery-after-commit.publisher";

function firstRegisteredTask(tasks: readonly AfterCommitTask[]): AfterCommitTask {
	const task = tasks[0];
	if (!task) throw new Error("Expected an after-commit task to be registered");
	return task;
}

describe("PushDeliveryAfterCommitPublisher — commit 이후 fast path", () => {
	let publisher: PushDeliveryAfterCommitPublisher;
	let publishOutbox: Mocked<PublishPushDeliveryOutboxUseCase>;
	let afterCommit: Mocked<AfterCommitTaskRegistryPort>;
	let registeredTasks: AfterCommitTask[];

	beforeEach(async () => {
		registeredTasks = [];
		const { unit, unitRef } = await TestBed.solitary(PushDeliveryAfterCommitPublisher)
			.mock<AfterCommitTaskRegistryPort>(AFTER_COMMIT_TASK_REGISTRY)
			.impl(() => ({
				register: jest.fn((task: AfterCommitTask) => {
					registeredTasks.push(task);
				}),
			}))
			.compile();

		publisher = unit;
		publishOutbox = unitRef.get(PublishPushDeliveryOutboxUseCase);
		afterCommit = unitRef.get(AFTER_COMMIT_TASK_REGISTRY);
		publishOutbox.execute.mockResolvedValue(1);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("등록 시점의 dispatch ID 복사본만 commit 이후 발행한다", async () => {
		// Given - 등록 후 호출자가 변경할 수 있는 mutable 배열
		const dispatchIds = [61, 62];

		// When - fast path를 등록한 뒤 원본 배열을 변경하고 commit task 실행
		publisher.register(dispatchIds);
		dispatchIds.splice(0, dispatchIds.length, 999);
		await firstRegisteredTask(registeredTasks)();

		// Then - transaction에서 커밋된 최초 ID snapshot만 발행
		expect(afterCommit.register).toHaveBeenCalledTimes(1);
		expect(publishOutbox.execute).toHaveBeenCalledWith({
			kind: "dispatches",
			dispatchIds: [61, 62],
		});
	});

	it("2초 timeout은 commit 흐름만 놓아주고 이미 시작한 발행은 취소하지 않는다", async () => {
		// Given - fast path 제한 시간보다 늦게 완료되는 outbox publication
		jest.useFakeTimers();
		jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
		let resolvePublication: ((publishedCount: number) => void) | undefined;
		let underlyingPublicationSettled = false;
		const underlyingPublication = new Promise<number>((resolve) => {
			resolvePublication = resolve;
		}).then((publishedCount) => {
			underlyingPublicationSettled = true;
			return publishedCount;
		});
		publishOutbox.execute.mockReturnValue(underlyingPublication);
		publisher.register([71]);

		// When - after-commit task가 2초 제한에 도달
		const fastPath = firstRegisteredTask(registeredTasks)();
		await jest.advanceTimersByTimeAsync(2_000);

		// Then - task는 best-effort로 끝나지만 underlying promise는 이후 정상 완료 가능
		await expect(fastPath).resolves.toBeUndefined();
		expect(underlyingPublicationSettled).toBe(false);
		resolvePublication?.(1);
		await expect(underlyingPublication).resolves.toBe(1);
		expect(underlyingPublicationSettled).toBe(true);
	});

	it("발행할 dispatch가 없으면 after-commit task를 등록하지 않는다", () => {
		// Given - 빈 dispatch ID 목록

		// When - fast path 등록 요청
		publisher.register([]);

		// Then - 불필요한 callback과 timer를 만들지 않음
		expect(afterCommit.register).not.toHaveBeenCalled();
	});
});
