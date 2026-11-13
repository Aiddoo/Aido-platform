import type { FeatureQuota } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { ClsPluginTransactional, TransactionHost } from "@nestjs-cls/transactional";
import { TransactionalAdapterDrizzleOrm } from "@nestjs-cls/transactional-adapter-drizzle-orm";
import { type DynamicModule, Module } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { and, asc, eq, sql } from "drizzle-orm";
import { ClsModule, ClsServiceManager } from "nestjs-cls";
import { vi } from "vitest";

import { EntitlementReaderPort } from "#api/modules/access/entitlements/access-entitlements.public";
import { AccessStateReaderPort } from "#api/modules/access/entitlements/application/ports/access-state.reader.port";
import { EntitlementCachePort } from "#api/modules/access/entitlements/application/ports/entitlement-cache.port";
import { GetResolvedAccessUseCase } from "#api/modules/access/entitlements/application/use-cases/get-resolved-access.use-case";
import { EntitlementCacheAdapter } from "#api/modules/access/entitlements/infrastructure/adapters/entitlement-cache.adapter";
import { EntitlementReaderAdapter } from "#api/modules/access/entitlements/infrastructure/adapters/entitlement-reader.adapter";
import { DrizzleAccessStateReader } from "#api/modules/access/entitlements/infrastructure/persistence/drizzle-access-state.reader";
import { TodoCategoryLockKeys } from "#api/modules/planning/categories/application/categories.lock-keys";
import type { TodoCategoryCachePort } from "#api/modules/planning/categories/application/ports/todo-category-cache.port";
import { CreateTodoCategoryUseCase } from "#api/modules/planning/categories/application/use-cases/create-todo-category.use-case";
import { ReorderTodoCategoryUseCase } from "#api/modules/planning/categories/application/use-cases/reorder-todo-category.use-case";
import { TodoCategoryLimitReaderAdapter } from "#api/modules/planning/categories/infrastructure/adapters/todo-category-limit-reader.adapter";
import { DrizzleTodoCategoryRepository } from "#api/modules/planning/categories/infrastructure/persistence/drizzle-todo-category.repository";
import type { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import { CheerLockKeys } from "#api/modules/social/cheers/application/cheers.lock-keys";
import type { CheerLimitReaderPort } from "#api/modules/social/cheers/application/ports/cheer-limit.reader.port";
import type { CheerNotifierPort } from "#api/modules/social/cheers/application/ports/cheer-notifier.port";
import type { DailySendQuotaUsage } from "#api/modules/social/cheers/application/ports/daily-send-usage.reader.port";
import { GetCheerLimitUseCase } from "#api/modules/social/cheers/application/use-cases/get-cheer-limit.use-case";
import { SendCheerUseCase } from "#api/modules/social/cheers/application/use-cases/send-cheer.use-case";
import { DrizzleCheerRepository } from "#api/modules/social/cheers/infrastructure/persistence/drizzle-cheer.repository";
import type { FollowReaderPort } from "#api/modules/social/friends/social-friends.public";
import type { NudgeLimitReaderPort } from "#api/modules/social/nudges/application/ports/nudge-limit.reader.port";
import type { NudgeNotifierPort } from "#api/modules/social/nudges/application/ports/nudge-notifier.port";
import { GetNudgeLimitUseCase } from "#api/modules/social/nudges/application/use-cases/get-nudge-limit.use-case";
import { SendNudgeUseCase } from "#api/modules/social/nudges/application/use-cases/send-nudge.use-case";
import { SendRemindNudgeUseCase } from "#api/modules/social/nudges/application/use-cases/send-remind-nudge.use-case";
import { DrizzleNudgeRepository } from "#api/modules/social/nudges/infrastructure/persistence/drizzle-nudge.repository";
import { CacheStorePort } from "#api/platform/cache/cache-store.port";
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
import { provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { type MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { type UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { toIsoString } from "#api/shared/domain/time/instant";
import { FakeTodoCache } from "#test/doubles/planning/fake-todo-cache";
import { DateClock } from "#test/doubles/platform/date-clock";
import { RecordingAfterCommitRegistry } from "#test/doubles/platform/recording-after-commit-registry";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { PassThroughCountCache } from "#test/doubles/social/pass-through-count-cache";
import { nowInstant } from "#test/fixtures/clock.fixture";
import { createTestClient, createTransactionHost } from "#test/setup/database-context";
import type { TestDatabaseClient } from "#test/setup/test-database";

import { TestDatabase } from "../setup/test-database.js";

const CONCURRENCY = 20;
const CATEGORY_POOL_MAX = 30;
const DAILY_LIMIT = 3;
const TODAY = Temporal.PlainDate.from("2026-07-26");

class BestEffortRendezvous {
  #arrivals = 0;
  #release: (() => void) | undefined;
  readonly #released = new Promise<void>((resolve) => {
    this.#release = resolve;
  });

  readonly #participants: number;
  readonly #maximumWaitMs: number;

  constructor(participants: number, maximumWaitMs = 20) {
    this.#participants = participants;
    this.#maximumWaitMs = maximumWaitMs;
  }

  async wait(): Promise<void> {
    this.#arrivals += 1;
    if (this.#arrivals >= this.#participants) {
      this.#release?.();
    }
    await Promise.race([
      this.#released,
      new Promise<void>((resolve) => setTimeout(resolve, this.#maximumWaitMs)),
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

  readonly #participants: number;

  constructor(participants: number, timeoutMs = 5000) {
    this.#participants = participants;
    this.#timer = setTimeout(() => {
      this.#ready.reject(
        new Error(
          `category pre-lock barrier timed out: ` +
            `arrivals=${this.#arrivals.length}/${this.#participants}; ` +
            `participants=[${this.#arrivals.join(",")}]`,
        ),
      );
    }, timeoutMs);
  }

  async arrive(participant: string): Promise<void> {
    this.#arrivals.push(participant);
    if (this.#arrivals.length > this.#participants) {
      const error = new Error(
        `category pre-lock barrier overflow: ` +
          `arrivals=${this.#arrivals.length}/${this.#participants}; ` +
          `participants=[${this.#arrivals.join(",")}]`,
      );
      this.#ready.reject(error);
      throw error;
    }
    if (this.#arrivals.length === this.#participants) {
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
  readonly #dailyBarrier?: BestEffortRendezvous;
  readonly #cooldownBarrier?: BestEffortRendezvous;

  constructor(
    txHost: TransactionHost<DrizzleTransactionalAdapter>,
    dailyBarrier?: BestEffortRendezvous,
    cooldownBarrier?: BestEffortRendezvous,
  ) {
    super(txHost);
    this.#dailyBarrier = dailyBarrier;
    this.#cooldownBarrier = cooldownBarrier;
  }

  override async countSentBetween(
    senderId: UserId,
    window: { readonly startsAt: Temporal.Instant; readonly endsAt: Temporal.Instant },
  ): Promise<number> {
    const count = await super.countSentBetween(senderId, window);
    await this.#dailyBarrier?.wait();
    return count;
  }

  override async findLastSent(senderId: UserId, receiverId: UserId) {
    const lastCheer = await super.findLastSent(senderId, receiverId);
    await this.#cooldownBarrier?.wait();
    return lastCheer;
  }
}

class RacingNudgeRepository extends DrizzleNudgeRepository {
  readonly #dailyBarrier?: BestEffortRendezvous;
  readonly #todoCooldownBarrier?: BestEffortRendezvous;
  readonly #reminderCooldownBarrier?: BestEffortRendezvous;

  constructor(
    txHost: TransactionHost<DrizzleTransactionalAdapter>,
    dailyBarrier?: BestEffortRendezvous,
    todoCooldownBarrier?: BestEffortRendezvous,
    reminderCooldownBarrier?: BestEffortRendezvous,
  ) {
    super(txHost);
    this.#dailyBarrier = dailyBarrier;
    this.#todoCooldownBarrier = todoCooldownBarrier;
    this.#reminderCooldownBarrier = reminderCooldownBarrier;
  }

  override async countSentBetween(
    senderId: UserId,
    window: { readonly startsAt: Temporal.Instant; readonly endsAt: Temporal.Instant },
  ): Promise<number> {
    const count = await super.countSentBetween(senderId, window);
    await this.#dailyBarrier?.wait();
    return count;
  }

  override async findLastSentForTodo(senderId: UserId, todoId: TodoId) {
    const lastNudge = await super.findLastSentForTodo(senderId, todoId);
    await this.#todoCooldownBarrier?.wait();
    return lastNudge;
  }

  override async findLastReminderSentTo(senderId: UserId, receiverId: UserId) {
    const reminder = await super.findLastReminderSentTo(senderId, receiverId);
    await this.#reminderCooldownBarrier?.wait();
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
  waitingCount: number;
}

interface AdvisoryLockIdentity {
  pid: number;
  databaseOid: number;
}

interface AdvisoryLockState {
  grantedCount: number;
  waitingCount: number;
}

class CoordinatedCategoryMutationLock implements MutationLockPort {
  readonly #barrier: RequiredParticipantBarrier;
  readonly #firstHolderAcquired = createRejectableDeferred();
  readonly #releaseFirstHolder = createDeferred();
  #hasFirstHolder = false;

  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #delegate: PostgresMutationLockAdapter;
  readonly #expectedKey: string;

  constructor(
    txHost: TransactionHost<DrizzleTransactionalAdapter>,
    delegate: PostgresMutationLockAdapter,
    expectedKey: string,
    participants: number,
    timeoutMs = 5000,
  ) {
    this.#txHost = txHost;
    this.#delegate = delegate;
    this.#expectedKey = expectedKey;
    this.#barrier = new RequiredParticipantBarrier(participants, timeoutMs);
  }

  async acquire(keys: readonly string[]): Promise<void> {
    if (keys.length !== 1 || keys[0] !== this.#expectedKey) {
      throw new Error(
        `unexpected category lock key: expected=${JSON.stringify(this.#expectedKey)}, ` +
          `received=${JSON.stringify(keys)}`,
      );
    }
    if (!this.#txHost.isTransactionActive()) {
      throw new Error(
        `category lock reached outside active UoW: key=${JSON.stringify(this.#expectedKey)}`,
      );
    }

    const { rows } = await this.#txHost.tx.execute<{ pid: number }>(
      sql`SELECT pg_backend_pid()::int AS pid`,
    );
    const pid = rows[0]?.pid;
    if (pid === undefined) {
      throw new Error(
        `could not identify category transaction backend: ` +
          `key=${JSON.stringify(this.#expectedKey)}`,
      );
    }

    await this.#barrier.arrive(pid.toString());
    await this.#delegate.acquire(keys);

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

const LOCK_PROBE_INTERVAL_MS = 10;

async function waitForBlockedAdvisoryLock(
  client: TestDatabaseClient,
  key: string,
  identity: AdvisoryLockIdentity,
  options: { timeoutMs?: number } = {},
): Promise<AdvisoryWaitObservation> {
  return vi.waitFor(
    async () => {
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
      const waitingCount = rows[0]?.waitingCount ?? 0;
      if (waitingCount === 0) {
        throw new Error(
          `PostgreSQL advisory lock key=${JSON.stringify(key)}; ` +
            `pid=${identity.pid}, databaseOid=${identity.databaseOid}; waitingCount=0`,
        );
      }
      return { waitingCount };
    },
    { timeout: options.timeoutMs ?? 2000, interval: LOCK_PROBE_INTERVAL_MS },
  );
}

async function waitForCategoryAdvisoryLockState(
  client: TestDatabaseClient,
  key: string,
  expectedWaitingCount: number,
): Promise<AdvisoryLockState> {
  return vi.waitFor(
    async () => {
      const { rows } = await client.execute<AdvisoryLockState>(sql`
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
      const state = {
        grantedCount: rows[0]?.grantedCount ?? 0,
        waitingCount: rows[0]?.waitingCount ?? 0,
      };
      if (state.grantedCount !== 1 || state.waitingCount !== expectedWaitingCount) {
        throw new Error(
          `category advisory lock key=${JSON.stringify(key)}; expectedGranted=1, ` +
            `granted=${state.grantedCount}; expectedWaiting=${expectedWaitingCount}, ` +
            `waiting=${state.waitingCount}`,
        );
      }
      return state;
    },
    { timeout: 5000, interval: LOCK_PROBE_INTERVAL_MS },
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
  let lockState: AdvisoryLockState = { grantedCount: 0, waitingCount: 0 };
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

function createTransactionHarness(client: TestDatabaseClient): {
  txHost: TransactionHost<DrizzleTransactionalAdapter>;
  uow: UnitOfWorkPort;
} {
  const txHost = createTransactionHost(client);
  return { txHost, uow: new ClsUnitOfWork(txHost, ClsServiceManager.getClsService()) };
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

function createFollowReaderStub(): Pick<FollowReaderPort, "isMutualFriend" | "getUserDisplayName"> {
  return { isMutualFriend: async () => true, getUserDisplayName: async (userId) => userId.value };
}

function createCheerNotifier(): CheerNotifierPort {
  return { notifyCheerSent: async () => undefined };
}

function createNudgeNotifier(): NudgeNotifierPort {
  return {
    notifyNudgeSent: async () => undefined,
    recordInteraction: async () => undefined,
    recordInteractions: async () => undefined,
  };
}

/** 고정 일일 한도의 한도 오류 featureQuota. 실제 계산은 EntitlementReaderAdapter 단위 테스트가 검증한다. */
function fixedDailyQuota(
  feature: "CHEER" | "NUDGE",
  limit: number | null,
  usage: DailySendQuotaUsage,
): FeatureQuota {
  return {
    feature,
    allowed: true,
    limit,
    used: usage.used,
    remaining: limit == null ? null : Math.max(0, limit - usage.used),
    period: "day",
    resetsAt: toIsoString(usage.resetsAt),
    isFairUse: false,
    perUse: null,
  };
}

function createCheerLimitReader(
  limit: number | null,
): Pick<CheerLimitReaderPort, "readLimitInTx" | "readFeatureQuotaInTx"> {
  return {
    readLimitInTx: async () => limit,
    readFeatureQuotaInTx: async (_userId, usage) => fixedDailyQuota("CHEER", limit, usage),
  };
}

function createNudgeLimitReader(
  limit: number | null,
): Pick<NudgeLimitReaderPort, "readLimitInTx" | "readFeatureQuotaInTx"> {
  return {
    readLimitInTx: async () => limit,
    readFeatureQuotaInTx: async (_userId, usage) => fixedDailyQuota("NUDGE", limit, usage),
  };
}

function createDailyLimitReader(
  dailyLimit: number,
): Pick<CheerLimitReaderPort | NudgeLimitReaderPort, "readLimit"> {
  return { readLimit: async () => dailyLimit };
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
    updatedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
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
    .values({
      userId,
      name: "Mutation",
      color: "#112233",
      updatedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
      sortOrder: 0,
    })
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
      updatedAt: nowInstant(),
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
        { provide: EntitlementReaderPort, useClass: EntitlementReaderAdapter },
        { provide: EntitlementCachePort, useClass: EntitlementCacheAdapter },
        { provide: AccessStateReaderPort, useClass: DrizzleAccessStateReader },
        { provide: ClockPort, useValue: new DateClock() },
        provideUseCase(GetResolvedAccessUseCase, {
          accessStateReader: AccessStateReaderPort,
          entitlementCache: EntitlementCachePort,
          clock: ClockPort,
        }),
        TodoCategoryLimitReaderAdapter,
        {
          provide: CacheStorePort,
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
      3000,
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
    const useCase = new SendCheerUseCase({
      countCache: new PassThroughCountCache(),
      cheerRepository: repository,
      notifier: createCheerNotifier(),
      limitReader: createCheerLimitReader(DAILY_LIMIT),
      mutationLock: new PostgresMutationLockAdapter(txHost),
      unitOfWork: uow,
      followReader: createFollowReaderStub(),
      clock: new DateClock(),
      logger: new SilentLogger(),
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
    const useCase = new SendCheerUseCase({
      countCache: new PassThroughCountCache(),
      cheerRepository: repository,
      notifier: createCheerNotifier(),
      limitReader: createCheerLimitReader(null),
      mutationLock: new PostgresMutationLockAdapter(txHost),
      unitOfWork: uow,
      followReader: createFollowReaderStub(),
      clock: new DateClock(),
      logger: new SilentLogger(),
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
    const useCase = new SendNudgeUseCase({
      countCache: new PassThroughCountCache(),
      nudgeRepository: repository,
      notifier: createNudgeNotifier(),
      limitReader: createNudgeLimitReader(DAILY_LIMIT),
      mutationLock: new PostgresMutationLockAdapter(txHost),
      unitOfWork: uow,
      followReader: createFollowReaderStub(),
      clock: new DateClock(),
      logger: new SilentLogger(),
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
    const useCase = new SendNudgeUseCase({
      countCache: new PassThroughCountCache(),
      nudgeRepository: repository,
      notifier: createNudgeNotifier(),
      limitReader: createNudgeLimitReader(null),
      mutationLock: new PostgresMutationLockAdapter(txHost),
      unitOfWork: uow,
      followReader: createFollowReaderStub(),
      clock: new DateClock(),
      logger: new SilentLogger(),
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
    const useCase = new SendRemindNudgeUseCase({
      nudgeRepository: repository,
      notifier: createNudgeNotifier(),
      mutationLock: new PostgresMutationLockAdapter(txHost),
      unitOfWork: uow,
      followReader: createFollowReaderStub(),
      clock: new DateClock(),
      logger: new SilentLogger(),
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
    const lockKey = TodoCategoryLockKeys.userCategories(userId);
    const coordinatedLock = new CoordinatedCategoryMutationLock(
      categoryTxHost,
      categoryLockAdapter,
      lockKey,
      CONCURRENCY,
    );
    const useCase = new CreateTodoCategoryUseCase({
      repository: categoryRepository,
      cache: createTodoCategoryCache(),
      limitReader: categoryLimitReader,
      mutationLock: coordinatedLock,
      unitOfWork: categoryUow,
      clock: new DateClock(),
      logger: new SilentLogger(),
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
        updatedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
        sortOrder: index,
      })),
    );
    const categories = await client
      .select()
      .from(todoCategory)
      .where(eq(todoCategory.userId, userId))
      .orderBy(asc(todoCategory.sortOrder));
    const lockKey = TodoCategoryLockKeys.userCategories(userId);
    const coordinatedLock = new CoordinatedCategoryMutationLock(
      categoryTxHost,
      categoryLockAdapter,
      lockKey,
      CONCURRENCY,
    );
    const useCase = new ReorderTodoCategoryUseCase({
      repository: categoryRepository,
      cache: createTodoCategoryCache(),
      todoCache: new FakeTodoCache(),
      afterCommit: new RecordingAfterCommitRegistry(),
      mutationLock: coordinatedLock,
      unitOfWork: categoryUow,
      logger: new SilentLogger(),
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
        createdAt: Temporal.Instant.from("2026-07-25T14:59:59.999Z"),
      },
      {
        senderId,
        receiverId: currentReceiverId,
        createdAt: Temporal.Instant.from("2026-07-25T15:00:00.001Z"),
      },
    ]);
    const { txHost } = createTransactionHarness(client);
    const reader = new GetCheerLimitUseCase({
      cheerRepository: new DrizzleCheerRepository(txHost),
      limitReader: createDailyLimitReader(3),
      clock: new DateClock(),
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
        createdAt: Temporal.Instant.from("2026-07-25T14:59:59.999Z"),
      },
      {
        senderId,
        receiverId,
        todoId,
        createdAt: Temporal.Instant.from("2026-07-25T15:00:00.001Z"),
      },
    ]);
    const { txHost } = createTransactionHarness(client);
    const reader = new GetNudgeLimitUseCase({
      nudgeRepository: new DrizzleNudgeRepository(txHost),
      limitReader: createDailyLimitReader(3),
      clock: new DateClock(),
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
    const dailyKey = CheerLockKeys.dailyQuota(UserId.reconstitute(senderId));
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
    const useCase = new SendCheerUseCase({
      countCache: new PassThroughCountCache(),
      cheerRepository: new DrizzleCheerRepository(txHost),
      notifier: createCheerNotifier(),
      limitReader: createCheerLimitReader(1),
      mutationLock: mutationLock,
      unitOfWork: uow,
      followReader: createFollowReaderStub(),
      clock: new DateClock(),
      logger: new SilentLogger(),
    });

    // When
    const sending = useCase.execute({ senderId, receiverId, timezone: "Asia/Seoul" });
    const identity = await sendingIdentity.promise;
    try {
      continueLockAttempt.resolve();
      const mismatchedIdentity = { pid: -1, databaseOid: -1 };
      await expect(
        waitForBlockedAdvisoryLock(client, dailyKey, mismatchedIdentity, { timeoutMs: 40 }),
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
    expect(created.createdAt).toEqual(Temporal.Instant.from("2026-07-26T14:59:59.900Z"));
    const persisted = await client.query.cheer.findFirst({ where: { id: created.id.value } });
    expect(persisted?.createdAt).toEqual(Temporal.Instant.from("2026-07-26T14:59:59.900Z"));
  });
});
