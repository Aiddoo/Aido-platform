import { AsyncLocalStorage } from "node:async_hooks";
import { ErrorCode } from "@aido/errors";
import { type DynamicModule, Module } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import {
	ClsPluginTransactional,
	TransactionHost,
} from "@nestjs-cls/transactional";
import { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { ClsModule } from "nestjs-cls";
import { type CheerLimitReaderPort } from "@/cheer/application/ports/cheer-limit-reader.port";
import type { CheerNotifierPort } from "@/cheer/application/ports/cheer-notifier.port";
import { CheerReader } from "@/cheer/application/services/cheer.reader";
import { SendCheerUseCase } from "@/cheer/application/use-cases/send-cheer/send-cheer.use-case";
import { PrismaCheerRepository } from "@/cheer/infrastructure/persistence/prisma-cheer.repository";
import { FollowFacade } from "@/follow";
import { PrismaClient } from "@/generated/prisma/client";
import type { NudgeLimitReaderPort } from "@/nudge/application/ports/nudge-limit-reader.port";
import type { NudgeNotifierPort } from "@/nudge/application/ports/nudge-notifier.port";
import { NudgeReader } from "@/nudge/application/services/nudge.reader";
import { SendNudgeUseCase } from "@/nudge/application/use-cases/send-nudge/send-nudge.use-case";
import { SendRemindNudgeUseCase } from "@/nudge/application/use-cases/send-remind-nudge/send-remind-nudge.use-case";
import { PrismaNudgeRepository } from "@/nudge/infrastructure/persistence/prisma-nudge.repository";
import { EntitlementService } from "@/shared/application/entitlement/entitlement.service";
import type { PaginationService } from "@/shared/application/pagination";
import {
	MutationLockKeys,
	type MutationLockPort,
	type UnitOfWorkPort,
} from "@/shared/application/ports";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import { ClsUnitOfWork } from "@/shared/infrastructure/database/cls-unit-of-work";
import { DatabaseService } from "@/shared/infrastructure/database/database.service";
import { PostgresMutationLockAdapter } from "@/shared/infrastructure/database/postgres-mutation-lock.adapter";
import type { TransactionClient } from "@/shared/infrastructure/database/prisma.types";
import type { TodoCategoryCachePort } from "@/todo-category/application/ports/todo-category-cache.port";
import { CreateTodoCategoryUseCase } from "@/todo-category/application/use-cases/create-todo-category/create-todo-category.use-case";
import { ReorderTodoCategoryUseCase } from "@/todo-category/application/use-cases/reorder-todo-category/reorder-todo-category.use-case";
import { TodoCategoryLimitReaderAdapter } from "@/todo-category/infrastructure/adapters/todo-category-limit-reader.adapter";
import { PrismaTodoCategoryRepository } from "@/todo-category/infrastructure/persistence/prisma-todo-category.repository";
import { TestDatabase } from "../setup/test-database";

const CONCURRENCY = 20;
const CATEGORY_POOL_MAX = 30;
const DAILY_LIMIT = 3;
const TODAY = new Date("2026-07-26T00:00:00.000Z");

class BestEffortRendezvous {
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

interface RejectableDeferred {
	promise: Promise<void>;
	resolve: () => void;
	reject: (reason: Error) => void;
}

function createRejectableDeferred(): RejectableDeferred {
	let resolve: (() => void) | undefined;
	let reject: ((reason: Error) => void) | undefined;
	const promise = new Promise<void>((settle, fail) => {
		resolve = settle;
		reject = fail;
	});
	return {
		promise,
		resolve: () => resolve?.(),
		reject: (reason) => reject?.(reason),
	};
}

class RequiredParticipantBarrier {
	#arrivals: string[] = [];
	readonly #ready = createRejectableDeferred();
	readonly #timer: ReturnType<typeof setTimeout>;

	constructor(
		private readonly participants: number,
		timeoutMs = 5_000,
	) {
		this.#timer = setTimeout(() => {
			this.#ready.reject(
				new Error(
					`category pre-lock barrier timed out: ` +
						`arrivals=${this.#arrivals.length}/${this.participants}; ` +
						`participants=[${this.#arrivals.join(",")}]`,
				),
			);
		}, timeoutMs);
	}

	async arrive(participant: string): Promise<void> {
		this.#arrivals.push(participant);
		if (this.#arrivals.length > this.participants) {
			const error = new Error(
				`category pre-lock barrier overflow: ` +
					`arrivals=${this.#arrivals.length}/${this.participants}; ` +
					`participants=[${this.#arrivals.join(",")}]`,
			);
			this.#ready.reject(error);
			throw error;
		}
		if (this.#arrivals.length === this.participants) {
			clearTimeout(this.#timer);
			this.#ready.resolve();
		}
		await this.#ready.promise;
	}

	waitUntilReady(): Promise<void> {
		return this.#ready.promise;
	}

	get participantsSeen(): readonly string[] {
		return this.#arrivals;
	}
}

class RacingCheerRepository extends PrismaCheerRepository {
	constructor(
		txHost: TransactionHost<TransactionalAdapterPrisma<DatabaseService>>,
		private readonly dailyBarrier?: BestEffortRendezvous,
		private readonly cooldownBarrier?: BestEffortRendezvous,
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
		private readonly dailyBarrier?: BestEffortRendezvous,
		private readonly todoCooldownBarrier?: BestEffortRendezvous,
		private readonly reminderCooldownBarrier?: BestEffortRendezvous,
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

interface AdvisoryLockState {
	probes: number;
	grantedCount: number;
	waitingCount: number;
}

class CoordinatedCategoryMutationLock implements MutationLockPort {
	readonly #barrier: RequiredParticipantBarrier;
	readonly #firstHolderAcquired = createRejectableDeferred();
	readonly #releaseFirstHolder = createDeferred();
	#hasFirstHolder = false;

	constructor(
		private readonly txHost: TransactionHost<
			TransactionalAdapterPrisma<DatabaseService>
		>,
		private readonly delegate: PostgresMutationLockAdapter,
		private readonly expectedKey: string,
		participants: number,
		timeoutMs = 5_000,
	) {
		this.#barrier = new RequiredParticipantBarrier(participants, timeoutMs);
	}

	async acquire(keys: readonly string[]): Promise<void> {
		if (keys.length !== 1 || keys[0] !== this.expectedKey) {
			throw new Error(
				`unexpected category lock key: expected=${JSON.stringify(this.expectedKey)}, ` +
					`received=${JSON.stringify(keys)}`,
			);
		}
		if (!this.txHost.isTransactionActive()) {
			throw new Error(
				`category lock reached outside active UoW: key=${JSON.stringify(this.expectedKey)}`,
			);
		}

		const rows = await this.txHost.tx.$queryRaw<Array<{ pid: number }>>`
			SELECT pg_backend_pid()::int AS pid
		`;
		const pid = rows[0]?.pid;
		if (pid === undefined) {
			throw new Error(
				`could not identify category transaction backend: ` +
					`key=${JSON.stringify(this.expectedKey)}`,
			);
		}

		await this.#barrier.arrive(pid.toString());
		await this.delegate.acquire(keys);

		if (!this.#hasFirstHolder) {
			this.#hasFirstHolder = true;
			this.#firstHolderAcquired.resolve();
			await this.#releaseFirstHolder.promise;
		}
	}

	async waitUntilAllTransactionsArrive(): Promise<readonly string[]> {
		await this.#barrier.waitUntilReady();
		return this.#barrier.participantsSeen;
	}

	waitUntilFirstHolderAcquires(): Promise<void> {
		return this.#firstHolderAcquired.promise;
	}

	releaseHolder(): void {
		this.#releaseFirstHolder.resolve();
	}
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

async function waitForCategoryAdvisoryLockState(
	prisma: PrismaClient,
	key: string,
	expectedWaitingCount: number,
	options: { timeoutMs?: number; pollIntervalMs?: number } = {},
): Promise<AdvisoryLockState> {
	const timeoutMs = options.timeoutMs ?? 5_000;
	const pollIntervalMs = options.pollIntervalMs ?? 10;
	const maxProbes = Math.max(1, Math.ceil(timeoutMs / pollIntervalMs));
	let lastGrantedCount = 0;
	let lastWaitingCount = 0;

	for (let probe = 1; probe <= maxProbes; probe += 1) {
		const rows = await prisma.$queryRaw<
			Array<{ grantedCount: number; waitingCount: number }>
		>`
			WITH target AS (
				SELECT
					hashtextextended(${key}, 0) AS lock_key,
					(SELECT oid FROM pg_database WHERE datname = current_database()) AS database_oid
			)
			SELECT
				(COUNT(*) FILTER (WHERE granted = true))::int AS "grantedCount",
				(COUNT(*) FILTER (WHERE granted = false))::int AS "waitingCount"
			FROM pg_locks, target
			WHERE locktype = 'advisory'
				AND objsubid = 1
				AND database = database_oid
				AND classid::bigint = ((lock_key >> 32) & 4294967295)
				AND objid::bigint = (lock_key & 4294967295)
		`;
		lastGrantedCount = rows[0]?.grantedCount ?? 0;
		lastWaitingCount = rows[0]?.waitingCount ?? 0;
		if (lastGrantedCount === 1 && lastWaitingCount === expectedWaitingCount) {
			return {
				probes: probe,
				grantedCount: lastGrantedCount,
				waitingCount: lastWaitingCount,
			};
		}
		if (probe < maxProbes) {
			await new Promise<void>((resolve) => setTimeout(resolve, pollIntervalMs));
		}
	}

	throw new Error(
		`Timed out after ${maxProbes} probes (~${timeoutMs}ms) observing category ` +
			`advisory lock key=${JSON.stringify(key)} in the current database; ` +
			`expectedGranted=1, lastGranted=${lastGrantedCount}; ` +
			`expectedWaiting=${expectedWaitingCount}, lastWaiting=${lastWaitingCount}`,
	);
}

async function observeCategoryRace<T>(
	prisma: PrismaClient,
	key: string,
	lock: CoordinatedCategoryMutationLock,
	operations: Promise<PromiseSettledResult<T>[]>,
): Promise<{
	participants: readonly string[];
	lockState: AdvisoryLockState;
	results: PromiseSettledResult<T>[];
}> {
	let participants: readonly string[] = [];
	let lockState: AdvisoryLockState = {
		probes: 0,
		grantedCount: 0,
		waitingCount: 0,
	};
	let observationFailure: unknown;

	try {
		participants = await lock.waitUntilAllTransactionsArrive();
		await lock.waitUntilFirstHolderAcquires();
		lockState = await waitForCategoryAdvisoryLockState(
			prisma,
			key,
			CONCURRENCY - 1,
		);
	} catch (error) {
		observationFailure = error;
	} finally {
		lock.releaseHolder();
	}

	const results = await operations;
	if (observationFailure !== undefined) {
		throw observationFailure;
	}
	return { participants, lockState, results };
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

@Module({})
class CategoryDatabaseTestModule {
	static register(prisma: PrismaClient): DynamicModule {
		return {
			module: CategoryDatabaseTestModule,
			providers: [{ provide: DatabaseService, useValue: prisma }],
			exports: [DatabaseService],
		};
	}
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
		withTransaction<T>(work: () => Promise<T>): Promise<T> {
			return prisma.$transaction((tx) => storage.run(tx, work));
		},
	};
	const typedTxHost = txHost as unknown as TransactionHost<
		TransactionalAdapterPrisma<DatabaseService>
	>;
	return {
		txHost: typedTxHost,
		uow: new ClsUnitOfWork(typedTxHost),
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

function createTodoCategoryCache(): TodoCategoryCachePort {
	return {
		wrapList: async (_userId, factory) => factory(),
		invalidate: async () => undefined,
	};
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

describe("mutation lock 동시성 (실제 PostgreSQL)", () => {
	let testDatabase: TestDatabase;
	let prisma: PrismaClient;
	let categoryModule: TestingModule;
	let categoryTxHost: TransactionHost<
		TransactionalAdapterPrisma<DatabaseService>
	>;
	let categoryUow: ClsUnitOfWork;
	let categoryRepository: PrismaTodoCategoryRepository;
	let categoryLockAdapter: PostgresMutationLockAdapter;
	let categoryLimitReader: TodoCategoryLimitReaderAdapter;

	beforeAll(async () => {
		testDatabase = new TestDatabase({
			createPrismaClient: (connectionString) =>
				new PrismaClient({
					adapter: new PrismaPg({
						connectionString,
						max: CATEGORY_POOL_MAX,
					}),
				}),
		});
		prisma = await testDatabase.start();

		const categoryDatabaseModule = CategoryDatabaseTestModule.register(prisma);
		categoryModule = await Test.createTestingModule({
			imports: [
				categoryDatabaseModule,
				ClsModule.forRoot({
					global: true,
					plugins: [
						new ClsPluginTransactional({
							imports: [categoryDatabaseModule],
							adapter: new TransactionalAdapterPrisma<DatabaseService>({
								prismaInjectionToken: DatabaseService,
							}),
						}),
					],
				}),
			],
			providers: [
				ClsUnitOfWork,
				PrismaTodoCategoryRepository,
				PostgresMutationLockAdapter,
				EntitlementService,
				TodoCategoryLimitReaderAdapter,
				{
					provide: CacheService,
					useValue: {
						wrapSubscription: () => {
							throw new Error(
								"category mutation integration test used cached entitlement",
							);
						},
					},
				},
			],
		}).compile();
		await categoryModule.init();

		categoryTxHost =
			categoryModule.get<
				TransactionHost<TransactionalAdapterPrisma<DatabaseService>>
			>(TransactionHost);
		categoryUow = categoryModule.get(ClsUnitOfWork);
		categoryRepository = categoryModule.get(PrismaTodoCategoryRepository);
		categoryLockAdapter = categoryModule.get(PostgresMutationLockAdapter);
		categoryLimitReader = categoryModule.get(TodoCategoryLimitReaderAdapter);
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
		await categoryModule?.close();
		await testDatabase.stop();
	});

	it("카테고리 검증 하네스는 실제 TransactionHost 인스턴스를 사용한다", async () => {
		// Given - Nest testing module에서 주입받은 category transaction stack
		let activeClient: TransactionClient | undefined;

		// When
		await categoryUow.run(async () => {
			expect(categoryTxHost.isTransactionActive()).toBe(true);
			activeClient = categoryTxHost.tx;
		});

		// Then - hand-built ALS 객체가 아닌 Nest/CLS 실제 구현체
		expect(categoryTxHost).toBeInstanceOf(TransactionHost);
		expect(categoryUow).toBeInstanceOf(ClsUnitOfWork);
		expect(categoryRepository).toBeInstanceOf(PrismaTodoCategoryRepository);
		expect(categoryLockAdapter).toBeInstanceOf(PostgresMutationLockAdapter);
		expect(categoryLimitReader).toBeInstanceOf(TodoCategoryLimitReaderAdapter);
		expect(activeClient).not.toBe(prisma);
	});

	it("카테고리 사전 lock coordination은 참가자가 부족하면 진단과 함께 실패한다", async () => {
		// Given - 요구 인원보다 한 명 적은 coordination
		const barrier = new RequiredParticipantBarrier(2, 1);

		// When / Then - timeout을 성공으로 취급하지 않는다
		await expect(barrier.arrive("pid-1")).rejects.toThrow("arrivals=1/2");
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
			new BestEffortRendezvous(CONCURRENCY),
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
			new BestEffortRendezvous(CONCURRENCY),
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
			new BestEffortRendezvous(CONCURRENCY),
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
			new BestEffortRendezvous(CONCURRENCY),
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
			new BestEffortRendezvous(CONCURRENCY),
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

	it("20개 고유 이름 카테고리 생성 경쟁에서 FREE 한도와 연속 sortOrder를 보존한다", async () => {
		// Given - FREE 사용자와 Nest가 주입한 실제 transaction stack
		const userId = await createUser(prisma, 0);
		const lockKey = MutationLockKeys.todoCategory(userId);
		const coordinatedLock = new CoordinatedCategoryMutationLock(
			categoryTxHost,
			categoryLockAdapter,
			lockKey,
			CONCURRENCY,
		);
		const useCase = new CreateTodoCategoryUseCase(
			categoryRepository,
			createTodoCategoryCache(),
			categoryLimitReader,
			coordinatedLock,
			categoryUow,
		);

		// When - 20개 활성 UoW가 lock 직전 도착한 뒤 한 holder와 19 waiters 관찰
		const race = await observeCategoryRace(
			prisma,
			lockKey,
			coordinatedLock,
			Promise.allSettled(
				Array.from({ length: CONCURRENCY }, (_, index) =>
					useCase.execute({
						userId,
						name: `Category ${index.toString().padStart(2, "0")}`,
						color: "#112233",
					}),
				),
			),
		);
		const summary = summarize(race.results);

		// Then - pool 직렬화가 아닌 실제 동일-key advisory 대기열
		expect(race.participants).toHaveLength(CONCURRENCY);
		expect(new Set(race.participants).size).toBe(CONCURRENCY);
		expect(race.lockState.grantedCount).toBe(1);
		expect(race.lockState.waitingCount).toBe(CONCURRENCY - 1);

		// Then - 성공은 FREE=3을 넘지 않고 저장 순번은 중복/공백 없는 0..2
		expect(summary.successes).toBe(DAILY_LIMIT);
		expect(summary.errorCodes).toEqual(
			Array(CONCURRENCY - DAILY_LIMIT).fill(ErrorCode.TODO_CATEGORY_0857),
		);
		const persisted = await prisma.todoCategory.findMany({
			where: { userId },
			orderBy: { sortOrder: "asc" },
		});
		expect(persisted).toHaveLength(DAILY_LIMIT);
		expect(persisted.map(({ sortOrder }) => sortOrder)).toEqual([0, 1, 2]);
		expect(new Set(persisted.map(({ name }) => name)).size).toBe(DAILY_LIMIT);
	});

	it("20개 유효한 카테고리 재배치 경쟁 후 sortOrder가 완전한 permutation이다", async () => {
		// Given - ACTIVE 사용자에게 0..19 순번의 카테고리와 실제 transaction stack
		const userId = await createUser(prisma, 0, "ACTIVE");
		await prisma.todoCategory.createMany({
			data: Array.from({ length: CONCURRENCY }, (_, index) => ({
				userId,
				name: `Reorder ${index.toString().padStart(2, "0")}`,
				color: "#112233",
				sortOrder: index,
			})),
		});
		const categories = await prisma.todoCategory.findMany({
			where: { userId },
			orderBy: { sortOrder: "asc" },
		});
		const lockKey = MutationLockKeys.todoCategory(userId);
		const coordinatedLock = new CoordinatedCategoryMutationLock(
			categoryTxHost,
			categoryLockAdapter,
			lockKey,
			CONCURRENCY,
		);
		const useCase = new ReorderTodoCategoryUseCase(
			categoryRepository,
			createTodoCategoryCache(),
			coordinatedLock,
			categoryUow,
		);

		// When - 20개 활성 UoW가 lock 직전 도착한 뒤 한 holder와 19 waiters 관찰
		const race = await observeCategoryRace(
			prisma,
			lockKey,
			coordinatedLock,
			Promise.allSettled(
				categories.map(({ id }) =>
					useCase.execute({
						userId,
						categoryId: id,
						position: "before",
					}),
				),
			),
		);

		// Then - pool 직렬화가 아닌 실제 동일-key advisory 대기열
		expect(race.participants).toHaveLength(CONCURRENCY);
		expect(new Set(race.participants).size).toBe(CONCURRENCY);
		expect(race.lockState.grantedCount).toBe(1);
		expect(race.lockState.waitingCount).toBe(CONCURRENCY - 1);

		// Then - 20개 모두 성공하고 persisted 순번이 정확히 0..19 permutation
		expect(race.results.every(({ status }) => status === "fulfilled")).toBe(
			true,
		);
		const persisted = await prisma.todoCategory.findMany({
			where: { userId },
			orderBy: { sortOrder: "asc" },
		});
		expect(persisted).toHaveLength(CONCURRENCY);
		expect(persisted.map(({ sortOrder }) => sortOrder)).toEqual([
			0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
		]);
		expect(new Set(persisted.map(({ id }) => id)).size).toBe(CONCURRENCY);
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
