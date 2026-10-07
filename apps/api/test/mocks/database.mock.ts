import type { TransactionHost } from "@nestjs-cls/transactional";
import { AsyncIterableResult } from "@prisma/orm-postgres/components/runtime";
import {
  all,
  and,
  type DefaultModelRow,
  type ModelAccessor,
} from "@prisma/orm-postgres/orm-client";
import {
  collectOrderedParamRefs,
  type AnyQueryAst,
} from "@prisma/orm-postgres/relational-core/ast";
import postgres from "@prisma/orm-postgres/runtime";
import { isPlainObject } from "es-toolkit";
import { vi } from "vitest";
import { mock, mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";

import type { ModelName } from "#api/platform/database/database-records";
import {
  databaseDate,
  databaseTimestamp,
  databaseTimestamptz,
} from "#api/platform/database/database-values";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";
import type { Prisma8Transaction } from "#api/platform/database/prisma8-transactional.adapter";

import type { Contract } from "../../src/generated/prisma8/contract.d.js";
import contractJson from "../../src/generated/prisma8/contract.json" with { type: "json" };

export type MockDatabaseContext = DeepMockProxy<Prisma8Transaction>;
const staticClient = postgres<Contract>({ contractJson });

/** Native fluent query mocks. Real SQL/codec builders stay available for atomic operations. */
export function createMockDatabaseContext(): MockDatabaseContext {
  const context = mockDeep<Prisma8Transaction>();
  Object.assign(context, {
    raw: staticClient.raw,
    sql: staticClient.sql,
    enums: staticClient.enums,
    nativeEnums: staticClient.nativeEnums,
  });
  for (const name of Object.keys(contractJson.domain.namespaces.public.models)) {
    const model = Reflect.get(context.orm.public, name);
    if ((typeof model !== "object" || model === null) && typeof model !== "function") {
      throw new TypeError(`Invalid native model mock: ${name}`);
    }
    const grouped = mockDeep<ReturnType<Prisma8Transaction["orm"]["public"]["User"]["groupBy"]>>();
    Object.assign(grouped, { orderBy: vi.fn(() => grouped), limit: vi.fn(() => grouped) });
    Object.assign(model, {
      where: vi.fn(() => model),
      select: vi.fn(() => model),
      include: vi.fn(() => model),
      cursor: vi.fn(() => model),
      orderBy: vi.fn(() => model),
      limit: vi.fn(() => model),
      offset: vi.fn(() => model),
      groupBy: vi.fn(() => grouped),
    });
  }
  return context;
}

export function nativeRows<Row>(rows: readonly Row[]): AsyncIterableResult<Row> {
  return new AsyncIterableResult(
    (async function* () {
      yield* rows;
    })(),
  );
}

export function sqlQueryError(sqlState: string, constraint?: string): Error {
  return Object.assign(new Error(`PostgreSQL ${sqlState}`), {
    kind: "sql_query",
    sqlState,
    constraint,
  });
}

/** Compare native predicates using an actual accessor; no database connection is opened. */
export function assertNativeWhere<M extends ModelName>(
  model: M,
  actual: unknown,
  expected: (row: ModelAccessor<Contract, M, "public">) => unknown,
  subset = false,
): void {
  if (typeof actual !== "function" && (typeof actual !== "object" || actual === null))
    throw new TypeError("Expected native where callback");
  function evaluate(input: unknown) {
    const collection = Reflect.get(postgres<Contract>({ contractJson }).orm.public, model);
    const where = Reflect.get(collection, "where");
    if (typeof where !== "function") throw new TypeError("Missing native collection");
    let predicate: unknown;
    Reflect.apply(where, collection, [
      (row: ModelAccessor<Contract, M, "public">) => {
        predicate =
          typeof input === "function"
            ? input(row)
            : and(
                ...Object.entries(input ?? {}).map(([key, value]) => {
                  const field = Reflect.get(row, key);
                  const equal = Reflect.get(field, "eq");
                  if (typeof equal !== "function") throw new TypeError("Invalid scalar filter");
                  return Reflect.apply(equal, field, [value]);
                }),
              );
        return all();
      },
    ]);
    return normalizePredicate(predicate);
  }
  const actualValue = evaluate(actual);
  const expectedValue = evaluate(expected);
  const expectedShape =
    subset &&
    typeof actualValue === "object" &&
    actualValue !== null &&
    Reflect.get(actualValue, "kind") === "and" &&
    !(
      typeof expectedValue === "object" &&
      expectedValue !== null &&
      Reflect.get(expectedValue, "kind") === "and"
    )
      ? { kind: "and", exprs: [expectedValue] }
      : expectedValue;
  expect(actualValue).toEqual(subset ? predicateSubset(expectedShape) : expectedShape);
}

export function resetMockDatabaseContext(context: MockDatabaseContext): void {
  mockReset(context);
}

type Models = Contract["domain"]["namespaces"]["public"]["models"];
type RelationTarget<
  M extends ModelName,
  K extends keyof Models[M]["relations"],
> = Models[M]["relations"][K] extends {
  readonly to: { readonly model: infer Target extends ModelName };
}
  ? Target
  : never;
type Fixture<M extends ModelName, Row> = Row extends null | undefined
  ? Row
  : Row extends readonly (infer Item)[]
    ? Fixture<M, Item>[]
    : {
        [K in keyof Row as K extends "type" ? "_type" : K]: (
          K extends "type" ? "_type" : K
        ) extends keyof DefaultModelRow<Contract, M, "public">
          ? DefaultModelRow<Contract, M, "public">[Extract<
              K extends "type" ? "_type" : K,
              keyof DefaultModelRow<Contract, M, "public">
            >]
          : K extends keyof Models[M]["relations"]
            ? Fixture<RelationTarget<M, K>, Row[K]>
            : Row[K];
      };

/** Encode application fixtures at the same boundary as real database rows; JSON is untouched. */
export function databaseFixture<M extends ModelName, Row>(model: M, row: Row): Fixture<M, Row>;
export function databaseFixture(model: ModelName, row: unknown): unknown {
  return databaseFixtureValue(model, row);
}

function databaseFixtureValue(model: string, value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((item) => databaseFixtureValue(model, item));
  if (!isPlainObject(value)) return value;
  const metadata = Object.entries(contractJson.domain.namespaces.public.models).find(
    ([name]) => name === model,
  )?.[1];
  if (metadata === undefined) throw new TypeError(`Unknown fixture model: ${model}`);
  const fields = new Map(Object.entries(metadata.fields));
  const relations = new Map(Object.entries(metadata.relations));
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      const name = key === "type" && fields.has("_type") ? "_type" : key;
      const codec = fields.get(name)?.type.codecId;
      if (item instanceof Date && codec === "pg/date-string@1") return [name, databaseDate(item)];
      if (item instanceof Date && codec === "pg/timestamp-string@1")
        return [name, databaseTimestamp(item)];
      if (item instanceof Date && codec === "pg/timestamptz-string@1")
        return [name, databaseTimestamptz(item)];
      const target = relations.get(key)?.to.model;
      return [name, target !== undefined ? databaseFixtureValue(target, item) : item];
    }),
  );
}

/** Compare native scalar writes while retaining asymmetric test matchers. */
export function databaseWriteExpectation<M extends ModelName>(
  model: M,
  fields: Record<string, unknown>,
): unknown {
  return databaseFixture(
    model,
    Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)),
  );
}

function normalizePredicate(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (typeof Reflect.get(value, "asymmetricMatch") === "function") return value;
  if (Array.isArray(value)) return value.map(normalizePredicate);
  const kind = Reflect.get(value, "kind");
  const expressions = Reflect.get(value, "exprs");
  if (kind === "and" && Array.isArray(expressions)) {
    const children = expressions
      .map(normalizePredicate)
      .filter((child) => child !== undefined)
      .flatMap((child) =>
        typeof child === "object" &&
        child !== null &&
        Reflect.get(child, "kind") === "and" &&
        Array.isArray(Reflect.get(child, "exprs"))
          ? Reflect.get(child, "exprs")
          : [child],
      );
    if (children.length === 0) return undefined;
    if (children.length === 1) return children[0];
    return { kind, exprs: children };
  }
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, child]) => [key, normalizePredicate(child)])
      .filter(([, child]) => child !== undefined),
  );
}

export function createMockTransactionHost(context: Prisma8Transaction) {
  const host = mock<TransactionHost<Prisma8TransactionalAdapter>>();
  Object.defineProperty(host, "tx", { get: () => context });
  return host;
}

function predicateSubset(value: unknown): unknown {
  if (
    value === null ||
    typeof value !== "object" ||
    typeof Reflect.get(value, "asymmetricMatch") === "function"
  )
    return value;
  if (Array.isArray(value)) return expect.arrayContaining(value.map(predicateSubset));
  return expect.objectContaining(
    Object.fromEntries(Object.entries(value).map(([key, item]) => [key, predicateSubset(item)])),
  );
}
export function assertNativeWhereContains<M extends ModelName>(
  model: M,
  actual: unknown,
  expected: (row: ModelAccessor<Contract, M, "public">) => unknown,
): void {
  assertNativeWhere(model, actual, expected, true);
}
export function assertNativeOrder<M extends ModelName>(
  model: M,
  actual: unknown,
  expected: (row: ModelAccessor<Contract, M, "public">) => unknown,
): void {
  const collection = Reflect.get(staticClient.orm.public, model);
  const order = Reflect.get(collection, "orderBy");
  if (typeof actual !== "function" || typeof order !== "function")
    throw new TypeError("Expected native order callback");
  Reflect.apply(order, collection, [
    (row: ModelAccessor<Contract, M, "public">) => {
      expect(actual(row)).toEqual(expected(row));
      return expected(row);
    },
  ]);
}

export function nativeSqlParameters(plan: { readonly ast: AnyQueryAst } | undefined): unknown[] {
  if (plan === undefined) throw new TypeError("Missing native SQL plan");
  return collectOrderedParamRefs(plan.ast).map((parameter) => {
    if (!("value" in parameter)) throw new TypeError("Expected a bound SQL parameter");
    return parameter.value;
  });
}
