import { sqlQueryError } from "#test/mocks/database.mock";

import {
  databaseConstraint,
  DatabaseRecordNotFoundError,
  databaseSqlState,
  isRecordNotFoundError,
  isTransactionWriteConflict,
  isUniqueConstraintViolation,
  uniqueConstraintTargets,
} from "./prisma-error.util.js";

describe("native PostgreSQL 오류 변환 경계", () => {
  it.each(["40001", "40P01"])("transaction 오류 %s는 재시도한다", (state) => {
    expect(isTransactionWriteConflict(sqlQueryError(state))).toBe(true);
  });
  it.each(["23503", "23505", "XX000"])(
    "transaction과 무관한 오류 %s는 재시도하지 않는다",
    (state) => {
      expect(isTransactionWriteConflict(sqlQueryError(state))).toBe(false);
    },
  );
  it("정규화되지 않은 유사 오류를 DB 오류로 취급하지 않는다", () => {
    expect(databaseSqlState(Object.assign(new Error("plain"), { code: "40001" }))).toBeUndefined();
    expect(isTransactionWriteConflict(new Error("TransactionWriteConflict"))).toBe(false);
  });
  it("contract에서 native unique constraint의 필드를 조회한다", () => {
    const error = sqlQueryError("23505", "User_email_key");
    expect(isUniqueConstraintViolation(error)).toBe(true);
    expect(databaseConstraint(error)).toBe("User_email_key");
    expect(uniqueConstraintTargets(error)).toEqual(["email"]);
    expect(uniqueConstraintTargets(sqlQueryError("23505", "unmanaged_index"))).toBeUndefined();
  });
  it("명시적인 record-not-found 오류를 유지한다", () => {
    expect(isRecordNotFoundError(new DatabaseRecordNotFoundError())).toBe(true);
    expect(isRecordNotFoundError(new Error("missing"))).toBe(false);
  });
  it.each(["40001", "40P01"])(
    "커밋 wrapper의 cause 안 SQLSTATE %s를 재시도 대상으로 판정한다",
    (state) => {
      // Given
      const error = new Error("Transaction commit failed", { cause: sqlQueryError(state) });
      // When
      const retryable = isTransactionWriteConflict(error);
      // Then
      expect(retryable).toBe(true);
      expect(databaseSqlState(error)).toBe(state);
    },
  );

  it("여러 wrapper 안 유니크 오류의 같은 leaf에서 constraint와 필드를 읽는다", () => {
    // Given
    const error = Object.assign(
      new Error("wrapper", {
        cause: new Error("inner", { cause: sqlQueryError("23505", "User_email_key") }),
      }),
      { constraint: "unmanaged_index" },
    );
    // When
    const targets = uniqueConstraintTargets(error);
    // Then
    expect(targets).toEqual(["email"]);
    expect(databaseConstraint(error)).toBe("User_email_key");
    expect(isTransactionWriteConflict(error)).toBe(false);
  });

  it("SQLSTATE와 constraint는 서로 다른 오류 노드에서 합치지 않는다", () => {
    // Given
    const error = sqlQueryError("23505");
    error.cause = sqlQueryError("23505", "User_email_key");
    // When
    const constraint = databaseConstraint(error);
    // Then
    expect(constraint).toBeUndefined();
    expect(uniqueConstraintTargets(error)).toBeUndefined();
  });

  it.each([
    undefined,
    null,
    "40001",
    40001,
    { code: "40001" },
    { kind: "sql_query", sqlState: "40001" },
  ])("Error가 아닌 cause %j는 정규화된 DB 오류로 취급하지 않는다", (cause) => {
    // Given
    const error = new Error("40001 private SQL text", { cause });
    // When
    const retryable = isTransactionWriteConflict(error);
    // Then
    expect(retryable).toBe(false);
    expect(databaseConstraint(error)).toBeUndefined();
    expect(databaseSqlState(cause)).toBeUndefined();
  });

  it("메시지와 일반 pg code는 cause 안에서도 재시도 판정에 사용하지 않는다", () => {
    // Given
    const error = new Error("Transaction commit failed 40001", {
      cause: Object.assign(new Error("40P01 private data"), { code: "40001" }),
    });
    // When
    const state = databaseSqlState(error);
    // Then
    expect(state).toBeUndefined();
    expect(isTransactionWriteConflict(error)).toBe(false);
  });

  it("Error와 AggregateError가 서로를 cause로 참조해도 종료한다", () => {
    // Given
    const first = new Error("first");
    const second = new AggregateError([sqlQueryError("40001")], "second", { cause: first });
    first.cause = second;
    // When
    const state = databaseSqlState(first);
    // Then
    expect(state).toBeUndefined();
    expect(isTransactionWriteConflict(first)).toBe(false);
  });

  it("자기 자신을 참조하는 native DB 오류는 자신의 metadata를 유지한다", () => {
    // Given
    const error = sqlQueryError("23505", "User_email_key");
    error.cause = error;
    // When
    const targets = uniqueConstraintTargets(error);
    // Then
    expect(targets).toEqual(["email"]);
  });

  it.each(["23503", "23505", "XX000"])(
    "wrapper 안 nonretryable SQLSTATE %s도 재시도하지 않는다",
    (state) => {
      // Given
      const error = new Error("commit failure", { cause: sqlQueryError(state) });
      // When
      const retryable = isTransactionWriteConflict(error);
      // Then
      expect(retryable).toBe(false);
      expect(databaseSqlState(error)).toBe(state);
    },
  );
});
