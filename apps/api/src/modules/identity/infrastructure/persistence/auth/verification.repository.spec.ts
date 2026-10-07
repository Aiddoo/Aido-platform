import { and } from "@prisma/orm-postgres/orm-client";
import { vi } from "vitest";

import { databaseTimestamp, varchar } from "#api/platform/database/database-values";
import { VerificationFixture } from "#test/fixtures/index";
import {
  assertNativeWhere,
  createMockTransactionHost,
  databaseFixture,
  databaseWriteExpectation,
} from "#test/mocks/database.mock";
import { createMockDatabaseContext, type MockDatabaseContext } from "#test/mocks/index";
import { createMockDatabaseService } from "#test/mocks/mock-database.factory";

import { VerificationRepository } from "./verification.repository.js";

const at = new Date("2026-12-31T23:59:00.000Z");
const expiresAt = new Date("2027-01-01T00:09:00.000Z");

describe("VerificationRepository — 인증 저장과 독립 실패 기록", () => {
  let repository: VerificationRepository;
  let db: MockDatabaseContext;
  let baseDb: MockDatabaseContext;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(at);
    db = createMockDatabaseContext();
    baseDb = createMockDatabaseContext();
    repository = new VerificationRepository(
      createMockTransactionHost(db),
      createMockDatabaseService(baseDb),
    );
  });

  afterEach(() => vi.useRealTimers());

  it("저장된 인증의 필수 필드와 nullable 사용 시각을 복원한다", async () => {
    // Given
    const fixture = VerificationFixture.create({
      userId: "user-1",
      type: "EMAIL_VERIFY",
      token: "digest",
      expiresAt,
    });
    db.orm.public.Verification.create.mockResolvedValue(databaseFixture("Verification", fixture));

    // When
    const saved = await repository.create({
      userId: fixture.userId,
      type: fixture.type,
      token: fixture.token,
      expiresAt,
    });

    // Then
    expect(saved).toEqual(fixture);
    expect(db.orm.public.Verification.create).toHaveBeenCalledWith(
      expect.objectContaining(
        databaseWriteExpectation("Verification", {
          userId: fixture.userId,
          type: fixture.type,
          token: fixture.token,
          expiresAt,
        }),
      ),
    );
  });

  it("선택한 인증 ID와 사용자·용도·해시·상태 조건을 실제 UPDATE에 전달한다", async () => {
    // Given
    db.orm.public.Verification.updateAndCount.mockResolvedValue(1);
    const input = {
      id: 1,
      userId: "user-1",
      type: "EMAIL_VERIFY",
      tokenHash: "digest",
      maxAttempts: 5,
      at,
    } satisfies Parameters<VerificationRepository["consume"]>[0];

    // When
    const consumed = await repository.consume(input);

    // Then
    expect(consumed).toBe(true);
    assertNativeWhere("Verification", db.orm.public.Verification.where.mock.calls[0]?.[0], (row) =>
      and(
        row.id.eq(input.id),
        row.token.eq(varchar(input.tokenHash, 64)),
        row.userId.eq(input.userId),
        row._type.eq(input.type),
        row.usedAt.isNull(),
        row.expiresAt.gt(databaseTimestamp(at)),
        row.attempts.lt(5),
      ),
    );
    expect(db.orm.public.Verification.updateAndCount).toHaveBeenCalledWith(
      expect.objectContaining(databaseWriteExpectation("Verification", { usedAt: at })),
    );
  });

  it("조건부 UPDATE가 변경한 행이 없으면 소비 실패를 반환한다", async () => {
    // Given
    db.orm.public.Verification.updateAndCount.mockResolvedValue(0);

    // When
    const consumed = await repository.consume({
      id: 1,
      userId: "user-1",
      type: "PASSWORD_RESET",
      tokenHash: "digest",
      maxAttempts: 5,
      at,
    });

    // Then
    expect(consumed).toBe(false);
  });

  it("실패 횟수 증가는 호출자의 트랜잭션 클라이언트를 사용하지 않는다", async () => {
    // Given
    const fixture = VerificationFixture.create({ attempts: 1, expiresAt });
    baseDb.query.mockResolvedValue([databaseFixture("Verification", fixture)]);

    // When
    const saved = await repository.incrementAttempts(fixture.id);

    // Then
    expect(saved.attempts).toBe(1);
    expect(baseDb.query).toHaveBeenCalledOnce();
    expect(db.query).not.toHaveBeenCalled();
  });
});
