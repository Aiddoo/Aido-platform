import { ErrorCode } from "@aido/api/errors";
import type { TestingModule } from "@nestjs/testing";
import { sql } from "drizzle-orm";
import { vi } from "vitest";

import { ExchangeOAuthCodeUseCase } from "#api/modules/identity/auth/application/use-cases/exchange-oauth-code.use-case";
import { LinkOAuthAccountWithCodeUseCase } from "#api/modules/identity/auth/application/use-cases/link-oauth-account-with-code.use-case";
import { LoginWithOAuthTokenUseCase } from "#api/modules/identity/auth/application/use-cases/login-with-oauth-token.use-case";
import { UnlinkOAuthAccountUseCase } from "#api/modules/identity/auth/application/use-cases/unlink-oauth-account.use-case";
import { DrizzleAccountRepository } from "#api/modules/identity/auth/infrastructure/persistence/drizzle-account.repository";
import { DrizzleOAuthStateRepository } from "#api/modules/identity/auth/infrastructure/persistence/drizzle-oauth-state.repository";
import { DrizzleSecurityLogRepository } from "#api/modules/identity/auth/infrastructure/persistence/drizzle-security-log.repository";
import { DrizzleUserRepository } from "#api/modules/identity/users/infrastructure/persistence/drizzle-user.repository";
import { createEntityId } from "#api/platform/database/entity-id";
import { oAuthState, user as userTable } from "#api/platform/database/schema/index";
import { UnitOfWorkPort } from "#api/shared/application/ports/index";
import { UserFixture } from "#test/fixtures/index";
import { FakeEmailService } from "#test/mocks/fake-email.service";
import { CountingOAuthIdentityProvider } from "#test/mocks/ports/auth-oauth.stub";
import { createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

import { createAuthTestModule } from "./helpers/auth-test-module.factory.js";

const at = new Date("2027-01-01T00:00:00.000Z");
const atInstant = Temporal.Instant.fromEpochMilliseconds(at.getTime());

describe("OAuth 교환과 로그인 수단 변경 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let module: TestingModule;
  let accounts: DrizzleAccountRepository;
  let states: DrizzleOAuthStateRepository;
  let users: DrizzleUserRepository;
  let securityLogs: DrizzleSecurityLogRepository;
  let exchange: ExchangeOAuthCodeUseCase;
  let link: LinkOAuthAccountWithCodeUseCase;
  let unlink: UnlinkOAuthAccountUseCase;
  let oauthLogin: LoginWithOAuthTokenUseCase;
  let provider: CountingOAuthIdentityProvider;
  let unitOfWork: UnitOfWorkPort;
  let userId: string;
  let sequence = 0;

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 5 }) });
    client = await database.start();
    provider = new CountingOAuthIdentityProvider();
    module = await createAuthTestModule(client, new FakeEmailService(), {
      oauthProviderRegistry: new Map([[provider.provider, provider]]),
    });
    accounts = module.get(DrizzleAccountRepository);
    states = module.get(DrizzleOAuthStateRepository);
    users = module.get(DrizzleUserRepository);
    securityLogs = module.get(DrizzleSecurityLogRepository);
    exchange = module.get(ExchangeOAuthCodeUseCase);
    link = module.get(LinkOAuthAccountWithCodeUseCase);
    unlink = module.get(UnlinkOAuthAccountUseCase);
    oauthLogin = module.get(LoginWithOAuthTokenUseCase);
    unitOfWork = module.get(UnitOfWorkPort);
  });

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(at);
    await database.cleanup();
    sequence = 0;
    const user = UserFixture.create({
      id: createEntityId(),
      email: "oauth-owner@example.com",
      userTag: "OAUTHPG1",
      createdAt: atInstant,
      updatedAt: atInstant,
    });
    await client.insert(userTable).values(user);
    userId = user.id;
  });

  afterEach(() => vi.useRealTimers());
  afterAll(async () => {
    try {
      await module?.close();
    } finally {
      await database?.stop();
    }
  });

  async function givenState(overrides: Partial<typeof oAuthState.$inferSelect> = {}) {
    sequence += 1;
    const [fixture] = await client
      .insert(oAuthState)
      .values({
        id: sequence,
        state: `state-${sequence}`,
        provider: "GOOGLE",
        redirectUri: "aido://auth/callback",
        exchangeCode: `code-${sequence}`,
        mode: "login",
        accessToken: "access",
        refreshToken: "refresh",
        userId,
        expiresAt: atInstant.add({ minutes: 10 }),
        ...overrides,
      })
      .returning();
    if (fixture == null) {
      throw new Error("OAuth state fixture was not created");
    }
    return fixture;
  }

  async function savedState(id: number) {
    return client.query.oAuthState.findFirst({ where: { id } });
  }

  async function holdRowLock(statement: ReturnType<typeof sql>) {
    const released = Promise.withResolvers<void>();
    const acquired = Promise.withResolvers<void>();
    const holding = client.transaction(async (transaction) => {
      await transaction.execute(statement);
      acquired.resolve();
      await released.promise;
    });
    await Promise.race([
      acquired.promise,
      holding.then(() => {
        throw new Error("경쟁 요청 전에 잠금이 해제되었습니다.");
      }),
    ]);
    return {
      async release() {
        released.resolve();
        await holding;
      },
    };
  }

  async function observeTwoWaiters(queryPart: string) {
    await vi.waitFor(
      async () => {
        const waiting = await client.execute<{ count: number }>(sql`
          SELECT count(*)::int AS count FROM pg_stat_activity
          WHERE datname = current_database() AND wait_event_type = 'Lock'
            AND query ILIKE ${queryPart}
        `);
        expect(waiting.rows[0]?.count).toBe(2);
      },
      { timeout: 10_000 },
    );
  }

  it("같은 login 교환 코드를 동시에 소비하면 한 요청만 토큰을 받는다", async () => {
    // Given
    const state = await givenState({ mode: null });
    const lock = await holdRowLock(
      sql`SELECT "id"::text AS "id" FROM "OAuthState" WHERE "id" = ${state.id} FOR UPDATE`,
    );
    const results = Promise.allSettled([
      exchange.execute({ code: state.exchangeCode ?? "" }),
      exchange.execute({ code: state.exchangeCode ?? "" }),
    ]);

    // When
    try {
      await observeTwoWaiters("%UPDATE%OAuthState%");
    } finally {
      await lock.release();
      await results;
    }
    const outcomes = await results;

    // Then
    expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.find((result) => result.status === "rejected")).toMatchObject({
      reason: { errorCode: ErrorCode.USER_0602 },
    });
    expect(await savedState(state.id)).toMatchObject({
      exchangedAt: expect.any(Temporal.Instant),
      accessToken: null,
      refreshToken: null,
    });
  });

  it("서로 다른 로그인 수단 두 개를 동시에 해제하면 마지막 계정은 유지된다", async () => {
    // Given
    await accounts.createOAuthAccount({ userId, provider: "GOOGLE", providerAccountId: "google" });
    await accounts.createOAuthAccount({ userId, provider: "KAKAO", providerAccountId: "kakao" });
    const lock = await holdRowLock(
      sql`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR NO KEY UPDATE`,
    );
    const results = Promise.allSettled([
      unlink.execute({ userId, provider: "GOOGLE" }),
      unlink.execute({ userId, provider: "KAKAO" }),
    ]);

    // When
    try {
      await observeTwoWaiters("%User%FOR NO KEY UPDATE%");
    } finally {
      await lock.release();
      await results;
    }
    const outcomes = await results;

    // Then
    expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.find((result) => result.status === "rejected")).toMatchObject({
      reason: { errorCode: ErrorCode.USER_0610 },
    });
    expect(await accounts.findAllByUserId(userId)).toHaveLength(1);
    const audits = await client.query.securityLog.findMany();
    expect(audits.filter((audit) => audit.event === "OAUTH_UNLINKED")).toHaveLength(1);
  });

  it("같은 자동 연결 로그인이 동시에 와도 한 요청만 연결하고 다른 요청은 500 대신 이미 연결된 계정 오류를 받는다", async () => {
    // Given
    // 검증된 Google 이메일이 기존 사용자와 같아 두 요청 모두 자동 연결 경로로 간다
    provider.profile = { ...provider.profile, id: "google-race", email: "oauth-owner@example.com" };
    const lock = await holdRowLock(
      sql`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR NO KEY UPDATE`,
    );
    const results = Promise.allSettled([
      oauthLogin.execute({ provider: "GOOGLE", token: "same-token" }),
      oauthLogin.execute({ provider: "GOOGLE", token: "same-token" }),
    ]);

    // When
    try {
      await observeTwoWaiters("%User%FOR NO KEY UPDATE%");
    } finally {
      await lock.release();
      await results;
    }
    const outcomes = await results;

    // Then
    expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.find((result) => result.status === "rejected")).toMatchObject({
      reason: { errorCode: ErrorCode.GOOGLE_0405 },
    });
    expect(
      (await accounts.findAllByUserId(userId)).map((account) => account.providerAccountId),
    ).toEqual(["google-race"]);
    const audits = await client.query.securityLog.findMany();
    expect(audits.filter((audit) => audit.event === "OAUTH_AUTO_LINKED")).toHaveLength(1);
  });

  it("이미 이메일 로그인 수단이 있으면 저장소가 제약 위반을 필터의 옛 응답과 같은 USER_0604로 번역한다", async () => {
    // Given
    await accounts.createCredentialAccount(userId, "first-hash");

    // When
    const duplicate = accounts.createCredentialAccount(userId, "second-hash");

    // Then
    await expect(duplicate).rejects.toMatchObject({ errorCode: ErrorCode.USER_0604 });
    const credentials = (await accounts.findAllByUserId(userId)).filter(
      (account) => account.provider === "CREDENTIAL",
    );
    expect(credentials.map((account) => account.password)).toEqual(["first-hash"]);
  });

  it("감사 INSERT의 실제 FK 오류는 계정 생성과 link 코드 소비를 함께 rollback한다", async () => {
    // Given
    const state = await givenState({
      mode: "link",
      initiatingUserId: userId,
      userId: "apple",
      accessToken: null,
      refreshToken: null,
      provider: "APPLE",
    });
    const createAudit = securityLogs.create.bind(securityLogs);
    const failure = vi
      .spyOn(securityLogs, "create")
      .mockImplementationOnce((data) => createAudit({ ...data, userId: createEntityId() }));

    // When
    try {
      await expect(link.execute({ userId, code: state.exchangeCode ?? "" })).rejects.toMatchObject({
        cause: { code: "23503" },
      });
    } finally {
      failure.mockRestore();
    }

    // Then
    expect(await savedState(state.id)).toMatchObject({ exchangedAt: null });
    expect(await accounts.findAllByUserId(userId)).toEqual([]);
    expect(await client.query.securityLog.findMany()).toEqual([]);
    await expect(link.execute({ userId, code: state.exchangeCode ?? "" })).resolves.toMatchObject({
      message: "계정이 연결되었습니다.",
    });
    expect(await accounts.findAllByUserId(userId)).toHaveLength(1);
  });

  it("같은 link 코드를 동시에 교환하면 계정과 감사 기록을 한 번만 생성한다", async () => {
    // Given
    const state = await givenState({
      mode: "link",
      initiatingUserId: userId,
      userId: "apple",
      provider: "APPLE",
      accessToken: null,
      refreshToken: null,
    });
    const lock = await holdRowLock(
      sql`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR NO KEY UPDATE`,
    );
    const results = Promise.allSettled([
      link.execute({ userId, code: state.exchangeCode ?? "" }),
      link.execute({ userId, code: state.exchangeCode ?? "" }),
    ]);

    // When
    try {
      await observeTwoWaiters("%User%FOR NO KEY UPDATE%");
    } finally {
      await lock.release();
      await results;
    }
    const outcomes = await results;

    // Then
    expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.find((result) => result.status === "rejected")).toMatchObject({
      reason: { errorCode: ErrorCode.USER_0602 },
    });
    expect(await accounts.findAllByUserId(userId)).toHaveLength(1);
    expect(await client.query.securityLog.findMany()).toHaveLength(1);
  });

  it("계정 연결과 해제가 경합해도 같은 User 잠금으로 최신 로그인 수단을 유지한다", async () => {
    // Given
    await accounts.createOAuthAccount({ userId, provider: "GOOGLE", providerAccountId: "google" });
    await accounts.createOAuthAccount({ userId, provider: "KAKAO", providerAccountId: "kakao" });
    const state = await givenState({
      mode: "link",
      initiatingUserId: userId,
      userId: "apple",
      provider: "APPLE",
      accessToken: null,
      refreshToken: null,
    });
    const lock = await holdRowLock(
      sql`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR NO KEY UPDATE`,
    );
    const results = Promise.allSettled([
      link.execute({ userId, code: state.exchangeCode ?? "" }),
      unlink.execute({ userId, provider: "GOOGLE" }),
    ]);

    // When
    try {
      await observeTwoWaiters("%User%FOR NO KEY UPDATE%");
    } finally {
      await lock.release();
      await results;
    }

    // Then
    expect((await results).map((result) => result.status)).toEqual(["fulfilled", "fulfilled"]);
    expect(
      (await accounts.findAllByUserId(userId)).map((account) => account.provider).sort(),
    ).toEqual(["APPLE", "KAKAO"]);
    expect(await client.query.securityLog.findMany()).toHaveLength(2);
  });

  it.each([null, "", "owner"])(
    "legacy 또는 소유자 actor %s인 link 코드만 소비한다",
    async (actor) => {
      // Given
      const state = await givenState({
        mode: "link",
        initiatingUserId: actor === "owner" ? userId : actor,
        userId: "apple",
        provider: "APPLE",
        accessToken: null,
        refreshToken: null,
      });

      // When
      const consumed = await states.consumeExchangeCode({
        id: state.id,
        exchangeCode: state.exchangeCode ?? "",
        at: atInstant,
        purpose: "link",
        actorUserId: userId,
      });

      // Then
      expect(consumed).toBe(true);
      expect(
        await states.consumeExchangeCode({
          id: state.id,
          exchangeCode: state.exchangeCode ?? "",
          at: atInstant,
          purpose: "link",
          actorUserId: userId,
        }),
      ).toBe(false);
    },
  );

  it("다른 actor와 login 목적 상태를 link로 소비할 수 없고 만료 equality도 거부한다", async () => {
    // Given
    const actorMismatch = await givenState({ mode: "link", initiatingUserId: createEntityId() });
    const purposeMismatch = await givenState({ mode: "login" });
    const expired = await givenState({ mode: "link", expiresAt: atInstant });

    // When
    for (const state of [actorMismatch, purposeMismatch, expired]) {
      expect(
        await states.consumeExchangeCode({
          id: state.id,
          exchangeCode: state.exchangeCode ?? "",
          at: atInstant,
          purpose: "link",
          actorUserId: userId,
        }),
      ).toBe(false);
      expect(await savedState(state.id)).toMatchObject({ exchangedAt: null });
    }
  });

  it("NO KEY UPDATE 중에도 User FK를 참조하는 감사 INSERT가 잠금 해제를 기다리지 않는다", async () => {
    // Given
    let release: (() => void) | undefined;
    let locked: (() => void) | undefined;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const acquired = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const holder = unitOfWork.run(async () => {
      await users.findByIdForUpdate(userId);
      locked?.();
      await released;
    });
    await acquired;
    let inserted = false;
    const audit = securityLogs
      .create({ userId, event: "OAUTH_LINKED", ipAddress: "192.0.2.1", userAgent: "pg-lock-test" })
      .then(() => {
        inserted = true;
      });

    // When
    try {
      await vi.waitFor(() => expect(inserted).toBe(true), { timeout: 10_000 });
    } finally {
      release?.();
      await holder;
      await audit;
    }

    // Then
    expect(await client.query.securityLog.findMany()).toHaveLength(1);
  });
});
