import { ErrorCode } from "@aido/api/errors";
import postgres from "@prisma/orm-postgres/runtime";
import { Pool } from "pg";
import sql from "sql-template-tag";

import { InviteRedemption } from "#api/modules/social/domain/aggregates/invites/invite-redemption.aggregate";
import { InviteCode } from "#api/modules/social/domain/value-objects/invites/invite-code.vo";
import { InviteCodeGenerator } from "#api/modules/social/infrastructure/persistence/invites/invite-code.generator";
import { PrismaInviteRedemptionRepository } from "#api/modules/social/infrastructure/persistence/invites/prisma-invite-redemption.repository";
import { PrismaInviteRepository } from "#api/modules/social/infrastructure/persistence/invites/prisma-invite.repository";
import { PrismaRewardClaimRepository } from "#api/modules/social/infrastructure/persistence/invites/prisma-reward-claim.repository";
import { PrismaRewardGrantRepository } from "#api/modules/social/infrastructure/persistence/invites/prisma-reward-grant.repository";
import { decodeRecord, encodeCreate } from "#api/platform/database/database-records";
import { decodeSqlRows, sqlRowSpec, sqlStatement } from "#api/platform/database/database-sql";
import { createEntityId } from "#api/platform/database/database-values";
import { contract } from "#api/platform/database/database.service";
import { createPostgresPoolConfig } from "#api/platform/database/postgres-pool";
import { isUniqueConstraintViolation } from "#api/platform/database/prisma-error.util";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";
import { UserFixture } from "#test/fixtures/user.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { createStatementObserver } from "#test/setup/statement-observer";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

let statements: string[] | null = null;
const trace = createStatementObserver("invite-query-observer", (statement) => {
  statements?.push(statement.sql);
});

class SequenceInviteCodeGenerator extends InviteCodeGenerator {
  #codes: string[] = [];

  use(codes: readonly string[]): void {
    this.#codes = [...codes];
  }

  override generate(): string {
    return this.#codes.shift() ?? super.generate();
  }
}

describe("초대 저장소·제약·시간대 (실제 PostgreSQL)", () => {
  const database = new TestDatabase({
    createClient(url) {
      // 운영 풀과 같은 설정으로 세션 TimeZone을 확인한다
      const pool = new Pool({ ...createPostgresPoolConfig(url), max: 4 });
      const native = postgres({ contract, pg: pool, middleware: [trace] });
      let closed = false;
      return {
        ...native,
        async close() {
          if (closed) return;
          closed = true;
          await native.close();
          await pool.end();
        },
      };
    },
  });
  let client: TestDatabaseClient;
  let codeGenerator: SequenceInviteCodeGenerator;
  let invites: PrismaInviteRepository;
  let redemptions: PrismaInviteRedemptionRepository;
  let grants: PrismaRewardGrantRepository;
  let claims: PrismaRewardClaimRepository;
  let unitOfWork: UnitOfWorkPort;

  async function createUser(overrides: { userTag: string; name?: string }): Promise<string> {
    const id = createEntityId();
    await client.orm.public.User.create(
      encodeCreate(
        "User",
        UserFixture.create({
          id,
          email: `${overrides.userTag}@example.test`,
          userTag: overrides.userTag,
        }),
      ),
    );
    if (overrides.name !== undefined) {
      await client.orm.public.UserProfile.create(
        encodeCreate("UserProfile", {
          userId: id,
          name: overrides.name,
          profileImage: "orange_tabby",
        }),
      );
    }
    return id;
  }

  async function redeem(inviterId: string, inviteId: string, inviteeId: string, joinedAt: Date) {
    const redemption = await redemptions.create(
      InviteRedemption.planCreation({ inviteId, inviterId, inviteeId, joinedAt }),
    );
    if (redemption === null) throw new Error("초대 수락 행이 필요합니다");
    return redemption;
  }

  beforeAll(async () => {
    client = await database.start();
    const { txHost, uow } = createDatabaseTransactionFixture(client);
    unitOfWork = uow;
    codeGenerator = new SequenceInviteCodeGenerator();
    invites = new PrismaInviteRepository(txHost, codeGenerator);
    redemptions = new PrismaInviteRedemptionRepository(txHost);
    grants = new PrismaRewardGrantRepository(txHost);
    claims = new PrismaRewardClaimRepository(txHost);
  });

  beforeEach(async () => {
    statements = null;
    codeGenerator.use([]);
    await database.cleanup();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await database.stop();
  });

  describe("세션 시간대", () => {
    it("프로세스 TZ가 Asia/Seoul이어도 세션은 UTC이고 now() 기본값과 명시 시각이 그대로 왕복한다", async () => {
      // Given
      vi.stubEnv("TZ", "Asia/Seoul");
      const inviterId = await createUser({ userTag: "TZUSER01" });
      const before = Date.now();

      // When
      const timezone = decodeSqlRows(
        sqlRowSpec({ TimeZone: "pg/text@1" }),
        await client.runtime().query(
          sqlStatement(client, sql`SHOW TimeZone`)
            .returnsRow(sqlRowSpec({ TimeZone: "pg/text@1" }))
            .build(),
        ),
      );
      const invite = await invites.issue({
        inviterId,
        issuedAt: new Date("2028-02-29T23:59:59.123Z"),
      });
      const [defaulted] = decodeRecord(
        "RewardClaim",
        await client.orm.public.RewardClaim.createAll([
          encodeCreate("RewardClaim", { claimHash: "a".repeat(64), claimKind: "INSTALLATION" }),
        ]),
      );

      // Then
      expect(timezone).toEqual([{ TimeZone: "UTC" }]);
      expect((await invites.findActiveByInviterId(inviterId))?.createdAt).toEqual(
        new Date("2028-02-29T23:59:59.123Z"),
      );
      expect(invite.code).toMatch(/^[23456789BCDFGHJKMNPQRSTVWXZ]{6}$/);
      expect(Math.abs((defaulted?.firstClaimedAt.getTime() ?? 0) - before)).toBeLessThan(60_000);
    });
  });

  describe("초대 코드 유일성", () => {
    it("코드가 겹치면 새 코드로 다시 발급하고 폐기한 코드는 다시 쓰지 않는다", async () => {
      // Given
      const inviterId = await createUser({ userTag: "CODEUSR1" });
      const otherId = await createUser({ userTag: "CODEUSR2" });
      codeGenerator.use(["K7M2QX"]);
      const first = await invites.issue({ inviterId, issuedAt: new Date("2026-11-01T00:00:00Z") });
      first.revoke(new Date("2026-11-02T00:00:00Z"));
      await invites.saveRevocation(first);
      codeGenerator.use(["K7M2QX", "B2C3D4"]);

      // When
      const reissued = await invites.issue({
        inviterId: otherId,
        issuedAt: new Date("2026-11-03T00:00:00Z"),
      });

      // Then
      expect(reissued.code).toBe("B2C3D4");
      const revoked = await invites.findByCodeWithInviter(InviteCode.of("K7M2QX"));
      expect(revoked?.invite.status).toBe("REVOKED");
      expect(revoked?.invite.inviterId).toBe(inviterId);
    });

    it("5번 모두 겹치면 발급을 멈추고 오류를 반환한다", async () => {
      // Given
      const inviterId = await createUser({ userTag: "CODEUSR3" });
      const otherId = await createUser({ userTag: "CODEUSR4" });
      codeGenerator.use(["K7M2QX"]);
      await invites.issue({ inviterId, issuedAt: new Date("2026-11-01T00:00:00Z") });
      codeGenerator.use(Array.from({ length: 5 }, () => "K7M2QX"));

      // When
      const issue = invites.issue({
        inviterId: otherId,
        issuedAt: new Date("2026-11-01T00:00:00Z"),
      });

      // Then
      await expect(issue).rejects.toMatchObject({ errorCode: ErrorCode.SYS_0001 });
    });

    it("한 사람에게 ACTIVE 초대는 하나만 저장된다", async () => {
      // Given
      const inviterId = await createUser({ userTag: "CODEUSR5" });
      await invites.issue({ inviterId, issuedAt: new Date("2026-11-01T00:00:00Z") });

      // When
      const duplicate = invites.issue({ inviterId, issuedAt: new Date("2026-11-01T00:00:01Z") });

      // Then
      await expect(duplicate).rejects.toSatisfy(isUniqueConstraintViolation);
    });
  });

  describe("초대 수락과 보상 원장", () => {
    it("같은 초대받은 사람은 한 번만 수락되고 초대한 사람이 탈퇴해도 수락 기록과 기기 해시는 남는다", async () => {
      // Given
      const inviterId = await createUser({ userTag: "INVITER1" });
      const inviteeId = await createUser({ userTag: "INVITEE1" });
      const invite = await invites.issue({ inviterId, issuedAt: new Date("2026-11-01T00:00:00Z") });
      const redemption = await redeem(
        inviterId,
        invite.id,
        inviteeId,
        new Date("2026-11-02T00:00:00Z"),
      );
      await claims.claimAll([{ claimHash: "b".repeat(64), claimKind: "INSTALLATION" }], new Date());

      // When
      const duplicate = await redemptions.create(
        InviteRedemption.planCreation({
          inviteId: invite.id,
          inviterId,
          inviteeId,
          joinedAt: new Date("2026-11-02T00:00:01Z"),
        }),
      );
      await client.orm.public.User.where({ id: inviterId }).deleteAndCount();

      // Then
      expect(duplicate).toBeNull();
      const kept = await redemptions.findByIdForUpdate(redemption.id);
      expect([kept?.inviterId, kept?.inviteId, kept?.inviteeId]).toEqual([null, null, inviteeId]);
      expect(await claims.existsAny(["b".repeat(64)])).toBe(true);
      expect(
        await claims.claimAll(
          [{ claimHash: "b".repeat(64), claimKind: "INSTALLATION" }],
          new Date(),
        ),
      ).toBe(false);
    });

    it("초대한 사람 원장에는 자기가 초대한 수락의 지급만 들어간다", async () => {
      // Given
      const inviterId = await createUser({ userTag: "LEDGER01" });
      const inviteeId = await createUser({ userTag: "LEDGER02" });
      const invite = await invites.issue({ inviterId, issuedAt: new Date("2026-11-01T00:00:00Z") });
      const redemption = await redeem(
        inviterId,
        invite.id,
        inviteeId,
        new Date("2026-11-02T00:00:00Z"),
      );
      const base = { sourceType: "INVITE_REDEMPTION" as const, sourceId: redemption.id };

      // When
      const created = await grants.createPending([
        { ...base, recipientId: inviteeId, rewardType: "PREMIUM_DAYS", quantity: 7 },
        { ...base, recipientId: inviterId, rewardType: "PREMIUM_DAYS", quantity: 7 },
        { ...base, recipientId: inviterId, rewardType: "FRIEND_SLOT", quantity: 1 },
        { ...base, recipientId: inviterId, rewardType: "FRIEND_SLOT", quantity: 1 },
      ]);

      // Then
      expect(created).toBe(3);
      const ledger = await grants.findInviterLedger(inviterId);
      expect(ledger.map(({ rewardType, quantity }) => ({ rewardType, quantity }))).toEqual(
        expect.arrayContaining([
          { rewardType: "PREMIUM_DAYS", quantity: 7 },
          { rewardType: "FRIEND_SLOT", quantity: 1 },
        ]),
      );
      expect(ledger).toHaveLength(2);
      expect(await grants.findInviterLedger(inviteeId)).toEqual([]);
    });
  });

  describe("보상 재시도 대상", () => {
    it("재시도할 지급이 남은 수락만 sourceId 순서로 한 번씩 keyset으로 넘긴다", async () => {
      // Given
      const recipientId = await createUser({ userTag: "RETRYUSR" });
      const createdAt = new Date("2026-11-01T00:00:00Z");
      const grant = (
        sourceId: string,
        overrides: { status: "PENDING" | "FAILED" | "APPLIED"; attempts: number; at?: Date },
        rewardType: "PREMIUM_DAYS" | "FRIEND_SLOT" = "PREMIUM_DAYS",
      ) =>
        encodeCreate("RewardGrant", {
          recipientId,
          sourceType: "INVITE_REDEMPTION",
          sourceId,
          rewardType,
          quantity: 1,
          status: overrides.status,
          attempts: overrides.attempts,
          createdAt: overrides.at ?? createdAt,
        });
      await client.orm.public.RewardGrant.createAndCount([
        grant("src-a", { status: "PENDING", attempts: 0 }),
        grant("src-b", { status: "FAILED", attempts: 5 }),
        grant("src-c", { status: "FAILED", attempts: 1 }),
        grant("src-c", { status: "PENDING", attempts: 0 }, "FRIEND_SLOT"),
        grant("src-d", { status: "APPLIED", attempts: 0 }),
        grant("src-e", { status: "PENDING", attempts: 0, at: new Date("2026-11-03T00:00:00Z") }),
      ]);
      const params = { maxAttempts: 5, createdBefore: new Date("2026-11-02T00:00:00Z"), limit: 1 };

      // When
      const first = await grants.findRetryableSourceIds(params);
      const second = await grants.findRetryableSourceIds({ ...params, afterSourceId: first[0] });
      const third = await grants.findRetryableSourceIds({ ...params, afterSourceId: second[0] });

      // Then
      expect([first, second, third]).toEqual([["src-a"], ["src-c"], []]);
    });
  });

  describe("초대한 친구 목록", () => {
    it("페이지 크기와 관계없이 SQL 한 번으로 프로필·활동일 수를 읽고 keyset으로 이어 읽는다", async () => {
      // Given
      const inviterId = await createUser({ userTag: "LISTOWNR" });
      const invite = await invites.issue({ inviterId, issuedAt: new Date("2026-11-01T00:00:00Z") });
      const inviteeIds: string[] = [];
      for (let index = 0; index < 5; index++) {
        const inviteeId = await createUser({ userTag: `LISTUSR${index}`, name: `친구${index}` });
        const redemption = await redeem(
          inviterId,
          invite.id,
          inviteeId,
          new Date(`2026-11-0${index + 2}T00:00:00Z`),
        );
        if (index === 4) {
          redemption.recordActiveDay("2026-11-06", new Date("2026-11-06T00:00:00Z"));
          redemption.recordActiveDay("2026-11-07", new Date("2026-11-07T00:00:00Z"));
          await redemptions.save(redemption);
        }
        inviteeIds.push(inviteeId);
      }

      // When
      statements = [];
      const firstPage = await redemptions.findInvitedFriends({ inviterId, size: 2 });
      const firstPageStatements = statements.length;
      statements = [];
      const everyone = await redemptions.findInvitedFriends({ inviterId, size: 5 });
      const fullPageStatements = statements.length;
      statements = null;
      const nextPage = await redemptions.findInvitedFriends({
        inviterId,
        cursor: firstPage.at(-1)?.userId,
        size: 2,
      });

      // Then
      expect([firstPageStatements, fullPageStatements]).toEqual([1, 1]);
      expect(everyone.map((friend) => friend.userId)).toEqual([...inviteeIds].reverse());
      expect(everyone[0]).toMatchObject({
        name: "친구4",
        userTag: "LISTUSR4",
        profileImage: "orange_tabby",
        status: "JOINED",
        activeDayCount: 2,
        joinedAt: new Date("2026-11-06T00:00:00Z"),
        qualifiedAt: null,
      });
      expect(nextPage.map((friend) => friend.userId)).toEqual([inviteeIds[2], inviteeIds[1]]);
    });

    it("마감 정비가 동시에 돌아도 SKIP LOCKED로 나눠 잡아 같은 수락을 두 번 거절하지 않는다", async () => {
      // Given
      const inviterId = await createUser({ userTag: "EXPOWNER" });
      const invite = await invites.issue({ inviterId, issuedAt: new Date("2026-11-01T00:00:00Z") });
      for (let index = 0; index < 6; index++) {
        const inviteeId = await createUser({ userTag: `EXPUSER${index}` });
        await redeem(inviterId, invite.id, inviteeId, new Date("2026-11-01T00:00:00Z"));
      }
      const at = new Date("2026-11-20T00:00:00Z");

      // When
      const counts = await Promise.all(
        Array.from({ length: 3 }, () =>
          unitOfWork.run(() => redemptions.expireJoinedBefore(at, 4)),
        ),
      );
      const rest = await unitOfWork.run(() => redemptions.expireJoinedBefore(at, 4));

      // Then
      expect(counts.reduce((sum, count) => sum + count, 0) + rest).toBe(6);
      expect(await redemptions.summarizeByInviterId(inviterId)).toMatchObject({
        joinedCount: 0,
        rejectedCount: 6,
      });
    });

    it("상태별 수를 한 번의 집계로 반환하고 마감이 지난 JOINED만 거절한다", async () => {
      // Given
      const inviterId = await createUser({ userTag: "SUMOWNER" });
      const invite = await invites.issue({ inviterId, issuedAt: new Date("2026-11-01T00:00:00Z") });
      const staleId = await createUser({ userTag: "SUMUSER1" });
      const freshId = await createUser({ userTag: "SUMUSER2" });
      await redeem(inviterId, invite.id, staleId, new Date("2026-11-01T00:00:00Z"));
      await redeem(inviterId, invite.id, freshId, new Date("2026-11-10T00:00:00Z"));

      // When
      const expired = await redemptions.expireJoinedBefore(new Date("2026-11-15T00:00:00Z"), 500);
      const summary = await redemptions.summarizeByInviterId(inviterId);

      // Then
      expect(expired).toBe(1);
      expect(summary).toEqual({
        joinedCount: 1,
        qualifiedCount: 0,
        rewardedCount: 0,
        rejectedCount: 1,
      });
      expect(await redemptions.hasJoinedByInviteeId(staleId)).toBe(false);
      expect(await redemptions.hasJoinedByInviteeId(freshId)).toBe(true);
    });
  });
});
