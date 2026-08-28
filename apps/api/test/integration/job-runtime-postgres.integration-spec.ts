import type { PrismaTransactionLike } from "pg-boss";
import { PgBoss } from "pg-boss";

import type { EnqueueJobOptions } from "@/shared/application/ports/job-runtime.port";
import { PgBossJobRuntimeAdapter } from "@/shared/infrastructure/jobs/pg-boss-job-runtime.adapter";

import { TestDatabase } from "../setup/test-database";

const SCHEMA = "pgboss";

function options(overrides: Partial<EnqueueJobOptions> = {}): EnqueueJobOptions {
	return {
		retryLimit: 1,
		retryDelaySeconds: 1,
		retryBackoff: false,
		expireInSeconds: 30,
		retentionSeconds: 14 * 24 * 60 * 60,
		deleteAfterSeconds: 7 * 24 * 60 * 60,
		...overrides,
	};
}

async function eventually(assertion: () => Promise<void>, timeoutMs = 15_000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	let lastError: unknown;
	while (Date.now() < deadline) {
		try {
			await assertion();
			return;
		} catch (error) {
			lastError = error;
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
	}
	throw lastError;
}

describe("PgBossJobRuntimeAdapter 통합 테스트 (실제 PostgreSQL)", () => {
	let testDatabase: TestDatabase;
	let boss: PgBoss;
	let runtime: PgBossJobRuntimeAdapter;
	let transactionSource: { tx: PrismaTransactionLike };

	beforeAll(async () => {
		testDatabase = new TestDatabase();
		const prisma = await testDatabase.start();
		const connectionString = testDatabase.getConnectionUri();

		const migrator = new PgBoss({
			connectionString,
			schema: SCHEMA,
			migrate: true,
			createSchema: true,
		});
		await migrator.start();
		await migrator.stop({ graceful: true, timeout: 10_000, close: true });

		boss = new PgBoss({
			connectionString,
			schema: SCHEMA,
			migrate: false,
			createSchema: false,
			max: 3,
		});
		transactionSource = { tx: prisma };
		runtime = new PgBossJobRuntimeAdapter(boss, transactionSource, {
			job: { shutdownTimeoutMs: 10_000 },
		});
		await runtime.start();

		await prisma.$executeRawUnsafe(`
			CREATE TABLE IF NOT EXISTS public.job_runtime_probe (
				id TEXT PRIMARY KEY,
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)
		`);
	});

	afterAll(async () => {
		await runtime?.stop();
		await testDatabase?.stop();
	});

	it("enqueue한 작업을 처리하고 완료 상태로 보존한다", async () => {
		const queue = "integration-complete";
		const id = await runtime.enqueue(
			queue,
			{ documentId: 1 },
			options({ idempotencyKey: "complete:1" }),
		);
		const handled = jest.fn().mockResolvedValue(undefined);

		await runtime.work(queue, handled, {
			teamSize: 1,
			pollingIntervalSeconds: 1,
		});

		await eventually(async () => {
			expect(handled).toHaveBeenCalledTimes(1);
			const jobs = await boss.findJobs(queue, { id: id ?? undefined });
			expect(jobs[0]?.state).toBe("completed");
		});
	});

	it("startAfter 전에는 처리하지 않고 이후에 처리한다", async () => {
		const queue = "integration-delayed";
		const handled = jest.fn().mockResolvedValue(undefined);
		await runtime.enqueue(
			queue,
			{ documentId: 2 },
			options({
				idempotencyKey: "delayed:2",
				startAfter: new Date(Date.now() + 1_200),
			}),
		);
		await runtime.work(queue, handled, {
			teamSize: 1,
			pollingIntervalSeconds: 1,
		});

		await new Promise((resolve) => setTimeout(resolve, 300));
		expect(handled).not.toHaveBeenCalled();
		await eventually(async () => {
			expect(handled).toHaveBeenCalledTimes(1);
		});
	});

	it("동일 idempotencyKey의 중복 작업을 원자적으로 거부한다", async () => {
		const queue = "integration-deduplicate";
		const first = await runtime.enqueue(
			queue,
			{ documentId: 3 },
			options({ idempotencyKey: "deduplicate:3" }),
		);
		const duplicate = await runtime.enqueue(
			queue,
			{ documentId: 3 },
			options({ idempotencyKey: "deduplicate:3" }),
		);

		expect(first).not.toBeNull();
		expect(duplicate).toBeNull();
	});

	it("재시도 소진 작업을 dead-letter queue에 보존한다", async () => {
		const queue = "integration-retry";
		const deadLetter = "integration-retry-dead-letter";
		const deadLetterJobPolicy = {
			retryLimit: 1,
			retryDelaySeconds: 1,
			retryBackoff: false,
			expireInSeconds: 30,
			retentionSeconds: 14 * 24 * 60 * 60,
			deleteAfterSeconds: 7 * 24 * 60 * 60,
		} as const;
		const handled = jest.fn().mockRejectedValue(new Error("expected failure"));
		const deadLetterHandled = jest.fn().mockRejectedValue(new Error("database still unavailable"));
		// 이전 버전이 기본 정책으로 먼저 만든 queue도 typed worker 등록으로 수렴해야 한다.
		await boss.createQueue(deadLetter);
		await runtime.work(deadLetter, deadLetterHandled, {
			teamSize: 1,
			pollingIntervalSeconds: 1,
			queuePolicy: deadLetterJobPolicy,
		});
		await runtime.enqueue(
			queue,
			{ documentId: 4 },
			options({
				idempotencyKey: "retry:4",
				deadLetter: { queue: deadLetter, jobPolicy: deadLetterJobPolicy },
			}),
		);
		await runtime.work(queue, handled, {
			teamSize: 1,
			pollingIntervalSeconds: 1,
		});

		await eventually(async () => {
			expect(handled).toHaveBeenCalledTimes(2);
			const deadJobs = await boss.findJobs(deadLetter);
			expect(deadJobs).toHaveLength(1);
			expect(deadJobs[0]?.data).toEqual({ documentId: 4 });
			expect(deadLetterHandled).toHaveBeenCalledTimes(2);
			expect(deadJobs[0]?.state).toBe("failed");
			await expect(boss.getQueue(deadLetter)).resolves.toMatchObject({
				retryLimit: 1,
				retryDelay: 1,
				retryBackoff: false,
			});
		}, 20_000);
	});

	it("같은 scheduleKey 등록은 하나의 스케줄로 교체된다", async () => {
		const queue = "integration-schedule";
		await runtime.schedule("weekly", "0 1 * * 1", queue, { version: 1 }, options());
		await runtime.schedule("weekly", "0 2 * * 1", queue, { version: 2 }, options());

		const schedules = await boss.getSchedules(queue, "weekly");
		expect(schedules).toHaveLength(1);
		expect(schedules[0]).toMatchObject({
			name: queue,
			key: "weekly",
			cron: "0 2 * * 1",
			data: { version: 2 },
		});
	});

	it("API runtime 재시작 중에도 대기 작업이 유실되지 않는다", async () => {
		const queue = "integration-restart";
		const id = await runtime.enqueue(
			queue,
			{ documentId: 5 },
			options({ idempotencyKey: "restart:5" }),
		);
		await runtime.stop();

		boss = new PgBoss({
			connectionString: testDatabase.getConnectionUri(),
			schema: SCHEMA,
			migrate: false,
			createSchema: false,
			max: 3,
		});
		runtime = new PgBossJobRuntimeAdapter(boss, transactionSource, {
			job: { shutdownTimeoutMs: 10_000 },
		});
		await runtime.start();
		const handled = jest.fn().mockResolvedValue(undefined);
		await runtime.work(queue, handled, {
			teamSize: 1,
			pollingIntervalSeconds: 1,
		});

		await eventually(async () => {
			expect(handled).toHaveBeenCalledTimes(1);
			const jobs = await boss.findJobs(queue, { id: id ?? undefined });
			expect(jobs[0]?.state).toBe("completed");
		});
	});

	it("업무 트랜잭션 rollback 시 업무 row와 queue row가 함께 사라진다", async () => {
		const prisma = testDatabase.getPrisma();
		const queue = "integration-transaction";
		const probeId = "rollback-probe";

		await expect(
			prisma.$transaction(async (tx) => {
				transactionSource.tx = tx;
				try {
					await tx.$executeRawUnsafe(
						"INSERT INTO public.job_runtime_probe (id) VALUES ($1)",
						probeId,
					);
					await runtime.enqueue(queue, { probeId }, options({ idempotencyKey: probeId }));
					throw new Error("force rollback");
				} finally {
					transactionSource.tx = prisma;
				}
			}),
		).rejects.toThrow("force rollback");

		const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
			"SELECT COUNT(*) AS count FROM public.job_runtime_probe WHERE id = $1",
			probeId,
		);
		const jobs = await boss.findJobs(queue, { key: probeId });
		expect(rows[0]?.count).toBe(0n);
		expect(jobs).toHaveLength(0);
	});
});
