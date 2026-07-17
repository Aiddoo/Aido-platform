import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import {
	GenericContainer,
	type StartedTestContainer,
	Wait,
} from "testcontainers";
import { AiSuggestionQueueMaintenanceService } from "@/ai-suggestion/infrastructure/queue/ai-suggestion-queue-maintenance.service";
import { RedisEvictionPolicyProbe } from "@/health/indicators/redis-eviction-policy.probe";

const REDIS_PORT = 6379;
const EIGHT_DAYS_MS = 8 * 24 * 60 * 60 * 1_000;

describe("AI suggestion BullMQ maintenance integration", () => {
	let container: StartedTestContainer;
	let host: string;
	let port: number;
	const closeables: Array<{ close(): Promise<void> }> = [];

	beforeAll(async () => {
		container = await new GenericContainer("redis:7-alpine")
			.withExposedPorts(REDIS_PORT)
			.withWaitStrategy(Wait.forLogMessage("Ready to accept connections"))
			.start();
		host = container.getHost();
		port = container.getMappedPort(REDIS_PORT);
	});

	afterEach(async () => {
		while (closeables.length > 0) {
			await closeables.pop()?.close();
		}
	});

	afterAll(async () => {
		await container.stop();
	});

	function createQueue(): Queue {
		const queue = new Queue(
			`ai-suggestion-maintenance-${crypto.randomUUID()}`,
			{
				connection: { host, port },
			},
		);
		closeables.push(queue);
		return queue;
	}

	async function failOneJob(queue: Queue): Promise<void> {
		const worker = new Worker(
			queue.name,
			async () => {
				throw new Error("expected integration failure");
			},
			{ connection: { host, port } },
		);
		closeables.push(worker);

		const failed = new Promise<void>((resolve) => {
			worker.once("failed", () => resolve());
		});
		await queue.add("will-fail", {}, { attempts: 1 });
		await failed;
	}

	it("7일이 지난 failed 잡은 실제 Redis에서 제거한다", async () => {
		const queue = createQueue();
		await failOneJob(queue);
		expect(await queue.getJobCounts("failed")).toEqual({ failed: 1 });

		const maintenance = new AiSuggestionQueueMaintenanceService(queue);
		const now = Date.now();
		const dateNow = jest
			.spyOn(Date, "now")
			.mockReturnValue(now + EIGHT_DAYS_MS);
		const removed = await maintenance.cleanExpiredFailures();
		dateNow.mockRestore();

		expect(removed).toBe(1);
		expect(await queue.getJobCounts("failed")).toEqual({ failed: 0 });
	});

	it("7일 이내 failed 잡은 원인 분석을 위해 보존한다", async () => {
		const queue = createQueue();
		await failOneJob(queue);

		const maintenance = new AiSuggestionQueueMaintenanceService(queue);
		expect(await maintenance.cleanExpiredFailures()).toBe(0);
		expect(await queue.getJobCounts("failed")).toEqual({ failed: 1 });
	});

	it("정리 대상이 아닌 waiting/delayed 잡은 변경하지 않는다", async () => {
		const queue = createQueue();
		await queue.add("waiting", {});
		await queue.add("delayed", {}, { delay: 60_000 });

		const before = await queue.getJobCounts("waiting", "delayed");
		const maintenance = new AiSuggestionQueueMaintenanceService(queue);

		expect(await maintenance.cleanExpiredFailures()).toBe(0);
		expect(await queue.getJobCounts("waiting", "delayed")).toEqual(before);
	});

	it("Redis INFO로 noeviction과 비호환 정책을 실제로 구분한다", async () => {
		const redis = new Redis({ host, port });
		closeables.push({ close: () => redis.quit().then(() => undefined) });
		const probe = new RedisEvictionPolicyProbe(redis);

		await redis.config("SET", "maxmemory-policy", "noeviction");
		expect(await probe.inspect()).toEqual({
			state: "compatible",
			policy: "noeviction",
		});

		await redis.config("SET", "maxmemory-policy", "volatile-lru");
		expect(await probe.inspect()).toEqual({
			state: "incompatible",
			policy: "volatile-lru",
		});
	});
});
