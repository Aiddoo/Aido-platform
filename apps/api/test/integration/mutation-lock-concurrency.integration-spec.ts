import { AsyncLocalStorage } from "node:async_hooks";
import { ErrorCode } from "@aido/errors";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { type CheerLimitReaderPort } from "@/cheer/application/ports/cheer-limit-reader.port";
import type { CheerNotifierPort } from "@/cheer/application/ports/cheer-notifier.port";
import { SendCheerUseCase } from "@/cheer/application/use-cases/send-cheer/send-cheer.use-case";
import { PrismaCheerRepository } from "@/cheer/infrastructure/persistence/prisma-cheer.repository";
import { FollowFacade } from "@/follow";
import type { PrismaClient } from "@/generated/prisma/client";
import type { NudgeLimitReaderPort } from "@/nudge/application/ports/nudge-limit-reader.port";
import type { NudgeNotifierPort } from "@/nudge/application/ports/nudge-notifier.port";
import { SendNudgeUseCase } from "@/nudge/application/use-cases/send-nudge/send-nudge.use-case";
import { SendRemindNudgeUseCase } from "@/nudge/application/use-cases/send-remind-nudge/send-remind-nudge.use-case";
import { PrismaNudgeRepository } from "@/nudge/infrastructure/persistence/prisma-nudge.repository";
import type { UnitOfWorkPort } from "@/shared/application/ports";
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
	): Promise<number> {
		const count = await super.countSentSince(senderId, since);
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

	override async countSentSince(senderId: string, date: Date): Promise<number> {
		const count = await super.countSentSince(senderId, date);
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
});
