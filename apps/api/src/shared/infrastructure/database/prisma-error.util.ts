import contractJson from "../../../generated/prisma8/contract.json" with { type: "json" };

/** Prisma 8 drivers normalize PostgreSQL failures with kind/sqlState. */
export function databaseSqlState(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;
  if (
    "kind" in error &&
    error.kind === "sql_query" &&
    "sqlState" in error &&
    typeof error.sqlState === "string"
  ) {
    return error.sqlState;
  }
  return undefined;
}

export function databaseConstraint(error: unknown): string | undefined {
  if (databaseSqlState(error) === undefined || !(error instanceof Error)) return undefined;
  return "constraint" in error && typeof error.constraint === "string"
    ? error.constraint
    : undefined;
}

/** Prisma 8 singleton mutations return null; repository contracts still reject missing records. */
export class DatabaseRecordNotFoundError extends Error {
  constructor() {
    super("Database record not found");
    this.name = "DatabaseRecordNotFoundError";
  }
}

export function requireRecord<Row>(row: Row | null | undefined): Row {
  if (row === null || row === undefined) throw new DatabaseRecordNotFoundError();
  return row;
}

/** 인프라 adapter가 native 오류를 공개 port의 충돌·부재 의미로 변환한다. */

/** 유니크 제약 위반(SQLSTATE 23505) 여부 */
export function isUniqueConstraintViolation(error: unknown): boolean {
  return databaseSqlState(error) === "23505";
}

/** 대상 레코드 부재 여부 */
export function isRecordNotFoundError(error: unknown): boolean {
  return error instanceof DatabaseRecordNotFoundError;
}

/** Serializable 트랜잭션 write conflict/deadlock 재시도 가능 여부 */
export function isTransactionWriteConflict(error: unknown): boolean {
  const sqlState = databaseSqlState(error);
  return sqlState === "40001" || sqlState === "40P01";
}

/** PostgreSQL constraint 이름을 계약의 필드 목록으로 변환한다. */
export function uniqueConstraintTargets(error: unknown): string[] | undefined {
  const name = databaseConstraint(error);
  if (databaseSqlState(error) === "23505" && name !== undefined) {
    for (const table of Object.values(contractJson.storage.namespaces.public.entries.table)) {
      if (!("uniques" in table)) continue;
      for (const constraint of table.uniques) {
        if (constraint.name === name) return constraint.columns.map((field) => field);
      }
    }
    return undefined;
  }
  return undefined;
}
