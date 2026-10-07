import { mockDeep } from "vitest-mock-extended";

import type { DatabaseService } from "#api/platform/database/database.service";

import { createMockDatabaseContext, type MockDatabaseContext } from "./database.mock.js";

export function createMockDatabaseService(
  context: MockDatabaseContext = createMockDatabaseContext(),
) {
  const service = mockDeep<DatabaseService>();
  const runtime = mockDeep<ReturnType<DatabaseService["db"]["runtime"]>>();
  Object.assign(runtime, { query: context.query, execute: context.execute });
  Object.assign(service.db, {
    orm: context.orm,
    sql: context.sql,
    raw: context.raw,
    enums: context.enums,
    nativeEnums: context.nativeEnums,
  });
  service.db.runtime.mockReturnValue(runtime);
  return service;
}
