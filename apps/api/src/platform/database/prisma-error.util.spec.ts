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
});
