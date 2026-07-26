import { AsyncLocalStorage } from "node:async_hooks";
import { ErrorCode } from "@aido/errors";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { type CheerLimitReaderPort } from "@/cheer/application/ports/cheer-limit-reader.port";
import type { CheerNotifierPort } from "@/cheer/application/ports/cheer-notifier.port";
import { CheerReader } from "@/cheer/application/services/cheer.reader";
import { SendCheerUseCase } from "@/cheer/application/use-cases/send-cheer/send-cheer.use-case";
import { PrismaCheerRepository } from "@/cheer/infrastructure/persistence/prisma-cheer.repository";
import { FollowFacade } from "@/follow";
import type { PrismaClient } from "@/generated/prisma/client";
import type { NudgeLimitReaderPort } from "@/nudge/application/ports/nudge-limit-reader.port";
import type { NudgeNotifierPort } from "@/nudge/application/ports/nudge-notifier.port";
import { NudgeReader } from "@/nudge/application/services/nudge.reader";
import { SendNudgeUseCase } from "@/nudge/application/use-cases/send-nudge/send-nudge.use-case";
import { SendRemindNudgeUseCase } from "@/nudge/application/use-cases/send-remind-nudge/send-remind-nudge.use-case";
import { PrismaNudgeRepository } from "@/nudge/infrastructure/persistence/prisma-nudge.repository";
import type { EntitlementService } from "@/shared/application/entitlement/entitlement.service";
import type { PaginationService } from "@/shared/application/pagination";
import {
	MutationLockKeys,
	type MutationLockPort,
	type UnitOfWorkPort,
} from "@/shared/application/ports";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";
import { PostgresMutationLockAdapter } from "@/shared/infrastructure/database/postgres-mutation-lock.adapter";
import type { TransactionClient } from "@/shared/infrastructure/database/prisma.types";
import { TestDatabase } from "../setup/test-database";

const CONCURRENCY = 20;
const DAILY_LIMIT = 3;
const TODAY = new Date("2026-07-26T00:00:00.000Z");

class Rendezvous {
	#arrivals = 0;
	#release: (() => void) | undefined;
	readonly #released = new Promise<void>((resolve) => {
		this.#release = resolve;
	});

	constructor(
		private readonly participants: number,
		private readonly maximumWaitMs = 20,
	) {}

	async wait(): Promise<void> {
		this.#arrivals += 1;
		if (this.#arrivals >= this.participants) {
			this.#release?.();
		}
		await Promise.race([
			this.#released,
			new Promise<void>((resolve) => setTimeout(resolve, this.maximumWaitMs)),
		]);
	}
}

class TestUnitOfWork implements UnitOfWorkPort {
	constructor(
		private readonly prisma: PrismaClient,
		private readonly storage: AsyncLocalStorage<TransactionClient>,
	) {}

	run<T>(work: () => Promise<T>): Promise<T> {
		return this.prisma.$transaction((tx) => this.storage.run(tx, work));
	}
}

class RacingCheerRepository extends PrismaCheerRepository {
	constructor(
		txHost: TransactionHost<TransactionalAdapterPrisma<DatabaseService>>,
		private readonly dailyBarrier?: Rendezvous,
		private readonly cooldownBarrier?: Rendezvous,
	) {
		super(txHost);
	}

	override async countSentSince(
		senderId: string,
		since: Date,
		untilExclusive: Date,
	): Promise<number> {
		const count = await super.countSentSince(senderId, since, untilExclusive);
		await this.dailyBarrier?.wait();
		return count;
	}

	override async findLastCheerToUser(senderId: string, receiverId: string) {
		const cheer = await super.findLastCheerToUser(senderId, receiverId);
		await this.cooldownBarrier?.wait();
		return cheer;
	}
}

class RacingNudgeRepository extends PrismaNudgeRepository {
	constructor(
		txHost: TransactionHost<TransactionalAdapterPrisma<DatabaseService>>,
		private readonly dailyBarrier?: Rendezvous,
		private readonly todoCooldownBarrier?: Rendezvous,
		private readonly reminderCooldownBarrier?: Rendezvous,
	) {
		super(txHost);
	}

	override async countSentSince(
		senderId: string,
		since: Date,
		untilExclusive: Date,
	): Promise<number> {
		const count = await super.countSentSince(senderId, since, untilExclusive);
		await this.dailyBarrier?.wait();
		return count;
	}

	override async findLastNudgeForTodo(senderId: string, todoId: number) {
		const nudge = await super.findLastNudgeForTodo(senderId, todoId);
		await this.todoCooldownBarrier?.wait();
		return nudge;
	}

	override async findLastRemindNudge(senderId: string, receiverId: string) {
		const reminder = await super.findLastRemindNudge(senderId, receiverId);
		await this.reminderCooldownBarrier?.wait();
		return reminder;
	}
}

interface RaceSummary {
	successes: number;
	errorCodes: string[];
}

interface Deferred {
	promise: Promise<void>;
	resolve: () => void;
}

function createDeferred(): Deferred {
	let resolve: (() => void) | undefined;
	const promise = new Promise<void>((settle) => {
		resolve = settle;
	});
	return {
		promise,
		resolve: () => resolve?.(),
	};
}

interface ValueDeferred<T> {
	promise: Promise<T>;
	resolve: (value: T) => void;
}

function createValueDeferred<T>(): ValueDeferred<T> {
	let resolve: ((value: T) => void) | undefined;
	const promise = new Promise<T>((settle) => {
		resolve = settle;
	});
	return {
		promise,
		resolve: (value) => resolve?.(value),
	};
}

interface AdvisoryWaitObservation {
	probes: number;
	waitingCount: number;
}

interface AdvisoryLockIdentity {
	pid: number;
	databaseOid: number;
}

async function waitForBlockedAdvisoryLock(
	prisma: PrismaClient,
	key: string,
	identity: AdvisoryLockIdentity,
	options: { timeoutMs?: number; pollIntervalMs?: number } = {},
): Promise<AdvisoryWaitObservation> {
	const timeoutMs = options.timeoutMs ?? 2_000;
	const pollIntervalMs = options.pollIntervalMs ?? 10;
	const maxProbes = Math.max(1, Math.ceil(timeoutMs / pollIntervalMs));
	let lastWaitingCount = 0;

	for (let probe = 1; probe <= maxProbes; probe += 1) {
		const rows = await prisma.$queryRaw<Array<{ waitingCount: number }>>`
			WITH target AS (
				SELECT hashtextextended(${key}, 0) AS lock_key
			)
			SELECT COUNT(*)::int AS "waitingCount"
			FROM pg_locks, target
			WHERE locktype = 'advisory'
				AND granted = false
				AND objsubid = 1
				AND pid = ${identity.pid}
				AND database = ${identity.databaseOid}::oid
				AND classid::bigint = ((lock_key >> 32) & 4294967295)
				AND objid::bigint = (lock_key & 4294967295)
		`;
		lastWaitingCount = rows[0]?.waitingCount ?? 0;
		if (lastWaitingCount > 0) {
			return { probes: probe, waitingCount: lastWaitingCount };
		}
		if (probe < maxProbes) {
			await new Promise<void>((resolve) => setTimeout(resolve, pollIntervalMs));
		}
	}

	throw new Error(
		`Timed out after ${maxProbes} probes (~${timeoutMs}ms) waiting for ` +
			`PostgreSQL advisory lock key=${JSON.stringify(key)}; ` +
			`pid=${identity.pid}, databaseOid=${identity.databaseOid}; ` +
			`lastWaitingCount=${lastWaitingCount}`,
	);
}

function summarize(results: PromiseSettledResult<unknown>[]): RaceSummary {
	const errorCodes = results.flatMap((result) => {
		if (result.status === "fulfilled") return [];
		const reason = result.reason;
		if (
			typeof reason === "object" &&
			reason !== null &&
			"errorCode" in reason &&
			typeof reason.errorCode === "string"
		) {
			return [reason.errorCode];
		}
		throw reason;
	});
	return {
		successes: results.length - errorCodes.length,
		errorCodes,
	};
}

function createTransactionHarness(prisma: PrismaClient): {
	txHost: TransactionHost<TransactionalAdapterPrisma<DatabaseService>>;
	uow: UnitOfWorkPort;
} {
	const storage = new AsyncLocalStorage<TransactionClient>();
	const txHost = {
		get tx(): TransactionClient {
			return storage.getStore() ?? prisma;
		},
		isTransactionActive(): boolean {
			return storage.getStore() !== undefined;
		},
	};
	return {
		txHost: txHost as unknown as TransactionHost<
			TransactionalAdapterPrisma<DatabaseService>
		>,
		uow: new TestUnitOfWork(prisma, storage),
	};
}

function createFollowFacade(): FollowFacade {
	return {
		isMutualFriend: async () => true,
	} as unknown as FollowFacade;
}

function createCheerNotifier(): CheerNotifierPort {
	return { notifyCheerSent: () => undefined };
}

function createNudgeNotifier(): NudgeNotifierPort {
	return { notifyNudgeSent: () => undefined };
}

function createCheerLimitReader(limit: number | null): CheerLimitReaderPort {
	return { getDailyLimitInTx: async () => limit };
}

function createNudgeLimitReader(limit: number | null): NudgeLimitReaderPort {
	return { getDailyLimitInTx: async () => limit };
}

function createReaderEntitlement(dailyLimit: number): EntitlementService {
	return {
		getFeatureLimit: async () => ({
			dailyLimit,
			isAdmin: false,
			subscriptionStatus: "FREE",
		}),
		calculateRemaining: (limit: number | null, used: number) =>
			limit === null ? null : Math.max(0, limit - used),
	} as unknown as EntitlementService;
}

async function createUser(
	prisma: PrismaClient,
	index: number,
	subscriptionStatus: "FREE" | "ACTIVE" = "FREE",
): Promise<string> {
	const suffix = index.toString().padStart(7, "0");
	const id = `mutation-user-${suffix}`;
	await prisma.user.create({
		data: {
			id,
			email: `mutation-${suffix}@example.com`,
			userTag: `M${suffix}`,
			status: "ACTIVE",
			subscriptionStatus,
		},
	});
	return id;
}

async function createTodo(
	prisma: PrismaClient,
	userId: string,
	title: string,
): Promise<number> {
	const category = await prisma.todoCategory.upsert({
		where: { userId_name: { userId, name: "Mutation" } },
		update: {},
		create: {
			userId,
			name: "Mutation",
			color: "#112233",
			sortOrder: 0,
		},
	});
	const todo = await prisma.todo.create({
		data: {
			userId,
			categoryId: category.id,
			title,
			startDate: TODAY,
			visibility: "PUBLIC",
		},
	});
	return todo.id;
}

describe("소셜 mutation lock 동시성 (실제 PostgreSQL)", () => {
	let testDatabase: TestDatabase;
	let prisma: PrismaClient;

	beforeAll(async () => {
		testDatabase = new TestDatabase();
		prisma = await testDatabase.start();
	}, 60_000);

	beforeEach(async () => {
		await testDatabase.cleanup();
		jest.useFakeTimers({
			doNotFake: ["nextTick", "setImmediate", "setTimeout"],
		});
		jest.setSystemTime(new Date("2026-07-26T12:00:00.000Z"));
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	afterAll(async () => {
		await testDatabase.stop();
	});

	it("20개 Cheer 일일 한도 경쟁에서 3개만 저장하고 나머지는 CHEER_1201이어야 한다", async () => {
		// Given - 한 발신자와 서로 다른 20개 수신자
		const senderId = await createUser(prisma, 0);
		const receiverIds = await Promise.all(
			Array.from({ length: CONCURRENCY }, (_, index) =>
				createUser(prisma, index + 1),
			),
		);
		const { txHost, uow } = createTransactionHarness(prisma);
		const repository = new RacingCheerRepository(
			txHost,
			new Rendezvous(CONCURRENCY),
		);
		const useCase = new SendCheerUseCase(
			repository,
			createCheerNotifier(),
			createCheerLimitReader(DAILY_LIMIT),
			new PostgresMutationLockAdapter(txHost),
			uow,
			createFollowFacade(),
		);

		// When - 같은 일일 한도를 동시에 소비
		const summary = summarize(
			await Promise.allSettled(
				receiverIds.map((receiverId) =>
					useCase.execute({ senderId, receiverId }, "UTC"),
				),
			),
		);

		// Then - 성공 수와 실제 저장 수가 한도와 정확히 일치
		expect(summary.successes).toBe(DAILY_LIMIT);
		expect(summary.errorCodes).toEqual(
			Array(CONCURRENCY - DAILY_LIMIT).fill(ErrorCode.CHEER_1201),
		);
		expect(await prisma.cheer.count({ where: { senderId } })).toBe(DAILY_LIMIT);
	});

	it("20개 동일 대상 Cheer 경쟁에서 1개만 저장하고 나머지는 CHEER_1202여야 한다", async () => {
		// Given - 무제한 발신자와 한 수신자
		const senderId = await createUser(prisma, 0, "ACTIVE");
		const receiverId = await createUser(prisma, 1);
		const { txHost, uow } = createTransactionHarness(prisma);
		const repository = new RacingCheerRepository(
			txHost,
			undefined,
			new Rendezvous(CONCURRENCY),
		);
		const useCase = new SendCheerUseCase(
			repository,
			createCheerNotifier(),
			createCheerLimitReader(null),
			new PostgresMutationLockAdapter(txHost),
			uow,
			createFollowFacade(),
		);

		// When - 동일 대상을 동시에 응원
		const summary = summarize(
			await Promise.allSettled(
				Array.from({ length: CONCURRENCY }, () =>
					useCase.execute({ senderId, receiverId }, "UTC"),
				),
			),
		);

		// Then - 쿨다운 단위로 하나만 성공
		expect(summary.successes).toBe(1);
		expect(summary.errorCodes).toEqual(
			Array(CONCURRENCY - 1).fill(ErrorCode.CHEER_1202),
		);
		expect(await prisma.cheer.count({ where: { senderId, receiverId } })).toBe(
			1,
		);
	});

	it("20개 Nudge 일일 한도 경쟁에서 3개만 저장하고 나머지는 NUDGE_1101이어야 한다", async () => {
		// Given - 한 발신자와 서로 다른 20개 공개 Todo
		const senderId = await createUser(prisma, 0);
		const receiverId = await createUser(prisma, 1);
		const todoIds: number[] = [];
		for (let index = 0; index < CONCURRENCY; index += 1) {
			todoIds.push(await createTodo(prisma, receiverId, `Todo ${index}`));
		}
		const { txHost, uow } = createTransactionHarness(prisma);
		const repository = new RacingNudgeRepository(
			txHost,
			new Rendezvous(CONCURRENCY),
		);
		const useCase = new SendNudgeUseCase(
			repository,
			createNudgeNotifier(),
			createNudgeLimitReader(DAILY_LIMIT),
			new PostgresMutationLockAdapter(txHost),
			uow,
			createFollowFacade(),
		);

		// When - 같은 일일 한도를 동시에 소비
		const summary = summarize(
			await Promise.allSettled(
				todoIds.map((todoId) =>
					useCase.execute({ senderId, receiverId, todoId }, "UTC"),
				),
			),
		);

		// Then - 성공 수와 실제 저장 수가 한도와 정확히 일치
		expect(summary.successes).toBe(DAILY_LIMIT);
		expect(summary.errorCodes).toEqual(
			Array(CONCURRENCY - DAILY_LIMIT).fill(ErrorCode.NUDGE_1101),
		);
		expect(await prisma.nudge.count({ where: { senderId } })).toBe(DAILY_LIMIT);
	});

	it("20개 동일 Todo Nudge 경쟁에서 1개만 저장하고 나머지는 NUDGE_1102여야 한다", async () => {
		// Given - 무제한 발신자와 한 공개 Todo
		const senderId = await createUser(prisma, 0, "ACTIVE");
		const receiverId = await createUser(prisma, 1);
		const todoId = await createTodo(prisma, receiverId, "Same Todo");
		const { txHost, uow } = createTransactionHarness(prisma);
		const repository = new RacingNudgeRepository(
			txHost,
			undefined,
			new Rendezvous(CONCURRENCY),
		);
		const useCase = new SendNudgeUseCase(
			repository,
			createNudgeNotifier(),
			createNudgeLimitReader(null),
			new PostgresMutationLockAdapter(txHost),
			uow,
			createFollowFacade(),
		);

		// When - 동일 Todo를 동시에 찌름
		const summary = summarize(
			await Promise.allSettled(
				Array.from({ length: CONCURRENCY }, () =>
					useCase.execute({ senderId, receiverId, todoId }, "UTC"),
				),
			),
		);

		// Then - Todo 쿨다운 단위로 하나만 성공
		expect(summary.successes).toBe(1);
		expect(summary.errorCodes).toEqual(
			Array(CONCURRENCY - 1).fill(ErrorCode.NUDGE_1102),
		);
		expect(await prisma.nudge.count({ where: { senderId, todoId } })).toBe(1);
	});

	it("20개 reminder-Nudge 경쟁에서 1개만 저장하고 나머지는 NUDGE_1108이어야 한다", async () => {
		// Given - 오늘 Todo가 없는 한 수신자
		const senderId = await createUser(prisma, 0);
		const receiverId = await createUser(prisma, 1);
		const { txHost, uow } = createTransactionHarness(prisma);
		const repository = new RacingNudgeRepository(
			txHost,
			undefined,
			undefined,
			new Rendezvous(CONCURRENCY),
		);
		const useCase = new SendRemindNudgeUseCase(
			repository,
			createNudgeNotifier(),
			new PostgresMutationLockAdapter(txHost),
			uow,
			createFollowFacade(),
		);

		// When - 동일 친구에게 동시에 reminder-Nudge 전송
		const summary = summarize(
			await Promise.allSettled(
				Array.from({ length: CONCURRENCY }, () =>
					useCase.execute({ senderId, receiverId }, "UTC"),
				),
			),
		);

		// Then - 친구 쿨다운 단위로 하나만 성공
		expect(summary.successes).toBe(1);
		expect(summary.errorCodes).toEqual(
			Array(CONCURRENCY - 1).fill(ErrorCode.NUDGE_1108),
		);
		expect(
			await prisma.reminderNudge.count({ where: { senderId, receiverId } }),
		).toBe(1);
	});

	it("Cheer limit-info는 Asia/Seoul 이른 당일 row만 사용량에 포함한다", async () => {
		// Given - KST 7/26 경계 바로 전/후의 두 row
		const senderId = await createUser(prisma, 0);
		const priorReceiverId = await createUser(prisma, 1);
		const currentReceiverId = await createUser(prisma, 2);
		await prisma.cheer.createMany({
			data: [
				{
					senderId,
					receiverId: priorReceiverId,
					createdAt: new Date("2026-07-25T14:59:59.999Z"),
				},
				{
					senderId,
					receiverId: currentReceiverId,
					createdAt: new Date("2026-07-25T15:00:00.001Z"),
				},
			],
		});
		const { txHost } = createTransactionHarness(prisma);
		const reader = new CheerReader(
			new PrismaCheerRepository(txHost),
			{} as PaginationService,
			createReaderEntitlement(3),
		);

		// When
		const result = await reader.getLimitInfo(senderId, "Asia/Seoul");

		// Then - prior local day는 제외하고 early local day는 포함
		expect(result).toEqual({ dailyLimit: 3, used: 1, remaining: 2 });
	});

	it("Nudge limit-info는 Asia/Seoul 이른 당일 row만 사용량에 포함한다", async () => {
		// Given - KST 7/26 경계 바로 전/후의 두 row
		const senderId = await createUser(prisma, 0);
		const receiverId = await createUser(prisma, 1);
		const todoId = await createTodo(prisma, receiverId, "Reader boundary");
		await prisma.nudge.createMany({
			data: [
				{
					senderId,
					receiverId,
					todoId,
					createdAt: new Date("2026-07-25T14:59:59.999Z"),
				},
				{
					senderId,
					receiverId,
					todoId,
					createdAt: new Date("2026-07-25T15:00:00.001Z"),
				},
			],
		});
		const { txHost } = createTransactionHarness(prisma);
		const reader = new NudgeReader(
			new PrismaNudgeRepository(txHost),
			{} as PaginationService,
			createReaderEntitlement(3),
		);

		// When
		const result = await reader.getLimitInfo(senderId, "Asia/Seoul");

		// Then - prior local day는 제외하고 early local day는 포함
		expect(result).toEqual({ dailyLimit: 3, used: 1, remaining: 2 });
	});

	it("Cheer lock 대기가 KST 자정을 넘어도 row는 캡처한 이전 날짜 시각으로 저장한다", async () => {
		// Given - 이전 날짜 key를 별도 트랜잭션이 보유해 send를 실제 DB에서 대기시킴
		jest.setSystemTime(new Date("2026-07-26T14:59:59.900Z"));
		const senderId = await createUser(prisma, 0);
		const receiverId = await createUser(prisma, 1);
		const held = createDeferred();
		const release = createDeferred();
		const dailyKey = MutationLockKeys.cheerDaily(senderId, "2026-07-26");
		const blocker = prisma.$transaction(async (tx) => {
			await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${dailyKey}, 0))::text`;
			held.resolve();
			await release.promise;
		});
		await held.promise;

		const { txHost, uow } = createTransactionHarness(prisma);
		const sendingIdentity = createValueDeferred<AdvisoryLockIdentity>();
		const continueLockAttempt = createDeferred();
		const realLock = new PostgresMutationLockAdapter(txHost);
		const mutationLock: MutationLockPort = {
			async acquire(keys) {
				const identities = await txHost.tx.$queryRaw<AdvisoryLockIdentity[]>`
					SELECT
						pg_backend_pid() AS pid,
						(
							SELECT oid::int
							FROM pg_database
							WHERE datname = current_database()
						) AS "databaseOid"
				`;
				const identity = identities[0];
				if (!identity) {
					throw new Error("Could not identify the sending transaction backend");
				}
				sendingIdentity.resolve(identity);
				await continueLockAttempt.promise;
				await realLock.acquire(keys);
			},
		};
		const useCase = new SendCheerUseCase(
			new PrismaCheerRepository(txHost),
			createCheerNotifier(),
			createCheerLimitReader(1),
			mutationLock,
			uow,
			createFollowFacade(),
		);

		// When - lock wait가 시작된 뒤 애플리케이션 시계를 다음 로컬 날짜로 이동
		const sending = useCase.execute({ senderId, receiverId }, "Asia/Seoul");
		const identity = await sendingIdentity.promise;
		try {
			continueLockAttempt.resolve();
			const mismatchedIdentity = { pid: -1, databaseOid: -1 };
			await expect(
				waitForBlockedAdvisoryLock(prisma, dailyKey, mismatchedIdentity, {
					timeoutMs: 40,
					pollIntervalMs: 10,
				}),
			).rejects.toThrow("pid=-1, databaseOid=-1");
			const observation = await waitForBlockedAdvisoryLock(
				prisma,
				dailyKey,
				identity,
			);
			expect(observation.waitingCount).toBe(1);
			jest.setSystemTime(new Date("2026-07-26T15:00:00.100Z"));
		} finally {
			continueLockAttempt.resolve();
			release.resolve();
			await Promise.allSettled([sending, blocker]);
		}
		const cheer = await sending;

		// Then - row timestamp가 이전 날짜 key/window와 동일한 capturedAt에 고정됨
		expect(cheer.createdAt).toEqual(new Date("2026-07-26T14:59:59.900Z"));
		const persisted = await prisma.cheer.findUniqueOrThrow({
			where: { id: cheer.id },
		});
		expect(persisted.createdAt).toEqual(new Date("2026-07-26T14:59:59.900Z"));
	});
});
