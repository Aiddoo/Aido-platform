import type { EnqueueJobOptions } from "@/shared/application/ports/job-runtime.port";

import {
	type BullJobClient,
	type BullMqClientFactory,
	BullMqJobRuntimeAdapter,
	type BullQueueClient,
	type BullWorkerClient,
	toBullMqJobId,
} from "./bullmq-job-runtime.adapter";

const QUEUE = "document-generation.v1";
const DEAD_LETTER_QUEUE = "document-generation-dead-letter";

const DEAD_LETTER_JOB_POLICY = {
	retryLimit: 4,
	retryDelaySeconds: 7,
	retryBackoff: false,
	expireInSeconds: 300,
	retentionSeconds: 86_400,
	deleteAfterSeconds: 3_600,
} as const;

type FakeBullJobState =
	| "active"
	| "completed"
	| "delayed"
	| "failed"
	| "prioritized"
	| "unknown"
	| "waiting"
	| "waiting-children";

interface JobOptionOverrides {
	readonly idempotencyKey?: string;
	readonly startAfter?: Date;
}

function options(overrides: JobOptionOverrides = {}): EnqueueJobOptions {
	return {
		idempotencyKey: "document:42",
		retryLimit: 2,
		retryDelaySeconds: 5,
		retryBackoff: true,
		expireInSeconds: 600,
		retentionSeconds: 14 * 24 * 60 * 60,
		deleteAfterSeconds: 7 * 24 * 60 * 60,
		deadLetter: { queue: DEAD_LETTER_QUEUE, jobPolicy: DEAD_LETTER_JOB_POLICY },
		timezone: "Asia/Seoul",
		...overrides,
	};
}

function legacyOptions(): EnqueueJobOptions {
	return {
		jobKey: "document_42",
		retryLimit: 2,
		retryDelaySeconds: 5,
		retryBackoff: true,
		expireInSeconds: 600,
		retentionSeconds: 14 * 24 * 60 * 60,
		deleteAfterSeconds: 7 * 24 * 60 * 60,
	};
}

class FakeQueue implements BullQueueClient {
	readonly added: Array<{ name: string; data: object; options: object }> = [];
	readonly schedules: Array<{
		key: string;
		repeat: { pattern: string; tz?: string };
		template: { name: string; data: object; opts: object };
	}> = [];
	counts = { wait: 0, delayed: 0, active: 0, failed: 0 };
	oldestTimestamp: number | null = null;
	removedJobIds: string[] = [];
	requestedJobIds: string[] = [];
	removedScheduleKeys: string[] = [];
	jobExists = true;
	readonly missingJobIds = new Set<string>();
	jobState: FakeBullJobState = "waiting";
	getStateError?: Error;
	removeError?: Error;
	closeOrder: string[];

	constructor(
		readonly name: string,
		closeOrder: string[],
	) {
		this.closeOrder = closeOrder;
	}

	async add(name: string, data: object, options: object): Promise<{ id?: string }> {
		this.added.push({ name, data, options });
		return { id: "bull-job-1" };
	}

	async upsertJobScheduler(
		key: string,
		repeat: { pattern: string; tz?: string },
		template: { name: string; data: object; opts: object },
	): Promise<void> {
		this.schedules.push({ key, repeat, template });
	}

	async removeJobScheduler(key: string): Promise<boolean> {
		this.removedScheduleKeys.push(key);
		return true;
	}

	async getJob(id: string): Promise<
		| {
				getState(): Promise<FakeBullJobState>;
				remove(): Promise<void>;
		  }
		| undefined
	> {
		this.requestedJobIds.push(id);
		if (!this.jobExists || this.missingJobIds.has(id)) {
			return undefined;
		}
		return {
			getState: async () => {
				if (this.getStateError) {
					throw this.getStateError;
				}
				return this.jobState;
			},
			remove: async () => {
				if (this.removeError) {
					throw this.removeError;
				}
				this.removedJobIds.push(id);
			},
		};
	}

	async getCounts(): Promise<{
		wait: number;
		delayed: number;
		active: number;
		failed: number;
	}> {
		return this.counts;
	}

	async getOldestWaitingTimestamp(): Promise<number | null> {
		return this.oldestTimestamp;
	}

	async close(): Promise<void> {
		this.closeOrder.push(`queue:${this.name}`);
	}
}

class FakeWorker implements BullWorkerClient {
	private failedListener?: (job: BullJobClient | undefined) => Promise<void>;
	closeOrder: string[];

	constructor(
		readonly name: string,
		readonly processor: (job: BullJobClient) => Promise<void>,
		readonly concurrency: number,
		closeOrder: string[],
	) {
		this.closeOrder = closeOrder;
	}

	onFailed(listener: (job: BullJobClient | undefined) => Promise<void>): void {
		this.failedListener = listener;
	}

	async emitFailed(job: BullJobClient): Promise<void> {
		await this.failedListener?.(job);
	}

	async close(_force?: boolean): Promise<void> {
		this.closeOrder.push(`worker:${this.name}`);
	}
}

class FakeFactory implements BullMqClientFactory {
	readonly queues = new Map<string, FakeQueue>();
	readonly workers = new Map<string, FakeWorker>();
	readonly closeOrder: string[] = [];

	createQueue(name: string): BullQueueClient {
		const queue = new FakeQueue(name, this.closeOrder);
		this.queues.set(name, queue);
		return queue;
	}

	createWorker(
		name: string,
		processor: (job: BullJobClient) => Promise<void>,
		concurrency: number,
	): BullWorkerClient {
		const worker = new FakeWorker(name, processor, concurrency, this.closeOrder);
		this.workers.set(name, worker);
		return worker;
	}
}

describe("BullMqJobRuntimeAdapter — Redis rollback runtime", () => {
	let factory: FakeFactory;
	let runtime: BullMqJobRuntimeAdapter;

	beforeEach(() => {
		factory = new FakeFactory();
		runtime = new BullMqJobRuntimeAdapter(factory, {
			job: { shutdownTimeoutMs: 90_000 },
		});
	});

	it("enqueue 옵션을 기존 BullMQ 의미로 매핑한다", async () => {
		jest.useFakeTimers({ now: new Date("2026-07-22T12:00:00.000Z") });
		const startAfter = new Date(Date.now() + 10_000);

		await expect(runtime.enqueue(QUEUE, { documentId: 42 }, options({ startAfter }))).resolves.toBe(
			"bull-job-1",
		);

		expect(factory.queues.get(QUEUE)?.added).toEqual([
			{
				name: QUEUE,
				data: {
					__aidoJobRuntime: 1,
					data: { documentId: 42 },
					deadLetter: DEAD_LETTER_QUEUE,
					deadLetterJobPolicy: DEAD_LETTER_JOB_POLICY,
					deleteAfterSeconds: 604_800,
					retryBackoff: true,
					retryDelaySeconds: 5,
					retryLimit: 2,
					retentionSeconds: 1_209_600,
				},
				options: {
					jobId: "aido_ZG9jdW1lbnQ6NDI",
					delay: 10_000,
					attempts: 3,
					backoff: { type: "exponential", delay: 5_000 },
					removeOnComplete: { age: 604_800 },
					removeOnFail: { age: 1_209_600 },
				},
			},
		]);
		jest.useRealTimers();
	});

	it("신규·deprecated identity 이름을 같은 BullMQ jobId로 매핑한다", async () => {
		await runtime.enqueue(QUEUE, { documentId: 42 }, options({ idempotencyKey: "document_42" }));
		await runtime.enqueue(QUEUE, { documentId: 42 }, legacyOptions());

		const added = factory.queues.get(QUEUE)?.added;
		expect(added?.[0]?.options).toMatchObject({ jobId: "document_42" });
		expect(added?.[1]?.options).toMatchObject({ jobId: "document_42" });
	});

	it("scheduleKey와 timezone을 BullMQ scheduler에 보존한다", async () => {
		await runtime.schedule(
			"weekly-document",
			"0 1 * * 1",
			QUEUE,
			{ reportType: "WEEKLY" },
			options({ startAfter: new Date("2026-07-22T12:00:10.000Z") }),
		);

		expect(factory.queues.get(QUEUE)?.schedules).toEqual([
			{
				key: "weekly-document",
				repeat: { pattern: "0 1 * * 1", tz: "Asia/Seoul" },
				template: expect.objectContaining({
					name: QUEUE,
					data: expect.objectContaining({
						data: { reportType: "WEEKLY" },
					}),
				}),
			},
		]);
		expect(factory.queues.get("document-generation")?.removedScheduleKeys).toEqual([
			"weekly-document",
		]);
		const schedulerOptions = factory.queues.get(QUEUE)?.schedules[0]?.template.opts;
		expect(schedulerOptions).not.toHaveProperty("jobId");
		expect(schedulerOptions).not.toHaveProperty("delay");
	});

	it("worker가 신규 wrapper와 기존 raw payload를 같은 envelope로 전달한다", async () => {
		const handler = jest.fn().mockResolvedValue(undefined);
		await runtime.work(QUEUE, handler, {
			teamSize: 2,
			pollingIntervalSeconds: 2,
		});
		const worker = factory.workers.get(QUEUE);
		expect(worker?.concurrency).toBe(2);

		await worker?.processor({
			id: "new-job",
			name: QUEUE,
			data: {
				__aidoJobRuntime: 1,
				data: { documentId: 42 },
			},
			attemptsMade: 1,
			opts: { attempts: 3 },
			timestamp: Date.now(),
		});
		await worker?.processor({
			id: "legacy-job",
			name: QUEUE,
			data: { documentId: 41 },
			attemptsMade: 0,
			opts: { attempts: 3 },
			timestamp: Date.now(),
		});

		expect(handler).toHaveBeenNthCalledWith(1, [
			{
				id: "new-job",
				name: QUEUE,
				data: { documentId: 42 },
				attempt: 2,
			},
		]);
		expect(handler).toHaveBeenNthCalledWith(2, [
			{
				id: "legacy-job",
				name: QUEUE,
				data: { documentId: 41 },
				attempt: 1,
			},
		]);
	});

	it("최종 실패 작업을 payload 노출 없이 dead-letter queue로 이동한다", async () => {
		await runtime.work(QUEUE, jest.fn().mockResolvedValue(undefined), {
			teamSize: 1,
			pollingIntervalSeconds: 2,
		});
		const worker = factory.workers.get(QUEUE);

		await worker?.emitFailed({
			id: "failed-job",
			name: QUEUE,
			data: {
				__aidoJobRuntime: 1,
				data: { documentId: 42 },
				deadLetter: "document-generation-dead-letter",
				deadLetterJobPolicy: DEAD_LETTER_JOB_POLICY,
				deleteAfterSeconds: 604_800,
				retryBackoff: true,
				retryDelaySeconds: 5,
				retryLimit: 2,
				retentionSeconds: 1_209_600,
			},
			attemptsMade: 3,
			opts: { attempts: 3 },
			timestamp: Date.now(),
		});

		expect(factory.queues.get(DEAD_LETTER_QUEUE)?.added).toEqual([
			{
				name: DEAD_LETTER_QUEUE,
				data: { documentId: 42 },
				options: {
					jobId: "aido_ZmFpbGVkLWpvYjpkZWFkLWxldHRlcg",
					attempts: 5,
					backoff: { type: "fixed", delay: 7_000 },
					removeOnComplete: { age: 3_600 },
					removeOnFail: { age: 86_400 },
				},
			},
		]);
	});

	it.each(["waiting", "delayed", "prioritized", "waiting-children"] as const)(
		"cancel은 %s 작업을 실제 제거하고 cancelled를 반환한다",
		async (state) => {
			await runtime.enqueue(QUEUE, { documentId: 42 }, options());
			const queue = factory.queues.get(QUEUE);
			expect(queue).toBeDefined();
			if (!queue) return;
			queue.jobState = state;

			await expect(runtime.cancel(QUEUE, "document:42")).resolves.toEqual({
				status: "cancelled",
			});
			expect(queue.removedJobIds).toEqual(["aido_ZG9jdW1lbnQ6NDI"]);
		},
	);

	it("cancel은 safe ID가 없으면 rolling 배포 이전 raw ID를 확인한다", async () => {
		await runtime.enqueue(QUEUE, { documentId: 42 }, options());
		const queue = factory.queues.get(QUEUE);
		expect(queue).toBeDefined();
		if (!queue) return;
		queue.missingJobIds.add(toBullMqJobId("document:42"));

		await expect(runtime.cancel(QUEUE, "document:42")).resolves.toEqual({
			status: "cancelled",
		});
		expect(queue.requestedJobIds).toEqual(["aido_ZG9jdW1lbnQ6NDI", "document:42"]);
		expect(queue.removedJobIds).toEqual(["document:42"]);
	});

	it.each(["active", "completed", "failed", "unknown"] as const)(
		"cancel은 존재하더라도 %s 작업이면 missing을 반환한다",
		async (state) => {
			await runtime.enqueue(QUEUE, { documentId: 42 }, options());
			const queue = factory.queues.get(QUEUE);
			expect(queue).toBeDefined();
			if (!queue) return;
			queue.jobState = state;

			await expect(runtime.cancel(QUEUE, "document:42")).resolves.toEqual({
				status: "missing",
			});
			expect(queue.removedJobIds).toHaveLength(0);
		},
	);

	it("cancel은 idempotencyKey가 없으면 missing을 반환한다", async () => {
		await runtime.enqueue(QUEUE, { documentId: 42 }, options());
		const queue = factory.queues.get(QUEUE);
		expect(queue).toBeDefined();
		if (!queue) return;
		queue.jobExists = false;

		await expect(runtime.cancel(QUEUE, "missing")).resolves.toEqual({
			status: "missing",
		});
		expect(queue.removedJobIds).toHaveLength(0);
	});

	it("cancel은 BullMQ 제거 오류를 missing으로 바꾸지 않고 전파한다", async () => {
		await runtime.enqueue(QUEUE, { documentId: 42 }, options());
		const queue = factory.queues.get(QUEUE);
		expect(queue).toBeDefined();
		if (!queue) return;
		queue.removeError = new Error("redis unavailable");

		await expect(runtime.cancel(QUEUE, "document:42")).rejects.toThrow("redis unavailable");
	});

	it("cancel은 BullMQ 상태 조회 오류를 missing으로 바꾸지 않고 전파한다", async () => {
		await runtime.enqueue(QUEUE, { documentId: 42 }, options());
		const queue = factory.queues.get(QUEUE);
		expect(queue).toBeDefined();
		if (!queue) return;
		queue.getStateError = new Error("redis state unavailable");

		await expect(runtime.cancel(QUEUE, "document:42")).rejects.toThrow("redis state unavailable");
		expect(queue.removedJobIds).toHaveLength(0);
	});

	it("health를 공통 모델로 정규화한다", async () => {
		jest.useFakeTimers({ now: new Date("2026-07-22T12:00:10.000Z") });
		await runtime.enqueue(QUEUE, { documentId: 42 }, options());
		const queue = factory.queues.get(QUEUE);
		expect(queue).toBeDefined();
		if (!queue) return;
		queue.counts = { wait: 2, delayed: 1, active: 1, failed: 3 };
		queue.oldestTimestamp = Date.now() - 10_000;

		await expect(runtime.health([QUEUE])).resolves.toEqual({
			backend: "redis",
			degraded: false,
			queues: {
				[QUEUE]: {
					waiting: 3,
					active: 1,
					failed: 3,
					oldestAgeSeconds: 10,
				},
			},
		});
		jest.useRealTimers();
	});

	it("종료 시 worker를 먼저 기다린 뒤 queue를 닫는다", async () => {
		await runtime.enqueue(QUEUE, { documentId: 42 }, options());
		await runtime.work(QUEUE, jest.fn().mockResolvedValue(undefined), {
			teamSize: 1,
			pollingIntervalSeconds: 2,
		});

		await runtime.stop();

		expect(factory.closeOrder).toEqual([`worker:${QUEUE}`, `queue:${QUEUE}`]);
	});
});
