import { AsyncLocalStorage } from "node:async_hooks";

import { ErrorCode } from "@aido/api/errors";
import { ClsPluginTransactional, TransactionHost } from "@nestjs-cls/transactional";
import { TransactionalAdapterDrizzleOrm } from "@nestjs-cls/transactional-adapter-drizzle-orm";
import { type DynamicModule, Module } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { and, asc, eq, sql } from "drizzle-orm";
import { ClsModule, ClsService } from "nestjs-cls";
import { vi } from "vitest";
import { mock } from "vitest-mock-extended";

import {
  ENTITLEMENT_READER,
  type EntitlementReaderPort,
} from "#api/modules/access/access-entitlement.public";
import { ENTITLEMENT_CACHE } from "#api/modules/access/application/ports/entitlement/entitlement-cache.port";
import { ENTITLEMENT_DATABASE } from "#api/modules/access/application/ports/entitlement/entitlement-state.port";
import { EntitlementCacheAdapter } from "#api/modules/access/infrastructure/adapters/entitlement/entitlement-cache.adapter";
import { DrizzleEntitlementReader } from "#api/modules/access/infrastructure/persistence/entitlement/drizzle-entitlement.reader";
import type { TodoCategoryCachePort } from "#api/modules/planning/application/ports/categories/todo-category-cache.port";
import { CreateTodoCategory } from "#api/modules/planning/application/use-cases/categories/create-todo-category.use-case";
import { ReorderTodoCategory } from "#api/modules/planning/application/use-cases/categories/reorder-todo-category.use-case";
import { TodoCategoryLimitReaderAdapter } from "#api/modules/planning/infrastructure/adapters/categories/todo-category-limit-reader.adapter";
import { DrizzleTodoCategoryRepository } from "#api/modules/planning/infrastructure/persistence/categories/drizzle-todo-category.repository";
import { type CheerLimitReaderPort } from "#api/modules/social/application/ports/cheers/cheer-limit-reader.port";
import type { CheerNotifierPort } from "#api/modules/social/application/ports/cheers/cheer-notifier.port";
import type { NudgeLimitReaderPort } from "#api/modules/social/application/ports/nudges/nudge-limit-reader.port";
import type { NudgeNotifierPort } from "#api/modules/social/application/ports/nudges/nudge-notifier.port";
import { GetCheerLimit } from "#api/modules/social/application/use-cases/cheers/get-cheer-limit.use-case";
import { SendCheer } from "#api/modules/social/application/use-cases/cheers/send-cheer.use-case";
import { GetNudgeLimit } from "#api/modules/social/application/use-cases/nudges/get-nudge-limit.use-case";
import { SendNudge } from "#api/modules/social/application/use-cases/nudges/send-nudge.use-case";
import { SendRemindNudge } from "#api/modules/social/application/use-cases/nudges/send-remind-nudge.use-case";
import { DrizzleCheerRepository } from "#api/modules/social/infrastructure/persistence/cheers/drizzle-cheer.repository";
import { DrizzleNudgeRepository } from "#api/modules/social/infrastructure/persistence/nudges/drizzle-nudge.repository";
import type { FollowReaderPort } from "#api/modules/social/social-friends.public";
import { CacheService } from "#api/platform/cache/cache.service";
import { ClsUnitOfWork } from "#api/platform/database/cls-unit-of-work";
import { DRIZZLE, type DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { PostgresMutationLockAdapter } from "#api/platform/database/postgres-mutation-lock.adapter";
import {
  cheer,
  nudge,
  reminderNudge,
  todo,
  todoCategory,
  user,
} from "#api/platform/database/schema/index";
import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { createTestClient } from "#test/setup/database-context";
import type { TestDatabaseClient } from "#test/setup/test-database";

import { entitlementServiceProvider } from "../../src/modules/access/access-entitlement-application.providers.js";
import { TestDatabase } from "../setup/test-database.js";

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

class RacingCheerRepository extends DrizzleCheerRepository {
  constructor(
    txHost: TransactionHost<DrizzleTransactionalAdapter>,
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
    const lastCheer = await super.findLastCheerToUser(senderId, receiverId);
    await this.cooldownBarrier?.wait();
    return lastCheer;
  }
}

class RacingNudgeRepository extends DrizzleNudgeRepository {
  constructor(
    txHost: TransactionHost<DrizzleTransactionalAdapter>,
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
    const lastNudge = await super.findLastNudgeForTodo(senderId, todoId);
    await this.todoCooldownBarrier?.wait();
    return lastNudge;
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
    private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>,
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

    const { rows } = await this.txHost.tx.execute<{ pid: number }>(
      sql`SELECT pg_backend_pid()::int AS pid`,
    );
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
  client: TestDatabaseClient,
  key: string,
  identity: AdvisoryLockIdentity,
  options: { timeoutMs?: number; pollIntervalMs?: number } = {},
): Promise<AdvisoryWaitObservation> {
  const timeoutMs = options.timeoutMs ?? 2_000;
  const pollIntervalMs = options.pollIntervalMs ?? 10;
  const maxProbes = Math.max(1, Math.ceil(timeoutMs / pollIntervalMs));
  let lastWaitingCount = 0;

  for (let probe = 1; probe <= maxProbes; probe += 1) {
    const { rows } = await client.execute<{ waitingCount: number }>(sql`
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
    `);
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
  client: TestDatabaseClient,
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
    const { rows } = await client.execute<{ grantedCount: number; waitingCount: number }>(sql`
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
    `);
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
  client: TestDatabaseClient,
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
    lockState = await waitForCategoryAdvisoryLockState(client, key, CONCURRENCY - 1);
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
    if (result.status === "fulfilled") {
      return [];
    }
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
  static register(client: TestDatabaseClient): DynamicModule {
    return {
      module: CategoryDatabaseTestModule,
      providers: [{ provide: DRIZZLE, useValue: client }],
      exports: [DRIZZLE],
    };
  }
}

type ActiveTransaction = Parameters<Parameters<TestDatabaseClient["transaction"]>[0]>[0];

function createTransactionHarness(client: TestDatabaseClient): {
  txHost: TransactionHost<DrizzleTransactionalAdapter>;
  uow: UnitOfWorkPort;
} {
  const storage = new AsyncLocalStorage<ActiveTransaction>();
  const cls = new ClsService(new AsyncLocalStorage());
  const txHost = mock<TransactionHost<DrizzleTransactionalAdapter>>();
  Object.defineProperty(txHost, "tx", {
    get: () => storage.getStore() ?? client,
  });
  Object.assign(txHost, {
    isTransactionActive(): boolean {
      return storage.getStore() !== undefined;
    },
    withTransaction<T>(work: () => Promise<T>): Promise<T> {
      if (storage.getStore()) {
        return cls.run({ ifNested: "inherit" }, work);
      }
      return client.transaction((tx) =>
        storage.run(tx, () => cls.run({ ifNested: "inherit" }, work)),
      );
    },
  });
  return {
    txHost,
    uow: new ClsUnitOfWork(txHost, cls),
  };
}

interface AdvisoryLockAttempt {
  key: string;
  acquired: boolean;
}

async function tryAcquireAdvisoryLocks(
  client: TestDatabaseClient,
  keys: readonly string[],
): Promise<AdvisoryLockAttempt[]> {
  return client.transaction(async (tx) => {
    const { rows } = await tx.execute<AdvisoryLockAttempt>(sql`
      SELECT
        requested."key",
        pg_try_advisory_xact_lock(hashtextextended(requested."key", 0)) AS acquired
      FROM unnest(ARRAY[${sql.join(
        keys.map((key) => sql`${key}`),
        sql`, `,
      )}]::TEXT[]) AS requested("key")
      ORDER BY requested."key"
    `);
    return rows;
  });
}

async function completeWithin<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`동시성 검증이 ${timeoutMs}ms 안에 끝나지 않았습니다.`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, deadline]);
  } finally {
    clearTimeout(timeout);
  }
}

function createFollowReaderStub(): Pick<FollowReaderPort, "isMutualFriend"> {
  return { isMutualFriend: async () => true };
}

function createCheerNotifier(): CheerNotifierPort {
  return { notifyCheerSent: () => undefined };
}

function createNudgeNotifier(): NudgeNotifierPort {
  return {
    notifyNudgeSent: () => undefined,
    recordInteraction: async () => undefined,
    recordInteractions: async () => undefined,
  };
}

function createCheerLimitReader(limit: number | null): CheerLimitReaderPort {
  return { getDailyLimitInTx: async () => limit };
}

function createNudgeLimitReader(limit: number | null): NudgeLimitReaderPort {
  return { getDailyLimitInTx: async () => limit };
}

function createReaderEntitlement(
  dailyLimit: number,
): Pick<EntitlementReaderPort, "getFeatureLimit" | "calculateRemaining"> {
  return {
    getFeatureLimit: async () => ({
      dailyLimit,
      isAdmin: false,
      subscriptionStatus: "FREE",
    }),
    calculateRemaining: (limit: number | null, used: number) =>
      limit === null ? null : Math.max(0, limit - used),
  };
}

function createTodoCategoryCache(): TodoCategoryCachePort {
  return {
    wrapList: async (_userId, factory) => factory(),
    invalidate: async () => undefined,
  };
}

async function createUser(
  client: TestDatabaseClient,
  index: number,
  subscriptionStatus: "FREE" | "ACTIVE" = "FREE",
): Promise<string> {
  const suffix = index.toString().padStart(7, "0");
  const id = `mutation-user-${suffix}`;
  await client.insert(user).values({
    id,
    email: `mutation-${suffix}@example.com`,
    userTag: `M${suffix}`,
    status: "ACTIVE",
    subscriptionStatus,
  });
  return id;
}

async function createTodo(
  client: TestDatabaseClient,
  userId: string,
  title: string,
): Promise<number> {
  const [category] = await client
    .insert(todoCategory)
    .values({ userId, name: "Mutation", color: "#112233", sortOrder: 0 })
    .onConflictDoUpdate({
      target: [todoCategory.userId, todoCategory.name],
      set: { userId },
    })
    .returning({ id: todoCategory.id });
  if (category === undefined) {
    throw new Error("category fixture was not created");
  }
  const [created] = await client
    .insert(todo)
    .values({
      userId,
      categoryId: category.id,
      title,
      startDate: TODAY,
      visibility: "PUBLIC",
    })
    .returning({ id: todo.id });
  if (created === undefined) {
    throw new Error("todo fixture was not created");
  }
  return created.id;
}

describe("mutation lock 동시성 (실제 PostgreSQL)", () => {
  let testDatabase: TestDatabase;
  let client: TestDatabaseClient;
  let categoryModule: TestingModule;
  let categoryTxHost: TransactionHost<DrizzleTransactionalAdapter>;
  let categoryUow: ClsUnitOfWork;
  let categoryRepository: DrizzleTodoCategoryRepository;
  let categoryLockAdapter: PostgresMutationLockAdapter;
  let categoryLimitReader: TodoCategoryLimitReaderAdapter;

  beforeAll(async () => {
    testDatabase = new TestDatabase({
      createClient: (connectionString) =>
        createTestClient(connectionString, { max: CATEGORY_POOL_MAX }),
    });
    client = await testDatabase.start();

    const categoryDatabaseModule = CategoryDatabaseTestModule.register(client);
    categoryModule = await Test.createTestingModule({
      imports: [
        categoryDatabaseModule,
        ClsModule.forRoot({
          global: true,
          plugins: [
            new ClsPluginTransactional({
              imports: [categoryDatabaseModule],
              adapter: new TransactionalAdapterDrizzleOrm({ drizzleInstanceToken: DRIZZLE }),
            }),
          ],
        }),
      ],
      providers: [
        ClsUnitOfWork,
        DrizzleTodoCategoryRepository,
        PostgresMutationLockAdapter,
        { ...entitlementServiceProvider, provide: ENTITLEMENT_READER },
        EntitlementCacheAdapter,
        { provide: ENTITLEMENT_CACHE, useExisting: EntitlementCacheAdapter },
        { provide: ENTITLEMENT_DATABASE, useClass: DrizzleEntitlementReader },
        TodoCategoryLimitReaderAdapter,
        {
          provide: CacheService,
          useValue: {
            wrap: () => {
              throw new Error("category mutation integration test used cached entitlement");
            },
          },
        },
      ],
    }).compile();
    await categoryModule.init();

    categoryTxHost =
      categoryModule.get<TransactionHost<DrizzleTransactionalAdapter>>(TransactionHost);
    categoryUow = categoryModule.get(ClsUnitOfWork);
    categoryRepository = categoryModule.get(DrizzleTodoCategoryRepository);
    categoryLockAdapter = categoryModule.get(PostgresMutationLockAdapter);
    categoryLimitReader = categoryModule.get(TodoCategoryLimitReaderAdapter);
  }, 60_000);

  beforeEach(async () => {
    await testDatabase.cleanup();
    vi.useFakeTimers({
      toNotFake: ["nextTick", "setImmediate", "setTimeout"],
    });
    vi.setSystemTime(new Date("2026-07-26T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(async () => {
    await categoryModule?.close();
    await testDatabase.stop();
  });

  it("카테고리 검증 하네스는 실제 TransactionHost 인스턴스를 사용한다", async () => {
    // Given
    let activeClient: unknown;

    // When
    await categoryUow.run(async () => {
      expect(categoryTxHost.isTransactionActive()).toBe(true);
      activeClient = categoryTxHost.tx;
    });

    // Then
    expect(categoryTxHost).toBeInstanceOf(TransactionHost);
    expect(categoryUow).toBeInstanceOf(ClsUnitOfWork);
    expect(categoryRepository).toBeInstanceOf(DrizzleTodoCategoryRepository);
    expect(categoryLockAdapter).toBeInstanceOf(PostgresMutationLockAdapter);
    expect(categoryLimitReader).toBeInstanceOf(TodoCategoryLimitReaderAdapter);
    expect(activeClient).not.toBe(client);
  });

  it("카테고리 사전 lock coordination은 참가자가 부족하면 진단과 함께 실패한다", async () => {
    // Given
    const barrier = new RequiredParticipantBarrier(2, 1);

    // When
    const arrival = barrier.arrive("pid-1");

    // Then
    await expect(arrival).rejects.toThrow("arrivals=1/2");
  });

  it("배치 lock은 한 트랜잭션이 보유한 두 키를 모두 막고 commit 후 해제한다", async () => {
    // Given
    const keys = ["mutation:v1:comment:batch:b", "mutation:v1:comment:batch:a"];
    const held = createDeferred();
    const release = createDeferred();
    const { txHost, uow } = createTransactionHarness(client);
    const holding = uow.run(async () => {
      await new PostgresMutationLockAdapter(txHost).acquire(keys);
      held.resolve();
      await release.promise;
    });
    await held.promise;

    // When
    let blocked: AdvisoryLockAttempt[];
    try {
      blocked = await tryAcquireAdvisoryLocks(client, keys);
    } finally {
      release.resolve();
      await holding;
    }
    const available = await tryAcquireAdvisoryLocks(client, keys);

    // Then
    expect(blocked).toEqual([
      { key: "mutation:v1:comment:batch:a", acquired: false },
      { key: "mutation:v1:comment:batch:b", acquired: false },
    ]);
    expect(available).toEqual([
      { key: "mutation:v1:comment:batch:a", acquired: true },
      { key: "mutation:v1:comment:batch:b", acquired: true },
    ]);
  });

  it("서로 반대 순서의 배치도 DB 내부 정렬 순서로 잠겨 교착 없이 완료한다", async () => {
    // Given
    const barrier = new RequiredParticipantBarrier(2);
    const first = createTransactionHarness(client);
    const second = createTransactionHarness(client);

    const acquire = (
      participant: string,
      keys: readonly string[],
      txHost: TransactionHost<DrizzleTransactionalAdapter>,
      uow: UnitOfWorkPort,
    ) =>
      uow.run(async () => {
        await barrier.arrive(participant);
        await new PostgresMutationLockAdapter(txHost).acquire(keys);
      });

    // When
    await completeWithin(
      Promise.all([
        acquire("ascending", ["batch:a", "batch:b"], first.txHost, first.uow),
        acquire("descending", ["batch:b", "batch:a"], second.txHost, second.uow),
      ]),
      3_000,
    );

    // Then
    expect(barrier.participantsSeen.toSorted()).toEqual(["ascending", "descending"]);
  });

  it("20개 Cheer 일일 한도 경쟁에서 3개만 저장하고 나머지는 CHEER_1201이어야 한다", async () => {
    // Given
    const senderId = await createUser(client, 0);
    const receiverIds = await Promise.all(
      Array.from({ length: CONCURRENCY }, (_, index) => createUser(client, index + 1)),
    );
    const { txHost, uow } = createTransactionHarness(client);
    const repository = new RacingCheerRepository(txHost, new BestEffortRendezvous(CONCURRENCY));
    const useCase = new SendCheer({
      cheerRepository: repository,
      notifier: createCheerNotifier(),
      limitReader: createCheerLimitReader(DAILY_LIMIT),
      mutationLock: new PostgresMutationLockAdapter(txHost),
      unitOfWork: uow,
      followReader: createFollowReaderStub(),
      logger: mock<ConstructorParameters<typeof SendCheer>[0]["logger"]>(),
    });

    // When
    const summary = summarize(
      await Promise.allSettled(
        receiverIds.map((receiverId) => useCase.execute({ senderId, receiverId, timezone: "UTC" })),
      ),
    );

    // Then
    expect(summary.successes).toBe(DAILY_LIMIT);
    expect(summary.errorCodes).toEqual(Array(CONCURRENCY - DAILY_LIMIT).fill(ErrorCode.CHEER_1201));
    expect(await client.$count(cheer, eq(cheer.senderId, senderId))).toBe(DAILY_LIMIT);
  });

  it("20개 동일 대상 Cheer 경쟁에서 1개만 저장하고 나머지는 CHEER_1202여야 한다", async () => {
    // Given
    const senderId = await createUser(client, 0, "ACTIVE");
    const receiverId = await createUser(client, 1);
    const { txHost, uow } = createTransactionHarness(client);
    const repository = new RacingCheerRepository(
      txHost,
      undefined,
      new BestEffortRendezvous(CONCURRENCY),
    );
    const useCase = new SendCheer({
      cheerRepository: repository,
      notifier: createCheerNotifier(),
      limitReader: createCheerLimitReader(null),
      mutationLock: new PostgresMutationLockAdapter(txHost),
      unitOfWork: uow,
      followReader: createFollowReaderStub(),
      logger: mock<ConstructorParameters<typeof SendCheer>[0]["logger"]>(),
    });

    // When
    const summary = summarize(
      await Promise.allSettled(
        Array.from({ length: CONCURRENCY }, () =>
          useCase.execute({ senderId, receiverId, timezone: "UTC" }),
        ),
      ),
    );

    // Then
    expect(summary.successes).toBe(1);
    expect(summary.errorCodes).toEqual(Array(CONCURRENCY - 1).fill(ErrorCode.CHEER_1202));
    expect(
      await client.$count(
        cheer,
        and(eq(cheer.senderId, senderId), eq(cheer.receiverId, receiverId)),
      ),
    ).toBe(1);
  });

  it("20개 Nudge 일일 한도 경쟁에서 3개만 저장하고 나머지는 NUDGE_1101이어야 한다", async () => {
    // Given
    const senderId = await createUser(client, 0);
    const receiverId = await createUser(client, 1);
    const todoIds: number[] = [];
    for (let index = 0; index < CONCURRENCY; index += 1) {
      todoIds.push(await createTodo(client, receiverId, `Todo ${index}`));
    }
    const { txHost, uow } = createTransactionHarness(client);
    const repository = new RacingNudgeRepository(txHost, new BestEffortRendezvous(CONCURRENCY));
    const useCase = new SendNudge({
      nudgeRepository: repository,
      notifier: createNudgeNotifier(),
      limitReader: createNudgeLimitReader(DAILY_LIMIT),
      mutationLock: new PostgresMutationLockAdapter(txHost),
      unitOfWork: uow,
      followReader: createFollowReaderStub(),
      logger: mock<ConstructorParameters<typeof SendNudge>[0]["logger"]>(),
    });

    // When
    const summary = summarize(
      await Promise.allSettled(
        todoIds.map((todoId) => useCase.execute({ senderId, receiverId, todoId, timezone: "UTC" })),
      ),
    );

    // Then
    expect(summary.successes).toBe(DAILY_LIMIT);
    expect(summary.errorCodes).toEqual(Array(CONCURRENCY - DAILY_LIMIT).fill(ErrorCode.NUDGE_1101));
    expect(await client.$count(nudge, eq(nudge.senderId, senderId))).toBe(DAILY_LIMIT);
  });

  it("20개 동일 Todo Nudge 경쟁에서 1개만 저장하고 나머지는 NUDGE_1102여야 한다", async () => {
    // Given
    const senderId = await createUser(client, 0, "ACTIVE");
    const receiverId = await createUser(client, 1);
    const todoId = await createTodo(client, receiverId, "Same Todo");
    const { txHost, uow } = createTransactionHarness(client);
    const repository = new RacingNudgeRepository(
      txHost,
      undefined,
      new BestEffortRendezvous(CONCURRENCY),
    );
    const useCase = new SendNudge({
      nudgeRepository: repository,
      notifier: createNudgeNotifier(),
      limitReader: createNudgeLimitReader(null),
      mutationLock: new PostgresMutationLockAdapter(txHost),
      unitOfWork: uow,
      followReader: createFollowReaderStub(),
      logger: mock<ConstructorParameters<typeof SendNudge>[0]["logger"]>(),
    });

    // When
    const summary = summarize(
      await Promise.allSettled(
        Array.from({ length: CONCURRENCY }, () =>
          useCase.execute({ senderId, receiverId, todoId, timezone: "UTC" }),
        ),
      ),
    );

    // Then
    expect(summary.successes).toBe(1);
    expect(summary.errorCodes).toEqual(Array(CONCURRENCY - 1).fill(ErrorCode.NUDGE_1102));
    expect(
      await client.$count(nudge, and(eq(nudge.senderId, senderId), eq(nudge.todoId, todoId))),
    ).toBe(1);
  });

  it("20개 reminder-Nudge 경쟁에서 1개만 저장하고 나머지는 NUDGE_1108이어야 한다", async () => {
    // Given
    const senderId = await createUser(client, 0);
    const receiverId = await createUser(client, 1);
    const { txHost, uow } = createTransactionHarness(client);
    const repository = new RacingNudgeRepository(
      txHost,
      undefined,
      undefined,
      new BestEffortRendezvous(CONCURRENCY),
    );
    const useCase = new SendRemindNudge({
      nudgeRepository: repository,
      notifier: createNudgeNotifier(),
      mutationLock: new PostgresMutationLockAdapter(txHost),
      unitOfWork: uow,
      followReader: createFollowReaderStub(),
      logger: mock<ConstructorParameters<typeof SendRemindNudge>[0]["logger"]>(),
    });

    // When
    const summary = summarize(
      await Promise.allSettled(
        Array.from({ length: CONCURRENCY }, () =>
          useCase.execute({ senderId, receiverId, timezone: "UTC" }),
        ),
      ),
    );

    // Then
    expect(summary.successes).toBe(1);
    expect(summary.errorCodes).toEqual(Array(CONCURRENCY - 1).fill(ErrorCode.NUDGE_1108));
    expect(
      await client.$count(
        reminderNudge,
        and(eq(reminderNudge.senderId, senderId), eq(reminderNudge.receiverId, receiverId)),
      ),
    ).toBe(1);
  });

  it("20개 고유 이름 카테고리 생성 경쟁에서 FREE 한도와 연속 sortOrder를 보존한다", async () => {
    // Given
    const userId = await createUser(client, 0);
    const lockKey = MutationLockKeys.todoCategory(userId);
    const coordinatedLock = new CoordinatedCategoryMutationLock(
      categoryTxHost,
      categoryLockAdapter,
      lockKey,
      CONCURRENCY,
    );
    const useCase = new CreateTodoCategory({
      repository: categoryRepository,
      cache: createTodoCategoryCache(),
      limitReader: categoryLimitReader,
      mutationLock: coordinatedLock,
      unitOfWork: categoryUow,
      logger: mock<ConstructorParameters<typeof CreateTodoCategory>[0]["logger"]>(),
    });

    // When
    const race = await observeCategoryRace(
      client,
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

    // Then
    expect(race.participants).toHaveLength(CONCURRENCY);
    expect(new Set(race.participants).size).toBe(CONCURRENCY);
    expect(race.lockState.grantedCount).toBe(1);
    expect(race.lockState.waitingCount).toBe(CONCURRENCY - 1);

    // Then
    expect(summary.successes).toBe(DAILY_LIMIT);
    expect(summary.errorCodes).toEqual(
      Array(CONCURRENCY - DAILY_LIMIT).fill(ErrorCode.TODO_CATEGORY_0857),
    );
    const persisted = await client
      .select()
      .from(todoCategory)
      .where(eq(todoCategory.userId, userId))
      .orderBy(asc(todoCategory.sortOrder));
    expect(persisted).toHaveLength(DAILY_LIMIT);
    expect(persisted.map(({ sortOrder }) => sortOrder)).toEqual([0, 1, 2]);
    expect(new Set(persisted.map(({ name }) => name)).size).toBe(DAILY_LIMIT);
  });

  it("20개 유효한 카테고리 재배치 경쟁 후 sortOrder가 완전한 permutation이다", async () => {
    // Given
    const userId = await createUser(client, 0, "ACTIVE");
    await client.insert(todoCategory).values(
      Array.from({ length: CONCURRENCY }, (_, index) => ({
        userId,
        name: `Reorder ${index.toString().padStart(2, "0")}`,
        color: "#112233",
        sortOrder: index,
      })),
    );
    const categories = await client
      .select()
      .from(todoCategory)
      .where(eq(todoCategory.userId, userId))
      .orderBy(asc(todoCategory.sortOrder));
    const lockKey = MutationLockKeys.todoCategory(userId);
    const coordinatedLock = new CoordinatedCategoryMutationLock(
      categoryTxHost,
      categoryLockAdapter,
      lockKey,
      CONCURRENCY,
    );
    const useCase = new ReorderTodoCategory({
      repository: categoryRepository,
      cache: createTodoCategoryCache(),
      mutationLock: coordinatedLock,
      unitOfWork: categoryUow,
      logger: mock<ConstructorParameters<typeof ReorderTodoCategory>[0]["logger"]>(),
    });

    // When
    const race = await observeCategoryRace(
      client,
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

    // Then
    expect(race.participants).toHaveLength(CONCURRENCY);
    expect(new Set(race.participants).size).toBe(CONCURRENCY);
    expect(race.lockState.grantedCount).toBe(1);
    expect(race.lockState.waitingCount).toBe(CONCURRENCY - 1);

    // Then
    expect(race.results.every(({ status }) => status === "fulfilled")).toBe(true);
    const persisted = await client
      .select()
      .from(todoCategory)
      .where(eq(todoCategory.userId, userId))
      .orderBy(asc(todoCategory.sortOrder));
    expect(persisted).toHaveLength(CONCURRENCY);
    expect(persisted.map(({ sortOrder }) => sortOrder)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
    ]);
    expect(new Set(persisted.map(({ id }) => id)).size).toBe(CONCURRENCY);
  });

  it("Cheer limit-info는 Asia/Seoul 이른 당일 row만 사용량에 포함한다", async () => {
    // Given
    const senderId = await createUser(client, 0);
    const priorReceiverId = await createUser(client, 1);
    const currentReceiverId = await createUser(client, 2);
    await client.insert(cheer).values([
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
    ]);
    const { txHost } = createTransactionHarness(client);
    const reader = new GetCheerLimit({
      cheerRepository: new DrizzleCheerRepository(txHost),
      entitlementReader: createReaderEntitlement(3),
    });

    // When
    const result = await reader.execute({ userId: senderId, timezone: "Asia/Seoul" });

    // Then
    expect(result).toEqual({ dailyLimit: 3, used: 1, remaining: 2 });
  });

  it("Nudge limit-info는 Asia/Seoul 이른 당일 row만 사용량에 포함한다", async () => {
    // Given
    const senderId = await createUser(client, 0);
    const receiverId = await createUser(client, 1);
    const todoId = await createTodo(client, receiverId, "Reader boundary");
    await client.insert(nudge).values([
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
    ]);
    const { txHost } = createTransactionHarness(client);
    const reader = new GetNudgeLimit({
      nudgeRepository: new DrizzleNudgeRepository(txHost),
      entitlementReader: createReaderEntitlement(3),
    });

    // When
    const result = await reader.execute({ userId: senderId, timezone: "Asia/Seoul" });

    // Then
    expect(result).toEqual({ dailyLimit: 3, used: 1, remaining: 2 });
  });

  it("Cheer lock 대기가 KST 자정을 넘어도 row는 캡처한 이전 날짜 시각으로 저장한다", async () => {
    // Given
    vi.setSystemTime(new Date("2026-07-26T14:59:59.900Z"));
    const senderId = await createUser(client, 0);
    const receiverId = await createUser(client, 1);
    const held = createDeferred();
    const release = createDeferred();
    const dailyKey = MutationLockKeys.cheerDailyQuota(senderId);
    const blocker = client.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${dailyKey}, 0))::text`);
      held.resolve();
      await release.promise;
    });
    await held.promise;

    const { txHost, uow } = createTransactionHarness(client);
    const sendingIdentity = createValueDeferred<AdvisoryLockIdentity>();
    const continueLockAttempt = createDeferred();
    const realLock = new PostgresMutationLockAdapter(txHost);
    const mutationLock: MutationLockPort = {
      async acquire(keys) {
        const { rows: identities } = await txHost.tx.execute<AdvisoryLockIdentity>(sql`
          SELECT
            pg_backend_pid() AS pid,
            (
              SELECT oid::int
              FROM pg_database
              WHERE datname = current_database()
            ) AS "databaseOid"
        `);
        const identity = identities[0];
        if (!identity) {
          throw new Error("Could not identify the sending transaction backend");
        }
        sendingIdentity.resolve(identity);
        await continueLockAttempt.promise;
        await realLock.acquire(keys);
      },
    };
    const useCase = new SendCheer({
      cheerRepository: new DrizzleCheerRepository(txHost),
      notifier: createCheerNotifier(),
      limitReader: createCheerLimitReader(1),
      mutationLock: mutationLock,
      unitOfWork: uow,
      followReader: createFollowReaderStub(),
      logger: mock<ConstructorParameters<typeof SendCheer>[0]["logger"]>(),
    });

    // When
    const sending = useCase.execute({ senderId, receiverId, timezone: "Asia/Seoul" });
    const identity = await sendingIdentity.promise;
    try {
      continueLockAttempt.resolve();
      const mismatchedIdentity = { pid: -1, databaseOid: -1 };
      await expect(
        waitForBlockedAdvisoryLock(client, dailyKey, mismatchedIdentity, {
          timeoutMs: 40,
          pollIntervalMs: 10,
        }),
      ).rejects.toThrow("pid=-1, databaseOid=-1");
      const observation = await waitForBlockedAdvisoryLock(client, dailyKey, identity);
      expect(observation.waitingCount).toBe(1);
      vi.setSystemTime(new Date("2026-07-26T15:00:00.100Z"));
    } finally {
      continueLockAttempt.resolve();
      release.resolve();
      await Promise.allSettled([sending, blocker]);
    }
    const created = await sending;

    // Then
    expect(created.createdAt).toEqual(new Date("2026-07-26T14:59:59.900Z"));
    const persisted = await client.query.cheer.findFirst({ where: { id: created.id } });
    expect(persisted?.createdAt).toEqual(new Date("2026-07-26T14:59:59.900Z"));
  });
});
