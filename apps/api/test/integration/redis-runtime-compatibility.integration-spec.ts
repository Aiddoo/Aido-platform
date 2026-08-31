import { randomUUID } from "node:crypto";

import { Queue } from "bullmq";
import Redis from "ioredis";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";

import type { JobEnvelope } from "@/shared/application/ports/job-runtime.port";
import { RedisCacheAdapter } from "@/shared/infrastructure/cache/adapters/redis-cache.adapter";
import {
	bullMqClientFactoryProvider,
	BullMqJobRuntimeAdapter,
} from "@/shared/infrastructure/jobs/bullmq-job-runtime.adapter";
import {
	buildBullRedisOptions,
	buildCommandRedisOptions,
	type RedisConnectionSettings,
} from "@/shared/infrastructure/redis/redis-client.factory";

const REDIS_PORT = 6379;
const CONNECTION_TIMEOUT_MS = 10_000;
const JOB_TIMEOUT_MS = 20_000;
// CI 결과가 floating major tag의 새 Redis patch 배포에 따라 바뀌지 않게 고정한다.
const REDIS_IMAGE = "redis:8.10.1-alpine";

interface CompatibilityJobData {
	readonly compatibilityCheck: string;
}

describe("Redis 런타임 호환성 통합 테스트 (실제 Redis)", () => {
	let harness: RedisRuntimeHarness | undefined;

	beforeAll(async () => {
		harness = await RedisRuntimeHarness.start();
	}, 60_000);

	afterAll(async () => {
		await harness?.stop();
	}, 30_000);

	it("ioredis 6 command client가 RESP2로 Redis 8 캐시 값을 왕복한다", async () => {
		// Given
		const redisRuntime = requireInitialized(harness, "Redis runtime harness");
		const client = redisRuntime.commandClient;
		const cache = new RedisCacheAdapter(client, 60_000);
		const cacheKey = redisRuntime.uniqueName("runtime-compatibility");
		const value = { version: 6, protocol: 2, redis: 8 };

		// When
		await cache.set(cacheKey, value);
		const cached = await cache.get<typeof value>(cacheKey);

		// Then
		expect(client.options.protocol).toBe(2);
		expect(cached).toEqual(value);
	});

	it("BullMQ 6 Queue와 Worker가 RESP2 ioredis 6 연결로 작업을 한 번 완료한다", async () => {
		// Given
		const redisRuntime = requireInitialized(harness, "Redis runtime harness");
		const jobRuntime = redisRuntime.jobRuntime;
		const client = redisRuntime.bullClient;
		const runId = redisRuntime.uniqueName("run");
		const queueName = redisRuntime.uniqueName("redis-runtime-compatibility");
		const processedJobs: JobEnvelope<CompatibilityJobData>[] = [];

		await jobRuntime.work<CompatibilityJobData>(
			queueName,
			async (jobs) => {
				processedJobs.push(...jobs);
			},
			{ teamSize: 1, pollingIntervalSeconds: 1 },
		);

		// When
		const jobId = await jobRuntime.enqueue(
			queueName,
			{ compatibilityCheck: runId },
			{
				idempotencyKey: `compatibility-${runId}`,
				retryLimit: 0,
				retryDelaySeconds: 1,
				retryBackoff: false,
				expireInSeconds: 60,
				retentionSeconds: 60,
				deleteAfterSeconds: 60,
			},
		);
		await redisRuntime.waitForCompletedJob(queueName, `compatibility-${runId}`);

		// Then
		expect(client.options.protocol).toBe(2);
		expect(jobId).toBe(`compatibility-${runId}`);
		expect(processedJobs).toEqual([
			{
				id: `compatibility-${runId}`,
				name: queueName,
				data: { compatibilityCheck: runId },
				attempt: 1,
			},
		]);
	});
});

class RedisRuntimeHarness {
	private constructor(
		readonly commandClient: Redis,
		readonly bullClient: Redis,
		readonly jobRuntime: BullMqJobRuntimeAdapter,
		private readonly container: StartedTestContainer,
	) {}

	static async start(): Promise<RedisRuntimeHarness> {
		let container: StartedTestContainer | undefined;
		let commandClient: Redis | undefined;
		let bullClient: Redis | undefined;
		let jobRuntime: BullMqJobRuntimeAdapter | undefined;

		try {
			container = await new GenericContainer(REDIS_IMAGE)
				.withExposedPorts(REDIS_PORT)
				.withWaitStrategy(Wait.forLogMessage("Ready to accept connections"))
				.start();

			const settings: RedisConnectionSettings = {
				host: container.getHost(),
				port: container.getMappedPort(REDIS_PORT),
				db: 0,
				connectTimeoutMs: CONNECTION_TIMEOUT_MS,
				commandTimeoutMs: CONNECTION_TIMEOUT_MS,
			};

			commandClient = new Redis(buildCommandRedisOptions(settings));
			bullClient = new Redis(buildBullRedisOptions(settings));
			await Promise.all([waitUntilReady(commandClient), waitUntilReady(bullClient)]);

			const factory = await bullMqClientFactoryProvider.useFactory(bullClient);
			jobRuntime = new BullMqJobRuntimeAdapter(factory, {
				job: { shutdownTimeoutMs: CONNECTION_TIMEOUT_MS },
			});

			return new RedisRuntimeHarness(commandClient, bullClient, jobRuntime, container);
		} catch (startError) {
			const cleanupErrors = await cleanupResources(
				jobRuntime,
				[commandClient, bullClient],
				container,
			);
			if (cleanupErrors.length > 0) {
				throw new AggregateError(
					[startError, ...cleanupErrors],
					"Redis compatibility test startup and cleanup failed",
				);
			}
			throw startError;
		}
	}

	uniqueName(prefix: string): string {
		return `${prefix}-${randomUUID()}`;
	}

	async waitForCompletedJob(queueName: string, jobId: string): Promise<void> {
		const observer = new Queue(queueName, { connection: this.bullClient });
		const deadline = Date.now() + JOB_TIMEOUT_MS;

		try {
			do {
				const job = await observer.getJob(jobId);
				if ((await job?.getState()) === "completed") return;
				await delay(25);
			} while (Date.now() < deadline);

			throw new Error(`BullMQ job ${jobId} did not complete within ${JOB_TIMEOUT_MS}ms`);
		} finally {
			await observer.close();
		}
	}

	async stop(): Promise<void> {
		const cleanupErrors = await cleanupResources(
			this.jobRuntime,
			[this.commandClient, this.bullClient],
			this.container,
		);
		if (cleanupErrors.length > 0) {
			throw new AggregateError(cleanupErrors, "Redis compatibility test cleanup failed");
		}
	}
}

async function cleanupResources(
	jobRuntime: BullMqJobRuntimeAdapter | undefined,
	clients: readonly (Redis | undefined)[],
	container: StartedTestContainer | undefined,
): Promise<unknown[]> {
	const cleanupErrors: unknown[] = [];

	// Production adapter가 자신이 생성한 Worker와 Queue를 먼저 종료한다.
	try {
		await jobRuntime?.stop();
	} catch (error) {
		cleanupErrors.push(error);
	}

	for (const client of clients) {
		if (!client) continue;
		try {
			await closeRedis(client);
		} catch (error) {
			cleanupErrors.push(error);
		}
	}

	try {
		await container?.stop();
	} catch (error) {
		cleanupErrors.push(error);
	}

	return cleanupErrors;
}

async function waitUntilReady(client: Redis): Promise<void> {
	if (client.status === "ready") return;

	await withTimeout(
		new Promise<void>((resolve, reject) => {
			const onReady = () => {
				cleanup();
				resolve();
			};
			const onError = (error: Error) => {
				cleanup();
				reject(error);
			};
			const cleanup = () => {
				client.off("ready", onReady);
				client.off("error", onError);
			};

			client.once("ready", onReady);
			client.once("error", onError);
			if (client.status === "ready") onReady();
		}),
		CONNECTION_TIMEOUT_MS,
		"Redis readiness",
	);
}

async function closeRedis(client: Redis): Promise<void> {
	if (client.status !== "end") {
		try {
			await withTimeout(client.quit(), CONNECTION_TIMEOUT_MS, "Redis client shutdown");
		} finally {
			client.disconnect();
		}
	}
}

async function withTimeout<T>(work: Promise<T>, timeoutMs: number, name: string): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(
			() => reject(new Error(`${name} timed out after ${timeoutMs}ms`)),
			timeoutMs,
		);
	});

	try {
		return await Promise.race([work, timeout]);
	} finally {
		if (timer) clearTimeout(timer);
	}
}

async function delay(milliseconds: number): Promise<void> {
	await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

function requireInitialized<T>(value: T | undefined, name: string): T {
	if (value === undefined) {
		throw new Error(`${name} was not initialized`);
	}
	return value;
}
