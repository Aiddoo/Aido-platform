import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";

import type { DatabaseService } from "#api/platform/database/database.service";

import { createMockDatabaseContext, type MockDatabaseContext } from "./database.mock.js";

type DatabaseClient = DatabaseService["db"];
export type MockDatabaseService = Omit<DeepMockProxy<DatabaseService>, "db"> & {
  readonly db: Omit<DeepMockProxy<DatabaseClient>, "orm"> & Pick<MockDatabaseContext, "orm">;
};

export function createMockDatabaseService(
  context: MockDatabaseContext = createMockDatabaseContext(),
): MockDatabaseService {
  const service = mockDeep<DatabaseService>();
  const runtime = mockDeep<ReturnType<DatabaseClient["runtime"]>>();
  Object.assign(runtime, { query: context.query, execute: context.execute });
  Object.assign(service.db, {
    orm: context.orm,
    sql: context.sql,
    raw: context.raw,
    enums: context.enums,
    nativeEnums: context.nativeEnums,
    query: context.query,
    execute: context.execute,
  });
  service.db.runtime.mockReturnValue(runtime);
  return service as unknown as MockDatabaseService;
}

export function asDatabaseService(mock: MockDatabaseService): DatabaseService {
  return mock as unknown as DatabaseService;
}
