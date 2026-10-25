import { vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";

import type { DatabaseService } from "#api/platform/database/database.service";

import { createMockDatabaseContext, type MockDatabaseContext } from "./database.mock.js";

type DatabaseClient = DatabaseService["db"];
export type MockDatabaseService = Omit<DeepMockProxy<DatabaseService>, "db"> & {
  readonly db: Omit<DeepMockProxy<DatabaseClient>, "orm"> & Pick<MockDatabaseContext, "orm">;
};

/** `mockDeep`가 만든 runtime 멤버가 mock 함수인지 확인한 뒤 mock 전용 타입으로 본다. */
function isMockDatabaseService(value: unknown): value is MockDatabaseService {
  return vi.isMockFunction(Reflect.get(Object(Reflect.get(Object(value), "db")), "runtime"));
}

const databaseServiceByMock = new WeakMap<MockDatabaseService, DatabaseService>();

export function createMockDatabaseService(
  context: MockDatabaseContext = createMockDatabaseContext(),
): MockDatabaseService {
  const service: DatabaseService = mockDeep<DatabaseService>();
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
  const mockView: unknown = service;
  if (!isMockDatabaseService(mockView)) {
    throw new TypeError("mockDeep가 DatabaseService mock을 만들지 않았습니다");
  }
  const mockService = mockView;
  mockService.db.runtime.mockReturnValue(runtime);
  databaseServiceByMock.set(mockService, service);
  return mockService;
}

/** 같은 mock 객체를 운영 타입으로 돌려준다. `createMockDatabaseService`로 만든 mock만 받는다. */
export function asDatabaseService(mock: MockDatabaseService): DatabaseService {
  const service = databaseServiceByMock.get(mock);
  if (service === undefined) {
    throw new TypeError("createMockDatabaseService로 만든 mock이 아닙니다");
  }
  return service;
}
