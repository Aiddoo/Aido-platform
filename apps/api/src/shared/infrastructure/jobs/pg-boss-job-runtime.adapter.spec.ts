import type {
	Db,
	FindJobsOptions,
	JobWithMetadata,
	QueueResult,
	ScheduleOptions,
	SendOptions,
	StopOptions,
	WorkOptions,
} from "pg-boss";
import type {
	EnqueueJobOptions,
	JobData,
} from "@/shared/application/ports/job-runtime.port";
import {
	LazyPgBossClient,
	type PgBossClient,
	PgBossJobRuntimeAdapter,
} from "./pg-boss-job-runtime.adapter";

const QUEUE = "document-generation";

function enqueueOptions(): EnqueueJobOptions {
	return {
		jobKey: "document:42",
		startAfter: new Date("2026-07-22T12:00:00.000Z"),
		retryLimit: 2,
		retryDelaySeconds: 5,
		retryBackoff: true,
		expireInSeconds: 600,
		retentionSeconds: 14 * 24 * 60 * 60,
		deleteAfterSeconds: 7 * 24 * 60 * 60,
		deadLetter: "document-generation-dead-letter",
		timezone: "Asia/Seoul",
	};
}

class FakePgBossClient implements PgBossClient {
	readonly createdQueues: string[] = [];
	readonly sendCalls: Array<{
		name: string;
		data: object;
		options: SendOptions;
	}> = [];
	readonly scheduleCalls: Array<{
		name: string;
		cron: string;
		data: object;
		options: ScheduleOptions;
	}> = [];
	readonly cancelCalls: Array<{
		name: string;
		ids: string[];
		options?: { db?: Db };
	}> = [];
	readonly stopCalls: StopOptions[] = [];
	readonly handlers = new Map<
		string,
		(jobs: JobWithMetadata<JobData>[]) => Promise<unknown>
	>();
	jobs: JobWithMetadata<JobData>[] = [];
	queues: QueueResult[] = [];

	async start(): Promise<unknown> {
		return this;
	}

	async stop(options?: StopOptions): Promise<void> {
		this.stopCalls.push(options ?? {});
	}

	on(_event: "error", _listener: (error: Error) => void): unknown {
		return this;
	}

	async createQueue(name: string): Promise<void> {
		this.createdQueues.push(name);
	}

	async send(
		name: string,
		data: object,
		options: SendOptions,
	): Promise<string | null> {
		this.sendCalls.push({ name, data, options });
		return "job-1";
	}

	async schedule(
		name: string,
		cron: string,
		data: object,
		options: ScheduleOptions,
	): Promise<void> {
		this.scheduleCalls.push({ name, cron, data, options });
	}

	async unschedule(_name: string, _key?: string): Promise<void> {}

	async findJobs<T extends JobData>(
		_name: string,
		_options?: FindJobsOptions,
	): Promise<JobWithMetadata<T>[]> {
		return this.jobs as JobWithMetadata<T>[];
	}

	async cancel(
		name: string,
		ids: string[],
		options?: { db?: Db },
	): Promise<unknown> {
		this.cancelCalls.push({ name, ids, options });
		return undefined;
	}

	async work<T extends JobData>(
		name: string,
		_options: WorkOptions & { includeMetadata: true },
		handler: (jobs: JobWithMetadata<T>[]) => Promise<unknown>,
	): Promise<string> {
		this.handlers.set(
			name,
			handler as (jobs: JobWithMetadata<JobData>[]) => Promise<unknown>,
		);
		return `worker:${name}`;
	}

	async getQueues(_names?: string[]): Promise<QueueResult[]> {
		return this.queues;
	}
}

function job(
	overrides: Partial<JobWithMetadata<JobData>> = {},
): JobWithMetadata<JobData> {
	return {
		id: "job-1",
		name: QUEUE,
		data: { documentId: 42 },
		retryCount: 1,
		createdOn: new Date("2026-07-22T11:59:00.000Z"),
		...overrides,
	} as JobWithMetadata<JobData>;
}

describe("PgBossJobRuntimeAdapter — PostgreSQL durable runtime", () => {
	let boss: FakePgBossClient;
	let queryRawUnsafe: jest.Mock;
	let runtime: PgBossJobRuntimeAdapter;

	beforeEach(() => {
		boss = new FakePgBossClient();
		queryRawUnsafe = jest.fn().mockResolvedValue([]);
		runtime = new PgBossJobRuntimeAdapter(
			boss,
			{ tx: { $queryRawUnsafe: queryRawUnsafe } },
			{ job: { shutdownTimeoutMs: 90_000 } },
		);
	});

	it("enqueue 옵션과 현재 CLS 트랜잭션을 pg-boss에 그대로 매핑한다", async () => {
		const options = enqueueOptions();

		await expect(
			runtime.enqueue(QUEUE, { documentId: 42 }, options),
		).resolves.toBe("job-1");

		expect(boss.createdQueues).toEqual([
			"document-generation-dead-letter",
			QUEUE,
		]);
		expect(boss.sendCalls).toHaveLength(1);
		expect(boss.sendCalls[0]).toMatchObject({
			name: QUEUE,
			data: { documentId: 42 },
			options: {
				id: "f987b5bb-6102-5d54-8212-2fe4b94ed26e",
				singletonKey: "document:42",
				startAfter: options.startAfter,
				retryLimit: 2,
				retryDelay: 5,
				retryBackoff: true,
				expireInSeconds: 600,
				retentionSeconds: 1_209_600,
				deleteAfterSeconds: 604_800,
				deadLetter: "document-generation-dead-letter",
			},
		});

		await boss.sendCalls[0]?.options.db?.executeSql("SELECT $1", [42]);
		expect(queryRawUnsafe).toHaveBeenCalledWith("SELECT $1", 42);
	});

	it("동일한 scheduleKey로 스케줄을 upsert한다", async () => {
		await runtime.schedule(
			"weekly-document",
			"0 1 * * 1",
			QUEUE,
			{ reportType: "WEEKLY" },
			enqueueOptions(),
		);

		expect(boss.scheduleCalls).toHaveLength(1);
		expect(boss.scheduleCalls[0]).toMatchObject({
			name: QUEUE,
			cron: "0 1 * * 1",
			data: { reportType: "WEEKLY" },
			options: {
				key: "weekly-document",
				singletonKey: "document:42",
				tz: "Asia/Seoul",
			},
		});
	});

	it("worker batch를 vendor-neutral envelope로 변환한다", async () => {
		const handler = jest.fn().mockResolvedValue(undefined);
		await runtime.work(QUEUE, handler, {
			teamSize: 2,
			pollingIntervalSeconds: 2,
		});

		const worker = boss.handlers.get(QUEUE);
		expect(worker).toBeDefined();
		await worker?.([job()]);

		expect(handler).toHaveBeenCalledWith([
			{
				id: "job-1",
				name: QUEUE,
				data: { documentId: 42 },
				attempt: 2,
			},
		]);
	});

	it("queue 상태를 공통 health 모델로 정규화한다", async () => {
		boss.queues = [
			{
				name: QUEUE,
				queuedCount: 3,
				activeCount: 1,
				failedCount: 2,
			} as QueueResult,
		];

		await expect(runtime.health([QUEUE])).resolves.toEqual({
			backend: "postgres",
			degraded: false,
			queues: {
				[QUEUE]: {
					waiting: 3,
					active: 1,
					failed: 2,
					oldestAgeSeconds: null,
				},
			},
		});
	});

	it("종료 시 worker 완료를 최대 90초 기다린다", async () => {
		await runtime.stop();

		expect(boss.stopCalls).toEqual([
			{ graceful: true, timeout: 90_000, close: true },
		]);
	});
});

describe("LazyPgBossClient — backend 비선택 시 무초기화", () => {
	it("start 전에는 pg-boss 모듈과 연결을 생성하지 않는다", async () => {
		const client = new FakePgBossClient();
		const load = jest.fn().mockResolvedValue(client);
		const lazyClient = new LazyPgBossClient(load);

		lazyClient.on("error", jest.fn());
		expect(load).not.toHaveBeenCalled();

		await lazyClient.start();
		expect(load).toHaveBeenCalledTimes(1);
	});

	it("worker가 lifecycle hook보다 먼저 등록되어도 한 번만 초기화한다", async () => {
		const client = new FakePgBossClient();
		const load = jest.fn().mockResolvedValue(client);
		const lazyClient = new LazyPgBossClient(load);

		await Promise.all([
			lazyClient.createQueue(QUEUE),
			lazyClient.work(QUEUE, { includeMetadata: true }, async () => undefined),
		]);

		expect(load).toHaveBeenCalledTimes(1);
		expect(client.createdQueues).toEqual([QUEUE]);
		expect(client.handlers.has(QUEUE)).toBe(true);
	});
});
