import { createFakeTransactionHost } from "#test/mocks/drizzle.mock";

import { PostgresMutationLockAdapter } from "./postgres-mutation-lock.adapter.js";

const TRANSACTION_CONTROL = /^(begin|commit|rollback)\b/i;

describe("PostgresMutationLockAdapter — 트랜잭션 advisory lock", () => {
  function setup() {
    const { host, statements } = createFakeTransactionHost();
    const adapter = new PostgresMutationLockAdapter(host);
    const lockStatements = () => statements.filter(({ text }) => !TRANSACTION_CONTROL.test(text));
    return { host, adapter, lockStatements };
  }

  it("중복 제거한 키를 정렬 순서로 한 번의 parameterized advisory lock 쿼리로 잠근다", async () => {
    // Given
    const { host, adapter, lockStatements } = setup();

    // When
    await host.withTransaction(() =>
      adapter.acquire([
        "mutation:v1:nudge:daily:user-1:2026-07-26",
        "mutation:v1:nudge:cooldown:user-1:42",
        "mutation:v1:nudge:daily:user-1:2026-07-26",
      ]),
    );

    // Then
    const statements = lockStatements();
    expect(statements).toHaveLength(1);
    expect(statements[0]?.text).toContain("pg_advisory_xact_lock");
    expect(statements[0]?.params).toEqual([
      ["mutation:v1:nudge:cooldown:user-1:42", "mutation:v1:nudge:daily:user-1:2026-07-26"],
    ]);
  });

  it("활성 트랜잭션이 아니면 SQL 전에 내부 invariant 오류로 실패한다", async () => {
    // Given
    const { adapter, lockStatements } = setup();

    // When / Then
    await expect(adapter.acquire(["mutation:v1:cheer:daily:user-1:2026-07-26"])).rejects.toThrow(
      "Mutation lock requires an active transaction",
    );
    expect(lockStatements()).toHaveLength(0);
  });

  it("빈 키 목록이면 PostgreSQL을 호출하지 않는다", async () => {
    // Given
    const { host, adapter, lockStatements } = setup();

    // When
    await host.withTransaction(() => adapter.acquire([]));

    // Then
    expect(lockStatements()).toHaveLength(0);
  });
});
